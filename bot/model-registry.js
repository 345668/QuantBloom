// ---------------------------------------------------------------------------
// Model training orchestration, registry, and the publish gate.
//
// The gate is the point of this file. A model can only reach the public page if
// it clears every validation bar below — measured OUT OF SAMPLE, on the held-
// out test period, using the same tested backtester and overfitting guards as
// everything else. This is the same principle applied to live trading: the
// deliberate, gated step is where correctness is enforced, and it cannot be
// bypassed by wishing.
// ---------------------------------------------------------------------------

import { buildDataset, temporalSplit } from './features.js';
import { trainLogistic, trainPCA, evaluate, modelStrategy } from './model.js';
import { trainGBM, featureImportance } from './gbm.js';
import { summarise, deflatedSharpe } from './statistics.js';
import { loadStore, persist } from './persistence.js';

export const MODEL_TYPES = ['logistic', 'gbm', 'pca'];

// Publish thresholds. Deliberately demanding — most strategies fail these, and
// that is the correct outcome, not a bug to be tuned away.
export const PUBLISH_GATE = {
  minTestAuc: 0.55,          // better than a coin flip at telling up from down
  minOutOfSampleSharpe: 0.5, // risk-adjusted, on unseen data
  minDeflatedSharpe: 0.90,   // survives adjustment for how many were tried
  mustBeatBenchmark: true,   // beat buy-and-hold over the test window
  minTestTrades: 5,          // enough trades for the stats to mean anything
  minTestRows: 60,           // enough held-out data to judge at all
};

// Stores are hydrated from disk on load so models survive a restart during
// local research (persistence.js). On a read-only serverless FS they start
// empty and stay in-memory — same behaviour, just not durable there.
const _init = loadStore();
const trained = _init.trained;       // every model trained
const published = _init.published;   // models that cleared the gate and were published
const MAX_TRAINED = 50;

