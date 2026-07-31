# UXD-HOTEL-SEARCH-EDIT-PRESERVATION-01: Hotel Search Edit and Context Preservation

**Ticket:** UXD-HOTEL-SEARCH-EDIT-PRESERVATION-01 · **Stage:** UX Discovery · **Priority:** P1
**Date:** 2026-07-31 · **Feature slug:** `hotel-search-edit-preservation`
**Persona:** Senior UX Strategist

## Problem statement

A traveler revising destination or check-in dates from the hotel results or detail
surface commits the edit blind and irreversibly: expaify replaces the current
result set with no preview of what the new criteria will return, no one-step way
back to the search they had, and no preservation of where they were in the
results — so an exploratory edit costs them a result set they had already worked
to build, and the safest move becomes not editing at all.

## Who is affected and where in the flow

**Primary users** — travelers who reach a viable but not-yet-decided result set
and want to test one variation:

- **Date-flexible travelers** widening or shifting the check-in window to see
  whether a better-scored deal exists a week later. Highest exposure: their edit
  is exploratory by definition, so the previous window is the thing they most
  need back.
- **Destination-comparing travelers** ("Lisbon or Porto?") who switch destination
  to compare, intending to return. The current model treats each switch as a new
  search with no memory of the prior one.
- **Deep-scrollers** who paginated through several pages of the infinite-scroll
  feed and opened a candidate deal. Returning to results restarts them at the
  first page and the top of the list.
- **Mobile users at 375px**, where the editor is a full-height bottom sheet over
  the results: the previous list is not visible while editing, so the traveler
  cannot compare "what I have" against "what I am about to ask for."

**Flow steps affected** — all four named in the ticket:

1. **Criteria entry / edit** — `HotelSearchCriteriaEditor` (`app/components/HotelSearchCriteria.tsx`), opened from the results summary, the empty state, or a detail-page mismatch.
2. **Results** — `app/deals/DealFeed.tsx`, `applyCriteriaDraft`.
3. **Detail** — `app/deals/[dealId]/page.tsx`, which can host its own edit via `HotelDealCriteria.tsx`.
4. **Return to results** — the `← Back to results` link on detail.

## Current implementation evidence

Context preservation is **partially solved and should not be rebuilt**. The URL is
already the account-free carrier of search context, and it works:

- `buildHotelResultsUrl` / `buildHotelDetailUrl` / `buildHotelBackUrl`
  (`lib/hotels/searchCriteria.ts`) encode destination, date bounds, criteria
  version, source, and the view state (min discount, max price, min stars, sort)
  into every results and detail URL.
- `DealFeed` mirrors state into the URL via `history.replaceState` and resyncs
  from the URL on `popstate`, so browser Back/Forward genuinely restores a prior
  search including its filters and sort.
- Detail already declares context: `HotelSearchCriteriaSummary`,
  `HotelCriteriaContextCard` (missing/invalid), and `HotelCriteriaMismatchAlert`
  (the deal falls outside the active criteria) exist and are wired.
- A failed **network** update is non-destructive: `applyCriteriaDraft` passes
  `preserveResultsOnFailure: true`, keeps the visible results, retains the draft
  in `failedCriteriaDraft`, and offers retry with focus management.
- Filter changes (discount, stars, price) already carry a one-step **Undo**
  affordance backed by `undoSnapshot`.

The gaps are specifically around the **edit transaction** and **return position**:

1. **A criteria edit cannot be undone.** `applyCriteriaDraft` calls
   `setUndoSnapshot(null)` (`app/deals/DealFeed.tsx:926`) and never sets a new
   one. Destination and date edits — the highest-stakes, most exploratory changes
   — are the only feed mutations with no Undo, while lower-stakes filter changes
   have one. The prior search is technically recoverable via browser Back, but
   nothing on screen says so, and on mobile Back is a system gesture users avoid
   mid-task for fear of leaving the app.

2. **A successful edit that returns zero deals is a dead end.** The empty state
   (`app/deals/DealFeed.tsx:1855–1869`) offers only "Edit search" and, for
   filtered cases, filter removal. It cannot offer "restore the search that had
   results" because that search was not retained. `preserveResultsOnFailure`
   protects against a failed request, not against a successful request with an
   empty answer — which is the far more common outcome of widening a date window
   into low-coverage territory.

