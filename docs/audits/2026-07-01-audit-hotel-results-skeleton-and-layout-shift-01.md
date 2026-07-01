# AUDIT-HOTEL-RESULTS-SKELETON-AND-LAYOUT-SHIFT-01

## Scope Checked

Requested files present in this worktree:

- `app/page.tsx`
- `app/globals.css`
- `components/search/SearchPanel.tsx`

Requested files absent from this worktree:

- `components/search/SearchSummary.tsx`
- `components/hotels/HotelResults.tsx`
- `components/hotels/HotelCard.tsx`
- `components/hotels/HotelPrice.tsx`
- `components/hotels/HotelPolicySummary.tsx`
- `app/api/hotels/route.ts`

Equivalent local hotel surfaces inspected:

- `app/components/HotelCard.tsx`
- `app/api/search/route.ts`

Browser/manual viewport verification was blocked because the local Next dev server failed to bind in this sandbox with `listen EPERM: operation not permitted 127.0.0.1:3000`.

## Findings

### P1 - Hotels tab cannot be opened during hotel loading from the default search path

Evidence: `app/page.tsx:706` sets hotel availability to `loading` when a round-trip destination/date search starts. `app/page.tsx:916` only disables the Hotels tab for `idle`, `skipped`, and `unavailable`, so the loading state is technically enabled. However, `runSearch` resets the active tab to `flights` unless a deep link explicitly passes `tab=hotels` at `app/page.tsx:717`.

Repro steps:

1. Start from the search form.
2. Enter origin, destination, departure date, and return date.
3. Submit the search.
4. Observe that the user lands on the Flights tab while hotels are loading after flight providers finish.

Impact: the primary hotel loading state is not visible in the normal search path. Users only see hotel loading if they manually switch tabs during the narrow loading window or load a `tab=hotels` URL. This weakens orientation because hotel status is mostly represented as a tab badge rather than a visible results region.

### P1 - Hotel loading grid appends and removes skeleton cards, causing likely vertical result jumps

Evidence: when `activeTab === 'hotels'` and `isSearching` is true, `app/page.tsx:1437` to `app/page.tsx:1450` renders current hotels plus either six skeleton cards or two extra skeletons after partial results. When loading ends, `app/page.tsx:1472` to `app/page.tsx:1483` replaces that with only real hotel cards.

Repro steps:

1. Open results with `tab=hotels` or switch to Hotels during a round-trip hotel search.
2. Observe the loading grid with six skeleton cards before hotel results arrive.
3. Let hotel results resolve.
4. Compare scroll height and footer position after skeleton removal.

Impact: the results container does not reserve a stable post-load height. On mobile 375px this can move the footer and any below-fold content significantly when six skeletons collapse to zero, one, or fewer real cards. If real hotels arrive while still searching, the grid grows by appending two skeletons after real cards, then shrinks again when `isSearching` becomes false.

### P2 - Per-card Deal Score loading reserves less height than the final hotel score panel

Evidence: `app/components/HotelCard.tsx:240` renders a fixed `h-24` shimmer while hotel score is loading. The final score panel at `app/components/HotelCard.tsx:117` to `app/components/HotelCard.tsx:167` can include Deal Score heading, percentile or low-confidence copy, badge, usual price, vs median, warning text, and explanation.

Repro steps:

1. Render a hotel card with `loading=true`.
2. Resolve a low-confidence score or a long explanation.
3. Compare card height before and after score resolution.

Impact: the card CTA sits below the score panel at `app/components/HotelCard.tsx:248`. If the score panel becomes taller than `h-24`, the nightly rate and `Check with HotelLook` CTA shift downward. This is especially risky on 375px mobile where the hotel CTA is full width and already below the price block.

### P2 - Hotel score failure removes the score region entirely

Evidence: hotel score request failures set the hotel score to `null` in `app/page.tsx:621` to `app/page.tsx:625`. `app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244` renders a score shimmer while loading, a score panel when score exists, and nothing when score is null.

Repro steps:

1. Render a hotel card while `hotelScoreLoading` contains the hotel ID.
2. Let `/api/score` fail for that hotel.
3. Observe the score shimmer disappear with no replacement state.

Impact: the CTA and price block jump upward after a score failure. It also makes the card look less complete with no explanation that hotel scoring failed or was unavailable.

## Passing Source-Level Checks

- Mobile grid source behavior collapses hotel results to one column before `sm` at `app/page.tsx:1438` and `app/page.tsx:1473`.
- Hotel CTA is full width on mobile through `btn-primary-responsive` at `app/components/HotelCard.tsx:262` and `app/globals.css:254`.
- Long hotel names clamp to two lines and hotel area truncates at `app/components/HotelCard.tsx:208` and `app/components/HotelCard.tsx:217`.
- Empty, skipped, and unavailable hotel states use a coherent `ResultsStatePanel` with an `Edit search` action at `app/page.tsx:1452` to `app/page.tsx:1471`.
- The top sticky result header preserves route context and an Edit affordance at `app/page.tsx:1244` to `app/page.tsx:1271`.

## Self-Review

- Hierarchy: hotel cards keep name, class/rating, score, price, and CTA in a sensible order, but score loading can push the primary CTA.
- Contrast: no new contrast defects found in the inspected loading states; existing dark-theme gray labels remain low-emphasis.
- Spacing: skeleton grid spacing is consistent, but container height is not stable across loading and completion.
- Mobile fit: source-level structure is one-column at 375px with full-width CTA; true viewport confirmation is blocked.
- Focus states: global `:focus-visible` exists; no dedicated focus movement after hotel results load was found.
- Decorative effects: loading uses shimmer, progress, and pulse dots only; no new decorative clutter or marketing content observed.

## Blockers And Out-Of-Scope Notes

- Blocker: manual 375px and desktop browser verification could not be completed because the dev server cannot bind in this sandbox.
- Blocker: ticket-named hotel component/API files are absent; current implementation is inline in `app/page.tsx` plus `app/components/HotelCard.tsx` and `/api/search`.
- Out of scope: no provider latency, fake hotel data, booking behavior, or homepage redesign changes were made.
