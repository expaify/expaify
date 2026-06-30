# AUDIT-BOOKING-CONFIRMATION-BOUNDARY-01

Date: 2026-06-30
Auditor: Senior QA
Scope: Booking-confirmation boundary copy and states

## Scope Notes

Requested files inspected where present:
- `app/page.tsx`
- `app/layout.tsx`

Requested files not present in this checkout:
- `components/TicketSlideOver.tsx`
- `components/TicketCard.tsx`
- `app/api/tickets/[id]/route.ts`

Actual booking boundary files inspected:
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/book/route.ts`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `components/flights/FlightResults.tsx`
- `lib/booking/config.ts`

## Findings

### P0 - Enabled booking path uses final-reservation confirmation language before and after provider order creation

Files and states:
- `app/book/BookingFlow.tsx:388-402`, idle enabled booking form
- `app/book/BookingFlow.tsx:460-469`, primary submit action
- `app/book/BookingFlow.tsx:311-328`, success state
- `app/api/book/route.ts:155-213`, API creates a Duffel order and returns `bookingReference`

Problem:
When `BOOKING_ENABLED=true`, the booking form tells users:
- "Confirm the fare details before expaify sends traveler information to the provider."
- "Review fare context before creating the order."
- Button: "Confirm booking"
- Loading button: "Confirming request..."

On API success, the UI then says:
- Eyebrow: "Confirmation"
- Title: "Booking confirmed"
- Status: "Order confirmed"
- Message: "The provider returned a booking reference for this fare."

Why this is broken:
This crosses the confirmation boundary. The ticket goal requires clear separation between expaify review, provider checkout, failed request, and confirmed airline/hotel reservation language. The UI implies the user has a confirmed airline reservation, but the product boundary is not explicit enough about whether this is a live provider order, sandbox order, paid ticket, held booking, or airline-confirmed reservation. The API uses Duffel balance payment (`app/api/book/route.ts:175-180`), so the wording carries legal/trust risk when enabled.

Repro:
1. Set `BOOKING_ENABLED=true` with a valid Duffel booking context.
2. Open `/book?...` with a valid one-passenger Duffel fare context.
3. Read the review form header, booking status panel, and primary submit button.
4. Submit valid passenger details and receive a provider `bookingReference`.
5. Observe "Booking confirmed" and "Order confirmed" without an explicit airline-reservation boundary.

Copy recommendation:
- Replace pre-submit "Confirm booking" with language that states the exact next step, for example "Send details to provider" or "Submit provider order request".
- Replace "Booking confirmed" / "Order confirmed" with provider-scoped language unless the product can prove a ticketed reservation, for example "Provider order reference received".
- Add a one-sentence boundary near the reference: "This reference is from the provider response; manage payment, ticketing, and reservation changes with the provider/airline."

### P0 - Sandbox success copy still says "Booking confirmed" and "Order confirmed"

Files and states:
- `app/book/BookingFlow.tsx:311-328`, success state with `duffelSandbox=true`
- `lib/booking/config.ts:27-30`, sandbox detection

Problem:
The idle sandbox path correctly says "Submitting will not create a live airline ticket" and "Sandbox submission only. No live ticket is issued" (`app/book/BookingFlow.tsx:388-389`, `app/book/BookingFlow.tsx:466-469`). After success, the same component always renders:
- "Confirmation"
- "Booking confirmed"
- "Order confirmed"

Why this is broken:
The success state contradicts the sandbox boundary shown before submit. A test provider response should never be labeled as a confirmed booking or order without preserving the "not a live ticket" boundary.

Repro:
1. Use `DUFFEL_KEY=duffel_test_*` or `DUFFEL_ENV=sandbox`.
2. Set `BOOKING_ENABLED=true`.
3. Complete the `/book` form successfully.
4. Observe the success copy drops the sandbox disclaimer and uses live confirmation language.

Copy recommendation:
- For sandbox success, use "Sandbox provider reference received" and "No live ticket was issued."

### P1 - "Checkout review" labels imply payment/checkout even when booking is paused or invalid

Files and states:
- `app/book/page.tsx:25-27`, suspense loading state
- `app/book/BookingFlow.tsx:150-175`, default review shell eyebrow
- `app/book/BookingFlow.tsx:189-220`, paused/recovery states
- `app/book/BookingFlow.tsx:224-263`, invalid/missing context state

Problem:
The default page eyebrow is "Checkout review", including loading, invalid context, booking paused, and multi-passenger unsupported states. The rest of those states mostly explain that no payment or order will be submitted, but "checkout" is a payment-loaded word and can make the page feel closer to purchase completion than review.

Repro:
1. Open `/book` with no query params.
2. Observe the invalid state under the default review shell.
3. Open a valid Duffel `/book?...` URL with `BOOKING_ENABLED` unset/false.
4. Observe a paused state still inside a "Checkout review" frame.

Copy recommendation:
- Use "Fare review" or "Booking handoff review" for loading, invalid, and paused states.
- Reserve "checkout" only for provider-owned checkout or a truly enabled, paid checkout path with explicit payment boundaries.

### P1 - Result cards use "confirmed" to mean price validity, which can be mistaken for reservation confidence

Files and states:
- `app/components/FlightCard.tsx:251-265`, unavailable price notes
- `app/components/FlightCard.tsx:173-175`, low-confidence Deal Score note
- `app/components/HotelCard.tsx:105-114`, unavailable hotel reasons
- `app/components/HotelCard.tsx:126-164`, low-confidence Deal Score notes
- `app/deals/[dealId]/page.tsx:113`, saved deal score fallback, out-of-primary scope but same copy family

Problem:
Several result states use "confirmed" as a synonym for verified data:
- "No confirmed fare price was returned..."
- "Not enough route history for a confirmed deal rating"
- "No confirmed nightly price..."
- "not a confirmed deal"

Why this matters:
In booking-adjacent UI, "confirmed" is overloaded. These phrases are not saying a reservation is confirmed, but they appear near booking buttons and unavailable states. This is a clarity issue rather than an immediate legal risk because the unavailable states block the primary booking action and the notes mostly reduce confidence.

Repro:
1. Inspect a flight card with invalid/missing price.
2. Inspect a hotel card with invalid/missing price or low-confidence score.
3. Read the unavailable CTA note and score panel.

Copy recommendation:
- Replace "confirmed fare/nightly price" with "verified live fare/nightly price".
- Replace "confirmed deal rating" with "reliable deal rating".

## Positive Boundary Checks

- Search page footer clearly says final price and availability are set by the provider (`app/page.tsx:323-325`).
- External flight CTA copy says "Check with {provider}" and "Opens provider search. Price and availability can change" (`app/components/FlightCard.tsx:244-257`, `app/components/FlightCard.tsx:353-379`).
- Hotel CTA copy says "Check with HotelLook" and "Opens provider site. Prices can change" (`app/components/HotelCard.tsx:255-271`).
- Invalid booking context says no passenger details, payment details, or provider order can be submitted (`app/book/BookingFlow.tsx:239-253`).
- Booking paused state says expaify is not collecting passenger details, payment information, or creating provider orders (`app/book/BookingFlow.tsx:338-346`).
- Failed booking request state says the provider stopped the request before an order was created (`app/book/BookingFlow.tsx:363-378`).
- Loading state on submit says "Keeping the selected fare visible while the provider responds" and does not claim success (`app/book/BookingFlow.tsx:405-411`).

## Manual Verification Flow

Flow verified by source inspection from result CTA to booking review:
1. Duffel fares are converted to internal booking links through `buildBookingHref(fare)` (`lib/booking/config.ts:140-157`, called from `lib/providers/duffel.ts`).
2. `FlightCard` detects Duffel `/book` links as internal booking links only when source is `duffel` and path is `/book` (`app/components/FlightCard.tsx:144-153`).
3. Internal booking CTA renders as "Review paused booking" with note "In-app booking is paused. Review only." (`app/components/FlightCard.tsx:244-257`, `app/components/FlightCard.tsx:353-379`).
4. `/book` parses the selected fare context and passes `bookingEnabled`, `duffelSandbox`, and `fareContext` into `BookingFlow` (`app/book/page.tsx:11-40`).
5. With `BOOKING_ENABLED=false` or unset, the destination page remains review-only and says no passenger details, payment information, or provider orders are created (`app/book/BookingFlow.tsx:338-346`).
6. With `BOOKING_ENABLED=true`, the same page exposes the P0 confirmation-language issue documented above.

External handoff flow verified by source inspection:
1. Non-internal flight deeplinks render as external links with `target="_blank"` and `rel="noopener noreferrer sponsored"` (`app/components/FlightCard.tsx:353-363`).
2. CTA text is "Check with {provider}" and the support note says price and availability can change (`app/components/FlightCard.tsx:244-257`, `app/components/FlightCard.tsx:379`).

## Keyboard Focus Order

Desktop booking page focus order by DOM inspection:
1. "Back to search" link (`app/book/BookingFlow.tsx:166-169`)
2. "Technical reference" details summary when fare context exists (`app/book/BookingFlow.tsx:112-115`)
3. Title select
4. Gender select
5. First name input
6. Last name input
7. Date of birth input
8. Email input
9. Phone input
10. Primary submit button (`app/book/BookingFlow.tsx:413-467`)

Result:
- Focus order is logical and action-last on desktop.
- Global focus-visible styling is present (`app/globals.css:137-144`).
- Invalid booking state programmatically focuses an `sr-only` heading (`app/book/BookingFlow.tsx:224-249`), which is coherent for screen-reader recovery.

## Mobile and Desktop State Review

- 375px mobile: Booking layout is single-column by default, form fields stack, the submit area is sticky at the bottom (`app/book/BookingFlow.tsx:166-181`, `app/book/BookingFlow.tsx:413-473`). No obvious source-level hidden primary action was found.
- Desktop: Booking layout switches to main content plus sticky side action panel (`app/book/BookingFlow.tsx:170-182`). Focus order remains DOM-order logical.
- Loading: Initial page loading says "Loading booking review" and "Preparing the selected fare and recovery options" (`app/book/page.tsx:17-34`), coherent except for the P1 "Checkout review" label.
- Empty/missing context: Invalid state blocks submission and clearly says no payment/provider order can be submitted (`app/book/BookingFlow.tsx:224-263`).
- Error: Stopped provider request says no order was created (`app/book/BookingFlow.tsx:363-378`).

## Blockers

- P0 blocker: Enabled booking success and submit copy must not use unqualified "Confirm booking", "Booking confirmed", or "Order confirmed" unless expaify can prove the user has a confirmed live airline reservation/ticket and clearly distinguishes sandbox/test provider references.
- Requested ticket files `components/TicketSlideOver.tsx`, `components/TicketCard.tsx`, and `app/api/tickets/[id]/route.ts` do not exist in this checkout, so they could not be audited directly.

## Out-of-Scope Findings

- `app/api/book/route.ts` performs Duffel API calls directly from an app route rather than through `lib/providers`, which appears to conflict with the briefing's provider-boundary contract. This audit did not repair or refactor it because provider behavior changes are out of scope.
- `app/api/book/route.ts` returns `bookingReference` and `orderId` in a shape that is not the shared `Result<T>` form described in the briefing. Not changed; out of scope for this confirmation-boundary audit.
