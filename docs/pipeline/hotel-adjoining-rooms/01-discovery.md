# UXD-HOTEL-ADJOINING-ROOMS-01 — Connecting-Room Request Confidence

**Stage:** UX Discovery (UXD)
**Priority:** P1
**Date:** 2026-08-03
**Persona:** Senior UX Strategist
**Affected flow:** party setup (search criteria) → multi-room result comparison → provider booking handoff

**Surfaces read, not assumed:**
- `lib/hotels/searchCriteria.ts` — `HotelSearchCriteriaV1`, occupancy model, URL round-trip
- `app/components/HotelSearchCriteria.tsx` — criteria summary, editor, context/mismatch cards
- `lib/types.ts` — `HotelOffer`, `HotelSearchPage`, evidence types
- `lib/providers/hotellook.ts` — the only hotel adapter
- `app/book/BookingFlow.tsx` — handoff review, shipped **Special requests** block, return-reason capture
- `app/components/HotelRoomViewConfidence.tsx` — the house pattern for a guaranteed / request-only / unknown model
- `app/components/HotelDecisionAnalytics.tsx`, `app/api/analytics/route.ts` — observable events
- `docs/pipeline/hotel-room-occupancy/`, `hotel-bed-configuration/`, `hotel-special-requests/`, `hotel-room-inventory-confidence/` — adjacent scope

---

## 0. Scope boundary — read this first

This ticket owns **one** question:

> When a party needs two or more rooms physically connected or adjacent, does expaify tell them
> truthfully whether that connection is **guaranteed**, **request-only**, **unavailable**, or
> **unknown**, before they commit at the provider?

It does **not** own:

- **How many adults a room admits** — `hotel-room-occupancy` (adult-occupancy slice).
- **Bed type and arrangement inside one room** — `hotel-bed-configuration`.
- **How many rooms a party needs** — party-sizing is upstream and unbuilt (`hotel-guest-count-clarity`).
- **Whether any room is available at all** — `hotel-room-inventory-confidence`.
- **The generic preference block** (quiet room, high floor, early check-in) — `hotel-special-requests`, already shipped.

The last boundary is the one most likely to be collapsed downstream, so it is stated explicitly in
§5.

---

## 1. Problem statement

**A family or group that must keep children or dependents in a physically connected room has no
way to express that need in expaify and no evidence anywhere in the flow about whether a property
can guarantee it, will only accept it as a request, or cannot provide it at all — so the traveler
either abandons the multi-room booking or commits at the provider on an assumption that the
property never made.**

The failure is asymmetric, and that asymmetry is why this is not a preference. A denied high-floor
request costs comfort. A denied connecting-room request can leave a seven-year-old sleeping behind
a separate corridor door — a trip-breaking outcome the traveler would have paid more or chosen a
different property to avoid. Communicating this at the same confidence level as "high floor" is a
trust failure, not a copy nuance.

---

## 2. Who is affected and where the flow breaks

**Affected:** parties booking more than one room where at least one occupant cannot be
independently accommodated — families with young children, travelers with a dependent adult or
carer, and small groups needing supervision adjacency. They are highly price-inelastic on this
attribute and highly substitutable on property: if certainty is absent, they leave for a channel
that offers it.

### 2.1 Party setup — the need cannot be expressed

`HotelSearchCriteriaV1.occupancy` has exactly two states
(`lib/hotels/searchCriteria.ts:11-13`): `{ state: 'not_captured' }` and
`{ state: 'applied'; adults; children; childAges; rooms }`. Grepping mounted code, **the `applied`
variant is never constructed anywhere outside the type declaration itself.** The criteria editor
renders a static block reading "Guests & rooms — Not captured. This version of expaify can't filter
hotel deals by party size yet."
(`app/components/HotelSearchCriteria.tsx:229-233`).

So `rooms` is a declared field with no producer and no consumer. A party of five cannot state that
it is a party of five, cannot state it needs two rooms, and therefore cannot state that those two
rooms must connect. **The flow breaks before the first result is rendered.**

### 2.2 Results and detail — the attribute is unrepresentable

`HotelOffer` (`lib/types.ts:751-778`) carries property identity, stars, `pricePerNight`, ratings,
and a growing set of evidence objects (amenity, access, transport, funds, smoking, rate
eligibility, admission, charges). There is **no room identity, no rate identity, no room-count
field, and no room-adjacency or connecting-room field.** `HotelSearchPage` describes result-set
coverage, not room relationships.

The active adapter cannot supply it either: `lib/providers/hotellook.ts` is a dead API returning
empty, and its cache entry shape carries only a property-level `priceFrom`. There is no live
provider today that could return connecting-room inventory even if the type existed.

Consequently a multi-room party sees a single nightly price per property with no signal of whether
booking two of them yields adjacent rooms, a request, or two rooms in different towers.

