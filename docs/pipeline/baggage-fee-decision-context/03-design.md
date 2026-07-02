# UXDES-BAGGAGE-FEE-DECISION-CONTEXT-01: Baggage Fee Decision Context Design Spec

## Upstream Inputs

- Discovery: `docs/pipeline/baggage-fee-decision-context/01-discovery.md`
- Research: `docs/pipeline/baggage-fee-decision-context/02-research.md`
- Problem statement: Paid users cannot tell whether baggage fees materially change the best flight choice before they commit to a booking path, because baggage cost is estimated separately from the fare cards and is not reflected in the visible price, ranking, or Deal Score context.

## Scope

Design the results comparison experience so one expected-bags setting applies to every visible flight result. The confirmed fare price remains the primary price everywhere. Baggage-adjusted totals are secondary estimates only and must never be described as final, confirmed, live, or guaranteed.

This is UI-only if implemented against the existing internal `/api/baggage` surface. Do not add vendor calls from React components. If implementation requires a server-side batch endpoint, cache changes, URL persistence, or new provider logic, create a DEV ticket before adding it.

## Current Surface To Change

- `components/flights/FlightResults.tsx` should own the list-level bag counts, estimate loading/error state, decision summary, and optional bag-adjusted sort control.
- `app/components/FlightCard.tsx` should receive per-fare baggage estimate presentation props and render only secondary estimate context.
- `components/baggage/BaggageFeeEstimator.tsx` should not remain as a separate one-fare comparison module on the results page. Its count-control pattern may be reused, but the visible module copy and placement must change.

## Hierarchy

Primary hierarchy:

1. Confirmed fare price from `fare.price`, rendered with `formatMoney(fare.price)`.
2. Flight identity and trust context: route, carrier, trip type, stops, departure time, Deal Score.
3. Provider CTA and provider handoff constraints.

Secondary hierarchy:

1. Estimated baggage-adjusted total per card.
2. List-level baggage decision summary.
3. Bag count controls in the refine panel.

Tertiary hierarchy:

1. Estimate confidence copy.
2. Missing or partial-estimate disclosure.
3. Included-bag detail inside expanded card details only.

Deal Score remains a fare-vs-route-history score. Do not recalculate Deal Score using baggage estimates in UI work.

## Data And Money Rules

- Fare prices use existing `Money` values: `{ priceCents: number; currency: string }`.
- Baggage API values currently arrive as numeric USD dollar amounts. Convert each estimate to integer cents before combining or rendering:
  - `estimatedBagFee = { priceCents: Math.round(estimatedTotalUsd * 100), currency: 'USD' }`
  - Reject non-finite, negative, or unsafe values as unavailable.
- Only compute an estimated total when the fare currency is USD and the baggage estimate is valid. If currencies differ, show the unavailable state and do not convert in UI.
- Estimated total formula: `fare.price.priceCents + estimatedBagFee.priceCents`.
- Every visible estimated total label must include `Est.`, `estimated`, or `estimate`.
- Never replace the primary fare price with the estimated total.

## Result Controls

### Desktop Placement

In `FlightResults`, place `Estimated bags` in the refine panel with `Sort by` and `Stops`, below the summary metric row and above the controls summary text.

Desktop grid pattern:

```tsx
<div className="hidden gap-4 sm:grid lg:grid-cols-[minmax(14rem,0.8fr)_minmax(16rem,1fr)_minmax(16rem,1fr)] lg:items-end">
```

The three fieldsets are:

- `Sort by`
- `Stops`
- `Estimated bags`

### Mobile Placement

In the existing mobile filter drawer, place `Estimated bags` below `Stops`. The collapsed filter summary should include bag counts when fares exist:

- `6 of 12 fares | Best deal | All stops | 1 carry-on, 0 checked`

Mobile stack pattern:

```tsx
<div id="flight-mobile-controls" className="mt-3 grid gap-3 border-t border-[var(--border)] pt-3 sm:hidden">
```

### Bag Count Controls

Use a fieldset with visible legend `Estimated bags`.

Controls:

- Carry-on count, default `1`, min `0`, max `4`.
- Checked count, default `0`, min `0`, max `4`.
- Buttons are fixed-size icon-like controls with visible `-` and `+`.
- Count value is centered between buttons with `tabular-nums`.

Required aria labels:

- `Decrease carry-on bags`
- `Increase carry-on bags`
- `Decrease checked bags`
- `Increase checked bags`

Disabled rules:

- Decrease is disabled at `0`.
- Increase is disabled at `4`.
- Controls remain usable while estimates reload.
- Controls are not rendered when there are zero returned fares.

Tailwind pattern:

```tsx
<fieldset className="min-w-0">
  <legend className="mb-2 text-xs font-bold text-[var(--text-1)]">Estimated bags</legend>
  <div className="grid gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-2 sm:grid-cols-2">
```

