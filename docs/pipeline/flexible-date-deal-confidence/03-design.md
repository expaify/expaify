# UXDES-FLEXIBLE-DATE-DEAL-CONFIDENCE-01: Flexible Date Deal Confidence Design

## Source

- Discovery: `docs/pipeline/flexible-date-deal-confidence/01-discovery.md`
- Research: `docs/pipeline/flexible-date-deal-confidence/02-research.md`
- Current search UI: `app/page.tsx`
- Current card UI: `app/components/FlightCard.tsx`, `app/components/DealScorePanel.tsx`
- Current search API: `app/api/search/route.ts`
- Shared contract: `lib/types.ts`
- Design tokens: `app/globals.css`

## Problem Statement

Paid users searching fixed travel dates cannot tell whether expaify checked nearby dates before labeling a fare as `Great`, `Good`, or `Typical`, which weakens trust in the Deal Score when dates are flexible enough to change the recommendation.

## Design Goal

Add a visible date-coverage evidence layer that tells users whether nearby departure dates were not checked, fully checked, partially checked, or unavailable. This layer must stay separate from Deal Score history confidence: flexible-date coverage can explain search evidence, but it must never strengthen a low-history Deal Score or change `Great`, `Good`, or `Typical`.

This is not UI-only. A complete implementation requires DEV work because the current stream only exposes generic provider notices and does not include checked dates, expected dates, or per-fare selected-vs-nearby context.

## Required Data Contract

Add a structured flight date coverage payload to the search stream and shared types.

Recommended type:

```ts
export type DateCoverageStatus = 'not_requested' | 'complete' | 'partial' | 'unavailable'

export interface FlightDateCoverage {
  requested: boolean
  status: DateCoverageStatus
  selectedDepart: string
  windowStart?: string
  windowEnd?: string
  expectedDates: string[]
  checkedDates: string[]
  failedDates: string[]
  provider: string
  message?: string
}
```

Recommended stream message:

```ts
{ type: 'flight-date-coverage', data: FlightDateCoverage }
```

Required derivation:

- Fixed-date search: `requested: false`, `status: 'not_requested'`, `expectedDates: [selectedDepart]`, `checkedDates: []`.
- Flexible complete: `requested: true`, `status: 'complete'`, seven expected dates, seven checked dates, zero failed dates.
- Flexible partial: `requested: true`, `status: 'partial'`, at least one checked date and at least one failed or unconfirmed expected date.
- Flexible unavailable: `requested: true`, `status: 'unavailable'`, zero checked dates.

Fares must also expose whether they depart on the selected date or a nearby date. Prefer deriving from existing `fare.depart` and `FlightDateCoverage.selectedDepart` in UI if the fare date is reliable. If provider date normalization is ambiguous, add explicit metadata rather than guessing.

## Information Hierarchy

Results-level hierarchy:

1. Primary: result count, sort/filter controls, and active tab remain unchanged.
2. Secondary: date coverage summary directly below the flight results heading and above refine controls/provider notices.
3. Secondary: provider notices remain below date coverage when present.
4. Tertiary: explanatory trust disclaimer appears only for partial or unavailable coverage.

Flight-card hierarchy:

1. Primary: fare price, route, schedule, and Deal Score remain unchanged.
2. Secondary: a compact date relation chip near the schedule: `Selected date` or `Nearby date: {date}`.
3. Tertiary: expanded details include selected departure date, fare departure date, and coverage basis.

Deal Score hierarchy:

- `DealScorePanel` keeps `Window: Last 90 days` for route-history confidence.
- Do not place nearby-date copy inside the Deal Score facts grid.
- Do not use the words `confidence`, `history`, or `Deal Score` in the date coverage component label.

## Final UI Copy

### Search Form

Flexible-date checkbox:

- Label: `Flexible dates`
- Helper: `Check departure dates up to 3 days before and after when providers respond`

### Loading

Results-level status when `flexDates === false`:

- `Checking fares for your selected departure date.`

Results-level status when `flexDates === true`:

- `Checking nearby departure dates when providers respond.`

Accessible status:

- Fixed: `Searching fares for the selected departure date.`
- Flexible: `Searching fares across nearby departure dates when providers respond.`

