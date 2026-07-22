# UX Research: Hotel Result Coverage Confidence

Ticket: `UXR-HOTEL-RESULT-COVERAGE-01`  
Stage: UX Research  
Priority: P0 (ticket); the upstream discovery header says P2  
Date: 2026-07-22

## Source Inputs and Evidence Limits

- Discovery report: `docs/pipeline/hotel-result-coverage/01-discovery.md`
- Current implementation audited:
  - `lib/types.ts`
  - `lib/providers/hotellook.ts`
  - `app/api/search/route.ts`
  - `app/api/search/__tests__/route.test.ts`
  - `app/page.tsx`
  - `app/components/HotelCard.tsx`
  - `app/deals/page.tsx`
  - `app/deals/DealFeed.tsx`
  - `app/api/deals/route.ts`
  - `lib/analytics.ts`
- Reference patterns checked:
  - Booking.com, “How we work”: https://www.booking.com/content/how_we_work.en-gb.html
  - Booking.com Demand API, “Filtering and paginating accommodation search results”: https://developers.booking.com/demand/docs/accommodations/filter-pagination
  - Google Travel Help, “Search for hotels on Google”: https://support.google.com/travel/answer/6276008?hl=en-uk
  - W3C WAI-ARIA 1.2, `feed` role: https://www.w3.org/TR/wai-aria/#feed
  - W3C ARIA Authoring Practices, Feed Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/feed/

This is a code audit and pattern review, not completed primary research. No traveler interviews or usability sessions were available in this stage, so wording-comprehension and behavioral claims below are research-backed hypotheses to test, not findings attributed to participants. The directives are still implementation-testable because they are bounded by facts the current contracts can and cannot prove.

## Research Decision

Do not show a progress bar, “all hotels,” “X of Y,” or “no hotels available” with the current data contracts. The truthful near-term pattern is a visible list-boundary state whose copy names the exact expaify scope and whose action changes according to one of six distinct states: initial loading, continuation loading, partial/unconfirmed coverage, confirmed end of the current expaify set, filter-reduced, empty, or unavailable. Continuation failure is a separate recovery state layered onto an already-visible list.

For the mounted `/deals` feed, use a visible `Load more deals` control as the accessible source of control; automatic continuation may supplement it but must not replace it. For the unmounted date-search hotel surface, do not design pagination as if it exists: the current provider contract returns one array capped at 20 and no continuation metadata.

The core wording rule is:

> Claim only what the result source proves, then name the boundary: “expaify deals,” “results returned for this search,” or “results matching these filters” — never “all hotels,” “every available hotel,” or “nothing available.”

## Current-Code Evidence

### 1. The two hotel-result paths are not interchangeable

The date-search path and the deal-feed path have different inventory, request models, and truth ceilings:

| Surface | Current source | Current boundary evidence | Honest claim available now |
|---|---|---|---|
| Date search (`/api/search`) | One HotelLook cache request for destination + dates | Array length only; request contains `limit=20` | A provider request returned N usable offers, or returned zero, or failed. Completeness is unconfirmed. |
| Deal feed (`/deals`) | Active deal rows stored by expaify’s tracker | Offset and requested page size; API returns only current-page length | N cards are currently shown. More may exist only after a full client-fetched page; final set size is unknown. |

`app/page.tsx` is a marketing landing page, not a date-search results client (`app/page.tsx:1-30`). `HotelCard` exists but is not mounted there. UXDES must therefore specify the live `/deals` repair separately from the future date-search state contract rather than pretending one component currently owns both.

### 2. Date search cannot prove complete, partial, or continuable coverage

`HotelProvider.searchHotels` returns only `Result<HotelOffer[]>` (`lib/types.ts:179-186`). It has no `totalResults`, `nextPage`, `hasMore`, provider-count, request-limit, or coverage-confidence field.

HotelLook is called with `limit=20` (`lib/providers/hotellook.ts:429-436`). A cached or live response returns only the normalized array (`lib/providers/hotellook.ts:420-445`). Therefore:

- 1–19 offers prove only that those usable offers were returned.
- 20 offers strongly indicate the request boundary may have been reached, but do not prove that a 21st offer exists.
- Zero offers from a successful response prove only that this provider request returned no usable matches.
- A timeout, malformed response, missing configuration, or HTTP/network failure proves no inventory fact.

