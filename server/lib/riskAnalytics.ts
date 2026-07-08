import type { ChartData } from "@shared/schema";

export interface PortfolioRiskMetrics {
  portfolioValue: number;
  portfolioReturns: number[];
  volatility: number;
  sharpeRatio: number;
  beta: number;
  maxDrawdown: number;
  var95: number;
  var99: number;
  correlationMatrix: CorrelationMatrix;
  sectorExposure: SectorExposure[];
  assetAllocation: AssetAllocation[];
  riskMetrics: {
    valueAtRisk: VaRAnalysis;
    stressTests: StressTest[];
    concentrationRisk: number;
  };
}

export interface VaRAnalysis {
  historical: {
    var95: number;
    var99: number;
    expectedShortfall95: number;
    expectedShortfall99: number;
  };
  parametric: {
    var95: number;
    var99: number;
  };
  monteCarlo: {
    var95: number;
    var99: number;
    simulations: number;
  };
}

export interface CorrelationMatrix {
  assets: string[];
  correlations: number[][];
}

export interface SectorExposure {
  sector: string;
  exposure: number;
  weight: number;
  performance: number;
  risk: number;
}

export interface AssetAllocation {
  type: string;
  weight: number;
  value: number;
  performance: number;
}

export interface StressTest {
  scenario: string;
  portfolioImpact: number;
  description: string;
}

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  assetType: string;
  marketValue: number;
  weight: number;
}

export class RiskAnalyticsService {
  private static readonly TRADING_DAYS_PER_YEAR = 252;
  private static readonly RISK_FREE_RATE = 0.02; // 2% risk-free rate

