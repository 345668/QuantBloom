import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { SP500_BY_SECTOR, MARKET_INDICES, SP500_ALL, SYMBOL_SECTOR } from './sp500.js';
import { INSTRUMENTS, INSTRUMENTS_BY_CLASS, INSTRUMENT_BY_SYMBOL, ASSET_CLASSES } from './instruments.js';
import { greeks as bsGreeks, impliedVol, yearsToExpiry } from './blackscholes.js';
import { ols, pValue } from './regression.js';
import { covariance, efficientFrontier, portfolioVariance, minVariancePortfolio, tangencyPortfolio } from './portfolio-math.js';
import * as bot from './bot/engine.js';
import * as broker from './bot/alpaca.js';

dotenv.config();

const app = express();
const port = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Cache Service — in-memory JS Map with per-key TTLs
// ---------------------------------------------------------------------------
const cache = new Map();

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

// ---------------------------------------------------------------------------
// API Keys
//
// Env var names vary between local .env files and hosting dashboards (casing,
// suffixes). Resolve each key from a list of accepted names, falling back to a
// case-insensitive lookup so e.g. `Finnhub` and `FINNHUB_API_KEY` both work.
// ---------------------------------------------------------------------------
function envAny(...names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  const lowered = names.map(n => n.toLowerCase());
  for (const [key, value] of Object.entries(process.env)) {
    if (value && lowered.includes(key.toLowerCase())) return value;
  }
  return undefined;
}

const FINNHUB_KEY = envAny('FINNHUB_API_KEY', 'FINNHUB_KEY', 'FINNHUB');
const NEWSAPI_KEY = envAny('NEWSAPI_KEY', 'NEWS_API_KEY', 'NEWSAPI');
const FRED_KEY = envAny('FRED_API_KEY', 'FRED_KEY', 'FRED');
const ALPHA_VANTAGE_KEY = envAny('ALPHA_VANTAGE_API_KEY', 'ALPHAVANTAGE_API_KEY', 'ALPHA_VANTAGE_KEY');
const MARKETAUX_KEY = envAny('MARKETAUX_API_KEY', 'MARKETAUX_KEY', 'MARKETAUX');

// Surface which providers resolved a key — makes deploys debuggable without
// ever logging the secret itself.
console.log('[keys]', {
  finnhub: !!FINNHUB_KEY, newsapi: !!NEWSAPI_KEY, fred: !!FRED_KEY,
  alphaVantage: !!ALPHA_VANTAGE_KEY, marketaux: !!MARKETAUX_KEY,
});

// ---------------------------------------------------------------------------
// Heatmap Constituents — top names per GICS sector, sampled from the S&P 500.
// (The full per-sector universe lives in sp500.js and powers the screener.)
// ---------------------------------------------------------------------------
const HEATMAP_CONSTITUENTS = Object.fromEntries(
  Object.entries(SP500_BY_SECTOR).map(([sector, symbols]) => [sector, symbols.slice(0, 8)])
);

// ---------------------------------------------------------------------------
// Sentiment tagging
// ---------------------------------------------------------------------------
const BULLISH_WORDS = /\b(beat|surge|rally|record|upgrade|buy|growth|profit|soar|gain|jump|rise|boost|strong|bullish|outperform|breakout)\b/i;
const BEARISH_WORDS = /\b(miss|drop|fall|cut|downgrade|sell|loss|layoff|crash|decline|slump|weak|plunge|sink|bearish|underperform|breakdown)\b/i;

function tagSentiment(headline) {
  if (BULLISH_WORDS.test(headline)) return 'bullish';
  if (BEARISH_WORDS.test(headline)) return 'bearish';
  return 'neutral';
}

function extractSymbol(headline) {
  const allSymbols = Object.values(HEATMAP_CONSTITUENTS).flat();
  for (const sym of allSymbols) {
    if (headline.includes(sym) || headline.includes(sym.replace('-', ''))) return sym;
  }
  const match = headline.match(/\b([A-Z]{2,5})\b/);
  if (match && allSymbols.includes(match[1])) return match[1];
  return null;
}

// ---------------------------------------------------------------------------
// Yahoo Finance helpers (using v8 chart API — no API key needed)
// ---------------------------------------------------------------------------
// Yahoo crumb + cookie — required by the options endpoint. Cached in-process.
// ---------------------------------------------------------------------------
let yahooAuth = null; // { cookie, crumb, expiry }

async function getYahooAuth() {
  if (yahooAuth && Date.now() < yahooAuth.expiry) return yahooAuth;
  try {
    // 1. Hit the homepage to receive a session cookie.
    const cookieResp = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });
    const setCookie = cookieResp.headers.get('set-cookie');
    const cookie = setCookie ? setCookie.split(';')[0] : '';
    if (!cookie) return null;

    // 2. Exchange the cookie for a crumb.
    const crumbResp = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie },
    });
    const crumb = await crumbResp.text();
    if (!crumb || crumb.includes('<')) return null;

    yahooAuth = { cookie, crumb, expiry: Date.now() + 3600000 };
    return yahooAuth;
  } catch {
    return null;
  }
}

// Fetch Yahoo quoteSummary modules (profile, financials, analyst data, ...).
// Free, no API key — used as a fallback for Finnhub premium-only endpoints.
async function yahooQuoteSummary(symbol, modules) {
  const auth = await getYahooAuth();
  if (!auth) return null;
  for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
    try {
      const url = `https://${host}/v10/finance/quoteSummary/${symbol}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': auth.cookie } });
      if (!resp.ok) continue;
      const data = await resp.json();
      const result = data.quoteSummary?.result?.[0];
      if (result) return result;
    } catch { /* try next host */ }
  }
  return null;
}

async function yahooQuote(symbol) {
  const resp = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
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
  const changePercent = prev ? (change / prev) * 100 : 0;
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
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
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
  })).filter(c => c.open !== null && c.close !== null);
}

// ---------------------------------------------------------------------------
// Technical indicator maths — computed from candle data so we never depend on
// a premium data feed. All functions take arrays of numbers (oldest first).
// ---------------------------------------------------------------------------
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
  for (let i = period; i < values.length; i++) { e = values[i] * k + e * (1 - k); out.push(e); }
  return out;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
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
  // Align the two EMA series to the same (shorter) length.
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
  return { middle: mean, upper: mean + mult * sd, lower: mean - mult * sd, bandwidth: (2 * mult * sd) / mean * 100 };
}

function stochastic(highs, lows, closes, period = 14, smooth = 3) {
  if (closes.length < period + smooth) return null;
  const kSeries = [];
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    kSeries.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
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
  const smooth = arr => arr.slice(-period).reduce((a, b) => a + b, 0);
  const atrSum = smooth(tr) || 1;
  const plusDI = (smooth(plusDM) / atrSum) * 100;
  const minusDI = (smooth(minusDM) / atrSum) * 100;
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1) * 100;
  return { adx: dx, plusDI, minusDI };
}

// Pivot points (classic) from the most recent completed candle.
function pivotPoints(high, low, close) {
  const p = (high + low + close) / 3;
  return {
    pivot: p,
    r1: 2 * p - low, r2: p + (high - low), r3: high + 2 * (p - low),
    s1: 2 * p - high, s2: p - (high - low), s3: low - 2 * (high - p),
  };
}

// ---------------------------------------------------------------------------
// Finnhub helpers
// ---------------------------------------------------------------------------
async function finnhubFetch(path) {
  if (!FINNHUB_KEY) return null;
  const resp = await fetch(`https://finnhub.io/api/v1${path}&token=${FINNHUB_KEY}`);
  if (!resp.ok) return null;
  return resp.json();
}

// ---------------------------------------------------------------------------
// FRED helpers (Federal Reserve Economic Data)
// ---------------------------------------------------------------------------
async function fredFetch(seriesId, options = {}) {
  if (!FRED_KEY) return null;
  const limit = options.limit || 30;
  const sort = options.sort || 'desc';
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

// Key FRED series for day trading context
const FRED_SERIES = {
  DFF: { name: 'Fed Funds Rate', category: 'rates', frequency: 'daily' },
  DGS2: { name: '2-Year Treasury', category: 'rates', frequency: 'daily' },
  DGS10: { name: '10-Year Treasury', category: 'rates', frequency: 'daily' },
  DGS30: { name: '30-Year Treasury', category: 'rates', frequency: 'daily' },
  T10Y2Y: { name: '10Y-2Y Spread', category: 'rates', frequency: 'daily' },
  T10YFF: { name: '10Y-FF Spread', category: 'rates', frequency: 'daily' },
  VIXCLS: { name: 'VIX', category: 'volatility', frequency: 'daily' },
  DTWEXBGS: { name: 'USD Index (Broad)', category: 'forex', frequency: 'daily' },
  DCOILWTICO: { name: 'WTI Crude Oil', category: 'commodities', frequency: 'daily' },
  DCOILBRENTEU: { name: 'Brent Crude Oil', category: 'commodities', frequency: 'daily' },
  GOLDAMGBD228NLBM: { name: 'Gold Price (London)', category: 'commodities', frequency: 'daily' },
  UNRATE: { name: 'Unemployment Rate', category: 'labor', frequency: 'monthly' },
  CPIAUCSL: { name: 'CPI (All Urban)', category: 'inflation', frequency: 'monthly' },
  PCEPI: { name: 'PCE Price Index', category: 'inflation', frequency: 'monthly' },
  GDPC1: { name: 'Real GDP', category: 'output', frequency: 'quarterly' },
  FEDFUNDS: { name: 'Effective Fed Funds', category: 'rates', frequency: 'monthly' },
  BAMLH0A0HYM2: { name: 'High Yield Spread', category: 'credit', frequency: 'daily' },
  UMCSENT: { name: 'Consumer Sentiment', category: 'sentiment', frequency: 'monthly' },
  IC4WSA: { name: 'Initial Claims (4wk avg)', category: 'labor', frequency: 'weekly' },
};

// ---------------------------------------------------------------------------
// Marketaux helpers (news)
// ---------------------------------------------------------------------------
async function marketauxFetch(params = {}) {
  if (!MARKETAUX_KEY) return null;
  const qs = new URLSearchParams({
    api_token: MARKETAUX_KEY,
    language: 'en',
    limit: String(params.limit || 20),
    ...params,
  });
  delete qs.api_token; // re-add properly
  const url = `https://api.marketaux.com/v1/news/all?api_token=${MARKETAUX_KEY}&language=en&limit=${params.limit || 20}${params.symbols ? `&symbols=${params.symbols}` : ''}${params.filter_entities ? `&filter_entities=true` : ''}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.data || [];
}

// ---------------------------------------------------------------------------
// Batched quotes — Yahoo's v7/finance/quote takes comma-separated symbols, so
// hundreds of tickers cost a handful of requests instead of hundreds. Required
// before any wide-universe feature (ticker tape, breadth, full screener).
// ---------------------------------------------------------------------------
const QUOTE_BATCH_SIZE = 50;

async function yahooQuoteBatch(symbols) {
  if (!symbols.length) return [];
  const auth = await getYahooAuth();
  const out = [];

  for (let i = 0; i < symbols.length; i += QUOTE_BATCH_SIZE) {
    const chunk = symbols.slice(i, i + QUOTE_BATCH_SIZE);
    let got = false;

    for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
      try {
        const crumbParam = auth?.crumb ? `&crumb=${encodeURIComponent(auth.crumb)}` : '';
        const url = `https://${host}/v7/finance/quote?symbols=${chunk.join(',')}${crumbParam}`;
        const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };
        if (auth?.cookie) headers['Cookie'] = auth.cookie;
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
            volume: r.regularMarketVolume ?? 0,
          });
        }
        got = true;
        break;
      } catch { /* try next host */ }
    }

    // If the batch endpoint refused this chunk, fall back to per-symbol chart
    // calls so a crumb failure degrades rather than blanks the response.
    if (!got) {
      const settled = await Promise.allSettled(chunk.map(s => yahooQuote(s)));
      for (const r of settled) if (r.status === 'fulfilled') out.push(r.value);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Alpha Vantage helpers (fallback quote/candle source)
// ---------------------------------------------------------------------------
async function alphaVantageQuote(symbol) {
  if (!ALPHA_VANTAGE_KEY) return null;
  const resp = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  const q = data['Global Quote'];
  if (!q || !q['05. price']) return null;
  return {
    symbol,
    price: parseFloat(q['05. price']),
    change: parseFloat(q['09. change']),
    changePercent: parseFloat(q['10. change percent']?.replace('%', '')),
    volume: parseInt(q['06. volume']),
    name: symbol,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/v1/quotes?symbols=AAPL,TSLA
app.get('/api/v1/quotes', async (req, res) => {
  try {
    const symbols = (req.query.symbols || 'AAPL').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const cacheKey = `quotes:${symbols.join(',')}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    // One batched request per 50 symbols instead of one per symbol.
    const fetched = await yahooQuoteBatch(symbols);
    const bySymbol = new Map(fetched.map(q => [q.symbol, q]));

    // Preserve the requested order and fill gaps via Alpha Vantage.
    const quotes = await Promise.all(symbols.map(async (sym) => {
      const hit = bySymbol.get(sym);
      if (hit) return hit;
      try {
        const av = await alphaVantageQuote(sym);
        if (av) return av;
      } catch {}
      return { symbol: sym, price: null, change: 0, changePercent: 0, volume: 0, error: true };
    }));

    cacheSet(cacheKey, quotes, 8000);
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/ticker?limit=120 — S&P 500 quotes for the scrolling ticker tape.
// Sampled round-robin across sectors so the tape isn't all mega-cap tech.
// ---------------------------------------------------------------------------
app.get('/api/v1/ticker', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 120, SP500_ALL.length);
    const cacheKey = `ticker:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    // Interleave sectors: take the 1st of each, then the 2nd of each, ...
    const lists = Object.values(SP500_BY_SECTOR);
    const symbols = [];
    for (let i = 0; symbols.length < limit; i++) {
      let added = false;
      for (const list of lists) {
        if (i < list.length && symbols.length < limit) { symbols.push(list[i]); added = true; }
      }
      if (!added) break;
    }

    const quotes = (await yahooQuoteBatch(symbols))
      .filter(q => q.price != null)
      .map(q => ({
        symbol: q.symbol, price: q.price,
        change: q.change, changePercent: q.changePercent,
        sector: SYMBOL_SECTOR[q.symbol] || null,
      }));

    cacheSet(cacheKey, quotes, 30000);
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/candles?symbol=AAPL&resolution=15m&range=1d
app.get('/api/v1/candles', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'AAPL').toUpperCase();
    const resolution = req.query.resolution || '15m';
    const range = req.query.range || '1d';
    const cacheKey = `candles:${symbol}:${resolution}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const resolutionMap = {
      '1m': { interval: '1m', range: '1d', ttl: 12000 },
      '5m': { interval: '5m', range: '5d', ttl: 12000 },
      '15m': { interval: '15m', range: '5d', ttl: 12000 },
      '1h': { interval: '60m', range: '1mo', ttl: 12000 },
      '1D': { interval: '1d', range: '6mo', ttl: 55000 },
      '1W': { interval: '1wk', range: '2y', ttl: 55000 },
      '1M': { interval: '1mo', range: '5y', ttl: 55000 },
      // Longer horizons: daily bars over a year reads well, weekly over
      // five years keeps the series a sane length.
      '1Y': { interval: '1d', range: '1y', ttl: 55000 },
      '5Y': { interval: '1wk', range: '5y', ttl: 300000 },
    };
    const config = resolutionMap[resolution] || resolutionMap['15m'];
    const candles = await yahooCandles(symbol, config.interval, range !== '1d' ? range : config.range);
    const result = { symbol, resolution, candles };
    cacheSet(cacheKey, result, config.ttl);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
  }
});

// GET /api/v1/news?limit=20
app.get('/api/v1/news', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const symbol = (req.query.symbol || '').toUpperCase().trim();
    const cacheKey = `news:${symbol || 'general'}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const articles = [];

    // Finnhub news — company-specific when a symbol is given, else general.
    if (FINNHUB_KEY) {
      try {
        let finnNews;
        if (symbol) {
          const from = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
          const to = new Date().toISOString().slice(0, 10);
          finnNews = await finnhubFetch(`/company-news?symbol=${symbol}&from=${from}&to=${to}`);
        } else {
          finnNews = await finnhubFetch('/news?category=general');
        }
        if (Array.isArray(finnNews)) {
          finnNews.slice(0, limit).forEach(a => {
            articles.push({
              id: `fh-${a.id}`,
              headline: a.headline,
              source: a.source,
              url: a.url,
              image: a.image || null,
              publishedAt: new Date(a.datetime * 1000).toISOString(),
              sentiment: tagSentiment(a.headline),
              sentimentSource: 'heuristic',
              relatedSymbol: symbol || extractSymbol(a.headline),
            });
          });
        }
      } catch {}
    }

    // Marketaux news (richer financial news with entity extraction)
    if (MARKETAUX_KEY && articles.length < limit) {
      try {
        const mxNews = await marketauxFetch({ limit: limit - articles.length, filter_entities: true, ...(symbol ? { symbols: symbol } : {}) });
        if (Array.isArray(mxNews)) {
          mxNews.forEach(a => {
            const existsAlready = articles.some(
              existing => existing.headline?.toLowerCase().slice(0, 50) === a.title?.toLowerCase().slice(0, 50)
            );
            if (!existsAlready && articles.length < limit * 2) {
              const entities = a.entities || [];
              const stockEntity = entities.find(e => e.type === 'equity');
              articles.push({
                id: `mx-${a.uuid}`,
                headline: a.title,
                source: a.source,
                url: a.url,
                image: a.image_url || null,
                publishedAt: a.published_at,
                sentiment: a.entities?.[0]?.sentiment_score > 0.2 ? 'bullish'
                  : a.entities?.[0]?.sentiment_score < -0.2 ? 'bearish' : tagSentiment(a.title || ''),
                sentimentSource: a.entities?.[0]?.sentiment_score != null ? 'marketaux' : 'heuristic',
                relatedSymbol: stockEntity?.symbol || extractSymbol(a.title || ''),
              });
            }
          });
        }
      } catch {}
    }

    // NewsAPI fallback/supplement
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
                source: a.source?.name || 'NewsAPI',
                url: a.url,
                image: a.urlToImage || null,
                publishedAt: a.publishedAt,
                sentiment: tagSentiment(a.title || ''),
                sentimentSource: 'heuristic',
                relatedSymbol: extractSymbol(a.title || ''),
              });
            }
          });
        }
      } catch {}
    }

    // Deduplicate by headline similarity
    const seen = new Set();
    const unique = articles.filter(a => {
      const key = a.headline?.toLowerCase().slice(0, 60);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    cacheSet(cacheKey, unique.slice(0, limit * 2), 55000);
    res.json(unique.slice(0, limit * 2));
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
  }
});

