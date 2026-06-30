# AUDIT-MONEY-DISPLAY-CONSISTENCY-01

Date: 2026-06-30
Scope: Search results, hotel results, baggage estimate, and booking review price display.

## Verdict

Fail for full money-display contract compliance.

Flight result, hotel result, calendar, and booking review prices are traceable to integer cents plus currency. Baggage add-on prices are not: the visible baggage totals are derived from bare USD major-unit numbers (`estimatedTotalUsd`, `totalUsd`) rather than `{ priceCents, currency }`.

## Price Rendering Map

| Surface | Visible label/copy | Render file | Source field | Unit/currency trace | Result |
| --- | --- | --- | --- | --- | --- |
| Flight result card | `Current fare`, `per person` or `total for N adults` | `app/components/FlightCard.tsx:111`, `app/components/FlightCard.tsx:201`, `app/components/FlightCard.tsx:230` | `fare.price.priceCents`, `fare.price.currency`, `fare.priceScope`, `fare.passengerCount` | `NormalizedFare.price: Money` from providers. Formatting splits integer cents into whole and fractional display. | Pass |
| Flight loading state | skeleton only | `app/components/FlightCard.tsx:167` | none | No fake price placeholder. | Pass |
| Flight empty/error/searching state | no price displayed | `components/flights/FlightResults.tsx:136`, `components/flights/FlightResults.tsx:227` | none | State copy does not display fake prices. | Pass |
| Price calendar | day price chip | `app/page.tsx:251`, `app/page.tsx:311` | `calendarPrices[date]` | `/api/calendar` maps `PricePoint.priceCents` to date (`app/api/calendar/route.ts:14`). UI displays `Math.round(price / 100)` with hard-coded `$`. Source is cents, but display assumes USD and drops cents. | Pass with caveat |
| Hotel result card | `Nightly rate`, `per night before taxes and fees` | `app/components/HotelCard.tsx:49`, `app/components/HotelCard.tsx:66`, `app/components/HotelCard.tsx:267` | `hotel.pricePerNight.priceCents`, `hotel.pricePerNight.currency` | `HotelOffer.pricePerNight: Money`. UI validates integer positive cents before rendering price. | Pass |
| Hotel unavailable state | `Price unavailable` | `app/components/HotelCard.tsx:71`, `app/components/HotelCard.tsx:123`, `app/components/HotelCard.tsx:269` | `hasValidPrice`, `hasBookingUrl` | Missing or invalid cents do not render as a confident price. | Pass |
| Hotel Deal Score usual price | `Usual` | `app/components/HotelCard.tsx:87`, `app/components/HotelCard.tsx:147` | `score.medianCents`, `score.currency` | Score API validates positive integer `pricePerNightCents`; `scoreDeal` returns median cents and currency. | Pass with caveat |
| Hotel score request | not directly visible | `app/page.tsx:454`, `app/api/score/route.ts:48` | `pricePerNightCents`, `currency` query params | Page sends hotel `pricePerNight` cents and currency. API defaults missing currency to `USD`, which can hide a missing-currency caller bug before score display. | Issue |
| Baggage estimator total | `Estimated add-on` | `components/baggage/BaggageFeeEstimator.tsx:14`, `components/baggage/BaggageFeeEstimator.tsx:173` | `estimate.estimatedTotalUsd` | `BaggageFeeEstimate.estimatedTotalUsd` is a bare number in USD major units. It is formatted with a hard-coded USD formatter. | Fail |
| Baggage estimator line items | included or line total | `components/baggage/BaggageFeeEstimator.tsx:189` | `line.totalUsd` | `BaggageFeeLine.totalUsd` is a bare number in USD major units. | Fail |
| Booking review fare | `Current fare`, price basis | `app/book/BookingFlow.tsx:23`, `app/book/BookingFlow.tsx:94`, `app/book/BookingFlow.tsx:95` | `fareContext.priceCents`, `fareContext.currency`, `fareContext.priceScope`, `fareContext.passengerCount` | `parseBookingFareContext` requires positive integer `priceCents` and non-empty currency. `buildBookingHref` copies `fare.price.priceCents` and `fare.price.currency`. | Pass |
| Booking missing fare state | no price displayed | `app/book/BookingFlow.tsx:181` | none | Missing booking context renders recovery copy, not a fabricated price. | Pass |

