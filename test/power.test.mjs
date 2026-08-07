import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  marginalCostOfThermal, meritOrderDispatch, sparkSpread, darkSpread,
  effectiveHeatRate, buildStack, twoNodeLMP,
  plantDailyPnl, breakevenPowerPrice, hrcoValueMC, forwardStrip, peakOffPeak,
  stylizedDailyProfile, netDemandCurve, hourlyClearingPrices, scarcityAdder,
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

// --- Two-node LMP / congestion (the paper's A↔B example) ------------------

const bigCap = { A: { cost: 100, capacity: 1000 }, B: { cost: 10, capacity: 1000 } };

test('uncongested: cheap B serves A over a slack line, one price clears both', () => {
  // 10 MW at A, 50 MW line: B ships 10 (<50), no congestion, both at $10.
  const r = twoNodeLMP({ genA: bigCap.A, genB: bigCap.B, demandA: 10, demandB: 0, lineLimit: 50 });
  assert.equal(r.lmpA, 10);
  assert.equal(r.lmpB, 10);
  assert.equal(r.congested, false);
  assert.equal(r.flow, -10);          // B → A, so signed A→B is negative
  assert.equal(r.congestionBasis, 0);
});

test('congested: line saturates, prices decouple to each node cost', () => {
  // 60 MW at A, 50 MW line: B ships 50 (full), A self-supplies 10 at $100.
  const r = twoNodeLMP({ genA: bigCap.A, genB: bigCap.B, demandA: 60, demandB: 0, lineLimit: 50 });
  assert.equal(r.lmpA, 100);
  assert.equal(r.lmpB, 10);
  assert.equal(r.congested, true);
  assert.equal(r.flowMagnitude, 50);  // pinned at the limit
  assert.equal(r.congestionBasis, 90);
  assert.equal(r.dispatchA, 10);
  assert.equal(r.dispatchB, 50);
});

test('a big enough line removes congestion and re-couples the price', () => {
  const r = twoNodeLMP({ genA: bigCap.A, genB: bigCap.B, demandA: 60, demandB: 0, lineLimit: 1000 });
  assert.equal(r.congested, false);
  assert.equal(r.lmpA, 10);
  assert.equal(r.lmpB, 10);
});

test('no line (T=0) islands the nodes — each clears at its own generator', () => {
  const r = twoNodeLMP({ genA: bigCap.A, genB: bigCap.B, demandA: 60, demandB: 20, lineLimit: 0 });
  assert.equal(r.lmpA, 100);
  assert.equal(r.lmpB, 10);
  assert.equal(r.flowMagnitude, 0);
  assert.equal(r.congested, true);
});

test('demand beyond the importing node capacity leaves a shortfall', () => {
  const r = twoNodeLMP({ genA: { cost: 100, capacity: 5 }, genB: { cost: 10, capacity: 1000 }, demandA: 60, demandB: 0, lineLimit: 50 });
  // B ships 50, A needs 10 but can only make 5 -> 5 unserved.
  assert.equal(r.unserved, 5);
});

test('direction flips when node A is the cheaper one', () => {
  const r = twoNodeLMP({ genA: { cost: 10, capacity: 1000 }, genB: { cost: 100, capacity: 1000 }, demandA: 0, demandB: 60, lineLimit: 50 });
  assert.equal(r.flow, 50);      // A → B positive
  assert.equal(r.lmpA, 10);
  assert.equal(r.lmpB, 100);     // B congested/importing
  assert.equal(r.congested, true);
});

// --- P3: plant economics --------------------------------------------------

test('plantDailyPnl computes revenue, fuel and gross margin', () => {
  // 100 MW, 16 h, $60 power, HR 7, gas $3.5 -> fuel $24.5/MWh, spark $35.5.
  const p = plantDailyPnl({ capacityMW: 100, heatRate: 7, gasPrice: 3.5, powerPrice: 60, hours: 16 });
  close(p.mwh, 1600);
  close(p.revenue, 96000);            // matches the paper's ~$96k/day
  close(p.fuelCost, 7 * 3.5 * 1600);
  close(p.sparkPerMWh, 35.5);
  close(p.grossMargin, 35.5 * 1600);
});

