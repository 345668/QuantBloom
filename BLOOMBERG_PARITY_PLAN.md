# Bloomberg-Parity & Mission-Control Improvements

Derived from reference screenshots (real Bloomberg Terminal + a "SURVIVAL × FIELD"
mission-control concept + an n8n bot-orchestration idea). All four tracks are
in scope; built in the order below. Nothing here needs a new external API —
everything reuses existing routes (`/api/v1/forex`, `/api/v1/markets`,
`/api/v1/heatmap`, bot state) or is pure client-side.

Palette is already aligned: `--text-primary: #FF8C00` (amber), `--accent-down`
red — the same amber→red regime language the reference uses.

---

## Track A — Bloomberg essentials pack

### A1. World Clocks panel  ✅ build first (pure client, zero API)
Bloomberg **WCV**. Rows for NY / London / Frankfurt / Dubai / Hong Kong /
Tokyo / Sydney, each with: live local time, day/night glyph (sun/moon by local
hour), UTC offset, and a market-open pill (is the local exchange in session).
- New: `src/components/WorldClockPanel.jsx`. No route. `setInterval(1s)`.
- Session logic: local 09:30–16:00 Mon–Fri → "OPEN" pill (green), else "CLOSED".

### A2. FX dealer grid  (upgrade over flat ForexPanel)
Bloomberg **FXGO** dealer board. Currency-pair tiles showing **BID / ASK** with
a synthesized spread around the mid from `/api/v1/forex`, directional arrow, and
Majors / Emerging tabs. Bid/ask tiles colour by tick direction (green up / red
down) like the reference blue/green dealer grid.
- New: `src/components/FxGridPanel.jsx`. Reuses `/api/v1/forex`. Spread model:
  majors ~1–2 pips, EM wider; derived deterministically from the pair so tiles
  are stable between polls, tick-flash on mid change.

### A3. Radial region market-map
Bloomberg **IMAP** "Intraday Return by Region" sunburst. Inner ring = region,
outer ring = sector, wedge angle = weight, colour = intraday return (red↔green).
Complements the existing treemap `HeatmapPanel`.
- New: `src/components/RegionMapPanel.jsx` (SVG donut, pure geometry).
- Data: reuse `/api/v1/heatmap` (sector returns) + a static region grouping;
  fall back to `/api/v1/markets`.

---

## Track B — Mission Control ("SURVIVAL × FIELD")

A single wide, cinematic operations screen driven by **live bot + backtest state**.

### B1. Market-field visualization
Force-directed node cloud of the tradeable universe. Node = instrument (size by
notional/att, colour by regime: amber calm → red stress via realized vol /
drawdown). Edges = "capital routes" (correlation or the bot's actual
position→position flow). Canvas 2D, animated, `requestAnimationFrame`, capped.
- New: `src/lib/field.js` (pure sim: node/edge layout, regime colour ramp) +
  `src/components/MarketFieldPanel.jsx` (canvas renderer). Unit-test `field.js`.

### B2. Operations rail
Six stacked mini-panels beneath the field, all from bot/backtest state:
- **RUN LOG** — timestamped bot decisions (open/close/mark/skip).
- **POSITION BOOK** — current positions, size bars.
- **DRAWDOWN** — radar/hexagon of risk-gate metrics.
- **FILL HEAT** — heatmap of fills by instrument × hour.
- **EQUITY 48H** — sparkline of the equity curve.
- **LEDGER** — cost/PNL tally.
- New: `src/components/MissionControlPanel.jsx` composing the rail; small pure
  helpers in `src/lib/ops.js` (sparkline path, hexagon points, heat buckets).

---

## Track C — ASKB "Ask QuantBloom"

Terminal-native AI panel mirroring Bloomberg **ASKB**. Free-text box → answers
about a ticker, a panel, or the bot's state. Wires the **existing Mistral**
adapter (already used for bot advisory) behind a new `/api/v1/ask` route that
assembles read-only context (quote, technicals, bot status) and asks Mistral.
Graceful no-key fallback: a deterministic templated summary from local data.
- New: `src/components/AskPanel.jsx` + `POST /api/v1/ask` in `server.js`.
- Safety: read-only. The panel **cannot** place trades or change settings.

---

## Track D — Bot scheduler ("tick sequencer")

The n8n idea, native. A control panel + `POST /api/v1/bot/tick` that runs one
buy/hold/sell + optional auto-train cycle, plus an in-process interval scheduler
(persistent server only) with start/stop, interval, last-run/next-run, and a
run counter. Every tick still passes the existing hard risk gate; paper-only.
- New: `src/components/SchedulerPanel.jsx` + tick route + `bot/scheduler.js`.
- Degrades on serverless (no persistent interval) → manual "Run tick now".

---

## Cross-cutting
- All new panels are pop-out aware (work under `?solo=` / Ctrl+Shift+M) and
  registered in the Ctrl+K command palette.
- Keep the paper-only trading boundary; the scheduler never touches a live
  endpoint (`isPaperEndpoint()` assertion stays).
- Add unit tests for every pure module (`field.js`, `ops.js`, fx spread model).
