# AUDIT-HOTEL-RESULTS-DETAIL-TO-BOOKING-FIELD-PARITY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Hotel result card facts compared with booking review facts.

## Executive finding

The requested hotel detail-to-booking parity flow does not exist in this worktree.

Hotel result cards use an external HotelLook deeplink CTA and never build an internal `/book` review link. The `/book` page only accepts `BookingFareContext` for flights and rejects or ignores hotel-shaped context. As a result, there is no valid hotel card to booking review handoff to verify for parity.

This is a P0 product trust blocker if the intended user journey is hotel result -> expaify booking review. The smallest repair path is not to add new hotel detail fields; it is to align the existing flow contract by either:

1. Keeping hotels provider-handoff only and updating ticket/product expectations so no hotel booking review is promised, or
2. Adding a narrow hotel booking-review context that carries only existing `HotelOffer` and search criteria fields, with unavailable labels for missing policies, rooms, guests, and total price basis.

## Inspected local surfaces

- `app/page.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/components/HotelCard.tsx`
- `lib/booking/config.ts`
- `lib/types.ts`

Requested but absent from this worktree:

- `components/hotels/HotelCard.tsx`
- `components/hotels/HotelPolicySummary.tsx`
- `components/hotels/HotelPrice.tsx`
- `components/hotels/HotelResults.tsx`
- `lib/booking.ts`

## Field parity table

| Hotel result card fact | Source | Card presentation | Booking review presentation | Parity result |
| --- | --- | --- | --- | --- |
| Hotel name | `HotelOffer.name` | Rendered as card title. | Not accepted by `BookingFareContext`; not shown on `/book`. | Dropped. |
| Location / area | `HotelOffer.area` | Rendered under name when present. | Not accepted by `BookingFareContext`; not shown on `/book`. | Dropped. |
| Check-in date | Search criteria `depart` | Not displayed on hotel card. | `/book` displays flight `Depart` only when flight context exists. | Unavailable on card and booking; not honestly labeled for hotels. |
| Check-out date | Search criteria `returnDate` | Not displayed on hotel card. | `/book` displays flight `Return` only when flight context exists. | Unavailable on card and booking; not honestly labeled for hotels. |
| Guests | Search criteria `passengers` | Not displayed on hotel card as hotel guests. | `/book` displays flight `Passengers` only when flight context exists. | Relabeled/ambiguous if forced through `/book`; no hotel parity. |
| Rooms | No field in `HotelOffer` or search criteria. | Not displayed. | Not displayed. | Missing and not marked unavailable. |
| Price amount | `HotelOffer.pricePerNight.priceCents` / `currency` | Displayed as formatted money when valid. | `/book` accepts `priceCents` / `currency` for flight fare only. Hotel cards do not pass it to `/book`. | Dropped from expaify booking review. |
| Price basis | Card copy | "Nightly rate" and "per night before taxes and fees." | `/book` uses flight basis: "per person" or "total for N adults." | Basis changes if forced through booking; no hotel-safe label exists. |
| Currency | `HotelOffer.pricePerNight.currency` | Included inside formatted price. | Flight booking summary formats `currency`. Hotel cards do not pass it. | Dropped from hotel handoff. |
| Taxes and fees | Card copy | "before taxes and fees." | No hotel review. Flight review has no hotel tax/fee disclaimer. | Dropped. |
| Policies | No field in `HotelOffer`. | Not displayed. | Not displayed. | Missing and not marked unavailable. |
| Provider identity | `HotelOffer.source`, CTA hardcoded text | CTA says "Check with HotelLook"; `source` itself is not rendered as a fact. | Flight booking review renders `Provider` from fare context. Hotel cards do not pass provider to `/book`. | Partially shown on card CTA; dropped from booking review. |
| Provider handoff URL | `HotelOffer.deeplink` | External link when URL and price are valid. | Not used by `/book`; `/book` has no hotel external handoff summary. | Preserved only by leaving expaify, not by booking review. |
| Hotel class | `HotelOffer.stars` | Rendered as star row with accessible label. | Not accepted by booking context; not shown. | Dropped. |
| Guest rating | `HotelOffer.rating` | Rendered when positive. | Not accepted by booking context; not shown. | Dropped. |
| Photo availability | `HotelOffer.photoUrl` | Image or "Hotel photo unavailable." | Not accepted by booking context; not shown. | Dropped. |
| Deal Score context | `DealScore` | Rendered on card when available/loading. | Not accepted by booking context; not shown. | Dropped. |

## Findings

### P0: Hotel booking review parity cannot be verified because hotel cards never enter booking review

`app/components/HotelCard.tsx` renders the primary hotel CTA as an external `href={hotel.deeplink}` with `target="_blank"` and `rel="noopener noreferrer sponsored"`. It does not build or navigate to `/book`.

