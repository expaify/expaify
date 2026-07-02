# UX Discovery: Price Alert Signup Discoverability

Ticket: `UXD-PRICE-ALERT-SIGNUP-01`
Stage: UX Discovery
Priority: P1
Date: 2026-07-02

## Problem Statement

Price alert signup is only exposed after a user has already scanned all eligible flight results, so users who do not reach the bottom of a completed results list miss the route-tracking value proposition.

## Affected Users And Flow Step

Affected users are first-time and returning flight-search users who want to monitor a fare instead of booking immediately, especially paid users evaluating whether expaify will keep watching a route for them.

The issue occurs in the results step after a flight search completes. The current route-tracking form is rendered inside `components/flights/FlightResults.tsx` after the flight result card grid, not near the initial result summary, search notice, sort controls, or empty/loading states.

## Current Implementation Signal

- `app/page.tsx` owns alert state with `alertEmail`, `alertSent`, `alertLoading`, and `alertError`, resets the signup on each new search, and submits to `/api/alerts`.
- `components/flights/FlightResults.tsx` receives the alert state and renders the "Track this route" form only when `!isSearching`, `dest.trim()` is present, and `flights.length >= 3`.
- The signup appears after the result grid, so its vertical position depends on the number of result cards. With three or more results, the user must pass result cards before seeing the alert CTA.
- Searches with one or two fares, empty inventory, provider-unavailable states, filters that hide fares, loading states, hotel-only active tab, and route searches without a destination do not expose the signup at all.

## Measurable Signal

The product signal is low price-alert discovery and conversion relative to eligible searches:

- Eligible completed destination flight searches can render result cards without any above-the-fold alert affordance.
- The alert form is gated behind `flights.length >= 3`, so eligible route searches with one or two current fares have a zero signup opportunity.
- On mobile 375px, the alert form is likely below multiple result cards, increasing scroll depth before exposure.
- A first-time user can finish comparing top fares or leave from a flight card before seeing the route-tracking option.

Recommended analytics for downstream validation:

- Alert CTA impression rate per completed destination flight search.
- Alert signup conversion per CTA impression and per eligible search.
- Median scroll depth before CTA impression on 375px and desktop.
- Drop-off from results page before alert CTA impression.

## Constraints

1. Preserve trust and data integrity: do not promise alerts for incomplete route data, missing destinations, or searches where the backend cannot determine an alert threshold.
2. Respect performance and scanning: the alert affordance must not delay fare rendering, obscure Deal Score comparison, or compete with critical provider notices.
3. Maintain accessibility and responsive usability: the signup must be reachable by keyboard, have explicit labels and status/error messaging, and remain usable at 375px mobile and 1280px desktop.

## Success Statement

This is solved when a first-time user can discover and submit a price alert for a completed destination flight search without scrolling past the full result list or guessing that route tracking exists.

## Handoff Notes For UX Research

Research should audit whether the alert CTA belongs in the result summary, as a persistent route-tracking module near controls, or as contextual affordance in empty/low-inventory states. The next stage should also define whether one or two fare results are eligible for alert signup and what copy is required when alert threshold confidence is limited.
