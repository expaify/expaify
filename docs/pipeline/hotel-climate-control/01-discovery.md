# UXD-HOTEL-CLIMATE-CONTROL-01: Hotel In-Room Climate-Control Confidence

Date: 2026-08-03  
Stage: UX Discovery  
Priority: P0  
Feature slug: `hotel-climate-control`

## User pain point

A traveler cannot tell during hotel comparison or room review whether air conditioning, heating, and guest-adjustable controls are confirmed for the room they may book, because expaify shows no scoped climate-control evidence and a property-level amenity can be mistaken for a selected-room guarantee.

## Who is affected and where

This affects travelers for whom room temperature is a material stay requirement, including people traveling with infants or older adults, people with health or sensory needs, and anyone traveling during temperature extremes. It also affects any first-time traveler comparing a cheaper property with unknown evidence against a more expensive property that has a confirmed room attribute.

The affected decision path is:

1. **Hotel comparison:** the traveler scans result cards or the hotel deal feed. Today they can compare price, Deal Score, location, quality, and some policy evidence, but not cooling, heating, or control scope.
2. **Property detail:** the traveler expands `HotelCard` or opens a saved hotel deal. Neither detail surface states whether a climate attribute applies to the property generally, a room category, or the selected room/rate.
3. **expaify review:** `BookingFlow` prepares the provider handoff, but its hotel context carries no climate evidence. The traveler is told to check room options with the provider without a climate-specific statement to preserve or verify.
4. **Provider room detail:** the provider may reveal room-specific air conditioning, heating, seasonal operation, or control wording only after the traveler leaves expaify. expaify does not currently observe the provider's room-selection funnel.
5. **Reversal or abandonment:** the traveler may return, compare another hotel, revise the search, or leave after climate evidence is missing or contradicts expectations. Current analytics can observe some result opens and provider returns, but cannot attribute them to climate control.

Air conditioning, heating, and guest control are separate facts. “Air-conditioned property” does not establish heating, does not establish that every room is cooled, and does not establish that a guest can set the room temperature. The same separation applies to heating.

## Current evidence and measurable baseline

The current code makes the trust gap observable:

- `HotelOffer` in `lib/types.ts` has no climate-control field. Its generic `HotelAmenityEvidence` can carry status, scope, source, freshness, and certainty, but not whether cooling or heating is present, whether operation is seasonal, or whether a guest can adjust it.
- `normalizeHotelAmenityEvidence` in `lib/providers/hotelAmenityEvidence.ts` allowlists access and room-request facts only. Unknown IDs are discarded, so climate facts are not representable in normalized results.
- Both active search adapters inspected—`lib/providers/bookingComHotelsRapidApi.ts` and `lib/providers/hotelbeds.ts`—call that normalizer with no amenity payload. Their mapped search contracts include no structured climate or selected-room attribute.
- `HotelCard` has no climate summary or climate evidence section. Its expanded details include room/rate availability caveats and other hotel-fit evidence, but cannot distinguish a confirmed room control from missing evidence.
- The saved-deal detail in `app/deals/[dealId]/page.tsx` and the hotel review in `app/book/BookingFlow.tsx` carry no climate evidence. `BookingHotelContext` therefore cannot preserve a climate claim into the handoff.
- Existing analytics record hotel result views/opens, handoff views/clicks, provider returns, away-duration buckets, and a small set of return reasons. There is no climate-evidence exposure dimension and no climate-specific mismatch or abandonment reason. “Other hotel details did not match” is too broad to establish climate causation.

The defensible product baseline is therefore:

- **0% of displayed offers with normalized, provider-attributed climate-control evidence**, for each active hotel provider represented in the inspected adapters;
- **0% of displayed offers with selected-room or selected-rate climate-control confirmation**;
- **no currently measurable climate-attributed comparison abandonment or provider-return mismatch rate**.

These are contract baselines, not claims that the source providers never possess climate data. UXR must inspect actual provider capabilities and representative payloads before assigning a supplier-coverage rate.

## Minimum evidence needed for a decision

The minimum decision record has three independent dimensions. Downstream work must not collapse them into one “climate control” or “A/C” badge.

