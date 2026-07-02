# UXDES-BOOKING-REVIEW-PRICE-MEMORY-01: Booking Review Price Memory Design Spec

## Source Inputs

- Discovery: `docs/pipeline/booking-review-price-memory/01-discovery.md`
- Research: `docs/pipeline/booking-review-price-memory/02-research.md`
- Current review route: `app/book/page.tsx`
- Current review flow: `app/book/BookingFlow.tsx`
- Booking context helpers: `lib/booking/config.ts`
- Design tokens: `app/globals.css`
- Next.js 15 docs read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`, `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `node_modules/next/dist/docs/03-architecture/accessibility.md`

## Design Decision

The booking review page must present the selected result as a preserved quote snapshot until the provider explicitly confirms it. Do not label query-string fare context as current, live, final, verified, or confirmed. The primary trust job is to help users compare the preserved itinerary, selected price, price basis, passenger count, provider, terms boundary, and offer reference before entering traveler details or continuing to a provider.

This is UI implementation scope if it only relabels the existing review flow and renders existing client/server state. A DEV ticket is required before adding a pre-submit provider refresh, new booking API response shape, new provider calls, or a provider-returned changed-price comparison object.

## User Outcome

A first-time paid user can identify whether the displayed price is only the selected search-result price or provider-confirmed before entering traveler details or leaving expaify.

## Hierarchy

Primary:

- Review status: selected-only, verification pending, confirmed unchanged, changed, paused, invalid, or hotel confirmation required.
- Route or hotel name.
- Selected price with price basis.
- Primary action: enter traveler details, return to search, or continue to provider.

Secondary:

- Provider.
- Passenger count for flights.
- Depart and return dates where available.
- Carrier, stops, hotel area, and provider terms boundary.

Tertiary:

- Offer reference.
- Sandbox or review-only technical context.
- Recovery explanation copy.

## Page Structure

Use the current two-column `ReviewShell` structure, but reorder the content inside the left column:

1. Back to search link.
2. Page eyebrow, `h1`, and short context message.
3. Visible verification status block.
4. Fare or hotel summary.
5. Any non-blocking disclosure.
6. Right-column action panel on desktop, stacked below summary on mobile.

At 375px, the status block, selected price, price basis, provider, and primary CTA must all be readable without horizontal scrolling. At 1280px, the action panel may remain sticky in the right rail.

Container pattern:

```tsx
<main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-10 lg:px-8">
  <div className="mt-4 grid gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
```

Panel pattern:

```tsx
className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 shadow-[var(--shadow-card)] sm:p-6"
```

Inset fact pattern:

```tsx
className="min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4"
```

## Verification Status Block

Place this block above `FareSummary` or `HotelSummary` and repeat the active state in the right action panel when the state blocks or qualifies the next action.

Shared structure:

```tsx
<section role="status" aria-live="polite" aria-atomic="true" className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-4 sm:p-5">
```

Use `role="alert"` and `aria-live="assertive"` only for invalid, changed, stopped, or network-error states.

Status variants:

- Preserved from search result
  - Tone: warning/amber.
  - Title: `Selected fare preserved from search`
  - Message: `This is the price and itinerary you chose in results. The provider has not confirmed it again yet.`
  - Use for default flight review before submit.

- Provider verification pending
  - Tone: warning/amber.
  - Title: `Provider verification pending`
  - Message: `expaify will ask the provider to verify this fare after you confirm the traveler details.`
  - Use in the traveler details panel before the submit button.

- Provider confirmed unchanged
  - Tone: success/green.
  - Title: `Provider confirmed this fare`
  - Message: `The provider returned a booking reference for the selected fare.`
  - Use on success only.

- Price or passenger count changed
  - Tone: error/red.
  - Title: `This fare changed since search`
  - Message: `Return to search and choose the current fare. expaify did not create an order.`
  - If selected and provider values are available later, append: `Selected: {selectedValue}. Provider returned: {providerValue}.`
  - Do not invent missing provider values.

- Booking paused
  - Tone: warning/amber.
  - Title: `Booking remains paused`
  - Message: `This fare is preserved for review only. expaify is not collecting traveler details or creating a provider order.`

- Invalid selection
  - Tone: error/red.
  - Title: `Selection details are missing`
  - Message: `Return to search and choose a current result before reviewing booking options.`

- Hotel provider confirmation required
  - Tone: warning/amber.
  - Title: `Provider confirmation required`
  - Message: `The provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.`

## Flight Summary

Replace `Current fare` with `Selected fare`.

Top price block:

- Label: `Selected fare`
- Value: `{formattedMoney}`
- Detail: `{total for 1 adult | total for N adults | per person}`

Do not use:

- `Current fare`
- `Live fare`
- `Confirmed fare`
- `Final fare`

Required first-screen facts:

- Route: `{origin} to {destination}` in the heading and `{origin} -> {destination}` in facts.
- Provider: `{provider label}`.
- Selected fare: visible in top price block.
- Price basis: visible in top price block and fact grid.
- Passengers: visible in fact grid.
- Depart: visible in fact grid.
- Return: visible when present.
- Carrier and stops: visible in summary/facts.
- Offer reference: visible without opening a collapsed disclosure.

Offer reference pattern:

```tsx
<div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 text-xs">
  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-3)]">Offer reference</p>
  <p className="mt-2 break-all font-mono leading-5 text-[color:var(--text-2)]">{offerId}</p>
</div>
```

Do not hide the offer reference behind `details` when the page is actionable.

## Hotel Summary

Use hotel-specific handoff language. Hotels must never imply expaify verifies the final total.

Top price block:

- Label: `Selected nightly rate`
- Value: `{formattedMoney}`
- Detail: `per night before taxes and fees` or `price basis requires provider confirmation`

Required first-screen facts:

- Hotel name.
- Area when available.
- Provider.
- Selected nightly rate.
- Currency.
- Price basis.
- Offer reference visible without disclosure.

Required disclosure near the provider CTA:

`Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.`

## Traveler Details Panel

Default flight review panel:

- Eyebrow: `Traveler details`
- Heading: `Continue with selected fare`
- Body: `Enter traveler details only after confirming the selected itinerary, fare, provider, price basis, and passenger count.`
- Status title: `Provider verification pending`
- Status body: `expaify will ask the provider to verify this fare after you confirm. If the price or passenger count changed, no order will be created.`
- Submit button:
  - Sandbox: `Confirm sandbox booking`
  - Live enabled: `Verify fare and continue`
- Footnote:
  - Sandbox: `Sandbox submission only. No live ticket is issued.`
  - Live enabled: `Traveler details are sent only after you confirm this selected fare.`

Keep existing input labels unless a later ticket changes provider data requirements:

- `Title`
- `Gender`
- `First name`
- `Last name`
- `Date of birth`
- `Email`
- `Phone (with country code)`

Loading state in the form:

- Status title: `Verifying with provider`
- Message: `Keeping the selected fare visible while the provider checks price, currency, passenger count, and availability.`
- Submit label: `Verifying fare...`
- Form has `aria-busy="true"`.

## State Specs

### Default Flight

Page title: `Review selected fare`

Page message:

`This page preserves the fare you chose in results. Confirm the selected itinerary and price basis before sending traveler details to the provider.`

Primary status: `Selected fare preserved from search`

Primary action panel status: `Provider verification pending`

Blocking: no.

### Loading

Use when `/api/book` submission is in progress.

Requirements:

- Keep the selected fare summary visible.
- Show a `role="status"` loading block above the form fields or submit area.
- Disable submit while loading.
- Do not clear entered traveler details.
- Do not replace the selected fare with a blank skeleton after the user has reached review.

### Empty Or Missing Flight Context

Use when `fareContext` is null and this is not a requested hotel handoff.

Page title: `We can't identify this fare`

Status title: `Selection details are missing`

Status message:

`Return to search and choose a current result before reviewing booking options.`

Action: `Back to search`

Blocking: yes. No form fields render.

### Error

Use for provider, server, or network failures after submit.

Page title: `Review selected fare`

Page message:

`The selected fare is still visible, but the provider stopped the booking request before an order was created.`

Status title rules:

- If the server reason indicates price, currency, or passenger-count mismatch: `This fare changed since search`
- Otherwise: `Booking request stopped`

Message rules:

- Changed fare: `Return to search and choose the current fare. expaify did not create an order.`
- Generic provider/server reason: show the returned reason after `expaify did not create an order.`
- Network failure: `Network error. expaify did not create an order. Check your connection and review the selected fare before trying again.`

Actions:

- Primary: `Review details again`
- Secondary: `Back to search`

Blocking: yes until the user chooses to review again. Do not auto-resubmit.

### Success

Page title: `Booking confirmed`

Status title: `Provider confirmed this fare`

Status message:

`The provider returned a booking reference for the selected fare.`

Show:

- Booking reference.
- Selected fare summary with label `Selected fare`.
- Provider confirmed status above the summary.

Action: `Search more flights`

### Booking Paused

Use when `bookingEnabled` is false.

Page title: `In-app booking is paused`

Status title: `Booking remains paused`

Status message:

`This fare is preserved for review only. expaify is not collecting traveler details or creating a provider order.`

Action: `Back to search`

Blocking: yes. No traveler form fields render.

### Multi-Passenger Paused

Use when selected passenger count exceeds the current form limit.

Page title: `Multi-passenger review is paused`

Status title: `One passenger is supported`

Status message:

`This fare is priced for {passengerCount} adults, but booking review currently collects details for one passenger only. Return to search with one passenger; expaify will not create an order from incomplete traveler details.`

Action: `Search one passenger`

