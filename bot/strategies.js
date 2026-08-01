// ---------------------------------------------------------------------------
// Signal generation.
//
// Every strategy returns the same shape, so the ensemble, the risk gate and
// the executor are each written once:
//
//   { action: 'BUY'|'SELL'|'HOLD', confidence: 0..1, rationale: string }
//
// These are rule-based and derived from the already-tested indicator engine.
// They are transparent and free to run, which makes them the right first
// strategies and the baseline any ML model has to beat.
// ---------------------------------------------------------------------------

const clamp01 = v => Math.max(0, Math.min(1, v));

/** RSI mean reversion: oversold buys, overbought sells. */
export function rsiStrategy(ta) {
  const rsi = ta?.oscillators?.rsi14;
  if (rsi == null) return null;
  if (rsi < 30) return { action: 'BUY', confidence: clamp01((30 - rsi) / 20), rationale: `RSI ${rsi} oversold` };
  if (rsi > 70) return { action: 'SELL', confidence: clamp01((rsi - 70) / 20), rationale: `RSI ${rsi} overbought` };
  return { action: 'HOLD', confidence: 0, rationale: `RSI ${rsi} neutral` };
}

/** MACD momentum: histogram sign, scaled by size relative to price. */
export function macdStrategy(ta) {
  const m = ta?.oscillators?.macd;
  const price = ta?.price;
  if (!m || !price) return null;
  const strength = clamp01(Math.abs(m.histogram) / (price * 0.01));
  if (m.histogram > 0) return { action: 'BUY', confidence: strength, rationale: `MACD histogram +${m.histogram}` };
  if (m.histogram < 0) return { action: 'SELL', confidence: strength, rationale: `MACD histogram ${m.histogram}` };
  return { action: 'HOLD', confidence: 0, rationale: 'MACD flat' };
}

/**
 * Contrarian / short-term mean reversion — the default strategy in the course
 * trader bots (position = -sign(mean(recent returns))). It fades the latest
 * move: if price has run above its short EMA it sells, and vice versa. Uses the
 * 12-period EMA as the momentum reference since the signal payload carries EMAs
 * rather than raw returns.
 */
export function contrarianStrategy(ta) {
  const price = ta?.price;
  const ema = ta?.movingAverages?.ema12;
  if (!price || ema == null) return null;
  const mom = price / ema - 1;
  const strength = clamp01(Math.abs(mom) / 0.02);
  if (mom > 0) return { action: 'SELL', confidence: strength, rationale: `Fading +${(mom * 100).toFixed(2)}% short-term move` };
  if (mom < 0) return { action: 'BUY', confidence: strength, rationale: `Fading ${(mom * 100).toFixed(2)}% short-term move` };
  return { action: 'HOLD', confidence: 0, rationale: 'No short-term move to fade' };
}

/** Trend following on the 50/200 relationship plus price location. */
export function trendStrategy(ta) {
  const ma = ta?.movingAverages;
  const price = ta?.price;
  if (!ma || !price || ma.sma50 == null || ma.sma200 == null) return null;
  const golden = ma.sma50 > ma.sma200;
  const above = price > ma.sma50;
  if (golden && above) return { action: 'BUY', confidence: 0.6, rationale: 'Golden cross, price above 50-day' };
  if (!golden && !above) return { action: 'SELL', confidence: 0.6, rationale: 'Death cross, price below 50-day' };
  return { action: 'HOLD', confidence: 0.2, rationale: golden ? 'Uptrend but price below 50-day' : 'Downtrend but price above 50-day' };
}

/** Bollinger reversion: outside the band is a fade signal. */
export function bollingerStrategy(ta) {
  const bb = ta?.bollinger;
  const price = ta?.price;
  if (!bb || !price) return null;
  if (price < bb.lower) return { action: 'BUY', confidence: clamp01((bb.lower - price) / (bb.middle - bb.lower)), rationale: 'Price below lower band' };
  if (price > bb.upper) return { action: 'SELL', confidence: clamp01((price - bb.upper) / (bb.upper - bb.middle)), rationale: 'Price above upper band' };
  return { action: 'HOLD', confidence: 0, rationale: 'Price inside bands' };
}

/** The existing multi-indicator consensus already computed server-side. */
export function consensusStrategy(ta) {
  const s = ta?.summary;
  if (!s) return null;
  const total = s.buy + s.sell + s.neutral || 1;
  const net = (s.buy - s.sell) / total;
  if (net > 0.2) return { action: 'BUY', confidence: clamp01(net), rationale: `${s.buy}/${total} indicators bullish` };
  if (net < -0.2) return { action: 'SELL', confidence: clamp01(-net), rationale: `${s.sell}/${total} indicators bearish` };
  return { action: 'HOLD', confidence: 0, rationale: 'Indicators mixed' };
}

