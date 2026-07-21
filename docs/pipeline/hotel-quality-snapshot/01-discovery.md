# UXD-HOTEL-QUALITY-SNAPSHOT-01: Hotel Quality Snapshot

## User Pain Point

A user can now tell whether a hotel's star class and guest-review score are verified (`app/components/HotelCard.tsx`, shipped under `hotel-rating-source-confidence`), but they still cannot tell whether that review score reflects recent stays or whether the property has the amenities that matter to them — so a cheap, stale-reviewed, amenity-blind hotel can still look like a "genuinely strong" deal next to a real one.

## Scope Note: What Is Already Solved (Do Not Re-Solve)

Before scoping new work, this discovery confirms the following are already implemented and must be treated as done, not re-designed:

- **Star/hotel-class evidence** — `HotelOffer.hotelClass` (`lib/types.ts:96-117`, `lib/types.ts:149`), rendered as a labeled chip in `HotelCard.tsx:454-459` and detailed in the `Quality evidence` panel (`HotelCard.tsx:309-362`).
- **Guest review score with source/scale/confidence** — `HotelOffer.guestRating` with `kind`, `confidence` (`verified` / `provider_only` / `inferred` / `unavailable`), `scaleMax`, and `sourceLabel` (`lib/types.ts:96-117`), gating qualitative labels (`Excellent`/`Very good`/`Good`) so they never appear on unverified data (`HotelCard.tsx:91-93`, `220-234`).
- **Review count** — `HotelRatingEvidence.reviewCount`, shown collapsed (`HotelCard.tsx:193-195`) and in the expanded panel (`HotelCard.tsx:236-246`), with an explicit "not provided" state.
- **Data-fetch freshness** — `HotelRatingEvidence.fetchedAt`, shown as `Updated <date>` or `Freshness not provided` (`HotelCard.tsx:107-119`, `353-357`).

This ticket must not duplicate `docs/pipeline/hotel-rating-source-confidence/*` or reopen its design decisions. Any research/design work from here forward should treat those fields as a foundation to build on.

## The Actual Gap

Two hotel-specific proof points from the ticket brief are still missing from both the data contract and the UI, and a third is a data-quality distinction nobody has modeled yet:

1. **Recent-review caveat (new gap, not just a rename of freshness).** `fetchedAt` tells the user when *expaify* last pulled data from the provider — it says nothing about how recent the underlying reviews are. A hotel can have `fetchedAt: today` and `reviewCount: 1,248` built entirely from reviews written three years ago, and the current UI would show it exactly the same as a hotel with genuinely recent guest feedback. There is no field anywhere in `lib/types.ts` for review recency (e.g., most-recent-review date, or "% of reviews in the last 12 months"), and no caveat copy for "this score may not reflect the current property."
2. **Amenity highlights (researched, never designed or built).** `docs/pipeline/hotel-amenity-provenance/01-discovery.md` and `02-research.md` already establish that `HotelOffer` has no amenity fields, Hotellook normalization returns none, and the card has no amenity section. That pipeline stalled after research — no `03-design.md` exists, and confirmed via `git log` that the only related commit (`AUDIT-HOTEL-AMENITY-CLAIM-PROVENANCE-01`) added an audit report only, no code. Amenities remain entirely absent from the product today (verified via repo-wide grep for `amenit` — no hits outside an unrelated AI-headline file).
3. **Snapshot cohesion.** Star class and guest rating are already correctly ordered as compact collapsed-card chips (per `hotel-rating-source-confidence` design and `deal-supporting-facts-order`), but that hierarchy was decided before amenity highlights or a recency caveat existed as candidate fields. Adding either without re-checking scan-order risk crowding the collapsed card past what `deal-supporting-facts-order` established as the price → quality → confidence → handoff sequence.

## Affected Users And Flow Step

- **Who is affected:** Users scanning hotel result cards (`app/components/HotelCard.tsx`) trying to distinguish a cheap-but-risky hotel from a strong one, and users opening `Details` to decide whether to proceed to provider handoff.
- **Flow step:** Deal card scan (collapsed `HotelCard`) and deal detail decision support (expanded `Quality evidence` panel).

## Measurable Signal

- No field in `HotelOffer` or `HotelRatingEvidence` distinguishes review recency from data-fetch freshness — a QA check of `lib/types.ts:96-151` confirms only `fetchedAt` exists.
- No amenity field exists anywhere in `lib/types.ts`, `lib/providers/hotellook.ts`, or `HotelCard.tsx` — confirmed by grep and by the stalled `hotel-amenity-provenance` pipeline.
- Users cannot currently answer "are these reviews from stays like the one I'd book" or "does this hotel have the amenities I need" without leaving expaify for the provider link.

## Constraints

1. **No duplication of Deal Score.** Quality signals must stay separate from `lib/scoring/scoreDeal.ts` and `DealScore`/`DealBadge` — quality is about the property, price-normality is about the fare. Do not fold quality into the score's `verdict`/`percentile`.
2. **No duplication of shipped rating work.** Star class, guest review score, review count, and data-fetch freshness are done; new design work adds recency and amenities alongside them, not instead of them.
3. **Data integrity.** Neither review recency nor amenities may be fabricated or inferred client-side. If a provider does not return the underlying data (which Hotellook likely does not, per `hotel-amenity-provenance` research), the correct state is an explicit "not returned by provider" caveat, never a fake default.
4. **Accessibility and layout.** Any new snapshot content must stay usable at 375px without crowding the existing price/quality/CTA hierarchy the card already relies on, and must not rely on color alone.

## Success Statement

This is solved when a first-time user scanning hotel results can tell, without leaving expaify, whether a hotel's review score reflects recent stays or is stale, and whether the property has the amenities that matter for their trip — without either signal ever overstating what the provider actually returned.

## Handoff Notes For UXR

The research stage should:

- Read `docs/pipeline/hotel-amenity-provenance/02-research.md` first — its design directives for amenity provenance (canonical status values `confirmed`/`unavailable`/`not_returned`/`unknown`, max 3 collapsed amenities, no `includes`/`free`/`available` without provider support) should be validated, not re-derived from scratch.
- Rank quality signals for the "smallest trustworthy snapshot": given star class + verified review score + review count are already collapsed-card chips, where do a recency caveat and up to 3 amenity highlights fit in scan order without crowding price/CTA — should either be collapsed-card visible, or details-only?
- Investigate source data availability for review recency: does Hotellook's `cache.json` (or any other provider under consideration, e.g. `lib/providers/bookingComRapidApi.ts`) return anything resembling a most-recent-review date or review date distribution? If not, state plainly that recency is currently unbuildable without a new provider/field and define the conservative "recency not available" caveat copy for that case.
- Define source-data caveats: what expaify can honestly claim today (verified guest score, review count, hotel class) versus what it cannot (review recency, amenities) until a provider contract changes, so UXDES does not design UI for data that doesn't exist yet.
- Confirm whether amenity/recency work should proceed as its own ticket chain resuming `hotel-amenity-provenance`, or merge into one `hotel-quality-snapshot` design so the two caveats ship as one cohesive snapshot component instead of two unrelated additions to the card.
