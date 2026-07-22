// ---------------------------------------------------------------------------
// File-based persistence for trained/published models.
//
// The in-memory registry resets on every restart, which is fine for a stateless
// serverless function but loses a trained model the moment you stop the local
// server. This writes the registry to a JSON file so models — and especially
// the published set behind the public page — survive a restart during local
// research.
//
// Deliberately best-effort: any I/O failure degrades to in-memory only rather
// than crashing the app. A production deployment swaps this for Postgres
// (metadata) + object storage (artifacts); the call sites do not change.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = process.env.MODEL_STORE_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '.models');
const FILE = join(DIR, 'registry.json');

// Serverless filesystems are read-only except /tmp, so persistence is a no-op
// there. Detected once at load; the app runs identically either way.
let writable = true;

export function loadStore() {
  try {
    if (!existsSync(FILE)) return { trained: [], published: [] };
    const data = JSON.parse(readFileSync(FILE, 'utf8'));
    return {
      trained: Array.isArray(data.trained) ? data.trained : [],
      published: Array.isArray(data.published) ? data.published : [],
    };
  } catch {
    return { trained: [], published: [] };
  }
}

export function persist(store) {
  if (!writable) return false;
  try {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
    // Cap what we write so the file cannot grow without bound.
    const payload = {
      savedAt: new Date().toISOString(),
      trained: (store.trained || []).slice(0, 50),
      published: store.published || [],
    };
    writeFileSync(FILE, JSON.stringify(payload), 'utf8');
    return true;
  } catch {
    // Almost always a read-only FS (Vercel). Stop trying so we don't log on
    // every train call, and fall back to pure in-memory operation.
    writable = false;
    return false;
  }
}

export function storePath() { return FILE; }
export function isWritable() { return writable; }