| Dimension | Question the evidence must answer | Safe factual values |
| --- | --- | --- |
| Cooling | Is mechanical room cooling stated? | `present`, `explicitly_absent`, `not_provided`, `check_failed`, `conflicting` |
| Heating | Is room heating stated? | `present`, `explicitly_absent`, `not_provided`, `check_failed`, `conflicting` |
| Guest control | Can the guest adjust the room's climate rather than rely only on property-controlled operation? | `guest_adjustable`, `property_controlled`, `not_stated`, `conflicting` |

Every non-missing value also needs:

- **scope:** `property`, `room_category`, or `selected_room_rate`;
- **supplier provenance:** provider name and, where normalization could remove nuance, the source wording;
- **observed time:** when the provider evidence was fetched;
- **operating qualification, when supplied:** year-round, provider-stated seasonal dates/period, or schedule not stated.

The evidence hierarchy is:

1. **Selected room/rate:** an explicit structured attribute attached to the room/rate for the traveler's dates. This is the only level that may be described as confirmed for the room being considered.
2. **Room category:** an explicit attribute attached to a named room category. It supports category comparison but is not a selected-room guarantee until that category/rate is selected and available.
3. **Property:** an explicit property amenity. It may be shown as property-level evidence but cannot be rewritten as “your room has…” or treated as proof of individual control.
4. **Unavailable evidence:** missing, failed, ambiguous, or conflicting data. These states must remain visible as evidence limitations and must never be converted into absence or presence.

An explicit provider statement that a dimension is absent is a factual negative. It must remain distinct from `not_provided` and `check_failed`. A property-level air-conditioning amenity with no control wording must be presented as cooling reported at the property and guest control not stated; it cannot support “in-room thermostat,” “individually controlled,” or “confirmed for this room.”

## Evidence threshold

A climate fact may be counted or presented as **confirmed for the selected room/rate** only when all of the following are present:

1. the fact comes through `lib/providers` from supplier data, not from property name, destination weather, photos, reviews, star class, price, or an inferred amenity;
2. the provider explicitly associates it with the selected room/rate for the relevant stay, rather than the property alone;
3. cooling, heating, and guest control are recorded independently, with any provider-stated seasonal qualification preserved;
4. the evidence retains supplier attribution and observed time; and
5. no unresolved record conflicts with the claim at the same or more specific scope.

Property- or category-level evidence can still help comparison when accurately labeled, but it fails the selected-room confirmation threshold. Missing control detail fails only the control claim; it does not erase a separately supported cooling or heating fact.

## Measurement plan

### 1. Evidence availability by provider

For every displayed hotel offer, record provider and the evidence state for cooling, heating, and guest control separately. Report:

- the percentage of displayed offers in each state (`present`, `explicitly_absent`, `not_provided`, `check_failed`, `conflicting` for cooling/heating; corresponding control states);
- the percentage at each scope (`property`, `room_category`, `selected_room_rate`);
- the percentage with an operating qualification and observed time; and
- the percentage meeting the full selected-room confirmation threshold.

Segment all rates by provider, endpoint/funnel surface, and cache-versus-live source where available. Do not combine property-level availability with selected-room confirmation, and do not count missing or failed evidence as explicit absence.

### 2. Comparison abandonment and reversal

Establish an eligible comparison session when at least two hotel options are rendered and climate evidence or an explicit unavailable state is exposed. Measure the share that then reaches a hotel detail, opens another hotel, proceeds to review, changes search criteria, or ends without another observable decision action.

An ended session is a **comparison abandonment candidate**, not proof that climate caused it. Count it as climate-attributed only when the traveler selects a bounded climate reason or a moderated task captures that reason. Compare behavior across confirmed selected-room, property-only, mixed, and unavailable-evidence cohorts while controlling reporting for provider and result count. Do not infer motivation from dwell time alone.

### 3. Provider-handoff return and mismatch

Use the existing handoff continued/returned sequence and away-duration buckets as the denominator for returns, then add an optional structured reason that separates:

- cooling not available or not as stated;
- heating not available or not as stated;
- room-level adjustment not confirmed;
- climate evidence missing on the provider; and
- prefer not to say.

Report climate-specific reasons per eligible returned handoff. A return without a selected reason remains unattributed. The current broad “other hotel details” reason must not be retrospectively reclassified as climate-related.

### 4. Primary validation signal: certainty comprehension

