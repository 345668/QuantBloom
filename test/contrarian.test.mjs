import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrarianStrategy, STRATEGIES, ensemble } from '../bot/strategies.js';

test('contrarian sells after a move above the short EMA', () => {
  const s = contrarianStrategy({ price: 102, movingAverages: { ema12: 100 } });
  assert.equal(s.action, 'SELL');
  assert.ok(s.confidence > 0);
});

test('contrarian buys after a move below the short EMA', () => {
  const s = contrarianStrategy({ price: 98, movingAverages: { ema12: 100 } });
  assert.equal(s.action, 'BUY');
});

test('contrarian holds when price sits on its short EMA', () => {
  const s = contrarianStrategy({ price: 100, movingAverages: { ema12: 100 } });
  assert.equal(s.action, 'HOLD');
});

test('contrarian returns null without the data it needs', () => {
  assert.equal(contrarianStrategy({ price: 100, movingAverages: {} }), null);
  assert.equal(contrarianStrategy({}), null);
});

test('contrarian is registered and usable by the ensemble', () => {
  assert.ok(STRATEGIES.contrarian);
  const ta = { price: 103, movingAverages: { ema12: 100, sma50: 100, sma200: 100 }, oscillators: { rsi14: 50 }, summary: { buy: 0, sell: 0, neutral: 12 } };
  const d = ensemble(ta, ['contrarian'], 0.15);
  assert.equal(d.action, 'SELL'); // fading the +3% move
});
