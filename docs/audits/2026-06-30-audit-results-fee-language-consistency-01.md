# AUDIT-RESULTS-FEE-LANGUAGE-CONSISTENCY-01

Date: 2026-06-30
Role: Senior QA
Scope: result cards, results states, baggage estimator, hotel cards, and booking-adjacent fare review.

## Summary

Fail for consistency. Hotel cards clearly label the displayed hotel amount as "per night before taxes and fees", but flight cards and booking review label selected flight amounts as "fare", "current fare", "traveler fare", "passenger total", or "total trip price" without stating whether taxes, carrier fees, baggage, seat fees, payment fees, or provider charges are included. The global footer says final price is set by the provider, but that does not resolve the per-card ambiguity at the decision point.

The ticket's requested first-pass files do not match this repo: `components/TicketCard.tsx`, `components/TicketSlideOver.tsx`, `app/api/tickets/route.ts`, and `lib/db.ts` are absent. Equivalent inspected surfaces were `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `components/flights/FlightResults.tsx`, `components/baggage/BaggageFeeEstimator.tsx`, `app/book/BookingFlow.tsx`, `app/book/page.tsx`, `app/api/search/route.ts`, `app/api/book/route.ts`, `lib/booking/config.ts`, `lib/types.ts`, and `lib/money.ts`.

## Findings

### P1: Flight total language implies completeness without fee/tax boundary

`app/components/FlightCard.tsx:261` uses "Passenger total" and `app/components/FlightCard.tsx:263` says "total trip price for N adults" for `party_total` fares. For `per_person`, `app/components/FlightCard.tsx:264` says "per person fare for this trip". Neither variant says whether taxes, airline fees, baggage, seat selection, payment/card fees, or provider charges are included.

Repro:
1. Inspect any valid flight result card with `fare.priceScope === 'party_total'`.
2. Observe the amount heading/label.
3. Compare with hotel card copy, which explicitly says "before taxes and fees".

Trust risk: High. Users can reasonably read "total trip price" as complete payable price. The UI has a baggage estimator separately, which means baggage is not represented in the card amount, but the flight amount does not say that.

### P1: Booking review repeats flight price without tax/fee context

`app/book/BookingFlow.tsx:95` labels the selected amount "Current fare", `app/book/BookingFlow.tsx:96` renders the same integer-cent amount, and `app/book/BookingFlow.tsx:97` shows either "total for N adults" or "per person". The review page still does not state whether the fare includes taxes, fees, baggage, seats, payment fees, or provider charges.

Repro:
1. Open a Duffel internal booking link, e.g. `/book?offerId=offer_1&provider=duffel&origin=JFK&destination=LAX&depart=2026-09-15T10%3A00%3A00Z&carrier=AA&stops=0&priceCents=45001&currency=USD&passengerCount=1&priceScope=party_total`.
2. Observe "Current fare" and "total for 1 adult".
3. Compare with the result-card source fields in `lib/booking/config.ts:140`.

Trust risk: High. The handoff preserves amount and basis, but it does not preserve or add a visible fee inclusion/exclusion boundary.

### P2: "confirmed" and "live" language is over-specific in some states

Flight and hotel unavailable states use "No confirmed fare price..." and "No confirmed nightly price..." at `app/components/FlightCard.tsx:252`, `app/components/FlightCard.tsx:265`, `app/components/HotelCard.tsx:107`, and `app/components/HotelCard.tsx:111`. Deal score copy uses "confirmed deal rating" at `app/components/FlightCard.tsx:174` and `app/components/HotelCard.tsx:127`. The app also says "Live fare scoring" at `app/page.tsx:958`.

Trust risk: Medium. Some providers are cached or unavailable, and "confirmed" can imply validation from the airline/hotel. The copy is safer where it says availability and final price can change, but "confirmed" is not backed by a visible provider confirmation artifact on result cards.

### P2: Hotel fee language excludes taxes/fees but omits resort/local charges

Hotel card price copy at `app/components/HotelCard.tsx:59` says "per night before taxes and fees", and provider handoff copy at `app/components/HotelCard.tsx:270` says "Prices can change." This is directionally honest, but it does not distinguish hotel taxes from resort fees, local fees, deposits, or charges collected at property.

Trust risk: Medium. Better than flights, but still incomplete for hotel-specific charges.

### P3: Baggage estimator uses separate USD add-on language, not integrated trip total

