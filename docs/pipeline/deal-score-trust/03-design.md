# UXDES-DEAL-SCORE-TRUST-01: Deal Score Trust And Explanation Clarity

## Source

- Discovery: `docs/pipeline/deal-score-trust/01-discovery.md`
- Research: `docs/pipeline/deal-score-trust/02-research.md`
- Current surfaces: `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `app/components/DealBadge.tsx`
- Data contract: `DealScore` in `lib/types.ts`
- Design tokens: `app/globals.css`

## Problem Statement

Users see a Deal Score verdict such as Great, Good, or Typical, but result cards do not consistently explain the evidence, 90-day comparison window, usual price, median delta, or low-confidence threshold behind the verdict.

## Design Goal

Create one shared Deal Score evidence pattern for flight and hotel result cards so users can scan the verdict, comparison scope, usual price, median delta, lookback window, and confidence boundary without reading a paragraph first.

This is a UI specification only. Do not change scoring logic, provider calls, API routes, baseline queries, or the `DealScore` type.

## Component Model

Implement a shared presentation component, either as a new local component or a shared helper used by both cards:

`DealScorePanel`

Required props:

- `score: DealScore | null`
- `loading: boolean`
- `scope: 'route' | 'hotel'`
- `priceNoun: 'fare' | 'nightly rate'`
- `unavailableCopy: string`

Optional implementation detail:

- Keep `DealBadge` as the verdict badge component.
- Use existing `formatMoney` and `isValidMoney`; do not format score money manually except through the money helper.
- Add shared local formatters for ordinal percentile and median delta if no existing shared helper is available.

## Information Hierarchy

Every Deal Score panel must render evidence in this order:

1. Primary: `Deal Score` label and `DealBadge`.
2. Secondary: comparison scope line.
3. Secondary: percentile or limited-history line.
4. Evidence facts: `Usual`, `Vs usual`, `Window`.
5. Tertiary: confidence rule or unavailable reason.
6. Tertiary: `score.explanation` when a score exists.

The facts must be visible before the explanatory sentence so users can compare multiple result cards by scanning.

## Final UI Copy

### Shared Labels

- Eyebrow: `Deal Score`
- Scope, flight: `Compared with route history`
- Scope, hotel: `Compared with hotel history`
- Fact label: `Usual`
- Fact label: `Vs usual`
- Fact label: `Window`
- Window value: `Last 90 days`

### High-Confidence Score Copy

For `score.confidence === 'high'`:

- Badge: existing `DealBadge` label: `Great`, `Good`, or `Typical`
- Percentile line: `{ordinalPercentile} percentile`
- Usual value: formatted money from `{ priceCents: score.medianCents, currency: score.currency }`
- Vs usual value:
  - `At usual price` when rounded `score.pctVsMedian` is `0`
  - `{absRoundedPercent}% below usual` when rounded value is negative
  - `{absRoundedPercent}% above usual` when rounded value is positive
- Explanation: use `score.explanation`

Example high-confidence flight:

- `Deal Score`
- `Great`
- `Compared with route history`
- `12th percentile`
- `Usual` / `$312`
- `Vs usual` / `28% below usual`
- `Window` / `Last 90 days`
- Existing explanation sentence from `score.explanation`

### Low-Confidence Score Copy

For `score.confidence === 'low'`:

- Badge: existing `DealBadge` label: `Limited history`
- Scope line:
  - Flight: `Compared with route history`
  - Hotel: `Compared with hotel history`
- Percentile line: `Not enough comparable prices for a confirmed rating`
- Confidence rule: `Fewer than 10 comparable prices are available, so this is not a confirmed deal rating.`
- Window value: `Last 90 days`
- Explanation: use `score.explanation` only after the confidence rule.

Do not show a confident percentile claim for low-confidence scores, even if `score.percentile` has a numeric value.

### Invalid Median Money

When `{ priceCents: score.medianCents, currency: score.currency }` fails `isValidMoney`:

- `Usual` value: `Usual unavailable`
- `Vs usual` value: keep the formatted `score.pctVsMedian` only if it is a finite number; otherwise show `Unavailable`
- Never render `$0`, `NaN%`, or a currency inferred from the current fare or hotel price.

### Score Loading

When `loading === true`:

- Render a visible Deal Score loading panel in both flight and hotel cards.
- Accessible status label: `Loading Deal Score.`
- Visible copy: `Checking recent price history`
- Shimmer blocks may be used inside the panel, but the panel must preserve approximately the same height as the loaded state to avoid card shift.

### Score Unavailable

When `loading === false && score === null`:

- Render a visible unavailable panel in both flight and hotel cards.
- Eyebrow: `Deal Score`
- Primary line: `Unavailable right now`
- Flight body: `We could not compare this fare against route history yet. The live price is still shown above.`
- Hotel body: `We could not compare this nightly rate against hotel history yet. The live price is still shown below.`
- Accessible status label:
  - Flight: `Deal Score unavailable for this fare right now.`
  - Hotel: `Deal Score unavailable for this hotel right now.`

Hotel cards must not silently omit the Deal Score panel when scoring is unavailable.

## State Requirements

### Default High-Confidence Great

- Badge uses `DealBadge` with `verdict="Great"` and `confidence="high"`.
- Panel background uses success treatment.
- Show percentile, usual price, median delta, window, and explanation.
- Copy must not say "guaranteed", "best", or imply availability will remain unchanged.

### Default High-Confidence Good

- Badge uses `DealBadge` with `verdict="Good"` and `confidence="high"`.
- Panel background uses brand treatment.
- Same evidence facts as Great.

### Default High-Confidence Typical

- Badge uses `DealBadge` with `verdict="Typical"` and `confidence="high"`.
- Panel background uses neutral raised treatment.
- Same evidence facts as Great and Good.
- Explanation should remain secondary; the card must still show usual price and delta.

### Low Confidence

- Badge must read `Limited history`.
- Do not show percentile.
- Always show the explicit 10-price rule.
- Keep `Window / Last 90 days` visible to clarify the search window even when too few comparable prices exist.

### No Comparable History

- Treat as low confidence if a `DealScore` exists.
- Show the low-confidence state above.
- If no `DealScore` exists, show the score unavailable state.

### Error Or Score Fetch Failure

- If the card receives `score === null` after loading completes, show score unavailable.
- Do not show raw error strings from providers or API responses in the card.
- Do not block fare or hotel price display because score comparison failed.

### Invalid Median

- Keep the panel visible.
- Show `Usual unavailable`.
- Keep confidence and unavailable/limited-history copy conservative.

## Layout Specification

### Shared Panel

Use a single bordered panel inside each card, not a nested card. Radius must stay at or below the existing `--radius-card` value.

Base class pattern:

```tsx
rounded-[var(--radius-card)] border px-3.5 py-3
```

Flight and hotel cards may adjust top margin to match their current spacing, but the internal panel hierarchy must match.

### Header Row

Class pattern:

```tsx
flex items-start justify-between gap-3
```

Left side:

```tsx
min-w-0
```

Eyebrow:

```tsx
text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]
```

Scope and percentile lines:

```tsx
mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-2)]
```

Badge wrapper must be `shrink-0` so it does not compress the text column.

### Evidence Grid

Mobile and desktop class pattern:

```tsx
grid grid-cols-3 gap-2 text-xs
```

At 375px, each value must wrap within its column without horizontal overflow. Use short labels exactly as specified: `Usual`, `Vs usual`, `Window`.

Fact label:

```tsx
text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]
```

Fact value:

```tsx
mt-0.5 font-semibold leading-5 text-[color:var(--text-1)]
```

If implementation testing shows three columns are too tight at 375px for the longest localized currency value, use:

```tsx
grid grid-cols-2 gap-2 text-xs min-[420px]:grid-cols-3
```

In that fallback, `Window` moves to the next row on 375px.

### Explanation And Rule Text

Explanation class pattern:

```tsx
text-xs font-medium leading-5 text-[color:var(--text-2)]
```

Low-confidence rule class pattern:

```tsx
text-xs font-medium leading-5 text-[color:var(--warning)]
```

Unavailable body class pattern:

```tsx
mt-1 text-xs font-medium leading-5 text-[color:var(--text-2)]
```

### Panel Treatments

Use only existing tokens:

- Great high confidence: `border-[color:var(--border-strong)] bg-[color:var(--success-soft)]`
- Good high confidence: `border-[color:var(--border-strong)] bg-[color:var(--brand-soft)]`
- Typical high confidence: `border-[color:var(--border)] bg-[color:var(--bg-raised)]`
- Low confidence: `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]`
- Loading or unavailable: `border-[color:var(--border)] bg-[color:var(--bg-raised)]`

Do not introduce new Deal Score colors.

## Responsive Requirements

### Mobile 375px

- Panel must fit within existing card padding with no horizontal scrolling.
- Badge may wrap under the text column only if needed, but text and badge must not overlap.
- Evidence values must wrap cleanly; do not truncate usual price or percentage values.
- The panel must remain below the flight/hotel title context and above the primary price/CTA area.
- Minimum tappable target requirements apply only to existing links/buttons; the Deal Score panel itself is informational.

### Desktop 1280px

- Flight cards keep the panel in the existing vertical card flow.
- Hotel cards keep the panel in the existing card flow between hotel metadata and price/CTA.
- Evidence grid remains compact and scan-friendly.
- Panel width tracks the card width; do not add side-by-side score cards or floating overlays.

## Accessibility Requirements

- Loading panel uses `role="status"` with `aria-label="Loading Deal Score."`
- Unavailable panel uses `role="status"` with the card-type-specific unavailable aria label.
- Loaded score panels should have an accessible name by using an internal heading or `aria-labelledby` tied to the visible `Deal Score` label.
- Do not rely on color alone. Badge text, percentile/limited-history text, and the confidence rule must communicate the state.
- Keep existing focus ring behavior from `app/globals.css`; the score panel adds no new interactive controls.
- Screen readers should encounter the panel in this order: label, badge/verdict, scope, percentile or limited-history line, Usual, Vs usual, Window, rule or explanation.

## Interaction Rules

- Tap/click: no interaction on the Deal Score panel.
- Keyboard: the Deal Score panel is not focusable unless a future details disclosure is added.
- Loading completion: replace the loading panel with score or unavailable state without moving the price/CTA above it.
- Retry: no retry control in this ticket. Score retrieval remains controlled by the parent result flow.
- Error: render unavailable state; do not expose provider or stack details.

## Implementation Boundaries

UI stage may change:

- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx` only if needed to support layout classes without changing its public contract
- Component tests under `app/components/__tests__/`

