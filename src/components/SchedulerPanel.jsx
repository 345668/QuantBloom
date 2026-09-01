import { useState, useEffect, useCallback } from 'react';

const INTERVALS = [
  { label: '1 min', ms: 60_000 },
  { label: '5 min', ms: 5 * 60_000 },
  { label: '15 min', ms: 15 * 60_000 },
  { label: '30 min', ms: 30 * 60_000 },
  { label: '1 hour', ms: 60 * 60_000 },
];

// The "tick sequencer": start/stop an interval that runs the bot's trade cycle,
// or fire a single tick manually. Every tick passes the same hard risk gate.
export default function SchedulerPanel() {
  const [s, setS] = useState(null);
  const [interval, setIntervalMs] = useState(30 * 60_000);
  const [busy, setBusy] = useState(false);
  const [lastTick, setLastTick] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/bot/scheduler');
      if (r.ok) { const d = await r.json(); setS(d); if (d.intervalMs) setIntervalMs(d.intervalMs); }
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  async function control(action, extra = {}) {
    setBusy(true);
    try {
      const r = await fetch('/api/v1/bot/scheduler', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await r.json();
      setS(d.state || d);
    } finally { setBusy(false); }
  }

  async function tickNow() {
    setBusy(true);
    try {
      const r = await fetch('/api/v1/bot/tick', { method: 'POST' });
      const d = await r.json();
      setLastTick(d);
      refresh();
    } finally { setBusy(false); }
  }

  const running = s?.running;
  const fmt = iso => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

  return (
    <div className="panel scheduler-panel">
      <h3 className="panel-title">Tick Sequencer <span className="panel-code">SEQ</span></h3>

      <div className="seq-status">
        <span className={`seq-dot ${running ? 'on' : 'off'}`} />
        <span className="seq-state">{running ? 'RUNNING' : 'STOPPED'}</span>
        <span className="seq-count">{s?.runCount ?? 0} ticks</span>
        {s?.lastResult && <span className={`seq-last seq-${s.lastResult}`}>last: {s.lastResult}</span>}
      </div>

      <div className="seq-times">
        <div><span className="seq-lbl">last run</span><span className="seq-val">{fmt(s?.lastRunAt)}</span></div>
        <div><span className="seq-lbl">next run</span><span className="seq-val">{running ? fmt(s?.nextRunAt) : '—'}</span></div>
      </div>

      <div className="seq-interval">
        {INTERVALS.map(i => (
          <button
            key={i.ms}
            className={`seq-iv ${interval === i.ms ? 'active' : ''}`}
            onClick={() => { setIntervalMs(i.ms); control('interval', { intervalMs: i.ms }); }}
            disabled={busy}
          >{i.label}</button>
        ))}
      </div>

      <div className="seq-controls">
        {running ? (
          <button className="seq-btn stop" onClick={() => control('stop')} disabled={busy}>STOP SEQUENCER</button>
        ) : (
          <button className="seq-btn start" onClick={() => control('start', { intervalMs: interval })} disabled={busy}>START SEQUENCER</button>
        )}
        <button className="seq-btn tick" onClick={tickNow} disabled={busy}>RUN TICK NOW</button>
      </div>

      {lastTick && (
        <div className="seq-result">
          {lastTick.ok
            ? <span>Tick ran{lastTick.result?.results ? ` · ${lastTick.result.results.length} symbols evaluated` : ''}{lastTick.result?.halted ? ` · HALTED (${lastTick.result.haltReason})` : ''}</span>
            : <span className="negative">{lastTick.reason || lastTick.error || 'Tick failed'}</span>}
        </div>
      )}

      <p className="seq-foot">Each tick runs the normal trade cycle — the hard risk gate, paper-only broker and kill switch all still apply. The interval scheduler needs a persistent server (local / Docker); on serverless, use “Run tick now”.</p>
    </div>
  );
}
