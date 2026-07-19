// ---------------------------------------------------------------------------
// Bot engine — state, decision loop, execution.
//
// The bot is OFF by default and stays off across restarts unless explicitly
// switched on. Nothing here places an order that has not passed the risk gate.
// ---------------------------------------------------------------------------

import { evaluateOrder, checkHaltConditions, DEFAULT_LIMITS } from './risk-gate.js';
import { ensemble, sizePosition, STRATEGIES, PRESETS, describeStrategies, describePresets } from './strategies.js';
import { reviewDecision, applyReview, mistralConfigured, getBudget } from './mistral.js';
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
  useLlm: true,
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
  };
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
 */
export async function runCycle({ fetchTechnical, fetchNews, dryRun = false }) {
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

      let decision = ensemble(technical, state.strategies, state.threshold);

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
      let order = null, gate = null, submitted = null;

      if (decision.action === 'BUY') {
        const qty = sizePosition(decision, account.equity, price, state.limits.maxPositionPercent);
        if (qty > 0) order = { symbol, side: 'buy', qty, price, avgDailyVolume: technical.volume?.avg20 };
      } else if (decision.action === 'SELL' && held?.qty > 0) {
        order = { symbol, side: 'sell', qty: held.qty, price };
      }

      if (order) {
        gate = evaluateOrder(order, riskState, state.limits);
        if (gate.approved && !dryRun) {
          submitted = await broker.submitOrder({
            symbol, side: order.side, qty: gate.adjustedQty,
            clientOrderId: `qb-${symbol}-${Date.now()}`,
          });
          state.ordersToday++;
          riskState.ordersToday = state.ordersToday;
          audit('order_submitted', { symbol, side: order.side, qty: gate.adjustedQty, id: submitted.id });
        }
      }

      const record = {
        at: new Date().toISOString(), symbol,
        action: decision.action, confidence: decision.confidence,
        agreement: decision.agreement, rationale: decision.rationale,
        signals: decision.signals, llm: decision.llm || null,
        vetoed: decision.vetoed || false, damped: decision.damped || false,
        order, gate, submitted, dryRun,
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
