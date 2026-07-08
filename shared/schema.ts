import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").unique(),
  avatar: text("avatar"), // URL to avatar image
  company: text("company"),
  jobTitle: text("job_title"),
  phone: text("phone"),
  timezone: text("timezone").default("UTC"),
  dateFormat: text("date_format").default("MM/DD/YYYY"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  // Terminal display preferences
  defaultLayout: text("default_layout").default("grid"), // "grid" | "single" | "tabs"
  theme: text("theme").default("dark"), // "dark" | "light" | "auto"
  fontSize: text("font_size").default("medium"), // "small" | "medium" | "large"
  soundEnabled: boolean("sound_enabled").default(false),
  // Data refresh preferences
  autoRefreshInterval: integer("auto_refresh_interval").default(30), // seconds
  enableRealTimeData: boolean("enable_real_time_data").default(true),
  // Chart preferences
  defaultChartType: text("default_chart_type").default("candlestick"), // "line" | "candlestick" | "area"
  defaultTimeframe: text("default_timeframe").default("1D"), // "1D" | "5D" | "1M" | "3M" | "1Y"
  showVolume: boolean("show_volume").default(true),
  showIndicators: boolean("show_indicators").default(false),
  // Notification preferences
  emailNotifications: boolean("email_notifications").default(false),
  browserNotifications: boolean("browser_notifications").default(true),
  alertSounds: boolean("alert_sounds").default(false),
  // Trading preferences
  defaultWatchlists: text("default_watchlists"), // JSON array of watchlist symbols
  favoriteMarkets: text("favorite_markets"), // JSON array of market names
  tradingHours: text("trading_hours").default("market"), // "market" | "extended" | "24h"
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // "alert" | "system" | "news" | "trade" | "announcement"
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  priority: text("priority").default("medium"), // "low" | "medium" | "high" | "urgent"
  actionType: text("action_type"), // "navigate" | "external_link" | "modal"
  actionData: text("action_data"), // JSON string for action data
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

export const watchlists = pgTable("watchlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  assetType: text("asset_type").notNull().default("stock"), // "stock" or "crypto"
  userId: varchar("user_id").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const portfolioPositions = pgTable("portfolio_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 8 }).notNull(), // Increased precision for crypto
  avgPrice: decimal("avg_price", { precision: 15, scale: 8 }).notNull(), // Increased precision for crypto
  assetType: text("asset_type").notNull().default("stock"), // "stock" or "crypto"
  userId: varchar("user_id").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(), // 'price' | 'news' | 'volume' | 'volatility' | 'breakout'
  condition: text("condition").notNull(), // JSON string of AlertCondition
  status: text("status").notNull().default("active"), // 'active' | 'triggered' | 'disabled'
  notificationMethod: text("notification_method").notNull().default("popup"), // 'popup' | 'email' | 'both'
  isRecurring: integer("is_recurring").notNull().default(0), // 0 = false, 1 = true
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow(),
  triggeredAt: timestamp("triggered_at"),
});

// Historical Data Tables for Advanced Analytics

// Asset Universe - Define the 500 best stocks, bonds, commodities
export const assetUniverse = pgTable("asset_universe", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  assetType: text("asset_type").notNull(), // "stock" | "bond" | "commodity" | "crypto" | "forex" | "index"
  category: text("category").notNull(), // For stocks: "technology", "healthcare", etc. For commodities: "energy", "metals", etc.
  exchange: text("exchange"), // NYSE, NASDAQ, COMEX, etc.
  country: text("country").default("US"),
  currency: text("currency").default("USD"),
  sector: text("sector"), // GICS sector classification
  industry: text("industry"), // GICS industry classification
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }), // For stocks
  isActive: boolean("is_active").default(true),
  rank: integer("rank"), // Performance ranking (1-500)
  addedAt: timestamp("added_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: text("metadata"), // JSON for additional asset-specific data
});

// Historical OHLCV data for all asset types
export const historicalPrices = pgTable("historical_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  assetType: text("asset_type").notNull(), // "stock" | "bond" | "commodity" | "crypto" | "forex" | "index"
  timeframe: text("timeframe").notNull(), // "1min" | "5min" | "15min" | "1h" | "1d" | "1w" | "1m"
  timestamp: timestamp("timestamp").notNull(),
  open: decimal("open", { precision: 15, scale: 8 }).notNull(),
  high: decimal("high", { precision: 15, scale: 8 }).notNull(),
  low: decimal("low", { precision: 15, scale: 8 }).notNull(),
  close: decimal("close", { precision: 15, scale: 8 }).notNull(),
  volume: decimal("volume", { precision: 20, scale: 2 }).default("0"),
  adjustedClose: decimal("adjusted_close", { precision: 15, scale: 8 }), // For stock splits/dividends
  dividendAmount: decimal("dividend_amount", { precision: 10, scale: 4 }), // For dividend-paying assets
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint for proper upsert functionality
  uniquePrice: unique().on(table.symbol, table.timeframe, table.timestamp),
}));

