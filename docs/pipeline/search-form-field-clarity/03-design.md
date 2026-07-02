# UX Design Spec: Search Form Field Clarity

Ticket: UXDES-SEARCH-FORM-FIELD-CLARITY-01  
Research source: `docs/pipeline/search-form-field-clarity/02-research.md`  
Target surface: active home-page search form in `app/page.tsx`

## Problem To Solve

First-time users cannot quickly identify the four primary search fields because `From`, `To`, `Depart`, and `Return` are currently screen-reader-only labels while the visible UI relies on placeholders or unlabeled native date inputs.

This spec is UI-only. Do not change API routes, providers, scoring, cache behavior, airport resolution, search submission logic, or result rendering.

## Primary Design Decision

Show persistent visible labels for the primary route and date controls:

- `From`
- `To`
- `Depart`
- `Return`

The labels must remain visible before input, after input, on focus, while loading, and when validation errors are shown. Placeholder copy may remain as an example, but it must never be the only visible field identity.

## Hierarchy

Primary:

- The active search intent segmented control.
- The route/date field group: `From`, `To`, `Depart`, `Return`.
- The submit button.

Secondary:

- Trip type control.
- Flexible dates control.
- Passenger/detail controls already present in the form.

Tertiary:

- Placeholder examples such as `City or airport code` and `Anywhere`.
- Validation helper/error text below date fields.
- Airport suggestion status messages.

The visible field label is above the input content in the hierarchy. Placeholder text is only supporting copy.

## Final UI Copy

Field labels:

- Origin label: `From`
- Destination label: `To`
- Departure date label: `Depart`
- Return date label: `Return`

Existing placeholder and validation copy:

- Keep origin placeholder: `City or airport code`
- Keep destination placeholder: `Anywhere`
- Keep existing date validation messages from `app/page.tsx`.
- Keep existing airport lookup messages from `app/components/AirportInput.tsx`.

Do not add explanatory body copy to the form.

## Layout Specification

### Route Fields

In `app/page.tsx`, replace the current `sr-only` route labels with visible labels placed immediately above each `AirportInput`.

Required pattern:

```tsx
<label
  htmlFor="origin"
  className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"
>
  From
</label>
```

Use the same class pattern for `To`.

Implementation constraints:

- Keep `htmlFor="origin"` and `htmlFor="dest"`.
- Keep the existing `AirportInput` props and IDs.
- Keep the existing grid structure: `grid grid-cols-1 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]`.
- The swap button remains between the route fields and stays aligned to the input row, not the label row.
- Labels must not be placed inside `AirportInput`; this avoids changing the combobox component contract.

### Date Fields

Replace the current date `sr-only` labels with visible labels associated with the native date inputs.

Preferred pattern:

```tsx
<label
  htmlFor="depart"
  className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"
>
  Depart
</label>
```

Add stable IDs to the date inputs:

- Departure input: `id="depart"`
- Return input: `id="return-date"`

Use the same visible-label class pattern for `Return`.

Implementation constraints:

- Preserve `type="date"`, `value`, `min`, `aria-invalid`, `aria-describedby`, and `onChange`.
- Preserve the existing `IconCalendar` placement inside the input wrapper.
- Preserve existing validation error `id`s: `depart-error` and `return-date-error`.
- When `tripType === 'oneway'`, the `Return` label and return date input are not rendered.

## State Specifications

### Default State

- `From`, `To`, `Depart`, and `Return` labels are visible when the form first renders.
- Labels use compact uppercase styling: `text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500`.
- Inputs retain current height, border, background, icon placement, and placeholder styling.
- `To` may continue to show `Anywhere` as placeholder text, but the persistent visible label must identify the field as destination.

### Filled State

- Labels remain visible after route fields contain selected airport display values.
- Labels remain visible after date fields contain selected dates.
- No label text moves, shrinks, disappears, or becomes placeholder text.
- Airport and date values remain the dominant text inside controls.

### Focus And Keyboard State

- Tab order remains: search intent controls, trip type, origin input, swap button, destination input, departure date, return date when present, then subsequent form controls.
- Focus rings remain the existing `focus:ring-4 focus:ring-indigo-500/10` pattern for inputs and existing button focus behavior.
- Route fields preserve combobox keyboard behavior: typing opens suggestions, arrow keys move highlight, Enter selects the highlighted option.
- Native date inputs remain keyboard-focusable and operable.
- Visible labels do not receive focus.

### Loading State

- While search is loading, field labels remain visible.
- Do not disable or hide labels during loading.
- Existing submit/loading copy remains controlled by `loadingLabelForIntent`.
- Do not add a loading state to individual field labels.

