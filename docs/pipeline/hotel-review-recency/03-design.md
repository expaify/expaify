# UXDES-HOTEL-REVIEW-RECENCY-01: Hotel review recency and relevance

Date: 2026-07-31  
Stage: UX Design (UXDES)  
Priority: P2  
Upstream: `docs/pipeline/hotel-review-recency/02-research.md`

## 1. Design decision and release boundary

The production repair is an evidence-continuity and labeling change, not a new
review feature. The current Hotellook cache-price endpoint supplies no guest
score, review count, aggregate review coverage, returned review dates, or
licensed traveler/topic context. The honest current-provider experience is
therefore:

- no guest-review line on `DealCard`;
- one compact **Guest review evidence** region on saved detail and hotel review;
- the lead statement **Guest score not provided by this provider.**; and
- an unaffected provider handoff.

Positive score, recency, volume, and context states in this document are
provider-contingent specifications and test fixtures. They must not be wired to
Hotellook, cached legacy `rating`, hotel stars, price timestamps, or inferred
copy. Shipping those states requires a separately approved provider contract,
display rights, cache policy, property-ID continuity, and representative sample
payloads. This ticket does not select a vendor.

The first safe UI release may implement the normalized presentation component,
the current unavailable state, and context continuity. It must not imply that
review evidence exists today.

### Prohibited claims and substitutions

Do not show **Recent reviews**, **Current reviews**, **Fresh rating**, **Updated
rating**, **Popular**, **Recommended**, or an age-based green/amber/red verdict.
Do not use hotel class stars, Deal Score, price-check count, `updatedAt`,
`priceCheckedAt`, or `fetchedAt` as guest-review evidence. Do not treat the
newest returned review as the aggregate score's end date. Do not display raw
review text, reviewer identity, generated sentiment, or an unlicensed context
cue. Review evidence never changes ranking, filtering, Deal Score, or the
provider action.

## 2. Actual flow and information architecture

```text
/deals
  DealCard (compact comparison)
    View deal
      → /deals/[dealId] (saved-detail decision page)
        Property and stay
        Price and Deal Score
        Hotel fit
          Hotel class
          Guest review evidence
        Check rooms with provider
          → approved affiliate provider in a new tab

HotelOffer / richer HotelCard (separate mounted flow when used)
  Review hotel
    → BookingHotelContext
      → /book HotelHandoffReview
        Property and stay
        Price and Deal Score
        Hotel fit
          Hotel class
          Guest review evidence
        Check rooms with provider
          → approved affiliate provider in a new tab
```

The same normalized evidence snapshot must drive every surface for a given
provider property. Saved detail is the canonical evidence placement immediately
before the production provider handoff. `BookingHotelContext` is the continuity
boundary for the richer review flow; `BookingFlow` must render it rather than
hard-code an unavailable rating.

### Surface hierarchy

**Results / `DealCard`**

1. Primary: hotel identity, observed nightly price, Deal Score/discount, and
   **View deal**.
2. Secondary: hotel class/location/stay window and, only when verified, one
   guest-score scan line.
3. Tertiary: price observation and price-snapshot disclosure.

No review date, source, context cue, warning, or missing-evidence message belongs
on the collapsed card. Current Hotellook cards remain unchanged.

**Saved detail and hotel review**

1. Primary page content: property/stay, price and Deal Score, and provider
   continuation.
2. Secondary: **Hotel fit**, with hotel class and **Guest review evidence** as
   distinct siblings.
3. Primary within review evidence: verified guest score or the single honest
   unavailability statement.
4. Secondary within review evidence: overall volume and one date statement.
5. Tertiary: source, metadata observation, optional bounded context cue and its
   limitations.

The evidence region remains before **Check rooms with provider**. It is not a
modal, gate, accordion, or second conversion action.

## 3. Normalized evidence snapshot

UI components consume one provider- and property-bound object. Provider
adapters and server/data boundaries own normalization; components render only
validated fields. Every external call remains in `lib/providers` and returns
`Result<T>`.