The baggage estimator correctly says "Baggage fee estimate" at `components/baggage/BaggageFeeEstimator.tsx:163`, "Estimate only..." at `components/baggage/BaggageFeeEstimator.tsx:173`, "Estimated add-on" at `components/baggage/BaggageFeeEstimator.tsx:209`, and includes the disclaimer from `lib/baggage/fees.ts`. However, it appears above flight cards for the cheapest visible fare only (`components/flights/FlightResults.tsx:146` and `components/flights/FlightResults.tsx:280`), so it can be mistaken as applying to every visible result.

Trust risk: Medium. The estimate language is honest, but placement can create cross-card ambiguity.

## Fee And Price Phrase Inventory

| Surface | Phrase | Location | Apparent money source | Trust risk |
|---|---|---:|---|---|
| Global footer | "Fares and hotel rates can change after provider handoff; final price and availability are set by the provider." | `app/page.tsx:323` | None | Low; honest but far from card CTA. |
| Global footer | "Outbound provider links may include affiliate markers." | `app/page.tsx:325` | None | Low; clear provider-charge/affiliate boundary. |
| Search hero | "Live fare scoring" | `app/page.tsx:958` | None | Medium; implies live when some data may be cached/provider unavailable. |
| Search copy | "Search current fares..." | `app/page.tsx:964` | Provider results | Low/medium; okay if providers return current fares, misleading on cached/no-provider states. |
| Loading results | "Checking live flight inventory" | `components/flights/FlightResults.tsx:293` | None | Medium; live inventory is not guaranteed until providers return usable results. |
| Loading results | "Fare cards will appear here as providers return usable prices..." | `components/flights/FlightResults.tsx:301` | Provider results | Low; clearly conditional. |
| Empty/error results | "Provider coverage may be incomplete" | `components/flights/FlightResults.tsx:197` | Provider notices | Low; honest. |
| Empty/error results | "live fare coverage may be incomplete" | `components/flights/FlightResults.tsx:201` | Provider notices | Low/medium; says live but as incomplete warning. |
| Empty/error results | "Results may not reflect round-trip inventory." | `components/flights/FlightResults.tsx:204` | None | Low; honest. |
| Empty/error results | "providers can return current fares..." | `components/flights/FlightResults.tsx:165` | Provider results | Low. |
| Empty/error results | "No current fares matched..." | `components/flights/FlightResults.tsx:172` | Provider results | Low if providers reached; can be misleading if provider failures are hidden. |
| Flight card | "Current fare" | `app/components/FlightCard.tsx:132` | `fare.price.priceCents`, `fare.price.currency` via `formatMoney` when valid | Medium; no inclusion boundary. |
| Flight card | "Price unavailable" | `app/components/FlightCard.tsx:135`, `app/components/FlightCard.tsx:245` | Money validation failure | Low. |
| Flight card | "No confirmed fare price was returned." | `app/components/FlightCard.tsx:252`, `app/components/FlightCard.tsx:265` | Money validation failure | Medium; "confirmed" is vague. |
| Flight card | "Passenger total" | `app/components/FlightCard.tsx:261` | `fare.priceScope === 'party_total'` | High; sounds complete. |
| Flight card | "Traveler fare" | `app/components/FlightCard.tsx:261` | default/per-person scope | Medium; fee inclusion unclear. |
| Flight card | "total trip price for N adults" | `app/components/FlightCard.tsx:263` | `passengerCount`, `priceScope` | High; implies full total without tax/fee/bag boundary. |
| Flight card | "per person fare for this trip" | `app/components/FlightCard.tsx:264` | `priceScope` | Medium; fee inclusion unclear. |
| Flight card CTA | "Check with {provider}" | `app/components/FlightCard.tsx:250` | `fare.source` | Low. |
| Flight card CTA note | "Opens provider search. Price and availability can change." | `app/components/FlightCard.tsx:257` | None | Low; honest. |
| Flight card CTA note | "Availability cannot be verified from this result." | `app/components/FlightCard.tsx:254` | Deeplink validation failure | Low; honest. |
| Flight card CTA | "Review paused booking" | `app/components/FlightCard.tsx:249` | Duffel internal link | Low; honest. |
| Flight card CTA note | "In-app booking is paused. Review only." | `app/components/FlightCard.tsx:256` | Duffel internal link | Low; honest. |
| Flight deal panel | "The live price is still shown above." | `app/components/FlightCard.tsx:211` | `fare.price` | Medium; "live" not visibly evidenced. |
| Baggage estimator | "Baggage fee estimate" | `components/baggage/BaggageFeeEstimator.tsx:163` | `/api/baggage` estimate | Low; clearly estimate. |
| Baggage estimator | "Estimate only..." | `components/baggage/BaggageFeeEstimator.tsx:173` | Fare carrier/cabin for cheapest visible fare | Low. |
| Baggage estimator | "Baggage fee estimate unavailable..." | `components/baggage/BaggageFeeEstimator.tsx:186` | Fetch failure | Low. |
| Baggage estimator | "do not assume checked or carry-on bag fees are included" | `components/baggage/BaggageFeeEstimator.tsx:188` | Fetch failure | Low; strong and useful. |
| Baggage estimator | "Estimated included: X carry-on, Y checked" | `components/baggage/BaggageFeeEstimator.tsx:202` | Baggage estimate | Medium; not tied to specific fare brand. |
| Baggage estimator | "Estimated add-on" | `components/baggage/BaggageFeeEstimator.tsx:209` | Converted USD estimate to `{ priceCents, currency: 'USD' }` in component | Low. |
| Baggage estimator | "Included" | `components/baggage/BaggageFeeEstimator.tsx:227` | Baggage estimate line | Medium; estimated airline-rule inclusion, not confirmed fare-brand inclusion. |
| Hotel card | "Nightly rate" | `app/components/HotelCard.tsx:54` | `hotel.pricePerNight.priceCents`, `hotel.pricePerNight.currency` | Low. |
| Hotel card | "per night before taxes and fees" | `app/components/HotelCard.tsx:59` | `hotel.pricePerNight` | Low; clear tax/fee exclusion. |
| Hotel card unavailable | "No confirmed nightly price..." | `app/components/HotelCard.tsx:107`, `app/components/HotelCard.tsx:111` | Money validation failure | Medium; "confirmed" is vague. |
| Hotel card CTA | "Check with HotelLook" | `app/components/HotelCard.tsx:264` | Valid deeplink and money | Low. |
| Hotel card CTA note | "Opens provider site. Prices can change." | `app/components/HotelCard.tsx:270` | None | Low; honest. |
| Hotel card unavailable | "Booking unavailable" | `app/components/HotelCard.tsx:280` | Deeplink/money validation failure | Low. |
| Hotel deal panel | "Usual" | `app/components/HotelCard.tsx:150` | `score.medianCents`, `score.currency` | Low/medium; not fee-inclusive, but comparison metric. |
| Hotel deal panel | "Limited hotel history... not a confirmed deal." | `app/components/HotelCard.tsx:163` | Score confidence | Low; honest. |
| Booking review | "Checkout review" | `app/book/BookingFlow.tsx:151` | None | Low. |
| Booking review | "Fare review" | `app/book/BookingFlow.tsx:86` | Parsed booking context | Low. |
| Booking review | "Current fare" | `app/book/BookingFlow.tsx:95` | `fareContext.priceCents`, `fareContext.currency` | Medium/high; no inclusion boundary. |
| Booking review | "total for N adults" | `app/book/BookingFlow.tsx:68`, `app/book/BookingFlow.tsx:97` | `fareContext.priceScope`, `passengerCount` | High; sounds complete. |
| Booking review | "per person" | `app/book/BookingFlow.tsx:69`, `app/book/BookingFlow.tsx:97` | `fareContext.priceScope` | Medium. |
| Booking review | "Price basis" | `app/book/BookingFlow.tsx:109` | Parsed booking context | Low. |
| Booking paused | "not collecting payment details..." | `app/book/BookingFlow.tsx:211` | Booking state | Low; honest. |
| Booking invalid | "integer-cent price" | `app/book/BookingFlow.tsx:253` | Booking context validation | Low; supports contract. |
| Booking active | "Confirm booking" | `app/book/BookingFlow.tsx:466` | Booking enabled | High if live; creates order but price fee boundary remains unclear. |
| Booking active | "Confirm sandbox booking" | `app/book/BookingFlow.tsx:466` | Sandbox mode | Low/medium; sandbox boundary stated nearby. |
| Booking success | "Booking confirmed" | `app/book/BookingFlow.tsx:315` | Provider booking reference | Medium; okay for sandbox-capable path, but should be visibly tied to provider response. |
| Booking success | "Order confirmed" | `app/book/BookingFlow.tsx:321` | Provider booking reference | Medium; same as above. |
| API search | "No hotels were returned for these dates." | `app/api/search/route.ts:253` | Hotel provider response | Low. |
| API search | "Enter a destination plus depart and return dates to check hotel availability." | `app/api/search/route.ts:269` | Search params | Low. |
| API book | "Fare price changed. Return to search and choose the current fare." | `app/api/book/route.ts` | Duffel offer re-fetch vs selected `priceCents`/`currency` | Low; good trust boundary. |

