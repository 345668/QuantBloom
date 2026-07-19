import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePortfolio } from '../hooks/usePortfolio.js';
import usePolling from '../hooks/usePolling.js';

const RANGES = ['1y', '2y', '5y'];
const KEYS = [
  { key: 'current', color: 'var(--text-primary)', marker: 'circle' },
  { key: 'minVariance', color: 'var(--accent-blue)', marker: 'square' },
  { key: 'maxSharpe', color: 'var(--accent-up)', marker: 'diamond' },
  { key: 'equalWeight', color: 'var(--text-dim)', marker: 'circle' },
];

export default function OptimizerPanel() {
  const { state } = useDashboard();
  const { positions } = usePortfolio();
  const [range, setRange] = useState('2y');
  const [selected, setSelected] = useState('maxSharpe');

  const usingPortfolio = positions.length > 1;
  const symbols = usingPortfolio ? positions.map(p => p.symbol) : (state.watchlist || []).slice(0, 8);
  const values = usingPortfolio ? positions.map(p => p.marketValue || 0) : symbols.map(() => 10000);

  const url = symbols.length >= 2
    ? `/api/v1/analytics/optimize?symbols=${symbols.join(',')}&values=${values.join(',')}&range=${range}`
    : null;
  const { data, loading } = usePolling(url, 900000);

  const fr = data?.frontier || [];
  const ports = data?.portfolios || {};
  const shown = ports[selected];

  // Chart geometry — risk on x, return on y.
  const W = 300, H = 150, PAD_L = 30, PAD_B = 18, PAD_T = 8;
  const pts = [...fr, ...KEYS.map(k => ports[k.key]).filter(Boolean)];
  const xs = pts.map(p => p.risk), ys = pts.map(p => p.return);
  const xMin = Math.min(...xs, 0), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xPad = (xMax - xMin) * 0.1 || 1, yPad = (yMax - yMin) * 0.1 || 1;
  const xOf = v => PAD_L + ((v - xMin) / ((xMax + xPad) - xMin)) * (W - PAD_L - 8);
  const yOf = v => PAD_T + (1 - (v - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad))) * (H - PAD_T - PAD_B);

  const frontierPath = fr.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.risk)},${yOf(p.return)}`).join('');

  return (
    <div className="panel opt-panel">
      <h3 className="panel-title">
        Optimiser <span className="panel-badge">{usingPortfolio ? 'Portfolio' : 'Watchlist'}</span>
      </h3>

      <div className="period-selector">
        {RANGES.map(r => (
          <button key={r} className={`period-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>{r.toUpperCase()}</button>
        ))}
      </div>

      {symbols.length < 2 ? <p className="panel-empty">Need at least 2 holdings</p>
        : loading && !data ? <p className="panel-empty">Optimising...</p>
        : !data?.available ? <p className="panel-empty">{data?.message || 'No data'}</p> : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="opt-chart" preserveAspectRatio="xMidYMid meet">
            {[0, 0.5, 1].map(f => {
              const v = (yMin - yPad) + f * ((yMax + yPad) - (yMin - yPad));
              return (
                <g key={f}>
                  <line x1={PAD_L} x2={W - 8} y1={yOf(v)} y2={yOf(v)} className="opt-grid" />
                  <text x={PAD_L - 3} y={yOf(v) + 2.5} textAnchor="end" className="opt-axis">{v.toFixed(0)}%</text>
                </g>
              );
            })}
            <path d={frontierPath} className="opt-frontier" />
            {KEYS.map(k => {
              const p = ports[k.key];
              if (!p) return null;
              return (
                <circle key={k.key} cx={xOf(p.risk)} cy={yOf(p.return)}
                  r={selected === k.key ? 4 : 2.8} fill={k.color}
                  stroke={selected === k.key ? '#fff' : 'none'} strokeWidth="0.8">
                  <title>{p.label}: {p.return}% return, {p.risk}% risk</title>
                </circle>
              );
            })}
            <text x={W - 8} y={H - 5} textAnchor="end" className="opt-axis">risk (ann. vol %)</text>
          </svg>

          <div className="opt-ports">
            {KEYS.map(k => {
              const p = ports[k.key];
              if (!p) return null;
              return (
                <button key={k.key} className={`opt-port ${selected === k.key ? 'active' : ''}`}
                        onClick={() => setSelected(k.key)}>
                  <span className="opt-dot" style={{ background: k.color }} />
                  <span className="opt-port-label">{p.label}</span>
                  <span className="opt-port-ret">{p.return}%</span>
                  <span className="opt-port-risk">{p.risk}%</span>
                  <span className={`opt-port-sharpe ${p.sharpe >= 1 ? 'positive' : ''}`}>{p.sharpe}</span>
                </button>
              );
            })}
          </div>

          {shown && (
            <>
              <h4 className="sub-title">{shown.label} weights</h4>
              {shown.requiresShorting && (
                <div className="opt-warning">
                  Requires short positions — not holdable in a long-only account.
                </div>
              )}
              <div className="opt-weights">
                {shown.weights.map(w => (
                  <div key={w.symbol} className="opt-weight-row">
                    <span className="opt-w-sym">{w.symbol}</span>
                    <div className="opt-w-track">
                      <div className="opt-w-axis" />
                      <div className={`opt-w-fill ${w.weight >= 0 ? 'pos' : 'neg'}`}
                        style={w.weight >= 0
                          ? { left: '50%', width: `${Math.min(Math.abs(w.weight) / 2, 50)}%` }
                          : { right: '50%', width: `${Math.min(Math.abs(w.weight) / 2, 50)}%` }} />
                    </div>
                    <span className={`opt-w-val ${w.weight < 0 ? 'negative' : ''}`}>{w.weight}%</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="model-note">
            {data.methodology} Expected returns are historical averages, which
            are a notoriously poor forecast — treat these as a diagnostic of
            concentration, not a trade list.
          </p>
        </>
      )}
    </div>
  );
}
