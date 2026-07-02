# UXD-RESULTS-TAB-INVENTORY-AWARENESS-01: Results Tab Inventory Awareness

## User Pain Point

When a flight + hotel search is running or complete, users can stay focused on one results tab without a clear, persistent understanding of whether the other inventory type is still loading, available, empty, unavailable, or was never checked, which weakens confidence that the trip search is complete.

## Affected Users and Flow Step

- **Users affected:** First-time users and comparison shoppers who choose "Flight + hotel" or land on a shared results URL and expect both inventory types to be accounted for before deciding what to review next.
- **Flow step:** Results review after search submission, specifically the tab bar and the state transition between flights and hotels while inventory streams in.
- **Current surfaces inspected:** `app/page.tsx` owns `activeTab`, `HotelAvailability`, the results summary, tab counts, disabled hotel tab behavior, and hotel empty states; `components/flights/FlightResults.tsx` owns flight loading, empty, provider notice, and result-count states; `app/components/FlightCard.tsx` and `app/components/HotelCard.tsx` expose card-level availability and score states; `lib/types.ts` defines shared fare, hotel, score, provider, and result contracts.

## Current Implementation Signal

- `app/page.tsx` tracks hotel inventory with `HotelAvailability = 'idle' | 'loading' | 'available' | 'empty' | 'unavailable' | 'skipped'`, but the tab badge mostly exposes a hotel count or the generic label "Unavailable".
- The hotel tab can be disabled when `hotels.length === 0` and `hotelAvailability` is `idle` or `skipped`, so users on the flight tab may see that hotels are unavailable but not the exact reason unless they read the separate helper panel below the tabs.
- During a flight + hotel search, the top summary reports only numeric counts such as `0 flights · 0 hotels`; it does not distinguish "0 because still loading", "0 because empty", "0 because skipped", or "0 because provider unavailable".
- Flight states are explained inside `FlightResults`, while hotel states are explained only when the hotel tab is active or through a disabled-tab helper. The two inventory types do not share an equivalent tab-level status vocabulary.
- Card components handle unavailable price, unavailable provider link, score pending, and score unavailable states, but those cues appear after a user enters a tab and sees cards; they do not help the user decide whether the inactive tab is ready or worth checking.

## Measurable Signal

This problem exists when any completed or in-progress search reaches a cross-tab inventory state and the inactive tab communicates only a count, disabled state, or generic unavailable label:

- `searchIntent === 'trip' && isSearching === true`
- `activeTab === 'flights' && hotelAvailability` is `loading`, `empty`, `unavailable`, or `skipped`
- `activeTab === 'hotels' && flights.length === 0` while flight providers are still loading, empty, or unavailable
- `hotels.length === 0 && hotelAvailability !== 'available'`
- `flights.length === 0 && !isSearching` with flight provider notices or empty results

Primary measurable UX signal: users cannot determine from the tab bar and results summary whether the inactive inventory type is ready, empty, blocked by missing trip details, provider-unavailable, or still worth checking without switching context or reading a secondary panel.

## Constraints

1. **Data integrity and trust:** Status labels must reflect actual search state only; do not imply inventory exists or was checked when the destination, dates, provider response, or search intent did not support that search.
2. **Performance and provider boundaries:** Inventory awareness must use state already returned by `/api/search` and provider notices; no React component may introduce direct vendor calls or extra external API requests.
3. **Accessibility and responsive usability:** Tab labels, counts, disabled states, and status copy must remain keyboard accessible, screen-reader clear, and usable at 375px mobile and 1280px desktop without overlapping or truncating critical state text.

## Success Statement

This is solved when a first-time user can submit a flight + hotel search, stay on either results tab, and understand whether the other inventory type is loading, available, empty, unavailable, or not checked without switching tabs or mistaking a zero count for a completed provider result.

## Handoff Notes for UXR

- Audit whether the tab bar, top results summary, and inactive-tab helper communicate the same inventory state or create conflicting interpretations.
- Compare interaction patterns where travel sites expose multi-inventory readiness through tab badges, status chips, disabled tab copy, and loading/empty states.
- Define exact status vocabulary for flights and hotels so UI and later QA can test tab-level states independently from card-level states.