Button pattern:

```tsx
className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] text-sm font-black text-[var(--text-1)] transition hover:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
```

## Summary Metrics

Keep the existing `Lowest live fare`, `Great deals`, and `Nonstop options` metrics. `Lowest live fare` must continue to show the confirmed base fare only.

Add a decision summary below the metric row and before route alerts/card grid. It must be visible on desktop and mobile when fares exist.

Default visual pattern:

```tsx
<section className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3" aria-live="polite" aria-atomic="true">
```

Use warning tone only for changed-best or incomplete-estimate states:

```tsx
className="rounded-[var(--radius-control)] border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-4 py-3"
```

Required summary copy:

- Best unchanged: `Bags do not change the lowest estimated option.`
- Best changed: `Bags may change the lowest option: {carrier} {origin} to {destination} is estimated lowest with bags.`
- Incomplete estimates: `Some bag estimates are unavailable, so compare provider terms before booking.`
- Loading all estimates: `Estimating bag totals for visible fares.`
- No bag add-ons selected or all selected bags included: `Selected bags add no estimated cost for the lowest visible option.`

Supporting copy rules:

- If the base-price winner and estimated-total winner differ, show the changed-best copy first.
- If any visible fare lacks an estimate, append the incomplete-estimates sentence.
- Do not show more than two sentences in the summary.
- Do not include final-price language.

## Flight Card Estimate Row

Add a secondary row under the primary price block and before the Deal Score/CTA row. It must not compete visually with the confirmed fare price.

Placement:

- Desktop: within the card top grid, aligned under the price column or spanning the card if the text needs room.
- Mobile 375px: below route/carrier metadata and above the Deal Score/CTA row; it must wrap before narrowing the CTA.

Default estimated row:

```tsx
<div className="mt-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-xs leading-5">
```

Copy by state:

- Normal/high or medium confidence: `Est. with bags: {estimatedTotal}`
- Low confidence: `Rough bag estimate: {estimatedTotal}`
- Loading with no prior estimate: `Estimating bags`
- Loading with prior estimate: keep prior row text and add `Updating estimate`
- Unavailable: `Bag estimate unavailable`
- Currency mismatch: `Bag estimate unavailable`

Secondary detail line:

- Normal: `{carryOnCount} carry-on, {checkedCount} checked included in estimate.`
- Low confidence: `Low-confidence airline rule; verify before booking.`
- Unavailable: `Check baggage terms with the provider before booking.`

Color rules:

- Normal estimate: `border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-2)]`.
- Low confidence: `border-[var(--warning)]/25 bg-[var(--warning-soft)] text-[var(--warning)]` for label; detail remains `text-[var(--text-2)]`.
- Unavailable/error: warning tone, not error tone. Missing baggage estimates should not imply the fare itself failed.

Expanded card details should include one extra disclosure block after `Price scope`:

- Heading: `Baggage estimate`
- Copy when available: `Estimated bag totals are added to the confirmed fare only for comparison. Provider baggage rules and final checkout totals can change.`
- Copy when unavailable: `No bag estimate is available for this fare. Review provider baggage terms before booking.`

## Sorting

Include a third sort option only if implementation has a valid estimate for every visible fare in the current filter set. Label: `Lowest est. total`.

Sort type contract:

```ts
type SortBy = 'price' | 'deal' | 'estimatedTotal'
```

Sorting rules:

- `Best deal` remains the default and uses existing score ranking.
- `Lowest price` remains confirmed base fare price only.
- `Lowest est. total` sorts by `fare.price + estimated bag fee`, ascending.
- If estimates are loading, disable `Lowest est. total`.
- If any visible fare has no valid estimate, disable `Lowest est. total`.
- If the user selected `Lowest est. total` and estimates become incomplete after a filter/count change, automatically return to `Lowest price` and announce the reason in the controls summary.

Disabled explanation:

- Add to `flight-results-controls-summary`: `Bag-adjusted sorting is available after estimates load.`
- If partial estimates exist: `Bag-adjusted sorting needs estimates for every visible fare.`

Segmented layout:

- Desktop sort grid becomes three columns.
- Mobile sort grid becomes three columns only when the option can be shown without clipped labels; otherwise keep a vertical one-column stack for sort buttons in the drawer.

## States

### Default

- Results refine panel shows confirmed base metrics, sort/stops controls, estimated bag controls, and decision summary.
- Each card shows confirmed fare price as primary and estimated-with-bags row as secondary when available.
- Default counts are `1 carry-on`, `0 checked`.

### Loading

- Bag controls remain enabled.
- Decision summary says `Estimating bag totals for visible fares.`
- Card rows reserve stable height with `min-h-[3.75rem]`.
- Card copy: `Estimating bags`.
- Use `aria-live="polite"` on the summary, not on every card row.

### Partial Estimate

