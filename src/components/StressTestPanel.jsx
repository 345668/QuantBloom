import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePortfolio } from '../hooks/usePortfolio.js';
import usePolling from '../hooks/usePolling.js';

const money = v => v == null ? '—' : (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function StressTestPanel() {
  const { state } = useDashboard();
  const { positions } = usePortfolio();
  const [expanded, setExpanded] = useState(null);

  const usingPortfolio = positions.length > 0;
  const symbols = usingPortfolio ? positions.map(p => p.symbol) : (state.watchlist || []).slice(0, 10);
  const values = usingPortfolio ? positions.map(p => p.marketValue || 0) : symbols.map(() => 10000);

  const url = symbols.length
    ? `/api/v1/analytics/stress?symbols=${symbols.join(',')}&values=${values.join(',')}`
    : null;
  const { data, loading } = usePolling(url, 900000);

  const worst = data?.scenarios?.reduce((w, s) => (!w || s.pnl < w.pnl ? s : w), null);
  const maxAbs = data?.scenarios ? Math.max(...data.scenarios.map(s => Math.abs(s.pnl))) : 1;

  return (
    <div className="panel stress-panel">
      <h3 className="panel-title">
        Stress Test <span className="panel-badge">{usingPortfolio ? 'Portfolio' : 'Watchlist ~$10k ea'}</span>
      </h3>

      {!symbols.length ? <p className="panel-empty">Add positions or watchlist symbols</p>
        : loading && !data ? <p className="panel-empty">Computing...</p>
        : !data?.available ? <p className="panel-empty">{data?.message || 'No data'}</p> : (
        <>
          <div className="stress-summary">
            <div className="stress-kv"><span>Portfolio value</span><span>{money(data.portfolioValue)}</span></div>
            <div className="stress-kv"><span>Portfolio beta</span><span className={data.portfolioBeta > 1.2 ? 'negative' : ''}>{data.portfolioBeta}</span></div>
            {worst && <div className="stress-kv"><span>Worst case</span><span className="negative">{money(worst.pnl)}</span></div>}
          </div>

          <div className="stress-list">
            {data.scenarios.map(s => (
              <div key={s.id} className="stress-scenario">
                <button className="stress-head" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                  <span className="stress-name">{s.name}</span>
                  <span className="stress-shock">{s.marketShock}%</span>
                  <span className="stress-pnl negative">{money(s.pnl)}</span>
                </button>
                <div className="stress-track">
                  <div className="stress-fill" style={{ width: `${(Math.abs(s.pnl) / maxAbs) * 100}%` }} />
                </div>
                <div className="stress-sub">
                  <span>{s.note}</span>
                  <span className="negative">{s.portfolioShockPercent}% → {money(s.endValue)}</span>
                </div>

                {expanded === s.id && (
                  <div className="stress-impacts">
                    {s.impacts.slice().sort((a, b) => a.pnl - b.pnl).map(im => (
                      <div key={im.symbol} className="stress-impact-row">
                        <span className="stress-sym">{im.symbol}</span>
                        <span className="text-dim">β {im.beta}</span>
                        <span className="negative">{im.shockPercent}%</span>
                        <span className="negative">{money(im.pnl)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="model-note">
            {data.methodology} Beta is estimated from historical data and tends
            to rise in a crisis as correlations converge, so these figures
            likely understate true tail risk.
          </p>
        </>
      )}
    </div>
  );
}
