# UX Research Brief — Active Hotel Search Criteria Clarity

**Ticket:** UXR-SEARCH-CRITERIA-SUMMARY-01  
**Stage:** UXR (UX Research)  
**Date:** 2026-07-22  
**Upstream:** `docs/pipeline/search-criteria-summary/01-discovery.md`

## Executive finding

The proposed summary is necessary, but the current product does not yet have a
complete hotel-search criteria set to summarize. Destination and date bounds live
only in `DealFeed` client state; the natural-language query and parsed chips live
separately in `SearchBar`; guests and rooms are absent from the search type and
request; and detail receives only a deal ID. More importantly, the existing date
bounds are **a filter over offer check-in dates**, not the traveler's exact
check-in/check-out stay, while nightly snapshots are fetched under hidden provider
defaults of **2 adults and 1 room**.

The repair must therefore do two things in order:

1. expose one authoritative, durable statement of what the results actually use;
2. distinguish unsupported or uncaptured intent from offer facts and provider
   defaults, rather than filling gaps with plausible values.

The strongest reference pattern is not removable filter chips. It is an editable
trip-context summary that persists from results into property detail and is
restated beside prices that depend on that context.

## Method and evidence limits

This brief combines:

- a source audit of the current worktree;
- an interaction-pattern teardown of public Booking.com results/detail pages and
  official Google Hotels guidance;
- a heuristic assessment of the six discovery questions and event semantics.

No moderated or unmoderated user study was run in this ticket. Findings about the
current implementation and reference behavior are observed evidence. Claims
about when expaify users notice or correct a mismatch remain hypotheses and are
paired with test criteria below.

## Current implementation audit

### State ownership and applied-query path

| Concern | Current code evidence | Consequence |
|---|---|---|
| Applied results state | `DealFeed` owns `city`, `dateFrom`, `dateTo`, price, stars, discount, and sort in local `useState` (`app/deals/DealFeed.tsx:218-235`). `applyFilter` updates those values and immediately calls `/api/deals` (`:287-322`). | This is the closest thing to authoritative state, but it is memory-only and page-local. |
| Search interpretation | `SearchBar` separately owns `query` and `parsed` (`app/components/ui/SearchBar.tsx:12-16`). It renders chips from `parsed`, then passes the parse result upward (`:29-63`, `:73-83`). | Parsed chips can describe the last natural-language parse, not necessarily every later pill/sort change. There are two visible representations with different owners. |
| URL / refresh | `/deals` accepts no `searchParams` and renders `DealFeed` with server-fetched default deals (`app/deals/page.tsx:39-88`). Applied filters never update the URL. | Refresh reconstructs defaults, not the active search. A copied URL cannot reproduce the list. |
| Destination page | `/destinations/[city]` supplies `defaultCity` to `DealFeed`; the destination pill is then omitted (`app/destinations/[city]/page.tsx:99-109`; `DealFeed.tsx:463-483`). | The city is fixed in page context but is not part of a unified summary. Users must infer it from the page heading. |
| Guests / rooms | `DealSearchFilters` and its schema contain city, price, stars, discount, and date bounds only (`lib/ai/dealSearchFilters.ts:1-38`). `/api/deals` accepts no occupancy fields (`app/api/deals/route.ts:103-138`). | Guest and room intent is not hidden state; it is not captured or applied. |
| Loading / empty / error | The grid swaps to skeletons, a generic error, or an empty state (`app/deals/DealFeed.tsx:604-673`). Active chips appear only in the filtered-empty state (`:394-412`, `:638-654`). | The criteria governing loading and error are not persistently visible, and populated results have no unified confirmation. |

### Date semantics are not stay-date semantics

`date_from` and `date_to` are passed to `getActiveDeals`, where they become lower
and upper bounds on `d.check_in_date` (`lib/pipeline/dealDetection.ts:260-269`).
Each deal has its own `check_in_date` and `nights`; detail derives checkout by
adding the deal's nights (`app/deals/[dealId]/page.tsx:232-234`). Therefore a
natural-language input that looks like a stay range can currently return an offer
whose check-in falls inside that range but whose checkout does not equal the
user-entered end date.

**Research conclusion:** until the underlying semantics change, UI copy must call
these fields a **check-in window** (for example, `Check in Sep 10–13`), not `Stay
Sep 10–13`. Calling them stay dates would be a false continuity claim.

