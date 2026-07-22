// server.js
import express from "express";
import cors from "cors";
import fetch2 from "node-fetch";
import dotenv from "dotenv";

// sp500.js
var SP500_BY_SECTOR = {
  "Information Technology": [
    "AAPL",
    "MSFT",
    "NVDA",
    "AVGO",
    "ORCL",
    "CRM",
    "AMD",
    "ADBE",
    "CSCO",
    "ACN",
    "INTC",
    "IBM",
    "TXN",
    "QCOM",
    "INTU",
    "NOW",
    "AMAT",
    "MU",
    "ADI",
    "LRCX",
    "KLAC",
    "SNPS",
    "CDNS",
    "ANET",
    "PANW",
    "CRWD",
    "ROP",
    "APH",
    "MSI",
    "FTNT",
    "MCHP",
    "NXPI",
    "ADSK",
    "TEL",
    "IT",
    "HPQ",
    "GLW",
    "HPE",
    "ON",
    "KEYS",
    "CTSH",
    "WDC",
    "STX",
    "GRMN",
    "FSLR",
    "TDY",
    "ZBRA",
    "PTC",
    "TYL",
    "NTAP"
  ],
  "Health Care": [
    "LLY",
    "UNH",
    "JNJ",
    "ABBV",
    "MRK",
    "TMO",
    "ABT",
    "DHR",
    "AMGN",
    "PFE",
    "ISRG",
    "BSX",
    "SYK",
    "ELV",
    "MDT",
    "GILD",
    "VRTX",
    "CI",
    "REGN",
    "CVS",
    "ZTS",
    "BDX",
    "HCA",
    "MCK",
    "BMY",
    "EW",
    "HUM",
    "DXCM",
    "BIIB",
    "IDXX",
    "GEHC",
    "A",
    "IQV",
    "RMD",
    "CNC",
    "MTD",
    "WST",
    "COR",
    "BAX",
    "MRNA",
    "STE",
    "ZBH",
    "HOLX",
    "WAT",
    "ALGN",
    "MOH",
    "PODD",
    "DGX",
    "RVTY",
    "VTRS"
  ],
  "Financials": [
    "BRK-B",
    "JPM",
    "V",
    "MA",
    "BAC",
    "WFC",
    "GS",
    "MS",
    "AXP",
    "SPGI",
    "BLK",
    "C",
    "SCHW",
    "MMC",
    "PGR",
    "CB",
    "FI",
    "BX",
    "ICE",
    "PYPL",
    "AON",
    "PNC",
    "USB",
    "CME",
    "AJG",
    "TFC",
    "MCO",
    "COF",
    "AFL",
    "MET",
    "TRV",
    "BK",
    "ALL",
    "AIG",
    "PRU",
    "MSCI",
    "AMP",
    "DFS",
    "FIS",
    "KKR",
    "ACGL",
    "HIG",
    "STT",
    "NDAQ",
    "WTW",
    "FITB",
    "RJF",
    "TROW",
    "CBOE",
    "BRO"
  ],
  "Consumer Discretionary": [
    "AMZN",
    "TSLA",
    "HD",
    "MCD",
    "NKE",
    "LOW",
    "BKNG",
    "TJX",
    "SBUX",
    "ORLY",
    "MAR",
    "CMG",
    "GM",
    "F",
    "HLT",
    "AZO",
    "ROST",
    "YUM",
    "RCL",
    "DHI",
    "LEN",
    "LVS",
    "EBAY",
    "APTV",
    "PHM",
    "GRMN",
    "ULTA",
    "NVR",
    "DRI",
    "BBY",
    "EXPE",
    "TSCO",
    "DPZ",
    "KMX",
    "CCL",
    "POOL",
    "WYNN",
    "MGM",
    "NCLH",
    "BWA"
  ],
  "Communication Services": [
    "META",
    "GOOGL",
    "GOOG",
    "NFLX",
    "DIS",
    "CMCSA",
    "T",
    "VZ",
    "TMUS",
    "CHTR",
    "EA",
    "WBD",
    "OMC",
    "TTWO",
    "FOXA",
    "FOX",
    "IPG",
    "LYV",
    "NWSA",
    "MTCH",
    "PARA",
    "DISH",
    "NWS"
  ],
  "Industrials": [
    "GE",
    "CAT",
    "RTX",
    "HON",
    "UNP",
    "BA",
    "UPS",
    "ETN",
    "DE",
    "LMT",
    "ADP",
    "GD",
    "NOC",
    "WM",
    "ITW",
    "CSX",
    "EMR",
    "FDX",
    "NSC",
    "PH",
    "TT",
    "MMM",
    "GEV",
    "TDG",
    "CTAS",
    "PCAR",
    "CARR",
    "CPRT",
    "JCI",
    "PAYX",
    "CMI",
    "ROK",
    "FAST",
    "AME",
    "OTIS",
    "URI",
    "GWW",
    "IR",
    "EFX",
    "VRSK",
    "ODFL",
    "DAL",
    "WAB",
    "XYL",
    "LUV",
    "UAL",
    "DOV",
    "HWM",
    "FTV",
    "BR"
  ],
  "Consumer Staples": [
    "PG",
    "COST",
    "WMT",
    "KO",
    "PEP",
    "PM",
    "MDLZ",
    "MO",
    "CL",
    "TGT",
    "KMB",
    "GIS",
    "SYY",
    "KVUE",
    "ADM",
    "MNST",
    "KDP",
    "STZ",
    "KHC",
    "HSY",
    "KR",
    "DG",
    "MKC",
    "CHD",
    "CLX",
    "DLTR",
    "K",
    "CAG",
    "SJM",
    "HRL",
    "TSN",
    "TAP",
    "CPB",
    "BG",
    "LW",
    "BF-B",
    "WBA"
  ],
  "Energy": [
    "XOM",
    "CVX",
    "COP",
    "EOG",
    "SLB",
    "MPC",
    "PSX",
    "WMB",
    "OKE",
    "VLO",
    "OXY",
    "KMI",
    "HES",
    "FANG",
    "BKR",
    "HAL",
    "DVN",
    "TRGP",
    "CTRA",
    "MRO",
    "APA",
    "EQT"
  ],
  "Utilities": [
    "NEE",
    "SO",
    "DUK",
    "CEG",
    "SRE",
    "AEP",
    "D",
    "PCG",
    "EXC",
    "XEL",
    "ED",
    "PEG",
    "WEC",
    "ETR",
    "AWK",
    "DTE",
    "PPL",
    "AEE",
    "ATO",
    "CMS",
    "FE",
    "CNP",
    "ES",
    "NI",
    "LNT",
    "EVRG",
    "AES"
  ],
  "Real Estate": [
    "PLD",
    "AMT",
    "EQIX",
    "WELL",
    "SPG",
    "PSA",
    "O",
    "CCI",
    "DLR",
    "CBRE",
    "EXR",
    "VICI",
    "AVB",
    "IRM",
    "SBAC",
    "EQR",
    "WY",
    "INVH",
    "VTR",
    "ARE",
    "MAA",
    "ESS",
    "KIM",
    "DOC",
    "HST",
    "REG",
    "UDR",
    "BXP",
    "FRT"
  ],
  "Materials": [
    "LIN",
    "SHW",
    "APD",
    "ECL",
    "FCX",
    "NEM",
    "NUE",
    "DOW",
    "DD",
    "CTVA",
    "VMC",
    "MLM",
    "PPG",
    "IFF",
    "ALB",
    "LYB",
    "STLD",
    "BALL",
    "AVY",
    "CF",
    "PKG",
    "IP",
    "AMCR",
    "MOS",
    "EMN",
    "CE",
    "FMC"
  ]
};
var MARKET_INDICES = [
  { symbol: "^GSPC", name: "S&P 500", short: "SPX" },
  { symbol: "^DJI", name: "Dow Jones Industrial", short: "DJIA" },
  { symbol: "^IXIC", name: "Nasdaq Composite", short: "COMP" },
  { symbol: "^RUT", name: "Russell 2000", short: "RUT" },
  { symbol: "^VIX", name: "CBOE Volatility", short: "VIX" },
  { symbol: "^NDX", name: "Nasdaq 100", short: "NDX" },
  { symbol: "^TNX", name: "10-Year Treasury Yield", short: "TNX" },
  { symbol: "^FTSE", name: "FTSE 100", short: "FTSE" },
  { symbol: "^N225", name: "Nikkei 225", short: "N225" },
  { symbol: "^GDAXI", name: "DAX", short: "DAX" }
];
var SP500_ALL = [...new Set(Object.values(SP500_BY_SECTOR).flat())];
var SYMBOL_SECTOR = (() => {
  const map = {};
  for (const [sector, symbols] of Object.entries(SP500_BY_SECTOR)) {
    for (const s of symbols) map[s] = sector;
  }
  return map;
})();

// instruments.js
var ASSET_CLASSES = [
  "Index",
  "Equity ETF",
  "Sector ETF",
  "Factor ETF",
  "International ETF",
  "Fixed Income",
  "Commodity",
  "Currency",
  "Futures",
  "Volatility",
  "Crypto"
];
var INSTRUMENTS = [
  // --- US Indices (reference) → tradeable proxy ---
  { symbol: "^GSPC", name: "S&P 500", class: "Index", region: "US", tradeable: "SPY" },
  { symbol: "^DJI", name: "Dow Jones Industrial", class: "Index", region: "US", tradeable: "DIA" },
  { symbol: "^IXIC", name: "Nasdaq Composite", class: "Index", region: "US", tradeable: "ONEQ" },
  { symbol: "^NDX", name: "Nasdaq 100", class: "Index", region: "US", tradeable: "QQQ" },
  { symbol: "^RUT", name: "Russell 2000", class: "Index", region: "US", tradeable: "IWM" },
  { symbol: "^MID", name: "S&P MidCap 400", class: "Index", region: "US", tradeable: "MDY" },
  { symbol: "^VIX", name: "CBOE Volatility Index", class: "Volatility", region: "US", tradeable: "VXX" },
  { symbol: "^VVIX", name: "VIX of VIX", class: "Volatility", region: "US" },
  { symbol: "^TNX", name: "US 10-Year Yield", class: "Fixed Income", region: "US", tradeable: "IEF" },
  { symbol: "^FVX", name: "US 5-Year Yield", class: "Fixed Income", region: "US", tradeable: "IEI" },
  { symbol: "^TYX", name: "US 30-Year Yield", class: "Fixed Income", region: "US", tradeable: "TLT" },
  // --- Broad market ETFs ---
  { symbol: "SPY", name: "SPDR S&P 500", class: "Equity ETF", region: "US" },
  { symbol: "QQQ", name: "Invesco Nasdaq 100", class: "Equity ETF", region: "US" },
  { symbol: "IWM", name: "iShares Russell 2000", class: "Equity ETF", region: "US" },
  { symbol: "DIA", name: "SPDR Dow Jones", class: "Equity ETF", region: "US" },
  { symbol: "VTI", name: "Vanguard Total Market", class: "Equity ETF", region: "US" },
  { symbol: "VOO", name: "Vanguard S&P 500", class: "Equity ETF", region: "US" },
  { symbol: "MDY", name: "SPDR S&P MidCap 400", class: "Equity ETF", region: "US" },
  { symbol: "RSP", name: "Invesco S&P 500 Equal Weight", class: "Equity ETF", region: "US" },
  { symbol: "QQQM", name: "Invesco Nasdaq 100 (low fee)", class: "Equity ETF", region: "US" },
  { symbol: "ONEQ", name: "Fidelity Nasdaq Composite", class: "Equity ETF", region: "US" },
  // --- Sector ETFs (SPDR Select Sector) ---
  { symbol: "XLK", name: "Technology", class: "Sector ETF", region: "US" },
  { symbol: "XLF", name: "Financials", class: "Sector ETF", region: "US" },
  { symbol: "XLV", name: "Health Care", class: "Sector ETF", region: "US" },
  { symbol: "XLE", name: "Energy", class: "Sector ETF", region: "US" },
  { symbol: "XLY", name: "Consumer Discretionary", class: "Sector ETF", region: "US" },
  { symbol: "XLP", name: "Consumer Staples", class: "Sector ETF", region: "US" },
  { symbol: "XLI", name: "Industrials", class: "Sector ETF", region: "US" },
  { symbol: "XLB", name: "Materials", class: "Sector ETF", region: "US" },
  { symbol: "XLRE", name: "Real Estate", class: "Sector ETF", region: "US" },
  { symbol: "XLU", name: "Utilities", class: "Sector ETF", region: "US" },
  { symbol: "XLC", name: "Communication Services", class: "Sector ETF", region: "US" },
  { symbol: "SMH", name: "Semiconductors", class: "Sector ETF", region: "US" },
  { symbol: "XBI", name: "Biotech", class: "Sector ETF", region: "US" },
  { symbol: "ITB", name: "Home Construction", class: "Sector ETF", region: "US" },
  { symbol: "KRE", name: "Regional Banks", class: "Sector ETF", region: "US" },
  { symbol: "JETS", name: "Airlines", class: "Sector ETF", region: "US" },
  // --- Factor / style ETFs ---
  { symbol: "MTUM", name: "Momentum", class: "Factor ETF", region: "US" },
  { symbol: "VLUE", name: "Value", class: "Factor ETF", region: "US" },
  { symbol: "QUAL", name: "Quality", class: "Factor ETF", region: "US" },
  { symbol: "USMV", name: "Min Volatility", class: "Factor ETF", region: "US" },
  { symbol: "SIZE", name: "Size", class: "Factor ETF", region: "US" },
  { symbol: "IWD", name: "Russell 1000 Value", class: "Factor ETF", region: "US" },
  { symbol: "IWF", name: "Russell 1000 Growth", class: "Factor ETF", region: "US" },
  { symbol: "SCHD", name: "Dividend Equity", class: "Factor ETF", region: "US" },
  { symbol: "NOBL", name: "Dividend Aristocrats", class: "Factor ETF", region: "US" },
  // --- International equity ---
  { symbol: "EFA", name: "MSCI EAFE (Developed)", class: "International ETF", region: "Global" },
  { symbol: "EEM", name: "MSCI Emerging Markets", class: "International ETF", region: "Global" },
  { symbol: "VEA", name: "FTSE Developed Markets", class: "International ETF", region: "Global" },
  { symbol: "VWO", name: "FTSE Emerging Markets", class: "International ETF", region: "Global" },
  { symbol: "FXI", name: "China Large-Cap", class: "International ETF", region: "Asia" },
  { symbol: "EWJ", name: "Japan", class: "International ETF", region: "Asia" },
  { symbol: "EWG", name: "Germany", class: "International ETF", region: "Europe" },
  { symbol: "EWU", name: "United Kingdom", class: "International ETF", region: "Europe" },
  { symbol: "INDA", name: "India", class: "International ETF", region: "Asia" },
  { symbol: "EWZ", name: "Brazil", class: "International ETF", region: "LatAm" },
  { symbol: "ACWI", name: "MSCI All Country World", class: "International ETF", region: "Global" },
  // --- Global indices (reference) ---
  { symbol: "^FTSE", name: "FTSE 100", class: "Index", region: "Europe", tradeable: "EWU" },
  { symbol: "^GDAXI", name: "DAX 40", class: "Index", region: "Europe", tradeable: "EWG" },
  { symbol: "^FCHI", name: "CAC 40", class: "Index", region: "Europe" },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", class: "Index", region: "Europe" },
  { symbol: "^N225", name: "Nikkei 225", class: "Index", region: "Asia", tradeable: "EWJ" },
  { symbol: "^HSI", name: "Hang Seng", class: "Index", region: "Asia" },
  { symbol: "000001.SS", name: "Shanghai Composite", class: "Index", region: "Asia", tradeable: "FXI" },
  { symbol: "^BSESN", name: "BSE Sensex", class: "Index", region: "Asia", tradeable: "INDA" },
  { symbol: "^AXJO", name: "ASX 200", class: "Index", region: "Asia" },
  { symbol: "^GSPTSE", name: "TSX Composite", class: "Index", region: "Americas" },
  { symbol: "^BVSP", name: "Bovespa", class: "Index", region: "LatAm", tradeable: "EWZ" },
  // --- Fixed income ETFs ---
  { symbol: "TLT", name: "20+ Year Treasury", class: "Fixed Income", region: "US" },
  { symbol: "IEF", name: "7-10 Year Treasury", class: "Fixed Income", region: "US" },
  { symbol: "IEI", name: "3-7 Year Treasury", class: "Fixed Income", region: "US" },
  { symbol: "SHY", name: "1-3 Year Treasury", class: "Fixed Income", region: "US" },
  { symbol: "BIL", name: "1-3 Month T-Bill", class: "Fixed Income", region: "US" },
  { symbol: "AGG", name: "US Aggregate Bond", class: "Fixed Income", region: "US" },
  { symbol: "BND", name: "Total Bond Market", class: "Fixed Income", region: "US" },
  { symbol: "LQD", name: "Investment Grade Corp", class: "Fixed Income", region: "US" },
  { symbol: "HYG", name: "High Yield Corp", class: "Fixed Income", region: "US" },
  { symbol: "JNK", name: "High Yield Bond", class: "Fixed Income", region: "US" },
  { symbol: "TIP", name: "TIPS (Inflation Protected)", class: "Fixed Income", region: "US" },
  { symbol: "MUB", name: "Municipal Bond", class: "Fixed Income", region: "US" },
  { symbol: "EMB", name: "EM Sovereign Bond", class: "Fixed Income", region: "Global" },
  // --- Commodities (ETFs + futures) ---
  { symbol: "GLD", name: "Gold Trust", class: "Commodity", region: "Global" },
  { symbol: "SLV", name: "Silver Trust", class: "Commodity", region: "Global" },
  { symbol: "USO", name: "US Oil Fund", class: "Commodity", region: "Global" },
  { symbol: "UNG", name: "US Natural Gas", class: "Commodity", region: "Global" },
  { symbol: "DBC", name: "Commodity Index", class: "Commodity", region: "Global" },
  { symbol: "DBA", name: "Agriculture", class: "Commodity", region: "Global" },
  { symbol: "COPX", name: "Copper Miners", class: "Commodity", region: "Global" },
  { symbol: "GDX", name: "Gold Miners", class: "Commodity", region: "Global" },
  // --- Futures ---
  { symbol: "ES=F", name: "E-mini S&P 500", class: "Futures", region: "US" },
  { symbol: "NQ=F", name: "E-mini Nasdaq 100", class: "Futures", region: "US" },
  { symbol: "YM=F", name: "E-mini Dow", class: "Futures", region: "US" },
  { symbol: "RTY=F", name: "E-mini Russell 2000", class: "Futures", region: "US" },
  { symbol: "GC=F", name: "Gold", class: "Futures", region: "Global" },
  { symbol: "SI=F", name: "Silver", class: "Futures", region: "Global" },
  { symbol: "HG=F", name: "Copper", class: "Futures", region: "Global" },
  { symbol: "CL=F", name: "Crude Oil WTI", class: "Futures", region: "Global" },
  { symbol: "BZ=F", name: "Brent Crude", class: "Futures", region: "Global" },
  { symbol: "NG=F", name: "Natural Gas", class: "Futures", region: "Global" },
  { symbol: "ZC=F", name: "Corn", class: "Futures", region: "US" },
  { symbol: "ZW=F", name: "Wheat", class: "Futures", region: "US" },
  { symbol: "ZS=F", name: "Soybeans", class: "Futures", region: "US" },
  { symbol: "ZN=F", name: "10-Year T-Note", class: "Futures", region: "US" },
  { symbol: "ZB=F", name: "30-Year T-Bond", class: "Futures", region: "US" },
  // --- Currencies ---
  { symbol: "DX-Y.NYB", name: "US Dollar Index", class: "Currency", region: "Global" },
  { symbol: "EURUSD=X", name: "EUR/USD", class: "Currency", region: "Global" },
  { symbol: "GBPUSD=X", name: "GBP/USD", class: "Currency", region: "Global" },
  { symbol: "USDJPY=X", name: "USD/JPY", class: "Currency", region: "Global" },
  { symbol: "USDCHF=X", name: "USD/CHF", class: "Currency", region: "Global" },
  { symbol: "AUDUSD=X", name: "AUD/USD", class: "Currency", region: "Global" },
  { symbol: "USDCAD=X", name: "USD/CAD", class: "Currency", region: "Global" },
  { symbol: "NZDUSD=X", name: "NZD/USD", class: "Currency", region: "Global" },
  { symbol: "USDCNY=X", name: "USD/CNY", class: "Currency", region: "Global" },
  { symbol: "USDMXN=X", name: "USD/MXN", class: "Currency", region: "Global" },
  // --- Crypto ---
  { symbol: "BTC-USD", name: "Bitcoin", class: "Crypto", region: "Global" },
  { symbol: "ETH-USD", name: "Ethereum", class: "Crypto", region: "Global" },
  { symbol: "SOL-USD", name: "Solana", class: "Crypto", region: "Global" },
  { symbol: "XRP-USD", name: "XRP", class: "Crypto", region: "Global" },
  { symbol: "BNB-USD", name: "BNB", class: "Crypto", region: "Global" },
  { symbol: "ADA-USD", name: "Cardano", class: "Crypto", region: "Global" },
  { symbol: "DOGE-USD", name: "Dogecoin", class: "Crypto", region: "Global" },
  { symbol: "AVAX-USD", name: "Avalanche", class: "Crypto", region: "Global" }
];
var INSTRUMENT_BY_SYMBOL = Object.fromEntries(INSTRUMENTS.map((i) => [i.symbol, i]));
var INSTRUMENTS_BY_CLASS = INSTRUMENTS.reduce((acc, i) => {
  (acc[i.class] ||= []).push(i);
  return acc;
}, {});

// blackscholes.js
function normPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
function normCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}
function d1d2(S, K, T, r, sigma, q = 0) {
  const vt = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / vt;
  return { d1, d2: d1 - vt, vt };
}
function bsPrice(type, S, K, T, r, sigma, q = 0) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    const intrinsic = type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return intrinsic;
  }
  const { d1, d2 } = d1d2(S, K, T, r, sigma, q);
  const dfR = Math.exp(-r * T), dfQ = Math.exp(-q * T);
  return type === "call" ? S * dfQ * normCdf(d1) - K * dfR * normCdf(d2) : K * dfR * normCdf(-d2) - S * dfQ * normCdf(-d1);
}
function greeks(type, S, K, T, r, sigma, q = 0) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    return { delta: null, gamma: null, vega: null, theta: null, rho: null };
  }
  const { d1, d2 } = d1d2(S, K, T, r, sigma, q);
  const dfR = Math.exp(-r * T), dfQ = Math.exp(-q * T);
  const pdf = normPdf(d1);
  const sqrtT = Math.sqrt(T);
  const delta = type === "call" ? dfQ * normCdf(d1) : dfQ * (normCdf(d1) - 1);
  const gamma = dfQ * pdf / (S * sigma * sqrtT);
  const vega = S * dfQ * pdf * sqrtT / 100;
  const termA = -(S * dfQ * pdf * sigma) / (2 * sqrtT);
  const thetaAnnual = type === "call" ? termA - r * K * dfR * normCdf(d2) + q * S * dfQ * normCdf(d1) : termA + r * K * dfR * normCdf(-d2) - q * S * dfQ * normCdf(-d1);
  const theta = thetaAnnual / 365;
  const rho = (type === "call" ? K * T * dfR * normCdf(d2) : -K * T * dfR * normCdf(-d2)) / 100;
  return {
    delta: +delta.toFixed(4),
    gamma: +gamma.toFixed(6),
    vega: +vega.toFixed(4),
    theta: +theta.toFixed(4),
    rho: +rho.toFixed(4)
  };
}
function impliedVol(type, marketPrice, S, K, T, r, q = 0) {
  if (T <= 0 || marketPrice <= 0 || S <= 0 || K <= 0) return null;
  const intrinsic = type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  if (marketPrice < intrinsic - 1e-6) return null;
  let sigma = 0.25;
  for (let i = 0; i < 50; i++) {
    const price = bsPrice(type, S, K, T, r, sigma, q);
    const diff = price - marketPrice;
    if (Math.abs(diff) < 1e-6) return +sigma.toFixed(6);
    const v = greeks(type, S, K, T, r, sigma, q).vega * 100;
    if (!v || !isFinite(v) || v < 1e-8) break;
    const next = sigma - diff / v;
    if (!isFinite(next) || next <= 0 || next > 10) break;
    sigma = next;
  }
  let lo = 1e-4, hi = 10;
  if (bsPrice(type, S, K, T, r, hi, q) < marketPrice) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (bsPrice(type, S, K, T, r, mid, q) < marketPrice) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-7) break;
  }
  const out = (lo + hi) / 2;
  return out > 9.99 ? null : +out.toFixed(6);
}
function yearsToExpiry(expirySeconds, nowMs = Date.now()) {
  return Math.max((expirySeconds * 1e3 - nowMs) / (365 * 24 * 3600 * 1e3), 0);
}

