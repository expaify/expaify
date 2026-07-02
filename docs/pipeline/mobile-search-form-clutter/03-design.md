# UXDES-MOBILE-SEARCH-FORM-CLUTTER-01: Mobile Search Form Clutter Design Spec

## Inputs

- Discovery: `docs/pipeline/mobile-search-form-clutter/01-discovery.md`
- Research: `docs/pipeline/mobile-search-form-clutter/02-research.md`
- Current surface: `app/page.tsx`
- Design tokens: `app/globals.css`
- Next.js guidance reviewed: `node_modules/next/dist/docs/01-app/index.md`, `node_modules/next/dist/docs/03-architecture/accessibility.md`

## Goal

Reduce mobile search-form clutter so a paid user can complete the minimum search path without treating optional controls as required decisions.

This is a UI hierarchy repair. Preserve the current state contract in `app/page.tsx`: `searchIntent`, `tripType`, `origin`, `dest`, `depart`, `returnDate`, `passengers`, and `flexDates`. Do not change API routes, provider behavior, scoring, cache behavior, URL sync, recent-search storage, or inspiration selection logic.

## Information Hierarchy

Primary:

- Origin and destination fields.
- Departure date and return date when `tripType === 'roundtrip'`.
- Submit button.
- Inline validation that blocks submit.

Secondary:

- Search intent: `Flights`, `Hotels`, `Flight + hotel`.
- Trip type: `Round trip`, `One way`.
- Passenger count.
- Flexible dates.

Tertiary:

- Price calendar.
- Trip inspiration.
- Recent searches.
- Selected inspiration summary.

At 375px, primary elements must form one uninterrupted scan path. Secondary controls may appear before the primary fields only if compact enough that they do not push the route/date fields below the initial form card. Tertiary elements must not appear between required fields and submit.

## Mobile Layout: 375px

Use one form card with compact controls and no nested cards.

Order:

1. Form heading row: `Search`.
2. Compact search scope segmented control.
3. Compact trip type segmented control.
4. `From` airport combobox.
5. Swap button.
6. `To` airport combobox.
7. `Depart` date input.
8. `Return` date input when round trip.
9. Compact settings row containing flexible dates and travelers.
10. Form error, when present.
11. Primary submit button.
12. Price calendar, only after submit button on mobile.
13. Trip inspiration and recent searches, below the form card.

Mobile visual rules:

- The search scope segmented control must be a single compact row at 375px, not three stacked cards.
- Search scope option labels only: `Flights`, `Hotels`, `Flight + hotel`. Hide the per-option descriptions on mobile.
- Trip type remains a two-button segmented control directly below search scope.
- Airport and date labels remain visible.
- Flexible dates and travelers render as compact settings, not full-width card-like rows.
- Submit button must be visible before price calendar, trip inspiration, and recent searches.
- No text may overlap or clip at 375px. Long labels wrap only where specified in this spec.

Recommended mobile Tailwind patterns:

```tsx
// form card
"rounded-[1rem] border border-[var(--border)] bg-[var(--bg-raised)] p-3 shadow-[var(--shadow-card)]"

// compact search scope
"grid grid-cols-3 gap-1 rounded-[var(--radius-control)] bg-[var(--bg-muted)] p-1"

// active scope button
"min-h-10 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] px-2 text-center text-[0.8125rem] font-bold text-[var(--text-1)] shadow-sm"

// inactive scope button
"min-h-10 rounded-[var(--radius-control)] border border-transparent px-2 text-center text-[0.8125rem] font-bold text-[var(--text-2)] hover:text-[var(--text-1)]"

// compact settings row
"grid grid-cols-2 gap-2"

// compact setting control
"min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-left text-sm font-semibold text-[var(--text-1)]"
```

## Desktop Layout: 1280px

Desktop may keep richer supporting controls because there is enough space to scan them without delaying the primary task.

Desktop rules:

- The existing two-column page structure may remain.
- Search scope may show labels plus descriptions at `sm` and wider.
- Route fields may remain in the current three-column row: `From`, swap, `To`.
- Date fields may remain side-by-side for round trips.
- Flexible dates and passengers may remain as two columns, but should still use token colors and not dominate the CTA.
- Price calendar may appear before submit only at desktop width if it does not push submit out of the visible form card; preferred placement is still below the primary CTA for consistency.
- Trip inspiration and recent searches remain below the primary form area.