function id() { return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

/**
 * Backtest a trained model over the held-out test window by turning it into a
 * strategy — the same path a rule strategy takes. No look-ahead: at each test
 * bar the model sees only prior bars.
 */
function backtestModel(model, candles, testStartTime, opts = {}) {
  const { initialCapital = 100000, maxPositionPercent = 20 } = opts;
  const startIdx = candles.findIndex(c => c.time >= testStartTime);
  if (startIdx < 60) return null;

  let cash = initialCapital, shares = 0;
  const equity = [];
  let trades = 0;
  const slip = 0.0007; // 7bps round-trip friction proxy

  for (let t = startIdx; t < candles.length - 1; t++) {
    const sig = modelStrategy(model, candles, t);
    const next = candles[t + 1];
    const eq = cash + shares * candles[t].close;
    if (sig.action === 'BUY' && shares === 0) {
      const spend = eq * (maxPositionPercent / 100) * Math.max(sig.confidence, 0.25);
      const px = next.open * (1 + slip);
      const qty = Math.floor(spend / px);
      if (qty > 0 && qty * px <= cash) { cash -= qty * px; shares += qty; trades++; }
    } else if (sig.action === 'SELL' && shares > 0) {
      cash += shares * next.open * (1 - slip); shares = 0; trades++;
    }
    equity.push(cash + shares * candles[t].close);
  }
  equity.push(cash + shares * candles[candles.length - 1].close);

  const rets = [];
  for (let i = 1; i < equity.length; i++) rets.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  const stats = summarise(equity, rets, 252, 0.045);

  // Buy-and-hold over the identical window.
  const bh = candles.slice(startIdx).map(c => c.close);
  const bhReturn = bh.length > 1 ? ((bh[bh.length - 1] - bh[0]) / bh[0]) * 100 : 0;

  const dsr = rets.length >= 4 ? deflatedSharpe(rets, 20) : null;

  return {
    stats, trades,
    benchmarkReturn: +bhReturn.toFixed(2),
    beatBenchmark: stats ? stats.totalReturn > bhReturn : false,
    deflatedSharpe: dsr?.deflatedSharpe ?? null,
  };
}

/** Evaluate a model artifact against the gate. Pure and inspectable. */
export function evaluateGate({ testMetrics, backtest }) {
  const reasons = [];
  const g = PUBLISH_GATE;

  if (!testMetrics || testMetrics.n < g.minTestRows) reasons.push(`Need ${g.minTestRows}+ test rows`);
  if (testMetrics && testMetrics.auc != null && testMetrics.auc < g.minTestAuc) {
    reasons.push(`Test AUC ${testMetrics.auc} < ${g.minTestAuc} (no predictive edge)`);
  }
  if (!backtest || !backtest.stats) reasons.push('No out-of-sample backtest');
  else {
    if (backtest.trades < g.minTestTrades) reasons.push(`Only ${backtest.trades} test trades (need ${g.minTestTrades})`);
    if (backtest.stats.sharpe < g.minOutOfSampleSharpe) reasons.push(`OOS Sharpe ${backtest.stats.sharpe} < ${g.minOutOfSampleSharpe}`);
    if (g.mustBeatBenchmark && !backtest.beatBenchmark) {
      reasons.push(`Lost to buy-and-hold (${backtest.stats.totalReturn}% vs ${backtest.benchmarkReturn}%)`);
    }
    if (backtest.deflatedSharpe != null && backtest.deflatedSharpe < g.minDeflatedSharpe) {
      reasons.push(`Deflated Sharpe ${backtest.deflatedSharpe} < ${g.minDeflatedSharpe} (not distinguishable from luck)`);
    }
  }

  return { eligible: reasons.length === 0, reasons, gate: g };
}

/**
 * Train, validate against the gate, and register a model. Does NOT publish —
 * publishing is always a separate, explicit act.
 */
export function trainAndRegister(candles, config = {}) {
  const {
    symbol = '', range = '5y', modelType = 'logistic',
    label = { up: 0.03, down: 0.02, horizon: 10 },
    testFraction = 0.3, epochs = 400, lr = 0.1, l2 = 0.01,
  } = config;

  if (!MODEL_TYPES.includes(modelType)) {
    return { ok: false, error: `Model type "${modelType}" trains via the local Python pipeline (see MODEL_TRAINING.md), not in-app. In-app: ${MODEL_TYPES.join(', ')}.` };
  }
  if (!candles || candles.length < 300) {
    return { ok: false, error: `Need 300+ bars, got ${candles?.length || 0}` };
  }

  const dataset = buildDataset(candles, label);
  if (dataset.X.length < 100) {
    return { ok: false, error: `Only ${dataset.X.length} labeled rows; need 100+` };
  }

  const split = temporalSplit(dataset, testFraction);
  const model = modelType === 'gbm'
    ? trainGBM(split.train.X, split.train.y, {
        nEstimators: config.nEstimators || 80, maxDepth: config.maxDepth || 3,
        learningRate: config.learningRate || 0.08, minLeaf: config.minLeaf || 15,
        featureNames: dataset.featureNames,
      })
    : modelType === 'pca'
    ? trainPCA(split.train.X, split.train.y, { k: config.k || 5, featureNames: dataset.featureNames })
    : trainLogistic(split.train.X, split.train.y, { epochs, lr, l2, featureNames: dataset.featureNames });
  if (!model) return { ok: false, error: 'Training failed' };

  const trainMetrics = evaluate(model, split.train.X, split.train.y);
  const testMetrics = evaluate(model, split.test.X, split.test.y);
  const testStartTime = split.test.times[0];
  const backtest = backtestModel(model, candles, testStartTime, config);

  const gate = evaluateGate({ testMetrics, backtest });

  const record = {
    id: id(),
    symbol, range, modelType,
    createdAt: new Date().toISOString(),
    config: { label, testFraction, epochs, lr, l2 },
    artifact: model,
    trainMetrics, testMetrics, backtest,
    // Tree models can say which inputs they used — half the value of a GBM.
    featureImportance: modelType === 'gbm' ? featureImportance(model).slice(0, 8) : null,
    // PCA reports how much variance its latent factors capture.
    pcaVariance: modelType === 'pca' ? { perComponent: model.explainedVariance, total: model.totalExplained } : null,
    eligible: gate.eligible,
    gateReasons: gate.reasons,
    published: false,
  };

  trained.unshift(record);
  if (trained.length > MAX_TRAINED) trained.length = MAX_TRAINED;
  persist({ trained, published });

  return { ok: true, model: record, gate };
}

export function listTrained() {
  // Omit the weights from the list view; they are large and fetched per-model.
  // artifact shape differs by type (weights for logistic, trees for gbm).
  return trained.map(({ artifact, ...rest }) => ({ ...rest, featureCount: artifact.featureNames?.length ?? 0 }));
}

export function getModel(modelId) {
  return trained.find(m => m.id === modelId) || null;
}

/**
 * Publish a model to the public page — but only if it still clears the gate.
 * Re-checking here means a model can never be published by manipulating the
 * client; the server is the authority.
 */
export function publishModel(modelId) {
  const m = getModel(modelId);
  if (!m) return { ok: false, error: 'Model not found' };
  const gate = evaluateGate({ testMetrics: m.testMetrics, backtest: m.backtest });
  if (!gate.eligible) {
    return { ok: false, error: 'Model does not meet the publish gate', reasons: gate.reasons };
  }
  if (published.some(p => p.id === m.id)) return { ok: false, error: 'Already published' };

  m.published = true;
  published.unshift({
    id: m.id, symbol: m.symbol, modelType: m.modelType,
    publishedAt: new Date().toISOString(),
    testMetrics: m.testMetrics, backtest: m.backtest,
    config: m.config, artifact: m.artifact,
  });
  persist({ trained, published });
  return { ok: true, published: published.length };
}

export function listPublished() {
  return published.map(({ artifact, ...rest }) => rest);
}

export function unpublish(modelId) {
  const i = published.findIndex(p => p.id === modelId);
  if (i < 0) return { ok: false, error: 'Not published' };
  published.splice(i, 1);
  const m = getModel(modelId);
  if (m) m.published = false;
  persist({ trained, published });
  return { ok: true };
}