// regression.js
function invert(M) {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-12) return null;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    const p = A[col][col];
    for (let j = 0; j < 2 * n; j++) A[col][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j];
    }
  }
  return A.map((row) => row.slice(n));
}
function transpose(M) {
  return M[0].map((_, j) => M.map((row) => row[j]));
}
function matMul(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  const out = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let x = 0; x < k; x++) s += A[i][x] * B[x][j];
      out[i][j] = s;
    }
  }
  return out;
}
function ols(X, y) {
  const n = X.length;
  if (!n || n !== y.length) return null;
  const k = X[0].length;
  if (n <= k + 1) return null;
  const Xd = X.map((row) => [1, ...row]);
  const Xt = transpose(Xd);
  const XtX = matMul(Xt, Xd);
  const XtXinv = invert(XtX);
  if (!XtXinv) return null;
  const Xty = matMul(Xt, y.map((v) => [v]));
  const beta = matMul(XtXinv, Xty).map((r) => r[0]);
  const fitted = Xd.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0));
  const resid = y.map((v, i) => v - fitted[i]);
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const tss = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const rss = resid.reduce((s, v) => s + v * v, 0);
  const dof = n - k - 1;
  const sigma2 = rss / dof;
  const se = XtXinv.map((row, i) => Math.sqrt(Math.max(sigma2 * row[i], 0)));
  const tStats = beta.map((b, i) => se[i] ? b / se[i] : null);
  const r2 = tss > 0 ? 1 - rss / tss : 0;
  const adjR2 = tss > 0 && dof > 0 ? 1 - rss / dof / (tss / (n - 1)) : 0;
  return {
    intercept: beta[0],
    coefficients: beta.slice(1),
    interceptSE: se[0],
    coefficientSE: se.slice(1),
    interceptT: tStats[0],
    tStats: tStats.slice(1),
    r2,
    adjR2,
    residualStd: Math.sqrt(sigma2),
    n,
    dof,
    residuals: resid
  };
}
function pValue(t, dof) {
  if (t == null || !isFinite(t)) return null;
  if (dof < 30) return null;
  const z = Math.abs(t);
  const s = 1 / (1 + 0.2316419 * z);
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const poly = s * (0.31938153 + s * (-0.356563782 + s * (1.781477937 + s * (-1.821255978 + s * 1.330274429))));
  const upperTail = pdf * poly;
  return +(2 * upperTail).toFixed(4);
}

// portfolio-math.js
function covariance(series) {
  const k = series.length;
  const n = series[0].length;
  const means = series.map((s) => s.reduce((a, b) => a + b, 0) / n);
  const C = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      let s = 0;
      for (let t = 0; t < n; t++) s += (series[i][t] - means[i]) * (series[j][t] - means[j]);
      const v = s / (n - 1);
      C[i][j] = v;
      C[j][i] = v;
    }
  }
  return C;
}
var dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
var matVec = (M, v) => M.map((row) => dot(row, v));
function portfolioVariance(weights, cov) {
  return dot(weights, matVec(cov, weights));
}
function minVariancePortfolio(cov) {
  const inv = invert(cov);
  if (!inv) return null;
  const ones = new Array(cov.length).fill(1);
  const z = matVec(inv, ones);
  const denom = dot(ones, z);
  if (!denom || !isFinite(denom)) return null;
  return z.map((v) => v / denom);
}
function tangencyPortfolio(cov, meanReturns, riskFree = 0) {
  const inv = invert(cov);
  if (!inv) return null;
  const excess = meanReturns.map((m) => m - riskFree);
  const z = matVec(inv, excess);
  const denom = z.reduce((a, b) => a + b, 0);
  if (!denom || !isFinite(denom)) return null;
  return z.map((v) => v / denom);
}
function efficientFrontier(cov, meanReturns, riskFree = 0, steps = 25) {
  const wMin = minVariancePortfolio(cov);
  const wTan = tangencyPortfolio(cov, meanReturns, riskFree);
  if (!wMin) return null;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const lam = 2 * i / steps;
    const w = wTan ? wMin.map((v, k) => (1 - lam) * v + lam * wTan[k]) : wMin;
    const varr = portfolioVariance(w, cov);
    if (varr < 0) continue;
    points.push({ lambda: lam, weights: w, return: dot(w, meanReturns), risk: Math.sqrt(varr) });
  }
  points.sort((a, b) => a.risk - b.risk);
  return { points, minVariance: wMin, tangency: wTan };
}

// bot/risk-gate.js
var DEFAULT_LIMITS = {
  maxPositionPercent: 5,
  // single position as % of equity
  maxSectorPercent: 25,
  // sector concentration
  maxGrossExposurePercent: 100,
  // no leverage
  maxDailyLossPercent: 2,
  // halt trading for the day
  maxDrawdownPercent: 10,
  // halt, require manual restart
  maxOrdersPerDay: 20,
  maxOrderPercentOfADV: 1,
  // liquidity: don't be the market
  minOrderValue: 50
  // don't pay commission on dust
};
var REJECT = {
  BOT_OFF: "bot_disabled",
  HALTED: "trading_halted",
  DAILY_LOSS: "daily_loss_limit",
  DRAWDOWN: "max_drawdown",
  ORDER_COUNT: "daily_order_limit",
  POSITION_SIZE: "position_size_limit",
  SECTOR: "sector_concentration_limit",
  GROSS_EXPOSURE: "gross_exposure_limit",
  LIQUIDITY: "liquidity_limit",
  DUST: "below_min_order_value",
  NO_SHARES: "no_position_to_sell",
  BAD_INPUT: "invalid_order",
  MARKET_CLOSED: "market_closed"
};
function evaluateOrder(order, state2, limits = DEFAULT_LIMITS) {
  const warnings = [];
  const reject = (reason, detail) => ({ approved: false, reason, detail, warnings });
  if (!order || !order.symbol || !order.side) return reject(REJECT.BAD_INPUT, "Missing symbol or side");
  if (!["buy", "sell"].includes(order.side)) return reject(REJECT.BAD_INPUT, `Unknown side "${order.side}"`);
  const price = Number(order.price);
  if (!Number.isFinite(price) || price <= 0) return reject(REJECT.BAD_INPUT, "Invalid price");
  let qty = Math.floor(Number(order.qty));
  if (!Number.isFinite(qty) || qty <= 0) return reject(REJECT.BAD_INPUT, "Invalid quantity");
  const equity = Number(state2.equity);
  if (!Number.isFinite(equity) || equity <= 0) return reject(REJECT.BAD_INPUT, "Invalid account equity");
  if (!state2.enabled) return reject(REJECT.BOT_OFF, "Bot is switched off");
  if (state2.halted) return reject(REJECT.HALTED, state2.haltReason || "Trading halted");
  if (state2.dailyPnlPercent != null && state2.dailyPnlPercent <= -limits.maxDailyLossPercent) {
    return reject(
      REJECT.DAILY_LOSS,
      `Down ${Math.abs(state2.dailyPnlPercent).toFixed(2)}% today (limit ${limits.maxDailyLossPercent}%)`
    );
  }
  if (state2.drawdownPercent != null && state2.drawdownPercent >= limits.maxDrawdownPercent) {
    return reject(
      REJECT.DRAWDOWN,
      `Drawdown ${state2.drawdownPercent.toFixed(2)}% (limit ${limits.maxDrawdownPercent}%)`
    );
  }
  if ((state2.ordersToday || 0) >= limits.maxOrdersPerDay) {
    return reject(REJECT.ORDER_COUNT, `${state2.ordersToday} orders today (limit ${limits.maxOrdersPerDay})`);
  }
  if (state2.marketOpen === false && !order.allowExtendedHours) {
    return reject(REJECT.MARKET_CLOSED, "Market is closed");
  }
  const positions = state2.positions || {};
  const held = positions[order.symbol]?.qty || 0;
  if (order.side === "sell") {
    if (held <= 0) return reject(REJECT.NO_SHARES, `No position in ${order.symbol}`);
    if (qty > held) {
      warnings.push(`Reduced sell from ${qty} to ${held} (position size)`);
      qty = held;
    }
    return { approved: true, adjustedQty: qty, warnings };
  }
  let orderValue = qty * price;
  if (orderValue < limits.minOrderValue) {
    return reject(REJECT.DUST, `Order value $${orderValue.toFixed(2)} below $${limits.minOrderValue} minimum`);
  }
  const currentPosValue = positions[order.symbol]?.marketValue || 0;
  const maxPosValue = equity * (limits.maxPositionPercent / 100);
  if (currentPosValue + orderValue > maxPosValue) {
    const allowedValue = maxPosValue - currentPosValue;
    const allowedQty = Math.floor(allowedValue / price);
    if (allowedQty <= 0) {
      return reject(
        REJECT.POSITION_SIZE,
        `${order.symbol} already at ${(currentPosValue / equity * 100).toFixed(1)}% of equity (limit ${limits.maxPositionPercent}%)`
      );
    }
    warnings.push(`Reduced ${qty} to ${allowedQty} (${limits.maxPositionPercent}% position limit)`);
    qty = allowedQty;
    orderValue = qty * price;
  }
  if (order.sector) {
    const sectorValue = Object.values(positions).filter((p) => p.sector === order.sector).reduce((s, p) => s + (p.marketValue || 0), 0);
    const maxSectorValue = equity * (limits.maxSectorPercent / 100);
    if (sectorValue + orderValue > maxSectorValue) {
      const allowedQty = Math.floor((maxSectorValue - sectorValue) / price);
      if (allowedQty <= 0) {
        return reject(
          REJECT.SECTOR,
          `${order.sector} already at ${(sectorValue / equity * 100).toFixed(1)}% of equity (limit ${limits.maxSectorPercent}%)`
        );
      }
      warnings.push(`Reduced ${qty} to ${allowedQty} (${limits.maxSectorPercent}% sector limit)`);
      qty = allowedQty;
      orderValue = qty * price;
    }
  }
  const grossValue = Object.values(positions).reduce((s, p) => s + Math.abs(p.marketValue || 0), 0);
  const maxGross = equity * (limits.maxGrossExposurePercent / 100);
  if (grossValue + orderValue > maxGross) {
    const allowedQty = Math.floor((maxGross - grossValue) / price);
    if (allowedQty <= 0) {
      return reject(
        REJECT.GROSS_EXPOSURE,
        `Gross exposure ${(grossValue / equity * 100).toFixed(1)}% (limit ${limits.maxGrossExposurePercent}%)`
      );
    }
    warnings.push(`Reduced ${qty} to ${allowedQty} (gross exposure limit)`);
    qty = allowedQty;
    orderValue = qty * price;
  }
  if (order.avgDailyVolume > 0) {
    const maxQty = Math.floor(order.avgDailyVolume * (limits.maxOrderPercentOfADV / 100));
    if (qty > maxQty) {
      if (maxQty <= 0) return reject(REJECT.LIQUIDITY, `${order.symbol} too illiquid`);
      warnings.push(`Reduced ${qty} to ${maxQty} (${limits.maxOrderPercentOfADV}% of ADV)`);
      qty = maxQty;
      orderValue = qty * price;
    }
  }
  if (orderValue < limits.minOrderValue) {
    return reject(REJECT.DUST, `Order shrank to $${orderValue.toFixed(2)} after limits`);
  }
  return { approved: true, adjustedQty: qty, warnings };
}
function checkHaltConditions(state2, limits = DEFAULT_LIMITS) {
  if (state2.dailyPnlPercent != null && state2.dailyPnlPercent <= -limits.maxDailyLossPercent) {
    return {
      halt: true,
      reason: REJECT.DAILY_LOSS,
      detail: `Daily loss ${state2.dailyPnlPercent.toFixed(2)}% hit the ${limits.maxDailyLossPercent}% limit`,
      requiresManualRestart: false
    };
  }
  if (state2.drawdownPercent != null && state2.drawdownPercent >= limits.maxDrawdownPercent) {
    return {
      halt: true,
      reason: REJECT.DRAWDOWN,
      detail: `Drawdown ${state2.drawdownPercent.toFixed(2)}% hit the ${limits.maxDrawdownPercent}% limit`,
      requiresManualRestart: true
    };
  }
  return { halt: false };
}

// bot/strategies.js
var clamp01 = (v) => Math.max(0, Math.min(1, v));
function rsiStrategy(ta) {
  const rsi2 = ta?.oscillators?.rsi14;
  if (rsi2 == null) return null;
  if (rsi2 < 30) return { action: "BUY", confidence: clamp01((30 - rsi2) / 20), rationale: `RSI ${rsi2} oversold` };
  if (rsi2 > 70) return { action: "SELL", confidence: clamp01((rsi2 - 70) / 20), rationale: `RSI ${rsi2} overbought` };
  return { action: "HOLD", confidence: 0, rationale: `RSI ${rsi2} neutral` };
}
function macdStrategy(ta) {
  const m = ta?.oscillators?.macd;
  const price = ta?.price;
  if (!m || !price) return null;
  const strength = clamp01(Math.abs(m.histogram) / (price * 0.01));
  if (m.histogram > 0) return { action: "BUY", confidence: strength, rationale: `MACD histogram +${m.histogram}` };
  if (m.histogram < 0) return { action: "SELL", confidence: strength, rationale: `MACD histogram ${m.histogram}` };
  return { action: "HOLD", confidence: 0, rationale: "MACD flat" };
}
function trendStrategy(ta) {
  const ma = ta?.movingAverages;
  const price = ta?.price;
  if (!ma || !price || ma.sma50 == null || ma.sma200 == null) return null;
  const golden = ma.sma50 > ma.sma200;
  const above = price > ma.sma50;
  if (golden && above) return { action: "BUY", confidence: 0.6, rationale: "Golden cross, price above 50-day" };
  if (!golden && !above) return { action: "SELL", confidence: 0.6, rationale: "Death cross, price below 50-day" };
  return { action: "HOLD", confidence: 0.2, rationale: golden ? "Uptrend but price below 50-day" : "Downtrend but price above 50-day" };
}
function bollingerStrategy(ta) {
  const bb = ta?.bollinger;
  const price = ta?.price;
  if (!bb || !price) return null;
  if (price < bb.lower) return { action: "BUY", confidence: clamp01((bb.lower - price) / (bb.middle - bb.lower)), rationale: "Price below lower band" };
  if (price > bb.upper) return { action: "SELL", confidence: clamp01((price - bb.upper) / (bb.upper - bb.middle)), rationale: "Price above upper band" };
  return { action: "HOLD", confidence: 0, rationale: "Price inside bands" };
}
function consensusStrategy(ta) {
  const s = ta?.summary;
  if (!s) return null;
  const total = s.buy + s.sell + s.neutral || 1;
  const net = (s.buy - s.sell) / total;
  if (net > 0.2) return { action: "BUY", confidence: clamp01(net), rationale: `${s.buy}/${total} indicators bullish` };
  if (net < -0.2) return { action: "SELL", confidence: clamp01(-net), rationale: `${s.sell}/${total} indicators bearish` };
  return { action: "HOLD", confidence: 0, rationale: "Indicators mixed" };
}
var STRATEGIES = {
  rsi: {
    name: "RSI Reversion",
    fn: rsiStrategy,
    weight: 1,
    family: "Mean reversion",
    description: "Buys oversold (RSI<30), sells overbought (RSI>70).",
    worksWhen: "Range-bound markets",
    failsWhen: "Strong trends \u2014 stays overbought for months"
  },
  macd: {
    name: "MACD Momentum",
    fn: macdStrategy,
    weight: 1,
    family: "Momentum",
    description: "Follows the MACD histogram sign, scaled by size relative to price.",
    worksWhen: "Sustained directional moves",
    failsWhen: "Choppy markets \u2014 whipsaws"
  },
  trend: {
    name: "Trend Following",
    fn: trendStrategy,
    weight: 1.5,
    family: "Trend",
    description: "50/200 golden and death cross, confirmed by price vs the 50-day.",
    worksWhen: "Long sustained trends",
    failsWhen: "Sideways markets \u2014 late entries and exits"
  },
  bollinger: {
    name: "Bollinger Reversion",
    fn: bollingerStrategy,
    weight: 1,
    family: "Mean reversion",
    description: "Fades moves outside the 20/2 bands.",
    worksWhen: "Stable volatility",
    failsWhen: "Volatility expansion \u2014 fades a breakout"
  },
  consensus: {
    name: "Indicator Consensus",
    fn: consensusStrategy,
    weight: 2,
    family: "Ensemble",
    description: "Net vote across all 12 indicators in the technical engine.",
    worksWhen: "Most regimes; the broadest signal",
    failsWhen: "Regime turns \u2014 indicators lag together"
  }
};
var PRESETS = {
  conservative: {
    name: "Conservative",
    description: "Trend and consensus only. Trades rarely, needs strong agreement.",
    strategies: ["trend", "consensus"],
    threshold: 0.3
  },
  balanced: {
    name: "Balanced",
    description: "All five strategies with a moderate agreement bar.",
    strategies: ["rsi", "macd", "trend", "bollinger", "consensus"],
    threshold: 0.15
  },
  aggressive: {
    name: "Aggressive",
    description: "All five, acts on weaker agreement. Trades much more often.",
    strategies: ["rsi", "macd", "trend", "bollinger", "consensus"],
    threshold: 0.08
  },
  trendOnly: {
    name: "Trend only",
    description: "Momentum and trend. Suited to directional markets.",
    strategies: ["trend", "macd"],
    threshold: 0.2
  },
  reversionOnly: {
    name: "Reversion only",
    description: "RSI and Bollinger. Suited to range-bound markets.",
    strategies: ["rsi", "bollinger"],
    threshold: 0.2
  }
};
function describeStrategies() {
  return Object.entries(STRATEGIES).map(([key3, s]) => ({
    key: key3,
    name: s.name,
    family: s.family,
    weight: s.weight,
    description: s.description,
    worksWhen: s.worksWhen,
    failsWhen: s.failsWhen
  }));
}
function describePresets() {
  return Object.entries(PRESETS).map(([key3, p]) => ({ key: key3, ...p }));
}
function ensemble(ta, enabledKeys = Object.keys(STRATEGIES), threshold = 0.15) {
  const signals = [];
  let buyScore = 0, sellScore = 0, totalWeight = 0;
  for (const key3 of enabledKeys) {
    const strat = STRATEGIES[key3];
    if (!strat) continue;
    const sig = strat.fn(ta);
    if (!sig) continue;
    signals.push({ key: key3, name: strat.name, ...sig, weight: strat.weight });
    totalWeight += strat.weight;
    if (sig.action === "BUY") buyScore += strat.weight * sig.confidence;
    if (sig.action === "SELL") sellScore += strat.weight * sig.confidence;
  }
  if (!signals.length || !totalWeight) {
    return { action: "HOLD", confidence: 0, signals: [], rationale: "No signals available" };
  }
  const net = (buyScore - sellScore) / totalWeight;
  const action = net > threshold ? "BUY" : net < -threshold ? "SELL" : "HOLD";
  const agreeing = signals.filter((s) => s.action === action).length;
  return {
    action,
    confidence: +clamp01(Math.abs(net)).toFixed(3),
    netScore: +net.toFixed(3),
    threshold,
    signals,
    agreement: `${agreeing}/${signals.length}`,
    rationale: action === "HOLD" ? `Signals too mixed to act (net ${net.toFixed(2)}, needs ${threshold})` : `${agreeing} of ${signals.length} strategies agree on ${action}`
  };
}
function sizePosition(decision, equity, price, maxPositionPercent = 5) {
  if (decision.action !== "BUY" || !price || price <= 0) return 0;
  const targetPercent = maxPositionPercent * decision.confidence;
  return Math.max(Math.floor(equity * (targetPercent / 100) / price), 0);
}

// bot/mistral.js
var key = () => process.env.MISTRAL_API_KEY;
var model = () => process.env.MISTRAL_MODEL || "mistral-small-latest";
var mistralConfigured = () => Boolean(key());
var budget = { date: null, calls: 0, tokens: 0, maxCalls: 200 };
function resetBudgetIfNewDay() {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (budget.date !== today) {
    budget.date = today;
    budget.calls = 0;
    budget.tokens = 0;
  }
}
function getBudget() {
  resetBudgetIfNewDay();
  return { ...budget, remaining: Math.max(budget.maxCalls - budget.calls, 0) };
}
var SYSTEM = `You are a risk-focused reviewer on a trading desk. A quantitative system has produced a trading decision from technical indicators. Your job is to review it, not to originate trades.

Respond ONLY with JSON:
{"stance":"AGREE"|"DISAGREE"|"CAUTION","confidence":0.0-1.0,"reasoning":"one or two sentences","keyRisk":"the single biggest risk to this trade"}

Be sceptical. Technical signals fail often. If the evidence is thin, say CAUTION. Do not invent facts you were not given, and never claim knowledge of news you have not been shown.`;
async function reviewDecision({ symbol, decision, technical, news = [], position = null }) {
  if (!mistralConfigured()) return null;
  resetBudgetIfNewDay();
  if (budget.calls >= budget.maxCalls) {
    return { stance: "UNAVAILABLE", reasoning: "Daily LLM budget exhausted", budgetExhausted: true };
  }
  const facts = [
    `Symbol: ${symbol}`,
    `Quant decision: ${decision.action} (confidence ${decision.confidence}, ${decision.agreement} strategies agreeing)`,
    `Signals: ${decision.signals.map((s) => `${s.name}=${s.action}`).join(", ")}`,
    technical?.price != null ? `Price: $${technical.price}` : null,
    technical?.oscillators?.rsi14 != null ? `RSI(14): ${technical.oscillators.rsi14}` : null,
    technical?.summary ? `Indicator summary: ${technical.summary.overall}` : null,
    technical?.range52w ? `52w range position: ${technical.range52w.position}%` : null,
    technical?.movingAverages?.cross ? `MA cross: ${technical.movingAverages.cross}` : null,
    position ? `Existing position: ${position.qty} shares, P&L ${position.unrealisedPercent?.toFixed(1)}%` : "No existing position",
    news.length ? `Recent headlines:
${news.slice(0, 5).map((n) => `- ${n.headline} [${n.sentiment}]`).join("\n")}` : "No recent news supplied"
  ].filter(Boolean).join("\n");
  try {
    const resp = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model(),
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: facts }
        ],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" }
      })
    });
    budget.calls++;
    if (!resp.ok) {
      const t = await resp.text();
      return { stance: "UNAVAILABLE", reasoning: `Mistral error ${resp.status}`, detail: t.slice(0, 160) };
    }
    const data = await resp.json();
    budget.tokens += data.usage?.total_tokens || 0;
    const raw = data.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { stance: "UNAVAILABLE", reasoning: "Model returned unparseable output", raw: raw.slice(0, 200) };
    }
    const stance = ["AGREE", "DISAGREE", "CAUTION"].includes(parsed.stance) ? parsed.stance : "CAUTION";
    return {
      stance,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reasoning: String(parsed.reasoning || "").slice(0, 400),
      keyRisk: String(parsed.keyRisk || "").slice(0, 300),
      model: model(),
      tokens: data.usage?.total_tokens || 0
    };
  } catch (e) {
    return { stance: "UNAVAILABLE", reasoning: `Mistral call failed: ${e.message}` };
  }
}
function applyReview(decision, review) {
  if (!review || review.stance === "UNAVAILABLE") {
    return { ...decision, llm: review || null };
  }
  if (decision.action === "HOLD") return { ...decision, llm: review };
  if (review.stance === "DISAGREE" && review.confidence >= 0.6) {
    return {
      ...decision,
      action: "HOLD",
      confidence: 0,
      vetoed: true,
      rationale: `${decision.rationale} \u2014 vetoed by review: ${review.reasoning}`,
      llm: review
    };
  }
  if (review.stance === "CAUTION" || review.stance === "DISAGREE") {
    return {
      ...decision,
      confidence: +(decision.confidence * 0.5).toFixed(3),
      damped: true,
      rationale: `${decision.rationale} \u2014 size reduced after review`,
      llm: review
    };
  }
  return { ...decision, llm: review };
}

// bot/alpaca.js
var endpoint = () => process.env.ALPACA_ENDPOINT || "https://paper-api.alpaca.markets/v2";
var key2 = () => process.env.ALPACA_API_KEY;
var secret = () => process.env.ALPACA_SECRET_KEY;
var isPaperEndpoint = (url = endpoint()) => /paper-api\.alpaca\.markets/.test(url);
var alpacaConfigured = () => Boolean(key2() && secret());
async function alpaca(path, options = {}) {
  if (!alpacaConfigured()) throw new Error("Alpaca credentials not configured");
  const resp = await fetch(`${endpoint()}${path}`, {
    ...options,
    headers: {
      "APCA-API-KEY-ID": key2(),
      "APCA-API-SECRET-KEY": secret(),
      "Content-Type": "application/json",
      ...options.headers || {}
    }
  });
  const text = await resp.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!resp.ok) {
    const msg = body?.message || body?.raw || `HTTP ${resp.status}`;
    throw new Error(`Alpaca ${path}: ${msg}`);
  }
  return body;
}
async function getAccount() {
  const a = await alpaca("/account");
  return {
    status: a.status,
    equity: parseFloat(a.equity),
    lastEquity: parseFloat(a.last_equity),
    cash: parseFloat(a.cash),
    buyingPower: parseFloat(a.buying_power),
    tradingBlocked: a.trading_blocked,
    accountBlocked: a.account_blocked,
    currency: a.currency,
    // Same-day P&L against the previous close.
    dailyPnl: parseFloat(a.equity) - parseFloat(a.last_equity),
    dailyPnlPercent: parseFloat(a.last_equity) ? (parseFloat(a.equity) - parseFloat(a.last_equity)) / parseFloat(a.last_equity) * 100 : 0
  };
}
async function getPositions() {
  const rows = await alpaca("/positions");
  return (rows || []).map((p) => ({
    symbol: p.symbol,
    qty: parseFloat(p.qty),
    side: p.side,
    avgEntryPrice: parseFloat(p.avg_entry_price),
    marketValue: parseFloat(p.market_value),
    costBasis: parseFloat(p.cost_basis),
    unrealisedPnl: parseFloat(p.unrealized_pl),
    unrealisedPercent: parseFloat(p.unrealized_plpc) * 100,
    currentPrice: parseFloat(p.current_price)
  }));
}
async function getClock() {
  const c = await alpaca("/clock");
  return { isOpen: c.is_open, nextOpen: c.next_open, nextClose: c.next_close, timestamp: c.timestamp };
}
async function getOrders(status = "all", limit = 50) {
  const rows = await alpaca(`/orders?status=${status}&limit=${limit}&direction=desc`);
  return (rows || []).map((o) => ({
    id: o.id,
    clientOrderId: o.client_order_id,
    symbol: o.symbol,
    side: o.side,
    qty: parseFloat(o.qty),
    filledQty: parseFloat(o.filled_qty || 0),
    type: o.type,
    status: o.status,
    submittedAt: o.submitted_at,
    filledAt: o.filled_at,
    filledAvgPrice: o.filled_avg_price ? parseFloat(o.filled_avg_price) : null
  }));
}
async function submitOrder({ symbol, side, qty, type = "market", timeInForce = "day", clientOrderId }) {
  const body = {
    symbol,
    side,
    qty: String(qty),
    type,
    time_in_force: timeInForce,
    ...clientOrderId ? { client_order_id: clientOrderId } : {}
  };
  const o = await alpaca("/orders", { method: "POST", body: JSON.stringify(body) });
  return {
    id: o.id,
    clientOrderId: o.client_order_id,
    symbol: o.symbol,
    side: o.side,
    qty: parseFloat(o.qty),
    type: o.type,
    status: o.status,
    submittedAt: o.submitted_at
  };
}
async function cancelAllOrders() {
  try {
    const r = await alpaca("/orders", { method: "DELETE" });
    return { cancelled: Array.isArray(r) ? r.length : 0 };
  } catch (e) {
    return { cancelled: 0, error: e.message };
  }
}
async function closeAllPositions() {
  try {
    const r = await alpaca("/positions?cancel_orders=true", { method: "DELETE" });
    const rows = Array.isArray(r) ? r : [];
    return {
      attempted: rows.length,
      succeeded: rows.filter((x) => x.status >= 200 && x.status < 300).length,
      failures: rows.filter((x) => !(x.status >= 200 && x.status < 300)).map((x) => x.symbol)
    };
  } catch (e) {
    return { attempted: 0, succeeded: 0, failures: [], error: e.message };
  }
}

