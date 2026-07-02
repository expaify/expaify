# UX Research: Airport Selection Disambiguation

## Inputs

- Discovery: `docs/pipeline/airport-selection-disambiguation/01-discovery.md`
- Current surface audited: `app/page.tsx`, `app/components/AirportInput.tsx`, `app/api/airports/route.ts`, `lib/airports/resolve.ts`, `lib/airports/nearby.ts`, `lib/types.ts`
- Reference patterns: Google Flights help says users can enter a departure city or airport, and separate Google guidance for multi-airport search requires explicit multiple-airport entry or a nearby-airports picker before adding those airports to the search entry.

## Current Implementation

`AirportInput` is used for both `From` and `To` in the main search form (`app/page.tsx:1119`, `app/page.tsx:1140`). The component stores two values through its contract: a concrete `iata` value used by search and a `display` value shown to the user. When a user types manually, the submitted IATA is cleared while the display text remains (`app/components/AirportInput.tsx:94`). Search submission blocks manually typed unresolved text with copy that asks the user to choose a valid airport from the list (`app/page.tsx:702`, `app/page.tsx:708`).

The dropdown rows show `iata`, `city`, `name`, and `country`, but every row is an individual airport option with no city-level grouping, no primary/secondary airport hierarchy, no distance/proximity context, and no "all nearby airports" scope (`app/components/AirportInput.tsx:191`). For an ambiguous query such as "New York", rows can present multiple airports with the same city label; the user must infer the difference from the airport name.

Keyboard behavior can still silently collapse ambiguous text into one airport. If the dropdown is closed or has no loaded results, pressing Enter fetches suggestions and selects the first result (`app/components/AirportInput.tsx:106`, `app/components/AirportInput.tsx:138`). That turns a city string into a specific IATA without requiring the user to inspect or confirm all plausible matches.

The lookup API ranks exact IATA matches first, then prefix IATA, then exact city, then prefix/contains city, then airport-name contains. Ties sort alphabetically by IATA (`app/api/airports/route.ts:79`, `app/api/airports/route.ts:95`). This is deterministic, but it is not an intent model. It does not mark one airport as primary, group same-city airports, or distinguish a city match from an airport match in the response type (`lib/types.ts:62`, `lib/types.ts:69`).

Shared-link parsing is a second ambiguity path. `parseInitialSearchParams` calls `resolveToIATA` for raw `origin` and `dest` query params (`app/page.tsx:214`, `app/page.tsx:222`). `resolveToIATA` accepts a city exact match or city prefix match and returns the first `AIRPORTS` entry (`lib/airports/resolve.ts:67`, `lib/airports/resolve.ts:71`). ZIP codes also resolve through a hardcoded single-airport map (`lib/airports/resolve.ts:14`, `lib/airports/resolve.ts:61`). The parsed display value is then set to only the IATA code (`app/page.tsx:266`), so a link with `origin=New York` can become `JFK` without surfacing that conversion as an ambiguity.

Nearby-airport logic exists but is not visible in the form. `getNearby` returns airports within a distance threshold from a selected IATA (`lib/airports/nearby.ts:22`), but `AirportInput` does not expose that scope and search still submits one origin code and one destination code.

## Reference Pattern Comparison

Google Flights separates the concept of "city or airport" entry from the selected search geography. Its documented flow lets users enter a city or airport, and its multi-airport guidance requires users to enter multiple airport codes or use a nearby-airports control before those airports are added. The important interaction pattern is explicit scope: a city-like query is not treated as the same thing as one airport without visible selection feedback.

Compared with that pattern, expaify already has the right low-level contract for concrete provider searches: search submits IATA codes, and vendor calls remain downstream of the form. The gap is pre-search transparency. Expaify lets several paths resolve broad geography into one airport without showing whether the final scope is "JFK only", "LaGuardia only", "New York area", or a ZIP-derived nearest major airport.

Booking-style travel flows also generally keep airport name/code visible after selection and make multi-airport itinerary risk visible in itinerary details. For expaify, the relevant lesson is not visual styling; it is that airport geography is booking-critical data and should be explicit before a paid user starts a result-generating search.

## Exact Gap

Current code does:

- Suggests individual airport rows for ambiguous city queries.
- Auto-selects the first suggestion on Enter when results are not already open or loaded.
- Resolves shared-link city/prefix/ZIP values to a single IATA before rendering the form.
- Saves and displays recent searches using the already-collapsed `originDisplay` and `destDisplay`.
- Sends one concrete IATA per side to `/api/search`, which is correct for current provider contracts.