// Technical indicators and computed analytics
export const technicalIndicators = pgTable("technical_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(), // "1d" | "1w" | "1m"
  timestamp: timestamp("timestamp").notNull(),
  // Moving Averages
  sma20: decimal("sma_20", { precision: 15, scale: 8 }),
  sma50: decimal("sma_50", { precision: 15, scale: 8 }),
  sma200: decimal("sma_200", { precision: 15, scale: 8 }),
  ema12: decimal("ema_12", { precision: 15, scale: 8 }),
  ema26: decimal("ema_26", { precision: 15, scale: 8 }),
  // MACD
  macd: decimal("macd", { precision: 15, scale: 8 }),
  macdSignal: decimal("macd_signal", { precision: 15, scale: 8 }),
  macdHistogram: decimal("macd_histogram", { precision: 15, scale: 8 }),
  // RSI
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  // Bollinger Bands
  bollingerUpper: decimal("bollinger_upper", { precision: 15, scale: 8 }),
  bollingerMiddle: decimal("bollinger_middle", { precision: 15, scale: 8 }),
  bollingerLower: decimal("bollinger_lower", { precision: 15, scale: 8 }),
  // Volume indicators
  volumeSma: decimal("volume_sma", { precision: 20, scale: 2 }),
  volumeRatio: decimal("volume_ratio", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Data ingestion tracking and status
export const dataIngestionJobs = pgTable("data_ingestion_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: text("job_type").notNull(), // "historical_prices" | "indicators" | "universe_update"
  assetType: text("asset_type").notNull(), // "stock" | "bond" | "commodity" | "crypto"
  symbols: text("symbols"), // JSON array of symbols processed
  timeframe: text("timeframe"), // "1d" | "1w" | "1m" for historical data jobs
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("pending"), // "pending" | "running" | "completed" | "failed" | "cancelled"
  progress: integer("progress").default(0), // Percentage 0-100
  recordsProcessed: integer("records_processed").default(0),
  recordsTotal: integer("records_total").default(0),
  errorMessage: text("error_message"),
  metadata: text("metadata"), // JSON for job-specific data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// Analytics and predictions results
export const analyticsResults = pgTable("analytics_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  analysisType: text("analysis_type").notNull(), // "trend" | "momentum" | "volatility" | "prediction" | "correlation"
  timeframe: text("timeframe").notNull(), // "1d" | "1w" | "1m" | "3m" | "1y"
  timestamp: timestamp("timestamp").notNull(),
  // Trend Analysis
  trendDirection: text("trend_direction"), // "bullish" | "bearish" | "neutral"
  trendStrength: decimal("trend_strength", { precision: 5, scale: 2 }), // 0-100 scale
  supportLevel: decimal("support_level", { precision: 15, scale: 8 }),
  resistanceLevel: decimal("resistance_level", { precision: 15, scale: 8 }),
  // Volatility metrics
  volatility: decimal("volatility", { precision: 10, scale: 6 }), // Historical volatility
  betaValue: decimal("beta_value", { precision: 10, scale: 4 }), // Beta vs market
  // Prediction models
  pricePrediction1d: decimal("price_prediction_1d", { precision: 15, scale: 8 }),
  pricePrediction7d: decimal("price_prediction_7d", { precision: 15, scale: 8 }),
  pricePrediction30d: decimal("price_prediction_30d", { precision: 15, scale: 8 }),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }), // 0-100
  // Risk metrics
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }), // 0-100
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }),
  results: text("results"), // JSON for detailed analysis results
  createdAt: timestamp("created_at").defaultNow(),
});

// Crypto market data cache for handling API rate limits
export const cryptoMarketCache = pgTable("crypto_market_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cacheKey: text("cache_key").notNull().unique(),
  dataType: text("data_type").notNull(), // "markets" | "trending"
  data: text("data").notNull(), // JSON string of cached data
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Market data types
export type StockQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  high52Week?: number;
  low52Week?: number;
  lastUpdated: Date;
};

export type CryptoQuote = {
  symbol: string;
  coinId: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  rank?: number;
  high24h?: number;
  low24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  lastUpdated: Date;
};

