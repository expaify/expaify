# UXD-BOOKING-CONFIRMATION-BOUNDARY-01: Booking Confirmation Boundary

## User Pain Point

After submitting booking details, users may not be able to tell whether expaify created a confirmed reservation, only sent traveler details for provider verification, or handed them off to another provider to finish the purchase.

## Who Is Affected and Where

- **Who is affected:** First-time flight users who submit traveler details for a Duffel fare, and hotel users who compare the `/book` review step against a provider handoff.
- **Flow step:** Booking review after the primary action: flight users after choosing "Verify fare with Duffel" and hotel users after choosing "Continue to provider."
- **Trust risk:** The current flow uses review, verification, handoff, and confirmation language across adjacent states. If the post-submit boundary is not explicit, users can mistake an expaify status screen for a ticketed airline confirmation or assume expaify completed a hotel reservation.

## Measurable Signal

This problem exists when the booking review flow does not answer these questions immediately after the primary action:

1. **Was a reservation created?** Flight success currently changes to "Booking confirmed" when `/api/book` returns a Duffel `bookingReference`, while hotel review never creates a reservation inside expaify.
2. **Who confirmed it?** `app/api/book/route.ts` creates Duffel air orders directly and returns `bookingReference` and `orderId`, but the visible success copy only shows the booking reference and does not show order ownership, payment method, sandbox/live status, or what expaify will do next.
3. **What did expaify not do?** Pre-submit copy says no payment details are collected on the page, but a successful Duffel order is created with `payments: [{ type: 'balance' }]`; this makes the confirmation boundary especially sensitive because no user-entered card data exists while an order can still be created.
4. **What happens if the provider stops the request?** Error states say expaify did not create an order, but success, paused booking, invalid fare, multi-passenger, and hotel handoff states use different labels for review, verification, confirmation, and provider continuation.

Observable QA signals:

- `app/book/BookingFlow.tsx` success state uses the eyebrow "Confirmation," heading "Booking confirmed," and status "Provider confirmed this fare" after `data.ok && data.bookingReference`.
- `app/book/BookingFlow.tsx` pre-submit state says Duffel has not verified the fare yet and the button says "Verify fare with Duffel," so the submit action can feel like verification rather than order creation.
- `app/api/book/route.ts` posts to `/air/orders` with `type: 'instant'` and a Duffel balance payment, then returns `ok: true`, `bookingReference`, and `orderId`.
- `app/book/BookingFlow.tsx` hotel flow is explicitly a provider handoff and opens `hotelContext.providerUrl` in a new tab; no expaify hotel reservation is created.
- `lib/booking/config.ts` parses both flight booking review and hotel handoff contexts into the same `/book` surface, so users can encounter different completion boundaries under one route.

## Constraints

1. **Trust and legal accuracy:** Copy must distinguish selected fare review, provider verification, confirmed Duffel order, sandbox order, failed request, and hotel provider handoff without implying expaify ticketed hotels or guarantees final provider terms.
2. **Data integrity:** The boundary must preserve the existing Duffel conflict protections for price, currency, and passenger count; it must not hide provider failures or imply an order exists unless `/api/book` returns a booking reference.
3. **Payment clarity:** The flow must be explicit that no card details are collected on the page while still accurately explaining any provider-side balance payment/order creation performed by Duffel.
4. **Accessibility and responsive usability:** Status messages must be announced clearly, remain readable at 375px mobile and 1280px desktop, and keep keyboard users oriented after success, error, paused, invalid, and handoff outcomes.
5. **Provider model consistency:** Flight order confirmation and hotel external handoff must remain distinct even though they share the `/book` review route.

## Success Statement

This is solved when a first-time user can submit booking details or continue to a hotel provider and immediately understand whether expaify created a Duffel air order, only stopped before order creation, or sent them to an external provider to complete the reservation, without mistaking review or handoff for a confirmed booking.

## Downstream Focus

The research stage should audit the post-action states in `app/book/BookingFlow.tsx`, the Duffel order response in `app/api/book/route.ts`, and the shared booking context parsing in `lib/booking/config.ts`, then define testable directives for:

- Flight success copy when Duffel returns a booking reference.
- Flight loading and error copy while provider verification/order creation is pending or stopped.
- Sandbox versus live confirmation language.
- Hotel provider handoff language before and after opening the provider URL.
- Mobile and desktop status hierarchy for success, failure, paused booking, invalid selection, and handoff states.
