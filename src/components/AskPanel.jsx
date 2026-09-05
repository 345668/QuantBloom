import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';

const SUGGESTIONS = [
  'How is {sym} doing today?',
  'What do the technicals say about {sym}?',
  'Is the trading bot running?',
  'Summarise {sym} in one line',
];

// Bloomberg ASKB — "Ask QuantBloom Anything". Read-only assistant wired to the
// /api/v1/ask route (LLM when configured, deterministic data summary otherwise).
export default function AskPanel() {
  const { state } = useDashboard();
  const sym = state.activeSymbol || 'AAPL';
  const [q, setQ] = useState('');
  const [thread, setThread] = useState([]); // {role, text, source}
  const [busy, setBusy] = useState(false);

  async function ask(question) {
    const text = (question ?? q).trim();
    if (!text || busy) return;
    setThread(t => [...t, { role: 'user', text }]);
    setQ('');
    setBusy(true);
    try {
      let resp;
      try {
        resp = await fetch('/api/v1/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text, symbol: sym }),
        });
      } catch {
        throw new Error('Can’t reach the QuantBloom API — is the server running?');
      }
      // The response is only JSON when the API answered. A proxy/error page
      // (e.g. the API is down) is HTML, so parse defensively rather than letting
      // resp.json() throw a cryptic "string did not match the expected pattern".
      const ct = resp.headers.get('content-type') || '';
      const raw = await resp.text();
      let data = null;
      if (ct.includes('application/json')) {
        try { data = JSON.parse(raw); } catch { /* fall through */ }
      }
      if (!data) {
        throw new Error(resp.ok
          ? 'The API returned an unexpected (non-JSON) response.'
          : `The API is unavailable (HTTP ${resp.status}). Is the server running?`);
      }
      setThread(t => [...t, { role: 'askb', text: data.answer || data.error || 'No answer.', source: data.source, model: data.model }]);
    } catch (e) {
      setThread(t => [...t, { role: 'askb', text: e.message, source: 'error' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel askb-panel">
      <h3 className="panel-title">Ask QuantBloom <span className="panel-code">ASKB</span></h3>

      <div className="askb-thread">
        {thread.length === 0 ? (
          <div className="askb-intro">
            <p>Analyze companies, track trends, and query your terminal — in plain language. Context: <strong>{sym}</strong>.</p>
            <div className="askb-suggests">
              {SUGGESTIONS.map(s => {
                const label = s.replace('{sym}', sym);
                return <button key={s} className="askb-chip" onClick={() => ask(label)}>{label}</button>;
              })}
            </div>
          </div>
        ) : thread.map((m, i) => (
          <div key={i} className={`askb-msg askb-${m.role}`}>
            <span className="askb-role">{m.role === 'user' ? 'YOU' : 'ASKB'}</span>
            <span className="askb-text">{m.text}</span>
            {m.source && m.role === 'askb' && (
              <span className={`askb-src src-${m.source}`}>{m.source === 'llm' ? (m.model || 'llm') : m.source === 'fallback' ? 'data summary' : m.source}</span>
            )}
          </div>
        ))}
        {busy && <div className="askb-msg askb-askb"><span className="askb-role">ASKB</span><span className="askb-text askb-typing">thinking…</span></div>}
      </div>

      <form className="askb-form" onSubmit={e => { e.preventDefault(); ask(); }}>
        <input
          className="askb-input"
          placeholder="Ask QuantBloom Anything…"
          value={q}
          onChange={e => setQ(e.target.value)}
          disabled={busy}
        />
        <button className="askb-send" type="submit" disabled={busy || !q.trim()}>→</button>
      </form>
      <p className="askb-foot">Read-only. ASKB explains what the terminal shows — it cannot place trades or change settings, and does not give investment advice.</p>
    </div>
  );
}