// Forex pair quote
export type ForexQuote = {
  symbol: string; // e.g., "EURUSD", "GBPJPY"
  name: string;
  price: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  spread: number;
  high24h: number;
  low24h: number;
  volume24h?: number;
  lastUpdated: Date;
  session: 'TOKYO' | 'LONDON' | 'NEW_YORK' | 'SYDNEY';
};

// Commodities and futures quote
export type CommodityQuote = {
  symbol: string; // e.g., "GC=F" (Gold), "CL=F" (Crude Oil)
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  openInterest?: number;
  contractMonth?: string;
  expiryDate?: Date;
  high52Week?: number;
  low52Week?: number;
  lastUpdated: Date;
  category: 'METALS' | 'ENERGY' | 'AGRICULTURE' | 'CURRENCIES';
};

// International index quote
export type IndexQuote = {
  symbol: string; // e.g., "^FTSE", "^N225", "^HSI"
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  country: string;
  currency: string;
  timezone: string;
  marketStatus: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS';
  lastUpdated: Date;
};

export type AssetQuote = StockQuote | CryptoQuote | ForexQuote | CommodityQuote | IndexQuote;

export type ChartData = {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CryptoCoin = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  rank?: number;
  price: number;
  marketCap?: number;
  volume?: number;
  changePercent24h?: number;
};

export type TrendingCrypto = {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  image?: string;
  priceChangePercentage24h?: number;
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: Date;
  url: string;
  symbol?: string;
  sentiment?: number; // -1 to 1 scale
  sentimentLabel?: 'bearish' | 'neutral' | 'bullish';
  category?: string;
  imageUrl?: string;
};

export type EconomicEvent = {
  id: string;
  title: string;
  country: string;
  currency: string;
  importance: 'low' | 'medium' | 'high';
  actual?: string;
  forecast?: string;
  previous?: string;
  timestamp: Date;
  category: string;
};

// Market session data
export type MarketSession = {
  name: string;
  timezone: string;
  openTime: string; // HH:mm format in local timezone
  closeTime: string; // HH:mm format in local timezone
  status: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS';
  nextOpen?: Date;
  nextClose?: Date;
};

// Order simulation types
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'PARTIALLY_FILLED';

export type SimulatedOrder = {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number; // for limit orders
  stopPrice?: number; // for stop orders
  status: OrderStatus;
  filledQuantity: number;
  avgFillPrice: number;
  timestamp: Date;
  userId: string;
};

// Market depth / Level 2 data
export type MarketDepthLevel = {
  price: number;
  size: number;
  count: number; // number of orders at this level
};

export type MarketDepth = {
  symbol: string;
  bids: MarketDepthLevel[];
  asks: MarketDepthLevel[];
  lastUpdated: Date;
};

// Options chain data
export type OptionContract = {
  symbol: string;
  contractSymbol: string;
  strike: number;
  expiry: Date;
  type: 'CALL' | 'PUT';
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  lastUpdated: Date;
};

export type OptionsChain = {
  symbol: string;
  underlyingPrice: number;
  expiries: Date[];
  strikes: number[];
  calls: OptionContract[];
  puts: OptionContract[];
  lastUpdated: Date;
};

export type CompanyFundamentals = {
  symbol: string;
  name: string;
  marketCap?: number;
  peRatio?: number;
  pegRatio?: number;
  eps?: number;
  revenue?: number;
  grossProfit?: number;
  netIncome?: number;
  totalDebt?: number;
  totalCash?: number;
  sharesOutstanding?: number;
  dividendYield?: number;
  bookValue?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  profitMargin?: number;
  operatingMargin?: number;
  lastUpdated: Date;
};

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlists).pick({
  symbol: true,
  name: true,
  assetType: true,
  userId: true,
});

export const insertPortfolioPositionSchema = createInsertSchema(portfolioPositions).pick({
  symbol: true,
  quantity: true,
  avgPrice: true,
  assetType: true,
  userId: true,
});

// Alert condition types from AlertsEngine
export type AlertCondition = {
  // Price alerts
  targetPrice?: number;
  priceDirection?: 'above' | 'below';
  
  // News alerts  
  keywords?: string[];
  newsSource?: string;
  
  // Volume alerts
  volumeThreshold?: number;
  volumeComparison?: 'above' | 'below' | 'percent_change';
  volumeTimeframe?: '1D' | '5D' | '30D';
  
  // Volatility alerts
  volatilityThreshold?: number;
  volatilityTimeframe?: '1D' | '5D' | '30D';
  
  // Breakout alerts
  breakoutType?: 'resistance' | 'support' | 'pattern';
  technicalPattern?: 'triangle' | 'flag' | 'head_shoulders';
  breakoutConfirmation?: boolean;
};

