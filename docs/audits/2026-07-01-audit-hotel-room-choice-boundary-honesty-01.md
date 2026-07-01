# AUDIT-HOTEL-ROOM-CHOICE-BOUNDARY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Audit only. No production feature code changed.

## Executive Decision

In-scope hotel search cards mostly respect the current data boundary: they show hotel identity, coarse area, hotel class, optional rating, nightly price, Deal Score, and provider handoff only. They do not show room names, bed type, cancellation policy, occupancy, taxes as included, or room-selection controls.

There is one ticket mismatch: current hotel results do not lead to an expaify booking-review page. `app/book/page.tsx` and `app/book/BookingFlow.tsx` are flight-fare review surfaces only. Hotel card selection opens the provider deeplink directly.

## Files Inspected

- `app/page.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/components/HotelCard.tsx`
- `app/api/search/route.ts`
- `app/deals/[dealId]/page.tsx`
- `lib/types.ts`
- `lib/deals/dealDetail.ts`
- `lib/deals/dealDetailTypes.ts`

Requested files not present in this worktree:

- `components/hotels/HotelCard.tsx`
- `components/hotels/HotelPolicySummary.tsx`
- `components/hotels/HotelPrice.tsx`
- `components/hotels/HotelResults.tsx`

The actual local hotel result card is `app/components/HotelCard.tsx`.

## Current Data Boundary

`HotelOffer` supports only these hotel-level fields: `id`, `name`, `area`, `stars`, `pricePerNight`, optional `rating`, optional `photoUrl`, `deeplink`, and `source` (`lib/types.ts:47` to `lib/types.ts:57`).

No current shared hotel type includes room type, bed type, refundable/cancellation policy, breakfast, occupancy, taxes/fees total, rate-plan ID, room-selection state, or provider policy terms.

## Room-Level Implication Matrix

| Surface copy/field | File reference | Room-level implication? | Supported by current data? | QA decision |
| --- | --- | --- | --- | --- |
| Hotel name | `app/components/HotelCard.tsx:207` to `app/components/HotelCard.tsx:210` | No | Yes, `HotelOffer.name` | Passing. |
| Area/location | `app/components/HotelCard.tsx:212` to `app/components/HotelCard.tsx:218` | No exact address implied | Yes, `HotelOffer.area` | Passing. It is coarse but not presented as address/distance. |
| Hotel class stars | `app/components/HotelCard.tsx:222` to `app/components/HotelCard.tsx:228` | No room-level claim | Yes, `HotelOffer.stars` | Passing. |
| Guest rating | `app/components/HotelCard.tsx:229` to `app/components/HotelCard.tsx:235` | No room-level claim, but trust-sensitive | Only if provider supplied a distinct rating | Existing known risk: type permits it, but HotelLook has previously mapped stars into rating. Not a room-choice issue, but still a hotel trust risk. |
| Nightly rate | `app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:60` | Could be read as rate certainty | Partially. Supported as `pricePerNight`, not final room total | Passing because copy says `per night before taxes and fees` and provider handoff warns prices can change. |
| Provider CTA: `Check with HotelLook` | `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270` | No room selection implied | Yes, `deeplink` | Passing. It says check with provider, not choose/select room. |
| Provider warning: `Prices can change` | `app/components/HotelCard.tsx:269` to `app/components/HotelCard.tsx:271` | No | Yes | Passing. Correctly softens rate certainty. |
| Booking unavailable | `app/components/HotelCard.tsx:275` to `app/components/HotelCard.tsx:284` | No specific room claim | Yes, derived from missing valid price/link | Passing. |
| Hotel empty state | `app/page.tsx:1452` to `app/page.tsx:1471` | No room claim | Yes | Passing. Shows no hotel inventory/status, not room inventory. |
| Hotel skipped/unavailable state | `app/page.tsx:916` to `app/page.tsx:934`, `app/page.tsx:1399` to `app/page.tsx:1403` | No room claim | Yes | Passing. Explains missing destination/dates/provider availability. |
| Booking review page | `app/book/BookingFlow.tsx:81` to `app/book/BookingFlow.tsx:116` | Flight fare only | Not hotel applicable | Ticket mismatch. No hotel booking-review path exists here. |
| Saved deal metadata labels: `Refundable`, `Room type` | `app/deals/[dealId]/page.tsx:31` to `app/deals/[dealId]/page.tsx:54`, `app/deals/[dealId]/page.tsx:238` to `app/deals/[dealId]/page.tsx:250` | Yes | Unknown; arbitrary metadata | Out-of-scope risk. Saved hotel deal detail can render room/policy metadata as facts if the DB row contains those keys. |

## Findings

### P1: Ticket expects hotel booking-review verification, but no hotel booking-review flow exists

Repro/source path:

1. Render hotel results on the search page.
2. Select a hotel CTA from `HotelCard`.
3. The CTA is an external provider link using `href={hotel.deeplink}`, `target="_blank"`, and sponsored/noopener rel (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:260`).
4. No `/book` URL is built for hotels. `/book` parses `BookingFareContext`, which is flight-specific: route, carrier, stops, departure, return, passenger count, price basis, provider, and offer ID (`app/book/BookingFlow.tsx:81` to `app/book/BookingFlow.tsx:116`).

Expected from ticket: manually verify selecting a hotel result and reaching booking review.

Actual: selecting a hotel result reaches the provider site, not expaify booking review.

QA decision: Blocked acceptance item due current product boundary. Do not invent hotel booking review for this audit.

### P2: Saved hotel deal detail can present room/policy metadata as confirmed facts

This is outside the requested inspect-first hotel result/booking flow, but it is a local hotel surface.

Repro/data condition:

1. A saved hotel deal DB row contains metadata keys such as `roomType`, `room_type`, or `refundable`.
2. `metadataEntries()` displays every non-hidden metadata key with no hotel-kind boundary (`app/deals/[dealId]/page.tsx:76` to `app/deals/[dealId]/page.tsx:97`).
3. `formatMetadataLabel()` explicitly labels those keys as `Room type` and `Refundable` (`app/deals/[dealId]/page.tsx:31` to `app/deals/[dealId]/page.tsx:54`).
4. The page renders the value as a fact (`app/deals/[dealId]/page.tsx:238` to `app/deals/[dealId]/page.tsx:250`).

Expected: room type and refundable/cancellation facts should only render when their lineage is explicit and current.

Actual: arbitrary saved metadata can appear as confirmed room/policy fact.

QA decision: Out-of-scope blocker candidate for a separate saved-deal-detail repair. I did not change it because this ticket is scoped to hotel result and booking surfaces.

## Passing Checks

- No room selection UI observed on hotel result cards.
- No room names, bed types, cancellation terms, breakfast, occupancy, or amenities are rendered by `HotelCard`.
- Hotel result price remains visible when room details are absent, and it is explicitly `per night before taxes and fees`.
- Hotel identity remains visible through name and area when room detail is absent.
- Provider handoff is honest: `Check with HotelLook` plus `Opens provider site. Prices can change.`
- Invalid/missing price or deeplink disables booking handoff instead of inventing availability.
- Loading state uses skeletons, not fake hotel names/prices (`app/page.tsx:1437` to `app/page.tsx:1450`).
- Empty and provider-unavailable states render explanatory panels instead of fake hotel inventory (`app/page.tsx:1452` to `app/page.tsx:1471`).
- `/api/search` sends explicit `available`, `empty`, `unavailable`, or `skipped` hotel status events (`app/api/search/route.ts:289` to `app/api/search/route.ts:330`).

## Mobile and Desktop Viewport Notes

No visual overlap issue was found by source review.

- At 375px mobile, hotel results use a one-column grid (`app/page.tsx:1438`, `app/page.tsx:1473`).
- Hotel card price and CTA stack vertically before the `sm` breakpoint (`app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:254`).
- Hotel CTA wrapper is full width on mobile (`app/components/HotelCard.tsx:254` to `app/components/HotelCard.tsx:263`).
- Long hotel names clamp to two lines, area truncates, and hotel class/rating facts wrap (`app/components/HotelCard.tsx:207` to `app/components/HotelCard.tsx:237`).
- On desktop, hotel results use a three-column grid at `lg` (`app/page.tsx:1438`, `app/page.tsx:1473`).

Screenshot capture was not performed because no screenshot-capable browser automation package is installed in this repo; `node_modules/.bin` exposes `next`, `jest`, and `tsc`, but not Playwright.

## Manual Verification Notes

Hotel result selection:

1. Search must include destination, departure date, return date, and round-trip mode for hotels to load (`app/page.tsx:706`; `app/api/search/route.ts:289` to `app/api/search/route.ts:330`).
2. If hotels are returned, selecting the hotel CTA opens the provider deeplink externally (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`).
3. The current app does not route hotel selections to `/book`.

Booking review:

1. `/book` is flight-fare review only.
2. The review summary keeps fare route, carrier, depart/return, stops, passenger count, price basis, provider, and offer ID visible (`app/book/BookingFlow.tsx:81` to `app/book/BookingFlow.tsx:116`).
3. It does not display hotel room selection, hotel cancellation policy, bed type, or hotel rate terms.

## Wording That Should Stay Soft

- Keep `Check with HotelLook`, not `Book room` or `Select room`.
- Keep `Prices can change`, not `Guaranteed rate`.
- Keep `per night before taxes and fees`, not `total stay price`.
- Do not add `Free cancellation`, `Refundable`, `King bed`, `Room selected`, or similar claims unless the hotel contract gains explicit provider-backed fields.

## Verification

- `npx tsc --noEmit --incremental false` - passed with exit code 0 and no output.
- `npx jest --runInBand` - passed: 20 suites passed, 176 tests passed.
- `npm test -- --passWithNoTests` - passed: 20 suites passed, 176 tests passed.

## Required Return Note

- What changed and why: Added this audit report documenting hotel room-choice boundary honesty for AUDIT-HOTEL-ROOM-CHOICE-BOUNDARY-01.
- Files changed: `docs/audits/2026-07-01-audit-hotel-room-choice-boundary-honesty-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npx jest --runInBand` passed with 20 suites and 176 tests; `npm test -- --passWithNoTests` passed with 20 suites and 176 tests.
- Out-of-scope findings or blockers: Requested `components/hotels/*` files are absent; hotel selections do not reach expaify booking review; saved deal detail can render room/policy metadata as facts when arbitrary metadata includes those keys.
