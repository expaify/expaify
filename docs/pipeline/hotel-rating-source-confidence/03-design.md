# UX Design: Hotel Rating Source Confidence

Ticket: `UXDES-HOTEL-RATING-SOURCE-CONFIDENCE-01`
Stage: UX Design
Priority: P1
Date: 2026-07-02

## Upstream Inputs

- Discovery: `docs/pipeline/hotel-rating-source-confidence/01-discovery.md`
- Research: `docs/pipeline/hotel-rating-source-confidence/02-research.md`
- Affected surface: `app/components/HotelCard.tsx`
- Current contract gap: `lib/types.ts` has `stars`, optional `rating`, and `source`, but no rating kind, source label, scale, review count, freshness, or confidence.

## Problem Statement

Hotel result cards must separate hotel class from verified guest rating so users can compare quality signals without mistaking inferred star-class data for guest-review evidence.

## Design Goal

A first-time user at 375px mobile and 1280px desktop can tell whether each hotel has:

- a hotel class signal,
- a verified guest rating,
- provider-only or incomplete review evidence,
- or no usable quality evidence,

without relying on icon color, star shape, or provider-link handoff.

## Required Data Contract

UI-only work is not sufficient for the complete solution. DEV must add provenance fields before the UI can display verified guest-rating labels.

Recommended additive contract:

```ts
export type HotelQualityKind =
  | 'hotel_class'
  | 'guest_review'
  | 'provider_quality'
  | 'inferred'
  | 'unknown';

export type HotelQualityConfidence =
  | 'verified'
  | 'provider_only'
  | 'inferred'
  | 'unavailable';

export interface HotelRatingEvidence {
  kind: HotelQualityKind;
  value?: number;
  scaleMax?: number;
  sourceLabel?: string;
  reviewCount?: number;
  fetchedAt?: string;
  confidence: HotelQualityConfidence;
}

export interface HotelOffer {
  // existing fields remain
  stars: number;
  rating?: number;
  source: string;

  hotelClass?: HotelRatingEvidence;
  guestRating?: HotelRatingEvidence;
}
```

Migration rule:

- Existing `stars` maps only to `hotelClass` with `kind: 'hotel_class'`, `scaleMax: 5`, and `confidence: 'provider_only'` unless the provider explicitly marks it as verified official class.
- Existing legacy `rating` must not be displayed as a guest rating unless DEV proves `kind: 'guest_review'`, a compatible `scaleMax`, and `confidence: 'verified'`.
- Hotellook `stars` copied into `rating` must be treated as `hotelClass`, not `guestRating`.
- UI must not invent `reviewCount`, `sourceLabel`, `scaleMax`, `fetchedAt`, or `confidence`.

## Information Hierarchy

Primary:

- Hotel name.
- Nightly rate or price unavailable state.
- Primary action: `Review hotel` or `Booking unavailable`.

Secondary:

- Deal score chip.
- Compact quality summary: hotel class first, verified guest rating second when available.

Tertiary:

- Expanded quality evidence: source, scale, review count, confidence, and freshness.
- Price scope and provider handoff details.

## Collapsed Card Pattern

Location: below hotel name, replacing the current mixed star/rating row.

Layout:

- Use a wrapping horizontal evidence row: `flex min-w-0 flex-wrap items-center gap-1.5`.
- Each evidence item is a compact text chip, not a large decorative badge.
- Hotel class appears before guest rating.
- Omit unknown guest ratings from the collapsed row.

Visible copy rules:

- Hotel class present: `4-star hotel`
- Hotel class fractional or provider decimal: round only for star icon fill, but text must show provider value if meaningful: `4.5 of 5 hotel class`
- Verified guest rating: `8.7/10 guest rating`
- Verified guest rating with compact review count: `8.7/10 guest rating · 1,248 reviews`
- Provider rating without review count: `8.7/10 provider rating`
- No class and no verified rating: omit the quality row from collapsed card.

Do not use these labels unless `guestRating.kind === 'guest_review'` and `guestRating.confidence === 'verified'`:

- `Excellent`
- `Very good`
- `Good`

Qualitative label thresholds for verified 10-point guest ratings only:

- `Excellent`: `value >= 8.5`
- `Very good`: `value >= 8 && value < 8.5`
- `Good`: `value >= 7 && value < 8`
- Below 7: show the numeric rating only, no qualitative label.

