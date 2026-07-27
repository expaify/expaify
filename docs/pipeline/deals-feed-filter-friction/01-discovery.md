# 01 — Discovery: Filter and sort friction on the deals feed

**Ticket:** UXD-DEALS-FEED-FILTER-FRICTION-01
**Stage:** UX Discovery
**Surface:** `app/deals/DealFeed.tsx` (rendered by `app/deals/page.tsx` and the `/destinations/[city]` pages)
**Date:** 2026-07-27

---

## Problem statement

> On the deals feed, the filter controls do not tell the user what is actually
> constraining their results: the same three filters render twice on one screen,
> the pills silently do nothing for non-premium users, and choosing the widest
> option ("Any discount") marks the filter as *active* — so the user cannot tell
> why the result set looks the way it does or which control will widen it.

Sorting on this feed has been repaired (pending spinner, live status line,
error + retry, skeleton grid, "Sorted by X · N deals loaded"). Filtering has
not. The friction is the **asymmetry**: two controls sitting 150px apart on the
same page, one of which explains itself completely and one of which explains
nothing.

---

## Who is affected, and at which step

| Who | Step | What they hit |
|---|---|---|
| **Free (non-premium) user, first search** | Lands on `/deals`, sees the pill row, taps "Min discount" | Nothing happens. The pill is `disabled` at 50% opacity with no reason given. The *sort* control directly below it, when tapped, opens a "Premium sorting" panel with a `See Premium` CTA. Same gate, two behaviours. |
| **Any user, refining results** | Scrolls the feed, opens a pill, picks an option | The whole grid is replaced by 6 generic skeletons regardless of how many cards were loaded. After infinite scroll has pulled 40+ cards, page height collapses and the scroll position is lost. There is no "filter applied" confirmation and no undo — undo exists only for the *removal* path. |
| **Any user, broadening results** | Opens "Min discount", picks "Any discount" | The pill turns solid teal (the "active filter" treatment) and grows an × labelled "Clear min discount filter". Pressing that × sets the discount back to **20%+ off** — clearing narrows. A banner also appears reading "Current filters narrow this list", which is false for this selection. |
| **Any user, filtered to zero** | Filters until the grid is empty | Gets a static empty card ("No hotel deals match this search") whose only broad action is "Clear price and rating filters". The richer per-filter recovery boundary — which names the exact chip to remove — is unreachable in this state (see signal 4). |
| **Any user, returning via Back** | Applies 3 filters, presses Back | Leaves the feed entirely. Filter and sort changes write history with `replaceState` only, so no filter step is ever undoable by Back. |

Primary affected step: **refining results after a first search** — the moment
the Deal Score comparison is supposed to pay off.

---

## Measurable signals the problem exists

Every signal below is read directly from `app/deals/DealFeed.tsx` at the
revision on this branch.

### 1. The filter row is rendered twice on the hotels tab

- Row A — `DealFeed.tsx:1220-1274`, inside the "Today's catches" heading block,
  **not** gated on `activeTab`. Renders Destination (when `!defaultCity`),
  Min discount, Stars, Max price.
- Row B — `DealFeed.tsx:1346-1368`, inside the `activeTab === 'hotels'` branch,
  above the sort control, labelled `aria-label="Result filters"`. Renders
  Min discount, Stars, Max price.

On the hotels tab (the default and only working tab) both rows are on screen
simultaneously, bound to the same state. Changing "Stars" in row A visibly
changes "Stars" in row B. The two rows are not even consistent:

- Row A has a Destination pill; row B does not.
- Row A: `disabled={!premium}`. Row B: `disabled={!premium || criteriaUpdating}`.
  During a criteria update, row A stays interactive while row B greys out.

A screen-reader user tabbing the page encounters "Min discount" twice with no
distinguishing context. This is the single largest source of "why did that
change?" on the surface.

### 2. Disabled filter pills give no reason; the sort control does

`FilterPill` (`DealFeed.tsx:223-322`) renders `disabled` as
`disabled:cursor-not-allowed disabled:opacity-50` and nothing else — no
tooltip, no lock icon, no `aria-describedby`, no copy. All four pills pass
`disabled={!premium}`.

The sort control, for the identical entitlement gate, renders a `Premium` lock
badge per locked option (`DealFeed.tsx:1445-1453`) and, on activation, an
explanatory region: *"Sorting options are included with Premium. Your results
are currently sorted by Recently found."* with `See Premium` / `Not now`
(`DealFeed.tsx:1478-1492`).

