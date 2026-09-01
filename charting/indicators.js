// ---------------------------------------------------------------------------
// Indicator series library for charting.
//
// The bot's indicators.js computes point-in-time SNAPSHOTS (the latest value)
// for signals. Charting needs full SERIES to plot, so these are separate,
// series-returning implementations. Every function takes candles
// ([{time,open,high,low,close,volume}], oldest first) and returns line data
// as [{time,value}] — or, for multi-line indicators, an object of such arrays.
//
// Standard constructions, clean-room, tested.
// ---------------------------------------------------------------------------

const closes = c => c.map(x => x.close);

// --- Moving averages (price overlays) --------------------------------------

export function sma(candles, period = 20) {
  const cl = closes(candles), out = [];
  for (let i = period - 1; i < cl.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += cl[j];
    out.push({ time: candles[i].time, value: s / period });
  }
  return out;
}

export function ema(candles, period = 20) {
  const cl = closes(candles), out = [];
  if (cl.length < period) return out;
  const k = 2 / (period + 1);
  let e = cl.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push({ time: candles[period - 1].time, value: e });
  for (let i = period; i < cl.length; i++) {
    e = cl[i] * k + e * (1 - k);
    out.push({ time: candles[i].time, value: e });
  }
  return out;
}

export function wma(candles, period = 20) {
  const cl = closes(candles), out = [], denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < cl.length; i++) {
    let s = 0;
    for (let j = 0; j < period; j++) s += cl[i - period + 1 + j] * (j + 1);
    out.push({ time: candles[i].time, value: s / denom });
  }
  return out;
}

/** Anchored VWAP — cumulative from the first visible bar (a legitimate,
 *  session-agnostic construction; true session VWAP needs intraday data). */
export function vwap(candles) {
  const out = [];
  let cumPV = 0, cumV = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    const v = c.volume || 0;
    cumPV += tp * v; cumV += v;
    out.push({ time: c.time, value: cumV ? cumPV / cumV : c.close });
  }
  return out;
}

// --- Volatility bands (price overlays) -------------------------------------

function atrSeries(candles, period = 14) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    ));
  }
  // Wilder's smoothing.
  const out = [];
  if (trs.length < period) return out;
  let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  out.push({ time: candles[period].time, value: a });
  for (let i = period; i < trs.length; i++) {
    a = (a * (period - 1) + trs[i]) / period;
    out.push({ time: candles[i + 1].time, value: a });
  }
  return out;
}
export const atr = atrSeries;

export function bollinger(candles, period = 20, mult = 2) {
  const upper = [], middle = [], lower = [];
  const cl = closes(candles);
  for (let i = period - 1; i < cl.length; i++) {
    const slice = cl.slice(i - period + 1, i + 1);
    const m = slice.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - m) ** 2, 0) / period);
    const t = candles[i].time;
    middle.push({ time: t, value: m });
    upper.push({ time: t, value: m + mult * sd });
    lower.push({ time: t, value: m - mult * sd });
  }
  return { upper, middle, lower };
}

export function keltner(candles, period = 20, mult = 2) {
  const mid = ema(candles, period);
  const a = atrSeries(candles, period);
  const aByTime = new Map(a.map(p => [p.time, p.value]));
  const upper = [], lower = [], middle = [];
  for (const m of mid) {
    const av = aByTime.get(m.time);
    if (av == null) continue;
    middle.push(m);
    upper.push({ time: m.time, value: m.value + mult * av });
    lower.push({ time: m.time, value: m.value - mult * av });
  }
  return { upper, middle, lower };
}

export function donchian(candles, period = 20) {
  const upper = [], lower = [], middle = [];
  for (let i = period - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    const t = candles[i].time;
    upper.push({ time: t, value: hi });
    lower.push({ time: t, value: lo });
    middle.push({ time: t, value: (hi + lo) / 2 });
  }
  return { upper, middle, lower };
}

