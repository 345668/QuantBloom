// Maker-checker scorecard — the self-improving loop.
//
// The paper's Chief-of-Staff grades every specialist weekly on realized signal
// accuracy, so a source that drifts into false positives is caught and demoted.
// This module grades the bot's own decision sources (rule strategies and models)
// the same way: for each past decision we know the mark price at decision time,
// compare it to the current price, and check whether the direction paid off.
// Pure and deterministic — the caller supplies decisions + current prices.

// The primary directional sign of an action: BUY = +1, SELL = -1, else 0.
export function actionSign(action) {
  return action === 'BUY' ? 1 : action === 'SELL' ? -1 : 0;
}

// Grade one decision against the current price. Returns { scored, ... }.
// A decision is scoreable only if it took a directional action and we have both
// its mark price (at decision time) and a current price.
export function gradeDecision(decision, currentPrice) {
  const sign = actionSign(decision?.action);
  const entry = Number(decision?.markPrice ?? decision?.order?.price);
  const now = Number(currentPrice);
  if (!sign || !isFinite(entry) || entry <= 0 || !isFinite(now) || now <= 0) {
    return { scored: false };
  }
  const move = (now - entry) / entry;       // raw forward return
  const directional = sign * move;          // signed by the decision's direction
  return { scored: true, action: decision.action, move, directional, correct: directional > 0 };
}

// The sources a decision should be credited to: each contributing strategy that
// voted the decision's way, plus the model if a model drove it.
export function sourcesOf(decision) {
  const out = [];
  if (decision?.model?.type) out.push(`${decision.model.type.toUpperCase()} · ${decision.model.symbol || 'model'}`);
  for (const s of decision?.signals || []) {
    if (s?.name && (!s.action || s.action === decision.action)) out.push(s.name);
  }
  if (!out.length && decision?.agreement) out.push(String(decision.agreement));
  return [...new Set(out)];
}

// A letter grade from a hit rate, with an insufficient-sample guard.
export function letterGrade(hitRate, n, minSample = 5) {
  if (n < minSample) return 'n/a';
  if (hitRate >= 0.6) return 'A';
  if (hitRate >= 0.55) return 'B';
  if (hitRate >= 0.5) return 'C';
  if (hitRate >= 0.45) return 'D';
  return 'F';
}

// Build the scorecard: grade every scoreable decision and aggregate by source.
// decisions: bot decision records (with markPrice); priceBySymbol: { SYM: price }.
export function buildScorecard(decisions, priceBySymbol = {}, { minSample = 5 } = {}) {
  const bySource = {};
  let scored = 0, wins = 0, sumRet = 0;

  for (const d of decisions || []) {
    const g = gradeDecision(d, priceBySymbol[d.symbol]);
    if (!g.scored) continue;
    scored++; if (g.correct) wins++; sumRet += g.directional;
    for (const src of sourcesOf(d)) {
      const row = bySource[src] || (bySource[src] = { source: src, n: 0, wins: 0, sumReturn: 0 });
      row.n++; if (g.correct) row.wins++; row.sumReturn += g.directional;
    }
  }

  const sources = Object.values(bySource).map(r => {
    const hitRate = r.n ? r.wins / r.n : 0;
    return {
      source: r.source, n: r.n,
      hitRate: +hitRate.toFixed(3),
      avgReturn: +((r.n ? r.sumReturn / r.n : 0) * 100).toFixed(2),
      grade: letterGrade(hitRate, r.n, minSample),
    };
  }).sort((a, b) => (b.n >= minSample) - (a.n >= minSample) || b.hitRate - a.hitRate);

  return {
    sources,
    totals: {
      scored,
      hitRate: scored ? +(wins / scored).toFixed(3) : 0,
      avgReturn: scored ? +((sumRet / scored) * 100).toFixed(2) : 0,
    },
  };
}
