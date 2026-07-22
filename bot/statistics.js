// ---------------------------------------------------------------------------
// Backtest performance statistics, including overfitting guards.
//
// The plain metrics (Sharpe, CAGR, drawdown) describe what a strategy did on
// one sample of history. They say nothing about whether that result survives
// out of sample. The guards below — Probabilistic and Deflated Sharpe, and
// Probability of Backtest Overfitting — are what turn a number into evidence.
//
// References:
//   Bailey & López de Prado (2012), "The Sharpe Ratio Efficient Frontier"
//   Bailey & López de Prado (2014), "The Deflated Sharpe Ratio"
//   Bailey, Borwein, López de Prado & Zhu (2017), "The Probability of
//   Backtest Overfitting" (CSCV)
// ---------------------------------------------------------------------------

import { normCdf } from '../blackscholes.js';

const EULER_MASCHERONI = 0.5772156649015329;

export const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

export function stdev(a, sample = true) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - (sample ? 1 : 0)));
}

export function skewness(a) {
  const n = a.length;
  if (n < 3) return 0;
  const m = mean(a), sd = stdev(a, false);
  if (!sd) return 0;
  return a.reduce((s, v) => s + ((v - m) / sd) ** 3, 0) / n;
}

/** Non-excess (Pearson) kurtosis — 3.0 for a normal distribution. */
export function kurtosis(a) {
  const n = a.length;
  if (n < 4) return 3;
  const m = mean(a), sd = stdev(a, false);
  if (!sd) return 3;
  return a.reduce((s, v) => s + ((v - m) / sd) ** 4, 0) / n;
}

/** Inverse standard normal CDF (Acklam's rational approximation). */
export function invNorm(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

/** Per-period Sharpe. rf is the per-period risk-free rate. */
export function sharpe(returns, rf = 0) {
  if (returns.length < 2) return 0;
  const sd = stdev(returns);
  return sd ? (mean(returns) - rf) / sd : 0;
}

/** Sortino — penalises downside deviation only. */
export function sortino(returns, rf = 0) {
  if (returns.length < 2) return 0;
  const downside = returns.filter(r => r < rf).map(r => (r - rf) ** 2);
  if (!downside.length) return Infinity;
  const dd = Math.sqrt(downside.reduce((a, b) => a + b, 0) / returns.length);
  return dd ? (mean(returns) - rf) / dd : 0;
}

/** Max peak-to-trough decline of an equity curve, as a positive fraction. */
export function maxDrawdown(equity) {
  let peak = -Infinity, maxDd = 0, peakIdx = 0, troughIdx = 0, curPeak = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) { peak = equity[i]; curPeak = i; }
    const dd = peak > 0 ? (peak - equity[i]) / peak : 0;
    if (dd > maxDd) { maxDd = dd; peakIdx = curPeak; troughIdx = i; }
  }
  return { maxDrawdown: maxDd, peakIndex: peakIdx, troughIndex: troughIdx };
}

/**
 * Probabilistic Sharpe Ratio — probability the true Sharpe exceeds a
 * benchmark, correcting for skew, fat tails and sample length.
 *
 * A high Sharpe from a short, negatively-skewed series is far weaker evidence
 * than the raw number suggests; this is what says so.
 */
export function probabilisticSharpe(observedSR, benchmarkSR, n, skew, kurt) {
  if (n < 2) return null;
  const denom = 1 - skew * observedSR + ((kurt - 1) / 4) * observedSR * observedSR;
  if (denom <= 0) return null;
  return normCdf(((observedSR - benchmarkSR) * Math.sqrt(n - 1)) / Math.sqrt(denom));
}

/**
 * Expected maximum Sharpe achievable by chance across N independent trials.
 *
 * This is the number people forget. Try enough variants and one will look
 * excellent purely by luck; this is how good "lucky" looks.
 */
export function expectedMaxSharpe(nTrials, sharpeVariance) {
  if (nTrials < 2) return 0;
  const sd = Math.sqrt(Math.max(sharpeVariance, 0));
  if (!sd) return 0;
  const a = invNorm(1 - 1 / nTrials);
  const b = invNorm(1 - 1 / (nTrials * Math.E));
  return sd * ((1 - EULER_MASCHERONI) * a + EULER_MASCHERONI * b);
}

/**
 * Deflated Sharpe Ratio — PSR benchmarked against the expected maximum from
 * nTrials. Below ~0.95 the result is not distinguishable from selection luck.
 */
export function deflatedSharpe(returns, nTrials, sharpeVariance = null) {
  if (returns.length < 4) return null;
  const sr = sharpe(returns);
  const sk = skewness(returns);
  const ku = kurtosis(returns);
  // Without a spread of trial Sharpes, fall back to the sampling variance of
  // the estimator itself, which is the conservative default.
  const variance = sharpeVariance != null
    ? sharpeVariance
    : (1 + 0.5 * sr * sr) / (returns.length - 1);
  const sr0 = expectedMaxSharpe(nTrials, variance);
  const dsr = probabilisticSharpe(sr, sr0, returns.length, sk, ku);
  return { sharpe: sr, expectedMaxSharpe: sr0, deflatedSharpe: dsr, skew: sk, kurtosis: ku, nTrials };
}

