# UXDES-RESULTS-TAB-INVENTORY-AWARENESS-01: Results Tab Inventory Awareness Design Spec

## Inputs Read

- Discovery: `docs/pipeline/results-tab-inventory-awareness/01-discovery.md`
- Research: `docs/pipeline/results-tab-inventory-awareness/02-research.md`
- Current implementation references: `app/page.tsx`, `components/flights/FlightResults.tsx`, `app/api/search/route.ts`, `lib/types.ts`, `app/globals.css`

## Problem To Solve

Users reviewing one results tab need a persistent, trustworthy answer for the other inventory type: is it checking, available, empty, unavailable, or not checked?

## Scope

This is a UI-layer specification for the parent results surface in `app/page.tsx`.

In scope:
- Shared inventory status vocabulary for Flights and Hotels.
- Tab badge copy and tab accessibility labels.
- Top results summary copy.
- Inactive-tab helper copy.
- Loading, empty, error, mobile, desktop, focus, keyboard, and edge-case behavior.

Out of scope:
- New provider calls.
- API contract changes.
- Flight or hotel card redesign.
- Scoring changes.
- Booking flow changes.

## Status Vocabulary

Use one shared user-facing vocabulary for both inventory types.

| Internal status | User badge | Summary phrase | Meaning |
| --- | --- | --- | --- |
| `checking` | `Checking` | `Flights checking` / `Hotels checking` | Provider results for that inventory may still arrive. |
| `available` | `{N}` | `{N} flight(s)` / `{N} hotel(s)` | At least one result is present. |
| `empty` | `None` | `No flights returned` / `No hotels returned` | Search completed and provider returned no inventory. |
| `unavailable` | `Issue` | `Flights unavailable` / `Hotels unavailable` | Provider failed, was unavailable, or returned malformed data, so inventory was not confirmed. |
| `not_checked` | `Not checked` | `Flights not checked` / `Hotels not checked` | Search did not include this inventory or required trip details were missing. |

Do not expose `idle`, `skipped`, `no_supply`, or `malformed_response` directly to users.

## Status Derivation Rules

### Flights

Derive parent-level flight inventory status from existing client state only:

1. `checking`
   - `isSearching === true`
   - and `searchIntent !== 'hotels'`
   - and `flights.length === 0`

2. `available`
   - `flights.length > 0`

3. `unavailable`
   - search is complete
   - `flights.length === 0`
   - and at least one non-hotel `providerNotices` item has `status === 'unavailable'` or `status === 'malformed_response'`
   - and there is no successful flight inventory returned

4. `empty`
   - search is complete
   - `flights.length === 0`
   - and no unavailable or malformed flight provider notice is present
   - a `no_supply` notice maps to `empty`, not `unavailable`

5. `not_checked`
   - `searchIntent === 'hotels'`
   - or the submitted search could not include flights because required route details were absent

### Hotels

Derive parent-level hotel inventory status from `hotelAvailability`, `hotels.length`, `searchIntent`, and required stay details:

1. `checking`
   - `isSearching === true`
   - and `searchIntent !== 'flights'`
   - and `hotelAvailability === 'loading'`

2. `available`
   - `hotels.length > 0`

3. `empty`
   - `hotelAvailability === 'empty'`
   - and `hotels.length === 0`

4. `unavailable`
   - `hotelAvailability === 'unavailable'`
   - and `hotels.length === 0`

5. `not_checked`
   - `hotelAvailability === 'skipped'`
   - or `searchIntent === 'flights'`
   - or destination, departure date, return date, or round-trip stay details are missing

If status and count disagree, count wins only for `available`: any `flights.length > 0` or `hotels.length > 0` must render as available with the count.

## Information Hierarchy

Primary:
- The active result type and the route in the top summary.
- The tab-level inventory status for Flights and Hotels.

Secondary:
- Traveler count.
- Great-deal count.
- Inactive-tab helper with next action guidance.

Tertiary:
- Provider detail messages.
- Search context line.
- Recovery explanation inside empty or unavailable panels.

The tab bar must be understandable before the user reads cards or state panels.

## Top Summary Copy

The top summary has two lines when there is no page-level error.

Line 1:
- Keep current structure: `{Search intent label} · {routeLabel || 'Anywhere'}`

Line 2:
- Replace raw counts with status-aware copy:
  - `{flightSummary} · {hotelSummary} · {travelerSummary}`

