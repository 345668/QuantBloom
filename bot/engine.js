// ---------------------------------------------------------------------------
// Bot engine — state, decision loop, execution.
//
// The bot is OFF by default and stays off across restarts unless explicitly
// switched on. Nothing here places an order that has not passed the risk gate.
// ---------------------------------------------------------------------------

import { evaluateOrder, checkHaltConditions, DEFAULT_LIMITS } from './risk-gate.js';
import { ensemble, sizePosition, STRATEGIES, PRESETS, describeStrategies, describePresets } from './strategies.js';
import { reviewDecision, applyReview, mistralConfigured, getBudget } from './mistral.js';
import { modelStrategy } from './model.js';
import { getModel, listTrained, trainAndRegister } from './model-registry.js';
import { computeBracket, updateTrailingStop } from './brackets.js';
import * as broker from './alpaca.js';

const state = {
  enabled: false,           // OFF by default. Always.
  halted: false,
  haltReason: null,
  requiresManualRestart: false,
  mode: 'paper',
  watchlist: ['AAPL', 'MSFT', 'NVDA', 'SPY', 'QQQ'],
  strategies: PRESETS.balanced.strategies,
  threshold: PRESETS.balanced.threshold,
  preset: 'balanced',
  // null = decide with the rule-strategy ensemble; otherwise the id of a
  // trained ML model from the Model Lab drives every decision instead.
  activeModelId: null,
  useLlm: true,
  // Protective exits attached to each entry (null = off). slPercent 0.05 = a 5%
  // stop; tpPercent 0.10 = a 10% target. Managed broker-side as a bracket.
  brackets: { enabled: false, slPercent: 0.05, tpPercent: 0.10, trailPercent: 0 },
  // Per-symbol high-water mark for the live trailing stop (peak since entry).
  highWaterMarks: {},
  limits: { ...DEFAULT_LIMITS },
  ordersToday: 0,
  ordersDate: new Date().toISOString().slice(0, 10),
  peakEquity: null,
  lastRun: null,
  lastError: null,
};

// Bounded in-memory logs. A real deployment persists these to Postgres; this
// keeps the process from growing without limit in the meantime.
const decisions = [];
const auditLog = [];
const MAX_LOG = 200;

function audit(event, detail = {}) {
  auditLog.unshift({ at: new Date().toISOString(), event, ...detail });
  if (auditLog.length > MAX_LOG) auditLog.length = MAX_LOG;
}

function rollDayIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.ordersDate !== today) {
    state.ordersDate = today;
    state.ordersToday = 0;
    // A daily-loss halt expires overnight; a drawdown halt does not.
    if (state.halted && !state.requiresManualRestart) {
      state.halted = false;
      state.haltReason = null;
      audit('halt_cleared', { reason: 'new trading day' });
    }
  }
}

export function getState() {
  rollDayIfNeeded();
  return {
    ...state,
    brokerConfigured: broker.alpacaConfigured(),
    isPaper: broker.isPaperEndpoint(),
    llmConfigured: mistralConfigured(),
    llmBudget: getBudget(),
    availableStrategies: describeStrategies(),
    availablePresets: describePresets(),
    // Trained models the bot can be pointed at, newest first.
    availableModels: listTrained().map(m => ({
      id: m.id, symbol: m.symbol, modelType: m.modelType,
      testAuc: m.testMetrics?.auc ?? null,
      eligible: m.eligible, published: m.published,
      createdAt: m.createdAt,
    })),
    activeModel: state.activeModelId ? (() => {
      const m = getModel(state.activeModelId);
      return m ? { id: m.id, symbol: m.symbol, modelType: m.modelType, eligible: m.eligible, published: m.published } : null;
    })() : null,
  };
}

/**
 * Point the bot at a trained model (or back at the rule strategies with null).
 * Paper-only, so an ungated model is allowed — but the caller is told whether
 * it passed validation so the UI can warn.
 */
export function setActiveModel(modelId) {
  if (!modelId) {
    state.activeModelId = null;
    audit('model_cleared', {});
    return { ok: true, activeModelId: null };
  }
  const m = getModel(modelId);
  if (!m) return { ok: false, error: 'Model not found (it may have been cleared on restart)' };
  state.activeModelId = modelId;
  audit('model_selected', { modelId, type: m.modelType, symbol: m.symbol, eligible: m.eligible });
  return { ok: true, activeModelId: modelId, eligible: m.eligible };
}

