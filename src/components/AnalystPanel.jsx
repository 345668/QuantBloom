import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';
import { fmtPrice } from '../utils/format.js';

export default function AnalystPanel() {
  const { state } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';
  const { data, loading } = usePolling(`/api/v1/analyst?symbol=${symbol}`, 120000);

  const recs = data?.recommendations || [];
  const latest = recs[0];
  const pt = data?.priceTarget;
  const total = latest ? latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell : 0;

  const consensus = (() => {
    if (!latest || !total) return 'N/A';
    const score = (latest.strongBuy * 5 + latest.buy * 4 + latest.hold * 3 + latest.sell * 2 + latest.strongSell * 1) / total;
    if (score >= 4) return 'Strong Buy';
    if (score >= 3.5) return 'Buy';
    if (score >= 2.5) return 'Hold';
    if (score >= 1.5) return 'Sell';
    return 'Strong Sell';
  })();

  const consensusClass = consensus.includes('Buy') ? 'positive' : consensus.includes('Sell') ? 'negative' : '';

  return (
    <div className="panel">
      <h3 className="panel-title">Analyst Ratings <span className="panel-badge">{symbol}</span></h3>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !latest ? <p className="panel-empty">No analyst data</p> : (
        <>
          <div className="analyst-consensus">
            <span className={`consensus-label ${consensusClass}`}>{consensus}</span>
            <span className="consensus-count">
              {total} analysts
              {data.trend && <span className={`trend-tag ${data.trend === 'improving' ? 'positive' : data.trend === 'deteriorating' ? 'negative' : ''}`}>· {data.trend}</span>}
            </span>
          </div>

          {pt && pt.mean && (
            <div className="price-target">
              <div className="pt-row">
                <span className="pt-label">Price Target</span>
                <span className="pt-mean">{fmtPrice(pt.mean)}</span>
                {pt.upside != null && (
                  <span className={`pt-upside ${pt.upside >= 0 ? 'positive' : 'negative'}`}>
                    {pt.upside >= 0 ? '+' : ''}{pt.upside}%
                  </span>
                )}
              </div>
              <div className="pt-range">
                <span className="negative">L {fmtPrice(pt.low)}</span>
                {pt.current && <span className="pt-current">Now {fmtPrice(pt.current)}</span>}
                <span className="positive">H {fmtPrice(pt.high)}</span>
              </div>
              {pt.low != null && pt.high != null && pt.current != null && pt.high > pt.low && (
                <div className="pt-track">
                  <div className="pt-current-marker" style={{ left: `${Math.max(0, Math.min(100, ((pt.current - pt.low) / (pt.high - pt.low)) * 100))}%` }} />
                  <div className="pt-mean-marker" style={{ left: `${Math.max(0, Math.min(100, ((pt.mean - pt.low) / (pt.high - pt.low)) * 100))}%` }} />
                </div>
              )}
            </div>
          )}
          <div className="analyst-bar">
            {latest.strongBuy > 0 && <div className="bar-segment bar-strong-buy" style={{ flex: latest.strongBuy }} title={`Strong Buy: ${latest.strongBuy}`}>{latest.strongBuy}</div>}
            {latest.buy > 0 && <div className="bar-segment bar-buy" style={{ flex: latest.buy }} title={`Buy: ${latest.buy}`}>{latest.buy}</div>}
            {latest.hold > 0 && <div className="bar-segment bar-hold" style={{ flex: latest.hold }} title={`Hold: ${latest.hold}`}>{latest.hold}</div>}
            {latest.sell > 0 && <div className="bar-segment bar-sell" style={{ flex: latest.sell }} title={`Sell: ${latest.sell}`}>{latest.sell}</div>}
            {latest.strongSell > 0 && <div className="bar-segment bar-strong-sell" style={{ flex: latest.strongSell }} title={`Strong Sell: ${latest.strongSell}`}>{latest.strongSell}</div>}
          </div>
          <div className="analyst-legend">
            <span className="legend-item"><span className="dot bar-strong-buy"></span>Strong Buy</span>
            <span className="legend-item"><span className="dot bar-buy"></span>Buy</span>
            <span className="legend-item"><span className="dot bar-hold"></span>Hold</span>
            <span className="legend-item"><span className="dot bar-sell"></span>Sell</span>
          </div>
          {recs.length > 1 && (
            <div className="analyst-history">
              <h4 className="sub-title">History</h4>
              {recs.slice(0, 4).map((r, i) => (
                <div key={i} className="history-row">
                  <span className="history-period">{r.period}</span>
                  <span className="positive">{r.strongBuy + r.buy}B</span>
                  <span>{r.hold}H</span>
                  <span className="negative">{r.sell + r.strongSell}S</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
