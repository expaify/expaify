# UXDES-HOTEL-FILTER-RECOVERY-01: Hotel Filter Recovery Design Specification

**Ticket:** UXDES-HOTEL-FILTER-RECOVERY-01 · **Stage:** UX Design · **Priority:** P0  
**Date:** 2026-07-22 · **Surface:** `/deals` hotel feed · **Feature slug:** `hotel-filter-recovery`

## Decision summary

Repair the filtered hotel feed with an honest, transactional recovery pattern:

- A successful live query with zero matches gets a full recovery panel.
- A successful live query with a verified full total of 1–3 keeps its cards primary and gets a quiet, non-sticky recovery helper.
- At most one non-context filter removal is promoted, and only when comparable server metadata for the exact query proves that the removal increases the full result count.
- Destination and date bounds are never promoted for removal. They remain manually removable under **Review filters** where the route permits it.
- Applying a recovery changes exactly one filter, retains the complete prior filter set for one-action undo, and never changes sort, destination, dates, or another criterion implicitly.
- Missing, stale, failed, sample, personalized, and locked responses never produce count claims or promoted recovery.

The no-metadata zero state is the truthful UI-only fallback. Promoted recovery and verified 1–3 treatment are blocked on the DEV metadata contract in this document.

## Scope and invariants

### In scope

- Result-state hierarchy and final copy for live filtered zero and verified 1–3 totals.
- Neutral recovery when comparable metadata is absent.
- One-filter removal, review, reset confirmation, retry, and undo interactions.
- Loading, error, sample, personalized, locked, stale-response, mobile, desktop, keyboard, and announcement behavior.
- Analytics event and `/api/deals` metadata handoff requirements.

### Out of scope

- New filters, providers, inventory expansion, ranking changes, automatic relaxation, date broadening, Premium entitlement changes, an analytics vendor, or changes to personalized preferences.
- Claims about market-wide hotel availability. Counts refer only to **current deals tracked by expaify**.
- Recovery on the Flights tab or the date-search `HotelCard` surface.

### Non-negotiable behavior

1. Never derive a full total from `deals.length`, a page-size boundary, `total: source.length`, `unfilteredTotal`, or a client-side card count.
2. Never render a promoted option unless `inventoryKind === "live"`, the request succeeded, the response matches the active normalized query, and its current and counterfactual counts share one `dataVersion`.
3. A promoted action removes exactly one of `minDiscount`, `minStars`, or `maxPrice`. It never promotes `city`, `dateFrom`, or `dateTo`.
4. The selected relaxation retains destination, date bounds, sort, and every other active filter byte-for-byte.
5. Never auto-apply a relaxation, auto-scroll, open a modal on arrival, or move focus merely because a zero or short response appeared.
6. Money remains `{ priceCents: number; currency: string }`. Visible dollars are formatting only.

## Information hierarchy

### Live zero-result panel

1. **Primary:** state headline, honest explanation, preserved-context line, and—when eligible—one count-backed filter-removal button.
2. **Secondary:** **Review filters**, expanding an inline list where each active removable criterion can be removed individually.
3. **Tertiary:** **Reset feed filters**, followed by explicit inline confirmation that names the defaults and fixed destination context.

The primary action is distinguished by placement, a complete action label, and `.btn-primary`, not color alone. Review is outlined. Reset is a text action and never shares the primary row styling.

### Verified 1–3 results

1. **Primary:** current result status and hotel cards.
2. **Secondary:** a compact helper with, when eligible, one outlined single-filter removal.
3. **Tertiary:** existing filter controls. Do not surface reset in the helper.

### Other successful states

- Verified 4+ live results: normal feed only; no recovery helper.
- Metadata absent with non-empty cards: normal feed only; do not classify as 1–3.
- Sample, personalized, and locked: their existing truthful state is primary; recovery is absent.

## State model and precedence

Resolve one state in this order so treatments cannot overlap:

