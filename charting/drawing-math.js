// ---------------------------------------------------------------------------
// Pure maths behind the interactive drawing tools — measure readouts, position
// risk/reward, and Fibonacci level tables. Kept out of the React component so
// the numbers are unit-testable in isolation. Standard constructions.
// ---------------------------------------------------------------------------

/** Measure tool: change in price, percent, and elapsed time between two anchors. */
export function measure(a, b) {
  const deltaPrice = b.price - a.price;
  const deltaPercent = a.price ? (deltaPrice / a.price) * 100 : 0;
  return {
    deltaPrice: +deltaPrice.toFixed(4),
    deltaPercent: +deltaPercent.toFixed(2),
    deltaTimeSeconds: Math.abs(b.time - a.time),
    up: deltaPrice >= 0,
  };
}

/**
 * Long/short position tool. Direction is inferred from the target relative to
 * entry. Reward/risk is the ratio traders actually size on.
 */
export function positionRR(entry, target, stop) {
  const direction = target >= entry ? 'long' : 'short';
  const reward = Math.abs(target - entry);
  const risk = Math.abs(entry - stop);
  return {
    direction,
    reward: +reward.toFixed(4),
    risk: +risk.toFixed(4),
    rewardPct: entry ? +((reward / entry) * 100).toFixed(2) : null,
    riskPct: entry ? +((risk / entry) * 100).toFixed(2) : null,
    rr: risk ? +(reward / risk).toFixed(2) : null,
  };
}

export const FIB_RETRACEMENT = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
export const FIB_EXTENSION = [0, 0.382, 0.618, 1, 1.272, 1.618, 2.618];

/** Retracement levels between two prices; 0 = the high, 1 = the low. */
export function fibRetracementLevels(priceA, priceB) {
  const hi = Math.max(priceA, priceB);
  const lo = Math.min(priceA, priceB);
  return FIB_RETRACEMENT.map(level => ({ level, price: hi - (hi - lo) * level }));
}

/** A-B-C extension: project the A→B leg forward from C. */
export function fibExtensionLevels(priceA, priceB, priceC) {
  const move = priceB - priceA;
  return FIB_EXTENSION.map(level => ({ level, price: priceC + move * level }));
}

/** Count candles whose time falls within [t1, t2] — the measure tool's bar count. */
export function barsBetween(candles, t1, t2) {
  const lo = Math.min(t1, t2), hi = Math.max(t1, t2);
  return candles.filter(c => c.time >= lo && c.time <= hi).length;
}