// GET /api/v1/heatmap
app.get('/api/v1/heatmap', async (req, res) => {
  try {
    const cached = cacheGet('heatmap');
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
    cacheSet('heatmap', sectors, 55000);
    res.json(sectors);
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
  }
});

// GET /api/v1/calendar?days=6
app.get('/api/v1/calendar', async (req, res) => {
  try {
    const cached = cacheGet('calendar');
    if (cached) return res.json(cached);

    const events = [];

    // Finnhub earnings calendar
    if (FINNHUB_KEY) {
      try {
        const from = new Date().toISOString().slice(0, 10);
        const to = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
        const data = await finnhubFetch(`/calendar/earnings?from=${from}&to=${to}`);
        if (data?.earningsCalendar) {
          data.earningsCalendar.slice(0, 20).forEach(e => {
            events.push({
              date: e.date,
              time: e.hour ? `${e.hour}:00` : 'TBD',
              type: 'earnings',
              title: `${e.symbol} Earnings`,
              symbol: e.symbol,
              expected: e.epsEstimate != null ? `$${e.epsEstimate}` : null,
              prior: e.epsActual != null ? `$${e.epsActual}` : null,
            });
          });
        }
      } catch {}
    }

    // Add some static macro events as a baseline
    const today = new Date();
    const staticEvents = [
      { offset: 0, time: '08:30', type: 'macro', title: 'Initial Jobless Claims', expected: '220K', prior: '215K' },
      { offset: 1, time: '10:00', type: 'macro', title: 'Consumer Sentiment', expected: '67.5', prior: '66.4' },
      { offset: 2, time: '14:00', type: 'fed', title: 'FOMC Meeting Minutes', expected: null, prior: null },
      { offset: 3, time: '08:30', type: 'macro', title: 'CPI MoM', expected: '0.3%', prior: '0.4%' },
      { offset: 4, time: '08:30', type: 'macro', title: 'PPI MoM', expected: '0.2%', prior: '0.1%' },
    ];
    staticEvents.forEach(se => {
      const d = new Date(today.getTime() + se.offset * 86400000);
      events.push({
        date: d.toISOString().slice(0, 10),
        time: se.time,
        type: se.type,
        title: se.title,
        symbol: null,
        expected: se.expected,
        prior: se.prior,
      });
    });

    events.sort((a, b) => {
      const da = new Date(`${a.date}T${a.time === 'TBD' ? '23:59' : a.time}`);
      const db = new Date(`${b.date}T${b.time === 'TBD' ? '23:59' : b.time}`);
      return da - db;
    });

    cacheSet('calendar', events, 3600000);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
  }
});

