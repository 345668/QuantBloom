// ---------------------------------------------------------------------------
// Multi-asset instrument universe.
//
// Indices (^GSPC) are reference levels you cannot trade; ETFs (SPY, QQQ) and
// futures (ES=F) are the tradeable expressions of them. A terminal needs both,
// so each index carries a `tradeable` pointer to its liquid proxy.
// ---------------------------------------------------------------------------

export const ASSET_CLASSES = [
  'Index', 'Equity ETF', 'Sector ETF', 'Factor ETF', 'International ETF',
  'Fixed Income', 'Commodity', 'Currency', 'Futures', 'Volatility', 'Crypto',
];

export const INSTRUMENTS = [
  // --- US Indices (reference) → tradeable proxy ---
  { symbol: '^GSPC', name: 'S&P 500', class: 'Index', region: 'US', tradeable: 'SPY' },
  { symbol: '^DJI', name: 'Dow Jones Industrial', class: 'Index', region: 'US', tradeable: 'DIA' },
  { symbol: '^IXIC', name: 'Nasdaq Composite', class: 'Index', region: 'US', tradeable: 'ONEQ' },
  { symbol: '^NDX', name: 'Nasdaq 100', class: 'Index', region: 'US', tradeable: 'QQQ' },
  { symbol: '^RUT', name: 'Russell 2000', class: 'Index', region: 'US', tradeable: 'IWM' },
  { symbol: '^MID', name: 'S&P MidCap 400', class: 'Index', region: 'US', tradeable: 'MDY' },
  { symbol: '^VIX', name: 'CBOE Volatility Index', class: 'Volatility', region: 'US', tradeable: 'VXX' },
  { symbol: '^VVIX', name: 'VIX of VIX', class: 'Volatility', region: 'US' },
  { symbol: '^TNX', name: 'US 10-Year Yield', class: 'Fixed Income', region: 'US', tradeable: 'IEF' },
  { symbol: '^FVX', name: 'US 5-Year Yield', class: 'Fixed Income', region: 'US', tradeable: 'IEI' },
  { symbol: '^TYX', name: 'US 30-Year Yield', class: 'Fixed Income', region: 'US', tradeable: 'TLT' },

  // --- Broad market ETFs ---
  { symbol: 'SPY', name: 'SPDR S&P 500', class: 'Equity ETF', region: 'US' },
  { symbol: 'QQQ', name: 'Invesco Nasdaq 100', class: 'Equity ETF', region: 'US' },
  { symbol: 'IWM', name: 'iShares Russell 2000', class: 'Equity ETF', region: 'US' },
  { symbol: 'DIA', name: 'SPDR Dow Jones', class: 'Equity ETF', region: 'US' },
  { symbol: 'VTI', name: 'Vanguard Total Market', class: 'Equity ETF', region: 'US' },
  { symbol: 'VOO', name: 'Vanguard S&P 500', class: 'Equity ETF', region: 'US' },
  { symbol: 'MDY', name: 'SPDR S&P MidCap 400', class: 'Equity ETF', region: 'US' },
  { symbol: 'RSP', name: 'Invesco S&P 500 Equal Weight', class: 'Equity ETF', region: 'US' },
  { symbol: 'QQQM', name: 'Invesco Nasdaq 100 (low fee)', class: 'Equity ETF', region: 'US' },
  { symbol: 'ONEQ', name: 'Fidelity Nasdaq Composite', class: 'Equity ETF', region: 'US' },

  // --- Sector ETFs (SPDR Select Sector) ---
  { symbol: 'XLK', name: 'Technology', class: 'Sector ETF', region: 'US' },
  { symbol: 'XLF', name: 'Financials', class: 'Sector ETF', region: 'US' },
  { symbol: 'XLV', name: 'Health Care', class: 'Sector ETF', region: 'US' },
  { symbol: 'XLE', name: 'Energy', class: 'Sector ETF', region: 'US' },
  { symbol: 'XLY', name: 'Consumer Discretionary', class: 'Sector ETF', region: 'US' },
  { symbol: 'XLP', name: 'Consumer Staples', class: 'Sector ETF', region: 'US' },
  { symbol: 'XLI', name: 'Industrials', class: 'Sector ETF', region: 'US' },
  { symbol: 'XLB', name: 'Materials', class: 'Sector ETF', region: 'US' },
  { symbol: 'XLRE', name: 'Real Estate', class: 'Sector ETF', region: 'US' },
  { symbol: 'XLU', name: 'Utilities', class: 'Sector ETF', region: 'US' },
  { symbol: 'XLC', name: 'Communication Services', class: 'Sector ETF', region: 'US' },
  { symbol: 'SMH', name: 'Semiconductors', class: 'Sector ETF', region: 'US' },
  { symbol: 'XBI', name: 'Biotech', class: 'Sector ETF', region: 'US' },
  { symbol: 'ITB', name: 'Home Construction', class: 'Sector ETF', region: 'US' },
  { symbol: 'KRE', name: 'Regional Banks', class: 'Sector ETF', region: 'US' },
  { symbol: 'JETS', name: 'Airlines', class: 'Sector ETF', region: 'US' },

  // --- Factor / style ETFs ---
  { symbol: 'MTUM', name: 'Momentum', class: 'Factor ETF', region: 'US' },
  { symbol: 'VLUE', name: 'Value', class: 'Factor ETF', region: 'US' },
  { symbol: 'QUAL', name: 'Quality', class: 'Factor ETF', region: 'US' },
  { symbol: 'USMV', name: 'Min Volatility', class: 'Factor ETF', region: 'US' },
  { symbol: 'SIZE', name: 'Size', class: 'Factor ETF', region: 'US' },
  { symbol: 'IWD', name: 'Russell 1000 Value', class: 'Factor ETF', region: 'US' },
  { symbol: 'IWF', name: 'Russell 1000 Growth', class: 'Factor ETF', region: 'US' },
  { symbol: 'SCHD', name: 'Dividend Equity', class: 'Factor ETF', region: 'US' },
  { symbol: 'NOBL', name: 'Dividend Aristocrats', class: 'Factor ETF', region: 'US' },

  // --- International equity ---
  { symbol: 'EFA', name: 'MSCI EAFE (Developed)', class: 'International ETF', region: 'Global' },
  { symbol: 'EEM', name: 'MSCI Emerging Markets', class: 'International ETF', region: 'Global' },
  { symbol: 'VEA', name: 'FTSE Developed Markets', class: 'International ETF', region: 'Global' },
  { symbol: 'VWO', name: 'FTSE Emerging Markets', class: 'International ETF', region: 'Global' },
  { symbol: 'FXI', name: 'China Large-Cap', class: 'International ETF', region: 'Asia' },
  { symbol: 'EWJ', name: 'Japan', class: 'International ETF', region: 'Asia' },
  { symbol: 'EWG', name: 'Germany', class: 'International ETF', region: 'Europe' },
  { symbol: 'EWU', name: 'United Kingdom', class: 'International ETF', region: 'Europe' },
  { symbol: 'INDA', name: 'India', class: 'International ETF', region: 'Asia' },
  { symbol: 'EWZ', name: 'Brazil', class: 'International ETF', region: 'LatAm' },
  { symbol: 'ACWI', name: 'MSCI All Country World', class: 'International ETF', region: 'Global' },

  // --- Global indices (reference) ---
  { symbol: '^FTSE', name: 'FTSE 100', class: 'Index', region: 'Europe', tradeable: 'EWU' },
  { symbol: '^GDAXI', name: 'DAX 40', class: 'Index', region: 'Europe', tradeable: 'EWG' },
  { symbol: '^FCHI', name: 'CAC 40', class: 'Index', region: 'Europe' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', class: 'Index', region: 'Europe' },
  { symbol: '^N225', name: 'Nikkei 225', class: 'Index', region: 'Asia', tradeable: 'EWJ' },
  { symbol: '^HSI', name: 'Hang Seng', class: 'Index', region: 'Asia' },
  { symbol: '000001.SS', name: 'Shanghai Composite', class: 'Index', region: 'Asia', tradeable: 'FXI' },
  { symbol: '^BSESN', name: 'BSE Sensex', class: 'Index', region: 'Asia', tradeable: 'INDA' },
  { symbol: '^AXJO', name: 'ASX 200', class: 'Index', region: 'Asia' },
  { symbol: '^GSPTSE', name: 'TSX Composite', class: 'Index', region: 'Americas' },
  { symbol: '^BVSP', name: 'Bovespa', class: 'Index', region: 'LatAm', tradeable: 'EWZ' },

  // --- Fixed income ETFs ---
  { symbol: 'TLT', name: '20+ Year Treasury', class: 'Fixed Income', region: 'US' },
  { symbol: 'IEF', name: '7-10 Year Treasury', class: 'Fixed Income', region: 'US' },
  { symbol: 'IEI', name: '3-7 Year Treasury', class: 'Fixed Income', region: 'US' },
  { symbol: 'SHY', name: '1-3 Year Treasury', class: 'Fixed Income', region: 'US' },
  { symbol: 'BIL', name: '1-3 Month T-Bill', class: 'Fixed Income', region: 'US' },
  { symbol: 'AGG', name: 'US Aggregate Bond', class: 'Fixed Income', region: 'US' },
  { symbol: 'BND', name: 'Total Bond Market', class: 'Fixed Income', region: 'US' },
  { symbol: 'LQD', name: 'Investment Grade Corp', class: 'Fixed Income', region: 'US' },
  { symbol: 'HYG', name: 'High Yield Corp', class: 'Fixed Income', region: 'US' },
  { symbol: 'JNK', name: 'High Yield Bond', class: 'Fixed Income', region: 'US' },
  { symbol: 'TIP', name: 'TIPS (Inflation Protected)', class: 'Fixed Income', region: 'US' },
  { symbol: 'MUB', name: 'Municipal Bond', class: 'Fixed Income', region: 'US' },
  { symbol: 'EMB', name: 'EM Sovereign Bond', class: 'Fixed Income', region: 'Global' },

  // --- Commodities (ETFs + futures) ---
  { symbol: 'GLD', name: 'Gold Trust', class: 'Commodity', region: 'Global' },
  { symbol: 'SLV', name: 'Silver Trust', class: 'Commodity', region: 'Global' },
  { symbol: 'USO', name: 'US Oil Fund', class: 'Commodity', region: 'Global' },
  { symbol: 'UNG', name: 'US Natural Gas', class: 'Commodity', region: 'Global' },
  { symbol: 'DBC', name: 'Commodity Index', class: 'Commodity', region: 'Global' },
  { symbol: 'DBA', name: 'Agriculture', class: 'Commodity', region: 'Global' },
  { symbol: 'COPX', name: 'Copper Miners', class: 'Commodity', region: 'Global' },
  { symbol: 'GDX', name: 'Gold Miners', class: 'Commodity', region: 'Global' },

  // --- Futures ---
  { symbol: 'ES=F', name: 'E-mini S&P 500', class: 'Futures', region: 'US' },
  { symbol: 'NQ=F', name: 'E-mini Nasdaq 100', class: 'Futures', region: 'US' },
  { symbol: 'YM=F', name: 'E-mini Dow', class: 'Futures', region: 'US' },
  { symbol: 'RTY=F', name: 'E-mini Russell 2000', class: 'Futures', region: 'US' },
  { symbol: 'GC=F', name: 'Gold', class: 'Futures', region: 'Global' },
  { symbol: 'SI=F', name: 'Silver', class: 'Futures', region: 'Global' },
  { symbol: 'HG=F', name: 'Copper', class: 'Futures', region: 'Global' },
  { symbol: 'CL=F', name: 'Crude Oil WTI', class: 'Futures', region: 'Global' },
  { symbol: 'BZ=F', name: 'Brent Crude', class: 'Futures', region: 'Global' },
  { symbol: 'NG=F', name: 'Natural Gas', class: 'Futures', region: 'Global' },
  { symbol: 'ZC=F', name: 'Corn', class: 'Futures', region: 'US' },
  { symbol: 'ZW=F', name: 'Wheat', class: 'Futures', region: 'US' },
  { symbol: 'ZS=F', name: 'Soybeans', class: 'Futures', region: 'US' },
  { symbol: 'ZN=F', name: '10-Year T-Note', class: 'Futures', region: 'US' },
  { symbol: 'ZB=F', name: '30-Year T-Bond', class: 'Futures', region: 'US' },

  // --- Currencies ---
  { symbol: 'DX-Y.NYB', name: 'US Dollar Index', class: 'Currency', region: 'Global' },
  { symbol: 'EURUSD=X', name: 'EUR/USD', class: 'Currency', region: 'Global' },
  { symbol: 'GBPUSD=X', name: 'GBP/USD', class: 'Currency', region: 'Global' },
  { symbol: 'USDJPY=X', name: 'USD/JPY', class: 'Currency', region: 'Global' },
  { symbol: 'USDCHF=X', name: 'USD/CHF', class: 'Currency', region: 'Global' },
  { symbol: 'AUDUSD=X', name: 'AUD/USD', class: 'Currency', region: 'Global' },
  { symbol: 'USDCAD=X', name: 'USD/CAD', class: 'Currency', region: 'Global' },
  { symbol: 'NZDUSD=X', name: 'NZD/USD', class: 'Currency', region: 'Global' },
  { symbol: 'USDCNY=X', name: 'USD/CNY', class: 'Currency', region: 'Global' },
  { symbol: 'USDMXN=X', name: 'USD/MXN', class: 'Currency', region: 'Global' },

  // --- Crypto ---
  { symbol: 'BTC-USD', name: 'Bitcoin', class: 'Crypto', region: 'Global' },
  { symbol: 'ETH-USD', name: 'Ethereum', class: 'Crypto', region: 'Global' },
  { symbol: 'SOL-USD', name: 'Solana', class: 'Crypto', region: 'Global' },
  { symbol: 'XRP-USD', name: 'XRP', class: 'Crypto', region: 'Global' },
  { symbol: 'BNB-USD', name: 'BNB', class: 'Crypto', region: 'Global' },
  { symbol: 'ADA-USD', name: 'Cardano', class: 'Crypto', region: 'Global' },
  { symbol: 'DOGE-USD', name: 'Dogecoin', class: 'Crypto', region: 'Global' },
  { symbol: 'AVAX-USD', name: 'Avalanche', class: 'Crypto', region: 'Global' },
];

export const INSTRUMENT_BY_SYMBOL = Object.fromEntries(INSTRUMENTS.map(i => [i.symbol, i]));

export const INSTRUMENTS_BY_CLASS = INSTRUMENTS.reduce((acc, i) => {
  (acc[i.class] ||= []).push(i);
  return acc;
}, {});

/** Instruments that make sense as benchmarks in a comparison. */
export const BENCHMARKS = ['SPY', 'QQQ', 'IWM', 'DIA', 'AGG', 'GLD', 'TLT', 'EFA'];
