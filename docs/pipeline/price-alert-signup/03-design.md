# UX Design: Price Alert Signup Discoverability

Ticket: `UXDES-PRICE-ALERT-SIGNUP-01`
Stage: UX Design
Priority: P1
Date: 2026-07-02

## Source Inputs

- Discovery report: `docs/pipeline/price-alert-signup/01-discovery.md`
- Research brief: `docs/pipeline/price-alert-signup/02-research.md`
- Current implementation inspected:
  - `app/page.tsx`
  - `components/flights/FlightResults.tsx`
  - `app/api/alerts/route.ts`
  - `app/globals.css`

## Design Objective

Move route alert discovery into the above-results decision area so a first-time user can decide to book, compare, filter, or track a completed destination flight search before scanning the full flight-card grid.

## Primary Surface

Implement the active alert signup path in `components/flights/FlightResults.tsx`, using the existing alert state and submit handler passed from `app/page.tsx`.

Do not build against `app/components/AlertSignup.tsx` for this ticket. That component has a different target-price interaction model and is not the active search-results contract.

## Placement

The route tracking module must render inside the existing results summary/control container, after the three metric tiles and before the sort/stops controls.

Required order:

1. Search notice panel, if present.
2. Results summary panel.
3. Metric tiles: lowest live fare, Great deals, nonstop options.
4. Route tracking module.
5. Sort and stops controls.
6. Controls summary text.
7. Baggage estimator.
8. Flight card grid or empty/loading state.

This keeps route tracking above `BaggageFeeEstimator` and above all flight cards on mobile and desktop.

## Eligibility Rules

Show the enabled route tracking form only when all are true:

- Search is not loading: `!isSearching`.
- Origin and destination are both present after trimming.
- The active tab is flight results.
- At least one returned fare exists in `flights`.
- A fare-derived threshold exists: `Math.min(...flights.map(fare => fare.price.priceCents))`.
- Required dates are complete for the trip type: `depart` exists, and `returnDate` exists for round trip.

Do not gate the enabled form on `flights.length >= 3`.

Show a blocked, non-submittable tracking prompt when all are true:

- Search is complete.
- Origin and destination are present.
- Required dates are complete.
- `flights.length === 0`.
- The empty state is caused by no inventory or provider unavailability, not by filters hiding existing results.

Do not show the alert module for:

- Missing destination searches.
- Missing required dates.
- Hotel-only active tab.
- Filters hiding existing fares. In that case, the primary recovery remains `Show all stops`; the alert module may appear again after fares are visible or filters are cleared.

## Information Hierarchy

Primary: `Track this route`

Secondary: threshold basis and route context, using the cheapest fare returned by the search.

Tertiary: delivery caveat and low-inventory confidence note.

Controls: email input and submit button.

Status: success, loading, and error messages located directly below or beside the form, not detached from the module.

## Final UI Copy

Eyebrow:

`Route tracking`

Default title:

`Track this route`

Default body when three or more fares are returned:

`Get an email when this search drops below {threshold}. Threshold is based on the cheapest live fare returned right now.`

Low-inventory body when one or two fares are returned:

`Get an email when this search drops below {threshold}. Only {count} live fare{plural} returned, so this alert uses the cheapest fare we can verify right now.`

Input label:

`Email for route price alerts`

Input placeholder:

`you@example.com`

Submit button:

`Notify me`

Loading button:

`Setting alert`

Loading status:

`Setting your route alert...`

Success status:

`Alert set for {origin} to {destination} below {threshold}. Fares can change before booking.`

Error fallback:

`Price alert signup is unavailable right now. Please try again.`

Provider-unavailable blocked title:

`Track this route after live fares return`

Provider-unavailable blocked body:

`We need at least one live fare before setting a drop alert. Retry this search or edit the trip details.`

No-inventory blocked title:

`Track this route after a fare appears`

No-inventory blocked body:

`We need at least one live fare before setting a drop alert. Try nearby dates, another destination, or anywhere.`

Disabled button text for blocked variants:

`Alert unavailable`

## State Specifications

### Default, Three Or More Fares

Render a compact module inside the summary panel after the metric tiles.

Layout:

- Left column: eyebrow, title, body.
- Right column on desktop: email form.
- Single column on 375px mobile.

Behavior:

- The threshold is formatted from the cheapest returned fare using `formatMoney`.
- Body copy uses the default threshold copy.
- Email value is preserved while typing.
- Submit sends the existing `handleAlertSubmit`.

### Low Inventory, One Or Two Fares

Render the same enabled form in the same placement.

Behavior:

- Do not hide the form.
- Use low-inventory body copy.
- Threshold remains the cheapest returned fare.
- Do not mention route baseline confidence or Deal Score confidence in the alert copy.

### Loading

While `isSearching` is true:

- Do not show the enabled signup form because the threshold may change while providers stream results.
- If fares have started streaming and the summary panel is visible, show a passive route tracking row below the metric tiles:
  - Title: `Route tracking will be available after fares finish loading`
  - Body: `We will use the cheapest returned fare to set the drop threshold.`
  - No input and no submit button.
- Keep the existing loading state panel and skeleton cards unchanged.

### Empty, Completed Search

When the route is complete but no fares exist:

- Keep the existing empty state as the primary recovery surface.
- Add the blocked tracking prompt below the empty copy inside the same `FlightStatePanel`.
- Do not render an email input.
- Do not submit to `/api/alerts`.
- Use the no-inventory blocked copy unless provider notices indicate provider unavailability.

### Provider Unavailable

When `hasProviderUnavailable` is true:

- Keep the warning tone on the empty state.
- Keep `Retry search` as the primary action.
- Add the provider-unavailable blocked tracking prompt below the provider copy.
- Use `role="status"` on the state panel as currently implemented; do not make this blocked prompt an error alert because it is explanatory, not a failed user action.

### Error

When alert submission fails:

- Keep the entered email intact.
- Display the returned API reason when available.
- Fallback to `Price alert signup is unavailable right now. Please try again.`
- Error text uses `role="alert"`.
- The input has `aria-describedby="flight-alert-error"`.
- The submit button remains enabled after the failed request completes.

### Success

When alert submission succeeds:

- Replace the form with a success status in the same module.
- Use `role="status"` and `aria-live="polite"`.
- Include route and threshold in the status copy.
- Do not collapse or move the module after success.

### Mobile 375px

At 375px:

- The module is full width inside the summary panel.
- Body copy wraps naturally without truncation.
- Email input and button stack vertically.
- Input and button have minimum height `min-h-11`.
- The module appears before sort/stops controls and before the first flight card.
- No text overlaps metric tiles, filters, or cards.

### Desktop 1280px

At 1280px:

- The module uses `lg:grid-cols-[minmax(0,1fr)_auto]` or equivalent.
- Copy occupies the flexible left column.
- Form is right aligned and no wider than needed.
- Email input target width is approximately `sm:w-64`.
- The module visually belongs to the summary panel and does not appear as a footer promotion.

### Keyboard And Focus

Tab order follows visual order:

1. Search controls above results.
2. Route alert email input.
3. Route alert submit button.
4. Sort buttons.
5. Stop filter buttons.
6. Flight card actions.

Focus rules:

- Email input uses an accessible label via `sr-only` or visible label.
- Submit button has native `disabled` during loading.
- Focus rings use the global `:focus-visible` and `--focus-ring` token.
- Do not auto-focus the email input on search completion.

## Tailwind And Token Pattern

Use existing design tokens from `app/globals.css`; do not introduce new colors or font sizes.

Summary panel container remains:

`rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-raised)] p-4 shadow-[var(--shadow-card)] sm:p-5`

Route tracking module:

`mb-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5`

Module layout:

`grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center`

Eyebrow:

`text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]`

Title:

`mt-1 font-display text-lg font-bold leading-7 text-[var(--text-1)]`

Body:

`mt-1 max-w-2xl text-sm leading-6 text-[var(--text-2)]`

Form:

`flex w-full flex-col gap-2 sm:flex-row lg:w-auto`

Input:

`field-input min-h-11 !py-2.5 !pl-4 text-sm sm:w-64`

Button:

`btn-primary min-h-11 !w-full whitespace-nowrap px-5 !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:!w-auto`

Success status:

`rounded-[var(--radius-control)] border border-[var(--success)]/25 bg-[var(--success-soft)] px-4 py-2.5 text-sm font-bold leading-6 text-[var(--success)]`

Error text:

`mt-2 text-xs font-semibold leading-5 text-[var(--error)] sm:text-right`

Blocked prompt:

`mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-4`

Blocked title:

`text-sm font-bold text-[var(--text-1)]`

Blocked body:

`mt-1 text-sm leading-6 text-[var(--text-2)]`

Disabled blocked button:

`btn-primary min-h-11 !w-full px-5 !py-2.5 text-sm sm:!w-auto`

with `disabled`.

## Implementation Notes For UI Stage

- Derive `cheapestAlertFare` from `flights`, not `displayFlights`, so a stop filter does not change the saved threshold unexpectedly.
- Derive `alertThresholdLabel` with `formatMoney(cheapestAlertFare.price)`.
- Add a route label using trimmed origin and destination from the active search.
- The success copy currently cannot access the API response message because `app/page.tsx` stores only `alertSent`; either compute the same route and threshold label client-side or add UI-only state for the returned success message without changing the API contract.
- Keep `thresholdCents` as the integer cheapest fare cents already submitted by `handleAlertSubmit`.
- If the UI stage needs origin in `FlightResults`, pass it as an added prop while preserving all existing props and exports.
- Do not change provider calls, scoring, caching, or API behavior in the UI stage.

## Acceptance Criteria

- A completed destination search with one returned fare shows an enabled route alert form above the flight-card grid.
- A completed destination search with two returned fares shows an enabled route alert form above the flight-card grid.
- A completed destination search with three or more returned fares shows the form above the flight-card grid, not after it.
- Copy says alerts trigger below the cheapest returned fare, never below a live range.
- Empty and provider-unavailable states explain that at least one live fare is required before setting a drop alert.
- The alert email input and submit button are reachable before sort controls and flight card actions in keyboard order.
- Loading, success, error, mobile 375px, and desktop 1280px states are covered by the implementation.
- No alert signup is shown for incomplete destination/date searches or hotel-only results.
