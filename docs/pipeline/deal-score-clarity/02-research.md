# 02 — Research: Deal Score presentation clarity

Ticket: `UXR-DEAL-SCORE-CLARITY-01`
Stage: UX Research
Upstream: `docs/pipeline/deal-score-clarity/01-discovery.md`
Status: complete — handoff to `UXDES-DEAL-SCORE-CLARITY-01`

---

## 0. Corrections to the discovery report

Three of discovery's factual claims do not survive a read of the current source. Design must not carry them forward.

### 0.1 `MIN_SNAPSHOTS` is **8**, not 3 — the FAQ is right and the homepage is wrong

`lib/pipeline/dealRules.ts:11` reads `export const MIN_SNAPSHOTS = 8`. The file's own docstring states the guarantee as *"below 8 snapshots never flag"* (`dealRules.ts:5`), and `evaluateDeal` expires anything under it (`dealRules.ts:30`).

Discovery signal #2 asserted the opposite — that `MIN_SNAPSHOTS = 3` and `FaqAccordion.tsx:13` ("at least 8 historical data points") was the false copy. It is inverted. The corrected table:

| Where | Copy | Matches `dealRules.ts`? |
|---|---|---|
| `lib/pipeline/dealRules.ts:9-11` | ≤70% of median, min **8** snapshots | ground truth |
| `app/components/FaqAccordion.tsx:13` | "70% or below its median — with at least **8** historical data points" | **correct** |
| `app/page.tsx:237` | "30% below its rolling median — with at least **3 days of price history**" | **wrong on both counts** |
| `app/deals/page.tsx:22`, `app/destinations/[city]/page.tsx:57` | "30–50% below their 60-day **average**" | median ≠ average; range is invented |
| `app/page.tsx:82` | "54% below its 60-day **average**" | median ≠ average |

The single string to repair is `app/page.tsx:237`, not the FAQ. `30% below the median` is also a loose rendering of `DEAL_THRESHOLD = 0.70` — the rule is "at or below 70% of the median", i.e. **at least 30% below**, and the hysteresis band (`EXPIRE_THRESHOLD = 0.85`) means a flagged deal survives up to 15% below median before expiring. No user-facing string mentions this.

**Impact on scope:** unchanged in size — still a copy fix — but the fix targets a different file than discovery specified. A design spec that says "change the FAQ from 8 to 3" would introduce the bug it is meant to remove.

### 0.2 The hotel booking review is a **wiring bug**, not a missing backend path

