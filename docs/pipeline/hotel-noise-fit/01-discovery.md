# UXD-HOTEL-NOISE-FIT-01: Hotel Quiet-Stay Fit

Date: 2026-07-22  
Stage: UX Discovery  
Priority: P1

## User Pain Point

A traveler who needs a quiet stay cannot distinguish provider-confirmed quiet-room availability from likely environmental noise exposure or missing evidence while comparing hotels, so they must leave expaify—or make a booking decision on an unsupported assumption—to judge whether a low-priced stay will be workable.

## Who Is Affected And Where

This affects paid-intent hotel travelers, particularly light sleepers, families with young children, business travelers needing rest before an early meeting, and guests with an early flight. It spans four decision points:

1. **Hotel discovery and comparison.** `HotelCard` presents price, Deal Score, quality, location, and a limited set of access evidence, but no signal for nightlife, airport, major-road, rail, or construction exposure; nor does it identify a quiet-room option (`app/components/HotelCard.tsx`). A user comparing similarly priced stays cannot tell whether a central or airport-adjacent location carries a relevant tradeoff.
2. **Detail evaluation.** Expanded card evidence is deliberately source-aware for existing facts, but `HotelOffer` and `HotelAmenityEvidence` contain no noise-exposure, soundproofing, quiet-room, or review-theme evidence (`lib/types.ts`). The user cannot inspect the basis, scope, source, or freshness of a quiet-stay claim.
3. **Hotel review before handoff.** The booking context passes property identity, price, provider URL, and location only (`lib/booking/config.ts`); `HotelSummary` repeats these facts without quiet-stay context (`app/book/BookingFlow.tsx`). Any useful evidence found during comparison is currently unable to accompany the decision boundary.
4. **Special-request handoff.** expaify sends the guest to the affiliate provider and does not reserve a room or receive a property acknowledgement. The existing special-request discovery correctly establishes that a preference is not a transmitted, acknowledged, or guaranteed request without an evidenced provider capability (`docs/pipeline/special-requests/01-discovery.md`). “Quiet room” therefore cannot be represented as confirmed room inventory or a fulfilled request.

## Current Evidence Gap

- The hotel provider normalizes price, location, quality, and limited amenity evidence, but no noise-related data is supplied by the current Hotellook path (`lib/providers/hotellook.ts`). A provider omission is not evidence that a property is quiet.
- `HotelAmenityEvidence` already separates status, scope, source, fetched time, confidence, and guaranteed versus requestable certainty (`lib/types.ts`). Its current access facts demonstrate the right trust model, but none applies to quiet-stay fit. Reusing the model blindly would be unsafe: proximity to an airport or nightlife is contextual, while a quiet-room request is room/stay-specific and cannot be inferred from a property-level amenity.
- Location data can be exact, coordinate-based, area-level, search-area-level, or missing (`HotelLocationPrecision`). It can support clearly framed contextual signals only when precision and a documented source permit it; an area label alone must not imply a measured distance from a road, airport, or nightlife district.
- `HotelCard` and the hotel handoff emit no quiet-stay interactions. Existing analytics emit handoff events, but `lib/analytics.ts` is development-only, so the repository provides no production baseline for quiet-stay signal use, request intent, or decision confidence.

## Measurable Signal And Validation Plan

The present structural signal is zero: no normalized noise evidence, no quiet-room availability/request capability, no presentation state, no persisted handoff context, and no production measurement for this decision.

UXR must establish a baseline and define privacy-safe instrumentation that measures:

1. **Quiet-stay signal use:** among hotel result viewers, the share who expand or inspect noise-related evidence, segmented only by evidence category and evidence state—not by free-text need or health information.
2. **Special-request intent:** among users who reach hotel review, the share who open quiet-room request guidance or select a provider-supported structured request, separated from provider-handoff completion. Record whether expaify can only offer guidance, can transmit a request, or has an acknowledgement; never infer delivery from a click.
3. **Decision confidence:** in usability testing, the share of users who can correctly state (a) what evidence is provider-confirmed, (b) what is contextual rather than property-controlled, and (c) what is unknown. Capture a confidence rating after comparing hotels, but treat self-report as directional rather than proof of accuracy.
4. **Overclaim comprehension failures:** the share who conclude that “quiet” is guaranteed, that an environmental signal predicts the specific room, or that a request reached the property when no evidence supports it. The target is zero false guarantees in task comprehension.
5. **Qualified handoff:** continuation to the provider after the user has seen the relevant uncertainty language, segmented by evidence availability. Success is an informed choice, not maximizing outbound clicks.

Instrumentation must use fixed evidence IDs/states and surface names only. It must not collect free-text sleep needs, medical/accessibility information, room numbers, or unlicensed review content. UXR must specify a production analytics destination before outcome claims are made.

## Constraints

1. **Truthful evidence classes.** Keep provider-confirmed property or selected-stay facts separate from contextual signals (for example, documented proximity based on sufficiently precise location data) and from review-derived guest opinion. Show source, scope, freshness, and uncertainty where available. Never call a property or room “quiet” based solely on its area, rating, price, or absence of negative data.
2. **No subjective guarantee.** A quiet-room preference is non-binding unless a provider-supported contract explicitly proves it is transmitted and/or guaranteed for the selected stay. Environmental context cannot predict a specific room, construction, neighboring guests, temporary events, or future noise.
3. **Provider and affiliate boundary.** New data must flow through `lib/providers` with `Result<T>` adapters; outbound deeplinks must retain affiliate markers. Do not scrape or display unlicensed reviews, maps, venue data, or inferred noise scores as verified facts.
4. **Usable comparison at every viewport.** At 375px and desktop, quiet-stay context must be concise, keyboard-accessible, and non-blocking. It must not displace price, Deal Score, location precision, or existing provider-confirmation disclosures; no color or icon alone may convey certainty.

## Success Statement

This is solved when a first-time hotel traveler can compare and review a stay using clearly labeled evidence about likely noise tradeoffs, understand whether a quieter-room preference is only guidance, requestable, transmitted, or guaranteed, and recognize when expaify lacks sufficient data—without mistaking contextual or incomplete evidence for a promise of a quiet room.

## Downstream Focus For UXR-HOTEL-NOISE-FIT-01

1. Audit the hotel provider contract and candidate licensed data sources for three distinct evidence classes: provider-confirmed quiet-room/sound-control facts, location-derived exposure context, and source-attributed guest-review themes. State what is actually available versus merely desirable.
2. Compare one or two established hotel-booking interaction patterns for presenting location tradeoffs and non-guaranteed room requests. Evaluate the pattern for comprehension, not visual imitation.
3. Define a small, testable evidence taxonomy and fallback states. Candidate contextual categories are nightlife, airport/flight-path, major-road/rail, and documented temporary works; none may appear without an attributable, appropriately precise source. Candidate room facts must retain property/room/selected-stay scope and certainty.
4. Define exact decision points and copy rules for comparison, expanded detail, and provider handoff, including unknown, unavailable, stale, conflicting, and insufficient-location-precision states. Coordinate with `hotel-location-decision-context`, `hotel-review-relevance`, `hotel-amenity-provenance`, and `special-requests` so source/provenance and request-state language are defined once.
5. Produce a production-ready measurement plan for signal use, quiet-room request intent, comprehension/overclaim failures, confidence, and qualified handoff, using only fixed non-sensitive event properties.

## Scope Boundary

This ticket discovers how to make a quiet-stay decision legible; it does not authorize an unverified noise score, live noise prediction, acoustic certification, free-text request collection, provider messaging, room assignment, or a claim that expaify can guarantee a quiet room. Those require separate evidence, provider capability, and approval.
