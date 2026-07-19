# UXD-PRICE-HISTORY-TRUST-001: Price History Chart And Deal Trust Signals

**Stage:** UX Discovery (UXD)
**Date:** 2026-07-19
**Surfaces:** Deal detail page (`app/deals/[dealId]/page.tsx`), price history chart (`app/components/ui/PriceSparkline.tsx`), score panel (`app/components/DealScorePanel.tsx`), deal feed cards (`app/components/ui/DealCard.tsx`)
**Related prior work:** `docs/pipeline/deal-score-trust/` solved score-panel *consistency and evidence hierarchy* on flight/hotel result cards. This ticket is about the *price history chart's legibility* and the remaining gaps in score comprehension on the deal detail flow. It builds on, and must not regress, that work.

---

## Problem Statement (one sentence)

Users looking at a deal cannot tell from the price history chart whether the current price is a genuinely rare drop or a marginal everyday dip, because the chart auto-scales to its own min/max with no price axis, renders 3 data points with the same visual authority as 30, and the accompanying score labels (verdict, "Nth percentile") are never explained in terms a first-time user can trust.

---

## Corrected premise

The ticket describes "the deal score (0-100)". **No 0–100 composite score exists in the code.** What the product actually shows:

- A **verdict** (`Great` / `Good` / `Typical`) plus a **confidence** flag, rendered by `DealBadge` (`app/components/DealBadge.tsx`).
- A **percentile** (0–100, lower = cheaper), rendered as e.g. "23rd percentile" in `DealScorePanel.tsx:150`.
- A **discount chip** (`−18%`) on deal cards and the detail hero (`app/components/ui/DealChip.tsx`).

The likely source of the "unexplained 0–100 score" complaint is the **percentile label**: "42nd percentile" is shown with no gloss anywhere that *lower is better* or what population it ranks against. A user who reads percentiles the way schools use them ("85th percentile = top of class") will invert the meaning. Downstream stages should treat "explain the percentile and verdict" as the real problem, not invent a new 0–100 score.

---

## Who is affected, and where in the flow

- **Who:** First-time and free-tier users evaluating a single deal — the moment of highest purchase intent and highest skepticism ("is this actually cheap, or is every deal labeled a deal?"). Premium trialists deciding whether the product is worth paying for are the highest-stakes segment.
- **Where:** The **deal detail page** (`/deals/[dealId]`), which streams in the "60-day price history" section (sparkline) and the Deal Score panel. Secondarily the **deal feed cards** (`/deals`), which show a discount chip and a one-line trust line but no history visualization and no verdict at all — the user's first exposure to a deal has the weakest evidence.
- Search-results flight/hotel cards (`FlightCard`, `HotelCard`) already carry the shared `DealScorePanel` from the prior sprint and are **not** the focus here.

---

## What the code does today (audited, with file references)

### 1. How price history is rendered

- `PriceHistorySection` in `app/deals/[dealId]/page.tsx:118-150` fetches daily-averaged history via `getPriceHistory` (`lib/pipeline/dealDetection.ts:199-211`): `AVG(price_cents)` grouped by `snapshot_date` over the **last 60 days**, ordered ascending.
- `< 3` points → no chart, only the `TrustLine` sentence. `≥ 3` points → `PriceSparkline` under the heading "60-day price history".
- `PriceSparkline` (`app/components/ui/PriceSparkline.tsx`) draws an 80px-tall SVG line with an area fill, a dashed gold median line, and a gold dot labeled "deal price".

### 2. What the chart shows with 3 vs 30 data points — the core defect