The route currently emits `available` for any non-empty array, `empty` for a successful zero array, and `unavailable` for failure (`app/api/search/route.ts:395-415`). Those distinctions are useful, but `available` currently collapses “short successful set” and “possibly capped at 20,” and it has no route-level `loading`, `partial`, `complete`, or continuation state.

### 3. The mounted deal feed suppresses continuation on normal first paint

The server prefetches 20 real deals and always passes an `initialDeals` array (`app/deals/page.tsx:46-87`). `DealFeed` initializes `hasMore` to `false` and skips the client request whenever `initialDeals` is supplied (`app/deals/DealFeed.tsx:218-285`). As a result, the normal `/deals` first paint cannot continue even when more active deals exist.

If continuation is restored without aligning boundaries, the initial server batch is 20 but client `PAGE_SIZE` is 12. `loadMore()` advances from offset 0 to offset 12 (`app/deals/DealFeed.tsx:351-355`), which would request rows 13–24 and duplicate up to eight already-visible cards. Appending currently performs no ID deduplication (`app/deals/DealFeed.tsx:264-269`). This is a DEV/data-integrity prerequisite, not a UI detail.

### 4. Current continuation feedback is sighted-only and failure-destructive

The only continuation trigger is a one-pixel, `aria-hidden` intersection sentinel with a 600px root margin (`app/deals/DealFeed.tsx:358-375`, `717`). While loading, three skeleton cards are appended (`app/deals/DealFeed.tsx:715`), but there is no visible status text, live announcement, manual button, shown count, or end marker.

`fetchDeals` uses one global `error` boolean. If an appended page fails, existing cards remain in state but the render switches the whole grid to the full-page “Couldn’t load deals right now” error (`app/deals/DealFeed.tsx:240-275`, `604-619`). The retry starts again at offset 0 rather than retrying the failed continuation request. This makes “initial load failed” and “more results failed” indistinguishable and removes the shopper’s comparison context.

### 5. Counts in the current API do not support progress or hidden-result claims

`/api/deals` returns `total: source.length`, which is the length of the current page, not the filtered set total (`app/api/deals/route.ts:136-160`). `DealFeed` correctly comments that a full page is only a “may be more” signal (`app/deals/DealFeed.tsx:267-269`). It cannot support “12 of 47” or a determinate progress indicator.

The client accepts an optional `unfilteredTotal` and conditionally renders “N deals are hidden by your filters,” but `/api/deals` never returns that field (`app/deals/DealFeed.tsx:235-266`, `626-630`; repository search finds no producer). The upstream discovery’s statement that filtered empty results can disclose a hidden count describes a dormant conditional design, not currently reachable behavior.

For non-empty filtered lists, active filter chips exist, but no list-level message explains that the short set is filter-reduced (`app/deals/DealFeed.tsx:394-412`, `680-717`).

### 6. Empty and unavailable are partly separated, but scope language is inconsistent

The date-search route distinguishes successful empty from unavailable and gives timeout-specific copy (“inventory was not confirmed”) (`app/api/search/route.ts:401-415`). That is the strongest current trust pattern and should be retained.

The deal feed also distinguishes loading, full-load error, filtered empty, personalized empty, and cold/sample data. However, it does not expose the boundary for a non-empty set. Its filtered-empty copy says “see everything that’s live” (`app/deals/DealFeed.tsx:631-658`), which is broader than the current filtered-query contract proves and should be scoped to “all current expaify deals.”

### 7. Analytics cannot currently validate the discovery hypotheses

`track` accepts flat string/number/boolean properties and is a development-only console stub (`lib/analytics.ts:1-6`). The deal feed currently emits only clear-all, individual-filter removal, filtered-empty viewed, and cold-feed viewed events (`app/deals/DealFeed.tsx:339-348`, `414-424`). It does not record search identity, visible depth, boundary exposure, continuation request/outcome, property open, or provider handoff.

The repository’s active vocabulary on this surface uses the `feed_*` prefix. New measurement should follow that existing convention on `/deals`; future date-search events can use `hotel_search_*`. An “equivalent search repeated” metric should be derived from repeated `hotel_search_submitted` events sharing a privacy-safe normalized query fingerprint, not emitted as an unverifiable client opinion.