  /**
   * Calculate daily returns from price series
   */
  static calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
      returns.push(dailyReturn);
    }
    return returns;
  }

  /**
   * Calculate portfolio returns using position weights
   */
  static calculatePortfolioReturns(
    assetReturns: Record<string, number[]>,
    weights: Record<string, number>
  ): number[] {
    const symbols = Object.keys(weights);
    if (symbols.length === 0) return [];

    const firstAssetReturns = assetReturns[symbols[0]];
    if (!firstAssetReturns) return [];

    const portfolioReturns: number[] = [];
    
    for (let i = 0; i < firstAssetReturns.length; i++) {
      let portfolioReturn = 0;
      
      for (const symbol of symbols) {
        const returns = assetReturns[symbol];
        if (returns && returns[i] !== undefined) {
          portfolioReturn += weights[symbol] * returns[i];
        }
      }
      
      portfolioReturns.push(portfolioReturn);
    }
    
    return portfolioReturns;
  }

  /**
   * Calculate annualized volatility from daily returns
   */
  static calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const dailyVolatility = Math.sqrt(variance);
    
    return dailyVolatility * Math.sqrt(this.TRADING_DAYS_PER_YEAR);
  }

  /**
   * Calculate Sharpe ratio
   */
  static calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const annualizedReturn = this.calculateAnnualizedReturn(returns);
    const volatility = this.calculateVolatility(returns);
    
    if (volatility === 0) return 0;
    
    return (annualizedReturn - this.RISK_FREE_RATE) / volatility;
  }

  /**
   * Calculate annualized return from daily returns
   */
  static calculateAnnualizedReturn(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const cumulativeReturn = returns.reduce((cum, r) => cum * (1 + r), 1);
    const periodsPerYear = this.TRADING_DAYS_PER_YEAR / returns.length;
    
    return Math.pow(cumulativeReturn, periodsPerYear) - 1;
  }

  /**
   * Calculate beta using linear regression against benchmark
   */
  static calculateBeta(assetReturns: number[], benchmarkReturns: number[]): number {
    if (assetReturns.length !== benchmarkReturns.length || assetReturns.length < 10) {
      return 1.0; // Default beta if insufficient data
    }

    const n = assetReturns.length;
    const assetMean = assetReturns.reduce((sum, r) => sum + r, 0) / n;
    const benchmarkMean = benchmarkReturns.reduce((sum, r) => sum + r, 0) / n;

    let covariance = 0;
    let benchmarkVariance = 0;

    for (let i = 0; i < n; i++) {
      const assetDiff = assetReturns[i] - assetMean;
      const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
      
      covariance += assetDiff * benchmarkDiff;
      benchmarkVariance += benchmarkDiff * benchmarkDiff;
    }

    if (benchmarkVariance === 0) return 1.0;

    return covariance / benchmarkVariance;
  }

  /**
   * Calculate maximum drawdown
   */
  static calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;

    const cumulativeReturns: number[] = [1];
    for (const r of returns) {
      cumulativeReturns.push(cumulativeReturns[cumulativeReturns.length - 1] * (1 + r));
    }

    let maxDrawdown = 0;
    let peak = cumulativeReturns[0];

    for (let i = 1; i < cumulativeReturns.length; i++) {
      if (cumulativeReturns[i] > peak) {
        peak = cumulativeReturns[i];
      }
      
      const drawdown = (peak - cumulativeReturns[i]) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown;
  }

  /**
   * Calculate Historical Value at Risk
   */
  static calculateHistoricalVaR(returns: number[], portfolioValue: number, confidenceLevel: number = 0.95): number {
    if (returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    const varReturn = sortedReturns[Math.max(0, index - 1)] || 0;
    
    return Math.abs(varReturn * portfolioValue);
  }

  /**
   * Calculate Expected Shortfall (Conditional VaR)
   */
  static calculateExpectedShortfall(returns: number[], portfolioValue: number, confidenceLevel: number = 0.95): number {
    if (returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    
    const tailReturns = sortedReturns.slice(0, index);
    if (tailReturns.length === 0) return 0;
    
    const meanTailReturn = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    
    return Math.abs(meanTailReturn * portfolioValue);
  }

  /**
   * Calculate Parametric VaR using normal distribution
   */
  static calculateParametricVaR(returns: number[], portfolioValue: number, confidenceLevel: number = 0.95): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    // Z-score for confidence level (1.645 for 95%, 2.326 for 99%)
    const zScore = confidenceLevel === 0.95 ? 1.645 : 2.326;
    const varReturn = mean - (zScore * stdDev);
    
    return Math.abs(varReturn * portfolioValue);
  }

  /**
   * Monte Carlo VaR simulation
   */
  static calculateMonteCarloVaR(
    returns: number[], 
    portfolioValue: number, 
    confidenceLevel: number = 0.95, 
    simulations: number = 10000
  ): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    const simulatedReturns: number[] = [];
    
    for (let i = 0; i < simulations; i++) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      
      const simulatedReturn = mean + (z * stdDev);
      simulatedReturns.push(simulatedReturn);
    }

    return this.calculateHistoricalVaR(simulatedReturns, portfolioValue, confidenceLevel);
  }

  /**
   * Calculate correlation matrix for assets
   */
  static calculateCorrelationMatrix(assetReturns: Record<string, number[]>): CorrelationMatrix {
    const assets = Object.keys(assetReturns);
    const n = assets.length;
    const correlations: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          correlations[i][j] = 1.0;
        } else {
          correlations[i][j] = this.calculateCorrelation(
            assetReturns[assets[i]], 
            assetReturns[assets[j]]
          );
        }
      }
    }

    return { assets, correlations };
  }

  /**
   * Calculate correlation coefficient between two return series
   */
  static calculateCorrelation(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length < 2) return 0;

    const n = returns1.length;
    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / n;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / n;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Map stock symbol to sector
   */
  static getSectorForSymbol(symbol: string): string {
    const sectorMap: Record<string, string> = {
      // Technology
      'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'GOOG': 'Technology',
      'AMZN': 'Technology', 'META': 'Technology', 'TSLA': 'Technology', 'NVDA': 'Technology',
      'CRM': 'Technology', 'ORCL': 'Technology', 'IBM': 'Technology', 'ADBE': 'Technology',
      
      // Healthcare
      'JNJ': 'Healthcare', 'PFE': 'Healthcare', 'UNH': 'Healthcare', 'ABBV': 'Healthcare',
      'TMO': 'Healthcare', 'ABT': 'Healthcare', 'MRK': 'Healthcare', 'DHR': 'Healthcare',
      
      // Financial Services
      'JPM': 'Financial Services', 'BAC': 'Financial Services', 'WFC': 'Financial Services',
      'GS': 'Financial Services', 'MS': 'Financial Services', 'C': 'Financial Services',
      'AXP': 'Financial Services', 'BLK': 'Financial Services',
      
      // Consumer Cyclical
      'HD': 'Consumer Cyclical', 'MCD': 'Consumer Cyclical', 'NKE': 'Consumer Cyclical',
      'SBUX': 'Consumer Cyclical', 'LOW': 'Consumer Cyclical', 'TJX': 'Consumer Cyclical',
      
      // Communication Services
      'DIS': 'Communication Services', 'NFLX': 'Communication Services', 'CMCSA': 'Communication Services',
      'VZ': 'Communication Services', 'T': 'Communication Services',
      
      // Energy
      'XOM': 'Energy', 'CVX': 'Energy', 'COP': 'Energy', 'EOG': 'Energy',
      
      // Industrial
      'BA': 'Industrial', 'CAT': 'Industrial', 'GE': 'Industrial', 'MMM': 'Industrial',
      
      // Crypto (treated as its own sector)
      'BTC': 'Cryptocurrency', 'ETH': 'Cryptocurrency', 'ADA': 'Cryptocurrency',
      'SOL': 'Cryptocurrency', 'DOGE': 'Cryptocurrency', 'XRP': 'Cryptocurrency',
    };

    return sectorMap[symbol.toUpperCase()] || 'Other';
  }

  /**
   * Calculate concentration risk (Herfindahl-Hirschman Index)
   */
  static calculateConcentrationRisk(weights: number[]): number {
    return weights.reduce((hhi, weight) => hhi + (weight * weight), 0);
  }

  /**
   * Perform stress tests on portfolio
   */
  static performStressTests(
    positions: PortfolioPosition[],
    assetReturns: Record<string, number[]>
  ): StressTest[] {
    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    
    const scenarios = [
      {
        scenario: "Market Crash (-20%)",
        description: "Broad market decline of 20%",
        impact: -0.20
      },
      {
        scenario: "Tech Sector Decline (-30%)",
        description: "Technology sector correction",
        impact: -0.30,
        sectors: ['Technology']
      },
      {
        scenario: "Interest Rate Shock",
        description: "Rising interest rates affecting financial sector",
        impact: -0.15,
        sectors: ['Financial Services']
      },
      {
        scenario: "Crypto Winter (-50%)",
        description: "Cryptocurrency market collapse",
        impact: -0.50,
        sectors: ['Cryptocurrency']
      }
    ];

    return scenarios.map(scenario => {
      let portfolioImpact = 0;
      
      if (scenario.sectors) {
        // Sector-specific stress test
        const affectedValue = positions
          .filter(pos => scenario.sectors?.includes(this.getSectorForSymbol(pos.symbol)))
          .reduce((sum, pos) => sum + pos.marketValue, 0);
        portfolioImpact = (affectedValue / totalValue) * scenario.impact;
      } else {
        // Market-wide stress test
        portfolioImpact = scenario.impact;
      }

      return {
        scenario: scenario.scenario,
        portfolioImpact: portfolioImpact * 100, // Convert to percentage
        description: scenario.description
      };
    });
  }
}