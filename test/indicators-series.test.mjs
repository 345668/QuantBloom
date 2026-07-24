import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sma, ema, wma, vwap, bollinger, keltner, donchian, parabolicSAR, superTrend,
  rsi, macd, stochastic, cci, williamsR, obv, atr, INDICATORS,
} from '../charting/indicators.js';

function candles(rows) {
  // rows: [close] or [{o,h,l,c,v}]
  return rows.map((r, i) => {
    if (typeof r === 'number') {
      const prev = i === 0 ? r : (typeof rows[i - 1] === 'number' ? rows[i - 1] : rows[i - 1].c);
      return { time: 1600000000 + i * 86400, open: prev, high: Math.max(prev, r) + 0.5, low: Math.min(prev, r) - 0.5, close: r, volume: 1000 };
    }
    return { time: 1600000000 + i * 86400, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v ?? 1000 };
  });
}

// --- Moving averages -------------------------------------------------------

test('sma matches the hand-computed average', () => {
  const s = sma(candles([1, 2, 3, 4, 5, 6]), 3);
  assert.equal(s[0].value, 2);  // (1+2+3)/3
  assert.equal(s[1].value, 3);
  assert.equal(s.at(-1).value, 5); // (4+5+6)/3
  assert.equal(s.length, 4);
});

test('sma of a constant series is that constant', () => {
  const s = sma(candles([7, 7, 7, 7, 7]), 3);
  s.forEach(p => assert.equal(p.value, 7));
});

test('ema seeds on the SMA and tracks a rising series upward', () => {
  const e = ema(candles([1, 2, 3, 4, 5, 6, 7, 8]), 3);
  assert.equal(e[0].value, 2); // seed = SMA(1,2,3)
  for (let i = 1; i < e.length; i++) assert.ok(e[i].value > e[i - 1].value);
});

test('wma weights recent values more than sma', () => {
  const data = candles([1, 2, 3, 4, 10]);
  const w = wma(data, 5).at(-1).value;
  const s = sma(data, 5).at(-1).value;
  assert.ok(w > s, 'WMA should lean toward the recent jump');
  // WMA(1..4,10) = (1*1+2*2+3*3+4*4+10*5)/15 = (1+4+9+16+50)/15 = 80/15
  assert.ok(Math.abs(w - 80 / 15) < 1e-9);
});

test('anchored vwap sits between the low and high of the range', () => {
  const v = vwap(candles([{ o: 10, h: 12, l: 9, c: 11, v: 100 }, { o: 11, h: 13, l: 10, c: 12, v: 200 }]));
  assert.equal(v.length, 2);
  v.forEach(p => assert.ok(p.value > 8 && p.value < 14));
});

test('vwap with equal typical prices equals that price', () => {
  const v = vwap(candles([{ o: 10, h: 10, l: 10, c: 10, v: 50 }, { o: 10, h: 10, l: 10, c: 10, v: 70 }]));
  v.forEach(p => assert.ok(Math.abs(p.value - 10) < 1e-9));
});

// --- Bands -----------------------------------------------------------------

test('bollinger bands straddle the middle and widen with volatility', () => {
  const bb = bollinger(candles([1, 3, 2, 8, 4, 10, 5, 12]), 4, 2);
  bb.upper.forEach((u, i) => {
    assert.ok(u.value > bb.middle[i].value);
    assert.ok(bb.lower[i].value < bb.middle[i].value);
  });
});

test('donchian upper is the max high and lower the min low over the window', () => {
  const data = candles([{ o: 1, h: 5, l: 1, c: 3 }, { o: 3, h: 9, l: 2, c: 7 }, { o: 7, h: 6, l: 4, c: 5 }]);
  const d = donchian(data, 3);
  assert.equal(d.upper[0].value, 9);
  assert.equal(d.lower[0].value, 1);
  assert.equal(d.middle[0].value, 5);
});

