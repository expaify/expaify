# UXR-BAGGAGE-FEE-DECISION-CONTEXT-01: UX Research Brief

## Source Discovery

- Discovery report: `docs/pipeline/baggage-fee-decision-context/01-discovery.md`
- Problem statement: Paid users cannot tell whether baggage fees materially change the best flight choice before they commit to a booking path, because baggage cost is estimated separately from the fare cards and is not reflected in the visible price, ranking, or Deal Score context.

## Current Implementation Audit

The current results UI treats baggage as a separate estimate for one selected fare, not as comparison context across the result set.

- `components/flights/FlightResults.tsx:86` defines `cheapestVisibleFare()` by base `fare.price.priceCents`.
- `components/flights/FlightResults.tsx:329` assigns `baggageFare` from the cheapest visible base fare, then `components/flights/FlightResults.tsx:333` reuses that same fare as `cheapestFare`.
- `components/flights/FlightResults.tsx:514` labels the summary metric as "Lowest live fare" and `components/flights/FlightResults.tsx:517` renders only the base fare with `formatMoney(cheapestFare.price)`.
- `components/flights/FlightResults.tsx:563` renders only `Best deal` and `Lowest price` sort controls; neither sort option includes baggage-adjusted totals.
- `components/flights/FlightResults.tsx:618` renders a single `BaggageFeeEstimator` before the card grid using only `baggageFare` carrier, route countries, and cabin.
- `components/flights/FlightResults.tsx:675` maps each visible fare to `FlightCard`, but no baggage props or per-fare baggage estimate are passed.

The fare card itself warns that baggage can change later, but does not help the user compare options now.

- `app/components/FlightCard.tsx:288` labels the primary price as `Passenger total` or `Traveler fare`, both fare-only concepts.
- `app/components/FlightCard.tsx:330` renders the fare price as the top-right price hierarchy.
- `app/components/FlightCard.tsx:337` places Deal Score beside the CTA, but the score still explains the live fare against route history, not bag-adjusted value.
- `app/components/FlightCard.tsx:284` and `app/components/FlightCard.tsx:303` warn that baggage fees can change in provider handoff copy. This is disclosure, not decision support.
- `app/components/FlightCard.tsx:397` expands details with price scope and provider handoff, but still no estimated bag-adjusted total or "best option changed" state.

The baggage model has useful estimate metadata, but its current data shape is not ready to become a precise total without careful labeling.

- `components/baggage/BaggageFeeEstimator.tsx:108` defaults to one carry-on and zero checked bags.
- `components/baggage/BaggageFeeEstimator.tsx:139` fetches `/api/baggage` from the client whenever bag counts or fare context changes.
- `components/baggage/BaggageFeeEstimator.tsx:173` explicitly says the estimate is only for one carrier and cabin.
- `components/baggage/BaggageFeeEstimator.tsx:201` shows included bag counts and `components/baggage/BaggageFeeEstimator.tsx:209` shows "Estimated add-on".
- `components/baggage/BaggageFeeEstimator.tsx:22` converts numeric USD estimates to integer `Money` for display, but `lib/baggage/types.ts` still stores `estimatedTotalUsd` and line totals as numeric dollar values.
- `lib/baggage/fees.ts:22` has carrier rules for a small carrier set plus a default fallback, and `lib/baggage/fees.ts:115` returns low confidence when a carrier rule is missing.

## Reference Pattern Comparison

Google Flights puts baggage at the comparison level. Its help documentation says the Bags filter can show flight prices that include checked or carry-on bag costs so users can better compare prices and avoid surprise fees. It also warns that baggage data comes from partners and estimated fees may be subject to taxes. Reference: https://support.google.com/travel/answer/9074247

KAYAK uses a similar comparison-level pattern. Its pricing help says displayed flight prices do not include optional add-ons like checked bags and carry-ons, while its Fee Assistant pattern lets users add bag counts and see costs including baggage fees in search results. References: https://www.kayak.com/c/help/pricing/ and https://www.kayak.com/news/how-to-get-cheap-flights/

