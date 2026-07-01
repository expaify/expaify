# AUDIT-BOOKING-REVIEW-BROWSER-NAVIGATION-RECOVERY-01

## Scope

Audited booking review browser navigation recovery in the current worktree.

Requested first-pass files:
- `app/page.tsx` exists and was inspected.
- `app/book/page.tsx` exists and was inspected.
- `app/book/BookingFlow.tsx` exists and was inspected.
- `app/api/book/route.ts` exists and was inspected.
- `components/flights/FlightResults.tsx` exists and was inspected.
- `lib/booking.ts` does not exist; current booking helpers are under `lib/booking/config.ts`.
- `components/hotels/HotelCard.tsx` and `components/hotels/HotelResults.tsx` do not exist; current hotel result surface is `app/components/HotelCard.tsx`.
- `lib/types.ts` exists and was inspected.

## State Classification

Flight selected-result continuity: Partial. Duffel flight result cards link to `/book` with selected fare context in query params. `offerId`, provider, route, dates, carrier, stops, integer-cent price, currency, passenger count, and price basis survive direct link reload because `app/book/page.tsx` parses search params through `parseBookingFareContext`.

Hotel selected-result continuity: Not a local booking review flow in this tree. Hotel cards open the HotelLook deeplink in a new tab. There is no `/book` hotel review page and no local selected hotel recovery state.

Price basis continuity: Present for flights. `buildBookingHref` writes `priceCents`, `currency`, `passengerCount`, and `priceScope`; the booking page displays per-person versus party-total copy from that context.

User-entered booking fields: Not durable. Traveler fields are local React state in `BookingFlow`. Browser reload loses them. Back/forward may survive only if the browser restores the page from bfcache; the app does not intentionally persist fields.

Submit duplication: Risk present when booking is enabled. The button disables while `state === 'loading'`, but the API has no client idempotency key and the success state is not URL/session durable. Reloading after success renders the same selected fare review again and can submit another order for the same offer.

Return-to-results: Inconsistent. Browser Back from `/book?...` should return to the results URL when the user came from a result card, because searches write query state to the URL. The visible `Back to search`, `Search more flights`, and error recovery links all point to `/`, which discards the previous result set and selected tab/filter context.

## Findings

### P1 - Success reload can expose the same fare for duplicate submission

Files:
- `app/book/BookingFlow.tsx`
- `app/api/book/route.ts`

Evidence:
- Success is held only in `bookingRef` and `state` React memory in `BookingFlow`.
- The booking URL remains the same selected fare URL after success.
- Reloading the page reconstructs `fareContext` from query params and returns to the idle form.
- `POST /api/book` validates the selected fare and price, then creates a Duffel order without an idempotency token or prior-submission guard.

Repro:
1. Open a Duffel flight booking URL such as `/book?offerId=off_123&provider=duffel&origin=JFK&destination=LAX&depart=2026-09-22T08%3A00%3A00.000Z&carrier=AA&stops=0&priceCents=45000&currency=USD&passengerCount=1&priceScope=party_total`.
2. Set `BOOKING_ENABLED=true` and use a configured Duffel sandbox key.
3. Fill traveler fields and submit.
4. After the success panel appears, reload the browser.
5. Observe the form is available again for the same `offerId` and selected fare context.

Impact:
A paid travel user can unknowingly submit the same selected offer again after reload or forward navigation. The app does not silently change the selected travel option, but it does not preserve the terminal submission state honestly.

Smallest repair recommendation:
Add an idempotency key to the booking submission contract and disable/recover repeat submits for the same selected fare plus passenger identity. At minimum, persist a per-tab submitted state keyed by `offerId` and fare context in `sessionStorage` so reload shows a review-only "already submitted in this tab" state instead of a fresh submit form. Server-side idempotency is the stronger repair.

### P1 - Visible return links discard result context

Files:
- `app/book/BookingFlow.tsx`
- `app/page.tsx`

Evidence:
- `ReviewShell` renders `href="/"` for `Back to search`.
- Recovery, error, and success actions also render `href="/"`.
- Search/results URL state is built in `app/page.tsx`, but the booking URL does not carry a `returnTo` value and booking links do not preserve the prior search URL.

Repro:
1. Search a route and dates on the homepage.
2. Open a Duffel flight result's local booking review.
3. Click the visible `Back to search` link.
4. Observe the app returns to `/`, not the previous results URL with route/date/tab/filter state.

Impact:
Browser Back can recover intent, but the primary visible recovery action loses it. This is confusing on mobile where users often use page CTAs instead of browser controls.

