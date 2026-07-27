# 03 — Design: Filter and sort friction on the deals feed

**Ticket:** UXDES-DEALS-FEED-FILTER-FRICTION-01
**Stage:** UX Design
**Upstream:** `01-discovery.md`, `02-research.md`
**Surface:** `app/deals/DealFeed.tsx` (rendered by `app/deals/page.tsx` and `/destinations/[city]`)
**Date:** 2026-07-27

---

## 0. Decision summary

Research handed Design two decisions and five directives. Both decisions are
resolved here, at the top, because everything downstream depends on them.

### Decision 1 — the tier-aware disclosure split for the server-enforced 20% floor

**Resolved: the split is expressed in the pill's state machine, not in a banner.**

A filter pill has **three** states, not two:

| State | When | Treatment | Removable |
|---|---|---|---|
| **Neutral** | the filter is at its widest option | outline, label is the filter name | n/a (no ×) |
| **Set** | premium **and** narrower than widest | brand fill, label is the value | yes — × widens to widest |
| **Locked** | `premium === false` | outline + lock glyph, label is the **server-effective value** | no — no × is rendered |

For a free user the discount pill therefore reads **“20%+ off”** with a lock
glyph — the floor is *shown as a real constraint* and is *not styled as a
removable one*, which is exactly Discovery's success criterion. Stars and price
read “Any stars” / “Any price” for the same reason: those are the values the
server is actually applying.

Two consequences, both normative:

1. **Pill labels, the narrowing banner, the empty-state chips and the status
   sentence read from `effectiveFilters`, not from raw component state.** See
   §3.1. A free user arriving on a shared `?min_discount=40&min_stars=5` URL sees
   “20%+ off” and “Any stars”, because that is what `/api/deals` served them.
2. **The narrowing banner (`DealFeed.tsx:1587`) is guarded by `premium`.** Exact
   guard in §7.6. A free user is never offered “Remove ‘20%+ off’”, because the
   API clamps them to 20 regardless of what the client sends
   (`app/api/deals/route.ts:122`). Offering it would be a false affordance.

The *reason* for the lock is delivered on demand, in the sort control's existing
voice: pressing a locked option opens a **Premium filters** explanation region
(§5.3, copy in §6.4).

### Decision 2 — “Clear all filters” returns discount to **widest (0)**

**Resolved: widest.** Research's recommendation is adopted.

`resetFilters` sets `minDiscount: 0`, `minStars: 0`, `maxPriceCents: null`,
`city: defaultCity ?? ''`, `dateFrom: ''`, `dateTo: ''`.

Rationale: “Clear all filters” is rendered next to chips that are all going
neutral. If discount lands on 20 it stays filled after a control that promised to
clear everything — the same contradiction Discovery documented, relocated. The
20% floor survives as the **initial** value (`DEFAULT_MIN_DISCOUNT`, first paint
and URL-omission baseline); it does not survive as a *reset target*. Those are
different jobs and only the reset target is being changed.

### The five directives, and where each is specified

| | Directive | Section | Stage |
|---|---|---|---|
| D1 | One filter control surface | §4 | UI |
| D2 | Active = narrower than widest | §3.2, §7 | UI (+ DEV for two call sites) |
| D3 | Unavailable filters state their reason | §5.3, §6.4 | UI (+ DEV for the analytics allowlist) |
| D4 | Filter changes reach sort-parity feedback | §5.4, §5.5, §5.6 | UI |
| D5 | Filtered-empty names the filter to remove | §5.7 | UI |

---

## 1. Scope and invariants

### In scope (UI stage)

`app/deals/DealFeed.tsx` only: the `FilterPill` component, the render tree
between `:1212` and `:1663`, and the derived predicates at `:930-987`.

### Frozen — do not touch

- `ResultCoverageBoundary.tsx` — props, copy, and branch logic. The entire D5 fix
  is caller-side branch ordering. `app/deals/__tests__/ResultCoverageBoundary.test.tsx`
  asserts against it.
- `HotelResultStatus` (`HotelRecoveryUI.tsx:55-95`) — reused as-is, including the
  `undoLabel` union `'Undo filter change' | 'Undo filter reset'`.
- `lib/hotels/searchCriteria.ts` — `buildHotelResultsUrl` (`:202`) and
  `resolveHotelResultsView` (`:263`) keep `20` as the URL-omission baseline and
  the read fallback. Changing either silently re-points every shared link.
- `DEFAULT_MIN_DISCOUNT = 20` (`:50`) and the two initial-value reads (`:356`,
  `:373`). **Explicit non-goal: do not “tidy” this constant away.**
- `HotelFilterState`, `HotelDealSort`, `HotelSearchCriteriaV1`, `ApiDeal`,
  `HOTEL_SORT_OPTIONS`, the `/api/deals` query parameters, the
  `#hotel-sort-status` region, the `coverageAnnouncement` `sr-only` node, and
  every existing analytics event name and payload shape.
- `parseHotelResultMetadata` and `HotelResultMetadata` — a missing producer, not
  dead client code. Leave the parser and its validation intact.

### Not a data-model change

Per Research §4.1, `min_discount=0` already round-trips end to end. **No new
“no discount floor” representation is introduced.** No sentinel (`null`, `-1`,
`'none'`). The only thing that changes is which predicate answers “is this filter
active”.

### Counts

`resultMetadata` has no producer anywhere in the repo (Research §3.1), so
`trustedMetadata` is `null` on 100% of responses today. **Every string specified
in §6 is true with no count available.** Count-bearing copy appears only in §6.7,
marked as a conditional enhancement that must not ship before the DEV producer
lands.

---

## 2. Information hierarchy

Top to bottom on the hotels tab, after D1:

| Rank | Element | Job |
|---|---|---|
| **Primary** | The deal grid | the product |
| **Secondary** | `HotelSearchCriteriaSummary` (destination + dates) | *what was searched* — owned by the criteria editor |
| **Secondary** | The filter row (3 pills) + the sort control | *how the search is being narrowed and ordered* — one row each, adjacent, same visual weight |
| **Tertiary** | `HotelResultStatus` line + Undo | *what just happened, and how to take it back* |
| **Tertiary** | Narrowing banner / coverage boundary | *why the list ends where it does* |

The change from today: filters and sort become **peers**. They sit adjacent, they
carry labels of the same rank (`Filter hotel deals` / `Sort hotel deals`), they
use the same token vocabulary, and they produce the same class of feedback.
Destination leaves the pill vocabulary entirely and lives only in rank 2.

---

## 3. The filter model

### 3.1 `effectiveFilters` — the single source of truth for every visible string

```ts
// Derived, not state. What the SERVER is applying, which for a free user is not
// what component state holds (app/api/deals/route.ts:120-131).
const effectiveFilters: HotelFilterState = premium
  ? { city, minDiscount, minStars, maxPriceCents, dateFrom, dateTo }
  : { city, minDiscount: DEFAULT_MIN_DISCOUNT, minStars: 0, maxPriceCents: null, dateFrom, dateTo }
```

`city`, `dateFrom` and `dateTo` are **not** clamped — the API honours them for
free users (Research §1.4).

Everything user-visible reads from `effectiveFilters`: pill labels, pill state,
`coverageFilters`, the narrowing banner, the status sentence, the filtered-empty
recovery. Raw state continues to drive the request and the URL.

**Known limitation, recorded not fixed:** a free user on a shared
`?min_discount=40` URL keeps `min_discount=40` in their address bar while seeing
the 20% floor. Rewriting the URL to match entitlement would change
`buildHotelResultsUrl`'s contract, which is frozen. Backlog, §10.

### 3.2 Widest option per filter, and the active predicate

| Filter | Widest option | Widest value | Active when | Clear target |
|---|---|---|---|---|
| Min discount | “Any discount” | `0` | `minDiscount > 0` | `0` |
| Stars | “Any stars” | `0` | `minStars > 0` | `0` |
| Max price | “Any price” | `null` | `maxPriceCents !== null` | `null` |

Discount now matches the two filters that were already correct. This *removes* a
special case; it does not add one.

### 3.3 Which filters can appear as removable chips

```ts
const chipEligible = {
  city:        !defaultCity ? Boolean(effectiveFilters.city) : effectiveFilters.city !== defaultCity,
  minDiscount: premium && effectiveFilters.minDiscount > 0,
  minStars:    premium && effectiveFilters.minStars > 0,
  maxPrice:    premium && effectiveFilters.maxPriceCents !== null,
  dateFrom:    Boolean(effectiveFilters.dateFrom),
  dateTo:      Boolean(effectiveFilters.dateTo),
}
```

The `premium &&` on the three gated filters is the whole of Decision 1's banner
guard: for a free user those three can never become chips, so no recovery
affordance can ever promise something the server will ignore.

### 3.4 `hasActiveFilters` is redefined as “a removable constraint exists”

```ts
const coverageFilters: CoverageFilter[] = [ /* per §3.3, display order unchanged */ ]
const hasActiveFilters = coverageFilters.length > 0
```

This is a strict improvement over `:931`: the two are computed from one rule, so
the empty-state branch and the chips can no longer disagree (Discovery signal 4's
root cause). `hasSecondaryFilters` (`:932`) becomes unused when branch 2 is
deleted in §5.7 — **delete it**.

`filteredRequest` (`:507`) changes its discount clause from
`opts.minDiscount !== DEFAULT_MIN_DISCOUNT` to `opts.minDiscount > 0` and is
**not** tier-gated: it only decides whether the coverage announcement says
“matching”, and a free user at the 20% floor genuinely is seeing a matching
subset.

### 3.5 Recommendation order for `recommendedFilterKey`

Answering Research D5.5. When `trustedMetadata` exists, the existing
`addedCount` ranking (`:966-968`) still wins — that rule is correct and stays.
The fallback (today `coverageFilters[0]`, i.e. always city → discount → …)
changes to an explicit rank:

| Rank | Key | Why it is ranked here |
|---|---|---|
| 1 | `city` | broadest single widening available |
| 2 | `minDiscount` **when > `DEFAULT_MIN_DISCOUNT`** | a deliberately tightened floor (30/40) is the likeliest culprit |
| 3 | `minStars` | |
| 4 | `maxPrice` | |
| 5 | `dateFrom` | |
| 6 | `dateTo` | |
| 7 | `minDiscount` **when `=== DEFAULT_MIN_DISCOUNT`** | never lead with the product default while a user-chosen constraint is still on |

Display order of the chips themselves is unchanged (`city → minDiscount →
minStars → maxPrice → dateFrom → dateTo`), matching `REVIEW_ORDER` in
`HotelRecoveryUI.tsx:13`. Only the *recommendation* is re-ranked.

---

## 4. D1 — One filter control surface

### 4.1 Row A is deleted