## Component States

### Default

Initial state values remain unchanged unless UI stage has an explicit product decision to change them:

- `searchIntent = 'trip'`
- `tripType = 'roundtrip'`
- `passengers = 1`
- `flexDates = false`

Visible copy:

- Form heading: `Search`
- Scope labels: `Flights`, `Hotels`, `Flight + hotel`
- Scope descriptions on desktop only:
  - Flights: `Rank current fares`
  - Hotels: `Check stays for the trip dates`
  - Flight + hotel: `Review both when available`
- Trip type labels: `Round trip`, `One way`
- Field labels: `From`, `To`, `Depart`, `Return`
- Airport placeholder: `City or airport`
- Flexible setting off: `Flexible dates off`
- Flexible setting on: `Flexible dates on`
- Passenger setting:
  - `1 traveler`
  - `{n} travelers` for 2-9
- Submit:
  - Flights: `Search flights`
  - Hotels: `Search hotels`
  - Flight + hotel: `Search flights and hotels`

### Loading

When `isSearching` is true:

- Disable submit only.
- Keep all visible field values readable.
- Keep compact controls in place; do not replace the form with a loading panel.
- Submit shows the existing spinner and loading copy:
  - Flights: `Scanning fares...`
  - Hotels: `Checking hotel options...`
  - Flight + hotel: `Checking flights and hotels...`
- Do not show trip inspiration or recent searches above the loading submit button.

### Empty And Validation Error

Validation remains inline and blocking.

Required behavior:

- Empty origin: show existing origin combobox error behavior.
- Missing required destination for hotel or trip searches: show a form error or destination field error before submit.
- Missing departure date: `Choose a departure date before searching.`
- Missing round-trip return date: `Choose a return date, or switch to one way.`
- Past departure date: `Departure date cannot be in the past. Choose today or a future date.`
- Return before departure: `Return date must be on or after the departure date.`

Visual rules:

- Errors sit directly under the related field when field-specific.
- Form-level errors sit directly above submit.
- Error container uses `role="alert"`.
- Error colors use `var(--error)`, `var(--error-soft)`, and `var(--border-strong)` or the existing accessible equivalent.
- Do not move submit below tertiary modules when errors appear.

Recommended error pattern:

```tsx
"rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--error-soft)] px-3 py-2 text-sm font-semibold leading-5 text-[var(--error)]"
```

### Focus And Keyboard

Required tab order at 375px:

1. Search scope buttons, left to right.
2. Trip type buttons, left to right.
3. Origin combobox.
4. Swap button.
5. Destination combobox.
6. Depart date.
7. Return date when present.
8. Flexible dates compact control.
9. Passenger decrement.
10. Passenger increment.
11. Submit.
12. Price calendar controls if rendered.
13. Inspiration and recent-search controls.

Accessibility rules:

- Preserve `fieldset` and `legend` semantics for search scope and trip type. Legends may remain `sr-only`.
- Preserve `aria-pressed` on segmented buttons.
- Preserve `AirportInput` combobox roles, `aria-expanded`, `aria-controls`, `aria-activedescendant`, live status text, and invalid state.
- Native date inputs keep `aria-invalid` and `aria-describedby`.
- The flexible-date compact control must expose the checkbox with an accessible name of `Flexible dates`.
- Passenger buttons keep accessible names: `Remove passenger` and `Add passenger`.
- Disabled passenger buttons remain focus-skipped by native button behavior.
- Every interactive element uses the existing global `:focus-visible` treatment and must show a visible focus ring on `var(--bg-raised)` and `var(--bg-surface)`.

### Edge Cases

