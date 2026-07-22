# UX Design: Hotel Destination Disambiguation

**Ticket:** UXDES-DESTINATION-DISAMBIGUATION-01 · **Stage:** UXDES · **Priority:** P0  
**Upstream:** `docs/pipeline/destination-disambiguation/01-discovery.md`, `docs/pipeline/destination-disambiguation/02-research.md`

## 1. Outcome and scope

Create one manual-selection model for hotel geography that lets a traveler distinguish a place by **name, provider-declared type, and provider-declared parent hierarchy**, then keeps that committed scope visible before search and through loading, results, empty, and error states.

This is an implementation-ready interaction and copy specification, not authorization to add a location vendor. Current code has no hotel suggestion endpoint and no stable hotel search-location ID, type, or hierarchy. UI and DEV must not derive these fields from a city string, flight IATA code, result address, tracked-market metadata, query text, or provider rank.

### In scope

- A typed hotel-destination combobox and its complete state model.
- The selected-scope summary shown consistently through hotel search states.
- Explicit recovery for unsupported narrow intent and zero inventory.
- Responsive, keyboard, focus, and screen-reader behavior.
- A provider-scoped data contract for later DEV wiring.

### Out of scope

- Selecting, adding, or calling a new provider.
- Changing the flight airport selector or treating it as hotel-location data.
- Maps, radius controls, geocoding, proximity inference, or auto-detected location.
- Replacing the existing 20-city deal-feed taxonomy until stable typed destinations exist.
- Silently widening a narrow destination to a city or metro.

## 2. Hard implementation gate

The typed combobox may be connected to live search only when the configured provider layer can return all required fields in §3 through a `Result<T>` adapter. Until then:

1. Do not render fabricated suggestion rows from `CITIES`, `trackedMarkets`, flight airports, hotel property locations, or parsed natural-language city strings.
2. Do not submit free text as a hotel destination or retain an old hidden ID after visible text changes.
3. Do not label an IATA selection as `Airport area`; an airport code may identify an airport but does not prove a hotel inventory boundary.
4. Preserve the existing supported flow rather than presenting a nonfunctional combobox. A UI-only implementation may build the component and states behind an unconnected contract, but must not replace the production destination control until DEV supplies the data path.
5. If the configured provider cannot supply typed stable suggestions, stop the release and request provider approval. Do not substitute Booking.com, Expedia, or another vendor from the research references.

## 3. Required data contract

This shape defines the minimum UI input. It does not authorize a particular provider or API.

```ts
type HotelDestinationType =
  | 'city'
  | 'airport'
  | 'airport_area'
  | 'district'
  | 'neighborhood'
  | 'landmark'
  | 'region'

type HotelDestination = {
  provider: string
  locationId: string
  locationType: HotelDestinationType
  name: string
  parentLabel: string
  fullLabel: string
  parent?: HotelDestination
}

type HotelDestinationSuggestionResult = Result<{
  queryId: string
  suggestions: HotelDestination[]
}>
```

Contract rules:

- The committed identity is the tuple `provider + locationId + locationType`; `locationId` alone is not globally stable.
- `name`, `parentLabel`, and `fullLabel` come from the provider adapter. Deterministic composition is allowed only from provider-returned hierarchy fields.
- `parent` is optional. When present for recovery it must itself be a complete, supported, stable `HotelDestination`, not merely parent copy.
- `fullLabel` is the complete accessible label, for example `Downtown Chicago, Neighborhood in Chicago, Illinois, United States`.
- A provider may support only a subset of types. The UI displays the provider-returned type; it never upgrades a generic airport to `airport_area`.
- Cache, request state, URL state, results state, and analytics must use the same committed tuple. Visible copy may be shorter but cannot change its meaning.
- Free text is query state only. It is never a `HotelDestination` and never reaches hotel availability as a destination.

## 4. Information hierarchy

### Combobox open

1. **Primary:** typed query and the active suggestion’s place name.
2. **Secondary:** location type plus parent hierarchy that distinguishes each option.
3. **Tertiary:** lookup status and recovery guidance.

### Selected and searching

