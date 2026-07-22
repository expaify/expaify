# UXD-SEARCH-CRITERIA-SUMMARY-01: Active Hotel Search Criteria Clarity

Date: 2026-07-22  
Stage: UX Discovery  
Persona: Senior UX Strategist

## User Pain Point

A traveler browsing hotel results cannot reliably verify that the destination,
stay dates, guest count, and room count behind the options still match the trip
they intend to book, so a plausible hotel or price can carry them into detail or
provider handoff before they discover that the stay criteria are stale, different,
or were never captured.

## Who Is Affected And Where

The primary affected users are travelers for whom a criteria mismatch materially
changes availability or price:

- **First-time searchers** who need confirmation that expaify interpreted their
  destination and date language as intended before trusting the result set.
- **Travelers comparing multiple destinations or date windows** who are most
  likely to retain an earlier filter mentally while the visible results have
  already changed.
- **Couples, families, and groups** whose price and room eligibility depend on
  guest and room counts, particularly after the party size changes.
- **Returning and interrupted users** who cannot safely rely on memory to know
  whether the current results still represent the stay they started earlier.

The trust break spans two decision points:

1. **While scanning hotel results:** users need to know which active criteria
   govern the list before comparing nightly prices and Deal Score evidence.
2. **After opening hotel detail and before provider handoff:** users need to
   compare their intended criteria with the selected deal's stay facts before
   acting on a price.

## Current Implementation Evidence

The current product does not maintain one complete, durable hotel-search context
across these points:

- `app/deals/DealFeed.tsx` stores destination (`city`) and date bounds
  (`dateFrom`, `dateTo`) as local client state. It also stores price, star, and
  discount filters, but it has no guest-count or room-count state.
- Successful result views have no single persistent criteria summary. Destination
  can appear in a filter pill; dates entered through natural-language search can
  appear as chips inside `SearchBar`, but removable active-filter chips are
  otherwise rendered only in the filtered-empty state. The user must reconstruct
  what governs a populated grid from separate controls.
- `app/components/ui/SearchBar.tsx` owns its input and parsed-chip state separately
  from `DealFeed`. Clearing or changing criteria is therefore exposed through
  multiple controls rather than one authoritative trip summary.
- `lib/ai/dealSearchFilters.ts` can represent city and date bounds but has no
  adults, children, child ages, guests, or rooms fields. Guest and room criteria
  are not merely hidden; they are absent from the current search state.
- Result cards show each deal's `city` and `checkInWindow`. These are offer facts,
  not an explicit statement of the traveler's active criteria, so their presence
  cannot prove that guest/room assumptions match.
- Result-card links navigate to `/deals/[dealId]` with only the deal ID. The detail
  page derives check-in and check-out from the stored deal and explicitly displays
  `Guest count unavailable` and `Room or rate unavailable`; it receives no active
  search context to reconcile against those facts.
- Existing analytics cover clearing filters, removing filter chips, filtered
  empty views, cold-feed views, and stale-detail views. There is no instrumentation
  for criteria-summary exposure, criteria edits, detail opens under a criteria
  set, mismatch correction, repeated searches, or booking handoff after a date,
  guest, or room change.

The repair boundary is therefore twofold: destination/date state exists but loses
clarity and continuity, while guest/room state does not exist and must never be
implied as known. Downstream work must not label a provider or stored deal default
as the traveler's chosen party configuration.

## Measurable Signal

The problem exists today through directly auditable structural signals:

- **Criteria completeness:** zero guest-count and room-count fields in
  `DealSearchFilters` and zero corresponding state in `DealFeed`.
- **Results clarity:** no persistent, unified destination + dates + guests + rooms
  summary above a populated results list.
- **Cross-page continuity:** the result-to-detail URL carries a deal ID only, and
  hotel detail renders guest and room context as unavailable.
- **Observability:** zero events connect the active criteria set to a result view,
  detail view, edit, repeated search, or outbound provider action.

Once instrumented, the primary behavioral signal should be the rate of criteria
corrections made after a hotel detail view, segmented by which field changed.
Supporting signals are repeated searches within the same session, result-to-detail
backtracking after a mismatch, and provider-handoff abandonment following a date,
guest, or room correction. These signals must be interpreted as mismatch proxies,
not assumed proof of user confusion without qualitative validation.

## Constraints

1. **Preserve a compact, accessible mobile decision surface.** At 375px the active
   stay context and edit affordance must remain scannable without becoming a second
   full search form, pushing results out of reach, overlapping content, or hiding
   essential criteria behind color, truncation, or pointer-only interaction; the
   same context must remain usable at 1280px and by keyboard and assistive tech.
