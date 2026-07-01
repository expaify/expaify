# AUDIT-RESULTS-PRICE-BASIS-PER-TRAVELER-01

Date: 2026-06-30
Scope: price-basis language across search results, deal detail, booking review, and provider handoff surfaces.

## Executive Summary

Flight result cards and the in-app booking review mostly handle price basis correctly: provider adapters preserve integer `priceCents` plus `currency`, and the UI distinguishes `party_total` from `per_person` fares. Hotel result cards also label the visible amount as a nightly rate before taxes and fees.

The main trust gap is saved deal detail: it shows a large generic "Price" card with no required basis such as per traveler, total for passengers, per night, taxes/fees, rooms, or nights. Hotel handoff CTA/accessibility copy also drops the nightly/tax basis even though the card body has it.

## Price Surface Inventory

| Surface | File | Current user-visible copy | Inferred basis | Trust risk |
|---|---|---|---|---|
| Search form passenger selector | `app/page.tsx` | "Passengers"; "1 traveler" / "N travelers" | Search passenger count only; not a price | Low. Clear input, no price shown. |
| Search result context header | `app/page.tsx` | "N flights found ... x N passengers" | Passenger count context for results | Low. Helpful but separate from each fare basis. |
| Flight card headline price | `app/components/FlightCard.tsx` | "Passenger total" + "total trip price for N adults" when `priceScope === party_total`; "Traveler fare" + "per person fare for this trip" otherwise | Correctly distinguishes party total vs per-person trip fare | Low. Best current implementation. |
| Flight card provider CTA note | `app/components/FlightCard.tsx` | "Opens provider search. Price and availability can change." / "In-app booking is paused. Review only." | Provider handoff; basis inherited from visible card price and CTA aria label | Low. Visible basis remains nearby; aria label includes basis. |
| Flight unavailable price state | `app/components/FlightCard.tsx` | "Current fare"; "Price unavailable"; "No confirmed fare price was returned." | No usable fare basis | Low. Does not imply a price. |
| Flight Deal Score explanation | `app/components/FlightCard.tsx`; `lib/scoring/scoreDeal.ts` | Provider-derived sentence, e.g. comparison to median | Same unit as current fare and baseline history | P1. The label says Deal Score, but if a provider marks party total and baseline history is per-person, comparison can become misleading. No exact mismatch found in UI copy, but the surface does not state score basis. |
| Baggage fee estimate add-on | `components/baggage/BaggageFeeEstimator.tsx` | "Estimated add-on"; amount; included bag counts; confidence copy | Estimated extra baggage fees for selected bag counts, not included in fare | Low. Clear that this is an estimate and not included. |
| Route price alert panel | `components/flights/FlightResults.tsx`; `app/page.tsx` | "Track this route"; "Get an email when prices drop below today's level" | Uses `Math.min(...flights.map(fare.price.priceCents))` across visible fares | P1. "Today's level" does not say per person vs party total, and can mix `per_person` Travelpayouts with `party_total` Duffel/Amadeus/Kiwi for multi-passenger searches. User may set an alert on an apples-to-oranges threshold. |
| Hotel card headline price | `app/components/HotelCard.tsx` | "Nightly rate"; "per night before taxes and fees" | Per-night hotel price before taxes and fees | Low. Clear for nightly basis and taxes/fees. |
| Hotel card Deal Score usual price | `app/components/HotelCard.tsx` | "Usual"; amount; "Vs median" | Hotel baseline price per night | P1. The surrounding price card says nightly, but the score panel does not repeat "per night"; if read independently, "Usual" can look like stay total. |
| Hotel provider CTA note | `app/components/HotelCard.tsx` | "Check with HotelLook"; "Opens provider site. Prices can change." | Provider handoff for hotel nightly rate | P1. The CTA note omits that the shown amount is nightly and before taxes/fees; screen-reader aria label only says "Check [hotel] with HotelLook". |
| Hotel unavailable state | `app/components/HotelCard.tsx` | "Nightly rate"; "Price unavailable"; "No confirmed nightly price..." | No usable nightly price | Low. Correctly says nightly. |
| Hotel results loading skeleton | `app/page.tsx` | Skeleton only; no visible price copy | Pending hotel prices | Low. No misleading amount. |
| Saved deal detail price card | `app/deals/[dealId]/page.tsx` | "Price"; large amount | Unknown. `DealDetail` stores `price` and `currency`, but no required price scope, passenger count, rooms, nights, or tax/fee inclusion | P0. This is a detail/booking-handoff-adjacent surface with a dominant headline price that can be read as total trip/stay price. For hotels, user may mistake a nightly pre-tax rate for stay total. For flights, user may mistake per-person fare for party total or vice versa. |
| Saved deal detail metadata | `app/deals/[dealId]/page.tsx` | Optional labels like "Guests", "Nights", "Room type" when present | Optional context only | P1. Metadata can clarify, but it is not guaranteed and is visually subordinate to the generic price headline. |
| Saved deal detail provider CTA | `app/deals/[dealId]/page.tsx` | "Check availability with [provider]"; "Prices and availability can change." | Provider handoff | P1. Handoff caveat is present, but price basis and tax/fee basis are absent. |
| Booking review headline price | `app/book/BookingFlow.tsx` | "Current fare"; amount; "total for N adults" or "per person" | Correctly derived from `BookingFareContext.priceScope` and `passengerCount` | Low. Clear in the price box. |
| Booking review facts | `app/book/BookingFlow.tsx` | "Passengers"; "Price basis"; "Provider" | Explicit fare context | Low. Correctly reinforces basis. |
| Booking paused / error / success states | `app/book/BookingFlow.tsx` | Fare summary remains visible; status copy says review-only or stopped | Same as booking review | Low. Price basis remains visible during recovery states. |
| Booking API price validation | `app/api/book/route.ts` | Not directly visible; returns "Fare price changed" if provider amount differs | Uses Duffel `total_amount` compared to selected integer cents and currency | Low for price integrity; out-of-scope provider-boundary issue noted below. |
| Calendar cheapest days | `app/page.tsx`; `app/api/calendar/route.ts` | "$N" inside calendar day; "Cheapest days" | Travelpayouts price trend point, likely route fare in cents | P1. Tiny calendar amounts have no currency suffix, per-person/total basis, passenger count, or taxes/fees language. It is pre-search guidance, but can anchor user expectations. |

