import { useState, useEffect, useCallback } from 'react';
import usePolling from '../hooks/usePolling.js';

const money = v => v == null ? '—' : (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 });

async function post(path, body = {}) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export default function BotPanel() {
  const { data, refetch } = usePolling('/api/v1/bot/status', 10000);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [confirmKill, setConfirmKill] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [showStrategies, setShowStrategies] = useState(false);

  const { data: decisions } = usePolling('/api/v1/bot/decisions?limit=8', 15000);

  const act = useCallback(async (label, fn) => {
    setBusy(label); setError(null);
    try {
      const res = await fn();
      if (res?.ok === false) setError(res.error || 'Action failed');
      return res;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
      refetch();
    }
  }, [refetch]);

  // Reset the kill confirmation if the user navigates away from the intent.
  useEffect(() => {
    if (!confirmKill) return;
    const t = setTimeout(() => setConfirmKill(false), 8000);
    return () => clearTimeout(t);
  }, [confirmKill]);

  if (!data) return <div className="panel"><h3 className="panel-title">Trading Bot</h3><p className="panel-empty">Loading...</p></div>;

  const enabled = data.enabled;
  const halted = data.halted;
  const canEnable = data.brokerConfigured && !(halted && data.requiresManualRestart);

  return (
    <div className="panel bot-panel">
      <h3 className="panel-title">
        Trading Bot
        <span className={`panel-badge ${data.isPaper ? 'bot-paper' : 'bot-live'}`}>
          {data.isPaper ? 'PAPER' : 'LIVE'}
        </span>
      </h3>

      {/* The switch. */}
      <div className={`bot-switch-row ${enabled ? 'on' : 'off'}`}>
        <button
          className={`bot-switch ${enabled ? 'on' : 'off'}`}
          disabled={!canEnable && !enabled || busy === 'toggle'}
          onClick={() => act('toggle', () => post('/api/v1/bot/toggle', { enabled: !enabled }))}
          title={enabled ? 'Switch the bot off' : 'Switch the bot on'}
        >
          <span className="bot-switch-track"><span className="bot-switch-knob" /></span>
          <span className="bot-switch-label">{enabled ? 'ON' : 'OFF'}</span>
        </button>
        <span className="bot-status-text">
          {halted ? <span className="negative">HALTED — {data.haltReason}</span>
            : enabled ? <span className="positive">Armed · trading enabled</span>
            : <span className="text-dim">Idle · no orders will be placed</span>}
        </span>
      </div>

      {error && <div className="bot-error">{error}</div>}

      {halted && (
        <div className="bot-halt">
          <span>{data.requiresManualRestart ? 'Manual reset required.' : 'Clears at the next trading day.'}</span>
          <button className="bot-btn" disabled={busy === 'reset'}
            onClick={() => act('reset', () => post('/api/v1/bot/reset-halt'))}>Reset halt</button>
        </div>
      )}

      {/* Account */}
      {data.account && (
        <div className="bot-stats">
          <div className="bot-stat"><span>Equity</span><span>{money(data.account.equity)}</span></div>
          <div className="bot-stat"><span>Cash</span><span>{money(data.account.cash)}</span></div>
          <div className="bot-stat">
            <span>Day P&L</span>
            <span className={data.account.dailyPnl >= 0 ? 'positive' : 'negative'}>
              {data.account.dailyPnl >= 0 ? '+' : ''}{data.account.dailyPnlPercent?.toFixed(2)}%
            </span>
          </div>
          <div className="bot-stat"><span>Positions</span><span>{data.positions?.length ?? 0}</span></div>
        </div>
      )}

      <div className="bot-meta">
        <span>Market {data.marketOpen ? <span className="positive">open</span> : <span className="text-dim">closed</span>}</span>
        <span>Orders today {data.ordersToday}/{data.limits?.maxOrdersPerDay}</span>
        <span>LLM {data.llmConfigured ? `${data.llmBudget?.remaining} left` : 'off'}</span>
      </div>

      {/* Controls */}
      <div className="bot-actions">
        <button className="bot-btn" disabled={busy === 'dry'}
          onClick={() => act('dry', async () => { const r = await post('/api/v1/bot/run', { dryRun: true }); setLastRun(r); return r; })}>
          {busy === 'dry' ? 'Running…' : 'Dry run'}
        </button>
        <button className="bot-btn" disabled={!enabled || halted || busy === 'run'}
          onClick={() => act('run', async () => { const r = await post('/api/v1/bot/run'); setLastRun(r); return r; })}>
          {busy === 'run' ? 'Running…' : 'Run cycle'}
        </button>
        <button className={`bot-btn bot-kill ${confirmKill ? 'confirm' : ''}`} disabled={busy === 'kill'}
          onClick={() => {
            if (!confirmKill) { setConfirmKill(true); return; }
            setConfirmKill(false);
            act('kill', () => post('/api/v1/bot/kill'));
          }}>
          {busy === 'kill' ? 'Killing…' : confirmKill ? 'Confirm — flatten all' : 'Kill switch'}
        </button>
      </div>

      {lastRun && (
        <div className="bot-runinfo">
          {lastRun.ok
            ? `${lastRun.dryRun ? 'Dry run' : 'Cycle'} · ${lastRun.results?.length ?? 0} symbols · ${lastRun.results?.filter(r => r.submitted).length ?? 0} orders`
            : `Skipped: ${lastRun.skipped || lastRun.error}`}
        </div>
      )}

      {/* Models & strategies */}
      <h4 className="sub-title bot-strat-head">
        <span>Model</span>
        <button className="bot-link" onClick={() => setShowStrategies(!showStrategies)}>
          {showStrategies ? 'hide' : 'configure'}
        </button>
      </h4>

      <div className="bot-presets">
        {(data.availablePresets || []).map(p => (
          <button key={p.key}
            className={`bot-preset ${data.preset === p.key ? 'active' : ''}`}
            title={p.description}
            disabled={busy === 'preset'}
            onClick={() => act('preset', () => post('/api/v1/bot/config', { preset: p.key }))}>
            {p.name}
          </button>
        ))}
        {data.preset === 'custom' && <span className="bot-preset active">Custom</span>}
      </div>

      {showStrategies && (
        <div className="bot-strategies">
          {(data.availableStrategies || []).map(st => {
            const on = data.strategies?.includes(st.key);
            return (
              <div key={st.key} className={`bot-strat ${on ? 'on' : ''}`}>
                <button className="bot-strat-toggle"
                  disabled={busy === 'strat'}
                  onClick={() => {
                    const next = on
                      ? data.strategies.filter(k => k !== st.key)
                      : [...(data.strategies || []), st.key];
                    if (!next.length) return; // never disable everything
                    act('strat', () => post('/api/v1/bot/config', { strategies: next }));
                  }}>
                  <span className={`bot-chk ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
                  <span className="bot-strat-name">{st.name}</span>
                  <span className="bot-strat-family">{st.family}</span>
                </button>
                <div className="bot-strat-desc">{st.description}</div>
                <div className="bot-strat-when">
                  <span className="positive">Works: {st.worksWhen}</span>
                  <span className="negative">Fails: {st.failsWhen}</span>
                </div>
              </div>
            );
          })}

          <div className="bot-threshold">
            <label>
              Agreement threshold
              <span className="bot-thr-val">{data.threshold}</span>
            </label>
            <input type="range" min="0.05" max="0.5" step="0.01" value={data.threshold ?? 0.15}
              onChange={e => act('thr', () => post('/api/v1/bot/config', { threshold: Number(e.target.value) }))} />
            <span className="bot-thr-hint">Higher = fewer, higher-conviction trades</span>
          </div>

          <label className="bot-llm-toggle">
            <input type="checkbox" checked={Boolean(data.useLlm)} disabled={!data.llmConfigured}
              onChange={e => act('llm', () => post('/api/v1/bot/config', { useLlm: e.target.checked }))} />
            Mistral review {data.llmConfigured ? '' : '(no API key)'}
          </label>
        </div>
      )}

      {/* Recent decisions */}
      <h4 className="sub-title">Recent decisions</h4>
      {!decisions?.length ? <p className="panel-empty">No decisions yet — try a dry run</p> : (
        <div className="bot-decisions">
          {decisions.map((d, i) => (
            <div key={i} className="bot-decision">
              <div className="bot-dec-head">
                <span className="bot-dec-sym">{d.symbol}</span>
                <span className={`bot-dec-action ${d.action === 'BUY' ? 'positive' : d.action === 'SELL' ? 'negative' : 'text-dim'}`}>
                  {d.action}
                </span>
                <span className="bot-dec-conf">{d.confidence != null ? `${(d.confidence * 100).toFixed(0)}%` : ''}</span>
                {d.vetoed && <span className="bot-tag veto">VETOED</span>}
                {d.damped && <span className="bot-tag damp">DAMPED</span>}
                {d.dryRun && <span className="bot-tag dry">DRY</span>}
              </div>
              <div className="bot-dec-why">{d.rationale}</div>
              {d.llm && d.llm.stance !== 'UNAVAILABLE' && (
                <div className="bot-dec-llm">
                  <span className={`bot-llm-stance ${d.llm.stance === 'AGREE' ? 'positive' : d.llm.stance === 'DISAGREE' ? 'negative' : 'neutral-sig'}`}>
                    {d.llm.stance}
                  </span>
                  {d.llm.reasoning}
                </div>
              )}
              {d.gate && !d.gate.approved && (
                <div className="bot-dec-gate">Blocked: {d.gate.detail || d.gate.reason}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="model-note">
        {data.isPaper
          ? 'Paper trading against Alpaca — simulated fills, no real money.'
          : 'LIVE endpoint configured. Real orders will be placed.'}{' '}
        Every order passes a risk gate ({data.limits?.maxPositionPercent}% max position,
        {' '}{data.limits?.maxDailyLossPercent}% daily loss halt, {data.limits?.maxDrawdownPercent}% drawdown halt).
        The LLM can veto or shrink a trade but never originate or enlarge one.
        Not investment advice.
      </p>
    </div>
  );
}
