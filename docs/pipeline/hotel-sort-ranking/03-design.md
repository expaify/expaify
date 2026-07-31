# UX Design Spec — Hotel Result Sorting and Ranking Clarity

**Ticket:** UXDES-HOTEL-SORT-RANKING-01
**Stage:** UXDES (UX Design)
**Date:** 2026-07-31
**Upstream:** `docs/pipeline/hotel-sort-ranking/02-research.md` → `01-discovery.md`
**Surfaces:** `app/deals/DealFeed.tsx`, `app/components/ui/DealCard.tsx`, `app/components/ui/LockedDealCard.tsx`
**Downstream:** `UI-HOTEL-SORT-RANKING-01` (component layer only — no DEV work)

---

## 0. What this spec delivers

Five directives from the research brief, resolved into implementation-ready detail:

| ID | Directive | Lands in |
| --- | --- | --- |
| D1 | Render `firstSeen` as a **Found** line on `DealCard` | `DealCard.tsx` |
| D2 | Replace `LockedDealCard`'s hardcoded "Deal found today" with the same Found wording | `LockedDealCard.tsx`, `DealFeed.tsx` (3 call sites) |
| D3 | One persistent basis clause per sort + one term for the default everywhere | `DealFeed.tsx` |
| D4 | No visual emphasis on position 1; default basis carries an explicit negative | `DealFeed.tsx` (constraint, mostly a prohibition) |
| D5 | `hotel_sort_menu_dismissed` + `hotel_default_ranking_explanation_viewed` | `DealFeed.tsx` |

Nothing here changes a provider call, the money shape (`{ priceCents, currency }`), the deal contract, the
`/api/deals` request/response, `lib/pipeline/dealDetection.ts`, or `lib/paywall.ts`. `firstSeen` is already on
the wire for locked and unlocked rows (`app/api/deals/route.ts:53`, `:75`) and already passed into `DealCard`
(`DealFeed.tsx:1922`).

---

## 1. THE REQUIRED DECISION — basis clause vs. the `role="status"` region

**Decision: the basis clause lives OUTSIDE the `aria-live` region, as a static sibling, and is wired to the
sort trigger via `aria-describedby`.**

### 1.1 Why

The status region at `DealFeed.tsx:1735` is `role="status" aria-live="polite" aria-atomic="true"`.
`aria-atomic="true"` means **the entire region is re-announced whenever any part of its subtree changes**.
Today that region already re-announces on every deal-count change — infinite scroll appending 12 rows
re-announces "Sorted by Recently found · 24 deals loaded". If the basis clause were placed inside it, every one
of those announcements would drag a static, unchanged sentence along with it:

> "Sorted by Recently found, 24 deals loaded, newest expaify finds first, not cheapest, not biggest discount."

That is a screen-reader verbosity regression, and the research brief names it explicitly as one
(§6 D3: *"Announcing the static basis clause on every re-render would be a regression"*). The `price` caveat
(`:1747`) is inside the region today and already has this defect at a smaller scale; moving it out is part of
this change, not a side effect of it.

### 1.2 What replaces the lost announcement

Removing the clause from the live region must not make it unreachable non-visually. Three mechanisms cover it:

1. **`aria-describedby` on the sort trigger.** The trigger already carries `aria-describedby="hotel-sort-status"`
   (`:1661`). It becomes `aria-describedby="hotel-sort-status hotel-sort-basis"`. The basis is then read
   **on demand**, when the user focuses the control that owns the concept — not spontaneously on every count
   change. This is the correct AT contract for static explanatory copy attached to a control.
2. **The clause is plain visible text in the reading order**, directly above the results grid. Any linear
   screen-reader pass reaches it before card 1.
3. **The menu option description** for the active sort is word-for-word identical to the basis clause (§3.2),
   so a user who opens the menu hears the same sentence.

### 1.3 What must NOT change

The live region keeps announcing exactly what it announces today and nothing more:

| Trigger | Announced text (unchanged) |
| --- | --- |
| Initial load | `Loading hotel deals…` |
| Sort requested | `Sorting by {label}…` |
| Sort applied | `Sorted by {label} · N deals loaded` |
| Mock feed | `Sorting is available with live deals.` |
| Empty | `No deals to sort.` |

`role="status"`, `aria-live="polite"`, `aria-atomic="true"`, and `id="hotel-sort-status"` all stay. Only the
`appliedSort === 'price'` caveat paragraph moves out of the region.

---

## 2. Layout — the sort status block

### 2.1 Structure

The section at `DealFeed.tsx:1644-1774` keeps its grid. One new child is added, spanning both columns, after
the status region and before the explanation/alert blocks.

