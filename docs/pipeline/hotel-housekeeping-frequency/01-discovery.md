# UXD-HOTEL-HOUSEKEEPING-FREQUENCY-01: Hotel Housekeeping-Frequency Clarity Discovery

Date: 2026-08-03  
Stage: UX Discovery (UXD)  
Priority: P1  
Feature slug: `hotel-housekeeping-frequency`  
Method: Static audit of the current hotel offer, provider normalization, saved-deal detail, expaify review, and provider handoff. No traveler interviews, production analytics, property-policy sample, or provider coverage study was available at this stage; the decision questions below are hypotheses for UXR to validate, not claims about all guests.

## User pain point

A traveler booking three or more nights cannot tell before provider handoff whether their room will be serviced during the stay, how often, whether they must request or opt in by a deadline, or whether towels and bed linen follow a different schedule, because expaify carries no housekeeping-policy evidence and silence can be mistaken for daily service.

The trust failure is not simply a missing “housekeeping” amenity. “Housekeeping available” does not answer the stay-level expectation. Cadence, guest action, and towel/linen replacement are separate policy dimensions, and a property-wide policy may still vary by room, rate, stay length, day, or guest request.

## Who is affected and where

The primary affected users are travelers on stays of **three or more nights**, because a cadence or request rule can materially change their stay before checkout. The impact is higher for families, travelers with accessibility or health-related needs, guests working from the room, and anyone who needs predictable privacy or service; those needs must not be inferred from profile or trip type.

The failure spans the room-detail-to-booking decision:

1. **Results and property evaluation:** the live `DealCard` path shows hotel identity, dates, nightly price, Deal Score, and limited fit evidence, but no housekeeping expectation. A traveler cannot use expaify to distinguish a documented daily schedule from service every few nights, request-only service, no stayover service, or no returned policy.
2. **Hotel/room detail:** the saved-deal detail page shows the stay dates and night count, but its “Hotel fit” section contains hotel class, guest rating, disruption, and quiet-stay evidence only. The separate expanded `HotelCard` has multiple policy panels but no housekeeping or linen policy. Neither surface explains whether a property policy applies to the prospective room or selected stay.
3. **expaify review:** `BookingHotelContext` can preserve `checkIn`, `checkOut`, and `nightCount`, but has no housekeeping evidence. `HotelDecisionSummary` therefore cannot repeat what the traveler learned or disclose that the expectation remains unverified.
4. **Provider room/rate handoff:** expaify sends the traveler to the booking partner to inspect room options. A cadence, opt-in cutoff, fee, or linen rule may first appear there, after the property has already been chosen. The current handoff analytics record only that the traveler left, not whether policy uncertainty or a newly discovered rule caused the exit or a later reversal.

## Current product evidence

- `HotelOffer` has no housekeeping-policy field. `BookingHotelContext` has no field that could preserve such a policy into review.
- `HotelAmenityEvidence` supplies reusable provenance primitives—status, property/room/rate/selected-stay scope, source, freshness, fee, confidence, and certainty—but the active normalizer allowlists only elevator, parking, step-free-route, and room-request facts. An incoming housekeeping fact would be discarded as an unknown identifier.
- The Booking.com and Hotelbeds search adapters call the amenity normalizer with no amenity payload. The audited Hotellook path accepts a generic passthrough but routes it through the same restrictive normalizer. None of the audited provider contracts defines stayover-cleaning cadence, request rules, cutoffs, service days, towel replacement, linen replacement, or selected-stay exceptions.
- The live deals surface uses `DealCard`; the richer `HotelCard` is exercised by tests but is not mounted by the live deals route. The saved-deal detail is a third presentation path. UXR must identify the authoritative room-detail-to-booking surface before placement is specified.
- `nightCount` exists in saved-deal and booking continuity contracts, so a three-or-more-night state is representable when dates are complete. The general search result's `checkInWindow` is display text rather than a policy applicability guarantee.
- Existing analytics include `hotel_result_card_opened`, `hotel_detail_viewed`, `hotel_decision_section_reached`, `hotel_room_handoff_started`, and `hotel_detail_back_to_results`. There is no housekeeping-policy impression/open, expectation confirmation, uncertainty reason, or policy-attributed reversal event. `lib/analytics.ts` logs only in development, so no production behavioral baseline can be derived from the repository.

The defensible structural baseline is therefore **0% of current normalized hotel offers with representable housekeeping cadence or linen-change evidence**, **0% continuity into expaify review**, and **no measurable policy-attributed confusion or reversal rate**. This is a statement about expaify's contract, not proof that a property provides or withholds service.

## Decision questions to validate

For a stay of three or more nights, UXR should test whether travelers need the following questions answered, in this order, to form an accurate expectation:

