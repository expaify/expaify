# 03 — Design: Deal Score presentation clarity

Ticket: `UXDES-DEAL-SCORE-CLARITY-01`
Stage: UX Design
Upstream: `docs/pipeline/deal-score-clarity/02-research.md` (read §0 first), `01-discovery.md`
Status: complete — handoff to `UI-DEAL-SCORE-CLARITY-01`

This is an implementation-ready spec. Every visible string below is final copy. Where a string is unchanged from today, it is marked **(unchanged)** so the implementer does not "improve" it.

---

## 0. Design principle for this surface

> **Verdict → sentence → evidence.** The badge is the answer, the sentence is the reason, the grid is the proof. Nothing above the sentence may be a statistic the user has not been taught to read.

Three consequences that drive every decision in this document:

1. **The rank never becomes a string.** `score.percentile` stays in the type and in verdict derivation. It has no rendered form in any state. (D1)
2. **A claim never appears without its denominator.** Where the count is known it is stated; where it is unknown the copy degrades to a window-only statement; where it is zero the panel says nothing precise at all. (D2, D3)
3. **`--success` and `--brand` are the same colour** (§0.3). Great and Good are visually indistinguishable by hue. The explanation sentence directly under the badge is therefore *load-bearing*, not decorative — it is the only thing that separates the two verdicts. This is why it must be line 1 and why it steps up one type size.

---

## 1. Type and colour inventory (no new tokens)

Everything below already exists in `DealScorePanel.tsx` or `app/globals.css`. No new colour or type token is introduced.

| Role | Classes | Where it already exists |
|---|---|---|
| Eyebrow ("Deal Score") | `text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]` | `DealScorePanel.tsx:70, 119, 145, 175` |
| **Primary sentence** (new role for existing classes) | `text-sm font-medium leading-5 text-[color:var(--text-1)]` | identical to unavailable-state line `:148` |
| Secondary / caveat | `text-xs font-medium leading-5 text-[color:var(--text-2)]` | `:151, 184, 187, 202` |
| Warning caveat | `text-xs font-medium leading-5 text-[color:var(--warning)]` | `:198` |
| Fact label | `text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]` | `:70` |
| Fact value | `mt-0.5 [overflow-wrap:anywhere] font-medium leading-5 text-[color:var(--text-1)]` | `:73` |
| Grid | `grid grid-cols-2 gap-2 text-xs min-[420px]:grid-cols-3` | `:92` |

**The only typographic change in this ticket** is that `score.explanation` moves from `text-xs`/`--text-2` to `text-sm`/`--text-1`. Both values are already in this file. This is what fixes the §1.1 finding that the jargon line and the explanation were typographically identical — with the jargon line deleted, the sentence must visibly become the primary line, or the panel reads as three equal-weight fragments.

`panelClasses()` (`:26-38`) is **unchanged**. Low confidence keeps `--warning-soft`, Great keeps `--success-soft`, Good keeps `--brand-soft`, Typical keeps `--bg-raised`.

---

## 2. `DealScorePanel` — element order, all four states

Prop contract is unchanged: `{ score, loading, scope, priceNoun, unavailableCopy }`. All six call sites compile untouched.

### 2.1 State A — Loading

**Unchanged.** `DealScorePanel.tsx:110-136` ships as-is: `role="status"`, `aria-label="Loading Deal Score."`, eyebrow, "Checking recent price history" **(unchanged)**, three shimmer blocks, one shimmer line, all `aria-hidden`.

Rationale: the skeleton's three-block grid still matches the scored state's three-fact grid, so no layout shift is introduced by this ticket. Do not reduce it to two blocks to anticipate the low-confidence state — the loading state cannot know which state resolves next, and the taller skeleton is the safer of the two (it over-reserves rather than under-reserves).

```
┌──────────────────────────────────────────────┐
│ DEAL SCORE                        ▒▒▒▒▒▒▒    │
│ Checking recent price history                │
│ ▒▒▒▒▒▒▒▒   ▒▒▒▒▒▒▒▒   ▒▒▒▒▒▒▒▒               │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                   │
└──────────────────────────────────────────────┘
```

### 2.2 State B — Unavailable (`score === null`, not loading)

**Unchanged.** `:138-155`. `role="status"`, `aria-label` from `unavailableAriaLabel(scope)` **(unchanged)**.

```
DEAL SCORE                                        ← eyebrow
Deal Score unavailable                            ← text-sm / --text-1   (unchanged)
{unavailableCopy}                                 ← text-xs / --text-2   (unchanged)
```

