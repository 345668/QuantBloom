// ---------------------------------------------------------------------------
// Mistral LLM advisory layer.
//
// Deliberately ADVISORY. The LLM reviews a decision the quantitative layers
// already made and can express agreement, disagreement, or caution — it never
// originates an order and never sets a position size. Its value is qualitative
// context the indicators cannot see (an earnings event, a news shock), and its
// failure modes (non-determinism, confident nonsense) are contained by giving
// it no execution authority.
//
// Every call is logged with its full response so any trade can be explained
// after the fact.
// ---------------------------------------------------------------------------

// Read env lazily — see the note in alpaca.js on ESM import hoisting.
const key = () => process.env.MISTRAL_API_KEY;
const model = () => process.env.MISTRAL_MODEL || 'mistral-small-latest';

export const mistralConfigured = () => Boolean(key());

// LLM calls cost money per invocation, so a daily budget is enforced here
// rather than trusted to the caller.
const budget = { date: null, calls: 0, tokens: 0, maxCalls: 200 };

function resetBudgetIfNewDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (budget.date !== today) { budget.date = today; budget.calls = 0; budget.tokens = 0; }
}

export function getBudget() {
  resetBudgetIfNewDay();
  return { ...budget, remaining: Math.max(budget.maxCalls - budget.calls, 0) };
}

export function setBudgetCap(maxCalls) {
  budget.maxCalls = Math.max(0, Math.floor(maxCalls));
}

const SYSTEM = `You are a risk-focused reviewer on a trading desk. A quantitative system has produced a trading decision from technical indicators. Your job is to review it, not to originate trades.

Respond ONLY with JSON:
{"stance":"AGREE"|"DISAGREE"|"CAUTION","confidence":0.0-1.0,"reasoning":"one or two sentences","keyRisk":"the single biggest risk to this trade"}

Be sceptical. Technical signals fail often. If the evidence is thin, say CAUTION. Do not invent facts you were not given, and never claim knowledge of news you have not been shown.`;

/**
 * Ask the model to review a quantitative decision.
 * Returns null when unavailable or over budget — the caller must treat the
 * advisory layer as optional and proceed without it.
 */
export async function reviewDecision({ symbol, decision, technical, news = [], position = null }) {
  if (!mistralConfigured()) return null;
  resetBudgetIfNewDay();
  if (budget.calls >= budget.maxCalls) {
    return { stance: 'UNAVAILABLE', reasoning: 'Daily LLM budget exhausted', budgetExhausted: true };
  }

  const facts = [
    `Symbol: ${symbol}`,
    `Quant decision: ${decision.action} (confidence ${decision.confidence}, ${decision.agreement} strategies agreeing)`,
    `Signals: ${decision.signals.map(s => `${s.name}=${s.action}`).join(', ')}`,
    technical?.price != null ? `Price: $${technical.price}` : null,
    technical?.oscillators?.rsi14 != null ? `RSI(14): ${technical.oscillators.rsi14}` : null,
    technical?.summary ? `Indicator summary: ${technical.summary.overall}` : null,
    technical?.range52w ? `52w range position: ${technical.range52w.position}%` : null,
    technical?.movingAverages?.cross ? `MA cross: ${technical.movingAverages.cross}` : null,
    position ? `Existing position: ${position.qty} shares, P&L ${position.unrealisedPercent?.toFixed(1)}%` : 'No existing position',
    news.length ? `Recent headlines:\n${news.slice(0, 5).map(n => `- ${n.headline} [${n.sentiment}]`).join('\n')}` : 'No recent news supplied',
  ].filter(Boolean).join('\n');

  try {
    const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model(),
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: facts },
        ],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    budget.calls++;
    if (!resp.ok) {
      const t = await resp.text();
      return { stance: 'UNAVAILABLE', reasoning: `Mistral error ${resp.status}`, detail: t.slice(0, 160) };
    }

    const data = await resp.json();
    budget.tokens += data.usage?.total_tokens || 0;
    const raw = data.choices?.[0]?.message?.content || '';

    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      return { stance: 'UNAVAILABLE', reasoning: 'Model returned unparseable output', raw: raw.slice(0, 200) };
    }

    const stance = ['AGREE', 'DISAGREE', 'CAUTION'].includes(parsed.stance) ? parsed.stance : 'CAUTION';
    return {
      stance,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reasoning: String(parsed.reasoning || '').slice(0, 400),
      keyRisk: String(parsed.keyRisk || '').slice(0, 300),
      model: model(),
      tokens: data.usage?.total_tokens || 0,
    };
  } catch (e) {
    return { stance: 'UNAVAILABLE', reasoning: `Mistral call failed: ${e.message}` };
  }
}

/**
 * Apply an advisory review to a quantitative decision.
 *
 * The LLM can veto (DISAGREE strongly -> HOLD) or damp confidence, but it can
 * never turn a HOLD into a trade, never flip direction, and never increase
 * size. Influence is strictly one-directional: toward doing less.
 */
export function applyReview(decision, review) {
  if (!review || review.stance === 'UNAVAILABLE') {
    return { ...decision, llm: review || null };
  }
  if (decision.action === 'HOLD') return { ...decision, llm: review };

  if (review.stance === 'DISAGREE' && review.confidence >= 0.6) {
    return {
      ...decision,
      action: 'HOLD',
      confidence: 0,
      vetoed: true,
      rationale: `${decision.rationale} — vetoed by review: ${review.reasoning}`,
      llm: review,
    };
  }
  if (review.stance === 'CAUTION' || review.stance === 'DISAGREE') {
    return {
      ...decision,
      confidence: +(decision.confidence * 0.5).toFixed(3),
      damped: true,
      rationale: `${decision.rationale} — size reduced after review`,
      llm: review,
    };
  }
  return { ...decision, llm: review };
}