## Reference-Pattern Comparison

### Booking.com: counts and completion depend on explicit set metadata

Booking.com publicly explains that its result page reports how many accommodations might fit what the traveler supplied and that filters narrow that list. More importantly for an implementation-level comparison, its accommodation API returns `total_results` and a `next_page` token; the absence of `next_page` is the explicit signal that no further results exist in that API result set.

Pattern guidance:

- A visible total can orient users when it is server-authored and scoped to the current criteria.
- Continuation should be driven by an explicit next-page signal, not “the last page happened to be full.”
- End-of-set language is defensible only when continuation metadata confirms it.

Current expaify delta:

- HotelLook returns neither total nor next-page metadata through `HotelProvider`.
- `/api/deals` labels page length as `total` and has no set total or next-page signal.
- Both expaify paths would overclaim if they copied Booking-style total/completion language without first changing their data contracts.

### Google Hotels: refinement stays attached to the user’s criteria

Google Hotels documents a search model in which destination/dates/party can be adjusted and results can be narrowed by price, rating, hotel class, amenities, sort, and map location. It also describes each card as a snapshot derived from partner data, keeping the result scope tied to the user’s current search rather than implying the whole market is represented.

Pattern guidance:

- When a small set is caused by filters, the recovery action should change the constraint that created the set.
- Date/party changes are search broadening, while filter removal is result-set broadening; they should not be presented as equivalent fixes.
- Scope belongs near the list and current criteria, not inside every hotel card.

Current expaify delta:

- `/deals` has removable filter chips and a filtered-empty recovery, but no explanation or targeted recovery for 1–5 non-empty matches.
- The date-search path has no mounted results UI, so its date/destination recovery remains a contract/design requirement rather than a current interaction.

### W3C: automatic continuation needs explicit feed semantics or a manual endpoint

WAI-ARIA permits a feed to load additional articles before focus reaches the end, or to include an end article containing a button that requests more. It expects `aria-busy` during multi-step updates and focusable/identified articles; if total size is unknown, `aria-setsize=-1` is allowed. The APG also cautions that scroll-triggered loading creates assistive-technology interoperability challenges.

Pattern guidance:

- The robust minimum for expaify is a native button plus a textual status. Automatic loading is enhancement, not the only path.
- Loading additional results must be announced without moving focus or removing already-visible cards.
- Unknown set size is a legitimate semantic state; the UI does not need to invent a denominator.

Current expaify delta:

- The sentinel is hidden and has no keyboard/manual equivalent.
- The grid has no `aria-busy`, result-position semantics, or continuation live region.
- Append failure replaces the list instead of preserving context and offering a local retry.

## State Model and Truth Conditions

UXDES should use this state model. “Truth source required” is a hard gate: when the contract does not supply it, use the fallback state rather than inferring.

| State | Truth source required | List behavior | Working copy rule | Primary action |
|---|---|---|---|---|
| Initial loading | Request in flight, no settled result | Show a stable list skeleton and status; do not show a count | `Finding current expaify hotel results…` | None; do not imply inventory yet |
| Continuation loading | Existing results + a valid continuation request in flight | Keep all cards; mark list busy; show inline status after last card | `Loading more deals…` | Disabled `Load more deals` button remains in place |
| Partial / more confirmed | Explicit `nextPage`/`hasMore=true` from the source | Show visible count only as “N shown”; keep continuation available | `N deals shown. More expaify deals are available.` | `Load more deals` |
| Coverage unconfirmed / capped | Successful batch, but no total or trustworthy continuation metadata; includes current HotelLook results and full-page heuristics | Show boundary after cards; no progress denominator | `N results shown. expaify can’t confirm whether this is the full set for these dates.` | No fake load-more; offer `Change dates` only on a date-search surface |
| Confirmed end of current expaify set | Source explicitly omits next-page token or returns exact total already loaded | Show a persistent end marker | `You’ve reached the end of current expaify deals matching these filters.` | If filters active, offer the single best filter removal; otherwise no forced CTA |
| Filter-reduced, non-empty | One or more active filters and a successful result set | Keep filter chips and add quiet scope text above/below list | If exact filtered total exists: `N current expaify deals match your filters.` Otherwise: `Current filters narrow this list.` | Remove one named restrictive filter; `Clear all` remains secondary |
| Confirmed empty | Successful query returned zero; provider/source request itself succeeded | No cards; name criteria and scope | `No expaify hotel results were returned for these dates.` or `No current expaify deals match your filters.` | Remove one named filter, or change dates on date-search; `Clear all` secondary |
| Unavailable / unconfirmed | Timeout, malformed response, missing configuration, HTTP/network failure | No inventory claim; retain criteria; distinguish from empty | `We couldn’t confirm hotel coverage for this search.` | `Retry hotel search` |
| Continuation failed | Existing results + next-page request failed | Preserve cards and depth; local error at boundary | `We couldn’t load more deals. The deals already shown are still available to compare.` | `Try loading more again` |
| Continuation returned zero new unique results | Request succeeded but deduplication adds zero cards | Do not loop or silently retry | With explicit end metadata: confirmed-end copy. Without it: `No additional unique deals were returned. Coverage is still unconfirmed.` | Stop automatic attempts; optional manual retry only for transient/unconfirmed source |

