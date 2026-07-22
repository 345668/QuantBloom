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
  'bbPosition',                 // position within Bollinger band [0,1]
  'adx',                        // trend strength / 100
  'atrPct',                     // ATR(14) / price
  'volumeRatio',                // volume / 20-bar avg
  'volatility',                 // stdev of last 20 returns
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
  const adxv = adx(highs, lows, closes, 14);
  const atrv = atr(highs, lows, closes, 14);
  const rsiv = rsi(closes, 14);
  const avgVol = sma(vols, 20);

  const recentReturns = [];
  for (let i = closes.length - 20; i < closes.length; i++) {
    if (i > 0 && closes[i - 1]) recentReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  const vec = [
    pctReturn(price, closes[closes.length - 2]),
    pctReturn(price, closes[closes.length - 6]),
    pctReturn(price, closes[closes.length - 11]),
    rsiv != null ? rsiv / 100 : 0.5,
    md ? md.histogram / price : 0,
    sma20 ? price / sma20 - 1 : 0,
    sma50 ? price / sma50 - 1 : 0,
    bb && bb.upper !== bb.lower ? (price - bb.lower) / (bb.upper - bb.lower) : 0.5,
    adxv ? adxv.adx / 100 : 0,
    atrv ? atrv / price : 0,
    avgVol ? (vols[vols.length - 1] || 0) / avgVol : 1,
    stdev20(recentReturns),
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

/**
 * Build an aligned training set (X, y) from a candle series.
 *
 * Rows are ordered oldest-first and each row's features are strictly
 * point-in-time. Only rows whose label is fully determined (enough future
 * bars) are included.
 */
export function buildDataset(candles, labelConfig = {}) {
  const X = [], y = [], times = [];
  const warmup = 50;
  const horizon = labelConfig.horizon || 10;

  for (let t = warmup; t < candles.length - horizon; t++) {
    const feat = featuresAt(candles, t);
    const label = tripleBarrierLabel(candles, t, labelConfig);
    if (feat && label != null) {
      X.push(feat);
      y.push(label);
      times.push(candles[t].time);
    }
  }

  return { X, y, times, featureNames: FEATURE_NAMES };
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
