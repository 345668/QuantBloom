// ---------------------------------------------------------------------------
// Power-market pricing — merit-order dispatch and fuel spreads.
//
// Extracted from "Power 2026: Electricity Pricing in the Age of AI" (Neel
// Somani, ex-Citadel power & gas). Wholesale electricity clears by MARGINAL-COST
// (merit-order) pricing: rank generators cheapest-first, dispatch until demand
// is met, and the last unit needed — the "marginal unit" — sets a single uniform
// clearing price that every dispatched unit is paid. That is the whole game, and
// it is a small deterministic computation. Pure and unit-tested.
//
// These are CALCULATORS on a supplied generator stack, not a live ISO/LMP feed.
// ---------------------------------------------------------------------------

/**
 * Marginal cost of a thermal unit: heat rate (MMBtu/MWh) × fuel price ($/MMBtu),
 * plus variable O&M and any carbon adder ($/MWh). Lower heat rate = more
 * efficient = cheaper.
 */
export function marginalCostOfThermal(heatRate, fuelPrice, vom = 0, carbon = 0) {
  return heatRate * fuelPrice + vom + carbon;
}

/**
 * Merit-order dispatch. Generators = [{ name, fuel, capacity, marginalCost }].
 * Dispatch cheapest-first until demand is served; the last unit sets the uniform
 * clearing price. Returns the price, the marginal unit, per-unit dispatch with
 * inframarginal rent, total production cost, and any unserved demand (shortfall).
 */
export function meritOrderDispatch(generators, demand) {
  const sorted = [...generators].sort((a, b) => a.marginalCost - b.marginalCost);
  let remaining = Math.max(demand, 0);
  let clearingPrice = 0, marginalUnit = null, totalCost = 0;
  const dispatched = [];

  for (const g of sorted) {
    if (remaining <= 1e-9) break;
    const use = Math.min(g.capacity, remaining);
    if (use <= 0) continue;
    dispatched.push({ name: g.name, fuel: g.fuel, marginalCost: g.marginalCost, dispatchedMW: use });
    totalCost += use * g.marginalCost;
    remaining -= use;
    clearingPrice = g.marginalCost; // last unit dispatched sets the price
    marginalUnit = g.name;
  }

  const unserved = Math.max(remaining, 0);
  // Uniform pricing: each dispatched unit earns (clearing price − its own cost)
  // per MW — the "inframarginal rent". The marginal unit earns zero.
  for (const d of dispatched) {
    d.inframarginalRent = +((clearingPrice - d.marginalCost) * d.dispatchedMW).toFixed(2);
  }

  return {
    clearingPrice: +clearingPrice.toFixed(2),
    marginalUnit,
    dispatched,
    totalCost: +totalCost.toFixed(2),
    unserved: +unserved.toFixed(2),
    totalCapacity: generators.reduce((s, g) => s + g.capacity, 0),
    servedMW: +(Math.max(demand, 0) - unserved).toFixed(2),
  };
}

/**
 * Spark spread: the gross margin of a gas plant per MWh.
 *   spark = power price − heat rate × gas price
 * Positive means the plant is in the money and will want to run.
 */
export function sparkSpread(powerPrice, heatRate, gasPrice, vom = 0) {
  return +(powerPrice - heatRate * gasPrice - vom).toFixed(2);
}

/** Dark spread: the coal-plant analogue of the spark spread. */
export function darkSpread(powerPrice, heatRate, coalPrice, vom = 0) {
  return +(powerPrice - heatRate * coalPrice - vom).toFixed(2);
}

/**
 * Effective (break-even) heat rate: the heat rate at which a gas unit makes
 * exactly zero spark spread under current power/gas prices. A unit is in the
 * money iff its own heat rate is below this. HR* = power / gas.
 */
export function effectiveHeatRate(powerPrice, gasPrice) {
  if (!(gasPrice > 0)) return null;
  return +(powerPrice / gasPrice).toFixed(3);
}

/**
 * Two-node locational marginal price with a transmission constraint — the
 * paper's core illustration (ch. 9). Two buses A and B, each with a local
 * generator {cost, capacity} and demand, joined by a line with a MW limit.
 *
 * The cheaper node serves its own load and exports its spare capacity to the
 * dearer node, up to the line limit. While the line has slack, one price clears
 * both nodes. The moment the line saturates and the dearer node must self-supply,
 * the prices DECOUPLE: the exporting node clears at its (low) cost, the importing
 * node at its (high) cost. That gap is the congestion basis — the source of
 * price spikes and the payoff of an FTR.
 *
 * @returns {{ lmpA, lmpB, flow(+=A→B), flowMagnitude, lineLimit, congested,
 *             congestionBasis, dispatchA, dispatchB, unserved, exporter }}
 */
