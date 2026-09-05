import { useMemo } from 'react';
import usePolling from '../hooks/usePolling.js';
import { useDashboard } from '../context/DashboardContext.jsx';

// Fund Operations — maps the six invariant functional layers of a hedge fund
// (paper: Research / Signal / Execution / Risk / Workstation / Growth) onto what
// QuantBloom already runs, plus the maker-checker scorecard (the self-improving
// loop). Read-only overview; the Growth/business-ops layer is deliberately out
// of scope (no real capital, LLC, or billing here).
export default function FundOpsPanel() {
  const { state } = useDashboard();
  const symbols = (state.watchlist || []).join(',');
  const { data: status } = usePolling('/api/v1/bot/status', 30000);
  const { data: research } = usePolling(`/api/v1/research?symbols=${encodeURIComponent(symbols)}`, 300000);
  const { data: risk } = usePolling('/api/v1/bot/risk-monitor', 60000);
  const { data: alpha } = usePolling(`/api/v1/analytics/residual-alpha?symbols=${encodeURIComponent(symbols)}`, 900000);
  const { data: models } = usePolling('/api/v1/bot/models/published', 120000);
  const { data: score } = usePolling('/api/v1/bot/scorecard', 120000);

  const layers = useMemo(() => {
    const hc = research?.counts?.high ?? 0;
    const briefN = research?.counts?.total ?? 0;
    const tradeList = alpha?.tradeList?.length ?? 0;
    const published = Array.isArray(models) ? models.length : 0;
    const riskStatus = risk?.available ? risk.status : 'n/a';
    const positions = status?.positions?.length ?? 0;
    return [
      { key: 'research', name: 'Research', maps: 'Research Desk',
        state: briefN ? 'live' : 'idle',
        metric: `${hc} high-conviction · ${briefN} signals` },
      { key: 'signal', name: 'Signal', maps: 'Residual alpha · Model Lab',
        state: (tradeList || published) ? 'live' : 'idle',
        metric: `${tradeList} on trade list · ${published} published model${published === 1 ? '' : 's'}` },
      { key: 'execution', name: 'Execution', maps: 'Trading bot',
        state: status?.enabled ? 'live' : 'idle',
        metric: status?.enabled ? `enabled · ${status?.ordersToday ?? 0} orders today` : `idle · ${positions} positions` },
      { key: 'risk', name: 'Risk', maps: 'Risk gate + monitor',
        state: riskStatus === 'critical' ? 'alert' : riskStatus === 'watch' ? 'watch' : riskStatus === 'ok' ? 'live' : 'idle',
        metric: risk?.available ? `${(riskStatus || '').toUpperCase()} · ${risk.actions?.length ?? 0} flags` : 'no broker' },
      { key: 'workstation', name: 'Workstation', maps: 'The terminal',
        state: 'live', metric: 'panels, charts & analytics' },
      { key: 'growth', name: 'Growth', maps: 'Out of scope',
        state: 'na', metric: 'business ops / capital — manual, off-platform' },
    ];
  }, [research, alpha, models, status, risk]);

  const sources = score?.sources || [];

  return (
    <div className="panel fund-ops">
      <h3 className="panel-title">Fund Operations <span className="panel-code">FUND OPS</span></h3>

      <div className="fo-layers">
        {layers.map((l, i) => (
          <div key={l.key} className={`fo-layer st-${l.state}`}>
            <span className="fo-num">{i + 1}</span>
            <div className="fo-layer-body">
              <div className="fo-layer-head">
                <span className="fo-layer-name">{l.name}</span>
                <span className={`fo-pill st-${l.state}`}>{l.state === 'na' ? 'N/A' : l.state.toUpperCase()}</span>
              </div>
              <div className="fo-layer-maps">{l.maps}</div>
              <div className="fo-layer-metric">{l.metric}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="fo-sub">
        MAKER-CHECKER · weekly realized-signal accuracy per source
        {score?.totals?.scored > 0 && <span className="fo-total"> · {(score.totals.hitRate * 100).toFixed(0)}% overall ({score.totals.scored} scored)</span>}
      </div>
      {!sources.length ? (
        <p className="fo-empty">
          No scored decisions yet — the scorecard grades each strategy/model once the bot
          has logged decisions with a known forward price. Run the bot (or a dry run) and check back.
        </p>
      ) : (
        <div className="fo-score">
          {sources.map(s => (
            <div key={s.source} className="fo-score-row">
              <span className={`fo-grade g-${s.grade.replace('/', '')}`}>{s.grade}</span>
              <span className="fo-src">{s.source}</span>
              <span className="fo-hit">{(s.hitRate * 100).toFixed(0)}% hit</span>
              <span className={`fo-ret ${s.avgReturn >= 0 ? 'positive' : 'negative'}`}>{s.avgReturn >= 0 ? '+' : ''}{s.avgReturn}%</span>
              <span className="fo-n">n={s.n}</span>
            </div>
          ))}
        </div>
      )}

      <p className="fo-foot">
        The six invariant fund layers mapped onto QuantBloom. Growth/business-ops is intentionally
        out of scope — no real capital, entity, or billing. The maker-checker grades each decision
        source on realized accuracy (the paper's weekly specialist review). Read-only; paper account.
      </p>
    </div>
  );
}
