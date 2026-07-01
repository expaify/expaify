# AUDIT-HOTEL-NIGHT-COUNT-CALCULATION-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Hotel night count calculation and price-basis trust from search through results and booking. No feature code changed.

## Verdict

Fail.

Hotel check-in and checkout dates are collected and passed to the hotel provider, but the app never calculates or displays hotel stay length. Result cards show only a nightly rate. Search/result summaries show the raw date range, not nights. Hotel booking review cannot be verified because this worktree has no hotel booking review surface; hotel cards link directly to the provider.

## Requested File Mismatches

These ticket-listed files do not exist in this worktree:

- `components/search/SearchSummary.tsx`
- `components/hotels/HotelCard.tsx`
- `components/hotels/HotelPrice.tsx`
- `components/hotels/HotelResults.tsx`

Equivalent inspected hotel result surface:

- `app/components/HotelCard.tsx`

## Files Inspected

- `app/page.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `components/search/SearchPanel.tsx`
- `app/components/HotelCard.tsx`
- `app/api/search/route.ts`
- `lib/providers/hotellook.ts`
- `lib/booking/config.ts`
- `lib/types.ts`

## Date Trace

Search form:

- Main search stores `depart` and `returnDate` strings in page state and validates date presence/ordering in `validateTravelDates` (`app/page.tsx:118` to `app/page.tsx:140`).
- Validation allows same-day round trips because it only rejects `returnDate < depart`, not `returnDate === depart` (`app/page.tsx:135` to `app/page.tsx:136`).
- The URL builder serializes return date as `return` when trip type is roundtrip (`app/page.tsx:148` to `app/page.tsx:160`).

API:

- `/api/search` validates required dates and also allows same-day round trips because it only rejects `ret < depart` (`app/api/search/route.ts:134` to `app/api/search/route.ts:158`).
- Hotels are searched only when destination, depart, and return date exist (`app/api/search/route.ts:289` to `app/api/search/route.ts:292`).
- The hotel provider receives `{ checkin: depart, checkout: ret }`; no night count is calculated before this call (`app/api/search/route.ts:290` to `app/api/search/route.ts:292`).

Provider/result type:

- `HotelProvider.searchHotels` accepts only `{ checkin, checkout }`; there is no `nights`, `totalPrice`, `taxes`, or `fees` field in the provider contract (`lib/types.ts:85` to `lib/types.ts:89`).
- `HotelOffer` has `pricePerNight` only. It does not carry check-in, checkout, nights, stay total, taxes, or fees (`lib/types.ts:47` to `lib/types.ts:57`).
- Hotellook cache keys include check-in and checkout, but returned offers still only include `pricePerNight` (`lib/providers/hotellook.ts:67` to `lib/providers/hotellook.ts:119`).

Results:

- Search result context displays the raw date range, for example `2099-09-22 - 2099-09-25`; it does not display `3 nights` (`app/page.tsx:909` to `app/page.tsx:914`).
- Hotel cards render `Nightly rate` and `per night before taxes and fees` (`app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:60`).
- Hotel cards do not show check-in, checkout, nights, stay total, or an explanation that no stay total is available (`app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:290`).

Booking:

- Booking context is flight-only: `BookingFareContext` contains origin, destination, depart, return, carrier, stops, passenger count, and fare price; it has no hotel, room, check-in, checkout, nights, or hotel total fields (`lib/booking/config.ts:3` to `lib/booking/config.ts:16`).
- Booking review renders fare facts for flights only (`app/book/BookingFlow.tsx:81` to `app/book/BookingFlow.tsx:116`).
- Hotel result cards link directly to `hotel.deeplink`; there is no internal hotel booking review step to compare against (`app/components/HotelCard.tsx:255` to `app/components/HotelCard.tsx:270`).

## Date Scenarios Tested

| Scenario | Example dates | Expected hotel nights | Observed handling | Observed night count |
| --- | --- | ---: | --- | --- |
| Same-day hotel dates | `depart=2099-09-22`, `return=2099-09-22` | Invalid / 0 nights should be blocked for hotels | Allowed by page validation and API; hotel provider would be called with identical `checkin` and `checkout` | Not calculated or displayed |
| One-night hotel stay | `depart=2099-09-22`, `return=2099-09-23` | 1 night | Allowed; provider receives check-in/check-out; result context shows raw dates; card shows nightly rate only | Not calculated or displayed |
| Multi-night hotel stay | `depart=2099-09-22`, `return=2099-09-25` | 3 nights | Allowed; provider receives check-in/check-out; result context shows raw dates; card shows nightly rate only | Not calculated or displayed |
| Invalid date order | `depart=2099-09-25`, `return=2099-09-22` | Invalid | Blocked by page URL parsing, page form validation, and API validation | No hotel search; no night count |
| Missing return date / one-way | `trip=oneway`, no `return` | No hotel stay | Hotels skipped; UI says add departure and return dates to check hotel availability | No hotel search; no night count |

## Findings

### P0 - Same-day hotel stays are allowed silently

Repro:

1. Enter a round-trip destination search with the same departure and return date.
2. Submit the search.
3. Observe that the form validation allows the search because it only rejects return dates before departure.
4. `/api/search` also allows the request and will call `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })` when provider configuration is available.

Expected:

- A same-day hotel stay should be blocked or explicitly corrected before provider search because it represents 0 hotel nights.

Actual:

- Same-day dates are accepted silently.
- No hotel night count is calculated, so the UI cannot explain that this is a 0-night stay.

Evidence:

- Page validation: `app/page.tsx:130` to `app/page.tsx:137`.
- API validation: `app/api/search/route.ts:151` to `app/api/search/route.ts:158`.
- Hotel provider call: `app/api/search/route.ts:289` to `app/api/search/route.ts:292`.

### P0 - Hotel price basis never reconciles nightly price to stay total

Repro:

1. Search a one-night hotel stay.
2. Search a three-night hotel stay.
3. Compare the hotel result cards.

Expected:

- Results should let the user reconcile nightly price, stay length, and total price, or explicitly say that only a nightly provider rate is available.

Actual:

- Hotel cards show only `Nightly rate` and `per night before taxes and fees`.
- Search summary shows raw date range only.
- No surface multiplies nightly rate by nights or labels a stay total as unavailable.

Evidence:

- `HotelOffer` only has `pricePerNight`: `lib/types.ts:47` to `lib/types.ts:57`.
- Result context only joins route/date/passenger strings: `app/page.tsx:909` to `app/page.tsx:914`.
- Hotel card price copy: `app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:60`.

### P0 - Hotel booking review path is absent

Repro:

1. Open any hotel result card with a valid deeplink.
2. Select the hotel CTA.

Expected:

- If the product promises a booking review comparison, the review should preserve dates, nights, price basis, and total/basis copy.

Actual:

- The CTA goes directly to the provider site.
- `/book` is flight-only and cannot render hotel stay length or hotel price basis.

Evidence:

- Hotel CTA href is `hotel.deeplink`: `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`.
- Flight booking context fields only: `lib/booking/config.ts:3` to `lib/booking/config.ts:16`.
- Flight fare review only: `app/book/BookingFlow.tsx:81` to `app/book/BookingFlow.tsx:116`.

### P1 - Search summary and tab copy do not distinguish hotel stay dates from flight dates

Repro:

1. Run a round-trip search with hotels available or unavailable.
2. Review the result header and hotel empty/unavailable panel.

Expected:

- Hotel context should label dates as check-in/check-out or stay dates, and include the expected nights when valid.

Actual:

- Result context uses the same raw `depart - return` copy for flights and hotels.
- Empty/unavailable hotel states refer to dates but do not state stay length.

Evidence:

- Result context: `app/page.tsx:909` to `app/page.tsx:914`.
- Hotel unavailable copy: `app/page.tsx:916` to `app/page.tsx:934`.
- Hotel empty panel includes raw result context: `app/page.tsx:1452` to `app/page.tsx:1470`.

## Manual Verification Flow

Blocked from full end-to-end provider-data verification: the current HotelLook provider requires `TP_TOKEN` and `HOTEL_AFFILIATE_ID`, and live provider data is external. This audit therefore verifies the executable local path and documents the provider-data blocker.

Manual one-night flow:

1. Search `origin=JFK`, `dest=LAX`, `depart=2099-09-22`, `return=2099-09-23`, `trip=roundtrip`.
2. Expected API call shape: `hotellook.searchHotels('LAX', { checkin: '2099-09-22', checkout: '2099-09-23' })`.
3. Expected UI if hotels return: Hotels tab can show cards with `Nightly rate` and `per night before taxes and fees`.
4. Compare summary/card/booking: summary has raw dates only, card has nightly basis only, booking review is not available for hotels.

Manual three-night flow:

1. Search `origin=JFK`, `dest=LAX`, `depart=2099-09-22`, `return=2099-09-25`, `trip=roundtrip`.
2. Expected API call shape: `hotellook.searchHotels('LAX', { checkin: '2099-09-22', checkout: '2099-09-25' })`.
3. Expected UI if hotels return: card copy is the same nightly-rate basis as the one-night search.
4. Compare summary/card/booking: no surface displays `3 nights` or a stay total.

Manual same-day flow:

1. Search `origin=JFK`, `dest=LAX`, `depart=2099-09-22`, `return=2099-09-22`, `trip=roundtrip`.
2. Expected from a hotel trust perspective: blocked or corrected.
3. Actual from code: allowed by page and API validation; provider would receive identical check-in/checkout.

Manual invalid-order flow:

1. Search `origin=JFK`, `dest=LAX`, `depart=2099-09-25`, `return=2099-09-22`, `trip=roundtrip`.
2. Expected and actual: blocked with return-before-depart validation.

## Mobile 375px and Desktop Notes

Mobile 375px source review:

- Hotel result grids use one column before the `sm` breakpoint, so cards should stack at 375px (`app/page.tsx:1437` to `app/page.tsx:1450`, `app/page.tsx:1472` to `app/page.tsx:1483`).
- Hotel card price and CTA stack vertically before `sm`, keeping the primary action visible (`app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:287`).
- The missing trust content is not a responsive-only defect: night count and stay total are absent on mobile because they are absent from the data model and card copy.

Desktop source review:

- Hotel grids move to three columns at `lg`, with the same card content (`app/page.tsx:1437`, `app/page.tsx:1473`).
- Card price and CTA move side-by-side at `sm`, but the same nightly-only basis remains (`app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:287`).

No screenshot files were added. Browser screenshot verification is blocked by unavailable live hotel provider data in this environment; source review shows the responsive layout paths and the trust copy gap.

## Out Of Scope Findings

- Hotel scoring also uses `pricePerNight` only, so multi-night stay totals cannot be scored. This is adjacent to the ticket but fixing score semantics is out of scope.
- Existing hotel card rating provenance issues are covered by prior hotel result-card audits and were not reworked here.

## Verification

- `npm run typecheck` - blocked: package.json has no `typecheck` script.
- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand` - passed: 20 suites, 176 tests.
- `npm test -- --passWithNoTests` - passed: 20 suites, 176 tests.

## Changes

Audit document added only.