| Priority | State predicate | Required treatment | Recovery eligible |
| --- | --- | --- | --- |
| 1 | Flights tab selected | Existing coming-soon state | No |
| 2 | Initial request pending | Six existing skeleton cards plus loading status | No |
| 3 | Replacement request pending | Clear old recovery metadata immediately; show replacement skeletons and pending status | No |
| 4 | Latest request failed | Error/retry for the exact attempted filter set; no inventory or count claim | No |
| 5 | `premium === false` | Existing lock/entitlement explanation; server-ignored filters cannot create a filtered state | No |
| 6 | `inventoryKind === "sample"` or every visible deal is mock | Existing sample disclosure and example cards | No |
| 7 | Personalized view is empty and there are no ad hoc active filters | Existing `PersonalizedEmpty` | No |
| 8 | Successful live response, active filters, `filteredTotal === 0`, comparable metadata available | Metadata-backed zero panel | Yes |
| 9 | Successful live response, active filters, rendered empty, metadata absent/invalid/stale | Neutral no-metadata zero panel | Manual only |
| 10 | Successful live response, active filters, verified `filteredTotal` 1–3 | Cards plus short-list helper | Yes |
| 11 | Successful live response, verified `filteredTotal >= 4`, or non-empty metadata absent | Normal cards | No |
| 12 | Successful live response, no active ad hoc filters, zero live deals | Existing cold/live-feed empty treatment; do not blame filters | No |

`active filters` means criteria that differ from the feed baseline. The baseline is currently 20%+ off, no maximum price, no star minimum, no dates, and either all destinations or the route's fixed `defaultCity`.

## Recovery-option selection

### Eligibility for any count-backed option

An option is displayable only when all are true:

- `queryId` equals the client key for the currently rendered filter set and sort.
- `inventoryKind` is `live`; request status is successful.
- `filteredTotal` is a full pre-pagination count.
- The option shares the response `dataVersion` and changes one active criterion only.
- `resultingTotal > filteredTotal`, `addedCount === resultingTotal - filteredTotal`, and both are non-negative integers.
- `from` matches the active client value and `relaxedTo` matches that filter's baseline value.
- `contextPreserved` confirms every unchanged filter, including any destination/date intent.

Invalid options are dropped individually. If top-level identity or version validation fails, drop all metadata and use the no-metadata treatment.

### Which option is promoted

1. Consider only `minDiscount`, `minStars`, and `maxPrice`.
2. If the most recently user-changed filter is in that set and has an eligible option, promote it. `selectionReason = "last_change"`.
3. Otherwise, do **not** invent a universal priority or promote the largest count. Show no promoted button. In expanded Review filters, show up to three eligible non-context options in descending `resultingTotal`; ties retain response order and none is labeled best or recommended.
4. City and date options may appear only as neutral manual removals in Review filters. Do not attach a result count unless the same-query option is eligible, and do not promote them.

The last-changed key is client interaction metadata, reset after navigation or an initial server render. Natural-language search that changes multiple filters has no single last-changed key and therefore produces no promoted option until a subsequent one-filter edit.

## Component specification

### A. `HotelResultStatus`

Place immediately above the recovery panel/helper or result grid. It owns result copy, asynchronous announcements, and the temporary undo action.

- Semantic structure: `<div role="status" aria-live="polite" aria-atomic="true">` for concise response text. Do not wrap the entire card grid in the live region.
- Give the visible heading `tabIndex={-1}` and a ref for focus after user-initiated recovery, undo, reset, or retry resolves.
- Do not focus it on initial load or on a passive response to ordinary filtering.
- Do not announce skeleton counts.

Tailwind pattern:

```text
flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between
text-[13px] leading-5 text-[color:var(--text-2)]
focus:outline-none
```

### B. `HotelFilterRecoveryPanel` — zero results

Use a semantic `<section aria-labelledby="hotel-recovery-title">`; do not put `role="status"` on the whole interactive section.

