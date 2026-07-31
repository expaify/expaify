# 02 — Research: Hotel Search Intent Guidance

**Ticket:** UXR-HOTEL-SEARCH-INTENT-01
**Stage:** UX Research
**Feature slug:** `hotel-search-intent`
**Date:** 2026-07-31
**Upstream:** `docs/pipeline/hotel-search-intent/01-discovery.md`
**Scope:** Guidance, examples, and validation around the existing hotels-first search model. Excludes natural-language search and personalized recommendations. No expansion of tracked markets. No occupancy filtering.

---

## 1. Verification of discovery findings

Every discovery claim was checked against source. Five confirmed, one is materially understated and is corrected below.

| # | Discovery claim | Verdict | Evidence |
|---|---|---|---|
| 1 | `app/page.tsx` has no search input | **Confirmed** | The string `search` does not appear anywhere in `app/page.tsx`. Hero CTAs are `/join` and `/deals` (`app/page.tsx:140`, `:143`). Every homepage path to results is a bare `href="/deals"` with no query string, so `resolveHotelSearchCriteria` sees no `criteriaVersion`/`criteriaSchema` and returns `{ status: 'missing' }` (`lib/hotels/searchCriteria.ts:137`), and `/deals` synthesizes an empty draft (`app/deals/page.tsx:74`). Organic arrival = criteria-less arrival, 100%. |
| 2 | Destination is a `<select>` of 20 hardcoded cities | **Confirmed** | `HotelSearchCriteria.tsx:199–210` renders `<select>` over `cities` + an "All destinations" option; `cities` originates from `TRACKED_MARKET_NAMES` (`lib/trackedMarkets.ts:32`, 20 entries). Coverage is disclosed nowhere outside the modal — the only ambient mention is the `/deals` subtitle and the page `description` metadata (`app/deals/page.tsx:22`). |
| 3 | Dates are a check-in window labelled From/Through, disclaimer after the fields | **Confirmed** | `HotelSearchCriteria.tsx:214–227`: `<legend>Check-in window</legend>`, labels "From" and "Through", and the disclaimer "Deals may have different check-out dates and stay lengths" renders at `:227`, after both inputs. |
| 4 | Occupancy is permanently `not_captured` | **Confirmed** | `HotelSearchCriteriaV1.occupancy` has an `applied` variant (`lib/hotels/searchCriteria.ts:11–13`) but every constructor hardcodes `{ state: 'not_captured' }` — `hotelCriteriaFromDraft:120` and `resolveHotelSearchCriteria:181`. `HotelCriteriaDraft` carries only `city`, `dateFrom`, `dateTo`. The `applied` variant is unreachable. |
| 5 | `HotelDestinationCombobox` / `HotelDestinationSearchState` are built and mounted nowhere | **Confirmed** | Repo-wide grep: the only importers are `HotelDestinationSearchState.tsx` and the two files' own tests in `app/components/__tests__/`. No page or feature component imports either. |
| 6 | Rejected submits fire no event and render no message | **Confirmed** | `HotelSearchCriteria.tsx:238` — `disabled={!valid || !changed || submitting}`; `submit()` at `:176` sets `attempted` then returns early on the same predicate with no `track()` call and no form-level message. Field errors render only when `attempted` is true, and `attempted` can only be set by a submit the disabled button prevents. The failure is unmeasurable *and* unexplained. |
| 7 | `isValidHotelDate` accepts any well-formed ISO date; inputs have no `min`/`max` | **Confirmed, but the consequence is far larger than "a 2019 window returns empty"** | See §2. |

### 1a. Correction to the discovery report

Discovery assumed a **"60-day snapshot horizon"** and framed the date problem as out-of-range windows (past dates, far-future dates). The source says something stronger.

`lib/pipeline/snapshot.ts:11–22` — `getAnchorCheckInDate()` — does not sample a horizon at all. It returns **one of two fixed calendar anchors**: the 1st and the 15th of next month, rolling to month+2 when next month's 1st is under 7 days away, alternating by `today.getDate() % 2`. `NIGHTS` is a module constant of `2` (`:4`). `storeSnapshot` writes that single anchor into `price_snapshots.check_in` (`:203–210`).

