# AUDIT-MOBILE-SEARCH-BOOKING-PRIMARY-ACTION-VISIBILITY-01

Date: 2026-07-01
Auditor: Codex acting as Senior QA
Status: Partial completion with blocker
Priority: P1

## Scope

Audit primary action visibility from search submit through results, result selection, booking review, loading, empty, and error states.

Files inspected first:

- `app/page.tsx`
- `components/search/SearchPanel.tsx`
- `components/flights/FlightResults.tsx`
- `app/book/BookingFlow.tsx`
- `app/book/page.tsx`
- `app/api/search/route.ts`
- `app/api/book/route.ts`

Additional UI file inspected because it owns the flight result CTA:

- `app/components/FlightCard.tsx`

## Method

1. Read the search, results, booking, and API code paths.
2. Traced every user-facing primary action label to its enabled/disabled logic.
3. Attempted a manual local verification pass for 375px mobile and desktop by starting the Next app and driving a browser locally.

## Blockers

### B1. Rendered 375px and desktop verification could not be completed in this environment

Attempted manual flow:

1. Start the app with `npm run dev`.
2. Retry with explicit localhost bind: `npx next dev --hostname 127.0.0.1 --port 4000`.
3. Open the local app in a browser and verify 375px/desktop action visibility.

Observed blocker:

- Both server start attempts failed with `listen EPERM: operation not permitted`.
- Without a running local app, I could not complete a rendered viewport pass or capture screenshot evidence for overlap, sticky behavior, or text wrapping at 375px and desktop.

Impact:

- Findings below are code-backed.
- Mobile overlap and sticky-action risks are called out only where the implementation strongly suggests them.

## State Inventory

| State | Primary action | Enabled state | Location | Focus reachability | Notes |
| --- | --- | --- | --- | --- | --- |
| Search form, initial | `Search flights` | Enabled unless `isSearching`; not disabled for invalid route or missing dates | `app/page.tsx:1161-1177` | Keyboard reachable, but no explicit visible focus styling in the class list | Click can fail immediately in `runSearch` validation without leaving the form (`app/page.tsx:667-685`) |
| Search form, invalid route/date | `Search flights` | Still enabled | `app/page.tsx:1161-1177` | Keyboard reachable, no explicit visible focus styling | Flow cannot proceed; errors are shown only after activation |
| Search form, trip switch | `Round trip` / `One way` | Enabled | `app/page.tsx:994-1008` | Keyboard reachable, no explicit visible focus styling | Primary route mode control |
| Results header | Route summary `Edit` button | Enabled | `app/page.tsx:1254-1271` | Keyboard reachable, no explicit visible focus styling | Primary way back to editable search on results page |
| Results error | `Retry search` | Enabled | `app/page.tsx:1328-1357` | Uses `btn-primary`; visible focus available through global CSS | Secondary `Edit search` button is also present |
| Flights empty state | `Edit search` or `Show all stops` | Enabled | `components/flights/FlightResults.tsx:173-189`, `310-321` | Uses `btn-primary`; visible focus available through global CSS | Correctly swaps CTA based on cause of empty state |
| Flights loading | No direct primary CTA in panel | None | `components/flights/FlightResults.tsx:289-309` | N/A | User can still reach results header `Edit` button |
| Flights available, each card | `Review paused booking` or `Check with {provider}` | Enabled when link and price exist | `app/components/FlightCard.tsx:241-257`, `352-379` | Keyboard reachable; explicit focus outline exists | Duffel internal links present a review CTA even when booking is paused |
| Flights available, invalid fare | `Price unavailable` or `Provider link unavailable` | Disabled | `app/components/FlightCard.tsx:370-379` | Disabled controls are skipped by keyboard | Correctly non-interactive |
| Booking page, loading fallback | No primary CTA | None | `app/book/page.tsx:16-33` | N/A | Pure loading state |
| Booking page, invalid fare context | `Back to search` | Enabled | `app/book/BookingFlow.tsx:231-262` | Uses `btn-primary`; visible focus available | Recovery-only, coherent |
| Booking page, booking paused | `Back to search` | Enabled | `app/book/BookingFlow.tsx:189-221`, `338-347` | Uses `btn-primary`; visible focus available | Review-only state; no booking progression |
| Booking page, multi-passenger blocked | `Search one passenger` | Enabled | `app/book/BookingFlow.tsx:350-360` | Uses `btn-primary`; visible focus available | Coherent recovery CTA |
| Booking form, live review | `Confirm sandbox booking` / `Confirm booking` | Enabled unless request is loading; not disabled for incomplete required fields | `app/book/BookingFlow.tsx:393-471` | Uses `btn-primary`; visible focus available | Browser validation blocks submit, but the action still appears ready before the form can proceed |
| Booking form, request error | `Review details again` | Enabled | `app/book/BookingFlow.tsx:363-383` | Uses `btn-primary`; visible focus available | Clear recovery path |
| Booking success | `Search more flights` | Enabled | `app/book/BookingFlow.tsx:311-330` | Visible focus available via `secondaryButtonCls` | Not part of booking progression |

