# UX Design: Hotel Result Coverage Confidence

Ticket: `UXDES-HOTEL-RESULT-COVERAGE-01`  
Stage: UX Design  
Priority: P0  
Date: 2026-07-22

## Inputs and scope

- Discovery: `docs/pipeline/hotel-result-coverage/01-discovery.md`
- Research: `docs/pipeline/hotel-result-coverage/02-research.md` (read from the upstream `agent/UXR-HOTEL-RESULT-COVERAGE-01` branch because the artifact is not present in this worktree)
- Current implementation inspected:
  - `app/deals/DealFeed.tsx`
  - `app/deals/page.tsx`
  - `app/api/deals/route.ts`
  - `app/api/search/route.ts`
  - `app/components/HotelCard.tsx`
  - `lib/types.ts`
  - `app/globals.css`

This is a repair specification, not a new hotel-search feature. It defines:

1. The mounted `/deals` hotel feed boundary and continuation experience.
2. The state and copy contract a future date-search hotel results view must consume from `/api/search`.

The date-search contract must not be mounted as a new page or flow under this ticket. UI may implement presentation only where an owning result surface already exists. API/provider/pagination changes belong to DEV.

## Design outcome

At the end of any hotel list, a traveler can distinguish:

- work still in progress;
- more current expaify results explicitly available;
- a successful but coverage-unconfirmed provider response;
- the confirmed end of the current expaify set;
- a list narrowed by their filters;
- a successful search that returned no matches;
- a search whose inventory could not be confirmed; and
- a failed attempt to continue an otherwise usable list.

The interface never equates “current expaify set” with the hotel market, never treats a full batch as proof of more results, and never treats a provider failure as zero availability.

## Hierarchy and placement

### Primary

- Hotel/deal cards already returned.
- The boundary state sentence immediately following the full result grid.
- The single action that resolves the cause: load more, retry, remove one named filter, or change dates.

### Secondary

- A scoped visible count (`N deals shown` or `N results shown`) when it orients the boundary.
- `Clear all filters` after named filter removal.
- Search criteria retained above the date-search list.

### Tertiary

- Explanatory copy about expaify/provider scope.
- Loading skeletons and motion.
- Analytics hooks, which must never alter visible behavior.

### Reading order

The order is always: current criteria and filters → result grid → result boundary → next page content. The boundary spans the full grid width and is never placed in a sidebar, inside the final card, or visually attached to only one grid column.

For an empty or unavailable result, the state panel occupies the grid position beneath retained criteria. For continuation loading or failure, all existing cards remain mounted and the state is local to the boundary.

## Shared presentation model

Use one presentational `ResultCoverageBoundary` component with surface-owned copy adapters. The shared component does not infer state from item count.

```ts
type CoverageState =
  | 'initial_loading'
  | 'more_available'
  | 'continuation_loading'
  | 'coverage_unconfirmed'
  | 'confirmed_end'
  | 'filtered_nonempty'
  | 'confirmed_empty'
  | 'unavailable'
  | 'continuation_failed'
  | 'zero_new_unconfirmed'

type ResultCoverageBoundaryProps = {
  surface: 'deals' | 'date_search'
  state: CoverageState
  visibleCount: number // unique, currently rendered real results only
  activeFilters: Array<{
    key: string
    label: string
    onRemove: () => void
  }>
  recommendedFilterKey?: string
  requestOrigin?: 'manual' | 'automatic'
  onLoadMore?: () => void
  onRetryInitial?: () => void
  onRetryContinuation?: () => void
  onChangeDates?: () => void
  onClearAll?: () => void
  statusMessageId: string
}
```

Component rules:

- `state` is supplied by the owning state machine. Never derive it from `visibleCount`, array length, viewport depth, or whether the last page was full.
- `visibleCount` is calculated after unique-ID deduplication and excludes skeletons, samples, placeholders, and locked-card duplicates. Locked real deals may count once because they represent a current expaify deal.
- `more_available` requires explicit `hasMore: true` or a non-empty continuation token from the same query.
- `confirmed_end` requires explicit `hasMore: false`, an absent next token from a contract that guarantees token semantics, or `visibleCount === exactTotal` where `exactTotal` is for the same query and cache scope.
- `coverage_unconfirmed` is the mandatory fallback after a successful non-empty response when those proof fields are absent.
- `confirmed_empty` requires a successful, usable response with zero results. It does not mean no hotel exists in the market.
- `unavailable` requires a failed, timed-out, malformed, or unconfigured source response. It makes no inventory claim.
- Render no progress bar. Render no `N of Y` or `N hidden` text unless Y is an exact same-query server value. The present contract does not provide such a Y.

