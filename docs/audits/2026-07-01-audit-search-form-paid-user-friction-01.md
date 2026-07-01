# AUDIT-SEARCH-FORM-PAID-USER-FRICTION-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Audit only. No product code changed.

## Gate Decision

Fail.

The shortest flight path is understandable but not polished for paid-user trust: fill origin, optional destination, depart, return for round trip, then submit `Search flights`. The shortest hotel path is not clearly discoverable from first page load. Hotels are only checked as a side effect of a round-trip flight search with destination plus depart/return dates, while the live form heading and primary CTA both say flights.

Runtime browser verification at 375px and desktop was blocked by the sandbox refusing local Next server bind. The mobile/desktop notes below are source-level QA, direct route-handler behavior, and existing test coverage review.

## Files Inspected

- `app/page.tsx`
- `components/search/SearchPanel.tsx`
- `components/search/TripInspirationRail.tsx`
- `app/components/AirportInput.tsx`
- `components/flights/FlightResults.tsx`
- `app/api/search/route.ts`
- `lib/providers/hotellook.ts`

Requested files not present in this worktree:

- `components/search/SearchSummary.tsx`
- `components/search/TripTypeControl.tsx`
- `app/api/hotels/route.ts`

Important implementation note: `components/search/SearchPanel.tsx` exists but is not imported by `app/page.tsx`; the live first-load homepage search form is implemented directly in `app/page.tsx`.

## Shortest Successful Paths

### Flight Intent

1. Open `/`.
2. Keep default `Round trip` or choose `One way`.
3. Enter an origin in `From` and choose/complete a valid airport.
4. Optionally enter `To`; leaving `To` empty means `Anywhere`.
5. Choose `Depart`; for `Round trip`, choose `Return`.
6. Optionally adjust `Flexible dates` and `Passengers`.
7. Submit `Search flights`.

Expected result: results shell opens, loading copy says `Scanning deals across providers...`, flights tab is active, provider notices or fare cards stream in.

### Hotel Intent

1. Open `/`.
2. Keep `Round trip`.
3. Enter an origin in `From`.
4. Enter a destination in `To`.
5. Choose `Depart` and `Return`.
6. Submit `Search flights`.
7. Wait for the flight search to finish and then use the `hotels` tab if it is not disabled.

Expected result from source: hotel provider is called only when `destIATA && depart && ret` are present. One-way searches, destinationless searches, and missing return dates skip hotels.

## Findings

### P1 - Hotel search intent is hidden behind flight-only form copy

Viewport: first-load mobile 375px and desktop source review.

Evidence:

- Live form heading is `Search flights`: `app/page.tsx:986`.
- Live form helper says `Add a route to rank live prices by deal quality.` without telling hotel seekers what must be entered: `app/page.tsx:987`.
- Live primary CTA is `Search flights`: `app/page.tsx:1174`.
- The only first-screen hotel hint is the small stat `Hotels` / `Checked when dates fit`: `app/page.tsx:977` to `app/page.tsx:978`.
- The API checks hotels only after all flight providers and only with destination plus depart and return: `app/api/search/route.ts:289` to `app/api/search/route.ts:297`.

Repro:

1. Open `/` as a user trying to find a hotel.
2. Read the form labels and primary CTA.
3. Try to identify whether hotels can be searched, whether destination is required, and whether one-way dates are enough.

Actual: the form presents a flight search. Hotel search is an implicit side effect, not a clear user path.

Expected: the user can understand from the form that hotels are included only for a destination and stay dates, without needing to submit first.

### P1 - The Hotels tab can be disabled with `Unavailable`, blocking inspection of the hotel state

Viewport: results mobile 375px and desktop source review.

Evidence:

- `hotelsTabDisabled` is true when there are no hotels and hotel state is `idle`, `skipped`, or `unavailable`: `app/page.tsx:916`.
- Disabled tab label shows `Unavailable`: `app/page.tsx:1389`.
- A separate panel says `Hotels were not included.` and then shows the reason: `app/page.tsx:1399` to `app/page.tsx:1403`.
- Hotel unavailable states inside the actual hotels tab exist, but users cannot open the tab when status is `unavailable`: `app/page.tsx:1435` to `app/page.tsx:1465`.

Repro:

1. Submit a valid round-trip destination search in an environment without hotel credentials, or when HotelLook is unavailable.
2. Wait for results to finish.
3. Try to open the `hotels` tab.

Actual: the tab is disabled and marked `Unavailable`; the user has to rely on a mixed-results page notice.

Expected: hotel intent should have an inspectable state, especially for paid users deciding whether hotels were skipped, empty, or provider-blocked.

### P1 - Keyboard-only route completion does not move focus after selecting an airport

Viewport: mobile 375px and desktop source review.

Evidence:

- `AirportInput` intercepts `Enter` to select the first match or highlighted result: `app/components/AirportInput.tsx:138` to `app/components/AirportInput.tsx:155`.
- `select()` updates the chosen airport and closes suggestions, but does not move focus to the next field: `app/components/AirportInput.tsx:87` to `app/components/AirportInput.tsx:92`.
- `runSearch` route errors are global form alerts, not field-focused route errors: `app/page.tsx:666` to `app/page.tsx:677` and `app/page.tsx:1155` to `app/page.tsx:1158`.

Repro:

1. Tab to `From`.
2. Type `JFK`.
3. Press Enter to accept the first airport suggestion.
4. Continue without using a mouse.

Actual: the airport can be selected, but focus remains on the same combobox. The user must infer that Tab is needed to continue; failed route validation does not move focus back to the invalid field.

Expected: completing a required route field should have a clear keyboard continuation path or field-specific recovery focus.

### P2 - Destination optionality and hotel requirement conflict

Viewport: first-load mobile 375px and desktop source review.

Evidence:

- Destination label is `To`, placeholder is `Anywhere`: `app/page.tsx:1037` to `app/page.tsx:1046`.
- Empty destination is valid for flights, but hotels are skipped without destination: `app/page.tsx:920` to `app/page.tsx:925`.
- API sends skipped copy: `Enter a destination plus depart and return dates to check hotel availability.`: `app/api/search/route.ts:322` to `app/api/search/route.ts:326`.

Repro:

1. Leave `To` empty because the placeholder says `Anywhere`.
2. Submit a valid round-trip search.
3. Review hotel availability.

Actual: flights can search anywhere, but hotels are not included. The requirement is revealed after submission.

Expected: the form should make the hidden assumption visible before submit for users with hotel intent.

### P2 - Orphaned `SearchPanel` has different user-facing contract than the live form

Viewport: source review.

Evidence:

- Orphaned `SearchPanel` defaults origin to `NYC` / `New York (NYC)`: `components/search/SearchPanel.tsx:50` to `components/search/SearchPanel.tsx:63`.
- Its CTA is `Search flights + hotels`: `components/search/SearchPanel.tsx:192` to `components/search/SearchPanel.tsx:193`.
- It has no visible validation messages, no date `min`, and no disabled/loading state in the component: `components/search/SearchPanel.tsx:79` to `components/search/SearchPanel.tsx:195`.
- The live `app/page.tsx` form starts empty, validates dates, and says `Search flights`.

Risk: future reuse of the orphaned component would regress this same paid-user friction by changing defaults, validation, and hotel promise without matching the live route contract.

## State Review

Empty state:

- Empty origin is blocked before search with `Add an origin to search.`.
- Typed-but-unselected origin is blocked with `Choose a valid origin airport from the list before searching.`.
- Missing depart/return dates receive field-level date errors.

Loading state:

- Valid submit clears prior results, sets `isSearching`, and opens the results view: `app/page.tsx:687` to `app/page.tsx:718`.
- Header copy says `Scanning deals across providers...`: `app/page.tsx:1277` to `app/page.tsx:1285`.
- Flight loading state is coherent in `components/flights/FlightResults.tsx`; hotel loading skeletons exist only when the hotels tab is active.

Error state:

- Search fetch failures render `We could not complete this search` with `Retry search` and `Edit search`: `app/page.tsx:1326` to `app/page.tsx:1356`.
- API validation has clearer date errors than missing-origin copy; missing origin returns `origin is required`: `app/api/search/route.ts:110` to `app/api/search/route.ts:112`.

Mobile 375px source notes:

- Live form stacks route fields, swap, dates, flexible dates, passengers, and submit in one column or mobile-safe grids.
- Primary action is full-width and not hidden.
- Long form errors appear below all controls, so route errors can be separated from the field that caused them.
- No source-level text overlap was found in the primary form structure.

Desktop source notes:

- Route fields use a two-column layout with swap button between them.
- Date fields use two columns for round trip.
- Search action remains visible after the controls.

## Verification

Manual/source verification performed:

- Mouse path reviewed from source for first-load form controls and submit.
- Keyboard-only path reviewed through `AirportInput` handlers and form submit behavior.
- Mobile 375px and desktop reviewed from responsive class structure; runtime screenshot capture blocked.
- Direct API contract reviewed for hotel inclusion/skipping behavior.

Browser blocker:

- `npm run dev -- --hostname 127.0.0.1 --port 3017` failed in this sandbox with `listen EPERM: operation not permitted 127.0.0.1:3017`. Runtime mouse/keyboard/mobile screenshots require an environment that can bind a local Next dev server.

Out of scope:

- No validation, copy, layout, API schema, provider adapter, homepage redesign, or result-card changes were made.
- No ops-board or ticketing files were touched.
