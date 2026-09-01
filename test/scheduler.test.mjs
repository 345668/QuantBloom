import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSchedulerState, bindTick, runTick, startScheduler, stopScheduler, setInterval_, MIN_INTERVAL,
} from '../bot/scheduler.js';

// The module is a singleton; stop between assertions to keep state clean.

test('runTick increments the counter and records success', async () => {
  stopScheduler();
  let calls = 0;
  bindTick(async () => { calls++; return { ok: true }; });
  const before = getSchedulerState().runCount;
  const r = await runTick();
  assert.equal(r.ok, true);
  assert.equal(calls, 1);
  assert.equal(getSchedulerState().runCount, before + 1);
  assert.equal(getSchedulerState().lastResult, 'ok');
});

test('runTick captures an error without throwing', async () => {
  stopScheduler();
  bindTick(async () => { throw new Error('boom'); });
  const r = await runTick();
  assert.equal(r.ok, false);
  assert.equal(r.error, 'boom');
  assert.equal(getSchedulerState().lastResult, 'error');
  assert.equal(getSchedulerState().lastError, 'boom');
});

test('overlapping ticks are skipped', async () => {
  stopScheduler();
  let inFlight = 0, maxInFlight = 0;
  bindTick(async () => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(r => setTimeout(r, 20));
    inFlight--;
  });
  const [a, b] = await Promise.all([runTick(), runTick()]);
  assert.ok(a.ok || b.ok);
  assert.ok(a.skipped || b.skipped);   // one of them was skipped
  assert.equal(maxInFlight, 1);        // never two at once
});

test('interval is clamped to the minimum', () => {
  stopScheduler();
  const s = setInterval_(1000);        // below the 60s floor
  assert.equal(s.intervalMs, MIN_INTERVAL);
});

test('start sets running and a future nextRunAt; stop clears it', () => {
  bindTick(async () => {});
  const s = startScheduler({ intervalMs: 60_000 });
  assert.equal(s.ok, true);
  assert.equal(getSchedulerState().running, true);
  assert.ok(new Date(getSchedulerState().nextRunAt).getTime() > Date.now());
  stopScheduler();
  assert.equal(getSchedulerState().running, false);
  assert.equal(getSchedulerState().nextRunAt, null);
});