2. **Reuse one authoritative search state and preserve data truth.** Destination
   and dates must reflect the state that actually governs the results. Guest and
   room values may be shown as selected only after the product captures them; until
   then they must be explicitly unknown/not captured rather than inferred from a
   deal, provider default, flight passenger count, or price. Existing provider,
   `Result<T>`, and integer-minor-unit money contracts remain unchanged.
3. **Keep this a continuity repair, not a search expansion.** The scope is to help
   travelers detect and correct active-stay mismatches without restarting and to
   preserve that context into hotel detail. It must not add destination inventory,
   booking functionality, room merchandising, award travel, new price claims, or
   unrelated filters, and it must not weaken the existing price/freshness/Deal
   Score hierarchy.

## Success Statement

This is solved when a first-time traveler can scan hotel results, verify the active
destination, stay dates, guest count, and room count, correct a mismatch without
restarting, and then open hotel detail still able to distinguish those intended
criteria from the selected deal's known or unavailable stay facts before trusting
the price or leaving expaify.

## Downstream Research Brief

### Research Questions

1. At what moment do users verify destination, dates, guests, and rooms: before
   scanning prices, after selecting a hotel, or immediately before provider
   handoff, and which fields require persistent visibility at each moment?
2. Can users correctly distinguish **active search criteria** (their intent) from
   **deal stay facts** (what the stored offer reports), especially when the deal
   supplies dates but guest or room context is unavailable?
3. What is the minimum collapsed mobile summary that lets users detect a mismatch
   at 375px, and what progressive disclosure is acceptable without making the
   criteria effectively hidden?
4. Does a single edit entry point preserve orientation better than independent
   removable pills, and after an edit what feedback makes it clear that results
   were refreshed under the new criteria?
5. For the current absence of guest and room state, which truthful presentation
   best prevents false confidence, and what minimum intake is required before
   guest/room-dependent prices can be treated as relevant?
6. How should active criteria survive result-to-detail navigation, browser Back,
   refresh, destination pages with a fixed city, loading, empty, and error states
   without creating two competing sources of truth?

### Target Segments

- **First-time solo/couple searchers:** validate basic interpretation and whether
  a compact summary is noticed before price comparison.
- **Flexible-date or multi-destination shoppers:** test rapid criteria changes,
  stale-state detection, and orientation when returning from detail.
- **Families with children:** test whether adults, children/ages, and room count
  are understood as price/eligibility inputs rather than optional profile facts.
- **Groups needing multiple rooms:** test whether total guests and room allocation
  can be verified without mistaking a nightly “from” price for party-wide cost.
- **Returning/interrupted users:** test recognition of restored versus unavailable
  criteria without relying on session memory.

### Event Hypotheses

The research stage should validate the event semantics before implementation and
avoid treating event volume alone as evidence of success:

- `hotel_criteria_summary_viewed` with completeness flags and a non-PII criteria
  set/version will establish whether users were exposed to a verifiable summary.
- `hotel_criteria_edit_started` and `hotel_criteria_edit_applied`, carrying the
  changed field names (not raw free text), will reveal which mismatches are found
  and whether users complete corrections.
- `hotel_results_viewed` and `hotel_detail_viewed` linked to the same criteria-set
  version will test continuity and quantify edits that occur only after detail.
- `hotel_results_repeated_search` within a session should decline if corrections
  no longer require restarting; it must exclude deliberate comparison across
  materially different destinations or dates.
- `hotel_detail_returned_for_criteria_edit` should decline for accidental
  mismatches while intentional comparison remains stable.
- `hotel_provider_handoff_started` linked to the latest criteria-set version can
  test whether handoff abandonment after date/guest/room edits falls, without
  recording child ages or other unnecessary personal data.

Suggested outcome hypotheses for validation:

1. Users exposed to a complete, editable summary will make fewer repeated searches
   whose only change is destination/date/guest/room correction after detail.
2. The share of provider handoffs using a criteria-set version unchanged since the
   most recent detail view will rise, indicating earlier mismatch detection.
3. In comprehension testing, users will accurately identify when guest or room
   criteria are not captured and will not interpret `Guest count unavailable` as
   confirmation that the displayed rate covers their party.

## Handoff

Create `UXR-SEARCH-CRITERIA-SUMMARY-01` using this report
(`docs/pipeline/search-criteria-summary/01-discovery.md`) and the problem statement
above. Research must audit the exact state ownership and result-to-detail boundary,
compare one or two established hotel-search criteria-summary patterns at the
interaction level, and return 3–5 testable directives covering hierarchy, edit
behavior, missing guest/room state, mobile compression, cross-page continuity,
and analytics semantics.
