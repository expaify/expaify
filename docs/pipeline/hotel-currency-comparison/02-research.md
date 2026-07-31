# UXR-HOTEL-CURRENCY-COMPARISON-01: Hotel Currency and Price Comparison Confidence Research

Date: 2026-07-31
Stage: UX Research
Persona: Senior UX Researcher

## Discovery Input

Source: `docs/pipeline/hotel-currency-comparison/01-discovery.md`

Problem statement: a traveller shopping hotels in a foreign market cannot tell that the nightly rate on screen is a provider-side conversion to USD at an undisclosed rate, and cannot tell that currency is the reason when the Deal Score goes missing.

This ticket owns **comparability only**: whether two prices on screen can honestly be compared, and what happens to the Deal Score when they cannot. Formatting consistency belongs to `results-currency-localization`; charge currency, payment timing, and FX cost at handoff belong to `local-currency-payment`; exact-vs-estimated totals belong to `hotel-total-stay-cost`.

---

## Current Implementation Audit

Every claim below was read in source. Where the audit contradicts discovery, the correction is marked **[CORRECTION]** and downstream stages must follow the audit, not the discovery text.

### The conversion is real, undisclosed, and invisible to our own data model

- `lib/providers/hotellook.ts:479` requests `&currency=USD`; `:518` hardcodes `currency: 'USD'` on every live-path offer. `lib/providers/bookingComRapidApi.ts:87` sets `currency_code=USD` (flights; that provider returns `ok: false` before mapping, so it reaches no user today).
- Nothing in `HotelOffer` records whether a conversion occurred, at what rate, or when. The provider hands back a USD number; expaify stores a USD number. There is no field to render provenance from, and no field to distinguish a Lisbon property priced in EUR from a Boston property priced in USD. **This is the structural core of the problem: expaify does not know which of its own prices are conversions.**
- Provider responses are Redis-cached 6h, so the conversion embedded in the figure can be up to six hours stale before a snapshot even records it.
- `lib/fx/convert.ts` returns a bare `number` with one hardcoded RUB rate — and is **imported by nothing** (`grep convertToUSD app lib scripts components` returns only its own definition). It is dead code, not a live conversion boundary. Discovery is right that it cannot express provenance; it is not on any hotel path.

### [CORRECTION] `HotelCard.tsx` is not rendered by any application surface

`grep -rn "HotelCard" app components lib --include=*.tsx` outside the file itself returns only `HotelRateRestrictions.tsx:118` (`HotelCardEligibilityLine`, an unrelated export) and test files. The live hotel-price surfaces are:

| Surface | File | What it renders |
| --- | --- | --- |
| Deals feed / destination pages | `app/components/ui/DealCard.tsx` via `app/deals/DealFeed.tsx` | nightly deal price, `usually {median}`, discount chip, savings line |
| Deal detail | `app/deals/[dealId]/page.tsx` | `DealScorePanel`, price history |
| Booking review | `app/book/BookingFlow.tsx:378` | hotel summary + score |

Directives must land on **DealCard, DealFeed, the deal detail page, and `DealScorePanel`**. `HotelCard`'s price block (`:355–370`) should receive the same copy contract so it is correct when it is reconnected, but it is not the shipping surface and must not be treated as the acceptance target.

### [CORRECTION] Currency mismatch does not withhold the Deal Score — it is silently overwritten

Discovery states that a non-USD offer renders the generic `Score unavailable` chip. Traced end to end, that is not what happens:

1. `lib/scoring/scoreDeal.ts:75` filters history to same-currency points. On an empty result (`:78–92`) it does **not** return `null` — it returns a fully-formed `DealScore` with `percentile: 50`, `medianCents: 0`, `verdict: 'Typical'`, `confidence: 'low'`, and the explanation `No comparable {CURRENCY} price history available for this hotel.`
2. `DealScorePanel` renders that object as a low-confidence panel (`app/components/DealScorePanel.tsx:186–195`): warning styling, the explanation sentence, and — because `sampleSize === 0` — `lowConfidenceCountLine` returns `null` (`:71`), so the panel shows *only* the explanation with no evidence grid. The `Score unavailable` state (`:137–155`) is reached solely when `score === null`.
3. On the live deal-detail path, `score === null` happens only when `pricePoints.length === 0` (`app/deals/[dealId]/page.tsx:213`) — i.e. thin history, never currency.
4. **The mismatch branch is unreachable on that path anyway**, because the same page hardcodes `currency: 'USD' as const` on both the history points (`:211`) and the offer (`:217`). A snapshot stored in EUR is relabelled USD before scoring. The same-currency guard in `scoreDeal` — which is correct — is bypassed upstream.