export const STRATEGIES = {
  rsi: {
    name: 'RSI Reversion', fn: rsiStrategy, weight: 1,
    family: 'Mean reversion',
    description: 'Buys oversold (RSI<30), sells overbought (RSI>70).',
    worksWhen: 'Range-bound markets', failsWhen: 'Strong trends — stays overbought for months',
  },
  macd: {
    name: 'MACD Momentum', fn: macdStrategy, weight: 1,
    family: 'Momentum',
    description: 'Follows the MACD histogram sign, scaled by size relative to price.',
    worksWhen: 'Sustained directional moves', failsWhen: 'Choppy markets — whipsaws',
  },
  trend: {
    name: 'Trend Following', fn: trendStrategy, weight: 1.5,
    family: 'Trend',
    description: '50/200 golden and death cross, confirmed by price vs the 50-day.',
    worksWhen: 'Long sustained trends', failsWhen: 'Sideways markets — late entries and exits',
  },
  bollinger: {
    name: 'Bollinger Reversion', fn: bollingerStrategy, weight: 1,
    family: 'Mean reversion',
    description: 'Fades moves outside the 20/2 bands.',
    worksWhen: 'Stable volatility', failsWhen: 'Volatility expansion — fades a breakout',
  },
  contrarian: {
    name: 'Contrarian', fn: contrarianStrategy, weight: 1,
    family: 'Mean reversion',
    description: 'Fades the latest short-term move (position = -sign of recent momentum).',
    worksWhen: 'Choppy, mean-reverting intraday markets', failsWhen: 'Strong trends — fights the move',
  },
  consensus: {
    name: 'Indicator Consensus', fn: consensusStrategy, weight: 2,
    family: 'Ensemble',
    description: 'Net vote across all 12 indicators in the technical engine.',
    worksWhen: 'Most regimes; the broadest signal', failsWhen: 'Regime turns — indicators lag together',
  },
};

/**
 * Presets. These change how much the bot trades, not which markets it likes:
 * fewer strategies and a higher agreement bar means fewer, higher-conviction
 * trades. "Trend only" and "Reversion only" exist because the two families
 * fail in opposite conditions, and pairing them is what makes the ensemble
 * mostly sit still.
 */
export const PRESETS = {
  conservative: {
    name: 'Conservative',
    description: 'Trend and consensus only. Trades rarely, needs strong agreement.',
    strategies: ['trend', 'consensus'],
    threshold: 0.3,
  },
  balanced: {
    name: 'Balanced',
    description: 'All five strategies with a moderate agreement bar.',
    strategies: ['rsi', 'macd', 'trend', 'bollinger', 'consensus'],
    threshold: 0.15,
  },
  aggressive: {
    name: 'Aggressive',
    description: 'All five, acts on weaker agreement. Trades much more often.',
    strategies: ['rsi', 'macd', 'trend', 'bollinger', 'consensus'],
    threshold: 0.08,
  },
  trendOnly: {
    name: 'Trend only',
    description: 'Momentum and trend. Suited to directional markets.',
    strategies: ['trend', 'macd'],
    threshold: 0.2,
  },
  reversionOnly: {
    name: 'Reversion only',
    description: 'RSI, Bollinger and contrarian. Suited to range-bound markets.',
    strategies: ['rsi', 'bollinger', 'contrarian'],
    threshold: 0.2,
  },
};

/** Serialisable metadata for the UI. */
export function describeStrategies() {
  return Object.entries(STRATEGIES).map(([key, s]) => ({
    key, name: s.name, family: s.family, weight: s.weight,
    description: s.description, worksWhen: s.worksWhen, failsWhen: s.failsWhen,
  }));
}

export function describePresets() {
  return Object.entries(PRESETS).map(([key, p]) => ({ key, ...p }));
}

/**
 * Combine strategy signals into one decision.
 *
 * Disagreement is information: when strategies split, the net score is small
 * and the resulting confidence — and therefore the position size — shrinks.
 * That is preferable to picking a side and sizing as though it were certain.
 */
export function ensemble(ta, enabledKeys = Object.keys(STRATEGIES), threshold = 0.15) {
  const signals = [];
  let buyScore = 0, sellScore = 0, totalWeight = 0;

  for (const key of enabledKeys) {
    const strat = STRATEGIES[key];
    if (!strat) continue;
    const sig = strat.fn(ta);
    if (!sig) continue;
    signals.push({ key, name: strat.name, ...sig, weight: strat.weight });
    totalWeight += strat.weight;
    if (sig.action === 'BUY') buyScore += strat.weight * sig.confidence;
    if (sig.action === 'SELL') sellScore += strat.weight * sig.confidence;
  }

  if (!signals.length || !totalWeight) {
    return { action: 'HOLD', confidence: 0, signals: [], rationale: 'No signals available' };
  }

  const net = (buyScore - sellScore) / totalWeight;
  const action = net > threshold ? 'BUY' : net < -threshold ? 'SELL' : 'HOLD';
  const agreeing = signals.filter(s => s.action === action).length;

  return {
    action,
    confidence: +clamp01(Math.abs(net)).toFixed(3),
    netScore: +net.toFixed(3),
    threshold,
    signals,
    agreement: `${agreeing}/${signals.length}`,
    rationale: action === 'HOLD'
      ? `Signals too mixed to act (net ${net.toFixed(2)}, needs ${threshold})`
      : `${agreeing} of ${signals.length} strategies agree on ${action}`,
  };
}

/**
 * Translate confidence into a dollar amount, then shares.
 *
 * Sizing is proportional to confidence and capped well inside the risk gate's
 * own limit, so the gate is a backstop rather than the primary control.
 */
export function sizePosition(decision, equity, price, maxPositionPercent = 5) {
  if (decision.action !== 'BUY' || !price || price <= 0) return 0;
  const targetPercent = maxPositionPercent * decision.confidence;
  return Math.max(Math.floor((equity * (targetPercent / 100)) / price), 0);
}
