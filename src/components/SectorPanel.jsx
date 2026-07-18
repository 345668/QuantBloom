import { useState } from 'react';
import usePolling from '../hooks/usePolling.js';

const PERIODS = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
];

export default function SectorPanel() {
  const [period, setPeriod] = useState('3mo');
  const [tab, setTab] = useState('performance');
  const { data, loading } = usePolling(`/api/v1/sectors?period=${period}`, 120000);

  const sectors = data?.sectors || [];

  return (
    <div className="panel">
      <h3 className="panel-title">Sector Analysis</h3>
      <div className="panel-tabs">
        <button className={`tab-btn ${tab === 'performance' ? 'active' : ''}`} onClick={() => setTab('performance')}>Performance</button>
        <button className={`tab-btn ${tab === 'rankings' ? 'active' : ''}`} onClick={() => setTab('rankings')}>Rankings</button>
      </div>
      <div className="period-selector">
        {PERIODS.map(p => (
          <button key={p.value} className={`period-btn ${period === p.value ? 'active' : ''}`} onClick={() => setPeriod(p.value)}>{p.label}</button>
        ))}
      </div>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !sectors.length ? <p className="panel-empty">No data</p> : (
        tab === 'performance' ? (
          <div className="sector-bars">
            {sectors.map(s => {
              const maxAbs = Math.max(...sectors.map(x => Math.abs(x.performance)), 1);
              const width = Math.abs(s.performance) / maxAbs * 100;
              return (
                <div key={s.name} className="sector-bar-row">
                  <span className="sector-bar-name">{s.name}</span>
                  <div className="sector-bar-track">
                    <div
                      className={`sector-bar-fill ${s.performance >= 0 ? 'positive' : 'negative'}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className={`sector-bar-value ${s.performance >= 0 ? 'positive' : 'negative'}`}>
                    {s.performance >= 0 ? '+' : ''}{s.performance}%
                  </span>
                </div>
              );
            })}
            {data?.spyReturn != null && (
              <div className="sector-spy">S&P 500: <span className={data.spyReturn >= 0 ? 'positive' : 'negative'}>{data.spyReturn >= 0 ? '+' : ''}{data.spyReturn}%</span></div>
            )}
          </div>
        ) : (
          <div className="sector-rankings">
            {sectors.map((s, i) => (
              <div key={s.name} className="ranking-row">
                <span className="ranking-pos">{i + 1}</span>
                <span className="ranking-name">{s.name}</span>
                <span className="ranking-etf">{s.etf}</span>
                <span className={`ranking-perf ${s.performance >= 0 ? 'positive' : 'negative'}`}>
                  {s.performance >= 0 ? '+' : ''}{s.performance}%
                </span>
                <span className={`ranking-rs ${s.relativeStrength >= 0 ? 'positive' : 'negative'}`}>
                  RS: {s.relativeStrength >= 0 ? '+' : ''}{s.relativeStrength}
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
