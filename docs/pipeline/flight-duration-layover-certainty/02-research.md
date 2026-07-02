# UX Research: Flight Duration and Layover Certainty

## Inputs

- Discovery: `docs/pipeline/flight-duration-layover-certainty/01-discovery.md`
- Affected surfaces audited: `lib/types.ts`, `app/components/FlightCard.tsx`, `components/flights/FlightResults.tsx`, `lib/search/sortFlights.ts`, `app/api/search/route.ts`, and flight provider adapters in `lib/providers/`.
- Reference patterns: Google Flights help says users can reorder by Top Flights, Price, Duration, and Departure Time, with Top Flights balancing price, duration, stops, and airport changes during layovers. SAP Concur's flight-shopping documentation describes sortable result dimensions including Duration, Price, Departure and Arrival Times, Stops, and Advisory.

## Current Implementation Audit

The normalized fare contract blocks certainty before UI work begins. `NormalizedFare` currently exposes `depart`, optional `return`, aggregate `stops`, carrier, price, and provider metadata, but it has no total elapsed duration, arrival timestamp for the outbound leg, segment list, layover airport, layover duration, overnight flag, airport-change flag, or data-confidence flag (`lib/types.ts:33`). This means UI cannot distinguish a reasonable one-stop itinerary from a long or risky connection without guessing.

`FlightCard` gives stop count and departure time primary-card visibility (`app/components/FlightCard.tsx:332`) and adds schedule chips inside expanded details (`app/components/FlightCard.tsx:419`). Those details only show depart and return values, not arrival, total elapsed time, layover city, connection length, or whether the timing is provider-confirmed. The expanded trust copy focuses on Deal Score and provider handoff (`app/components/FlightCard.tsx:396`, `app/components/FlightCard.tsx:409`), so itinerary burden is not represented at the same decision level as price and score.

`FlightResults` supports result-level stats and controls for price/deal-oriented comparison plus stop filtering. The current dirty worktree has an additional baggage-cost sort label, but there is still no duration sort or layover-risk filter in the result-control contract (`components/flights/FlightResults.tsx:11`, `components/flights/FlightResults.tsx:58`). Mobile controls expose sort and stops only (`components/flights/FlightResults.tsx:430`). The visible summary counts cheapest fare, Great deals, and nonstop options (`components/flights/FlightResults.tsx:504`), but does not summarize fastest fare, shortest acceptable one-stop, or long-layover burden.

`sortFlights` confirms that ranking has no travel-time dimension. The fallback comparator orders by currency, price, stops, departure time, carrier, and id (`lib/search/sortFlights.ts:14`), while the public sort type only accepts `price` or `deal` (`lib/search/sortFlights.ts:3`). If two fares have the same price and stop count, a 6-hour itinerary and a 19-hour itinerary would sort as equivalent until departure time or carrier breaks the tie.

Provider adapters already see richer timing data but discard it. Duffel slices include `departing_at`, `arriving_at`, and `segments`, but normalization keeps only first departure, total stops, and optional final return arrival (`lib/providers/duffel.ts:21`, `lib/providers/duffel.ts:193`). Amadeus segments include departure and arrival airport/time fields, but normalization reduces them to first departure, destination, and aggregate stops (`lib/providers/amadeus.ts:17`, `lib/providers/amadeus.ts:213`). Kiwi offers include local departure, local arrival, route, stopover, and transfers, but normalization keeps only departure, transfer count, and optional final route arrival (`lib/providers/kiwi.ts:22`, `lib/providers/kiwi.ts:191`). Travelpayouts types include `duration` on some v1 shapes, but normalized fares do not preserve it (`lib/providers/travelpayouts.ts:33`, `lib/providers/travelpayouts.ts:233`).

## Reference Pattern Delta

Google Flights treats duration as a first-class comparison dimension, not an expanded-detail extra. Its documented sort model includes Duration alongside Price and Departure Time, and its default "Top Flights" concept balances price against convenience factors such as duration, number of stops, and airport changes during layovers.

SAP Concur uses a similar shopping model for high-stakes business travel: Duration is explicitly defined as elapsed travel time and is available next to price, departure/arrival times, stops, and advisory signals. The notable pattern is that itinerary burden is both sortable and scannable before selecting a flight.

The expaify delta is not visual polish. The product has a strong Deal Score story, but price/value confidence is incomplete because users cannot see the time cost of the fare. Current UI asks users to trust a cheap result before showing whether the itinerary is materially worse.

## Exact Gap

- Current code: normalizes `stops` only and discards provider segment timing, arrival, and connection details.
- Reference pattern: makes elapsed duration and connection burden available in the primary comparison model.
- Delta: expaify cannot truthfully render or sort by duration/layover certainty until the shared fare contract carries provider-normalized itinerary details and a clear uncertainty state.

## Design Directives

1. Primary card scan row must include a travel-time summary when data is confirmed: `Total 7h 45m`, followed by the existing stops label and departure time. If total duration is unknown, show `Duration unavailable` only in secondary/tertiary styling, never as a confident estimate.

2. One-stop and multi-stop fares must expose layover burden in expanded details with exact copy rules: confirmed single connection uses `Layover: ATL, 1h 35m`; confirmed multiple connections uses `Layovers: ATL 1h 35m, CDG 2h 10m`; missing segment data uses `Layover details unavailable from provider`.

3. Add an itinerary certainty state to the normalized contract before UI implementation. Required states: `confirmed` when total duration and each segment boundary are provider-normalized, `partial` when only aggregate stop count or total duration is known, and `unavailable` when neither duration nor layover detail is available. UI must not infer layovers from `stops` alone.

4. Result controls must add a duration-aware comparison path once data exists: desktop gets `Shortest duration` as a sort option; mobile filter summary must include the active duration sort text without truncating the selected stop filter at 375px. If fewer than two visible fares have confirmed duration, disable that sort and explain `Duration sort needs confirmed itinerary times`.

5. Deal Score hierarchy must stay price-first but disclose tradeoff. A Great/Good fare with partial or unavailable itinerary data should add a tertiary caution line in details: `Deal Score is based on price history; itinerary duration was not confirmed by the provider.` Do not downgrade Deal Score verdict purely because duration is unknown.

## Acceptance Checks For UXDES

- Design spec covers default, loading, empty, error, mobile 375px, desktop 1280px, keyboard focus, and provider-missing timing data.
- Spec defines where duration appears on the collapsed card without crowding price, Deal Score, and CTA.
- Spec defines exact copy for confirmed, partial, and unavailable itinerary timing.
- Spec does not ask UI to derive segment or layover facts from raw provider payloads.
- Spec preserves existing price and Deal Score trust language while adding itinerary certainty as a separate signal.

## Sources

- Google Travel Help, "Find plane tickets on Google Flights": https://support.google.com/travel/answer/2475306?hl=en
- SAP Concur Travel documentation, "Flight Search Results Page - Shop by Fares Tab": https://help.sap.com/docs/CONCUR_TRAVEL/794f91a25fbb4b708362c9b0df9f723b/c43bb2fa51c310159ddcc8b1519c2583.html