test('breakeven power price is heat rate times gas plus vom', () => {
  close(breakevenPowerPrice(7, 3.5), 24.5);
  close(breakevenPowerPrice(7, 3.5, 2), 26.5);
});

// --- P3: heat-rate call option --------------------------------------------

const hrco = (over = {}) => hrcoValueMC({
  capacityMW: 100, heatRate: 7, powerPrice: 40, gasPrice: 3.5,
  powerVol: 0.4, gasVol: 0.3, corr: 0.3, hours: 16, days: 21, sims: 4000, seed: 7, ...over,
});

test('HRCO value is at least its intrinsic value (optionality is non-negative)', () => {
  const r = hrco();
  assert.ok(r.value >= r.intrinsic - 1);
  assert.ok(r.optionPremium >= -1);
});

test('an at-the-money HRCO has zero intrinsic but positive value', () => {
  const atm = hrco({ powerPrice: 24.5 }); // spark forward = 40? no: 7*3.5=24.5 -> spark 0
  assert.equal(atm.intrinsic, 0);
  assert.ok(atm.value > 0, `expected positive time value, got ${atm.value}`);
});

test('HRCO value rises with power volatility', () => {
  assert.ok(hrco({ powerVol: 0.6 }).value > hrco({ powerVol: 0.2 }).value);
});

test('HRCO value falls as power and gas become more correlated (tighter spread)', () => {
  assert.ok(hrco({ corr: 0.1 }).value > hrco({ corr: 0.9 }).value);
});

test('HRCO is deterministic for a fixed seed', () => {
  assert.equal(hrco().value, hrco().value);
});

// --- P3: forward strips ---------------------------------------------------

test('forwardStrip is the mean price over the period', () => {
  close(forwardStrip([30, 40, 50]), 40);
  assert.equal(forwardStrip([]), 0);
});

test('peakOffPeak splits by hour of day', () => {
  const hourly = Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 23 ? 100 : 20));
  const r = peakOffPeak(hourly);
  close(r.peak, 100);
  close(r.offPeak, 20);
});

// --- P4: duck curve & scarcity --------------------------------------------

test('stylizedDailyProfile returns 24h of demand/solar/wind with a midday solar peak', () => {
  const { demand, solar, wind } = stylizedDailyProfile();
  assert.equal(demand.length, 24);
  assert.ok(solar[12] > solar[0]);       // solar peaks midday, zero at midnight
  assert.equal(solar[0], 0);
  assert.ok(Math.max(...wind) > 0);
});

test('net demand = demand − renewables and dips midday (the duck belly)', () => {
  const { demand, solar, wind } = stylizedDailyProfile();
  const renew = solar.map((s, i) => s + wind[i]);
  const nd = netDemandCurve(demand, renew);
  assert.equal(nd.length, 24);
  nd.forEach((x, i) => close(x.net, Math.max(demand[i] - renew[i], 0)));
  // midday net demand (solar high) below evening net demand (the duck's neck).
  assert.ok(nd[13].net < nd[19].net);
});

test('hourly clearing prices are higher in the evening than midday (price spike)', () => {
  const { demand, solar, wind } = stylizedDailyProfile();
  const nd = netDemandCurve(demand, solar.map((s, i) => s + wind[i]));
  const stack = buildStack({ gasPrice: 3.5 });
  const prices = hourlyClearingPrices(nd, stack);
  assert.equal(prices.length, 24);
  assert.ok(prices[19] >= prices[13]); // evening >= midday
});

test('scarcity adder is VOLL times the probability of lost load, clamped', () => {
  close(scarcityAdder(5000, 0.02), 100);
  close(scarcityAdder(5000, 1.5), 5000);  // probability clamped to 1
  close(scarcityAdder(5000, -0.1), 0);
});