1. **Will stayover room service occur?** Documented service, documented no stayover service, or not established.
2. **What is the cadence?** Daily; on named days; every stated number of nights/days; once during the selected stay; on request only; no stayover service; or not specified. “Regular,” “limited,” and “periodic” are ambiguous unless the provider defines them.
3. **What must the guest do?** Automatic; opt in/request required; opt out/decline available; request channel and deadline stated; or action not specified. A door sign or “Do Not Disturb” convention must not be invented when the provider did not disclose it.
4. **What is refreshed?** Room cleaning, towels, and bed linen must be separate. Towels or linen “on request” does not establish cleaning on request, and room cleaning does not establish either replacement cadence.
5. **Does the rule apply to this stay?** Property-level policy, room/room-type policy, rate policy, or selected-stay confirmation; plus any provider-stated exceptions such as length-of-stay thresholds, service-free days, fees, or dates. Property policy must not be promoted to a selected-room guarantee.

These questions define the information need, not a prescribed component, icon set, filter, or ranking rule.

## Minimum evidence-labeled expectation model

Research should validate the smallest model that can state an expectation without overpromising. A positive or negative service statement is usable only when all required evidence travels together.

### Policy dimensions

| Dimension | Safe normalized values to investigate | Unsafe shortcut |
| --- | --- | --- |
| Stayover service | `documented`, `documented_none`, `not_established` | “Housekeeping” amenity present |
| Cleaning cadence | `daily`, `named_days`, `every_n_nights`, `once_per_stay`, `on_request`, `none`, `not_specified`, `ambiguous` | “Regular” translated to daily |
| Guest action | `automatic`, `request_required`, `opt_out_available`, `not_specified`, `ambiguous` plus provider-stated channel/cutoff | Assuming a request can be made at any time |
| Towel change | `same_as_cleaning`, `separate_stated_cadence`, `on_request`, `none`, `not_specified`, `ambiguous` | Treating fresh towels as full cleaning |
| Linen change | `same_as_cleaning`, `separate_stated_cadence`, `on_request`, `none`, `not_specified`, `ambiguous` | Treating bed-making as linen replacement |
| Applicability | `property`, `room`, `rate`, `selected_stay` plus disclosed exceptions | Property rule presented as selected-stay confirmation |

The exact canonical vocabulary remains a UXR question. Provider wording should be preserved whenever a normalized value would lose a timing rule, condition, exclusion, or ambiguity.

### Evidence labels

Every expectation must carry one of these visibly distinct evidence states:

- **Confirmed for selected stay:** a provider statement is tied to the selected dates and room/rate or otherwise explicitly resolves applicability for this stay. This supports an expectation, not a guarantee that staff will perform the service exactly as scheduled.
- **Property or room policy:** provider-supplied policy has a clear scope but is not confirmed for the selected stay. Present the scope and direct the traveler to verify exceptions before payment.
- **Ambiguous or conflicting:** wording exists but cadence, action, scope, or two current statements cannot be reconciled without inference. Preserve the relevant wording and do not produce a positive summary.
- **Not returned:** the provider returned no usable policy. Missing must not mean daily, request-only, or unavailable.
- **Check failed:** the policy could not be retrieved or validated. A technical failure must remain distinct from provider silence.

Source label and observed/fetched time must accompany confirmed policy where supplied. The model describes **disclosed service policy**, not room cleanliness, sanitation, enforcement, staff performance, sustainability quality, or the lived experience of a future stay.

## Measurable signal

### Structural and coverage measures

- **Dimension coverage:** share of displayed offers with usable evidence for stayover service, cleaning cadence, guest action, towel change, linen change, and scope, reported separately by provider. Do not count a generic amenity as cadence coverage.
- **Selected-stay coverage:** share of stays of 3+ nights for which all applicable dimensions are confirmed for the selected room/rate/dates. Property-level policy is a separate, weaker numerator.
- **Continuity coverage:** share of usable policy records shown in detail that survive unchanged into expaify review and the final provider handoff disclosure.
- **Conflict/missing rate:** separate shares for ambiguous, conflicting, not returned, and check failed. Combining them into “unknown” would hide different trust and remediation problems.

### Prototype or later instrumented outcomes

- **Expectation comprehension:** after viewing the disclosure, the traveler correctly states whether service occurs, its cadence, whether action is required, and whether towels/linen follow a separate rule. The primary benchmark is accuracy for 3+ night stays, not recall of UI terminology.
- **Time to correct expectation:** time from opening room/property detail to a correct four-part answer. Compare with a control that exposes only provider wording or no disclosure.
- **Policy-confusion rate:** share of participants who interpret missing/ambiguous evidence as daily service, confuse request-only with automatic service, merge towels/linen with cleaning, or treat property policy as selected-stay confirmation.
- **Calibrated completion confidence:** confidence rating immediately before provider handoff, paired with comprehension. Higher confidence counts as success only when the expectation is correct; confidently wrong answers are a failure.
- **Late policy reversal:** share who change property, abandon, or return after learning a materially different cadence/action/linen rule at provider room selection. Distinguish a useful early rejection from a late surprise.
- **Qualified handoff completion:** provider handoff among travelers who saw the evidence or explicit missing state and correctly understood it. Conversion alone is not success if comprehension or calibration worsens.