1. **Primary:** `Hotels in {name}` and the hotel search action/results.
2. **Secondary:** `{scopeHelper}` and `Edit destination`.
3. **Tertiary:** lookup/search system status.

### Empty, unsupported, and error

1. **Primary:** state title and the action that preserves or explicitly changes intent.
2. **Secondary:** committed destination name and scope helper.
3. **Tertiary:** explanation and alternative action.

Do not use a color, icon, tooltip, or truncated chip as the only scope cue.

## 5. Content rules and final copy

### Type labels

| Value | Visible label |
|---|---|
| `city` | `City` |
| `airport` | `Airport` |
| `airport_area` | `Airport area` |
| `district` | `District` |
| `neighborhood` | `Neighborhood` |
| `landmark` | `Landmark` |
| `region` | `Region` |

Never rewrite a provider type as a more precise type. If a provider type cannot map truthfully to this table, treat it as unsupported rather than guessing.

### Suggestion anatomy

- First line: `{name}`
- Second line: `{Type} · {parentLabel}`
- Accessible option name: `{fullLabel}`

Examples are illustrative render fixtures, not seed data:

- `Paris` / `City · France`
- `Charles de Gaulle Airport` / `Airport area · Paris, France`
- `Downtown Chicago` / `Neighborhood · Chicago, Illinois, United States`

Every row uses the same two-line anatomy, even when no duplicate is visible. If two rows still have identical `name + type + parentLabel`, add one more provider-returned distinguishing level to `parentLabel` and `fullLabel`. If the provider supplies no distinguishing level, do not present either option as safely selectable; use the unsupported state.

### Scope helper

Use containment language only when declared by type:

- `city`, `district`, `neighborhood`, `landmark`, `region`: `{Type} in {parentLabel}`
- `airport_area`: `Airport area near {parentLabel}`
- `airport`: `Airport in {parentLabel}`

If `parentLabel` already contains the selected name, avoid duplication only when the adapter returns a separate display-safe parent. Do not remove hierarchy levels heuristically in the component.

### Field and action copy

| Element | Final copy |
|---|---|
| Field label | `Hotel destination` |
| Empty placeholder | `City, airport area, or neighborhood` |
| Supporting instruction before entry | `Choose a suggestion to set the hotel search area.` |
| Clear control accessible name | `Clear hotel destination` |
| Search action | `Search hotels` |
| Selected edit action | `Edit destination` |
| Lookup retry action | `Try again` |
| No-match guidance | `Check the spelling or try a nearby city or airport.` |
| Uncommitted validation | `Choose a destination from the suggestions.` |

Use the actual provider-supported types in the placeholder if the configured provider supports fewer types. Do not advertise `neighborhood` or `airport area` before that support exists.

## 6. Component anatomy and Tailwind patterns

### Container and label

```tsx
<div className="relative w-full min-w-0 space-y-2">
  <label className="block text-[12px] font-bold leading-5 text-[var(--text-1)]">
    Hotel destination
  </label>
</div>
```

### Input

```tsx
className="min-h-[3.25rem] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-raised)] px-4 py-3 text-[0.9375rem] font-medium text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-0"
```

- Focus is supplied by the global `:focus-visible` rule and `--focus-ring`; do not suppress it.
- Error modifier: `border-[var(--error)] bg-[var(--error-soft)]`.
- Loading may add a non-interactive spinner at the right; retain at least `pr-11` and set the SVG `aria-hidden="true"`.
- Clear is a separate button with a minimum 44×44px target; it must not overlap typed text.

### Listbox

```tsx
className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] p-1.5 shadow-[var(--shadow-lift)]"
```

At desktop, constrain the component to the search-form column; do not let the popup span unrelated filters. At mobile, the popup remains within the 343px content width and scrolls vertically.

### Suggestion row

```tsx
className="flex min-h-16 w-full cursor-pointer flex-col justify-center rounded-[var(--radius-control)] px-3 py-2.5 text-left hover:bg-[var(--bg-muted)]"
```

Active modifier:

```tsx
className="bg-[var(--brand-soft)] shadow-[inset_0_0_0_1px_var(--border-hover)]"
```

Text:

```tsx
<span className="block break-words text-sm font-bold leading-5 text-[var(--text-1)]">{name}</span>
<span className="mt-0.5 block break-words text-xs font-medium leading-5 text-[var(--text-2)]">{typeLabel} · {parentLabel}</span>
```

Do not line-clamp or ellipsize the unique name or hierarchy. Rows expand vertically for long content.

### Selected-scope summary

```tsx
<section className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
  <div className="min-w-0">
    <h2 className="text-h3 break-words text-[var(--text-1)]">Hotels in {name}</h2>
    <p className="mt-1 break-words text-[13px] font-medium leading-5 text-[var(--text-2)]">{scopeHelper}</p>
  </div>
  <button className="btn btn-outline min-h-11 shrink-0 self-start px-5">Edit destination</button>
</section>
```

Loading/result content follows this summary. Never skeletonize or replace the committed name/helper.

### Recovery panel

```tsx
className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] px-5 py-6 text-left min-[640px]:px-8 min-[640px]:py-8"
```

Lookup/search failure modifier: `border-[var(--error)] bg-[var(--error-soft)]`. Actions stack at 375px and may sit inline from 480px:

```tsx
className="mt-5 flex flex-col items-stretch gap-2 min-[480px]:flex-row min-[480px]:items-center"
```

Primary action uses `btn btn-primary`; secondary uses `btn btn-outline`.

## 7. State specification

### 7.1 Default, no query

- Show label, empty input, placeholder, and instruction `Choose a suggestion to set the hotel search area.`
- Combobox is collapsed: `aria-expanded="false"`; listbox is not rendered.
- `Search hotels` is disabled because no committed destination exists.
- Focusing the empty input does not open an empty popup or announce zero results.

### 7.2 Focused with no query

- Keep the popup closed.
- Preserve instruction copy.
- Do not show recent or popular destinations unless a future ticket provides a truthful source and behavior.

### 7.3 Query below provider minimum

- Open the popup only after one non-whitespace character is present.
- Visible status: `Type at least {minimum} characters to search destinations.`
- Live announcement uses the same sentence.
- Do not call lookup before the provider-declared minimum.

### 7.4 Typing and lookup debounce

- Trim only for lookup eligibility; preserve the traveler’s visible text.
- A text change immediately marks the visible value **uncommitted**. `Search hotels` remains disabled.
- Debounce lookup by 150–250ms. Cancel or ignore stale responses by `queryId`; results from an older query never replace a newer query.
- Keep the previous committed object in temporary edit memory, but never pair its hidden ID with changed visible text.

### 7.5 Suggestion loading

- Input remains editable.
- Popup status: `Searching destinations…`
- Announce once per lookup: `Searching destinations.`
- Do not clear the prior committed selection from edit memory.
- Do not show old results as current after the query changes. A spinner is optional; text status is required.

### 7.6 Suggestions available

- Show up to the provider/UI limit in returned order; scrolling is allowed. Do not auto-select the first row.
- The first row may become the active descendant when results arrive, but it is not committed until Enter, click, or tap.
- Visible count is not required. Live announcement: `{count} destinations found. Use the up and down arrow keys to review.`
- When the active option changes, announce its `fullLabel` through `aria-activedescendant` semantics; do not duplicate announcements in a second assertive region.
- Clicking/tapping or pressing Enter commits the exact destination object, closes the popup, restores the formatted selected name in the input, and announces `{fullLabel} selected.`

### 7.7 Mixed and ambiguous suggestions

- Use the standard two lines for every row; no special badge is required.
- Same-name cities must retain state/region/country context supplied by the provider.
- City and airport/airport-area rows stay separate even when they share a parent.
- Neighborhood/district/landmark rows retain their parent city.
- Never reorder, merge, or auto-commit options based on string similarity.

### 7.8 No matches

- Keep the typed query and input focus.
- Popup title/status: `No destinations found for “{query}”.`
- Supporting copy: `Check the spelling or try a nearby city or airport.`
- Announce both sentences in the polite live region.
- Do not offer a guessed city and do not submit the query.

### 7.9 Lookup error