- `tripType === 'oneway'`: hide `Return`; submit remains directly after compact settings and errors.
- `searchIntent === 'hotels'` with missing destination, missing departure, missing return, or one-way state: keep the selected intent visible and show blocking validation before submit. Copy should explain the missing requirement; do not silently switch intent.
- `searchIntent === 'trip'` with hotel inventory unavailable: preserve existing results behavior; form copy remains `Search flights and hotels`.
- Passenger count at `1`: decrement is disabled; visible setting says `1 traveler`.
- Passenger count at `9`: increment is disabled; visible setting says `9 travelers`.
- `flexDates === false`: compact setting says `Flexible dates off`.
- `flexDates === true`: compact setting says `Flexible dates on`.
- Calendar prices available before submit: at 375px render the price calendar below submit under a secondary heading `Fare calendar`; it must not interrupt the route/date/submit path.
- Selected inspiration: summary may appear below submit or below the form heading only if it is a compact, non-interactive confirmation and does not push route/date fields below the fold. Preferred mobile placement is below submit.
- Recent searches: render after the form card under `Recent searches`.

## Interaction Rules

- Tapping a scope button updates `searchIntent`, clears form-level errors as current code does, and keeps focus on the tapped button.
- Tapping a trip type button updates `tripType`, clears selected inspiration and form-level date errors as current code does, and keeps focus on the tapped button.
- Tapping swap exchanges origin and destination values and keeps the swap button in the tab order between the fields.
- Enter on an airport combobox follows existing `AirportInput` behavior.
- Enter on submit runs existing validation and search handling.
- Selecting a price-calendar date updates `depart` only and does not move the submit button.
- Changing passenger count updates only `passengers`.
- Toggling flexible dates updates only `flexDates`.

## UI Copy Inventory

Visible strings:

- `Search`
- `Flights`
- `Hotels`
- `Flight + hotel`
- `Rank current fares`
- `Check stays for the trip dates`
- `Review both when available`
- `Round trip`
- `One way`
- `From`
- `To`
- `City or airport`
- `Depart`
- `Return`
- `Flexible dates off`
- `Flexible dates on`
- `1 traveler`
- `{n} travelers`
- `Search flights`
- `Search hotels`
- `Search flights and hotels`
- `Scanning fares...`
- `Checking hotel options...`
- `Checking flights and hotels...`
- `Fare calendar`
- `Recent searches`

Validation strings:

- `Choose a departure date before searching.`
- `Use a valid departure date before searching.`
- `Departure date cannot be in the past. Choose today or a future date.`
- `Choose a return date, or switch to one way.`
- `Use a valid return date before searching.`
- `Return date must be on or after the departure date.`

## Implementation Notes For UI

- Implement in `app/page.tsx` only unless existing extracted components already own the affected markup.
- Do not rename or remove exported components.
- Do not alter `AirportInput`.
- Use CSS variables from `app/globals.css`: `--bg-base`, `--bg-muted`, `--bg-surface`, `--bg-raised`, `--border`, `--border-strong`, `--border-hover`, `--border-focus`, `--focus-outline`, `--brand`, `--brand-soft`, `--error`, `--error-soft`, `--text-1`, `--text-2`, `--text-3`, `--shadow-card`, `--focus-ring`, `--radius-control`, and `--radius-card`.
- Avoid hard-coded slate/indigo color classes in changed search-form areas when an equivalent token exists.
- Keep radius at `var(--radius-control)` or `var(--radius-card)` for controls and cards.
- Keep the mobile form dense but legible: minimum tap target height is 40px for segmented controls and 44px for field/settings controls.

## Acceptance Criteria

- At 375px, the route/date/submit path appears before price calendar, trip inspiration, and recent searches.
- At 375px, search scope is compact and does not render as three stacked description cards.
- At 375px, flexible dates and passengers are compact secondary settings, not full-width peer cards.
- At 1280px, the form remains readable and no text overlaps or clips.
- All current state values still map to `searchIntent`, `tripType`, `origin`, `dest`, `depart`, `returnDate`, `passengers`, and `flexDates`.
- Keyboard tab order matches this spec.
- Focus rings are visible for all segmented controls, comboboxes, date inputs, settings controls, stepper buttons, swap button, submit, calendar controls, inspiration controls, and recent-search buttons.
- `npx tsc --noEmit --incremental false` exits 0 after UI implementation.

## Handoff

Next ticket: `UI-MOBILE-SEARCH-FORM-CLUTTER-01`

No DEV ticket is required from this design stage. The requested repair is UI-only and should not require API, provider, scoring, cache, database, or business-logic changes.
