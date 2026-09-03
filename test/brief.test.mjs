import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dir, buildEntry, assembleBrief } from '../src/lib/brief.js';

test('dir maps labels to signs', () => {
  assert.equal(dir('bullish'), 1);
  assert.equal(dir('bearish'), -1);
  assert.equal(dir('neutral'), 0);
});

test('buildEntry marks HIGH conviction when two sources agree', () => {
  const e = buildEntry('NVDA', {
    sentiment: { direction: 'bullish', detail: 'LM bullish' },
    insider: { direction: 'bullish', detail: '3 insiders buying' },
  });
  assert.equal(e.conviction, 'high');
  assert.equal(e.direction, 'bullish');
  assert.equal(e.agree, 2);
  assert.deepEqual(e.sources.sort(), ['insider', 'sentiment']);
});

test('conflicting sources cancel to low conviction', () => {
  const e = buildEntry('XYZ', {
    sentiment: { direction: 'bullish' },
    insider: { direction: 'bearish' },
  });
  assert.equal(e.score, 0);
  assert.equal(e.conviction, 'low');
  assert.equal(e.direction, 'neutral');
});

test('single source is at most medium conviction', () => {
  const e = buildEntry('AAPL', { filing: { direction: 'bullish', detail: '8-K drift' } });
  assert.equal(e.conviction, 'medium');
  assert.equal(e.agree, 1);
});

test('neutral signals are ignored', () => {
  const e = buildEntry('MSFT', { sentiment: { direction: 'neutral' }, insider: { direction: 'none' } });
  assert.equal(e.agree, 0);
});

test('assembleBrief ranks high conviction first and counts', () => {
  const brief = assembleBrief({
    HIGH: { a: { direction: 'bullish' }, b: { direction: 'bullish' } },
    MED:  { a: { direction: 'bearish' } },
    FLAT: { a: { direction: 'neutral' } },
  });
  assert.equal(brief.entries[0].symbol, 'HIGH');
  assert.equal(brief.highConviction.length, 1);
  assert.equal(brief.counts.total, 2);   // FLAT dropped (no active signal)
  assert.equal(brief.counts.high, 1);
});