## Surface 1: `/deals` contract

### Required source shape

The UI must consume a server-authored boundary, not infer one from `deals.length === PAGE_SIZE`.

```ts
type DealsPageResult = Result<{
  deals: ApiDeal[]
  page: {
    nextOffset: number | null
    hasMore: boolean
    exactTotal?: number
  }
  premium: boolean
  coverage: 'more_available' | 'confirmed_end'
}>
```

DEV requirements before confirmed continuation can ship:

- Align the server first batch and client continuation boundary, or return `nextOffset` derived from the actual number of rows already delivered. Do not advance 20 preloaded items by the current client page size of 12.
- Deduplicate by stable deal `id` before append and before calculating `visibleCount`.
- Return trustworthy `hasMore` or a continuation token. Rename/remove the current page-length `total`; it is not an exact total.
- Keep initial-load failure separate from continuation failure.
- Retry the failed offset/token, not offset zero.
- Never fall back to sample deals for a filtered page or failed continuation in a way that changes the inventory meaning.

Until those fields exist, a successful non-empty `/deals` response ends in `coverage_unconfirmed`; do not render `Load more deals` or confirmed-end copy based on page length.

### `/deals` state matrix and final copy

| State | Required truth condition | Visible content | Actions |
|---|---|---|---|
| Initial loading | Initial request pending; no settled cards | Status: **“Finding current expaify hotel deals…”** Six stable card skeletons. No count or boundary claim. | None |
| More available | Successful response; unique cards exist; explicit `hasMore: true` | **“{N} deals shown. More expaify deals are available.”** | Primary: **“Load more deals”** |
| Continuation loading | Existing cards + one continuation request pending | **“Loading more deals…”** Three appended skeletons. Existing cards unchanged. | Keep **“Load more deals”** in place, disabled, with visible label **“Loading more deals…”** |
| Coverage unconfirmed | Successful non-empty response without trustworthy continuation/completion metadata | **“{N} deals shown. expaify can’t confirm whether this is the full current set.”** | None. Do not fabricate continuation. |
| Confirmed end, no filters | Explicit end metadata for current query | **“You’ve reached the end of current expaify deals.”** | None |
| Filtered, non-empty, more available | Active filters + non-empty result + explicit `hasMore: true` | Above grid: **“Current filters narrow this list.”** Boundary: **“{N} deals shown. More matching expaify deals are available.”** | Boundary primary: **“Load more deals”**. Above-grid primary refinement: **“Remove “{filter label}””** when a recommended filter is server-supported; secondary: **“Clear all filters”**. |
| Filtered, non-empty, confirmed end | Active filters + explicit end metadata | Above grid: **“Current filters narrow this list.”** Boundary: **“You’ve reached the end of current expaify deals matching these filters.”** | Primary: **“Remove “{filter label}””**; secondary: **“Clear all filters”** |
| Filtered, non-empty, coverage unconfirmed | Active filters + non-empty response + no boundary metadata | Above grid: **“Current filters narrow this list.”** Boundary: **“{N} deals shown. expaify can’t confirm whether this is the full matching set.”** | Primary: **“Remove “{filter label}””**; secondary: **“Clear all filters”** |
| Confirmed empty, filtered | Successful usable response; zero results; at least one active filter | Title: **“No current expaify deals match your filters”**. Body: **“Remove one filter to expand this expaify result set.”** | Primary: **“Remove “{filter label}””**; secondary: **“Clear all filters”** |
| Confirmed empty, unfiltered | Successful usable response; zero current real deals; not the sample-feed state | Title: **“No current expaify hotel deals were returned”**. Body: **“There are no current matches in expaify’s tracked deal set. Check again after the next daily update.”** | None. Existing preference/account actions may follow only when already valid for that feed. |
| Initial unavailable | Initial request failed; no settled cards | Title: **“We couldn’t confirm current hotel deals”**. Body: **“The deal feed didn’t load. Your filters are unchanged.”** | Primary: **“Retry loading deals”** |
| Continuation failed | Existing cards + attempted next request failed | Title: **“We couldn’t load more deals”**. Body: **“The deals already shown are still available to compare.”** | Primary: **“Try loading more again”** |
| Zero new, confirmed end | Continuation succeeds; deduplication adds zero; explicit end metadata | Confirmed-end copy for the active filter state. | As defined for confirmed end |
| Zero new, unconfirmed | Continuation succeeds; deduplication adds zero; no end proof | **“No additional unique deals were returned. Coverage is still unconfirmed.”** | Primary: **“Try loading more again”**. Stop automatic attempts. |