- **X positions are index-based, not date-based** (`PriceSparkline.tsx:31`: `xScale(i) = i / (history.length - 1)`). Three snapshots taken on day 1, day 2, and day 58 render as three evenly spaced points across the full width. The time axis lies about when prices moved.
- **3 points fill the full 560×80 viewBox exactly like 30 points** (`preserveAspectRatio="none"`, full-width line). There is no visual encoding of data density — no per-point markers, no gap rendering, no "n checks" annotation on the chart itself. A user cannot see thin data; they see an authoritative-looking trend line either way.
- **Y auto-scales to min/max of the visible data** (`PriceSparkline.tsx:27-29`). A $4 wobble on a $200/night hotel renders as the same dramatic full-height swing as a $120 crash. This is precisely the "rare drop vs marginal dip" ambiguity in the ticket: the chart *amplifies* marginal dips.
- **No price axis or scale cue at all.** The only numbers near the chart are start/end dates. The user cannot read what the peak or trough was, or how far below "usual" the deal sits, without leaving the chart.
- **The "deal price" dot is placed at the historical point closest in *price*, not at the current point in *time*** (`PriceSparkline.tsx:41-44`). If today's deal price matches a price from five weeks ago, the gold dot lands five weeks in the past. If the deal price is below all history (the best deals), the dot sits on the nearest historical point *above* the actual deal price — the chart understates exactly the deals it should celebrate.
- **Gold means two things.** The dot ("deal price") and the dashed line ("usual price") are both `var(--gold)` (`PriceSparkline.tsx:74,81`), and the legend repeats gold for both. Color cannot disambiguate the two most important marks.
- **The SVG is `aria-hidden` with no accessible alternative** (`PriceSparkline.tsx:57`). A screen-reader user gets the heading "60-day price history" followed by nothing.
- Below-3-points fallback and the `history.length < 2` internal fallback ("Not enough history to show chart") overlap; the internal one is effectively dead on this page.

### 3. Whether the deal score label explains its meaning anywhere

- `DealScorePanel` (post-prior-sprint) shows: verdict badge, "Compared with hotel history", "Nth percentile", an evidence grid (Usual / Vs usual / **Window: Last 90 days**), a low-confidence warning when applicable, and a one-sentence explanation from `scoreDeal`.
- **Nothing explains what the verdict thresholds mean** (Great = ≤15th percentile, Good = 16–40th, `lib/scoring/scoreDeal.ts:124-133`) or that lower percentile = cheaper. No tooltip, no "how we score" link, no expandable explainer anywhere in `app/`.
- **Window copy contradicts the data on the deal detail page.** `DealScorePanel.tsx:85` hardcodes "Last 90 days" and `scoreDeal` explanations say "over the last 90 days" (`scoreDeal.ts:144-148`), but `DealScoreSection` feeds it **60-day** history from `getPriceHistory`, and the adjacent chart heading and `TrustLine` both say **60 days**. A reader who notices sees the product contradict itself inside one viewport — a direct trust hit. (Flight search uses a genuine 90-day baseline via `lib/db/getBaseline.ts`, so the fix must not blindly change the copy globally.)
- **Deal feed cards carry no verdict, confidence, or score at all** — only `−X%` (`DealChip`) and the `TrustLine` sentence ("Based on N price checks over 60 days"). The `−X%` discount is computed against the 60-day median (`dealDetection.ts:50`), but nothing on the card says what the percentage is relative to, beyond the struck-through "usually $X".
- **Duplicate computation:** `PriceHistorySection` and `DealScoreSection` each independently run the market lookup + history query (`page.tsx:118-125` and `162-170`). Besides waste, the two sections can theoretically disagree if data changes between streams.

### 4. Confidence signals today

- `scoreDeal` caps thin data (< 10 comparable points) at `Typical` with `confidence: 'low'`, and `DealBadge` renders "Limited history" — sound mechanics, inherited from the prior sprint.
- `TrustLine` (`app/components/ui/TrustLine.tsx`) has an "Early deal — tracked N times so far" variant for ≤ 2 snapshots.
- But these signals never connect to the chart: a chart drawn from 3 points sits above a trust line and score panel with no shared visual language for "thin evidence". Deals require only `MIN_SNAPSHOTS = 3` to exist (`lib/pipeline/dealRules.ts:11`), so the 3–9 snapshot band — chart present, confidence low — is a common, not edge, state.

---

## How Kayak and Hopper communicate price confidence (pattern level — UXR to verify in teardown)

