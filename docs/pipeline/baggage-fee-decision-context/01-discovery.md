# UXD-BAGGAGE-FEE-DECISION-CONTEXT-01: Baggage Fee Decision Context

## Problem Statement

Paid users cannot tell whether baggage fees materially change the best flight choice before they commit to a booking path, because baggage cost is estimated separately from the fare cards and is not reflected in the visible price, ranking, or Deal Score context.

## Affected Users and Flow Step

- **Users affected:** Paid flight-search users comparing multiple cash fares, especially travelers carrying checked bags, basic-economy travelers, families, and users choosing between close-priced carriers.
- **Flow step:** Flight results review immediately before tapping "Review fare" or "Continue to provider."
- **Affected source:** `components/flights/FlightResults.tsx` renders one `BaggageFeeEstimator` for the cheapest visible fare; `app/components/FlightCard.tsx` presents each fare's base price, Deal Score, and booking CTA; `components/baggage/BaggageFeeEstimator.tsx`, `lib/baggage/fees.ts`, and `lib/baggage/types.ts` define the separate baggage estimate experience.

## Current Implementation Signal

- `FlightResults` chooses `baggageFare` with `cheapestVisibleFare(displayFlights)`, so baggage context is attached to only the lowest visible base fare, not to every competing result.
- The results summary labels "Lowest live fare" using the base fare price, while the baggage estimator appears below the refine/alert modules and before the card grid as a separate estimate.
- `FlightCard` CTAs warn that "Final price, availability, baggage fees, and provider terms can change," but the card does not show an estimated bag-adjusted total or whether baggage changes the user's best option.
- Sorting remains limited to `deal` or `price`; the visible price ranking uses `fare.price.priceCents` and does not incorporate `estimatedTotalUsd` from the baggage module.
- The baggage model returns fee estimates in USD as numeric dollar values, while flight pricing uses integer minor-unit `Money`; downstream stages must avoid implying an exact final total unless the estimate is clearly labeled.

## Measurable Signal

- In a first-time paid-user walkthrough at 375px and 1280px, users cannot answer which displayed flight is cheapest after one carry-on and one checked bag without manually combining the separate estimate with individual fare prices.
- Product analytics would show users opening provider/booking links from the base-price winner, then abandoning or returning when provider baggage fees change the effective total.
- Usability signal: users ask whether the displayed fare includes bags, or assume the lowest live fare remains the lowest all-in choice despite the estimator only applying to one selected fare.
- UI signal: there is no per-card or list-level comparison state that names when baggage fees do or do not change the recommended option.

## Constraints

- Preserve trust: baggage costs must be framed as estimates, must not overrule confirmed live fare prices, and must not claim precision beyond carrier/route/fare-brand confidence.
- Preserve data integrity: external provider calls must remain outside components, flight money must stay `{ priceCents: number; currency: string }`, and any conversion from baggage USD estimates must avoid floats in user-facing totals.
- Preserve usability and performance: the solution must work at mobile 375px and desktop 1280px without adding clutter to dense result cards or triggering extra provider searches for client-side baggage count changes.

## Success Statement

This is solved when a first-time paid user can compare flight results with their expected bags and identify whether the best option changes after estimated baggage fees without entering a provider or booking path.

## Handoff Notes for UXR

- Audit `components/flights/FlightResults.tsx` around `baggageFare`, `cheapestVisibleFare`, result metrics, and card rendering order.
- Audit `app/components/FlightCard.tsx` around price hierarchy, Deal Score placement, CTA note copy, and the absence of per-card baggage context.
- Audit `components/baggage/BaggageFeeEstimator.tsx`, `lib/baggage/fees.ts`, and `lib/baggage/types.ts` for estimate confidence, copy, data shape, and money-format implications.
- Compare against travel result patterns that show baggage inclusion or estimated add-on fees at the option-comparison level, not only at checkout.
