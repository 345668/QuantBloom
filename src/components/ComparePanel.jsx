import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';

const RANGES = ['1mo', '3mo', '6mo', '1y', '2y', '5y'];
const LINE_COLORS = ['#FF8C00', '#0088ff', '#00cc44', '#b060ff', '#ffb800', '#ff4488', '#00cccc', '#999'];

export default function ComparePanel() {
  const { state, dispatch } = useDashboard();
  const [symbols, setSymbols] = useState(['SPY', 'QQQ', 'GLD']);
  const [range, setRange] = useState('1y');
  const [input, setInput] = useState('');

  const { data, loading } = usePolling(
    `/api/v1/compare?symbols=${symbols.join(',')}&range=${range}`,
    300000
  );

  const add = () => {
    const s = input.trim().toUpperCase();
    if (s && !symbols.includes(s) && symbols.length < 8) setSymbols([...symbols, s]);
    setInput('');
  };
  const remove = (s) => symbols.length > 1 && setSymbols(symbols.filter(x => x !== s));
  const addActive = () => {
    const s = state.activeSymbol;
    if (s && !symbols.includes(s) && symbols.length < 8) setSymbols([...symbols, s]);
  };

  const series = data?.series || [];
  const syms = data?.symbols || [];

  // Chart geometry
  const W = 320, H = 150, PAD_L = 30, PAD_B = 16, PAD_T = 8;
  const allVals = series.flatMap(p => syms.map(s => p[s])).filter(v => v != null);
  const yMin = allVals.length ? Math.min(...allVals) : 0;
  const yMax = allVals.length ? Math.max(...allVals) : 0;
  const pad = (yMax - yMin) * 0.1 || 1;
  const lo = yMin - pad, hi = yMax + pad;

  const xOf = i => PAD_L + (i / Math.max(series.length - 1, 1)) * (W - PAD_L - 6);
  const yOf = v => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);

  const pathFor = (s) => series
    .map((p, i) => p[s] == null ? null : `${xOf(i)},${yOf(p[s])}`)
    .filter(Boolean)
    .map((pair, i) => (i === 0 ? 'M' : 'L') + pair)
    .join('');

  return (
    <div className="panel cmp-panel">
      <h3 className="panel-title">
        Compare <span className="panel-badge">rebased %</span>
      </h3>

      <div className="period-selector">
        {RANGES.map(r => (
          <button key={r} className={`period-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="cmp-add">
        <input className="cmp-input" placeholder="Add symbol…" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()} />
        <button className="cmp-btn" onClick={add}>+</button>
        <button className="cmp-btn" onClick={addActive} title={`Add ${state.activeSymbol}`}>
          +{state.activeSymbol}
        </button>
      </div>

      {loading && !data ? <p className="panel-empty">Loading...</p>
        : !data?.available ? <p className="panel-empty">{data?.message || 'No data'}</p> : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="cmp-chart" preserveAspectRatio="xMidYMid meet">
            {/* zero line — the rebase baseline */}
            {lo < 0 && hi > 0 && (
              <line x1={PAD_L} x2={W - 6} y1={yOf(0)} y2={yOf(0)} className="cmp-zero" />
            )}
            {[0, 0.5, 1].map(f => {
              const v = lo + f * (hi - lo);
              return (
                <g key={f}>
                  <line x1={PAD_L} x2={W - 6} y1={yOf(v)} y2={yOf(v)} className="cmp-grid" />
                  <text x={PAD_L - 3} y={yOf(v) + 2.5} textAnchor="end" className="cmp-axis">{v.toFixed(0)}%</text>
                </g>
              );
            })}
            {syms.map((s, i) => (
              <path key={s} d={pathFor(s)} fill="none" stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth="1.4" />
            ))}
          </svg>

          <div className="cmp-legend">
            {syms.map((s, i) => (
              <button key={s} className="cmp-chip" onClick={() => dispatch({ type: 'SET_SYMBOL', payload: s })}>
                <span className="cmp-swatch" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                {s}
                <span className="cmp-x" onClick={e => { e.stopPropagation(); remove(s); }}>×</span>
              </button>
            ))}
          </div>

          <div className="cmp-table-wrap">
            <table className="cmp-table">
              <thead>
                <tr><th>Sym</th><th>Total</th><th>Ann.</th><th>Vol</th><th>MaxDD</th><th>Sharpe</th></tr>
              </thead>
              <tbody>
                {data.stats.map((s, i) => (
                  <tr key={s.symbol} onClick={() => dispatch({ type: 'SET_SYMBOL', payload: s.symbol })}>
                    <td>
                      <span className="cmp-swatch" style={{ background: LINE_COLORS[syms.indexOf(s.symbol) % LINE_COLORS.length] }} />
                      <span className="cmp-sym">{s.symbol}</span>
                    </td>
                    <td className={s.totalReturn >= 0 ? 'positive' : 'negative'}>{s.totalReturn}%</td>
                    <td className={s.annualisedReturn >= 0 ? 'positive' : 'negative'}>{s.annualisedReturn}%</td>
                    <td>{s.volatility}%</td>
                    <td className="negative">−{s.maxDrawdown}%</td>
                    <td className={s.sharpe >= 1 ? 'positive' : s.sharpe < 0 ? 'negative' : ''}>{s.sharpe ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="model-note">
            All series rebased to 0% at the common start date, so instruments at
            different price levels are directly comparable. Sharpe uses a 4.5%
            cash rate.
          </p>
        </>
      )}
    </div>
  );
}
