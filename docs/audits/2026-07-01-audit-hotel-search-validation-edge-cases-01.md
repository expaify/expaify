# AUDIT-HOTEL-SEARCH-VALIDATION-EDGE-CASES-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Hotel destination, check-in, check-out, guests/passengers, rooms, trip type, provider-call suppression, validation state retention, loading/empty/error states.

## Surface Mismatch

The ticket references hotel-specific files that do not exist in this worktree:

- `app/api/hotels/route.ts`
- `lib/providers/hotels.ts`
- `components/search/SearchSummary.tsx`
- `components/search/TripTypeControl.tsx`

The active hotel search path is:

- `app/page.tsx`
- `app/api/search/route.ts`
- `lib/providers/hotellook.ts`
- `lib/types.ts`

There is no local hotel-only endpoint, no hotel-only search form, no rooms input, and no room/guest distribution contract. The UI has a shared passenger count for flight search and uses round-trip flight dates as hotel check-in/check-out.

## Findings

### P0: Empty destination does not block a hotel-intent search before network work

Observed behavior:

- On the main form, destination is optional and labeled `To` with placeholder `Anywhere`.
- Submitting a round trip with origin, valid dates, and no destination starts a search.
- The app calls `/api/search` and runs flight provider logic.
- The hotel provider is not called, but the user only learns after results begin that hotels were not included.
- Results copy says `Hotels were not included.` and `Add a destination to check hotel availability.`

Evidence:

- Destination is only blocked when the user has typed an unresolved destination display value, not when destination is empty: `app/page.tsx:673`.
- Hotel availability is marked `skipped` when destination is missing, after search state has already started: `app/page.tsx:706`.
- The API emits skipped hotel status instead of returning a hotel validation failure: `app/api/search/route.ts:325`.
- The hotel provider is only called when `destIATA && depart && ret`: `app/api/search/route.ts:290`.

Expected repair behavior:

- If the user is explicitly trying to search hotels, an empty destination should block before `/api/search` and show a specific recoverable message such as `Add a destination to check hotel availability.`
- If the current product intentionally supports flight-only "Anywhere" searches, the UI needs a clear mode boundary so this is not presented as hotel validation success.

### P1: No room validation exists

Observed behavior:

- No rooms input exists.
- No room count query parameter exists.
- `HotelProvider.searchHotels` accepts only `{ checkin, checkout }`.
- The API cannot reject impossible room counts or room/guest mismatches because those values are not represented.

Evidence:

- Shared hotel type omits rooms and guests: `lib/types.ts`.
- Hotel provider contract only accepts area and check-in/check-out: `lib/types.ts`.

Expected repair behavior:

- Do not infer or fake room defaults in this ticket.
- If hotel rooms become part of the product contract later, add explicit typed inputs and validation at UI and API boundaries.

### P1: Hotel guest validation is actually flight passenger validation

Observed behavior:

- The UI exposes `Passengers`, not hotel guests.
- The UI clamps values to 1-9 through plus/minus controls.
- Deep links and direct API requests reject passenger values outside 1-9.
- Invalid passenger input blocks providers before any flight or hotel provider call.

Evidence:

- URL parsing accepts only integer passengers 1-9: `app/page.tsx:143`.
- API validates passenger count before creating the provider stream: `app/api/search/route.ts:159`.
- Existing API tests verify invalid requests return 400 and do not call flight or hotel providers.

Expected repair behavior:

- Current behavior is acceptable for the current shared passenger-only contract.
- It does not satisfy hotel-specific guest/room validation because those fields do not exist.

### P1: One-way trip type silently makes hotels unavailable rather than explaining before submit

Observed behavior:

- Switching to one-way clears return date.
- Submitting one-way with a valid destination and depart date starts a flight search.
- Hotels are skipped because there is no checkout date.
- User sees post-search copy requiring departure and return dates for hotel availability.

Evidence:

- One-way clears `returnDate`: `app/page.tsx:523`.
- Hotel availability starts as `skipped` unless destination, depart, return, and roundtrip all exist: `app/page.tsx:706`.
- API emits `hotel-status: skipped` if `ret` is missing: `app/api/search/route.ts:325`.

Expected repair behavior:

- If the user is in a hotel-capable search mode, one-way should either disable hotel expectation before submit or show pre-submit copy that hotels require check-in and check-out dates.

### P2: Date validation is specific and preserves values

Observed behavior:

- Missing depart: blocks submit with `Correct the highlighted date fields before searching.` plus field copy `Choose a departure date before searching.`
- Missing round-trip return: blocks submit with field copy `Choose a return date, or switch to one way.`
- Past depart: blocks submit with field copy `Departure date cannot be in the past. Choose today or a future date.`
- Check-out before check-in: blocks submit with field copy `Return date must be on or after the departure date.`
- Invalid date URLs are rejected with specific link-level errors.
- Values remain in the form because validation returns before state reset and does not clear origin, destination, dates, trip type, or passengers.

Evidence:

- Client date validation messages: `app/page.tsx:122`.
- Client validation returns before fetch: `app/page.tsx:679`.
- Direct API date validation returns 400 before provider stream setup: `app/api/search/route.ts:142`.

Expected repair behavior:

- No repair required for shared date validation.
- Hotel-specific copy should say check-in/check-out if a hotel mode is added.

## Invalid Case Matrix

| Case | UI feedback | API/provider behavior | Values preserved | Result |
| --- | --- | --- | --- | --- |
| Empty hotel destination with valid round-trip dates | No pre-submit block. Results say hotels were not included; add a destination. | `/api/search` is called. Flight providers can run. Hotel provider is not called. | Yes | Fails hotel-intent validation bar |
| Unresolved destination text | `Choose a valid destination airport from the list, or clear the destination field to search everywhere.` | No `/api/search`; no providers. | Yes | Pass |
| Missing depart | Form-level correction plus field copy. | No `/api/search`; direct API returns 400 before providers. | Yes | Pass |
| Missing return on round trip | Form-level correction plus field copy. | No `/api/search`; direct API returns 400 before providers. | Yes | Pass |
| Check-out before check-in | Form-level correction plus field copy. | No `/api/search`; direct API returns 400 before providers. | Yes | Pass |
| Past check-in/departure | Field copy says date cannot be in the past. | No `/api/search`; direct API returns 400 before providers. | Yes | Pass |
| One-way with destination and depart | No pre-submit hotel block; post-search hotels skipped. | `/api/search` is called for flights. Hotel provider is not called. | Yes | Ambiguous for hotel intent |
| Passenger count below 1 or above 9 via URL/API | Link/API error says choose 1 to 9 passengers. | Direct API returns 400 before providers. | URL values partially preserved when valid. | Pass for current passenger contract |
| Rooms missing, zero, impossible, or mismatched to guests | No UI/API state exists. | Not represented. | Not applicable. | Blocked by absent product surface |

## Manual Verification Flows

### Check-out before check-in

1. Open the main search form.
2. Select a valid origin and destination.
3. Set depart/check-in to `2099-09-22`.
4. Set return/check-out to `2099-09-20`.
5. Submit.

Observed:

- Form stays on the search panel.
- Field-level return-date copy says `Return date must be on or after the departure date.`
- Form-level copy says `Correct the highlighted date fields before searching.`
- Entered origin, destination, depart, return, trip type, and passengers remain editable and preserved.
- No provider call should occur; existing API test coverage verifies providers are not called for the reversed range.

### Empty destination

1. Open the main search form.
2. Select a valid origin.
3. Leave destination empty.
4. Set valid round-trip dates.
5. Submit.

Observed:

- Search proceeds to results.
- Flight providers may run.
- Hotel provider is not called.
- Hotels tab is disabled and the page shows `Hotels were not included.` plus `Add a destination to check hotel availability.`
- Entered origin, dates, trip type, and passengers remain available after choosing `Edit`.

Expected:

- For hotel-intent validation, empty destination should block before provider/search work with specific recoverable copy.

## Loading, Empty, Error, Mobile, Desktop

- Loading: flight/results loading is coherent; hotel skeletons only render if the Hotels tab is active and not disabled.
- Empty hotels: `No hotel inventory found` with provider message is coherent.
- Hotel provider unavailable: bounded copy avoids leaking upstream details.
- Mobile 375px: form uses single-column route fields and date fields stack at mobile width. No obvious hidden primary action from static inspection.
- Desktop: form and results use constrained max widths and responsive grids. No obvious overlap from static inspection.

No browser automation was added or run for screenshots in this audit; this is a code and test audit.

## Blockers and Out-of-Scope Notes

- Blocker: The ticket asks for rooms and room mismatches, but this worktree has no room input, no hotel-only route, and no room contract.
- Blocker: The ticket asks for files that do not exist locally. The audit used the actual search/hotel path in this repo.
- Out of scope: Autocomplete, maps, calendars, account preferences, fake hotel defaults, and provider adapter shape changes were not touched.
