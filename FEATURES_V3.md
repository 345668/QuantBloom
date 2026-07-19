# Bloomberg Terminal Clone — Feature Roadmap v3

## Purpose
v1 built the dashboard shell; v2 added 13 panels, the S&P 500 universe, market
indices, and a real technical-analysis engine. This document covers what a
working trading floor still expects and we do not yet have.

## Where we are today (v2.1)

**24 API routes / 21 panels.** Quotes, candles, news (3 sources + sentiment),
sector heatmap, economic calendar, FRED macro data, company profile, analyst
ratings with price targets, crypto, forex & commodities, market indices,
fundamentals, earnings & IPO calendars, technical analysis (12 indicators +
signal scoring), stock screener, sector analysis, portfolio risk metrics,
alerts, options chain, watchlist.

**The honest gaps:** we can describe a security well, but we cannot *model* one.
There is no portfolio with real positions, no valuation modelling, no
derivatives maths, no financial statements, no backtesting, and no way to
compare instruments against each other. Charting is read-only. Everything is
polled rather than streamed.

---

## Data-source reality check

Before committing to a feature, know where the data comes from. Our current
keys are Finnhub (free), FRED, Alpha Vantage (free), Marketaux, NewsAPI, and
unauthenticated Yahoo Finance.

| Tier | Meaning | Examples |
|------|---------|----------|
| **A — Have it** | Free tier already returns this | Financial statements, insider transactions, peers, earnings surprises, market status |
| **B — Compute it** | No feed needed; derive from candles/positions we already fetch | Correlation, VaR, Greeks, backtests, Monte Carlo, volume profile, breadth, DCF |
| **C — Blocked** | Needs paid data or a workaround | Level 2 depth, time & sales, real-time tick streaming, 13F holdings, transcripts |

**Tier B is where the leverage is.** Most of what makes a terminal feel
professional is mathematics applied to price history — not exotic data feeds.
Prioritise accordingly, and be explicit in the UI when something is modelled
rather than observed.

---

## Phase 1 — Portfolio & Positions
*The largest single gap. "Risk Analytics" currently analyses a watchlist, which
is a list of tickers, not a portfolio. Without cost basis there is no P&L.*

### 1.1 Position Management
- **What:** Add positions with symbol, quantity, entry price, entry date, and
  optional fees. Persist locally first (localStorage), server-side later.
- **Shows:** market value, unrealised P&L ($ and %), day change, cost basis,
  weight in portfolio.
- **Source:** Tier A — reuses `/api/v1/quotes`.
- **New:** `PortfolioPanel.jsx`, `usePortfolio` hook, position CRUD form.

### 1.2 Trade Blotter
- **What:** Chronological record of buys/sells with realised P&L per closed lot.
- **Detail:** FIFO lot matching, per-trade and cumulative realised P&L.
- **Source:** Tier B — pure bookkeeping.
- **New:** `BlotterPanel.jsx`.

### 1.3 Performance Attribution
- **What:** Break portfolio return into contribution by position and by sector;
  compare against SPY benchmark; time-weighted return.
- **Source:** Tier B — historical candles per holding.
- **New:** `GET /api/v1/portfolio/performance`, `AttributionPanel.jsx`.

### 1.4 Rebalancing
- **What:** Set target weights, see drift from target, and get the trade list
  required to rebalance.
- **Source:** Tier B.
- **New:** folded into `PortfolioPanel.jsx`.

---

## Phase 2 — Quantitative Risk
*Current risk panel gives beta, Sharpe, volatility, max drawdown. That is the
starting point, not the destination.*

### 2.1 Correlation Matrix
- **What:** Pairwise correlation heatmap across holdings/watchlist over a
  selectable window (30/90/180/365d). Highlights concentration risk.
- **Source:** Tier B — daily returns from candles.
- **New:** `GET /api/v1/analytics/correlation`, `CorrelationPanel.jsx`.

### 2.2 Value at Risk
- **What:** VaR and Conditional VaR (expected shortfall) at 95%/99%, via three
  methods: historical, parametric (variance-covariance), and Monte Carlo.
