# AUDIT-SEARCH-HOTEL-FORM-STATE-RESET-01

## Scope Check

Audited existing local surfaces only:

- `app/page.tsx`
- `components/search/SearchPanel.tsx`
- `components/flights/FlightResults.tsx`
- `lib/types.ts`
- `app/api/search/route.ts`
- `app/components/HotelCard.tsx`

Requested files not present in this worktree:

- `components/search/SearchSummary.tsx`
- `components/search/TripTypeControl.tsx`
- `components/hotels/HotelResults.tsx`

The current app also does not expose flight-only, hotel-only, and mixed search modes. It exposes round-trip/one-way trip type controls on the search form and flights/hotels tabs after results load. There are no guest-count or room-context inputs in the current homepage search form.

## Field State Matrix

| Field | Round trip form | One way form | Hotels tab/results | Switch behavior | Trust risk |
| --- | --- | --- | --- | --- | --- |
| Origin | Visible, required | Visible, required | Reflected in route label/header | Preserved when switching trip type | Low |
| Destination | Visible, optional, placeholder `Anywhere` | Visible, optional, placeholder `Anywhere` | Required for hotel lookup | Preserved when switching trip type | Low |
| Depart date | Visible, validated | Visible, validated | Required for hotel lookup | Preserved when switching trip type | Low |
| Return date | Visible, validated | Hidden | Required for hotel lookup | Cleared whenever `tripType === 'oneway'`; not restored when switching back | High |
| Passengers | Visible, 1-9 stepper | Visible, 1-9 stepper | Reflected only when `> 1`; no hotel guest semantics | Preserved when switching trip type | Medium |
| Flexible dates | Visible checkbox | Visible checkbox | Sent with search URL only when depart exists | Preserved when switching trip type | Low |
| Guest count | Not present | Not present | Not present | Not applicable | Product-surface mismatch |
| Room context | Not present | Not present | Not present | Not applicable | Product-surface mismatch |
| Results tab | Defaults to flights for new searches | Defaults to flights for new searches | Hotels disabled when no hotel data/skipped/unavailable | Tab selection can persist only through URL/share or explicit tab click | Low |

## Findings

### P1 - Return date is silently lost when switching round trip to one way and back

File references:

- `app/page.tsx:565`
- `app/page.tsx:665`
- `app/page.tsx:994`
- `app/page.tsx:1078`
- `components/search/SearchPanel.tsx:94`
- `components/search/SearchPanel.tsx:219`

Impact:

Paid users can enter a valid hotel-eligible round-trip search, briefly switch trip type, and lose the return date without an explicit confirmation, undo affordance, or visible explanation. Because hotel lookup requires destination, depart, and return dates, this silently changes hotel eligibility.

Repro steps:

1. Open the homepage search form.
2. Select an origin and destination.
3. Enter a depart date and return date.
4. Leave trip type as `Round trip`.
5. Click `One way`.
6. Click `Round trip`.
7. Observe that the return date field is blank.
8. Submit search.
9. Observe hotel availability is skipped because the return date no longer exists.

Expected:

The switch should be explicit and recoverable. Either preserve the previous return date for restoration when returning to round trip, or communicate that switching to one way clears the return date before the user loses it.

Actual:

`app/page.tsx` clears `returnDate` in an effect whenever trip type becomes one-way. `SearchPanel` does not clear its local `returnDate` state while hidden, but its submit helper drops it for one-way submissions. Neither surface provides explicit reset messaging.

### P2 - Hotel criteria are not separately visible before submit, so submitted hotel criteria cannot be fully compared to a hotel summary

File references:

- `app/page.tsx:706`
- `app/page.tsx:909`
- `app/page.tsx:916`
- `app/page.tsx:1399`
- `app/api/search/route.ts:289`

Impact:

The ticket asks to verify submitted hotel criteria against the visible search summary, including guest counts and room context. The current UI only has flight-oriented route/date/passenger fields and a results header. It does not show a hotel-specific summary before results load and does not collect guests or rooms.

