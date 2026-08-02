import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundTick, computeBracket, bracketRR, trailingStop, updateTrailingStop } from '../bot/brackets.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('roundTick uses 2dp above $1 and 4dp below', () => {
  assert.equal(roundTick(123.456), 123.46);
  assert.equal(roundTick(0.123456), 0.1235);
});

test('computeBracket places stop below and target above entry', () => {
  const b = computeBracket(100, 0.05, 0.10);
  assert.equal(b.stopLoss, 95);
  assert.equal(b.takeProfit, 110);
  assert.equal(b.valid, true);
});

test('computeBracket allows a stop-only or target-only bracket', () => {
  assert.equal(computeBracket(100, 0.05, null).takeProfit, null);
  assert.equal(computeBracket(100, 0.05, null).stopLoss, 95);
  assert.equal(computeBracket(100, null, 0.10).stopLoss, null);
  assert.equal(computeBracket(100, null, 0.10).takeProfit, 110);
});

test('computeBracket rejects an invalid entry', () => {
  assert.equal(computeBracket(0, 0.05, 0.1).valid, false);
  assert.equal(computeBracket(-5, 0.05, 0.1).valid, false);
});

test('computeBracket rejects out-of-range percentages', () => {
  assert.equal(computeBracket(100, 1.5, 0.1).valid, false);   // stop >= 100%
  assert.equal(computeBracket(100, -0.1, 0.1).valid, false);  // negative stop
  assert.equal(computeBracket(100, 0.05, -0.1).valid, false); // negative target
});

test('a tiny stop that rounds onto the entry is rejected', () => {
  // 0.001% of a $1 stock rounds to the entry at 4dp.
  const b = computeBracket(1.0, 0.00001, null);
  assert.equal(b.valid, false);
  assert.match(b.reason, /at or above entry/);
});

test('bracketRR is the target/stop ratio', () => {
  close(bracketRR(0.05, 0.10), 2);
  close(bracketRR(0.02, 0.05), 2.5);
  assert.equal(bracketRR(0, 0.1), null);
});

test('trailingStop sits below the high-water mark and ratchets with it', () => {
  assert.equal(trailingStop(100, 0.05), 95);
  assert.equal(trailingStop(120, 0.05), 114); // moved up with a new high
  assert.equal(trailingStop(0, 0.05), null);
  assert.equal(trailingStop(100, 0), null);
});

test('updateTrailingStop ratchets the mark up and never breaches while rising', () => {
  let s = updateTrailingStop(null, 100, 0.05);
  assert.equal(s.hwm, 100); assert.equal(s.stop, 95); assert.equal(s.breached, false);
  s = updateTrailingStop(s.hwm, 110, 0.05);
  assert.equal(s.hwm, 110); assert.equal(s.stop, 104.5); assert.equal(s.breached, false);
  s = updateTrailingStop(s.hwm, 108, 0.05); // small pullback, still above stop
  assert.equal(s.hwm, 110); // mark holds
  assert.equal(s.breached, false);
});

test('updateTrailingStop breaches when price falls the trail distance from the peak', () => {
  // Peak 110, 5% trail -> stop 104.5. A drop to 104 breaches.
  let s = updateTrailingStop(110, 110, 0.05);
  s = updateTrailingStop(s.hwm, 104, 0.05);
  assert.equal(s.breached, true);
  assert.equal(s.stop, 104.5);
});

test('updateTrailingStop seeds the mark from the first price', () => {
  const s = updateTrailingStop(undefined, 50, 0.1);
  assert.equal(s.hwm, 50);
  assert.equal(s.stop, 45);
});
