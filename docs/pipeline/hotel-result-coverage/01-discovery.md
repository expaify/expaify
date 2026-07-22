# UXD-HOTEL-RESULT-COVERAGE-01: Hotel Result Coverage Confidence

Date: 2026-07-22  
Stage: UX Discovery  
Priority: P2

## User Pain Point

When travelers reach the end of a short hotel list, expaify does not tell them whether they have seen every result available within the app's actual search scope, only a provider-capped or filter-reduced subset, or a list that has not finished loading, so they repeat searches, reset filters, or leave without knowing whether a better-fit hotel was missed.

## Affected Users and Flow Step

- **Primary users:** First-time travelers comparing hotels for a specific destination and dates, who do not yet know the limits of expaify's hotel supply.
- **Secondary users:** High-consideration comparison shoppers who browse deeply before clicking a property, and filter users whose narrow result set may reflect their criteria rather than total available supply.
- **Affected steps:** Hotel results arrival, scrolling or requesting another result batch, reaching the visible end of the list, and adjusting or clearing filters after a small or empty set.
- **Current surfaces inspected:** The date-search contract in `app/api/search/route.ts`, `lib/providers/hotellook.ts`, `lib/types.ts`, and `app/components/HotelCard.tsx`; and the currently mounted hotel deal-browsing surface in `app/deals/DealFeed.tsx` and `app/deals/page.tsx`.

## Current Implementation Signal

The current code cannot support a truthful completeness claim:

- The date-search provider request in `lib/providers/hotellook.ts` asks one HotelLook source for at most 20 entries (`limit=20`). `HotelProvider.searchHotels` returns only `Result<HotelOffer[]>`; it carries no provider total, next-page token, searched-provider count, cap disclosure, or explicit exhausted/partial state.
- `app/api/search/route.ts` emits `available` as soon as the hotel array is non-empty, but does not distinguish a complete set from a capped subset. Its `empty` and `unavailable` states are meaningfully distinct, yet neither the response nor `HotelOffer` expresses coverage confidence.
- `app/components/HotelCard.tsx` communicates property-level price, source, booking-link, and freshness limits, but no list-level scope. It is not mounted by the current `app/page.tsx`, which is now a marketing landing page; therefore the date-search API currently has no active hotel-results browsing UI in this branch.
- The mounted `/deals` hotel feed uses batches and an infinite-scroll sentinel, but exposes no visible count, loading progress, manual load-more fallback, or end-of-results confirmation. A user who reaches the bottom receives no explanation of whether the feed is exhausted or failed to continue.
- The feed initializes `hasMore` to `false` when server-prefetched results are supplied, so the normal `/deals` first paint cannot request another batch even when more active deals exist. The initial server batch is 20 while client batches use 12; if pagination is re-enabled without aligning these boundaries, the next offset can overlap already visible results.
- Filtered empty results can disclose how many deals filters hide and offer filter removal, but a small non-empty filtered set has no equivalent scope cue. Current analytics cover clearing filters and empty states, not result depth, pagination attempts/outcomes, end-of-list exposure, repeated equivalent searches, property clicks by depth, or exits after reaching the end.

These signals show a coverage-communication and state-integrity problem. They do **not** show that a particular number of hotels is sufficient, that HotelLook represents the global market, or that more results necessarily exist after any given list.

## Measurable Signal

The problem is present when users cannot distinguish `still loading`, `more may be available`, `all results in this expaify set shown`, `filters narrowed this set`, `provider returned no matches`, and `provider coverage was not confirmed` at the point they evaluate or reach the end of a hotel list.

Baseline behavioral signals to instrument and segment by destination, dates, returned count, active-filter count, provider state, viewport, and authenticated/premium state:

- **Equivalent-search repetition:** another hotel search with the same normalized destination and dates within the session, with no material criteria change.
- **Refinement churn:** filter removal, clear-all, or repeated filter changes after viewing a short non-empty set, especially without a property click.
- **Result-depth reached:** deepest unique hotel position viewed and whether the user reached the list boundary.
- **Continuation outcome:** pagination or load-more requested, succeeded, returned zero new unique hotels, failed, or was unavailable despite a full first batch.
- **Unresolved exit:** session/navigation exit after reaching the result boundary without opening a property or starting a provider handoff.

