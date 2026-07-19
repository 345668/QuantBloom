// ---------------------------------------------------------------------------
// Alpaca broker adapter (PAPER trading).
//
// The endpoint is read from ALPACA_ENDPOINT and asserted to be a paper host at
// construction. Pointing this at live trading is a deliberate act that has to
// happen outside this file — see isPaperEndpoint().
// ---------------------------------------------------------------------------

// Read env lazily, not at module load. ESM imports are hoisted and evaluate
// before the importing module's body runs, so anything captured at load time
// here would be read before dotenv.config() has populated process.env.
const endpoint = () => process.env.ALPACA_ENDPOINT || 'https://paper-api.alpaca.markets/v2';
const key = () => process.env.ALPACA_API_KEY;
const secret = () => process.env.ALPACA_SECRET_KEY;

export const isPaperEndpoint = (url = endpoint()) => /paper-api\.alpaca\.markets/.test(url);
export const alpacaConfigured = () => Boolean(key() && secret());

async function alpaca(path, options = {}) {
  if (!alpacaConfigured()) throw new Error('Alpaca credentials not configured');
  const resp = await fetch(`${endpoint()}${path}`, {
    ...options,
    headers: {
      'APCA-API-KEY-ID': key(),
      'APCA-API-SECRET-KEY': secret(),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await resp.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!resp.ok) {
    const msg = body?.message || body?.raw || `HTTP ${resp.status}`;
    throw new Error(`Alpaca ${path}: ${msg}`);
  }
  return body;
}

export async function getAccount() {
  const a = await alpaca('/account');
  return {
    status: a.status,
    equity: parseFloat(a.equity),
    lastEquity: parseFloat(a.last_equity),
    cash: parseFloat(a.cash),
    buyingPower: parseFloat(a.buying_power),
    tradingBlocked: a.trading_blocked,
    accountBlocked: a.account_blocked,
    currency: a.currency,
    // Same-day P&L against the previous close.
    dailyPnl: parseFloat(a.equity) - parseFloat(a.last_equity),
    dailyPnlPercent: parseFloat(a.last_equity)
      ? ((parseFloat(a.equity) - parseFloat(a.last_equity)) / parseFloat(a.last_equity)) * 100
      : 0,
  };
}

export async function getPositions() {
  const rows = await alpaca('/positions');
  return (rows || []).map(p => ({
    symbol: p.symbol,
    qty: parseFloat(p.qty),
    side: p.side,
    avgEntryPrice: parseFloat(p.avg_entry_price),
    marketValue: parseFloat(p.market_value),
    costBasis: parseFloat(p.cost_basis),
    unrealisedPnl: parseFloat(p.unrealized_pl),
    unrealisedPercent: parseFloat(p.unrealized_plpc) * 100,
    currentPrice: parseFloat(p.current_price),
  }));
}

export async function getClock() {
  const c = await alpaca('/clock');
  return { isOpen: c.is_open, nextOpen: c.next_open, nextClose: c.next_close, timestamp: c.timestamp };
}

export async function getOrders(status = 'all', limit = 50) {
  const rows = await alpaca(`/orders?status=${status}&limit=${limit}&direction=desc`);
  return (rows || []).map(o => ({
    id: o.id,
    clientOrderId: o.client_order_id,
    symbol: o.symbol,
    side: o.side,
    qty: parseFloat(o.qty),
    filledQty: parseFloat(o.filled_qty || 0),
    type: o.type,
    status: o.status,
    submittedAt: o.submitted_at,
    filledAt: o.filled_at,
    filledAvgPrice: o.filled_avg_price ? parseFloat(o.filled_avg_price) : null,
  }));
}

/**
 * Submit an order.
 *
 * clientOrderId makes submission idempotent: retrying after a network timeout
 * cannot create a duplicate position, because Alpaca rejects a repeated id.
 */
export async function submitOrder({ symbol, side, qty, type = 'market', timeInForce = 'day', clientOrderId }) {
  const body = {
    symbol, side, qty: String(qty), type, time_in_force: timeInForce,
    ...(clientOrderId ? { client_order_id: clientOrderId } : {}),
  };
  const o = await alpaca('/orders', { method: 'POST', body: JSON.stringify(body) });
  return {
    id: o.id, clientOrderId: o.client_order_id, symbol: o.symbol, side: o.side,
    qty: parseFloat(o.qty), type: o.type, status: o.status, submittedAt: o.submitted_at,
  };
}

export async function cancelAllOrders() {
  try {
    const r = await alpaca('/orders', { method: 'DELETE' });
    return { cancelled: Array.isArray(r) ? r.length : 0 };
  } catch (e) {
    return { cancelled: 0, error: e.message };
  }
}

/**
 * Flatten every position. Used by the kill switch, so it reports partial
 * failure rather than throwing — a failure to close one symbol must not
 * prevent the attempt on the rest.
 */
export async function closeAllPositions() {
  try {
    const r = await alpaca('/positions?cancel_orders=true', { method: 'DELETE' });
    const rows = Array.isArray(r) ? r : [];
    return {
      attempted: rows.length,
      succeeded: rows.filter(x => x.status >= 200 && x.status < 300).length,
      failures: rows.filter(x => !(x.status >= 200 && x.status < 300)).map(x => x.symbol),
    };
  } catch (e) {
    return { attempted: 0, succeeded: 0, failures: [], error: e.message };
  }
}