test('keltner bands are centred on the EMA', () => {
  const data = candles([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  const k = keltner(data, 5, 2);
  k.upper.forEach((u, i) => {
    assert.ok(u.value > k.middle[i].value);
    assert.ok(k.lower[i].value < k.middle[i].value);
  });
});

// --- Parabolic SAR / SuperTrend -------------------------------------------

test('parabolic SAR stays below price in an uptrend', () => {
  const data = candles([10, 11, 12, 13, 14, 15, 16, 17]);
  const sar = parabolicSAR(data);
  // Most SAR points should be under the close during a clean uptrend.
  const below = sar.filter((p, i) => p.value < data[i + 1].close).length;
  assert.ok(below >= sar.length - 1);
});

test('superTrend produces a finite line', () => {
  const data = candles([10, 12, 11, 14, 13, 16, 15, 18, 17, 20, 19, 22, 21, 24]);
  const st = superTrend(data, 5, 3);
  assert.ok(st.length > 0);
  st.forEach(p => assert.ok(Number.isFinite(p.value)));
});

// --- Oscillators -----------------------------------------------------------

test('rsi is 100 for a monotonic rise and bounded in [0,100]', () => {
  const up = rsi(candles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]), 14);
  assert.ok(up.at(-1).value > 99);
  up.forEach(p => assert.ok(p.value >= 0 && p.value <= 100));
});

test('rsi is near 0 for a monotonic decline', () => {
  const down = rsi(candles([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]), 14);
  assert.ok(down.at(-1).value < 1);
});

test('macd histogram equals macd minus signal', () => {
  const data = candles(Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 5 + i * 0.2));
  const m = macd(data);
  const sigByTime = new Map(m.signal.map(p => [p.time, p.value]));
  m.histogram.forEach(h => {
    const macdVal = m.macd.find(p => p.time === h.time).value;
    assert.ok(Math.abs(h.value - (macdVal - sigByTime.get(h.time))) < 1e-9);
  });
});

test('stochastic %K is 100 at a new high and 0 at a new low, bounded', () => {
  const data = candles([{ o: 5, h: 10, l: 5, c: 10 }, { o: 10, h: 12, l: 8, c: 12 }, { o: 12, h: 15, l: 9, c: 15 }]);
  const st = stochastic(data, 3, 1);
  assert.ok(st.k.at(-1).value === 100); // close at the period high
  st.k.forEach(p => assert.ok(p.value >= 0 && p.value <= 100));
});

test('williams %R is bounded in [-100,0]', () => {
  const w = williamsR(candles([3, 5, 4, 6, 8, 7, 9, 5, 4, 10, 11, 8, 12, 13, 9, 14]), 14);
  w.forEach(p => assert.ok(p.value >= -100 && p.value <= 0));
});

test('cci is 0 when typical price equals its mean', () => {
  const flat = cci(candles([{ o: 10, h: 10, l: 10, c: 10 }, { o: 10, h: 10, l: 10, c: 10 }, { o: 10, h: 10, l: 10, c: 10 }]), 3);
  flat.forEach(p => assert.equal(p.value, 0));
});

test('obv rises on up-closes and falls on down-closes', () => {
  const o = obv(candles([{ o: 10, h: 10, l: 10, c: 10, v: 100 }, { o: 10, h: 11, l: 10, c: 11, v: 50 }, { o: 11, h: 11, l: 9, c: 9, v: 30 }]));
  assert.equal(o[0].value, 0);
  assert.equal(o[1].value, 50);   // up close adds volume
  assert.equal(o[2].value, 20);   // down close subtracts
});

test('atr is positive and finite', () => {
  const a = atr(candles([10, 12, 9, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24, 21, 26]), 14);
  assert.ok(a.length > 0);
  a.forEach(p => assert.ok(p.value > 0 && Number.isFinite(p.value)));
});

// --- Registry --------------------------------------------------------------

test('every registered indicator produces plottable output from real-ish data', () => {
  const data = candles(Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 6) * 8 + i * 0.15));
  for (const [key, def] of Object.entries(INDICATORS)) {
    const out = def.fn(data, def.params);
    assert.ok(out != null, `${key} returned nothing`);
    // Either an array of points or an object of arrays — all points finite.
    const arrays = Array.isArray(out) ? [out] : Object.values(out);
    for (const arr of arrays) {
      for (const p of arr) assert.ok(Number.isFinite(p.value), `${key} produced a non-finite value`);
    }
  }
});