/**
 * Probability of Backtest Overfitting via Combinatorially Symmetric
 * Cross-Validation.
 *
 * Takes a matrix of per-period returns, one row per strategy variant. Splits
 * the timeline into S blocks, and for every way of choosing half the blocks as
 * in-sample, picks the variant that won in-sample and measures where it ranks
 * out-of-sample. PBO is the share of splits where the in-sample winner lands
 * in the bottom half out of sample.
 *
 * A PBO near 0.5 means selecting the best backtest is no better than a coin
 * flip — the classic signature of overfitting.
 */
export function probabilityOfBacktestOverfitting(returnsMatrix, blocks = 8) {
  const nStrat = returnsMatrix.length;
  if (nStrat < 2) return null;
  const T = Math.min(...returnsMatrix.map(r => r.length));
  if (T < blocks * 2) return null;

  const S = blocks % 2 === 0 ? blocks : blocks - 1;
  const blockSize = Math.floor(T / S);
  const blockIdx = Array.from({ length: S }, (_, i) => i);

  // All ways of choosing S/2 blocks as in-sample.
  const combos = [];
  const choose = (start, acc) => {
    if (acc.length === S / 2) { combos.push([...acc]); return; }
    for (let i = start; i < S; i++) { acc.push(i); choose(i + 1, acc); acc.pop(); }
  };
  choose(0, []);

  const sliceBlocks = (row, blocksWanted) => {
    const out = [];
    for (const b of blocksWanted) {
      out.push(...row.slice(b * blockSize, (b + 1) * blockSize));
    }
    return out;
  };

  let overfitCount = 0;
  const logits = [];

  for (const inSample of combos) {
    const outSample = blockIdx.filter(b => !inSample.includes(b));

    const isSharpes = returnsMatrix.map(r => sharpe(sliceBlocks(r, inSample)));
    const oosSharpes = returnsMatrix.map(r => sharpe(sliceBlocks(r, outSample)));

    // The variant that looked best in sample.
    let best = 0;
    for (let i = 1; i < nStrat; i++) if (isSharpes[i] > isSharpes[best]) best = i;

    // Its rank out of sample (1 = worst).
    const rank = oosSharpes.filter(s => s <= oosSharpes[best]).length;
    const relRank = rank / (nStrat + 1);
    // Guard the logit against 0/1.
    const w = Math.min(Math.max(relRank, 1e-6), 1 - 1e-6);
    logits.push(Math.log(w / (1 - w)));
    if (relRank <= 0.5) overfitCount++;
  }

  return {
    pbo: overfitCount / combos.length,
    splits: combos.length,
    medianLogit: logits.sort((a, b) => a - b)[Math.floor(logits.length / 2)],
  };
}

/** Full performance summary for one equity curve. */
export function summarise(equityCurve, periodReturns, periodsPerYear = 252, rfAnnual = 0.045) {
  const n = periodReturns.length;
  if (!n || equityCurve.length < 2) return null;

  const start = equityCurve[0], end = equityCurve[equityCurve.length - 1];
  const years = n / periodsPerYear;
  const totalReturn = (end - start) / start;
  const cagr = years > 0 && start > 0 ? Math.pow(end / start, 1 / years) - 1 : 0;

  const rfPeriod = rfAnnual / periodsPerYear;
  const sr = sharpe(periodReturns, rfPeriod);
  const so = sortino(periodReturns, rfPeriod);
  const dd = maxDrawdown(equityCurve);
  const vol = stdev(periodReturns) * Math.sqrt(periodsPerYear);

  const wins = periodReturns.filter(r => r > 0);
  const losses = periodReturns.filter(r => r < 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));

  return {
    totalReturn: +(totalReturn * 100).toFixed(2),
    cagr: +(cagr * 100).toFixed(2),
    volatility: +(vol * 100).toFixed(2),
    // Annualise Sharpe/Sortino from per-period values.
    sharpe: +(sr * Math.sqrt(periodsPerYear)).toFixed(3),
    sortino: Number.isFinite(so) ? +(so * Math.sqrt(periodsPerYear)).toFixed(3) : null,
    maxDrawdown: +(dd.maxDrawdown * 100).toFixed(2),
    // Return earned per unit of worst-case pain.
    calmar: dd.maxDrawdown > 0 ? +(cagr / dd.maxDrawdown).toFixed(3) : null,
    winRate: +((wins.length / n) * 100).toFixed(1),
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(3) : null,
    periods: n,
    years: +years.toFixed(2),
  };
}
