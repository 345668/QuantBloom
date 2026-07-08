// Technical indicator calculations for Bloom Terminal

export interface ChartDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  sma20?: number;
  sma50?: number;
  ema12?: number;
  ema26?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  upperBB?: number;
  lowerBB?: number;
  middleBB?: number;
  volumeMA?: number;
}

export type EnhancedChartData = ChartDataPoint & TechnicalIndicators;

// Simple Moving Average
export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

// Exponential Moving Average
export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      ema.push(data[i]);
    } else {
      ema.push((data[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
    }
  }
  return ema;
}

// Relative Strength Index
export function calculateRSI(data: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      rsi.push(NaN);
    } else {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
  }
  
  // Add NaN for the first data point since we start from index 1
  return [NaN, ...rsi];
}

// MACD (Moving Average Convergence Divergence)
export function calculateMACD(data: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
  const emaFast = calculateEMA(data, fastPeriod);
  const emaSlow = calculateEMA(data, slowPeriod);
  
  const macdLine = emaFast.map((fast, i) => fast - emaSlow[i]);
  const signalLine = calculateEMA(macdLine.filter(val => !isNaN(val)), signalPeriod);
  
  // Pad signal line to match macdLine length
  const paddedSignal = [
    ...new Array(macdLine.length - signalLine.length).fill(NaN),
    ...signalLine
  ];
  
  const histogram = macdLine.map((macd, i) => macd - (paddedSignal[i] || 0));
  
  return {
    macd: macdLine,
    signal: paddedSignal,
    histogram
  };
}

// Bollinger Bands
export function calculateBollingerBands(data: number[], period: number = 20, standardDeviations: number = 2) {
  const sma = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = sma[i];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      
      upper.push(mean + (standardDeviations * stdDev));
      lower.push(mean - (standardDeviations * stdDev));
    }
  }
  
  return {
    upper,
    middle: sma,
    lower
  };
}

// Calculate all technical indicators for chart data
export function calculateAllIndicators(data: ChartDataPoint[]): EnhancedChartData[] {
  if (data.length === 0) return [];
  
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume);
  
  // Moving averages
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  // RSI
  const rsi = calculateRSI(closes, 14);
  
  // MACD
  const macdData = calculateMACD(closes);
  
  // Bollinger Bands
  const bbData = calculateBollingerBands(closes);
  
  // Volume MA
  const volumeMA = calculateSMA(volumes, 20);
  
  return data.map((point, i) => ({
    ...point,
    sma20: sma20[i],
    sma50: sma50[i],
    ema12: ema12[i],
    ema26: ema26[i],
    rsi: rsi[i],
    macd: macdData.macd[i],
    macdSignal: macdData.signal[i],
    macdHistogram: macdData.histogram[i],
    upperBB: bbData.upper[i],
    lowerBB: bbData.lower[i],
    middleBB: bbData.middle[i],
    volumeMA: volumeMA[i]
  }));
}