### Result-to-detail and provider-handoff boundary

- Result cards link to `/deals/${deal.id}` only
  (`app/deals/DealFeed.tsx:692-714`). The link carries no criteria or version.
- The detail page accepts only `params.dealId` (`app/deals/[dealId]/page.tsx:20,
  202-205`) and derives all displayed dates from the stored deal.
- The `Back to deals` links point to plain `/deals`, not browser history or a
  criteria-bearing URL (`app/deals/[dealId]/page.tsx:245-247`).
- Detail correctly labels offer fields under `Stay details` and says `Guest count
  unavailable` and `Room or rate unavailable` (`:403-415`), but it never shows
  the traveler's search intent beside those offer facts.
- `CompareRow` opens stored OTA URLs directly and has no click tracking or
  criteria check (`app/components/ui/CompareRow.tsx:21-57`).
- OTA links preserve hotel/destination and dates, but only Kiwi adds a hard-coded
  `adults=2`; none is built from captured occupancy
  (`lib/pipeline/otaLinks.ts:14-43`).

This boundary loses orientation in both directions: detail cannot say which
criteria produced the card, and Back/refresh cannot reconstruct the list.

### Hidden occupancy assumption behind prices

Nightly snapshot calls use `adults=2` and one room across the three acquisition
paths (`lib/pipeline/snapshot.ts:72-80`, `:106-115`, `:147-154`). Those defaults
are not stored in `DealRow`, shown on result cards, or represented as user intent.
The detail's `Guest count unavailable` is truthful about the stored deal shape,
but incomplete as price provenance: the displayed price was nevertheless sourced
under an acquisition-time occupancy assumption.

**Research conclusion:** expaify must not say that a current nightly price “matches
your party.” Until occupancy is captured, applied to the provider query, stored
with the offer, and carried into the handoff, the honest state is `Guests & rooms
not captured — confirm price for your party`.

### Analytics baseline

Existing events cover clear-all, chip removal, filtered empty, cold feed, and
stale detail (`DealFeed.tsx:339-348`, `:414-424`; detail `:253-260`). There are no
criteria-summary, apply, result/detail continuity, or handoff events. In addition,
`track()` only logs in development and has no production transport
(`lib/analytics.ts:1-7`). Event naming can be specified now, but outcome hypotheses
cannot be measured in production until analytics delivery exists.

## Reference pattern comparison

### Booking.com: persistent trip context plus rate-level restatement

Public Booking.com results expose destination, date range, and occupancy together
in the search block (for example, `2 adults · 1 child · 1 room`) above the result
set. Cards then restate the price basis as `3 nights, 2 adults, 1 child` and mark
rooms `Recommended for your group`. On property detail, the Availability section
again shows dates and occupancy immediately beside `Change search`, before the
room/rate choices.

Interaction rule: the trip context is editable at results, survives into detail,
and is repeated where the context changes price or eligibility. Search intent and
room facts are not collapsed into a single ambiguous label.

### Google Hotels: criteria controls at results and occupancy-specific booking

Google's official guidance says travelers can adjust dates or number of people at
the top of hotel results. Its booking-link documentation states that detail-page
booking links are for a specific check-in date and room occupancy. Google also
distinguishes explicit user-selected dates from default-date queries in its
analytics guidance, treating them as different levels of intent rather than
equivalent searches.

Interaction rule: dates and party size are result-defining controls, and a price
near provider handoff is tied to that context. Defaults must remain distinguishable
from explicit selection.

### Exact delta

| Dimension | Booking.com / Google pattern | expaify today | Delta |
|---|---|---|---|
| Results summary | Destination + dates + occupancy together | Fragments across heading, pills, and parsed chips | No single authoritative trip statement |
| Edit | One search/change-search entry point | Natural-language clear plus independent pills | Multiple controls with no shared draft/apply model |
| Price context | Party/stay context repeated near rate | Offer city/window only; hidden 2-adult/1-room acquisition default | Price can look relevant to an uncaptured party |
| Detail continuity | Criteria survive and remain editable | Deal ID only; detail shows offer facts only | Intent disappears at navigation |
| Return/refresh | Search state is reconstructable | plain `/deals`; local state resets | Interrupted and comparison flows are fragile |

The references are guidance, not a mandate to copy their full search forms. For
expaify's compact deal feed, the transferable pattern is **persistent context + a
single edit entry + criteria-specific price provenance**.

