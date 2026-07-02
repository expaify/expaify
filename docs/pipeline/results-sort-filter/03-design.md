# UXDES-RESULTS-SORT-FILTER-01: Sort and Stops Filter Discoverability

## Source Inputs

- Discovery: `docs/pipeline/results-sort-filter/01-discovery.md`
- Research: `docs/pipeline/results-sort-filter/02-research.md`
- Current result surface: `components/flights/FlightResults.tsx`
- State and URL contract: `app/page.tsx`
- Design tokens: `app/globals.css`
- Next.js references read: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`

## Design Goal

Promote flight result refinement from low-priority summary metadata to a primary result toolbar so first-time users can immediately sort by deal or price and filter by stops before scanning fare cards.

This is a UI-only design. Do not change provider calls, scoring, data models, search APIs, cache behavior, or result fetching.

## Preserved Contracts

- `sortBy` remains exactly `'deal' | 'price'`.
- `filterStops` remains exactly `null | 0 | 1`.
- Default sort remains `deal`; default stops remains `null`.
- `sort=price` persists in the URL; default deal sorting may remain omitted.
- `stops=0` and `stops=1` persist in the URL; all stops may remain omitted.
- Stops filtering happens before sorting.
- Sort and stops changes act only on returned fares. They must not trigger a new provider search.
- Existing props and exports in `FlightResults` must be preserved.

## Information Hierarchy

Primary:
- Toolbar title: "Refine flight results"
- Result scope: "Showing X of Y fares"
- Sort segmented control
- Stops segmented filter

Secondary:
- Live status sentence describing selected sort, selected stops, and score ranking updates.
- Metric cards: Lowest live fare, Great deals, Nonstop options.

Tertiary:
- Provider notices, route tracking, baggage estimator, and alert signup remain separate supporting content.

The first interactive controls after fares load must be Sort and Stops. Metric cards must appear below the toolbar or in a visually secondary area after the refinement controls.

## Layout Specification

### Toolbar Container

Use a single promoted toolbar above metric cards and above the fare grid.

Required structure:
- Outer container: bordered raised surface.
- Top row: title and result count.
- Control area: Sort group and Stops group.
- Live status: one polite screen-reader and visual status line below controls.
- Metric cards: secondary grid below the toolbar controls, visually separated by spacing or a top border.

Tailwind pattern:

```tsx
<div className="mb-5 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--bg-raised)] p-4 shadow-[var(--shadow-card)] sm:p-5">
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      ...
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(18rem,1.2fr)] lg:items-end">
      ...
    </div>
    <div id="flight-results-controls-summary" className="min-h-5 text-xs font-semibold leading-5 text-[var(--text-2)]" aria-live="polite" aria-atomic="true">
      ...
    </div>
    <div className="grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
      ...
    </div>
  </div>
</div>
```

### Header Copy

Visible strings:
- Title: "Refine flight results"
- Result scope when fares exist: "Showing X of Y fares"
- Result scope while loading with no fares: "Waiting for fares"
- Result scope when controls are disabled: "Controls available after fares load"

Header hierarchy:
- Title: `font-display text-lg font-bold leading-6 text-[var(--text-1)]`
- Scope: `text-sm font-semibold leading-5 text-[var(--text-2)]`

### Sort Control

Render Sort as a two-option segmented control.

Visible group label:
- "Sort by"

Options:
- "Best deal"
- "Lowest price"

Interaction:
- Each option is a native `button`.
- Each button keeps `aria-pressed={sortBy === option}`.
- Each button keeps `aria-describedby="flight-results-controls-summary"`.
- Click/tap sets `sortBy` and syncs the URL using the existing page setter.
- Do not render the word "On".

Visual rules:
- The pair sits inside a shared segmented background.
- Selected option uses `bg-[var(--brand)]`, `text-[var(--text-inverse)]`, and a stronger border.
- Unselected options use raised/surface background and `text-[var(--text-2)]`.
- Disabled options use `opacity-60`, `bg-[var(--bg-muted)]`, and `text-[var(--text-3)]`.

Tailwind pattern:

```tsx
<fieldset className="min-w-0">
  <legend className="mb-2 text-xs font-bold text-[var(--text-1)]">Sort by</legend>
  <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-1">
    <button className="min-h-11 rounded-[calc(var(--radius-control)-0.125rem)] px-3 text-sm font-bold leading-5 transition ...">
      Best deal
    </button>
    <button className="min-h-11 rounded-[calc(var(--radius-control)-0.125rem)] px-3 text-sm font-bold leading-5 transition ...">
      Lowest price
    </button>
  </div>
