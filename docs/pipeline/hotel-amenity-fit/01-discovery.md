# UXD-HOTEL-AMENITY-FIT-01: Hotel Amenity Fit Discovery

Date: 2026-07-31
Stage: UX Discovery
Persona: Senior UX Strategist
Supersedes: the 2026-07-21 revision of this file (its central finding — "zero amenity fields exist anywhere in the stack" — is now factually wrong; see *What Changed Since The Previous Revision*)

## Problem Statement

On the live hotel path (`/deals` → `/deals/[dealId]`), a traveler cannot rule a property out on practical stay requirements — breakfast, parking, Wi-Fi, pet policy, air conditioning, shuttle — because not one amenity fact is rendered on either surface, so every fit decision is deferred to the OTA handoff and made off-platform.

## Who Is Affected And Where

Every hotel searcher, at three points in the flow:

1. **Results scanning — `app/deals/DealFeed.tsx`.** The feed renders name, stars, price, discount, and Deal Score. Its three filter pills are `minDiscount`, `minStars`, `maxPrice` (`app/deals/hotelFilterRecovery.ts`, `FilterPillKey` at `DealFeed.tsx:237`). There is no amenity filter and no amenity fact on any feed row. A user who needs free parking cannot narrow, cannot sort, and cannot see.
2. **Property evaluation — `app/deals/[dealId]/page.tsx`.** The page has a section literally titled **"Hotel fit"** (`page.tsx:399-412`). It contains exactly two rows: hotel class and guest rating. Both are quality signals, not fit signals. A section named for the user's question answers a different one, which is worse than omission — it reads as "we checked, there's nothing else."
3. **Room selection.** There is no room-selection step in this product; the user leaves via `HotelDealCriteriaHandoff` (`page.tsx:423`) to the provider. So every amenity question the user still holds becomes an unassisted task on someone else's site, after we have already claimed to have shown them the fit.

**The stranded contract.** An amenity evidence model already exists and is well-built: `HotelAmenityEvidence` (`lib/types.ts:138-148`) with `id`, `label`, `status` (`confirmed` / `unavailable` / `not_returned` / `unknown`), `scope`, `sourceLabel`, `fee`, `fetchedAt`, `confidence`, `certainty`; a provider normalizer at `lib/providers/hotelAmenityEvidence.ts`, wired into both the live and cached paths of `lib/providers/hotellook.ts` (lines 381, 404, 502, 532); and a rendering surface, `AccessEvidencePanel` in `app/components/HotelCard.tsx:259-330`, with correct unknown/loading/error states.

Two things break it:

- **`HotelCard.tsx` is not rendered by any page.** It is imported only by `HotelRateRestrictions.tsx` and by tests (verified: no non-test page or component in `app/` imports it). All the amenity UI that exists is unreachable by a user.
- **The consumed amenity vocabulary is six access facts, not amenities.** `ACCESS_FACTS` (`HotelCard.tsx:63-74`) is `elevator`, `step_free_route`, and four room-preference requests. `getAccessEvidence` drops every other id via `isAccessFactId`. So even if the card were mounted, a provider returning `breakfast` or `parking` would have that evidence silently discarded.

**The data layer is the hard floor.** The `deals` table (`lib/db/schema.sql:125-148`) stores `hotel_id`, `hotel_name`, `stars`, `photo_url`, price/median/discount, dates, `ota_links`, `headline`, `description`. There is no amenity column and no amenity join table. The live feed reads from `deals`, so no amenity fact can reach `/deals` today regardless of what the provider adapter normalizes. Any solution must either persist amenity evidence or fetch it per-property at detail time — and that choice determines whether amenity filtering at scan time is even possible.

## Measurable Signal

Structural signals, verifiable in the repo right now:

- Amenity facts rendered on the live hotel path: **0**. Amenity filters on the live results feed: **0** of 3 filter pills.
- Canonical amenity ids that survive `HotelCard`'s filter: **6**, all access/room-request facts; every other id is dropped.
- Amenity columns in the `deals` table: **0**.
- A section named "Hotel fit" that contains no fit attribute: **1** (`app/deals/[dealId]/page.tsx:400`).

