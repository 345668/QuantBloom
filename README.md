# QuantBloom Terminal

A Bloomberg-style market terminal that runs locally: live quotes and charting,
a 122-instrument multi-asset universe, a full quantitative stack (VaR, factor
exposure, portfolio optimisation, DCF, Black-Scholes options), a paper-trading
bot with a hard risk gate, a local model-training lab with a validation-gated
publish pipeline, and a power/commodities pricing desk.

![The QuantBloom terminal — command bar, cross-asset ticker, and the primary
chart.](docs/img/hero.png)

> 📄 **Deep dive:** the [**Technical Whitepaper**](docs/QuantBloom-Whitepaper.md)
> documents the machine-learning pipeline, trading strategies, overfitting
> guards, and all the maths behind them — with platform snapshots throughout.

- **Front-end** — React 18 + Vite (`src/`)
- **API** — Express (`server.js`), pure JavaScript
- **Analytics, ML & bot** — tested JS modules in `bot/`, `charting/`, and the
  repo root (`blackscholes.js`, `regression.js`, `portfolio-math.js`)
- **Data** — Yahoo Finance (no key), plus optional FRED / Finnhub / Alpha
  Vantage / Marketaux / NewsAPI
- **Tested** — 332 unit tests (`npm test`) covering every load-bearing computation

Everything analytical runs in JavaScript, so no Python or database is required
to run the app locally.

## What's inside

| Area | Highlights |
|------|-----------|
| **Charting** | 8 chart types (Heikin-Ashi, Renko, Line-Break…), 16-indicator library, volume profile, drawing tools with R:R, bar replay, multi-chart grid, a sandboxed custom-indicator language |
| **ML signal lab** | 19 point-in-time features (+5 cross-asset), triple-barrier labels, four model families (logistic, gradient-boosted trees, PCA latent-factor, ensemble), a from-scratch Jacobi eigensolver |
| **Overfitting guards** | Probabilistic & Deflated Sharpe, Probability of Backtest Overfitting (CSCV) — a publish gate that rejects models that don't beat buy-and-hold out of sample |
| **Backtester** | Event-driven, point-in-time, next-bar-open fills, explicit transaction costs, walk-forward, strategy sweeps |
| **Trading bot** | Alpaca paper trading, hard risk gate, SL/TP brackets + live trailing stop, kill switch, auto-train, Mistral LLM advisory layer |
| **Portfolio & valuation** | Mean-variance optimisation, three-method VaR, factor regression, DCF, time-value-of-money (NPV/IRR) |
| **Power desk** | Merit-order dispatch, two-node LMP & congestion, spark spreads, Monte-Carlo heat-rate options, the duck curve |
| **Bloomberg desk** | World Clocks (WCV), FX dealer grid with bid/ask & spreads (FXGO), radial intraday-return sunburst (IMAP) |
| **Mission Control** | "SURVIVAL × FIELD" — a regime-coloured market-field visualisation over a live bot operations rail (run log, position book, risk radar, fill heat, equity, ledger) |
| **ASKB** | "Ask QuantBloom" — a read-only natural-language assistant over your live terminal data (Mistral-backed, with a deterministic fallback) |
| **UX** | `Ctrl+K` command palette (`TICKER <GO>`), `Ctrl+Shift+M` panel pop-out, optional Supabase login mirrored to Neon |

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | **20 or newer** (22 recommended) | Uses the built-in test runner and `fetch`. A `.nvmrc` pins 22 — run `nvm use`. |
| npm | 9+ | Ships with Node. `pnpm` also works. |

Check: `node --version`

---

## 1. Install

```bash
git clone <this-repo-url>
cd "Bloomberg traycer"
npm install
```

## 2. Configure (optional)

The app runs with **no configuration** — Yahoo Finance needs no key and powers
charts, quotes, screeners, backtests, and the model lab. To enable the
key-gated panels, copy the example and fill in what you have:

```bash
cp .env.example .env
```

| Key | Unlocks | Get one |
|-----|---------|---------|
| `FINNHUB_API_KEY` | Company profile, analyst ratings, fundamentals, earnings & IPO calendars | <https://finnhub.io/dashboard> |
| `FRED_API_KEY` | Macro data, yield curve | <https://fred.stlouisfed.org/docs/api/api_key.html> |
| `MARKETAUX_API_KEY` / `NEWSAPI_KEY` | News with sentiment | marketaux.com / newsapi.org |
| `ALPHA_VANTAGE_API_KEY` | Quote fallback | alphavantage.co |
| `ALPACA_API_KEY` + `ALPACA_SECRET_KEY` | Trading bot (**paper only**) | <https://alpaca.markets> |
| `MISTRAL_API_KEY` | Bot's LLM advisory review | <https://console.mistral.ai> |

A missing key just disables that panel; nothing crashes.

> **Trading bot safety:** `ALPACA_ENDPOINT` defaults to the **paper** endpoint —
> simulated fills, no real money. The bot ships **switched off** and every order
> passes a risk gate. See `TRADING_BOT_IMPLEMENTATION.md`.

## 3. Run

### Development (hot reload) — recommended

```bash
npm run dev:local
```

Runs two processes together: the Vite dev server (UI, hot reload) and the
Express API. Open:

**→ http://localhost:5173**

Vite proxies `/api/*` to the API on port 3001.

### Single-process (build once, then run)

```bash
npm run build:local     # builds the UI into dist/
node server.js          # serves UI + API from one process
```

Open **→ http://localhost:3001** (change with `API_PORT`).

---

## Tests

The numerical core (options pricing, regression, portfolio maths, risk gate,
backtester, overfitting guards, model training) is covered by **150+ unit
tests**:

```bash
npm test
```

---

## Docker (containerized local deploy)

```bash
cp .env.example .env    # add any keys you have
docker compose up --build
```

Open **→ http://localhost:3001**. Trained/published models persist in a named
volume across restarts.

The container runs `server.js` as a persistent process, which the trading bot
needs to hold position state between cycles.

---

## Common tasks

| Command | What it does |
|---------|--------------|
| `npm run dev:local` | UI (5173) + API (3001) with hot reload |
| `npm run build:local` | Build the UI into `dist/` |
| `node server.js` | Run API — also serves `dist/` if built |
| `npm test` | Run the full test suite |

---

## Project layout

```
server.js              Express API (all /api/v1/* routes) + static serving
src/                   React front-end (components, hooks, context)
bot/                   Trading bot: strategies, risk gate, backtester,
                       model training, Alpaca + Mistral adapters
blackscholes.js        Options pricing & Greeks (tested)
regression.js          OLS multiple regression (tested)
portfolio-math.js      Mean-variance optimisation (tested)
sp500.js, instruments.js   Tradeable universe
test/                  Unit tests (node --test)
dist/                  Built front-end (after build:local)
.models/               Persisted trained models (gitignored)
```

### Further reading

- `TRADING_BOT_IMPLEMENTATION.md` — bot architecture and safety boundary
- `MODEL_TRAINING.md` — the model lab, the publish gate, and the Python path
- `FEATURES_V3.md` — feature roadmap

---

## Deployment notes

- **Local / Docker** runs the full app including the stateful trading bot.
- **Vercel** (serverless) serves the UI and API, but the bot cannot hold state
  between cycles there (stateless functions, 60s cap) and model persistence
  no-ops on the read-only filesystem — both degrade gracefully to in-memory.
  Run the bot from a persistent process (local, Docker, or a small VM).

## Disclaimer

For research and education. Nothing here is investment advice, and no metric is
a prediction. The trading bot targets a **paper** account by default. Backtested
performance does not predict future returns.
