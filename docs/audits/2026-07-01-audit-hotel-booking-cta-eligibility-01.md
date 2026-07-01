# AUDIT-HOTEL-BOOKING-CTA-ELIGIBILITY-01

Date: 2026-07-01  
Role: Senior QA Engineer  
Scope: Hotel booking CTA eligibility, hotel result to booking-review trace, disabled/enabled/loading/error CTA states, mobile/desktop and keyboard reachability.

## Scope Notes

Requested files not present in this worktree:

- `components/hotels/HotelCard.tsx`
- `components/hotels/HotelPolicySummary.tsx`
- `components/hotels/HotelPrice.tsx`
- `components/hotels/HotelResults.tsx`
- `lib/booking.ts`

Current local hotel/booking surfaces inspected instead:

- `app/page.tsx`
- `app/api/search/route.ts`
- `app/api/book/route.ts`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/components/HotelCard.tsx`
- `lib/booking/config.ts`
- `lib/providers/hotellook.ts`
- `lib/types.ts`
- `lib/money.ts`

## Summary

Hotel CTAs do not enter the in-app `/book` review flow. The only hotel result CTA is an outbound provider handoff link labeled `Check with HotelLook` in `app/components/HotelCard.tsx`. The in-app booking flow is flight/Duffel fare-context only.

The visible hotel CTA is gated by valid deeplink and valid integer-cent price. It is not gated by hotel policy data or freshness metadata because those fields do not exist in `HotelOffer`. Therefore the product can honestly hand off a priced HotelLook result to a provider page, but it cannot prove cancellation, refund, room policy, or provider-data freshness at CTA time.

## Hotel CTA State Matrix

| State | Where | Required data conditions | Result |
| --- | --- | --- | --- |
| Search loading | `app/page.tsx:1435` to `app/page.tsx:1451` | Search still streaming. Existing hotel rows may render while additional skeletons show. | Existing rows can show enabled or disabled CTA based on each row; skeletons have no CTA. |
| Hotel provider skipped | `app/api/search/route.ts:325` to `app/api/search/route.ts:330`, `app/page.tsx:1399` to `app/page.tsx:1403` | Missing destination, departure, or return date. | Hotels tab is disabled/unavailable with copy explaining required search data. |
| Hotel provider empty | `app/api/search/route.ts:296` to `app/api/search/route.ts:298`, `app/page.tsx:1452` to `app/page.tsx:1471` | Provider returned usable empty result. | No hotel CTA; empty panel shows edit-search action. |
| Hotel provider unavailable/error | `app/api/search/route.ts:298` to `app/api/search/route.ts:323`, `app/page.tsx:1452` to `app/page.tsx:1471` | Provider returned `Result` error or threw. | No hotel CTA; warning empty panel explains hotel provider unavailable. |
| Hotel card enabled | `app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:184`, `app/components/HotelCard.tsx:255` to `app/components/HotelCard.tsx:271` | `hotel.deeplink` parses as `http` or `https`; `hotel.pricePerNight.priceCents` is a positive integer; `currency` is a three-letter code. | Anchor opens provider in new tab with sponsored/noopener rel and copy `Opens provider site. Prices can change.` |
| Hotel card disabled: missing/invalid price | `app/components/HotelCard.tsx:105` to `app/components/HotelCard.tsx:114`, `app/components/HotelCard.tsx:249` to `app/components/HotelCard.tsx:284` | `isValidMoney(hotel.pricePerNight)` fails. | Non-focusable status displays `Booking unavailable`; reason says no confirmed nightly price was returned. |
| Hotel card disabled: missing/invalid deeplink | `app/components/HotelCard.tsx:171` to `app/components/HotelCard.tsx:184`, `app/components/HotelCard.tsx:273` to `app/components/HotelCard.tsx:284` | Deeplink missing, malformed, or non-http(s). | Non-focusable status displays `Booking unavailable`; reason says no valid booking link was returned. |
| Hotel card disabled: missing both price and deeplink | `app/components/HotelCard.tsx:105` to `app/components/HotelCard.tsx:108` | Invalid money and invalid deeplink. | Non-focusable status displays `Booking unavailable`; reason says no confirmed nightly price or valid booking link was returned. |
| In-app booking review | `app/book/BookingFlow.tsx:81` to `app/book/BookingFlow.tsx:116`, `lib/booking/config.ts:1` to `lib/booking/config.ts:124` | Flight fare context only: offer id, provider, airport route, dates, carrier, stops, price cents, currency, passenger count, price scope. | Not reachable from hotel cards. No hotel identity, room, nightly price, policy, or hotel deeplink is accepted by this booking context. |

## Findings

### P0 - Hotel CTA eligibility cannot verify policy data because hotel policy does not exist in the local contract

Files:

- `lib/types.ts:47` to `lib/types.ts:57`
- `app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:184`
- `app/components/HotelCard.tsx:255` to `app/components/HotelCard.tsx:271`

Repro:

1. Inspect `HotelOffer`.
2. Confirm it includes id, name, area, stars, price, optional rating/photo, deeplink, and source only.
3. Render any hotel with valid price and valid `http(s)` deeplink.
4. Observe `Check with HotelLook` is enabled even though no cancellation, refund, room policy, tax/fee policy, or provider terms field exists.

Trust impact: The current CTA does not claim reservation, cancellation, confirmation, or price lock, and it warns prices can change. That is good. But the ticket asks whether missing policy blocks booking clearly; it does not, because policy is not a representable input. This is acceptable only if the CTA is treated as provider handoff, not booking.

### P0 - Hotel CTA eligibility cannot verify stale provider data at card level

Files:

- `lib/types.ts:47` to `lib/types.ts:57`
- `lib/providers/hotellook.ts:67` to `lib/providers/hotellook.ts:72`
- `lib/providers/hotellook.ts:118`
- `app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:184`

Repro:

1. Inspect `HotelOffer`; there is no `fetchedAt`, `expiresAt`, or cache-age field.
2. Inspect `HotellookProvider`; cached rows are returned directly when present.
3. Render a hotel card from cached provider data with valid price and deeplink.
4. Observe the CTA is enabled without any visible freshness check beyond provider-cache behavior.

Trust impact: Provider caching target is six hours and the adapter sets `CACHE_TTL = 21600`, but that freshness is not carried to the UI. Missing or stale provider data cannot block an individual hotel CTA clearly because the card cannot inspect age or provider availability status after data arrives.

### P1 - Enabled hotel CTA does not verify non-empty hotel identity beyond adapter filtering

Files:

- `lib/providers/hotellook.ts:92` to `lib/providers/hotellook.ts:115`
- `app/components/HotelCard.tsx:207` to `app/components/HotelCard.tsx:218`
- `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:268`

Repro:

1. Provide a HotelLook row with `hotelId > 0`, `hotelName: ''`, and valid `priceFrom`.
2. Adapter only checks `typeof entry.hotelName === 'string'`, so a blank string can become `hotel.name`.
3. Card can still enable the provider CTA if deeplink and price are valid.

Trust impact: Live provider path requires a numeric hotel id and string name, but not non-empty name. The CTA aria-label also uses the blank hotel name. Cached rows have the same risk because cache hits bypass revalidation.

### P1 - Missing price rows are filtered before UI, so unavailable-price CTA copy is not fully exercised by live provider behavior

Files:

- `lib/providers/hotellook.ts:96` to `lib/providers/hotellook.ts:101`
- `app/components/HotelCard.tsx:249` to `app/components/HotelCard.tsx:284`

Repro:

1. HotelLook returns a row with valid identity but missing/invalid `priceFrom`.
2. Adapter drops the row with `if (priceCents === null) return []`.
3. User sees no card for that hotel, not a disabled hotel card explaining that the hotel lacks a confirmed nightly price.

Trust impact: The card has correct disabled UI for missing price, but provider behavior usually removes those hotels before the user can see why a specific hotel is unavailable. Acceptance criteria asked to identify whether missing price blocks booking clearly; at result-list level, missing price blocks booking silently by omission unless malformed cached data reaches the card.

### P1 - Missing deeplink blocks CTA clearly only at card level; adapter always builds a deeplink for valid live rows

Files:

- `lib/providers/hotellook.ts:55` to `lib/providers/hotellook.ts:57`
- `app/components/HotelCard.tsx:171` to `app/components/HotelCard.tsx:184`
- `app/components/HotelCard.tsx:273` to `app/components/HotelCard.tsx:284`

Repro:

1. Render `HotelCard` with invalid or blank `hotel.deeplink`.
2. Observe disabled `Booking unavailable` status and reason `No valid booking link was returned.`
3. Inspect live adapter: for every valid hotel id, it builds a HotelLook affiliate deeplink.

Trust impact: The UI is prepared for missing handoff data and blocks clearly. Live HotelLook rows should always have handoff data if `HOTEL_AFFILIATE_ID` exists, because adapter-level configuration failure returns provider unavailable before cards render.

### P2 - Disabled hotel CTA is a non-focusable status, so keyboard users cannot land on the unavailable action itself

Files:

- `app/components/HotelCard.tsx:273` to `app/components/HotelCard.tsx:284`

Repro:

1. Render a disabled hotel card with invalid price or deeplink.
2. Tab through the hotel card.
3. Focus skips the `Booking unavailable` status because it is a `span`, not an interactive disabled button.

Trust impact: This avoids a dead-end disabled control in the tab order. The status has an accessible label for screen readers, but keyboard-only sighted users will not focus the unavailable reason. This is acceptable if unavailable status is intended as static information, not an action.

## CTA Copy Review

Passing:

- Enabled hotel CTA says `Check with HotelLook`, not `Book`, `Reserve`, `Confirm`, `Cancel`, or `Lock price` (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`).
- Supporting copy says `Opens provider site. Prices can change.` (`app/components/HotelCard.tsx:269` to `app/components/HotelCard.tsx:271`).
- Hotel price copy says `per night before taxes and fees` (`app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:59`).