Tailwind pattern:

```text
mx-auto max-w-[640px] rounded-[var(--radius-card)]
border border-[color:var(--border)] bg-[color:var(--bg-surface)]
px-5 py-8 text-left sm:px-8 sm:py-10
```

- Headline: `.text-h3 text-[color:var(--text-1)]`.
- Supporting copy: `mt-2 text-[14px] leading-6 text-[color:var(--text-2)]`.
- Preserved context: `mt-3 text-[13px] font-medium leading-5 text-[color:var(--text-1)]` with a visible text label; no icon-only meaning.
- Actions: `mt-6 flex flex-col items-stretch gap-3 sm:items-start`.
- Promoted button: `.btn .btn-primary w-full whitespace-normal text-center sm:w-auto` with a minimum 44px target.
- Review button: `.btn .btn-outline w-full sm:w-auto`, `aria-expanded`, `aria-controls`.
- Tertiary reset: `min-h-[44px] self-start px-1 text-[13px] font-medium text-[color:var(--brand)] underline-offset-4 hover:underline`.

### C. `RecoveryFilterReview`

Expand inline below the actions; do not use a popover or modal. Use a `<ul>` with one filter per row. Long labels wrap; there is no horizontal chip rail.

Each row contains:

- Current filter label and value.
- Optional, validated effect text: `See N current deals`.
- A full button label: `Remove [value]`.

Tailwind pattern:

```text
mt-5 border-t border-[color:var(--border)] pt-5
grid gap-3
rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-base)] px-4 py-3
flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between
```

Buttons use `.btn .btn-outline w-full sm:w-auto`; never rely on an `×` alone. Review order matches the toolbar: destination, minimum discount, stars, maximum price, from date, to date. A fixed destination on `/destinations/[city]` is shown in preserved context but is not removable.

### D. `HotelShortListHelper` — verified 1–3

Render between result status and the grid. It is non-modal, non-sticky, and does not hide, dim, or reorder cards.

Tailwind pattern:

```text
mb-6 flex flex-col gap-3 rounded-[var(--radius-control)]
border border-[color:var(--border)] bg-[color:var(--bg-surface)]
px-4 py-4 sm:flex-row sm:items-center sm:justify-between
```

- Copy block: `min-w-0 text-[13px] leading-5 text-[color:var(--text-2)]`.
- Optional action: `.btn .btn-outline w-full whitespace-normal sm:w-auto`.
- No Review filters expansion and no reset action here; all manual controls remain in the existing toolbar.

### E. `RecoveryUndo`

Appears in `HotelResultStatus` only after the changed request succeeds. It is not a toast, does not time out, and remains visible until another user filter/sort/search edit, navigation, or a second recovery action invalidates it.

- Single removal label: **Undo filter change**.
- Reset label: **Undo filter reset**.
- Use a text button with a 44px hit area, `font-medium text-[color:var(--brand)] hover:underline`.
- Store the complete last successful filter set plus sort and source query ID. Never reconstruct it from labels.
- An intervening edit removes the action before starting that new request. Undo must never overwrite later intent.

## Final UI copy

All counts use locale-aware integer formatting. Use **deal/deals**, never **hotel/hotels available**. Dynamic filter values are formatted from typed values, never raw query strings.

### Zero, promoted option available

- Heading: **No current deals match these filters**
- Body: **Try one filter change while keeping the rest of your search.**
- Promoted button pattern: **Remove [filter value] · See [N] current deal[s]**
- Preserved-context label when destination and dates exist: **Stays the same: [destination] · [date range].**
- Destination only: **Stays the same: [destination].**
- Dates only: **Stays the same: [date range].**
- Neither: **Your other filters stay the same.**
- Secondary action: **Review filters**
- Tertiary action: **Reset feed filters**

Examples:

