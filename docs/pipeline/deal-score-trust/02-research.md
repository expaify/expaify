# UXR-DEAL-SCORE-TRUST-01: Deal Score Trust And Explanation Clarity

## Source

- Discovery: `docs/pipeline/deal-score-trust/01-discovery.md`
- Current code audited: `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `app/components/DealBadge.tsx`, `lib/scoring/scoreDeal.ts`, `lib/types.ts`
- Reference patterns: Google Flights price tracking/price-change confidence; Booking.com Demand API accommodation pricing transparency.

## Research Summary

Deal Score has a defensible scoring model, but the result cards do not present the evidence with a consistent hierarchy. Flight cards under-explain the score by hiding median price and median delta inside one sentence, while hotel cards expose those facts but can remove the Deal Score surface entirely when score retrieval fails. The result is a trust gap: users see the verdict, but they cannot consistently scan what it compared against, how strong the evidence is, or whether `Typical` means normal pricing or a low-confidence safety cap.

## Current Implementation Audit

### Scoring Contract

`DealScore` already contains the fields needed for a transparent evidence summary: `percentile`, `pctVsMedian`, `medianCents`, `currency`, `verdict`, `confidence`, and `explanation` (`lib/types.ts:37`).

`scoreDeal` filters history to the current offer currency (`lib/scoring/scoreDeal.ts:73`), returns low-confidence `Typical` when no comparable history exists (`lib/scoring/scoreDeal.ts:75`), treats at least 10 comparable history points as high confidence (`lib/scoring/scoreDeal.ts:91`), caps all low-confidence scores to `Typical` (`lib/scoring/scoreDeal.ts:121`), and writes high-confidence explanations with current price, percent versus median, usual median price, context, and the last 90 days (`lib/scoring/scoreDeal.ts:135`).

The score model is conservative enough for user trust. The UX problem is presentation, not algorithm correctness.

### Flight Card

`DealBanner` shows the panel treatment, `Deal Score` label, percentile text or low-history text, shared `DealBadge`, and one explanation sentence (`app/components/FlightCard.tsx:168`). It does not separately expose `medianCents` or `pctVsMedian`, even though both fields are available in `DealScore`.

For high-confidence scores, the card relies on a single paragraph to answer "what is normal?" and "how much better/worse is this?" (`app/components/FlightCard.tsx:196`). That makes comparison scanning hard across a list of fares.

For low-confidence scores, the card says "Not enough route history for a confirmed deal rating" (`app/components/FlightCard.tsx:177`) and the badge changes to `Limited history`, but it does not state the rule users need to understand the cap: fewer than 10 comparable same-currency prices means no confirmed `Great` or `Good` claim.

The unavailable flight state is explicit and honest: when score is missing, the card still renders a Deal Score panel saying the fare could not be compared against route history (`app/components/FlightCard.tsx:201`).

### Hotel Card

`HotelDealPanel` exposes a richer evidence stack than flights: percentile, shared badge, usual price from `medianCents`, and `Vs median` from `pctVsMedian` (`app/components/HotelCard.tsx:118`). Low confidence adds warning copy: "Treat this as a rough comparison, not a confirmed deal" (`app/components/HotelCard.tsx:162`).

The hotel panel is closer to the required trust model, but the hierarchy is not reusable across flights because the copy and evidence layout are card-specific. It also still does not state the explicit 10-point minimum.

When `loading` is false and `score` is null, hotel cards render nothing for Deal Score (`app/components/HotelCard.tsx:224`). That is less trustworthy than the flight unavailable state and makes score absence ambiguous: users cannot tell whether history is unavailable, scoring failed, or hotels are not scored.

### Shared Badge

`DealBadge` correctly avoids showing `Great` or `Good` when `confidence` is low by replacing the verdict with `Limited history` (`app/components/DealBadge.tsx:14`). This is a strong foundation, but the badge alone cannot explain the reason or the evidence threshold.

## Reference Pattern Comparison

### Google Flights

Google Flights separates tracking scope and confidence from price-change insight. Its help documentation distinguishes route-level and specific-flight tracking, date-specific and flexible-date tracking, and says price-change emails include an estimated amount and confidence in the estimate. Source: https://support.google.com/travel/answer/6235879

Pattern implication for expaify: Deal Score should expose the scope and strength of evidence next to the verdict. A user should not have to infer whether the card compared route history, hotel history, specific dates, or an unavailable baseline.

Current delta: expaify's scoring sentence includes some of this detail, but the scan layer is inconsistent. Flights show percentile only; hotels show percentile plus usual price and median delta; neither card states the exact confidence threshold.

### Booking.com Accommodation Pricing

Booking.com's Demand API pricing guidance emphasizes named price components, when each component should be shown, and user notification when prices can differ between availability and final preview. It specifically recommends using the final preview as the source of truth and labeling earlier selection-flow prices as estimated or starting-from when they may vary. Source: https://developers.booking.com/demand/docs/accommodations/prices-accommodations

Pattern implication for expaify: when a confidence or freshness boundary exists, the UI should name it plainly at the point of decision. Deal Score should distinguish confirmed comparison evidence from provisional or unavailable evidence the same way pricing guidance distinguishes display price, total, and final preview.

Current delta: expaify is conservative in the scoring function, but the UI does not consistently name the boundary. Low-history `Typical` can look like a true market verdict rather than a protective fallback unless the user reads the longer explanation and understands the hidden threshold.

## Exact Gap

### What Current Code Does

- Computes a conservative score with same-currency historical points, median, percentile, and a high-confidence threshold of 10 comparable prices.
- Caps low-confidence scores to `Typical` and uses `Limited history` in the shared badge.
- Shows flight Deal Score as verdict/percentile/explanation only.
- Shows hotel Deal Score as verdict/percentile/usual price/median delta/explanation when score exists.
- Omits the hotel Deal Score panel entirely when hotel score is unavailable.

### What Reference Patterns Do

- Keep comparison scope visible: route, specific flight, dates, or price component.
- Expose evidence strength or confidence where prediction/comparison could be misread.
- Label provisional or unavailable evidence at the point users compare options.
- Use structured facts for scanability, not only prose.

### Delta To Close

The Deal Score panel needs one shared evidence model across flight and hotel cards:

1. Verdict/confidence badge.
2. Comparison scope: `Route history` or `Hotel history`.
3. Percentile when high confidence; low-history reason when low confidence.
4. Usual price from `medianCents` when valid.
5. Delta from `pctVsMedian`.
6. Lookback window: `Last 90 days`.
7. Explicit confidence rule: `Confirmed when 10+ comparable prices are available`.
8. Explicit unavailable state for both flights and hotels.

## Design Directives

1. **Create a shared Deal Score evidence pattern for flights and hotels.** The panel must always order evidence as: `Deal Score` label, `DealBadge`, comparison scope, percentile/limited-history line, `Usual`, `Vs usual`, `Window`, then one explanation sentence. Flights and hotels may change only the scope noun: `route` versus `hotel`.

2. **Expose median and median delta on flight cards.** Flight Deal Score must show `Usual` using `score.medianCents` and `score.currency`, and `Vs usual` using `score.pctVsMedian`, matching hotel card behavior. Do not recalculate score client-side; only format existing `DealScore` fields.

3. **Make low-confidence copy explicit and testable.** For `score.confidence === 'low'`, the panel must show: `Limited history` badge, no confident percentile claim, and the sentence `Fewer than 10 comparable prices are available, so this is not a confirmed deal rating.` If `medianCents` is invalid or zero, show `Usual unavailable` instead of `$0` or a fake median.

4. **Show unavailable score states on both card types.** When `loading` is false and `score` is null, flight and hotel cards must render a visible Deal Score unavailable panel. Hotel cards must not silently omit the product's primary trust signal.

5. **Keep high-confidence copy conservative but scannable.** For high-confidence scores, the panel must show `Last 90 days`, a formatted ordinal percentile, the usual price, and the median delta. The explanatory sentence can remain from `score.explanation`, but it must be secondary to the facts so users can compare multiple cards without reading paragraphs.

6. **Add regression coverage for evidence parity.** Component tests must assert that flight and hotel score panels both render `Usual`, `Vs usual`, lookback window, low-confidence threshold copy, and unavailable score copy. Existing tests should be updated rather than bypassed.

## Acceptance Criteria For UXDES

- The design spec defines one shared evidence component model that can be implemented inside both `FlightCard` and `HotelCard` without changing provider calls or scoring logic.
- The spec covers high-confidence `Great`, `Good`, `Typical`; low confidence; no score; loading; no comparable history; and invalid median money.
- Final copy includes the 10-comparable-price threshold and the 90-day window.
- Mobile 375px and desktop 1280px layouts keep all evidence readable without nested cards or overflowing pills.
- The spec uses existing tokens from `app/globals.css` and does not introduce new score colors.

## Out Of Scope

- Changing the scoring algorithm, percentile math, confidence threshold, or baseline query.
- Adding provider calls, baseline point counts, or freshness metadata not already present in the score payload.
- Fixing hotel list sorting or booking handoff continuity, except where score-unavailable copy affects the visible card.