Discovery (#6) called `HotelDecisionSummary`'s "Deal Score unavailable" *"a static branch with no scoring path behind it."* There is a scoring path, and it is already complete:

- `BookingHotelContext.dealScore?: DealScore` — declared at `lib/booking/config.ts:67`
- validated field-by-field by `validateHotelDealScore` at `config.ts:577-601`
- serialised onto the booking URL at `config.ts:936` (`params.set('dealScore', JSON.stringify(...))`)
- parsed back at `config.ts:782` and preserved across continuity at `config.ts:882`

So a scored hotel arrives at the booking review with its `DealScore` intact, correctly typed and currency-checked — and `app/book/BookingFlow.tsx:356-360` renders three hardcoded strings that ignore `hotelContext.dealScore` entirely. `grep -n dealScore app/book/BookingFlow.tsx` returns **nothing**.

This reclassifies the highest-stakes defect from "needs a backend feature" to "read the prop that is already there". It is the cheapest high-value fix in the ticket.

The flight side genuinely lacks the field: `BookingFareContext` has no `dealScore`, and adding one is a larger change than this ticket's one-field budget allows. Flight booking review stays out of scope; see §6.

### 0.3 `--success` and `--brand` resolve to the same colour

`app/globals.css:39-42`: `--brand: var(--primary)` and `--success: var(--primary)`. `--success-soft` is `primary @ 12%` and `--brand-soft` is `var(--primary-soft)`.

`DealBadge` therefore paints **Great** and **Good** in the same hue, separated only by a soft-background alpha difference. The verdict ladder has three rungs and two distinguishable colours. Since the ticket forbids new tokens, the badge cannot be made legible by colour — the distinction has to be carried by text. This constrains directive D1.

---

## 1. What the current implementation actually does

Read: `app/components/DealScorePanel.tsx`, `app/components/DealBadge.tsx`, `lib/scoring/scoreDeal.ts`, `lib/types.ts:86-94`, `lib/db/getBaseline.ts`, plus all six panel call sites and `app/components/__tests__/scorePresentation.test.tsx`.

### 1.1 Render order, high-confidence Good fare

```
DEAL SCORE                                   [ Good ]     ← :175-181
Compared with route history                               ← :185
23rd percentile                                           ← :187-189   ▲ unexplained
USUAL FARE       VS USUAL          WINDOW                 ← :191-196
$412.00          9% below usual    Last 90 days                        ▲ hardcoded
$375.00 — about 9% below the usual $412.00 …              ← :202-204   ▼ the only legible line
```

Both the jargon line (`:187`) and the explanation (`:202`) render at `text-xs` in `--text-2`. They are **typographically identical**. The hierarchy problem is therefore purely one of *order*, not of weight — which is good news: reordering costs nothing in tokens.

### 1.2 The percentile is doubly unusable

Beyond being undefined anywhere in the product, the scale is inverted against intuition (low = cheap) and the panel never says so. Worse, `scoreDeal.ts:113` sets `percentile = confidence === 'low' ? 50 : rawPercentile` — the low-confidence path **discards the real rank and substitutes 50**. Any future surface that reads `score.percentile` without checking `confidence` will read a fabricated value. The panel currently masks this by swapping in a sentence (`:163-165`), but the fabricated 50 is live in the type and reachable by every consumer.

### 1.3 Low confidence is stated five times and evidenced zero times

For one low-confidence flight card, a user reads:

1. badge `Limited history` (`DealBadge.tsx:16`)
2. `Limited price history` (`DealScorePanel.tsx:185`)
3. `Not enough comparable prices for a confirmed rating` (`:164`)
4. `Fewer than 10 comparable prices are available, so this is not a confirmed deal rating.` (`:199`)
5. `Limited route history. Treat this as a rough comparison, not a confirmed deal.` (`FlightCard.tsx:571-573`, duplicated at `HotelCard.tsx:996-999`)

Five restatements of "we don't know", none of which says **how many prices we actually have**. And between #3 and #4 sits `EvidenceGrid` (`:191-196`), rendering `Usual nightly rate $180.00` and `Vs usual 25% below usual` unconditionally of confidence — falsely precise numbers physically positioned *above* the caveat that disowns them. Discovery is right that this survived `AUDIT-DEAL-SCORE-LOW-CONFIDENCE-PRESENTATION-01`.

The `10` in string #4 is a hardcoded literal duplicating the `>= 10` threshold at `scoreDeal.ts:93`. It is correct today and undefended by any test.

### 1.4 "Last 90 days" is an assertion, not an observation

`DealScorePanel.tsx:98` hardcodes it. `getBaseline.ts:16` applies `fetched_at >= NOW() - INTERVAL '90 days'` — a **ceiling**, not a floor. A route with 11 snapshots all taken last Tuesday renders "Window: Last 90 days" with full confidence. `scoreDeal`'s explanation strings (`:144`, `:146`, `:148`) repeat the same unearned "over the last 90 days" three times.

Note the split: `getBaseline` and `app/api/score/route.ts:21` use 90 days; the deal pipeline (`dealDetection.ts:59`, `:205`) uses 60. Both numbers are simultaneously true of different subsystems and are printed on the same page (§1.6).

### 1.5 Verdict and evidence measure different things

`scoreDeal.ts:127-133` sets the verdict from **percentile**; `EvidenceGrid` reports **`pctVsMedian`**. In a right-skewed price distribution — which airfare reliably is — the 45th percentile sits below the median. `Typical` beside `5% below usual` is not a bug, it is the arithmetic working correctly, presented as if the two lines were the same measurement. Nothing on the surface tells the user that the badge answers *"how does this rank?"* and the percentage answers *"how does this compare to the middle?"*

`bestDealCount` (`components/flights/FlightResults.tsx:643`) counts `verdict === 'Great'` with no confidence guard. Safe today only because `scoreDeal.ts:125-126` caps low-confidence to `Typical`. Any surface constructing a `DealScore` outside `scoreDeal` — e.g. `validateHotelDealScore`, which accepts `{verdict:'Great', confidence:'low'}` as valid (`config.ts:594-596`) — breaks the header stat silently.

### 1.6 Two vocabularies collide on one page

`app/deals/[dealId]/page.tsx` renders a discount hero (`DealChip`: `−32% vs usual`; `DealCard.tsx:90`: `usually $412`; `:130`: `Based on 43 price checks over 60 days`) above `DealScorePanel` at `:228`/`:393`, which speaks rank (`Good`, `23rd percentile`, `Vs usual`) over 90 days. Same hotel, same screen, two windows and two measurement systems.

`DealCard.tsx:130` is worth naming as the internal reference pattern: **"Based on 43 price checks over 60 days"** is the one string in the product that discloses sample size and window honestly. The Deal Score panel should be levelled up to it, not the reverse.

### 1.7 Test surface — what is actually locked

`scorePresentation.test.tsx` (574 lines) asserts against **collapsed** `FlightCard`/`HotelCard` output only. Its percentile assertions are negative — `not.toContain('58th percentile')` (`:157`), `not.toContain('50th percentile')` (`:184`), `not.toContain('22nd percentile')` (`:209`) — i.e. they require percentile to be *absent* from the collapsed card. `DealScorePanel` renders only inside `isExpanded` (`FlightCard.tsx:561`, `HotelCard.tsx:980`), so it is not exercised by these tests at all.

**Consequence for design:** removing the percentile line from the panel cannot break the suite; it moves those assertions from incidentally-true to structurally-true. The panel's expanded copy is entirely unguarded, so new tests are part of the deliverable, not optional.

---

## 2. Reference patterns

Compared at the level of interaction and disclosure, not visual style.

### 2.1 Google Flights — price insights

The pattern: **a categorical verdict, then the comparison basis, then the sample disclosure — never a raw statistic.**

- Leads with a plain sentence: *"$247 is low for your search"* / *"…is typical"* / *"…is high"*. Three categories, matching expaify's three verdicts.
- Immediately states the basis: *"Prices are currently **low** — $58 cheaper than usual for your search."* One number, and it is a **currency delta**, never a rank.
- Discloses the evidence span in the same breath: *"…based on price history for this route over the **last 60 days**"* — an observed window, tied to the data shown.
- Google computes percentile-class statistics internally and **never renders an ordinal to the user**. The rank is a mechanism; the sentence is the product.
- Low-confidence handling: when history is thin, the insight module is **withheld entirely** rather than shown with caveats. Absence over hedged precision.

**Delta vs expaify.** expaify renders the mechanism (`23rd percentile`) as line 2 and demotes the sentence to a footnote — the exact inversion. And where Google withholds on thin data, expaify prints exact medians *first* and disowns them *after* (§1.3).

### 2.2 Booking.com — "Great value today" / price-history transparency

The pattern: **a claim is never made without the count behind it.**

- The badge is a bounded claim tied to a stated comparison: *"Great value today"* sits beside *"Lower than usual for your dates"*.
- Price context is always quantified and scoped — *"cheaper than the average price for your dates"* — with the comparison set named.
- Where the sample is thin, the badge is suppressed and the raw context still shown; Booking does not substitute a "limited" badge that replaces the verdict with a non-answer.
- Property-level trust modules consistently pair a rating with its denominator (*"8.6 · 1,204 reviews"*). The count is not a footnote; it sits inline with the claim and is what makes the claim readable.

**Delta vs expaify.** `DealBadge.tsx:14-16` does the opposite of both: low confidence **replaces** the verdict with `Limited history`, so the user gets no answer at all — not even "here is the raw comparison, unrated" — and the panel never states a denominator anywhere, in any state.

### 2.3 The synthesis both references share

> Verdict → basis in the user's own units (currency) → sample size and observed window. The rank is internal. The count is public.

expaify has all four ingredients computed and in scope. `comparableHistory.length` is calculated at `scoreDeal.ts:73` and branched on at `:93`, then **dropped before the return object at `:151-159`**. `DealScore` (`lib/types.ts:86-94`) has no field for it. That is the single genuine backend gap, and discovery scoped it correctly: one optional field, no new query, no schema change.

---

## 3. Design directives

Five directives. Each is testable against rendered output.

---

### D1 — Delete the ordinal percentile from all user-facing copy; lead with the explanation

**Do:** remove the `formatOrdinal` render at `DealScorePanel.tsx:163-165, 187-189`. Promote `score.explanation` to the first line of panel body copy, directly under the verdict badge, replacing both the scope label (`:185`) and the percentile line (`:187`). `formatOrdinal` becomes dead code — delete it.

Because `--success` and `--brand` are the same colour (§0.3), the badge cannot carry Great-vs-Good on its own. The explanation sentence immediately below it is what disambiguates, which is a further reason it must be line 1.

Rank stays in the type and in `verdict` derivation. It never reaches a string.

**Testable:**
- `collectText(DealScorePanel({...}))` matches `/\d+(st|nd|rd|th) percentile/` → **zero matches**, in all four states.
- `grep -rn "formatOrdinal\|percentile" app components` outside `lib/` and `__tests__/` returns nothing.
- In a scored panel, `text.indexOf(score.explanation) < text.indexOf('Usual fare')`.
- Existing negative assertions at `scorePresentation.test.tsx:157, 184, 209` still pass.

**Why:** §1.1, §1.2, §2.1. This is discovery's "sharpest point of confusion" and it is a deletion, not an addition.

---

### D2 — Add `sampleSize?: number` to `DealScore` and state the count in every scored state

**Do:**

1. `lib/types.ts:86-94` — add `sampleSize?: number`. Optional, so the four constructors that do not supply it degrade rather than crash.
2. `lib/scoring/scoreDeal.ts` — return `sampleSize: comparableHistory.length` from both returns, including the zero-history branch at `:77-88` (`sampleSize: 0`).
3. `lib/booking/config.ts:577-601` — `validateHotelDealScore` parses `sampleSize` when present and **omits the key when absent or invalid**. It must never coerce a missing count to `0`; `0` means "we checked and found none", `undefined` means "we don't know".
4. `DealScorePanel` — replace the hardcoded `Window / Last 90 days` fact (`:98`) with a count-and-window fact driven by `sampleSize`, mirroring `DealCard.tsx:130`:
   - `sampleSize` present → `Compared with {n} price checks from the last 90 days` (singular `price check` at n=1)
   - `sampleSize` absent → fall back to today's `Last 90 days`, unchanged
   - `sampleSize === 0` → the panel is in its no-history path; no count fact
5. Correspondingly, `LOW_CONFIDENCE_RULE` (`:13-14`) becomes count-bearing when the count is known — see D3.

Prop contracts on `DealScorePanel` and `DealBadge` are untouched. This is the ticket's **one** permitted backend field.

**Testable:**
- `scoreDeal(fare, history)` with 43 comparable points returns `sampleSize: 43`; with `[]` returns `sampleSize: 0`.
- Panel rendered with `{...score, sampleSize: 43}` contains `43 price checks`; with `sampleSize` deleted contains `Last 90 days` and no `NaN`, no `undefined`, no `0 price checks`.
- `validateHotelDealScore({...valid, sampleSize: 'x'})` returns an object with no `sampleSize` key and does **not** return `null` — a bad optional count must not invalidate an otherwise-valid score.
- Round-trip: `buildBookingUrl` → `parseBookingParams` preserves `sampleSize`.

**Why:** §2.3, §1.3. The count is the fact that makes every other line legible, and it is already computed and discarded.

---

### D3 — In low confidence, suppress precise comparison numbers and state the count instead

**Do:** in `DealScorePanel`, when `score.confidence === 'low'`:

1. Do **not** render `EvidenceGrid` (`:191-196`). No `Usual fare`, no `Vs usual`. This directly closes the unfixed P0.
2. Render a single count-bearing line in its place, at the position the grid occupied:
   - `sampleSize` known → `Compared with {n} recent price{n===1?'':'s'} — not enough to confirm a rating.`
   - `sampleSize` unknown → today's `LOW_CONFIDENCE_RULE` string verbatim.
3. Collapse the five restatements (§1.3) to **two**: the badge, and this one line. Remove the redundant `Limited price history` heading (`:185`) and the `Not enough comparable prices for a confirmed rating` line (`:164`) — both are now said by the count line.
4. Remove the duplicate card-level warnings at `FlightCard.tsx:571-573` and `HotelCard.tsx:996-999`. They restate the panel from outside it and are the reason the message appears five times.
5. Replace the hardcoded `10` in the low-confidence copy with a value derived from a single exported threshold constant in `lib/scoring/scoreDeal.ts` (currently the bare `>= 10` at `:93`), so the copy cannot drift from the rule the way `app/page.tsx:237` drifted from `MIN_SNAPSHOTS`.

`score.explanation` still renders (D1) — for low confidence `scoreDeal.ts:142` already produces a caveat-shaped sentence with no median claim, which is correct as-is.

**Testable:**
- Panel with `confidence: 'low', medianCents: 18000, pctVsMedian: -25` → text contains neither `$180.00` nor `25% below usual`.
- Same panel with `sampleSize: 4` → contains `4 recent prices` and `not enough to confirm a rating`.
- Count of distinct limited-history phrasings in a rendered low-confidence `FlightCard` ≤ 2.
- All four states still render at 375px with the two-column grid (`min-[420px]:grid-cols-3`) intact; low confidence now renders a single full-width line, which cannot overflow.

**Why:** §1.3, §2.1 (Google withholds rather than hedges), §2.2 (Booking suppresses the badge but keeps honest context). Unfixed P0 from `AUDIT-DEAL-SCORE-LOW-CONFIDENCE-PRESENTATION-01`.

---

### D4 — One deal rule, stated identically wherever it appears

**Do:** derive every user-facing statement of the flagging rule from `dealRules.ts` values rather than restating them by hand.

1. **Fix `app/page.tsx:237`** — the only string that contradicts `MIN_SNAPSHOTS = 8`. Per §0.1 the FAQ is correct; the homepage is not. Restate as at-or-below-70%-of-median with at least 8 price checks. Do **not** touch `FaqAccordion.tsx:13`.
2. **`average` → `median`** at `app/deals/page.tsx:22`, `app/destinations/[city]/page.tsx:57`, `app/page.tsx:82`. The pipeline computes a median (`dealDetection.ts`); "average" is a different statistic and the invented `30–50%` range has no counterpart in code.
3. **Name the two windows honestly.** The pipeline is 60-day (`dealDetection.ts:59`), the Deal Score is 90-day (`getBaseline.ts:16`). Reconciling the two systems is explicitly out of scope (discovery §"Out of scope"), but each surface must state *its own* window and not borrow the other's. On `app/deals/[dealId]/page.tsx`, where both render together (§1.6), each block states its own window so the two numbers read as two measurements rather than a contradiction.
4. Keep the `EXPIRE_THRESHOLD = 0.85` hysteresis unstated on marketing surfaces — but if any surface explains why a deal disappeared, that is the number it must use.

**Testable:**
- A test asserts the homepage rule string contains `String(MIN_SNAPSHOTS)` imported from `dealRules.ts`, so raising the constant fails the build rather than silently falsifying the copy.
- `grep -rn "60-day average\|60 day average" app components` returns nothing.
- Every surface string containing a day-window number is traceable to the query that produced it.

**Why:** §0.1, §1.4, §1.6. Discovery's success statement requires the same rule stated identically across results card, detail page, booking review, and FAQ.

---

### D5 — Carry the hotel Deal Score into the booking review; make the flight absence honest

**Do:**

1. `app/book/BookingFlow.tsx:356-360` — replace the three hardcoded strings with `DealScorePanel` driven by `hotelContext.dealScore`, which is already validated and present (§0.2). Pass `scope="hotel"`, `priceNoun="nightly rate"`, `loading={false}`, and the same `unavailableCopy` used at `app/deals/[dealId]/page.tsx:393` so the fallback is identical across surfaces.
2. When `hotelContext.dealScore` is genuinely `undefined`, the panel's existing `!score` branch (`:138-155`) renders the unavailable state — which is what today's hardcoded block *claims* to be. Same words, now conditional and therefore true.
3. **Flight review** (`BookingFlow.tsx:278-315`): `BookingFareContext` carries no `dealScore`, and adding it exceeds this ticket's one-field budget. Do not add it here. Do not add a hardcoded "unavailable" block either — that would repeat the exact defect being fixed on the hotel side. Leave `FareSummary` as-is and raise it as a follow-up (§6).
4. Guard `bestDealCount` (`FlightResults.tsx:643`) with `confidence === 'high'`. `validateHotelDealScore` accepts `{verdict:'Great', confidence:'low'}` (`config.ts:594-596`), so the invariant that currently makes the count safe is enforced only inside `scoreDeal`, not at the presentation layer.

**Testable:**
- `HotelDecisionSummary` given a context with `dealScore: {verdict:'Great', confidence:'high', …}` renders `Great` and the explanation; the string `Deal Score unavailable` is **absent**.
- Same component with `dealScore: undefined` renders `Deal Score unavailable` and the shared fallback copy.
- A hotel scored `Great` in results shows `Great` on the review screen — the continuity check in discovery's success statement.
- `bestDealCount` over a fixture containing `{verdict:'Great', confidence:'low'}` returns `0`.

**Why:** §0.2, §1.5. The last screen before provider handoff currently tells a user their `Great`-rated hotel is unrated, using a string that is a literal, not a fact.

---

## 4. Directive → discovery signal coverage

| Discovery signal | Directive |
|---|---|
| 1 — unexplained percentile leads, explanation buried | D1 |
| 2 — contradictory rule copy | D4 (**target corrected**: `app/page.tsx:237`, not the FAQ) |
| 3 — hardcoded "Last 90 days" | D2 |
| 4 — low-confidence precise numbers (unfixed P0) | D3 |
| 5 — percentile verdict vs median evidence | D1 (removes the rank) + D3 (removes the clash in low confidence) |
| 6 — score absent at booking review | D5 |
| 7 — two vocabularies | D2 (count/window aligns panel to `DealCard`) + D4 (window honesty per surface) |
| Backend gap — no `sampleSize` | D2 |
| `bestDealCount` unguarded (flagged for UXR) | D5.4 |

---

## 5. Constraint compliance

- **No new colour or type tokens.** D1 deletes a line; D2 changes a fact's text; D3 removes a grid in one state. No new colours; §0.3's Great/Good collision is worked around with text, not a new token.
- **Exactly one new backend field.** `sampleSize?: number` on `DealScore`, optional, sourced from `comparableHistory.length` at `scoreDeal.ts:73`. No new query, provider call, or schema change. D2.3 defines the degrade path for the four constructors that lack it. Money stays `{ priceCents, currency }`.
- **Contracts preserved.** `DealScorePanel` props (`score`, `loading`, `scope`, `priceNoun`, `unavailableCopy`) and `DealBadge` props (`verdict`, `confidence`) unchanged. All six call sites compile untouched.
- **Four states survive.** Loading (`:110-136`) untouched. Unavailable (`:138-155`) untouched, and gains a real caller via D5. Low confidence restructured by D3, still `role="group"` with its `aria-label`. Scored reordered by D1. `role="status"` / `aria-label` on loading and unavailable are unchanged.
- **375px.** The evidence grid stays `grid-cols-2` below 420px. D2 lengthens one fact's value; `Fact` already carries `[overflow-wrap:anywhere]` (`:73`). D3 replaces the grid with a single full-width line in low confidence, which is strictly safer at 375px than today's two-column layout.
- **No commits from this stage.** This document is the only artefact.

---

## 6. Out of scope — flagged, not fixed

1. **Reconciling the two deal systems.** `dealRules.ts` (60-day, ≤70% of median, 8 snapshots, hysteresis) vs `scoreDeal.ts` (90-day, percentile, 10 points). A product decision above this ticket; D4 only stops them from contradicting each other in copy.
2. **Flight Deal Score on the booking review.** Requires `dealScore` on `BookingFareContext` plus validation and URL round-trip mirroring `config.ts:577-601, 782, 936`. Exceeds the one-field budget. Recommend `DEV-BOOKING-FLIGHT-SCORE-CONTINUITY-01`.
3. **`scoreDeal.ts:113` fabricates `percentile = 50` on low confidence.** D1 removes the only surface that reads it, but the fabricated value stays in the type where a future consumer can read it as real. Cleanest fix is `percentile?: number`, omitted on low confidence — a second type change, so out of budget here.
4. **`validateHotelDealScore` accepts `{verdict:'Great', confidence:'low'}`** (`config.ts:594-596`), which `scoreDeal` can never produce. D5.4 guards the one known consumer; the validator itself should reject the combination.
5. **`app/page.tsx:82`** (`'54% below its 60-day average'`) is hero marketing copy, not a rule statement. D4.2 corrects `average`→`median`; whether the figure is substantiated is a marketing-claims question.

---

## 7. Handoff

Next: **`UXDES-DEAL-SCORE-CLARITY-01`** — produce `docs/pipeline/deal-score-clarity/03-design.md` covering all four `DealScorePanel` states (loading, unavailable, low-confidence, scored) at 375px and 1280px, with final copy for every string touched by D1–D5, including:

- exact panel element order post-D1 (badge → explanation → evidence)
- singular/plural and zero forms for the `sampleSize` count fact (D2)
- the low-confidence layout with `EvidenceGrid` suppressed (D3)
- final rule copy for `app/page.tsx:237`, `app/deals/page.tsx:22`, `app/destinations/[city]/page.tsx:57` (D4)
- the hotel booking-review panel placement inside `HotelDecisionSummary` (D5)
- focus/keyboard behaviour and aria labelling for each state

Design must read §0 first. Discovery's `MIN_SNAPSHOTS` claim is inverted, and the hotel booking gap is a wiring bug rather than a missing backend path.
