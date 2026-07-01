# AUDIT-PROVIDER-ADAPTER-THROW-BOUNDARY-01

Date: 2026-07-01
Scope: Audit only. No production code, provider credentials, UI, booking flow, or provider architecture changed.

## Verdict

Pass for the assigned provider adapter throw boundary in current search/hotel paths: public methods under `lib/providers` return `Result<T>` and wrap network, timeout, cache, JSON parse, and validation failures into `{ ok: false, reason }` instead of leaking thrown errors to `/api/search` callers.

No direct vendor calls were found in the search or hotel availability path. `/api/search` consumes provider `Result<T>` values and also has defensive catches for unexpected provider rejections.

Important caveat: the requested files `lib/providers/hotels.ts` and `app/api/hotels/route.ts` do not exist in this worktree. Hotel availability currently runs through `lib/providers/hotellook.ts` and `app/api/search/route.ts`.

## Provider Entry Points

| Provider entry point | Behind `lib/providers` | Throws to caller? | Money shape | Notes |
| --- | --- | --- | --- | --- |
| `TravelpayoutsProvider.priceTrends` | Yes, `lib/providers/travelpayouts.ts` | No. External/cache/parse errors are caught and returned at `lib/providers/travelpayouts.ts:93` and `lib/providers/travelpayouts.ts:126`. | `PricePoint.priceCents` integer plus `currency: 'USD'` at `lib/providers/travelpayouts.ts:117`. | Malformed rows throw internally but are caught by the method-level boundary. |
| `TravelpayoutsProvider.searchFares` | Yes, `lib/providers/travelpayouts.ts` | No. Fetch/cache/JSON failures are caught at `lib/providers/travelpayouts.ts:144` and `lib/providers/travelpayouts.ts:307`. | `price: { priceCents, currency: 'USD' }` at `lib/providers/travelpayouts.ts:191`, `lib/providers/travelpayouts.ts:243`, and `lib/providers/travelpayouts.ts:293`. | Individual sub-endpoint non-OK responses are skipped, so partial Travelpayouts outage can still return `ok: true` with partial data. That is a trust/detail gap, not a throw leak. |
| `DuffelProvider.priceTrends` | Yes, `lib/providers/duffel.ts` | No external work; returns `ok: true, data: []` at `lib/providers/duffel.ts:98`. | No money returned. | Explicit unsupported trends path. |
| `DuffelProvider.searchFares` | Yes, `lib/providers/duffel.ts` | No. Fetch/cache/JSON failures are caught at `lib/providers/duffel.ts:137` and `lib/providers/duffel.ts:225`. | Decimal string converted to integer cents, provider currency preserved at `lib/providers/duffel.ts:183` and `lib/providers/duffel.ts:202`. | Malformed offers are filtered out rather than failing the whole result. |
| `AmadeusProvider.priceTrends` | Yes, `lib/providers/amadeus.ts` | No external work; returns `ok: true, data: []` at `lib/providers/amadeus.ts:100`. | No money returned. | Explicit unsupported trends path. |
| `AmadeusProvider.searchFares` | Yes, `lib/providers/amadeus.ts` | No. Token/search/cache/JSON failures are caught at `lib/providers/amadeus.ts:123` and `lib/providers/amadeus.ts:244`. | Decimal string converted to integer cents, provider currency preserved at `lib/providers/amadeus.ts:208` and `lib/providers/amadeus.ts:221`. | Private `getToken` can reject internally, but it is called inside the public method try/catch. |
| `KiwiProvider.priceTrends` | Yes, `lib/providers/kiwi.ts` | No external work; returns `ok: true, data: []` at `lib/providers/kiwi.ts:107`. | No money returned. | Explicit unsupported trends path. |
| `KiwiProvider.searchFares` | Yes, `lib/providers/kiwi.ts` | No. Fetch/cache/JSON failures are caught at `lib/providers/kiwi.ts:127` and `lib/providers/kiwi.ts:220`. | Numeric price converted to integer cents with `currency: 'USD'` at `lib/providers/kiwi.ts:183` and `lib/providers/kiwi.ts:199`. | Default singleton is unapproved and returns `Kiwi not approved`, so no external Kiwi call is made unless configured. |
| `HotellookProvider.searchHotels` | Yes, `lib/providers/hotellook.ts` | No. Fetch/cache/JSON failures are caught at `lib/providers/hotellook.ts:70` and `lib/providers/hotellook.ts:120`. | `pricePerNight: { priceCents, currency: 'USD' }` at `lib/providers/hotellook.ts:96` and `lib/providers/hotellook.ts:108`. | Empty response returns `ok: true, data: []`; top-level malformed response returns `ok: false`. |