export type TriggeredAlert = {
  alert: Alert;
  currentValue: number | string;
  triggerReason: string;
  timestamp: Date;
  data?: any;
};

export type Alert = {
  id: string;
  userId: string;
  symbol: string;
  type: 'price' | 'news' | 'volume' | 'volatility' | 'breakout';
  condition: AlertCondition;
  status: 'active' | 'triggered' | 'disabled';
  notificationMethod: 'popup' | 'email' | 'both';
  isRecurring: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  triggeredAt?: Date;
};

// Zod schema for alert condition validation
const alertConditionSchema = z.object({
  // Price alerts
  targetPrice: z.number().positive().optional(),
  priceDirection: z.enum(['above', 'below']).optional(),
  
  // News alerts  
  keywords: z.array(z.string().min(1)).optional(),
  newsSource: z.string().min(1).optional(),
  
  // Volume alerts
  volumeThreshold: z.number().positive().optional(),
  volumeComparison: z.enum(['above', 'below', 'percent_change']).optional(),
  volumeTimeframe: z.enum(['1D', '5D', '30D']).optional(),
  
  // Volatility alerts
  volatilityThreshold: z.number().positive().optional(),
  volatilityTimeframe: z.enum(['1D', '5D', '30D']).optional(),
  
  // Breakout alerts
  breakoutType: z.enum(['resistance', 'support', 'pattern']).optional(),
  technicalPattern: z.enum(['triangle', 'flag', 'head_shoulders']).optional(),
  breakoutConfirmation: z.boolean().optional(),
});

// Base alert schema
const baseAlertSchema = createInsertSchema(alerts).pick({
  symbol: true,
  type: true,
  status: true,
  notificationMethod: true,
  isRecurring: true,
  userId: true,
}).extend({
  condition: alertConditionSchema,
  metadata: z.record(z.any()).optional(),
});

// Refined schemas for each alert type
export const insertAlertSchema = baseAlertSchema.superRefine((data, ctx) => {
  switch (data.type) {
    case 'price':
      if (!data.condition.targetPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Price alerts require targetPrice",
          path: ['condition', 'targetPrice']
        });
      }
      if (!data.condition.priceDirection) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Price alerts require priceDirection",
          path: ['condition', 'priceDirection']
        });
      }
      break;
      
    case 'volume':
      if (!data.condition.volumeThreshold) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Volume alerts require volumeThreshold",
          path: ['condition', 'volumeThreshold']
        });
      }
      if (!data.condition.volumeComparison) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Volume alerts require volumeComparison",
          path: ['condition', 'volumeComparison']
        });
      }
      break;
      
    case 'volatility':
      if (!data.condition.volatilityThreshold) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Volatility alerts require volatilityThreshold",
          path: ['condition', 'volatilityThreshold']
        });
      }
      break;
      
    case 'news':
      if (!data.condition.keywords?.length && !data.condition.newsSource) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "News alerts require keywords or newsSource",
          path: ['condition']
        });
      }
      break;
      
    case 'breakout':
      if (!data.condition.breakoutType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Breakout alerts require breakoutType",
          path: ['condition', 'breakoutType']
        });
      }
      break;
  }
});

// User profile types
export type UserProfile = typeof userProfiles.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type CryptoMarketCache = typeof cryptoMarketCache.$inferSelect;
export type InsertCryptoMarketCache = typeof cryptoMarketCache.$inferInsert;

// Authentication types for UI
export type AuthUser = User & {
  profile?: UserProfile;
  preferences?: UserPreferences;
};

