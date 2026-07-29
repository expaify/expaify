# UXD-HOTEL-ROOM-CHOICE-CLARITY-01: Room Choice Clarity Discovery

Date: 2026-07-29
Stage: UX Discovery (UXD)
Persona: Senior UX Strategist
Surface: hotel deal detail → provider handoff (`app/deals/[dealId]/page.tsx`, `app/components/HotelCard.tsx`, `app/components/ui/CompareRow.tsx`)

---

## 1. User Pain Point

When a property has more than one bookable room, expaify shows a single "from"
price with no room dimension at all, so the shopper arrives on the provider's
room list with no idea which room the price they trusted referred to, and has to
re-derive room type, occupancy, bed configuration, and what the room includes
from scratch on a stranger's page.

The Deal Score is scored against a price whose room the user cannot see. That is
the trust failure: expaify's differentiator is attached to an object the user
cannot identify.

---

## 2. Who Is Affected, And At Which Step

Everyone who reaches a hotel deal detail for a multi-room property — which is
effectively every real hotel — is affected at exactly one step: **the handoff
boundary**, the moment between "expaify convinced me this is a good price" and
"the provider is asking me to choose a room."

Three shopper shapes break differently at that boundary:

- **The price-anchored shopper** clicked because of a Deal Score. The provider's
  cheapest room does not match the expaify price, or it does but is a room they
  would never take (shared bathroom, no window, non-refundable dorm-style twin).
  They cannot tell whether expaify lied, whether prices moved, or whether they
  are looking at a different room. They return to expaify to re-read the card.
- **The fit-constrained shopper** (two adults needing two beds, a family of four,
  a solo traveler who does not want to pay a double supplement) has to open
  several rooms on the provider site to find one that holds their party, because
  no fit signal crossed the boundary with them.
- **The comparison shopper** holding two expaify hotel cards is comparing two
  numbers that may describe entirely different products — a twin room with no
  breakfast at hotel A against a double with breakfast at hotel B. The comparison
  is not wrong; it is undefined.

**Where the flow actually is today** (read, not assumed):

- The detail page is `app/deals/[dealId]/page.tsx`. Its section 4 heading is
  literally `Check rooms with provider` (`page.tsx:415`), and its copy tells the
  user the room decision happens elsewhere: *"Rate shown for this stay context;
  the provider confirms room-level details."* (`page.tsx:368`), and when dates are
  incomplete, *"Choose or confirm dates with the provider before comparing room
  options."* (`page.tsx:369`).
- The result card (`app/components/HotelCard.tsx`) says the same thing in
  `providerConfirmationCopy` (`HotelCard.tsx:750`): *"Provider confirms final
  total, taxes, fees, room availability, cancellation policy, and terms."*
- The outbound action is `CompareRow` (`app/components/ui/CompareRow.tsx:118-131`),
  whose accessible name is *"Check rooms at {label} for {hotelName}…"*
  (`CompareRow.tsx:120`).

So the product already tells the user, in three places, that room choice is not
expaify's job. That is an honest boundary, but it is currently an *empty* one:
the user crosses it carrying nothing.

---

## 3. Measurable Signals That The Problem Exists

**Signal A — The data model has no room dimension.**
`HotelOffer` (`lib/types.ts:474-495`) carries `id, name, area, location, stars,
pricePerNight, priceBasis, rating, photoUrl, deeplink, source,
documentReadiness, hotelClass, guestRating, amenityEvidence,
accessEvidenceState, fundsPolicy, smokingPolicy, rateEligibility,
rateEligibilityCapability`. There is **no room, occupancy, bed, or room-inclusion
field, and no room-offer collection**. `HotelSearchPage` (`lib/types.ts:501-506`)
is a list of properties, not of bookable rooms. One property = one price = one
deeplink, everywhere in the system.

**Signal B — A room identifier is already required by evidence binding, and
nothing produces one.** `lib/types.ts:366` defines `roomId?: string` on a policy
statement, `lib/hotels/smokingPolicy.ts:122,205` treats `roomId` + `rateId` as
required for a statement to be scoped to a selected room, and
`lib/booking/config.ts:764` allow-lists `roomId`/`rateId` as handoff params.
`lib/types.ts:125-129` even defines `HotelEvidenceScope = 'property' | 'room' |
'rate' | 'selected_stay'`. **The room scope exists in the contract; no code path
ever populates it.** Every evidence item the user sees today is therefore
property-scoped, and the `'room'` scope is unreachable. That is the gap in one
line: expaify has vocabulary for room-level truth and no room-level data.

