# 02 — Research: Filter and sort friction on the deals feed

**Ticket:** UXR-DEALS-FEED-FILTER-FRICTION-01
**Stage:** UX Research
**Upstream:** `docs/pipeline/deals-feed-filter-friction/01-discovery.md`
**Surfaces audited:** `app/deals/DealFeed.tsx`, `app/deals/ResultCoverageBoundary.tsx`,
`app/deals/hotelFilterRecovery.ts`, `app/deals/HotelRecoveryUI.tsx`,
`lib/hotels/searchCriteria.ts`, `app/api/deals/route.ts`, `app/api/analytics/route.ts`
**References:** Booking.com property-results filter model, Google Flights filter-chip bar
**Date:** 2026-07-27

---

## 0. Executive position

Discovery's seven signals all reproduce in the code. Two things change the shape
of the work:

1. **Signal 3 is not a data-model gap.** `min_discount=0` is already a fully
   representable, round-trippable state end to end. The defect is that one
   constant (`20`) is doing three semantically different jobs, and exactly one of
   those jobs — the *is-this-filter-active* predicate — is wrong. The fix makes
   `minDiscount` **consistent with the two filters that already do it right**
   (`minStars`, `maxPrice`), rather than extending the model. **Design must not
   invent a new "no discount floor" value.** Full argument and the one real
   downstream consequence in §4.

2. **A new finding that escalates signal 5 from "sometimes empty" to "always
   empty".** `resultMetadata` has **no producer anywhere in the repo**. The
   client parses it, validates it, gates six behaviours on it, and receives
   `undefined` on 100% of responses. Every count-bearing string on this surface
   is therefore dead code today, including the ones Discovery cites as the
   *good* comparison case. Evidence in §3.1. This does not block the UI repair,
   but it means Design must not spec any copy that depends on a filtered count
   unless a DEV ticket lands the producer first.

Five testable directives in §5. Priority order for Design: D1 (dedupe), D2
(discount semantics), D3 (gate disclosure), D4 (feedback parity), D5 (empty-state
reachability).

---

## 1. What the current code actually does

Verified by reading, not assumed. Line references are to this branch.

### 1.1 Two filter surfaces, one state

| | Row A (`DealFeed.tsx:1220-1274`) | Row B (`DealFeed.tsx:1346-1368`) |
|---|---|---|
| Container | bare `div`, no label | `div` with `aria-label="Result filters"` |
| Tab gating | none — renders on **both** tabs | inside `activeTab === 'hotels'` |
| Pills | Destination (when `!defaultCity`), Min discount, Stars, Max price | Min discount, Stars, Max price |
| `disabled` | `!premium` | `!premium \|\| criteriaUpdating` |
| Position | above the criteria summary and the tab bar | below the tab bar, above sort |

Both bind the same `minDiscount` / `minStars` / `maxPriceCents` state and call
the same `applyFilter`. On the hotels tab both are on screen at once. Two
consequences beyond Discovery's account:

- **Row A survives the Flights tab.** `activeTab === 'flights'` renders the
  "Flight deals land soon" panel (`:1336-1343`), but row A is outside that
  branch, so three hotel filter pills sit above a surface with no hotel results.
  Operating them fires `/api/deals` requests the user cannot see the outcome of.
- **The `criteriaUpdating` split is a real trap, not just an inconsistency.**
  During a criteria apply, row B is correctly frozen; row A stays live. A row A
  pill press during that window calls `applyFilter` → `fetchDeals`, which does
  `requestAbortRef.current?.abort()` (`:441`) and takes over the sequence
  counter. The in-flight criteria request then returns `false`, and
  `applyCriteriaDraft` treats that as a failure: it sets `criteriaUpdateError`,
  shows "We couldn't update these results", and pulls focus to Retry
  (`:674-680`) — for a request that did not fail. The user pressed a filter and
  got a destination-change error.

### 1.2 The pill component

`FilterPill` (`:223-322`) is a self-contained popover. Its accessibility is
partially correct and partially broken:

- Correct: `aria-haspopup="menu"`, `aria-expanded`, `role="menu"`,
  `role="menuitemradio"` + `aria-checked`, Escape closes and returns focus,
  outside-pointer dismissal, focus returns to the trigger on select.
- Missing: **no arrow-key roving focus** inside the menu. The sort menu 150px
  away implements ArrowUp/ArrowDown/Home/End/Escape/Tab
  (`handleSortOptionKeyDown`, `:1066-1084`). A `role="menu"` without arrow
  navigation is a stated-but-unfulfilled ARIA contract — worse than a plain
  listbox. With row A and row B both mounted, a keyboard user tabs through
  **eight** identical-looking trigger buttons with four distinct labels.
