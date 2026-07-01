# AUDIT-HOTEL-AVAILABILITY-EMPTY-STATE-HONESTY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Hotel loading, empty, provider error, partial inventory, and no-matching-result honesty in the current worktree.

## Verdict

Conditional pass with P0/P1 UX gaps.

The app does not create fake hotel inventory and the provider boundary returns honest `hotel-status` events for empty, skipped, and unavailable hotel searches. The weak point is recovery: provider-unavailable and skipped hotel states disable the Hotels tab, so the user cannot open the hotel-specific empty/error panel with its primary `Edit search` action. They only see a passive "Hotels were not included" notice under the flight results.

Several ticket files do not exist in this worktree: `app/api/hotels/route.ts`, `components/hotels/HotelResults.tsx`, `components/search/SearchSummary.tsx`, and `lib/providers/hotels.ts`. The audited local hotel surfaces are `app/page.tsx`, `app/api/search/route.ts`, `app/components/HotelCard.tsx`, `components/search/SearchPanel.tsx`, `lib/providers/hotellook.ts`, `lib/providers/index.ts`, and `lib/types.ts`.

## Findings

### P0 - Provider error and skipped hotel states hide the hotel recovery action

Evidence:
- The Hotels tab is disabled when there are no hotels and `hotelAvailability` is `idle`, `skipped`, or `unavailable` (`app/page.tsx:916`, `app/page.tsx:1363` to `app/page.tsx:1397`).
- When disabled and not searching, the app renders only a passive notice: "Hotels were not included." plus the provider/skipped copy (`app/page.tsx:1399` to `app/page.tsx:1403`).
- The hotel-specific empty/error panel with the visible `Edit search` action only renders inside `activeTab === 'hotels'` (`app/page.tsx:1435` to `app/page.tsx:1471`), but users cannot activate that tab in the `unavailable` or `skipped` states.

Impact:
Paid users who hit a hotel provider outage or an ineligible hotel search get an explanation but not a primary recovery action in the hotel area. The edit affordance remains in the sticky results header (`app/page.tsx:1254` to `app/page.tsx:1271`), but it is subtle and route-summary shaped, not an explicit hotel recovery step.

Repro:
1. Trigger a round-trip search with hotel provider failure, e.g. mocked `hotellook.searchHotels` returning `{ ok: false, reason: 'HotelLook timed out' }`.
2. Wait for search completion.
3. Observe the Hotels tab label as `Unavailable` and disabled.
4. Observe only the passive notice under the Flights tab; the hotel panel's `Edit search` button cannot be reached.

### P1 - Empty inventory copy is honest but underspecified

Evidence:
- API emits `status: 'empty'` with "No hotels were returned for these dates." when the provider returns `{ ok: true, data: [] }` (`app/api/search/route.ts:292` to `app/api/search/route.ts:298`).
- UI maps that to title "No hotel inventory found" and body "No hotels were returned for these dates." (`app/page.tsx:917` to `app/page.tsx:934`, `app/page.tsx:1453` to `app/page.tsx:1471`).
- The panel preserves route/date/passenger context via `resultContext` (`app/page.tsx:909` to `app/page.tsx:914`, `app/page.tsx:1467` to `app/page.tsx:1470`).

Impact:
The copy does not falsely imply inventory exists, but it gives only one next step: `Edit search`. It does not name practical recovery options such as nearby dates or a different destination. This is not misleading, but it is thin for paid-user recovery.

Repro:
1. Run a round-trip destination search with mocked `hotellook.searchHotels` resolving `{ ok: true, data: [] }`.
2. Click Hotels.
3. Observe "No hotel inventory found", "No hotels were returned for these dates.", route/date context, and `Edit search`.

### P1 - Hotel loading is delayed behind flight provider completion

Evidence:
- API does not start hotels until after all flight providers finish (`app/api/search/route.ts:220` to `app/api/search/route.ts:289`).
- UI sets hotel availability to `loading` at search start for eligible round trips (`app/page.tsx:706`) and renders skeleton cards if the Hotels tab is active during search (`app/page.tsx:1435` to `app/page.tsx:1451`).

Impact:
Loading is visually coherent if the user is on the Hotels tab, but the label "Scanning deals across providers..." is flight/deal-generic (`app/page.tsx:1277` to `app/page.tsx:1285`). Hotel users may wait through all flight providers before the hotel provider is actually queried.

Repro:
1. Open a URL with `tab=hotels`, destination, depart, return, and `trip=roundtrip`.
2. While search is active, observe hotel skeletons.
3. Note that hotel provider work only begins after flight provider promises resolve.

### P2 - Ticket asks for guests, rooms, and currency persistence, but those controls are absent

Evidence:
- Shared hotel search contract only accepts `area`, `checkin`, and `checkout` (`lib/types.ts:85` to `lib/types.ts:90`).
- Search state tracks passengers but not hotel guests, rooms, or selected currency (`app/page.tsx:481` to `app/page.tsx:516`).
- HotelLook hardcodes `currency=USD` and returns `pricePerNight: { priceCents, currency: 'USD' }` (`lib/providers/hotellook.ts:74` to `lib/providers/hotellook.ts:115`).

Impact:
Destination, dates, trip type, and passenger count remain visible/editable, but guests, rooms, and currency cannot remain visible because they are not current local product surfaces. This is a ticket/worktree mismatch, not a UI regression.

## States Observed

