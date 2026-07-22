import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainGBM, predictProbaGBM, featureImportance } from '../bot/gbm.js';
import { trainLogistic, predictProba } from '../bot/model.js';

// mulberry32 — a high-quality PRNG with no serial correlation between
// consecutive outputs. A plain LCG must NOT be used here: its outputs are
// serially correlated, and a GBM is powerful enough to learn that structure,
// which would make "random noise" secretly predictable and break the tests.
function rng(seed = 5) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('GBM learns linearly separable data', () => {
  const r = rng(1), X = [], y = [];
  for (let i = 0; i < 300; i++) {
    const a = r() * 2 - 1, b = r() * 2 - 1;
    X.push([a, b]); y.push(a + b > 0 ? 1 : 0);
  }
  const m = trainGBM(X, y, { nEstimators: 50, maxDepth: 3, featureNames: ['a', 'b'] });
  let correct = 0;
  for (let i = 0; i < X.length; i++) if ((predictProbaGBM(m, X[i]) >= 0.5 ? 1 : 0) === y[i]) correct++;
  assert.ok(correct / X.length > 0.9, `acc ${correct / X.length}`);
});

test('GBM learns XOR, which logistic regression cannot', () => {
  // XOR: label 1 when exactly one of two features is positive. No linear
  // boundary separates it — this is the whole reason to use trees.
  const r = rng(7), X = [], y = [];
  for (let i = 0; i < 600; i++) {
    const a = r() * 2 - 1, b = r() * 2 - 1;
    X.push([a, b]); y.push((a > 0) !== (b > 0) ? 1 : 0);
  }
  const gbm = trainGBM(X, y, { nEstimators: 80, maxDepth: 3, featureNames: ['a', 'b'] });
  const lr = trainLogistic(X, y, { epochs: 400, featureNames: ['a', 'b'] });

  const acc = (predictFn) => {
    let c = 0;
    for (let i = 0; i < X.length; i++) if ((predictFn(X[i]) >= 0.5 ? 1 : 0) === y[i]) c++;
    return c / X.length;
  };
  const gbmAcc = acc(x => predictProbaGBM(gbm, x));
  const lrAcc = acc(x => predictProba(lr, x));

  assert.ok(gbmAcc > 0.85, `GBM should crack XOR, got ${gbmAcc}`);
  assert.ok(lrAcc < 0.65, `logistic should fail XOR (near 0.5), got ${lrAcc}`);
  assert.ok(gbmAcc - lrAcc > 0.2, 'GBM must clearly beat logistic on XOR');
});

test('GBM does not learn pure noise out of sample', () => {
  // Features and labels drawn from INDEPENDENT streams, so a label can never be
  // a function of the features. Judge with AUC, which is threshold-independent
  // and immune to class imbalance.
  const fx = rng(11), ly = rng(999);
  const X = [], y = [];
  for (let i = 0; i < 500; i++) { X.push([fx(), fx(), fx()]); y.push(ly() > 0.5 ? 1 : 0); }
  const m = trainGBM(X, y, { nEstimators: 40, maxDepth: 3 });

  const Xt = [], yt = [];
  for (let i = 0; i < 500; i++) { Xt.push([fx(), fx(), fx()]); yt.push(ly() > 0.5 ? 1 : 0); }
  const probs = Xt.map(x => predictProbaGBM(m, x));
  const pos = [], neg = [];
  probs.forEach((p, i) => (yt[i] === 1 ? pos : neg).push(p));
  const idx = probs.map((p, i) => ({ p, y: yt[i] })).sort((a, b) => a.p - b.p);
  let rank = 0; idx.forEach((o, i) => { if (o.y === 1) rank += i + 1; });
  const auc = (rank - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
  assert.ok(auc > 0.4 && auc < 0.6, `noise OOS AUC should be ~0.5, got ${auc.toFixed(3)}`);
});

test('predictProbaGBM is bounded in [0,1]', () => {
  const m = trainGBM([[0], [1], [2], [3]], [0, 0, 1, 1], { nEstimators: 20, minLeaf: 1 });
  for (const x of [[-100], [1.5], [100]]) {
    const p = predictProbaGBM(m, x);
    assert.ok(p >= 0 && p <= 1, `p ${p}`);
  }
});

test('deeper trees fit a step function the base rate cannot', () => {
  const X = [], y = [];
  for (let i = 0; i < 200; i++) { const x = i / 200; X.push([x]); y.push(x > 0.7 ? 1 : 0); }
  const m = trainGBM(X, y, { nEstimators: 40, maxDepth: 2, minLeaf: 5 });
  assert.ok(predictProbaGBM(m, [0.9]) > predictProbaGBM(m, [0.3]),
    'model should rank a point above the step higher');
});

test('featureImportance identifies the informative feature', () => {
  // Only feature 0 carries signal; features 1 and 2 are noise.
  const r = rng(3), X = [], y = [];
  for (let i = 0; i < 400; i++) {
    const a = r() * 2 - 1;
    X.push([a, r(), r()]); y.push(a > 0 ? 1 : 0);
  }
  const m = trainGBM(X, y, { nEstimators: 40, maxDepth: 2, featureNames: ['signal', 'noise1', 'noise2'] });
  const imp = featureImportance(m);
  assert.equal(imp[0].name, 'signal', `top feature was ${imp[0].name}`);
  assert.ok(imp[0].importance > 0.4);
});

test('trainGBM validates its inputs', () => {
  assert.equal(trainGBM([], []), null);
  assert.equal(trainGBM([[1]], [0, 1]), null);
});

test('GBM handles a constant feature without splitting on it', () => {
  const r = rng(2), X = [], y = [];
  for (let i = 0; i < 200; i++) { const a = r() * 2 - 1; X.push([a, 5]); y.push(a > 0 ? 1 : 0); }
  const m = trainGBM(X, y, { nEstimators: 30, maxDepth: 2, featureNames: ['a', 'const'] });
  const imp = featureImportance(m);
  const constImp = imp.find(f => f.name === 'const');
  assert.equal(constImp.importance, 0, 'a constant feature carries no information');
});