// Note: Original insert schemas are defined further down in the file
export const insertUserProfileSchema = createInsertSchema(userProfiles).pick({
  userId: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
  company: true,
  jobTitle: true,
  phone: true,
  timezone: true,
  dateFormat: true,
}).extend({
  email: z.string().email().optional(),
  phone: z.string().min(10).max(20).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).pick({
  userId: true,
  defaultLayout: true,
  theme: true,
  fontSize: true,
  soundEnabled: true,
  autoRefreshInterval: true,
  enableRealTimeData: true,
  defaultChartType: true,
  defaultTimeframe: true,
  showVolume: true,
  showIndicators: true,
  emailNotifications: true,
  browserNotifications: true,
  alertSounds: true,
  defaultWatchlists: true,
  favoriteMarkets: true,
  tradingHours: true,
}).extend({
  autoRefreshInterval: z.number().min(5).max(300).optional(),
  defaultWatchlists: z.string().optional(), // JSON string validation
  favoriteMarkets: z.string().optional(), // JSON string validation
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  priority: true,
  actionType: true,
  actionData: true,
  metadata: true,
});

// Historical Data Schema Validations
export const insertAssetUniverseSchema = createInsertSchema(assetUniverse).pick({
  symbol: true,
  name: true,
  assetType: true,
  category: true,
  exchange: true,
  country: true,
  currency: true,
  sector: true,
  industry: true,
  marketCap: true,
  isActive: true,
  rank: true,
  metadata: true,
}).extend({
  symbol: z.string().min(1).max(20).regex(/^[A-Z0-9._=^-]+$/),
  name: z.string().min(1).max(200),
  assetType: z.enum(["stock", "bond", "commodity", "crypto", "forex", "index"]),
  category: z.string().min(1).max(100),
  exchange: z.string().max(50).optional(),
  country: z.string().length(2).optional(), // ISO country code
  currency: z.string().length(3).optional(), // ISO currency code
  rank: z.number().min(1).max(1000).optional(),
});

export const insertHistoricalPricesSchema = createInsertSchema(historicalPrices).pick({
  symbol: true,
  assetType: true,
  timeframe: true,
  timestamp: true,
  open: true,
  high: true,
  low: true,
  close: true,
  volume: true,
  adjustedClose: true,
  dividendAmount: true,
}).extend({
  symbol: z.string().min(1).max(20),
  assetType: z.enum(["stock", "bond", "commodity", "crypto", "forex", "index"]),
  timeframe: z.enum(["1min", "5min", "15min", "1h", "1d", "1w", "1m"]),
  timestamp: z.date(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative().optional(),
});

export const insertDataIngestionJobSchema = createInsertSchema(dataIngestionJobs).pick({
  jobType: true,
  assetType: true,
  symbols: true,
  timeframe: true,
  startDate: true,
  endDate: true,
  status: true,
  metadata: true,
}).extend({
  jobType: z.enum(["historical_prices", "indicators", "universe_update"]),
  assetType: z.enum(["stock", "bond", "commodity", "crypto"]),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
  symbols: z.string().optional(), // JSON validation
});

// Session and authentication types
export type LoginCredentials = {
  username: string;
  password: string;
};

export type SignupCredentials = LoginCredentials & {
  email?: string;
  firstName?: string;
  lastName?: string;
};

export type AuthSession = {
  user: AuthUser;
  token?: string;
  expiresAt?: Date;
};

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlists.$inferSelect;
export type InsertPortfolioPosition = z.infer<typeof insertPortfolioPositionSchema>;
export type PortfolioPosition = typeof portfolioPositions.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type AlertSelect = typeof alerts.$inferSelect;

// Historical Data Types
export type InsertAssetUniverse = z.infer<typeof insertAssetUniverseSchema>;
export type AssetUniverse = typeof assetUniverse.$inferSelect;
export type InsertHistoricalPrices = z.infer<typeof insertHistoricalPricesSchema>;
export type HistoricalPrices = typeof historicalPrices.$inferSelect;
export type InsertDataIngestionJob = z.infer<typeof insertDataIngestionJobSchema>;
export type DataIngestionJob = typeof dataIngestionJobs.$inferSelect;
export type TechnicalIndicator = typeof technicalIndicators.$inferSelect;
export type AnalyticsResult = typeof analyticsResults.$inferSelect;

// Enhanced types for historical analysis
export type HistoricalDataPoint = {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
  dividendAmount?: number;
};

export type AssetPerformanceMetrics = {
  symbol: string;
  name: string;
  assetType: string;
  // Performance metrics
  totalReturn: number; // %
  annualizedReturn: number; // %
  volatility: number; // %
  sharpeRatio: number;
  maxDrawdown: number; // %
  // Risk metrics
  beta: number;
  alpha: number;
  informationRatio: number;
  // Technical indicators
  currentTrend: 'bullish' | 'bearish' | 'neutral';
  rsi: number;
  // Ranking
  performanceRank: number;
  riskAdjustedRank: number;
  lastUpdated: Date;
};

export type PredictionModel = {
  symbol: string;
  model: string; // "linear_regression" | "lstm" | "arima" | "ensemble"
  timeHorizon: "1d" | "7d" | "30d" | "90d";
  prediction: number;
  confidence: number; // 0-1
  supportingFactors: string[];
  riskFactors: string[];
  lastUpdated: Date;
};

export type MarketRegime = {
  period: Date;
  regime: 'bull_market' | 'bear_market' | 'sideways' | 'high_volatility';
  confidence: number;
  characteristics: {
    averageReturn: number;
    volatility: number;
    correlationStrength: number;
  };
};
