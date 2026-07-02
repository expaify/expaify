# UXDES-MOBILE-RESULTS-SCAN-01: Mobile Results Scanning and Card Density

## Source Inputs

- Discovery: `docs/pipeline/mobile-results-scan/01-discovery.md`
- Research: `docs/pipeline/mobile-results-scan/02-research.md`
- Current surfaces referenced:
  - `app/page.tsx`
  - `components/flights/FlightResults.tsx`
  - `app/components/FlightCard.tsx`
  - `app/components/HotelCard.tsx`
  - `app/components/DealBadge.tsx`
  - `app/globals.css`

## Problem Statement

At 375px, expaify results are too tall to compare because every flight and hotel card opens in a detail-heavy state by default. Users need a compact collapsed state for scanning price, Deal Score, stops or rating, and provider action, with trust-critical details available on demand.

## Design Goals

- Let a first-time mobile user compare at least two flight or hotel results after the tabs without opening details.
- Preserve trust information: score explanation, confidence copy, price scope, unavailable reasons, and provider handoff notes.
- Keep valid provider actions available from the collapsed state.
- Keep keyboard and screen reader interaction explicit with `aria-expanded`, stable region IDs, and visible focus.
- Avoid desktop regression: desktop may keep the current spacious card rhythm while mobile uses compact rows.

## Hierarchy

### Collapsed Flight Row

Primary:
- Current price or "Price unavailable"
- Deal Score verdict, "Limited history", "Score pending", or "Score unavailable"
- Provider action

Secondary:
- Route, carrier, trip type
- Stops
- Departure time when available

Tertiary:
- Price scope sentence
- Deal explanation
- Provider handoff note
- Baggage context

### Expanded Flight Details

Primary:
- Deal explanation and confidence language
- Provider handoff note or unavailable reason

Secondary:
- Price scope
- Date/time details
- Cabin and baggage context

Tertiary:
- Percentile and usual comparison metadata

### Collapsed Hotel Row

Primary:
- Nightly price or "Price unavailable"
- Deal Score verdict, "Limited history", "Score pending", or "Score unavailable"
- Provider action

Secondary:
- Hotel name
- Rating and star signal
- 64-72px thumbnail or no-photo placeholder

Tertiary:
- Usual price
- Vs median
- Full score explanation
- Provider handoff note

### Expanded Hotel Details

Primary:
- Deal explanation and confidence language
- Provider handoff note or unavailable reason

Secondary:
- Larger image preview when available
- Usual price and vs median
- Nightly price scope

Tertiary:
- Additional hotel metadata already present on the offer

## Component Behavior

### Flight Results Toolbar

At 375px, the control area above flight cards must be compact:
- Show one summary line: `{visibleCount} of {totalCount} fares | {sortLabel} | {stopsLabel}`.
- Show a single `Filter` control that opens or reveals sort and stops controls.
- Do not render the three metric tiles above the first fare on mobile.
- Do not render the baggage estimator above the first fare on mobile. Move it below the first result group or inside expanded flight details.
- Preserve the full metric tiles on `sm` and larger if desired.

Final visible strings:
- Summary: `{visibleCount} of {totalCount} fares | {sortLabel} | {stopsLabel}`
- Toggle: `Filter`
- Expanded filter heading: `Sort and stops`
- Sort options: `Best deal`, `Lowest price`
- Stops options: `All stops`, `Nonstop`, `1 stop`
- Ranking live text: `Updating deal ranking as scores finish.`
- Disabled controls text: `Filters are available after fares load.`

Interaction rules:
- The `Filter` control is a `button`, not a link.
- `Filter` uses `aria-expanded` and `aria-controls="flight-mobile-controls"`.
- Opening the control panel does not move keyboard focus.
- Pressing Escape while focus is inside the expanded control panel closes it and returns focus to `Filter`.
- Sort and stops buttons keep current `aria-pressed` behavior.
- The result list remains visible below the toolbar while filters are open.

Tailwind pattern:
- Toolbar shell: `rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 shadow-[var(--shadow-card)] sm:px-5 sm:py-5`
- Mobile row: `flex min-h-11 items-center justify-between gap-2`
- Summary text: `min-w-0 truncate text-xs font-semibold text-[var(--text-2)]`
- Toggle: `inline-flex min-h-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-sm font-bold text-[var(--text-1)]`
- Expanded controls: `mt-3 grid gap-3 border-t border-[var(--border)] pt-3`

### Collapsed Flight Card

Default mobile state:
- Card height target: 132-164px depending on copy length.
- One compact card uses two content columns: route details on the left, price/action on the right.
- Price must appear in the top-right area and use smaller typography than the current `text-4xl`.
- Deal Score chip appears in the lower-left or center row and never disappears.
- CTA appears in the lower-right and remains reachable without expansion when the price and link are valid.
- Details toggle appears after the scan row and before expanded content.