**Signal C — Room-choice instrumentation exists but has zero discriminating
power.** `app/api/analytics/route.ts:18-23` registers `room_state` on
`hotel_results_viewed`, `hotel_provider_handoff_clicked`, and
`hotel_criteria_summary_viewed`, and registers a dedicated
`hotel_room_handoff_started` event (`route.ts:21`, fired at
`app/components/HotelDecisionAnalytics.tsx:125`). But `room_state` is assigned
the occupancy state verbatim — `room_state: criteria.occupancy.state`
(`app/deals/DealFeed.tsx:1379`, `app/components/HotelSearchCriteria.tsx:43`) — and
`HotelSearchCriteria.occupancy` is only ever constructed as
`{ state: 'not_captured' }` (`lib/hotels/searchCriteria.ts:120,182`; the
`'applied'` variant at `searchCriteria.ts:13` is declared but never built).
`CompareRow.tsx:131` hardcodes `occupancy_state: 'not_captured'`. **Every hotel
handoff in production is logged with `room_state: 'not_captured'`.** The board
cannot currently distinguish a confident room choice from a blind one, because
the field is a constant.

**Signal D — The handoff can land the user in an unscoped room list, and the
code knows it.** `CompareRow.tsx:55-57` inspects the outbound URL for
`adults`/`rooms`/`children`/`childAges` params to decide whether occupancy
context survived the handoff. When those params are absent — the default, since
occupancy is never captured — the shopper is dropped onto a provider room list
filtered to the provider's own default assumptions, not theirs.

**Signal E — The only hotel provider is room-blind by construction, and dead.**
`lib/providers/hotellook.ts` wraps the Hotellook `cache.json` price-aggregator
endpoint, whose entry shape carries `hotelId, hotelName, stars, location,
address, distance, priceFrom, photoUrl, propertyType` — a lowest-price-per-
property cache, with no room, bed, occupancy, or inclusion fields to normalize
from. Per the file map, this provider currently returns empty. **No room data is
reliably available for the MVP from the provider layer as it stands.**

**Signal F — "Provider returns" is not measurable today.**
`HotelDecisionAnalytics` types `entry_source` as `'search' | 'saved' | 'direct'`
(`HotelDecisionAnalytics.tsx:6`) and fires `hotel_detail_viewed` exactly once per
mount, with a comment stating that re-running would double-count
(`HotelDecisionAnalytics.tsx:57`). There is **no return-from-provider signal, no
session-level repeat-view counter, and no bounce-back event**. Drop-off is
partially derivable today (`hotel_room_handoff_started` ÷ `hotel_detail_viewed`),
but the ticket's other two confusion measures — provider returns and repeated
detail views — cannot be computed from the current event set at all. Closing that
instrumentation gap is part of this problem, not a separate one: without it,
whatever UXDES ships cannot be shown to have worked.

**Manual reproduction:** open any hotel deal detail, read the price and Deal
Score, click `Check rooms at {provider}`, and try to point at the room the
expaify price described. It cannot be done from anything expaify displayed.

---

## 4. Scope Boundaries — What This Ticket Is Not

Three adjacent pipelines already own neighbouring problems. This discovery is
scoped to sit between them without overlapping:

- **`docs/pipeline/room-rate-clarity/`** owns *rate policy*: refundability,
  cancellation deadline, meal plan as a rate category, prepayment. **Out of scope
  here.** Where a room attribute and a rate attribute collide (e.g. breakfast),
  this ticket treats it only as a room-inclusion fact needed to tell two rooms
  apart, and defers all policy/refund semantics and copy to that spec.
- **`docs/pipeline/guest-room-fit/`** owns *capturing the party*: adults,
  children, child ages, child policy, and search intake. **Out of scope here.**
  This ticket consumes occupancy as an input if it exists and must degrade
  honestly when it does not (which is the current state).
