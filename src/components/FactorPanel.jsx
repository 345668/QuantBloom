import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePortfolio } from '../hooks/usePortfolio.js';
import usePolling from '../hooks/usePolling.js';

const RANGES = ['1y', '2y', '5y'];

// Plain-English read of a loading, so the number means something without
// knowing what a factor beta is.
function interpret(key, beta, significant) {
  if (!significant) return 'no meaningful tilt';
  const strong = Math.abs(beta) > 0.4;
  const map = {
    market: beta > 1.1 ? 'more volatile than the market' : beta < 0.9 ? 'defensive vs the market' : 'moves with the market',
    size: beta > 0 ? (strong ? 'strong small-cap tilt' : 'mild small-cap tilt') : (strong ? 'strong large-cap tilt' : 'mild large-cap tilt'),
    value: beta > 0 ? (strong ? 'strong value tilt' : 'mild value tilt') : (strong ? 'strong growth tilt' : 'mild growth tilt'),
    momentum: beta > 0 ? 'follows recent winners' : 'contrarian to momentum',
    quality: beta > 0 ? 'tilted to profitable firms' : 'tilted away from quality',
    lowVol: beta > 0 ? (strong ? 'strongly defensive' : 'mildly defensive') : 'higher-volatility names',
  };
  return map[key] || '';
}

export default function FactorPanel() {
  const { state } = useDashboard();
  const { positions } = usePortfolio();
  const [range, setRange] = useState('2y');

  const usingPortfolio = positions.length > 0;
  const symbols = usingPortfolio ? positions.map(p => p.symbol) : (state.watchlist || []).slice(0, 10);
  const values = usingPortfolio ? positions.map(p => p.marketValue || 0) : symbols.map(() => 10000);

  const url = symbols.length
    ? `/api/v1/analytics/factors?symbols=${symbols.join(',')}&values=${values.join(',')}&range=${range}`
    : null;
  const { data, loading } = usePolling(url, 900000);

  const maxAbs = data?.exposures
    ? Math.max(...data.exposures.map(e => Math.abs(e.beta)), 1)
    : 1;

  return (
    <div className="panel fx-panel">
      <h3 className="panel-title">
        Factor Exposure <span className="panel-badge">{usingPortfolio ? 'Portfolio' : 'Watchlist'}</span>
      </h3>

      <div className="period-selector">
        {RANGES.map(r => (
          <button key={r} className={`period-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      {!symbols.length ? <p className="panel-empty">Add positions or watchlist symbols</p>
        : loading && !data ? <p className="panel-empty">Running regression...</p>
        : !data?.available ? <p className="panel-empty">{data?.message || 'No data'}</p> : (
        <>
          <div className="fx-summary">
            <div className="fx-stat">
              <span className="fx-stat-label">Explained (R²)</span>
              <span className="fx-stat-value">{(data.rSquared * 100).toFixed(1)}%</span>
            </div>
            <div className="fx-stat">
              <span className="fx-stat-label">Stock-specific</span>
              <span className="fx-stat-value">{data.idiosyncraticShare}%</span>
            </div>
            <div className="fx-stat">
              <span className="fx-stat-label">Alpha (ann.)</span>
              <span className={`fx-stat-value ${data.alpha.significant ? (data.alpha.annualisedPercent >= 0 ? 'positive' : 'negative') : ''}`}>
                {data.alpha.annualisedPercent >= 0 ? '+' : ''}{data.alpha.annualisedPercent}%
              </span>
              <span className="fx-stat-sub">{data.alpha.significant ? 'significant' : 'not significant'}</span>
            </div>
          </div>

          {/* Loadings, centred on zero so the direction of each tilt is obvious. */}
          <div className="fx-bars">
            {data.exposures.map(e => {
              const pct = (Math.abs(e.beta) / maxAbs) * 50;
              return (
                <div key={e.key} className={`fx-row ${e.significant ? '' : 'insig'}`} title={e.description}>
                  <span className="fx-name">{e.name}</span>
                  <div className="fx-track">
                    <div className="fx-axis" />
                    <div
                      className={`fx-fill ${e.beta >= 0 ? 'pos' : 'neg'}`}
                      style={e.beta >= 0
                        ? { left: '50%', width: `${pct}%` }
                        : { right: '50%', width: `${pct}%` }}
                    />
                  </div>
                  <span className={`fx-beta ${e.beta >= 0 ? 'positive' : 'negative'}`}>
                    {e.beta >= 0 ? '+' : ''}{e.beta.toFixed(2)}
                    {e.significant && <span className="fx-star">*</span>}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="fx-reads">
            {data.exposures.filter(e => e.significant).map(e => (
              <div key={e.key} className="fx-read">
                <span className="fx-read-name">{e.name}</span>
                <span className="fx-read-text">{interpret(e.key, e.beta, e.significant)}</span>
              </div>
            ))}
          </div>

          <p className="model-note">
            {data.methodology} {data.observations} observations. Loadings marked
            * are significant at p&lt;0.05; unmarked bars are noise. Alpha is the
            return the factors don't explain — treat an insignificant alpha as
            indistinguishable from luck.
          </p>
        </>
      )}
    </div>
  );
}
