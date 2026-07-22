import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';

const METRICS = [
  { key: 'peRatio', label: 'P/E', fmt: v => v.toFixed(1) },
  { key: 'pbRatio', label: 'P/B', fmt: v => v.toFixed(1) },
  { key: 'psRatio', label: 'P/S', fmt: v => v.toFixed(1) },
  { key: 'evToEbitda', label: 'EV/EBITDA', fmt: v => v.toFixed(1) },
  { key: 'grossMargin', label: 'Gross %', fmt: v => v.toFixed(1) },
  { key: 'netMargin', label: 'Net %', fmt: v => v.toFixed(1) },
  { key: 'roe', label: 'ROE %', fmt: v => v.toFixed(1) },
  { key: 'revenueGrowth', label: 'Rev Gr %', fmt: v => v.toFixed(1) },
];

export default function CompsPanel() {
  const { state, dispatch } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';
  const [metric, setMetric] = useState('peRatio');
  const { data, loading } = usePolling(`/api/v1/comps?symbol=${symbol}`, 600000);

  const active = METRICS.find(m => m.key === metric);
  const rows = data?.rows || [];
  const med = data?.medians?.[metric];
  const prem = data?.premium?.[metric];

  // Bar scale across peers for the selected metric.
  const vals = rows.map(r => r[metric]).filter(v => v != null && isFinite(v));
  const maxAbs = vals.length ? Math.max(...vals.map(Math.abs)) : 1;

  return (
    <div className="panel comps-panel">
      <h3 className="panel-title">
        Peer Comps <span className="panel-badge">{symbol}</span>
      </h3>

      {loading && !data ? <p className="panel-empty">Loading...</p>
        : !data?.available ? <p className="panel-empty">{data?.message || 'No peers found'}</p> : (
        <>
          <select className="screener-select" value={metric} onChange={e => setMetric(e.target.value)}>
            {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>

          <div className="comps-median">
            <span>Peer median: <strong>{med != null ? active.fmt(med) : '—'}</strong></span>
            {prem != null && (
              <span className={prem >= 0 ? 'negative' : 'positive'}>
                {symbol} {prem >= 0 ? 'premium' : 'discount'} {Math.abs(prem)}%
              </span>
            )}
          </div>

          <div className="comps-bars">
            {rows.map(r => {
              const v = r[metric];
              const w = v != null && isFinite(v) ? (Math.abs(v) / maxAbs) * 100 : 0;
              return (
                <div key={r.symbol}
                     className={`comps-bar-row ${r.isSubject ? 'subject' : ''}`}
                     onClick={() => dispatch({ type: 'SET_SYMBOL', payload: r.symbol })}>
                  <span className="comps-sym">{r.symbol}</span>
                  <div className="comps-track">
                    <div className={`comps-fill ${v < 0 ? 'negative' : ''}`} style={{ width: `${w}%` }} />
                  </div>
                  <span className="comps-val">{v != null && isFinite(v) ? active.fmt(v) : '—'}</span>
                </div>
              );
            })}
          </div>

          <div className="comps-table-wrap">
            <table className="comps-table">
              <thead>
                <tr><th>Sym</th><th>Price</th><th>P/E</th><th>P/B</th><th>Net %</th><th>ROE %</th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.symbol} className={r.isSubject ? 'subject' : ''}
                      onClick={() => dispatch({ type: 'SET_SYMBOL', payload: r.symbol })}>
                    <td className="comps-sym">{r.symbol}</td>
                    <td>{r.price != null ? r.price.toFixed(2) : '—'}</td>
                    <td>{r.peRatio != null ? r.peRatio.toFixed(1) : '—'}</td>
                    <td>{r.pbRatio != null ? r.pbRatio.toFixed(1) : '—'}</td>
                    <td>{r.netMargin != null ? r.netMargin.toFixed(1) : '—'}</td>
                    <td>{r.roe != null ? r.roe.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
