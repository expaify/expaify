# UXD-DEAL-SUPPORTING-FACTS-ORDER-01: Deal Supporting Facts Order

## User Pain Point

Deal recommendations feel less premium and less immediately trustworthy when supporting facts are not ordered around the user's fastest decision needs: price first, convenience second, confidence third, and provider handoff risk before action.

## Affected Users And Flow Step

- **Who is affected:** First-time and returning deal seekers comparing flight and hotel results who need to decide quickly whether a card is worth expanding or handing off to a provider.
- **Flow step:** Results review, specifically the collapsed and expanded result cards before the user taps `Details`, `Continue to provider`, `Review fare`, or `Review hotel`.
- **Affected source inspected:** `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `app/components/DealScorePanel.tsx`, `app/components/DealBadge.tsx`, `lib/scoring/scoreDeal.ts`, and `lib/types.ts`.

## Measurable Signal

This problem exists when a valid deal result presents the right facts, but their order forces users to assemble the decision model themselves instead of scanning from commercial value to trip quality to score confidence to handoff risk.

Observable signals in the current implementation:

- Flight and hotel cards place the current price in the primary card header, but Deal Score evidence is split between a collapsed `ScoreChip` and an expanded `DealScorePanel`, so users cannot see the score's price-normality facts until they open details.
- `DealScorePanel` exposes useful evidence such as usual price, percent versus usual, 90-day window, percentile, confidence, and explanation, but the panel starts with badge and comparison framing before the evidence grid, which can delay the user's answer to "what do I normally pay?"
- Flight cards surface convenience facts such as duration, stops, departure time, itinerary timing, baggage estimate, and provider caveats in separate areas; these facts are not explicitly ordered against the Deal Score facts as a single decision sequence.
- Hotel cards surface quality and location evidence in addition to Deal Score, but price scope, score evidence, quality evidence, location risk, and provider handoff disclosures live across separate modules with no explicit priority order.
- Low-confidence score states correctly avoid claiming `Great` in `lib/scoring/scoreDeal.ts`, and `DealBadge` displays `Limited history`, but the decision sequence can still make users encounter confidence warnings after commercial and CTA elements rather than before committing to handoff.
- Provider handoff risk copy exists in both flight and hotel cards, but it is often tied to CTA aria labels or expanded detail sections, meaning sighted users may not see final-price, availability, baggage, taxes, fees, or terms risk before the primary action.

## Constraints

1. **Trust and data integrity:** Deal evidence must remain faithful to `DealScore` and `Money` contracts in `lib/types.ts`; the UI must not invent comparison values, convert currencies client-side, or imply confidence that `scoreDeal` does not provide.
2. **Responsive accessibility:** The ordered facts must remain scannable at 375px mobile and 1280px desktop, preserve keyboard/focus behavior, and communicate confidence and risk without relying on color alone.
3. **Conversion without overclaiming:** The hierarchy should make good deals easy to recognize while keeping low-confidence history, provider freshness, price scope, taxes/fees, baggage, availability, and handoff caveats visible before the user acts.

## Success Statement

This is solved when a first-time user can scan a flight or hotel result and decide whether to continue without hunting for the core facts: the current price, the convenience or quality tradeoff, whether the Deal Score is well supported, and what may change during provider handoff.

## Handoff Notes For UXR

- Audit the collapsed and expanded result-card hierarchy for flights and hotels against the decision order: price, convenience or quality, confidence, then handoff risk.
- Compare how travel result patterns expose current price, normal price, trip convenience, confidence, and provider caveats before a booking or provider handoff action.
- Identify which supporting facts must be visible in the collapsed card versus which can remain behind `Details`.
- Keep the research output testable: define exact ordering directives, copy rules, and state behavior for high-confidence, low-confidence, unavailable score, unavailable price, and provider-link-unavailable cases.
