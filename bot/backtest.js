// ---------------------------------------------------------------------------
// Event-driven backtester.
//
// Two properties matter more than anything else here:
//
// 1. POINT-IN-TIME CORRECTNESS. At bar t the strategy is handed candles
//    [0..t] and nothing more. Look-ahead is the single most common reason a
//    retail backtest produces returns that evaporate in live trading.
//
// 2. SHARED CODE PATH. Signals come from bot/strategies.js and indicators from
//    bot/indicators.js — the same modules the live engine uses. A backtest that
//    runs different code is not testing what ships.
//
// Costs and slippage are applied on every fill. A frictionless backtest
// flatters high-turnover strategies enormously, which is exactly the kind of
// strategy a naive optimiser will select.
// ---------------------------------------------------------------------------

import { computeTechnical } from './indicators.js';
import { ensemble, sizePosition, STRATEGIES } from './strategies.js';
import { summarise, deflatedSharpe, probabilityOfBacktestOverfitting, stdev, sharpe } from './statistics.js';

export const DEFAULT_COSTS = {
  commissionPerShare: 0.005,   // typical retail per-share commission
  commissionMinimum: 1.0,
  slippageBps: 5,              // 5 basis points of adverse price movement
  spreadBps: 2,                // half-spread paid on entry and exit
};

/** Fill price after slippage and half-spread, always against the trader. */
function fillPrice(price, side, costs) {
  const adverse = (costs.slippageBps + costs.spreadBps) / 10000;
  return side === 'buy' ? price * (1 + adverse) : price * (1 - adverse);
}

function commission(shares, costs) {
  return Math.max(shares * costs.commissionPerShare, costs.commissionMinimum);
}

/**
 * Run a single-symbol backtest.
 *
 * @param candles    full OHLCV history, oldest first
 * @param options.strategies  strategy keys to enable
 * @param options.threshold   ensemble agreement threshold
 * @param options.warmup      bars reserved for indicator warm-up
 */