- Missing: nothing distinguishes disabled state beyond `opacity-50` (`:267`).
  No `aria-describedby`, no lock glyph, no text. A screen-reader user hears
  "Min discount, menu button, dimmed" and no reason.

### 1.3 The discount constant, all six sites

`DEFAULT_MIN_DISCOUNT = 20` (`DealFeed.tsx:50`) and the bare literal `20`
elsewhere are load-bearing in three different roles:

| Role | Sites |
|---|---|
| **J1 — initial control value** | `DealFeed.tsx:356`, `:373`; `searchCriteria.ts:263` (`readInteger` fallback) |
| **J2 — URL omission baseline** | `searchCriteria.ts:202` (`min_discount` written only when `!== 20`) |
| **J3 — "filter is active / narrowing"** | `DealFeed.tsx:507` (`filteredRequest`), `:931` (`hasActiveFilters`), `:932` (`hasSecondaryFilters`), `:960` (`coverageFilters`), `:1243`/`:1349` (`activeLabel`); `hotelFilterRecovery.ts:103` (`activeKeys`), `:125` (`valueMatchesBaseline`); `app/api/deals/route.ts:138` (`hasFilters`) |

J1 and J2 are correct. J3 is the defect. §4 develops this.

### 1.4 The premium gate is a *server* gate

`app/api/deals/route.ts:120-131`:

```ts
// Filters and sort are a Premium feature: for free users every filter param is
// ignored server-side so the plain newest-first feed is the only view.
const minDiscount = pwCtx.premium ? requestedView.minDiscount : 20
const maxPriceCents = pwCtx.premium ? requestedView.maxPriceCents ?? undefined : undefined
const minStars = pwCtx.premium ? requestedView.minStars || undefined : undefined
const sort: HotelDealSort = pwCtx.premium ? requestedView.sort : 'newest'
```

This is decisive and Discovery does not record it. For a free user the feed is
**genuinely and unremovably filtered to 20%+ off**. It is not a UI default that
happens to start at 20; it is a plan-level constraint enforced at the API. Any
disclosure copy Design writes has to be true of that, and "your filters are off"
would be false.

Note the asymmetry the same block creates: `city` and the date window are
honoured for free users (they are read from `criteriaResolution`, not gated),
while discount/stars/price/sort are not. So the Destination pill in row A is
`disabled={!premium}` in the UI even though the API would have served it — the
criteria editor is the un-gated path to the same outcome.

### 1.5 Feedback paths, side by side

| | Filter change (`applyFilter`, no `recovery`) | Filter removal (`removeRecoveryFilter`) | Sort change (`requestSort`) |
|---|---|---|---|
| Trigger affordance | none | none | spinner in trigger (`:1403-1407`) |
| Skeleton count | fixed **6** (`:1533`) | fixed 6 | `min(max(deals.length,1),6)` (`:1529`) |
| Previous results kept | no | no | no (but criteria path keeps them at 60% opacity, `:1519`) |
| Live status | `countCopy ?? ''` (`:563`) → **empty**, see §3.1 | "Filter removed. …" (`:560`) | "Sorting by X…" → "Sorted by X · N deals loaded" (`:1461-1476`) |
| Focus on completion | none (`focusOnSuccess` unset, `:650`) | `resultStatusRef` (`:566`) | back to sort trigger |
| Undo | `setUndoSnapshot(null)` (`:642`) | Undo control (`:1508-1511`) | none |
| Failure | whole grid replaced by the generic error card (`:1535-1547`) | same | scoped `failedSort` alert + Retry, results preserved (`:1493-1499`) |

The most frequent action has the weakest treatment on every row.

### 1.6 Empty-state branch ordering

Discovery's signal 4 reproduces exactly (`:1548-1581`). Branch 3
(`ResultCoverageBoundary state="confirmed_empty"`) is guarded by the two
preceding branches such that it is reachable only when `hasActiveFilters` is
false — at which point `coverageFilters` is `[]`, `FilterActions` returns `null`
(`ResultCoverageBoundary.tsx:49`), and the boundary renders its *unfiltered*
copy: "There are no current matches in expaify's tracked deal set."

Two details Discovery does not note, both of which matter to Design:

- `ResultCoverageBoundary` already has a purpose-built `filteredEmptyActions`
  variant (`.tsx:92-99`) whose only difference is `showClearAllWithSingleFilter`
  — i.e. it offers "Clear all filters" even for one filter. It is referenced at
  `.tsx:158`, in the `filtered && isDeals` path. **Nothing in the app can reach
  it.** The component is fine; the caller's branch order is the whole bug.
- The dead branch-2 card's `hasSecondaryFilters` button (`:1556`) clears
  discount + stars + price in one press *and* sets discount back to 20, so from
  a premium user's "Any discount" state it both widens two filters and narrows a
  third.

### 1.7 History

`DealFeed.tsx:428-436` uses `replaceState` for every filter and sort change,
confirmed. The `popstate` path is doubly dead: `restoreCriteriaFromLocation`
early-returns on matching `criteriaVersion` (`:725`), and `criteriaVersion` is
minted only by `applyCriteriaDraft` / URL restore — never by a filter or sort
change. So even a hypothetical `pushState` on filters would restore nothing.

---

## 2. Reference patterns

Compared at the level of interaction contract, not visual style.

### 2.1 Google Flights — the chip bar

- **One chip per filter, once.** The bar is the only filter surface on the
  results page; there is no second copy anywhere in the scroll.
- **Neutral ⇄ set is driven by the widest option.** A chip reads its label
  ("Stops") in the neutral outline state. Selecting a constraining value moves it
  to the set/filled state showing the value. Selecting the widest option
  ("Any number of stops") returns it to **neutral** — it is not a "selection you
  now have to clear". The chip's own semantics define active as *narrower than
  widest*, never *different from a preferred default*.
- **"Clear all" appears only when ≥1 chip is set**, adjacent to the bar, and
  restores every chip to widest — never to a non-widest default.
- Result count in the header updates on apply and is announced.

Delta vs. expaify: expaify's `minStars` and `maxPrice` already follow this
(`minStars > 0`, `maxPriceCents` truthy). `minDiscount` alone anchors "set" to a
non-widest value, producing the inverted × that Discovery documents.

### 2.2 Booking.com — one control surface, mirrored chips, reasons on options

- **The control surface is singular** (sidebar on desktop, a single bottom
  sheet on mobile). The "Your filters" row above results is a **mirror** — read-
  only chips with an ×, no popover, no option list. Two representations, one of
  which is not a control. Booking never renders the same *control* twice.
- **Each option carries its consequence** — the count it would yield — before
  commit; zero-yield options are visibly disabled *with* their zero, not hidden
  or silently inert. Unavailability always states its reason.
- **Applying a filter does not destroy the list.** The result list stays mounted
  under a busy treatment; the header count updates in place. Scroll position and
  reading context survive.
- **Empty-with-filters names the specific filter to relax**, in the empty state
  itself.

Delta vs. expaify: expaify has *two live control surfaces* and *no mirror*; it
destroys the list on apply where sort does not; it has a purpose-built
name-the-filter empty state that is unreachable; and its disabled options give
no reason at all while its disabled *sort* options give a full one.

### 2.3 Where expaify is already at reference quality

Worth stating so the repair does not regress it: the sort control's
locked-option badge + explanation region + `See Premium` / `Not now`, the
`#hotel-sort-status` live region, the `failedSort` scoped alert with Retry, and
`ResultCoverageBoundary`'s ten-state vocabulary are all better than the
reference baseline. **The target for filters is parity with the sort control on
this same page, not a redesign of either.**

---

## 3. Findings not in Discovery

### 3.1 `resultMetadata` has no producer — every count string is dead

```
$ grep -rn "resultMetadata" --exclude-dir=node_modules .
app/deals/DealFeed.tsx:162,369,495,647,690,750,875,952,953
docs/pipeline/hotel-filter-recovery/03-design.md:440,452
```

Nothing under `app/api/` or `lib/` emits it. `app/deals/page.tsx` never passes
`initialResultMetadata`. So `data.resultMetadata` is always `undefined`,
`parseHotelResultMetadata` returns `null` at its first guard
(`hotelFilterRecovery.ts:175`), and `resultMetadata` is permanently `null`.
Everything downstream is unreachable in production:

- `countCopy` is always `null` (`:558-559`) ⇒ the removal path speaks
  **"Deals updated."**, the reset path **"Filters reset."**, the undo path
  **"Filter change undone."** — all countless — and the plain filter path speaks
  **`''`**.
- `resultStatusMessage`'s `trustedMetadata && hasActiveFilters` branch
  (`:985-987`) — "N match your filters." — **never renders**.
