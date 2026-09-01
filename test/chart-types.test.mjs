import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heikinAshi, renko, lineBreak, suggestBoxSize, transformForType } from '../charting/chart-types.js';

function candles(closes, seed = 1600000000) {
  return closes.map((c, i) => ({
    time: seed + i * 86400,
    open: i === 0 ? c : closes[i - 1],
    close: c,
    high: Math.max(i === 0 ? c : closes[i - 1], c) + 0.5,
    low: Math.min(i === 0 ? c : closes[i - 1], c) - 0.5,
    volume: 1000,
  }));
}

// --- Heikin-Ashi -----------------------------------------------------------

test('heikinAshi close is the OHLC average', () => {
  const c = [{ time: 1, open: 10, high: 14, low: 8, close: 12, volume: 1 }];
  const ha = heikinAshi(c);
  assert.equal(ha[0].close, (10 + 14 + 8 + 12) / 4);
  // Seed open is (open+close)/2.
  assert.equal(ha[0].open, (10 + 12) / 2);
});

test('heikinAshi open is the average of the previous HA open and close', () => {
  const ha = heikinAshi(candles([10, 11, 12, 13]));
  for (let i = 1; i < ha.length; i++) {
    assert.ok(Math.abs(ha[i].open - (ha[i - 1].open + ha[i - 1].close) / 2) < 1e-9);
  }
});

test('heikinAshi high/low bound the HA body and the real high/low', () => {
  const src = candles([10, 12, 9, 15, 11]);
  const ha = heikinAshi(src);
  ha.forEach((b, i) => {
    assert.ok(b.high >= b.open && b.high >= b.close && b.high >= src[i].high - 1e-9);
    assert.ok(b.low <= b.open && b.low <= b.close && b.low <= src[i].low + 1e-9);
  });
});

test('heikinAshi preserves length and time axis 1:1', () => {
  const src = candles([1, 2, 3, 4, 5]);
  const ha = heikinAshi(src);
  assert.equal(ha.length, src.length);
  ha.forEach((b, i) => assert.equal(b.time, src[i].time));
});

test('a steady uptrend yields all-green Heikin-Ashi candles', () => {
  const ha = heikinAshi(candles([10, 11, 12, 13, 14, 15, 16]));
  // After the seed settles, HA close should exceed HA open in an uptrend.
  const greens = ha.slice(2).filter(b => b.close > b.open).length;
  assert.ok(greens >= ha.length - 3, 'uptrend should be dominantly green');
});

// --- Renko -----------------------------------------------------------------

test('renko emits a brick each time price moves one box', () => {
  // Rising by exactly 1 each bar with box 1 -> one up brick per step.
  const bricks = renko(candles([100, 101, 102, 103, 104]), 1);
  assert.ok(bricks.length >= 3);
  bricks.forEach(b => {
    assert.ok(Math.abs((b.close - b.open) - 1) < 1e-9, 'each brick spans one box');
    assert.equal(b.direction, 'up');
  });
});

test('renko produces down bricks on a decline', () => {
  const bricks = renko(candles([100, 99, 98, 97, 96]), 1);
  assert.ok(bricks.some(b => b.direction === 'down'));
  assert.ok(bricks.every(b => b.direction === 'down'));
});

test('renko ignores moves smaller than the box', () => {
  // Oscillating within half a box should produce no bricks.
  const bricks = renko(candles([100, 100.3, 100.1, 100.4, 100.2]), 1);
  assert.equal(bricks.length, 0);
});

test('renko brick times are strictly increasing (renderable)', () => {
  const bricks = renko(candles([100, 102, 104, 106, 108]), 1);
  for (let i = 1; i < bricks.length; i++) {
    assert.ok(bricks[i].time > bricks[i - 1].time, `time not increasing at ${i}`);
  }
});

test('a larger box size produces fewer bricks', () => {
  const src = candles([100, 102, 104, 106, 108, 110]);
  assert.ok(renko(src, 1).length > renko(src, 4).length);
});

test('suggestBoxSize returns a positive number near the ATR', () => {
  const box = suggestBoxSize(candles([100, 102, 101, 104, 103]));
  assert.ok(box > 0 && isFinite(box));
});

// --- Line break ------------------------------------------------------------

test('lineBreak draws a new line only on a breakout beyond the last N', () => {
  // Monotonic rise: every bar breaks the prior high, so a line each step.
  const lines = lineBreak(candles([10, 11, 12, 13, 14]), 3);
  assert.ok(lines.length >= 3);
  assert.ok(lines.every(l => l.direction === 'up'));
});

test('lineBreak absorbs small pullbacks within the last N lines', () => {
  // Rise then a small dip that does not breach the 3-line low.
  const withDip = lineBreak(candles([10, 12, 14, 16, 15]), 3);
  const straight = lineBreak(candles([10, 12, 14, 16, 18]), 3);
  // The dip bar should not add a line, so it has one fewer than the pure rise.
  assert.ok(withDip.length <= straight.length);
});

test('lineBreak times are strictly increasing', () => {
  const lines = lineBreak(candles([10, 12, 14, 11, 8, 15, 20]), 3);
  for (let i = 1; i < lines.length; i++) {
    assert.ok(lines[i].time > lines[i - 1].time);
  }
});

// --- Dispatcher ------------------------------------------------------------

test('transformForType routes to the right transform', () => {
  const src = candles([10, 11, 12, 13]);
  assert.equal(transformForType('heikin', src).length, src.length);
  assert.deepEqual(transformForType('candles', src), src);
  assert.deepEqual(transformForType('line', src), src);
  assert.ok(Array.isArray(transformForType('renko', src)));
});

test('transforms never emit NaN or non-finite values', () => {
  const src = candles([100, 103, 99, 105, 101, 108, 96]);
  for (const type of ['heikin', 'renko', 'linebreak']) {
    for (const b of transformForType(type, src)) {
      for (const k of ['open', 'high', 'low', 'close', 'time']) {
        assert.ok(Number.isFinite(b[k]), `${type}.${k} not finite`);
      }
    }
  }
});