This state gains a real caller via D5 (§5). Its copy is already correct; the defect was that the booking review printed these words as literals rather than reaching this branch.

Per-call-site `unavailableCopy` values, all **(unchanged)**:

| Call site | Copy |
|---|---|
| `FlightCard.tsx:568` | `We could not compare this fare against route history yet. The live price is still shown when available.` |
| `HotelCard.tsx:988` | `We could not compare this hotel rate against recent history yet.` |
| `app/deals/[dealId]/page.tsx:233` and `:393` | `We could not compare this nightly rate with enough recent hotel prices.` |
| **`BookingFlow.tsx` (new, D5)** | `We could not compare this nightly rate with enough recent hotel prices.` |

The booking-review value is deliberately the *same string* as the saved-deal page so the two hotel surfaces cannot drift.

### 2.3 State C — Low confidence (`score.confidence === 'low'`)

Element order, top to bottom:

```
DEAL SCORE                          [ Limited history ]   ← eyebrow + DealBadge
{score.explanation}                                       ← text-sm / --text-1   ▲ promoted
{countLine}                                               ← text-xs / --warning  ▲ replaces the grid
```

**`EvidenceGrid` is not rendered.** No `Usual fare`, no `Usual nightly rate`, no `Vs usual`, no window fact. This closes the unfixed P0 from `AUDIT-DEAL-SCORE-LOW-CONFIDENCE-PRESENTATION-01`: the panel no longer prints a precise median above the caveat that disowns it.

**Deleted from this state:** the `Limited price history` heading (`:185`) and the `Not enough comparable prices for a confirmed rating` line (`:163-165, 187-189`). Both are now said by the badge and the count line.

**Count line copy** — driven by `score.sampleSize`:

| `sampleSize` | Rendered | Notes |
|---|---|---|
| `undefined` | `Fewer than 10 comparable prices are available, so this is not a confirmed deal rating.` | today's `LOW_CONFIDENCE_RULE` **(unchanged)**, but the `10` is now interpolated from the exported constant — see §6.3 |
| `1` | `Compared with 1 recent price — not enough to confirm a rating.` | singular |
| `n ≥ 2` | `Compared with {n} recent prices — not enough to confirm a rating.` | plural |
| `0` | *line not rendered* | see below |

**Zero form.** When `sampleSize === 0` the panel is in `scoreDeal`'s no-history branch and `score.explanation` already reads `No price history available for this route.` or `No comparable USD price history available for this route.` Rendering "Compared with 0 recent prices" beneath a sentence that just said there is no history is a third restatement of the same fact. So at zero the count line is **suppressed** and the state renders as eyebrow + badge + explanation only. This still satisfies D3's "collapse to two mentions" — the badge and the sentence.

The em dash is a true em dash (`—`, U+2014), matching `scoreDeal`'s explanation strings.

**Restatement audit — D3's testable ceiling of 2.** In a rendered low-confidence expanded `FlightCard`, "limited history" is now said exactly twice: once by the badge (`Limited history`), once by the count line. The panel heading is gone, the `Not enough comparable prices…` line is gone, and the card-level warning is gone (§4).

### 2.4 State D — Scored, high confidence

Element order, top to bottom:

```
DEAL SCORE                                    [ Good ]    ← eyebrow + DealBadge
$375.00 — about 9% below the usual $412.00 for this       ← text-sm / --text-1   ▲ promoted to line 1
route over the last 90 days.
USUAL FARE          VS USUAL           BASED ON           ← EvidenceGrid
$412.00             9% below usual     43 price checks,
                                       last 90 days
```

**Deleted:** the scope label (`Compared with route history` / `Compared with hotel history`, `:16-18, 185`) and the percentile line (`:163-165, 187-189`). `scopeLabel()` and `formatOrdinal()` both become dead code and must be **removed from the file**, not left unused — a lint-clean deletion is part of the deliverable.

Deleting the scope label loses nothing: `score.explanation` already ends `…for this route` / `…for this hotel`, so scope is stated inside the sentence that replaced it.

**Fact 1 — Usual price.** Unchanged logic (`:93-96`). Label from `priceNoun`: `Usual fare` (route) or `Usual nightly rate` (hotel) **(unchanged)**. When money is invalid, label becomes `Usual fare unavailable` and value `Not enough valid price data` **(unchanged)**.

