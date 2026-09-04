import usePolling from '../hooks/usePolling.js';
import { useDashboard } from '../context/DashboardContext.jsx';

// Residual-alpha screen (Fama-French 5 + Carhart momentum). Ranks the watchlist
// by the alpha the factors don't explain; only names clearing |t| > 2.0 make the
// trade list — the paper's signal-layer gate. Research only, not advice.
export default function ResidualAlphaPanel() {
  const { state, dispatch } = useDashboard();
  const symbols = (state.watchlist || []).join(',');
  const { data, loading } = usePolling(`/api/v1/analytics/residual-alpha?symbols=${encodeURIComponent(symbols)}`, 900000);

  const entries = data?.entries || [];
  const tradeList = data?.tradeList || [];
  const maxT = Math.max(2.5, ...entries.map(e => Math.abs(e.alphaT || 0)));

  return (
    <div className="panel resid-alpha">
      <h3 className="panel-title">Residual Alpha <span className="panel-code">αT&gt;2</span></h3>

      <div className="ra-summary">
        <span className="ra-note">Fama-French 5 + momentum · {data?.range || '2y'}</span>
        <span className="ra-stat"><b>{tradeList.length}</b> on the trade list</span>
      </div>

      {loading && !data ? <p className="panel-empty">Regressing…</p>
        : data && data.available === false ? <p className="panel-empty">{data.message || 'Factor data unavailable'}</p>
        : !entries.length ? <p className="panel-empty">No data</p> : (
        <div className="ra-list">
          <div className="ra-row ra-hd">
            <span>SYM</span><span className="ra-num">α ANN.</span><span className="ra-num">t-STAT</span>
            <span className="ra-bar-h">significance (|t|)</span><span className="ra-num">R²</span>
          </div>
          {entries.map(e => {
            const t = e.alphaT ?? 0;
            const pct = Math.min(100, (Math.abs(t) / maxT) * 100);
            const cls = e.significant ? (e.direction === 'bullish' ? 'sig-pos' : 'sig-neg') : 'insig';
            return (
              <div key={e.symbol} className={`ra-row ${cls}`} onClick={() => dispatch({ type: 'SET_SYMBOL', payload: e.symbol })} title="Set active symbol">
                <span className="ra-sym">{e.symbol}{e.significant && <span className="ra-flag">{e.direction === 'bullish' ? '★' : '⚑'}</span>}</span>
                <span className={`ra-num ${e.alphaAnnual >= 0 ? 'positive' : 'negative'}`}>{e.alphaAnnual >= 0 ? '+' : ''}{e.alphaAnnual}%</span>
                <span className="ra-num ra-t">{t >= 0 ? '+' : ''}{t?.toFixed(2)}</span>
                <span className="ra-bar-cell"><span className="ra-bar" style={{ width: `${pct}%` }} /><span className="ra-gate" style={{ left: `${(2 / maxT) * 100}%` }} title="|t| = 2 gate" /></span>
                <span className="ra-num ra-r2">{e.rSquared != null ? e.rSquared.toFixed(2) : '—'}</span>
              </div>
            );
          })}
        </div>
      )}

      <p className="ra-foot">
        OLS of daily excess returns on ETF-proxied Fama-French 5 + momentum spreads. A name makes the
        trade list when its residual-alpha t-statistic clears <b>|t| &gt; 2</b> — alpha the factors don't
        explain and unlikely to be luck. ★ significant positive, ⚑ significant negative. Historical, not a forecast.
      </p>
    </div>
  );
}
