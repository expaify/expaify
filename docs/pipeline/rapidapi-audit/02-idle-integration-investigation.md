# Idle RapidAPI Hotel Integrations — Investigation

**Ticket:** `DEV-INVESTIGATE-IDLE-RAPIDAPI-INTEGRATION-01`  
**Date:** 2026-08-16  
**Scope:** Investigation only. No provider or pipeline code was changed.

## Executive conclusion

Only **Tripadvisor COM** is close enough to the current pipeline contract to justify a focused follow-up. It has a live, date-aware hotel-search endpoint, accepts the same TripAdvisor `geoId` concept already used by the pipeline, and could plausibly be a one-call fallback. It is nevertheless **not implementation-ready from the retained audit evidence**: the inventory records a real 200 hotel listing response but does not retain the response body, field paths, price semantics, or rate-limit headers needed to write a truthful parser and quota guard.

**Hotels com Provider** is worth one more endpoint-discovery investigation, not wiring now. The only verified response is a region lookup. That can supply destination IDs, but it is not hotel inventory and cannot produce a single `HotelEntry` field by itself.

**Agoda Com** and **Expedia** should not enter the rotation now. Their subscriptions are real, but no working path or real response body was found. Adding guessed clients would violate the evidence standard and would turn paid capacity into silent empty fallbacks.

No audited idle subscription has enough captured quota evidence to support production rollout without a small live quota/header probe. The Google API's 20,000 requests/month header proves only that separate API's plan; RapidAPI quotas are API/subscription-specific and it cannot be used as quota evidence for these four hotel APIs.

## What the snapshot pipeline actually requires

`HotelEntry` in `lib/pipeline/snapshot.ts` has exactly five fields:

| Field | Requirement |
|---|---|
| `hotelId` | Non-empty stable provider hotel identifier; the adapters prefix IDs by provider family to avoid collisions. |
| `hotelName` | Non-empty display name. |
| `stars` | Numeric rating or `null`. The current TripAdvisor adapter uses `bubbleRating.rating`, so this field is not consistently a formal hotel-class rating today. |
| `priceCents` | Positive integer **USD price per night**. This is the decisive field: entries without a positive price are discarded. Total-stay prices must be divided by `NIGHTS` (currently 2), and teaser/pre-tax prices must not be presented as the real nightly price. |
| `photoUrl` | Image URL or `null`. |

There is no location, address, latitude/longitude, review count, deeplink, or currency field in `HotelEntry`. Market location comes separately from the `Market` passed to `storeSnapshot`, and stored currency is hard-coded to USD. A provider therefore maps “cleanly” only if its search response contains a stable ID, name, unambiguous positive USD nightly (or two-night total) price, and preferably rating/photo. Rating and photo may validly be `null`; ID, name, and price may not.

`ProviderFn` is:

```ts
(iata: string, ci: string, co: string, key: string) => Promise<HotelEntry[]>
```

The provider must resolve the pipeline's IATA-like market key to its own destination identifier, make a bounded request, return `[]` for unsupported/non-OK responses, and throw `RateLimitError` on HTTP 429. The rotation tries providers sequentially from `(marketIndex % providerCount)` and stops at the first non-empty result. This is a fallback rotation, not a fan-out that calls every provider for every market.

## Concrete call-volume analysis

### Current market and request counts

The SQL seed contains **20 markets**, all defaulting active. Repository documentation says current production runs have **19 active markets**, matching the comment in `snapshot.ts`. The runtime source of truth is the database query `WHERE active = true`, so this report uses 19 for current daily arithmetic and notes 20-market bounds where relevant.

There is one anchor check-in per market per daily run. The earlier three-offset scheme therefore had a nominal floor of **57 successful searches/day** (19 markets × 3 dates). The current scheme has a nominal floor of **19 successful searches/day** (19 × 1). The incident described near `getAnchorCheckInDate()` is consistent with why the reduction matters: exhausting after roughly seven markets under the old scheme means failure after roughly 21 search attempts if each market consumed its three date calls, although the code comment does not preserve the exact plan limit or response headers.

The nominal floor is not a hard actual count. Empty, non-OK, timed-out, or unconfigured providers cause fallback calls:

- With four providers and 19 sequential market indexes, starting positions are distributed **5/5/5/4**.
- `fetchBookingComCoords` targets `booking-com.p.rapidapi.com`, while the audit re-verifies that the production account is not subscribed to that host. Every time it is reached it still spends an HTTP attempt before returning `[]`. If all other starting providers succeed, this raises the practical total from 19 to about **24 HTTP calls/day** (five coordinate-provider starts each followed by a useful fallback).
- `fetchTripAdvisor` has `geoId` mappings for 16 of the 20 seeded markets. An unmapped market returns `[]` without an HTTP call, then falls through.
- If every provider returned empty, the current upper bound for 19 active markets is **72–73 HTTP calls/day**: Booking city (19) + Booking coordinates (19) + Priceline (19) + TripAdvisor for either 15 or 16 mapped active markets. For all 20 seeded markets it is **76**. This is a failure bound, not expected healthy traffic.