// GET /api/v1/search?q=AAPL
app.get('/api/v1/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toUpperCase();
    if (!q) return res.json([]);
    const cacheKey = `search:${q}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let results = [];

    if (FINNHUB_KEY) {
      try {
        const data = await finnhubFetch(`/search?q=${q}`);
        if (data?.result) {
          results = data.result
            .filter(r => r.type === 'Common Stock' || r.type === 'ETP')
            .slice(0, 10)
            .map(r => ({ symbol: r.symbol, name: r.description }));
        }
      } catch {}
    }

    if (!results.length) {
      // Fall back to the full S&P 500 universe: prefix matches first, then
      // any symbol containing the query.
      const prefix = SP500_ALL.filter(s => s.startsWith(q));
      const contains = SP500_ALL.filter(s => !s.startsWith(q) && s.includes(q));
      results = [...prefix, ...contains]
        .slice(0, 10)
        .map(s => ({ symbol: s, name: `${s} · ${SYMBOL_SECTOR[s] || 'S&P 500'}` }));
    }

    cacheSet(cacheKey, results, 300000);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// NEW: FRED Economic Data endpoints
// ---------------------------------------------------------------------------

// GET /api/v1/fred/rates — key interest rates & yield curve data
app.get('/api/v1/fred/rates', async (req, res) => {
  try {
    const cached = cacheGet('fred:rates');
    if (cached) return res.json(cached);

    const rateSeriesIds = ['DFF', 'DGS2', 'DGS10', 'DGS30', 'T10Y2Y', 'T10YFF'];
    const results = {};

    await Promise.all(rateSeriesIds.map(async (id) => {
      try {
        const obs = await fredFetch(id, { limit: 5 });
        if (obs?.length) {
          const latest = obs.find(o => o.value !== '.');
          const prev = obs.find((o, i) => i > 0 && o.value !== '.');
          results[id] = {
            name: FRED_SERIES[id].name,
            value: latest ? parseFloat(latest.value) : null,
            date: latest?.date,
            prior: prev ? parseFloat(prev.value) : null,
            priorDate: prev?.date,
            change: (latest && prev) ? parseFloat(latest.value) - parseFloat(prev.value) : null,
          };
        }
      } catch {}
    }));

    cacheSet('fred:rates', results, 300000);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/fred/market — VIX, USD, Oil, Gold
app.get('/api/v1/fred/market', async (req, res) => {
  try {
    const cached = cacheGet('fred:market');
    if (cached) return res.json(cached);

    const marketIds = ['VIXCLS', 'DTWEXBGS', 'DCOILWTICO', 'DCOILBRENTEU', 'GOLDAMGBD228NLBM'];
    const results = {};

    await Promise.all(marketIds.map(async (id) => {
      try {
        const obs = await fredFetch(id, { limit: 10 });
        if (obs?.length) {
          const latest = obs.find(o => o.value !== '.');
          const prev = obs.find((o, i) => i > 0 && o.value !== '.');
          results[id] = {
            name: FRED_SERIES[id].name,
            value: latest ? parseFloat(latest.value) : null,
            date: latest?.date,
            prior: prev ? parseFloat(prev.value) : null,
            change: (latest && prev) ? parseFloat(latest.value) - parseFloat(prev.value) : null,
            changePercent: (latest && prev && parseFloat(prev.value))
              ? ((parseFloat(latest.value) - parseFloat(prev.value)) / parseFloat(prev.value)) * 100 : null,
          };
        }
      } catch {}
    }));

    cacheSet('fred:market', results, 300000);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/fred/macro — unemployment, CPI, GDP, consumer sentiment
app.get('/api/v1/fred/macro', async (req, res) => {
  try {
    const cached = cacheGet('fred:macro');
    if (cached) return res.json(cached);

    const macroIds = ['UNRATE', 'CPIAUCSL', 'PCEPI', 'GDPC1', 'FEDFUNDS', 'BAMLH0A0HYM2', 'UMCSENT', 'IC4WSA'];
    const results = {};

    await Promise.all(macroIds.map(async (id) => {
      try {
        const obs = await fredFetch(id, { limit: 5 });
        if (obs?.length) {
          const latest = obs.find(o => o.value !== '.');
          const prev = obs.find((o, i) => i > 0 && o.value !== '.');
          results[id] = {
            name: FRED_SERIES[id].name,
            category: FRED_SERIES[id].category,
            frequency: FRED_SERIES[id].frequency,
            value: latest ? parseFloat(latest.value) : null,
            date: latest?.date,
            prior: prev ? parseFloat(prev.value) : null,
            priorDate: prev?.date,
            change: (latest && prev) ? parseFloat(latest.value) - parseFloat(prev.value) : null,
          };
        }
      } catch {}
    }));

    cacheSet('fred:macro', results, 600000);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/fred/series/:id?limit=30 — raw FRED series observations
app.get('/api/v1/fred/series/:id', async (req, res) => {
  try {
    const seriesId = req.params.id.toUpperCase();
    const limit = parseInt(req.query.limit) || 30;
    const cacheKey = `fred:series:${seriesId}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [obs, info] = await Promise.all([
      fredFetch(seriesId, { limit }),
      fredSeriesInfo(seriesId),
    ]);

    const result = {
      id: seriesId,
      title: info?.title || FRED_SERIES[seriesId]?.name || seriesId,
      frequency: info?.frequency || FRED_SERIES[seriesId]?.frequency,
      units: info?.units,
      observations: (obs || []).filter(o => o.value !== '.').map(o => ({
        date: o.date,
        value: parseFloat(o.value),
      })),
    };

    cacheSet(cacheKey, result, 300000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/profile?symbol=AAPL — Company profile
// ---------------------------------------------------------------------------
app.get('/api/v1/profile', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'AAPL').toUpperCase();
    const cacheKey = `profile:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [finnhubData, yahooData] = await Promise.all([
      finnhubFetch(`/stock/profile2?symbol=${symbol}`),
      yahooQuote(symbol).catch(() => null),
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
      volume: yahooData?.volume || null,
    };

    cacheSet(cacheKey, result, 3600000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/analyst?symbol=AAPL — Analyst recommendations
// ---------------------------------------------------------------------------
app.get('/api/v1/analyst', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'AAPL').toUpperCase();
    const cacheKey = `analyst:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    // Recommendation trends (free tier); price target & earnings are attempted
    // and gracefully skipped if the plan doesn't include them.
    const [recData, targetData, earningsData, quote] = await Promise.all([
      finnhubFetch(`/stock/recommendation?symbol=${symbol}`),
      finnhubFetch(`/stock/price-target?symbol=${symbol}`).catch(() => null),
      finnhubFetch(`/stock/earnings?symbol=${symbol}`).catch(() => null),
      yahooQuote(symbol).catch(() => null),
    ]);

    const recommendations = (recData || []).slice(0, 6).map(r => ({
      period: r.period,
      strongBuy: r.strongBuy, buy: r.buy, hold: r.hold, sell: r.sell, strongSell: r.strongSell,
    }));

    // Consensus trend: is the buy-side share rising vs the prior period?
    let trend = null;
    if (recommendations.length >= 2) {
      const bullShare = r => { const t = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell; return t ? (r.strongBuy + r.buy) / t : 0; };
      const delta = bullShare(recommendations[0]) - bullShare(recommendations[1]);
      trend = delta > 0.02 ? 'improving' : delta < -0.02 ? 'deteriorating' : 'stable';
    }

    let priceTarget = null;
    const current = quote?.price || null;
    if (targetData && targetData.targetMean) {
      priceTarget = {
        mean: targetData.targetMean, high: targetData.targetHigh, low: targetData.targetLow,
        median: targetData.targetMedian, current: current || targetData.lastPrice || null,
      };
    } else {
      // Finnhub price-target is premium; fall back to Yahoo's free analyst data.
      const summary = await yahooQuoteSummary(symbol, 'financialData').catch(() => null);
      const fd = summary?.financialData;
      if (fd?.targetMeanPrice?.raw) {
        priceTarget = {
          mean: fd.targetMeanPrice.raw, high: fd.targetHighPrice?.raw, low: fd.targetLowPrice?.raw,
          median: fd.targetMedianPrice?.raw, current: current || fd.currentPrice?.raw || null,
          numberOfAnalysts: fd.numberOfAnalystOpinions?.raw,
        };
      }
    }
    if (priceTarget && priceTarget.current && priceTarget.mean) {
      priceTarget.upside = +(((priceTarget.mean - priceTarget.current) / priceTarget.current) * 100).toFixed(2);
    }

    const earningsSurprises = (earningsData || []).slice(0, 4).map(e => ({
      period: e.period, actual: e.actual, estimate: e.estimate,
      surprise: e.surprise, surprisePercent: e.surprisePercent,
    }));

    const result = { symbol, recommendations, trend, priceTarget, earningsSurprises };

    cacheSet(cacheKey, result, 21600000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/crypto — Top crypto prices
// ---------------------------------------------------------------------------
app.get('/api/v1/crypto', async (req, res) => {
  try {
    const cacheKey = 'crypto:top';
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const cryptoSymbols = ['BTC-USD', 'ETH-USD', 'BNB-USD', 'SOL-USD', 'XRP-USD', 'ADA-USD', 'DOGE-USD', 'DOT-USD', 'AVAX-USD', 'MATIC-USD'];
    const results = await Promise.allSettled(
      cryptoSymbols.map(s => yahooQuote(s))
    );

    const cryptos = results
      .filter(r => r.status === 'fulfilled')
      .map(r => {
        const q = r.value;
        return {
          symbol: q.symbol.replace('-USD', ''),
          name: q.name || q.symbol.replace('-USD', ''),
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          volume: q.volume,
        };
      });

    cacheSet(cacheKey, cryptos, 30000);
    res.json(cryptos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/forex — Forex pairs & commodity prices
// ---------------------------------------------------------------------------
app.get('/api/v1/forex', async (req, res) => {
  try {
    const cacheKey = 'forex:all';
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const forexSymbols = ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'USDCHF=X', 'AUDUSD=X', 'USDCAD=X', 'NZDUSD=X'];
    const commoditySymbols = ['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F'];

    const [forexResults, commodityResults] = await Promise.all([
      Promise.allSettled(forexSymbols.map(s => yahooQuote(s))),
      Promise.allSettled(commoditySymbols.map(s => yahooQuote(s))),
    ]);

    const nameMap = {
      'EURUSD=X': 'EUR/USD', 'GBPUSD=X': 'GBP/USD', 'USDJPY=X': 'USD/JPY',
      'USDCHF=X': 'USD/CHF', 'AUDUSD=X': 'AUD/USD', 'USDCAD=X': 'USD/CAD', 'NZDUSD=X': 'NZD/USD',
      'GC=F': 'Gold', 'SI=F': 'Silver', 'CL=F': 'Crude Oil WTI', 'NG=F': 'Natural Gas', 'HG=F': 'Copper',
    };

    const mapQuote = r => {
      if (r.status !== 'fulfilled') return null;
      const q = r.value;
      return { symbol: q.symbol, name: nameMap[q.symbol] || q.name, price: q.price, change: q.change, changePercent: q.changePercent };
    };

    const result = {
      forex: forexResults.map(mapQuote).filter(Boolean),
      commodities: commodityResults.map(mapQuote).filter(Boolean),
    };

    cacheSet(cacheKey, result, 60000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/indices — Major market indices (S&P 500, Dow, Nasdaq, VIX, ...)
// ---------------------------------------------------------------------------
app.get('/api/v1/indices', async (req, res) => {
  try {
    const cacheKey = 'indices:all';
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const results = await Promise.allSettled(MARKET_INDICES.map(idx => yahooQuote(idx.symbol)));
    const indices = MARKET_INDICES.map((idx, i) => {
      const r = results[i];
      if (r.status !== 'fulfilled') return { ...idx, price: null, change: null, changePercent: null };
      const q = r.value;
      return { symbol: idx.symbol, name: idx.name, short: idx.short, price: q.price, change: q.change, changePercent: q.changePercent };
    });

    cacheSet(cacheKey, indices, 30000);
    res.json(indices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/fundamentals?symbol=AAPL — Company fundamentals
// ---------------------------------------------------------------------------
app.get('/api/v1/fundamentals', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'AAPL').toUpperCase();
    const cacheKey = `fundamentals:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const data = await finnhubFetch(`/stock/metric?symbol=${symbol}&metric=all`);
    const m = data?.metric || {};

    const result = {
      symbol,
      valuation: {
        peRatio: m['peBasicExclExtraTTM'] || m['peTTM'] || null,
        pbRatio: m['pbAnnual'] || null,
        psRatio: m['psAnnual'] || null,
        evToEbitda: m['enterpriseValueOverEBITDATTM'] || null,
        marketCap: m['marketCapitalization'] || null,
      },
      profitability: {
        roeTTM: m['roeTTM'] || null,
        roaTTM: m['roaTTM'] || null,
        grossMarginTTM: m['grossMarginTTM'] || null,
        operatingMarginTTM: m['operatingMarginTTM'] || null,
        netMarginTTM: m['netProfitMarginTTM'] || null,
      },
      growth: {
        revenueGrowthTTM: m['revenueGrowthTTMYoy'] || null,
        epsGrowthTTM: m['epsGrowthTTMYoy'] || null,
        revenueGrowth3Y: m['revenueGrowth3Y'] || null,
        epsGrowth3Y: m['epsGrowth3Y'] || null,
      },
      balanceSheet: {
        totalDebtToEquity: m['totalDebt/totalEquityAnnual'] || null,
        currentRatio: m['currentRatioAnnual'] || null,
        quickRatio: m['quickRatioAnnual'] || null,
      },
      dividends: {
        dividendYield: m['dividendYieldIndicatedAnnual'] || null,
        dividendPerShare: m['dividendPerShareAnnual'] || null,
        payoutRatio: m['payoutRatioAnnual'] || null,
      },
      trading: {
        week52High: m['52WeekHigh'] || null,
        week52Low: m['52WeekLow'] || null,
        week52HighDate: m['52WeekHighDate'] || null,
        week52LowDate: m['52WeekLowDate'] || null,
        beta: m['beta'] || null,
        avgVolume10d: m['10DayAverageTradingVolume'] || null,
        avgVolume3m: m['3MonthAverageTradingVolume'] || null,
      },
    };

    cacheSet(cacheKey, result, 14400000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD — Earnings calendar
// ---------------------------------------------------------------------------
app.get('/api/v1/earnings', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to = req.query.to || weekOut;
    const cacheKey = `earnings:${from}:${to}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const data = await finnhubFetch(`/calendar/earnings?from=${from}&to=${to}`);
    const result = (data?.earningsCalendar || []).map(e => ({
      symbol: e.symbol,
      date: e.date,
      hour: e.hour,
      epsEstimate: e.epsEstimate,
      epsActual: e.epsActual,
      revenueEstimate: e.revenueEstimate,
      revenueActual: e.revenueActual,
      quarter: e.quarter,
      year: e.year,
    }));

    cacheSet(cacheKey, result, 3600000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/ipo?from=YYYY-MM-DD&to=YYYY-MM-DD — IPO calendar
// ---------------------------------------------------------------------------
app.get('/api/v1/ipo', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthOut = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to = req.query.to || monthOut;
    const cacheKey = `ipo:${from}:${to}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const data = await finnhubFetch(`/calendar/ipo?from=${from}&to=${to}`);
    const result = (data?.ipoCalendar || []).map(i => ({
      symbol: i.symbol || null,
      name: i.name,
      date: i.date,
      exchange: i.exchange || null,
      priceRangeLow: i.priceRangeLow || null,
      priceRangeHigh: i.priceRangeHigh || null,
      numberOfShares: i.numberOfShares || null,
      totalSharesValue: i.totalSharesValue || null,
      status: i.status || 'expected',
    }));

    cacheSet(cacheKey, result, 7200000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/financials?symbol=AAPL&freq=annual&periods=4
// Income statement, balance sheet and cash flow as reported in SEC filings.
// ---------------------------------------------------------------------------
app.get('/api/v1/financials', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'AAPL').toUpperCase();
    const freq = req.query.freq === 'quarterly' ? 'quarterly' : 'annual';
    const periods = Math.min(parseInt(req.query.periods) || 4, 8);
    const cacheKey = `financials:${symbol}:${freq}:${periods}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const data = await finnhubFetch(`/stock/financials-reported?symbol=${symbol}&freq=${freq}`);
    const reports = (data?.data || []).slice(0, periods);
    if (!reports.length) {
      return res.json({ symbol, freq, available: false, periods: [], statements: {} });
    }

    const periodMeta = reports.map(r => ({
      year: r.year, quarter: r.quarter, form: r.form,
      endDate: r.endDate ? String(r.endDate).slice(0, 10) : null,
      label: freq === 'annual' ? `FY${r.year}` : `Q${r.quarter} ${r.year}`,
    }));

    // Line items differ between filings, so build a union keyed by concept,
    // ordered by how the most recent filing presents them.
    const buildStatement = (key) => {
      const order = [];
      const seen = new Set();
      for (const r of reports) {
        for (const item of (r.report?.[key] || [])) {
          if (item.concept && !seen.has(item.concept)) {
            seen.add(item.concept);
            order.push({ concept: item.concept, label: item.label || item.concept, unit: item.unit });
          }
        }
      }
      return order.map(({ concept, label, unit }) => {
        const cells = reports.map(r => {
          const hit = (r.report?.[key] || []).find(i => i.concept === concept);
          return hit ? { value: hit.value ?? null, label: hit.label || null } : { value: null, label: null };
        });

        // Filers sometimes reuse the same XBRL concept for a different line
        // between periods (e.g. TSLA FY2022 tagged a sub-total with the concept
        // it later used for total revenue). Comparing those as one series is
        // wrong, so flag any period whose label diverges from the anchor and
        // suppress the YoY that would span the mismatch.
        const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const anchor = norm(label);
        const mismatched = cells.map(c => c.label != null && norm(c.label) !== anchor);

        const values = cells.map(c => c.value);
        const yoy = values.map((v, i) => {
          const prev = values[i + 1];
          if (v == null || prev == null || prev === 0) return null;
          if (mismatched[i] || mismatched[i + 1]) return null;
          return +(((v - prev) / Math.abs(prev)) * 100).toFixed(1);
        });

        return {
          concept, label, unit, values, yoy,
          mismatched,
          periodLabels: cells.map(c => c.label),
        };
      }).filter(row => row.values.some(v => v != null));
    };

    const result = {
      symbol, freq, available: true,
      periods: periodMeta,
      statements: {
        income: buildStatement('ic'),
        balance: buildStatement('bs'),
        cashflow: buildStatement('cf'),
      },
    };

    // Statements only change when a filing lands — cache hard.
    cacheSet(cacheKey, result, 86400000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/correlation?symbols=AAPL,MSFT&window=90
// Pairwise return correlation — surfaces concentration risk in a portfolio.
// ---------------------------------------------------------------------------
app.get('/api/v1/analytics/correlation', async (req, res) => {
  try {
    const symbols = (req.query.symbols || '').split(',')
      .map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 15);
    const window = Math.min(parseInt(req.query.window) || 90, 365);
    if (symbols.length < 2) {
      return res.json({ available: false, message: 'Need at least 2 symbols' });
    }

    const cacheKey = `corr:${symbols.join(',')}:${window}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const range = window <= 90 ? '6mo' : window <= 180 ? '1y' : '2y';
    const settled = await Promise.allSettled(symbols.map(s => yahooCandles(s, '1d', range)));

    // Daily returns, trimmed to the requested window.
    const returnsBySymbol = {};
    settled.forEach((r, i) => {
      if (r.status !== 'fulfilled' || r.value.length < 10) return;
      const closes = r.value.map(c => c.close);
      const rets = [];
      for (let j = 1; j < closes.length; j++) {
        if (closes[j] && closes[j - 1]) rets.push((closes[j] - closes[j - 1]) / closes[j - 1]);
      }
      returnsBySymbol[symbols[i]] = rets.slice(-window);
    });

    const valid = symbols.filter(s => returnsBySymbol[s]?.length >= 10);
    if (valid.length < 2) {
      return res.json({ available: false, message: 'Insufficient price history' });
    }

    // Align every series to the shortest length so pairs are comparable.
    const len = Math.min(...valid.map(s => returnsBySymbol[s].length));
    const series = valid.map(s => returnsBySymbol[s].slice(-len));

    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const corr = (a, b) => {
      const ma = mean(a), mb = mean(b);
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < a.length; i++) {
        const x = a[i] - ma, y = b[i] - mb;
        num += x * y; da += x * x; db += y * y;
      }
      const den = Math.sqrt(da * db);
      return den ? num / den : 0;
    };

    const matrix = series.map((a, i) => series.map((b, j) =>
      i === j ? 1 : +corr(a, b).toFixed(3)
    ));

    // Most- and least-correlated pairs are the actionable takeaways.
    const pairs = [];
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        pairs.push({ a: valid[i], b: valid[j], correlation: matrix[i][j] });
      }
    }
    pairs.sort((x, y) => y.correlation - x.correlation);

    const offDiagonal = pairs.map(p => p.correlation);
    const avg = offDiagonal.length ? offDiagonal.reduce((a, b) => a + b, 0) / offDiagonal.length : 0;

    const result = {
      available: true, symbols: valid, window: len, matrix,
      averageCorrelation: +avg.toFixed(3),
      mostCorrelated: pairs.slice(0, 3),
      leastCorrelated: pairs.slice(-3).reverse(),
      // Naive diversification read: high average correlation means the book
      // moves as one position regardless of how many tickers it holds.
      diversification: avg > 0.7 ? 'Poor' : avg > 0.4 ? 'Moderate' : 'Good',
    };

    cacheSet(cacheKey, result, 900000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Shared helper: build a value-weighted portfolio return series from daily
// candles. Used by VaR and stress testing.
// ---------------------------------------------------------------------------
async function buildPortfolioReturns(symbols, values, range = '2y') {
  const settled = await Promise.allSettled(symbols.map(s => yahooCandles(s, '1d', range)));

  const seriesBySymbol = {};
  settled.forEach((r, i) => {
    if (r.status !== 'fulfilled' || r.value.length < 30) return;
    const closes = r.value.map(c => c.close);
    const rets = [];
    for (let j = 1; j < closes.length; j++) {
      if (closes[j] && closes[j - 1]) rets.push((closes[j] - closes[j - 1]) / closes[j - 1]);
    }
    seriesBySymbol[symbols[i]] = rets;
  });

  const valid = symbols.filter(s => seriesBySymbol[s]);
  if (!valid.length) return null;

  const totalValue = valid.reduce((s, sym) => s + (values[symbols.indexOf(sym)] || 0), 0);
  if (totalValue <= 0) return null;

  const len = Math.min(...valid.map(s => seriesBySymbol[s].length));
  const weights = valid.map(s => (values[symbols.indexOf(s)] || 0) / totalValue);

  // Align to the shortest series (most recent observations).
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

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const stdev = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1 || 1)); };

// ---------------------------------------------------------------------------
// GET /api/v1/markets?class=Sector%20ETF — multi-asset instrument board.
// Covers indices, ETFs (broad/sector/factor/international), fixed income,
// commodities, futures, FX and crypto in one place.
// ---------------------------------------------------------------------------
app.get('/api/v1/markets', async (req, res) => {
  try {
    const wanted = req.query.class;
    const list = wanted && INSTRUMENTS_BY_CLASS[wanted]
      ? INSTRUMENTS_BY_CLASS[wanted]
      : INSTRUMENTS;

    const cacheKey = `markets:${wanted || 'all'}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const quotes = await yahooQuoteBatch(list.map(i => i.symbol));
    const bySymbol = new Map(quotes.map(q => [q.symbol, q]));

    const rows = list.map(i => {
      const q = bySymbol.get(i.symbol);
      return {
        symbol: i.symbol, name: i.name, class: i.class, region: i.region,
        // Indices aren't tradeable; point at the liquid proxy instead.
        tradeable: i.tradeable || null,
        price: q?.price ?? null,
        change: q?.change ?? null,
        changePercent: q?.changePercent ?? null,
        volume: q?.volume ?? null,
      };
    }).filter(r => r.price != null);

    const byClass = {};
    for (const r of rows) (byClass[r.class] ||= []).push(r);
    // Within each class, lead with the biggest movers.
    for (const k of Object.keys(byClass)) {
      byClass[k].sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0));
    }

    const result = {
      classes: ASSET_CLASSES.filter(c => byClass[c]?.length),
      byClass,
      count: rows.length,
      requested: list.length,
    };

    cacheSet(cacheKey, result, 45000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/compare?symbols=SPY,QQQ,GLD&range=1y
// Relative performance: every series rebased to 0% at the common start date,
// which is the only honest way to compare instruments at different price levels.
// ---------------------------------------------------------------------------
app.get('/api/v1/compare', async (req, res) => {
  try {
    const symbols = (req.query.symbols || 'SPY,QQQ')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 8);
    const range = ['1mo', '3mo', '6mo', '1y', '2y', '5y'].includes(req.query.range) ? req.query.range : '1y';
    if (symbols.length < 1) return res.json({ available: false, message: 'No symbols' });

    const cacheKey = `compare:${symbols.join(',')}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const interval = range === '5y' ? '1wk' : range === '2y' ? '1d' : '1d';
    const settled = await Promise.allSettled(symbols.map(s => yahooCandles(s, interval, range)));

    const raw = {};
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.length > 2) raw[symbols[i]] = r.value;
    });
    const valid = symbols.filter(s => raw[s]);
    if (!valid.length) return res.json({ available: false, message: 'No price history' });

    // Align on the shortest series so every line starts on the same bar.
    const len = Math.min(...valid.map(s => raw[s].length));
    const base = {};
    valid.forEach(s => { base[s] = raw[s][raw[s].length - len].close; });

    const anchor = raw[valid[0]].slice(-len);
    const series = anchor.map((c, idx) => {
      const point = { time: c.time };
      valid.forEach(s => {
        const bar = raw[s][raw[s].length - len + idx];
        point[s] = bar && base[s] ? +(((bar.close - base[s]) / base[s]) * 100).toFixed(2) : null;
      });
      return point;
    });

    // Per-instrument summary stats over the window.
    const stats = valid.map(s => {
      const bars = raw[s].slice(-len);
      const closes = bars.map(b => b.close).filter(Boolean);
      const totalReturn = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;

      const rets = [];
      for (let i = 1; i < closes.length; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      const m = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
      const sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / (rets.length - 1 || 1));
      // Annualise using the bar frequency implied by the interval.
      const periodsPerYear = interval === '1wk' ? 52 : 252;
      const vol = sd * Math.sqrt(periodsPerYear) * 100;

      let peak = closes[0], maxDD = 0;
      for (const c of closes) { if (c > peak) peak = c; maxDD = Math.max(maxDD, (peak - c) / peak); }

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
        sharpe: vol ? +((annualised - 4.5) / vol).toFixed(2) : null,
      };
    }).sort((a, b) => b.totalReturn - a.totalReturn);

    const result = { available: true, symbols: valid, range, points: series.length, series, stats };
    cacheSet(cacheKey, result, 300000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/var?symbols=..&values=..&confidence=95&horizon=1
// Value at Risk by three methods, plus Conditional VaR (expected shortfall).
// ---------------------------------------------------------------------------
app.get('/api/v1/analytics/var', async (req, res) => {
  try {
    const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 15);
    const values = (req.query.values || '').split(',').map(v => parseFloat(v) || 0);
    const confidence = Math.min(Math.max(parseFloat(req.query.confidence) || 95, 50), 99.9);
    const horizon = Math.min(Math.max(parseInt(req.query.horizon) || 1, 1), 30);

    if (symbols.length < 1) return res.json({ available: false, message: 'No positions' });

    const cacheKey = `var:${symbols.join(',')}:${values.join(',')}:${confidence}:${horizon}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const built = await buildPortfolioReturns(symbols, values);
    if (!built || built.portfolio.length < 30) {
      return res.json({ available: false, message: 'Insufficient price history' });
    }
    const { portfolio, totalValue, valid } = built;

    const alpha = 1 - confidence / 100;          // tail probability
    const scale = Math.sqrt(horizon);            // square-root-of-time rule
    const mu = mean(portfolio);
    const sigma = stdev(portfolio);

    // --- 1. Historical: empirical quantile of realised returns ---
    const sorted = [...portfolio].sort((a, b) => a - b);
    const idx = Math.max(0, Math.floor(alpha * sorted.length) - 1);
    const histRet = sorted[idx];
    // Conditional VaR = average loss beyond the VaR threshold.
    const tail = sorted.slice(0, Math.max(idx + 1, 1));
    const cvarRet = mean(tail);

    // --- 2. Parametric: normal assumption, z-score from confidence ---
    // Inverse normal CDF (Acklam's rational approximation).
    const invNorm = (p) => {
      const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
      const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
      const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
      const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
      const pl = 0.02425;
      if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
      if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
      const q = p - 0.5, r = q * q;
      return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
    };
    const z = invNorm(alpha);
    const paramRet = mu + z * sigma;

    // --- 3. Monte Carlo: normal draws calibrated to observed mu/sigma ---
    const SIMS = 10000;
    const sims = [];
    for (let i = 0; i < SIMS; i++) {
      // Box-Muller
      const u1 = Math.random() || 1e-9, u2 = Math.random();
      const zz = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      sims.push(mu + sigma * zz);
    }
    sims.sort((a, b) => a - b);
    const mcRet = sims[Math.max(0, Math.floor(alpha * SIMS) - 1)];

    const toMoney = (r) => +(Math.abs(r) * scale * totalValue).toFixed(2);
    const toPct = (r) => +(Math.abs(r) * scale * 100).toFixed(2);

    const historical = toMoney(histRet), parametric = toMoney(paramRet), monteCarlo = toMoney(mcRet);

    // Historical VaR exceeding parametric is the signature of fat tails:
    // realised losses are worse than a normal distribution predicts.
    const fatTails = historical > parametric * 1.05;

    const result = {
      available: true,
      symbols: valid, portfolioValue: +totalValue.toFixed(2),
      confidence, horizon, observations: portfolio.length,
      var: {
        historical: { amount: historical, percent: toPct(histRet) },
        parametric: { amount: parametric, percent: toPct(paramRet) },
        monteCarlo: { amount: monteCarlo, percent: toPct(mcRet) },
      },
      cvar: { amount: toMoney(cvarRet), percent: toPct(cvarRet) },
      dailyVolatility: +(sigma * 100).toFixed(2),
      annualisedVolatility: +(sigma * Math.sqrt(252) * 100).toFixed(2),
      fatTails,
      worstDay: +(sorted[0] * 100).toFixed(2),
      bestDay: +(sorted[sorted.length - 1] * 100).toFixed(2),
    };

    cacheSet(cacheKey, result, 900000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/optimize?symbols=..&values=..&range=2y
// Mean-variance optimisation: efficient frontier, min-variance and max-Sharpe
// portfolios, plotted against where the user actually sits today.
// ---------------------------------------------------------------------------
app.get('/api/v1/analytics/optimize', async (req, res) => {
  try {
    const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 12);
    const values = (req.query.values || '').split(',').map(v => parseFloat(v) || 0);
    const range = ['1y', '2y', '5y'].includes(req.query.range) ? req.query.range : '2y';
    if (symbols.length < 2) return res.json({ available: false, message: 'Need at least 2 holdings' });

    const cacheKey = `optimize:${symbols.join(',')}:${values.join(',')}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [settled, rfObs] = await Promise.all([
      Promise.allSettled(symbols.map(s => yahooCandles(s, '1d', range))),
      fredFetch('DGS3MO', { limit: 5 }).catch(() => null),
    ]);

    const retsBy = {};
    settled.forEach((r, i) => {
      if (r.status !== 'fulfilled' || r.value.length < 60) return;
      const closes = r.value.map(c => c.close);
      const out = [];
      for (let j = 1; j < closes.length; j++) {
        if (closes[j] && closes[j - 1]) out.push((closes[j] - closes[j - 1]) / closes[j - 1]);
      }
      retsBy[symbols[i]] = out;
    });

    const valid = symbols.filter(s => retsBy[s]);
    if (valid.length < 2) return res.json({ available: false, message: 'Insufficient price history' });

    const len = Math.min(...valid.map(s => retsBy[s].length));
    const series = valid.map(s => retsBy[s].slice(-len));

    const cov = covariance(series);
    const meanDaily = series.map(s => s.reduce((a, b) => a + b, 0) / s.length);
    const rfAnnual = (() => {
      const v = (rfObs || []).find(o => o.value !== '.');
      return v ? parseFloat(v.value) / 100 : 0.045;
    })();

    const frontier = efficientFrontier(cov, meanDaily, rfAnnual / 252, 24);
    if (!frontier) return res.json({ available: false, message: 'Covariance matrix is singular (holdings too similar)' });

    const ann = (w) => {
      const r = w.reduce((s, v, i) => s + v * meanDaily[i], 0) * 252 * 100;
      const risk = Math.sqrt(portfolioVariance(w, cov)) * Math.sqrt(252) * 100;
      return { return: +r.toFixed(2), risk: +risk.toFixed(2), sharpe: risk ? +((r - rfAnnual * 100) / risk).toFixed(2) : null };
    };

    const describe = (w, label) => w && ({
      label,
      weights: valid.map((s, i) => ({ symbol: s, weight: +(w[i] * 100).toFixed(2) })),
      ...ann(w),
      // Negative weights are short positions; long-only investors can't hold these.
      requiresShorting: w.some(x => x < -0.0001),
    });

    // Where the user sits today.
    const totalValue = valid.reduce((s, sym) => s + (values[symbols.indexOf(sym)] || 0), 0);
    const currentW = totalValue > 0
      ? valid.map(s => (values[symbols.indexOf(s)] || 0) / totalValue)
      : valid.map(() => 1 / valid.length);
    const equalW = valid.map(() => 1 / valid.length);

    const result = {
      available: true,
      symbols: valid, range, observations: len,
      riskFreeRate: +(rfAnnual * 100).toFixed(2),
      frontier: frontier.points.map(p => ({
        risk: +(p.risk * Math.sqrt(252) * 100).toFixed(3),
        return: +(p.return * 252 * 100).toFixed(3),
      })),
      portfolios: {
        current: describe(currentW, totalValue > 0 ? 'Current' : 'Equal weight (no values)'),
        minVariance: describe(frontier.minVariance, 'Minimum variance'),
        maxSharpe: describe(frontier.tangency, 'Maximum Sharpe'),
        equalWeight: describe(equalW, 'Equal weight'),
      },
      methodology: 'Unconstrained Markowitz mean-variance on daily returns; expected returns are historical averages.',
    };

    cacheSet(cacheKey, result, 900000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/valuation/dcf?symbol=AAPL&growth=..&wacc=..&terminal=..
// Discounted cash flow on reported free cash flow, with a sensitivity grid.
// ---------------------------------------------------------------------------
app.get('/api/v1/valuation/dcf', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'AAPL').toUpperCase();

    // parseFloat(undefined) is NaN, and ?? does NOT catch NaN — so a missing
    // query param would otherwise poison every downstream calculation.
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
      yahooQuote(symbol).catch(() => null),
    ]);

    const reports = (fin?.data || []).slice(0, 6);
    if (!reports.length) {
      // Funds and indices have no cash flows of their own, so a DCF is not a
      // "missing data" problem — it's the wrong tool for the instrument.
      const meta = INSTRUMENT_BY_SYMBOL[symbol];
      const isFund = meta && meta.class !== 'Index';
      return res.json({
        symbol, available: false,
        message: meta
          ? `${symbol} is ${isFund ? 'a fund/ETF' : 'an index'}, not an operating company — a DCF needs company cash flows. Select a stock.`
          : 'No filings available for this symbol',
      });
    }

    // Free cash flow = operating cash flow − capital expenditure. Concept
    // names vary by filer, so match on concept first then fall back to label.
    const pick = (report, patterns) => {
      const cf = report.report?.cf || [];
      for (const p of patterns) {
        const hit = cf.find(i => p.test(i.concept || '') || p.test(i.label || ''));
        if (hit && typeof hit.value === 'number') return hit.value;
      }
      return null;
    };

    const history = reports.map(r => {
      const ocf = pick(r, [
        /NetCashProvidedByUsedInOperatingActivities$/i,
        /NetCashProvidedByUsedInOperatingActivitiesContinuingOperations/i,
        /cash generated by operating activities/i,
        /net cash.*operating/i,
      ]);
      const capex = pick(r, [
        /PaymentsToAcquirePropertyPlantAndEquipment/i,
        /PaymentsToAcquireProductiveAssets/i,
        /purchases? of property/i,
        /capital expenditure/i,
      ]);
      return {
        year: r.year,
        operatingCashFlow: ocf,
        capex: capex != null ? Math.abs(capex) : null,
        freeCashFlow: (ocf != null && capex != null) ? ocf - Math.abs(capex) : null,
      };
    }).filter(h => h.freeCashFlow != null);

    if (history.length < 2) {
      return res.json({ symbol, available: false, message: 'Could not derive free cash flow from filings' });
    }

    const latestFcf = history[0].freeCashFlow;
    // Historical FCF CAGR as the default growth assumption.
    const oldest = history[history.length - 1];
    const spanYears = Math.max(history[0].year - oldest.year, 1);
    const histCagr = (oldest.freeCashFlow > 0 && latestFcf > 0)
      ? (Math.pow(latestFcf / oldest.freeCashFlow, 1 / spanYears) - 1) * 100
      : null;
    // Clamp the default: extrapolating an extreme historical CAGR forever is
    // the fastest way to produce a nonsense valuation.
    const growthPct = growth != null ? growth
      : histCagr != null ? Math.max(Math.min(histCagr, 15), -5) : 5;

    const shares = profile?.shareOutstanding ? profile.shareOutstanding * 1e6 : null;
    const price = quote?.price ?? null;

    const runDcf = (g, w, tg) => {
      if (w / 100 <= tg / 100) return null; // Gordon growth breaks down
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
      return { flows, pvExplicit: pv, terminalValue, pvTerminal, enterprise,
        perShare: shares ? enterprise / shares : null };
    };

    const base = runDcf(growthPct, wacc, terminal);
    if (!base) return res.json({ symbol, available: false, message: 'WACC must exceed terminal growth' });

    // Sensitivity grid across WACC × terminal growth.
    const waccRange = [-2, -1, 0, 1, 2].map(d => +(wacc + d).toFixed(1));
    const termRange = [-1, -0.5, 0, 0.5, 1].map(d => +(terminal + d).toFixed(1));
    const sensitivity = waccRange.map(w => ({
      wacc: w,
      cells: termRange.map(tg => {
        const r = runDcf(growthPct, w, tg);
        return { terminal: tg, perShare: r?.perShare != null ? +r.perShare.toFixed(2) : null };
      }),
    }));

    const fair = base.perShare;
    const result = {
      symbol, available: true,
      assumptions: { growthPercent: +growthPct.toFixed(2), wacc, terminalGrowth: terminal, years,
        historicalFcfCagr: histCagr != null ? +histCagr.toFixed(2) : null },
      history: history.map(h => ({ ...h,
        freeCashFlow: +(h.freeCashFlow / 1e9).toFixed(2),
        operatingCashFlow: +(h.operatingCashFlow / 1e9).toFixed(2),
        capex: +(h.capex / 1e9).toFixed(2) })),
      latestFcfBillions: +(latestFcf / 1e9).toFixed(2),
      sharesOutstanding: shares,
      enterpriseValueBillions: +(base.enterprise / 1e9).toFixed(2),
      terminalSharePercent: +((base.pvTerminal / base.enterprise) * 100).toFixed(1),
      fairValuePerShare: fair != null ? +fair.toFixed(2) : null,
      currentPrice: price,
      upsidePercent: (fair != null && price) ? +(((fair - price) / price) * 100).toFixed(1) : null,
      termRange, sensitivity,
      methodology: 'FCF = operating cash flow − capex, grown at the assumed rate, discounted at WACC, with a Gordon-growth terminal value.',
    };

    cacheSet(cacheKey, result, 3600000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/portfolio/performance?symbols=..&values=..&costs=..&benchmark=SPY
// Contribution attribution: which positions and sectors actually drove return.
// ---------------------------------------------------------------------------
app.get('/api/v1/portfolio/performance', async (req, res) => {
  try {
    const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
    const values = (req.query.values || '').split(',').map(v => parseFloat(v) || 0);
    const costs = (req.query.costs || '').split(',').map(v => parseFloat(v) || 0);
    const benchmark = (req.query.benchmark || 'SPY').toUpperCase();
    const range = ['1mo', '3mo', '6mo', '1y', '2y'].includes(req.query.range) ? req.query.range : '1y';
    if (!symbols.length) return res.json({ available: false, message: 'No positions' });

    const cacheKey = `perf:${symbols.join(',')}:${values.join(',')}:${costs.join(',')}:${benchmark}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [settled, benchCandles] = await Promise.all([
      Promise.allSettled(symbols.map(s => yahooCandles(s, '1d', range))),
      yahooCandles(benchmark, '1d', range).catch(() => []),
    ]);

    const totalValue = values.reduce((a, b) => a + b, 0);
    if (totalValue <= 0) return res.json({ available: false, message: 'No position values' });

    const positions = [];
    symbols.forEach((s, i) => {
      const r = settled[i];
      if (r.status !== 'fulfilled' || r.value.length < 2) return;
      const closes = r.value.map(c => c.close).filter(Boolean);
      const periodReturn = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
      const weight = values[i] / totalValue;
      const cost = costs[i] || 0;
      positions.push({
        symbol: s,
        sector: SYMBOL_SECTOR[s] || INSTRUMENT_BY_SYMBOL[s]?.class || 'Other',
        value: values[i],
        weight: +(weight * 100).toFixed(2),
        periodReturn: +periodReturn.toFixed(2),
        // Contribution = weight x return. These sum to the portfolio return,
        // which is what makes attribution additive and auditable.
        contribution: +(weight * periodReturn).toFixed(3),
        // Since-inception P&L where a cost basis was supplied.
        unrealisedPercent: cost > 0 ? +(((values[i] - cost) / cost) * 100).toFixed(2) : null,
      });
    });

    if (!positions.length) return res.json({ available: false, message: 'No price history' });

    const portfolioReturn = positions.reduce((s, p) => s + p.contribution, 0);

    const bCloses = benchCandles.map(c => c.close).filter(Boolean);
    const benchReturn = bCloses.length > 1
      ? ((bCloses[bCloses.length - 1] - bCloses[0]) / bCloses[0]) * 100 : null;

    // Sector-level rollup.
    const bySector = {};
    for (const p of positions) {
      const s = (bySector[p.sector] ||= { sector: p.sector, weight: 0, contribution: 0, positions: 0 });
      s.weight += p.weight;
      s.contribution += p.contribution;
      s.positions++;
    }
    const sectors = Object.values(bySector).map(s => ({
      ...s,
      weight: +s.weight.toFixed(2),
      contribution: +s.contribution.toFixed(3),
    })).sort((a, b) => b.contribution - a.contribution);

    const sorted = [...positions].sort((a, b) => b.contribution - a.contribution);

    const result = {
      available: true,
      range, benchmark,
      portfolioValue: +totalValue.toFixed(2),
      portfolioReturn: +portfolioReturn.toFixed(2),
      benchmarkReturn: benchReturn != null ? +benchReturn.toFixed(2) : null,
      excessReturn: benchReturn != null ? +(portfolioReturn - benchReturn).toFixed(2) : null,
      positions: sorted,
      sectors,
      topContributors: sorted.slice(0, 5),
      topDetractors: sorted.slice(-5).reverse().filter(p => p.contribution < 0),
      methodology: 'Contribution = position weight x period return; contributions sum to the portfolio return.',
    };

    cacheSet(cacheKey, result, 300000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/factors?symbols=..&values=..&range=2y
//
// Regresses portfolio excess returns on long/short factor spreads built from
// liquid ETFs. Reveals style tilts the holder never explicitly chose — e.g. a
// portfolio of large-cap tech is implicitly short value and long momentum.
// ---------------------------------------------------------------------------
const FACTOR_DEFS = [
  { key: 'market', name: 'Market', long: 'SPY', short: null,
    desc: 'Broad equity market exposure (beta).' },
  { key: 'size', name: 'Size', long: 'IWM', short: 'SPY',
    desc: 'Small-cap minus large-cap. Positive = tilted to smaller companies.' },
  { key: 'value', name: 'Value', long: 'IWD', short: 'IWF',
    desc: 'Value minus growth. Negative = tilted to growth names.' },
  { key: 'momentum', name: 'Momentum', long: 'MTUM', short: 'SPY',
    desc: 'Momentum minus market. Positive = chasing recent winners.' },
  { key: 'quality', name: 'Quality', long: 'QUAL', short: 'SPY',
    desc: 'Quality minus market. Positive = profitable, low-leverage firms.' },
  { key: 'lowVol', name: 'Low Volatility', long: 'USMV', short: 'SPY',
    desc: 'Min-vol minus market. Positive = defensive tilt.' },
];

app.get('/api/v1/analytics/factors', async (req, res) => {
  try {
    const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 15);
    const values = (req.query.values || '').split(',').map(v => parseFloat(v) || 0);
    const range = ['1y', '2y', '5y'].includes(req.query.range) ? req.query.range : '2y';
    if (!symbols.length) return res.json({ available: false, message: 'No positions' });

    const cacheKey = `factors:${symbols.join(',')}:${values.join(',')}:${range}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    // Every ETF leg we need, de-duplicated.
    const legs = [...new Set(FACTOR_DEFS.flatMap(f => [f.long, f.short]).filter(Boolean))];

    const [built, legCandles, rfObs] = await Promise.all([
      buildPortfolioReturns(symbols, values, range),
      Promise.allSettled(legs.map(s => yahooCandles(s, '1d', range))),
      fredFetch('DGS3MO', { limit: 5 }).catch(() => null),
    ]);
    if (!built) return res.json({ available: false, message: 'Insufficient price history' });

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
      if (r.status === 'fulfilled' && r.value.length > 30) legReturns[legs[i]] = retsOf(r.value);
    });

    const usable = FACTOR_DEFS.filter(f =>
      legReturns[f.long] && (!f.short || legReturns[f.short])
    );
    if (usable.length < 2) return res.json({ available: false, message: 'Factor proxy data unavailable' });

    // Daily risk-free rate from the 3-month bill.
    const rfAnnual = (() => {
      const v = (rfObs || []).find(o => o.value !== '.');
      return v ? parseFloat(v.value) / 100 : 0.045;
    })();
    const rfDaily = rfAnnual / 252;

    // Align everything to the shortest available series.
    const len = Math.min(
      built.portfolio.length,
      ...usable.flatMap(f => [legReturns[f.long].length, f.short ? legReturns[f.short].length : Infinity])
        .filter(n => isFinite(n))
    );
    if (len < 60) return res.json({ available: false, message: 'Need at least 60 overlapping observations' });

    const tail = (arr) => arr.slice(-len);
    const portExcess = tail(built.portfolio).map(r => r - rfDaily);

    const X = [];
    for (let t = 0; t < len; t++) {
      X.push(usable.map(f => {
        const l = tail(legReturns[f.long])[t];
        // Market is an excess return; the rest are long/short spreads.
        return f.short ? l - tail(legReturns[f.short])[t] : l - rfDaily;
      }));
    }

    const fit = ols(X, portExcess);
    if (!fit) return res.json({ available: false, message: 'Regression failed (collinear factors)' });

    const exposures = usable.map((f, i) => {
      const t = fit.tStats[i];
      const p = pValue(t, fit.dof);
      return {
        key: f.key, name: f.name, description: f.desc,
        proxy: f.short ? `${f.long} − ${f.short}` : f.long,
        beta: +fit.coefficients[i].toFixed(3),
        tStat: t == null ? null : +t.toFixed(2),
        pValue: p,
        // Only call a tilt real when it clears conventional significance.
        significant: p != null && p < 0.05,
      };
    });

    // Alpha: the daily intercept, annualised.
    const alphaAnnual = fit.intercept * 252 * 100;
    const alphaP = pValue(fit.interceptT, fit.dof);

    const result = {
      available: true,
      symbols: built.valid,
      range, observations: fit.n,
      riskFreeRate: +(rfAnnual * 100).toFixed(2),
      exposures,
      alpha: {
        annualisedPercent: +alphaAnnual.toFixed(2),
        tStat: fit.interceptT == null ? null : +fit.interceptT.toFixed(2),
        pValue: alphaP,
        significant: alphaP != null && alphaP < 0.05,
      },
      rSquared: +fit.r2.toFixed(4),
      adjRSquared: +fit.adjR2.toFixed(4),
      // Share of variance the factors do NOT explain — stock-specific risk.
      idiosyncraticShare: +((1 - fit.r2) * 100).toFixed(1),
      residualVolAnnual: +(fit.residualStd * Math.sqrt(252) * 100).toFixed(2),
      methodology: 'OLS of daily excess returns on ETF-proxied long/short factor spreads.',
    };

    cacheSet(cacheKey, result, 900000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/stress?symbols=..&values=..
// Beta-adjusted scenario analysis against historical crisis drawdowns.
// ---------------------------------------------------------------------------
const STRESS_SCENARIOS = [
  { id: 'gfc2008', name: '2008 Financial Crisis', marketShock: -46.0, note: 'S&P 500 peak-to-trough, Sep 2008 – Mar 2009' },
  { id: 'covid2020', name: 'COVID Crash 2020', marketShock: -33.9, note: 'S&P 500, 19 Feb – 23 Mar 2020' },
  { id: 'rates2022', name: '2022 Rate Shock', marketShock: -25.4, note: 'S&P 500, Jan – Oct 2022' },
  { id: 'dotcom2000', name: 'Dot-com Bust', marketShock: -49.1, note: 'S&P 500, Mar 2000 – Oct 2002' },
  { id: 'blackmonday', name: 'Black Monday', marketShock: -20.5, note: 'S&P 500, single day, 19 Oct 1987' },
  { id: 'correction10', name: 'Standard Correction', marketShock: -10.0, note: 'Textbook 10% market correction' },
];

app.get('/api/v1/analytics/stress', async (req, res) => {
  try {
    const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 15);
    const values = (req.query.values || '').split(',').map(v => parseFloat(v) || 0);
    if (symbols.length < 1) return res.json({ available: false, message: 'No positions' });

    const cacheKey = `stress:${symbols.join(',')}:${values.join(',')}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [built, spyCandles] = await Promise.all([
      buildPortfolioReturns(symbols, values),
      yahooCandles('SPY', '1d', '2y').catch(() => []),
    ]);
    if (!built || spyCandles.length < 30) {
      return res.json({ available: false, message: 'Insufficient price history' });
    }

    const spyRets = [];
    for (let i = 1; i < spyCandles.length; i++) {
      if (spyCandles[i].close && spyCandles[i - 1].close) {
        spyRets.push((spyCandles[i].close - spyCandles[i - 1].close) / spyCandles[i - 1].close);
      }
    }

    // Per-holding beta vs SPY drives how hard each position is shocked.
    const { valid, seriesBySymbol, totalValue } = built;
    const betaOf = (sym) => {
      const arr = seriesBySymbol[sym];
      const n = Math.min(arr.length, spyRets.length);
      const a = arr.slice(-n), b = spyRets.slice(-n);
      const ma = mean(a), mb = mean(b);
      let cov = 0, varb = 0;
      for (let i = 0; i < n; i++) { cov += (a[i] - ma) * (b[i] - mb); varb += (b[i] - mb) ** 2; }
      return varb ? cov / varb : 1;
    };

    const holdings = valid.map(s => {
      const value = values[symbols.indexOf(s)] || 0;
      return { symbol: s, value, beta: +betaOf(s).toFixed(2) };
    });

    const portfolioBeta = totalValue
      ? +(holdings.reduce((s, h) => s + h.beta * (h.value / totalValue), 0)).toFixed(2)
      : 1;

    const scenarios = STRESS_SCENARIOS.map(sc => {
      const impacts = holdings.map(h => {
        const shockPct = h.beta * sc.marketShock;
        return { symbol: h.symbol, beta: h.beta, shockPercent: +shockPct.toFixed(2), pnl: +(h.value * shockPct / 100).toFixed(2) };
      });
      const totalPnl = impacts.reduce((s, i) => s + i.pnl, 0);
      return {
        ...sc,
        portfolioShockPercent: totalValue ? +((totalPnl / totalValue) * 100).toFixed(2) : 0,
        pnl: +totalPnl.toFixed(2),
        endValue: +(totalValue + totalPnl).toFixed(2),
        worstHolding: impacts.slice().sort((a, b) => a.pnl - b.pnl)[0] || null,
        impacts,
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
      methodology: 'Beta-adjusted shock propagation vs SPY, betas from 2y daily returns.',
    };

    cacheSet(cacheKey, result, 900000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/yieldcurve — US Treasury curve now vs 1M / 1Y ago, with
// inversion detection. All tenors come from FRED.
// ---------------------------------------------------------------------------
const CURVE_TENORS = [
  { id: 'DGS1MO', label: '1M', years: 1 / 12 },
  { id: 'DGS3MO', label: '3M', years: 0.25 },
  { id: 'DGS6MO', label: '6M', years: 0.5 },
  { id: 'DGS1', label: '1Y', years: 1 },
  { id: 'DGS2', label: '2Y', years: 2 },
  { id: 'DGS3', label: '3Y', years: 3 },
  { id: 'DGS5', label: '5Y', years: 5 },
  { id: 'DGS7', label: '7Y', years: 7 },
  { id: 'DGS10', label: '10Y', years: 10 },
  { id: 'DGS20', label: '20Y', years: 20 },
  { id: 'DGS30', label: '30Y', years: 30 },
];

app.get('/api/v1/yieldcurve', async (req, res) => {
  try {
    const cached = cacheGet('yieldcurve');
    if (cached) return res.json(cached);

    // ~1y of daily observations lets us read today, ~1M ago and ~1Y ago
    // from a single request per tenor.
    const series = await Promise.all(
      CURVE_TENORS.map(t => fredFetch(t.id, { limit: 400, sort: 'desc' }).catch(() => null))
    );

    const pickBack = (obs, daysAgo) => {
      if (!obs) return null;
      const target = Date.now() - daysAgo * 86400000;
      // Observations are newest-first; find the first at or before the target.
      const hit = obs.find(o => o.value !== '.' && new Date(o.date).getTime() <= target);
      return hit ? parseFloat(hit.value) : null;
    };

    const points = CURVE_TENORS.map((t, i) => {
      const obs = (series[i] || []).filter(o => o.value !== '.');
      const latest = obs[0] ? parseFloat(obs[0].value) : null;
      return {
        tenor: t.label, years: t.years, seriesId: t.id,
        current: latest,
        monthAgo: pickBack(obs, 30),
        yearAgo: pickBack(obs, 365),
        date: obs[0]?.date || null,
      };
    });

    const get = (label) => points.find(p => p.tenor === label)?.current ?? null;
    const spread = (a, b) => (a != null && b != null) ? +(a - b).toFixed(2) : null;

    const s10y2y = spread(get('10Y'), get('2Y'));
    const s10y3m = spread(get('10Y'), get('3M'));
    const s30y10y = spread(get('30Y'), get('10Y'));

    // An inverted curve (long yields below short) has preceded most US
    // recessions; 10y-2y and 10y-3m are the conventional reads.
    const inverted = [s10y2y, s10y3m].filter(v => v != null && v < 0).length > 0;
    const shape = s10y2y == null ? 'unknown'
      : s10y2y < 0 ? 'Inverted'
      : s10y2y < 0.5 ? 'Flat'
      : 'Normal';

    const result = {
      points: points.filter(p => p.current != null),
      spreads: { '10Y-2Y': s10y2y, '10Y-3M': s10y3m, '30Y-10Y': s30y10y },
      inverted, shape,
      asOf: points.find(p => p.date)?.date || null,
    };

    cacheSet(result.points.length ? 'yieldcurve' : 'skip', result, 3600000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/comps?symbol=AAPL — Peer comparable-company analysis
// ---------------------------------------------------------------------------
app.get('/api/v1/comps', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'AAPL').toUpperCase();
    const cacheKey = `comps:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const peerList = await finnhubFetch(`/stock/peers?symbol=${symbol}`);
    if (!Array.isArray(peerList) || !peerList.length) {
      return res.json({ symbol, available: false, message: 'No peers found' });
    }

    // Keep the subject first, cap the set so we stay inside rate limits.
    const symbols = [symbol, ...peerList.filter(p => p !== symbol)].slice(0, 8);

    const [metricResults, quotes] = await Promise.all([
      Promise.allSettled(symbols.map(s => finnhubFetch(`/stock/metric?symbol=${s}&metric=all`))),
      yahooQuoteBatch(symbols),
    ]);
    const quoteBy = new Map(quotes.map(q => [q.symbol, q]));

    const rows = symbols.map((s, i) => {
      const m = metricResults[i].status === 'fulfilled' ? (metricResults[i].value?.metric || {}) : {};
      const q = quoteBy.get(s);
      return {
        symbol: s,
        isSubject: s === symbol,
        price: q?.price ?? null,
        changePercent: q?.changePercent ?? null,
        marketCap: m['marketCapitalization'] ?? null,
        peRatio: m['peBasicExclExtraTTM'] ?? m['peTTM'] ?? null,
        pbRatio: m['pbAnnual'] ?? null,
        psRatio: m['psAnnual'] ?? null,
        evToEbitda: m['enterpriseValueOverEBITDATTM'] ?? null,
        grossMargin: m['grossMarginTTM'] ?? null,
        netMargin: m['netProfitMarginTTM'] ?? null,
        roe: m['roeTTM'] ?? null,
        revenueGrowth: m['revenueGrowthTTMYoy'] ?? null,
        debtToEquity: m['totalDebt/totalEquityAnnual'] ?? null,
      };
    }).filter(r => r.price != null || r.marketCap != null);

    // Peer median (excluding the subject) is the benchmark to price against.
    const peers = rows.filter(r => !r.isSubject);
    const median = (key) => {
      const vals = peers.map(r => r[key]).filter(v => v != null && isFinite(v)).sort((a, b) => a - b);
      if (!vals.length) return null;
      const mid = Math.floor(vals.length / 2);
      return +(vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2).toFixed(2);
    };

    const METRICS = ['peRatio', 'pbRatio', 'psRatio', 'evToEbitda', 'grossMargin', 'netMargin', 'roe', 'revenueGrowth', 'debtToEquity'];
    const medians = Object.fromEntries(METRICS.map(k => [k, median(k)]));

    // Premium/discount of the subject vs the peer median, per metric.
    const subject = rows.find(r => r.isSubject);
    const premium = {};
    for (const k of METRICS) {
      const sv = subject?.[k], mv = medians[k];
      premium[k] = (sv != null && mv != null && mv !== 0)
        ? +(((sv - mv) / Math.abs(mv)) * 100).toFixed(1) : null;
    }

    const result = { symbol, available: true, rows, medians, premium, peerCount: peers.length };
    cacheSet(cacheKey, result, 14400000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/breadth — Market internals across the S&P 500 universe.
// Only viable because quotes are batched; this is ~450 symbols per refresh.
// ---------------------------------------------------------------------------
app.get('/api/v1/breadth', async (req, res) => {
  try {
    const cached = cacheGet('breadth');
    if (cached) return res.json(cached);

    const quotes = await yahooQuoteBatch(SP500_ALL);
    const valid = quotes.filter(q => q.price != null && q.changePercent != null);
    if (valid.length < 20) {
      return res.json({ available: false, message: 'Insufficient quote coverage' });
    }

    const advancing = valid.filter(q => q.changePercent > 0).length;
    const declining = valid.filter(q => q.changePercent < 0).length;
    const unchanged = valid.length - advancing - declining;

    // Per-sector advance/decline shows whether strength is broad or narrow.
    const bySector = {};
    for (const q of valid) {
      const sec = SYMBOL_SECTOR[q.symbol];
      if (!sec) continue;
      if (!bySector[sec]) bySector[sec] = { advancing: 0, declining: 0, total: 0, sumChange: 0 };
      const s = bySector[sec];
      s.total++;
      s.sumChange += q.changePercent;
      if (q.changePercent > 0) s.advancing++; else if (q.changePercent < 0) s.declining++;
    }
    const sectors = Object.entries(bySector).map(([name, s]) => ({
      name, advancing: s.advancing, declining: s.declining, total: s.total,
      breadthPct: +((s.advancing / s.total) * 100).toFixed(1),
      avgChange: +(s.sumChange / s.total).toFixed(2),
    })).sort((a, b) => b.breadthPct - a.breadthPct);

    const sorted = [...valid].sort((a, b) => b.changePercent - a.changePercent);
    const adRatio = declining ? +(advancing / declining).toFixed(2) : null;
    const breadthPct = +((advancing / valid.length) * 100).toFixed(1);

    const result = {
      available: true,
      universe: valid.length,
      advancing, declining, unchanged,
      advanceDeclineRatio: adRatio,
      breadthPct,
      // Broad participation vs a handful of names carrying the index.
      signal: breadthPct >= 65 ? 'Broad advance'
        : breadthPct >= 55 ? 'Positive'
        : breadthPct >= 45 ? 'Mixed'
        : breadthPct >= 35 ? 'Negative'
        : 'Broad decline',
      avgChange: +(valid.reduce((s, q) => s + q.changePercent, 0) / valid.length).toFixed(2),
      topGainers: sorted.slice(0, 5).map(q => ({ symbol: q.symbol, changePercent: +q.changePercent.toFixed(2), price: q.price })),
      topLosers: sorted.slice(-5).reverse().map(q => ({ symbol: q.symbol, changePercent: +q.changePercent.toFixed(2), price: q.price })),
      sectors,
    };

    cacheSet('breadth', result, 120000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/technical?symbol=AAPL&resolution=D — Technical analysis
// ---------------------------------------------------------------------------
app.get('/api/v1/technical', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'AAPL').toUpperCase();
    const cacheKey = `technical:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    // A full year of daily candles gives us enough history for every indicator.
    const candles = await yahooCandles(symbol, '1d', '1y').catch(() => []);
    if (candles.length < 30) {
      return res.json({ symbol, available: false, message: 'Insufficient price history' });
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    const price = closes[closes.length - 1];
    const prevCandle = candles[candles.length - 2];

    // --- Moving averages ---
    const ma = {
      sma20: sma(closes, 20), sma50: sma(closes, 50), sma100: sma(closes, 100), sma200: sma(closes, 200),
      ema12: ema(closes, 12), ema26: ema(closes, 26), ema50: ema(closes, 50),
    };

    // --- Oscillators & momentum ---
    const rsi14 = rsi(closes, 14);
    const macdVal = macd(closes);
    const bb = bollinger(closes, 20, 2);
    const stoch = stochastic(highs, lows, closes, 14, 3);
    const atr14 = atr(highs, lows, closes, 14);
    const adxVal = adx(highs, lows, closes, 14);
    const cci = (() => {
      const period = 20;
      if (closes.length < period) return null;
      const tp = candles.slice(-period).map(c => (c.high + c.low + c.close) / 3);
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
      return hh === ll ? -50 : ((hh - price) / (hh - ll)) * -100;
    })();

    // --- 52-week range & position ---
    const week52High = Math.max(...highs);
    const week52Low = Math.min(...lows);
    const rangePosition = week52High === week52Low ? 50 : ((price - week52Low) / (week52High - week52Low)) * 100;

    // --- Volume ---
    const avgVol20 = sma(volumes, 20);
    const volumeRatio = avgVol20 ? volumes[volumes.length - 1] / avgVol20 : null;

    // --- Pivot points from the last completed session ---
    const pivots = prevCandle ? pivotPoints(prevCandle.high, prevCandle.low, prevCandle.close) : null;

    // --- Signal scoring: each indicator votes buy / sell / neutral ---
    const signals = [];
    const vote = (name, value, signal) => signals.push({ name, value, signal });

    if (rsi14 != null) vote('RSI (14)', +rsi14.toFixed(2), rsi14 > 70 ? 'sell' : rsi14 < 30 ? 'buy' : 'neutral');
    if (macdVal) vote('MACD (12,26,9)', +macdVal.histogram.toFixed(3), macdVal.histogram > 0 ? 'buy' : macdVal.histogram < 0 ? 'sell' : 'neutral');
    if (stoch) vote('Stochastic (14,3)', +stoch.k.toFixed(2), stoch.k > 80 ? 'sell' : stoch.k < 20 ? 'buy' : 'neutral');
    if (cci != null) vote('CCI (20)', +cci.toFixed(2), cci > 100 ? 'sell' : cci < -100 ? 'buy' : 'neutral');
    if (williamsR != null) vote('Williams %R', +williamsR.toFixed(2), williamsR > -20 ? 'sell' : williamsR < -80 ? 'buy' : 'neutral');
    if (adxVal) vote('ADX (14)', +adxVal.adx.toFixed(2), adxVal.adx > 25 ? (adxVal.plusDI > adxVal.minusDI ? 'buy' : 'sell') : 'neutral');
    if (ma.sma20 != null) vote('SMA 20', +ma.sma20.toFixed(2), price > ma.sma20 ? 'buy' : 'sell');
    if (ma.sma50 != null) vote('SMA 50', +ma.sma50.toFixed(2), price > ma.sma50 ? 'buy' : 'sell');
    if (ma.sma200 != null) vote('SMA 200', +ma.sma200.toFixed(2), price > ma.sma200 ? 'buy' : 'sell');
    if (ma.ema12 != null) vote('EMA 12', +ma.ema12.toFixed(2), price > ma.ema12 ? 'buy' : 'sell');
    if (ma.ema26 != null) vote('EMA 26', +ma.ema26.toFixed(2), price > ma.ema26 ? 'buy' : 'sell');
    if (bb) vote('Bollinger Bands', +bb.middle.toFixed(2), price > bb.upper ? 'sell' : price < bb.lower ? 'buy' : 'neutral');

    const buyCount = signals.filter(s => s.signal === 'buy').length;
    const sellCount = signals.filter(s => s.signal === 'sell').length;
    const neutralCount = signals.filter(s => s.signal === 'neutral').length;
    const score = buyCount - sellCount;
    let overall = 'NEUTRAL';
    if (score >= 6) overall = 'STRONG BUY';
    else if (score >= 2) overall = 'BUY';
    else if (score <= -6) overall = 'STRONG SELL';
    else if (score <= -2) overall = 'SELL';

    // Golden / death cross detection.
    let maCross = null;
    if (ma.sma50 != null && ma.sma200 != null) {
      maCross = ma.sma50 > ma.sma200 ? 'Golden Cross (bullish)' : 'Death Cross (bearish)';
    }

    const result = {
      symbol,
      available: true,
      price: +price.toFixed(2),
      summary: { overall, buy: buyCount, sell: sellCount, neutral: neutralCount, score },
      movingAverages: {
        sma20: ma.sma20 && +ma.sma20.toFixed(2), sma50: ma.sma50 && +ma.sma50.toFixed(2),
        sma100: ma.sma100 && +ma.sma100.toFixed(2), sma200: ma.sma200 && +ma.sma200.toFixed(2),
        ema12: ma.ema12 && +ma.ema12.toFixed(2), ema26: ma.ema26 && +ma.ema26.toFixed(2),
        ema50: ma.ema50 && +ma.ema50.toFixed(2), cross: maCross,
      },
      oscillators: {
        rsi14: rsi14 && +rsi14.toFixed(2),
        macd: macdVal && { macd: +macdVal.macd.toFixed(3), signal: +macdVal.signal.toFixed(3), histogram: +macdVal.histogram.toFixed(3) },
        stochastic: stoch && { k: +stoch.k.toFixed(2), d: +stoch.d.toFixed(2) },
        cci20: cci != null ? +cci.toFixed(2) : null,
        williamsR: williamsR != null ? +williamsR.toFixed(2) : null,
        atr14: atr14 && +atr14.toFixed(2),
        adx: adxVal && { adx: +adxVal.adx.toFixed(2), plusDI: +adxVal.plusDI.toFixed(2), minusDI: +adxVal.minusDI.toFixed(2) },
      },
      bollinger: bb && { upper: +bb.upper.toFixed(2), middle: +bb.middle.toFixed(2), lower: +bb.lower.toFixed(2), bandwidth: +bb.bandwidth.toFixed(2) },
      range52w: { high: +week52High.toFixed(2), low: +week52Low.toFixed(2), position: +rangePosition.toFixed(1) },
      volume: { latest: volumes[volumes.length - 1], avg20: avgVol20 && Math.round(avgVol20), ratio: volumeRatio && +volumeRatio.toFixed(2) },
      pivots: pivots && Object.fromEntries(Object.entries(pivots).map(([k, v]) => [k, +v.toFixed(2)])),
      signals,
      candleCount: candles.length,
    };

    cacheSet(cacheKey, result, 300000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/screener?sector=Technology&minPE=0&maxPE=30 — Stock screener
// ---------------------------------------------------------------------------
app.get('/api/v1/screener', async (req, res) => {
  try {
    const { sector, minPE, maxPE, minChange, maxChange } = req.query;
    const cacheKey = `screener:${sector || 'all'}:${minPE || ''}:${maxPE || ''}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let symbols = [];
    if (sector && SP500_BY_SECTOR[sector]) {
      // Full per-sector S&P 500 list (capped to keep response time reasonable).
      symbols = SP500_BY_SECTOR[sector].slice(0, 30);
    } else {
      // "All" scans a broad sample across every sector.
      symbols = Object.values(SP500_BY_SECTOR).flatMap(list => list.slice(0, 10));
    }

    const results = await Promise.allSettled(symbols.map(s => yahooQuote(s)));
    let stocks = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (minChange) stocks = stocks.filter(s => s.changePercent >= parseFloat(minChange));
    if (maxChange) stocks = stocks.filter(s => s.changePercent <= parseFloat(maxChange));

    stocks.sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));

    cacheSet(cacheKey, stocks, 300000);
    res.json(stocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/sectors?period=3mo — Sector ETF performance
// ---------------------------------------------------------------------------
app.get('/api/v1/sectors', async (req, res) => {
  try {
    const period = req.query.period || '3mo';
    const cacheKey = `sectors:${period}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const sectorETFs = {
      'Technology': 'XLK', 'Financial': 'XLF', 'Healthcare': 'XLV',
      'Energy': 'XLE', 'Consumer Discretionary': 'XLY', 'Consumer Staples': 'XLP',
      'Industrials': 'XLI', 'Materials': 'XLB', 'Real Estate': 'XLRE',
      'Utilities': 'XLU', 'Communication': 'XLC',
    };

    const spyResult = await yahooCandles('SPY', '1d', period).catch(() => []);
    const spyStart = spyResult[0]?.close || 1;
    const spyEnd = spyResult[spyResult.length - 1]?.close || spyStart;
    const spyReturn = ((spyEnd - spyStart) / spyStart) * 100;

    const entries = Object.entries(sectorETFs);
    const results = await Promise.allSettled(
      entries.map(([, etf]) => yahooCandles(etf, '1d', period))
    );

    const sectors = entries.map(([name, etf], i) => {
      const r = results[i];
      if (r.status !== 'fulfilled' || r.value.length < 2) {
        return { name, etf, performance: 0, relativeStrength: 0 };
      }
      const candles = r.value;
      const startPrice = candles[0].close;
      const endPrice = candles[candles.length - 1].close;
      const performance = ((endPrice - startPrice) / startPrice) * 100;
      return {
        name, etf, performance: +performance.toFixed(2),
        relativeStrength: +(performance - spyReturn).toFixed(2),
      };
    });

    sectors.sort((a, b) => b.performance - a.performance);
    const result = { period, spyReturn: +spyReturn.toFixed(2), sectors };

    cacheSet(cacheKey, result, 600000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/risk?symbols=AAPL,MSFT,GOOGL — Portfolio risk analytics
// ---------------------------------------------------------------------------
app.get('/api/v1/risk', async (req, res) => {
  try {
    const symbols = (req.query.symbols || 'AAPL,MSFT,GOOGL').split(',').map(s => s.trim().toUpperCase());
    const cacheKey = `risk:${symbols.join(',')}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [spyCandles, ...stockCandles] = await Promise.all([
      yahooCandles('SPY', '1d', '1y'),
      ...symbols.map(s => yahooCandles(s, '1d', '1y').catch(() => [])),
    ]);

    const calcReturns = (candles) => {
      const returns = [];
      for (let i = 1; i < candles.length; i++) {
        if (candles[i].close && candles[i-1].close) {
          returns.push((candles[i].close - candles[i-1].close) / candles[i-1].close);
        }
      }
      return returns;
    };

    const spyReturns = calcReturns(spyCandles);
    const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
    const stdDev = arr => { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); };

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
      const spyVar = (() => { const m = mean(spyReturns.slice(0, minLen)); return spyReturns.slice(0, minLen).reduce((s, v) => s + (v - m) ** 2, 0) / minLen; })();
      const beta = spyVar ? covariance / spyVar : 1;

      stockStats.push({ symbol: symbols[si], beta: +beta.toFixed(2), volatility: +(stdDev(returns) * Math.sqrt(252) * 100).toFixed(2) });
    }

    portfolioReturns = portfolioReturns.filter(r => r !== 0);
    const portVol = stdDev(portfolioReturns) * Math.sqrt(252) * 100;
    const portReturn = mean(portfolioReturns) * 252 * 100;
    const sharpe = portVol ? (portReturn - 4.5) / portVol : 0;

    let maxDD = 0, peak = 1;
    let cumulative = 1;
    for (const r of portfolioReturns) {
      cumulative *= (1 + r);
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
      stocks: stockStats,
    };

    cacheSet(cacheKey, result, 900000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/options?symbol=AAPL — Options chain
// ---------------------------------------------------------------------------
app.get('/api/v1/options', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'AAPL').toUpperCase();
    const date = req.query.date || '';
    const cacheKey = `options:${symbol}:${date}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const empty = { symbol, expirationDates: [], currentPrice: null, calls: [], puts: [] };

    // Yahoo's v7 options endpoint now often requires a crumb/cookie; try both
    // hosts and degrade gracefully rather than returning a 500.
    const auth = await getYahooAuth();
    let chain = null;
    for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
      try {
        const crumbParam = auth?.crumb ? `${date ? '&' : '?'}crumb=${encodeURIComponent(auth.crumb)}` : '';
        const url = `https://${host}/v7/finance/options/${symbol}${date ? `?date=${date}` : ''}${crumbParam}`;
        const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };
        if (auth?.cookie) headers['Cookie'] = auth.cookie;
        const resp = await fetch(url, { headers });
        if (!resp.ok) continue;
        const data = await resp.json();
        chain = data.optionChain?.result?.[0];
        if (chain) break;
      } catch { /* try next host */ }
    }

    if (!chain) {
      // Cache briefly so we don't hammer Yahoo on every poll while it's blocked.
      cacheSet(cacheKey, empty, 60000);
      return res.json(empty);
    }

    const spot = chain.quote?.regularMarketPrice || null;
    // Short-rate proxy for discounting; falls back if FRED is unavailable.
    const riskFree = await (async () => {
      try {
        const obs = await fredFetch('DGS3MO', { limit: 5 });
        const v = (obs || []).find(o => o.value !== '.');
        return v ? parseFloat(v.value) / 100 : 0.045;
      } catch { return 0.045; }
    })();

    const mapContract = (type) => (c) => {
      const base = {
        strike: c.strike, lastPrice: c.lastPrice, bid: c.bid, ask: c.ask,
        change: c.change, percentChange: c.percentChange, volume: c.volume || 0,
        openInterest: c.openInterest || 0, impliedVolatility: c.impliedVolatility,
        inTheMoney: c.inTheMoney, expiration: c.expiration,
        contractSymbol: c.contractSymbol,
      };
      if (spot == null || !c.expiration || !c.strike) return base;

      const T = yearsToExpiry(c.expiration);
      // Prefer a mid-market price for solving IV; fall back to last traded.
      const mid = (c.bid != null && c.ask != null && c.bid > 0 && c.ask > 0)
        ? (c.bid + c.ask) / 2 : c.lastPrice;
      // Trust our own solve over the feed's IV so Greeks stay self-consistent.
      const iv = (mid > 0 ? impliedVol(type, mid, spot, c.strike, T, riskFree) : null)
        ?? c.impliedVolatility ?? null;

      return {
        ...base,
        computedIV: iv != null ? +iv.toFixed(4) : null,
        greeks: iv ? bsGreeks(type, spot, c.strike, T, riskFree, iv) : null,
      };
    };

    const calls = (chain.options?.[0]?.calls || []).map(mapContract('call'));
    const puts = (chain.options?.[0]?.puts || []).map(mapContract('put'));

    // Options-flow sentiment (Phase 3.5).
    const sum = (arr, k) => arr.reduce((s, c) => s + (c[k] || 0), 0);
    const callVol = sum(calls, 'volume'), putVol = sum(puts, 'volume');
    const callOI = sum(calls, 'openInterest'), putOI = sum(puts, 'openInterest');

    // Max pain: the strike where total option holder value is lowest.
    let maxPain = null;
    if (calls.length && puts.length) {
      const strikes = [...new Set([...calls, ...puts].map(c => c.strike))].sort((a, b) => a - b);
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
      calls, puts,
      sentiment: {
        putCallVolumeRatio: callVol ? +(putVol / callVol).toFixed(3) : null,
        putCallOIRatio: callOI ? +(putOI / callOI).toFixed(3) : null,
        totalCallVolume: callVol, totalPutVolume: putVol,
        maxPain,
      },
    };

    cacheSet(cacheKey, result, 120000);
    res.json(result);
  } catch (err) {
    // Never 500 the dashboard — return an empty chain the panel can render.
    res.json({ symbol: (req.query.symbol || 'AAPL').toUpperCase(), expirationDates: [], currentPrice: null, calls: [], puts: [] });
  }
});


// ---------------------------------------------------------------------------
// Trading bot (PAPER trading only)
// ---------------------------------------------------------------------------

// Internal helpers so the engine reuses our own analytics rather than
// re-implementing them.
const botFetchTechnical = async (symbol) => {
  const resp = await fetch(`http://127.0.0.1:${port}/api/v1/technical?symbol=${symbol}`);
  return resp.ok ? resp.json() : null;
};
const botFetchNews = async (symbol) => {
  const resp = await fetch(`http://127.0.0.1:${port}/api/v1/news?symbol=${symbol}&limit=5`);
  return resp.ok ? resp.json() : [];
};

app.get('/api/v1/bot/status', async (req, res) => {
  try {
    const state = bot.getState();
    let account = null, positions = [], clock = null;
    if (state.brokerConfigured) {
      [account, positions, clock] = await Promise.all([
        broker.getAccount().catch(() => null),
        broker.getPositions().catch(() => []),
        broker.getClock().catch(() => null),
      ]);
    }
    res.json({ ...state, account, positions, marketOpen: clock?.isOpen ?? null, nextOpen: clock?.nextOpen ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The on/off switch.
app.post('/api/v1/bot/toggle', (req, res) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
  const result = bot.setEnabled(enabled);
  res.status(result.ok ? 200 : 409).json({ ...result, state: bot.getState() });
});

app.post('/api/v1/bot/config', (req, res) => {
  res.json(bot.updateConfig(req.body || {}));
});

app.post('/api/v1/bot/reset-halt', (req, res) => {
  res.json({ ...bot.resetHalt(), state: bot.getState() });
});

// Run one cycle. dryRun evaluates and logs without submitting orders.
app.post('/api/v1/bot/run', async (req, res) => {
  try {
    const result = await bot.runCycle({
      fetchTechnical: botFetchTechnical,
      fetchNews: botFetchNews,
      dryRun: Boolean(req.body?.dryRun),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/bot/kill', async (req, res) => {
  try {
    res.json({ ...(await bot.killSwitch()), state: bot.getState() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/bot/decisions', (req, res) => {
  res.json(bot.getDecisions(parseInt(req.query.limit) || 50));
});

app.get('/api/v1/bot/audit', (req, res) => {
  res.json(bot.getAudit(parseInt(req.query.limit) || 50));
});

app.get('/api/v1/bot/orders', async (req, res) => {
  try {
    res.json(await broker.getOrders(req.query.status || 'all', parseInt(req.query.limit) || 50));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export for Vercel serverless
export default app;

// Only listen when run directly (not imported as module)
const isDirectRun = process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server'));
if (isDirectRun) {
  app.listen(port, () => {
    console.log(`QuantBloom Terminal API running on http://localhost:${port}`);
  });
}
