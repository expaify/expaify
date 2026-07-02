# UXR-RESULTS-TAB-INVENTORY-AWARENESS-01: UX Research Brief

## Inputs Read

- Discovery: `docs/pipeline/results-tab-inventory-awareness/01-discovery.md`
- Current implementation: `app/page.tsx`, `components/flights/FlightResults.tsx`, `app/api/search/route.ts`, `app/api/search/__tests__/route.test.ts`, `lib/types.ts`
- Reference patterns:
  - Google Flights help documents result browsing through explicit "Best" and "Cheapest" result tabs and filtering after route/date entry, so tab labels identify result modes rather than leaving users to infer readiness from counts alone. Source: https://support.google.com/travel/answer/2475306?hl=en
  - Google Hotels help frames hotel results as adjustable by dates, people, filters, sort, and map/location changes, and Google Hotel Search exposes distinct "No results" and "Having trouble loading results" states. Sources: https://support.google.com/travel/answer/6276008?hl=en and https://search.google.com/local/places/hotel/categorical
  - KAYAK's public positioning is cross-inventory search across flights, hotels, and rental cars, which reinforces the interaction expectation that a travel metasearch surface should make each inventory type's availability independently legible. Source: https://www.kayak.com/

## Current Implementation Audit

`app/page.tsx` has a hotel-specific availability model: `idle`, `loading`, `available`, `empty`, `unavailable`, and `skipped` are stored separately from `hotels.length` at lines 535-536. During `runSearch`, hotels start as `loading` only when destination, departure date, return date, and round-trip type are present; otherwise they become `skipped`. The stream updates hotel status from `hotel-status` messages and separately updates hotel offers from `hotels` messages.

The tab bar does not expose that state model. At `app/page.tsx` lines 1458-1485, each tab badge shows a raw count except when the hotel tab is disabled, where the badge becomes the broad label `Unavailable`. That means `loading`, `empty`, `unavailable`, and `skipped` are collapsed into either `0` or `Unavailable`, depending on tab disabled state and timing.

The top results summary also collapses state into counts. When the search is complete and not errored, `app/page.tsx` reports `{flights.length} flights · {hotels.length} hotels` even if `0 hotels` means provider unavailable, skipped for missing dates, or an actual completed empty hotel result. During search, the summary shows only the broad loading label for the selected intent.

Flight state is richer inside `components/flights/FlightResults.tsx`. Lines 401-448 distinguish provider notices, incomplete dates, filters hiding returned fares, true no-supply, and loading. The gap is that this meaning appears only after the user is already in the flight tab. There is no equivalent tab-level flight status vocabulary for an inactive Flights tab when the user is viewing Hotels.

Hotel state is richer after entering the hotel tab. `app/page.tsx` lines 1538-1615 show hotel skeletons while loading, empty/provider/skipped panels after completion, and actions such as retry, change dates, search hotels nearby, and edit search. The inactive Hotels tab, however, only shows `0`, a disabled state, or `Unavailable`.

The API already provides the necessary source of truth. `app/api/search/route.ts` lines 381-387 emits a no-supply flight notice when no flight provider returns fares and no provider issue exists. Lines 393-420 emit hotel states as `available`, `empty`, `unavailable`, or `skipped`. A UI solution should derive inventory awareness from these existing messages and client state, not add external calls.

## Reference Pattern Delta

Google Flights uses tabs for result modes such as best or cheapest after the route/date query is established. The interaction lesson is that tabs should be self-describing and should not require users to open a tab to understand what kind of result set or state it contains.

Google Hotels separates "no results" from "having trouble loading results" and gives recovery direction such as adjusting dates, people, or location. The interaction lesson is that empty inventory and loading/provider failure are different states with different user actions.

Cross-inventory travel search products set the expectation that flights and hotels can be independently ready, empty, loading, or unavailable. Expaify currently has the backend/client state to honor that expectation, but the tab bar and summary hide it.

## Exact Gap

- Current code: Hotels have a state enum, but the tab badge displays only count or `Unavailable`.
- Reference pattern: Travel result surfaces distinguish loading, no results, and trouble-loading states at the result navigation level or immediately adjacent to it.
- Delta: Expaify needs a shared tab-level inventory status layer for both Flights and Hotels so inactive inventory can be understood without tab switching.