```tsx
<section
  ref={sortControlRef}
  aria-labelledby="hotel-sort-label"
  className="relative mb-8 grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr] sm:items-start"
>
  {/* col 1 — label + trigger + menu (UNCHANGED except aria-describedby on the trigger) */}
  <div className="relative w-full sm:w-auto"> … </div>

  {/* col 2 — live region, dynamic copy only */}
  <div
    id="hotel-sort-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    className="min-h-5 text-caption leading-5 text-[var(--text-2)] sm:pt-6 sm:text-right"
  >
    {/* the five dynamic branches from §1.3 — the price caveat <p> is REMOVED from here */}
  </div>

  {/* NEW — static basis clause, spans both columns, sits directly above the results grid */}
  {sortBasisClause ? (
    <p
      ref={sortBasisRef}
      id="hotel-sort-basis"
      className="text-caption font-medium leading-5 text-[var(--text-1)] sm:col-span-2"
    >
      {sortBasisClause}
    </p>
  ) : null}

  {/* premium explanation / failed-sort alert — UNCHANGED, still sm:col-start-1 */}
</section>
```

### 2.2 Why `sm:col-span-2` and left-aligned, not `sm:text-right`

The status line is right-aligned at ≥640px. The basis clause is not, and must not be.

D3 requires the clause to be **adjacent to the first result**. At 1280px the section spans the
`max-w-[1140px]` main and the grid below is `min-[1024px]:grid-cols-3` — card 1 is the **top-left** cell. A
right-aligned clause would sit above card 3, visually attached to the wrong end of the row it explains. Spanning
both columns and aligning left puts the sentence immediately above and flush with card 1 at every breakpoint,
and at 375px it is simply the last line of a stacked block above a single column.

It is `--text-1` and `font-medium` (the treatment the `price` caveat has today at `:1747`) so it reads as
explanation rather than as the greyer `--text-2` announcement furniture above it.

### 2.3 Vertical budget (discovery constraint 2: ≈2 lines at 375px)

At 375px the added copy is one paragraph, `text-caption` (11.5px) / `leading-5` (20px). The longest string —
`Newest expaify finds first — not cheapest, not biggest discount.` — wraps to at most 2 lines in a 343px content
width. Total added height ≤ 48px including the `gap-y-2` row gap. Within constraint 2, which budgets "roughly
two lines at 375px" for the added explanation. No new control is introduced.

### 2.4 When the basis clause renders

`sortBasisClause` is derived from `displayedSort` (i.e. `pendingSort ?? appliedSort`), so it always agrees with
the trigger label, and it reverts with the trigger if a sort request fails.

| Feed state | Status region | Basis clause |
| --- | --- | --- |
| `loading && deals.length === 0` | `Loading hotel deals…` | **Hidden** — nothing is ordered yet |
| `pendingSort` | `Sorting by {displayed}…` | **Shown**, for `displayedSort` (matches the trigger) |
| `isMockFeed` (cold sample) | `Sorting is available with live deals.` | **Hidden** — see §2.5 |
| `deals.length === 0 && !error` | `No deals to sort.` | **Hidden** |
| `error` | *(empty)* | **Hidden** |
| `realDealCount > 0` | `Sorted by {applied} · N deals loaded` | **Shown**, for `appliedSort` |
| `failedSort` | `Sorted by {applied} · N deals loaded` + alert | **Shown**, for `appliedSort` (pending cleared) |

### 2.5 Why the cold-sample feed gets no basis clause

Sample deals are returned with `firstSeen: null` and `updatedAt: null` (`app/api/deals/route.ts:99-100`).
Neither card variant can show a Found line on them, so the order cannot be checked against the cards. Asserting
"newest expaify finds first" over a set of fabricated rows that carry no recency at all is the same failure D2
exists to repair, one level up. The existing honest line — `Sorting is available with live deals.` — stands
alone.

---

## 3. D3 — final copy, every string

No placeholders. Em dashes are literal `—` (U+2014). Apostrophes in JSX use `&apos;`/`&rsquo;` per existing
file convention.

### 3.1 Basis clauses (new `sortBasis` field on `HOTEL_SORT_OPTIONS`)

| Sort key | Status line (unchanged) | Basis clause (`sortBasis`) |
| --- | --- | --- |
| `newest` | `Sorted by Recently found · N deals loaded` | `Newest expaify finds first — not cheapest, not biggest discount.` |
| `discount` | `Sorted by Biggest discount · N deals loaded` | `Largest drop from each hotel's usual nightly price over 60 days.` |
| `price` | `Sorted by Lowest nightly price · N deals loaded` | `Nightly prices before taxes and fees.` |