Blocking: yes.

### Hotel Handoff

Page eyebrow: `Hotel handoff`

Page title: `Review selected hotel`

Page message:

`The selected hotel rate is preserved for provider handoff. The provider still confirms the final total and terms.`

Primary status: `Provider confirmation required`

Right-panel heading: `Before you continue`

Right-panel body:

`Compare the hotel name, provider, selected nightly rate, currency, and price basis on the provider page before entering payment details.`

CTA: `Continue to provider`

Secondary action: `Back to search`

CTA attributes:

- `target="_blank"`
- `rel="noopener noreferrer sponsored"`

### Invalid Hotel Handoff

Page title: `We can't identify this hotel`

Status title: `Selection details are missing`

Status message:

`Return to search and choose a current hotel result before reviewing provider handoff options.`

Action: `Back to search`

Blocking: yes.

## Responsive Rules

Mobile 375px:

- Use a single column.
- The status block appears before the fare or hotel summary.
- Price block stacks below the title text and uses `text-2xl leading-none`; allow wrapping of currency labels.
- Fact grid is one column unless the viewport is at least `sm`.
- Sticky submit area may remain, but it must not cover active input fields or status messages.
- Long offer ids use `break-all` and remain inside the panel.
- No critical money, status, or CTA text may truncate.

Desktop 1280px:

- Use `lg:grid-cols-[minmax(0,1fr)_380px]`.
- Right action panel is `lg:sticky lg:top-6`.
- Status block remains in the left content column above the summary; blocking/error status may also appear in the right panel.

## Keyboard And Accessibility

Keyboard order:

1. Back to search.
2. Review heading and active status.
3. Selected facts.
4. Actionable form fields or provider CTA.
5. Secondary action.

Requirements:

- Keep one `h1` per page state.
- Status blocks use `role="status"` for neutral/loading/success and `role="alert"` for invalid, changed, stopped, or network-error states.
- Use `aria-live="polite"` for normal status and `aria-live="assertive"` for blocking errors.
- Use `aria-atomic="true"` on status blocks.
- Invalid states focus the hidden recovery heading as the current implementation does, or move focus to the visible `h1`; do not focus a non-actionable paragraph.
- All links and buttons retain visible focus through `focus-visible:shadow-[var(--focus-ring)]` or the global focus outline.
- The provider CTA aria label for hotels: `Continue to provider for {hotelName}. Selected nightly rate {formattedMoney}, {priceBasis}. Opens provider site in a new tab. Provider confirms final total, taxes, fees, availability, cancellation policy, and terms.`
- The flight submit button aria label for default state: `Verify selected fare for {origin} to {destination}. Selected fare {formattedMoney}, {priceBasis}.`

## Tailwind Token Rules

Use existing tokens only:

- Backgrounds: `bg-[color:var(--bg-base)]`, `bg-[color:var(--bg-surface)]`, `bg-[color:var(--bg-raised)]`, `bg-[color:var(--bg-overlay)]`
- Text: `text-[color:var(--text-1)]`, `text-[color:var(--text-2)]`, `text-[color:var(--text-3)]`, `text-[color:var(--text-inverse)]`
- Brand/action: `bg-[color:var(--brand)]`, `hover:bg-[color:var(--brand-hover)]`, `bg-[color:var(--brand-soft)]`
- Borders: `border-[color:var(--border)]`, `border-[color:var(--border-strong)]`, `hover:border-[color:var(--border-hover)]`, `focus-visible:border-[color:var(--border-focus)]`
- Status: `bg-[color:var(--success-soft)]`, `text-[color:var(--success)]`, `bg-[color:var(--warning-soft)]`, `text-[color:var(--warning)]`, `bg-[color:var(--error-soft)]`, `text-[color:var(--error)]`
- Radius: `rounded-lg` or `rounded-[var(--radius-control)]`
- Shadow/focus: `shadow-[var(--shadow-card)]`, `shadow-[var(--shadow-btn)]`, `focus-visible:shadow-[var(--focus-ring)]`

Do not add new colors, gradients, font sizes, or decorative imagery for this repair.

## Acceptance Criteria

- The flight price block says `Selected fare`, not `Current fare`.
- A visible status block above traveler details states whether the fare is selected-only, pending verification, confirmed, changed, paused, invalid, or hotel-provider-confirmed.
- Offer reference is visible without opening a collapsed disclosure on actionable review pages.
- Flight changed-price, changed-currency, and changed-passenger-count failures block completion and tell the user to return to search.
- Hotel review says `Selected nightly rate` and states that the provider confirms final total, taxes, fees, room availability, cancellation policy, and terms near the CTA.
- At 375px and 1280px, status, selected price, price basis, provider, and primary CTA are readable with no overlap or horizontal scrolling.
- Keyboard order matches the order defined above.
- `npx tsc --noEmit --incremental false` exits 0 after UI implementation.