So the real defect is worse than "silently withheld". On the shipped surface a cross-currency comparison is **silently performed and labelled as a valid Typical/Great/Good verdict**. The withholding behaviour discovery describes is real but lives only on `GET /api/score?type=hotel&currency=…` (`app/api/score/route.ts:51`, `:88`), which reads true currencies from `hotel_snapshots` and is not wired to any hotel results UI.

### [CORRECTION] The deals pipeline has no currency at all

- `lib/db/schema.sql:125–149`: the `deals` table has **no currency column**. `deal_price_cents`, `median_price_cents`, and `discount_pct` are currency-less integers.
- `lib/pipeline/dealDetection.ts:44–52` computes `PERCENTILE_CONT(0.5) … price_cents` and the latest price across `price_snapshots` rows for a hotel/check-in with **no grouping or filtering by `currency`**, even though `price_snapshots.currency` exists (`schema.sql:114`). `getPriceHistory` (`dealDetection.ts:202`) averages `price_cents` the same way.
- `app/page.tsx:45–46` and `DealFeed.tsx:1797, 1814` then stamp `currency: 'USD'` onto both `dealPrice` and `medianPrice` client-side.

`DealCard` therefore renders `$212 USD` / `usually $290 USD` / `27% off` / `Save $78 USD/night` from integers whose currency is asserted, never verified — and the discount percentage, the feed's headline claim, is a ratio between two figures that are not guaranteed to share a basis. If a hotel's snapshots ever span currencies, the percentage is arithmetic on unlike units.

### [CORRECTION] Mixed-currency hotel result sets are near-unreachable; the grouped sort is flights-only

- The `a.price.currency.localeCompare(...)` sort at `app/api/search/route.ts:101–103` is inside `dedupFares` — **flights only**. Hotel offers stream via `send({ type: 'hotels', … })` (`:408`) unsorted. Discovery's "cheapest-first list that is not cheapest-first" claim does not apply to hotels.
- The live hotellook path stamps `'USD'` unconditionally (`:518`), so segment 3 (mixed-currency result set) cannot arise from a fresh fetch. It *can* arise from the cache path: `normalizeCachedHotelOffer` (`:337–398`) accepts any non-empty currency string and passes it through to `pricePerNight.currency`. A 6h-cached payload written by a different code version, or a second hotel provider added later, surfaces a non-USD offer into a UI whose filters and comparisons assume dollars.

**Revised segment weighting for design:** segment 1 (converted-to-USD, provenance gap) is **universal** — it affects every hotel price in the product. Segment 2 (native non-USD) is **rare but catastrophic**, and its shipped failure mode is a *wrong score*, not a missing one. Segment 3 is **latent** — the code cannot currently produce it on the fresh path but has no guard against it either.

### What the surfaces say today

| Surface | Currency-basis copy present |
| --- | --- |
| `DealCard` supporting stack | none. `Based on {n} price checks over 60 days · expaify never adds fees` (`:130`) |
| `DealFeed` price filter | `Under $100 / $150 / $200 / $300` (`:95–101`), hardcoded `$` in `statusSentence` (`:114`) |
| `DealFeed` sort | `Lowest nightly price` / `Lowest current rate per night` (`:71–74`) |
| `DealScorePanel` | `Deal Score`, verdict badge, explanation, `Usual nightly rate`, `Vs usual`, `Based on {n} price checks, last 90 days` — no basis statement |
| `HotelCard` price block (`:363–367`) | `per night before taxes and fees` / `Rate from {provider}` / `Last-checked time unavailable` — good price-basis stack, no currency basis |

`grep "Currency basis"` returns nothing: the `results-currency-localization` directives were researched but never designed or implemented (`docs/pipeline/results-currency-localization/` contains `01-discovery.md` and `02-research.md` only). Its copy contract is available to reuse but is **not** shipped, so this ticket cannot assume it.

