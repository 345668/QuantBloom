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

      {!data.brokerConfigured && (
        <div className="bot-notice">
          Broker not connected. Add <code>ALPACA_API_KEY</code> and
          {' '}<code>ALPACA_SECRET_KEY</code> to <code>.env</code> and run the bot from a
          persistent server (<code>node server.js</code> or Docker). Trading and dry runs
          are disabled on the serverless deployment.
        </div>
      )}

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

      {/* Decision engine: rule strategies or a trained ML model. */}
      <h4 className="sub-title bot-strat-head">
        <span>Decision engine</span>
        <span className="bot-head-actions">
          <button className="bot-link" disabled={busy === 'autotrain'}
            title="Train a model on every watchlist symbol and auto-select the best"
            onClick={() => act('autotrain', () => post('/api/v1/bot/autotrain', { modelType: 'gbm' }))}>
            {busy === 'autotrain' ? 'training…' : 'auto-train'}
          </button>
          {!data.activeModel && (
            <button className="bot-link" onClick={() => setShowStrategies(!showStrategies)}>
              {showStrategies ? 'hide' : 'configure'}
            </button>
          )}
        </span>
      </h4>

      <div className="bot-engine-row">
        <button className={`bot-engine-btn ${!data.activeModel ? 'active' : ''}`}
          disabled={busy === 'model'}
          onClick={() => act('model', () => post('/api/v1/bot/model', { modelId: null }))}>
          Rule strategies
        </button>
        {(data.availableModels || []).map(m => (
          <button key={m.id}
            className={`bot-engine-btn model ${data.activeModel?.id === m.id ? 'active' : ''} ${m.eligible ? 'ok' : 'ungated'}`}
            disabled={busy === 'model'}
            title={`${m.modelType} trained on ${m.symbol} · AUC ${m.testAuc ?? '—'} · ${m.eligible ? 'passed publish gate' : 'FAILED gate — paper testing only'}`}
            onClick={() => act('model', () => post('/api/v1/bot/model', { modelId: m.id }))}>
            {m.symbol} {m.modelType.toUpperCase()}{m.eligible ? ' ✓' : ' ⚠'}
          </button>
        ))}
        {!(data.availableModels || []).length && (
          <span className="bot-engine-hint">Train models in Model Lab or hit auto-train →</span>
        )}
      </div>

      {/* Protective exits (stop-loss / take-profit brackets). */}
      <div className="bot-brackets">
        <label className="bot-bracket-toggle">
          <input type="checkbox" checked={Boolean(data.brackets?.enabled)}
            onChange={e => act('brackets', () => post('/api/v1/bot/config', { brackets: { enabled: e.target.checked } }))} />
          Stop-loss / take-profit
        </label>
        {data.brackets?.enabled && (
          <span className="bot-bracket-inputs">
            <label>SL%
              <input type="number" step="1" defaultValue={Math.round((data.brackets.slPercent || 0.05) * 100)}
                onBlur={e => act('brackets', () => post('/api/v1/bot/config', { brackets: { slPercent: (Number(e.target.value) || 5) / 100 } }))} />
            </label>
            <label>TP%
              <input type="number" step="1" defaultValue={Math.round((data.brackets.tpPercent || 0.10) * 100)}
                onBlur={e => act('brackets', () => post('/api/v1/bot/config', { brackets: { tpPercent: (Number(e.target.value) || 10) / 100 } }))} />
            </label>
            <label>Trail%
              <input type="number" step="1" defaultValue={Math.round((data.brackets.trailPercent || 0) * 100)}
                title="0 = off; a live trailing stop that ratchets up with the peak"
                onBlur={e => act('brackets', () => post('/api/v1/bot/config', { brackets: { trailPercent: (Number(e.target.value) || 0) / 100 } }))} />
            </label>
            <span className="bot-bracket-rr">
              R:R {((data.brackets.tpPercent || 0) / (data.brackets.slPercent || 1)).toFixed(1)}
            </span>
          </span>
        )}
      </div>

      {data.activeModel && (
        <div className={`bot-model-active ${data.activeModel.eligible ? 'ok' : 'warn'}`}>
          Using {data.activeModel.modelType.toUpperCase()} model ({data.activeModel.symbol}).
          {!data.activeModel.eligible && ' Failed the publish gate — paper testing only, not validated.'}
        </div>
      )}

      {/* Rule-strategy presets only apply when no model is selected. */}
      {!data.activeModel && (
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
      )}

      {!data.activeModel && showStrategies && (
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
