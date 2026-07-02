# UXR-FLIGHT-CARD-ROUTE-CONTEXT-01: Flight Card Route Context Research

## Inputs

- Discovery: `docs/pipeline/flight-card-route-context/01-discovery.md`
- Current card: `app/components/FlightCard.tsx`
- Shared fare contract: `lib/types.ts`
- Provider normalization checked: `lib/providers/travelpayouts.ts`, `lib/providers/duffel.ts`, `lib/providers/amadeus.ts`, `lib/providers/kiwi.ts`
- Reference patterns: Google Flights support describes results that are filtered by stops, airlines, and times and selected by travel dates; Booking.com flight guidance emphasizes comparing flight options after selecting dates and airports.

## Current Implementation Audit

The data contract already supports minimum route timing. `NormalizedFare` requires `depart: string` and allows `return?: string`, so every flight card can know at least the outbound departure value and may know return context.

`FlightCard` already contains formatting helpers for route timing:

- `formatDate(value?: string)` formats a timestamp or date-only string as `Wed, Sep 2`.
- `formatTime(value: string)` returns a localized time only when the value contains `T`.
- `departTime` and `returnTime` are computed from `fare.depart` and `fare.return`.

The computed timing values are not rendered. The visible hierarchy currently shows:

- Trip type: `Round trip` or `One way`
- Route: `JFK to LAX`
- Carrier
- Stops
- Price and price basis
- Deal Score panel
- Booking/review CTA and provider caveat

The card also defines `CabinBadge` and `sourceLabel`, but neither is rendered. That is adjacent cleanup signal, not part of this ticket.

The existing test fixture in `app/components/__tests__/scorePresentation.test.tsx` includes a fare with `depart: '2026-09-01T09:00:00.000Z'` and `return: '2026-09-08T16:00:00.000Z'`, but the presentation tests only assert Deal Score and price messaging. There is no regression test requiring visible departure or return context.

## Provider Data Findings

The gap is primarily a UI hierarchy gap, with one provider-data constraint:

- Travelpayouts can provide date-only values from `depart_date` / `return_date`, and can provide timestamp-like values from `departure_at` / `return_at`. Its fallback for cheap fares may use the searched date when provider timing is absent.
- Duffel normalizes `depart` from the first slice `departing_at`, and for round trips sets `return` from the last slice `arriving_at`.
- Amadeus normalizes `depart` from the first segment departure time when available, with fallback to the requested departure date. For round trips, `return` is the final return segment arrival when available.
- Kiwi normalizes `depart` from `local_departure` and sets `return` from the last route segment `local_arrival` when multiple route segments exist.

Design must therefore handle two valid timing qualities:

- Date + time: show both date and time.
- Date only: show the date and explicitly avoid a fake time.

Do not infer arrival time, duration, connection airport, overnight flags, timezone, or return departure time unless the provider contract adds those fields later.

## Reference Pattern Comparison

Google Flights and Booking-style flight result lists make schedule context part of the comparison layer, not a post-click detail. The usual pattern is:

- Route and airline identify the option.
- Outbound timing appears near the top of the card/list row.
- Return timing appears for round trips, usually in the same schedule group.
- Stops sit next to schedule because schedule fit and connection burden are evaluated together.
- Price remains the dominant decision anchor on the opposite side or lower summary area.

Expaify currently matches the price/deal emphasis, but it breaks the comparison model by making two same-route fares look equivalent even when `depart` and `return` differ. The user can see deal quality before schedule fit, which is backwards for trust: a cheap fare is not actionable until the traveler knows which trip it represents.

## Exact Gap

Current code:

- Has route timing data in `NormalizedFare`.
- Computes `departTime` and `returnTime`.
- Renders no date or time strings.
- Labels the CTA only by route and price basis.

Reference pattern:

- Exposes outbound and return timing in the card/list row before provider handoff.
- Keeps time/date visible without requiring the user to open details.
- Places stop count beside the schedule context.

Delta:

- Add a visible schedule block to `FlightCard` using existing `fare.depart` and `fare.return`.
- Preserve price and Deal Score prominence.
- Treat date-only provider values as valid but lower-fidelity schedule data.

## Design Directives For UXDES

1. Add a `Schedule` block directly below the route/carrier group and above Deal Score. It must show outbound context for every fare using final copy `Depart` as the label and formatted date as the required value.

2. For timestamp values containing `T`, show time as the primary schedule text and date as secondary text. For date-only values, show the date as the primary text and show no time placeholder. Do not render `--`, `TBD`, or guessed midnight.

3. For round trips with `fare.return`, show a second schedule item labeled `Return`. If `fare.return` is absent, do not show a return placeholder; keep the existing `One way` trip label.

4. Keep `StopsChip` visually tied to schedule context. On mobile 375px, schedule items and stops must wrap into readable rows without truncating dates or times. On desktop 1280px, price may remain right-aligned, but schedule must remain in the main comparison column.

5. Update CTA accessible naming to include schedule context when available, for example: `View fare details for JFK to LAX departing Mon, Sep 1 at 9:00 AM, per person fare for this trip`. For date-only values, omit `at`.

## Acceptance Checks For Later Stages

- A fare with `depart: '2026-09-01T09:00:00.000Z'` visibly includes `Depart`, `Sep 1`, and a localized `9:00 AM` equivalent.
- A fare with `return: '2026-09-08T16:00:00.000Z'` visibly includes `Return`, `Sep 8`, and a localized `4:00 PM` equivalent.
- A fare with `depart: '2026-09-01'` visibly includes `Depart` and `Sep 1`, and does not show `12:00 AM`.
- The card remains usable at 375px without overlapping price, route, Deal Score, CTA, or schedule text.
- Existing Deal Score and price copy remain visible and unchanged except for vertical spacing needed to fit schedule.
