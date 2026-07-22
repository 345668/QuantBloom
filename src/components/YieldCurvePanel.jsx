import { useState } from 'react';
import usePolling from '../hooks/usePolling.js';

const SERIES = [
  { key: 'current', label: 'Today', color: 'var(--text-primary)', width: 2 },
  { key: 'monthAgo', label: '1M ago', color: 'var(--accent-blue)', width: 1 },
  { key: 'yearAgo', label: '1Y ago', color: 'var(--text-dim)', width: 1 },
];

export default function YieldCurvePanel() {
  const { data, loading } = usePolling('/api/v1/yieldcurve', 900000);
  const [visible, setVisible] = useState({ current: true, monthAgo: true, yearAgo: true });

  const pts = data?.points || [];
  if (loading && !data) return <div className="panel"><h3 className="panel-title">Yield Curve</h3><p className="panel-empty">Loading...</p></div>;
  if (!pts.length) return <div className="panel"><h3 className="panel-title">Yield Curve</h3><p className="panel-empty">No curve data</p></div>;

  // Chart geometry — x is the tenor index (evenly spaced, not log-time, so
  // the short end stays readable), y is the yield.
  const W = 300, H = 130, PAD_L = 26, PAD_B = 16, PAD_T = 8, PAD_R = 6;
  const allVals = SERIES.filter(s => visible[s.key])
    .flatMap(s => pts.map(p => p[s.key]))
    .filter(v => v != null);
  const min = Math.min(...allVals), max = Math.max(...allVals);
  const pad = (max - min) * 0.15 || 0.2;
  const yMin = min - pad, yMax = max + pad;

  const x = (i) => PAD_L + (i / (pts.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v) => PAD_T + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  const pathFor = (key) => pts
    .map((p, i) => p[key] == null ? null : `${x(i)},${y(p[key])}`)
    .filter(Boolean)
    .reduce((acc, pair, i) => acc + (i === 0 ? `M${pair}` : `L${pair}`), '');

  const shapeClass = data.shape === 'Inverted' ? 'negative' : data.shape === 'Flat' ? 'neutral-sig' : 'positive';

  return (
    <div className="panel yc-panel">
      <h3 className="panel-title">
        Yield Curve <span className="panel-badge">FRED</span>
      </h3>

      <div className="yc-summary">
        <div className="yc-stat">
          <span className="yc-stat-label">Shape</span>
          <span className={`yc-stat-value ${shapeClass}`}>{data.shape}</span>
        </div>
        {Object.entries(data.spreads).map(([k, v]) => v != null && (
          <div key={k} className="yc-stat">
            <span className="yc-stat-label">{k}</span>
            <span className={`yc-stat-value ${v < 0 ? 'negative' : ''}`}>{v > 0 ? '+' : ''}{v}</span>
          </div>
        ))}
      </div>

      {data.inverted && (
        <div className="yc-warning">Curve inverted — long yields below short</div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="yc-chart" preserveAspectRatio="xMidYMid meet">
        {/* horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const v = yMin + f * (yMax - yMin);
          return (
            <g key={f}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="0.5" />
              <text x={PAD_L - 3} y={y(v) + 2.5} textAnchor="end" className="yc-axis">{v.toFixed(1)}</text>
            </g>
          );
        })}
        {/* tenor labels */}
        {pts.map((p, i) => (
          <text key={p.tenor} x={x(i)} y={H - 4} textAnchor="middle" className="yc-axis">{p.tenor}</text>
        ))}
        {/* curves */}
        {SERIES.filter(s => visible[s.key]).map(s => (
          <path key={s.key} d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth={s.width} />
        ))}
        {/* today's points */}
        {visible.current && pts.map((p, i) => p.current != null && (
          <circle key={p.tenor} cx={x(i)} cy={y(p.current)} r="2" fill="var(--text-primary)">
            <title>{p.tenor}: {p.current}%</title>
          </circle>
        ))}
      </svg>

      <div className="yc-legend">
        {SERIES.map(s => (
          <button key={s.key}
            className={`yc-legend-item ${visible[s.key] ? '' : 'off'}`}
            onClick={() => setVisible(v => ({ ...v, [s.key]: !v[s.key] }))}>
            <span className="yc-swatch" style={{ background: s.color }} />{s.label}
          </button>
        ))}
        {data.asOf && <span className="yc-asof">as of {data.asOf}</span>}
      </div>
    </div>
  );
}