## Route Consumption

- `app/api/search/route.ts` imports only provider modules for flight and hotel supply at lines 4-8.
- Flight providers are consumed as `Result<NormalizedFare[]>`; failures become streamed `notice` events at `app/api/search/route.ts:194` to `app/api/search/route.ts:205`.
- Travelpayouts flexible-date search uses `Promise.allSettled`, preserving successful fares while converting failures/rejections to notices at `app/api/search/route.ts:225` to `app/api/search/route.ts:260`.
- Hotel search consumes `Result<HotelOffer[]>` and maps unavailable, timeout, malformed, empty, and skipped states to bounded `hotel-status` messages at `app/api/search/route.ts:290` to `app/api/search/route.ts:330`.
- `app/api/calendar/route.ts` calls `travelpayouts.priceTrends` and checks `result.ok` before returning data at `app/api/calendar/route.ts:11` to `app/api/calendar/route.ts:12`.

## Manual Verification Flow

Manual local verification used the existing mocked route tests rather than live providers because real provider credentials and networked Redis/Postgres are not available in this audit environment.

Provider error path verified:

- `app/api/search/__tests__/route.test.ts` mocks `hotellook.searchHotels` to reject with `hotel upstream failure`.
- Expected result: `/api/search` returns HTTP 200 and streams `{ type: 'hotel-status', status: 'unavailable', providerStatus: 'unavailable', message: 'The hotel provider is unavailable right now.' }`.
- The raw upstream error string is not streamed to the UI.

Unavailable hotel path verified:

- `app/api/search/__tests__/route.test.ts` mocks `hotellook.searchHotels` to return `{ ok: false, reason: 'HotelLook timed out' }`.
- Expected result: `/api/search` returns HTTP 200 and streams `hotel-status: unavailable` with timeout-specific copy: `The hotel provider did not respond in time. Hotel inventory was not confirmed for this search.`

## Findings

No P0 throw-boundary violation was found in the provider adapters or `/api/search` provider consumption path.

Observed trust gaps, not fixed because this ticket is audit-only:

- `TravelpayoutsProvider.searchFares` can silently skip non-OK sub-endpoints and still return `ok: true` with partial data.
- `DuffelProvider.searchFares`, `AmadeusProvider.searchFares`, and `HotellookProvider.searchHotels` can filter malformed individual rows and return successful partial or empty data, which can make malformed supply look like true no-supply.
- Cached provider payloads are trusted as typed data on cache hit. If Redis contains malformed cached fares, trends, or hotels, adapter validation is bypassed.

Out-of-scope contract finding:

- `app/api/book/route.ts` calls Duffel directly at `app/api/book/route.ts:110` and `app/api/book/route.ts:156`, outside `lib/providers`. This is outside the assigned provider adapter/search/hotel audit scope but conflicts with the broader contract that every external travel API call should go through `lib/providers`.

## Verification

- `npx tsc --noEmit --incremental false`: passed.
- `npm run tsc`: failed because `package.json` has no `tsc` script.
- `npm test -- --passWithNoTests`: passed. 20 test suites passed, 176 tests passed.

## Required Return Note

- What changed and why: Added this audit report for AUDIT-PROVIDER-ADAPTER-THROW-BOUNDARY-01. No production code changed.
- Files changed: `docs/audits/2026-07-01-audit-provider-adapter-throw-boundary-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm run tsc` failed because no `tsc` script exists; `npm test -- --passWithNoTests` passed with 20 suites and 176 tests.
- Out-of-scope findings or blockers: `lib/providers/hotels.ts` and `app/api/hotels/route.ts` are absent; live provider/manual browser verification was blocked by missing provider credentials/env; direct Duffel booking calls in `app/api/book/route.ts` are out of this ticket but violate the broader external-call-through-provider contract.
