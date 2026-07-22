import { useState, useEffect, useCallback, useRef } from 'react';
import { loadJSON, saveJSON } from '../utils/storage.js';

const KEY = 'quantbloom_drawings';

export const TOOLS = [
  { id: 'trend', label: 'Trend', points: 2 },
  { id: 'hline', label: 'H-Line', points: 1 },
  { id: 'fib', label: 'Fib', points: 2 },
  { id: 'rect', label: 'Rect', points: 2 },
];

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * SVG overlay for chart annotations.
 *
 * Anchors are stored as {time, price} rather than pixels, so drawings stay
 * pinned to the data when the user pans or zooms. The overlay repaints on
 * every visible-range change and on resize.
 */
export default function ChartDrawings({ chartRef, seriesRef, containerRef, symbol, tool, onToolDone }) {
  const [drawings, setDrawings] = useState([]);
  const [pending, setPending] = useState([]);   // anchors placed so far
  const [, forceRepaint] = useState(0);
  const repaint = useCallback(() => forceRepaint(n => n + 1), []);
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;

  // Load this symbol's drawings whenever the symbol changes.
  useEffect(() => {
    const all = loadJSON(KEY) || {};
    setDrawings(all[symbol] || []);
    setPending([]);
  }, [symbol]);

  const persist = useCallback((next) => {
    const all = loadJSON(KEY) || {};
    all[symbol] = next;
    saveJSON(KEY, all);
  }, [symbol]);

  // Repaint when the chart is panned, zoomed or resized.
  useEffect(() => {
    const chart = chartRef.current;
    const el = containerRef.current;
    if (!chart || !el) return;
    const ts = chart.timeScale();
    ts.subscribeVisibleTimeRangeChange(repaint);
    const ro = new ResizeObserver(repaint);
    ro.observe(el);
    // Initial paint once the chart has laid out.
    const t = setTimeout(repaint, 60);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      try { ts.unsubscribeVisibleTimeRangeChange(repaint); } catch {}
    };
  }, [chartRef, containerRef, repaint, symbol]);

  // Convert a click into a {time, price} anchor.
  const handleClick = useCallback((e) => {
    if (!tool) return;
    const chart = chartRef.current;
    const series = seriesRef.current?.candle;
    const el = containerRef.current;
    if (!chart || !series || !el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    if (time == null || price == null) return;

    const spec = TOOLS.find(t => t.id === tool);
    const next = [...pending, { time, price }];

    if (next.length >= spec.points) {
      const drawing = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: tool, anchors: next };
      const updated = [...drawingsRef.current, drawing];
      setDrawings(updated);
      persist(updated);
      setPending([]);
      onToolDone?.();
    } else {
      setPending(next);
    }
  }, [tool, pending, chartRef, seriesRef, containerRef, persist, onToolDone]);

  const removeLast = useCallback(() => {
    const updated = drawingsRef.current.slice(0, -1);
    setDrawings(updated);
    persist(updated);
  }, [persist]);

  const clearAll = useCallback(() => {
    setDrawings([]);
    persist([]);
    setPending([]);
  }, [persist]);

  // Expose undo/clear to the parent toolbar via the DOM node.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.__drawings = { removeLast, clearAll, count: drawings.length };
  }, [containerRef, removeLast, clearAll, drawings.length]);

  // --- Projection helpers (logical → pixel) ---
  const chart = chartRef.current;
  const series = seriesRef.current?.candle;
  const el = containerRef.current;
  const W = el?.clientWidth || 0;
  const H = el?.clientHeight || 0;

  const toXY = (a) => {
    if (!chart || !series) return null;
    const x = chart.timeScale().timeToCoordinate(a.time);
    const y = series.priceToCoordinate(a.price);
    return (x == null || y == null) ? null : { x, y };
  };

  const renderDrawing = (d) => {
    const pts = d.anchors.map(toXY);
    if (pts.some(p => p == null)) return null;
    const [p1, p2] = pts;

    switch (d.type) {
      case 'trend':
        return <line key={d.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="dw-line" />;

      case 'hline':
        return (
          <g key={d.id}>
            <line x1={0} y1={p1.y} x2={W} y2={p1.y} className="dw-line dw-hline" />
            <text x={4} y={p1.y - 3} className="dw-label">{d.anchors[0].price.toFixed(2)}</text>
          </g>
        );

      case 'rect': {
        const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y);
        return <rect key={d.id} x={x} y={y} width={Math.abs(p2.x - p1.x)} height={Math.abs(p2.y - p1.y)} className="dw-rect" />;
      }

      case 'fib': {
        const hi = Math.max(d.anchors[0].price, d.anchors[1].price);
        const lo = Math.min(d.anchors[0].price, d.anchors[1].price);
        const x1 = Math.min(p1.x, p2.x), x2 = Math.max(p1.x, p2.x);
        return (
          <g key={d.id}>
            {FIB_LEVELS.map(lvl => {
              const price = hi - (hi - lo) * lvl;
              const y = series.priceToCoordinate(price);
              if (y == null) return null;
              return (
                <g key={lvl}>
                  <line x1={x1} y1={y} x2={x2} y2={y} className="dw-fib" />
                  <text x={x2 + 3} y={y + 3} className="dw-label">
                    {(lvl * 100).toFixed(1)}% · {price.toFixed(2)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      }
      default: return null;
    }
  };

  const pendingPts = pending.map(toXY).filter(Boolean);

  return (
    <svg
      className={`chart-drawings ${tool ? 'active' : ''}`}
      width={W} height={H}
      onClick={handleClick}
    >
      {drawings.map(renderDrawing)}
      {pendingPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" className="dw-pending" />)}
    </svg>
  );
}