## Money Source Assessment

Displayed flight and hotel card amounts appear to originate from integer minor units and currency:

- `Money` is `{ priceCents: number; currency: string }` in `lib/types.ts:1`.
- `NormalizedFare.price` and `HotelOffer.pricePerNight` use `Money` in `lib/types.ts:22` and `lib/types.ts:52`.
- Shared result-card formatting uses `formatMoney(money)` in `lib/money.ts:14`, and validates integer cents in `lib/money.ts:7`.
- Duffel booking handoff includes `priceCents`, `currency`, `passengerCount`, and `priceScope` in `lib/booking/config.ts:140`.
- Booking review parses integer `priceCents` in `lib/booking/config.ts:46` and rejects malformed or non-positive values in `lib/booking/config.ts:95`.

Exception: baggage estimates are returned as USD major-unit numbers (`estimatedTotalUsd`, `totalUsd`) and converted to `{ priceCents, currency: 'USD' }` inside `components/baggage/BaggageFeeEstimator.tsx:22`. This is displayed money but not provider fare money.

## Taxes And Fees Consistency

Flights: Inconsistent and incomplete. Flight cards and booking review never state whether displayed fare amounts include taxes/fees. "total trip price" and "total for N adults" imply completeness, while baggage is separately estimated and provider copy says final price can change.

