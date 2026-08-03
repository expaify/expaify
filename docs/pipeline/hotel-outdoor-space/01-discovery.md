# UX Discovery — Hotel balcony and private outdoor-space fit

**Ticket:** UXD-HOTEL-OUTDOOR-SPACE-01
**Stage:** UXD (Discovery)
**Priority:** P2
**Date:** 2026-08-03
**Method:** Static audit of the hotel result card, hotel booking handoff, hotel provider adapters, the shared hotel contract in `lib/types.ts`, the room-view and amenity-evidence precedents, and the hotel analytics schema. No production analytics, provider room-inventory payload, user interviews, or post-stay records were available at this stage.

## User pain point

A traveler cannot tell whether the room they are about to book includes a private balcony, terrace, or patio — or no outdoor space at all — because expaify carries no room-level outdoor-space attribute and shows a single unlabeled property photo that may depict a balcony, a rooftop terrace, or a shared courtyard belonging to a different room or to no room at all.

## Why this is not the room-view problem

The adjacent room-view work (`docs/pipeline/hotel-room-view-confidence/`) covers *what you can see from the room*. This ticket covers *whether the room has usable private outdoor floor area*. They fail differently and must not be merged:

- **Outdoor space is structural and near-binary.** A room either has a balcony or it does not. A view can be partial, seasonal, or obstructed; a balcony cannot be "partial" in the same sense.
- **Outdoor space is more often a hard requirement than a preference.** Smokers, travelers with a dog on an outdoor-relief routine, families needing a place to sit after a child's bedtime, and long-stay guests treat it as a filter, not an upgrade.
- **Its failure mode is silent.** A missing view is visible on arrival and negotiable. A missing balcony is discovered at check-in, is rarely refundable, and is a common cause of "the photos showed a balcony" disputes.
- **Property imagery is a stronger false signal here than for views.** Balconies photograph well and are routinely used as property hero images even when only a small share of rooms have one. This is the single largest inference risk on this surface.

There is also a materially different sub-distinction that the design stage must not collapse: **French balcony / Juliet balcony** (a railed door with no standing floor area), **step-out balcony** (standing room only), **furnished balcony or terrace**, and **ground-floor patio** are four different products. A traveler booking for outdoor seating who receives a Juliet balcony has received an accurate attribute and a wrong outcome.

## Who is affected, and where

**Primary user:** a traveler for whom private outdoor space is a stay requirement rather than a nicety — a smoker constrained by the property smoking policy, a traveler with a pet, a family with a sleeping child, or a multi-night guest working from the room.

**Affected path:** hotel detail → room/rate selection → booking handoff.

Only the first and last steps exist inside expaify today. The audit confirms:

1. `app/components/HotelCard.tsx:1202` renders a single property-level `hotel.photoUrl` through `PropertyPhoto` with no room or rate association, then offers **Review hotel**.
2. `app/book/BookingFlow.tsx:1173` presents **"Check rooms with provider"** and states that the provider shows room options and live availability.
3. Actual room and rate selection happens on the provider site. expaify receives no selected room, no room attributes, and no booking confirmation back.

The consequence is that the disclosure moment inside expaify is the **handoff panel**, and the decision moment is **off-site**. Any cue this pipeline ships must survive the traveler leaving the product — it has to be an interpretation rule the traveler carries to the provider page, not a badge they can only read here.

## Evidence in the current implementation

The gap is structural and verified in source, not inferred:

- **No outdoor-space attribute exists anywhere in the codebase.** A repository-wide search for `balcon|terrace|patio|outdoor|veranda|lanai` across all `.ts`, `.tsx`, and `.sql` files returns no room-level attribute. The only matches are the pool ledger's indoor/outdoor pool *type* (`app/components/research/hotelPoolFixtures.ts`), the smoking panel's caveat that a smoke-free statement does not cover "outdoor areas" (`app/components/SmokingPolicyPanel.tsx:185`), and an unrelated `outdoors` trip-inspiration theme (`lib/search/tripInspiration.ts`). Outdoor-space evidence coverage is therefore **0%** — not low, absent.
- **`HotelOffer` in `lib/types.ts` has no room-level surface to attach it to.** There is no room name, room category, room identifier, or rate identifier on the offer. `HotelEvidenceScope` (`lib/providers/hotelAmenityEvidence.ts:48`) already supports `'property' | 'room' | 'rate' | 'selected_stay'`, so the scope vocabulary exists — but no hotel provider currently emits a room-scoped physical-feature fact.
- **The nearest room-level component is inert.** `HotelRoomViewConfidence` is rendered at `app/book/BookingFlow.tsx:1190` **with no props at all**, so it always falls through to its `not_confirmed` default (`app/components/HotelRoomViewConfidence.tsx:79`). It never receives a `roomName` either. This is the clearest measurable signal available today: the one shipped room-attribute cue resolves to its lowest-confidence state 100% of the time. Any outdoor-space cue that depends on provider room data will land in exactly the same place unless UXR establishes that a provider actually returns it.
- **The provider layer returns property-level lowest-price results, not bookable room inventory.** `lib/providers/hotellook.ts` is documented as a dead API returning empty; the remaining hotel adapters normalize a property offer and a property photo. Nothing in the current adapter set can establish which room a price buys.
- **Analytics cannot currently isolate this decision.** `app/components/HotelDecisionAnalytics.tsx` emits `hotel_detail_viewed`, `hotel_decision_section_reached`, `hotel_room_handoff_started`, and `hotel_detail_back_to_results`. There is no room-selection event, and the existing return-feedback reasons in `BookingFlow.tsx` do not include a room-feature mismatch category.
- **A precedent for the honest-absence pattern already exists.** `normalizeHotelAmenityEvidence` distinguishes `not_returned` from `unknown` from `unavailable`, and refuses to accept a `confirmed` fact without a `sourceLabel` (`lib/providers/hotelAmenityEvidence.ts:126`). This ticket should reuse that discipline rather than invent a parallel one.