UI stage must not change:

- `lib/scoring/scoreDeal.ts`
- Provider adapters
- API routes
- Database baseline logic
- Money or `DealScore` type contracts

## Test Expectations For UI Stage

Add or update component tests to assert:

- Flight high-confidence panel renders `Usual`, `Vs usual`, `Window`, and `Last 90 days`.
- Hotel high-confidence panel renders the same evidence labels.
- Low-confidence panel renders `Limited history` and `Fewer than 10 comparable prices are available, so this is not a confirmed deal rating.`
- Low-confidence panel does not render a percentile claim.
- Flight unavailable score state remains visible.
- Hotel unavailable score state is visible instead of omitted.
- Invalid median money renders `Usual unavailable`.

Manual QA must check:

- Mobile 375px: no overlapping badge/text, no horizontal overflow, evidence values readable.
- Desktop 1280px: score panel remains visually subordinate to price/CTA but prominent enough to explain the verdict.
- Great, Good, Typical, low-confidence, loading, and unavailable states.

## Acceptance Criteria

- One shared Deal Score evidence model is defined for flights and hotels.
- High-confidence scores show verdict, scope, percentile, usual price, median delta, 90-day window, and explanation.
- Low-confidence scores show `Limited history`, no percentile claim, the 10-comparable-price rule, and the 90-day window.
- Score unavailable is visible for both flight and hotel cards.
- Invalid median money never renders as `$0` or `NaN`.
- Implementation can be completed without provider, API, scoring, or type changes.