The `price` string is the existing caveat, verbatim, now with a terminal period and relocated per §1.
`newest` carries the explicit negative required by D4.

### 3.2 Menu option descriptions

The brief asks that the menu and the persistent line "agree word-for-word". **UXDES ruling: identical for
`newest` and `discount`; deliberately different for `price`.**

Rationale: for `newest` and `discount` the menu description was the *only* definition anywhere (§2.4 of the
brief), so it must become the basis clause exactly. For `price` the basis clause is a **scope caveat**, not a
definition — the label "Lowest nightly price" already defines the order. Replacing the menu description with
the caveat would leave the menu unable to say what the option does. The caveat still appears persistently for
`price` via the basis clause, so nothing is lost.

```ts
export const HOTEL_SORT_OPTIONS: ReadonlyArray<{
  key: SortKey
  label: string
  description: string
  sortBasis: string
  analyticsValue: SortAnalyticsValue
}> = [
  {
    key: 'newest',
    label: 'Recently found',
    description: 'Newest expaify finds first — not cheapest, not biggest discount.',
    sortBasis: 'Newest expaify finds first — not cheapest, not biggest discount.',
    analyticsValue: 'recently_found',
  },
  {
    key: 'discount',
    label: 'Biggest discount',
    description: 'Largest drop from each hotel&rsquo;s usual nightly price over 60 days.',
    sortBasis: 'Largest drop from each hotel&rsquo;s usual nightly price over 60 days.',
    analyticsValue: 'biggest_discount',
  },
  {
    key: 'price',
    label: 'Lowest nightly price',
    description: 'Lowest current rate per night.',
    sortBasis: 'Nightly prices before taxes and fees.',
    analyticsValue: 'lowest_nightly_price',
  },
]
```

> These are TS string literals, not JSX — use a real `'` apostrophe (`hotel's`) in the constant, not
> `&rsquo;`. The entity is shown above only to flag the character; the rendered glyph must be a curly
> apostrophe or a straight one consistently with `lib/` conventions, never a broken entity in a `.ts` string.

At `sm:w-[22rem]` the `newest` and `discount` descriptions wrap to two lines inside the menu item. That is
fine: items are `min-h-11` with `items-start` and the radio marker is `mt-0.5`, so wrapping grows the row
without breaking alignment. No class change needed.

### 3.3 Term unification — every remaining mention of the default

One term: **"Recently found"**. Every occurrence of "newest first" and "detected most recently" as
customer-visible copy is removed.

| Location | Before | After |
| --- | --- | --- |
| `FREE_TIER_STATUS_SENTENCE` (`:104`) | `Showing every expaify deal at 20% or more off, newest first. Filters and sorting are included with Premium.` | `Showing every expaify deal at 20% or more off, sorted by Recently found — newest expaify finds first. Filters and sorting are included with Premium.` |
| Filter explainer (`:1623`) | `Filters are included with Premium. You're seeing every expaify deal at 20% or more off, sorted by Recently found.` | `Filters are included with Premium. You're seeing every expaify deal at 20% or more off, sorted by Recently found — newest expaify finds first.` |
| Premium explainer (`:1761`) | `Sorting options are included with Premium. Your results are currently sorted by Recently found.` | `Sorting options are included with Premium. Your results are currently sorted by Recently found — newest expaify finds first, not cheapest.` |
| Menu description (`:61`) | `Deals expaify detected most recently` | `Newest expaify finds first — not cheapest, not biggest discount.` |
| Trigger (`:1676`) | `Sort by: Recently found` | **unchanged** |
| Status line (`:1746`) | `Sorted by Recently found · N deals loaded` | **unchanged** |

### 3.4 Knock-on: the filter-failure sentence (must be fixed with 3.3)

`:1633-1637` derives its copy from `statusSentence()` by stripping the leading `Showing ` and the trailing `.`.
For a free user `statusSentence()` returns the whole two-sentence `FREE_TIER_STATUS_SENTENCE`, so the strip
produces a mangled result today, and the longer string in §3.3 makes it worse:

> "Your results still use every expaify deal at 20% or more off, sorted by Recently found — newest expaify
> finds first. Filters and sorting are included with Premium."

Add a dedicated constant and branch before the derivation:

```ts
const FREE_TIER_FILTER_FAILURE_SENTENCE =
  'Your results still show every expaify deal at 20% or more off, sorted by Recently found.'
```

```tsx
{(() => {
  if (!premium) return FREE_TIER_FILTER_FAILURE_SENTENCE
  const sentence = statusSentence(effectiveFilters, premium)
  if (!sentence) return 'Your results still show all current expaify deals.'
  return `Your results still use ${sentence.replace(/^Showing /, '').replace(/\.$/, '')}.`
})()}
```

