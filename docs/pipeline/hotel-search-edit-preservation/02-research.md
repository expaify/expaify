# UXR-HOTEL-SEARCH-EDIT-PRESERVATION-01: Hotel Search Edit and Context Preservation

**Ticket:** UXR-HOTEL-SEARCH-EDIT-PRESERVATION-01 · **Stage:** UX Research · **Priority:** P1
**Date:** 2026-07-31 · **Feature slug:** `hotel-search-edit-preservation`
**Persona:** Senior UX Researcher
**Upstream:** `docs/pipeline/hotel-search-edit-preservation/01-discovery.md`

## 1. Scope and method

**Question.** When a traveler changes destination or check-in window from a populated
hotel result set, what does expaify do today with (a) the result set they had, (b)
their place in it, and (c) the property they were reading — and what is the minimum
interaction change that makes the edit safe to attempt?

**Evidence basis.** Two kinds of claim appear below and are labelled throughout:

- **[CODE]** — read directly from this worktree at the cited `file:line`. Every
  behavioural claim about expaify is of this kind.
- **[PATTERN]** — interaction-pattern observation of Booking.com and Google Flights
  from prior teardowns, stated at the level of *what the interaction guarantees*,
  not of visual treatment or current markup. These are directional inputs, not
  measurements; each is phrased so a designer can confirm it by inspection in one
  session. No competitor code was read and none is cited.

**Files audited.** `app/deals/DealFeed.tsx`, `app/deals/page.tsx`,
`app/deals/[dealId]/page.tsx`, `app/deals/HotelRecoveryUI.tsx`,
`app/components/HotelSearchCriteria.tsx`, `app/components/HotelDealCriteria.tsx`,
`app/components/ui/DealCard.tsx`, `lib/hotels/searchCriteria.ts`,
`lib/analytics.ts`, `app/api/deals/route.ts`, `lib/deals/feedContract.ts`.

**Already solved — do not rebuild.** URL criteria carrier
(`buildHotelResultsUrl` / `buildHotelDetailUrl` / `buildHotelBackUrl`,
`lib/hotels/searchCriteria.ts:188-284`), `popstate` resync
(`DealFeed.tsx:914-976`), criteria summary and mismatch alert
(`HotelSearchCriteria.tsx:27-79, 259-271`), failed-request retry with focus
management (`DealFeed.tsx:869-877`), filter Undo (`DealFeed.tsx:1024-1034`).

## 2. Two corrections to the discovery report

Both change what downstream stages should assume. Neither changes the problem.

1. **Analytics is live in production, not development-only.** The discovery report
   states "`lib/analytics.ts` logs in development only, so this is an
   event-definition exercise, not a live-measurement one." **[CODE]**
   `lib/analytics.ts:64-80` returns early with a `console.debug` **only when
   `NODE_ENV === 'development'`**; otherwise it posts every event to
   `/api/analytics` (a real route, `app/api/analytics/route.ts`) via `sendBeacon`
   with a `fetch` fallback, plus an optional external sink. The event definitions
   in §6 are therefore a **live instrumentation spec**: names and prop values are
   written to Postgres and must be treated as a stable contract, not throwaway
   strings.
2. **There is no sticky filter row.** Discovery constraint 4 requires new
   affordances to "fit at 375px without overlapping the sticky filter row."
   **[CODE]** `position: sticky` appears nowhere in `app/deals/DealFeed.tsx` or
   `app/globals.css`; the filter row scrolls with the page. The constraint is moot
   for overlap, but §5 D4 raises a related consequence: because nothing is sticky
   and no `scroll-padding-top` is set, a fragment-based scroll target lands flush
   at the viewport top with no offset work required.

## 3. Current-state audit, by research scenario

### Scenario (a) — widened check-in window returns zero deals

**[CODE] What happens now.** `applyCriteriaDraft` (`DealFeed.tsx:849-912`) fetches
with `criteriaRequest`, and on success commits `deals`, `criteria`, `city`,
`dateFrom`, `dateTo`, announces `Results updated for …`, and `router.push`es the new
results URL. A zero-length `response.deals` follows this exact path: it is a
**success**. `preserveResultsOnFailure` (line 868) only guards the `catch`/`!ok`
branch at line 707-719, so it never fires here.

The traveler then lands in one of two empty branches. Which one is not obvious, and
the more likely one is the worse one:

- `deals.length === 0 && hasActiveFilters` (`DealFeed.tsx:1837-1854`) →
  `ResultCoverageBoundary` + **Edit search** + **See all destinations**.
