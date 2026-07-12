import { db } from '../db';
import { historicalPrices, dataIngestionJobs, assetUniverse, type InsertHistoricalPrices, type InsertDataIngestionJob } from '../../shared/schema';
import { eq, sql, and, gte, lte, inArray } from 'drizzle-orm';
import yahooFinance from 'yahoo-finance2';

/**
 * Historical Data Ingestion Pipeline
 * Manages comprehensive historical data collection for the asset universe
 * Provides job scheduling, progress tracking, and robust error handling
 */
export class HistoricalDataIngestion {
  private readonly DEFAULT_LOOKBACK_YEARS = 5;
  private readonly BATCH_SIZE = 20; // Assets per batch to avoid API limits
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between API calls
  private readonly MAX_RETRIES = 3;
  private activeJobs = new Map<string, { cancelled: boolean }>();

  /**
   * Start comprehensive historical data ingestion for all assets
   */
  async startFullIngestion(options: {
    lookbackYears?: number;
    assetTypes?: Array<'stock' | 'bond' | 'commodity' | 'index'>;
    timeframes?: Array<'1d' | '1w' | '1m'>;
    batchSize?: number;
  } = {}): Promise<string> {
    const {
      lookbackYears = this.DEFAULT_LOOKBACK_YEARS,
      assetTypes = ['stock', 'commodity', 'index'], // Skip bonds initially (limited data)
      timeframes = ['1d'],
      batchSize = this.BATCH_SIZE
    } = options;

    console.log(`🚀 Starting comprehensive historical data ingestion`);
    console.log(`📊 Timeframes: ${timeframes.join(', ')}`);
    console.log(`🗓️ Lookback: ${lookbackYears} years`);
    console.log(`📈 Asset types: ${assetTypes.join(', ')}`);

    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - lookbackYears);
    const endDate = new Date();

    // Get assets to process
    const assetsQuery = assetTypes.length > 0 
      ? db.select().from(assetUniverse).where(inArray(assetUniverse.assetType, assetTypes))
      : db.select().from(assetUniverse);
    
    const assets = await assetsQuery;
    const totalAssets = assets.length;
    const totalRecords = totalAssets * timeframes.length;

    console.log(`📋 Found ${totalAssets} assets to process`);

    // Create ingestion job
    const jobId = await this.createIngestionJob({
      jobType: 'historical_prices',
      assetType: 'mixed',
      symbols: JSON.stringify(assets.map(a => a.symbol)),
      timeframe: timeframes.join(','),
      startDate,
      endDate,
      recordsTotal: totalRecords,
      metadata: JSON.stringify({
        lookbackYears,
        assetTypes,
        timeframes,
        batchSize,
        totalAssets
      })
    });

    // Start background processing
    this.processHistoricalDataJob(jobId).catch(error => {
      console.error(`❌ Historical data ingestion job ${jobId} failed:`, error);
    });

