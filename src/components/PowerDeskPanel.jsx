import { useState, useMemo } from 'react';
import {
  buildStack, meritOrderDispatch, sparkSpread, darkSpread, effectiveHeatRate, twoNodeLMP,
  plantDailyPnl, breakevenPowerPrice, hrcoValueMC,
  stylizedDailyProfile, netDemandCurve, hourlyClearingPrices, peakOffPeak, scarcityAdder,
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
  const [tab, setTab] = useState('dispatch');

  // Two-node congestion inputs (seeded with the paper's A↔B example).
  const [costA, setCostA] = useState(100);
  const [costB, setCostB] = useState(10);
  const [demA, setDemA] = useState(60);
  const [lineLimit, setLineLimit] = useState(50);
  const node = useMemo(() => twoNodeLMP({
    genA: { cost: costA, capacity: 1000 }, genB: { cost: costB, capacity: 1000 },
    demandA: demA, demandB: 0, lineLimit,
  }), [costA, costB, demA, lineLimit]);

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
      <h3 className="panel-title">Power Desk <span className="panel-badge">{{ dispatch: 'merit order', congestion: 'congestion', plant: 'plant P&L', duck: 'duck curve' }[tab]}</span></h3>

      <div className="panel-tabs">
        <button className={`tab-btn ${tab === 'dispatch' ? 'active' : ''}`} onClick={() => setTab('dispatch')}>Dispatch</button>
        <button className={`tab-btn ${tab === 'congestion' ? 'active' : ''}`} onClick={() => setTab('congestion')}>Congestion</button>
        <button className={`tab-btn ${tab === 'plant' ? 'active' : ''}`} onClick={() => setTab('plant')}>Plant / HRCO</button>
        <button className={`tab-btn ${tab === 'duck' ? 'active' : ''}`} onClick={() => setTab('duck')}>Duck curve</button>
      </div>

      {tab === 'congestion' && (
        <TwoNodeView node={node} costA={costA} setCostA={setCostA} costB={costB} setCostB={setCostB}
          demA={demA} setDemA={setDemA} lineLimit={lineLimit} setLineLimit={setLineLimit} />
      )}
      {tab === 'plant' && <PlantView gasPrice={gasPrice} />}
      {tab === 'duck' && <DuckView gasPrice={gasPrice} coalPrice={coalPrice} />}

      {tab === 'dispatch' && (
      <>
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
      </>
      )}
    </div>
  );
}

/** Two-node LMP / congestion view. */
function TwoNodeView({ node, costA, setCostA, costB, setCostB, demA, setDemA, lineLimit, setLineLimit }) {
  const util = lineLimit > 0 ? Math.min(node.flowMagnitude / lineLimit, 1) : 1;
  const dir = node.flow > 0 ? '→' : node.flow < 0 ? '←' : '·';
  return (
    <div className="twonode">
      <div className="power-inputs">
        <label>A cost $/MWh<input type="number" value={costA} onChange={e => setCostA(+e.target.value || 0)} /></label>
        <label>B cost $/MWh<input type="number" value={costB} onChange={e => setCostB(+e.target.value || 0)} /></label>
        <label>Demand @ A<input type="number" value={demA} onChange={e => setDemA(+e.target.value || 0)} /></label>
      </div>
      <div className="power-demand">
        <span>Line limit {lineLimit} MW · flow {Math.abs(node.flow)} MW ({(util * 100).toFixed(0)}%)</span>
        <input type="range" min="0" max="120" value={lineLimit} onChange={e => setLineLimit(+e.target.value)} />
      </div>

      {/* Two-node diagram */}
      <svg className="twonode-svg" viewBox="0 0 320 120" width="100%">
        {/* line */}
        <line x1="90" y1="60" x2="230" y2="60" stroke={node.congested ? 'var(--accent-down)' : 'var(--border-bright)'} strokeWidth={2 + util * 6} strokeLinecap="round" opacity="0.8" />
        <text x="160" y="48" textAnchor="middle" className="twonode-flow">{dir} {node.flowMagnitude} MW</text>
        <text x="160" y="82" textAnchor="middle" className={node.congested ? 'twonode-cong' : 'twonode-ok'}>{node.congested ? 'CONGESTED' : 'open'}</text>
        {/* node A */}
        <circle cx="60" cy="60" r="34" fill="var(--bg-secondary)" stroke={node.congested ? 'var(--accent-down)' : 'var(--border-bright)'} strokeWidth="1.5" />
        <text x="60" y="52" textAnchor="middle" className="twonode-node">A</text>
        <text x="60" y="68" textAnchor="middle" className="twonode-lmp">${node.lmpA}</text>
        {/* node B */}
        <circle cx="260" cy="60" r="34" fill="var(--bg-secondary)" stroke="var(--border-bright)" strokeWidth="1.5" />
        <text x="260" y="52" textAnchor="middle" className="twonode-node">B</text>
        <text x="260" y="68" textAnchor="middle" className="twonode-lmp">${node.lmpB}</text>
      </svg>

      <div className="twonode-stats">
        <div><span className="power-label">LMP A</span><span className={node.congested ? 'negative' : ''}>{money(node.lmpA)}</span></div>
        <div><span className="power-label">LMP B</span><span>{money(node.lmpB)}</span></div>
        <div><span className="power-label">Congestion basis</span><span className={node.congestionBasis ? 'negative' : ''}>{money(node.congestionBasis)}</span></div>
      </div>
      {node.unserved > 0 && <p className="power-shortfall">⚠ {node.unserved} MW unserved</p>}

      <p className="power-hint">
        While the line has slack, one price clears both nodes. When it saturates,
        the prices decouple — the importing node jumps to its local cost. That
        {' '}{money(node.congestionBasis)} gap is the <strong>congestion basis</strong>,
        the payoff of an FTR.
      </p>
      <p className="model-note">
        Reproduces the two-node example from "Power 2026: Electricity Pricing in the
        Age of AI". A teaching model, not a live grid.
      </p>
    </div>
  );
}

