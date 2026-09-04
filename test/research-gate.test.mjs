import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyResearch } from '../bot/research-gate.js';

const buy = { action: 'BUY', confidence: 0.8, rationale: 'quant buy' };
const sell = { action: 'SELL', confidence: 0.7, rationale: 'quant sell' };

test('high-conviction contradiction vetoes a BUY to HOLD', () => {
  const d = applyResearch(buy, { direction: 'bearish', conviction: 'high', reasons: ['LM bearish'] });
  assert.equal(d.action, 'HOLD');
  assert.equal(d.confidence, 0);
  assert.equal(d.vetoedByResearch, true);
});

test('medium-conviction contradiction damps confidence, keeps action', () => {
  const d = applyResearch(buy, { direction: 'bearish', conviction: 'medium', reasons: ['LM bearish'] });
  assert.equal(d.action, 'BUY');
  assert.equal(d.confidence, 0.4);
  assert.equal(d.dampedByResearch, true);
});

test('agreement passes through unchanged and marks confirmed', () => {
  const d = applyResearch(buy, { direction: 'bullish', conviction: 'high', reasons: ['3 insiders buying'] });
  assert.equal(d.action, 'BUY');
  assert.equal(d.confidence, 0.8);        // never upsized
  assert.equal(d.researchConfirmed, true);
});

test('SELL contradicted by bullish high conviction is vetoed', () => {
  const d = applyResearch(sell, { direction: 'bullish', conviction: 'high', reasons: ['x'] });
  assert.equal(d.action, 'HOLD');
  assert.equal(d.vetoedByResearch, true);
});

test('neutral or missing research is a no-op', () => {
  assert.equal(applyResearch(buy, { direction: 'neutral', conviction: 'low' }).action, 'BUY');
  assert.equal(applyResearch(buy, null).action, 'BUY');
  assert.equal(applyResearch(buy, null).research, null);
});

test('HOLD is never turned into a trade by research', () => {
  const hold = { action: 'HOLD', confidence: 0, rationale: 'flat' };
  const d = applyResearch(hold, { direction: 'bullish', conviction: 'high', reasons: ['strong'] });
  assert.equal(d.action, 'HOLD');
});

test('low-conviction contradiction does not veto or damp', () => {
  const d = applyResearch(buy, { direction: 'bearish', conviction: 'low', reasons: ['weak'] });
  assert.equal(d.action, 'BUY');
  assert.equal(d.confidence, 0.8);
  assert.equal(d.vetoedByResearch, undefined);
  assert.equal(d.dampedByResearch, undefined);
});