`app/book/page.tsx` calls `parseBookingFareContext`, and `app/book/BookingFlow.tsx` renders only flight fare labels: route, carrier, stops, passenger count, and fare basis.

Repro:

1. Search a round trip with origin, destination, depart, and return dates.
2. Open the Hotels tab after hotel results load.
3. Select a hotel CTA.
4. Observe that the CTA opens HotelLook/provider externally, not expaify booking review.
5. Open `/book` directly without flight fare query params.
6. Observe "We can't identify this fare" rather than a hotel review page.

Impact: The ticket goal cannot pass because there is no local hotel card -> booking review handoff.

### P0: If hotel data is forced into `/book`, the page changes hotel meaning into flight meaning

`BookingFareContext` requires `origin`, `destination`, `carrier`, `stops`, `priceScope`, and flight dates. Hotel facts such as hotel name, area, stars, rating, nightly basis, policies, rooms, and provider deeplink are not accepted.

Impact: Any improvised hotel use of `/book` would relabel hotel data as fare/route/carrier facts and create false confidence.

### P1: Missing policy, room, and stay details are not honestly labeled unavailable

`HotelOffer` does not include policy, room count, room type, check-in, check-out, tax/fee total, or guest-room occupancy. The hotel card is honest about missing price/deeplink/photo, but it does not state that policies, rooms, or stay details are unavailable.

Impact: If expaify introduces hotel booking review, these fields must either be carried from existing criteria or plainly labeled unavailable. They should not be inferred.

### P1: Provider identity is shown as CTA copy, not a structured review fact

Hotel cards use "Check with HotelLook" and an external deeplink. They do not render `hotel.source` as a durable field. The booking review has a structured `Provider` fact only for flight fares.

Impact: Provider provenance is weaker for hotels than for flight booking review.

## State review

Loading:

- Hotel results render card skeletons while searching.
- Hotel score loading renders an in-card shimmer.
- Booking loading state exists only for flight fare review and says "Preparing the selected fare."

Empty:

- Hotels tab can show "No hotel inventory found", "Hotels unavailable", or "Hotel dates needed" with search context.
- Empty hotel state does not lead to booking review.

Error/unavailable:

- Hotel card blocks CTA when price or deeplink is invalid and gives a specific unavailable reason.
- `/book` invalid state is flight-specific: "We can't identify this fare."

Mobile 375px and desktop:

- Hotel results use one column on mobile and 2-3 columns on wider screens.
- Hotel card CTA is full width on mobile.
- Booking review uses one column on mobile and a two-column layout on desktop, but only for flight fare context.

## Manual verification flow

Flow attempted: hotel search result -> booking review -> back.

Result: Blocked by product flow.

Steps:

1. From search, use a round trip with destination and return date so hotels are eligible.
2. Open Hotels tab.
3. On a valid hotel card, select "Check with HotelLook."
4. User leaves expaify to the provider in a new tab.
5. Return via browser tab/back to expaify search results.
6. There is no expaify hotel booking review page to inspect.

Direct `/book` verification:

1. Open `/book` without flight fare context, or with hotel-like params.
2. Booking review shows invalid flight fare state, not hotel review.

## Smallest repair path

Do not add amenities, maps, room selection, loyalty, fake policies, fake imagery, or provider adapter fields.

Recommended narrow path:

1. Decide the product contract:
   - If hotels are provider-handoff only, update booking copy and tickets so hotel parity is defined as card -> provider handoff, not card -> `/book`.
   - If hotel review is required, create a separate hotel review context instead of reusing `BookingFareContext`.
2. Carry only existing facts:
   - `id`, `name`, `area`, `pricePerNight`, `source`, `deeplink`, selected `depart` as check-in, selected `returnDate` as check-out, and `passengers` as guests if that is the current search contract.
3. Mark unavailable facts plainly:
   - rooms unavailable, policies unavailable, total stay price unavailable, taxes/fees unavailable.
4. Keep HotelLook/provider handoff explicit:
   - preserve external CTA and affiliate deeplink; do not imply expaify can complete hotel booking.

## Verification

- `npm run tsc`: failed because this repo has no `tsc` script.
- `npx tsc --noEmit --incremental false`: passed.
- `npm test -- --runInBand`: passed, 20 suites / 176 tests.

## Blockers and out-of-scope findings

Blockers:

- Requested hotel component paths do not exist in this worktree.
- `lib/booking.ts` does not exist; booking config is under `lib/booking/config.ts`.
- No internal hotel booking review exists to verify.

Out of scope:

- Provider adapter changes.
- New hotel detail features.
- Room selection, loyalty, maps, fake amenities, fake policies, fake imagery, or fake prices.
- Deal Score math changes.