- **Remove 5★ & up · See 4 current deals**
- **Remove Under $150 · See 2 current deals**
- **Remove 40%+ off · See 1 current deal**
- **Stays the same: Miami · Jun 10–14.**

Do not say “recommended,” “best,” “too restrictive,” “hidden,” or “available.”

### Zero, metadata missing or no promotable option

- Heading: **No current deals match these filters**
- Body: **Review one filter at a time. Your other filters will stay the same.**
- Secondary-leading action: **Review filters** (outline; it becomes the first action but is not restyled as a count-backed recommendation)
- Tertiary action: **Reset feed filters**
- No count, preserved-count claim, “try this,” or hidden-inventory copy.

If eligible neutral alternatives exist but last-change promotion does not, keep the same copy. Their rows may say **See [N] current deals**; none receives primary styling.

### Review-filter rows

| Filter | Current-value format | Button copy |
| --- | --- | --- |
| Destination | `Miami` | **Remove Miami** |
| Minimum discount | `40%+ off` | **Remove 40%+ off** |
| Hotel class | `5★ & up` | **Remove 5★ & up** |
| Maximum nightly price | `Under $150/night` | **Remove Under $150/night** |
| Earliest date | `From Jun 10, 2026` | **Remove From Jun 10, 2026** |
| Latest date | `To Jun 14, 2026` | **Remove To Jun 14, 2026** |

Row effect, when proven: **See [N] current deal[s]**. Without metadata: omit the effect line entirely.

### Verified 1–3 helper

- Status: **[N] current deal[s] match your filters.**
- Helper body with promoted option: **Want more choices? Change one filter and keep the rest of your search.**
- Helper action: **Remove [filter value] · See [M] current deal[s]**
- If there is no promoted option: do not render the helper; the status and cards are sufficient.

Do not use “Only” in the final copy; it can devalue a focused set that may already satisfy the traveler.

### Loading and error

- Initial loading announcement: **Loading hotel deals.**
- Replacement loading announcement: **Updating deals for these filters.**
- Recovery action pending label: **Updating deals…**
- Error heading: **We couldn’t update these deals**
- Error body: **We couldn’t check this filter combination. Try the same filters again.**
- Primary error action: **Retry**
- Error announcement: **Deals couldn’t be updated. Your selected filters are still shown.**

An error is unknown inventory. Never pair it with Review filters, reset, short-list copy, or an expected count from the failed request.

### Default, live-feed empty, sample, personalized, and locked copy

These treatments remain separate from recovery. Use these exact strings so the cause is explicit:

| State | Heading/status | Supporting copy and actions |
| --- | --- | --- |
| Verified 4+ live results | No recovery heading | Cards remain primary. If a trustworthy full count is already shown in the result status, use **[N] current deals match your filters.** Otherwise omit a count. |
| No active filters, no current live deals | **No current hotel deals yet** | **We check tracked hotel prices daily. New current deals will appear here after the next sweep.** No filter action. |
| Sample feed | **We’re building your feed** | **These example deals show what expaify will surface after tracking completes. They use sample hotels and prices and aren’t bookable.** Section label: **Example deals**. |
| Personalized empty | Dynamic heading: **No [discount]%+ deals in [destination summary] right now.** | **Your saved deal threshold and destinations are still active. We check them daily.** Actions: **Show all deals** and **Edit preferences**. Do not expose ad hoc filter recovery. |
| Locked / non-Premium | **Filters and sorting are included with Premium.** | Action: **Unlock with Premium**. Disabled controls retain their labels and `disabled` state; no result-band or filter-recovery copy. |

For a personalized watchlist with no destinations, the heading is **No [discount]%+ deals right now.** For one destination, use its display name; for two or more, use **No [discount]%+ deals in your [N] destinations right now.** Alert-plan copy may continue below this state, but it must not imply that changing ad hoc filters will recover a match.

### Reset confirmation

Selecting **Reset feed filters** expands an inline confirmation below it; it does not open a modal.

