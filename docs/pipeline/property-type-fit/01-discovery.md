# UXD-PROPERTY-TYPE-FIT-01: Hotel Property Type Fit Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist
Ticket: UXD-PROPERTY-TYPE-FIT-01 (P1)

## User Pain Point

A traveler scanning hotel deals cannot tell what *kind* of lodging each result is — a full-service hotel, a self-catering aparthotel, an all-inclusive resort, or a small boutique property all render as an identical "N-star" card, so people open detail pages (or leave for the provider) just to discover a deal never fit the stay they had in mind.

## Why Property Type Is Not "Just Stars"

Star class answers *how nice*. Property type answers *what kind of stay*, and it sets baseline expectations that materially change whether a price is even relevant to the user:

- **Service model** — a 4-star aparthotel has no daily housekeeping or front-desk-around-the-clock; a 4-star resort does. Same stars, opposite expectations.
- **Board / cost basis** — an all-inclusive's nightly rate bundles food and drinks; a hotel's does not. A user comparing two "\$180/night" cards is comparing incomparable things without the type label.
- **Kitchen / length-of-stay fit** — an aparthotel/serviced apartment suits families and long stays (kitchen, laundry); a boutique room does not.
- **Scale / vibe** — a boutique property is small and design-led; a resort is large and amenity-dense. This drives fit for couples vs. families vs. business.

Two properties can share stars, guest rating, city, and price and still be wrong for the traveler purely on type. Today expaify hides the one attribute that would let them rule a deal out in one glance.

## Scope Note: What Is Adjacent, Not This Ticket (Do Not Re-Solve)

Several hotel tickets already own neighboring signals. This ticket is **property category only** and must not reopen them:

- **Amenities** (breakfast, parking, Wi-Fi, pool, gym, pets, shuttle) — owned by `hotel-amenity-fit` (`docs/pipeline/hotel-amenity-fit/01-discovery.md`) and `hotel-amenity-provenance`. Property type is *not* an amenity list; it is the lodging category that implies a whole bundle of expectations. A resort chip is not "has pool."
- **Guest rating / review themes / recency** — owned by `hotel-rating-source-confidence`, `hotel-quality-snapshot`, and `hotel-review-relevance`. Type is orthogonal to how good the reviews are.
- **Hotel class (stars)** — already modeled as `HotelOffer.hotelClass` evidence (`lib/types.ts:109-151`, `HotelCard.tsx:121-137`). Type sits *beside* stars, it does not replace them.
- **Location precision / distance** — owned by `hotel-location-decision-context`. Type is not "where."

The delta this ticket owns: **the single categorical label that tells a traveler what species of lodging a deal is, before they open it.**

## Where The Problem Lives (Affected Surfaces)

The ticket scopes work to "existing listing surfaces." Two are load-bearing, and both are type-blind today:

1. **Deal feed** — `app/deals/DealFeed.tsx` renders `DealCard` (`app/components/ui/DealCard.tsx`) from the `ApiDeal` shape (`DealFeed.tsx:41-60`). `ApiDeal` carries `hotelName`, `stars`, `city`, prices, `discountPct`, `photoUrl`, `otaLinks` — **no property-type field**. The card shows name, star glyphs, and city only (`DealCard.tsx:120-127`). Every deal reads as a generic "hotel."
2. **Hotel detail flow** — `app/components/HotelCard.tsx` renders a `HotelOffer` (`lib/types.ts:137-151`). Collapsed, it shows a hotel-class chip and a guest-rating chip (`HotelCard.tsx:449-470`); expanded, it shows Deal Score, Quality evidence, Location, and Price scope panels (`HotelCard.tsx:538-579`). **No property-type chip in the collapsed card and no type line in the expanded detail.**

## Measurable Signal (Observable In Code Today)

This is not an opinion gap; it is a data-and-surface gap verifiable right now:

1. **No type field in the data model.** `HotelOffer` (`lib/types.ts:137-151`) and `NormalizedHotelOffer` have no property-type field. `ApiDeal` (`DealFeed.tsx:41-60`) has none. A repo grep for `propertyType | property_type | aparthotel | all-inclusive | resort | boutique` returns hits only in provider internals and unrelated marketing copy — never in a normalized offer surfaced to the UI.
2. **The one signal that arrives is thrown away.** The provider adapter *declares* `propertyType?: string` on its raw cache entry (`lib/providers/hotellook.ts:27`) but the normalization path (`hotellook.ts:458-486`, and the cached path `318-381`) never reads it — the field is silently dropped before it reaches `HotelOffer`. Where the vendor gives a type, expaify discards it.
3. **No type in the persistence layer.** `hotel_snapshots` (`lib/db/schema.sql:18-26`) stores `hotel_id`, `date`, price, currency, `fetched_at` — no category column — so nightly baselines and the deal feed cannot carry type even if the provider supplied it.
4. **No type control on any listing surface.** There is no property-type chip, badge, or filter in `DealCard`, `HotelCard`, or the feed's filter set (`DealFeed.tsx` `DealFetchOpts`: `minDiscount`, `maxPriceCents`, `minStars`, dates, sort — no type). 100% of type-driven fit decisions are forced off-platform or into an opened detail view.

**Behavioral signals to instrument (proxy for the pain):**
- **Irrelevant detail views** — count of hotel detail opens that end in immediate back-out with no CTA interaction (a "this wasn't the kind of place I wanted" bounce). Expect this to fall once type is visible in the feed.
- **Booking intent** — "Review hotel" CTA click-through on `HotelCard` and deal-detail entry rate, segmented by whether a type label was shown. Expect intent to rise for type-matched scans.