Segment measures by stay length (`3–4`, `5–7`, `8+` nights), evidence state, policy scope, viewport (`375px`, desktop), and whether the traveler declares that predictable service or privacy matters. Do not infer that intent from disability, family status, or trip purpose.

## Constraints

1. **Disclosed policy only; no service promise.** Every fact must enter through `lib/providers` and retain source, wording where needed, scope, freshness, and applicable conditions. Do not infer cadence from stars, brand, property type, price, Deal Score, photos, general reviews, or a generic housekeeping amenity. Never promise that a stated schedule will be performed.
2. **Keep cadence, action, linens, and applicability separate.** Do not collapse automatic service, opt-in/request rules, towel replacement, linen replacement, and selected-stay applicability into one “daily housekeeping” badge. Missing, ambiguous, conflicting, and check-failed states must remain distinct, and property-level policy must not become a room/rate guarantee.
3. **Repair the existing decision path without displacing core hierarchy.** Reuse the current result → detail → expaify review → provider handoff flow and its stay-length continuity; do not change Deal Score, ranking, booking logic, or add a filter. Any later disclosure must be concise, understandable without color alone, keyboard accessible, and usable without overlap or decorative clutter at 375px and 1280px.

## Success statement

This is solved when a first-time user booking three or more nights can state, before provider handoff, whether stayover cleaning is documented, how often it is scheduled, whether they must request or opt in, and what is known separately about towel and linen changes—while correctly recognizing property-level, ambiguous, missing, or failed evidence—without assuming daily service or treating expaify's summary as a service guarantee.

## Boundaries with adjacent work

- **Hotel amenity provenance / amenity fit:** owns generic source and missing-data discipline. This ticket owns the time- and action-dependent housekeeping expectation; a generic amenity presence is insufficient.
- **Property type fit:** may set a traveler's prior expectation about service model but cannot supply policy evidence. Aparthotel, resort, hotel class, or brand must never determine cadence.
- **Room choice / rate clarity:** owns room identity and rate selection. This ticket consumes room/rate scope only to say whether a disclosed housekeeping rule applies.
- **Hotel rate inclusions / total stay cost:** owns what the displayed rate includes and price totals. If a provider explicitly states a housekeeping fee, this model must preserve it and defer price presentation to that work; it must not calculate or add charges.
- **Quiet stay / room access:** may be affected by service timing or room entry, but this ticket does not assess noise, privacy suitability, access accommodation, or staff behavior.

Out of scope: cleanliness or hygiene ratings; guest-review sentiment; staff performance or enforcement claims; sustainability judgments; housekeeping requests or scheduling inside expaify; provider integrations or scraping; a housekeeping filter; ranking or Deal Score changes; notifications during a stay; compensation or complaint handling; and UI implementation.

## Required UXR focus

The next stage must:

1. Audit the live `DealCard` and saved-deal detail paths, the separate `HotelCard`, `BookingHotelContext`/`HotelDecisionSummary`, provider live/cache normalization, and analytics to name the authoritative detail-to-handoff surface and exact data delta.
2. Sample current and plausible provider policy payloads. Report coverage independently for stayover service, cadence, guest action/channel/cutoff, towel change, linen change, scope, exceptions, fees, source, and freshness. Recommend stop/narrow/go if evidence cannot support a concise honest expectation.
3. Conduct targeted traveler research for stays of 3+ nights to validate decision order, terminology, comprehension, and calibrated confidence. Include automatic daily service, request-only service with a cutoff, separate towel/linen rules, no stayover service, ambiguous wording, conflicting statements, missing data, and retrieval failure.
4. Compare one or two established hotel-booking patterns at the interaction level across property detail, room/rate selection, and booking handoff, focusing on how cadence, opt-in rules, linen policies, scope changes, and missing evidence are communicated—not visual style.
5. Produce 3–5 testable design directives for hierarchy, concise summary rules, evidence labels, 3+ night applicability, missing/conflict/error states, continuity into review, 375px/1280px behavior, and the measurement events required to distinguish correct confidence from confident misunderstanding.

## Blockers and out-of-scope findings

- **Provider-evidence blocker:** the audited normalized contracts cannot currently carry any positive housekeeping, towel, or linen claim. Research can validate the expectation model, but implementation must remain provider-capability dependent.
- **Surface split:** live results use `DealCard`, while the richer policy-oriented `HotelCard` is not mounted by the live deals route; saved-deal detail is separate again. UXR must resolve the intended surface before UXDES specifies placement.
- **Measurement blocker:** no production feature analytics, traveler interviews, or provider-policy sample exists, so confusion, confidence, and reversal baselines require research or later instrumentation.
- **Terminology risk:** “housekeeping,” “room cleaning,” “service,” “towel refresh,” and “linen change” may be interpreted differently. UXR must validate plain-language labels rather than assume these are interchangeable.

## Handoff

Create `UXR-HOTEL-HOUSEKEEPING-FREQUENCY-01` with this report path and the user pain point above. Research must validate whether the minimum evidence-labeled model reduces confusion and improves correctly calibrated completion confidence for stays of three or more nights before recommending a UI treatment.