- **Why three:** they disagree, and the disagreement is informative — fat tails
  show up as historical VaR exceeding parametric.
- **Source:** Tier B.
- **New:** `GET /api/v1/analytics/var`, `VaRPanel.jsx`.

### 2.3 Stress Testing
- **What:** Replay historical crises against the current portfolio — 2008 GFC,
  Mar 2020 COVID crash, 2022 rate shock — plus custom shocks (equities −20%,
  rates +200bp, USD +10%).
- **Source:** Tier B — beta-adjusted shock propagation.
- **New:** `GET /api/v1/analytics/stress`, `StressTestPanel.jsx`.

### 2.4 Factor Exposure
- **What:** Regress portfolio returns against Fama-French factors (market, size,
  value, momentum) to reveal unintended style tilts.
- **Source:** Tier B — factor proxies via ETFs (IWM/IWD/MTUM), or FF data files.
- **New:** `GET /api/v1/analytics/factors`, `FactorPanel.jsx`.

### 2.5 Portfolio Optimisation
- **What:** Efficient frontier, minimum-variance and max-Sharpe portfolios,
  plotted against the user's current allocation.
- **Source:** Tier B — mean-variance optimisation over the covariance matrix.
- **New:** `GET /api/v1/analytics/optimize`, `OptimizerPanel.jsx`.
- **Caveat:** label clearly as a historical-input model, not advice.

---

## Phase 3 — Derivatives
*The options panel exists but Yahoo's endpoint now requires crumb auth and
returns empty. Fix the feed, then build the maths on top.*

### 3.1 Repair the Options Feed
- **Problem:** `v7/finance/options` rejects unauthenticated requests; the crumb
  flow added for this is not reliably succeeding.
- **Options:** (a) harden the Yahoo crumb/cookie flow, (b) switch to Finnhub
  `/stock/option-chain` if the plan allows, (c) integrate a dedicated provider.
- **Priority:** blocking for all of Phase 3.

### 3.2 Greeks
- **What:** Delta, gamma, theta, vega, rho per contract via Black-Scholes, plus
  implied volatility solved numerically (Newton-Raphson).
- **Source:** Tier B — needs only price, strike, expiry, rate (FRED), and IV.
- **New:** extend `/api/v1/options`; add Greeks columns to `OptionsPanel.jsx`.

### 3.3 Volatility Surface
- **What:** IV plotted across strike and expiry — the smile/skew in one view.
- **Source:** Tier B from the chain.
- **New:** `VolSurfacePanel.jsx` (heatmap or 3D-ish grid).

### 3.4 Strategy Builder
- **What:** Compose multi-leg strategies (vertical/calendar spreads, straddles,
  strangles, iron condors, covered calls) and render the payoff diagram with
  breakevens, max profit/loss, and net Greeks.
- **Source:** Tier B.
- **New:** `StrategyBuilderPanel.jsx`.

### 3.5 Options Sentiment
- **What:** Put/call ratio (volume and open interest), max pain, unusual volume.
- **Source:** Tier B from the chain.

---

## Phase 4 — Fundamental Depth
*We show ratios. A terminal shows the statements those ratios come from.*

### 4.1 Financial Statements
- **What:** Income statement, balance sheet, and cash flow — annual and
  quarterly, multi-year, with YoY deltas and common-size percentages.
- **Source:** Tier A — Finnhub `/stock/financials-reported`.
- **New:** `GET /api/v1/financials`, `FinancialsPanel.jsx` with statement tabs.

### 4.2 DCF Valuation
- **What:** Discounted cash flow with editable assumptions (revenue growth,
  margin, WACC, terminal growth) producing intrinsic value vs market price, plus
  a sensitivity table across WACC × terminal growth.
- **Source:** Tier B — built on 4.1 cash flows.
- **New:** `GET /api/v1/valuation/dcf`, `DCFPanel.jsx`.
- **Caveat:** a model, and only as good as its inputs. Say so in the UI.

