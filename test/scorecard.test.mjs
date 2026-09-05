import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionSign, gradeDecision, sourcesOf, letterGrade, buildScorecard } from '../src/lib/scorecard.js';

test('actionSign maps direction', () => {
  assert.equal(actionSign('BUY'), 1);
  assert.equal(actionSign('SELL'), -1);
  assert.equal(actionSign('HOLD'), 0);
});

test('gradeDecision scores a correct BUY', () => {
  const g = gradeDecision({ action: 'BUY', markPrice: 100 }, 110);
  assert.equal(g.scored, true);
  assert.equal(g.correct, true);
  assert.ok(Math.abs(g.directional - 0.1) < 1e-9);
});

test('gradeDecision scores a correct SELL (price fell)', () => {
  const g = gradeDecision({ action: 'SELL', markPrice: 100 }, 90);
  assert.equal(g.correct, true);
  assert.ok(g.directional > 0);
});

test('gradeDecision falls back to order price and skips HOLD / bad data', () => {
  assert.equal(gradeDecision({ action: 'BUY', order: { price: 50 } }, 55).correct, true);
  assert.equal(gradeDecision({ action: 'HOLD', markPrice: 100 }, 110).scored, false);
  assert.equal(gradeDecision({ action: 'BUY', markPrice: 100 }, 0).scored, false);
});

test('sourcesOf credits model and agreeing strategies, deduped', () => {
  const d = { action: 'BUY', model: { type: 'gbm', symbol: 'NVDA' },
    signals: [{ name: 'Trend', action: 'BUY' }, { name: 'Reversion', action: 'SELL' }, { name: 'Trend', action: 'BUY' }] };
  const s = sourcesOf(d);
  assert.ok(s.includes('GBM · NVDA'));
  assert.ok(s.includes('Trend'));
  assert.ok(!s.includes('Reversion'));   // voted the other way
  assert.equal(new Set(s).size, s.length);
});

test('letterGrade guards small samples and maps rates', () => {
  assert.equal(letterGrade(0.9, 3), 'n/a');
  assert.equal(letterGrade(0.62, 10), 'A');
  assert.equal(letterGrade(0.5, 10), 'C');
  assert.equal(letterGrade(0.3, 10), 'F');
});

test('buildScorecard aggregates per source with totals', () => {
  const decisions = [
    { symbol: 'AAPL', action: 'BUY', markPrice: 100, signals: [{ name: 'Trend', action: 'BUY' }] },
    { symbol: 'MSFT', action: 'BUY', markPrice: 100, signals: [{ name: 'Trend', action: 'BUY' }] },
    { symbol: 'NVDA', action: 'SELL', markPrice: 100, signals: [{ name: 'Reversion', action: 'SELL' }] },
    { symbol: 'TSLA', action: 'HOLD', markPrice: 100, signals: [] },  // unscored
  ];
  const prices = { AAPL: 110, MSFT: 90, NVDA: 90, TSLA: 100 };
  const sc = buildScorecard(decisions, prices, { minSample: 1 });
  assert.equal(sc.totals.scored, 3);
  const trend = sc.sources.find(s => s.source === 'Trend');
  assert.equal(trend.n, 2);
  assert.equal(trend.hitRate, 0.5);  // AAPL up (win), MSFT down (loss)
  const rev = sc.sources.find(s => s.source === 'Reversion');
  assert.equal(rev.hitRate, 1);      // NVDA fell after SELL
});

test('empty decisions yield an empty scorecard', () => {
  const sc = buildScorecard([], {});
  assert.equal(sc.totals.scored, 0);
  assert.deepEqual(sc.sources, []);
});
