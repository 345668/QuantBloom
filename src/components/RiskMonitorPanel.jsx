import usePolling from '../hooks/usePolling.js';

// Risk Monitor — the "Risk Bot" view. Watches the live position book against the
// institutional thresholds (2% trim / 30% sector rebalance / 5% daily-drawdown
// liquidate) on a 60-second poll. Advisory: it flags and recommends; it never
// places or cancels real orders.
export default function RiskMonitorPanel() {
  const { data, loading } = usePolling('/api/v1/bot/risk-monitor', 60000);
  const lim = data?.limits || { trimPositionPercent: 2, sectorRebalancePercent: 30, liquidateDrawdownPercent: 5 };

  const statusText = { ok: 'ALL CLEAR', watch: 'WATCH', critical: 'CRITICAL' };

  return (
    <div className="panel risk-monitor">
      <h3 className="panel-title">Risk Monitor <span className="panel-code">RISK BOT</span></h3>

      {loading && !data ? <p className="panel-empty">Polling book…</p>
        : data?.available === false ? <p className="panel-empty">{data.message} — connect a paper broker to monitor the book.</p>
        : !data ? <p className="panel-empty">No data</p> : (
        <>
          <div className={`rm-status rm-${data.status}`}>
            <span className="rm-dot" />
            <span className="rm-status-label">{statusText[data.status] || data.status}</span>
            <span className="rm-metric">gross {data.grossExposure}%</span>
            <span className={`rm-metric ${data.dailyDrawdown >= lim.liquidateDrawdownPercent ? 'negative' : ''}`}>
              daily DD {data.dailyDrawdown}%
            </span>
          </div>

          {/* Recommended actions */}
          {data.actions?.length > 0 && (
            <div className="rm-actions">
              {data.actions.map((a, i) => (
                <div key={i} className={`rm-action act-${a.type}`}>
                  <span className="rm-act-tag">{a.type.toUpperCase()}</span>
                  <span className="rm-act-detail">{a.detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Position book */}
          <div className="rm-sub">POSITION BOOK · trim &gt; {lim.trimPositionPercent}% NAV</div>
          {!data.positions?.length ? <div className="rm-empty">Flat · no open positions</div> : (
            <div className="rm-list">
              {data.positions.map(p => (
                <div key={p.symbol} className={`rm-row ${p.flag === 'trim' ? 'flag' : ''}`}>
                  <span className="rm-sym">{p.symbol}</span>
                  <span className="rm-sector">{p.sector}</span>
                  <span className={`rm-pnl ${(p.unrealizedPlPercent ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                    {p.unrealizedPlPercent != null ? `${p.unrealizedPlPercent >= 0 ? '+' : ''}${p.unrealizedPlPercent.toFixed(1)}%` : ''}
                  </span>
                  <span className="rm-bar-cell">
                    <span className="rm-bar" style={{ width: `${Math.min(100, (p.weight / (lim.trimPositionPercent * 2)) * 100)}%` }} />
                    <span className="rm-gate" style={{ left: '50%' }} title={`${lim.trimPositionPercent}% trim line`} />
                  </span>
                  <span className={`rm-wt ${p.flag === 'trim' ? 'negative' : ''}`}>{p.weight}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Sector exposure */}
          {data.sectors?.length > 0 && (
            <>
              <div className="rm-sub">SECTOR EXPOSURE · rebalance &gt; {lim.sectorRebalancePercent}% NAV</div>
              <div className="rm-list">
                {data.sectors.map(s => (
                  <div key={s.sector} className={`rm-row ${s.flag === 'rebalance' ? 'flag' : ''}`}>
                    <span className="rm-sym rm-sector-name">{s.sector}</span>
                    <span className="rm-bar-cell rm-sector-bar">
                      <span className="rm-bar" style={{ width: `${Math.min(100, (s.weight / (lim.sectorRebalancePercent * 1.5)) * 100)}%` }} />
                      <span className="rm-gate" style={{ left: `${100 / 1.5}%` }} title={`${lim.sectorRebalancePercent}% line`} />
                    </span>
                    <span className={`rm-wt ${s.flag === 'rebalance' ? 'negative' : ''}`}>{s.weight}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <p className="rm-foot">
        Institutional watch limits (2% position / 30% sector / 5% daily drawdown), polled every 60s.
        Advisory — the Risk Bot flags and recommends; enforcement is the order-time risk gate and the
        kill switch. A CRITICAL daily-drawdown breach recommends the kill switch. Paper account only.
      </p>
    </div>
  );
}