    return jobId;
  }

  /**
   * Process historical data ingestion job
   */
  private async processHistoricalDataJob(jobId: string): Promise<void> {
    try {
      await this.updateJobStatus(jobId, 'running');
      const job = await this.getJobById(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);

      const metadata = JSON.parse(job.metadata || '{}');
      const { assetTypes, timeframes, batchSize, lookbackYears } = metadata;
      const symbols = JSON.parse(job.symbols || '[]');
      
      console.log(`▶️ Processing ${symbols.length} assets in batches of ${batchSize}`);

      const startDate = job.startDate!;
      const endDate = job.endDate!;
      let processedCount = 0;

      // Process assets in batches
      for (let i = 0; i < symbols.length; i += batchSize) {
        // Check for cancellation
        if (this.activeJobs.get(jobId)?.cancelled) {
          await this.updateJobStatus(jobId, 'cancelled', 'Job was cancelled by user');
          return;
        }

        const batch = symbols.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(symbols.length/batchSize)}: ${batch.join(', ')}`);

        // Process each asset in the batch
        for (const symbol of batch) {
          try {
            for (const timeframe of timeframes) {
              await this.fetchAndStoreHistoricalData(symbol, timeframe, startDate, endDate);
              processedCount++;
              
              // Update progress
              const progress = Math.floor((processedCount / job.recordsTotal!) * 100);
              await this.updateJobProgress(jobId, progress, processedCount);
              
              // Rate limiting
              await this.delay(this.RATE_LIMIT_DELAY);
            }
          } catch (error) {
            console.error(`⚠️ Failed to process ${symbol}:`, error);
            // Continue with next symbol instead of failing entire batch
          }
        }

        // Small delay between batches
        await this.delay(2000);
      }

      await this.updateJobStatus(jobId, 'completed');
      console.log(`✅ Historical data ingestion completed for job ${jobId}`);
      console.log(`📊 Processed ${processedCount} symbol-timeframe combinations`);

    } catch (error) {
      console.error(`❌ Historical data ingestion failed:`, error);
      await this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Fetch and store historical data for a single symbol
   */
  private async fetchAndStoreHistoricalData(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    let retries = 0;
    
    while (retries < this.MAX_RETRIES) {
      try {
        console.log(`📈 Fetching ${timeframe} data for ${symbol} from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        
        // Convert timeframe to Yahoo Finance period
        const period1 = startDate;
        const period2 = endDate;
        const interval = this.mapTimeframeToInterval(timeframe);

        // Fetch data from Yahoo Finance
        const result = await yahooFinance.historical(symbol, {
          period1,
          period2,
          interval,
        });

        if (!result || result.length === 0) {
          console.log(`⚠️ No data returned for ${symbol}`);
          return;
        }

        // Get asset type first
        const assetType = await this.inferAssetType(symbol);
        
        // Prepare batch insert data
        const historicalData: InsertHistoricalPrices[] = result.map(quote => ({
          symbol,
          assetType,
          timeframe,
          timestamp: new Date(quote.date),
          open: quote.open?.toString() || '0',
          high: quote.high?.toString() || '0', 
          low: quote.low?.toString() || '0',
          close: quote.close?.toString() || '0',
          volume: quote.volume?.toString() || '0',
          adjustedClose: quote.adjClose?.toString() || quote.close?.toString() || '0',
        }));

        // Insert data in chunks to avoid memory issues
        const chunkSize = 1000;
        for (let i = 0; i < historicalData.length; i += chunkSize) {
          const chunk = historicalData.slice(i, i + chunkSize);
          await db.insert(historicalPrices)
            .values(chunk)
            .onConflictDoUpdate({
              target: [historicalPrices.symbol, historicalPrices.timeframe, historicalPrices.timestamp],
              set: {
                open: sql`excluded.open`,
                high: sql`excluded.high`,
                low: sql`excluded.low`,
                close: sql`excluded.close`,
                volume: sql`excluded.volume`,
                adjustedClose: sql`excluded.adjusted_close`,
              }
            });
        }

        console.log(`✅ Stored ${historicalData.length} ${timeframe} records for ${symbol}`);
        return; // Success, exit retry loop

      } catch (error) {
        retries++;
        console.error(`⚠️ Attempt ${retries}/${this.MAX_RETRIES} failed for ${symbol}:`, error);
        
        if (retries >= this.MAX_RETRIES) {
          console.error(`❌ Max retries exceeded for ${symbol}, skipping`);
          throw error;
        }
        
        // Exponential backoff
        await this.delay(this.RATE_LIMIT_DELAY * Math.pow(2, retries));
      }
    }
  }

  /**
   * Create a new ingestion job
   */
  private async createIngestionJob(job: Omit<InsertDataIngestionJob, 'id' | 'createdAt'>): Promise<string> {
    const [newJob] = await db.insert(dataIngestionJobs)
      .values(job)
      .returning({ id: dataIngestionJobs.id });
    
    // Track active job
    this.activeJobs.set(newJob.id, { cancelled: false });
    
    return newJob.id;
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: string, errorMessage?: string): Promise<void> {
    const updateData: any = { 
      status,
      updatedAt: new Date()
    };
    
    if (status === 'running' && !errorMessage) {
      updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updateData.completedAt = new Date();
      this.activeJobs.delete(jobId); // Cleanup tracking
    }
    
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await db.update(dataIngestionJobs)
      .set(updateData)
      .where(eq(dataIngestionJobs.id, jobId));
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(jobId: string, progress: number, recordsProcessed: number): Promise<void> {
    await db.update(dataIngestionJobs)
      .set({ 
        progress: Math.min(progress, 100),
        recordsProcessed,
        updatedAt: new Date()
      })
      .where(eq(dataIngestionJobs.id, jobId));
  }

  /**
   * Get job by ID
   */
  private async getJobById(jobId: string) {
    const [job] = await db.select()
      .from(dataIngestionJobs)
      .where(eq(dataIngestionJobs.id, jobId));
    return job;
  }

  /**
   * Cancel active job
   */
  async cancelJob(jobId: string): Promise<void> {
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      activeJob.cancelled = true;
    }
    await this.updateJobStatus(jobId, 'cancelled', 'Job cancelled by user');
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    return await this.getJobById(jobId);
  }

  /**
   * List all ingestion jobs
   */
  async listJobs(limit: number = 50) {
    return await db.select()
      .from(dataIngestionJobs)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  }

  /**
   * Get historical data statistics
   */
  async getDataStatistics() {
    const [stockCount] = await db.execute(sql`
      SELECT COUNT(DISTINCT symbol) as count 
      FROM historical_prices 
      WHERE asset_type = 'stock'
    `);
    
    const [commodityCount] = await db.execute(sql`
      SELECT COUNT(DISTINCT symbol) as count 
      FROM historical_prices 
      WHERE asset_type = 'commodity'  
    `);
    
    const [totalRecords] = await db.execute(sql`
      SELECT COUNT(*) as count FROM historical_prices
    `);
    
    const [dateRange] = await db.execute(sql`
      SELECT 
        MIN(timestamp) as earliest_date,
        MAX(timestamp) as latest_date
      FROM historical_prices
    `);

    return {
      totalRecords: Number(totalRecords.rows[0].count || 0),
      stockSymbols: Number(stockCount.rows[0].count || 0),
      commoditySymbols: Number(commodityCount.rows[0].count || 0),
      dateRange: {
        earliest: dateRange.rows[0]?.earliest_date,
        latest: dateRange.rows[0]?.latest_date,
      }
    };
  }

  /**
   * Helper methods
   */
  private mapTimeframeToInterval(timeframe: string): '1d' | '1wk' | '1mo' {
    switch (timeframe) {
      case '1d': return '1d';
      case '1w': return '1wk'; 
      case '1m': return '1mo';
      default: return '1d';
    }
  }

  private async inferAssetType(symbol: string): Promise<string> {
    try {
      // First, try to get asset type from asset universe table
      const [asset] = await db.select({ assetType: assetUniverse.assetType })
        .from(assetUniverse)
        .where(eq(assetUniverse.symbol, symbol));
      
      if (asset) {
        return asset.assetType;
      }
      
      // Fallback to pattern-based inference if not in universe
      if (symbol.startsWith('^')) return 'index';
      if (symbol.includes('=F') || symbol.includes('.F')) return 'commodity';
      return 'stock'; // Default assumption
    } catch (error) {
      console.warn(`Failed to infer asset type for ${symbol}, using default:`, error);
      // Pattern-based fallback
      if (symbol.startsWith('^')) return 'index';
      if (symbol.includes('=F') || symbol.includes('.F')) return 'commodity';
      return 'stock';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up old historical data (optional maintenance)
   */
  async cleanupOldData(olderThanDays: number = 365 * 10): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db.delete(historicalPrices)
      .where(lte(historicalPrices.timestamp, cutoffDate));
    
    return result.rowCount || 0;
  }
}

// Export singleton instance
export const historicalDataIngestion = new HistoricalDataIngestion();