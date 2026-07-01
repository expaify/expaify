# AUDIT-BOOKING-REVIEW-CONTACT-ERROR-RECOVERY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Booking review contact validation, submission failure recovery, and flight/hotel handoff parity.

## Verdict

Fail for recovery parity.

Flight booking review preserves selected fare context after validation and API failures, but contact validation depends mostly on browser-native required/type behavior and the post-submit error view does not move focus to the recovery message. Hotel result cards do not enter the booking review surface at all, so the requested hotel result to booking review to validation error flow is blocked in this worktree.

## Finding 1 - Hotel results cannot be verified through booking review

Severity: P1

Repro:
1. Run a search that returns hotel results.
2. Open the Hotels tab.
3. Select a hotel card action.

Expected:
- A hotel result can reach a booking review or review-equivalent surface where contact validation and recovery can be compared with flights, or the product clearly states hotel handoff is external-only.

Actual:
- Hotel cards either open the external HotelLook deeplink in a new tab or show `Booking unavailable`.
- No hotel booking review route/component exists in this worktree.
- There are no `components/hotels/HotelCard.tsx` or `components/hotels/HotelResults.tsx` files; hotel cards are rendered from `app/components/HotelCard.tsx`.

Evidence:
- Hotels render `HotelCard` directly from the results page: `app/page.tsx:1435`.
- The hotel CTA links to `hotel.deeplink` with `target="_blank"` and `rel="noopener noreferrer sponsored"`: `app/components/HotelCard.tsx:257`.
- The hotel unavailable state is a non-interactive status, not a booking-review recovery path: `app/components/HotelCard.tsx:275`.
- Flight internal booking links are explicitly recognized as `/book` links only when `source === 'duffel'`: `app/components/FlightCard.tsx:241`.

User impact:
- Hotel handoff feels less complete than flight handoff for this ticket's recovery criteria. QA cannot validate hotel contact error recovery because the surface is absent, not merely broken.

## Finding 2 - Flight contact errors are recoverable, but error focus is not managed

Severity: P1

Repro:
1. Open `/book` with a valid Duffel fare context and `BOOKING_ENABLED=true`.
2. Fill traveler/contact fields.
3. Submit with a server-side failure such as changed price, changed passenger count, missing Duffel config, or provider order failure.
4. Observe the error view and choose `Review details again`.

Expected:
- The selected fare remains visible.
- Entered contact values are retained.
- Focus moves to the error/recovery message or the first actionable recovery control.
- The user gets an unambiguous path to retry or edit without losing context.

Actual:
- The selected fare remains visible in the error view.
- Contact values should remain in component state because only `state` changes from `idle` to `error`; the individual contact state setters are not reset.
- The form is unmounted in the error view and restored by `Review details again`, but there is no focus placement after the API failure.
- `StatusPanel` uses `role="alert"` for assertive errors, but no ref/focus call exists in the `state === 'error'` branch.

Evidence:
- Contact values are stored independently from the booking state: `app/book/BookingFlow.tsx:271`.
- API failure sets `errorMsg` and `state === 'error'` without clearing contact values: `app/book/BookingFlow.tsx:302`.
- Error state keeps `fareContext` visible in `ReviewShell`: `app/book/BookingFlow.tsx:365`.
- Recovery action only flips state back to idle: `app/book/BookingFlow.tsx:374`.
- Focus management exists for missing fare context, but not for API error state: `app/book/BookingFlow.tsx:334`.

User impact:
- Screen-reader and keyboard users may not land on the blocking error or the retry path after a failed submission. The data is likely preserved, but the recovery path is weaker than the missing-context state.

## Finding 3 - Contact validation copy is mostly native and incomplete

Severity: P2

Repro:
1. Open a valid flight booking review with booking enabled.
2. Leave traveler/contact fields blank, or enter a malformed email/phone/date.
3. Submit the form.

Expected:
- Invalid contact input is explained next to the affected fields or in an accessible summary.
- Required fields, email format, phone expectations, and DOB age constraint are understandable before and after submit.
- Invalid input does not erase selected fare or entered values.

Actual:
- Fields use native `required`, `type="email"`, `type="date"`, and `max`, so the browser will block blank fields and malformed email without a custom app-level summary.
- Phone uses `type="tel"` plus `required`, but no pattern or server-side format validation exists. Any non-empty phone value can proceed to Duffel.
- Server-side passenger validation only checks presence of required keys; it does not validate email, phone, DOB format, or title/gender enum beyond TypeScript assumptions.

