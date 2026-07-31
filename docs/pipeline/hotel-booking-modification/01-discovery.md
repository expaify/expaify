# UXD-HOTEL-BOOKING-MODIFICATION-01: Hotel Booking Modification Expectations

Date: 2026-07-31  
Stage: UX Discovery  
Priority: P1  
Persona: Senior UX Strategist

## Scope decision

This is an expectation-setting repair, not a post-booking product expansion. The
work owns the continuity of three facts from expaify's hotel review into the
partner handoff:

1. which company completes and manages the reservation;
2. where a traveler must go after booking to request a date, guest-detail, or
   room-selection change; and
3. what must be checked before payment because a later change may be restricted,
   repriced, or unsupported.

It does **not** authorize expaify to retrieve a completed reservation, display a
partner confirmation, accept a modification request, promise that a change is
allowed, or build a post-booking management portal.

## User pain point

A traveler can leave expaify knowing that a booking partner will complete the
reservation, but cannot reliably predict whether changing dates, guest details,
or the selected room after checkout is allowed, what the change may affect, or
which confirmation-owned support channel will handle it.

## Who is affected and where trust breaks

The problem affects any hotel shopper whose plans or booking details may change,
with the highest consequence for travelers booking non-refundable rates,
multi-night stays, more than one guest or room, or a room chosen for a specific
bed, access need, smoking status, or special request.

The break spans three consecutive moments:

- **Pre-booking policy cue:** on the expaify hotel review, immediately before the
  outbound action. The current page says that the provider shows the cancellation
  policy and terms, but it does not distinguish cancellation from modification,
  name the three common change types, or state that a change can trigger new
  availability, rate, taxes, fees, or conditions.
- **Checkout and confirmation:** on the partner site and in the confirmation it
  issues. expaify cannot observe or guarantee either surface. The current
  ownership disclosure says the partner provides the confirmation and is the
  first contact for changes, but expaify has no confirmation identifier, manage
  link, support route, or evidence that those details will be present.
- **Post-booking support boundary:** when the traveler returns with a change
  need. expaify cannot access, change, cancel, or refund a partner reservation,
  but that boundary is inside the collapsed **Who handles my booking?** control.
  A traveler can continue without demonstrating that they understand it.

## Current implementation evidence

The implementation has a sound ownership foundation but no modification-policy
contract.

- `app/book/BookingFlow.tsx` presents **Check rooms with provider**, says the
  provider confirms room options, live availability, final total, cancellation
  policy, and terms, then opens the affiliate partner URL in a new tab. expaify
  neither completes nor confirms the hotel booking.
- `app/components/HotelBookingOwnership.tsx` states that the booking partner is
  the first contact for reservation status, changes, cancellations, refunds,
  payment questions, or a missing confirmation. It separately states that
  expaify cannot access, change, cancel, or refund the reservation.
- That ownership content is collapsed by default. Existing analytics can record
  disclosure opening and outbound handoff activity, but not whether the traveler
  correctly understood the boundary.
- `BookingHotelContext` in `lib/booking/config.ts` preserves the selected hotel,
  observed nightly price, provider URL, stay dates when present, and several
  policy/evidence families. It carries no modification policy, modification
  channel, confirmation-management URL, booking reference, support contact, or
  change-cost evidence.
- `HotelOffer` and `HotelProvider` in `lib/types.ts` likewise have no normalized
  modification capability. A downstream design cannot truthfully label a rate
  **changeable**, estimate a change fee, or route a completed booking from the
  data available today.
- Special-request guidance correctly says expaify sends nothing and that the
  property must confirm a request after booking. This is adjacent to, but not a
  substitute for, changing an actual room selection or guest record.

The measurable product signal today is therefore structural: the app names an
owner in optional copy, while the type and provider contracts contain zero
fields that can support a rate-specific modification claim or a reliable
post-booking route.

## Traveler expectation model to validate

Downstream research should validate one consistent mental model across the
handoff, not three separate policy explanations:

| Change need | Safe expectation before booking | Owner after checkout | Required caveat |
| --- | --- | --- | --- |
| Dates | Check the selected rate's change/cancellation terms before payment | Booking partner named in the checkout and confirmation | New dates may require availability, repricing, taxes/fees, or cancellation and rebooking; no outcome is promised |
| Guest details | Verify lead guest and occupancy details at partner checkout | Booking partner first; property only when the confirmation or partner explicitly directs the traveler there | A spelling/contact correction is not equivalent to changing occupancy or the lead guest; supportability is unknown without partner terms |
| Room selection | Confirm the exact room/rate and whether a feature is guaranteed before payment | Booking partner for reservation record or rate changes; property for request fulfillment only when directed | A preference or special request is not a confirmed room change; availability and price may change |

The continuity rule is: **the company that issues the booking confirmation owns
reservation changes unless that confirmation explicitly directs the traveler to
the property or another servicing party.** expaify owns only errors in the deal
or outbound link it displayed before checkout. Unknown ownership must remain
unknown; a provider brand must never be inferred from an opaque redirect host.

## Minimum reliable data

The model has two data tiers. The first is sufficient for honest boundary copy;
the second is required before expaify may offer a specific post-booking route or
make a rate-level modification claim.

### Tier 1: minimum for every handoff

- resolved booking-partner display name, or the explicit fallback **booking
  partner**;
- validated affiliate outbound URL and the selected offer/property reference;
- selected stay context that expaify actually knows: hotel name, check-in,
  checkout, and observed rate/room identity when present;
