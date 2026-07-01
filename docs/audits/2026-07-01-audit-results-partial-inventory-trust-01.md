# AUDIT-RESULTS-PARTIAL-INVENTORY-TRUST-01

Date: 2026-07-01  
Role: Senior QA Engineer  
Scope: Partial flight/hotel inventory trust states, score availability, booking confidence

## Summary

Partial flight provider failures are visible and specific in the Flights tab. Partial hotel failure is preserved by the API and client state, but the main results view disables the Hotels tab and only shows a generic "Hotels were not included" panel below the tabs, which can understate an actual provider outage when flight results succeeded.

No feature or implementation code was changed.

## Files Inspected

- `app/page.tsx`
- `app/api/search/route.ts`
- `components/flights/FlightResults.tsx`
- `app/components/DealBadge.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `lib/providers/index.ts`
- `lib/providers/hotellook.ts`
- `lib/scoring/scoreDeal.ts`
- `lib/types.ts`

Requested ticket paths absent from this worktree:

- `app/api/hotels/route.ts`
- `components/hotels/HotelResults.tsx`
- `lib/providers/hotels.ts`

## Scenario Matrix

### 1. Flight results succeed, one flight provider fails

Observed state:

- `app/api/search/route.ts:180` sends a bounded provider notice.
- `app/api/search/route.ts:220` races all flight providers and streams each successful provider chunk.
- `components/flights/FlightResults.tsx:203` shows "Provider coverage may be incomplete."
- `components/flights/FlightResults.tsx:216` lists the specific provider notice.
- Existing Jest coverage verifies Travelpayouts fares remain visible while Duffel failure becomes "Duffel is unavailable for this search" without leaking raw HTTP details in `app/api/search/__tests__/route.test.ts:156`.

Result: Pass.

### 2. Flight results succeed, hotel provider fails

Observed state:

- `app/api/search/route.ts:290` checks hotels after flight providers for destination plus round-trip dates.
- `app/api/search/route.ts:298` returns `hotel-status: unavailable` with bounded copy.
- `app/page.tsx:768` stores the hotel status and message.
- `app/page.tsx:1367` disables the Hotels tab when hotel availability is `unavailable`.
- `app/page.tsx:1399` shows a separate panel: "Hotels were not included." plus the hotel provider message.

Result: Partial pass with trust risk.

Issue: The unavailable hotel state is visible, but it is demoted below the tabs and labeled "Hotels were not included," even when the hotel provider was attempted and failed. Users viewing successful flight results may read the page as a clean flight success with hotel absence rather than a partial inventory outage.

### 3. Hotel results succeed, all flight providers fail

Observed state:

- `app/api/search/route.ts:180` emits a notice for each failed flight provider.
- `app/api/search/route.ts:292` can still return hotel results after flight failures.
- `app/page.tsx:1367` keeps the Hotels tab enabled when `hotels.length > 0`.
- `components/flights/FlightResults.tsx:153` treats flight provider notices plus zero flights as provider unavailability.
- `components/flights/FlightResults.tsx:183` shows a Retry search action for the flight inventory failure.

Result: Pass with minor UX caveat.

The default active tab remains Flights, so the user first sees the flight outage while a Hotels tab with a count is available. That is honest, but it requires tab navigation to see the successful hotel inventory.

### 4. No flight inventory, no provider failure

Observed state:

- `app/api/search/route.ts:277` sends "No flight providers returned matching fares for this search" only when no fares and no provider issues were recorded.
- `components/flights/FlightResults.tsx:159` distinguishes no inventory from provider unavailable and from filters hiding results.

Result: Pass.

### 5. Filters hide available flight inventory

Observed state:

- `components/flights/FlightResults.tsx:152` detects available fares hidden by filters.
- `components/flights/FlightResults.tsx:175` shows "Show all stops."
- Existing coverage verifies this does not present as no provider inventory in `components/flights/__tests__/FlightResults.test.tsx:107`.

Result: Pass.

### 6. Loading state

Observed state:

- `components/flights/FlightResults.tsx:299` shows "Checking live flight inventory" while no fare cards have loaded.
- `app/page.tsx:1437` shows hotel skeletons when the Hotels tab is active during search.
- `app/page.tsx:687` clears prior results, scores, notices, and hotel state before a new search.

Result: Pass by code inspection.

### 7. Error state

Observed state:

- `app/page.tsx:806` stores fetch-level errors.
- `app/page.tsx:1329` renders a search error panel with Retry search and Edit search actions.

Result: Pass.

### 8. Mobile 375px and desktop usability

Observed state:

- Results tabs use horizontal overflow in `app/page.tsx:1363`.
- Flight result controls stack before desktop grid layout in `components/flights/FlightResults.tsx:229`.
- Flight and hotel card CTAs are full-width on narrow screens in `app/components/FlightCard.tsx:352` and `app/components/HotelCard.tsx:254`.

Result: Pass by static inspection. Browser screenshot verification was not performed because this audit did not start a dev server or add visual tooling.

## Deal Score Trust

Unavailable scores:

- `app/components/FlightCard.tsx:344` shows a loading skeleton while score fetch is pending.
- `app/components/FlightCard.tsx:348` shows "Unavailable right now" when score is null.
- `app/components/HotelCard.tsx:240` shows hotel score only while loading or when a score exists; null score does not render a misleading badge.

Thin data:

- `lib/scoring/scoreDeal.ts:76` returns low-confidence Typical when no comparable history exists.
- `lib/scoring/scoreDeal.ts:91` marks fewer than 10 comparable points as low confidence.
- `lib/scoring/scoreDeal.ts:125` caps low-confidence scores at Typical.
- `app/components/DealBadge.tsx` labels low-confidence scores as "Limited history" instead of Great/Good.

Result: Pass. Unavailable scores are not presented as low-quality deals, and thin history is not allowed to claim Great.

## Booking Confidence

Flights:

- `app/components/FlightCard.tsx:240` requires valid money.
- `app/components/FlightCard.tsx:241` requires either safe internal booking or safe external provider link.
- `app/components/FlightCard.tsx:243` enables provider CTA only when both valid price and valid link are present.
- `app/components/FlightCard.tsx:370` disables the CTA otherwise and explains the missing context.

Hotels:

- `app/components/HotelCard.tsx:255` enables booking only with a valid booking URL and valid nightly price.
- `app/components/HotelCard.tsx:273` renders "Booking unavailable" plus reason when either is missing.

Result: Pass. I did not find a booking action enabled without required result context.

## Manual Verification Flow

Mocked provider failure:

1. Ran `npm run test -- app/api/search/__tests__/route.test.ts --runInBand -t "streams successful fares with a bounded notice"`.
2. The test mocks Travelpayouts as successful and Duffel as failed.
3. Observed result: one `flights` NDJSON message is returned and a separate `notice` message is returned for Duffel unavailability.
4. The raw upstream HTTP detail is not exposed in the user-facing notice.

Result: Pass.

## Findings

### P1: Hotel provider failure is visible but softened as "not included"

References:

- `app/page.tsx:1367`
- `app/page.tsx:1399`
- `app/api/search/route.ts:298`

Repro:

1. Search a round trip with origin, destination, depart, and return dates.
2. Mock hotel provider to return `{ ok: false, reason: 'HotelLook timed out' }`.
3. Keep at least one flight provider returning fares.
4. Observe successful flight results.
5. Observe Hotels tab disabled with "Unavailable."
6. Observe panel copy: "Hotels were not included."

Expected:

- The page should make clear that hotel inventory was attempted but unavailable.

Actual:

- The state is visible but phrased as not included, which can hide provider failure behind a mixed-success flight result.

## Verification

- `npm run test -- app/api/search/__tests__/route.test.ts --runInBand -t "streams successful fares with a bounded notice"`: passed, 1 test passed, 12 skipped.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run test -- --runInBand --passWithNoTests`: passed, 20 suites passed, 176 tests passed.

## Blockers And Out-Of-Scope Notes

- The ticket listed `app/api/hotels/route.ts`, `components/hotels/HotelResults.tsx`, and `lib/providers/hotels.ts`; these files do not exist in this worktree.
- No UI/provider fixes were made because this ticket is audit-only.
- No scoring weight, ranking, fallback provider, synthetic inventory, or API structure changes were made.
