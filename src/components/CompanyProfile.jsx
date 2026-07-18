import { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';
import { fmtPrice, fmtLargeNumber } from '../utils/format.js';

export default function CompanyProfile() {
  const { state } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';
  const { data, loading } = usePolling(`/api/v1/profile?symbol=${symbol}`, 60000);

  if (loading && !data) return <div className="panel"><h3 className="panel-title">Company Profile</h3><p className="panel-empty">Loading...</p></div>;
  if (!data) return <div className="panel"><h3 className="panel-title">Company Profile</h3><p className="panel-empty">No data</p></div>;

  return (
    <div className="panel">
      <h3 className="panel-title">
        {data.logo && <img src={data.logo} alt="" className="company-logo" />}
        {data.name || symbol}
      </h3>
      <div className="profile-price">
        <span className="profile-price-value">{fmtPrice(data.price)}</span>
        <span className={`profile-change ${data.change >= 0 ? 'positive' : 'negative'}`}>
          {data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)} ({data.changePercent?.toFixed(2)}%)
        </span>
      </div>
      <div className="profile-grid">
        {data.industry && <div className="profile-item"><span className="profile-label">Industry</span><span className="profile-value">{data.industry}</span></div>}
        {data.exchange && <div className="profile-item"><span className="profile-label">Exchange</span><span className="profile-value">{data.exchange}</span></div>}
        {data.marketCap && <div className="profile-item"><span className="profile-label">Market Cap</span><span className="profile-value">{fmtLargeNumber(data.marketCap)}</span></div>}
        {data.country && <div className="profile-item"><span className="profile-label">Country</span><span className="profile-value">{data.country}</span></div>}
        {data.ipo && <div className="profile-item"><span className="profile-label">IPO Date</span><span className="profile-value">{data.ipo}</span></div>}
        {data.volume && <div className="profile-item"><span className="profile-label">Volume</span><span className="profile-value">{fmtLargeNumber(data.volume)}</span></div>}
      </div>
      {data.weburl && <a href={data.weburl} target="_blank" rel="noopener noreferrer" className="profile-link">{data.weburl.replace(/https?:\/\//, '')}</a>}
    </div>
  );
}
