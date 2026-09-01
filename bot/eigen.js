// ---------------------------------------------------------------------------
// Symmetric eigendecomposition via the cyclic Jacobi algorithm.
//
// PCA needs the eigenvectors of a covariance matrix (symmetric, so Jacobi is
// exact and robust — no need for a general non-symmetric solver). Jacobi
// repeatedly applies plane rotations that zero the largest off-diagonal entry
// until the matrix is diagonal; the diagonal holds the eigenvalues and the
// accumulated rotations hold the eigenvectors.
// ---------------------------------------------------------------------------

/**
 * @param {number[][]} matrix - a symmetric n×n matrix
 * @returns {{values:number[], vectors:number[][]}} eigenpairs sorted by
 *   descending eigenvalue. vectors[i] is the unit eigenvector for values[i].
 */
export function jacobiEigen(matrix, { maxSweeps = 100, tol = 1e-12 } = {}) {
  const n = matrix.length;
  if (n === 1) return { values: [matrix[0][0]], vectors: [[1]] };

  const a = matrix.map(r => r.slice());
  // v accumulates the rotations; its columns become the eigenvectors.
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off < tol) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const app = a[p][p], aqq = a[q][q], apq = a[p][q];
        // Rotation angle that annihilates a[p][q].
        const phi = 0.5 * Math.atan2(2 * apq, app - aqq);
        const c = Math.cos(phi), s = Math.sin(phi);

        // a := R^T a R, exploiting symmetry: rotate columns then rows.
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp + s * akq;
          a[k][q] = -s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk + s * aqk;
          a[q][k] = -s * apk + c * aqk;
        }
        // Accumulate the eigenvectors.
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p], vkq = v[k][q];
          v[k][p] = c * vkp + s * vkq;
          v[k][q] = -s * vkp + c * vkq;
        }
      }
    }
  }

  const values = a.map((r, i) => r[i]);
  const order = values.map((_, i) => i).sort((x, y) => values[y] - values[x]);
  return {
    values: order.map(i => values[i]),
    // Column i of v is the eigenvector for the i-th eigenvalue.
    vectors: order.map(i => normalize(v.map(row => row[i]))),
  };
}

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  // Fix the sign so the first non-tiny component is positive — makes the
  // decomposition deterministic (eigenvectors are only defined up to sign).
  const lead = vec.find(x => Math.abs(x) > 1e-9) || 1;
  const sign = lead < 0 ? -1 : 1;
  return vec.map(x => (x / norm) * sign);
}
