import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchases, detectCluster, rankClusters } from '../src/lib/insiders.js';

const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

test('purchases keeps buys and drops sales', () => {
  const txns = [
    { name: 'A', code: 'P', shares: 100, date: day(1) },
    { name: 'B', code: 'S', shares: 200, date: day(2) },
  ];
  const p = purchases(txns);
  assert.equal(p.length, 1);
  assert.equal(p[0].name, 'A');
});

test('detectCluster fires when >=2 distinct insiders buy in window', () => {
  const c = detectCluster([
    { name: 'CEO', code: 'P', value: 500000, date: day(3) },
    { name: 'CFO', code: 'P', value: 250000, date: day(10) },
    { name: 'CEO', code: 'P', value: 100000, date: day(12) },  // same person again
  ]);
  assert.equal(c.cluster, true);
  assert.equal(c.insiders, 2);      // CEO + CFO distinct
  assert.equal(c.buys, 3);
  assert.equal(c.netValue, 850000);
  assert.equal(c.direction, 'bullish');
});

test('single insider is not a cluster', () => {
  const c = detectCluster([{ name: 'CEO', code: 'P', value: 999999, date: day(1) }]);
  assert.equal(c.cluster, false);
  assert.equal(c.insiders, 1);
});

test('old purchases fall outside the window', () => {
  const c = detectCluster([
    { name: 'A', code: 'P', value: 1, date: day(1) },
    { name: 'B', code: 'P', value: 1, date: day(400) },
  ], { windowDays: 90 });
  assert.equal(c.insiders, 1);      // B is out of window
  assert.equal(c.cluster, false);
});

test('rankClusters returns only clusters, strongest first', () => {
  const ranked = rankClusters({
    AAA: { cluster: true, insiders: 3, netValue: 100 },
    BBB: { cluster: false, insiders: 1, netValue: 999 },
    CCC: { cluster: true, insiders: 2, netValue: 500 },
  });
  assert.deepEqual(ranked.map(r => r.symbol), ['AAA', 'CCC']);
});

test('empty input yields no cluster', () => {
  assert.equal(detectCluster([]).cluster, false);
  assert.equal(detectCluster(null).insiders, 0);
});
