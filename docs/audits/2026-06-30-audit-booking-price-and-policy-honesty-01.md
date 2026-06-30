# AUDIT-BOOKING-PRICE-AND-POLICY-HONESTY-01

Date: 2026-06-30  
Role: Senior QA Engineer  
Scope: Booking review, booking resume/recovery, booking errors, provider handoff copy, price/policy continuity.

## Scope Notes

The ticket listed `components/TicketCard.tsx`, `components/TicketSlideOver.tsx`, `app/api/tickets/route.ts`, `app/api/tickets/[id]/route.ts`, and `lib/db.ts`, but those paths do not exist in this worktree. The current booking surfaces are:

- `app/components/FlightCard.tsx`
- `components/flights/FlightResults.tsx`
- `components/baggage/BaggageFeeEstimator.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/book/route.ts`
- `lib/booking/config.ts`
- `app/components/HotelCard.tsx`
- `app/deals/[dealId]/page.tsx`

## Findings

### P0 - Booking API calls Duffel directly outside `lib/providers`

State: booking submit from `/book` when `BOOKING_ENABLED=true` and provider is `duffel`  
Data backing: available data for offer id, fare context, and passenger payload; provider call location violates contract  
Files:

- `app/api/book/route.ts:4` defines `BASE_URL = 'https://api.duffel.com'`
- `app/api/book/route.ts:110` fetches `/air/offers/{offerId}`
- `app/api/book/route.ts:156` fetches `/air/orders`
- `lib/providers/duffel.ts:149` correctly keeps search provider calls inside `lib/providers`, showing the booking route is the exception

Repro:

1. Set `BOOKING_ENABLED=true` and configure `DUFFEL_KEY`.
2. Search a Duffel-backed fare.
3. Open the internal `/book?...` review link.
4. Submit traveler details.

Trust risk: The non-negotiable contract says every external API call must go through `lib/providers`. Booking order creation bypasses that boundary, so error handling, Result-shape provider behavior, caching expectations, and future provider swap points are inconsistent with the rest of the app.

Repair ticket: Move Duffel offer refresh/order creation behind a provider adapter method that returns `Result<T>` and keep the route as an HTTP/controller layer only.

### P0 - Live booking copy asks users to confirm without showing required policy context

State: `/book` normal review when `bookingEnabled=true`, `duffelSandbox=false`, single passenger  
Data backing: price, route, carrier, stops, passenger count, provider, and offer id are available; taxes/fees, baggage inclusion, cancellation/refund terms, fare rules, seat/ancillary rules, payment terms, and provider support terms are unavailable  
Files:

- `app/book/BookingFlow.tsx:386` renders the normal review form
- `app/book/BookingFlow.tsx:389` says "Confirm the fare details before expaify sends traveler information to the provider."
- `app/book/BookingFlow.tsx:396` says "Continue with this fare"
- `app/book/BookingFlow.tsx:402` says "Review fare context before creating the order."
- `app/book/BookingFlow.tsx:466` uses CTA "Confirm booking"
- `app/book/BookingFlow.tsx:468` only says expaify sends details after confirmation

Repro:

1. Open a valid `/book?...` URL with single-passenger Duffel fare context.
2. Use a non-sandbox Duffel key or `DUFFEL_ENV` not equal to `sandbox`.
3. Review the right-side form and sticky submit area on desktop and 375px mobile.

Trust risk: The user is asked to confirm booking/order creation without any visible statement that baggage, cancellation, refunds, provider terms, taxes/fees, fare rules, and seat selection are not available in expaify. The page shows a price and provider but not whether that price includes taxes/fees or what policy obligations apply.

Repair ticket: Add explicit unavailable-policy copy to the live booking review state before the submit CTA. Do not invent policy data; state plainly that expaify has no fare rules, baggage inclusion, cancellation/refund, seat, or provider terms in this review.

### P0 - Success state can overstate booking finality

State: `/book` success after `/api/book` returns `ok: true` and `bookingReference`  
Data backing: provider returned a booking reference; no ticketing status, payment receipt, fare rules, cancellation terms, baggage terms, or airline confirmation details are available  
Files:

- `app/book/BookingFlow.tsx:315` title is "Booking confirmed"
- `app/book/BookingFlow.tsx:321` status title is "Order confirmed"
- `app/api/book/route.ts:209` returns success based on `booking_reference` and `orderId`

Repro:

1. Submit the booking form in an environment where Duffel order creation returns a booking reference.
2. Review the success screen.

Trust risk: "Booking confirmed" and "Order confirmed" imply a paid user has a complete confirmed booking, but the UI only proves that a provider reference was returned. It does not show ticketing status, provider terms, payment status suitable for user review, cancellation/refund rules, baggage policy, or follow-up instructions beyond searching more flights.

Repair ticket: Change confirmation language to match the available data, for example "Provider reference returned", and add explicit missing-policy/payment/ticketing context.

### P1 - Error state says no order was created even when provider/order status may be ambiguous

State: `/book` error after submit  
Data backing: ambiguous data; local code has an HTTP failure or caught error, but provider side effects may be unknown after network interruption or malformed response  
Files:

- `app/book/BookingFlow.tsx:367` says "the provider stopped the booking request before an order was created"
- `app/book/BookingFlow.tsx:372` displays API error text
- `app/api/book/route.ts:186` parses order JSON after order submission
- `app/api/book/route.ts:214` catches and returns "Booking unavailable. Please try again later."

Repro:

1. Submit `/book` with valid fare context.
2. Simulate a network interruption or provider 5xx after `/air/orders` is called.
3. Review the error panel.

Trust risk: The UI makes a definitive claim that no order was created, but once order creation has been attempted, a timeout or parsing failure does not prove provider-side non-creation. This can mislead users about whether they need to check the provider.

Repair ticket: Use ambiguous-safe language after submit failures, such as "We could not confirm whether the provider created an order. Do not resubmit until checking provider support/reference availability."

### P1 - Booking review price omits taxes/fees basis

State: `/book` fare summary, normal/loading/error/success/recovery states when fare context exists  
Data backing: available data for `priceCents`, `currency`, `priceScope`, passenger count; unavailable data for tax/fee inclusion and fare-rule basis  
Files:

- `app/book/BookingFlow.tsx:94` shows "Current fare"
- `app/book/BookingFlow.tsx:96` formats `priceCents` and `currency`
- `app/book/BookingFlow.tsx:97` shows only per-person vs party-total basis
- `lib/booking/config.ts:12` and `lib/booking/config.ts:15` define price and scope, with no taxes/fees/policy fields

Repro:

1. Open a valid `/book?...priceCents=45001&currency=USD&priceScope=party_total...`.
2. Inspect the fare summary.

Trust risk: The page correctly derives display from integer cents, but "Current fare" plus "total for N adults" can be read as a final payable amount. The app has no field proving taxes/fees are included or excluded.

Repair ticket: Add a concise disclaimer near the fare amount: final taxes, fees, baggage, and provider charges are not available in expaify and must be verified with the provider.

### P1 - Result-to-booking CTA says booking is paused even when booking may be enabled

State: Duffel search result with internal `/book` deeplink  
Data backing: ambiguous data; `FlightCard` receives fare and link but not `BOOKING_ENABLED`  
Files:

- `app/components/FlightCard.tsx:241` detects internal booking links
- `app/components/FlightCard.tsx:249` sets CTA to "Review paused booking"
- `app/components/FlightCard.tsx:256` says "In-app booking is paused. Review only."
- `lib/providers/duffel.ts:217` builds internal `/book` links for Duffel fares regardless of booking-enabled state

Repro:

1. Search a route that returns Duffel fares.
2. Compare the flight card CTA with the `/book` page behavior under `BOOKING_ENABLED=true`.

Trust risk: If booking is enabled, the card still tells the user booking is paused, but the destination page can collect traveler details and create an order. This is a direct continuity break between search and review.

Repair ticket: Pass booking availability into the card or ensure Duffel fare links/copy align with the actual booking mode.

