// ---------------------------------------------------------------------------
// Volume profile and market structure — standard constructions, clean-room.
//
// Volume profile buckets traded volume by PRICE (not time), revealing where the
// market actually did business. The point of control (POC) is the busiest
// price; the value area is the price band containing a share (default 70%) of
// volume around it. Swing highs/lows give auto support & resistance.
//
// Pure and unit-tested; the chart overlay reads price coordinates from these.
// ---------------------------------------------------------------------------

/**
 * Distribute each candle's volume across the price buckets its high-low range
 * spans, weighted by overlap — the common approximation when only OHLCV bars
 * are available (true profile needs intraday prints).
 */
export function volumeProfile(candles, bins = 24) {
  if (!candles || !candles.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const c of candles) { lo = Math.min(lo, c.low); hi = Math.max(hi, c.high); }
  if (!(hi > lo)) return null;

  const width = (hi - lo) / bins;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    low: lo + i * width, high: lo + (i + 1) * width, mid: lo + (i + 0.5) * width, volume: 0,
  }));

  for (const c of candles) {
    const v = c.volume || 0;
    if (v <= 0) continue;
    const span = c.high - c.low;
    if (span <= 0) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((c.low - lo) / width)));
      buckets[idx].volume += v;
      continue;
    }
    for (const b of buckets) {
      const overlap = Math.max(0, Math.min(c.high, b.high) - Math.max(c.low, b.low));
      if (overlap > 0) b.volume += v * (overlap / span);
    }
  }

  const total = buckets.reduce((s, b) => s + b.volume, 0);
  let pocIndex = 0;
  buckets.forEach((b, i) => { if (b.volume > buckets[pocIndex].volume) pocIndex = i; });
  const maxVolume = buckets[pocIndex].volume;

  return {
    buckets, total, maxVolume,
    poc: buckets[pocIndex], pocIndex,
    valueArea: valueArea(buckets, pocIndex, total, 0.7),
    priceLow: lo, priceHigh: hi,
  };
}

/**
 * Value area: expand outward from the POC, each step taking whichever adjacent
 * bucket holds more volume, until the accumulated share reaches `pct`.
 */
export function valueArea(buckets, pocIndex, total, pct = 0.7) {
  if (!total) return null;
  const target = total * pct;
  let acc = buckets[pocIndex].volume;
  let lo = pocIndex, hi = pocIndex;
  while (acc < target && (lo > 0 || hi < buckets.length - 1)) {
    const upVol = hi < buckets.length - 1 ? buckets[hi + 1].volume : -1;
    const downVol = lo > 0 ? buckets[lo - 1].volume : -1;
    if (upVol >= downVol) { hi += 1; acc += Math.max(upVol, 0); }
    else { lo -= 1; acc += Math.max(downVol, 0); }
  }
  return { lowIndex: lo, highIndex: hi, low: buckets[lo].low, high: buckets[hi].high, volume: acc };
}

/**
 * Swing highs/lows: a bar whose high (low) is the strict extreme within
 * ±lookback bars. These are the pivots that become support & resistance.
 */
export function swingLevels(candles, lookback = 5) {
  const highs = [], lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) highs.push({ time: candles[i].time, price: candles[i].high });
    if (isLow) lows.push({ time: candles[i].time, price: candles[i].low });
  }
  return { highs, lows };
}

/**
 * Cluster nearby swing levels into support/resistance zones, strongest first.
 * Levels within `tolerance` (fraction of price) are merged; touch count is the
 * strength.
 */
export function supportResistance(candles, lookback = 5, tolerance = 0.01, maxLevels = 6) {
  const { highs, lows } = swingLevels(candles, lookback);
  const all = [...highs.map(h => h.price), ...lows.map(l => l.price)].sort((a, b) => a - b);
  const clusters = [];
  for (const p of all) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(p - last.price) / last.price <= tolerance) {
      last.price = (last.price * last.count + p) / (last.count + 1);
      last.count += 1;
    } else {
      clusters.push({ price: p, count: 1 });
    }
  }
  return clusters.sort((a, b) => b.count - a.count).slice(0, maxLevels);
}