/**
 * "Train itself": train a model on every watchlist symbol, then auto-select the
 * strongest — preferring one that clears the publish gate, otherwise the best
 * out-of-sample AUC. This is how the bot refreshes its own model; a scheduler
 * or the UI can call it. Honest by construction: it still only promotes what
 * the gate/metrics justify, and reports when nothing is worth using.
 */
export async function autoTrain({ fetchCandles, modelType = 'gbm' } = {}) {
  if (!fetchCandles) return { ok: false, error: 'No candle source' };
  const trained = [];
  for (const symbol of state.watchlist) {
    try {
      const candles = await fetchCandles(symbol).catch(() => null);
      if (!candles || candles.length < 300) { trained.push({ symbol, ok: false, error: 'insufficient history' }); continue; }
      const out = trainAndRegister(candles, { symbol, modelType, range: '5y' });
      if (!out.ok) { trained.push({ symbol, ok: false, error: out.error }); continue; }
      const m = out.model;
      trained.push({ symbol, ok: true, id: m.id, auc: m.testMetrics?.auc ?? null, eligible: m.eligible });
    } catch (e) {
      trained.push({ symbol, ok: false, error: e.message });
    }
  }

  const candidates = trained.filter(t => t.ok && t.auc != null);
  if (!candidates.length) { audit('autotrain', { trained: trained.length, selected: null }); return { ok: true, trained, selected: null }; }
  // Prefer an eligible model; among ties, the highest AUC.
  candidates.sort((a, b) => (Number(b.eligible) - Number(a.eligible)) || (b.auc - a.auc));
  const best = candidates[0];
  setActiveModel(best.id);
  audit('autotrain', { trained: trained.length, selected: best.symbol, auc: best.auc, eligible: best.eligible });
  return { ok: true, trained, selected: best };
}

export function setEnabled(enabled, who = 'user') {
  // A drawdown halt cannot be cleared by flipping the switch — that would
  // defeat the purpose of requiring a deliberate restart.
  if (enabled && state.halted && state.requiresManualRestart) {
    return { ok: false, error: `Cannot enable: ${state.haltReason}. Reset the halt first.` };
  }
  state.enabled = Boolean(enabled);
  audit(enabled ? 'bot_enabled' : 'bot_disabled', { by: who });
  return { ok: true, enabled: state.enabled };
}

export function resetHalt(who = 'user') {
  state.halted = false;
  state.haltReason = null;
  state.requiresManualRestart = false;
  audit('halt_reset', { by: who });
  return { ok: true };
}

export function updateConfig(patch = {}) {
  if (Array.isArray(patch.watchlist)) {
    state.watchlist = patch.watchlist.map(s => String(s).toUpperCase()).slice(0, 20);
  }
  if (patch.brackets && typeof patch.brackets === 'object') {
    const b = patch.brackets;
    if (typeof b.enabled === 'boolean') state.brackets.enabled = b.enabled;
    // Percentages are capped so a fat-finger can't set a 90% "stop".
    if (b.slPercent != null) {
      const n = Number(b.slPercent);
      if (Number.isFinite(n) && n > 0 && n <= 0.5) state.brackets.slPercent = n;
    }
    if (b.tpPercent != null) {
      const n = Number(b.tpPercent);
      if (Number.isFinite(n) && n > 0 && n <= 2) state.brackets.tpPercent = n;
    }
    if (b.trailPercent != null) {
      const n = Number(b.trailPercent);
      // 0 disables the trailing stop; otherwise cap it like the hard stop.
      if (Number.isFinite(n) && n >= 0 && n <= 0.5) state.brackets.trailPercent = n;
    }
  }
  // A preset sets both the strategy set and the agreement threshold; an
  // explicit strategies/threshold patch afterwards marks the config custom.
  if (patch.preset && PRESETS[patch.preset]) {
    const p = PRESETS[patch.preset];
    state.preset = patch.preset;
    state.strategies = [...p.strategies];
    state.threshold = p.threshold;
  }
  if (Array.isArray(patch.strategies)) {
    const next = patch.strategies.filter(k => STRATEGIES[k]);
    // Refuse to disable everything — that would silently stop the bot rather
    // than stopping it via the switch, which is the honest control.
    if (next.length) { state.strategies = next; state.preset = 'custom'; }
  }
  if (patch.threshold != null) {
    const t = Number(patch.threshold);
    if (Number.isFinite(t) && t >= 0 && t <= 1) { state.threshold = t; state.preset = 'custom'; }
  }
  if (typeof patch.useLlm === 'boolean') state.useLlm = patch.useLlm;
  if (patch.limits && typeof patch.limits === 'object') {
    // Limits may be tightened freely but only loosened within hard ceilings,
    // so a misconfiguration cannot unlock unbounded risk.
    const ceilings = {
      maxPositionPercent: 20, maxSectorPercent: 50, maxGrossExposurePercent: 100,
      maxDailyLossPercent: 10, maxDrawdownPercent: 25, maxOrdersPerDay: 100,
      maxOrderPercentOfADV: 5, minOrderValue: 10000,
    };
    for (const [k, v] of Object.entries(patch.limits)) {
      if (!(k in state.limits)) continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) continue;
      state.limits[k] = Math.min(n, ceilings[k] ?? n);
    }
  }
  audit('config_updated', { patch: Object.keys(patch) });
  return getState();
}

