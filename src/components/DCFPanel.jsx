import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';

export default function DCFPanel() {
  const { state } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';
  const [wacc, setWacc] = useState(9);
  const [terminal, setTerminal] = useState(2.5);
  const [growth, setGrowth] = useState('');
  const [years, setYears] = useState(5);

  const params = new URLSearchParams({ symbol, wacc, terminal, years });
  if (growth !== '') params.set('growth', growth);
  const { data, loading } = usePolling(`/api/v1/valuation/dcf?${params}`, 600000);

  const upside = data?.upsidePercent;
  const verdict = upside == null ? null
    : upside > 20 ? 'Undervalued' : upside > 0 ? 'Slightly undervalued'
    : upside > -20 ? 'Slightly overvalued' : 'Overvalued';

  // Colour the sensitivity grid by upside vs the current price.
  const cellClass = (v) => {
    if (v == null || !data?.currentPrice) return '';
    const u = ((v - data.currentPrice) / data.currentPrice) * 100;
    return u > 15 ? 'dcf-good' : u > -15 ? 'dcf-mid' : 'dcf-bad';
  };

  return (
    <div className="panel dcf-panel">
      <h3 className="panel-title">
        DCF Valuation <span className="panel-badge">{symbol}</span>
      </h3>

      <div className="dcf-inputs">
        <label>WACC %<input type="number" step="0.5" value={wacc} onChange={e => setWacc(Number(e.target.value) || 9)} /></label>
        <label>Term. g %<input type="number" step="0.5" value={terminal} onChange={e => setTerminal(Number(e.target.value) || 0)} /></label>
        <label>Growth %<input type="number" step="1" placeholder="auto" value={growth} onChange={e => setGrowth(e.target.value)} /></label>
        <label>Years<input type="number" value={years} onChange={e => setYears(Number(e.target.value) || 5)} /></label>
      </div>

      {loading && !data ? <p className="panel-empty">Valuing...</p>
        : !data?.available ? <p className="panel-empty">{data?.message || 'No data'}</p> : (
        <>
          <div className="dcf-headline">
            <div className="dcf-fair">
              <span className="dcf-label">Fair value</span>
              <span className="dcf-value">${data.fairValuePerShare}</span>
            </div>
            <div className="dcf-vs">
              <span className="dcf-label">vs price ${data.currentPrice?.toFixed(2)}</span>
              <span className={`dcf-upside ${upside >= 0 ? 'positive' : 'negative'}`}>
                {upside >= 0 ? '+' : ''}{upside}%
              </span>
              <span className="dcf-verdict">{verdict}</span>
            </div>
          </div>

          <div className="dcf-kvs">
            <div className="dcf-kv"><span>Latest FCF</span><span>${data.latestFcfBillions}B</span></div>
            <div className="dcf-kv"><span>Growth used</span><span>{data.assumptions.growthPercent}%{growth === '' && ' (hist.)'}</span></div>
            <div className="dcf-kv"><span>Enterprise value</span><span>${data.enterpriseValueBillions}B</span></div>
            <div className="dcf-kv">
              <span>Terminal share</span>
              <span className={data.terminalSharePercent > 70 ? 'negative' : ''}>{data.terminalSharePercent}%</span>
            </div>
          </div>

          {data.terminalSharePercent > 70 && (
            <div className="dcf-warning">
              {data.terminalSharePercent}% of this valuation comes from the terminal
              value — i.e. mostly an assumption about perpetual growth, not from
              the {data.assumptions.years} forecast years.
            </div>
          )}

          <h4 className="sub-title">Free cash flow history ($B)</h4>
          <div className="dcf-fcf">
            {data.history.slice().reverse().map(h => {
              const max = Math.max(...data.history.map(x => Math.abs(x.freeCashFlow)), 1);
              return (
                <div key={h.year} className="dcf-fcf-row">
                  <span className="dcf-year">{h.year}</span>
                  <div className="dcf-fcf-track">
                    <div className="dcf-fcf-fill" style={{ width: `${(Math.abs(h.freeCashFlow) / max) * 100}%` }} />
                  </div>
                  <span className="dcf-fcf-val">{h.freeCashFlow}</span>
                </div>
              );
            })}
          </div>

          <h4 className="sub-title">Sensitivity — fair value per share</h4>
          <div className="dcf-sens-wrap">
            <table className="dcf-sens">
              <thead>
                <tr>
                  <th>WACC \ g</th>
                  {data.termRange.map(t => <th key={t}>{t}%</th>)}
                </tr>
              </thead>
              <tbody>
                {data.sensitivity.map(row => (
                  <tr key={row.wacc}>
                    <th>{row.wacc}%</th>
                    {row.cells.map(c => (
                      <td key={c.terminal} className={cellClass(c.perShare)}>
                        {c.perShare != null ? c.perShare : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="model-note">
            {data.methodology} A DCF is a model, not a measurement — the spread
            across the grid above shows how much the answer moves on assumptions
            you chose. Not investment advice.
          </p>
        </>
      )}
    </div>
  );
}