The interaction pattern delta is clear: reference products let the user set baggage expectations once and then compare result prices in that context. expaify currently asks the user to set bags in an isolated module that applies only to the cheapest base fare and does not alter any per-card comparison signal.

## Exact Gap

Current code answers: "What might bags cost for the cheapest base fare?"

The user needs: "With my bags, which option is cheapest or still a good deal?"

The harmful delta appears when two fares are close in base price but have different baggage inclusion or carrier rules. For example, a $250 fare with one checked bag estimated at $40 can be worse than a $280 fare with one checked bag included, but the current UI continues to label the $250 option as the lowest live fare and keeps the $280 option visually secondary.

## Design Directives

1. Move bag count controls into the results comparison controls when fares exist.
   - Required state: a compact `Bags` control beside `Sort by` and `Stops`.
   - Required controls: carry-on count and checked count, each bounded 0-4 with disabled min/max states.
   - Required copy: "Estimated bags" as the fieldset legend, not "Baggage fee estimate".
   - Required behavior: one bag setting applies to every visible fare, including after sort/filter changes.

2. Add per-card baggage context without replacing the confirmed fare price.
   - Required hierarchy: primary price remains confirmed fare price; secondary price line shows "Est. with bags: $X" only when an estimate exists for that fare.
   - Required missing state: if a fare cannot be estimated, show "Bag estimate unavailable" in secondary text and keep the CTA enabled/disabled based on existing provider-link rules.
   - Required confidence state: low-confidence carrier fallback must display "Rough bag estimate" instead of a normal estimate label.
   - Required disclosure: every estimated total must include "estimate" or "est." in visible text.

3. Add a list-level decision summary when baggage changes or confirms the best option.
   - Required copy when the best base fare remains best after bags: "Bags do not change the lowest estimated option."
   - Required copy when the best option changes: "Bags may change the lowest option: [carrier/route] is estimated lowest with bags."
   - Required copy when estimates are incomplete: "Some bag estimates are unavailable, so compare provider terms before booking."
   - Required placement: inside the results refine panel near the summary metrics, before the card grid.

4. Keep sorting honest and explicit.
   - Required sort labels: preserve existing `Best deal` and `Lowest price`; add a third option only if implementation can rank every visible fare by bag-adjusted estimated total.
   - Required label for a new sort option: "Lowest est. total".
   - Required disabled state: if estimates are loading or unavailable for all fares, disable the bag-adjusted sort and explain in the aria-describedby summary: "Bag-adjusted sorting is available after estimates load."
   - Required rule: Deal Score verdict must not be recalculated from baggage estimates unless the scoring contract is explicitly changed in a DEV ticket.

5. Define loading, error, empty, and accessibility states before UI work starts.
   - Loading: bag controls remain usable, per-card estimate rows show "Estimating bags" with stable height.
   - Error: per-card rows show "Bag estimate unavailable"; the list summary uses the incomplete-estimates copy above.
   - Empty results: do not render baggage controls when there are zero returned fares.
   - Mobile 375px: bag controls stack below sort/stops; per-card estimated total wraps below the primary price and must not compete with CTA width.
   - Desktop 1280px: bag controls stay in the refine panel and card rows remain scannable in the existing three-column grid.
   - Keyboard: plus/minus controls must have explicit aria labels naming carry-on or checked bags and must expose disabled states at 0 and 4.

## Acceptance Criteria for UXDES

- The design spec must cover default, loading, partial-estimate, no-estimate, low-confidence, empty-results, mobile 375px, desktop 1280px, focus, and keyboard states.
- The design must preserve the confirmed fare price as primary and present baggage-adjusted totals as estimates only.
- The design must specify whether bag-adjusted sorting is included. If included, it must define loading and partial-data behavior. If excluded, it must explain how the list-level summary still supports decision-making.
- The design must not require new vendor calls from React components beyond the existing internal `/api/baggage` surface unless a DEV ticket is created.
- The design must respect the money contract by requiring UI totals to be rendered from integer cents, even if the current baggage model needs conversion from USD estimate numbers.

