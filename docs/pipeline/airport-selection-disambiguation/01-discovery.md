# UX Discovery: Airport Selection Disambiguation

## User Pain Point

Paid users can start a flight or trip search for the wrong geography because the airport input treats city names, airport codes, ZIP-derived airports, and nearby alternatives as single airport selections without enough confirmation when multiple airports plausibly match.

## Who Is Affected And Where

Affected users are first-time and paid users entering an origin or destination in the search form before results load, especially in multi-airport metros such as New York, London, Chicago, Dallas, Washington, Los Angeles, Paris, Tokyo, and Bay Area routes.

The risk occurs at the route-entry step in `app/page.tsx`, where `AirportInput` powers both `From` and `To` fields. Users can choose from suggestions, press Enter to accept the first suggestion, use a shared URL with raw city values, or rely on ZIP/city resolution before the app searches.

## Measurable Signal The Problem Exists

- The airport suggestion rows show code, city, airport name, and country, but no explicit multi-airport grouping, proximity context, or "city vs airport" distinction; for New York, the list can show `JFK`, `LGA`, and `EWR` as separate rows with the same city label, leaving the user to infer geography from airport names alone (`app/components/AirportInput.tsx:191`).
- Pressing Enter when the dropdown is closed or empty fetches suggestions and selects the first airport automatically, so a typed city can become a specific airport without an explicit selection click or confirmation (`app/components/AirportInput.tsx:106`, `app/components/AirportInput.tsx:138`).
- Airport lookup sorts exact city matches by score and then IATA alphabetically, not by traveler intent, metro coverage, distance, or primary airport status; this means a city query can elevate one airport as the default without explaining the tradeoff (`app/api/airports/route.ts:79`, `app/api/airports/route.ts:95`).
- URL parsing and fallback resolution convert exact or prefix city names to the first matching airport in `AIRPORTS`, and ZIP codes use a hardcoded single-airport mapping; both flows lose ambiguity before the user sees results (`lib/airports/resolve.ts:14`, `lib/airports/resolve.ts:61`, `lib/airports/resolve.ts:68`).
- Nearby-airport capability exists as `getNearby`, but the current search-entry flow does not surface nearby alternatives or clarify whether the user is searching one airport or a broader area (`lib/airports/nearby.ts:22`, `app/page.tsx:1119`, `app/page.tsx:1140`).

## Constraints The Solution Must Respect

1. Preserve search correctness and provider contracts: downstream search must still receive concrete IATA airport codes, and no component may call external travel vendors directly.
2. Preserve speed and usability at the form step: suggestions must remain responsive, keyboard-accessible, screen-reader understandable, and usable at 375px mobile and 1280px desktop.
3. Preserve trust and data integrity: the UI must not imply that a city-wide search is happening when only one airport code will be sent, and it must not silently swap or expand geography without making the selected airport or nearby scope visible.

## Success Statement

This is solved when a first-time paid user can enter a city, airport code, ZIP, or shared-link route and confidently see which exact airport geography will be searched before submitting, without accidentally launching an expensive search for the wrong airport or nearby alternative.