Not proven:

- No cancellation/refund/room policy summary exists in this worktree.
- No provider freshness timestamp exists in `HotelOffer`.
- No hotel can proceed to in-app booking review.

## Result-to-Booking Trace

1. `/api/search` calls `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })` only when destination, departure, and return are present (`app/api/search/route.ts:289` to `app/api/search/route.ts:295`).
2. `HotellookProvider` requires `TP_TOKEN` and an affiliate marker before returning hotels (`lib/providers/hotellook.ts:63` to `lib/providers/hotellook.ts:65`).
3. Provider maps valid rows into `HotelOffer` with id, name, area, stars, `Money`, deeplink, optional photo, and source (`lib/providers/hotellook.ts:92` to `lib/providers/hotellook.ts:115`).
4. Page streams hotel rows into state and renders `HotelCard` (`app/page.tsx:763` to `app/page.tsx:767`, `app/page.tsx:1473` to `app/page.tsx:1483`).
5. `HotelCard` enables outbound handoff only when valid price and valid deeplink exist (`app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:184`).
6. `/book` parses only `BookingFareContext` for flight fare details (`lib/booking/config.ts:7` to `lib/booking/config.ts:124`), and `BookingFlow` labels the summary as `Fare review` with origin/destination/carrier/stops/passengers/provider (`app/book/BookingFlow.tsx:81` to `app/book/BookingFlow.tsx:116`).
7. No hotel result card builds a `/book` link. No hotel identity, room price, hotel policy, or hotel handoff data is accepted by `/book`.

