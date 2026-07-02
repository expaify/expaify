# UXD-EMPTY-RESULTS-RECOVERY-01: Empty Results Recovery Flow

## Problem Statement

When a flight or hotel search returns zero inventory, expaify tells the user that nothing matched but does not provide actionable route suggestions or date alternatives, leaving first-time users unsure how to recover.

## Affected Users And Flow Step

- **Users affected:** First-time deal seekers and flexible travelers who submit a valid origin, optional destination, and dates but receive no live inventory from providers.
- **Flow step:** Results view after search submission, specifically the flight results empty state and hotel results empty state.
- **Current surfaces inspected:** `components/flights/FlightResults.tsx` handles flight empty states; `app/page.tsx` handles the shared `ResultsStatePanel`, hotel availability copy, tabs, and hotel empty state.

## Current Behavior Observed

- Flight zero-results states currently resolve to broad messages such as "No flight inventory found" with a single primary action to edit the search.
- Flight provider failures can show "Retry search", and stop filters have a useful recovery action, "Show all stops".
- Hotel zero-results states currently use "No hotel inventory found" and a single "Edit search" action.
- The page already computes a `resultContext` summary, but the empty states do not turn that context into concrete next steps.
- The destination suggestion prop in `FlightResults` can show extra text, but the empty state does not expose structured alternatives such as nearby dates, nearby routes, or "search anywhere" recovery cards.

## Measurable Signal

This problem exists when a completed search reaches any of these conditions and the visible recovery path remains generic:

- `flights.length === 0 && !isSearching && activeTab === 'flights'`
- `hotels.length === 0 && !isSearching && activeTab === 'hotels'`
- `hotelAvailability === 'empty'`
- `displayFlights.length === 0` because no inventory matched the route/date combination, not because a stop filter hid available fares

Primary measurable UX signal: zero-result sessions have no in-page recovery click target beyond "Edit search" or "Retry search", so users must infer the next query themselves.

## Constraints

1. **Trust and data integrity:** Do not imply inventory exists for dates, routes, or providers that were not searched. Suggestions must be framed as recovery options, not confirmed deals.
2. **Performance:** Empty-state recovery must not introduce extra provider calls from React components; any future live data must remain behind `lib/providers` and existing API routes.
3. **Accessibility and responsive usability:** Recovery actions must be keyboard reachable, screen-reader clear, and usable at 375px mobile and 1280px desktop without overlapping text or hidden controls.

## Success Statement

This is solved when a first-time user can recover from a zero-result flight or hotel search by choosing a clear next action, such as changing dates, trying a nearby or suggested route, searching anywhere, or retrying provider availability, without hitting a dead-end empty results panel.

## Downstream Focus

The next stage should determine the exact recovery hierarchy and candidate alternatives. Research should evaluate whether the empty state should prioritize date flexibility, route alternatives, provider retry, or saved alerts based on the current code paths and travel search conventions.