/** Parabolic SAR (Wilder). Returns dots as a line series of stop levels. */
export function parabolicSAR(candles, step = 0.02, maxAf = 0.2) {
  if (candles.length < 2) return [];
  const out = [];
  let up = candles[1].close >= candles[0].close;
  let sar = up ? candles[0].low : candles[0].high;
  let ep = up ? candles[0].high : candles[0].low;
  let af = step;
  for (let i = 1; i < candles.length; i++) {
    sar = sar + af * (ep - sar);
    if (up) {
      sar = Math.min(sar, candles[i - 1].low, candles[i > 1 ? i - 2 : i - 1].low);
      if (candles[i].high > ep) { ep = candles[i].high; af = Math.min(af + step, maxAf); }
      if (candles[i].low < sar) { up = false; sar = ep; ep = candles[i].low; af = step; }
    } else {
      sar = Math.max(sar, candles[i - 1].high, candles[i > 1 ? i - 2 : i - 1].high);
      if (candles[i].low < ep) { ep = candles[i].low; af = Math.min(af + step, maxAf); }
      if (candles[i].high > sar) { up = true; sar = ep; ep = candles[i].high; af = step; }
    }
    out.push({ time: candles[i].time, value: sar });
  }
  return out;
}

/** SuperTrend — ATR-banded trend line. */
export function superTrend(candles, period = 10, mult = 3) {
  const a = atrSeries(candles, period);
  const aByTime = new Map(a.map(p => [p.time, p.value]));
  const out = [];
  let prevUpper = null, prevLower = null, prevST = null, prevClose = null, uptrend = true;
  for (const c of candles) {
    const av = aByTime.get(c.time);
    if (av == null) { prevClose = c.close; continue; }
    const mid = (c.high + c.low) / 2;
    let upperBand = mid + mult * av;
    let lowerBand = mid - mult * av;
    if (prevUpper != null) {
      upperBand = (upperBand < prevUpper || prevClose > prevUpper) ? upperBand : prevUpper;
      lowerBand = (lowerBand > prevLower || prevClose < prevLower) ? lowerBand : prevLower;
    }
    if (prevST == null) uptrend = true;
    else if (prevST === prevUpper) uptrend = c.close > upperBand;
    else uptrend = c.close > lowerBand ? true : false;
    const st = uptrend ? lowerBand : upperBand;
    out.push({ time: c.time, value: st });
    prevUpper = upperBand; prevLower = lowerBand; prevST = st; prevClose = c.close;
  }
  return out;
}

// --- Oscillators (sub-pane) ------------------------------------------------

export function rsi(candles, period = 14) {
  const cl = closes(candles), out = [];
  if (cl.length < period + 1) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = cl[i] - cl[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgG = gain / period, avgL = loss / period;
  const rs0 = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  out.push({ time: candles[period].time, value: rs0 });
  for (let i = period + 1; i < cl.length; i++) {
    const d = cl[i] - cl[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
    out.push({ time: candles[i].time, value: avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL) });
  }
  return out;
}

export function macd(candles, fast = 12, slow = 26, signal = 9) {
  const ef = ema(candles, fast), es = ema(candles, slow);
  const efByTime = new Map(ef.map(p => [p.time, p.value]));
  const macdLine = [];
  for (const s of es) {
    const f = efByTime.get(s.time);
    if (f != null) macdLine.push({ time: s.time, value: f - s.value });
  }
  // Signal = EMA of the MACD line.
  const sig = [];
  if (macdLine.length >= signal) {
    const k = 2 / (signal + 1);
    let e = macdLine.slice(0, signal).reduce((a, b) => a + b.value, 0) / signal;
    sig.push({ time: macdLine[signal - 1].time, value: e });
    for (let i = signal; i < macdLine.length; i++) {
      e = macdLine[i].value * k + e * (1 - k);
      sig.push({ time: macdLine[i].time, value: e });
    }
  }
  const sigByTime = new Map(sig.map(p => [p.time, p.value]));
  const hist = macdLine.filter(p => sigByTime.has(p.time))
    .map(p => ({ time: p.time, value: p.value - sigByTime.get(p.time) }));
  return { macd: macdLine, signal: sig, histogram: hist };
}

export function stochastic(candles, period = 14, smooth = 3) {
  const kRaw = [];
  for (let i = period - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    kRaw.push({ time: candles[i].time, value: hi === lo ? 50 : ((candles[i].close - lo) / (hi - lo)) * 100 });
  }
  // %D = SMA(smooth) of %K.
  const d = [];
  for (let i = smooth - 1; i < kRaw.length; i++) {
    const s = kRaw.slice(i - smooth + 1, i + 1).reduce((a, b) => a + b.value, 0) / smooth;
    d.push({ time: kRaw[i].time, value: s });
  }
  return { k: kRaw, d };
}

export function cci(candles, period = 20) {
  const out = [];
  for (let i = period - 1; i < candles.length; i++) {
    const tps = [];
    for (let j = i - period + 1; j <= i; j++) tps.push((candles[j].high + candles[j].low + candles[j].close) / 3);
    const m = tps.reduce((a, b) => a + b, 0) / period;
    const md = tps.reduce((a, b) => a + Math.abs(b - m), 0) / period;
    const tp = tps[tps.length - 1];
    out.push({ time: candles[i].time, value: md ? (tp - m) / (0.015 * md) : 0 });
  }
  return out;
}

export function williamsR(candles, period = 14) {
  const out = [];
  for (let i = period - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    out.push({ time: candles[i].time, value: hi === lo ? -50 : ((hi - candles[i].close) / (hi - lo)) * -100 });
  }
  return out;
}

export function obv(candles) {
  const out = [];
  let v = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i > 0) {
      if (candles[i].close > candles[i - 1].close) v += candles[i].volume || 0;
      else if (candles[i].close < candles[i - 1].close) v -= candles[i].volume || 0;
    }
    out.push({ time: candles[i].time, value: v });
  }
  return out;
}

