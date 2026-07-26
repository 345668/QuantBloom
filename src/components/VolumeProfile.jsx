import { useState, useEffect, useCallback, useMemo } from 'react';
import { volumeProfile, supportResistance } from '../../charting/volume-profile.js';

/**
 * Volume-profile + support/resistance overlay. Like ChartDrawings, it paints an
 * SVG anchored to the chart's price scale and repaints on pan/zoom/resize.
 * Horizontal bars sit on the right edge; the POC and value area are highlighted;
 * clustered swing levels are drawn as dashed S/R lines across the pane.
 */
export default function VolumeProfile({ chartRef, seriesRef, containerRef, candles, showProfile, showSR }) {
  const [, forceRepaint] = useState(0);
  const repaint = useCallback(() => forceRepaint(n => n + 1), []);

  const profile = useMemo(
    () => (showProfile && candles?.length ? volumeProfile(candles, 30) : null),
    [candles, showProfile],
  );
  const levels = useMemo(
    () => (showSR && candles?.length ? supportResistance(candles, 5, 0.01, 6) : []),
    [candles, showSR],
  );

  useEffect(() => {
    const chart = chartRef.current;
    const el = containerRef.current;
    if (!chart || !el) return;
    const ts = chart.timeScale();
    ts.subscribeVisibleTimeRangeChange(repaint);
    const ro = new ResizeObserver(repaint);
    ro.observe(el);
    const t = setTimeout(repaint, 60);
    return () => {
      clearTimeout(t); ro.disconnect();
      try { ts.unsubscribeVisibleTimeRangeChange(repaint); } catch {}
    };
  }, [chartRef, containerRef, repaint, candles]);

  const series = seriesRef.current?.candle;
  const el = containerRef.current;
  const W = el?.clientWidth || 0;
  const H = el?.clientHeight || 0;
  if (!series || (!profile && !levels.length)) return null;

  const yOf = (price) => series.priceToCoordinate(price);
  const maxBarW = W * 0.28;

  return (
    <svg className="volume-profile" width={W} height={H} style={{ pointerEvents: 'none' }}>
      {profile && profile.buckets.map((b, i) => {
        const yTop = yOf(b.high), yBot = yOf(b.low);
        if (yTop == null || yBot == null) return null;
        const h = Math.max(1, Math.abs(yBot - yTop) - 1);
        const w = profile.maxVolume ? (b.volume / profile.maxVolume) * maxBarW : 0;
        const inVA = i >= profile.valueArea.lowIndex && i <= profile.valueArea.highIndex;
        const isPoc = i === profile.pocIndex;
        return (
          <rect key={i} x={W - w} y={Math.min(yTop, yBot)} width={w} height={h}
            className={`vp-bar ${isPoc ? 'poc' : inVA ? 'va' : ''}`} />
        );
      })}

      {profile && (() => {
        const y = yOf(profile.poc.mid);
        return y == null ? null : (
          <g>
            <line x1={0} y1={y} x2={W} y2={y} className="vp-poc-line" />
            <text x={W - maxBarW - 4} y={y - 3} textAnchor="end" className="vp-label">
              POC {profile.poc.mid.toFixed(2)}
            </text>
          </g>
        );
      })()}

      {levels.map((lv, i) => {
        const y = yOf(lv.price);
        if (y == null) return null;
        return (
          <g key={`sr-${i}`}>
            <line x1={0} y1={y} x2={W - maxBarW} y2={y} className="vp-sr-line" />
            <text x={4} y={y - 3} className="vp-label vp-sr-label">
              {lv.price.toFixed(2)} · {lv.count}×
            </text>
          </g>
        );
      })}
    </svg>
  );
}