## Findings

### 1. P1: Flight results expose an enabled booking-style CTA even when the booking flow is intentionally paused

Files:

- `app/components/FlightCard.tsx:241-257`
- `app/components/FlightCard.tsx:352-379`
- `app/book/BookingFlow.tsx:338-347`

What is broken:

- A Duffel fare with an internal `/book` deeplink renders an enabled primary CTA labeled `Review paused booking`.
- The target page immediately resolves to a recovery state titled `In-app booking is paused` with only `Back to search`.

Why this fails the ticket:

- The action appears enabled and primary even though the flow cannot proceed to booking.
- For a paid travel product this reads as a broken handoff, especially on mobile where the card CTA is the strongest visible action.

Repro:

1. Load a search that returns a Duffel fare with an internal `/book` deeplink.
2. In results, activate `Review paused booking`.
3. Land on `/book` and observe that the page is recovery-only and cannot continue booking.

Expected:

- The results CTA should not present as a booking progression action when booking is paused.
- The label and affordance should match the recovery-only destination.

### 2. P1: The main search CTA remains enabled when search cannot proceed

Files:

- `app/page.tsx:1161-1177`
- `app/page.tsx:667-685`
- `app/api/search/route.ts:96-143`

What is broken:

- `Search flights` is enabled whenever a search is not already in progress.
- Missing origin, unresolved destination text, missing depart date, missing round-trip return date, and invalid date ordering are only rejected after the button is pressed.

Why this fails the ticket:

- The action appears enabled when the flow cannot proceed.
- This is a trust issue on mobile because the primary button invites a tap that can only fail locally.

Repro:

1. Leave origin empty, or type an unresolved destination string, or omit required dates.
2. Tap `Search flights`.
3. Stay on the form and receive validation errors instead of a valid search.

Expected:

- The primary search CTA should either disable until required inputs are valid or clearly communicate incomplete state before activation.

### 3. P2: The booking confirmation CTA appears ready before the traveler form can actually proceed

Files:

- `app/book/BookingFlow.tsx:393-471`
- `app/api/book/route.ts:49-90`

What is broken:

- `Confirm sandbox booking` / `Confirm booking` is enabled until loading starts.
- Required traveler fields are enforced by native browser validation or API rejection, not by pre-submit action state.

Why this matters:

- This repeats the same trust problem as search: the primary action looks available before the flow is actionable.
- On mobile, the sticky footer makes this action visually dominant even when the form above is incomplete.

Repro:

1. Open a valid booking review page.
2. Leave required traveler fields blank.
3. Observe that the sticky confirm CTA still appears enabled.
4. Activate it and let browser validation stop the request.

Expected:

- The booking CTA should visually indicate incomplete form state before submission.

