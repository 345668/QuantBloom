import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jacobiEigen } from '../bot/eigen.js';

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('diagonal matrix returns its diagonal as eigenvalues, descending', () => {
  const { values, vectors } = jacobiEigen([[3, 0, 0], [0, 1, 0], [0, 0, 2]]);
  close(values[0], 3); close(values[1], 2); close(values[2], 1);
  // Eigenvector for the largest (3) is e0.
  close(Math.abs(vectors[0][0]), 1);
});

test('the classic [[2,1],[1,2]] decomposition', () => {
  const { values, vectors } = jacobiEigen([[2, 1], [1, 2]]);
  close(values[0], 3); close(values[1], 1);
  // Eigenvector for 3 is [1,1]/sqrt2, for 1 is [1,-1]/sqrt2 (up to sign).
  const inv = 1 / Math.sqrt(2);
  close(Math.abs(vectors[0][0]), inv); close(Math.abs(vectors[0][1]), inv);
  assert.ok(vectors[0][0] * vectors[0][1] > 0, 'top vector components share sign');
  assert.ok(vectors[1][0] * vectors[1][1] < 0, 'second vector components differ in sign');
});

test('A v = lambda v holds for every returned eigenpair', () => {
  const A = [[4, 1, 2], [1, 3, 0], [2, 0, 5]];
  const { values, vectors } = jacobiEigen(A);
  for (let i = 0; i < 3; i++) {
    const v = vectors[i], lam = values[i];
    const Av = A.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
    for (let j = 0; j < 3; j++) close(Av[j], lam * v[j], 1e-6);
  }
});

test('eigenvectors are unit length and mutually orthogonal', () => {
  const { vectors } = jacobiEigen([[4, 1, 2], [1, 3, 0], [2, 0, 5]]);
  for (const v of vectors) close(Math.sqrt(v.reduce((s, x) => s + x * x, 0)), 1, 1e-9);
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  close(dot(vectors[0], vectors[1]), 0, 1e-6);
  close(dot(vectors[0], vectors[2]), 0, 1e-6);
  close(dot(vectors[1], vectors[2]), 0, 1e-6);
});

test('eigenvalues sum to the trace and product to the determinant', () => {
  const A = [[2, 1], [1, 2]];
  const { values } = jacobiEigen(A);
  close(values[0] + values[1], 4);   // trace
  close(values[0] * values[1], 3);   // det = 4 - 1
});

test('a rank-deficient matrix yields a zero eigenvalue', () => {
  // Rows proportional -> one eigenvalue is 0.
  const { values } = jacobiEigen([[1, 2], [2, 4]]);
  close(values[0], 5);           // trace 5
  close(values[1], 0, 1e-6);
});

test('sign convention makes the result deterministic', () => {
  const a = jacobiEigen([[2, 1], [1, 2]]);
  const b = jacobiEigen([[2, 1], [1, 2]]);
  assert.deepEqual(a.vectors, b.vectors);
  // Lead non-tiny component is positive.
  assert.ok(a.vectors[0].find(x => Math.abs(x) > 1e-9) > 0);
});

test('handles the 1x1 case', () => {
  const { values, vectors } = jacobiEigen([[7]]);
  close(values[0], 7);
  assert.deepEqual(vectors, [[1]]);
});
