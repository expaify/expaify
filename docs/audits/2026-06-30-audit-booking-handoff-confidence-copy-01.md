# AUDIT-BOOKING-HANDOFF-CONFIDENCE-COPY-01

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Audit only. No product code changed.

## Decision

Not ready for paid-user booking handoff confidence.

Flight and hotel cards now avoid the worst "book now" language in the current code, and both cards disclose that provider prices can change. The remaining trust issues are copy/destination mismatches: affiliate language is not visible next to the hotel handoff, Travelpayouts-labeled CTAs actually open Aviasales affiliate URLs, and Duffel booking copy can say "paused" on the result card while the destination page can collect traveler details when `BOOKING_ENABLED=true`.

## Files Inspected

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/book/route.ts`
- `app/api/search/route.ts`
- `lib/booking/config.ts`
- `lib/providers/travelpayouts.ts`
- `lib/providers/duffel.ts`
- `lib/providers/hotellook.ts`
- `lib/providers/amadeus.ts`
- `lib/providers/kiwi.ts`
- `lib/types.ts`

Requested ticket paths not present in this worktree:

- `components/FlightResultCard.tsx`
- `components/HotelCard.tsx`
- `components/BookingReview.tsx`
- `components/BookingForm.tsx`
- `components/ExternalHandoffNotice.tsx`

Current equivalent surfaces are `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, and `app/book/BookingFlow.tsx`.

## Manual Verification Flow

Live browser verification was blocked by the sandbox: `npm run dev -- --hostname 127.0.0.1 --port 3007` failed with `listen EPERM`. I verified the handoff flow from source and existing render coverage:

1. Search page streams flight and hotel provider data from `/api/search` (`app/api/search/route.ts:188` to `app/api/search/route.ts:273`).
2. Flight results render through `FlightResults` and `FlightCard` (`components/flights/FlightResults.tsx:323` to `components/flights/FlightResults.tsx:335`).
3. A Travelpayouts flight card displays `Check with travelpayouts`, then opens the provider deeplink in a new tab with sponsored rel (`app/components/FlightCard.tsx:244` to `app/components/FlightCard.tsx:257`, `app/components/FlightCard.tsx:352` to `app/components/FlightCard.tsx:379`).
4. A Duffel flight card displays `Review paused booking` for internal `/book` links (`app/components/FlightCard.tsx:241` to `app/components/FlightCard.tsx:257`), then `/book` parses fare context from URL params (`app/book/page.tsx:11` to `app/book/page.tsx:40`).
5. Hotel results render through `HotelCard`; the handoff opens `hotel.deeplink` in a new tab (`app/components/HotelCard.tsx:255` to `app/components/HotelCard.tsx:271`).

Existing tests also cover key visible copy:

- Flight external handoff copy: `Check with travelpayouts` and `Opens provider search. Price and availability can change.` (`app/components/__tests__/scorePresentation.test.tsx:193` to `app/components/__tests__/scorePresentation.test.tsx:203`).
- Hotel handoff copy: `Check with HotelLook` and `Opens provider site. Prices can change.` (`app/components/__tests__/scorePresentation.test.tsx:115` to `app/components/__tests__/scorePresentation.test.tsx:140`).
- Missing booking context blocks confirmation (`app/book/__tests__/BookingFlow.test.tsx:60` to `app/book/__tests__/BookingFlow.test.tsx:74`).
- Booking-disabled API returns a clean disabled response (`app/api/book/__tests__/route.test.ts:27` to `app/api/book/__tests__/route.test.ts:42`).

## Findings

### P1 - Hotel affiliate handoff disclosure is not visible at the point of exit

Evidence:

- Hotel active CTA says `Check with HotelLook` and the adjacent note says only `Opens provider site. Prices can change.` (`app/components/HotelCard.tsx:255` to `app/components/HotelCard.tsx:271`).
- HotelLook deeplinks are affiliate/tracking URLs with `marker=` (`lib/providers/hotellook.ts:50` to `lib/providers/hotellook.ts:55`).
- Footer-level disclosure says outbound links may include affiliate markers (`app/page.tsx:321` to `app/page.tsx:325`), but that copy is not adjacent to the hotel CTA and can be missed before the user leaves.

Repro:

1. Search a round trip that returns hotel offers.
2. Open the Hotels tab.
3. Inspect the CTA area on a hotel card before clicking `Check with HotelLook`.