### Date Coverage Summary

Label:

- `Nearby dates`

Fixed-date search:

- Primary: `Nearby dates not checked`
- Body: `This search used your selected departure date only.`

Flexible complete:

- Primary: `Checked {startDate} to {endDate}`
- Body: `7 of 7 departure dates checked.`

Flexible partial:

- Primary: `Checked some nearby dates`
- Body: `{checkedCount} of {expectedCount} departure dates checked.`
- Disclaimer: `Deal Scores use route history. Nearby-date comparison was partial.`

Flexible unavailable:

- Primary: `Nearby date comparison unavailable`
- Body: `0 of {expectedCount} departure dates checked.`
- Disclaimer: `Deal Scores use route history. Nearby-date comparison was unavailable.`

Required count examples:

- `7 of 7 departure dates checked.`
- `4 of 7 departure dates checked.`
- `0 of 7 departure dates checked.`

Do not say `+/-3 days checked` unless `checkedCount === expectedCount`.

### Flight Card Date Relation

Collapsed card chip:

- Fare date equals selected departure date: `Selected date`
- Fare date differs from selected departure date: `Nearby date: {date}`

Expanded details:

- Section label: `Date check`
- Selected-date row label: `Selected departure`
- Fare-date row label: `This fare departs`
- Coverage row label: `Nearby coverage`

Expanded details values:

- Fixed: `Selected date only`
- Complete: `{checkedCount} of {expectedCount} dates checked`
- Partial: `{checkedCount} of {expectedCount} dates checked`
- Unavailable: `Nearby comparison unavailable`

### Empty States

Fixed-date no fares:

- Primary: `No fares returned for this departure date`
- Body: `Try flexible dates to check nearby departures.`
- Action: `Try flexible dates`

Flexible complete with no fares:

- Primary: `No nearby-date fares returned`
- Body: `We checked {startDate} to {endDate}, but providers did not return matching fares.`

Flexible partial with no fares:

- Primary: `No fares returned from checked nearby dates`
- Body: `{checkedCount} of {expectedCount} departure dates were checked. Try again or search selected date only.`

Flexible unavailable with no fares:

- Primary: `Nearby-date fares unavailable`
- Body: `Providers did not return usable nearby-date coverage for this search. Try again or search selected date only.`

### Error States

Search failure:

- Keep existing fatal search error behavior.
- If a coverage payload was received before failure, leave the date coverage summary visible.
- If no coverage payload was received, show `Nearby date comparison unavailable` only when `flexDates === true`; otherwise omit coverage.

Provider notice interaction:

- Keep provider notices visible.
- Do not duplicate raw provider error strings inside the date coverage component.
- The date coverage component may use `message` only when it is user-safe and already normalized.

## State Requirements

### Default Fixed-Date Search

- Render the date coverage summary with `Nearby dates not checked`.
- Do not show a warning color.
- Do not add date relation chips to every card unless the result surface has a structured selected departure date. If shown, the chip must read `Selected date`.

### Flexible Complete

- Render `Checked {startDate} to {endDate}` and `7 of 7 departure dates checked.`
- Use a neutral or success-soft treatment; do not use Deal Score badge colors.
- Every fare card must show `Selected date` or `Nearby date: {date}`.
- No trust disclaimer is required.

### Flexible Partial

- Render `Checked some nearby dates` and the exact count.
- Show the disclaimer directly under the summary body.
- Preserve all Deal Score verdicts exactly as returned.
- Do not hide fares from checked dates.

### Flexible Unavailable

- Render `Nearby date comparison unavailable` and `0 of 7 departure dates checked.`
- Show the disclaimer directly under the summary body.
- Preserve fixed-date fares from other providers if present, but do not imply nearby comparison happened.

### Deal Score Low Confidence

- Existing low-confidence behavior remains authoritative.
- Flexible complete coverage does not change `Limited history` copy.
- If `score.confidence === 'low'`, the date coverage component must not use copy like `confirmed deal`, `stronger rating`, or `high confidence`.

### Loading

- Results loading must reserve space for one date coverage row to avoid layout shift.
- The component uses `role="status"` with concise status copy.
- Card skeletons may omit date relation chips while fare data is unknown.

