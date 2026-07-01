# AUDIT-MOBILE-HOTEL-BOOKING-CONTINUITY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Mobile hotel results-to-booking continuity at 375px. Audit only.

## Verdict

Fail for the assigned continuity goal.

The local app does not have a hotel booking review path. Hotel results hand off directly to an external HotelLook affiliate URL from the result card, while `/book` only parses and validates flight fare context. Because there is no selected-hotel review route, the app cannot continuously preserve selected hotel name, stay dates, currency, nightly price basis, and primary action from hotel results into booking review.

## Requested File Mismatch

The ticket asked to inspect these files, but they do not exist in this worktree:

- `components/hotels/HotelCard.tsx`
- `components/hotels/HotelPrice.tsx`
- `components/hotels/HotelPolicySummary.tsx`
- `components/hotels/HotelResults.tsx`
- `lib/booking.ts`

Equivalent local surfaces inspected:

- `app/page.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/book/route.ts`
- `app/components/HotelCard.tsx`
- `lib/booking/config.ts`
- `lib/types.ts`
- `app/api/search/route.ts`
- `lib/providers/hotellook.ts`

## Finding 1 - No hotel booking review exists

Severity: P0

Repro:

1. Run a valid round-trip destination search, for example `origin=JFK&dest=LAX&depart=2026-09-22&return=2026-09-29&trip=roundtrip&passengers=1&tab=hotels`.
2. Wait for hotel results, or use mocked `hotellook.searchHotels` data matching the existing route tests.
3. Open a hotel card primary action.
4. Observe that the CTA opens `hotel.deeplink` in a new tab instead of navigating to `/book`.

Expected:

- A hotel selection that enters booking review should keep the chosen hotel name, check-in/check-out dates, currency, price basis, and primary action visible at 375px.
- Browser back from booking review should return to the exact hotel results context.
- Refresh on booking review should either preserve selected hotel context or clearly explain recovery.

Actual:

- The hotel CTA is `href={hotel.deeplink}`, `target="_blank"`, and copy says `Check with HotelLook` plus `Opens provider site. Prices can change.` (`app/components/HotelCard.tsx:257`).
- The home page renders hotel cards directly from `hotels.map(...)`; it does not build a selected-hotel booking URL or store selected hotel context (`app/page.tsx:1473`).
- `HotelOffer` has only `id`, `name`, `area`, `stars`, `pricePerNight`, optional `rating/photoUrl`, `deeplink`, and `source`; it has no check-in, checkout, total stay price, policy, or review-context fields (`lib/types.ts:47`).
- `/book` imports `parseBookingFareContext` and passes only `fareContext` to `BookingFlow` (`app/book/page.tsx:2`, `app/book/page.tsx:13`).
- `BookingFareContext` is flight-only: origin, destination, depart, carrier, stops, price, passengers, and price scope (`lib/booking/config.ts:3`).

User impact:

- Mobile users selecting a hotel leave expaify directly from the result card. There is no intermediate review page to reinforce selected hotel intent before provider handoff.
- This is acceptable only if the product intent is "hotel provider handoff from results"; it fails the assigned ticket's stated "results into booking review" continuity goal.

## Finding 2 - `/book` cannot recover hotel intent

Severity: P0

Repro:

1. Open `/book` directly without flight fare query params.
2. Or attempt to construct a hotel-oriented URL such as `/book?hotelId=123&name=Hotel%20Example&priceCents=18900&currency=USD`.
3. Review the rendered recovery state.

Expected:

- If hotel booking review is supported, the route should parse selected hotel context.
- If unsupported, recovery copy should clearly tell the user that hotel review is unavailable and return them to hotel results.

Actual:

- `/book` validates only `BookingFareContext`; hotel query fields are ignored and validation returns `null` (`lib/booking/config.ts:123`).
- Invalid booking state says `We can't identify this fare` and `Return to search and choose a current flight result` (`app/book/BookingFlow.tsx:232`).
- The only recovery action is `Back to search`, linked to `/`, not the prior search URL (`app/book/BookingFlow.tsx:257`).

User impact:

- Any accidental or future hotel link into `/book` loses hotel-specific intent and shows flight-specific recovery copy.
- Refresh cannot preserve selected hotel context because no selected hotel context is accepted by the route.

## Finding 3 - Mobile result header hides hotel stay dates

Severity: P1

Repro:

1. At 375px, run a dated round-trip search and switch to the Hotels tab.
2. Scroll through hotel results.
3. Check the sticky result header.

Expected:

- Mobile hotel results should keep route/destination and stay dates visible before handoff, especially because hotel cards do not repeat check-in/check-out dates.

Actual:

- The sticky result header truncates route text and hides dates on mobile with `hidden ... sm:inline` (`app/page.tsx:1263`).
- Hotel cards show name, area, class/rating, Deal Score when available, nightly price, and provider CTA, but no check-in or checkout dates (`app/components/HotelCard.tsx:205`, `app/components/HotelCard.tsx:248`).
- Search context appears in hotel empty states, but not on each populated hotel card (`app/page.tsx:1467`).

