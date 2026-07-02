# UXDES-EMPTY-RESULTS-RECOVERY-01: Empty Results Recovery Flow

## Inputs

- Discovery: `docs/pipeline/empty-results-recovery/01-discovery.md`
- Research: `docs/pipeline/empty-results-recovery/02-research.md`
- Primary implementation surfaces:
  - `components/flights/FlightResults.tsx`
  - `app/page.tsx`
  - `app/globals.css`

## Design Goal

When a valid search returns no inventory, the results view must give the user a small set of concrete recovery actions without implying that unsearched routes, dates, or providers have available deals.

This is solved when a first-time user can recover from an empty flight or hotel result by choosing one of the visible actions: try flexible dates, search anywhere from the same origin, try a nearby airport, change hotel dates, search hotels nearby, retry an unavailable provider, or edit the search.

## Component Model

### Flight Empty Recovery

Extend the empty branch in `FlightResults` with a recovery group rendered inside `FlightStatePanel`.

Required inputs:

- Existing: `flights`, `displayFlights`, `isSearching`, `suggestion`, `providerNotices`, `dest`, `depart`, `returnDate`, `tripType`, `onEditSearch`, `onRetrySearch`, `setFilterStops`.
- Add UI-only callbacks from `app/page.tsx`:
  - `onTryFlexibleDates?: () => void`
  - `onSearchAnywhere?: () => void`
  - `onTryNearbyOrigin?: (iata: string) => void`

Implementation rule: these callbacks update existing search criteria and call the existing `runSearch` path. React components must not call external provider APIs directly.

### Hotel Empty Recovery

Add a recovery group to the hotel empty branch in `app/page.tsx`, using `ResultsStatePanel`.

Required callbacks can stay local to `app/page.tsx`:

- `Change dates`: set `view` to `form` and focus or preserve the date fields.
- `Search hotels nearby`: run the current search with the same destination/date context when a nearby-area implementation exists; for this UI-only stage, route to the form with destination preserved and copy framed as broadening the stay area.
- `Edit search`: set `view` to `form`.
- `Retry search`: call `runSearch()` only for provider-unavailable state.

## Hierarchy

Primary:

- The state title and the first recovery action. The primary action must match the reason for failure.

Secondary:

- Other recovery actions that keep the user in the same search context.
- The current route/date/passenger context.

Tertiary:

- Provider notices, passive suggestion text, and explanation copy.

The empty result panel must not compete visually with loaded result cards. Use one bordered panel plus an internal action group, not nested cards.

## State Matrix

| State | Trigger | Primary Action | Secondary Actions | Tone |
| --- | --- | --- | --- | --- |
| Flight loading | `isSearching && displayFlights.length === 0` | None | None | Default |
| Flight true no inventory | `flights.length === 0 && !isSearching && !hasProviderUnavailable && !incompleteDates` | `Try flexible dates` | `Search anywhere from <origin>`, nearby airport actions, `Edit search` | Default |
| Flight provider unavailable | flight provider notice exists, no fares | `Retry search` | `Edit search` | Warning |
| Flight filter-hidden | `flights.length > 0 && displayFlights.length === 0` | `Show all stops` | None | Default |
| Flight missing dates | `!depart` or round trip without return | `Edit search` | None | Warning |
| Hotel loading | `activeTab === 'hotels' && isSearching` | None | None | Default |
| Hotel empty | `hotelAvailability === 'empty' && hotels.length === 0` | `Change dates` | `Search hotels nearby`, `Edit search` | Default |
| Hotel unavailable | `hotelAvailability === 'unavailable'` | `Retry search` | `Edit search` | Warning |
| Hotel skipped | `hotelAvailability === 'skipped'` | `Edit search` | None | Warning |
| Search error | top-level `error` | `Retry search` | `Edit search` | Error |

## Exact UI Copy

### Flight Loading

- Eyebrow: `Flights`
- Title: `Checking live flight inventory`
- Body: `Fare cards will appear here as providers return usable prices for this search.`

### Flight True No Inventory

- Eyebrow: `Flight results`
- Title: `No current fares matched`
- Body: `No current fares matched this route and date combination. Try a broader search or change one constraint.`
- Primary button: `Try flexible dates`
- Secondary button: `Search anywhere from <origin>`
- Tertiary button: `Edit search`
- Nearby airport helper: `Search from a nearby airport`
- Nearby airport buttons: `Try <IATA>`
- Context text: `<Flight search or Flight + hotel search> · <origin> → <destination or Anywhere> · <depart> - <return> · <traveler count>`

