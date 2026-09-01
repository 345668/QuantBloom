import { createClient } from '@supabase/supabase-js';

// Configured via Vite env at build time. When absent, auth is disabled and the
// terminal runs open (local/dev), rather than locking anyone out.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