Measurable: `hotel_sort_disabled_attempted` is tracked
(`DealFeed.tsx:1051`). There is **no equivalent event** for a blocked filter
attempt, because a blocked filter attempt is not even receivable — the button
is `disabled`, so it fires no click. The friction is currently invisible in
analytics.

### 3. "Any discount" is treated as an active filter

`DEFAULT_MIN_DISCOUNT = 20` (`DealFeed.tsx:50`) is both the default and the
baseline for "is a filter active":

- `hasActiveFilters` (`DealFeed.tsx:931`) is true when `minDiscount !== 20`.
- The pill's `activeLabel` (`DealFeed.tsx:1243`, `:1349`) is non-null when
  `minDiscount !== 20`, so `DISCOUNT_OPTIONS[0]` (`{ label: 'Any discount',
  value: 0 }`, `DealFeed.tsx:86`) renders in the solid-teal active treatment.
- `onClear` sets `minDiscount` back to `DEFAULT_MIN_DISCOUNT`
  (`DealFeed.tsx:1245`) — i.e. the "clear filter" × applies a 20% floor.
- The same condition drives `coverageFilters` (`DealFeed.tsx:960`) and so the
  "Current filters narrow this list. Remove 'Any discount'" banner
  (`DealFeed.tsx:1587-1601`), which offers to *remove* the option that widened
  the search.

The feed's default state is therefore a hidden 20%-off filter that is never
disclosed as a filter, while the act of turning it off is presented as
switching one on.

### 4. The per-filter empty-state recovery is unreachable

The empty branch ordering in `DealFeed.tsx:1548-1581`:

1. `deals.length === 0 && personalization?.active && !hasActiveFilters` → `PersonalizedEmpty`
2. `deals.length === 0 && hasActiveFilters` → static card, generic copy
3. `deals.length === 0` → `ResultCoverageBoundary state="confirmed_empty"` with
   `activeFilters={coverageFilters}` and `recommendedFilterKey`

Branch 3 is only reached when `hasActiveFilters` is **false**. When
`hasActiveFilters` is false, `coverageFilters` (`DealFeed.tsx:958-965`) computes
to `[]` and `recommendedCoverageFilter` is `undefined`. `FilterActions` in
`ResultCoverageBoundary.tsx:48` returns `null` when there is no recommended
filter.

So the component built to say *"Remove '4★ & up'"* in the filtered-empty state
can never say it in the filtered-empty state. The user who filtered themselves
to zero gets branch 2's fixed copy — "Try another destination or check-in
window. Your price and rating filters may also hide available deals." —
which names no filter and offers, at best, a blanket "Clear price and rating
filters" that discards three filters at once.

### 5. Filter changes have no completion feedback and no undo; sort has both

For a pill selection, `applyFilter` is called with no `recovery` argument
(`DealFeed.tsx:1249`, `:1260`, `:1271`, and row B equivalents). That path:

- `setUndoSnapshot(null)` (`DealFeed.tsx:642`) — no undo affordance.
- passes `{}` as `behavior` (`DealFeed.tsx:650`) — so `focusOnSuccess` is
  false and `successKind` is undefined.
- On success, `statusAnnouncement` falls through to `countCopy ?? ''`
  (`DealFeed.tsx:563`), and `countCopy` is `null` unless
  `parsedMetadata.inventoryKind === 'live'`. On a cold/sample or
  non-premium feed the confirmation string is **empty**.

Compare the removal path (`removeRecoveryFilter`, `DealFeed.tsx:800-810`),
which gets `focusOnSuccess: true`, a `successKind`, a spoken "Filter removed.
N match.", and an Undo control. And compare sort, which gets a spinner in the
trigger, a persistent "Sorted by X · N deals loaded" line, and a dedicated
`failedSort` alert with Retry (`DealFeed.tsx:1493-1499`).

Net: the most common interaction on the surface — pick a filter option — is
the one with the least feedback.

### 6. Loading a filter change discards the result set and the scroll position

`fetchDeals` with `append: false` immediately runs `setLoading(true)` and
`setResultMetadata(null)` (`DealFeed.tsx:446-447`). The render then takes the
`loading` branch (`DealFeed.tsx:1531`) and emits a **fixed 6** skeleton cards.

