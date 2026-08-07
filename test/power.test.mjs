import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  marginalCostOfThermal, meritOrderDispatch, sparkSpread, darkSpread,
  effectiveHeatRate, buildStack,
} from '../charting/power.js';

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

// --- Marginal cost --------------------------------------------------------

test('thermal marginal cost = heat rate × fuel + vom + carbon', () => {
  close(marginalCostOfThermal(7, 3.5), 24.5);
  close(marginalCostOfThermal(7, 3.5, 2, 1), 27.5);
});

// --- Merit order ----------------------------------------------------------

test('dispatches cheapest-first and the marginal unit sets the price', () => {
  const gens = [
    { name: 'Wind', capacity: 50, marginalCost: 0 },
    { name: 'CCGT', capacity: 50, marginalCost: 30 },
    { name: 'Peaker', capacity: 50, marginalCost: 90 },
  ];
  // Demand 60 -> all wind (50) + 10 of CCGT; CCGT is marginal, price 30.
  const r = meritOrderDispatch(gens, 60);
  assert.equal(r.clearingPrice, 30);
  assert.equal(r.marginalUnit, 'CCGT');
  assert.equal(r.dispatched.length, 2);
  assert.equal(r.unserved, 0);
});

test('pushing demand past a cheap unit raises the clearing price to the next unit', () => {
  const gens = [
    { name: 'Wind', capacity: 50, marginalCost: 0 },
    { name: 'CCGT', capacity: 50, marginalCost: 30 },
    { name: 'Peaker', capacity: 50, marginalCost: 90 },
  ];
  assert.equal(meritOrderDispatch(gens, 40).clearingPrice, 0);   // within wind
  assert.equal(meritOrderDispatch(gens, 80).clearingPrice, 30);  // into CCGT
  assert.equal(meritOrderDispatch(gens, 120).clearingPrice, 90); // into peaker
});

test('uniform pricing gives cheap units inframarginal rent, the marginal unit zero', () => {
  const gens = [
    { name: 'Wind', capacity: 50, marginalCost: 0 },
    { name: 'CCGT', capacity: 50, marginalCost: 30 },
  ];
  const r = meritOrderDispatch(gens, 60); // price 30
  const wind = r.dispatched.find(d => d.name === 'Wind');
  const ccgt = r.dispatched.find(d => d.name === 'CCGT');
  assert.equal(wind.inframarginalRent, 50 * 30);  // (30-0)*50
  assert.equal(ccgt.inframarginalRent, 0);         // marginal unit earns nothing
});

test('total production cost sums dispatched MW × own cost, not the clearing price', () => {
  const gens = [
    { name: 'Wind', capacity: 50, marginalCost: 0 },
    { name: 'CCGT', capacity: 50, marginalCost: 30 },
  ];
  const r = meritOrderDispatch(gens, 60); // 50@0 + 10@30 = 300
  close(r.totalCost, 300);
});

test('demand beyond total capacity leaves an unserved shortfall', () => {
  const gens = [{ name: 'Wind', capacity: 50, marginalCost: 0 }];
  const r = meritOrderDispatch(gens, 80);
  assert.equal(r.unserved, 30);
  assert.equal(r.servedMW, 50);
});

test('zero demand clears at zero with nothing dispatched', () => {
  const r = meritOrderDispatch([{ name: 'X', capacity: 10, marginalCost: 5 }], 0);
  assert.equal(r.clearingPrice, 0);
  assert.equal(r.dispatched.length, 0);
});

// --- Spreads --------------------------------------------------------------

test('spark spread is power minus heat-rate times gas', () => {
  close(sparkSpread(50, 7, 3.5), 50 - 24.5);      // 25.5 in the money
  assert.ok(sparkSpread(20, 10, 3.5) < 0);         // out of the money
});

test('dark spread is the coal analogue', () => {
  close(darkSpread(40, 10, 2.0), 20);
});

test('effective heat rate is the break-even heat rate (spark = 0 there)', () => {
  const hr = effectiveHeatRate(35, 3.5); // 10
  close(hr, 10);
  close(sparkSpread(35, hr, 3.5), 0);    // a unit at exactly HR* makes zero
  assert.equal(effectiveHeatRate(35, 0), null);
});

// --- Stack builder --------------------------------------------------------

test('buildStack reprices gas units with the gas price (fuel switching)', () => {
  const cheapGas = buildStack({ gasPrice: 2 });
  const dearGas = buildStack({ gasPrice: 8 });
  const ccgtCheap = cheapGas.find(g => g.name.startsWith('CCGT')).marginalCost;
  const ccgtDear = dearGas.find(g => g.name.startsWith('CCGT')).marginalCost;
  assert.ok(ccgtDear > ccgtCheap, 'higher gas price raises the CCGT marginal cost');
  // With very cheap gas, CCGT can undercut coal; with dear gas, coal wins.
  const coal = cheapGas.find(g => g.fuel === 'coal').marginalCost;
  assert.ok(ccgtCheap < coal + 30);
});

test('a realistic stack clears at a gas unit under normal demand', () => {
  const stack = buildStack({ gasPrice: 3.5 });
  const total = stack.reduce((s, g) => s + g.capacity, 0);
  const r = meritOrderDispatch(stack, total * 0.7); // 70% load
  assert.ok(r.clearingPrice > 0);
  assert.equal(r.unserved, 0);
  assert.ok(r.marginalUnit);
});
