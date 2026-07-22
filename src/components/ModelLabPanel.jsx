import { useState, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';

const DATA_SOURCES = [
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com', note: 'OHLCV, used live in this app' },
  { name: 'FRED', url: 'https://fred.stlouisfed.org', note: 'Macro & rates' },
  { name: 'Alpha Vantage', url: 'https://www.alphavantage.co', note: 'Free tier quotes' },
  { name: 'Finnhub', url: 'https://finnhub.io', note: 'Fundamentals, news' },
  { name: 'Nasdaq Data Link', url: 'https://data.nasdaq.com', note: 'Curated datasets' },
  { name: 'Tiingo', url: 'https://www.tiingo.com', note: 'EOD + intraday' },
  { name: 'ml4t-data', url: 'https://github.com/ml4t/data', note: '20+ provider adapters' },
  { name: 'Kaggle Datasets', url: 'https://www.kaggle.com/datasets', note: 'Research data' },
];

async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}

const pctCls = v => v == null ? '' : v >= 0 ? 'positive' : 'negative';

export default function ModelLabPanel() {
  const { state } = useDashboard();
  const [symbol, setSymbol] = useState('AAPL');
  const [range, setRange] = useState('5y');
  const [horizon, setHorizon] = useState(10);
  const [up, setUp] = useState(3);
  const [down, setDown] = useState(2);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [published, setPublished] = useState([]);
  const [tab, setTab] = useState('train');

  const loadPublished = useCallback(async () => {
    const p = await fetch('/api/v1/bot/models/published').then(r => r.json()).catch(() => []);
    setPublished(Array.isArray(p) ? p : []);
  }, []);
  useEffect(() => { loadPublished(); }, [loadPublished]);

  const train = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await post('/api/v1/bot/train', {
        symbol, range, horizon, up: up / 100, down: down / 100,
      });
      if (!r.ok) setError(r.error || 'Training failed');
      else setResult(r);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!result?.model) return;
    setBusy(true);
    const r = await post(`/api/v1/bot/models/${result.model.id}/publish`);
    if (!r.ok) setError(r.error + (r.reasons ? ': ' + r.reasons.join('; ') : ''));
    else { await loadPublished(); setTab('public'); }
    setBusy(false);
  };

  const m = result?.model;
  const gate = result?.gate;

  return (
    <div className="panel ml-panel">
      <h3 className="panel-title">
        Model Lab <span className="panel-badge">local training</span>
      </h3>

      <div className="panel-tabs">
        <button className={`tab-btn ${tab === 'train' ? 'active' : ''}`} onClick={() => setTab('train')}>Train</button>
        <button className={`tab-btn ${tab === 'public' ? 'active' : ''}`} onClick={() => setTab('public')}>
          Public{published.length ? ` (${published.length})` : ''}
        </button>
        <button className={`tab-btn ${tab === 'data' ? 'active' : ''}`} onClick={() => setTab('data')}>Data</button>
      </div>

      {tab === 'train' && (
        <>
          <div className="ml-controls">
            <input className="ml-input" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="Symbol" />
            <button className="ml-input ml-use" onClick={() => setSymbol(state.activeSymbol)} title={`Use ${state.activeSymbol}`}>{state.activeSymbol}</button>
            <select className="ml-input" value={range} onChange={e => setRange(e.target.value)}>
              {['2y', '5y', '10y'].map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="ml-controls">
            <label className="ml-lab">Horizon<input type="number" value={horizon} onChange={e => setHorizon(+e.target.value || 10)} /></label>
            <label className="ml-lab">Up %<input type="number" value={up} onChange={e => setUp(+e.target.value || 3)} /></label>
            <label className="ml-lab">Down %<input type="number" value={down} onChange={e => setDown(+e.target.value || 2)} /></label>
          </div>

          <button className="ml-train" onClick={train} disabled={busy}>
            {busy ? 'Training…' : 'Train logistic model'}
          </button>
          <div className="ml-hint">
            Triple-barrier labels · point-in-time features · temporal 70/30 split.
            Heavier models (LightGBM, RL) train via the local Python pipeline — see MODEL_TRAINING.md.
          </div>

          {error && <div className="ml-error">{error}</div>}

          {m && (
            <>
              <div className={`ml-verdict ${gate.eligible ? 'win' : 'lose'}`}>
                {gate.eligible ? 'Passed the publish gate' : 'Blocked by the publish gate'}
              </div>

              <table className="ml-table">
                <tbody>
                  <tr><td>Test AUC</td><td className={m.testMetrics.auc >= 0.55 ? 'positive' : 'negative'}>{m.testMetrics.auc}</td>
                      <td className="ml-dim">train acc {m.trainMetrics.accuracy}</td></tr>
                  <tr><td>OOS return</td><td className={pctCls(m.backtest?.stats?.totalReturn)}>{m.backtest?.stats?.totalReturn}%</td>
                      <td className="ml-dim">B&H {m.backtest?.benchmarkReturn}%</td></tr>
                  <tr><td>OOS Sharpe</td><td className={m.backtest?.stats?.sharpe >= 0.5 ? 'positive' : 'negative'}>{m.backtest?.stats?.sharpe}</td>
                      <td className="ml-dim">{m.backtest?.trades} trades</td></tr>
                  <tr><td>Deflated Sharpe</td><td className={m.backtest?.deflatedSharpe >= 0.9 ? 'positive' : 'negative'}>{m.backtest?.deflatedSharpe?.toFixed(3) ?? '—'}</td>
                      <td className="ml-dim">luck-adjusted</td></tr>
                </tbody>
              </table>

              {!gate.eligible && (
                <ul className="ml-reasons">
                  {gate.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}

              <button className="ml-publish" onClick={publish} disabled={!gate.eligible || busy}
                title={gate.eligible ? 'Publish to the public page' : 'Model must pass every gate check first'}>
                {gate.eligible ? 'Publish to public page' : 'Cannot publish — failed validation'}
              </button>
            </>
          )}
        </>
      )}

      {tab === 'public' && (
        <>
          {!published.length ? (
            <p className="panel-empty">No published models yet. Only models that beat buy-and-hold out of sample and survive deflation can be published.</p>
          ) : (
            <div className="ml-published">
              {published.map(p => (
                <div key={p.id} className="ml-pub">
                  <div className="ml-pub-head">
                    <span className="ml-pub-sym">{p.symbol}</span>
                    <span className="ml-pub-type">{p.modelType}</span>
                    <span className="positive">{p.backtest.stats.totalReturn}% OOS</span>
                  </div>
                  <div className="ml-pub-meta">
                    AUC {p.testMetrics.auc} · Sharpe {p.backtest.stats.sharpe} ·
                    DSR {p.backtest.deflatedSharpe?.toFixed(2)} · beat B&H by {(p.backtest.stats.totalReturn - p.backtest.benchmarkReturn).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="model-note">
            The public page shows only models that cleared the gate: positive
            out-of-sample Sharpe, beat buy-and-hold, and a Deflated Sharpe ≥ 0.90.
            The server re-checks eligibility on publish, so nothing bypasses it.
          </p>
        </>
      )}

      {tab === 'data' && (
        <div className="ml-sources">
          {DATA_SOURCES.map(d => (
            <a key={d.name} className="ml-source" href={d.url} target="_blank" rel="noopener noreferrer">
              <span className="ml-source-name">{d.name}</span>
              <span className="ml-source-note">{d.note}</span>
            </a>
          ))}
          <p className="model-note">
            This app trains on Yahoo OHLCV. For richer features and heavier
            models, the ml4t-data library unifies 20+ providers — see
            MODEL_TRAINING.md for the local pipeline.
          </p>
        </div>
      )}
    </div>
  );
}