export function runBacktest(candles, options = {}) {
  const {
    symbol = '',
    strategies = Object.keys(STRATEGIES),
    threshold = 0.15,
    initialCapital = 100000,
    maxPositionPercent = 20,
    costs = DEFAULT_COSTS,
    warmup = 200,
    periodsPerYear = 252,
    rfAnnual = 0.045,
  } = options;

  if (!candles || candles.length < warmup + 20) {
    return { available: false, message: `Need at least ${warmup + 20} bars, got ${candles?.length || 0}` };
  }

  let cash = initialCapital;
  let shares = 0;
  const equityCurve = [];
  const trades = [];
  const decisions = [];
  let totalCommission = 0, totalSlippage = 0;

  for (let t = warmup; t < candles.length; t++) {
    // ---- Point-in-time slice: bars 0..t inclusive, nothing beyond ----------
    const visible = candles.slice(0, t + 1);
    const bar = candles[t];

    const ta = computeTechnical(visible, symbol);
    const decision = ta.available
      ? ensemble(ta, strategies, threshold)
      : { action: 'HOLD', confidence: 0, signals: [] };

    // Decisions are made on bar t's close and filled at the NEXT bar's open.
    // Filling at the same close the signal was computed from would be a subtle
    // look-ahead: that price is not tradable once you have seen it.
    const nextBar = candles[t + 1];
    if (nextBar) {
      const equityNow = cash + shares * bar.close;

      if (decision.action === 'BUY' && shares === 0) {
        const qty = sizePosition(decision, equityNow, nextBar.open, maxPositionPercent);
        if (qty > 0) {
          const px = fillPrice(nextBar.open, 'buy', costs);
          const comm = commission(qty, costs);
          const cost = qty * px + comm;
          if (cost <= cash) {
            const slip = qty * (px - nextBar.open);
            cash -= cost; shares += qty;
            totalCommission += comm; totalSlippage += slip;
            trades.push({
              time: nextBar.time, side: 'buy', qty, price: +px.toFixed(4),
              reference: nextBar.open, commission: +comm.toFixed(2), slippage: +slip.toFixed(2),
              confidence: decision.confidence, rationale: decision.rationale,
            });
          }
        }
      } else if (decision.action === 'SELL' && shares > 0) {
        const px = fillPrice(nextBar.open, 'sell', costs);
        const comm = commission(shares, costs);
        const slip = shares * (nextBar.open - px);
        cash += shares * px - comm;
        totalCommission += comm; totalSlippage += slip;
        trades.push({
          time: nextBar.time, side: 'sell', qty: shares, price: +px.toFixed(4),
          reference: nextBar.open, commission: +comm.toFixed(2), slippage: +slip.toFixed(2),
          confidence: decision.confidence, rationale: decision.rationale,
        });
        shares = 0;
      }
    }

    equityCurve.push(cash + shares * bar.close);
    decisions.push({ time: bar.time, action: decision.action, confidence: decision.confidence });
  }

  // Mark the final bar so the curve ends at a real, closable value.
  const last = candles[candles.length - 1];
  const finalEquity = cash + shares * last.close;

  const periodReturns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    periodReturns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }

  const stats = summarise(equityCurve, periodReturns, periodsPerYear, rfAnnual);

  // ---- Buy and hold over the identical window, with the same entry cost ----
  const bhStart = candles[warmup];
  const bhEntry = fillPrice(bhStart.close, 'buy', costs);
  const bhShares = Math.floor(initialCapital / bhEntry);
  const bhCash = initialCapital - bhShares * bhEntry - commission(bhShares, costs);
  const bhCurve = candles.slice(warmup).map(c => bhCash + bhShares * c.close);
  const bhReturns = [];
  for (let i = 1; i < bhCurve.length; i++) {
    bhReturns.push((bhCurve[i] - bhCurve[i - 1]) / bhCurve[i - 1]);
  }
  const bhStats = summarise(bhCurve, bhReturns, periodsPerYear, rfAnnual);

  return {
    available: true,
    symbol,
    config: { strategies, threshold, initialCapital, maxPositionPercent, costs, warmup },
    bars: equityCurve.length,
    from: candles[warmup]?.time, to: last.time,
    finalEquity: +finalEquity.toFixed(2),
    stats,
    benchmark: bhStats,
    // The number that decides whether the strategy was worth running at all.
    excessReturn: stats && bhStats ? +(stats.totalReturn - bhStats.totalReturn).toFixed(2) : null,
    beatBenchmark: stats && bhStats ? stats.totalReturn > bhStats.totalReturn : null,
    trades: trades.length,
    tradeLog: trades.slice(-40),
    costs: {
      totalCommission: +totalCommission.toFixed(2),
      totalSlippage: +totalSlippage.toFixed(2),
      totalCost: +(totalCommission + totalSlippage).toFixed(2),
      // Costs as a share of starting capital — the drag a frictionless
      // backtest would have hidden entirely.
      costDragPercent: +(((totalCommission + totalSlippage) / initialCapital) * 100).toFixed(2),
    },
    equityCurve: equityCurve.map((v, i) => ({
      time: candles[warmup + i].time,
      equity: +v.toFixed(2),
      benchmark: bhCurve[i] != null ? +bhCurve[i].toFixed(2) : null,
    })),
    periodReturns,
  };
}

/**
 * Walk-forward: repeatedly fit on a window, evaluate on the period after it.
 *
 * A single train/test split tells you almost nothing — it is one draw. Rolling
 * the window shows whether performance persists or was a one-off.
 */
export function walkForward(candles, options = {}) {
  const { folds = 4, warmup = 200, ...rest } = options;
  const usable = candles.length - warmup;
  if (usable < folds * 60) {
    return { available: false, message: `Need ~${folds * 60 + warmup} bars for ${folds} folds` };
  }

  const foldSize = Math.floor(usable / folds);
  const results = [];

  for (let f = 0; f < folds; f++) {
    const end = warmup + foldSize * (f + 1);
    const start = warmup + foldSize * f;
    // Each fold still carries the full warm-up history before its own window,
    // so indicators are never computed from a truncated series.
    const slice = candles.slice(0, end);
    const r = runBacktest(slice, { ...rest, warmup: start });
    if (r.available) {
      results.push({
        fold: f + 1,
        from: candles[start]?.time, to: candles[end - 1]?.time,
        totalReturn: r.stats?.totalReturn ?? null,
        sharpe: r.stats?.sharpe ?? null,
        maxDrawdown: r.stats?.maxDrawdown ?? null,
        benchmarkReturn: r.benchmark?.totalReturn ?? null,
        beatBenchmark: r.beatBenchmark,
        trades: r.trades,
      });
    }
  }

  if (!results.length) return { available: false, message: 'No fold produced a result' };

  const rets = results.map(r => r.totalReturn).filter(v => v != null);
  const beats = results.filter(r => r.beatBenchmark).length;

  return {
    available: true,
    folds: results,
    consistency: {
      foldsBeatingBenchmark: beats,
      totalFolds: results.length,
      // Persistence across folds is the point. A strategy that wins once and
      // loses three times has not shown anything.
      beatRate: +((beats / results.length) * 100).toFixed(1),
      meanReturn: rets.length ? +(rets.reduce((a, b) => a + b, 0) / rets.length).toFixed(2) : null,
      returnStdev: rets.length > 1 ? +stdev(rets).toFixed(2) : null,
      worstFold: rets.length ? +Math.min(...rets).toFixed(2) : null,
      bestFold: rets.length ? +Math.max(...rets).toFixed(2) : null,
    },
  };
}

