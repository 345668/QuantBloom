import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

const AuthContext = createContext(null);

/**
 * Auth via Supabase. On sign-in the user is mirrored to the Neon database
 * through the server (/api/v1/auth/sync). When Supabase is not configured the
 * terminal runs open (dev), so a missing config never locks anyone out.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  // Mirror the signed-in user into Neon (best-effort; never blocks the UI).
  const mirror = useCallback(async (sess) => {
    if (!sess?.access_token) return;
    try {
      await fetch('/api/v1/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.access_token}` },
      });
    } catch { /* offline / not configured — ignore */ }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); if (data.session) mirror(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess) mirror(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, [mirror]);

  const value = {
    configured: isSupabaseConfigured,
    session,
    user: session?.user || null,
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