## Measurable signals

No production baseline was supplied. UXR must establish these without treating an outbound click as evidence of a satisfied traveler.

1. **Outdoor-space evidence coverage (primary feasibility gate).** For a sample of live hotel offers, measure the share for which a provider returns a room-scoped outdoor-space attribute with an identifiable source and a room or rate identifier. Report separately: attribute present and room-scoped, attribute present but property-scoped only, and attribute absent. **If room-scoped coverage is negligible, the correct outcome of this pipeline is a boundary statement, not a feature** — and UXR must say so explicitly rather than pass a thin signal downstream.
2. **Room-level attribute accuracy.** Where a provider does return an outdoor-space attribute, check it against the provider's own room detail page for the same room and rate. Record disagreement rate and disagreement type — most importantly, whether the attribute distinguishes a Juliet balcony from a standing balcony or terrace. An attribute that is technically accurate but does not carry that distinction should be classified as **not decision-grade**.
3. **Imagery inference rate (the constraint being defended).** In task-based research, show a hotel detail with a property hero image containing a balcony and no outdoor-space statement, and measure the share of participants who believe their room includes a balcony. This quantifies the false expectation the ticket exists to prevent and is the baseline the eventual cue must move.
4. **Room-selection change after disclosure.** Measure the share of travelers who change their selected room or rate, or abandon the property, after learning that outdoor space is unconfirmed, property-level only, or absent for their room. expaify's current contract cannot observe this directly; it must come from task-based research or a provider-supported funnel, and the limitation must be recorded rather than papered over with dwell time.
5. **Comprehension of the cue (release guardrail).** After reading the proposed cue, participants must correctly classify the state as *confirmed for this room*, *not established for this room*, or *this room has none*. Reading either of the last two as "my room has a balcony" is a failure, and this is the metric that gates ship.

## Constraints the solution must respect

1. **Room or rate scope only, from a verified source.** An outdoor-space claim may be presented only when a provider returns it at room, rate, or selected-stay scope with an identifiable source label. A property-level amenity list saying "balconies" describes the building's inventory, not the traveler's room, and must never be rendered as a room attribute. This mirrors the `validConfirmedCombination` discipline already enforced in `lib/providers/hotelAmenityEvidence.ts` and the `HotelEvidenceScope` vocabulary in `lib/types.ts` — extend those, do not fork them.
2. **Never infer outdoor space from imagery.** The single `hotel.photoUrl` is property-representative and carries no room association. It may not be used as evidence, may not be captioned in a way that implies room-level outdoor space, and the design stage must actively counter the inference travelers draw from it. Absence of evidence must read as *unknown*, never as *no balcony* and never as *balcony*.
3. **Do not add a request workflow, and stay inside the handoff surface.** Repair mode is active and this is P2. The deliverable is a room-specific interpretation cue on the existing hotel detail and booking handoff surfaces. It must not introduce a special-request flow, a new filter, a new API route, or a new provider integration, and it must not restate the guaranteed-versus-requestable boundary already shipped by the room-view and special-requests work — it should reuse it. The surface must remain usable at 375px and 1280px with no added clutter.

## Success statement

**This is solved when a first-time traveler who needs private outdoor space can tell, before leaving expaify for the provider, whether a balcony, terrace, or patio is confirmed for the specific room and rate they are considering — without inferring it from the property photo, and without reading an absent or property-level attribute as a promise about their own room.**

Concretely, the cue must make three states unmistakable and mutually exclusive:

- **Confirmed for this room and rate**, with the provider's own wording and source shown, and with the standing-space distinction preserved where the provider states it.
- **Not established for this room** — the provider did not return room-level outdoor-space details; the property photo is not evidence; confirm with the provider before booking.
- **This room has none** — the provider states this room and rate include no private outdoor space.

If UXR finds that no provider returns room-scoped outdoor-space data, success is redefined as a single honest boundary line that stops the imagery inference, and the pipeline should terminate at the UI stage rather than build states no provider can populate.

## Out of scope

- Shared or property-level outdoor amenities (rooftop bars, courtyards, gardens, pool decks). These are property facts and belong with the existing amenity and pool evidence work.
- Balcony furnishing, size, smoking permission on the balcony, or accessibility of the outdoor space. The smoking policy panel already owns the smoking question; do not duplicate it.
- Any change to `HotelOffer`, provider adapters, API routes, or the database schema. If the design stage concludes that a room-scoped attribute must be carried end to end, that is a DEV ticket created after UXDES, not a change made here.

## Handoff

`UXR-HOTEL-OUTDOOR-SPACE-01` created. The research stage's first obligation is signal 1 — establish whether room-scoped outdoor-space evidence exists at all in reachable provider responses — and to report a negative finding plainly if that is the answer.
