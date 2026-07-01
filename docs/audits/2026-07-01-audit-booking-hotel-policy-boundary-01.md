# AUDIT-BOOKING-HOTEL-POLICY-BOUNDARY-01: Hotel Booking Policy Boundary

## Verdict

Blocked as a hotel booking-review audit: this worktree does not contain a hotel booking review surface. Hotel results hand off directly from the result card to the provider deeplink, while `/book` is a Duffel flight order path.

The existing hotel result card is mostly honest about price and handoff boundaries, but it does not disclose cancellation policy availability at all. Because the app has no hotel review step and `HotelOffer` has no policy fields, cancellation, supplier terms, confirmation, and total-fee boundaries cannot be verified beyond the direct handoff copy.

## Scope Mismatch

Requested files not present in this worktree:

- `components/hotels/HotelCard.tsx`
- `components/hotels/HotelPolicySummary.tsx`
- `components/hotels/HotelPrice.tsx`
- `lib/booking.ts`

Actual local surfaces inspected:

- `app/components/HotelCard.tsx`
- `app/page.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/book/route.ts`
- `lib/booking/config.ts`
- `lib/providers/hotellook.ts`
- `lib/types.ts`

## Findings

### P1: No hotel booking review surface exists

Hotel results render `HotelCard` directly in the results grid at `app/page.tsx:1435` to `app/page.tsx:1483`. The hotel primary action is an external anchor to `hotel.deeplink` at `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`.

There is no route from a hotel result into `/book`, no hotel booking context parser, and no hotel review component. `/book` metadata is "Book flight" at `app/book/page.tsx:5`, `BookingFlow` renders "Fare review" and flight route facts at `app/book/BookingFlow.tsx:81` to `app/book/BookingFlow.tsx:116`, and `/api/book` only accepts valid Duffel fare context at `app/api/book/route.ts:60` to `app/api/book/route.ts:63`.

Repro:

1. Search a round trip with origin, destination, departure date, and return date.
2. Open the Hotels tab.
3. On a valid hotel card, click "Check with HotelLook."
4. Observe the app opens the provider site in a new tab instead of an Expaify hotel booking review.

Impact: The assigned goal cannot be fully satisfied locally because there is no hotel review screen where cancellation, taxes/fees, supplier handoff, and confirmation boundaries can be reviewed before handoff.

### P1: Cancellation and supplier policy data are not modeled or disclosed

`HotelOffer` only contains id, name, area, stars, nightly price, optional rating/photo, deeplink, and source at `lib/types.ts:47` to `lib/types.ts:57`. It has no cancellation policy, refundability, resort fee, tax total, room type, supplier terms URL, provider confirmation boundary, or policy-unavailable fields.

`HotelCard` discloses "per night before taxes and fees" at `app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:60`, and it discloses "Opens provider site. Prices can change." at `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`. It does not say cancellation policy is unavailable, unknown, or provider-controlled.

Repro:

1. Render any hotel with a valid `pricePerNight` and `deeplink`.
2. Review the visible hotel result card.
3. Observe no cancellation/refundability/supplier policy state appears.

Impact: Missing policy data is omitted rather than guessed, which avoids fake reassurance, but users are not plainly told cancellation policy is unavailable in Expaify before provider handoff.

### P2: Hotel CTA avoids completed-booking language, but the disabled state says "Booking unavailable"

For valid hotel offers, the CTA says "Check with HotelLook" and the subcopy says "Opens provider site. Prices can change." at `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`. This does not imply an on-site completed reservation.

For invalid hotel price or deeplink, the disabled state says "Booking unavailable" at `app/components/HotelCard.tsx:275` to `app/components/HotelCard.tsx:283`. That is acceptable as an unavailable action state, but it is slightly broader than the actual failure, which may be only a missing nightly price or missing provider link.

Existing tests assert the honest unavailable copy at `app/components/__tests__/scorePresentation.test.tsx:205` to `app/components/__tests__/scorePresentation.test.tsx:218`.

### P2: Result-card policy language cannot be compared to booking-review policy language

Result-card hotel language:

- Price: "per night before taxes and fees" at `app/components/HotelCard.tsx:59`.
- Handoff: "Check with HotelLook" and "Opens provider site. Prices can change." at `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`.
- Missing price/link: explicit unavailable reasons at `app/components/HotelCard.tsx:105` to `app/components/HotelCard.tsx:115` and `app/components/HotelCard.tsx:273` to `app/components/HotelCard.tsx:284`.

