# Implementation Plan — Power Markets desk, panel pop-out, Bloomberg parity

Three tracks, from one source publication plus two platform notes:

1. **Power / commodities trading desk** — extracted from *Power 2026: Electricity
   Pricing in the Age of AI* (Neel Somani, former Citadel power & gas quant) and
   his power-pricing primer.
2. **Pop-out / maximise any panel** via a keyboard shortcut.
3. **Bloomberg-terminal parity** — features and illustrations we still lack.

Everything follows the house rules already used across QuantBloom: a **tested
pure-maths module** (`bot/*.js` or `charting/*.js`) behind every panel, honest
labelling of modelled-vs-observed, and no fabricated edge.

---

## TRACK 1 — Power markets desk

The publication is, in effect, a spec for how US wholesale electricity is priced.
Almost all of it reduces to **marginal-cost (merit-order) pricing under
constraints** — which is a small, deterministic, unit-testable computation. This
is a genuinely new asset class for the platform (we have equities, FX, crypto,
commodities quotes — but no *power* analytics).

### Core concepts we can turn into features

| Concept (from the paper) | What we build | Tractable? |
|---|---|---|
| Merit order & marginal unit (ch. 2, 9, 10) | Stack generators by marginal cost, find the unit that clears demand → market price | ✅ pure sort/scan |
| Locational Marginal Price, 2-node congestion (ch. 9) | Two-node dispatch with a transmission limit; show how a **binding constraint** splits the price | ✅ small LP / closed form |
| Heat rate & marginal cost of a gas unit (ch. 3) | `marginalCost = heatRate × gasPrice + VOM (+ carbon)` | ✅ arithmetic |
| **Spark spread / dark spread** (ch. 11) | `spark = power − heatRate × gas`; dark = coal version; **effective heat rate** = implied HR at $0 profit | ✅ arithmetic, tested |
| Heat-rate call option / HRCO (ch. 4) | Value a plant's optionality: `payoff = max(0, power − HR×gas − VOM) × MW × hours`; price by Monte-Carlo spread option | ✅ reuse Black-Scholes/MC machinery |
| Forward strips, peak/off-peak, bal-day (primer, ch. 10-11) | Average a daily price path into a month/quarter **strip**; on/off-peak split | ✅ averaging |
| Duck curve / net demand (ch. 8, 10) | `netDemand = demand − renewables`; batteries charge midday, discharge evening → evening price spike | ✅ curve maths + viz |
| Energy-only scarcity adder (ch. 8) | `price = LMP + VOLL × P(lost load)`; capacity-market vs energy-only contrast | ✅ arithmetic |
| Data-center / plant economics (ch. 3-6) | Given capacity, heat rate, gas, PPA $/MWh → daily revenue, spark margin, breakeven; benchmark to the paper's real deals | ✅ arithmetic |

### Reference numbers to test/seed against (from the paper)
- PV-style plant revenue example: 100 MW × 16 h × $60/MWh ≈ **$96k/day**.
- Anthropic–TeraWulf: 400 MW, 20 y ⇒ implied **~$271/MWh** (no GPUs).
- SpaceX–Reflection: implied **~$5,000/MWh** (with GPUs, 90-day out).
- Typical heat rates: CCGT **6–7**, coal **~10**, SCGT worse; ERCOT scarcity cap **$5,000/MWh**; Alberta cap **C$1,000/MWh**; wind can clear **−$20/MWh**.
- ISOs: PJM (most liquid), MISO, CAISO (NP-15/SP-15, duck curve), ERCOT (energy-only, isolated), SPP, NYISO, ISONE.

### Proposed build — phased

**Phase P1 — `charting/power.js` (tested maths) + `PowerDeskPanel.jsx`**
- `meritOrderPrice(generators, demand)` → `{ clearingPrice, marginalUnit, dispatched[], totalCost }`. Generators = `{name, fuel, capacity, marginalCost}`.
- `marginalCostOfGas(heatRate, gasPrice, vom=0, carbon=0)`.
- `sparkSpread(power, heatRate, gas)`, `darkSpread(power, heatRate, coal)`, `effectiveHeatRate(power, gas)`.
- Tests: merit order picks cheapest first and the marginal unit sets price; adding demand past a cheap unit's capacity raises the clearing price to the next unit; spark spread sign; effective heat rate inverts spark to zero.
- Panel: a small generator-stack editor (seed with a realistic PJM-style stack), a demand slider, and live readouts of clearing price, merit-order bar, marginal unit, and the spark/dark spreads for a chosen heat rate.