```ts
type HotelReviewLoadState =
  | 'loading'
  | 'ready'
  | 'not_provided'
  | 'error'
  | 'invalid'
  | 'stale'

type HotelReviewProvenance =
  | 'verified_guest'
  | 'provider_only'
  | 'inferred'
  | 'unavailable'

type ReviewMonth = `${number}-${number}` // validated YYYY-MM, rendered Month YYYY

type HotelReviewCoverage =
  | {
      kind: 'provider_declared_aggregate'
      startMonth?: ReviewMonth
      endMonth: ReviewMonth
    }
  | {
      kind: 'returned_sample'
      latestStayMonth?: ReviewMonth
      latestSubmittedAt?: string
      sampleSize?: number
    }
  | { kind: 'none' }
  | { kind: 'invalid' }

type HotelReviewContextCue = {
  licensedForDisplay: true
  travelerSegment?: 'family' | 'business' | 'solo' | 'couple' | 'friends'
  topic: string                 // provider-controlled, normalized allowlist
  pattern: string               // neutral provider-authored display phrase
  sourceLabel: string
  scope: 'property' | 'returned_sample'
  windowStartMonth?: ReviewMonth
  windowEndMonth?: ReviewMonth
  supportingReviewCount?: number
}

type HotelReviewEvidence = {
  schemaVersion: 1
  state: HotelReviewLoadState
  providerPropertyId: string
  providerId: string
  provenance: HotelReviewProvenance
  score?: { value: number; scaleMax: number }
  sourceLabel?: string
  overallReviewCount?: number
  coverage: HotelReviewCoverage
  contextCue?: HotelReviewContextCue
  ratingObservedAt?: string
  invalidReason?:
    | 'malformed_score'
    | 'malformed_date'
    | 'malformed_count'
    | 'unsupported_scope'
    | 'property_mismatch'
    | 'provider_mismatch'
    | 'stale_cache'
}
```

Add `reviewEvidence?: HotelReviewEvidence` to the normalized hotel/deal record
and to `BookingHotelContext`. The existing `hotelClass` remains separate. During
migration, `guestRating` may be retained for compatibility, but it must be
mapped into `reviewEvidence` only after validation; ambiguous legacy `rating` or
`fetchedAt` must not be promoted.

### Contract invariants

- A visible guest score requires `provenance === 'verified_guest'`, finite
  `value > 0`, finite `scaleMax > 0`, `value <= scaleMax`, and a non-empty source.
- `provider_only` may render a labeled provider rating only in detail; it never
  becomes a guest score or appears on `DealCard`.
- `inferred`, unknown kinds, or an ambiguous legacy number render no numeric
  rating. They resolve to the invalid/unavailable presentation.
- `overallReviewCount` is an integer greater than zero. Zero, negative,
  fractional, non-finite, or string values are invalid and suppressed.
- Aggregate coverage may be claimed only when the provider declares the score's
  coverage. Its end month cannot be in the future; if a start is supplied, start
  must not follow end.
- Returned sample dates describe only records returned by that call. Prefer
  `latestStayMonth`; otherwise derive a month from a valid `latestSubmittedAt`.
  They never populate aggregate coverage.
- `ratingObservedAt` is when the rating metadata was observed. It may appear
  only as **Rating data checked {date}.** and never as a review date.
- Overall count and cue-support count are distinct fields and never substitute
  for one another.
- A context cue renders only when `licensedForDisplay === true`, source, allowed
  topic, allowed scope, and traceable window/count (when supplied) all validate.
- `providerPropertyId` and `providerId` must match the selected deal/offer at
  every boundary. A mismatch invalidates the entire snapshot; do not mix fields.
- A provider response/cache failure changes only this evidence state. It never
  blocks result navigation, back navigation, Deal Score, or a valid affiliate
  handoff.
- If a cached snapshot is beyond a provider-approved review-data TTL, render the
  stale state. The six-hour price cache TTL is not automatically the review TTL.
- All strings are display-safe normalized values; never serialize raw provider
  payloads or review content through `BookingHotelContext`.

## 4. Component anatomy

```text
GuestReviewEvidence
└── section[aria-labelledby]
    ├── h3 “Guest review evidence”
    ├── ReviewStateMessage (loading/error/invalid/stale/unavailable, conditional)
    ├── dl (ready positive states)
    │   ├── dt “Guest score” + dd score/source
    │   ├── dt “Overall review count” + dd count/missing copy
    │   └── dt “Review dates” + dd aggregate/sample/missing copy
    ├── ReviewContextCue (optional, separate bordered inset)
    │   ├── h4 “Traveler feedback”
    │   ├── p cue
    │   ├── p support/source
    │   └── p non-guarantee
    └── p metadata observation (conditional tertiary copy)
```

Use one shared renderer on saved detail and `HotelHandoffReview`. Use a `<dl>`
for the three core facts. Do not place `<p>` directly inside `<dl>` without a
wrapping `<div>`. The heading level is `h3` when nested in **Hotel fit**. If UI
chooses a standalone section later, promote it to `h2` without changing copy.