“Partial” must not become a synonym for “short.” A 3-item list can be complete within a proven expaify set; a 20-item list can be unconfirmed. The state comes from metadata, not visual length.

## Count and Progress Recommendation

Use boundary cues now; add counts only as scoped orientation when the contract can substantiate them.

1. **Do not ship a progress bar.** Neither current source supplies a trustworthy denominator, and browsing hotels is not a task with a meaningful completion percentage.
2. **“N shown” is allowed.** The client can count unique visible cards. This is not a completeness claim and should appear only where it helps orient a continuation/boundary state.
3. **“N of Y” is prohibited until Y is an exact source total for the current criteria.** `/api/deals.total` is currently page length, not Y.
4. **A boundary message is mandatory even when an exact count exists.** Counts answer “how many”; the boundary answers “is there more, did loading fail, or did filters narrow this?”
5. **Do not show “N hidden by filters” until `unfilteredTotal` is actually returned from the same source/query basis.** A count calculated from a different scope, cache moment, or personalization/paywall set would be misleading.

## Productive Refinement Rules

Refinement must correspond to the cause of the small/empty set:

- With active filters, recommend removing one named constraint, not an undifferentiated reset. Priority: the filter whose removal is known to produce the largest result increase; if the API cannot compute that, offer individual active chips in current visual order and keep `Clear all filters` secondary.
- For a date-search empty or unconfirmed set, keep destination and traveler inputs intact. Offer `Change dates` before asking for a new destination because it preserves the traveler’s trip intent.
- For provider unavailable, do not suggest loosening filters or changing dates as if criteria caused the failure. Offer retry and preserve the query.
- At a confirmed end with no active filters, an extra CTA is unnecessary. Let property opening remain the primary next step; do not manufacture churn.
- Never use “broaden your search” as the only instruction. Name the field/action: `Remove “Under $150”`, `Clear all filters`, `Change dates`, or `Retry hotel search`.

## Accessible Manual + Automatic Continuation

The recommended hybrid model is:

1. Render a native `Load more deals` button after the list whenever explicit source metadata says more are available. It remains the keyboard and screen-reader fallback.
2. Automatic continuation may trigger as the visual boundary approaches, but it invokes the same request/state machine as the button and never performs concurrent requests.
3. Put `aria-busy="true"` on the results container while appending. Announce `Loading more deals…`, then `12 more deals loaded; 24 shown` in a polite live region. Do not announce every skeleton/card.
4. Do not move focus after automatic loading. After button-triggered loading, keep focus on the button in its stable location or move it only by an explicitly tested pattern; never jump users to the top or silently past new results.
5. Preserve existing cards on continuation failure. Replace only the boundary control/status with retry copy.
6. Once end is confirmed, remove/disable automatic observation, remove the load-more button, and render a textual end marker that is reachable in reading order.
7. At 375px the button and recovery action must be full-width or at least 44px high with no side-by-side copy collision; at 1280px the boundary remains directly under the full grid, not in a sidebar or only under one column.