- General `/deals`: **Reset to all destinations, 20%+ off, any hotel class, any price, and any dates?**
- Fixed destination route: **Reset to 20%+ off, any hotel class, any price, and any dates? [Destination] will stay selected.**
- Confirm button: **Reset filters**
- Cancel button: **Keep my filters**

After the successful response, use the normal result status plus **Undo filter reset**. If reset fails, keep the selected filter controls shown, keep the confirmation collapsed, and show the error state.

### Undo announcements

- Successful single removal: **Filter removed. [N] current deal[s] match.**
- Successful reset: **Filters reset. [N] current deal[s] match.**
- Successful undo: **Filter change undone. [N] current deal[s] match.**
- Undo request failure: **We couldn’t restore your previous filters. Try again.**

Only include `[N]` when the successful response supplies a valid full `filteredTotal`; otherwise say **Deals updated**, **Filters reset**, or **Filter change undone**.

## Interaction rules

### Apply a promoted or review removal

1. On click or Enter/Space, capture the complete last successful filter set, sort, `queryId`, selected `filterKey`, source, prior total, and expected total if valid.
2. Change exactly that filter to its baseline value. Clear displayed recovery metadata immediately.
3. Set `aria-busy="true"` on the result region, disable only the activated action, change its label to **Updating deals…**, and issue the normal `/api/deals` request.
4. Ignore or abort earlier responses. The last active request identity wins.
5. On success, render the returned state. If this was a user-invoked removal, move programmatic focus to `HotelResultStatus` after content is committed and announce the concise result. Expose undo.
6. On failure, show the error state for the attempted filters. Preserve the selected filter controls so Retry repeats the exact attempted set; retain the prior successful snapshot internally but do not show recovery counts. Undo is not created until a change succeeds.

### Retry

- Retry sends the exact attempted filter set, sort, offset `0`, and personalization mode; it never resets or relaxes criteria.
- While pending, focus remains on Retry and its label becomes **Retrying…**.
- On success, move focus to result status. On repeat failure, focus the error heading; do not announce twice.

### Undo

- Undo sends the stored complete previous set through `/api/deals`; it does not locally reveal cached cards as if verified.
- While pending, label **Restoring filters…** and disable the button.
- On success, clear the undo snapshot, update controls and cards together, focus result status, and announce success.
- On failure, keep the current successful results and filter controls visible, keep **Undo filter change/reset** available, and show the inline error **We couldn’t restore your previous filters. Try again.** The next activation retries the stored snapshot.
- Any later manual filter, sort, natural-language search, reset, tab, or route change invalidates the snapshot before that action runs. An invalidated undo action is removed; never show a disabled dead control.

### Review and reset disclosure

- Review toggles with Enter/Space and uses `aria-expanded`. On expansion, keep focus on the button; the next Tab enters the first removal.
- Escape while focus is inside Review collapses it and returns focus to **Review filters**. Escape does nothing elsewhere.
- Reset confirmation follows the same disclosure behavior. **Keep my filters** collapses it and returns focus to **Reset feed filters**.
- Review and reset confirmation cannot be expanded simultaneously; opening one collapses the other.

## Responsive layout

### Mobile — 375px

- Page gutters remain at the existing mobile spacing; the panel/helper is `w-full min-w-0` and never exceeds the viewport.
- Zero panel is left-aligned. All primary/secondary/filter-row buttons are full width and at least 44px tall.
- Dynamic labels use `whitespace-normal break-words`; never truncate the proposed change, destination, or date context.
- Review rows stack label, effect, and action vertically. Do not use horizontally scrolling chips.
- Result status and undo stack; undo remains immediately after the status in DOM order.
- The short-list helper precedes the one-column card grid. It is part of normal document flow and never sticky.

### Desktop — 1280px

