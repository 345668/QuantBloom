import { useState } from 'react';
import usePolling from '../hooks/usePolling.js';

export default function ForexPanel() {
  const [tab, setTab] = useState('forex');
  const { data, loading } = usePolling('/api/v1/forex', 60000);

  const items = tab === 'forex' ? (data?.forex || []) : (data?.commodities || []);

  return (
    <div className="panel">
      <h3 className="panel-title">Forex & Commodities</h3>
      <div className="panel-tabs">
        <button className={`tab-btn ${tab === 'forex' ? 'active' : ''}`} onClick={() => setTab('forex')}>Major Pairs</button>
        <button className={`tab-btn ${tab === 'commodities' ? 'active' : ''}`} onClick={() => setTab('commodities')}>Commodities</button>
      </div>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !items.length ? <p className="panel-empty">No data</p> : (
        <div className="forex-list">
          {items.map(item => (
            <div key={item.symbol} className="forex-row">
              <span className="forex-name">{item.name}</span>
              <span className="forex-price">{item.price?.toFixed(tab === 'forex' ? 4 : 2)}</span>
              <span className={`forex-change ${item.changePercent >= 0 ? 'positive' : 'negative'}`}>
                {item.changePercent >= 0 ? '+' : ''}{item.changePercent?.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
