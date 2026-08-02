// ---------------------------------------------------------------------------
// Feature engineering and labeling for market-prediction models.
//
// Two ideas borrowed from the ML4T ecosystem (ml4t-engineer):
//
//  1. POINT-IN-TIME FEATURES. Every feature at bar t is computable from bars
//     [0..t] only. This is enforced by construction — the same discipline the
//     backtester relies on — so a model trained here can be evaluated honestly.
//
//  2. TRIPLE-BARRIER LABELING (López de Prado). Instead of "did price rise over
//     the next N days?", label by which barrier is hit FIRST: an up target, a
//     down stop, or a time limit. This matches how a trade actually ends and
//     produces a far more meaningful target than a fixed-horizon return.
// ---------------------------------------------------------------------------

import { rsi, macd, bollinger, adx, atr, sma } from './indicators.js';

export const FEATURE_NAMES = [
  'ret1', 'ret5', 'ret10',      // momentum over 1/5/10 bars
  'rsi',                        // RSI(14) scaled to [0,1]
  'macdHist',                   // MACD histogram / price
  'priceVsSma20',               // close/SMA20 - 1
  'priceVsSma50',               // close/SMA50 - 1
  'priceVsSma200',              // close/SMA200 - 1 (long-term regime)
  'bbPosition',                 // position within Bollinger band [0,1]
  'adx',                        // trend strength / 100
  'atrPct',                     // ATR(14) / price
  'volumeRatio',                // volume / 20-bar avg
  'volatility',                 // stdev of last 20 returns
  'roc20',                      // 20-bar rate of change
  'distFrom120High',            // distance below the 120-bar high (<= 0)
  'distFrom120Low',             // distance above the 120-bar low (>= 0)
  'sma20Slope',                 // 5-bar slope of SMA20 / price
  'rsiSlope',                   // change in RSI over 5 bars
  'volRegime',                  // short vol / long vol (expansion > 1)
];

const pctReturn = (a, b) => (a && b) ? (a - b) / b : 0;

function stdev20(returns) {
  if (returns.length < 2) return 0;
  const m = returns.reduce((s, v) => s + v, 0) / returns.length;
  return Math.sqrt(returns.reduce((s, v) => s + (v - m) ** 2, 0) / returns.length);
}

/**
 * Feature vector for the decision made at bar index `t`, using ONLY bars
 * [0..t]. Returns null if there is not enough history for a full vector.
 */