### 2.3 Handoff — the need is silently reclassified as a preference

The shipped **Special requests** block at `app/book/BookingFlow.tsx:1281-1310` is the only place in
the product where anything adjacent to this need is discussed. It is well-built and honest for what
it covers: it prompts "Need a quiet room, high floor, preferred bed setup, or early check-in?", it
states plainly that "Nothing is selected or sent by expaify," and it ships a four-state truth model
in disclosure — **Selected / Sent / Acknowledged / Guaranteed** (`:1305-1308`) — closing with
"Until then, treat it as a preference."

That block is correct and must not be weakened. But it is the wrong instrument here, for three
reasons:

1. **It is scoped to one booked room.** Its own copy says a request "is a preference, not a change
   to your booked room or rate" (`:1297`). Room-to-room adjacency is a relationship between two
   bookings; the block has no concept of a second room.
2. **It fires too late.** It renders at the handoff review, after the traveler has already chosen a
   property. Connection certainty is a *property-selection* input: it should change which hotel you
   pick, not decorate the one you already picked.
3. **It has no guaranteed branch in practice.** Some properties genuinely sell connecting rooms as
   a bookable room type. A flat "treat it as a preference" understates those and gives the traveler
   no reason to prefer a property that can actually commit.

The block's analytics reflect this scope: `hotel_request_guidance_viewed` carries
`capabilityState: 'provider_directed_only'` and a hardcoded `eligibleRequestCount: 4`
(`app/book/BookingFlow.tsx:967-968, 1030-1031, 1087`). Four generic preferences. Adjacency is not
among them, and adding it as a fifth string would be the wrong fix.

### 2.4 The existing house pattern that does fit

`app/components/HotelRoomViewConfidence.tsx` already implements the exact shape this problem needs,
for a different attribute: a discriminated presentation union of
`guaranteed | request_only | category_only | no_view | stale | conflict | error | not_confirmed`,
each with distinct copy, provider-scoped source metadata, and a hard rule that request-only never
renders in success color. This ticket should produce the connecting-room analogue of that model,
not a new invention.

---

## 3. Measurable signals

### 3.1 Signals the problem exists (observable in code today)

| # | Signal | Evidence |
|---|---|---|
| 1 | Party size and room count are uncapturable | `occupancy.applied` has no producer; editor renders "Not captured" (`HotelSearchCriteria.tsx:229-233`) |
| 2 | Room adjacency is unrepresentable in the data contract | No room, rate, or connection field on `HotelOffer` (`lib/types.ts:751-778`) |
| 3 | No provider could answer today | `hotellook.ts` is dead and property-scoped only |
| 4 | The need is absorbed into generic preferences | Special requests block prompts four room-level preferences, none about adjacency (`BookingFlow.tsx:1290`) |
| 5 | Guidance is handoff-stage only | Block renders in `HotelHandoffReview`, after property selection |
| 6 | No multi-room event exists | Analytics allow-list has `hotel_request_guidance_viewed`, `hotel_room_handoff_started`, `hotel_detail_back_to_results` — none carries room count or adjacency state |

### 3.2 The ticket's requested metrics are not observable today — honest definitions

The ticket asks to measure *correct understanding of connection certainty* and *reduced multi-room
booking abandonment*. Both need honest denominators, and one of them has no denominator at all.

| Requested outcome | Minimum honest definition | Current observability |
|---|---|---|
| Correct understanding of certainty | Of sessions shown a connection-state treatment, the share that can correctly restate whether the property guarantees, only requests, or cannot provide connection — measured by comprehension test, not clickstream | **Not observable in product.** Requires moderated or unmoderated comprehension testing in UXR. No proxy event can stand in for understanding. |
| Multi-room booking abandonment | Sessions that declare a multi-room party and then exit without a handoff, over sessions that declare a multi-room party | **Zero observability — no denominator exists.** The product cannot record that a party is multi-room. This metric is unreachable until party setup captures `rooms`. |
| Misplaced confidence | Returned-handoff sessions citing that connection was assumed and not delivered, over returned sessions shown the feedback prompt | **Not observable.** `BookingFlow` return reasons include `room_availability_mismatch` but nothing adjacency-scoped; selection-biased even if added. |
| Property-choice influence | Multi-room sessions that hand off to a `guaranteed`-state property over those that saw a `guaranteed` option | **Not observable**, and dependent on a provider that can return the state at all. |

**Downstream stages must not report a reduction in multi-room abandonment as a success signal until
`rooms` is actually captured.** Until then the only defensible measures are comprehension testing
and a no-false-confirmation audit (§5). This constraint should be stated plainly rather than papered
over with a proxy.

---

## 4. Constraints the solution must respect

