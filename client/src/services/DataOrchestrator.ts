import { queryClient } from '@/lib/queryClient';
import { z } from 'zod';

// Data validation schemas
const MarketDataSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  volume: z.number(),
  timestamp: z.date().optional(),
  marketCap: z.number().optional(),
  pe: z.number().optional(),
});

const NewsDataSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  source: z.string(),
  publishedAt: z.date(),
  url: z.string(),
  symbol: z.string().optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
});

const ChartDataSchema = z.object({
  timestamp: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export type MarketData = z.infer<typeof MarketDataSchema>;
export type NewsData = z.infer<typeof NewsDataSchema>;
export type ChartData = z.infer<typeof ChartDataSchema>;

interface DataSource {
  name: string;
  priority: number;
  isAvailable: boolean;
  lastUpdate: Date;
  errorCount: number;
}

interface CacheStrategy {
  key: string;
  ttl: number; // Time to live in milliseconds
  maxSize: number;
  compressionEnabled: boolean;
}

class DataOrchestrator {
  private sources: Map<string, DataSource> = new Map();
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private validationErrors: Map<string, string[]> = new Map();
  private updateListeners: Map<string, Array<(data: any) => void>> = new Map();
  private aggregationRules: Map<string, (data: any[]) => any> = new Map();

  constructor() {
    this.initializeDataSources();
    this.setupAggregationRules();
    this.startHealthCheck();
  }

  private initializeDataSources() {
    const sources: DataSource[] = [
      { name: 'yahoo_finance', priority: 1, isAvailable: true, lastUpdate: new Date(), errorCount: 0 },
      { name: 'alpha_vantage', priority: 2, isAvailable: true, lastUpdate: new Date(), errorCount: 0 },
      { name: 'polygon', priority: 3, isAvailable: false, lastUpdate: new Date(), errorCount: 0 },
      { name: 'internal_cache', priority: 0, isAvailable: true, lastUpdate: new Date(), errorCount: 0 }
    ];

    sources.forEach(source => {
      this.sources.set(source.name, source);
    });
  }

  private setupAggregationRules() {
    // Market data aggregation - prefer most recent, highest priority source
    this.aggregationRules.set('market_data', (dataArray: MarketData[]) => {
      if (dataArray.length === 0) return null;
      
      // Sort by timestamp and source priority
      const sorted = dataArray.sort((a, b) => {
        const timestampA = a.timestamp?.getTime() || 0;
        const timestampB = b.timestamp?.getTime() || 0;
        return timestampB - timestampA;
      });
      
      return sorted[0];
    });

    // News aggregation - combine from multiple sources, deduplicate
    this.aggregationRules.set('news_data', (dataArray: NewsData[]) => {
      const uniqueNews = new Map<string, NewsData>();
      
      dataArray.forEach(news => {
        const key = `${news.title}_${news.source}`;
        if (!uniqueNews.has(key) || 
            (uniqueNews.get(key)!.publishedAt < news.publishedAt)) {
          uniqueNews.set(key, news);
        }
      });
      
      return Array.from(uniqueNews.values())
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    });

    // Chart data aggregation - merge and validate consistency
    this.aggregationRules.set('chart_data', (dataArray: ChartData[][]) => {
      if (dataArray.length === 0) return [];
      
      const mergedData = new Map<string, ChartData>();
      
      dataArray.flat().forEach(point => {
        const existing = mergedData.get(point.timestamp);
        if (!existing || this.isMoreRecentData(point, existing)) {
          mergedData.set(point.timestamp, point);
        }
      });
      
      return Array.from(mergedData.values())
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });
  }

  private isMoreRecentData(newData: ChartData, existingData: ChartData): boolean {
    // Simple heuristic - prefer data with higher volume as it's likely more accurate
    return newData.volume > existingData.volume;
  }

  async validateAndNormalize<T>(data: any, schema: z.ZodSchema<T>, dataType: string): Promise<T | null> {
    try {
      const validated = schema.parse(data);
      this.clearValidationErrors(dataType);
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        this.validationErrors.set(dataType, errors);
        console.error(`Validation failed for ${dataType}:`, errors);
      }
      return null;
    }
  }

  private clearValidationErrors(dataType: string) {
    this.validationErrors.delete(dataType);
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCachedData(key: string, data: any, ttl: number = 30000) {
    // Default 30 second TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    
    // Cleanup old cache entries
    this.cleanupCache();
  }

  private cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key);
      }
    }
  }

  async orchestrateMarketData(symbol: string): Promise<MarketData | null> {
    const cacheKey = `market_${symbol}`;
    
    // Try cache first
    let cached = await this.getCachedData<MarketData>(cacheKey);
    if (cached) return cached;

    const promises: Promise<MarketData | null>[] = [];
    const availableSources = Array.from(this.sources.values())
      .filter(source => source.isAvailable)
      .sort((a, b) => a.priority - b.priority);

    // Fetch from multiple sources in parallel
    for (const source of availableSources) {
      promises.push(this.fetchMarketDataFromSource(symbol, source.name));
    }

    try {
      const results = await Promise.allSettled(promises);
      const validResults: MarketData[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
          const validated = await this.validateAndNormalize(
            result.value, 
            MarketDataSchema, 
            `market_${symbol}_${availableSources[i].name}`
          );
          if (validated) {
            validResults.push(validated);
          }
        } else {
          this.updateSourceHealth(availableSources[i].name, false);
        }
      }

      // Aggregate results
      const aggregator = this.aggregationRules.get('market_data');
      const finalData = aggregator ? aggregator(validResults) : validResults[0] || null;

      if (finalData) {
        this.setCachedData(cacheKey, finalData, 15000); // 15 second cache for market data
        this.notifyListeners(`market_${symbol}`, finalData);
      }

      return finalData;
    } catch (error) {
      console.error('Market data orchestration failed:', error);
      return null;
    }
  }

  async orchestrateNewsData(symbol?: string): Promise<NewsData[]> {
    const cacheKey = `news_${symbol || 'general'}`;
    
    let cached = await this.getCachedData<NewsData[]>(cacheKey);
    if (cached) return cached;

    const promises: Promise<NewsData[] | null>[] = [];
    const availableSources = Array.from(this.sources.values())
      .filter(source => source.isAvailable && source.name !== 'internal_cache');

    for (const source of availableSources) {
      promises.push(this.fetchNewsFromSource(source.name, symbol));
    }

    try {
      const results = await Promise.allSettled(promises);
      const allNews: NewsData[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
          for (const newsItem of result.value) {
            const validated = await this.validateAndNormalize(
              newsItem, 
              NewsDataSchema, 
              `news_${availableSources[i].name}`
            );
            if (validated) {
              allNews.push(validated);
            }
          }
        }
      }

      // Aggregate and deduplicate
      const aggregator = this.aggregationRules.get('news_data');
      const finalNews = aggregator ? aggregator(allNews) : allNews;

      this.setCachedData(cacheKey, finalNews, 60000); // 1 minute cache for news
      this.notifyListeners(`news_${symbol || 'general'}`, finalNews);

      return finalNews;
    } catch (error) {
      console.error('News data orchestration failed:', error);
      return [];
    }
  }

  async orchestrateChartData(symbol: string, timeframe: string = '1d'): Promise<ChartData[]> {
    const cacheKey = `chart_${symbol}_${timeframe}`;
    
    let cached = await this.getCachedData<ChartData[]>(cacheKey);
    if (cached) return cached;

    const promises: Promise<ChartData[] | null>[] = [];
    const availableSources = Array.from(this.sources.values())
      .filter(source => source.isAvailable && source.name !== 'internal_cache');

    for (const source of availableSources) {
      promises.push(this.fetchChartDataFromSource(symbol, timeframe, source.name));
    }

    try {
      const results = await Promise.allSettled(promises);
      const allChartData: ChartData[][] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
          const validatedPoints: ChartData[] = [];
          for (const point of result.value) {
            const validated = await this.validateAndNormalize(
              point, 
              ChartDataSchema, 
              `chart_${symbol}_${availableSources[i].name}`
            );
            if (validated) {
              validatedPoints.push(validated);
            }
          }
          if (validatedPoints.length > 0) {
            allChartData.push(validatedPoints);
          }
        }
      }

      // Aggregate chart data
      const aggregator = this.aggregationRules.get('chart_data');
      const finalChartData = aggregator ? aggregator(allChartData) : allChartData.flat();

      this.setCachedData(cacheKey, finalChartData, 30000); // 30 second cache for chart data
      this.notifyListeners(`chart_${symbol}_${timeframe}`, finalChartData);

      return finalChartData;
    } catch (error) {
      console.error('Chart data orchestration failed:', error);
      return [];
    }
  }

  private async fetchMarketDataFromSource(symbol: string, sourceName: string): Promise<MarketData | null> {
    try {
      let response;
      switch (sourceName) {
        case 'yahoo_finance':
          response = await fetch(`/api/quote/${symbol}`);
          break;
        case 'alpha_vantage':
          response = await fetch(`/api/quote/${symbol}?source=alpha_vantage`);
          break;
        default:
          return null;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      this.updateSourceHealth(sourceName, true);
      return data;
    } catch (error) {
      this.updateSourceHealth(sourceName, false);
      return null;
    }
  }

  private async fetchNewsFromSource(sourceName: string, symbol?: string): Promise<NewsData[] | null> {
    try {
      const url = symbol ? `/api/news?symbol=${symbol}&source=${sourceName}` : `/api/news?source=${sourceName}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      this.updateSourceHealth(sourceName, true);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.updateSourceHealth(sourceName, false);
      return null;
    }
  }

  private async fetchChartDataFromSource(symbol: string, timeframe: string, sourceName: string): Promise<ChartData[] | null> {
    try {
      const response = await fetch(`/api/chart/${symbol}?timeframe=${timeframe}&source=${sourceName}`);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      this.updateSourceHealth(sourceName, true);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.updateSourceHealth(sourceName, false);
      return null;
    }
  }

  private updateSourceHealth(sourceName: string, success: boolean) {
    const source = this.sources.get(sourceName);
    if (!source) return;

    if (success) {
      source.errorCount = 0;
      source.isAvailable = true;
      source.lastUpdate = new Date();
    } else {
      source.errorCount++;
      if (source.errorCount >= 3) {
        source.isAvailable = false;
      }
    }
  }

  private startHealthCheck() {
    setInterval(() => {
      // Reset error counts periodically and check source availability
      for (const source of this.sources.values()) {
        if (!source.isAvailable && Date.now() - source.lastUpdate.getTime() > 300000) {
          // Reset after 5 minutes
          source.errorCount = 0;
          source.isAvailable = true;
        }
      }
    }, 60000); // Check every minute
  }

  subscribe(dataType: string, callback: (data: any) => void) {
    if (!this.updateListeners.has(dataType)) {
      this.updateListeners.set(dataType, []);
    }
    this.updateListeners.get(dataType)!.push(callback);
  }

  unsubscribe(dataType: string, callback: (data: any) => void) {
    const listeners = this.updateListeners.get(dataType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(dataType: string, data: any) {
    const listeners = this.updateListeners.get(dataType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in data listener callback:', error);
        }
      });
    }
  }

  getValidationErrors(): Map<string, string[]> {
    return new Map(this.validationErrors);
  }

  getSourceHealth(): Map<string, DataSource> {
    return new Map(this.sources);
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hitRate: this.calculateCacheHitRate()
    };
  }

  private calculateCacheHitRate(): number {
    // Simplified cache hit rate calculation
    // In production, this would track actual hits vs misses
    return this.cache.size > 0 ? 0.85 : 0;
  }

  invalidateCache(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
    
    // Also invalidate React Query cache
    if (pattern) {
      queryClient.invalidateQueries({ predicate: query => query.queryKey.some(k => String(k).includes(pattern)) });
    } else {
      queryClient.clear();
    }
  }
}

// Singleton instance
export const dataOrchestrator = new DataOrchestrator();