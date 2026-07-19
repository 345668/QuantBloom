import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePortfolio } from '../hooks/usePortfolio.js';
import usePolling from '../hooks/usePolling.js';

const WINDOWS = [
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '180D', value: 180 },
  { label: '1Y', value: 365 },
];

// Red for correlated (moves together), green for diverging — matches the
// terminal's up/down palette, where "everything correlated" is the risk.
function cellStyle(v) {
  if (v == null) return {};
  const intensity = Math.min(Math.abs(v), 1) * 0.55;
  const color = v >= 0 ? `rgba(204, 34, 0, ${intensity})` : `rgba(0, 204, 68, ${intensity})`;
  return { background: color };
}

export default function CorrelationPanel() {
  const { state } = useDashboard();
  const { positions } = usePortfolio();
  const [window, setWindow] = useState(90);

  // Prefer real holdings; fall back to the watchlist when the book is empty.
  const holdingSymbols = positions.map(p => p.symbol);
  const source = holdingSymbols.length >= 2 ? 'Portfolio' : 'Watchlist';
  const symbols = (holdingSymbols.length >= 2 ? holdingSymbols : state.watchlist || []).slice(0, 12);

  const { data, loading } = usePolling(
    symbols.length >= 2 ? `/api/v1/analytics/correlation?symbols=${symbols.join(',')}&window=${window}` : null,
    600000
  );

  const divClass = data?.diversification === 'Good' ? 'positive'
    : data?.diversification === 'Poor' ? 'negative' : 'neutral-sig';

  return (
    <div className="panel corr-panel">
      <h3 className="panel-title">
        Correlation <span className="panel-badge">{source}</span>
      </h3>

      <div className="period-selector">
        {WINDOWS.map(w => (
          <button key={w.value} className={`period-btn ${window === w.value ? 'active' : ''}`}
            onClick={() => setWindow(w.value)}>{w.label}</button>
        ))}
      </div>

      {symbols.length < 2 ? (
        <p className="panel-empty">Need at least 2 holdings or watchlist symbols</p>
      ) : loading && !data ? <p className="panel-empty">Computing...</p>
        : !data?.available ? <p className="panel-empty">{data?.message || 'No data'}</p> : (
        <>
          <div className="corr-summary">
            <div className="corr-stat">
              <span className="corr-stat-label">Avg Correlation</span>
              <span className="corr-stat-value">{data.averageCorrelation}</span>
            </div>
            <div className="corr-stat">
              <span className="corr-stat-label">Diversification</span>
              <span className={`corr-stat-value ${divClass}`}>{data.diversification}</span>
            </div>
          </div>

          <div className="corr-matrix-wrap">
            <table className="corr-matrix">
              <thead>
                <tr>
                  <th></th>
                  {data.symbols.map(s => <th key={s}>{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row, i) => (
                  <tr key={data.symbols[i]}>
                    <th className="corr-row-head">{data.symbols[i]}</th>
                    {row.map((v, j) => (
                      <td key={j} style={cellStyle(i === j ? null : v)}
                          className={i === j ? 'corr-diag' : ''}>
                        {v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="corr-pairs">
            <div className="corr-pair-group">
              <h4 className="sub-title">Most correlated</h4>
              {data.mostCorrelated.map(p => (
                <div key={`${p.a}-${p.b}`} className="corr-pair-row">
                  <span>{p.a} · {p.b}</span>
                  <span className="negative">{p.correlation.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="corr-pair-group">
              <h4 className="sub-title">Least correlated</h4>
              {data.leastCorrelated.map(p => (
                <div key={`${p.a}-${p.b}`} className="corr-pair-row">
                  <span>{p.a} · {p.b}</span>
                  <span className="positive">{p.correlation.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