---

## Reference Pattern Comparison

### Booking.com Demand API — display prices

When `booker_currency` and `accommodation_currency` differ, partner UIs must "show the price clearly in both currencies" and must "clearly state that if the exchange rate changes before the traveller completes the booking, they will pay a different price to the one shown."

Two things to borrow at the interaction level: (1) the converted figure is never allowed to stand alone as if it were the property's price — the basis travels with the number; (2) the disclosure is about *uncertainty and whose rate it is*, not about publishing a rate. Both fit expaify's no-FX constraint exactly. What expaify cannot borrow is the dual-currency display: we do not receive `accommodation_currency` from hotellook, so we cannot show the second figure. Our honest analogue is to name the actor and the unknown, not the amount.

Source: https://developers.booking.com/demand/docs/accommodations/display-prices

### Google Hotels — conversion for comparability, refreshed on a clock

Google converts prices into the user's locale currency specifically so that offers from different providers are comparable, validates the price against what the partner shows on its own site, and instructs partners to "keep your site's conversions updated every few hours" precisely because a stale conversion breaks that validation.

The pattern to borrow is the pairing: conversion is legitimate *as a comparison device*, but it is only legitimate while it is fresh, and freshness is stated on a clock. expaify already has that clock — a 6h provider cache and daily snapshots — and already renders freshness copy (`Price checked {time}`, `Rate check`). The gap is that the freshness copy currently covers the price and not the conversion baked into it.

Sources: https://support.google.com/hotelprices/answer/6064419, https://support.google.com/hotelprices/answer/11202391

---

## Exact Gap

| Surface | Current code does | Reference pattern does | Delta this ticket owns |
| --- | --- | --- | --- |
| `DealCard` price block | Renders `formatMoney` USD with no basis; discount and `usually` come from currency-less columns | Basis travels with a converted number | One basis sentence naming the provider as the converter and the rate as unseen |
| Deal detection | Medians/discounts across `price_snapshots` with no currency grouping | Comparison is only made within a basis | Restrict aggregation to one currency; record it; exclude rather than assert |
| `DealScorePanel` | Cross-currency history relabelled USD upstream, then scored as a valid verdict | Comparison states what it compares | Never relabel; distinguish "no history" from "no comparable history" and say which |
| Score chip | Binary: score or `Score unavailable` — no reason, and unreachable for currency | — | A distinct paused state with a stated reason |
| Price filter / sort | `Under $150`, `Lowest nightly price` over raw cents | Filters operate inside a stated basis | State the basis, or constrain the set to one currency |
| Freshness copy | Covers the price only | Conversions refreshed on a clock | Extend existing freshness copy to cover the conversion, no new timestamp |

---

## Design Directives For UXDES

Five directives. Each is testable and none adds a currency picker, a rate, an FX call, or a change to provider request currency.

### D1 — Every nightly rate carries one comparison-basis sentence naming the converter

Applies to `DealCard` (`app/components/ui/DealCard.tsx`), the deal detail price block, and `HotelCard`'s supporting stack (`:363–367`) for contract parity.

- Placement: in the existing caption-size supporting stack **below** the price, adjacent to `per night before taxes and fees` / `Based on {n} price checks…`. Not inside the price block — the `min-w-[6.75rem] max-w-[9.5rem]` column must not grow.
- Final copy, provider known: **`USD figure from {provider}. If the property prices in another currency, this is their conversion at a rate we don't receive.`**
- Final copy, provider not known: **`USD figure from the rate provider. If the property prices in another currency, this is their conversion at a rate we don't receive.`**
- Copy rule: the sentence must never state, imply, or approximate a rate, must never say "guaranteed", and must not claim the property's own currency (we do not receive it). The conditional `If the property prices in another currency` is load-bearing — it is the only honest form given that `HotelOffer` cannot distinguish a converted price from a native one.
- Suppression rule: shown whenever a valid nightly money value renders. Not shown in the `PriceUnavailable` state — that state's existing reason copy and `aria-label` stay untouched.
- 375px: caption token, wraps to at most three lines, no truncation, no tooltip-only disclosure.

### D2 — A stored currency is never relabelled, and the Deal Score says when currency is why

