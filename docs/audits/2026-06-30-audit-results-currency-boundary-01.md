# AUDIT-RESULTS-CURRENCY-BOUNDARY-01

Date: 2026-06-30
Scope: Result currency boundary from provider adapters through search results, Deal Score inputs, result selection, and booking review.

## Verdict

Pass after scoped repair.

The visible flight result, hotel result, Deal Score input, and booking review paths now preserve integer `priceCents` plus `currency` from adapter boundary to display. The repair avoided provider pricing changes and only closed two trust gaps at app boundaries:

- Result dedup/sort no longer compares integer cents across different currencies as if they were the same unit.
- Deal Score explanation text no longer hardcodes `$` for non-USD scores.

## Price Lineage Table

| Surface | Adapter/API source | Transport field | Display or scoring field | Classification | Status |
| --- | --- | --- | --- | --- | --- |
| Flight result | `NormalizedFare.price` from `lib/providers/*` | `/api/search` streams `NormalizedFare[]` unchanged | `FlightCard` renders `fare.price.priceCents` and `fare.price.currency` | `priceCents`, `currency`, display-only formatted text | Pass |
| Hotel result | `HotelOffer.pricePerNight` from `lib/providers/hotellook.ts` | `/api/search` streams `HotelOffer[]` unchanged | `HotelCard` renders `hotel.pricePerNight.priceCents` and `hotel.pricePerNight.currency` | `priceCents`, `currency`, display-only formatted text | Pass |
| Deal Score input | Flight `fare.price` or hotel `pricePerNight` | `/api/score` receives fare body or hotel cents/currency query | `scoreDeal` reads integer cents and filters history by same currency | `priceCents`, `currency` | Pass |
| Deal Score output | `scoreDeal` | `DealScore.medianCents`, `DealScore.currency`, explanation | Cards render score currency and median cents; explanation now uses score currency | `priceCents`, `currency`, display-only formatted text | Pass |
| Booking review | Duffel `buildBookingHref(fare)` | `/book?...priceCents=...&currency=...` | `BookingFlow` renders `fareContext.priceCents` and `fareContext.currency` | `priceCents`, `currency`, display-only formatted text | Pass |
| Booking POST verification | Duffel offer fetch in `app/api/book/route.ts` | `total_amount` decimal string and `total_currency` | Converts decimal string to cents, compares to selected `priceCents` and `currency` before order | Provider decimal string at boundary, then `priceCents`, `currency` | Pass |

## Money Field Classification

| Field or expression | Location | Classification | Notes |
| --- | --- | --- | --- |
| `Money.priceCents` / `Money.currency` | `lib/types.ts` | `priceCents`, `currency` | Canonical contract. |
| `NormalizedFare.price` | `lib/types.ts` | `priceCents`, `currency` | Used by cards, scoring, alerts, booking handoff. |
| `HotelOffer.pricePerNight` | `lib/types.ts` | `priceCents`, `currency` | Used by hotel cards and hotel scoring. |
| `PricePoint.priceCents` / `currency` | `lib/types.ts` | `priceCents`, `currency` | Baseline history. |
| `DealScore.medianCents` / `currency` | `lib/types.ts` | `priceCents`, `currency` | Score output history median. |
| `BookingFareContext.priceCents` / `currency` | `lib/booking/config.ts` | `priceCents`, `currency` | Parsed from result link; validated positive integer and 3-letter currency. |
| `Travelpayouts.price`, `value`, `priceFrom` conversions | `lib/providers/travelpayouts.ts`, `lib/providers/hotellook.ts` | Provider major units to `priceCents` | USD requested from providers; conversion uses `Math.round(value * 100)` at adapter boundary. |
| Duffel and Amadeus decimal totals | `lib/providers/duffel.ts`, `lib/providers/amadeus.ts`, `app/api/book/route.ts` | Provider decimal string, then `priceCents` | Parsed with decimal-string helpers before app use. |
| `Intl.NumberFormat(...).format(cents / 100)` | `app/components/HotelCard.tsx`, `app/deals/[dealId]/page.tsx` | Display-only formatted text | Division is display-only after integer cents source. |
| `formatMoney(...)` helpers | `app/book/BookingFlow.tsx`, `lib/scoring/scoreDeal.ts` | Display-only formatted text | Uses integer cents and currency; no scoring or booking math. |
| `calendarPrices: Record<string, number>` | `app/page.tsx`, `app/api/calendar/route.ts` | `priceCents` with implicit USD display | Source is Travelpayouts USD `PricePoint.priceCents`; UI hardcodes `$` and whole dollars. Safe for current USD-only calendar path, but not currency-extensible. |
| `targetPrice` / `parseFloat` | `app/components/AlertSignup.tsx` | Unsafe/ambiguous | Out of current result flow; current main page uses `thresholdCents` instead. |