## Answers to the six research questions

### RQ1 — When must criteria be visible?

The current evidence does not establish a single user verification moment. The
references deliberately support three moments, so expaify should not bet the
repair on only one:

1. **Before price scanning:** destination, date semantics, and occupancy status
   must be visible above results because each changes relevance or price.
2. **After selecting a hotel:** detail must show active criteria separately from
   the deal's city/check-in/checkout/nights so a mismatch is diagnosable.
3. **Immediately before provider handoff:** the latest criteria version and any
   uncaptured occupancy warning must sit adjacent to provider actions.

Test hypothesis: at least 80% of first-time participants should correctly report
all four criteria/statuses from the results summary before opening a card, and
90% should do so from detail before choosing a provider.

### RQ2 — Can users distinguish intent from offer facts?

Not reliably today. Cards show `city` and `checkInWindow`, while detail labels a
section `Stay details`; neither surface identifies these as stored offer facts or
shows the active search beside them. The correct model is two explicitly titled
groups:

- **Your search:** user-selected or explicitly `Not captured` values.
- **This deal:** provider/stored hotel, area, check-in, check-out, nights, and
  price-basis facts, with unavailable fields left unavailable.

Comprehension fails if a participant says `Guest count unavailable` means the
price covers their group, or interprets a check-in filter window as exact stay
dates.

### RQ3 — Minimum 375px collapsed summary

The minimum is two scannable text rows plus one visible action, not a horizontal
carousel or ellipsis-only chip:

- row 1: destination + truthful date semantic (`Paris · Check in Sep 10–13`);
- row 2: explicit occupancy (`2 adults · 1 room`) **or**
  `Guests & rooms not captured`;
- trailing or next-row button: `Edit` (minimum 44px target, accessible name
  `Edit hotel search`).

Optional price/star/discount filters remain secondary and may sit below or behind
`Filters`; they must not displace the four trip-defining fields. Destination may
wrap; dates and missing-state copy must never be hidden by truncation. Expanded
content may expose children/ages and room allocation, but the collapsed row must
still show total party and room count or the missing state.

### RQ4 — Single edit entry and refresh feedback

A single `Edit` entry preserves orientation better than destructive independent
chips because it creates one draft and one apply boundary. Applying must be
atomic: keep the previous summary and results visible but inert, label the summary
`Updating results…`, then replace the list and announce `Results updated for
[destination], [date semantic], [occupancy status]` after a successful response.
On failure, keep the last successfully applied criteria/results and show retry;
never promote the failed draft to active state.

Independent price/star/discount filters may remain, but destination/date/occupancy
must share the criteria editor. Clearing a chip must not silently create an
“unknown” trip-defining value.

### RQ5 — Truthful missing guest/room handling and minimum intake

For the current contract, use `Guests & rooms not captured` with supporting copy
`Confirm the price and room fit for your party with the provider.` Do not show
`2 guests · 1 room`, `Default`, or `Any guests`; each could be read as an applied
choice.

Before occupancy-dependent prices can be called relevant, minimum intake is:

- adults (at least 1);
- children count and each child's age when children are included;
- room count (at least 1, not greater than total travelers without explanation);
- a provider request and stored offer that use the same values;
- a handoff URL or review step that preserves them.

Children's ages are operational search inputs but should not appear in analytics.
If backend/provider filtering is not implemented, the editor must not let users
“apply” guest/room values as though results were refreshed for them.

### RQ6 — Continuity through navigation and states

One serializable `HotelSearchCriteria` must own the applied state. A criteria
version changes only after a successful apply. Results, detail links, Back,
refresh, and destination pages must reconstruct that same version from a bounded,
validated URL representation or equivalent server-resolvable token; component
local state cannot be the durable source.

- **Result → detail:** carry the criteria reference/version; show `Your search`
  above `This deal`.
- **Browser Back:** restore the same URL criteria, result ordering, and preferably
  scroll position; a plain `/deals` reset is not acceptable.
- **Refresh/share:** reconstruct active criteria. If context is absent or invalid,
  say `Search criteria unavailable` rather than borrowing deal facts.
- **Fixed-city destination pages:** use the city as an explicit applied criterion
  with source `destination_page`; editing destination navigates to the resulting
  canonical search rather than maintaining a hidden override.
- **Loading:** retain the prior applied summary and label the update in progress.
- **Empty:** retain the criteria summary and offer `Edit search`; do not make users
  reverse-engineer removable chips.