The Premium branch is untouched — the derivation is correct for the fragment-built Premium sentences.

### 3.5 Pass test for D3

`grep -rn "newest first\|detected most recently\|Newest first" app/` returns **zero** customer-visible matches
on this surface. Every visible mention of the default order reads "Recently found", and wherever it is
explained it is explained with the identical clause from §3.1.

---

## 4. D1 — `DealCard` Found line

### 4.1 Derivation

```tsx
const found = deal.isMock ? null : timeAgo(deal.firstSeen)
const checked = deal.isMock ? null : timeAgo(deal.updatedAt)   // unchanged
```

- `deal.firstSeen` is already a declared prop (`DealCard.tsx:31`). No prop-shape change; the dead prop becomes
  live.
- `timeAgo` returns `null` for `null`/`undefined`/unparseable, so the `firstSeen`-null and mock cases collapse
  into one guard. **Never** substitute `deal.updatedAt`.

### 4.2 Helper rename

`absoluteCheckedAt` (`:47-58`) is now used for two different timestamps. Rename to `absoluteTimestamp`,
signature and body unchanged. It is module-private and unexported — no contract change, no other call sites.

### 4.3 Markup

Inside the existing `<div className="space-y-2">` price block, the two provenance lines become an adjacent pair
at the end of the block, Found **above** Price checked (chronological: found, then last re-checked):

```tsx
{found || checked ? (
  <div className="space-y-0.5">
    {found ? (
      <p className="text-caption font-medium leading-snug text-[color:var(--ink-soft)]">
        Found{' '}
        <time dateTime={deal.firstSeen} title={absoluteTimestamp(deal.firstSeen)}>{found}</time>
      </p>
    ) : null}
    {checked ? (
      <p className="text-caption font-medium leading-snug text-[color:var(--ink-soft)]">
        Price checked{' '}
        <time dateTime={deal.updatedAt ?? undefined} title={absoluteTimestamp(deal.updatedAt)}>{checked}</time>
      </p>
    ) : null}
  </div>
) : null}
```

### 4.4 Styling rules — and one thing deliberately not done

- **Identical typography on both lines.** Same size, weight, colour, leading. It is tempting to darken the
  Found line because it is the sort key — do not. Under `discount` and `price` sorts it is *not* the key, and a
  permanent emphasis would assert a ranking basis that is wrong two thirds of the time. The lines are
  distinguished by their labels, which is sufficient and honest.
- Grouping wrapper is `space-y-0.5` (2px) inside the block's `space-y-2` (8px), so the two read as one
  provenance pair rather than two unrelated facts.
- The absolute timestamp stays in `title`, matching the existing pattern exactly (`timeAgo` is day-coarse at
  the top end, so the tooltip is the only precise value). `<time dateTime>` is added to both lines: zero visual
  effect, correct semantics, machine-readable.
- Height cost: ~16px + 2px per card at 375px. `SkeletonCard` must absorb it — see §7.1.

### 4.5 Copy

| `firstSeen` age | Rendered |
| --- | --- |
| < 2 min | `Found just now` |
| < 60 min | `Found 14m ago` |
| < 24 h | `Found 6h ago` |
| 24–48 h | `Found yesterday` |
| ≥ 48 h | `Found 3d ago` |
| `null` / unparseable / `isMock` | *(line omitted entirely)* |

Tooltip on all rendered cases: `Jul 29, 2026, 04:12 PM` (`absoluteTimestamp` format, unchanged).

### 4.6 Pass test

Under the default sort, reading down the visible list, the sequence of Found values is non-increasing at
`timeAgo` granularity. Ties are expected and allowed; inversions are a failure. This is a comprehension aid,
not proof of exact order — do not claim otherwise in copy.

---

## 5. D2 — `LockedDealCard` recency badge

### 5.1 Prop

```tsx
type LockedDealCardProps = {
  placeholderName: string
  placeholderCity: string
  stars: number
  photoUrl?: string
  firstSeen?: string      // NEW, optional — existing call sites stay type-valid
  joinHref?: string
}
```

Optional, so no existing caller breaks. `LockedDealCard` stays a non-`'use client'` module; `timeAgo` is a pure
function with no React dependency.

### 5.2 Badge

```tsx
const found = timeAgo(firstSeen)
```

```tsx
<div className="flex flex-wrap items-center gap-2 px-4 pt-4">
  <span className="rounded-[var(--radius-pill)] bg-[color:var(--primary)] px-3 py-1 font-display text-body font-bold leading-none text-[color:var(--text-inverse)]">
    Members
  </span>
  {found ? (
    <span className="rounded-[var(--radius-pill)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-caption font-medium leading-none text-[color:var(--text-2)]">
      Found {found}
    </span>
  ) : null}
</div>
```

