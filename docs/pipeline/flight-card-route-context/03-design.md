# UXDES-FLIGHT-CARD-ROUTE-CONTEXT-01: Flight Card Route Context Design

## Inputs

- Discovery: `docs/pipeline/flight-card-route-context/01-discovery.md`
- Research: `docs/pipeline/flight-card-route-context/02-research.md`
- Current component: `app/components/FlightCard.tsx`
- Shared fare contract: `lib/types.ts`
- Design tokens: `app/globals.css`

## Design Goal

Flight cards must show enough schedule context to compare same-route fares before provider handoff. The card must expose outbound departure date for every fare, outbound time when the provider supplied a timestamp, and return context only when `fare.return` exists.

This is UI-only. Do not change providers, API routes, scoring, money handling, deeplink logic, or the `NormalizedFare` contract.

## Hierarchy

Primary:

- Current fare price and price basis.
- Route identity: `{origin} to {destination}`.
- Visible schedule context: `Depart` and optional `Return`.
- Deal Score verdict and explanation.

Secondary:

- Trip type: `Round trip` or `One way`.
- Carrier.
- Stops.
- CTA availability.

Tertiary:

- Provider caveat text under the CTA.
- Low-fidelity schedule cue for date-only provider values.

## Layout

Add a schedule block inside `FlightCard`, directly after the carrier line and before the stops chip. Keep the price block in the existing right column on desktop.

Recommended structure:

```tsx
<div className="mt-3 flex flex-wrap gap-2" aria-label="Flight schedule">
  <ScheduleItem label="Depart" value={fare.depart} />
  {fare.return ? <ScheduleItem label="Return" value={fare.return} /> : null}
  <StopsChip stops={fare.stops} />
</div>
```

`StopsChip` moves into the same flex wrap group as schedule context so schedule fit and connection burden are scanned together.

## Schedule Formatting Rules

Use the existing date/time behavior in `FlightCard.tsx`:

- A value containing `T` is a timestamp.
- A value without `T` is date-only.
- Timestamp display: time is primary, date is secondary.
- Date-only display: date is primary, no time row is rendered.
- Never render `12:00 AM`, `TBD`, `--`, `Unknown time`, arrival time, duration, layover airport, timezone, or overnight copy unless those fields are added to the normalized contract later.

Invalid or empty values are not expected because `NormalizedFare.depart` is required. If formatting fails, fall back to the raw date string rather than inventing a time.

## Component States

Default with timestamp:

- Label: `Depart`
- Primary text: localized time, for example `9:00 AM`
- Secondary text: localized date, for example `Tue, Sep 1`

Round trip with return timestamp:

- Render a second item.
- Label: `Return`
- Primary text: localized time, for example `4:00 PM`
- Secondary text: localized date, for example `Tue, Sep 8`

Date-only provider fallback:

- Label: `Depart` or `Return`
- Primary text: localized date, for example `Tue, Sep 1`
- No secondary placeholder.
- Add accessible text that does not imply a missing error: `Departure date only` / `Return date only`.

One way:

- Keep existing `One way` trip label.
- Render only `Depart`.
- Do not render an empty return slot.

Loading:

- Existing skeleton state remains acceptable.
- Increase the first skeleton group height or add two small shimmer pills below the route skeleton so the loading card approximates the schedule block height.
- Loading skeleton must keep the card stable and must not flash final schedule text.

Empty:

- No separate empty state is required inside `FlightCard`; empty results are handled by the results surface.
- If no fare is passed, keep the existing skeleton branch.

Error / unavailable price:

- Schedule still renders when `fare` exists, even if price is unavailable or deeplink is unsafe.
- Disabled CTA states remain unchanged except for accessible naming where applicable.
- The user should still be able to compare what trip the unavailable result represents.

Mobile 375px:

- Card stays single-column.
- Route, carrier, schedule, stops, price, Deal Score, and CTA must stack without overlap.
- Schedule items and stops wrap across rows.
- No schedule value may be truncated.
- Route may keep `truncate`, but schedule text may not use `truncate`.
- Minimum tap target for CTA remains 48px.

Desktop 1280px:

- Keep existing two-column header: route/schedule on the left, price on the right.
- Schedule stays in the left comparison column.
- Price remains right-aligned.
- Deal Score remains full-width below the header group.

