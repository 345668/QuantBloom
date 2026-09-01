import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainEnsemble, predictProba, evaluate } from '../bot/model.js';

function rng(seed = 5) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// A learnable dataset with enough features for the PCA member.
function dataset(n, seed) {
  const r = rng(seed), X = [], y = [];
  for (let i = 0; i < n; i++) {
    const row = Array.from({ length: 8 }, () => r() * 2 - 1);
    // Signal: sign of a weighted sum of the first three features.
    const s = row[0] * 1.5 + row[1] - row[2] * 0.8;
    y.push(s > 0 ? 1 : 0);
    X.push(row);
  }
  return { X, y };
}

test('ensemble trains all three member families', () => {
  const { X, y } = dataset(300, 1);
  const m = trainEnsemble(X, y, { featureNames: X[0].map((_, i) => `f${i}`) });
  assert.equal(m.type, 'ensemble');
  assert.deepEqual(m.memberTypes.sort(), ['gbm', 'logistic', 'pca']);
});

test('ensemble probabilities are the mean of the members and stay in [0,1]', () => {
  const { X, y } = dataset(300, 2);
  const m = trainEnsemble(X, y, { featureNames: X[0].map((_, i) => `f${i}`) });
  const row = X[0];
  const members = m.members.map(mem => predictProba(mem, row));
  const mean = members.reduce((a, b) => a + b, 0) / members.length;
  const p = predictProba(m, row);
  assert.ok(Math.abs(p - mean) < 1e-9);
  assert.ok(p >= 0 && p <= 1);
});

test('ensemble learns a learnable signal (AUC well above 0.5)', () => {
  const { X, y } = dataset(400, 3);
  const m = trainEnsemble(X, y, { featureNames: X[0].map((_, i) => `f${i}`) });
  const ev = evaluate(m, X, y);
  assert.ok(ev.auc > 0.8, `expected the ensemble to learn, got AUC ${ev.auc}`);
});

test('ensemble is at least as robust as its weakest member on the signal', () => {
  const { X, y } = dataset(400, 4);
  const m = trainEnsemble(X, y, { featureNames: X[0].map((_, i) => `f${i}`) });
  const ensembleAuc = evaluate(m, X, y).auc;
  const memberAucs = m.members.map(mem => evaluate(mem, X, y).auc);
  // The blend should not be worse than the worst member — the point of averaging.
  assert.ok(ensembleAuc >= Math.min(...memberAucs) - 1e-6);
});

test('trainEnsemble validates its inputs', () => {
  assert.equal(trainEnsemble([], []), null);
  assert.equal(trainEnsemble([[1, 2]], [0, 1]), null);
});
