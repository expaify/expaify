# UXDES-BOOKING-TRAVELER-FIELD-BURDEN-01: Booking Traveler Field Burden

## Inputs

- Discovery: `docs/pipeline/booking-traveler-field-burden/01-discovery.md`
- Research: `docs/pipeline/booking-traveler-field-burden/02-research.md`
- Current surface: `app/book/BookingFlow.tsx`
- Supporting route: `app/book/page.tsx`
- Booking API contract: `app/api/book/route.ts`
- Booking config: `lib/booking/config.ts`

## Design Goal

Make the one-passenger Duffel booking review form explain the traveler-detail burden before the first input: which fields Duffel requires, when expaify sends them, and what expaify does not collect on `/book`.

This is a repair to trust, hierarchy, and form comprehension. It does not add new booking capability, payment collection, multi-passenger support, or provider logic.

## Scope

In scope:

- The active one-adult Duffel fare form in `BookingFlow`.
- Copy and hierarchy for the traveler detail form, trust summary, field groups, loading state, error state, success state, mobile sticky action, and desktop sticky panel.
- Existing recovery states for missing fare context, disabled booking, invalid hotel selection, hotel handoff, and multi-passenger fares.

Out of scope:

- API changes.
- New traveler fields.
- Payment UI.
- Multi-passenger collection.
- Passport or travel-document collection.
- Hotel handoff behavior.
- Any provider call outside `lib/providers` or `app/api/book`.

## Information Hierarchy

Primary:

- The selected fare review and current price basis.
- The pre-form trust summary.
- The one-adult traveler form.
- The verify-first submit action.

Secondary:

- Provider verification status.
- Field group explanations.
- Price, currency, and passenger-count recheck rules at the action boundary.

Tertiary:

- Offer reference.
- Sandbox disclaimer.
- Recovery and retry support copy.

The trust summary must appear before the first input on mobile and desktop. It can sit inside the right-side form panel because the current layout places that panel after the fare review on mobile and sticky on desktop.

## Required Component Structure

The active form should render in this order:

1. Form header.
2. Three-claim trust summary.
3. Provider verification status.
4. Traveler count context.
5. Field group: traveler identity.
6. Field group: provider contact.
7. Sticky action boundary.

Recommended internal sections:

- `TrustSummary`: three compact claims in one panel.
- `FormStatusPanel`: provider verification pending/loading.
- `FieldGroup`: semantic grouping with heading and explanatory sentence.
- `ActionBoundary`: submit button plus provider recheck and sandbox/payment copy.

Do not introduce a new client boundary file unless the implementation splits components out of `BookingFlow.tsx`. `BookingFlow.tsx` is already a Client Component and may keep the local component definitions.

## Final UI Copy

### Page Header: Active One-Passenger Fare

Eyebrow:

`Checkout review`

Title:

`Review selected fare`

Message:

`Confirm the itinerary and price basis before expaify sends traveler details to Duffel for provider verification.`

### Status Above Fare Summary

Title:

`Selected fare preserved from search`

Idle message:

`This is the price and itinerary you chose in results. Duffel has not verified it again yet.`

Loading message:

`Keeping the selected fare visible while Duffel checks price, currency, passenger count, and availability.`

### Form Header

Eyebrow:

`Traveler details`

Title:

`Verify this fare for 1 adult traveler`

Intro:

`These details are required by Duffel for this booking request. They are not used to create an expaify profile.`

### Trust Summary

Heading:

`Before you enter details`

Claims, exactly:

- `Required by Duffel for this booking request`
- `Sent only when you choose verify`
- `No payment details are collected on this page`

Optional supporting sentence below the claims:

`expaify keeps the selected fare visible so you can compare the itinerary, price basis, and passenger count before submitting.`

### Provider Verification Panel

Idle label:

`Provider verification pending`

Idle body:

`After you choose verify, expaify sends these traveler details to Duffel. Duffel rechecks price, currency, passenger count, and availability before any order is created.`

Loading label:

`Verifying with Duffel`

Loading body:

`Do not refresh this page. Duffel is checking the selected fare and traveler details before returning a booking reference.`

### Traveler Count Context

Label:

`Traveler`

Value:

`1 adult traveler`

Body:

`This review path supports one adult traveler. Multi-passenger fares must be searched again with one passenger.`

Only show this context on the active one-passenger form. Multi-passenger fares must continue to use the recovery state instead of rendering a partial form.

### Field Group: Traveler Identity

Heading:

`Traveler identity`

Body:

`Duffel requires the traveler name, title, date of birth, and gender to match the airline booking record.`

Fields:

- Label: `Title`
- Label: `First name`
- Label: `Last name`
- Label: `Date of birth`
- Label: `Gender`

Field guidance:

- First name placeholder: `Jane`
- Last name placeholder: `Smith`
- Date of birth uses browser date input and existing adult max date.
- Do not add field-level helper text except for validation errors or format-specific copy introduced by the browser.