- **D2a (data truth, DEV):** `app/deals/[dealId]/page.tsx:211` and `:217` must pass through the currency stored on the snapshot and deal rows instead of `'USD' as const`. Without this, the same-currency rule at `scoreDeal.ts:75` is dead code on the only surface that renders a hotel score, and every directive below is untestable. No change to `scoreDeal` itself.
- **D2b (reason carrier, DEV):** `DealScore` gains an additive optional discriminator for the no-comparable-history branch — e.g. `unavailableReason: 'no_history' | 'currency_mismatch'` set at `scoreDeal.ts:78–92`, plus the history currency when it is a mismatch. `sampleSize === 0` is currently ambiguous between "no history at all" and "history exists in another currency", which makes measure M2 uncomputable and forces the UI to parse an English sentence. Additive field only; no existing field changes meaning.
- **D2c (panel copy, UXDES):** when the reason is `currency_mismatch`, `DealScorePanel` must not render the verdict badge, the percentile, or the evidence grid. Reuse the `results-currency-localization` mismatch contract verbatim: **`Deal Score paused because {PRICE_CURRENCY} prices cannot be compared with {SCORE_CURRENCY} history.`** When the reason is `no_history`, existing copy is unchanged.
- **D2d (chip copy, UXDES):** the score chip (`HotelCard.tsx:697–701`, and wherever the deals surfaces adopt it) gains a third state between `Score unavailable` and a verdict: visible label **`Score paused`**, accessible name **`Deal Score paused because this price and this hotel's price history are in different currencies.`** `Score unavailable` keeps its current meaning — thin or absent history — and its current copy.

### D3 — A discount percentage is only shown when both figures share a verified currency

- **D3a (DEV):** `lib/pipeline/dealDetection.ts:44–52` must group/filter its median and latest-price selection by `price_snapshots.currency`, and the `deals` table must gain a `currency CHAR(3) NOT NULL` column populated from that basis. `getPriceHistory` (`:202`) must do the same.
- **D3b:** if a hotel's snapshot window for a check-in spans more than one currency, the deal is **excluded** from detection rather than published with an unbasis'd percentage. Silence is correct here; an unverifiable "27% off" is not.
- **D3c (UI):** `DealFeed.tsx:1797, 1814` and `app/page.tsx:45–46` must stop stamping `'USD'` client-side and read the deal's stored currency. `DealCard`'s `Save {…}/night` line (`:105`) already inherits `deal.dealPrice.currency` and needs no change once the source is honest.
- Acceptance: no rendered discount percentage, `usually` figure, or savings figure is ever computed from two different currencies. This is the single highest-value fix in the ticket — it is the only place where the currency gap produces a false *number* rather than a missing statement.

### D4 — Comparison controls state the basis they operate in

- The nightly-price filter (`DealFeed.tsx:95–101`) and the `Lowest nightly price` sort (`:71–74`) currently assert dollars over raw cents. Once D3 lands, deals carry a currency and the controls must either state their basis or scope the set.
- Filter group: add one caption line beneath the price-filter control — **`Nightly price filters compare USD deals only.`**
- Sort option description (`:74`): change `Lowest current rate per night` to **`Lowest current rate per night, compared in USD.`**
- `statusSentence` (`:114`): the hardcoded `$` becomes the deal-set currency; when the applied filter would compare across currencies, non-USD deals are excluded from the filtered set rather than compared by raw cents, and the status sentence says so in its existing sentence grammar.
- Constraint: no new control, no currency selector, no second filter row. `resolveHotelResultsView` / `buildHotelResultsUrl` param contracts are unchanged.

### D5 — Freshness copy covers the conversion, not just the price

The USD figure is only as current as the check that produced it — a 6h cache plus a daily snapshot means the embedded conversion can be a day old, which is exactly the failure Google's "refresh conversions every few hours" rule exists to prevent. No new timestamp, no new field: extend the copy already anchored to the existing check time.

- Deal detail / expanded `Rate check` block (`HotelCard.tsx:1067–1070`, deal detail equivalent): append **`The USD figure was set when this rate was checked and is not re-converted since.`**
- `DealCard`'s `Price checked {time}` line (`:110–116`) is unchanged — D1's sentence already carries the provenance on the scan surface, and this ticket owes the smallest viable disclosure there.

