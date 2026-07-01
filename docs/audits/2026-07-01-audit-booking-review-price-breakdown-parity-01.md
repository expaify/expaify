# AUDIT-BOOKING-REVIEW-PRICE-BREAKDOWN-PARITY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Result price, booking review price, and handoff price language parity.

## Verdict

Fail for flight booking review parity.

The selected flight price amount and basis survive the handoff, but the booking review drops the visible currency code that is shown on the originating result card. Hotel result cards have price and handoff language, but there is no hotel booking review surface in this worktree to compare against.

## Finding 1 - Flight booking review drops visible currency code

Severity: P0

Repro:
1. Use a Duffel/internal booking fare with `priceCents=45001`, `currency=USD`, `passengerCount=2`, and `priceScope=party_total`.
2. Observe the flight result card.
3. Open the internal `/book` review link for that fare.
4. Compare the price display on the result card against the booking review "Current fare" panel.

Expected:
- Result card and booking review both preserve visible amount, currency, and basis.
- Example: `$450.01 USD`, total trip price for 2 adults.

Actual:
- Result card uses shared money formatting and displays `$450.01 USD`.
- Booking review displays `$450.01` without the `USD` code.
- Basis is still present, but wording changes from `total trip price for 2 adults` to `total for 2 adults`.

Evidence:
- Flight result card renders `formatMoney(price)` plus basis labels from `priceScope`: `app/components/FlightCard.tsx:112`, `app/components/FlightCard.tsx:261`.
- Shared `formatMoney` appends the uppercase currency code: `lib/money.ts:14`.
- Existing component test expects `$450.01 USD` on the flight result card: `app/components/__tests__/scorePresentation.test.tsx:142`.
- Booking review uses a local formatter that returns `$450.01` for USD and omits the currency code: `app/book/BookingFlow.tsx:24`, `app/book/BookingFlow.tsx:95`.
- Existing booking test only asserts `$450.01`, so this mismatch is not caught: `app/book/__tests__/BookingFlow.test.tsx:76`.

User impact:
- A user can see one visible currency treatment on the selected result and a different treatment on the paid-flow review surface. This weakens trust, especially for international routes or mixed-currency provider inventory.

## Price Label Trace

Flight result card, valid price:
- Heading: `Passenger total` when `priceScope=party_total`, otherwise `Traveler fare`.
- Amount: shared formatter output such as `$450.01 USD`.
- Basis: `total trip price for 2 adults` or `per person fare for this trip`.
- Handoff copy: `In-app booking is paused. Review only.` for internal booking, or `Opens provider search. Price and availability can change.` for external providers.

Flight booking review:
- Heading: `Current fare`.
- Amount: local formatter output such as `$450.01`.
- Basis: `total for 2 adults` or `per person`.
- Additional facts: route, carrier, depart, return, stops, passengers, price basis, provider.
- Loading copy keeps the fare visible: `Keeping the selected fare visible while the provider responds.`

Hotel result card:
- Heading: `Nightly rate`.
- Amount: shared formatter output such as `$189 USD`.
- Basis and fee language: `per night before taxes and fees`.
- Handoff copy: `Opens provider site. Prices can change.`
- Unavailable state: `Price unavailable` with explicit reason.

Hotel booking review:
- Blocked. No hotel booking review route/component is present. Hotel cards link directly to the provider.

## Empty, Loading, Error, Mobile, Desktop Review

Flight empty/partial price:
- Invalid or missing money is not rendered as `$0`; it shows `Price unavailable` and disables the provider CTA.
- Booking context validation rejects missing, malformed, non-positive, or non-integer price fields before rendering fare review.

Flight loading/error:
- Booking review loading state keeps the fare summary visible while the provider responds.
- API rejects changed passenger count, price cents, or currency before order creation.

Layout:
- Static review of booking summary classes shows mobile-first stacking with `px-4`, `min-w-0`, `break-words`, and a desktop two-column grid at `lg:grid-cols-[minmax(0,1fr)_380px]`.
- No obvious code-level truncation of critical booking summary price context was found, but browser screenshot verification was not performed because this audit stayed within the available Jest/TypeScript harness.

## Out Of Scope / Blockers

- No product code was changed because the ticket is audit-only and explicitly says not to implement price formatting changes.
- Hotel result to booking review parity cannot be completed until a hotel booking review surface exists.
- The files named in the ticket as `components/ResultCard.tsx`, `components/BookingPanel.tsx`, and `components/BookingSummary.tsx` do not exist in this worktree. Equivalent inspected files were `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `app/book/BookingFlow.tsx`, `lib/booking/config.ts`, and `lib/money.ts`.
