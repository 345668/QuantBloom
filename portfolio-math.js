// ---------------------------------------------------------------------------
// Mean-variance portfolio mathematics.
//
// Closed-form Markowitz. Two-fund separation says every portfolio on the
// efficient frontier is a linear combination of the global minimum-variance
// portfolio and the tangency (max-Sharpe) portfolio, so we solve those two
// analytically and trace the frontier between and beyond them. That avoids an
// iterative optimiser entirely.
//
// These solutions are UNCONSTRAINED: weights may be negative, which implies
// short positions. Callers should surface that rather than hide it.
// ---------------------------------------------------------------------------

import { invert } from './regression.js';

/** Sample covariance matrix of aligned return series. */
export function covariance(series) {
  const k = series.length;
  const n = series[0].length;
  const means = series.map(s => s.reduce((a, b) => a + b, 0) / n);
  const C = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      let s = 0;
      for (let t = 0; t < n; t++) s += (series[i][t] - means[i]) * (series[j][t] - means[j]);
      const v = s / (n - 1);
      C[i][j] = v; C[j][i] = v;
    }
  }
  return C;
}

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const matVec = (M, v) => M.map(row => dot(row, v));

/** Portfolio variance w'Σw. */
export function portfolioVariance(weights, cov) {
  return dot(weights, matVec(cov, weights));
}

/**
 * Global minimum-variance portfolio: w = Σ⁻¹1 / (1'Σ⁻¹1).
 * The lowest-risk combination available, independent of expected returns.
 */
export function minVariancePortfolio(cov) {
  const inv = invert(cov);
  if (!inv) return null;
  const ones = new Array(cov.length).fill(1);
  const z = matVec(inv, ones);
  const denom = dot(ones, z);
  if (!denom || !isFinite(denom)) return null;
  return z.map(v => v / denom);
}

/**
 * Tangency (max-Sharpe) portfolio: w = Σ⁻¹(μ − rf) / (1'Σ⁻¹(μ − rf)).
 * The highest reward-per-unit-risk combination.
 */
export function tangencyPortfolio(cov, meanReturns, riskFree = 0) {
  const inv = invert(cov);
  if (!inv) return null;
  const excess = meanReturns.map(m => m - riskFree);
  const z = matVec(inv, excess);
  const denom = z.reduce((a, b) => a + b, 0);
  // A non-positive denominator means no long tangency portfolio exists
  // (every asset's excess return is unattractive relative to its risk).
  if (!denom || !isFinite(denom)) return null;
  return z.map(v => v / denom);
}

/**
 * Trace the efficient frontier by mixing the two funds.
 * lambda = 0 -> minimum variance, lambda = 1 -> tangency, >1 -> levered.
 */
export function efficientFrontier(cov, meanReturns, riskFree = 0, steps = 25) {
  const wMin = minVariancePortfolio(cov);
  const wTan = tangencyPortfolio(cov, meanReturns, riskFree);
  if (!wMin) return null;

  // Only lambda >= 0 is efficient. Negative lambda traces the LOWER branch of
  // the hyperbola: those portfolios carry the same risk as a positive-lambda
  // counterpart but earn strictly less, so they are dominated and must never
  // be presented as choices on an efficient frontier.
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const lam = (2.0 * i) / steps;
    const w = wTan
      ? wMin.map((v, k) => (1 - lam) * v + lam * wTan[k])
      : wMin;
    const varr = portfolioVariance(w, cov);
    if (varr < 0) continue;
    points.push({ lambda: lam, weights: w, return: dot(w, meanReturns), risk: Math.sqrt(varr) });
  }

  // Frontier is conventionally drawn risk-ascending.
  points.sort((a, b) => a.risk - b.risk);
  return { points, minVariance: wMin, tangency: wTan };
}

/** Annualise a per-period statistic. */
export const annualiseReturn = (r, periods = 252) => r * periods;
export const annualiseRisk = (sd, periods = 252) => sd * Math.sqrt(periods);