- `recoveryOptions` is always `[]`, so `recommendedFilterKey` always degenerates
  to `coverageFilters[0]?.key`, i.e. the fixed order city → discount → stars →
  price → dates. The "remove the filter that adds the most results" ranking at
  `:966-968` never runs.
- `HotelRecoveryUI`'s `optionLabel` / `expandedRemoveLabel` /
  `preservedContext` machinery is entirely dead.
- `undoSnapshot.target.queryId` is always `undefined`.

**Implication for Design:** every visible string on this surface must be true
with **no count available**. Copy of the form "N deals match your filters" can be
specified only as an enhancement conditional on a DEV ticket landing the
producer. The parser, its validation, and `HotelResultMetadata` must be left
intact (constraint 3) — this is a missing producer, not dead client code to rip
out.

### 3.2 Analytics for a blocked filter attempt requires a server allowlist change

`app/api/analytics/route.ts:59-86` is a strict per-event property allowlist;
unknown event names are rejected. `hotel_sort_disabled_attempted` is listed
(`:69`); there is no filter equivalent. Directive D3 proposes making blocked
filter attempts receivable, which is only measurable if a new event name is
added to that map. That map lives in an API route ⇒ **UI stage cannot ship the
event; it needs a DEV ticket.** `validFilterState` already accepts
`min_discount: 0` (`:114`), so the existing `filter_state` payload survives D2
unchanged.

### 3.3 The two token families are already aliases

`app/globals.css`: `--bg-surface: var(--surface)` (`:31`),
`--border-strong: var(--line-white)` (`:35`), `--brand: var(--primary)` (`:39`),
`--text-1: var(--ink)` (`:45`), `--text-2: var(--ink-soft)` (`:46`),
`--radius-control: var(--radius-input)` (`:49`).

The pill family and the sort/boundary family resolve to the **same values**.
Converging the filter row onto the sort control's token vocabulary is therefore
a naming change with **zero pixel delta** — no new colours, no new radii, and
constraint 2 is satisfied by construction. Design should say so explicitly so UI
does not treat convergence as a visual risk.

### 3.4 The Destination pill routes away instead of filtering

`:1229-1237`: selecting a tracked market calls `router.push('/destinations/<slug>')`
— a full navigation — while "All destinations" calls `applyFilter`. One control,
two interaction models, no signal to the user which they'll get. Out of scope
for this ticket's directives; recorded for the backlog.

---

## 4. Position on the signal-3 data-model gap

**Requested deliverable. This is the position Design should build on.**

### 4.1 There is no missing state

`min_discount=0` round-trips today, unmodified:

- `resolveHotelResultsView` accepts `0 ≤ min_discount ≤ 90`
  (`searchCriteria.ts:263, 268`).
- `buildHotelResultsUrl` writes the param whenever `!== 20`
  (`searchCriteria.ts:202`), so `0` **is** serialized — `?min_discount=0`.
- `/api/deals` forwards it to `getActiveDeals` for premium users
  (`route.ts:122, 156`).
- `validFilterState` accepts `min_discount: 0` (`analytics/route.ts:114`).

`DISCOUNT_OPTIONS[0] = { label: 'Any discount', value: 0 }` is already the
widest option and is already reachable, shareable, and restorable. **No new
representation is required, and Design must not introduce one.** A sentinel
(`null`, `-1`, `'none'`) would break every URL, the API contract, and the
analytics allowlist — all three frozen by constraint 1.

### 4.2 The actual defect: one constant, three jobs, one of them wrong

From §1.3: `20` serves J1 (initial value), J2 (URL omission baseline), J3
(active predicate).

- **J1 is correct and must not change.** 20%+ off is a deliberate product
  stance about what belongs in a deals feed.
- **J2 is correct and must not change.** Changing which value is omitted from
  the URL silently re-points every previously shared or bookmarked link.
  Constraint 1 freezes `buildHotelResultsUrl` explicitly.
- **J3 is wrong.** "Active" must mean *narrower than the widest option the user
  can choose*. The widest discount option is `0`. So the predicate is
  `minDiscount > 0`, not `minDiscount !== 20`.

The strongest argument that this is a repair rather than a redesign: **the other
two filters already use exactly this rule.** `minStars` active iff `> 0`;
`maxPrice` active iff non-null; both anchored to their widest option, both with
`onClear` returning to widest. `minDiscount` is the single outlier. Fixing it
*removes* a special case.

Restating the four broken behaviours in these terms — every one is J3, none is
J1 or J2:

