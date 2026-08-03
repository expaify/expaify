# UXD-HOTEL-ROOM-INVENTORY-CONFIDENCE-01 — Hotel Room Inventory Confidence

**Stage:** UX Discovery  
**Priority:** P1  
**Date:** 2026-08-03  
**Affected flow:** hotel results → hotel detail → provider-owned room selection

## 1. Problem statement

**When a traveler moves from an expaify hotel result to choose a room, expaify provides neither provider-backed room inventory nor a trustworthy unavailable-room recovery state, so the traveler cannot distinguish “inventory was never confirmed” from “the room sold out” and must backtrack after commitment without knowing which alternative preserves their stay.**

This is a confidence and recovery problem, not a request to add urgency messaging or build an expaify room marketplace. The current product has no expaify-owned room-selection surface: `HotelOffer` contains a property and nightly price but no room ID, rate ID, inventory count, or room availability (`lib/types.ts`), and Hotellook's cache response supplies only a property-level `priceFrom` (`lib/providers/hotellook.ts`). The actual room choice happens after the outbound **Check rooms with provider** handoff.

## 2. Who is affected and where the flow breaks

The affected traveler has dates in mind, has judged a hotel or observed price worth pursuing, and is ready to compare or select rooms. The risk is highest for travelers with little substitutability—families, groups needing multiple rooms, and travelers who need a particular bed, access feature, or room policy—but every hotel shopper encounters the same evidence gap.

### Results

The mounted `/deals` feed uses `DealCard`, which presents a nightly price and **View deal** action but no room identity or inventory evidence. The richer `HotelCard` has a **Review hotel** action and defers room availability to the provider in its detailed disclosure, but current route imports show it is not mounted outside tests. Across both result representations, the traveler can interpret a visible property price as evidence that at least one suitable room remains even though the data contract establishes no such fact.

### Hotel detail and handoff

The saved-detail surface labels its action **Check rooms with provider**. This correctly locates live room choice outside expaify, but it offers no availability state before handoff and no expectation for what happens if the observed rate or desired room is gone. A stale or expired saved rate can send the traveler back to current deals, but there is no equivalent treatment for a provider-confirmed room mismatch.

### Room selection and return

Room selection is provider-owned and therefore not observable as an expaify UI step. `BookingFlow` can detect that a user returned after handoff and optionally ask whether partner details matched; one answer is **Room availability did not match**. That is post-loss reporting, not recovery. The current flow does not preserve the unavailable room, identify a still-available substitute, or distinguish:

- the desired room sold out;
- the observed price no longer maps to a room;
- the provider returned no rooms for the stay;
- the provider failed, leaving inventory unknown; or
- other room types may exist but expaify has no evidence of them.

The break is the moment the provider cannot fulfill the expectation created upstream. Today the user can return or restart, but receives no minimum alternative treatment anchored to the same property, dates, guests, or room count.

## 3. Evidence and measurable signals

### Current implementation signals

1. **Room inventory is unrepresentable.** `HotelOffer` has no room/rate identity, availability state, remaining count, or alternative-room collection. `HotelSearchPage.coverage` describes result-page coverage, not room inventory.
2. **The active provider cannot support scarcity.** `HotelLookCacheEntry` includes `priceFrom` but no room count, sellout state, or rate availability. The adapter returns `coverage: 'unconfirmed'` on every path and caches results for six hours.
3. **Availability is deferred rather than established.** The mounted `DealCard` has no availability copy; the currently unmounted `HotelCard` says the provider confirms room availability later; detail and booking review use **Check rooms with provider**. No expaify surface can claim that a room is available.
4. **A mismatch is already a recognized failure mode.** `BookingFlow` records `hotel_handoff_returned` and offers `room_availability_mismatch` under `hotel_handoff_return_reason_selected`, but only after a traveler returns and voluntarily submits feedback.
5. **Backtracking is only partially visible.** `HotelDecisionAnalytics` records `hotel_detail_back_to_results` and `hotel_room_handoff_started`. These events are not joined to a room-inventory state or a specific handoff session, so they cannot show whether availability uncertainty caused the backtrack.

### Measurement definition for downstream validation

The ticket's requested outcomes need honest denominators:

| Outcome | Minimum definition | Current observability |
|---|---|---|
| Room-selection completion | Unique provider handoffs that reach a provider-confirmed room/rate selection or attributable affiliate conversion, divided by unique room-selection handoffs | **Not currently observable.** A click is a handoff start, not room-selection completion. UXR must confirm whether a provider callback or affiliate conversion signal exists before adopting this as a product KPI. |
| Backtracking | Unique handoff sessions that return to expaify and then open another hotel, restart the same hotel search, or edit dates/guests before a new handoff, divided by returned handoff sessions | **Partially observable.** Return and detail-back events exist, but a shared handoff/session key and recovery-action events are missing. |
| Availability mismatch | Returned handoff sessions that select `room_availability_mismatch`, divided by returned handoff sessions shown the feedback prompt | **Partially observable and selection-biased.** Prompt impressions, opens, and dismissals are needed to interpret the rate. |
| False-urgency complaints | Support/feedback reports that cite unsupported room counts, “selling fast,” countdowns, or pressure to book, divided by exposed sessions | **No exposure or complaint taxonomy exists.** The safe MVP baseline is zero scarcity claims when no provider evidence exists. |
| Recovery success | Unavailable/mismatch sessions that start a second valid handoff with preserved trip context, divided by sessions shown recovery | **Not currently observable.** This is the most feasible in-product success proxy while provider-side completion is unavailable. |

These measures must segment by evidence state (`confirmed`, `unavailable`, `unknown/not provided`, and provider error) and by surface. A lower backtracking rate alone is not success if it comes from stronger unsupported urgency.

## 4. Constraints

1. **Only provider-supported inventory claims.** Never infer “sold out,” “only N left,” “popular,” “selling fast,” or a countdown from a cached price, missing result, result rank, traffic, or array length. Missing/failed data means inventory is unknown; `sold_out` requires an explicit stay- and room/rate-scoped provider response.
2. **Useful recovery without invented alternatives.** A replacement room may be presented only when the provider returns a distinct, currently available room/rate for the same property and active stay criteria. Without that data, recovery must preserve the user's criteria and offer truthful actions such as recheck, inspect provider rooms, return to matching results, or edit dates—not fabricate a “similar room.”
3. **Provider and data-contract integrity.** External checks remain in `lib/providers`; adapters return `Result<T>` and never throw; prices remain integer minor units with currency; affiliate markers remain on outbound links; room, rate, property, and stay scope must never be conflated.
4. **Commitment-stage clarity and accessibility.** Availability state and recovery cannot live only in collapsed detail, color, or post-return feedback. Copy must distinguish unavailable from unknown in text, work by keyboard and screen reader, preserve context at 375px and 1280px, and avoid blocking a user from checking the provider when expaify lacks evidence.

## 5. Success statement

**This is solved when a first-time user can move from a hotel result to room selection, understand whether room availability is confirmed, unknown, or explicitly unavailable, and recover from an unavailable choice with their stay context intact—without encountering unsupported scarcity or being forced to reconstruct the search.**

Minimum successful treatment:

- Before handoff, the product states the truth ceiling: expaify does not claim live room inventory unless a provider returned room/rate-scoped evidence.
- If a selected room/rate is explicitly unavailable and provider-backed alternatives exist, the unavailable choice remains identifiable while at least one alternative shows its room/rate identity, price basis, and material differences.
- If no provider-backed alternative exists, the state says that alternatives are unconfirmed and provides a criteria-preserving recovery path; it does not show an empty replacement carousel or imply the property is sold out.
- A traveler can return from a mismatch and continue to another valid handoff without re-entering destination, dates, guests, or rooms.
- Measurement separates room-selection completion from handoff clicks and can attribute backtracking, mismatch feedback, and recovery to the inventory evidence state shown.

## 6. Scope boundaries

This discovery does not authorize a new room-selection UI, a live-inventory provider, a room recommendation algorithm, date-flex pricing, or scarcity marketing. It also does not duplicate the adjacent `hotel-availability-signal` work (whether a displayed property price is a confirmed bookable rate) or `hotel-room-choice-clarity` work (whether the traveler can identify the room/rate behind a price).

This ticket owns the next failure boundary: **how an explicitly unavailable or unconfirmed room choice is communicated and how the traveler recovers with minimum context loss.** Because current provider data has no room inventory, the reachable MVP state is honest uncertainty plus recovery; a provider-backed sold-out or alternative-room state must remain unreachable until an adapter can earn it.

## 7. UXR handoff

Create **UXR-HOTEL-ROOM-INVENTORY-CONFIDENCE-01** to:

1. Audit every mounted results, hotel-detail, booking-review, outbound-handoff, and return path; verify which room-selection outcomes can be observed across the external provider boundary.
2. Compare one or two travel reference patterns at the interaction level: how a specific room/rate is marked unavailable, whether the failed choice remains visible, how alternatives preserve context, and how unsupported scarcity is avoided or disclosed.
3. Validate a state model that keeps `unknown/not provided`, provider failure, `sold_out`, and `alternative_available` mutually distinct and scoped to property, room, rate, dates, occupancy, and freshness.
4. Specify 3–5 testable directives for the minimum treatment at 375px and 1280px, including no-evidence recovery when Hotellook remains the provider.
5. Define an achievable measurement plan that does not mislabel outbound clicks as room-selection completion and explicitly identifies any provider callback or affiliate-conversion dependency.
