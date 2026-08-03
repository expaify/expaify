# UX Discovery: Hotel Adult Room-Occupancy Fit

**Ticket:** `UXD-HOTEL-ROOM-OCCUPANCY-01`  
**Stage:** UXD (Discovery)  
**Priority:** P1  
**Date:** 2026-08-03  
**Affected flow:** hotel search criteria → result comparison → provider room/rate selection

---

## 0. Scope boundary

This ticket is the **adult-occupancy slice** of room fit. It answers one question:

> Does this selected room and rate admit the number of adults in the travel party, and was its
> displayed price quoted for that same adult count?

It does **not** determine whether a bed arrangement is comfortable, apply child ages or child
policies, calculate how many rooms a group needs, or infer occupancy from a generic maximum-guest
label. Those are separate concerns:

| Concern | Relationship to this ticket |
|---|---|
| Adult count admitted by one selected room/rate | **In scope** |
| Adult count used to quote the selected rate | **In scope** |
| Generic “maximum guests” or “sleeps N” | Insufficient by itself; may mix adults and children |
| Bed type/count or sleeping-surface comfort | Out of scope; owned by `hotel-bed-configuration` |
| Child count, child ages, cribs, rollaways, child pricing | Out of scope |
| Multi-room allocation or “you need N rooms” calculation | Out of scope |
| Property admission rules such as minimum check-in age | Out of scope; owned by `hotel-policy-exceptions` |

Prior `guest-room-fit` work treated adults, children, beds, and multi-room groups together. This
ticket does not reopen that broad model. Its narrower job is to prevent a generic capacity label
from being mistaken for proof that an exact **adult** party is eligible for the selected rate.

---

## 1. User pain point

**A traveler can see a hotel price or a room label that appears suitable, but cannot tell whether
the selected room and rate both admit and price the exact number of adults traveling, so an option
that looked bookable can be rejected or repriced only after the traveler reaches the provider’s
room-selection flow.**

This is a trust failure, not merely missing detail. “Maximum 4 guests” does not establish that
three adults are permitted, that the displayed rate covers three adults, or that the statement
belongs to the room and rate currently being priced.

---

## 2. Who is affected and where

The primary affected user is a traveler searching for **two or more adults**, especially a party
of three or four adults for whom provider assumptions commonly diverge from a default
double-occupancy quote. A one-adult traveler is also affected when a shown rate assumes two adults
or has a per-person basis that is not disclosed.

The failure spans three steps:

1. **Search criteria.** The UI tells users “Guests & rooms not captured” and the editor cannot
   collect adult count. `HotelSearchCriteriaV1` declares an `applied` occupancy branch, but both
   production constructors hardcode `{ state: 'not_captured' }`
   (`lib/hotels/searchCriteria.ts:11-13,120,182`). The user therefore cannot state the denominator
   against which adult fit would be judged.
2. **Result comparison.** `HotelOffer` has a property identity and hotel-level nightly price, but
   no selected room identifier, selected rate identifier, adult limit, quoted adult count, or
   occupancy-evidence scope (`lib/types.ts:687-711`). Two results can look equally bookable even
   when only one provider rate actually supports the party.
3. **Room/rate selection.** expaify currently hands the traveler to a provider to inspect rooms;
   it does not own a room-rate selector. At this deadline, generic capacity, bed wording, and the
   displayed price can diverge. The user discovers the mismatch through an unavailable rate,
   validation failure, mandatory second room, or a higher price—after investing in the option.

The affected decision is not “how many people could physically enter this property?” It is
“can **these N adults** book **this room at this quoted rate**?”

---

## 3. Current implementation signal

The problem is directly observable in this worktree:

- **Occupancy is declared but unreachable.** `HotelSearchCriteriaV1.occupancy` supports
  `{ state: 'applied'; adults; children; childAges; rooms }`, yet every production reconstruction
  creates `not_captured`. The summary and editor explicitly expose that absence
  (`app/components/HotelSearchCriteria.tsx:42-43` and the “Guests & rooms not captured” copy).
