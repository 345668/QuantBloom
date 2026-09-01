import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';

/**
 * Bloomberg-style access gate. When Supabase is configured and no one is signed
 * in, the terminal is locked behind this login window. When Supabase is not
 * configured the app runs open (dev/local) — but `?login` still renders the
 * window so the design can be previewed.
 */
export default function LoginGate({ children }) {
  const { configured, user, loading, signIn, signUp } = useAuth();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const preview = params.has('login');

  const [mode, setMode] = useState(params.get('login') === 'register' ? 'register' : 'signin'); // 'signin' | 'register'
  const [form, setForm] = useState({ name: '', org: '', email: '', password: '', confirm: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // Not configured (and not previewing), or already signed in → show terminal.
  if ((!configured && !preview) || user) return children;
  if (loading) return <div className="login-loading"><Logo variant="mark" size={40} /> Connecting…</div>;

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (mode === 'register' && form.password !== form.confirm) {
      setErr('Passwords do not match.');
      return;
    }
    if (!configured) {
      setMsg('Preview only — connect Supabase (VITE_SUPABASE_URL / _ANON_KEY) to enable sign-in.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(form.email.trim(), form.password);
        if (error) { setErr(error.message); return; }
      } else {
        const { data, error } = await signUp(form.email.trim(), form.password, {
          full_name: form.name.trim(),
          organization: form.org.trim(),
          access_reason: form.reason.trim(),
        });
        if (error) { setErr(error.message); return; }
        if (!data.session) setMsg('Request received. Check your email to confirm your account, then sign in.');
      }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-screen">
      <div className="login-window">
        {/* Left: brand / hero */}
        <aside className="login-hero">
          <div className="login-hero-top">
            <Logo variant="full" size={34} className="login-logo" />
            <p className="login-tagline">The browser-native quantitative trading terminal.</p>
          </div>
          <ul className="login-features">
            <li><span>◢</span> Live multi-asset charting &amp; 16-indicator library</li>
            <li><span>◢</span> ML signal lab with an overfitting-aware publish gate</li>
            <li><span>◢</span> Paper-trading bot behind a hard risk gate</li>
            <li><span>◢</span> Portfolio, VaR, factor &amp; options analytics</li>
            <li><span>◢</span> Power-markets desk &amp; mission-control ops view</li>
          </ul>
          <div className="login-ticker">
            <span className="pos">SPX +0.42%</span>
            <span className="neg">NDX −0.31%</span>
            <span className="pos">CL +1.8%</span>
            <span className="neg">BTC −2.1%</span>
            <span className="pos">EURUSD +0.1%</span>
          </div>
          <p className="login-disclaimer">For research &amp; education. Not investment advice. Trading is paper-only.</p>
        </aside>

        {/* Right: auth form */}
        <section className="login-panel">
          <div className="login-tabs">
            <button className={`login-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => { setMode('signin'); setErr(null); setMsg(null); }}>Sign in</button>
            <button className={`login-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setErr(null); setMsg(null); }}>Request access</button>
          </div>

          <form onSubmit={submit} className="login-form">
            {mode === 'register' && (
              <>
                <div className="login-row">
                  <label>Full name
                    <input type="text" value={form.name} onChange={set('name')} autoComplete="name" required placeholder="Ada Lovelace" />
                  </label>
                  <label>Organisation
                    <input type="text" value={form.org} onChange={set('org')} autoComplete="organization" placeholder="Firm / desk (optional)" />
                  </label>
                </div>
              </>
            )}

            <label>Email
              <input type="email" value={form.email} onChange={set('email')} autoComplete="username" required placeholder="you@firm.com" />
            </label>

            <div className={mode === 'register' ? 'login-row' : ''}>
              <label>Password
                <input type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={6} placeholder="••••••••" />
              </label>
              {mode === 'register' && (
                <label>Confirm password
                  <input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required minLength={6} placeholder="••••••••" />
                </label>
              )}
            </div>

            {mode === 'register' && (
              <label>Reason for access <span className="login-opt">(optional)</span>
                <textarea value={form.reason} onChange={set('reason')} rows={2} placeholder="How do you plan to use the terminal?" />
              </label>
            )}

            {err && <div className="login-err">{err}</div>}
            {msg && <div className="login-msg">{msg}</div>}

            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in →' : 'Request access →'}
            </button>
          </form>

          <p className="login-switch-line">
            {mode === 'signin'
              ? <>New here? <button className="login-link" onClick={() => setMode('register')}>Request access</button></>
              : <>Already approved? <button className="login-link" onClick={() => setMode('signin')}>Sign in</button></>}
          </p>

          <p className="login-note">Secured by Supabase · profiles mirrored to Neon.</p>
        </section>
      </div>
    </div>
  );
}
