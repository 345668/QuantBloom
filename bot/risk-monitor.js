// ---------------------------------------------------------------------------
// Risk Monitor — the "Risk Bot".
//
// Where the risk GATE vets a single order before it is sent, the MONITOR watches
// the whole position book continuously and raises the institutional flags the
// paper's risk layer enforces:
//   - a position above 2% of NAV        -> TRIM
//   - a sector above 30% of NAV         -> REBALANCE
//   - daily drawdown beyond 5%          -> LIQUIDATE (recommend kill switch)
//
// These are ADVISORY watch thresholds, deliberately separate from (and on some
// axes stricter than) the order-gate limits — surfacing them never loosens the
// gate. The monitor recommends; it does not itself place or cancel real orders.
// Pure and deterministic.
// ---------------------------------------------------------------------------

export const MONITOR_LIMITS = {
  trimPositionPercent: 2,        // single position as % of NAV
  sectorRebalancePercent: 30,    // sector concentration as % of NAV
  liquidateDrawdownPercent: 5,   // daily drawdown that triggers liquidation
};

export function monitorBook(book, limits = MONITOR_LIMITS) {
  const equity = Number(book?.equity) || 0;
  const positions = Array.isArray(book?.positions) ? book.positions : [];
  const actions = [];

  // --- Positions: weight vs the 2% trim line ------------------------------
  const posRows = positions.map(p => {
    const mv = Math.abs(Number(p.marketValue) || 0);
    const weight = equity > 0 ? +(mv / equity * 100).toFixed(2) : 0;
    const flag = weight > limits.trimPositionPercent ? 'trim' : 'ok';
    if (flag === 'trim') {
      actions.push({ type: 'trim', symbol: p.symbol,
        detail: `${p.symbol} at ${weight}% of NAV (> ${limits.trimPositionPercent}%) — trim to target` });
    }
    return { symbol: p.symbol, sector: p.sector || 'Unknown', marketValue: mv, weight,
      unrealizedPlPercent: p.unrealizedPlPercent ?? null, flag };
  }).sort((a, b) => b.weight - a.weight);

  // --- Sectors: aggregate weight vs the 30% rebalance line ----------------
  const bySector = {};
  for (const r of posRows) bySector[r.sector] = (bySector[r.sector] || 0) + r.marketValue;
  const sectorRows = Object.entries(bySector).map(([sector, mv]) => {
    const weight = equity > 0 ? +(mv / equity * 100).toFixed(2) : 0;
    const flag = weight > limits.sectorRebalancePercent ? 'rebalance' : 'ok';
    if (flag === 'rebalance') {
      actions.push({ type: 'rebalance', sector,
        detail: `${sector} at ${weight}% of NAV (> ${limits.sectorRebalancePercent}%) — rebalance` });
    }
    return { sector, weight, flag };
  }).sort((a, b) => b.weight - a.weight);

  // --- Daily drawdown: the 5% liquidation trigger -------------------------
  const dailyDrawdown = Math.max(0, -(Number(book?.dailyPnlPercent) || 0));
  const peakDrawdown = Math.max(0, Number(book?.drawdownPercent) || 0);
  const liquidate = dailyDrawdown >= limits.liquidateDrawdownPercent;
  if (liquidate) {
    actions.push({ type: 'liquidate',
      detail: `Daily drawdown ${dailyDrawdown.toFixed(2)}% ≥ ${limits.liquidateDrawdownPercent}% — recommend kill switch / full liquidation` });
  }

  const grossExposure = equity > 0
    ? +(posRows.reduce((s, r) => s + r.marketValue, 0) / equity * 100).toFixed(2) : 0;

  const status = liquidate ? 'critical' : actions.length ? 'watch' : 'ok';

  return {
    asOf: new Date().toISOString(),
    equity,
    status,
    positions: posRows,
    sectors: sectorRows,
    dailyDrawdown: +dailyDrawdown.toFixed(2),
    peakDrawdown: +peakDrawdown.toFixed(2),
    grossExposure,
    liquidate,
    actions,
    limits,
    counts: {
      trims: actions.filter(a => a.type === 'trim').length,
      rebalances: actions.filter(a => a.type === 'rebalance').length,
    },
  };
}