`DealFeed.tsx:1220-1274` is removed in full. Not converted to a mirror: a mirror
earns its place only when the control surface is off-screen (Booking's sidebar);
here the control row is 150px away and always visible, so a mirror would be
duplicated content with no new information. The heading block keeps `<h2>Today's
catches</h2>` and the subtitle, and nothing else.

Consequences:

- **The Destination pill is retired.** Destination is owned by
  `HotelSearchCriteriaSummary` + `HotelSearchCriteriaEditor`, which is the
  un-gated path (it works for free users, where the pill was `disabled={!premium}`
  even though the API honours `city`). This also removes the navigate-vs-filter
  split at `:1229-1237` (Research §3.4) from the surface. `city` remains a
  removable **chip** in `coverageFilters` — recovery keeps working; only the
  *pill* goes.
- **Nothing renders on the flights tab.** The filter row lives inside the
  `activeTab === 'hotels'` branch, so the flights tab shows only the “Flight deals
  land soon.” panel.
- **The `criteriaUpdating` trap dies with it.** The false “We couldn't update
  these results” alert (Research §1.1) is unreproducible once row A is gone.

### 4.2 Row B becomes the labelled control surface

```jsx
<section aria-labelledby="hotel-filter-label" className="mb-5">
  <span id="hotel-filter-label" className="mb-1.5 block text-[12px] font-bold leading-5 text-[var(--text-1)]">
    Filter hotel deals
  </span>
  <div className="flex flex-wrap items-center gap-2">
    {/* Min discount, Stars, Max price */}
  </div>
  {/* filter explanation region / scoped failure alert — §5.3, §5.6 */}
</section>
```

The visible label replaces `aria-label="Result filters"` (no test asserts that
string; grep of `app/deals/__tests__/` is clean). It gives the row an accessible
name of the same rank as `#hotel-sort-label` — “Filter hotel deals” / “Sort hotel
deals” — which is the parity Discovery asked for.

**Test:** on the hotels tab, `getAllByRole('button', { name: /min discount/i })`
returns exactly one element. On the flights tab, zero.

---

## 5. Component and state specification

### 5.1 `FilterPill` — new props

```ts
type FilterOption = {
  label: string
  value: string        // stable key for analytics + refs
  selected: boolean
  locked: boolean      // free tier, and not the currently effective option
  onSelect: () => void
}

type FilterPillProps = {
  label: string                       // "Min discount"
  filterKey: 'minDiscount' | 'minStars' | 'maxPrice'
  valueLabel: string | null           // set/locked label; null = neutral
  state: 'neutral' | 'set' | 'locked'
  busy: boolean                       // this pill's request is in flight
  inert: boolean                      // another request owns the feed
  options: FilterOption[]
  align: 'start' | 'end'              // popover anchoring, §8.1
  onClear: () => void                 // rendered only when state === 'set'
  onLockedAttempt: (option: FilterOption) => void
}
```

`disabled` is **gone from the trigger entirely** (D3.1). Nothing about a filter
is ever silently inert.

### 5.2 Pill state machine

| `state` | Condition | Trigger label | × | Glyph |
|---|---|---|---|---|
| `neutral` | `premium && effective value === widest` | filter name (“Min discount”) | no | chevron |
| `set` | `premium && effective value !== widest` | value (“30%+ off”) | yes | chevron |
| `locked` | `!premium` | effective value (“20%+ off”, “Any stars”, “Any price”) | no | lock, then chevron |

Orthogonal flags:

- `busy` — this pill's apply is in flight. Chevron → spinner (the sort trigger's
  spinner, `:1404-1407`). `aria-disabled="true"`, press ignored, menu cannot open.
  Label already shows the newly chosen value (state is set synchronously in
  `applyFilter`), so the pill *is* the pending affordance. **Never `disabled`** —
  focus must not be lost mid-interaction.
