import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampCursor, sliceUpTo, stepCursor, replayProgress, atEnd } from '../charting/replay.js';

const candles = n => Array.from({ length: n }, (_, i) => ({ time: i, close: i }));

test('clampCursor keeps the cursor within [minStart, len-1]', () => {
  assert.equal(clampCursor(-5, 10), 0);
  assert.equal(clampCursor(100, 10), 9);
  assert.equal(clampCursor(4, 10), 4);
  assert.equal(clampCursor(1, 10, 3), 3);   // respects minStart
});

test('clampCursor handles an empty series', () => {
  assert.equal(clampCursor(5, 0), 0);
});

test('sliceUpTo returns candles inclusive of the cursor', () => {
  const c = candles(10);
  assert.equal(sliceUpTo(c, 0).length, 1);
  assert.equal(sliceUpTo(c, 4).length, 5);
  assert.equal(sliceUpTo(c, 9).length, 10);
  assert.equal(sliceUpTo(c, 100).length, 10); // clamped
});

test('sliceUpTo never leaks future bars', () => {
  const c = candles(20);
  const s = sliceUpTo(c, 7);
  assert.equal(s.at(-1).time, 7);
  assert.ok(s.every(x => x.time <= 7));
});

test('sliceUpTo is empty for no candles', () => {
  assert.deepEqual(sliceUpTo([], 3), []);
  assert.deepEqual(sliceUpTo(null, 3), []);
});

test('stepCursor advances and retreats within bounds', () => {
  assert.equal(stepCursor(5, 1, 10), 6);
  assert.equal(stepCursor(5, -1, 10), 4);
  assert.equal(stepCursor(9, 1, 10), 9);   // cannot pass the end
  assert.equal(stepCursor(0, -1, 10), 0);  // cannot pass the start
});

test('replayProgress runs 0 → 100 across the series', () => {
  assert.equal(replayProgress(0, 11), 0);
  assert.equal(replayProgress(10, 11), 100);
  assert.equal(replayProgress(5, 11), 50);
  assert.equal(replayProgress(3, 1), 100); // degenerate
});

test('atEnd is true only at the final bar', () => {
  assert.equal(atEnd(8, 10), false);
  assert.equal(atEnd(9, 10), true);
  assert.equal(atEnd(100, 10), true);
  assert.equal(atEnd(0, 0), true);
});