- `deals.length === 0` (`DealFeed.tsx:1855-1871`) → `ResultCoverageBoundary` +
  **Edit search** only.

**[CODE] `hasActiveFilters` is true for most real edits.** It derives from
`coverageFilters` (`DealFeed.tsx:1197-1205`), whose `dateFrom` / `dateTo` entries are
eligible whenever those values are non-empty (`chipEligible`, lines 1176-1177) —
**with no premium gate**, unlike `minDiscount` / `minStars` / `maxPrice`. A traveler
who edits the check-in window at all therefore lands in the *filtered* empty branch
and is offered filter-removal chips for `dateFrom` / `dateTo` — i.e. the recovery on
offer is "delete the dates you just chose," not "restore the search that worked."

**[CODE] Both escape hatches are lossy.** *See all destinations* is
`<a href="/deals">` (line 1852) — a full navigation that discards the entire criteria
query string. *Edit search* reopens the editor seeded from the **new** criteria
(`HotelSearchCriteriaEditor` `initialDraft` is only supplied on the failure path,
line 1963), so the traveler must retype the window they just left. The previous
search exists only as a browser history entry, unnamed and unmentioned on screen.

**[CODE] Removing a date chip desynchronises the URL.** `removeRecoveryFilter`
(lines 1012-1022) → `applyFilter` sets `dateFrom`/`dateTo`/`city` state but never
calls `setCriteria`. The URL-mirroring effect (`DealFeed.tsx:557-565`) writes
`buildHotelResultsUrl(criteria, view)` and its dependency array contains
`criteria` and the four view values — **not** `city`, `dateFrom`, or `dateTo`. So
after removing a date chip the address bar still advertises the removed date, and
`popstate`/refresh/share restores criteria that no longer match what was on screen.
See §7; this is adjacent, not this ticket's fix.

**[PATTERN] Booking.com.** A zero-result search does not terminate. The search
control stays populated and in place at the top of results, and the page's primary
content becomes adjacent-inventory offers (nearby properties, other dates) rather
than an instruction to search again. The guarantee: *the criteria that produced zero
are still visible, still editable in one step, and the page proposes a concrete
alternative rather than an empty canvas.*

**[PATTERN] Google Flights.** Zero/thin results surface alternatives the traveler
did not have to ask for (nearby dates, nearby airports) alongside the unchanged
search controls. The guarantee is the same: *never hand back a blank page whose only
action is "try again."*

**Delta.** Both references answer zero results with *adjacent inventory*; neither can
be adopted here — expaify has no nearby-dates index at this layer, and the
constraint bars new provider calls. But both also preserve the **prior working
state** implicitly (the search control never empties). expaify preserves neither
alternatives nor the prior state. The affordable delta is the second one: lead the
post-edit zero state with the search that had results, by name.

### Scenario (b) — switch destination, then recover the previous search

**[CODE] What happens now.** `applyCriteriaDraft` calls `setUndoSnapshot(null)`
(line 926 is the `popstate` path; the edit path never sets one at all — the snapshot
is only ever written by `behavior.undoOnSuccess` at line 675, and
`applyCriteriaDraft` passes only `{ preserveResultsOnFailure: true }` at line 868).
Result: **criteria edits are the only feed mutation with no Undo**, while every
filter pill, chip removal, and reset has one (`applyFilter`, lines 781-808).

The recovery that does exist — `router.push` at line 910 creates a history entry,
and `popstate` triggers `restoreCriteriaFromLocation` (lines 914-965) — is genuinely
correct and lossless for criteria, filters, and sort. It is also **invisible**:
nothing on the results surface says the previous search is one Back away.

**[CODE] The existing Undo machinery cannot carry a criteria edit as-is.** Three
concrete obstacles the design stage must plan around:

1. `UndoSnapshot.target` is a `FeedSnapshot` = `HotelFilterState & { sort, queryId }`
   (`DealFeed.tsx:157-162`). It has `city`/`dateFrom`/`dateTo` but **no
   `HotelSearchCriteriaV1`**, so restoring it would revert the values while leaving
   `criteria` — and therefore `criteriaVersion`, the URL, and the summary card — on
   the new search.
2. `undoRecovery` (lines 1024-1034) calls `fetchDeals` without `criteriaRequest`, so
   the request would be stamped with the *current* `criteriaVersion`
   (`fetchDeals` line 601: `opts.criteriaRequest ?? criteria`) and the echo check at
   line 613 would pass while the state stayed inconsistent.