// --- Registry: metadata that drives the overlay manager --------------------

export const INDICATORS = {
  // Price-pane overlays
  sma: { name: 'SMA', pane: 'price', color: '#FFB800', fn: (c, p) => sma(c, p.period || 20), params: { period: 20 } },
  ema: { name: 'EMA', pane: 'price', color: '#00aaff', fn: (c, p) => ema(c, p.period || 20), params: { period: 20 } },
  wma: { name: 'WMA', pane: 'price', color: '#b060ff', fn: (c, p) => wma(c, p.period || 20), params: { period: 20 } },
  vwap: { name: 'VWAP', pane: 'price', color: '#ff4488', fn: (c) => vwap(c), params: {} },
  bollinger: { name: 'Bollinger', pane: 'price', multi: ['upper', 'lower'], color: 'rgba(110,160,255,0.6)', fn: (c, p) => bollinger(c, p.period || 20, p.mult || 2), params: { period: 20, mult: 2 } },
  keltner: { name: 'Keltner', pane: 'price', multi: ['upper', 'lower'], color: 'rgba(0,204,68,0.5)', fn: (c, p) => keltner(c, p.period || 20, p.mult || 2), params: { period: 20, mult: 2 } },
  donchian: { name: 'Donchian', pane: 'price', multi: ['upper', 'lower'], color: 'rgba(255,184,0,0.5)', fn: (c, p) => donchian(c, p.period || 20), params: { period: 20 } },
  psar: { name: 'Parabolic SAR', pane: 'price', dots: true, color: '#ff8800', fn: (c) => parabolicSAR(c), params: {} },
  supertrend: { name: 'SuperTrend', pane: 'price', color: '#00cccc', fn: (c, p) => superTrend(c, p.period || 10, p.mult || 3), params: { period: 10, mult: 3 } },
  // Oscillator sub-panes
  rsi: { name: 'RSI', pane: 'sub', color: '#b060ff', bands: [30, 70], fn: (c, p) => rsi(c, p.period || 14), params: { period: 14 } },
  macd: { name: 'MACD', pane: 'sub', histogram: true, fn: (c) => macd(c), params: {} },
  stochastic: { name: 'Stochastic', pane: 'sub', multi: ['k', 'd'], bands: [20, 80], fn: (c, p) => stochastic(c, p.period || 14), params: { period: 14 } },
  cci: { name: 'CCI', pane: 'sub', color: '#ffb800', bands: [-100, 100], fn: (c, p) => cci(c, p.period || 20), params: { period: 20 } },
  williamsR: { name: 'Williams %R', pane: 'sub', color: '#00aaff', bands: [-80, -20], fn: (c, p) => williamsR(c, p.period || 14), params: { period: 14 } },
  atr: { name: 'ATR', pane: 'sub', color: '#ff8800', fn: (c, p) => atr(c, p.period || 14), params: { period: 14 } },
  obv: { name: 'OBV', pane: 'sub', color: '#00cc44', fn: (c) => obv(c), params: {} },
};
