import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  covariance, portfolioVariance, minVariancePortfolio,
  tangencyPortfolio, efficientFrontier,
} from '../portfolio-math.js';

const close = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

const sumsToOne = (w) => close(w.reduce((a, b) => a + b, 0), 1, 1e-9);

test('covariance diagonal equals sample variance', () => {
  const x = [1, 2, 3, 4, 5];
  const C = covariance([x]);
  const m = 3;
  const expected = x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1);
  close(C[0][0], expected, 1e-12);
});

test('covariance is symmetric', () => {
  const C = covariance([[1, 2, 3, 4, 5], [2, 1, 4, 3, 6], [5, 3, 2, 6, 1]]);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) close(C[i][j], C[j][i], 1e-12);
  }
});

test('covariance of identical series equals its variance everywhere', () => {
  const x = [0.01, -0.02, 0.03, 0.005, -0.01];
  const C = covariance([x, x]);
  close(C[0][1], C[0][0], 1e-12);
});

test('portfolioVariance matches the two-asset closed form', () => {
  // Var = w1²σ1² + w2²σ2² + 2w1w2σ12
  const cov = [[0.04, 0.006], [0.006, 0.09]];
  const w = [0.6, 0.4];
  const expected = 0.36 * 0.04 + 0.16 * 0.09 + 2 * 0.6 * 0.4 * 0.006;
  close(portfolioVariance(w, cov), expected, 1e-12);
});

test('minVariance of uncorrelated assets weights inversely to variance', () => {
  // With zero correlation, w_i proportional to 1/σ_i².
  const cov = [[0.04, 0], [0, 0.01]];
  const w = minVariancePortfolio(cov);
  sumsToOne(w);
  // 1/0.04 = 25, 1/0.01 = 100 -> 0.2 / 0.8
  close(w[0], 0.2, 1e-9);
  close(w[1], 0.8, 1e-9);
});

test('minVariance of identical assets splits evenly', () => {
  const cov = [[0.04, 0.01], [0.01, 0.04]];
  const w = minVariancePortfolio(cov);
  sumsToOne(w);
  close(w[0], 0.5, 1e-9);
  close(w[1], 0.5, 1e-9);
});

test('minVariance really is the minimum: perturbing it raises variance', () => {
  const cov = [[0.04, 0.006, 0.002], [0.006, 0.09, 0.004], [0.002, 0.004, 0.0225]];
  const w = minVariancePortfolio(cov);
  const base = portfolioVariance(w, cov);

  // Any weight-preserving perturbation must increase variance.
  for (const eps of [0.01, -0.01, 0.05]) {
    const p = [...w];
    p[0] += eps; p[1] -= eps;
    assert.ok(portfolioVariance(p, cov) > base,
      `perturbation eps=${eps} did not increase variance`);
  }
});

test('minVariance returns null for a singular covariance matrix', () => {
  // Perfectly correlated assets with proportional rows.
  assert.equal(minVariancePortfolio([[0.04, 0.08], [0.08, 0.16]]), null);
});

test('tangency portfolio maximises Sharpe against nearby portfolios', () => {
  const cov = [[0.04, 0.006], [0.006, 0.09]];
  const mu = [0.10, 0.14];
  const rf = 0.03;
  const w = tangencyPortfolio(cov, mu, rf);
  sumsToOne(w);

  const sharpe = (weights) => {
    const r = weights.reduce((s, v, i) => s + v * mu[i], 0);
    return (r - rf) / Math.sqrt(portfolioVariance(weights, cov));
  };
  const best = sharpe(w);
  for (const eps of [0.02, -0.02, 0.08, -0.08]) {
    const p = [w[0] + eps, w[1] - eps];
    assert.ok(sharpe(p) <= best + 1e-9,
      `perturbation eps=${eps} beat the tangency Sharpe`);
  }
});

test('tangency tilts toward the better risk-adjusted asset', () => {
  // Same variance, asset 2 has the higher expected return.
  const cov = [[0.04, 0], [0, 0.04]];
  const w = tangencyPortfolio(cov, [0.08, 0.16], 0.02);
  assert.ok(w[1] > w[0], 'expected a larger weight on the higher-return asset');
});

test('efficient frontier is monotonic: higher risk pairs with higher return', () => {
  const cov = [[0.04, 0.006, 0.002], [0.006, 0.09, 0.004], [0.002, 0.004, 0.0225]];
  const mu = [0.08, 0.13, 0.10];
  const fr = efficientFrontier(cov, mu, 0.03, 20);
  assert.ok(fr.points.length > 5);

  // Above the minimum-variance point, return must rise with risk.
  const minIdx = fr.points.reduce((bi, p, i, a) => (p.risk < a[bi].risk ? i : bi), 0);
  for (let i = minIdx + 1; i < fr.points.length; i++) {
    assert.ok(fr.points[i].return >= fr.points[i - 1].return - 1e-9,
      `return fell as risk rose at index ${i}`);
  }
});

test('every frontier portfolio has weights summing to one', () => {
  const cov = [[0.04, 0.006], [0.006, 0.09]];
  const fr = efficientFrontier(cov, [0.09, 0.13], 0.03, 10);
  for (const p of fr.points) sumsToOne(p.weights);
});

test('no frontier portfolio has lower risk than the minimum-variance one', () => {
  const cov = [[0.05, 0.01, 0.004], [0.01, 0.07, 0.002], [0.004, 0.002, 0.03]];
  const mu = [0.07, 0.11, 0.09];
  const fr = efficientFrontier(cov, mu, 0.025, 30);
  const minRisk = Math.sqrt(portfolioVariance(fr.minVariance, cov));
  for (const p of fr.points) {
    assert.ok(p.risk >= minRisk - 1e-9,
      `found risk ${p.risk} below the minimum-variance ${minRisk}`);
  }
});
