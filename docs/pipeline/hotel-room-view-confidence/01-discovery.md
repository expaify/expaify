# UX Discovery — Hotel room-view confidence

**Ticket:** UXD-HOTEL-ROOM-VIEW-CONFIDENCE-01  
**Stage:** UXD (Discovery)  
**Priority:** P2  
**Date:** 2026-07-31  
**Method:** Static audit of the hotel result card, expaify hotel review, provider adapter, shared hotel contract, analytics schema, and adjacent photo/request work. No production analytics, provider-room payload, user interviews, or post-booking records were available at this stage.

## User pain point

A traveler can mistake a view mentioned in a provider room-category name or suggested by a property photo for the view guaranteed with the room they are about to book, because expaify does not carry or explain the evidence, scope, or certainty of any room-view claim before provider handoff.

This is a decision-integrity problem, not a request-entry problem. “Ocean view” as an explicit attribute of a selected, available rate is materially different from “ocean-view room requested,” “partial ocean view,” a room category that merely uses view language, or a generic property image showing the ocean. Those states can affect willingness to pay, but they are not interchangeable.

## Who is affected, and where

The primary affected user is a traveler for whom the outlook is part of the purchase—such as someone paying more for an ocean, landmark, mountain, garden, or city view—while comparing room options and deciding whether a rate justifies its price.

The affected path is **hotel detail → room/rate comparison → booking handoff**. In the current product, however, only the first and last of those steps exist inside expaify:

1. `app/components/HotelCard.tsx` shows a property-level hotel offer and an unlabeled property photo, then offers **Review hotel**.
2. `app/book/BookingFlow.tsx` tells the traveler to **Check rooms with provider** and states that the provider confirms room details and live availability.
3. The traveler compares and selects actual rooms on the provider site. expaify receives no selected room, room-view attribute, or booking confirmation afterward.

The confidence gap therefore becomes most consequential during provider room comparison and at the handoff back-and-forth: the user must decide whether view language describes guaranteed inventory or only a preference, but expaify supplies no durable interpretation rule or view-specific mismatch path.

## Evidence in the current implementation

The existence of the gap is structural; its behavioral magnitude is not yet measured.

- `HotelOffer` in `lib/types.ts` has no room name, room category, selected-room identifier, rate identifier, view attribute, view scope, or certainty field. It carries only a single optional `photoUrl` at property level.
- `lib/providers/hotellook.ts` normalizes a lowest-price hotel result, not bookable room inventory. Its current response mapping provides the hotel identity, property context, `priceFrom`, and a property photo; it cannot establish which room the price buys or what view that room guarantees.
- The current handoff is honest but generic: `app/book/BookingFlow.tsx` says the provider confirms “room details” and “live availability.” It does not teach the specific distinction between a guaranteed room attribute and a request subject to assignment.
- The adjacent photo audit in `docs/pipeline/hotel-photo-match/01-discovery.md` establishes that the current image is a single representative property photo with no room/rate association. It cannot serve as evidence for a room view.
- The shipped Special requests guidance names “quiet room” and “high floor” and explains that requests are not guaranteed, but it does not cover room-view terminology. This ticket must reuse that certainty boundary rather than add another request workflow.
- Existing return feedback distinguishes broad `room_availability_mismatch` and `smoking_policy_or_room_mismatch` reasons. Neither isolates a view expectation mismatch, and expaify has no booking-completion record with which to calculate a post-stay mismatch rate.

## Measurable signals

No production baseline was supplied, and current events cannot isolate room-view interpretation. UXR should establish the following signals without treating an outbound click as proof of a successful choice:

1. **Room-option comparison behavior:** among handoff sessions that return to expaify, compare away-duration buckets and repeat provider handoffs for offers where a provider exposes view-labeled room options versus those where it does not. If provider-side room-option events are unavailable, record this as an external-measurement limitation rather than inferring comparison from dwell time alone.
2. **View-related selection change:** in task-based research or a provider-supported room funnel, measure the share of travelers who change their selected room or rate after learning that a stated view is partial, request-only, unspecified, or not guaranteed. The current expaify contract cannot observe this directly.
3. **Certainty comprehension (primary release guardrail):** after seeing each proposed state, measure whether users correctly identify it as **guaranteed for the selected room**, **request only**, or **not confirmed**. Reading either of the latter two as guaranteed is a failure.
4. **Post-handoff expectation mismatch:** add a privacy-bounded return-feedback reason for “Room view did not match” only if downstream research confirms sufficient volume and a reliable collection point. Track the rate per eligible returned handoff, not raw counts, and do not claim a post-stay outcome when only a provider-page discrepancy was reported.
5. **Comparison confidence:** in usability tasks, measure whether a first-time traveler can choose between two differently priced room options and accurately explain what view, if any, the higher price secures. Pair task accuracy with selection-change behavior; self-reported confidence alone is not enough.

## Constraints

1. **Retain provider naming without promoting it to proof.** Preserve the provider’s room/category name verbatim when one becomes available, but treat it as supplier language. Do not rewrite, strengthen, or infer a view from words in the name; never infer a view from property location, room price, amenities, or hotel name.
2. **Separate imagery from bookable evidence.** The existing `photoUrl` is property-level and must remain labeled as representative property imagery. A photo may support a view claim only when provider metadata explicitly associates it with the selected room/rate and identifies what it depicts; visual interpretation alone is never evidence.
3. **Promise only the certainty the inventory supports.** “Guaranteed” is permitted only for an explicit view attribute attached by the provider to the selected room and rate for the traveler’s dates. Request/preference language must say it is not guaranteed; missing, ambiguous, conflicting, or property-level evidence must fall back to “not confirmed.” All new data must pass through `lib/providers` as `Result<T>`, and 375px/mobile and 1280px/desktop comprehension must remain intact.

## Concise recommendation for UXR to validate

Use a three-part presentation rule, not a single “View” badge:

- **Label:** retain the provider room name, then give the view a separate certainty label: **Guaranteed room view**, **View request only**, or **View not confirmed**.
- **Evidence:** show the exact provider-returned view term, its scope (selected room/rate versus property/category), and provider attribution. A representative property photo is explicitly excluded from this evidence.
- **Fallback wording:** **“View not confirmed for this room. Photos may show the property or other room categories. Confirm the room’s view with the provider before booking.”**

These are discovery-level semantic candidates, not final UI copy. UXR must test whether travelers can distinguish the three states, determine whether provider room-name language can safely sit beside normalized evidence, and identify the shortest fallback that prevents false certainty without making an unverified negative claim.

## Success statement

This is solved when a first-time traveler can compare view-labeled room options and correctly tell whether a view is guaranteed for the selected room, merely requestable, or not confirmed—without treating the provider room name or property imagery as proof—and reaches the booking handoff with no false expectation that expaify or the hotel has promised a specific outlook.

## UXR handoff

`UXR-HOTEL-ROOM-VIEW-CONFIDENCE-01` should:

1. Audit the provider and booking contracts for any room/rate-level name, view attribute, certainty, and image-association data; document the honest current state if none exists.
2. Compare one or two established hotel-booking patterns at the interaction level: how they distinguish named room categories, explicit view attributes, request-only preferences, partial/obstructed views, and representative photos.
3. Test the three certainty labels and fallback wording for comprehension, including provider names such as “Ocean View King” when no separate guarantee exists.
4. Define evidence precedence and conflict handling for room name, structured room/rate attributes, category copy, imagery, and provider confirmation.
5. Define privacy-bounded measurement for room comparison, view-related selection changes, and view-specific return mismatch without implying expaify observes completed bookings.

## Blockers and out-of-scope findings

- **Data blocker:** the current Hotellook hotel-level offer cannot support a guaranteed room-view claim or internal room comparison. UXR may specify an honest unsupported/fallback state, but any populated state depends on a future provider contract with room/rate-level evidence.
- **Measurement blocker:** expaify does not observe provider-side room selection or completed hotel stays, and current feedback reasons do not isolate room-view mismatch.
- **Out of scope:** adding live room inventory, changing provider APIs, building a room selector, interpreting photos with computer vision, collecting free-text requests, promising a particular floor/room number, or reworking the existing property-photo and Special requests initiatives.
