// Residual-alpha signal (Fama-French 5 + Carhart momentum).
//
// The paper's signal-layer gate: after regressing a name's excess returns on the
// factor spreads, only names whose residual-alpha t-statistic clears |t| > 2.0
// make the trade list — alpha the factors don't explain and that is unlikely to
// be luck. Positive significant alpha is a long candidate, negative a short/avoid.
// The OLS itself lives in regression.js (tested); this module holds the pure,
// testable *signal* logic layered on top of a fit.

export const TSTAT_GATE = 2.0;

// Annualise a daily intercept (alpha) to a percent.
export function annualizeAlpha(dailyAlpha) {
  return +(dailyAlpha * 252 * 100).toFixed(2);
}

// Turn an alpha t-stat into a directional signal under the |t|>gate rule.
// Returns { direction, significant, strength } where strength ∈ [0,1].
export function alphaSignal(alphaT, { gate = TSTAT_GATE } = {}) {
  if (alphaT == null || !isFinite(alphaT)) {
    return { direction: 'neutral', significant: false, strength: 0 };
  }
  const significant = Math.abs(alphaT) >= gate;
  const direction = !significant ? 'neutral' : alphaT > 0 ? 'bullish' : 'bearish';
  return { direction, significant, strength: Math.min(1, Math.abs(alphaT) / (2 * gate)) };
}

// Build a screen entry from a regression fit for one symbol.
// fit: { intercept, interceptT, r2, n } (from regression.js `ols`).
export function buildAlphaEntry(symbol, fit) {
  if (!fit) return { symbol, available: false };
  const sig = alphaSignal(fit.interceptT);
  return {
    symbol,
    available: true,
    alphaAnnual: annualizeAlpha(fit.intercept),
    alphaT: fit.interceptT == null ? null : +fit.interceptT.toFixed(2),
    rSquared: fit.r2 == null ? null : +fit.r2.toFixed(3),
    observations: fit.n,
    direction: sig.direction,
    significant: sig.significant,
    strength: +sig.strength.toFixed(3),
  };
}

// Rank screen entries: significant first, then by descending alpha t-stat.
export function rankByAlpha(entries) {
  return entries
    .filter(e => e.available)
    .sort((a, b) => (b.significant - a.significant) || ((b.alphaT ?? -99) - (a.alphaT ?? -99)));
}
