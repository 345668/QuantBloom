// ---------------------------------------------------------------------------
// Bar-replay state helpers.
//
// Replay reveals history one bar at a time from a chosen cursor, so a setup can
// be reviewed exactly as it looked then — no lookahead. This is the interactive
// form of the point-in-time discipline the backtester already enforces: the
// chart, indicators, drawings and volume profile all see only candles[0..cursor].
//
// Pure and unit-tested; the component owns play/pause timing.
// ---------------------------------------------------------------------------

/** Clamp a cursor into [minStart, len-1]. */
export function clampCursor(cursor, len, minStart = 0) {
  if (len <= 0) return 0;
  const hardMin = Math.max(0, Math.min(minStart, len - 1));
  return Math.max(hardMin, Math.min(Math.round(cursor), len - 1));
}

/** Candles up to and including the cursor — what the chart is allowed to see. */
export function sliceUpTo(candles, cursor) {
  if (!candles || !candles.length) return [];
  return candles.slice(0, clampCursor(cursor, candles.length) + 1);
}

/** Move the cursor by delta, staying in bounds. */
export function stepCursor(cursor, delta, len, minStart = 0) {
  return clampCursor(cursor + delta, len, minStart);
}

/** Progress through the series as a percentage, 0 at start → 100 at the last bar. */
export function replayProgress(cursor, len) {
  if (len <= 1) return 100;
  const c = clampCursor(cursor, len);
  return +((c / (len - 1)) * 100).toFixed(1);
}

/** True once the cursor has reached the final bar. */
export function atEnd(cursor, len) {
  return len <= 0 || clampCursor(cursor, len) >= len - 1;
}