- **Error:** retain last successful criteria/results, distinguish failed draft,
  and offer retry.

## Segment implications and validation coverage

| Segment | Highest-risk misunderstanding | Required task / pass signal |
|---|---|---|
| First-time solo/couple | Assumes a plausible nightly price uses their party | Before card open, identify whether guest/room input was captured; no participant may equate `not captured` with `2 adults`. |
| Flexible-date / multi-destination | Carries the prior city/window mentally after rapid edits | Alternate city and check-in window twice, open detail, Back, and name the active version correctly at every step. |
| Families | Treats children/ages as optional profile data | Explain that child ages can change eligibility/price; incomplete ages must block an occupancy-applied state. |
| Multi-room groups | Reads `/night` as the party/room total | Verify total travelers and room count; correctly state that current price scope is unconfirmed until the offer carries matching occupancy. |
| Returning/interrupted | Trusts stale memory after refresh or shared link | Refresh results and detail, then distinguish restored criteria from `Search criteria unavailable` without referring to memory. |

Recommended formative test: 10–12 participants, with at least two family and two
multi-room scenarios; include both 375px and desktop tasks. The directives below
should not be considered comprehension-validated until the missing-state and
intent-versus-offer questions meet the pass thresholds above.

## Event hypothesis review and analytics semantics

| Proposed event / outcome | Decision | Required semantics |
|---|---|---|
| `hotel_criteria_summary_viewed` | **Keep, narrow** | Fire once per `criteria_version` per surface after the summary is rendered. Props: `surface`, `criteria_version`, `destination_present`, `date_state` (`exact_stay`, `checkin_window`, `missing`), `occupancy_state` (`applied`, `not_captured`), `room_state`, `criteria_source`. Exposure is not comprehension. |
| `hotel_criteria_edit_started` | **Keep** | Fire once when the editor opens. Include `surface`, `criteria_version`, `entry_point`; no raw destination/query or ages. Add `hotel_criteria_edit_cancelled` to separate abandonment from browsing. |
| `hotel_criteria_edit_applied` | **Keep, success-gate** | Fire only after the results request succeeds and the applied version changes. Include sorted `changed_fields`, `previous_version`, `criteria_version`, `result_count_bucket`; never fire on draft change or failed response. |
| `hotel_results_viewed` / `hotel_detail_viewed` | **Keep** | Both carry the same version/reference. Results fires after success with `result_state`; detail also carries `context_status` (`matched`, `missing`, `invalid`) and `deal_id`. |
| `hotel_results_repeated_search` | **Derive, do not emit as a raw UI event** | Define as a new top-level search started after a results view in the same session, not an in-place Edit. Exclude destination/date changes marked `comparison_intent`; report separately from correction edits. Event volume alone cannot distinguish confusion from exploration. |
| `hotel_detail_returned_for_criteria_edit` | **Revise** | Derive from detail → results navigation followed by Edit before another detail/handoff. Preserve `return_method` and changed fields. A decline is not automatically good; it may mean weaker mismatch detection. |
| `hotel_provider_handoff_started` | **Rename to `hotel_provider_handoff_clicked`** | Fire on an eligible provider-link activation with provider, deal ID, latest criteria version, context status, and completeness flags. A click proves handoff intent, not provider arrival or booking. Do not call post-click loss “handoff abandonment” without provider callback/return instrumentation. |
| “Unchanged version at handoff rises” | **Use only with comprehension** | Unchanged can mean early confidence or an unnoticed mismatch. Pair with task accuracy and `context_status`; do not treat it as a standalone success metric. |

Privacy rule: criteria versions must be opaque non-PII identifiers. Do not send raw
natural-language queries, child ages, free-text destinations, or room assignments.
Use enums, presence flags, changed-field names, and coarse count buckets.

## Design directives for UXDES

### D1 — Define one truthful, versioned criteria contract before designing the summary

Specify a serializable `HotelSearchCriteria` with destination, date semantic
(`exact_stay | checkin_window | missing`), check-in/check-out or window bounds,
adults/children/rooms with explicit capture states, source, and `criteriaVersion`.
Only successfully applied values become active. Current `date_from/date_to` must
render as `Check in [range]`, and current guests/rooms must render as not captured.

**Acceptance:** refresh, detail, and Back reconstruct the same displayed values;
no summary labels the current date filter as exact stay dates or hidden provider
defaults as user selections.

