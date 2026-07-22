// ---------------------------------------------------------------------------
// Risk gate.
//
// Every order passes through here before it can reach a broker. Strategies
// propose; the gate disposes. Nothing downstream may bypass or relax these
// limits — they are code, not configuration a strategy can raise.
//
// Pure functions with no I/O so the whole thing is unit-testable.
// ---------------------------------------------------------------------------

export const DEFAULT_LIMITS = {
  maxPositionPercent: 5,      // single position as % of equity
  maxSectorPercent: 25,       // sector concentration
  maxGrossExposurePercent: 100, // no leverage
  maxDailyLossPercent: 2,     // halt trading for the day
  maxDrawdownPercent: 10,     // halt, require manual restart
  maxOrdersPerDay: 20,
  maxOrderPercentOfADV: 1,    // liquidity: don't be the market
  minOrderValue: 50,          // don't pay commission on dust
};

export const REJECT = {
  BOT_OFF: 'bot_disabled',
  HALTED: 'trading_halted',
  DAILY_LOSS: 'daily_loss_limit',
  DRAWDOWN: 'max_drawdown',
  ORDER_COUNT: 'daily_order_limit',
  POSITION_SIZE: 'position_size_limit',
  SECTOR: 'sector_concentration_limit',
  GROSS_EXPOSURE: 'gross_exposure_limit',
  LIQUIDITY: 'liquidity_limit',
  DUST: 'below_min_order_value',
  NO_SHARES: 'no_position_to_sell',
  BAD_INPUT: 'invalid_order',
  MARKET_CLOSED: 'market_closed',
};

/**
 * Evaluate a proposed order against the current account state.
 *
 * @returns {{approved: boolean, reason?: string, detail?: string,
 *            adjustedQty?: number, warnings: string[]}}
 */
