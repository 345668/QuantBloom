import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mean, stdev, skewness, kurtosis, invNorm, sharpe, sortino, maxDrawdown,
  probabilisticSharpe, expectedMaxSharpe, deflatedSharpe,
  probabilityOfBacktestOverfitting, summarise,
} from '../bot/statistics.js';

const close = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} within ${tol} of ${b}`);

// Deterministic pseudo-random so tests never flake.
function rng(seed = 42) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}
function normals(n, mu, sd, seed = 42) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.max(r(), 1e-12), u2 = r();
    const m = Math.sqrt(-2 * Math.log(u1));
    out.push(mu + sd * m * Math.cos(2 * Math.PI * u2));
    if (out.length < n) out.push(mu + sd * m * Math.sin(2 * Math.PI * u2));
  }
  return out.slice(0, n);
}

// --- Moments ---------------------------------------------------------------

test('mean and sample stdev match known values', () => {
  const a = [2, 4, 4, 4, 5, 5, 7, 9];
  close(mean(a), 5, 1e-12);
  // Population sd is 2; sample sd is sqrt(32/7).
  close(stdev(a, false), 2, 1e-12);
  close(stdev(a, true), Math.sqrt(32 / 7), 1e-12);
});

test('symmetric data has zero skew', () => {
  close(skewness([-2, -1, 0, 1, 2]), 0, 1e-12);
});

test('right-tailed data has positive skew', () => {
  assert.ok(skewness([1, 1, 1, 1, 10]) > 0);
});

test('normal-ish data has kurtosis near 3', () => {
  const k = kurtosis(normals(4000, 0, 1, 7));
  assert.ok(k > 2.5 && k < 3.6, `kurtosis ${k} not near 3`);
});

test('fat tails raise kurtosis above 3', () => {
  const a = [...Array(200).fill(0), -8, 8];
  assert.ok(kurtosis(a) > 3);
});

test('invNorm inverts the normal CDF at known quantiles', () => {
  close(invNorm(0.5), 0, 1e-6);
  close(invNorm(0.975), 1.959964, 1e-4);
  close(invNorm(0.025), -1.959964, 1e-4);
  close(invNorm(0.95), 1.644854, 1e-4);
});

// --- Sharpe / Sortino ------------------------------------------------------

test('sharpe equals mean over stdev', () => {
  const r = [0.01, 0.02, -0.01, 0.03, 0.00];
  close(sharpe(r), mean(r) / stdev(r), 1e-12);
});

test('sharpe falls when the risk-free rate rises', () => {
  const r = [0.01, 0.02, -0.01, 0.03];
  assert.ok(sharpe(r, 0.005) < sharpe(r, 0));
});

test('zero-variance returns give a sharpe of 0 rather than Infinity', () => {
  assert.equal(sharpe([0.01, 0.01, 0.01]), 0);
});

test('sortino exceeds sharpe when downside is milder than total volatility', () => {
  // Big upside moves inflate total vol but not downside deviation.
  const r = [0.05, 0.06, -0.01, 0.07, -0.01];
  assert.ok(sortino(r) > sharpe(r));
});

test('sortino is Infinity when nothing is below the threshold', () => {
  assert.equal(sortino([0.01, 0.02, 0.03]), Infinity);
});

// --- Drawdown --------------------------------------------------------------

test('maxDrawdown finds the worst peak-to-trough decline', () => {
  const eq = [100, 120, 90, 110, 60, 130];
  // Peak 120 -> trough 60 is a 50% decline.
  const d = maxDrawdown(eq);
  close(d.maxDrawdown, 0.5, 1e-12);
  assert.equal(eq[d.peakIndex], 120);
  assert.equal(eq[d.troughIndex], 60);
});

test('a monotonically rising curve has zero drawdown', () => {
  close(maxDrawdown([100, 101, 102, 103]).maxDrawdown, 0, 1e-12);
});

// --- Overfitting guards ----------------------------------------------------

test('PSR rises with a longer track record at the same Sharpe', () => {
  const short = probabilisticSharpe(0.1, 0, 50, 0, 3);
  const long = probabilisticSharpe(0.1, 0, 500, 0, 3);
  assert.ok(long > short, 'more observations should give more confidence');
});

test('PSR falls when returns are negatively skewed', () => {
  const symmetric = probabilisticSharpe(0.1, 0, 250, 0, 3);
  const negSkew = probabilisticSharpe(0.1, 0, 250, -1.5, 3);
  assert.ok(negSkew < symmetric, 'negative skew should reduce confidence');
});

test('PSR falls when returns are fat-tailed', () => {
  const normalTails = probabilisticSharpe(0.1, 0, 250, 0, 3);
  const fatTails = probabilisticSharpe(0.1, 0, 250, 0, 12);
  assert.ok(fatTails < normalTails, 'fat tails should reduce confidence');
});

test('PSR is 0.5 when the observed Sharpe equals the benchmark', () => {
  close(probabilisticSharpe(0.1, 0.1, 250, 0, 3), 0.5, 1e-9);
});

test('expected max Sharpe grows with the number of trials', () => {
  const v = 0.01;
  const few = expectedMaxSharpe(5, v);
  const many = expectedMaxSharpe(500, v);
  assert.ok(many > few, 'more trials should raise the luck threshold');
  assert.ok(few > 0);
});

test('expected max Sharpe is zero when trial Sharpes never vary', () => {
  close(expectedMaxSharpe(100, 0), 0, 1e-12);
});

test('deflating punishes a strategy selected from many trials', () => {
  const r = normals(500, 0.0006, 0.01, 11);
  const one = deflatedSharpe(r, 1);
  const thousand = deflatedSharpe(r, 1000);
  assert.ok(thousand.expectedMaxSharpe > one.expectedMaxSharpe);
  assert.ok(thousand.deflatedSharpe < one.deflatedSharpe,
    'the same returns should be less convincing after 1000 trials');
});

test('deflatedSharpe reports the inputs it used', () => {
  const d = deflatedSharpe(normals(300, 0.0005, 0.01, 3), 50);
  assert.equal(d.nTrials, 50);
  assert.ok(Number.isFinite(d.sharpe));
  assert.ok(d.deflatedSharpe >= 0 && d.deflatedSharpe <= 1);
});

test('deflatedSharpe declines to answer on a tiny sample', () => {
  assert.equal(deflatedSharpe([0.01, 0.02], 10), null);
});

test('PBO is high when all variants are pure noise', () => {
  // No variant has real edge, so the in-sample winner is random.
  const matrix = Array.from({ length: 8 }, (_, i) => normals(400, 0, 0.01, 100 + i));
  const res = probabilityOfBacktestOverfitting(matrix, 6);
  assert.ok(res.pbo > 0.2, `expected substantial PBO for noise, got ${res.pbo}`);
});

test('PBO is low when one variant has genuine persistent edge', () => {
  const matrix = [
    normals(400, 0.004, 0.01, 1),   // real, consistent edge
    ...Array.from({ length: 7 }, (_, i) => normals(400, 0, 0.01, 200 + i)),
  ];
  const res = probabilityOfBacktestOverfitting(matrix, 6);
  assert.ok(res.pbo < 0.2, `expected low PBO for a real edge, got ${res.pbo}`);
});

test('PBO needs at least two variants and enough history', () => {
  assert.equal(probabilityOfBacktestOverfitting([normals(100, 0, 0.01)], 6), null);
  assert.equal(probabilityOfBacktestOverfitting([[1, 2], [3, 4]], 8), null);
});

// --- Summary ---------------------------------------------------------------

test('summarise computes total return and CAGR consistently', () => {
  // Exactly 2 years of 252-period years, doubling.
  const n = 504;
  const perPeriod = Math.pow(2, 1 / n) - 1;
  const rets = Array(n).fill(perPeriod);
  const eq = [100];
  for (const r of rets) eq.push(eq[eq.length - 1] * (1 + r));

  const s = summarise(eq, rets, 252, 0);
  close(s.totalReturn, 100, 0.01);      // doubled
  close(s.cagr, 41.42, 0.05);           // sqrt(2)-1 per year
  close(s.years, 2, 0.01);
  close(s.maxDrawdown, 0, 1e-9);
  assert.equal(s.winRate, 100);
});

test('summarise reports drawdown and a negative total return for a losing curve', () => {
  const rets = [-0.02, -0.03, 0.01, -0.04];
  const eq = [100];
  for (const r of rets) eq.push(eq[eq.length - 1] * (1 + r));
  const s = summarise(eq, rets, 252, 0);
  assert.ok(s.totalReturn < 0);
  assert.ok(s.maxDrawdown > 0);
  assert.equal(s.winRate, 25);
});

test('summarise annualises Sharpe by the square root of periods per year', () => {
  const rets = normals(252, 0.0005, 0.01, 5);
  const eq = [100];
  for (const r of rets) eq.push(eq[eq.length - 1] * (1 + r));
  const s = summarise(eq, rets, 252, 0);
  close(s.sharpe, sharpe(rets, 0) * Math.sqrt(252), 0.01);
});

test('summarise returns null for an empty backtest', () => {
  assert.equal(summarise([], [], 252), null);
  assert.equal(summarise([100], [], 252), null);
});