On `DealCard`, the optional scan line is ordinary text, not a badge:

`{value}/{scaleMax} guest score · {formatted overallReviewCount} reviews`

When count is missing, use `{value}/{scaleMax} guest score`. The line is absent
for every non-verified provenance and every invalid/loading/error state. Its
accessible name must include **Guest score**; the star row's accessible name
must include **hotel class**. Never rely on slash, star shape, or color alone.

## 5. Exact copy and state matrix

Dates use English month plus four-digit year (`March 2026`) for review coverage
and returned samples. Observation time uses `Month D, YYYY` (`July 31, 2026`).
Numbers use locale grouping (`1,248`). Do not use relative review-age copy.

### Core states

| State / valid input | DealCard | Guest score | Overall review count | Review dates | Additional copy |
|---|---|---|---|---|---|
| Current Hotellook / `not_provided` | No review line | **Guest score not provided by this provider.** | Do not render a separate row | Do not render a separate row | **Review count and review dates are not available.** |
| Complete: verified score + count + provider-declared aggregate end | `{v}/{s} guest score · {n} reviews` | **{v}/{s} guest score from {source}.** | **{n} reviews** | **Guest score includes reviews through {month year}.** | Observation line if valid; optional cue if independently valid |
| Verified score + count; dates missing | Same complete scan line | **{v}/{s} guest score from {source}.** | **{n} reviews** | **Review dates not provided.** | Observation line if valid |
| Verified score + aggregate coverage; count missing | `{v}/{s} guest score` | **{v}/{s} guest score from {source}.** | **Review count not provided.** | **Guest score includes reviews through {month year}.** | Observation line if valid |
| Verified score + returned sample only | Score scan line; count fragment only if overall count exists | **{v}/{s} guest score from {source}.** | Overall count or **Review count not provided.** | **Most recent review returned: {month year}.** | **This date describes the returned review sample, not the full guest score.** |
| Verified score only | `{v}/{s} guest score` | **{v}/{s} guest score from {source}.** | **Review count not provided.** | **Review dates not provided.** | Observation line only if valid |
| `provider_only` valid number | No review line | **Provider rating: {v}/{s} from {source}.** | Overall count only if provider defines it; otherwise missing | Valid coverage-kind copy or missing | **The provider does not identify this as a verified guest score.** |
| `inferred` or ambiguous legacy value | No review line | **Guest score not provided by this provider.** | No separate row | No separate row | **We did not use an inferred or unverified rating.** |
| Valid rating observation | No effect | No effect | No effect | No effect | **Rating data checked {Month D, YYYY}.** |
| Observation missing/invalid | No effect | No effect | No effect | No effect | Omit the observation line; do not add another warning |

The current unavailable state deliberately collapses missing score, count, and
dates into one primary statement plus one subordinate sentence. It must not
render three equal warnings.

### Context cue states

For an eligible licensed cue, use this grammar:

- With traveler segment: **Guests traveling with {segment} mention {pattern}.**
- Without segment: **Guests mention {pattern}.**
- With count and window: **Based on {n} reviews from {start month year}–{end
  month year}, provided by {source}.**
- With count only: **Based on {n} reviews, provided by {source}.**
- With window only: **Feedback from {start month year}–{end month year}, provided
  by {source}.**
- Required final boundary: **This feedback does not predict a specific room or stay.**

The normalized `pattern` must be a neutral, grammatical provider-authored phrase
such as **quiet rooms** or **mixed feedback about street noise**. Do not prepend
positive/negative icons or convert it into expaify sentiment.

| Cue input | Presentation |
|---|---|
| Valid and licensed | Render the separate **Traveler feedback** inset after core facts |
| Absent | Render nothing; core evidence remains complete on its own |
| `licensedForDisplay !== true` | Suppress cue; no user-facing licensing warning |
| Malformed topic/pattern, future/inverted window, invalid count, unknown scope | Suppress cue and classify `context_state=invalid` for later analytics |
| Cue conflicts with aggregate dates | Suppress cue; do not choose a date source |
| Cue available while aggregate coverage missing | Render it with its own sample scope; keep **Review dates not provided.** for the aggregate |
| Cue count differs from overall count | Show each only in its named region; never combine them |
| Cue fetch loading/error | Do not replace valid core score; use no spinner/error unless cue is the only requested evidence |

### Loading, error, invalid, stale, and empty behavior