`detectDealsForMarket` groups on `check_in` and writes `check_in_date` straight through (`lib/pipeline/dealDetection.ts:41–100`), filtered to `check_in >= CURRENT_DATE`. `getActiveDeals` filters `d.check_in_date >= dateFrom` and `<= dateTo` (`:265–274`).

**Therefore: the set of check-in dates that can ever return a real deal is approximately two to four discrete calendar dates at any moment — the 1st and 15th of the next month or two.** The 60-day interval in `dealDetection.ts:59` is the *price-history lookback*, not a booking horizon; discovery conflated the two.

The "60 days" is also *not* the outer bound of the reachable range. When next month's 1st is within 7 days, the anchors become month+1's 15th and month+2's 1st — up to ~76 days out. A `min`/`max` of `[today, today + 90 days]` is the correct safe superset, not 60.

**Design consequence:** a free-form date *range* input is the wrong control for this data. A user who enters a perfectly sensible, perfectly in-range window — "Oct 10 – Oct 14" — gets an empty feed not because there are no deals but because expaify has never priced Oct 10–14. The current control invites the user to express intent along an axis the data has almost no resolution on. Constraining the range (`min`/`max`) fixes the 2019 case but leaves the dominant failure untouched: **most valid in-range windows still return zero.** This drives Directive D2.

### 1b. Two findings not in the discovery report

**F1 — Destination and dates are *not* Premium-gated; sort and price/stars filters are.** `app/api/deals/route.ts:118–131` forces `minDiscount = 20`, `maxPriceCents`/`minStars` to `undefined` and `sort` to `newest` for free users, but `dateFrom`/`dateTo` and the city→`marketId` resolution (`:141–151`) are applied for everyone. Scoped search therefore works end-to-end for free users today. Any design that puts intent capture behind an upgrade prompt would be a regression against working behaviour — and it would sit directly beneath the disabled Premium `SearchBar`, compounding the confusion the ticket exists to remove.

**F2 — Scoping a search silently changes the empty-result contract.** `app/api/deals/route.ts:158–172`: when the query returns no rows **and** `hasFilters` is false, the API substitutes three mock deals. `hasFilters` is true whenever `city`, `date_from`, or `date_to` is present (`:132–139`). An unscoped arrival with an empty database sees a populated sample feed (`isColdSampleFeed` → `ColdSampleFeedIntro`, `DealFeed.tsx:1142`, `:1874`); the moment the user states any intent, the same database state renders as a hard empty. **Making search prominent will move users from "sample feed" to "zero results" without either state explaining the change.** This is the highest-risk regression in the feature and drives Directive D5.

---

## 2. Competitive teardown — interaction pattern only

Two references, chosen because each solves one half of the problem expaify has.

### Reference A — Google Flights: constrain the control to what the data supports

Google Flights does not let the user express a query it cannot answer and then explain the failure afterwards. The date picker renders prices *inside* the calendar cells; unsupported dates are visibly unavailable before they are clickable. Route coverage works the same way — the origin/destination fields are typeaheads over a closed served set, so an unserved airport cannot be committed. **The pattern: the input is the disclosure.** Constraint is expressed by what the control offers, not by an error after submit.

**Delta vs expaify:** expaify's date inputs are unconstrained `<input type="date">` over a data surface with roughly two live values. The disclosure ("Deals may have different check-out dates and stay lengths") sits after the fields, is about semantics rather than availability, and never tells the user which dates exist. The current design does the exact inverse of the reference.

### Reference B — Booking.com: never return a bare zero

Booking.com's out-of-coverage and zero-result states are always *named* and always offer a next action: it distinguishes "we don't have properties here" from "your filters excluded everything" from "these dates are sold out", and each carries a specific recovery (widen dates, drop a filter, see nearby areas). The search header stays mounted, pre-filled and editable, at the top of results — recovery never requires reopening a modal.

**Delta vs expaify:** expaify has a genuinely good coverage-boundary component (`ResultCoverageBoundary`, wired at `DealFeed.tsx:1836` and `:1863`) but it only distinguishes "filters active" from "no filters". It cannot say "Denver isn't covered", "that date isn't tracked", or "your search is scoped but the sample feed you saw was not". And recovery is an "Edit search" button that reopens the modal — the header itself is a read-only receipt (`HotelSearchCriteriaSummary`, `DealFeed.tsx:1486`).

