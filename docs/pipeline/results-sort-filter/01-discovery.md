# UXD-RESULTS-SORT-FILTER-01: Sort and Stops Filter Discoverability

## Problem Statement

First-time users miss the existing Sort and Stops controls on flight results because the controls sit inside a dense results summary panel with low visual priority, so users cannot confidently change from the default deal ranking to price ranking or narrow results by stops.

## Affected Users and Flow Step

- **Users affected:** First-time flight search users and returning users reviewing multiple fare options, especially users who care more about lowest cash price or nonstop routing than the default Deal Score ranking.
- **Flow step:** Flight results review after a search has started or returned fares.
- **Affected source:** `components/flights/FlightResults.tsx` renders the controls inside the results summary panel after the metric cards; `app/page.tsx` owns `sortBy`, `filterStops`, URL persistence, filtering, and sorting.

## Current Implementation Signal

- `FlightResults` only renders the control panel when `flights.length > 0 || isSearching`; before that, users get no preview that sorting/filtering will exist.
- The controls are below three metric cards: Lowest live fare, Great deals, and Nonstop options. These cards compete with the controls and are more visually prominent than the actual sorting/filtering actions.
- Sort and Stops use small uppercase legends and `btn-pill` controls inside a bordered summary card, while the result count appears as a separate badge. The hierarchy reads as status/metadata rather than primary result tools.
- The selected state is technically present through `aria-pressed` and an "On" status, but discovery depends on noticing compact pill groups rather than a clear "Refine results" or "Sort by" affordance.
- `app/page.tsx` correctly persists `sort` and `stops` URL state, filters by stops before sorting, and applies `sortFlights`, so the problem is discoverability and hierarchy rather than missing behavior.

## Measurable Signal

- In a first-time user walkthrough at 375px and 1280px, users should identify the sort control and stops filter before opening or scanning more than one fare card.
- Instrumentable product signal: low interaction rate with `sortBy` and `filterStops` compared with result-card clicks or outbound booking clicks, especially on searches with 3+ fares.
- Behavioral signal: users verbally report that results are "already sorted" or ask how to find nonstop/lowest-price options despite the controls being present.
- UI signal: the control group is visually subordinate to metric cards and summary text in `components/flights/FlightResults.tsx`.

## Constraints

- Preserve the existing state contract in `app/page.tsx`: `sortBy` supports `deal | price`, `filterStops` supports `null | 0 | 1`, and valid choices must continue syncing to URL query params.
- Preserve accessibility behavior: controls must remain keyboard reachable, expose selected state, and provide clear labels at mobile 375px and desktop 1280px.
- Respect expaify trust and performance priorities: no new provider calls, no result re-fetch for client-side sort/filter changes, and no misleading copy that implies filters change fare availability beyond the returned result set.

## Success Statement

This is solved when a first-time user can find and change flight results by Deal Score, lowest price, or stops immediately after results load without mistaking the controls for passive summary metadata or needing to inspect individual fare cards first.

## Handoff Notes for UXR

- Audit `components/flights/FlightResults.tsx` around the summary panel and controls.
- Audit `app/page.tsx` around URL parsing, `setSortByAndUrl`, `setFilterStopsAndUrl`, `filteredFlights`, and `displayFlights` to confirm the current behavior contract.
- Research should compare the hierarchy and interaction pattern against travel result surfaces where sort and filter controls remain persistent and visually primary during results review.
