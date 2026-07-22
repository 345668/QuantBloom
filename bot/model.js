// ---------------------------------------------------------------------------
// Model training and the model→strategy handoff.
//
// The only model that trains inside this Node/JS runtime is L2-regularised
// logistic regression (gradient descent). It is small, fast, fully testable,
// and — crucially — honest: on separable data it learns, on noise it does not.
//
// Heavier families (LightGBM, the ml4t-models latent-factor and portfolio
// networks) stay Python and train via the local pipeline documented in
// MODEL_TRAINING.md. Whatever produces the weights, the artifact shape below is
// the contract, and modelStrategy() is the equivalent of ml4t's
// `predictions_frame_from_asset_forecast` — it turns a trained model into a
// signal the SAME tested backtester and live engine consume.
// ---------------------------------------------------------------------------

import { featuresAt, FEATURE_NAMES } from './features.js';
import { predictProbaGBM } from './gbm.js';

const sigmoid = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

/** Column-wise standardisation; returns {means, stds} computed on TRAIN only. */
export function fitScaler(X) {
  const k = X[0].length, n = X.length;
  const means = new Array(k).fill(0), stds = new Array(k).fill(0);
  for (const row of X) for (let j = 0; j < k; j++) means[j] += row[j];
  for (let j = 0; j < k; j++) means[j] /= n;
  for (const row of X) for (let j = 0; j < k; j++) stds[j] += (row[j] - means[j]) ** 2;
  for (let j = 0; j < k; j++) stds[j] = Math.sqrt(stds[j] / n) || 1;
  return { means, stds };
}

const scaleRow = (row, s) => row.map((v, j) => (v - s.means[j]) / s.stds[j]);

/**
 * Train logistic regression by full-batch gradient descent.
 *
 * The scaler is fit on the training features and stored in the artifact, so
 * inference standardises with train-time statistics — using test statistics
 * would leak information.
 */
export function trainLogistic(X, y, opts = {}) {
  const { epochs = 400, lr = 0.1, l2 = 0.01, featureNames = FEATURE_NAMES } = opts;
  if (!X.length || X.length !== y.length) return null;

  const k = X[0].length, n = X.length;
  const scaler = fitScaler(X);
  const Xs = X.map(r => scaleRow(r, scaler));

  let w = new Array(k).fill(0), b = 0;
  const history = [];

  for (let e = 0; e < epochs; e++) {
    const gw = new Array(k).fill(0);
    let gb = 0, loss = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid(Xs[i].reduce((s, v, j) => s + v * w[j], b));
      const err = p - y[i];
      for (let j = 0; j < k; j++) gw[j] += err * Xs[i][j];
      gb += err;
      const eps = 1e-9;
      loss += -(y[i] * Math.log(p + eps) + (1 - y[i]) * Math.log(1 - p + eps));
    }
    for (let j = 0; j < k; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
    b -= lr * (gb / n);
    if (e % 50 === 0 || e === epochs - 1) history.push(+(loss / n).toFixed(5));
  }

  return {
    type: 'logistic',
    weights: w.map(v => +v.toFixed(6)),
    bias: +b.toFixed(6),
    scaler: {
      means: scaler.means.map(v => +v.toFixed(6)),
      stds: scaler.stds.map(v => +v.toFixed(6)),
    },
    featureNames,
    lossHistory: history,
    trainedOn: n,
  };
}

/**
 * Probability that the next move clears the up-barrier, for one feature row.
 * Dispatches on model type so every downstream consumer — evaluate(),
 * modelStrategy(), the backtest — works for any model family unchanged.
 */
export function predictProba(model, featureRow) {
  if (model.type === 'gbm') return predictProbaGBM(model, featureRow);
  const s = model.scaler;
  const z = featureRow.reduce((acc, v, j) => acc + ((v - s.means[j]) / s.stds[j]) * model.weights[j], model.bias);
  return sigmoid(z);
}

/** Classification metrics on a held-out set. */
export function evaluate(model, X, y) {
  if (!X.length) return null;
  let correct = 0, tp = 0, fp = 0, fn = 0, tn = 0;
  const probs = [];
  for (let i = 0; i < X.length; i++) {
    const p = predictProba(model, X[i]);
    probs.push(p);
    const pred = p >= 0.5 ? 1 : 0;
    if (pred === y[i]) correct++;
    if (pred === 1 && y[i] === 1) tp++;
    else if (pred === 1 && y[i] === 0) fp++;
    else if (pred === 0 && y[i] === 1) fn++;
    else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  // AUC via the Mann-Whitney statistic — threshold-independent, so it is not
  // fooled by an imbalanced class split the way raw accuracy is.
  const auc = rankAuc(probs, y);
  return {
    accuracy: +(correct / X.length).toFixed(4),
    precision: +precision.toFixed(4),
    recall: +recall.toFixed(4),
    f1: precision + recall ? +(2 * precision * recall / (precision + recall)).toFixed(4) : 0,
    auc: auc != null ? +auc.toFixed(4) : null,
    n: X.length,
    positiveRate: +(y.reduce((a, b) => a + b, 0) / y.length).toFixed(4),
  };
}

function rankAuc(scores, labels) {
  const pos = [], neg = [];
  scores.forEach((s, i) => (labels[i] === 1 ? pos : neg).push(s));
  if (!pos.length || !neg.length) return null;
  const idx = scores.map((s, i) => ({ s, y: labels[i] })).sort((a, b) => a.s - b.s);
  let rankSum = 0;
  idx.forEach((o, i) => { if (o.y === 1) rankSum += i + 1; });
  return (rankSum - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
}

/**
 * Adapt a trained model into a strategy signal.
 *
 * This is the handoff point: identical in shape to the rule-based strategies in
 * strategies.js, so a model plugs straight into ensemble(), the risk gate, the
 * backtester and the live engine with no special-casing. Confidence is the
 * model's distance from the decision boundary, so a marginal prediction sizes
 * small — the same discipline the rule strategies use.
 */
export function modelStrategy(model, candles, t, { buyThreshold = 0.55, sellThreshold = 0.45 } = {}) {
  const feat = featuresAt(candles, t);
  if (!feat) return { action: 'HOLD', confidence: 0, rationale: 'Insufficient history' };
  const p = predictProba(model, feat);
  if (p >= buyThreshold) return { action: 'BUY', confidence: +((p - 0.5) * 2).toFixed(3), rationale: `Model P(up)=${p.toFixed(2)}` };
  if (p <= sellThreshold) return { action: 'SELL', confidence: +((0.5 - p) * 2).toFixed(3), rationale: `Model P(up)=${p.toFixed(2)}` };
  return { action: 'HOLD', confidence: 0, rationale: `Model P(up)=${p.toFixed(2)} — near coin flip` };
}