Booking-review language:

- Not applicable for hotels in this worktree. `BookingFlow` is flight-specific and describes airline orders, traveler details, and Duffel sandbox/live booking at `app/book/BookingFlow.tsx:189` to `app/book/BookingFlow.tsx:475`.

Impact: There is no mismatch in rendered hotel result versus hotel booking review copy because the second surface does not exist. The mismatch is between the ticket expectation and the current repo.

## State Review

Loading:

- Hotel results show skeleton cards while searching at `app/page.tsx:1437` to `app/page.tsx:1450`.
- Hotel card score loading uses a neutral shimmer block at `app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`.

Empty and unavailable:

- Skipped/unavailable/empty hotel states are selected at `app/page.tsx:917` to `app/page.tsx:934`.
- The results panel renders a coherent empty/unavailable state with edit-search action at `app/page.tsx:1452` to `app/page.tsx:1471`.
- API hotel failures are disclosed as no confirmed hotel inventory, malformed provider response, timeout, or provider unavailable at `app/api/search/route.ts:289` to `app/api/search/route.ts:331`.

Mobile 375px and desktop:

- Source review shows the hotel grid is one column by default and expands at `sm`/`lg` at `app/page.tsx:1437` and `app/page.tsx:1473`.
- Hotel card price and CTA stack on mobile and become side-by-side at `sm` at `app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:254`.
- The CTA is full width on mobile through `btn-primary-responsive` at `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:264`.
- I did not perform screenshot-level visual verification in this audit; no local browser tooling was available in the task requirements.

## Manual Verification Flow

Source-level hotel result to handoff readiness flow:

1. `/api/search` calls `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })` only when a destination, departure date, and return date exist at `app/api/search/route.ts:289` to `app/api/search/route.ts:331`.
2. `HotellookProvider` requires `TP_TOKEN` and `HOTEL_AFFILIATE_ID` or fallback marker before returning hotel results at `lib/providers/hotellook.ts:46` to `lib/providers/hotellook.ts:66`.
3. The provider builds a HotelLook affiliate deeplink with the marker at `lib/providers/hotellook.ts:55` to `lib/providers/hotellook.ts:56`.
4. The app streams hotel data into results and renders `HotelCard` at `app/page.tsx:1435` to `app/page.tsx:1483`.
5. If `pricePerNight` is valid and the deeplink is HTTP(S), the card renders "Check with HotelLook" as an external link and tells the user the provider site opens and prices can change at `app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:270`.
6. If price or link data is unavailable, the card disables the handoff and says the missing nightly price or valid booking link was not returned at `app/components/HotelCard.tsx:105` to `app/components/HotelCard.tsx:115` and `app/components/HotelCard.tsx:273` to `app/components/HotelCard.tsx:284`.

## Acceptance Criteria Check

- Exact unclear or overconfident hotel policy/handoff copy: no overconfident cancellation or confirmation copy found; missing cancellation disclosure is the main gap. Handoff copy is clear but minimal.
- Manual verification flow: included above.
- Missing policy data represented as unavailable/unknown: price/link are represented as unavailable; cancellation/supplier policy data are not represented at all.
- Final booking action avoids implying on-site completed reservation: yes for hotels. "Check with HotelLook" does not imply a completed booking.
- Result-card versus booking-review mismatch: cannot compare because no hotel booking-review surface exists.

## Out-of-Scope Notes

- I did not alter copy, UI, provider adapters, booking routes, or affiliate link generation.
- Flight `/book` has confirmation language such as "Booking confirmed" and "Order confirmed" at `app/book/BookingFlow.tsx:311` to `app/book/BookingFlow.tsx:327`, but flight booking review is out of scope except as evidence that `/book` is not hotel-specific.

## Return Note

- What changed and why: Added this audit report to document the hotel policy boundary findings and the scope mismatch.
- Files changed: `docs/audits/2026-07-01-audit-booking-hotel-policy-boundary-01.md`.
- Verification commands and results: `npm run tsc` failed because `package.json` has no `tsc` script; `npx tsc --noEmit --incremental false` passed; `npm run test -- --runInBand` passed with 20 suites and 176 tests; `npm test -- --passWithNoTests` passed with 20 suites and 176 tests.
- Out-of-scope findings or blockers: Hotel booking review is absent in this worktree; requested `components/hotels/*` and `lib/booking.ts` files are absent.