### Field Group: Provider Contact

Heading:

`Provider contact`

Body:

`Duffel requires contact details for booking communication and provider follow-up for this order request.`

Fields:

- Label: `Email`
- Label: `Phone with country code`

Field guidance:

- Email placeholder: `jane@example.com`
- Phone placeholder: `+1 212 555 1234`
- Keep `type="email"` and `type="tel"`.

### Action Boundary

Primary button, idle:

`Verify fare with Duffel`

Primary button, loading:

`Verifying with Duffel...`

Primary button, sandbox idle:

`Verify sandbox fare with Duffel`

Primary button, sandbox loading:

`Verifying sandbox fare...`

Action note, production:

`expaify sends traveler details to Duffel after you choose verify. No payment details are collected here. No order is created if price, currency, or passenger count changed.`

Action note, sandbox:

`Sandbox submission only. No live ticket is issued, and no payment details are collected here.`

Do not use `Confirm booking` or `Confirm sandbox booking` before the API returns success.

### Success State

Eyebrow:

`Confirmation`

Title:

`Booking confirmed`

Message:

`Duffel returned a booking reference for the selected fare.`

Status title:

`Duffel confirmed this fare`

Status message:

`The provider returned a booking reference for the selected fare.`

Reference label:

`Booking reference`

Secondary action:

`Search more flights`

Sandbox note, if shown:

`Sandbox confirmation only. No live ticket was issued.`

### Error State

Page title:

`Review selected fare`

Page message:

`The selected fare is still visible, but Duffel stopped the booking request before an order was created.`

Changed fare title:

`This fare changed since search`

Changed fare message:

`Return to search and choose the current fare. expaify did not create an order.`

Network title:

`Booking request stopped`

Network message:

`Network error. expaify did not create an order. Check your connection and review the selected fare before trying again.`

Generic title:

`Booking request stopped`

Generic message pattern:

`expaify did not create an order. {reason}`

Primary retry action:

`Review details again`

Secondary action:

`Back to search`

### Existing Recovery States

Preserve current recovery behavior and do not show the traveler form for:

- Missing or malformed fare context.
- Booking disabled.
- Multi-passenger fare.
- Invalid hotel selection.
- Hotel provider handoff.

Multi-passenger recovery copy may remain as implemented:

`This fare is priced for {count} adults, but booking review currently collects details for one passenger only. Return to search with one passenger; expaify will not create an order from incomplete traveler details.`

## State Specifications

### Default

- Fare summary is visible.
- Trust summary appears before fields.
- Provider verification panel states pending verification.
- Field groups are collapsed only by visual grouping, not by disclosure widgets.
- Submit button uses verify-first language.
- Browser-required validation remains active.
- No payment UI is shown.

### Loading

- Form has `aria-busy="true"`.
- Submit button is disabled.
- Submit label changes to loading copy.
- Provider verification panel label changes to `Verifying with Duffel`.
- Keep fare summary visible.
- Do not clear entered fields while loading.
- Do not show success copy until a booking reference is returned.

### Empty / Missing Context

- Invalid fare context keeps the current recovery state.
- The page must not render traveler inputs.
- Primary action returns to search.
- Copy must state that expaify is not submitting traveler information or creating an order.

### Error

- Error status uses `role="alert"` or assertive live region.
- Traveler details are not displayed in the error recovery card.
- Primary action returns the user to the editable form state without losing the selected fare.
- Price, currency, and passenger-count failures tell the user to return to search.
- Every error message states that no order was created.

### Success

- Success copy may use confirmation language only after the API returns a booking reference.
- Booking reference is shown as a breakable monospace value.
- Do not show the traveler form after success.
- Sandbox success, if applicable, must clearly say no live ticket was issued.

### Mobile 375px

- Main container keeps `px-4 py-5`.
- Layout remains a single column.
- Trust summary appears above the first input without horizontal scrolling.
- Claims stack vertically or use one-column grid at 375px.
- Field groups use one-column fields at 375px.
- Sticky action uses `bottom-0`, `bg-[color:var(--bg-overlay)]`, `backdrop-blur`, and enough padding for readable notes.
- Button text must fit on two lines at most and stay centered.
- No form text, sticky action, or fare summary may overlap.

### Desktop 1280px

- Preserve the current two-column shell: main review on the left and form panel sticky on the right.
- Right column may remain `380px`; if copy feels cramped, use `lg:grid-cols-[minmax(0,1fr)_420px]` only after checking adjacent hotel and recovery states.
- Trust summary should be compact and scannable, not a large marketing block.
- Fare review, trust boundary, and submit action should all be visible without conflicting duplicate messages.

### Focus and Keyboard

- All form controls keep visible labels bound with `htmlFor`.
- Tab order follows visual order: title, first name, last name, date of birth, gender, email, phone, submit.
- If the layout keeps title and gender in the same first row, visual order must still match tab order. Preferred order is title, first name, last name, date of birth, gender, email, phone.
- Focus rings use global `:focus-visible` and `--focus-ring`.
- Error recovery heading or alert should be announced when the API fails.
- Disabled loading button must remain perceivable and not trap focus.

