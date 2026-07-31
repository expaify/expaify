# UXR-HOTEL-RENOVATION-DISRUPTION-01: Renovation disruption visibility

**Ticket:** `UXR-HOTEL-RENOVATION-DISRUPTION-01` · **Stage:** UXR · **Priority:** P0  
**Date:** 2026-07-31 · **Upstream:** `docs/pipeline/hotel-renovation-disruption/01-discovery.md`

## Research decision

Adopt the discovery threshold with one tightening: a result-level notice requires a valid, explicitly attributed supplier/property statement plus at least one material impact class; date uncertainty can increase placement prominence but can never create materiality by itself.

Promote a notice on the result card when a supplier explicitly reports one or more of the following and the reported work overlaps, partially overlaps, or cannot be ruled out for the searched stay:

- noise or work hours that may affect guests;
- work in guest rooms, guest circulation, arrival/check-in, or another guest-used area;
- closure or material restriction of a named primary facility, including pool, restaurant, spa, lift/elevator, parking, beach access, fitness center, or the property's only advertised equivalent;
- an access or service limitation described concretely by the supplier.

Keep cosmetic/non-guest-area work and explicit non-overlap in detail at neutral prominence. Keep every option visible and actionable. Do not change Deal Score, rank, price treatment, or eligibility because of this evidence.

This is a desk-research recommendation, not a claim of behavioral validation. The fixture study below is the minimum formative validation required before populated notices ship.

## Current-code evidence

### There are two hotel journeys, and only one is mounted in the active deal flow

The production-facing deal journey is:

`/deals` → `DealCard` → `/deals/[dealId]` → `CompareRow` provider link.

- `app/deals/DealFeed.tsx:1892-1925` renders `DealCard` for unlocked results and links it to the saved-deal detail route.
- `app/components/ui/DealCard.tsx:17-34` accepts identity, price history, check-in window, links, and freshness only. Its visible hierarchy is hotel/date, price and discount, photo, then **View deal** (`:65-131`). It has no disruption state.
- `app/deals/[dealId]/page.tsx:347-425` renders property/stay, price and Deal Score, Hotel fit, then **Check rooms with provider**. Supporting evidence follows the outbound section at `:427-451`, so adding a notice only there would put it after the decision boundary.
- `app/components/ui/CompareRow.tsx:105-155` opens eligible, affiliate-attributed provider links directly. There is no intervening expaify review or disruption summary.

A second, richer path exists in source but is not imported or rendered by a production route:

- `app/components/HotelCard.tsx` provides collapsed/expanded evidence and creates a `/book` context.
- `app/book/BookingFlow.tsx` provides a separate Hotel fit and provider-handoff review.
- A production-source search found no non-test import or `<HotelCard>` render. `/api/search` can stream HotelLook offers (`app/api/search/route.ts:396-468`), but no current page consumes those hotel events.

The design handoff must therefore target the active `DealCard`/saved-detail/`CompareRow` journey. Treat `HotelCard`/`BookingFlow` continuity as a reusable contract requirement only if Product separately chooses to reconnect that path.

### Supplier and persistence paths cannot carry disruption evidence

- `HotelOffer` ends with document, amenity/access, funds, smoking, rate-eligibility, and admission fields; there is no disruption model (`lib/types.ts:556-579`). `HotelProvider` similarly has no detail/disruption method (`:616-625`).
- The HotelLook cache response shape includes identity, location, price, amenity, and smoking data only (`lib/providers/hotellook.ts:23-42`). Live and cached normalizers construct no renovation/closure evidence (`:337-411`, `:447-552`). The six-hour cache key includes location and stay dates, which is compatible with stay-scoped evaluation, but old cached objects cannot provide a notice.
- The active nightly pipeline is separate from `HotelProvider`. It calls RapidAPI endpoints directly and reduces responses to ID, name, class, price, and photo (`lib/pipeline/snapshot.ts:56-64`, `:70-175`). This violates the stated provider boundary but is not repairable in a UXR ticket.
- `price_snapshots` and `deals` have no disruption, source-statement, observed-at, or evidence-revision columns (`lib/db/schema.sql:104-147`). `DealRow` and `/api/deals` omit the same evidence (`lib/pipeline/dealDetection.ts:155-176`; `app/api/deals/route.ts:12-32`).
- `BookingHotelContext` carries no disruption evidence (`lib/booking/config.ts:60-89`), so the alternate `/book` path would also lose it.

