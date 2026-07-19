# Trading Bot Integration — Implementation Plan

How to integrate the four referenced repositories into QuantBloom Terminal.

---

## 1. What we are starting from

QuantBloom is **38 API routes, 37 panels, 42 unit tests**, running as:

- **Node/Express** (`server.js`) bundled to a **Vercel serverless function**
- **React + Vite** front end
- In-memory cache, no database, no persistent process
- Tested numerical modules: `blackscholes.js`, `regression.js`, `portfolio-math.js`

It already supplies most of what a bot needs as *input*: OHLCV candles across
timeframes, 12 technical indicators with signal scoring, fundamentals,
financial statements, news with sentiment, factor exposures, correlation, VaR,
stress tests, and a 122-instrument multi-asset universe.

**What it has no concept of:** a strategy that decides, a position that is
opened by software, or a loop that runs when nobody is looking.

---

## 2. The four repositories — honest assessment

These are not four versions of the same thing. They sit at different layers and
are written in three different languages. Nothing here can be `npm install`ed.

| Repo | Language | Layer | Verdict |
|------|----------|-------|---------|
| `pskrunner14/trading-bot` | Python / Keras | Signal generation | **Port the idea, not the code** |
| `TradingAgents` | Python / LangGraph | Reasoning & decision | **Run as a separate service** |
| `MLOPS--INT-STOCK-Prediction` | Python / LightGBM, CatBoost | Models + backtesting | **Mine for pipeline design** |
| `ribbit-backend` | Go / Gin / PostgreSQL | Broker execution | **Reference only — see §7** |

### 2.1 `pskrunner14/trading-bot` — Deep Q-Network

Vanilla DQN plus Double DQN, prioritised replay, and duelling architectures.
State is an *n*-day window of price differences squashed through a sigmoid;
actions are buy / sell / hold on a single share; reward is the change in
portfolio position.

**Take:** the state/action/reward formulation. It is clean and it is the right
starting shape for an RL trading agent.

**Leave:** essentially everything else, and be blunt about why.

- It trades **one share of one stock**. There is no position sizing, no
  portfolio, no risk budget.
- The reward is raw P&L, so the agent is rewarded for taking unlimited risk. A
  Sharpe- or drawdown-penalised reward is the minimum viable fix.
- It is trained on **GOOG 2010–17** and evaluated on 2018–19 — a single ticker
  in the strongest equity bull market in living memory. Any result from that
  setup tells you nothing about generalisation.
- No transaction costs, no slippage, no borrow costs.

Treat its published results as a tutorial artefact, not evidence of edge.

### 2.2 `TradingAgents` — Multi-agent LLM framework

LangGraph orchestration of specialised agents: fundamentals, sentiment, news
and technical analysts feed bullish/bearish researchers who debate; a trader
composes the call; risk management and a portfolio manager approve or reject.

**Take:** the *organisational structure*. Separating analysis from advocacy
from risk approval is genuinely good design, and the bull/bear debate is an
effective structural check on one-sided reasoning.

**Watch:**

- **Cost.** Every decision is many LLM calls across several agents and debate
  rounds. Priced per symbol per run, this dominates the budget. Cache
  aggressively; do not run it on a schedule across a large universe.
- **Latency.** Multi-round debate takes minutes. This is a daily/swing
  cadence tool. It cannot inform an intraday signal.
- **Non-determinism.** The same inputs can produce different decisions. Log
  every prompt, response, and decision or you will not be able to explain a
  trade after the fact.
- **It is a research framework.** The authors position it as such.

### 2.3 `MLOPS--INT-STOCK-Prediction` — ML pipeline

LightGBM and CatBoost, RL strategies, clustering (k-means, hierarchical, GMM),
NLP sentiment, with Zipline/Backtrader backtesting and Docker/automation for
retraining.

**Take:** this is the most operationally mature of the four and the best
template for the *pipeline shape* — data creation → feature engineering →
model → backtest → automated retraining → monitoring.

**Note:** its data sources (NASDAQ ITCH order flow, Algoseek) are paid,
institutional feeds. Our free-tier data cannot reproduce that work. Scope the
features to what we actually have.

