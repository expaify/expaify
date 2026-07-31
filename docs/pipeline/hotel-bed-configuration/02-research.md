# UXR-HOTEL-BED-CONFIGURATION-01: Hotel Bed Configuration Confidence

**Date:** 2026-07-31  
**Stage:** UX Research (UXR)  
**Priority:** P0  
**Persona:** Senior UX Researcher

## 1. Research question and decision

Can a traveler tell, before leaving expaify, what bed arrangement the shown hotel
price buys and whether an alternative arrangement is guaranteed or merely
requestable, without expaify inventing detail its supplier did not return?

**No, not in the current product.** The current hotel offer has no room or bed
dimension, Hotellook returns a hotel-level `priceFrom`, and the Special requests
guidance does not name beds. The product therefore cannot answer either the factual
question ("what beds are included?") or the certainty question ("will my requested
arrangement be honored?").

**Owner decision — this ends the circular deferral:**

- The single display home is the already-designed **`Room & bed` row inside
  `Room & rate details`** from
  `docs/pipeline/room-rate-clarity/03-design.md §2.3`.
- Its five strings are the single disclosure string set: provider-backed
  `{room name}, {bed config}` verbatim; provider-returned-unavailable
  `Room type not specified for this rate`; not-returned
  `Room type not provided by this provider`; loading
  `Checking room details…`; error `Room details could not be loaded`.
- `guest-room-fit/02-research.md` contributes the provider-neutral canonical fact
  id (`bed_config`) and the evidence contract only. It does **not** get a second
  `Room fit` panel or a second set of bed strings. Its proposed `Room fit` panel is
  superseded for this fact.
- The existing `Special requests` block remains the one request-guidance home. It
  may name a bed preference, but it does not repeat the bed fact, create a selector,
  or claim a configuration was sent or confirmed.

This decision uses one factual disclosure, one existing request-guidance boundary,
and no new room-selection surface.

## 2. Inputs and method

### Repository evidence read directly

- `docs/pipeline/hotel-bed-configuration/01-discovery.md`
- `docs/pipeline/room-rate-clarity/02-research.md` and `03-design.md`
- `docs/pipeline/guest-room-fit/02-research.md`
- `docs/pipeline/hotel-special-requests/01-discovery.md`
- `lib/types.ts`
- `lib/providers/hotelAmenityEvidence.ts`
- `lib/providers/hotellook.ts`
- `app/components/HotelCard.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/analytics/route.ts`

### Reference-pattern sources

The reference comparison uses official supplier/partner documentation rather than
visual imitation:

- [Booking.com room-type management](https://developers.booking.com/connectivity/docs/room-type-and-rate-plan-management/managing-room-types)
  defines bed count/type inside a room configuration and explicitly distinguishes
  standard from alternative bed arrangements.
- [Booking.com traveler FAQ](https://secure.booking.com/faq.en-gb.html?aid=330843)
  distinguishes Double from Twin and says a Double/Twin bedding preference is made
  through Special Requests.
- [Expedia Group Rapid lodging launch requirements](https://developers.expediagroup.com/rapid/setup/launch-requirements/lodging-launch-reqs)
  require bed descriptions on each room, retain multiple `bed_groups` on a rate,
  provide a selection link for each option, and require messaging that a choice
  among alternatives is a request that may not be honored.

Reference pages were checked 2026-07-31. The findings below separate what the
current code proves from what these reference patterns suggest.

## 3. Current-code findings

### 3.1 No reachable provider returns a bed descriptor

There is exactly one `HotelProvider` implementation in the repository:
`HotellookProvider` (`lib/providers/hotellook.ts:427`). Neither the `HotelLookCacheEntry`
shape (`:22-42`) nor the live/cache mappings (`:388-410`, `:495-542`) contain a
room id, room name, rate id, bed count, bed type, or bed configuration. `HotelOffer`
also has no bed or room field (`lib/types.ts:556-579`). No alternative hotel
provider implementation exists behind the current `HotelProvider` interface.

Therefore **no provider reachable under the current code contract returns a bed
descriptor**. Credentials cannot populate a mapping or provider that does not
exist. A future supplier may expose beds, but it must first arrive as a separate
`HotelProvider`-conformant integration.

The complete shippable deliverable now is consequently the **unpopulated form**:
the existing `Room & bed` row in its `not-returned` state plus the existing
request-versus-guarantee explanation. This is honest product content, not an empty
placeholder and not a failed implementation.

### 3.2 The normalizer already supplies the safety behavior

`normalizeHotelAmenityEvidence` produces a `not_returned` object for every
canonical fact omitted by a supplier (`lib/providers/hotelAmenityEvidence.ts:151-175`).
It converts invalid status/scope combinations and invalid confirmed-certainty
combinations to `unknown` (`:119-133`). It never needs a component to parse a
vendor payload.

The canonical room-request facts already support the relevant distinction:

- room scope + `requestable`
- selected-stay scope + `requestable`
- selected-stay scope + `guaranteed`

`HotelCard` independently repeats the same guard (`app/components/HotelCard.tsx:92-121`)
and renders the distinction in words: requestable facts carry
`Request only — not guaranteed until the provider confirms.` (`:67`, `:150-161`),
while guaranteed room facts say the provider guarantees the preference for the
selected stay (`:175-194`).

Adding `bed_config` to this canonical evidence path is compatible with the existing
contract. It must not add an inferred confidence path: although
`HotelAmenityConfidence` includes `inferred`, inference is prohibited for beds.

### 3.3 The displayed price is not bound to any room or bed

Hotellook supplies `priceFrom`, normalized to `pricePerNight`; the offer contains no
room/rate identifier. A bed descriptor cannot truthfully be attached to that price.
Even a property-level room catalog would not prove which room the lead-in price
buys. Under the current adapter, the only legal display state is therefore
`not_returned`.

A future populated value is legal only when the provider response binds the bed
configuration to the same room/rate/stay represented by the displayed offer. A
room name, occupancy count, star rating, `propertyType`, price, or photo is not a
substitute for that binding.

### 3.4 Special requests is guidance-only, not a request control

The handoff block says `Need a quiet room, high floor, or early check-in?`
(`BookingFlow.tsx:1220`), tells the traveler to add the request on the booking
partner (`:1222-1225`), and states that expaify selects and sends nothing. Its
expanded help defines Selected / Sent / Acknowledged / Guaranteed (`:1230-1239`).
All request analytics use `capabilityState: 'provider_directed_only'`; the tracked
eligible count is hardcoded to three and selected count to zero (`:908-913`,
`:978-985`).

Beds should be made discoverable in this guidance, but the capability does not
support a bed option, toggle, or free-text field. Adding one would falsely imply
that expaify can transmit it.

### 3.5 The reversal-reason metric is currently discarded

`BookingFlow` emits `hotel_handoff_return_reason_selected` with a selected reason
at `:989-998`. The analytics API does not register this event in
`EVENT_PROPERTIES` (`app/api/analytics/route.ts:10-50`) and rejects any unregistered
event at `:246-247`. Every submitted return reason is therefore dropped.

The broader `hotel_handoff_returned` event is registered with
`awayDurationBucket` (`analytics/route.ts:39`) and can supply a pre/post bounce-back
proxy. It cannot identify beds as the cause. The current reason taxonomy would not
solve attribution even after registration: `Smoking policy or room did not match`
conflates smoking, room, and bed failures.

## 4. Reference-pattern teardown

| Question | Booking.com pattern | Expedia Rapid pattern | Transferable guidance for expaify |
|---|---|---|---|
| **How are beds bound to a price?** | Bed types and counts belong to the configured room type; room/rate occupancy is configured separately. The bed fact is not a property-wide amenity. | `rooms[].rates[].bed_groups` puts one or more bed groups under a specific room rate; each option has its own `price_check` link. | Never place a property-level bed claim beside a hotel-level `from` price. Populate only from a supplier response bound to the shown room/rate/stay. Until then, show the adopted not-returned string. |
| **How is “or” ambiguity represented?** | A room may carry a standard and an alternative bed arrangement. Traveler-facing Double/Twin means either setup, not both. | Multiple `bed_groups` remain separate options for the same room; examples preserve `Double bed` versus `2 single beds`. | Preserve supplier alternatives as alternatives. Render a visible textual `or`; never flatten alternatives into a comma list, because a comma reads as all beds being present. |
| **How is preference separated from guarantee?** | A Double/Twin traveler specifies a bedding preference in Special Requests. The room category and the preference channel are distinct. | Supplier launch rules explicitly require messaging that a choice among multiple bed types is a request and may not be honored if availability does not permit; confirmation output must retain the requested choice and warning. | A single returned bed group may be treated as the supplier-stated configuration only when bound to the selected stay. Multiple alternatives are `requestable`, not guaranteed. Keep the request warning adjacent and in text, not color alone. |

The reference lesson is not “copy a room table.” Both references have rate-shopping
data that expaify lacks. The transferable pattern is the relationship:

`priced room/rate → bed configuration(s) → certainty of the selected arrangement`

expaify currently has only a hotel-level lead-in price, so it must disclose the
missing relationship rather than simulate it.

## 5. Bed evidence legality table

Canonical fact: `bed_config`, label `Room & bed`, kind `room_request`, default scope
`room`. In the table, **legal** means the item may survive normalization at its
status; **downgrade** means normalize to `status: 'unknown'`, clear `certainty`, and
use the default room scope where the supplied scope itself is invalid.

| `HotelEvidenceStatus` | `property` scope | `room` scope | `rate` scope | `selected_stay` scope |
|---|---|---|---|---|
| `confirmed` | **Downgrade.** Beds are not a property-wide guarantee. | **Legal only with `requestable`.** Use for supplier-stated alternatives or a room-type preference not guaranteed for the stay. Missing or `guaranteed` certainty downgrades. | **Downgrade.** A rate without the selected room/stay binding cannot guarantee a physical bed. | **Legal with `requestable` or `guaranteed`.** `guaranteed` requires one unambiguous configuration bound to this selected stay; alternatives remain `requestable`. Missing certainty downgrades. |
| `unavailable` | **Downgrade.** | **Legal without certainty** when the supplier explicitly returns no specified room/bed configuration for that room type. | **Downgrade.** | **Legal without certainty** when the selected-stay response explicitly returns no specified room/bed configuration. The adopted row says `Room type not specified for this rate`; it does not claim a desired arrangement is impossible. |
| `not_returned` | **Downgrade.** | **Legal without certainty; default today.** Provider returned no bound room/bed descriptor. | **Downgrade.** | **Legal without certainty** if the selected-stay response omitted bed detail. |
| `unknown` | **Downgrade to default room-scoped `unknown`.** | **Legal without certainty.** Use for an ambiguous, malformed, or uninterpretable descriptor. | **Downgrade to default room-scoped `unknown`.** | **Legal without certainty.** Use when stay-bound data exists but cannot be interpreted safely. |

Additional forced-downgrade and normalization rules:

1. `confirmed` or `unavailable` without a non-empty `sourceLabel` → `unknown`.
2. `confirmed` without a non-empty supplier bed descriptor → `unknown`.
3. Any status or scope outside the existing unions → room-scoped `unknown`.
4. `certainty` on `unavailable`, `not_returned`, or `unknown` is stripped; certainty
   describes a positive confirmed fact only.
5. More than one valid alternative in a selected-stay response cannot be
   `guaranteed`; normalize/present it as `confirmed + selected_stay + requestable`
   and preserve the alternatives with `or`.
6. A supplier sentence that mixes an exact bed with hedging such as “or similar,”
   “subject to availability,” or “bed type selected at check-in” cannot be
   `guaranteed`; it is `requestable` when interpretable, otherwise `unknown`.
7. No value derived from occupancy, stars, room name, `propertyType`, photo, or
   price can enter this table as `confirmed`.

This table intentionally follows the current room-request validity model
(`hotelAmenityEvidence.ts:64-82`). If a future provider contract needs room-scoped
physical guarantees distinct from selected-stay guarantees, that requires a new
research/design decision rather than silently widening the meaning of `room`.

## 6. Design directives for UXDES (testable)

### Directive 1 — Adopt the existing row; do not create a third bed surface

Implement the `Room & bed` row in the existing `Room & rate details` section using
the exact five-state strings from `room-rate-clarity/03-design.md §2.3`. Do not add
the `guest-room-fit` proposal's second `Room fit` panel, a collapsed bed chip, a
room table, or another bed-copy family.

**Test:** one and only one factual `Room & bed` disclosure appears in expanded
hotel details. With current Hotellook data it reads exactly
`Room type not provided by this provider`. Loading, error, unavailable, and
provider-backed fixtures render the adopted strings unchanged.

### Directive 2 — Preserve rate binding, alternatives, and certainty

Add `bed_config` through the existing provider evidence normalizer and enforce the
legality table in §5. Supplier-returned alternatives must remain a single
alternative set joined by visible `or`; comma-separated beds are reserved for beds
that coexist in one configuration. Only one unambiguous configuration bound to
`selected_stay` may be guaranteed. Never infer or synthesize a bed descriptor.

**Test:** fixtures for `1 king bed or 2 twin beds` render both alternatives plus the
existing non-guarantee clause; they never render as `1 king bed, 2 twin beds` and
never receive guaranteed styling/copy. Invalid scope/certainty, missing source, or
missing descriptor fixtures normalize to `unknown`.

### Directive 3 — Make beds discoverable in Special requests without adding a control

Under the existing `provider_directed_only` capability, the Special requests prompt
must name a bed setup/preference as an example. Reuse the existing partner-directed
sentence, non-guarantee sentence, and Selected / Sent / Acknowledged / Guaranteed
help unchanged. Do **not** add a checkbox, radio group, free-text field, selected
state, or new confirmation step. Update `eligibleRequestCount` only to match the
number of examples the final prompt actually names; `selectedRequestCount` remains
zero.

**Test:** the handoff names a bed preference and still states that expaify selects
and sends nothing. Keyboard order is unchanged because no interactive control is
added. No analytics payload claims a bed request was selected or transmitted.

### Directive 4 — Keep preference and guarantee legible at both target widths

At 375px and 1280px, the adopted row and any request/guarantee qualifier must remain
inside the existing panels, wrap without truncation or horizontal scroll, and use
existing tokens only. Status meaning must be in text; color or icon may reinforce
but never carry request-versus-guarantee meaning alone. No second provider boundary
or reordered detail hierarchy is introduced.

**Test:** 375px and 1280px snapshots show the full not-returned, requestable, and
guaranteed text; screen-reader output announces the row label, descriptor/status,
scope, and request/guarantee meaning in that order.

### Directive 5 — Treat bed-attributed reversal measurement as a DEV dependency

Use `hotel_handoff_returned / hotel_handoff_continue_clicked`, segmented by
`awayDurationBucket`, as the available pre/post proxy. Do not claim the feature
reduces bed mismatches from that proxy alone. A bed-attributed success metric is
blocked until a separate DEV analytics repair registers
`hotel_handoff_return_reason_selected`, validates its properties, and separates
bed mismatch from smoking/other room mismatch in the reason taxonomy.

**Test:** the UXDES acceptance criteria name the proxy and the dependency. No
bed-specific KPI is marked measurable while the reason event is rejected. The
analytics repair is flagged as separate work, not implemented in this ticket.

## 7. Validation plan and success measures

### Release comprehension gate

Moderated prototype test with 5–7 travelers including a couple, colleagues sharing,
and a family. Target: at least 85% correct on both questions.

1. Show the current `not_returned` row: “How many beds does this price include?”
   Pass: the provider did not supply the room/bed detail; confirm at the provider.
   Fail: any inferred number or arrangement.
2. Show `1 king bed or 2 twin beds` with requestable certainty: “If you choose two
   twins, are they guaranteed?” Pass: no, it is a preference until the provider or
   property confirms it. Fail: yes, or interpreting the row as three beds.
3. Show a selected-stay guaranteed fixture: “What is different here?” Pass: the
   provider has confirmed this arrangement for the selected stay, not merely listed
   a room-type preference.

### Behavioral measures

- **Available now:** baseline and post-change rate of
  `hotel_handoff_returned / hotel_handoff_continue_clicked`, with the short
  `<5s` and `5–30s` buckets reported separately. Directional only.
- **Available after analytics repair:** share of handoff returns attributed to bed
  configuration mismatch; compare not-returned/requestable/guaranteed exposures.
- **Guardrail:** no increase in confidently wrong answers in the comprehension
  test, and no populated bed statement in logs/snapshots without supplier evidence.

## 8. Scope, dependencies, and out-of-scope findings

### In scope for the next design stage

- Adopt the existing `Room & bed` row and its strings.
- Specify the bed evidence states in the existing contract, including `or`
  alternatives and forced downgrades.
- Extend the existing provider-directed Special requests example set without
  adding a request control.
- Cover default/not-returned, confirmed-requestable, confirmed-guaranteed,
  unavailable, unknown, loading, error, 375px, 1280px, focus/keyboard, and assistive
  technology behavior.

### Dependencies

- **Populated data dependency:** a future rate-shopping hotel provider must return
  room/rate/stay-bound bed descriptors through `lib/providers`. No current provider
  can populate the row.
- **Measurement dependency:** a separate DEV analytics repair must register and
  validate the dropped return-reason event and separate bed mismatch from the
  conflated room/smoking reason before bed-attributed reversal data exists.

### Out of scope; record but do not fix here

- A hotel guests/rooms intake, room inventory browser, bed filter, or in-app room
  selection.
- Inferring beds from occupancy, stars, room name, property type, price, or photos.
- Implementing a supplier, extending API routes, or repairing analytics.
- Occupancy, child policy, crib/rollaway availability, connecting rooms, smoking,
  cancellation, and meal-plan redesign. Their existing owners remain unchanged.
- Revisiting the four-state Special requests model or adding post-booking request
  confirmation; expaify receives neither request transmission nor property response.

## 9. Handoff

Create `UXDES-HOTEL-BED-CONFIGURATION-01` for an implementation-ready design that
uses the settled `Room & bed` home/string set, specifies every state and legal
certainty combination above, adds bed preference discoverability to the existing
provider-directed Special requests guidance without a control, and records the
supplier and analytics dependencies as explicit acceptance constraints.