Reference pattern does:

- Makes city/airport scope explicit before search.
- Treats nearby or multiple-airport search as an explicit user choice.
- Keeps selected airport codes visible in the search entry.
- Avoids relying on alphabetical first match as the user's intended geography.

Delta:

- Expaify needs a visible disambiguation state between typed text and final IATA submission for ambiguous city, ZIP, and shared-link values.
- Expaify needs copy that states the actual search scope: one airport now, nearby airports only if explicitly selected later.
- Expaify should not launch a search from ambiguous typed text via Enter unless the selected airport row is visible and highlighted.

## Design Directives

1. **Require visible selection for ambiguous city input.** When a query returns two or more airports with the same city or metro label, show a grouped choice headed by the city name and individual airport rows under it. Pressing Enter on raw typed text such as `New York`, `London`, `Chicago`, `Dallas`, `Washington`, `Los Angeles`, `Paris`, `Tokyo`, or `Bay Area` must open or keep focus in the suggestion list; it must not call `selectFirstMatch` unless the user has an actual highlighted airport row visible. Test: type `New York`, press Enter before clicking; no IATA should be submitted until a visible row is selected.

2. **Display final search scope under each selected input.** After selection, show helper text below the field using exact copy: `Searching JFK only.` For a ZIP-derived or shared-link-derived value, use: `Resolved to JFK. Review before searching.` If the selected airport has nearby alternatives available, add a secondary action copy: `Nearby airports available` without changing the submitted IATA. Test: selecting JFK from `From` shows `Searching JFK only.` before the Search button is pressed.

3. **Differentiate exact airport rows from city-match rows.** Each suggestion row must keep the IATA code as the primary fixed-width token, airport name as the primary label, and city/country as secondary metadata. For same-city groups, the group header must say `New York airports` and each row must remain a concrete airport choice, e.g. `JFK`, `LGA`, `EWR`. Do not label an individual row as `New York` without also showing the airport name and code. Test: a same-city result list makes it possible to distinguish JFK from LGA and EWR at 375px width without horizontal scrolling or overlapping text.

4. **Surface shared-link ambiguity before automatic search.** If URL params contain a raw city, prefix city, or ZIP that `resolveToIATA` converts, the form should render in review mode instead of immediately treating the route as confidently selected. The selected code may be prefilled, but the display must include the resolved helper copy and the user must still see the form before results launch. Test: opening `/?origin=New%20York&dest=London` shows selected codes plus review copy before any network search to `/api/search`.

5. **Keep provider and data contracts unchanged for this feature.** UI may request airport suggestions from `/api/airports`, but no component may call travel vendors. `/api/search` should continue receiving concrete IATA strings until a separate approved feature adds multi-airport provider fanout. Test: resulting search criteria contains `origin: "JFK"` rather than a city string or array unless a future DEV ticket explicitly changes provider logic.

## QA Acceptance Criteria For Design Stage

- Design spec covers default, loading, no matches, lookup error, ambiguous multi-airport, selected airport, ZIP/shared-link resolved, mobile 375px, desktop 1280px, keyboard, blur, and screen-reader status states.
- Design spec includes exact visible copy for single-airport scope and resolved-link review.
- Design spec defines Enter-key behavior separately for closed dropdown, open dropdown with results, open dropdown with no results, and highlighted option.
- Design spec preserves current app rule that manually typed unresolved text blocks search with an error.
- Design spec does not imply city-wide or nearby-airport search unless the selected scope actually includes those airports.

## Risks

- If the API response type remains only `AirportLookupAirport[]`, UI grouping must infer ambiguity from repeated city names. That is workable for UI-only implementation but brittle for metro labels that span cities, such as EWR/New York or Bay Area airports.
- A full "search all nearby airports" experience would require provider fanout, result dedupe, scoring clarity, and cache-key changes. That is out of scope for this UXR ticket and should be a separate approved DEV feature if pursued.
- The existing tests for `AirportInput` assert Enter selects the highlighted airport. That remains valid when the list is open and a row is highlighted, but new tests should also cover the closed-dropdown ambiguous Enter path.

## Handoff

Create `UXDES-airport-selection-disambiguation-01` for an interaction design spec that turns these directives into implementation-ready states, copy, and Tailwind patterns.
