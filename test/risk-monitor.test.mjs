import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monitorBook, MONITOR_LIMITS } from '../bot/risk-monitor.js';

test('flat book is ok with no actions', () => {
  const m = monitorBook({ equity: 100000, positions: [], dailyPnlPercent: 0 });
  assert.equal(m.status, 'ok');
  assert.equal(m.actions.length, 0);
  assert.equal(m.grossExposure, 0);
});

test('a position above 2% NAV is flagged to trim', () => {
  const m = monitorBook({ equity: 100000, dailyPnlPercent: 0, positions: [
    { symbol: 'NVDA', sector: 'Information Technology', marketValue: 3000, unrealizedPlPercent: 5 },
    { symbol: 'KO', sector: 'Consumer Staples', marketValue: 1000 },
  ]});
  const nvda = m.positions.find(p => p.symbol === 'NVDA');
  assert.equal(nvda.weight, 3);
  assert.equal(nvda.flag, 'trim');
  assert.equal(m.positions.find(p => p.symbol === 'KO').flag, 'ok'); // 1% < 2%
  assert.equal(m.counts.trims, 1);
  assert.equal(m.status, 'watch');
});

test('a sector above 30% NAV is flagged to rebalance', () => {
  const m = monitorBook({ equity: 100000, dailyPnlPercent: 0, positions: [
    { symbol: 'AAPL', sector: 'Information Technology', marketValue: 20000 },
    { symbol: 'MSFT', sector: 'Information Technology', marketValue: 15000 },
  ]});
  const tech = m.sectors.find(s => s.sector === 'Information Technology');
  assert.equal(tech.weight, 35);
  assert.equal(tech.flag, 'rebalance');
  assert.equal(m.counts.rebalances, 1);
});

test('daily drawdown beyond 5% triggers liquidate/critical', () => {
  const m = monitorBook({ equity: 90000, dailyPnlPercent: -6.2, positions: [
    { symbol: 'AAPL', sector: 'Tech', marketValue: 1000 },
  ]});
  assert.equal(m.liquidate, true);
  assert.equal(m.status, 'critical');
  assert.ok(m.actions.some(a => a.type === 'liquidate'));
  assert.equal(m.dailyDrawdown, 6.2);
});

test('positive daily P&L never triggers liquidation', () => {
  const m = monitorBook({ equity: 100000, dailyPnlPercent: 3.1, positions: [] });
  assert.equal(m.liquidate, false);
  assert.equal(m.dailyDrawdown, 0);
});

test('positions are sorted by weight descending', () => {
  const m = monitorBook({ equity: 100000, dailyPnlPercent: 0, positions: [
    { symbol: 'A', sector: 'X', marketValue: 1000 },
    { symbol: 'B', sector: 'Y', marketValue: 5000 },
  ]});
  assert.deepEqual(m.positions.map(p => p.symbol), ['B', 'A']);
});

test('monitor thresholds are 2 / 30 / 5', () => {
  assert.equal(MONITOR_LIMITS.trimPositionPercent, 2);
  assert.equal(MONITOR_LIMITS.sectorRebalancePercent, 30);
  assert.equal(MONITOR_LIMITS.liquidateDrawdownPercent, 5);
});
