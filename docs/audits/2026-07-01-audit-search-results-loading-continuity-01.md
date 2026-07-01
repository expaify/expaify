# AUDIT-SEARCH-RESULTS-LOADING-CONTINUITY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Audit only. No product code changed.

## Verdict

Fail.

The first-submit loading state is clear and previous completed results are cleared before the new results shell renders. The loading copy does not claim confirmed prices or availability before providers return.

The blocking issue is search concurrency. `runSearch` does not abort or identity-check the active request. If a user starts search A, edits, then starts search B before A resolves, the still-running A stream can write flights, provider notices, hotel status, scores, and `isSearching=false` into the B results page. That can expose booking links for the wrong route under the newer route header.

Runtime screenshot verification was blocked because the local Next dev server cannot bind in this sandbox: `listen EPERM: operation not permitted 127.0.0.1:3017`. Mobile and desktop notes below are source-level responsive-state notes, not screenshots.

## Files Inspected

- `app/page.tsx`
- `components/search/SearchPanel.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/api/search/route.ts`
- `app/globals.css`

Requested files not present under the exact paths named in the ticket:

- `components/ResultsList.tsx`
- `components/ResultCard.tsx`
- `components/BookingPanel.tsx`

The active results/card path is `components/flights/FlightResults.tsx`, `app/components/FlightCard.tsx`, and `app/components/HotelCard.tsx`. `components/search/SearchPanel.tsx` exists but is not used by `app/page.tsx`.

## Immediate Post-Submit State

Source evidence:

- `runSearch` validates inputs before changing view (`app/page.tsx:658` to `app/page.tsx:685`).
- On valid submit it sets `isSearching=true`, clears `error`, `suggestion`, `providerNotices`, `flights`, `hotels`, `scores`, hotel scores, and alert state, then switches to results (`app/page.tsx:687` to `app/page.tsx:718`).
- The results header shows `Scanning deals across providers...` while searching (`app/page.tsx:1277` to `app/page.tsx:1285`).
- Flight results show disabled sort/stop controls with `0 results`, plus a status panel titled `Checking live flight inventory` and six skeleton fare cards while no fares have streamed yet (`components/flights/FlightResults.tsx:217` to `components/flights/FlightResults.tsx:309`).

Expected user-visible state immediately after submit:

- Prior completed fare/hotel cards are removed.
- Header preserves user intent through the sticky route/date summary.
- Search progress bar and loading copy appear.
- Flight sort/stop controls are visible but disabled until fares load.
- No booking CTA is visible until a fare streams in.

Pass with the concurrency exception below.

## Findings

### P1 - Older in-flight searches can overwrite the newer search results and expose stale booking CTAs

Evidence:

- `runSearch` starts a fetch and reads the NDJSON stream, but there is no `AbortController`, request token, or active-search guard (`app/page.tsx:721` to `app/page.tsx:805`).
- Each stream owns its own `accumulated` array and writes directly to shared state with `setFlights(dedup(accumulated))` (`app/page.tsx:734` to `app/page.tsx:762`).
- Any stream can set `setIsSearching(false)` when it receives `done` or exits, regardless of whether a newer search is still active (`app/page.tsx:796` to `app/page.tsx:808`).
- Fare cards render live provider links whenever `displayFlights` has fares with valid prices/deeplinks (`components/flights/FlightResults.tsx:324` to `components/flights/FlightResults.tsx:334`, `app/components/FlightCard.tsx:352` to `app/components/FlightCard.tsx:379`).

Repro:

1. Submit search A, for example `JFK` to `LHR` with valid future round-trip dates.
2. Before A finishes, use the sticky `Edit` control.
3. Change the route to search B, for example `LAX` to `NRT`, and submit.
4. Wait for provider chunks from A and B to resolve in either order.
5. Expected: only B can update B's results page, and A is aborted or ignored.
6. Actual from source: A can still write `JFK to LHR` fares into the shared results state after B starts. The header can show B criteria while cards and booking links belong to A.

