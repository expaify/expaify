# UXR-HOTEL-POOL-OPERATING-STATUS-01: Hotel Pool Operating-Status Confidence Research

Date: 2026-08-03

Stage: UX Research (UXR)

Priority: P2
Decision: **NARROW — proceed to a capability-gated design and fixture-based comprehension test; do not ship provider-positive pool operating claims yet.**

## Research Question And Method

Can expaify help a pool-intent leisure traveler distinguish a merely listed pool from provider-disclosed conditions that fit the selected stay, without implying live operation?

This brief combines:

- a static audit of the reachable `/deals` card → `/deals/[dealId]` detail → provider-handoff path;
- an audit of the orphaned richer `HotelCard`, shared hotel types, provider normalization and caching, saved-deal persistence, and analytics validation;
- a review of the provider fields actually consumed by this repository and plausible structured fields in official Booking.com and Hotelbeds documentation; and
- an interaction-pattern comparison using current Expedia property content and Booking.com’s official multi-instance facility model.

No production pool-intent analytics, entitled provider payload sample, or traveler interviews were available. Accordingly, this report validates the structural gap and the feasibility of the evidence model, but it does not claim measured traveler demand, comprehension lift, or provider-field coverage. Those remain explicit gates.

## Current-Code Evidence

### Reachable card-to-detail flow

| Surface | What the current code does | Pool-operating gap |
|---|---|---|
| Results card | `app/deals/DealFeed.tsx` maps saved-deal fields into `app/components/ui/DealCard.tsx`. The card prioritizes hotel identity, class, city, check-in window, disruption/quiet-stay cues, nightly price, discount, photo, and “View deal.” | The mapped deal shape has no amenity or pool field. The card cannot distinguish a disclosed pool, a seasonal pool, a stay mismatch, or missing evidence. |
| Saved-deal detail | `app/deals/[dealId]/page.tsx` reconstructs stay dates, price freshness, Deal Score, hotel class, disruption evidence, and quiet-stay evidence. “Hotel fit” contains no amenity evidence. | Opening detail cannot resolve pool existence, pool type, season coverage, heated status, or provenance. |
| Provider handoff | `HotelDealCriteriaHandoff` says the provider confirms room details and live availability, then renders eligible affiliate links. It can solicit a post-return mismatch reason for disruption evidence. | No pool evidence is carried into the handoff and no pool-specific confirmation boundary or return reason exists. A generic outbound click cannot establish pool confidence. |
| Back navigation | `HotelDecisionAnalytics` records `hotel_detail_back_to_results` with hotel and entry source. | The event has no pool exposure state, pool intent, or reason, so it cannot identify a pool-related detail exit. |

The reachable card is a single link containing all card content. Any future expandable evidence on this card must either stay non-interactive or change the interaction contract; nesting a disclosure control inside the link would be invalid and unreliable for keyboard users.

### Orphaned richer hotel card

`app/components/HotelCard.tsx` is not mounted by a live app route; repository references outside tests do not import it. It nevertheless establishes useful internal patterns:

- a compact scan layer followed by an explicit `Details` disclosure;
- provider source and missing-evidence copy;
- distinct loading, ready, error, unavailable, and malformed-like presentations for adjacent evidence;
- property-versus-room scope and fetched-at fields in the shared evidence contract; and
- 44px controls and responsive fallbacks for narrow cards.

It cannot be reused as pool evidence without a new contract. Its generic `HotelAmenityEvidence` shape has no per-pool identity, facility type, operating season, date overlap, live-status boundary, or field-level conflict state. Its amenity normalizer is intentionally access-specific.

### Data contract and normalization

`lib/types.ts` allows `HotelOffer.amenityEvidence`, but each item can express only an id, label, status, scope, source, fee, freshness, confidence, and certainty. `lib/providers/hotelAmenityEvidence.ts` accepts exactly seven access/parking/request ids. Unknown ids are discarded, including any plausible pool id. Missing provider input becomes seven `not_returned` access facts; it does not preserve a generic provider amenity payload.

The pool delta therefore is not “add a chip.” A lossless contract needs a property-level pool collection with stable per-pool identity and independent dimensions for:

- facility presence: `present | absent | not_returned | unknown | conflicting`;
- pool type: `indoor | outdoor | indoor_and_outdoor | not_provided | conflicting`;
- schedule kind: `year_round | seasonal | not_provided | conflicting`;
- disclosed seasonal intervals, including hemisphere/year rollover and whether the interval recurs annually;
- selected-stay relation: `full_overlap | partial_overlap | no_overlap | indeterminate` derived only when both selected dates and usable disclosed intervals exist;
- heated status: `heated | not_heated | not_provided | conflicting`;
- source label, source record id, fetched-at timestamp, and evidence scope; and
- reported temporary-closure intervals, if an approved provider supplies them, kept separate from the ordinary operating season.

A single boolean such as `hasPool`, `seasonal`, or `heated` cannot represent the required unknown and conflict states and cannot preserve multiple pools.

### Provider and cache path

| Provider path | Fields consumed now | Pool evidence currently retained | Capability finding |
|---|---|---:|---|
| `bookingComHotelsRapidApi.ts` | Search result id, name, coordinates, review score/count, class, photos, gross price/currency | None; access evidence is synthesized as `not_returned` | The current RapidAPI search response interface has no facilities field and no detail/facility request. Official Booking.com supply documentation proves a richer model exists, but not that this endpoint, account, or commercial agreement exposes it. |
| `hotelbeds.ts` | Availability result identity, class, location, rooms/rates; content request asks only for images | None; access evidence is synthesized as `not_returned` | Hotelbeds Content API documents coded facility metadata and presence/fee flags, but the current adapter does not request hotel facilities and no repository fixture proves season dates, per-pool identity, or heated status. |
| `hotellook.ts` | Accepts an `amenityEvidence` field from cached entries | Zero pool ids survive normalization | Even a raw pool-shaped entry is dropped by the current access-only allowlist. This dead/legacy source is not a sufficient basis for production claims. |
| Saved-deal pipeline | Persists identity, price, stay, score inputs, OTA links, freshness, and general description | None | Result-time pool evidence cannot survive into the reachable saved-deal detail. |

All three search adapters use six-hour caches. That timestamp can truthfully describe when expaify fetched a provider disclosure; it cannot be relabeled as when the property verified live pool operation.

### Persistence and continuity

The `deals` table in `lib/db/schema.sql` has no amenity or evidence JSON column and `DealRow`/feed mapping has no pool field. The API-to-card and database-to-detail flows are different representations, so adding pool evidence only to `HotelOffer` would create a trust-breaking continuity defect: a card could make a dated claim that its detail cannot reproduce.

The required end-to-end delta is:

`provider detail/facility response → provider-specific Result<T> adapter → canonical per-pool evidence → six-hour cache with fetchedAt → saved-deal persistence/version → feed API → DealCard summary → saved detail ledger → provider-handoff boundary → validated analytics events`.

No visible positive state should be designed as production-ready until this chain preserves the same evidence revision and selected-stay relation on card and detail.

### Analytics baseline

The analytics endpoint uses a strict event and property allowlist. Current events can measure a card open, detail view, decision-section reach, generic provider handoff, and generic back-to-results. They cannot measure:

- whether pool evidence was visible before a detail open;
- which evidence state or stay-overlap state was shown;
- whether a return to results was caused by a pool mismatch or uncertainty;
- whether provider information contradicted expaify’s disclosure; or
- confidence calibrated against correct comprehension.

The existing disruption post-return prompt is a relevant pattern: it waits for an actual return from the provider and asks a narrow mismatch question. Pool research should reuse the mechanism, not its disruption-specific taxonomy.

## Provider Evidence Feasibility

### Official structured capability

Booking.com’s Facilities API treats swimming pools as multi-instance facilities and assigns each instance an id. Its documented pool details include `swimming_pool_type`, `availability_type`, and optional `is_heated`; examples preserve separate indoor and outdoor pools. The same facility example includes weekly schedules, temporary-closure intervals, surcharge details, and source state. This validates that the proposed canonical dimensions are plausible rather than invented. It does **not** validate access through expaify’s current Booking.com RapidAPI search adapter. Sources: [Booking.com managing property facilities](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/manage-property-facilities) and [Booking.com facility migration mapping](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/migrating-hdcn-facilities-api).

