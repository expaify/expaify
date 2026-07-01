# AUDIT-BOOKING-REVIEW-HOTEL-PARITY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Hotel selected-offer continuity from results to booking review, compared with flight booking review.

## Summary

Fail. Hotel offers do not have booking review parity with flight offers because hotel result CTAs bypass `/book` entirely and open the provider deeplink in a new tab. The local booking review page is flight-only: it accepts `BookingFareContext`, validates airport route fields, renders "fare" and "flight" copy, and has no hotel offer context shape.

This is not just missing polish. A selected hotel offer cannot be reviewed locally for preserved price, currency, stay dates, traveler count, provider, or policy context before handoff. The hotel card honestly says provider prices can change, but expaify gives hotel users less continuity than flight users.

## Files Inspected

- `app/page.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/book/route.ts`
- `app/components/HotelCard.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `lib/booking/config.ts`
- `lib/types.ts`

Requested file note: `components/hotels/HotelCard.tsx` and `lib/booking.ts` do not exist in this worktree. The active local files are `app/components/HotelCard.tsx` and `lib/booking/config.ts`.

## Hotel Field Continuity

| Hotel result field | Result source/render | Survives into `/book` review? | QA note |
|---|---:|---:|---|
| Hotel name | `app/components/HotelCard.tsx:208` | No | CTA goes to `hotel.deeplink`, not `/book`. |
| Area/location | `app/components/HotelCard.tsx:212` | No | Not passed anywhere after click. |
| Hotel class/stars | `app/components/HotelCard.tsx:222` | No | Result-only. |
| Guest rating | `app/components/HotelCard.tsx:229` | No | Result-only; optional and honestly omitted when unavailable. |
| Nightly price | `app/components/HotelCard.tsx:50` and `app/components/HotelCard.tsx:249` | No | Result shows integer-minor-unit money formatted as nightly rate, but review never receives it. |
| Currency | `app/components/HotelCard.tsx:57` via `formatMoney` | No | Embedded in result display only. |
| Taxes/fees policy | `app/components/HotelCard.tsx:59` | No | Result says "before taxes and fees"; no review page confirmation. |
| Booking URL/provider handoff | `app/components/HotelCard.tsx:257` | N/A | Opens provider directly with `target="_blank"`. |
| Provider name | `app/components/HotelCard.tsx:261` and `app/components/HotelCard.tsx:264` | No | Hard-coded "HotelLook" in CTA; not preserved in review. |
| Price-change caveat | `app/components/HotelCard.tsx:269` | No | Honest on result card, absent from local review because there is no local review. |
| Stay dates | `app/page.tsx:914` result context has route/date copy for empty states | No | Hotel card does not render check-in/check-out and no booking review receives them. |
| Traveler count | `app/page.tsx:914` result context can include passenger count in surrounding page state | No | Hotel card does not show traveler/guest count and review has no hotel guest shape. |
| Hotel policy/cancellation context | No hotel type fields in `lib/types.ts` | No | Unavailable data is not invented, which is correct, but the review page cannot mark it unavailable for hotels. |

## Flight Comparison

Flight review has a clear selected-offer path:

- Flight cards detect safe internal booking links for Duffel fares and can render a local review CTA, "Review paused booking" (`app/components/FlightCard.tsx:241`, `app/components/FlightCard.tsx:248`).
- Flight cards display route, carrier/provider, dates, stops, price basis, passenger count, Deal Score status, and CTA caveat before handoff (`app/components/FlightCard.tsx:261`, `app/components/FlightCard.tsx:280`, `app/components/FlightCard.tsx:299`, `app/components/FlightCard.tsx:352`).
- The booking review parses and validates serialized fare context (`lib/booking/config.ts:3`, `lib/booking/config.ts:71`, `lib/booking/config.ts:123`).
- The review page repeats route, carrier, depart, return, stops, passengers, price basis, provider, and technical reference (`app/book/BookingFlow.tsx:81`, `app/book/BookingFlow.tsx:100`).
- Loading/error/recovery states keep fare context visible when valid (`app/book/BookingFlow.tsx:177`, `app/book/BookingFlow.tsx:189`).

Hotels do not have an equivalent path. Their CTA always opens the provider URL from the result card (`app/components/HotelCard.tsx:257`) and does not preserve selected hotel context in `/book`.

## Findings

### P1: Hotel selected offer cannot be reviewed locally before provider handoff

Repro:
1. Run a round-trip search with destination and dates so hotel search is eligible.
2. Open the Hotels tab when hotel inventory is available.
3. Click `Check with HotelLook` on a hotel result.

Expected:
Selected hotel name, nightly price/currency, stay dates, traveler/guest count, provider, and unavailable policy fields are preserved or honestly marked unavailable in a booking review with clarity comparable to flights.

Actual:
The click opens `hotel.deeplink` directly in a new tab. No local booking review page is shown and no hotel context is serialized to `/book`.

Evidence:
- Hotel CTA uses `href={hotel.deeplink}` and `target="_blank"` (`app/components/HotelCard.tsx:257`).
- Booking review accepts only `BookingFareContext` flight fields (`lib/booking/config.ts:3`).
- Booking review validates IATA origin/destination and carrier/stops (`lib/booking/config.ts:85`), making hotel context invalid by design.

Impact:
Hotel users do not get the same "selected offer preserved" confidence that flight users get. Price, dates, guest/traveler count, and provider context can disappear at the moment of handoff.

### P1: Hotel stay dates and traveler count are not shown on hotel cards or review

Repro:
1. Search a destination with round-trip dates and more than one passenger.
2. Review a hotel result card.
3. Compare it to a flight card and flight booking review.

Expected:
The hotel result or review confirms the stay dates and traveler/guest count, or marks them unavailable if the provider cannot return them.

Actual:
Hotel cards show name, area, class, optional rating, Deal Score, nightly price, and provider CTA. They do not show check-in date, checkout date, nights, passenger/guest count, or room occupancy. Because there is no hotel review page, those fields never reappear.

Evidence:
- `HotelOffer` type has no date, guest, room, policy, or fee fields (`lib/types.ts`).
- Hotel card render fields are limited to hotel identity, area, class/rating, score, price, and CTA (`app/components/HotelCard.tsx:187` through `app/components/HotelCard.tsx:285`).

Impact:
The user cannot confirm that the selected hotel handoff is for the same stay context they searched. This is a trust risk even when the provider deeplink itself is valid.

### P2: `/book` empty/error copy is flight-specific and misleading for hotel attempts

Repro:
1. Manually open `/book` with no query params.
2. Manually open `/book?offerId=hotel_1&provider=hotellook&priceCents=12000&currency=USD`.

Expected:
If hotels are unsupported in review, the page should say hotel review is unavailable or return users to hotel results without implying a missing flight fare.

Actual:
The invalid state says "We can't identify this fare", "choose a current flight result", and "verified provider, route, dates, passenger count, and integer-cent price" (`app/book/BookingFlow.tsx:224`). This is accurate for flights but not an honest hotel-specific recovery state.

Impact:
A hotel user who lands on `/book` through a shared or stale link gets flight-specific recovery instructions. That is confusing and reinforces the parity gap.

## State Review

- Loading: Booking review fallback is coherent for flight fare review, but hotel review has no loading path (`app/book/page.tsx` and `app/book/BookingFlow.tsx`).
- Empty: `/book` with missing context is coherent for flights but flight-specific for hotels.
- Error: Valid flight context is retained in booking errors (`app/book/BookingFlow.tsx:321`). No hotel equivalent exists.
- Mobile 375px: Flight review uses single-column-first layout and sticky bottom submit; no hotel review exists to validate. Hotel cards use stacked CTA layout at mobile (`app/components/HotelCard.tsx:248`), but selected-offer continuity is still absent.
- Desktop: Flight review has two-column summary/action layout (`app/book/BookingFlow.tsx:170`). No hotel review exists to compare.
- Browser back/retry from results: Since hotel CTA opens a new provider tab, browser back inside expaify is not part of the hotel handoff. Returning to the existing results tab preserves client state if the tab remains open, but no review state is involved.

## Manual Verification Flow

Live provider hotel inventory was not verified because this audit did not use external live credentials. The inspected app path shows HotelLook can be unavailable/empty, and the ticket permits recording the blocker.

Covered from local code paths:
1. Hotel search eligibility: `app/page.tsx` only loads hotels for destination + depart + return + roundtrip.
2. Hotel select: `HotelCard` only exposes direct provider deeplink or "Booking unavailable".
3. Booking review: `/book` only parses `BookingFareContext`.
4. Browser back: Not applicable to hotel review because hotel review is never entered; provider opens in a new tab.
5. Retry from results: Hotel empty state has `Edit search`; flight unavailable state may show retry. No hotel booking review retry exists.
6. Flight comparison: Flight card and booking review preserve selected fare fields as listed above.

## Acceptance Criteria Result

- Exact hotel fields shown on result card and survival into booking review: Complete, see Hotel Field Continuity.
- Manual flow covers hotel search, select hotel, booking review, browser back, retry from results: Complete with blocker noted for live hotel inventory and no local hotel review path.
- Includes comparison against flight booking review path: Complete.
- Findings identify broken/missing/misleading hotel continuity with file references: Complete.
- Run `npm run tsc`: Failed because `package.json` has no `tsc` script.
- Run direct TypeScript check: `npx tsc --noEmit --incremental false` passed.
- Run nearest Jest command: `npm test -- --runInBand` passed, 20 suites and 176 tests.
- Run requested Jest fallback: `npm test -- --passWithNoTests` passed, 20 suites and 176 tests.

## Recommendation

Do not implement hotel booking, payment, or policy features under this audit ticket. File a repair ticket to either:

1. Add an explicitly review-only hotel handoff page that serializes only real hotel fields and marks missing stay/policy/fee fields unavailable, or
2. Make the product copy explicit that hotel offers skip expaify booking review and go directly to provider, while adding stay-date and traveler-count confirmation to the result/handoff surface.
