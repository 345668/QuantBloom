import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';

// Order types and statuses
export const OrderTypeEnum = z.enum([
  'MARKET',
  'LIMIT', 
  'STOP',
  'STOP_LIMIT',
  'TRAILING_STOP',
  'MARKET_ON_CLOSE',
  'LIMIT_ON_CLOSE'
]);

export const OrderSideEnum = z.enum(['BUY', 'SELL']);

export const OrderStatusEnum = z.enum([
  'PENDING',
  'SUBMITTED',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED'
]);

export const TimeInForceEnum = z.enum([
  'DAY',      // Good for Day
  'GTC',      // Good Till Cancelled
  'IOC',      // Immediate or Cancel
  'FOK',      // Fill or Kill
  'GTD'       // Good Till Date
]);

// Base order schema
export const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  symbol: z.string(),
  side: OrderSideEnum,
  orderType: OrderTypeEnum,
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  trailingAmount: z.number().positive().optional(),
  timeInForce: TimeInForceEnum,
  status: OrderStatusEnum,
  filledQuantity: z.number().min(0).default(0),
  avgFillPrice: z.number().positive().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date().optional(),
  parentOrderId: z.string().optional(), // For bracket orders
  notes: z.string().optional(),
});

// Order creation schema (what user submits)
export const CreateOrderSchema = OrderSchema.omit({ 
  id: true, 
  userId: true, 
  status: true, 
  filledQuantity: true, 
  avgFillPrice: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  // Risk management fields
  maxSlippage: z.number().min(0).max(1).optional(), // 0-1 representing percentage
  positionSizing: z.enum(['FIXED', 'PERCENT_PORTFOLIO', 'RISK_BASED']).optional(),
  riskAmount: z.number().positive().optional(),
});

// Position schema
export const PositionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  symbol: z.string(),
  quantity: z.number(),
  avgPrice: z.number().positive(),
  currentPrice: z.number().positive(),
  marketValue: z.number(),
  unrealizedPnL: z.number(),
  unrealizedPnLPercent: z.number(),
  realizedPnL: z.number(),
  totalReturn: z.number(),
  totalReturnPercent: z.number(),
  costBasis: z.number(),
  dayChange: z.number().optional(),
  dayChangePercent: z.number().optional(),
  updatedAt: z.date(),
});

// Trade execution schema
export const TradeSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  userId: z.string(),
  symbol: z.string(),
  side: OrderSideEnum,
  quantity: z.number().positive(),
  price: z.number().positive(),
  commission: z.number().min(0),
  executedAt: z.date(),
  venue: z.string().optional(),
  executionId: z.string().optional(),
});

// Order validation rules
export const OrderValidationSchema = z.object({
  symbol: z.string().min(1).max(10).regex(/^[A-Z]+$/),
  quantity: z.number().positive().max(1000000),
  price: z.number().positive().max(100000).optional(),
  stopPrice: z.number().positive().max(100000).optional(),
  maxSlippage: z.number().min(0).max(0.1), // Max 10% slippage
});

// Bracket order schema (for complex order strategies)
export const BracketOrderSchema = z.object({
  parentOrder: CreateOrderSchema,
  profitTarget: CreateOrderSchema.optional(),
  stopLoss: CreateOrderSchema.optional(),
  trailingStop: CreateOrderSchema.optional(),
});

// Portfolio risk metrics
export const RiskMetricsSchema = z.object({
  portfolioValue: z.number(),
  availableCash: z.number(),
  buyingPower: z.number(),
  dayTradeCount: z.number(),
  marginUsed: z.number().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  maxPositionSize: z.number(),
  portfolioBeta: z.number().optional(),
});

// Order book entry
export const OrderBookEntrySchema = z.object({
  price: z.number().positive(),
  quantity: z.number().positive(),
  numOrders: z.number().positive(),
  side: OrderSideEnum,
});

export const OrderBookSchema = z.object({
  symbol: z.string(),
  bids: z.array(OrderBookEntrySchema),
  asks: z.array(OrderBookEntrySchema),
  lastUpdate: z.date(),
});

// Type exports
export type Order = z.infer<typeof OrderSchema>;
export type CreateOrder = z.infer<typeof CreateOrderSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Trade = z.infer<typeof TradeSchema>;
export type BracketOrder = z.infer<typeof BracketOrderSchema>;
export type RiskMetrics = z.infer<typeof RiskMetricsSchema>;
export type OrderBookEntry = z.infer<typeof OrderBookEntrySchema>;
export type OrderBook = z.infer<typeof OrderBookSchema>;
export type OrderType = z.infer<typeof OrderTypeEnum>;
export type OrderSide = z.infer<typeof OrderSideEnum>;
export type OrderStatus = z.infer<typeof OrderStatusEnum>;
export type TimeInForce = z.infer<typeof TimeInForceEnum>;