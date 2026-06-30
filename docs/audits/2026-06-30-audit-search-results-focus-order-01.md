# AUDIT-SEARCH-RESULTS-FOCUS-ORDER-01

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Keyboard focus order from search controls to results and booking handoff.

## Verdict

Fail. The basic tab sequence through the search form, result filters, result cards, and booking CTAs is mostly logical, and global focus styling exists. The path fails the ticket because major state transitions do not intentionally preserve or move focus: successful search, loading, empty, error, and booking submit states can leave keyboard users on a removed/disabled control or at the document body with no clear next focus target.

Runtime viewport verification was blocked in this sandbox because `npm run dev` failed to bind: `listen EPERM: operation not permitted 0.0.0.0:3001`. Mobile 375px and desktop evidence below is therefore source-level/responsive-class evidence, not live screenshot evidence.

## Manual Keyboard Flow Covered

Flow reviewed from source:

1. Start on `/`.
2. Tab through `Toggle theme`, `Round trip`, `One way`, `From`, `Swap origin and destination`, `To`, `Depart`, `Return`, `Flexible dates`, passenger decrement/increment, `Search flights`.
3. Submit a valid search.
4. Expected: focus moves to loading/results heading or first meaningful results control.
5. Actual: `runSearch` switches `view` to `results` and clears/replaces result content without focusing a result heading, status, filter, or first booking CTA.
6. Continue tabbing after results render.
7. Expected order in results: edit route/header controls, share, tabs, sort/stops, first card booking CTA.
8. Actual source order follows that sequence once focus is recovered, but focus recovery after submit is not controlled.

## Findings

### FAIL 1: Search submit does not preserve or intentionally move focus

Files:

- `app/page.tsx:687-719`
- `app/page.tsx:1161-1177`
- `app/page.tsx:1244-1431`

Selectors/labels:

- `button[type="submit"]`, label `Search flights`
- `main#search`
- `#results`
- result header buttons `expaify`, route summary `Edit`, `Share`
- results tabs `Flights`, `Hotels`

Repro:

1. At 375px or desktop, keyboard-tab to `Search flights`.
2. Submit a valid search.
3. Observe `setView('results')` renders a new results page while the submit button is unmounted.
4. There is no `ref.focus()`, `tabIndex={-1}` target, or focus restoration to `#results`, a loading status, result count, tabs, or first CTA.

Impact:

Keyboard users can lose focus after the search starts. On mobile this is more damaging because the first meaningful result controls may be below the sticky header and several tabs away after focus recovers.

State coverage:

- Loading: focus is not moved to `Checking live flight inventory`.
- Results: focus is not moved to result count, filters, or first card CTA.
- Empty: focus is not moved to `Edit search` or `Show all stops`.
- Error: focus is not moved to `Retry search` or `Edit search`.

### FAIL 2: Search validation errors render visually but do not focus the failed field or error summary

Files:

- `app/page.tsx:667-684`
- `app/page.tsx:1050-1105`
- `app/page.tsx:1155-1158`

Selectors/labels:

- origin combobox `#origin`, label `From`
- destination combobox `#dest`, label `To`
- date inputs `input[type="date"]`, visible labels `Depart`, `Return`
- form alert text `Correct the highlighted date fields before searching.`

Repro:

1. Keyboard-tab to `Search flights`.
2. Submit with missing/invalid dates or an unresolved airport.
3. Error text appears with `role="alert"`.
4. Focus remains wherever the submit occurred; no invalid control receives focus.

Impact:

The user hears/sees an error but must reverse-tab or inspect the page to find the failing control. The visible `Depart` and `Return` labels are not bound with `htmlFor`/`id`, increasing ambiguity when focus lands on the date inputs.

Viewport evidence:

- Mobile 375px: fields are stacked (`grid-cols-1`), so the error can be above the submit button while focus remains at the bottom of the form.
- Desktop: date fields sit side-by-side at `sm:grid-cols-2`, but no focus target is set for either invalid field.

### FAIL 3: Price calendar injects up to 42 tab stops before core search controls

Files:

- `app/page.tsx:407-472`
- `app/page.tsx:1108-1110`

Selectors/labels:

- calendar day buttons inside `PriceCalendar`
- visible region label `Cheapest days - [month year]`
- subsequent controls `Flexible dates`, `Remove passenger`, `Add passenger`, `Search flights`

Repro:

1. Select an origin and destination that load calendar prices.
2. Keyboard-tab from `Return`.
3. Each calendar date button becomes part of the tab order before `Flexible dates`, passengers, and `Search flights`.

Impact:

