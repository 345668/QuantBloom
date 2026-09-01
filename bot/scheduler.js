// ---------------------------------------------------------------------------
// Tick sequencer — an in-process scheduler that runs the bot's trade cycle on a
// fixed interval (the "tick sequencer" idea, native to the terminal).
//
// This only orchestrates timing; it does NOT relax any safety. Every tick calls
// the injected `tick` function, which runs the normal `bot.runCycle` — so the
// hard risk gate, paper-only broker, and kill switch all still apply. Runs only
// where the server process is long-lived (local / Docker); on serverless there
// is no persistent timer, so the UI falls back to a manual "Run tick now".
// ---------------------------------------------------------------------------

const MIN_INTERVAL_MS = 60_000;        // never tick faster than once a minute
const DEFAULT_INTERVAL_MS = 30 * 60_000;

const state = {
  running: false,
  intervalMs: DEFAULT_INTERVAL_MS,
  lastRunAt: null,
  nextRunAt: null,
  runCount: 0,
  lastResult: null,      // 'ok' | 'error' | 'skipped'
  lastError: null,
  ticking: false,        // a tick is in flight
};

let timer = null;
let tickFn = null;

export function getSchedulerState() {
  return { ...state };
}

// Bind the async tick function once, so a manual `runTick` works before the
// interval scheduler is ever started.
export function bindTick(fn) {
  tickFn = fn;
  return { ok: true };
}

// Run a single tick immediately (also used by the manual "Run tick now" button).
// Guards against overlap: if a tick is already in flight, this one is skipped.
export async function runTick() {
  if (!tickFn) return { ok: false, reason: 'no tick function bound' };
  if (state.ticking) return { ok: false, reason: 'tick already in progress', skipped: true };
  state.ticking = true;
  state.lastRunAt = new Date().toISOString();
  try {
    const result = await tickFn();
    state.runCount++;
    state.lastResult = 'ok';
    state.lastError = null;
    return { ok: true, result };
  } catch (e) {
    state.runCount++;
    state.lastResult = 'error';
    state.lastError = e.message;
    return { ok: false, error: e.message };
  } finally {
    state.ticking = false;
    if (state.running) state.nextRunAt = new Date(Date.now() + state.intervalMs).toISOString();
  }
}

// Start the scheduler. `tick` is the async function run every interval.
export function startScheduler({ tick, intervalMs } = {}) {
  if (tick) tickFn = tick;
  if (!tickFn) return { ok: false, error: 'a tick function is required' };
  if (intervalMs != null) state.intervalMs = Math.max(MIN_INTERVAL_MS, Math.floor(intervalMs));
  if (timer) clearInterval(timer);
  state.running = true;
  state.nextRunAt = new Date(Date.now() + state.intervalMs).toISOString();
  timer = setInterval(() => { runTick(); }, state.intervalMs);
  if (timer.unref) timer.unref();   // don't keep the process alive on its own
  return { ok: true, state: getSchedulerState() };
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  state.running = false;
  state.nextRunAt = null;
  return { ok: true, state: getSchedulerState() };
}

// Change the interval; if running, restart the timer so it takes effect now.
export function setInterval_(intervalMs) {
  state.intervalMs = Math.max(MIN_INTERVAL_MS, Math.floor(intervalMs || DEFAULT_INTERVAL_MS));
  if (state.running) startScheduler({ intervalMs: state.intervalMs });
  return getSchedulerState();
}

export const MIN_INTERVAL = MIN_INTERVAL_MS;
