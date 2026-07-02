# UXD-DEAL-SCORE-TRUST-01: Deal Score Trust And Explanation Clarity

## Pain Point

Users see a Deal Score verdict such as Great, Good, or Typical, but the results card does not consistently explain what evidence produced that verdict, how recent the comparison is, or when the score should be treated as low confidence.

## Affected Users And Flow Step

- **Who is affected:** First-time users comparing flight and hotel results who must decide whether expaify's Deal Score is trustworthy enough to influence booking intent.
- **Flow step:** Results cards, specifically `DealBanner` in `app/components/FlightCard.tsx`, `HotelDealPanel` in `app/components/HotelCard.tsx`, and the scoring output from `lib/scoring/scoreDeal.ts`.
- **Trust risk:** The verdict can become the most memorable signal on the card, but users may not understand that it is based on route or hotel price history, percentile rank, median comparison, and confidence thresholds.

## Current Implementation Signals

- `lib/scoring/scoreDeal.ts` calculates percentile with midpoint rank against comparable same-currency history, compares the current price against the median, and caps low-confidence scores at `Typical` when fewer than 10 comparable history points exist.
- `lib/scoring/scoreDeal.ts` explanations mention the current price, typical price, route or hotel context, and the last 90 days for high-confidence scores.
- `app/components/FlightCard.tsx` shows `Deal Score`, a percentile label, a `DealBadge`, and `score.explanation`, but it does not show the usual price, percent versus median, lookback window, or minimum data threshold as separate scan-friendly facts.
- `app/components/HotelCard.tsx` shows more supporting evidence than flights: usual price, percent versus median, low-confidence warning copy, percentile label, badge, and explanation.
- Low-confidence UI is clearer for hotels than flights. Flights change the percentile label to "Not enough route history for a confirmed deal rating", but do not separately explain the minimum history rule or why the verdict may remain `Typical` even when the price appears low.
- Flight and hotel cards present the same score concept with different evidence hierarchy, which can make the Deal Score feel less like a consistent product system and more like card-specific copy.

## Measurable Signal

This problem exists when a first-time user cannot answer these questions from the result card without inferring hidden logic:

1. **What is this score comparing against?** Recent route or hotel price history.
2. **What is normal?** The median or usual price for the same comparable context.
3. **How strong is the evidence?** Whether there are at least 10 comparable historical price points.
4. **Why did this verdict appear?** Percentile and percent-versus-median should support Great, Good, or Typical in plain language.

Observable QA signals:

- Flight cards omit the usual price and percent-versus-median facts that hotel cards expose.
- The same `DealScore` data model is rendered with inconsistent hierarchy between flight and hotel cards.
- Low-confidence score states do not consistently state the reason: fewer than 10 comparable same-currency historical prices.
- A `Typical` badge can appear with limited history, but the UI does not make it obvious that this is a protective cap rather than a claim that the price is truly typical.
- Users must read a full sentence explanation to understand the score; the card lacks a compact evidence summary for scanning across multiple results.

## Constraints

1. **Brand trust:** Copy must be transparent and conservative. expaify should explain the score without overclaiming certainty, especially on thin data.
2. **Performance:** The solution must use the existing `DealScore` payload where possible and must not add blocking provider or scoring calls to result-card rendering.
3. **Accessibility:** Verdict, confidence, comparison details, loading states, and unavailable states must be readable by assistive tech and understandable without relying on color alone.
4. **Data integrity:** Money must remain `{ priceCents: number; currency: string }`; UI must not introduce floats, inferred currencies, or client-side recalculation that diverges from `lib/scoring/scoreDeal.ts`.
5. **Consistency:** Flight and hotel score panels should use the same explanation model while preserving context-specific labels such as route history versus hotel history.

## Success Statement

This is solved when a first-time user can compare flight or hotel results and understand why a Deal Score verdict appeared, what price history it used, and whether the score is high or low confidence without treating a thin-data score as a confirmed deal.

## Downstream Focus

The research stage should audit the score panel hierarchy on flight and hotel cards, then define a consistent evidence pattern for:

- Great, Good, and Typical high-confidence scores.
- Low-confidence scores with fewer than 10 comparable history points.
- No-history or no-comparable-currency explanations.
- Flight result cards that currently omit usual price and percent-versus-median details.
- Hotel result cards that already expose more evidence but may need tighter hierarchy and copy alignment.
