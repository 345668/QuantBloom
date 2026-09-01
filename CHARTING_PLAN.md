# Advanced Charting — TradingView-inspired feature plan

A roadmap for bringing pro-charting capability to QuantBloom's chart, drawing on
the *functionality* TradingView is known for. Features and ideas are not
copyrightable; this plan is a clean-room specification of behaviour we build
from scratch.

## Ground rules (read first)

This is a **clean-room reimplementation from published behaviour**, not a port.

- **No decompilation.** We do not disassemble, decompile, or extract code or
  assets from the TradingView binary. We build every feature fresh.
- **No trademarks or assets.** No "TradingView" name, logo, colour scheme, icon
  set, or "Pine Script" branding anywhere in the product or code.
- **No named clones.** Where TradingView has a proprietary term (Pine Script,
  its specific indicator packs), we build the generic capability under our own
  neutral name.
- **Functionality is fair game.** "A chart with a Fibonacci tool", "Heikin-Ashi
  candles", "a volume profile" — these are standard financial-charting
  primitives, many predating TradingView, and are legitimate to implement.

If anything in this plan can only be built by looking at their code, it is out
of scope and gets cut.

---

## Where QuantBloom already is

The existing `ChartPanel` (lightweight-charts) already has:

- Candlestick chart with MA / Bollinger / RSI / MACD overlays
- Timeframes 1m → 5Y
- Drawing tools: trendline, horizontal line, Fibonacci retracement, rectangle
  (anchored in price/time, persisted per symbol) — `ChartDrawings.jsx`
- Symbol search, watchlist, alerts, compare/rebased overlay, screener, heatmap

So the gap is depth of charting, not a blank slate. This plan closes that gap.

---

## Phase 1 — Chart types

The single biggest visible gap. lightweight-charts supports several natively;
others we compute from candles.

| Type | Build | Notes |
|------|-------|-------|
| Line / Area / Baseline | native series | trivial toggle |
| Bars (OHLC) | native | trivial |
| Hollow candles | derived colouring | up/down + open/close rule |
| **Heikin-Ashi** | compute HA candles from OHLC | classic smoothing; pure maths, tested |
| **Renko** | brick construction from close + box size | no time axis; own render |
| **Line Break** | 3-line-break from closes | derived series |
| Range / Point & Figure | later | more involved |

**New:** a chart-type selector; `bot/`-style tested maths module
`charting/chart-types.js` (HA, Renko, line-break are deterministic transforms —
unit-test them against known fixtures).

## Phase 2 — More indicators & an overlay manager

Today four overlays are hard-wired. Generalise to a library.

- Overlays (on price): EMA/SMA/WMA, VWAP (session + anchored), Ichimoku Cloud,
  Parabolic SAR, SuperTrend, Keltner, Donchian, pivot points.
- Oscillators (sub-pane): RSI, MACD, Stochastic, CCI, Williams %R, ADX, ATR,
  MFI, OBV — most already computed in `bot/indicators.js`, just not plotted.
- **Overlay manager**: add/remove/configure indicators, each with editable
  params, persisted per symbol.

Reuse the tested indicator maths already in `indicators.js`; this phase is
mostly plumbing to the chart, not new maths.

## Phase 3 — Drawing tools, expanded

Build on the existing `ChartDrawings` price/time-anchored overlay.

- Fib **extensions**, fib fans, fib time zones
- Channels (parallel, regression), pitchfork
- Shapes: ellipse, arrow, brush/freehand, callout/text
- **Measure tool** (drag to read Δprice, Δ%, bars, time)
- **Long/short position tool** (entry, target, stop → R:R readout)
- Drawing toolbar with select/move/delete, per-drawing style, and
  **templates** (save a set of drawings/indicators as a reusable layout)

## Phase 4 — Volume & market structure

- **Volume profile** (histogram of volume by price over the visible range) +
  session volume profile; point-of-control and value-area lines
- Volume-weighted colouring, relative volume
- Support/resistance auto-detection from swing highs/lows
- Session shading (pre-market / RTH / after-hours) where data allows

## Phase 5 — Layout & workflow

- **Multi-pane layouts** (2 / 3 / 4 charts in a grid, independent symbols &
  timeframes, optional synced crosshair)
- **Bar replay** — step forward bar-by-bar from a chosen point to review a setup
  without lookahead (we already enforce point-in-time in the backtester; this is
  the interactive version)
- Chart templates / saved workspaces (localStorage first, server later)
- Keyboard shortcuts (timeframe cycle, tool select, symbol jump)

## Phase 6 — Custom indicator editor (generic, not Pine)

A neutral, sandboxed formula editor so users can define an indicator from OHLCV
and the built-in indicator functions — **our own small expression language**,
not a clone of Pine Script's syntax or standard library.

- Whitelisted functions (sma, ema, rsi, cross, …), no arbitrary code execution
- Evaluated in a worker; output plotted like any built-in
- Save/share custom indicators (subject to the same publish discipline as the
  Model Lab)

---

## Sequencing

| # | Phase | Why here |
|---|-------|----------|
| 1 | Chart types (HA, Renko) | Highest visible impact, self-contained tested maths |
| 2 | Indicator library + manager | Unlocks everything else; reuses existing maths |
| 3 | Drawing tools + measure + position tool | Most-requested trader workflow |
| 4 | Volume profile & structure | Real analytical value from data we have |
| 5 | Multi-pane + bar replay | Workflow depth |
| 6 | Custom indicator editor | Powerful but the most involved; last |

Each phase ships behind the existing chart with tested maths where the transform
is deterministic (chart types, indicators, volume profile), following the same
test-first discipline as the rest of the repo.

## Data reality

Everything above runs on the **daily/intraday OHLCV we already fetch from
Yahoo**. It needs no new data feed. The one honest limit: true volume profile
and session structure are richer with intraday tick/volume data than with daily
bars — we build them from what we have and say so in the UI, exactly as the rest
of the app labels modelled vs. observed.

## Not in scope

- Any TradingView code, asset, icon, colour palette, or the names
  "TradingView" / "Pine Script"
- Real-time streaming tick data (needs a paid feed; separate track)
- Their social/publishing network and broker integrations (we have our own
  paper-trading bot)
