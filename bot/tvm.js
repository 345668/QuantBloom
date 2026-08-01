// ---------------------------------------------------------------------------
// Time Value of Money — present/future value, NPV, IRR, and rate conversions.
//
// Clean-room implementation of the standard formulas taught in the course
// materials (TVM / NPV / Interest Rates). Every function supports a compounding
// frequency m (1 = annual, 2 = semi-annual, 4 = quarterly, 12 = monthly …),
// matching present_value(fv, rate, nper, m) / future_value(pv, rate, nper, m).
//
// Pure and unit-tested against the course's own worked answers.
// ---------------------------------------------------------------------------

/** Future value of a single present sum. FV = PV·(1 + r/m)^(n·m). */
export function futureValue(pv, rate, nper, m = 1) {
  return pv * Math.pow(1 + rate / m, nper * m);
}

/** Present value of a single future sum. PV = FV / (1 + r/m)^(n·m). */
export function presentValue(fv, rate, nper, m = 1) {
  return fv / Math.pow(1 + rate / m, nper * m);
}

/**
 * Net present value of a cash-flow series, discounted at `rate` per period.
 * values[0] is t=0 (usually the initial outlay, negative). NPV = Σ CFᵢ/(1+r)ⁱ.
 */
export function npv(rate, values) {
  let acc = 0;
  for (let i = 0; i < values.length; i++) acc += values[i] / Math.pow(1 + rate, i);
  return acc;
}

/**
 * Internal rate of return: the discount rate that sets NPV to zero. Newton-
 * Raphson from a guess, falling back to bisection if the derivative misbehaves
 * or the root is jumped over. Returns null if no sign change brackets a root.
 */
export function irr(values, guess = 0.1) {
  const dNpv = (rate) => {
    let d = 0;
    for (let i = 1; i < values.length; i++) d -= (i * values[i]) / Math.pow(1 + rate, i + 1);
    return d;
  };

  // Newton-Raphson.
  let r = guess;
  for (let iter = 0; iter < 100; iter++) {
    const f = npv(r, values);
    if (Math.abs(f) < 1e-9) return r;
    const d = dNpv(r);
    if (Math.abs(d) < 1e-12) break;
    const next = r - f / d;
    if (!isFinite(next) || next <= -1) break;
    if (Math.abs(next - r) < 1e-12) return next;
    r = next;
  }

  // Bisection fallback: scan for a sign change, then narrow.
  let lo = -0.9999, hi = 10, flo = npv(lo, values), fhi = npv(hi, values);
  if (flo * fhi > 0) {
    // Widen the search across [-0.99, 100] for an odd-shaped series.
    let bracketed = false;
    let prev = -0.99, fprev = npv(prev, values);
    for (let x = -0.9; x <= 100; x += 0.05) {
      const fx = npv(x, values);
      if (fprev * fx <= 0) { lo = prev; hi = x; flo = fprev; fhi = fx; bracketed = true; break; }
      prev = x; fprev = fx;
    }
    if (!bracketed) return null;
  }
  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid, values);
    if (Math.abs(fm) < 1e-10) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/** Effective annual rate from a nominal rate compounded m times a year. */
export function effectiveRate(nominal, m = 1) {
  return Math.pow(1 + nominal / m, m) - 1;
}

/** Nominal annual rate (compounded m/year) that yields a given effective rate. */
export function nominalRate(effective, m = 1) {
  return m * (Math.pow(1 + effective, 1 / m) - 1);
}

/**
 * Present value of a level annuity: `pmt` each period for n periods.
 * PV = pmt · (1 − (1+i)^-N) / i, with i = rate/m and N = nper·m.
 */
export function annuityPV(pmt, rate, nper, m = 1) {
  const i = rate / m, N = nper * m;
  if (i === 0) return pmt * N;
  return pmt * (1 - Math.pow(1 + i, -N)) / i;
}

/** Future value of a level annuity. FV = pmt · ((1+i)^N − 1) / i. */
export function annuityFV(pmt, rate, nper, m = 1) {
  const i = rate / m, N = nper * m;
  if (i === 0) return pmt * N;
  return pmt * (Math.pow(1 + i, N) - 1) / i;
}
