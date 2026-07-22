# UX Discovery — Hotel detail decision order

**Ticket:** UXD-HOTEL-DETAIL-DECISION-ORDER-01  
**Stage:** UXD (Discovery)  
**Priority:** P1  
**Date:** 2026-07-22  
**Method:** Static audit of the current hotel result card, saved-deal detail, hotel handoff review, shared hotel types, booking-context contract, and analytics hooks. No production analytics, usability sessions, or competitive review were available at this stage.

## Problem statement

Travelers cannot evaluate hotel fit, price value, and handoff readiness in one predictable pass because the verified facts needed to decide whether to inspect rooms are split across the hotel card, saved-deal detail, and provider-handoff review, forcing repeated scanning before the room-availability boundary.

## Who is affected, and where

The primary affected user is a first-time or infrequent hotel shopper who has selected a destination and dates, opens a hotel from results, and needs to answer three questions before leaving expaify: **Is this the right property? Is this rate genuinely good? What still must be confirmed before booking?** This user has little memory of where expaify places each fact and is most exposed to an unclear hierarchy.

The secondary affected user is a member returning to a saved hotel deal. They arrive on `/deals/[dealId]` with stronger price intent but still need to re-establish the property, location, stay timing, price freshness, and provider-confirmation boundary before continuing.

The affected flow begins when a traveler chooses **Review hotel** on a hotel result or opens a saved hotel deal. It ends when they reach and initiate the provider handoff to inspect live room availability. Expaify does not currently expose room inventory or room selection; therefore, “room-section engagement” means reaching the explicit provider-confirmation/room-availability entry and selecting **Continue to provider**, not interacting with an expaify room list.

## Evidence in the current implementation

The problem is structural and observable in source, though its behavioral magnitude still needs measurement:

- `app/components/HotelCard.tsx` presents property name, location evidence, hotel class or rating evidence, nightly price basis, Deal Score status, and a **Review hotel** action. More supporting evidence is hidden under **Details**.
- `app/book/BookingFlow.tsx` then presents hotel name, location, nightly rate, provider, price basis, currency, and offer reference before a separate provider-confirmation panel and **Continue to provider** action. Hotel identity and commercial facts are repeated, while Deal Score, quality evidence, stay dates, and freshness are not carried into this review.
- `app/deals/[dealId]/page.tsx` uses a different sequence: large photo; identity and stay window; price and freshness; provider links; price history; Deal Score; a second “Why this is a deal” price comparison; then stay details. This places decision-critical stay facts after the handoff and repeats hotel and price evidence.
- `HotelOffer` and `BookingHotelContext` contain no live room, bed, amenity, cancellation, occupancy, or final tax/fee fields. The current handoff correctly delegates those confirmations to the provider.
- `lib/analytics.ts` provides a generic tracker, but the audited hotel-detail and handoff surfaces do not emit the view, section-reach, back, or outbound-handoff events needed to establish the requested baseline.

The discovery conclusion is not that more content is needed. The same limited, verified facts need a stable decision order, and facts unavailable to expaify must remain explicit provider checks.

## Prioritized decision sequence to validate

This is the single sequence downstream research should test. It describes decision priority, not a final component or visual design.

1. **Confirm the property and stay context.** Hotel name first, followed by the best supported location precision and any already-known dates/night count. A traveler must know they are assessing the intended property and stay before interpreting price or quality.
2. **Judge the cost and whether it is a deal.** Show the integer-minor-unit nightly rate with currency and “before taxes and fees” basis, price freshness, then Deal Score/verdict with its confidence. This answers “what is it?” and expaify’s differentiating question, “is this actually a good price?”, together.
3. **Establish minimum hotel-fit confidence.** Present supported hotel class and verified/provider-qualified guest-rating evidence. Missing or unverified evidence should remain labeled as such. This is a fit check, not an invitation to add reviews or amenities.
4. **Set the room-availability boundary and next action.** State in one place that the provider confirms room details, live availability, final total, taxes/fees, and cancellation terms; immediately pair that boundary with the provider handoff. The offer reference and currency repetition are diagnostic/tertiary unless research finds users need them before proceeding.
5. **Offer supporting evidence on demand.** Price history, detailed score evidence, expanded location provenance, photo, and offer reference support verification after the core decision path. They should not interrupt the path to room inspection or repeat facts already understood.

The sequence deliberately excludes new room rates, reviews, amenities, photos, access information, and cancellation features. If a field is unavailable or unverified, downstream stages must not infer it to complete the sequence.

## Measurable signals and event hypotheses

No current production baseline was found in the audited code. UXR should first confirm analytics coverage and establish baseline rates by entry source and viewport before interpreting movement.

### Primary funnel

1. `hotel_detail_viewed` — one event per detail/handoff view; properties: `hotel_id`, `entry_source` (`search_result` or `saved_deal`), `viewport_group`, `has_dates`, `has_verified_guest_rating`, `score_state`, `price_freshness_state`.
2. `hotel_decision_section_reached` — fire once when at least 50% of a named section is visible for at least one second; properties include `section` (`identity_stay`, `price_score`, `fit_evidence`, `room_handoff`) and `position`.
3. `hotel_room_handoff_started` — fire on the outbound **Continue to provider** activation before navigation; include `provider`, `entry_source`, and `viewport_group`, but no raw URL or personal data.
4. `hotel_detail_back_to_results` — fire on the explicit back action; distinguish from external handoff and browser/tab abandonment where possible.