Smallest repair recommendation:
Include a bounded internal `returnTo` query param in Duffel booking links, generated from the current results URL, and use it for booking-page return links after validating it stays on `/` with expected search params. If no valid return URL exists, keep `/`.

### P2 - Booking form field recovery is accidental, not controlled

File:
- `app/book/BookingFlow.tsx`

Evidence:
- Traveler fields are plain `useState` values.
- No `beforeunload`, `sessionStorage`, URL state, or draft warning exists.
- Reload always loses entered traveler fields.

Repro:
1. Open a valid flight booking review URL.
2. Fill first name, last name, date of birth, email, and phone.
3. Reload the page.
4. Observe all entered traveler fields are reset.

Impact:
Selected fare continuity is good, but user-entered booking intent is not recoverable across reload. This is acceptable only if the product intentionally treats the form as non-durable; the current UI does not warn users.

Smallest repair recommendation:
For repair mode, either add an honest unsaved-form warning on reload/navigation or persist a per-tab draft keyed by selected `offerId`. Do not create fake reservation state.

### P2 - Hotel booking review acceptance criteria does not match this worktree

Files:
- `app/components/HotelCard.tsx`
- `app/page.tsx`

Evidence:
- Hotel cards render external `target="_blank"` HotelLook links.
- No local hotel booking review page or hotel selected-result review state exists.
- `components/hotels/HotelCard.tsx` and `components/hotels/HotelResults.tsx` are absent.

Repro:
1. Run a search with destination and round-trip dates.
2. Open the Hotels tab when inventory exists.
3. Click `Check with HotelLook`.
4. Observe the flow leaves to provider handoff in a new tab rather than local booking review.

Impact:
The requested "hotel booking review" navigation audit cannot be completed as a local review path because that product surface is absent. Current hotel continuity is provider handoff only.

Smallest repair recommendation:
Update the ticket acceptance language to "hotel provider handoff continuity" for this repo, or add a separate approved feature ticket if a local hotel review page is desired.

## Positive Evidence

Flight selected fare context is recoverable by URL. `buildBookingHref` and `parseBookingFareContext` preserve the selected route, provider, price, passengers, and price basis without relying on in-memory result state.

The booking API does not silently accept stale price or passenger count. It fetches the Duffel offer before order creation and returns `409` if passenger count, price cents, or currency changed.

Invalid booking URLs are honest. Missing or malformed selected fare context renders `We can't identify this fare` and does not expose traveler submission controls.

Paused booking mode is honest. With booking disabled, the page preserves fare review details and says expaify is not collecting passenger details, payment details, or creating provider orders.

Mobile layout is structurally usable at 375px from code inspection. Booking review uses a single-column flow before the desktop `lg` split, the submit action is sticky at the bottom on mobile, and long technical references use `break-all`.

Desktop layout is structurally usable. Booking review uses a max-width shell with a fare summary column and sticky action panel.

## Manual Verification Flow

Runtime browser execution was blocked in this sandbox because `npm run dev` failed to bind a local port with `listen EPERM: operation not permitted 0.0.0.0:3001`.

Manual flow assessed from route/link code and executable unit coverage:
1. Flight results to review: a Duffel `FlightCard` uses an internal `/book?...` deeplink when `source === 'duffel'`; the selected fare values are encoded in query params.
2. Reload on review: `app/book/page.tsx` reparses `searchParams`, so selected fare, price basis, provider, and passenger count display again after reload.
3. Browser Back from review: if the user arrived from a search result, the previous browser entry should be the results URL because search writes route/date state into the current URL before navigation.
4. Browser Forward back to review: the `/book?...` URL should display the same selected fare context because no selected fare data depends on result-page memory.
5. Visible return action: clicking `Back to search` uses `/`, so it does not recover the prior result state.
6. Reload after success: success state is not URL/session durable, so the same review form returns and duplicate submission risk remains.
7. Hotel flow: no local hotel review URL exists; hotel booking opens provider handoff in a new tab.

## Verification Commands

`npm run dev`
- Failed: sandbox could not bind local server port (`listen EPERM: operation not permitted 0.0.0.0:3001`).

`npm run tsc`
- Failed: package has no `tsc` script.

`npx tsc --noEmit --incremental false`
- Passed.

`npm test -- --runInBand`
- Passed: 20 suites, 176 tests.

`npm test -- --passWithNoTests`
- Passed: 20 suites, 176 tests.

## Blockers / Out-of-Scope

No product code was changed.

No browser screenshot tooling is installed in this repo, and the sandbox blocks starting the Next dev server. Mobile and desktop state review is therefore code-path based, not screenshot based.

Authentication, saved bookings, payments, and fake reservation state are out of scope.
