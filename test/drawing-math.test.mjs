import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  measure, positionRR, fibRetracementLevels, fibExtensionLevels, barsBetween,
  FIB_RETRACEMENT, FIB_EXTENSION,
} from '../charting/drawing-math.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

// --- Measure ---------------------------------------------------------------

test('measure reports price and percent change with sign', () => {
  const m = measure({ time: 100, price: 100 }, { time: 200, price: 110 });
  close(m.deltaPrice, 10);
  close(m.deltaPercent, 10);
  assert.equal(m.up, true);
  assert.equal(m.deltaTimeSeconds, 100);
});

test('measure handles a decline', () => {
  const m = measure({ time: 100, price: 50 }, { time: 80, price: 40 });
  close(m.deltaPrice, -10);
  close(m.deltaPercent, -20);
  assert.equal(m.up, false);
  assert.equal(m.deltaTimeSeconds, 20); // absolute
});

// --- Position R:R ----------------------------------------------------------

test('positionRR computes a long trade risk/reward', () => {
  const p = positionRR(100, 110, 95);
  assert.equal(p.direction, 'long');
  close(p.reward, 10);
  close(p.risk, 5);
  close(p.rr, 2);       // 10 reward / 5 risk
  close(p.rewardPct, 10);
  close(p.riskPct, 5);
});

test('positionRR computes a short trade', () => {
  const p = positionRR(100, 90, 104);
  assert.equal(p.direction, 'short');
  close(p.reward, 10);
  close(p.risk, 4);
  close(p.rr, 2.5);
});

test('positionRR guards a zero-risk position', () => {
  assert.equal(positionRR(100, 110, 100).rr, null);
});

// --- Fibonacci -------------------------------------------------------------

test('retracement 0 is the high, 1 is the low, 0.5 is the midpoint', () => {
  const levels = fibRetracementLevels(120, 100);
  const at = l => levels.find(x => x.level === l).price;
  close(at(0), 120);
  close(at(1), 100);
  close(at(0.5), 110);
  close(at(0.618), 120 - 20 * 0.618);
});

test('retracement is orientation-independent (hi/lo derived, not order)', () => {
  const up = fibRetracementLevels(100, 120);
  const down = fibRetracementLevels(120, 100);
  up.forEach((p, i) => close(p.price, down[i].price));
});

test('extension projects the A-B leg from C', () => {
  // A=100, B=110 (a +10 leg), C=105. Level 1 -> 115, level 0 -> 105.
  const ext = fibExtensionLevels(100, 110, 105);
  const at = l => ext.find(x => x.level === l).price;
  close(at(0), 105);
  close(at(1), 115);
  close(at(1.618), 105 + 10 * 1.618);
});

test('extension works for a down leg', () => {
  const ext = fibExtensionLevels(110, 100, 105); // -10 leg from C=105
  close(ext.find(x => x.level === 1).price, 95);
});

test('the fib level tables are the standard sets', () => {
  assert.deepEqual(FIB_RETRACEMENT, [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
  assert.ok(FIB_EXTENSION.includes(1.618) && FIB_EXTENSION.includes(2.618));
});

// --- Bars between ----------------------------------------------------------

test('barsBetween counts candles within the time span, inclusive', () => {
  const candles = [0, 1, 2, 3, 4, 5].map(i => ({ time: i * 100 }));
  assert.equal(barsBetween(candles, 100, 400), 4); // times 100,200,300,400
  assert.equal(barsBetween(candles, 400, 100), 4); // order-independent
  assert.equal(barsBetween(candles, 0, 0), 1);
});