**Fact 2 — Vs usual.** Unchanged (`:97`). Label `Vs usual` **(unchanged)**, value from `formatPctVsMedian` **(unchanged)**: `9% below usual` / `9% above usual` / `At usual price` / `Unavailable`. Still suppressed when `hasValidUsual && Number.isFinite(pctVsMedian)` is false **(unchanged)**.

**Fact 3 — the count-and-window fact (D2).** This is the one fact whose copy changes.

| `sampleSize` | Label | Value |
|---|---|---|
| `undefined` | `Window` | `Last 90 days` — today's copy, **(unchanged)**, the graceful-degrade path |
| `1` | `Based on` | `1 price check, last 90 days` |
| `n ≥ 2` | `Based on` | `{n} price checks, last 90 days` |
| `0` | — | unreachable in this state: `sampleSize === 0` always implies `confidence === 'low'` (`scoreDeal.ts:76-88`), which renders State C |

Written this way the value string contains the literal substring `43 price checks`, which is what makes D2's assertion (`text` contains `43 price checks`) hold under `collectText`, where label and value concatenate without a separator. Do not split the count into the label.

The label flip from `Window` to `Based on` is deliberate: when the count is present the fact's subject is the *evidence*, and "Window" would misname it. It also aligns the panel with `DealCard.tsx:130` (`Based on 43 price checks over 60 days`), the one string in the product that already discloses sample size honestly (§1.6, §2.3). The panel says `last 90 days` rather than `over 60 days` because the panel's data genuinely comes from the 90-day query at `getBaseline.ts:16` — see D4/§6 on never borrowing the other subsystem's window.

**Known, accepted redundancy:** `score.explanation` ends with "over the last 90 days" and the third fact repeats "last 90 days". Removing either would cost more than it saves — the sentence needs the window to be self-contained when read alone (screen readers, the collapsed→expanded transition), and the fact needs it to bind the count to a span. Changing `scoreDeal`'s explanation strings is outside D1–D5. Flagged in §8.

**Great vs Good with one colour.** Because the badge cannot distinguish them (§0.3), the reader distinguishes them from the sentence: a Great fare's sentence reads `about 34% below the usual…`, a Good fare's reads `about 9% below the usual…`. This works only if the sentence is line 1 at `text-sm`. It is the primary functional argument for D1's promotion, not just a hierarchy preference.

---

## 3. Responsive behaviour

### 3.1 375px (mobile)

Panel container: `px-3.5 py-3`, `flex flex-col gap-2` **(unchanged)**. Usable width inside a `FlightCard`/`HotelCard` details region at 375px is ~319px.

- **Scored:** grid is `grid-cols-2` below 420px. Facts wrap as `Usual fare | Vs usual` on row 1, `Based on` alone on row 2. The `Based on` value (`43 price checks, last 90 days`) is the longest value in the panel; it wraps onto two lines inside a ~150px column. `Fact`'s existing `[overflow-wrap:anywhere]` (`:73`) prevents overflow; no truncation, no ellipsis, no `whitespace-nowrap` anywhere in this panel. Verify at n = 4 digits (`1,204 price checks`) — must wrap, not clip.
- **Low confidence:** no grid at all. One full-width sentence plus one full-width caveat. Strictly fewer overflow risks than today's two-column layout.
- **Header row:** `flex items-start justify-between gap-3` with `min-w-0` on the eyebrow and `shrink-0` on the badge **(unchanged)**. `Limited history` is the longest badge label and already fits at 375px today.
- **Explanation at `text-sm`:** the longest realistic sentence (`$1,204.00 — about 34% below the usual $1,812.00 for this route over the last 90 days.`) runs ~4 lines at 375px. Acceptable — it is the primary content of the panel. No clamping, no "read more".

### 3.2 1280px (desktop)

- **Result cards:** panel sits in the expanded details column. Grid is `min-[420px]:grid-cols-3` — all three facts on one row. Explanation runs 1–2 lines.
- **`app/deals/[dealId]/page.tsx`:** panel sits in the right column of the price section. Unchanged geometry.
- **Booking review (D5):** the panel occupies the `1.2fr` column of `lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]` (`BookingFlow.tsx:346`). Note that `min-[420px]` is a **viewport** query, not a container query — at a 1280px viewport it is always active, so the three facts render on one row regardless of how narrow that column is. This is the tightest instance of the scored grid in the product and is the specific case the implementer must eyeball at 1280px. The `Based on` value is the one at risk; `Fact`'s `[overflow-wrap:anywhere]` guarantees it wraps rather than clips, so the failure mode is a taller cell, not overflow. **Do not** add a breakpoint or change `min-[420px]` — that would alter all six call sites.