3. `fetchDeals` deliberately returns early for criteria requests — *"A criteria
   apply is committed atomically by its caller"* (line 630-631). A criteria undo
   must therefore be committed by its caller too, the way `applyCriteriaDraft` does
   at lines 885-911, not by `successKind: 'undo'` inside `fetchDeals`
   (lines 676-685).

**[CODE] Editing from a destination page silently relocates the traveler.**
`resultsUrl` (lines 1183-1185) uses `buildHotelDestinationUrl` when `defaultCity` is
set, but `applyCriteriaDraft` pushes `buildHotelResultsUrl` unconditionally
(line 910). An edit made on `/destinations/lisbon` — even one that keeps Lisbon —
lands on `/deals`. The detail surface already solved exactly this with
`resolveHotelEditSubmitUrl` (`searchCriteria.ts:236-248`); the results surface does
not use it.

**[PATTERN] Booking.com.** Recovery of a prior search is provided by a persistent
*recent searches* list, client-persisted and account-free.
**[PATTERN] Google Flights.** The entire search state is URL-encoded, so
Back/Forward is a lossless time machine, and the criteria controls never leave the
page — the previous value is re-selectable in the same control that changed it.

**Delta.** Booking's answer (recent searches) is **explicitly out of scope** for this
ticket and should not be proposed. Google Flights' answer is *already implemented
here* — expaify's URL carrier is equivalent in power. The gap is not capability, it
is **discoverability and cost**: Google Flights keeps the previous value one click
away inside a visible control, whereas expaify hides it behind a system gesture the
discovery report notes travelers avoid mid-task on mobile. The delta is an on-screen,
named, one-step revert.

### Scenario (c) — return to the list from the 40th result

**[CODE] What happens now.** `HOTEL_DEAL_PAGE_SIZE = 12`
(`lib/deals/feedContract.ts:3`). The 40th card requires four pages, loaded by
`loadMore` / the `IntersectionObserver` sentinel (`DealFeed.tsx:1111-1140`) with
server-authored `nextOffset`. None of this depth is recoverable:

- `buildHotelResultsUrl` (`searchCriteria.ts:188-207`) encodes criteria + four view
  values. **`offset` is never written to any URL** — confirmed by grep across the
  module and `DealFeed.tsx`.
- Card links are plain `<a href>` (`app/components/ui/DealCard.tsx:139-150`), not
  `next/link`. Opening a deal is a **full document navigation**: `DealFeed` unmounts
  and all four loaded pages are destroyed.
- The return link is also a plain `<a href={backHref}>`
  (`app/deals/[dealId]/page.tsx:337-344`), a second full navigation.
- The server page fetches exactly one page at `offset: 0` (`app/deals/page.tsx`
  → `getActiveDeals` with `HOTEL_DEAL_PAGE_SIZE`), so the return lands on cards
  1–12, at the top, with no marker.

Because both hops are full document loads, Next.js's `<Activity>`-based UI
preservation (`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`)
and `Link`'s scroll-position maintenance
(`.../03-api-reference/02-components/link.md:230-236`) never engage. This is a
**client-side navigation problem before it is a state-restoration problem.**

**[CODE] The capability to restore depth already exists server-side.**
`app/api/deals/route.ts:114-119` accepts any integer `limit` in `1..100` at a given
`offset`. Four pages of 12 = 48 > 100? No — 48 ≤ 100. So a return that has to
re-fetch `n` loaded pages can do it in **one request** (`limit = min(n × 12, 96)`,
i.e. up to 8 pages), not `n` requests. Restoring depth costs one request that the
traveler *did* ask for by pressing "Back to results"; it does not violate the
"no extra unrequested API request" constraint.

**[PATTERN] Booking.com.** Property detail historically opens in a **new browser
tab**, so the result list is never navigated away from and needs no restoration —
the cheapest possible solution to this class of problem. Where in-tab navigation
does occur, returning restores both loaded pages and scroll offset.
**[PATTERN] Google Flights.** Expanding an itinerary is an in-place disclosure
inside the list; the list is never replaced, so depth cannot be lost.

**Delta.** Both references avoid the problem structurally — one by not leaving, one
by leaving in a new tab. expaify's detail is a full route with its own URL and
should stay one (it is shareable, and `deal-detail-continuity` owns it). The
adoptable equivalent is: make the round trip client-side and carry depth in the URL
carrier that already exists.

