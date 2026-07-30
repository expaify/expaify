# UXD-HOTEL-RATE-INCLUSIONS-01: Hotel Rate Inclusions Clarity Discovery

Date: 2026-07-30
Stage: UX Discovery (UXD)
Priority: P0
Persona: Senior UX Strategist
Surface: hotel deal card → expanded details → expaify review → provider room/rate handoff

---

## 1. Problem Statement

A traveler selects an expaify hotel rate without being told what that rate's
price already buys — breakfast, Wi-Fi, parking, resort or property credit — so
two rates that look £30 apart may be identical or may differ by a paid breakfast
and a paid parking spot, and the traveler only finds out on the provider's room
list, after the choice has been made.

The failure is not missing amenities. It is that expaify shows a *price* and a
*Deal Score* with no statement of what that price includes, while every
inclusion-shaped fact the app does show is scoped to the property, not to the
rate.

---

## 2. Who Is Affected, And At Which Step

First-time and returning hotel shoppers — especially the price-sensitive
comparison user the Deal Score is built for — are affected at four consecutive
steps, all of which are silent on inclusions:

1. **Results scan** — `app/components/HotelCard.tsx` collapsed card. Carries hotel
   class, guest rating, an elevator chip (`app/components/HotelCard.tsx:874-881`),
   location, a parking summary (`ParkingSummary`), eligibility line, funds policy,
   pet and smoking lines, price, and Deal Score. No inclusion statement of any
   kind.
2. **Expanded details** — `app/components/HotelCard.tsx:987-1076`. Panels for Deal
   Score, quality, location, parking, pet, smoking, access evidence, price scope,
   funds policy, provider handoff. The "Price scope" panel says exactly
   `per night before taxes and fees` (`app/components/HotelCard.tsx:1046-1047`) —
   it defines what is *excluded upward* (taxes, fees) and never what is
   *included downward* (meals, Wi-Fi, parking, credit).
3. **expaify review** — `app/book/BookingFlow.tsx`. Repeats "Observed nightly rate"
   (`:350`) with the same basis label (`:242`) and defers everything to the
   partner: "The provider confirms room details, live availability, final total,
   taxes and fees, cancellation policy, and terms." (`:1094`). Inclusions are not
   in that list, so they are not even *promised* later — they are simply absent.
4. **Provider room/rate selection** — the affiliate deeplink opens the partner's
   room list, where a rate the traveler already trusted may be the room-only
   variant sitting beside a breakfast-included variant at a different price. This
   is the first and only place inclusions appear, and it is outside expaify.

The saved-deal detail page repeats the gap: its "Hotel fit" section
(`app/deals/[dealId]/page.tsx:399-411`) contains only hotel class and guest
rating, and its price block states the same before-taxes basis
(`app/deals/[dealId]/page.tsx:373-390`).

---

## 3. Measurable Signal That The Problem Exists

### 3a. The type contract has an inclusion primitive that nothing uses

- `lib/types.ts:132` defines `HotelEvidenceFee = 'included' | 'paid' | 'unknown'` —
  the exact inclusion primitive this problem needs.
- `lib/types.ts:126-130` defines `HotelEvidenceScope` including a `'rate'` member.
  **No code in the repo ever produces or consumes `scope: 'rate'` for an amenity
  fact.** `HotelDocumentScope` uses `'rate'`; amenity evidence never does.
- `HotelAmenityEvidence.fee` (`lib/types.ts:144`) is optional and, in the
  normalizer, is preserved for exactly one fact:
  `if (fact.id === 'on_site_parking' && isFee(value.fee))`
  (`lib/providers/hotelAmenityEvidence.ts:144`). A provider-supplied `fee` on any
  other fact is dropped during normalization.
- `HotelCard.tsx:4` imports `HotelEvidenceFee` and never uses it. The card has no
  render path for `included` vs `paid` at all — a dead import is the strongest
  available evidence that inclusion display was contracted for and never built.

### 3b. The fact vocabulary contains no inclusion facts

`ACCESS_FACTS` — the only amenity vocabulary in the app — is defined twice, once
in the adapter (`lib/providers/hotelAmenityEvidence.ts:18-26`) and once in the
card (`app/components/HotelCard.tsx:63-72`). Its members are: `elevator`,
`on_site_parking`, `step_free_route`, `room_pref_ground_floor`,
`room_pref_high_floor`, `room_pref_near_elevator`, `room_pref_connecting`.

