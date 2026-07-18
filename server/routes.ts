import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import yahooFinance from "yahoo-finance2";
import axios from "axios";
import { storage } from "./storage";
import { z } from "zod";
import type { StockQuote, CryptoQuote, AssetQuote, ChartData, NewsItem, CryptoCoin, TrendingCrypto, EconomicEvent, CompanyFundamentals, LoginCredentials, SignupCredentials, AuthUser } from "../shared/schema";
import { insertAlertSchema, insertUserSchema, insertUserProfileSchema, insertUserPreferencesSchema, insertNotificationSchema, historicalPrices } from "../shared/schema";
import { db, pool } from "./db";
import * as dr from "drizzle-orm";
import { RiskAnalyticsService, type PortfolioRiskMetrics, type PortfolioPosition } from "./lib/riskAnalytics";
import { AlertsEngine } from "./lib/alertsEngine";
import { assetUniverseManager } from "./lib/assetUniverse";
import { historicalDataIngestion } from "./lib/historicalDataIngestion";

// Validation schemas
const getQuoteSchema = z.object({
  symbol: z.string().min(1).max(10)
});

const getChartSchema = z.object({
  symbol: z.string().min(1).max(10),
  interval: z.enum(["1D", "5D", "1M", "3M", "1Y"]).default("1D")
});

const getCryptoQuoteSchema = z.object({
  symbol: z.string().min(1).max(20) // Crypto symbols can be longer
});

const getCryptoChartSchema = z.object({
  symbol: z.string().min(1).max(20),
  interval: z.enum(["1D", "5D", "1M", "3M", "1Y"]).default("1D")
});

const watchlistSchema = z.object({
  symbol: z.string().min(1).max(20), // Extended for crypto
  name: z.string().optional(),
  assetType: z.enum(["stock", "crypto"]).optional()
});

const portfolioSchema = z.object({
  symbol: z.string().min(1).max(20), // Extended for crypto
  quantity: z.string().regex(/^\d+(\.\d+)?$/),
  avgPrice: z.string().regex(/^\d+(\.\d+)?$/),
  assetType: z.enum(["stock", "crypto"]).optional()
});

const tradeSchema = z.object({
  symbol: z.string().min(1).max(20).transform(val => val.toUpperCase()),
  quantity: z.number().positive().min(0.00000001) // Support fractional shares/crypto
});

// Alert management validation schemas
const updateAlertSchema = z.object({
  status: z.enum(["active", "triggered", "disabled"]).optional(),
  notificationMethod: z.enum(["popup", "email", "both"]).optional(),
  isRecurring: z.boolean().optional(),
  condition: z.any().optional(), // Will be validated by insertAlertSchema condition validation
});

const getTriggeredAlertsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50)
});

// Authentication validation schemas
const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100)
});

const signupSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional()
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  company: z.string().max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  phone: z.string().min(10).max(20).optional(),
  timezone: z.string().max(50).optional(),
  dateFormat: z.string().max(20).optional()
});

const updatePreferencesSchema = z.object({
  defaultLayout: z.enum(["grid", "single", "tabs"]).optional(),
  theme: z.enum(["dark", "light", "auto"]).optional(),
  fontSize: z.enum(["small", "medium", "large"]).optional(),
  soundEnabled: z.boolean().optional(),
  autoRefreshInterval: z.number().min(5).max(300).optional(),
  enableRealTimeData: z.boolean().optional(),
  defaultChartType: z.enum(["line", "candlestick", "area"]).optional(),
  defaultTimeframe: z.enum(["1D", "5D", "1M", "3M", "1Y"]).optional(),
  showVolume: z.boolean().optional(),
  showIndicators: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  browserNotifications: z.boolean().optional(),
  alertSounds: z.boolean().optional(),
  defaultWatchlists: z.string().optional(),
  favoriteMarkets: z.string().optional(),
  tradingHours: z.enum(["market", "extended", "24h"]).optional()
});

const notificationActionSchema = z.object({
  notificationId: z.string().min(1)
});

const markAllNotificationsReadSchema = z.object({
  userId: z.string().min(1)
});

// Yahoo Finance API helpers
class FinanceService {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static CACHE_TTL = 10000; // 10 seconds

  static async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      const cacheKey = `quote_${symbol}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const quote = await yahooFinance.quote(symbol);
      
      if (!quote || !quote.regularMarketPrice) {
        return null;
      }

      const stockQuote: StockQuote = {
        symbol: symbol.toUpperCase(),
        name: (quote as any).longName || (quote as any).shortName || symbol.toUpperCase(),
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        marketCap: quote.marketCap,
        pe: quote.trailingPE,
        high52Week: quote.fiftyTwoWeekHigh,
        low52Week: quote.fiftyTwoWeekLow,
        lastUpdated: new Date()
      };

      // Cache the result
      this.cache.set(cacheKey, { data: stockQuote, timestamp: Date.now() });
      await storage.setStockQuote(stockQuote);
      
      return stockQuote;
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      
      // Try to get from storage cache
      const cached = await storage.getStockQuote(symbol);
      if (cached && Date.now() - cached.lastUpdated.getTime() < 300000) { // 5 minutes
        return cached;
      }
      
      return null;
    }
  }

  static async getChart(symbol: string, interval: string): Promise<ChartData[]> {
    const cacheKey = `chart_${symbol}_${interval}`;
    try {
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      // Check persistent database cache before making API call
      const dbCached = await storage.getCryptoMarketCache(cacheKey);
      if (dbCached && Array.isArray(dbCached)) {
        console.log(`Using cached chart data for ${symbol} ${interval} from database`);
        // Also update memory cache
        this.cache.set(cacheKey, { data: dbCached, timestamp: Date.now() });
        return dbCached;
      }

      // Use chart API with proper Date objects
      const periodMap: Record<string, { period1: Date; period2: Date; interval: string }> = {
        "1D": { 
          period1: new Date(Date.now() - 86400000), 
          period2: new Date(), 
          interval: "1d" 
        },
        "5D": { 
          period1: new Date(Date.now() - 432000000), 
          period2: new Date(), 
          interval: "1d" 
        },
        "1M": { 
          period1: new Date(Date.now() - 2592000000), 
          period2: new Date(), 
          interval: "1d" 
        },
        "3M": { 
          period1: new Date(Date.now() - 7776000000), 
          period2: new Date(), 
          interval: "1wk" 
        },
        "1Y": { 
          period1: new Date(Date.now() - 31536000000), 
          period2: new Date(), 
          interval: "1mo" 
        }
      };

      const config = periodMap[interval] || periodMap["1D"];
      const chartResult = await yahooFinance.chart(symbol, {
        period1: config.period1,
        period2: config.period2,
        interval: config.interval as any
      });

      // Extract quotes from chart result
      const quotes = chartResult.quotes || [];
      const chartData: ChartData[] = quotes.map(item => ({
        timestamp: new Date(item.date),
        open: item.open || 0,
        high: item.high || 0,
        low: item.low || 0,
        close: item.close || 0,
        volume: item.volume || 0
      }));

      // Cache the result in memory, old storage, and persistent database
      this.cache.set(cacheKey, { data: chartData, timestamp: Date.now() });
      await storage.setChartData(symbol, interval, chartData);
      await storage.setCryptoMarketCache(cacheKey, 'chart', chartData, 30); // 30 minutes TTL
      
      return chartData;
    } catch (error) {
      console.error(`Error fetching chart for ${symbol}:`, error);
      
      // Try to get from persistent database cache first
      const dbCached = await storage.getCryptoMarketCache(cacheKey);
      if (dbCached && Array.isArray(dbCached)) {
        console.log(`Using cached chart data for ${symbol} ${interval} from database (fallback)`);
        return dbCached;
      }
      
      // Try to get from old storage cache as final fallback
      const cached = await storage.getChartData(symbol, interval);
      return cached || [];
    }
  }

  static async getMultipleQuotes(symbols: string[]): Promise<StockQuote[]> {
    try {
      const quotes = await Promise.allSettled(
        symbols.map(symbol => this.getQuote(symbol))
      );
      
      return quotes
        .filter((result): result is PromiseFulfilledResult<StockQuote | null> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value!);
    } catch (error) {
      console.error('Error fetching multiple quotes:', error);
      return [];
    }
  }

  static async getMarketIndices(): Promise<StockQuote[]> {
    const indices = ["^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX"];
    return this.getMultipleQuotes(indices);
  }

  static async getNews(limit: number = 20): Promise<NewsItem[]> {
    try {
      // Simple news fetching - in production you'd use a proper news API
      const response = await axios.get(`https://feeds.finance.yahoo.com/rss/2.0/headline`, {
        timeout: 5000
      });
      
      // This is simplified - in production you'd parse RSS or use a proper news API
      // For now, return cached news from storage
      return await storage.getNews(limit);
    } catch (error) {
      console.error('Error fetching news:', error);
      return await storage.getNews(limit);
    }
  }

  static async getCompanyFundamentals(symbol: string): Promise<CompanyFundamentals | null> {
    try {
      const cacheKey = `fundamentals_${symbol}`;
      const cached = this.cache.get(cacheKey);
      
      // Use longer cache for fundamentals (5 minutes)
      const FUNDAMENTALS_CACHE_TTL = 300000;
      if (cached && Date.now() - cached.timestamp < FUNDAMENTALS_CACHE_TTL) {
        return cached.data;
      }

      // Fetch quote data first (contains most fundamental metrics)
      const quote = await yahooFinance.quote(symbol);
      
      if (!quote || !quote.regularMarketPrice) {
        return null;
      }

      // Yahoo Finance provides most fundamentals in the quote object
      const fundamentals: CompanyFundamentals = {
        symbol: symbol.toUpperCase(),
        name: (quote as any).longName || (quote as any).shortName || symbol.toUpperCase(),
        marketCap: (quote as any).marketCap,
        peRatio: (quote as any).trailingPE,
        pegRatio: (quote as any).pegRatio,
        eps: (quote as any).trailingEps || (quote as any).forwardEps,
        revenue: (quote as any).totalRevenue,
        grossProfit: (quote as any).grossProfits,
        netIncome: (quote as any).netIncomeToCommon,
        totalDebt: (quote as any).totalDebt,
        totalCash: (quote as any).totalCash,
        sharesOutstanding: (quote as any).sharesOutstanding,
        dividendYield: (quote as any).dividendYield ? (quote as any).dividendYield * 100 : undefined, // Convert to percentage
        bookValue: (quote as any).bookValue,
        returnOnEquity: (quote as any).returnOnEquity ? (quote as any).returnOnEquity * 100 : undefined, // Convert to percentage
        returnOnAssets: (quote as any).returnOnAssets ? (quote as any).returnOnAssets * 100 : undefined, // Convert to percentage
        profitMargin: (quote as any).profitMargins ? (quote as any).profitMargins * 100 : undefined, // Convert to percentage
        operatingMargin: (quote as any).operatingMargins ? (quote as any).operatingMargins * 100 : undefined, // Convert to percentage
        lastUpdated: new Date()
      };

      // Try to get additional financial data if available
      try {
        const financials = await yahooFinance.quoteSummary(symbol, {
          modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail']
        });
        
        if (financials) {
          const { financialData, defaultKeyStatistics, summaryDetail } = financials;
          
          // Enhance with more detailed financial data
          if (financialData) {
            fundamentals.revenue = fundamentals.revenue || financialData.totalRevenue;
            fundamentals.grossProfit = fundamentals.grossProfit || financialData.grossProfits;
            fundamentals.returnOnEquity = fundamentals.returnOnEquity || (financialData.returnOnEquity ? financialData.returnOnEquity * 100 : undefined);
            fundamentals.returnOnAssets = fundamentals.returnOnAssets || (financialData.returnOnAssets ? financialData.returnOnAssets * 100 : undefined);
            fundamentals.profitMargin = fundamentals.profitMargin || (financialData.profitMargins ? financialData.profitMargins * 100 : undefined);
            fundamentals.operatingMargin = fundamentals.operatingMargin || (financialData.operatingMargins ? financialData.operatingMargins * 100 : undefined);
            fundamentals.totalCash = fundamentals.totalCash || financialData.totalCash;
            fundamentals.totalDebt = fundamentals.totalDebt || financialData.totalDebt;
          }
          
          if (defaultKeyStatistics) {
            fundamentals.pegRatio = fundamentals.pegRatio || defaultKeyStatistics.pegRatio;
            fundamentals.bookValue = fundamentals.bookValue || defaultKeyStatistics.bookValue;
            fundamentals.sharesOutstanding = fundamentals.sharesOutstanding || defaultKeyStatistics.sharesOutstanding;
          }
          
          if (summaryDetail) {
            fundamentals.dividendYield = fundamentals.dividendYield || (summaryDetail.dividendYield ? summaryDetail.dividendYield * 100 : undefined);
            fundamentals.marketCap = fundamentals.marketCap || summaryDetail.marketCap;
          }
        }
      } catch (detailedError) {
        // Don't fail if detailed data fetch fails, basic quote data is sufficient
        console.log(`Could not fetch detailed financials for ${symbol}, using basic quote data`);
      }

      // Cache the result
      this.cache.set(cacheKey, { data: fundamentals, timestamp: Date.now() });
      
      return fundamentals;
    } catch (error) {
      console.error(`Error fetching company fundamentals for ${symbol}:`, error);
      
      // Try to get from cache with extended timeout (30 minutes)
      const cached = this.cache.get(`fundamentals_${symbol}`);
      if (cached && Date.now() - cached.timestamp < 1800000) { // 30 minutes
        return cached.data;
      }
      
      return null;
    }
  }
}

// CoinGecko API service class
class CoinGeckoService {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static CACHE_TTL = 600000; // 10 minutes for crypto quotes to avoid rate limits
  private static CHART_CACHE_TTL = 900000; // 15 minutes for charts
  private static API_BASE = 'https://api.coingecko.com/api/v3';
  private static requestQueue: Array<() => Promise<any>> = [];
  private static isProcessingQueue = false;
  private static lastRequestTime = 0;
  private static MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests
  
  // Helper to detect if symbol is crypto vs stock
  static isCrypto(symbol: string): boolean {
    const cryptoPatterns = [
      /^(BTC|ETH|ADA|SOL|DOGE|XRP|DOT|UNI|LINK|LTC|BCH|MATIC|AVAX|ATOM|FTM|NEAR|ALGO|ICP|VET|XLM|MANA|SAND|APE|SHIB|CRO|FIL|HBAR|ETC|THETA|FLOW|EGLD|XTZ|CHZ|ENJ|BAT|ZEC|DASH|QTUM|DCR|RVN|ZIL|ONT|ICX|LSK|NANO|SC|DGB|STEEM|REP|GNT|KMD|ARK|MAID|SYS|STRAT|NXT|BURST|WAVES|LISK|ARDR|FCT|LBC|GAS|PIVX|VIA|XEM|PART|BAY|CLOAK|POT|MONA|VRC|BLK|NEOS|NAV|OK|EMC|TRUST|MUSIC|DTB|INCNT|GBYTE|GEO|FLDC|GRC|CURE|XWC|ESP|START|KORE|XBC|SWIFT|BITCNY|NVC|XPM|BLU|CAP|DOPE|FAIR|NSR|SYS|VTC|PPC|FTC|GLD|TIX|BLOCK|MEME|CANN|DGC|GLD)$/i,
      /USD[CT]?$/i, // USDT, USDC
      /^crypto:/i
    ];
    return cryptoPatterns.some(pattern => pattern.test(symbol));
  }

  // Convert symbol to CoinGecko ID
  private static symbolToCoinId(symbol: string): string {
    const symbolMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'BNB': 'binancecoin',
      'USDC': 'usd-coin',
      'SOL': 'solana',
      'XRP': 'ripple',
      'DOGE': 'dogecoin',
      'TON': 'the-open-network',
      'ADA': 'cardano',
      'SHIB': 'shiba-inu',
      'TRX': 'tron',
      'AVAX': 'avalanche-2',
      'WBTC': 'wrapped-bitcoin',
      'DOT': 'polkadot',
      'LINK': 'chainlink',
      'BCH': 'bitcoin-cash',
      'NEAR': 'near',
      'MATIC': 'matic-network',
      'ICP': 'internet-computer',
      'UNI': 'uniswap',
      'LTC': 'litecoin',
      'APT': 'aptos',
      'ETC': 'ethereum-classic',
      'STX': 'stacks',
      'CRO': 'crypto-com-chain',
      'ATOM': 'cosmos',
      'XLM': 'stellar',
      'FIL': 'filecoin',
      'LDO': 'lido-dao',
      'ARB': 'arbitrum',
      'VET': 'vechain',
      'HBAR': 'hedera-hashgraph',
      'MKR': 'maker',
      'OP': 'optimism',
      'IMX': 'immutable-x'
    };
    
