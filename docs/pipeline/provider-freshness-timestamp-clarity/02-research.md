# UXR-PROVIDER-FRESHNESS-TIMESTAMP-CLARITY-01: Provider Freshness Timestamp Clarity

## Research Question

How should expaify expose provider identity and last-checked freshness so paid users can judge whether a flight fare or hotel rate is recent enough to trust before booking review or provider handoff?

## Current Implementation Audit

### Flight data contract

- `NormalizedFare` already carries both required trust fields: `source` and `fetchedAt` in `lib/types.ts:33`.
- Flight providers set `fetchedAt` at provider fetch time and cache the normalized result for 6 hours. Cached results therefore preserve the original checked time, which is the correct trust signal to show rather than the current page-render time.
- `app/api/search/route.ts` streams flight chunks as `{ type: 'flights', source, data }` and keeps each fare object intact through `withDateRelation`, so the UI has enough per-result metadata without another provider request.

### Flight card

- `FlightCard` derives `providerName` from `fare.source` in `app/components/FlightCard.tsx:278`, then uses it only in expanded provider handoff copy at `app/components/FlightCard.tsx:290`.
- The collapsed card price block at `app/components/FlightCard.tsx:157` shows fare amount and price scope, but not provider or freshness.
- The primary CTA aria label at `app/components/FlightCard.tsx:309` warns that price and availability can change, but it does not include who last checked the price or when.
- Expanded details include "Provider handoff" copy at `app/components/FlightCard.tsx:412`, but still omit `fare.fetchedAt`. A user must open details to see provider identity, and even then cannot evaluate freshness.

### Flight results summary

- `FlightResults` summarizes count, lowest live fare, Great deals, and nonstop options in `components/flights/FlightResults.tsx:422` and `components/flights/FlightResults.tsx:594`.
- The summary does not expose newest/oldest fetched time, stale range, or provider mix, even though those are available from `displayFlights`.
- Mobile controls compress the summary to count/sort/stops at `components/flights/FlightResults.tsx:430`; freshness is not available in the mobile decision path.

### Hotel data contract

- `HotelOffer` has `source` but no `fetchedAt` in `lib/types.ts:69`, so hotel freshness cannot be truthfully shown from the current shared type.
- `HotellookProvider.searchHotels` caches hotel offers for 6 hours in `lib/providers/hotellook.ts`, but normalized cached offers do not retain a fetch timestamp. Any UI timestamp for hotels would currently have to be invented, which violates the discovery constraint.

### Hotel card

- `HotelCard` shows nightly rate at `app/components/HotelCard.tsx:52` and review CTA at `app/components/HotelCard.tsx:203`, but neither location shows provider identity or last-checked time.
- The expanded provider handoff block at `app/components/HotelCard.tsx:267` says "Review nightly price before provider handoff", but does not name the provider or explain that final total and availability are confirmed later.
- The CTA aria label at `app/components/HotelCard.tsx:154` mentions provider confirmation, but no visible equivalent exists near the price.

## Reference Patterns

### Google Flights pattern

Google Flights separates price comparison from booking finality: it lets users track route or flight prices and notifies them when prices change significantly, rather than implying a listed price is guaranteed. The relevant interaction pattern is that price recency/change risk belongs in the same mental model as the fare, not hidden only at checkout.

Source: Google Travel Help, "Track flights & prices" (`support.google.com/travel/answer/6235879`).

### Booking.com demand pricing pattern

Booking.com's demand API pricing guidance is explicit that stored prices should be short-lived, a final preview/check should happen before confirming an order, and traveler-facing copy may need to say that final price can vary due to taxes, rounding, or policy conditions. The relevant interaction pattern is clear separation between a displayed comparison price and the provider-confirmed final price.

Source: Booking.com Developers, "Accommodation pricing guide" (`developers.booking.com/demand/docs/accommodations/prices-accommodations`).

## Exact UX Gap

The current flight UI has accurate per-fare freshness data but does not render it. The current hotel UI has provider identity data but lacks a freshness field in the normalized contract, so it cannot meet the same trust standard without a data-contract change. Both result cards place price and CTA decisions ahead of provenance, which makes the amount feel more definitive than the provider state supports.

Reference products handle this by pairing price displays with change-risk context and final confirmation rules. expaify currently has generic "prices can change" warnings, but those warnings are not specific enough because they omit the provider and last-checked timestamp.

## Design Directives

1. **Flight cards must show provider and freshness next to the price in collapsed state.** Use copy in the form `Checked <relative time> by <Provider>` under or adjacent to the fare amount. If `fetchedAt` is invalid or missing, show `Provider freshness unavailable` and keep provider name if present.

2. **Flight expanded details must include absolute timestamp and finality copy.** Add a provider/freshness row in the existing handoff detail block with copy in the form `Last checked by <Provider> on <Mon D, h:mm AM/PM>. Final price and availability are confirmed by the provider.` This must be present for internal booking review and external provider handoff.

3. **Flight results summary must expose aggregate freshness when fares exist.** In desktop summary and mobile controls summary, include one concise freshness phrase based on visible fares: `Freshest fare checked <relative time>` when all visible fares have valid timestamps, or `Some fare timestamps unavailable` when any visible fare lacks a valid timestamp. Do not replace existing count/sort/stops controls.

4. **Hotel cards must not invent freshness.** Until `HotelOffer` carries a real `fetchedAt`, show provider identity near the nightly rate as `Rate from <Provider>` and use a fallback trust line `Last-checked time unavailable`. Expanded hotel details should explicitly say `Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.`

5. **Accessibility must carry the same trust information as visible text.** Price and CTA accessible names/descriptions must include provider and freshness state. For flights, include `checked <relative time> by <Provider>`; for hotels without a timestamp, include `last-checked time unavailable`. Loading skeletons should not announce fake freshness, and unavailable price states should keep provider/freshness copy only when the underlying result contains it.

## Acceptance Checks For Downstream Stages

- A rendered flight card with `source: 'travelpayouts'` and a valid `fetchedAt` visibly answers who checked the fare and when.
- A rendered flight card with invalid or missing `fetchedAt` visibly shows a missing-freshness fallback and does not format `Invalid Date`.
- A hotel card visibly names `hotel.source` near the nightly rate and clearly states that freshness time is unavailable unless a real hotel timestamp is added upstream.
- Screen reader-accessible CTA or price context includes the same provider/freshness information visible on screen.
- At 375px width, the freshness line wraps without overlapping the price, Deal Score, or CTA.
