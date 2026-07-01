# AUDIT-HOTEL-BOOKING-ENTRY-TRUST-BOUNDARY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Hotel result to booking entry trust boundary

## Verdict

Hotel booking entry does not currently preserve all user-visible hotel selection facts because there is no in-app hotel booking entry in this worktree. Hotel cards hand off directly to HotelLook via an external affiliate link, while `/book` is a flight-only fare review surface.

This is safer than silently replacing hotel context with generic booking copy, but it does not satisfy the paid-user goal of landing on an expaify booking entry that preserves hotel name, stay dates, nights, price basis, provider/source, and policy context.

## Requested Surface Mismatch

The ticket asked to inspect these files, but they are absent in this worktree:

- `components/hotels/HotelResults.tsx`
- `components/hotels/HotelCard.tsx`
- `components/hotels/HotelPrice.tsx`
- `components/hotels/HotelPolicySummary.tsx`
- `lib/booking.ts`

Actual local surfaces inspected:

- `app/components/HotelCard.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/book/route.ts`
- `app/api/search/route.ts`
- `lib/booking/config.ts`
- `lib/providers/hotellook.ts`
- `lib/types.ts`

## Findings

### P0: No hotel booking entry exists; hotel selection never reaches `/book`

Repro:

1. Run a round-trip search with destination and dates.
2. Open the Hotels tab when hotel results are available.
3. Select the primary hotel action.

Expected:

- User enters an expaify booking review or handoff entry that preserves hotel name, stay dates, nights, price, currency, source/provider, and policy visibility, or clearly blocks continuation when required hotel context is unavailable.

Actual:

- `app/components/HotelCard.tsx:257` renders a direct external `<a>`.
- `app/components/HotelCard.tsx:258` uses `hotel.deeplink`, not an internal `/book` URL.
- `app/components/HotelCard.tsx:259` opens a new tab.
- `app/components/HotelCard.tsx:264` labels the action `Check with HotelLook`.
- `app/components/HotelCard.tsx:269` warns only that provider prices can change.

Impact:

- There is no expaify hotel booking entry to preserve visible hotel intent after selection.
- Refresh/direct-entry behavior for hotel booking cannot be verified because no hotel booking route/state exists.
- The user leaves expaify before seeing a persisted hotel review state.

### P0: `/book` is flight-only and blocks hotel context as invalid fare context

Repro:

1. Directly open `/book` without flight fare query params.
2. Directly open `/book` with hotel-like params such as hotel name, check-in, checkout, price, provider.

Expected:

- If hotel booking entry is supported, hotel context is preserved.
- If required context is missing/stale, continuation is blocked with hotel-specific copy.

Actual:

- `app/book/page.tsx:5` sets metadata to `Book flight - expaify`.
- `app/book/page.tsx:13` only parses `parseBookingFareContext`.
- `lib/booking/config.ts:3` defines `BookingFareContext` with flight fields only.
- `lib/booking/config.ts:71` validates airport codes, carrier, stops, fare price, passengers, and price scope.
- `app/book/BookingFlow.tsx:233` says `We can't identify this fare`.
- `app/book/BookingFlow.tsx:253` tells the user to use a current search result with provider, route, dates, passenger count, and integer-cent price.

Impact:

- Missing hotel context is blocked honestly, but the copy is flight/fare-specific rather than hotel-specific.
- A user who somehow lands on `/book` from hotel context gets generic flight-fare recovery, not continuity for hotel selection.

### P1: Hotel result data model cannot preserve stay dates, nights, or policy visibility

Evidence:

- `lib/types.ts:47` defines `HotelOffer` with id, name, area, stars, pricePerNight, rating, photoUrl, deeplink, and source only.
- `lib/types.ts:55` includes only `deeplink` for handoff.
- There are no check-in, checkout, nights, cancellation policy, tax/fee basis, room/rate plan, or provider policy fields.
- `lib/providers/hotellook.ts:102` maps provider data into the same limited shape and discards the search date context after deeplink creation.

Impact:

- Even if a hotel booking entry were added later, the current offer object cannot carry all acceptance-criteria facts.
- The HotelCard displays price basis as nightly and before taxes/fees, but not the stay dates or number of nights.

### P1: Hotel deeplink likely does not preserve dates in provider handoff

Evidence:

- Search calls HotelLook with `checkIn` and `checkOut` in `lib/providers/hotellook.ts:77` and `lib/providers/hotellook.ts:78`.
- The generated deeplink in `lib/providers/hotellook.ts:55` only points at `https://hotellook.com/hotels/{hotelId}` through `tp.media`.
- The deeplink does not include check-in or check-out.

Impact:

- The selected stay dates may disappear after handoff to HotelLook.
- A paid user can reasonably see this as context loss: hotel name survives, but date intent does not.

### P2: Policy visibility is absent, but no fake policy is shown

Evidence:

- `app/components/HotelCard.tsx` shows hotel class, guest rating, Deal Score, nightly rate, and provider handoff text.
- There is no cancellation/deposit/refund/fees policy summary.

Impact:

- This does not meet policy visibility in the ticket scope.
- Positive: the UI does not invent fake policy details.

## State Coverage

- Empty hotel state: handled with `No hotel inventory found` / provider status copy in `app/page.tsx`.
- Loading hotel state: skeleton cards render while searching in `app/page.tsx`.
- Error/unavailable hotel state: handled with hotel-provider unavailable copy in `app/page.tsx`.
- Primary hotel action disabled honesty: `app/components/HotelCard.tsx:255` only enables action when both valid URL and valid money exist; otherwise it renders `Booking unavailable`.
- Missing `/book` state: handled honestly as invalid/missing fare context, but flight-specific.

## Manual Verification

Manual browser verification was attempted but blocked by the execution sandbox:

- `npm run dev` failed with `listen EPERM: operation not permitted 0.0.0.0:3001`.
- `npm run dev -- --hostname 127.0.0.1 --port 3000` failed with `listen EPERM: operation not permitted 127.0.0.1:3000`.

Because no local HTTP server could bind to a port, I could not complete the requested browser flow:

1. Run a hotel search.
2. Choose a hotel.
3. Land on booking.
4. Refresh booking page.
5. Inspect desktop and 375px mobile continuity.

Source-level verification confirms step 3 cannot occur in this worktree because hotel cards link externally and `/book` accepts flight fare context only.

## Verification Commands

- `npx tsc --noEmit --incremental false`: passed.
- `npm test -- --runInBand --passWithNoTests`: passed, 20 suites / 176 tests.

Note: `package.json` has no `tsc` npm script, so `npm run tsc` is not available. The explicit TypeScript command from the ticket was used.

## Changed Files

- Added this audit report only.

## Out-of-Scope / Blockers

- Browser/manual mobile and desktop verification is blocked by sandbox port binding (`EPERM`).
- No hotel booking route or hotel booking state exists to audit end-to-end.
- Requested `components/hotels/*` files and `lib/booking.ts` are absent from this worktree.
- I did not implement payment, confirmation, account features, provider integration changes, or unrelated flight booking redesigns.
