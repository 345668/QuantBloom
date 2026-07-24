// ---------------------------------------------------------------------------
// Chart-type transforms — clean-room implementations of standard financial
// chart constructions (predating any single vendor). Pure, deterministic, and
// unit-tested. The rendering layer feeds these to a candlestick series.
//
// Heikin-Ashi maps 1:1 onto the time axis. Renko and Line Break have no uniform
// time axis, so bricks/lines are emitted with strictly increasing synthetic
// times derived from the source bar — standard for these chart types.
// ---------------------------------------------------------------------------

/**
 * Heikin-Ashi candles. Smooths noise by averaging OHLC.
 *   HA_close = (O+H+L+C)/4
 *   HA_open  = (prev HA_open + prev HA_close)/2   (seed: (O+C)/2)
 *   HA_high  = max(H, HA_open, HA_close)
 *   HA_low   = min(L, HA_open, HA_close)
 */
export function heikinAshi(candles) {
  const out = [];
  let prevOpen, prevClose;
  for (const c of candles) {
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = prevOpen == null ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    out.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose });
    prevOpen = haOpen; prevClose = haClose;
  }
  return out;
}

/** A sensible default Renko box size: ~ the average true range. */
export function suggestBoxSize(candles) {
  if (candles.length < 2) return 1;
  let sum = 0, n = 0;
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    );
    sum += tr; n++;
  }
  const atr = sum / n;
  // Round to a clean-ish value so bricks are stable.
  return +Math.max(atr, 1e-6).toPrecision(2);
}

/**
 * Renko bricks (close-based, single-box). A new brick forms each time price
 * moves a full box beyond the last brick's close. Bricks carry strictly
 * increasing times so a candlestick series can render them.
 *
 * This is the "simple" close-based construction (one box to continue or
 * reverse), which is the common default; a two-box reversal variant can be
 * layered on later.
 */
export function renko(candles, boxSize) {
  if (!candles.length) return [];
  const box = boxSize && boxSize > 0 ? boxSize : suggestBoxSize(candles);
  const bricks = [];
  // Anchor the first brick level to the opening price snapped to the box grid.
  let level = candles[0].close;
  let t = candles[0].time;
  const step = () => (t += 60); // guarantee strictly increasing time per brick

  for (const c of candles) {
    let diff = c.close - level;
    while (Math.abs(diff) >= box) {
      const dir = diff > 0 ? 1 : -1;
      const open = level;
      const close = level + dir * box;
      bricks.push({
        time: t <= (bricks.at(-1)?.time ?? -Infinity) ? step() : (t = Math.max(t, c.time)),
        open, high: Math.max(open, close), low: Math.min(open, close), close,
        direction: dir > 0 ? 'up' : 'down',
      });
      // Ensure the next brick's time is strictly greater.
      t = bricks.at(-1).time;
      level = close;
      diff = c.close - level;
    }
  }
  return bricks;
}

/**
 * N-line break (default 3). A new line is drawn only when the close breaks
 * beyond the extreme of the last N lines; otherwise the bar is absorbed.
 * Reversals therefore require conviction, which is the point of the chart.
 */
export function lineBreak(candles, n = 3) {
  if (candles.length < 2) return [];
  const lines = [{
    time: candles[1].time,
    open: candles[0].close,
    close: candles[1].close,
  }];
  let t = candles[1].time;

  for (let i = 2; i < candles.length; i++) {
    const close = candles[i].close;
    const recent = lines.slice(-n);
    const refHigh = Math.max(...recent.map(l => Math.max(l.open, l.close)));
    const refLow = Math.min(...recent.map(l => Math.min(l.open, l.close)));
    const last = lines[lines.length - 1];

    if (close > refHigh || close < refLow) {
      t = candles[i].time > t ? candles[i].time : t + 60;
      lines.push({ time: t, open: last.close, close });
    }
  }
  // Add OHLC fields so the result plots as candles.
  return lines.map(l => ({
    time: l.time, open: l.open, close: l.close,
    high: Math.max(l.open, l.close), low: Math.min(l.open, l.close),
    direction: l.close >= l.open ? 'up' : 'down',
  }));
}

// Chart types that transform the data vs. those that are a native series style.
export const CHART_TYPES = [
  { key: 'candles', label: 'Candles', kind: 'candlestick' },
  { key: 'hollow', label: 'Hollow', kind: 'candlestick', hollow: true },
  { key: 'heikin', label: 'Heikin-Ashi', kind: 'candlestick', transform: 'heikin' },
  { key: 'bars', label: 'Bars', kind: 'bar' },
  { key: 'line', label: 'Line', kind: 'line' },
  { key: 'area', label: 'Area', kind: 'area' },
  { key: 'renko', label: 'Renko', kind: 'candlestick', transform: 'renko' },
  { key: 'linebreak', label: 'Line Break', kind: 'candlestick', transform: 'linebreak' },
];

/** Apply a chart type's data transform, returning candlestick-shaped rows. */
export function transformForType(typeKey, candles) {
  switch (typeKey) {
    case 'heikin': return heikinAshi(candles);
    case 'renko': return renko(candles);
    case 'linebreak': return lineBreak(candles);
    default: return candles;
  }
}
