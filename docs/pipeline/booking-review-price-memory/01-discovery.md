# UXD-BOOKING-REVIEW-PRICE-MEMORY-01: Booking Review Price Memory

## Pain Point

Paid users entering booking review cannot easily verify that the itinerary, price, price basis, and provider terms shown on the review page still match the result they chose before they provide traveler details or continue to a provider.

## Affected Users And Flow Step

- **Who is affected:** Paid users who select a flight fare or hotel rate from results and expect the booking review step to preserve the exact commercial terms they chose.
- **Flow step:** Booking review, after clicking "Review fare" or "Review hotel" from results and before submitting traveler details or continuing to the provider.
- **Trust risk:** The review page displays selected context from the URL, but it does not make the user's original selection feel like a verifiable quote memory with explicit selected-at, still-current, or changed-state language.

## Current Implementation Signals

- `lib/booking/config.ts` builds `/book` URLs from result-card data by encoding offer id, provider, route or hotel name, dates, price cents, currency, passenger count, and price basis into query parameters.
- `app/book/page.tsx` parses the query string into `fareContext` or `hotelContext` and sends that context into `app/book/BookingFlow.tsx`.
- `app/book/BookingFlow.tsx` shows a fare or hotel summary with selected price, provider, route/name, price basis, and technical reference, but the summary labels the value as "Current fare" or "Selected rate" without explaining whether the value is the original result-card price, a refreshed provider price, or a verified unchanged price.
- `app/api/book/route.ts` re-fetches the Duffel offer during flight booking submission and rejects changed price, currency, or passenger count with a conflict response, but this verification happens only after the user has already entered traveler details and submitted the form.
- `app/components/FlightCard.tsx` and `app/components/HotelCard.tsx` warn that final price, availability, fees, and provider terms can change, but the booking review page does not carry forward a clear comparison between the selected result-card terms and any provider-confirmed terms.

## Measurable Signal

This problem exists when a paid user reaches `/book` and cannot answer all four questions from the review surface before taking the next action:

1. **What did I choose?** The exact route or hotel, provider, price, currency, price basis, dates, passenger count, and offer reference from the result card.
2. **Is this still verified?** Whether the displayed price and terms have been refreshed or are only the preserved selection.
3. **What can still change?** Provider price, availability, taxes/fees, policies, baggage or room terms, and final total.
4. **What happens if it changed?** Whether expaify blocks submission, asks the user to return to search, or sends them to provider confirmation.

Observable QA signals:

- The review page can show "Current fare" even though the value comes from query-string context, not a visible pre-submit provider refresh.
- Duffel price mismatch protection exists in `app/api/book/route.ts`, but the user sees the mismatch only after form submission.
- Hotel handoff review has no live verification step and depends on the provider page for final taxes, fees, room availability, cancellation policy, and total due.
- The technical offer reference is hidden in a collapsible details element, so the primary review hierarchy does not foreground enough evidence for users to compare against the result they selected.

## Constraints

1. **Data integrity:** Preserve integer minor-unit money, validated booking context parsing, safe provider URLs, and the existing Duffel conflict checks; do not imply unverified query-string data is provider-confirmed.
2. **Trust and copy accuracy:** Review copy must distinguish selected result terms from provider-confirmed final terms without promising price locks, guaranteed availability, baggage terms, taxes, fees, or hotel policies.
3. **Accessibility and responsive clarity:** The price-memory summary must remain readable and keyboard-accessible at 375px mobile and 1280px desktop, with clear focus order and status messaging for changed, unavailable, paused, and handoff states.

## Success Statement

This is solved when a first-time paid user can enter booking review and confirm the selected itinerary or hotel, price, currency, price basis, provider, and mutable terms without submitting traveler details or leaving expaify to discover that the reviewed offer no longer matches the result they chose.

## Downstream Focus

The research stage should audit the booking review hierarchy and result-to-review handoff, then define testable directives for:

- Preserved result-card price memory versus refreshed provider verification.
- Flight mismatch, paused booking, invalid fare, and multi-passenger states.
- Hotel handoff states where final provider terms cannot be verified inside expaify.
- Mobile and desktop placement of price, price basis, provider, and mutable-term warnings.