- **`docs/pipeline/hotel-detail-decision-order/`** owns the *detail page section
  order* and the single provider-confirmation boundary (its section 4, "Check
  rooms with provider"). **This ticket must slot inside that existing order and
  that single boundary — it may not add a second confirmation boundary, reorder
  sections, or restate the boundary copy.**

This ticket also does **not** build a room inventory browser, a room selector, a
multi-room comparison table, or in-app room booking. expaify's role stays:
frame the choice, then hand off cleanly.

---

## 5. Constraints The Solution Must Respect

1. **Data integrity — no invented rooms.** No room type, occupancy, bed count, or
   inclusion may be displayed unless a provider returned it. The established
   pattern is `HotelEvidenceStatus`/`HotelAmenityEvidence` with `sourceLabel`,
   `confidence`, and `certainty` (`lib/types.ts:125-148`), and the `'room'` scope
   already exists in `HotelEvidenceScope` for exactly this. Unknown must render as
   an explicit "not provided by {provider}" state, never as a silent omission and
   never as a plausible default (no "sleeps 2" because most rooms sleep 2).
2. **Provider boundary and MVP data reality.** Any room data must arrive through
   `lib/providers` as `Result<T>`, never fetched or inferred in a component. Given
   Signal E, UXR must establish what room-level fields, if any, are obtainable
   for the MVP before UXDES specs a populated UI. **If nothing is obtainable, the
   shippable deliverable is the unpopulated form of this problem:** a
   room-choice frame that states what the price does and does not cover, scopes
   the handoff URL with whatever stay/party context exists, and instruments the
   boundary honestly. That is a legitimate, complete outcome — not a failure.
3. **Measurement must ship with the change.** `room_state` must stop being an
   alias of occupancy state and must carry a real room-choice value, and the
   return/repeat-view gap in Signal F must be closed, or the success criteria
   below are unverifiable. Instrumentation is a deliverable of this feature.
4. **Layout, performance, accessibility.** The room frame lives inside the
   existing detail hierarchy and the existing single handoff boundary, usable at
   375px and 1280px, with no added overlap or clutter, no new colours or type
   sizes outside the tokens in `app/globals.css`, keyboard-reachable, and with
   the room context reflected in the handoff link's accessible name without
   making it verbose. Affiliate markers and `rel="noopener noreferrer sponsored"`
   on outbound links are untouched.

---

## 6. Minimum Room-Level Information — The Hypothesis To Test

The discovery question was: what is the *minimum* a shopper needs to choose
confidently among rooms. Based on the flows above, the ranked hypothesis handed
to UXR for validation against reference patterns (Booking.com room table, Google
Hotels room list) is:

1. **What the shown price refers to** — is this the cheapest room, a specific
   room, or an undefined "from" price. Highest value, and the only item that is
   answerable today without any new provider data.
2. **Occupancy** — how many people the room sleeps. The primary eliminator.
3. **Bed configuration** — one double vs. two twins. The primary decider once
   occupancy passes, and the single most common reason to reject a room after
   arriving at the provider.
4. **Room type / name** — the label that lets the user match expaify's room to a
   row on the provider's page. Low information on its own, high value as a
   *bridge* across the handoff.
5. **Inclusions that differ between rooms of the same property** — breakfast,
   free cancellation flag (display only; semantics owned by room-rate-clarity).
   Lowest priority, and the most likely to duplicate adjacent work.

UXR should treat items 2–5 as conditional on provider availability and item 1 as
mandatory regardless, since it requires no new data.

---

## 7. Success Statement

This is solved when a first-time user, standing at the hotel detail's single
provider boundary, can state in one sentence what room the expaify price and
Deal Score refer to — or read an explicit statement that the price is an
undefined "from" rate and which room attributes the provider did not supply —
and then cross to the provider carrying their stay and party context in the
link, without having to re-derive occupancy or bed configuration from zero,
and without any displayed room attribute that no provider actually returned.

Verified by: `room_state` carrying a real, varying value on
`hotel_provider_handoff_clicked`; a measurable return-from-provider /
repeat-detail-view signal existing where none exists today; and handoff
drop-off measured against a pre-change baseline captured before UI lands.

---

## 8. Handoff

Next stage: **UXR-HOTEL-ROOM-CHOICE-CLARITY-01** (UX Research, Claude Fable 5).

Research must, at minimum:

1. Determine what room-level fields are obtainable for the MVP — from Hotellook,
   from any affiliate widget/deeplink parameters, or from the `HotelProvider`
   interface as a forward contract — and state plainly if the answer is "none."
2. Tear down the room-choice step in Booking.com and Google Hotels at the
   interaction level: what the room row shows, in what order, and how the
   property-level "from" price is reconciled with the chosen room's price.
3. Resolve the exact overlap lines against `room-rate-clarity`,
   `guest-room-fit`, and `hotel-detail-decision-order` so UXDES inherits one
   non-conflicting surface.
4. Specify the analytics correction: what `room_state` should carry, and what
   event set makes provider returns and repeated detail views measurable.
5. Produce 3–5 testable directives for the unpopulated case as well as the
   populated one, since Signal E makes the unpopulated case the likely MVP.
