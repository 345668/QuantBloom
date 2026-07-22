import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';

export default function BreadthPanel() {
  const { dispatch } = useDashboard();
  const { data, loading } = usePolling('/api/v1/breadth', 120000);

  if (loading && !data) return <div className="panel"><h3 className="panel-title">Market Breadth</h3><p className="panel-empty">Scanning S&P 500...</p></div>;
  if (!data?.available) return <div className="panel"><h3 className="panel-title">Market Breadth</h3><p className="panel-empty">{data?.message || 'No data'}</p></div>;

  const signalClass = data.breadthPct >= 55 ? 'positive' : data.breadthPct >= 45 ? 'neutral-sig' : 'negative';

  return (
    <div className="panel breadth-panel">
      <h3 className="panel-title">
        Market Breadth <span className="panel-badge">{data.universe} names</span>
      </h3>

      <div className="bd-signal">
        <span className={`bd-signal-value ${signalClass}`}>{data.signal}</span>
        <span className="bd-signal-sub">{data.breadthPct}% advancing · avg {data.avgChange >= 0 ? '+' : ''}{data.avgChange}%</span>
      </div>

      {/* Advance / decline split */}
      <div className="bd-adline">
        <div className="bd-adbar">
          <div className="bd-adv" style={{ width: `${(data.advancing / data.universe) * 100}%` }} />
          <div className="bd-unch" style={{ width: `${(data.unchanged / data.universe) * 100}%` }} />
          <div className="bd-decl" style={{ width: `${(data.declining / data.universe) * 100}%` }} />
        </div>
        <div className="bd-adcounts">
          <span className="positive">{data.advancing} adv</span>
          <span className="text-dim">A/D {data.advanceDeclineRatio ?? '—'}</span>
          <span className="negative">{data.declining} decl</span>
        </div>
      </div>

      {/* Sector participation — is strength broad or narrow? */}
      <h4 className="sub-title">Sector participation</h4>
      <div className="bd-sectors">
        {data.sectors.map(s => (
          <div key={s.name} className="bd-sector-row">
            <span className="bd-sector-name">{s.name}</span>
            <div className="bd-sector-track">
              <div className={`bd-sector-fill ${s.breadthPct >= 50 ? 'up' : 'down'}`}
                   style={{ width: `${s.breadthPct}%` }} />
            </div>
            <span className={`bd-sector-pct ${s.breadthPct >= 50 ? 'positive' : 'negative'}`}>{s.breadthPct}%</span>
          </div>
        ))}
      </div>

      <div className="bd-movers">
        <div className="bd-mover-group">
          <h4 className="sub-title">Top gainers</h4>
          {data.topGainers.map(m => (
            <div key={m.symbol} className="bd-mover-row" onClick={() => dispatch({ type: 'SET_SYMBOL', payload: m.symbol })}>
              <span className="bd-mover-sym">{m.symbol}</span>
              <span className="positive">+{m.changePercent}%</span>
            </div>
          ))}
        </div>
        <div className="bd-mover-group">
          <h4 className="sub-title">Top losers</h4>
          {data.topLosers.map(m => (
            <div key={m.symbol} className="bd-mover-row" onClick={() => dispatch({ type: 'SET_SYMBOL', payload: m.symbol })}>
              <span className="bd-mover-sym">{m.symbol}</span>
              <span className="negative">{m.changePercent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