3. **The edit is committed with no statement of consequence.** The submit button
   reads "Update results" and the dialog says "Update the destination and
   check-in window used to find deals." Nothing tells the traveler what they are
   trading: not how many deals currently match, not that the current list will be
   replaced, not that the deal they were reading may fall outside the new
   criteria.

4. **Return-to-results loses list position and pagination depth.** `offset` is
   never encoded in any URL — `buildHotelResultsUrl` carries criteria and filters
   only. `← Back to results` on detail is a plain `<a href={backHref}>`
   (`app/deals/[dealId]/page.tsx:337–343`), i.e. a fresh navigation that renders
   page one at the top. A traveler who loaded three pages via infinite scroll and
   opened the 40th card returns to a list that no longer contains the card they
   just evaluated, with no marker for where they were. Context is preserved as
   *criteria* but lost as *place*.

5. **A changed draft can be discarded by accident, silently.** The editor closes
   on backdrop `mousedown` and on Escape with no confirmation, discarding an
   in-progress draft. At 375px the bottom sheet is surrounded by a full-bleed
   `inset-0` backdrop, so a mistimed tap is a plausible loss. `draft_changed` is
   already recorded on `hotel_criteria_edit_cancelled`, so the abandonment is
   measurable today but not mitigated.

6. **Editing from detail evaporates the deal under consideration.** An edit made
   on the detail surface routes to a results URL via `resolveHotelEditSubmitUrl`.
   The traveler is moved off the property they were reading with no statement of
   whether it survived the new criteria. The inverse case (arriving at a
   non-matching deal) is handled by `HotelCriteriaMismatchAlert`; this direction
   is not.

7. **Guests and rooms are absent, not hidden.** `HotelSearchCriteriaV1.occupancy`
   is `not_captured` and the editor states so plainly. This is correct for the
   hotels-first MVP and must stay. It is relevant here only because it raises the
   perceived stakes of every edit the traveler *can* make.

**Analytics available today:** `hotel_criteria_summary_viewed`,
`hotel_criteria_edit_started` (with `entry_point`), `hotel_criteria_edit_cancelled`
(with `draft_changed`), `hotel_criteria_edit_applied` (with `changed_fields`,
`previous_version`, `criteria_version`, `result_count_bucket`). There is no event
for reverting an edit, for returning to results from detail, or for re-engagement
with results after an edit. Note that `lib/analytics.ts` logs in development only,
so this is an event-definition exercise, not a live-measurement one.

## Measurable signal

The problem exists when a traveler who opens the criteria editor from a populated
result set does not end up back in a populated result set they act on. Baseline
segmented by viewport (375px / desktop), entry point (`summary`, `empty_state`,
`mismatch`), surface (results / detail), and changed field (destination / dates /
both):

- **Criteria-edit completion rate:** `hotel_criteria_edit_applied` ÷
  `hotel_criteria_edit_started`. Today's floor for the concern.
- **Abandoned-edit rate:** `hotel_criteria_edit_cancelled` with
  `draft_changed: true` ÷ `hotel_criteria_edit_started` — the traveler composed a
  change and then declined to commit it. Split by dismissal method once
  instrumented (Cancel vs Escape vs backdrop), since backdrop/Escape dismissals
  with a changed draft are candidate accidents rather than decisions.
- **Destructive-edit rate:** applied edits whose `result_count_bucket` is `0`
  after an edit made from a populated list. Each is a traveler who traded a
  working result set for nothing.
- **Reversal rate:** sessions that return to a previous `criteria_version` within
  the session (today only observable as a `popstate`-driven restore). A high
  reversal rate proves demand for an explicit revert; a high *destructive-edit*
  rate with a *low* reversal rate proves travelers cannot find the way back.
- **Post-edit re-engagement:** share of applied edits followed within the session
  by a deal-card open or provider handoff, versus exit without either.
- **Return-to-results continuity:** share of `← Back to results` navigations after
  which the traveler opens another deal, versus re-opening the same deal (a
  re-find attempt) or exiting. Also: share of returns from a deal that was beyond
  the first page of results, which quantifies gap 4.
- **Edit churn:** three or more `hotel_criteria_edit_started` events in a session
  without an intervening deal open.

The primary outcome: a higher share of criteria edits that end with the traveler
in a result set they engage with, and a lower share of edits that strand them at
zero results with no path back. A rise in edit *completion* alone is not success
if destructive-edit rate rises with it.

## Constraints the solution must respect