- Keep the typed query and input focus; popup remains open.
- Visible copy: `Destination search is unavailable right now. Try again.`
- Actions: `Try again` and `Edit destination` when a prior committed selection exists; otherwise only `Try again` plus editable input.
- `Try again` repeats the same lookup without changing query or committed selection.
- `Edit destination` returns focus to the input with the current query selected for replacement.
- Use `role="alert"` only when the request fails, then return subsequent status updates to the polite live region.

### 7.10 Selected, before search

- Close the popup and show the selected name in the collapsed field.
- Below the field, show `{scopeHelper}` as persistent text.
- Enable `Search hotels` only when dates and every other required search input are valid.
- On search, the provider tuple—not the input string—is submitted.
- The selected name, scope helper, and `Edit destination` remain visible.

### 7.11 Editing an existing selection

- Activating `Edit destination` focuses the input, selects the visible selected name, and opens lookup only after the query is changed or explicitly re-requested.
- The prior committed selection remains the active search scope until a new option is committed; it is not combined with edited text.
- While editing, disable a new search submission.
- Escape cancels the edit: restore the prior name and helper, close the popup, and keep its identity.
- Clicking outside closes the popup and cancels the uncommitted edit, restoring the prior selection. If there was no prior selection, preserve the typed query but keep search disabled and show validation only after submission/blur according to §7.12.
- Committing another option atomically replaces all destination fields.

### 7.12 Typed text submitted without selection

- Prevent submission and do not call availability.
- Keep focus on the input.
- Show inline error: `Choose a destination from the suggestions.`
- Set `aria-invalid="true"` and reference the error with `aria-describedby`.
- Announce the error once with `role="alert"`.
- Clear the error when a valid option is selected or the query is cleared.

### 7.13 Clear

- Clear query, committed destination, helper, suggestions, and field error.
- Keep focus in the input.
- Disable `Search hotels`.
- Announce `Hotel destination cleared.`
- Do not clear dates or unrelated filters.

### 7.14 Hotel search loading

- Keep the selected-scope summary above results: `Hotels in {name}` / `{scopeHelper}` / `Edit destination`.
- Status: `Searching hotels in {name}…`
- Results region uses `aria-busy="true"`; skeleton cards may appear below the stable summary.
- `Edit destination` remains available. Activating it cancels/invalidates the visible request result before a new destination can be searched; late responses for the prior tuple must not overwrite the edited state.

### 7.15 Results

- Keep the same selected-scope summary above result count/cards.
- Status: `{count} hotels in {name}.`
- Do not replace the heading with a property-level `area`, address, or hotel location.
- Pagination, sorting, and filter updates preserve the same committed tuple and scope helper.
- `Edit destination` reopens the selected flow without clearing dates or unrelated filters.

### 7.16 Valid narrow scope, zero inventory

- Keep: `Hotels in {name}` and `{scopeHelper}`.
- Title: `No hotels were returned in {name} for these dates.`
- Primary action: `Edit dates`.
- If and only if a complete supported parent object exists, secondary action: `Search {parentName}`.
- Otherwise secondary action: `Edit destination`.
- Parent search is a new explicit selection. It commits the parent tuple only after activation, updates the summary, then searches. Never switch scope automatically.

### 7.17 Unsupported narrow intent with supported parent

- Do not send availability for the narrow object.
- Retain the narrow name/type in the recovery panel.
- Copy: `We can’t search {name} as a {typeLabelLowercase} yet. Search hotels across {parentName} instead?`
- Primary action: `Search {parentName}`.
- Secondary action: `Edit destination`.
- The primary action commits the complete parent object, updates visible scope, then searches. It is not merely a query rewrite.

### 7.18 Unsupported destination without supported parent

- Copy: `We don’t support that destination yet. Try a nearby city or airport.`
- Action: `Edit destination`.
- Preserve the entered/narrow intent for editing, but do not create a committed destination or search request.

### 7.19 Hotel search error

- Keep the committed selected-scope summary unchanged.
- Title: `We couldn’t search hotels in {name}.`
- Body: `Your destination and dates are still selected. Try the same search again.`
- Primary action: `Try again`.
- Secondary action: `Edit destination`.
- Retry submits the same tuple and dates. Do not broaden or clear scope.

### 7.20 Provider returns malformed or incomplete location data