| State | Exact visible copy | Behavior |
|---|---|---|
| `loading` on detail/review | Heading **Guest review evidence**; status **Checking guest review evidence…** | Use a three-row skeleton beneath the status, `aria-busy=true`; keep every navigation/handoff action enabled |
| `error` | **Guest review evidence could not be checked.** / **You can still check rooms and current terms with the provider.** | `role=status`, not assertive alert; no retry in this ticket because no review-only fetch contract exists |
| `invalid` | **Guest review evidence is unavailable.** / **The returned rating details could not be verified, so we did not display them.** | Suppress all numeric/date/context claims; handoff unchanged |
| `stale` | **Guest review evidence is unavailable.** / **The saved rating details are too old to verify, so we did not display them.** | Suppress all stale claims; do not label them “older reviews” |
| Property/provider mismatch | Same as `invalid` | Invalidate the complete snapshot; never retain only favorable fields |
| Empty object / field absent | Treat as `not_provided` | This is the current production fallback, not a blank section |
| Component/render failure | Page-level error boundary may handle the page; normalized malformed data must not throw | A review-only problem never disables the affiliate action |

If loading completes while the region is visible, replace skeletons in place and
announce one atomic result: **Guest review evidence loaded.** or **Guest review
evidence is not available.** Do not move keyboard focus.

## 6. Interaction rules

### Result to saved detail

- Clicking or pressing Enter on the linked `DealCard` opens the existing saved
  detail route. Do not add a nested review control.
- `View deal` remains the CTA in all evidence states.
- While the result feed refreshes, existing inert/skeleton behavior applies to
  the card. There is no separate rating fetch spinner on a collapsed card.
- If the result snapshot is verified, saved detail must render the same value,
  scale, source, overall count, coverage kind, dates, cue, and observation time.
  It may not silently refetch a different snapshot during navigation.

### Saved detail and booking review

- The evidence region is always expanded; there is no disclosure control for
  three core facts.
- A context cue is also visible inline when eligible. Do not hide its source or
  limitation behind a tooltip.
- The existing back link remains first in tab order. Evidence text adds no tab
  stop. Provider links remain reachable after it.
- **Check rooms with provider** retains its current external-link behavior,
  affiliate markers, `rel="noopener noreferrer sponsored"` where applicable,
  and provider-specific accessible name.
- Loading, unavailable, invalid, stale, and error states do not hide, disable,
  or relabel **View deal**, **Check rooms with provider**, **Search current
  deals**, or back navigation.
- Provider-link absence and search-context mismatch keep their existing handoff
  errors. Review evidence must not mask or replace those messages.
- Analytics failure is silent to the traveler and never prevents navigation.

### Continuity failure

If `BookingHotelContext.reviewEvidence` is missing after a verified result/detail
snapshot, do not reconstruct it from `guestRating`. Render the `not_provided`
state and record a bounded validation failure when analytics is repaired. This
is a continuity defect, not evidence that the provider has no reviews.

## 7. Responsive layout and Tailwind patterns

Use only existing tokens in `app/globals.css`; add no color, radius, shadow, or
font-size token.

### Shared evidence region

```tsx
<section className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4">
  <h3 className="text-body font-display font-bold leading-snug text-[color:var(--text-1)]">
  <dl className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
  <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">
  <dd className="mt-1 break-words text-small font-medium leading-5 text-[color:var(--text-1)]">
  <p className="mt-1 break-words text-caption leading-5 text-[color:var(--text-2)]">
</section>
```

At 375px, the core facts are one column and the provider action remains full
width. At `sm` and above, the three facts may form equal columns. At 1280px, keep
the parent detail width and existing `max-w-[1140px]`; do not stretch a fact row
beyond its parent. Apply `min-w-0`, `break-words`, and tabular numerals to prevent
source labels, counts, and translated copy from overflowing.

### Context inset

```tsx
<div className="mt-3 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3">
  <h4 className="text-small font-medium text-[color:var(--text-1)]">
  <p className="mt-1 break-words text-small leading-5 text-[color:var(--text-2)]">
  <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">
</div>
```

### State treatments

- Loading: `.skeleton h-4 rounded-[var(--radius-pill)]`; exactly three lines,
  with `motion-reduce:animate-none`.
- Error/invalid/stale: no red or amber status color. Use the standard border and
  text hierarchy because review absence is not a blocking transaction error.
- Verified score: `text-body font-medium tabular-nums text-[color:var(--text-1)]`.
- Observation/limitations: `text-caption leading-5 text-[color:var(--text-3)]`.
- No badge, progress meter, colored dot, checkmark, or icon is required.

