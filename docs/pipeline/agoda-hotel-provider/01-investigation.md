# DEV-AGODA-HOTEL-PROVIDER-01 — Live Investigation

**Date:** 2026-08-19
**Scope:** Investigation + real live-call evidence only. No provider code was changed by this doc.
**Origin:** Helena's P10 roadmap Rank 3 ("Agoda + confirm Expedia depth"), Wave T2. Her stated condition for approving T2: verify Expedia's actual snapshot-median contribution first (see below — confirmed zero, not wired), and do a field-mapping sanity check on Agoda before writing any migration, specifically checking for the same "silent overwrite" pattern found in `DEV-DEAL-RATING-PROVENANCE-01` (TripAdvisor's guest score silently overwriting the hotel-class `stars` field).

## Expedia contribution check (blocking condition #2) — CONFIRMED ZERO

- `lib/pipeline/snapshot.ts`'s `PROVIDERS` array is `[fetchBookingCom15, fetchBookingComCoords, fetchTripAdvisor, fetchPricelineCom]` — Expedia is not present and never has been called.
- `lib/pipeline/otaLinks.ts` hardcodes `const expedia = undefined` for the outbound affiliate deeplink too (deliberately, per that file's own comments — the Travelpayouts account has no Expedia-specific affiliate credential).
- **Conclusion: Expedia contributes 0% to price snapshots and 0% of booking links today.** T2 is Agoda-only, per Helena's own stated fallback ("if Expedia's snapshot share is negligible... the T2 spec simplifies to Agoda-only").
- Separately (not part of T2, flagged for the owner): the homepage hero and Terms of Service both currently claim expaify watches/earns commission across "Expedia, Booking.com, Kiwi, Trip.com" — none of the four have a real attributed link right now (all four are `undefined` in `otaLinks.ts`, each with its own documented reason). Copy accuracy, not an engineering blocker for T2.

## Agoda field-mapping sanity check (blocking condition #1) — CONFIRMED SAFE, no conflation risk

Live-verified against `agoda-com.p.rapidapi.com` using `RAPIDAPI_KEY_3` (same account bundle already confirmed subscribed to this host in `docs/pipeline/rapidapi-audit/01-inventory.md`). Real calls made for Paris (cityId 15470) with real future check-in/out dates.

**Real endpoints (found via the RapidAPI hub's live Playground UI, then independently confirmed with real authenticated calls — not guessed):**

1. `GET /hotels/auto-complete?query={cityName}` — destination resolution. Real response shape:
   ```json
   { "places": [{ "id": 15470, "name": "Paris", "typeId": 1, "typeName": "City", "country": {...}, "activeHotels": 14318 }] }
   ```
   `typeId: 1` = City. The search endpoint's `id` param is `{typeId}_{id}`, e.g. `1_15470` for Paris — confirmed by cross-checking that New York independently resolved to raw id `318`, matching the RapidAPI doc's own example URL `?id=1_318`.

2. `GET /hotels/search-overnight?id={typeId}_{cityId}&checkinDate={YYYY-MM-DD}&checkoutDate={YYYY-MM-DD}&adults=2&rooms=1&currency=USD` — hotel search. **Param names are `checkinDate`/`checkoutDate`, not `checkIn`/`checkOut`** — confirmed live: the wrong names produce a real `{"errors":{"checkoutDate":"checkoutDate is required","checkinDate":"checkinDate is required"}}` 200-with-errors response, not a 4xx.

**Real per-hotel response shape** (`data.citySearch.properties[]`, 11 real Paris results returned in the live test call):

| Field | Path | Notes |
|---|---|---|
| Hotel ID | `propertyId` (top-level int) | |
| Hotel name | `content.informationSummary.localeName` | |
| Property-class stars | `content.informationSummary.rating` | 1.0–5.0. **Confirmed genuinely independent from guest review score** — live sample had hotels where `rating: 1.0` paired with guest `score: 6.7`, and `rating: 2.0` paired with guest `score: 9.0`. This is NOT the TripAdvisor bug: Agoda's own schema already separates property class from guest sentiment, so mapping `rating` → `stars` (same as the existing Booking.com/Priceline convention) is safe with no overwrite risk. |
| Guest review score + count | `content.reviews.cumulative.score` (0–10 scale, NOT 0–5) and `content.reviews.cumulative.reviewCount` | **Out of scope for this ticket.** T1 already built the `HotelReviewEvidence` pipeline for TripAdvisor; wiring Agoda as a second review source is a separate, later ticket if wanted — this ticket is price/inventory only, to keep it one change at a time. |
| Photo | `content.images.hotelImages[0].urls[0].value` | **Protocol-relative** (`//pix7.agoda.net/...`), needs `https:` prepended before use — unlike TripAdvisor's fully-qualified URLs. |
| Price (real, all-in) | `pricing.offers[0].roomOffers[0].room.pricing[0].price.perRoomPerNight.inclusive.display` | **Must use `.inclusive`, never `.exclusive`** — `.exclusive` is the pre-tax/pre-fee teaser figure. Live sample: one hotel showed `exclusive.display: 759.21` vs `inclusive.display: 938.48` for the same room/night — a ~24% gap, the same class of teaser-price trap already documented and avoided for Priceline's `ratesSummary.minPrice` in this same file. |
| Sold-out / unavailable | `propertyResultType === 'SoldOutProperty'` | These entries have no `pricing.offers` array at all (accessing it throws). Must be filtered out before price extraction, same as the existing `priceCents <= 0` discard pattern used by every other provider in this file. |
| Sponsored flag | `sponsoredDetail.isShowSponsoredFlag` | ~36% of the live Paris sample (4/11) had this `true`. Their prices were real, ordinary numbers in the same range as organic results (not inflated/deflated placeholders) — this looks like ranking/placement boosting, not a price-truthfulness issue, so **no special handling needed** beyond what every provider already does (the median calculation already absorbs price variance across many snapshots; this is not a "fabricated price" the way `.exclusive` would be). |

## City ID resolution — all 26 active markets, live-resolved

Per the established pattern (`TA_GEO`, `PL_CITY` — pre-resolve once, don't do destination lookup in the daily job path), every currently active market in `tracked_markets` was resolved live via `hotels/auto-complete` just now, zero failures:

```
MIA:15289  NYC:318    CUN:5954   PAR:15470  ROM:16594  BCN:2002   LIS:16364  LON:233
TYO:5085   BKK:9395   DXB:2994   LAS:17072  MCO:10757  SJU:17823  AMS:13868  ATH:16571
PUJ:3332   CLT:12113  BNA:2703   TUL:19741  CAI:7923   HRG:6700   SSH:15897  AYT:7493
IST:14932  BJV:3253
```

All resolved via `typeId: 1` (City) matches on the plain English city name already used elsewhere in this codebase (`tracked_markets.city`). This is **26/26 coverage** — better than TripAdvisor's 16/20, and specifically includes all 6 new P7 Egypt/Turkey cities (Cairo, Hurghada, Sharm El Sheikh, Antalya, Istanbul, Bodrum), which is the actual reason T2 is more urgent now per Helena.

## Recommendation

Wire Agoda in as a 5th provider in `PROVIDERS`. Given the account-bundle overlap already noted in the RapidAPI audit (same underlying account as `RAPIDAPI_KEY_3`/`RAPIDAPI_KEY_BOOKING_2`, both already confirmed subscribed to this host), use `RAPIDAPI_KEY_3` directly (env var not yet used by any live provider) rather than threading it through the shared rotation `key` param — same pattern already used for `RAPIDAPI_KEY_PRICELINE` in `fetchPricelineComProvider`, which reads its own env var independently.
