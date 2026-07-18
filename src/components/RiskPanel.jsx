import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';

function StatCard({ label, value, suffix = '', level }) {
  const levelClass = level === 'Low' ? 'positive' : level === 'High' ? 'negative' : '';
  return (
    <div className="risk-stat">
      <span className="risk-stat-label">{label}</span>
      <span className="risk-stat-value">{value}{suffix}</span>
      {level && <span className={`risk-stat-level ${levelClass}`}>{level}</span>}
    </div>
  );
}

export default function RiskPanel() {
  const { state } = useDashboard();
  const watchlist = state.watchlist || ['AAPL', 'MSFT', 'GOOGL'];
  const symbols = watchlist.slice(0, 10).join(',');
  const { data, loading } = usePolling(`/api/v1/risk?symbols=${symbols}`, 120000);

  const volLevel = (v) => v > 30 ? 'High' : v > 15 ? 'Medium' : 'Low';
  const ddLevel = (d) => d > 20 ? 'High' : d > 10 ? 'Medium' : 'Low';
  const sharpeLevel = (s) => s > 1 ? 'Good' : s > 0.5 ? 'Fair' : 'Poor';

  return (
    <div className="panel">
      <h3 className="panel-title">Risk Analytics</h3>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !data ? <p className="panel-empty">No data</p> : (
        <>
          <div className="risk-stats-grid">
            <StatCard label="Portfolio Beta" value={data.portfolioBeta} />
            <StatCard label="Sharpe Ratio" value={data.sharpeRatio} level={sharpeLevel(data.sharpeRatio)} />
            <StatCard label="Volatility" value={data.volatility} suffix="%" level={volLevel(data.volatility)} />
            <StatCard label="Max Drawdown" value={-data.maxDrawdown} suffix="%" level={ddLevel(data.maxDrawdown)} />
          </div>
          {data.stocks?.length > 0 && (
            <div className="risk-stocks">
              <h4 className="sub-title">Individual Stocks</h4>
              {data.stocks.map(s => (
                <div key={s.symbol} className="risk-stock-row">
                  <span className="risk-stock-symbol">{s.symbol}</span>
                  <span>Beta: {s.beta}</span>
                  <span>Vol: {s.volatility}%</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