### 3.3 States that must be checked at both widths

Loading, unavailable, low-confidence (with and without `sampleSize`), scored (with and without `sampleSize`, and with `Vs usual` suppressed). Eight renders per width.

---

## 4. Card-level duplicate warnings — deleted

Remove these two blocks entirely. They restate the panel from outside it and are the reason "limited history" appeared five times (§1.3).

| File | Lines | Deleted copy |
|---|---|---|
| `app/components/FlightCard.tsx` | `570-574` | `Limited route history. Treat this as a rough comparison, not a confirmed deal.` |
| `app/components/HotelCard.tsx` | `995-999` | `Limited hotel history. Treat this as a rough comparison, not a confirmed deal.` |

The surrounding `{score?.confidence === 'low' ? ( … ) : null}` wrapper goes with them. Nothing replaces them — the panel's count line now carries this, inside the panel where the numbers it qualifies live.

The **collapsed-card** badges (`FlightCard.tsx:380-393`, `HotelCard.tsx:699-712`) are **unchanged**. They render `Limited history` on the collapsed card and are asserted by `scorePresentation.test.tsx:157, 184, 209`. They are outside the expanded panel and are not part of the five restatements.

---

## 5. Booking review — hotel Deal Score (D5)

### 5.1 What changes

`app/book/BookingFlow.tsx:355-360`, inside `HotelDecisionSummary`, currently renders a hardcoded card. Replace the entire `<div … role="status">…</div>` with:

```tsx
<DealScorePanel
  score={hotelContext.dealScore ?? null}
  loading={false}
  scope="hotel"
  priceNoun="nightly rate"
  unavailableCopy="We could not compare this nightly rate with enough recent hotel prices."
/>
```

`hotelContext.dealScore` is already declared (`lib/booking/config.ts:67`), validated (`:577-601`), serialised onto the booking URL (`:936`), parsed back (`:782`) and preserved across continuity (`:882`). This is a wiring fix, not a new data path (§0.2).

`?? null` is required: `dealScore` is `DealScore | undefined`, the prop is `DealScore | null`.

`loading={false}` is correct — `hotelContext` is fully resolved before `HotelDecisionSummary` renders (`BookingFlow.tsx:507-514`), so there is no state in which this panel is pending.

### 5.2 Layout and heading

The panel replaces a `rounded-lg border … px-4 py-4` card and brings its own `rounded-[var(--radius-card)] border … px-3.5 py-3`. The visual delta is a slightly smaller radius and 2px less padding, inside a grid cell whose sizing does not change. The section heading `Price and Deal Score` (`:345`) is **unchanged** and now correctly describes both columns.

Drop the eyebrow duplication: the deleted block had its own `Deal Score` fact label (`:357`); the panel supplies its own eyebrow, so there is exactly one.

### 5.3 Continuity outcome

A hotel scored `Great` in results now reads `Great` on the review screen, with the same explanation sentence and the same evidence grid — which is discovery's success statement for this surface. When `dealScore` is genuinely absent the panel renders State B with the identical `Deal Score unavailable` wording the block used to hardcode. Same words, now conditional and therefore true. `BookingFlow.test.tsx:205` (fixture has no `dealScore`) continues to pass unchanged.

### 5.4 Flight review — deliberately untouched

`FareSummary` (`BookingFlow.tsx:278-315`) is **not** modified. `BookingFareContext` carries no `dealScore`; adding one requires a second type change plus validation and URL round-trip, which exceeds this ticket's one-field budget. Do **not** add a hardcoded "unavailable" block on the flight side — that would reproduce the exact defect being removed on the hotel side. Follow-up filed as `DEV-BOOKING-FLIGHT-SCORE-CONTINUITY-01` (§8).

### 5.5 `bestDealCount` guard

`components/flights/FlightResults.tsx:643` counts `verdict === 'Great'` with no confidence guard. Add it:

```ts
const bestDealCount = displayFlights.reduce(
  (count, fare) =>
    count + (scores[fare.id]?.verdict === 'Great' && scores[fare.id]?.confidence === 'high' ? 1 : 0),
  0,
)
```

Safe today only because `scoreDeal.ts:125-126` caps low confidence to `Typical`, but `validateHotelDealScore` accepts `{verdict:'Great', confidence:'low'}` (`config.ts:594-596`), so the invariant is enforced in one place and relied on in another. The stat's copy — `Great deals` / `Ranked well against recent route history.` — is **unchanged**; "ranked" is a plain-English verb here, not an exposed ordinal.

