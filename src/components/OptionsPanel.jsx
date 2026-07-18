import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';
import { fmtPrice } from '../utils/format.js';

export default function OptionsPanel() {
  const { state } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';
  const [optionType, setOptionType] = useState('calls');
  const { data, loading } = usePolling(`/api/v1/options?symbol=${symbol}`, 60000);

  const contracts = optionType === 'calls' ? (data?.calls || []) : (data?.puts || []);
  const currentPrice = data?.currentPrice;

  return (
    <div className="panel">
      <h3 className="panel-title">Options Chain <span className="panel-badge">{symbol}</span></h3>
      <div className="panel-tabs">
        <button className={`tab-btn ${optionType === 'calls' ? 'active' : ''}`} onClick={() => setOptionType('calls')}>Calls ({data?.calls?.length || 0})</button>
        <button className={`tab-btn ${optionType === 'puts' ? 'active' : ''}`} onClick={() => setOptionType('puts')}>Puts ({data?.puts?.length || 0})</button>
      </div>
      {currentPrice && <div className="options-spot">Spot: {fmtPrice(currentPrice)}</div>}
      {loading && !data ? <p className="panel-empty">Loading...</p> : !contracts.length ? <p className="panel-empty">No options data</p> : (
        <div className="options-table-wrap">
          <table className="options-table">
            <thead>
              <tr>
                <th>Strike</th>
                <th>Last</th>
                <th>Bid</th>
                <th>Ask</th>
                <th>Vol</th>
                <th>OI</th>
                <th>IV</th>
              </tr>
            </thead>
            <tbody>
              {contracts.slice(0, 20).map(c => (
                <tr key={c.contractSymbol} className={c.inTheMoney ? 'itm' : ''}>
                  <td className="options-strike">{fmtPrice(c.strike)}</td>
                  <td>{fmtPrice(c.lastPrice)}</td>
                  <td>{fmtPrice(c.bid)}</td>
                  <td>{fmtPrice(c.ask)}</td>
                  <td>{c.volume || '—'}</td>
                  <td>{c.openInterest || '—'}</td>
                  <td>{c.impliedVolatility ? (c.impliedVolatility * 100).toFixed(1) + '%' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