#### Causal filter selection

The named primary action is not chosen by visual guesswork.

1. If the API supplies a filter whose removal produces the largest known increase, use it.
2. Otherwise use the first active filter in current visual/DOM order: destination, minimum discount, stars, maximum price, start date, end date.
3. Copy interpolates the exact visible chip label: `Remove “Under $150”`, `Remove “4★ & up”`, `Remove “From Jul 30, 2026”`.
4. Never show a filter action for unavailable states; the provider/request failure, not the traveler’s criteria, caused that state.
5. Keep `Clear all filters` secondary. Replace the current broader `See all destinations` recovery unless destination is the sole active filter, in which case `Remove “Paris”` is sufficient.

Do not show `N deals are hidden by your filters` until an exact unfiltered total exists for the identical access, personalization, freshness, and query scope.

## Surface 2: date-search hotel contract

### Current truth ceiling

`HotelProvider.searchHotels` currently returns `Result<HotelOffer[]>`; HotelLook requests at most 20 and exposes no total, continuation token, or coverage proof. Therefore the current date-search UI has only these honest outcomes:

- pending;
- successful non-empty, coverage unconfirmed;
- successful zero, confirmed empty within this provider request; or
- unavailable/unconfirmed.

A return of 1–19 is not confirmed complete. A return of 20 is not proof that more exists. The date-search surface must not render pagination until its provider/API contract explicitly supports it.

### Future metadata shape

When provider support exists, extend the provider-normalized result rather than reading vendor fields in a component:

```ts
type HotelSearchPage = {
  offers: HotelOffer[]
  coverage: 'more_available' | 'confirmed_end' | 'unconfirmed'
  nextPageToken?: string
  exactTotal?: number
}

type HotelProvider = {
  searchHotels(
    area: string,
    range: { checkin: string; checkout: string },
    pageToken?: string
  ): Promise<Result<HotelSearchPage>>
}
```

This remains a `Result<T>` and all calls remain in `lib/providers`. A missing token proves an end only if that provider adapter’s documented pagination semantics guarantee it. UI never consumes raw vendor limits or error strings.

### Date-search state matrix and final copy

| State | Required truth condition | Visible content | Actions |
|---|---|---|---|
| Default / skipped | Destination or both stay dates are missing; no hotel request made | Title: **“Add a destination and stay dates”**. Body: **“Enter a destination, check-in date, and check-out date to search for hotel results.”** | Primary: **“Edit search”** |
| Initial loading | Hotel request pending | Status: **“Finding current expaify hotel results…”** Stable hotel-card skeletons. No count. | None |
| Successful non-empty, current contract | One or more usable offers; no coverage metadata | Boundary: **“{N} results shown. expaify can’t confirm whether this is the full set for these dates.”** | Primary: **“Change dates”**; secondary: **“Edit search”** |
| Provider-capped / 20 returned | Exactly 20 usable offers from current HotelLook request; no metadata | Same coverage-unconfirmed copy. Do not say “20 of 20,” “more available,” or “end.” | Primary: **“Change dates”**; secondary: **“Edit search”** |
| More available, future contract only | Explicit `coverage: 'more_available'` + valid token | **“{N} results shown. More expaify hotel results are available for these dates.”** | Primary: **“Load more hotels”** |
| Continuation loading, future contract only | Existing offers + one token request pending | **“Loading more hotels…”** Existing offers retained. | Disabled stable button: **“Loading more hotels…”** |
| Confirmed end, future contract only | Explicit `coverage: 'confirmed_end'` | **“You’ve reached the end of expaify hotel results returned for these dates.”** | Secondary link/button: **“Change dates”**; no forced primary action |
| Filtered non-empty, future result filters | At least one active client/server filter + non-empty successful result | Above list: **“Current filters narrow the results returned for this search.”** Boundary follows metadata truth; never substitutes for it. | Primary named removal; `Clear all filters` secondary |
| Confirmed empty | Successful usable provider response; zero offers | Title: **“No expaify hotel results were returned for these dates”**. Body: **“Try different stay dates while keeping your destination and traveler details.”** | Primary: **“Change dates”**; secondary: **“Edit search”** |
| Unavailable / timeout | Provider failure, timeout, malformed response, or missing configuration | Title: **“We couldn’t confirm hotel coverage”**. Body: **“Hotel results weren’t confirmed for this search. Your destination, dates, and traveler details are unchanged.”** | Primary: **“Retry hotel search”**; secondary: **“Edit search”** |
| Continuation failed, future contract only | Existing offers + next-token request failed | Title: **“We couldn’t load more hotel results”**. Body: **“The results already shown are still available to compare.”** | Primary: **“Try loading more again”** |
| Zero new, unconfirmed, future contract only | Successful continuation adds zero unique offers without end proof | **“No additional unique hotel results were returned. Coverage is still unconfirmed.”** | Primary: **“Try loading more again”**. Stop automatic attempts. |