The primary discovery metric is the share of hotel-result sessions that reach the visible list boundary and then repeat the equivalent search, reset filters, or exit without a property click. This should be compared before and after honest scope/loading/exhaustion cues, not interpreted as proof that inventory itself is complete.

## Constraints

1. **Inventory honesty:** Never claim exhaustive, global, or market-wide coverage. Any completion language must be bounded to the results actually returned by the searched provider(s), the current expaify feed, and the user's active criteria; `unavailable` must not be presented as zero inventory.
2. **Data and provider integrity:** Coverage states must be derived from explicit provider/API metadata or known request boundaries. External calls remain in `lib/providers`, cached query behavior remains intact, affiliate markers stay on outbound links, and no UI inference may invent a provider total or unseen inventory.
3. **Accessible, low-friction recovery:** Loading, partial, exhausted, empty, error, and filter-reduced states must remain distinguishable without color, keyboard and screen-reader understandable, and usable at 375px mobile and 1280px desktop without forcing repeated searches or automatic requests with no visible fallback.

## Success Statement

This is solved when a first-time user can browse hotel results, reach any list boundary, and understand whether expaify is still loading, may have more within the current result set, has shown all results it can substantiate for the current criteria, or could not confirm coverage—and can choose a productive refinement or retry without assuming the list represents every hotel available globally.

## UXR Handoff

### Research Questions

1. At what list size and interaction moment do travelers begin interpreting a short hotel set as incomplete, and what do they do next?
2. Which scope language correctly communicates “all results currently available from expaify for these criteria” without being misread as “all hotels in the market”?
3. Which cues best distinguish provider cap/partial coverage, loading another batch, confirmed end of the current set, filters hiding other returned deals, true zero matches, and provider failure?
4. Do travelers need a visible count or progress model throughout browsing, or is an explicit boundary state sufficient—and does this differ at 375px versus desktop?
5. When a small set is legitimate, which next action is most productive: remove one named filter, clear all filters, broaden dates/destination, retry provider coverage, or stop searching?
6. How should a manual continuation control and automatic loading coexist so keyboard, screen-reader, reduced-motion, slow-network, and failed-request users retain control and understand state?

### Target Segments

- First-time expaify users searching a popular destination with exact dates.
- Comparison-heavy users who view at least 75% of a returned hotel set before choosing.
- Users with one active filter versus users with multiple restrictive filters.
- Mobile users at 375px and desktop users at 1280px.
- Sessions with a short successful set (1–5), a capped/full batch (20), filtered zero, provider-empty, provider-timeout/unavailable, and subsequent-page failure or zero-new-result response.

### Event Hypotheses

- If the list identifies its honest scope and current loading/exhaustion state, `equivalent_hotel_search_repeated` will fall among sessions that reach the result boundary.
- If small non-empty filtered sets explain that active criteria narrowed the visible set and offer a targeted refinement, `hotel_filters_cleared_all` will fall relative to single-filter removal, while property clicks will not decrease.
- If continuation progress and a definitive current-set end state are visible, `hotel_result_boundary_exit_no_click` will fall and successful unique-result depth will rise.
- If failed or zero-new continuation attempts are distinguished from confirmed exhaustion, repeated continuation attempts and silent exits will fall without falsely increasing confidence in provider coverage.
- If coverage cues are clear at the list level, users will require fewer repeated searches while `hotel_property_opened` or provider-handoff starts per completed result session remain stable or improve.

For each hypothesis, UXR should define exact event names and properties only after confirming the canonical analytics vocabulary. At minimum, events need a stable anonymous session/search ID, normalized-query fingerprint (not raw personal input), result count, active-filter count, result depth, coverage state, provider state, viewport class, and continuation outcome.

## Scope Boundary

This discovery does not authorize a new hotel provider, a global inventory claim, ranking changes, or fixes to pagination/data contracts. It defines the trust problem and the evidence UXR must validate. The unmounted date-search UI and the `/deals` pagination boundary mismatch are implementation findings for downstream audit, not changes made in this stage.
