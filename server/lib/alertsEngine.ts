import type { StockQuote, CryptoQuote, Alert, AlertCondition, TriggeredAlert, NewsItem, ChartData } from "../../shared/schema";
import type { IStorage } from "../storage";

export class AlertsEngine {
  constructor(private storage: IStorage) {}

  // Utility method to calculate volatility from price data
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  // Check price alerts
  async checkPriceAlerts(quote: StockQuote | CryptoQuote): Promise<TriggeredAlert[]> {
    const triggered: TriggeredAlert[] = [];
    
    // Get all alerts for all users to check against this quote
    const allUsers = await this.getAllUsersWithAlerts();
    
    for (const userId of allUsers) {
      const alerts = await this.storage.listAlertsByUser(userId);
      const priceAlerts = alerts.filter(
        alert => alert.type === 'price' && 
                 alert.symbol === quote.symbol && 
                 alert.status === 'active'
      );

      for (const alert of priceAlerts) {
        if (!alert.condition.targetPrice || !alert.condition.priceDirection) continue;

        const shouldTrigger = 
          (alert.condition.priceDirection === 'above' && quote.price >= alert.condition.targetPrice) ||
          (alert.condition.priceDirection === 'below' && quote.price <= alert.condition.targetPrice);

        if (shouldTrigger) {
          const triggerEvent: TriggeredAlert = {
            alert,
            currentValue: quote.price,
            triggerReason: `Price ${alert.condition.priceDirection} $${alert.condition.targetPrice}`,
            timestamp: new Date(),
            data: { quote }
          };

          triggered.push(triggerEvent);
          await this.storage.recordTriggeredAlert(triggerEvent);
          
          // Update alert status
          if (!alert.isRecurring) {
            await this.storage.updateAlert(alert.id, {
              status: 'triggered',
              triggeredAt: new Date()
            });
          }
        }
      }
    }

    return triggered;
  }

  // Helper method to get all users who have alerts (for now, just demo user)
  private async getAllUsersWithAlerts(): Promise<string[]> {
    const demoUser = await this.storage.getDemoUser();
    return demoUser ? [demoUser.id] : [];
  }

  // Check volume alerts
  async checkVolumeAlerts(quote: StockQuote | CryptoQuote, historicalData?: ChartData[]): Promise<TriggeredAlert[]> {
    const triggered: TriggeredAlert[] = [];
    const allUsers = await this.getAllUsersWithAlerts();
    
    for (const userId of allUsers) {
      const alerts = await this.storage.listAlertsByUser(userId);
      const volumeAlerts = alerts.filter(
        alert => alert.type === 'volume' && 
                 alert.symbol === quote.symbol && 
                 alert.status === 'active'
      );

      for (const alert of volumeAlerts) {
        if (!alert.condition.volumeThreshold) continue;

        let shouldTrigger = false;
        let triggerReason = '';

        if (alert.condition.volumeComparison === 'above') {
          shouldTrigger = quote.volume >= alert.condition.volumeThreshold;
          triggerReason = `Volume above ${alert.condition.volumeThreshold.toLocaleString()}`;
        } else if (alert.condition.volumeComparison === 'below') {
          shouldTrigger = quote.volume <= alert.condition.volumeThreshold;
          triggerReason = `Volume below ${alert.condition.volumeThreshold.toLocaleString()}`;
        } else if (alert.condition.volumeComparison === 'percent_change' && historicalData) {
          // Calculate average volume over timeframe
          const avgVolume = historicalData.reduce((sum, d) => sum + (d.volume || 0), 0) / historicalData.length;
          const percentChange = ((quote.volume - avgVolume) / avgVolume) * 100;
          
          shouldTrigger = Math.abs(percentChange) >= alert.condition.volumeThreshold;
          triggerReason = `Volume change ${percentChange.toFixed(1)}% vs avg`;
        }

        if (shouldTrigger) {
          const triggerEvent: TriggeredAlert = {
            alert,
            currentValue: quote.volume,
            triggerReason,
            timestamp: new Date(),
            data: { quote, historicalData }
          };

          triggered.push(triggerEvent);
          await this.storage.recordTriggeredAlert(triggerEvent);
          
          if (!alert.isRecurring) {
            await this.storage.updateAlert(alert.id, {
              status: 'triggered',
              triggeredAt: new Date()
            });
          }
        }
      }
    }

    return triggered;
  }

  // Check volatility alerts
  async checkVolatilityAlerts(symbol: string, chartData: ChartData[]): Promise<TriggeredAlert[]> {
    if (chartData.length < 2) return [];
    
    const triggered: TriggeredAlert[] = [];
    const allUsers = await this.getAllUsersWithAlerts();
    
    // Calculate volatility from chart data
    const prices = chartData.map(d => d.close);
    const volatility = this.calculateVolatility(prices);
    
    for (const userId of allUsers) {
      const alerts = await this.storage.listAlertsByUser(userId);
      const volatilityAlerts = alerts.filter(
        alert => alert.type === 'volatility' && 
                 alert.symbol === symbol && 
                 alert.status === 'active'
      );

      for (const alert of volatilityAlerts) {
        if (!alert.condition.volatilityThreshold) continue;

        const shouldTrigger = volatility >= alert.condition.volatilityThreshold;

        if (shouldTrigger) {
          const triggerEvent: TriggeredAlert = {
            alert,
            currentValue: volatility,
            triggerReason: `Volatility ${(volatility * 100).toFixed(2)}% above threshold`,
            timestamp: new Date(),
            data: { volatility, chartData }
          };

          triggered.push(triggerEvent);
          await this.storage.recordTriggeredAlert(triggerEvent);
          
          if (!alert.isRecurring) {
            await this.storage.updateAlert(alert.id, {
              status: 'triggered',
              triggeredAt: new Date()
            });
          }
        }
      }
    }

    return triggered;
  }

