import { useState, useMemo } from 'react';
import {
  buildStack, meritOrderDispatch, sparkSpread, darkSpread, effectiveHeatRate,
} from '../../charting/power.js';

const FUEL_COLOR = {
  nuclear: '#b060ff', wind: '#00cccc', solar: '#FFB800', hydro: '#4a90d9',
  gas: '#ff8c00', coal: '#888', oil: '#cc2200',
};
const money = v => v == null ? '—' : '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function PowerDeskPanel() {
  const [gasPrice, setGasPrice] = useState(3.5);
  const [coalPrice, setCoalPrice] = useState(2.0);
  const [carbon, setCarbon] = useState(0);
  const [demandPct, setDemandPct] = useState(70);
  const [heatRate, setHeatRate] = useState(7);

  const stack = useMemo(() => buildStack({ gasPrice, coalPrice, carbon }), [gasPrice, coalPrice, carbon]);
  const totalCap = useMemo(() => stack.reduce((s, g) => s + g.capacity, 0), [stack]);
  const demand = Math.round(totalCap * demandPct / 100);
  const result = useMemo(() => meritOrderDispatch(stack, demand), [stack, demand]);

  // Supply-stack geometry (sorted cheapest-first, cumulative on the x-axis).
  const sorted = useMemo(() => [...stack].sort((a, b) => a.marginalCost - b.marginalCost), [stack]);
  const maxCost = Math.max(...sorted.map(g => g.marginalCost), 10) * 1.1;
  const W = 320, H = 150;
  let cum = 0;
  const bars = sorted.map(g => {
    const x = (cum / totalCap) * W;
    const w = (g.capacity / totalCap) * W;
    const h = (g.marginalCost / maxCost) * H;
    cum += g.capacity;
    return { g, x, w, h, isMarginal: g.name === result.marginalUnit };
  });
  const demandX = (demand / totalCap) * W;
  const clearY = H - (result.clearingPrice / maxCost) * H;

  const power = result.clearingPrice; // use the clearing price as the reference power price
  const spark = sparkSpread(power, heatRate, gasPrice);
  const effHR = effectiveHeatRate(power, gasPrice);

  return (
    <div className="panel power-panel">
      <h3 className="panel-title">Power Desk <span className="panel-badge">merit order</span></h3>

      <div className="power-inputs">
        <label>Gas $/MMBtu<input type="number" step="0.25" value={gasPrice} onChange={e => setGasPrice(+e.target.value || 0)} /></label>
        <label>Coal $/MMBtu<input type="number" step="0.25" value={coalPrice} onChange={e => setCoalPrice(+e.target.value || 0)} /></label>
        <label>Carbon $/MWh<input type="number" step="1" value={carbon} onChange={e => setCarbon(+e.target.value || 0)} /></label>
      </div>

      <div className="power-demand">
        <span>Demand {demand.toLocaleString()} MW ({demandPct}% of {totalCap.toLocaleString()})</span>
        <input type="range" min="0" max="100" value={demandPct} onChange={e => setDemandPct(+e.target.value)} />
      </div>

      {/* Clearing price + marginal unit */}
      <div className="power-clearing">
        <div>
          <span className="power-label">Clearing price (LMP)</span>
          <span className={`power-price ${result.unserved > 0 ? 'negative' : ''}`}>{money(result.clearingPrice)}<span className="power-unit">/MWh</span></span>
        </div>
        <div className="power-marginal">
          <span className="power-label">Marginal unit</span>
          <span>{result.marginalUnit || '—'}</span>
          {result.unserved > 0 && <span className="power-shortfall">⚠ {result.unserved.toLocaleString()} MW unserved (shortfall)</span>}
        </div>
      </div>

      {/* Supply stack / merit-order curve */}
      <svg className="power-stack" viewBox={`0 0 ${W} ${H + 18}`} width="100%">
        {bars.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={H - b.h} width={Math.max(b.w - 0.5, 0.5)} height={b.h}
              fill={FUEL_COLOR[b.g.fuel] || '#888'} opacity={b.isMarginal ? 1 : 0.55}
              stroke={b.isMarginal ? '#fff' : 'none'} strokeWidth={b.isMarginal ? 1 : 0}>
              <title>{b.g.name}: {b.g.capacity} MW @ {money(b.g.marginalCost)}/MWh</title>
            </rect>
          </g>
        ))}
        {/* demand line */}
        <line x1={demandX} y1={0} x2={demandX} y2={H} stroke="#fff" strokeWidth="1" strokeDasharray="3 2" />
        {/* clearing price line */}
        {result.clearingPrice > 0 && <line x1={0} y1={clearY} x2={W} y2={clearY} stroke="var(--accent-neutral)" strokeWidth="1" strokeDasharray="2 2" />}
        <text x={2} y={12} className="power-axis">${maxCost.toFixed(0)}/MWh</text>
        <text x={demandX + 3} y={H + 14} className="power-axis">demand</text>
      </svg>

      {/* Dispatch table */}
      <table className="power-table">
        <thead><tr><th>Unit</th><th>MW</th><th>Cost</th><th>Rent</th></tr></thead>
        <tbody>
          {result.dispatched.map((d, i) => (
            <tr key={i} className={d.name === result.marginalUnit ? 'power-marg-row' : ''}>
              <td><span className="power-dot" style={{ background: FUEL_COLOR[d.fuel] || '#888' }} />{d.name}</td>
              <td>{Math.round(d.dispatchedMW).toLocaleString()}</td>
              <td>{money(d.marginalCost)}</td>
              <td className="positive">{money(d.inframarginalRent)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Spark spread */}
      <h4 className="sub-title">Spark spread</h4>
      <div className="power-spark">
        <label>Heat rate<input type="number" step="0.5" value={heatRate} onChange={e => setHeatRate(+e.target.value || 0)} /></label>
        <div className="power-spark-out">
          <div><span className="power-label">Spark @ HR {heatRate}</span><span className={spark >= 0 ? 'positive' : 'negative'}>{money(spark)}/MWh</span></div>
          <div><span className="power-label">Break-even heat rate</span><span>{effHR ?? '—'}</span></div>
        </div>
      </div>
      <p className="power-hint">
        Power {money(power)} − HR×gas. A gas unit runs when its heat rate is below
        the break-even ({effHR ?? '—'}); more efficient (lower HR) = more margin.
      </p>

      <p className="model-note">
        Marginal-cost pricing on a modelled generator stack — a calculator, not a
        live ISO/LMP feed. Method from "Power 2026: Electricity Pricing in the Age of AI".
      </p>
    </div>
  );
}