- Current code: Flight provider notices are panel-level only and are filtered inside `FlightResults`.
- Reference pattern: Result navigation should identify readiness before deeper filtering or card review.
- Delta: The parent results surface needs a flight inventory status derived from `isSearching`, `flights.length`, `providerNotices`, and completion state.

- Current code: `0 hotels` can mean not checked, still loading, no hotels returned, or provider unavailable.
- Reference pattern: Empty and unavailable states use separate copy and recovery.
- Delta: Counts must be paired with explicit status copy before users interpret zero as a completed result.

## Design Directives

1. Define one shared tab status vocabulary for both inventory types: `checking`, `available`, `empty`, `unavailable`, and `not checked`. Do not surface `idle` to users. Map Hotels from `hotelAvailability`; map Flights from `isSearching`, `flights.length`, non-hotel `providerNotices`, and search completion.

2. Each tab must show both count and status when status is not simply available. Required badge copy:
   - `Checking` while that inventory type is actively waiting for provider results.
   - `{N}` when `N > 0`.
   - `None` for completed empty provider result.
   - `Issue` for provider unavailable or malformed provider response.
   - `Not checked` when missing destination, missing required dates, or search intent skipped that inventory type.

3. The top summary must stop using bare zero counts for non-available states. Required copy examples:
   - `Flights checking · Hotels checking`
   - `3 flights · Hotels checking`
   - `3 flights · No hotels returned`
   - `Flights unavailable · Hotels not checked`
   - `No flights returned · 4 hotels`

4. Disabled tab behavior must be reserved for `not checked` only. Empty and unavailable tabs must remain keyboard reachable so users can open the tab-level panel and see recovery actions. A disabled Hotels tab may be used only when hotels were skipped because required trip details are missing or because the selected search intent did not include hotels.

5. Inactive-tab helper copy must mirror the same status vocabulary and never contradict the badge. Required helper rules:
   - `checking`: `Hotel results are still checking. You can keep reviewing flights while hotel availability finishes.`
   - `empty`: `No hotels were returned for these dates. Change dates or broaden the stay area.`
   - `unavailable`: `Hotel inventory was not confirmed because the provider is unavailable. Retry this search or edit trip details.`
   - `not checked`: use the exact missing requirement, e.g. `Add departure and return dates to check hotel availability.`

6. Accessibility requirements for UI stage: tabs must expose selected state with `aria-selected`/tab semantics or keep button semantics with an explicit `aria-label` that includes inventory name, count, and status. Status changes while a search streams must be announced through one polite live region near the tab bar, not only inside active tab panels.

7. Mobile requirement: at 375px, each tab label must remain scannable without horizontal reliance on truncated status text. If space is tight, use a two-line tab layout: inventory label on the first line and status badge on the second line.

## Testable Acceptance Criteria for UXDES/UI

- During a flight + hotel round-trip search, while no hotel messages have arrived, the Hotels tab badge reads `Checking`, not `0`.
- When hotel provider returns `{ type: 'hotel-status', status: 'empty' }`, the Hotels tab remains enabled and its badge reads `None`.
- When hotel provider returns `{ type: 'hotel-status', status: 'unavailable' }`, the Hotels tab remains enabled and its badge reads `Issue`.
- When the trip is one-way or missing return date, the Hotels tab may be disabled and its badge reads `Not checked`.
- When flights have zero results and only a no-supply notice, the Flights tab/status summary says `No flights returned`, not provider unavailable.
- When flights have zero results and one or more non-hotel provider unavailable notices, the Flights tab/status summary says `Flights unavailable`.
- The top summary never renders `0 flights` or `0 hotels` without a qualifying state word.
- Keyboard users can tab to every available/empty/unavailable tab and reach the corresponding recovery panel.

## Research Conclusion

The current implementation has enough backend and client state to solve inventory awareness without changing provider behavior. The UX gap is presentation and consistency: state is explained too late, after tab entry, and the inactive tab compresses materially different states into `0` or `Unavailable`. UXDES should specify a shared parent-level inventory status model and exact tab/summary copy before UI implementation.
