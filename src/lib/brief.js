// Coordinator — cross-source confirmation for the morning brief.
//
// The paper's "Chief of Staff" rule: a signal is HIGH CONVICTION only when at
// least two independent analyzers agree on the same ticker with directional
// agreement. This turns a pile of per-analyzer signals into a ranked,
// deduplicated brief. Pure and deterministic.

// Normalize a label to a direction sign: +1 bullish, -1 bearish, 0 neutral.
export function dir(label) {
  if (label === 'bullish' || label === 'up' || label === 'buy') return 1;
  if (label === 'bearish' || label === 'down' || label === 'sell') return -1;
  return 0;
}

// Combine per-symbol analyzer signals into a brief entry.
// signals: { sentiment?, insider?, filing?, alpha? } each optional,
//   shaped as { direction: 'bullish'|'bearish'|'neutral', detail, weight? }
// Returns { symbol, score, direction, conviction, agree, sources[], reasons[] }.
export function buildEntry(symbol, signals) {
  const active = Object.entries(signals).filter(([, s]) => s && s.direction && s.direction !== 'neutral' && s.direction !== 'none');
  let score = 0;
  const sources = [];
  const reasons = [];
  for (const [name, s] of active) {
    const w = s.weight ?? 1;
    score += dir(s.direction) * w;
    sources.push(name);
    if (s.detail) reasons.push(s.detail);
  }
  const agree = sources.length;
  const direction = score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral';
  // HIGH CONVICTION = >=2 sources AND they don't cancel out (net |score| >= 2).
  const conviction = agree >= 2 && Math.abs(score) >= 2 ? 'high'
    : agree >= 1 && Math.abs(score) >= 1 ? 'medium' : 'low';
  return { symbol, score: +score.toFixed(2), direction, conviction, agree, sources, reasons };
}

// Assemble the full brief from a map of symbol -> analyzer signals.
// Returns entries sorted by conviction then |score|, plus a highConviction list.
export function assembleBrief(bySymbol, { asOf } = {}) {
  const rank = { high: 2, medium: 1, low: 0 };
  const entries = Object.entries(bySymbol)
    .map(([sym, sig]) => buildEntry(sym, sig))
    .filter(e => e.agree > 0)
    .sort((a, b) => rank[b.conviction] - rank[a.conviction] || Math.abs(b.score) - Math.abs(a.score));
  return {
    asOf: asOf || new Date().toISOString(),
    entries,
    highConviction: entries.filter(e => e.conviction === 'high'),
    counts: {
      total: entries.length,
      high: entries.filter(e => e.conviction === 'high').length,
      bullish: entries.filter(e => e.direction === 'bullish').length,
      bearish: entries.filter(e => e.direction === 'bearish').length,
    },
  };
}