`Change dates` preserves destination, origin if present, trip type, travelers/rooms, and current date values; it returns to the form and focuses the check-in/departure date control. `Edit search` preserves the same values and focuses the first editable search control. `Retry hotel search` submits the identical normalized query, retains the active hotel tab, and does not modify criteria.

## Interaction and state-machine rules

### Initial requests

- Set the results container to `aria-busy="true"` while pending.
- Retain search criteria and filter controls but disable only controls whose activation would create concurrent requests.
- Initial loading has no result count and no inventory language.
- Initial failure replaces skeletons, not previously settled cards from another query. Results from an old query must not remain labeled as if they belong to the new query.
- Retry uses the exact failed query and switches back to initial loading without moving focus to skeletons.

### Manual continuation

- Use a native `<button type="button">`; Enter and Space use native activation.
- The button is available only for an explicit-more state.
- On activation, issue one request for the server-provided next offset/token. Ignore further activation while pending.
- Keep the button in a stable boundary wrapper. While pending, disable it and change its visible label to the loading copy.
- Keep focus on that button after a successful manual append. Its wrapper persists and moves after the appended grid items in visual order; do not focus the first new card automatically.
- On failure, replace the button/status within the same wrapper with the local retry treatment. Focus remains on the retry button if the failure followed a manual activation.
- Retry the same failed offset/token and attempt number +1.

### Automatic continuation

- Automatic loading is an enhancement using the same request function and state guard as the button.
- Observe the boundary only when explicit-more is true, no request is pending, and no continuation failure/zero-new stop state exists.
- A 600px prefetch margin may remain, but the visible manual control must remain in the DOM and normal reading order.
- Never run concurrent manual and automatic requests. Whichever starts first owns the attempt.
- Do not move focus after an automatic append or failure.
- Disconnect observation after confirmed end, failure, zero-new, query change, tab change, or component unmount.
- Automatic loading must not loop if deduplication adds zero items.

### Completion and announcements

Use one visually hidden, persistent `aria-live="polite" aria-atomic="true"` region outside the grid. Update it once per transition:

- Initial loading: `Finding current expaify hotel deals.` or `Finding current expaify hotel results.`
- `/deals` append starts: `Loading more deals.`
- `/deals` append succeeds: `{batchUniqueCount} more deals loaded. {visibleCount} shown.`
- Date-search append succeeds: `{batchUniqueCount} more hotel results loaded. {visibleCount} shown.`
- Continuation failure: use the full visible failure title and body.
- Confirmed end: use the surface’s full visible end sentence.
- Zero-new: use the full visible zero-new sentence.

Do not announce individual skeletons or every inserted card. Do not use `role="alert"` for loading or successful completion. Initial unrecoverable fetch failure may use `role="alert"`; local continuation failure uses `role="status"`/the polite region because existing comparison content remains usable.

### Query, filter, and tab changes

- A meaningful query/filter/sort change cancels or ignores stale responses, resets unique results and continuation metadata to the new query, and returns to initial loading.
- Sorting must not change coverage truth; it may change order only within the same server-authored set.
- Active filter chips remain above the filtered list and are keyboard operable.
- After named filter removal or clear-all, retain focus on the initiating control until it is removed; then place focus on the result-region heading/status wrapper (`tabIndex={-1}`) only after the new response settles. Announce the resulting boundary once.
- Switching to Flights stops hotel observation and announcements. Returning to Hotels restores the settled hotel state without firing duplicate boundary events.

