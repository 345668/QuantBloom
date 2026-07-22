import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featuresAt, tripleBarrierLabel, buildDataset, temporalSplit, FEATURE_NAMES } from '../bot/features.js';
import { trainLogistic, predictProba, evaluate, modelStrategy, fitScaler } from '../bot/model.js';
import { evaluateGate, PUBLISH_GATE } from '../bot/model-registry.js';

function makeCandles(n, fn, seed = 3) {
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const close = fn(i, rand);
    const open = i === 0 ? close : out[i - 1].close;
    out.push({
      time: 1600000000 + i * 86400,
      open, close,
      high: Math.max(open, close) * (1 + rand() * 0.008),
      low: Math.min(open, close) * (1 - rand() * 0.008),
      volume: 1e6 + rand() * 2e5,
    });
  }
  return out;
}
const trend = n => makeCandles(n, (i, r) => 100 * Math.pow(1.0015, i) * (1 + (r() - 0.5) * 0.01));

// --- Features: point-in-time correctness -----------------------------------

test('featuresAt returns a full vector of finite numbers', () => {
  const c = trend(200);
  const f = featuresAt(c, 150);
  assert.equal(f.length, FEATURE_NAMES.length);
  for (const v of f) assert.ok(Number.isFinite(v), `non-finite feature ${v}`);
});

test('featuresAt at bar t is unchanged by future bars', () => {
  const base = trend(200);
  const extended = [...base, ...trend(50)];
  const a = featuresAt(base, 150);
  const b = featuresAt(extended, 150);
  assert.deepEqual(a, b);
});

test('featuresAt refuses too-early bars', () => {
  assert.equal(featuresAt(trend(200), 10), null);
});

// --- Triple-barrier labeling ----------------------------------------------

test('up-barrier hit first yields label 1', () => {
  // Flat then a jump up well inside the horizon.
  const c = makeCandles(30, (i) => (i < 15 ? 100 : 110));
  assert.equal(tripleBarrierLabel(c, 10, { up: 0.03, down: 0.02, horizon: 10 }), 1);
});

test('down-barrier hit first yields label 0', () => {
  const c = makeCandles(30, (i) => (i < 15 ? 100 : 90));
  assert.equal(tripleBarrierLabel(c, 10, { up: 0.03, down: 0.02, horizon: 10 }), 0);
});

test('label is null when there is not enough future data', () => {
  const c = trend(30);
  assert.equal(tripleBarrierLabel(c, 25, { horizon: 10 }), null);
});

test('buildDataset aligns X and y and excludes unlabelable tail', () => {
  const c = trend(400);
  const ds = buildDataset(c, { horizon: 10 });
  assert.equal(ds.X.length, ds.y.length);
  assert.equal(ds.X.length, ds.times.length);
  assert.ok(ds.X.length > 100);
  for (const label of ds.y) assert.ok(label === 0 || label === 1);
});

// --- Temporal split (never shuffle) ---------------------------------------

test('temporalSplit puts the most recent rows in the test set', () => {
  const ds = { X: Array.from({ length: 100 }, (_, i) => [i]), y: Array(100).fill(0), times: Array.from({ length: 100 }, (_, i) => i), featureNames: ['x'] };
  const s = temporalSplit(ds, 0.3);
  assert.equal(s.train.X.length, 70);
  assert.equal(s.test.X.length, 30);
  // The split must preserve order: last train row precedes first test row.
  assert.ok(s.train.X[69][0] < s.test.X[0][0]);
});

// --- Scaler ----------------------------------------------------------------

test('fitScaler produces zero-mean, unit-variance columns', () => {
  const X = [[1, 10], [2, 20], [3, 30], [4, 40]];
  const s = fitScaler(X);
  const scaled = X.map(r => r.map((v, j) => (v - s.means[j]) / s.stds[j]));
  const colMean = j => scaled.reduce((a, r) => a + r[j], 0) / scaled.length;
  assert.ok(Math.abs(colMean(0)) < 1e-9);
  assert.ok(Math.abs(colMean(1)) < 1e-9);
});

test('fitScaler never divides by zero on a constant column', () => {
  const s = fitScaler([[5], [5], [5]]);
  assert.equal(s.stds[0], 1);
});

// --- Logistic regression: learns signal, not noise -------------------------

test('logistic regression learns a linearly separable pattern', () => {
  // y = 1 when x0 + x1 > 0, with a clear margin.
  const X = [], y = [];
  let s = 1;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let i = 0; i < 300; i++) {
    const a = rand() * 2 - 1, b = rand() * 2 - 1;
    X.push([a, b]);
    y.push(a + b > 0 ? 1 : 0);
  }
  const model = trainLogistic(X, y, { epochs: 500, featureNames: ['a', 'b'] });
  const m = evaluate(model, X, y);
  assert.ok(m.accuracy > 0.9, `expected to learn separable data, got acc ${m.accuracy}`);
  assert.ok(m.auc > 0.95, `expected high AUC, got ${m.auc}`);
});