User impact:

- At 375px, once a hotel card is in view, the selected hotel name and nightly price are visible, but stay dates are not continuously visible before the external provider handoff.

## Manual Verification Flows

### 375px hotel search to booking review

Status: Failed by product path absence; live visual execution blocked by sandbox.

Steps to run in a local browser with provider mocks or working hotel credentials:

1. Set viewport to 375px wide.
2. Search `JFK` to `LAX`, depart `2026-09-22`, return `2026-09-29`, round trip, 1 passenger.
3. Switch to Hotels after results load.
4. Tap `Check with HotelLook` on a hotel card.
5. Observe that the app opens the external provider URL in a new tab and never enters `/book`.

Result:

- No booking review entry occurs for hotels.
- Selected hotel name, nightly price, and provider action are visible on the card before handoff.
- Stay dates are not visible on the card and are hidden in the sticky header at 375px.
- Currency and price basis are visible as `Nightly rate` and `per night before taxes and fees`.

### Browser back from booking review to hotel results

Status: Failed by product path absence.

Steps:

1. Complete the 375px hotel search above.
2. Tap a hotel CTA.
3. Attempt browser back from a hotel booking review page.

Result:

- There is no expaify hotel booking review page to return from.
- The actual action opens a new provider tab, leaving the expaify results tab behind.
- If a user manually visits `/book`, the `Back to search` link goes to `/` and does not preserve the prior hotel search URL (`app/book/BookingFlow.tsx:167`).

### Refresh behavior

Status: Selected hotel context does not survive because it is never represented in an expaify review URL.

Observed/source-backed behavior:

- Results search state can be represented in the home page URL via `origin`, `dest`, `depart`, `return`, `passengers`, `trip`, and `tab=hotels` (`app/page.tsx:148`).
- On reload, `parseCriteriaFromUrl` can re-run the search and restore the active Hotels tab when valid (`app/page.tsx:163`, `app/page.tsx:551`).
- The selected hotel itself is not encoded in the URL and no `/book` hotel context exists.
- Direct `/book` reload with missing or hotel-shaped params shows flight-specific invalid fare recovery copy.

## Loading, Empty, Error, Mobile, Desktop States

Loading:

- Hotel tab renders existing hotel cards plus skeletons while search is still running (`app/page.tsx:1437`).
- Per-card Deal Score loading renders a skeleton area (`app/components/HotelCard.tsx:240`).

Empty:

- Empty hotel inventory renders `No hotel inventory found` and includes the search context (`app/page.tsx:1452`).
- Missing destination or dates disables the Hotels tab and explains why hotels were not included (`app/page.tsx:1399`).

Error/unavailable:

- Hotel provider failures become bounded hotel status copy instead of raw provider errors (`app/api/search/route.ts:299`).
- Hotel unavailable state offers `Edit search` (`app/page.tsx:1457`).

Mobile 375px source review:

- Hotel grid is one column below `sm` (`app/page.tsx:1473`).
- Price and CTA stack vertically below `sm`, keeping the CTA full width (`app/components/HotelCard.tsx:248`, `app/components/HotelCard.tsx:254`).
- No code-level sticky hotel action was found that would cover card facts.
- Critical date context is not continuously visible on populated hotel cards.

Desktop source review:

- Hotel grid becomes two columns at `sm` and three columns at `lg` (`app/page.tsx:1473`).
- Card price and CTA switch to side-by-side at `sm` (`app/components/HotelCard.tsx:248`).

## Verification

- `npm run tsc -- --noEmit --incremental false` - failed because `package.json` has no `tsc` script.
- `npx tsc --noEmit --incremental false` - passed.
- `npm run test -- --runInBand` - passed: 20 suites, 176 tests.
- `npm test -- --passWithNoTests` - passed: 20 suites, 176 tests.
- `npm run dev` - blocked by sandbox: Next failed with `listen EPERM: operation not permitted 0.0.0.0:3001`.
- `HOSTNAME=127.0.0.1 PORT=3100 npm run dev` - blocked by sandbox: Next still attempted `0.0.0.0:3100` and failed with `listen EPERM`.

## Blockers

- Live 375px browser verification was blocked because the sandbox does not permit the Next dev server to bind a local port.
- No Playwright, Puppeteer, or jsdom browser package is installed in this repo. I did not add tooling because this is an audit ticket.
- The requested hotel booking review files are absent.
- The product surface required by the ticket, hotel results into expaify booking review, is absent.

## Out Of Scope

- No UI repairs were made.
- No provider adapter changes were made.
- No booking API contract changes were made.
- Flight booking behavior was only inspected for parity/mismatch with the requested hotel review path.

## Changes

Audit document added only.
