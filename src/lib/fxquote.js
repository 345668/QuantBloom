// Pure, deterministic FX dealer-quote model for the FXGO-style grid.
// Given a mid price and pair, synthesize a stable bid/ask around the mid.
// Deterministic (no RNG) so tiles don't jitter between polls — only the mid
// moving produces a tick.

// Pip size: JPY-quoted pairs quote to 2dp, everything else to 4dp.
export function pipSize(pair) {
  return /JPY$/.test(pair.replace('/', '')) ? 0.01 : 0.0001;
}

// Typical dealer spread in pips. Majors are tight; EM crosses much wider.
const SPREAD_PIPS = {
  'EUR/USD': 0.6, 'USD/JPY': 0.8, 'GBP/USD': 1.2, 'USD/CHF': 1.4,
  'AUD/USD': 1.0, 'USD/CAD': 1.5, 'NZD/USD': 1.8,
  'USD/MXN': 45, 'USD/ZAR': 120, 'USD/TRY': 90,
  'USD/BRL': 60, 'USD/INR': 30, 'USD/CNH': 12,
};

export function spreadPips(pair) {
  if (SPREAD_PIPS[pair] != null) return SPREAD_PIPS[pair];
  // Unknown pair: guess by quote currency width.
  return /JPY$/.test(pair.replace('/', '')) ? 1.0 : 1.5;
}

// Digits to display: JPY pairs 3, EM 4, majors 5 (fractional-pip pricing).
export function displayDigits(pair) {
  const j = /JPY$/.test(pair.replace('/', ''));
  if (j) return 3;
  return spreadPips(pair) > 10 ? 4 : 5;
}

// Compute a dealer quote from a mid.  Returns { bid, ask, spread, mid }.
export function dealerQuote(pair, mid) {
  if (mid == null || !isFinite(mid)) return null;
  const half = (spreadPips(pair) * pipSize(pair)) / 2;
  return {
    mid,
    bid: mid - half,
    ask: mid + half,
    spread: spreadPips(pair),
    digits: displayDigits(pair),
  };
}

// Split a formatted price into "big figure" and the last two (pip) digits,
// the way dealer boards render the pips large.  e.g. 1.15743 -> ['1.157','43'].
export function splitBigFig(value, digits) {
  const s = value.toFixed(digits);
  return [s.slice(0, -2), s.slice(-2)];
}

// Tick direction of a new mid vs the previous mid: +1 up, -1 down, 0 flat.
export function tickDir(prevMid, mid) {
  if (prevMid == null || mid == null) return 0;
  if (mid > prevMid) return 1;
  if (mid < prevMid) return -1;
  return 0;
}