Focus / keyboard:

- Schedule items are informational and must not be tabbable.
- CTA remains the only new-user action in the card.
- Existing focus-visible treatment remains.
- CTA accessible name must include schedule context when available.

Edge cases:

- Long carrier names: carrier may truncate as it does today; schedule must remain visible below it.
- Unknown or blank carrier: keep existing `Unknown carrier` behavior.
- Multi-stop fares: stop chip wraps after schedule items.
- Party-total pricing: price basis copy remains unchanged.
- Low-confidence Deal Score: Deal Score behavior and copy remain unchanged.

## Final UI Copy

Visible strings:

- `Depart`
- `Return`
- `Round trip`
- `One way`
- Existing stop copy remains: `Nonstop`, `1 stop`, `{stops} stops`
- Existing price headings remain: `Traveler fare`, `Passenger total`, `Current fare`
- Existing CTA labels remain: `Review fare details`, `Continue to booking`, `View fare details`, `Price unavailable`, `Provider link unavailable`
- Existing provider caveats remain unchanged.

Accessible-only copy:

- Timestamp schedule item: `{label} {date} at {time}`
- Date-only schedule item: `{label} {date}. Date only.`
- CTA with timestamp: `{ctaLabel} for {origin} to {destination}, departing {date} at {time}, {priceLabel}`
- CTA with date-only departure: `{ctaLabel} for {origin} to {destination}, departing {date}, {priceLabel}`
- Round trip CTA with timestamp return: append `, returning {date} at {time}`
- Round trip CTA with date-only return: append `, returning {date}`

## Tailwind Class Patterns

Schedule group:

```tsx
className="mt-3 flex flex-wrap items-stretch gap-2"
```

Schedule item:

```tsx
className="min-w-[7.25rem] flex-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 sm:max-w-[9.5rem]"
```

Schedule label:

```tsx
className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-2)]"
```

Primary schedule text:

```tsx
className="mt-0.5 text-sm font-bold leading-5 text-[var(--text-1)] tabular-nums"
```

Secondary schedule text:

```tsx
className="text-[11px] font-semibold leading-4 text-[var(--text-3)]"
```

Date-only schedule item may use the same classes. Do not add a warning color for date-only data; it is lower fidelity, not an error.

Skeleton addition:

```tsx
className="mt-3 flex flex-wrap gap-2"
```

with child shimmer blocks:

```tsx
className="h-14 min-w-[7.25rem] flex-1 rounded-[var(--radius-card)] shimmer"
```

## Implementation Notes For UI Stage

- Add a local `ScheduleItem` helper in `app/components/FlightCard.tsx`.
- Reuse `formatDate` and `formatTime`; make invalid-date fallback explicit if needed.
- Remove unused `departTime` and `returnTime` locals if the new helper computes these values directly.
- Keep `CabinBadge` and `sourceLabel` untouched unless separately ticketed.
- Do not introduce new colors, global CSS variables, or external dependencies.
- Do not change `NormalizedFare`, provider adapters, or API responses for this ticket.

## Acceptance Criteria

1. A fare with `depart: '2026-09-01T09:00:00.000Z'` visibly shows `Depart`, `Sep 1`, and a localized `9:00 AM` equivalent.
2. A fare with `return: '2026-09-08T16:00:00.000Z'` visibly shows `Return`, `Sep 8`, and a localized `4:00 PM` equivalent.
3. A fare with `depart: '2026-09-01'` visibly shows `Depart` and `Sep 1`, and does not show `12:00 AM`.
4. One-way fares render no return placeholder.
5. Price, Deal Score, stop chip, and CTA copy remain visible.
6. At 375px width, schedule items wrap without overlapping route, price, Deal Score, or CTA content.
7. At 1280px width, schedule remains in the main comparison column and price remains right-aligned.
8. CTA `aria-label` includes departure context and return context when available.
9. `npx tsc --noEmit --incremental false` exits 0 after implementation.

## Handoff

Next ticket: `UI-FLIGHT-CARD-ROUTE-CONTEXT-01`

Title: `UI Implementation: flight card route context`

Priority: `P0`

Role: `frontend`

Description should reference this design spec and require a UI-only change to `app/components/FlightCard.tsx`.