1. **A request is never rendered as a confirmation.** `request_only` must never use success color,
   a check affordance, or the word *confirmed*, *guaranteed*, *secured*, or *reserved*. Certainty
   must be legible in text alone, not carried by color, at 375px and 1280px, and via screen reader.
   The distinction between *guaranteed* and *requested* must survive being read aloud with no
   styling.

2. **Only provider-evidenced states may claim anything.** `guaranteed` requires an explicit,
   stay-scoped and room/rate-scoped provider statement — never inferred from a room name containing
   "connecting", from a property having many rooms, from an amenity string, or from a prior
   booking. Absence of data is `unknown`, and `unknown` is a first-class, non-embarrassing state
   the traveler must be able to act on. **Properties with no provider evidence are the default
   case, not the edge case**, since the only current adapter returns nothing.

3. **Scope stays out of occupancy and bed configuration.** This surface answers *are these two
   rooms connected*, never *how many people fit* or *what beds are inside*. Copy must not imply an
   occupancy or bed guarantee, and the treatment must not duplicate or contradict
   `hotel-room-occupancy` or `hotel-bed-configuration` outputs. Where they co-render, adjacency is
   a separate labeled statement.

4. **Contract integrity.** All provider access stays in `lib/providers`; adapters return `Result<T>`
   and never throw; money stays integer minor units with currency; affiliate markers stay on
   outbound deeplinks. Any new evidence type follows the established
   supplier/`fetchedAt`/scope/certainty shape used by the other `Hotel*Evidence` types in
   `lib/types.ts`, including a capability declaration so a silent adapter degrades to `unknown`
   rather than to a negative.

5. **No dead-end.** Because most properties will be `unknown`, the treatment must always leave the
   traveler a truthful next action — check with the provider, or contact the property — and must
   never block the handoff on missing expaify evidence.

---

## 5. Success statement

**This is solved when a first-time user booking two or more rooms for a family can tell, before
choosing a property, whether connecting rooms are guaranteed, only a request, unavailable, or
unknown — without ever reading a request as a confirmation, and without being blocked when expaify
has no provider evidence.**

Minimum successful treatment:

- Party setup can express that the trip needs **two or more rooms with a connection requirement**,
  distinct from how many guests and what beds. Without this, nothing downstream is measurable.
- Every connection statement resolves to exactly one state in an explicit, mutually exclusive
  model — the connecting-room analogue of `HotelRoomViewConfidence`'s union — with `unknown` and
  `provider_error` distinct from `unavailable`.
- `guaranteed` is reachable only from an explicit provider statement scoped to this property, stay,
  and room/rate. If no adapter can produce it, the state is unreachable in production, and that is
  the correct outcome — not a reason to soften the bar.
- `request_only` states in plain text that the property has not committed, names who decides
  (the property, at check-in or before), and reuses the shipped Selected / Sent / Acknowledged /
  Guaranteed vocabulary from `BookingFlow.tsx:1305-1308` rather than inventing a parallel one.
- `unknown` says expaify has no evidence — not that connection is unavailable — and offers a
  truthful path to find out.
- A copy audit confirms **zero** strings that could be read as a confirmation of an unconfirmed
  connection, in any state, at either breakpoint.

---

## 6. Known conflict to resolve downstream

The ticket's success criterion "reduced multi-room booking abandonment" **cannot be measured in the
current product**, because expaify never records that a booking is multi-room (§3.2). This is a
dependency, not a blocker on this stage: the confidence model can be specified and built regardless.
UXR must either (a) treat party-setup capture of `rooms` as an in-scope prerequisite, or (b)
explicitly downgrade the abandonment metric to a post-dependency measure and validate on
comprehension only. It must not silently substitute a handoff-click proxy.

---

## 7. UXR handoff

Create **UXR-HOTEL-ADJOINING-ROOMS-01** to:

1. Audit the mounted criteria, results, detail, and handoff surfaces for every place a multi-room
   party's connection need is currently dropped; confirm whether `occupancy.applied` has any live
   producer or is purely vestigial, and whether the shipped Special requests block should be
   extended, bounded, or left untouched.
2. Compare two reference patterns (Booking.com's connecting-rooms room type and request flow, and
   one of Expedia / Marriott.com) at the **interaction** level: where in the funnel connection
   certainty is surfaced, how a bookable guarantee is visually and textually distinguished from a
   request, and how properties with no data are handled.
3. Specify the state model as a discriminated union covering at minimum
   `guaranteed | request_only | unavailable | unknown | provider_error`, each scoped to property,
   stay dates, and room/rate, with a capability declaration so a silent adapter degrades to
   `unknown` and never to `unavailable`.
4. Produce 3–5 testable directives with exact copy rules per state, exact placement per surface, and
   the no-false-confirmation rule expressed as an assertable condition at 375px and 1280px.
5. Resolve the §6 measurement conflict explicitly and state which metrics are reachable pre- and
   post- party-setup capture.
