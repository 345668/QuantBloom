import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annualizeAlpha, alphaSignal, buildAlphaEntry, rankByAlpha, TSTAT_GATE } from '../src/lib/residualAlpha.js';

test('annualizeAlpha scales a daily intercept to percent', () => {
  assert.equal(annualizeAlpha(0.0002), +(0.0002 * 252 * 100).toFixed(2)); // ~5.04
});

test('alphaSignal gates on |t| >= 2', () => {
  assert.equal(alphaSignal(2.5).direction, 'bullish');
  assert.equal(alphaSignal(2.5).significant, true);
  assert.equal(alphaSignal(-3).direction, 'bearish');
  assert.equal(alphaSignal(1.4).direction, 'neutral');
  assert.equal(alphaSignal(1.4).significant, false);
});

test('alphaSignal handles null/NaN t-stat', () => {
  assert.equal(alphaSignal(null).direction, 'neutral');
  assert.equal(alphaSignal(NaN).significant, false);
});

test('alphaSignal strength grows with |t| and saturates', () => {
  assert.ok(alphaSignal(2).strength < alphaSignal(4).strength);
  assert.equal(alphaSignal(100).strength, 1);
});

test('buildAlphaEntry summarises a fit', () => {
  const e = buildAlphaEntry('NVDA', { intercept: 0.0003, interceptT: 2.8, r2: 0.82, n: 500 });
  assert.equal(e.symbol, 'NVDA');
  assert.equal(e.direction, 'bullish');
  assert.equal(e.significant, true);
  assert.equal(e.alphaT, 2.8);
  assert.ok(e.alphaAnnual > 0);
});

test('buildAlphaEntry marks unavailable when no fit', () => {
  assert.equal(buildAlphaEntry('X', null).available, false);
});

test('rankByAlpha puts significant names first, by t-stat', () => {
  const ranked = rankByAlpha([
    buildAlphaEntry('A', { intercept: 0.0001, interceptT: 1.0, r2: 0.5, n: 300 }),  // not sig
    buildAlphaEntry('B', { intercept: 0.0004, interceptT: 3.5, r2: 0.6, n: 300 }),  // sig, high
    buildAlphaEntry('C', { intercept: 0.0002, interceptT: 2.2, r2: 0.6, n: 300 }),  // sig
  ]);
  assert.deepEqual(ranked.map(e => e.symbol), ['B', 'C', 'A']);
});

test('the gate constant is 2.0', () => {
  assert.equal(TSTAT_GATE, 2.0);
});
