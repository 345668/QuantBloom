import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';

const RANGES = ['1y', '2y', '5y', '10y'];
const MODES = [
  { key: 'single', label: 'Single run' },
  { key: 'walkforward', label: 'Walk-forward' },
  { key: 'sweep', label: 'Sweep + guards' },
];

const pctCls = v => v == null ? '' : v >= 0 ? 'positive' : 'negative';

export default function BacktestPanel() {
  const { state } = useDashboard();
  const [symbol, setSymbol] = useState('SPY');
  const [range, setRange] = useState('5y');
  const [mode, setMode] = useState('single');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/v1/bot/backtest?symbol=${symbol}&range=${range}&mode=${mode}`);
      const j = await r.json();
      if (j.available === false) setError(j.message || 'Backtest unavailable');
      setData(j);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  // Equity curve geometry
  const curve = data?.equityCurve || [];
  const W = 320, H = 120, PAD_L = 34, PAD_B = 12, PAD_T = 6;
  const vals = curve.flatMap(p => [p.equity, p.benchmark].filter(v => v != null));
  const lo = vals.length ? Math.min(...vals) : 0;
  const hi = vals.length ? Math.max(...vals) : 1;
  const pad = (hi - lo) * 0.08 || 1;
  const xOf = i => PAD_L + (i / Math.max(curve.length - 1, 1)) * (W - PAD_L - 6);
  const yOf = v => PAD_T + (1 - (v - (lo - pad)) / ((hi + pad) - (lo - pad))) * (H - PAD_T - PAD_B);
  const path = key => curve.map((p, i) => p[key] == null ? null : `${i ? 'L' : 'M'}${xOf(i)},${yOf(p[key])}`).filter(Boolean).join('');

  return (
    <div className="panel bt-panel">
      <h3 className="panel-title">
        Backtest <span className="panel-badge">same code as live</span>
      </h3>

      <div className="bt-controls">
        <input className="bt-input" value={symbol}
          onChange={e => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && run()} placeholder="Symbol" />
        <button className="bt-input bt-use" onClick={() => setSymbol(state.activeSymbol)}
          title={`Use ${state.activeSymbol}`}>{state.activeSymbol}</button>
        <select className="bt-input" value={range} onChange={e => setRange(e.target.value)}>
          {RANGES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
        </select>
      </div>

      <div className="panel-tabs">
        {MODES.map(m => (
          <button key={m.key} className={`tab-btn ${mode === m.key ? 'active' : ''}`}
            onClick={() => setMode(m.key)}>{m.label}</button>
        ))}
      </div>

      <button className="bt-run" onClick={run} disabled={busy}>
        {busy ? 'Running…' : `Run ${MODES.find(m => m.key === mode).label.toLowerCase()}`}
      </button>

      {error && <div className="bt-error">{error}</div>}

      {/* --- Single run --- */}
      {data?.available && data.mode === 'single' && (
        <>
          <div className={`bt-verdict ${data.beatBenchmark ? 'win' : 'lose'}`}>
            {data.beatBenchmark
              ? `Beat buy-and-hold by ${data.excessReturn}%`
              : `Lost to buy-and-hold by ${Math.abs(data.excessReturn)}%`}
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="bt-chart" preserveAspectRatio="xMidYMid meet">
            {[0, 0.5, 1].map(f => {
              const v = (lo - pad) + f * ((hi + pad) - (lo - pad));
              return (
                <g key={f}>
                  <line x1={PAD_L} x2={W - 6} y1={yOf(v)} y2={yOf(v)} className="bt-grid" />
                  <text x={PAD_L - 3} y={yOf(v) + 2.5} textAnchor="end" className="bt-axis">
                    {(v / 1000).toFixed(0)}k
                  </text>
                </g>
              );
            })}
            <path d={path('benchmark')} className="bt-bench" />
            <path d={path('equity')} className="bt-equity" />
          </svg>
          <div className="bt-legend">
            <span><span className="bt-sw equity" />Strategy</span>
            <span><span className="bt-sw bench" />Buy &amp; hold</span>
          </div>

          <table className="bt-table">
            <thead><tr><th></th><th>Strategy</th><th>Buy &amp; hold</th></tr></thead>
            <tbody>
              {[
                ['Total return', 'totalReturn', '%'],
                ['CAGR', 'cagr', '%'],
                ['Sharpe', 'sharpe', ''],
                ['Max drawdown', 'maxDrawdown', '%'],
                ['Volatility', 'volatility', '%'],
                ['Win rate', 'winRate', '%'],
              ].map(([label, key, unit]) => (
                <tr key={key}>
                  <td className="bt-label">{label}</td>
                  <td className={key === 'maxDrawdown' ? 'negative' : pctCls(data.stats?.[key])}>
                    {data.stats?.[key] ?? '—'}{unit}
                  </td>
                  <td className={key === 'maxDrawdown' ? 'negative' : pctCls(data.benchmark?.[key])}>
                    {data.benchmark?.[key] ?? '—'}{unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bt-costs">
            {data.trades} trades · costs {data.costs.costDragPercent}% of capital
            (${data.costs.totalCost}) · {data.bars} bars
          </div>
        </>
      )}

      {/* --- Walk-forward --- */}
      {data?.available && data.mode === 'walkforward' && (
        <>
          <div className={`bt-verdict ${data.consistency.beatRate >= 50 ? 'win' : 'lose'}`}>
            Beat buy-and-hold in {data.consistency.foldsBeatingBenchmark} of {data.consistency.totalFolds} folds
          </div>
          <table className="bt-table">
            <thead><tr><th>Fold</th><th>Strategy</th><th>B&amp;H</th><th></th></tr></thead>
            <tbody>
              {data.folds.map(f => (
                <tr key={f.fold}>
                  <td className="bt-label">{f.fold}</td>
                  <td className={pctCls(f.totalReturn)}>{f.totalReturn}%</td>
                  <td className={pctCls(f.benchmarkReturn)}>{f.benchmarkReturn}%</td>
                  <td className={f.beatBenchmark ? 'positive' : 'negative'}>
                    {f.beatBenchmark ? 'win' : 'lose'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bt-costs">
            mean {data.consistency.meanReturn}% · worst {data.consistency.worstFold}% ·
            best {data.consistency.bestFold}%
          </div>
        </>
      )}

      {/* --- Sweep with overfitting guards --- */}
      {data?.available && data.mode === 'sweep' && (
        <>
          <div className={`bt-verdict ${data.overfitting.deflatedSharpe >= 0.95 ? 'win' : 'lose'}`}>
            {data.overfitting.verdict}
          </div>

          <div className="bt-guards">
            <div className="bt-guard">
              <span>Deflated Sharpe</span>
              <span className={data.overfitting.deflatedSharpe >= 0.95 ? 'positive' : 'negative'}>
                {data.overfitting.deflatedSharpe?.toFixed(3) ?? '—'}
              </span>
            </div>
            <div className="bt-guard">
              <span>PBO</span>
              <span className={data.overfitting.pbo <= 0.3 ? 'positive' : 'negative'}>
                {data.overfitting.pbo != null ? (data.overfitting.pbo * 100).toFixed(0) + '%' : '—'}
              </span>
            </div>
            <div className="bt-guard">
              <span>Trials</span><span>{data.trials}</span>
            </div>
            <div className="bt-guard">
              <span>Sharpe by luck</span>
              <span>{data.overfitting.expectedMaxSharpeByLuck?.toFixed(2) ?? '—'}</span>
            </div>
          </div>

          <h4 className="sub-title">Best variants by Sharpe</h4>
          <table className="bt-table">
            <thead><tr><th>Strategies</th><th>Thr</th><th>Return</th><th>Sharpe</th></tr></thead>
            <tbody>
              {data.ranking.slice(0, 6).map((v, i) => (
                <tr key={i}>
                  <td className="bt-label bt-strats">{v.strategies.join('+')}</td>
                  <td>{v.threshold}</td>
                  <td className={pctCls(v.totalReturn)}>{v.totalReturn}%</td>
                  <td>{v.sharpe}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="model-note">
            <strong>Deflated Sharpe</strong> adjusts for how many variants were
            tried — below 0.95 the winner is not distinguishable from luck.
            <strong> PBO</strong> is how often the in-sample winner underperforms
            out of sample; above 50% means picking the best backtest is worse
            than a coin flip.
          </p>
        </>
      )}

      {data?.available && (
        <p className="model-note">
          Point-in-time: at each bar the strategy sees only prior bars, and fills
          at the next bar's open. Costs and slippage applied on every fill.
          Benchmark is buy-and-hold over the identical window. Note the S&amp;P
          universe used elsewhere is today's constituents, so multi-year tests
          carry survivorship bias. Past results do not predict future returns.
        </p>
      )}
    </div>
  );
}