// bot/engine.js
var state = {
  enabled: false,
  // OFF by default. Always.
  halted: false,
  haltReason: null,
  requiresManualRestart: false,
  mode: "paper",
  watchlist: ["AAPL", "MSFT", "NVDA", "SPY", "QQQ"],
  strategies: PRESETS.balanced.strategies,
  threshold: PRESETS.balanced.threshold,
  preset: "balanced",
  useLlm: true,
  limits: { ...DEFAULT_LIMITS },
  ordersToday: 0,
  ordersDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
  peakEquity: null,
  lastRun: null,
  lastError: null
};
var decisions = [];
var auditLog = [];
var MAX_LOG = 200;
function audit(event, detail = {}) {
  auditLog.unshift({ at: (/* @__PURE__ */ new Date()).toISOString(), event, ...detail });
  if (auditLog.length > MAX_LOG) auditLog.length = MAX_LOG;
}
function rollDayIfNeeded() {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (state.ordersDate !== today) {
    state.ordersDate = today;
    state.ordersToday = 0;
    if (state.halted && !state.requiresManualRestart) {
      state.halted = false;
      state.haltReason = null;
      audit("halt_cleared", { reason: "new trading day" });
    }
  }
}
function getState() {
  rollDayIfNeeded();
  return {
    ...state,
    brokerConfigured: alpacaConfigured(),
    isPaper: isPaperEndpoint(),
    llmConfigured: mistralConfigured(),
    llmBudget: getBudget(),
    availableStrategies: describeStrategies(),
    availablePresets: describePresets()
  };
}
function setEnabled(enabled, who = "user") {
  if (enabled && state.halted && state.requiresManualRestart) {
    return { ok: false, error: `Cannot enable: ${state.haltReason}. Reset the halt first.` };
  }
  state.enabled = Boolean(enabled);
  audit(enabled ? "bot_enabled" : "bot_disabled", { by: who });
  return { ok: true, enabled: state.enabled };
}
function resetHalt(who = "user") {
  state.halted = false;
  state.haltReason = null;
  state.requiresManualRestart = false;
  audit("halt_reset", { by: who });
  return { ok: true };
}
function updateConfig(patch = {}) {
  if (Array.isArray(patch.watchlist)) {
    state.watchlist = patch.watchlist.map((s) => String(s).toUpperCase()).slice(0, 20);
  }
  if (patch.preset && PRESETS[patch.preset]) {
    const p = PRESETS[patch.preset];
    state.preset = patch.preset;
    state.strategies = [...p.strategies];
    state.threshold = p.threshold;
  }
  if (Array.isArray(patch.strategies)) {
    const next = patch.strategies.filter((k) => STRATEGIES[k]);
    if (next.length) {
      state.strategies = next;
      state.preset = "custom";
    }
  }
  if (patch.threshold != null) {
    const t = Number(patch.threshold);
    if (Number.isFinite(t) && t >= 0 && t <= 1) {
      state.threshold = t;
      state.preset = "custom";
    }
  }
  if (typeof patch.useLlm === "boolean") state.useLlm = patch.useLlm;
  if (patch.limits && typeof patch.limits === "object") {
    const ceilings = {
      maxPositionPercent: 20,
      maxSectorPercent: 50,
      maxGrossExposurePercent: 100,
      maxDailyLossPercent: 10,
      maxDrawdownPercent: 25,
      maxOrdersPerDay: 100,
      maxOrderPercentOfADV: 5,
      minOrderValue: 1e4
    };
    for (const [k, v] of Object.entries(patch.limits)) {
      if (!(k in state.limits)) continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) continue;
      state.limits[k] = Math.min(n, ceilings[k] ?? n);
    }
  }
  audit("config_updated", { patch: Object.keys(patch) });
  return getState();
}
function getDecisions(limit = 50) {
  return decisions.slice(0, limit);
}
function getAudit(limit = 50) {
  return auditLog.slice(0, limit);
}
async function killSwitch(who = "user") {
  state.enabled = false;
  state.halted = true;
  state.haltReason = "Kill switch activated";
  state.requiresManualRestart = true;
  audit("kill_switch", { by: who });
  const cancelled = await cancelAllOrders();
  const closed = await closeAllPositions();
  audit("kill_switch_complete", { cancelled, closed });
  return { ok: true, cancelled, closed };
}
async function runCycle({ fetchTechnical, fetchNews, dryRun = false }) {
  rollDayIfNeeded();
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (!state.enabled && !dryRun) {
    return { ok: false, skipped: "Bot is off", startedAt };
  }
  if (!alpacaConfigured()) {
    return { ok: false, skipped: "Broker not configured", startedAt };
  }
  let account, positions, clock;
  try {
    [account, positions, clock] = await Promise.all([
      getAccount(),
      getPositions(),
      getClock()
    ]);
  } catch (e) {
    state.lastError = e.message;
    audit("cycle_error", { error: e.message });
    return { ok: false, error: e.message, startedAt };
  }
  state.peakEquity = state.peakEquity == null ? account.equity : Math.max(state.peakEquity, account.equity);
  const drawdownPercent = state.peakEquity > 0 ? (state.peakEquity - account.equity) / state.peakEquity * 100 : 0;
  const posBySymbol = Object.fromEntries(positions.map((p) => [p.symbol, p]));
  const riskState = {
    enabled: state.enabled,
    halted: state.halted,
    equity: account.equity,
    dailyPnlPercent: account.dailyPnlPercent,
    drawdownPercent,
    ordersToday: state.ordersToday,
    marketOpen: clock.isOpen,
    positions: posBySymbol
  };
  const halt = checkHaltConditions(riskState, state.limits);
  if (halt.halt && !state.halted) {
    state.halted = true;
    state.haltReason = halt.detail;
    state.requiresManualRestart = halt.requiresManualRestart;
    audit("auto_halt", { reason: halt.reason, detail: halt.detail });
  }
  const results = [];
  for (const symbol of state.watchlist) {
    try {
      const technical = await fetchTechnical(symbol);
      if (!technical || technical.available === false) {
        results.push({ symbol, action: "SKIP", reason: "No technical data" });
        continue;
      }
      let decision = ensemble(technical, state.strategies, state.threshold);
      if (state.useLlm && mistralConfigured() && decision.action !== "HOLD") {
        const news = fetchNews ? await fetchNews(symbol).catch(() => []) : [];
        const review = await reviewDecision({
          symbol,
          decision,
          technical,
          news,
          position: posBySymbol[symbol] || null
        });
        decision = applyReview(decision, review);
      }
      const price = technical.price;
      const held = posBySymbol[symbol];
      let order = null, gate = null, submitted = null;
      if (decision.action === "BUY") {
        const qty = sizePosition(decision, account.equity, price, state.limits.maxPositionPercent);
        if (qty > 0) order = { symbol, side: "buy", qty, price, avgDailyVolume: technical.volume?.avg20 };
      } else if (decision.action === "SELL" && held?.qty > 0) {
        order = { symbol, side: "sell", qty: held.qty, price };
      }
      if (order) {
        gate = evaluateOrder(order, riskState, state.limits);
        if (gate.approved && !dryRun) {
          submitted = await submitOrder({
            symbol,
            side: order.side,
            qty: gate.adjustedQty,
            clientOrderId: `qb-${symbol}-${Date.now()}`
          });
          state.ordersToday++;
          riskState.ordersToday = state.ordersToday;
          audit("order_submitted", { symbol, side: order.side, qty: gate.adjustedQty, id: submitted.id });
        }
      }
      const record = {
        at: (/* @__PURE__ */ new Date()).toISOString(),
        symbol,
        action: decision.action,
        confidence: decision.confidence,
        agreement: decision.agreement,
        rationale: decision.rationale,
        signals: decision.signals,
        llm: decision.llm || null,
        vetoed: decision.vetoed || false,
        damped: decision.damped || false,
        order,
        gate,
        submitted,
        dryRun
      };
      results.push(record);
      decisions.unshift(record);
      if (decisions.length > MAX_LOG) decisions.length = MAX_LOG;
    } catch (e) {
      results.push({ symbol, action: "ERROR", error: e.message });
      audit("symbol_error", { symbol, error: e.message });
    }
  }
  state.lastRun = startedAt;
  state.lastError = null;
  return {
    ok: true,
    startedAt,
    finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
    dryRun,
    account: { equity: account.equity, cash: account.cash, dailyPnlPercent: +account.dailyPnlPercent.toFixed(3), drawdownPercent: +drawdownPercent.toFixed(3) },
    marketOpen: clock.isOpen,
    halted: state.halted,
    haltReason: state.haltReason,
    results
  };
}

// bot/indicators.js
function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}
function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}
function emaSeries(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const out = [];
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(e);
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}
function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
function macd(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return null;
  const fastE = emaSeries(closes, fast);
  const slowE = emaSeries(closes, slow);
  const offset = fastE.length - slowE.length;
  const macdLine = slowE.map((s, i) => fastE[i + offset] - s);
  const signalLine = emaSeries(macdLine, signal);
  const macdVal = macdLine[macdLine.length - 1];
  const sigVal = signalLine[signalLine.length - 1];
  return { macd: macdVal, signal: sigVal, histogram: macdVal - sigVal };
}
function bollinger(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean3 = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean3) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { middle: mean3, upper: mean3 + mult * sd, lower: mean3 - mult * sd, bandwidth: 2 * mult * sd / mean3 * 100 };
}
function stochastic(highs, lows, closes, period = 14, smooth = 3) {
  if (closes.length < period + smooth) return null;
  const kSeries = [];
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    kSeries.push(hh === ll ? 50 : (closes[i] - ll) / (hh - ll) * 100);
  }
  const k = kSeries[kSeries.length - 1];
  const d = kSeries.slice(-smooth).reduce((a, b) => a + b, 0) / smooth;
  return { k, d };
}
function atr(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}
function adx(highs, lows, closes, period = 14) {
  if (closes.length < period * 2) return null;
  const plusDM = [], minusDM = [], tr = [];
  for (let i = 1; i < closes.length; i++) {
    const up = highs[i] - highs[i - 1];
    const down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  const smooth = (arr) => arr.slice(-period).reduce((a, b) => a + b, 0);
  const atrSum = smooth(tr) || 1;
  const plusDI = smooth(plusDM) / atrSum * 100;
  const minusDI = smooth(minusDM) / atrSum * 100;
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1) * 100;
  return { adx: dx, plusDI, minusDI };
}
function pivotPoints(high, low, close) {
  const p = (high + low + close) / 3;
  return {
    pivot: p,
    r1: 2 * p - low,
    r2: p + (high - low),
    r3: high + 2 * (p - low),
    s1: 2 * p - high,
    s2: p - (high - low),
    s3: low - 2 * (high - p)
  };
}
function computeTechnical(candles, symbol = "") {
  if (!candles || candles.length < 30) {
    return { symbol, available: false, message: "Insufficient price history" };
  }
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const price = closes[closes.length - 1];
  const prevCandle = candles[candles.length - 2];
  const ma = {
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma100: sma(closes, 100),
    sma200: sma(closes, 200),
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    ema50: ema(closes, 50)
  };
  const rsi14 = rsi(closes, 14);
  const macdVal = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const stoch = stochastic(highs, lows, closes, 14, 3);
  const atr14 = atr(highs, lows, closes, 14);
  const adxVal = adx(highs, lows, closes, 14);
  const cci = (() => {
    const period = 20;
    if (closes.length < period) return null;
    const tp = candles.slice(-period).map((c) => (c.high + c.low + c.close) / 3);
    const mean3 = tp.reduce((a, b) => a + b, 0) / period;
    const meanDev = tp.reduce((a, b) => a + Math.abs(b - mean3), 0) / period;
    const currentTP = tp[tp.length - 1];
    return meanDev ? (currentTP - mean3) / (0.015 * meanDev) : 0;
  })();
  const williamsR = (() => {
    const period = 14;
    if (closes.length < period) return null;
    const hh = Math.max(...highs.slice(-period));
    const ll = Math.min(...lows.slice(-period));
    return hh === ll ? -50 : (hh - price) / (hh - ll) * -100;
  })();
  const week52High = Math.max(...highs);
  const week52Low = Math.min(...lows);
  const rangePosition = week52High === week52Low ? 50 : (price - week52Low) / (week52High - week52Low) * 100;
  const avgVol20 = sma(volumes, 20);
  const volumeRatio = avgVol20 ? volumes[volumes.length - 1] / avgVol20 : null;
  const pivots = prevCandle ? pivotPoints(prevCandle.high, prevCandle.low, prevCandle.close) : null;
  const signals = [];
  const vote = (name, value, signal) => signals.push({ name, value, signal });
  if (rsi14 != null) vote("RSI (14)", +rsi14.toFixed(2), rsi14 > 70 ? "sell" : rsi14 < 30 ? "buy" : "neutral");
  if (macdVal) vote("MACD (12,26,9)", +macdVal.histogram.toFixed(3), macdVal.histogram > 0 ? "buy" : macdVal.histogram < 0 ? "sell" : "neutral");
  if (stoch) vote("Stochastic (14,3)", +stoch.k.toFixed(2), stoch.k > 80 ? "sell" : stoch.k < 20 ? "buy" : "neutral");
  if (cci != null) vote("CCI (20)", +cci.toFixed(2), cci > 100 ? "sell" : cci < -100 ? "buy" : "neutral");
  if (williamsR != null) vote("Williams %R", +williamsR.toFixed(2), williamsR > -20 ? "sell" : williamsR < -80 ? "buy" : "neutral");
  if (adxVal) vote("ADX (14)", +adxVal.adx.toFixed(2), adxVal.adx > 25 ? adxVal.plusDI > adxVal.minusDI ? "buy" : "sell" : "neutral");
  if (ma.sma20 != null) vote("SMA 20", +ma.sma20.toFixed(2), price > ma.sma20 ? "buy" : "sell");
  if (ma.sma50 != null) vote("SMA 50", +ma.sma50.toFixed(2), price > ma.sma50 ? "buy" : "sell");
  if (ma.sma200 != null) vote("SMA 200", +ma.sma200.toFixed(2), price > ma.sma200 ? "buy" : "sell");
  if (ma.ema12 != null) vote("EMA 12", +ma.ema12.toFixed(2), price > ma.ema12 ? "buy" : "sell");
  if (ma.ema26 != null) vote("EMA 26", +ma.ema26.toFixed(2), price > ma.ema26 ? "buy" : "sell");
  if (bb) vote("Bollinger Bands", +bb.middle.toFixed(2), price > bb.upper ? "sell" : price < bb.lower ? "buy" : "neutral");
  const buyCount = signals.filter((s) => s.signal === "buy").length;
  const sellCount = signals.filter((s) => s.signal === "sell").length;
  const neutralCount = signals.filter((s) => s.signal === "neutral").length;
  const score = buyCount - sellCount;
  let overall = "NEUTRAL";
  if (score >= 6) overall = "STRONG BUY";
  else if (score >= 2) overall = "BUY";
  else if (score <= -6) overall = "STRONG SELL";
  else if (score <= -2) overall = "SELL";
  let maCross = null;
  if (ma.sma50 != null && ma.sma200 != null) {
    maCross = ma.sma50 > ma.sma200 ? "Golden Cross (bullish)" : "Death Cross (bearish)";
  }
  const result = {
    symbol,
    available: true,
    price: +price.toFixed(2),
    summary: { overall, buy: buyCount, sell: sellCount, neutral: neutralCount, score },
    movingAverages: {
      sma20: ma.sma20 && +ma.sma20.toFixed(2),
      sma50: ma.sma50 && +ma.sma50.toFixed(2),
      sma100: ma.sma100 && +ma.sma100.toFixed(2),
      sma200: ma.sma200 && +ma.sma200.toFixed(2),
      ema12: ma.ema12 && +ma.ema12.toFixed(2),
      ema26: ma.ema26 && +ma.ema26.toFixed(2),
      ema50: ma.ema50 && +ma.ema50.toFixed(2),
      cross: maCross
    },
    oscillators: {
      rsi14: rsi14 && +rsi14.toFixed(2),
      macd: macdVal && { macd: +macdVal.macd.toFixed(3), signal: +macdVal.signal.toFixed(3), histogram: +macdVal.histogram.toFixed(3) },
      stochastic: stoch && { k: +stoch.k.toFixed(2), d: +stoch.d.toFixed(2) },
      cci20: cci != null ? +cci.toFixed(2) : null,
      williamsR: williamsR != null ? +williamsR.toFixed(2) : null,
      atr14: atr14 && +atr14.toFixed(2),
      adx: adxVal && { adx: +adxVal.adx.toFixed(2), plusDI: +adxVal.plusDI.toFixed(2), minusDI: +adxVal.minusDI.toFixed(2) }
    },
    bollinger: bb && { upper: +bb.upper.toFixed(2), middle: +bb.middle.toFixed(2), lower: +bb.lower.toFixed(2), bandwidth: +bb.bandwidth.toFixed(2) },
    range52w: { high: +week52High.toFixed(2), low: +week52Low.toFixed(2), position: +rangePosition.toFixed(1) },
    volume: { latest: volumes[volumes.length - 1], avg20: avgVol20 && Math.round(avgVol20), ratio: volumeRatio && +volumeRatio.toFixed(2) },
    pivots: pivots && Object.fromEntries(Object.entries(pivots).map(([k, v]) => [k, +v.toFixed(2)])),
    signals,
    candleCount: candles.length
  };
  return result;
}

// bot/statistics.js
var EULER_MASCHERONI = 0.5772156649015329;
var mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
function stdev(a, sample = true) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - (sample ? 1 : 0)));
}
function skewness(a) {
  const n = a.length;
  if (n < 3) return 0;
  const m = mean(a), sd = stdev(a, false);
  if (!sd) return 0;
  return a.reduce((s, v) => s + ((v - m) / sd) ** 3, 0) / n;
}
function kurtosis(a) {
  const n = a.length;
  if (n < 4) return 3;
  const m = mean(a), sd = stdev(a, false);
  if (!sd) return 3;
  return a.reduce((s, v) => s + ((v - m) / sd) ** 4, 0) / n;
}
function invNorm(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q2 = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q2 + c[1]) * q2 + c[2]) * q2 + c[3]) * q2 + c[4]) * q2 + c[5]) / ((((d[0] * q2 + d[1]) * q2 + d[2]) * q2 + d[3]) * q2 + 1);
  }
  if (p > 1 - pl) {
    const q2 = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q2 + c[1]) * q2 + c[2]) * q2 + c[3]) * q2 + c[4]) * q2 + c[5]) / ((((d[0] * q2 + d[1]) * q2 + d[2]) * q2 + d[3]) * q2 + 1);
  }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
