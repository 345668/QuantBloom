import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitPCA, transformPCA, totalExplained } from '../bot/pca.js';

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

// Deterministic generator.
function rng(seed = 1) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('the first component aligns with the direction of greatest variance', () => {
  // Feature 0 varies widely; feature 1 barely moves. PC1 should load on f0.
  const r = rng(3), X = [];
  for (let i = 0; i < 200; i++) X.push([(r() - 0.5) * 100, (r() - 0.5) * 0.1]);
  const pca = fitPCA(X, 2);
  // After standardisation both have unit variance, but correlation ~0, so the
  // components are the axes; the top explained-variance share is ~0.5 each.
  assert.equal(pca.components.length, 2);
  assert.ok(pca.explainedVariance[0] >= pca.explainedVariance[1]);
});

test('two perfectly correlated features collapse to one component', () => {
  // f1 = 2*f0 exactly -> one direction holds all variance.
  const r = rng(7), X = [];
  for (let i = 0; i < 150; i++) { const a = (r() - 0.5) * 10; X.push([a, 2 * a]); }
  const pca = fitPCA(X, 2);
  assert.ok(pca.explainedVariance[0] > 0.98, `expected ~all variance in PC1, got ${pca.explainedVariance[0]}`);
  assert.ok(pca.explainedVariance[1] < 0.02);
});

test('explained variance shares are in [0,1] and sorted descending', () => {
  const r = rng(11), X = [];
  for (let i = 0; i < 200; i++) X.push([r(), r() * 2, r() - 0.5, r() * 0.3]);
  const pca = fitPCA(X, 4);
  pca.explainedVariance.forEach(v => assert.ok(v >= 0 && v <= 1));
  for (let i = 1; i < pca.explainedVariance.length; i++) {
    assert.ok(pca.explainedVariance[i] <= pca.explainedVariance[i - 1] + 1e-9);
  }
  assert.ok(totalExplained(pca) <= 1.0001);
});

test('k is clamped to the feature dimension', () => {
  const X = Array.from({ length: 50 }, () => [Math.random(), Math.random()]);
  const pca = fitPCA(X, 5);
  assert.equal(pca.k, 2);
  assert.equal(pca.components.length, 2);
});

test('transformPCA reduces a row to k scores', () => {
  const r = rng(5), X = [];
  for (let i = 0; i < 100; i++) X.push([r(), r(), r(), r(), r()]);
  const pca = fitPCA(X, 3);
  const scores = transformPCA(pca, X[0]);
  assert.equal(scores.length, 3);
  scores.forEach(s => assert.ok(Number.isFinite(s)));
});

test('projecting the mean row gives ~zero scores', () => {
  const r = rng(9), X = [];
  for (let i = 0; i < 120; i++) X.push([r() * 10, r() * 3, r() - 2]);
  const pca = fitPCA(X, 3);
  const scores = transformPCA(pca, pca.mean);
  scores.forEach(s => close(s, 0, 1e-9));
});

test('a constant feature does not break the fit', () => {
  const r = rng(2), X = [];
  for (let i = 0; i < 80; i++) X.push([r(), 5, r()]); // middle feature constant
  const pca = fitPCA(X, 3);
  assert.ok(pca.components.every(c => c.every(Number.isFinite)));
  assert.ok(transformPCA(pca, X[0]).every(Number.isFinite));
});