Required collapsed flight fields:
- Route: `{origin} to {destination}`
- Trip type: `Round trip` or `One way`
- Carrier: carrier label, truncated to one line
- Stops: `Nonstop`, `1 stop`, `{n} stops`
- Time: departure time when `fare.depart` includes a time; otherwise omit the time row
- Price heading: `Passenger total` or `Traveler fare`
- Price value: formatted money, or `Price unavailable`
- Score: `Great`, `Good`, `Typical`, `Limited history`, `Score pending`, or `Score unavailable`
- CTA: existing valid CTA label, or disabled unavailable label
- Details toggle: `Details` when collapsed, `Hide details` when expanded

Final collapsed flight copy rules:
- Use `Score pending` only while `loading === true`.
- Use `Score unavailable` when loading is false and `score === null`.
- If `score.confidence === "low"`, show `Limited history` instead of `score.verdict`.
- Never show `Great` for low-confidence scores.
- If price is unavailable, keep `Price unavailable` visible in the collapsed row and disable the provider action.
- If provider link is unavailable, keep `Provider link unavailable` as the disabled action.

Expanded flight details:
- Details region appears inside the same card below the collapsed scan row.
- Include current Deal Score explanation panel content.
- Include price scope sentence.
- Include provider handoff note.
- Include unavailable reasons when price or provider link is invalid.
- Include baggage context when available; otherwise omit baggage content.
- Expanded content must not duplicate the primary CTA if the collapsed CTA is visible.

Final expanded flight copy:
- Deal heading: `Deal Score`
- Low confidence: `Limited route history. Treat this as a rough comparison, not a confirmed deal.`
- Score unavailable: `We could not compare this fare against route history yet. The live price is still shown when available.`
- Provider handoff: `Opens the booking handoff. Final price and availability can change.`
- Internal booking paused: `In-app booking is paused. This page is review-only.`
- Price unavailable reason: `No confirmed fare price was returned for this result.`
- Link unavailable reason: `Availability cannot be verified from this result.`

Interaction and accessibility:
- Card root remains an `article`.
- Details toggle is a `button` with `aria-expanded` and `aria-controls="flight-details-{fare.id}"`.
- Expanded region uses `id="flight-details-{fare.id}"`.
- If the user tabs from the collapsed CTA to Details, focus order must continue into expanded content only when open.
- Focus ring must use the global focus token behavior; do not suppress `:focus-visible`.
- The card itself is not clickable. Only the CTA and Details button are interactive.

Tailwind pattern:
- Card root mobile: `card overflow-hidden rounded-[var(--radius-card)]`
- Collapsed body: `p-3 sm:p-5`
- Scan grid: `grid grid-cols-[minmax(0,1fr)_auto] gap-3`
- Route block: `min-w-0`
- Route title: `truncate text-sm font-bold leading-5 text-[var(--text-1)]`
- Meta text: `truncate text-xs font-medium leading-5 text-[var(--text-2)]`
- Price block: `min-w-[5.75rem] text-right`
- Price value: `font-display text-xl font-black leading-none text-[var(--text-1)] tabular-nums sm:text-4xl`
- Score/action row: `mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2`
- Mobile CTA: `inline-flex min-h-10 max-w-[8.5rem] items-center justify-center rounded-[var(--radius-control)] px-3 text-xs font-bold`
- Details toggle: `mt-3 flex min-h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-bold text-[var(--text-1)]`
- Expanded region: `border-t border-[var(--border)] px-3 pb-3 pt-3 sm:px-5 sm:pb-5`

### Collapsed Hotel Card

Default mobile state:
- Card height target: 136-172px with photo.
- Thumbnail is 64px wide by 64px tall minimum, 72px by 72px maximum.
- Hotel image must not use the current 192px mobile hero treatment in collapsed state.
- No-photo state uses the same thumbnail box size and text `Photo unavailable`.
- Name can wrap to two lines but must not push price/action off the row.
- Rating signal must be visible in collapsed state when available.
- CTA remains reachable without expansion when price and booking link are valid.

Required collapsed hotel fields:
- Thumbnail or no-photo placeholder
- Hotel name
- Stars and rating when available
- Nightly price or `Price unavailable`
- Score: `Great`, `Good`, `Typical`, `Limited history`, `Score pending`, or `Score unavailable`
- CTA: `Review hotel` when valid; disabled `Booking unavailable` when invalid
- Details toggle: `Details` when collapsed, `Hide details` when expanded

Final collapsed hotel copy rules:
- Price heading: `Nightly rate`
- Price scope stays in details: `per night before taxes and fees`
- Score pending while score is loading: `Score pending`
- Score unavailable when no score is available and loading is false: `Score unavailable`
- Low confidence score chip: `Limited history`
- Rating label: `{rating} {ratingLabel}`, for example `8.6 Excellent`
- Stars aria label: `{n} out of 5 stars`
- No photo placeholder: `Photo unavailable`

