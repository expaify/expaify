# UXR-HOTEL-LUGGAGE-STORAGE-01 — Hotel Luggage-Storage Confidence Research Brief

Date: 2026-07-31  
Stage: UX Research  
Priority: P2  
Feature slug: `hotel-luggage-storage`  
Upstream: `docs/pipeline/hotel-luggage-storage/01-discovery.md`

## Decision

**Defer a production luggage-storage UI.** The current provider path cannot deliver any storage evidence to a traveler, and no user study or intent baseline yet demonstrates that this concern warrants another persistent hotel evidence block. A generic `Luggage storage` badge would not answer the decision in the discovery report and would create false confidence about timing and charges.

The smallest evidence set worth validating remains:

1. a property-reported service state;
2. separate applicability before check-in and after checkout;
3. a storage-specific charge state;
4. any supplier-reported conditions that change usability; and
5. source, observation time when available, property-level scope, and a non-guarantee boundary.

The set can render a safe `keep`, `rule out`, or `verify` decision only when unknowns remain explicit. It must not be reduced to a boolean. Production design should reopen only after both the supply and comprehension gates in this brief pass.

If those gates pass, the minimum placement is one disclosure in expanded hotel detail, carried forward once on the outbound review **before** `Check rooms at {partner}`. The current card puts `Review hotel` before the `Details` disclosure in DOM and visual order, so the outbound review is the only guaranteed pre-provider exposure unless a later design ticket explicitly changes that hierarchy. Collapsed-result placement is harmful under current conditions: there is no explicit timing-intent input, the collapsed card is already dense, current coverage is zero, and an absent label would be easy to misread as “no storage.”

## Method And Evidence Limits

This brief combines:

- a static audit of the current provider, normalization, cache, search, hotel card, booking-context, handoff, and analytics paths in this worktree;
- a task-level comparison with current Booking.com supplier-facility documentation, Expedia property-detail presentation, and Google Hotels’ documented results/detail hierarchy; and
- an evidence-sufficiency walkthrough for early-arrival and late-departure scenarios.

No production provider payload sample, coverage export, behavioral baseline, or recruited usability session was supplied with this ticket. Therefore:

- code-path coverage can be stated exactly, but market demand and traveler comprehension cannot;
- the scenario walkthrough identifies what a user **could** conclude from each evidence combination; it is not a substitute for observed research participants; and
- no conversion or confidence lift is claimed.

## Current-Code Evidence

Every finding in this section comes from files in this worktree. Reference-pattern guidance is kept in the later section.

### 1. `HotelOffer` and `HotelProvider` cannot carry a storage policy

`HotelOffer` in `lib/types.ts` carries price, location, quality, generic amenity evidence, funds policy, smoking policy, rate eligibility, and admission policy. It has no luggage-storage object and no way to represent:

- before-check-in versus after-checkout applicability;
- storage-specific operating hours or cutoffs;
- a storage-specific charge state or amount/basis;
- same-day, registered-guest, advance-arrangement, bag-size, or bag-count conditions;
- contradictory source statements; or
- a storage-specific `not_returned` state.

`HotelProvider.searchHotels` returns `Result<HotelSearchPage>`, so the provider-neutral contract ends at that same gap. Adding display copy alone cannot repair it.

The existing `HotelAmenityEvidence` shape is not sufficient without extension. It has a generic `status`, `scope`, `sourceLabel`, optional `fee`, `fetchedAt`, `confidence`, and `certainty`, but no timing applicability, operating schedule, condition statements, or conflict envelope. Its `fee` can distinguish `included`, `paid`, and `unknown`, but it cannot carry an amount and basis if a supplier later returns one.

### 2. The live Hotellook path returns no usable storage evidence

`lib/providers/hotellook.ts` calls only `engine.hotellook.com/api/v2/cache.json`. Its typed raw entry includes hotel identity, class, location/address, distance, `priceFrom`, property type, and an untyped `amenityEvidence` hook. The live and cached paths pass that hook through `normalizeHotelAmenityEvidence`, then cache the normalized `HotelOffer` for six hours.