Flight summary copy:
- `checking`: `Flights checking`
- `available`: `1 flight` or `{N} flights`
- `empty`: `No flights returned`
- `unavailable`: `Flights unavailable`
- `not_checked`: `Flights not checked`

Hotel summary copy:
- `checking`: `Hotels checking`
- `available`: `1 hotel` or `{N} hotels`
- `empty`: `No hotels returned`
- `unavailable`: `Hotels unavailable`
- `not_checked`: `Hotels not checked`

Required examples:
- `Flights checking · Hotels checking · 1 traveler`
- `3 flights · Hotels checking · 2 travelers`
- `3 flights · No hotels returned · 2 travelers`
- `Flights unavailable · Hotels not checked · 1 traveler`
- `No flights returned · 4 hotels · 2 travelers`

Never render `0 flights` or `0 hotels` in the top summary.

When there is a page-level search error, keep the existing `Search needs attention` pattern and show `resultContext` as secondary copy.

## Tab Bar Design

Render both tabs as stable-width buttons in a `tablist` or as buttons with equivalent labels. Prefer native tab semantics:

- Container: `role="tablist" aria-label="Search result inventory"`
- Each tab: `role="tab" aria-selected={active} aria-controls={panelId} id={tabId}`
- Each panel: `role="tabpanel" aria-labelledby={tabId} id={panelId}`

If button semantics are retained instead, each tab must include an explicit `aria-label`:
- `Flights tab, 3 flights available`
- `Flights tab, no flights returned`
- `Flights tab, flights unavailable`
- `Flights tab, flights checking`
- `Hotels tab, hotels not checked, add departure and return dates`

Visible tab structure:
- First line: `Flights` or `Hotels`
- Second inline badge: status badge
- Active indicator: bottom border using `var(--brand)` or existing `indigo-400`

Badge copy:
- `checking`: `Checking`
- `available`: `{N}`
- `empty`: `None`
- `unavailable`: `Issue`
- `not_checked`: `Not checked`

Disabled behavior:
- Disable only `not_checked` tabs.
- `empty` and `unavailable` tabs must stay enabled and keyboard reachable.
- If the active tab becomes `not_checked`, leave it visible but move active tab to the nearest available checked inventory after the next user action or search completion.

## Inactive-Tab Helper

Show one helper below the tab bar only when the inactive tab status is not `available`.

Visibility rules:
- Active Flights tab: helper describes Hotels when hotel status is `checking`, `empty`, `unavailable`, or `not_checked`.
- Active Hotels tab: helper describes Flights when flight status is `checking`, `empty`, `unavailable`, or `not_checked`.
- Do not show helper for inactive `available` status.
- Do not show helper when a page-level search error is active.

Helper title and body copy:

| Inventory | Status | Title | Body |
| --- | --- | --- | --- |
| Flights | `checking` | `Flights are still checking` | `You can keep reviewing hotels while flight availability finishes.` |
| Flights | `empty` | `No flights returned` | `No flights were returned for this route. Edit the route, dates, or flexibility options.` |
| Flights | `unavailable` | `Flights unavailable` | `Flight inventory was not confirmed because a provider is unavailable. Retry this search or edit trip details.` |
| Flights | `not_checked` | `Flights not checked` | `Choose a flight or flight + hotel search to check flight availability.` |
| Hotels | `checking` | `Hotels are still checking` | `You can keep reviewing flights while hotel availability finishes.` |
| Hotels | `empty` | `No hotels returned` | `No hotels were returned for these dates. Change dates or broaden the stay area.` |
| Hotels | `unavailable` | `Hotels unavailable` | `Hotel inventory was not confirmed because the provider is unavailable. Retry this search or edit trip details.` |
| Hotels | `not_checked` | `Hotels not checked` | Exact missing-requirement copy from the rules below. |

Hotel `not_checked` body copy:
- Missing destination: `Add a destination to check hotel availability.`
- Missing departure date or return date, or one-way trip selected: `Add departure and return dates to check hotel availability.`
- Search intent excluded hotels: `Choose a hotel or flight + hotel search to check hotel availability.`
- Fallback: `Hotel availability was not checked for this search.`

Helper action rules:
- `checking`: no button.
- `empty`: primary action edits the relevant date or route field.
- `unavailable`: primary action `Retry search`, secondary action `Edit search`.
- `not_checked`: primary action `Edit search`.

## Active Panel States

### Flights Panel

Default with results:
- Show existing `FlightResults` list and controls.

Loading:
- If `flightStatus === 'checking'`, keep existing flight loading state.
- Tab badge must read `Checking` until flights arrive or search completes.