- Keep the existing three-column result grid.
- Center the zero panel at `max-w-[640px]`, but keep contents left-aligned.
- In short-list/helper rows, copy sits left and the action sits right. Cap the action label through wrapping, not truncation.
- Review rows align value/effect left and action right; maintain DOM order from copy to action.

At intermediate widths, use the mobile stack until `sm`. No absolute positioning is authorized.

## Keyboard, focus, and accessibility

- Native `<button type="button">` for all recovery, review, reset, retry, and undo controls.
- Minimum 44×44px targets. Existing global `:focus-visible` supplies a 3px `--focus-outline` and `--focus-ring`; do not remove it.
- Section headings provide state meaning in text. Primary, outline, and link hierarchy cannot be expressed by color alone.
- `aria-label` must equal or expand the visible action: e.g. **Remove 5 stars and up; keep Miami and June 10 to June 14; show 4 current deals**. Do not override with a shorter label.
- Use one polite atomic live region for result changes and a separate `role="alert"` only for request failures. Avoid nested live regions.
- `aria-busy` is true only while replacing the current result set. Skeleton cards are `aria-hidden="true"`.
- Do not announce all recovery rows on expansion. Their visible button names provide context during navigation.
- Focus order: status → promoted action (if any) → Review filters → expanded review actions → Reset feed filters → confirmation actions → result cards.
- Focus never moves on automatic initial load, ordinary metadata arrival, or merely entering the 1–3 band.
- Respect `prefers-reduced-motion`; no new animation is required.

## Edge cases

| Case | Required behavior |
| --- | --- |
| Late response for an old filter set | Discard response and metadata; do not emit viewed/shown/resolved events. |
| Matching `queryId`, mismatched `dataVersion` in an option | Drop that option. If none remain, use no-metadata state. |
| `addedCount` disagrees with totals | Drop the option and record a development diagnostic; never repair it client-side. |
| Full total says 1–3 but returned page is empty | Treat as invalid response/error, not short or zero. |
| Full total is zero but cards are returned | Treat as invalid response/error; do not show recovery beside cards. |
| Natural-language search changes several filters | No last-change promotion; Review may show validated options. |
| Most recent change is city/date | Do not promote it. Review can expose manual removal. |
| Most recent non-context option restores no deals | No promotion. Show neutral Review; validated alternatives may include counts. |
| One active removable filter | Show that row in Review. Promote only if eligible under the same rules. |
| No active ad hoc filters and zero results | Show live-feed empty/cold treatment, not filter recovery or reset. |
| Exact total is 1 | Singular **1 current deal**. All other integers use **deals**. |
| Total exceeds formatting threshold | Show the exact locale-formatted integer supplied by the API; no `99+` approximation. |
| Currency is not USD | Format max-price value with its response currency; never convert client-side. |
| Invalid/unknown enum or typed value | Omit the affected option; retain neutral manual control from trusted active client state. |
| Destination route | Fixed `defaultCity` remains visible as preserved context and is not removable/reset. |
| Personalized view plus ad hoc filters | If an explicit ad hoc filter query succeeds live, evaluate recovery only for those ad hoc filters; stored preferences remain outside Review and are never silently changed. |
| Locked/non-Premium response contains recovery metadata | Ignore it as a contract violation; show entitlement state only. |
| Sample response contains recovery metadata | Ignore it; sample cards retain existing non-bookable disclosure. |
| User opens a deal after recovery | Preserve recovery attribution for analytics only; no visual change. |

## DEV data-contract handoff

The existing `/api/deals` response is insufficient. `total` is page length and `unfilteredTotal` is unreachable; neither may power this design. Add a result metadata block through the existing deals route and data layer. No component may query Postgres or a provider directly.

Recommended TypeScript shape:

```ts
type HotelFilterKey =
  | 'minDiscount'
  | 'minStars'
  | 'maxPrice'
  | 'city'
  | 'dateFrom'
  | 'dateTo'

type Money = { priceCents: number; currency: string }

type HotelFilterValue =
  | { kind: 'percentage'; value: number }
  | { kind: 'stars'; value: number }
  | { kind: 'money'; value: Money }
  | { kind: 'city'; value: string }
  | { kind: 'date'; value: string }
  | { kind: 'none' }

type HotelRecoveryOption = {
  filterKey: HotelFilterKey
  from: HotelFilterValue
  relaxedTo: HotelFilterValue
  resultingTotal: number
  addedCount: number
  contextPreserved: HotelFilterKey[]
  dataVersion: string
}

type HotelResultMetadata = {
  queryId: string
  inventoryKind: 'live' | 'sample'
  filteredTotal: number
  baselineContextTotal: number
  dataVersion: string
  generatedAt: string
  recoveryOptions: HotelRecoveryOption[]
}

type DealsResponse = {
  deals: ApiDeal[]
  premium: boolean
  page: { limit: number; offset: number; returned: number; hasMore: boolean }
  resultMetadata: HotelResultMetadata | null
}
```

Contract requirements:

- `queryId` is a deterministic opaque ID for the normalized active filters, sort, fixed page context, and personalization mode; it contains no raw search text or personal identifier.
- `filteredTotal` and every `resultingTotal` are full counts before `LIMIT/OFFSET`, computed against the same active-deal cutoff/transaction represented by `dataVersion`.
- Each option removes exactly one predicate and retains every other normalized predicate. `addedCount` is server-calculated.
- `baselineContextTotal` restores feed defaults but preserves a route-fixed destination. It is diagnostic/analytics context only in this UI; it does not authorize “hidden deals” copy.
- `inventoryKind` must be explicit on the initial server render as well as client fetches. Sample rows never participate in recovery counts.
- Initial SSR data passed to `DealFeed` must include the same metadata as client responses; otherwise initial non-empty lists stay unclassified.
- Return `resultMetadata: null` when trustworthy comparable counts cannot be produced. Partial uncertainty is preferable to fabricated metadata.
- Validate integers, date ISO format, filter enums, price currency, and non-negative counts at the route boundary. External calls, if any, remain behind `lib/providers` and return `Result<T>`.
- The UI should use an `AbortController` or monotonically increasing request sequence in addition to `queryId` so late requests cannot replace newer state.

This contract is a DEV-stage dependency. UI may build components against typed fixtures and must ship the no-metadata state as the runtime fallback until the contract is live.

## Analytics specification

Events must be emitted once per committed latest-query state, not per render. Error, sample, personalized-empty, and locked states are excluded from recovery-success denominators.

| Event | Trigger | Required properties |
| --- | --- | --- |
| `hotel_filter_result_viewed` | Successful latest live query commits with active ad hoc filters | `anonymousSessionId`, `queryId`, `resultBand` (`0`, `1-3`, `4+`), `filteredTotal`, `activeFilterKeys`, `activeFilterCount`, `metadataAvailable`, `inventoryKind`, `viewportBand` (`mobile`, `desktop`), `fixedDestinationContext` |
| `hotel_filter_recovery_option_shown` | A promoted button becomes visible; once per `queryId` + option | `queryId`, `filterKey`, `fromValueBand`, `relaxedTo`, `resultingTotal`, `addedCount`, `optionRank: 1`, `selectionReason: last_change`, `contextPreserved` |
| `hotel_filter_recovery_selected` | Promoted, Review, or confirmed reset action activates | `queryId`, `filterKey` or `multiple`, `optionRank` or `0`, `source` (`promoted`, `review_filters`, `clear_all`), `priorTotal`, `expectedTotal` or `-1` |
| `hotel_filter_recovery_resolved` | Selected request succeeds and latest response commits | `priorQueryId`, `resultingQueryId`, `expectedTotal` or `-1`, `actualTotal` or `-1`, `resultBand`, `countMatchedExpectation` |
| `hotel_filter_recovery_undone` | Undo request succeeds | `priorQueryId`, `resultingQueryId`, `timeSinceRemovalMs`, `interveningEdit: false`, `undoKind` (`single`, `reset`) |
| `hotel_deal_opened_after_recovery` | First non-sample deal opens after successful recovery | `resultingQueryId`, `recoveredFilterKey` or `multiple`, `resultPosition`, `timeSinceRecoveryMs` |