### Scenario (d) — 375px backdrop tap with a changed draft

**[CODE] What happens now.** The editor's backdrop is `fixed inset-0` with
`onMouseDown` closing on any hit whose `target === currentTarget`
(`HotelSearchCriteria.tsx:187-192`), and Escape closes via the `keydown` handler
(lines 141-146). Both route to `closeEditor` (lines 164-174), which fires
`hotel_criteria_edit_cancelled` **with `draft_changed`** — the loss is measured — and
then discards the draft unconditionally. On reopen the draft is re-seeded from
`criteria` (lines 111-125), so the composed change is gone.

Two aggravating details: at 375px the dialog is `items-end` (a bottom sheet), so the
backdrop is the entire upper screen — the largest, most tap-reachable target on the
page; and `onMouseDown` fires on **press**, not release, so there is no drag-off
recovery a user could learn.

**[CODE] What is *not* broken.** Focus management is sound: focus is captured on open
(line 119), moved to the destination select, cycled by a Tab trap (lines 147-158),
and returned to the opener on close (line 173). Submit is correctly disabled unless
`valid && changed` (line 238). None of this should be redesigned.

**[PATTERN] Both references.** Dismissing a populated search/date panel by tapping
outside is treated as *cancel*, but the panel's committed criteria are still visible
in the persistent control behind it, so nothing composed is unrecoverable — the
control is the source of truth, the panel is a view onto it. Neither reference
relies on a confirm dialog for this.

**Delta.** expaify's editor is a modal over a list that does **not** show the
criteria fields, so "the control behind it" does not exist as a fallback. Given the
constraint against redesigning the shipped summary, the in-scope equivalent is to
make the destructive dismissal explicit only when there is something to destroy.

### Scenario (e) — edit criteria from the detail page

**[CODE] What happens now.** `HotelDealCriteriaSummary.apply`
(`HotelDealCriteria.tsx:48-84`) probes `/api/deals?…&limit=1`, verifies the echoed
`criteriaVersion`, fires `hotel_criteria_edit_applied` with a `result_count_bucket`
derived from `payload.total`, then `router.push`es `resolveHotelEditSubmitUrl(...)`.

Three findings:

1. **The traveler is moved off the property with no statement about it.** The push
   navigates to results. The deal they were reading is not mentioned before, during,
   or after. The inverse direction — arriving at a deal that falls outside criteria —
   *is* handled, by `HotelCriteriaMismatchAlert` (`HotelSearchCriteria.tsx:259-271`).
2. **The system already knows the answer and throws it away.**
   `hotelCriteriaContextStatus(criteria, deal)` (`searchCriteria.ts:286-297`) is a
   pure, synchronous function that answers "does this deal match these criteria?"
   It is called with the *current* criteria at line 46 but never with the *proposed*
   criteria, even though the proposed object (`next`) is in scope at line 52 — one
   call before the `router.push` at line 75 would classify the outcome as
   *survives* / *falls outside*.
3. **A zero-result edit from detail is silent too.** `payload.total` is read for
   analytics (line 71) and then discarded; the traveler is pushed to a results page
   that will render empty with no forewarning.

**[PATTERN] Both references.** Changing dates from a property/itinerary view keeps
the traveler on that property and re-prices it for the new dates; unavailability is
stated about *that property* ("not available for these dates") before any list is
substituted. The guarantee: *the object of attention is never silently swapped for a
list.*

**Delta.** expaify cannot re-price a deal for new dates — its deals are discrete
snapshot rows, not a rate calendar, and re-pricing would be a new provider call
(barred). But it *can* state the outcome, because `hotelCriteriaContextStatus` is
already computable against the proposed criteria at zero cost. The delta is a
statement, not a re-price.

## 4. Gap summary

| # | Scenario | Current [CODE] | Reference guarantee [PATTERN] | Delta to close |
|---|---|---|---|---|
| 1 | b | Criteria edit clears/never sets `undoSnapshot`; recovery only via browser Back | Prior value stays one click away in a visible control | On-screen named one-step revert |
| 2 | a | Zero-result edit is a *success*; empty state offers Edit search / lossy "See all destinations" | Never a blank page whose only action is "try again" | Empty state leads with restoring the named prior search |
| 3 | a, e | Commit states no consequence; detail edit discards a computable match verdict | Object of attention is never silently swapped | Declarative consequence at commit; outcome stated for the viewed property |
| 4 | c | `offset` in no URL; both hops are full document loads; return renders page 1 top | Never leave the list, or leave it in a new tab | Client-side round trip + depth in the URL carrier + return anchor |
| 5 | d | Backdrop `mousedown` / Escape discard a changed draft silently | Committed criteria remain visible behind the panel | Confirm only when the draft is changed |