Production coverage is therefore **0% surfaced and 0% attributable**. This does not mean 0% of properties have disruption; it means the system cannot distinguish explicit no-disruption, supplier silence, check failure, or a qualifying disclosure.

### Existing interaction and analytics capability

- Both active result cards and detail sections already reflow from one column and preserve 44px actions, so a wrapping text cue can fit the established responsive grammar. The cue must be included in loading skeleton height to prevent layout shift.
- The detail hierarchy has a suitable `Hotel fit` section before the provider section, but the current provider action is still a direct external link. A persistent summary must appear in the provider section itself, immediately before provider choices; an accordion in later Supporting evidence is insufficient.
- The analytics allow-list records result-card opens, detail-section reach, provider handoff, and generic handoff returns (`app/api/analytics/route.ts:12-50`). It cannot record disruption impression, detail comprehension, evidence revision, or a bounded mismatch reason. Generic abandonment/back behavior cannot establish notice-caused rejection.

## Reference-pattern guidance

These sources establish interaction and data-handling patterns; they do not prove that expaify receives equivalent fields from its current suppliers.

### Booking.com: structured dates and property-owned content

Booking.com's Property Settings API treats renovation as explicit property content with an enabled state plus required start and end dates when enabled. That supports preserving supplier dates rather than deriving them from price, reviews, or facility availability. Booking.com's facilities model separately scopes facilities at property or room level, reinforcing that a renovation date alone does not identify what is affected. See [Managing property settings](https://developers.booking.com/connectivity/docs/content-api-modules/property-details-api/implementing-property-api-settings) and [Managing Facilities API](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/introduction-to-facilities-api).

Applicable pattern: normalize provenance, dates, and affected scope independently; compute the searched-stay relationship in expaify; never turn an enabled renovation range into an inferred noise/severity claim.

### Expedia Rapid: repeat decision-critical property content before commitment

Expedia Rapid requires returned check-in, checkout, fees, and policy content to appear on availability and again before final booking so travelers see decision-critical instructions at the point of action. Its content API also separates property-level sections and recommends daily property-content refreshes. See [Lodging API launch requirements](https://developers.expediagroup.com/rapid/setup/launch-requirements/lodging-launch-reqs) and [Rapid Lodging API overview](https://developers.expediagroup.com/rapid/lodging).

Applicable pattern: do not rely on memory from a result cue or hide the complete statement after the provider action. Preserve the same normalized evidence across comparison, detail, and pre-handoff review, with freshness visible.

### Pattern delta

| Concern | Current expaify behavior | Reference guidance | Required delta |
|---|---|---|---|
| Evidence origin | No field or source chain | Property/supplier-authored structured content | Store explicit statement, source label, observed time, and evidence revision |
| Date relevance | Stay dates exist, but no disruption comparison | Renovation dates are distinct structured fields | Compute overlap without inventing missing endpoints |
| Affected scope | No facility/area disruption model | Facility and policy content remain separately scoped | Preserve named area/facility and concrete impact; do not infer severity |
| Placement | No result cue; provider action precedes supporting evidence | Critical content repeats near availability and booking | Cue on qualifying results, full detail before action, compact repeat inside handoff |
| Unknowns | Absence is structurally invisible | Optional/sectioned content requires explicit handling | Separate `not_returned`, `check_failed`, `timing_unknown`, and `impact_unknown` |

## Threshold pressure test

Use the stay interval as half-open `[checkIn, checkOut)`. Treat supplier calendar-date renovation ranges as inclusive because no end time is known: they overlap when `workStart < checkOut` and `workEnd >= checkIn`. This conservatively treats work reported to end on check-in day as potentially relevant. Do not parse relative prose such as “next month” without a supplier-normalized absolute date.

| Fixture | Evidence | Relation | Result treatment | Detail/handoff treatment |
|---|---|---|---|---|
| Stay-wide construction with reported daytime noise | Named source, guest-area work, hours, dates | Full overlap | Promote | Full statement; repeat noise/hours and overlap |
| Only pool closed | Named primary facility, dates, no noise claim | Full overlap | Promote | Say pool is closed; do not generalize to hotel-wide disruption |
| Lobby work for first night | Named guest area and dates | Partial overlap | Promote | State partial overlap and exact affected stay dates |
| Renovation, timing not specified | Explicit work and concrete guest impact; no dates | Unknown | Promote | “Timing not provided; could not rule out your stay” |
| Cosmetic back-office repainting, no guest impact | Explicit non-guest scope and no reported effect | Overlap | Do not promote | Neutral detail only |
| Guest-room renovation ends before check-in | Explicit dates and material work | No overlap | Do not promote | Neutral detail: reported work ends before this stay |
| “Renovation underway”; impact not specified | Explicit work, no area/impact | Overlap or unknown | Do not promote from timing alone | Detail with “Impact not provided”; escalate only if supplier also marks it traveler-facing/material |
| Two valid sources disagree | Different dates, area, or status | Conflicting | Promote if either valid statement could materially overlap | Show both attributed statements and “Sources do not agree”; never merge into false certainty |
| Old statement with no current refresh | Material statement, observed time beyond approved freshness window | Any | Promote as unresolved, not current fact | “We could not confirm whether this notice is still current”; preserve original dates/source |
| No supplier disclosure | No valid statement | Not computable | No cue | Calm unknown only where the surface explains supplier coverage |

The final minimum combination is therefore:

`explicit source + valid statement + material impact class + (overlap | partial overlap | timing unknown | valid conflict/staleness that cannot rule out overlap)`.

“Renovation” keyword plus uncertain dates is not enough. A named primary-facility closure is independently material even without a severity label. Supplier-provided “minor/major” may be quoted as supplier wording, but expaify must not calculate or display its own severity score.

## Testable design directives

### 1. Normalize one evidence object and fail closed to unknown

Create a single downstream contract with bounded `noticeType`, `affectedScopes`, `reportedImpacts`, source label, verbatim-safe supplier statement, reported start/end, observed-at, evidence revision, and evidence state. Required states are `reported`, `not_returned`, `check_failed`, `malformed`, `conflicting`, and `stale_unconfirmed`. Missing data must render “not provided,” never “none,” “open,” “quiet,” or “unaffected.” Malformed evidence must not remove the hotel, price, Deal Score, or provider action.

**Acceptance:** contract fixtures round-trip through provider normalization, cache/persistence, API, result, detail, and any booking context without wording/source/date drift; unknown and failure states remain distinct.

### 2. Use deterministic materiality and date-relation rules

Promote only the minimum combination above. Compute `overlap`, `partial_overlap`, `no_overlap`, or `timing_unknown` against the searched stay; do not infer missing dates, impact, facility importance beyond the bounded primary-facility list, or severity. Valid conflicts/stale material notices receive unresolved treatment when overlap cannot be excluded.

**Acceptance:** all ten pressure-test fixtures produce the specified relation and prominence; there are zero false card promotions for cosmetic/non-guest work, explicit non-overlap, or impact-unspecified renovation, and zero misses for reported noise, guest access constraints, or primary-facility closure that may affect the stay.

### 3. Put one concise qualifying cue on every affected result without suppressing inventory

On active `DealCard`, place a non-dismissible text cue after stay identity and before price/action. It must name the affected facility/impact and relation: for example, “Pool closed during your stay” or “Renovation timing not provided.” Use text plus icon if desired, never color alone. Do not add a cue for `no_overlap`, non-material, or no-disclosure states; do not reorder, hide, disable, or modify Deal Score.

**Acceptance:** at 375px and 1280px the cue wraps without truncating its date qualifier, overlapping price, or reducing **View deal** below 44px; loading and malformed evidence retain a usable card; all viable options remain in the result count and order.

### 4. Show the complete evidence in Hotel fit and repeat a compact summary immediately before provider links

In `/deals/[dealId]`, place the full attributed notice within `Hotel fit`: affected scope, concrete impact, exact supplier dates, searched-stay relationship, source, observed/checked date, every material unknown, and conflicts as separate source statements. Repeat the same decision-relevant summary inside **Check rooms with provider**, above `CompareRow`; include “Confirm current conditions with the provider.” The repeat is persistent, not dismissible, and does not require opening Supporting evidence. Keep provider actions enabled.

**Acceptance:** the affected scope, relation, and source match across result/detail/handoff for the same evidence revision; keyboard and screen-reader order reaches the notice before provider links; no `role="alert"` is used for a static, non-blocking notice.

### 5. Measure exposure and decisions without inventing causality

Add bounded events for qualifying result-notice impression, detail-notice reach, pre-handoff-notice reach, handoff after notice reach, and an explicit post-return reason `renovation_or_closure_details_mismatch`. Count an impression only after 50% visibility for one continuous second and deduplicate by session/search + offer/deal + surface + evidence revision. Do not log raw supplier prose, hotel name/ID, dates, URLs, free text, inferred traveler needs, or “rejection due to disruption” from back/abandonment.

**Acceptance:** server allow-lists accept only bounded notice type, relation, material-impact class, evidence state, surface, viewport band, and revision bucket; generic back/close behavior never emits a disruption-causality event.

## Formative validation and measures

Run a moderated, counterbalanced comparison study with **10–12 first-time hotel travelers**, split across 375px and 1280px. Each participant sees six options containing the ten fixtures across two tasks; reverse order and vary which hotel is cheapest. Ask for a hotel choice, confidence, and a teach-back of what is affected, who reported it, stay-date relation, and unknown facts. Do not prime with the word “renovation.”

Release the populated pattern only if all gates pass:

| Measure | Method | Gate |
|---|---|---|
| Result detection | Unprompted mention before opening detail | ≥90% of qualifying fixture exposures; no material fixture missed by more than one participant |
| Pre-handoff detection | Notice noticed/accurately referenced before provider activation | 100% of qualifying handoff attempts |
| Correct avoidance | Reject clearly unsuitable stay-wide noise/needed-facility closure fixtures | ≥90% |
| Viable-option retention | Keep/select explicit non-overlap or cosmetic/non-guest fixture when otherwise best | ≥85%; no more than one participant treats all renovation mentions as automatic rejection |
| Comprehension | Correctly identify affected scope, source, relation, and unknowns | ≥85% per dimension; 0 participants interpret `not_returned` as “no work” after teach-back |
| Warning fatigue | False promotion noticed as warning or reports that all cards feel warned | 0 false promotions in fixture scoring; ≤20% report warnings are repetitive/indiscriminate |
| Continuity | Result, detail, and handoff answers match | 100% across tested revisions |

Instrumented production measures may monitor notice reach and qualified handoff after launch, but they do not replace task accuracy. A lower handoff rate for unsuitable stays is not a failure; blanket avoidance and loss of viable-option visibility are failures.

## Downstream scope and risks

- UXDES should specify the active `DealCard` → saved-detail → `CompareRow` journey first. It should cover default, loading, empty/no disclosure, error, malformed, stale, conflict, mobile, desktop, focus, and provider-return states.
- A later DEV ticket is required for provider normalization, persistence/cache, API serialization, date-relation logic, booking-context continuity, and analytics validation. UI-only work cannot create trustworthy populated evidence.
- The current active snapshot pipeline calls external vendors outside `lib/providers`, uses `RAPIDAPI_KEY` outside the approved secret list, and stores no provenance. This pre-existing contract conflict blocks trustworthy supplier-disclosure delivery until a separately authorized repair resolves it.
- `lib/db/schema.sql` contains unresolved merge-conflict markers around the analytics schema. This is outside UXR scope but may block downstream verification/migrations.
- No current supplier contract in this repo demonstrates that renovation/closure content is actually returned. Design may ship honest unknown/check-failed states, but must not fabricate populated notices or claim that supplier silence means no disruption.

## UXDES handoff

Create `UXDES-HOTEL-RENOVATION-DISRUPTION-01` to specify the result cue, complete Hotel fit evidence, pre-provider repeat, every evidence/date/conflict state, responsive/accessibility behavior, fixture copy, and analytics contract defined above. The design must preserve active inventory, Deal Score, affiliate links, and explicit supplier uncertainty.