- explicit ownership statements: partner completes and manages the reservation;
  expaify cannot modify it; the partner confirmation is the source of the
  booking reference and servicing instructions;
- an `unknown` modification-policy state when no rate-specific evidence exists.

### Tier 2: required for any specific modification claim or route

- policy scope bound to the selected provider, offer/rate, room, occupancy, and
  stay dates;
- source label plus observed-at timestamp or checkout-time version;
- separately normalized treatment for date changes, guest-detail corrections,
  occupancy/lead-guest changes, and room/rate changes;
- for each supported change: allowed/conditional/not allowed/unknown, applicable
  deadline or timezone when supplied, monetary consequence as integer-minor-unit
  money when supplied, and whether cancellation/rebooking is required;
- confirmation issuer/servicing owner and a provider-supplied manage-booking or
  support destination. A generic provider home page, guessed help path, opaque
  redirect, or expaify offer reference is not sufficient;
- conflict and stale states. Conflicting, missing, or mismatched evidence must
  degrade to **check with the booking partner before payment**, never to a
  positive claim.

Tier 2 does not exist in the current contracts. UXR and UXDES may specify its
truthful states, but UI must not imply those states are available until a later
DEV/provider ticket supplies them through `lib/providers` as `Result<T>`.

## Measurable signals and validation protocol

No production analytics currently prove that users understand modification
ownership. Disclosure-open rate is an attention measure, not comprehension, and
outbound clicks do not show whether a later request was misdirected. The initial
baseline must therefore be a moderated comprehension task using the current
handoff and partner-confirmation scenarios.

For each scenario, show the expaify handoff, then a synthetic partner
confirmation that either (a) names the booking partner as servicer, (b) directs
the traveler to the property, or (c) provides no usable servicing route. Ask:

1. Where would you go first to change the dates, correct a guest detail, and
   change the room?
2. What might happen to availability, price, fees, or conditions?
3. Can expaify make the change?
4. What would you save from checkout before closing the partner site?

Primary measure: **correct owner prediction rate**, reported separately for
dates, guest details, and room selection. A correct answer names the
confirmation-designated owner, says expaify cannot perform the change, and does
not treat a property request as a guaranteed reservation modification.

Safety measure: **unsupported-request prevention rate** — the share who do not
choose expaify when asked where to submit a completed-booking change. Record
unknown/no-route as a safe recognition of missing information, not a failure to
find a hidden expaify capability.

Continuity measure: **confirmation artifact recall** — the share who identify
the booking partner, booking reference, and manage/support instructions as the
items needed after checkout.

Diagnostic measures: time to choose an owner, confidence on a five-point scale,
and the specific cue used. Do not treat disclosure expansion or CTA clicks as a
success proxy.

## Constraints

1. **Do not overclaim policy or capability.** Until selected-rate evidence exists,
   the experience may explain ownership and consequences but must not say a
   booking is changeable, quote a fee/deadline, or imply a request will be
   accepted. Missing, stale, conflicting, or differently scoped evidence is
   explicitly unknown.
2. **Preserve the transaction and provider contracts.** All future policy or
   servicing data must enter through `lib/providers`, return `Result<T>`, keep
   money as `{ priceCents, currency }`, preserve affiliate markers, and bind to
   the selected provider/rate/dates. No component calls or guesses a vendor help
   endpoint.
3. **Keep the boundary usable and continuous.** The essential owner and
   consequence cue must be understandable before the outbound action at 375px
   and desktop, keyboard/screen-reader accessible, and consistent with partner
   checkout/confirmation language. It must not become a new account area,
   reservation store, messaging service, or post-booking portal.

## Success statement

This is solved when a first-time user can review a hotel handoff and correctly
predict where date, guest-detail, and room-selection changes are handled after
checkout, what information from the partner confirmation they will need, and
that expaify cannot perform the change — without mistaking a special request for
a guaranteed modification or attempting an unsupported change through expaify.

The handoff model is validated only when moderated testing shows the agreed
correct-owner threshold for **each** of the three change types and no scenario
creates a false positive that expaify or the property can perform an
undocumented change. UXR must set the threshold and sample plan before UXDES
specifies copy or hierarchy.

## Out of scope and dependencies

- a reservation lookup, authentication, itinerary store, or manage-booking page;
- submitting, brokering, or tracking a change, cancellation, refund, or property
  request;
- inventing partner support URLs, confirmation references, deadlines, fees, or
  rate rules;
- email ingestion or storage of partner confirmations;
- renegotiating provider terms or adding a provider solely to obtain
  modification data;
- changing hotel ranking, Deal Score, price calculation, checkout, or the
  affiliate handoff destination.

Adjacent observation, not part of this ticket: the current ownership disclosure
has an optional expaify issue route but production passes `null`, so it can tell
travelers what expaify owns without giving them an expaify reporting destination.
That support-surface decision requires separate operational ownership and must
not be smuggled into modification guidance.

## UXR handoff

Next ticket: **UXR-HOTEL-BOOKING-MODIFICATION-01**.

Research must:

1. audit the current handoff and disclosure in their rendered order at 375px and
   1280px, including collapsed and expanded ownership states;
2. compare the interaction pattern of one or two major booking partners at
   pre-payment policy review, confirmation, and manage/support routing — without
   copying visual style or assuming their data is available to expaify;
3. test the three change types independently, because guest-detail correction,
   occupancy change, and room preference are not interchangeable;
4. define the correct-owner threshold, sample/scenario matrix, failure criteria,
   and exact minimum cue set required before the outbound action; and
5. return 3–5 testable design directives while preserving the Tier 1/Tier 2
   evidence boundary above.
