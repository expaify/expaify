# UXD-HOTEL-LUGGAGE-STORAGE-01: Hotel Luggage-Storage Confidence Discovery

Date: 2026-07-31  
Stage: UX Discovery  
Priority: P2  
Feature slug: `hotel-luggage-storage`

## User Pain Point

A traveler arriving before check-in or leaving after checkout cannot tell before the booking handoff whether a property reports luggage storage for the relevant period or may charge for it, so an otherwise suitable hotel remains a risky choice until the traveler investigates elsewhere or arrives at the property.

## Who Is Affected And Where

This affects travelers whose transport and room-access times do not align: morning flight or train arrivals, evening departures, families or groups carrying several bags, travelers with mobility constraints, and anyone for whom paying for off-site storage would materially change the convenience or value of the stay.

The affected decision begins while comparing hotel fit, becomes material in hotel detail, and must be resolved as far as the evidence allows before the outbound booking handoff. In the current product, the relevant surfaces and boundaries are:

- `app/components/HotelCard.tsx`, where a traveler scans and expands a hotel result before choosing `Review hotel`;
- `app/book/BookingFlow.tsx`, where `HotelHandoffReview` sends the traveler to an external provider through `Check rooms at {partner}`;
- `lib/types.ts`, where `HotelOffer` defines which property facts can survive into those surfaces; and
- `lib/providers/hotelAmenityEvidence.ts`, where a fixed amenity catalog is normalized before reaching the UI.

expaify does not select a room, complete the reservation, message a property, or receive a post-booking storage confirmation. The decision this ticket can support is therefore narrower: whether the property has supplied enough evidence for the traveler to keep, reject, or verify the hotel before leaving expaify.

## Current, Measurable Signal

The current code establishes a real evidence gap, but there is no production behavioral baseline that proves its size:

1. `HotelOffer` has no luggage-storage field and cannot represent before-check-in versus after-checkout availability, operating times, possible charges, usage conditions, provenance, or an explicit not-returned state for this policy.
2. `HotelAmenityEvidence` is structurally capable of carrying a generic property fact, but `lib/providers/hotelAmenityEvidence.ts` accepts only seven access facts. Luggage storage is not in that catalog, so an unknown amenity id is discarded rather than normalized.
3. `HotelCard` and `HotelHandoffReview` show no luggage-storage evidence. The only adjacent message is generic special-request guidance that names early check-in; it neither claims nor answers whether bags can be held when the room is unavailable.
4. Hotel search carries check-in and checkout **dates**, not arrival time, room-access time, or departure time. Existing analytics can observe hotel-detail views, section reach, handoff starts, handoff views, back clicks, continues, and returns, but cannot identify an early-arrival or late-departure cohort or attribute an exit to storage uncertainty.

Baseline: normalized storage-evidence coverage and on-platform storage-decision coverage are both **0%**. Demand, decision impact, and the share of hotel sessions with a timing mismatch are **unknown** and must not be inferred from generic exits.

Research should establish the minimum worthwhile evidence and placement with the following signals:

- **Evidence coverage (supply gate):** among normalized hotel offers, the share for which a provider can return, separately, property-reported storage availability, applicability before check-in, applicability after checkout, relevant hours or cutoff wording, and charge state. Report complete, partial, explicit-unavailable, conflicting, and not-returned states separately by provider. Missing data must not count as unavailable or free.
- **Storage-evidence interaction:** among eligible exposures, record whether the concise evidence was seen and whether details were opened, segmented by evidence completeness and early-arrival/late-departure intent. An open is diagnostic, not proof of confidence.
- **Decision confidence (primary traveler signal):** in a scenario-based usability task or an explicitly prompted intent sample, measure the share of first-time travelers who can correctly state (a) whether the property reports storage, (b) whether the report applies to their pre-check-in and/or post-checkout period, (c) whether a charge is reported, possible, or unknown, and (d) that property-level information is not a guarantee for their stay. Include a confidence rating only after testing factual comprehension; confidence without correctness is a trust failure.
- **Decision outcome:** after evidence exposure, record `keep`, `rule out`, or `verify` for the property and whether the traveler proceeds to handoff. A correct `verify` response to incomplete evidence is a successful safe decision, not abandonment.
- **Exit guardrail:** compare back-to-results, search refinement, handoff non-completion, and return-from-provider behavior by evidence state and intent cohort. Treat these as correlations unless the traveler explicitly selects storage uncertainty as the reason; do not label an unobserved exit “storage-related.”

Because the product currently has no timing-intent field, the first validation should use recruited early-arrival and late-departure scenarios or a small explicit research intercept. This ticket does not authorize adding itinerary-time inputs merely to create an analytics segment.

## Minimum-Evidence Hypothesis To Validate

A generic `Luggage storage` yes/no label is not sufficient. The smallest evidence set worth testing is:

1. **Property-reported service state:** reported available, explicitly unavailable, not returned, or unclear/conflicting.
2. **Timing applicability:** before check-in, after checkout, both, or not specified; include provider-supplied operating hours or cutoffs when present rather than inferring all-day access.
3. **Charge state:** included/no charge reported, paid or potential charge, or unknown. If an amount and basis are supplied later, money must use `{ priceCents, currency }`; “paid” alone must not imply a known amount.
4. **Conditions that change usability:** only supplier-reported material limits, such as same-day use, registered-guests-only, advance arrangement, or size/count limits. Do not invent standard hotel practice.
5. **Evidence boundary:** source, observed-at time when supplied, property-level scope, and visible language that the traveler must confirm current availability, timing, conditions, and charges with the property or booking provider.

