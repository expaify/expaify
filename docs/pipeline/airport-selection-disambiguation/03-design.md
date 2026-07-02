# UX Design: Airport Selection Disambiguation

## Inputs

- Discovery: `docs/pipeline/airport-selection-disambiguation/01-discovery.md`
- Research: `docs/pipeline/airport-selection-disambiguation/02-research.md`
- Current implementation surface: `app/page.tsx`, `app/components/AirportInput.tsx`, `app/api/airports/route.ts`, `lib/airports/resolve.ts`, `lib/airports/nearby.ts`, `lib/types.ts`
- Design-system source: `app/globals.css`

## Goal

Make the exact airport scope visible before a user starts search, and prevent ambiguous city, ZIP, shared-link, or Enter-key paths from silently collapsing to one IATA code without review.

This design preserves the current provider contract: `/api/search` receives concrete IATA strings only. It does not introduce city-wide, metro-wide, nearby-airport, or multi-airport provider fanout.

## User Problem

Paid users can start a search for the wrong airport geography because city-like input, ZIP-derived input, shared links, and Enter-key selection can resolve to one airport without making that scope visible before search.

## Primary Experience

The airport field remains a combobox with typed lookup. The selected state must now show a scope line below each field:

- Normal selected airport: `Searching JFK only.`
- ZIP or shared-link resolved airport: `Resolved to JFK. Review before searching.`
- Manually typed unresolved text: the existing blocking form error remains, and the field-level state must not imply a valid airport.

Search may run only when each required side has a concrete selected IATA. Raw city text is not a valid search scope.

## Hierarchy

Primary:

- The selected IATA code and airport name inside each airport input.
- The scope line below the input, because it tells the user what will actually be searched.
- The blocking error when a required field has unresolved text.

Secondary:

- City and country metadata on suggestion rows.
- Same-city group headers such as `New York airports`.
- The `Nearby airports available` affordance, which is informational only in this ticket.

Tertiary:

- Lookup status text such as loading, no matches, and temporary lookup failure.
- Country tags in suggestion rows.

## Final Visible Copy

Field placeholders:

- Origin: `City or airport`
- Destination: `City or airport`

Suggestion list status:

- Loading: `Searching airports...`
- Too short: `Type at least 2 characters to search airports.`
- Empty: `No matching airports found. Check the city or 3-letter airport code.`
- Error: `Airport lookup is unavailable. Try again in a moment.`

Same-city group header:

- `{City} airports`

Selected scope:

- `Searching {IATA} only.`
- `Resolved to {IATA}. Review before searching.`

Nearby secondary action:

- `Nearby airports available`

Unresolved typed search-blocking error:

- Origin: `Choose a valid origin airport from the list.`
- Destination: `Choose a valid destination airport from the list.`

Screen-reader status:

- Loading: `Searching airports.`
- Results: `{count} airport suggestions available. Use arrow keys to review options.`
- Grouped results: `{count} airport suggestions available, including multiple {city} airports. Choose one airport before searching.`
- Selected: `{IATA} selected. Searching {IATA} only.`
- Resolved: `{IATA} selected from shared route or ZIP. Review before searching.`
- Empty: `No matching airports found. Check the city or 3-letter airport code.`
- Error: `Airport lookup is unavailable. Try again in a moment.`

## States

### Default

The field shows the configured label from the search form and placeholder `City or airport`. No scope line is shown while the field is empty. The input uses the existing combobox semantics:

- `role="combobox"`
- `aria-autocomplete="list"`
- `aria-expanded`
- `aria-controls`
- `aria-activedescendant` only when an option is highlighted
- `aria-describedby` pointing to both the hidden status node and any visible helper/error text

Tailwind pattern:

```txt
relative
field wrapper: space-y-2
input: min-h-[3.25rem] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] px-4 py-3.5 pl-11 text-[0.9375rem] font-semibold text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-0
```

### Loading

When lookup is pending, open the listbox and show one non-option status row:

`Searching airports...`

The typed value remains editable. Do not clear the current text. Do not auto-select a row while loading.

Tailwind pattern:

```txt
listbox: absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] p-1.5 shadow-[var(--shadow-lift)]
status row: px-4 py-3 text-sm font-medium text-[var(--text-2)]
```

### No Matches

Show the empty status row:

`No matching airports found. Check the city or 3-letter airport code.`

Enter must not search. Submit must block if this required field has no selected IATA.

### Lookup Error

Show:

`Airport lookup is unavailable. Try again in a moment.`

The typed value remains in the field. Enter and submit must not select a fallback airport.

### Suggestion Results

Every selectable row is one concrete airport. The IATA code is always visible as a fixed-width leading token. Airport name is the primary row label; city and country are secondary metadata.

Row content order:

1. IATA token: `JFK`
2. Primary label: `John F. Kennedy International Airport`
3. Secondary metadata: `New York, United States`

Do not show an individual airport row where the only visible primary label is the city.

Tailwind pattern:

```txt
row: grid min-h-[4.25rem] cursor-pointer grid-cols-[3.25rem_minmax(0,1fr)] gap-3 rounded-[var(--radius-control)] px-3 py-3 text-left transition-colors hover:bg-[var(--bg-muted)]
highlighted row: bg-[var(--brand-soft)] shadow-[inset_0_0_0_1px_var(--border-hover)]
iata token: inline-flex h-8 min-w-12 items-center justify-center rounded-[var(--radius-control)] bg-[var(--bg-muted)] px-2 text-xs font-extrabold text-[var(--brand)]
primary label: block min-w-0 break-words text-sm font-bold leading-5 text-[var(--text-1)]
secondary metadata: mt-0.5 block min-w-0 break-words text-xs font-semibold leading-5 text-[var(--text-2)]
```

### Ambiguous Multi-Airport Results

When two or more returned airports share the same city label, group those rows together. The group header uses:

`{City} airports`

The header is not selectable. It explains scope; it does not represent a city-wide search. Rows under the header remain individual airport choices.

Example:

- Header: `New York airports`
- Row: `JFK` / `John F. Kennedy International Airport` / `New York, United States`
- Row: `LGA` / `LaGuardia Airport` / `New York, United States`
- Row: `EWR` / `Newark Liberty International Airport` / `Newark, United States`

If the current API cannot identify metro groupings beyond repeated city names, group only repeated `city` values. Do not infer broader metro scope in copy.

Tailwind pattern:

```txt
group header: px-3 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-3)]
```

### Selected Airport

After the user selects an airport row, close the listbox and set the visible input value to:

`{IATA} - {City} ({Airport name})`

Show helper text below the field:

`Searching {IATA} only.`

This helper is visible before the Search button is pressed. It is the source of truth for single-airport scope.

Tailwind pattern:

```txt
scope helper: flex min-h-5 items-start gap-1.5 text-xs font-bold leading-5 text-[var(--success)]
```

### ZIP Or Shared-Link Resolved Airport

When the app initializes a field by resolving a URL param or ZIP-like value to an IATA, prefill the selected code but use review copy:

`Resolved to {IATA}. Review before searching.`

The user must see the form before any `/api/search` request launches. The Search button remains enabled if all required IATA values are valid, but the route must not be treated as silently confirmed.

This state must be distinguishable from a user-selected airport until the user edits the field or searches.

Tailwind pattern:

```txt
resolved helper: flex min-h-5 items-start gap-1.5 text-xs font-bold leading-5 text-[var(--warning)]
```

### Nearby Airports Available

If `getNearby` data or an equivalent app-owned signal indicates nearby alternatives for the selected airport, show a secondary text action below the scope helper:

`Nearby airports available`

In this ticket, the action does not change submitted criteria. It may open a disabled or informational popover that says:

`Search still uses {IATA} only. Nearby-airport search needs a separate provider update.`

Do not show copy such as `Searching New York area` or `Includes nearby airports`.

Tailwind pattern:

```txt
nearby action: inline-flex min-h-6 items-center text-xs font-extrabold text-[var(--brand)] underline-offset-4 hover:underline focus-visible:outline-none
```

### Manually Typed Unresolved Text

When a user types after a valid selection, clear the selected IATA while preserving the typed display text. The field is now unresolved.

No scope helper is shown. If the user submits the form, block search with the existing form-level error:

- `Choose a valid origin airport from the list.`
- `Choose a valid destination airport from the list.`

The field should also mark invalid state:

- `aria-invalid="true"`
- `aria-describedby` includes the error text ID

Tailwind pattern:

```txt
invalid input: border-[var(--error)] bg-[var(--error-soft)] focus:border-[var(--error)]
error text: text-xs font-bold leading-5 text-[var(--error)]
```

## Keyboard Rules

Closed dropdown:

- `ArrowDown`: open suggestions if text exists.
- `Enter`: if the field has a selected IATA and the form is otherwise valid, allow normal form submit.
- `Enter`: if the field contains unresolved typed text, open suggestions or keep focus in the field. Do not call first-match selection.

Open dropdown with loading, no results, or error:

- `Enter`: keep focus in the field. Do not select an airport and do not submit.
- `Escape`: close the dropdown and leave text unchanged.

Open dropdown with results and no highlighted option:

- `ArrowDown`: highlight the first selectable airport row.
- `Enter`: do nothing except keep the list open. A visible row must be highlighted before Enter selects.

Open dropdown with a highlighted option:

- `ArrowDown` / `ArrowUp`: move only between selectable airport rows, skipping group headers and status rows.
- `Enter`: select the highlighted airport row.
- `Escape`: close the dropdown and keep typed text unchanged.

Tab and blur:

- `Tab`: move focus normally. Do not auto-select the first result.
- Pointer or keyboard selection is the only way to turn ambiguous typed text into a selected IATA.

## Interaction Rules

Tap or click field:

- If the field has text, open the suggestion list.
- If the field is empty, keep the list closed until the user types.

Type:

- Update visible input text.
- Clear selected IATA unless the typed value exactly matches the existing selected display string.
- Start lookup after the existing debounce.

Tap or click suggestion row:

- Select that row's concrete IATA.
- Close listbox.
- Show `Searching {IATA} only.`

Submit search:

- If all required selected IATA values are present, submit concrete IATA strings.
- If any required field has unresolved text, block search and show the field-specific error.
- If a field is in resolved review state, search may proceed only after the form is visible to the user; no automatic search should fire on page load from raw city, prefix city, or ZIP params.

Retry lookup:

- The user retries by changing text or refocusing and typing. No separate retry button is required in this ticket.

## Responsive Design

### Mobile 375px

The form must remain one column. Suggestion rows must not horizontally scroll. Long airport names wrap to two or more lines within the row.

Mobile requirements:

- IATA token remains visible at the left.
- Country tag must not create a third column on mobile.
- Row layout uses two columns: fixed IATA token plus flexible text.
- Scope helper wraps under the input and never overlaps the next control.
- Listbox width equals input width and remains within viewport.
- Listbox max height is `min(20rem, calc(100vh-12rem))`.

Mobile Tailwind pattern:

```txt
row: grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3
metadata: block text-xs leading-5
listbox: max-h-[min(20rem,calc(100vh-12rem))]
```

### Desktop 1280px

The search form may keep its existing multi-column layout. Each airport field owns its own helper text below the input.

Desktop requirements:

- The listbox anchors to the active input and overlays adjacent content without shifting the form.
- Row text remains left-aligned and scannable.
- Group headers span the full listbox width.
- Helper text remains within the field column.

Desktop Tailwind pattern:

```txt
field column: min-w-0
listbox: absolute left-0 right-0 top-full
```

## Accessibility

The combobox must remain keyboard usable and screen-reader understandable.

Requirements:

- Preserve valid combobox/listbox roles.
- Group headers are presentational text, not options.
- Only concrete airport rows use `role="option"`.
- Highlighted row sets `aria-selected="true"`.
- `aria-activedescendant` references only a concrete airport option.
- Visible helper text has an ID included in `aria-describedby`.
- Lookup and selection changes are announced through the existing `role="status"` live region.
- Focus ring uses the app tokenized focus style from `app/globals.css`.
- Color is not the only indicator of resolved, selected, or invalid state; the visible copy must carry meaning.

## Edge Cases

- Exact IATA input such as `JFK`: may show JFK as a result and allow selection; Enter only selects it when the row is visible and highlighted.
- City query with one airport: still requires selecting the concrete row before search if the user typed raw text.
- Same city with multiple airports: group repeated city values and require one concrete row.
- Metro airports with different city labels, such as Newark for New York: show concrete rows; do not claim a metro group unless the data supports it.
- Shared link with concrete IATA params: show normal selected copy, `Searching {IATA} only.`
- Shared link with city, prefix city, or ZIP params: show resolved review copy, `Resolved to {IATA}. Review before searching.`
- Lookup cache hit: must follow the same grouping and Enter rules as fresh lookup.
- Lookup failure after typing: keep typed text, block search, and show lookup error.
- Recent searches: display the saved concrete airport display string and preserve IATA clarity; do not rewrite recent searches as city-only labels.

## Implementation Boundaries

UI stage may change:

- `app/components/AirportInput.tsx`
- State wiring in `app/page.tsx` needed to pass selected, resolved-review, invalid, helper-text, and nearby-available states.
- Component tests for the combobox behavior.

UI stage must not change:

- External provider calls.
- `/api/search` provider semantics.
- Money types.
- Result adapter contracts.
- Cache keys for provider search.
- Multi-airport fanout behavior.

DEV stage is only needed if the team chooses to add API-level metadata for ambiguity, metro grouping, nearby airport expansion, or URL resolution provenance. This design can be implemented with UI inference for repeated `city` values plus page-level state for resolved URL/ZIP inputs.

## Acceptance Criteria

1. Typing `New York` and pressing Enter before selecting a visible row does not populate an IATA and does not submit search.
2. A same-city list displays `New York airports` and separate concrete rows for visible airport choices.
3. Selecting JFK shows `Searching JFK only.` before the user presses Search.
4. A raw city or ZIP from a shared link renders the form in review mode with `Resolved to {IATA}. Review before searching.` before any `/api/search` request.
5. Manually typed unresolved origin or destination text blocks search with the appropriate valid-airport error.
6. At 375px width, JFK/LGA/EWR-style rows are distinguishable without horizontal scrolling or overlapping text.
7. At 1280px width, the listbox overlays cleanly and helper text remains associated with the correct field.
8. Keyboard users can open, navigate, select, escape, tab away, and submit without auto-selecting the first ambiguous result.
9. Screen-reader users receive lookup, result-count, selected-scope, resolved-review, empty, and error announcements.
10. Search criteria still contains concrete IATA strings, not city strings or arrays.

## Handoff

Create `UI-AIRPORT-SELECTION-DISAMBIGUATION-01` for UI implementation of the airport-input disambiguation states and keyboard rules. No DEV ticket is required unless implementation discovers that URL/ZIP resolution provenance cannot be represented in page state without API changes.