Expanded hotel details:
- Include larger photo only when the user opens details and `hotel.photoUrl` exists.
- Include current Hotel Deal panel content: percentile, usual price, vs median, low-confidence language, and explanation.
- Include nightly price scope.
- Include provider handoff note or booking unavailable reason.
- Expanded details must not hide or move the collapsed `Review hotel` CTA.

Final expanded hotel copy:
- Deal heading: `Deal Score`
- Low confidence: `Limited hotel history. Treat this as a rough comparison, not a confirmed deal.`
- Score unavailable: `We could not compare this hotel rate against recent history yet.`
- Price scope: `per night before taxes and fees`
- Provider handoff: `Review nightly price before provider handoff.`
- Booking unavailable: `Booking unavailable`
- Invalid price and link: `No confirmed nightly price or valid booking link was returned.`
- Invalid price only: `No confirmed nightly price was returned.`
- Invalid link only: `No valid booking link was returned.`

Interaction and accessibility:
- Card root remains non-clickable.
- Details toggle is a `button` with `aria-expanded` and `aria-controls="hotel-details-{hotel.id}"`.
- Expanded region uses `id="hotel-details-{hotel.id}"`.
- Thumbnail image alt remains the hotel name.
- The no-photo thumbnail is not interactive and has visible text.
- Focus order: collapsed CTA, Details toggle, expanded details content when open.

Tailwind pattern:
- Card root mobile: `card overflow-hidden rounded-[var(--radius-card)]`
- Collapsed body: `p-3 sm:p-5`
- Top grid: `grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-3`
- Thumbnail: `h-16 w-16 overflow-hidden rounded-[var(--radius-control)] bg-[var(--bg-muted)] sm:h-auto sm:w-full`
- Name: `line-clamp-2 text-sm font-bold leading-5 text-[var(--text-1)]`
- Rating row: `mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold text-[var(--text-2)]`
- Price block: `min-w-[5.75rem] text-right`
- Price value: `font-display text-xl font-black leading-none text-[var(--text-1)] tabular-nums sm:text-4xl`
- Score/action row: `mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2`
- Mobile CTA: `inline-flex min-h-10 max-w-[8.5rem] items-center justify-center rounded-[var(--radius-control)] px-3 text-xs font-bold`
- Details toggle: `mt-3 flex min-h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-bold text-[var(--text-1)]`
- Expanded region: `border-t border-[var(--border)] px-3 pb-3 pt-3 sm:px-5 sm:pb-5`

## Loading States

### Flight Loading

- Keep the flight toolbar visible only if a search is in progress or results exist.
- Mobile skeleton cards should match collapsed card dimensions, not the current expanded-card skeleton height.
- Skeleton layout: logo/route block, right price block, score chip placeholder, CTA placeholder.
- Loading score inside an already loaded fare uses `Score pending` in the score chip plus an `aria-live="polite"` detail if needed.

Copy:
- Panel title: `Checking live flight inventory`
- Panel body: `Fare cards will appear here as providers return usable prices for this search.`
- Score chip: `Score pending`

Tailwind pattern:
- Skeleton card: `card p-3`
- Skeleton row: `grid grid-cols-[minmax(0,1fr)_auto] gap-3`
- Shimmer blocks should use existing `shimmer` class.

### Hotel Loading

- Hotel skeleton cards should match collapsed card dimensions.
- Photo skeleton uses the 64-72px thumbnail size.
- If hotels stream in while scores are still loading, show the real hotel row with `Score pending`.

Copy:
- Score chip: `Score pending`

Tailwind pattern:
- Skeleton card: `card p-3`
- Thumbnail shimmer: `h-16 w-16 rounded-[var(--radius-control)] shimmer`

## Empty States

### Flight Empty

Preserve current empty state logic and actions.

Required copy:
- Missing departure: `Add a departure date so providers can return current fares and Deal Scores can be compared honestly.`
- Missing return: `Add a return date for round-trip pricing, or switch to one way before searching again.`
- Filters hiding fares: `Clear the stops filter or choose All to review the fares returned for this search.`
- Provider unavailable: `No flight provider returned usable inventory. Try again shortly or adjust the trip details.`
- No inventory: `No current fares matched this route and date combination. Edit the search to try nearby dates, another destination, or anywhere.`

Mobile layout:
- Empty state can remain a full panel.
- Action button must be visible without horizontal scroll at 375px.

### Hotel Empty

Preserve current hotel availability logic and actions.

Required copy:
- Use the existing hotel unavailable copy generated by `app/page.tsx`.
- Keep `Edit search` as the action.

Mobile layout:
- Empty state can remain a full panel.
- Do not show hotel skeletons after search completion.

## Error and Unavailable States

### Price Unavailable