Behavioural signals to instrument (the ticket's measurement ask). Note we cannot baseline amenity-filter use or amenity-detail engagement today because neither control exists — these are the post-ship measures, and the pre-ship baseline is the structural zero above:

- **Amenity-filter use:** share of hotel search sessions applying ≥1 amenity filter; per-amenity application rate. This ranks demand empirically and lets a later stage cut the tail.
- **Amenity-detail engagement:** expand rate on the amenity block on `/deals/[dealId]`, and dwell before the provider handoff click.
- **Abandonment after property review:** sessions that open a deal detail and exit without clicking the provider handoff. Amenity fit should reduce this by eliminating unsuitable properties *earlier* — which may legitimately mean fewer detail opens and a higher handoff rate per open, so read the pair, not either alone.
- **Unknown exposure rate:** share of displayed amenity slots resolving to `not_returned`/`unknown`. If this is high, the honest design problem is unknown-state presentation, not amenity coverage.

## Constraints

1. **Provider-supported, small, fixed set.** Ship only amenities the hotel provider actually returns and the adapter can normalize to a canonical id. The set is small and locked by the design stage — no ad-hoc growth, no taxonomy cleanup, no long-tail facility list. If the provider cannot support an amenity, it does not ship; we do not infer it from `description` or `headline` text.
2. **Unknown is a first-class, explicitly rendered state.** `not_returned` and `unknown` must never render as, collapse into, or be filterable as "not available." This bar is already met by `AccessEvidencePanel` and by the `deals`-page quality copy ("This provider did not return guest-rating evidence") and must not regress. Amenity filtering must state how it treats unknowns rather than silently excluding those properties.
3. **Do not conflate fit with price or quality.** Amenity fit must not feed, weight, or visually sit inside `DealScore`, the discount figure, hotel class, or guest rating. The Deal Score is the product's differentiator; diluting it with fit signals damages it. Amenity fit needs its own labelled space in the decision order already established by `data-hotel-decision-position` on `/deals/[dealId]`.
4. **Reuse `HotelAmenityEvidence`; do not invent a parallel model.** The type, the normalizer, and the status vocabulary are settled. Extend the canonical id set and the consuming surface — do not add a second amenity shape. Money in any amenity fee stays `{ priceCents, currency }` (`HotelEvidenceFee`).
5. **Usable at 375px and 1280px.** Amenity content on a feed row must not crowd price, Deal Score, or the CTA, and must not overlap or clutter at 375px.

## Success Statement

This is solved when a first-time user can eliminate hotels that fail a hard requirement — parking, breakfast, Wi-Fi, pets, A/C — from the results feed and confirm the survivors on the detail page, without opening the provider's site to find out, and without ever mistaking "the provider didn't tell us" for "the hotel doesn't have it."

## What Changed Since The Previous Revision

The 2026-07-21 revision correctly identified the absence of amenity data but has been overtaken by shipped work, and its framing would now mislead UXR:

- `HotelOffer.amenityEvidence`, `HotelAmenityEvidence`, and `lib/providers/hotelAmenityEvidence.ts` **now exist**. The contract UXR was asked to help define is already built.
- Several amenity-adjacent verticals shipped as **independent, single-purpose panels**: `HotelParking.tsx`, `HotelPetPolicy.tsx`, `SmokingPolicyPanel.tsx`, `HotelFundsPolicyPanel.tsx`, plus the access panel. Each has its own type, its own evidence shape, and its own placement. This is the current fit story, and it is fragmented — there is no single place a user reads "does this property fit me."
- Its stated target surface, `HotelCard.tsx`, is **not mounted on any live page**. Designing for that card again would produce another unreachable panel. The live surfaces are `DealFeed.tsx` and `/deals/[dealId]/page.tsx`.

## Downstream Focus (for UXR)

1. Read this report and `docs/pipeline/hotel-amenity-provenance/01-discovery.md` + `02-research.md`. Treat the provenance/evidence contract as **settled** — do not re-derive it.
2. Audit the live surfaces (`app/deals/DealFeed.tsx`, `app/deals/[dealId]/page.tsx`, `app/deals/hotelFilterRecovery.ts`) and the existing per-vertical panels (parking, pet, smoking, access). Determine whether amenity fit should be a **new consolidated block** or an **umbrella that absorbs the existing panels** — and say which, with a reason. Do not assume `HotelCard.tsx`.
3. Establish **provider support ground truth**: for each candidate amenity, what does the Hotellook/affiliate response actually return, and can `hotelAmenityEvidence.ts` normalize it? An amenity with no provider support cannot be ranked in. This is the gating input to the ranking and must come before it.
4. Deliver a **ranked amenity set** (recommend 5–7, provider-supported only), each with: canonical id, one-line intent justification for a value/deal-seeking traveler, and the provider field it maps to.
5. Deliver a **placement recommendation** across scan → detail: which amenities (if any) earn a slot on a feed row, which are detail-only, and whether an amenity **filter** is viable given that `deals` carries no amenity column — including the honest answer if the data layer blocks scan-time filtering in phase one.
6. Compare against one or two reference patterns (Booking.com facility filters, Google Hotels amenity chips) at the **interaction-pattern** level: how they show amenity presence during scanning, and how they handle properties with missing amenity data in a filtered result set.
7. Deliver **comprehension checks**: scenarios proving a user reads `confirmed` vs `unavailable` vs `not_returned` correctly, and open questions for design on properties where most priority amenities are unknown.

## Handoff

Create `UXR-HOTEL-AMENITY-FIT-01` with this report's path and problem statement embedded, and items 3–7 above as required research deliverables.