### 4. P2: Core search/edit actions are keyboard reachable but lack explicit visible focus treatment

Files:

- `app/page.tsx:994-1008`
- `app/page.tsx:1027-1034`
- `app/page.tsx:1161-1177`
- `app/page.tsx:1246-1271`

What is broken:

- Several primary or near-primary controls use bespoke Tailwind class strings without `focus-visible` styling:
  - `Round trip` / `One way`
  - swap route button
  - `Search flights`
  - results header route-summary `Edit` button

Why this matters:

- The ticket explicitly calls for focus-state inspection.
- These actions appear keyboard reachable, but the visible focus affordance is not defined in the component classes the way it is for `btn-primary` and `btn-pill`.

Expected:

- Every primary action should expose a visible focus state consistent with the app’s existing `btn-primary` / `btn-pill` focus treatment.

## 375px Verification Flow

### Attempted manual flow at 375px

Target flow:

1. Search form at 375px.
2. Invalid submit state.
3. Results loading state.
4. Flight card selection state.
5. Booking review state.

Result:

- Blocked by local server startup failure:
  - `npm run dev` -> `listen EPERM: operation not permitted 0.0.0.0:3001`
  - `npx next dev --hostname 127.0.0.1 --port 4000` -> `listen EPERM: operation not permitted 127.0.0.1:4000`

Code-backed mobile risk noted for follow-up:

- The booking submit container is sticky on small screens with `sticky bottom-0 -mx-4 ...` in `app/book/BookingFlow.tsx:460-470`. Without a rendered pass, I could not confirm whether it covers the final field, helper copy, browser validation UI, or on-screen keyboard area at 375px.

## Follow-up Repair Tickets

### 1. DESIGN/REPAIR: Replace misleading paused-booking CTA on flight cards

Files:

- `app/components/FlightCard.tsx`
- `app/book/BookingFlow.tsx`

Acceptance criteria:

- When in-app booking is paused, no flight card CTA uses booking-progression language.
- Duffel internal booking links render a review/recovery label that matches the destination state.
- The primary card action never implies that a booking can continue when `/book` is review-only.

### 2. DESIGN/REPAIR: Gate search CTA on actionable form validity

Files:

- `app/page.tsx`
- `app/components/AirportInput.tsx` if input validity state must be surfaced

Acceptance criteria:

- `Search flights` has a non-ready visual state whenever required route/date inputs are incomplete or invalid.
- Users can understand why the action is not ready without first submitting.
- Invalid destination free text and missing dates are covered.

### 3. DESIGN/REPAIR: Gate booking confirm CTA on actionable traveler form validity

Files:

- `app/book/BookingFlow.tsx`

Acceptance criteria:

- The booking confirm CTA has a non-ready visual state until all required traveler inputs are valid.
- Mobile sticky CTA remains visible without implying submission readiness for incomplete forms.
- Error messaging remains visible and is not obscured by the sticky footer.

### 4. DESIGN/REPAIR: Add explicit focus-visible treatment to custom search and edit controls

Files:

- `app/page.tsx`
- Optional shared styling in `app/globals.css`

Acceptance criteria:

- The search form segmented controls, swap button, submit button, and results-header edit button all show visible focus on keyboard navigation.
- Focus treatment is consistent with existing `btn-primary` and `btn-pill` controls.

## Out of Scope Notes

- No feature work or layout repair was implemented in this audit.
- Hotel booking CTAs were only checked where they affected shared results visibility patterns; no deep hotel CTA audit was performed because the ticket is search-to-booking primary action visibility.

## Verification

Commands required by ticket:

- `npx tsc --noEmit --incremental false`
- `npm test -- --runInBand`

Results: recorded below after execution.

- `npx tsc --noEmit --incremental false` -> passed with exit code `0`
- `npm test -- --runInBand` -> passed with exit code `0`
  - `20` test suites passed
  - `172` tests passed