</fieldset>
```

### Stops Control

Render Stops as a separate three-option segmented filter.

Visible group label:
- "Stops"

Options:
- "All stops"
- "Nonstop"
- "1 stop"

Interaction:
- Each option is a native `button`.
- Each button keeps `aria-pressed={filterStops === value}`.
- Each button keeps `aria-describedby="flight-results-controls-summary"`.
- Click/tap sets `filterStops` and syncs the URL using the existing page setter.
- Do not add multi-select, 2+ stops, airline filters, time filters, price sliders, or drawers.

Visual rules:
- Same segmented treatment as Sort.
- Selected "All stops" is selected when `filterStops === null`.
- Selected "Nonstop" is selected when `filterStops === 0`.
- Selected "1 stop" is selected when `filterStops === 1`.
- Button text must not truncate at 375px.

Tailwind pattern:

```tsx
<fieldset className="min-w-0">
  <legend className="mb-2 text-xs font-bold text-[var(--text-1)]">Stops</legend>
  <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-1">
    ...
  </div>
</fieldset>
```

## State Specifications

### Default With Fares

Condition:
- `flights.length > 0`
- `filterStops === null`
- `sortBy === 'deal'`

Toolbar:
- Title: "Refine flight results"
- Scope: "Showing X of Y fares"
- Sort: "Best deal" selected.
- Stops: "All stops" selected.
- Live status: "Showing X of Y fares, sorted by best deal with all stops selected."

Metric cards:
- Appear below the live status.
- Keep existing labels and values.
- Use smaller secondary treatment than controls: `bg-[var(--bg-surface)]`, `border-[var(--border)]`, `text-[var(--text-2)]`.

### Lowest Price Selected

Condition:
- `sortBy === 'price'`

Toolbar:
- "Lowest price" selected.
- Live status: "Showing X of Y fares, sorted by lowest price with [selected stops] selected."

Behavior:
- List reorders client-side only.
- No loading spinner is shown for sorting.
- No provider notice is added.

### Stops Filter Selected

Condition:
- `filterStops === 0` or `filterStops === 1`

Toolbar:
- Selected stops option uses the same active segmented state.
- Scope remains "Showing X of Y fares", where X is `displayFlights.length` and Y is `flights.length`.
- Live status includes the selected stop label.

Behavior:
- List filters client-side before sorting.
- URL persists `stops=0` or `stops=1`.

### Loading

Condition:
- `isSearching === true`
- `flights.length === 0`

Toolbar:
- Render the toolbar preview in disabled state.
- Title: "Refine flight results"
- Scope: "Waiting for fares"
- Sort and Stops buttons disabled.
- Default selected states remain visible: "Best deal" and "All stops".
- Live status: "Sort and stop filters will be available after fares load."

Below toolbar:
- Existing loading panel remains: "Checking live flight inventory"
- Existing skeleton fare cards remain.

Do not imply that disabled controls can fetch or create fares.

### Score Ranking Updating

Condition:
- `rankingUpdating === true`

Live status:
- Preserve this message exactly: "Updating deal ranking as scores finish."
- Append after the main status with the existing brand dot pulse.
- The message must not replace the selected sort/stops summary.

Visual:
- Use `text-[var(--brand)]` and `dot-pulse`.
- Keep `aria-live="polite"` and `aria-atomic="true"`.

### Empty Because No Fares Returned

Condition:
- `flights.length === 0`
- `isSearching === false`
- Not incomplete dates
- Not provider unavailable

Toolbar:
- Do not render active refinement controls if no result set exists after loading.
- The empty state remains primary.

Empty state copy:
- Title: existing "No flight inventory found"
- Body: existing "No current fares matched this route and date combination. Edit the search to try nearby dates, another destination, or anywhere."
- Action: existing "Edit search" when available.

### Empty Because Filter Hides Fares

Condition:
- `flights.length > 0`
- `displayFlights.length === 0`

Toolbar:
- Render normally above the empty state.
- Scope: "Showing 0 of Y fares"
- Selected stops filter remains active.
- Live status: "Showing 0 of Y fares, sorted by [sort label] with [selected stops] selected."

Empty state:
- Title: existing "Filters are hiding the available fares"
- Body: existing "Clear the stops filter or choose All to review the fares returned for this search."
- Action: "Show all stops"

Interaction:
- "Show all stops" sets `filterStops` to `null`.
- Do not reset `sortBy`.

### Error Or Provider Notice

Condition:
- Existing `flightProviderNotices.length > 0`, missing dates, or provider unavailable.

Rules:
- Keep the warning notice above the toolbar when present.
- Do not bury provider warnings inside the toolbar.
- The toolbar must still render when `flights.length > 0 || isSearching`.
- If providers are unavailable and no fares exist, the empty/provider state remains primary and controls are not presented as a recovery path.

Provider copy:
- Preserve existing provider notice messages from provider data.
- Preserve empty provider title: "Flight providers unavailable"
- Preserve retry action: "Retry search"

## Responsive Requirements

### Mobile 375px

Layout:
- Toolbar is single column.
- Header appears first.
- Sort group appears before Stops.
- Controls must be visible before the first fare card.
- No horizontal scrolling.
- Button labels must fit without truncation.

Tailwind:
- Use `grid grid-cols-2` for Sort.
- Use `grid grid-cols-3` for Stops.
- Use `text-xs` only if needed for the three Stops buttons; prefer `text-sm` for Sort.
- Avoid `truncate` on "Lowest price" and "All stops".
- Use `min-h-11` for tap targets.

### Desktop 1280px

Layout:
- Header, result count, Sort, and Stops read as one toolbar.
- Use two columns for controls: Sort narrower, Stops wider.
- Metric cards sit below the controls as secondary context.
- Fare grid starts immediately after toolbar and optional baggage estimator.

Tailwind:
- Use `lg:grid-cols-[minmax(16rem,0.8fr)_minmax(18rem,1.2fr)]` for controls.
- Use `lg:flex-row lg:items-center lg:justify-between` for header.
- Use `sm:grid-cols-3` for metric cards.

## Keyboard And Accessibility

- Keep native `button` controls.
- Keep semantic `fieldset` and `legend` for Sort and Stops.
- Keep `aria-pressed` on every option.
- Keep `aria-describedby="flight-results-controls-summary"` on every option.
- Keep `aria-live="polite"` and `aria-atomic="true"` on the summary.
- Focus ring must remain visible through global `:focus-visible` and `--focus-ring`.
- Tab order must be: Sort Best deal, Sort Lowest price, Stops All stops, Stops Nonstop, Stops 1 stop, then downstream result actions.
- Disabled loading controls must not be focusable through keyboard tab order.
- Selected state cannot rely on color alone: combine filled background, stronger border/inset, and `aria-pressed`.

## Implementation Notes For UI Stage

- Primary implementation file: `components/flights/FlightResults.tsx`.
- Existing state setters are already passed from `app/page.tsx`; preserve them.
- Remove the visible "On" status chip from sort and stops buttons.
- Replace `.btn-pill` usage in this toolbar with component-local Tailwind segmented styles, or add a narrowly scoped shared class only if it does not regress other pill buttons.
- Keep metric-card calculations unchanged: `cheapestFare`, `bestDealCount`, `nonstopCount`.
- Keep existing loading panel, empty states, provider notices, baggage estimator, fare grid, and route tracking behavior.
- Do not change `sortFlights`, provider adapters, `/api/search`, `/api/score`, money types, or Deal Score logic.

## Acceptance Criteria

- At 375px, Sort and Stops are visible before the first fare card and do not require horizontal scrolling.
- At 1280px, result count, Sort, and Stops read as one primary toolbar above the list.
- "Refine flight results" is visible whenever controls are rendered.
- "Showing X of Y fares" is visible whenever fares exist.
- The selected sort and stops states are obvious without the word "On".
- `aria-pressed` and `aria-live` behavior is preserved.
- Filtering to zero visible fares keeps the toolbar visible and shows the existing "Show all stops" recovery action.
- Sorting and filtering do not trigger a new provider search.
- TypeScript passes with `npx tsc --noEmit --incremental false`.

## Handoff

Create `UI-RESULTS-SORT-FILTER-01` for UI implementation of the promoted flight result refinement toolbar.
