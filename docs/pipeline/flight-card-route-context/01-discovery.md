# UXD-FLIGHT-CARD-ROUTE-CONTEXT-01: Flight Card Route Context

## Problem Statement

Flight result cards show route, carrier, stops, price, and Deal Score, but omit visible departure and return dates/times, so users cannot compare schedule fit or trust what trip each fare represents before opening the booking handoff.

## Affected Users And Flow Step

- **Users affected:** First-time deal seekers and repeat travelers comparing flight results, especially users with fixed date windows, family schedules, work constraints, or same-route fares with different departure times.
- **Flow step:** Results view after a flight search, specifically each rendered flight card before the user chooses "View fare details", "Continue to booking", or "Review fare details".
- **Current surfaces inspected:** `app/components/FlightCard.tsx` renders the card; `lib/types.ts` defines `NormalizedFare.depart` and optional `NormalizedFare.return`.

## Current Behavior Observed

- `NormalizedFare` already requires `depart: string` and allows `return?: string`, so the data contract can carry basic route timing context.
- `FlightCard` defines `formatDate(value?: string)` and `formatTime(value: string)`.
- `FlightCard` computes `departTime` and `returnTime` from `fare.depart` and `fare.return`.
- The rendered card header only shows trip type, origin-to-destination, carrier, stops, price, Deal Score, and the booking CTA.
- The computed date/time values are not rendered anywhere in the card, and `formatDate` is currently unused.
- The CTA aria label includes route and price basis, but not departure date/time or return context.

## Measurable Signal

This problem exists when a flight card has valid `fare.depart` or `fare.return` data and the visible card content does not expose that context.

Primary measurable UX signals:

- A user viewing multiple fares for the same `origin` and `destination` cannot distinguish morning, afternoon, evening, overnight, or return-date differences from the card.
- The card contains unused timing code (`departTime`, `returnTime`, `formatDate`) while the rendered hierarchy omits the schedule.
- The only path to schedule confidence is leaving the result card through the provider or review handoff, increasing premature outbound clicks and eroding trust in the result list.

## Constraints

1. **Data integrity:** Do not invent arrival times, durations, layovers, airport names, or timezone conversions unless those fields are present in provider-normalized data. If only departure and return timestamps exist, show only those facts.
2. **Accessibility and scanability:** Schedule context must be readable by screen readers and keyboard users, and must remain scannable at 375px mobile and 1280px desktop without truncating the route, price, or CTA.
3. **Brand and trust:** The flight card should continue to prioritize Deal Score and price while making route timing explicit enough to compare fares. Copy must avoid overclaiming availability because final price and schedule can still change at handoff.

## Success Statement

This is solved when a first-time user can compare two flight cards for the same route and understand each fare's departure date/time and return context, without opening the provider handoff or guessing whether the cards represent different schedules.

## Downstream Focus

The next stage should audit how flight providers populate `depart` and `return`, compare schedule hierarchy against familiar flight result patterns, and define the minimum route-context display that can be implemented without changing the provider contract.
