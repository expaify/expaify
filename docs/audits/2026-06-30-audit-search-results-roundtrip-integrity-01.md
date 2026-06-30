# AUDIT-SEARCH-RESULTS-ROUNDTRIP-INTEGRITY-01

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Audit only. No feature code changed.

## Executive Decision

Not ready for paid-user trip-context trust.

Search state mostly preserves origin, destination, dates, trip type, passengers, and currency through URL state and result cards. The handoff layer breaks trust: Travelpayouts/Aviasales deeplinks do not carry the searched return date or 2-traveler context, Duffel booking review drops cabin and explicit trip type, and the mobile results header hides dates before the user reaches result actions.

## Files Inspected

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/api/search/route.ts`
- `app/api/book/route.ts`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `lib/booking/config.ts`
- `lib/providers/travelpayouts.ts`
- `lib/providers/duffel.ts`
- `lib/providers/kiwi.ts`
- `lib/providers/amadeus.ts`
- `lib/types.ts`

Requested ticket files not present at the specified paths:

- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`
- `app/api/tickets/route.ts`
- `app/api/tickets/[id]/route.ts`

The equivalent current surfaces appear to be `app/components/FlightCard.tsx`, `components/flights/FlightResults.tsx`, `/api/search`, `/book`, and `/api/book`.

## Field Matrix

| Field checked | Search entry / URL / API | Result card | Booking or provider handoff | Status |
| --- | --- | --- | --- | --- |
| Origin | URL builder sets `origin`; URL parser resolves it to IATA (`app/page.tsx:148`, `app/page.tsx:186`). `/api/search` resolves it again (`app/api/search/route.ts:95`). | Card shows `fare.origin` in title and depart column (`app/components/FlightCard.tsx:280`, `app/components/FlightCard.tsx:310`). | Duffel `/book` includes `origin` (`lib/booking/config.ts:144`). Travelpayouts deeplink includes origin in Aviasales path (`lib/providers/travelpayouts.ts:81`). | Pass |
| Destination | URL builder sets `dest` when present (`app/page.tsx:151`). `/api/search` resolves it when supplied (`app/api/search/route.ts:108`). | Card shows `fare.destination` in title and right column (`app/components/FlightCard.tsx:281`, `app/components/FlightCard.tsx:335`). | Duffel `/book` includes `destination` (`lib/booking/config.ts:145`). Travelpayouts deeplink includes destination in path (`lib/providers/travelpayouts.ts:81`). | Pass for fixed-destination searches |
| Departure date | URL builder sets `depart` (`app/page.tsx:152`). `/api/search` requires and validates it (`app/api/search/route.ts:119`). | Card shows formatted `fare.depart` (`app/components/FlightCard.tsx:313`). | Duffel `/book` includes `depart` (`lib/booking/config.ts:146`). Travelpayouts deeplink includes only compact depart date (`lib/providers/travelpayouts.ts:78`). | Pass |
| Return date | URL builder sets `return` for round trips (`app/page.tsx:153`). `/api/search` requires it for round trips (`app/api/search/route.ts:130`). | Card infers round trip from `fare.return` and shows return date when provider returns it (`app/components/FlightCard.tsx:266`, `app/components/FlightCard.tsx:337`). | Duffel `/book` includes `return` if present (`lib/booking/config.ts:155`). Travelpayouts deeplink builder has no return-date argument and drops it (`lib/providers/travelpayouts.ts:78`). | Fail |
| Trip type | URL builder sets `trip` (`app/page.tsx:155`). `/api/search` validates `roundtrip`/`oneway` (`app/api/search/route.ts:121`). | Card reconstructs label from presence of `fare.return`, not the searched `tripType` (`app/components/FlightCard.tsx:266`). | Duffel booking context has no explicit `tripType`; review infers from optional return (`lib/booking/config.ts:3`). External deeplinks vary by provider and Travelpayouts does not encode round trip. | Fail |
| Travelers | URL builder sets `passengers` (`app/page.tsx:154`). `/api/search` validates 1-9 (`app/api/search/route.ts:144`). | Results summary shows `× N passengers` (`app/page.tsx:1297`). Card price basis includes adults when `party_total`; `per_person` cards do not visibly repeat the searched count (`app/components/FlightCard.tsx:261`). | Duffel `/book` includes `passengerCount` (`lib/booking/config.ts:151`). Travelpayouts deeplink path hard-codes trailing `1` and has no passenger parameter (`lib/providers/travelpayouts.ts:81`). | Fail |
| Cabin | No cabin field exists in search criteria or URL. Duffel provider hard-codes `economy` in the provider request (`lib/providers/duffel.ts:160`). | Card shows `CabinBadge`, defaulting missing cabin to economy (`app/components/FlightCard.tsx:286`). | Duffel booking context and URL omit cabin (`lib/booking/config.ts:3`, `lib/booking/config.ts:140`). Booking review has no cabin fact (`app/book/BookingFlow.tsx:100`). | Fail |
| Currency | Provider fares use `price.priceCents` and `price.currency` (`lib/types.ts:1`). | Card displays money via `formatMoney` and validates money before CTA (`app/components/FlightCard.tsx:240`). | Duffel `/book` includes `currency`; review displays it with price (`lib/booking/config.ts:150`, `app/book/BookingFlow.tsx:95`). External provider handoff relies on provider deeplink. | Pass for Duffel, partial for external |