## Money Handling

Confirmed audited paths use integer cents plus currency:

- Shared contract: `Money = { priceCents: number; currency: string }` in `lib/types.ts`.
- Flight fares: `NormalizedFare.price`, plus optional `passengerCount` and `priceScope`.
- Hotel offers: `HotelOffer.pricePerNight`.
- Travelpayouts converts major units to integer cents and marks fares `per_person`.
- Duffel converts `total_amount` decimal strings to integer cents and marks fares `party_total`.
- Amadeus converts `grandTotal` decimal strings to integer cents and marks fares `party_total`.
- Kiwi converts numeric offer price to integer cents and marks fares `party_total`.
- Hotellook converts `priceFrom` major units to `pricePerNight.priceCents`.
- Booking review validates `priceCents`, `currency`, `passengerCount`, and `priceScope` before rendering.

Exact exception:

- `DealDetail` maps database `price_cents` to a field named `price` in `lib/deals/dealDetail.ts`. It remains integer minor units, but the type/name loses the explicit `priceCents` signal and has no price-basis fields.

## Manual Verification Flow

Flight flow, source-level manual verification:

1. Search form captures `passengers` and sends it through `/api/search`.
2. Providers return `NormalizedFare` with `price.priceCents`, `price.currency`, `passengerCount`, and `priceScope`.
3. `FlightCard` displays either "Passenger total / total trip price for N adults" for party-total fares or "Traveler fare / per person fare for this trip" for per-person fares.
4. Duffel in-app handoff builds `/book?...priceCents=...&currency=...&passengerCount=...&priceScope=...`.
5. `BookingFlow` displays "Current fare", repeats the basis, and includes separate "Passengers" and "Price basis" facts.

Hotel flow, source-level manual verification:

1. Round-trip search with destination and dates triggers `hotellook.searchHotels`.
2. Hotel offers render through `HotelCard` with `pricePerNight.priceCents` and `currency`.
3. The visible price says "Nightly rate" and "per night before taxes and fees".
4. Handoff opens the provider deeplink with sponsored rel attributes and a caveat that prices can change.
5. Gap: the CTA/aria handoff copy does not repeat nightly or before-tax/fee basis.

No browser/manual live-provider run was performed because the ticket is audit-only and live results depend on provider credentials and inventory. The source-level flow covers one flight path through booking review and one hotel path through provider handoff.

## Recommendations

1. P0: Add explicit price-basis copy to saved deal detail price cards. Flight details should say per person or total for N travelers when known; hotel details should say per night or stay total when known, and whether taxes/fees are included. If unknown, say "Basis not confirmed" near the headline price.
2. P0: Extend deal detail data shape to carry price basis fields instead of relying on optional metadata. Keep this narrow: do not create a new pricing model, just persist/display scope fields already used elsewhere where available.
3. P1: Update hotel CTA and aria labels to include "nightly rate before taxes and fees" when a valid price exists.
4. P1: Update route alert copy and threshold selection so it does not mix `per_person` and `party_total` prices. At minimum, copy should state the basis used for the alert threshold.
5. P1: Add basis text to the calendar cheapest-day prices, or hide amounts when the basis cannot be stated.
6. P1: Repeat "per night" in the hotel Deal Score usual/median panel.

## Blockers And Out-Of-Scope Findings

- Requested paths `components/TicketCard.tsx`, `components/TicketSlideOver.tsx`, `app/api/run/[id]/route.ts`, and `app/api/tickets/[id]/route.ts` do not exist in this worktree. Equivalent current surfaces were audited instead.
- Out of scope: `app/api/book/route.ts` calls Duffel directly. This conflicts with the "Every external API call goes through lib/providers" contract, but repairing it would change provider/booking integration and is outside this price-basis audit ticket.
- Out of scope: no provider adapters or Deal Score logic were changed.

## Verification

- `npx tsc --noEmit --incremental false`: passed.
- `npx jest --runInBand`: passed, 20 test suites and 172 tests.
- `npm test -- --passWithNoTests`: passed, 20 test suites and 172 tests.
