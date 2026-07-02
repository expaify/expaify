# UXR-BOOKING-REVIEW-PRICE-MEMORY-01: Booking Review Price Memory

## Source Discovery

- Discovery report: `docs/pipeline/booking-review-price-memory/01-discovery.md`
- Problem statement: paid users entering booking review cannot easily verify that the itinerary, price, price basis, and provider terms shown on the review page still match the result they chose before they provide traveler details or continue to a provider.

## Current Implementation Audit

### Result-To-Review Handoff

- Flight booking context is serialized into `/book` query params by `buildBookingHref`, including offer id, provider, route, dates, carrier, stops, integer-cent price, currency, passenger count, and price scope (`lib/booking/config.ts:214`).
- Hotel context is serialized into `/book` query params by `buildHotelBookingHref`, including hotel offer id, provider, name, nightly price, currency, price basis, provider URL, and optional area (`lib/booking/config.ts:234`).
- `/book` parses those query params into `fareContext` or `hotelContext` before rendering `BookingFlow` (`app/book/page.tsx:11`).
- The parsers validate basic shape, airport codes, dates, positive integer-cent money, passenger count bounds, currency code, and safe HTTP(S) provider URLs (`lib/booking/config.ts:93`, `lib/booking/config.ts:162`).

### Review Page Hierarchy

- Flight review foregrounds route, carrier, departure, selected facts, provider, price basis, and offer id, but labels the price block as "Current fare" even though the value is the preserved query-string value rather than a visible pre-submit provider refresh (`app/book/BookingFlow.tsx:88`, `app/book/BookingFlow.tsx:101`).
- Hotel review uses clearer "Selected rate" language and warns that taxes, fees, cancellation policy, room details, and live availability require provider confirmation (`app/book/BookingFlow.tsx:127`, `app/book/BookingFlow.tsx:354`).
- The offer reference is available only inside a collapsed `details` element, so the first screen does not make the quote memory fully inspectable without extra action (`app/book/BookingFlow.tsx:119`, `app/book/BookingFlow.tsx:153`).
- The right rail asks for traveler details with "Continue with this fare" and "Confirm booking" before the user sees any explicit "selected result price vs provider-verified price" distinction (`app/book/BookingFlow.tsx:523`, `app/book/BookingFlow.tsx:590`).

### Verification And Failure Timing

- Duffel offer refresh happens only inside `POST /api/book`, after the user submits traveler details (`app/book/BookingFlow.tsx:413`, `app/api/book/route.ts:109`).
- The server blocks changed passenger count, changed price, changed currency, missing Duffel config, and provider fetch/order failures with Result-shaped JSON responses (`app/api/book/route.ts:60`, `app/api/book/route.ts:137`, `app/api/book/route.ts:144`).
- The UI turns those booking API failures into a post-submit error state: "Booking request stopped" with the provider/server reason (`app/book/BookingFlow.tsx:493`).
- Multi-passenger booking is blocked on the review page before collection because the form only supports one passenger (`app/book/BookingFlow.tsx:480`).

### Result Card Precedent

- Flight result CTAs already disclose that expaify review opens before provider action and that booking may remain paused or provider terms can change (`app/components/FlightCard.tsx:278`, `app/components/FlightCard.tsx:297`).
- Hotel result CTAs already disclose that the provider confirms final total, room availability, cancellation policy, and terms (`app/components/HotelCard.tsx:141`).
- The review page does not carry over the same explicit distinction with enough prominence for the selected price memory.

## Reference Patterns

### Booking.com

Booking.com documentation separates displayed price from final booking economics: the price description indicates whether taxes and fees are included or excluded, more price detail appears while booking, and actual currency conversion can vary. Its accommodation API guidance also recommends storing prices briefly, performing a final preview/check before order creation, and explaining small price discrepancies caused by taxes, currency rounding, or policy conditions.

Pattern takeaway: the review step should label whether a price is selected, estimated, refreshed, or final; it should not imply finality until the provider has confirmed the orderable total.

Sources: `https://www.booking.com/content/how_we_work.html`, `https://developers.booking.com/demand/docs/accommodations/prices-accommodations`

### Google Flights

Google Flights treats flight prices as volatile and supports tracking/notifications when route or flight prices change significantly. Its help copy also calls out that tracked current fares can expire soon and a new fare may cost more.

Pattern takeaway: for flights, trust comes from explicit price-memory status and changed-price handling, not from calling a stored fare "current" without showing when or how it was refreshed.

Source: `https://support.google.com/travel/answer/6235879`

## Exact Gap

The current code preserves a valid selected result snapshot, but the review UI does not name it as a snapshot. The primary flight price label says "Current fare" while the only provider refresh happens after form submit. If Duffel returns a different price, currency, or passenger count, the user learns after entering traveler details. Hotel handoff copy is more accurate, but it still lacks a compact quote-memory module that shows the selected-at source, selected rate, provider confirmation boundary, and next-step consequence in one scan.

## Design Directives For UXDES

1. Replace ambiguous flight price labeling with quote-memory language. The primary fare price must be labeled "Selected fare" or "Selected result price" unless a pre-submit provider refresh is implemented; do not use "Current fare" for query-param context.

2. Add a visible verification status block above traveler details and provider handoff CTAs. Required status variants: "Preserved from search result", "Provider verification pending", "Provider confirmed unchanged", "Price or passenger count changed", "Booking paused", "Invalid selection", and "Hotel provider confirmation required".

3. Preserve all commercial facts in first-screen scan order: route or hotel name, provider, selected price, currency, price basis, passenger count for flights, depart/return dates where available, and offer reference. The offer reference may remain secondary, but it must be visible without opening a collapsed control when the review is actionable.

4. Define changed-state copy before implementation. If provider price, currency, or passenger count changed, the user must see a blocking message before any order attempt completes: "This fare changed since search. Return to search and choose the current fare." Include the selected value and provider-returned value if the data is available; otherwise avoid inventing unavailable values.

5. Keep hotel review as a handoff, not a booking promise. The hotel state must say "Selected nightly rate" and "Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms" near the Continue button.

6. Mobile and keyboard acceptance criteria must be explicit. At 375px, price, status, and primary CTA must not overlap or truncate critical money/status text. Keyboard order must be: Back to search, review heading/status, selected facts, actionable form or provider CTA, secondary action. Status/error regions must use `role="status"` or `role="alert"` consistently with the existing `StatusPanel`.

## Testable Acceptance Criteria For The Design Spec

- A first-time user can identify whether the displayed flight price is selected-only or provider-confirmed before entering traveler details.
- The review screen never labels preserved query-string fare data as "Current fare" unless a same-session provider refresh result is shown.
- Flight changed-price and changed-passenger-count states specify that submission/order creation is blocked and direct the user back to search.
- Hotel review never implies expaify can verify final taxes, fees, room availability, cancellation policy, or total due.
- The selected price, price basis, provider, and status are visible and readable at 375px and 1280px without requiring expansion.