export function twoNodeLMP({ genA, genB, demandA = 0, demandB = 0, lineLimit = 0 }) {
  const T = Math.max(lineLimit, 0);
  const aCheaper = genA.cost <= genB.cost;
  const L = aCheaper ? { ...genA, demand: demandA, node: 'A' } : { ...genB, demand: demandB, node: 'B' };
  const H = aCheaper ? { ...genB, demand: demandB, node: 'B' } : { ...genA, demand: demandA, node: 'A' };

  // Cheaper node serves its own load, then exports spare capacity over the line.
  const spareL = Math.max(L.capacity - L.demand, 0);
  const exportLH = Math.min(T, spareL, Math.max(H.demand, 0));
  const pL = L.demand + exportLH;
  let pH = H.demand - exportLH;
  const unserved = Math.max(pH - H.capacity, 0);
  pH = Math.min(pH, H.capacity);

  const lineFull = exportLH >= T - 1e-9;      // includes T = 0 (islanded)
  const hProducesLocally = pH > 1e-9;
  const lHasSpare = pL < L.capacity - 1e-9;
  const congested = lineFull && hProducesLocally && lHasSpare && H.cost > L.cost;

  let lmpL, lmpH;
  if (congested) { lmpL = L.cost; lmpH = H.cost; }
  else { const price = lHasSpare ? L.cost : H.cost; lmpL = price; lmpH = price; }

  const lmpA = aCheaper ? lmpL : lmpH;
  const lmpB = aCheaper ? lmpH : lmpL;
  return {
    lmpA: +lmpA.toFixed(2), lmpB: +lmpB.toFixed(2),
    flow: +((aCheaper ? exportLH : -exportLH)).toFixed(2), // +ve = A→B
    flowMagnitude: +exportLH.toFixed(2),
    lineLimit: T,
    congested,
    congestionBasis: +(lmpH - lmpL).toFixed(2),
    dispatchA: +((aCheaper ? pL : pH)).toFixed(2),
    dispatchB: +((aCheaper ? pH : pL)).toFixed(2),
    unserved: +unserved.toFixed(2),
    exporter: exportLH > 0 ? L.node : null,
  };
}

// --- P3: plant economics, heat-rate call option, forward strips ------------

/** A gas plant's daily economics at given power/gas prices. */
export function plantDailyPnl({ capacityMW, heatRate, gasPrice, powerPrice, hours = 16, vom = 0, utilization = 1 }) {
  const mwh = capacityMW * hours * Math.max(0, Math.min(utilization, 1));
  const revenue = powerPrice * mwh;
  const fuelCost = heatRate * gasPrice * mwh;
  const vomCost = vom * mwh;
  return {
    mwh: +mwh.toFixed(1),
    revenue: +revenue.toFixed(0),
    fuelCost: +fuelCost.toFixed(0),
    grossMargin: +(revenue - fuelCost - vomCost).toFixed(0),
    sparkPerMWh: +(powerPrice - heatRate * gasPrice - vom).toFixed(2),
  };
}