---

## 6. Copy repairs outside the panel (D4)

One rule, stated identically wherever it appears. All four strings below are final.

### 6.1 `app/page.tsx:237` — the one string that contradicts the code

Per §0.1 the FAQ is correct and the homepage is wrong. **Do not touch `FaqAccordion.tsx:13`.**

Current:
> A deal is only flagged when a price falls 30% below its rolling median — with at least 3 days of price history behind it.

Replace with a string built from `dealRules.ts`, so raising `MIN_SNAPSHOTS` breaks a test rather than silently falsifying the copy:

```tsx
import { DEAL_THRESHOLD, MIN_SNAPSHOTS } from '@/lib/pipeline/dealRules'
…
body: `A deal is only flagged when a price drops to ${Math.round(DEAL_THRESHOLD * 100)}% or below its rolling 60-day median — with at least ${MIN_SNAPSHOTS} price checks behind it.`,
```

Rendered today:
> A deal is only flagged when a price drops to 70% or below its rolling 60-day median — with at least 8 price checks behind it.

This matches the FAQ's rule verbatim in substance ("70% or below its median — with at least 8 historical data points") and matches step 01's own "60-day price history" **(unchanged)** two paragraphs above it. `price checks` is used rather than `historical data points` because it is the noun the deal cards, the trust line, the email templates and now the Deal Score panel all use; the FAQ's wording stays as-is because §0.1 forbids touching it and it is not wrong.

### 6.2 `average` → `median`, and the invented range

| File | Current | Final |
|---|---|---|
| `app/deals/page.tsx:22` (metadata description) | `We track 20 destinations daily and surface hotel deals 30–50% below their 60-day average price.` | `We track 20 destinations daily and surface hotel deals at least 30% below their 60-day median price.` |
| `app/destinations/[city]/page.tsx:57` (metadata description) | `expaify tracks hotels in ${displayName} daily and surfaces deals 30–50% below their 60-day average price.` | `expaify tracks hotels in ${displayName} daily and surfaces deals at least 30% below their 60-day median price.` |
| `app/page.tsx:82` (mock deal headline) | `54% below its 60-day average` | `54% below its 60-day median` |

`median` because `dealDetection.ts` computes a median, not a mean. `at least 30%` because `DEAL_THRESHOLD = 0.70` is a floor with no ceiling — the `30–50%` range has no counterpart anywhere in code. These are metadata strings; keep them under ~155 characters (both final strings are).

`app/page.tsx:82` is mock hero data; only the statistic's *name* is corrected here. Whether `54%` is substantiated is a marketing-claims question, flagged in §8.

### 6.3 Threshold constant for the panel copy

`scoreDeal.ts:93` hardcodes `>= 10` and `DealScorePanel.tsx:14` hardcodes the matching `10` in prose. Export the threshold and interpolate it, exactly as §6.1 does for `MIN_SNAPSHOTS`:

```ts
// lib/scoring/scoreDeal.ts
export const MIN_COMPARABLE_PRICES = 10
…
const confidence: 'high' | 'low' =
  comparableHistory.length >= MIN_COMPARABLE_PRICES ? 'high' : 'low'
```

```ts
// app/components/DealScorePanel.tsx
const LOW_CONFIDENCE_RULE =
  `Fewer than ${MIN_COMPARABLE_PRICES} comparable prices are available, so this is not a confirmed deal rating.`
```

Rendered output is byte-identical to today. This is the D4 pattern applied to the second rule so the copy cannot drift the way `app/page.tsx:237` drifted from `MIN_SNAPSHOTS`.

### 6.4 Two windows, stated per surface

The pipeline is 60-day (`dealDetection.ts:59, :205`); the Deal Score is 90-day (`getBaseline.ts:16`, `app/api/score/route.ts:21`). Reconciling them is out of scope. Each surface states **its own** window and never borrows the other's:

| Block | Window it states |
|---|---|
| `DealCard`, `DealChip`, `TrustLine`, deal-detail hero, homepage steps, FAQ, deals/destinations metadata | 60 days |
| `DealScorePanel` (all states), `scoreDeal` explanations | 90 days |

On `app/deals/[dealId]/page.tsx`, where a 60-day discount hero and the 90-day panel render in the same section, both are already labelled and stay labelled. Two measurements, each with its own span, reads as two measurements — not as a contradiction.

