import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';

const fmtPrice = (v) => v == null ? '—'
  : v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  : v >= 1 ? v.toFixed(2)
  : v.toFixed(4);

export default function MarketsPanel() {
  const { state, dispatch } = useDashboard();
  const { data, loading } = usePolling('/api/v1/markets', 60000);
  const [cls, setCls] = useState('Equity ETF');
  const [query, setQuery] = useState('');

  const classes = data?.classes || [];
  const rows = (data?.byClass?.[cls] || []).filter(r =>
    !query || r.symbol.includes(query.toUpperCase()) || r.name.toLowerCase().includes(query.toLowerCase())
  );

  // Indices can't be traded — charting should land on the liquid proxy.
  const select = (r) => dispatch({ type: 'SET_SYMBOL', payload: r.tradeable || r.symbol });

  return (
    <div className="panel mk-panel">
      <h3 className="panel-title">
        Markets <span className="panel-badge">{data?.count || 0} instruments</span>
      </h3>

      {loading && !data ? <p className="panel-empty">Loading markets...</p> : (
        <>
          <div className="mk-classes">
            {classes.map(c => (
              <button key={c} className={`mk-class-btn ${cls === c ? 'active' : ''}`} onClick={() => setCls(c)}>
                {c.replace(' ETF', '')}
              </button>
            ))}
          </div>

          <input className="mk-search" placeholder="Filter…" value={query}
            onChange={e => setQuery(e.target.value)} />

          <div className="mk-list">
            {rows.map(r => (
              <button key={r.symbol} className={`mk-row ${state.activeSymbol === (r.tradeable || r.symbol) ? 'active' : ''}`}
                      onClick={() => select(r)}
                      title={r.tradeable ? `${r.name} — charts ${r.tradeable} (index is not tradeable)` : r.name}>
                <span className="mk-sym">
                  {r.symbol.replace(/[\^=].*$/, '').replace('-USD', '') || r.symbol}
                  {r.tradeable && <span className="mk-proxy">→{r.tradeable}</span>}
                </span>
                <span className="mk-name">{r.name}</span>
                <span className="mk-price">{fmtPrice(r.price)}</span>
                <span className={`mk-chg ${r.changePercent >= 0 ? 'positive' : 'negative'}`}>
                  {r.changePercent >= 0 ? '+' : ''}{r.changePercent?.toFixed(2)}%
                </span>
              </button>
            ))}
            {!rows.length && <p className="panel-empty">No matches</p>}
          </div>
        </>
      )}
    </div>
  );
}