Actual: The card discloses provider exit and price-change risk, but not affiliate/partner tracking at the point of action.

Expected: Affiliate or sponsored handoff language should be visible next to every outbound affiliate CTA before the user leaves expaify.

### P1 - Travelpayouts flight CTA names the data adapter, not the user-facing destination

Evidence:

- External flight CTA label is generated as `Check with ${fare.source}` (`app/components/FlightCard.tsx:244` to `app/components/FlightCard.tsx:257`).
- Travelpayouts fares set `source: 'travelpayouts'` (`lib/providers/travelpayouts.ts:193` to `lib/providers/travelpayouts.ts:195`, `lib/providers/travelpayouts.ts:245` to `lib/providers/travelpayouts.ts:247`, `lib/providers/travelpayouts.ts:295` to `lib/providers/travelpayouts.ts:297`).
- The actual handoff URL is `https://www.aviasales.com/search/...?...marker=...` (`lib/providers/travelpayouts.ts:78` to `lib/providers/travelpayouts.ts:82`).

Repro:

1. Render or search a Travelpayouts-backed fare.
2. Inspect the flight card CTA and destination.

Actual: UI says `Check with travelpayouts`; click destination is Aviasales with an affiliate marker.

Expected: The visible destination/provider expectation should match the site the user is opening, or the copy should say it opens an affiliate/provider search without naming the wrong user-facing site.

### P1 - Duffel result-card copy can conflict with enabled booking behavior

Evidence:

- Duffel internal links are identified as `/book` links (`app/components/FlightCard.tsx:241` to `app/components/FlightCard.tsx:242`).
- The card always labels internal booking links `Review paused booking` and says `In-app booking is paused. Review only.` (`app/components/FlightCard.tsx:244` to `app/components/FlightCard.tsx:257`).
- Booking enablement is environment-driven (`lib/booking/config.ts:23` to `lib/booking/config.ts:30`).
- When enabled, `BookingFlow` can show traveler fields and a submit CTA of `Confirm sandbox booking` or `Confirm booking` (`app/book/BookingFlow.tsx:386` to `app/book/BookingFlow.tsx:467`).

Repro:

1. Set `BOOKING_ENABLED=true`.
2. Search a Duffel-backed fare.
3. Compare the result-card CTA copy with the `/book` destination page.

Actual: The card says booking is paused, while the destination can collect details and submit a booking request.

Expected: Result-card CTA and destination page should agree on whether the flow is review-only, sandbox-only, or capable of creating an order.

### P1 - Success copy can overstate finality after provider reference return

Evidence:

- Success page title is `Booking confirmed` (`app/book/BookingFlow.tsx:313` to `app/book/BookingFlow.tsx:316`).
- Success status title is `Order confirmed` and message says only that the provider returned a booking reference (`app/book/BookingFlow.tsx:320` to `app/book/BookingFlow.tsx:324`).
- `/api/book` returns `ok: true`, `bookingReference`, and `orderId` after Duffel order creation (`app/api/book/route.ts:208` to `app/api/book/route.ts:213`).

Repro:

1. Use an enabled Duffel booking environment that returns a booking reference.
2. Submit the booking form.
3. Inspect the success state.

Actual: The page uses final confirmation language even though visible copy does not show ticketing status, provider policy terms, payment receipt details, baggage/refund context, or airline confirmation detail.

Expected: Success copy should match available proof, such as provider reference returned, unless the product can show complete confirmation details.

### P2 - Non-sandbox booking review copy hides unavailable policy conditions until after commitment

Evidence:

- Non-sandbox review message says `Confirm the fare details before expaify sends traveler information to the provider.` (`app/book/BookingFlow.tsx:386` to `app/book/BookingFlow.tsx:390`).
- Booking status says `Review fare context before creating the order.` (`app/book/BookingFlow.tsx:399` to `app/book/BookingFlow.tsx:403`).
- CTA says `Confirm booking` (`app/book/BookingFlow.tsx:460` to `app/book/BookingFlow.tsx:467`).
- Available fare context includes route, carrier, dates, provider, passengers, price, and price basis, but no baggage, refund, cancellation, seat, ticketing, tax/fee, or provider support policy fields (`lib/booking/config.ts:3` to `lib/booking/config.ts:16`).

Actual: The user is asked to confirm booking/order creation without visible copy that these policy details are unavailable in expaify.

Expected: Before a live booking handoff, the page should state which final conditions must still be verified with the provider. This audit does not propose legal copy; it flags the missing disclosure.

