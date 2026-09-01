import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pipSize, spreadPips, displayDigits, dealerQuote, splitBigFig, tickDir } from '../src/lib/fxquote.js';

test('pip size is 0.01 for JPY pairs, 0.0001 otherwise', () => {
  assert.equal(pipSize('USD/JPY'), 0.01);
  assert.equal(pipSize('EUR/USD'), 0.0001);
});

test('majors are tighter than EM crosses', () => {
  assert.ok(spreadPips('EUR/USD') < spreadPips('USD/TRY'));
});

test('display digits: 3 for JPY, 5 for tight majors, 4 for wide EM', () => {
  assert.equal(displayDigits('USD/JPY'), 3);
  assert.equal(displayDigits('EUR/USD'), 5);
  assert.equal(displayDigits('USD/ZAR'), 4);
});

test('dealer quote brackets the mid symmetrically by half the spread', () => {
  const q = dealerQuote('EUR/USD', 1.1000);
  assert.ok(q.bid < 1.1000 && q.ask > 1.1000);
  const half = (spreadPips('EUR/USD') * pipSize('EUR/USD')) / 2;
  assert.ok(Math.abs((q.ask - q.mid) - half) < 1e-12);
  assert.ok(Math.abs((q.mid - q.bid) - half) < 1e-12);
});

test('dealer quote returns null for bad mid', () => {
  assert.equal(dealerQuote('EUR/USD', null), null);
  assert.equal(dealerQuote('EUR/USD', NaN), null);
});

test('splitBigFig separates the last two (pip) digits', () => {
  assert.deepEqual(splitBigFig(1.15743, 5), ['1.157', '43']);
  assert.deepEqual(splitBigFig(143.256, 3), ['143.2', '56']);
});

test('tickDir reports up/down/flat and 0 on first sight', () => {
  assert.equal(tickDir(null, 1.1), 0);
  assert.equal(tickDir(1.1, 1.2), 1);
  assert.equal(tickDir(1.2, 1.1), -1);
  assert.equal(tickDir(1.1, 1.1), 0);
});