In first-use usability tasks, show travelers examples of selected-room confirmation, property-only evidence, explicit absence, and unavailable evidence. Measure whether they correctly answer:

- whether cooling is confirmed;
- whether heating is confirmed;
- whether the guest can adjust the room temperature; and
- whether each answer applies to the property generally or the room/rate under consideration.

Treat any interpretation of property-only or unavailable evidence as a selected-room guarantee as a failure. Pair comprehension accuracy with a comparison task in which the traveler must explain the evidence difference between two hotels; self-reported confidence alone is not sufficient.

## Constraints

1. **Factual scope and data integrity:** all facts must flow through `lib/providers` and retain provenance, scope, freshness, and conflicts. Never infer climate equipment or control from weather, geography, season, property photos, reviews, hotel class, price, or another amenity. Never convert missing evidence into explicit absence.
2. **No subjective comfort promise:** describe provider-stated equipment and control only. Do not claim that a room will be cool, warm, comfortable, quiet, reliable, effective, or maintained at a particular temperature. Weather forecasting, indoor-condition prediction, and post-stay comfort quality are outside scope.
3. **Decision-flow accessibility and performance:** any later comparison or room-detail treatment must remain distinguishable without color, keyboard- and screen-reader-usable, and readable at 375px and 1280px without displacing price, Deal Score, and provider handoff hierarchy. Evidence collection must respect the six-hour normalized-query cache contract and must not introduce component-level vendor calls.

## Scope boundary

This ticket defines the decision problem, minimum evidence, evidence threshold, and measurement requirements. It does not authorize a filter, ranking change, new provider, provider scraping, weather data, smart-room controls, climate equipment quality scores, subjective comfort claims, room booking inside expaify, or changes to Deal Score.

If UXR finds that providers expose only property-level air-conditioning or heating amenities, the honest shippable outcome is a clearly scoped property fact plus an explicit selected-room/control evidence limitation. It is not authorization to infer room-level control.

## Success statement

This is solved when a first-time traveler can compare hotels and inspect a room option, then correctly distinguish cooling, heating, and guest-adjustable controls confirmed for that room from property-only, explicitly absent, or unavailable evidence—without treating missing evidence as absence or a property amenity as a room-level comfort guarantee.

## UXR handoff requirements

`UXR-HOTEL-CLIMATE-CONTROL-01` must read this report and produce `docs/pipeline/hotel-climate-control/02-research.md`. It must:

1. audit actual active-provider search, property-detail, and room-detail capabilities or representative payloads for cooling, heating, individual controls, scope, seasonal qualification, source wording, and freshness;
2. calculate evidence coverage by provider and scope using the taxonomy above, explicitly separating unsupported, not returned, check failed, conflicting, and explicitly absent evidence;
3. audit the current comparison, expanded hotel detail, saved-deal detail, booking context, and analytics paths, including what can and cannot be observed after provider handoff;
4. compare one or two established hotel-booking patterns at the interaction level for property amenities, room-specific attributes, individually controlled versus central systems, and unknown evidence;
5. validate the comprehension test and privacy-bounded climate-abandonment/mismatch measurement, then produce 3–5 specific, testable design directives without authorizing subjective comfort or weather claims.

## Blockers and out-of-scope findings

- **Provider evidence blocker:** the inspected normalized adapters do not currently map climate attributes or selected-room details. UXR needs representative provider payloads or documentation to establish real supplier coverage; code inspection alone supports only the 0% normalized-contract baseline.
- **Room-detail blocker:** the current search result is a property offer and expaify hands room selection to the provider. Selected-room confirmation cannot be populated until an approved provider contract exposes room/rate-level attributes.
- **Measurement blocker:** expaify can observe provider returns but not provider-side room comparison or completed stays. Climate causation requires an explicit, optional reason or moderated research; raw exits, dwell, and away duration are not causal evidence.
- **Out of scope:** weather forecasts, outdoor-temperature alerts, review mining, photo interpretation, thermostat integrations, HVAC performance or noise ratings, air-quality claims, and inferred comfort recommendations.

## Handoff

Create `UXR-HOTEL-CLIMATE-CONTROL-01` with this report path and the user pain point embedded. The research ticket must preserve the three-dimension separation, evidence hierarchy, provider-level coverage requirement, and prohibition on subjective comfort claims.
