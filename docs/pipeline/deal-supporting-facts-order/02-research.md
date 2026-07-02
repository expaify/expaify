# UXR-DEAL-SUPPORTING-FACTS-ORDER-01: Deal Supporting Facts Order

## Inputs Read

- Discovery report: `docs/pipeline/deal-supporting-facts-order/01-discovery.md`
- Current implementation: `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `app/components/DealScorePanel.tsx`, `app/components/DealBadge.tsx`, `components/flights/FlightResults.tsx`, `lib/scoring/scoreDeal.ts`, `lib/types.ts`
- Current regression coverage: `app/components/__tests__/scorePresentation.test.tsx`

## Research Summary

The current cards contain most of the facts users need, but they do not present those facts in the same decision order a travel shopper uses before committing to a provider handoff. The collapsed card leads with route or hotel identity and current price, then separates Deal Score into a small chip beside the CTA. Normal price, percent versus usual, confidence support, and provider handoff caveats are mostly deferred to `Details`.

Reference travel-result patterns from Booking-style hotel cards and Google Flights-style fare cards generally expose a compact decision sequence before the primary action:

1. Current price and price scope.
2. Primary trip or stay quality tradeoff.
3. Deal or comparison signal with enough evidence to understand why it matters.
4. Availability, taxes/fees, baggage, cancellation, or provider confirmation caveat before handoff.

expaify's differentiator is Deal Score, so hiding all score evidence behind `Details` weakens the collapsed card. The UI does not need to expose the full expanded score panel in every card, but it should expose one compact score-evidence line in the collapsed state whenever score data exists.

## Current Implementation Findings

### Flight Cards

- `FlightCard` maps loading, unavailable, low-confidence, and normal Deal Score states into `ScoreChip`, but the chip only shows `Score pending`, `Score unavailable`, `Limited history`, `Great`, `Good`, or `Typical` with no normal-price evidence (`app/components/FlightCard.tsx:360`).
- The collapsed card shows commercial price and scope in the right rail (`app/components/FlightCard.tsx:508`) and convenience facts such as duration, stops, and departure time in the left rail (`app/components/FlightCard.tsx:489`).
- Baggage estimate appears before the Deal Score row when available (`app/components/FlightCard.tsx:515`), so an ancillary-cost fact can visually interrupt the intended sequence of current price, convenience, score support, confidence, then handoff risk.
- Provider handoff risk is included in the CTA accessible name (`app/components/FlightCard.tsx:466`) and in expanded details (`app/components/FlightCard.tsx:590`), but sighted collapsed-card users see only the CTA label.
- Expanded details begin with `DealScorePanel`, then low-confidence warning, itinerary timing, and price/provider details (`app/components/FlightCard.tsx:561`). This order is defensible after expansion, but the collapsed state lacks the score support needed for fast scanning.

### Hotel Cards

- `HotelCard` has the same collapsed score-chip limitation as flights (`app/components/HotelCard.tsx:364`).
- The collapsed hotel card shows hotel name, class or rating, location, nightly rate, score chip, and review CTA (`app/components/HotelCard.tsx:445`, `app/components/HotelCard.tsx:471`, `app/components/HotelCard.tsx:479`, `app/components/HotelCard.tsx:486`).
- Hotel quality and location evidence are stronger than flight convenience evidence in the collapsed state, but the Deal Score still lacks "usual price" or "vs usual" support before the CTA.
- Provider handoff disclosure is in the review CTA aria label and expanded price scope panel (`app/components/HotelCard.tsx:419`, `app/components/HotelCard.tsx:576`), but visible collapsed copy does not warn that taxes, fees, room availability, cancellation policy, and terms are confirmed later.
- Expanded hotel details place Deal Score before quality evidence, location, and price scope (`app/components/HotelCard.tsx:538`), which matches the intended premium evidence flow once the user opens details.

### Deal Score Panel

- The panel has the right ingredients: usual price, percent versus usual, 90-day window, percentile, confidence warning, and explanation (`app/components/DealScorePanel.tsx:80`, `app/components/DealScorePanel.tsx:145`).
- The expanded panel presents badge and comparison framing before the evidence grid (`app/components/DealScorePanel.tsx:158`, `app/components/DealScorePanel.tsx:168`, `app/components/DealScorePanel.tsx:176`). Users looking for "what would I normally pay?" must scan past label and percentile copy first.
- Low-confidence copy is clear and consistent with scoring logic: fewer than 10 comparable prices are not a confirmed rating (`app/components/DealScorePanel.tsx:13`).

### Scoring Contract

- `scoreDeal` correctly caps low-confidence scores at `Typical` and sets percentile to `50` when fewer than 10 comparable points exist (`lib/scoring/scoreDeal.ts:91`, `lib/scoring/scoreDeal.ts:113`, `lib/scoring/scoreDeal.ts:121`).
- No comparable history returns low confidence, `medianCents: 0`, and a plain explanation (`lib/scoring/scoreDeal.ts:75`). UI must not display `$0` as a normal price.
- Existing presentation tests intentionally assert that collapsed cards do not contain percentile or full explanation (`app/components/__tests__/scorePresentation.test.tsx:93`, `app/components/__tests__/scorePresentation.test.tsx:140`). Any design change that adds collapsed evidence must update these tests deliberately.

## Exact Gap

| Surface | Current code does | Reference pattern does | Delta |
| --- | --- | --- | --- |
| Collapsed flight card | Shows price, duration/stops/departure, optional bags, score label, CTA. | Shows price, trip convenience, price insight/supporting reason, then action caveat. | Score evidence and handoff risk are not visible enough before CTA. |
| Collapsed hotel card | Shows nightly price, class/rating, location, score label, CTA. | Shows nightly price, review/location confidence, deal context, taxes/fees or availability caveat before action. | Deal Score support and visible handoff caveat are deferred to details/ARIA. |
| Expanded Deal Score | Shows badge, comparison scope, percentile, then usual/vs usual/window. | Leads with the user's commercial question: current vs usual, then score confidence and explanation. | Evidence hierarchy should put usual/vs usual before percentile mechanics. |
| Low-confidence state | Correctly avoids Great/Good claims and labels `Limited history`. | Makes uncertainty part of the decision before action. | Low-confidence reason should be visible in collapsed state, not only after opening details. |
| Unavailable score/price/link | Honest disabled/unavailable states exist. | Keeps unavailable facts in the same scan position as available facts. | State placement is good, but copy should maintain the same price -> quality -> confidence -> handoff sequence. |

## Design Directives

1. **Collapsed card fact order must be fixed and testable.** For both flight and hotel cards, the collapsed visible order should be: identity, current price with scope, primary convenience or quality fact, compact Deal Score support, confidence state, visible handoff caveat, CTA. The compact score support belongs before the CTA row or in the same row before the CTA, not below `Details`.

2. **Add one compact score-evidence line to collapsed cards when score exists.** High-confidence example: `Usually $312 - 18% below usual over 90 days.` Typical example: `Usually $312 - at usual price over 90 days.` Low-confidence example: `Limited history - not enough prices for a confirmed deal rating.` If `medianCents` is not valid money, do not show a usual-price amount; use `Limited history` or `Score support unavailable`.

3. **Do not expose percentile as the first supporting fact.** Percentile can remain in expanded details, but collapsed evidence should prioritize `usual`, `vs usual`, and `90 days` because those answer the user's normal-price question faster than percentile mechanics.

4. **Reorder `DealScorePanel` evidence hierarchy.** In expanded state, the first content after the `Deal Score` label should be the evidence grid or a sentence that starts with current-vs-usual evidence. Badge and percentile should remain visible, but percentile should be secondary to `Usual`, `Vs usual`, and `Window`.

5. **Make handoff risk visible before action.** Collapsed flight cards with an enabled provider CTA must show visible text equivalent to `Final price, availability, baggage fees, and provider terms can change.` Collapsed hotel cards with enabled review CTA must show visible text equivalent to `Taxes, fees, room availability, cancellation policy, and terms are confirmed by the provider.` Disabled price/link states should keep their current unavailable copy in the same location.

6. **Keep low-confidence and unavailable states honest.** Low-confidence score states must not display `Great` or `Good`, must not show `$0` as usual, and must include the rule that fewer than 10 comparable prices means the rating is not confirmed. Score-unavailable states should continue to say `Score unavailable` in collapsed cards and explain the comparison is unavailable in details.

7. **Preserve mobile scanability.** At 375px, the compact score-evidence line and handoff caveat may wrap to two lines each, but must not push the CTA out of view, overlap the price column, or require horizontal scrolling. The design spec should define exact wrapping and truncation behavior for long hotel names, provider names, and currency strings.

## Acceptance Criteria For UXDES

- The design spec defines collapsed and expanded hierarchy separately for flights and hotels.
- The spec covers default, loading, empty/unavailable score, low-confidence score, invalid price, invalid provider link, mobile 375px, desktop 1280px, keyboard focus, and screen-reader naming.
- The spec includes final visible copy for compact score evidence and handoff caveats.
- The spec explicitly calls out the existing test contract in `scorePresentation.test.tsx` and whether it should be updated from "no collapsed percentile/explanation" to "collapsed compact evidence allowed, full explanation still detail-only."
- The spec forbids invented data: all usual price, percent-vs-usual, confidence, and explanations must come from `DealScore`; all prices must use `Money`.

## Recommended Next Ticket

Create `UXDES-DEAL-SUPPORTING-FACTS-ORDER-01` to produce an implementation-ready design spec for the revised result-card fact order.
