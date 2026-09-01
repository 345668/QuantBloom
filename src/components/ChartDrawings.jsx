import { useState, useEffect, useCallback, useRef } from 'react';
import { loadJSON, saveJSON } from '../utils/storage.js';
import {
  measure as measureStats, positionRR, fibRetracementLevels, fibExtensionLevels,
  barsBetween,
} from '../../charting/drawing-math.js';

const KEY = 'quantbloom_drawings';

export const TOOLS = [
  { id: 'trend', label: 'Trend', points: 2 },
  { id: 'hline', label: 'H-Line', points: 1 },
  { id: 'fib', label: 'Fib', points: 2 },
  { id: 'fibext', label: 'Fib Ext', points: 3 },
  { id: 'rect', label: 'Rect', points: 2 },
  { id: 'ellipse', label: 'Ellipse', points: 2 },
  { id: 'arrow', label: 'Arrow', points: 2 },
  { id: 'channel', label: 'Channel', points: 3 },
  { id: 'measure', label: 'Measure', points: 2 },
  { id: 'long', label: 'Long', points: 3 },
  { id: 'short', label: 'Short', points: 3 },
  { id: 'text', label: 'Text', points: 1 },
];

/**
 * SVG overlay for chart annotations.
 *
 * Anchors are stored as {time, price} rather than pixels, so drawings stay
 * pinned to the data when the user pans or zooms. The overlay repaints on
 * every visible-range change and on resize.
 */
export default function ChartDrawings({ chartRef, seriesRef, containerRef, symbol, tool, onToolDone, candles = [] }) {
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
      // The text tool captures a label at placement time.
      if (tool === 'text') {
        const label = (typeof window !== 'undefined' && window.prompt('Text:', '')) || '';
        if (!label.trim()) { setPending([]); onToolDone?.(); return; }
        drawing.text = label.trim();
      }
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
    const [p1, p2, p3] = pts;

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

      case 'ellipse':
        return <ellipse key={d.id} cx={(p1.x + p2.x) / 2} cy={(p1.y + p2.y) / 2}
          rx={Math.abs(p2.x - p1.x) / 2} ry={Math.abs(p2.y - p1.y) / 2} className="dw-rect" />;

      case 'arrow':
        return <line key={d.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="dw-line" markerEnd="url(#dw-arrow)" />;

      case 'text':
        return <text key={d.id} x={p1.x} y={p1.y} className="dw-text">{d.text}</text>;

      case 'fib': {
        const x1 = Math.min(p1.x, p2.x), x2 = Math.max(p1.x, p2.x);
        return (
          <g key={d.id}>
            {fibRetracementLevels(d.anchors[0].price, d.anchors[1].price).map(({ level, price }) => {
              const y = series.priceToCoordinate(price);
              if (y == null) return null;
              return (
                <g key={level}>
                  <line x1={x1} y1={y} x2={x2} y2={y} className="dw-fib" />
                  <text x={x2 + 3} y={y + 3} className="dw-label">{(level * 100).toFixed(1)}% · {price.toFixed(2)}</text>
                </g>
              );
            })}
          </g>
        );
      }

      case 'fibext': {
        const x1 = Math.min(...pts.map(p => p.x)), x2 = Math.max(...pts.map(p => p.x));
        return (
          <g key={d.id}>
            <polyline points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`} className="dw-line" fill="none" opacity="0.4" />
            {fibExtensionLevels(d.anchors[0].price, d.anchors[1].price, d.anchors[2].price).map(({ level, price }) => {
              const y = series.priceToCoordinate(price);
              if (y == null) return null;
              return (
                <g key={level}>
                  <line x1={x1} y1={y} x2={x2} y2={y} className="dw-fib" />
                  <text x={x2 + 3} y={y + 3} className="dw-label">{(level * 100).toFixed(1)}% · {price.toFixed(2)}</text>
                </g>
              );
            })}
          </g>
        );
      }

      case 'channel': {
        const slope = p2.x !== p1.x ? (p2.y - p1.y) / (p2.x - p1.x) : 0;
        const lineY = x => p1.y + slope * (x - p1.x);
        const off = p3.y - lineY(p3.x);
        const xa = p1.x, xb = p2.x;
        return (
          <g key={d.id}>
            <polygon points={`${xa},${lineY(xa)} ${xb},${lineY(xb)} ${xb},${lineY(xb) + off} ${xa},${lineY(xa) + off}`} className="dw-channel-fill" />
            <line x1={xa} y1={lineY(xa)} x2={xb} y2={lineY(xb)} className="dw-line" />
            <line x1={xa} y1={lineY(xa) + off} x2={xb} y2={lineY(xb) + off} className="dw-line" />
          </g>
        );
      }

      case 'measure': {
        const m = measureStats(d.anchors[0], d.anchors[1]);
        const bars = candles.length ? barsBetween(candles, d.anchors[0].time, d.anchors[1].time) : null;
        const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y);
        return (
          <g key={d.id}>
            <rect x={x} y={y} width={Math.abs(p2.x - p1.x)} height={Math.abs(p2.y - p1.y)}
              className={m.up ? 'dw-measure-up' : 'dw-measure-down'} />
            <text x={x + Math.abs(p2.x - p1.x) / 2} y={Math.min(p1.y, p2.y) - 4} textAnchor="middle" className="dw-label">
              {m.deltaPrice >= 0 ? '+' : ''}{m.deltaPrice.toFixed(2)} ({m.deltaPercent >= 0 ? '+' : ''}{m.deltaPercent}%){bars != null ? ` · ${bars} bars` : ''}
            </text>
          </g>
        );
      }

      case 'long':
      case 'short': {
        const [entry, target, stop] = d.anchors;
        const rr = positionRR(entry.price, target.price, stop.price);
        const yE = series.priceToCoordinate(entry.price);
        const yT = series.priceToCoordinate(target.price);
        const yS = series.priceToCoordinate(stop.price);
        if (yE == null || yT == null || yS == null) return null;
        const xL = Math.min(...pts.map(p => p.x)), xR = Math.max(...pts.map(p => p.x));
        return (
          <g key={d.id}>
            <rect x={xL} y={Math.min(yE, yT)} width={xR - xL} height={Math.abs(yT - yE)} className="dw-pos-reward" />
            <rect x={xL} y={Math.min(yE, yS)} width={xR - xL} height={Math.abs(yS - yE)} className="dw-pos-risk" />
            <line x1={xL} y1={yE} x2={xR} y2={yE} className="dw-line" />
            <text x={xL + 3} y={yE - 3} className="dw-label">{rr.direction.toUpperCase()} · R:R {rr.rr ?? '—'}</text>
            <text x={xR + 3} y={yT + 3} className="dw-label positive">+{rr.rewardPct}%</text>
            <text x={xR + 3} y={yS + 3} className="dw-label negative">−{rr.riskPct}%</text>
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
      <defs>
        <marker id="dw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-purple)" />
        </marker>
      </defs>
      {drawings.map(renderDrawing)}
      {pendingPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" className="dw-pending" />)}
    </svg>
  );
}