- Pill classes are **byte-for-byte the existing ones**. Only the string and the conditional are new.
- Wording is `Found {timeAgo}` — identical to D1, so locked and unlocked cards are directly comparable when
  interleaved in one list.
- **No badge when `firstSeen` is absent or unparseable.** No fallback to "today", no fallback to "Recently".
  The row keeps the Members pill alone; `flex-wrap items-center gap-2` collapses cleanly with one child and the
  card's top edge does not shift (the pill sets the row height).
- No `title` tooltip on the locked badge: the card is deliberately non-interactive apart from the CTA, and a
  pill-sized hover target for a precise timestamp on a deal the user cannot open is noise. The unlocked card
  carries the precise value.

### 5.3 Everything else on the locked card is unchanged

Blur (`blur-[5px]`), `aria-hidden` on the blurred subtrees, `pointer-events-none select-none`, the lock glyph,
`Members-only deal`, the `Unlock with Premium` CTA, `joinHref`, `PropertyPhoto`, hover lift. **This is not a
gate change.** It repairs a false claim; it unlocks nothing.

### 5.4 All three call sites must pass the prop

`firstSeen={deal.firstSeen ?? undefined}` at:

| Line | Context |
| --- | --- |
| `DealFeed.tsx:1895-1902` | live grid |
| `DealFeed.tsx:1795` | `criteriaUpdating` inert/dimmed duplicate |
| `DealFeed.tsx:1812` | `loading && deals.length > 0` inert/dimmed duplicate |

Missing the two duplicates is the likely defect: the dimmed grids are `aria-hidden` but fully visible at
`opacity-60`, so a stale "Deal found today" would still be on screen during every filter change.

### 5.5 Pass test

No locked card can display a recency string that disagrees with its row's `first_seen`. Two locked cards with
different `first_seen` show the same string only when they genuinely fall in the same `timeAgo` bucket.

---

## 6. D4 — position 1 gets no emphasis

Constraints, stated as prohibitions so TEST can check them by inspection:

- `gridClass` stays `grid grid-cols-1 gap-6 min-[680px]:grid-cols-2 min-[1024px]:grid-cols-3` (`:1182`).
- No `first:` variant, no `:first-child` selector, no `index === 0` branch anywhere in the card map.
- No rank number, no "Top deal" / "Best pick" / "Recommended" chip, no larger cell, no distinct border, no
  distinct shadow, no accent bar.
- No reordering of card contents for position 1.
- `DealCard` receives no index-derived prop. `index` is used for exactly one thing and keeps using it for
  exactly one thing: `card_position` in `trackCardOpen(index + 1)` (`:1907`).

The explicit negative in the `newest` basis clause (§3.1) is the only counter-pressure applied to the
editorial reading, and it is required — a positive-only statement leaves the "these are the best/cheapest"
reading intact, which is the specific claim H3 tests.

**Pass test:** at 1280px, card 1 is visually indistinguishable from cards 2 and 3 apart from its content.

---

## 7. State coverage

### 7.1 Loading — initial

- Status region: `Loading hotel deals…`. Basis clause hidden.
- Grid: 6 × `SkeletonCard`, `aria-busy="true"`, `aria-label="Hotel deals"` — unchanged.
- **`SkeletonCard` must gain one line.** Its comment claims it "mirrors DealCard's block order and heights so
  the feed does not jump". `DealCard` now has two provenance lines where it had one. Add a second bar after
  `:227`:

  ```tsx
  <div className="skeleton h-3 w-2/5 rounded-[var(--radius-pill)]" />
  <div className="skeleton h-3 w-1/3 rounded-[var(--radius-pill)]" />
  ```

  Omitting this reintroduces the layout jump the skeleton exists to prevent.

### 7.2 Loading — filter change with existing deals

- Skeleton grid above + inert `opacity-60` duplicate grid below (`:1805-1817`).
- Duplicate grid's `LockedDealCard`s **must** receive `firstSeen` (§5.4). Its `DealCard`s already pass
  `firstSeen` (`:1814`) — the Found line renders there for free once D1 lands.
- Basis clause: whatever `displayedSort` is; a filter change does not change sort, so it is stable across the
  transition. No flicker.

### 7.3 Pending sort

- Status region: `Sorting by {displayedSortOption.label}…`.
- Basis clause: switches to the **pending** sort's clause, in step with the trigger label. Because it is
  outside the live region (§1) this swap is silent to AT — correct, since the live region is simultaneously
  announcing the change itself.