Impact:

Paid users can click a provider handoff for the wrong trip while the page visually implies the newer search intent. This directly violates stale result and booking-action continuity requirements.

### P1 - A stale request can prematurely end the newer loading state

Evidence:

- `isSearching` is global, not request-scoped (`app/page.tsx:428`).
- Both old and new `runSearch` calls call `setIsSearching(false)` independently (`app/page.tsx:796` to `app/page.tsx:808`).

Repro:

1. Start search A.
2. Immediately start search B.
3. Let A finish before B.
4. Expected: loading remains visible until B finishes.
5. Actual from source: A can set `isSearching=false`, hiding the progress bar/skeleton state while B is still reading its stream.

Impact:

The page can look complete while the active user-intended search is still pending.

### P2 - Empty flight state can mislabel no-supply as provider unavailability

Evidence:

- The API sends a `notice` with status `no_supply` and message `No flight providers returned matching fares for this search.` when providers return no fares without provider errors (`app/api/search/route.ts:268` to `app/api/search/route.ts:275`).
- `FlightResults` treats any flight notice plus zero fares as `hasProviderUnavailable` (`components/flights/FlightResults.tsx:139`).
- That produces the title `Flight providers unavailable`, even for `no_supply` (`components/flights/FlightResults.tsx:143` to `components/flights/FlightResults.tsx:151`).

Repro:

1. Submit a valid future search that returns no flight supply but no provider outage.
2. Observe the empty state after loading.
3. Expected: no inventory found/no matching fares.
4. Actual from source: the page can show `Flight providers unavailable` while also saying no matching fares were returned.

Impact:

The empty state is coherent enough to recover, but it can misstate the cause and reduce trust.

## State Notes

Loading:

- First valid submit clears prior completed results and shows progress, disabled controls, status copy, and skeleton cards.
- Copy says providers are being checked and fare cards will appear as usable prices return. It does not imply confirmed prices or availability.
- During streaming, real current-search cards can appear while `isSearching` remains true; this is acceptable only if request identity is guarded.

Populated results:

- Flight cards expose booking/provider CTAs only after a fare with valid money and deeplink exists.
- CTA note says price and availability can change.
- Deal-score skeletons can remain while score calls resolve, but price/booking CTAs are already active.

Previous completed results during a new submit:

- Prior `flights` and `hotels` are cleared before the results view is shown, so a normal second submit does not intentionally keep old cards visible.
- This pass is invalidated when an older in-flight request resolves after the second submit.

Empty:

- Empty and filter-hidden states have recovery actions.
- No-supply can be mislabeled as provider unavailable as noted above.

Error:

- Search errors render an alert-style panel with Retry and Edit actions.
- Retry uses the same unguarded `runSearch` path.

Mobile 375px source notes:

- Results use a single-column grid below `sm`, full-width cards, full-width alert/recovery actions, and horizontally scrollable tabs.
- The sticky header route summary truncates long route labels instead of wrapping over controls.
- No source-level overlap was found in the primary loading/empty/error structures.

Desktop source notes:

- Results grid expands to two columns at `sm` and three columns at `lg`.
- Sort and stop controls sit in a two-column control band on larger screens.
- Header and Share button are separated with flex layout.

## Manual Verification Flow

Blocked for browser screenshots by local server bind restrictions.

Source-level flow result:

1. First valid search: pass for clearing prior completed results and showing loading.
2. Immediate second different search: fail because the first request can continue mutating shared state after the second request starts.
3. Booking action during loading: no action is visible before any fare streams, but stale in-flight fares from an older request can create active booking links during the newer search.

## Out Of Scope / Blockers

- No UI fix was implemented because the ticket is audit-only.
- No provider adapter/API contract changes were made.
- Runtime screenshot capture was blocked by `listen EPERM` on local server startup.
