# UX Discovery: Flight Duration and Layover Certainty

## User Pain Point

Flight results expose price, Deal Score, departure context, and stop count, but they do not make total travel time or layover burden explicit enough for paid users to judge whether a cheap fare is actually worth booking.

## Who Is Affected And Where

First-time and returning paid-intent users are affected on the flight results step, especially when comparing similarly priced fares after search. The affected surface is the result list and expanded flight card details, where users can currently see route, carrier, trip type, stop count, departure or return date/time, price, and Deal Score, but cannot quickly tell whether the itinerary is a short one-stop option, an overnight connection, a long elapsed trip, or a fare with hidden connection risk.

## Measurable Signal

- `lib/types.ts` defines `NormalizedFare` with `depart`, optional `return`, and aggregate `stops`, but no normalized duration, arrival time, layover city, layover duration, segment list, or uncertainty flag.
- `app/components/FlightCard.tsx` renders a `StopsChip`, departure time, and expanded schedule items, but the visible hierarchy never states total elapsed travel time or layover burden.
- `components/flights/FlightResults.tsx` summarizes lowest fare, Great deal count, and nonstop count, while sort and filter controls only support price, Deal Score, and stop count; users cannot sort or scan by duration or connection burden.
- Provider adapters already receive richer timing structures in some responses, such as Duffel slice `departing_at` and `arriving_at`, Kiwi `local_departure` and `local_arrival`, and Amadeus segment arrival/departure timestamps, but the normalized fare contract discards most of that context.

## Constraints

1. Preserve trust in Deal Score: duration and layover copy must not imply a cheap fare is a good deal when the route history score is low confidence or unavailable.
2. Preserve provider correctness: duration and layover data must come through `lib/providers` and the shared normalized contract; UI must not infer vendor-specific details from raw provider payloads.
3. Preserve scanability and accessibility at 375px mobile and 1280px desktop: added travel-time context must not crowd price, Deal Score, CTA, or focusable controls.

## Success Statement

This is solved when a first-time user can compare flight results and identify the cheapest fare that is still acceptable by total travel time and layover burden without opening a provider page to discover that the itinerary is materially longer or riskier than the card suggested.