## Provider Trace

- `lib/types.ts:1`, `lib/types.ts:22`, `lib/types.ts:52`: shared flight and hotel money contract is `{ priceCents: number; currency: string }`.
- Travelpayouts converts major USD numbers via `majorUnitsToCents` and returns `price: { priceCents, currency: 'USD' }` at `lib/providers/travelpayouts.ts:61`, `lib/providers/travelpayouts.ts:190`, `lib/providers/travelpayouts.ts:242`, `lib/providers/travelpayouts.ts:292`.
- Duffel converts decimal strings to cents and preserves provider currency at `lib/providers/duffel.ts:45`, `lib/providers/duffel.ts:182`, `lib/providers/duffel.ts:201`.
- Amadeus converts decimal strings to cents and preserves provider currency at `lib/providers/amadeus.ts:47`, `lib/providers/amadeus.ts:215`, `lib/providers/amadeus.ts:228`.
- Kiwi converts numeric price to cents and sets USD because the request uses `curr=USD` at `lib/providers/kiwi.ts:56`, `lib/providers/kiwi.ts:140`, `lib/providers/kiwi.ts:198`.
- Hotellook converts `priceFrom` major units to cents and sets USD because the request uses `currency=USD` at `lib/providers/hotellook.ts:32`, `lib/providers/hotellook.ts:78`, `lib/providers/hotellook.ts:107`.
- `/api/search` streams provider `NormalizedFare[]` and `HotelOffer[]` without reformatting or unit conversion at `app/api/search/route.ts:139`, `app/api/search/route.ts:230`.

## Findings

### P0: Baggage prices violate the Money contract

Visible baggage totals are derived from bare USD major-unit numbers instead of `{ priceCents, currency }`.

Evidence:
- `lib/baggage/types.ts:16` exposes `unitPriceUsd: number`.
- `lib/baggage/types.ts:17` exposes `totalUsd: number`.
- `lib/baggage/types.ts:25` exposes `estimatedTotalUsd: number`.
- `lib/baggage/fees.ts:11` and `lib/baggage/fees.ts:12` store fees as major USD dollars.
- `components/baggage/BaggageFeeEstimator.tsx:173` formats `estimate.estimatedTotalUsd` with hard-coded USD.
- `components/baggage/BaggageFeeEstimator.tsx:189` formats `line.totalUsd` with hard-coded USD.

Repro:
1. Search any route that returns at least one flight result.
2. In the flight results tab, use the baggage estimator.
3. Increase checked bags to 1.
4. Observe `Estimated add-on $40`.
5. Trace source: `$40` is `estimatedTotalUsd = 40`, not `priceCents = 4000` with `currency = 'USD'`.

Impact:
This is exactly the unit-drift class the ticket is trying to prevent. The UI happens to display the right dollar amount today only because the field name and formatter both assume USD major units.

### P1: Hotel score endpoint defaults missing currency to USD

The visible hotel card price uses `pricePerNight.currency`, but the hotel score API silently falls back to USD when the score request lacks currency.

Evidence:
- Page sends `currency: hotel.pricePerNight.currency` at `app/page.tsx:454`.
- API defaults missing currency to `USD` at `app/api/score/route.ts:50`.
- Hotel Deal Score displays `score.currency` and `score.medianCents` at `app/components/HotelCard.tsx:147`.

Repro:
1. Call `/api/score?type=hotel&hotelId=demo&pricePerNightCents=12345` without a currency.
2. API accepts it and scores as USD.
3. Any rendered score usual price would appear as USD even though the request omitted currency.