Reduced-motion preference does not itself prove that automatic network continuation is unwanted, but no coverage state may depend on animation. Skeleton shimmer should respect the app’s motion policy, while textual status and the manual control remain sufficient with motion disabled.

## Evaluative Research Plan

Before finalizing copy, run a moderated comprehension/usability comparison with 8–12 participants across the discovery segments. Include at least four 375px sessions, four 1280px sessions, first-time users, deep comparison shoppers, one-filter users, and restrictive multi-filter users. Accessibility coverage should include keyboard-only and at least two screen-reader sessions; do not claim accessibility validation from sighted keyboard testing alone.

### Scenarios

1. Short successful set: 3 returned, coverage confirmed complete within expaify.
2. Provider-capped set: 20 returned, completeness unconfirmed, no continuation available.
3. Filter-reduced set: 4 visible with two active filters.
4. Confirmed empty: successful source response with zero matches.
5. Provider timeout: zero cards because coverage could not be confirmed.
6. Continuation success: 12 visible, then 12 unique cards appended.
7. Continuation failure: 12 remain visible and local retry appears.
8. Zero-new continuation: response succeeds but every returned ID is already shown.

### Stimuli to compare

- **A — count only:** `12 deals shown`
- **B — boundary only:** state-specific boundary copy from the table above
- **C — count + boundary:** `12 deals shown` plus state-specific boundary copy

Do not test a progress bar as a viable production option unless an exact denominator is first added; otherwise the test would validate presentation of invented data. Compare a manual-only continuation against the hybrid automatic-plus-visible-button pattern.

### Success measures

- At least 80% correctly classify each scenario as `more available`, `current expaify set ended`, `coverage unconfirmed`, `filters narrowed`, `no matches returned`, or `provider failed` without prompting.
- No more than 10% interpret confirmed-end copy as “every hotel in the market.”
- At least 80% choose the causally correct recovery: named filter removal for filtered state, date change for date-search empty, retry for unavailable/continuation failure.
- Keyboard and screen-reader participants can request more, hear loading/completion/failure, and reach the end marker without focus loss or repeated activation.
- C (count + boundary) should ship only if it improves correct classification or orientation over B without increasing global-completeness interpretations. Otherwise use the simpler boundary-only treatment.

## Analytics Specification

Keep properties flat to match `AnalyticsProps`. Never send raw destination, airport, ZIP, dates, or other personal search input. Use a server- or privacy-safe normalized-query fingerprint.

### Events

| Event | Trigger | Required properties |
|---|---|---|
| `feed_result_boundary_viewed` | Boundary enters view once per search/list state | `search_id`, `query_fingerprint`, `coverage_state`, `provider_state`, `visible_count`, `active_filter_count`, `result_depth`, `viewport_class` |
| `feed_continuation_requested` | Manual or automatic request starts | Above + `continuation_mode` (`manual`/`automatic`), `offset_or_token_present`, `attempt_number` |
| `feed_continuation_completed` | Request settles | Above + `continuation_outcome` (`success`/`failed`/`zero_new`/`exhausted`), `batch_count`, `new_unique_count`, `visible_count` |
| `feed_coverage_recovery_clicked` | Boundary/empty/error recovery is activated | Above + `action` (`remove_filter`/`clear_all`/`change_dates`/`retry_initial`/`retry_continuation`), optional `filter_key` |
| `feed_property_opened` | A real property/deal card is opened | `search_id`, `query_fingerprint`, `coverage_state`, `result_position`, `visible_count`, `boundary_seen`, `viewport_class` |
| `feed_provider_handoff_started` | An outbound provider link is activated | Same as property open + `provider` and `result_position` |
| `hotel_search_submitted` | Date-search query starts | `search_id`, `query_fingerprint`, `is_equivalent_to_previous`, `viewport_class` |

Retain existing `feed_clear_all_clicked` and `feed_filter_chip_removed` events, but add `search_id`, `query_fingerprint`, `coverage_state`, `visible_count`, `active_filter_count`, and `boundary_seen` so churn can be segmented after boundary exposure.

### Derived metrics for the discovery hypotheses