## 5. Design directives

Testable, specific, and scoped to repair. Each names its acceptance test.

### D1 — A criteria edit is revertible in one on-screen step

Extend the **existing** `undoSnapshot` mechanism; do not build a parallel one.

- `UndoSnapshot.target` gains the full `HotelSearchCriteriaV1` that was active before
  the edit, and `UndoSnapshot.kind` gains the value `'criteria'`.
- On a **successful** `applyCriteriaDraft`, set the snapshot instead of leaving it
  null. The revert must be committed by its caller (mirroring lines 885-911), because
  `fetchDeals` returns early for `criteriaRequest` calls (line 630) — a
  `successKind: 'undo'` restore inside `fetchDeals` is not a valid path for criteria.
- The revert request must pass `criteriaRequest: <previous criteria>` so the echo
  check at line 613 validates the version being restored, and on success must also
  restore `criteria`, `city`, `dateFrom`, `dateTo`, and the URL via `router.push`.
- Label names the destination it returns to and the window, e.g.
  **`Undo — back to Lisbon · Check in Sep 3–10`**. Where destination is unset, use
  **`Undo — back to All destinations · <dates>`**.
- The control lives in the existing `HotelResultStatus` slot
  (`HotelRecoveryUI.tsx:55-95`), whose `undoLabel` prop is currently a two-value
  string union and must be widened. It inherits that component's `min-h-11`, focus
  ring, and `role="status"` announcement.
- Invalidation follows the filter rule already specified in
  `hotel-filter-recovery/03-design.md`: any later filter, sort, NL search, reset,
  tab, or route change removes the action. Never show a disabled dead control.
- Failure copy reuses the shipped `undoError` string
  (`HotelRecoveryUI.tsx:88-92`) with wording adjusted from "filters" to "search".

**Test.** From a populated Lisbon list, change destination to Porto → a revert
control naming Lisbon and its dates is present, keyboard-reachable, ≥44px; activating
it restores the Lisbon deals, the summary card, and the `/deals?...` URL including
`criteriaVersion`; pressing a filter pill first removes the control entirely.

### D2 — A post-edit zero-result state leads with restoring the previous search

- Zero deals following a criteria edit is a **distinct state** from the filtered-empty
  and cold-empty states already rendered at `DealFeed.tsx:1837-1871`. It must not be
  routed through `hasActiveFilters`, whose date chips would otherwise invite the
  traveler to delete the dates they just chose.
- Action order, primary first: **(1)** restore the previous search, named — the same
  target as D1, so one mechanism serves both; **(2)** Edit search, reopening the
  editor seeded with the **new** criteria (pass `initialDraft`, which today is only
  supplied on the failure path at line 1963); **(3)** no "See all destinations" here —
  it is `<a href="/deals">` and drops the criteria carrier entirely.
- Headline states the criteria that returned nothing, not a generic apology:
  **"No deals for Porto · Check in Sep 3–10."** Body: **"Your previous search is
  still one step away."**
- The state must be announced through the existing `role="status"` region rather than
  only rendered.

**Test.** Widen a window until the edit returns zero → the restore action is the
first focusable action in the empty state; no `dateFrom`/`dateTo` removal chips are
offered; the URL still carries the new criteria; the screen-reader announcement names
the destination and window that returned zero.

### D3 — The commit states its consequence, and the detail surface states its outcome

**No result preview.** Discovery constraint 3 bars an extra unrequested API request,
and a live match count before commit is exactly that. Google Flights can preview
because it owns a price grid; expaify does not. The directive is therefore a
**declarative** consequence plus a guaranteed reversal (D1) — not a count.

- Editor description copy (`HotelSearchCriteria.tsx:195`) states what is replaced and
  that it is reversible: **"Updating replaces the deals shown now. You can undo this
  straight after."**
- On the **detail** surface only, the editor additionally names the property at risk:
  **"You're viewing <Hotel name>. Updating your search returns you to results."**
- On submit from detail, `HotelDealCriteria.apply` computes
  `hotelCriteriaContextStatus(next, deal)` — the proposed criteria are already in
  scope as `next` (`HotelDealCriteria.tsx:52`) — and the destination results surface
  states the outcome for that property in the result status region:
  - survives → **"<Hotel name> still matches your updated search."**
  - falls outside → **"<Hotel name> is outside your updated search."**