## Product Blockers

### 1. Travelpayouts handoff drops return date and traveler count

Evidence: Search includes `return` and `passengers` in the app URL/API (`app/page.tsx:153`, `app/page.tsx:154`, `app/api/search/route.ts:130`, `app/api/search/route.ts:144`). Travelpayouts result objects keep `passengerCount` and may keep `return` (`lib/providers/travelpayouts.ts:191`, `lib/providers/travelpayouts.ts:238`, `lib/providers/travelpayouts.ts:288`). The outbound deeplink builder accepts only `origin`, `dest`, and `departDate`, then creates `https://www.aviasales.com/search/${origin}${MMDD}${dest}1` (`lib/providers/travelpayouts.ts:78` to `lib/providers/travelpayouts.ts:82`).

Repro notes:

1. Search `JFK` to `LAX`, round trip, depart `2026-09-22`, return `2026-09-29`, 2 travelers.
2. Select a Travelpayouts result and inspect the provider link.
3. The link path can represent origin/destination/departure, but there is no searched return date and no 2-traveler parameter; the path ends in a hard-coded `1`.

Impact: A paid user can choose a round trip for 2 travelers in expaify and land at a provider search that is ambiguous or one-adult/one-way. This is a P0 trust break.

### 2. Mobile results hides searched dates before result actions

Evidence: In the sticky results header, the route label is visible, but the date span is `hidden ... sm:inline` (`app/page.tsx:1263` to `app/page.tsx:1266`). The result count line shows route and passenger count but not dates (`app/page.tsx:1295` to `app/page.tsx:1298`). On 375px, the required date context is not visible before sort/filter controls and result card actions.

Repro notes:

1. At 375px width, search a round trip with 2 travelers.
2. On results, inspect the sticky header and the summary above results.
3. Expected: route, depart/return dates, trip type, and travelers remain visible before the primary action.
4. Actual: route and passengers are visible; dates are hidden from the sticky header and absent from the result count summary.

Impact: Users must rely on memory or individual card dates before selecting a result. This fails the mobile acceptance criterion.

### 3. Duffel booking review drops cabin and explicit trip type

Evidence: Duffel sends a cabin class to the provider and maps result cabin into `fare.cabin` (`lib/providers/duffel.ts:160`, `lib/providers/duffel.ts:198`). Flight cards display the cabin badge (`app/components/FlightCard.tsx:286`). `BookingFareContext` does not include cabin or trip type (`lib/booking/config.ts:3` to `lib/booking/config.ts:16`), and `buildBookingHref` omits both (`lib/booking/config.ts:140` to `lib/booking/config.ts:157`). Booking review facts show route, carrier, depart, optional return, stops, passengers, price basis, and provider, but no cabin or trip type fact (`app/book/BookingFlow.tsx:100` to `app/book/BookingFlow.tsx:110`).

Repro notes:

1. Select a Duffel result from a round-trip search.
2. Open the `/book?...` review link.
3. Compare the card's cabin badge and trip label with the booking review facts.
4. Cabin is missing, and trip type is only implied by whether a return fact exists.

Impact: The review surface cannot prove the selected cabin or trip type remained unchanged.

## Other Findings

### Provider results can replace searched dates with provider dates

Result cards display provider fare dates (`fare.depart`, `fare.return`) rather than the searched date context (`app/components/FlightCard.tsx:313`, `app/components/FlightCard.tsx:337`). This is appropriate for live fare cards when providers return exact itinerary dates, but the page does not keep the searched date range visible on mobile. The combination makes date drift hard to detect.

### Round-trip return leg is directionally ambiguous on cards

