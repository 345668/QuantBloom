import { useState, useEffect, useCallback, useMemo } from 'react';
import { loadJSON, saveJSON } from '../utils/storage.js';
import { usePolling } from './usePolling.js';

const LOTS_KEY = 'quantbloom_lots';

/**
 * Portfolio state: an append-only list of lots (BUY/SELL transactions).
 *
 * Holdings and realised P&L are derived from the lot history rather than
 * stored, so the blotter and the position table can never disagree.
 * Sells are matched FIFO against open buy lots.
 */
export function usePortfolio() {
  const [lots, setLots] = useState(() => loadJSON(LOTS_KEY) || []);

  useEffect(() => { saveJSON(LOTS_KEY, lots); }, [lots]);

  const addLot = useCallback((lot) => {
    setLots(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbol: lot.symbol.toUpperCase(),
      side: lot.side,                      // 'BUY' | 'SELL'
      quantity: Math.abs(Number(lot.quantity)),
      price: Number(lot.price),
      fees: Number(lot.fees) || 0,
      date: lot.date || new Date().toISOString().slice(0, 10),
    }]);
  }, []);

  const removeLot = useCallback((id) => {
    setLots(prev => prev.filter(l => l.id !== id));
  }, []);

  const clearAll = useCallback(() => setLots([]), []);

  // --- Derive open positions and realised P&L via FIFO lot matching ---
  const { positions, realised } = useMemo(() => {
    const bySymbol = {};
    const closed = [];

    const ordered = [...lots].sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));

    for (const lot of ordered) {
      if (!bySymbol[lot.symbol]) bySymbol[lot.symbol] = { open: [], fees: 0 };
      const book = bySymbol[lot.symbol];
      book.fees += lot.fees;

      if (lot.side === 'BUY') {
        book.open.push({ qty: lot.quantity, price: lot.price, date: lot.date });
        continue;
      }

      // SELL: consume the oldest open buy lots first.
      let remaining = lot.quantity;
      while (remaining > 0 && book.open.length) {
        const oldest = book.open[0];
        const matched = Math.min(remaining, oldest.qty);
        closed.push({
          symbol: lot.symbol,
          quantity: matched,
          entryPrice: oldest.price,
          exitPrice: lot.price,
          entryDate: oldest.date,
          exitDate: lot.date,
          pnl: (lot.price - oldest.price) * matched,
        });
        oldest.qty -= matched;
        remaining -= matched;
        if (oldest.qty <= 0) book.open.shift();
      }
    }

    const positions = Object.entries(bySymbol)
      .map(([symbol, book]) => {
        const quantity = book.open.reduce((s, l) => s + l.qty, 0);
        if (quantity <= 0) return null;
        const costBasis = book.open.reduce((s, l) => s + l.qty * l.price, 0);
        return { symbol, quantity, costBasis, avgPrice: costBasis / quantity, fees: book.fees };
      })
      .filter(Boolean);

    return { positions, realised: closed };
  }, [lots]);

  // --- Live quotes for open positions ---
  const symbols = positions.map(p => p.symbol).join(',');
  const { data: quotes } = usePolling(
    symbols ? `/api/v1/quotes?symbols=${symbols}` : null,
    15000
  );

  const priceBySymbol = useMemo(() => {
    const m = new Map();
    if (Array.isArray(quotes)) for (const q of quotes) m.set(q.symbol, q);
    return m;
  }, [quotes]);

  // --- Mark positions to market ---
  const marked = useMemo(() => positions.map(p => {
    const q = priceBySymbol.get(p.symbol);
    const price = q?.price ?? null;
    const marketValue = price != null ? price * p.quantity : null;
    const unrealisedPnl = marketValue != null ? marketValue - p.costBasis : null;
    return {
      ...p,
      price,
      dayChangePercent: q?.changePercent ?? null,
      dayPnl: q?.change != null ? q.change * p.quantity : null,
      marketValue,
      unrealisedPnl,
      unrealisedPct: unrealisedPnl != null && p.costBasis ? (unrealisedPnl / p.costBasis) * 100 : null,
    };
  }), [positions, priceBySymbol]);

  const totals = useMemo(() => {
    const marketValue = marked.reduce((s, p) => s + (p.marketValue ?? 0), 0);
    const costBasis = marked.reduce((s, p) => s + p.costBasis, 0);
    const unrealisedPnl = marketValue - costBasis;
    const dayPnl = marked.reduce((s, p) => s + (p.dayPnl ?? 0), 0);
    const realisedPnl = realised.reduce((s, r) => s + r.pnl, 0);
    return {
      marketValue, costBasis, unrealisedPnl,
      unrealisedPct: costBasis ? (unrealisedPnl / costBasis) * 100 : 0,
      dayPnl, realisedPnl, totalPnl: unrealisedPnl + realisedPnl,
      positionCount: marked.length,
    };
  }, [marked, realised]);

  // Weights need the total, so they're applied after totals are known.
  const withWeights = useMemo(() => marked.map(p => ({
    ...p,
    weight: totals.marketValue && p.marketValue != null ? (p.marketValue / totals.marketValue) * 100 : null,
  })), [marked, totals.marketValue]);

  return { lots, addLot, removeLot, clearAll, positions: withWeights, realised, totals };
}

export default usePortfolio;
