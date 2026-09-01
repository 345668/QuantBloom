import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  futureValue, presentValue, npv, irr, effectiveRate, nominalRate, annuityPV, annuityFV,
} from '../bot/tvm.js';

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

// --- Present / Future value (course worked answers) ------------------------

test('presentValue matches the course answer: 1000 @ 5% in 10y = 613.9133', () => {
  close(presentValue(1000, 0.05, 10), 613.9132535407591, 1e-9);
});

test('presentValue with monthly compounding = 607.1610', () => {
  close(presentValue(1000, 0.05, 10, 12), 607.1610402990219, 1e-9);
});

test('futureValue matches 100 @ 4% for 6y', () => {
  close(futureValue(100, 0.04, 6), 100 * Math.pow(1.04, 6), 1e-9);
});

test('PV and FV are exact inverses', () => {
  const fv = futureValue(250, 0.07, 8, 4);
  close(presentValue(fv, 0.07, 8, 4), 250, 1e-9);
});

test('more frequent compounding lowers the present value', () => {
  const annual = presentValue(1000, 0.05, 10, 1);
  const monthly = presentValue(1000, 0.05, 10, 12);
  assert.ok(monthly < annual);
});

// --- NPV (course cash-flow example) ----------------------------------------

test('npv of the course series [-200,20,50,70,100,50] @ 6%', () => {
  // Recomputed directly from the definition as the oracle.
  const cf = [-200, 20, 50, 70, 100, 50];
  let expected = 0;
  for (let i = 0; i < cf.length; i++) expected += cf[i] / Math.pow(1.06, i);
  close(npv(0.06, cf), expected, 1e-12);
});

test('npv at 0% is just the sum of cash flows', () => {
  close(npv(0, [-200, 20, 50, 70, 100, 50]), 90, 1e-9);
});

// --- IRR --------------------------------------------------------------------

test('irr drives npv to zero for a normal project', () => {
  const cf = [-200, 20, 50, 70, 100, 50];
  const r = irr(cf);
  close(npv(r, cf), 0, 1e-6);
  assert.ok(r > 0 && r < 0.2);
});

test('irr of a simple double-your-money-in-1y project is 100%', () => {
  close(irr([-100, 200]), 1.0, 1e-6);
});

test('irr recovers a known rate from a bond-like series', () => {
  // 5% coupon bond bought at par -> IRR should be 5%.
  const cf = [-1000, 50, 50, 50, 50, 1050];
  close(irr(cf), 0.05, 1e-4);
});

test('irr returns null when no root brackets the series (all positive)', () => {
  assert.equal(irr([100, 50, 25]), null);
});

// --- Rate conversions ------------------------------------------------------

test('effective rate exceeds nominal when compounding more than once', () => {
  // 10% nominal, monthly -> ~10.4713% effective.
  close(effectiveRate(0.10, 12), Math.pow(1 + 0.10 / 12, 12) - 1, 1e-12);
  assert.ok(effectiveRate(0.10, 12) > 0.10);
});

test('nominalRate is the inverse of effectiveRate', () => {
  const eff = effectiveRate(0.08, 4);
  close(nominalRate(eff, 4), 0.08, 1e-9);
});

test('annual compounding leaves the rate unchanged', () => {
  close(effectiveRate(0.06, 1), 0.06, 1e-12);
});

// --- Annuities -------------------------------------------------------------

test('annuity PV/FV are consistent with discounting', () => {
  const pv = annuityPV(100, 0.05, 10);
  const fv = annuityFV(100, 0.05, 10);
  // FV should equal PV grown for 10 years.
  close(fv, pv * Math.pow(1.05, 10), 1e-6);
});

test('zero-rate annuity is just payment times periods', () => {
  close(annuityPV(100, 0, 10), 1000, 1e-9);
  close(annuityFV(100, 0, 10), 1000, 1e-9);
});