| State | Trigger | UI result | Honesty assessment |
| --- | --- | --- | --- |
| Loading | Eligible round trip starts with destination, depart, return, and Hotels tab active | Hotel skeleton cards render during search | Coherent, but hotel provider query is delayed until flights finish |
| Available | `hotel-status: available` plus `hotels` data | Hotels tab enabled, hotel cards render | Pass; no fake fallback results |
| Empty/no matching results | Hotel provider returns `{ ok: true, data: [] }` | Hotels tab enabled with `0`; panel says no hotel inventory found and shows context plus `Edit search` | Pass for honesty, partial for next steps |
| Provider error | Hotel provider returns `{ ok: false }` or throws | Hotels tab disabled as `Unavailable`; passive notice says provider unavailable or timeout | Fails recovery-action visibility |
| Skipped | One-way search, missing destination, or missing return date | Hotels tab disabled as `Unavailable`; passive notice explains destination/dates needed | Honest, but hidden hotel-specific recovery action |
| Partial inventory | Some providers fail but HotelLook returns hotel rows | Hotel cards render; flight provider notices remain in flight area | Hotel partial-provider state is not separately expressible because only one hotel provider exists |

## Search Context Persistence

Pass for implemented fields:
- Desktop result header shows route and dates, with an `Edit` affordance (`app/page.tsx:1254` to `app/page.tsx:1271`).
- The hotel empty panel shows `resultContext`, including route, dates, and passenger count when present (`app/page.tsx:909` to `app/page.tsx:914`, `app/page.tsx:1467` to `app/page.tsx:1470`).
- The form remains populated when `setView('form')` is used for edit recovery because search criteria live in component state (`app/page.tsx:481` to `app/page.tsx:516`).

Not applicable in this worktree:
- Guests, rooms, and user-selected currency are not modeled on the current hotel search surface.

## Mobile 375px Notes

Exact notes from code inspection:
- The results header uses a compact route summary button. Dates are hidden on small screens via `hidden ... sm:inline`, so 375px users see route plus `Edit`, but not dates in the sticky header (`app/page.tsx:1254` to `app/page.tsx:1271`).
- The hotel empty/error panel action column becomes full width on small screens through `ResultsStatePanel` (`app/page.tsx:379` to `app/page.tsx:395`), so `Edit search` should remain reachable when the panel is reachable.
- The blocking issue on 375px is state access, not layout: provider unavailable/skipped disables the Hotels tab, preventing access to the full-width `Edit search` button.

## Desktop Notes

Exact notes from code inspection:
- Desktop result header shows route and dates in the sticky edit button (`app/page.tsx:1254` to `app/page.tsx:1271`).
- Hotel cards use a three-column grid at large widths (`app/page.tsx:1437` to `app/page.tsx:1451`, `app/page.tsx:1473` to `app/page.tsx:1483`).
- Empty/error panel lays out copy and action side by side on desktop (`app/page.tsx:379` to `app/page.tsx:395`).
- Provider unavailable/skipped still hides the hotel-specific panel because the tab is disabled, so the desktop recovery issue matches mobile.

## Manual Verification Flow

1. Results expected:
   - Mock `hotellook.searchHotels` to return at least one valid `HotelOffer`, or use configured `TP_TOKEN` and `HOTEL_AFFILIATE_ID` with a valid round-trip destination search.
   - Search `origin=JFK`, `dest=LAX`, future `depart`, future `return`, `trip=roundtrip`.
   - Expected: Hotels tab enabled with count, hotel cards render, no fake fallback hotels.
2. No hotel results:
   - Mock `hotellook.searchHotels` to return `{ ok: true, data: [] }`.
   - Repeat the same round-trip search.
   - Expected: Hotels tab enabled with `0`; panel says "No hotel inventory found"; destination/dates/passengers appear in context; `Edit search` returns to populated search form.
3. Provider error:
   - Mock `hotellook.searchHotels` to return `{ ok: false, reason: 'HotelLook timed out' }` or throw.
   - Repeat the same round-trip search.
   - Expected actual: Hotels tab disabled as `Unavailable`; passive notice says inventory was not confirmed/provider unavailable; hotel-specific `Edit search` action is hidden.
4. Skipped hotel search:
   - Run one-way search or omit destination/return date.
   - Expected actual: Hotels tab disabled as `Unavailable`; passive notice explains missing destination/dates; explicit hotel recovery action is hidden.
5. Mobile 375px:
   - Repeat steps 2 to 4 at 375px width.
   - Confirm no overlapping text in the panel when reachable; confirm dates are not visible in the sticky header on mobile.
6. Desktop:
   - Repeat steps 2 to 4 at desktop width.
   - Confirm route and dates are visible in the header and context line; confirm provider error recovery remains passive.

## Verification Commands

- `npm run typecheck` failed because `package.json` has no `typecheck` script.
- `npx tsc --noEmit --incremental false` passed.
- `npm test -- --runInBand` passed: 20 suites, 176 tests.

## Changed Files

- Added this audit report only. No product code was changed.

## Blockers and Out-of-Scope Notes

- Browser screenshots were not captured; the report uses exact mobile and desktop notes from code inspection.
- Standalone hotel route/results components listed by the ticket are absent from this worktree.
- Guests, rooms, and currency controls are absent from the current local hotel search contract.
- No new providers, fake hotel results, Deal Score changes, card redesign, or booking flow changes were made.