### 2.4 `ribbit-backend` — Broker-dealer backend

Go/Gin + PostgreSQL against **Alpaca's Broker API**, with Twilio identity
verification, Plaid ACH funds transfer, Magic Labs auth, JWT security.

**This is not a bot.** It is the regulated plumbing for a broker-dealer:
onboarding real customers, moving real money, placing real orders. Its own
README describes it as educational reference material, not production code.

**Take:** the layered architecture (middleware / routing / services /
repositories / models) and the *concepts* — idempotent order submission,
account state, audit trail.

**Do not** port it wholesale. See §7 for the boundary this project draws.

---

## 3. The runtime problem

This is the constraint that dictates the architecture, so it comes before the
architecture.

**Three of these repos are Python. One is Go. QuantBloom is Node on Vercel
serverless.** Beyond language, the runtime is wrong in three specific ways:

1. **Serverless functions are stateless.** A bot needs to remember it is long
   200 shares. Vercel gives you a fresh process with an empty in-memory cache.
2. **60-second execution cap.** RL training, LLM debates, and walk-forward
   backtests all take longer.
3. **No scheduler with state.** Vercel cron can fire an HTTP request, but a bot
   needs to hold positions between firings and react between them.

Consequences, stated plainly:

- The bot **cannot live inside the current Vercel function**.
- We need a **persistent process** — a small VM, Fly.io/Railway container, or
  ECS task — and a **database** (Postgres) for positions, orders, and signals.
- The Python work stays Python, behind an HTTP boundary. Do not attempt to
  transliterate LightGBM or LangGraph into JavaScript.

---

## 4. Target architecture

```
┌───────────────────────────────────────────────────────────────┐
│  QuantBloom Terminal (React)                                  │
│  + BotPanel  + SignalsPanel  + BacktestPanel  + BotRiskPanel  │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼───────────────────────────────────┐
│  QuantBloom API (Node/Express) — existing 38 routes           │
│  + /api/v1/bot/*   (proxy + auth + rate limit)                │
└───────────────────────────┬───────────────────────────────────┘
                            │ internal HTTP
┌───────────────────────────▼───────────────────────────────────┐
│  Strategy Service (Python, FastAPI) — persistent process      │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Rule engine │  │ ML models    │  │ LLM agents           │  │
│  │ (JS/py)     │  │ LightGBM,    │  │ (TradingAgents-      │  │
│  │             │  │ CatBoost, RL │  │  derived, optional)  │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         └────────────────┼─────────────────────┘              │
│                    ┌─────▼──────┐                             │
│                    │  Ensemble  │  weighted vote + veto       │
│                    └─────┬──────┘                             │
│                    ┌─────▼──────┐                             │
│                    │ Risk gate  │  HARD limits, cannot bypass │
│                    └─────┬──────┘                             │
│         ┌────────────────┼────────────────┐                   │
│   ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐             │
│   │ Backtest  │    │  Paper    │    │   Live    │  ← gated    │
│   │  engine   │    │ (Alpaca   │    │ (Alpaca)  │             │
│   │           │    │  paper)   │    │           │             │
│   └───────────┘    └───────────┘    └───────────┘             │
└───────────────────────────┬───────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   PostgreSQL   │  positions, orders,
                    │                │  signals, runs, audit
                    └────────────────┘
```

Every strategy — rule, ML, or LLM — implements one interface:

```python
class Strategy(Protocol):
    name: str
    def generate(self, ctx: MarketContext) -> Signal:
        """Return Signal(action, confidence, size_hint, rationale)."""
```

`action ∈ {BUY, SELL, HOLD, CLOSE}`, `confidence ∈ [0,1]`. Because every
strategy returns the same shape, the ensemble, the backtester, the paper
trader and the live adapter are all written once.

---

## 5. Phased implementation

### Phase 0 — Foundations (no bot yet)

Nothing works without these, and doing them later means redoing everything.

- **Postgres** with tables: `strategies`, `signals`, `orders`, `positions`,
  `backtest_runs`, `bot_config`, `audit_log`.
- **`/api/v1/bot/*`** namespace in the existing Express app, proxying the
  strategy service.
