// ---------------------------------------------------------------------------
// Ordinary least squares multiple regression.
//
// Used for factor-exposure analysis: regressing portfolio excess returns on a
// set of factor returns to recover betas, alpha, and their significance.
//
// Solves the normal equations b = (X'X)^-1 X'y. With a handful of factors the
// matrices are tiny, so a direct Gauss-Jordan inverse is both fast enough and
// far easier to verify than an iterative solver.
// ---------------------------------------------------------------------------

/** Invert a square matrix via Gauss-Jordan with partial pivoting. */
export function invert(M) {
  const n = M.length;
  // Augment with the identity.
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: pick the largest magnitude entry in this column.
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-12) return null; // singular
    [A[col], A[pivot]] = [A[pivot], A[col]];

    const p = A[col][col];
    for (let j = 0; j < 2 * n; j++) A[col][j] /= p;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j];
    }
  }

  return A.map(row => row.slice(n));
}

export function transpose(M) {
  return M[0].map((_, j) => M.map(row => row[j]));
}

export function matMul(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  const out = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let x = 0; x < k; x++) s += A[i][x] * B[x][j];
      out[i][j] = s;
    }
  }
  return out;
}

/**
 * Fit y = a + b1*x1 + ... + bk*xk.
 *
 * @param {number[][]} X - n rows of k predictors (no intercept column).
 * @param {number[]}   y - n observations.
 * @returns null if the system is singular or under-determined.
 */
export function ols(X, y) {
  const n = X.length;
  if (!n || n !== y.length) return null;
  const k = X[0].length;
  if (n <= k + 1) return null; // need residual degrees of freedom

  // Prepend the intercept column.
  const Xd = X.map(row => [1, ...row]);
  const Xt = transpose(Xd);
  const XtX = matMul(Xt, Xd);
  const XtXinv = invert(XtX);
  if (!XtXinv) return null;

  const Xty = matMul(Xt, y.map(v => [v]));
  const beta = matMul(XtXinv, Xty).map(r => r[0]);

  // Fitted values and residuals.
  const fitted = Xd.map(row => row.reduce((s, v, i) => s + v * beta[i], 0));
  const resid = y.map((v, i) => v - fitted[i]);

  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const tss = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const rss = resid.reduce((s, v) => s + v * v, 0);

  const dof = n - k - 1;
  const sigma2 = rss / dof;
  // Standard errors are the sqrt of the diagonal of sigma^2 * (X'X)^-1.
  const se = XtXinv.map((row, i) => Math.sqrt(Math.max(sigma2 * row[i], 0)));
  const tStats = beta.map((b, i) => (se[i] ? b / se[i] : null));

  const r2 = tss > 0 ? 1 - rss / tss : 0;
  const adjR2 = tss > 0 && dof > 0 ? 1 - (rss / dof) / (tss / (n - 1)) : 0;

  return {
    intercept: beta[0],
    coefficients: beta.slice(1),
    interceptSE: se[0],
    coefficientSE: se.slice(1),
    interceptT: tStats[0],
    tStats: tStats.slice(1),
    r2, adjR2,
    residualStd: Math.sqrt(sigma2),
    n, dof, residuals: resid,
  };
}

/**
 * Two-sided p-value for a t-statistic.
 *
 * Uses the normal approximation, which is accurate for the sample sizes here
 * (hundreds of daily observations) and avoids needing an incomplete beta
 * function for the exact t-distribution.
 */
export function pValue(t, dof) {
  if (t == null || !isFinite(t)) return null;
  if (dof < 30) return null; // normal approximation not appropriate
  const z = Math.abs(t);
  // Abramowitz & Stegun 7.1.26 for the normal CDF.
  const s = 1 / (1 + 0.2316419 * z);
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const poly = s * (0.319381530 + s * (-0.356563782 + s * (1.781477937 + s * (-1.821255978 + s * 1.330274429))));
  const upperTail = pdf * poly;
  return +(2 * upperTail).toFixed(4);
}
