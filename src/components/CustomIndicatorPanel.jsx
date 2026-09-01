import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { compileFormula, validateFormula, FORMULA_HELP } from '../../charting/formula.js';
import { loadJSON, saveJSON } from '../utils/storage.js';

const STORE = 'quantbloom_custom_indicators';

export default function CustomIndicatorPanel() {
  const { state } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';
  const [name, setName] = useState('My Indicator');
  const [formula, setFormula] = useState('close - sma(close, 20)');
  const [saved, setSaved] = useState(() => loadJSON(STORE) || []);
  const previewRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const { data } = usePolling(`/api/v1/candles?symbol=${symbol}&resolution=1D`, 60000);

  // Live validation — cheap, runs on every keystroke against a probe series.
  const validation = useMemo(() => validateFormula(formula), [formula]);

  // Compiled runner for the real preview.
  const compiled = useMemo(() => compileFormula(formula), [formula]);

  useEffect(() => {
    if (!previewRef.current) return;
    const chart = createChart(previewRef.current, {
      width: previewRef.current.clientWidth, height: 140,
      layout: { background: { color: '#0a0a0a' }, textColor: '#666', fontFamily: "'JetBrains Mono', monospace", fontSize: 9 },
      grid: { vertLines: { color: '#151515' }, horzLines: { color: '#151515' } },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { visible: false },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addLineSeries({ color: '#b060ff', lineWidth: 1, priceLineVisible: false });
    const ro = new ResizeObserver(e => chart.applyOptions({ width: e[0].contentRect.width }));
    ro.observe(previewRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, []);

  // Plot the formula output whenever it or the data changes and it's valid.
  useEffect(() => {
    if (!seriesRef.current) return;
    if (!compiled.ok || !data?.candles?.length) { seriesRef.current.setData([]); return; }
    try {
      const out = compiled.run(data.candles);
      seriesRef.current.setData(out);
      chartRef.current?.timeScale().fitContent();
    } catch {
      seriesRef.current.setData([]);
    }
  }, [compiled, data]);

  const persist = (list) => { setSaved(list); saveJSON(STORE, list); };
  const save = () => {
    if (!validation.ok || !name.trim()) return;
    const entry = { id: Date.now(), name: name.trim(), formula };
    persist([entry, ...saved.filter(s => s.name !== entry.name)].slice(0, 20));
  };
  const load = (s) => { setName(s.name); setFormula(s.formula); };
  const remove = (id) => persist(saved.filter(s => s.id !== id));

  return (
    <div className="panel ci-panel">
      <h3 className="panel-title">
        Custom Indicator <span className="panel-badge">{symbol}</span>
      </h3>

      <input className="ci-name" value={name} onChange={e => setName(e.target.value)} placeholder="Indicator name" />

      <textarea className="ci-formula" rows={2} spellCheck={false} value={formula}
        onChange={e => setFormula(e.target.value)} placeholder="e.g. close - sma(close, 20)" />

      <div className={`ci-status ${validation.ok ? 'ok' : 'err'}`}>
        {validation.ok
          ? `✓ valid${validation.sample != null ? ` · latest ≈ ${validation.sample.toFixed(2)}` : ''}`
          : `✗ ${validation.error}`}
      </div>

      <div className="ci-preview" ref={previewRef} />

      <div className="ci-actions">
        <button className="ci-save" onClick={save} disabled={!validation.ok || !name.trim()}>Save</button>
      </div>

      {saved.length > 0 && (
        <div className="ci-saved">
          {saved.map(s => (
            <div key={s.id} className="ci-saved-row">
              <button className="ci-load" onClick={() => load(s)} title={s.formula}>{s.name}</button>
              <code className="ci-saved-formula">{s.formula}</code>
              <button className="ci-del" onClick={() => remove(s.id)} title="Delete">×</button>
            </div>
          ))}
        </div>
      )}

      <details className="ci-help">
        <summary>Reference</summary>
        <div className="ci-help-body">
          <div><span className="ci-help-k">Series:</span> {FORMULA_HELP.series.join(', ')}</div>
          <div><span className="ci-help-k">Functions:</span> {FORMULA_HELP.functions.join(', ')}</div>
          <div><span className="ci-help-k">Examples:</span></div>
          {FORMULA_HELP.examples.map(ex => (
            <button key={ex} className="ci-example" onClick={() => setFormula(ex)}>{ex}</button>
          ))}
        </div>
      </details>

      <p className="model-note">
        Formulas run in a sandboxed interpreter — a fixed whitelist of series,
        functions and operators, not JavaScript. There is no way to reach code
        or data outside the formula.
      </p>
    </div>
  );
}
