// Run: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bsPrice, greeks, impliedVol, normCdf } from '../blackscholes.js';

const close = (a, b, tol = 1e-3) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

test('normCdf matches known values', () => {
  close(normCdf(0), 0.5, 1e-6);
  close(normCdf(1.96), 0.975, 1e-4);
  close(normCdf(-1.96), 0.025, 1e-4);
  close(normCdf(1.645), 0.95, 1e-4);
});

test('bsPrice matches textbook Black-Scholes values', () => {
  // Hull, standard worked example:
  // S=42, K=40, r=10%, sigma=20%, T=0.5 -> call 4.76, put 0.81
  close(bsPrice('call', 42, 40, 0.5, 0.10, 0.20), 4.759, 0.01);
  close(bsPrice('put', 42, 40, 0.5, 0.10, 0.20), 0.808, 0.01);
});

test('put-call parity holds: C - P = S*e^-qT - K*e^-rT', () => {
  const S = 100, K = 95, T = 0.75, r = 0.045, sig = 0.30, q = 0.02;
  const c = bsPrice('call', S, K, T, r, sig, q);
  const p = bsPrice('put', S, K, T, r, sig, q);
  const rhs = S * Math.exp(-q * T) - K * Math.exp(-r * T);
  close(c - p, rhs, 1e-6);
});

test('price is intrinsic at expiry', () => {
  assert.equal(bsPrice('call', 110, 100, 0, 0.05, 0.2), 10);
  assert.equal(bsPrice('put', 110, 100, 0, 0.05, 0.2), 0);
  assert.equal(bsPrice('put', 90, 100, 0, 0.05, 0.2), 10);
});

test('call delta sits in [0,1] and put delta in [-1,0]', () => {
  for (const K of [80, 100, 120]) {
    const cd = greeks('call', 100, K, 0.5, 0.04, 0.25).delta;
    const pd = greeks('put', 100, K, 0.5, 0.04, 0.25).delta;
    assert.ok(cd >= 0 && cd <= 1, `call delta ${cd} out of range`);
    assert.ok(pd >= -1 && pd <= 0, `put delta ${pd} out of range`);
  }
});

test('delta parity: call delta - put delta = e^-qT', () => {
  const q = 0.03, T = 0.5;
  const cd = greeks('call', 100, 100, T, 0.04, 0.25, q).delta;
  const pd = greeks('put', 100, 100, T, 0.04, 0.25, q).delta;
  close(cd - pd, Math.exp(-q * T), 1e-3);
});

test('gamma and vega are identical for calls and puts', () => {
  const c = greeks('call', 100, 105, 0.4, 0.04, 0.3);
  const p = greeks('put', 100, 105, 0.4, 0.04, 0.3);
  close(c.gamma, p.gamma, 1e-9);
  close(c.vega, p.vega, 1e-9);
});

test('gamma peaks near the money', () => {
  const atm = greeks('call', 100, 100, 0.5, 0.04, 0.25).gamma;
  const otm = greeks('call', 100, 140, 0.5, 0.04, 0.25).gamma;
  const itm = greeks('call', 100, 60, 0.5, 0.04, 0.25).gamma;
  assert.ok(atm > otm && atm > itm, 'ATM gamma should exceed wing gamma');
});

test('long options decay: theta is negative for ATM', () => {
  assert.ok(greeks('call', 100, 100, 0.25, 0.04, 0.3).theta < 0);
  assert.ok(greeks('put', 100, 100, 0.25, 0.04, 0.3).theta < 0);
});

test('vega numerically matches a 1-point bump in vol', () => {
  const S = 100, K = 100, T = 0.5, r = 0.04, sig = 0.25;
  const v = greeks('call', S, K, T, r, sig).vega;
  const bumped = bsPrice('call', S, K, T, r, sig + 0.01) - bsPrice('call', S, K, T, r, sig);
  close(v, bumped, 5e-3);
});

test('delta numerically matches a $1 bump in spot', () => {
  const K = 100, T = 0.5, r = 0.04, sig = 0.25;
  const d = greeks('call', 100, K, T, r, sig).delta;
  const bumped = (bsPrice('call', 100.5, K, T, r, sig) - bsPrice('call', 99.5, K, T, r, sig)) / 1;
  close(d, bumped, 5e-3);
});

test('impliedVol recovers the volatility used to price', () => {
  for (const sig of [0.12, 0.25, 0.60, 1.20]) {
    for (const K of [80, 100, 130]) {
      const px = bsPrice('call', 100, K, 0.5, 0.04, sig);
      const iv = impliedVol('call', px, 100, K, 0.5, 0.04);
      close(iv, sig, 1e-3);
    }
  }
});

test('impliedVol works for puts and with a dividend yield', () => {
  const px = bsPrice('put', 100, 110, 0.75, 0.05, 0.35, 0.02);
  close(impliedVol('put', px, 100, 110, 0.75, 0.05, 0.02), 0.35, 1e-3);
});

test('impliedVol rejects prices below intrinsic', () => {
  // A call worth less than S-K is an arbitrage; no vol can produce it.
  assert.equal(impliedVol('call', 1, 120, 100, 0.5, 0.04), null);
});