- Keep result visible.
- Show `Price unavailable` in the collapsed price position.
- Disable provider action.
- Put the specific reason in expanded details and disabled action `aria-label`.

### Provider Link Unavailable

- Keep result visible.
- Show price if valid.
- Disable provider action with `Provider link unavailable` for flights or `Booking unavailable` for hotels.
- Put the reason in expanded details.

### Score Unavailable

- Collapsed score text: `Score unavailable`
- Expanded explanation:
  - Flight: `We could not compare this fare against route history yet. The live price is still shown when available.`
  - Hotel: `We could not compare this hotel rate against recent history yet.`

### Low Confidence

- Collapsed score text: `Limited history`
- Expanded details include the low-confidence sentence.
- Do not display `Great` in collapsed or expanded badge copy when confidence is low.

## Responsive Requirements

### 375px Mobile

- Results after tabs use one column.
- Flight and hotel cards default to collapsed.
- At least two collapsed results must be partially or fully visible in the viewport after the result tabs and mobile toolbar.
- No text may overlap, clip horizontally, or require horizontal scrolling.
- CTAs may truncate their labels with `truncate`, but unavailable labels must remain understandable.
- Touch targets for CTA and Details toggle must be at least 40px high.
- Photo thumbnails must stay within 64-72px height.
- Details expansion pushes content downward; it must not overlay the next card.

### 1280px Desktop

- Existing spacious card grid can remain.
- Desktop may default to expanded cards, or may use the same collapsed/expanded model if the UI stage chooses consistency.
- Flight controls may keep metric tiles and full sort/stops controls.
- Hotel cards may keep larger imagery on desktop.
- Desktop cards must preserve visible price, Deal Score, and provider action without requiring hover.

## Keyboard and Screen Reader Requirements

- Tab order at 375px:
  1. Result tabs
  2. Flight filter toggle and filter controls when open
  3. First result provider CTA when enabled
  4. First result Details toggle
  5. Expanded detail controls/content if open
  6. Next result provider CTA
- All interactive elements must have visible `:focus-visible` styling from global tokens.
- Details toggles must expose state with `aria-expanded`.
- Expanded regions must be referenced by `aria-controls`.
- Score loading status may use `aria-live="polite"` but must not repeatedly announce every ranking update for every card.
- Disabled CTAs must expose why the action is unavailable through visible details text and `aria-label` or adjacent text.

## Implementation Notes for UI Stage

- Preserve existing props and exports for `FlightCard`, `HotelCard`, and `FlightResults`.
- Local expansion state can live inside each card component.
- Do not change provider calls, API routes, scoring logic, booking URL builders, or money formatting.
- Reuse `DealBadge` behavior for low-confidence scores because it already maps low confidence to `Limited history`.
- Consider using the existing unused hotel `RatingBadge` pattern in the collapsed hotel row, but keep the card contract unchanged.
- The UI stage should decide whether to render flight departure time in the collapsed row using the already computed `departTime`; if no time is available, omit the field rather than showing blank text.

## Acceptance Criteria

1. At 375px, flight results default to compact collapsed rows and show at least two results partially or fully after the tabs and toolbar.
2. At 375px, hotel results default to compact collapsed rows with thumbnails no taller than 72px and show at least two results partially or fully when photos exist.
3. Every collapsed flight result shows route, price or price unavailable, Deal Score state, stops, provider action, and Details toggle.
4. Every collapsed hotel result shows hotel name, price or price unavailable, Deal Score state, rating or stars when available, provider action, and Details toggle.
5. Expanded flight details show score explanation, confidence/unavailable copy, price scope, provider handoff note, and unavailable reasons.
6. Expanded hotel details show score explanation, confidence/unavailable copy, usual price/vs median when score exists, price scope, provider handoff note, and unavailable reasons.
7. Low-confidence scores show `Limited history` instead of `Great`, `Good`, or `Typical` in collapsed state.
8. Score loading and unavailable states remain visible as `Score pending` and `Score unavailable`.
9. Keyboard users can tab to provider actions and Details toggles with visible focus and correct `aria-expanded` state.
10. `npx tsc --noEmit --incremental false` must exit 0 after UI implementation.

## Out of Scope

- Changing search APIs, provider adapters, booking link generation, scoring math, caching, or database access.
- Adding new result ranking logic.
- Adding new hotel provider behavior.
- Adding award travel UI.
- Committing changes. The monitor owns commits for this repair run.

## Handoff

Next ticket: `UI-MOBILE-RESULTS-SCAN-01`

Title: `UI Implementation: mobile results scanning and card density`

Description summary: Implement the mobile collapsed and expanded result states specified in `docs/pipeline/mobile-results-scan/03-design.md`. Keep provider actions, score confidence/unavailable copy, price scope, and provider handoff notes available while reducing mobile card height for flights and hotels.