## Responsive layout

### Shared boundary shell

```tsx
<section
  aria-labelledby={titleId}
  className="mt-8 border-t border-[color:var(--border)] pt-6"
>
  <div className="mx-auto flex max-w-[720px] flex-col items-stretch gap-3 text-left sm:items-center sm:text-center">
    ...
  </div>
</section>
```

Neutral/default boundary text:

```tsx
className="text-[14px] leading-6 text-[color:var(--text-2)]"
```

Boundary title for failure/empty states:

```tsx
className="font-display text-[20px] font-bold leading-[1.2] text-[color:var(--text-1)]"
```

Error/recovery shell:

```tsx
className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-5 py-6 sm:px-8 sm:py-8"
```

Do not use red/error color to distinguish inventory unavailable from empty; title, body, and action provide the distinction. `--error` may be used only for a small error icon or border accent alongside explicit text, never as the sole cue.

Primary control:

```tsx
className="btn btn-primary min-h-[44px] w-full px-6 sm:w-auto"
```

Secondary control:

```tsx
className="btn btn-outline min-h-[44px] w-full px-6 sm:w-auto"
```

Action group:

```tsx
className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center"
```

Inline filtered-scope row above a non-empty grid:

```tsx
className="mb-4 flex flex-col gap-2 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-4 py-3 text-[13px] leading-5 text-[color:var(--text-2)] sm:flex-row sm:items-center sm:justify-between"
```

Use existing tokens only: `--bg-base`, `--bg-surface`, `--bg-muted`, `--border`, `--border-strong`, `--brand`, `--brand-soft`, `--text-1`, `--text-2`, `--text-3`, `--error`, `--error-soft`, `--radius-card`, `--radius-control`, and `--focus-ring`.

### 375px

- Preserve the existing one-column result grid with `px-5`; boundary width is the grid width.
- Boundary body and title are left aligned to improve scan/wrap behavior; empty-state panels may remain centered only if their actions still occupy the full content width.
- Every primary, secondary, load-more, and retry action is full width and at least 44px high.
- Stack actions with 12px gaps. Never place body copy and controls side by side.
- Active filter actions wrap without horizontal scroll. Long labels may wrap to two lines; no ellipsis on the only causal recovery label.
- Keep at least 24px between the final card and boundary content, and 32px after the boundary before following page content.
- Skeleton dimensions match result cards closely enough that the boundary does not jump over content as results settle.

### 1280px

- Preserve `/deals`’ max-width `1140px` and three-column grid.
- Boundary spans all three columns and begins after the final grid row.
- Center boundary copy within `max-w-[720px]`; controls may sit side by side in DOM order.
- The filtered-scope row spans the grid above cards. It is not a fourth-column sidebar.
- Keep 32px between grid and boundary; no sticky or floating load-more control.

## Loading and motion

- `/deals` initial loading: six skeleton cards; continuation loading: three skeleton cards appended after real cards.
- Date-search initial loading: use the number of skeletons appropriate to its mounted grid, with a minimum of three at desktop and two at 375px. Skeleton count is visual stabilization, never inventory implication.
- Include visible loading text at the boundary/status region. Skeletons alone are insufficient.
- Existing `.skeleton` is acceptable because `app/globals.css` reduces animation under `prefers-reduced-motion: reduce`; no state may depend on shimmer or spinner motion.
- Do not dim, blur, or disable already-loaded cards during continuation.

## Accessibility specification