Empty:
- If `flightStatus === 'empty'`, show the existing no-results recovery panel.
- Panel title should align with summary: `No flights returned`.
- A `no_supply` provider notice must not produce provider-failure copy.

Unavailable:
- If `flightStatus === 'unavailable'`, show warning tone.
- Copy: `Flight inventory was not confirmed because a provider is unavailable. Retry this search or edit trip details.`
- Actions: `Retry search`, `Edit search`.

Not checked:
- If reachable, show a default tone panel.
- Copy: `Choose a flight or flight + hotel search to check flight availability.`
- Action: `Edit search`.

### Hotels Panel

Default with results:
- Show existing hotel card grid.

Loading:
- Keep skeleton grid.
- Tab badge must read `Checking`.

Empty:
- Keep enabled tab.
- Title: `No hotels returned`.
- Body: `No hotels were returned for these dates. Change dates or broaden the stay area.`
- Actions: `Change dates`, `Search hotels nearby`, `Edit search`.

Unavailable:
- Keep enabled tab.
- Warning tone.
- Title: `Hotels unavailable`.
- Body: `Hotel inventory was not confirmed because the provider is unavailable. Retry this search or edit trip details.`
- Actions: `Retry search`, `Edit search`.
- Provider detail may appear as tertiary copy below the body.

Not checked:
- Disabled only when inactive.
- If active through a shared URL or stale state, show the existing detail-needed panel.
- Title depends on missing data:
  - Missing destination: `Hotel destination needed`
  - Missing dates or one-way trip: `Hotel dates needed`
  - Search intent excluded hotels: `Hotels not checked`
- Action: `Edit search`.

## Error State

For page-level search errors:
- Hide tab helpers.
- Keep tabs visible only if there are existing results from the interrupted search.
- Summary title: `Search needs attention`.
- Secondary copy: existing `resultContext`.
- Do not convert page-level errors into inventory-specific `Issue` badges unless provider-specific notices exist.

## Responsive Layout

### Mobile 375px

Tab bar:
- Full-width horizontal row with two equal columns.
- No critical status text may require horizontal scrolling.
- Each tab uses a two-line layout:
  - Line 1: inventory label, `text-sm font-bold`
  - Line 2: badge, `text-[11px] font-bold`
- Minimum tap target: `min-h-14`.
- Badge text must wrap only as a whole phrase; `Not checked` may sit on one badge line due to two-tab layout.

Summary:
- Keep top summary in a vertical stack.
- Line 2 may wrap at separators, but `No hotels returned`, `Flights unavailable`, and `Hotels not checked` must remain readable.

Helper:
- Full width below tabs.
- Button actions stack vertically.

Panels:
- Existing single-column result grids remain.
- State panels use compact padding and no nested cards.

### Desktop 1280px

Tab bar:
- Tabs may size to content or use two compact columns.
- Keep active indicator aligned under the active tab.
- Badge sits inline to the right of label unless implementation chooses the same two-line pattern for consistency.

Summary:
- Top row uses existing flex layout with share button aligned right.
- Summary copy must not be truncated before status phrases.

Helper:
- Full-width band below tabs with max text width.
- Actions align right when present.

Panels:
- Existing result grids and controls remain unchanged.

## Focus And Keyboard Behavior

Keyboard:
- `Tab` reaches the tablist from the summary/share area.
- `Enter` or `Space` activates a focused enabled tab.
- If native tab semantics are implemented, `ArrowLeft` and `ArrowRight` move focus between enabled tabs and activate on `Enter` or `Space`.
- Disabled `not_checked` inactive tabs are skipped by tab order through `disabled`.
- Empty and unavailable tabs are never disabled and must be keyboard reachable.

Focus:
- Use existing global focus tokens: `:focus-visible`, `var(--focus-outline)`, and `var(--focus-ring)`.
- Active tab has both visible active indicator and `aria-selected="true"`.
- On tab activation, focus remains on the selected tab. Do not force focus into the panel.

Live region:
- Add one polite live region near the tab bar.
- Announce only meaningful inventory transitions:
  - `Hotels checking`
  - `3 hotels available`
  - `No hotels returned`
  - `Hotels unavailable`
  - `Hotels not checked`
  - Equivalent flight messages.
- Do not announce every streamed card or score update.

## Tailwind And Token Patterns

Use existing tokens from `app/globals.css`; do not introduce new colors.

Tab container:
- `mb-6 grid grid-cols-2 border-b border-white/8 sm:flex sm:overflow-x-auto`