| Symptom | Site | Predicate |
|---|---|---|
| "Any discount" renders in the active/teal treatment | `:1243`, `:1349` | J3 |
| × labelled "Clear min discount filter" applies a 20% floor | `:1245`, `:1351`, `:804` | J3 |
| "Current filters narrow this list. Remove 'Any discount'" | `:960` → `:1587-1601` | J3 |
| The default 20% floor is never disclosed as a constraint | `:931` false at default | J3 |

### 4.3 Recommendation

> **Keep `DEFAULT_MIN_DISCOUNT = 20` as the initial value and as the URL
> omission baseline. Redefine "active" for `minDiscount` as `> 0`, matching
> `minStars` and `maxPrice`. Redefine "clear" as "return to the widest option"
> (`0`), matching `minStars` (`0`) and `maxPrice` (`null`). Disclose the 20%
> default floor as a constraint in its own right rather than inferring
> constraint from the active predicate.**

Consequences, in full:

| Site | Now | After | Effect |
|---|---|---|---|
| `activeLabel` `:1243`,`:1349` | `!== 20` | `> 0` | "Any discount" is neutral; 20/30/40 all read as set |
| `onClear` `:1245`,`:1351` | → 20 | → 0 | × always widens; the × now appears at 20 too |
| `removeRecoveryFilter` `:804` | → 20 | → 0 | "Remove '20%+ off'" actually removes it |
| `hasActiveFilters` `:931` | `!== 20` | `> 0` | default feed is no longer "unfiltered by accident" — see 4.4 |
| `coverageFilters` `:960` | `!== 20` | `> 0` | banner stops offering to remove the widening option; starts correctly offering to remove 20%+ off |
| `filteredRequest` `:507` | `!== 20` | `> 0` | coverage announcements say "matching" when they should |
| `hotelFilterRecovery.ts:103,125` | `!== 20` / baseline 20 | `> 0` / baseline 0 | **must move in lockstep — see 4.5** |
| `api/deals/route.ts:138` `hasFilters` | `!== 20` | `> 0` | mock-fallback gating; server-side, DEV scope |
| `searchCriteria.ts:202,263` | `!== 20` / fallback 20 | **unchanged** | URL contract preserved |
| `DealFeed.tsx:356,373` | init 20 | **unchanged** | product stance preserved |

### 4.4 The free-tier wrinkle Design must resolve

Under the new predicate, a free user's feed has `minDiscount === 20`, so
`hasActiveFilters` becomes **true at first paint**, where today it is false. Left
alone that would render the "Current filters narrow this list. Remove '20%+ off'"
banner (`:1587`) to a user who set nothing and — per §1.4 — **cannot act on it**,
since the API clamps them to 20 regardless of what the UI sends.

This is not an argument against the change; it is the change surfacing a
constraint that was previously hidden, which is exactly Discovery's success
criterion. But the disclosure must be tier-aware, and the tier signal (`premium`)
already exists in state. Design must specify two distinct treatments:

- **Free:** the 20% floor is a **plan-level, non-removable** constraint. Disclose
  it as a statement, not as a removable chip, and route it through the same
  Premium explanation the sort control already uses. Do **not** show a "Remove
  '20%+ off'" affordance to a user the server will override.
- **Premium:** the 20% floor is a **default choice among four**, and `0` is the
  widest. It is removable, and the × on it must widen.

The narrowing banner's guard must therefore become tier-aware, not merely
`hasActiveFilters`. Design owns the exact condition and copy; Research's
position is that the split is required and that no new data is needed to express
it.

### 4.5 The one genuine DEV dependency

`hotelFilterRecovery.ts:122-131`, `valueMatchesBaseline`, hard-codes the
relaxation target for `minDiscount`:

```ts
case 'minDiscount': return value.kind === 'percentage' && value.value === 20
```

A server-proposed recovery option whose `relaxedTo` is `0` is **rejected by the
parser and silently dropped** (`parseOption` returns `null` at `:143`).
Symmetrically, `activeKeys` (`:103`) uses `!== 20`, and it feeds the
`contextPreserved` completeness check at `:151-152` — so if the client's notion
of "active" moves to `> 0` while `activeKeys` does not, every option arriving
during a 20%-floor session fails validation for a *different* reason.

Both live in a **client-side validator**, not on the wire: `HotelRecoveryOption`,
`HotelResultMetadata`, and the JSON shape are untouched. Only *which values
validate* changes. Per §3.1 this is currently inert (no producer exists), so
today it is a latent break rather than a live one — but it must move in the same
change, or the recovery rail is guaranteed dark for the most common filter the
moment a producer lands.

