// ---------------------------------------------------------------------------
// Bracket-order maths: stop-loss, take-profit and trailing-stop levels.
//
// When the bot opens a position it can attach protective exits — a stop below
// (to cap loss) and a target above (to bank profit) — the "bracket" pattern
// from the course trader bots (NB_05). This module computes those prices; the
// broker adapter submits them. Pure and unit-tested so the price arithmetic is
// verified in isolation.
//
// The bot trades long-only equities, so for every position: stop < entry < target.
// ---------------------------------------------------------------------------

/** Round to a sensible equity tick (2 dp above $1, 4 dp below). */
export function roundTick(price) {
  return price >= 1 ? +price.toFixed(2) : +price.toFixed(4);
}

/**
 * Compute stop-loss and take-profit prices for a long entry.
 *
 * @param entry     fill price
 * @param slPercent fractional stop distance (0.05 = 5% below entry), or null
 * @param tpPercent fractional target distance (0.10 = 10% above entry), or null
 * @returns {{ stopLoss, takeProfit, valid, reason }}
 */
export function computeBracket(entry, slPercent, tpPercent) {
  if (!(entry > 0)) return { stopLoss: null, takeProfit: null, valid: false, reason: 'Invalid entry price' };

  let stopLoss = null, takeProfit = null;
  if (slPercent != null) {
    if (!(slPercent > 0 && slPercent < 1)) return { stopLoss: null, takeProfit: null, valid: false, reason: 'Stop % must be between 0 and 1' };
    stopLoss = roundTick(entry * (1 - slPercent));
  }
  if (tpPercent != null) {
    if (!(tpPercent > 0)) return { stopLoss: null, takeProfit: null, valid: false, reason: 'Target % must be positive' };
    takeProfit = roundTick(entry * (1 + tpPercent));
  }

  // A rounded stop/target must not collapse onto the entry.
  if (stopLoss != null && stopLoss >= entry) return { stopLoss, takeProfit, valid: false, reason: 'Stop rounds to at or above entry' };
  if (takeProfit != null && takeProfit <= entry) return { stopLoss, takeProfit, valid: false, reason: 'Target rounds to at or below entry' };

  return { stopLoss, takeProfit, valid: stopLoss != null || takeProfit != null, reason: null };
}

/** Reward-to-risk of a bracket, given its distances. */
export function bracketRR(slPercent, tpPercent) {
  if (!slPercent || !tpPercent) return null;
  return +(tpPercent / slPercent).toFixed(2);
}

/**
 * The stop price a trailing stop would sit at, given the best (highest) price
 * seen since entry for a long. It only ever ratchets up.
 */
export function trailingStop(highWaterMark, trailPercent) {
  if (!(highWaterMark > 0) || !(trailPercent > 0 && trailPercent < 1)) return null;
  return roundTick(highWaterMark * (1 - trailPercent));
}

/**
 * One step of a live trailing stop for a long position. Given the previous
 * high-water mark and the current price, ratchet the mark up, recompute the
 * stop, and report whether price has fallen through it (an exit).
 *
 * @returns {{ hwm, stop, breached }}
 */
export function updateTrailingStop(prevHwm, price, trailPercent) {
  if (!(price > 0)) return { hwm: prevHwm ?? null, stop: null, breached: false };
  const hwm = Math.max(prevHwm ?? price, price);
  const stop = trailingStop(hwm, trailPercent);
  return { hwm, stop, breached: stop != null && price <= stop };
}