There is no `breakfast`, `wifi`, `property_credit`, or any other material
inclusion. Consequently:

- `normalizeItem` returns `undefined` for any unrecognized id
  (`lib/providers/hotelAmenityEvidence.ts:112-116` → `FACT_BY_ID.get(id)` miss),
  and
- `getAccessEvidence` skips non-access ids (`app/components/HotelCard.tsx:120-121`,
  `if (!isAccessFactId(item.id)) continue`).

**A provider that returned a fully source-attributed "breakfast included for this
rate" fact today would have it silently discarded twice** — once in the adapter,
once in the card. This is a hard blocker for any downstream stage: the UXDES/UI
stages cannot render inclusions without a vocabulary and a normalizer path.

### 3c. The one live hotel provider cannot supply rate-scoped inclusions

`lib/providers/hotellook.ts` wraps Hotellook `cache.json`
(`ENGINE_BASE`, `:17`). Its wire shape `HotelLookCacheEntry` (`:22-40`) is
`hotelId, hotelName, stars, location, address, distance, priceFrom, propertyType`
plus expaify's own `amenityEvidence` / `smokingPolicy` passthroughs. `priceFrom`
is a lowest-price-per-property cache value, not a bookable rate, so **there is no
rate object upstream to hang inclusions on**. The adapter sets
`rateEligibilityCapability: HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` (`:408`) — the
established pattern for "this supplier cannot answer rate-level questions."

Implication for scope: the near-term deliverable is an honest, capability-gated
**not-returned** disclosure plus the contract that lets a rate-capable supplier
fill it in — not a fabricated inclusion list.

### 3d. No instrumentation exists for the three signals the ticket asks to measure

`lib/analytics.ts` exposes `track()`. Existing hotel events:
`hotel_detail_viewed`, `hotel_decision_section_reached`,
`hotel_room_handoff_started`, `hotel_detail_back_to_results`
(`app/components/HotelDecisionAnalytics.tsx:50,98,125,135`),
`hotel_result_card_opened`, `hotel_results_viewed` (`app/deals/DealFeed.tsx:1349,1373`),
plus policy-specific events (`hotel_funds_policy_details_opened`,
`hotel_smoking_policy_detail_viewed`).

Against the ticket's three requested measures:

| Requested measure | Today |
|---|---|
| Rate-detail expansion | Partial. `handleDetailsToggle` (`HotelCard.tsx:791-801`) only emits a *funds-policy* event and only when `canBook`. There is no expansion event attributable to inclusion intent, and no inclusion section to reach. |
| Inclusion-related exits | Absent. `hotel_room_handoff_started` fires on provider handoff with no inclusion-state property, so a handoff caused by "I need to check breakfast" is indistinguishable from any other. |
| Selection reversals | Partial. `hotel_detail_back_to_results` exists but carries no reason and no inclusion state; a traveler who returns after discovering a room-only rate is invisible. |

The instrumentation gap is itself a P0 finding: the success metric named in this
ticket cannot be measured before the disclosure ships, so the design must define
its own event and property set as part of the requirement.

### 3e. Adjacent work confirms the gap is real and unclaimed

Parking cost already has a *rate-adjacent* inclusion model:
`HotelParkingOptionEvidence.cost.state: 'included' | 'paid' | 'unknown'` with a
basis and amount (`lib/types.ts:169-170,182-186`), rendered as `Included` /
per-night-paid copy (`app/components/HotelParking.tsx:62`). So the app already
proves the pattern works and is trusted — for exactly one inclusion, out of one
dedicated ticket. Breakfast, Wi-Fi and property credit have no equivalent.
`docs/pipeline/hotel-amenity-fit/` and `docs/pipeline/hotel-amenity-provenance/`
covered *does the property have it* and *where did the fact come from*;
`docs/pipeline/room-rate-clarity/` and `docs/pipeline/rate-eligibility/` covered
room identity and who may book. **What the rate's price includes is covered
nowhere.**

---

## 4. Constraints The Solution Must Respect

1. **Data integrity — no inferred inclusions, ever.** An inclusion may only be
   stated as included when a provider returns it, source-attributed, at rate or
   selected-stay scope. Property-scoped "hotel serves breakfast" must never be
   presented as "your rate includes breakfast"; that conflation is the trust
   failure this ticket exists to prevent. Absence must render as an explicit
   not-returned state, following the existing `not_returned` /
   `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` capability-gating pattern.
