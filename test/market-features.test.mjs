import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignBenchmark, marketFeaturesAt, buildDataset, MARKET_FEATURE_NAMES, FEATURE_NAMES } from '../bot/features.js';

function candles(closes, t0 = 1000, step = 86400) {
  return closes.map((c, i) => ({ time: t0 + i * step, open: c, high: c + 1, low: c - 1, close: c, volume: 1000 }));
}

test('alignBenchmark maps benchmark closes onto the stock times, carrying forward', () => {
  const stock = candles([10, 11, 12, 13], 1000);
  // Benchmark missing the 2nd bar; should carry the prior close forward.
  const bench = [{ time: 1000, close: 100 }, { time: 1000 + 2 * 86400, close: 102 }, { time: 1000 + 3 * 86400, close: 103 }];
  const aligned = alignBenchmark(stock, bench);
  assert.deepEqual(aligned, [100, 100, 102, 103]);
});

test('alignBenchmark leaves nulls before the first benchmark match', () => {
  const stock = candles([10, 11, 12], 1000);
  const bench = [{ time: 1000 + 86400, close: 100 }];
  assert.deepEqual(alignBenchmark(stock, bench), [null, 100, 100]);
});

test('marketFeaturesAt returns neutral zeros without a benchmark or enough history', () => {
  const stock = candles(Array.from({ length: 70 }, (_, i) => 100 + i));
  assert.deepEqual(marketFeaturesAt(stock, null, 65), MARKET_FEATURE_NAMES.map(() => 0));
  assert.deepEqual(marketFeaturesAt(stock, alignBenchmark(stock, stock), 30), MARKET_FEATURE_NAMES.map(() => 0)); // t < 60
});

test('excess return is the stock return minus the benchmark return', () => {
  // Stock rises 2% on the last bar; benchmark rises 1% -> excessRet1 ~ +1%.
  const n = 70;
  const stock = candles(Array.from({ length: n }, (_, i) => (i === n - 1 ? 102 : 100 + i * 0)));
  const benchC = Array.from({ length: n }, (_, i) => (i === n - 1 ? 101 : 100));
  const bench = benchC.map((c, i) => ({ time: 1000 + i * 86400, close: c }));
  const mf = marketFeaturesAt(stock, alignBenchmark(stock, bench), n - 1);
  // stock last ret = 102/100-1 = 0.02; bench = 101/100-1 = 0.01; excess ~ 0.01.
  assert.ok(Math.abs(mf[0] - 0.01) < 1e-9, `excessRet1 was ${mf[0]}`);
});

test('a stock that IS the benchmark has beta 1 and correlation 1', () => {
  const closes = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.2);
  const stock = candles(closes);
  const bench = closes.map((c, i) => ({ time: 1000 + i * 86400, close: c }));
  const mf = marketFeaturesAt(stock, alignBenchmark(stock, bench), 79);
  // beta60 ~ 1, corr60 ~ 1 when the series are identical.
  assert.ok(Math.abs(mf[3] - 1) < 1e-6, `beta was ${mf[3]}`);
  assert.ok(Math.abs(mf[4] - 1) < 1e-6, `corr was ${mf[4]}`);
});

test('buildDataset widens the feature set when a benchmark is supplied', () => {
  const closes = Array.from({ length: 320 }, (_, i) => 100 + Math.sin(i / 6) * 8 + i * 0.1);
  const stock = candles(closes);
  const bench = closes.map((c, i) => ({ time: 1000 + i * 86400, close: c * 0.5 + 50 }));

  const base = buildDataset(stock, { horizon: 10 });
  const withMkt = buildDataset(stock, { horizon: 10 }, bench);

  assert.equal(base.featureNames.length, FEATURE_NAMES.length);
  assert.equal(withMkt.featureNames.length, FEATURE_NAMES.length + MARKET_FEATURE_NAMES.length);
  assert.equal(withMkt.X[0].length, withMkt.featureNames.length);
  // Every value finite (no NaN leaking from alignment gaps).
  for (const row of withMkt.X) for (const v of row) assert.ok(Number.isFinite(v));
});