Privacy rules:

- Do not send raw natural-language searches, account IDs, exact dates, exact destination text, or exact budgets.
- Use stable filter enums, allowlisted city/context identifiers where already approved, and price/value bands for analytics.
- Do not emit `option_shown` for rows hidden in collapsed Review. If measurement of neutral rows is later needed, define a separate exposure trigger when Review expands.
- Production analytics plumbing/vendor selection remains out of scope; these names and properties are the implementation contract.

## Acceptance criteria for UI and DEV

### UI stage

- Implements the component hierarchy and all copy above without changing `/api/deals` business logic.
- No-metadata zero is the runtime default until trustworthy metadata is present.
- Provides fixture/story/test coverage for promoted zero, neutral zero, neutral alternatives, verified 1/2/3, 4+, initial loading, replacement loading, error, sample, personalized, locked, reset confirmation, undo pending/success/failure, stale response, 375px, and 1280px.
- Preserves current props/exports and existing sample, personalized, and locked contracts.
- Does not show a promoted action from page length or `unfilteredTotal`.

### DEV stage

- Implements full counts, same-snapshot one-filter counterfactuals, query identity, inventory kind, pagination metadata, and initial-render parity through the existing deals data path.
- All result adapters use `{ ok: true; data } | { ok: false; reason }`; no external vendor call is made from UI.
- Adds route/data tests for every filter key, one-predicate-only relaxation, version/query mismatch, sample exclusion, locked exclusion, zero, 1–3, 4+, pagination, and money typing.
- Wires the analytics contract only through the approved analytics layer; no raw private values.

### QA gate

- At 375px and 1280px, no overflow, clipped action copy, focus loss, or overlapping controls.
- Keyboard-only users can review, remove, confirm reset, cancel, retry, and undo in the documented order.
- Screen-reader announcements are concise and occur once.
- Zero/sample/error/personalized/locked states are distinguishable in text, not merely color.
- Destination and dates never change through a promoted action.
- Stale metadata never appears with a newer filter set.

## Handoff and sequencing

1. **UI-HOTEL-FILTER-RECOVERY-01:** Build the state components, disclosures, focus behavior, undo state machine, copy, and typed metadata consumption. Keep the neutral no-metadata path functional and do not fabricate counts.
2. **DEV-HOTEL-FILTER-RECOVERY-01:** Add the `/api/deals` metadata/count contract, initial-render parity, stale-response identity, and analytics plumbing/tests needed to activate count-backed states.
3. **TEST-HOTEL-FILTER-RECOVERY-01:** Verify every state, data gate, responsive layout, focus path, and event boundary against discovery, research, and this specification.

The promoted zero and verified 1–3 experiences are not releasable as count-backed behavior until DEV passes. The neutral zero recovery is independently honest and can remain as the fallback in every deployment.

## Blockers and out-of-scope findings

- **DEV blocker:** `/api/deals` does not yet provide full totals, counterfactual counts, `queryId`, `dataVersion`, `inventoryKind`, or initial-render metadata. UI cannot truthfully activate promoted or verified short-list states without it.
- **Measurement blocker:** `lib/analytics.ts` has no production sink. This spec defines events but does not select or install one.
- Existing initial pagination ambiguity, sample fallback behavior, and missing DealFeed state tests must be covered by the staged handoff; this UXDES ticket does not repair code.
- The duplicated declarations visible in `app/globals.css` and repeated subtitle rendering in `DealFeed` are outside this design ticket and were not changed.
