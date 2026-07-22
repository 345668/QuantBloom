import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOrder, checkHaltConditions, DEFAULT_LIMITS, REJECT } from '../bot/risk-gate.js';

// A healthy account with room to trade.
const baseState = (over = {}) => ({
  enabled: true, halted: false, marketOpen: true,
  equity: 100000, dailyPnlPercent: 0, drawdownPercent: 0,
  ordersToday: 0, positions: {}, ...over,
});

const buy = (over = {}) => ({ symbol: 'AAPL', side: 'buy', qty: 10, price: 200, ...over });

test('approves a normal buy inside every limit', () => {
  const r = evaluateOrder(buy(), baseState());
  assert.equal(r.approved, true);
  assert.equal(r.adjustedQty, 10);
});

// --- Kill conditions -------------------------------------------------------

test('rejects every order when the bot is switched off', () => {
  const r = evaluateOrder(buy(), baseState({ enabled: false }));
  assert.equal(r.approved, false);
  assert.equal(r.reason, REJECT.BOT_OFF);
});

test('off switch beats an otherwise perfect order', () => {
  // Nothing about the order matters if the switch is off.
  const r = evaluateOrder(buy({ qty: 1, price: 100 }), baseState({ enabled: false }));
  assert.equal(r.approved, false);
});

test('rejects when halted', () => {
  const r = evaluateOrder(buy(), baseState({ halted: true, haltReason: 'manual' }));
  assert.equal(r.reason, REJECT.HALTED);
});

test('rejects at the daily loss limit', () => {
  const r = evaluateOrder(buy(), baseState({ dailyPnlPercent: -2 }));
  assert.equal(r.reason, REJECT.DAILY_LOSS);
});

test('rejects beyond the daily loss limit', () => {
  const r = evaluateOrder(buy(), baseState({ dailyPnlPercent: -7.5 }));
  assert.equal(r.reason, REJECT.DAILY_LOSS);
});

test('allows trading just inside the daily loss limit', () => {
  assert.equal(evaluateOrder(buy(), baseState({ dailyPnlPercent: -1.9 })).approved, true);
});

test('rejects at the max drawdown', () => {
  const r = evaluateOrder(buy(), baseState({ drawdownPercent: 10 }));
  assert.equal(r.reason, REJECT.DRAWDOWN);
});

test('rejects once the daily order count is reached', () => {
  const r = evaluateOrder(buy(), baseState({ ordersToday: 20 }));
  assert.equal(r.reason, REJECT.ORDER_COUNT);
});

test('rejects when the market is closed', () => {
  const r = evaluateOrder(buy(), baseState({ marketOpen: false }));
  assert.equal(r.reason, REJECT.MARKET_CLOSED);
});

test('allows a closed-market order only when explicitly permitted', () => {
  const r = evaluateOrder(buy({ allowExtendedHours: true }), baseState({ marketOpen: false }));
  assert.equal(r.approved, true);
});

// --- Position sizing -------------------------------------------------------

test('clamps a buy that would breach the 5% position limit', () => {
  // 50 x $200 = $10,000 = 10% of equity; limit allows $5,000 = 25 shares.
  const r = evaluateOrder(buy({ qty: 50 }), baseState());
  assert.equal(r.approved, true);
  assert.equal(r.adjustedQty, 25);
  assert.ok(r.warnings.some(w => w.includes('position limit')));
});

test('accounts for an existing position when sizing', () => {
  const state = baseState({ positions: { AAPL: { qty: 20, marketValue: 4000 } } });
  // $4,000 held, cap is $5,000, so only $1,000 = 5 shares more.
  const r = evaluateOrder(buy({ qty: 25 }), state);
  assert.equal(r.adjustedQty, 5);
});

test('rejects when the position is already at the cap', () => {
  const state = baseState({ positions: { AAPL: { qty: 25, marketValue: 5000 } } });
  const r = evaluateOrder(buy({ qty: 10 }), state);
  assert.equal(r.approved, false);
  assert.equal(r.reason, REJECT.POSITION_SIZE);
});

// --- Concentration and exposure -------------------------------------------

test('clamps for sector concentration', () => {
  const state = baseState({
    positions: {
      MSFT: { qty: 100, marketValue: 20000, sector: 'Information Technology' },
    },
  });
  // Sector at $20k of a $25k cap -> $5k room, but the 5% position cap binds first.
  const r = evaluateOrder(buy({ qty: 100, sector: 'Information Technology' }), state);
  assert.equal(r.approved, true);
  assert.ok(r.adjustedQty <= 25);
});

