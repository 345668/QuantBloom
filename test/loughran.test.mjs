import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, scoreText, aggregateSentiment } from '../src/lib/loughran.js';

test('tokenize lowercases and splits words', () => {
  assert.deepEqual(tokenize("Profit GREW, losses fell!"), ['profit','grew','losses','fell']);
});

test('scoreText is bullish for gains, bearish for losses', () => {
  assert.equal(scoreText('record profit and strong growth, shares surge').label, 'bullish');
  assert.equal(scoreText('bankruptcy fraud lawsuit and steep losses').label, 'bearish');
});

test('scoreText counts uncertainty and litigious separately', () => {
  const s = scoreText('the lawsuit outcome is uncertain and may depend on the court');
  assert.ok(s.uncertainty >= 2);   // uncertain, may, depend
  assert.ok(s.litigious >= 2);     // lawsuit, court
});

test('negation flips polarity', () => {
  const plain = scoreText('strong growth');
  const negated = scoreText('not strong growth');
  assert.ok(plain.polarity > 0);
  assert.ok(negated.polarity < plain.polarity);
});

test('neutral text yields neutral label', () => {
  assert.equal(scoreText('the company held a meeting on tuesday').label, 'neutral');
});

test('aggregateSentiment blends many headlines', () => {
  const agg = aggregateSentiment([
    'record profit, strong beat',
    'guidance raised, growth accelerates',
    'minor product delay',
  ]);
  assert.equal(agg.label, 'bullish');
  assert.equal(agg.n, 3);
  assert.ok(agg.positive > agg.negative);
});

test('aggregateSentiment handles empty input', () => {
  const agg = aggregateSentiment([]);
  assert.equal(agg.label, 'neutral');
  assert.equal(agg.polarity, 0);
});
