# UXD-ROOM-RATE-CLARITY-01: Room And Rate Clarity Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist

## User Pain Point

A user cannot tell what they are actually booking — room type, bed configuration, meal inclusion, or whether the rate is refundable and until when — from anywhere on expaify, and must click through to the provider to learn the one thing that determines whether the price is worth the risk: what happens if their plans change.

## Who Is Affected And At What Step

First-time and returning users evaluating a hotel deal are affected at the deal-detail evaluation step, immediately before the booking CTA — the expanded state of `app/components/HotelCard.tsx` (`isExpanded` panel rendered at `app/components/HotelCard.tsx:523-582`), which is the last screen inside expaify before the "Review hotel" handoff link (`app/components/HotelCard.tsx:490-500`) sends them to the provider.

This is also where trust is currently promised and then deferred: the "Provider handoff" copy block literally states

> "Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms." (`app/components/HotelCard.tsx:417`, rendered at `app/components/HotelCard.tsx:571-579`)

Room availability and cancellation policy are named as things the user will only learn about *after* leaving expaify, on every single hotel card, for every user, on every search.

## Measurable Signal

- **Type contract has no rate-attribute fields.** `HotelOffer` in `lib/types.ts:132-146` has `id, name, area, location, stars, pricePerNight, priceBasis, rating, photoUrl, deeplink, source, hotelClass, guestRating`. There is no `roomType`, `bedConfig`, `mealPlan`, `refundable`, `cancellationDeadline`, or `ratePlanLabel` field anywhere in the shared type file.
- **The only hotel provider cannot supply this data today.** `lib/providers/hotellook.ts` wraps Hotellook's `cache.json` endpoint (`ENGINE_BASE`, `lib/providers/hotellook.ts:5`), which is a price-aggregator cache keyed by lowest price per property (`priceFrom`), not a bookable rate. Its response shape, `HotelLookCacheEntry` (`lib/providers/hotellook.ts:11-26`), carries `hotelId, hotelName, stars, location, address, distance, priceFrom, photoUrl, propertyType` — no room, bed, meal, or cancellation fields exist in the upstream payload to normalize from. `propertyType` is parsed off the wire but never mapped into `HotelOffer` at all (dead field).
- **`bookingComRapidApi.ts` is not a hotel provider.** Despite the name, `lib/providers/bookingComRapidApi.ts` implements `FlightProvider` and calls `getMinPriceMultiStops` (`lib/providers/bookingComRapidApi.ts:1,7,39`) — it returns flight fares, not hotel rates. A prior discovery doc (`docs/pipeline/hotel-amenity-provenance/01-discovery.md`) incorrectly describes it as "the future hotel path"; it is not. There is currently exactly one hotel data source in this codebase (Hotellook), and it is rate-blind by construction.
- **The UI explicitly punts refundability and room availability to the provider.** `getUnavailableReason` (`app/components/HotelCard.tsx:70-80`) only reasons about missing price or booking link — it has no concept of a rate being present-but-non-refundable versus present-but-unconfirmed-room. The static copy `providerConfirmationCopy` (`app/components/HotelCard.tsx:417`) is the single place these attributes are ever mentioned, and it is always the same sentence regardless of what the provider actually knows.
- **No refundable/non-refundable comparison is possible today.** Because there is no `refundable` boolean or cancellation-deadline field on `HotelOffer`, a user comparing two hotel cards has no way to know from the results list whether one rate is refundable and a cheaper one is not — a materially different decision than price alone.
- **Manual QA signal:** open any hotel card, expand details, and try to answer "if I book this and change my mind next week, do I get my money back, and is this a private room with the beds I need?" The answer is unavailable on `expaify.com`, full stop, on every card observed in this worktree.

## Constraints The Solution Must Respect

1. **Data integrity / non-negotiable contract.** Do not invent, infer, or default room, bed, meal, or refundable-rate attributes that no provider returned. Every displayed attribute must be traceable to real provider data or explicitly marked as not provided — this mirrors the evidence-confidence pattern already established for `hotelClass`/`guestRating` (`HotelRatingEvidence`, `lib/types.ts:104-129`) and must not regress it.
2. **Provider boundary.** Any new rate-attribute data must flow through `lib/providers` as a `Result<T>` adapter (per `AGENTS.md` non-negotiable contract) and must not be fetched or invented in a component. Given the current Hotellook payload has no rate-level fields, this constraint has a direct consequence for scope: **UXR must determine whether room/bed/meal/cancellation data is obtainable from Hotellook at all (e.g. an undocumented field, a details endpoint, or the affiliate widget) before UXDES can spec real UI states** — otherwise the deliverable is an honest "not provided by this provider" disclosure state, not a populated one.
3. **Scope discipline — no room inventory browser.** This ticket is about surfacing and prioritizing existing/obtainable rate attributes on the current single-rate hotel card, not building room selection, multi-rate comparison tables, or a booking flow. Stay inside `HotelCard.tsx`'s existing collapsed/expanded structure.
4. **Layout and accessibility.** Any new attribute display must fit inside the existing card without crowding Deal Score, quality evidence, location, or the booking CTA, and must remain usable at 375px mobile and 1280px desktop, consistent with prior UI-stage work on this component (`docs/pipeline/hotel-price-visibility/`, `docs/pipeline/hotel-amenity-provenance/`).

## Overlap With Other In-Flight Tickets (flagging, not resolving)

The ticket board currently has two other `in_progress` UXD tickets with partial overlap into this same surface:

- `UXD-CANCELLATION-POLICY-01` — "cancellation policy confidence" — covers cancellation windows, refundability, and prepayment terms specifically. Its prior run failed before producing a discovery doc (Fable 5 credit error in `run_log`), so no `docs/pipeline/cancellation-policy/` exists yet to cross-reference.
- `UXD-HOTEL-AMENITY-FIT-01` and the completed `docs/pipeline/hotel-amenity-provenance/` — cover general facility amenities (breakfast, parking, Wi-Fi, pool, pet policy). Meal plan as a **rate inclusion** (e.g. room-only vs. bed-and-breakfast rate category) is conceptually distinct from breakfast as a **facility amenity**, but the two will read as duplicative to a user if both stages ship independent "breakfast" copy blocks.

This discovery scopes room/bed/meal/cancellation/refundable strictly as **rate attributes of the single quoted rate**, not as general amenities or a policy-education surface. UXR should read the cancellation-policy discovery doc if it exists by the time research starts, and should coordinate meal-plan copy with the amenity-provenance work so the two don't produce conflicting "breakfast included" statements on the same card.

## Success Statement

This is solved when a first-time user can look at a single hotel card's expanded details and state, without leaving expaify: what room/bed configuration is being quoted (or that it wasn't provided), whether a meal plan is included (or that it wasn't provided), and whether the rate is refundable and by what deadline (or that refundability wasn't provided) — with every stated attribute traceable to real provider data, and every unavailable attribute disclosed as unavailable rather than silently omitted.
