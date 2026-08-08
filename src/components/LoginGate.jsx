import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Bloomberg-style access gate. When Supabase is configured and no one is signed
 * in, the terminal is locked behind this login screen. When Supabase is not
 * configured, it renders nothing and the app runs open (dev/local).
 */
export default function LoginGate({ children }) {
  const { configured, user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // Not configured, or already signed in → show the terminal.
  if (!configured || user) return children;
  if (loading) return <div className="login-loading">Connecting…</div>;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      const fn = mode === 'signin' ? signIn : signUp;
      const { data, error } = await fn(email.trim(), password);
      if (error) { setErr(error.message); return; }
      if (mode === 'signup' && !data.session) setMsg('Check your email to confirm your account, then sign in.');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-brand">QUANTBLOOM<span>TERMINAL</span></div>
        <p className="login-tagline">Authorised access only</p>

        <form onSubmit={submit} className="login-form">
          <label>Email
            <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label>Password
            <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </label>

          {err && <div className="login-err">{err}</div>}
          {msg && <div className="login-msg">{msg}</div>}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button className="login-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(null); setMsg(null); }}>
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>

        <p className="login-note">Secured by Supabase · profiles mirrored to Neon. Not investment advice.</p>
      </div>
    </div>
  );
}
