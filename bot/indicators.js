// ---------------------------------------------------------------------------
// Technical indicators — the single source of truth.
//
// Imported by BOTH the live API route and the backtester. That is deliberate:
// if backtest and live compute indicators differently, the backtest is not
// testing the thing that ships, and every divergence becomes a bug discovered
// with money at risk. (The same principle ml4t-backtest and ml4t-live apply by
// sharing one Strategy class.)
//
// All functions take arrays ordered oldest-first.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Technical indicator maths — computed from candle data so we never depend on
// a premium data feed. All functions take arrays of numbers (oldest first).
// ---------------------------------------------------------------------------
export function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

export function emaSeries(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const out = [];
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(e);
  for (let i = period; i < values.length; i++) { e = values[i] * k + e * (1 - k); out.push(e); }
  return out;
}

export function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return null;
  const fastE = emaSeries(closes, fast);
  const slowE = emaSeries(closes, slow);
  // Align the two EMA series to the same (shorter) length.
  const offset = fastE.length - slowE.length;
  const macdLine = slowE.map((s, i) => fastE[i + offset] - s);
  const signalLine = emaSeries(macdLine, signal);
  const macdVal = macdLine[macdLine.length - 1];
  const sigVal = signalLine[signalLine.length - 1];
  return { macd: macdVal, signal: sigVal, histogram: macdVal - sigVal };
}

export function bollinger(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { middle: mean, upper: mean + mult * sd, lower: mean - mult * sd, bandwidth: (2 * mult * sd) / mean * 100 };
}

export function stochastic(highs, lows, closes, period = 14, smooth = 3) {
  if (closes.length < period + smooth) return null;
  const kSeries = [];
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    kSeries.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
  }
  const k = kSeries[kSeries.length - 1];
  const d = kSeries.slice(-smooth).reduce((a, b) => a + b, 0) / smooth;
  return { k, d };
}

