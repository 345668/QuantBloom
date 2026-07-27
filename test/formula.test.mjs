import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileFormula, validateFormula } from '../charting/formula.js';

function candles(closes) {
  return closes.map((c, i) => ({
    time: i, open: i === 0 ? c : closes[i - 1], close: c,
    high: c + 1, low: c - 1, volume: 100 + i,
  }));
}
const run = (src, cs) => { const c = compileFormula(src); assert.ok(c.ok, c.error); return c.run(cs); };

// --- Parsing & basic evaluation --------------------------------------------

test('a bare series identifier returns that series', () => {
  const out = run('close', candles([10, 11, 12]));
  assert.deepEqual(out.map(p => p.value), [10, 11, 12]);
});

test('arithmetic with precedence and parentheses', () => {
  const cs = candles([10, 20, 30]);
  assert.deepEqual(run('close * 2 + 1', cs).map(p => p.value), [21, 41, 61]);
  assert.deepEqual(run('close * (2 + 1)', cs).map(p => p.value), [30, 60, 90]);
});

test('hl2 equals the mean of high and low', () => {
  const cs = candles([10, 20]);
  // high = close+1, low = close-1, so hl2 === close.
  assert.deepEqual(run('hl2', cs).map(p => p.value), [10, 20]);
  assert.deepEqual(run('(high + low) / 2', cs).map(p => p.value), [10, 20]);
});

test('unary minus and subtraction', () => {
  assert.deepEqual(run('-close', candles([5, 6])).map(p => p.value), [-5, -6]);
  assert.deepEqual(run('close - 5', candles([5, 6])).map(p => p.value), [0, 1]);
});

test('scalar broadcasts across a series', () => {
  assert.deepEqual(run('100 - close', candles([10, 40])).map(p => p.value), [90, 60]);
});

// --- Functions -------------------------------------------------------------

test('sma matches the hand-computed average and drops warm-up', () => {
  const out = run('sma(close, 3)', candles([1, 2, 3, 4, 5]));
  // First two bars are warm-up (dropped); then (1+2+3)/3, (2+3+4)/3, (3+4+5)/3.
  assert.deepEqual(out.map(p => p.value), [2, 3, 4]);
});

test('close - sma(close, n) is an oscillator around zero', () => {
  const out = run('close - sma(close, 3)', candles([1, 2, 3, 4, 5]));
  assert.equal(out[0].value, 3 - 2); // close 3 minus sma 2
});

test('rsi stays within [0,100]', () => {
  const out = run('rsi(close, 14)', candles(Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 5)));
  assert.ok(out.length > 0);
  out.forEach(p => assert.ok(p.value >= 0 && p.value <= 100));
});

test('a classic MACD-line formula composes function calls', () => {
  const cs = candles(Array.from({ length: 60 }, (_, i) => 100 + i));
  const out = run('ema(close, 12) - ema(close, 26)', cs);
  assert.ok(out.length > 0);
  out.forEach(p => assert.ok(isFinite(p.value)));
});

// --- Errors ----------------------------------------------------------------

test('unknown identifier is a clear error, not a crash', () => {
  const c = compileFormula('foo + close');
  // parses fine; the error surfaces at run via validate
  const v = validateFormula('foo + close');
  assert.equal(v.ok, false);
  assert.match(v.error, /Unknown name "foo"/);
});

test('unknown function errors', () => {
  assert.match(validateFormula('frobnicate(close, 3)').error, /Unknown function/);
});

test('wrong arity errors', () => {
  assert.match(validateFormula('sma(close)').error, /expects 2/);
});

test('period must be a constant, not a series', () => {
  assert.match(validateFormula('sma(close, close)').error, /must be a constant/);
});

test('syntax errors are reported', () => {
  assert.equal(compileFormula('close +').ok, false);
  assert.equal(compileFormula('(close').ok, false);
  assert.equal(compileFormula('close )').ok, false);
  assert.equal(compileFormula('1.2.3').ok, false);
  assert.equal(compileFormula('close @ 2').ok, false);
});

// --- Sandbox safety (the whole point) --------------------------------------

test('formulas cannot reach JS globals or prototypes', () => {
  for (const src of [
    'constructor', 'window', 'globalThis', 'process', 'eval',
    'Function', '__proto__', 'prototype', 'this',
  ]) {
    const v = validateFormula(src);
    assert.equal(v.ok, false, `"${src}" should be rejected`);
    assert.match(v.error, /Unknown name/);
  }
});

test('member access and other JS syntax simply do not tokenise', () => {
  assert.equal(compileFormula('close.constructor').ok, false);
  assert.equal(compileFormula('close["x"]').ok, false);
  assert.equal(compileFormula('close; close').ok, false);
});

test('division by zero yields no point rather than Infinity', () => {
  const out = run('close / 0', candles([1, 2, 3]));
  assert.equal(out.length, 0); // all NaN -> dropped
});

// --- validateFormula summary ----------------------------------------------

test('validateFormula returns a sample value for a good formula', () => {
  const v = validateFormula('sma(close, 5)');
  assert.equal(v.ok, true);
  assert.ok(typeof v.sample === 'number');
  assert.ok(v.points > 0);
});
