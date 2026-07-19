# QuantBloom Terminal — Upgrade Plan v2

## Current State (v1)
The app has 7 panels: Chart (candlestick + indicators), News Feed, Heatmap, Economic Calendar, FRED Economic Data, Ticker Bar, and Watchlist Modal. Backend serves 11 API routes covering quotes, candles, news, heatmap, calendar, search, and FRED data via Finnhub, Marketaux, NewsAPI, Alpha Vantage, Yahoo Finance, and FRED APIs.

---

## Phase 1 — Core Market Data Panels

### 1.1 Company Profile Panel
- **What:** Display company overview when a symbol is selected — name, sector, industry, market cap, P/E, 52-week range, dividend yield, description.
- **API:** Finnhub `/stock/profile2` (free tier) + Yahoo Finance quote metadata.
- **Backend:** `GET /api/v1/profile?symbol=AAPL` — merge Finnhub profile with Yahoo quote stats.
- **Frontend:** `CompanyProfile.jsx` — logo, key stats grid, one-paragraph description. Updates when global symbol changes.
- **Cache:** 1 hour (company info rarely changes intraday).

### 1.2 Analyst Recommendations Panel
- **What:** Buy/Hold/Sell consensus, price target, rating history chart.
- **API:** Finnhub `/stock/recommendation` (free tier).
- **Backend:** `GET /api/v1/analyst?symbol=AAPL` — returns last 4 quarters of ratings.
- **Frontend:** `AnalystPanel.jsx` — horizontal stacked bar (strongBuy → strongSell), consensus label, target price.
- **Cache:** 6 hours.

### 1.3 Crypto Tracker Panel
- **What:** Top cryptocurrencies with price, 24h change, market cap, volume.
- **API:** Yahoo Finance (crypto symbols like BTC-USD, ETH-USD) — no extra API key needed.
- **Backend:** `GET /api/v1/crypto` — fetches top 10 crypto quotes via Yahoo.
- **Frontend:** `CryptoPanel.jsx` — ranked list with sparkline-style change indicators, auto-refreshes every 60s.
- **Cache:** 30 seconds (crypto is 24/7).

### 1.4 Forex & Commodities Panel
- **What:** Major currency pairs (EUR/USD, GBP/USD, USD/JPY, etc.) and commodity spot prices.
- **API:** Yahoo Finance (forex: EURUSD=X, commodity: GC=F for gold, CL=F for crude).
- **Backend:** `GET /api/v1/forex` — batch-fetch forex + commodity quotes.
- **Frontend:** `ForexPanel.jsx` — tabbed view (Major Pairs | Commodities | All Rates), color-coded changes.
- **Cache:** 60 seconds.

---

## Phase 2 — Fundamental Analysis

### 2.1 Company Fundamentals Panel
- **What:** Key financial metrics — revenue, EPS, P/E, P/B, debt/equity, ROE, profit margins. Searchable across S&P 500.
- **API:** Finnhub `/stock/metric` (basic financials, free tier) + Yahoo Finance statistics.
- **Backend:** `GET /api/v1/fundamentals?symbol=AAPL` — merge Finnhub metrics with Yahoo key stats.
- **Frontend:** `FundamentalsPanel.jsx` — search bar, metrics in categorized sections (Valuation, Profitability, Growth, Balance Sheet).
- **Cache:** 4 hours.

### 2.2 Earnings Calendar Panel
- **What:** Upcoming and recent earnings reports with EPS estimates, actuals, surprise %.
- **API:** Finnhub `/calendar/earnings` (free tier).
- **Backend:** `GET /api/v1/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD` — next 7 days of earnings.
- **Frontend:** `EarningsPanel.jsx` — grouped by date, shows symbol, time (BMO/AMC), EPS estimate vs actual.
- **Cache:** 1 hour.

### 2.3 IPO Calendar Panel
- **What:** Upcoming and recent IPOs with company name, exchange, expected price range, shares offered.
- **API:** Finnhub `/calendar/ipo` (free tier).
- **Backend:** `GET /api/v1/ipo?from=YYYY-MM-DD&to=YYYY-MM-DD` — next 30 days of IPOs.
- **Frontend:** `IpoPanel.jsx` — card list sorted by date, status badges (upcoming/priced/withdrawn).
- **Cache:** 2 hours.

---

## Phase 3 — Advanced Analytics

### 3.1 Technical Analysis Panel
- **What:** Dedicated panel showing indicator summary — RSI, MACD, moving average crossovers, support/resistance levels, overall signal (Buy/Sell/Neutral).
- **API:** Finnhub `/scan/technical-indicator` (free tier) for aggregate TA. Supplement with calculated values from candle data we already fetch.
- **Backend:** `GET /api/v1/technical?symbol=AAPL&resolution=D` — returns indicator values and signals.
- **Frontend:** `TechnicalPanel.jsx` — gauge/meter showing overall signal strength, table of individual indicators with their signals.
- **Cache:** 5 minutes.

### 3.2 Stock Screener Panel
- **What:** Filter stocks by market cap, P/E, dividend yield, sector, 52-week performance. Returns matching stocks in a sortable table.
- **API:** Uses existing heatmap constituents (77 stocks across 11 sectors) + Yahoo Finance batch quotes for filtering.
- **Backend:** `GET /api/v1/screener?minMarketCap=10B&maxPE=25&sector=Technology` — filters and returns matching stocks.
- **Frontend:** `ScreenerPanel.jsx` — filter controls (dropdowns, range sliders), results table with sortable columns.
- **Cache:** 5 minutes.