Impact:
This does not affect the current happy-path page, which supplies currency. It does mean a missing-currency state can still render as a confident score amount instead of failing closed.

### P2: Calendar price chips assume USD and hide cents

The price calendar uses `PricePoint.priceCents` from Travelpayouts, but display is hard-coded as `$${Math.round(price / 100)}`.

Evidence:
- Calendar API returns date -> `pricePoint.priceCents` at `app/api/calendar/route.ts:14`.
- UI renders hard-coded `$` and whole dollars at `app/page.tsx:311`.
- Travelpayouts trend fetch requests `currency=usd` and emits `currency: 'USD'` at `lib/providers/travelpayouts.ts:96` and `lib/providers/travelpayouts.ts:120`.

Impact:
Currently low because the upstream route is USD-only. It is still not currency-explicit in the visible UI component and will drift if calendar data ever becomes multi-currency.

## Manual Verification Notes

Flight result path:
- Render path: `app/page.tsx` -> `FlightResults` -> `FlightCard`.
- Expected visible note for a Travelpayouts fare with `price.priceCents = 34900`, `currency = 'USD'`, `priceScope = 'per_person'`: `Current fare $349.00` and `per person`.
- Expected visible note for a Duffel fare with `price.priceCents = 88420`, `currency = 'USD'`, `priceScope = 'party_total'`, `passengerCount = 2`: `Current fare $884.20` and `total for 2 adults`.
- Empty/loading states render skeletons or explanatory copy, not fake dollar amounts.

Hotel result path:
- Render path: `app/page.tsx` -> `HotelCard`.
- Expected visible note for `pricePerNight.priceCents = 19900`, `currency = 'USD'`: `Nightly rate $199` and `per night before taxes and fees`.
- Invalid or missing nightly cents render `Price unavailable` plus reason copy instead of `$0` or an inferred amount.

Booking review path:
- Render path: Duffel `buildBookingHref(fare)` -> `/book?...priceCents=...&currency=...` -> `parseBookingFareContext` -> `BookingFlow`.
- Expected visible note for `priceCents = 88420`, `currency = 'USD'`, `priceScope = 'party_total'`, `passengerCount = 2`: `Current fare $884.20`, `total for 2 adults`, `Price basis total for 2 adults`.
- Missing or invalid booking context renders "We can't identify this fare" and no price.

Baggage path:
- Render path: `FlightResults` chooses cheapest visible fare -> `BaggageFeeEstimator` -> `/api/baggage` -> `estimateBaggageFees`.
- Expected visible note for one paid checked bag on default carrier rule: `Estimated add-on $40`.
- This is a fail because source unit is `estimatedTotalUsd = 40`, not `priceCents = 4000`.

Responsive state notes:
- Mobile 375px: flight cards use one-column grids; hotel cards use stacked price and CTA; booking review uses one-column layout with sticky submit area. No price-only control is hidden by conditional mobile classes in inspected code.
- Desktop: cards move price blocks to right alignment but use the same source fields.
- Error/empty/loading states: no fake price placeholders found in flight, hotel, or booking review states.

## Missing Files From Ticket List

- `app/book/[id]/page.tsx` is not present in this worktree. Booking review currently lives in `app/book/page.tsx` and `app/book/BookingFlow.tsx`.
- `app/components/BookingReview.tsx` is not present in this worktree. The review UI is implemented in `BookingFlow`.

## Out Of Scope Observations

- `app/components/AlertSignup.tsx` parses a target price with `parseFloat` and sends `targetPrice`. It is not imported by the current search page, which instead submits `thresholdCents` from flight results.
- `app/deals/[dealId]/page.tsx` also renders prices, but deal-detail pages were not in the ticket's inspect-first list.

## Verification Commands

- `npx tsc --noEmit --incremental false`: passed with no output.
- `npm test -- --passWithNoTests`: passed. 19 test suites passed, 151 tests passed.
