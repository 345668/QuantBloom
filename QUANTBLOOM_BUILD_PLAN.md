# QuantBloom Terminal — Full Build Plan

> **Project:** QuantBloom Terminal — Day Trading Dashboard
> **Date:** 2026-07-18
> **Source:** Traycer AI Epic Brief, Core Flows, Tech Plan & Ticket Breakdown (extracted from planning session screenshots)
> **Original Prompt:** "I need a financial dashboard app like the Bloomberg terminal. It must show real-time stock prices, news, and other pertinent information that would be needed when day trading. The data must come from real sources that are not paywalled and be presented in a visual style that is commonly seen in financial dashboards like the Bloomberg dashboard. Give deployment options as well."

---

## Table of Contents

1. [Summary](#1-summary)
2. [Context & Problem](#2-context--problem)
3. [Who Is Affected](#3-who-is-affected)
4. [Goals](#4-goals)
5. [Scope](#5-scope)
6. [Constraints](#6-constraints)
7. [Success Criteria](#7-success-criteria)
8. [Dashboard Layout](#8-dashboard-layout)
9. [Core User Flows](#9-core-user-flows)
10. [Architectural Approach](#10-architectural-approach)
11. [Key Architectural Decisions](#11-key-architectural-decisions)
12. [Polling Intervals & Cache TTLs](#12-polling-intervals--cache-ttls)
13. [Failure Modes & Recovery](#13-failure-modes--recovery)
14. [Data Model — Core Interfaces](#14-data-model--core-interfaces)
15. [Frontend Persisted State](#15-frontend-persisted-state)
16. [Sentiment Tagging Logic](#16-sentiment-tagging-logic)
17. [Hardcoded Heatmap Constituents](#17-hardcoded-heatmap-constituents)
18. [Component Architecture](#18-component-architecture)
19. [Backend — Express Route Structure](#19-backend--express-route-structure)
20. [Frontend State & Context](#20-frontend-state--context)
21. [Frontend Data Fetching Strategy](#21-frontend-data-fetching-strategy)
22. [Charting Library](#22-charting-library)
23. [Theme System](#23-theme-system)
24. [Deployment Architecture](#24-deployment-architecture)
25. [Implementation Tickets](#25-implementation-tickets)
26. [Execution Order](#26-execution-order)

---

## 1. Summary

This project delivers a professional terminal-inspired financial dashboard for individual day traders. It is a single-user, local-first web application that aggregates real-time market data from free, non-paywalled sources and presents it in a dense, information-rich multi-panel interface. The goal is to give a retail day trader a professional-grade information environment — live prices, candlestick charts with technical indicators, market-wide sector performance, financial news with sentiment context, and an economic calendar — without requiring a Bloomberg subscription or any paid data feed.

---

## 2. Context & Problem

Professional trading terminals (Bloomberg, Refinitiv) cost thousands of dollars per month and are inaccessible to retail traders. Free alternatives (Yahoo Finance web, Google Finance) are consumer-grade: slow, ad-heavy, single-asset views with no multi-panel layout, no real-time streaming, and no integrated news sentiment. A retail day trader who needs to monitor multiple symbols, track sector rotation, read breaking news, and anticipate macro events must currently juggle five or more browser tabs — losing critical seconds and context during fast-moving market conditions.

---

## 3. Who Is Affected

**Primary user:** A single retail day trader running this tool locally on their own machine. No multi-user scenario. No institutional use case.

---

## 4. Goals

| # | Goal |
|---|------|
| 1 | Provide a unified, always-on dashboard that surfaces all information needed for intraday trading decisions in one view |
| 2 | Use only free, non-paywalled data sources (Yahoo Finance, Finnhub free tier, NewsAPI free tier) |
| 3 | Match the visual density and dark-terminal aesthetic of professional trading platforms |
| 4 | Persist user preferences (watchlist, active symbol, theme) locally — no backend database, no login |
| 5 | Be deployable to free/low-cost PaaS infrastructure (Vercel + Railway/Render) |

---

## 5. Scope

### In Scope (v1)

- Scrolling price ticker (mirrors watchlist, live prices)
- Candlestick/OHLCV chart with MA, RSI, MACD, Bollinger Bands overlays; 7 timeframes (1m–1M)
- Market news feed with Bullish/Bearish/Neutral sentiment tags
- S&P 500 sector heatmap (11 GICS sectors, top constituent stocks)
- Economic calendar (earnings, Fed meetings, macro releases)
- Classic terminal dark theme (amber/orange on black) + light mode toggle
- Deployment configs for Vercel (frontend) and Railway/Render (backend)

### Out of Scope (v1)

- User authentication or multi-user support
- Price alerts / push notifications
- Options chain viewer
- Resizable or drag-and-drop panel layout
- Paid data sources

---

## 6. Constraints

- All market data must come from free API tiers; API keys stored in `.env` files, never committed
- No user database; all personalization via `localStorage`
- Backend (Node.js/Express) acts as a data proxy/aggregator to protect API keys and handle CORS
- Frontend deployed as a static React build; backend deployed as a standalone service

---

## 7. Success Criteria

- Dashboard loads and displays live data across all 5 panels within 3 seconds on a standard broadband connection
- Candlestick chart updates in real-time (or near-real-time via polling) for the active symbol
- Watchlist changes are reflected immediately in the ticker and persisted across page reloads
- News articles display a sentiment tag on every headline
- Heatmap correctly groups stocks by GICS sector with accurate % change coloring
- Application is deployable end-to-end following the included deployment documentation

---

## 8. Dashboard Layout

The dashboard is a single fixed-grid page with no navigation between pages. All flows operate within this view.

```
┌─────────────────────────────────────────────────────────────────────┐
│ TERMINAL    ≡ WATCHLIST                    ◐ LIGHT MODE  09:42:31 EST │
├─────────────────────────────────────────────────────────────────────┤
│ AAPL 189.42 ▲1.2%  TSLA 242.10 ▼0.8%  NVDA 875.30 ▲2.4%  SPY ... │
├──────────────────────────────────┬──────────────────────────────────┤
│ CHART — AAPL          189.42 ▲1.2% Vol: 42.1M │ MARKET NEWS    LIVE │
│ [Search symbol...]    [GO] [+WATCH] │ BULLISH Reuters · 09:30    │
│ 1m 5m [15m] 1h 1D 1W 1M         │ AAPL reports record iPhone  │
│ [MA] [BB] [RSI] [MACD]          │ sales, beats Q4 estimates   │
│                                  │ by 12%                      │
│   [ Candlestick Chart ]          │                              │
│                                  ├──────────────────────────────┤
│                                  │ SECTOR HEATMAP — S&P 500    │
│                                  │ ┌────┬────┬────┬────┐       │
│                                  │ │AAPL│MSFT│TSLA│NVDA│       │
│                                  │ │+1.2│+2.3│-0.8│+2.4│       │
│                                  │ ├────┼────┼────┼────┤       │
│                                  │ │META│AMZN│GOOGL│JPM │       │
│                                  │ │-1.3│    │     │    │       │
│                                  │ └────┴────┴────┴────┘       │
├──────────────────────────────────┴──────────────────────────────────┤
│ ECONOMIC CALENDAR                                                    │
│ TIME   EVENT                    EXP    PRIOR                        │
│ 09:30  MACRO  Initial Jobless Claims                                │
│ ●09:55 EPS  AAPL Earnings       $2.10  $1.96                       │
│ 10:30  EPS  MSFT Earnings       $2.82  $2.69                       │
│ 14:00  FED  FOMC Rate Decision  5.25%  5.25%                       │
│ Tomorrow MACRO  CPI MoM         0.3%   0.4%                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Core User Flows

### Flow 1 — Watchlist Management

**Trigger:** User clicks the **WATCHLIST** button in the top navigation bar.

**Steps:**
1. A compact dropdown modal appears below the nav bar, listing all currently watched symbols with their live price and % change.
2. Each symbol row has an **X** button to remove it from the watchlist immediately.
3. At the bottom of the modal, a search input allows the user to type a symbol ticker (e.g. "NVDA"). As they type, a short autocomplete list of matching symbols appears.
4. User selects a symbol from autocomplete (or presses Enter on exact match) → symbol is added to the watchlist instantly.
5. The ticker bar updates in real-time to include the new symbol.
6. User closes the modal by clicking outside it or pressing Escape.
7. The updated watchlist is saved to `localStorage` automatically on every add/remove.

**Feedback:** Removed symbols disappear from the list immediately. Added symbols appear at the bottom of the list with a brief highlight flash. The ticker bar reflects changes within one polling cycle.

### Flow 2 — Loading a Symbol into the Chart

**Trigger:** User clicks any symbol from one of three entry points: the ticker bar, a heatmap cell's "View Chart" button, or the chart panel's own search bar.

**Steps:**

*Via ticker bar:*
1. User clicks a symbol label in the scrolling ticker.
2. Chart panel header updates to show the new symbol and its current price/change.
3. Candlestick chart re-renders with the selected symbol's data at the currently active timeframe.
4. The active symbol is saved to `localStorage`.

*Via chart search bar:*
1. User clicks the search input in the chart panel and types a symbol.
2. An autocomplete dropdown appears with matching results.
3. User selects a result (or presses Enter on exact match).
4. Chart loads the selected symbol. A **+ WATCH** button appears next to the search bar — clicking it adds the symbol to the watchlist.

*Timeframe & overlay changes:*
1. User clicks any timeframe button (1m, 5m, 15m, 1h, 1D, 1W, 1M) → chart re-renders for that period. Active timeframe button is highlighted.
2. User toggles overlay buttons (MA, BB, RSI, MACD) → overlays appear/disappear on the chart. Active overlays are highlighted. Active timeframe is saved to `localStorage`.

**Feedback:** Chart panel shows a subtle loading indicator while data fetches. If a symbol is invalid or data is unavailable, an inline error message appears in the chart area ("No data available for [SYMBOL]").

### Flow 3 — News Feed Browsing

**Trigger:** Dashboard loads; news feed auto-populates with the latest financial headlines. Feed refreshes automatically every 60 seconds.

**Steps:**
1. Each headline displays: sentiment badge (BULLISH / BEARISH / NEUTRAL in color-coded pill), source name, timestamp, and headline text.
2. Headlines are sorted newest-first. User scrolls the news panel to browse older articles.
3. **If the headline is linked to a ticker symbol** (e.g. "AAPL earnings beat"): clicking the headline simultaneously loads that symbol in the chart panel AND opens the full article in a new browser tab.
4. **If the headline has no associated ticker** (e.g. "Fed signals rate hike"): clicking the headline opens the full article in a new browser tab only. No chart change occurs.
5. Sentiment badge color coding: BULLISH = green pill, BEARISH = red pill, NEUTRAL = amber/yellow pill.

**Feedback:** When a symbol-linked headline is clicked, the chart panel header briefly flashes to indicate the symbol has changed. The new tab opens immediately.

### Flow 4 — Heatmap Sector Exploration

**Trigger:** User views the heatmap panel, which displays all 11 GICS sectors with their top constituent stocks as color-coded cells (green = positive % change, red = negative).

**Steps:**
1. User scans the heatmap. Cell color intensity reflects magnitude of % change (dark green = small gain, bright green = large gain; dark red = small loss, bright red = large loss).
2. User hovers over a stock cell → a tooltip/popover appears showing: symbol, company name, current price, % change, and volume.
3. The popover contains a **VIEW CHART** button.
4. User clicks **VIEW CHART** → popover closes, chart panel loads that stock's data at the currently active timeframe.
5. Popover dismisses automatically when the user moves the cursor away or clicks elsewhere.

**Feedback:** The hovered cell gets a bright border highlight. The chart panel updates immediately upon clicking "View Chart."

### Flow 5 — Economic Calendar Interaction

**Trigger:** User views the economic calendar panel (visible on the dashboard at all times). Calendar auto-refreshes daily.

**Steps:**
1. The calendar displays a chronological list of upcoming events for the current trading day and the next 5 trading days.
2. Each event row shows: date, time (EST), event name, and — for macro events — expected vs. prior values.
3. Event types are color-coded: EPS (earnings) = one color, FED = another, MACRO = another.
4. Clicking an earnings event loads that company's stock in the chart panel.
5. Fed/macro events are informational only — no click interaction.

**Feedback:** The chart panel updates immediately when an earnings row is clicked.

### Cross-Panel Symbol Loading — Summary

The chart panel is the central "focus" surface. Multiple panels can trigger a symbol load into it:

```
Ticker Bar → click symbol ──────────────┐
Heatmap Cell → click View Chart ────────┤
Chart Search Bar → select symbol ───────┤──→ Chart Panel loads symbol
News Headline → symbol-linked click ────┤      │
Economic Calendar → click earnings row ─┘      ↓
                                        localStorage updated
                                        with active symbol
```

---

## 10. Architectural Approach

### Overview

The system is a two-service architecture: a static React frontend and a stateless Node.js/Express backend. The backend acts exclusively as a secure API proxy and data aggregator — it holds all API keys, enforces rate limit protection via in-memory caching, and normalises responses from three external data sources into a consistent shape before sending them to the frontend. The frontend is responsible for all rendering, state management, and `localStorage` persistence.

### System Diagram

```
                    ┌──────────────────────┐
                    │  React Frontend      │
                    │  (Vercel)            │
                    └──────┬───────────────┘
                           │ REST polls every N seconds
                           │
              ┌────────────┴────────────┐     Preferences
              │                         │     persisted
              ▼                         ▼
┌─────────────────────────┐    ┌──────────────────┐
│  Node/Express Backend   │    │   localStorage    │
│  (Railway)              │    └──────────────────┘
└──┬──────┬───────┬───────┘
   │      │       │        │
   ▼      ▼       ▼        ▼
Finnhub  Yahoo   NewsAPI  Finnhub
 API    Finance           Calendar
         (yahoo-           API
         finance2)

        ┌──────────────────────┐
        │  In-memory cache     │
        │  JS Map + TTLs       │
        └──────────────────────┘
```

---

## 11. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Real-time data strategy | Polling only (no WebSocket) | Simpler architecture; 5–15s staleness acceptable for ticker |
| Heatmap data | Top 5–10 stocks per sector by market cap, refresh every 60s | Recommended for manageable API usage |
| Server-side caching | In-memory cache (JS Map, per-endpoint TTLs) | Zero dependencies; stateless backend; cache loss on restart is acceptable |
| Rate limit protection | In-memory cache (JS Map, per-endpoint TTLs) | Zero dependencies; stateless backend; cache loss on restart is acceptable |
| State management | React Context + `useReducer` | Sufficient for single-page, single-user app; no Redux overhead |
| Persistence | `localStorage` only | No database; no auth; preferences survive page reload |
| Monorepo structure | `/frontend` + `/backend` in one repo | Simplifies deployment coordination and shared type definitions |

---

## 12. Polling Intervals & Cache TTLs

| Data Type | Frontend Poll | Backend Cache TTL | Source |
|-----------|--------------|-------------------|--------|
| Watchlist quotes (ticker) | 10s | 8s | Finnhub REST quote |
| Active chart — intraday (1m–1h) | 15s | 12s | Finnhub candles |
| Active chart — daily+ (1D–1M) | 60s | 55s | Yahoo Finance |
| Heatmap sector quotes | 60s | 55s | Yahoo Finance batch |
| News feed | 60s | 55s | NewsAPI + Finnhub news |
| Economic calendar | On load + daily | 1h | Finnhub calendar |

The cache TTL is always slightly shorter than the frontend poll interval to ensure the frontend never receives a stale-cache response when it polls.

---

## 13. Failure Modes & Recovery

| Failure | Behaviour |
|---------|-----------|
| External API returns error | Backend returns last cached value if available; otherwise returns `{ error, stale: ... }` |
| Cache miss + API down | Frontend shows last-known data with a "stale data" indicator in the panel header |
| `yahoo-finance2` rate-limited | Exponential backoff on the backend; frontend shows loading state |
| NewsAPI daily limit hit (100 req/day free) | Fall back to Finnhub news only; no user-visible error |
| Backend cold start (Railway free tier sleeps) | Frontend shows a "Connecting..." overlay; retries every 3s for up to 30s |

---

## 14. Data Model — Core Interfaces

```typescript
// Quote — used by ticker, watchlist modal, heatmap popover
interface Quote {
  symbol: string;
  price: number;
  change: number;       // absolute
  changePercent: number; // percentage
  volume: number;
}

// Candle — used by candlestick chart
interface Candle {
  time: number;   // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// NewsArticle — used by news feed panel
interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;           // ISO timestamp
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentSource: 'finnhub' | 'heuristic';
  relatedSymbol: string | null;
}

// HeatmapStock — used by sector heatmap
interface HeatmapStock {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  sector: string;       // GICS sector name
}

// CalendarEvent — used by economic calendar
interface CalendarEvent {
  date: string;          // ISO date
  time: string;          // HH:MM EST
  type: 'earnings' | 'fed' | 'macro';
  title: string;
  symbol: string | null; // populated for earnings events only
  expected: string | null;
  prior: string | null;
}
```

---

## 15. Frontend Persisted State

All preferences stored in `localStorage`:

| Key | Type | Description |
|-----|------|-------------|
| `terminal_watchlist` | `string[]` | Ordered list of ticker symbols |
| `terminal_active_symbol` | `string` | Currently loaded chart symbol |
| `terminal_active_timeframe` | `string` | Active chart timeframe (e.g. `"15m"`) |
| `terminal_active_overlays` | `string[]` | Active chart overlays (e.g. `["MA","BB"]`) |
| `terminal_theme` | `"dark" \| "light"` | UI theme preference |

---

## 16. Sentiment Tagging Logic

Sentiment is resolved in the backend news aggregation layer using the following priority:

1. **Finnhub articles:** Use Finnhub's `sentiment` field directly if present and non-null → tag as `finnhub`-sourced.
2. **NewsAPI articles (or Finnhub articles with null sentiment):** Apply keyword heuristic → tag as `heuristic`-sourced.
   - **Bullish keywords:** beat, surge, rally, record, upgrade, buy, growth, profit
   - **Bearish keywords:** miss, drop, fall, cut, downgrade, sell, loss, layoff, crash
   - **Default:** `neutral`

---

## 17. Hardcoded Heatmap Constituents

A static JSON file bundled with the backend defines the top stocks per GICS sector. Example structure:

```typescript
// Approximately 5–8 stocks per sector = ~77 stocks total
const HEATMAP_CONSTITUENTS: Record<string, string[]> = {
  "Information Technology": ["AAPL","MSFT","NVDA","AVGO","ORCL","AMD","INTC"],
  "Health Care": ["LLY","UNH","JNJ","ABBV","MRK","TMO","ABT"],
  "Financials": ["BRK-B","JPM","V","MA","BAC","WFC","GS"],
  // ... 8 more sectors
}
```

This list is updated manually when sector composition changes significantly. It requires no API call to determine which symbols to fetch.

---

## 18. Component Architecture

### Frontend — Component Tree

```
App → DashboardContext.Provider
  ├── Ticker
  │   ├── TickerBar
  │   └── WatchlistModal
  ├── NavBar
  ├── MainContent (grid)
  │   ├── ChartPanel
  │   │   ├── TickerSearch (w/ autocomplete)
  │   │   ├── TimeframeSelector
  │   │   ├── OverlaySelector
  │   │   └── CandlestickChart (lightweight-charts)
  │   ├── NewsFeedPanel
  │   │   └── NewsArticle (per article)
  │   ├── HeatmapPanel
  │   │   ├── SectorGroup (per GICS)
  │   │   │   └── StockCell (per stock)
  │   │   └── HeatmapPopover
  │   └── CalendarPanel
  │       └── CalendarEvent (per event)
  └── ThemeToggle
```

---

## 19. Backend — Express Route Structure

The backend exposes a clean REST API. All routes are prefixed `/api/v1/`.

| Route | Method | Description | Cache TTL | Source |
|-------|--------|-------------|-----------|--------|
| `/api/v1/quotes` | GET | Batch quotes for given symbols (`?symbols=AAPL,TSLA`) | 8s | Finnhub |
| `/api/v1/candles` | GET | OHLCV candles (`?symbol=AAPL&resolution=15&from=...&to=...`) | 12s (intraday) / 55s (daily+) | Finnhub (1m–1h) / Yahoo Finance (1D–1M) |
| `/api/v1/news` | GET | Aggregated news with sentiment (`?limit=30`) | 55s | Finnhub + NewsAPI |
| `/api/v1/heatmap` | GET | Sector heatmap data for all constituents | 55s | Yahoo Finance |
| `/api/v1/calendar` | GET | Economic calendar events (`?days=6`) | 1h | Finnhub |
| `/api/v1/search` | GET | Symbol autocomplete (`?q=AAPL`) | 5m | Finnhub symbol search |

### Backend Service Responsibilities

- **Cache layer:** A singleton `CacheService` wraps all outbound API calls. Before calling an external API, it checks the in-memory Map for a non-expired entry. On miss, it fetches, stores with TTL, and returns.
- **News aggregator:** Fetches from both Finnhub and NewsAPI in parallel, deduplicates by headline similarity, applies sentiment tagging, and returns a merged sorted list.
- **Candle router:** Inspects the `resolution` parameter and routes to Finnhub (for 1, 5, 15, 60) or `yahoo-finance2` (for 1d, 1wk, 1mo). Normalises both responses to the `Candle[]` interface.
- **Heatmap fetcher:** Uses the static constituent list to build a batch quote request to `yahoo-finance2`. Returns `HeatmapStock[]` grouped by sector.

---

## 20. Frontend State & Context

A single `DashboardContext` holds all shared state, managed by `useReducer`:

| State Slice | Type | Consumers |
|-------------|------|-----------|
| `watchlist` | `string[]` | TickerBar, WatchlistModal, ChartPanel (+ WATCH button) |
| `activeSymbol` | `string` | ChartPanel header, all "load chart" triggers |
| `activeTimeframe` | `string` | ChartPanel, TimeframeSelector |
| `activeOverlays` | `string[]` | OverlaySelector, CandlestickChart |
| `theme` | `"dark" \| "light"` | App root (CSS class toggle), ThemeToggle |

**Actions that mutate context:** `SET_SYMBOL`, `SET_TIMEFRAME`, `TOGGLE_OVERLAY`, `ADD_TO_WATCHLIST`, `REMOVE_FROM_WATCHLIST`, `SET_THEME`.

Every mutation also writes the relevant key to `localStorage`.

---

## 21. Frontend Data Fetching Strategy

Each panel owns its own polling loop via a custom `usePolling(url, intervalMs)` hook. The hook fires an initial fetch on mount, then repeats on the interval. It returns `{ data, loading, error, isStale }`. The `isStale` flag is set when the backend returns `{ stale: true }` in its error response, allowing panels to show a visual staleness indicator without crashing.

| Panel | Hook Call | Interval |
|-------|-----------|----------|
| TickerBar | `usePolling('/api/v1/quotes?symbols=...', 10_000)` | 10s |
| ChartPanel | `usePolling('/api/v1/candles?...', 15_000)` | 15s (intraday) / 60s (daily+) |
| NewsFeedPanel | `usePolling('/api/v1/news', 60_000)` | 60s |
| HeatmapPanel | `usePolling('/api/v1/heatmap', 60_000)` | 60s |
| CalendarPanel | `usePolling('/api/v1/calendar', 3_600_000)` | 1h |

---

## 22. Charting Library

The candlestick chart uses **`lightweight-charts`** (by TradingView — MIT licensed, free, no API key). It renders OHLCV candles natively and supports overlay series for MA and Bollinger Bands. RSI and MACD are rendered as separate sub-charts below the main candle chart within the same panel. This library is the industry standard for this use case and has zero cost.

---

## 23. Theme System

Theme is implemented as a CSS class (`theme-dark` / `theme-light`) toggled on the `<body>` element. All colour values are CSS custom properties (variables) defined in two theme blocks. The monospace font (JetBrains Mono or Courier New fallback) is applied globally. No CSS-in-JS library — plain CSS modules per component.

### Dark Theme (default)
```css
--bg-primary: #0a0a0a;
--text-primary: #FF8C00;
--text-secondary: #888;
--accent-up: #00cc44;
--accent-down: #cc2200;
/* etc. */
```

### Light Theme
Corresponding light-mode overrides.

---

## 24. Deployment Architecture

```
             ┌──────────────┐
             │  GitHub Repo  │
             └──┬────────┬──┘
                │        │
         Push to main   Push to main
                │        │
                ▼        ▼
    ┌───────────────┐  ┌──────────────────────┐
    │ Vercel         │  │ Railway               │
    │ Auto-deploy    │  │ Auto-deploy           │
    │ frontend       │  │ backend               │
    └───────┬───────┘  └──────────┬─────────────┘
            │                     │
   REACT_APP_API_URL     FINNHUB_API_KEY,
      env var            NEWSAPI_KEY env vars
```

- **Frontend:** Vercel. Static React build. `vercel.json` configures the build command and output directory. Environment variable `REACT_APP_API_URL` points to the Railway backend URL.
- **Backend:** Railway. Node.js service. `Dockerfile` for containerised deployment. `railway.json` defines the start command. Environment variables `FINNHUB_API_KEY` and `NEWSAPI_KEY` are set in the Railway dashboard. A `render.yaml` is also included as an alternative for Render.com deployment.
- `.env.example` is committed to the repo documenting all required variables. Actual `.env` files are gitignored.

---

## 25. Implementation Tickets

### T1: Monorepo Scaffold, Backend Foundation & Theme System

**Scope:**
- `.env.example` at root documenting: `FINNHUB_API_KEY`, `NEWSAPI_KEY`, `REACT_APP_API_URL`

**Backend foundation (`/backend`):**
- TypeScript + Express project initialised with `ts-node` for development
- `CacheService` singleton: in-memory JS Map with per-key TTL support; methods `get(key)`, `set(key, value, ttlMs)`, `has(key)`
- CORS middleware configured to allow requests from the frontend origin
- Error handling middleware that returns `{ error: string, stale: boolean }` shape
- Health check endpoint: `GET /health` returns `{ status: "ok", timestamp }`
- `nodemon` dev script; `tsc` build script

**Frontend foundation (`/frontend`):**
- React 18 + TypeScript project via Create React App or Vite
- Global CSS custom properties for both themes defined in `index.css`
  - Dark theme (default): `--bg-primary: #0a0a0a`, `--text-primary: #FF8C00`, `--text-secondary: #888`, `--accent-up: #00cc44`, `--accent-down: #cc2200`, etc.
  - Light theme: corresponding light-mode overrides
- `theme-dark` / `theme-light` class toggled on `<body>`; class change triggers CSS variable swap
- JetBrains Mono font loaded (Google Fonts or self-hosted); Courier New as fallback
- `localStorage` utility module: typed `getItem<T>` / `setItem<T>` wrappers for all 5 persisted keys (`terminal_watchlist`, `terminal_active_symbol`, `terminal_active_timeframe`, `terminal_active_overlays`, `terminal_theme`)

**Acceptance Criteria:**
- `cd backend && npm run dev` starts Express on port 3001; `GET /health` returns 200
- `cd frontend && npm start` starts React dev server; page loads with dark theme applied
- Toggling `theme-dark` → `theme-light` on `<body>` visually switches all CSS variables
- `CacheService.set("test", "value", 100)` → `CacheService.get("test")` returns `"value"`; after 100ms returns `null`
- `.env.example` is present and documents all required variables; no `.env` file is committed

---

### T2: Backend API Routes — All Six Endpoints

**Scope:** Implement all six Express routes behind `/api/v1/`:

| Route | Source | Cache TTL |
|-------|--------|-----------|
| `GET /api/v1/quotes?symbols=AAPL,TSLA` | Finnhub REST | 8s |
| `GET /api/v1/candles?symbol=AAPL&resolution=15&from=...&to=...` | Finnhub (intraday) / yahoo-finance2 (daily+) | 12s / 55s |
| `GET /api/v1/news?limit=30` | Finnhub + NewsAPI aggregated | 55s |
| `GET /api/v1/heatmap` | yahoo-finance2 batch | 55s |
| `GET /api/v1/calendar?days=6` | Finnhub calendar | 1h |
| `GET /api/v1/search?q=AAPL` | Finnhub symbol search | 5m |

---

### T3: Frontend Scaffold — Dashboard Layout, DashboardContext & usePolling

**Scope:**
- Fixed grid layout matching the wireframe (ticker bar top, chart left, news + heatmap right, calendar bottom)
- `DashboardContext` with `useReducer` — all 5 state slices, all 6 actions
- `usePolling(url, intervalMs)` custom hook returning `{ data, loading, error, isStale }`
- Stub panels (empty boxes with headers) wired to context

---

### T4: Ticker Bar & Watchlist Panel

- Scrolling ticker bar reading from `watchlist` state, polling `/api/v1/quotes`
- Watchlist modal with add/remove/search/autocomplete
- `localStorage` persistence on every mutation

### T5: Chart Panel + lightweight-charts Integration

- Candlestick chart using `lightweight-charts`
- 7 timeframe buttons (1m, 5m, 15m, 1h, 1D, 1W, 1M)
- Overlay toggles: MA, BB, RSI, MACD
- Search bar with autocomplete + WATCH button
- Symbol loading from all entry points (ticker, heatmap, news, calendar)

### T6: News Feed Panel + Sentiment

- News list with sentiment badges (BULLISH green, BEARISH red, NEUTRAL amber)
- Click-to-load-chart for symbol-linked headlines
- Click opens article in new tab
- Auto-refresh every 60s

### T7: Sector Heatmap Panel

- 11 GICS sector groups with color-coded stock cells
- Color intensity based on % change magnitude
- Hover popover with stock details + VIEW CHART button
- Click loads symbol into chart

### T8: Economic Calendar Panel

- Chronological event list (current day + 5 trading days)
- Color-coded event types (EPS, FED, MACRO)
- Click earnings row → load symbol in chart
- Expected vs. prior values for macro events

### T9: Deployment Configs

- `vercel.json` for frontend deployment
- `Dockerfile` + `railway.json` for backend deployment
- `render.yaml` as Render.com alternative
- `.env.example` documentation
- README with step-by-step deployment instructions

---

## 26. Execution Order

```
T1 (Monorepo Scaffold, Backend Foundation & Theme)
 │
 ├──→ T2 (Backend API Routes)     ──┐
 │                                   │
 └──→ T3 (Frontend Scaffold)       ──┤
                                     │
                                     ▼
                        T4, T5, T6, T7, T8 (all panels — parallel)
                                     │
                                     ▼
                              T9 (Deployment Configs)
```

**9 tickets total**, grouped into 5 dependency layers:
- **Layer 1:** T1 (foundation — must be first)
- **Layer 2:** T2 + T3 (can be worked simultaneously once T1 is done)
- **Layer 3:** T4, T5, T6, T7, T8 (all 5 panel tickets — can be worked in parallel once T2 and T3 are done)
- **Layer 4:** T9 (deployment — can be worked in parallel with Layer 3)

---

## API Keys Required (all free tier)

| Service | Free Tier Limits | Sign Up |
|---------|-----------------|---------|
| **Finnhub** | 60 calls/min | https://finnhub.io/register |
| **NewsAPI** | 100 requests/day | https://newsapi.org/register |
| **Yahoo Finance** (via `yahoo-finance2` npm) | No API key needed | npm package — unofficial scraper |

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, CSS Modules, lightweight-charts |
| Backend | Node.js, Express, TypeScript, yahoo-finance2 |
| State | React Context + useReducer |
| Persistence | localStorage (5 keys) |
| Caching | In-memory JS Map with TTLs |
| Deployment | Vercel (frontend) + Railway/Render (backend) |
| Font | JetBrains Mono / Courier New |
| Theme | CSS custom properties, dark/light toggle |

---

*This plan was synthesized from screenshots of a Traycer AI planning session (Epic Brief, Core Flows, Tech Plan, and Ticket Breakdown specs) and is ready to be used as a comprehensive prompt for any AI coding agent to build the complete application.*
