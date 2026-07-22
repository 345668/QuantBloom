# Model Training & Publishing

How QuantBloom trains market-prediction models, validates them honestly, and
gates which ones reach the public page.

## What runs where

| Model family | Runtime | Where |
|--------------|---------|-------|
| Logistic regression | JavaScript | **In-app** — `bot/model.js` |
| Gradient-boosted trees | JavaScript | **In-app** — `bot/gbm.js` |
| LightGBM / CatBoost | Python | Local pipeline (below) |
| Latent-factor, SDF, portfolio nets (ml4t-models) | Python / PyTorch | Local pipeline |
| RL agents (DQN) | Python | Local pipeline |

Two models train inside the app. **Gradient-boosted trees** (`bot/gbm.js`) are
the in-app stand-in for LightGBM/CatBoost — the Friedman construction with
shallow regression trees fit to log-loss residuals. Unlike logistic regression,
trees capture non-linear feature interactions ("RSI oversold AND rising volume
AND above the 200-day"), and a test proves the GBM cracks XOR while logistic
cannot. GBM also reports **gain-based feature importance**, so you see which
inputs it used. Heavier families still train via the local Python pipeline and
import as an artifact.

Empirically the GBM is a real upgrade — on AAPL it lifts test AUC from ~0.51
(logistic, a coin flip) to ~0.60 with a Deflated Sharpe of ~0.65 — yet it still
does not clear the publish gate, because long-only market-timing rarely beats
buy-and-hold in a bull run. That is the honest result: genuine predictive edge
is not the same as beating buy-and-hold, and the gate holds regardless.

## The in-app pipeline

```
candles ──► features (point-in-time) ──► triple-barrier labels
                                              │
                                    temporal 70/30 split
                                              │
                            train logistic regression (L2, GD)
                                              │
                      evaluate OOS: AUC, backtest vs buy-and-hold,
                              Deflated Sharpe
                                              │
                                      ┌───────┴───────┐
                                  PASS gate       FAIL gate
                                      │               │
                              publishable      stays private
```

Every stage is tested (`test/model.test.mjs`, 23 tests): features are proven
point-in-time, the model learns separable data but not noise, and the gate
rejects models that lack edge.

### Features (`bot/features.js`)

12 features per bar, all computable from bars `[0..t]` only: multi-horizon
returns, RSI, MACD histogram, price vs SMA20/50, Bollinger position, ADX, ATR%,
volume ratio, and realised volatility. Reuses the same `bot/indicators.js` the
live bot and backtester use.

### Labels — triple-barrier (López de Prado)

Borrowed from `ml4t-engineer`. Instead of "did price rise over N days", each bar
is labeled by which barrier is hit **first**: an up target (default +3%), a down
stop (−2%), or a time limit (10 bars). This matches how a trade actually ends. A
straddling bar is read pessimistically (stop first), and a time-barrier exit is
labeled by realised direction.

### Validation — the honest part

- **Temporal split**, never shuffled. The test set is always the most recent
  30%. Random folds leak the future through adjacent rows.
- **Out-of-sample backtest** via `modelStrategy()`, which turns the model into a
  signal the *same* tested backtester consumes — the equivalent of ml4t-models'
  `predictions_frame_from_asset_forecast` handoff to ml4t-backtest.
- **Deflated Sharpe** adjusts for selection: a good-looking backtest means
  little if many variants were tried.

## The publish gate

A model reaches the public page only if it clears **every** bar, measured out of
sample (`bot/model-registry.js`, `PUBLISH_GATE`):

| Check | Threshold |
|-------|-----------|
| Test AUC | ≥ 0.55 (better than a coin flip) |
| OOS Sharpe | ≥ 0.5 |
| Beat buy-and-hold | required |
| Deflated Sharpe | ≥ 0.90 |
| Test trades | ≥ 5 |
| Test rows | ≥ 60 |

These are demanding on purpose. **Most models fail, and that is the correct
outcome** — the gate exists to stop a lucky-looking backtest from being
presented as a working strategy. The server re-checks eligibility at publish
time, so nothing can bypass the gate from the client.

Publishing is always an explicit, user-initiated action. Nothing auto-publishes.

## API

| Route | Purpose |
|-------|---------|
| `POST /api/v1/bot/train` | Train + validate; returns metrics and gate result |
| `GET /api/v1/bot/models` | List models trained this session |
| `GET /api/v1/bot/models/:id` | Full artifact (weights, scaler, metrics) |
| `POST /api/v1/bot/models/:id/publish` | Gated publish |
| `GET /api/v1/bot/models/published` | The public page |

## Data sources

The app trains on Yahoo OHLCV. Richer inputs:

- **Yahoo Finance** — OHLCV (live in this app)
- **FRED** <https://fred.stlouisfed.org> — macro & rates
- **Alpha Vantage** <https://www.alphavantage.co>
- **Finnhub** <https://finnhub.io> — fundamentals, news
- **Nasdaq Data Link** <https://data.nasdaq.com>
- **Tiingo** <https://www.tiingo.com>
- **ml4t-data** <https://github.com/ml4t/data> — unifies 20+ providers
- **Kaggle Datasets** <https://www.kaggle.com/datasets>

## Local Python pipeline (heavier models)

For LightGBM, RL, and the ml4t-models families, train locally and import the
result. The ML4T libraries (forks under `345668/`) provide the stages:

```bash
# 1. Data
pip install ml4t-data       # 20+ provider adapters, Parquet storage
# 2. Features + labels
pip install ml4t-engineer   # 120 indicators, triple-barrier, alt bars
# 3. Models
pip install ml4t-models     # latent factors, SDF, portfolio nets
# 4. Validation — the overfitting guards
pip install ml4t-diagnostic # Deflated Sharpe, PBO, CPCV, feature importance
# 5. Backtest (shares the Strategy class with live)
pip install ml4t-backtest
# 6. Live
pip install ml4t-live       # IBKR/Alpaca, shadow→paper→live, kill switch
```

Export a trained model to the same artifact contract `bot/model.js` defines
(`{ type, weights|params, scaler, featureNames }`) plus its out-of-sample
metrics, then register it through `POST /api/v1/bot/train` equivalent or a
direct registry insert. It must clear the same publish gate as an in-app model —
the gate does not care which runtime produced the weights.

## Persistence

Trained and published models are written to `.models/registry.json`
(`bot/persistence.js`) and reloaded on startup, so a model — and the published
set behind the public page — survives a restart of the local server. The
directory is gitignored.

Persistence is best-effort: on a read-only serverless filesystem (Vercel) the
write silently no-ops and the app runs in-memory only, identically. A production
deployment swaps the file store for Postgres (metadata) + object storage
(artifacts) without changing any call site.

## Honesty

Backtested and validated performance is **not** a prediction. Most retail
strategies do not beat buy-and-hold after costs — the gate is designed to tell
you that before a model is published, not after. None of this is investment
advice.
