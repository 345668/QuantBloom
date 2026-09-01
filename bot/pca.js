// ---------------------------------------------------------------------------
// Principal Component Analysis — dimensionality reduction for the latent-factor
// model. This is the tractable, in-app stand-in for the ml4t-models
// latent-factor family (PCA/RPPCA/IPCA/CAE): standardise the features, take the
// eigenvectors of their covariance, and project onto the top-k directions that
// carry the most variance. Those k components are the "latent factors" a
// downstream classifier then predicts from.
//
// Pure (no model imports) so it can be reused without circular dependencies.
// ---------------------------------------------------------------------------

import { jacobiEigen } from './eigen.js';
import { covariance } from '../portfolio-math.js';

/**
 * Fit PCA on a feature matrix X (n rows × d features).
 * @returns {{mean, std, components, explainedVariance, k}} where components[c]
 *   is the c-th unit eigenvector (a length-d loading vector), strongest first.
 */
export function fitPCA(X, k) {
  const n = X.length, d = X[0].length;
  const kk = Math.min(k, d);

  // Standardise each feature so PCA is not dominated by scale.
  const mean = new Array(d).fill(0), std = new Array(d).fill(0);
  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j];
  for (let j = 0; j < d; j++) mean[j] /= n;
  for (const row of X) for (let j = 0; j < d; j++) std[j] += (row[j] - mean[j]) ** 2;
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / n) || 1;

  const Z = X.map(row => row.map((v, j) => (v - mean[j]) / std[j]));
  // covariance() expects one series per variable, so pass the columns.
  const cols = Array.from({ length: d }, (_, j) => Z.map(r => r[j]));
  const cov = covariance(cols);

  const { values, vectors } = jacobiEigen(cov);
  const totalVar = values.reduce((s, v) => s + Math.max(v, 0), 0) || 1;

  return {
    mean, std,
    components: vectors.slice(0, kk),
    explainedVariance: values.slice(0, kk).map(v => +(Math.max(v, 0) / totalVar).toFixed(4)),
    k: kk,
  };
}

/** Project one raw feature row onto the principal components → k factor scores. */
export function transformPCA(pca, row) {
  const z = row.map((v, j) => (v - pca.mean[j]) / pca.std[j]);
  return pca.components.map(comp => comp.reduce((s, w, j) => s + w * z[j], 0));
}

/** Cumulative variance explained by the retained components. */
export function totalExplained(pca) {
  return +(pca.explainedVariance.reduce((a, b) => a + b, 0)).toFixed(4);
}