**Scope call:** these two functions are pure TypeScript in
`app/deals/hotelFilterRecovery.ts`, not an API route or a provider. They sit at
the boundary of "UI layer" as AGENTS.md defines it. Research's recommendation is
that Design specify the intended semantics precisely and route the edit to the
**DEV** stage together with `api/deals/route.ts:138`, keeping the UI stage's
change set to the twelve `DealFeed.tsx` predicate sites and the render tree.

---

## 5. Design directives

Five directives. Each is testable, names exact states, and stays inside the
three constraints.

---

### D1 — Exactly one filter control surface; the second becomes a mirror or is deleted

**Current:** two live control rows, both mounted on the hotels tab, one of which
also renders on the flights tab (§1.1).
**Reference:** Booking renders one control surface plus a read-only chip mirror;
Google Flights renders one bar, full stop (§2.1, §2.2).

Design must:

1. Nominate **row B** (`:1346-1368`) as the single live control surface. It is
   already tab-gated, already labelled `aria-label="Result filters"`, already
   `criteriaUpdating`-aware, and already adjacent to the sort control it must
   reach parity with.
2. Specify row A's fate: **delete it**, or convert it to a **non-interactive
   mirror** of set filters only (a chip with an × and no popover). If a mirror
   is specified, the spec must state that it renders **only** when ≥1 filter is
   set, that its chips are not `role="menu"` triggers, and that it does not
   duplicate any accessible name with row B.
3. Relocate the Destination pill into row B, or state explicitly that
   destination is owned by `HotelSearchCriteriaSummary` / the criteria editor and
   is removed from the pill vocabulary entirely. Given §3.4 (it navigates rather
   than filters) and that the criteria editor already owns destination for free
   users, Research recommends the latter.
4. Whatever survives on the flights tab must be **nothing** — no hotel filter
   control renders when `activeTab === 'flights'`.

**Test:** on `/deals` at 375px and 1280px, hotels tab, `getAllByRole('button',
{ name: /min discount/i })` returns exactly one element (or one trigger plus one
non-menu mirror chip with a distinct accessible name). On the flights tab it
returns zero. A row A press during `criteriaUpdating` is impossible, so the
false "We couldn't update these results" alert (§1.1) cannot be reproduced.

---

### D2 — "Active" means narrower than widest, for every filter including discount

**Current:** `minDiscount !== 20` at eight client sites (§1.3, J3).
**Reference:** Google Flights' widest option returns the chip to neutral (§2.1).
**Position:** §4.3.

Design must specify, for `minDiscount`:

- **Neutral (unset) state** when `minDiscount === 0`. Pill renders its label
  "Min discount", outline treatment, **no ×**.
- **Set state** when `minDiscount > 0` — including at the default `20`. Pill
  renders the selected label, filled treatment, with ×.
- **The × always widens.** `onClear` → `0`. The accessible name must stop
  claiming to "clear" while narrowing; specify the exact string (e.g.
  `Remove minimum discount filter`).
- **`DEFAULT_MIN_DISCOUNT` stays `20`** as the initial value, and
  `buildHotelResultsUrl` / `resolveHotelResultsView` stay untouched. State this
  as an explicit non-goal so UI does not "tidy" it.
- **Reset semantics:** `resetFilters` (`:791-798`) and the dead branch-2 button
  (`:1556`) currently reset discount to 20. Design must decide and state
  whether "Clear all filters" returns to *widest* (`0`, consistent with stars
  and price) or to the *default* (`20`). Research recommends **widest**, because
  "Clear all" appearing next to chips that are all going neutral must make them
  all neutral; leaving one filled after "Clear all" reintroduces the same
  contradiction in a new place.

**Test:** premium session. Selecting "Any discount" leaves the pill in the
neutral outline treatment, renders no ×, and produces no "Current filters narrow
this list" banner. Selecting "20%+ off" renders the filled treatment with an ×;
pressing that × yields "Any discount" and a **wider or equal** result count. The
URL after selecting "Any discount" contains `min_discount=0`; after selecting
"20%+ off" it contains no `min_discount` param. No sequence of presses produces
a "Remove 'Any discount'" affordance.

---

### D3 — An unavailable filter states its reason, in the sort control's existing voice

**Current:** `disabled` + `opacity-50`, no copy, no `aria-describedby`, and the
press is unreceivable so it cannot even be measured (§1.2, Discovery signal 2).
**Reference:** Booking states the reason on every unavailable option; expaify's
own sort control already does this better than the reference (§2.3).

Design must:

1. Replace `disabled` on the pill trigger with **`aria-disabled` + a receivable
   press**, mirroring `activateSortOption` (`:1044-1064`): the press is accepted,
   no request fires, and an explanation region opens.