- Grid: skeletons, **not** a spinner (`:1801-1804`) — unchanged.
- Trigger: `aria-disabled` while pending, spinner glyph, clicks ignored — unchanged.
- Focus returns to the trigger on apply — unchanged.

### 7.4 Empty — no filters

- Status region: `No deals to sort.` Basis clause hidden.
- `ResultCoverageBoundary` + `Edit search` — unchanged.

### 7.5 Empty — filters active

- Status region: `No deals to sort.` Basis clause hidden.
- `ResultCoverageBoundary` `confirmed_empty` + `Edit search` / `See all destinations` — unchanged.

### 7.6 Error

- Status region renders nothing (`resultStatusMessage` is `''`). Basis clause hidden.
- `role="alert"` block, focusable `<h3 ref={gridRef} tabIndex={-1}>`, Retry — unchanged.

### 7.7 Failed sort (recovery)

- Status region shows the **applied** sort line — unchanged.
- Basis clause shows the applied sort's clause (pending cleared → `displayedSort === appliedSort`), so the
  visible explanation and the alert's "still sorted by {label}" agree.
- `role="alert"` recovery block + Retry — unchanged.

### 7.8 Cold sample / mock feed

- `isMockFeed` → status region: `Sorting is available with live deals.` Basis clause **hidden** (§2.5).
- `ColdSampleFeedIntro` renders above the grid — unchanged.
- Cards: `isMock` true → **both** the Found line and the Price checked line are suppressed. The `Example` pill
  and `Sample hotel — not bookable` are unchanged. A sample card asserts no recency at all.

### 7.9 Locked card (free tier, the majority case)

- Up to 9 of 12 first-page cards (`FREE_WEEKLY_LIMIT = 3`). Each now shows its own `Found {timeAgo}`, or no
  badge if `first_seen` is null.
- Free users are pinned to `newest` server-side and cannot switch; the basis clause is therefore the only
  explanation they will ever see for the order, which is exactly why it is always-visible rather than behind a
  disclosure (brief §8 Task 3 decision rule).
- Note for TEST, not a defect to fix here: because `getFreeUnlockedDealIds()` skews old (`lib/paywall.ts:47-51`)
  while the feed sorts newest-first, a correct free feed will typically show *newer* Found values on locked
  cards near the top and *older* ones on the unlocked cards below. That is the data telling the truth, and it
  is the intended outcome — it is not an inversion failure under §4.6, which is evaluated over the visible
  sequence as a whole, locked and unlocked alike.

### 7.10 `firstSeen` null on a non-mock deal

- `DealCard`: Found line omitted; Price checked line still renders; no gap, no dash, no "unknown".
- `LockedDealCard`: no badge.
- Basis clause: unaffected — it describes the order, not any one card.

### 7.11 375px

- Sort section stacks: label → trigger (full width, `min-h-11`) → status line → basis clause (≤2 lines) →
  explanation/alert if open.
- Grid is `grid-cols-1`; ordinal reading is unambiguous.
- Cards gain ~18px. Verify the first card's top edge is still above the fold on a 375×667 viewport with the
  header and search bar present. If it is not, the fix is **not** to cut the basis clause — it is a spacing
  review raised as a finding.
- Menu is `w-full` at <640px; two-line descriptions wrap inside `min-h-11` items without clipping.

### 7.12 1280px

- Sort section: trigger in column 1 (`sm:w-[17rem]`), status right-aligned in column 2, basis clause
  full-width left-aligned on its own row directly above the grid.
- Grid is 3-across inside `max-w-[1140px]`; basis clause is flush-left with card 1.
- Card 1 has no distinguishing treatment (§6).

### 7.13 Keyboard and focus

Nothing in this spec adds a focusable element. The Found line, the locked badge, and the basis clause are all
static text — tab order is byte-identical to today.

| Behaviour | Status |
| --- | --- |
| Trigger `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` | unchanged |
| Trigger `aria-describedby` | **`"hotel-sort-status"` → `"hotel-sort-status hotel-sort-basis"`** |
| `role="menu"` / `role="menuitemradio"` / `aria-checked` | unchanged |
| Roving focus: ArrowUp/ArrowDown wrap, Home, End | unchanged |
| Escape → close + focus returns to trigger | unchanged (now also emits, §8.1) |
| Tab → close, focus moves on naturally | unchanged (now also emits, §8.1) |
| Locked options use `aria-disabled`, **never** native `disabled` | unchanged |
| Focus return to trigger on sort apply and on failure | unchanged |
| `:focus-visible` ring from `--focus-ring` / `--focus-outline` | unchanged |