## Manual Verification Flow

1. Start the app and search a valid round trip with destination and return date, for example `JFK` to `LAX`, one passenger, future dates.
2. While search is loading, switch to Hotels if available. Expected: skeletons render; any already streamed hotel cards keep their own CTA state.
3. Select a bookable hotel. Expected: enabled CTA label is `Check with HotelLook`; it opens a provider URL in a new tab; copy says prices can change.
4. Attempt booking review from the hotel. Expected: there is no in-app hotel booking review path; the CTA is outbound only.
5. Test unavailable hotel handoff with a fixture or mocked cached row where `deeplink` is blank or invalid. Expected: CTA becomes `Booking unavailable` with reason `No valid booking link was returned.`
6. Test unavailable hotel price with a fixture or mocked cached row where `pricePerNight.priceCents` is `0`, non-integer, or currency invalid. Expected: price displays `Price unavailable`, CTA becomes `Booking unavailable`, and reason says no confirmed nightly price was returned.
7. Test missing policy. Expected: cannot be fully verified with current fixtures because no hotel policy field or hotel policy component exists.
8. Test stale provider data. Expected: cannot be fully verified at UI level because `HotelOffer` has no freshness field; only provider cache TTL can be inspected.
9. At 375px mobile, inspect hotel results. Expected: grid is one column; price and CTA stack; enabled CTA spans the card width; no primary action is hidden (`app/page.tsx:1473`, `app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:263`).
10. At desktop, inspect hotel results. Expected: grid reaches three columns at `lg`; CTA and price sit side by side from `sm` upward (`app/page.tsx:1473`, `app/components/HotelCard.tsx:248`).
11. Keyboard focus: tab through hotel cards. Expected: enabled hotel CTA is reachable as an anchor; disabled status is not focusable; the reason remains visible next to the status.

## Verification

Commands run:

- `npm run typecheck` - failed: missing npm script `typecheck`.
- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand` - passed: 20 suites, 176 tests.
- `npm test -- --passWithNoTests` - passed: 20 suites, 176 tests.

## Out of Scope

- No checkout system added.
- No fake hotel confirmations added.
- No affiliate provider contract changes.
- No hotel policy data invented.
- No product code changed.
