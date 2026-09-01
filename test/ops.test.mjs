import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sparklinePath, sparklineArea, hexagonPoints, hexagonOutline, heatBuckets, riskAxes, ledgerRows } from '../src/lib/ops.js';

test('sparklineArea closes back to the baseline', () => {
  const a = sparklineArea([1, 2, 3], 120, 34);
  assert.match(a, /^M /);
  assert.match(a, /Z$/);        // closed path
  assert.ok(a.includes('L 2.0 32.0'));  // returns to baseline (h-pad)
});

test('sparklineArea is empty for <2 points', () => {
  assert.equal(sparklineArea([5], 120, 34), '');
});

test('sparklinePath starts with M and has one point per value', () => {
  const d = sparklinePath([1, 2, 3, 2], 100, 20);
  assert.match(d, /^M /);
  assert.equal((d.match(/[ML]/g) || []).length, 4);
});

test('sparklinePath is empty for <2 points', () => {
  assert.equal(sparklinePath([1], 100, 20), '');
  assert.equal(sparklinePath([], 100, 20), '');
});

test('hexagonPoints yields 6 vertices', () => {
  const pts = hexagonPoints(50, 50, 40, [1, 0.5, 0.2, 0, 0.8, 1]);
  assert.equal(pts.split(' ').length, 6);
});

test('hexagonPoints pads missing axes with 0', () => {
  const pts = hexagonPoints(50, 50, 40, [1]);
  assert.equal(pts.split(' ').length, 6);
});

test('hexagonOutline is the full-scale hexagon', () => {
  const o = hexagonOutline(0, 0, 10);
  // top vertex is straight up
  const [, y0] = o.split(' ')[0].split(',').map(Number);
  assert.ok(Math.abs(y0 + 10) < 1e-6);
});

test('heatBuckets counts by symbol and hour, ranks by activity', () => {
  const now = new Date();
  const iso = h => new Date(now.getFullYear(), 0, 1, h).toISOString();
  const decisions = [
    { symbol: 'AAPL', at: iso(9) }, { symbol: 'AAPL', at: iso(9) }, { symbol: 'AAPL', at: iso(10) },
    { symbol: 'MSFT', at: iso(9) },
  ];
  const b = heatBuckets(decisions);
  assert.equal(b.symbols[0], 'AAPL');       // most active first
  assert.equal(b.grid.AAPL[9], 2);
  assert.equal(b.max, 2);
});

test('riskAxes returns six axes clamped to 0..1', () => {
  const axes = riskAxes({ drawdownPercent: 5, limits: { maxDrawdownPercent: 10 }, halted: true });
  assert.equal(axes.length, 6);
  for (const a of axes) assert.ok(a.v >= 0 && a.v <= 1);
  assert.equal(axes.find(a => a.label === 'HALT').v, 1);
  assert.ok(Math.abs(axes.find(a => a.label === 'DD').v - 0.5) < 1e-9);
});

test('ledgerRows reflects account + state', () => {
  const rows = ledgerRows({ account: { equity: 120000, cash: 50000, dailyPnlPercent: 1.2 }, positions: [{}, {}], enabled: false });
  const by = Object.fromEntries(rows.map(r => [r.label, r.value]));
  assert.equal(by.positions, '2');
  assert.equal(by.state, 'IDLE');
  assert.match(by.equity, /\$120,000/);
});