- Do not render a selectable row missing `provider`, `locationId`, supported `locationType`, `name`, `parentLabel`, or `fullLabel`.
- If valid rows remain, show only valid rows and report malformed data through provider diagnostics, not traveler-facing technical copy.
- If no valid rows remain, use lookup error copy, not `No destinations found`; the system failed to provide usable identities.

## 8. Combobox accessibility and focus behavior

Follow the WAI-ARIA editable combobox with list autocomplete pattern and the interaction vocabulary already established by `AirportInput`, without using airport data.

### Required semantics

- Input: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, conditional `aria-activedescendant`, and `aria-describedby` for instruction/status/helper/error.
- Popup: `role="listbox"` with a specific accessible name such as `Hotel destination suggestions`.
- Row: `role="option"`, stable DOM ID derived from a safe local key, and `aria-selected` only for the active descendant.
- DOM focus remains on the input while the popup is open.
- Status: one `role="status" aria-live="polite" aria-atomic="true"` region.
- Validation/request failure: a separate alert only when the failure first appears; avoid repeating it on every render.

### Keyboard

| Key | Behavior |
|---|---|
| Printable text | Edits query, uncommits visible input, starts eligible lookup. |
| `ArrowDown` | Opens available results or moves to next option; stops at last option. |
| `ArrowUp` | Moves to previous option; stops at first option. |
| `Enter` | Commits active option. With no active valid option, prevents form submission and shows selection validation. |
| `Escape` | Closes popup and cancels edit, restoring prior committed selection when present; does not clear it. |
| `Tab` | Closes popup without committing the active option; moves to the next control. Prior committed selection is restored when editing. |
| `Home`/`End` | Keep native text-cursor behavior; do not hijack while focus remains in the input. |

Pointer hover may update the visual active row but must not commit it. Use `onPointerDown`/`onMouseDown` selection handling that prevents blur from closing the popup before selection. Touch targets are at least 44px; specified rows are at least 64px.

### Focus after actions

- Selection: focus stays on the input; announcement confirms selection.
- `Edit destination`: focus input and select the visible value.
- Validation failure: focus input.
- `Try again` lookup: focus stays on retry while loading, then returns to the input when suggestions are ready so arrow navigation works.
- Search success: move programmatic focus only if the existing results flow already does so; otherwise announce result count and preserve expected focus. Do not force focus into every loading update.
- Parent recovery: after the explicit parent action starts search, focus follows normal results behavior.

## 9. Responsive layout

### Mobile — 375px

- Page gutter: use existing `px-4` or `px-5`; available content width is 335–343px.
- Combobox, summary, recovery panels, and primary actions are full width.
- Suggestion name and metadata wrap with `break-words`; no horizontal scrolling, no `truncate`, no tooltip dependency.
- Listbox maximum height is `50vh`, preserving access to the keyboard and surrounding controls; it scrolls independently with overscroll contained.
- Selected summary stacks; `Edit destination` sits below the helper, left aligned, with a 44px target.
- Recovery actions stack until 480px.
- Validate at 375px with:
  - same-name cities in different US states;
  - same-name cities in different countries;
  - city versus airport/airport area;
  - neighborhood versus parent city;
  - a 35+ character airport name and a long three-level parent label.

### Desktop — 1280px

- Use the existing centered page container; combobox maximum width follows the search-form column, recommended `max-w-[40rem]`.
- Listbox aligns to input edges and must not cover the search action when sufficient horizontal space exists.
- Selected summary may place `Edit destination` on the right.
- Recovery copy remains at a readable maximum width (`max-w-[640px]`); do not stretch paragraphs across the page.

## 10. Edge cases and invariants

