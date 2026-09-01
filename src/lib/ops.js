// Pure helpers for the Mission-Control operations rail: sparklines, the risk
// radar hexagon, the fill-heat grid, and ledger rows. No DOM, no fetch.

// SVG polyline path for a sparkline fitted to a w×h box (2px padding).
export function sparklinePath(values, w, h, pad = 2) {
  const v = values.filter(x => typeof x === 'number' && isFinite(x));
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v);
  const span = max - min || 1;
  const step = (w - pad * 2) / (v.length - 1);
  return v.map((val, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (val - min) / span);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

// Closed area path for a sparkline (line down to the baseline and back),
// suitable for a gradient fill under the curve.
export function sparklineArea(values, w, h, pad = 2) {
  const line = sparklinePath(values, w, h, pad);
  if (!line) return '';
  const n = values.filter(x => typeof x === 'number' && isFinite(x)).length;
  const step = (w - pad * 2) / (n - 1);
  const lastX = pad + (n - 1) * step;
  return `${line} L ${lastX.toFixed(1)} ${(h - pad).toFixed(1)} L ${pad.toFixed(1)} ${(h - pad).toFixed(1)} Z`;
}

// Regular hexagon vertices (6 axes) scaled by per-axis values in [0,1].
// Returns "x,y x,y ..." suitable for an SVG <polygon points>.
export function hexagonPoints(cx, cy, r, values) {
  const vals = values.slice(0, 6);
  while (vals.length < 6) vals.push(0);
  return vals.map((v, i) => {
    const ang = (Math.PI / 3) * i - Math.PI / 2;   // start at top
    const rr = r * Math.max(0, Math.min(1, v));
    return `${(cx + Math.cos(ang) * rr).toFixed(1)},${(cy + Math.sin(ang) * rr).toFixed(1)}`;
  }).join(' ');
}

// Outline hexagon (the full-scale grid ring).
export function hexagonOutline(cx, cy, r) {
  return hexagonPoints(cx, cy, r, [1, 1, 1, 1, 1, 1]);
}

// Bucket decisions into a symbol × hour grid of activity counts.
// Returns { symbols, hours, grid: {sym: {hour: count}}, max }.
export function heatBuckets(decisions, { topSymbols = 6 } = {}) {
  const counts = {};
  const totals = {};
  for (const d of decisions || []) {
    if (!d.symbol || !d.at) continue;
    const hour = new Date(d.at).getHours();
    (counts[d.symbol] ||= {});
    counts[d.symbol][hour] = (counts[d.symbol][hour] || 0) + 1;
    totals[d.symbol] = (totals[d.symbol] || 0) + 1;
  }
  const symbols = Object.keys(totals).sort((a, b) => totals[b] - totals[a]).slice(0, topSymbols);
  let max = 0;
  for (const s of symbols) for (const h of Object.values(counts[s])) max = Math.max(max, h);
  return { symbols, hours: Array.from({ length: 24 }, (_, i) => i), grid: counts, max: max || 1 };
}

// Risk-radar axes (each 0..1) from bot status. Higher = more risk consumed.
export function riskAxes(status) {
  const s = status || {};
  const limits = s.limits || {};
  const dd = Math.abs(s.drawdownPercent ?? 0);
  const daily = Math.abs(Math.min(0, s.account?.dailyPnlPercent ?? 0));
  const posCount = (s.positions?.length ?? 0);
  const orders = s.ordersToday ?? 0;
  const maxOrders = limits.maxOrdersPerDay ?? 20;
  const ddLimit = limits.maxDrawdownPercent ?? 10;
  const dailyLimit = limits.maxDailyLossPercent ?? 2;
  const llmUsed = 1 - Math.min(1, (s.llmBudget?.remaining ?? 1) / (s.llmBudget?.limit || 1));
  return [
    { label: 'DD', v: Math.min(1, dd / ddLimit) },
    { label: 'DAILY', v: Math.min(1, daily / dailyLimit) },
    { label: 'POS', v: Math.min(1, posCount / 8) },
    { label: 'ORDERS', v: Math.min(1, orders / maxOrders) },
    { label: 'HALT', v: s.halted ? 1 : 0 },
    { label: 'LLM', v: llmUsed },
  ];
}

// Ledger rows from bot status — the running tally on the right of the screen.
export function ledgerRows(status) {
  const s = status || {};
  const a = s.account || {};
  return [
    { label: 'equity', value: a.equity != null ? `$${Math.round(a.equity).toLocaleString()}` : '—' },
    { label: 'cash', value: a.cash != null ? `$${Math.round(a.cash).toLocaleString()}` : '—' },
    { label: 'day p&l', value: a.dailyPnlPercent != null ? `${a.dailyPnlPercent >= 0 ? '+' : ''}${a.dailyPnlPercent.toFixed(2)}%` : '—', sign: a.dailyPnlPercent },
    { label: 'positions', value: String(s.positions?.length ?? 0) },
    { label: 'orders today', value: `${s.ordersToday ?? 0}/${s.limits?.maxOrdersPerDay ?? 20}` },
    { label: 'drawdown', value: s.drawdownPercent != null ? `${s.drawdownPercent.toFixed(2)}%` : '—', sign: -(s.drawdownPercent ?? 0) },
    { label: 'llm calls left', value: String(s.llmBudget?.remaining ?? '—') },
    { label: 'state', value: s.enabled ? 'LIVE' : 'IDLE' },
  ];
}
