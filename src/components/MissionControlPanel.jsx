import { useMemo } from 'react';
import usePolling from '../hooks/usePolling.js';
import MarketFieldPanel from './MarketFieldPanel.jsx';
import { sparklinePath, sparklineArea, hexagonPoints, hexagonOutline, heatBuckets, riskAxes, ledgerRows } from '../lib/ops.js';

// "SURVIVAL × FIELD" mission control: the market field over a six-cell
// operations rail (run log, position book, drawdown radar, fill heat, equity,
// ledger), all driven by live heatmap + bot state. Read-only.
export default function MissionControlPanel() {
  const { data: sectors } = usePolling('/api/v1/heatmap', 60000);
  const { data: status } = usePolling('/api/v1/bot/status', 20000);
  const { data: decisions } = usePolling('/api/v1/bot/decisions?limit=60', 20000);

  const decs = Array.isArray(decisions) ? decisions : [];
  const heat = useMemo(() => heatBuckets(decs), [decisions]);
  const axes = useMemo(() => riskAxes(status), [status]);
  const ledger = useMemo(() => ledgerRows(status), [status]);

  // Equity sparkline: prefer a real curve if the bot exposes one, else a
  // two-point equity/last-equity segment, else flat.
  const equitySeries = useMemo(() => {
    const a = status?.account;
    if (a?.equity != null && a?.lastEquity != null) return [a.lastEquity, a.equity];
    if (a?.equity != null) return [a.equity, a.equity];
    return [];
  }, [status]);

  return (
    <div className="panel mission-control">
      <h3 className="panel-title">Mission Control <span className="panel-code">SURVIVAL × FIELD</span></h3>

      <MarketFieldPanel sectors={sectors} />

      <div className="mc-rail">
        {/* RUN LOG */}
        <div className="mc-cell mc-runlog">
          <div className="mc-cell-title">// RUN LOG</div>
          <div className="mc-runlog-list">
            {decs.length ? decs.slice(0, 14).map((d, i) => (
              <div key={i} className={`mc-log-row act-${(d.action || '').toLowerCase()}`}>
                <span className="mc-log-time">{fmtTime(d.at)}</span>
                <span className="mc-log-sym">{d.symbol}</span>
                <span className="mc-log-act">{d.action}</span>
              </div>
            )) : <div className="mc-empty">field live · no decisions yet</div>}
          </div>
        </div>

        {/* POSITION BOOK */}
        <div className="mc-cell mc-posbook">
          <div className="mc-cell-title">// POSITION BOOK</div>
          <div className="mc-pos-list">
            {(status?.positions?.length) ? status.positions.slice(0, 10).map((p, i) => {
              const pnl = Number(p.unrealizedPlpc ?? p.unrealized_plpc ?? 0) * 100;
              return (
                <div key={i} className="mc-pos-row">
                  <span className="mc-pos-sym">{p.symbol}</span>
                  <span className="mc-pos-qty">{p.qty}</span>
                  <span className={`mc-pos-pnl ${pnl >= 0 ? 'positive' : 'negative'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%</span>
                </div>
              );
            }) : <div className="mc-empty">flat · 0 positions</div>}
          </div>
        </div>

        {/* DRAWDOWN radar */}
        <div className="mc-cell mc-drawdown">
          <div className="mc-cell-title">// RISK RADAR</div>
          <svg viewBox="0 0 120 120" className="mc-radar">
            <polygon points={hexagonOutline(60, 60, 46)} className="mc-radar-grid" />
            <polygon points={hexagonOutline(60, 60, 30)} className="mc-radar-grid" />
            <polygon points={hexagonOutline(60, 60, 15)} className="mc-radar-grid" />
            {axes.map((a, i) => {
              const ang = (Math.PI / 3) * i - Math.PI / 2;
              return <line key={`spk-${a.label}`} x1="60" y1="60" x2={60 + Math.cos(ang) * 46} y2={60 + Math.sin(ang) * 46} className="mc-radar-spoke" />;
            })}
            <polygon points={hexagonPoints(60, 60, 46, axes.map(a => a.v))} className="mc-radar-fill" />
            {axes.map((a, i) => {
              const ang = (Math.PI / 3) * i - Math.PI / 2;
              const rr = 46 * Math.max(0, Math.min(1, a.v));
              return <circle key={`dot-${a.label}`} cx={60 + Math.cos(ang) * rr} cy={60 + Math.sin(ang) * rr} r="1.6" className="mc-radar-dot" />;
            })}
            {axes.map((a, i) => {
              const ang = (Math.PI / 3) * i - Math.PI / 2;
              return (
                <text key={a.label} x={60 + Math.cos(ang) * 56} y={60 + Math.sin(ang) * 56}
                  className="mc-radar-label" textAnchor="middle" dominantBaseline="middle">{a.label}</text>
              );
            })}
          </svg>
        </div>

        {/* FILL HEAT */}
        <div className="mc-cell mc-fillheat">
          <div className="mc-cell-title">// FILL HEAT</div>
          {heat.symbols.length ? (
            <div className="mc-heat-grid">
              {heat.symbols.map(sym => (
                <div key={sym} className="mc-heat-row">
                  <span className="mc-heat-sym">{sym}</span>
                  <div className="mc-heat-cells">
                    {heat.hours.filter(h => h >= 6 && h <= 20).map(h => {
                      const c = heat.grid[sym]?.[h] || 0;
                      return <span key={h} className="mc-heat-cell" style={{ opacity: c ? 0.25 + 0.75 * (c / heat.max) : 0.06 }} />;
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="mc-empty">no fills yet</div>}
        </div>

        {/* EQUITY */}
        <div className="mc-cell mc-equity">
          <div className="mc-cell-title">// EQUITY</div>
          <div className="mc-equity-val">{status?.account?.equity != null ? `$${Math.round(status.account.equity).toLocaleString()}` : '—'}</div>
          <svg viewBox="0 0 120 34" className="mc-spark" preserveAspectRatio="none">
            <defs>
              <linearGradient id="mc-spark-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff8c00" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#ff8c00" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={sparklineArea(equitySeries, 120, 34)} fill="url(#mc-spark-grad)" stroke="none" />
            <path d={sparklinePath(equitySeries, 120, 34)} className="mc-spark-line" />
          </svg>
          <div className={`mc-equity-chg ${(status?.account?.dailyPnlPercent ?? 0) >= 0 ? 'positive' : 'negative'}`}>
            {status?.account?.dailyPnlPercent != null ? `${status.account.dailyPnlPercent >= 0 ? '+' : ''}${status.account.dailyPnlPercent.toFixed(2)}% today` : 'idle'}
          </div>
        </div>

        {/* LEDGER */}
        <div className="mc-cell mc-ledger">
          <div className="mc-cell-title">// LEDGER</div>
          <div className="mc-ledger-list">
            {ledger.map(r => (
              <div key={r.label} className="mc-ledger-row">
                <span className="mc-ledger-label">{r.label}</span>
                <span className={`mc-ledger-val ${r.sign != null ? (r.sign >= 0 ? 'positive' : 'negative') : ''}`}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mc-foot">Live view of the market and the paper-trading bot. Read-only — no orders originate here.</p>
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