## Expanded Details Pattern

Location: inside the existing details panel, above or directly after `Price scope`.

Section title:

- `Quality evidence`

Section layout:

- Use one bordered evidence panel, not nested cards.
- Use a two-column definition layout on desktop and single-column stacked rows on mobile.
- Each row has a short label and a plain-language value.

Rows and copy:

- Hotel class row:
  - Label: `Hotel class`
  - Present value: `4-star hotel class from Hotellook`
  - Present value with scale: `4 of 5 hotel class from Hotellook`
  - Missing value: `Class not provided`
- Guest rating row:
  - Verified: `8.7/10 guest rating from Booking.com`
  - Verified with label: `Excellent guest rating: 8.7/10`
  - Provider-only: `8.7/10 provider rating from Hotellook`
  - Inferred: `No verified guest rating`
  - Missing: `Guest rating not provided`
- Review count row:
  - Present: `1,248 guest reviews`
  - Missing on guest/provider rating: `Review count not provided`
  - Missing when no rating: `No review count available`
- Confidence row:
  - Verified: `Verified guest reviews`
  - Provider-only: `Provider rating; review source not confirmed`
  - Inferred: `Not shown as a guest rating because it matches hotel class data`
  - Unavailable: `No rating evidence from this provider`
- Updated row:
  - Present: `Updated Jul 2, 2026`
  - Missing: `Freshness not provided`

Expanded section helper copy:

- Verified guest review: `Guest ratings are shown only when the provider identifies the score as guest-review data.`
- Provider-only rating: `This score is shown for context, but the provider did not include enough review evidence to verify it.`
- Inferred or legacy rating: `We do not label inferred hotel data as a guest rating.`
- No evidence: `This provider did not return hotel class or verified guest-rating evidence.`

## State Specifications

### Default: Hotel Class And Verified Guest Rating

Collapsed:

- `4-star hotel`
- `8.7/10 guest rating · 1,248 reviews`

Expanded:

- Hotel class: `4-star hotel class from Hotellook`
- Guest rating: `Excellent guest rating: 8.7/10`
- Review count: `1,248 guest reviews`
- Confidence: `Verified guest reviews`
- Updated: provider date or `Freshness not provided`

### Star-Class Only

Collapsed:

- `4-star hotel`

Expanded:

- Hotel class: `4-star hotel class from Hotellook`
- Guest rating: `Guest rating not provided`
- Review count: `No review count available`
- Confidence: `No verified guest-rating evidence from this provider`

### Rating Without Review Count

Collapsed:

- If verified guest review: `8.7/10 guest rating`
- If provider-only: `8.7/10 provider rating`

Expanded:

- Review count: `Review count not provided`
- Confidence copy must match confidence:
  - verified: `Verified guest reviews`
  - provider-only: `Provider rating; review source not confirmed`

### Inferred Or Unknown Rating

Collapsed:

- Show hotel class if present.
- Do not show numeric guest-rating copy.
- Do not show `Excellent`, `Very good`, or `Good`.

Expanded:

- Guest rating: `No verified guest rating`
- Confidence: `Not shown as a guest rating because it matches hotel class data`

### No Rating And No Class

Collapsed:

- Omit quality row entirely.

Expanded:

- Hotel class: `Class not provided`
- Guest rating: `Guest rating not provided`
- Review count: `No review count available`
- Confidence: `No rating evidence from this provider`

### Loading

The current hotel results arrive after search streaming. While hotel cards or score panels are loading:

- Keep existing card skeleton/score loading behavior.
- Do not render placeholder ratings such as `0.0`, empty stars, or fake review counts.
- If quality evidence is pending independently, show `Quality evidence pending` only inside the expanded details area with `aria-live="polite"`.

### Empty

For no hotel results:

- Keep the page-level empty hotel result state.
- Do not show quality evidence controls or explanatory cards when there are no hotels.
- Empty-state copy should stay result-focused: `No hotel options found for these dates.`

### Error

For hotel provider failure:

- Keep hotel results unavailable without blocking flight results.
- Error copy: `Hotel quality details are unavailable because hotel results could not be loaded.`
- Do not render stale quality evidence unless it came from the same hotel result payload.

### Mobile 375px

Collapsed card:

- Keep the current three-column card structure only if hotel name, quality row, and price do not overlap.
- Quality row must wrap under the hotel name before it reaches the price column.
- Use `text-xs`, `leading-4`, and `max-w-full` for evidence chips.
- Use no more than two visible quality chips in collapsed state.

Expanded details:

- Stack evidence rows vertically.
- Use labels above values if horizontal space is tight.
- Minimum tap target for `Details`, `Hide details`, and `Review hotel`: 40px.

### Desktop 1280px

Collapsed card:

- Evidence row may show class, rating, and compact review count on one line.
- Keep the price column right-aligned.
- Do not add a second visual rating badge in collapsed state.

Expanded details:

- Use `grid grid-cols-2 gap-x-6 gap-y-3` for evidence rows.
- Keep the section width inside the existing card body; do not create a separate floating card.

### Focus And Keyboard

- `Details` remains a real `button`.
- `Enter` and `Space` toggle expanded details.
- `aria-expanded` and `aria-controls` must reflect state.
- Focus outline uses existing global `:focus-visible` and `--focus-ring`.
- No interactive controls are added inside quality evidence unless a future source link is explicitly available.

### Assistive Technology

Screen reader text must include the semantic distinction:

- Hotel class: `Hotel class: 4 out of 5.`
- Verified guest rating: `Guest rating: 8.7 out of 10 from 1,248 guest reviews.`
- Provider-only: `Provider rating: 8.7 out of 10. Review count not provided.`
- Inferred: `No verified guest rating. Provider value matches hotel class data.`
- Missing: `Hotel class not provided. Guest rating not provided.`

Star icons, if retained, must use `aria-hidden="true"` when adjacent text already states the class. If a star-only visual remains, its container must have an `aria-label` that says `Hotel class`, not `stars`.

## Tailwind Class Patterns

Use existing design tokens from `app/globals.css`; do not add new colors.

Collapsed evidence row:

```tsx
<div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold leading-4 text-[color:var(--text-2)]">
```

Neutral evidence chip:

```tsx
<span className="inline-flex max-w-full items-center gap-1 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-xs font-semibold leading-4 text-[color:var(--text-2)]">
```

Verified guest rating chip:

```tsx
<span className="inline-flex max-w-full items-center gap-1 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--success-soft)] px-2 py-1 text-xs font-bold leading-4 text-[color:var(--success)]">
```

Provider-only chip:

```tsx
<span className="inline-flex max-w-full items-center gap-1 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-muted)] px-2 py-1 text-xs font-semibold leading-4 text-[color:var(--text-2)]">
```

Expanded evidence panel:

```tsx
<section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)]">
```

Expanded evidence grid:

```tsx
<dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6">
```

Evidence label:

```tsx
<dt className="font-bold text-[color:var(--text-1)]">
```

Evidence value:

```tsx
<dd className="mt-0.5 font-medium text-[color:var(--text-2)]">
```

Warning/inferred helper:

```tsx
<p className="mt-3 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2 text-xs font-semibold leading-5 text-[color:var(--warning)]">
```

Unavailable helper:

```tsx
<p className="mt-3 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-3)]">
```

## Interaction Rules

- Tapping `Details` expands quality evidence, deal score details, price scope, and provider handoff in one panel.
- Tapping `Hide details` collapses the panel and leaves focus on the same button.
- Tapping `Review hotel` keeps the existing review/handoff flow.
- Quality evidence is informational; it must not block booking when price and deeplink are valid.
- If provider data is malformed, suppress the malformed rating and show the conservative expanded copy for unavailable evidence.

## UI Implementation Notes

- Replace `RatingBadge` with a provenance-aware `HotelQualityEvidence` rendering path.
- Keep the existing `HotelCard` props and export name.
- Current legacy `hotel.rating` must be ignored for qualitative guest labels until DEV adds provenance.
- Current Hotellook-backed results should render as star-class-only by default.
- The UI stage can ship a safe interim state by removing guest-rating labels for legacy `rating`, but the complete acceptance criteria require DEV changes to `HotelOffer` and provider normalization.

## Handoff

Create `DEV-HOTEL-RATING-SOURCE-CONFIDENCE-01` after UI implementation because the complete solution requires data-contract and provider-normalization changes. UI may go first only as a conservative repair that suppresses misleading guest labels.
