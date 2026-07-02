# UXR-RESULTS-SORT-FILTER-01: Sort and Stops Filter Discoverability

## Source Inputs

- Discovery: `docs/pipeline/results-sort-filter/01-discovery.md`
- Current UI: `components/flights/FlightResults.tsx`
- State and URL contract: `app/page.tsx`
- Shared control styling: `app/globals.css`

## Research Summary

The Sort and Stops controls are implemented and wired correctly, but the current results surface gives them the visual weight of secondary metadata. First-time users are likely to scan the three summary cards first, then the fare cards, and miss that sorting and stop filtering are active controls.

This is a hierarchy and affordance issue, not a data or business-logic issue. The next design stage should promote result refinement to a primary toolbar pattern while preserving the current client-side contract: `sortBy` remains `deal | price`, `filterStops` remains `null | 0 | 1`, filtering happens before sorting, and query params continue to reflect valid choices.

## Current Implementation Audit

### What Works

- `app/page.tsx` encodes URL state correctly: default deal sorting is omitted from the URL, `sort=price` is persisted when selected, and `stops=0|1` is persisted when a stops filter is active (`app/page.tsx:176-188`).
- URL parsing rejects invalid sort and stops values with user-facing errors instead of silently accepting bad state (`app/page.tsx:191-212`).
- Sort and stops updates call `syncUrl`, so user changes are reflected in the current shareable search URL (`app/page.tsx:683-690`, `app/page.tsx:907-920`).
- Filtering occurs before sorting, which is the expected interaction contract for a results list (`app/page.tsx:932-950`).
- The controls expose `aria-pressed`, have native button semantics, are keyboard reachable, and share an `aria-describedby` live summary (`components/flights/FlightResults.tsx:270-318`).
- When a stops filter hides every fare, the empty state explains the cause and offers a direct "Show all stops" recovery action (`components/flights/FlightResults.tsx:156-186`).

### What Breaks Discoverability

- The control area appears only after three metric cards: Lowest live fare, Great deals, and Nonstop options (`components/flights/FlightResults.tsx:231-267`). Those cards have larger numeric typography and card framing, so they compete as the primary content of the summary panel.
- The only visible group names are compact legends, "Sort" and "Stops", rendered as small uppercase text (`components/flights/FlightResults.tsx:270-293`). They do not establish a clear "Refine results" task area.
- The result count sits as a separate passive badge to the right of the control groups (`components/flights/FlightResults.tsx:313-315`), so the user sees summary data and controls in the same visual language.
- The selected state adds an "On" chip inside compact pills (`components/flights/FlightResults.tsx:283-307`). This is technically clear after inspection, but it increases button density on mobile and may read as status text rather than a selected segmented-control state.
- The shared `.btn-pill` style is intentionally compact and metadata-like: rounded pill, small type, muted border, muted foreground, and no toolbar container semantics (`app/globals.css:260-305`).
- During loading, the same panel can render while `flights.length === 0`, but controls are disabled and the summary says controls will be available after fares load (`components/flights/FlightResults.tsx:159-162`, `components/flights/FlightResults.tsx:231-318`). This previews the controls, but disabled controls under metric cards are still unlikely to become the user's first mental model for result refinement.

## Reference Pattern Comparison

### Booking.com-Style Results Pattern

High-volume travel result pages typically place sorting and filtering at the top of the result set as a task toolbar, separate from deal-summary content. Filters are framed as the primary way to narrow the list, while result counts confirm scope. On mobile, filters are often collapsed into a prominent control row or drawer entry, with sort nearby and immediately reachable.

Delta for expaify: current controls live inside a summary/statistics card and follow stronger metric cards. The result refinement task is present, but it is not the first actionable element in the results list.

### Google Flights-Style Results Pattern

Flight search surfaces typically keep route/date context and result refinement close to the top of the list. Sort and filter affordances are presented as list tools, not as analytics. Selected filters are visible as active chips or selected segmented states, and changes update the list without implying a new provider fetch.

Delta for expaify: the existing no-refetch behavior is correct, but the controls do not yet have a strong toolbar identity. The UI should make "change ranking" and "narrow by stops" feel like list operations that act on the returned fares.

## Exact Gap

- Current code: results summary card first emphasizes "Lowest live fare", "Great deals", and "Nonstop options", then shows small pill controls and a result count.
- Reference pattern: result tools are a primary toolbar directly attached to the list, with clear labels, selected state, and count/status text that supports the action rather than competing with it.
- Required delta: promote Sort and Stops above or alongside result count as a "Refine results" toolbar, demote metric cards to secondary context, and keep state changes client-side with the existing URL contract.

## Testable Design Directives

1. Put a result-tools header before metric cards and fare cards.
   - Required visible label: "Refine flight results".
   - Required supporting status: "Showing X of Y fares" when fares exist.
   - The first interactive controls after results load must be Sort and Stops, not metric cards.

2. Render Sort as a segmented two-option control, not passive pills.
   - Options must remain exactly "Best deal" and "Lowest price".
   - Selected state must be visually obvious without relying on the word "On".
   - Each option must remain a native button with `aria-pressed`.

3. Render Stops as a separate filter group with three choices.
   - Options must remain exactly "All stops", "Nonstop", and "1 stop".
   - If a selected stops filter hides every fare, keep the current recovery path: explanatory empty state plus "Show all stops".
   - Do not add multi-select, 2+ stops, airlines, times, price sliders, or any new filter surface in this ticket.

4. Preserve and clarify status messaging.
   - Keep an `aria-live="polite"` summary for result count, selected sort, selected stops, and ranking updates.
   - When deal ranking is still updating, keep the message "Updating deal ranking as scores finish." or equivalent copy with the same meaning.
   - Do not imply sort/filter causes a new provider search; changes act only on returned fares.

5. Mobile and desktop hierarchy must be explicit.
   - At 375px, Sort and Stops must be visible before the first fare card and must not require horizontal scrolling.
   - At 1280px, the result count, Sort, and Stops should read as one toolbar row above the list; metric cards may sit below or be visually secondary.
   - Button text must not truncate for "Lowest price" or "All stops" at 375px.

## Acceptance Checks for UXDES

- The design spec covers default, loading, empty due to no fares, empty due to filters hiding fares, error/provider notice, mobile 375px, desktop 1280px, keyboard focus, and score-ranking-updating states.
- The spec preserves `sortBy: 'deal' | 'price'` and `filterStops: null | 0 | 1`.
- The spec does not require API, provider, scoring, or data model changes.
- The spec uses existing tokens from `app/globals.css`, especially `--bg-base`, `--bg-surface`, `--bg-raised`, `--border`, `--border-strong`, `--border-hover`, `--brand`, `--brand-soft`, `--text-1`, `--text-2`, and `--text-3`.
- The spec makes the controls discoverable before users inspect individual fare cards.

## Handoff

Create `UXDES-RESULTS-SORT-FILTER-01` for implementation-ready interaction and visual design of the promoted result toolbar.