### Mobile 375px

- Date coverage summary stacks as label, primary line, body, and optional disclaimer.
- No horizontal scroll.
- Count copy must wrap naturally; do not truncate `0 of 7 departure dates checked.`
- Flight-card date chips wrap below the schedule line if space is tight.
- Minimum tap targets for retry/filter/search actions remain 44px or larger.

### Desktop 1280px

- Date coverage summary sits in the same column as flight results, above refine controls.
- Summary may use a two-column row: text on the left, count pill on the right.
- Provider notices remain visually separate below the summary.
- Flight-card chip sits beside schedule/stops metadata without pushing price out of alignment.

### Focus And Keyboard

- Date coverage summary is informational and not tabbable.
- If a retry/search-selected-date action is present in empty or unavailable states, it must be a real `button` with existing focus-visible treatment.
- Card date relation chips are informational and not tabbable.
- Expanded flight details remain controlled by the existing `Details` button and `aria-expanded`.

## Layout Specification

### Results Date Coverage Summary

Base container:

```tsx
rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] px-3.5 py-3
```

Partial/unavailable modifier:

```tsx
border-[var(--border-strong)] bg-[var(--warning-soft)]
```

Label:

```tsx
text-[10px] font-bold uppercase tracking-wide text-[var(--text-3)]
```

Primary:

```tsx
mt-0.5 text-sm font-bold leading-5 text-[var(--text-1)]
```

Body:

```tsx
mt-1 text-xs font-medium leading-5 text-[var(--text-2)]
```

Disclaimer:

```tsx
mt-2 text-xs font-semibold leading-5 text-[var(--warning)]
```

Count pill on desktop only when useful:

```tsx
inline-flex min-h-7 items-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 text-xs font-bold text-[var(--text-2)]
```

### Flight Card Date Chip

Place in the existing schedule/stops metadata group after the departure schedule and before stops when possible.

Chip:

```tsx
inline-flex min-h-7 items-center rounded-full border border-[var(--border)] bg-[var(--bg-raised)] px-2.5 text-xs font-bold leading-4 text-[var(--text-2)]
```

Nearby-date chip may use brand-soft background:

```tsx
border-[var(--border-strong)] bg-[var(--brand-soft)] text-[var(--text-1)]
```

Expanded detail row:

```tsx
grid grid-cols-1 gap-2 text-xs sm:grid-cols-3
```

Detail fact:

```tsx
rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2
```

## Interaction Rules

- Toggling `Flexible dates` only changes the next search; it does not rewrite existing results until a new search runs.
- `Try flexible dates` sets `flexDates` to true and runs the current search when valid dates exist.
- If flexible coverage is unavailable, an optional secondary action may search selected date only. Copy: `Search selected date only`.
- Clicking a nearby-date fare continues the existing provider handoff. The CTA accessible name must include the fare departure date when it differs from selected departure.
- Opening details shows exact selected and fare departure dates. Closing details does not reset coverage state.

## Acceptance Criteria

- Fixed-date results show `Nearby dates not checked`.
- Flexible complete results show `Checked {startDate} to {endDate}` and `7 of 7 departure dates checked.`
- Flexible partial results show exact checked/expected counts and the partial disclaimer.
- Flexible unavailable results show `0 of 7 departure dates checked.` and the unavailable disclaimer.
- Collapsed flight cards identify `Selected date` or `Nearby date: {date}` during flexible searches.
- Expanded flight details show selected departure date, fare departure date, and nearby coverage count/status.
- Date coverage copy never changes or strengthens Deal Score verdicts.
- Low-history Deal Scores still show existing `Limited history` treatment.
- Mobile 375px and desktop 1280px have no overlapping date coverage, card, filter, or provider notice text.
- DEV adds the structured `flight-date-coverage` stream message before UI can fully meet this spec.

## Handoff

Create `DEV-FLEXIBLE-DATE-DEAL-CONFIDENCE-01`. UI implementation depends on DEV because the current API does not expose date coverage completeness, checked date lists, failed date lists, or an explicit selected-vs-nearby fare relation.