## Findings And Repairs

### P0 repaired: mixed-currency result comparisons

Before repair, result deduplication and fallback sorting compared `price.priceCents` directly. That could drop or rank a non-USD provider fare against a USD fare as if 100 minor units meant the same value in both currencies.

Evidence:
- `app/api/search/route.ts` deduped by carrier/route/depart only and sorted by raw cents.
- `app/page.tsx` repeated the same client-side dedup and sort.
- `lib/search/sortFlights.ts` used raw cents as the first fallback comparator.

Repair:
- Dedup keys now include `fare.price.currency`.
- Fallback ordering compares `currency` first, then `priceCents`.

Impact:
No conversion was added. Mixed-currency fares remain visible with their adapter currency, but the app no longer makes a cross-currency "cheapest" claim by comparing raw minor units.

### P0 repaired: Deal Score explanation hardcoded `$`

Before repair, `scoreDeal` returned `DealScore.currency` correctly but generated explanation text with `$...` for every currency. A non-USD provider fare with comparable non-USD history could show a EUR score with USD-looking explanation copy.

Repair:
- `scoreDeal` now formats explanation amounts from integer cents plus the score currency.
- USD displays as `$N.NN`; non-USD displays as `CODE N.NN`.

### Remaining assumption: provider currency requests are USD-first

Travelpayouts, Hotellook, Kiwi, and Amadeus request USD. Duffel and Amadeus still preserve returned provider currency in the adapter result. The app does not convert currencies, by design for this ticket. Mixed-currency scoring remains conservative because `scoreDeal` only compares history with matching `currency`.

## Manual Verification Flow

1. Search: submit a route on the main page. `/api/search` streams provider `NormalizedFare[]` and `HotelOffer[]`; no component calls vendor APIs directly.
2. Results display: flight cards read `fare.price.priceCents` and `fare.price.currency`; hotel cards read `hotel.pricePerNight.priceCents` and `hotel.pricePerNight.currency`. Loading and empty states show no fake prices.
3. Score: flight score requests send the full fare object; hotel score requests send `pricePerNightCents` and `currency`. `scoreDeal` filters baseline history by matching currency before percentile, median, verdict, and explanation.
4. Result selection: Duffel fares use `buildBookingHref(fare)`, copying `fare.price.priceCents`, `fare.price.currency`, `passengerCount`, and `priceScope` into booking context.
5. Booking review: `/book` parses and validates positive integer `priceCents` and 3-letter `currency`, then `BookingFlow` displays the same amount and basis.
6. Booking POST: `POST /api/book` fetches the current Duffel offer, parses `total_amount` to cents, and rejects the booking if cents, currency, or passenger count differs from the selected fare context.

Mobile/desktop source review:
- 375px mobile result cards stack price and CTA; no price-only primary action is hidden by responsive classes.
- Desktop result cards right-align flight price and stack hotel price with CTA; same source fields are used.
- Flight loading, empty, provider error, hotel unavailable, invalid booking, paused booking, and booking error states do not render fabricated prices.

## Blockers And Unknowns

- `app/components/BookingReview.tsx` is not present. Booking review is implemented in `app/book/BookingFlow.tsx`.
- Provider payload assumptions remain external: Travelpayouts/Hotellook/Kiwi/Amadeus are requested in USD, but only live provider contracts can prove they will never return another currency. The app now avoids cross-currency cents comparisons when they do.
- No currency conversion was added because it is out of scope.
- Existing alert and deal-detail money surfaces were noted but not repaired because the assigned ticket is result currency boundary trust.

## Verification Commands

- `npx tsc --noEmit --incremental false`: passed with no output.
- `npx jest --runInBand`: passed. 19 test suites passed, 155 tests passed.
- `npm test -- --passWithNoTests`: passed. 19 test suites passed, 155 tests passed.
