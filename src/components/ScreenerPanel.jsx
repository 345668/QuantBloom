import { useState } from 'react';
import usePolling from '../hooks/usePolling.js';
import { fmtPrice } from '../utils/format.js';

const SECTORS = ['All', 'Information Technology', 'Health Care', 'Financials', 'Consumer Discretionary', 'Communication Services', 'Industrials', 'Consumer Staples', 'Energy', 'Utilities', 'Real Estate', 'Materials'];

export default function ScreenerPanel() {
  const [sector, setSector] = useState('All');
  const [sortBy, setSortBy] = useState('changePercent');
  const [sortDir, setSortDir] = useState(-1);

  const url = sector === 'All' ? '/api/v1/screener' : `/api/v1/screener?sector=${encodeURIComponent(sector)}`;
  const { data, loading } = usePolling(url, 60000);

  const sorted = [...(data || [])].sort((a, b) => {
    const av = a[sortBy] || 0, bv = b[sortBy] || 0;
    return (av - bv) * sortDir;
  });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d * -1);
    else { setSortBy(col); setSortDir(-1); }
  };

  return (
    <div className="panel">
      <h3 className="panel-title">Stock Screener <span className="panel-badge">{sorted.length} results</span></h3>
      <div className="screener-filter">
        <select className="screener-select" value={sector} onChange={e => setSector(e.target.value)}>
          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading && !data ? <p className="panel-empty">Loading...</p> : (
        <div className="screener-table-wrap">
          <table className="screener-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('symbol')}>Symbol</th>
                <th onClick={() => toggleSort('price')}>Price</th>
                <th onClick={() => toggleSort('changePercent')}>Change %</th>
                <th onClick={() => toggleSort('volume')}>Volume</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 20).map(s => (
                <tr key={s.symbol}>
                  <td className="screener-symbol">{s.symbol}</td>
                  <td>{fmtPrice(s.price)}</td>
                  <td className={s.changePercent >= 0 ? 'positive' : 'negative'}>
                    {s.changePercent >= 0 ? '+' : ''}{s.changePercent?.toFixed(2)}%
                  </td>
                  <td>{s.volume ? (s.volume / 1e6).toFixed(1) + 'M' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
