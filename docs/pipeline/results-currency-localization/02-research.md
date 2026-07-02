# UXR-RESULTS-CURRENCY-LOCALIZATION-01: Results Currency Localization Research

Date: 2026-07-02
Stage: UX Research
Persona: Senior UX Researcher

## Discovery Input

Source: `docs/pipeline/results-currency-localization/01-discovery.md`

Problem statement: Currency display can erode trust when flight results, hotel results, Deal Score context, and booking review do not clearly show that the visible price and comparison basis use the same currency.

## Current Implementation Audit

### Money and score contracts

- `lib/types.ts` defines `Money`, `NormalizedFare.price`, `HotelOffer.pricePerNight`, `PricePoint`, and `DealScore.currency` as separate fields. The data model preserves currency but does not expose a single "currency basis" object that links live price, score history, and booking handoff.
- `lib/money.ts` is the clearest display contract: it validates positive integer cents plus a 3-letter currency and formats as localized currency plus trailing ISO code, for example `$250 USD`.
- `lib/scoring/scoreDeal.ts` only compares history rows whose `currency` matches the current offer currency. That is the correct trust boundary. When no comparable same-currency history exists, it returns low-confidence `Typical` with copy such as "No comparable EUR price history available for this route."
- `DealScorePanel` formats the score median with `lib/money.ts`, but its visible scope copy only says `Compared with route history` or `Compared with hotel history`; it does not say the comparison is same-currency. See `app/components/DealScorePanel.tsx:16`, `app/components/DealScorePanel.tsx:80`, and `app/components/DealScorePanel.tsx:146`.

### Flight results

- `FlightCard` displays valid fare money via the shared formatter at `app/components/FlightCard.tsx:267`, so the visible fare includes the ISO code.
- The collapsed price hierarchy currently includes heading, amount, price scope, and freshness. It does not include a currency-basis sentence. See `app/components/FlightCard.tsx:267` and `app/components/FlightCard.tsx:450`.
- Expanded details include `Price scope`, `Price check`, and `Provider handoff`, but no explicit `Currency basis` row. See `app/components/FlightCard.tsx:561` onward.
- The CTA aria label includes formatted fare and provider-change copy at `app/components/FlightCard.tsx:466`, but visible users do not get the same currency reassurance unless they infer it from the amount suffix.
- Baggage estimates are formatted money too, but the baggage copy does not state whether the estimate uses the fare currency or only applies to USD-supported estimates. This matters because `components/flights/FlightResults.tsx` has USD-specific baggage logic.

### Hotel results

- `HotelCard` displays valid nightly money through the shared formatter at `app/components/HotelCard.tsx:35`, so the visible rate includes the ISO code.
- The collapsed hotel price says `per night before taxes and fees`, `Rate from {provider}`, and `Last-checked time unavailable`; this is good price-basis copy, but it still does not connect the rate currency to the Deal Score currency. See `app/components/HotelCard.tsx:43`.
- Expanded hotel details include `Price scope`, `Rate check`, and `Provider handoff`, but no currency-basis row. See `app/components/HotelCard.tsx:535` onward.
- Hotel booking review does expose a separate `Currency` fact at `app/book/BookingFlow.tsx:189`, but the result card does not preview that fact before the user chooses `Review hotel`.

### Booking review

- `BookingFlow` has a local formatter at `app/book/BookingFlow.tsx:33` instead of using `lib/money.ts`. USD displays as `$450.01`, while result cards display `$450.01 USD`. This creates a visible continuity break at the exact moment the user is asked to verify or continue.
- Flight booking review does not include a separate `Currency` fact. Its facts include route, carrier, dates, stops, passengers, price basis, and provider at `app/book/BookingFlow.tsx:139`, but not currency.
- Hotel booking review does include a separate `Currency` fact at `app/book/BookingFlow.tsx:189`.
- The verification copy correctly says Duffel rechecks price, currency, passenger count, and availability before order creation, but that copy is downstream and does not repair the inconsistent summary display.

## Reference Pattern Comparison

### Google Flights pattern

Google Flights exposes trip price context and user settings at the product level: the public Google Flights page shows language, location, and currency settings, and flight comparison relies on a clear active currency for the session. Its price-tracking surface frames price changes against selected trip dates or flexible dates rather than letting each card imply a separate comparison basis.

Interaction pattern to borrow: keep a single active currency basis visible at the comparison layer, then repeat final-provider recheck language only at the handoff point.

Source: https://www.google.com/travel/flights

### Booking.com accommodation pricing pattern

Booking.com Demand API guidance separates amount, charges, and currency. Its display guidance says partner UIs should show the order price using the provided total, clearly indicate whether taxes and charges are included, and handle differing booker/accommodation currencies explicitly. Its pricing guide also says final order preview is the authority when displayed prices differ after date, guest, or order changes.