- Results use a labelled region such as `<section aria-labelledby="hotel-results-heading">`; the result container receives `aria-busy`, not the full page.
- A simple grid/list with semantic links is preferred over adding `role="feed"`. If UI adopts `role="feed"`, each card must become an `article` with correct `aria-posinset`; use `aria-setsize="-1"` while total is unknown. Do not add partial feed semantics.
- Boundary and all controls are in normal DOM reading order after cards.
- Use native buttons for load, retry, remove-filter, clear-all, and change-date actions. Visible labels supply accessible names; named removal controls use `aria-label="Remove filter: {label}"` when their visible text is only the chip label.
- Preserve the global `:focus-visible` outline and `--focus-ring`; do not override with `outline-none` on interactive controls.
- Loading does not steal focus. Automatic loading never moves focus.
- Manual success keeps focus on the stable load-more control. Manual failure keeps/reestablishes focus on the replacement retry control in the same wrapper.
- End markers are plain readable text in the tab/reading sequence, not focusable unless needed for tested focus recovery.
- Empty/unavailable state title and body are exposed together through `aria-labelledby` and `aria-describedby`.
- Color, iconography, animation, and card length never carry coverage meaning without text.
- Touch targets are at least 44px high at 375px and 1280px.

## Edge cases

1. **Three results, explicit end:** render three cards and confirmed-end copy. Do not call this partial because the list is short.
2. **Twenty date-search results, no metadata:** render coverage-unconfirmed copy. Do not infer `more_available` or `confirmed_end` from the provider cap.
3. **Zero results, successful response:** render confirmed-empty copy scoped to results returned/current expaify deals; never “no hotels available.”
4. **Zero results, failed/timeout response:** render unavailable copy and retry; never an empty state or date/filter recommendation.
5. **Active filters + unavailable request:** failure recovery takes precedence. Retain filter chips, but do not blame filters or offer removal as primary.
6. **Active filters + non-empty set:** always show the quiet filtered-scope row, even when more/end metadata is also present.
7. **Active filters + confirmed empty:** do not render a hidden-result number without same-query unfiltered metadata. Offer one named removal then clear-all.
8. **Duplicate page:** deduplicate by stable ID. Count only new unique items. If zero new, stop observation and use the applicable zero-new state.
9. **Partial duplicate page:** announce only new unique count; advance using the server token/offset, not the post-deduped length.
10. **Card opened while continuation runs:** allow navigation. Do not block existing cards.
11. **Request races after filter change:** discard stale results and their announcements when the query fingerprint no longer matches.
12. **Manual and automatic trigger collide:** allow exactly one request and one analytics request event.
13. **Button becomes end marker:** after a manual final page, focus remains in the stable wrapper; do not focus the body or top of results. Screen reader announcement supplies completion.
14. **Samples only:** preserve the existing “Example deals” disclosure. Sample cards do not receive a result count or coverage boundary that implies current inventory.
15. **Locked deals:** a locked real deal counts once toward visible expaify deal depth; the boundary must not imply that membership changes supply coverage.
16. **Exact total later exists:** `N of Y` may be considered only when Y matches the same query, filters, personalization/paywall scope, and freshness window. The boundary sentence remains mandatory.
17. **Provider changes:** UI copy stays expaify-scoped. Do not expose raw provider error strings or infer market-wide coverage from provider count.
18. **One-way or missing date:** no hotel provider request; render default/skipped guidance rather than empty or unavailable.

## Analytics contract

Use flat properties compatible with `AnalyticsProps`. Never send raw destinations, airports, ZIP codes, dates, free-text searches, or traveler details. `query_fingerprint` must be privacy-safe and created outside the presentation component.

| Event | Trigger | Required flat properties |
|---|---|---|
| `feed_result_boundary_viewed` | `/deals` boundary enters view once per search/state | `search_id`, `query_fingerprint`, `coverage_state`, `provider_state`, `visible_count`, `active_filter_count`, `result_depth`, `viewport_class` |
| `feed_continuation_requested` | Manual or automatic continuation begins | Above plus `continuation_mode`, `offset_or_token_present`, `attempt_number` |
| `feed_continuation_completed` | Continuation settles | Above plus `continuation_outcome`, `batch_count`, `new_unique_count` |
| `feed_coverage_recovery_clicked` | Boundary/empty/error recovery activates | Above plus `action`; optional `filter_key` |
| `feed_property_opened` | Real deal card opens | `search_id`, `query_fingerprint`, `coverage_state`, `result_position`, `visible_count`, `boundary_seen`, `viewport_class` |
| `feed_provider_handoff_started` | Outbound provider link activates | Property-open fields plus `provider` |
| `hotel_search_submitted` | Date-search request starts | `search_id`, `query_fingerprint`, `is_equivalent_to_previous`, `viewport_class` |

Allowed values:

- `coverage_state`: `initial_loading`, `more_available`, `continuation_loading`, `coverage_unconfirmed`, `confirmed_end`, `filtered_nonempty`, `confirmed_empty`, `unavailable`, `continuation_failed`, `zero_new_unconfirmed`.
- `provider_state`: `success`, `timeout`, `malformed_response`, `unavailable`, `unconfigured`.
- `viewport_class`: `mobile_375` or `desktop_1280` for QA fixtures; production may use approved canonical buckets.
- `continuation_mode`: `manual` or `automatic`.
- `continuation_outcome`: `success`, `failed`, `zero_new`, or `exhausted`.
- `action`: `remove_filter`, `clear_all`, `change_dates`, `edit_search`, `retry_initial`, or `retry_continuation`.

Retain `feed_clear_all_clicked` and `feed_filter_chip_removed`; add search/state/depth properties when the analytics layer supports them. Production evaluation remains blocked until the console-only analytics stub is replaced by an approved sink.

## UI versus DEV handoff

### UI-owned work

- Build the presentational boundary/status/empty treatments using the exact copy, tokens, responsive rules, and accessibility behavior above.
- Split initial and continuation visual states so existing cards are never removed by an append failure.
- Add the native manual load-more/retry controls, stable boundary wrapper, polite live region, and `aria-busy` presentation wiring.
- Add filtered-scope messaging and named filter-removal presentation.
- Do not render states whose truth inputs do not exist; use `coverage_unconfirmed` as the fallback.
- Do not mount a new date-search results flow.

### DEV prerequisites

- Repair `/deals` pagination alignment, server-authored `hasMore`/next offset, deduplication, stale-response protection, and failed-page retry.
- Extend `HotelProvider` and `/api/search` only when a provider can supply truthful coverage/continuation metadata. Preserve `Result<T>` and provider boundaries.
- Supply privacy-safe search IDs/fingerprints and an approved analytics sink if measurement is authorized.
- Supply same-scope filtered/unfiltered totals before any hidden-result count appears.

UI must not simulate any DEV prerequisite with array-length heuristics.

## Acceptance criteria

1. A three-result list with explicit end metadata is labeled as the end of the current expaify set, not partial.
2. A 20-result HotelLook response without metadata is labeled coverage unconfirmed, with no load-more or completion claim.
3. Filtered zero, successful provider zero, timeout/unavailable, continuation failure, and zero-new continuation each have distinct final copy and causal actions.
4. `/deals` and date search use their own scoped vocabulary: `current expaify deals` versus `results returned for these dates`.
5. No state uses a progress bar, page-length total, full-batch inference, global hotel availability claim, or unsupported hidden count.
6. Manual continuation remains visible whenever explicit more exists; automatic continuation is supplementary and cannot issue concurrent or looping requests.
7. Existing cards persist through continuation loading and failure. Local retry reuses the failed offset/token.
8. Loading, success, failure, zero-new, and end transitions are announced once through a polite live region; focus never jumps after automatic loading.
9. Manual button activation works with Enter and Space, retains a stable focus target, and every control has a 44px minimum target.
10. At 375px, boundary actions are one column/full width with no overlap or horizontal scroll. At 1280px, the boundary spans the entire three-column grid.
11. Reduced motion removes dependency on shimmer/animation without losing visible status.
12. Filter refinement names one actual constraint before offering clear-all, and unavailable states offer retry rather than refinement.
13. Date changes preserve destination/traveler intent; retry preserves the entire normalized query.
14. Sample cards, locked cards, duplicates, stale responses, missing dates, and tab changes follow the edge-case rules above.
15. TypeScript and tests pass after implementation, including state-machine tests for every truth condition and interaction tests for manual/automatic continuation.

## Blockers and out-of-scope findings

- The assigned research artifact exists in the UXR branch/commit but is absent from this UXDES worktree. This spec was based on the exact upstream file; the pipeline handoff/merge should be repaired separately.
- The discovery file says P2 while the assigned UXDES and UXR tickets say P0. The board owner must reconcile priority; design scope is unchanged.
- Current `/deals` data cannot truthfully expose confirmed-more or confirmed-end, and current date-search data cannot expose completion or continuation. Those are DEV prerequisites, not UI inferences.
- The current `unfilteredTotal` consumer has no producer. Hidden-result counts remain prohibited.
- A new provider, new date-search page, ranking/filter algorithm change, market-wide availability claim, and analytics vendor are out of scope.
