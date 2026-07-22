import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';

function MetricRow({ label, value, suffix = '' }) {
  if (value == null) return null;
  const fmt = typeof value === 'number' ? value.toFixed(2) : value;
  return (
    <div className="metric-row">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{fmt}{suffix}</span>
    </div>
  );
}

export default function FundamentalsPanel() {
  const { state } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';
  const [tab, setTab] = useState('valuation');
  const { data, loading } = usePolling(`/api/v1/fundamentals?symbol=${symbol}`, 120000);

  const sections = {
    valuation: { title: 'Valuation', items: data?.valuation, labels: { peRatio: 'P/E Ratio', pbRatio: 'P/B Ratio', psRatio: 'P/S Ratio', evToEbitda: 'EV/EBITDA' } },
    profitability: { title: 'Profitability', items: data?.profitability, labels: { roeTTM: 'ROE', roaTTM: 'ROA', grossMarginTTM: 'Gross Margin', operatingMarginTTM: 'Operating Margin', netMarginTTM: 'Net Margin' }, suffix: '%' },
    growth: { title: 'Growth', items: data?.growth, labels: { revenueGrowthTTM: 'Revenue (TTM)', epsGrowthTTM: 'EPS (TTM)', revenueGrowth3Y: 'Revenue (3Y)', epsGrowth3Y: 'EPS (3Y)' }, suffix: '%' },
    balance: { title: 'Balance Sheet', items: data?.balanceSheet, labels: { totalDebtToEquity: 'Debt/Equity', currentRatio: 'Current Ratio', quickRatio: 'Quick Ratio' } },
    dividends: { title: 'Dividends', items: data?.dividends, labels: { dividendYield: 'Div Yield', dividendPerShare: 'Div/Share', payoutRatio: 'Payout Ratio' } },
    trading: { title: 'Trading', items: data?.trading, labels: { week52High: '52W High', week52Low: '52W Low', beta: 'Beta' } },
  };

  const sec = sections[tab];

  return (
    <div className="panel">
      <h3 className="panel-title">Fundamentals <span className="panel-badge">{symbol}</span></h3>
      <div className="panel-tabs">
        {Object.entries(sections).map(([key, s]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{s.title}</button>
        ))}
      </div>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !sec?.items ? <p className="panel-empty">No data</p> : (
        <div className="metrics-list">
          {Object.entries(sec.labels).map(([key, label]) => (
            <MetricRow key={key} label={label} value={sec.items[key]} suffix={sec.suffix || ''} />
          ))}
        </div>
      )}
    </div>
  );
}