`EXPIRE_THRESHOLD = 0.85` stays unstated on marketing surfaces. If any surface ever explains why a deal disappeared, that is the number it must use.

---

## 7. Accessibility: focus, keyboard, aria — per state

`DealScorePanel` contains **no interactive elements** in any state. Nothing in it receives focus; nothing gains `tabIndex`; the badge is a `<span>`, not a control. Keyboard behaviour inside the panel is therefore "no stops", and that is correct — this is a disclosure surface, not a widget.

### 7.1 Container semantics

| State | Element | Role | Label |
|---|---|---|---|
| Loading | `div` | `role="status"` **(unchanged)** | `aria-label="Loading Deal Score."` **(unchanged)** |
| Unavailable | `div` | `role="status"` **(unchanged)** | `unavailableAriaLabel(scope)` **(unchanged)** |
| Low confidence | `section` | `role="group"` **(unchanged)** | see §7.2 |
| Scored | `section` | `role="group"` **(unchanged)** | see §7.2 |

`role="status"` on the two transient states is right: a screen reader announces the skeleton→result change without the user hunting for it. `role="group"` on the two content states is right: the panel is a labelled region the user navigates into, not a live announcement.

### 7.2 `aria-label` on the scored and low-confidence states

Today the label is `Deal Score for this ${priceNoun}` — it names the region but withholds the verdict, so a screen-reader user must enter the group to learn the answer that a sighted user reads from the badge in one glance. Make the label carry the verdict:

| Condition | `aria-label` |
|---|---|
| `confidence === 'low'` | `Deal Score for this fare: limited price history.` / `…for this nightly rate: limited price history.` |
| otherwise | `Deal Score for this fare: Great.` / `Good.` / `Typical.` (and the `nightly rate` variants) |

Implementation:

```ts
const verdictForLabel = isLowConfidence ? 'limited price history' : score.verdict
const groupLabel = `Deal Score for this ${priceNoun}: ${verdictForLabel}.`
```

This is an `aria-label` value change only — no prop, no role, no DOM structure change.

### 7.3 Reading order

The DOM order is the reading order in every state, and after D1 the DOM order is the priority order: eyebrow → badge → sentence → evidence. Before this change a screen reader read `Deal Score, Good, Compared with route history, 23rd percentile, Usual fare $412.00, …` and only reached the sentence last. After, the second thing announced after the verdict is the sentence that explains it.

The badge sits **after** the eyebrow in DOM order but renders right-aligned via `justify-between` **(unchanged)** — visual and reading order already agree.

### 7.4 Card-level focus, unchanged

`FlightCard` / `HotelCard` details toggles keep their `aria-expanded`, `aria-controls={detailsId}` and `focus-visible:outline-2 … outline-[var(--border-focus)]` ring **(unchanged)**. The panel renders only inside the expanded region, so it enters and leaves the tab order's *content* but never adds a tab stop. Deleting the card-level warnings (§4) removes a text node only — no focusable element is removed, so tab order across both cards is byte-identical to today.

### 7.5 Booking review

The new panel sits inside `<section aria-labelledby="hotel-price-score-title">` **(unchanged)**. The deleted block carried `role="status"`; the panel supplies `role="group"` (scored/low) or `role="status"` (unavailable) itself. Net: one region role in that grid cell, correctly typed to what it contains, instead of a permanent `status` on content that never changes.

### 7.6 Non-text contrast

Because Great and Good share a hue (§0.3), verdict is **never** conveyed by colour alone in any state — the badge label is text, the sentence is text, the low-confidence caveat is text. This is already the case and must stay so; no state may be reduced to a coloured chip without a word in it.

---

## 8. Backend surface this design depends on (D2)

Exactly one new field. This is the ticket's entire backend budget.

```ts
// lib/types.ts
export interface DealScore {
  percentile: number;
  pctVsMedian: number;
  medianCents: number;
  currency: string;
  verdict: 'Great' | 'Good' | 'Typical';
  confidence: 'high' | 'low';
  explanation: string;
  sampleSize?: number;   // ← new; comparableHistory.length
}
```

- **Optional**, so the constructors that do not supply it degrade to today's copy rather than crash or print `undefined`.
- `scoreDeal.ts` returns `sampleSize: comparableHistory.length` from **both** returns, including the no-history branch (`:77-88`, where it is `0`).
- `validateHotelDealScore` (`config.ts:577-601`) parses `sampleSize` when present and **omits the key** when absent or invalid. It must never coerce a missing count to `0`: `0` means "we checked and found none", `undefined` means "we don't know". A bad optional count must not invalidate an otherwise-valid score, so it must not cause a `null` return.
- Round-trips through `buildBookingUrl` → `parseBookingParams` with the rest of the object.

