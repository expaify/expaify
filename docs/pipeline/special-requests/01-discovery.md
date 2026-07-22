# UXD-SPECIAL-REQUESTS-01: Hotel Special-Request Expectations

Date: 2026-07-22  
Stage: UX Discovery  
Priority: P1

## User Pain Point

A guest who needs a quieter room, a higher floor, rooms near each other, or an
early check-in has no place in expaify's hotel handoff to express that preference
or learn whether it will reach the property, so any future request control could
be mistaken for confirmed inventory or a guarantee rather than a non-binding
request that the provider or property must acknowledge.

## Who Is Affected And Where

This affects first-time hotel users after they have found a plausible deal but
before they commit time and personal information on a provider site. The need is
especially consequential for light sleepers, families or groups using multiple
rooms, and guests whose arrival time falls before standard check-in.

The affected path is **hotel result -> expaify hotel review -> provider handoff**:

1. `HotelCard` offers **Review hotel** when the nightly price and provider URL are
   valid (`app/components/HotelCard.tsx:400-419`, `:486-500`). It does not expose
   room inventory or a special-request entry point.
2. The `/book` hotel review repeats hotel identity, location, provider, nightly
   price, currency, and price basis (`app/book/BookingFlow.tsx:159-195`). It then
   tells the guest that the provider must confirm room details and live
   availability before payment (`app/book/BookingFlow.tsx:481-504`).
3. **Continue to provider** opens the affiliate/provider URL in a new tab
   (`app/book/BookingFlow.tsx:505-517`). expaify does not complete the hotel
   reservation and receives no booking confirmation or property response.

There is therefore no room-selection step inside expaify today. The product
preserves a hotel-level offer for review, not a selected room or rate plan. The
special-request problem belongs at this review-to-provider boundary; describing
it as room selection would overstate the current product contract.

## Current Evidence And Expectation Gap

- `BookingHotelContext` contains only hotel/offer identity, provider, name,
  optional location, integer-cent nightly price, currency, price basis, and the
  provider URL (`lib/booking/config.ts:18-29`). It has no stay dates, room count,
  selected room, request values, delivery status, or property acknowledgement.
- Context validation and URL parsing preserve exactly those fields and no request
  payload (`lib/booking/config.ts:276-337`). A checked preference could not
  currently be proven to reach either the provider or the property.
- The existing handoff copy correctly says the provider confirms room
  availability and terms, but it says nothing about how to make a request, when
  to make it, whether it was transmitted, or how acknowledgement differs from a
  guarantee.
- No support/help action exists in the hotel review. A guest who cannot find a
  request path can only go back to search or continue to the provider.
- `track()` is development-only logging (`lib/analytics.ts:1-7`), and the hotel
  result/review flow emits no request, handoff, or support-intent events. The repo
  therefore contains **no production evidence** for request usage, expectation
  mismatch, or request-driven support intent. Discovery must not invent a
  baseline.

The trust risk has two sides: silence forces guests to rediscover the need after
handoff, while an expaify checkbox without an evidenced delivery path would imply
more control than the product has. The experience must distinguish four states:
**preference selected, request transmitted, property acknowledged, and request
guaranteed**. In the current architecture, expaify can evidence at most the first
state; it must not imply the other three.

## Measurable Signal And Validation Plan

The current structural signal is complete absence: zero request fields, zero
request controls, zero transmission mechanism, zero acknowledgement state, and
zero related analytics events in the hotel handoff.

UXR should establish a baseline and validate the problem with these measures:

1. **Request usage:** among users who reach hotel review, the share who select at
   least one structured request, plus selection rate by request type. This must
   be measured separately from the share who continue to the provider.
2. **Expectation mismatch:** in task-based comprehension testing, the share who
   incorrectly answer either "the room is guaranteed" or "expaify sent this to
   the hotel" after selecting a request. Any such answer is a failure. Also
   capture later reports that a request was not honored, but do not treat the
   report itself as proof that a request was transmitted.