### 4.3 Comparable Company Analysis
- **What:** Peer comps table — EV/EBITDA, P/E, P/S, EV/Sales, margins, growth —
  with peer median and the subject's premium/discount to it.
- **Source:** Tier A — Finnhub `/stock/peers` + existing metrics.
- **New:** `GET /api/v1/comps`, `CompsPanel.jsx`.

### 4.4 Ownership & Insiders
- **What:** Insider buy/sell transactions and aggregate insider sentiment;
  institutional ownership where available.
- **Source:** Tier A for insider transactions/sentiment; Tier C for full 13F.
- **New:** `GET /api/v1/insiders`, `InsidersPanel.jsx`.

### 4.5 Earnings Deep-Dive
- **What:** Surprise history with beat/miss visualisation, revision trends, and
  post-earnings price drift.
- **Source:** Tier A + Tier B.

---

## Phase 5 — Charting Upgrade
*The chart renders candles and four overlays. Traders draw on charts.*

### 5.1 Drawing Tools
Trendlines, horizontal S/R levels, Fibonacci retracement/extension, channels,
rectangles, text annotations. Persist per symbol in localStorage.

### 5.2 More Chart Types
Heikin-Ashi, Renko, Point & Figure, line, area, hollow candles.

### 5.3 More Overlays
Ichimoku Cloud, VWAP (session and anchored), Volume Profile / TPO, Keltner
Channels, Donchian, Parabolic SAR, SuperTrend.

### 5.4 Comparison Mode
Overlay multiple symbols normalised to percentage change from a common start —
the fastest way to answer "did it beat the index?".

### 5.5 Replay Mode
Step forward bar by bar to review or practise a setup without lookahead bias.

All Tier B. Extends `ChartPanel.jsx`.

---

## Phase 6 — Market Internals
*Breadth tells you whether a rally is broad or three stocks wearing a trenchcoat.*

### 6.1 Breadth Indicators
- Advance/decline line and ratio, new 52-week highs vs lows, percentage of
  S&P 500 above their 50/200-day MAs, McClellan Oscillator.
- **Source:** Tier B — computed across our S&P 500 universe. Batch and cache
  aggressively; this is many symbols per refresh.
- **New:** `GET /api/v1/breadth`, `BreadthPanel.jsx`.

### 6.2 Volume Analysis
VWAP, relative volume, volume profile by price level, accumulation/distribution.

### 6.3 Market Regime
Trend/range classification, volatility regime (VIX percentile), risk-on/risk-off
via cross-asset signals.

### 6.4 Short Interest
Short interest ratio, days-to-cover, borrow availability. **Tier A/C** — verify
availability before committing.

---

## Phase 7 — Fixed Income
*We show yields as numbers. Bond desks need curves and analytics.*

### 7.1 Yield Curve
- Full curve (1M → 30Y) plotted, with historical comparison (today vs 1M/1Y ago)
  and animated evolution. Inversion detection and spread highlighting.
- **Source:** Tier A — FRED, already integrated.
- **New:** `GET /api/v1/yieldcurve`, `YieldCurvePanel.jsx`.

### 7.2 Bond Analytics
Price/yield conversion, Macaulay and modified duration, convexity, DV01.
**Tier B.**

### 7.3 Credit Spreads
IG and HY OAS, spread history, distress signalling. **Tier A** via FRED
(`BAMLH0A0HYM2` already wired).

---

## Phase 8 — Terminal UX
*What makes it feel like a Bloomberg rather than a dashboard.*

### 8.1 Command Bar
Bloomberg-style command entry — `AAPL GP`, `SPX HP`, `NVDA DES` — with
autocomplete and a discoverable function list. Keyboard-first navigation.

### 8.2 Customisable Layout
Drag-and-drop panel grid, resizable panels, show/hide, and multiple saved
workspaces per user.

### 8.3 Keyboard Shortcuts
Symbol jump, panel focus, timeframe cycling, command palette.

