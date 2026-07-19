import { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { greeks as bsGreeks, bsPrice } from '../../blackscholes.js';

// Preset structures, expressed relative to spot so they scale to any symbol.
const PRESETS = {
  'Long Call':      s => [{ type: 'call', side: 'long', strike: r(s), qty: 1, premium: null }],
  'Long Put':       s => [{ type: 'put', side: 'long', strike: r(s), qty: 1, premium: null }],
  'Covered Call':   s => [{ type: 'stock', side: 'long', strike: r(s), qty: 100, premium: null },
                          { type: 'call', side: 'short', strike: r(s * 1.05), qty: 1, premium: null }],
  'Bull Call Spread': s => [{ type: 'call', side: 'long', strike: r(s), qty: 1, premium: null },
                            { type: 'call', side: 'short', strike: r(s * 1.08), qty: 1, premium: null }],
  'Bear Put Spread':  s => [{ type: 'put', side: 'long', strike: r(s), qty: 1, premium: null },
                            { type: 'put', side: 'short', strike: r(s * 0.92), qty: 1, premium: null }],
  'Straddle':       s => [{ type: 'call', side: 'long', strike: r(s), qty: 1, premium: null },
                          { type: 'put', side: 'long', strike: r(s), qty: 1, premium: null }],
  'Strangle':       s => [{ type: 'call', side: 'long', strike: r(s * 1.06), qty: 1, premium: null },
                          { type: 'put', side: 'long', strike: r(s * 0.94), qty: 1, premium: null }],
  'Iron Condor':    s => [{ type: 'put', side: 'long', strike: r(s * 0.88), qty: 1, premium: null },
                          { type: 'put', side: 'short', strike: r(s * 0.94), qty: 1, premium: null },
                          { type: 'call', side: 'short', strike: r(s * 1.06), qty: 1, premium: null },
                          { type: 'call', side: 'long', strike: r(s * 1.12), qty: 1, premium: null }],
};

const r = (v) => Math.round(v);
const money = v => v == null || !isFinite(v) ? '—' : (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);

export default function StrategyBuilder() {
  const { state } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';

  const [spot, setSpot] = useState(100);
  const [days, setDays] = useState(30);
  const [vol, setVol] = useState(30);
  const [rate, setRate] = useState(4.5);
  const [legs, setLegs] = useState(PRESETS['Bull Call Spread'](100));
  const [preset, setPreset] = useState('Bull Call Spread');

  const T = Math.max(days / 365, 1 / 365);
  const sigma = vol / 100;
  const rf = rate / 100;

  // Theoretical premium for any leg the user hasn't priced manually.
  const priced = useMemo(() => legs.map(l => {
    if (l.type === 'stock') return { ...l, premium: l.strike };
    const theo = bsPrice(l.type, spot, l.strike, T, rf, sigma);
    return { ...l, premium: l.premium != null && l.premium !== '' ? Number(l.premium) : +theo.toFixed(2) };
  }), [legs, spot, T, rf, sigma]);

  // Net debit (positive = you pay) across all legs.
  const netCost = useMemo(() => priced.reduce((s, l) => {
    const mult = l.type === 'stock' ? 1 : 100;
    const signed = (l.side === 'long' ? 1 : -1) * l.premium * l.qty * mult;
    return s + signed;
  }, 0), [priced]);

  // Payoff at expiry across a spot range.
  const payoff = useMemo(() => {
    const lo = spot * 0.7, hi = spot * 1.3, steps = 90;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const S = lo + (hi - lo) * (i / steps);
      let v = 0;
      for (const l of priced) {
        const mult = l.type === 'stock' ? 1 : 100;
        const dir = l.side === 'long' ? 1 : -1;
        let intrinsic;
        if (l.type === 'stock') intrinsic = S;
        else if (l.type === 'call') intrinsic = Math.max(S - l.strike, 0);
        else intrinsic = Math.max(l.strike - S, 0);
        v += dir * intrinsic * l.qty * mult;
      }
      pts.push({ S, pnl: v - netCost });
    }
    return pts;
  }, [priced, spot, netCost]);

  const maxProfit = Math.max(...payoff.map(p => p.pnl));
  const maxLoss = Math.min(...payoff.map(p => p.pnl));
  const breakevens = useMemo(() => {
    const out = [];
    for (let i = 1; i < payoff.length; i++) {
      const a = payoff[i - 1], b = payoff[i];
      if ((a.pnl < 0 && b.pnl >= 0) || (a.pnl > 0 && b.pnl <= 0)) {
        const t = Math.abs(a.pnl) / (Math.abs(a.pnl) + Math.abs(b.pnl));
        out.push(a.S + (b.S - a.S) * t);
      }
    }
    return out;
  }, [payoff]);

  // Net position Greeks (stock contributes delta only).
  const net = useMemo(() => {
    const acc = { delta: 0, gamma: 0, vega: 0, theta: 0 };
    for (const l of priced) {
      const dir = l.side === 'long' ? 1 : -1;
      if (l.type === 'stock') { acc.delta += dir * l.qty; continue; }
      const g = bsGreeks(l.type, spot, l.strike, T, rf, sigma);
      if (!g.delta && g.delta !== 0) continue;
      acc.delta += dir * g.delta * l.qty * 100;
      acc.gamma += dir * g.gamma * l.qty * 100;
      acc.vega  += dir * g.vega  * l.qty * 100;
      acc.theta += dir * g.theta * l.qty * 100;
    }
    return acc;
  }, [priced, spot, T, rf, sigma]);

  const applyPreset = (name) => { setPreset(name); setLegs(PRESETS[name](spot)); };
  const updateLeg = (i, patch) => setLegs(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l));
  const removeLeg = (i) => setLegs(ls => ls.filter((_, j) => j !== i));

  // Chart geometry
  const W = 320, H = 130, PAD = 22;
  const pnls = payoff.map(p => p.pnl);
  const yMin = Math.min(...pnls), yMax = Math.max(...pnls);
  const pad = (yMax - yMin) * 0.12 || 1;
  const xOf = i => PAD + (i / (payoff.length - 1)) * (W - PAD - 6);
  const yOf = v => 8 + (1 - (v - (yMin - pad)) / ((yMax + pad) - (yMin - pad))) * (H - 8 - PAD);
  const zeroY = yOf(0);
  const path = payoff.map((p, i) => `${i ? 'L' : 'M'}${xOf(i)},${yOf(p.pnl)}`).join('');
  const spotIdx = payoff.findIndex(p => p.S >= spot);

  return (
    <div className="panel sb-panel">
      <h3 className="panel-title">
        Strategy Builder <span className="panel-badge">{symbol}</span>
      </h3>

      <select className="screener-select" value={preset} onChange={e => applyPreset(e.target.value)}>
        {Object.keys(PRESETS).map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <div className="sb-inputs">
        <label>Spot<input type="number" value={spot} onChange={e => setSpot(Number(e.target.value) || 0)} /></label>
        <label>Days<input type="number" value={days} onChange={e => setDays(Number(e.target.value) || 1)} /></label>
        <label>IV %<input type="number" value={vol} onChange={e => setVol(Number(e.target.value) || 1)} /></label>
        <label>Rate %<input type="number" value={rate} onChange={e => setRate(Number(e.target.value) || 0)} /></label>
      </div>

      {/* Payoff diagram */}
      <svg viewBox={`0 0 ${W} ${H}`} className="sb-chart" preserveAspectRatio="xMidYMid meet">
        <rect x={PAD} y={8} width={W - PAD - 6} height={zeroY - 8} className="sb-profit-zone" />
        <rect x={PAD} y={zeroY} width={W - PAD - 6} height={H - PAD - zeroY} className="sb-loss-zone" />
        <line x1={PAD} x2={W - 6} y1={zeroY} y2={zeroY} className="sb-zero" />
        <path d={path} className="sb-payoff" />
        {spotIdx >= 0 && <line x1={xOf(spotIdx)} x2={xOf(spotIdx)} y1={8} y2={H - PAD} className="sb-spot" />}
        {breakevens.map((be, i) => {
          const idx = payoff.findIndex(p => p.S >= be);
          return idx < 0 ? null : <circle key={i} cx={xOf(idx)} cy={zeroY} r="2.5" className="sb-be" />;
        })}
        <text x={PAD} y={H - 6} className="sb-axis">{payoff[0].S.toFixed(0)}</text>
        <text x={W - 6} y={H - 6} textAnchor="end" className="sb-axis">{payoff[payoff.length-1].S.toFixed(0)}</text>
        <text x={PAD + 2} y={14} className="sb-axis">{money(yMax)}</text>
      </svg>

      <div className="sb-stats">
        <div className="sb-stat"><span>Net {netCost >= 0 ? 'Debit' : 'Credit'}</span><span className={netCost >= 0 ? 'negative' : 'positive'}>{money(Math.abs(netCost))}</span></div>
        <div className="sb-stat"><span>Max Profit</span><span className="positive">{maxProfit > 1e8 ? 'Unlimited' : money(maxProfit)}</span></div>
        <div className="sb-stat"><span>Max Loss</span><span className="negative">{maxLoss < -1e8 ? 'Unlimited' : money(maxLoss)}</span></div>
        <div className="sb-stat"><span>Breakeven</span><span>{breakevens.length ? breakevens.map(b => b.toFixed(2)).join(', ') : '—'}</span></div>
      </div>

      <h4 className="sub-title">Net Greeks</h4>
      <div className="sb-greeks">
        <div><span>Δ</span><span className={net.delta >= 0 ? 'positive' : 'negative'}>{net.delta.toFixed(1)}</span></div>
        <div><span>Γ</span><span>{net.gamma.toFixed(3)}</span></div>
        <div><span>V</span><span>{net.vega.toFixed(1)}</span></div>
        <div><span>Θ</span><span className={net.theta >= 0 ? 'positive' : 'negative'}>{net.theta.toFixed(1)}</span></div>
      </div>

      <h4 className="sub-title">Legs</h4>
      <div className="sb-legs">
        {priced.map((l, i) => (
          <div key={i} className="sb-leg">
            <select value={l.side} onChange={e => updateLeg(i, { side: e.target.value })}>
              <option value="long">Long</option><option value="short">Short</option>
            </select>
            <select value={l.type} onChange={e => updateLeg(i, { type: e.target.value })}>
              <option value="call">Call</option><option value="put">Put</option><option value="stock">Stock</option>
            </select>
            <input type="number" value={l.strike} title="Strike"
              onChange={e => updateLeg(i, { strike: Number(e.target.value) || 0 })} />
            <input type="number" value={l.qty} title="Quantity"
              onChange={e => updateLeg(i, { qty: Number(e.target.value) || 1 })} />
            <span className="sb-prem" title="Theoretical premium (Black-Scholes)">{l.premium?.toFixed(2)}</span>
            <button className="sb-del" onClick={() => removeLeg(i)}>×</button>
          </div>
        ))}
        <button className="sb-add" onClick={() => setLegs(ls => [...ls, { type: 'call', side: 'long', strike: r(spot), qty: 1, premium: null }])}>
          + Add leg
        </button>
      </div>

      <p className="sb-note">
        Premiums are Black-Scholes theoretical values from the inputs above, not
        live quotes. Override any leg's premium by editing it.
      </p>
    </div>
  );
}