---

## Measures

Conflict (a) resolved, not inherited: **currency-control use is unmeasurable and is dropped, not escalated.** No `preferredCurrency`, `displayCurrency`, or selector exists anywhere in `app/` or `lib/`, and `docs/pipeline/local-currency-payment/01-discovery.md` constraint 1 rules currency selection out of scope. Designing a picker to generate that signal would breach both that boundary and this ticket's "no new feature" constraint. It is replaced by:

- **M1 — Provenance comprehension.** Unmoderated task on a `DealCard` at 375px: "Who set this dollar figure, and does expaify guarantee the rate?" Pass = the participant names the provider and says the rate is not expaify's. Target ≥80% after D1; the sentence is the only carrier, so a fail is a copy fail, not a layout fail.
- **M2 — Score-unavailable attribution.** With D2b shipped, report the share of hotel score renders in `no_history` vs `currency_mismatch`. Expected baseline today is 0% mismatch — not because mismatch is rare, but because `page.tsx:211/217` relabels it away. A non-zero mismatch rate after D2a is the proof the fix works, not a regression.
- **M3 — Filter-basis interpretation.** Comprehension probe on `Under $150`: "Does this promise anything about the currency of the results?" Target ≤10% reading it as a guarantee after D4.
- **M4 — Discount integrity (automated, not user-facing).** Assertion in the detection pipeline: count of published deals whose contributing snapshots span more than one currency must be 0 after D3.

---

## Scope Resolution

Conflict (b), resolved:

- **`results-currency-localization`** owns how a currency basis is *formatted and phrased consistently* across surfaces. Its mismatch sentence is reused verbatim in D2c; its unshipped `Currency basis` fact row is **not** restated here and remains its to ship.
- **`local-currency-payment`** owns charge currency, payment timing, and FX cost at the handoff boundary. D1's sentence stops at the comparison; it says nothing about what the traveller will be charged. If UXDES needs handoff-side wording, import `docs/pipeline/local-currency-payment/03-design.md` §1 tokens rather than minting new strings.
- **`hotel-total-stay-cost`** owns exact-vs-estimated totals. `per night before taxes and fees` stays exactly as written.
- **This ticket** owns only: is this comparison honest, and what do we say when it is not.

---

## Acceptance Criteria For Design Stage

1. Every surface that renders a nightly rate has one final basis sentence, specified for provider-known and provider-unknown cases, at 375px and 1280px, without widening the price column.
2. The design spec distinguishes three score states with final copy for each: verdict, `Score unavailable` (thin/absent history), `Score paused` (currency mismatch) — including the panel treatment that suppresses badge, percentile, and evidence grid in the paused state.
3. The spec states the exclusion rule for cross-currency deals in detection and in the filtered set, and the exact status-sentence grammar when exclusion applies.
4. No spec copy states, implies, or approximates an exchange rate, or claims a guaranteed conversion.
5. Component contracts, exports, and accessible names are preserved: `HotelCard` `reviewAriaLabel`, `PriceUnavailable` `aria-label`, `DealCard` `aria-label`, `DealScorePanel` `unavailableCopy` prop and `unavailableAriaLabel`.
6. Every directive that requires a data change (D2a, D2b, D3a) is called out in the spec as DEV-stage work with the UI consequence specified, so the UI stage is never blocked on guessing.

---

## Out-Of-Scope Findings

Recorded, not actioned — none is fixed under this ticket:

- `lib/fx/convert.ts` is dead code (no importers) carrying one hardcoded RUB→USD rate. It should be deleted or given a real owner; it is not a conversion boundary today and must not be wired up as one here.
- `HotelCard.tsx` (≈1,100 lines, heavily tested) is rendered by no application surface. Either a results surface lost its card or the component is orphaned. Worth a discovery ticket of its own.
- `hotel_snapshots_unique` is `(hotel_id, date)` with no currency component (`schema.sql:25`), so a hotel that changes reporting currency mid-window silently overwrites nothing and accumulates mixed-currency rows. `scoreDeal` handles this correctly; `dealDetection` does not (D3).
- `lib/providers/bookingComRapidApi.ts` requests USD but returns `ok: false` before mapping — no user impact today; the same provenance gap will apply on the day it is mapped.
