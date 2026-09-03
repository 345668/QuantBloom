// Research confirmation gate.
//
// Folds the Research Desk's cross-confirmed brief into the bot as an advisory
// layer, with the SAME one-directional safety contract as the LLM review: it can
// only make the bot do *less* — veto a trade or shrink its size when the
// research contradicts it — and it can NEVER originate a trade, flip direction,
// or increase size. A confirming brief is allowed through unchanged (we do not
// upsize on agreement). Pure and deterministic.
//
// research entry shape (from src/lib/brief.js / /api/v1/research):
//   { direction: 'bullish'|'bearish'|'neutral', conviction: 'high'|'medium'|'low', reasons: [] }

function contradicts(action, direction) {
  if (action === 'BUY') return direction === 'bearish';
  if (action === 'SELL') return direction === 'bullish';
  return false;
}

export function applyResearch(decision, research) {
  // Nothing to apply, or nothing to act on.
  if (!research || !research.direction || research.direction === 'neutral') {
    return { ...decision, research: research || null };
  }
  if (decision.action === 'HOLD') return { ...decision, research };

  const conflict = contradicts(decision.action, research.direction);
  const reason = (research.reasons && research.reasons.length)
    ? research.reasons.slice(0, 2).join('; ') : `research ${research.direction}`;

  if (conflict && research.conviction === 'high') {
    return {
      ...decision,
      action: 'HOLD',
      confidence: 0,
      vetoedByResearch: true,
      rationale: `${decision.rationale} — vetoed by research (${reason})`,
      research,
    };
  }
  if (conflict && research.conviction === 'medium') {
    return {
      ...decision,
      confidence: +(decision.confidence * 0.5).toFixed(3),
      dampedByResearch: true,
      rationale: `${decision.rationale} — size reduced, research contradicts (${reason})`,
      research,
    };
  }
  // Agreement or low-conviction conflict: allow through unchanged (never upsize).
  return {
    ...decision,
    researchConfirmed: !conflict,
    research,
  };
}
