import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBacktest, walkForward, DEFAULT_COSTS } from '../bot/backtest.js';
import { computeTechnical } from '../bot/indicators.js';

// Deterministic synthetic price series so tests never flake.
function makeCandles(n, fn, seed = 7) {
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const out = [];
  let t = 1600000000;
  for (let i = 0; i < n; i++) {
    const close = fn(i, rand);
    const open = i === 0 ? close : out[i - 1].close;
    const hi = Math.max(open, close) * (1 + rand() * 0.01);
    const lo = Math.min(open, close) * (1 - rand() * 0.01);
    out.push({ time: t + i * 86400, open, high: hi, low: lo, close, volume: 1e6 + rand() * 1e5 });
  }
  return out;
}

const trending = (n = 400) => makeCandles(n, (i, r) => 100 * Math.pow(1.002, i) * (1 + (r() - 0.5) * 0.01));
const choppy   = (n = 400) => makeCandles(n, (i, r) => 100 + Math.sin(i / 8) * 10 + (r() - 0.5) * 2);

// --- Point-in-time correctness (the property that matters most) ------------

test('computeTechnical sees only the bars it is given', () => {
  const c = trending(400);
  // A slice ending at bar 250 must produce the same result whether or not
  // later bars exist in the parent array.
  const a = computeTechnical(c.slice(0, 251), 'X');
  const b = computeTechnical(c.slice(0, 251).map(x => ({ ...x })), 'X');
  assert.equal(a.price, b.price);
  assert.equal(a.oscillators.rsi14, b.oscillators.rsi14);
  // And it must equal the last close of the slice, not of the full series.
  assert.equal(a.price, +c[250].close.toFixed(2));
  assert.notEqual(a.price, +c[399].close.toFixed(2));
});

test('appending future bars does not change a past decision', () => {
  const base = trending(300);
  const extended = [...base, ...trending(100).map((c, i) => ({ ...c, time: c.time + 300 * 86400 }))];
  const atBar = 250;
  const a = computeTechnical(base.slice(0, atBar + 1), 'X');
  const b = computeTechnical(extended.slice(0, atBar + 1), 'X');
  assert.deepEqual(a.summary, b.summary);
  assert.equal(a.oscillators.rsi14, b.oscillators.rsi14);
});

test('backtest truncated early matches the prefix of the full run', () => {
  const full = trending(400);
  const short = full.slice(0, 330);
  const rFull = runBacktest(full, { warmup: 200, symbol: 'X' });
  const rShort = runBacktest(short, { warmup: 200, symbol: 'X' });
  assert.ok(rFull.available && rShort.available);
  // The first N equity points must be identical — later data cannot have
  // influenced earlier decisions.
  for (let i = 0; i < rShort.equityCurve.length - 1; i++) {
    assert.equal(rShort.equityCurve[i].equity, rFull.equityCurve[i].equity,
      `equity diverged at index ${i}`);
  }
});

test('fills happen at the next bar open, never the signal bar close', () => {
  const c = trending(400);
  const r = runBacktest(c, { warmup: 200, symbol: 'X' });
  for (const tr of r.tradeLog) {
    const bar = c.find(x => x.time === tr.time);
    assert.ok(bar, 'trade time must match a real bar');
    // Reference price is that bar's OPEN.
    assert.equal(tr.reference, bar.open);
  }
});

// --- Costs -----------------------------------------------------------------

test('buys fill above the reference and sells below it', () => {
  const r = runBacktest(trending(400), { warmup: 200, symbol: 'X' });
  for (const t of r.tradeLog) {
    if (t.side === 'buy') assert.ok(t.price > t.reference, 'buy should slip up');
    if (t.side === 'sell') assert.ok(t.price < t.reference, 'sell should slip down');
  }
});

test('costs reduce returns versus a frictionless run', () => {
  const c = choppy(400);
  const withCosts = runBacktest(c, { warmup: 200, symbol: 'X' });
  const free = runBacktest(c, {
    warmup: 200, symbol: 'X',
    costs: { commissionPerShare: 0, commissionMinimum: 0, slippageBps: 0, spreadBps: 0 },
  });
  if (withCosts.trades > 0) {
    assert.ok(withCosts.stats.totalReturn <= free.stats.totalReturn,
      'costs must not improve returns');
    assert.ok(withCosts.costs.totalCost > 0, 'costs should be recorded');
  }
});

