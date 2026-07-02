# UX Design: Flight Duration and Layover Certainty

## Inputs

- Discovery: `docs/pipeline/flight-duration-layover-certainty/01-discovery.md`
- Research: `docs/pipeline/flight-duration-layover-certainty/02-research.md`
- Affected surfaces: `lib/types.ts`, `app/components/FlightCard.tsx`, `components/flights/FlightResults.tsx`, `lib/search/sortFlights.ts`, and flight provider adapters under `lib/providers/`.

## Design Goal

Expose itinerary duration and layover certainty as decision support next to price and Deal Score, without implying facts the normalized provider data does not support.

This is solved when a user can scan flight results, identify the cheapest acceptable itinerary by total travel time and layover burden, and understand when duration data is confirmed, partial, or unavailable before leaving expaify.

## Required Normalized Data Contract

UI implementation must not infer timing or layover facts from raw provider payloads or from `stops` alone. Add provider-normalized itinerary fields to `NormalizedFare` before rendering duration states:

```ts
export type ItineraryCertainty = 'confirmed' | 'partial' | 'unavailable'

export interface NormalizedFlightSegment {
  origin: string
  destination: string
  depart: string
  arrive: string
  carrier?: string
  flightNumber?: string
}

export interface NormalizedLayover {
  airport: string
  durationMinutes: number
  overnight?: boolean
  airportChange?: boolean
}

export interface NormalizedItinerary {
  certainty: ItineraryCertainty
  durationMinutes?: number
  arrive?: string
  segments?: NormalizedFlightSegment[]
  layovers?: NormalizedLayover[]
}
```

`NormalizedFare` should include `itinerary?: NormalizedItinerary`.

Certainty rules:

- `confirmed`: total duration, final arrival, and every segment boundary are provider-normalized. For stopped itineraries, layover airport and layover duration are normalized.
- `partial`: provider returned only aggregate duration, aggregate stop count, final arrival, or an incomplete segment list. UI may show total duration if present, but must not show exact layover airports or durations unless `layovers` are complete.
- `unavailable`: no normalized total duration and no normalized segment/layover timing. UI must show unavailable copy only.

Provider adapters own all normalization. Components consume only `fare.itinerary`; they do not inspect Duffel, Amadeus, Kiwi, or Travelpayouts-specific payloads.

## Information Hierarchy

Primary:

- Price and price scope.
- Deal Score chip and CTA.
- Route, carrier, trip type.

Secondary:

- Total duration when confirmed.
- Stop count.
- Departure time.
- Sort and filter controls.

Tertiary:

- Partial or unavailable itinerary copy.
- Layover details.
- Deal Score caution when itinerary timing is not confirmed.
- Provider handoff and baggage caveats.

Deal Score remains price-history based. Duration certainty is a separate signal and must not downgrade or overwrite the score verdict.

## Flight Card Spec

### Collapsed Card: Default Confirmed Timing

Replace the current metadata row under route/carrier with a wrapping scan row:

- First item: duration summary when confirmed, copy `Total 7h 45m`.
- Second item: existing stop chip, copy `Nonstop`, `1 stop`, or `{n} stops`.
- Third item: departure time when available, copy `Departs 8:30 AM`.

Layout:

- Mobile 375px: row wraps naturally below route copy. Duration uses text, not a pill, to avoid competing with the stop badge. Keep price column unchanged.
- Desktop 1280px: duration, stops, and departure time remain on one row when space allows.

Tailwind pattern:

- Metadata container: `mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5`
- Confirmed duration: `text-xs font-bold leading-5 text-[var(--text-1)] tabular-nums`
- Departure time: `text-xs font-semibold leading-5 text-[var(--text-2)]`
- Stop chip: preserve current success/warning chip classes.

Collapsed confirmed examples:

- `Total 2h 55m` + `Nonstop` + `Departs 8:30 AM`
- `Total 7h 45m` + `1 stop` + `Departs 6:10 AM`
- `Total 14h 20m` + `2 stops` + `Departs 10:40 PM`

### Collapsed Card: Partial Timing

When `itinerary.certainty === 'partial'`:

- If `durationMinutes` exists, show `Total 7h 45m` in secondary styling and append a visually quiet certainty label in details, not on the collapsed card.
- If `durationMinutes` is missing, do not show a duration placeholder in the primary scan row.
- Continue showing stop count and departure time.

Tailwind pattern for partial duration:

- `text-xs font-semibold leading-5 text-[var(--text-2)] tabular-nums`

### Collapsed Card: Unavailable Timing

When `itinerary.certainty === 'unavailable'` or `fare.itinerary` is missing:

- Do not put `Duration unavailable` in the primary row.
- Show stop count and departure time only.
- Expanded details carry the unavailable explanation.

This prevents unavailable data from crowding price, Deal Score, and CTA.

## Expanded Details Spec

Add a new itinerary section inside the existing expanded details block, after the Deal Score panel and before `Price scope`.

Section heading:

- `Itinerary timing`

Confirmed copy:

- Nonstop with total duration and arrival: `Total duration: 2h 55m. Arrives 11:25 AM.`
- One stop: `Layover: ATL, 1h 35m`
- Multiple stops: `Layovers: ATL 1h 35m, CDG 2h 10m`
- Overnight connection suffix: append `, overnight` inside that layover item, for example `Layover: KEF, 8h 20m, overnight`
- Airport change suffix: append `, airport change`, for example `Layover: LHR 2h 05m, airport change`

Partial copy:

- With total duration: `Total duration: 7h 45m. Layover details unavailable from provider.`
- With arrival only: `Arrival time confirmed by provider. Total duration and layover details unavailable.`
- With only stop count: `Layover details unavailable from provider.`

Unavailable copy:

- `Duration unavailable from provider.`
- For stopped fares: `Layover details unavailable from provider.`

Deal Score caution copy when score verdict exists and itinerary certainty is `partial` or `unavailable`:

- `Deal Score is based on price history; itinerary duration was not confirmed by the provider.`

Tailwind pattern:

- Section card: `rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] px-3.5 py-3 text-xs font-medium leading-5 text-[var(--text-2)]`
- Heading: `font-bold text-[var(--text-1)]`
- Confirmed timing text: `mt-1 text-[var(--text-2)]`
- Partial/unavailable warning: `mt-2 rounded-[var(--radius-control)] border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--warning)]`
- Deal Score caution: same warning pattern, placed directly after itinerary timing.

## Result Controls Spec

Add duration-aware sorting only after normalized itinerary data exists.

Sort options:

- `Best deal`
- `Lowest price`
- `Shortest duration`
- Existing baggage-adjusted option remains available as currently designed when baggage estimates are ready.

Enablement rule:

- Enable `Shortest duration` only when at least two visible fares have `itinerary.certainty === 'confirmed'` and a finite `durationMinutes`.
- Disabled help copy: `Duration sort needs confirmed itinerary times.`

Sorting rule:

- Sort confirmed-duration fares by `durationMinutes`, then price, then stops, then departure time, then `id`.
- Fares without confirmed duration must not be mixed ahead of confirmed-duration fares for this sort.

Desktop controls:

- Keep the current controls container.
- Use segmented buttons with the existing control style.
- If disabled, apply existing disabled state and include disabled help in `flight-results-controls-summary`.

Mobile controls at 375px:

- The collapsed summary must not truncate the selected stop filter. Replace the single truncating line with a wrapping two-line-safe summary:
  - Line 1: `{visible} of {total} fares`
  - Line 2: `{sort label} | {stop label}`
- If baggage controls are visible, append `| {bag count}` only when it fits on the second line; otherwise move bag count to the expanded controls body.

Tailwind pattern:

- Mobile summary wrapper: `min-w-0 text-xs font-semibold leading-5 text-[var(--text-2)]`
- Summary lines: `block truncate sm:inline`
- Mobile details body: existing `mt-3 grid gap-3 border-t border-[var(--border)] pt-3`

## Result Summary Spec

The desktop result summary cards should remain three cards. Replace the existing `Nonstop options` summary with a duration-aware summary when confirmed timing exists.

Rules:

- If at least one visible fare has confirmed duration, show `Fastest itinerary`.
  - Value: formatted shortest duration, for example `5h 20m`
  - Detail: `{carrier} · {stops label}`
- If no visible fare has confirmed duration, keep `Nonstop options`.
  - Detail: `Duration details will appear when providers return confirmed itinerary times.`

Tailwind pattern remains the current summary card style:

- `rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3`

## Loading State

During search loading:

- Flight skeleton cards should reserve a metadata line wide enough for duration, stops, and departure time.
- Do not show literal `Duration unavailable` while loading.
- Controls summary uses existing loading copy: `Waiting for fares`.
- `Shortest duration` remains disabled until at least two confirmed durations are present.

