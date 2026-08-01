import { useState, useMemo } from 'react';
import {
  futureValue, presentValue, npv, irr, effectiveRate, annuityPV, annuityFV,
} from '../../bot/tvm.js';

const COMPOUNDING = [
  { m: 1, label: 'Annual' },
  { m: 2, label: 'Semi-annual' },
  { m: 4, label: 'Quarterly' },
  { m: 12, label: 'Monthly' },
  { m: 365, label: 'Daily' },
];

const money = v => v == null || !isFinite(v) ? '—'
  : '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TVMPanel() {
  const [tab, setTab] = useState('pvfv');

  // PV / FV inputs
  const [amount, setAmount] = useState('1000');
  const [rate, setRate] = useState('5');
  const [years, setYears] = useState('10');
  const [m, setM] = useState(1);

  // NPV / IRR inputs
  const [flows, setFlows] = useState('-200, 20, 50, 70, 100, 50');
  const [discount, setDiscount] = useState('6');

  // Annuity inputs
  const [pmt, setPmt] = useState('100');

  const r = (parseFloat(rate) || 0) / 100;
  const n = parseFloat(years) || 0;
  const amt = parseFloat(amount) || 0;

  const pvfv = useMemo(() => ({
    fv: futureValue(amt, r, n, m),
    pv: presentValue(amt, r, n, m),
    effective: effectiveRate(r, m),
  }), [amt, r, n, m]);

  const cashflows = useMemo(
    () => flows.split(',').map(x => parseFloat(x.trim())).filter(x => !isNaN(x)),
    [flows],
  );
  const npvIrr = useMemo(() => {
    const dr = (parseFloat(discount) || 0) / 100;
    const v = cashflows.length ? npv(dr, cashflows) : null;
    const i = cashflows.length >= 2 ? irr(cashflows) : null;
    return { npv: v, irr: i };
  }, [cashflows, discount]);

  const annuity = useMemo(() => {
    const p = parseFloat(pmt) || 0;
    return { pv: annuityPV(p, r, n, m), fv: annuityFV(p, r, n, m) };
  }, [pmt, r, n, m]);

  return (
    <div className="panel tvm-panel">
      <h3 className="panel-title">Time Value of Money <span className="panel-badge">calculator</span></h3>

      <div className="panel-tabs">
        <button className={`tab-btn ${tab === 'pvfv' ? 'active' : ''}`} onClick={() => setTab('pvfv')}>PV / FV</button>
        <button className={`tab-btn ${tab === 'npv' ? 'active' : ''}`} onClick={() => setTab('npv')}>NPV / IRR</button>
        <button className={`tab-btn ${tab === 'annuity' ? 'active' : ''}`} onClick={() => setTab('annuity')}>Annuity</button>
      </div>

      {(tab === 'pvfv' || tab === 'annuity') && (
        <div className="tvm-inputs">
          {tab === 'annuity'
            ? <label>Payment / period<input type="number" value={pmt} onChange={e => setPmt(e.target.value)} /></label>
            : <label>Amount<input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></label>}
          <label>Rate %<input type="number" step="0.1" value={rate} onChange={e => setRate(e.target.value)} /></label>
          <label>Years<input type="number" value={years} onChange={e => setYears(e.target.value)} /></label>
          <label>Compounding
            <select value={m} onChange={e => setM(Number(e.target.value))}>
              {COMPOUNDING.map(c => <option key={c.m} value={c.m}>{c.label}</option>)}
            </select>
          </label>
        </div>
      )}

      {tab === 'pvfv' && (
        <div className="tvm-results">
          <div className="tvm-result">
            <span className="tvm-label">Future value</span>
            <span className="tvm-value positive">{money(pvfv.fv)}</span>
            <span className="tvm-sub">{money(amt)} compounded {n}y</span>
          </div>
          <div className="tvm-result">
            <span className="tvm-label">Present value</span>
            <span className="tvm-value">{money(pvfv.pv)}</span>
            <span className="tvm-sub">{money(amt)} discounted {n}y</span>
          </div>
          <div className="tvm-kv"><span>Effective annual rate</span><span>{(pvfv.effective * 100).toFixed(3)}%</span></div>
        </div>
      )}

      {tab === 'npv' && (
        <>
          <div className="tvm-inputs col">
            <label>Cash flows (t=0 first, comma-separated)
              <input value={flows} onChange={e => setFlows(e.target.value)} placeholder="-200, 20, 50, ..." />
            </label>
            <label>Discount rate %<input type="number" step="0.1" value={discount} onChange={e => setDiscount(e.target.value)} /></label>
          </div>
          <div className="tvm-results">
            <div className="tvm-result">
              <span className="tvm-label">NPV @ {discount}%</span>
              <span className={`tvm-value ${npvIrr.npv >= 0 ? 'positive' : 'negative'}`}>{money(npvIrr.npv)}</span>
              <span className="tvm-sub">{cashflows.length} cash flows</span>
            </div>
            <div className="tvm-result">
              <span className="tvm-label">IRR</span>
              <span className="tvm-value">{npvIrr.irr == null ? '—' : (npvIrr.irr * 100).toFixed(2) + '%'}</span>
              <span className="tvm-sub">rate where NPV = 0</span>
            </div>
          </div>
          <p className="model-note">
            NPV &gt; 0 means the project earns more than the discount rate. IRR is
            the break-even discount rate; take the project when IRR exceeds your
            cost of capital. Not investment advice.
          </p>
        </>
      )}

      {tab === 'annuity' && (
        <div className="tvm-results">
          <div className="tvm-result">
            <span className="tvm-label">Annuity PV</span>
            <span className="tvm-value">{money(annuity.pv)}</span>
            <span className="tvm-sub">worth today of {money(parseFloat(pmt) || 0)}/period</span>
          </div>
          <div className="tvm-result">
            <span className="tvm-label">Annuity FV</span>
            <span className="tvm-value positive">{money(annuity.fv)}</span>
            <span className="tvm-sub">accumulated over {n}y</span>
          </div>
        </div>
      )}
    </div>
  );
}
