import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';

// Statement values arrive in raw currency units; scale for readability.
function fmtValue(v) {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

const TABS = [
  { key: 'income', label: 'Income' },
  { key: 'balance', label: 'Balance' },
  { key: 'cashflow', label: 'Cash Flow' },
];

export default function FinancialsPanel() {
  const { state } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';
  const [tab, setTab] = useState('income');
  const [freq, setFreq] = useState('annual');

  const { data, loading } = usePolling(
    `/api/v1/financials?symbol=${symbol}&freq=${freq}&periods=4`,
    600000
  );

  const rows = data?.statements?.[tab] || [];
  const periods = data?.periods || [];

  return (
    <div className="panel fin-panel">
      <h3 className="panel-title">
        Financials <span className="panel-badge">{symbol}</span>
      </h3>

      <div className="panel-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      <div className="period-selector">
        <button className={`period-btn ${freq === 'annual' ? 'active' : ''}`} onClick={() => setFreq('annual')}>Annual</button>
        <button className={`period-btn ${freq === 'quarterly' ? 'active' : ''}`} onClick={() => setFreq('quarterly')}>Quarterly</button>
      </div>

      {loading && !data ? <p className="panel-empty">Loading...</p>
        : !data?.available ? <p className="panel-empty">No filings available for {symbol}</p>
        : !rows.length ? <p className="panel-empty">No line items in this statement</p> : (
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th className="fin-item-col">Line Item</th>
                  {periods.map(p => <th key={p.label}>{p.label}</th>)}
                  <th className="fin-yoy-col">YoY</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.concept}>
                    <td className="fin-item" title={r.label}>{r.label}</td>
                    {r.values.map((v, i) => (
                      <td key={i} className={r.mismatched?.[i] ? 'fin-mismatch' : ''}
                          title={r.mismatched?.[i]
                            ? `Filed as "${r.periodLabels[i]}" in this period — not directly comparable`
                            : undefined}>
                        {fmtValue(v)}{r.mismatched?.[i] ? '*' : ''}
                      </td>
                    ))}
                    <td className={r.yoy[0] == null ? '' : r.yoy[0] >= 0 ? 'positive' : 'negative'}>
                      {r.yoy[0] == null ? '—' : `${r.yoy[0] >= 0 ? '+' : ''}${r.yoy[0]}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.some(r => r.mismatched?.some(Boolean)) && (
              <p className="fin-note">
                * Filed under a different line-item label that period — shown for
                completeness, but not directly comparable, so YoY is omitted.
              </p>
            )}
          </div>
        )}
    </div>
  );
}