### What adding a provider really costs

Appending a reliable fifth provider does **not automatically add 19 calls/day**. It changes the modulo distribution to **4/4/4/4/3** across 19 markets. If appended as index 4, it would be first choice for three markets and would ordinarily make about **3 calls/day**, while total successful-search traffic remains at the 19-call floor. It can be reached as a fallback in other markets, so its per-subscription worst case is **19 calls/day**. A sixth provider would have starting distribution **4/3/3/3/3/3**, ordinarily about three calls/day for an appended provider, again with a 19-call/day per-provider fallback ceiling.

This assumes a one-request hotel search using pre-resolved destination IDs. A provider requiring live destination lookup plus hotel search costs two requests whenever used: about **6–8 calls/day** as a healthy first-choice provider and up to **38/day** if reached for every market. The existing pattern avoids that by keeping `BK_DEST`, `TA_GEO`, and `PL_CITY` maps in code. Any Hotels.com integration should similarly resolve and validate Gaia IDs once, outside the daily job.

Adding providers also changes which provider snapshots each market. Because hotel IDs are provider-prefixed, a broader rotation means each provider/hotel/date series is sampled less frequently. That may delay reaching the downstream minimum snapshot count. Provider count therefore has an accumulation cost even when HTTP totals stay flat.

## Subscription assessments

### 1. Tripadvisor COM — `tripadvisor-com1.p.rapidapi.com` (PRO)

**Verified evidence.** `GET /hotels/search?geoId=187147&checkIn=...&checkOut=...` returned real Paris hotel listings with HTTP 200. The audit also shows this subscription is available through the same account bundle as `RAPIDAPI_KEY_3` / `RAPIDAPI_KEY_BOOKING_2`.

**Mapping to `HotelEntry`.** The request shape is an excellent fit for the adapter interface: it is date-aware and uses `geoId`, so the existing `TA_GEO` mapping is likely reusable at the request level. However, the inventory does **not** record the returned JSON field paths. It does not establish which fields contain hotel ID, name, photo, rating, or price, whether price is nightly or stay-total, whether it includes taxes/fees, or whether USD must be requested explicitly. A real hotel-list response proves the endpoint category, but not a safe `HotelEntry` mapping. The response must be captured and price semantics verified before implementation. The existing `tripadvisor16` parser must not be copied on the assumption that two different RapidAPI products share JSON.

**Coverage and redundancy.** This is substantially redundant with the existing `tripadvisor16` provider: same brand/source family, same geo-ID concept, and likely overlapping inventory. Its best value is account/API failover and filling TripAdvisor gaps, not adding an independent OTA price signal. It also appears to share an account-level subscription bundle with the currently unused keys, while the existing `tripadvisor16` call uses `RAPIDAPI_KEY`; key/account provenance should be made explicit before treating it as independent failover.

**Quota cost.** If appended as a one-call fifth provider and reliable, about **3 calls/day**, with a **19/day** worst-case reach rate. That is about 90 nominal or 570 maximum calls per 30-day month. No rate-limit headers or request limit for this subscription were retained in the audit. The `PRO` label alone does not define a numeric allowance, and the unrelated Google API 20k/month limit is not evidence of this plan's headroom.

**Recommendation: worth wiring in, but needs one focused investigation first.** Capture the real response and rate headers; prove an all-in USD nightly price; test several mapped and currently unmapped markets; then implement only if it offers useful reliability/coverage beyond `tripadvisor16`. It should replace or fail over for a weak slot rather than merely increase provider count without an accumulation analysis.

### 2. Hotels com Provider — `hotels-com-provider.p.rapidapi.com` (PRO)

**Verified evidence.** `GET /v2/regions?query=Paris&domain=US&locale=en_US` returned real region/Gaia data with HTTP 200. This confirms a usable destination-resolution endpoint, not a hotel-search endpoint.

**Mapping to `HotelEntry`.** The verified region payload maps to **none** of the five fields. A Gaia/region identifier is input metadata for a later search; it is not a hotel ID, hotel name, price, rating, or photo. No working hotel-list endpoint, response shape, price semantics, or image/rating paths are recorded in the audit. It is therefore not currently possible to write a non-fabricated adapter.

**Coverage and redundancy.** If a real hotel search is found, the source would likely overlap strongly with Expedia/Hotels.com inventory and with the existing Booking/Priceline breadth. Its potential value is an additional OTA-family signal, but that cannot be measured from a region lookup. It is less immediately redundant than a second TripAdvisor wrapper, but much less implementation-ready.

**Quota cost.** A naive daily region lookup plus hotel search would cost about **6 calls/day nominal** as an appended fifth provider and up to **38/day** if reached for every market. The correct design would pre-resolve all market Gaia IDs once, reducing runtime cost to the same **~3/day nominal, 19/day maximum** one-call search profile. No Hotels com Provider rate-limit header or numeric allowance appears in the audit; `PRO` is insufficient to estimate headroom.