- **Hopper** leads with a *recommendation*, not a chart: "Buy now" vs "Wait", with an explicit predicted range ("prices are likely to rise $50–$80 within 3 weeks") and a color-coded calendar (green/yellow/red) that encodes cheap-vs-expensive *relative to that market's own range*. Confidence is expressed as a forward-looking claim with stated stakes, and thin data simply produces no prediction rather than a hedged one.
- **Kayak** shows a price-trend indicator with an explicit confidence framing ("prices unlikely to drop within 7 days", historically with a confidence percentage) plus a history chart that carries a *labeled price axis*.
- **Google Flights** (closest structural analogue to our percentile approach) shows a history graph with a shaded **"usual price range" band** — low/typical/high — so any current price is instantly read *against context*: inside the band = normal, below the band = genuinely rare. The badge copy ("cheaper than usual — $120 less than typical") states the comparator in the same breath as the claim.

The transferable pattern for expaify: **anchor the current price against a labeled "usual" zone with real price values on the chart, and state the comparator and data depth in the same visual unit as the claim.** Our percentile machinery already computes everything needed for a usual-range band.

---

## Measurable signals that the problem exists

1. `PriceSparkline.tsx:31` — even index spacing regardless of date gaps (verifiable by rendering 3 snapshots with a 50-day gap).
2. `PriceSparkline.tsx:27-32` — y-range = data min/max; a ±2% price series renders full-amplitude (verifiable with a flat-ish series).
3. `PriceSparkline.tsx:41-44` — deal dot mispositioned in time; dot never sits below the line even when the deal price is a record low.
4. `DealScorePanel.tsx:85` vs `page.tsx:137` — "Last 90 days" and "60-day price history" visible in the same viewport on a hotel deal.
5. No file in `app/` renders any explanation of verdict thresholds or percentile direction (grep for "percentile" — only the bare label).
6. `PriceSparkline.tsx:57` — `aria-hidden` chart with no text alternative.

---

## Constraints the solution must respect

1. **Data integrity / honesty:** The chart may only claim what the data supports — real date positions, real price axis, and explicit data-depth signaling for the 3–9 snapshot band. Never render thin data with the visual authority of dense data, and never claim "Great" or imply rarity on `confidence: 'low'` (existing `scoreDeal` cap must remain the single source of truth; no client-side re-scoring). Money stays `{ priceCents, currency }`.
2. **Performance:** The detail page streams history behind `Suspense`; the fix must not add blocking queries, and should consolidate the duplicated market/history fetch between `PriceHistorySection` and `DealScoreSection` rather than add a third. No charting library — the SVG-in-component approach stays.
3. **Accessibility & brand:** Chart must have a text alternative conveying trend + current-vs-usual; the two chart marks (deal price, usual price) must be distinguishable by more than color; all states must hold at 375px; copy stays in the existing conservative voice ("usual price", "price checks") using existing design tokens — no new colors.

---

## Success statement

This is solved when a first-time user opening a deal detail page can tell **within one glance at the chart** whether today's price is genuinely rare or only marginally below usual — because the chart shows real dates, a real price scale, and the usual-price zone — and can tell **how much to trust that picture** because data depth (3 checks vs 30) is visible on the chart itself, the percentile/verdict is explained in one plain sentence where it appears, and no two elements on the page state contradictory lookback windows.

---

## Downstream focus for UXR (Stage 2)

1. Teardown Google Flights' usual-range band and Hopper's recommendation framing at the interaction-pattern level; decide which maps onto our percentile/median data without inventing predictions we can't make.
2. Audit the 3-, 5-, 9-, and 30-point rendering states of `PriceSparkline` concretely (screenshots or rendered fixtures) and define the exact state ladder: no chart (< 3), thin-data chart (3–9, must look tentative), full chart (≥ 10).
3. Resolve the 60-vs-90-day window contradiction: either the panel copy becomes dynamic per data source, or the hotel history query extends to 90 days — flag that flight search legitimately uses 90 (`lib/db/getBaseline.ts`) so a global copy edit is wrong.
4. Define where verdict/percentile explanation lives (inline microcopy vs disclosure) and whether the deal feed card should surface the verdict at all, given it currently shows only `−X%`.