Money stays `{ priceCents, currency }`. No new query, no schema change, no provider call.

---

## 9. Copy manifest — every string this ticket touches

| # | Location | Final copy | Status |
|---|---|---|---|
| 1 | Panel, all states | `Deal Score` (eyebrow) | unchanged |
| 2 | Panel, loading | `Checking recent price history` | unchanged |
| 3 | Panel, unavailable | `Deal Score unavailable` | unchanged |
| 4 | Panel, unavailable | `{unavailableCopy}` (4 values, §2.2) | unchanged; 1 new caller |
| 5 | Panel, scored | *(scope label)* | **deleted** |
| 6 | Panel, scored/low | *(`23rd percentile` / `Not enough comparable prices for a confirmed rating`)* | **deleted** |
| 7 | Panel, scored/low | `{score.explanation}` | unchanged text, **promoted to line 1, `text-sm`/`--text-1`** |
| 8 | Panel fact 1 | `Usual fare` / `Usual nightly rate` / `… unavailable` / `Not enough valid price data` | unchanged |
| 9 | Panel fact 2 | `Vs usual` · `9% below usual` / `9% above usual` / `At usual price` / `Unavailable` | unchanged |
| 10 | Panel fact 3, count known | `Based on` · `43 price checks, last 90 days` | **new** |
| 11 | Panel fact 3, count known, n=1 | `Based on` · `1 price check, last 90 days` | **new** |
| 12 | Panel fact 3, count absent | `Window` · `Last 90 days` | unchanged (degrade path) |
| 13 | Panel, low conf., n≥2 | `Compared with 4 recent prices — not enough to confirm a rating.` | **new** |
| 14 | Panel, low conf., n=1 | `Compared with 1 recent price — not enough to confirm a rating.` | **new** |
| 15 | Panel, low conf., count absent | `Fewer than 10 comparable prices are available, so this is not a confirmed deal rating.` | unchanged text, `10` now interpolated |
| 16 | Panel, low conf., n=0 | *(no count line)* | **new behaviour** |
| 17 | Panel, low conf. | *(`Limited price history` heading)* | **deleted** |
| 18 | `DealBadge` | `Limited history` / `Great` / `Good` / `Typical` | unchanged |
| 19 | `FlightCard.tsx:571-573` | `Limited route history. Treat this as…` | **deleted** |
| 20 | `HotelCard.tsx:996-998` | `Limited hotel history. Treat this as…` | **deleted** |
| 21 | `BookingFlow.tsx:357-359` | hardcoded `Deal Score` / `Deal Score unavailable` / fallback sentence | **deleted**, replaced by the panel |
| 22 | `app/page.tsx:237` | `A deal is only flagged when a price drops to 70% or below its rolling 60-day median — with at least 8 price checks behind it.` | **new**, interpolated from `dealRules.ts` |
| 23 | `app/page.tsx:82` | `54% below its 60-day median` | **new** |
| 24 | `app/deals/page.tsx:22` | `We track 20 destinations daily and surface hotel deals at least 30% below their 60-day median price.` | **new** |
| 25 | `app/destinations/[city]/page.tsx:57` | `expaify tracks hotels in ${displayName} daily and surfaces deals at least 30% below their 60-day median price.` | **new** |
| 26 | `FlightResults.tsx:1029-1035` | `Great deals` / `Ranked well against recent route history.` | unchanged (count logic guarded, §5.5) |
| 27 | `FaqAccordion.tsx:13` | — | **do not touch** (§0.1) |
| 28 | Panel `aria-label`, scored/low | `Deal Score for this fare: Good.` etc. (§7.2) | **new** |

---

## 10. Acceptance criteria for `UI-DEAL-SCORE-CLARITY-01`

The panel's expanded copy is currently unguarded by any test (`DealScorePanel` renders only inside `isExpanded`; `scorePresentation.test.tsx` asserts collapsed output only). New tests are therefore part of the UI deliverable, not optional.

