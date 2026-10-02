# UX Research: richer hotel media/review data, audited across all 4 real providers

Ticket: UXR-HOTEL-VIEW-RICHER-MEDIA-01

## Audit of all 4 real providers (read directly from `lib/pipeline/snapshot.ts`, not assumed)

| Provider | Photos available in raw response | Photos kept today | Review signal available | Review signal kept today |
|---|---|---|---|---|
| **Booking.com15** (`fetchBookingCom15Page`) | `property.photoUrls[]` — confirmed live: **3 real URLs** for a sample hotel | `photoUrls[0]` only | `reviewScore`, `reviewCount`, `reviewScoreWord` — confirmed present in the same live response | **None.** No `review_evidence` populated for this provider at all |
| **TripAdvisor16** (`fetchTripAdvisor`) | `hotel.cardPhotos[]` (array of `{sizes:{urlTemplate}}`) | `cardPhotos[0]` only | `bubbleRating.{rating,count}` | **Already captured properly** via `tripAdvisorBubbleRatingToReviewEvidence` → the shared `review_evidence` JSONB column |
| **Agoda** (`fetchAgoda`) | `content.images.hotelImages[]` (array of `{urls[]}`) | `hotelImages[0].urls[0]` only | `informationSummary.rating` | Partially — reused as `stars`, but no review COUNT captured, no `review_evidence` populated |
| **Booking.com v1 coords** (`fetchBookingComCoords`) | Not yet audited for a photo array (lower priority — reads `RAPIDAPI_KEY_PRICELINE`, a secondary/fallback-only provider by current call volume) | 1 field read | Not yet audited | — |

**The core finding, stated precisely**: this is not "we need a new photo/review feature built from
nothing." Three of four providers already send more photos and/or review data than we store, inside
the exact same API calls this pipeline already makes every single night. TripAdvisor's
`review_evidence` pattern already proves the storage/display mechanism works end to end for one
provider — the gap is that Booking.com (the dominant provider by real hotel count in this pipeline)
was never wired into that same mechanism, and no provider has ever kept more than its first photo.

## Reference pattern: Booking.com's own real hotel page

Since every hotel this product displays is literally sourced from Booking.com (directly or via
TripAdvisor/Agoda as alternates), Booking's own hotel detail page is the natural, directly-relevant
reference — not an arbitrary competitor. Its real pattern, at the interaction-pattern level (not
visual style):
- A photo **gallery**, not a single hero image — a primary photo plus a visible strip/grid of
  thumbnails, with a "see all N photos" affordance when there are more than fit inline.
- A **review score badge** directly adjacent to the hotel name/price (e.g. "8.6 Excellent · 1,204
  reviews") — visible without scrolling, exactly where a user is deciding whether to trust the deal.
- Real review **count**, not just a score — a score alone ("4.5") carries far less trust signal than
  a score backed by a visible sample size ("4.5 · 1,204 reviews" reads as credible; "4.5" alone could
  be 3 reviews).

## The exact gap, precisely restated

`app/deals/[dealId]/page.tsx` renders exactly one `<PropertyPhoto>` from a single stored
`photo_url` column, and zero review-score UI anywhere on the page — while the pipeline already
receives (for the majority of hotels, via Booking.com15 and TripAdvisor) multiple real photos and a
real review score/count every night, currently discarded before storage.

## Design directives

1. **Schema**: add `photo_urls TEXT[]` to both `price_snapshots` and `deals`, additive alongside
   the existing singular `photo_url` (kept for backward compatibility with any code still reading
   it directly) rather than a breaking rename. A real raw-SQL `ALTER TABLE ... ADD COLUMN IF NOT
   EXISTS` appended to `schema.sql` (this repo's actual convention — no migration framework), not
   applied to production without explicit go-ahead.
   **Correction after checking live production** (`\d deals`, 2026-10-02): `deals.review_evidence`
   already exists in real production and is already read/written by `detectDealsForMarket`'s
   upsert — `schema.sql` had simply never documented it (a known, repo-acknowledged drift pattern;
   see its own git history, "sync schema.sql to match real production drift"). So Booking's new
   review data needs no new column at all, just the provider-side capture already built.
2. **Provider capture — photos**: extend `fetchBookingCom15Page`, `fetchTripAdvisor`, and
   `fetchAgoda` to keep the FULL real array each already receives (`photoUrls`, `cardPhotos` mapped
   through the existing `urlTemplate` replacement, `hotelImages` respectively), not just index 0.
   Cap at a sane maximum (e.g. 8) to bound storage/payload size — never fabricate past what the
   provider actually returned.
3. **Provider capture — reviews**: extend `fetchBookingCom15Page` to populate `review_evidence`
   using the SAME shared `HotelReviewEvidence` type TripAdvisor already proves out (score, count,
   `state: 'ready'`, `provenance: 'provider_only'`) — mapping Booking's real `reviewScore`
   (confirmed out of 10, not TripAdvisor's /5 — scaleMax must stay provider-accurate)/`reviewCount`
   fields, not inventing a new shape. `reviewScoreWord` ("Excellent") has no equivalent field on any
   other provider and no matching slot on the shared type — derive an equivalent label from the
   numeric score at display time instead, so every provider's hotels get a consistent label.
   **Correction found during implementation**: Agoda does NOT get the same treatment. Checked its
   real raw response directly — the only candidate field
   (`enrichment.uniqueSellingPoint[].uspType === 'ReviewScore'`) is segment-specific (seen live
   tagged `"segment": "Solo"`, rank 1) with no accompanying review count. Presenting that as the
   hotel's general review score would be exactly the "fabricated/misleading" failure mode this
   ticket's own constraint #2 rules out. Agoda keeps its existing `rating`-as-`stars` mapping only;
   no `review_evidence` for Agoda in this pass.
4. **UI — gallery**: replace the single `<PropertyPhoto>` call site (both instances, lines 479 and
   694) with a real gallery component — primary photo + thumbnail strip, falling back gracefully to
   today's single-photo behavior when a hotel genuinely only has 1 real photo (tracked-hotel
   fallback rows, locked rows, or any provider that only ever returns 1). Never pad with a
   placeholder/stock image to reach a target count.
5. **UI — review badge**: new component rendering `score · scoreWord · count reviews` directly next
   to the hotel name (matching the reference pattern's placement), rendered only when
   `review_evidence.state === 'ready'` — the existing TripAdvisor data already has a real, tested
   `not_provided` state for exactly the "don't fabricate" case, reuse it rather than inventing a new
   absent-state convention.

## Explicitly not in scope (confirmed, not assumed)

- `getHotelDetails`-sourced full amenity lists, long-form descriptions, room-type detail: a separate,
  larger initiative needing one extra API call per hotel (not per market) — a real cost/latency
  question to scope on its own, not bundled into this first pass.
- Any change to deal-detection/scoring/threshold logic (`MIN_QUALIFYING_DISCOUNT_PCT`,
  `MIN_SNAPSHOTS`, anchor-date selection) — this is display + data-capture only.
- Booking.com v1 coords provider's photo/review audit — lower priority given its smaller real call
  share; flagged for a follow-up pass, not blocking this ticket.