2. Reuse the **existing** Premium explanation region (`:1478-1492`) or specify a
   filter-specific twin with identical structure: bold title, one sentence of
   plain explanation stating what the user *is* currently seeing, `See Premium`
   primary + `Not now` outline, focus moved to the region on open, Escape
   dismisses and returns focus to the trigger.
3. Write the copy. It must be true of §1.4 — free users see a real 20%-off floor
   and a real Recently-found sort, both server-enforced. Suggested shape, to be
   finalised by Design: *"Filters are included with Premium. You're seeing all
   deals at 20% or more off, newest first."*
4. Specify the per-option lock badge inside the pill popover, matching the sort
   menu's `Premium` lock glyph (`:1445-1453`).
5. Add **arrow-key roving focus** (ArrowUp/ArrowDown/Home/End) to the pill
   popover so its `role="menu"` contract is honoured — reuse
   `handleSortOptionKeyDown`'s behaviour.
6. Flag the analytics gap to DEV rather than to UI: a
   `hotel_filter_disabled_attempted` event needs a new entry in
   `app/api/analytics/route.ts`'s allowlist (§3.2). Design should specify the
   event name and property set; the UI stage must not emit an event the server
   will reject.

**Test:** free session, keyboard only. Tab to "Min discount", press Enter →
explanation region receives focus and is announced; Escape returns focus to the
trigger; no `/api/deals` request fires. The region's accessible text names both
the discount floor and the sort the user is actually getting. Screen reader
announces the trigger as disabled *with* a description, not bare.

---

### D4 — Filter changes get the same feedback class the sort change already gets

**Current:** §1.5. No pending affordance, fixed-6 skeletons that collapse the
document, empty announcement, no focus, no undo, whole-grid error takeover.
**Reference:** Booking keeps the list mounted and updates the header count in
place (§2.2); expaify's own sort path is the local gold standard (§2.3).

Design must specify, for a pill selection:

1. **Pending affordance on the pill itself** — the pill that was operated shows
   a busy state, matching the sort trigger's in-place spinner. Not a global
   overlay.
2. **Skeleton count proportional to the current result set:**
   `Math.min(Math.max(deals.length, 1), 6)`, the rule sort already uses
   (`:1529`) — *not* the fixed 6 at `:1533`. This directly addresses signal 6:
   after infinite scroll the document no longer collapses from 40 cards to 6.
   Design should also state whether the previous grid is retained behind the
   skeletons at 60% opacity as `criteriaUpdating` does (`:1514-1526`);
   Research recommends yes, since it is the strongest scroll-preservation
   measure available and the pattern already exists in this file.