/** The power price at which a gas unit breaks even (spark = 0). */
export function breakevenPowerPrice(heatRate, gasPrice, vom = 0) {
  return +(heatRate * gasPrice + vom).toFixed(2);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function randn(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/**
 * Heat-rate call option value by Monte Carlo — the instrument (ch. 4) that lets
 * a plant owner monetise their unit's optionality: it pays the positive spark
 * spread, day by day, only when the plant is in the money. Power and gas are
 * simulated as correlated lognormals around their forwards (martingale drift),
 * so the option value is at least its intrinsic value (convexity), and rises
 * with volatility and falls as power/gas co-move (a tighter spread).
 */
export function hrcoValueMC({
  capacityMW, heatRate, vom = 0, powerPrice, gasPrice,
  powerVol = 0.4, gasVol = 0.3, corr = 0.3, hours = 16, days = 21, sims = 4000, seed = 42,
}) {
  const rng = mulberry32(seed);
  const mwh = capacityMW * hours * days;
  let sum = 0;
  for (let i = 0; i < sims; i++) {
    const zP = randn(rng);
    const zG = corr * zP + Math.sqrt(1 - corr * corr) * randn(rng);
    const power = powerPrice * Math.exp(-0.5 * powerVol * powerVol + powerVol * zP);
    const gas = gasPrice * Math.exp(-0.5 * gasVol * gasVol + gasVol * zG);
    sum += Math.max(0, power - heatRate * gas - vom);
  }
  const expectedSpark = sum / sims;
  const value = expectedSpark * mwh;
  const intrinsic = Math.max(0, powerPrice - heatRate * gasPrice - vom) * mwh;
  return {
    value: +value.toFixed(0),
    intrinsic: +intrinsic.toFixed(0),
    optionPremium: +(value - intrinsic).toFixed(0),
    expectedSparkPerMWh: +expectedSpark.toFixed(2),
    mwh,
  };
}

/** A forward strip is just the average price over the delivery period. */
export function forwardStrip(prices) {
  if (!prices.length) return 0;
  return +(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
}

/** Split hourly prices into on-peak / off-peak strips (hour of day % 24). */
export function peakOffPeak(hourlyPrices, { peakStart = 7, peakEnd = 23 } = {}) {
  const peak = [], off = [];
  hourlyPrices.forEach((p, i) => { const h = i % 24; (h >= peakStart && h < peakEnd ? peak : off).push(p); });
  return { peak: forwardStrip(peak), offPeak: forwardStrip(off) };
}

// --- P4: duck curve, net demand, scarcity pricing --------------------------

/** A stylised 24-hour demand / solar / wind profile (deterministic). */
export function stylizedDailyProfile({ peakDemand = 4000, baseDemand = 2400, solarCap = 1600, windCap = 700 } = {}) {
  const demand = [], solar = [], wind = [];
  for (let h = 0; h < 24; h++) {
    const morning = Math.exp(-((h - 8) ** 2) / 6);
    const evening = Math.exp(-((h - 19) ** 2) / 5);
    demand.push(Math.round(baseDemand + (peakDemand - baseDemand) * Math.min(1, 0.5 * morning + evening)));
    solar.push(Math.round(solarCap * Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)))); // 6am–6pm bell
    wind.push(Math.round(windCap * (0.6 + 0.4 * Math.cos((h / 24) * 2 * Math.PI))));     // higher overnight
  }
  return { demand, solar, wind };
}

/** Net demand = demand − renewables, floored at zero (the duck's belly midday). */
export function netDemandCurve(demand, renewables) {
  return demand.map((d, i) => ({ hour: i, demand: d, renewables: renewables[i] || 0, net: Math.max(d - (renewables[i] || 0), 0) }));
}

/** Hourly clearing price by dispatching the stack against each hour's net demand. */
export function hourlyClearingPrices(netDemand, stack) {
  return netDemand.map(nd => meritOrderDispatch(stack, nd.net).clearingPrice);
}

/**
 * Energy-only scarcity adder (ch. 8): value of lost load × probability of lost
 * load, added on top of the marginal energy price when supply runs short.
 */
export function scarcityAdder(voll, pLostLoad) {
  return +(voll * Math.max(0, Math.min(pLostLoad, 1))).toFixed(2);
}

/**
 * Build a realistic merit-order stack from fuel prices. Renewables/nuclear/hydro
 * are near-zero marginal cost; gas and coal are priced through their heat rates,
 * so a change in the gas price re-orders the stack (fuel switching).
 */
export function buildStack({ gasPrice = 3.5, coalPrice = 2.0, carbon = 0 } = {}) {
  return [
    { name: 'Nuclear', fuel: 'nuclear', capacity: 1000, marginalCost: +(8).toFixed(2) },
    { name: 'Wind', fuel: 'wind', capacity: 800, marginalCost: 0 },
    { name: 'Solar', fuel: 'solar', capacity: 600, marginalCost: 0 },
    { name: 'Hydro', fuel: 'hydro', capacity: 400, marginalCost: 5 },
    { name: 'CCGT (HR 7)', fuel: 'gas', capacity: 1200, marginalCost: +marginalCostOfThermal(7, gasPrice, 2, carbon).toFixed(2) },
    { name: 'Coal (HR 10)', fuel: 'coal', capacity: 900, marginalCost: +marginalCostOfThermal(10, coalPrice, 3, carbon * 2).toFixed(2) },
    { name: 'SCGT (HR 10)', fuel: 'gas', capacity: 500, marginalCost: +marginalCostOfThermal(10, gasPrice, 4, carbon).toFixed(2) },
    { name: 'Peaker (HR 14)', fuel: 'oil', capacity: 300, marginalCost: +marginalCostOfThermal(14, gasPrice * 1.8, 8, carbon).toFixed(2) },
  ];
}
