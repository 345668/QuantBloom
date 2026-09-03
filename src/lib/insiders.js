// Insider-cluster detection (Cohen, Malloy & Pomorski 2012).
//
// A single insider buying is weak signal; a *cluster* — several distinct
// insiders at the same company buying inside a short window — is the strongest
// documented insider signal (routine, calendar-driven trades are noise; the
// "opportunistic" cluster is what predicts returns). Pure and deterministic;
// operates on a normalized list of Form-4 transactions and degrades to an empty
// result when no feed is available.
//
// A transaction: { symbol, name, shares, value, code, date }
//   code 'P' = open-market purchase, 'S' = sale (SEC transaction codes).

// Keep only open-market purchases (drop option exercises, gifts, sales).
export function purchases(transactions) {
  return (transactions || []).filter(t =>
    (t.code === 'P' || t.type === 'buy' || (t.shares > 0 && t.change > 0)) &&
    (t.code !== 'S'));
}

function personKey(t) {
  return (t.name || '').trim().toLowerCase();
}

// Detect a cluster for one symbol's purchases within `windowDays`.
// Returns { cluster:boolean, insiders:number, buys:number, netValue, names, direction }.
export function detectCluster(transactions, { windowDays = 90, minInsiders = 2 } = {}) {
  const buys = purchases(transactions);
  if (!buys.length) return { cluster: false, insiders: 0, buys: 0, netValue: 0, names: [], direction: 'none' };

  // window = the most recent `windowDays` from the latest transaction.
  const times = buys.map(t => new Date(t.date).getTime()).filter(x => !isNaN(x));
  const latest = times.length ? Math.max(...times) : Date.now();
  const cutoff = latest - windowDays * 86400000;
  const recent = buys.filter(t => {
    const ts = new Date(t.date).getTime();
    return isNaN(ts) ? true : ts >= cutoff;
  });

  const people = new Set(recent.map(personKey));
  const netValue = recent.reduce((s, t) => s + (Number(t.value) || Math.abs(Number(t.shares) || 0) * (Number(t.price) || 0)), 0);
  const insiders = people.size;
  return {
    cluster: insiders >= minInsiders,
    insiders,
    buys: recent.length,
    netValue: Math.round(netValue),
    names: [...people].slice(0, 6),
    direction: 'bullish',       // clusters detected here are buy-side
    windowDays,
  };
}

// Rank symbols by insider-cluster strength (more distinct insiders, then value).
export function rankClusters(bySymbol) {
  return Object.entries(bySymbol)
    .map(([symbol, c]) => ({ symbol, ...c }))
    .filter(c => c.cluster)
    .sort((a, b) => b.insiders - a.insiders || b.netValue - a.netValue);
}