- Do not change the submit button label; **Update results** / **Updating results…**
  (line 238) stays, as does the disabled-unless-`valid && changed` rule.

**Test.** Open the editor from a detail page → the description names the property;
apply a date change that excludes it → results show the "outside your updated search"
statement; apply one that includes it → the "still matches" statement. No additional
network request is made beyond the one already issued at
`HotelDealCriteria.tsx:57`.

### D4 — Returning from detail restores depth and position

Two parts, both required; part 1 is a precondition for part 2.

1. **Make the round trip client-side.** `DealCard`'s `<a href>`
   (`app/components/ui/DealCard.tsx:139-150`) and the detail back link
   (`app/deals/[dealId]/page.tsx:337-344`) become `next/link` navigations. The card
   link keeps its `onOpen` analytics call and its `aria-label`; the back link keeps
   `data-hotel-back` and its `aria-label`.
2. **Carry depth in the existing URL carrier.** Add one optional parameter to
   `buildHotelResultsUrl` / `buildHotelDetailUrl` / `buildHotelBackUrl` —
   **`resume`**, the number of *pages* loaded (integer `2..8`; omitted at 1) — plus
   the returned card's id as a fragment (`#deal-<id>`) on the back URL only.
   - Validation belongs beside `resolveHotelResultsView`
     (`searchCriteria.ts:250-279`) and must be as strict: a non-integer,
     out-of-range, or repeated `resume` yields the same "couldn't restore this
     search" treatment as any other malformed carrier value, never a silent
     clamp-and-continue.
   - `8` is the cap because `app/api/deals/route.ts:114-119` rejects `limit > 100`
     and `HOTEL_DEAL_PAGE_SIZE` is 12 (8 × 12 = 96). Beyond 8 pages, restore 8 and
     let the sentinel continue — do not issue multiple requests.
   - Restoration is **one** request of `limit = resume × 12, offset = 0`, issued
     because the traveler pressed Back to results. No speculative prefetch.
   - Landing: scroll the anchored card into view and move focus to it; if the id is
     absent from the restored set (expired or re-ranked), land at the top of the grid
     and announce **"That deal is no longer in these results."** through the existing
     status region. Nothing on this page is `position: sticky` and no
     `scroll-padding-top` is set, so no scroll offset compensation is needed.
   - While the deeper page is in flight, render the skeleton grid already used for
     criteria updates (`DealFeed.tsx:1790-1792`), not a spinner.

**Test.** Load 4 pages, open card 40, press **Back to results** → no full document
reload; 48 cards render; card 40 is scrolled into view and focused; exactly one
`/api/deals` request is made; hand-editing `?resume=99` or `?resume=x` produces the
invalid-search treatment, not a silent fallback.

### D5 — A changed draft is not discarded by an accidental dismissal

- `closeEditor` (`HotelSearchCriteria.tsx:164-174`) branches on the `changed` value
  it already computes (line 136):
  - **not changed** → close immediately, for all three methods. No new friction on
    the common case.
  - **changed**, dismissed by **backdrop** or **Escape** → do not close; show an
    inline confirmation inside the dialog: **"Discard your changes to this search?"**
    with **Discard changes** and **Keep editing**. Focus moves to **Keep editing**;
    Escape from the confirmation returns to the form, not out of the dialog.
  - **changed**, dismissed by the explicit **Cancel** button → close immediately.
    Cancel is a deliberate act and must not be second-guessed.
- Backdrop dismissal moves from `onMouseDown` to a press-and-release pair on the
  backdrop, so a drag that starts on the sheet and ends on the backdrop is not a
  dismissal.
- The existing focus capture, Tab trap, and focus return (lines 119, 147-158, 173)
  are unchanged; the confirmation renders inside `dialogRef` so the trap covers it.
- `hotel_criteria_edit_cancelled` is superseded by `hotel_criteria_edit_dismissed`
  (§6), which distinguishes the three methods.

**Test.** At 375px, change the destination select, tap the backdrop → the sheet stays
open with the confirmation shown and focus on **Keep editing**; press Escape → back
to the form with the change intact; press Cancel → closes immediately, focus returns
to the opener. With no change made, backdrop tap closes immediately.

## 6. Event definitions