`aria-describedby` referencing `hotel-sort-basis` when the clause is not rendered (empty/error/mock states) is
safe: a dangling IDREF is ignored, and the remaining `hotel-sort-status` reference still resolves. Do not
conditionally build the attribute string — that would churn the accessible description on every state flip.

---

## 8. D5 — analytics

Both events are additive `track()` calls on the existing payload. No new identifying fields, no PII, all values
bucketed exactly as `sharedSortAnalytics()` already buckets them (`:1270-1277`).

### 8.1 `hotel_sort_menu_dismissed`

Fires when the menu closes **without an option being activated**. Separates "opened, read, rejected the
taxonomy" (comprehension failure) from "never opened" (discoverability failure) — instrumentation question 3,
unanswerable today.

```ts
type SortDismissMethod = 'escape' | 'trigger' | 'outside' | 'tab'
```

Payload: `{ current_sort: getSortOption(appliedSort).analyticsValue, dismiss_method, ...sharedSortAnalytics() }`

`closeSortMenu` takes a second argument:

```ts
function closeSortMenu(returnFocus: boolean, dismissMethod: SortDismissMethod | null) {
  setSortMenuOpen(false)
  if (dismissMethod) {
    track('hotel_sort_menu_dismissed', {
      current_sort: getSortOption(appliedSort).analyticsValue,
      dismiss_method: dismissMethod,
      ...sharedSortAnalytics(),
    })
  }
  if (returnFocus) window.setTimeout(() => sortTriggerRef.current?.focus(), 0)
}
```

| Call site | Args | Emits? |
| --- | --- | --- |
| Escape in option list (`:1329`) | `closeSortMenu(true, 'escape')` | yes |
| Trigger click while open (`:1664`) | `closeSortMenu(false, 'trigger')` | yes |
| Outside pointerdown (`:1386-1388`) | replace bare `setSortMenuOpen(false)` with `closeSortMenu(false, 'outside')` | yes |
| Tab out of option list (`:1332`) | replace bare `setSortMenuOpen(false)` with `closeSortMenu(false, 'tab')` | yes |
| Re-selecting the already-applied sort (`:1300`) | `closeSortMenu(true, null)` | **no** — an activation, not a dismissal |
| Locked-option attempt (`:1312`) | leave as `setSortMenuOpen(false)` | **no** — already covered by `hotel_sort_disabled_attempted` |
| Successful `requestSort` | unchanged | **no** — covered by `hotel_sort_changed` |

Double-fire guard: the outside-pointerdown handler tests `sortControlRef.current.contains(target)`, and the
trigger is inside `sortControlRef`, so a click on the trigger never fires both. No other overlap exists.
Fire on every dismissal — this is an interaction, not an impression, so no once-guard.

### 8.2 `hotel_default_ranking_explanation_viewed`

Fires when the basis clause is actually in the viewport. Required because the clause sits below the sort
control and its fold position differs by breakpoint.

Payload: `{ current_sort: getSortOption(appliedSort).analyticsValue, ...sharedSortAnalytics() }` — a superset of
the `current_sort` / `premium_eligible` / `viewport_band` the brief requires, and the same shape as
`hotel_sort_control_viewed` so the two are directly comparable.

Same `IntersectionObserver` + ref-guard pattern as `:1416-1430`, with one difference: the guard is a
`Set<SortKey>` rather than a boolean, so a Premium user who switches sort can register a view of the *new*
basis clause. Each distinct clause registers at most once per mount.

```ts
const basisViewedRef = useRef<Set<SortKey>>(new Set())

useEffect(() => {
  const element = sortBasisRef.current
  if (!element || basisViewedRef.current.has(appliedSort)) return
  if (activeTab !== 'hotels' || loading || error || isMockFeed || realDealCount === 0) return
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting) || basisViewedRef.current.has(appliedSort)) return
    basisViewedRef.current.add(appliedSort)
    track('hotel_default_ranking_explanation_viewed', {
      current_sort: getSortOption(appliedSort).analyticsValue,
      ...sharedSortAnalytics(),
    })
    observer.disconnect()
  })
  observer.observe(element)
  return () => observer.disconnect()
}, [activeTab, appliedSort, error, isMockFeed, loading, realDealCount])
```

The clause is unconditionally visible, so **no `_expanded` event is specified** — the brief recommends against
a disclosure (§6 D5, §8 Task 3) and this spec follows that recommendation.

---

## 9. Design system compliance

Every class used is an existing token or an existing utility. No new colour, no new size, no new radius.