Skeleton Tailwind adjustment:

- Metadata skeleton row: `h-4 w-44 rounded-[var(--radius-control)] shimmer`
- Keep card height stable so duration arrival does not shift CTA or Deal Score.

## Empty State

No new empty-state panel is needed. Preserve current empty states for missing dates, provider unavailable, no fares, and filters hiding results.

Add duration-specific help only when the user selected `Shortest duration` and the visible set becomes invalid:

- Title remains current empty title.
- Helper copy appended to controls summary: `Duration sort needs confirmed itinerary times.`
- Automatically return sort to `Lowest price` if the active duration sort becomes disabled after filtering.

## Error And Provider-Missing States

Provider timing failure is not a full-result error when price data still exists.

Rules:

- If fares load but timing data is partial/unavailable, render fares normally.
- Show timing caution only in expanded details.
- Do not block CTA solely because duration is missing.
- Do not alter Deal Score verdict solely because duration is missing.
- If provider notices already exist, keep them in the existing search notice panel. Do not add a duplicate itinerary notice above results.

Exact missing-data copy:

- Collapsed card: no missing-duration text.
- Expanded card: `Duration unavailable from provider.`
- Stopped fare expanded card: `Layover details unavailable from provider.`
- Score caution: `Deal Score is based on price history; itinerary duration was not confirmed by the provider.`

## Accessibility And Keyboard

- Existing `Details` button remains the single control for expanding itinerary details.
- The expanded itinerary section should be readable text, not interactive chips.
- Schedule group `aria-label` should include duration when confirmed: `Flight schedule, total duration 7 hours 45 minutes`.
- Duration sort button:
  - `aria-pressed` follows current segmented button pattern.
  - Disabled state uses native `disabled`.
  - Disabled help must be reachable via `aria-describedby="flight-results-controls-summary"`.
- Mobile `summary` must remain keyboard-focusable and preserve visible focus ring.
- Do not add hover-only itinerary content.

## Responsive Requirements

Mobile 375px:

- No horizontal scroll.
- Card grid stays `minmax(0,1fr)_auto`.
- Price column remains readable; duration row wraps under route/carrier, not into the price column.
- CTA remains at least 40px high.
- Mobile controls summary must show fare count, active sort, and active stop filter without overlapping the `Filter` trigger.

Desktop 1280px:

- Flight card collapsed row shows route/carrier, duration, stops, departure, price, score, and CTA without crowding.
- Result control sort buttons fit in the existing control panel. If four sort options exceed available width, use `sm:grid-cols-2 lg:grid-cols-4` for sort buttons.
- Summary cards remain three equal columns.

## Formatting Helpers

Duration:

- Under 60 minutes: `{m}m`
- One hour or more: `{h}h {m}m`
- Omit zero minutes only for exact hours, for example `6h`
- Never show decimal hours.

Arrival time:

- Use existing `formatTime` behavior.
- If arrival crosses calendar day, append `+1 day` after the time in details only, for example `Arrives 6:20 AM +1 day`.

Layover list:

- Single: `Layover: ATL, 1h 35m`
- Multiple: `Layovers: ATL 1h 35m, CDG 2h 10m`
- Unknown airport: do not render a fake airport; use unavailable copy.

## Implementation Notes For UI Stage

- Preserve existing component props and exports.
- UI may add local presentation helpers in `FlightCard.tsx` and `FlightResults.tsx`.
- Shared types should be added in `lib/types.ts`; provider population may require DEV work if UI stage cannot safely normalize provider data.
- If provider adapters are not updated in the UI stage, render the unavailable state from missing `fare.itinerary` and create `DEV-flight-duration-layover-certainty-01` for normalization.
- Do not call provider APIs from components.
- Do not parse vendor-specific payloads in UI.

## Acceptance Criteria

- Collapsed flight cards show confirmed total duration without crowding price, Deal Score, or CTA.
- Expanded details show exact layover copy for confirmed single and multi-stop fares.
- Partial and unavailable timing states use the exact caution copy and never invent layover data.
- `Shortest duration` sort is disabled until at least two visible fares have confirmed durations.
- Mobile 375px controls show active sort and stop filter without truncating the stop filter.
- Desktop 1280px controls and summary cards remain scannable.
- Deal Score verdict, confidence, and explanation remain unchanged by duration certainty.