### Metrics

- **Room-section reach rate:** unique detail views reaching `room_handoff` / unique `hotel_detail_viewed`.
- **Booking handoff initiation rate:** unique `hotel_room_handoff_started` / unique `hotel_detail_viewed`.
- **Back-to-results rate:** unique explicit back actions / unique `hotel_detail_viewed`.
- **Decision-path depth:** median deepest named section reached. Raw 25/50/75/100 scroll milestones may be retained diagnostically, but named-section reach is the primary measure because page length can change.
- **Time to room handoff:** median elapsed time from detail view to handoff start, interpreted with handoff initiation and back rate so faster exits are not automatically labeled success.

### Testable hypotheses

- If identity/stay context and price/Deal Score are encountered before supporting detail, room-section reach will increase because users can resolve property and value questions without searching multiple sections.
- If provider-owned unknowns are consolidated immediately beside the handoff action, handoff initiation will increase without a rise in rapid back-to-results behavior because the next step and its uncertainty are clear.
- If repeated hotel/price facts and tertiary offer metadata stop interrupting the core sequence, the median number of sections traversed before handoff will fall while handoff initiation holds or improves.
- Mobile travelers at 375px will show the largest improvement in room-section reach because every duplicated or oversized section costs proportionally more scrolling; desktop 1280px is a required guardrail segment, not the assumed source of the problem.

These are hypotheses, not evidence of causality. UXR must define a comparison method and guard against treating an outbound click alone as a successful booking.

## Constraints the solution must respect

1. **Data and trust integrity:** Use only current, supported hotel and saved-deal fields. Money remains integer minor units with currency. Do not infer room availability, room type, occupancy, amenities, review data, cancellation terms, taxes/fees, total price, dates, or location precision. Affiliate markers and provider provenance must survive the handoff.
2. **Scope and ownership:** Reorder and simplify the decision path without duplicating or expanding the separate room-rate, review, amenity, photo, access, or cancellation workstreams. Provider-owned facts remain explicit confirmation tasks, and no external API may be called from a component.
3. **Usability, accessibility, and performance:** The sequence must remain comprehensible at 375px and 1280px, preserve semantic heading and keyboard order, expose a clear focus-visible handoff action, avoid sticky content covering page content, and avoid requiring new provider calls or heavier media to reveal the core decision facts.

## Success statement

This is solved when a first-time user can confirm the property and stay context, understand the nightly rate and Deal Score, assess the supported minimum quality evidence, and reach the live-room provider handoff without searching repeated or unrelated sections—and room-section reach and handoff initiation improve without increasing back-to-results behavior or weakening provider-confirmation language.

## UXR handoff

### Research questions

1. Which of the existing facts are true prerequisites for choosing to inspect rooms, and which are merely reassurance after intent is formed?
2. Do users understand the distinction between nightly rate, Deal Score/usual price, and the provider-confirmed final total when those facts are adjacent?
3. At what point do missing dates, rating evidence, freshness, or exact location become blockers rather than acceptable unknowns?
4. Does one consolidated provider-confirmation boundary create more clarity than repeating caveats beside price, summary, and CTA?
5. Does the same sequence serve search-result entrants and saved-deal entrants, or does one segment require a different emphasis while retaining the same hierarchy?
6. On 375px mobile and 1280px desktop, can users predict where room availability begins and return to results without losing orientation?

### Target segments

- **Primary:** first-time/infrequent hotel shoppers entering from search results with destination and dates, especially users unfamiliar with the property.
- **Secondary:** returning members opening a saved deal and deciding whether the observed price is still worth checking.
- **Required cuts:** mobile 375px vs desktop 1280px; verified vs missing/qualified rating evidence; fresh vs stale/unknown price; complete vs missing stay context. These are analysis cuts, not separate feature scopes.

### Research guardrails

- Test information priority and comprehension, not visual preference.
- Use only facts available in the current contracts; unavailable facts must be represented as provider confirmations, not fabricated prototype content.
- Treat provider handoff as entry to room inspection, not proof of room availability or completed booking.
- Keep adjacent review, amenity, photo, access, cancellation, and room-rate initiatives out of scope; record dependencies without solving them here.

## Blockers and out-of-scope findings

- **Measurement blocker:** the requested scroll depth, section reach, back-to-results, and handoff-initiation baseline cannot be calculated from current code because the relevant events are not emitted on these surfaces and no production analytics dataset was provided.
- **Product-boundary clarification:** expaify has a hotel provider-handoff review, not an internal room-availability section. Downstream work should use the provider-confirmation/handoff boundary as the measurable room-entry proxy unless a separately approved feature adds live rooms.
- **Out of scope:** changing provider contracts, adding fields, redesigning hotel cards, room selection, new review/amenity/photo/access/cancellation content, Deal Score math, booking completion, or provider API work.