3. **Support-contact intent:** the share of request users who choose an explicit
   **How requests work / Get help** action, abandon the review after opening that
   guidance, or seek provider/property contact instructions. No such action is
   present today, so UXR must define a measurable proxy before claiming an
   improvement.
4. **Qualified handoff:** completion of **Continue to provider** after the guest
   has seen the non-guarantee message, segmented by no request versus one or more
   requests. The goal is informed continuation, not maximizing clicks at the
   expense of comprehension.

Instrumentation must avoid request free text, medical/accessibility details, or
other sensitive content. Event properties should use only a fixed request ID,
count, surface, and delivery-capability state. UXR should recommend precise
events and a real production analytics sink; the current development logger
cannot measure these signals.

## MVP Boundary

The research and design stages may validate a **small structured set only**:

- Quiet room.
- High floor.
- Early check-in.
- Rooms near each other **only when a provider-backed room count greater than one
  is available**; the current hotel context cannot meet this condition.

These are preferences, not inventory attributes. No free-text request box,
specific room/floor selection, accessibility or medical request collection,
late checkout, amenities, bed/occupancy selection, property messaging inbox, or
post-booking request management belongs in this MVP.

Most importantly, selection must not masquerade as delivery. Unless UXR finds a
provider-supported request parameter or an acknowledged property messaging path,
the safe MVP is expectation-setting and provider-directed guidance, not a form
that claims to send requests. The persistent meaning must be: **requests depend
on availability; selecting one does not guarantee it; confirm on the provider
page and with the property.** Final copy and placement belong to UXDES after UXR
tests comprehension.

## Constraints

1. **Truthful request state and provider boundary.** Never label a preference as
   selected inventory, sent, received, confirmed, or guaranteed without evidence
   for that exact state. Any transmission must use a provider-supported contract
   through `lib/providers`; affiliate markers on the outbound URL must remain
   intact.
2. **Minimal, non-sensitive scope.** Use the fixed candidate set above and no
   free text. Do not collect accessibility/medical details, duplicate room-fit or
   policy work, or show multi-room requests without verified room-count context.
3. **Clear, accessible handoff.** Non-guarantee and who-to-contact guidance must
   be perceivable before the provider CTA, usable by keyboard and screen reader,
   and readable without crowding the existing review at 375px or 1280px. Request
   choice cannot block booking or suggest that expaify controls availability.

## Success Statement

This is solved when a first-time hotel guest can identify whether and where to
make one of the supported requests, understand before continuing that expaify has
not guaranteed it and—unless explicitly evidenced—has not sent it to the
property, and know to confirm it with the provider/property, without mistaking a
preference for selected room inventory.

## Boundaries With Adjacent Pipeline Work

- `hotel-access-requirements` owns factual access logistics and the distinction
  between guaranteed versus requestable room attributes (including ground-floor,
  near-elevator, and connecting-room needs). This ticket owns **how a guest
  communicates a limited non-binding request at handoff and understands its
  delivery state**. UXR must reuse, not redefine, that certainty language.
- `guest-room-fit` and `room-rate-clarity` own occupancy, beds, room/rate identity,
  and child policy. A special request must not compensate for missing room fit.
- `cancellation-policy` owns refundability and cancellation terms. Those are
  bookable rate conditions, not special requests.

## Required UXR Handoff

`UXR-SPECIAL-REQUESTS-01` should:

1. Audit the current hotel card, hotel review, provider URL contract, and any
   provider capability for transmitting or acknowledging structured requests.
2. Compare one or two established hotel-booking patterns at the interaction
   level: when requests are asked, how non-guarantee copy is paired with them,
   and how guests are told to contact the property.
3. Validate and rank the candidate request set by actual user need and provider
   feasibility; exclude adjacent-room requests unless room-count context exists.
4. Test comprehension of the four distinct states: selected, transmitted,
   acknowledged, and guaranteed. Produce exact pass/fail questions and targets.
5. Define production-ready measurement for request usage, expectation mismatch,
   qualified handoff, and support-contact intent without collecting free text or
   sensitive request content.