1. **No account-dependent persistence.** Context must survive in the URL and
   in-page state only. No login requirement, no server-side session, no
   dependence on `localStorage`/`sessionStorage` for anything the traveler would
   be harmed by losing. The existing URL-as-carrier model is the pattern to
   extend, not replace.
2. **Retain the hotels-first MVP search model.** Destination + check-in window
   are the only editable criteria. Do not add guests, rooms, or occupancy fields;
   `occupancy: 'not_captured'` and its honest copy stay exactly as they are.
   Do not introduce a new provider call, a new search mode, or a saved-search
   feature.
3. **Non-negotiable contract holds.** Money stays `{ priceCents, currency }`,
   provider access stays behind `lib/providers`, adapters return `Result<T>`,
   affiliate markers stay on outbound deeplinks. Any preserved state is client/URL
   state only and must not cause an extra unrequested API request.
4. **Accessibility and small-screen usability.** Any new affordance must be
   keyboard reachable with a visible focus ring, announce result changes through
   the existing `role="status"` live region, meet the 44px touch target used
   throughout (`min-h-11`), and fit at 375px without overlapping the sticky
   filter row or the editor sheet. It must not trap or steal focus from the
   existing editor focus management.
5. **Repair, not feature.** The deliverable is a correction to an existing
   broken-feeling interaction. No new marketing surface, no new persistence layer,
   no redesign of the criteria summary that already ships.

## Success statement

This is solved when a first-time user can change the destination or check-in
window from a populated hotel result set, see immediately what the change did,
and return to their previous search in one obvious on-screen step — without
losing the results they had, without relying on the browser Back button, and
without an account.

Concretely, the smallest context-preservation pattern to validate downstream is:

- **Reversible edits.** A criteria edit produces the same one-step revert that
  filter changes already have — an explicit "Undo — back to «previous search»"
  control naming the prior destination and dates, using the existing
  `undoSnapshot` mechanism rather than a new one.
- **A non-dead-end zero-result state.** When an applied edit returns nothing, the
  empty state leads with restoring the previous search, not with editing again.
- **Position-aware return.** Returning from detail lands the traveler on the deal
  they came from, at the depth they had reached, using the existing URL carrier.
- **A guarded discard.** A changed draft is not silently thrown away by a stray
  backdrop tap.

Explicitly **out of scope** for this feature: guest/room criteria, saved or named
searches, multi-search comparison, cross-device continuity, and any change to
Deal Score, the provider layer, or filter recovery (owned by
`docs/pipeline/hotel-filter-recovery/`).

## Prior art in this repo

Downstream stages should read these before proposing anything, to avoid
re-litigating settled decisions:

- `docs/pipeline/search-criteria-summary/` — established the criteria summary,
  the `HotelSearchCriteriaV1` schema, and the "guests & rooms not captured" copy.
- `docs/pipeline/hotel-filter-recovery/` — owns filtered-empty recovery and the
  filter Undo pattern this feature should reuse for criteria edits.
- `docs/pipeline/deal-detail-continuity/` — owns the detail↔results criteria
  round trip that gap 4 extends with list position.

## Handoff

Next stage: **UXR-HOTEL-SEARCH-EDIT-PRESERVATION-01** (UX Research, Claude Fable 5).

Research scenarios to run against the code and against reference patterns
(Booking.com and Google Flights date/destination revision, at the level of
interaction pattern):

1. Traveler on a populated `/deals` list widens the check-in window and gets zero
   deals. What does each reference offer as the immediate next action?
2. Traveler switches destination to compare, then wants the first destination
   back. How do references make the previous search recoverable without an
   account?
3. Traveler opens the 40th result, then returns to the list. How do references
   restore list depth and position?
4. Traveler starts an edit at 375px, taps outside the sheet with a changed draft.
   What do references do with the in-progress draft?
5. Traveler edits criteria from a detail page. What do references say about the
   property they were viewing?

Event definitions to specify in the research brief (names and required props):
`hotel_criteria_edit_reverted`, `hotel_criteria_edit_zero_result`,
`hotel_criteria_edit_dismissed` (with `method: cancel | escape | backdrop` and
`draft_changed`), `hotel_results_return_from_detail` (with `deal_id`,
`restored_position`, `page_depth`), and the post-edit re-engagement pairing rule
linking `hotel_criteria_edit_applied` to a subsequent deal open.