## Passing Checks

- Flight external CTA warns that provider search opens and price/availability can change (`app/components/FlightCard.tsx:251` to `app/components/FlightCard.tsx:257`, `app/components/FlightCard.tsx:352` to `app/components/FlightCard.tsx:379`).
- Flight unavailable states disable the action for missing price or unsafe/missing deeplink (`app/components/FlightCard.tsx:243` to `app/components/FlightCard.tsx:257`, `app/components/FlightCard.tsx:370` to `app/components/FlightCard.tsx:379`).
- Hotel card shows `per night before taxes and fees` next to nightly rate (`app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:60`).
- Hotel unavailable states explain missing price/link and disable booking (`app/components/HotelCard.tsx:105` to `app/components/HotelCard.tsx:115`, `app/components/HotelCard.tsx:273` to `app/components/HotelCard.tsx:285`).
- Hotel provider unavailable, empty, and skipped states are explicit in `/api/search` (`app/api/search/route.ts:246` to `app/api/search/route.ts:270`) and the results page (`app/page.tsx:1399` to `app/page.tsx:1469`).
- Booking-disabled state is explicit and does not collect passenger or payment details (`app/book/BookingFlow.tsx:338` to `app/book/BookingFlow.tsx:347`).
- Missing `/book` fare context blocks confirmation and tells the user no passenger details, payment details, or provider order can be submitted (`app/book/BookingFlow.tsx:224` to `app/book/BookingFlow.tsx:264`).

## Visual Self-Review

Source-level review only; live screenshot capture was blocked by server bind permissions.

- Hierarchy: Flight and hotel CTAs are primary and visually reachable after price/details. Booking review uses a clear left summary/right form layout on desktop and stacks below `lg` (`app/book/BookingFlow.tsx:166` to `app/book/BookingFlow.tsx:184`).
- Contrast: Handoff and warning copy uses theme tokens; no source-level evidence of invisible text was found.
- Spacing/mobile fit: Flight cards and hotel cards use single-column grids on mobile and expand at `sm`/`lg` (`components/flights/FlightResults.tsx:304` to `components/flights/FlightResults.tsx:335`; `app/page.tsx:1435` to `app/page.tsx:1482`). Booking submit is sticky on mobile (`app/book/BookingFlow.tsx:460` to `app/book/BookingFlow.tsx:471`).
- Focus states: Flight external CTA includes `focus-visible` outline (`app/components/FlightCard.tsx:359` to `app/components/FlightCard.tsx:363`). Booking back link and secondary button classes include focus styling (`app/book/BookingFlow.tsx:15` to `app/book/BookingFlow.tsx:16`, `app/book/BookingFlow.tsx:166` to `app/book/BookingFlow.tsx:169`).
- No cheap decorative effects: No handoff-specific decorative clutter found. Skeleton/loading states are functional and do not show fake prices (`components/flights/FlightResults.tsx:289` to `components/flights/FlightResults.tsx:309`; `app/page.tsx:1435` to `app/page.tsx:1450`).

## Verification Results

- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand --passWithNoTests` - passed: 20 suites, 168 tests.
- `npm run dev -- --hostname 127.0.0.1 --port 3007` - blocked by sandbox: `listen EPERM`.

## Out-of-Scope Concerns

- `app/api/book/route.ts` calls Duffel directly (`app/api/book/route.ts:4`, `app/api/book/route.ts:110`, `app/api/book/route.ts:156`), which conflicts with the briefing contract that every external API call goes through `lib/providers`. I did not change it because this ticket is audit-only and adapter behavior is out of scope.
- No hotel in-app booking review exists. Current hotel handoff is external only (`app/components/HotelCard.tsx:255` to `app/components/HotelCard.tsx:271`).
- No checkout, account, traveler profile, payment, or legal policy text was added.

## Required Return Note

- What changed and why: Added this focused QA audit report for booking handoff confidence copy.
- Files changed: `docs/audits/2026-06-30-audit-booking-handoff-confidence-copy-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm test -- --runInBand --passWithNoTests` passed with 20 suites and 168 tests; local dev server/browser verification blocked by `listen EPERM`.
- Out-of-scope findings or blockers: Product code unchanged. Local browser screenshots unavailable due sandbox bind failure. Direct Duffel calls in `app/api/book/route.ts` conflict with provider-boundary briefing but were not changed in this audit ticket.