1. `collectText(DealScorePanel(props))` matches `/\d+(st|nd|rd|th)\s+percentile/` → **zero matches** in all four states.
2. `grep -rn "formatOrdinal\|percentile" app components` outside `lib/` and `__tests__/` returns nothing.
3. Scored panel: `text.indexOf(score.explanation) < text.indexOf('Usual fare')`.
4. Scored panel with `sampleSize: 43` contains `43 price checks`; with `sampleSize: 1` contains `1 price check,` (not `1 price checks`); with `sampleSize` deleted contains `Last 90 days` and contains no `NaN`, no `undefined`, no `0 price checks`.
5. Low-confidence panel with `medianCents: 18000, pctVsMedian: -25` contains neither `$180.00` nor `25% below usual` nor `Usual nightly rate`.
6. Low-confidence panel with `sampleSize: 4` contains `4 recent prices` and `not enough to confirm a rating`; with `sampleSize: 1` contains `1 recent price —`; with `sampleSize: 0` contains no `Compared with`.
7. A rendered low-confidence expanded `FlightCard` states limited history at most **twice**.
8. Loading and unavailable states render byte-identically to `main`.
9. `HotelDecisionSummary` with `dealScore: {verdict:'Great', confidence:'high', …}` renders `Great` and the explanation, and does **not** contain `Deal Score unavailable`; with `dealScore: undefined` it renders `Deal Score unavailable` plus the shared fallback copy. `BookingFlow.test.tsx:205` still passes.
10. `bestDealCount` over a fixture containing `{verdict:'Great', confidence:'low'}` returns `0`.
11. `scoreDeal(fare, history)` with 43 comparable points returns `sampleSize: 43`; with `[]` returns `sampleSize: 0`.
12. `validateHotelDealScore({...valid, sampleSize: 'x'})` returns an object with no `sampleSize` key and does **not** return `null`; `buildBookingUrl` → `parseBookingParams` preserves a valid `sampleSize`.
13. The homepage rule string contains `String(MIN_SNAPSHOTS)` imported from `dealRules.ts`.
14. `grep -rn "60-day average\|60 day average\|30–50%\|30-50%" app components` returns nothing.
15. `FaqAccordion.tsx:13` is unmodified.
16. All eight state × width combinations (§3.3) render at 375px with no horizontal overflow and no clipped text, and at 1280px including the booking-review column (§3.2).
17. `npx tsc --noEmit --incremental false` exits 0; `npm test -- --passWithNoTests` exits 0.

---

## 11. Out of scope — flagged, not fixed

Carried forward from research §6, plus one added here.

1. **Reconciling the two deal systems.** `dealRules.ts` (60-day, ≤70% of median, 8 snapshots, hysteresis) vs `scoreDeal.ts` (90-day, percentile, 10 points). A product decision above this ticket. §6.4 only stops them from contradicting each other in copy.
2. **Flight Deal Score on the booking review.** Needs `dealScore` on `BookingFareContext` plus validation and URL round-trip mirroring `config.ts:577-601, 782, 936`. Exceeds the one-field budget. Recommend `DEV-BOOKING-FLIGHT-SCORE-CONTINUITY-01`.
3. **`scoreDeal.ts:113` fabricates `percentile = 50` on low confidence.** D1 removes the only surface that read it, but the fabricated value stays in the type where a future consumer can read it as real. Cleanest fix is `percentile?: number`, omitted on low confidence — a second type change, out of budget.
4. **`validateHotelDealScore` accepts `{verdict:'Great', confidence:'low'}`** (`config.ts:594-596`), which `scoreDeal` can never produce. §5.5 guards the one known consumer; the validator itself should reject the combination.
5. **`app/page.tsx:82`'s `54%`** is hero marketing copy. §6.2 corrects the statistic's *name*; whether the figure is substantiated is a marketing-claims question.
6. **Window stated twice in the scored panel** (§2.4) — `score.explanation` ends "over the last 90 days" and the `Based on` fact repeats "last 90 days". Fixing it means editing `scoreDeal`'s explanation strings, which D1–D5 do not authorise and which `scorePresentation.test.tsx:148, 197` assert against. Recommend folding it into whichever ticket takes item 1.

---

## 12. Handoff

Next: **`UI-DEAL-SCORE-CLARITY-01`** — implement §2 (panel states), §4 (delete card warnings), §5 (booking review + `bestDealCount`), §6 (copy repairs), §7 (aria labels), against the acceptance criteria in §10. §8's `sampleSize` field is small enough to land in the same UI pass; if it is split out, it goes to `DEV-DEAL-SCORE-SAMPLE-SIZE-01` **before** the UI ticket, since §2.3 and §2.4 both branch on it.

Read research §0 before starting. `MIN_SNAPSHOTS` is 8 and the FAQ is correct — the homepage is the string to fix.
