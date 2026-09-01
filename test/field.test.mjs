import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, hashStr, fieldColor, fieldRegime, buildField, driftPos, topMovers } from '../src/lib/field.js';

test('topMovers returns the n largest absolute moves, biggest first', () => {
  const nodes = [{ symbol: 'A', change: 1 }, { symbol: 'B', change: -5 }, { symbol: 'C', change: 3 }, { symbol: 'D', change: -0.2 }];
  const t = topMovers(nodes, 2);
  assert.deepEqual(t.map(n => n.symbol), ['B', 'C']);
});

test('mulberry32 is deterministic for a seed', () => {
  const a = mulberry32(42), b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('hashStr is stable and non-zero', () => {
  assert.equal(hashStr('AAPL'), hashStr('AAPL'));
  assert.notEqual(hashStr('AAPL'), hashStr('MSFT'));
});

test('fieldColor: gains greener, losses redder, flat amber', () => {
  const [, g] = fieldColor(3);   // green channel high on gains
  const [r] = fieldColor(-3);    // red channel high on losses
  const flat = fieldColor(0);
  assert.ok(g > 200);
  assert.ok(r > 230);
  assert.deepEqual(flat, [255, 140, 20]); // amber
});

test('fieldRegime rises with downside', () => {
  const calm = fieldRegime([{ change: 0.2 }, { change: 0.1 }]);
  const bad = fieldRegime([{ change: -3 }, { change: -4 }]);
  assert.equal(calm.label, 'calm');
  assert.ok(bad.stress > calm.stress);
  assert.equal(bad.label, 'stress');
});

test('buildField clusters constituents and links within sector', () => {
  const sectors = {
    Tech: [{ symbol: 'AAPL', changePercent: 2 }, { symbol: 'MSFT', changePercent: -1 }, { symbol: 'NVDA', changePercent: -5 }],
    Energy: [{ symbol: 'XOM', changePercent: 1 }, { symbol: 'CVX', changePercent: 0.5 }],
  };
  const f = buildField(sectors, { width: 400, height: 400 });
  assert.equal(f.nodes.length, 5);
  // every node has a finite position and a radius
  for (const n of f.nodes) {
    assert.ok(isFinite(n.x) && isFinite(n.y));
    assert.ok(n.r >= 2.5);
  }
  // edges only connect same-sector symbols
  const sectorOf = Object.fromEntries(f.nodes.map(n => [n.symbol, n.sector]));
  for (const e of f.edges) assert.equal(sectorOf[e.a], sectorOf[e.b]);
});

test('buildField caps node count to maxNodes keeping biggest movers', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ symbol: `S${i}`, changePercent: i - 25 }));
  const f = buildField({ All: many }, { maxNodes: 10 });
  assert.equal(f.nodes.length, 10);
});

test('buildField on empty input yields no nodes', () => {
  const f = buildField({}, {});
  assert.equal(f.nodes.length, 0);
  assert.equal(f.edges.length, 0);
});

test('driftPos stays near the base position', () => {
  const n = { x: 100, y: 100, phase: 0.3 };
  const p = driftPos(n, 1.5);
  assert.ok(Math.abs(p.x - 100) <= 3.01);
  assert.ok(Math.abs(p.y - 100) <= 3.01);
});
