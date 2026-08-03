# UX Discovery — Hotel room-view expectation clarity

**Ticket:** UXD-HOTEL-ROOM-VIEW-CLARITY-01  
**Stage:** UXD (Discovery)  
**Priority:** P2  
**Date:** 2026-08-03  
**Method:** Static audit of the current hotel offer contract, Hotellook adapter, property-photo treatment, hotel booking handoff, room-view component and tests, analytics allowlist, and the completed adjacent `hotel-room-view-confidence` pipeline. No production analytics, live room/rate payloads, provider-side funnel data, interviews, or post-stay records were available.

## Scope and existing-work boundary

This ticket overlaps directly with `docs/pipeline/hotel-room-view-confidence/`, whose discovery, research, and design work has already produced a shipped handoff repair. The current booking review now shows **Room view — View not confirmed**, warns that photos may depict the property or other room categories, and keeps a supplier room name separate from view evidence. Tests verify that a name such as “Ocean View King” is not promoted to **Guaranteed room view**.

This discovery does not reopen that settled presentation or propose a second view badge. Its remaining scope is narrower: establish whether travelers interpret the existing certainty boundary correctly, define what evidence would be required before expaify may show anything stronger, and prevent future room/rate data from collapsing a guaranteed category attribute, a request, and an unknown state into the same claim.

There is no current expaify room-rate selector to redesign. Actual room comparison and selection happen after outbound handoff on the provider site. UXR must preserve that product boundary and must not describe provider-side selection as observable expaify behavior.

## User pain point

A traveler choosing a view-sensitive hotel rate may still mistake supplier room naming or appealing property imagery for a promise about the exact room they will receive unless every view claim remains explicitly tied to its evidence scope and certainty from comparison through provider handoff.

The present expaify fallback reduces this risk before handoff; the unresolved risk is that its interpretation has not been measured and the data contract cannot preserve a stronger, rate-specific claim if a future provider supplies one.

## Who is affected, and where

The primary affected traveler is someone for whom the outlook materially changes value—such as a guest considering a price premium for an ocean, landmark, mountain, garden, or city view.

The decision path is **hotel detail / booking review → provider handoff → provider room-rate selection**:

1. On expaify, the traveler sees property-level hotel context and imagery. `PropertyPhoto` labels the image **Property photo**, so it is not room evidence.
2. In `BookingFlow`, the traveler sees the existing **View not confirmed** explanation immediately before the affiliate-marked provider action.
3. The provider—not expaify—shows and sells actual rooms and rates. expaify receives no selected room, selected rate, view assignment, confirmation, or stay outcome.

The highest-risk interpretation moment is therefore when a desirable view term appears beside a price: the traveler must know whether it is a guaranteed attribute of that exact available room and rate, a request dependent on assignment, a category-level description, or simply unverified.

## Current implementation signal

The false-certainty failure is currently guarded against, but stronger evidence and outcome measurement remain structurally unavailable.

- `HotelOffer` in `lib/types.ts` contains property identity, nightly price, property-level `photoUrl`, deeplink, and policy evidence. It has no room ID, rate ID, supplier room name, view term, view scope, certainty, or room-linked image.
- `hotellook.searchHotels()` normalizes a property-level lowest-price result and builds a property photo URL. It does not return selectable room inventory or room/rate-level view metadata.
- `BookingHotelContext` carries no room/rate/view fields, so view evidence cannot currently survive into booking review through the normalized provider contract.
- `HotelRoomViewConfidence` defaults to **View not confirmed** and says photos may show the property or other room categories. Its reserved presentation states distinguish guaranteed, request-only, category-only, stale, conflicting, error, and explicit no-view evidence, but no live provider data populates those states.
- Component and booking-flow tests verify the fallback copy, non-interactive placement, and separation of provider room naming from guaranteed evidence.
- The Special requests guidance already states that a preference is not guaranteed until the property explicitly confirms it for the stay. View language must use the same certainty rule rather than create a conflicting definition of “guaranteed.”

The observable product gap is therefore not “missing view copy.” It is the absence of validated comprehension, rate-scoped provider evidence, and evidence continuity across the handoff.

## Measurable signals

No baseline is available. UXR should define and test the following without treating clicks, dwell time, or self-reported confidence as proof of correct interpretation.