export function atr(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export function adx(highs, lows, closes, period = 14) {
  if (closes.length < period * 2) return null;
  const plusDM = [], minusDM = [], tr = [];
  for (let i = 1; i < closes.length; i++) {
    const up = highs[i] - highs[i - 1];
    const down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  const smooth = arr => arr.slice(-period).reduce((a, b) => a + b, 0);
  const atrSum = smooth(tr) || 1;
  const plusDI = (smooth(plusDM) / atrSum) * 100;
  const minusDI = (smooth(minusDM) / atrSum) * 100;
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1) * 100;
  return { adx: dx, plusDI, minusDI };
}

// Pivot points (classic) from the most recent completed candle.
export function pivotPoints(high, low, close) {
  const p = (high + low + close) / 3;
  return {
    pivot: p,
    r1: 2 * p - low, r2: p + (high - low), r3: high + 2 * (p - low),
    s1: 2 * p - high, s2: p - (high - low), s3: low - 2 * (high - p),
  };
}

/**
 * Build the full technical payload from a window of candles.
 *
 * This function sees ONLY the candles it is given. The backtester depends on
 * that for point-in-time correctness: it passes a slice ending at the decision
 * bar, so no future information can leak into a signal.
 */
export function computeTechnical(candles, symbol = '') {
  if (!candles || candles.length < 30) {
    return { symbol, available: false, message: 'Insufficient price history' };
  }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    const price = closes[closes.length - 1];
    const prevCandle = candles[candles.length - 2];

    // --- Moving averages ---
    const ma = {
      sma20: sma(closes, 20), sma50: sma(closes, 50), sma100: sma(closes, 100), sma200: sma(closes, 200),
      ema12: ema(closes, 12), ema26: ema(closes, 26), ema50: ema(closes, 50),
    };

    // --- Oscillators & momentum ---
    const rsi14 = rsi(closes, 14);
    const macdVal = macd(closes);
    const bb = bollinger(closes, 20, 2);
    const stoch = stochastic(highs, lows, closes, 14, 3);
    const atr14 = atr(highs, lows, closes, 14);
    const adxVal = adx(highs, lows, closes, 14);
    const cci = (() => {
      const period = 20;
      if (closes.length < period) return null;
      const tp = candles.slice(-period).map(c => (c.high + c.low + c.close) / 3);
      const mean = tp.reduce((a, b) => a + b, 0) / period;
      const meanDev = tp.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
      const currentTP = tp[tp.length - 1];
      return meanDev ? (currentTP - mean) / (0.015 * meanDev) : 0;
    })();
    const williamsR = (() => {
      const period = 14;
      if (closes.length < period) return null;
      const hh = Math.max(...highs.slice(-period));
      const ll = Math.min(...lows.slice(-period));
      return hh === ll ? -50 : ((hh - price) / (hh - ll)) * -100;
    })();

    // --- 52-week range & position ---
    const week52High = Math.max(...highs);
    const week52Low = Math.min(...lows);
    const rangePosition = week52High === week52Low ? 50 : ((price - week52Low) / (week52High - week52Low)) * 100;

    // --- Volume ---
    const avgVol20 = sma(volumes, 20);
    const volumeRatio = avgVol20 ? volumes[volumes.length - 1] / avgVol20 : null;

    // --- Pivot points from the last completed session ---
    const pivots = prevCandle ? pivotPoints(prevCandle.high, prevCandle.low, prevCandle.close) : null;

    // --- Signal scoring: each indicator votes buy / sell / neutral ---
    const signals = [];
    const vote = (name, value, signal) => signals.push({ name, value, signal });

    if (rsi14 != null) vote('RSI (14)', +rsi14.toFixed(2), rsi14 > 70 ? 'sell' : rsi14 < 30 ? 'buy' : 'neutral');
    if (macdVal) vote('MACD (12,26,9)', +macdVal.histogram.toFixed(3), macdVal.histogram > 0 ? 'buy' : macdVal.histogram < 0 ? 'sell' : 'neutral');
    if (stoch) vote('Stochastic (14,3)', +stoch.k.toFixed(2), stoch.k > 80 ? 'sell' : stoch.k < 20 ? 'buy' : 'neutral');
    if (cci != null) vote('CCI (20)', +cci.toFixed(2), cci > 100 ? 'sell' : cci < -100 ? 'buy' : 'neutral');
    if (williamsR != null) vote('Williams %R', +williamsR.toFixed(2), williamsR > -20 ? 'sell' : williamsR < -80 ? 'buy' : 'neutral');
    if (adxVal) vote('ADX (14)', +adxVal.adx.toFixed(2), adxVal.adx > 25 ? (adxVal.plusDI > adxVal.minusDI ? 'buy' : 'sell') : 'neutral');
    if (ma.sma20 != null) vote('SMA 20', +ma.sma20.toFixed(2), price > ma.sma20 ? 'buy' : 'sell');
    if (ma.sma50 != null) vote('SMA 50', +ma.sma50.toFixed(2), price > ma.sma50 ? 'buy' : 'sell');
    if (ma.sma200 != null) vote('SMA 200', +ma.sma200.toFixed(2), price > ma.sma200 ? 'buy' : 'sell');
    if (ma.ema12 != null) vote('EMA 12', +ma.ema12.toFixed(2), price > ma.ema12 ? 'buy' : 'sell');
    if (ma.ema26 != null) vote('EMA 26', +ma.ema26.toFixed(2), price > ma.ema26 ? 'buy' : 'sell');
    if (bb) vote('Bollinger Bands', +bb.middle.toFixed(2), price > bb.upper ? 'sell' : price < bb.lower ? 'buy' : 'neutral');

    const buyCount = signals.filter(s => s.signal === 'buy').length;
    const sellCount = signals.filter(s => s.signal === 'sell').length;
    const neutralCount = signals.filter(s => s.signal === 'neutral').length;
    const score = buyCount - sellCount;
    let overall = 'NEUTRAL';
    if (score >= 6) overall = 'STRONG BUY';
    else if (score >= 2) overall = 'BUY';
    else if (score <= -6) overall = 'STRONG SELL';
    else if (score <= -2) overall = 'SELL';

    // Golden / death cross detection.
    let maCross = null;
    if (ma.sma50 != null && ma.sma200 != null) {
      maCross = ma.sma50 > ma.sma200 ? 'Golden Cross (bullish)' : 'Death Cross (bearish)';
    }

    const result = {
      symbol,
      available: true,
      price: +price.toFixed(2),
      summary: { overall, buy: buyCount, sell: sellCount, neutral: neutralCount, score },
      movingAverages: {
        sma20: ma.sma20 && +ma.sma20.toFixed(2), sma50: ma.sma50 && +ma.sma50.toFixed(2),
        sma100: ma.sma100 && +ma.sma100.toFixed(2), sma200: ma.sma200 && +ma.sma200.toFixed(2),
        ema12: ma.ema12 && +ma.ema12.toFixed(2), ema26: ma.ema26 && +ma.ema26.toFixed(2),
        ema50: ma.ema50 && +ma.ema50.toFixed(2), cross: maCross,
      },
      oscillators: {
        rsi14: rsi14 && +rsi14.toFixed(2),
        macd: macdVal && { macd: +macdVal.macd.toFixed(3), signal: +macdVal.signal.toFixed(3), histogram: +macdVal.histogram.toFixed(3) },
        stochastic: stoch && { k: +stoch.k.toFixed(2), d: +stoch.d.toFixed(2) },
        cci20: cci != null ? +cci.toFixed(2) : null,
        williamsR: williamsR != null ? +williamsR.toFixed(2) : null,
        atr14: atr14 && +atr14.toFixed(2),
        adx: adxVal && { adx: +adxVal.adx.toFixed(2), plusDI: +adxVal.plusDI.toFixed(2), minusDI: +adxVal.minusDI.toFixed(2) },
      },
      bollinger: bb && { upper: +bb.upper.toFixed(2), middle: +bb.middle.toFixed(2), lower: +bb.lower.toFixed(2), bandwidth: +bb.bandwidth.toFixed(2) },
      range52w: { high: +week52High.toFixed(2), low: +week52Low.toFixed(2), position: +rangePosition.toFixed(1) },
      volume: { latest: volumes[volumes.length - 1], avg20: avgVol20 && Math.round(avgVol20), ratio: volumeRatio && +volumeRatio.toFixed(2) },
      pivots: pivots && Object.fromEntries(Object.entries(pivots).map(([k, v]) => [k, +v.toFixed(2)])),
      signals,
      candleCount: candles.length,
    };


  return result;
}