test('rejects when the sector is already at its cap', () => {
  const state = baseState({
    positions: { MSFT: { qty: 125, marketValue: 25000, sector: 'Information Technology' } },
  });
  const r = evaluateOrder(buy({ qty: 10, sector: 'Information Technology' }), state);
  assert.equal(r.approved, false);
  assert.equal(r.reason, REJECT.SECTOR);
});

test('rejects when gross exposure is fully used', () => {
  const state = baseState({
    positions: Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [`S${i}`, { qty: 20, marketValue: 4000 }])
    ),
  });
  // 25 x $4,000 = $100,000 = 100% gross.
  const r = evaluateOrder(buy({ qty: 10 }), state);
  assert.equal(r.approved, false);
  assert.equal(r.reason, REJECT.GROSS_EXPOSURE);
});

test('no default leverage: gross exposure cap is 100%', () => {
  assert.equal(DEFAULT_LIMITS.maxGrossExposurePercent, 100);
});

// --- Liquidity and dust ----------------------------------------------------

test('clamps an order that is too large versus average volume', () => {
  // ADV 1,000 -> 1% = 10 shares.
  const r = evaluateOrder(buy({ qty: 20, price: 10, avgDailyVolume: 1000 }), baseState());
  assert.equal(r.adjustedQty, 10);
  assert.ok(r.warnings.some(w => w.includes('ADV')));
});

test('rejects dust orders', () => {
  const r = evaluateOrder(buy({ qty: 1, price: 10 }), baseState());
  assert.equal(r.approved, false);
  assert.equal(r.reason, REJECT.DUST);
});

test('rejects an order that shrinks to dust after clamping', () => {
  // ADV forces qty to 1 share at $10 = $10, below the $50 minimum.
  const r = evaluateOrder(buy({ qty: 50, price: 10, avgDailyVolume: 100 }), baseState());
  assert.equal(r.approved, false);
  assert.equal(r.reason, REJECT.DUST);
});

// --- Sells -----------------------------------------------------------------

test('rejects selling something not held', () => {
  const r = evaluateOrder(buy({ side: 'sell' }), baseState());
  assert.equal(r.approved, false);
  assert.equal(r.reason, REJECT.NO_SHARES);
});

test('clamps a sell to the held quantity rather than going short', () => {
  const state = baseState({ positions: { AAPL: { qty: 7, marketValue: 1400 } } });
  const r = evaluateOrder(buy({ side: 'sell', qty: 100 }), state);
  assert.equal(r.approved, true);
  assert.equal(r.adjustedQty, 7);
});

test('a sell is exempt from the dust minimum so positions can always be closed', () => {
  const state = baseState({ positions: { AAPL: { qty: 1, marketValue: 5 } } });
  const r = evaluateOrder(buy({ side: 'sell', qty: 1, price: 5 }), state);
  assert.equal(r.approved, true);
});

// --- Input validation ------------------------------------------------------

test('rejects malformed orders', () => {
  const s = baseState();
  for (const bad of [
    {}, { symbol: 'AAPL' }, buy({ side: 'short' }),
    buy({ qty: 0 }), buy({ qty: -5 }), buy({ price: 0 }),
    buy({ price: NaN }), buy({ qty: 'abc' }),
  ]) {
    assert.equal(evaluateOrder(bad, s).approved, false, `should reject ${JSON.stringify(bad)}`);
  }
});

test('rejects when account equity is nonsense', () => {
  assert.equal(evaluateOrder(buy(), baseState({ equity: 0 })).approved, false);
  assert.equal(evaluateOrder(buy(), baseState({ equity: NaN })).approved, false);
});

test('never returns an approval with a non-positive quantity', () => {
  const cases = [
    [buy({ qty: 50 }), baseState()],
    [buy({ qty: 100, avgDailyVolume: 5000 }), baseState()],
    [buy({ side: 'sell', qty: 3 }), baseState({ positions: { AAPL: { qty: 3, marketValue: 600 } } })],
  ];
  for (const [o, s] of cases) {
    const r = evaluateOrder(o, s);
    if (r.approved) assert.ok(r.adjustedQty > 0, 'approved order must have positive qty');
  }
});

// --- Halt conditions -------------------------------------------------------

test('halts on the daily loss limit without requiring a manual restart', () => {
  const h = checkHaltConditions(baseState({ dailyPnlPercent: -2.5 }));
  assert.equal(h.halt, true);
  assert.equal(h.requiresManualRestart, false);
});

test('drawdown halt requires a manual restart', () => {
  const h = checkHaltConditions(baseState({ drawdownPercent: 12 }));
  assert.equal(h.halt, true);
  assert.equal(h.requiresManualRestart, true);
});

test('no halt for a healthy account', () => {
  assert.equal(checkHaltConditions(baseState()).halt, false);
});