- **Strategy service skeleton** — FastAPI, health check, deployed to a
  persistent host.
- **Shared `Signal` contract**, versioned, in both languages.

### Phase 1 — Backtest engine *(build this before any strategy)*

Deliberately first. A strategy you cannot honestly evaluate is worse than no
strategy, because it invites you to trade on noise.

Requirements, all non-negotiable:

- **Point-in-time data.** The engine must only ever see bars up to the
  decision timestamp. Look-ahead bias is the single most common way retail
  backtests produce fictional returns.
- **Transaction costs and slippage.** Commission, spread, and a market-impact
  model. Frictionless backtests flatter high-turnover strategies enormously.
- **Walk-forward validation.** Rolling train/test windows, not one split. A
  single 70/30 split on one ticker tells you almost nothing.
- **Survivorship-bias awareness.** Our S&P 500 list is *today's* constituents.
  Backtesting it over 10 years silently excludes every company that failed.
  Document this; it inflates results.
- **Benchmark comparison.** Every result reported against buy-and-hold SPY.
  Most strategies lose to it.

Output: equity curve, CAGR, Sharpe, Sortino, max drawdown, win rate, profit
factor, turnover, cost drag, exposure — with the benchmark alongside.

### Phase 2 — Rule-based strategies (first signals)

Start here, not with ML. These are transparent, instant, free, and give the
backtester something to validate against.

Reuse the tested indicator engine already in `server.js`:

- MA crossover (golden/death cross)
- RSI mean reversion
- MACD momentum
- Bollinger band reversion
- Multi-indicator consensus (the existing signal-scoring logic)

If these cannot beat buy-and-hold after costs, that is important information —
and it should temper expectations for the more complex approaches.

### Phase 3 — ML models (from MLOPS repo)

- **Features** from what we actually have: indicators, returns at multiple
  horizons, volatility, volume ratios, sector-relative strength, factor
  loadings, news sentiment.
- **Target:** forward *n*-day return, or its sign. Be explicit about horizon.
- **Models:** LightGBM and CatBoost first — they beat neural nets on tabular
  data of this size and train in seconds.
- **Validation:** purged, embargoed time-series CV. Standard k-fold leaks
  future information through overlapping windows and will produce beautiful,
  meaningless scores.
- **Retraining** on a schedule, with drift monitoring.

### Phase 4 — RL agent (from trading-bot repo)

Reimplement the DQN with the fixes listed in §2.1:

- Reward = risk-adjusted (differential Sharpe or drawdown-penalised), not raw P&L
- Costs and slippage inside the environment, not bolted on afterwards
- Position sizing as part of the action space
- Trained across many tickers and regimes, not one stock in one bull market

Expect this to underperform the GBMs. Build it because the architecture is
interesting and because the environment is reusable; do not assume RL wins.

### Phase 5 — LLM agents (from TradingAgents)

Adopt the team structure — analysts → bull/bear debate → trader → risk →
portfolio manager — with strict controls:

- **Daily cadence at most**, on a small watchlist. Not the S&P 500.
- **Hard budget cap** per day; halt when hit.
- **Full audit log** of prompts, responses, and decisions.
- **Advisory by default.** The LLM layer produces a *rationale and a lean*,
  and its natural role is qualitative context the quantitative layers cannot
  see (an earnings call tone, a regulatory headline) — not a position size.

### Phase 6 — Ensemble and risk gate

Weighted vote across strategies, weights set by *out-of-sample* backtest
performance, not in-sample fit. Disagreement is signal: when strategies split,
size down rather than picking a side.

The risk gate sits after the ensemble and **cannot be overridden by any
strategy**:

| Control | Default |
|---------|---------|
| Max position size | 5% of equity |
| Max sector exposure | 25% |
| Max gross exposure | 100% (no leverage) |
| Max daily loss | 2% → halt for the day |
| Max drawdown | 10% → halt, require manual restart |
| Min liquidity | reject if order > 1% ADV |
| Max orders/day | 20 |
| Kill switch | one call, cancels all and flattens |

These are hard limits enforced in code, not configuration a strategy can
raise.

### Phase 7 — Paper trading

