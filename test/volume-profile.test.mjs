import { test } from 'node:test';
import assert from 'node:assert/strict';
import { volumeProfile, valueArea, swingLevels, supportResistance } from '../charting/volume-profile.js';

function bar(low, high, volume, time = 1) {
  return { time, open: low, close: high, low, high, volume };
}

// --- Volume profile --------------------------------------------------------

test('single-price bars land entirely in one bucket', () => {
  // All volume at price 10 -> one bucket carries it all.
  const vp = volumeProfile([bar(10, 10, 100), bar(10, 10, 50), bar(20, 20, 30)], 10);
  const busy = vp.buckets.filter(b => b.volume > 0);
  assert.equal(busy.length, 2);
  assert.equal(vp.total, 180);
});

test('POC is the busiest price bucket', () => {
  const vp = volumeProfile([bar(10, 10, 500), bar(50, 50, 100), bar(90, 90, 50)], 20);
  assert.ok(vp.poc.low <= 10 && vp.poc.high >= 10, 'POC should sit at price 10');
  assert.equal(vp.pocIndex >= 0, true);
});

test('bucket volumes sum to the total (conservation)', () => {
  const candles = [bar(10, 14, 100), bar(12, 18, 200), bar(9, 11, 50), bar(15, 20, 80)];
  const vp = volumeProfile(candles, 12);
  const sum = vp.buckets.reduce((s, b) => s + b.volume, 0);
  assert.ok(Math.abs(sum - vp.total) < 1e-6);
  assert.ok(Math.abs(vp.total - (100 + 200 + 50 + 80)) < 1e-6);
});

test('volume spread across a range hits multiple buckets', () => {
  // One wide bar should distribute across several buckets.
  const vp = volumeProfile([bar(0, 100, 1000)], 10);
  const nonEmpty = vp.buckets.filter(b => b.volume > 0).length;
  assert.ok(nonEmpty >= 8, `expected wide spread, got ${nonEmpty}`);
});

test('volumeProfile returns null when there is no price range to bucket', () => {
  assert.equal(volumeProfile([], 10), null);
  // A single flat-price bar has zero range, so no profile can be built.
  assert.equal(volumeProfile([bar(10, 10, 100)], 10), null);
  // But any spread of prices works.
  assert.ok(volumeProfile([bar(10, 10, 100), bar(20, 20, 50)], 10) !== null);
});

// --- Value area ------------------------------------------------------------

test('value area covers at least the target share and contains the POC', () => {
  const candles = [
    bar(10, 10, 50), bar(11, 11, 100), bar(12, 12, 400), // POC ~12
    bar(13, 13, 120), bar(14, 14, 60), bar(9, 9, 40),
  ];
  const vp = volumeProfile(candles, 20);
  const va = vp.valueArea;
  assert.ok(va.volume >= vp.total * 0.7 - 1e-6, 'VA should reach 70%');
  assert.ok(va.lowIndex <= vp.pocIndex && vp.pocIndex <= va.highIndex, 'POC inside VA');
  assert.ok(va.low <= vp.poc.mid && vp.poc.mid <= va.high);
});

test('a very high pct forces the value area to the full range', () => {
  const candles = [bar(10, 10, 100), bar(20, 20, 100), bar(30, 30, 100)];
  const vp = volumeProfile(candles, 30);
  const va = valueArea(vp.buckets, vp.pocIndex, vp.total, 0.99);
  assert.equal(va.lowIndex, 0);
  assert.equal(va.highIndex, vp.buckets.length - 1);
});

// --- Swing levels ----------------------------------------------------------

test('swingLevels finds an obvious peak and trough', () => {
  // A single peak at index 3, trough at index 7.
  const prices = [10, 11, 12, 20, 12, 11, 10, 2, 10, 11, 12];
  const candles = prices.map((p, i) => bar(p - 0.5, p + 0.5, 100, i));
  const { highs, lows } = swingLevels(candles, 2);
  assert.ok(highs.some(h => Math.abs(h.price - 20.5) < 1e-9), 'should catch the peak');
  assert.ok(lows.some(l => Math.abs(l.price - 1.5) < 1e-9), 'should catch the trough');
});

test('swingLevels ignores the un-flanked edges', () => {
  const candles = [10, 20, 10].map((p, i) => bar(p - 0.5, p + 0.5, 100, i));
  // lookback 2 leaves no interior bar, so no swings.
  const { highs, lows } = swingLevels(candles, 2);
  assert.equal(highs.length, 0);
  assert.equal(lows.length, 0);
});

// --- Support / resistance clustering --------------------------------------

test('supportResistance merges nearby swings and ranks by touch count', () => {
  // Repeated peaks near 20 should cluster into one strong level.
  const prices = [10, 20, 10, 20.1, 10, 19.9, 10, 5, 10, 5.1, 10];
  const candles = prices.map((p, i) => bar(p - 0.2, p + 0.2, 100, i));
  const levels = supportResistance(candles, 1, 0.02, 6);
  assert.ok(levels.length >= 1);
  // The strongest cluster should be the most-touched, near 20.
  assert.ok(levels[0].count >= 2, 'strongest level should have multiple touches');
});
