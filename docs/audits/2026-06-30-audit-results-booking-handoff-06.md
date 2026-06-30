# AUDIT-RESULTS-BOOKING-HANDOFF-06: Results to Booking Handoff Trust

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Strict audit only. No product code changed.

## Executive Decision

Not ready for paid-user booking trust.

The Duffel flight handoff preserves the basic selected fare fields in the URL-backed review page: route, depart/return date values, carrier, stops, provider, passenger count, price cents, currency, and price basis. The trust break is that the review page is built from client-supplied query parameters, drops Deal Score context entirely, drops cabin, and cannot review hotel selections in-app.

## Surfaces Inspected

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/search/route.ts`
- `app/api/book/route.ts`
- `lib/booking/config.ts`
- `lib/types.ts`

Requested files not present in this worktree:

- `app/components/BookingReview.tsx`
- `app/book/[id]/page.tsx`

## Manual Verification Flow: Flight Result to Booking Review

Flow traced for a Duffel-backed `NormalizedFare`.

1. `/api/search` streams flight chunks as `{ type: 'flights', source, data }` after providers resolve (`app/api/search/route.ts:139` to `app/api/search/route.ts:141`).
2. `app/page.tsx` stores streamed fares, dedupes them, and starts score requests (`app/page.tsx:598` to `app/page.tsx:603`).
3. `FlightResults` renders each visible fare through `FlightCard` (`components/flights/FlightResults.tsx:261` to `components/flights/FlightResults.tsx:269`).
4. Duffel fares get `/book?...` deeplinks from `buildBookingHref` (`lib/booking/config.ts:112` to `lib/booking/config.ts:129`; provider assignment referenced by `lib/providers/duffel.ts` search result path).
5. `FlightCard` treats Duffel or `/book` links as internal review links and labels them "Review paused booking" (`app/components/FlightCard.tsx:187` to `app/components/FlightCard.tsx:200`).
6. `app/book/page.tsx` parses `searchParams` into `fareContext` and passes it to `BookingFlow` (`app/book/page.tsx:11` to `app/book/page.tsx:33`).
7. `BookingFlow` displays fare review facts from that parsed context (`app/book/BookingFlow.tsx:80` to `app/book/BookingFlow.tsx:115`).

Continuity observed:

| Field | Search result card | Booking review | Status |
| --- | --- | --- | --- |
| Route | `{origin} to {destination}` and route card (`app/components/FlightCard.tsx:218` to `app/components/FlightCard.tsx:220`) | `{origin} to {destination}` plus `Route` fact (`app/book/BookingFlow.tsx:86` to `app/book/BookingFlow.tsx:100`) | Preserved |
| Depart date/time | Depart column (`app/components/FlightCard.tsx:235` to `app/components/FlightCard.tsx:249`) | Header copy and `Depart` fact (`app/book/BookingFlow.tsx:89` to `app/book/BookingFlow.tsx:104`) | Preserved |
| Return date/time | Return column when present (`app/components/FlightCard.tsx:259` to `app/components/FlightCard.tsx:273`) | `Return` fact when present (`app/book/BookingFlow.tsx:103` to `app/book/BookingFlow.tsx:105`) | Preserved but route leg remains ambiguous |
| Carrier | `{carrier} via {source}` (`app/components/FlightCard.tsx:221` to `app/components/FlightCard.tsx:223`) | `Carrier` fact (`app/book/BookingFlow.tsx:100` to `app/book/BookingFlow.tsx:101`) | Preserved |
| Provider | Raw source on card (`app/components/FlightCard.tsx:221` to `app/components/FlightCard.tsx:223`) | Provider fact with Duffel sandbox suffix when applicable (`app/book/BookingFlow.tsx:52` to `app/book/BookingFlow.tsx:55`, `app/book/BookingFlow.tsx:109`) | Preserved, copy changes |
| Stops | Stops chip (`app/components/FlightCard.tsx:224` to `app/components/FlightCard.tsx:226`) | `Stops` fact (`app/book/BookingFlow.tsx:106`) | Preserved |
| Cabin | Cabin badge (`app/components/FlightCard.tsx:224` to `app/components/FlightCard.tsx:227`) | Not included in booking context or review (`lib/booking/config.ts:3` to `lib/booking/config.ts:16`) | Lost |
| Price cents/currency | `fare.price.priceCents` and `fare.price.currency` (`app/components/FlightCard.tsx:230`) | `fareContext.priceCents` and `fareContext.currency` (`app/book/BookingFlow.tsx:93` to `app/book/BookingFlow.tsx:97`) | Preserved for Duffel context |
| Price basis | `total for N adults` or `per person` (`app/components/FlightCard.tsx:201` to `app/components/FlightCard.tsx:203`) | Same basis helper (`app/book/BookingFlow.tsx:65` to `app/book/BookingFlow.tsx:69`) | Preserved |
| Passenger count | Card price basis only (`app/components/FlightCard.tsx:201` to `app/components/FlightCard.tsx:203`) | `Passengers` fact (`app/book/BookingFlow.tsx:107`) | Preserved, clearer on review |
| Deal Score | Badge, percentile/limited-history copy, explanation (`app/components/FlightCard.tsx:133` to `app/components/FlightCard.tsx:162`) | Not accepted in `BookingFareContext`; not displayed in review | Lost |

## P0 Trust Blockers

### 1. Deal Score disappears at the booking review handoff

Evidence: Flight cards display Deal Score context when a score resolves (`app/components/FlightCard.tsx:133` to `app/components/FlightCard.tsx:162`, rendered at `app/components/FlightCard.tsx:278` to `app/components/FlightCard.tsx:282`). The booking URL builder only carries offer/provider/route/date/carrier/stops/price/passenger/priceScope (`lib/booking/config.ts:112` to `lib/booking/config.ts:129`). `BookingFareContext` has no score fields (`lib/booking/config.ts:3` to `lib/booking/config.ts:16`), and `FareSummary` never renders score, percentile, confidence, median, or explanation (`app/book/BookingFlow.tsx:80` to `app/book/BookingFlow.tsx:115`).

Repro:

1. Search until a Duffel fare card receives a visible Deal Score.
2. Click "Review paused booking".
3. Compare the selected card to the booking review.

Result: The review page has no Deal Score, no confidence, no percentile, no usual-price context, and no explanation.

Impact: The differentiator that justified the result selection vanishes at the moment the user reviews booking. Paid users cannot confirm that the selected fare is still the same "good price" context they chose.

### 2. Booking review displays client-supplied fare context before server verification

Evidence: `/book` parses fare details directly from URL `searchParams` (`app/book/page.tsx:11` to `app/book/page.tsx:33`; `lib/booking/config.ts:95` to `lib/booking/config.ts:109`). Validation only checks required shape, positive integer cents, passenger count, stops, and price scope (`lib/booking/config.ts:46` to `lib/booking/config.ts:93`). The displayed review uses those parsed values (`app/book/BookingFlow.tsx:80` to `app/book/BookingFlow.tsx:115`). Provider price/passenger revalidation only happens later in `POST /api/book` (`app/api/book/route.ts:109` to `app/api/book/route.ts:153`), and it never happens when booking is paused (`app/book/BookingFlow.tsx:298` to `app/book/BookingFlow.tsx:307`).

Repro:

1. Open `/book?offerId=off_any&provider=duffel&origin=JFK&destination=LAX&depart=2026-09-22T08%3A00%3A00.000Z&carrier=Example&stops=0&priceCents=1&currency=USD&passengerCount=1&priceScope=party_total`.
2. Observe the review page can render the supplied one-cent fare context if the shape validates.

Impact: The booking review can present unverified selected-result details. This is a trust blocker because the page title and "Fare review" treatment imply continuity from a real search result even when the values are not provider-verified.

### 3. Hotel result to booking review path is blocked

Evidence: Hotels can be streamed by `/api/search` only for destination + depart + return (`app/api/search/route.ts:225` to `app/api/search/route.ts:249`) and rendered as `HotelCard`s (`app/page.tsx:1214` to `app/page.tsx:1251`). A bookable hotel card links directly to `hotel.deeplink` in a new tab (`app/components/HotelCard.tsx:271` to `app/components/HotelCard.tsx:287`). There is no `app/components/BookingReview.tsx`, no `app/book/[id]/page.tsx`, and `app/book/page.tsx` parses flight-only `BookingFareContext`.

Repro:

1. Run a round-trip destination search that returns hotel offers.
2. Open the Hotels tab.
3. Click "Book hotel".

Result: The path leaves the app for HotelLook. There is no in-app selected hotel review showing hotel name, nightly price, currency, dates, provider, score, or taxes/fees context.

Impact: The hotel handoff acceptance path cannot be completed. If hotel supply exists, users cannot verify search-card fields against an expaify booking review.

## P1 Polish and Continuity Findings

### 4. Cabin is visible on the flight card but lost in review

Evidence: `FlightCard` displays `CabinBadge` next to stops (`app/components/FlightCard.tsx:224` to `app/components/FlightCard.tsx:227`). `buildBookingHref` does not include `cabin` (`lib/booking/config.ts:112` to `lib/booking/config.ts:129`), and `BookingFareContext` has no cabin field (`lib/booking/config.ts:3` to `lib/booking/config.ts:16`).

Impact: Economy/premium/business/first context can disappear between selection and review.

### 5. Round-trip return presentation is ambiguous

Evidence: On a round-trip card, the right-side endpoint label changes to `Return`, but it still displays `fare.destination` (`app/components/FlightCard.tsx:259` to `app/components/FlightCard.tsx:272`). Booking review shows a `Return` date/time fact only, without a return-leg route (`app/book/BookingFlow.tsx:103` to `app/book/BookingFlow.tsx:105`).

Impact: Users can verify dates, but not the actual return leg direction. This is especially risky if provider data later includes multi-city, open-jaw, or less-normalized itinerary details.

### 6. Non-USD currency formatting is inconsistent between card and review

Evidence: `FlightCard` formats non-USD as the raw currency code immediately before the amount (`app/components/FlightCard.tsx:111` to `app/components/FlightCard.tsx:128`). `BookingFlow` formats non-USD as `CODE amount` with a space (`app/book/BookingFlow.tsx:23` to `app/book/BookingFlow.tsx:32`). Hotel cards use `Intl.NumberFormat` (`app/components/HotelCard.tsx:49` to `app/components/HotelCard.tsx:56`).

Impact: USD fares are readable and cent-preserving. Non-USD fares can look different across the handoff even when `priceCents` and `currency` are unchanged.

### 7. "Back to search" loses the selected search URL state

Evidence: Booking review uses a plain `/` link (`app/book/BookingFlow.tsx:163` to `app/book/BookingFlow.tsx:166`; repeated at `app/book/BookingFlow.tsx:211` to `app/book/BookingFlow.tsx:213`). The search page can encode route/date/passengers/tab/sort in URL params (`app/page.tsx:109` to `app/page.tsx:122`), but those params are not preserved in the review back link.

Impact: Browser Back may recover the prior state, but the visible "Back to search" control drops the user to the default form instead of the result set they selected from.

### 8. Provider label changes between result and review

Evidence: Flight cards display raw `fare.source` as `{carrier} via {source}` (`app/components/FlightCard.tsx:221` to `app/components/FlightCard.tsx:223`). Booking review transforms Duffel to `Duffel` or `Duffel sandbox` depending on env (`app/book/BookingFlow.tsx:52` to `app/book/BookingFlow.tsx:55`).

Impact: This is not a data loss, but the selected card and review can appear to name different providers or environments.

## Deal Score Copy Review

No guarantee, hidden discount, or fake benchmark copy was found in the inspected flight booking handoff. The card-level low-confidence copy explicitly says "Not enough route history for a confirmed deal rating" (`app/components/FlightCard.tsx:142` to `app/components/FlightCard.tsx:144`), and the booking CTA says price and availability can change for external provider links (`app/components/FlightCard.tsx:196` to `app/components/FlightCard.tsx:200`).

The blocker is omission, not overclaiming: booking review drops the score context entirely.

## Mobile 375px and Desktop Observations

Browser screenshot pass was blocked because the sandbox could not start the local Next server: `listen EPERM: operation not permitted 0.0.0.0:3001`. Static responsive review:

- Search loading state: results view shows a provider scanning message and six flight skeleton cards when no fares have streamed (`components/flights/FlightResults.tsx:227` to `components/flights/FlightResults.tsx:247`). At 375px, the grid is single-column; desktop expands at `sm`/`lg`.
- Search empty state: empty results use one state panel with specific copy for missing dates, filtered-out results, provider unavailable, or no inventory (`components/flights/FlightResults.tsx:124` to `components/flights/FlightResults.tsx:145`, rendered at `components/flights/FlightResults.tsx:248` to `components/flights/FlightResults.tsx:258`).
- Search error state: top results header shows the error and a Retry button (`app/page.tsx:1096` to `app/page.tsx:1105`). No result-card selection is possible in that state.
- Selected flight review state: booking review stacks content before `lg`, then uses a two-column review/form layout on desktop (`app/book/BookingFlow.tsx:163` to `app/book/BookingFlow.tsx:186`). The enabled booking form has a sticky bottom submit area on mobile (`app/book/BookingFlow.tsx:404` to `app/book/BookingFlow.tsx:415`).
- Missing selected fare state: `/book` without valid context shows "We can't identify this fare" and blocks confirmation (`app/book/BookingFlow.tsx:287` to `app/book/BookingFlow.tsx:295`).
- Paused booking state: with valid context and booking disabled, the review shows fare facts plus "In-app booking is paused" and does not collect passenger/payment details (`app/book/BookingFlow.tsx:298` to `app/book/BookingFlow.tsx:307`).
- Hotel selected-result state: blocked. Hotel cards can only open external deeplinks; no in-app hotel review state exists (`app/components/HotelCard.tsx:271` to `app/components/HotelCard.tsx:287`).

No source-level evidence of overlapping primary actions was found in the booking review layout. Live visual confirmation at 375px and desktop remains blocked by the sandbox server bind failure.

## Verification Commands

- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --passWithNoTests --runInBand` - passed. 18 suites passed, 147 tests passed.
- `npm run dev` - blocked by environment: Next could not bind to `0.0.0.0:3001` with `EPERM`.

## Required Return Note

- What changed and why: Added this QA audit report documenting every observed search-result to booking-review continuity issue for the assigned P0 ticket.
- Files changed: `docs/audits/2026-06-30-audit-results-booking-handoff-06.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm test -- --passWithNoTests --runInBand` passed with 18 suites and 147 tests; `npm run dev` was blocked by sandbox port binding (`EPERM`).
- Out-of-scope findings or blockers: No product code was changed. Live browser screenshot capture was blocked by the local server bind failure. Hotel booking review is unavailable because the current hotel handoff leaves the app directly from `HotelCard`.