- **Providers search an unstated default party.** Booking.com sends `adults=2&room_qty=1`
  (`lib/providers/bookingComHotelsRapidApi.ts:150`); Hotelbeds sends
  `{ rooms: 1, adults: 2, children: 0 }` (`lib/providers/hotelbeds.ts:212`). Neither default is
  derived from user criteria.
- **The provider contract cannot accept occupancy.** `HotelProvider.searchHotels` accepts only
  area, check-in/check-out, and an optional location anchor (`lib/types.ts:748-756`). Capturing an
  adult count in UI alone would not make results occupancy-correct.
- **The offer contract cannot prove fit or price applicability.** `HotelOffer` carries
  `pricePerNight` and a generic price basis but no adult-capacity evidence, no quoted-adult count,
  no room/rate binding, and no per-person versus party/room price scope
  (`lib/types.ts:687-711`).
- **The Hotelbeds adapter drops the binding needed for interpretation.** It selects the lowest
  numeric rate across returned rooms, then emits only a hotel-level offer. Room identity,
  rate identity, occupancy, and the adult count priced by that rate do not survive normalization
  (`lib/providers/hotelbeds.ts:85-98,245-282`).
- **Analytics records absence, not interpretation.** Hotel events accept
  `occupancy_state` / `room_state`, but current call sites report `not_captured`; the two fields are
  aliases rather than separate evidence (`app/api/analytics/route.ts:137`,
  `app/components/HotelSearchCriteria.tsx:42-43`). A return from provider can be labeled only as a
  broad “Room availability did not match,” not as adult-occupancy or price-party mismatch
  (`app/book/BookingFlow.tsx:52-60`).

The current rate is therefore not merely “occupancy unverified.” In active adapters it may have
been **searched under an invisible two-adult/one-room assumption**, then detached from the room and
rate evidence that would explain that assumption.

---

## 4. Clear occupancy-fit model

The downstream model must keep three facts separate. None can substitute for another.

| Fact | Question answered | Minimum trustworthy evidence |
|---|---|---|
| **Requested adult party** | How many adults is the traveler trying to place in the selected room? | Explicit user-provided positive integer, preserved in normalized search criteria |
| **Adult admission** | Does this selected room/rate allow that adult count? | Provider-supplied structured adult limit or explicit eligibility for the requested count, bound to the same room, rate, and stay |
| **Adult price applicability** | Was the displayed price quoted for that adult count? | Provider-supplied quoted adult count and price basis, bound to the same room, rate, stay, and currency amount |

An occupancy-fit result has only three honest outcomes:

1. **Confirmed fit** — the requested adult count is known; provider evidence for the same selected
   room, rate, and stay confirms that adult count is admitted; and the shown price applies to that
   adult count.
2. **Does not fit** — the requested adult count is known and the provider explicitly rejects that
   count for the same selected room/rate/stay, whether through an adult limit or rate eligibility.
   A bed count or generic guest limit alone cannot create this state.
3. **Not confirmed** — any required input or binding is absent, stale, conflicting, property-level
   only, generic to “guests,” or attached to a different room, rate, stay, or priced adult count.
   This is the expected fallback for current expaify hotel results.

“Exact adult party” means **the evaluated and priced party count equals the traveler’s stated adult
count**. It does not mean room maximum must equal party size; a room allowing up to four adults can
fit three adults if the provider explicitly admits and prices three adults for that selected rate.

### Unsupported-data fallback

When expaify lacks any required provider evidence, it must not translate “max guests,” a room name,
bed count, a hotel-level from-price, or the adapters’ hidden two-adult default into a fit claim. The
fallback meaning is:

> Adult occupancy and price fit are not confirmed for this room and rate. Confirm the adult count
> and updated price with the provider.

This is an **unknown evidence state**, not a negative result. It must never be rendered as “does
not fit,” and a result must not be filtered out solely because the provider did not return adult
occupancy evidence.

---

## 5. Measurable signal

### Primary: correct occupancy interpretation

Measure whether first-time users correctly distinguish confirmed fit, explicit non-fit, and not
confirmed. Use task-based comprehension rather than confidence ratings.

