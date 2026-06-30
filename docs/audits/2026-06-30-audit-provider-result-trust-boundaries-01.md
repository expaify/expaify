# AUDIT-PROVIDER-RESULT-TRUST-BOUNDARIES-01

Date: 2026-06-30
Scope: Backend audit only. No provider, ranking, Deal Score, cache, or UI behavior changed.

## Verdict

Fail for full provider trust-boundary compliance.

The main search provider calls mostly preserve nonthrowing `Result<T>` behavior: adapter network, JSON, HTTP, and cache exceptions are caught inside the public adapter methods and converted to `{ ok: false, reason }`. `/api/search` then streams provider notices or hotel status instead of throwing provider failures to the results UI.

The failing trust boundaries are narrower but P0 because they can affect paid-user booking or result trust:

- `POST /api/book` calls Duffel directly from an API route, outside `lib/providers`, so booking has no provider adapter `Result<T>` boundary.
- Provider cache hits are returned as typed data without shape or money validation, so poisoned or stale malformed cache entries can reach ranking, cards, score calls, and booking links.
- Duffel, Amadeus, and Hotellook can collapse malformed individual provider rows into `ok: true` partial or empty data, making malformed supply indistinguishable from true no-supply.

## Requested File Blockers

The assigned ticket said to inspect these first, but they are absent in this worktree:

- `app/api/tickets/route.ts`
- `app/api/tickets/[id]/route.ts`
- `app/api/run/[id]/route.ts`
- `app/api/board-stream/route.ts`
- `lib/db.ts`

Actual inspected equivalents and provider consumers:

- `lib/providers/*`
- `app/api/search/route.ts`
- `app/api/score/route.ts`
- `app/api/book/route.ts`
- `app/api/calendar/route.ts`
- `scripts/snapshot-job.ts`
- `lib/db/client.ts`
- `lib/cache/redis.ts`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- Provider unit tests under `lib/providers/__tests__`

## Provider Entry Points

