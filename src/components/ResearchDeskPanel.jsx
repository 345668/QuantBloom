import { useMemo } from 'react';
import usePolling from '../hooks/usePolling.js';
import { useDashboard } from '../context/DashboardContext.jsx';

// AI-hedge-fund Research Desk — the synthesized "morning brief". Cross-confirms
// three analyzers (Loughran-McDonald sentiment, Cohen-Malloy-Pomorski insider
// clusters, Griffin-Tang 8-K drift) into ranked, conviction-tagged entries.
// Read-only research; nothing here places a trade.
export default function ResearchDeskPanel() {
  const { state, dispatch } = useDashboard();
  const symbols = (state.watchlist || []).join(',');
  const { data, loading } = usePolling(`/api/v1/research?symbols=${encodeURIComponent(symbols)}`, 300000);

  const entries = data?.entries || [];
  const counts = data?.counts || { total: 0, high: 0, bullish: 0, bearish: 0 };
  const asOf = useMemo(() => data?.asOf ? new Date(data.asOf).toLocaleString('en-US',
    { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '', [data]);

  return (
    <div className="panel research-desk">
      <h3 className="panel-title">
        Research Desk <span className="panel-code">BRIEF</span>
      </h3>

      <div className="rd-summary">
        <span className="rd-asof">Morning brief · {asOf || '—'}</span>
        <span className="rd-stat"><b>{counts.high}</b> high-conviction</span>
        <span className="rd-stat rd-bull">{counts.bullish}▲</span>
        <span className="rd-stat rd-bear">{counts.bearish}▼</span>
      </div>

      {loading && !data ? <p className="panel-empty">Assembling brief…</p>
        : !entries.length ? <p className="panel-empty">No directional signals across the watchlist right now.</p> : (
        <div className="rd-list">
          {entries.map(e => (
            <div key={e.symbol} className={`rd-row conv-${e.conviction} dir-${e.direction}`}
                 onClick={() => dispatch({ type: 'SET_SYMBOL', payload: e.symbol })} title="Set active symbol">
              <div className="rd-head">
                <span className="rd-sym">{e.symbol}</span>
                <span className={`rd-dir ${e.direction}`}>{e.direction === 'bullish' ? '▲ BULLISH' : e.direction === 'bearish' ? '▼ BEARISH' : '– FLAT'}</span>
                <span className={`rd-conv conv-${e.conviction}`}>{e.conviction === 'high' ? 'HIGH CONVICTION' : e.conviction}</span>
                <span className="rd-agree">{e.agree} source{e.agree === 1 ? '' : 's'}</span>
              </div>
              <div className="rd-reasons">
                {e.reasons.map((r, i) => <span key={i} className="rd-reason">{r}</span>)}
              </div>
              <div className="rd-analyzers">
                {e.sentiment && e.sentiment.n > 0 && (
                  <span className={`rd-chip sent-${e.sentiment.label}`}>LM {e.sentiment.label} {e.sentiment.polarity > 0 ? '+' : ''}{e.sentiment.polarity}</span>
                )}
                {e.insider?.cluster && (
                  <span className="rd-chip rd-insider">◤ {e.insider.insiders} insiders buying</span>
                )}
                {e.alpha?.significant && (
                  <span className={`rd-chip sent-${e.alpha.direction}`}>α t={e.alpha.alphaT}</span>
                )}
                {e.events?.eightK && <span className="rd-chip rd-8k">8-K drift</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="rd-foot">
        Cross-source confirmation over the watchlist — Loughran-McDonald sentiment,
        insider-purchase clusters (Cohen-Malloy-Pomorski), and 8-K drift (Griffin-Tang).
        {data?.note ? ` ${data.note}` : ''} Research only — not investment advice, and no orders originate here.
      </p>
    </div>
  );
}