The current official Travelpayouts Hotels Data API documentation describes the relevant hotel data as identity, location, price, class/rating, and a general facilities/amenities collection. Its documented short-facility set does not include luggage storage, and it does not document pre-check-in applicability, post-checkout applicability, storage charges, storage conditions, or a selected-stay confirmation for the endpoint used here. [Travelpayouts Hotels Data API reference](https://travelpayouts.github.io/slate/)

The repo has no second hotel supplier capable of filling the gap. `lib/providers/bookingComRapidApi.ts` is a flight adapter, implements `FlightProvider`, and intentionally refuses to map even its flight response until a verified payload exists. It is not a hotel-content fallback.

### 3. The generic amenity normalizer drops storage rather than preserving it

`lib/providers/hotelAmenityEvidence.ts` allowlists exactly seven ids:

- `elevator`;
- `on_site_parking`;
- `step_free_route`;
- `room_pref_ground_floor`;
- `room_pref_high_floor`;
- `room_pref_near_elevator`; and
- `room_pref_connecting`.

`normalizeItem` returns `undefined` for every unknown id. Therefore a hypothetical raw `luggage_storage` item does not survive normalization. The resulting array always contains the seven catalog facts, filling omissions with `not_returned`; it never contains a storage row.

This is stronger than “the UI does not show it”: the current adapter contract actively makes storage evidence unreachable even if an untyped fixture placed it in `amenityEvidence`.

### 4. Coverage is deterministically zero in the normalized product path

Coverage below uses **all hotel offers that successfully pass the current Hotellook live or cache normalizer** as the denominator. It does not claim to measure what Hotellook or another vendor might hold outside this integration.

| Candidate evidence group | Complete | Partial | Explicit unavailable | Conflicting | Not returned / cannot survive normalization |
|---|---:|---:|---:|---:|---:|
| Property-reported storage service | 0% | 0% | 0% | 0% | 100% |
| Before-check-in applicability | 0% | 0% | 0% | 0% | 100% |
| After-checkout applicability | 0% | 0% | 0% | 0% | 100% |
| Storage-specific hours/cutoff | 0% | 0% | 0% | 0% | 100% |
| Storage-specific charge state | 0% | 0% | 0% | 0% | 100% |
| Material storage conditions | 0% | 0% | 0% | 0% | 100% |
| Source + observed-at storage provenance | 0% | 0% | 0% | 0% | 100% |

There are no explicit negatives to count. Missing evidence must not be relabeled “unavailable,” and no fee may be inferred as included because no storage fee was returned.

### 5. `HotelCard` has no storage placement and is not mounted in a production page

The collapsed `HotelCard` already places hotel class/guest rating, an optional elevator chip, location, price, eligibility, admission, parking, funds policy, pet policy, smoking policy, Deal Score, and the `Review hotel` action before its `Details` control. Adding an unknown-state storage row here would increase scan cost while answering nothing.

Expanded details contain Deal Score, quality, location, admission, parking, pet, smoking, generic access evidence, price scope, funds policy, and provider guidance. There is no luggage-storage section or copy.

A repository-wide call-site search finds `HotelCard` only in its test files; no application page mounts it. This means even a correct card-only design would not reach the current live deal surfaces. Surface wiring is out of scope for this UXR ticket, but it is a release blocker that UXDES must state rather than assume away.

### 6. Storage evidence is lost before booking handoff

`BookingHotelContext` in `lib/booking/config.ts` has no amenity or luggage-storage field. `buildBookingHotelContext`, query parsing, structured validation, Redis persistence, and context resolution therefore cannot carry storage evidence from an offer into `/book`.

`HotelHandoffReview` has an adjacent `Special requests` block that names quiet room, high floor, and early check-in. It says expaify sends nothing and requests are not guaranteed. That boundary is useful but does not answer whether the property reports luggage storage. Early check-in and storage are different services; the request block must not be repurposed as evidence of storage.

The provider CTA’s accessible name currently calls out smoking-policy verification, not storage. No storage claim appears before `Check rooms at {partner}`.

### 7. Current analytics cannot establish demand, exposure, comprehension, or cause

The analytics route allowlists hotel detail views, section reach, hotel handoff start/view/continue/back/return, request-guidance exposure, and a finite set of return reasons. There are no storage events or properties.

Specific gaps:

- no early-arrival or late-departure intent is captured;
- no storage-evidence state, completeness, exposure, or details-open event exists;
- no `keep`, `rule out`, or `verify` decision is captured;
- no factual-comprehension or calibrated-confidence response is captured; and
- the provider-return reasons do not name luggage storage, timing, or charges.

The current `hotel_handoff_returned` event only proves that the tab became visible after a handoff. It cannot attribute the return to storage. `Other hotel details did not match` is too broad to create a baseline. Existing exits must remain correlations unless the traveler explicitly selects a storage reason.

## Reference-Pattern Guidance

These references guide interaction and evidence modeling only. They do not prove that expaify has equivalent data rights or supplier coverage.

### Booking.com: a property facility with bounded detail, not a stay guarantee

Booking.com’s current Facilities API identifies `LUGGAGE_STORAGE` as property facility id 91. Its metadata allows `SCHEDULED_DETAILS`; the documented meta entry does not list `SURCHARGE_DETAILS` for luggage storage. Property facilities are explicitly represented as `PRESENT` or `MISSING`. [Booking.com facility metadata](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/facilities-meta-endpoint), [property-facility states](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/manage-property-facilities)

Interaction/data rule to borrow:

- treat storage as a structured **property** fact;
- retain supplier state and schedule rather than parsing marketing prose; and
- do not turn a property facility into confirmation for a selected date, bag, or arrival/departure period.

Important limitation: the published facility model can support property-reported presence/absence and scheduled details, but it does not by itself establish before-check-in use, after-checkout use, a storage-specific fee, or conditions such as registered-guests-only. Those dimensions must remain unknown unless a contracted demand/content response supplies them directly.

Delta from expaify: Booking.com has a storage facility vocabulary; expaify’s active provider contract and allowlist do not. Even adopting the facility id concept would still leave the central timing and charge questions unresolved.

### Expedia: detail-level convenience, with fees kept separate

Current Expedia property pages place `Luggage storage` under `Property amenities` → `Conveniences`, sometimes also surfacing it in the property summary. Fee-bearing services are described separately under their relevant amenity rows or `Important information`/`Fees`. For example, The Notary Hotel lists luggage storage as a convenience while separately specifying amounts for breakfast, parking, and Wi-Fi. [Expedia property example](https://www.expedia.com/Philadelphia-Hotels-The-Notary-Hotel.h431312.Hotel-Information?rfrr=HOT.HIS.question.link.click)

Interaction rule to borrow:

- storage belongs in property detail, not the price or Deal Score hierarchy;
- a generic property-facility label is a scan aid, not proof about pre-check-in or post-checkout use; and
- charges attached to other amenities must never be read as evidence that storage is free or paid.

Delta from expaify: Expedia’s detail has a dense property-content supply and can show the positive facility among many conveniences. expaify has zero normalized storage coverage, so positive-only display would make unlabeled hotels appear unsuitable and an always-visible unknown row would add noise without resolving the decision.

### Google Hotels: detail for amenity learning, results only for strong comparison signals

Google documents a two-level hierarchy: result cards can show a snapshot of key amenities, while the property placesheet/detail contains broader amenity information. Google also states that amenity information can come from hoteliers, hotel websites, partners, direct research, and user feedback. [Google Travel Help: Search for hotels](https://support.google.com/travel/answer/6276008?hl=en)

Interaction rule to borrow: keep broad or low-coverage property facts in detail; promote a fact into result-level comparison only when it is a reliable, intentional narrowing criterion.

Delta from expaify: expaify may only use contracted provider-backed evidence and must preserve source/scope. It cannot import Google’s mixed-source model or infer that a missing result-card label means a missing facility.

## Exact Gap

| Decision dimension | Current code | Reference capability | Required delta |
|---|---|---|---|
| Property reports storage | Unrepresentable; unknown ids dropped | Booking.com supports property `PRESENT`/`MISSING`; Expedia displays a property amenity | Add a provider-neutral storage state only when a contracted hotel provider returns it |
| Before check-in | No arrival time or storage applicability | Not established by a generic reference facility label | Carry an explicit `before_checkin` state; never derive it from storage presence or check-in time |
| After checkout | No departure time or storage applicability | Not established by a generic reference facility label | Carry an explicit `after_checkout` state; never mirror the before-check-in state |
| Hours/cutoff | No storage schedule | Booking.com facility metadata permits scheduled details | Preserve supplier schedule text/structured local times when actually returned |
| Charge | Generic amenity fee shape exists, but no storage row | Reference pages separate facility labels from fee disclosures | Use `included`/`paid`/`unknown`; any amount uses `Money` plus an explicit basis |
| Conditions | No storage condition field | Reference facility label does not guarantee bag/stay eligibility | Preserve only supplier-reported material conditions; otherwise show unknown |
| Provenance/guarantee | Generic source exists; no storage-specific continuity | References treat it as property content | Retain source/fetched time and say property-reported, not guaranteed for this stay |
| Placement | No storage UI; card not live-mounted | Detail is primary; key amenities may be summarized in results | Expanded detail for comparison, then guaranteed handoff-review exposure; no collapsed placement yet |
| Measurement | No intent, exposure, decision, or storage return reason | Not applicable | Add bounded events only after a prototype and data contract exist |

## Minimum-Evidence Sufficiency Walkthrough

The walkthrough uses two controlled scenarios because current product dates cannot reveal a timing mismatch.

### Scenario A — early arrival

Traveler arrives at 08:00; room check-in begins at 15:00.

| Evidence shown | Correct conclusion | Why |
|---|---|---|
| `Luggage storage: reported` only | `verify` | Presence does not establish use before check-in or a fee |
| Reported + `before check-in: available`; charge unknown | `verify` if charge affects value, otherwise cautiously `keep` | Timing is answered, cost is not |
| Reported + before check-in available + included + no material conditions reported | `keep`, with non-guarantee understood | Minimum decision questions are answered as far as property evidence allows |
| Explicitly unavailable before check-in | `rule out` when storage is required | An explicit negative changes the fit decision |
| Before-check-in applicability not returned | `verify` | Unknown is not unavailable |
| Conflicting timing statements | `verify` | Conflict blocks a safe positive or negative claim |

### Scenario B — late departure

Traveler checks out at 11:00 and departs for the airport at 20:00.

The same states must be evaluated independently for `after_checkout`. A positive before-check-in fact cannot be copied to after checkout. A schedule such as `08:00–18:00` also fails the 20:00 need even when general storage is reported.

### Result of the walkthrough

The generic amenity label fails both scenarios. Timing applicability is decision-critical, charge state calibrates value, and source/non-guarantee language calibrates certainty. Material conditions can change the answer and therefore need a preservation field, but they do not need a separate collapsed-card row; supplier text can live in detail when present. Observation time is provenance metadata, not a primary scan item.

This supports the five-group contract as the smallest **model** worth validating, while allowing the visual summary to remain much smaller.

## Ship/Defer Gates

### Current outcome: DEFER

Both required gates fail today.

#### Gate 1 — supplier coverage

Before production UI design, collect a real, contractually usable payload sample and a coverage report from the approved hotel provider over a representative result set. Pass only if:

- storage service state survives `lib/providers` normalization with source and observation time when supplied;
- before-check-in and after-checkout applicability are reported separately rather than inferred;
- charge state distinguishes `included`, `paid`, and `unknown` without treating omission as included;
- explicit unavailable, conflict, partial, and not-returned states are measurable separately; and
- at least 30% of normalized offers have enough evidence to produce a non-`verify` answer for one of the two timing scenarios, with no single required dimension below 30% coverage in that cohort.

The 30% threshold is a research launch criterion, not a known industry benchmark. It prevents an always-visible feature from being dominated by unknowns while still allowing a prototype with meaningful state variation. Product should revisit the threshold after observing the actual distribution.

#### Gate 2 — comprehension and decision value

Run a moderated prototype study with 8–10 first-time or infrequent hotel-comparison users: at least four early-arrival and four late-departure scenarios, including a cost-sensitive traveler and a traveler for whom carrying bags is a hard constraint. Randomize two variants:

- Variant A: storage disclosure in expanded detail, repeated on the handoff review before the external-provider action;
- Variant B: the same two surfaces plus a collapsed result cue.

Each participant receives reported-complete, partial/unknown, explicit-unavailable, and conflicting examples. Ask them to state:

1. whether the property reports storage;
2. whether it applies to the scenario’s period;
3. whether a charge is reported, possible, or unknown;
4. whether the evidence guarantees the service for their stay; and
5. whether they would `keep`, `rule out`, or `verify` the property, and why.

Pass only if:

- at least 85% of all fact-state answers are correct;
- at least 90% distinguish `not returned` from `unavailable`;
- no more than one participant interprets property-reported evidence as a guarantee;
- at least 70% choose the safe expected decision for each scenario (`keep`, `rule out`, or `verify`); and
- the disclosure produces a directional improvement of at least 20 percentage points over a no-storage-evidence control in complete-case decision correctness.

Do not use self-rated confidence alone as the gate. Record it only after factual answers, then flag high-confidence incorrect answers as the highest-severity trust failure.

### Measurement definitions after a gate-passing prototype

If implementation proceeds, use bounded enumerations rather than free text:

- `hotel_storage_evidence_viewed`: surface, evidence completeness, before-check-in state, after-checkout state, charge state, explicit intent cohort;
- `hotel_storage_details_opened`: same evidence dimensions;
- `hotel_storage_decision_recorded`: `keep | rule_out | verify`, explicit scenario/intent, evidence completeness;
- `hotel_handoff_return_reason_selected`: add a bounded `storage_timing_or_charge` reason only after handoff return; and
- existing back, continue, and return events as guardrails, never causal labels.

An exposure should require at least 50% visibility for 1 second, matching the existing decision-section convention. No event should infer intent from dates, dwell time, airport, property type, or storage evidence availability.

## Placement Decision

### Conditional minimum after both gates pass

1. **Expanded hotel detail, before the detail panel’s provider-handoff copy: required for comparison.** This is the first surface with enough space to distinguish the two timing periods, charge, conditions, source, and unknowns without displacing price, Deal Score, location, or core fit evidence. In the current `HotelCard`, `Review hotel` appears before `Details`; UXDES must not claim the detail disclosure is guaranteed exposure or silently reorder the CTA under this ticket.
2. **Outbound hotel review, before `Check rooms at {partner}`: required continuity.** Preserve the identical evidence revision and state. Do not introduce a stronger claim at handoff. This is not a concierge request and expaify sends nothing.
3. **Collapsed result: do not implement in MVP.** Reconsider only if a later explicit timing-intent control or research intercept shows storage is a frequent elimination criterion, supplier coverage is high enough that positive-only labels do not bias comparison, and Variant B materially improves five-second comparison without increasing unknown-as-unavailable errors.

The expanded disclosure should not be nested in Deal Score, funds policy, generic special requests, or accessibility. It is a property service with timing and fee uncertainty, not price quality, a payment obligation, or a request expaify transmits.

## Conditional Evidence Contract For Future UXDES/DEV

This is a research recommendation, not authorization to implement. If the gates pass, use a dedicated provider-neutral object rather than adding `luggage_storage` to the seven-row access catalog:

```ts
type HotelStorageFactState =
  | 'reported_available'
  | 'explicitly_unavailable'
  | 'not_returned'
  | 'conflicting'

type HotelStoragePeriodState =
  | 'reported_available'
  | 'explicitly_unavailable'
  | 'not_specified'
  | 'conflicting'

type HotelStorageCharge =
  | { state: 'included' }
  | { state: 'paid'; amount?: Money; basis?: 'per_bag' | 'per_hour' | 'per_day' | 'per_stay' | 'other' }
  | { state: 'unknown' }

interface HotelLuggageStorageEvidence {
  scope: 'property'
  serviceState: HotelStorageFactState
  beforeCheckin: HotelStoragePeriodState
  afterCheckout: HotelStoragePeriodState
  schedule?: {
    providerWording: string
    localTimeZone?: string
  }
  charge: HotelStorageCharge
  conditions: Array<{
    id: string
    providerWording: string
  }>
  source: {
    label: string
    observedAt?: string
  }
  evidenceRevision: string
}
```

Contract rules:

- `scope` is always `property`; there is no selected-stay guarantee state in MVP.
- `reported_available` never auto-populates either timing period.
- a missing field normalizes to `not_returned`/`not_specified`, never `explicitly_unavailable` or `included`.
- `paid` without a returned amount remains `paid`; no amount is invented.
- any returned amount uses integer `Money` and an explicit basis when known.
- supplier wording may be preserved for schedule and material conditions but bounded and sanitized in the provider adapter; components do not parse vendor prose.
- contradictory statements normalize to `conflicting` and render a `verify` outcome.
- every external lookup remains behind `lib/providers` and returns `Result<T>`.

## No Production Design Directives Yet

The discovery report permits 3–5 implementation directives only if evidence coverage and decision lift justify implementation. They do not: normalized coverage is 0%, no contracted payload establishes the required timing/charge dimensions, and no traveler study has measured comprehension or lift.

Accordingly, this brief intentionally provides **no production UI directives**. The following are gate-owner instructions, not feature directives:

1. UXDES may create a research prototype covering complete, partial, unavailable, conflict, loading, and error states, but must label it validation-only and must not hand it to UI as ship-ready while Gate 1 or Gate 2 fails.
2. Provider/DEV must produce the supply audit and approved payload contract before any production component is wired.
3. Research must run the two-scenario comprehension study and record factual accuracy before self-rated confidence.
4. Product must explicitly approve reopening the feature after both gates pass; silence or generic amenity availability is not approval.

## Constraints And Out-Of-Scope Findings

- No bag-drop reservation, messaging, request submission, provider contact, storage inventory, payment, claim check, or off-site storage marketplace belongs in this MVP.
- Early check-in and late checkout are not proxies for luggage storage.
- Storage must not affect Deal Score, hotel ranking, or filtering under this ticket.
- No generic amenity, star class, property type, front-desk hours, review text, or industry practice may be used to infer storage.
- The current `HotelCard` surface is test-only/unmounted. Resolving live hotel-result wiring requires a separate scoped ticket.
- The existing generic amenity/access catalog has overlapping ownership work in other pipeline tickets. Storage should not be forced into it because its period and charge model is materially different.
- The approved secret contract in the user briefing names `HOTEL_AFFILIATE_ID`; the existing provider also falls back to `TP_AFFILIATE_MARKER`. This is adjacent configuration behavior, not changed here.
- No product code, API route, provider, analytics schema, or design-system file was changed by this research ticket.

## Handoff To UXDES

Create `UXDES-HOTEL-LUGGAGE-STORAGE-01` as a **validation-only design** handoff. It should prototype the conditional two-surface hierarchy and every evidence state for the study above, while explicitly recording `DEFER — NOT SHIP-READY` until an approved provider payload passes Gate 1 and observed comprehension/decision correctness passes Gate 2. It must not specify a collapsed result cue for MVP and must preserve the property-reported, non-guaranteed, explicit-unknown, and no-concierge boundaries.
