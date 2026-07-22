// ---------------------------------------------------------------------------
// Black-Scholes option pricing, Greeks, and implied volatility.
//
// Conventions used throughout:
//   S = spot price, K = strike, T = time to expiry in YEARS,
//   r = risk-free rate (decimal, e.g. 0.045), sigma = volatility (decimal),
//   q = continuous dividend yield (decimal).
// Greeks are returned in their conventional trader-facing units:
//   delta per $1, gamma per $1, vega per 1 vol POINT (not per 1.0 of sigma),
//   theta per CALENDAR DAY, rho per 1 percentage point of rates.
// ---------------------------------------------------------------------------

// Standard normal PDF.
export function normPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Standard normal CDF via Abramowitz & Stegun 7.1.26 (|error| < 7.5e-8).
export function normCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

function d1d2(S, K, T, r, sigma, q = 0) {
  const vt = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / vt;
  return { d1, d2: d1 - vt, vt };
}

export function bsPrice(type, S, K, T, r, sigma, q = 0) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    // At/after expiry the option is worth its intrinsic value.
    const intrinsic = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return intrinsic;
  }
  const { d1, d2 } = d1d2(S, K, T, r, sigma, q);
  const dfR = Math.exp(-r * T), dfQ = Math.exp(-q * T);
  return type === 'call'
    ? S * dfQ * normCdf(d1) - K * dfR * normCdf(d2)
    : K * dfR * normCdf(-d2) - S * dfQ * normCdf(-d1);
}

export function greeks(type, S, K, T, r, sigma, q = 0) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    return { delta: null, gamma: null, vega: null, theta: null, rho: null };
  }
  const { d1, d2 } = d1d2(S, K, T, r, sigma, q);
  const dfR = Math.exp(-r * T), dfQ = Math.exp(-q * T);
  const pdf = normPdf(d1);
  const sqrtT = Math.sqrt(T);

  const delta = type === 'call' ? dfQ * normCdf(d1) : dfQ * (normCdf(d1) - 1);
  const gamma = (dfQ * pdf) / (S * sigma * sqrtT);
  // Vega is per 1.0 of sigma; divide by 100 to quote per vol point.
  const vega = (S * dfQ * pdf * sqrtT) / 100;

  const termA = -(S * dfQ * pdf * sigma) / (2 * sqrtT);
  const thetaAnnual = type === 'call'
    ? termA - r * K * dfR * normCdf(d2) + q * S * dfQ * normCdf(d1)
    : termA + r * K * dfR * normCdf(-d2) - q * S * dfQ * normCdf(-d1);
  // Quote theta per calendar day.
  const theta = thetaAnnual / 365;

  // Rho per 1 percentage point move in rates.
  const rho = (type === 'call'
    ? K * T * dfR * normCdf(d2)
    : -K * T * dfR * normCdf(-d2)) / 100;

  return {
    delta: +delta.toFixed(4), gamma: +gamma.toFixed(6),
    vega: +vega.toFixed(4), theta: +theta.toFixed(4), rho: +rho.toFixed(4),
  };
}

/**
 * Implied volatility by Newton-Raphson with a bisection fallback.
 *
 * Newton converges fast but can diverge when vega is tiny (deep ITM/OTM or
 * near expiry), so we bracket-and-bisect if it misbehaves.
 */
export function impliedVol(type, marketPrice, S, K, T, r, q = 0) {
  if (T <= 0 || marketPrice <= 0 || S <= 0 || K <= 0) return null;

  const intrinsic = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
  if (marketPrice < intrinsic - 1e-6) return null; // arbitrage / bad quote

  let sigma = 0.25;
  for (let i = 0; i < 50; i++) {
    const price = bsPrice(type, S, K, T, r, sigma, q);
    const diff = price - marketPrice;
    if (Math.abs(diff) < 1e-6) return +sigma.toFixed(6);
    // Vega here is per 1.0 of sigma (undo the /100 used for display).
    const v = greeks(type, S, K, T, r, sigma, q).vega * 100;
    if (!v || !isFinite(v) || v < 1e-8) break;
    const next = sigma - diff / v;
    if (!isFinite(next) || next <= 0 || next > 10) break;
    sigma = next;
  }

  // Bisection fallback over a wide, economically sane range.
  let lo = 1e-4, hi = 10;
  if (bsPrice(type, S, K, T, r, hi, q) < marketPrice) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (bsPrice(type, S, K, T, r, mid, q) < marketPrice) lo = mid; else hi = mid;
    if (hi - lo < 1e-7) break;
  }
  const out = (lo + hi) / 2;
  return out > 9.99 ? null : +out.toFixed(6);
}

/** Years between now and an expiry given as a unix seconds timestamp. */
export function yearsToExpiry(expirySeconds, nowMs = Date.now()) {
  return Math.max((expirySeconds * 1000 - nowMs) / (365 * 24 * 3600 * 1000), 0);
}