- **Equivalent-search repetition:** share of boundary-exposed searches followed by `hotel_search_submitted` with the same fingerprint and no meaningful criteria change.
- **Clear-all churn:** `feed_clear_all_clicked / feed_result_boundary_viewed`, segmented by non-empty filtered state.
- **Repeated continuation:** more than one request for the same offset/token after `failed` or `zero_new`, excluding a single explicit retry.
- **No-click boundary exit:** boundary viewed, then session/navigation ends with no later `feed_property_opened` or `feed_provider_handoff_started`.
- **Productive depth:** maximum unique `result_position` opened or viewed, never raw rendered index when duplicate IDs exist.

## Design Directives for UXDES

1. **Specify one contract-driven boundary component with separate truth states.** Cover initial loading, continuation loading, explicit-more, unconfirmed/capped, confirmed end, filtered non-empty, confirmed empty, unavailable, continuation failure, and zero-new continuation. Each state must use the copy rules and actions in the state table; no state may claim “all hotels” or market availability.

2. **Use a boundary cue as the primary confidence mechanism; gate all count language.** `N shown` may count unique rendered cards. `N of Y`, progress bars, “N hidden,” and confirmed-end language require exact server/provider metadata for the same criteria. UXDES must document the fallback when that metadata is missing: unconfirmed scope copy, not inference from a short/full batch.

3. **Make refinement causal and preserve user intent.** A filtered short/empty list offers individual named filter removal first and clear-all second; an unavailable source offers retry with criteria preserved; a date-search empty state offers date adjustment before destination replacement. No generic `Try again` or `Broaden search` when a more exact action exists.

4. **Design hybrid continuation around a real button and persistent context.** Automatic loading may supplement a visible `Load more deals` button but never replace it. Specify `aria-busy`, polite loading/completion/failure announcements, no focus jump, no concurrent requests, persistent cards on continuation failure, local retry, and a reachable end marker at both 375px and 1280px.

5. **Split the handoff by surface and name the DEV prerequisites.** The mounted `/deals` repair requires aligned initial/client pagination, unique-ID deduplication, separate initial/continuation error state, and trustworthy `hasMore`/total metadata. The unmounted date-search contract requires coverage metadata in `HotelProvider`/API before any complete/partial/continuable claim. UXDES may spec both state families but must not imply the current HotelLook array can paginate.

## Acceptance Criteria for UXDES

- Every state in the state table has final visible copy, primary/secondary action rules, and a data truth condition.
- The spec distinguishes a 3-result confirmed end, a 20-result unconfirmed cap, filtered zero, provider zero, timeout/unavailable, continuation failure, and zero-new continuation.
- No design uses page length as total, a full batch as proof of more, or an empty/failure response as proof of market availability.
- The `/deals` and date-search surfaces are specified separately where their contracts differ.
- The 375px and 1280px layouts show the boundary in normal reading order without overlap; no essential state relies on color, skeletons, or animation.
- A native manual continuation control, keyboard/focus behavior, screen-reader announcements, retry behavior, and end-of-set behavior are explicit.
- The analytics events and flat properties above are included or explicitly mapped to an approved canonical replacement before implementation.
- The spec identifies UI-only copy/layout work separately from DEV contract/pagination work; it does not ask UI to invent missing totals or provider coverage.

## Blockers and Out-of-Scope Findings

- **DEV prerequisite:** neither result path currently provides sufficient metadata for a fully trustworthy complete/partial/continuable state. UI can repair silence with “coverage unconfirmed,” but confirmed completion and accurate progress require contract changes.
- **DEV prerequisite:** `/deals` initial batch 20 versus client batch 12 creates an overlap risk, `hasMore=false` blocks normal continuation, append has no deduplication, and continuation failures reuse the destructive full-load error state.
- **Dormant count:** `unfilteredTotal` is consumed but never produced. Do not design it as current functionality without a backend count of the same scoped set.
- **Measurement blocker:** analytics is currently a development console stub, so production event hypotheses cannot be evaluated until an approved analytics sink exists.
- **Priority mismatch:** the assigned ticket says P0; the upstream discovery file header says P2. Research scope is unaffected, but the board owner should reconcile prioritization.
- A new hotel provider, global inventory claim, ranking change, filter algorithm, or date-search page implementation is out of scope. This brief defines state/copy behavior and the minimum contracts needed; it does not authorize those features.