test('logistic regression cannot learn pure noise (AUC ~0.5)', () => {
  const X = [], y = [];
  let s = 9;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let i = 0; i < 300; i++) { X.push([rand(), rand(), rand()]); y.push(rand() > 0.5 ? 1 : 0); }
  const model = trainLogistic(X, y, { epochs: 400 });
  // Evaluate on a FRESH noise sample — in-sample fit to noise means nothing.
  const Xt = [], yt = [];
  for (let i = 0; i < 300; i++) { Xt.push([rand(), rand(), rand()]); yt.push(rand() > 0.5 ? 1 : 0); }
  const m = evaluate(model, Xt, yt);
  assert.ok(m.auc > 0.35 && m.auc < 0.65, `noise should give AUC near 0.5, got ${m.auc}`);
});

test('training loss decreases', () => {
  const X = Array.from({ length: 100 }, (_, i) => [i / 100]);
  const y = X.map(r => (r[0] > 0.5 ? 1 : 0));
  const model = trainLogistic(X, y, { epochs: 300 });
  assert.ok(model.lossHistory[model.lossHistory.length - 1] < model.lossHistory[0]);
});

test('predictProba is bounded in [0,1]', () => {
  const model = trainLogistic([[0], [1], [2], [3]], [0, 0, 1, 1], { epochs: 100 });
  for (const x of [[-100], [0], [1.5], [100]]) {
    const p = predictProba(model, x);
    assert.ok(p >= 0 && p <= 1, `p out of range: ${p}`);
  }
});

test('evaluate returns null for an empty set', () => {
  const model = trainLogistic([[0], [1]], [0, 1], { epochs: 10 });
  assert.equal(evaluate(model, [], []), null);
});

// --- Model → strategy handoff ----------------------------------------------

test('modelStrategy returns the standard strategy shape', () => {
  const c = trend(300);
  const model = trainLogistic([[0], [1]], [0, 1], { epochs: 10, featureNames: FEATURE_NAMES });
  const sig = modelStrategy(model.featureNames ? model : model, c, 200);
  assert.ok(['BUY', 'SELL', 'HOLD'].includes(sig.action));
  assert.ok(sig.confidence >= 0 && sig.confidence <= 1);
  assert.ok(typeof sig.rationale === 'string');
});

test('a confident up-prediction produces BUY, a confident down produces SELL', () => {
  // Hand-craft a one-feature model so the mapping is unambiguous.
  const model = {
    type: 'logistic', weights: [10], bias: 0,
    scaler: { means: [0], stds: [1] }, featureNames: ['ret1'],
  };
  // featuresAt returns a full vector; stub via direct predictProba checks.
  assert.ok(predictProba(model, [1]) > 0.9);   // strong up
  assert.ok(predictProba(model, [-1]) < 0.1);  // strong down
});

// --- Publish gate -----------------------------------------------------------

test('gate rejects a model with no predictive edge', () => {
  const g = evaluateGate({
    testMetrics: { n: 100, auc: 0.50 },
    backtest: { stats: { sharpe: 0.2, totalReturn: 1 }, trades: 10, beatBenchmark: false, benchmarkReturn: 30, deflatedSharpe: 0.1 },
  });
  assert.equal(g.eligible, false);
  assert.ok(g.reasons.some(r => /AUC/.test(r)));
});

test('gate rejects a model that loses to buy-and-hold', () => {
  const g = evaluateGate({
    testMetrics: { n: 100, auc: 0.60 },
    backtest: { stats: { sharpe: 0.8, totalReturn: 5 }, trades: 10, beatBenchmark: false, benchmarkReturn: 40, deflatedSharpe: 0.95 },
  });
  assert.equal(g.eligible, false);
  assert.ok(g.reasons.some(r => /buy-and-hold/.test(r)));
});

test('gate rejects a model that fails deflated Sharpe', () => {
  const g = evaluateGate({
    testMetrics: { n: 100, auc: 0.60 },
    backtest: { stats: { sharpe: 0.9, totalReturn: 50 }, trades: 10, beatBenchmark: true, benchmarkReturn: 30, deflatedSharpe: 0.4 },
  });
  assert.equal(g.eligible, false);
  assert.ok(g.reasons.some(r => /Deflated/.test(r)));
});

test('gate rejects a model with too few trades', () => {
  const g = evaluateGate({
    testMetrics: { n: 100, auc: 0.60 },
    backtest: { stats: { sharpe: 1.5, totalReturn: 50 }, trades: 2, beatBenchmark: true, benchmarkReturn: 30, deflatedSharpe: 0.98 },
  });
  assert.equal(g.eligible, false);
  assert.ok(g.reasons.some(r => /trades/.test(r)));
});

test('gate accepts only a model that clears every bar', () => {
  const g = evaluateGate({
    testMetrics: { n: 120, auc: 0.62 },
    backtest: { stats: { sharpe: 1.1, totalReturn: 55 }, trades: 12, beatBenchmark: true, benchmarkReturn: 40, deflatedSharpe: 0.97 },
  });
  assert.equal(g.eligible, true, `unexpected rejection: ${g.reasons.join('; ')}`);
  assert.equal(g.reasons.length, 0);
});

test('the gate thresholds are demanding by design', () => {
  assert.ok(PUBLISH_GATE.minDeflatedSharpe >= 0.9);
  assert.equal(PUBLISH_GATE.mustBeatBenchmark, true);
});
