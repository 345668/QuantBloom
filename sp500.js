// ---------------------------------------------------------------------------
// S&P 500 constituents grouped by GICS sector, plus major market indices.
// Used for the heatmap, screener, symbol search, and sector analysis.
// This is a broad, representative snapshot of the index (major constituents).
// ---------------------------------------------------------------------------

export const SP500_BY_SECTOR = {
  'Information Technology': [
    'AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'AMD', 'ADBE', 'CSCO', 'ACN',
    'INTC', 'IBM', 'TXN', 'QCOM', 'INTU', 'NOW', 'AMAT', 'MU', 'ADI', 'LRCX',
    'KLAC', 'SNPS', 'CDNS', 'ANET', 'PANW', 'CRWD', 'ROP', 'APH', 'MSI', 'FTNT',
    'MCHP', 'NXPI', 'ADSK', 'TEL', 'IT', 'HPQ', 'GLW', 'HPE', 'ON', 'KEYS',
    'CTSH', 'WDC', 'STX', 'GRMN', 'FSLR', 'TDY', 'ZBRA', 'PTC', 'TYL', 'NTAP',
  ],
  'Health Care': [
    'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'AMGN', 'PFE',
    'ISRG', 'BSX', 'SYK', 'ELV', 'MDT', 'GILD', 'VRTX', 'CI', 'REGN', 'CVS',
    'ZTS', 'BDX', 'HCA', 'MCK', 'BMY', 'EW', 'HUM', 'DXCM', 'BIIB', 'IDXX',
    'GEHC', 'A', 'IQV', 'RMD', 'CNC', 'MTD', 'WST', 'COR', 'BAX', 'MRNA',
    'STE', 'ZBH', 'HOLX', 'WAT', 'ALGN', 'MOH', 'PODD', 'DGX', 'RVTY', 'VTRS',
  ],
  'Financials': [
    'BRK-B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'AXP', 'SPGI',
    'BLK', 'C', 'SCHW', 'MMC', 'PGR', 'CB', 'FI', 'BX', 'ICE', 'PYPL',
    'AON', 'PNC', 'USB', 'CME', 'AJG', 'TFC', 'MCO', 'COF', 'AFL', 'MET',
    'TRV', 'BK', 'ALL', 'AIG', 'PRU', 'MSCI', 'AMP', 'DFS', 'FIS', 'KKR',
    'ACGL', 'HIG', 'STT', 'NDAQ', 'WTW', 'FITB', 'RJF', 'TROW', 'CBOE', 'BRO',
  ],
  'Consumer Discretionary': [
    'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'BKNG', 'TJX', 'SBUX', 'ORLY',
    'MAR', 'CMG', 'GM', 'F', 'HLT', 'AZO', 'ROST', 'YUM', 'RCL', 'DHI',
    'LEN', 'LVS', 'EBAY', 'APTV', 'PHM', 'GRMN', 'ULTA', 'NVR', 'DRI', 'BBY',
    'EXPE', 'TSCO', 'DPZ', 'KMX', 'CCL', 'POOL', 'WYNN', 'MGM', 'NCLH', 'BWA',
  ],
  'Communication Services': [
    'META', 'GOOGL', 'GOOG', 'NFLX', 'DIS', 'CMCSA', 'T', 'VZ', 'TMUS', 'CHTR',
    'EA', 'WBD', 'OMC', 'TTWO', 'FOXA', 'FOX', 'IPG', 'LYV', 'NWSA', 'MTCH',
    'PARA', 'DISH', 'NWS',
  ],
  'Industrials': [
    'GE', 'CAT', 'RTX', 'HON', 'UNP', 'BA', 'UPS', 'ETN', 'DE', 'LMT',
    'ADP', 'GD', 'NOC', 'WM', 'ITW', 'CSX', 'EMR', 'FDX', 'NSC', 'PH',
    'TT', 'MMM', 'GEV', 'TDG', 'CTAS', 'PCAR', 'CARR', 'CPRT', 'JCI', 'PAYX',
    'CMI', 'ROK', 'FAST', 'AME', 'OTIS', 'URI', 'GWW', 'IR', 'EFX', 'VRSK',
    'ODFL', 'DAL', 'WAB', 'XYL', 'LUV', 'UAL', 'DOV', 'HWM', 'FTV', 'BR',
  ],
  'Consumer Staples': [
    'PG', 'COST', 'WMT', 'KO', 'PEP', 'PM', 'MDLZ', 'MO', 'CL', 'TGT',
    'KMB', 'GIS', 'SYY', 'KVUE', 'ADM', 'MNST', 'KDP', 'STZ', 'KHC', 'HSY',
    'KR', 'DG', 'MKC', 'CHD', 'CLX', 'DLTR', 'K', 'CAG', 'SJM', 'HRL',
    'TSN', 'TAP', 'CPB', 'BG', 'LW', 'BF-B', 'WBA',
  ],
  'Energy': [
    'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX', 'WMB', 'OKE', 'VLO',
    'OXY', 'KMI', 'HES', 'FANG', 'BKR', 'HAL', 'DVN', 'TRGP', 'CTRA', 'MRO',
    'APA', 'EQT',
  ],
  'Utilities': [
    'NEE', 'SO', 'DUK', 'CEG', 'SRE', 'AEP', 'D', 'PCG', 'EXC', 'XEL',
    'ED', 'PEG', 'WEC', 'ETR', 'AWK', 'DTE', 'PPL', 'AEE', 'ATO', 'CMS',
    'FE', 'CNP', 'ES', 'NI', 'LNT', 'EVRG', 'AES',
  ],
  'Real Estate': [
    'PLD', 'AMT', 'EQIX', 'WELL', 'SPG', 'PSA', 'O', 'CCI', 'DLR', 'CBRE',
    'EXR', 'VICI', 'AVB', 'IRM', 'SBAC', 'EQR', 'WY', 'INVH', 'VTR', 'ARE',
    'MAA', 'ESS', 'KIM', 'DOC', 'HST', 'REG', 'UDR', 'BXP', 'FRT',
  ],
  'Materials': [
    'LIN', 'SHW', 'APD', 'ECL', 'FCX', 'NEM', 'NUE', 'DOW', 'DD', 'CTVA',
    'VMC', 'MLM', 'PPG', 'IFF', 'ALB', 'LYB', 'STLD', 'BALL', 'AVY', 'CF',
    'PKG', 'IP', 'AMCR', 'MOS', 'EMN', 'CE', 'FMC',
  ],
};