The search form’s primary path is interrupted by a dense calendar grid. At 375px this is especially expensive because users must tab through many small day buttons before reaching the submit button.

Note:

This is not a request to remove the calendar. The audit finding is that the focus order is not optimized for the primary search task.

### PASS 1: Global focus styles exist for standard controls

Files:

- `app/globals.css:137-144`
- `app/globals.css:183-209`
- `app/globals.css:216-240`
- `app/globals.css:260-270`

Selectors/labels:

- `a`, `button`, `input`, `select`, `textarea`, `summary`, `[tabindex]`
- `.field-input`
- `.btn-primary`
- `.btn-pill`

Evidence:

Global `:focus-visible` adds a 3px outline and focus ring. Shared form fields and button classes add visible focus rings. This should make standard controls visible on both mobile and desktop if not clipped by runtime layout.

### PASS 2: Results controls and first booking action are in a logical DOM order after focus is recovered

Files:

- `app/page.tsx:1244-1431`
- `components/flights/FlightResults.tsx:217-277`
- `app/components/FlightCard.tsx:352-369`

Selectors/labels:

- header `expaify`
- route summary `Edit`
- `Share`
- tabs `Flights`, `Hotels`
- sort buttons `Best deal`, `Lowest price`
- stop buttons `All stops`, `Nonstop`, `1 stop`
- flight CTA `Check with [provider]` or `Review paused booking`

Evidence:

Once a keyboard user reaches the results DOM, the focus order is coherent: header edit controls, share, tabs, filters, then result cards. Flight cards expose only the primary booking/provider CTA as an interactive control, avoiding excessive card-level tab stops.

### PASS 3: Disabled/unavailable result actions are not focus traps

Files:

- `components/flights/FlightResults.tsx:227-255`
- `app/components/FlightCard.tsx:370-377`
- `app/components/HotelCard.tsx:271-281`

Selectors/labels:

- disabled sort/stop filters while no fares are loaded
- disabled flight CTA `Price unavailable` / `Provider link unavailable`
- hotel status `Booking unavailable`

Evidence:

Unavailable actions are disabled buttons or status text, so they do not trap keyboard focus. This is acceptable as long as the surrounding empty/error action receives intentional focus, which currently fails in Finding 1.

### FAIL 4: Booking submit success/error states do not move focus to the new state

Files:

- `app/book/BookingFlow.tsx:291-308`
- `app/book/BookingFlow.tsx:311-329`
- `app/book/BookingFlow.tsx:363-379`
- `app/book/BookingFlow.tsx:405-467`

Selectors/labels:

- submit button `Confirm sandbox booking` / `Confirm booking`
- loading status `Submitting request`
- success status `Order confirmed`
- error status `Booking request stopped`
- action `Review details again`
- action `Search more flights`

Repro:

1. Reach `/book` from an internal booking CTA, or construct a valid booking context.
2. Tab to `Confirm sandbox booking` / `Confirm booking`.
3. Submit.
4. Loading/success/error panels render, but there is no focus move to the status heading or next action.

Impact:

On success or error, screen-reader users may hear the live region, but keyboard focus remains on a control that may be disabled or unmounted. Sighted keyboard users have no visible focus cue tied to the new booking state.

Positive note:

`InvalidBookingState` intentionally focuses a hidden heading at `app/book/BookingFlow.tsx:224-229`, so the invalid booking edge case has deliberate focus management. The paused, success, and error booking states do not.

## State Behavior Record

- Initial search: logical tab order, visible focus expected through global styles. Fail for unbound date labels.
- Loading after search: rendered with status copy and skeleton cards, but focus is not moved or preserved.
- Successful results: logical DOM order once reached, but focus is lost/not intentionally placed after view swap.
- Empty flight results: `Edit search` or `Show all stops` exists, but focus is not moved to it.
- Search error: `Retry search` and `Edit search` exist, but focus is not moved to the alert or actions.
- Booking handoff: provider CTAs are focusable links with visible focus. Internal booking state changes lack focus movement except invalid booking.

## File Mismatch / Blocker

The ticket says to inspect:

- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`

Those files do not exist in this worktree. The active path uses:

- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/book/BookingFlow.tsx`

There is no current ticket slide-over surface to audit.

## Verification

- `npm run dev`: failed. `listen EPERM: operation not permitted 0.0.0.0:3001`. Browser viewport verification blocked.
- `npm run tsc`: failed. Missing script `tsc` in `package.json`.
- `npx tsc --noEmit --incremental false`: passed.
- `npm test -- --runInBand`: passed. 20 test suites, 172 tests.