export function evaluateOrder(order, state, limits = DEFAULT_LIMITS) {
  const warnings = [];
  const reject = (reason, detail) => ({ approved: false, reason, detail, warnings });

  // --- Input sanity -------------------------------------------------------
  if (!order || !order.symbol || !order.side) return reject(REJECT.BAD_INPUT, 'Missing symbol or side');
  if (!['buy', 'sell'].includes(order.side)) return reject(REJECT.BAD_INPUT, `Unknown side "${order.side}"`);
  const price = Number(order.price);
  if (!Number.isFinite(price) || price <= 0) return reject(REJECT.BAD_INPUT, 'Invalid price');
  let qty = Math.floor(Number(order.qty));
  if (!Number.isFinite(qty) || qty <= 0) return reject(REJECT.BAD_INPUT, 'Invalid quantity');

  const equity = Number(state.equity);
  if (!Number.isFinite(equity) || equity <= 0) return reject(REJECT.BAD_INPUT, 'Invalid account equity');

  // --- Global kill conditions, checked before anything else ---------------
  if (!state.enabled) return reject(REJECT.BOT_OFF, 'Bot is switched off');
  if (state.halted) return reject(REJECT.HALTED, state.haltReason || 'Trading halted');

  if (state.dailyPnlPercent != null && state.dailyPnlPercent <= -limits.maxDailyLossPercent) {
    return reject(REJECT.DAILY_LOSS,
      `Down ${Math.abs(state.dailyPnlPercent).toFixed(2)}% today (limit ${limits.maxDailyLossPercent}%)`);
  }
  if (state.drawdownPercent != null && state.drawdownPercent >= limits.maxDrawdownPercent) {
    return reject(REJECT.DRAWDOWN,
      `Drawdown ${state.drawdownPercent.toFixed(2)}% (limit ${limits.maxDrawdownPercent}%)`);
  }
  if ((state.ordersToday || 0) >= limits.maxOrdersPerDay) {
    return reject(REJECT.ORDER_COUNT, `${state.ordersToday} orders today (limit ${limits.maxOrdersPerDay})`);
  }
  if (state.marketOpen === false && !order.allowExtendedHours) {
    return reject(REJECT.MARKET_CLOSED, 'Market is closed');
  }

  const positions = state.positions || {};
  const held = positions[order.symbol]?.qty || 0;

  // --- Sells: can only close what is actually held ------------------------
  if (order.side === 'sell') {
    if (held <= 0) return reject(REJECT.NO_SHARES, `No position in ${order.symbol}`);
    if (qty > held) {
      // Selling more than held would open a short. Clamp instead of reject —
      // the intent (reduce exposure) is still valid.
      warnings.push(`Reduced sell from ${qty} to ${held} (position size)`);
      qty = held;
    }
    return { approved: true, adjustedQty: qty, warnings };
  }

  // --- Buys: size, concentration, exposure, liquidity ---------------------
  let orderValue = qty * price;

  if (orderValue < limits.minOrderValue) {
    return reject(REJECT.DUST, `Order value $${orderValue.toFixed(2)} below $${limits.minOrderValue} minimum`);
  }

  // Position size cap — clamp rather than reject so a slightly oversized
  // proposal still trades at the permitted size.
  const currentPosValue = (positions[order.symbol]?.marketValue) || 0;
  const maxPosValue = equity * (limits.maxPositionPercent / 100);
  if (currentPosValue + orderValue > maxPosValue) {
    const allowedValue = maxPosValue - currentPosValue;
    const allowedQty = Math.floor(allowedValue / price);
    if (allowedQty <= 0) {
      return reject(REJECT.POSITION_SIZE,
        `${order.symbol} already at ${((currentPosValue / equity) * 100).toFixed(1)}% of equity (limit ${limits.maxPositionPercent}%)`);
    }
    warnings.push(`Reduced ${qty} to ${allowedQty} (${limits.maxPositionPercent}% position limit)`);
    qty = allowedQty;
    orderValue = qty * price;
  }

  // Sector concentration.
  if (order.sector) {
    const sectorValue = Object.values(positions)
      .filter(p => p.sector === order.sector)
      .reduce((s, p) => s + (p.marketValue || 0), 0);
    const maxSectorValue = equity * (limits.maxSectorPercent / 100);
    if (sectorValue + orderValue > maxSectorValue) {
      const allowedQty = Math.floor((maxSectorValue - sectorValue) / price);
      if (allowedQty <= 0) {
        return reject(REJECT.SECTOR,
          `${order.sector} already at ${((sectorValue / equity) * 100).toFixed(1)}% of equity (limit ${limits.maxSectorPercent}%)`);
      }
      warnings.push(`Reduced ${qty} to ${allowedQty} (${limits.maxSectorPercent}% sector limit)`);
      qty = allowedQty;
      orderValue = qty * price;
    }
  }

  // Gross exposure — no leverage by default.
  const grossValue = Object.values(positions).reduce((s, p) => s + Math.abs(p.marketValue || 0), 0);
  const maxGross = equity * (limits.maxGrossExposurePercent / 100);
  if (grossValue + orderValue > maxGross) {
    const allowedQty = Math.floor((maxGross - grossValue) / price);
    if (allowedQty <= 0) {
      return reject(REJECT.GROSS_EXPOSURE,
        `Gross exposure ${((grossValue / equity) * 100).toFixed(1)}% (limit ${limits.maxGrossExposurePercent}%)`);
    }
    warnings.push(`Reduced ${qty} to ${allowedQty} (gross exposure limit)`);
    qty = allowedQty;
    orderValue = qty * price;
  }

  // Liquidity — an order large relative to average volume moves the market
  // against itself, and backtests never model that honestly.
  if (order.avgDailyVolume > 0) {
    const maxQty = Math.floor(order.avgDailyVolume * (limits.maxOrderPercentOfADV / 100));
    if (qty > maxQty) {
      if (maxQty <= 0) return reject(REJECT.LIQUIDITY, `${order.symbol} too illiquid`);
      warnings.push(`Reduced ${qty} to ${maxQty} (${limits.maxOrderPercentOfADV}% of ADV)`);
      qty = maxQty;
      orderValue = qty * price;
    }
  }

  // Re-check dust after every clamp above.
  if (orderValue < limits.minOrderValue) {
    return reject(REJECT.DUST, `Order shrank to $${orderValue.toFixed(2)} after limits`);
  }

  return { approved: true, adjustedQty: qty, warnings };
}

/**
 * Halt conditions evaluated independently of any order, so the bot stops
 * itself even when it is not trying to trade.
 */
export function checkHaltConditions(state, limits = DEFAULT_LIMITS) {
  if (state.dailyPnlPercent != null && state.dailyPnlPercent <= -limits.maxDailyLossPercent) {
    return { halt: true, reason: REJECT.DAILY_LOSS,
      detail: `Daily loss ${state.dailyPnlPercent.toFixed(2)}% hit the ${limits.maxDailyLossPercent}% limit`,
      requiresManualRestart: false };
  }
  if (state.drawdownPercent != null && state.drawdownPercent >= limits.maxDrawdownPercent) {
    return { halt: true, reason: REJECT.DRAWDOWN,
      detail: `Drawdown ${state.drawdownPercent.toFixed(2)}% hit the ${limits.maxDrawdownPercent}% limit`,
      requiresManualRestart: true };
  }
  return { halt: false };
}