function sharpe(returns, rf = 0) {
  if (returns.length < 2) return 0;
  const sd = stdev(returns);
  return sd ? (mean(returns) - rf) / sd : 0;
}
function sortino(returns, rf = 0) {
  if (returns.length < 2) return 0;
  const downside = returns.filter((r) => r < rf).map((r) => (r - rf) ** 2);
  if (!downside.length) return Infinity;
  const dd = Math.sqrt(downside.reduce((a, b) => a + b, 0) / returns.length);
  return dd ? (mean(returns) - rf) / dd : 0;
}
function maxDrawdown(equity) {
  let peak = -Infinity, maxDd = 0, peakIdx = 0, troughIdx = 0, curPeak = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) {
      peak = equity[i];
      curPeak = i;
    }
    const dd = peak > 0 ? (peak - equity[i]) / peak : 0;
    if (dd > maxDd) {
      maxDd = dd;
      peakIdx = curPeak;
      troughIdx = i;
    }
  }
  return { maxDrawdown: maxDd, peakIndex: peakIdx, troughIndex: troughIdx };
}
function probabilisticSharpe(observedSR, benchmarkSR, n, skew, kurt) {
  if (n < 2) return null;
  const denom = 1 - skew * observedSR + (kurt - 1) / 4 * observedSR * observedSR;
  if (denom <= 0) return null;
  return normCdf((observedSR - benchmarkSR) * Math.sqrt(n - 1) / Math.sqrt(denom));
}
function expectedMaxSharpe(nTrials, sharpeVariance) {
  if (nTrials < 2) return 0;
  const sd = Math.sqrt(Math.max(sharpeVariance, 0));
  if (!sd) return 0;
  const a = invNorm(1 - 1 / nTrials);
  const b = invNorm(1 - 1 / (nTrials * Math.E));
  return sd * ((1 - EULER_MASCHERONI) * a + EULER_MASCHERONI * b);
}
function deflatedSharpe(returns, nTrials, sharpeVariance = null) {
  if (returns.length < 4) return null;
  const sr = sharpe(returns);
  const sk = skewness(returns);
  const ku = kurtosis(returns);
  const variance = sharpeVariance != null ? sharpeVariance : (1 + 0.5 * sr * sr) / (returns.length - 1);
  const sr0 = expectedMaxSharpe(nTrials, variance);
  const dsr = probabilisticSharpe(sr, sr0, returns.length, sk, ku);
  return { sharpe: sr, expectedMaxSharpe: sr0, deflatedSharpe: dsr, skew: sk, kurtosis: ku, nTrials };
}
function probabilityOfBacktestOverfitting(returnsMatrix, blocks = 8) {
  const nStrat = returnsMatrix.length;
  if (nStrat < 2) return null;
  const T = Math.min(...returnsMatrix.map((r) => r.length));
  if (T < blocks * 2) return null;
  const S = blocks % 2 === 0 ? blocks : blocks - 1;
  const blockSize = Math.floor(T / S);
  const blockIdx = Array.from({ length: S }, (_, i) => i);
  const combos = [];
  const choose = (start, acc) => {
    if (acc.length === S / 2) {
      combos.push([...acc]);
      return;
    }
    for (let i = start; i < S; i++) {
      acc.push(i);
      choose(i + 1, acc);
      acc.pop();
    }
  };
  choose(0, []);
  const sliceBlocks = (row, blocksWanted) => {
    const out = [];
    for (const b of blocksWanted) {
      out.push(...row.slice(b * blockSize, (b + 1) * blockSize));
    }
    return out;
  };
  let overfitCount = 0;
  const logits = [];
  for (const inSample of combos) {
    const outSample = blockIdx.filter((b) => !inSample.includes(b));
    const isSharpes = returnsMatrix.map((r) => sharpe(sliceBlocks(r, inSample)));
    const oosSharpes = returnsMatrix.map((r) => sharpe(sliceBlocks(r, outSample)));
    let best = 0;
    for (let i = 1; i < nStrat; i++) if (isSharpes[i] > isSharpes[best]) best = i;
    const rank = oosSharpes.filter((s) => s <= oosSharpes[best]).length;
    const relRank = rank / (nStrat + 1);
    const w = Math.min(Math.max(relRank, 1e-6), 1 - 1e-6);
    logits.push(Math.log(w / (1 - w)));
    if (relRank <= 0.5) overfitCount++;
  }
  return {
    pbo: overfitCount / combos.length,
    splits: combos.length,
    medianLogit: logits.sort((a, b) => a - b)[Math.floor(logits.length / 2)]
  };
}
function summarise(equityCurve, periodReturns, periodsPerYear = 252, rfAnnual = 0.045) {
  const n = periodReturns.length;
  if (!n || equityCurve.length < 2) return null;
  const start = equityCurve[0], end = equityCurve[equityCurve.length - 1];
  const years = n / periodsPerYear;
  const totalReturn = (end - start) / start;
  const cagr = years > 0 && start > 0 ? Math.pow(end / start, 1 / years) - 1 : 0;
  const rfPeriod = rfAnnual / periodsPerYear;
  const sr = sharpe(periodReturns, rfPeriod);
  const so = sortino(periodReturns, rfPeriod);
  const dd = maxDrawdown(equityCurve);
  const vol = stdev(periodReturns) * Math.sqrt(periodsPerYear);
  const wins = periodReturns.filter((r) => r > 0);
  const losses = periodReturns.filter((r) => r < 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  return {
    totalReturn: +(totalReturn * 100).toFixed(2),
    cagr: +(cagr * 100).toFixed(2),
    volatility: +(vol * 100).toFixed(2),
    // Annualise Sharpe/Sortino from per-period values.
    sharpe: +(sr * Math.sqrt(periodsPerYear)).toFixed(3),
    sortino: Number.isFinite(so) ? +(so * Math.sqrt(periodsPerYear)).toFixed(3) : null,
    maxDrawdown: +(dd.maxDrawdown * 100).toFixed(2),
    // Return earned per unit of worst-case pain.
    calmar: dd.maxDrawdown > 0 ? +(cagr / dd.maxDrawdown).toFixed(3) : null,
    winRate: +(wins.length / n * 100).toFixed(1),
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(3) : null,
    periods: n,
    years: +years.toFixed(2)
  };
}

// bot/backtest.js
var DEFAULT_COSTS = {
  commissionPerShare: 5e-3,
  // typical retail per-share commission
  commissionMinimum: 1,
  slippageBps: 5,
  // 5 basis points of adverse price movement
  spreadBps: 2
  // half-spread paid on entry and exit
};
function fillPrice(price, side, costs) {
  const adverse = (costs.slippageBps + costs.spreadBps) / 1e4;
  return side === "buy" ? price * (1 + adverse) : price * (1 - adverse);
}
function commission(shares, costs) {
  return Math.max(shares * costs.commissionPerShare, costs.commissionMinimum);
}
function runBacktest(candles, options = {}) {
  const {
    symbol = "",
    strategies = Object.keys(STRATEGIES),
    threshold = 0.15,
    initialCapital = 1e5,
    maxPositionPercent = 20,
    costs = DEFAULT_COSTS,
    warmup = 200,
    periodsPerYear = 252,
    rfAnnual = 0.045
  } = options;
  if (!candles || candles.length < warmup + 20) {
    return { available: false, message: `Need at least ${warmup + 20} bars, got ${candles?.length || 0}` };
  }
  let cash = initialCapital;
  let shares = 0;
  const equityCurve = [];
  const trades = [];
  const decisions2 = [];
  let totalCommission = 0, totalSlippage = 0;
  for (let t = warmup; t < candles.length; t++) {
    const visible = candles.slice(0, t + 1);
    const bar = candles[t];
    const ta = computeTechnical(visible, symbol);
    const decision = ta.available ? ensemble(ta, strategies, threshold) : { action: "HOLD", confidence: 0, signals: [] };
    const nextBar = candles[t + 1];
    if (nextBar) {
      const equityNow = cash + shares * bar.close;
      if (decision.action === "BUY" && shares === 0) {
        const qty = sizePosition(decision, equityNow, nextBar.open, maxPositionPercent);
        if (qty > 0) {
          const px = fillPrice(nextBar.open, "buy", costs);
          const comm = commission(qty, costs);
          const cost = qty * px + comm;
          if (cost <= cash) {
            const slip = qty * (px - nextBar.open);
            cash -= cost;
            shares += qty;
            totalCommission += comm;
            totalSlippage += slip;
            trades.push({
              time: nextBar.time,
              side: "buy",
              qty,
              price: +px.toFixed(4),
              reference: nextBar.open,
              commission: +comm.toFixed(2),
              slippage: +slip.toFixed(2),
              confidence: decision.confidence,
              rationale: decision.rationale
            });
          }
        }
      } else if (decision.action === "SELL" && shares > 0) {
        const px = fillPrice(nextBar.open, "sell", costs);
        const comm = commission(shares, costs);
        const slip = shares * (nextBar.open - px);
        cash += shares * px - comm;
        totalCommission += comm;
        totalSlippage += slip;
        trades.push({
          time: nextBar.time,
          side: "sell",
          qty: shares,
          price: +px.toFixed(4),
          reference: nextBar.open,
          commission: +comm.toFixed(2),
          slippage: +slip.toFixed(2),
          confidence: decision.confidence,
          rationale: decision.rationale
        });
        shares = 0;
      }
    }
    equityCurve.push(cash + shares * bar.close);
    decisions2.push({ time: bar.time, action: decision.action, confidence: decision.confidence });
  }
  const last = candles[candles.length - 1];
  const finalEquity = cash + shares * last.close;
  const periodReturns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    periodReturns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }
  const stats = summarise(equityCurve, periodReturns, periodsPerYear, rfAnnual);
  const bhStart = candles[warmup];
  const bhEntry = fillPrice(bhStart.close, "buy", costs);
  const bhShares = Math.floor(initialCapital / bhEntry);
  const bhCash = initialCapital - bhShares * bhEntry - commission(bhShares, costs);
  const bhCurve = candles.slice(warmup).map((c) => bhCash + bhShares * c.close);
  const bhReturns = [];
  for (let i = 1; i < bhCurve.length; i++) {
    bhReturns.push((bhCurve[i] - bhCurve[i - 1]) / bhCurve[i - 1]);
  }
  const bhStats = summarise(bhCurve, bhReturns, periodsPerYear, rfAnnual);
  return {
    available: true,
    symbol,
    config: { strategies, threshold, initialCapital, maxPositionPercent, costs, warmup },
    bars: equityCurve.length,
    from: candles[warmup]?.time,
    to: last.time,
    finalEquity: +finalEquity.toFixed(2),
    stats,
    benchmark: bhStats,
    // The number that decides whether the strategy was worth running at all.
    excessReturn: stats && bhStats ? +(stats.totalReturn - bhStats.totalReturn).toFixed(2) : null,
    beatBenchmark: stats && bhStats ? stats.totalReturn > bhStats.totalReturn : null,
    trades: trades.length,
    tradeLog: trades.slice(-40),
    costs: {
      totalCommission: +totalCommission.toFixed(2),
      totalSlippage: +totalSlippage.toFixed(2),
      totalCost: +(totalCommission + totalSlippage).toFixed(2),
      // Costs as a share of starting capital — the drag a frictionless
      // backtest would have hidden entirely.
      costDragPercent: +((totalCommission + totalSlippage) / initialCapital * 100).toFixed(2)
    },
    equityCurve: equityCurve.map((v, i) => ({
      time: candles[warmup + i].time,
      equity: +v.toFixed(2),
      benchmark: bhCurve[i] != null ? +bhCurve[i].toFixed(2) : null
    })),
    periodReturns
  };
}
function walkForward(candles, options = {}) {
  const { folds = 4, warmup = 200, ...rest } = options;
  const usable = candles.length - warmup;
  if (usable < folds * 60) {
    return { available: false, message: `Need ~${folds * 60 + warmup} bars for ${folds} folds` };
  }
  const foldSize = Math.floor(usable / folds);
  const results = [];
  for (let f = 0; f < folds; f++) {
    const end = warmup + foldSize * (f + 1);
    const start = warmup + foldSize * f;
    const slice = candles.slice(0, end);
    const r = runBacktest(slice, { ...rest, warmup: start });
    if (r.available) {
      results.push({
        fold: f + 1,
        from: candles[start]?.time,
        to: candles[end - 1]?.time,
        totalReturn: r.stats?.totalReturn ?? null,
        sharpe: r.stats?.sharpe ?? null,
        maxDrawdown: r.stats?.maxDrawdown ?? null,
        benchmarkReturn: r.benchmark?.totalReturn ?? null,
        beatBenchmark: r.beatBenchmark,
        trades: r.trades
      });
    }
  }
  if (!results.length) return { available: false, message: "No fold produced a result" };
  const rets = results.map((r) => r.totalReturn).filter((v) => v != null);
  const beats = results.filter((r) => r.beatBenchmark).length;
  return {
    available: true,
    folds: results,
    consistency: {
      foldsBeatingBenchmark: beats,
      totalFolds: results.length,
      // Persistence across folds is the point. A strategy that wins once and
      // loses three times has not shown anything.
      beatRate: +(beats / results.length * 100).toFixed(1),
      meanReturn: rets.length ? +(rets.reduce((a, b) => a + b, 0) / rets.length).toFixed(2) : null,
      returnStdev: rets.length > 1 ? +stdev(rets).toFixed(2) : null,
      worstFold: rets.length ? +Math.min(...rets).toFixed(2) : null,
      bestFold: rets.length ? +Math.max(...rets).toFixed(2) : null
    }
  };
}
function sweepStrategies(candles, options = {}) {
  const { thresholds = [0.1, 0.15, 0.25], ...rest } = options;
  const keys = Object.keys(STRATEGIES);
  const combos = [
    ...keys.map((k) => [k]),
    ["trend", "consensus"],
    ["rsi", "bollinger"],
    ["trend", "macd"],
    keys
  ];
  const variants = [];
  for (const strategies of combos) {
    for (const threshold of thresholds) {
      const r = runBacktest(candles, { ...rest, strategies, threshold });
      if (r.available && r.stats) {
        variants.push({
          strategies,
          threshold,
          totalReturn: r.stats.totalReturn,
          sharpe: r.stats.sharpe,
          maxDrawdown: r.stats.maxDrawdown,
          trades: r.trades,
          beatBenchmark: r.beatBenchmark,
          periodReturns: r.periodReturns
        });
      }
    }
  }
  if (!variants.length) return { available: false, message: "No variant produced a result" };
  const ranked = [...variants].sort((a, b) => b.sharpe - a.sharpe);
  const best = ranked[0];
  const sharpes = variants.map((v) => v.sharpe);
  const sharpeVar = sharpes.length > 1 ? Math.pow(stdev(sharpes), 2) : 0;
  const perPeriod = best.periodReturns;
  const dsr = deflatedSharpe(
    perPeriod,
    variants.length,
    sharpeVar / (options.periodsPerYear || 252)
  );
  const pbo = probabilityOfBacktestOverfitting(
    variants.map((v) => v.periodReturns),
    6
  );
  return {
    available: true,
    trials: variants.length,
    best: {
      strategies: best.strategies,
      threshold: best.threshold,
      totalReturn: best.totalReturn,
      sharpe: best.sharpe,
      maxDrawdown: best.maxDrawdown,
      trades: best.trades,
      beatBenchmark: best.beatBenchmark
    },
    ranking: ranked.slice(0, 10).map(({ periodReturns, ...v }) => v),
    overfitting: {
      deflatedSharpe: dsr?.deflatedSharpe ?? null,
      expectedMaxSharpeByLuck: dsr?.expectedMaxSharpe ?? null,
      pbo: pbo?.pbo ?? null,
      pboSplits: pbo?.splits ?? null,
      // Plain-language verdict, because the numbers are easy to misread.
      verdict: verdictFor(dsr?.deflatedSharpe, pbo?.pbo)
    }
  };
}
function verdictFor(dsr, pbo) {
  if (dsr == null && pbo == null) return "Not enough data to judge.";
  if (dsr != null && dsr < 0.9) {
    return "Not distinguishable from luck \u2014 the best variant is about what you would expect from trying this many.";
  }
  if (pbo != null && pbo > 0.5) {
    return "High overfitting risk \u2014 the in-sample winner usually underperforms out of sample.";
  }
  if (dsr != null && dsr >= 0.95 && (pbo == null || pbo < 0.3)) {
    return "Survives deflation and shows low overfitting risk. Still needs forward testing.";
  }
  return "Mixed evidence \u2014 treat with caution and forward test before trusting it.";
}

