import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePortfolio } from '../hooks/usePortfolio.js';
import usePolling from '../hooks/usePolling.js';

const money = v => v == null ? '—' : '$' + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function VaRPanel() {
  const { state } = useDashboard();
  const { positions, totals } = usePortfolio();
  const [confidence, setConfidence] = useState(95);
  const [horizon, setHorizon] = useState(1);

  // Prefer real position values; fall back to an equal-weighted watchlist so
  // the panel is still informative before any trades are recorded.
  const usingPortfolio = positions.length > 0;
  const symbols = usingPortfolio ? positions.map(p => p.symbol) : (state.watchlist || []).slice(0, 10);
  const values = usingPortfolio
    ? positions.map(p => p.marketValue || 0)
    : symbols.map(() => 10000);

  const url = symbols.length
    ? `/api/v1/analytics/var?symbols=${symbols.join(',')}&values=${values.join(',')}&confidence=${confidence}&horizon=${horizon}`
    : null;
  const { data, loading } = usePolling(url, 900000);

  return (
    <div className="panel var-panel">
      <h3 className="panel-title">
        Value at Risk <span className="panel-badge">{usingPortfolio ? 'Portfolio' : 'Watchlist ~$10k ea'}</span>
      </h3>

      <div className="period-selector">
        {[90, 95, 99].map(c => (
          <button key={c} className={`period-btn ${confidence === c ? 'active' : ''}`} onClick={() => setConfidence(c)}>{c}%</button>
        ))}
        <span className="var-sep" />
        {[1, 5, 10].map(h => (
          <button key={h} className={`period-btn ${horizon === h ? 'active' : ''}`} onClick={() => setHorizon(h)}>{h}d</button>
        ))}
      </div>

      {!symbols.length ? <p className="panel-empty">Add positions or watchlist symbols</p>
        : loading && !data ? <p className="panel-empty">Computing...</p>
        : !data?.available ? <p className="panel-empty">{data?.message || 'No data'}</p> : (
        <>
          <div className="var-headline">
            <span className="var-headline-label">
              {confidence}% / {horizon}-day VaR
            </span>
            <span className="var-headline-value negative">−{money(data.var.historical.amount)}</span>
            <span className="var-headline-sub">{data.var.historical.percent}% of {money(data.portfolioValue)}</span>
          </div>

          <div className="var-methods">
            {[
              ['Historical', data.var.historical],
              ['Parametric', data.var.parametric],
              ['Monte Carlo', data.var.monteCarlo],
            ].map(([label, v]) => (
              <div key={label} className="var-method">
                <span className="var-method-label">{label}</span>
                <span className="var-method-value">−{money(v.amount)}</span>
                <span className="var-method-pct">{v.percent}%</span>
              </div>
            ))}
          </div>

          {data.fatTails && (
            <div className="var-warning">
              Historical VaR exceeds parametric — realised losses have fatter
              tails than a normal distribution assumes.
            </div>
          )}

          <div className="var-extra">
            <div className="var-kv"><span>CVaR (expected shortfall)</span><span className="negative">−{money(data.cvar.amount)}</span></div>
            <div className="var-kv"><span>Daily volatility</span><span>{data.dailyVolatility}%</span></div>
            <div className="var-kv"><span>Annualised volatility</span><span>{data.annualisedVolatility}%</span></div>
            <div className="var-kv"><span>Worst / best day</span><span><span className="negative">{data.worstDay}%</span> / <span className="positive">+{data.bestDay}%</span></span></div>
            <div className="var-kv"><span>Observations</span><span>{data.observations} days</span></div>
          </div>

          <p className="model-note">
            Modelled from {data.observations} days of historical returns using
            the square-root-of-time rule. Not a guarantee of maximum loss.
          </p>
        </>
      )}
    </div>
  );
}