### D2 — Make trip context primary and filters secondary at results

Place the summary after the results heading and before search/filter/sort controls
and the grid. At 375px its collapsed form is exactly the two-row pattern in RQ3
with a visible `Edit` action. At desktop it may fit on one row but must retain the
same reading order. Price/star/discount are secondary filters, not peers of
destination/date/occupancy.

**Acceptance:** at 375px all four criteria/statuses and Edit are visible without
horizontal scrolling, overlap, ellipsis-only meaning, or expanding a drawer.

### D3 — Use one atomic editor and preserve the last successful state

`Edit` opens one destination/date/occupancy draft. Apply triggers one refresh;
loading keeps the old summary with `Updating results…`; success updates summary,
list, URL/version, and an `aria-live` confirmation together; error keeps the last
successful version and offers Retry. Until occupancy is genuinely queryable, show
it as `Not captured` and do not offer a false Apply path for guest/room values.

**Acceptance:** rapid edits cannot show a new summary over old results; a failed
request never changes the active criteria version.

### D4 — Preserve and compare context across detail and handoff

Carry the criteria reference in every result-detail link. On detail, render `Your
search` (editable) before a separate `This deal` facts section. Keep the latest
summary immediately above provider links. If context is missing, say `Search
criteria unavailable`; if exact selected dates conflict with deal facts, show a
plain mismatch and require correction/review before handoff. Back returns to the
criteria-bearing results location, not plain `/deals`.

**Acceptance:** users can state which values are theirs and which came from the
deal; no unavailable guest/room value is presented as confirmed price coverage.

### D5 — Instrument versions and outcomes with the reviewed semantics

Implement the kept/revised events in the table above, success-gate Apply, and use
opaque versions plus completeness enums. Treat repeated search and return-to-edit
as derived sequences. Use `hotel_provider_handoff_clicked`, not “started,” and do
not claim provider abandonment from an outbound click.

**Acceptance:** one session trace can connect summary → edit/apply → results →
detail → handoff to a criteria version without containing raw query text or child
ages, and failed drafts do not contaminate the applied sequence.

## Blockers and out-of-scope findings

- **Blocking contract clarification for UXDES:** current dates are check-in-window
  filters, not exact stay dates. UXDES must use the truthful label or explicitly
  scope a DEV change that introduces exact check-in/check-out semantics.
- **Blocking data dependency for “party-relevant” prices:** current snapshots use
  hard-coded 2-adult/1-room provider requests. Guest/room selection cannot be
  presented as applied until the provider query, stored offer, and deeplink use
  the same occupancy.
- **Measurement blocker:** `lib/analytics.ts` has no production transport. Event
  contracts can be designed, but behavioral outcomes cannot be validated until
  delivery/sessionization exists.
- **Out of scope contract risk:** `lib/pipeline/snapshot.ts` calls external hotel
  APIs directly rather than through `lib/providers`, contrary to the stated
  provider boundary. This brief does not repair it, but occupancy work must not
  extend that bypass.
- **Out of scope affiliate/config risk:** hotel OTA links use env names beyond the
  briefing's `HOTEL_AFFILIATE_ID`, and missing IDs can yield unmarked outbound
  links. This ticket makes no link changes; DEV should audit separately before
  handoff instrumentation is treated as trustworthy.

## Sources

- [Booking.com hotel results example — criteria summary and party-specific cards](https://www.booking.com/searchresults.html?dest_id=-3236099&dest_type=city&lang=en-us&sb=1&src_elem=sb)
- [Booking.com property detail example — dates, occupancy, Change search, and room fit](https://www.booking.com/hotel/ph/melad.html)
- [Google Travel Help — search for hotels and adjust dates or party size](https://support.google.com/travel/answer/6276008?hl=en-GB)
- [Google Ads Help — hotel results, occupancy filters, detail, and booking links](https://support.google.com/google-ads/answer/9238462?hl=en)
- [Google Travel Analytics Help — explicit dates versus default-date queries](https://support.google.com/travelanalytics/answer/11225980?hl=en)

## Handoff

Create `UXDES-SEARCH-CRITERIA-SUMMARY-01` to specify the authoritative criteria
contract and every results/detail state, using the five directives above. The
design must resolve the check-in-window terminology and retain truthful
guest/room absence unless matching provider and stored-offer support is included
in a later DEV scope.