// bot/features.js
var FEATURE_NAMES = [
  "ret1",
  "ret5",
  "ret10",
  // momentum over 1/5/10 bars
  "rsi",
  // RSI(14) scaled to [0,1]
  "macdHist",
  // MACD histogram / price
  "priceVsSma20",
  // close/SMA20 - 1
  "priceVsSma50",
  // close/SMA50 - 1
  "priceVsSma200",
  // close/SMA200 - 1 (long-term regime)
  "bbPosition",
  // position within Bollinger band [0,1]
  "adx",
  // trend strength / 100
  "atrPct",
  // ATR(14) / price
  "volumeRatio",
  // volume / 20-bar avg
  "volatility",
  // stdev of last 20 returns
  "roc20",
  // 20-bar rate of change
  "distFrom120High",
  // distance below the 120-bar high (<= 0)
  "distFrom120Low",
  // distance above the 120-bar low (>= 0)
  "sma20Slope",
  // 5-bar slope of SMA20 / price
  "rsiSlope",
  // change in RSI over 5 bars
  "volRegime"
  // short vol / long vol (expansion > 1)
];
var pctReturn = (a, b) => a && b ? (a - b) / b : 0;
function stdev20(returns) {
  if (returns.length < 2) return 0;
  const m = returns.reduce((s, v) => s + v, 0) / returns.length;
  return Math.sqrt(returns.reduce((s, v) => s + (v - m) ** 2, 0) / returns.length);
}
function featuresAt(candles, t) {
  if (t < 50) return null;
  const window = candles.slice(0, t + 1);
  const closes = window.map((c) => c.close);
  const highs = window.map((c) => c.high);
  const lows = window.map((c) => c.low);
  const vols = window.map((c) => c.volume || 0);
  const price = closes[closes.length - 1];
  if (!price) return null;
  const bb = bollinger(closes, 20, 2);
  const md = macd(closes);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const adxv = adx(highs, lows, closes, 14);
  const atrv = atr(highs, lows, closes, 14);
  const rsiv = rsi(closes, 14);
  const avgVol = sma(vols, 20);
  const returnsFrom = (fromIdx) => {
    const out = [];
    for (let i = fromIdx; i < closes.length; i++) {
      if (i > 0 && closes[i - 1]) out.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    return out;
  };
  const recentReturns = returnsFrom(closes.length - 20);
  const lookback = Math.min(120, highs.length);
  const hi120 = Math.max(...highs.slice(-lookback));
  const lo120 = Math.min(...lows.slice(-lookback));
  const sma20Prev = sma(closes.slice(0, closes.length - 5), 20);
  const sma20Slope = sma20 != null && sma20Prev != null ? (sma20 - sma20Prev) / price : 0;
  const rsiPrev = rsi(closes.slice(0, closes.length - 5), 14);
  const rsiSlope = rsiv != null && rsiPrev != null ? (rsiv - rsiPrev) / 100 : 0;
  const shortVol = stdev20(returnsFrom(closes.length - 10));
  const longVol = stdev20(returnsFrom(closes.length - 40));
  const volRegime = longVol > 0 ? shortVol / longVol : 1;
  const vec = [
    pctReturn(price, closes[closes.length - 2]),
    pctReturn(price, closes[closes.length - 6]),
    pctReturn(price, closes[closes.length - 11]),
    rsiv != null ? rsiv / 100 : 0.5,
    md ? md.histogram / price : 0,
    sma20 ? price / sma20 - 1 : 0,
    sma50 ? price / sma50 - 1 : 0,
    sma200 ? price / sma200 - 1 : 0,
    bb && bb.upper !== bb.lower ? (price - bb.lower) / (bb.upper - bb.lower) : 0.5,
    adxv ? adxv.adx / 100 : 0,
    atrv ? atrv / price : 0,
    avgVol ? (vols[vols.length - 1] || 0) / avgVol : 1,
    stdev20(recentReturns),
    pctReturn(price, closes[closes.length - 21]),
    hi120 > 0 ? (price - hi120) / hi120 : 0,
    lo120 > 0 ? (price - lo120) / lo120 : 0,
    sma20Slope,
    rsiSlope,
    volRegime
  ];
  return vec.map((v) => Number.isFinite(v) ? v : 0);
}
function tripleBarrierLabel(candles, t, { up = 0.03, down = 0.02, horizon = 10 } = {}) {
  const entry = candles[t]?.close;
  if (!entry) return null;
  if (t + horizon >= candles.length) return null;
  const upBarrier = entry * (1 + up);
  const downBarrier = entry * (1 - down);
  for (let i = t + 1; i <= t + horizon; i++) {
    const bar = candles[i];
    if (!bar) break;
    if (bar.low <= downBarrier) return 0;
    if (bar.high >= upBarrier) return 1;
  }
  const exit = candles[t + horizon].close;
  return exit > entry ? 1 : 0;
}
function buildDataset(candles, labelConfig = {}) {
  const X = [], y = [], times = [];
  const warmup = 200;
  const horizon = labelConfig.horizon || 10;
  for (let t = warmup; t < candles.length - horizon; t++) {
    const feat = featuresAt(candles, t);
    const label = tripleBarrierLabel(candles, t, labelConfig);
    if (feat && label != null) {
      X.push(feat);
      y.push(label);
      times.push(candles[t].time);
    }
  }
  return { X, y, times, featureNames: FEATURE_NAMES };
}
function temporalSplit(dataset, testFraction = 0.3) {
  const n = dataset.X.length;
  const cut = Math.floor(n * (1 - testFraction));
  return {
    train: { X: dataset.X.slice(0, cut), y: dataset.y.slice(0, cut) },
    test: { X: dataset.X.slice(cut), y: dataset.y.slice(cut), times: dataset.times.slice(cut) },
    featureNames: dataset.featureNames,
    splitIndex: cut
  };
}

// bot/gbm.js
var sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
function buildTree(X, residuals, indices, depth, maxDepth, minLeaf) {
  const leafValue = () => {
    let s = 0;
    for (const i of indices) s += residuals[i];
    return s / indices.length;
  };
  if (depth >= maxDepth || indices.length < 2 * minLeaf) {
    return { leaf: true, value: leafValue() };
  }
  const nFeatures = X[0].length;
  let best = null;
  for (let f = 0; f < nFeatures; f++) {
    const vals = indices.map((i) => X[i][f]).sort((a, b) => a - b);
    for (let t = minLeaf; t < vals.length - minLeaf; t++) {
      if (vals[t] === vals[t - 1]) continue;
      const thr = (vals[t] + vals[t - 1]) / 2;
      let lSum = 0, lCount = 0, rSum = 0, rCount = 0;
      for (const i of indices) {
        if (X[i][f] <= thr) {
          lSum += residuals[i];
          lCount++;
        } else {
          rSum += residuals[i];
          rCount++;
        }
      }
      if (lCount < minLeaf || rCount < minLeaf) continue;
      const gain = lSum * lSum / lCount + rSum * rSum / rCount;
      if (!best || gain > best.gain) best = { feature: f, threshold: thr, gain };
    }
  }
  if (!best) return { leaf: true, value: leafValue() };
  const left = [], right = [];
  for (const i of indices) (X[i][best.feature] <= best.threshold ? left : right).push(i);
  return {
    leaf: false,
    feature: best.feature,
    threshold: best.threshold,
    left: buildTree(X, residuals, left, depth + 1, maxDepth, minLeaf),
    right: buildTree(X, residuals, right, depth + 1, maxDepth, minLeaf)
  };
}
function predictTree(node, row) {
  while (!node.leaf) node = row[node.feature] <= node.threshold ? node.left : node.right;
  return node.value;
}
function trainGBM(X, y, opts = {}) {
  const {
    nEstimators = 60,
    maxDepth = 3,
    learningRate = 0.1,
    minLeaf = 10,
    featureNames = []
  } = opts;
  if (!X.length || X.length !== y.length) return null;
  const n = X.length;
  const posRate = y.reduce((a, b) => a + b, 0) / n;
  const p0 = Math.min(Math.max(posRate, 1e-3), 1 - 1e-3);
  const baseScore = Math.log(p0 / (1 - p0));
  const F = new Array(n).fill(baseScore);
  const trees = [];
  const allIdx = Array.from({ length: n }, (_, i) => i);
  for (let m = 0; m < nEstimators; m++) {
    const residuals = F.map((f, i) => y[i] - sigmoid(f));
    const tree = buildTree(X, residuals, allIdx, 0, maxDepth, minLeaf);
    trees.push(tree);
    for (let i = 0; i < n; i++) F[i] += learningRate * predictTree(tree, X[i]);
  }
  return {
    type: "gbm",
    baseScore: +baseScore.toFixed(6),
    learningRate,
    nEstimators,
    maxDepth,
    trees,
    featureNames,
    trainedOn: n
  };
}
function predictProbaGBM(model2, row) {
  let F = model2.baseScore;
  for (const tree of model2.trees) F += model2.learningRate * predictTree(tree, row);
  return sigmoid(F);
}
function featureImportance(model2) {
  const k = model2.featureNames.length || 0;
  const imp = new Array(k).fill(0);
  const walk = (node) => {
    if (node.leaf) return;
    imp[node.feature] += 1;
    walk(node.left);
    walk(node.right);
  };
  for (const t of model2.trees) walk(t);
  const total = imp.reduce((a, b) => a + b, 0) || 1;
  return model2.featureNames.map((name, i) => ({ name, importance: +(imp[i] / total).toFixed(4) })).sort((a, b) => b.importance - a.importance);
}

// bot/model.js
var sigmoid2 = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
function fitScaler(X) {
  const k = X[0].length, n = X.length;
  const means = new Array(k).fill(0), stds = new Array(k).fill(0);
  for (const row of X) for (let j = 0; j < k; j++) means[j] += row[j];
  for (let j = 0; j < k; j++) means[j] /= n;
  for (const row of X) for (let j = 0; j < k; j++) stds[j] += (row[j] - means[j]) ** 2;
  for (let j = 0; j < k; j++) stds[j] = Math.sqrt(stds[j] / n) || 1;
  return { means, stds };
}
var scaleRow = (row, s) => row.map((v, j) => (v - s.means[j]) / s.stds[j]);
function trainLogistic(X, y, opts = {}) {
  const { epochs = 400, lr = 0.1, l2 = 0.01, featureNames = FEATURE_NAMES } = opts;
  if (!X.length || X.length !== y.length) return null;
  const k = X[0].length, n = X.length;
  const scaler = fitScaler(X);
  const Xs = X.map((r) => scaleRow(r, scaler));
  let w = new Array(k).fill(0), b = 0;
  const history = [];
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(k).fill(0);
    let gb = 0, loss = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid2(Xs[i].reduce((s, v, j) => s + v * w[j], b));
      const err = p - y[i];
      for (let j = 0; j < k; j++) gw[j] += err * Xs[i][j];
      gb += err;
      const eps = 1e-9;
      loss += -(y[i] * Math.log(p + eps) + (1 - y[i]) * Math.log(1 - p + eps));
    }
    for (let j = 0; j < k; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
    b -= lr * (gb / n);
    if (e % 50 === 0 || e === epochs - 1) history.push(+(loss / n).toFixed(5));
  }
  return {
    type: "logistic",
    weights: w.map((v) => +v.toFixed(6)),
    bias: +b.toFixed(6),
    scaler: {
      means: scaler.means.map((v) => +v.toFixed(6)),
      stds: scaler.stds.map((v) => +v.toFixed(6))
    },
    featureNames,
    lossHistory: history,
    trainedOn: n
  };
}
function predictProba(model2, featureRow) {
  if (model2.type === "gbm") return predictProbaGBM(model2, featureRow);
  const s = model2.scaler;
  const z = featureRow.reduce((acc, v, j) => acc + (v - s.means[j]) / s.stds[j] * model2.weights[j], model2.bias);
  return sigmoid2(z);
}
function evaluate(model2, X, y) {
  if (!X.length) return null;
  let correct = 0, tp = 0, fp = 0, fn = 0, tn = 0;
  const probs = [];
  for (let i = 0; i < X.length; i++) {
    const p = predictProba(model2, X[i]);
    probs.push(p);
    const pred = p >= 0.5 ? 1 : 0;
    if (pred === y[i]) correct++;
    if (pred === 1 && y[i] === 1) tp++;
    else if (pred === 1 && y[i] === 0) fp++;
    else if (pred === 0 && y[i] === 1) fn++;
    else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const auc = rankAuc(probs, y);
  return {
    accuracy: +(correct / X.length).toFixed(4),
    precision: +precision.toFixed(4),
    recall: +recall.toFixed(4),
    f1: precision + recall ? +(2 * precision * recall / (precision + recall)).toFixed(4) : 0,
    auc: auc != null ? +auc.toFixed(4) : null,
    n: X.length,
    positiveRate: +(y.reduce((a, b) => a + b, 0) / y.length).toFixed(4)
  };
}
function rankAuc(scores, labels) {
  const pos = [], neg = [];
  scores.forEach((s, i) => (labels[i] === 1 ? pos : neg).push(s));
  if (!pos.length || !neg.length) return null;
  const idx = scores.map((s, i) => ({ s, y: labels[i] })).sort((a, b) => a.s - b.s);
  let rankSum = 0;
  idx.forEach((o, i) => {
    if (o.y === 1) rankSum += i + 1;
  });
  return (rankSum - pos.length * (pos.length + 1) / 2) / (pos.length * neg.length);
}
function modelStrategy(model2, candles, t, { buyThreshold = 0.55, sellThreshold = 0.45 } = {}) {
  const feat = featuresAt(candles, t);
  if (!feat) return { action: "HOLD", confidence: 0, rationale: "Insufficient history" };
  const p = predictProba(model2, feat);
  if (p >= buyThreshold) return { action: "BUY", confidence: +((p - 0.5) * 2).toFixed(3), rationale: `Model P(up)=${p.toFixed(2)}` };
  if (p <= sellThreshold) return { action: "SELL", confidence: +((0.5 - p) * 2).toFixed(3), rationale: `Model P(up)=${p.toFixed(2)}` };
  return { action: "HOLD", confidence: 0, rationale: `Model P(up)=${p.toFixed(2)} \u2014 near coin flip` };
}

// bot/persistence.js
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var DIR = process.env.MODEL_STORE_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", ".models");
var FILE = join(DIR, "registry.json");
var writable = true;
function loadStore() {
  try {
    if (!existsSync(FILE)) return { trained: [], published: [] };
    const data = JSON.parse(readFileSync(FILE, "utf8"));
    return {
      trained: Array.isArray(data.trained) ? data.trained : [],
      published: Array.isArray(data.published) ? data.published : []
    };
  } catch {
    return { trained: [], published: [] };
  }
}
function persist(store) {
  if (!writable) return false;
  try {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
    const payload = {
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      trained: (store.trained || []).slice(0, 50),
      published: store.published || []
    };
    writeFileSync(FILE, JSON.stringify(payload), "utf8");
    return true;
  } catch {
    writable = false;
    return false;
  }
}

// bot/model-registry.js
var MODEL_TYPES = ["logistic", "gbm"];
var PUBLISH_GATE = {
  minTestAuc: 0.55,
  // better than a coin flip at telling up from down
  minOutOfSampleSharpe: 0.5,
  // risk-adjusted, on unseen data
  minDeflatedSharpe: 0.9,
  // survives adjustment for how many were tried
  mustBeatBenchmark: true,
  // beat buy-and-hold over the test window
  minTestTrades: 5,
  // enough trades for the stats to mean anything
  minTestRows: 60
  // enough held-out data to judge at all
};
var _init = loadStore();
var trained = _init.trained;
var published = _init.published;
var MAX_TRAINED = 50;
function id() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
function backtestModel(model2, candles, testStartTime, opts = {}) {
  const { initialCapital = 1e5, maxPositionPercent = 20 } = opts;
  const startIdx = candles.findIndex((c) => c.time >= testStartTime);
  if (startIdx < 60) return null;
  let cash = initialCapital, shares = 0;
  const equity = [];
  let trades = 0;
  const slip = 7e-4;
  for (let t = startIdx; t < candles.length - 1; t++) {
    const sig = modelStrategy(model2, candles, t);
    const next = candles[t + 1];
    const eq = cash + shares * candles[t].close;
    if (sig.action === "BUY" && shares === 0) {
      const spend = eq * (maxPositionPercent / 100) * Math.max(sig.confidence, 0.25);
      const px = next.open * (1 + slip);
      const qty = Math.floor(spend / px);
      if (qty > 0 && qty * px <= cash) {
        cash -= qty * px;
        shares += qty;
        trades++;
      }
    } else if (sig.action === "SELL" && shares > 0) {
      cash += shares * next.open * (1 - slip);
      shares = 0;
      trades++;
    }
    equity.push(cash + shares * candles[t].close);
  }
  equity.push(cash + shares * candles[candles.length - 1].close);
  const rets = [];
  for (let i = 1; i < equity.length; i++) rets.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  const stats = summarise(equity, rets, 252, 0.045);
  const bh = candles.slice(startIdx).map((c) => c.close);
  const bhReturn = bh.length > 1 ? (bh[bh.length - 1] - bh[0]) / bh[0] * 100 : 0;
  const dsr = rets.length >= 4 ? deflatedSharpe(rets, 20) : null;
  return {
    stats,
    trades,
    benchmarkReturn: +bhReturn.toFixed(2),
    beatBenchmark: stats ? stats.totalReturn > bhReturn : false,
    deflatedSharpe: dsr?.deflatedSharpe ?? null
  };
}
function evaluateGate({ testMetrics, backtest }) {
  const reasons = [];
  const g = PUBLISH_GATE;
  if (!testMetrics || testMetrics.n < g.minTestRows) reasons.push(`Need ${g.minTestRows}+ test rows`);
  if (testMetrics && testMetrics.auc != null && testMetrics.auc < g.minTestAuc) {
    reasons.push(`Test AUC ${testMetrics.auc} < ${g.minTestAuc} (no predictive edge)`);
  }
  if (!backtest || !backtest.stats) reasons.push("No out-of-sample backtest");
  else {
    if (backtest.trades < g.minTestTrades) reasons.push(`Only ${backtest.trades} test trades (need ${g.minTestTrades})`);
    if (backtest.stats.sharpe < g.minOutOfSampleSharpe) reasons.push(`OOS Sharpe ${backtest.stats.sharpe} < ${g.minOutOfSampleSharpe}`);
    if (g.mustBeatBenchmark && !backtest.beatBenchmark) {
      reasons.push(`Lost to buy-and-hold (${backtest.stats.totalReturn}% vs ${backtest.benchmarkReturn}%)`);
    }
    if (backtest.deflatedSharpe != null && backtest.deflatedSharpe < g.minDeflatedSharpe) {
      reasons.push(`Deflated Sharpe ${backtest.deflatedSharpe} < ${g.minDeflatedSharpe} (not distinguishable from luck)`);
    }
  }
  return { eligible: reasons.length === 0, reasons, gate: g };
}
function trainAndRegister(candles, config = {}) {
  const {
    symbol = "",
    range = "5y",
    modelType = "logistic",
    label = { up: 0.03, down: 0.02, horizon: 10 },
    testFraction = 0.3,
    epochs = 400,
    lr = 0.1,
    l2 = 0.01
  } = config;
  if (!MODEL_TYPES.includes(modelType)) {
    return { ok: false, error: `Model type "${modelType}" trains via the local Python pipeline (see MODEL_TRAINING.md), not in-app. In-app: ${MODEL_TYPES.join(", ")}.` };
  }
  if (!candles || candles.length < 300) {
    return { ok: false, error: `Need 300+ bars, got ${candles?.length || 0}` };
  }
  const dataset = buildDataset(candles, label);
  if (dataset.X.length < 100) {
    return { ok: false, error: `Only ${dataset.X.length} labeled rows; need 100+` };
  }
  const split = temporalSplit(dataset, testFraction);
  const model2 = modelType === "gbm" ? trainGBM(split.train.X, split.train.y, {
    nEstimators: config.nEstimators || 80,
    maxDepth: config.maxDepth || 3,
    learningRate: config.learningRate || 0.08,
    minLeaf: config.minLeaf || 15,
    featureNames: dataset.featureNames
  }) : trainLogistic(split.train.X, split.train.y, { epochs, lr, l2, featureNames: dataset.featureNames });
  if (!model2) return { ok: false, error: "Training failed" };
  const trainMetrics = evaluate(model2, split.train.X, split.train.y);
  const testMetrics = evaluate(model2, split.test.X, split.test.y);
  const testStartTime = split.test.times[0];
  const backtest = backtestModel(model2, candles, testStartTime, config);
  const gate = evaluateGate({ testMetrics, backtest });
  const record = {
    id: id(),
    symbol,
    range,
    modelType,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    config: { label, testFraction, epochs, lr, l2 },
    artifact: model2,
    trainMetrics,
    testMetrics,
    backtest,
    // Tree models can say which inputs they used — half the value of a GBM.
    featureImportance: modelType === "gbm" ? featureImportance(model2).slice(0, 8) : null,
    eligible: gate.eligible,
    gateReasons: gate.reasons,
    published: false
  };
  trained.unshift(record);
  if (trained.length > MAX_TRAINED) trained.length = MAX_TRAINED;
  persist({ trained, published });
  return { ok: true, model: record, gate };
}
function listTrained() {
  return trained.map(({ artifact, ...rest }) => ({ ...rest, featureCount: artifact.featureNames?.length ?? 0 }));
}
function getModel(modelId) {
  return trained.find((m) => m.id === modelId) || null;
}
function publishModel(modelId) {
  const m = getModel(modelId);
  if (!m) return { ok: false, error: "Model not found" };
  const gate = evaluateGate({ testMetrics: m.testMetrics, backtest: m.backtest });
  if (!gate.eligible) {
    return { ok: false, error: "Model does not meet the publish gate", reasons: gate.reasons };
  }
  if (published.some((p) => p.id === m.id)) return { ok: false, error: "Already published" };
  m.published = true;
  published.unshift({
    id: m.id,
    symbol: m.symbol,
    modelType: m.modelType,
    publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
    testMetrics: m.testMetrics,
    backtest: m.backtest,
    config: m.config,
    artifact: m.artifact
  });
  persist({ trained, published });
  return { ok: true, published: published.length };
}
function listPublished() {
  return published.map(({ artifact, ...rest }) => rest);
}
function unpublish(modelId) {
  const i = published.findIndex((p) => p.id === modelId);
  if (i < 0) return { ok: false, error: "Not published" };
  published.splice(i, 1);
  const m = getModel(modelId);
  if (m) m.published = false;
  persist({ trained, published });
  return { ok: true };
}

// server.js
dotenv.config();
var app = express();
var port = process.env.API_PORT || 3001;
app.use(cors());
app.use(express.json());
var cache = /* @__PURE__ */ new Map();
function cacheGet(key3) {
  const entry = cache.get(key3);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key3);
    return null;
  }
  return entry.value;
}
function cacheSet(key3, value, ttlMs) {
  cache.set(key3, { value, expiry: Date.now() + ttlMs });
}
function envAny(...names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  const lowered = names.map((n) => n.toLowerCase());
  for (const [key3, value] of Object.entries(process.env)) {
    if (value && lowered.includes(key3.toLowerCase())) return value;
  }
  return void 0;
}
var FINNHUB_KEY = envAny("FINNHUB_API_KEY", "FINNHUB_KEY", "FINNHUB");
var NEWSAPI_KEY = envAny("NEWSAPI_KEY", "NEWS_API_KEY", "NEWSAPI");
var FRED_KEY = envAny("FRED_API_KEY", "FRED_KEY", "FRED");
var ALPHA_VANTAGE_KEY = envAny("ALPHA_VANTAGE_API_KEY", "ALPHAVANTAGE_API_KEY", "ALPHA_VANTAGE_KEY");
var MARKETAUX_KEY = envAny("MARKETAUX_API_KEY", "MARKETAUX_KEY", "MARKETAUX");
console.log("[keys]", {
  finnhub: !!FINNHUB_KEY,
  newsapi: !!NEWSAPI_KEY,
  fred: !!FRED_KEY,
  alphaVantage: !!ALPHA_VANTAGE_KEY,
  marketaux: !!MARKETAUX_KEY
});
var HEATMAP_CONSTITUENTS = Object.fromEntries(
  Object.entries(SP500_BY_SECTOR).map(([sector, symbols]) => [sector, symbols.slice(0, 8)])
);
var BULLISH_WORDS = /\b(beat|surge|rally|record|upgrade|buy|growth|profit|soar|gain|jump|rise|boost|strong|bullish|outperform|breakout)\b/i;
var BEARISH_WORDS = /\b(miss|drop|fall|cut|downgrade|sell|loss|layoff|crash|decline|slump|weak|plunge|sink|bearish|underperform|breakdown)\b/i;
function tagSentiment(headline) {
  if (BULLISH_WORDS.test(headline)) return "bullish";
  if (BEARISH_WORDS.test(headline)) return "bearish";
  return "neutral";
}
function extractSymbol(headline) {
  const allSymbols = Object.values(HEATMAP_CONSTITUENTS).flat();
  for (const sym of allSymbols) {
    if (headline.includes(sym) || headline.includes(sym.replace("-", ""))) return sym;
  }
  const match = headline.match(/\b([A-Z]{2,5})\b/);
  if (match && allSymbols.includes(match[1])) return match[1];
  return null;
}
var yahooAuth = null;
async function getYahooAuth() {
  if (yahooAuth && Date.now() < yahooAuth.expiry) return yahooAuth;
  try {
    const cookieResp = await fetch2("https://fc.yahoo.com/", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
    });
    const setCookie = cookieResp.headers.get("set-cookie");
    const cookie = setCookie ? setCookie.split(";")[0] : "";
    if (!cookie) return null;
    const crumbResp = await fetch2("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": "Mozilla/5.0", "Cookie": cookie }
    });
    const crumb = await crumbResp.text();
    if (!crumb || crumb.includes("<")) return null;
    yahooAuth = { cookie, crumb, expiry: Date.now() + 36e5 };
    return yahooAuth;
  } catch {
    return null;
  }
}
async function yahooQuoteSummary(symbol, modules) {
  const auth = await getYahooAuth();
  if (!auth) return null;
  for (const host of ["query2.finance.yahoo.com", "query1.finance.yahoo.com"]) {
    try {
      const url = `https://${host}/v10/finance/quoteSummary/${symbol}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;
      const resp = await fetch2(url, { headers: { "User-Agent": "Mozilla/5.0", "Cookie": auth.cookie } });
      if (!resp.ok) continue;
      const data = await resp.json();
      const result = data.quoteSummary?.result?.[0];
      if (result) return result;
    } catch {
    }
  }
  return null;
}
async function yahooQuote(symbol) {
  const resp = await fetch2(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!resp.ok) throw new Error(`Yahoo quote failed for ${symbol}`);
  const data = await resp.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(`No quote data for ${symbol}`);
  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close || [];
  const volumes = result.indicators?.quote?.[0]?.volume || [];
  const latest = closes[closes.length - 1] ?? meta.regularMarketPrice;
  const prev = closes.length > 1 ? closes[closes.length - 2] : meta.previousClose ?? latest;
  const change = latest - prev;
  const changePercent = prev ? change / prev * 100 : 0;
  return {
    symbol,
    price: latest,
    change,
    changePercent,
    volume: volumes[volumes.length - 1] || meta.regularMarketVolume || 0,
    name: meta.shortName || meta.symbol || symbol
  };
}
async function yahooCandles(symbol, interval, range) {
  const resp = await fetch2(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!resp.ok) throw new Error(`Yahoo candles failed for ${symbol}`);
  const data = await resp.json();
  const result = data.chart?.result?.[0];
  if (!result) return [];
  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  return ts.map((t, i) => ({
    time: t,
    open: q.open?.[i] ?? null,
    high: q.high?.[i] ?? null,
    low: q.low?.[i] ?? null,
    close: q.close?.[i] ?? null,
    volume: q.volume?.[i] ?? 0
  })).filter((c) => c.open !== null && c.close !== null);
}
async function finnhubFetch(path) {
  if (!FINNHUB_KEY) return null;
  const resp = await fetch2(`https://finnhub.io/api/v1${path}&token=${FINNHUB_KEY}`);
  if (!resp.ok) return null;
  return resp.json();
}
async function fredFetch(seriesId, options = {}) {
  if (!FRED_KEY) return null;
  const limit = options.limit || 30;
  const sort = options.sort || "desc";
  const resp = await fetch2(
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=${sort}&limit=${limit}`
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.observations || [];
}
async function fredSeriesInfo(seriesId) {
  if (!FRED_KEY) return null;
  const resp = await fetch2(
    `https://api.stlouisfed.org/fred/series?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json`
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.seriess?.[0] || null;
}
var FRED_SERIES = {
  DFF: { name: "Fed Funds Rate", category: "rates", frequency: "daily" },
  DGS2: { name: "2-Year Treasury", category: "rates", frequency: "daily" },
  DGS10: { name: "10-Year Treasury", category: "rates", frequency: "daily" },
  DGS30: { name: "30-Year Treasury", category: "rates", frequency: "daily" },
  T10Y2Y: { name: "10Y-2Y Spread", category: "rates", frequency: "daily" },
  T10YFF: { name: "10Y-FF Spread", category: "rates", frequency: "daily" },
  VIXCLS: { name: "VIX", category: "volatility", frequency: "daily" },
  DTWEXBGS: { name: "USD Index (Broad)", category: "forex", frequency: "daily" },
  DCOILWTICO: { name: "WTI Crude Oil", category: "commodities", frequency: "daily" },
  DCOILBRENTEU: { name: "Brent Crude Oil", category: "commodities", frequency: "daily" },
  GOLDAMGBD228NLBM: { name: "Gold Price (London)", category: "commodities", frequency: "daily" },
  UNRATE: { name: "Unemployment Rate", category: "labor", frequency: "monthly" },
  CPIAUCSL: { name: "CPI (All Urban)", category: "inflation", frequency: "monthly" },
  PCEPI: { name: "PCE Price Index", category: "inflation", frequency: "monthly" },
  GDPC1: { name: "Real GDP", category: "output", frequency: "quarterly" },
  FEDFUNDS: { name: "Effective Fed Funds", category: "rates", frequency: "monthly" },
  BAMLH0A0HYM2: { name: "High Yield Spread", category: "credit", frequency: "daily" },
  UMCSENT: { name: "Consumer Sentiment", category: "sentiment", frequency: "monthly" },
  IC4WSA: { name: "Initial Claims (4wk avg)", category: "labor", frequency: "weekly" }
};
async function marketauxFetch(params = {}) {
  if (!MARKETAUX_KEY) return null;
  const qs = new URLSearchParams({
    api_token: MARKETAUX_KEY,
    language: "en",
    limit: String(params.limit || 20),
    ...params
  });
  delete qs.api_token;
  const url = `https://api.marketaux.com/v1/news/all?api_token=${MARKETAUX_KEY}&language=en&limit=${params.limit || 20}${params.symbols ? `&symbols=${params.symbols}` : ""}${params.filter_entities ? `&filter_entities=true` : ""}`;
  const resp = await fetch2(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.data || [];
}
var QUOTE_BATCH_SIZE = 50;
async function yahooQuoteBatch(symbols) {
  if (!symbols.length) return [];
  const auth = await getYahooAuth();
  const out = [];
  for (let i = 0; i < symbols.length; i += QUOTE_BATCH_SIZE) {
    const chunk = symbols.slice(i, i + QUOTE_BATCH_SIZE);
    let got = false;
    for (const host of ["query2.finance.yahoo.com", "query1.finance.yahoo.com"]) {
      try {
        const crumbParam = auth?.crumb ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
        const url = `https://${host}/v7/finance/quote?symbols=${chunk.join(",")}${crumbParam}`;
        const headers = { "User-Agent": "Mozilla/5.0", "Accept": "application/json" };
        if (auth?.cookie) headers["Cookie"] = auth.cookie;
        const resp = await fetch2(url, { headers });
        if (!resp.ok) continue;
        const data = await resp.json();
        const rows = data.quoteResponse?.result;
        if (!Array.isArray(rows)) continue;
        for (const r of rows) {
          if (r.regularMarketPrice == null) continue;
          out.push({
            symbol: r.symbol,
            name: r.shortName || r.longName || r.symbol,
            price: r.regularMarketPrice,
            change: r.regularMarketChange ?? 0,
            changePercent: r.regularMarketChangePercent ?? 0,
            volume: r.regularMarketVolume ?? 0
          });
        }
        got = true;
        break;
      } catch {
      }
    }
    if (!got) {
      const settled = await Promise.allSettled(chunk.map((s) => yahooQuote(s)));
      for (const r of settled) if (r.status === "fulfilled") out.push(r.value);
    }
  }
  return out;
}
async function alphaVantageQuote(symbol) {
  if (!ALPHA_VANTAGE_KEY) return null;
  const resp = await fetch2(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  const q = data["Global Quote"];
  if (!q || !q["05. price"]) return null;
  return {
    symbol,
    price: parseFloat(q["05. price"]),
    change: parseFloat(q["09. change"]),
    changePercent: parseFloat(q["10. change percent"]?.replace("%", "")),
    volume: parseInt(q["06. volume"]),
    name: symbol
  };
}
app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/v1/quotes", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "AAPL").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    const cacheKey = `quotes:${symbols.join(",")}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const fetched = await yahooQuoteBatch(symbols);
    const bySymbol = new Map(fetched.map((q) => [q.symbol, q]));
    const quotes = await Promise.all(symbols.map(async (sym) => {
      const hit = bySymbol.get(sym);
      if (hit) return hit;
      try {
        const av = await alphaVantageQuote(sym);
        if (av) return av;
      } catch {
      }
      return { symbol: sym, price: null, change: 0, changePercent: 0, volume: 0, error: true };
    }));
    cacheSet(cacheKey, quotes, 8e3);
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
  }
});
app.get("/api/v1/ticker", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 120, SP500_ALL.length);
    const cacheKey = `ticker:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const lists = Object.values(SP500_BY_SECTOR);
    const symbols = [];
    for (let i = 0; symbols.length < limit; i++) {
      let added = false;
      for (const list of lists) {
        if (i < list.length && symbols.length < limit) {
          symbols.push(list[i]);
          added = true;
        }
      }
      if (!added) break;
    }
    const quotes = (await yahooQuoteBatch(symbols)).filter((q) => q.price != null).map((q) => ({
      symbol: q.symbol,
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      sector: SYMBOL_SECTOR[q.symbol] || null
    }));
    cacheSet(cacheKey, quotes, 3e4);
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/candles", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AAPL").toUpperCase();
    const resolution = req.query.resolution || "15m";
    const range = req.query.range || "1d";
    const cacheKey = `candles:${symbol}:${resolution}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const resolutionMap = {
      "1m": { interval: "1m", range: "1d", ttl: 12e3 },
      "5m": { interval: "5m", range: "5d", ttl: 12e3 },
      "15m": { interval: "15m", range: "5d", ttl: 12e3 },
      "1h": { interval: "60m", range: "1mo", ttl: 12e3 },
      "1D": { interval: "1d", range: "6mo", ttl: 55e3 },
      "1W": { interval: "1wk", range: "2y", ttl: 55e3 },
      "1M": { interval: "1mo", range: "5y", ttl: 55e3 },
      // Longer horizons: daily bars over a year reads well, weekly over
      // five years keeps the series a sane length.
      "1Y": { interval: "1d", range: "1y", ttl: 55e3 },
      "5Y": { interval: "1wk", range: "5y", ttl: 3e5 }
    };
    const config = resolutionMap[resolution] || resolutionMap["15m"];
    const candles = await yahooCandles(symbol, config.interval, range !== "1d" ? range : config.range);
    const result = { symbol, resolution, candles };
    cacheSet(cacheKey, result, config.ttl);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
  }
});
app.get("/api/v1/news", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const symbol = (req.query.symbol || "").toUpperCase().trim();
    const cacheKey = `news:${symbol || "general"}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const articles = [];
    if (FINNHUB_KEY) {
      try {
        let finnNews;
        if (symbol) {
          const from = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
          const to = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
          finnNews = await finnhubFetch(`/company-news?symbol=${symbol}&from=${from}&to=${to}`);
        } else {
          finnNews = await finnhubFetch("/news?category=general");
        }
        if (Array.isArray(finnNews)) {
          finnNews.slice(0, limit).forEach((a) => {
            articles.push({
              id: `fh-${a.id}`,
              headline: a.headline,
              source: a.source,
              url: a.url,
              image: a.image || null,
              publishedAt: new Date(a.datetime * 1e3).toISOString(),
              sentiment: tagSentiment(a.headline),
              sentimentSource: "heuristic",
              relatedSymbol: symbol || extractSymbol(a.headline)
            });
          });
        }
      } catch {
      }
    }
    if (MARKETAUX_KEY && articles.length < limit) {
      try {
        const mxNews = await marketauxFetch({ limit: limit - articles.length, filter_entities: true, ...symbol ? { symbols: symbol } : {} });
        if (Array.isArray(mxNews)) {
          mxNews.forEach((a) => {
            const existsAlready = articles.some(
              (existing) => existing.headline?.toLowerCase().slice(0, 50) === a.title?.toLowerCase().slice(0, 50)
            );
            if (!existsAlready && articles.length < limit * 2) {
              const entities = a.entities || [];
              const stockEntity = entities.find((e) => e.type === "equity");
              articles.push({
                id: `mx-${a.uuid}`,
                headline: a.title,
                source: a.source,
                url: a.url,
                image: a.image_url || null,
                publishedAt: a.published_at,
                sentiment: a.entities?.[0]?.sentiment_score > 0.2 ? "bullish" : a.entities?.[0]?.sentiment_score < -0.2 ? "bearish" : tagSentiment(a.title || ""),
                sentimentSource: a.entities?.[0]?.sentiment_score != null ? "marketaux" : "heuristic",
                relatedSymbol: stockEntity?.symbol || extractSymbol(a.title || "")
              });
            }
          });
        }
      } catch {
      }
    }
    if (NEWSAPI_KEY && articles.length < limit) {
      try {
        const resp = await fetch2(
          `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=${limit}&apiKey=${NEWSAPI_KEY}`
        );
        if (resp.ok) {
          const data = await resp.json();
          (data.articles || []).forEach((a, i) => {
            if (articles.length < limit * 2) {
              articles.push({
                id: `na-${i}-${Date.now()}`,
                headline: a.title,
                source: a.source?.name || "NewsAPI",
                url: a.url,
                image: a.urlToImage || null,
                publishedAt: a.publishedAt,
                sentiment: tagSentiment(a.title || ""),
                sentimentSource: "heuristic",
                relatedSymbol: extractSymbol(a.title || "")
              });
            }
          });
        }
      } catch {
      }
    }
    const seen = /* @__PURE__ */ new Set();
    const unique = articles.filter((a) => {
      const key3 = a.headline?.toLowerCase().slice(0, 60);
      if (!key3 || seen.has(key3)) return false;
      seen.add(key3);
      return true;
    });
    unique.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    cacheSet(cacheKey, unique.slice(0, limit * 2), 55e3);
    res.json(unique.slice(0, limit * 2));
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
  }
});
app.get("/api/v1/heatmap", async (req, res) => {
  try {
    const cached = cacheGet("heatmap");
    if (cached) return res.json(cached);
    const sectors = {};
    for (const [sector, symbols] of Object.entries(HEATMAP_CONSTITUENTS)) {
      const stocks = await Promise.all(
        symbols.map(async (sym) => {
          try {
            const q = await yahooQuote(sym);
            return { symbol: sym, name: q.name, price: q.price, changePercent: q.changePercent, volume: q.volume, sector };
          } catch {
            return { symbol: sym, name: sym, price: null, changePercent: 0, volume: 0, sector };
          }
        })
      );
      sectors[sector] = stocks;
    }
    cacheSet("heatmap", sectors, 55e3);
    res.json(sectors);
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
  }
});
app.get("/api/v1/calendar", async (req, res) => {
  try {
    const cached = cacheGet("calendar");
    if (cached) return res.json(cached);
    const events = [];
    if (FINNHUB_KEY) {
      try {
        const from = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const to = new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10);
        const data = await finnhubFetch(`/calendar/earnings?from=${from}&to=${to}`);
        if (data?.earningsCalendar) {
          data.earningsCalendar.slice(0, 20).forEach((e) => {
            events.push({
              date: e.date,
              time: e.hour ? `${e.hour}:00` : "TBD",
              type: "earnings",
              title: `${e.symbol} Earnings`,
              symbol: e.symbol,
              expected: e.epsEstimate != null ? `$${e.epsEstimate}` : null,
              prior: e.epsActual != null ? `$${e.epsActual}` : null
            });
          });
        }
      } catch {
      }
    }
    const today = /* @__PURE__ */ new Date();
    const staticEvents = [
      { offset: 0, time: "08:30", type: "macro", title: "Initial Jobless Claims", expected: "220K", prior: "215K" },
      { offset: 1, time: "10:00", type: "macro", title: "Consumer Sentiment", expected: "67.5", prior: "66.4" },
      { offset: 2, time: "14:00", type: "fed", title: "FOMC Meeting Minutes", expected: null, prior: null },
      { offset: 3, time: "08:30", type: "macro", title: "CPI MoM", expected: "0.3%", prior: "0.4%" },
      { offset: 4, time: "08:30", type: "macro", title: "PPI MoM", expected: "0.2%", prior: "0.1%" }
    ];
    staticEvents.forEach((se) => {
      const d = new Date(today.getTime() + se.offset * 864e5);
      events.push({
        date: d.toISOString().slice(0, 10),
        time: se.time,
        type: se.type,
        title: se.title,
        symbol: null,
        expected: se.expected,
        prior: se.prior
      });
    });
    events.sort((a, b) => {
      const da = /* @__PURE__ */ new Date(`${a.date}T${a.time === "TBD" ? "23:59" : a.time}`);
      const db = /* @__PURE__ */ new Date(`${b.date}T${b.time === "TBD" ? "23:59" : b.time}`);
      return da - db;
    });
    cacheSet("calendar", events, 36e5);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
  }
});
app.get("/api/v1/search", async (req, res) => {
  try {
    const q = (req.query.q || "").toUpperCase();
    if (!q) return res.json([]);
    const cacheKey = `search:${q}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    let results = [];
    if (FINNHUB_KEY) {
      try {
        const data = await finnhubFetch(`/search?q=${q}`);
        if (data?.result) {
          results = data.result.filter((r) => r.type === "Common Stock" || r.type === "ETP").slice(0, 10).map((r) => ({ symbol: r.symbol, name: r.description }));
        }
      } catch {
      }
    }
    if (!results.length) {
      const prefix = SP500_ALL.filter((s) => s.startsWith(q));
      const contains = SP500_ALL.filter((s) => !s.startsWith(q) && s.includes(q));
      results = [...prefix, ...contains].slice(0, 10).map((s) => ({ symbol: s, name: `${s} \xB7 ${SYMBOL_SECTOR[s] || "S&P 500"}` }));
    }
    cacheSet(cacheKey, results, 3e5);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/fred/rates", async (req, res) => {
  try {
    const cached = cacheGet("fred:rates");
    if (cached) return res.json(cached);
    const rateSeriesIds = ["DFF", "DGS2", "DGS10", "DGS30", "T10Y2Y", "T10YFF"];
    const results = {};
    await Promise.all(rateSeriesIds.map(async (id2) => {
      try {
        const obs = await fredFetch(id2, { limit: 5 });
        if (obs?.length) {
          const latest = obs.find((o) => o.value !== ".");
          const prev = obs.find((o, i) => i > 0 && o.value !== ".");
          results[id2] = {
            name: FRED_SERIES[id2].name,
            value: latest ? parseFloat(latest.value) : null,
            date: latest?.date,
            prior: prev ? parseFloat(prev.value) : null,
            priorDate: prev?.date,
            change: latest && prev ? parseFloat(latest.value) - parseFloat(prev.value) : null
          };
        }
      } catch {
      }
    }));
    cacheSet("fred:rates", results, 3e5);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/fred/market", async (req, res) => {
  try {
    const cached = cacheGet("fred:market");
    if (cached) return res.json(cached);
    const marketIds = ["VIXCLS", "DTWEXBGS", "DCOILWTICO", "DCOILBRENTEU", "GOLDAMGBD228NLBM"];
    const results = {};
    await Promise.all(marketIds.map(async (id2) => {
      try {
        const obs = await fredFetch(id2, { limit: 10 });
        if (obs?.length) {
          const latest = obs.find((o) => o.value !== ".");
          const prev = obs.find((o, i) => i > 0 && o.value !== ".");
          results[id2] = {
            name: FRED_SERIES[id2].name,
            value: latest ? parseFloat(latest.value) : null,
            date: latest?.date,
            prior: prev ? parseFloat(prev.value) : null,
            change: latest && prev ? parseFloat(latest.value) - parseFloat(prev.value) : null,
            changePercent: latest && prev && parseFloat(prev.value) ? (parseFloat(latest.value) - parseFloat(prev.value)) / parseFloat(prev.value) * 100 : null
          };
        }
      } catch {
      }
    }));
    cacheSet("fred:market", results, 3e5);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/fred/macro", async (req, res) => {
  try {
    const cached = cacheGet("fred:macro");
    if (cached) return res.json(cached);
    const macroIds = ["UNRATE", "CPIAUCSL", "PCEPI", "GDPC1", "FEDFUNDS", "BAMLH0A0HYM2", "UMCSENT", "IC4WSA"];
    const results = {};
    await Promise.all(macroIds.map(async (id2) => {
      try {
        const obs = await fredFetch(id2, { limit: 5 });
        if (obs?.length) {
          const latest = obs.find((o) => o.value !== ".");
          const prev = obs.find((o, i) => i > 0 && o.value !== ".");
          results[id2] = {
            name: FRED_SERIES[id2].name,
            category: FRED_SERIES[id2].category,
            frequency: FRED_SERIES[id2].frequency,
            value: latest ? parseFloat(latest.value) : null,
            date: latest?.date,
            prior: prev ? parseFloat(prev.value) : null,
            priorDate: prev?.date,
            change: latest && prev ? parseFloat(latest.value) - parseFloat(prev.value) : null
          };
        }
      } catch {
      }
    }));
    cacheSet("fred:macro", results, 6e5);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/fred/series/:id", async (req, res) => {
  try {
    const seriesId = req.params.id.toUpperCase();
    const limit = parseInt(req.query.limit) || 30;
    const cacheKey = `fred:series:${seriesId}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const [obs, info] = await Promise.all([
      fredFetch(seriesId, { limit }),
      fredSeriesInfo(seriesId)
    ]);
    const result = {
      id: seriesId,
      title: info?.title || FRED_SERIES[seriesId]?.name || seriesId,
      frequency: info?.frequency || FRED_SERIES[seriesId]?.frequency,
      units: info?.units,
      observations: (obs || []).filter((o) => o.value !== ".").map((o) => ({
        date: o.date,
        value: parseFloat(o.value)
      }))
    };
    cacheSet(cacheKey, result, 3e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/profile", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AAPL").toUpperCase();
    const cacheKey = `profile:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const [finnhubData, yahooData] = await Promise.all([
      finnhubFetch(`/stock/profile2?symbol=${symbol}`),
      yahooQuote(symbol).catch(() => null)
    ]);
    const result = {
      symbol,
      name: finnhubData?.name || yahooData?.name || symbol,
      logo: finnhubData?.logo || null,
      industry: finnhubData?.finnhubIndustry || null,
      sector: finnhubData?.finnhubIndustry || null,
      country: finnhubData?.country || null,
      exchange: finnhubData?.exchange || null,
      marketCap: finnhubData?.marketCapitalization ? finnhubData.marketCapitalization * 1e6 : null,
      shareOutstanding: finnhubData?.shareOutstanding || null,
      ipo: finnhubData?.ipo || null,
      weburl: finnhubData?.weburl || null,
      phone: finnhubData?.phone || null,
      price: yahooData?.price || null,
      change: yahooData?.change || null,
      changePercent: yahooData?.changePercent || null,
      volume: yahooData?.volume || null
    };
    cacheSet(cacheKey, result, 36e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/analyst", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AAPL").toUpperCase();
    const cacheKey = `analyst:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const [recData, targetData, earningsData, quote] = await Promise.all([
      finnhubFetch(`/stock/recommendation?symbol=${symbol}`),
      finnhubFetch(`/stock/price-target?symbol=${symbol}`).catch(() => null),
      finnhubFetch(`/stock/earnings?symbol=${symbol}`).catch(() => null),
      yahooQuote(symbol).catch(() => null)
    ]);
    const recommendations = (recData || []).slice(0, 6).map((r) => ({
      period: r.period,
      strongBuy: r.strongBuy,
      buy: r.buy,
      hold: r.hold,
      sell: r.sell,
      strongSell: r.strongSell
    }));
    let trend = null;
    if (recommendations.length >= 2) {
      const bullShare = (r) => {
        const t = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell;
        return t ? (r.strongBuy + r.buy) / t : 0;
      };
      const delta = bullShare(recommendations[0]) - bullShare(recommendations[1]);
      trend = delta > 0.02 ? "improving" : delta < -0.02 ? "deteriorating" : "stable";
    }
    let priceTarget = null;
    const current = quote?.price || null;
    if (targetData && targetData.targetMean) {
      priceTarget = {
        mean: targetData.targetMean,
        high: targetData.targetHigh,
        low: targetData.targetLow,
        median: targetData.targetMedian,
        current: current || targetData.lastPrice || null
      };
    } else {
      const summary = await yahooQuoteSummary(symbol, "financialData").catch(() => null);
      const fd = summary?.financialData;
      if (fd?.targetMeanPrice?.raw) {
        priceTarget = {
          mean: fd.targetMeanPrice.raw,
          high: fd.targetHighPrice?.raw,
          low: fd.targetLowPrice?.raw,
          median: fd.targetMedianPrice?.raw,
          current: current || fd.currentPrice?.raw || null,
          numberOfAnalysts: fd.numberOfAnalystOpinions?.raw
        };
      }
    }
    if (priceTarget && priceTarget.current && priceTarget.mean) {
      priceTarget.upside = +((priceTarget.mean - priceTarget.current) / priceTarget.current * 100).toFixed(2);
    }
    const earningsSurprises = (earningsData || []).slice(0, 4).map((e) => ({
      period: e.period,
      actual: e.actual,
      estimate: e.estimate,
      surprise: e.surprise,
      surprisePercent: e.surprisePercent
    }));
    const result = { symbol, recommendations, trend, priceTarget, earningsSurprises };
    cacheSet(cacheKey, result, 216e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/crypto", async (req, res) => {
  try {
    const cacheKey = "crypto:top";
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const cryptoSymbols = ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD", "ADA-USD", "DOGE-USD", "DOT-USD", "AVAX-USD", "MATIC-USD"];
    const results = await Promise.allSettled(
      cryptoSymbols.map((s) => yahooQuote(s))
    );
    const cryptos = results.filter((r) => r.status === "fulfilled").map((r) => {
      const q = r.value;
      return {
        symbol: q.symbol.replace("-USD", ""),
        name: q.name || q.symbol.replace("-USD", ""),
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        volume: q.volume
      };
    });
    cacheSet(cacheKey, cryptos, 3e4);
    res.json(cryptos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/forex", async (req, res) => {
  try {
    const cacheKey = "forex:all";
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const forexSymbols = ["EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCHF=X", "AUDUSD=X", "USDCAD=X", "NZDUSD=X"];
    const commoditySymbols = ["GC=F", "SI=F", "CL=F", "NG=F", "HG=F"];
    const [forexResults, commodityResults] = await Promise.all([
      Promise.allSettled(forexSymbols.map((s) => yahooQuote(s))),
      Promise.allSettled(commoditySymbols.map((s) => yahooQuote(s)))
    ]);
    const nameMap = {
      "EURUSD=X": "EUR/USD",
      "GBPUSD=X": "GBP/USD",
      "USDJPY=X": "USD/JPY",
      "USDCHF=X": "USD/CHF",
      "AUDUSD=X": "AUD/USD",
      "USDCAD=X": "USD/CAD",
      "NZDUSD=X": "NZD/USD",
      "GC=F": "Gold",
      "SI=F": "Silver",
      "CL=F": "Crude Oil WTI",
      "NG=F": "Natural Gas",
      "HG=F": "Copper"
    };
    const mapQuote = (r) => {
      if (r.status !== "fulfilled") return null;
      const q = r.value;
      return { symbol: q.symbol, name: nameMap[q.symbol] || q.name, price: q.price, change: q.change, changePercent: q.changePercent };
    };
    const result = {
      forex: forexResults.map(mapQuote).filter(Boolean),
      commodities: commodityResults.map(mapQuote).filter(Boolean)
    };
    cacheSet(cacheKey, result, 6e4);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/indices", async (req, res) => {
  try {
    const cacheKey = "indices:all";
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const results = await Promise.allSettled(MARKET_INDICES.map((idx) => yahooQuote(idx.symbol)));
    const indices = MARKET_INDICES.map((idx, i) => {
      const r = results[i];
      if (r.status !== "fulfilled") return { ...idx, price: null, change: null, changePercent: null };
      const q = r.value;
      return { symbol: idx.symbol, name: idx.name, short: idx.short, price: q.price, change: q.change, changePercent: q.changePercent };
    });
    cacheSet(cacheKey, indices, 3e4);
    res.json(indices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/fundamentals", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AAPL").toUpperCase();
    const cacheKey = `fundamentals:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const data = await finnhubFetch(`/stock/metric?symbol=${symbol}&metric=all`);
    const m = data?.metric || {};
    const result = {
      symbol,
      valuation: {
        peRatio: m["peBasicExclExtraTTM"] || m["peTTM"] || null,
        pbRatio: m["pbAnnual"] || null,
        psRatio: m["psAnnual"] || null,
        evToEbitda: m["enterpriseValueOverEBITDATTM"] || null,
        marketCap: m["marketCapitalization"] || null
      },
      profitability: {
        roeTTM: m["roeTTM"] || null,
        roaTTM: m["roaTTM"] || null,
        grossMarginTTM: m["grossMarginTTM"] || null,
        operatingMarginTTM: m["operatingMarginTTM"] || null,
        netMarginTTM: m["netProfitMarginTTM"] || null
      },
      growth: {
        revenueGrowthTTM: m["revenueGrowthTTMYoy"] || null,
        epsGrowthTTM: m["epsGrowthTTMYoy"] || null,
        revenueGrowth3Y: m["revenueGrowth3Y"] || null,
        epsGrowth3Y: m["epsGrowth3Y"] || null
      },
      balanceSheet: {
        totalDebtToEquity: m["totalDebt/totalEquityAnnual"] || null,
        currentRatio: m["currentRatioAnnual"] || null,
        quickRatio: m["quickRatioAnnual"] || null
      },
      dividends: {
        dividendYield: m["dividendYieldIndicatedAnnual"] || null,
        dividendPerShare: m["dividendPerShareAnnual"] || null,
        payoutRatio: m["payoutRatioAnnual"] || null
      },
      trading: {
        week52High: m["52WeekHigh"] || null,
        week52Low: m["52WeekLow"] || null,
        week52HighDate: m["52WeekHighDate"] || null,
        week52LowDate: m["52WeekLowDate"] || null,
        beta: m["beta"] || null,
        avgVolume10d: m["10DayAverageTradingVolume"] || null,
        avgVolume3m: m["3MonthAverageTradingVolume"] || null
      }
    };
    cacheSet(cacheKey, result, 144e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/earnings", async (req, res) => {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const weekOut = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to = req.query.to || weekOut;
    const cacheKey = `earnings:${from}:${to}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const data = await finnhubFetch(`/calendar/earnings?from=${from}&to=${to}`);
    const result = (data?.earningsCalendar || []).map((e) => ({
      symbol: e.symbol,
      date: e.date,
      hour: e.hour,
      epsEstimate: e.epsEstimate,
      epsActual: e.epsActual,
      revenueEstimate: e.revenueEstimate,
      revenueActual: e.revenueActual,
      quarter: e.quarter,
      year: e.year
    }));
    cacheSet(cacheKey, result, 36e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/ipo", async (req, res) => {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const monthOut = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to = req.query.to || monthOut;
    const cacheKey = `ipo:${from}:${to}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const data = await finnhubFetch(`/calendar/ipo?from=${from}&to=${to}`);
    const result = (data?.ipoCalendar || []).map((i) => ({
      symbol: i.symbol || null,
      name: i.name,
      date: i.date,
      exchange: i.exchange || null,
      priceRangeLow: i.priceRangeLow || null,
      priceRangeHigh: i.priceRangeHigh || null,
      numberOfShares: i.numberOfShares || null,
      totalSharesValue: i.totalSharesValue || null,
      status: i.status || "expected"
    }));
    cacheSet(cacheKey, result, 72e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/financials", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AAPL").toUpperCase();
    const freq = req.query.freq === "quarterly" ? "quarterly" : "annual";
    const periods = Math.min(parseInt(req.query.periods) || 4, 8);
    const cacheKey = `financials:${symbol}:${freq}:${periods}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const data = await finnhubFetch(`/stock/financials-reported?symbol=${symbol}&freq=${freq}`);
    const reports = (data?.data || []).slice(0, periods);
    if (!reports.length) {
      return res.json({ symbol, freq, available: false, periods: [], statements: {} });
    }
    const periodMeta = reports.map((r) => ({
      year: r.year,
      quarter: r.quarter,
      form: r.form,
      endDate: r.endDate ? String(r.endDate).slice(0, 10) : null,
      label: freq === "annual" ? `FY${r.year}` : `Q${r.quarter} ${r.year}`
    }));
    const buildStatement = (key3) => {
      const order = [];
      const seen = /* @__PURE__ */ new Set();
      for (const r of reports) {
        for (const item of r.report?.[key3] || []) {
          if (item.concept && !seen.has(item.concept)) {
            seen.add(item.concept);
            order.push({ concept: item.concept, label: item.label || item.concept, unit: item.unit });
          }
        }
      }
      return order.map(({ concept, label, unit }) => {
        const cells = reports.map((r) => {
          const hit = (r.report?.[key3] || []).find((i) => i.concept === concept);
          return hit ? { value: hit.value ?? null, label: hit.label || null } : { value: null, label: null };
        });
        const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const anchor = norm(label);
        const mismatched = cells.map((c) => c.label != null && norm(c.label) !== anchor);
        const values = cells.map((c) => c.value);
        const yoy = values.map((v, i) => {
          const prev = values[i + 1];
          if (v == null || prev == null || prev === 0) return null;
          if (mismatched[i] || mismatched[i + 1]) return null;
          return +((v - prev) / Math.abs(prev) * 100).toFixed(1);
        });
        return {
          concept,
          label,
          unit,
          values,
          yoy,
          mismatched,
          periodLabels: cells.map((c) => c.label)
        };
      }).filter((row) => row.values.some((v) => v != null));
    };
    const result = {
      symbol,
      freq,
      available: true,
      periods: periodMeta,
      statements: {
        income: buildStatement("ic"),
        balance: buildStatement("bs"),
        cashflow: buildStatement("cf")
      }
    };
    cacheSet(cacheKey, result, 864e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/analytics/correlation", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 15);
    const window = Math.min(parseInt(req.query.window) || 90, 365);
    if (symbols.length < 2) {
      return res.json({ available: false, message: "Need at least 2 symbols" });
    }
    const cacheKey = `corr:${symbols.join(",")}:${window}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const range = window <= 90 ? "6mo" : window <= 180 ? "1y" : "2y";
    const settled = await Promise.allSettled(symbols.map((s) => yahooCandles(s, "1d", range)));
    const returnsBySymbol = {};
    settled.forEach((r, i) => {
      if (r.status !== "fulfilled" || r.value.length < 10) return;
      const closes = r.value.map((c) => c.close);
      const rets = [];
      for (let j = 1; j < closes.length; j++) {
        if (closes[j] && closes[j - 1]) rets.push((closes[j] - closes[j - 1]) / closes[j - 1]);
      }
      returnsBySymbol[symbols[i]] = rets.slice(-window);
    });
    const valid = symbols.filter((s) => returnsBySymbol[s]?.length >= 10);
    if (valid.length < 2) {
      return res.json({ available: false, message: "Insufficient price history" });
    }
    const len = Math.min(...valid.map((s) => returnsBySymbol[s].length));
    const series = valid.map((s) => returnsBySymbol[s].slice(-len));
    const mean3 = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const corr = (a, b) => {
      const ma = mean3(a), mb = mean3(b);
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < a.length; i++) {
        const x = a[i] - ma, y = b[i] - mb;
        num += x * y;
        da += x * x;
        db += y * y;
      }
      const den = Math.sqrt(da * db);
      return den ? num / den : 0;
    };
    const matrix = series.map((a, i) => series.map(
      (b, j) => i === j ? 1 : +corr(a, b).toFixed(3)
    ));
    const pairs = [];
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        pairs.push({ a: valid[i], b: valid[j], correlation: matrix[i][j] });
      }
    }
    pairs.sort((x, y) => y.correlation - x.correlation);
    const offDiagonal = pairs.map((p) => p.correlation);
    const avg = offDiagonal.length ? offDiagonal.reduce((a, b) => a + b, 0) / offDiagonal.length : 0;
    const result = {
      available: true,
      symbols: valid,
      window: len,
      matrix,
      averageCorrelation: +avg.toFixed(3),
      mostCorrelated: pairs.slice(0, 3),
      leastCorrelated: pairs.slice(-3).reverse(),
      // Naive diversification read: high average correlation means the book
      // moves as one position regardless of how many tickers it holds.
      diversification: avg > 0.7 ? "Poor" : avg > 0.4 ? "Moderate" : "Good"
    };
    cacheSet(cacheKey, result, 9e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
async function buildPortfolioReturns(symbols, values, range = "2y") {
  const settled = await Promise.allSettled(symbols.map((s) => yahooCandles(s, "1d", range)));
  const seriesBySymbol = {};
  settled.forEach((r, i) => {
    if (r.status !== "fulfilled" || r.value.length < 30) return;
    const closes = r.value.map((c) => c.close);
    const rets = [];
    for (let j = 1; j < closes.length; j++) {
      if (closes[j] && closes[j - 1]) rets.push((closes[j] - closes[j - 1]) / closes[j - 1]);
    }
    seriesBySymbol[symbols[i]] = rets;
  });
  const valid = symbols.filter((s) => seriesBySymbol[s]);
  if (!valid.length) return null;
  const totalValue = valid.reduce((s, sym) => s + (values[symbols.indexOf(sym)] || 0), 0);
  if (totalValue <= 0) return null;
  const len = Math.min(...valid.map((s) => seriesBySymbol[s].length));
  const weights = valid.map((s) => (values[symbols.indexOf(s)] || 0) / totalValue);
  const portfolio = [];
  for (let t = 0; t < len; t++) {
    let r = 0;
    valid.forEach((s, i) => {
      const arr = seriesBySymbol[s];
      r += arr[arr.length - len + t] * weights[i];
    });
    portfolio.push(r);
  }
  return { portfolio, valid, weights, totalValue, seriesBySymbol, len };
}
var mean2 = (a) => a.reduce((x, y) => x + y, 0) / a.length;
var stdev2 = (a) => {
  const m = mean2(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1 || 1));
};
app.get("/api/v1/markets", async (req, res) => {
  try {
    const wanted = req.query.class;
    const list = wanted && INSTRUMENTS_BY_CLASS[wanted] ? INSTRUMENTS_BY_CLASS[wanted] : INSTRUMENTS;
    const cacheKey = `markets:${wanted || "all"}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const quotes = await yahooQuoteBatch(list.map((i) => i.symbol));
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
    const rows = list.map((i) => {
      const q = bySymbol.get(i.symbol);
      return {
        symbol: i.symbol,
        name: i.name,
        class: i.class,
        region: i.region,
        // Indices aren't tradeable; point at the liquid proxy instead.
        tradeable: i.tradeable || null,
        price: q?.price ?? null,
        change: q?.change ?? null,
        changePercent: q?.changePercent ?? null,
        volume: q?.volume ?? null
      };
    }).filter((r) => r.price != null);
    const byClass = {};
    for (const r of rows) (byClass[r.class] ||= []).push(r);
    for (const k of Object.keys(byClass)) {
      byClass[k].sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0));
    }
    const result = {
      classes: ASSET_CLASSES.filter((c) => byClass[c]?.length),
      byClass,
      count: rows.length,
      requested: list.length
    };
    cacheSet(cacheKey, result, 45e3);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/compare", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "SPY,QQQ").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 8);
    const range = ["1mo", "3mo", "6mo", "1y", "2y", "5y"].includes(req.query.range) ? req.query.range : "1y";
    if (symbols.length < 1) return res.json({ available: false, message: "No symbols" });
    const cacheKey = `compare:${symbols.join(",")}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const interval = range === "5y" ? "1wk" : range === "2y" ? "1d" : "1d";
    const settled = await Promise.allSettled(symbols.map((s) => yahooCandles(s, interval, range)));
    const raw = {};
    settled.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.length > 2) raw[symbols[i]] = r.value;
    });
    const valid = symbols.filter((s) => raw[s]);
    if (!valid.length) return res.json({ available: false, message: "No price history" });
    const len = Math.min(...valid.map((s) => raw[s].length));
    const base = {};
    valid.forEach((s) => {
      base[s] = raw[s][raw[s].length - len].close;
    });
    const anchor = raw[valid[0]].slice(-len);
    const series = anchor.map((c, idx) => {
      const point = { time: c.time };
      valid.forEach((s) => {
        const bar = raw[s][raw[s].length - len + idx];
        point[s] = bar && base[s] ? +((bar.close - base[s]) / base[s] * 100).toFixed(2) : null;
      });
      return point;
    });
    const stats = valid.map((s) => {
      const bars = raw[s].slice(-len);
      const closes = bars.map((b) => b.close).filter(Boolean);
      const totalReturn = (closes[closes.length - 1] - closes[0]) / closes[0] * 100;
      const rets = [];
      for (let i = 1; i < closes.length; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      const m = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
      const sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / (rets.length - 1 || 1));
      const periodsPerYear = interval === "1wk" ? 52 : 252;
      const vol = sd * Math.sqrt(periodsPerYear) * 100;
      let peak = closes[0], maxDD = 0;
      for (const c of closes) {
        if (c > peak) peak = c;
        maxDD = Math.max(maxDD, (peak - c) / peak);
      }
      const years = len / periodsPerYear;
      const annualised = years > 0 ? (Math.pow(closes[closes.length - 1] / closes[0], 1 / years) - 1) * 100 : 0;
      const meta = INSTRUMENT_BY_SYMBOL[s];
      return {
        symbol: s,
        name: meta?.name || s,
        class: meta?.class || null,
        totalReturn: +totalReturn.toFixed(2),
        annualisedReturn: +annualised.toFixed(2),
        volatility: +vol.toFixed(2),
        maxDrawdown: +(maxDD * 100).toFixed(2),
        // Excess return per unit of risk, 4.5% cash proxy.
        sharpe: vol ? +((annualised - 4.5) / vol).toFixed(2) : null
      };
    }).sort((a, b) => b.totalReturn - a.totalReturn);
    const result = { available: true, symbols: valid, range, points: series.length, series, stats };
    cacheSet(cacheKey, result, 3e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/analytics/var", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 15);
    const values = (req.query.values || "").split(",").map((v) => parseFloat(v) || 0);
    const confidence = Math.min(Math.max(parseFloat(req.query.confidence) || 95, 50), 99.9);
    const horizon = Math.min(Math.max(parseInt(req.query.horizon) || 1, 1), 30);
    if (symbols.length < 1) return res.json({ available: false, message: "No positions" });
    const cacheKey = `var:${symbols.join(",")}:${values.join(",")}:${confidence}:${horizon}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const built = await buildPortfolioReturns(symbols, values);
    if (!built || built.portfolio.length < 30) {
      return res.json({ available: false, message: "Insufficient price history" });
    }
    const { portfolio, totalValue, valid } = built;
    const alpha = 1 - confidence / 100;
    const scale = Math.sqrt(horizon);
    const mu = mean2(portfolio);
    const sigma = stdev2(portfolio);
    const sorted = [...portfolio].sort((a, b) => a - b);
    const idx = Math.max(0, Math.floor(alpha * sorted.length) - 1);
    const histRet = sorted[idx];
    const tail = sorted.slice(0, Math.max(idx + 1, 1));
    const cvarRet = mean2(tail);
    const invNorm2 = (p) => {
      const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
      const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
      const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
      const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
      const pl = 0.02425;
      if (p < pl) {
        const q2 = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q2 + c[1]) * q2 + c[2]) * q2 + c[3]) * q2 + c[4]) * q2 + c[5]) / ((((d[0] * q2 + d[1]) * q2 + d[2]) * q2 + d[3]) * q2 + 1);
      }
      if (p > 1 - pl) {
        const q2 = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0] * q2 + c[1]) * q2 + c[2]) * q2 + c[3]) * q2 + c[4]) * q2 + c[5]) / ((((d[0] * q2 + d[1]) * q2 + d[2]) * q2 + d[3]) * q2 + 1);
      }
      const q = p - 0.5, r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    };
    const z = invNorm2(alpha);
    const paramRet = mu + z * sigma;
    const SIMS = 1e4;
    const sims = [];
    for (let i = 0; i < SIMS; i++) {
      const u1 = Math.random() || 1e-9, u2 = Math.random();
      const zz = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      sims.push(mu + sigma * zz);
    }
    sims.sort((a, b) => a - b);
    const mcRet = sims[Math.max(0, Math.floor(alpha * SIMS) - 1)];
    const toMoney = (r) => +(Math.abs(r) * scale * totalValue).toFixed(2);
    const toPct = (r) => +(Math.abs(r) * scale * 100).toFixed(2);
    const historical = toMoney(histRet), parametric = toMoney(paramRet), monteCarlo = toMoney(mcRet);
    const fatTails = historical > parametric * 1.05;
    const result = {
      available: true,
      symbols: valid,
      portfolioValue: +totalValue.toFixed(2),
      confidence,
      horizon,
      observations: portfolio.length,
      var: {
        historical: { amount: historical, percent: toPct(histRet) },
        parametric: { amount: parametric, percent: toPct(paramRet) },
        monteCarlo: { amount: monteCarlo, percent: toPct(mcRet) }
      },
      cvar: { amount: toMoney(cvarRet), percent: toPct(cvarRet) },
      dailyVolatility: +(sigma * 100).toFixed(2),
      annualisedVolatility: +(sigma * Math.sqrt(252) * 100).toFixed(2),
      fatTails,
      worstDay: +(sorted[0] * 100).toFixed(2),
      bestDay: +(sorted[sorted.length - 1] * 100).toFixed(2)
    };
    cacheSet(cacheKey, result, 9e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/analytics/optimize", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 12);
    const values = (req.query.values || "").split(",").map((v) => parseFloat(v) || 0);
    const range = ["1y", "2y", "5y"].includes(req.query.range) ? req.query.range : "2y";
    if (symbols.length < 2) return res.json({ available: false, message: "Need at least 2 holdings" });
    const cacheKey = `optimize:${symbols.join(",")}:${values.join(",")}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const [settled, rfObs] = await Promise.all([
      Promise.allSettled(symbols.map((s) => yahooCandles(s, "1d", range))),
      fredFetch("DGS3MO", { limit: 5 }).catch(() => null)
    ]);
    const retsBy = {};
    settled.forEach((r, i) => {
      if (r.status !== "fulfilled" || r.value.length < 60) return;
      const closes = r.value.map((c) => c.close);
      const out = [];
      for (let j = 1; j < closes.length; j++) {
        if (closes[j] && closes[j - 1]) out.push((closes[j] - closes[j - 1]) / closes[j - 1]);
      }
      retsBy[symbols[i]] = out;
    });
    const valid = symbols.filter((s) => retsBy[s]);
    if (valid.length < 2) return res.json({ available: false, message: "Insufficient price history" });
    const len = Math.min(...valid.map((s) => retsBy[s].length));
    const series = valid.map((s) => retsBy[s].slice(-len));
    const cov = covariance(series);
    const meanDaily = series.map((s) => s.reduce((a, b) => a + b, 0) / s.length);
    const rfAnnual = (() => {
      const v = (rfObs || []).find((o) => o.value !== ".");
      return v ? parseFloat(v.value) / 100 : 0.045;
    })();
    const frontier = efficientFrontier(cov, meanDaily, rfAnnual / 252, 24);
    if (!frontier) return res.json({ available: false, message: "Covariance matrix is singular (holdings too similar)" });
    const ann = (w) => {
      const r = w.reduce((s, v, i) => s + v * meanDaily[i], 0) * 252 * 100;
      const risk = Math.sqrt(portfolioVariance(w, cov)) * Math.sqrt(252) * 100;
      return { return: +r.toFixed(2), risk: +risk.toFixed(2), sharpe: risk ? +((r - rfAnnual * 100) / risk).toFixed(2) : null };
    };
    const describe = (w, label) => w && {
      label,
      weights: valid.map((s, i) => ({ symbol: s, weight: +(w[i] * 100).toFixed(2) })),
      ...ann(w),
      // Negative weights are short positions; long-only investors can't hold these.
      requiresShorting: w.some((x) => x < -1e-4)
    };
    const totalValue = valid.reduce((s, sym) => s + (values[symbols.indexOf(sym)] || 0), 0);
    const currentW = totalValue > 0 ? valid.map((s) => (values[symbols.indexOf(s)] || 0) / totalValue) : valid.map(() => 1 / valid.length);
    const equalW = valid.map(() => 1 / valid.length);
    const result = {
      available: true,
      symbols: valid,
      range,
      observations: len,
      riskFreeRate: +(rfAnnual * 100).toFixed(2),
      frontier: frontier.points.map((p) => ({
        risk: +(p.risk * Math.sqrt(252) * 100).toFixed(3),
        return: +(p.return * 252 * 100).toFixed(3)
      })),
      portfolios: {
        current: describe(currentW, totalValue > 0 ? "Current" : "Equal weight (no values)"),
        minVariance: describe(frontier.minVariance, "Minimum variance"),
        maxSharpe: describe(frontier.tangency, "Maximum Sharpe"),
        equalWeight: describe(equalW, "Equal weight")
      },
      methodology: "Unconstrained Markowitz mean-variance on daily returns; expected returns are historical averages."
    };
    cacheSet(cacheKey, result, 9e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/valuation/dcf", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AAPL").toUpperCase();
    const num = (v, fallback) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    const growthRaw = num(req.query.growth, null);
    const growth = growthRaw == null ? null : clamp(growthRaw, -50, 100);
    const wacc = clamp(num(req.query.wacc, 9), 3, 30);
    const terminal = clamp(num(req.query.terminal, 2.5), 0, 6);
    const years = clamp(Math.round(num(req.query.years, 5)), 3, 10);
    const cacheKey = `dcf:${symbol}:${growth}:${wacc}:${terminal}:${years}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const [fin, profile, quote] = await Promise.all([
      finnhubFetch(`/stock/financials-reported?symbol=${symbol}&freq=annual`),
      finnhubFetch(`/stock/profile2?symbol=${symbol}`),
      yahooQuote(symbol).catch(() => null)
    ]);
    const reports = (fin?.data || []).slice(0, 6);
    if (!reports.length) {
      const meta = INSTRUMENT_BY_SYMBOL[symbol];
      const isFund = meta && meta.class !== "Index";
      return res.json({
        symbol,
        available: false,
        message: meta ? `${symbol} is ${isFund ? "a fund/ETF" : "an index"}, not an operating company \u2014 a DCF needs company cash flows. Select a stock.` : "No filings available for this symbol"
      });
    }
    const pick = (report, patterns) => {
      const cf = report.report?.cf || [];
      for (const p of patterns) {
        const hit = cf.find((i) => p.test(i.concept || "") || p.test(i.label || ""));
        if (hit && typeof hit.value === "number") return hit.value;
      }
      return null;
    };
    const history = reports.map((r) => {
      const ocf = pick(r, [
        /NetCashProvidedByUsedInOperatingActivities$/i,
        /NetCashProvidedByUsedInOperatingActivitiesContinuingOperations/i,
        /cash generated by operating activities/i,
        /net cash.*operating/i
      ]);
      const capex = pick(r, [
        /PaymentsToAcquirePropertyPlantAndEquipment/i,
        /PaymentsToAcquireProductiveAssets/i,
        /purchases? of property/i,
        /capital expenditure/i
      ]);
      return {
        year: r.year,
        operatingCashFlow: ocf,
        capex: capex != null ? Math.abs(capex) : null,
        freeCashFlow: ocf != null && capex != null ? ocf - Math.abs(capex) : null
      };
    }).filter((h) => h.freeCashFlow != null);
    if (history.length < 2) {
      return res.json({ symbol, available: false, message: "Could not derive free cash flow from filings" });
    }
    const latestFcf = history[0].freeCashFlow;
    const oldest = history[history.length - 1];
    const spanYears = Math.max(history[0].year - oldest.year, 1);
    const histCagr = oldest.freeCashFlow > 0 && latestFcf > 0 ? (Math.pow(latestFcf / oldest.freeCashFlow, 1 / spanYears) - 1) * 100 : null;
    const growthPct = growth != null ? growth : histCagr != null ? Math.max(Math.min(histCagr, 15), -5) : 5;
    const shares = profile?.shareOutstanding ? profile.shareOutstanding * 1e6 : null;
    const price = quote?.price ?? null;
    const runDcf = (g, w, tg) => {
      if (w / 100 <= tg / 100) return null;
      let pv = 0;
      let fcf = latestFcf;
      const flows = [];
      for (let t = 1; t <= years; t++) {
        fcf = fcf * (1 + g / 100);
        const disc = fcf / Math.pow(1 + w / 100, t);
        pv += disc;
        flows.push({ year: t, fcf, discounted: disc });
      }
      const terminalFcf = fcf * (1 + tg / 100);
      const terminalValue = terminalFcf / (w / 100 - tg / 100);
      const pvTerminal = terminalValue / Math.pow(1 + w / 100, years);
      const enterprise = pv + pvTerminal;
      return {
        flows,
        pvExplicit: pv,
        terminalValue,
        pvTerminal,
        enterprise,
        perShare: shares ? enterprise / shares : null
      };
    };
    const base = runDcf(growthPct, wacc, terminal);
    if (!base) return res.json({ symbol, available: false, message: "WACC must exceed terminal growth" });
    const waccRange = [-2, -1, 0, 1, 2].map((d) => +(wacc + d).toFixed(1));
    const termRange = [-1, -0.5, 0, 0.5, 1].map((d) => +(terminal + d).toFixed(1));
    const sensitivity = waccRange.map((w) => ({
      wacc: w,
      cells: termRange.map((tg) => {
        const r = runDcf(growthPct, w, tg);
        return { terminal: tg, perShare: r?.perShare != null ? +r.perShare.toFixed(2) : null };
      })
    }));
    const fair = base.perShare;
    const result = {
      symbol,
      available: true,
      assumptions: {
        growthPercent: +growthPct.toFixed(2),
        wacc,
        terminalGrowth: terminal,
        years,
        historicalFcfCagr: histCagr != null ? +histCagr.toFixed(2) : null
      },
      history: history.map((h) => ({
        ...h,
        freeCashFlow: +(h.freeCashFlow / 1e9).toFixed(2),
        operatingCashFlow: +(h.operatingCashFlow / 1e9).toFixed(2),
        capex: +(h.capex / 1e9).toFixed(2)
      })),
      latestFcfBillions: +(latestFcf / 1e9).toFixed(2),
      sharesOutstanding: shares,
      enterpriseValueBillions: +(base.enterprise / 1e9).toFixed(2),
      terminalSharePercent: +(base.pvTerminal / base.enterprise * 100).toFixed(1),
      fairValuePerShare: fair != null ? +fair.toFixed(2) : null,
      currentPrice: price,
      upsidePercent: fair != null && price ? +((fair - price) / price * 100).toFixed(1) : null,
      termRange,
      sensitivity,
      methodology: "FCF = operating cash flow \u2212 capex, grown at the assumed rate, discounted at WACC, with a Gordon-growth terminal value."
    };
    cacheSet(cacheKey, result, 36e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/portfolio/performance", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
    const values = (req.query.values || "").split(",").map((v) => parseFloat(v) || 0);
    const costs = (req.query.costs || "").split(",").map((v) => parseFloat(v) || 0);
    const benchmark = (req.query.benchmark || "SPY").toUpperCase();
    const range = ["1mo", "3mo", "6mo", "1y", "2y"].includes(req.query.range) ? req.query.range : "1y";
    if (!symbols.length) return res.json({ available: false, message: "No positions" });
    const cacheKey = `perf:${symbols.join(",")}:${values.join(",")}:${costs.join(",")}:${benchmark}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const [settled, benchCandles] = await Promise.all([
      Promise.allSettled(symbols.map((s) => yahooCandles(s, "1d", range))),
      yahooCandles(benchmark, "1d", range).catch(() => [])
    ]);
    const totalValue = values.reduce((a, b) => a + b, 0);
    if (totalValue <= 0) return res.json({ available: false, message: "No position values" });
    const positions = [];
    symbols.forEach((s, i) => {
      const r = settled[i];
      if (r.status !== "fulfilled" || r.value.length < 2) return;
      const closes = r.value.map((c) => c.close).filter(Boolean);
      const periodReturn = (closes[closes.length - 1] - closes[0]) / closes[0] * 100;
      const weight = values[i] / totalValue;
      const cost = costs[i] || 0;
      positions.push({
        symbol: s,
        sector: SYMBOL_SECTOR[s] || INSTRUMENT_BY_SYMBOL[s]?.class || "Other",
        value: values[i],
        weight: +(weight * 100).toFixed(2),
        periodReturn: +periodReturn.toFixed(2),
        // Contribution = weight x return. These sum to the portfolio return,
        // which is what makes attribution additive and auditable.
        contribution: +(weight * periodReturn).toFixed(3),
        // Since-inception P&L where a cost basis was supplied.
        unrealisedPercent: cost > 0 ? +((values[i] - cost) / cost * 100).toFixed(2) : null
      });
    });
    if (!positions.length) return res.json({ available: false, message: "No price history" });
    const portfolioReturn = positions.reduce((s, p) => s + p.contribution, 0);
    const bCloses = benchCandles.map((c) => c.close).filter(Boolean);
    const benchReturn = bCloses.length > 1 ? (bCloses[bCloses.length - 1] - bCloses[0]) / bCloses[0] * 100 : null;
    const bySector = {};
    for (const p of positions) {
      const s = bySector[p.sector] ||= { sector: p.sector, weight: 0, contribution: 0, positions: 0 };
      s.weight += p.weight;
      s.contribution += p.contribution;
      s.positions++;
    }
    const sectors = Object.values(bySector).map((s) => ({
      ...s,
      weight: +s.weight.toFixed(2),
      contribution: +s.contribution.toFixed(3)
    })).sort((a, b) => b.contribution - a.contribution);
    const sorted = [...positions].sort((a, b) => b.contribution - a.contribution);
    const result = {
      available: true,
      range,
      benchmark,
      portfolioValue: +totalValue.toFixed(2),
      portfolioReturn: +portfolioReturn.toFixed(2),
      benchmarkReturn: benchReturn != null ? +benchReturn.toFixed(2) : null,
      excessReturn: benchReturn != null ? +(portfolioReturn - benchReturn).toFixed(2) : null,
      positions: sorted,
      sectors,
      topContributors: sorted.slice(0, 5),
      topDetractors: sorted.slice(-5).reverse().filter((p) => p.contribution < 0),
      methodology: "Contribution = position weight x period return; contributions sum to the portfolio return."
    };
    cacheSet(cacheKey, result, 3e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var FACTOR_DEFS = [
  {
    key: "market",
    name: "Market",
    long: "SPY",
    short: null,
    desc: "Broad equity market exposure (beta)."
  },
  {
    key: "size",
    name: "Size",
    long: "IWM",
    short: "SPY",
    desc: "Small-cap minus large-cap. Positive = tilted to smaller companies."
  },
  {
    key: "value",
    name: "Value",
    long: "IWD",
    short: "IWF",
    desc: "Value minus growth. Negative = tilted to growth names."
  },
  {
    key: "momentum",
    name: "Momentum",
    long: "MTUM",
    short: "SPY",
    desc: "Momentum minus market. Positive = chasing recent winners."
  },
  {
    key: "quality",
    name: "Quality",
    long: "QUAL",
    short: "SPY",
    desc: "Quality minus market. Positive = profitable, low-leverage firms."
  },
  {
    key: "lowVol",
    name: "Low Volatility",
    long: "USMV",
    short: "SPY",
    desc: "Min-vol minus market. Positive = defensive tilt."
  }
];
app.get("/api/v1/analytics/factors", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 15);
    const values = (req.query.values || "").split(",").map((v) => parseFloat(v) || 0);
    const range = ["1y", "2y", "5y"].includes(req.query.range) ? req.query.range : "2y";
    if (!symbols.length) return res.json({ available: false, message: "No positions" });
    const cacheKey = `factors:${symbols.join(",")}:${values.join(",")}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const legs = [...new Set(FACTOR_DEFS.flatMap((f) => [f.long, f.short]).filter(Boolean))];
    const [built, legCandles, rfObs] = await Promise.all([
      buildPortfolioReturns(symbols, values, range),
      Promise.allSettled(legs.map((s) => yahooCandles(s, "1d", range))),
      fredFetch("DGS3MO", { limit: 5 }).catch(() => null)
    ]);
    if (!built) return res.json({ available: false, message: "Insufficient price history" });
    const retsOf = (candles) => {
      const out = [];
      for (let i = 1; i < candles.length; i++) {
        if (candles[i].close && candles[i - 1].close) {
          out.push((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
        }
      }
      return out;
    };
    const legReturns = {};
    legCandles.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.length > 30) legReturns[legs[i]] = retsOf(r.value);
    });
    const usable = FACTOR_DEFS.filter(
      (f) => legReturns[f.long] && (!f.short || legReturns[f.short])
    );
    if (usable.length < 2) return res.json({ available: false, message: "Factor proxy data unavailable" });
    const rfAnnual = (() => {
      const v = (rfObs || []).find((o) => o.value !== ".");
      return v ? parseFloat(v.value) / 100 : 0.045;
    })();
    const rfDaily = rfAnnual / 252;
    const len = Math.min(
      built.portfolio.length,
      ...usable.flatMap((f) => [legReturns[f.long].length, f.short ? legReturns[f.short].length : Infinity]).filter((n) => isFinite(n))
    );
    if (len < 60) return res.json({ available: false, message: "Need at least 60 overlapping observations" });
    const tail = (arr) => arr.slice(-len);
    const portExcess = tail(built.portfolio).map((r) => r - rfDaily);
    const X = [];
    for (let t = 0; t < len; t++) {
      X.push(usable.map((f) => {
        const l = tail(legReturns[f.long])[t];
        return f.short ? l - tail(legReturns[f.short])[t] : l - rfDaily;
      }));
    }
    const fit = ols(X, portExcess);
    if (!fit) return res.json({ available: false, message: "Regression failed (collinear factors)" });
    const exposures = usable.map((f, i) => {
      const t = fit.tStats[i];
      const p = pValue(t, fit.dof);
      return {
        key: f.key,
        name: f.name,
        description: f.desc,
        proxy: f.short ? `${f.long} \u2212 ${f.short}` : f.long,
        beta: +fit.coefficients[i].toFixed(3),
        tStat: t == null ? null : +t.toFixed(2),
        pValue: p,
        // Only call a tilt real when it clears conventional significance.
        significant: p != null && p < 0.05
      };
    });
    const alphaAnnual = fit.intercept * 252 * 100;
    const alphaP = pValue(fit.interceptT, fit.dof);
    const result = {
      available: true,
      symbols: built.valid,
      range,
      observations: fit.n,
      riskFreeRate: +(rfAnnual * 100).toFixed(2),
      exposures,
      alpha: {
        annualisedPercent: +alphaAnnual.toFixed(2),
        tStat: fit.interceptT == null ? null : +fit.interceptT.toFixed(2),
        pValue: alphaP,
        significant: alphaP != null && alphaP < 0.05
      },
      rSquared: +fit.r2.toFixed(4),
      adjRSquared: +fit.adjR2.toFixed(4),
      // Share of variance the factors do NOT explain — stock-specific risk.
      idiosyncraticShare: +((1 - fit.r2) * 100).toFixed(1),
      residualVolAnnual: +(fit.residualStd * Math.sqrt(252) * 100).toFixed(2),
      methodology: "OLS of daily excess returns on ETF-proxied long/short factor spreads."
    };
    cacheSet(cacheKey, result, 9e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var STRESS_SCENARIOS = [
  { id: "gfc2008", name: "2008 Financial Crisis", marketShock: -46, note: "S&P 500 peak-to-trough, Sep 2008 \u2013 Mar 2009" },
  { id: "covid2020", name: "COVID Crash 2020", marketShock: -33.9, note: "S&P 500, 19 Feb \u2013 23 Mar 2020" },
  { id: "rates2022", name: "2022 Rate Shock", marketShock: -25.4, note: "S&P 500, Jan \u2013 Oct 2022" },
  { id: "dotcom2000", name: "Dot-com Bust", marketShock: -49.1, note: "S&P 500, Mar 2000 \u2013 Oct 2002" },
  { id: "blackmonday", name: "Black Monday", marketShock: -20.5, note: "S&P 500, single day, 19 Oct 1987" },
  { id: "correction10", name: "Standard Correction", marketShock: -10, note: "Textbook 10% market correction" }
];
app.get("/api/v1/analytics/stress", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 15);
    const values = (req.query.values || "").split(",").map((v) => parseFloat(v) || 0);
    if (symbols.length < 1) return res.json({ available: false, message: "No positions" });
    const cacheKey = `stress:${symbols.join(",")}:${values.join(",")}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const [built, spyCandles] = await Promise.all([
      buildPortfolioReturns(symbols, values),
      yahooCandles("SPY", "1d", "2y").catch(() => [])
    ]);
    if (!built || spyCandles.length < 30) {
      return res.json({ available: false, message: "Insufficient price history" });
    }
    const spyRets = [];
    for (let i = 1; i < spyCandles.length; i++) {
      if (spyCandles[i].close && spyCandles[i - 1].close) {
        spyRets.push((spyCandles[i].close - spyCandles[i - 1].close) / spyCandles[i - 1].close);
      }
    }
    const { valid, seriesBySymbol, totalValue } = built;
    const betaOf = (sym) => {
      const arr = seriesBySymbol[sym];
      const n = Math.min(arr.length, spyRets.length);
      const a = arr.slice(-n), b = spyRets.slice(-n);
      const ma = mean2(a), mb = mean2(b);
      let cov = 0, varb = 0;
      for (let i = 0; i < n; i++) {
        cov += (a[i] - ma) * (b[i] - mb);
        varb += (b[i] - mb) ** 2;
      }
      return varb ? cov / varb : 1;
    };
    const holdings = valid.map((s) => {
      const value = values[symbols.indexOf(s)] || 0;
      return { symbol: s, value, beta: +betaOf(s).toFixed(2) };
    });
    const portfolioBeta = totalValue ? +holdings.reduce((s, h) => s + h.beta * (h.value / totalValue), 0).toFixed(2) : 1;
    const scenarios = STRESS_SCENARIOS.map((sc) => {
      const impacts = holdings.map((h) => {
        const shockPct = h.beta * sc.marketShock;
        return { symbol: h.symbol, beta: h.beta, shockPercent: +shockPct.toFixed(2), pnl: +(h.value * shockPct / 100).toFixed(2) };
      });
      const totalPnl = impacts.reduce((s, i) => s + i.pnl, 0);
      return {
        ...sc,
        portfolioShockPercent: totalValue ? +(totalPnl / totalValue * 100).toFixed(2) : 0,
        pnl: +totalPnl.toFixed(2),
        endValue: +(totalValue + totalPnl).toFixed(2),
        worstHolding: impacts.slice().sort((a, b) => a.pnl - b.pnl)[0] || null,
        impacts
      };
    });
    const result = {
      available: true,
      portfolioValue: +totalValue.toFixed(2),
      portfolioBeta,
      holdings,
      scenarios,
      // Beta is estimated from ~2y of daily data and is itself unstable in a
      // crisis (correlations converge to 1), so this understates tail risk.
      methodology: "Beta-adjusted shock propagation vs SPY, betas from 2y daily returns."
    };
    cacheSet(cacheKey, result, 9e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var CURVE_TENORS = [
  { id: "DGS1MO", label: "1M", years: 1 / 12 },
  { id: "DGS3MO", label: "3M", years: 0.25 },
  { id: "DGS6MO", label: "6M", years: 0.5 },
  { id: "DGS1", label: "1Y", years: 1 },
  { id: "DGS2", label: "2Y", years: 2 },
  { id: "DGS3", label: "3Y", years: 3 },
  { id: "DGS5", label: "5Y", years: 5 },
  { id: "DGS7", label: "7Y", years: 7 },
  { id: "DGS10", label: "10Y", years: 10 },
  { id: "DGS20", label: "20Y", years: 20 },
  { id: "DGS30", label: "30Y", years: 30 }
];
app.get("/api/v1/yieldcurve", async (req, res) => {
  try {
    const cached = cacheGet("yieldcurve");
    if (cached) return res.json(cached);
    const series = await Promise.all(
      CURVE_TENORS.map((t) => fredFetch(t.id, { limit: 400, sort: "desc" }).catch(() => null))
    );
    const pickBack = (obs, daysAgo) => {
      if (!obs) return null;
      const target = Date.now() - daysAgo * 864e5;
      const hit = obs.find((o) => o.value !== "." && new Date(o.date).getTime() <= target);
      return hit ? parseFloat(hit.value) : null;
    };
    const points = CURVE_TENORS.map((t, i) => {
      const obs = (series[i] || []).filter((o) => o.value !== ".");
      const latest = obs[0] ? parseFloat(obs[0].value) : null;
      return {
        tenor: t.label,
        years: t.years,
        seriesId: t.id,
        current: latest,
        monthAgo: pickBack(obs, 30),
        yearAgo: pickBack(obs, 365),
        date: obs[0]?.date || null
      };
    });
    const get = (label) => points.find((p) => p.tenor === label)?.current ?? null;
    const spread = (a, b) => a != null && b != null ? +(a - b).toFixed(2) : null;
    const s10y2y = spread(get("10Y"), get("2Y"));
    const s10y3m = spread(get("10Y"), get("3M"));
    const s30y10y = spread(get("30Y"), get("10Y"));
    const inverted = [s10y2y, s10y3m].filter((v) => v != null && v < 0).length > 0;
    const shape = s10y2y == null ? "unknown" : s10y2y < 0 ? "Inverted" : s10y2y < 0.5 ? "Flat" : "Normal";
    const result = {
      points: points.filter((p) => p.current != null),
      spreads: { "10Y-2Y": s10y2y, "10Y-3M": s10y3m, "30Y-10Y": s30y10y },
      inverted,
      shape,
      asOf: points.find((p) => p.date)?.date || null
    };
    cacheSet(result.points.length ? "yieldcurve" : "skip", result, 36e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/comps", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AAPL").toUpperCase();
    const cacheKey = `comps:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const peerList = await finnhubFetch(`/stock/peers?symbol=${symbol}`);
    if (!Array.isArray(peerList) || !peerList.length) {
      return res.json({ symbol, available: false, message: "No peers found" });
    }
    const symbols = [symbol, ...peerList.filter((p) => p !== symbol)].slice(0, 8);
    const [metricResults, quotes] = await Promise.all([
      Promise.allSettled(symbols.map((s) => finnhubFetch(`/stock/metric?symbol=${s}&metric=all`))),
      yahooQuoteBatch(symbols)
    ]);
    const quoteBy = new Map(quotes.map((q) => [q.symbol, q]));
    const rows = symbols.map((s, i) => {
      const m = metricResults[i].status === "fulfilled" ? metricResults[i].value?.metric || {} : {};
      const q = quoteBy.get(s);
      return {
        symbol: s,
        isSubject: s === symbol,
        price: q?.price ?? null,
        changePercent: q?.changePercent ?? null,
        marketCap: m["marketCapitalization"] ?? null,
        peRatio: m["peBasicExclExtraTTM"] ?? m["peTTM"] ?? null,
        pbRatio: m["pbAnnual"] ?? null,
        psRatio: m["psAnnual"] ?? null,
        evToEbitda: m["enterpriseValueOverEBITDATTM"] ?? null,
        grossMargin: m["grossMarginTTM"] ?? null,
        netMargin: m["netProfitMarginTTM"] ?? null,
        roe: m["roeTTM"] ?? null,
        revenueGrowth: m["revenueGrowthTTMYoy"] ?? null,
        debtToEquity: m["totalDebt/totalEquityAnnual"] ?? null
      };
    }).filter((r) => r.price != null || r.marketCap != null);
    const peers = rows.filter((r) => !r.isSubject);
    const median = (key3) => {
      const vals = peers.map((r) => r[key3]).filter((v) => v != null && isFinite(v)).sort((a, b) => a - b);
      if (!vals.length) return null;
      const mid = Math.floor(vals.length / 2);
      return +(vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2).toFixed(2);
    };
    const METRICS = ["peRatio", "pbRatio", "psRatio", "evToEbitda", "grossMargin", "netMargin", "roe", "revenueGrowth", "debtToEquity"];
    const medians = Object.fromEntries(METRICS.map((k) => [k, median(k)]));
    const subject = rows.find((r) => r.isSubject);
    const premium = {};
    for (const k of METRICS) {
      const sv = subject?.[k], mv = medians[k];
      premium[k] = sv != null && mv != null && mv !== 0 ? +((sv - mv) / Math.abs(mv) * 100).toFixed(1) : null;
    }
    const result = { symbol, available: true, rows, medians, premium, peerCount: peers.length };
    cacheSet(cacheKey, result, 144e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/breadth", async (req, res) => {
  try {
    const cached = cacheGet("breadth");
    if (cached) return res.json(cached);
    const quotes = await yahooQuoteBatch(SP500_ALL);
    const valid = quotes.filter((q) => q.price != null && q.changePercent != null);
    if (valid.length < 20) {
      return res.json({ available: false, message: "Insufficient quote coverage" });
    }
    const advancing = valid.filter((q) => q.changePercent > 0).length;
    const declining = valid.filter((q) => q.changePercent < 0).length;
    const unchanged = valid.length - advancing - declining;
    const bySector = {};
    for (const q of valid) {
      const sec = SYMBOL_SECTOR[q.symbol];
      if (!sec) continue;
      if (!bySector[sec]) bySector[sec] = { advancing: 0, declining: 0, total: 0, sumChange: 0 };
      const s = bySector[sec];
      s.total++;
      s.sumChange += q.changePercent;
      if (q.changePercent > 0) s.advancing++;
      else if (q.changePercent < 0) s.declining++;
    }
    const sectors = Object.entries(bySector).map(([name, s]) => ({
      name,
      advancing: s.advancing,
      declining: s.declining,
      total: s.total,
      breadthPct: +(s.advancing / s.total * 100).toFixed(1),
      avgChange: +(s.sumChange / s.total).toFixed(2)
    })).sort((a, b) => b.breadthPct - a.breadthPct);
    const sorted = [...valid].sort((a, b) => b.changePercent - a.changePercent);
    const adRatio = declining ? +(advancing / declining).toFixed(2) : null;
    const breadthPct = +(advancing / valid.length * 100).toFixed(1);
    const result = {
      available: true,
      universe: valid.length,
      advancing,
      declining,
      unchanged,
      advanceDeclineRatio: adRatio,
      breadthPct,
      // Broad participation vs a handful of names carrying the index.
      signal: breadthPct >= 65 ? "Broad advance" : breadthPct >= 55 ? "Positive" : breadthPct >= 45 ? "Mixed" : breadthPct >= 35 ? "Negative" : "Broad decline",
      avgChange: +(valid.reduce((s, q) => s + q.changePercent, 0) / valid.length).toFixed(2),
      topGainers: sorted.slice(0, 5).map((q) => ({ symbol: q.symbol, changePercent: +q.changePercent.toFixed(2), price: q.price })),
      topLosers: sorted.slice(-5).reverse().map((q) => ({ symbol: q.symbol, changePercent: +q.changePercent.toFixed(2), price: q.price })),
      sectors
    };
    cacheSet("breadth", result, 12e4);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/technical", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AAPL").toUpperCase();
    const cacheKey = `technical:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const candles = await yahooCandles(symbol, "1d", "1y").catch(() => []);
    const result = computeTechnical(candles, symbol);
    if (!result.available) return res.json(result);
    cacheSet(cacheKey, result, 3e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/screener", async (req, res) => {
  try {
    const { sector, minPE, maxPE, minChange, maxChange } = req.query;
    const cacheKey = `screener:${sector || "all"}:${minPE || ""}:${maxPE || ""}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    let symbols = [];
    if (sector && SP500_BY_SECTOR[sector]) {
      symbols = SP500_BY_SECTOR[sector].slice(0, 30);
    } else {
      symbols = Object.values(SP500_BY_SECTOR).flatMap((list) => list.slice(0, 10));
    }
    const results = await Promise.allSettled(symbols.map((s) => yahooQuote(s)));
    let stocks = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    if (minChange) stocks = stocks.filter((s) => s.changePercent >= parseFloat(minChange));
    if (maxChange) stocks = stocks.filter((s) => s.changePercent <= parseFloat(maxChange));
    stocks.sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
    cacheSet(cacheKey, stocks, 3e5);
    res.json(stocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/sectors", async (req, res) => {
  try {
    const period = req.query.period || "3mo";
    const cacheKey = `sectors:${period}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const sectorETFs = {
      "Technology": "XLK",
      "Financial": "XLF",
      "Healthcare": "XLV",
      "Energy": "XLE",
      "Consumer Discretionary": "XLY",
      "Consumer Staples": "XLP",
      "Industrials": "XLI",
      "Materials": "XLB",
      "Real Estate": "XLRE",
      "Utilities": "XLU",
      "Communication": "XLC"
    };
    const spyResult = await yahooCandles("SPY", "1d", period).catch(() => []);
    const spyStart = spyResult[0]?.close || 1;
    const spyEnd = spyResult[spyResult.length - 1]?.close || spyStart;
    const spyReturn = (spyEnd - spyStart) / spyStart * 100;
    const entries = Object.entries(sectorETFs);
    const results = await Promise.allSettled(
      entries.map(([, etf]) => yahooCandles(etf, "1d", period))
    );
    const sectors = entries.map(([name, etf], i) => {
      const r = results[i];
      if (r.status !== "fulfilled" || r.value.length < 2) {
        return { name, etf, performance: 0, relativeStrength: 0 };
      }
      const candles = r.value;
      const startPrice = candles[0].close;
      const endPrice = candles[candles.length - 1].close;
      const performance = (endPrice - startPrice) / startPrice * 100;
      return {
        name,
        etf,
        performance: +performance.toFixed(2),
        relativeStrength: +(performance - spyReturn).toFixed(2)
      };
    });
    sectors.sort((a, b) => b.performance - a.performance);
    const result = { period, spyReturn: +spyReturn.toFixed(2), sectors };
    cacheSet(cacheKey, result, 6e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/risk", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "AAPL,MSFT,GOOGL").split(",").map((s) => s.trim().toUpperCase());
    const cacheKey = `risk:${symbols.join(",")}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const [spyCandles, ...stockCandles] = await Promise.all([
      yahooCandles("SPY", "1d", "1y"),
      ...symbols.map((s) => yahooCandles(s, "1d", "1y").catch(() => []))
    ]);
    const calcReturns = (candles) => {
      const returns = [];
      for (let i = 1; i < candles.length; i++) {
        if (candles[i].close && candles[i - 1].close) {
          returns.push((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
        }
      }
      return returns;
    };
    const spyReturns = calcReturns(spyCandles);
    const mean3 = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const stdDev = (arr) => {
      const m = mean3(arr);
      return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
    };
    let portfolioReturns = new Array(spyReturns.length).fill(0);
    const weight = 1 / symbols.length;
    const stockStats = [];
    for (let si = 0; si < symbols.length; si++) {
      const returns = calcReturns(stockCandles[si]);
      if (returns.length === 0) continue;
      const minLen = Math.min(returns.length, spyReturns.length);
      for (let i = 0; i < minLen; i++) portfolioReturns[i] += returns[i] * weight;
      const covariance2 = (() => {
        const mr = mean3(returns.slice(0, minLen));
        const ms = mean3(spyReturns.slice(0, minLen));
        return returns.slice(0, minLen).reduce((s, v, i) => s + (v - mr) * (spyReturns[i] - ms), 0) / minLen;
      })();
      const spyVar = (() => {
        const m = mean3(spyReturns.slice(0, minLen));
        return spyReturns.slice(0, minLen).reduce((s, v) => s + (v - m) ** 2, 0) / minLen;
      })();
      const beta = spyVar ? covariance2 / spyVar : 1;
      stockStats.push({ symbol: symbols[si], beta: +beta.toFixed(2), volatility: +(stdDev(returns) * Math.sqrt(252) * 100).toFixed(2) });
    }
    portfolioReturns = portfolioReturns.filter((r) => r !== 0);
    const portVol = stdDev(portfolioReturns) * Math.sqrt(252) * 100;
    const portReturn = mean3(portfolioReturns) * 252 * 100;
    const sharpe2 = portVol ? (portReturn - 4.5) / portVol : 0;
    let maxDD = 0, peak = 1;
    let cumulative = 1;
    for (const r of portfolioReturns) {
      cumulative *= 1 + r;
      if (cumulative > peak) peak = cumulative;
      const dd = (peak - cumulative) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    const portfolioBeta = stockStats.reduce((s, st) => s + st.beta, 0) / (stockStats.length || 1);
    const result = {
      symbols,
      portfolioBeta: +portfolioBeta.toFixed(2),
      sharpeRatio: +sharpe2.toFixed(2),
      volatility: +portVol.toFixed(2),
      maxDrawdown: +(maxDD * 100).toFixed(2),
      annualizedReturn: +portReturn.toFixed(2),
      stocks: stockStats
    };
    cacheSet(cacheKey, result, 9e5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/options", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AAPL").toUpperCase();
    const date = req.query.date || "";
    const cacheKey = `options:${symbol}:${date}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const empty = { symbol, expirationDates: [], currentPrice: null, calls: [], puts: [] };
    const auth = await getYahooAuth();
    let chain = null;
    for (const host of ["query2.finance.yahoo.com", "query1.finance.yahoo.com"]) {
      try {
        const crumbParam = auth?.crumb ? `${date ? "&" : "?"}crumb=${encodeURIComponent(auth.crumb)}` : "";
        const url = `https://${host}/v7/finance/options/${symbol}${date ? `?date=${date}` : ""}${crumbParam}`;
        const headers = { "User-Agent": "Mozilla/5.0", "Accept": "application/json" };
        if (auth?.cookie) headers["Cookie"] = auth.cookie;
        const resp = await fetch2(url, { headers });
        if (!resp.ok) continue;
        const data = await resp.json();
        chain = data.optionChain?.result?.[0];
        if (chain) break;
      } catch {
      }
    }
    if (!chain) {
      cacheSet(cacheKey, empty, 6e4);
      return res.json(empty);
    }
    const spot = chain.quote?.regularMarketPrice || null;
    const riskFree = await (async () => {
      try {
        const obs = await fredFetch("DGS3MO", { limit: 5 });
        const v = (obs || []).find((o) => o.value !== ".");
        return v ? parseFloat(v.value) / 100 : 0.045;
      } catch {
        return 0.045;
      }
    })();
    const mapContract = (type) => (c) => {
      const base = {
        strike: c.strike,
        lastPrice: c.lastPrice,
        bid: c.bid,
        ask: c.ask,
        change: c.change,
        percentChange: c.percentChange,
        volume: c.volume || 0,
        openInterest: c.openInterest || 0,
        impliedVolatility: c.impliedVolatility,
        inTheMoney: c.inTheMoney,
        expiration: c.expiration,
        contractSymbol: c.contractSymbol
      };
      if (spot == null || !c.expiration || !c.strike) return base;
      const T = yearsToExpiry(c.expiration);
      const mid = c.bid != null && c.ask != null && c.bid > 0 && c.ask > 0 ? (c.bid + c.ask) / 2 : c.lastPrice;
      const iv = (mid > 0 ? impliedVol(type, mid, spot, c.strike, T, riskFree) : null) ?? c.impliedVolatility ?? null;
      return {
        ...base,
        computedIV: iv != null ? +iv.toFixed(4) : null,
        greeks: iv ? greeks(type, spot, c.strike, T, riskFree, iv) : null
      };
    };
    const calls = (chain.options?.[0]?.calls || []).map(mapContract("call"));
    const puts = (chain.options?.[0]?.puts || []).map(mapContract("put"));
    const sum = (arr, k) => arr.reduce((s, c) => s + (c[k] || 0), 0);
    const callVol = sum(calls, "volume"), putVol = sum(puts, "volume");
    const callOI = sum(calls, "openInterest"), putOI = sum(puts, "openInterest");
    let maxPain = null;
    if (calls.length && puts.length) {
      const strikes = [...new Set([...calls, ...puts].map((c) => c.strike))].sort((a, b) => a - b);
      let best = null;
      for (const K of strikes) {
        const callLoss = calls.reduce((s, c) => s + Math.max(K - c.strike, 0) * (c.openInterest || 0), 0);
        const putLoss = puts.reduce((s, p) => s + Math.max(p.strike - K, 0) * (p.openInterest || 0), 0);
        const total = callLoss + putLoss;
        if (best == null || total < best.total) best = { strike: K, total };
      }
      maxPain = best?.strike ?? null;
    }
    const result = {
      symbol,
      expirationDates: chain.expirations || [],
      currentPrice: spot,
      riskFreeRate: +(riskFree * 100).toFixed(2),
      calls,
      puts,
      sentiment: {
        putCallVolumeRatio: callVol ? +(putVol / callVol).toFixed(3) : null,
        putCallOIRatio: callOI ? +(putOI / callOI).toFixed(3) : null,
        totalCallVolume: callVol,
        totalPutVolume: putVol,
        maxPain
      }
    };
    cacheSet(cacheKey, result, 12e4);
    res.json(result);
  } catch (err) {
    res.json({ symbol: (req.query.symbol || "AAPL").toUpperCase(), expirationDates: [], currentPrice: null, calls: [], puts: [] });
  }
});
var botFetchTechnical = async (symbol) => {
  const resp = await fetch2(`http://127.0.0.1:${port}/api/v1/technical?symbol=${symbol}`);
  return resp.ok ? resp.json() : null;
};
var botFetchNews = async (symbol) => {
  const resp = await fetch2(`http://127.0.0.1:${port}/api/v1/news?symbol=${symbol}&limit=5`);
  return resp.ok ? resp.json() : [];
};
app.get("/api/v1/bot/status", async (req, res) => {
  try {
    const state2 = getState();
    let account = null, positions = [], clock = null;
    if (state2.brokerConfigured) {
      [account, positions, clock] = await Promise.all([
        getAccount().catch(() => null),
        getPositions().catch(() => []),
        getClock().catch(() => null)
      ]);
    }
    res.json({ ...state2, account, positions, marketOpen: clock?.isOpen ?? null, nextOpen: clock?.nextOpen ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/v1/bot/toggle", (req, res) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be boolean" });
  const result = setEnabled(enabled);
  res.status(result.ok ? 200 : 409).json({ ...result, state: getState() });
});
app.post("/api/v1/bot/config", (req, res) => {
  res.json(updateConfig(req.body || {}));
});
app.post("/api/v1/bot/reset-halt", (req, res) => {
  res.json({ ...resetHalt(), state: getState() });
});
app.post("/api/v1/bot/run", async (req, res) => {
  try {
    const result = await runCycle({
      fetchTechnical: botFetchTechnical,
      fetchNews: botFetchNews,
      dryRun: Boolean(req.body?.dryRun)
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/v1/bot/kill", async (req, res) => {
  try {
    res.json({ ...await killSwitch(), state: getState() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/bot/decisions", (req, res) => {
  res.json(getDecisions(parseInt(req.query.limit) || 50));
});
app.get("/api/v1/bot/audit", (req, res) => {
  res.json(getAudit(parseInt(req.query.limit) || 50));
});
app.get("/api/v1/bot/orders", async (req, res) => {
  try {
    res.json(await getOrders(req.query.status || "all", parseInt(req.query.limit) || 50));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/bot/backtest", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "SPY").toUpperCase();
    const range = ["1y", "2y", "5y", "10y"].includes(req.query.range) ? req.query.range : "5y";
    const mode = ["single", "walkforward", "sweep"].includes(req.query.mode) ? req.query.mode : "single";
    const threshold = Number(req.query.threshold);
    const strategies = req.query.strategies ? String(req.query.strategies).split(",").filter(Boolean) : void 0;
    const cacheKey = `bt:${symbol}:${range}:${mode}:${req.query.strategies || ""}:${req.query.threshold || ""}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const candles = await yahooCandles(symbol, "1d", range).catch(() => []);
    if (candles.length < 250) {
      return res.json({ available: false, message: `Only ${candles.length} bars for ${symbol}; need 250+` });
    }
    const opts = {
      symbol,
      warmup: 200,
      ...strategies?.length ? { strategies } : {},
      ...Number.isFinite(threshold) ? { threshold } : {}
    };
    const result = mode === "walkforward" ? walkForward(candles, { ...opts, folds: 4 }) : mode === "sweep" ? sweepStrategies(candles, opts) : runBacktest(candles, opts);
    cacheSet(cacheKey, { mode, symbol, range, ...result }, 36e5);
    res.json({ mode, symbol, range, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/v1/bot/train", async (req, res) => {
  try {
    const body = req.body || {};
    const symbol = (body.symbol || "AAPL").toUpperCase();
    const range = ["2y", "5y", "10y"].includes(body.range) ? body.range : "5y";
    const candles = await yahooCandles(symbol, "1d", range).catch(() => []);
    if (candles.length < 300) {
      return res.json({ ok: false, error: `Only ${candles.length} bars for ${symbol}; need 300+` });
    }
    const result = trainAndRegister(candles, {
      symbol,
      range,
      modelType: body.modelType || "logistic",
      label: {
        up: Number(body.up) || 0.03,
        down: Number(body.down) || 0.02,
        horizon: parseInt(body.horizon) || 10
      },
      testFraction: Number(body.testFraction) || 0.3
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/v1/bot/models", (req, res) => res.json(listTrained()));
app.get("/api/v1/bot/models/published", (req, res) => res.json(listPublished()));
app.get("/api/v1/bot/models/:id", (req, res) => {
  const m = getModel(req.params.id);
  if (!m) return res.status(404).json({ error: "Model not found" });
  res.json(m);
});
app.post("/api/v1/bot/models/:id/publish", (req, res) => {
  const result = publishModel(req.params.id);
  res.status(result.ok ? 200 : 409).json(result);
});
app.post("/api/v1/bot/models/:id/unpublish", (req, res) => {
  res.json(unpublish(req.params.id));
});
var server_default = app;
var isDirectRun = process.argv[1] && (process.argv[1].endsWith("server.js") || process.argv[1].endsWith("server"));
if (isDirectRun) {
  app.listen(port, () => {
    console.log(`QuantBloom Terminal API running on http://localhost:${port}`);
  });
}

// api/_build-entry.js
function handler(req, res) {
  server_default(req, res);
}
export {
  handler as default
};