### What expaify should *not* borrow

Booking.com's check-in/check-out + guests form shape. Copying it would promise stay-length and occupancy filtering that `HotelSearchCriteriaV1` cannot express and `getActiveDeals` cannot honour (`nights` is a constant `2`). Discovery constraint #2 stands and this research confirms it: familiarity here is a lie.

---

## 3. Answers to the four open questions

**(a) Homepage hero or persistent `/deals` header? — Persistent `/deals` header. Homepage unchanged.**
Both references keep an always-visible, pre-filled, editable search header on the results surface, and both treat the marketing entry as a link into it. The homepage is a conversion-optimized funnel with its own measured CTA (`/join`); inserting a form there is a hierarchy change discovery explicitly declined to make, and it buys nothing — no intent is lost by capturing one click later, because `/deals` is one click away from every homepage CTA. The whole problem is that intent capture on `/deals` is a *modal behind a receipt*; fixing that fixes the funnel without touching the marketing page. The header must be the primary affordance on `/deals`, above the `SearchBar`.

**(b) Reuse `HotelDestinationCombobox` or keep the `<select>`? — Do not mount the combobox. Keep the closed 20-item list.**
The combobox is well-built but is designed for the wrong data shape. Its contract (`HotelDestinationComboboxProps`, `HotelDestinationCombobox.tsx:41–53`) requires `suggestions`, a `lookupState` of `idle | too_short | loading | ready | empty | error`, `onQueryChange`, `onRetry`, and a `minimumCharacters` gate — i.e. an asynchronous remote destination-lookup service. **No such endpoint exists** (`app/api/` has no destination lookup; `lib/providers/hotellook.ts` is the dead API). Mounting it would mean either building that service — a DEV-stage feature well outside this ticket — or feeding it a static array of 20 strings, which reduces its six lookup states to two and turns a "type to search anywhere" affordance into a control that mostly renders `No destinations found for "Denver"`. A typeahead over 20 fixed values *invites* out-of-coverage input as its primary interaction. That is the opposite of the honest-coverage constraint. Keep the closed list; make coverage legible at the field (D3). Leave the combobox unmounted and record the decision — it becomes correct the day a destination-lookup provider exists.

**(c) Honest coverage-limit disclosure pattern? — At the input, Google Flights-style, for both axes; post-submit messaging is the fallback, not the mechanism.**
Coverage is a fixed, small, knowable set on both axes (20 cities; ~2–4 live check-in dates). Everything knowable before submit must be disclosed before submit: the destination control states the coverage count and shows the whole list; the date control offers only dates that exist. Booking.com-style post-submit naming (D5) then handles only what genuinely cannot be known in advance — a covered city and a tracked date that happen to have no active deal today.

**(d) Is "check-in window" the right user-facing label? — No, and the concept needs re-shaping, not just renaming.**
"Check-in window" is *accurate* — it is a range of acceptable arrival dates — but accuracy is not the failure. The failure is that it presents a continuous range over a data surface with two discrete values, so a correct label on the wrong control still produces zero results. The user-facing model should be **"check-in dates we're tracking"**: a choice among the dates that exist, not a range the user composes. `HotelSearchCriteriaV1.dates.semantic = 'checkin_window'` and the `dateFrom`/`dateTo` shape stay exactly as they are — a selected date maps to `dateFrom === dateTo` — so this is a control and copy change, not a schema change. Discovery's non-goal "no change to `HotelSearchCriteriaV1`'s schema semantics" is respected. Research owns the direction; Design owns final strings.

---

## 4. Design directives

Five directives. Each states what the current code does, what changes, and how it is tested.

---

### D1 — Intent capture becomes a persistent, pre-filled search header on `/deals`; the Premium `SearchBar` moves below it

**Current:** `HotelSearchCriteriaSummary` (`DealFeed.tsx:1486`) renders a read-only "Your search" card headed by an uppercase eyebrow, with "Edit" as an outline button; the visually dominant full-width `SearchBar` renders 67 lines further down (`:1553`) inside the hotels tab, above the filter pills.