Names match `EVENT_NAME` (`/^[a-z][a-z0-9_]{1,79}$/`, `lib/analytics.ts:5`). Props
are `string | number | boolean` only (`AnalyticsProps`, line 1) — serialise anything
structured, as `serializedFilterState` already does (`DealFeed.tsx:1249-1268`). These
reach Postgres in production (see §2.1): treat every name and enum value as a
contract. Buckets reuse `resultCountBucket` (`searchCriteria.ts:321-326`) and
`viewportBand` (`DealFeed.tsx:1243-1247`).

### `hotel_criteria_edit_reverted`
Fires when D1's revert **succeeds** (commit complete). A failed revert emits
`hotel_criteria_edit_revert_failed` with the same props minus `elapsed_ms`.

| Prop | Type | Values |
|---|---|---|
| `from_version` | string | `criteriaVersion` being left (the edited one) |
| `to_version` | string | `criteriaVersion` being restored |
| `changed_fields` | string | Same construction as `hotel_criteria_edit_applied`: sorted CSV of `destination`,`date_from`,`date_to` |
| `revert_source` | string | `result_status` \| `empty_state` |
| `result_count_bucket` | string | `0` \| `1_5` \| `6_20` \| `21_plus` — the restored set |
| `elapsed_ms` | number | ms from `hotel_criteria_edit_applied` to revert, same session |
| `viewport_band` | string | `mobile_375` \| `desktop_1280` \| `other` |

### `hotel_criteria_edit_zero_result`
Fires **once** per applied edit whose committed result set is empty, immediately
after `hotel_criteria_edit_applied` (which keeps its own
`result_count_bucket: '0'` — the pair is intentional; this event carries the
recovery context that one lacks). Not fired for zero results caused by a filter pill.

| Prop | Type | Values |
|---|---|---|
| `criteria_version` | string | The applied version |
| `previous_version` | string | The version replaced |
| `changed_fields` | string | As above |
| `previous_result_count_bucket` | string | Bucket of the set that was replaced — separates "traded results for nothing" from "was already empty" |
| `surface` | string | `results` \| `detail` |
| `entry_point` | string | `summary` \| `empty_state` \| `mismatch` |
| `revert_offered` | boolean | Whether D1's control was rendered |
| `viewport_band` | string | As above |

### `hotel_criteria_edit_dismissed`
Replaces `hotel_criteria_edit_cancelled`. Fires when the editor closes **without** an
applied edit — after the D5 confirmation resolves to Discard, not when it opens.

| Prop | Type | Values |
|---|---|---|
| `method` | string | `cancel` \| `escape` \| `backdrop` |
| `draft_changed` | boolean | `hotelCriteriaDraftChanged(criteria, draft)` at dismissal |
| `confirmed` | boolean | Whether the D5 confirmation was shown and accepted (`false` for every unchanged-draft dismissal) |
| `surface` | string | `results` \| `detail` |
| `entry_point` | string | `summary` \| `empty_state` \| `mismatch` |
| `criteria_version` | string | Active version at dismissal |
| `viewport_band` | string | As above |

A companion `hotel_criteria_edit_discard_cancelled` (same props minus `confirmed`)
fires when the traveler chooses **Keep editing**. The ratio of that to
`hotel_criteria_edit_dismissed{method:backdrop, draft_changed:true}` is the direct
measure of how many backdrop dismissals were accidents — the question the discovery
report could not answer.

### `hotel_results_return_from_detail`
Fires on the results surface after a D4 return commits (restored set rendered), not
on the back-link click.

| Prop | Type | Values |
|---|---|---|
| `deal_id` | string | The deal returned from |
| `page_depth` | number | Pages restored, `1..8` (`resume`, or `1` when absent) |
| `restored_position` | number | 1-indexed position of `deal_id` in the restored set; `0` if absent |
| `position_restored` | boolean | `true` when the card was found, anchored, and focused |
| `restore_outcome` | string | `anchored` \| `deal_missing` \| `restore_failed` |
| `capped` | boolean | `true` when actual depth exceeded 8 pages and was clamped |
| `criteria_version` | string | Version carried on the back URL |
| `viewport_band` | string | As above |

`restored_position` intentionally duplicates the `card_position` prop of the existing
`hotel_result_card_opened` (`DealFeed.tsx:1346-1356`); comparing the two directly
measures whether the traveler got their place back.

### Post-edit re-engagement pairing rule
Not an event — a derivation rule over the sink, stated so the design and QA stages
share one definition.