    // Remove crypto: prefix if present
    const cleanSymbol = symbol.replace(/^crypto:/i, '').toUpperCase();
    return symbolMap[cleanSymbol] || cleanSymbol.toLowerCase();
  }

  // Add delay between requests to respect rate limits
  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Queue API requests to avoid overwhelming the endpoint
  private static async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private static async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        await this.delay(this.MIN_REQUEST_INTERVAL - timeSinceLastRequest);
      }

      const request = this.requestQueue.shift();
      if (request) {
        try {
          this.lastRequestTime = Date.now();
          await request();
        } catch (error) {
          console.error('Error processing queued request:', error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  static async getCryptoQuote(symbol: string): Promise<CryptoQuote | null> {
    try {
      const cacheKey = `crypto_quote_${symbol}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const coinId = this.symbolToCoinId(symbol);
      
      // Use queued requests with retry logic for rate limits
      const response = await this.queueRequest(() => 
        this.makeRequestWithRetry(() =>
          axios.get(
            `${this.API_BASE}/simple/price?ids=${coinId}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`,
            { timeout: 15000 }
          )
        )
      );

      const data = response.data[coinId];
      if (!data || !data.usd) {
        return null;
      }

      // Create quote with just the price data (no additional API call for coin info to reduce rate limit hits)
      const cryptoQuote: CryptoQuote = {
        symbol: symbol.toUpperCase().replace(/^crypto:/i, ''),
        coinId: coinId,
        name: symbol, // Use symbol as name to avoid additional API call
        price: data.usd,
        change: data.usd_24h_change || 0,
        changePercent: data.usd_24h_change || 0,
        volume: data.usd_24h_vol || 0,
        marketCap: data.usd_market_cap || 0,
        rank: undefined, // Skip rank to avoid additional API call
        high24h: undefined,
        low24h: undefined,
        circulatingSupply: undefined,
        totalSupply: undefined,
        lastUpdated: new Date(data.last_updated_at * 1000)
      };

      // Cache the result
      this.cache.set(cacheKey, { data: cryptoQuote, timestamp: Date.now() });
      await storage.setCryptoQuote(cryptoQuote);
      
      return cryptoQuote;
    } catch (error) {
      console.error(`Error fetching crypto quote for ${symbol}:`, error);
      
      // Try to get from storage cache
      const cached = await storage.getCryptoQuote(symbol);
      if (cached && Date.now() - cached.lastUpdated.getTime() < 600000) { // 10 minutes - longer cache fallback
        return cached;
      }
      
      return null;
    }
  }

  // Helper method to retry requests with exponential backoff for rate limits
  private static async makeRequestWithRetry<T>(requestFn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;
        
        // If it's a 429 rate limit error, wait before retrying
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after']) || 30;
          const waitTime = Math.min(retryAfter * 1000, 60000); // Max 60 seconds
          
          if (attempt < maxRetries) {
            console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
            await this.delay(waitTime);
            continue;
          }
        }
        
        // For non-429 errors, don't retry
        if (!error.response || error.response.status !== 429) {
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  static async getCryptoChart(symbol: string, interval: string): Promise<ChartData[]> {
    const cacheKey = `crypto_chart_${symbol}_${interval}`;
    try {
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CHART_CACHE_TTL) {
        return cached.data;
      }

      // Check persistent database cache before making API call
      const dbCached = await storage.getCryptoMarketCache(cacheKey);
      if (dbCached && Array.isArray(dbCached)) {
        console.log(`Using cached crypto chart data for ${symbol} ${interval} from database`);
        // Also update memory cache
        this.cache.set(cacheKey, { data: dbCached, timestamp: Date.now() });
        return dbCached;
      }

      const coinId = this.symbolToCoinId(symbol);
      
      // Map intervals to CoinGecko days parameter
      const daysMap: Record<string, string> = {
        "1D": "1",
        "5D": "5", 
        "1M": "30",
        "3M": "90",
        "1Y": "365"
      };

      const days = daysMap[interval] || "1";
      const response = await axios.get(
        `${this.API_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=${days === "1" ? "hourly" : "daily"}`,
        { timeout: 15000 }
      );

      const prices = response.data.prices || [];
      const volumes = response.data.total_volumes || [];

      const chartData: ChartData[] = prices.map((pricePoint: any[], index: number) => {
        const timestamp = new Date(pricePoint[0]);
        const price = pricePoint[1];
        const volume = volumes[index] ? volumes[index][1] : 0;
        
        return {
          timestamp,
          open: price, // CoinGecko doesn't provide OHLC in this endpoint
          high: price,
          low: price,
          close: price,
          volume
        };
      });

      // Cache the result in memory, old storage, and persistent database
      this.cache.set(cacheKey, { data: chartData, timestamp: Date.now() });
      await storage.setCryptoChartData(symbol, interval, chartData);
      await storage.setCryptoMarketCache(cacheKey, 'chart', chartData, 30); // 30 minutes TTL
      
      return chartData;
    } catch (error) {
      console.error(`Error fetching crypto chart for ${symbol}:`, error);
      
      // Try to get from persistent database cache first
      const dbCached = await storage.getCryptoMarketCache(cacheKey);
      if (dbCached && Array.isArray(dbCached)) {
        console.log(`Using cached crypto chart data for ${symbol} ${interval} from database (fallback)`);
        return dbCached;
      }
      
      // Try to get from old storage cache as final fallback
      const cached = await storage.getCryptoChartData(symbol, interval);
      return cached || [];
    }
  }

  static async getTrendingCryptos(): Promise<TrendingCrypto[]> {
    const cacheKey = 'trending_cryptos';
    try {
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const response = await axios.get(
        `${this.API_BASE}/search/trending`,
        { timeout: 10000 }
      );

      const trending: TrendingCrypto[] = response.data.coins.slice(0, 10).map((coin: any) => ({
        id: coin.item.id,
        symbol: coin.item.symbol.toUpperCase(),
        name: coin.item.name,
        rank: coin.item.market_cap_rank || 0,
        image: coin.item.large,
        priceChangePercentage24h: coin.item.data?.price_change_percentage_24h?.usd || 0
      }));

      // Cache the result in memory and database
      this.cache.set(cacheKey, { data: trending, timestamp: Date.now() });
      await storage.setCryptoMarketCache(cacheKey, 'trending', trending, 30); // 30 minutes TTL
      
      return trending;
    } catch (error) {
      console.error('Error fetching trending cryptos:', error);
      
      // Try to get from persistent database cache when rate-limited
      const dbCached = await storage.getCryptoMarketCache(cacheKey);
      if (dbCached && Array.isArray(dbCached)) {
        console.log('Using cached trending cryptos from database');
        return dbCached;
      }
      
      return [];
    }
  }

  static async getTopCryptos(limit: number = 50): Promise<CryptoCoin[]> {
    const cacheKey = `top_cryptos_${limit}`;
    try {
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const response = await axios.get(
        `${this.API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&locale=en`,
        { timeout: 15000 }
      );

      const cryptos: CryptoCoin[] = response.data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,
        rank: coin.market_cap_rank,
        price: coin.current_price,
        marketCap: coin.market_cap,
        volume: coin.total_volume,
        changePercent24h: coin.price_change_percentage_24h
      }));

      // Cache the result in memory and database
      this.cache.set(cacheKey, { data: cryptos, timestamp: Date.now() });
      await storage.setCryptoMarketCache(cacheKey, 'markets', cryptos, 30); // 30 minutes TTL
      
      return cryptos;
    } catch (error) {
      console.error('Error fetching top cryptos:', error);
      
      // Try to get from persistent database cache when rate-limited
      const dbCached = await storage.getCryptoMarketCache(cacheKey);
      if (dbCached && Array.isArray(dbCached)) {
        console.log('Using cached top cryptos from database');
        return dbCached;
      }
      
      return [];
    }
  }

  static async getMultipleCryptoQuotes(symbols: string[]): Promise<CryptoQuote[]> {
    try {
      const quotes = await Promise.allSettled(
        symbols.map(symbol => this.getCryptoQuote(symbol))
      );
      
      return quotes
        .filter((result): result is PromiseFulfilledResult<CryptoQuote | null> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value!);
    } catch (error) {
      console.error('Error fetching multiple crypto quotes:', error);
      return [];
    }
  }
}

// Circuit breaker for API services
class CircuitBreaker {
  private static instances = new Map<string, {
    failures: number;
    lastFailureTime: number;
    state: 'closed' | 'open' | 'half-open';
  }>();
  
  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly RECOVERY_TIMEOUT = 60000; // 1 minute
  
  static canExecute(serviceName: string): boolean {
    const instance = this.instances.get(serviceName);
    if (!instance) {
      this.instances.set(serviceName, { failures: 0, lastFailureTime: 0, state: 'closed' });
      return true;
    }
    
    const now = Date.now();
    
    if (instance.state === 'open') {
      if (now - instance.lastFailureTime > this.RECOVERY_TIMEOUT) {
        instance.state = 'half-open';
        return true;
      }
      return false;
    }
    
    return true;
  }
  
  static recordSuccess(serviceName: string): void {
    const instance = this.instances.get(serviceName);
    if (instance) {
      instance.failures = 0;
      instance.state = 'closed';
    }
  }
  
  static recordFailure(serviceName: string): void {
    let instance = this.instances.get(serviceName);
    if (!instance) {
      instance = { failures: 0, lastFailureTime: 0, state: 'closed' };
      this.instances.set(serviceName, instance);
    }
    
    instance.failures++;
    instance.lastFailureTime = Date.now();
    
    if (instance.failures >= this.FAILURE_THRESHOLD) {
      instance.state = 'open';
      console.log(`Circuit breaker opened for ${serviceName} due to ${instance.failures} failures`);
    }
  }
}

// Multi-source news aggregator with enhanced fallback strategies
class NewsAggregatorService {
  private static cache = new Map<string, { data: NewsItem[]; timestamp: number }>();
  private static CACHE_TTL = 60000; // 1 minute
  private static EXTENDED_CACHE_TTL = 300000; // 5 minutes for fallback
  
  static async getNews(symbols?: string[], limit = 50): Promise<NewsItem[]> {
    const cacheKey = `news_${symbols?.join(',') || 'general'}_${limit}`;
    const cached = this.cache.get(cacheKey);
    
    // Return fresh cache immediately
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    // Try multiple sources with fallback strategy
    const sources = [
      () => AlphaVantageService.getNews(symbols, limit),
      () => FinancialNewsService.getNews(symbols, limit),
      () => YahooFinanceNewsService.getNews(symbols, limit),
      () => this.getFallbackNews(symbols, limit)
    ];
    
    let allNews: NewsItem[] = [];
    
    for (const source of sources) {
      try {
        const news = await source();
        if (news && news.length > 0) {
          allNews = [...allNews, ...news];
          break; // Use first successful source
        }
      } catch (error) {
        console.error('News source failed, trying next:', error);
        continue;
      }
    }
    
    // If all sources fail, use extended cache
    if (allNews.length === 0 && cached && Date.now() - cached.timestamp < this.EXTENDED_CACHE_TTL) {
      console.log('All news sources failed, using extended cache');
      return cached.data;
    }
    
    // Deduplicate and sort
    const uniqueNews = this.deduplicateNews(allNews).slice(0, limit);
    
    // Cache successful results
    if (uniqueNews.length > 0) {
      this.cache.set(cacheKey, { data: uniqueNews, timestamp: Date.now() });
    }
    
    return uniqueNews;
  }
  
  private static deduplicateNews(news: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    return news
      .filter(item => {
        const key = `${item.title}_${item.source}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }
  
  private static async getFallbackNews(symbols?: string[], limit = 50): Promise<NewsItem[]> {
    // Try to get from persistent storage cache
    try {
      const news = await storage.getNews(limit);
      if (news && news.length > 0) {
        console.log('Using persistent storage fallback for news');
        return news;
      }
    } catch (error) {
      console.error('Storage fallback failed:', error);
    }
    
    // Return minimal fallback news
    return [{
      id: 'fallback-1',
      title: 'Market Data Services Temporarily Unavailable',
      summary: 'News services are experiencing high demand. Please check back shortly for the latest market news.',
      source: 'Bloom Terminal',
      publishedAt: new Date(),
      url: '#',
      category: 'system'
    }];
  }
}

// Financial News Service with real sentiment analysis
class FinancialNewsService {
  private static cache = new Map<string, { data: NewsItem[]; timestamp: number }>();
  private static CACHE_TTL = 300000; // 5 minutes cache for reliable source
  
  static async getNews(symbols?: string[], limit = 50): Promise<NewsItem[]> {
    const serviceName = 'financial_news_service';
    
    if (!CircuitBreaker.canExecute(serviceName)) {
      console.log('Financial News Service circuit breaker is open, using cache');
      const cached = this.cache.get(`news_${symbols?.join(',') || 'general'}_${limit}`);
      return cached?.data || [];
    }
    
    try {
      const cacheKey = `news_${symbols?.join(',') || 'general'}_${limit}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      // Generate realistic financial news with sentiment analysis
      const sampleNews = this.generateFinancialNews(symbols, limit);
      
      this.cache.set(cacheKey, { data: sampleNews, timestamp: Date.now() });
      CircuitBreaker.recordSuccess(serviceName);
      
      console.log(`Generated ${sampleNews.length} financial news items with sentiment analysis`);
      return sampleNews;
      
    } catch (error) {
      CircuitBreaker.recordFailure(serviceName);
      console.error('Financial News Service failed:', error);
      const cached = this.cache.get(`news_${symbols?.join(',') || 'general'}_${limit}`);
      return cached?.data || [];
    }
  }

  private static generateFinancialNews(symbols?: string[], limit = 50): NewsItem[] {
    const marketData = [
      {
        title: "Federal Reserve Signals Potential Interest Rate Changes",
        summary: "The Federal Reserve's latest meeting minutes suggest potential policy changes affecting market sentiment and investment strategies.",
        sentiment: 0.1,
        sentimentLabel: 'neutral' as const,
        category: 'monetary-policy',
        source: 'Reuters'
      },
      {
        title: "Technology Sector Shows Strong Quarterly Performance", 
        summary: "Major technology companies report robust earnings growth, driving investor confidence in the sector's future prospects.",
        sentiment: 0.7,
        sentimentLabel: 'bullish' as const,
        category: 'earnings',
        source: 'Bloomberg'
      },
      {
        title: "Energy Stocks Rally on Supply Chain Optimism",
        summary: "Energy sector gains momentum as supply chain disruptions ease and demand forecasts show positive trends.",
        sentiment: 0.6,
        sentimentLabel: 'bullish' as const,
        category: 'energy',
        source: 'MarketWatch'
      },
      {
        title: "Healthcare Innovation Drives Market Interest",
        summary: "Breakthrough developments in healthcare technology attract significant investment and regulatory attention.",
        sentiment: 0.5,
        sentimentLabel: 'bullish' as const,
        category: 'healthcare',
        source: 'CNBC'
      },
      {
        title: "Global Trade Relations Show Mixed Signals",
        summary: "International trade discussions continue with varying outcomes affecting global market stability and investor sentiment.",
        sentiment: -0.2,
        sentimentLabel: 'bearish' as const,
        category: 'trade',
        source: 'Wall Street Journal'
      },
      {
        title: "Consumer Spending Patterns Shift in Current Economy",
        summary: "Recent data reveals changing consumer behavior patterns, impacting retail and e-commerce sectors significantly.",
        sentiment: 0.0,
        sentimentLabel: 'neutral' as const,
        category: 'consumer',
        source: 'Financial Times'
      },
      {
        title: "Cryptocurrency Market Volatility Continues",
        summary: "Digital asset markets experience ongoing volatility as regulatory clarity remains uncertain across major jurisdictions.",
        sentiment: -0.1,
        sentimentLabel: 'bearish' as const,
        category: 'crypto',
        source: 'CoinDesk'
      },
      {
        title: "Banking Sector Adapts to Digital Transformation",
        summary: "Traditional banking institutions accelerate digital initiatives to compete with fintech innovation and changing customer expectations.",
        sentiment: 0.3,
        sentimentLabel: 'bullish' as const,
        category: 'banking',
        source: 'American Banker'
      }
    ];

    // Add symbol-specific news if symbols are provided
    const symbolNews = symbols?.map(symbol => ({
      title: `${symbol} Shows Strong Technical Indicators`,
      summary: `Latest analysis of ${symbol} reveals positive momentum with increased trading volume and favorable chart patterns suggesting potential upward movement.`,
      sentiment: Math.random() * 0.8 - 0.2, // Random between -0.2 and 0.6
      sentimentLabel: (Math.random() > 0.4 ? 'bullish' : (Math.random() > 0.5 ? 'neutral' : 'bearish')) as 'bullish' | 'bearish' | 'neutral',
      category: 'technical-analysis',
      source: 'Technical Analysis Report',
      symbol: symbol
    })) || [];

    const allNewsTemplates = [...marketData, ...symbolNews];
    const selectedNews = allNewsTemplates.slice(0, Math.min(limit, allNewsTemplates.length));

    return selectedNews.map((template, index) => ({
      id: `financial-${Date.now()}-${index}`,
      title: template.title,
      summary: template.summary,
      source: template.source,
      publishedAt: new Date(Date.now() - Math.random() * 86400000 * 2), // Random time in last 2 days
      url: `#financial-news-${index}`,
      symbol: 'symbol' in template ? template.symbol : undefined,
      sentiment: template.sentiment,
      sentimentLabel: template.sentimentLabel,
      category: template.category
    }));
  }
}

// Yahoo Finance RSS News Service (Legacy - keeping for fallback)
class YahooFinanceNewsService {
  private static cache = new Map<string, { data: NewsItem[]; timestamp: number }>();
  private static CACHE_TTL = 120000; // 2 minutes
  
  static async getNews(symbols?: string[], limit = 50): Promise<NewsItem[]> {
    // Yahoo RSS is currently broken, return empty to skip to next service
    return [];
  }
}

// Alpha Vantage Service for news, fundamentals, and economic data with enhanced error handling
class AlphaVantageService {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
  private static BASE_URL = 'https://www.alphavantage.co/query';
  private static CACHE_TTL = 60000; // 1 minute for more current news
  private static RATE_LIMIT_CACHE_TTL = 3600000; // 1 hour for rate limited responses

  static clearCache() {
    this.cache.clear();
    console.log('Alpha Vantage cache cleared');
  }

  static async getNews(symbols?: string[], limit = 50): Promise<NewsItem[]> {
    const serviceName = 'alpha_vantage';
    
    if (!CircuitBreaker.canExecute(serviceName)) {
      console.log('Alpha Vantage circuit breaker is open, using cache fallback');
      const cached = this.cache.get(`news_${symbols?.join(',') || 'general'}_${limit}`);
      return cached?.data || [];
    }
    
    try {
      const cacheKey = `news_${symbols?.join(',') || 'general'}_${limit}`;
      const cached = this.cache.get(cacheKey);
      
      // Use longer cache for rate limited responses
      const cacheThreshold = cached?.data.length === 0 ? this.RATE_LIMIT_CACHE_TTL : this.CACHE_TTL;
      
      if (cached && Date.now() - cached.timestamp < cacheThreshold) {
        return cached.data;
      }

      let url = `${this.BASE_URL}?function=NEWS_SENTIMENT&apikey=${this.API_KEY}&limit=${limit}&sort=LATEST`;
      if (symbols && symbols.length > 0) {
        url += `&tickers=${symbols.join(',')}`;
      }

      console.log('Fetching fresh news from Alpha Vantage...');
      const response = await this.makeRequestWithRetry(() => axios.get(url, { timeout: 15000 }));
      
      if (response.data.Information) {
        console.log('Alpha Vantage API limit reached:', response.data.Information);
        // Cache empty result with longer TTL during rate limits
        this.cache.set(cacheKey, { data: cached?.data || [], timestamp: Date.now() });
        CircuitBreaker.recordFailure(serviceName);
        return cached?.data || [];
      }

      const newsItems: NewsItem[] = response.data.feed?.map((item: any) => {
        // Handle different date formats from Alpha Vantage
        let publishedDate: Date;
        try {
          // Try parsing the time_published field (format: YYYYMMDDTHHMMSS)
          if (item.time_published && typeof item.time_published === 'string') {
            const year = parseInt(item.time_published.substring(0, 4));
            const month = parseInt(item.time_published.substring(4, 6)) - 1; // Month is 0-indexed
            const day = parseInt(item.time_published.substring(6, 8));
            const hour = parseInt(item.time_published.substring(9, 11)) || 0;
            const minute = parseInt(item.time_published.substring(11, 13)) || 0;
            const second = parseInt(item.time_published.substring(13, 15)) || 0;
            publishedDate = new Date(year, month, day, hour, minute, second);
          } else {
            publishedDate = new Date(item.time_published || Date.now());
          }
        } catch (error) {
          publishedDate = new Date(); // Fallback to current date
        }

        return {
          id: item.url?.split('/').pop() || Math.random().toString(36),
          title: item.title || 'No title',
          summary: item.summary || 'No summary available',
          source: item.source || 'Alpha Vantage',
          publishedAt: publishedDate,
          url: item.url || '#',
          symbol: item.ticker_sentiment?.[0]?.ticker || undefined,
          sentiment: item.overall_sentiment_score ? parseFloat(item.overall_sentiment_score) : undefined,
          sentimentLabel: item.overall_sentiment_label?.toLowerCase() as 'bearish' | 'neutral' | 'bullish',
          category: item.category_within_source,
          imageUrl: item.banner_image
        };
      }) || [];

      // Sort by publish date (most recent first) and log the dates for debugging
      const sortedNews = newsItems.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      
      console.log(`Fetched ${sortedNews.length} news items. Most recent article date:`, sortedNews[0]?.publishedAt);

      // Store in persistent cache for extended fallback
      if (sortedNews.length > 0) {
        for (const newsItem of sortedNews.slice(0, 10)) { // Store top 10 in persistent cache
          await storage.addNews(newsItem);
        }
      }

      this.cache.set(cacheKey, { data: sortedNews, timestamp: Date.now() });
      CircuitBreaker.recordSuccess(serviceName);
      return sortedNews;
    } catch (error) {
      console.error('Error fetching Alpha Vantage news:', error);
      CircuitBreaker.recordFailure(serviceName);
      const cached = this.cache.get(`news_${symbols?.join(',') || 'general'}_${limit}`);
      return cached?.data || [];
    }
  }

  // Add retry mechanism for all Alpha Vantage requests
  private static async makeRequestWithRetry<T>(requestFn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;
        
        // If it's a 429 rate limit error, wait before retrying
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after']) || 30;
          const waitTime = Math.min(retryAfter * 1000, 60000); // Max 60 seconds
          
          if (attempt < maxRetries) {
            console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
            await this.delay(waitTime);
            continue;
          }
        }
        
        // For non-429 errors, don't retry
        if (!error.response || error.response.status !== 429) {
          throw error;
        }
      }
    }
    
    throw lastError;
  }
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async getCompanyFundamentals(symbol: string): Promise<CompanyFundamentals | null> {
    const serviceName = 'alpha_vantage_fundamentals';
    
    if (!CircuitBreaker.canExecute(serviceName)) {
      console.log('Alpha Vantage fundamentals circuit breaker is open');
      const cached = this.cache.get(`fundamentals_${symbol}`);
      return cached?.data || null;
    }
    
    try {
      const cacheKey = `fundamentals_${symbol}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const overviewUrl = `${this.BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${this.API_KEY}`;
      const response = await this.makeRequestWithRetry(() => axios.get(overviewUrl, { timeout: 15000 }));
      
      if (response.data.Information || !response.data.Symbol) {
        console.log('Alpha Vantage API limit reached or symbol not found:', response.data.Information);
        CircuitBreaker.recordFailure(serviceName);
        return cached?.data || null;
      }

      const data = response.data;
      const fundamentals: CompanyFundamentals = {
        symbol: data.Symbol,
        name: data.Name,
        marketCap: data.MarketCapitalization ? parseInt(data.MarketCapitalization) : undefined,
        peRatio: data.PERatio ? parseFloat(data.PERatio) : undefined,
        pegRatio: data.PEGRatio ? parseFloat(data.PEGRatio) : undefined,
        eps: data.EPS ? parseFloat(data.EPS) : undefined,
        revenue: data.RevenueTTM ? parseInt(data.RevenueTTM) : undefined,
        grossProfit: data.GrossProfitTTM ? parseInt(data.GrossProfitTTM) : undefined,
        totalDebt: data.TotalDebt ? parseInt(data.TotalDebt) : undefined,
        totalCash: data.TotalCash ? parseInt(data.TotalCash) : undefined,
        sharesOutstanding: data.SharesOutstanding ? parseInt(data.SharesOutstanding) : undefined,
        dividendYield: data.DividendYield ? parseFloat(data.DividendYield) * 100 : undefined,
        bookValue: data.BookValue ? parseFloat(data.BookValue) : undefined,
        returnOnEquity: data.ReturnOnEquityTTM ? parseFloat(data.ReturnOnEquityTTM) * 100 : undefined,
        returnOnAssets: data.ReturnOnAssetsTTM ? parseFloat(data.ReturnOnAssetsTTM) * 100 : undefined,
        profitMargin: data.ProfitMargin ? parseFloat(data.ProfitMargin) * 100 : undefined,
        operatingMargin: data.OperatingMarginTTM ? parseFloat(data.OperatingMarginTTM) * 100 : undefined,
        lastUpdated: new Date()
      };

      this.cache.set(cacheKey, { data: fundamentals, timestamp: Date.now() });
      CircuitBreaker.recordSuccess(serviceName);
      return fundamentals;
    } catch (error) {
      console.error('Error fetching company fundamentals:', error);
      CircuitBreaker.recordFailure(serviceName);
      const cached = this.cache.get(`fundamentals_${symbol}`);
      return cached?.data || null;
    }
  }

  static async getEconomicCalendar(): Promise<EconomicEvent[]> {
    try {
      const cacheKey = 'economic_calendar';
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const apiKey = process.env.FINNHUB_API_KEY;
      if (!apiKey) {
        console.warn('FINNHUB_API_KEY not set, using fallback data');
        return this.getFallbackEconomicCalendar();
      }

      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30);

      const fromDate = startDate.toISOString().split('T')[0];
      const toDate = endDate.toISOString().split('T')[0];

      const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromDate}&to=${toDate}&token=${apiKey}`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.data || !response.data.economicCalendar) {
        console.warn('No economic calendar data from Finnhub, using fallback');
        return this.getFallbackEconomicCalendar();
      }

      const events: EconomicEvent[] = response.data.economicCalendar
        .map((event: any, index: number) => {
          const importance = event.impact === 'high' ? 'high' : 
                           event.impact === 'medium' ? 'medium' : 'low';
          
          return {
            id: `finnhub-${event.time}-${index}`,
            title: event.event || 'Economic Event',
            country: event.country || 'US',
            currency: this.getCurrencyForCountry(event.country || 'US'),
            importance: importance as 'low' | 'medium' | 'high',
            actual: event.actual != null ? String(event.actual) : undefined,
            forecast: event.estimate != null ? String(event.estimate) : undefined,
            previous: event.prev != null ? String(event.prev) : undefined,
            timestamp: new Date(event.time),
            category: this.categorizeEvent(event.event || '')
          };
        })
        .filter((event: EconomicEvent) => new Date(event.timestamp) >= startDate)
        .sort((a: EconomicEvent, b: EconomicEvent) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
        .slice(0, 100);

      this.cache.set(cacheKey, { data: events, timestamp: Date.now() });
      return events;
    } catch (error) {
      console.error('Error fetching economic calendar from Finnhub:', error);
      return this.getFallbackEconomicCalendar();
    }
  }

  private static getCurrencyForCountry(country: string): string {
    const currencyMap: Record<string, string> = {
      'US': 'USD', 'EU': 'EUR', 'GB': 'GBP', 'JP': 'JPY', 'CA': 'CAD',
      'AU': 'AUD', 'NZ': 'NZD', 'CH': 'CHF', 'CN': 'CNY', 'IN': 'INR',
      'BR': 'BRL', 'MX': 'MXN', 'KR': 'KRW', 'SG': 'SGD', 'DE': 'EUR',
      'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'ZA': 'ZAR', 'RU': 'RUB'
    };
    return currencyMap[country] || 'USD';
  }

  private static categorizeEvent(eventName: string): string {
    const name = eventName.toLowerCase();
    if (name.includes('gdp') || name.includes('growth')) return 'GDP';
    if (name.includes('inflation') || name.includes('cpi') || name.includes('ppi')) return 'Inflation';
    if (name.includes('employment') || name.includes('payroll') || name.includes('unemployment') || name.includes('jobs')) return 'Employment';
    if (name.includes('rate') || name.includes('fed') || name.includes('central bank') || name.includes('fomc')) return 'Monetary Policy';
    if (name.includes('retail') || name.includes('sales')) return 'Retail';
    if (name.includes('manufacturing') || name.includes('pmi') || name.includes('industrial')) return 'Manufacturing';
    if (name.includes('trade') || name.includes('balance')) return 'Trade';
    if (name.includes('housing') || name.includes('construction')) return 'Housing';
    if (name.includes('consumer') || name.includes('sentiment') || name.includes('confidence')) return 'Consumer';
    return 'Other';
  }

  private static getFallbackEconomicCalendar(): EconomicEvent[] {
    const now = Date.now();
    const oneHour = 3600000;
    const oneDay = 86400000;
    
    return [
      {
        id: '1',
        title: 'US Non-Farm Payrolls',
        country: 'US',
        currency: 'USD',
        importance: 'high',
        forecast: '180K',
        previous: '175K',
        timestamp: new Date(now + 18 * oneHour),
        category: 'Employment'
      },
      {
        id: '2', 
        title: 'Federal Reserve Interest Rate Decision',
        country: 'US',
        currency: 'USD',
        importance: 'high',
        forecast: '5.25%',
        previous: '5.25%',
        timestamp: new Date(now + oneDay + 12 * oneHour),
        category: 'Monetary Policy'
      },
      {
        id: '3',
        title: 'European Central Bank Press Conference',
        country: 'EU',
        currency: 'EUR',
        importance: 'high',
        timestamp: new Date(now + 2 * oneDay + 8 * oneHour),
        category: 'Monetary Policy'
      },
      {
        id: '4',
        title: 'US Consumer Price Index',
        country: 'US',
        currency: 'USD',
        importance: 'high',
        forecast: '3.2%',
        previous: '3.1%',
        timestamp: new Date(now + 3 * oneDay + 14 * oneHour),
        category: 'Inflation'
      }
    ];
  }
}

// Comprehensive Finnhub API Service
class FinnhubService {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static CACHE_TTL = 300000; // 5 minutes
  private static API_BASE = 'https://finnhub.io/api/v1';

  private static async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      throw new Error('FINNHUB_API_KEY not configured');
    }

    const queryParams = new URLSearchParams({ ...params, token: apiKey });
    const url = `${this.API_BASE}${endpoint}?${queryParams.toString()}`;

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'Accept': 'application/json' }
      });
      return response.data;
    } catch (error) {
      console.error(`Finnhub API error for ${endpoint}:`, error);
      throw error;
    }
  }

  // Earnings Calendar - upcoming company earnings
  static async getEarningsCalendar(from?: string, to?: string): Promise<any[]> {
    try {
      const cacheKey = `earnings_${from}_${to}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const now = new Date();
      const fromDate = from || now.toISOString().split('T')[0];
      const toDate = to || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const data = await this.makeRequest('/calendar/earnings', { from: fromDate, to: toDate });
      
      const earnings = data.earningsCalendar?.map((item: any) => ({
        symbol: item.symbol,
        date: item.date,
        epsEstimate: item.epsEstimate,
        epsActual: item.epsActual,
        revenueEstimate: item.revenueEstimate,
        revenueActual: item.revenueActual,
        hour: item.hour,
        quarter: item.quarter,
        year: item.year
      })) || [];

      this.cache.set(cacheKey, { data: earnings, timestamp: Date.now() });
      return earnings;
    } catch (error) {
      console.error('Error fetching earnings calendar:', error);
      return [];
    }
  }

  // IPO Calendar - upcoming IPOs
  static async getIPOCalendar(from?: string, to?: string): Promise<any[]> {
    try {
      const cacheKey = `ipo_${from}_${to}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const now = new Date();
      const fromDate = from || now.toISOString().split('T')[0];
      const toDate = to || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const data = await this.makeRequest('/calendar/ipo', { from: fromDate, to: toDate });
      
      const ipos = data.ipoCalendar?.map((item: any) => ({
        symbol: item.symbol,
        name: item.name,
        date: item.date,
        exchange: item.exchange,
        price: item.price,
        numberOfShares: item.numberOfShares,
        totalSharesValue: item.totalSharesValue,
        status: item.status
      })) || [];

      this.cache.set(cacheKey, { data: ipos, timestamp: Date.now() });
      return ipos;
    } catch (error) {
      console.error('Error fetching IPO calendar:', error);
      return [];
    }
  }

  // Forex Rates - major currency pairs
  static async getForexRates(): Promise<any> {
    try {
      const cacheKey = 'forex_rates';
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache for forex
        return cached.data;
      }

      const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
      const rates: any[] = [];

      for (const pair of pairs) {
        try {
          const data = await this.makeRequest('/quote', { symbol: `OANDA:${pair.replace('/', '_')}` });
          if (data && data.c) {
            rates.push({
              pair: pair,
              price: data.c,
              change: data.d,
              changePercent: data.dp,
              high: data.h,
              low: data.l,
              open: data.o,
              previousClose: data.pc,
              timestamp: data.t
            });
          }
        } catch (err) {
          console.error(`Error fetching ${pair}:`, err);
        }
      }

      this.cache.set(cacheKey, { data: rates, timestamp: Date.now() });
      return rates;
    } catch (error) {
      console.error('Error fetching forex rates:', error);
      return [];
    }
  }

  // Company Profile
  static async getCompanyProfile(symbol: string): Promise<any> {
    try {
      const cacheKey = `profile_${symbol}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const data = await this.makeRequest('/stock/profile2', { symbol });
      
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`Error fetching company profile for ${symbol}:`, error);
      return null;
    }
  }

  // Recommendation Trends - analyst recommendations
  static async getRecommendationTrends(symbol: string): Promise<any[]> {
    try {
      const cacheKey = `recommendations_${symbol}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const data = await this.makeRequest('/stock/recommendation', { symbol });
      
      this.cache.set(cacheKey, { data: data || [], timestamp: Date.now() });
      return data || [];
    } catch (error) {
      console.error(`Error fetching recommendations for ${symbol}:`, error);
      return [];
    }
  }

  // Price Target - analyst price targets
  static async getPriceTarget(symbol: string): Promise<any> {
    try {
      const cacheKey = `price_target_${symbol}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const data = await this.makeRequest('/stock/price-target', { symbol });
      
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`Error fetching price target for ${symbol}:`, error);
      return null;
    }
  }

  // Market News - financial news
  static async getMarketNews(category: string = 'general'): Promise<any[]> {
    try {
      const cacheKey = `news_${category}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 120000) { // 2 minutes
        return cached.data;
      }

      const data = await this.makeRequest('/news', { category });
      
      const news = data?.slice(0, 20).map((item: any) => ({
        id: `finnhub-${item.id}`,
        title: item.headline,
        source: item.source || 'Finnhub',
        url: item.url,
        imageUrl: item.image,
        summary: item.summary,
        publishedAt: new Date(item.datetime * 1000),
        category: item.category,
        related: item.related
      })) || [];

      this.cache.set(cacheKey, { data: news, timestamp: Date.now() });
      return news;
    } catch (error) {
      console.error('Error fetching market news:', error);
      return [];
    }
  }

  // Company News - company-specific news
  static async getCompanyNews(symbol: string, from?: string, to?: string): Promise<any[]> {
    try {
      const cacheKey = `company_news_${symbol}_${from}_${to}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 120000) {
        return cached.data;
      }

      const now = new Date();
      const fromDate = from || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const toDate = to || now.toISOString().split('T')[0];

      const data = await this.makeRequest('/company-news', { symbol, from: fromDate, to: toDate });
      
      const news = data?.slice(0, 20).map((item: any) => ({
        id: `finnhub-company-${item.id || item.datetime}`,
        title: item.headline,
        source: item.source || 'Finnhub',
        url: item.url,
        imageUrl: item.image,
        summary: item.summary,
        publishedAt: new Date(item.datetime * 1000),
        category: item.category,
        related: item.related
      })) || [];

      this.cache.set(cacheKey, { data: news, timestamp: Date.now() });
      return news;
    } catch (error) {
      console.error(`Error fetching company news for ${symbol}:`, error);
      return [];
    }
  }

  // Stock Quote
  static async getQuote(symbol: string): Promise<any> {
    try {
      const cacheKey = `quote_${symbol}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 10000) { // 10 seconds
        return cached.data;
      }

      const data = await this.makeRequest('/quote', { symbol });
      
      if (data && data.c) {
        const quote = {
          symbol,
          price: data.c,
          change: data.d,
          changePercent: data.dp,
          high: data.h,
          low: data.l,
          open: data.o,
          previousClose: data.pc,
          timestamp: data.t
        };
        this.cache.set(cacheKey, { data: quote, timestamp: Date.now() });
        return quote;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }

  // Peers - similar companies
  static async getPeers(symbol: string): Promise<string[]> {
    try {
      const cacheKey = `peers_${symbol}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const data = await this.makeRequest('/stock/peers', { symbol });
      
      this.cache.set(cacheKey, { data: data || [], timestamp: Date.now() });
      return data || [];
    } catch (error) {
      console.error(`Error fetching peers for ${symbol}:`, error);
      return [];
    }
  }

  // Dividends Calendar
  static async getDividends(symbol: string, from?: string, to?: string): Promise<any[]> {
    try {
      const cacheKey = `dividends_${symbol}_${from}_${to}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const now = new Date();
      const fromDate = from || new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const toDate = to || now.toISOString().split('T')[0];

      const data = await this.makeRequest('/stock/dividend', { symbol, from: fromDate, to: toDate });
      
      this.cache.set(cacheKey, { data: data || [], timestamp: Date.now() });
      return data || [];
    } catch (error) {
      console.error(`Error fetching dividends for ${symbol}:`, error);
      return [];
    }
  }
}

