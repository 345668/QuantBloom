import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, rankTitle, rankPanels, buildCommands } from '../src/lib/command.js';

test('parseQuery treats a single short alpha token as a ticker', () => {
  assert.equal(parseQuery('aapl').symbol, 'AAPL');
  assert.equal(parseQuery('spy').symbol, 'SPY');
  assert.equal(parseQuery('brk.b').symbol, 'BRK.B');
});

test('parseQuery does not treat multi-word or long queries as tickers', () => {
  assert.equal(parseQuery('power desk').symbol, null);
  assert.equal(parseQuery('correlation').symbol, null); // 11 chars
  assert.equal(parseQuery('').symbol, null);
});

test('rankTitle scores exact > prefix > word-prefix > substring', () => {
  assert.equal(rankTitle('Markets', 'markets'), 4);
  assert.equal(rankTitle('Power Desk', 'power'), 3);
  assert.equal(rankTitle('Power Desk', 'desk'), 2);   // word prefix
  assert.equal(rankTitle('Trading Bot', 'rad'), 1);   // substring
  assert.equal(rankTitle('Markets', 'zzz'), 0);
});

test('rankPanels returns matches sorted by score then brevity', () => {
  const titles = ['Markets', 'Market Breadth', 'Market Indices'];
  const r = rankPanels(titles, 'market');
  assert.equal(r[0].title, 'Markets');       // prefix + shortest
  assert.ok(r.every(x => x.score > 0));
  assert.equal(rankPanels(titles, 'xyz').length, 0);
});

test('buildCommands leads with the symbol command for a ticker query', () => {
  const cmds = buildCommands('nvda', ['Markets', 'Power Desk']);
  assert.equal(cmds[0].type, 'symbol');
  assert.equal(cmds[0].symbol, 'NVDA');
});

test('an exact panel-title match outranks the symbol command', () => {
  // "Chart" is both a plausible ticker and an exact panel name → panel wins.
  const cmds = buildCommands('chart', ['Chart', 'Markets']);
  assert.equal(cmds[0].type, 'panel');
  assert.equal(cmds[0].title, 'Chart');
  assert.ok(cmds.some(c => c.type === 'symbol')); // still offered, lower
});

test('buildCommands returns panel go-to commands with the panel index', () => {
  const cmds = buildCommands('power', ['Markets', 'Power Desk']);
  const go = cmds.find(c => c.type === 'panel');
  assert.equal(go.index, 1);
  assert.equal(go.label, 'Go to Power Desk');
});

test('empty query yields no commands', () => {
  assert.deepEqual(buildCommands('', ['Markets']), []);
});