  // Check news alerts
  async checkNewsAlerts(newsItem: NewsItem): Promise<TriggeredAlert[]> {
    const triggered: TriggeredAlert[] = [];
    const allUsers = await this.getAllUsersWithAlerts();

    for (const userId of allUsers) {
      const alerts = await this.storage.listAlertsByUser(userId);
      const newsAlerts = alerts.filter(
        alert => alert.type === 'news' && alert.status === 'active'
      );

      for (const alert of newsAlerts) {
        if (!alert.condition.keywords || alert.condition.keywords.length === 0) continue;

        // Check if news item mentions the symbol or contains keywords
        const newsText = `${newsItem.title || ''} ${newsItem.summary || ''}`.toLowerCase();
        const symbolMention = newsText.includes(alert.symbol.toLowerCase());
        const keywordMatch = alert.condition.keywords.some(keyword => 
          newsText.includes(keyword.toLowerCase())
        );

        if (symbolMention || keywordMatch) {
          const triggerEvent: TriggeredAlert = {
            alert,
            currentValue: newsItem.title || 'News Alert',
            triggerReason: `News: ${keywordMatch ? 'Keyword match' : 'Symbol mentioned'}`,
            timestamp: new Date(),
            data: { newsItem }
          };

          triggered.push(triggerEvent);
          await this.storage.recordTriggeredAlert(triggerEvent);
          
          if (!alert.isRecurring) {
            await this.storage.updateAlert(alert.id, {
              status: 'triggered',
              triggeredAt: new Date()
            });
          }
        }
      }
    }

    return triggered;
  }

  // Check breakout alerts (simplified technical analysis)
  async checkBreakoutAlerts(symbol: string, chartData: ChartData[]): Promise<TriggeredAlert[]> {
    if (chartData.length < 20) return []; // Need enough historical data
    
    const triggered: TriggeredAlert[] = [];
    const allUsers = await this.getAllUsersWithAlerts();
    
    const prices = chartData.map(d => d.close);
    const currentPrice = prices[prices.length - 1];

    for (const userId of allUsers) {
      const alerts = await this.storage.listAlertsByUser(userId);
      const breakoutAlerts = alerts.filter(
        alert => alert.type === 'breakout' && 
                 alert.symbol === symbol && 
                 alert.status === 'active'
      );

      for (const alert of breakoutAlerts) {
        // Simple resistance/support breakout detection
        const recentHigh = Math.max(...prices.slice(-10));
        const recentLow = Math.min(...prices.slice(-10));
        const longerTermHigh = Math.max(...prices.slice(-20));
        const longerTermLow = Math.min(...prices.slice(-20));

        let shouldTrigger = false;
        let triggerReason = '';

        if (alert.condition.breakoutType === 'resistance') {
          shouldTrigger = currentPrice > recentHigh && recentHigh >= longerTermHigh * 0.98;
          triggerReason = `Resistance breakout above $${recentHigh.toFixed(2)}`;
        } else if (alert.condition.breakoutType === 'support') {
          shouldTrigger = currentPrice < recentLow && recentLow <= longerTermLow * 1.02;
          triggerReason = `Support breakdown below $${recentLow.toFixed(2)}`;
        }

        if (shouldTrigger) {
          const triggerEvent: TriggeredAlert = {
            alert,
            currentValue: currentPrice,
            triggerReason,
            timestamp: new Date(),
            data: { chartData, recentHigh, recentLow }
          };

          triggered.push(triggerEvent);
          await this.storage.recordTriggeredAlert(triggerEvent);
          
          if (!alert.isRecurring) {
            await this.storage.updateAlert(alert.id, {
              status: 'triggered',
              triggeredAt: new Date()
            });
          }
        }
      }
    }

    return triggered;
  }

  // Main method to check all alerts for a given quote and chart data
  async checkAllAlerts(quote: StockQuote | CryptoQuote, chartData?: ChartData[]): Promise<TriggeredAlert[]> {
    const allTriggered: TriggeredAlert[] = [];

    try {
      // Check price alerts
      const priceTriggered = await this.checkPriceAlerts(quote);
      allTriggered.push(...priceTriggered);

      // Check volume alerts if we have historical data
      if (chartData && chartData.length > 0) {
        const volumeTriggered = await this.checkVolumeAlerts(quote, chartData);
        allTriggered.push(...volumeTriggered);

        // Check volatility alerts
        const volatilityTriggered = await this.checkVolatilityAlerts(quote.symbol, chartData);
        allTriggered.push(...volatilityTriggered);

        // Check breakout alerts
        const breakoutTriggered = await this.checkBreakoutAlerts(quote.symbol, chartData);
        allTriggered.push(...breakoutTriggered);
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }

    return allTriggered;
  }
}