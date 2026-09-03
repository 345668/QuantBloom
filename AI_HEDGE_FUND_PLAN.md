# AI Hedge Fund — Implementation Plan

Derived from *"How to Build a One-Person AI Hedge Fund on Grok Bot: A
Practitioner's Guide to Autonomous Alpha Discovery"* (field report, Aug 2026).

The paper's thesis: a fund runs on **six invariant functional layers**
(Research → Signal → Execution → Risk → Workstation → Growth), and an eight-bot
architecture with a **Chief-of-Staff router** + **maker-checker weekly scoring**
can replace the headcount at each layer. We map the *quant* layers onto
QuantBloom's existing stack, clean-room, in tested JavaScript.

## Scope boundary (what we will NOT build)
The paper's **Growth / Business-Operations** layers — LLC formation, Whop
subscription billing, ad campaigns, accepting outside capital, self-funding —
are out of scope: they are platform-specific (xAI/Grok/Whop) and involve
real-money, legal, and account-creation actions the terminal must never take.
Trading stays **paper-only**. We build the Research, Signal, Risk, and
Workstation layers as *analytics*, never as an instruction to move real money.

---

## Track 1 — Research Desk (the "six-bot" morning brief)
A set of pure analyzers that each emit a structured brief, synthesized into one
morning brief. Reuses existing news/fundamentals feeds; no new paid data.

- **Sentiment Analyst — Loughran-McDonald.** A finance-tuned sentiment scorer
  using the LM word lists (Negative/Positive/Uncertainty/Litigious). Score the
  existing news headlines per ticker; LM measurably beats generic sentiment on
  financial text. → `src/lib/loughran.js` (bundled word lists) + tests.
- **Insider Tracker — Cohen-Malloy-Pomorski clusters.** Detect *multiple*
  insiders buying the same name inside a window (cluster buys ≈ the strongest
  documented insider signal). → `src/lib/insiders.js` (cluster detection over a
  Form-4 feed; degrade gracefully when no feed) + tests.
- **Filings drift — Griffin-Tang.** Flag names with a recent 8-K within the
  ~5-day post-publication drift window. → part of the brief.
- **Coordinator / cross-source confirmation.** "HIGH CONVICTION" = two analyzers
  agree on the same ticker with directional agreement. → `src/lib/brief.js`.
- **Panel:** `ResearchDeskPanel.jsx` — the synthesized morning brief with
  per-analyzer sub-briefs and conviction badges.

## Track 2 — Signal layer (residual-alpha filter)
- **Fama-French 5 + Carhart momentum residual alpha.** We already have factor
  regression (`FactorPanel`). Add a signal filter that keeps only names whose
  residual-alpha **t-statistic > 2.0** (the paper's trade-list gate). →
  `src/lib/residualAlpha.js` + tests; surfaced in the brief and Model Lab.
- **Cross-source ranked trade list** with sector-exposure caps.

## Track 3 — Risk layer (the "Risk Bot" hard limits)
Extend the existing hard risk gate with the paper's explicit institutional
limits, as *additional* clamps (never loosening the current ones):
- position > **2% NAV** → trim; **sector exposure > 30%** → rebalance flag;
  daily drawdown > **5%** → liquidation-halt flag; 60-second position-book poll.
- → extend `bot/risk-gate.js` (sector exposure) + a `RiskMonitorPanel` readout.
All limits are advisory clamps in the paper account; the kill switch stays.

## Track 4 — Fund Operations workstation (the map)
- **`FundOpsPanel.jsx`** — a single view laying the six layers over what
  QuantBloom already does: Research (brief), Signal (model lab / residual alpha),
  Execution (bot), Risk (gate/monitor), Workstation (the terminal itself),
  Growth (explicitly marked *out of scope / manual*). Plus a **maker-checker
  scorecard**: weekly realized-signal accuracy per strategy/model (the
  self-improving loop), read-only.

## Cross-cutting
- Everything is **read-only analytics**; nothing here originates real-money
  trades or business actions.
- Pure modules are unit-tested; panels are `?solo=` / Ctrl+Shift+M aware and
  Ctrl+K discoverable.
- Honest reporting: these are documented signals from the literature, not a
  promise of alpha; we report measured behaviour, not marketing numbers.

## Suggested build order
1. Track 1 (Loughran-McDonald sentiment + insider clusters + morning brief) —
   highest signal, self-contained.
2. Track 2 (residual-alpha t-stat filter) — small, reuses FactorPanel.
3. Track 3 (risk hard-limits + sector exposure).
4. Track 4 (Fund Ops workstation + maker-checker scorecard).