| Entry point | Throws to caller? | Money boundary | Empty/error/malformed behavior | Status |
| --- | --- | --- | --- | --- |
| `TravelpayoutsProvider.priceTrends` | No for normal external/cache/JSON errors; catch wraps errors at `lib/providers/travelpayouts.ts:92` to `lib/providers/travelpayouts.ts:126`. | Converts major units to `PricePoint.priceCents` plus `USD` at `lib/providers/travelpayouts.ts:116` to `lib/providers/travelpayouts.ts:120`. | HTTP and malformed return `{ ok: false }`; malformed entries throw internally but are caught. Cache hit is trusted without validation at `lib/providers/travelpayouts.ts:93` to `lib/providers/travelpayouts.ts:94`. | P1 cache trust gap. |
| `TravelpayoutsProvider.searchFares` | No for fetch/cache/JSON errors; catch wraps at `lib/providers/travelpayouts.ts:143` to `lib/providers/travelpayouts.ts:307`. | Emits `price: { priceCents, currency: 'USD' }` at `lib/providers/travelpayouts.ts:190`, `lib/providers/travelpayouts.ts:242`, and `lib/providers/travelpayouts.ts:292`. | Missing token/marker returns `{ ok: false }`; malformed rows return `{ ok: false }`. HTTP failures from sub-endpoints are skipped, so partial outage can become `ok: true`. Cache hit trusted at `lib/providers/travelpayouts.ts:144` to `lib/providers/travelpayouts.ts:145`. | P0 partial/cached trust gap. |
| `DuffelProvider.priceTrends` | No external work; returns `{ ok: true, data: [] }` at `lib/providers/duffel.ts:97` to `lib/providers/duffel.ts:99`. | No money returned. | Explicit no trend data. | Pass. |
| `DuffelProvider.searchFares` | No for fetch/cache/JSON errors; catch wraps at `lib/providers/duffel.ts:136` to `lib/providers/duffel.ts:225`. | Parses decimal string to integer cents and preserves currency at `lib/providers/duffel.ts:182` and `lib/providers/duffel.ts:201` to `lib/providers/duffel.ts:204`. | Missing config/HTTP/top-level malformed return `{ ok: false }`; malformed offers are filtered out at `lib/providers/duffel.ts:179` to `lib/providers/duffel.ts:220`. Cache hit trusted at `lib/providers/duffel.ts:137` to `lib/providers/duffel.ts:138`. | P0/P1 trust gap. |
| `AmadeusProvider.priceTrends` | No external work; returns `{ ok: true, data: [] }` at `lib/providers/amadeus.ts:99` to `lib/providers/amadeus.ts:101`. | No money returned. | Explicit no trend data. | Pass. |
| `AmadeusProvider.searchFares` | No for token/search/cache/JSON errors; catch wraps at `lib/providers/amadeus.ts:122` to `lib/providers/amadeus.ts:244`. Private `getToken` can throw internally on cache/fetch/JSON, but callers reach it inside that try block. | Parses `grandTotal` to integer cents and preserves currency at `lib/providers/amadeus.ts:207` to `lib/providers/amadeus.ts:222`. | Missing config/token HTTP/search HTTP/top-level malformed return `{ ok: false }`; malformed offers are filtered out at `lib/providers/amadeus.ts:176` to `lib/providers/amadeus.ts:239`. Cache hit trusted at `lib/providers/amadeus.ts:123` to `lib/providers/amadeus.ts:124`. | P0/P1 trust gap. |
| `KiwiProvider.priceTrends` | No external work; returns `{ ok: true, data: [] }` at `lib/providers/kiwi.ts:106` to `lib/providers/kiwi.ts:108`. | No money returned. | Explicit no trend data. | Pass. |
| `KiwiProvider.searchFares` | No for fetch/cache/JSON errors; catch wraps at `lib/providers/kiwi.ts:126` to `lib/providers/kiwi.ts:220`. | Converts numeric price to integer cents and sets `USD` at `lib/providers/kiwi.ts:182` to `lib/providers/kiwi.ts:200`. | Unapproved/unconfigured/no attribution/HTTP/top-level malformed/row malformed/invalid price/invalid deeplink return `{ ok: false }`. Cache hit trusted at `lib/providers/kiwi.ts:127` to `lib/providers/kiwi.ts:128`. | P1 cache trust gap. |
| `HotellookProvider.searchHotels` | No for fetch/cache/JSON errors; catch wraps at `lib/providers/hotellook.ts:69` to `lib/providers/hotellook.ts:120`. | Converts `priceFrom` to `pricePerNight.priceCents` plus `USD` at `lib/providers/hotellook.ts:32` to `lib/providers/hotellook.ts:42` and `lib/providers/hotellook.ts:107` to `lib/providers/hotellook.ts:110`. | Missing config/HTTP/top-level malformed return `{ ok: false }`; malformed hotel rows are filtered out at `lib/providers/hotellook.ts:91` to `lib/providers/hotellook.ts:115`. Cache hit trusted at `lib/providers/hotellook.ts:70` to `lib/providers/hotellook.ts:71`. | P0/P1 trust gap. |

## Findings

### P0: Booking bypasses provider boundary and calls Duffel directly

Evidence: `app/api/book/route.ts` defines Duffel `BASE_URL` at line 4, then calls `fetch` for `/air/offers/${offerId}` at `app/api/book/route.ts:110` to `app/api/book/route.ts:115` and `/air/orders` at `app/api/book/route.ts:156` to `app/api/book/route.ts:184`.

Contract break: The non-negotiable contract says every external API call goes through `lib/providers`. This route has its own local Duffel response interfaces and money parser at `app/api/book/route.ts:16` to `app/api/book/route.ts:35`, outside the adapter boundary.

Caller impact: Thrown malformed response paths are caught by the route-level catch and returned as generic `{ ok: false, reason: 'Booking unavailable. Please try again later.' }` at `app/api/book/route.ts:214` to `app/api/book/route.ts:219`, so callers do not receive a thrown exception. The trust issue is that malformed Duffel booking payloads bypass provider-level `Result<T>` validation and lose precise reason classification before a paid booking action.

Recommended narrow repair ticket: Move Duffel offer refresh and order creation behind `lib/providers/duffel.ts` methods that return `Result<T>` with validated response shapes; have `app/api/book/route.ts` call only those methods and preserve price/passenger mismatch handling.

### P0: Cached provider data is trusted without validation before UI, ranking, scoring, or booking

Evidence: Each adapter returns cache hits directly as typed data:

- Travelpayouts trends and fares at `lib/providers/travelpayouts.ts:93` to `lib/providers/travelpayouts.ts:94` and `lib/providers/travelpayouts.ts:144` to `lib/providers/travelpayouts.ts:145`.
- Duffel fares at `lib/providers/duffel.ts:137` to `lib/providers/duffel.ts:138`.
- Amadeus token and fares at `lib/providers/amadeus.ts:70` to `lib/providers/amadeus.ts:71` and `lib/providers/amadeus.ts:123` to `lib/providers/amadeus.ts:124`.
- Kiwi fares at `lib/providers/kiwi.ts:127` to `lib/providers/kiwi.ts:128`.
- Hotellook hotels at `lib/providers/hotellook.ts:70` to `lib/providers/hotellook.ts:71`.

Contract break: `cache.get<T>` is a cast after `JSON.parse` at `lib/cache/redis.ts:20` to `lib/cache/redis.ts:23`; it does not prove `priceCents` is a positive integer, `currency` exists, deeplinks are attributed, or required route fields exist.

Caller impact: `/api/search` sorts and de-dupes flight results by `fare.price.priceCents` at `app/api/search/route.ts:24` to `app/api/search/route.ts:31`, streams cards at `app/api/search/route.ts:215` to `app/api/search/route.ts:229`, and the client fires Deal Score requests for streamed fares. A malformed cached fare can therefore affect ranking, visible card copy, score input, and Duffel booking URL generation without touching a live provider.

Recommended narrow repair ticket: Add adapter-local cache read validators for `NormalizedFare[]`, `PricePoint[]`, and `HotelOffer[]`; treat invalid cached payloads as cache misses or `{ ok: false, reason: '<provider> cached payload malformed' }` without changing cache key or TTL behavior.

### P0: Malformed rows can become successful empty or partial supply

Evidence:

- Duffel validates the top-level response but filters bad offers to `null` and returns the filtered array at `lib/providers/duffel.ts:179` to `lib/providers/duffel.ts:223`.
- Amadeus validates the top-level response but filters bad offers to `null` and returns the filtered array at `lib/providers/amadeus.ts:176` to `lib/providers/amadeus.ts:242`.
- Hotellook filters bad entries out with `flatMap` and returns the filtered array at `lib/providers/hotellook.ts:91` to `lib/providers/hotellook.ts:118`.

Contract break: A provider response with an array of unusable offers is not true no-supply. Returning `ok: true, data: []` makes malformed data indistinguishable from an honest empty response.

Caller impact: `/api/search` sends a no-supply notice only when all providers return no rows and no failures at `app/api/search/route.ts:233` to `app/api/search/route.ts:240`, and sends hotel `empty` when Hotellook returns `ok: true, data: []` at `app/api/search/route.ts:248` to `app/api/search/route.ts:253`. Users can see no-results or partial-results copy even though provider data was malformed.

Recommended narrow repair ticket: In each adapter, count malformed rows. If the response contains rows and any required money/route/booking fields are malformed, return `{ ok: false, reason: '<provider> returned a malformed response' }` unless there is a product-approved partial-data policy.

### P1: Travelpayouts sub-endpoint HTTP failures are silent

Evidence: `searchFares` fans out to v2 latest, v1 calendar, and v1 cheap. Non-OK endpoint responses are skipped because parsing only happens under `if (res.ok)` at `lib/providers/travelpayouts.ts:160` to `lib/providers/travelpayouts.ts:198`, `lib/providers/travelpayouts.ts:212` to `lib/providers/travelpayouts.ts:250`, and `lib/providers/travelpayouts.ts:264` to `lib/providers/travelpayouts.ts:301`. The adapter still caches and returns `ok: true` at `lib/providers/travelpayouts.ts:304` to `lib/providers/travelpayouts.ts:305`.

Caller impact: A partial Travelpayouts outage can affect ranking and visible inventory while `/api/search` has no failure reason to stream as a provider notice.

Recommended narrow repair ticket: Preserve sub-endpoint failure metadata in the adapter result or return failure when all attempted Travelpayouts endpoints fail, without changing ranking or cache behavior.

### P1: Score endpoints trust caller-supplied flight money

Evidence: `POST /api/score` accepts a `NormalizedFare` body and calls `scoreDeal(fare, history)` without validating `fare.price.priceCents` or `fare.price.currency` at `app/api/score/route.ts:87` onward. The hotel score GET path does validate `pricePerNightCents` as a positive integer at `app/api/score/route.ts:48` to `app/api/score/route.ts:60`.