### P2 - Saved deal detail price lacks price basis and tax/fee context

State: saved deal detail with `bookingUrl`  
Data backing: available data for `deal.price`, `deal.currency`, `deal.provider`, and `bookingUrl`; ambiguous data for per-person/nightly/party-total basis and taxes/fees  
Files:

- `app/deals/[dealId]/page.tsx:146` formats price from stored deal fields
- `app/deals/[dealId]/page.tsx:194` labels it only "Price"
- `app/deals/[dealId]/page.tsx:253` shows "Check availability with {provider}"
- `app/deals/[dealId]/page.tsx:263` says prices and availability can change

Repro:

1. Open a saved deal detail page with a booking URL.
2. Inspect the price panel and provider CTA.

Trust risk: The handoff warning is good, but the price itself has no basis. A user cannot tell if the saved price is per traveler, total trip, nightly hotel rate, before taxes/fees, or after taxes/fees.

Repair ticket: Add basis-specific copy only when backed by stored metadata; otherwise state that the saved deal does not include a verified tax/fee or passenger/night basis.

## Positive Checks

- Flight result prices use `Money` (`priceCents`, `currency`) and are formatted through `formatMoney`; see `app/components/FlightCard.tsx:292` and `lib/money.ts:14`.
- Booking review parses and validates integer-cent fare context; see `lib/booking/config.ts:71`.
- `/api/book` refreshes the Duffel offer and rejects changed price, currency, or passenger count before order creation; see `app/api/book/route.ts:137` and `app/api/book/route.ts:144`.
- Missing booking context is blocked and does not collect traveler details; see `app/book/BookingFlow.tsx:334`.
- Booking paused and multi-passenger recovery states are explicit that no order is created; see `app/book/BookingFlow.tsx:338` and `app/book/BookingFlow.tsx:350`.
- Hotel cards explicitly say nightly rate is before taxes and fees; see `app/components/HotelCard.tsx:59`.
- Baggage estimator unavailable state says not to assume checked or carry-on fees are included; see `components/baggage/BaggageFeeEstimator.tsx:186`.

## Manual Verification Flow

1. Search: From `/`, search `JFK` to `LAX`, future round trip dates, 1 passenger. Confirm result loading, provider notice, empty state, and result cards do not imply final availability.
2. Select result: Choose a Duffel-backed card with an internal `/book` link. Confirm the card CTA and note match actual booking mode.
3. Booking review: On `/book`, inspect fare summary for route, carrier, stops, passenger count, provider attribution, price, and price basis.
4. Normal submit state: With `BOOKING_ENABLED=true`, inspect traveler form copy and submit CTA for missing policy/tax/fee/baggage/cancellation disclosures.
5. Loading state: Submit valid-looking traveler data and inspect "Submitting request" copy while fare context remains visible.
6. Error state: Force `/api/book` to return 409/500/network failure and inspect whether the UI overstates that no order exists.
7. Success state: In sandbox or mocked success, inspect whether "Booking confirmed" is backed only by a provider reference.
8. Resume/refresh: Refresh `/book?...` and confirm fare context is reconstructed only from URL params; edit/remove params and confirm invalid state blocks submission.
9. Mobile 375px: Repeat normal, loading, error, invalid, paused, and success states at 375px width. Confirm sticky CTA does not hide fields or policy copy.
10. Desktop: Repeat at desktop width. Confirm fare summary and form remain readable and no price/provider/action text overlaps.

## Provider Boundary Confirmation

Provider search calls are routed through `lib/providers` in `app/api/search/route.ts:4`. Booking order calls are not: `app/api/book/route.ts:110` and `app/api/book/route.ts:156` call Duffel directly. Therefore this audit cannot confirm "no provider calls outside `lib/providers`"; it confirms the opposite for booking.

## Out of Scope

- No checkout, payment, seat selection, loyalty, account, provider, or money-model fixes were implemented.
- No fake policy data or placeholder provider terms were added.
- Ticket paths for `TicketCard`, `TicketSlideOver`, `/api/tickets`, and `lib/db.ts` are absent in this worktree.