2. **Provider contract.** All inclusion data flows through `lib/providers` as
   `Result<T>`, extends `HotelAmenityEvidence` / `HotelOffer` without breaking
   existing fields or exports, reuses `HotelEvidenceFee` and `HotelEvidenceScope`
   rather than inventing a parallel enum, and expresses money as
   `{ priceCents, currency }`. Copy must not depend on one vendor's response shape.
3. **Layout and accessibility budget.** The expanded hotel card already renders
   nine stacked panels. An inclusion disclosure must be scannable at 375px without
   pushing the Deal Score or the "Review hotel" action out of reach, must not rely
   on icon or colour alone to distinguish included from paid, and must be reachable
   in tab order with an accessible summary in the same style as the existing
   eligibility and funds-policy aria suffixes (`HotelCard.tsx:763`).

---

## 5. Prioritized Inclusion Disclosure Requirement

Ordered by decision impact. Downstream stages implement in this order and may cut
from the bottom, not the top.

- **P0 — Inclusion state per rate, four states, never inferred.** For each
  inclusion the app names, the traveler must be able to read one of exactly four
  states: *included in this rate*, *available and paid*, *not available*, or *not
  returned by this provider*. Every non-"not returned" state carries a source
  label. Testable: no code path renders "included" without a provider fact at
  `scope: 'rate' | 'selected_stay'` and a non-empty `sourceLabel`.
- **P0 — A minimum inclusion set: breakfast, Wi-Fi, parking, property/resort
  credit.** These four are the ones that change the effective price of a night.
  Parking reuses the existing parking evidence rather than duplicating it; the
  inclusion surface must reference one parking answer, not two.
- **P1 — Inclusion visible before the click that leaves expaify.** The state for
  the minimum set must be readable on the expanded card and repeated in the
  expaify review step (`app/book/BookingFlow.tsx`), so the last expaify-controlled
  screen never hands off with inclusions unstated. The provider-confirms sentence
  (`:1094`) must name inclusions among the things the provider confirms.
- **P1 — Honest capability gating for Hotellook.** With today's only live
  provider, the correct output is a single concise "this provider does not return
  rate inclusions — confirm on the partner's room list" statement, not four
  repeated unknowns. One line, not a table of blanks.
- **P2 — Instrumentation for the ticket's own success metric.** Emit an
  inclusion-section exposure event, an inclusion-expansion event, and inclusion
  state as a property on `hotel_room_handoff_started` and
  `hotel_detail_back_to_results`, so inclusion-driven exits and reversals become
  measurable after ship.

---

## 6. Success Statement

This is solved when a first-time user can tell, before leaving expaify, whether a
hotel rate's price includes breakfast, Wi-Fi, parking, and any property credit —
or that the provider did not say — without opening the partner's room list to find
out, and without expaify ever presenting a property-level amenity as a rate
inclusion.

---

## 7. Explicitly Out Of Scope

- Pricing model, total-stay cost maths, taxes and fees presentation
  (`total-stay-cost`, `hotel-total-stay-cost`).
- Cancellation and refundability (`hotel-cancellation-clarity`, `rate-eligibility`).
- Deal Score algorithm changes. Inclusions are disclosed beside the score; the
  score is not re-weighted by them in this ticket.
- Room identity, bed configuration, occupancy (`hotel-room-choice-clarity`).
- Loyalty-earned breakfast or upgrades, which are property-discretion at check-in
  and already handled by `app/components/HotelLoyaltyEligibility.tsx`.
- Adding a new inclusion *filter* to the results feed — new feature, not repair.

---

## 8. Open Question For UXR

Do we introduce a `rate`-scoped inclusion fact family alongside the existing
access facts in `hotelAmenityEvidence.ts`, or a separate `rateInclusions` field on
`HotelOffer`? The access-fact normalizer hard-codes an accessibility-only
vocabulary and a room-request/property certainty model that does not fit rate
inclusions; UXR should audit both options and recommend one so UXDES specifies a
single contract.

---

## 9. Handoff

Created `UXR-HOTEL-RATE-INCLUSIONS-01` — audit `HotelCard.tsx`,
`hotelAmenityEvidence.ts`, `hotellook.ts`, `BookingFlow.tsx`, and
`app/deals/[dealId]/page.tsx`; compare against Booking.com's rate-row inclusion
line and Google Hotels' rate-option inclusions; resolve the open question in §8;
produce 3–5 testable directives.