- `inert` — `criteriaUpdating || pendingSort !== null || pendingFilterKey !== null`
  (a *different* pill's request). `aria-disabled="true"`, press ignored, menu
  cannot open, `opacity-60`. Filters are **never** blocked by an empty result set:
  an empty feed is precisely when you need to widen.

### 5.3 Locked-option interaction (D3)

The trigger always opens the menu, for every user. The menu is where the gate
lives — exactly the sort control's model (`:1423-1456`), where `newest` is
available and the other two carry a lock.

```
option.locked = !premium && option.value !== <currently effective value>
```

- A locked option renders `aria-disabled="true"` plus the **Premium lock badge**:
  the same 14px lock SVG + the word `Premium`, `text-[12px] font-bold
  text-[var(--text-1)]`, copied from `:1445-1453`.
- Activating a locked option (click, Enter, or Space) is **receivable**: it fires
  `onLockedAttempt`, closes the menu, opens the **Premium filters** region
  (§6.4), moves focus to the region, and fires **no** `/api/deals` request.
- Activating the already-selected option closes the menu and returns focus to the
  trigger — no request, matching `activateSortOption`'s `target === appliedSort`
  path (`:1045-1048`).
- The explanation region is dismissed by `Not now` or `Escape`; focus returns to
  **the pill that was pressed** (a `lockedTriggerRef` captured on attempt), not to
  the sort trigger.
- Only one explanation region is open at a time. Opening the filter region closes
  `premiumExplanationOpen` (sorting) and vice versa.

**Roving focus (D3.5):** the pill menu gains `ArrowDown` / `ArrowUp` (wrapping) /
`Home` / `End` / `Escape` (close + return focus) / `Tab` (close, let focus move on),
identical to `handleSortOptionKeyDown` (`:1066-1084`). `ArrowDown` / `ArrowUp` on
the *trigger* opens the menu focused on the checked option / the last option,
matching `:1393-1399`. This closes the stated-but-unfulfilled `role="menu"`
contract (Research §1.2).

### 5.4 Applying a filter (D4)

`applyFilter` with no `recovery` argument gains the full behaviour object:

```ts
setPendingFilterKey(filterKey)
void fetchDeals({ ...nextFilters, sort: appliedSort, offset: 0, append: false }, {
  focusOnSuccess: true,
  successKind: 'single',
  failureKind: 'filter',                  // new — scoped failure, §5.6
  preserveResultsOnFailure: true,
  undoOnSuccess: {
    target: { ...currentFilters, sort: appliedSort, queryId: resultMetadata?.queryId },
    kind: 'single',
  },
})
```

`RequestBehavior` gains `failureKind?: 'filter' | 'undo'`. This is component-local
request wiring inside a client component — **UI stage**, not DEV.

`successKind: 'single'` already produces “Filter removed. …” in `fetchDeals`
(`:560`), which is wrong for a *selection*. The announcement branch is respecified
in §6.5 so that one code path serves selection, removal, reset, undo and clear-all
with truthful copy in each case.

**Undo (D4.5):** the snapshot is now built for plain selections too. Label
`'Undo filter change'` (existing union member). It is replaced by the next
successful apply and cleared on: undo success, tab change, criteria apply, sort
change, and URL restore — i.e. every `setUndoSnapshot(null)` site that exists
today, unchanged.

### 5.5 Loading treatment (D4.1, D4.2 — fixes Discovery signal 6)

The `loading` branch (`:1531-1534`) is split by whether a previous result set
exists:

```jsx
) : loading && deals.length > 0 ? (
  <>
    <div className={`${gridClass} mb-6`} aria-label="Loading updated hotel deals">
      {Array.from({ length: Math.min(Math.max(deals.length, 1), 6) }).map((_, i) => <SkeletonCard key={`filter-${i}`} />)}
    </div>
    <div inert aria-hidden="true" className={`${gridClass} pointer-events-none opacity-60 transition-opacity duration-150`}>
      {/* the previous grid, exactly as criteriaUpdating renders it at :1519-1525 */}
    </div>
  </>
) : loading ? (
  <div className={gridClass} aria-busy="true" aria-label="Hotel deals">
    {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
  </div>
) : …
```

- Skeleton count is proportional (`min(max(deals.length,1),6)`) — the rule sort
  already uses at `:1529`. After infinite scroll to 40 cards the document no
  longer collapses to 6.
- The previous grid is retained at 60% opacity, `inert` + `aria-hidden`, which is
  the strongest scroll-preservation measure available and already exists in this
  file for `criteriaUpdating`. **Yes** to Research's recommendation.
- The fixed-6 branch survives only for a genuine first paint (`deals.length === 0`).
- The `criteriaUpdating && deals.length > 0` branch (`:1514`) is left ahead of
  this one and is unchanged.

### 5.6 Scoped failure (D4.6)

A failed filter apply must not replace the grid with the full-page error card
(`:1535-1547`). With `failureKind: 'filter'` and `preserveResultsOnFailure: true`:

1. Results, scroll position and the coverage boundary are preserved.
2. Filter state **reverts** to the pre-request values captured in
   `currentFilters`, so the pills stop claiming a value the results do not
   reflect. This mirrors sort, which stays on `appliedSort` and offers to retry
   `failedSort`.
3. A scoped alert renders inside the filter section (§6.6), structurally
   identical to `failedSort` (`:1493-1499`): `role="alert"`, `--error` border,
   `--error-soft` background, one bold line, one explanatory line, one `Retry`
   button that re-applies the attempted change.
4. `setError(true)` is **not** called. The whole-grid error card remains reserved
   for the initial load and for retry-of-initial.

New state: `failedFilter: { key: HotelFilterKey; attempted: HotelFilterState } | null`.
Cleared on any successful apply, on sort change, and on criteria apply.

### 5.7 Empty-state branch order (D5)

Replace `:1548-1581` with, in order:

1. `deals.length === 0 && personalization?.active && !hasActiveFilters`
   → `<PersonalizedEmpty>` — **retained, unchanged.**
2. `deals.length === 0 && hasActiveFilters`
   → `<ResultCoverageBoundary state="confirmed_empty" activeFilters={coverageFilters}
   recommendedFilterKey={recommendedFilterKey} onClearAll={resetFilters} …>`,
   which reaches `filteredEmptyActions` (`ResultCoverageBoundary.tsx:92-99, 158`)
   — `Remove "<label>"` primary, `Clear all filters` secondary **even for a single
   filter**.
3. `deals.length === 0`
   → the same boundary, `activeFilters={[]}`, rendering the unfiltered copy
   “There are no current matches in expaify's tracked deal set.” — **retained.**

Because `hasActiveFilters` is now *defined as* `coverageFilters.length > 0`
(§3.4), branch 2 can no longer be reached with an empty chip list, and branch 3
can no longer be reached with a non-empty one. The old static branch-2 card
(`:1551-1558`) is **deleted**, and with it the “Clear price and rating filters”
button that widened two filters while narrowing a third.

**Re-homing “Edit search” (D5.3):** branch 2 was the only caller of
`openCriteriaEditor('empty_state')`, and `ResultCoverageBoundary` ignores
`onEditSearch` on the deals surface. The entry point is re-homed **below** the
boundary, inside the same wrapper, so `entry_point: 'empty_state'` analytics
survive:

```jsx
<div ref={gridRef} tabIndex={-1}>
  <ResultCoverageBoundary … />
  <div className="mt-3 flex flex-col items-stretch justify-center gap-3 min-[420px]:flex-row">
    <button type="button" onClick={() => openCriteriaEditor('empty_state')} className="btn btn-outline min-h-11 px-6">
      Edit search
    </button>
    {defaultCity ? <a href="/deals" className="btn btn-outline min-h-11 px-6">See all destinations</a> : null}
  </div>
</div>
```

The existing `defaultCity && hasActiveFilters` “See all destinations” link
(`:1570-1579`) folds into this row. `PersonalizedEmptyActions` (`:1580`) stays
where it is.

`ResultCoverageBoundary` itself is **not modified**.

---

## 6. Final UI copy

Every string below is final. No placeholders. All are true with **no count
available**.

### 6.1 Filter row

| Element | Copy |
|---|---|
| Section label | `Filter hotel deals` |
| Discount pill, neutral | `Min discount` |
| Stars pill, neutral | `Stars` |
| Price pill, neutral | `Max price` |
| Discount options | `Any discount` · `20%+ off` · `30%+ off` · `40%+ off` |
| Stars options | `Any stars` · `3★ & up` · `4★ & up` · `5★ only` |
| Price options | `Any price` · `Under $100` · `Under $150` · `Under $200` · `Under $300` |
| Off-list price value | `Under $<n>` (from `maxPriceCents`, as today at `:937`) |

Option lists are unchanged from `DISCOUNT_OPTIONS` / `STARS_OPTIONS` /
`MAX_PRICE_OPTIONS`.

### 6.2 Accessible names

| Element | Accessible name |
|---|---|
| Trigger, neutral | `Min discount` |
| Trigger, set | `Min discount: 30%+ off` |
| Trigger, locked | `Min discount: 20%+ off, included with Premium` |
| Trigger, busy | `Min discount: 30%+ off, updating deals` |
| Clear × | `Remove minimum discount filter` |
| Clear × (stars) | `Remove hotel class filter` |
| Clear × (price) | `Remove maximum price filter` |
| Locked option | `<option label>, included with Premium` |
| Menu | `<label> options` (unchanged) |

The × name **stops saying “Clear”** while narrowing. It now says “Remove”, and it
always widens (D2.3). `Remove minimum discount filter` also matches
`FILTER_NAMES.minDiscount = 'Minimum discount'` in `HotelRecoveryUI.tsx:24`, so
the two surfaces name the same filter the same way.

### 6.3 Status line — the persistent “what is constraining this list” sentence

Rendered by `HotelResultStatus` via `resultStatusMessage`. Built from
`effectiveFilters`, pill filters only (destination and dates are already stated by
`HotelSearchCriteriaSummary` directly above — no duplication).

Fragments:

| Filter | Fragment |
|---|---|
| `minDiscount > 0` | `deals <n>% or more off` |
| `minStars > 0` | `<n> stars and up` |
| `maxPriceCents !== null` | `under $<n> a night` |

Assembly:

| Filters set | Sentence |
|---|---|
| 0 | `` (empty — no clutter on an unconstrained premium feed) |
| 1 | `Showing <f1>.` |
| 2 | `Showing <f1> and <f2>.` |
| 3 | `Showing <f1>, <f2>, and <f3>.` |

**Free tier, always, regardless of state:**

> `Showing every expaify deal at 20% or more off, newest first. Filters and sorting are included with Premium.`

Worked examples:

- Premium, 30% + 4★: `Showing deals 30% or more off and 4 stars and up.`
- Premium, all three: `Showing deals 40% or more off, 4 stars and up, and under $200 a night.`
- Premium, “Any discount” selected, nothing else: `` (neutral — no banner, no sentence)

### 6.4 Premium filters explanation region (D3.3)

Structure identical to `Premium sorting` (`:1478-1492`) — bold title, one
sentence, primary + outline actions.

> **Premium filters**
>
> Filters are included with Premium. You're seeing every expaify deal at 20% or more off, sorted by Recently found.
>
> [ See Premium ] [ Not now ]

`See Premium` → `/join`. `Not now` → dismiss, return focus to the pill that was
pressed. Region label: `aria-label="Premium filters"`.

This sentence is true of `app/api/deals/route.ts:120-131` on both counts: the
discount floor and the sort are both server-enforced for free users.

### 6.5 Completion announcements (D4.3)

Replaces the `countCopy ?? ''` fallthrough at `:557-563`. All countless.

| Action | Announcement |
|---|---|
| Filter selected (premium) | `Filters applied. <status sentence §6.3>` |
| Filter selected → all widest | `Filters applied. Showing all current expaify deals.` |
| Chip removed (`removeRecoveryFilter`) | `Filter removed. <status sentence>` |
| Chip removed → all widest | `Filter removed. Showing all current expaify deals.` |
| Clear all (`resetFilters`) | `Filters cleared. Showing all current expaify deals.` |
| Undo | `Filter change undone. <status sentence>` |
| Failure (scoped) | `Deals couldn't be updated. Your previous filters are still shown.` |

**Nothing on this surface ever announces the empty string.** The `else
setStatusAnnouncement(countCopy ?? '')` branch at `:563` is the single line
Discovery signal 5 is about; it is replaced by the sentence builder.

`Filters reset.` is retired in favour of `Filters cleared.` so the control's
label (`Clear all filters`) and its confirmation use one verb.

### 6.6 Scoped filter failure alert (D4.6)

> **Couldn't apply that filter. Try again.**
>
> Your results still use <previous status sentence, lowercased at the join>.
>
> [ Retry ]

Concretely, reverting from an attempted 40% back to 30% + 4★:

> Your results still use deals 30% or more off and 4 stars and up.

When the previous state had no pill filters set:

> Your results still show all current expaify deals.

### 6.7 Count-bearing copy — **DEV-gated, do not ship in the UI stage**

If and only if a DEV ticket lands the `resultMetadata` producer and
`trustedMetadata` becomes non-null, the status sentence gains a count clause:

- `Showing deals 30% or more off and 4 stars and up · <N> current deals`
- `Filters applied. Showing deals 30% or more off · <N> current deals`

Formatting via the existing `formatDealCount` (`hotelFilterRecovery.ts:202`). The
existing `trustedMetadata && hasActiveFilters` branch (`:985-987`) stays in place
and unreached until then. **The UI stage ships §6.3/§6.5 only.**

---

## 7. State-by-state specification

Every state below must be implemented. Tailwind classes reference tokens that
already exist in `app/globals.css`; per Research §3.3 the pill family and the
sort family are aliases (`--brand: var(--primary)`, `--bg-surface:
var(--surface)`, `--border-strong: var(--line-white)`, `--text-1: var(--ink)`,
`--text-2: var(--ink-soft)`), so converging the naming is a **zero-pixel**
change. No new colours, radii, or font sizes.

### 7.1 Pill — neutral

```
container: inline-flex items-stretch rounded-[var(--radius-pill)]
           border-[1.5px] border-[color:var(--border-strong)]
           bg-[color:var(--bg-surface)] text-[color:var(--text-1)]
trigger:   flex min-h-11 items-center gap-1.5 rounded-[var(--radius-pill)]
           px-4 text-[13px] font-medium
           hover:border-[color:var(--border-hover)]
glyph:     12px chevron, currentColor, aria-hidden
```

`min-h-11` (44px) replaces the current 36px so the pill meets the same touch
target as every other control on the page (`btn` is `min-h-11` throughout, and
the sort trigger is `min-h-11`). This is a spacing change only — no new token.

### 7.2 Pill — set

```
container: … border-[color:var(--brand)] bg-[color:var(--brand)] text-white
trigger:   … rounded-l-[var(--radius-pill)] pl-4 pr(1)
clear ×:   flex items-center rounded-r-[var(--radius-pill)] pl-1 pr-3 min-h-11
```

Identical geometry to today's active pill; only the token names and the height
change.

### 7.3 Pill — locked

```
container: … border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] text-[color:var(--text-1)]
trigger:   … min-h-11 px-4 text-[13px] font-medium
glyph:     14px lock SVG (the one at :1447-1450), then the 12px chevron
no × is rendered
```

Outline, not fill: the value is disclosed, but nothing about the treatment
promises removability.

### 7.4 Pill — busy / inert

```
busy:  aria-disabled="true"; chevron replaced by the sort spinner
       (h-4 w-4 animate-spin, :1404-1407); container treatment unchanged
inert: aria-disabled="true"; opacity-60; cursor-not-allowed; menu cannot open
```

Neither uses the `disabled` attribute. Focus is never destroyed.

### 7.5 Menu (all tiers)

```
role="menu" aria-label="<label> options"
absolute top-full z-30 mt-2 max-h-[320px] min-w-[176px]
max-w-[calc(100vw-2rem)] overflow-y-auto
rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] p-1 shadow-[var(--shadow-lift)]
align='start' → left-0 ; align='end' → right-0
option: flex min-h-11 w-full items-center gap-3 rounded-[calc(var(--radius-control)-0.125rem)]
        px-3 py-2.5 text-left text-[13px] hover:bg-[color:var(--bg-muted)]
selected: bg-[color:var(--brand-soft)] font-medium text-[color:var(--primary-deep)]
locked:   aria-disabled="true" + Premium lock badge, right-aligned
```

Option height rises to `min-h-11` for the same touch-target reason.

### 7.6 The narrowing banner (`:1587-1601`)

Guard becomes:

```jsx
!isColdSampleFeed && premium && hasActiveFilters && recommendedCoverageFilter
```

Copy unchanged: `Current filters narrow this list.` /
`Remove "<label>"` / `Clear all filters`. Two behavioural consequences:

- A **free** user never sees it — Decision 1. They cannot act on it.
- A **premium** user at the default 20% floor *does* see `Remove "20%+ off"`,
  which is the point: the floor becomes a disclosed, removable constraint rather
  than an invisible one. Per §3.5 it is ranked last, so it is only ever the
  recommendation when it is the *only* thing narrowing the list.

### 7.7 Empty — filtered (premium, 5★ + Under $100 → zero)

> **No current expaify deals match your filters**
> Remove one filter to expand this expaify result set.
> [ Remove “5★ only” ] [ Clear all filters ]
> [ Edit search ]

(Boundary copy is `ResultCoverageBoundary`'s own, unmodified. `5★ only` is
selected by §3.5's rank.)

### 7.8 Empty — filtered (free, destination narrowed to zero)

Same boundary, chips limited to city/dates by §3.3:

> **No current expaify deals match your filters**
> Remove one filter to expand this expaify result set.
> [ Remove “Miami” ] [ Clear all filters ]
> [ Edit search ] [ See all destinations ]

### 7.9 Empty — unfiltered

Unchanged: the boundary's `filtered === false` copy, plus the re-homed
`Edit search`.

### 7.10 Empty — personalized

Unchanged `PersonalizedEmpty` + `PersonalizedEmptyActions`.

### 7.11 Cold / sample feed

`isColdSampleFeed` renders `ColdSampleFeedIntro` and suppresses the narrowing
banner, as today. Pills remain fully operable — a sample feed is a state you want
to widen out of. Unlike the **sort** control, which is correctly disabled on a
mock feed (`sortControlDisabled`, `:980`), filters are never disabled by feed
quality.

### 7.12 Error — initial load

Unchanged: the full-page error card at `:1535-1547` with `Retry`. Reached only
when the *initial* load fails, or when a retry of it fails.

### 7.13 Error — filter apply

§5.6 + §6.6. Results preserved, pills reverted, scoped alert with `Retry`.

---

## 8. Responsive

### 8.1 Mobile — 375px

- Available content width: 343px (375 − 2×16 gutter).
- Neutral row: `Min discount` (~132px) + `Stars` (~84px) + `Max price` (~104px) +
  2×8px gap ≈ **336px — one line.** Deleting row A removes an entire second pill
  row plus its wrap, which is the single largest vertical saving in this repair.
- Set pills grow (value + ×) and the row wraps to two lines via `flex-wrap
  gap-2`. Two lines maximum for three pills; no overlap, no clipping.
- Popover anchoring: `align='end'` (`right-0`) for the **Max price** pill,
  `align='start'` for the other two, plus `max-w-[calc(100vw-2rem)]`. Without
  this the third pill's `left-0` menu overflows the viewport at 375px — a bug the
  current `min-[680px]:right-0` breakpoint does not cover.
- Explanation region and scoped alert: full width, buttons stack
  (`flex-col`, `min-[420px]:flex-row`), each `min-h-11`.
- Filtered-empty actions stack full width (`ResultCoverageBoundary`'s existing
  `w-full sm:w-auto`).
- Skeletons: `grid-cols-1`, so proportional counts read naturally.

### 8.2 Desktop — 1280px

- Filter row and sort control are separate blocks, filter above sort, both
  left-aligned to the grid.
- The sort section's `sm:grid-cols-[auto_1fr]` (`:1373`) is **untouched** — no
  directive changes that section's layout.
- Menus: `sm:w-[22rem]` for the explanation region, matching `Premium sorting`.
- Grid stays `min-[1024px]:grid-cols-3`; the retained 60%-opacity grid uses the
  same `gridClass`, so no reflow between loading and loaded.

---

## 9. Keyboard, focus, and accessibility

Tab order on the hotels tab, after D1:

1. Criteria summary `Edit`
2. `Hotels` tab → `Flights` tab
3. **Min discount** → **Stars** → **Max price** (three triggers, plus each set
   pill's × immediately after its trigger)
4. Sort trigger
5. Undo (when present)
6. Grid cards
7. Coverage boundary control

Three triggers, not eight (Research §1.2). Every accessible name is unique.

| Interaction | Behaviour |
|---|---|
| `Enter` / `Space` on trigger | toggles the menu (or, when `busy`/`inert`, does nothing) |
| `ArrowDown` on trigger | opens menu, focus on the checked option |
| `ArrowUp` on trigger | opens menu, focus on the last option |
| `ArrowDown` / `ArrowUp` in menu | roving focus, wrapping |
| `Home` / `End` in menu | first / last option |
| `Escape` in menu | closes, focus returns to the trigger |
| `Tab` in menu | closes, focus moves on |
| Select an available option | applies, closes, focus returns to the trigger; on completion focus moves to `resultStatusRef` (`focusOnSuccess`) |
| Select a locked option | opens the Premium filters region, focus moves to it |
| `Escape` in that region | dismisses, focus returns to the pill that was pressed |
| Press × | applies the widening, same focus contract as a selection |

- `aria-haspopup="menu"`, `aria-expanded`, `role="menu"`,
  `role="menuitemradio"` + `aria-checked` are all retained.
- Locked options use `aria-disabled="true"` — reachable, receivable, announced
  with a reason.
- The busy pill uses `aria-disabled="true"`; the results section keeps
  `aria-busy={loading || Boolean(pendingSort) || loadingMore}` (`:1503`).
- The retained previous grid is `inert` + `aria-hidden="true"`, so screen readers
  and Tab never enter stale results.
- Live regions: `HotelResultStatus`'s `role="status"` (filter outcomes),
  `#hotel-sort-status` (sort), the `sr-only` `coverageAnnouncement` (coverage).
  **All three are preserved; none is repurposed.** This repair adds no fourth
  live region.
- Focus ring: the global `--focus-outline` / `--focus-ring` applies; pills must
  not suppress `focus-visible`.

---

## 10. Stage routing — what is UI and what is DEV

### UI stage (`UI-DEALS-FEED-FILTER-FRICTION-01`) — `app/deals/DealFeed.tsx` only

1. Delete row A (`:1220-1274`); retire the Destination pill.
2. Rebuild `FilterPill` per §5.1–§5.3 and §7.1–§7.5.
3. `effectiveFilters` (§3.1); active predicates → `> 0` / `> 0` / non-null
   (§3.2); `chipEligible` (§3.3); `hasActiveFilters = coverageFilters.length > 0`
   (§3.4); delete `hasSecondaryFilters`; `filteredRequest` discount clause (§3.4);
   recommendation rank (§3.5).
4. `onClear` → widest for all three filters; `removeRecoveryFilter('minDiscount')`
   → `0` (`:804`); `resetFilters` → widest for all (Decision 2, `:795`).
5. D4: `pendingFilterKey`, `failedFilter`, `failureKind`, proportional skeletons
   + retained grid, `focusOnSuccess`, `undoOnSuccess`, scoped failure.
6. D5: branch reorder + re-homed `Edit search`; delete the static branch-2 card.
7. Copy per §6.1–§6.6.
8. Banner guard per §7.6.
9. `npx tsc --noEmit --incremental false` exits 0; `npm test -- --passWithNoTests`
   exits 0.

**The UI stage must not emit `hotel_filter_disabled_attempted`** — the server
allowlist rejects unknown event names (`app/api/analytics/route.ts:56-86`). Ship
the interaction; the event follows in DEV.

### DEV stage (`DEV-DEALS-FEED-FILTER-FRICTION-01`) — required, four items

1. **`app/deals/hotelFilterRecovery.ts:103`** — `activeKeys`:
   `filters.minDiscount !== 20` → `filters.minDiscount > 0`.
2. **`app/deals/hotelFilterRecovery.ts:125`** — `valueMatchesBaseline`:
   `value.value === 20` → `value.value === 0`. Without this a server-proposed
   recovery option whose `relaxedTo` is `0` is rejected by `parseOption` (`:143`)
   and silently dropped, and the recovery rail goes dark for the most common
   filter the moment a producer lands (Research §4.5). Both are pure client-side
   validators — `HotelRecoveryOption`, `HotelResultMetadata` and the wire shape
   are untouched.
3. **`app/api/deals/route.ts:138`** — `hasFilters`: `minDiscount !== 20` →
   `minDiscount > 0`. Gates the mock fallback only.
4. **`app/api/analytics/route.ts`** — add to `REQUIRED_PROPERTIES`:

   ```ts
   hotel_filter_disabled_attempted: [
     'filter_key', 'filter_from', 'filter_to',
     'premium_eligible', 'loaded_result_count', 'viewport_band', 'filter_state',
   ],
   ```

   Allowed values — `filter_key`: `min_discount` | `min_stars` | `max_price`.
   `filter_from` / `filter_to`: `any` | `20` | `30` | `40` | `3` | `4` | `5` |
   `under_100` | `under_150` | `under_200` | `under_300` | `other`.
   `premium_eligible`: boolean. `loaded_result_count`: bounded integer.
   `viewport_band`: `mobile_375` | `desktop_1280` | `other`. `filter_state`: the
   existing `validFilterState` validator — unchanged, since it already accepts
   `min_discount: 0` (`:114`), so D2 needs no analytics migration.

   Optional second entry, same shape minus `filter_from`, for a successful apply
   (`hotel_filter_changed`, adding `request_ms`) — recommended so D4 is
   measurable, but not required by any directive.

5. **`resultMetadata` producer** — required only if §6.7's count-bearing copy is
   ever wanted. Nothing in §6.1–§6.6 depends on it. Separate ticket.

### Backlog — out of scope for this feature

- Discovery signal 7: `replaceState` history and the dead `popstate` restore
  (`:428-436`, `:725`). Fixing it requires `criteriaVersion` semantics to change,
  which constraint 1 freezes.
- A free user's URL retaining `min_discount=40` while the server serves 20 (§3.1).
- `HotelFilterRecoveryPanel`'s reset-confirmation copy (`HotelRecoveryUI.tsx:224-225`)
  still says “Reset to 20%+ off”. That component is **not rendered by `DealFeed`**
  (only `HotelResultStatus` is imported), so it is unreachable from this surface
  and out of scope; it must be updated to “any discount” by whichever ticket
  brings the panel back.

---

## 11. Acceptance criteria

Each maps to a Research directive and is independently testable.

| # | Criterion | Directive |
|---|---|---|
| 1 | Hotels tab: `getAllByRole('button', { name: /min discount/i })` returns exactly **one** element. Flights tab: **zero**. | D1 |
| 2 | No Destination pill exists anywhere on the feed; `city` still appears as a removable chip in the filtered-empty state. | D1 |
| 3 | A pill press during `criteriaUpdating` is impossible; the false “We couldn't update these results” alert cannot be reproduced. | D1 |
| 4 | Premium, “Any discount” selected: pill is neutral outline, has **no ×**, and no “Current filters narrow this list” banner renders. | D2 |
| 5 | Premium, “20%+ off” selected: pill is filled with an ×; pressing the × yields “Any discount” and a wider-or-equal result set. | D2 |
| 6 | URL after “Any discount” contains `min_discount=0`; after “20%+ off” contains **no** `min_discount` param. | D2 |
| 7 | No sequence of presses produces a `Remove "Any discount"` affordance. | D2 |
| 8 | `Clear all filters` leaves all three pills neutral — discount included. | D2 / Decision 2 |
| 9 | Free tier: the discount pill reads `20%+ off` with a lock glyph and no ×; stars and price read `Any stars` / `Any price`. | D3 / Decision 1 |
| 10 | Free tier, keyboard only: Tab to `Min discount`, `Enter`, `ArrowDown` to `30%+ off`, `Enter` → the Premium filters region receives focus and is announced; `Escape` returns focus to the pill; **no `/api/deals` request fires**. | D3 |
| 11 | The region's accessible text names both the discount floor and the sort actually in effect. | D3 |
| 12 | Locked options carry the `Premium` lock badge and `aria-disabled="true"`. | D3 |
| 13 | The pill menu responds to ArrowUp/ArrowDown/Home/End/Escape/Tab. | D3 |
| 14 | Premium, ≥20 cards loaded, change one filter: the document does **not** collapse to 6 skeletons; the previous grid stays visible at 60% opacity; the operated pill shows a spinner. | D4 |
| 15 | On completion the status region announces a **non-empty** sentence and focus lands on it. | D4 |
| 16 | An `Undo filter change` control is present after a plain filter selection and restores the prior filter set. | D4 |
| 17 | Network failure during an apply: visible cards remain, pills revert, a scoped `Retry` alert appears, the full-page error card does **not**. | D4 |
| 18 | Premium, 5★ + Under $100 → zero: the empty state renders `No current expaify deals match your filters`, `Remove "5★ only"`, `Clear all filters` (with a single filter too), and `Edit search`. | D5 |
| 19 | Pressing the primary widens exactly one filter and leaves the other in place. | D5 |
| 20 | `entry_point: 'empty_state'` still fires from the filtered-empty state. | D5 |
| 21 | 375px: the neutral filter row occupies one line; the Max price menu does not overflow the viewport; nothing overlaps or clips. | constraint 2 |
| 22 | 1280px: the sort section's two-column grid is visually unchanged. | constraint 2 |
| 23 | `#hotel-sort-status`, the `coverageAnnouncement` node and the `HotelResultStatus` focus target all still work. | constraint 3 |
| 24 | `npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests` both exit 0. | quality bar |

---

## 12. Constraint check

| Constraint | Status |
|---|---|
| No change to the filter/sort data model or API contract | **Held.** Only the *active* predicate moves. `DEFAULT_MIN_DISCOUNT`, `buildHotelResultsUrl`, `resolveHotelResultsView`, `HotelFilterState`, `HotelDealSort`, `HotelSearchCriteriaV1` and the `/api/deals` params are untouched. No sentinel value is introduced (§1). `effectiveFilters` is derived, not stored, and never reaches the wire. |
| Existing tokens only; 375px and 1280px stay usable | **Held.** §7 uses only tokens already in `app/globals.css`; per Research §3.3 the two families are aliases, so the rename is zero-pixel. The only geometry change is 36px → 44px pill height, which aligns pills with every other control and improves the 375px touch target. The `sm:grid-cols-[auto_1fr]` sort grid is untouched. D1 removes an entire pill row at 375px. |
| Preserve every contract, live region and analytics payload | **Held.** `ResultCoverageBoundary` is frozen; `HotelResultStatus`, `focusOnSuccess` and `undoOnSuccess` are reused as they exist; all three live regions are preserved and none is repurposed; every existing event name and payload is unchanged; the one new event is routed to DEV so the UI stage never emits something the allowlist rejects. |

---

## 13. Handoff

Next stage: **UI-DEALS-FEED-FILTER-FRICTION-01** — UI Implementation
(Claude Fable 5), scoped per §10 to `app/deals/DealFeed.tsx`.

UI must create **DEV-DEALS-FEED-FILTER-FRICTION-01** on completion, carrying the
four DEV items in §10. `TEST-DEALS-FEED-FILTER-FRICTION-01` follows DEV, and
gates on §11.