export function featuresAt(candles, t) {
  if (t < 50) return null;
  const window = candles.slice(0, t + 1);
  const closes = window.map(c => c.close);
  const highs = window.map(c => c.high);
  const lows = window.map(c => c.low);
  const vols = window.map(c => c.volume || 0);
  const price = closes[closes.length - 1];
  if (!price) return null;

  const bb = bollinger(closes, 20, 2);
  const md = macd(closes);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const adxv = adx(highs, lows, closes, 14);
  const atrv = atr(highs, lows, closes, 14);
  const rsiv = rsi(closes, 14);
  const avgVol = sma(vols, 20);

  const returnsFrom = (fromIdx) => {
    const out = [];
    for (let i = fromIdx; i < closes.length; i++) {
      if (i > 0 && closes[i - 1]) out.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    return out;
  };
  const recentReturns = returnsFrom(closes.length - 20);

  // 120-bar (≈6 month) range position — where price sits in its recent range.
  const lookback = Math.min(120, highs.length);
  const hi120 = Math.max(...highs.slice(-lookback));
  const lo120 = Math.min(...lows.slice(-lookback));

  // 5-bar SMA20 slope: is the trend accelerating?
  const sma20Prev = sma(closes.slice(0, closes.length - 5), 20);
  const sma20Slope = (sma20 != null && sma20Prev != null) ? (sma20 - sma20Prev) / price : 0;

  // RSI momentum.
  const rsiPrev = rsi(closes.slice(0, closes.length - 5), 14);
  const rsiSlope = (rsiv != null && rsiPrev != null) ? (rsiv - rsiPrev) / 100 : 0;

  // Volatility regime: recent 10-bar vol vs the prior 20-bar vol.
  const shortVol = stdev20(returnsFrom(closes.length - 10));
  const longVol = stdev20(returnsFrom(closes.length - 40));
  const volRegime = longVol > 0 ? shortVol / longVol : 1;

  const vec = [
    pctReturn(price, closes[closes.length - 2]),
    pctReturn(price, closes[closes.length - 6]),
    pctReturn(price, closes[closes.length - 11]),
    rsiv != null ? rsiv / 100 : 0.5,
    md ? md.histogram / price : 0,
    sma20 ? price / sma20 - 1 : 0,
    sma50 ? price / sma50 - 1 : 0,
    sma200 ? price / sma200 - 1 : 0,
    bb && bb.upper !== bb.lower ? (price - bb.lower) / (bb.upper - bb.lower) : 0.5,
    adxv ? adxv.adx / 100 : 0,
    atrv ? atrv / price : 0,
    avgVol ? (vols[vols.length - 1] || 0) / avgVol : 1,
    stdev20(recentReturns),
    pctReturn(price, closes[closes.length - 21]),
    hi120 > 0 ? (price - hi120) / hi120 : 0,
    lo120 > 0 ? (price - lo120) / lo120 : 0,
    sma20Slope,
    rsiSlope,
    volRegime,
  ];

  // Guard against any NaN/Infinity leaking into training.
  return vec.map(v => (Number.isFinite(v) ? v : 0));
}

/**
 * Triple-barrier label for a long entered at the close of bar `t`.
 *
 * @returns 1 if the up-barrier is hit before the down-barrier within `horizon`
 *          bars, else 0. A time-barrier exit is labeled by the sign of the
 *          final return. Returns null if there is not enough FUTURE data —
 *          those bars cannot be labeled and must be excluded from training.
 */
export function tripleBarrierLabel(candles, t, { up = 0.03, down = 0.02, horizon = 10 } = {}) {
  const entry = candles[t]?.close;
  if (!entry) return null;
  if (t + horizon >= candles.length) return null; // not enough future to label

  const upBarrier = entry * (1 + up);
  const downBarrier = entry * (1 - down);

  for (let i = t + 1; i <= t + horizon; i++) {
    const bar = candles[i];
    if (!bar) break;
    // A conservative reading: if the bar's range straddles both barriers, treat
    // the stop as hit first (the pessimistic assumption for a long).
    if (bar.low <= downBarrier) return 0;
    if (bar.high >= upBarrier) return 1;
  }
  // Time barrier: label by realised direction at the horizon.
  const exit = candles[t + horizon].close;
  return exit > entry ? 1 : 0;
}

// --- Cross-asset / market-relative features --------------------------------
//
// A stock's move relative to the market carries information its own history does
// not: whether it is leading or lagging, its beta, and the volatility regime.
// These are computed against a benchmark close series (e.g. SPY) aligned to the
// stock's bars, strictly point-in-time.

export const MARKET_FEATURE_NAMES = [
  'excessRet1',    // stock 1-bar return minus the benchmark's
  'excessRet5',    // 5-bar excess return
  'relStrength20', // 20-bar return minus the benchmark's (relative strength)
  'beta60',        // 60-bar beta to the benchmark
  'corr60',        // 60-bar return correlation to the benchmark
];

/**
 * Align a benchmark candle series to a stock's candle times: returns an array
 * of benchmark closes the same length as `candles`, carrying the last known
 * close forward across any gaps. Entries before the first match are null.
 */
export function alignBenchmark(candles, benchCandles) {
  const byTime = new Map(benchCandles.map(c => [c.time, c.close]));
  let last = null;
  return candles.map(c => {
    if (byTime.has(c.time)) last = byTime.get(c.time);
    return last;
  });
}

const retAt = (arr, i, lag) => (i - lag >= 0 && arr[i - lag]) ? arr[i] / arr[i - lag] - 1 : 0;

/** Market-relative features at bar t, using benchmark closes aligned to `candles`. */
export function marketFeaturesAt(candles, benchCloses, t) {
  const closes = candles.map(c => c.close);
  const b = benchCloses;
  // Without an aligned benchmark value, contribute neutral zeros.
  if (!b || b[t] == null || t < 60) return MARKET_FEATURE_NAMES.map(() => 0);

  const excessRet1 = retAt(closes, t, 1) - retAt(b, t, 1);
  const excessRet5 = retAt(closes, t, 5) - retAt(b, t, 5);
  const relStrength20 = retAt(closes, t, 20) - retAt(b, t, 20);

  // 60-bar beta and correlation from daily returns.
  const sr = [], br = [];
  for (let i = t - 59; i <= t; i++) {
    if (b[i - 1] == null || b[i] == null) continue;
    sr.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    br.push((b[i] - b[i - 1]) / b[i - 1]);
  }
  let beta = 0, corr = 0;
  if (sr.length > 5) {
    const ms = sr.reduce((a, x) => a + x, 0) / sr.length;
    const mb = br.reduce((a, x) => a + x, 0) / br.length;
    let cov = 0, vb = 0, vs = 0;
    for (let i = 0; i < sr.length; i++) {
      cov += (sr[i] - ms) * (br[i] - mb);
      vb += (br[i] - mb) ** 2;
      vs += (sr[i] - ms) ** 2;
    }
    beta = vb > 0 ? cov / vb : 0;
    corr = (vb > 0 && vs > 0) ? cov / Math.sqrt(vb * vs) : 0;
  }
  return [excessRet1, excessRet5, relStrength20, beta, corr].map(v => (Number.isFinite(v) ? v : 0));
}

/**
 * Build an aligned training set (X, y) from a candle series.
 *
 * Rows are ordered oldest-first and each row's features are strictly
 * point-in-time. Only rows whose label is fully determined (enough future
 * bars) are included. When `benchCandles` is supplied, cross-asset market-
 * relative features are appended and the returned featureNames reflect that.
 */
export function buildDataset(candles, labelConfig = {}, benchCandles = null) {
  const X = [], y = [], times = [];
  // 200 bars so the SMA200 and long-lookback features are fully formed from the
  // first training row — degraded early features are just noise to the model.
  const warmup = 200;
  const horizon = labelConfig.horizon || 10;
  const benchCloses = benchCandles ? alignBenchmark(candles, benchCandles) : null;
  const featureNames = benchCloses ? [...FEATURE_NAMES, ...MARKET_FEATURE_NAMES] : FEATURE_NAMES;

  for (let t = warmup; t < candles.length - horizon; t++) {
    let feat = featuresAt(candles, t);
    const label = tripleBarrierLabel(candles, t, labelConfig);
    if (feat && label != null) {
      if (benchCloses) feat = feat.concat(marketFeaturesAt(candles, benchCloses, t));
      X.push(feat);
      y.push(label);
      times.push(candles[t].time);
    }
  }

  return { X, y, times, featureNames };
}

/**
 * Temporal train/test split. NEVER shuffle time series before splitting —
 * random folds leak future information through adjacent rows. The test set is
 * always the most recent slice.
 */
export function temporalSplit(dataset, testFraction = 0.3) {
  const n = dataset.X.length;
  const cut = Math.floor(n * (1 - testFraction));
  return {
    train: { X: dataset.X.slice(0, cut), y: dataset.y.slice(0, cut) },
    test: { X: dataset.X.slice(cut), y: dataset.y.slice(cut), times: dataset.times.slice(cut) },
    featureNames: dataset.featureNames,
    splitIndex: cut,
  };
}
