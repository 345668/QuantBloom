import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePortfolio } from '../hooks/usePortfolio.js';
import usePolling from '../hooks/usePolling.js';

const RANGES = ['1mo', '3mo', '6mo', '1y', '2y'];

export default function AttributionPanel() {
  const { state, dispatch } = useDashboard();
  const { positions } = usePortfolio();
  const [range, setRange] = useState('1y');
  const [view, setView] = useState('position');

  const usingPortfolio = positions.length > 0;
  const symbols = usingPortfolio ? positions.map(p => p.symbol) : (state.watchlist || []).slice(0, 10);
  const values = usingPortfolio ? positions.map(p => p.marketValue || 0) : symbols.map(() => 10000);
  const costs = usingPortfolio ? positions.map(p => p.costBasis || 0) : symbols.map(() => 0);

  const url = symbols.length
    ? `/api/v1/portfolio/performance?symbols=${symbols.join(',')}&values=${values.join(',')}&costs=${costs.join(',')}&range=${range}`
    : null;
  const { data, loading } = usePolling(url, 300000);

  const rows = view === 'position' ? (data?.positions || []) : (data?.sectors || []);
  const maxAbs = rows.length ? Math.max(...rows.map(r => Math.abs(r.contribution)), 0.01) : 1;

  return (
    <div className="panel attr-panel">
      <h3 className="panel-title">
        Attribution <span className="panel-badge">{usingPortfolio ? 'Portfolio' : 'Watchlist'}</span>
      </h3>

      <div className="period-selector">
        {RANGES.map(r => (
          <button key={r} className={`period-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>{r.toUpperCase()}</button>
        ))}
      </div>

      {!symbols.length ? <p className="panel-empty">Add positions or watchlist symbols</p>
        : loading && !data ? <p className="panel-empty">Computing...</p>
        : !data?.available ? <p className="panel-empty">{data?.message || 'No data'}</p> : (
        <>
          <div className="attr-summary">
            <div className="attr-stat">
              <span className="attr-stat-label">Portfolio</span>
              <span className={`attr-stat-value ${data.portfolioReturn >= 0 ? 'positive' : 'negative'}`}>
                {data.portfolioReturn >= 0 ? '+' : ''}{data.portfolioReturn}%
              </span>
            </div>
            <div className="attr-stat">
              <span className="attr-stat-label">{data.benchmark}</span>
              <span className={`attr-stat-value ${data.benchmarkReturn >= 0 ? 'positive' : 'negative'}`}>
                {data.benchmarkReturn >= 0 ? '+' : ''}{data.benchmarkReturn}%
              </span>
            </div>
            <div className="attr-stat">
              <span className="attr-stat-label">Excess</span>
              <span className={`attr-stat-value ${data.excessReturn >= 0 ? 'positive' : 'negative'}`}>
                {data.excessReturn >= 0 ? '+' : ''}{data.excessReturn}%
              </span>
            </div>
          </div>

          <div className="panel-tabs">
            <button className={`tab-btn ${view === 'position' ? 'active' : ''}`} onClick={() => setView('position')}>By position</button>
            <button className={`tab-btn ${view === 'sector' ? 'active' : ''}`} onClick={() => setView('sector')}>By sector</button>
          </div>

          {/* Contributions are additive and sum to the portfolio return, so a
              zero-centred bar reads directly as "what drove the number". */}
          <div className="attr-bars">
            {rows.map(r => {
              const label = r.symbol || r.sector;
              const pct = (Math.abs(r.contribution) / maxAbs) * 50;
              return (
                <div key={label} className="attr-row"
                     onClick={() => r.symbol && dispatch({ type: 'SET_SYMBOL', payload: r.symbol })}>
                  <span className="attr-name">{label}</span>
                  <span className="attr-wgt">{r.weight}%</span>
                  <div className="attr-track">
                    <div className="attr-axis" />
                    <div className={`attr-fill ${r.contribution >= 0 ? 'pos' : 'neg'}`}
                      style={r.contribution >= 0
                        ? { left: '50%', width: `${pct}%` }
                        : { right: '50%', width: `${pct}%` }} />
                  </div>
                  <span className={`attr-contrib ${r.contribution >= 0 ? 'positive' : 'negative'}`}>
                    {r.contribution >= 0 ? '+' : ''}{r.contribution.toFixed(2)}
                  </span>
                  {view === 'position' && (
                    <span className={`attr-ret ${r.periodReturn >= 0 ? 'positive' : 'negative'}`}>
                      {r.periodReturn >= 0 ? '+' : ''}{r.periodReturn}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="model-note">
            {data.methodology} A large position with a modest return can
            contribute more than a small position that doubled — the weight
            column is why.
          </p>
        </>
      )}
    </div>
  );
}