// Major market indices (Yahoo Finance symbols use a caret prefix).
export const MARKET_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500', short: 'SPX' },
  { symbol: '^DJI', name: 'Dow Jones Industrial', short: 'DJIA' },
  { symbol: '^IXIC', name: 'Nasdaq Composite', short: 'COMP' },
  { symbol: '^RUT', name: 'Russell 2000', short: 'RUT' },
  { symbol: '^VIX', name: 'CBOE Volatility', short: 'VIX' },
  { symbol: '^NDX', name: 'Nasdaq 100', short: 'NDX' },
  { symbol: '^TNX', name: '10-Year Treasury Yield', short: 'TNX' },
  { symbol: '^FTSE', name: 'FTSE 100', short: 'FTSE' },
  { symbol: '^N225', name: 'Nikkei 225', short: 'N225' },
  { symbol: '^GDAXI', name: 'DAX', short: 'DAX' },
];

// Flat, de-duplicated list of every S&P 500 symbol we track.
export const SP500_ALL = [...new Set(Object.values(SP500_BY_SECTOR).flat())];

// Fast symbol -> sector lookup.
export const SYMBOL_SECTOR = (() => {
  const map = {};
  for (const [sector, symbols] of Object.entries(SP500_BY_SECTOR)) {
    for (const s of symbols) map[s] = sector;
  }
  return map;
})();