- Show a rate labeled only “Maximum 4 guests” for a party of three adults. Correct answer:
  **adult fit and price applicability are not confirmed**.
- Show a room/rate explicitly quoted for and admitting three adults. Correct answer:
  **confirmed fit**.
- Show a provider rule explicitly limiting the selected room/rate to two adults. Correct answer:
  **does not fit**.

**Release target:** at least 85% of participants classify all three cases correctly, with no more
than 10% interpreting missing evidence as a confirmed non-fit.

### Secondary: failed room-selection rate

Define the metric before implementation so a generic handoff is not miscounted:

`adult occupancy failed selections / room-rate selection attempts with a known requested adult count`

Count a failure only when provider evidence or a provider return reason attributes it to one of:

- selected rate unavailable for the requested adult count;
- adult limit lower than requested adults; or
- price changes because the quoted adult count differed from the requested adult count.

Do not mix child-policy failures, child-age repricing, bed-preference mismatch, or multi-room
allocation into this metric.

**Baseline blocker:** expaify cannot calculate this rate today. It does not capture adult count,
does not own provider room selection, and the existing return reason combines all room-availability
mismatches. UXR must identify an observable provider callback/return signal or define a bounded
usability-test proxy before UXDES claims a percentage improvement.

### Supporting structural signal

Today, 100% of production hotel criteria resolve to `occupancy.state = not_captured`, both active
search adapters apply an unrequested two-adult/one-room default, and 0% of normalized hotel offers
carry room/rate-scoped adult capacity plus quoted-adult evidence. These are falsifiable code-level
signals and the correct baseline until behavioral instrumentation exists.

---

## 6. Constraints

1. **Keep adult occupancy isolated.** Model the requested adult count and one selected
   room/rate’s adult compatibility only. Do not add child ages, child rules, bed-comfort logic,
   connecting-room logic, or a multi-room allocator to this ticket. Generic total-guest capacity
   must remain distinct from adult capacity.
2. **Use provider evidence only.** A fit or non-fit claim requires current structured evidence
   bound to the same provider, room, rate, stay, requested adult count, and price. Never infer from
   room names, bed counts, photos, property-level maxima, lowest-price offers, or hidden adapter
   defaults. External data stays behind `lib/providers`, returns `Result<T>`, and money remains
   integer `{ priceCents, currency }`.
3. **Preserve trust and usability across the existing flow.** Unknown evidence must remain
   bookable for provider confirmation and must be textually distinct from non-fit; affiliate
   markers remain on outbound links. Any later UI must keep price and Deal Score primary, be usable
   without overlap at 375px and 1280px, and expose the same meaning to keyboard and screen-reader
   users.

---

## 7. Success statement

**This is solved when a first-time traveler can state an adult party size, compare a selected hotel
room/rate, and correctly tell whether that exact adult count is admitted and covered by the shown
price—without relying on an ambiguous maximum-guest label or reaching a provider rejection—and
when missing or unbound provider data is plainly presented as not confirmed rather than guessed or
treated as a non-fit.**

---

## 8. Required UXR focus

The research stage must:

1. Audit one or two current room-rate selection patterns at Booking.com, Google Hotels, or a
   comparable OTA, specifically separating **adult count**, **generic guest maximum**, and
   **price applicability**; do not broaden into child or multi-room workflows.
2. Validate the three-state model—confirmed fit / does not fit / not confirmed—and test whether
   users mistake “maximum guests” or bed labels for adult-fit evidence.
3. Identify the minimum provider fields and binding keys needed to prove adult admission and
   adult price applicability for one selected room/rate/stay.
4. Resolve a measurable proxy or integration path for adult-occupancy failed selections, since
   current analytics cannot attribute the provider-side failure.
5. Produce 3–5 exact, testable design directives, including fallback semantics when a provider
   supplies only a hotel-level price, generic guest capacity, conflicting evidence, or no
   occupancy data.

## Handoff

Create `UXR-HOTEL-ROOM-OCCUPANCY-01` using this report as its discovery input:
`docs/pipeline/hotel-room-occupancy/01-discovery.md`.