If the current search already has `flexDates === true`, replace the primary button with `Edit dates` and keep `Search anywhere from <origin>` secondary.

If destination is already empty, hide `Search anywhere from <origin>` because the search is already in anywhere mode.

### Flight Provider Unavailable

- Eyebrow: `Flight results`
- Title: `Flight providers unavailable`
- Body: `No flight provider returned usable inventory. Try again shortly or adjust the trip details.`
- Primary button: `Retry search`
- Secondary button: `Edit search`

Provider notices remain below the body as passive text. Do not show date or route alternatives above retry in this state.

### Flight Filter-Hidden

- Eyebrow: `Flight results`
- Title: `Filters are hiding the available fares`
- Body: `Clear the stops filter or choose All to review the fares returned for this search.`
- Primary button: `Show all stops`

### Flight Missing Dates

Departure missing:

- Eyebrow: `Flight results`
- Title: `Dates needed for a complete search`
- Body: `Add a departure date so providers can return current fares and Deal Scores can be compared honestly.`
- Primary button: `Edit search`

Round-trip return missing:

- Eyebrow: `Flight results`
- Title: `Dates needed for a complete search`
- Body: `Add a return date for round-trip pricing, or switch to one way before searching again.`
- Primary button: `Edit search`

### Hotel Empty

- Eyebrow: `Hotel results`
- Title: `No hotels returned for these dates`
- Body: `No hotels were returned for these dates. Change the stay dates or broaden the hotel search area.`
- Primary button: `Change dates`
- Secondary button: `Search hotels nearby`
- Tertiary button: `Edit search`
- Context text: `<Hotel search or Flight + hotel search> · <origin> → <destination> · <depart> - <return> · <traveler count>`

### Hotel Provider Unavailable

- Eyebrow: `Hotel results`
- Title: `Hotels unavailable`
- Body: `The hotel provider is unavailable right now. Hotel inventory was not confirmed for this search.`
- Primary button: `Retry search`
- Secondary button: `Edit search`

### Hotel Skipped

Destination missing:

- Eyebrow: `Hotel results`
- Title: `Hotel destination needed`
- Body: `Add a destination to check hotel availability.`
- Primary button: `Edit search`

Dates missing or one-way trip:

- Eyebrow: `Hotel results`
- Title: `Hotel dates needed`
- Body: `Add departure and return dates to check hotel availability.`
- Primary button: `Edit search`

## Interaction Rules

### Try Flexible Dates

On click or keyboard activation:

1. Preserve `origin`, `dest`, `depart`, `returnDate`, `passengers`, and `tripType`.
2. Set `flexDates` to `true`.
3. Trigger `runSearch(nextCriteria, { updateUrl: true, activeTab: 'flights' })`.
4. Keep the user in the results view and show the existing loading state.

If required dates are missing, do not run search; switch to form view and rely on existing date validation.

### Search Anywhere From Origin

On click or keyboard activation:

1. Preserve `origin`, `depart`, `returnDate`, `passengers`, `tripType`, and `flexDates`.
2. Clear `dest` and `destDisplay`.
3. Trigger `runSearch(nextCriteria, { updateUrl: true, activeTab: 'flights' })`.
4. Hide this action when `dest` is already empty.

Copy must not say that deals exist elsewhere. The action is a broader search, not a recommendation.

### Try Nearby Airport

On click or keyboard activation:

1. Use IATA codes parsed from the current `suggestion` string only when they match `\b[A-Z]{3}\b`.
2. Replace `origin` and `originDisplay` with the selected IATA.
3. Preserve the current destination and dates.
4. Trigger `runSearch(nextCriteria, { updateUrl: true, activeTab: 'flights' })`.

If parsing yields no IATA codes, hide the nearby airport group and keep the passive suggestion text.

### Change Dates

On click or keyboard activation:

1. Switch to form view.
2. Preserve origin, destination, trip type, passengers, and current dates.
3. Set intent to `hotels` when the active tab is hotels.
4. Place focus on the departure date input when implementation can do so without replacing existing form contracts.

### Search Hotels Nearby

For the UI-only implementation, this action should broaden the visible task without inventing supply:

1. Switch to form view.
2. Preserve destination and dates.
3. Keep search intent as `hotels` or `trip`.
4. Use helper copy in the panel, not a provider-backed claim.

If a later DEV ticket adds structured nearby hotel areas, this action may trigger a search through `/api/search` with provider-backed parameters.

### Retry Search

On click or keyboard activation:

1. Call the existing `runSearch()` path.
2. Keep the same criteria.
3. Keep the same active tab.

Retry is primary only for provider-unavailable or top-level search-error states.

