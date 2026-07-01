# AUDIT-BOOKING-HOTEL-IDENTITY-CONTINUITY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Hotel result identity continuity into booking review.

## Verdict

Fail, blocked by missing local hotel booking review.

The selected hotel identity does not continue into `app/book` because hotel results do not link to the in-app booking flow. `app/components/HotelCard.tsx` opens the provider deeplink directly, while `app/book/page.tsx` and `app/book/BookingFlow.tsx` only parse and render flight fare context. No hotel booking context type exists in `lib/types.ts` or `lib/booking/config.ts`.

## Finding 1 - Hotel result cannot enter in-app booking review

Severity: P0

Repro:
1. Run a round-trip search with origin, destination, departure date, and return date.
2. Open the Hotels tab when hotel inventory is available.
3. Select the primary CTA on a hotel result.
4. Observe the destination.

Expected:
- Booking review preserves the selected hotel name, location, dates, guests, provider, price, currency, and policy summary.
- Any missing, stale, or unavailable hotel data is explicitly disclosed in the booking review.

Actual:
- The hotel CTA is an external link to `hotel.deeplink`, not `/book`.
- The CTA label is `Check with HotelLook`.
- The disclosure says `Opens provider site. Prices can change.`
- The in-app booking review has no hotel review path to preserve or compare hotel identity.

Evidence:
- Hotel card renders name, area, class/rating, nightly rate, and the external provider handoff: `app/components/HotelCard.tsx:208`, `app/components/HotelCard.tsx:217`, `app/components/HotelCard.tsx:222`, `app/components/HotelCard.tsx:248`, `app/components/HotelCard.tsx:257`.
- Hotel unavailable state is honest on the result card when price or deeplink is missing: `app/components/HotelCard.tsx:181`, `app/components/HotelCard.tsx:252`, `app/components/HotelCard.tsx:275`.
- Hotel results render `HotelCard` directly in the Hotels tab; there is no selected-hotel state or `/book` handoff: `app/page.tsx:1435`, `app/page.tsx:1473`.
- Booking context is flight-only: `lib/booking/config.ts:3`.
- `/book` review renders fare route, carrier, stops, passengers, price basis, and provider, not hotel fields: `app/book/BookingFlow.tsx:81`.

User impact:
- A user cannot verify that the hotel they selected on results is the same hotel being reviewed in-app, because no in-app hotel review exists.
- If a user expects the booking flow to review hotels, hotel identity disappears completely at the boundary.

## Field-by-field continuity checklist

| Field | Result card source | Booking review status | Pass/Fail |
| --- | --- | --- | --- |
| Hotel name | `hotel.name` in `HotelCard` heading | Not accepted or rendered by `/book` | Fail |
| Location/area | `hotel.area` when present | Not accepted or rendered by `/book` | Fail |
| Dates | Search criteria controls/results context, not `HotelOffer` | Not accepted or rendered as hotel stay dates | Fail |
| Guests | Search passengers is flight-oriented; `HotelProvider.searchHotels` accepts only checkin/checkout | Not accepted or rendered as hotel guests | Fail |
| Provider | `hotel.source` exists, CTA hard-codes `HotelLook` label | `/book` provider field is flight fare provider only | Fail |
| Price | `hotel.pricePerNight.priceCents` + `currency` | `/book` expects fare `priceCents` + `currency`, not hotel nightly rate | Fail |
| Policy summary | No hotel policy summary component exists in this worktree | Not accepted or rendered | Fail |
| Missing/stale/unavailable disclosure | Result card discloses missing price/link; provider handoff says prices can change | Booking review has no hotel-specific disclosure | Fail |

## Desktop verification

Desktop path audited by code trace:
1. Results page renders hotel cards in a responsive grid at desktop: `app/page.tsx:1473`.
2. Selecting the hotel CTA opens `hotel.deeplink` in a new tab: `app/components/HotelCard.tsx:257`.
3. No `/book` navigation is triggered from a hotel card.
4. Directly opening `/book` without flight fare query params lands in the invalid fare recovery state, not a hotel review.

Result: blocked. The requested desktop flow, "select one hotel result and enter booking review," is not available in the current worktree.

## Mobile 375px verification

Mobile path audited by code trace:
1. Hotel cards collapse to one column before `sm`: `app/page.tsx:1473`.
2. The hotel CTA is full-width before `sm`: `app/components/HotelCard.tsx:254`.
3. Selecting the CTA still opens the external provider deeplink in a new tab: `app/components/HotelCard.tsx:257`.
4. `/book` still has only flight fare recovery/review states.

Result: blocked. The same hotel selection path cannot enter booking review at 375px because no hotel booking route exists.

## Back and return-to-results behavior

Browser back from the external provider should return to the same results URL when the provider tab/window allows it, because hotel selection does not mutate local selected state. There is also no silent reselection risk inside `/book` for hotels because the app never enters a hotel booking review.

The remaining risk is product trust: users leave expaify for HotelLook without an in-app hotel review checkpoint, so expaify cannot prove selected hotel identity continuity after handoff.

## Empty, loading, and error states

Hotel loading:
- While search is active, existing hotels remain visible and hotel skeletons render: `app/page.tsx:1437`.

Hotel empty/unavailable:
- Empty and unavailable states use `ResultsStatePanel` and include the current result context: `app/page.tsx:1452`.
- When hotels are skipped or unavailable, the app states why hotels were not included: `app/page.tsx:1399`.

Hotel card missing data:
- Missing photo is disclosed as `Hotel photo unavailable`.
- Missing price or deeplink disables booking and explains the reason.
- No policy summary exists, so missing policy terms are not disclosed as a booking-review field.

## Out-of-scope findings and blockers

- Ticket-listed files `components/hotels/HotelResults.tsx`, `components/hotels/HotelCard.tsx`, `components/hotels/HotelPrice.tsx`, and `components/hotels/HotelPolicySummary.tsx` do not exist in this worktree.
- `lib/booking.ts` does not exist. The actual booking helper is `lib/booking/config.ts`.
- No product code was changed because this is an audit ticket and adding hotel booking review would be new feature work unless separately approved.