Tab button base:
- `relative min-h-14 px-3 py-3 text-left text-sm font-bold transition-colors focus-visible:outline-none sm:min-h-11 sm:px-5`

Enabled inactive:
- `text-gray-500 hover:text-gray-300`

Active:
- `text-gray-100`

Disabled:
- `cursor-not-allowed text-gray-700`

Active indicator:
- `absolute bottom-0 left-3 right-3 h-0.5 rounded-t-full bg-indigo-400`

Badge base:
- `mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-bold sm:ml-2 sm:mt-0`

Badge status tones:
- `checking`: `bg-[var(--brand-soft)] text-indigo-300`
- `available`: active `bg-indigo-500/20 text-indigo-300`, inactive `bg-white/5 text-gray-500`
- `empty`: `bg-white/5 text-gray-400`
- `unavailable`: `bg-[var(--warning-soft)] text-amber-300`
- `not_checked`: `bg-white/[0.03] text-gray-600`

Helper base:
- `mb-6 rounded-[var(--radius-card)] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-gray-500`

Helper title:
- `font-semibold text-gray-300`

Helper actions:
- Mobile: `mt-3 grid gap-2`
- Desktop: `sm:flex sm:flex-wrap sm:items-center`
- Buttons use existing `btn-primary` and `btn-pill`.

State panels:
- Continue using `ResultsStatePanel` patterns.
- Warning tone uses `var(--warning)` and `var(--warning-soft)`.
- Default tone uses `var(--bg-surface)`, `var(--border)`, and `var(--text-2)`.

## Edge Cases

- Flight + hotel search where hotels are still loading and flights are available: Flights tab badge `{N}`, Hotels tab badge `Checking`, summary `{N} flights · Hotels checking`.
- Hotels arrive before flights: Hotels tab badge `{N}`, Flights tab badge `Checking`, summary `Flights checking · {N} hotels`.
- Flights have zero results with only `no_supply`: Flights badge `None`, summary `No flights returned`.
- Flights have zero results with provider unavailable or malformed response: Flights badge `Issue`, summary `Flights unavailable`.
- Hotels skipped because one-way trip: Hotels badge `Not checked`, disabled only when inactive, helper says `Add departure and return dates to check hotel availability.`
- Hotels skipped because search intent is flights-only: Hotels badge `Not checked`, helper says `Choose a hotel or flight + hotel search to check hotel availability.`
- Shared URL opens `tab=hotels` but hotels are not checked: show the hotels not-checked panel and keep the tab visible; the next edited search should resolve to an available checked tab.
- Search retry starts: reset relevant checked inventory to `checking`; do not leave stale `None` or `Issue` badges while a provider is actively being queried.
- Existing results remain during streaming: available count can display while the same inventory continues to receive more cards, but the summary should not imply completion until search completes. If results exist while search is still running, badge may show `{N}` and live region may announce `{N} flights available`.

## Acceptance Criteria For UI

- During a flight + hotel round-trip search, while no hotel messages have arrived, the Hotels tab badge reads `Checking`, not `0`.
- When hotel provider returns `hotel-status: empty`, the Hotels tab remains enabled and its badge reads `None`.
- When hotel provider returns `hotel-status: unavailable`, the Hotels tab remains enabled and its badge reads `Issue`.
- When the trip is one-way or missing return date, the Hotels tab may be disabled and its badge reads `Not checked`.
- When flights have zero results and only a no-supply notice, the Flights tab and summary say `No flights returned`, not provider unavailable.
- When flights have zero results and a non-hotel provider unavailable or malformed notice, the Flights tab badge reads `Issue` and the summary says `Flights unavailable`.
- The top summary never renders `0 flights` or `0 hotels`.
- Inactive helpers use the same status vocabulary as the tab badge and never contradict it.
- Empty and unavailable tabs are keyboard reachable.
- The tab status live region announces inventory state changes politely.
- Mobile 375px and desktop 1280px layouts show full status phrases without overlap or critical truncation.

## QA Notes

QA should verify these states against both URL-loaded searches and form-submitted searches:
- `searchIntent=trip`, round-trip dates present, hotels loading.
- `hotel-status: empty`.
- `hotel-status: unavailable`.
- one-way trip with Hotels inactive.
- flights zero with `no_supply`.
- flights zero with provider unavailable.
- active Hotels tab with inactive Flights status visible through helper.
- active Flights tab with inactive Hotels status visible through helper.