**Change:** replace the read-only summary on `surface="results"` with an always-visible, always-editable search header containing the destination control and the date control inline, plus a single primary submit. It renders above the tab bar and above `SearchBar`, and stays mounted through loading, empty, and error states. The modal editor (`HotelSearchCriteriaEditor`) is retained **unchanged** for `surface="detail"`, which has no room for an inline header and where `HotelCriteriaMismatchAlert` already routes to it.

**Rules:**
- The header is the first interactive element in the hotels tab. `SearchBar` renders after it and after the filter pills, keeping its existing props, gating, and parse behaviour byte-for-byte (discovery constraint #4).
- The header carries a visible heading naming it as the search control; `SearchBar` must not be the only element on the page that reads as "search". `SearchBar`'s disabled free-tier state gets no visual promotion.
- Destination and dates are never disabled for free users. F1 confirms the server honours both regardless of tier.
- The header is pre-filled from the active criteria and is the recovery target from every empty/error state — "Edit search" buttons at `DealFeed.tsx:1849` and `:1866` become focus moves to the header, not modal opens, on the results surface.
- The existing `role="status"` "Updating results…" announcement and the `hotel_criteria_edit_started` / `_applied` / `_cancelled` events keep firing; on the results surface `entry_point` values `summary` and `empty_state` now describe header interactions rather than modal opens.

**Test:**
1. On `/deals` with no query string, a destination control and a date control are visible and enabled without any click, at 375px and 1280px, for a signed-out user.
2. Tab order from the top of the hotels tab reaches the destination control before the `SearchBar` input.
3. Submitting from the header updates the URL via `buildHotelResultsUrl` and the results without a full page load; `hotel_criteria_edit_applied` fires once.
4. `surface="detail"` still opens the modal editor and `HotelCriteriaMismatchAlert` still works.
5. `SearchBar`'s premium/disabled behaviour and placeholders are unchanged.

---

### D2 — The date control offers the check-in dates that exist; it never offers a free range the data cannot answer

**Current:** two unconstrained `<input type="date">` fields labelled "From"/"Through" (`HotelSearchCriteria.tsx:218`, `:223`) validated only by `isValidHotelDate`, which accepts any well-formed ISO date (`searchCriteria.ts:130`). Real `check_in_date` values are two monthly anchors (§1a).

**Change:** present check-in as a **choice among tracked check-in dates**, sourced from the distinct `check_in_date` values of currently active deals, plus an explicit "Any tracked date" default. Selecting a date sets `dateFrom === dateTo`. The `HotelSearchCriteriaV1.dates` shape is unchanged.

**Rules:**
- Copy names the model honestly. Directional, Design owns final strings: label "Check-in date", helper "We price a 2-night stay on the dates below. Check-out dates and stay lengths vary by deal." Do not ship "From"/"Through".
- The default is "Any tracked date" — no date filter, `semantic: 'missing'`. A user with no date preference must be able to submit destination alone in one action.
- **Required fallback if the tracked-date source is not available to the UI stage:** keep the two date inputs but (i) set `min` to today and `max` to today + 90 days on both, (ii) relabel away from From/Through, (iii) move the semantic disclaimer *above* the inputs, and (iv) state the tracked dates as visible helper text. A range control shipped without `min`/`max` fails this directive outright.
- Client-side validation gains an out-of-range check with a distinct message from the existing malformed-date message. `isValidHotelDate` itself must not change — it is shared with `resolveHotelSearchCriteria`, where tightening it would invalidate previously-shared URLs. Range checking is a separate, additive validation concern.
- The 90-day bound is derived from `getAnchorCheckInDate` reaching at most ~76 days out; do not hardcode 60.

**Test:**
1. A check-in date in the past cannot be committed from the UI: either it is not offered, or `min` rejects it and a specific message names the date as out of range.
2. A date beyond today + 90 days is likewise rejected with a specific message.
3. With no date chosen, submitting a destination alone succeeds and produces `dates.semantic === 'missing'`.
4. Where tracked dates are offered, selecting one produces `dateFrom === dateTo` and a URL that round-trips through `resolveHotelSearchCriteria` as `status: 'valid'`.
5. The stay-length disclaimer is readable before the user interacts with the date control, at 375px, with no overlapping text.

---

### D3 — Coverage is stated at the destination field, and off-coverage intent gets a named response and an event

**Current:** the `<select>` is the only disclosure of the 20-market list and requires opening the modal to read. A user wanting Denver produces no signal at all.

**Change:** the destination control states its own limits, and wanting an uncovered city becomes an expressible, measurable, answered action.

**Rules:**
- A persistent line at the destination control states the coverage explicitly and with the real number — directional: "We track hotel prices in 20 cities." It is visible without opening any menu.
- The full 20-city list is reachable from the header without leaving the page. Grouping by country (`TrackedMarket.country`) is available and preferred over an unordered list.
- An explicit off-coverage affordance — directional: "Don't see your city?" — reveals a single free-text field whose **only** effects are (i) `track('hotel_destination_offcoverage', { query })` and (ii) an honest inline response naming the limit and pointing to the covered list. It must not run a query, must not imply a future search will work, and must not promise an alert or notification. Discovery C5 puts this measurement addition in scope; expanding `TRACKED_MARKETS` remains out of scope.
- The default option keeps its current meaning ("All destinations" = all 20) and must not read as "anywhere".
- The `<select>` keeps its programmatic label, `aria-invalid`, and `aria-describedby` wiring (`HotelSearchCriteria.tsx:204–206`).
- `HotelDestinationCombobox` and `HotelDestinationSearchState` stay unmounted. Design should record the reuse decision so the question is not reopened without a destination-lookup provider.

**Test:**
1. A signed-out user on `/deals` can read the coverage count without opening any menu or modal, at 375px.
2. The 20 city names are reachable from the header in one interaction, without navigation.
3. Entering an uncovered city in the off-coverage field fires exactly one `hotel_destination_offcoverage` event and renders a message that names the limitation; the result feed does not change.
4. The off-coverage field never appears to be a working search — no spinner, no "no results" phrasing borrowed from the feed.

---

### D4 — No rejected submit is silent: the control stays operable, the reason is announced, the rejection is measured

**Current:** `disabled={!valid || !changed || submitting}` (`HotelSearchCriteria.tsx:238`) plus an early `return` in `submit()` (`:179`). Nothing renders, nothing fires. Discovery §3.3 is confirmed: the metric is structurally unobservable.

**Change:** the submit control is disabled **only** while a request is in flight (`submitting`). Invalid and unchanged submits are accepted by the handler, rejected explicitly, explained, and instrumented.

**Rules:**
- Rejection reasons are distinct and each has its own message: `invalid_destination`, `invalid_date`, `date_out_of_range` (new, from D2), `date_order`, `unchanged`.
- Every rejection fires `track('hotel_criteria_submit_rejected', { surface, criteria_version, entry_point, reason })` exactly once per submit.
- A form-level summary message renders in a `role="alert"` container and focus moves to the first offending control. The existing per-field `role="alert"` messages (`:211`, `:219`, `:224`) are retained; the summary must not duplicate them verbatim into the same live region twice.
- The "unchanged" case is guidance, not an error: it states that the results already reflect this search and does not use error styling or `aria-invalid`.
- `submitting` remains the sole disabling condition, so the in-flight double-submit guard is preserved.

**Test:**
1. Opening the search with no changes and pressing submit produces a visible message and exactly one `hotel_criteria_submit_rejected` event with `reason: 'unchanged'`.
2. A reversed range (`dateTo < dateFrom`) produces `reason: 'date_order'`, the existing order message, and focus on the first date control.
3. Every rejection reason is reachable through the UI and produces exactly one event.
4. A screen reader announces the summary once; no message is announced twice.
5. Submit is only ever disabled while a request is in flight.

---

### D5 — A scoped empty result is never indistinguishable from the sample feed

**Current:** `app/api/deals/route.ts:158–172` returns three mock deals when the query is empty **and** `hasFilters` is false; any of `city`/`date_from`/`date_to` flips `hasFilters` true (`:132–139`). `DealFeed.tsx:1142` derives `isColdSampleFeed` and renders `ColdSampleFeedIntro`. `ResultCoverageBoundary` distinguishes only "filters active" from "no filters" (`:1836`, `:1863`).

**Change:** the results surface names which part of the intent produced nothing, and never lets a state transition from sample feed to hard empty go unexplained.

**Rules:**
- The empty state distinguishes at minimum: **(a)** covered city + tracked date, no active deal right now; **(b)** date outside the tracked set; **(c)** view filters (discount/price/stars) excluding everything — already partly handled by `ResultCoverageBoundary`'s `activeFilters`/`recommendedFilterKey`.
- Each case offers one specific recovery that changes exactly one dimension — clear the date, widen to all destinations, clear the filter — not a generic "Edit search".
- When a user's first scoped search empties a feed that was previously showing sample deals, the empty state must acknowledge that the earlier list was a sample. Directional: "The deals you saw before were samples. Your search found no live deals in [city] right now." `ColdSampleFeedIntro` already establishes the sample framing; the empty state must not contradict it by implying live inventory disappeared.
- The existing `hotel_results_viewed` `result_state` values (`sample | empty | populated`, `DealFeed.tsx:1375`) are extended, not replaced, so the empty case carries which dimension was empty.
- Every recovery action is a real ≥44px control, reachable by keyboard, in DOM order after the message.

**Test:**
1. A search scoped to a covered city with no active deals renders a message naming that city and offering exactly one dimension-specific recovery — not the generic "Edit search" button alone.
2. Performing that search from a session that was showing the sample feed renders copy acknowledging the sample; the sample deals do not reappear beneath the empty message.
3. A search scoped to an untracked date renders a message about the date, not about the destination.
4. `hotel_results_viewed` carries a `result_state` distinguishing all three empty causes.
5. The empty state and its recovery controls are usable at 375px with no overlapping text and no horizontal scroll.

---

## 5. Priority and dependencies for Design

| Directive | Priority | Notes |
|---|---|---|
| D1 — persistent search header | **P0** | The root cause. D3 and D4 render inside it. |
| D2 — honest date control | **P0** | The largest source of unexplained empty results. Has a defined fallback if the tracked-date source is unavailable. |
| D5 — named empty states | **P0** | A regression guard: D1 + D2 will *increase* hard empties. Must ship in the same release. |
| D3 — coverage at the field | P1 | Independent of D2; can ship first. |
| D4 — visible, measured rejections | P1 | Small, self-contained, unblocks discovery metric C3. |

**Design must resolve before spec:** whether the tracked check-in dates are available to the client. If not, D2 ships its stated fallback and a `DEV-HOTEL-SEARCH-INTENT-01` ticket is warranted for the data source. That is a Design/UI-stage call on the actual props available at `DealFeed`, not a research question.

**Contract guards for downstream stages:**
- No change to `HotelSearchCriteriaV1`, `resolveHotelSearchCriteria`, `buildHotelResultsUrl`, or `isValidHotelDate` semantics. Previously shared URLs must keep resolving.
- No `TRACKED_MARKETS` expansion.
- No occupancy, room-count, stay-length, or property-type capture. Disclosure only.
- `SearchBar` parse behaviour and Premium gating unchanged; position and visual weight only.
- The `role="dialog"` focus trap in `HotelSearchCriteriaEditor` is preserved for `surface="detail"`.
- Destination and date capture stay ungated for free users (F1).

---

## 6. Handoff

Next stage: **UXDES-HOTEL-SEARCH-INTENT-01** — UX Design. Design owns final copy for every string marked directional above, plus all states from discovery constraint #3 (default, loading, empty, error, 375px, 1280px, focus/keyboard).

**Source files read for this brief:** `app/page.tsx`, `app/deals/page.tsx`, `app/deals/DealFeed.tsx`, `app/components/HotelSearchCriteria.tsx`, `app/components/ui/SearchBar.tsx`, `app/components/HotelDestinationCombobox.tsx`, `app/components/HotelDestinationSearchState.tsx`, `app/destinations/[city]/page.tsx`, `app/api/deals/route.ts`, `lib/hotels/searchCriteria.ts`, `lib/trackedMarkets.ts`, `lib/pipeline/snapshot.ts`, `lib/pipeline/dealDetection.ts`, `lib/pipeline/mock.ts`, `lib/analytics.ts`, `scripts/snapshot-job.ts`, `scripts/seed-snapshots.ts`, `app/globals.css`.
