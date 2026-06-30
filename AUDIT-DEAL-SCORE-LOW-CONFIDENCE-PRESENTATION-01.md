# AUDIT-DEAL-SCORE-LOW-CONFIDENCE-PRESENTATION-01

## Scope

Audited visible Deal Score presentation in the current tree for results and detail surfaces.

Requested first-pass files:
- `app/page.tsx` exists and was inspected.
- `components/TicketCard.tsx` does not exist in this tree.
- `components/TicketSlideOver.tsx` does not exist in this tree.
- `lib/db.ts` does not exist in this tree; current DB files are under `lib/db/`.

Actual score surfaces inspected:
- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/DealBadge.tsx`
- `app/components/HotelCard.tsx`
- `app/deals/[dealId]/page.tsx`
- `lib/scoring/scoreDeal.ts`
- `lib/search/sortFlights.ts`
- `app/api/score/route.ts`
- `lib/db/client.ts`
- `lib/db/getBaseline.ts`

## State Classification

Confident flight score: Clear. `FlightCard` shows `Deal Score`, a rounded percentile such as `12th percentile`, the verdict badge `Great`/`Good`/`Typical`, and the scoring explanation from `scoreDeal`. This is supported by `scoreDeal` only returning high confidence when at least 10 comparable history points exist.

Partial/low-confidence flight score: Clear on the card. Low confidence replaces the precise percentile with `Not enough route history for a confirmed deal rating`, and `DealBadge` replaces the verdict with `Limited history`. This avoids claiming `Great` on thin data.

Unavailable flight score: Clear on the card. `DealUnavailable` shows `Unavailable right now` and `We could not compare this fare against route history yet. The live price is still shown above.`

Confident hotel score: Mostly clear. `HotelCard` shows percentile, verdict, `Usual`, `Vs median`, and explanation. It is more evidence-rich than flight cards.

Partial/low-confidence hotel score: Contradictory. The panel says `Not enough hotel history for a confirmed deal rating` and `Limited history`, but still displays numeric supporting facts: `Usual` and `Vs median`. Those numbers look precise despite the low-confidence warning.

Unavailable hotel score: Unclear. If hotel score loading is false and `score` is null, `HotelCard` renders no Deal Score panel at all. There is no `Deal Score unavailable` equivalent for hotels.

Persisted deal detail confident score: Mostly clear when the record has full fields. The page can show `High confidence`, percentile, and percent versus usual.

Persisted deal detail partial/unavailable score: Unclear. Missing confidence with a stored verdict/score can still render `Great deal score 15` or `Deal score 15` without a confidence qualifier. Low confidence is handled, but incomplete persisted records are not clearly separated from confident records.

Contradictory evidence states: Present for low-confidence hotel score and persisted detail records with missing confidence but available score/verdict.

## Findings

### P0 - Low-confidence hotel cards show precise `Usual` and `Vs median` evidence

File: `app/components/HotelCard.tsx`

Exact copy:
- `Not enough hotel history for a confirmed deal rating`
- `Limited history`
- `Usual`
- `Vs median`
- `Limited hotel history. Treat this as a rough comparison, not a confirmed deal.`

Why this is not trustworthy:
The low-confidence panel correctly warns that history is limited, but it still displays exact median-derived facts. A user can read `Usual $180` and `25% below usual` as a precise claim. This conflicts with the product requirement to avoid falsely precise presentation when provider/history data is thin.

Repro:
1. Render a hotel card with `score.confidence = 'low'`, `medianCents > 0`, and non-zero `pctVsMedian`.
2. Observe the low-confidence warning and exact `Usual`/`Vs median` facts shown in the same panel.

State: Contradictory.

### P1 - Hotel cards have no visible unavailable Deal Score state

File: `app/components/HotelCard.tsx`

Exact behavior:
When `loading` is false and `score` is null, no Deal Score section is rendered.

Why this is not trustworthy:
Flight cards explicitly say `Unavailable right now`. Hotel cards silently omit the score, so users cannot distinguish "not scored yet", "score failed", "provider did not return enough data", or "hotels do not support scoring."

Repro:
1. Render `HotelCard` with a valid hotel, `loading = false`, and `score = null`.
2. Observe that no `Deal Score` label or unavailable explanation appears.

State: Unavailable is unclear.

### P1 - Results count can claim "great deals" without a visible confidence qualifier

File: `app/page.tsx`

Exact copy:
- `{greatCount} great deal(s)`

Why this is risky:
The count is derived from `score?.verdict === 'Great'` only. Current `scoreDeal` caps low-confidence scores to `Typical`, so this is safe for current API-generated scores. But the presentation layer does not check confidence, so malformed/stale/provider-injected scores with `verdict: 'Great', confidence: 'low'` would be counted as great while the card badge says `Limited history`.

Repro:
1. Put a low-confidence `Great` score in `scores`.
2. Header count increments as a great deal, while the card badge suppresses `Great`.

State: Potential contradictory state; currently mitigated by `scoreDeal`.

### P1 - Persisted deal detail can show score/verdict without confidence

File: `app/deals/[dealId]/page.tsx`

Exact copy paths:
- `${deal.scoreVerdict} deal score ${Math.round(deal.dealScore)}`
- `${deal.scoreVerdict} deal`
- `Deal score ${Math.round(deal.dealScore)}`

Why this is not trustworthy:
The detail page only hides precision when `scoreConfidence === 'low'`. If a persisted deal has a score or verdict but missing confidence, the page can still show a strong score summary with no `High confidence`, percentile, or history qualifier.

Repro:
1. Load a persisted deal with `scoreVerdict = 'Great'`, `dealScore = 15`, and no `scoreConfidence`.
2. Observe `Great deal score 15` without a confidence label.

State: Unclear/contradictory for incomplete records.

### P2 - Landing copy implies all searches have 90-day route history

File: `app/page.tsx`

Exact copy:
- `Search current fares and compare each option against recent route history, median price, and deal percentile.`
- `90-day route history`

Why this is risky:
The app does handle thin/no history honestly in result cards, but the first-screen copy implies score evidence is always available. This is less severe than result-card issues because it is marketing context, not the actual result surface.

State: Overconfident setup copy.

## Positive Evidence

Flight low-confidence presentation is strong. `FlightCard` uses `Not enough route history for a confirmed deal rating`, `Limited history`, and the scoring explanation instead of showing a precise percentile.

Flight unavailable score is explicit. `Unavailable right now` tells users the fare is visible but route comparison is not available.

Deal ranking is deferred while scores are loading. `app/page.tsx` passes `deferDealSort` while `rankingUpdating` is true, and `FlightResults` shows `Updating deal ranking as scores finish.`

Sorting logic does not promote low-confidence scores above high-confidence deals. `sortFlights` ranks low-confidence scores after high-confidence verdicts.

## Manual Verification Flow

Flow checked by code path and existing tests:
1. Default results sort is `Best deal`.
2. While scores are loading, results use fallback price ordering and show `Updating deal ranking as scores finish.`
3. After all visible scores settle, `sortFlights` orders by high-confidence verdict, percentile, percent vs median, then fallback price.
4. Opening a separate score explanation surface is not possible in this tree because `components/TicketSlideOver.tsx` is absent and score explanations are inline on `FlightCard`, `HotelCard`, and `app/deals/[dealId]/page.tsx`.

Closest executable coverage:
- `lib/search/__tests__/sortFlights.test.ts` covers Best deal ordering, missing scores, deferred ranking, and low-confidence sorting.
- `app/components/__tests__/scorePresentation.test.tsx` covers flight low-confidence, flight unavailable, hotel score detail, and visible explanation copy.

## Empty, Loading, Error, Mobile, Desktop

Loading:
- Flight score loading uses a skeleton with `aria-label="Loading deal score"`.
- Hotel score loading uses a skeleton but no explicit accessible label.

Empty:
- Missing flight dates: `Add a departure date so providers can return current fares and Deal Scores can be compared honestly.`
- No flight inventory: clear and does not make score claims.
- Hotels unavailable/skipped: clear at tab/page level, but individual hotel score unavailable is silent.

Error:
- Search error state is coherent and does not imply score precision.

Mobile 375px:
- Flight result controls are grid-based with truncation and should fit at 375px.
- Flight score panel uses stacked text and a small badge; copy should wrap without overlap.
- Hotel score panel uses a two-column `Usual`/`Vs median` grid inside a narrow card; long localized currency strings could crowd. No Playwright/browser screenshot was available in this repo to visually confirm.

Desktop:
- Flight cards render in a 3-column grid at large widths. Score panels are compact and hierarchy is readable.
- Hotel cards render in a 3-column grid. Score evidence density is higher but generally readable.

## Visual Self-Review

Hierarchy:
Flight cards separate price, route, score, and CTA clearly. Hotel cards place score above price, which is acceptable but makes low-confidence numeric evidence prominent.

Contrast:
Score states use warning/success/brand panels. Low-confidence warning is visually distinct.

Spacing:
Score panels have enough internal spacing in code. Hotel low-confidence panel is dense because it includes warning copy, exact evidence, and explanation.

Mobile fit:
Likely acceptable for flight cards at 375px. Hotel score evidence grid is the main risk for crowding.

Focus states:
Sort/filter controls and provider CTAs have focus styles. Score panels themselves are informational and not focusable.

Decorative effects:
No cheap score-specific decorative clutter found. The only concern is the result header uses a fire emoji for great deal count, which is visually promotional for a trust anchor.

## Verification Commands

`npm run tsc`
- Failed: package has no `tsc` script.

`npx tsc --noEmit --incremental false`
- Passed.

`npm test -- --runInBand`
- Passed: 20 suites, 172 tests.

`npm test -- --passWithNoTests`
- Passed: 20 suites, 172 tests.

## Blockers / Out-of-Scope

No feature code was changed.

No browser screenshot tooling is installed in this repo (`node_modules/.bin` has `next` but no Playwright), so 375px/desktop visual fit was reviewed from component structure, CSS classes, and existing render tests rather than live screenshots.