UXR should reduce this set if evidence or comprehension testing shows a field does not change the decision. It should not reduce the model to a boolean if timing or charge ambiguity continues to cause false confidence.

## Placement Hypothesis To Validate

Placement is deliberately unresolved at discovery stage. Test the smallest hierarchy that provides evidence before the user commits:

- **Hotel detail before `Review hotel`** is the default candidate because the fact is decision-relevant but not universal, and it allows partial or unknown evidence to be explained without crowding every collapsed result.
- **Outbound review before `Check rooms at {partner}`** is the continuity candidate for travelers who selected the hotel; it should preserve the same evidence state rather than introduce a new claim at handoff.
- **Collapsed result scan** is justified only if research shows that travelers with explicit timing mismatch use storage as an elimination criterion and provider coverage is high enough to avoid making untagged hotels look unsuitable. Absence of a label must never imply absence of storage.

UXR must compare these placements and recommend the minimum one or two surfaces. Repeating the fact everywhere is not success; enabling a correct decision before handoff is.

## Constraints

1. **Property-provided information, never a service guarantee.** Every storage fact must enter through `lib/providers`, retain supplier/property attribution and scope, and distinguish reported policy from selected-stay confirmation. The UI must not infer availability from brand, class, reviews, location, early check-in guidance, or common hotel practice. Not returned means unknown, not unavailable.
2. **Timing and charges cannot be collapsed into a misleading amenity flag.** Before-check-in and after-checkout applicability may differ. “Storage available” must not imply 24-hour access, unlimited capacity, security, acceptance for a particular bag, or no charge. Any amount uses integer minor units `{ priceCents, currency }`; never a float or bare number.
3. **No concierge workflow in MVP.** Do not add bag-drop reservations, property messaging, request submission, storage inventory, claim checks, off-site storage marketplace links, or post-booking support. expaify may direct the traveler to verify with the property or provider but cannot imply it contacted either.
4. **Preserve the hotel decision hierarchy and accessibility.** At 375px and 1280px, storage evidence must not obscure price, Deal Score, location, core fit evidence, or the booking-review CTA. Status and uncertainty cannot rely on color or icon alone; disclosure must work by keyboard and assistive technology.
5. **Measure only observed intent and behavior.** Do not infer an early arrival, late departure, need for storage, or exit reason from dates, dwell time, route type, or provider return alone. Any intent segmentation or reason label must come from explicit user input or a controlled research scenario.

## Scope Boundary

This ticket owns the **pre-handoff luggage-storage confidence decision**: determining whether the minimum provider-backed evidence and its placement help a traveler with a known timing mismatch decide to keep, rule out, or verify a property.

Out of scope:

- guaranteeing, reserving, requesting, paying for, or confirming storage;
- collecting or transmitting bag count, dimensions, contents, or claim information;
- building property chat, concierge, post-booking, itinerary, or off-site storage workflows;
- treating early check-in or late checkout as equivalent to luggage storage;
- adding hotel ranking, filtering, or Deal Score inputs before evidence coverage and decision value are validated;
- adding a new hotel supplier, scraping property pages, or calling a vendor from a component; and
- changing adjacent parking, access, pet, smoking, room-request, or funds-policy surfaces.

## Success Statement

This discovery is resolved when research can make a clear ship-or-defer recommendation by identifying the smallest provider-backed evidence set and earliest necessary placement through which a first-time traveler arriving before check-in or leaving after checkout can correctly decide to keep, rule out, or verify a hotel without mistaking property-reported storage, timing, or charges for a guaranteed service.

## Handoff Requirements For UXR

`UXR-HOTEL-LUGGAGE-STORAGE-01` must read this report and produce `docs/pipeline/hotel-luggage-storage/02-research.md`. It must:

1. Audit `HotelOffer`, `HotelProvider`, the current hotel provider/cache normalization, `HotelAmenityEvidence`, `HotelCard`, `BookingHotelContext`, `HotelHandoffReview`, and hotel analytics to locate the smallest compatible provider-neutral evidence contract and the exact current measurement gaps.
2. Verify whether any available supplier response can support the five candidate evidence groups above. Quantify complete, partial, explicit-unavailable, conflicting, and not-returned coverage; do not substitute generic amenity marketing or industry practice for property evidence.
3. Compare one or two established hotel-booking patterns at the interaction level for result/detail/handoff placement, pre-check-in versus post-checkout wording, potential-charge treatment, and unknown evidence—not visual style.
4. Test the minimum-evidence and placement hypotheses with early-arrival and late-departure scenarios. Include comprehension, calibrated confidence, `keep`/`rule out`/`verify`, and exit-reason definitions that do not infer intent.
5. Produce 3–5 testable design directives **only if** evidence coverage and decision lift justify implementation. Otherwise recommend defer, state the failed gate, and identify what supply or user evidence would reopen the decision. Explicitly decide whether collapsed-result placement is warranted or harmful.

## Handoff

Create `UXR-HOTEL-LUGGAGE-STORAGE-01` with this report path and the problem statement embedded. Research must preserve the property-reported/non-guaranteed boundary, explicit unknown state, no-concierge constraint, and ship-or-defer decision gate.