### Empty State

- Empty route/date controls still show their visible labels.
- Placeholder examples are allowed only inside the relevant empty input.
- Empty result states outside the form are out of scope.

### Validation Error State

- Date validation errors remain below the relevant date field.
- The visible `Depart` or `Return` label remains above the errored input.
- Keep existing `role="alert"` on error text.
- Keep `aria-invalid="true"` and `aria-describedby` pointing to the existing error IDs.
- No new error color is required for this ticket; keep current slate error presentation unless UI implementation already has a tokenized error pattern in the active form.

### Round Trip State

- Render all four labels: `From`, `To`, `Depart`, `Return`.
- Date grid remains `grid-cols-1 sm:grid-cols-2`.
- At desktop width, route fields remain horizontally scannable and date fields remain paired below them.

### One Way State

- Render `From`, `To`, and `Depart`.
- Do not render `Return` label or return date input.
- Date grid remains `grid-cols-1`.
- Switching from round trip to one way must not leave a visually orphaned `Return` label.

## Responsive Specification

### Mobile: 375px

- Route fields stack vertically with the swap button between them, matching the existing `grid-cols-1` behavior.
- Each label appears directly above its input with `mb-1.5`.
- Labels must not overlap the location icon, calendar icon, placeholder text, selected airport text, date value, swap button, flexible dates control, or submit button.
- The added labels may increase vertical height slightly, but the form must remain usable without horizontal scrolling.
- Long selected airport display values must continue to be handled inside `AirportInput`; this ticket does not change truncation behavior.

### Desktop: 1280px

- The route row remains a three-column grid: origin, swap button, destination.
- A fast horizontal scan must show `From` above the first route input and `To` above the second route input.
- The date row must show `Depart` and `Return` above their respective date controls in round-trip mode.
- Labels should align visually with the left edge of input content using `pl-1`, not with the icon offset.

## Tailwind And Token Guidance

Use existing Tailwind utilities and token-backed colors already available through `app/globals.css`.

Required label class:

```txt
mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500
```

Rationale:

- Matches the compact label pattern in `components/search/SearchPanel.tsx`.
- Uses the active home form's slate color family.
- Does not introduce new colors, shadows, radii, or layout concepts.

Do not add custom CSS for this ticket. Do not introduce new design tokens.

## Accessibility Requirements

- Route labels must remain associated through `htmlFor` and matching input `id`.
- Date labels must be associated through `htmlFor` and matching input `id`, or an equivalent wrapping label pattern.
- Do not remove `role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, or live status behavior from `AirportInput`.
- Do not remove `aria-invalid`, `aria-describedby`, or `role="alert"` from date validation states.
- Visible labels must not replace screen-reader-accessible names with different copy. Accessible names and visible labels must match: `From`, `To`, `Depart`, `Return`.

## Interaction Rules

- Tapping or clicking a visible label focuses the corresponding input.
- Pressing Enter in an airport combobox with an active suggestion keeps the existing selection behavior.
- Pressing Enter on the form submit path keeps existing search behavior.
- Swapping route fields keeps existing `handleSwap` behavior and does not change labels.
- Switching trip type to one way removes the return field and label together.
- Switching back to round trip restores the return field and label together.

## Edge Cases

- Destination left empty: `To` remains visible above the `Anywhere` placeholder.
- Origin selected and destination empty: `From` and `To` remain visible and unambiguous.
- Depart selected and return empty: both date labels remain visible in round-trip mode; return validation appears only when triggered by existing validation.
- Return before depart: existing return-date error remains under the return field with the `Return` label still visible.
- Airport lookup loading/error/empty suggestion states: visible labels remain outside the suggestion popover and do not shift when the popover opens.

## QA Acceptance Checks

1. At 375px width, verify all visible labels are readable and sit directly above their controls with no overlap.
2. At 1280px width, verify `From`, `To`, `Depart`, and `Return` can be identified before entering values.
3. Verify `To` still permits an open-ended destination search while the visible `To` label remains present.
4. Verify tab order and focus rings across route fields, swap button, and date fields.
5. Verify airport combobox keyboard behavior is unchanged.
6. Verify date validation errors preserve `aria-invalid`, `aria-describedby`, and `role="alert"`.
7. Verify one-way mode does not render `Return` label or return date input.
8. Verify round-trip mode renders all four labels.

## Out Of Scope

- API behavior and provider integrations.
- Airport lookup search behavior.
- Date validation logic.
- Deal Score logic.
- Result cards, hotel cards, sorting, filtering, and booking/deeplink behavior.
- New search fields or new form modes.