**Recommendation: worth further endpoint investigation, not wiring now.** Find and live-test the actual hotel-search endpoint, preserve a sample response and headers, validate price truthfulness, and pre-resolve Gaia IDs. If no listing endpoint can be demonstrated, retire it from pipeline consideration.

### 3. Agoda Com — `agoda-com.p.rapidapi.com` (PRO)

**Verified evidence.** The 404-versus-403 gateway signal confirms an active subscription. No real working endpoint was found and no response body exists in the audit.

**Mapping to `HotelEntry`.** Unknown and blocked. There is no evidence for any field path or for a date-aware, USD-priced hotel search. Agoda's product category is not enough to infer JSON or price semantics, and no shape should be guessed.

**Coverage and redundancy.** Agoda could add meaningful Asia-Pacific inventory relative to the current provider set, which matters for Tokyo and Bangkok. That is a plausible product hypothesis, not demonstrated evidence. Coverage, stable IDs, photos, and all-in price quality remain untested.

**Quota cost.** It cannot be estimated beyond rotation bounds until request topology is known. A one-call search would be **~3/day nominal and 19/day maximum** as an appended fifth provider; a required lookup plus search would double that unless destination IDs are pre-resolved. No numeric quota header was captured. The `PRO` label and Google API's separate 20k/month quota do not establish Agoda headroom.

**Recommendation: worth investigating first, but not ready to wire.** It has the strongest plausible differentiated-coverage case of the four, but endpoint discovery and a retained real response are hard blockers.

### 4. Expedia — `expedia13.p.rapidapi.com` (PRO)

**Verified evidence.** The gateway signal confirms an active subscription. No working endpoint or real response body was found.

**Mapping to `HotelEntry`.** Unknown and blocked for the same evidence reason as Agoda. There is no verified hotel-search path, field mapping, or price basis.

**Coverage and redundancy.** Expedia would likely overlap with Hotels.com because both are Expedia Group brands, and it may overlap broadly with existing Booking/Priceline inventory. Without a real listing response and cross-provider comparison, there is no demonstrated incremental coverage or price-quality benefit. Investigating both Expedia and Hotels com Provider as separate production additions is unlikely to be the best first use of time; resolve the better-documented Hotels.com host first.

**Quota cost.** Unknown request topology. Bounds are **~3/day nominal, 19/day maximum** for a one-call appended provider, or twice that if live lookup is required. No Expedia-specific quota header or numeric plan allowance is retained in the audit.

**Recommendation: not worth wiring now.** Keep the subscription in inventory, but defer endpoint work until Tripadvisor COM and Hotels com Provider have been resolved. Reconsider only if it demonstrates distinct coverage, pricing, or reliability rather than duplicating the same Expedia Group supply.

## Ranked decision

| Rank | Subscription | Decision | Why |
|---:|---|---|---|
| 1 | Tripadvisor COM | Investigate once more, then wire conditionally | Real one-call hotel search exists and request identifiers align with the current pipeline; response and quota evidence are missing, and coverage is redundant. |
| 2 | Hotels com Provider | Investigate listing endpoint first | Real destination lookup exists, but no hotel inventory response exists yet. Pre-resolved Gaia IDs could keep daily cost low. |
| 3 | Agoda Com | Endpoint/coverage investigation only | No working path, but potentially differentiated APAC coverage makes it more interesting than Expedia if discovery effort is available. |
| 4 | Expedia | Do not wire now | No working path and likely high redundancy with Hotels.com plus existing broad OTAs. |

## Recommended next-step tickets

1. **`DEV-INVESTIGATE-TRIPADVISOR-COM-SHAPE-01`** — Capture real hotel-search JSON and rate-limit headers for multiple markets/dates; verify stable IDs, image/rating fields, USD price basis, taxes/fees, and nightly-versus-stay-total semantics.
2. **`DEV-INVESTIGATE-HOTELS-COM-PROVIDER-SEARCH-01`** — Discover and live-test the hotel-list endpoint, retain response/header evidence, and resolve Gaia IDs for all active markets without putting region lookup in the daily path.
3. **`DEV-INVESTIGATE-AGODA-COM-ENDPOINT-01`** — Find a real date-aware hotel-search path and compare verified Tokyo/Bangkok coverage and all-in prices against current providers before considering an adapter.
4. **`DEV-AUDIT-HOTEL-ROTATION-QUOTA-TELEMETRY-01`** — Record per-host request counts and rate-limit headers in daily runs, reconcile the documented 19-call floor with fallback attempts, and define a safe rollout threshold before adding any fifth provider.
5. **`DEV-AUDIT-HOTEL-ROTATION-ACCUMULATION-01`** — Model how a fifth provider changes per-hotel snapshot frequency and time to the downstream minimum snapshot count; decide whether new capacity should replace a broken/redundant slot instead of extending the array.
