const KEYS = {
  watchlist: 'terminal_watchlist',
  activeSymbol: 'terminal_active_symbol',
  activeTimeframe: 'terminal_active_timeframe',
  activeOverlays: 'terminal_active_overlays',
  theme: 'terminal_theme',
};

export function getItem(key) {
  try {
    const raw = localStorage.getItem(KEYS[key] || key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(KEYS[key] || key, JSON.stringify(value));
  } catch {}
}

export function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export const DEFAULTS = {
  watchlist: ['AAPL', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'MSFT', 'AMZN', 'META'],
  activeSymbol: 'AAPL',
  activeTimeframe: '15m',
  activeOverlays: ['MA'],
  theme: 'dark',
};
