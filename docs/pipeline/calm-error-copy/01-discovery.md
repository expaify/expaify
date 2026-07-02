# UXD-CALM-ERROR-COPY-01: Calm Error Copy Discovery

## User Pain Point

Error and unavailable states use abrupt, technical, or provider-centered language that makes paid users question whether expaify searched correctly, preserved their selected offer, or can safely hand them off to booking.

## Affected Users And Flow Step

This affects first-time and returning paid users at three trust-sensitive steps:

- Search results: after submitting a flight, hotel, or flight + hotel search, users see messages such as "Search error," "Flights unavailable," "No flights returned," or "Hotel inventory was not confirmed because the provider is unavailable" without a consistently calm distinction between no matching inventory, partial provider coverage, and recoverable service failure. Current examples are in `app/page.tsx` and `components/flights/FlightResults.tsx`.
- Results recovery: users deciding whether to retry, edit details, use flexible dates, search nearby airports, or broaden hotels receive similar copy for different causes, so the next action can feel like guesswork rather than guided recovery.
- Booking review and handoff: users who already selected a fare or hotel see messages such as "Booking request stopped," raw provider-derived reasons, or "Failed to fetch offer" flowing from `app/book/BookingFlow.tsx` and `app/api/book/route.ts`, which can sound like an order may have failed mid-purchase even when expaify says no order was created.

## Measurable Signal

The current implementation exposes inconsistent and sometimes alarming error language across the affected surfaces:

- `app/page.tsx` labels the full-results failure state as "Search error" and "We could not complete this search," then displays the thrown API or fallback message directly to the user.
- `app/page.tsx` and `components/flights/FlightResults.tsx` use "Flights unavailable" and "Hotels unavailable" for provider failure states while also using "No flights returned" and "No hotels returned" for empty supply; the recovery copy overlaps around retrying or editing trip details.
- `app/api/search/route.ts` streams provider status messages such as "provider is unavailable," "response we could not use," and "No flight providers returned matching fares," which are then surfaced in the results experience.
- `app/book/BookingFlow.tsx` maps generic and network failures to "Booking request stopped" and appends the raw reason after "expaify did not create an order," while `app/api/book/route.ts` can return technical reasons such as "Duffel not configured," "Failed to fetch offer," "Could not extract passenger ID from offer," and field names like `passenger.given_name is required`.
- The affected copy appears in high-stakes moments where users are deciding whether search results are complete, whether inventory is trustworthy, or whether a booking action was safe.

## Constraints

1. Preserve data integrity and honesty: copy must not imply inventory, price, availability, booking creation, or provider confirmation when the system has not verified it.
2. Preserve recovery clarity: every error, empty, unavailable, and partial-result state must tell users what happened in plain language and offer the correct next step without masking no-supply cases as system failures.
3. Preserve accessibility and trust tone: messages must remain screen-reader friendly, avoid panic language, keep focus/live-region behavior intact, and stay consistent with expaify's paid travel decision context.

## Success Statement

This is solved when a first-time paid user can hit a search, inventory, or booking handoff problem and understand what expaify checked, what was not confirmed, whether any order was created, and what to do next without seeing alarming, raw provider, or ambiguous failure language.