### Edge Cases

- `fareContext.provider !== 'duffel'`: current API rejects non-Duffel selected fares. The form should only imply Duffel requirements when the fare is a valid Duffel booking context. If a future UI route exposes another provider, provider-specific copy must be generated from the provider label.
- `duffelSandbox === true`: every action and note must use sandbox language and state no live ticket is issued.
- Long offer IDs and booking references must use `break-all`.
- Long airport/provider/carrier values must use `break-words` and remain inside panels.
- Passenger count above `BOOKING_FORM_PASSENGER_LIMIT` must not render fields.

## Tailwind and Token Patterns

Use existing tokenized primitives from `BookingFlow.tsx` and `app/globals.css`.

Panel:

```tsx
rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-card)]
```

Inset panel:

```tsx
rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)]
```

Trust summary:

```tsx
rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--brand-soft)] p-4
```

Trust claims:

```tsx
grid gap-2 text-sm font-semibold leading-5 text-[color:var(--text-1)]
```

Claim item:

```tsx
flex min-w-0 items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2
```

Use a small text checkmark or existing inline span for the visual marker. Do not add decorative icons or new icon dependencies for this repair.

Section heading:

```tsx
text-base font-bold leading-6 text-[color:var(--text-1)]
```

Section body:

```tsx
mt-1 text-sm leading-6 text-[color:var(--text-2)]
```

Field group container:

```tsx
space-y-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4
```

Field grid:

```tsx
grid gap-4 sm:grid-cols-2
```

Labels:

```tsx
mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-2)]
```

Inputs:

```tsx
field-input !px-4
```

Status panel:

```tsx
rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-4 text-[color:var(--warning)]
```

Sticky action:

```tsx
sticky bottom-0 -mx-4 mt-2 border-t border-[color:var(--border)] bg-[color:var(--bg-overlay)] p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none
```

Primary action:

```tsx
btn-primary
```

Use existing design tokens only:

- `--bg-base`
- `--bg-surface`
- `--bg-raised`
- `--bg-overlay`
- `--border`
- `--border-strong`
- `--border-focus`
- `--brand`
- `--brand-soft`
- `--warning`
- `--warning-soft`
- `--success`
- `--success-soft`
- `--error`
- `--error-soft`
- `--text-1`
- `--text-2`
- `--text-3`
- `--text-inverse`
- `--shadow-card`
- `--focus-ring`

Do not introduce new colors, gradients, large illustrative blocks, marketing copy, nested cards, or rounded elements above the existing 8px radius pattern.

## Interaction Rules

- On submit, send the existing payload shape only after native form validation passes.
- While loading, disable the submit button and keep the user on the same surface.
- On successful booking reference, replace the form with the success state.
- On API error, show the existing error recovery shell and keep the selected fare visible.
- On `Review details again`, return to the editable form with previous field state retained by current component state.
- On `Back to search`, navigate to `/`.
- Do not auto-submit on field blur.
- Enter key inside inputs submits through the form only when native validation passes.

## Accessibility Requirements

- Keep `aria-busy={state === 'loading'}` on the form.
- Keep live regions for provider status and error states.
- Use `role="status"` for non-blocking pending/loading status and `role="alert"` for errors.
- Every input and select must have a visible label.
- The trust summary should be normal readable content, not `aria-hidden`.
- Button `aria-label` must use verify language and include route and selected fare context.
- Do not rely on color alone for status; keep explicit status headings.
- Maintain 44px minimum interactive target height through existing `field-input` and `btn-primary`.

## Acceptance Criteria for UI

- A first-time user sees the three required trust claims before the first traveler input.
- The form is split into `Traveler identity` and `Provider contact` sections with the exact explanatory copy above.
- The active form states `1 adult traveler`.
- The primary action never says `Confirm booking` or `Confirm sandbox booking` before success.
- The sticky action explains when expaify sends details, what Duffel rechecks, and that no payment details are collected.
- Sandbox mode states no live ticket is issued.
- Multi-passenger fares continue to render recovery, not a partial traveler form.
- Mobile 375px and desktop 1280px are usable with no overlapping text or hidden action.
- `npx tsc --noEmit --incremental false` exits 0 after implementation.
- `npm test -- --passWithNoTests` exits 0 after implementation.

## Handoff

Next ticket:

`UI-BOOKING-TRAVELER-FIELD-BURDEN-01`

Title:

`UI Implementation: booking traveler field burden`

Description:

`Implement the booking traveler field burden design spec in docs/pipeline/booking-traveler-field-burden/03-design.md. Keep changes to the UI layer in app/book/BookingFlow.tsx unless local component extraction is necessary. Preserve the booking API contract, one-passenger limit, hotel handoff, recovery states, and existing form payload.`