## Constraints The Solution Must Respect

1. **Data honesty / provenance.** Property type may be shown only when a provider actually supplies it (or it is derived by an explicitly-labeled rule). It must carry a source, consistent with the existing `sourceLabel` / evidence-confidence model (`HotelRatingEvidence`, `lib/types.ts:109-117`). When type is unknown, the honest state is a neutral "Hotel"/"Property type not provided" — never an invented category. No fabricated "Resort" on a property the provider didn't classify.
2. **Hotels-first taxonomy, small and fixed.** Bound the MVP to a short, closed set (candidate: Hotel, Resort, Aparthotel/Serviced apartment, All-inclusive, Boutique). No open-ended tag cloud, no flight/award scope. The set must map onto whatever the provider actually returns; UXR validates coverage before UXDES designs for a value that never appears.
3. **Fits existing hierarchy at 375px and desktop.** A type signal must slot into the current price → quality → confidence → handoff order without crowding the collapsed card or overlapping the hotel-class and guest-rating chips (`HotelCard.tsx:449-470`), must not rely on color alone (text label / icon, not a bare colored dot), and must be reachable by keyboard and assistive tech. No new tokens or colors invented outside `app/globals.css`.

## Success Statement

This is solved when a first-time user scanning the deal feed can tell, before opening a single detail page, whether each deal is a hotel, resort, aparthotel, all-inclusive, or boutique property — with that label carried honestly (attributed, with a clear "not provided" fallback) — so they rule out mismatched stays up front instead of discovering the mismatch after an irrelevant detail view or a provider handoff.

## Prioritized, Testable Directives For Downstream Stages

Ordered by leverage. Each is testable.

- **P0 — Model the type as attributed evidence, not a bare string.** Add a property-type signal to `HotelOffer` shaped like the existing evidence model (value from a fixed enum + `sourceLabel` + a confidence/derivation marker), so the UI can distinguish provider-supplied from derived from unknown. *Test:* an offer with no provider type renders a neutral fallback, never a guessed category.
- **P0 — Stop dropping the provider signal.** Map `HotelLookCacheEntry.propertyType` (`hotellook.ts:27`) through both the live (`458-486`) and cached (`318-381`) normalization paths into the new field, normalized onto the fixed taxonomy. *Test:* a fixture entry with `propertyType: "Apartment"` surfaces as the Aparthotel value with a Hotellook source; an unrecognized/absent value surfaces as unknown.
- **P1 — Surface type on the deal feed (collapsed).** Show the type label on `DealCard`, adjacent to but distinct from the star glyphs, so it is scannable without opening detail. Requires carrying type onto `ApiDeal` and (P2 below) persistence. *Test:* at 375px, name, stars, city, price, and type coexist with no overlap; unknown type shows a neutral "Hotel" or omits the chip per UXDES rule.
- **P1 — Surface type on the hotel detail card.** Add a type line/chip to `HotelCard` collapsed chips (`449-470`) and/or a labeled line in the expanded detail, sourced and with a "not provided" state. *Test:* every code path (verified type, derived type, unknown) has defined copy; screen-reader label states the category and its source.
- **P2 — Carry type through persistence and the deal-feed API.** Decide whether the feed's type is stored on `hotel_snapshots` (`schema.sql:18-26`) / the deal-building path or joined at read time; without this the feed cannot show type for snapshot-built deals. *Test:* a deal built from snapshots renders its type (or an honest unknown), not a blank.
- **P2 (defer / flag to UXR) — Type as a filter.** A property-type filter in the feed (`DealFetchOpts`) is the natural end state but is out of MVP scope unless coverage is high enough to be useful. UXR must confirm real-world type coverage before this is designed; a filter over mostly-unknown data is worse than none.

## Handoff Notes For UXR (`UXR-PROPERTY-TYPE-FIT-01`)

Research prompts, in priority order:

1. **Provider coverage first — is the data even there?** Determine what `propertyType` values Hotellook `cache.json` actually returns and how often (versus blank). If coverage is thin, state plainly that the MVP is *label-when-known, honest-fallback-otherwise*, and that the filter directive (P2) is unbuildable until coverage improves — so UXDES does not design UI for a value that rarely appears.
2. **Fix the taxonomy.** Validate and freeze the smallest useful set and the mapping from raw provider strings onto it (e.g., "Apartment"/"Serviced apartment" → Aparthotel; "Resort"/"All inclusive" handling). Bound it; no open tag cloud.
3. **Type vs. stars vs. amenities placement.** Coordinate with `hotel-amenity-fit` and the shipped collapsed-card hierarchy (`HotelCard.tsx:449-470`) so type does not collide visually or conceptually with the hotel-class chip or amenity work. Decide collapsed-card visibility vs. detail-only for each surface.
4. **Reference patterns.** Compare how Booking.com and Google Hotels present property type at the *result-scan* level (Booking.com's "Apartment / Hotel / Resort" property-type label and left-rail filter is the closest interaction analog) — at the level of interaction pattern, not visual style.
5. **Fallback + provenance copy.** Define the exact "not provided" state and the source line so a derived or provider-supplied type never reads as an expaify-verified claim, consistent with the evidence-confidence model already in `lib/types.ts`.

Deliver a research brief to `docs/pipeline/property-type-fit/02-research.md` and create `UXDES-PROPERTY-TYPE-FIT-01`.