| Element | Classes | Tokens |
| --- | --- | --- |
| Basis clause | `text-caption font-medium leading-5 text-[var(--text-1)] sm:col-span-2` | `--text-1` (= `--ink`) |
| Status region | unchanged: `min-h-5 text-caption leading-5 text-[var(--text-2)] sm:pt-6 sm:text-right` | `--text-2` |
| Found line (DealCard) | `text-caption font-medium leading-snug text-[color:var(--ink-soft)]` | `--ink-soft` |
| Price checked line | unchanged, identical to Found line | `--ink-soft` |
| Provenance pair wrapper | `space-y-0.5` | — |
| Locked badge | unchanged: `rounded-[var(--radius-pill)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-caption font-medium leading-none text-[color:var(--text-2)]` | `--radius-pill`, `--border`, `--bg-surface`, `--text-2` |
| Skeleton provenance bars | `skeleton h-3 w-2/5` + `skeleton h-3 w-1/3 rounded-[var(--radius-pill)]` | `--radius-pill` |

Contrast: `--ink-soft` (#5C5852) and `--text-1` (#141210) on `--surface` (#FFFFFF) and `--bg` (#FAF7F2) both
clear AA at caption size. `--text-2` on `--bg-surface` in the locked pill is the existing, already-shipped
combination.

---

## 10. Regression gate (for TEST)

Everything below must be **unchanged** after the UI ticket lands:

1. `role="menu"` and `role="menuitemradio"` semantics with `aria-checked`.
2. Roving focus: ArrowUp/ArrowDown wrapping, Home, End.
3. Escape closes the menu and returns focus to the trigger.
4. Tab closes the menu and moves focus on naturally.
5. Locked options use `aria-disabled`, never native `disabled`, and remain focusable.
6. `hotel_sort_disabled_attempted` still fires on a locked-option activation.
7. The `aria-live` region announces sort **changes** and does **not** announce the static basis clause.
8. Focus returns to the trigger on sort apply and on sort failure.
9. Pending sort renders skeleton cards, not a spinner.
10. `role="alert"` recovery blocks for failed sort and failed filter, both stating the still-applied state.
11. Card 1 has no visual emphasis at 1280px.
12. No card overlaps or clips at 375px; the search, results, and booking flows are unaffected.

New checks introduced by this spec:

13. Every visible mention of the default order says "Recently found"; no "newest first", no "detected most
    recently".
14. Found values are non-increasing down the list under the default sort (§4.6).
15. No locked card shows "Deal found today", and none shows a badge when `first_seen` is null.
16. `isMock` cards show neither provenance line.
17. `hotel_sort_menu_dismissed` fires once per dismissal with the correct `dismiss_method`, and never on an
    activation.
18. `hotel_default_ranking_explanation_viewed` fires at most once per applied sort per mount.

---

## 11. Notes for the UI stage

- **Hydration.** `timeAgo` reads `Date.now()`. `DealFeed` is a client component with SSR'd `initialDeals`, so a
  server/client text mismatch across a `timeAgo` bucket boundary is already possible on the "Price checked"
  line today. Adding the Found line widens that surface but does not create it. **Do not** add
  `suppressHydrationWarning` or a mount-gated render as part of this ticket — that is a behaviour change beyond
  the directives. Record any React hydration warning observed during TEST as a separate finding.
- **Do not touch `app/components/HotelCard.tsx`.** It is not imported by the live feed (brief §9).
- **Do not touch** `lib/pipeline/dealDetection.ts`, `lib/paywall.ts`, `app/api/deals/route.ts`, or
  `lib/timeAgo.ts`. Every change is in the three component files named in §0.
- **Do not add** a rating or distance sort. No guest rating, review count, coordinates, or distance exist in
  the deal query (`dealDetection.ts:283-291`); `stars` is provider hotel class only and may never be labeled a
  rating.
- The copy in §3 is **not yet validated with participants** (brief §8). It is the best-reasoned option and is
  ready to ship, but the validation tasks remain outstanding and this spec should not be cited as evidence they
  passed.

---

## 12. Handoff

**Next ticket:** `UI-HOTEL-SORT-RANKING-01` — implement this spec.

**Route to UI, not DEV.** Every change is component-layer: `app/components/ui/DealCard.tsx`,
`app/components/ui/LockedDealCard.tsx`, and the copy/layout/analytics blocks in `app/deals/DealFeed.tsx`.
`firstSeen` is already on the wire for both locked and unlocked deals. No API route, provider, scoring, query,
or contract change is required.

**Acceptance for the UI ticket:** §7 state table implemented in full, §9 tokens only, §10 items 1–18 green,
`npx tsc --noEmit --incremental false` exits 0, `npm test -- --passWithNoTests` exits 0.
