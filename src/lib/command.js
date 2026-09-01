// Pure helpers behind the Ctrl+K command palette. Kept out of the component so
// the query parsing and panel ranking are unit-testable.

/** A single-token, short, alphabetic query is treated as a ticker candidate. */
export function parseQuery(query) {
  const q = query.trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  const symbol = tokens.length === 1 && /^[A-Za-z][A-Za-z.\-]{0,5}$/.test(tokens[0])
    ? tokens[0].toUpperCase()
    : null;
  return { q, tokens, symbol };
}

/** Rank a panel title against the query: exact > prefix > word-prefix > substring. */
export function rankTitle(title, query) {
  const t = title.toLowerCase(), s = query.trim().toLowerCase();
  if (!s) return 0;
  if (t === s) return 4;
  if (t.startsWith(s)) return 3;
  if (t.split(/\s+/).some(w => w.startsWith(s))) return 2;
  if (t.includes(s)) return 1;
  return 0;
}

/** Ranked panel matches for a query. Returns [{ title, index, score }]. */
export function rankPanels(titles, query) {
  return titles
    .map((title, index) => ({ title, index, score: rankTitle(title, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.title.length - b.title.length);
}

/**
 * Build the ordered command list. A ticker-looking query offers a "set symbol"
 * command; panel matches offer "go to". An exact panel-title match outranks the
 * symbol command; otherwise the symbol command leads.
 */
export function buildCommands(query, titles) {
  const { symbol } = parseQuery(query);
  const panels = rankPanels(titles, query);
  const hasExactPanel = panels[0]?.score === 4;

  const symbolCmd = symbol ? [{ type: 'symbol', symbol, label: `Set active symbol → ${symbol}` }] : [];
  const panelCmds = panels.map(p => ({ type: 'panel', index: p.index, title: p.title, label: `Go to ${p.title}` }));

  return hasExactPanel ? [...panelCmds, ...symbolCmd] : [...symbolCmd, ...panelCmds];
}