For round trips, the card's right column label becomes `Return`, but it still displays `fare.destination` (`app/components/FlightCard.tsx:325` to `app/components/FlightCard.tsx:338`). The booking review displays a return date fact, not the return route direction (`app/book/BookingFlow.tsx:103` to `app/book/BookingFlow.tsx:105`). Users can confirm a return date exists, but not that it is destination back to origin.

### Amadeus result cards are non-actionable

Amadeus fares can normalize route, dates, travelers, and currency, but set `deeplink: ''` (`lib/providers/amadeus.ts:224` to `lib/providers/amadeus.ts:227`). `FlightCard` disables the CTA when no deeplink is present (`app/components/FlightCard.tsx:241` to `app/components/FlightCard.tsx:247`). This is not a round-trip data mutation, but it blocks handoff verification for those results.

## Manual Verification Flow

Target flow: round trip, 2 travelers, result selection, booking/handoff context.

Data used for repro notes:

- Origin: `JFK`
- Destination: `LAX`
- Trip type: round trip
- Depart: `2026-09-22`
- Return: `2026-09-29`
- Travelers: 2 adults

What was verified:

1. URL/API state: `buildSearchParams` emits `origin=JFK&dest=LAX&depart=2026-09-22&return=2026-09-29&passengers=2&trip=roundtrip` for this flow (`app/page.tsx:148` to `app/page.tsx:156`).
2. `/api/search` requires the return date for round trips and passes `{ depart, return, passengers }` to providers (`app/api/search/route.ts:119` to `app/api/search/route.ts:150`).
3. Results summary keeps route and passenger count visible on desktop/mobile but omits dates from the mobile header (`app/page.tsx:1263`, `app/page.tsx:1295`).
4. Duffel result selection preserves route, dates, passengers, price, and currency into `/book`, but drops cabin and explicit trip type (`lib/booking/config.ts:140` to `lib/booking/config.ts:157`).
5. Travelpayouts provider handoff preserves origin/destination/departure only in its outbound URL and drops return/travelers (`lib/providers/travelpayouts.ts:78` to `lib/providers/travelpayouts.ts:82`).

Screenshot note: live screenshot capture was not possible in this sandbox because `next dev` could not bind to either `0.0.0.0:3001` or `127.0.0.1:3010`; both failed with `listen EPERM`. Repro notes above are therefore source-backed and CLI-backed rather than screenshot-backed.

## Desktop Hierarchy

Desktop makes the searched route clear in the sticky header and result count (`app/page.tsx:1260`, `app/page.tsx:1296`). Dates are visible in the sticky header at `sm` and above (`app/page.tsx:1263` to `app/page.tsx:1266`). Travelers are visible only when more than one passenger is selected (`app/page.tsx:1297`). Trip type and cabin are not present in the page-level hierarchy; users must infer trip type from dates/cards and cabin from individual cards.

Desktop verdict: route and dates are clear without memory; trip type and cabin are not.

## Mobile 375px

Static responsive review shows the grid becomes single-column and primary actions remain reachable. The required context is incomplete before primary actions:

- Route: visible in sticky header.
- Dates: hidden in sticky header at mobile because of `hidden sm:inline`.
- Travelers: visible in the result count only when `passengers > 1`.
- Trip type: not explicitly visible in the page header.
- Cabin: visible per card, not page-level.
- Currency: visible per card price.

Mobile verdict: fail because required date context is hidden before result actions.

## Verification Commands

- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand` - passed. 20 suites passed, 168 tests passed.
- `npm test -- --passWithNoTests --runInBand` - passed. 20 suites passed, 168 tests passed.
- `npm run dev` - blocked by sandbox: `listen EPERM: operation not permitted 0.0.0.0:3001`.
- `npm run dev -- --hostname 127.0.0.1 --port 3010` - blocked by sandbox: `listen EPERM: operation not permitted 127.0.0.1:3010`.

## Required Return Note

- What changed and why: Added this audit report for `AUDIT-SEARCH-RESULTS-ROUNDTRIP-INTEGRITY-01`, documenting field-by-field trip-context continuity from search to results and booking/provider handoff.
- Files changed: `docs/audits/2026-06-30-audit-search-results-roundtrip-integrity-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm test -- --runInBand` passed with 20 suites and 168 tests; `npm test -- --passWithNoTests --runInBand` passed with 20 suites and 168 tests. Local dev server startup was blocked by sandbox port binding (`EPERM`) on both attempted host/port combinations.
- Out-of-scope findings or blockers: No product code was changed. Screenshots could not be captured because the sandbox blocked local server binding. The requested `TicketCard`, `TicketSlideOver`, and `/api/tickets` files do not exist in this worktree, so the audit followed the actual current flight result and booking paths.
