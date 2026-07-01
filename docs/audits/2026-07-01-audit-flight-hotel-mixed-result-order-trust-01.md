# AUDIT-FLIGHT-HOTEL-MIXED-RESULT-ORDER-TRUST-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Audit only. No product code changed.

## Verdict

Fail.

Mixed flight and hotel results are not actually presented as one interleaved ranked list. The current source of truth is a two-tab results model: flights are the default tab, hotels are a separate tab when available. That avoids a direct cross-vertical ranking claim, but it creates a trust problem for mixed searches because hotels are visually secondary and hidden behind a non-default tab even when hotel search is in scope.

The first visible result is understandable only inside the flight tab. Users can see the selected flight sort and a control summary. They cannot understand why the first hotel appears first because hotel results have no visible sort, no ordering explanation, and no dedicated hotel results component.

## Files Inspected

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `components/search/SearchPanel.tsx`
- `app/components/DealBadge.tsx`
- `app/components/HotelCard.tsx`
- `lib/scoring/scoreDeal.ts`
- `lib/types.ts`
- `lib/search/sortFlights.ts`
- `app/api/search/route.ts`

Requested files not present under the exact ticket paths:

- `components/hotels/HotelResults.tsx`
- `components/search/SearchSummary.tsx`

## Current Ordering Source Of Truth

Flights:

- Flight chunks stream from `/api/search`, are deduped in `app/page.tsx`, then stored in `flights` (`app/page.tsx:758` to `app/page.tsx:762`).
- `filteredFlights` applies the stop filter only (`app/page.tsx:889` to `app/page.tsx:893`).
- `displayFlights` is produced by `sortFlights(filteredFlights, sortBy, scores, { deferDealSort: rankingUpdating })` (`app/page.tsx:900` to `app/page.tsx:907`).
- `sortFlights` orders by price fallback until score ranking is allowed, then by high-confidence verdict, percentile, percent vs median, and price fallback (`lib/search/sortFlights.ts:14` to `lib/search/sortFlights.ts:64`).
- The visible flight control summary says when fares are sorted by best deal or lowest price (`components/flights/FlightResults.tsx:156` to `components/flights/FlightResults.tsx:158`, `components/flights/FlightResults.tsx:227` to `components/flights/FlightResults.tsx:283`).

Hotels:

- The API checks hotels only after all flight providers resolve (`app/api/search/route.ts:289` to `app/api/search/route.ts:330`).
- The client assigns the hotel provider payload directly with `setHotels(newHotels)` (`app/page.tsx:763` to `app/page.tsx:767`).
- The hotel grid maps `hotels` in array order, with no sort or ordering rationale (`app/page.tsx:1435` to `app/page.tsx:1484`).
- Hotel cards can show Deal Score details, but the hotel list is not sorted by those scores and no copy says whether provider order, price, rating, or Deal Score controls the first card (`app/components/HotelCard.tsx:118` to `app/components/HotelCard.tsx:167`).

Cross-vertical:

- Flights and hotels are separated by tabs, not mixed into one ordered list (`app/page.tsx:1363` to `app/page.tsx:1397`).
- A new search defaults to `activeTab` = `flights`, unless a parsed URL explicitly requests hotels (`app/page.tsx:716` to `app/page.tsx:719`).
- The results header summarizes only flight count: `{flights.length} flights found`, even when hotel results are present (`app/page.tsx:1293` to `app/page.tsx:1304`).

## Findings

### P1 - Hotels are hidden behind the non-default tab when hotel search is in scope

Evidence:

- Valid round-trip destination searches set hotel availability to `loading`, but `runSearch` still defaults the active tab to `flights` (`app/page.tsx:706`, `app/page.tsx:716` to `app/page.tsx:719`).
- The tab strip shows hotel count or unavailable state, but hotel cards render only after the user selects the hotels tab (`app/page.tsx:1363` to `app/page.tsx:1397`, `app/page.tsx:1435` to `app/page.tsx:1484`).
- The page header says only flight results were found and does not mention hotel availability (`app/page.tsx:1293` to `app/page.tsx:1304`).

Repro:

1. Search a valid round trip with origin, destination, departure date, and return date.
2. Wait for both flight and hotel provider responses.
3. Observe that the first visible result set is flights.
4. Observe that hotels require a tab switch even though the search CTA and hotel provider path imply a mixed flight plus hotel search.

Impact:

Hotels feel secondary in a mixed deal finder. A user can miss hotel choices entirely, especially on mobile where the tab strip is the only hotel entry point below the summary.

Smallest repair recommendation:

Add a concise mixed-results summary above the tabs when hotels are in scope, for example: flights are shown first by selected flight sort; hotels are available in the Hotels tab and shown in provider order unless a hotel sort exists. This should not create a new ranking claim.

### P1 - Hotel result order is not inspectable

Evidence:

- Hotel payload order is accepted as-is with `setHotels(newHotels)` (`app/page.tsx:763` to `app/page.tsx:767`).
- Hotel cards are rendered by `hotels.map(...)` during loading and final states (`app/page.tsx:1437` to `app/page.tsx:1451`, `app/page.tsx:1472` to `app/page.tsx:1484`).
- There is no hotel sort control, result summary, or copy explaining whether first hotel is cheapest, best Deal Score, highest rated, freshest, or provider order.

Repro:

1. Search a valid destination round trip that returns multiple hotels.
2. Open the Hotels tab.
3. Compare the first hotel to the next hotels by nightly price, Deal Score, rating, and class.
4. Expected: the UI explains why the first hotel appears first.
5. Actual from source: the first hotel is whatever the provider array returned first; the UI does not disclose that.

Impact:

Users cannot tell whether the top hotel is a recommendation or an arbitrary provider ordering. This is a trust issue because hotel cards contain Deal Score panels that imply ranking context, but that score does not drive list position.

Smallest repair recommendation:

Add a small hotel list summary in the Hotels tab: `Hotels are shown in provider order; Deal Score is shown on each card when available.` If product wants Deal Score or price order later, that should be a separate approved repair with tests.

### P2 - Loading sequence reinforces flight dominance

Evidence:

- The API streams hotels after all flight providers complete (`app/api/search/route.ts:289` to `app/api/search/route.ts:330`).
- The default visible tab is flights, and the loading header says `Scanning deals across providers` while the flight section owns the detailed loading panel and skeletons (`app/page.tsx:1277` to `app/page.tsx:1285`, `components/flights/FlightResults.tsx:299` to `components/flights/FlightResults.tsx:318`).
- Hotel loading skeletons only render if the user is already on the Hotels tab (`app/page.tsx:1435` to `app/page.tsx:1451`).

Impact:

Even when hotels are part of the search, the first visible loading and populated states are flight-first. That may be acceptable for MVP cash fares, but the UI needs to say so instead of implying a balanced mixed search.

## State Review

Loading:

- Flight loading is coherent and has skeleton cards.
- Hotel loading exists only inside the Hotels tab.
- Mixed search loading does not tell users that hotel inventory may arrive after flights.

Empty:

- When hotel search is skipped or unavailable, an inline panel says hotels were not included (`app/page.tsx:1399` to `app/page.tsx:1404`).
- If hotel tab is available but empty, the Hotels tab shows a dedicated empty state (`app/page.tsx:1452` to `app/page.tsx:1471`).

Error:

- Full search errors show a retry/edit panel before any tabs (`app/page.tsx:1328` to `app/page.tsx:1358`).
- Hotel-specific provider failures become hotel availability copy, not a full-page error (`app/page.tsx:917` to `app/page.tsx:933`).

Desktop source review:

- Results tabs, flight controls, and grids use responsive flex/grid classes and should remain usable at desktop widths.
- The desktop issue is hierarchy, not fit: the result summary and default tab privilege flights.

Mobile 375px source review:

- The tab strip is horizontally scrollable and buttons have `min-h-11`, so controls should be tappable at 375px (`app/page.tsx:1363` to `app/page.tsx:1397`).
- Cards are single-column below `sm`, so no source-level overlap is apparent in the mixed result states.
- The hotel entry point is easy to miss because the summary says flights found and hotels are only in the tab strip.

## Manual Verification Flow

Desktop mixed flow:

1. Open the app at desktop width.
2. Search a round trip with origin, destination, depart date, and return date.
3. Wait until provider streaming finishes.
4. Confirm the first visible result set is Flights.
5. Confirm the flight controls explain the flight order as Best deal or Lowest price.
6. Switch to Hotels.
7. Confirm hotel cards render in provider array order and no visible text explains why the first hotel appears first.

Mobile 375px mixed flow:

1. Set viewport to 375px wide.
2. Repeat the same round-trip destination search.
3. Confirm the result tabs are usable and horizontally scrollable.
4. Confirm hotel choices require selecting the Hotels tab.
5. Confirm there is no mixed-results summary explaining that flights are shown first or that hotels use provider order.

Runtime note:

This audit used source-level verification and existing test coverage. No product code was changed to inject fake provider data, and live mixed hotel inventory depends on configured provider credentials and upstream availability.

## Out Of Scope / Blockers

- No scoring math, provider aggregation, filters, tabs, bundles, packages, comparison tools, or card redesign changes were made.
- `components/hotels/HotelResults.tsx` and `components/search/SearchSummary.tsx` do not exist in this worktree.
- `components/search/SearchPanel.tsx` exists, but `app/page.tsx` owns the active homepage search UI.
- `npm run tsc` is blocked because `package.json` has no `tsc` script. Direct TypeScript verification passed with `npx tsc --noEmit --incremental false`.