Interaction pattern to borrow: do not make the amount carry every trust burden. Use adjacent structured facts for currency, tax/fee inclusion, and provider-confirmed final total.

Sources:
- https://developers.booking.com/demand/docs/accommodations/display-prices
- https://developers.booking.com/demand/docs/accommodations/prices-accommodations

## Exact Gap

Current code correctly preserves money data and avoids same-cents cross-currency scoring, but the UI does not make that contract legible.

| Surface | Current code does | Reference pattern does | Delta |
| --- | --- | --- | --- |
| Flight collapsed card | Shows formatted fare with ISO suffix, price scope, freshness, and score chip. | Keeps the active currency basis clear for comparison. | Add a short currency-basis line or compact fact tying fare and score to the same currency. |
| Flight expanded details | Shows score panel, price scope, price check, provider handoff. | Separates amount, currency, taxes/fees, and final recheck. | Add `Currency basis` before provider handoff; include same-currency score rule. |
| Hotel collapsed card | Shows formatted nightly rate with ISO suffix, tax/fee basis, provider, stale freshness. | Makes total/charges/currency explicit near the price. | Keep tax/fee basis, add score currency alignment copy only when score exists. |
| Hotel expanded details | Shows rate scope, rate check, provider handoff. | Exposes currency and charge basis as structured facts. | Add visible `Currency basis`; keep provider final total/taxes/fees copy separate. |
| Deal Score panel | Shows usual amount, vs usual, window, explanation. | Comparison context states what the comparison is based on. | Change scope copy from generic history to same-currency history, and state unavailable/mismatch cases plainly. |
| Booking review | Re-displays selected price; hotel has a currency fact; flight does not; local formatter omits `USD`. | Review keeps selected amount, currency, basis, and provider verification consistent. | Use one money display pattern and expose currency as a fact for both flight and hotel review. |

## Design Directives For UXDES

1. Add a `Currency basis` fact to expanded flight and hotel cards.
   - Flight copy when score exists and currencies match: `Fare, usual price, and Deal Score are shown in {CURRENCY}.`
   - Hotel copy when score exists and currencies match: `Nightly rate, usual price, and Deal Score are shown in {CURRENCY}.`
   - When score is unavailable: `Displayed price is shown in {CURRENCY}. Deal Score comparison is unavailable.`
   - When score currency differs from live price currency, do not show percentile facts; show warning copy: `Deal Score paused because {PRICE_CURRENCY} prices cannot be compared with {SCORE_CURRENCY} history.`

2. Update `DealScorePanel` scope copy to include same-currency comparison.
   - Route: `Compared with same-currency route history`
   - Hotel: `Compared with same-currency hotel history`
   - Low-confidence copy must keep the existing fewer-than-10 rule and must not claim a deal.

3. Make booking review currency display consistent across flight and hotel.
   - Use the same visible money convention as result cards: localized amount plus trailing ISO code.
   - Add `Currency` as a flight `FareFact`, matching the existing hotel `Currency` fact.
   - The selected fare/rate summary and the fact grid must show the same currency code.

4. Keep tax, fee, and final-provider recheck separate from currency copy.
   - Flight provider handoff copy must continue to say final price, availability, baggage fees, and provider terms can change.
   - Hotel provider handoff copy must continue to say final total, taxes, fees, room availability, cancellation policy, and terms are provider-confirmed.
   - Do not imply FX conversion is guaranteed unless the data contract includes conversion provenance.

5. Define mismatch and missing-history states explicitly.
   - Same-currency history present: show usual amount and vs-usual facts.
   - No comparable same-currency history: show `Usual unavailable`, `Vs usual unavailable`, and low-confidence neutral copy.
   - Currency mismatch: hide percentile/verdict confidence styling that implies a valid comparison; show a warning state and do not show `Great` or `Good`.

## Acceptance Criteria For Design Stage

- A first-time user can see, before clicking a CTA, whether the displayed result price and Deal Score are in the same currency.
- Expanded flight and hotel details include a `Currency basis` row with final copy for matched, unavailable, and mismatched score states.
- Booking review uses the same money formatting pattern as result cards and exposes a currency fact for both flights and hotels.
- Mobile 375px layout keeps currency-basis copy readable without increasing the primary price block width.
- Desktop 1280px layout keeps the price, score chip, CTA, and details button visually stable.
- No copy claims all-in hotel totals, guaranteed FX conversion, or final provider charges.

## Out-Of-Scope Notes

- This research does not ask UI or DEV to add currency conversion.
- `lib/fx/convert.ts` returns only a number and has no conversion provenance; any FX provenance feature requires a DEV-stage contract change.
- Calendar and alert money surfaces were observed but are outside this results/booking-review localization ticket.