Sort does this better: `pendingSort` renders
`Math.min(Math.max(deals.length, 1), 6)` skeletons (`DealFeed.tsx:1529`) and
`criteriaUpdating` keeps the previous grid visible at 60% opacity behind the
skeletons (`DealFeed.tsx:1514-1526`). Filters get neither. After infinite
scroll has appended several pages, a filter change collapses the document from
N cards to 6 skeletons; the browser clamps scroll and the user is thrown to a
position that does not correspond to anything they were reading. No element
receives focus on completion either, so keyboard and screen-reader users are
left wherever the collapse put them.

### 7. Back never steps back through a filter

The URL sync effect (`DealFeed.tsx:428-436`) uses
`window.history.replaceState` for every filter and sort change. No filter or
sort change ever pushes a history entry, so Back from a refined feed exits the
feed rather than undoing the last refinement.

Additionally, the `popstate` handler's `restoreCriteriaFromLocation` early-returns
when `restored.criteriaVersion === criteria.criteriaVersion`
(`DealFeed.tsx:725`). `criteriaVersion` changes only on destination/date edits,
never on filter or sort changes — so even if a view-only history entry existed,
the restore would be skipped and the URL and the UI would disagree.

---

## Constraints the fix must respect

1. **No change to the filter/sort data model or the API contract.**
   `HotelFilterState`, `HotelDealSort`, `HotelSearchCriteriaV1`,
   `resolveHotelResultsView` / `buildHotelResultsUrl`, and the
   `/api/deals` query parameters stay as they are. The single exception this
   discovery flags as a **real gap** requiring downstream judgement is signal 3:
   `DEFAULT_MIN_DISCOUNT` serves double duty as "the default value" and "the
   zero point for *is this filter active*". Separating those two meanings may
   require a distinct "no discount floor" representation. Research and Design
   must decide; UI must not invent one unilaterally.

2. **Existing design tokens only, and both breakpoints stay usable.**
   Filter pills currently use the `--primary` / `--surface` / `--line-white` /
   `--radius-pill` family; the sort control and coverage boundary use the
   `--text-1` / `--text-2` / `--bg-surface` / `--border-strong` /
   `--radius-control` family. Any convergence uses tokens that already exist in
   `app/globals.css`. No new colours, no new radii, no new font sizes. Must not
   overlap or clip at 375px, where the pill row already wraps to multiple lines,
   and must not regress the 1280px two-column sort/status grid
   (`sm:grid-cols-[auto_1fr]`, `DealFeed.tsx:1373`).

3. **Preserve every existing contract on the surface.** `DealFeed`'s exported
   props, `HOTEL_SORT_OPTIONS`, `ApiDeal`, and the `ResultCoverageBoundary` /
   `HotelResultStatus` / `HotelSearchCriteriaSummary` interfaces are consumed
   elsewhere and by tests in `app/deals/__tests__/`. Keep the live regions
   (`#hotel-sort-status`, the `coverageAnnouncement` `sr-only` node, the
   `HotelResultStatus` focus target) working — this repair must not trade one
   accessibility affordance for another. Keep every existing analytics event
   name and payload shape intact.

---

## Success statement

**This is solved when a first-time user on the deals feed can tell, without
guessing, why the current result set looks the way it does and how to get back
to a broader view** — specifically:

- There is exactly one filter control for each filter on the screen.
- A filter that is unavailable to the user says why, in the same voice the sort
  control already uses.
- Every constraint currently narrowing the results, including the default
  discount floor, is either shown as a removable thing or is not styled as one.
- Choosing the broadest option for a filter never reads as switching a filter
  on, and never offers to be "cleared" back into a narrower state.
- Applying a filter produces the same class of feedback that changing the sort
  already produces: a visible pending state proportional to the current result
  set, a spoken result count on completion, and a way back.
- When filters produce zero results, the recovery names the specific filter to
  remove rather than offering a blanket reset.

---

## Handoff

Next stage: **UXR-DEALS-FEED-FILTER-FRICTION-01** — UX Research.

Research should audit `app/deals/DealFeed.tsx`, `app/deals/ResultCoverageBoundary.tsx`,
`app/deals/hotelFilterRecovery.ts`, and `lib/hotels/searchCriteria.ts` against
the Booking.com and Google Flights filter-chip patterns, and must return a
position on the signal-3 data-model gap before Design begins.