- Cards with estimates show their estimate state.
- Cards without estimates show `Bag estimate unavailable`.
- Summary includes `Some bag estimates are unavailable, so compare provider terms before booking.`
- `Lowest est. total` is disabled.

### No Estimate / Error

- Every card shows `Bag estimate unavailable`.
- Summary shows only `Some bag estimates are unavailable, so compare provider terms before booking.`
- Existing CTAs remain governed by fare price and deeplink validity; do not disable a provider CTA because baggage estimate failed.

### Low Confidence

- Card label uses `Rough bag estimate: {estimatedTotal}`.
- Detail line says `Low-confidence airline rule; verify before booking.`
- Summary can still compare lowest estimated option, but if the lowest estimated option uses low-confidence baggage data, append `Some estimates are rough, so verify provider terms before booking.`

### Empty Results

- Do not render bag controls, bag summary, or per-card estimate rows when there are zero returned fares.
- Existing empty state copy and recovery actions remain unchanged.
- If filters hide results, do not render bag controls in the card area; keep only existing filter recovery.

### Searching With Existing Fares

- Keep current visible fares.
- Bag controls remain enabled.
- Estimate rows for existing fares continue showing the last valid estimate while new estimates load if the route/count context did not change.
- New skeleton cards do not show baggage copy; their shimmer block reserves the future estimate-row height.

### Mobile 375px

- Filter button remains the compact entry point.
- Expanded mobile controls stack: Sort, Stops, Estimated bags.
- Card estimate row spans full card width and wraps naturally.
- CTA max width must not be reduced by the estimate row.
- No text may be truncated except the existing route/carrier line; estimate labels must wrap instead.

Mobile card pattern:

```tsx
<div className="mt-3 min-h-[3.75rem] rounded-[var(--radius-control)] border px-3 py-2 text-xs leading-5 sm:col-span-2">
```

### Desktop 1280px

- Refine panel remains a single full-width control surface.
- Summary metric cards remain three columns.
- Sort/stops/bag controls fit in one row at `lg`.
- Flight cards remain in the existing three-column grid.
- Estimate row must not change card width or create uneven CTA alignment beyond natural card-height differences.

### Focus And Keyboard

- Tab order: mobile filter button, sort controls, stops controls, carry-on decrement/increment, checked decrement/increment, alert form, card CTAs, detail buttons.
- Pressing `Escape` in the mobile drawer closes it and returns focus to the filter button, preserving current behavior.
- Count buttons expose disabled states at min/max.
- Sort buttons use `aria-pressed`.
- The decision summary has `aria-live="polite"` and `aria-atomic="true"`.
- Do not put `aria-live` on every changing card estimate row unless implementation cannot otherwise announce updates; repeated announcements would be noisy.

## Final Visible Copy

- Fieldset legend: `Estimated bags`
- Count labels: `Carry-on`, `Checked`
- Sort labels: `Best deal`, `Lowest price`, `Lowest est. total`
- Summary unchanged: `Bags do not change the lowest estimated option.`
- Summary changed: `Bags may change the lowest option: {carrier} {origin} to {destination} is estimated lowest with bags.`
- Summary incomplete: `Some bag estimates are unavailable, so compare provider terms before booking.`
- Summary loading: `Estimating bag totals for visible fares.`
- Card estimate normal: `Est. with bags: {estimatedTotal}`
- Card estimate low confidence: `Rough bag estimate: {estimatedTotal}`
- Card estimate loading: `Estimating bags`
- Card estimate unavailable: `Bag estimate unavailable`
- Details heading: `Baggage estimate`
- Details available disclosure: `Estimated bag totals are added to the confirmed fare only for comparison. Provider baggage rules and final checkout totals can change.`
- Details unavailable disclosure: `No bag estimate is available for this fare. Review provider baggage terms before booking.`

## Acceptance Criteria

- Confirmed fare price remains the primary visible price on every card and in the `Lowest live fare` metric.
- Every visible baggage-adjusted total uses `Est.`, `estimated`, or `estimate`.
- One carry-on/checked setting applies to all visible fares and survives sort/filter changes.
- Cards show normal, loading, unavailable, and low-confidence baggage states.
- Summary tells users whether baggage changes the lowest estimated option or whether estimates are incomplete.
- `Lowest est. total` is present only when every visible fare can be ranked by valid estimated total; otherwise it is disabled or omitted with summary explanation.
- Empty results do not render baggage controls.
- Mobile 375px and desktop 1280px are usable without overlapping text or clipped controls.
- TypeScript remains clean after UI implementation.

## Handoff To UI

Create `UI-BAGGAGE-FEE-DECISION-CONTEXT-01`.

Implementation should be limited to React component state, props, Tailwind classes, and internal `/api/baggage` usage. If batching estimates cannot be done cleanly without new server behavior, create a DEV ticket instead of calling external vendors or adding provider logic in components.