### 3.3 Sector Analysis Panel
- **What:** Sector performance comparison, rotation analysis, relative strength rankings.
- **API:** Yahoo Finance sector ETFs (XLK, XLF, XLV, XLE, XLY, XLP, XLI, XLB, XLRE, XLU, XLC) for performance data.
- **Backend:** `GET /api/v1/sectors?period=3M` — returns sector performance, relative strength, weight allocations.
- **Frontend:** `SectorPanel.jsx` — tabbed (Performance | Rotation | Rankings), bar chart for performance, ranked list with RS scores.
- **Cache:** 10 minutes.

### 3.4 Risk Analytics Panel
- **What:** Portfolio-level risk metrics — beta, Sharpe ratio, volatility, max drawdown, sector exposure, asset allocation pie chart.
- **API:** Calculated from watchlist positions using Yahoo Finance historical data.
- **Backend:** `GET /api/v1/risk?symbols=AAPL,MSFT,GOOGL` — computes risk metrics for a basket of stocks.
- **Frontend:** `RiskPanel.jsx` — stat cards (Beta, Sharpe, Vol, MaxDD), donut charts for sector/asset allocation.
- **Cache:** 15 minutes.

---

## Phase 4 — Interactive Features

### 4.1 Alerts & Monitoring Panel
- **What:** Create price, volume, and percentage-change alerts. Active/Triggered tabs. Alerts stored in localStorage.
- **API:** No new API — uses existing quote polling to check conditions client-side.
- **Backend:** No backend changes — alerts are client-side with localStorage persistence.
- **Frontend:** `AlertsPanel.jsx` — create alert form (symbol, condition, threshold), active alerts list, triggered history. Uses browser notifications API when triggered.
- **Storage:** localStorage via existing `storage.js` utility.

### 4.2 Options Chain Panel
- **What:** Options data for a selected symbol — calls/puts, strike prices, expiry dates, IV, Greeks.
- **API:** Yahoo Finance options API (`/v7/finance/options/{symbol}`).
- **Backend:** `GET /api/v1/options?symbol=AAPL&date=YYYY-MM-DD` — returns options chain.
- **Frontend:** `OptionsPanel.jsx` — expiry date selector, call/put table with strike, bid, ask, volume, OI, IV.
- **Cache:** 2 minutes.

---

## Phase 5 — Layout & Navigation

### 5.1 Responsive Grid Upgrade
- **What:** Replace fixed 2-column layout with a flexible grid that accommodates all 15+ panels. Collapsible sections, panel reordering.
- **Layout:** Three-row design:
  - **Row 1 (hero):** Chart + Company Profile + Analyst Recommendations
  - **Row 2 (market data):** News + Heatmap + Forex/Crypto
  - **Row 3 (analysis):** FRED + Calendar + Earnings + Sector Analysis
  - **Row 4 (advanced):** Technical + Screener + Risk + Options
  - **Row 5 (monitoring):** Alerts + Fundamentals + IPO
- **Frontend:** CSS Grid with named areas, collapsible panel wrapper component.

### 5.2 Panel Collapse/Expand
- **What:** Each panel gets a collapse toggle. State persisted in localStorage.
- **Frontend:** `PanelWrapper.jsx` — reusable wrapper with title bar, collapse button, optional refresh button.

---

## API Route Summary (New)

| Route | Source API | Cache TTL | Phase |
|-------|-----------|-----------|-------|
| `GET /api/v1/profile` | Finnhub + Yahoo | 1 hour | 1 |
| `GET /api/v1/analyst` | Finnhub | 6 hours | 1 |
| `GET /api/v1/crypto` | Yahoo Finance | 30 sec | 1 |
| `GET /api/v1/forex` | Yahoo Finance | 60 sec | 1 |
| `GET /api/v1/fundamentals` | Finnhub + Yahoo | 4 hours | 2 |
| `GET /api/v1/earnings` | Finnhub | 1 hour | 2 |
| `GET /api/v1/ipo` | Finnhub | 2 hours | 2 |
| `GET /api/v1/technical` | Finnhub + calc | 5 min | 3 |
| `GET /api/v1/screener` | Yahoo Finance | 5 min | 3 |
| `GET /api/v1/sectors` | Yahoo Finance | 10 min | 3 |
| `GET /api/v1/risk` | Yahoo Finance | 15 min | 3 |
| `GET /api/v1/options` | Yahoo Finance | 2 min | 4 |

## File Structure (New Components)

```
src/components/
  CompanyProfile.jsx      # Phase 1.1
  AnalystPanel.jsx         # Phase 1.2
  CryptoPanel.jsx          # Phase 1.3
  ForexPanel.jsx           # Phase 1.4
  FundamentalsPanel.jsx    # Phase 2.1
  EarningsPanel.jsx        # Phase 2.2
  IpoPanel.jsx             # Phase 2.3
  TechnicalPanel.jsx       # Phase 3.1
  ScreenerPanel.jsx        # Phase 3.2
  SectorPanel.jsx          # Phase 3.3
  RiskPanel.jsx            # Phase 3.4
  AlertsPanel.jsx          # Phase 4.1
  OptionsPanel.jsx         # Phase 4.2
  PanelWrapper.jsx         # Phase 5.2
```

## Implementation Priority

1. **High impact, low effort:** Company Profile, Analyst, Crypto, Forex (all use existing APIs)
2. **High impact, medium effort:** Earnings, IPO, Fundamentals (Finnhub free tier)
3. **Medium impact, medium effort:** Sector Analysis, Technical Analysis, Stock Screener
4. **Medium impact, high effort:** Options Chain, Risk Analytics, Alerts
5. **Polish:** Panel collapse, grid layout upgrade
