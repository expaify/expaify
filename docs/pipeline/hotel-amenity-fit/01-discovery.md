# UXD-HOTEL-AMENITY-FIT-01: Hotel Amenity Fit Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist

## User Pain Point

Travelers cannot tell whether a hotel fits their practical stay needs — breakfast, parking, Wi-Fi, pool, gym, pet policy, or airport shuttle — from the results scan or filters, so they open detail pages one by one just to rule hotels in or out before they ever compare rates.

## Who Is Affected And Where

First-time and returning hotel search users are affected across the entire hotel comparison path, not a single screen: the results scan (list of `HotelCard` components in `app/page.tsx`), any filter controls above the results, the collapsed hotel card, and the expanded card detail opened via the "Details" toggle in `app/components/HotelCard.tsx:512`-`520`.

Today none of these surfaces carry amenity information:

- `HotelOffer` in `lib/types.ts:137`-`150` defines identity, area/location, stars, `pricePerNight`, `rating`, `photoUrl`, `deeplink`, `source`, `hotelClass`, and `guestRating`. There is no amenity field of any kind — no list, no flags, no per-amenity status.
- `app/components/HotelCard.tsx` has dedicated collapsed summary chips for hotel class and guest rating (`getHotelClassEvidence`, `collapsedGuestRating`, lines 449-470) and dedicated expanded panels for Deal Score, quality evidence, location, and price scope (lines 538-579). There is no amenity chip in the collapsed card and no "Amenities" panel in the expanded detail.
- `HotellookProvider` (`lib/providers/hotellook.ts`) normalizes location, hotel class, and guest-rating evidence for both live and cached responses, but maps no facilities/amenity fields at any point in its normalization path.
- The only amenity-adjacent copy in the codebase today is marketing copy on the pricing/upsell section of `app/page.tsx:345` — `'Filter by discount, stars, price'` — which is a Premium plan bullet, not a real, implemented filter. There is no amenity filter control anywhere in the app.
- A user who cares about a specific amenity (e.g., "must have free parking") has no way to express that need before opening a hotel's provider page, and no way to confirm a hotel's fit even after opening it — the information does not exist on the surface at all today.

## Measurable Signal

- Result-refinement signal: users re-open multiple hotel detail views per session and/or re-run searches with adjusted filters after already viewing results — a proxy for "the result list didn't tell me enough to decide." This should drop once amenity fit is visible before opening detail.
- Conversion signal: save-rate or "Review hotel" CTA click-through rate should rise specifically for hotels whose confirmed amenities match a user's stated or inferred needs, versus hotels with no amenity signal shown.
- Structural signal (code-level, verifiable today): zero amenity fields exist in `HotelOffer`, zero amenity mapping exists in any hotel provider adapter, and zero amenity UI exists in `HotelCard` — so today the signal is not "amenities are wrong," it is "amenities are entirely absent," which forces 100% of amenity-driven fit decisions off-platform.

## Constraints

1. **Scope discipline (MVP amenity set):** Solve for a fixed set of 6-8 high-intent amenities only (e.g., breakfast, parking, Wi-Fi, pool, gym, pet policy, airport shuttle, air conditioning). Do not attempt to model the long tail of hotel facilities; downstream stages must rank and lock this list rather than expand it ad hoc.
2. **Data integrity for unknown amenities:** A missing or unreturned amenity must never be displayed or implied as "not available." Every amenity state must explicitly distinguish provider-confirmed, provider-says-unavailable, and not-returned-by-provider/unknown. This mirrors the data-integrity bar already set for hotel class and guest rating in `HotelCard.tsx` (see `getConfidenceText`, `getQualityHelperText`) and must not regress it.
3. **No overlap with quality scoring:** Amenity fit is a distinct concern from `DealScore` (price-history percentile) and from hotel-class/guest-rating quality evidence already on the card. Amenity fit must not feed, adjust, or be visually conflated with the Deal Score badge or the Quality Evidence panel — it needs its own clearly labeled space.
4. (Accessibility/layout, carried from the general contract) Amenity fit information must be scannable and non-overlapping at 375px mobile and 1280px desktop, and must not crowd the existing price, Deal Score, location, or booking-CTA hierarchy on the collapsed card.

## Success Statement

This is solved when a first-time user, scanning hotel results or a single detail page, can quickly tell which of their practical needs (breakfast, parking, Wi-Fi, pool, gym, pet policy, airport shuttle) a hotel confirms, does not offer, or simply didn't report — without opening every hotel's detail page one at a time to find out, and without that information being confused with the hotel's price or quality score.

## Note For Downstream Stages: Related Prior Work

A separate, already-completed discovery/research pair exists at `docs/pipeline/hotel-amenity-provenance/01-discovery.md` and `02-research.md` (ticket `UXR-HOTEL-AMENITY-PROVENANCE-01`). That work independently arrived at the same structural finding — zero amenity fields exist anywhere in the stack — and already defines a provider-neutral amenity evidence contract (canonical id, label, `status` of `confirmed`/`unavailable`/`not_returned`/`unknown`, source label, confidence, optional `scope`/`fee`) plus UI-state rules (max 3 confirmed amenities collapsed, no `No amenities` copy, no implying selected-stay availability without provider support).

This ticket is not a duplicate: that prior work is about **provenance and trust** (can the user believe what's shown is real). This ticket is about **fit** (which specific amenities matter enough to prioritize, and how a user quickly self-assesses match against their own needs across the scan → filter → card → detail path, including filtering). UXR should treat the provenance contract as a settled foundation to build on, not re-derive it, and should focus new research on: which 6-8 amenities are genuinely high-intent for this product's users, how amenity fit should surface in filters (not just cards), and comprehension — can a user correctly interpret an amenity state at a glance.

## Downstream Focus (for UXR)

The research stage should:

1. Read this discovery report and the existing amenity-provenance discovery/research docs referenced above (do not re-audit what they already established).
2. Audit the current filter surface (or lack thereof) in `app/page.tsx` and the results-scan layout to determine where amenity fit signals could live during scanning, not only inside the expanded card.
3. Compare against one or two reference patterns (e.g., Booking.com facility filters, Google Hotels amenity filters) at the interaction-pattern level: how amenities are surfaced as filters versus as card-level facts.
4. Produce an **amenity priority ranking**: which 6-8 amenities are highest-intent for this product's likely user base (budget/value travelers comparing deals), with a one-line justification each.
5. Produce **comprehension tasks**: specific scenarios to validate that a user can correctly read an amenity's state (confirmed vs. unavailable vs. unknown) from the card/filter UI without misreading absence as unavailability or vice versa.
6. Produce **unknown-data handling questions**: open questions for the design stage about how to treat hotels where most or all of the 6-8 priority amenities are unreturned by the provider (e.g., does the card show anything at all, does it affect filter matching, how is this different from a hotel that explicitly lacks the amenity).

## Handoff

Create `UXR-HOTEL-AMENITY-FIT-01` with the discovery report path and problem statement embedded, plus the amenity priority ranking, comprehension tasks, and unknown-data handling questions listed above as required research deliverables.