- **Unit:** one `hotel_criteria_edit_applied`, keyed by `(sessionId, criteria_version)`.
  `sessionId` is on every event (`lib/analytics.ts:9-25`).
- **Re-engaged** when a `hotel_result_card_opened` **or** a provider-handoff event
  occurs later in the same session while `criteria_version` is still the active
  version.
- **Closes the window — not re-engagement:** a `hotel_criteria_edit_applied` with a
  new version, a `hotel_criteria_edit_reverted`, or session end.
- **Reverted** is a **third outcome**, reported separately from re-engaged and
  abandoned. A revert is a *successful recovery*, not a failed edit; folding it into
  either bucket destroys the signal this feature exists to create.
- **Headline metric:** re-engaged ÷ applied, segmented by `changed_fields`,
  `surface`, and `viewport_band`.
- **Guardrail:** `hotel_criteria_edit_zero_result` ÷ `hotel_criteria_edit_applied`
  must not rise. Per discovery: a rise in edit completion is not success if the
  destructive-edit rate rises with it.

## 7. Findings outside this ticket's scope

Code-verified, reported not fixed, per the "stay inside the assigned ticket" rule.

1. **Filter chips mutate criteria values without updating the criteria carrier.**
   `removeRecoveryFilter` → `applyFilter` (`DealFeed.tsx:1012-1022, 739-822`) changes
   `city` / `dateFrom` / `dateTo` but never `setCriteria`, and the URL-mirroring
   effect (lines 557-565) depends on `criteria` and the four view values only. After
   removing a destination or date chip, the URL, the summary card, and
   `criteriaVersion` all still advertise the removed value; a refresh, share, or
   `popstate` restores a search the traveler explicitly dismantled. This partially
   undermines the URL-as-carrier premise both this feature and
   `hotel-filter-recovery` rest on. **Suggested owner:** `hotel-filter-recovery`, or
   a dedicated repair ticket. It is a data-integrity defect, not a preservation
   affordance, which is why it is not a directive above.
2. **`applyCriteriaDraft` ignores destination-page origin.** Line 910 pushes
   `buildHotelResultsUrl` unconditionally, so an edit made on `/destinations/<slug>`
   always lands on `/deals` — even when the destination is unchanged. The detail
   surface already solves this with `resolveHotelEditSubmitUrl`
   (`searchCriteria.ts:236-248`); the results surface should use the same helper.
   Small and adjacent — flagged for the design stage to fold into D1's commit path if
   it judges the scope acceptable, since D1 already rewrites that commit.
3. **`chipEligible` gates `minDiscount` / `minStars` / `maxPrice` behind `premium`
   but not `dateFrom` / `dateTo` / `city`** (`DealFeed.tsx:1171-1178`). Whether that
   asymmetry is intended is a product question; it is the mechanism that routes
   post-edit zero results into the filtered-empty branch, which D2 works around
   rather than resolves.

## 8. Open question for the design stage

**One question, non-blocking; D1 and D2 are specified for either answer.**

Should the revert control persist across the D2 zero-result empty state and the
normal populated state under the *same* invalidation rule, or should the empty-state
revert be exempt from invalidation because there is no result set left to protect?
The filter Undo rule (`hotel-filter-recovery/03-design.md:325`) invalidates on any
later mutation, which in a zero-result state means the traveler can lose the revert
by pressing Edit search and cancelling out of it. The stricter, safer reading — the
one this brief recommends — is that opening and dismissing the editor is not a
mutation and must not invalidate the revert; only an **applied** change does. State
the chosen rule explicitly in the design spec so QA can test it.

## 9. Handoff

Next stage: **UXDES-HOTEL-SEARCH-EDIT-PRESERVATION-01** (UX Design, Claude Fable 5).

Read before designing: this brief,
`docs/pipeline/hotel-search-edit-preservation/01-discovery.md`,
`docs/pipeline/hotel-filter-recovery/03-design.md` (the Undo pattern D1 extends —
sections *RecoveryUndo*, *Undo announcements*, *Undo*), and
`docs/pipeline/deal-detail-continuity/03-design.md` (the detail↔results contract D4
extends).

The design spec must cover, for each of D1–D5: default, loading, empty, error,
mobile 375px, desktop 1280px, focus/keyboard order, and the live-region announcement
string — plus the invalidation rule chosen in §8 and final copy for every string
named above. Deliver to
`docs/pipeline/hotel-search-edit-preservation/03-design.md`, then create
`UI-HOTEL-SEARCH-EDIT-PRESERVATION-01`.