Caller impact: Current first-party client sends provider fares from `/api/search`, but a malformed cached/search fare or external caller can feed invalid flight money into Deal Score copy. `scoreDeal` will format whatever integer-ish value is present and can produce misleading explanation text.

Recommended narrow repair ticket: Add a narrow `NormalizedFare` score input validator in `app/api/score/route.ts` requiring positive integer `fare.price.priceCents`, three-letter `currency`, and route fields before scoring.

## Passing Checks

- Public provider methods return `Result<T>` shapes on normal unavailable, timeout/network rejection, HTTP failure, and malformed top-level JSON paths.
- Money emitted by live adapter parsing uses integer `priceCents` plus `currency` before UI/persistence. Travelpayouts, Kiwi, and Hotellook request/set USD; Duffel and Amadeus preserve provider currency after decimal-string parsing.
- Search route does not call vendors directly. It calls provider methods and streams `notice`, `hotel-status`, `flights`, and `hotels` events at `app/api/search/route.ts:188` to `app/api/search/route.ts:264`.
- Snapshot persistence stores integer cents plus currency for flight and hotel baselines at `scripts/snapshot-job.ts:16` to `scripts/snapshot-job.ts:23` and validates hotel snapshot money before insert at `scripts/snapshot-job.ts:34` to `scripts/snapshot-job.ts:44`.
- DB failures in search route enrollment are fire-and-forget and swallowed at `app/api/search/route.ts:180` to `app/api/search/route.ts:185`; score DB failures are mapped to 502 at `app/api/score/route.ts:63` to `app/api/score/route.ts:70`.

## Manual Verification Flow

Local live provider verification was not possible without real provider credentials and Redis/Postgres env. The available local controls are mocked provider unit tests and source-level route tracing.

Normal provider response:

- Use provider tests with recorded fixtures, e.g. Duffel success in `lib/providers/__tests__/duffel.test.ts` and Hotellook success in `lib/providers/__tests__/hotellook.test.ts`.
- Expected user-visible result: `/api/search` streams `flights` or `hotels`; cards render integer-cent money via `FlightCard`/`HotelCard`; score calls run after flight/hotel chunks.

Timeout/error response:

- Mock `fetch` rejection or HTTP 4xx/5xx in provider tests. Existing tests cover Duffel network rejection, Amadeus token/search HTTP errors, Travelpayouts fetch rejection, and Hotellook HTTP/JSON failures.
- Expected user-visible result: `/api/search` converts `{ ok: false }` to a `notice` event for flights at `app/api/search/route.ts:215` to `app/api/search/route.ts:229` or `hotel-status: unavailable` for hotels at `app/api/search/route.ts:254` to `app/api/search/route.ts:263`.

Empty response:

- Existing tests cover Duffel/Amadeus/Kiwi no-destination empty arrays and Hotellook empty array.
- Expected user-visible result: if every flight provider returns `ok: true, data: []`, `/api/search` emits `notice` with `status: no_supply`; if Hotellook returns empty, it emits `hotel-status: empty`.

Malformed response:

- Existing tests cover some top-level malformed/parse failures; source review shows top-level malformed responses become `{ ok: false }`.
- Gap: malformed individual rows in Duffel, Amadeus, and Hotellook can be dropped and surfaced as empty/partial supply. User would see no-results or fewer results, not "provider returned unusable response."

## Verification Commands

- `npx tsc --noEmit --incremental false`: passed with no output.
- `npm exec tsc -- --noEmit`: passed with no output.
- `npm test -- --runInBand`: passed. 20 test suites passed, 168 tests passed.
- `npm test -- --passWithNoTests`: passed. 20 test suites passed, 168 tests passed.

## Required Return Note

- What changed and why: Added this audit report for AUDIT-PROVIDER-RESULT-TRUST-BOUNDARIES-01. No production code changed.
- Files changed: `docs/audits/2026-06-30-audit-provider-result-trust-boundaries-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm exec tsc -- --noEmit` passed; `npm test -- --runInBand` passed with 20 suites and 168 tests; `npm test -- --passWithNoTests` passed with 20 suites and 168 tests.
- Out-of-scope findings or blockers: Requested ticket files are absent; live provider/manual browser verification blocked by missing provider credentials/env.