/**
 * Sweep strategy combinations, then judge the winner honestly.
 *
 * Running many variants and reporting the best one is how backtests lie. This
 * returns the Deflated Sharpe (adjusted for how many variants were tried) and
 * the Probability of Backtest Overfitting alongside the raw numbers.
 */
export function sweepStrategies(candles, options = {}) {
  const { thresholds = [0.1, 0.15, 0.25], ...rest } = options;
  const keys = Object.keys(STRATEGIES);

  // Every non-empty subset would be 31 combinations; cap the search so the
  // sweep stays fast and the trial count stays interpretable.
  const combos = [
    ...keys.map(k => [k]),
    ['trend', 'consensus'],
    ['rsi', 'bollinger'],
    ['trend', 'macd'],
    keys,
  ];

  const variants = [];
  for (const strategies of combos) {
    for (const threshold of thresholds) {
      const r = runBacktest(candles, { ...rest, strategies, threshold });
      if (r.available && r.stats) {
        variants.push({
          strategies, threshold,
          totalReturn: r.stats.totalReturn,
          sharpe: r.stats.sharpe,
          maxDrawdown: r.stats.maxDrawdown,
          trades: r.trades,
          beatBenchmark: r.beatBenchmark,
          periodReturns: r.periodReturns,
        });
      }
    }
  }

  if (!variants.length) return { available: false, message: 'No variant produced a result' };

  const ranked = [...variants].sort((a, b) => b.sharpe - a.sharpe);
  const best = ranked[0];

  // Variance of Sharpe across trials feeds the deflation.
  const sharpes = variants.map(v => v.sharpe);
  const sharpeVar = sharpes.length > 1 ? Math.pow(stdev(sharpes), 2) : 0;
  // deflatedSharpe works in per-period units; de-annualise.
  const perPeriod = best.periodReturns;
  const dsr = deflatedSharpe(perPeriod, variants.length,
    sharpeVar / (options.periodsPerYear || 252));

  const pbo = probabilityOfBacktestOverfitting(
    variants.map(v => v.periodReturns), 6);

  return {
    available: true,
    trials: variants.length,
    best: {
      strategies: best.strategies, threshold: best.threshold,
      totalReturn: best.totalReturn, sharpe: best.sharpe,
      maxDrawdown: best.maxDrawdown, trades: best.trades,
      beatBenchmark: best.beatBenchmark,
    },
    ranking: ranked.slice(0, 10).map(({ periodReturns, ...v }) => v),
    overfitting: {
      deflatedSharpe: dsr?.deflatedSharpe ?? null,
      expectedMaxSharpeByLuck: dsr?.expectedMaxSharpe ?? null,
      pbo: pbo?.pbo ?? null,
      pboSplits: pbo?.splits ?? null,
      // Plain-language verdict, because the numbers are easy to misread.
      verdict: verdictFor(dsr?.deflatedSharpe, pbo?.pbo),
    },
  };
}

function verdictFor(dsr, pbo) {
  if (dsr == null && pbo == null) return 'Not enough data to judge.';
  if (dsr != null && dsr < 0.9) {
    return 'Not distinguishable from luck — the best variant is about what you would expect from trying this many.';
  }
  if (pbo != null && pbo > 0.5) {
    return 'High overfitting risk — the in-sample winner usually underperforms out of sample.';
  }
  if (dsr != null && dsr >= 0.95 && (pbo == null || pbo < 0.3)) {
    return 'Survives deflation and shows low overfitting risk. Still needs forward testing.';
  }
  return 'Mixed evidence — treat with caution and forward test before trusting it.';
}