Repro steps:

1. Enter origin, destination, depart, return, and 2 passengers.
2. Submit the search.
3. During loading, inspect the visible summary.
4. Compare it to hotel lookup criteria.

Expected:

Before or during results load, the user should see the criteria that determine hotel lookup, including check-in/check-out and guest or room context if those are supported.

Actual:

The visible summary is route/date/passenger text derived from `originDisplay`, `destDisplay`, `depart`, `returnDate`, and passenger count. Hotel lookup runs only when `destIATA && depart && ret`; no hotel guest/room criteria exist locally to compare.

### P2 - Hotel tab disabled state is accurate but not recoverable from results without returning to the form

File references:

- `app/page.tsx:916`
- `app/page.tsx:920`
- `app/page.tsx:1363`
- `app/page.tsx:1399`

Impact:

When hotel lookup is skipped, unavailable, or has no loaded hotel data, the Hotels tab is disabled and the app shows explanatory copy. This is honest, but it blocks users from opening a hotel empty state directly. Recovery requires using `Edit search`, which is available lower on the page or via the header.

Repro steps:

1. Enter origin and destination.
2. Switch to one-way, or leave return date blank.
3. Submit search.
4. Observe the Hotels tab shows `Unavailable` and is disabled.
5. Observe the notice says hotels were not included and explains required dates.

Expected:

The disabled action should either remain clearly explained near the disabled control or let users open a hotel empty state with an edit action.

Actual:

The explanation is nearby after results finish, but the disabled tab itself is not actionable. During loading, the Hotels tab can show as unavailable while the search is still in progress.

## Manual Verification Flow

Source-level verification for required flow:

1. Enter hotel-eligible criteria: origin, destination, depart, return, passengers.
2. Switch trip type from round trip to one way.
3. Switch trip type back to round trip.
4. Submit.
5. Compare visible results summary to hotel criteria.

Result:

The return date is cleared at step 2 and not restored at step 3. At submission, hotel lookup is skipped because the submitted criteria no longer contain a return date. Visible summary also no longer includes checkout date.

## Viewport Observations

Live browser verification was blocked by the execution environment:

- `npm run dev` failed with `listen EPERM: operation not permitted 0.0.0.0:3001`.
- `npx next dev -H 127.0.0.1 -p 4010` failed with `listen EPERM: operation not permitted 127.0.0.1:4010`.

Source-level 375px/mobile observations:

- Search form route fields stack to one column below `lg`; date fields stack to one column below `sm`, reducing overlap risk.
- Trip type controls are two equal buttons with `min-h-11`, usable at 375px.
- Results tabs use horizontal overflow, so flights/hotels controls should remain reachable rather than overlap.
- The three-column trust stats block on the form remains three columns at mobile width; copy is short, but this is the highest source-level text wrapping risk in the inspected form.

Desktop observations from source:

- Main form uses a two-column hero/form grid only at `lg`, with the form minmax constrained to `620px`.
- Results cards use 1/2/3 columns across breakpoints.
- No source-level evidence of hidden primary search action; submit button is full width.

Keyboard/focus observations from source:

- Trip type buttons are native buttons and keyboard focusable.
- Airport inputs implement combobox roles and arrow/enter/escape handling.
- Switching trip type does not move focus or announce that the return date was cleared.
- If focus is on the return date and the user activates one-way by pointer or keyboard, the return date input unmounts; no explicit focus destination is set.

## Blockers

- Live browser screenshots could not be captured because the sandbox disallows opening listening sockets.
- The requested hotel-specific component files and hotel search-mode controls are absent from this worktree.

## Out-of-Scope Findings

- `components/search/SearchPanel.tsx` appears separate from the live homepage form in `app/page.tsx`; behavior differs from the homepage because it hides but retains return-date state locally, then strips it only at submit for one-way searches.
- The app has hotel provider handling and hotel result cards, but no dedicated hotel-only search mode, guest count, or room context.