Alpaca **paper** endpoint. Run every strategy in paper for a **minimum of one
month** before any live consideration, and compare paper fills against
backtest predictions. Divergence here is the honest test — it is where
optimistic slippage assumptions surface.

### Phase 8 — Live execution *(gated — read §7)*

---

## 6. Front-end additions

| Panel | Shows |
|-------|-------|
| `BotPanel` | Status, mode (backtest/paper/live), kill switch, today's P&L |
| `SignalsPanel` | Live signals per strategy with confidence and rationale |
| `BacktestPanel` | Equity curve vs benchmark, metrics table, parameter form |
| `BotRiskPanel` | Live exposure against every limit, breach warnings |
| `BotBlotterPanel` | Every order: intended vs filled, slippage, cost |

The existing `PortfolioPanel` and `AttributionPanel` work unchanged on
bot-generated positions, since attribution is already weight × return.

---

## 7. Safety boundary — read before Phase 8

This project builds the full research, backtest, and **paper-trading** stack.
Live execution is treated differently, deliberately.

**What is built:**

- Signal generation, ensemble, and risk gate
- Rigorous backtesting
- Paper trading against Alpaca's paper endpoint
- A `BrokerAdapter` interface with a complete paper implementation

**What is left as an explicit, user-owned step:**

- Supplying live broker credentials
- Enabling the live adapter
- Running with real money

This is not squeamishness about the code — the adapter is the same shape
either way. It is that autonomous software placing real orders with real money
is a category of decision that belongs to the person whose money it is, taken
deliberately, not inherited as a default from a plan document.

Before that switch is ever flipped:

1. **Paper trade for at least a month.** Compare fills to backtest assumptions.
2. **Understand the regulatory position.** `ribbit-backend` implements
   broker-dealer functionality — KYC, ACH transfers, customer accounts. If you
   are trading only your own money through your own brokerage account, you do
   not need any of that, and you should not build it. If you are ever handling
   anyone else's money, that is a licensed activity and a legal question, not
   an engineering one.
3. **Start at a size you are willing to lose entirely**, with the daily-loss
   and drawdown halts armed.
4. **Keep the kill switch reachable** — physically, on your phone.

**On expectations.** Most retail algorithmic strategies do not beat buy-and-
hold after costs. The backtest gate in Phase 1 exists to tell you that
honestly *before* money is at risk, rather than after. If a strategy only
looks good without transaction costs, or only on one ticker, or only in-
sample, the correct conclusion is that it does not work.

None of this output is investment advice, and no metric here should be read as
a prediction.

---

## 8. Suggested sequence

| Step | Work | Why |
|------|------|-----|
| 1 | Postgres + `/api/v1/bot/*` + service skeleton | Everything depends on it |
| 2 | **Backtest engine with costs and walk-forward** | The gate for all claims |
| 3 | Rule-based strategies | Free, transparent, validates the engine |
| 4 | Risk gate + kill switch | Before anything can place an order |
| 5 | Paper trading | Reality check on fills |
| 6 | LightGBM/CatBoost pipeline | Best return on effort of the ML options |
| 7 | Ensemble | Only meaningful with several validated strategies |
| 8 | LLM agents | Highest cost, slowest, most experimental |
| 9 | RL agent | Interesting; lowest expected payoff |

Note that steps 2 and 4 — the backtester and the risk gate — come before any
sophisticated model. That ordering is the whole point.

---

## 9. Open questions

1. **Hosting.** Fly.io, Railway, or a small VM for the strategy service?
   Vercel cannot host it.
2. **Database.** The repo already has Neon Postgres configured for the legacy
   QuantBloom app — reuse it or provision separately?
3. **Asset scope.** Equities and ETFs only at first, or include crypto (24/7,
   no market-hours logic, different risk profile)?
4. **Cadence.** Daily/swing is far cheaper and more forgiving than intraday.
   Intraday needs a real-time feed we do not currently have.
5. **LLM budget.** Sets how much of Phase 5 is viable.
6. **Fork strategy.** Fork the Python repos for reference and vendor selected
   modules, or reimplement against our own data layer? Recommendation:
   reference and reimplement — their data assumptions differ from ours enough
   that direct reuse creates more integration debt than it saves.