3. **A completion announcement that is true with no count available** (§3.1).
   Specify the countless string as primary (e.g. *"Filters applied. Showing
   deals 30% or more off."*) and any count-bearing string as a conditional
   enhancement gated on `trustedMetadata`, explicitly marked as requiring the
   DEV producer.
4. **Focus on completion** — `focusOnSuccess: true`, landing on
   `resultStatusRef`, the target the removal path already uses (`:566`).
5. **Undo.** `applyFilter` already accepts `undoOnSuccess` and builds the
   snapshot (`:643-650`); the plain path just passes `{}` and nulls the snapshot
   (`:642`). Design must specify Undo for a filter *selection*, its label, and
   its dismissal rule. `HotelResultStatus` already renders the control and
   handles pending/error states — no new component.
6. **Scoped failure.** A failed filter apply must not replace the grid with the
   full-page error card (`:1535-1547`). Specify a scoped alert with Retry that
   preserves the visible results, matching `failedSort` (`:1493-1499`).

**Test:** premium session, scroll until ≥20 cards are loaded, then change one
filter. The document does not collapse to 6 skeletons; the operated pill shows a
busy state; on completion the live region announces a non-empty sentence and
focus lands on the result status; an Undo control is present and restores the
prior filter set. Kill the network on the apply: the visible cards remain and a
scoped retry appears.

---

### D5 — The filtered-empty state names the filter to remove

**Current:** the branch that can name a filter is unreachable; the branch that
runs names none (§1.6, Discovery signal 4).
**Reference:** Booking's zero-result state names the specific filter to relax
(§2.2). The component to do it already exists and is already correct.

Design must:

1. **Reorder the empty branches** at `:1548-1581` so that
   `deals.length === 0 && hasActiveFilters` routes to
   `ResultCoverageBoundary state="confirmed_empty"` with
   `activeFilters={coverageFilters}` and `recommendedFilterKey`, reaching the
   `filteredEmptyActions` variant (`ResultCoverageBoundary.tsx:92-99, 158`) —
   "Remove '<label>'" primary, "Clear all filters" secondary even for a single
   filter.
2. **Retain the reachable-and-correct branches**: `PersonalizedEmpty` for the
   personalized-unfiltered case, and the boundary's unfiltered copy for
   genuinely empty inventory. The reorder must not swallow either.
3. **Keep "Edit search"** available in the filtered-empty state. Branch 2 is the
   only path to `openCriteriaEditor('empty_state')` (`:1555`); if branch 2 goes
   away, that entry point must be re-homed onto the boundary, or the
   `entry_point: 'empty_state'` analytics value dies with it.
4. **Do not modify `ResultCoverageBoundary`.** Constraint 3 freezes its props,
   and `app/deals/__tests__/ResultCoverageBoundary.test.tsx` asserts against
   them. The entire fix is caller-side branch ordering.
5. Specify the **ordering rule for which filter is recommended** given that
   `recoveryOptions` is always `[]` today (§3.1): the fallback is
   `coverageFilters[0]`, i.e. city → discount → stars → price → dateFrom →
   dateTo (`:958-965`). Design should state whether that fixed order is the
   intended recommendation or whether `coverageFilters` should be reordered to
   put the most-likely-culprit filter first.

**Test:** premium session, apply "5★ only" + "Under $100" until zero results.
The empty state renders "No current expaify deals match your filters", the body
"Remove one filter to expand this expaify result set.", a primary button reading
`Remove "5★ only"` (or whichever the specified order selects), a "Clear all
filters" secondary, and a route to Edit search. Pressing the primary widens
exactly one filter and leaves the other in place.

---

## 6. Constraint check

| Constraint | Status |
|---|---|
| No change to the filter/sort data model or API contract | Held. D2 changes only the *active* predicate; `DEFAULT_MIN_DISCOUNT`, `buildHotelResultsUrl`, `resolveHotelResultsView`, `HotelFilterState`, `HotelDealSort`, `HotelSearchCriteriaV1`, and the `/api/deals` params are untouched. §4.1 rejects a new sentinel value. The signal-3 gap is answered as a *predicate* bug, not a model gap. |
| Existing tokens only; 375px and 1280px stay usable | Held, and cheaper than expected — §3.3 shows the two token families are aliases, so converging the filter row onto the sort vocabulary is a zero-pixel rename. D1 reduces the 375px pill row from two wrapped rows to one. The `sm:grid-cols-[auto_1fr]` sort grid (`:1373`) is untouched by every directive. |
| Preserve every contract, live region, and analytics payload | Held. D5 forbids touching `ResultCoverageBoundary`. D4 reuses `HotelResultStatus`, `focusOnSuccess`, and `undoOnSuccess` as they exist. `#hotel-sort-status` and the `coverageAnnouncement` node are untouched. §3.2 explicitly routes the one new event to DEV rather than letting UI emit something the allowlist rejects. |

**Out of scope, recorded for the backlog:** Discovery signal 7 (history /
`replaceState` / dead `popstate` restore, §1.7) — fixing it requires
`criteriaVersion` semantics to change, which constraint 1 freezes. The
`resultMetadata` producer (§3.1). The Destination pill's navigate-vs-filter
split (§3.4). The `api/deals/route.ts:138` and `hotelFilterRecovery.ts:103,125`
predicate edits are in scope for the feature but belong to **DEV**, not UI
(§4.5).

---

## 7. Handoff

Next stage: **UXDES-DEALS-FEED-FILTER-FRICTION-01** — UX Design.

Design reads this brief and `01-discovery.md`, and produces
`docs/pipeline/deals-feed-filter-friction/03-design.md` covering every state in
D1–D5: default, loading, empty, error, filtered-empty, free vs. premium, mobile
375px, desktop 1280px, focus/keyboard, and the two decisions this brief hands
over explicitly —

1. **§4.4** — the tier-aware disclosure split for the 20% floor, and the exact
   guard on the narrowing banner.
2. **D2.5** — whether "Clear all filters" returns discount to widest (`0`) or to
   default (`20`). Research recommends widest.

Design must also mark which directives require a **DEV** ticket rather than UI:
the `hotelFilterRecovery.ts` baseline (§4.5), `api/deals/route.ts:138` (§4.5),
the analytics allowlist entry (§3.2), and — if any count-bearing copy is
specified — the `resultMetadata` producer (§3.1).