/** Plant economics + heat-rate call option (P3). */
function PlantView({ gasPrice }) {
  const [capacity, setCapacity] = useState(500);
  const [heatRate, setHeatRate] = useState(7);
  const [powerPrice, setPowerPrice] = useState(50);
  const [hours, setHours] = useState(16);
  const [powerVol, setPowerVol] = useState(45);
  const [corr, setCorr] = useState(30);

  const pnl = useMemo(() => plantDailyPnl({ capacityMW: capacity, heatRate, gasPrice, powerPrice, hours }),
    [capacity, heatRate, gasPrice, powerPrice, hours]);
  const breakeven = breakevenPowerPrice(heatRate, gasPrice);
  const hrco = useMemo(() => hrcoValueMC({
    capacityMW: capacity, heatRate, powerPrice, gasPrice,
    powerVol: powerVol / 100, gasVol: 0.3, corr: corr / 100, hours, days: 21, sims: 4000, seed: 11,
  }), [capacity, heatRate, powerPrice, gasPrice, powerVol, corr, hours]);

  return (
    <div>
      <div className="power-inputs">
        <label>Capacity MW<input type="number" value={capacity} onChange={e => setCapacity(+e.target.value || 0)} /></label>
        <label>Heat rate<input type="number" step="0.5" value={heatRate} onChange={e => setHeatRate(+e.target.value || 0)} /></label>
        <label>Power $/MWh<input type="number" value={powerPrice} onChange={e => setPowerPrice(+e.target.value || 0)} /></label>
        <label>Run hours/day<input type="number" value={hours} onChange={e => setHours(+e.target.value || 0)} /></label>
        <label>Power vol %<input type="number" value={powerVol} onChange={e => setPowerVol(+e.target.value || 0)} /></label>
        <label>Power/gas corr %<input type="number" value={corr} onChange={e => setCorr(+e.target.value || 0)} /></label>
      </div>

      <div className="power-clearing">
        <div>
          <span className="power-label">Daily gross margin</span>
          <span className={`power-price ${pnl.grossMargin >= 0 ? '' : 'negative'}`}>{money(pnl.grossMargin)}</span>
          <span className="power-unit">/day @ ${powerPrice}, gas ${gasPrice}</span>
        </div>
      </div>
      <div className="twonode-stats">
        <div><span className="power-label">Spark</span><span className={pnl.sparkPerMWh >= 0 ? 'positive' : 'negative'}>{money(pnl.sparkPerMWh)}</span></div>
        <div><span className="power-label">Breakeven power</span><span>{money(breakeven)}</span></div>
        <div><span className="power-label">Revenue/day</span><span>{money(pnl.revenue)}</span></div>
      </div>

      <h4 className="sub-title">Heat-rate call option (21-day, MC)</h4>
      <div className="twonode-stats">
        <div><span className="power-label">Option value</span><span className="positive">{money(hrco.value)}</span></div>
        <div><span className="power-label">Intrinsic</span><span>{money(hrco.intrinsic)}</span></div>
        <div><span className="power-label">Time premium</span><span className="positive">{money(hrco.optionPremium)}</span></div>
      </div>
      <p className="power-hint">
        The HRCO pays the positive spark day by day, so a plant owner sells it for
        a fixed monthly cash flow (to underwrite a loan). Value ≥ intrinsic by
        optionality; it rises with volatility and falls as power &amp; gas co-move.
      </p>
      <p className="model-note">
        Plant economics &amp; heat-rate call option from "Power 2026". Monte-Carlo on
        modelled lognormal prices — illustrative, not a quoted market.
      </p>
    </div>
  );
}

