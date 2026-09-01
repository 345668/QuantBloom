import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polarToXY, arcPath, returnColor, buildRings } from '../src/lib/sunburst.js';

test('polarToXY places 0deg at 12 o clock', () => {
  const p = polarToXY(0, 0, 10, 0);
  assert.ok(Math.abs(p.x) < 1e-9);
  assert.ok(Math.abs(p.y + 10) < 1e-9); // straight up = negative y
});

test('polarToXY 90deg goes to 3 o clock (clockwise)', () => {
  const p = polarToXY(0, 0, 10, 90);
  assert.ok(Math.abs(p.x - 10) < 1e-9);
  assert.ok(Math.abs(p.y) < 1e-9);
});

test('arcPath yields a closed SVG path', () => {
  const d = arcPath(50, 50, 10, 20, 0, 90);
  assert.match(d, /^M /);
  assert.match(d, /A /);
  assert.match(d, /Z$/);
});

test('returnColor is greenish for gains and reddish for losses', () => {
  const up = returnColor(3), down = returnColor(-3);
  const g = s => s.match(/rgb\((\d+),(\d+),(\d+)\)/).slice(1).map(Number);
  const [, ug] = g(up);   // green channel high on gains
  const [dr] = g(down);   // red channel high on losses
  assert.ok(ug > 150);
  assert.ok(dr > 150);
});

test('buildRings splits the circle proportionally to weight', () => {
  const groups = [
    { label: 'A', weight: 1, value: 1, children: [{ label: 'a1', weight: 1, value: 1 }] },
    { label: 'B', weight: 3, value: -1, children: [{ label: 'b1', weight: 1, value: -1 }] },
  ];
  const { inner, outer } = buildRings(groups, { cx: 100, cy: 100, r0: 10, r1: 20, r2: 30 });
  assert.equal(inner.length, 2);
  assert.equal(outer.length, 2);
  // A spans 90deg (1/4 of 360), B spans 270deg
  assert.ok(Math.abs((inner[0].end - inner[0].start) - 90) < 1e-9);
  assert.ok(Math.abs((inner[1].end - inner[1].start) - 270) < 1e-9);
  // last wedge ends at 360
  assert.ok(Math.abs(inner[1].end - 360) < 1e-9);
});