## Layout Specification

### Panel Structure

Use the existing `FlightStatePanel` and `ResultsStatePanel` visual language. Required structure:

1. Eyebrow.
2. Title.
3. Body copy.
4. Current search context, in smaller muted text.
5. Recovery action group.
6. Passive provider/suggestion detail.

Suggested class pattern for the internal action group:

```tsx
<div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:flex lg:flex-wrap">
```

Primary action:

```tsx
className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm lg:w-auto"
```

Secondary action:

```tsx
className="btn-pill min-h-11 w-full justify-center px-4 py-2.5 text-sm lg:w-auto"
```

Nearby airport group:

```tsx
<div className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] p-3">
  <p className="text-xs font-bold text-[var(--text-2)]">Search from a nearby airport</p>
  <div className="mt-2 flex flex-wrap gap-2">
```

Use only existing design tokens from `app/globals.css`: `--bg-base`, `--bg-surface`, `--bg-raised`, `--border`, `--brand`, `--brand-soft`, `--warning`, `--warning-soft`, `--error`, `--error-soft`, `--text-1`, `--text-2`, `--text-3`, `--radius-card`, `--radius-control`, `--shadow-card`, and `--focus-ring`.

Do not add new colors, shadows, or radius tokens.

## Responsive Requirements

### Mobile 375px

- Panel uses one column.
- All action buttons are full width with `min-h-11`.
- Nearby airport buttons wrap; no horizontal scrolling inside the panel.
- Search context may wrap across lines; do not truncate essential route/date text inside the empty panel.
- Body copy max width remains natural; no text overlaps the action column.
- The action group appears below body copy, not beside it.

### Desktop 1280px

- Panel may use the existing two-column shell with text left and action group right.
- Action group can wrap horizontally but must keep primary action first in DOM and visual order.
- Nearby airport group spans the content width below primary recovery actions.
- Existing tabs, share button, and footer remain unchanged.

## Accessibility Requirements

- Empty panels use `role="status"` except top-level search errors, which use `role="alert"`.
- Provider-unavailable warning panels may remain `role="status"` to avoid interrupting screen readers for recoverable state changes.
- Buttons must be native `<button type="button">`.
- All recovery actions must be reachable by Tab in this order: primary action, secondary action, tertiary action, nearby airports in listed order.
- Use visible focus from the global `:focus-visible` and `--focus-ring`; do not remove outlines.
- Add `aria-describedby` only when a button needs extra context, such as nearby airport helper text.
- The loading state must not steal focus.
- After a recovery action triggers a search, do not programmatically focus skeleton cards.

## Edge Cases

- If `suggestion` contains no valid IATA code, render it as passive text only.
- If `suggestion` contains duplicate IATA codes, show each code once.
- If `origin` is missing or invalid, do not render recovery search actions; show `Edit search`.
- If `depart` is missing, do not render `Try flexible dates`.
- If `tripType === 'roundtrip'` and `returnDate` is missing, do not render `Try flexible dates`.
- If `dest` is empty, hide `Search anywhere from <origin>`.
- If hotel search is skipped because destination or round-trip dates are missing, show only `Edit search`.
- If both flights and hotels are empty in a `trip` search, each active tab owns its own recovery copy; do not show a combined empty state.
- If a provider returns partial results and later notices, do not replace loaded result cards with empty recovery.

## Acceptance Criteria

1. Flight true no-inventory state shows `Try flexible dates`, `Search anywhere from <origin>` when applicable, and `Edit search`.
2. Flight nearby-airport suggestions render as individual `Try <IATA>` buttons when valid IATA codes can be parsed.
3. Flight provider-unavailable state keeps `Retry search` as the primary action and does not prioritize route/date alternatives.
4. Flight filter-hidden state still provides `Show all stops`.
5. Hotel empty state shows `Change dates`, `Search hotels nearby`, and `Edit search`.
6. Hotel skipped state shows only the missing-detail copy and `Edit search`.
7. All recovery actions are native buttons, keyboard reachable, and visible at 375px and 1280px.
8. Recovery actions reuse existing criteria state and `/api/search`; no component calls an external travel provider directly.
9. Empty-state copy avoids claims that unsearched dates, routes, hotels, or providers have available deals.

## Handoff

Create `UI-EMPTY-RESULTS-RECOVERY-01`.

No DEV ticket is required for the first implementation because the recovery actions can be derived from current client state and the existing `/api/search` flow. A future DEV ticket is recommended if the team wants structured recovery options in the NDJSON contract instead of parsing nearby airport codes from the suggestion string.