/** Duck curve: demand, renewables, net demand and the resulting price shape (P4). */
function DuckView({ gasPrice, coalPrice }) {
  const [solarCap, setSolarCap] = useState(1600);
  const [voll, setVoll] = useState(5000);
  const [plol, setPlol] = useState(2);

  const { curve, prices } = useMemo(() => {
    const prof = stylizedDailyProfile({ solarCap });
    const renew = prof.solar.map((s, i) => s + prof.wind[i]);
    const curve = netDemandCurve(prof.demand, renew);
    const stack = buildStack({ gasPrice, coalPrice });
    return { curve, prices: hourlyClearingPrices(curve, stack) };
  }, [solarCap, gasPrice, coalPrice]);

  const strips = peakOffPeak(prices);
  const adder = scarcityAdder(voll, plol / 100);

  // Geometry
  const W = 320, H = 120;
  const maxDemand = Math.max(...curve.map(c => c.demand)) * 1.05;
  const maxPrice = Math.max(...prices, 1) * 1.1;
  const xOf = h => (h / 23) * W;
  const yDem = v => H - (v / maxDemand) * H;
  const yPrc = v => H - (v / maxPrice) * H;
  const path = (sel, y) => curve.map((c, i) => `${i === 0 ? 'M' : 'L'}${xOf(c.hour).toFixed(1)},${y(sel(c)).toFixed(1)}`).join(' ');

  return (
    <div>
      <div className="power-demand">
        <span>Solar capacity {solarCap} MW</span>
        <input type="range" min="0" max="3000" step="100" value={solarCap} onChange={e => setSolarCap(+e.target.value)} />
      </div>

      <svg className="power-stack" viewBox={`0 0 ${W} ${H + 14}`} width="100%">
        <path d={path(c => c.demand, yDem)} className="duck-demand" fill="none" />
        <path d={path(c => c.renewables, yDem)} className="duck-renew" fill="none" />
        <path d={path(c => c.net, yDem)} className="duck-net" fill="none" />
        <text x="2" y="10" className="power-axis">demand ▬ renewables ▬ net ▬</text>
        <text x="2" y={H + 12} className="power-axis">0h</text>
        <text x={W - 20} y={H + 12} className="power-axis">23h</text>
      </svg>
      <svg className="power-stack" viewBox={`0 0 ${W} ${H / 2 + 14}`} width="100%" style={{ height: 70 }}>
        <path d={curve.map((c, i) => `${i === 0 ? 'M' : 'L'}${xOf(c.hour).toFixed(1)},${(H / 2 - (prices[i] / maxPrice) * (H / 2)).toFixed(1)}`).join(' ')} className="duck-price" fill="none" />
        <text x="2" y="10" className="power-axis">LMP $/MWh (evening spike)</text>
      </svg>

      <div className="twonode-stats">
        <div><span className="power-label">On-peak strip</span><span>{money(strips.peak)}</span></div>
        <div><span className="power-label">Off-peak strip</span><span>{money(strips.offPeak)}</span></div>
        <div><span className="power-label">Midday LMP</span><span>{money(prices[13])}</span></div>
      </div>

      <h4 className="sub-title">Energy-only scarcity adder</h4>
      <div className="power-spark">
        <label>VOLL $/MWh<input type="number" value={voll} onChange={e => setVoll(+e.target.value || 0)} /></label>
        <label>P(lost load) %<input type="number" step="0.5" value={plol} onChange={e => setPlol(+e.target.value || 0)} /></label>
        <div className="power-spark-out"><div><span className="power-label">Price adder</span><span className="negative">{money(adder)}/MWh</span></div></div>
      </div>
      <p className="power-hint">
        High solar deepens the midday trough (the duck's belly) and forces less
        efficient units on in the evening — a steeper price curve. Energy-only
        markets add VOLL × P(lost load) on top when supply runs short.
      </p>
      <p className="model-note">
        Stylised daily profile from "Power 2026" — an illustration of the duck curve,
        not live grid data.
      </p>
    </div>
  );
}