### 8.4 Real-Time Streaming
Replace polling with WebSocket streaming (Finnhub trades socket) for quotes and
trades. Meaningfully reduces latency and request volume.

### 8.5 Export & Reporting
CSV export on every table; PDF tear-sheet for a symbol or the portfolio.

### 8.6 Server-Side Persistence
Move watchlists, portfolios, and alerts from localStorage to Postgres (the Neon
instance already exists in this repo) behind user auth, so state follows the
user across devices.

---

## Phase 9 — Global & Alternative Data

### 9.1 Global Markets
Regional overview (Asia/Europe/Americas) with session status, world index grid,
ADR/local pair comparison.

### 9.2 Currency Matrix
Full cross-rate grid with strength meter and correlation.

### 9.3 Commodity Curves
Futures term structure — contango/backwardation visualisation.

### 9.4 Central Bank Watch
Fed/ECB/BoJ/BoE meeting calendar, rate-decision history, dot plot.

### 9.5 Sentiment
Fear & Greed style composite index, analyst revision momentum, news-sentiment
time series (Marketaux history), social sentiment (**Tier C** — needs a source).

---

## Prioritisation

Ranked by user value per unit of effort, given our data tiers.

| Rank | Item | Phase | Tier | Why |
|------|------|-------|------|-----|
| 1 | Position management & P&L | 1.1 | A | Biggest gap; unlocks all portfolio analytics |
| 2 | Financial statements | 4.1 | A | Free data, high value, straightforward |
| 3 | Correlation matrix | 2.1 | B | Pure maths, immediately useful |
| 4 | Yield curve | 7.1 | A | FRED already wired; strong visual |
| 5 | Peer comps | 4.3 | A | Free peers endpoint |
| 6 | Chart drawing tools | 5.1 | B | Most-requested trader feature |
| 7 | Market breadth | 6.1 | B | Needs batching care, high analytical value |
| 8 | Fix options feed → Greeks | 3.1–3.2 | C→B | Blocks all of Phase 3 |
| 9 | VaR & stress testing | 2.2–2.3 | B | Deepens existing risk panel |
| 10 | Command bar | 8.1 | — | Defines the terminal feel |
| 11 | DCF valuation | 4.2 | B | Depends on 4.1 |
| 12 | WebSocket streaming | 8.4 | A | Infrastructure; do before panel count grows |

**Suggested sequencing:** Phase 1 → 4.1/4.3 → 2.1 → 7.1 → 5.1 → 6.1, then
revisit options once the feed is resolved.

---

## Engineering notes

**Batching.** Breadth (6.1) and the screener over the full S&P 500 mean hundreds
of quote requests. Before building those, add a batched quote endpoint —
Yahoo's `v7/finance/quote` accepts comma-separated symbols — and a request
queue with concurrency limits. Doing this first prevents rate-limit failures
later.

**Caching.** Cache TTLs should reflect data cadence: statements quarterly,
fundamentals daily, breadth minutes, quotes seconds. The in-memory `Map` cache
resets on every serverless cold start; for expensive computations (breadth,
correlation, optimisation) move to a persistent store.

**Compute placement.** Correlation, VaR, optimisation, and backtests are O(n²)
or worse over long histories. Vercel functions cap at 60s. Either precompute on
a schedule or move heavy work to a worker.

**Model honesty.** DCF, VaR, optimisation, and stress tests are *models*. Label
assumptions in the UI, show the inputs, and never present modelled output with
the same visual weight as observed market data. This app must not read as
personalised investment advice.

**Testing.** The indicator maths in `server.js` (RSI, MACD, ADX, Bollinger…) has
no tests. Before layering Greeks, VaR, and DCF on top, add unit tests with known
fixtures — financial maths fails silently and wrongly.

---

## Not planned

Deliberately out of scope, and why:

- **Order execution / broker integration** — real money movement; different
  regulatory and security posture entirely.
- **Level 2 depth & time-and-sales** — requires paid exchange data.
- **Earnings call transcripts** — no viable free source.
- **13F institutional holdings** — parsing EDGAR filings is a project in itself.
