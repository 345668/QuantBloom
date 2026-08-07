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
