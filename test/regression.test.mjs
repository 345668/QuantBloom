import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ols, invert, matMul, transpose, pValue } from '../regression.js';

const close = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

test('invert recovers the identity: M * M^-1 = I', () => {
  const M = [[4, 7, 2], [3, 6, 1], [2, 5, 3]];
  const Minv = invert(M);
  const I = matMul(M, Minv);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) close(I[i][j], i === j ? 1 : 0, 1e-9);
  }
});

test('invert matches a known 2x2 inverse', () => {
  // [[4,7],[2,6]] has det 10 -> inverse [[0.6,-0.7],[-0.2,0.4]]
  const Minv = invert([[4, 7], [2, 6]]);
  close(Minv[0][0], 0.6, 1e-9);
  close(Minv[0][1], -0.7, 1e-9);
  close(Minv[1][0], -0.2, 1e-9);
  close(Minv[1][1], 0.4, 1e-9);
});

test('invert returns null for a singular matrix', () => {
  // Second row is 2x the first — rank deficient.
  assert.equal(invert([[1, 2], [2, 4]]), null);
});

test('invert handles a matrix needing a pivot swap', () => {
  // Leading zero forces partial pivoting.
  const M = [[0, 1], [1, 0]];
  const Minv = invert(M);
  close(Minv[0][0], 0, 1e-9);
  close(Minv[0][1], 1, 1e-9);
  close(Minv[1][0], 1, 1e-9);
});

test('transpose flips dimensions', () => {
  assert.deepEqual(transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]]);
});

test('ols recovers an exact linear relationship', () => {
  // y = 3 + 2*x1 - 1*x2, noise free.
  const X = [[1, 1], [2, 1], [3, 2], [4, 3], [5, 5], [6, 2], [7, 4]];
  const y = X.map(([a, b]) => 3 + 2 * a - 1 * b);
  const r = ols(X, y);
  close(r.intercept, 3, 1e-8);
  close(r.coefficients[0], 2, 1e-8);
  close(r.coefficients[1], -1, 1e-8);
  close(r.r2, 1, 1e-9);
});

test('ols simple regression matches the closed-form slope', () => {
  // For a single predictor, slope = cov(x,y)/var(x).
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ys = [2, 4, 5, 4, 5, 7, 8, 9, 9, 12];
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varx = 0;
  for (let i = 0; i < n; i++) { cov += (xs[i] - mx) * (ys[i] - my); varx += (xs[i] - mx) ** 2; }
  const slope = cov / varx;

  const r = ols(xs.map(v => [v]), ys);
  close(r.coefficients[0], slope, 1e-9);
  close(r.intercept, my - slope * mx, 1e-9);
});

test('ols R-squared equals the squared correlation in simple regression', () => {
  const xs = [1, 3, 2, 5, 4, 7, 6, 9, 8, 11];
  const ys = [2, 5, 4, 8, 7, 11, 10, 14, 13, 18];
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) { cov += (xs[i]-mx)*(ys[i]-my); vx += (xs[i]-mx)**2; vy += (ys[i]-my)**2; }
  const corr = cov / Math.sqrt(vx * vy);

  const r = ols(xs.map(v => [v]), ys);
  close(r.r2, corr * corr, 1e-9);
});

test('ols residuals are orthogonal to predictors and sum to zero', () => {
  const X = [[1, 4], [2, 3], [3, 7], [4, 1], [5, 9], [6, 2], [7, 8], [8, 5]];
  const y = [5, 6, 9, 7, 13, 9, 15, 12];
  const r = ols(X, y);

  // Sum of residuals ~ 0 when an intercept is present.
  close(r.residuals.reduce((a, b) => a + b, 0), 0, 1e-8);
  // Each predictor is uncorrelated with the residuals.
  for (let j = 0; j < 2; j++) {
    const dot = r.residuals.reduce((s, e, i) => s + e * X[i][j], 0);
    close(dot, 0, 1e-8);
  }
});

test('ols adjusted R-squared does not exceed R-squared', () => {
  const X = [[1, 2], [2, 1], [3, 5], [4, 3], [5, 8], [6, 4], [7, 9], [8, 6], [9, 11], [10, 7]];
  const y = [3, 4, 8, 7, 12, 9, 15, 12, 18, 14];
  const r = ols(X, y);
  assert.ok(r.adjR2 <= r.r2, 'adjusted R2 should be <= R2');
  assert.ok(r.r2 >= 0 && r.r2 <= 1, 'R2 in [0,1]');
});

test('ols returns null when under-determined', () => {
  // 3 observations, 2 predictors + intercept leaves no residual dof.
  assert.equal(ols([[1, 2], [2, 3], [3, 4]], [1, 2, 3]), null);
});

test('ols returns null for perfectly collinear predictors', () => {
  // x2 = 2*x1 makes X'X singular.
  const X = [[1, 2], [2, 4], [3, 6], [4, 8], [5, 10], [6, 12]];
  assert.equal(ols(X, [1, 2, 3, 4, 5, 6]), null);
});

test('a strong relationship produces a large t-statistic', () => {
  const X = Array.from({ length: 60 }, (_, i) => [i]);
  const y = X.map(([x]) => 5 + 3 * x + (x % 3) * 0.1); // tiny structured noise
  const r = ols(X, y);
  assert.ok(Math.abs(r.tStats[0]) > 10, `expected large |t|, got ${r.tStats[0]}`);
});

test('pValue matches known normal two-sided values', () => {
  close(pValue(1.96, 500), 0.05, 2e-3);
  close(pValue(2.576, 500), 0.01, 2e-3);
  close(pValue(0, 500), 1, 1e-6);
});

test('pValue declines to guess with too few degrees of freedom', () => {
  assert.equal(pValue(2.0, 10), null);
});