1. **Interpretation accuracy — primary guardrail.** In task-based testing, show guaranteed, request-only, category-only, and unavailable-data examples. Record the percentage of first-time travelers who correctly classify each as **guaranteed for this room and rate**, **request only**, or **not confirmed**. Any request-only or unknown state interpreted as guaranteed is a failure. Report results by state, not only as an aggregate.
2. **Evidence attribution accuracy.** Ask which item supports the claimed view: structured room/rate evidence, supplier room name, or property photo. Success requires rejecting the room name and property image as proof when no matching structured evidence exists.
3. **View-related booking hesitation.** In moderated comparison tasks, measure time to choose, reversals, and requests for clarification before handoff for otherwise equivalent view-sensitive options. Pair this with interpretation accuracy; longer time alone cannot identify confusion, and faster choice with a wrong guarantee interpretation is not success.
4. **Selection sensitivity to conditional language.** Measure the share of participants who change their choice after a view is revealed as partial, obstructed, request-only, category-scoped, or unconfirmed. This is a research measure unless a future provider exposes room-selection events.
5. **Return mismatch signal — future only.** If a privacy-bounded feedback point is later justified, distinguish “room view did not match” from generic room availability or smoking mismatch. A returned handoff is not evidence of a completed booking or stay, and the current analytics allowlist has no view-specific event.

## Constraints

1. **Bind certainty to the exact inventory scope.** **Guaranteed room view** is permitted only when one provider response explicitly binds the unmodified view term and guarantee semantics to the same available room ID, rate ID, searched dates, occupancy, source, and usable freshness. A room/category name, price premium, hotel location, or keyword match is never sufficient. Conditional qualifiers such as “partial,” “limited,” “side,” or “obstructed” must remain intact.
2. **Keep requests and absence honest.** A view preference or assignment request must say it is not guaranteed until the property explicitly confirms it for that stay. Missing, stale, conflicting, malformed, category-only, or property-level evidence must degrade to **View not confirmed**, never to “no view” and never to an inferred guarantee.
3. **Do not use imagery as booking proof.** Property photos and unscoped gallery images may provide hotel context but cannot substantiate the booked room’s view. Only provider metadata explicitly associating an image with the same room/rate may support context, and even then the structured guarantee—not visual interpretation—controls certainty. Any future contract work must remain behind `lib/providers`, return `Result<T>`, preserve integer-minor-unit money and affiliate deeplinks, and remain comprehensible at 375px and 1280px.

## Concise discovery direction

UXR should validate one three-state certainty grammar already established by the adjacent pipeline:

- **Guaranteed room view** — exact provider term, tied to this room and rate.
- **View request only** — exact requested term plus an explicit non-guarantee statement.
- **View not confirmed** — unavailable, insufficient, category-only, stale, or conflicting evidence; property imagery is not proof.

The visible evidence should answer, in the shortest usable form: **what view term was supplied, what exact room/rate scope it applies to, who supplied it, and whether it is guaranteed**. When any of those elements is missing, the unavailable-data state wins. UXR owns comprehension validation and evidence precedence; it does not own a new room selector, provider integration, or duplicate UI.

## Success statement

This is solved when a first-time traveler can look at a view-sensitive room option and correctly state whether the exact view is guaranteed for that room and rate, merely requestable, or not confirmed—without treating the supplier room name or property imagery as proof and without hesitating because the evidence scope is unclear.

## UXR handoff

`UXR-HOTEL-ROOM-VIEW-CLARITY-01` should:

1. Read `docs/pipeline/hotel-room-view-confidence/01-discovery.md`, `02-research.md`, and `03-design.md` first; treat their three certainty states, image boundary, and current fallback as inherited unless new evidence disproves them.
2. Audit the current shipped component and provider/booking contracts to verify which parts of the prior repair are live and which future presentation states remain fixture-only.
3. Design a comprehension study that measures interpretation and evidence attribution across guaranteed, qualified/partial, request-only, category-only, conflicting, stale, missing, and photo-led examples at 375px and 1280px.
4. Define the minimum evidence tuple and precedence rules for structured view data, supplier room/category names, requests, images, freshness, and conflicts. Do not infer a view or guarantee.
5. Recommend no further UI work if the existing fallback meets the comprehension threshold. If it fails, identify the smallest testable copy or hierarchy delta and separate it from any provider/data-contract dependency.

## Blockers and out-of-scope findings

- **Provider-data blocker:** Hotellook supplies no room/rate inventory or structured room-view evidence. Only **View not confirmed** is honest with current production data.
- **Measurement blocker:** expaify cannot observe provider-side room selection, a booking confirmation, the assigned room, or the stay outcome. Current events can measure handoff and return timing but not view interpretation or fulfillment.
- **Existing-work overlap:** the adjacent confidence pipeline has already defined and implemented the core fallback. UXR should validate and reconcile, not create a parallel vocabulary or another component.
- **Out of scope:** adding live room inventory, changing providers, building an internal room selector, parsing view terms from names, computer-vision analysis of photos, sending special requests, promising a floor/room number, or treating a provider-page discrepancy as a post-stay failure.