- **Whitespace/case:** lookup may normalize for caching, but visible provider names and IDs are not rewritten by the UI.
- **Duplicate IDs:** uniqueness is provider + type + ID. If duplicate tuples appear, render one row with the richest provider-returned hierarchy.
- **Same ID, different type:** treat as separate scopes unless the provider adapter declares the payload invalid.
- **Identical visible rows:** require another provider-returned hierarchy level. If unavailable, fail closed rather than inviting a blind choice.
- **Stale response:** only the latest query ID may update suggestions or announcements.
- **Network loss during edit:** prior committed scope remains recoverable with Escape; edited text never inherits its ID.
- **Dates change:** destination tuple and helper persist.
- **Back/forward navigation:** restore the complete serialized tuple only after server-side validation against the provider contract; never restore label alone as committed.
- **Deep link with missing/invalid tuple:** render an uncommitted field and `Choose a destination from the suggestions.`; do not search.
- **Provider support changes:** an old saved narrow destination that is no longer supported enters §7.17 or §7.18, never an automatic parent search.
- **Flight + hotel shared search:** a flight destination may prefill hotel query text for convenience, but it remains uncommitted until a hotel-provider suggestion is selected. Do not transfer flight IATA as the hotel ID.
- **Natural-language search:** a parsed city may prefill query text, not commit a typed hotel destination. The `City: {name}` chip must not claim stable hotel scope.
- **Property location:** returned hotel address/area may help evaluate a property, but cannot retroactively define the selected search scope.
- **Currency, price, scoring, and affiliate links:** unchanged by this design.

## 11. State persistence matrix

| State | Query text | Committed tuple | Scope summary | Search allowed |
|---|---|---|---|---:|
| Default | Empty | None | Hidden | No |
| Typing | Current query | Prior tuple held only for cancel | Prior summary may remain outside popup; never paired with query | No |
| Suggestions | Current query | Prior tuple held only for cancel | Prior summary unchanged until selection | No |
| Selected | Selected display name | Current tuple | Visible | Yes, if other fields valid |
| Loading hotels | Selected display name | Current tuple | Visible and stable | Request active |
| Results | Selected display name | Current tuple | Visible and stable | Yes |
| Empty | Selected display name | Current tuple | Visible and stable | Yes |
| Search error | Selected display name | Current tuple | Visible and stable | Retry same tuple |
| Unsupported narrow | Narrow display name/query | None, or prior tuple held for cancel | Narrow intent visible in recovery | No until explicit parent/edit |

## 12. Analytics handoff

Analytics wiring belongs to DEV and must not include raw free text unless privacy rules explicitly permit it. Required event definitions follow the research brief:

- `hotel_destination_suggestions_viewed`
- `hotel_destination_selected`
- `hotel_destination_edited`
- `hotel_results_backtracked`
- `hotel_destination_revised`

Use a per-interaction `selection_id` plus provider-scoped location identifiers. Record selection method (`keyboard`, `pointer`, `touch`) and recovery source, but never infer ambiguity type from copy alone. No event may label an existing bare city or flight IATA as a typed hotel destination.

## 13. Acceptance criteria for UI and DEV

1. Typing without selecting cannot issue a hotel inventory request.
2. Every selectable row exposes provider-backed name, type, parent hierarchy, full accessible name, and stable provider-scoped identity.
3. The same committed identity and helper copy survive loading, results, empty, error, pagination, sorting, and unrelated filter/date changes.
4. Editing visible text cannot leave an old hidden ID attached; Escape restores the prior complete selection.
5. Unsupported narrow intent never silently becomes a city/region search.
6. Parent broadening occurs only through `Search {parentName}` and only with a complete supported parent object.
7. Combobox selection works by keyboard, pointer, touch, and screen reader with the semantics in §8.
8. Long names/hierarchies wrap without overlap or horizontal scrolling at 375px; desktop is usable at 1280px.
9. Lookup failure, no matches, uncommitted validation, malformed provider data, hotel loading, results, empty inventory, and hotel search failure use the exact state rules and copy above.
10. No provider, location type, hierarchy, distance, boundary, or ID is invented from current city/IATA/property data.

## 14. Implementation handoff

UI should create a contract-driven component and render every state in this spec without changing provider/business logic or replacing the current production destination flow with fabricated data. Preserve existing props and exports on adjacent components. Reuse the established `AirportInput` interaction vocabulary and design tokens, but not its airport endpoint or data type.

After UI, create `DEV-DESTINATION-DISAMBIGUATION-01` to implement the provider-backed suggestion endpoint, normalized shared type, provider adapter, stable request/cache persistence, stale-request protection, URL/state validation, analytics, and hotel-search integration. DEV must stop if no approved configured provider can return the contract in §3.