Hotelbeds documents coded hotel facilities and flags that distinguish present/absent and paid/free, with meanings resolved through facility metadata endpoints. This can support a pool-listed state if a mapping and representative response sample are verified. The reviewed documentation does not, by itself, establish reliable per-pool seasonal intervals or heated-status coverage. Source: [Hotelbeds facility-field guide](https://developer.hotelbeds.com/documentation/hotels/content-api/some-tips-understand-main-features-within-facility/).

### Coverage matrix and claim boundary

| Evidence dimension | Current expaify sample | Official/plausible upstream capability | Production disposition |
|---|---:|---|---|
| Pool existence | 0 retained fields | Booking and Hotelbeds can represent facility presence | Blocked until the chosen entitled endpoint is sampled and mapped. |
| Per-pool identity | 0 | Booking documents multi-instance ids and names | Required for Booking-derived evidence; do not flatten. |
| Indoor/outdoor | 0 | Booking documents indoor, outdoor, combined, and unknown | Eligible only when returned for that instance. |
| Year-round/seasonal label | 0 | Booking documents all-season, seasonal, and unknown | A seasonal label alone must remain “seasonal; dates not provided.” |
| Seasonal date ranges | 0 | Consumer property pages can disclose month/date windows; current adapter and audited structured sample do not | Block dated coverage claims until concrete interval fields and recurrence semantics are verified. |
| Heated status | 0 | Booking documents optional boolean | Absence means “Heated status not provided,” never “not heated.” |
| Hours | 0 | Booking examples include weekly schedules; Expedia pages expose pool-access hours | Out of scope for this ticket and not part of stay-date coverage. |
| Temporary closure | 0 | Booking’s supply model can express closure intervals | Keep separate from ordinary season; still not a live-status promise. |
| Source/freshness | Provider label exists for adjacent evidence; no pool record | Adapter can attach source and fetch time | Required on every pool record; fetched time describes data retrieval only. |

### Recommendation

**NARROW.** Proceed with an implementation-ready design spec and non-production fixtures covering the full state model. In parallel, require a provider-capability spike before UI implementation is authorized. That spike must use the exact entitled consumer/demand endpoint intended for production—not Booking.com’s supplier-management endpoint—and report field coverage across at least 100 pool-listed properties spanning warm-weather, cold-weather, and shoulder-season destinations.

Minimum go gates for a differentiated dated treatment:

1. At least 95% of mapped pool records retain stable per-pool identity, source, and fetched-at values without cross-property joins or free-text inference.
2. The sample reports existence, type, schedule kind, usable seasonal intervals, and heated status as separate coverage rates; no aggregate “complete” rate may hide missing fields.
3. At least 80% of records labeled seasonal contain machine-usable operating intervals with documented annual/one-off semantics. If this gate fails, ship at most “Seasonal pool · dates not provided,” never a stay-fit relation.
4. Duplicate, malformed, contradictory, and multi-pool fixtures degrade to unknown/conflicting rather than a positive summary.
5. Card, saved detail, and handoff reproduce the same evidence revision after the six-hour cache and persistence round trip.

If only presence and type pass, narrow the product to “Indoor pool listed” or “Outdoor pool listed” with provider provenance. If stable identity/source fail, stop all visible pool evidence. Heated status is optional per record and should never block another truthful dimension.

## Reference-Pattern Findings

### Expedia: scan cue, grouped detail, explicit operating caveat

On a current property page, Expedia exposes a short scan-level phrase (“Indoor pool, seasonal outdoor pool”) near the photo/property summary, repeats the types in grouped property amenities, and reserves operating months, access hours, and closed-season dates for deeper “You need to know” and FAQ content. This is a useful progressive-disclosure hierarchy: existence/type first, operating detail later. It also demonstrates a material semantic distinction between “seasonal” and a concrete season (“May to October” / closed November 1 to May 15). Source: [Expedia’s All Seasons Resort property page](https://www.expedia.com/South-Yarmouth-Hotels-All-Seasons-Resort.h2730253.Hotel-Information).

The weakness for expaify to avoid is repetition without stay matching. A traveler should not have to mentally compare provider months with selected dates, and expaify must not surface “Pool” alone when richer evidence is already available.

### Booking.com: preserve facility instances and unknowns

Booking.com’s official facility model treats swimming pools as multiple instances rather than one property boolean. Each instance can independently carry indoor/outdoor type, all-season/seasonal/unknown availability, heated status, schedule, closure, fee, and an id. This is the right interaction-model input: detail must show one row/card per pool when facts differ; the card may summarize only if it does not erase a mismatch. Source: [Booking.com managing property facilities](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/manage-property-facilities).

The key delta from expaify is structural. References organize rich property facts after a scan cue, while expaify currently has neither the cue nor the detail ledger—and its data model would collapse or discard the reference facts before presentation.

## Traveler Comprehension Validation Plan

Because no participant access was available in this stage, the hierarchy is **not yet behaviorally validated**. UXDES should specify a fixture-driven prototype and a moderated, counterbalanced study with 8–12 leisure travelers who say a pool materially affects at least one hotel decision per year. Include at least four family travelers and four travelers considering shoulder/off-season stays. Test at 375px and 1280px; do not brief participants on the meaning of the labels.

Each participant should compare hotel cards, open details, and decide “keep,” “reject,” or “need to confirm” across these fixtures:

1. one indoor, year-round, heated pool; selected stay fully covered;
2. one outdoor seasonal pool with dates fully covering the stay;
3. a stay spanning the last operating day and first closed day (partial overlap);
4. a stay wholly outside the disclosed season (no overlap);
5. pool listed as seasonal but operating dates absent;
6. operating dates disclosed but selected stay dates absent;
7. indoor/outdoor supplied, heated status absent;
8. two pools with different type, season, heating, and stay relation;
9. stale evidence and conflicting provider records;
10. ordinary season covers the stay but temporary closure/live status is unknown.

After each task, ask the participant to state what the provider disclosed, whether the dates fit, what remains unknown, and their confidence on a 5-point scale. Then score the answer against the fixture rather than treating confidence as success.

Go criteria for comprehension:

- at least 80% correct classification for full, partial, none, and indeterminate stay relation overall, with no individual relation below 70%;
- at least 80% correctly distinguish “heated status not provided” from “not heated”;
- at least 80% preserve separate facts for multiple pools;
- at least 90% understand that provider-disclosed season coverage does not confirm day-of-stay opening, maintenance, capacity, weather, or access; and
- median decision confidence of at least 4/5 among correct answers, while incorrect high-confidence answers (4–5/5) remain below 10%.

Failure on the live-status item blocks positive wording. Failure on partial-versus-full overlap requires the card to retreat to a neutral “Pool details” cue while detail retains exact dates. Do not tune copy solely to increase confidence.

## Design Directives

### 1. Gate every card treatment by evidence capability and stay context

The card may show one concise pool line only when a canonical, persisted pool record with source and freshness exists. Use this precedence:

1. **No overlap:** `Pool schedule does not cover your full stay`
2. **Partial overlap:** `Pool schedule covers part of your stay`
3. **Full overlap:** `[Indoor|Outdoor] pool schedule covers your stay`
4. **Seasonal, interval missing:** `Seasonal [indoor|outdoor] pool · dates not provided`
5. **Pool present, schedule missing:** `[Indoor|Outdoor] pool listed · operating dates not provided`
6. **Type missing:** `Pool listed · operating details not provided`
7. **Conflicting/malformed/stale beyond the approved threshold:** `Pool details need confirmation`
8. **No pool field returned:** show no pool line on the card; do not render `No pool`.

Do not include heated status in the primary card sentence unless user testing proves it remains comprehensible without displacing identity, dates, price, or Deal Score at 375px. A negative or partial date relation outranks all positive attributes. For multiple pools, summarize only the best truthful stay relation and append `· 2 pools disclosed`; never let one fully covered pool hide another pool the user explicitly selected or opened.

Acceptance test: every fixture maps deterministically to one card sentence; unknown data never maps to `closed`, `unheated`, `available`, `open`, or `fits your stay`.

### 2. Make detail a per-pool evidence ledger, not an amenity list

Place a `Pool details` block inside the existing `Hotel fit` section after property quality and before the provider handoff. Preserve one entry per provider pool instance. Each entry must present, in this hierarchy:

- pool name when meaningful, otherwise `Pool 1`, `Pool 2`;
- `Indoor`, `Outdoor`, `Indoor and outdoor`, or `Type not provided`;
- exact selected-stay relation and disclosed interval, e.g. `Your Aug 28–Sep 2 stay is partly within the disclosed May 15–Aug 31 season`;
- `Heated`, `Not heated`, or `Heated status not provided` only when the provider field has the corresponding state; and
- `Disclosed by [provider] · checked [date/time]`.

When selected dates are missing, say `Add stay dates to compare with the disclosed season.` When a seasonal label lacks intervals, say `The provider lists this pool as seasonal but did not provide operating dates.` When records conflict, show no resolved type/heating/date claim and say `Provider pool details conflict. Confirm before booking.`

Acceptance test: a screen reader reads the pool name before its type, date relation, heating, and source; repeated pool entries remain distinguishable without color or icons; content does not horizontally scroll at 375px.

### 3. Separate disclosed schedule fit from live operating status

Immediately after the pool entries and again beside the provider action when any pool evidence is shown, use this boundary copy:

`Provider-disclosed pool details can change. expaify does not confirm day-of-stay opening, maintenance, capacity, weather closures, hours, fees, or guest access. Confirm current conditions with the property or booking provider.`

If an approved source reports a temporary-closure interval, show it as a separate warning above ordinary season coverage: `Provider reports this pool closed [start]–[end].` Never merge temporary closure with `seasonal`, and never label a pool `Open now`, `Available`, `Guaranteed`, or `Closed` from the ordinary season field alone.

Acceptance test: full-overlap and year-round fixtures still expose the boundary; an unknown closure state cannot produce an affirmative live-status claim.

### 4. Preserve card-to-detail evidence continuity and failure states

The pool evidence version used for the card must be persisted with the saved deal and re-read on detail. If detail fetches a newer revision, label the updated evidence and recompute the selected-stay relation rather than silently showing a different claim. Required states are `loading`, `ready`, `not_returned`, `malformed`, `conflicting`, `stale`, and `check_failed`; loading must reserve space, while failure must leave identity, price, Deal Score, navigation, and provider handoff usable.

Card evidence should remain a non-interactive text cue inside the current full-card link. Detail owns expansion and provenance. If UXDES introduces a card control, it must first replace the full-card anchor with a valid, keyboard-operable interaction structure.

Acceptance test: the same evidence fixture survives provider normalization, six-hour cache, saved-deal persistence, feed serialization, card presentation, and detail presentation without losing pool identity, unknowns, source, or selected-stay relation.

### 5. Measure late exits and calibrated confidence without inferring intent

Add privacy-bounded, allowlisted events only after analytics review:

- `hotel_pool_summary_viewed`: `deal_id`, `evidence_state`, `stay_relation`, `pool_count_bucket`, `viewport_group`, `evidence_revision`;
- `hotel_pool_detail_viewed`: the same fields plus `source_freshness_bucket`;
- `hotel_pool_back_reason_submitted`: `reason` = `schedule_mismatch | type_mismatch | heating_unknown_or_mismatch | live_status_unknown | other_pool_reason | not_pool_related`, plus the exposed evidence state and stay relation;
- `hotel_pool_provider_handoff_started`: evidence state, stay relation, and provider; and
- `hotel_pool_provider_return_mismatch`: `different_schedule | different_type | different_heating | temporary_closure | other | no_difference`.

Do not label ordinary back navigation, tab close, or provider handoff as pool-driven. Ask the optional back reason only after pool detail was actually exposed or pool intent was explicitly supplied, once per detail view, with `Skip` available. Ask the provider mismatch question only after visibility returns from a pool-exposed handoff.

Primary behavioral metric:

`explicit pool-related back reasons / eligible hotel detail views with pool intent or pool-detail exposure`.

Read this alongside card-level mismatch rejection, suitable-property detail opens, provider handoff, and `not_pool_related`; a lower detail-exit rate is not success if unknown/mismatch states were hidden. Calibrated confidence remains a research metric: report confidence only beside answer correctness, using the comprehension thresholds above.

## Exact Gap Summary

Current code supplies no pool evidence at any point in the reachable saved-deal journey and cannot measure pool-driven exits. Reference patterns and official provider models show that existence, multiple pool instances, type, season, heating, schedules, and closure notices are distinct facts. The minimum safe delta is a source-preserving per-pool contract plus deterministic date-overlap logic and explicit unknown/live-status language—not a generic pool amenity chip.

UXDES may now specify every visual and interaction state against fixtures. Production UI/DEV authorization remains blocked on an entitled provider sample meeting the go gates and on a persistence plan that preserves the same evidence from result card to saved detail.

## Handoff

Create `UXDES-HOTEL-POOL-OPERATING-STATUS-01` with this brief. The design stage must cover default, loading, not-returned, malformed, conflicting, stale, full/partial/no/indeterminate overlap, dates missing, schedule missing, multiple pools, provider return, mobile 375px, desktop 1280px, and keyboard/screen-reader states. It must not imply production provider support or live pool operation.
