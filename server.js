import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

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
// ---------------------------------------------------------------------------
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const FRED_KEY = process.env.FRED_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const MARKETAUX_KEY = process.env.MARKETAUX_API_KEY;

// ---------------------------------------------------------------------------
// Heatmap Constituents — static list of top stocks per GICS sector
// ---------------------------------------------------------------------------
const HEATMAP_CONSTITUENTS = {
  "Information Technology": ["AAPL","MSFT","NVDA","AVGO","ORCL","AMD","INTC"],
  "Health Care": ["LLY","UNH","JNJ","ABBV","MRK","TMO","ABT"],
  "Financials": ["BRK-B","JPM","V","MA","BAC","WFC","GS"],
  "Consumer Discretionary": ["AMZN","TSLA","HD","MCD","NKE","SBUX"],
  "Communication Services": ["META","GOOGL","GOOG","NFLX","DIS","CMCSA"],
  "Industrials": ["GE","CAT","UNP","RTX","HON","BA"],
  "Consumer Staples": ["PG","KO","PEP","COST","WMT","PM"],
  "Energy": ["XOM","CVX","COP","SLB","EOG","MPC"],
  "Utilities": ["NEE","SO","DUK","SRE","AEP","D"],
  "Real Estate": ["PLD","AMT","EQIX","SPG","PSA","O"],
  "Materials": ["LIN","APD","SHW","FCX","NEM","ECL"]
};

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

    const quotes = await Promise.all(
      symbols.map(async (sym) => {
        try { return await yahooQuote(sym); }
        catch {
          try {
            const av = await alphaVantageQuote(sym);
            if (av) return av;
          } catch {}
          return { symbol: sym, price: null, change: 0, changePercent: 0, volume: 0, error: true };
        }
      })
    );
    cacheSet(cacheKey, quotes, 8000);
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message, stale: false });
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
    const cacheKey = `news:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const articles = [];

    // Finnhub general news
    if (FINNHUB_KEY) {
      try {
        const finnNews = await finnhubFetch('/news?category=general');
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
              relatedSymbol: extractSymbol(a.headline),
            });
          });
        }
      } catch {}
    }

    // Marketaux news (richer financial news with entity extraction)
    if (MARKETAUX_KEY && articles.length < limit) {
      try {
        const mxNews = await marketauxFetch({ limit: limit - articles.length, filter_entities: true });
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
      const allSymbols = Object.values(HEATMAP_CONSTITUENTS).flat();
      results = allSymbols
        .filter(s => s.startsWith(q))
        .slice(0, 10)
        .map(s => ({ symbol: s, name: s }));
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

app.listen(port, () => {
  console.log(`Bloomberg Terminal API running on http://localhost:${port}`);
});