Hotels: More consistent. Hotel cards explicitly say "per night before taxes and fees" and "Prices can change." However, hotel copy does not mention resort fees, local/property-collected charges, deposits, or provider charges.

Cross-product: Inconsistent. Hotels use explicit "before taxes and fees"; flights do not have an equivalent boundary. A premium travel product should not mix those conventions.

## Availability, Confirmation, And Completeness Claims

Flagged copy:

- "Live fare scoring" and "Checking live flight inventory" imply freshness/live availability even when provider responses can be cached, missing, or unavailable.
- "No confirmed fare price..." and "No confirmed nightly price..." use "confirmed" without a visible confirmation source.
- "total trip price for N adults" and "total for N adults" imply complete pricing without a visible taxes/fees/bags/provider-charge statement.
- "Booking confirmed" and "Order confirmed" are acceptable only after provider reference, but the UI should keep provider/sandbox context prominent.

## State And Layout Observations

Loading: Flight loading states show skeleton cards and "Fare cards will appear..." without fee claims. Booking fallback says "Preparing the selected fare and recovery options"; no fee claim.

Empty/error: Flight empty states are mostly honest about no inventory or provider unavailability. Hotel skipped/empty/unavailable states are coherent. The missing fee boundary is not present in empty states because no price is displayed.

Mobile 375px static review: Result grids collapse to one column, CTA buttons are full-width/min-height, and booking submit is sticky at the bottom. No obvious text overlap from static class review. Risk remains that long provider names in "Check with {provider}" truncate, but the fee note below remains visible.

Desktop static review: Flight cards are three columns at `lg`; booking review uses a two-column layout with a sticky side form. No obvious hidden primary actions from static class review.

## Manual Verification Flow

Required manual flow:

1. Start local app.
2. Search `JFK` to `LAX`, round trip, future dates, one passenger.
3. Observe result card price text.
4. Open any internal Duffel booking/review result and compare card price text to booking review price text.

Result: Live/provider result-card verification was blocked in this sandbox. `npm run dev` failed with `listen EPERM: operation not permitted 0.0.0.0:3001`; retrying `npx next dev -H 127.0.0.1 -p 3017` failed with `listen EPERM: operation not permitted 127.0.0.1:3017`. No browser/API search could be performed against a running local app from this environment.

Static handoff verification completed:

- Result card displays `fare.price` through `formatMoney(price)` at `app/components/FlightCard.tsx:119`.
- Duffel internal handoff serializes the same `fare.price.priceCents`, `fare.price.currency`, `passengerCount`, and `priceScope` into `/book` at `lib/booking/config.ts:140`.
- Booking review displays `fareContext.priceCents` and `fareContext.currency` at `app/book/BookingFlow.tsx:96`.
- Mismatch found: display amount and basis are preserved, but result-card wording ("Passenger total" / "total trip price for N adults") and booking wording ("Current fare" / "total for N adults") still omit the same fee/tax/baggage boundary.

## Out Of Scope Findings

- `app/api/book/route.ts` calls Duffel directly from an API route. The briefing says every external API call goes through `lib/providers`. This ticket is audit-only and out of scope for provider refactor, but it is a contract conflict to track separately.
- Requested ticket files are stale/missing for this repo shape.

## Verification

- `npx tsc --noEmit --incremental false`: pass.
- `npm test -- --runInBand`: pass, 20 suites / 168 tests.
- Local manual search: blocked by sandbox port binding failure described above.
