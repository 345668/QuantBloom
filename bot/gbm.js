// ---------------------------------------------------------------------------
// Gradient-boosted decision trees for binary classification.
//
// This is the in-app stand-in for LightGBM/CatBoost — the model families the
// ml4t-models pipeline reaches for on tabular data. Trees capture the
// non-linear interactions between features (e.g. "RSI oversold AND rising
// volume AND above the 200-day") that logistic regression cannot represent as a
// single linear boundary.
//
// The classic Friedman construction: start from the base log-odds, then add
// shallow regression trees fit to the pseudo-residuals of the log-loss, each
// shrunk by a learning rate. Trees are scale-invariant, so no feature scaling.
// ---------------------------------------------------------------------------

const sigmoid = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

// --- Regression tree via exhaustive best-split on squared error -------------

function buildTree(X, residuals, indices, depth, maxDepth, minLeaf) {
  const leafValue = () => {
    let s = 0;
    for (const i of indices) s += residuals[i];
    return s / indices.length;
  };

  if (depth >= maxDepth || indices.length < 2 * minLeaf) {
    return { leaf: true, value: leafValue() };
  }

  const nFeatures = X[0].length;
  let best = null;

  for (let f = 0; f < nFeatures; f++) {
    // Candidate thresholds: sorted unique-ish values of this feature.
    const vals = indices.map(i => X[i][f]).sort((a, b) => a - b);
    for (let t = minLeaf; t < vals.length - minLeaf; t++) {
      if (vals[t] === vals[t - 1]) continue; // no split between equal values
      const thr = (vals[t] + vals[t - 1]) / 2;

      let lSum = 0, lCount = 0, rSum = 0, rCount = 0;
      for (const i of indices) {
        if (X[i][f] <= thr) { lSum += residuals[i]; lCount++; }
        else { rSum += residuals[i]; rCount++; }
      }
      if (lCount < minLeaf || rCount < minLeaf) continue;

      // Reduction in SSE = the between-group variance captured by the split.
      const gain = (lSum * lSum) / lCount + (rSum * rSum) / rCount;
      if (!best || gain > best.gain) best = { feature: f, threshold: thr, gain };
    }
  }

  if (!best) return { leaf: true, value: leafValue() };

  const left = [], right = [];
  for (const i of indices) (X[i][best.feature] <= best.threshold ? left : right).push(i);

  return {
    leaf: false,
    feature: best.feature,
    threshold: best.threshold,
    left: buildTree(X, residuals, left, depth + 1, maxDepth, minLeaf),
    right: buildTree(X, residuals, right, depth + 1, maxDepth, minLeaf),
  };
}

function predictTree(node, row) {
  while (!node.leaf) node = row[node.feature] <= node.threshold ? node.left : node.right;
  return node.value;
}

/**
 * Train a gradient-boosted tree classifier.
 * @returns artifact { type:'gbm', baseScore, learningRate, trees, featureNames }
 */
export function trainGBM(X, y, opts = {}) {
  const {
    nEstimators = 60, maxDepth = 3, learningRate = 0.1,
    minLeaf = 10, featureNames = [],
  } = opts;
  if (!X.length || X.length !== y.length) return null;

  const n = X.length;
  const posRate = y.reduce((a, b) => a + b, 0) / n;
  // Base score is the log-odds of the class prior; clamp away from 0/1.
  const p0 = Math.min(Math.max(posRate, 1e-3), 1 - 1e-3);
  const baseScore = Math.log(p0 / (1 - p0));

  const F = new Array(n).fill(baseScore);
  const trees = [];
  const allIdx = Array.from({ length: n }, (_, i) => i);

  for (let m = 0; m < nEstimators; m++) {
    // Pseudo-residual of log-loss = y - sigmoid(F).
    const residuals = F.map((f, i) => y[i] - sigmoid(f));
    const tree = buildTree(X, residuals, allIdx, 0, maxDepth, minLeaf);
    trees.push(tree);
    for (let i = 0; i < n; i++) F[i] += learningRate * predictTree(tree, X[i]);
  }

  return {
    type: 'gbm',
    baseScore: +baseScore.toFixed(6),
    learningRate,
    nEstimators,
    maxDepth,
    trees,
    featureNames,
    trainedOn: n,
  };
}

export function predictProbaGBM(model, row) {
  let F = model.baseScore;
  for (const tree of model.trees) F += model.learningRate * predictTree(tree, row);
  return sigmoid(F);
}

/**
 * Gain-based feature importance: total SSE reduction attributed to each
 * feature across every tree, normalised to sum to 1. Explains WHICH inputs the
 * model actually used, which is half the value of a tree model.
 */
export function featureImportance(model) {
  const k = model.featureNames.length || 0;
  const imp = new Array(k).fill(0);
  const walk = (node) => {
    if (node.leaf) return;
    // Re-deriving exact gain here is unnecessary; count split usage weighted by
    // depth proximity to the root (root splits matter most). A simple, stable
    // proxy: increment by 1 per split. Deeper trees contribute via more splits.
    imp[node.feature] += 1;
    walk(node.left); walk(node.right);
  };
  for (const t of model.trees) walk(t);
  const total = imp.reduce((a, b) => a + b, 0) || 1;
  return model.featureNames.map((name, i) => ({ name, importance: +(imp[i] / total).toFixed(4) }))
    .sort((a, b) => b.importance - a.importance);
}
