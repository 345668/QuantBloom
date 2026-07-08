import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Crypto detection and formatting utilities
const CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'LTC', 'SHIB',
  'TRX', 'AVAX', 'UNI', 'ATOM', 'LINK', 'XMR', 'ETC', 'BCH', 'XLM', 'VET',
  'FIL', 'ICP', 'HBAR', 'APT', 'QNT', 'NEAR', 'GRT', 'LDO', 'STX', 'RUNE',
  'CRO', 'MANA', 'SAND', 'CHZ', 'FLOW', 'ENJ', 'THETA', 'KCS', 'FTM', 'ALGO'
];

export function isCrypto(symbol: string): boolean {
  return CRYPTO_SYMBOLS.includes(symbol.toUpperCase());
}

export function getSymbolType(symbol: string): 'crypto' | 'stock' {
  return isCrypto(symbol) ? 'crypto' : 'stock';
}

export function formatPrice(price: number, symbol: string): string {
  const isCryptoSymbol = isCrypto(symbol);
  
  if (isCryptoSymbol) {
    // Special formatting for high-value cryptos like Bitcoin
    if (price >= 10000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(price);
    } else if (price >= 1) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
      }).format(price);
    } else {
      // For very small crypto prices (< $1), show more decimal places
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 6,
        maximumFractionDigits: 8
      }).format(price);
    }
  }
  
  // Standard stock formatting
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
  if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
  if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
  if (marketCap >= 1e3) return `$${(marketCap / 1e3).toFixed(2)}K`;
  return `$${marketCap.toFixed(2)}`;
}

export function formatVolume(volume: number | null | undefined, symbol: string): string {
  // Handle undefined/null/NaN values more strictly
  if (volume == null || volume === undefined || isNaN(Number(volume))) {
    return isCrypto(symbol) ? '$--' : '--';
  }
  
  // Convert to number to ensure we have a valid number
  const numVolume = Number(volume);
  if (isNaN(numVolume) || !isFinite(numVolume)) {
    return isCrypto(symbol) ? '$--' : '--';
  }
  
  const isCryptoSymbol = isCrypto(symbol);
  
  if (isCryptoSymbol) {
    // Crypto volume in USD value
    if (numVolume >= 1e9) return `$${(numVolume / 1e9).toFixed(1)}B`;
    if (numVolume >= 1e6) return `$${(numVolume / 1e6).toFixed(1)}M`;
    if (numVolume >= 1e3) return `$${(numVolume / 1e3).toFixed(1)}K`;
    return `$${numVolume.toFixed(0)}`;
  }
  
  // Stock volume in shares
  if (numVolume >= 1e9) return `${(numVolume / 1e9).toFixed(1)}B`;
  if (numVolume >= 1e6) return `${(numVolume / 1e6).toFixed(1)}M`;
  if (numVolume >= 1e3) return `${(numVolume / 1e3).toFixed(1)}K`;
  return numVolume.toString();
}

export function getCryptoName(symbol: string): string {
  const cryptoNames: Record<string, string> = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum', 
    'BNB': 'BNB',
    'XRP': 'Ripple',
    'ADA': 'Cardano',
    'DOGE': 'Dogecoin',
    'MATIC': 'Polygon',
    'DOT': 'Polkadot',
    'LTC': 'Litecoin',
    'SHIB': 'Shiba Inu',
    'TRX': 'TRON',
    'AVAX': 'Avalanche',
    'UNI': 'Uniswap',
    'ATOM': 'Cosmos',
    'LINK': 'Chainlink',
    'XMR': 'Monero',
    'ETC': 'Ethereum Classic',
    'BCH': 'Bitcoin Cash',
    'XLM': 'Stellar',
    'VET': 'VeChain'
  };
  
  return cryptoNames[symbol.toUpperCase()] || symbol.toUpperCase();
}

export function getApiEndpoint(symbol: string, endpoint: string): string {
  const symbolType = getSymbolType(symbol);
  
  switch (endpoint) {
    case 'chart':
      return symbolType === 'crypto' ? `/api/crypto/chart/${symbol}` : `/api/chart/${symbol}`;
    case 'quote':
      return symbolType === 'crypto' ? `/api/crypto/quote/${symbol}` : `/api/quote/${symbol}`;
    default:
      return `/api/${endpoint}`;
  }
}