At 200% zoom and 320px minimum viewport, content must reflow without horizontal
scroll. At 375px and 1280px, headings, score, count, source, and provider action
must remain visible without overlap or ellipsis. Long source labels wrap; they
are never truncated because provenance is material.

## 8. Accessibility specification

- Semantic reading order is heading → state or score → count → dates → context
  → observation → provider handoff.
- Use a real heading and `<dl>`; do not encode labels only with visual position.
- The result star row exposes **{n}-star hotel class**. The review line exposes
  **{v} out of {s} guest score, based on {n} reviews** when count exists.
- `loading` uses `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, and
  `aria-busy="true"` on the evidence section. Error/unavailable copy is ordinary
  readable content or polite status, never an assertive alert.
- Skeletons and decorative separators are `aria-hidden="true"`.
- Evidence content has no mouse-only tooltip. Exact dates and source are visible
  text.
- Existing global `:focus-visible` styling supplies the 3px brand outline and
  focus ring. Do not remove it or place focus on the region after async updates.
- Enter activates the linked `DealCard` and provider anchor; Space follows native
  behavior for any future button. Escape has no behavior because no overlay is
  introduced.
- Color is never the only distinction among verified, missing, invalid, or stale
  states. State names and limitations are explicit in text.
- With reduced motion, skeleton animation is disabled and card/evidence changes
  use no added motion. Existing card hover motion must not be required to reveal
  content.

## 9. Boundary-by-boundary continuity requirements

| Boundary | Required behavior | Failure behavior |
|---|---|---|
| Provider adapter → normalized offer | Attach a validated snapshot to the exact provider property ID | Return unavailable/invalid `Result` data; never throw or use legacy fallback |
| Cache → provider adapter | Preserve schema version, provider/property IDs, all evidence scopes and dates | Reject stale, unknown-version, malformed, or mismatched snapshots atomically |
| Deal detection/API → `DealCard` | Carry the same snapshot without flattening `coverage` or cue support | Omit card review line and retain explicit missing state for detail |
| `DealCard` → saved detail | Key navigation to the same deal/property snapshot | Detail renders unavailable; never reconstruct from stars/price data |
| `HotelOffer` → `BookingHotelContext` | Preserve `reviewEvidence` alongside `hotelClass`; validate during POST/reference and query fallback | Invalid review evidence degrades locally and does not invalidate an otherwise safe booking context |
| `BookingHotelContext` → `BookingFlow` | Render the identical normalized fields and state | Render missing state; provider URL stays usable |
| Review → provider handoff | Analytics receives the same bounded evidence classification | Event failure is swallowed; affiliate navigation continues |

Inline query serialization must honor the existing 4,096-character ceiling. If
the validated context exceeds it, use the existing server-side reference path;
do not drop review fields selectively. Provider URLs remain validated affiliate
URLs and never contain the review snapshot.

## 10. Analytics specification and release gate

Do not add or claim a review-evidence baseline in the UI ticket. Instrumentation
is gated on a separate DEV repair that:

1. resolves conflict markers and selects/migrates one analytics table in
   `lib/db/schema.sql`;
2. aligns producer and route enums (`entry_source`, `viewport_group`,
   `score_state`, `price_freshness_state`);
3. adds property identity to `hotel_result_card_opened` and evidence fields to
   the applicable view/handoff events; and
4. proves a real POST returns 202 and persists exactly one row.

After that gate, use these events:

- `hotel_review_evidence_exposed`: once per property and surface when at least
  50% visible for at least one second;
- `hotel_review_evidence_opened`: only if a future intentional disclosure is
  introduced; the always-expanded design does not emit it; and
- attach the same snapshot classifications to `hotel_detail_viewed` and
  `hotel_room_handoff_started`.

Allowed non-content properties:

| Property | Allowed values |
|---|---|
| `surface` | `results`, `detail`, `handoff` |
| `provenance_state` | `verified_guest`, `provider_only`, `inferred`, `unavailable` |
| `coverage_kind` | `provider_declared_aggregate`, `returned_sample`, `none`, `invalid` |
| `aggregate_age_band`, `sample_age_band` | `0_30_days`, `31_90_days`, `91_180_days`, `181_365_days`, `366_plus_days`, `missing`, `invalid` |
| `overall_volume_bucket`, `cue_support_bucket` | `missing`, `1_9`, `10_49`, `50_199`, `200_plus`, `invalid` |
| `context_state` | `available`, `not_provided`, `invalid` |
| `evidence_state` | `complete_core`, `dates_missing`, `volume_missing`, `score_only`, `unavailable`, `invalid` |
| `viewport_group` | `mobile_375`, `desktop_1280`, `other` |

Never emit property names, raw/exact review dates, raw review text, traveler
concerns, reviewer identity, source prose, or rating values. Aggregate and
sample age bands are computed separately; metadata observation never populates
either. Back-to-results is neutral, not a failure. Analytics remains non-blocking.

## 11. Acceptance fixtures and test matrix

UI and DEV tests must use the same frozen date and named fixtures:

1. `hotellook_unavailable` — no score/count/dates/cue; current production copy.
2. `complete_aggregate` — verified 8.7/10, 1,248 overall reviews, aggregate
   through March 2026, checked July 31, 2026, valid licensed cue.
3. `score_count_dates_missing`.
4. `score_aggregate_count_missing`.
5. `returned_sample_only` — asserts sample label and never aggregate language.
6. `score_only`.
7. `provider_only`.
8. `inferred_legacy` — no numeric guest-score claim.
9. `context_without_aggregate` — cue keeps its own scope while core dates remain
   not provided.
10. `context_unlicensed`, `context_malformed`, and `context_conflicting` — cue
    suppressed.
11. `loading`, `error`, `invalid`, and `stale`.
12. `future_aggregate_end`, `inverted_aggregate_window`, `future_sample_date`.
13. `zero_count`, `negative_count`, `fractional_count`.
14. `provider_mismatch`, `property_mismatch`, and `unknown_schema_version`.

For each fixture, assert:

- `DealCard`, saved detail, and `BookingFlow` use the state matrix exactly;
- complete/partial valid evidence round-trips without changing score, scale,
  source, count denominator, coverage kind, date meaning, cue scope, or observed
  timestamp;
- invalid snapshots are rejected atomically and never partially salvaged;
- the current Hotellook fixture renders no result-card review line;
- stars are announced as hotel class and never guest score;
- **View deal**, back, and every valid provider link work during loading/error;
- external links preserve affiliate markers and sponsored/new-tab semantics;
- 375px, 1280px, 200% zoom, keyboard-only, screen-reader order, no-color, and
  reduced-motion checks pass;
- no text overlaps, no horizontal page scroll appears, and long source labels
  wrap;
- review evidence does not alter price, Deal Score, ordering, filters, or CTA
  labels; and
- analytics tests remain deferred until the collector gate is fixed.

## 12. Implementation scope by stage

### UI stage authorized now

- Build one shared `GuestReviewEvidence` presentation component.
- Replace the hard-coded guest-rating blocks on saved detail and
  `HotelHandoffReview` with it.
- Render the honest Hotellook unavailable state.
- Add the optional verified scan-line presentation to `DealCard`, guarded by the
  normalized verified state; it remains absent with current data.
- Update `HotelCard` terminology from **Updated** to **Rating data checked** if
  that legacy component is touched, without making it a production source.
- Add component/state/accessibility fixtures. No provider, API, schema, scoring,
  sorting, or analytics changes.

### DEV dependency before positive production states

- Define and validate the additive normalized evidence snapshot.
- Preserve it through deal storage/API and `BookingHotelContext`, including the
  server reference path and safe query parsing.
- Implement provider/cache validation only after an approved provider contract.
- Repair analytics in its own ticket before adding review events.

### Out of scope

New vendor selection, provider negotiation, live review ingestion, raw review
display, AI summaries, first-party reviews, review filters/sort/ranking, Deal
Score changes, affiliate model changes, a universal “recent” threshold, and the
analytics/schema repair itself.

## 13. Blockers and handoff decision

- **Provider blocker:** Hotellook's implemented cache endpoint cannot populate
  the positive review model. Current release is limited to honest unavailable
  presentation and continuity scaffolding.
- **Analytics blocker:** `lib/db/schema.sql` contains conflict markers, the
  producer/collector enums disagree, and result/handoff events cannot join one
  property snapshot. No baseline or review experiment may be claimed.
- **Data integration blocker:** production deal records/API/`DealCard` do not
  carry review evidence, while `BookingFlow` ignores its existing optional
  rating context. Positive states need a DEV-stage normalized contract.
- **Commercial blocker:** display rights, cache rules, property matching, and
  sample payloads are unapproved. This spec deliberately selects no vendor.

These blockers do not prevent the UI stage from implementing the shared region,
the current honest unavailable state, guarded fixtures, and accessible layout.
They do prevent positive recency or relevance claims from shipping against the
current provider.