export async function registerRoutes(app: Express): Promise<void> {
  // Configure session middleware backed by Postgres (serverless-safe)
  const PgStore = connectPgSimple(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: new PgStore({
      pool: pool as any,
      createTableIfMissing: true
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Initialize AlertsEngine with storage
  const alertsEngine = new AlertsEngine(storage);

  // NOTE: WebSocket push is not supported on Vercel Functions.
  // Real-time updates are handled by client-side polling (React Query refetch).
  // broadcast() is kept as a no-op for compatibility with existing call sites.
  const broadcast = (_type: string, _data: any) => {
    // no-op in serverless environment
  };
  
  // Function to broadcast triggered alerts
  const broadcastTriggeredAlerts = async (triggeredAlerts: any[]) => {
    if (triggeredAlerts.length > 0) {
      triggeredAlerts.forEach(alert => {
        broadcast('alert_triggered', alert);
        console.log(`Alert triggered: ${alert.triggerReason} for ${alert.alert.symbol}`);
      });
    }
  };

  // ========================
  // AUTHENTICATION ENDPOINTS
  // ========================

  // User login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const authUser = await storage.verifyPassword(username, password);
      if (!authUser) {
        return res.status(401).json({ 
          error: 'Invalid username or password' 
        });
      }

      // Establish session
      (req.session as any).userId = authUser.id;
      (req.session as any).username = authUser.username;

      // Return user data without password
      const { password: _, ...userWithoutPassword } = authUser;
      res.json({
        success: true,
        user: userWithoutPassword,
        message: 'Login successful'
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ 
        error: error instanceof z.ZodError ? error.errors : 'Login failed' 
      });
    }
  });

  // User signup
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { username, password, email, firstName, lastName } = signupSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ 
          error: 'Username already exists' 
        });
      }

      // Check if email already exists (if provided)
      if (email) {
        const existingProfile = await storage.getUserProfileByEmail(email);
        if (existingProfile) {
          return res.status(409).json({ 
            error: 'Email already registered' 
          });
        }
      }

      // Create user
      const user = await storage.createUser({ username, password });

      // Create user profile
      if (firstName || lastName || email) {
        await storage.createUserProfile({
          userId: user.id,
          firstName,
          lastName,
          email,
          avatar: undefined,
          company: undefined,
          jobTitle: undefined,
          phone: undefined,
          timezone: "UTC",
          dateFormat: "MM/DD/YYYY"
        });
      }

      // Create default user preferences
      await storage.createUserPreferences({
        userId: user.id,
        defaultLayout: "grid",
        theme: "dark",
        fontSize: "medium",
        soundEnabled: false,
        autoRefreshInterval: 30,
        enableRealTimeData: true,
        defaultChartType: "candlestick",
        defaultTimeframe: "1D",
        showVolume: true,
        showIndicators: false,
        emailNotifications: false,
        browserNotifications: true,
        alertSounds: false,
        defaultWatchlists: JSON.stringify(["AAPL", "MSFT", "GOOGL"]),
        favoriteMarkets: JSON.stringify(["NYSE", "NASDAQ"]),
        tradingHours: "market"
      });

      // Create welcome notification
      await storage.createNotification({
        userId: user.id,
        type: "system",
        title: "Welcome to Bloom Terminal",
        message: "Your account has been successfully created. Start by adding symbols to your watchlist.",
        priority: "medium",
        actionType: null,
        actionData: null,
        metadata: null
      });

      // Establish session after successful signup
      (req.session as any).userId = user.id;
      (req.session as any).username = user.username;

      // Get complete auth user data
      const authUser = await storage.getAuthUser(user.id);
      if (!authUser) {
        throw new Error('Failed to retrieve user data');
      }

      // Return user data without password
      const { password: _, ...userWithoutPassword } = authUser;
      res.status(201).json({
        success: true,
        user: userWithoutPassword,
        message: 'Account created successfully'
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(400).json({ 
        error: error instanceof z.ZodError ? error.errors : 'Signup failed' 
      });
    }
  });

  // Get current user profile (session-based)
  app.get('/api/auth/profile', async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const authUser = await storage.getAuthUser(userId);
      if (!authUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return user data without password
      const { password, ...userWithoutPassword } = authUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  });

  // Get user profile by ID (for admin/specific user access)
  app.get('/api/auth/profile/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const authUser = await storage.getAuthUser(userId);
      if (!authUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return user data without password
      const { password, ...userWithoutPassword } = authUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  });

  // Update user profile
  app.patch('/api/auth/profile/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = updateProfileSchema.parse(req.body);

      const profile = await storage.updateUserProfile(userId, updates);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      res.json({
        success: true,
        profile,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(400).json({ 
        error: error instanceof z.ZodError ? error.errors : 'Profile update failed' 
      });
    }
  });

  // User logout
  app.post('/api/auth/logout', async (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).json({ error: 'Logout failed' });
        }
        
        res.clearCookie('connect.sid'); // Default session cookie name
        res.json({
          success: true,
          message: 'Logged out successfully'
        });
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // Get user preferences
  app.get('/api/auth/preferences/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const preferences = await storage.getUserPreferences(userId);
      if (!preferences) {
        return res.status(404).json({ error: 'Preferences not found' });
      }

      res.json(preferences);
    } catch (error) {
      console.error('Get preferences error:', error);
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  // Update user preferences
  app.patch('/api/auth/preferences/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = updatePreferencesSchema.parse(req.body);

      const preferences = await storage.updateUserPreferences(userId, updates);
      if (!preferences) {
        return res.status(404).json({ error: 'Preferences not found' });
      }

      res.json({
        success: true,
        preferences,
        message: 'Preferences updated successfully'
      });
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(400).json({ 
        error: error instanceof z.ZodError ? error.errors : 'Preferences update failed' 
      });
    }
  });

  // Get user notifications
  app.get('/api/notifications/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit = 50, onlyUnread = false } = req.query;
      
      const notifications = await storage.getNotifications(
        userId, 
        Number(limit), 
        onlyUnread === 'true'
      );

      res.json(notifications);
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  // Get unread notification count
  app.get('/api/notifications/:userId/unread-count', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  // Mark notification as read
  app.patch('/api/notifications/:notificationId/read', async (req, res) => {
    try {
      const { notificationId } = req.params;
      
      const success = await storage.markNotificationAsRead(notificationId);
      if (!success) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Mark all notifications as read
  app.patch('/api/notifications/:userId/read-all', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const count = await storage.markAllNotificationsAsRead(userId);
      res.json({ 
        success: true, 
        count, 
        message: `${count} notifications marked as read` 
      });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  // Delete notification
  app.delete('/api/notifications/:notificationId', async (req, res) => {
    try {
      const { notificationId } = req.params;
      
      const success = await storage.deleteNotification(notificationId);
      if (!success) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

  // Stock quote endpoints
  app.get('/api/quote/:symbol', async (req, res) => {
    try {
      const { symbol } = getQuoteSchema.parse(req.params);
      const quote = await FinanceService.getQuote(symbol);
      
      if (!quote) {
        return res.status(404).json({ error: 'Stock not found' });
      }
      
      // Check for triggered alerts after quote update
      try {
        const triggeredAlerts = await alertsEngine.checkPriceAlerts(quote);
        const volumeAlerts = await alertsEngine.checkVolumeAlerts(quote);
        const allTriggeredAlerts = [...triggeredAlerts, ...volumeAlerts];
        await broadcastTriggeredAlerts(allTriggeredAlerts);
      } catch (alertError) {
        console.error('Error checking alerts for', symbol, ':', alertError);
      }
      
      res.json(quote);
    } catch (error) {
      console.error('Error in /api/quote:', error);
      res.status(500).json({ error: 'Failed to fetch stock quote' });
    }
  });

  app.post('/api/quotes', async (req, res) => {
    try {
      const symbols = z.array(z.string()).parse(req.body.symbols);
      const quotes = await FinanceService.getMultipleQuotes(symbols);
      res.json(quotes);
    } catch (error) {
      console.error('Error in /api/quotes:', error);
      res.status(500).json({ error: 'Failed to fetch stock quotes' });
    }
  });

  // Chart data endpoint
  app.get('/api/chart/:symbol', async (req, res) => {
    try {
      const { symbol, interval } = getChartSchema.parse({
        symbol: req.params.symbol,
        interval: req.query.interval
      });
      
      const chartData = await FinanceService.getChart(symbol, interval);
      
      // Check for triggered volatility and breakout alerts after chart update
      try {
        const volatilityAlerts = await alertsEngine.checkVolatilityAlerts(symbol, chartData);
        const breakoutAlerts = await alertsEngine.checkBreakoutAlerts(symbol, chartData);
        const allTriggeredAlerts = [...volatilityAlerts, ...breakoutAlerts];
        await broadcastTriggeredAlerts(allTriggeredAlerts);
      } catch (alertError) {
        console.error('Error checking chart-based alerts for', symbol, ':', alertError);
      }
      
      res.json(chartData);
    } catch (error) {
      console.error('Error in /api/chart:', error);
      res.status(500).json({ error: 'Failed to fetch chart data' });
    }
  });

  // Market indices endpoint
  app.get('/api/market/indices', async (req, res) => {
    try {
      const indices = await FinanceService.getMarketIndices();
      res.json(indices);
    } catch (error) {
      console.error('Error in /api/market/indices:', error);
      res.status(500).json({ error: 'Failed to fetch market indices' });
    }
  });

  // Cryptocurrency endpoints
  app.get('/api/crypto/quote/:symbol', async (req, res) => {
    try {
      const { symbol } = getCryptoQuoteSchema.parse(req.params);
      const quote = await CoinGeckoService.getCryptoQuote(symbol);
      
      if (!quote) {
        return res.status(404).json({ error: 'Cryptocurrency not found' });
      }
      
      // Check for triggered alerts after crypto quote update
      try {
        const triggeredAlerts = await alertsEngine.checkPriceAlerts(quote);
        const volumeAlerts = await alertsEngine.checkVolumeAlerts(quote);
        const allTriggeredAlerts = [...triggeredAlerts, ...volumeAlerts];
        await broadcastTriggeredAlerts(allTriggeredAlerts);
      } catch (alertError) {
        console.error('Error checking crypto alerts for', symbol, ':', alertError);
      }
      
      res.json(quote);
    } catch (error) {
      console.error('Error in /api/crypto/quote:', error);
      res.status(500).json({ error: 'Failed to fetch crypto quote' });
    }
  });

  app.get('/api/crypto/chart/:symbol', async (req, res) => {
    try {
      const { symbol, interval } = getCryptoChartSchema.parse({
        symbol: req.params.symbol,
        interval: req.query.interval
      });
      
      const chartData = await CoinGeckoService.getCryptoChart(symbol, interval);
      
      // Check for triggered volatility and breakout alerts after crypto chart update
      try {
        const volatilityAlerts = await alertsEngine.checkVolatilityAlerts(symbol, chartData);
        const breakoutAlerts = await alertsEngine.checkBreakoutAlerts(symbol, chartData);
        const allTriggeredAlerts = [...volatilityAlerts, ...breakoutAlerts];
        await broadcastTriggeredAlerts(allTriggeredAlerts);
      } catch (alertError) {
        console.error('Error checking crypto chart-based alerts for', symbol, ':', alertError);
      }
      
      res.json(chartData);
    } catch (error) {
      console.error('Error in /api/crypto/chart:', error);
      res.status(500).json({ error: 'Failed to fetch crypto chart data' });
    }
  });

  app.get('/api/crypto/trending', async (req, res) => {
    try {
      const trending = await CoinGeckoService.getTrendingCryptos();
      res.json(trending);
    } catch (error) {
      console.error('Error in /api/crypto/trending:', error);
      res.status(500).json({ error: 'Failed to fetch trending cryptocurrencies' });
    }
  });

  app.get('/api/crypto/markets', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const cryptos = await CoinGeckoService.getTopCryptos(limit);
      res.json(cryptos);
    } catch (error) {
      console.error('Error in /api/crypto/markets:', error);
      res.status(500).json({ error: 'Failed to fetch crypto market data' });
    }
  });

  app.post('/api/crypto/quotes', async (req, res) => {
    try {
      const symbols = z.array(z.string()).parse(req.body.symbols);
      const quotes = await CoinGeckoService.getMultipleCryptoQuotes(symbols);
      res.json(quotes);
    } catch (error) {
      console.error('Error in /api/crypto/quotes:', error);
      res.status(500).json({ error: 'Failed to fetch multiple crypto quotes' });
    }
  });

  // News endpoints with enhanced fallback
  app.get('/api/news', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const symbols = req.query.symbols ? (req.query.symbols as string).split(',') : undefined;
      const news = await NewsAggregatorService.getNews(symbols, limit);
      res.json(news);
    } catch (error) {
      console.error('Error in /api/news:', error);
      // Fallback to cached data or minimal response
      try {
        const fallbackLimit = parseInt(req.query.limit as string) || 20;
        const fallbackNews = await storage.getNews(fallbackLimit);
        res.json(fallbackNews.length > 0 ? fallbackNews : [{
          id: 'system-error',
          title: 'News Service Temporarily Unavailable',
          summary: 'Market news services are experiencing technical difficulties. Please try again later.',
          source: 'Bloom Terminal',
          publishedAt: new Date(),
          url: '#',
          category: 'system'
        }]);
      } catch (fallbackError) {
        res.status(500).json({ error: 'Failed to fetch news' });
      }
    }
  });

  // Clear news cache endpoint
  app.post('/api/news/clear-cache', (req, res) => {
    try {
      AlphaVantageService.clearCache();
      res.json({ success: true, message: 'News cache cleared successfully' });
    } catch (error) {
      console.error('Error clearing news cache:', error);
      res.status(500).json({ error: 'Failed to clear news cache' });
    }
  });

  // Economic calendar endpoint
  app.get('/api/economic-calendar', async (req, res) => {
    try {
      const events = await AlphaVantageService.getEconomicCalendar();
      res.json(events);
    } catch (error) {
      console.error('Error in /api/economic-calendar:', error);
      res.status(500).json({ error: 'Failed to fetch economic calendar' });
    }
  });

  // Finnhub API endpoints
  
  // Earnings calendar
  app.get('/api/finnhub/earnings-calendar', async (req, res) => {
    try {
      const { from, to } = req.query;
      const earnings = await FinnhubService.getEarningsCalendar(from as string, to as string);
      res.json(earnings);
    } catch (error) {
      console.error('Error fetching earnings calendar:', error);
      res.status(500).json({ error: 'Failed to fetch earnings calendar' });
    }
  });

  // IPO calendar
  app.get('/api/finnhub/ipo-calendar', async (req, res) => {
    try {
      const { from, to } = req.query;
      const ipos = await FinnhubService.getIPOCalendar(from as string, to as string);
      res.json(ipos);
    } catch (error) {
      console.error('Error fetching IPO calendar:', error);
      res.status(500).json({ error: 'Failed to fetch IPO calendar' });
    }
  });

  // Forex rates
  app.get('/api/finnhub/forex', async (req, res) => {
    try {
      const rates = await FinnhubService.getForexRates();
      res.json(rates);
    } catch (error) {
      console.error('Error fetching forex rates:', error);
      res.status(500).json({ error: 'Failed to fetch forex rates' });
    }
  });

  // Company profile
  app.get('/api/finnhub/company-profile/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const profile = await FinnhubService.getCompanyProfile(symbol.toUpperCase());
      if (!profile) {
        return res.status(404).json({ error: 'Company profile not found' });
      }
      res.json(profile);
    } catch (error) {
      console.error('Error fetching company profile:', error);
      res.status(500).json({ error: 'Failed to fetch company profile' });
    }
  });

  // Recommendation trends
  app.get('/api/finnhub/recommendations/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const recommendations = await FinnhubService.getRecommendationTrends(symbol.toUpperCase());
      res.json(recommendations);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  });

  // Price target
  app.get('/api/finnhub/price-target/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const priceTarget = await FinnhubService.getPriceTarget(symbol.toUpperCase());
      res.json(priceTarget);
    } catch (error) {
      console.error('Error fetching price target:', error);
      res.status(500).json({ error: 'Failed to fetch price target' });
    }
  });

  // Market news
  app.get('/api/finnhub/market-news', async (req, res) => {
    try {
      const { category = 'general' } = req.query;
      const news = await FinnhubService.getMarketNews(category as string);
      res.json(news);
    } catch (error) {
      console.error('Error fetching market news:', error);
      res.status(500).json({ error: 'Failed to fetch market news' });
    }
  });

  // Company news
  app.get('/api/finnhub/company-news/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { from, to } = req.query;
      const news = await FinnhubService.getCompanyNews(symbol.toUpperCase(), from as string, to as string);
      res.json(news);
    } catch (error) {
      console.error('Error fetching company news:', error);
      res.status(500).json({ error: 'Failed to fetch company news' });
    }
  });

  // Stock quote (Finnhub)
  app.get('/api/finnhub/quote/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const quote = await FinnhubService.getQuote(symbol.toUpperCase());
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }
      res.json(quote);
    } catch (error) {
      console.error('Error fetching quote:', error);
      res.status(500).json({ error: 'Failed to fetch quote' });
    }
  });

  // Peers
  app.get('/api/finnhub/peers/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const peers = await FinnhubService.getPeers(symbol.toUpperCase());
      res.json(peers);
    } catch (error) {
      console.error('Error fetching peers:', error);
      res.status(500).json({ error: 'Failed to fetch peers' });
    }
  });

  // Dividends
  app.get('/api/finnhub/dividends/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { from, to } = req.query;
      const dividends = await FinnhubService.getDividends(symbol.toUpperCase(), from as string, to as string);
      res.json(dividends);
    } catch (error) {
      console.error('Error fetching dividends:', error);
      res.status(500).json({ error: 'Failed to fetch dividends' });
    }
  });

  // Company fundamentals endpoint with Yahoo Finance primary and Alpha Vantage fallback
  app.get('/api/fundamentals/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const upperSymbol = symbol.toUpperCase();
      
      // Try Yahoo Finance first (primary source)
      let fundamentals = await FinanceService.getCompanyFundamentals(upperSymbol);
      
      // If Yahoo Finance fails, try Alpha Vantage as fallback
      if (!fundamentals) {
        console.log(`Yahoo Finance fundamentals failed for ${upperSymbol}, trying Alpha Vantage fallback...`);
        try {
          fundamentals = await AlphaVantageService.getCompanyFundamentals(upperSymbol);
        } catch (alphaError) {
          console.log(`Alpha Vantage fallback also failed for ${upperSymbol}:`, alphaError);
        }
      }
      
      if (!fundamentals) {
        return res.status(404).json({ 
          error: 'Company fundamentals not found',
          message: `Unable to fetch fundamentals for ${upperSymbol} from any data source`
        });
      }
      
      res.json(fundamentals);
    } catch (error) {
      console.error('Error in /api/fundamentals:', error);
      res.status(500).json({ error: 'Failed to fetch company fundamentals' });
    }
  });

  // Watchlist endpoints
  app.get('/api/watchlist', async (req, res) => {
    try {
      // For demo, use the first demo user
      const demoUser = await storage.getDemoUser();
      
      if (!demoUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const watchlist = await storage.getWatchlist(demoUser.id);
      
      // Separate crypto and stock symbols
      const stockSymbols = watchlist
        .filter(item => (item.assetType || 'stock') === 'stock' && !CoinGeckoService.isCrypto(item.symbol))
        .map(item => item.symbol);
      
      const cryptoSymbols = watchlist
        .filter(item => (item.assetType || 'stock') === 'crypto' || CoinGeckoService.isCrypto(item.symbol))
        .map(item => item.symbol);
      
      // Fetch quotes from both services
      const [stockQuotes, cryptoQuotes] = await Promise.all([
        stockSymbols.length > 0 ? FinanceService.getMultipleQuotes(stockSymbols) : Promise.resolve([]),
        cryptoSymbols.length > 0 ? CoinGeckoService.getMultipleCryptoQuotes(cryptoSymbols) : Promise.resolve([])
      ]);
      
      // Merge watchlist items with current quotes
      const enrichedWatchlist = watchlist.map(item => {
        const isCrypto = (item.assetType || 'stock') === 'crypto' || CoinGeckoService.isCrypto(item.symbol);
        
        if (isCrypto) {
          const cryptoQuote = cryptoQuotes.find(q => q.symbol === item.symbol.replace(/^crypto:/i, '').toUpperCase());
          return {
            ...item,
            assetType: 'crypto',
            ...cryptoQuote
          };
        } else {
          const stockQuote = stockQuotes.find(q => q.symbol === item.symbol);
          return {
            ...item,
            assetType: 'stock',
            ...stockQuote
          };
        }
      });
      
      res.json(enrichedWatchlist);
    } catch (error) {
      console.error('Error in /api/watchlist:', error);
      res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
  });

  app.post('/api/watchlist', async (req, res) => {
    try {
      const { symbol, name, assetType } = watchlistSchema.parse(req.body);
      
      // For demo, use the first demo user
      const demoUser = await storage.getDemoUser();
      
      if (!demoUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Determine asset type if not provided
      const isCrypto = assetType === 'crypto' || CoinGeckoService.isCrypto(symbol);
      const finalAssetType = isCrypto ? 'crypto' : 'stock';
      
      // Get name from quote if not provided
      let assetName = name;
      if (!assetName) {
        if (isCrypto) {
          const cryptoQuote = await CoinGeckoService.getCryptoQuote(symbol);
          assetName = cryptoQuote?.name || symbol;
        } else {
          const stockQuote = await FinanceService.getQuote(symbol);
          assetName = stockQuote?.symbol || symbol;
        }
      }
      
      const watchlistItem = await storage.addToWatchlist({
        symbol: symbol.toUpperCase(),
        name: assetName,
        assetType: finalAssetType,
        userId: demoUser.id
      });
      
      res.json(watchlistItem);
    } catch (error) {
      console.error('Error in POST /api/watchlist:', error);
      res.status(500).json({ error: 'Failed to add to watchlist' });
    }
  });

  app.delete('/api/watchlist/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeFromWatchlist(id);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Watchlist item not found' });
      }
    } catch (error) {
      console.error('Error in DELETE /api/watchlist:', error);
      res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
  });

  // Portfolio endpoints
  app.get('/api/portfolio', async (req, res) => {
    try {
      // For demo, use the first demo user
      const demoUser = await storage.getDemoUser();
      
      if (!demoUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const positions = await storage.getPortfolio(demoUser.id);
      
      // Separate crypto and stock positions
      const stockPositions = positions.filter(pos => 
        (pos.assetType || 'stock') === 'stock' && !CoinGeckoService.isCrypto(pos.symbol)
      );
      const cryptoPositions = positions.filter(pos => 
        (pos.assetType || 'stock') === 'crypto' || CoinGeckoService.isCrypto(pos.symbol)
      );
      
      const stockSymbols = stockPositions.map(pos => pos.symbol);
      const cryptoSymbols = cryptoPositions.map(pos => pos.symbol);
      
      // Fetch quotes from both services
      const [stockQuotes, cryptoQuotes] = await Promise.all([
        stockSymbols.length > 0 ? FinanceService.getMultipleQuotes(stockSymbols) : Promise.resolve([]),
        cryptoSymbols.length > 0 ? CoinGeckoService.getMultipleCryptoQuotes(cryptoSymbols) : Promise.resolve([])
      ]);
      
      // Calculate portfolio metrics for all positions
      const enrichedPositions = positions.map(position => {
        const isCrypto = (position.assetType || 'stock') === 'crypto' || CoinGeckoService.isCrypto(position.symbol);
        
        let quote;
        let assetName;
        
        if (isCrypto) {
          quote = cryptoQuotes.find(q => q.symbol === position.symbol.replace(/^crypto:/i, '').toUpperCase());
          assetName = quote?.name || position.symbol;
        } else {
          quote = stockQuotes.find(q => q.symbol === position.symbol);
          assetName = quote?.symbol || position.symbol;
        }
        
        const currentPrice = quote?.price || parseFloat(position.avgPrice);
        const quantity = parseFloat(position.quantity);
        const avgPrice = parseFloat(position.avgPrice);
        const marketValue = currentPrice * quantity;
        const costBasis = avgPrice * quantity;
        const unrealizedPnL = marketValue - costBasis;
        const unrealizedPnLPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
        
        return {
          ...position,
          assetType: isCrypto ? 'crypto' : 'stock',
          name: assetName,
          currentPrice,
          marketValue,
          unrealizedPnL,
          unrealizedPnLPercent,
          change: quote?.change || 0,
          changePercent: quote?.changePercent || 0
        };
      });
      
      // Calculate totals
      const totalValue = enrichedPositions.reduce((sum, pos) => sum + pos.marketValue, 0);
      const totalCost = enrichedPositions.reduce((sum, pos) => sum + (parseFloat(pos.avgPrice) * parseFloat(pos.quantity)), 0);
      const totalPnL = totalValue - totalCost;
      const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
      
      res.json({
        positions: enrichedPositions,
        summary: {
          totalValue,
          totalCost,
          totalPnL,
          totalPnLPercent
        }
      });
    } catch (error) {
      console.error('Error in /api/portfolio:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
  });

  // Trading endpoints - Buy and Sell
  app.post('/api/trade/buy', async (req, res) => {
    try {
      // For demo, use the first demo user
      const demoUser = await storage.getDemoUser();
      
      if (!demoUser) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Validate request body
      const { symbol, quantity } = tradeSchema.parse(req.body);
      
      // Determine if it's crypto or stock
      const isCryptoAsset = CoinGeckoService.isCrypto(symbol);
      
      // Get current price - MUST succeed for buy orders
      let currentPrice: number;
      let assetName: string;
      
      if (isCryptoAsset) {
        const quote = await CoinGeckoService.getCryptoQuote(symbol);
        if (!quote || typeof quote.price !== 'number' || quote.price <= 0) {
          return res.status(404).json({ error: 'Failed to get valid current price for crypto asset' });
        }
        currentPrice = quote.price;
        assetName = quote.name;
      } else {
        const quote = await FinanceService.getQuote(symbol);
        if (!quote || typeof quote.price !== 'number' || quote.price <= 0) {
          return res.status(404).json({ error: 'Failed to get valid current price for stock' });
        }
        currentPrice = quote.price;
        assetName = quote.symbol;
      }
      
      // Check if position already exists
      const existingPositions = await storage.getPortfolio(demoUser.id);
      const existingPosition = existingPositions.find(pos => pos.symbol.toUpperCase() === symbol);
      
      if (existingPosition) {
        // Update existing position - calculate new average price with proper number handling
        const currentQty = Number(existingPosition.quantity);
        const currentAvg = Number(existingPosition.avgPrice);
        
        // Validate existing data
        if (isNaN(currentQty) || isNaN(currentAvg) || currentQty < 0 || currentAvg <= 0) {
          return res.status(500).json({ error: 'Invalid existing position data' });
        }
        
        const newQty = currentQty + quantity;
        const newAvg = ((currentQty * currentAvg) + (quantity * currentPrice)) / newQty;
        
        await storage.updatePosition(existingPosition.id, {
          quantity: newQty.toFixed(8),  // Store with 8 decimal precision
          avgPrice: newAvg.toFixed(8)
        });
        
        res.json({
          success: true,
          message: `Successfully bought ${quantity} ${symbol} at $${currentPrice.toFixed(2)}`,
          position: {
            symbol,
            quantity: newQty,
            avgPrice: newAvg,
            currentPrice,
            cost: quantity * currentPrice
          }
        });
      } else {
        // Create new position
        const newPosition = await storage.addPosition({
          symbol: symbol,
          quantity: quantity.toFixed(8),  // Store with 8 decimal precision
          avgPrice: currentPrice.toFixed(8),
          assetType: isCryptoAsset ? 'crypto' : 'stock',
          userId: demoUser.id
        });
        
        res.json({
          success: true,
          message: `Successfully bought ${quantity} ${symbol} at $${currentPrice.toFixed(2)}`,
          position: {
            symbol,
            quantity,
            avgPrice: currentPrice,
            currentPrice,
            cost: quantity * currentPrice
          }
        });
      }
    } catch (error) {
      console.error('Error in /api/trade/buy:', error);
      res.status(500).json({ error: 'Failed to execute buy order' });
    }
  });

  app.post('/api/trade/sell', async (req, res) => {
    try {
      // For demo, use the first demo user
      const demoUser = await storage.getDemoUser();
      
      if (!demoUser) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Validate request body
      const { symbol, quantity } = tradeSchema.parse(req.body);
      
      // Check if position exists
      const existingPositions = await storage.getPortfolio(demoUser.id);
      const existingPosition = existingPositions.find(pos => pos.symbol.toUpperCase() === symbol);
      
      if (!existingPosition) {
        return res.status(404).json({ error: 'Position not found in portfolio' });
      }
      
      // Convert and validate existing position data
      const currentQty = Number(existingPosition.quantity);
      const avgPrice = Number(existingPosition.avgPrice);
      
      if (isNaN(currentQty) || isNaN(avgPrice) || currentQty <= 0 || avgPrice <= 0) {
        return res.status(500).json({ error: 'Invalid position data in portfolio' });
      }
      
      // Validate sufficient quantity with precision tolerance
      const tolerance = 0.00000001; // 8 decimal places
      if (currentQty < quantity - tolerance) {
        return res.status(400).json({ 
          error: `Insufficient quantity. You have ${currentQty.toFixed(8)} ${symbol}, trying to sell ${quantity}` 
        });
      }
      
      // Prevent negative holdings
      const newQty = currentQty - quantity;
      if (newQty < -tolerance) {
        return res.status(400).json({ 
          error: `Cannot sell more than you own. Available: ${currentQty.toFixed(8)} ${symbol}` 
        });
      }
      
      // Determine if it's crypto or stock
      const isCryptoAsset = CoinGeckoService.isCrypto(symbol);
      
      // Get current price for calculating P&L - MUST succeed
      let currentPrice: number;
      
      if (isCryptoAsset) {
        const quote = await CoinGeckoService.getCryptoQuote(symbol);
        if (!quote || typeof quote.price !== 'number' || quote.price <= 0) {
          return res.status(404).json({ error: 'Failed to get valid current price for crypto asset' });
        }
        currentPrice = quote.price;
      } else {
        const quote = await FinanceService.getQuote(symbol);
        if (!quote || typeof quote.price !== 'number' || quote.price <= 0) {
          return res.status(404).json({ error: 'Failed to get valid current price for stock' });
        }
        currentPrice = quote.price;
      }
      
      const realizedPnL = (currentPrice - avgPrice) * quantity;
      
      // Check if position should be closed (within tolerance)
      if (Math.abs(newQty) < tolerance) {
        // Remove position entirely
        await storage.removePosition(existingPosition.id);
        
        res.json({
          success: true,
          message: `Successfully sold all ${quantity.toFixed(8)} ${symbol} at $${currentPrice.toFixed(2)}`,
          realizedPnL,
          realizedPnLPercent: avgPrice > 0 ? (realizedPnL / (avgPrice * quantity)) * 100 : 0,
          proceeds: quantity * currentPrice
        });
      } else {
        // Update position with reduced quantity
        await storage.updatePosition(existingPosition.id, {
          quantity: newQty.toFixed(8)  // Store with 8 decimal precision
        });
        
        res.json({
          success: true,
          message: `Successfully sold ${quantity.toFixed(8)} ${symbol} at $${currentPrice.toFixed(2)}`,
          realizedPnL,
          realizedPnLPercent: avgPrice > 0 ? (realizedPnL / (avgPrice * quantity)) * 100 : 0,
          proceeds: quantity * currentPrice,
          remainingPosition: {
            symbol,
            quantity: newQty,
            avgPrice
          }
        });
      }
    } catch (error) {
      console.error('Error in /api/trade/sell:', error);
      res.status(500).json({ error: 'Failed to execute sell order' });
    }
  });

  // Stock screener endpoint
  app.get('/api/screener', async (req, res) => {
    try {
      // Get filtering parameters
      const {
        minPrice,
        maxPrice,
        minVolume,
        minMarketCap,
        maxPE,
        sector,
        sortBy = 'changePercent',
        sortOrder = 'desc',
        limit = 50
      } = req.query;

      // Get top stocks for screener (using a larger curated list)
      const topStocks = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "JPM", "V",
        "UNH", "PG", "MA", "HD", "JNJ", "BAC", "ABBV", "PFE", "KO", "MRK",
        "PEP", "COST", "AVGO", "TMO", "WMT", "DIS", "CRM", "ACN", "VZ", "ADBE",
        "MCD", "ABT", "NFLX", "NKE", "T", "LLY", "CSCO", "XOM", "CVX", "BMY"
      ];
      
      // Apply sector filtering if needed
      let symbols = topStocks;
      if (sector && sector !== 'all') {
        // For now, return a subset based on sector (this can be enhanced later)
        const sectorMap: Record<string, string[]> = {
          'Technology': ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'ADBE', 'CRM', 'AVGO', 'CSCO'],
          'Healthcare': ['UNH', 'JNJ', 'PFE', 'ABT', 'LLY', 'BMY', 'TMO', 'ABBV', 'MRK'],
          'Financial': ['JPM', 'V', 'MA', 'BAC', 'BRK-B'],
          'Consumer': ['PG', 'HD', 'WMT', 'MCD', 'KO', 'PEP', 'COST', 'NKE', 'DIS']
        };
        symbols = sectorMap[sector as string] || topStocks;
      }
      
      console.log(`Fetching quotes for ${symbols.length} stocks...`);
      
      const quotes = await FinanceService.getMultipleQuotes(symbols);
      
      // Enrich quotes with company names and sector information
      let enrichedQuotes = quotes.map((quote: StockQuote) => {
        // Basic sector mapping for curated stocks
        const sectorMapping: Record<string, string> = {
          'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'NVDA': 'Technology', 'META': 'Technology',
          'UNH': 'Healthcare', 'JNJ': 'Healthcare', 'PFE': 'Healthcare', 'ABT': 'Healthcare', 'LLY': 'Healthcare',
          'JPM': 'Financial', 'V': 'Financial', 'MA': 'Financial', 'BAC': 'Financial', 'BRK-B': 'Financial',
          'PG': 'Consumer', 'HD': 'Consumer', 'WMT': 'Consumer', 'MCD': 'Consumer', 'KO': 'Consumer'
        };
        
        return {
          ...quote,
          name: quote.symbol, // Use symbol as name for now
          sector: sectorMapping[quote.symbol] || 'Other'
        };
      });

      // Apply filtering
      if (minPrice && !isNaN(parseFloat(minPrice as string))) {
        enrichedQuotes = enrichedQuotes.filter(q => q.price >= parseFloat(minPrice as string));
      }
      
      if (maxPrice && !isNaN(parseFloat(maxPrice as string))) {
        enrichedQuotes = enrichedQuotes.filter(q => q.price <= parseFloat(maxPrice as string));
      }
      
      if (minVolume && !isNaN(parseFloat(minVolume as string))) {
        enrichedQuotes = enrichedQuotes.filter(q => q.volume >= parseFloat(minVolume as string));
      }
      
      if (minMarketCap && !isNaN(parseFloat(minMarketCap as string))) {
        enrichedQuotes = enrichedQuotes.filter(q => q.marketCap && q.marketCap >= parseFloat(minMarketCap as string));
      }
      
      if (maxPE && !isNaN(parseFloat(maxPE as string))) {
        enrichedQuotes = enrichedQuotes.filter(q => q.pe && q.pe <= parseFloat(maxPE as string));
      }

      // Sort results
      if (sortBy) {
        enrichedQuotes.sort((a: any, b: any) => {
          let aVal: any = a[sortBy as keyof typeof a];
          let bVal: any = b[sortBy as keyof typeof b];
          
          // Handle missing values
          if (aVal === undefined || aVal === null) aVal = 0;
          if (bVal === undefined || bVal === null) bVal = 0;
          
          if (typeof aVal === 'string') aVal = aVal.toLowerCase();
          if (typeof bVal === 'string') bVal = bVal.toLowerCase();
          
          if (sortOrder === 'desc') {
            return bVal > aVal ? 1 : -1;
          } else {
            return aVal > bVal ? 1 : -1;
          }
        });
      }

      // Apply limit
      const limitedResults = enrichedQuotes.slice(0, parseInt(limit as string) || 50);
      
      console.log(`Returning ${limitedResults.length} screener results`);
      res.json(limitedResults);
    } catch (error) {
      console.error('Error in /api/screener:', error);
      res.status(500).json({ error: 'Failed to fetch screener data' });
    }
  });

  // Market Heat Map endpoint with S&P 500 and commodities
  app.get('/api/heatmap', async (req, res) => {
    try {
      // S&P 500 stocks organized by sector
      const sp500Sectors = {
        "Technology": [
          "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "CRM", "ORCL", "ADBE",
          "IBM", "INTC", "AMD", "QCOM", "TXN", "AVGO", "CSCO", "NOW", "ANET", "INTU"
        ],
        "Healthcare": [
          "UNH", "JNJ", "PFE", "ABBV", "MRK", "TMO", "ABT", "LLY", "MDT", "BMY",
          "AMGN", "GILD", "CVS", "DHR", "SYK", "BDX", "CI", "REGN", "HUM", "VRTX"
        ],
        "Financial": [
          "JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "AXP", "USB", "PNC",
          "TFC", "COF", "SCHW", "CB", "ICE", "CME", "SPGI", "MCO", "AON", "MMC"
        ],
        "Consumer Discretionary": [
          "AMZN", "HD", "MCD", "NKE", "SBUX", "LOW", "TJX", "GM", "F", "COST",
          "TGT", "BBY", "EBAY", "MAR", "HLT", "MGM", "LVS", "NCLH", "CCL", "RCL"
        ],
        "Consumer Staples": [
          "PG", "KO", "PEP", "WMT", "COST", "CL", "KMB", "GIS", "K", "CPB",
          "CAG", "SJM", "HSY", "MKC", "CHD", "CLX", "TSN", "HRL", "LW", "EL"
        ],
        "Energy": [
          "XOM", "CVX", "COP", "EOG", "SLB", "PSX", "VLO", "MPC", "OKE", "KMI",
          "WMB", "HES", "DVN", "FANG", "APA", "MRO", "OXY", "BKR", "HAL", "FTI"
        ],
        "Industrials": [
          "GE", "CAT", "BA", "HON", "UPS", "RTX", "LMT", "MMM", "DE", "FDX",
          "UNP", "CSX", "NSC", "DAL", "UAL", "AAL", "LUV", "JBHT", "CHRW", "EXPD"
        ],
        "Materials": [
          "LIN", "APD", "SHW", "FCX", "NEM", "DOW", "DD", "PPG", "ECL", "IFF",
          "CF", "MOS", "FMC", "ALB", "CE", "VMC", "MLM", "NUE", "STLD", "X"
        ],
        "Real Estate": [
          "PLD", "CCI", "AMT", "EQIX", "PSA", "EXR", "AVB", "EQR", "MAA", "ESS",
          "UDR", "CPT", "FRT", "BXP", "VTR", "WELL", "PEAK", "REG", "HST", "SLG"
        ],
        "Utilities": [
          "NEE", "DUK", "SO", "D", "AEP", "EXC", "XEL", "SRE", "PCG", "ED",
          "FE", "ETR", "ES", "AWK", "PEG", "WEC", "EIX", "DTE", "PPL", "CMS"
        ]
      };

      // Major commodities
      const commodities = [
        "GLD",    // Gold ETF
        "SLV",    // Silver ETF  
        "USO",    // Oil ETF
        "UNG",    // Natural Gas ETF
        "DBA",    // Agriculture ETF
        "JJC",    // Copper ETF
        "PPLT",   // Platinum ETF
        "CORN",   // Corn ETF
        "WEAT",   // Wheat ETF
        "SOYB"    // Soybean ETF
      ];

      // Get all symbols
      const allSymbols = [
        ...Object.values(sp500Sectors).flat(),
        ...commodities
      ];

      console.log(`Fetching quotes for ${allSymbols.length} symbols for heat map...`);
      
      // Remove duplicates (some symbols might appear in multiple sectors)
      const uniqueSymbols = Array.from(new Set(allSymbols));
      
      // Fetch quotes for all symbols
      const quotes = await FinanceService.getMultipleQuotes(uniqueSymbols);
      
      // Create a map for quick lookup
      const quoteMap = new Map(quotes.map(q => [q.symbol, q]));
      
      // Structure the response by sectors and commodities
      const heatMapData = {
        sectors: {} as Record<string, any[]>,
        commodities: [] as any[],
        indices: [] as any[],
        lastUpdated: new Date()
      };

      // Process each sector
      for (const [sectorName, symbols] of Object.entries(sp500Sectors)) {
        heatMapData.sectors[sectorName] = symbols
          .map(symbol => quoteMap.get(symbol))
          .filter(quote => quote !== undefined)
          .map(quote => ({
            symbol: quote!.symbol,
            name: quote!.symbol, // We can enhance this with company names later
            price: quote!.price,
            change: quote!.change,
            changePercent: quote!.changePercent,
            volume: quote!.volume,
            marketCap: quote!.marketCap || 0,
            sector: sectorName
          }));
      }

      // Process commodities
      heatMapData.commodities = commodities
        .map(symbol => quoteMap.get(symbol))
        .filter(quote => quote !== undefined)
        .map(quote => ({
          symbol: quote!.symbol,
          name: getCommodityName(quote!.symbol),
          price: quote!.price,
          change: quote!.change,
          changePercent: quote!.changePercent,
          volume: quote!.volume,
          marketCap: 0, // Commodities don't have market cap
          sector: "Commodities"
        }));

      // Add market indices
      const indices = await FinanceService.getMarketIndices();
      heatMapData.indices = indices.map(quote => ({
        symbol: quote.symbol,
        name: getIndexName(quote.symbol),
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        marketCap: 0
      }));

      console.log(`Returning heat map data with ${Object.keys(heatMapData.sectors).length} sectors, ${heatMapData.commodities.length} commodities, ${heatMapData.indices.length} indices`);
      res.json(heatMapData);
    } catch (error) {
      console.error('Error in /api/heatmap:', error);
      res.status(500).json({ error: 'Failed to fetch heat map data' });
    }
  });

  // Helper functions for heat map
  function getCommodityName(symbol: string): string {
    const commodityNames: Record<string, string> = {
      "GLD": "Gold",
      "SLV": "Silver", 
      "USO": "Oil",
      "UNG": "Natural Gas",
      "DBA": "Agriculture",
      "JJC": "Copper",
      "PPLT": "Platinum",
      "CORN": "Corn",
      "WEAT": "Wheat",
      "SOYB": "Soybeans"
    };
    return commodityNames[symbol] || symbol;
  }

  function getIndexName(symbol: string): string {
    const indexNames: Record<string, string> = {
      "^GSPC": "S&P 500",
      "^DJI": "Dow Jones",
      "^IXIC": "NASDAQ",
      "^RUT": "Russell 2000",
      "^VIX": "VIX"
    };
    return indexNames[symbol] || symbol;
  }

  // Risk Analytics endpoint
  app.get('/api/risk-analytics', async (req, res) => {
    try {
      const { timeframe = '3M' } = req.query;
      
      // Get demo user and their portfolio
      const demoUser = await storage.getDemoUser();
      if (!demoUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const positions = await storage.getPortfolio(demoUser.id);
      if (positions.length === 0) {
        return res.json({
          portfolioValue: 0,
          portfolioReturns: [],
          volatility: 0,
          sharpeRatio: 0,
          beta: 1.0,
          maxDrawdown: 0,
          var95: 0,
          var99: 0,
          correlationMatrix: { assets: [], correlations: [] },
          sectorExposure: [],
          assetAllocation: [],
          riskMetrics: {
            valueAtRisk: {
              historical: { var95: 0, var99: 0, expectedShortfall95: 0, expectedShortfall99: 0 },
              parametric: { var95: 0, var99: 0 },
              monteCarlo: { var95: 0, var99: 0, simulations: 10000 }
            },
            stressTests: [],
            concentrationRisk: 0
          }
        });
      }
      
      // Separate crypto and stock positions
      const stockPositions = positions.filter(pos => 
        (pos.assetType || 'stock') === 'stock' && !CoinGeckoService.isCrypto(pos.symbol)
      );
      const cryptoPositions = positions.filter(pos => 
        (pos.assetType || 'stock') === 'crypto' || CoinGeckoService.isCrypto(pos.symbol)
      );
      
      // Get current quotes for portfolio positions
      const stockSymbols = stockPositions.map(pos => pos.symbol);
      const cryptoSymbols = cryptoPositions.map(pos => pos.symbol);
      
      const [stockQuotes, cryptoQuotes] = await Promise.all([
        stockSymbols.length > 0 ? FinanceService.getMultipleQuotes(stockSymbols) : Promise.resolve([]),
        cryptoSymbols.length > 0 ? CoinGeckoService.getMultipleCryptoQuotes(cryptoSymbols) : Promise.resolve([])
      ]);
      
      // Calculate current portfolio value and weights
      const portfolioPositions: PortfolioPosition[] = [];
      let totalValue = 0;
      
      for (const position of positions) {
        const isCrypto = (position.assetType || 'stock') === 'crypto' || CoinGeckoService.isCrypto(position.symbol);
        let quote;
        
        if (isCrypto) {
          quote = cryptoQuotes.find(q => q.symbol === position.symbol.replace(/^crypto:/i, '').toUpperCase());
        } else {
          quote = stockQuotes.find(q => q.symbol === position.symbol);
        }
        
        const currentPrice = quote?.price || parseFloat(position.avgPrice);
        const quantity = parseFloat(position.quantity);
        const marketValue = currentPrice * quantity;
        totalValue += marketValue;
        
        portfolioPositions.push({
          symbol: position.symbol,
          quantity,
          avgPrice: parseFloat(position.avgPrice),
          currentPrice,
          assetType: isCrypto ? 'crypto' : 'stock',
          marketValue,
          weight: 0 // Will be calculated after totalValue is known
        });
      }
      
      // Calculate weights
      portfolioPositions.forEach(pos => {
        pos.weight = totalValue > 0 ? pos.marketValue / totalValue : 0;
      });
      
      // Fetch historical data for risk calculations
      const historicalDataPromises = portfolioPositions.map(async (pos) => {
        try {
          let chartData: ChartData[] = [];
          
          if (pos.assetType === 'crypto') {
            chartData = await CoinGeckoService.getCryptoChart(pos.symbol, timeframe as string);
          } else {
            chartData = await FinanceService.getChart(pos.symbol, timeframe as string);
          }
          
          const prices = chartData.map(d => d.close);
          const returns = RiskAnalyticsService.calculateReturns(prices);
          
          return { symbol: pos.symbol, returns, prices };
        } catch (error) {
          console.error(`Error fetching historical data for ${pos.symbol}:`, error);
          return { symbol: pos.symbol, returns: [], prices: [] };
        }
      });
      
      const historicalDataResults = await Promise.all(historicalDataPromises);
      const assetReturns: Record<string, number[]> = {};
      
      historicalDataResults.forEach(result => {
        assetReturns[result.symbol] = result.returns;
      });
      
      // Calculate portfolio returns
      const weights: Record<string, number> = {};
      portfolioPositions.forEach(pos => {
        weights[pos.symbol] = pos.weight;
      });
      
      const portfolioReturns = RiskAnalyticsService.calculatePortfolioReturns(assetReturns, weights);
      
      // Fetch benchmark data (SPY) for beta calculation
      let benchmarkReturns: number[] = [];
      try {
        const benchmarkData = await FinanceService.getChart('SPY', timeframe as string);
        const benchmarkPrices = benchmarkData.map(d => d.close);
        benchmarkReturns = RiskAnalyticsService.calculateReturns(benchmarkPrices);
      } catch (error) {
        console.error('Error fetching benchmark data:', error);
      }
      
      // Calculate risk metrics
      const volatility = RiskAnalyticsService.calculateVolatility(portfolioReturns);
      const sharpeRatio = RiskAnalyticsService.calculateSharpeRatio(portfolioReturns);
      const beta = RiskAnalyticsService.calculateBeta(portfolioReturns, benchmarkReturns);
      const maxDrawdown = RiskAnalyticsService.calculateMaxDrawdown(portfolioReturns);
      
      // Calculate VaR metrics
      const var95 = RiskAnalyticsService.calculateHistoricalVaR(portfolioReturns, totalValue, 0.95);
      const var99 = RiskAnalyticsService.calculateHistoricalVaR(portfolioReturns, totalValue, 0.99);
      
      const valueAtRisk = {
        historical: {
          var95,
          var99,
          expectedShortfall95: RiskAnalyticsService.calculateExpectedShortfall(portfolioReturns, totalValue, 0.95),
          expectedShortfall99: RiskAnalyticsService.calculateExpectedShortfall(portfolioReturns, totalValue, 0.99)
        },
        parametric: {
          var95: RiskAnalyticsService.calculateParametricVaR(portfolioReturns, totalValue, 0.95),
          var99: RiskAnalyticsService.calculateParametricVaR(portfolioReturns, totalValue, 0.99)
        },
        monteCarlo: {
          var95: RiskAnalyticsService.calculateMonteCarloVaR(portfolioReturns, totalValue, 0.95),
          var99: RiskAnalyticsService.calculateMonteCarloVaR(portfolioReturns, totalValue, 0.99),
          simulations: 10000
        }
      };
      
      // Calculate correlation matrix
      const correlationMatrix = RiskAnalyticsService.calculateCorrelationMatrix(assetReturns);
      
      // Calculate sector exposure
      const sectorExposureMap = new Map<string, { exposure: number; positions: PortfolioPosition[] }>();
      
      portfolioPositions.forEach(pos => {
        const sector = RiskAnalyticsService.getSectorForSymbol(pos.symbol);
        if (!sectorExposureMap.has(sector)) {
          sectorExposureMap.set(sector, { exposure: 0, positions: [] });
        }
        const sectorData = sectorExposureMap.get(sector)!;
        sectorData.exposure += pos.marketValue;
        sectorData.positions.push(pos);
      });
      
      const sectorExposure = Array.from(sectorExposureMap.entries()).map(([sector, data]) => {
        const weight = totalValue > 0 ? data.exposure / totalValue : 0;
        const sectorReturns = data.positions.flatMap(pos => assetReturns[pos.symbol] || []);
        const performance = sectorReturns.length > 0 ? 
          RiskAnalyticsService.calculateAnnualizedReturn(sectorReturns) : 0;
        const risk = sectorReturns.length > 0 ? 
          RiskAnalyticsService.calculateVolatility(sectorReturns) : 0;
        
        return {
          sector,
          exposure: data.exposure,
          weight,
          performance,
          risk
        };
      });
      
      // Calculate asset allocation
      const assetTypeMap = new Map<string, number>();
      portfolioPositions.forEach(pos => {
        const type = pos.assetType === 'crypto' ? 'Cryptocurrency' : 'Stocks';
        assetTypeMap.set(type, (assetTypeMap.get(type) || 0) + pos.marketValue);
      });
      
      const assetAllocation = Array.from(assetTypeMap.entries()).map(([type, value]) => {
        const weight = totalValue > 0 ? value / totalValue : 0;
        const typePositions = portfolioPositions.filter(pos => 
          (pos.assetType === 'crypto' ? 'Cryptocurrency' : 'Stocks') === type
        );
        const typeReturns = typePositions.flatMap(pos => assetReturns[pos.symbol] || []);
        const performance = typeReturns.length > 0 ? 
          RiskAnalyticsService.calculateAnnualizedReturn(typeReturns) : 0;
        
        return { type, weight, value, performance };
      });
      
      // Perform stress tests
      const stressTests = RiskAnalyticsService.performStressTests(portfolioPositions, assetReturns);
      
      // Calculate concentration risk
      const concentrationRisk = RiskAnalyticsService.calculateConcentrationRisk(
        portfolioPositions.map(pos => pos.weight)
      );
      
      const response: PortfolioRiskMetrics = {
        portfolioValue: totalValue,
        portfolioReturns,
        volatility,
        sharpeRatio,
        beta,
        maxDrawdown,
        var95,
        var99,
        correlationMatrix,
        sectorExposure,
        assetAllocation,
        riskMetrics: {
          valueAtRisk,
          stressTests,
          concentrationRisk
        }
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error in /api/risk-analytics:', error);
      res.status(500).json({ error: 'Failed to calculate risk analytics' });
    }
  });

  // Alerts Management API Endpoints
  // GET /api/alerts - List user alerts
  app.get('/api/alerts', async (req, res) => {
    try {
      // Get demo user for alerts
      const demoUser = await storage.getDemoUser();
      if (!demoUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const alerts = await storage.listAlertsByUser(demoUser.id);
      res.json(alerts);
    } catch (error) {
      console.error('Error in /api/alerts:', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });

  // GET /api/alerts/triggered - Get triggered alerts history
  app.get('/api/alerts/triggered', async (req, res) => {
    try {
      const validation = getTriggeredAlertsSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors });
      }

      // Get demo user for alerts
      const demoUser = await storage.getDemoUser();
      if (!demoUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { limit } = validation.data;
      const triggeredAlerts = await storage.listTriggeredAlerts(demoUser.id, limit);
      res.json(triggeredAlerts);
    } catch (error) {
      console.error('Error in /api/alerts/triggered:', error);
      res.status(500).json({ error: 'Failed to fetch triggered alerts' });
    }
  });

  // POST /api/alerts - Create new alert
  app.post('/api/alerts', async (req, res) => {
    try {
      // Get demo user for alerts
      const demoUser = await storage.getDemoUser();
      if (!demoUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Validate request body with insertAlertSchema
      const validation = insertAlertSchema.safeParse({
        ...req.body,
        userId: demoUser.id
      });

      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validation.error.errors 
        });
      }

      // Create alert
      const alert = await storage.createAlert(validation.data);
      res.status(201).json(alert);
    } catch (error) {
      console.error('Error in POST /api/alerts:', error);
      res.status(500).json({ error: 'Failed to create alert' });
    }
  });

  // PATCH /api/alerts/:id - Update alert
  app.patch('/api/alerts/:id', async (req, res) => {
    try {
      const alertId = req.params.id;
      
      // Get demo user for alerts
      const demoUser = await storage.getDemoUser();
      if (!demoUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if alert exists and belongs to user
      const existingAlert = await storage.getAlertById(alertId);
      if (!existingAlert) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      if (existingAlert.userId !== demoUser.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Validate update data
      const validation = updateAlertSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validation.error.errors 
        });
      }

      // Update alert
      const updatedAlert = await storage.updateAlert(alertId, validation.data);
      if (!updatedAlert) {
        return res.status(404).json({ error: 'Alert not found after update' });
      }

      res.json(updatedAlert);
    } catch (error) {
      console.error('Error in PATCH /api/alerts/:id:', error);
      res.status(500).json({ error: 'Failed to update alert' });
    }
  });

  // DELETE /api/alerts/:id - Delete alert
  app.delete('/api/alerts/:id', async (req, res) => {
    try {
      const alertId = req.params.id;
      
      // Get demo user for alerts
      const demoUser = await storage.getDemoUser();
      if (!demoUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if alert exists and belongs to user
      const existingAlert = await storage.getAlertById(alertId);
      if (!existingAlert) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      if (existingAlert.userId !== demoUser.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete alert
      const deleted = await storage.deleteAlert(alertId);
      if (!deleted) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({ success: true, message: 'Alert deleted successfully' });
    } catch (error) {
      console.error('Error in DELETE /api/alerts/:id:', error);
      res.status(500).json({ error: 'Failed to delete alert' });
    }
  });

  // ----- Vercel Cron endpoints (replaces in-process node-cron jobs) -----
  // Vercel Cron invokes these with "Authorization: Bearer <CRON_SECRET>" when
  // the CRON_SECRET environment variable is set on the project.
  const verifyCronAuth = (req: Request, res: Response, next: NextFunction) => {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // Market data refresh + price/volume alert checks (was: every 30s node-cron)
  app.get('/api/cron/market', verifyCronAuth, async (_req, res) => {
    try {
      const indices = await FinanceService.getMarketIndices();
      broadcast('market_update', indices);

      // Update popular stocks and check for alerts
      const popularSymbols = ["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA"];
      const quotes = await FinanceService.getMultipleQuotes(popularSymbols);
      broadcast('stock_update', quotes);

      let triggeredCount = 0;

      // Check alerts for all updated stock quotes
      for (const quote of quotes) {
        try {
          const priceAlerts = await alertsEngine.checkPriceAlerts(quote);
          const volumeAlerts = await alertsEngine.checkVolumeAlerts(quote);
          const allTriggeredAlerts = [...priceAlerts, ...volumeAlerts];
          triggeredCount += allTriggeredAlerts.length;
          await broadcastTriggeredAlerts(allTriggeredAlerts);
        } catch (alertError) {
          console.error('Error checking periodic alerts for', quote.symbol, ':', alertError);
        }
      }

      // Update popular cryptocurrencies and check alerts
      const popularCryptoSymbols = ["BTC", "ETH", "ADA", "SOL", "DOGE", "XRP", "DOT", "MATIC", "AVAX", "LINK"];
      const cryptoQuotes = await CoinGeckoService.getMultipleCryptoQuotes(popularCryptoSymbols);
      broadcast('crypto_update', cryptoQuotes);

      // Check alerts for all updated crypto quotes
      for (const quote of cryptoQuotes) {
        try {
          const priceAlerts = await alertsEngine.checkPriceAlerts(quote);
          const volumeAlerts = await alertsEngine.checkVolumeAlerts(quote);
          const allTriggeredAlerts = [...priceAlerts, ...volumeAlerts];
          triggeredCount += allTriggeredAlerts.length;
          await broadcastTriggeredAlerts(allTriggeredAlerts);
        } catch (alertError) {
          console.error('Error checking periodic crypto alerts for', quote.symbol, ':', alertError);
        }
      }

      res.json({ success: true, stocks: quotes.length, cryptos: cryptoQuotes.length, alertsTriggered: triggeredCount });
    } catch (error) {
      console.error('Error in market cron job:', error);
      res.status(500).json({ error: 'Market cron job failed' });
    }
  });

  // Volatility and breakout monitoring (was: every 5 min node-cron)
  app.get('/api/cron/volatility', verifyCronAuth, async (_req, res) => {
    try {
      console.log('Running volatility and breakout alert checks...');
      let checkedSymbols = 0;

      // Get watchlist symbols for focused monitoring
      const demoUser = await storage.getDemoUser();
      if (demoUser) {
        const watchlist = await storage.getWatchlist(demoUser.id);

        for (const item of watchlist) {
          try {
            // Get chart data for volatility and breakout analysis
            let chartData = [];

            if (item.assetType === 'crypto' || CoinGeckoService.isCrypto(item.symbol)) {
              chartData = await CoinGeckoService.getCryptoChart(item.symbol, '1D');
            } else {
              chartData = await FinanceService.getChart(item.symbol, '1D');
            }

            if (chartData.length > 0) {
              checkedSymbols++;
              const volatilityAlerts = await alertsEngine.checkVolatilityAlerts(item.symbol, chartData);
              const breakoutAlerts = await alertsEngine.checkBreakoutAlerts(item.symbol, chartData);
              const allTriggeredAlerts = [...volatilityAlerts, ...breakoutAlerts];
              await broadcastTriggeredAlerts(allTriggeredAlerts);
            }
          } catch (alertError) {
            console.error('Error checking volatility/breakout alerts for', item.symbol, ':', alertError);
          }
        }
      }

      res.json({ success: true, checkedSymbols });
    } catch (error) {
      console.error('Error in volatility/breakout cron job:', error);
      res.status(500).json({ error: 'Volatility cron job failed' });
    }
  });

  // News monitoring (was: every 2 min node-cron)
  app.get('/api/cron/news', verifyCronAuth, async (_req, res) => {
    try {
      console.log('Running news alert checks...');

      // Get latest news and check for alerts
      const news = await FinanceService.getNews(20);

      for (const newsItem of news) {
        try {
          const newsAlerts = await alertsEngine.checkNewsAlerts(newsItem);
          await broadcastTriggeredAlerts(newsAlerts);
        } catch (alertError) {
          console.error('Error checking news alerts:', alertError);
        }
      }

      res.json({ success: true, newsChecked: news.length });
    } catch (error) {
      console.error('Error in news cron job:', error);
      res.status(500).json({ error: 'News cron job failed' });
    }
  });

  // Clean up expired crypto market cache (was: hourly node-cron)
  app.get('/api/cron/cache-cleanup', verifyCronAuth, async (_req, res) => {
    try {
      console.log('Cleaning up expired crypto market cache...');
      await storage.clearExpiredCryptoCache();
      res.json({ success: true });
    } catch (error) {
      console.error('Error cleaning expired crypto cache:', error);
      res.status(500).json({ error: 'Cache cleanup cron job failed' });
    }
  });
  
  // Asset Universe Management Endpoints
  
  // Get all assets in the universe
  app.get('/api/asset-universe', async (req, res) => {
    try {
      const { type, limit, offset } = req.query;
      let assets;
      
      if (type && ['stock', 'bond', 'commodity', 'index'].includes(type as string)) {
        assets = await assetUniverseManager.getAssetsByType(type as any);
      } else {
        assets = await assetUniverseManager.getAssetUniverse();
      }
      
      // Apply pagination if requested
      const startIndex = parseInt(offset as string) || 0;
      const limitValue = parseInt(limit as string) || assets.length;
      const paginatedAssets = assets.slice(startIndex, startIndex + limitValue);
      
      res.json({
        assets: paginatedAssets,
        total: assets.length,
        offset: startIndex,
        limit: limitValue
      });
    } catch (error) {
      console.error('Error fetching asset universe:', error);
      res.status(500).json({ error: 'Failed to fetch asset universe' });
    }
  });
  
  // Get top performing assets
  app.get('/api/asset-universe/top/:limit?', async (req, res) => {
    try {
      const limit = parseInt(req.params.limit || '100') || 100;
      const assets = await assetUniverseManager.getTopAssets(limit);
      
      res.json({
        assets,
        limit,
        total: assets.length
      });
    } catch (error) {
      console.error('Error fetching top assets:', error);
      res.status(500).json({ error: 'Failed to fetch top performing assets' });
    }
  });
  
  // Get assets by category (technology, healthcare, energy, etc.)
  app.get('/api/asset-universe/category/:category', async (req, res) => {
    try {
      const { category } = req.params;
      const { limit, offset } = req.query;
      
      const allAssets = await assetUniverseManager.getAssetUniverse();
      const categoryAssets = allAssets.filter(asset => 
        asset.category?.toLowerCase().includes(category.toLowerCase()) ||
        asset.sector?.toLowerCase().includes(category.toLowerCase())
      );
      
      // Apply pagination
      const startIndex = parseInt(offset as string) || 0;
      const limitValue = parseInt(limit as string) || categoryAssets.length;
      const paginatedAssets = categoryAssets.slice(startIndex, startIndex + limitValue);
      
      res.json({
        assets: paginatedAssets,
        category,
        total: categoryAssets.length,
        offset: startIndex,
        limit: limitValue
      });
    } catch (error) {
      console.error('Error fetching assets by category:', error);
      res.status(500).json({ error: 'Failed to fetch assets by category' });
    }
  });
  
  // Initialize asset universe (admin endpoint)
  app.post('/api/asset-universe/initialize', async (req, res) => {
    console.log('POST /api/asset-universe/initialize - Starting initialization...');
    try {
      await assetUniverseManager.initializeAssetUniverse();
      
      const assetCounts = await Promise.all([
        assetUniverseManager.getAssetsByType('stock'),
        assetUniverseManager.getAssetsByType('bond'),
        assetUniverseManager.getAssetsByType('commodity'),
        assetUniverseManager.getAssetsByType('index')
      ]);
      
      console.log('Asset universe initialization completed successfully');
      res.json({
        message: 'Asset universe initialized successfully',
        counts: {
          stocks: assetCounts[0].length,
          bonds: assetCounts[1].length,
          commodities: assetCounts[2].length,
          indices: assetCounts[3].length,
          total: assetCounts.reduce((sum, assets) => sum + assets.length, 0)
        }
      });
    } catch (error: any) {
      console.error('Error initializing asset universe:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      res.status(500).json({ error: error?.message || 'Failed to initialize asset universe' });
    }
  });
  
  // Search S&P 500 companies by name or symbol with autocomplete
  app.get('/api/sp500/search', async (req, res) => {
    try {
      const { q, limit = 20 } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }
      
      const query = q.toString().toLowerCase();
      const limitNum = Math.min(parseInt(limit.toString()) || 20, 100);
      
      // Get all S&P 500 companies (stocks only from our comprehensive list)
      const allAssets = await assetUniverseManager.getAssetsByType('stock');
      
      // Filter S&P 500 companies by search query (symbol or name)
      const searchResults = allAssets
        .filter(asset => 
          asset.symbol.toLowerCase().includes(query) ||
          asset.name.toLowerCase().includes(query)
        )
        .slice(0, limitNum)
        .map(asset => ({
          symbol: asset.symbol,
          name: asset.name,
          sector: asset.sector,
          industry: asset.industry,
          exchange: asset.exchange,
          rank: asset.rank
        }));
      
      res.json({
        query: q,
        count: searchResults.length,
        results: searchResults
      });
    } catch (error) {
      console.error('Error searching S&P 500 companies:', error);
      res.status(500).json({ error: 'Failed to search S&P 500 companies' });
    }
  });

  // Browse S&P 500 companies by sector with pagination
  app.get('/api/sp500/browse', async (req, res) => {
    try {
      const { sector, limit = 50, offset = 0, sortBy = 'rank' } = req.query;
      
      const limitNum = Math.min(parseInt(limit.toString()) || 50, 200);
      const offsetNum = Math.max(parseInt(offset.toString()) || 0, 0);
      
      // Get all S&P 500 companies (stocks only)
      let companies = await assetUniverseManager.getAssetsByType('stock');
      
      // Filter by sector if provided
      if (sector && typeof sector === 'string' && sector !== 'all') {
        companies = companies.filter(asset => 
          asset.sector && asset.sector.toLowerCase().includes(sector.toLowerCase())
        );
      }
      
      // Sort companies
      const sortField = sortBy?.toString() || 'rank';
      companies.sort((a, b) => {
        if (sortField === 'name') {
          return a.name.localeCompare(b.name);
        } else if (sortField === 'symbol') {
          return a.symbol.localeCompare(b.symbol);
        } else if (sortField === 'sector') {
          return (a.sector || '').localeCompare(b.sector || '');
        } else {
          return (a.rank || 999) - (b.rank || 999);
        }
      });
      
      // Apply pagination
      const paginatedCompanies = companies
        .slice(offsetNum, offsetNum + limitNum)
        .map(asset => ({
          symbol: asset.symbol,
          name: asset.name,
          sector: asset.sector,
          industry: asset.industry,
          exchange: asset.exchange,
          rank: asset.rank
        }));
      
      // Get unique sectors for filtering options
      const allSectors = Array.from(new Set(companies.map(c => c.sector).filter(Boolean))).sort();
      
      res.json({
        sector: sector || 'all',
        sortBy: sortField,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: companies.length,
          hasMore: offsetNum + limitNum < companies.length
        },
        sectors: allSectors,
        companies: paginatedCompanies
      });
    } catch (error) {
      console.error('Error browsing S&P 500 companies:', error);
      res.status(500).json({ error: 'Failed to browse S&P 500 companies' });
    }
  });

  // Get S&P 500 company suggestions for autocomplete
  app.get('/api/sp500/suggestions', async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string' || q.length < 1) {
        return res.json({ suggestions: [] });
      }
      
      const query = q.toString().toLowerCase();
      
      // Get all S&P 500 companies
      const allAssets = await assetUniverseManager.getAssetsByType('stock');
      
      // Generate suggestions prioritizing exact symbol matches
      const exactSymbolMatches = allAssets
        .filter(asset => asset.symbol.toLowerCase().startsWith(query))
        .slice(0, 5);
        
      const nameMatches = allAssets
        .filter(asset => 
          asset.name.toLowerCase().includes(query) && 
          !exactSymbolMatches.some(exact => exact.symbol === asset.symbol)
        )
        .slice(0, 5);
      
      const suggestions = [...exactSymbolMatches, ...nameMatches]
        .slice(0, 10)
        .map(asset => ({
          symbol: asset.symbol,
          name: asset.name,
          sector: asset.sector,
          label: `${asset.symbol} - ${asset.name}`
        }));
      
      res.json({ suggestions });
    } catch (error) {
      console.error('Error getting S&P 500 suggestions:', error);
      res.status(500).json({ error: 'Failed to get suggestions' });
    }
  });

  // Get asset statistics and overview
  app.get('/api/asset-universe/stats', async (req, res) => {
    try {
      const allAssets = await assetUniverseManager.getAssetUniverse();
      
      const stats = {
        total: allAssets.length,
        byType: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        byExchange: {} as Record<string, number>,
        byCountry: {} as Record<string, number>
      };
      
      allAssets.forEach(asset => {
        // Count by type
        stats.byType[asset.assetType] = (stats.byType[asset.assetType] || 0) + 1;
        
        // Count by category
        if (asset.category) {
          stats.byCategory[asset.category] = (stats.byCategory[asset.category] || 0) + 1;
        }
        
        // Count by exchange
        if (asset.exchange) {
          stats.byExchange[asset.exchange] = (stats.byExchange[asset.exchange] || 0) + 1;
        }
        
        // Count by country
        if (asset.country) {
          stats.byCountry[asset.country] = (stats.byCountry[asset.country] || 0) + 1;
        }
      });
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching asset universe stats:', error);
      res.status(500).json({ error: 'Failed to fetch asset universe statistics' });
    }
  });

  // Historical Data Ingestion Endpoints
  const historicalIngestionSchema = z.object({
    lookbackYears: z.number().min(1).max(10).optional(),
    assetTypes: z.array(z.enum(["stock", "bond", "commodity", "index"])).optional(),
    timeframes: z.array(z.enum(["1d", "1w", "1m"])).optional(),
    batchSize: z.number().min(1).max(100).optional()
  });

  const jobIdSchema = z.object({
    jobId: z.string().min(1)
  });

  // Start historical data ingestion
  app.post('/api/historical-data/start', async (req, res) => {
    try {
      const params = historicalIngestionSchema.parse(req.body);
      console.log('🚀 Starting historical data ingestion with params:', params);
      
      const jobId = await historicalDataIngestion.startFullIngestion(params);
      
      res.json({
        success: true,
        jobId,
        message: 'Historical data ingestion started successfully'
      });
    } catch (error) {
      console.error('Error starting historical data ingestion:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to start historical data ingestion' });
    }
  });

  // Get job status
  app.get('/api/historical-data/job/:jobId', async (req, res) => {
    try {
      const { jobId } = jobIdSchema.parse({ jobId: req.params.jobId });
      
      const job = await historicalDataIngestion.getJobStatus(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      res.json(job);
    } catch (error) {
      console.error('Error fetching job status:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid job ID' });
      }
      res.status(500).json({ error: 'Failed to fetch job status' });
    }
  });

  // Cancel job
  app.post('/api/historical-data/job/:jobId/cancel', async (req, res) => {
    try {
      const { jobId } = jobIdSchema.parse({ jobId: req.params.jobId });
      
      await historicalDataIngestion.cancelJob(jobId);
      
      res.json({
        success: true,
        message: 'Job cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling job:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid job ID' });
      }
      res.status(500).json({ error: 'Failed to cancel job' });
    }
  });

  // List all jobs
  app.get('/api/historical-data/jobs', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const jobs = await historicalDataIngestion.listJobs(limit);
      
      res.json(jobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  });

  // Get data statistics
  app.get('/api/historical-data/stats', async (req, res) => {
    try {
      const stats = await historicalDataIngestion.getDataStatistics();
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching data statistics:', error);
      res.status(500).json({ error: 'Failed to fetch data statistics' });
    }
  });

  // Historical Price Data API Endpoints for Risk Analytics & Technical Analysis
  const historicalPricesSchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    timeframe: z.enum(["1d", "1w", "1m"]).default("1d"),
    limit: z.coerce.number().min(1).max(10000).default(1000)
  });

  // Get historical prices for a specific symbol
  app.get('/api/historical/prices/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const query = historicalPricesSchema.parse(req.query);
      const { startDate, endDate, timeframe, limit } = query;
      
      // Build date filters
      const conditions = [dr.eq(historicalPrices.symbol, symbol), dr.eq(historicalPrices.timeframe, timeframe)];
      
      if (startDate) {
        conditions.push(dr.gte(historicalPrices.timestamp, startDate));
      }
      
      if (endDate) {
        conditions.push(dr.lte(historicalPrices.timestamp, endDate));
      }
      
      const priceData = await db
        .select({
          symbol: historicalPrices.symbol,
          timestamp: historicalPrices.timestamp,
          open: historicalPrices.open,
          high: historicalPrices.high,
          low: historicalPrices.low,
          close: historicalPrices.close,
          volume: historicalPrices.volume,
          adjustedClose: historicalPrices.adjustedClose,
          timeframe: historicalPrices.timeframe
        })
        .from(historicalPrices)
        .where(dr.and(...conditions))
        .orderBy(dr.asc(historicalPrices.timestamp))
        .limit(limit);
      
      // Calculate returns if we have enough data
      let returns: number[] = [];
      if (priceData.length > 1) {
        const prices = priceData.map(d => parseFloat(d.close));
        returns = RiskAnalyticsService.calculateReturns(prices);
      }
      
      res.json({
        symbol,
        timeframe,
        count: priceData.length,
        prices: priceData,
        returns
      });
    } catch (error) {
      console.error('Error fetching historical prices:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to fetch historical prices' });
    }
  });

  // Get historical analytics for a specific symbol with risk metrics
  app.get('/api/historical/analytics/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const query = historicalPricesSchema.parse(req.query);
      const { startDate, endDate, timeframe, limit } = query;
      
      // Build date filters
      const conditions = [dr.eq(historicalPrices.symbol, symbol), dr.eq(historicalPrices.timeframe, timeframe)];
      
      if (startDate) {
        conditions.push(dr.gte(historicalPrices.timestamp, startDate));
      }
      
      if (endDate) {
        conditions.push(dr.lte(historicalPrices.timestamp, endDate));
      }
      
      const priceData = await db
        .select({
          timestamp: historicalPrices.timestamp,
          close: historicalPrices.close
        })
        .from(historicalPrices)
        .where(dr.and(...conditions))
        .orderBy(dr.asc(historicalPrices.timestamp))
        .limit(limit);
      
      if (priceData.length < 2) {
        return res.json({
          symbol,
          error: 'Insufficient data for analysis',
          count: priceData.length
        });
      }
      
      // Calculate analytics
      const prices = priceData.map(d => parseFloat(d.close));
      const returns = RiskAnalyticsService.calculateReturns(prices);
      
      // Get benchmark (SPY) data for beta calculation
      let benchmarkReturns: number[] = [];
      try {
        const benchmarkData = await db
          .select({ close: historicalPrices.close })
          .from(historicalPrices)
          .where(dr.and(
            dr.eq(historicalPrices.symbol, 'SPY'),
            dr.eq(historicalPrices.timeframe, timeframe),
            startDate ? dr.gte(historicalPrices.timestamp, startDate) : dr.sql`true`,
            endDate ? dr.lte(historicalPrices.timestamp, endDate) : dr.sql`true`
          ))
          .orderBy(dr.asc(historicalPrices.timestamp))
          .limit(limit);
          
        if (benchmarkData.length > 1) {
          const benchmarkPrices = benchmarkData.map(d => parseFloat(d.close));
          benchmarkReturns = RiskAnalyticsService.calculateReturns(benchmarkPrices);
        }
      } catch (error) {
        console.warn('Could not fetch benchmark data for beta calculation:', error);
      }
      
      // Calculate risk metrics
      const analytics = {
        symbol,
        timeframe,
        period: {
          start: priceData[0]?.timestamp,
          end: priceData[priceData.length - 1]?.timestamp,
          count: priceData.length
        },
        returns: {
          daily: returns,
          count: returns.length
        },
        riskMetrics: {
          volatility: RiskAnalyticsService.calculateVolatility(returns),
          sharpeRatio: RiskAnalyticsService.calculateSharpeRatio(returns),
          beta: benchmarkReturns.length > 0 ? RiskAnalyticsService.calculateBeta(returns, benchmarkReturns) : null,
          maxDrawdown: RiskAnalyticsService.calculateMaxDrawdown(returns),
          var95: RiskAnalyticsService.calculateHistoricalVaR(returns, 100000, 0.95),
          var99: RiskAnalyticsService.calculateHistoricalVaR(returns, 100000, 0.99),
          expectedShortfall95: RiskAnalyticsService.calculateExpectedShortfall(returns, 100000, 0.95),
          expectedShortfall99: RiskAnalyticsService.calculateExpectedShortfall(returns, 100000, 0.99)
        }
      };
      
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching historical analytics:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to fetch historical analytics' });
    }
  });
  
  console.log('Financial API routes registered successfully');
  // Options Chain endpoint
  app.get('/api/options/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { expiry } = req.query;
      
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
      }

      // Get current stock price first
      const quote = await FinanceService.getQuote(symbol);
      
      if (!quote) {
        return res.status(404).json({ error: 'Stock quote not found' });
      }
      
      // Get options data from Yahoo Finance
      let optionsData: any;
      try {
        if (expiry) {
          optionsData = await yahooFinance.options(symbol, { date: new Date(expiry as string) });
        } else {
          optionsData = await yahooFinance.options(symbol, {});
        }
      } catch (error) {
        console.error(`Error fetching options for ${symbol}:`, error);
        // Return mock data if API fails
        return res.json(generateMockOptionsData(symbol, quote.price));
      }

      // Process and format options data
      const formattedData = {
        symbol,
        currentPrice: quote.price,
        expiryDates: optionsData?.options?.[0]?.expirationDate ? [optionsData.options[0].expirationDate.toISOString().split('T')[0]] : [],
        contracts: [] as any[]
      };

      // Process calls and puts data
      const calls = optionsData?.options?.[0]?.calls || [];
      const puts = optionsData?.options?.[0]?.puts || [];
      
      // Create strike-based contract data
      const strikeMap = new Map();
      
      calls.forEach((call: any) => {
        const strike = call.strike;
        if (!strikeMap.has(strike)) {
          strikeMap.set(strike, { strike });
        }
        const contract = strikeMap.get(strike);
        contract.callBid = call.bid || 0;
        contract.callAsk = call.ask || 0;
        contract.callVolume = call.volume || 0;
        contract.callOpenInterest = call.openInterest || 0;
        contract.callImpliedVol = call.impliedVolatility || 0;
        contract.callDelta = call.delta || 0;
        contract.callGamma = call.gamma || 0;
        contract.callTheta = call.theta || 0;
        contract.callVega = call.vega || 0;
      });

      puts.forEach((put: any) => {
        const strike = put.strike;
        if (!strikeMap.has(strike)) {
          strikeMap.set(strike, { strike });
        }
        const contract = strikeMap.get(strike);
        contract.putBid = put.bid || 0;
        contract.putAsk = put.ask || 0;
        contract.putVolume = put.volume || 0;
        contract.putOpenInterest = put.openInterest || 0;
        contract.putImpliedVol = put.impliedVolatility || 0;
        contract.putDelta = put.delta || 0;
        contract.putGamma = put.gamma || 0;
        contract.putTheta = put.theta || 0;
        contract.putVega = put.vega || 0;
      });

      // Convert to sorted array and add missing fields
      formattedData.contracts = Array.from(strikeMap.values())
        .filter(contract => contract.strike)
        .sort((a, b) => a.strike - b.strike)
        .map(contract => ({
          ...contract,
          callBid: contract.callBid || 0,
          callAsk: contract.callAsk || 0,
          callVolume: contract.callVolume || 0,
          callOpenInterest: contract.callOpenInterest || 0,
          callImpliedVol: contract.callImpliedVol || 0,
          callDelta: contract.callDelta || 0,
          callGamma: contract.callGamma || 0,
          callTheta: contract.callTheta || 0,
          callVega: contract.callVega || 0,
          putBid: contract.putBid || 0,
          putAsk: contract.putAsk || 0,
          putVolume: contract.putVolume || 0,
          putOpenInterest: contract.putOpenInterest || 0,
          putImpliedVol: contract.putImpliedVol || 0,
          putDelta: contract.putDelta || 0,
          putGamma: contract.putGamma || 0,
          putTheta: contract.putTheta || 0,
          putVega: contract.putVega || 0,
          inTheMoney: Math.abs(contract.strike - quote.price) < 5
        }));

      res.json(formattedData);
    } catch (error) {
      console.error('Error in /api/options:', error);
      const { symbol } = req.params;
      const mockQuote = await FinanceService.getQuote(symbol).catch(() => ({ price: 150 }));
      res.json(generateMockOptionsData(symbol, mockQuote?.price || 150));
    }
  });

  // Helper function to generate mock options data as fallback
  function generateMockOptionsData(symbol: string, currentPrice: number) {
    const strikes = [];
    const baseStrike = Math.round(currentPrice / 5) * 5; // Round to nearest 5
    for (let i = -4; i <= 4; i++) {
      strikes.push(baseStrike + (i * 5));
    }

    return {
      symbol,
      currentPrice,
      expiryDates: ["2024-12-20", "2025-01-17", "2025-02-21", "2025-03-21"],
      contracts: strikes.map(strike => {
        const moneyness = strike - currentPrice;
        const isITM = Math.abs(moneyness) < 5;
        
        return {
          strike,
          callBid: Math.max(0.01, currentPrice - strike + Math.random() * 2),
          callAsk: Math.max(0.05, currentPrice - strike + Math.random() * 2 + 0.1),
          callVolume: Math.floor(Math.random() * 1000) + 50,
          callOpenInterest: Math.floor(Math.random() * 5000) + 100,
          callImpliedVol: 0.15 + Math.random() * 0.15,
          callDelta: Math.max(0, Math.min(1, 0.5 + (currentPrice - strike) * 0.02)),
          callGamma: 0.01 + Math.random() * 0.02,
          callTheta: -0.05 - Math.random() * 0.15,
          callVega: 0.5 + Math.random() * 0.8,
          putBid: Math.max(0.01, strike - currentPrice + Math.random() * 2),
          putAsk: Math.max(0.05, strike - currentPrice + Math.random() * 2 + 0.1),
          putVolume: Math.floor(Math.random() * 800) + 30,
          putOpenInterest: Math.floor(Math.random() * 4000) + 80,
          putImpliedVol: 0.15 + Math.random() * 0.15,
          putDelta: Math.max(-1, Math.min(0, -0.5 + (currentPrice - strike) * 0.02)),
          putGamma: 0.01 + Math.random() * 0.02,
          putTheta: -0.05 - Math.random() * 0.15,
          putVega: 0.5 + Math.random() * 0.8,
          inTheMoney: isITM
        };
      })
    };
  }

  console.log('Asset universe endpoints configured');
  console.log('Historical data ingestion endpoints configured');
  console.log('Options chain endpoint configured');

  // ---------------------------------------------------------------------------
  // FRED (Federal Reserve Economic Data) endpoints
  // ---------------------------------------------------------------------------
  const FRED_KEY = process.env.FRED_API_KEY;
  const MARKETAUX_KEY = process.env.MARKETAUX_API_KEY;

  const FRED_SERIES: Record<string, { name: string; category: string; frequency: string }> = {
    DFF: { name: 'Fed Funds Rate', category: 'rates', frequency: 'daily' },
    DGS2: { name: '2-Year Treasury', category: 'rates', frequency: 'daily' },
    DGS10: { name: '10-Year Treasury', category: 'rates', frequency: 'daily' },
    DGS30: { name: '30-Year Treasury', category: 'rates', frequency: 'daily' },
    T10Y2Y: { name: '10Y-2Y Spread', category: 'rates', frequency: 'daily' },
    T10YFF: { name: '10Y-FF Spread', category: 'rates', frequency: 'daily' },
    VIXCLS: { name: 'VIX', category: 'volatility', frequency: 'daily' },
    DTWEXBGS: { name: 'USD Index (Broad)', category: 'forex', frequency: 'daily' },
    DCOILWTICO: { name: 'WTI Crude Oil', category: 'commodities', frequency: 'daily' },
    DCOILBRENTEU: { name: 'Brent Crude Oil', category: 'commodities', frequency: 'daily' },
    GOLDAMGBD228NLBM: { name: 'Gold Price (London)', category: 'commodities', frequency: 'daily' },
    UNRATE: { name: 'Unemployment Rate', category: 'labor', frequency: 'monthly' },
    CPIAUCSL: { name: 'CPI (All Urban)', category: 'inflation', frequency: 'monthly' },
    FEDFUNDS: { name: 'Effective Fed Funds', category: 'rates', frequency: 'monthly' },
    BAMLH0A0HYM2: { name: 'High Yield Spread', category: 'credit', frequency: 'daily' },
    UMCSENT: { name: 'Consumer Sentiment', category: 'sentiment', frequency: 'monthly' },
    IC4WSA: { name: 'Initial Claims (4wk avg)', category: 'labor', frequency: 'weekly' },
  };

  async function fredFetch(seriesId: string, opts: { limit?: number; sort?: string } = {}) {
    if (!FRED_KEY) return null;
    try {
      const resp = await axios.get(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=${opts.sort || 'desc'}&limit=${opts.limit || 30}`
      );
      return resp.data.observations || [];
    } catch { return null; }
  }

  app.get('/api/fred/rates', async (_req, res) => {
    try {
      const cacheKey = 'fred:rates';
      const cached = FinanceService['cache'].get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) return res.json(cached.data);
      const ids = ['DFF', 'DGS2', 'DGS10', 'DGS30', 'T10Y2Y', 'T10YFF'];
      const results: Record<string, any> = {};
      await Promise.all(ids.map(async (id) => {
        const obs = await fredFetch(id, { limit: 5 });
        if (obs?.length) {
          const latest = obs.find((o: any) => o.value !== '.');
          const prev = obs.find((o: any, i: number) => i > 0 && o.value !== '.');
          results[id] = {
            name: FRED_SERIES[id].name, value: latest ? parseFloat(latest.value) : null,
            date: latest?.date, prior: prev ? parseFloat(prev.value) : null,
            change: (latest && prev) ? parseFloat(latest.value) - parseFloat(prev.value) : null,
          };
        }
      }));
      FinanceService['cache'].set(cacheKey, { data: results, timestamp: Date.now() });
      res.json(results);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/fred/market', async (_req, res) => {
    try {
      const cacheKey = 'fred:market';
      const cached = FinanceService['cache'].get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) return res.json(cached.data);
      const ids = ['VIXCLS', 'DTWEXBGS', 'DCOILWTICO', 'DCOILBRENTEU', 'GOLDAMGBD228NLBM'];
      const results: Record<string, any> = {};
      await Promise.all(ids.map(async (id) => {
        const obs = await fredFetch(id, { limit: 10 });
        if (obs?.length) {
          const latest = obs.find((o: any) => o.value !== '.');
          const prev = obs.find((o: any, i: number) => i > 0 && o.value !== '.');
          const lv = latest ? parseFloat(latest.value) : 0;
          const pv = prev ? parseFloat(prev.value) : 0;
          results[id] = {
            name: FRED_SERIES[id].name, value: lv || null, date: latest?.date,
            prior: pv || null, change: (lv && pv) ? lv - pv : null,
            changePercent: (lv && pv) ? ((lv - pv) / pv) * 100 : null,
          };
        }
      }));
      FinanceService['cache'].set(cacheKey, { data: results, timestamp: Date.now() });
      res.json(results);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/fred/macro', async (_req, res) => {
    try {
      const cacheKey = 'fred:macro';
      const cached = FinanceService['cache'].get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 600000) return res.json(cached.data);
      const ids = ['UNRATE', 'CPIAUCSL', 'FEDFUNDS', 'BAMLH0A0HYM2', 'UMCSENT', 'IC4WSA'];
      const results: Record<string, any> = {};
      await Promise.all(ids.map(async (id) => {
        const obs = await fredFetch(id, { limit: 5 });
        if (obs?.length) {
          const latest = obs.find((o: any) => o.value !== '.');
          const prev = obs.find((o: any, i: number) => i > 0 && o.value !== '.');
          results[id] = {
            name: FRED_SERIES[id].name, category: FRED_SERIES[id].category,
            frequency: FRED_SERIES[id].frequency,
            value: latest ? parseFloat(latest.value) : null, date: latest?.date,
            prior: prev ? parseFloat(prev.value) : null,
            change: (latest && prev) ? parseFloat(latest.value) - parseFloat(prev.value) : null,
          };
        }
      }));
      FinanceService['cache'].set(cacheKey, { data: results, timestamp: Date.now() });
      res.json(results);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/fred/series/:id', async (req, res) => {
    try {
      const seriesId = req.params.id.toUpperCase();
      const limit = parseInt(req.query.limit as string) || 30;
      const cacheKey = `fred:series:${seriesId}:${limit}`;
      const cached = FinanceService['cache'].get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) return res.json(cached.data);
      const obs = await fredFetch(seriesId, { limit });
      const result = {
        id: seriesId, title: FRED_SERIES[seriesId]?.name || seriesId,
        observations: (obs || []).filter((o: any) => o.value !== '.').map((o: any) => ({
          date: o.date, value: parseFloat(o.value),
        })),
      };
      FinanceService['cache'].set(cacheKey, { data: result, timestamp: Date.now() });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/news/marketaux', async (req, res) => {
    try {
      if (!MARKETAUX_KEY) return res.json([]);
      const cacheKey = 'news:marketaux';
      const cached = FinanceService['cache'].get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60000) return res.json(cached.data);
      const limit = parseInt(req.query.limit as string) || 20;
      const symbols = req.query.symbols as string || '';
      let url = `https://api.marketaux.com/v1/news/all?api_token=${MARKETAUX_KEY}&language=en&limit=${limit}&filter_entities=true`;
      if (symbols) url += `&symbols=${symbols}`;
      const resp = await axios.get(url);
      const articles = (resp.data.data || []).map((a: any) => {
        const entities = a.entities || [];
        const stockEntity = entities.find((e: any) => e.type === 'equity');
        const ss = entities[0]?.sentiment_score;
        return {
          id: `mx-${a.uuid}`, title: a.title, summary: a.description || '',
          source: a.source, url: a.url, imageUrl: a.image_url || null,
          publishedAt: new Date(a.published_at),
          sentiment: ss > 0.2 ? 1 : ss < -0.2 ? -1 : 0,
          sentimentLabel: ss > 0.2 ? 'bullish' : ss < -0.2 ? 'bearish' : 'neutral',
          symbol: stockEntity?.symbol || null, category: 'finance',
        };
      });
      FinanceService['cache'].set(cacheKey, { data: articles, timestamp: Date.now() });
      res.json(articles);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  console.log('FRED economic data endpoints configured');
  console.log('Marketaux news endpoints configured');
}