export function getDecisions(limit = 50) { return decisions.slice(0, limit); }
export function getAudit(limit = 50) { return auditLog.slice(0, limit); }

/** Kill switch: disable, cancel working orders, flatten everything. */
export async function killSwitch(who = 'user') {
  state.enabled = false;
  state.halted = true;
  state.haltReason = 'Kill switch activated';
  state.requiresManualRestart = true;
  audit('kill_switch', { by: who });

  const cancelled = await broker.cancelAllOrders();
  const closed = await broker.closeAllPositions();
  audit('kill_switch_complete', { cancelled, closed });
  return { ok: true, cancelled, closed };
}

/**
 * One decision cycle over the watchlist.
 *
 * @param fetchTechnical - async (symbol) => technical payload
 * @param fetchNews      - async (symbol) => headlines
 * @param fetchCandles   - async (symbol) => OHLCV[] (only used when a model is active)
 */
export async function runCycle({ fetchTechnical, fetchNews, fetchCandles, dryRun = false }) {
  rollDayIfNeeded();
  const startedAt = new Date().toISOString();

  if (!state.enabled && !dryRun) {
    return { ok: false, skipped: 'Bot is off', startedAt };
  }
  if (!broker.alpacaConfigured()) {
    return { ok: false, skipped: 'Broker not configured', startedAt };
  }

  let account, positions, clock;
  try {
    [account, positions, clock] = await Promise.all([
      broker.getAccount(), broker.getPositions(), broker.getClock(),
    ]);
  } catch (e) {
    state.lastError = e.message;
    audit('cycle_error', { error: e.message });
    return { ok: false, error: e.message, startedAt };
  }

  // Track peak equity so drawdown is measured from the high-water mark.
  state.peakEquity = state.peakEquity == null ? account.equity : Math.max(state.peakEquity, account.equity);
  const drawdownPercent = state.peakEquity > 0
    ? ((state.peakEquity - account.equity) / state.peakEquity) * 100 : 0;

  const posBySymbol = Object.fromEntries(positions.map(p => [p.symbol, p]));
  const riskState = {
    enabled: state.enabled, halted: state.halted,
    equity: account.equity,
    dailyPnlPercent: account.dailyPnlPercent,
    drawdownPercent,
    ordersToday: state.ordersToday,
    marketOpen: clock.isOpen,
    positions: posBySymbol,
  };

  // Halt checks run before any trading, so the bot stops itself even on a
  // cycle where it would not otherwise have traded.
  const halt = checkHaltConditions(riskState, state.limits);
  if (halt.halt && !state.halted) {
    state.halted = true;
    state.haltReason = halt.detail;
    state.requiresManualRestart = halt.requiresManualRestart;
    audit('auto_halt', { reason: halt.reason, detail: halt.detail });
  }

  const results = [];
  for (const symbol of state.watchlist) {
    try {
      const technical = await fetchTechnical(symbol);
      if (!technical || technical.available === false) {
        results.push({ symbol, action: 'SKIP', reason: 'No technical data' });
        continue;
      }

      // Decision source: a selected ML model, else the rule ensemble.
      let decision;
      const modelRec = state.activeModelId ? getModel(state.activeModelId) : null;
      if (modelRec) {
        const candles = fetchCandles ? await fetchCandles(symbol).catch(() => null) : null;
        if (!candles || candles.length < 60) {
          results.push({ symbol, action: 'SKIP', reason: 'No candle history for model' });
          continue;
        }
        const sig = modelStrategy(modelRec.artifact, candles, candles.length - 1);
        decision = {
          action: sig.action, confidence: sig.confidence,
          agreement: `${modelRec.modelType} model`,
          rationale: sig.rationale,
          signals: [{ name: `${modelRec.modelType.toUpperCase()} · ${modelRec.symbol}`, action: sig.action, confidence: sig.confidence }],
          model: { id: modelRec.id, type: modelRec.modelType, eligible: modelRec.eligible },
        };
      } else {
        decision = ensemble(technical, state.strategies, state.threshold);
      }

      // Advisory review only where there is something to review.
      if (state.useLlm && mistralConfigured() && decision.action !== 'HOLD') {
        const news = fetchNews ? await fetchNews(symbol).catch(() => []) : [];
        const review = await reviewDecision({
          symbol, decision, technical, news, position: posBySymbol[symbol] || null,
        });
        decision = applyReview(decision, review);
      }

      const price = technical.price;
      const held = posBySymbol[symbol];

      // Live trailing stop: ratchet the peak on every held position and force an
      // exit if price falls the trail distance below it. This runs AFTER the LLM
      // review, so a protective stop can never be vetoed or damped — a stop is a
      // stop. Client-side trailing complements the static broker-side bracket.
      let trailing = null;
      if (state.brackets.enabled && state.brackets.trailPercent > 0 && held?.qty > 0) {
        const t = updateTrailingStop(state.highWaterMarks[symbol], price, state.brackets.trailPercent);
        state.highWaterMarks[symbol] = t.hwm;
        trailing = { hwm: t.hwm, stop: t.stop, breached: t.breached };
        if (t.breached) {
          decision = {
            action: 'SELL', confidence: 1, agreement: 'trailing stop',
            rationale: `Trailing stop hit at ${t.stop} (peak ${t.hwm}, ${(state.brackets.trailPercent * 100).toFixed(1)}% trail)`,
            signals: [], trailingExit: true, llm: null,
          };
        }
      } else if (!held || held.qty <= 0) {
        // Flat: forget the peak so the next entry starts a fresh trail.
        delete state.highWaterMarks[symbol];
      }

      let order = null, gate = null, submitted = null;

      if (decision.action === 'BUY') {
        const qty = sizePosition(decision, account.equity, price, state.limits.maxPositionPercent);
        if (qty > 0) order = { symbol, side: 'buy', qty, price, avgDailyVolume: technical.volume?.avg20 };
      } else if (decision.action === 'SELL' && held?.qty > 0) {
        order = { symbol, side: 'sell', qty: held.qty, price };
      }

      // Attach protective exits to a new long entry when brackets are enabled.
      let bracket = null;
      if (order && order.side === 'buy' && state.brackets.enabled) {
        const b = computeBracket(price, state.brackets.slPercent, state.brackets.tpPercent);
        if (b.valid) bracket = b;
      }

      if (order) {
        gate = evaluateOrder(order, riskState, state.limits);
        if (gate.approved && !dryRun) {
          submitted = bracket
            ? await broker.submitBracketOrder({
                symbol, side: order.side, qty: gate.adjustedQty,
                stopLoss: bracket.stopLoss, takeProfit: bracket.takeProfit,
                clientOrderId: `qb-${symbol}-${Date.now()}`,
              })
            : await broker.submitOrder({
                symbol, side: order.side, qty: gate.adjustedQty,
                clientOrderId: `qb-${symbol}-${Date.now()}`,
              });
          state.ordersToday++;
          riskState.ordersToday = state.ordersToday;
          audit('order_submitted', { symbol, side: order.side, qty: gate.adjustedQty, id: submitted.id, bracket: bracket ? { sl: bracket.stopLoss, tp: bracket.takeProfit } : null });
        }
      }

      const record = {
        at: new Date().toISOString(), symbol,
        action: decision.action, confidence: decision.confidence,
        agreement: decision.agreement, rationale: decision.rationale,
        signals: decision.signals, llm: decision.llm || null,
        model: decision.model || null,
        vetoed: decision.vetoed || false, damped: decision.damped || false,
        trailingExit: decision.trailingExit || false, trailing,
        order, gate, submitted, bracket, dryRun,
      };
      results.push(record);
      decisions.unshift(record);
      if (decisions.length > MAX_LOG) decisions.length = MAX_LOG;
    } catch (e) {
      results.push({ symbol, action: 'ERROR', error: e.message });
      audit('symbol_error', { symbol, error: e.message });
    }
  }

  state.lastRun = startedAt;
  state.lastError = null;
  return {
    ok: true, startedAt, finishedAt: new Date().toISOString(), dryRun,
    account: { equity: account.equity, cash: account.cash, dailyPnlPercent: +account.dailyPnlPercent.toFixed(3), drawdownPercent: +drawdownPercent.toFixed(3) },
    marketOpen: clock.isOpen,
    halted: state.halted, haltReason: state.haltReason,
    results,
  };
}