**Phase P2 — Two-node LMP & congestion**
- `twoNodeLMP({costA, costB, capAtoB, lineLimit, demandA, demandB})` → `{ lmpA, lmpB, flow, congested }`. Reproduces the paper's A↔B example (cheap B, capped line → A's price jumps when the line binds).
- Visual: two nodes, the line, its utilisation, and the two LMPs; toggle demand to watch the constraint bind.

**Phase P3 — HRCO / plant economics + forward strips**
- `plantDailyPnl({capacityMW, heatRate, gasPrice, powerPrice, hours, vom})`, `hrcoValueMC(...)` (Monte-Carlo spread option reusing existing RNG/greeks), `forwardStrip(dailyPrices, {peakOnly})`.
- Panel tab: plant economics calculator seeded with the Homer City / TeraWulf reference deals, with a breakeven power price and spark-spread margin.

**Phase P4 — Duck curve & scarcity (illustrative)**
- `netDemandCurve(demand[], renewables[])`, `scarcityAdder(voll, pLostLoad)`.
- An intraday chart: demand, renewables, net demand, and the resulting price shape (midday trough, evening spike), clearly labelled a stylised model, not live grid data.

**Data honesty:** we have **no live ISO/LMP feed** (that needs a paid data source, as the paper notes). So Phase 1–4 are **calculators and stylised models** seeded with realistic parameters and the paper's reference numbers — labelled as modelled, exactly like the DCF/VaR panels. A live LMP feed (GridStatus/EIA/ISO APIs) is a separate, keyed integration we can add later.

---

## TRACK 2 — Pop-out / maximise any panel

**Requested behaviour:** any window can be opened full-screen in a pop-up via a
shortcut (e.g. hold the panel + `Ctrl`+`Shift`, or a chord).

**Design (zero per-panel changes):** one globally-mounted `PanelMaximizer`
component that operates on the existing `.panel` DOM nodes:
- Track the pointer; on the shortcut, `document.elementFromPoint(...)` → nearest
  `.panel` → toggle a `panel-maximized` class (plus a dimmed backdrop).
- `.panel-maximized { position: fixed; inset: 12px; z-index: 9999; overflow:auto }`.
- `Esc` restores; clicking the backdrop restores; a corner ✕ restores.
- A subtle first-run hint ("⤢ Ctrl+Shift to expand a panel").

Chosen shortcut: **`Ctrl`+`Shift`+`M`** (maximise the panel under the cursor) and
**double-modifier tap** as an alternative, with `Esc` to close — final keys easy
to tweak. Works uniformly for all ~40 panels because it targets the shared
`.panel` class rather than each component.

---

## TRACK 3 — Bloomberg-terminal parity (gaps & illustrations)

Noted gap: the app is missing many Bloomberg staples, both features and visuals.
A prioritised backlog (most are Tier-B — computable from data we already pull):

**High-value, computable now**
- **Command-line / function bar** (Bloomberg's `TICKER <GO>` mnemonic): a global
  command palette (`/` or `Ctrl+K`) to jump to a symbol + function (e.g.
  `AAPL DES`, `SPY GP`, `NG SPARK`).
- **Security description (DES)** consolidated tearsheet per symbol.
- **Cross-asset monitor grid** (like `WEI`/`FXIP`): indices, FX, rates, commodities
  in one heat-tiled board.
- **Yield-curve & spread illustrations** we partially have — extend with historical
  curve animation and key spreads (2s10s).
- **Supply/demand & merit-order charts** (from Track 1) — the paper's core
  illustrations (supply/demand cross, duck curve, two-node congestion).
- **Options surface / skew** 3-D-ish grid (we have the chain; add the surface viz).
- **Economic-surplus / welfare shading** on any supply-demand plot.

**Needs a feed (document, defer)**
- Real-time streaming quotes (we poll), Level-2 depth, time & sales, news wire
  ticker, `TOP`-style headlines, chat/IB. These need paid/real-time feeds.

**Illustration polish**
- Consistent chart theming already exists; add the Bloomberg-style amber-on-black
  option, keyboard-first navigation, and the command bar as the signature touch.

**Suggested order:** command palette (`Ctrl+K`) → cross-asset monitor grid →
Track-1 power illustrations → options surface. Each is a tested/observable
increment, not a rewrite.

---

## Sequencing recommendation

1. **Panel pop-out** (Track 2) — small, self-contained, improves all 40 panels at once.
2. **Power desk P1** (merit order + spark spread) — the highest-signal extraction from the publication, fully testable.
3. **Command palette `Ctrl+K`** (Track 3) — the signature Bloomberg interaction.
4. Power desk P2–P4, then the remaining parity items.

All honest by construction: power features are **calculators/stylised models**
(no live LMP feed yet, and said so), and no feature claims predictive edge.