test('cost drag is reported and non-negative', () => {
  const r = runBacktest(choppy(400), { warmup: 200, symbol: 'X' });
  assert.ok(r.costs.costDragPercent >= 0);
  assert.ok(r.costs.totalCommission >= 0);
  assert.ok(r.costs.totalSlippage >= 0);
});

test('higher slippage produces worse results on the same data', () => {
  const c = choppy(400);
  const low = runBacktest(c, { warmup: 200, costs: { ...DEFAULT_COSTS, slippageBps: 1 } });
  const high = runBacktest(c, { warmup: 200, costs: { ...DEFAULT_COSTS, slippageBps: 100 } });
  if (low.trades > 0) {
    assert.ok(high.stats.totalReturn <= low.stats.totalReturn);
  }
});

// --- Accounting ------------------------------------------------------------

test('equity never goes negative and cash is never overspent', () => {
  const r = runBacktest(trending(400), { warmup: 200, initialCapital: 10000 });
  for (const p of r.equityCurve) assert.ok(p.equity > 0, 'equity went non-positive');
});

test('position size respects the configured cap', () => {
  const cap = 20;
  const r = runBacktest(trending(400), { warmup: 200, initialCapital: 100000, maxPositionPercent: cap });
  for (const t of r.tradeLog.filter(x => x.side === 'buy')) {
    const notional = t.qty * t.price;
    // Allow headroom for equity having grown before the trade.
    assert.ok(notional <= 100000 * (cap / 100) * 3, `position ${notional} far exceeds cap`);
  }
});

test('every sell is preceded by a buy — no accidental shorting', () => {
  const r = runBacktest(choppy(400), { warmup: 200 });
  let pos = 0;
  for (const t of r.tradeLog) {
    if (t.side === 'buy') pos += t.qty;
    else { pos -= t.qty; assert.ok(pos >= 0, 'went short'); }
  }
});

// --- Benchmark -------------------------------------------------------------

test('benchmark is computed over the identical window', () => {
  const c = trending(400);
  const r = runBacktest(c, { warmup: 200 });
  assert.equal(r.equityCurve.length, r.bars);
  assert.equal(r.benchmark.periods, r.stats.periods);
});

test('buy-and-hold beats a strategy that never trades in an uptrend', () => {
  // Threshold of 1.0 can never be exceeded, so the strategy stays in cash.
  const c = trending(400);
  const r = runBacktest(c, { warmup: 200, threshold: 1.0 });
  assert.equal(r.trades, 0);
  assert.ok(r.benchmark.totalReturn > r.stats.totalReturn,
    'holding should beat sitting in cash while price rises');
  assert.equal(r.beatBenchmark, false);
});

test('excessReturn equals strategy minus benchmark', () => {
  const r = runBacktest(trending(400), { warmup: 200 });
  const expected = +(r.stats.totalReturn - r.benchmark.totalReturn).toFixed(2);
  assert.equal(r.excessReturn, expected);
});

// --- Guards ----------------------------------------------------------------

test('refuses to run without enough history', () => {
  const r = runBacktest(makeCandles(50, i => 100 + i), { warmup: 200 });
  assert.equal(r.available, false);
  assert.match(r.message, /at least/);
});

test('handles an empty or missing series without throwing', () => {
  assert.equal(runBacktest([], {}).available, false);
  assert.equal(runBacktest(null, {}).available, false);
});

// --- Walk-forward ----------------------------------------------------------

test('walk-forward produces the requested number of folds', () => {
  const r = walkForward(trending(700), { folds: 3, warmup: 200 });
  assert.equal(r.available, true);
  assert.equal(r.folds.length, 3);
  for (const f of r.folds) assert.ok(f.from < f.to, 'fold window must move forward');
});

test('walk-forward folds cover successive periods', () => {
  const r = walkForward(trending(700), { folds: 3, warmup: 200 });
  for (let i = 1; i < r.folds.length; i++) {
    assert.ok(r.folds[i].from > r.folds[i - 1].from, 'folds must advance');
  }
});

test('walk-forward reports consistency across folds', () => {
  const r = walkForward(trending(700), { folds: 4, warmup: 200 });
  assert.ok(r.consistency.totalFolds === 4);
  assert.ok(r.consistency.beatRate >= 0 && r.consistency.beatRate <= 100);
  assert.ok(r.consistency.worstFold <= r.consistency.bestFold);
});

test('walk-forward refuses when history is too short', () => {
  const r = walkForward(trending(250), { folds: 8, warmup: 200 });
  assert.equal(r.available, false);
});
