// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
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

// server.js
dotenv.config();
var app = express();
var port = process.env.API_PORT || 3001;
app.use(cors());
app.use(express.json());
var cache = /* @__PURE__ */ new Map();
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}
function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiry: Date.now() + ttlMs });
}
function envAny(...names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  const lowered = names.map((n) => n.toLowerCase());
  for (const [key, value] of Object.entries(process.env)) {
    if (value && lowered.includes(key.toLowerCase())) return value;
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
    const cookieResp = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
    });
    const setCookie = cookieResp.headers.get("set-cookie");
    const cookie = setCookie ? setCookie.split(";")[0] : "";
    if (!cookie) return null;
    const crumbResp = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
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
      const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Cookie": auth.cookie } });
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
  const resp = await fetch(
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
  const resp = await fetch(
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
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { middle: mean, upper: mean + mult * sd, lower: mean - mult * sd, bandwidth: 2 * mult * sd / mean * 100 };
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
async function finnhubFetch(path) {
  if (!FINNHUB_KEY) return null;
  const resp = await fetch(`https://finnhub.io/api/v1${path}&token=${FINNHUB_KEY}`);
  if (!resp.ok) return null;
  return resp.json();
}
async function fredFetch(seriesId, options = {}) {
  if (!FRED_KEY) return null;
  const limit = options.limit || 30;
  const sort = options.sort || "desc";
  const resp = await fetch(
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=${sort}&limit=${limit}`
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.observations || [];
}
async function fredSeriesInfo(seriesId) {
  if (!FRED_KEY) return null;
  const resp = await fetch(
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
  const resp = await fetch(url);
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
        const resp = await fetch(url, { headers });
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
  const resp = await fetch(
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
      "1M": { interval: "1mo", range: "5y", ttl: 55e3 }
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
        const resp = await fetch(
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
      const key = a.headline?.toLowerCase().slice(0, 60);
      if (!key || seen.has(key)) return false;
      seen.add(key);
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
    await Promise.all(rateSeriesIds.map(async (id) => {
      try {
        const obs = await fredFetch(id, { limit: 5 });
        if (obs?.length) {
          const latest = obs.find((o) => o.value !== ".");
          const prev = obs.find((o, i) => i > 0 && o.value !== ".");
          results[id] = {
            name: FRED_SERIES[id].name,
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
    await Promise.all(marketIds.map(async (id) => {
      try {
        const obs = await fredFetch(id, { limit: 10 });
        if (obs?.length) {
          const latest = obs.find((o) => o.value !== ".");
          const prev = obs.find((o, i) => i > 0 && o.value !== ".");
          results[id] = {
            name: FRED_SERIES[id].name,
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
    await Promise.all(macroIds.map(async (id) => {
      try {
        const obs = await fredFetch(id, { limit: 5 });
        if (obs?.length) {
          const latest = obs.find((o) => o.value !== ".");
          const prev = obs.find((o, i) => i > 0 && o.value !== ".");
          results[id] = {
            name: FRED_SERIES[id].name,
            category: FRED_SERIES[id].category,
            frequency: FRED_SERIES[id].frequency,
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
app.get("/api/v1/technical", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AAPL").toUpperCase();
    const cacheKey = `technical:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const candles = await yahooCandles(symbol, "1d", "1y").catch(() => []);
    if (candles.length < 30) {
      return res.json({ symbol, available: false, message: "Insufficient price history" });
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
      const mean = tp.reduce((a, b) => a + b, 0) / period;
      const meanDev = tp.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
      const currentTP = tp[tp.length - 1];
      return meanDev ? (currentTP - mean) / (0.015 * meanDev) : 0;
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
    const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const stdDev = (arr) => {
      const m = mean(arr);
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
      const covariance = (() => {
        const mr = mean(returns.slice(0, minLen));
        const ms = mean(spyReturns.slice(0, minLen));
        return returns.slice(0, minLen).reduce((s, v, i) => s + (v - mr) * (spyReturns[i] - ms), 0) / minLen;
      })();
      const spyVar = (() => {
        const m = mean(spyReturns.slice(0, minLen));
        return spyReturns.slice(0, minLen).reduce((s, v) => s + (v - m) ** 2, 0) / minLen;
      })();
      const beta = spyVar ? covariance / spyVar : 1;
      stockStats.push({ symbol: symbols[si], beta: +beta.toFixed(2), volatility: +(stdDev(returns) * Math.sqrt(252) * 100).toFixed(2) });
    }
    portfolioReturns = portfolioReturns.filter((r) => r !== 0);
    const portVol = stdDev(portfolioReturns) * Math.sqrt(252) * 100;
    const portReturn = mean(portfolioReturns) * 252 * 100;
    const sharpe = portVol ? (portReturn - 4.5) / portVol : 0;
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
      sharpeRatio: +sharpe.toFixed(2),
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
        const resp = await fetch(url, { headers });
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
    const mapContract = (c) => ({
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
    });
    const result = {
      symbol,
      expirationDates: chain.expirations || [],
      currentPrice: chain.quote?.regularMarketPrice || null,
      calls: (chain.options?.[0]?.calls || []).map(mapContract),
      puts: (chain.options?.[0]?.puts || []).map(mapContract)
    };
    cacheSet(cacheKey, result, 12e4);
    res.json(result);
  } catch (err) {
    res.json({ symbol: (req.query.symbol || "AAPL").toUpperCase(), expirationDates: [], currentPrice: null, calls: [], puts: [] });
  }
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