Evidence:
- Client fields use native constraints only: `app/book/BookingFlow.tsx:416`, `app/book/BookingFlow.tsx:436`, `app/book/BookingFlow.tsx:446`, `app/book/BookingFlow.tsx:451`, `app/book/BookingFlow.tsx:456`.
- Submit body sends raw field state to `/api/book`: `app/book/BookingFlow.tsx:291`.
- API required-field validation returns `passenger.<field> is required`, but does not validate contact formats: `app/api/book/route.ts:78`.
- Raw passenger values are sent to Duffel after presence checks: `app/api/book/route.ts:163`.

User impact:
- Blank input recovery is basic but usable through native browser behavior. Bad phone/contact formats can become provider failures, which are harder to understand and recover from.

## Finding 4 - Some failure copy hides the real recovery path

Severity: P2

Repro:
1. Submit a valid flight booking review that reaches `/api/book`.
2. Trigger a payment or provider order failure.

Expected:
- The error should say whether to retry, return to search, or use a specific provider/airline handoff path.

Actual:
- Payment failures return `Payment failed — contact airline directly`, but the review UI offers only `Review details again` and `Back to search`.
- The message does not identify the airline contact path, provider link, or whether retrying is useful.
- Generic Duffel/provider error text may be passed through directly to the user.

Evidence:
- Payment failure copy is emitted from the API: `app/api/book/route.ts:199`.
- UI renders the API reason verbatim in an alert: `app/book/BookingFlow.tsx:372`.
- Recovery actions are retry-form and back-to-search only: `app/book/BookingFlow.tsx:373`.

User impact:
- A paid travel flow can tell the user to contact the airline without giving a contact path or preserving an outbound provider action in the error state.

## Manual Verification Flows

Flight result to booking review to failed submission recovery:
1. Start from a Duffel fare result with an internal `/book?...` deeplink.
2. Select the flight CTA. Expected card label for internal booking is `Review paused booking` and the link stays in-app.
3. On `/book`, verify selected route, carrier, dates, passengers, price, price basis, and provider remain visible beside the traveler form.
4. Fill contact fields and submit while `/api/book` fails through missing `DUFFEL_KEY`, changed price/passenger count, or provider order failure.
5. Expected/observed from source: the error view keeps the selected fare summary visible and offers `Review details again` plus `Back to search`; contact field values are retained in component state when returning to idle.
6. Gap: no focus is placed on the error state after failed submission.

Hotel result to booking review to validation error recovery:
1. Start from a hotel result card in the Hotels tab.
2. Select `Check with HotelLook`.
3. Blocked: this opens the external provider site. There is no local hotel booking review/contact form to validate.
4. Expected local parity cannot be verified until a hotel review surface exists or the ticket is narrowed to external hotel handoff only.

Invalid flight contact input recovery:
1. Open valid `/book` fare context with booking enabled.
2. Submit with blank required fields.
3. Expected/observed from source: native browser validation blocks submission and keeps the selected fare plus entered values in place.
4. Gap: app-level error copy/summary is absent; phone format is not validated before API submission.

## Empty, Loading, Error, Mobile, Desktop States

- Empty/missing fare context: coherent; focus is sent to a hidden heading and the page explains that no passenger, payment, or order can be submitted.
- Booking paused: coherent; selected fare context is preserved and no contact form is shown.
- Loading: coherent; selected fare remains visible and copy says the page is keeping the fare visible while the provider responds.
- Error: selected fare is preserved and recovery actions exist, but focus is unmanaged and contact fields are hidden until `Review details again`.
- Mobile 375px/static review: booking review uses mobile-first stacking, `min-w-0`, sticky bottom submit, and desktop two-column layout. No browser screenshot verification was performed in this audit.
- Desktop/static review: summary/form layout uses a two-column grid at large breakpoints with the action panel sticky.

## Out Of Scope / Blockers

- No code changes were made because the ticket is audit-only.
- Hotel booking review/contact validation is blocked by absent local surface.
- `components/hotels/HotelCard.tsx`, `components/hotels/HotelResults.tsx`, and `lib/booking.ts` from the ticket do not exist in this worktree. Inspected equivalents were `app/components/HotelCard.tsx` and `lib/booking/config.ts`.
- Browser visual verification at 375px and desktop was not performed; findings are based on source review and existing Jest/TypeScript verification.

## Verification

- `npx tsc --noEmit --incremental false`: passed.
- `npm test -- --passWithNoTests`: passed, 20 test suites and 176 tests.
- `npm run tsc`: not available; `package.json` has no `tsc` script, so the direct `npx tsc --noEmit --incremental false` command was used.
