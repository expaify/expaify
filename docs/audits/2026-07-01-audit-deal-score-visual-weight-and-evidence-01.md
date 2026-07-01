# AUDIT-DEAL-SCORE-VISUAL-WEIGHT-AND-EVIDENCE-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Deal Score visual weight, label clarity, confidence handling, supporting evidence, and state coverage across result cards and visible detail surfaces.

## Verdict

Not ready for signoff.

The current UI does some important things correctly: low-confidence cards avoid confirmed `Great` claims, loading and empty states are present, and the main flight card keeps Deal Score close to the live fare and booking CTA. The trust surface still fails in three material ways:

1. The detail page promotes an unexplained numeric `deal score` headline that does not match the shared Deal Score contract.
2. Flight cards under-deliver the evidence the product claims to use.
3. Hotel cards can drop Deal Score evidence entirely when scoring is unavailable.

## Files Inspected First

- `app/page.tsx`
- `app/components/DealBadge.tsx`
- `app/components/FlightCard.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/__tests__/scorePresentation.test.tsx`
- `lib/scoring/scoreDeal.ts`
- `lib/types.ts`

Additional detail surface inspected:

- `app/deals/[dealId]/page.tsx`
- `app/components/HotelCard.tsx`

## State Coverage

| State | Coverage | Evidence | QA result |
| --- | --- | --- | --- |
| Normal score | Flight card and detail page | `app/components/FlightCard.tsx:164-193`, `app/deals/[dealId]/page.tsx:204-225` | Present, but evidence hierarchy is inconsistent across surfaces. |
| Low confidence | Badge and panel copy | `app/components/DealBadge.tsx:14-25`, `app/components/FlightCard.tsx:173-192`, `lib/scoring/scoreDeal.ts:91-149` | Honest on flights; detail page label is honest but still shares space with an opaque score headline path. |
| Unavailable | Flight explicit, hotel missing | `app/components/FlightCard.tsx:197-214`, `app/components/HotelCard.tsx:240-244` | Inconsistent. Flight is explicit; hotel silently omits the score surface. |
| Partial data | Search notice and low-confidence fallback | `components/flights/FlightResults.tsx:193-215`, `lib/scoring/scoreDeal.ts:75-88` | Present at page level, but card-level evidence does not show what facts were withheld. |
| Loading | Card shimmer and results loading copy | `app/components/FlightCard.tsx:344-350`, `components/flights/FlightResults.tsx:289-309`, `app/components/HotelCard.tsx:240-241` | Present. Hotel score shimmer is unlabeled for assistive tech. |
| Empty | Flight and hotel empty states | `components/flights/FlightResults.tsx:310-321`, `app/page.tsx:1451-1470` | Coherent and honest. |
| Error | Search error panel | `app/page.tsx:1288-1305` plus surrounding results error handling | No fake score data shown. |
| Mobile 375px | Code-level responsive review only | `app/components/FlightCard.tsx:273-380`, `components/flights/FlightResults.tsx:324-335`, `app/deals/[dealId]/page.tsx:194-227` | Structurally usable, but live browser verification was blocked. |
| Desktop | Code-level responsive review only | same files as above | Structurally usable, but live browser verification was blocked. |

## Findings

### P0 - Detail surface promotes an unexplained numeric `deal score` that conflicts with the shared Deal Score contract

Files:
- `app/deals/[dealId]/page.tsx:111-123`
- `app/deals/[dealId]/page.tsx:204-225`
- `lib/types.ts:37-45`

Evidence:
- The shared `DealScore` contract only defines `percentile`, `pctVsMedian`, `medianCents`, `currency`, `verdict`, `confidence`, and `explanation`.
- The detail page headline can render `Great deal score 12` or `Deal score 47`.
- No nearby copy explains what that number means, what scale it uses, or how it relates to percentile.

Why this is broken:
- The result cards teach the user that Deal Score is verdict + percentile + explanation.
- The detail page switches to a different mental model and gives the new numeric headline the strongest visual weight.
- This is a trust regression on the most explanation-heavy surface.

Repro:
1. Open any saved deal detail page with `dealScore` populated.
2. Read the Deal Score panel headline.
3. Observe the number is presented as the main summary without a visible definition.
4. Compare to the shared Deal Score type and the result-card presentation.

Expected:
- The detail surface should use the same Deal Score language as the shared contract, or explicitly define any additional metric before presenting it as the headline.

Actual:
- An opaque numeric score is promoted above the explanatory facts.

### P1 - Flight result cards do not show enough supporting evidence for the weight given to Deal Score

Files:
- `app/page.tsx:963-979`
- `app/components/FlightCard.tsx:164-193`
- `lib/scoring/scoreDeal.ts:99-158`
- `lib/types.ts:37-45`
- `app/components/__tests__/scorePresentation.test.tsx:70-87`

Evidence:
- Marketing and trust copy promise comparison against `recent route history, median price, and deal percentile`.
- `scoreDeal` computes `medianCents` and `pctVsMedian`.
- Flight cards visually emphasize Deal Score with a full-width semantic panel, but only show percentile text, badge, and one explanation sentence.
- The current test coverage only asserts percentile plus explanation on flights, not discrete median evidence.

Why this is broken:
- Deal Score is the differentiator. If the UI gives it panel-level visual emphasis, the evidence beneath it must be scannable without sentence parsing.
- Users cannot quickly answer "what would I normally pay?" from the flight card itself.
- Hotel cards already show `Usual` and `Vs median`, making the flight evidence gap more obvious.

Repro:
1. Run a search with scored flight results.
2. Inspect any scored flight card.
3. Compare the visible score facts to the product promise on the landing page.
4. Observe there is no discrete `Usual` or `Vs median` fact on the card.

Expected:
- A scored flight card should expose the same core evidence the score computation and product copy rely on: verdict/confidence, percentile, usual price, and relative comparison.

Actual:
- The card gives the score strong color and placement, but thin visible evidence.

### P1 - Hotel cards hide Deal Score when scoring is unavailable, so the trust surface disappears instead of failing honestly

Files:
- `app/components/HotelCard.tsx:240-244`
- `app/components/FlightCard.tsx:197-214`
- `app/components/__tests__/scorePresentation.test.tsx:157-164`

Evidence:
- Flight cards render an explicit unavailable panel when `score` is `null`.
- Hotel cards render loading shimmer or a score panel, but render nothing when `score` is absent.
- There is no hotel test asserting an explicit unavailable Deal Score state.

Why this is broken:
- Users cannot distinguish "hotel score unavailable" from "hotel cards do not carry deal evidence."
- The missing surface makes hotel cards look less trustworthy than flight cards and hides a key caveat instead of stating it.

Repro:
1. Return hotel results with `score={null}` and `loading={false}`.
2. Inspect the rendered hotel card.
3. Observe that the Deal Score section is missing entirely.

Expected:
- Hotel cards should show an explicit unavailable state with honest copy, similar to flights.

Actual:
- The score panel disappears.

### P2 - Percentile labels are mechanically formatted on flights and deal detail, which makes the score feel cheap

Files:
- `app/components/FlightCard.tsx:173-175`
- `app/deals/[dealId]/page.tsx:129-135`
- `app/components/HotelCard.tsx:82-99`

Evidence:
- Flights and deal detail hardcode `${Math.round(...)}th percentile`.
- Hotels use a proper ordinal formatter.

Why this is broken:
- Values such as `1th`, `2th`, `3th`, and `23th` will read as machine-generated.
- This is avoidable polish debt on the product’s main trust label.

Repro:
1. Render a flight or deal detail surface with percentile values ending in `1`, `2`, or `3` outside the `11-13` range.
2. Observe the percentile suffix remains `th`.

Expected:
- Ordinal formatting should be correct everywhere Deal Score percentiles are shown.

Actual:
- Only hotel cards handle ordinals correctly.

### P2 - The results header adds hype styling (`🔥`) to great-deal counts, which overstates confidence relative to the visible evidence

Files:
- `app/page.tsx:1295-1302`
- `app/page.tsx:915`

Evidence:
- The header shows `🔥 {greatCount} great deal(s)`.
- `greatCount` is derived from all scored fares in state, not explicitly the currently visible filtered set.

Why this is broken:
- The emoji reads as promotional emphasis, not evidence.
- The count can be read as a claim about the current view even when filters hide some fares.

Repro:
1. Score a set of fares containing at least one `Great` result.
2. Apply a stops filter that hides that result.
3. Observe the header can still announce great deals with hype styling.

Expected:
- Any summary near Deal Score should be factual, filtered to the visible set, and free of decorative hype.

Actual:
- The summary is visually louder than the evidence beneath it.

## Visual Weight and Hierarchy Notes

### Flight result cards

- Good: Deal Score sits below live price and itinerary, so it does not hide the booking CTA or replace the fare as the primary fact.
- Good: Low-confidence flights downgrade the badge to `Limited history` and suppress confirmed `Great`.
- Weak: The full-width semantic panel implies stronger evidence than the card visibly provides.

### Hotel result cards

- Good: The hotel score panel includes `Usual` and `Vs median`.
- Weak: On mobile, the score can appear before the visible nightly rate, so evidence is shown before the price it is supposed to explain.
- Broken: Unavailable score state is silent.

### Deal detail surface

- Broken: The detail page gives headline weight to an opaque numeric score rather than the explainable percentile/relative-price facts.
- Weak: The detail line can show `High confidence · 23th percentile · 18% below usual`, where the ordinal formatting undercuts credibility.

## Mobile 375px and Desktop Review

Live viewport verification was blocked because the sandbox would not allow the local dev server to bind.

Attempted command:

```text
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Result:

```text
Error: listen EPERM: operation not permitted 127.0.0.1:3000
```

Code-level observations:

- Result grids collapse to one column at mobile and expand to two or three columns at `sm` and `lg`, so the main risk is hierarchy, not card overlap.
- Flight cards keep price above Deal Score at mobile and desktop, which is the correct order.
- Hotel cards place Deal Score above the nightly rate, which is more problematic at 375px because the user encounters the judgment before the primary price.
- The deal detail surface uses a two-column `sm:` block for price and score; at mobile it collapses to one column and remains readable in code structure, but the unexplained score headline still gets disproportionate emphasis.

## Manual Verification Flow

1. Review homepage score promise and trust notes.
2. Inspect flight results for normal, low-confidence, unavailable, and loading Deal Score states.
3. Inspect hotel results for normal, loading, and unavailable Deal Score states.
4. Inspect the saved deal detail page Deal Score panel for label, number, confidence, percentile, and explanation hierarchy.
5. Attempt viewport verification at mobile 375px and desktop.
6. Run required TypeScript and test commands.

## Recommended Follow-Up Tickets

### 1. REPAIR-FLIGHT-SCORE-EVIDENCE-01

Files:
- `app/components/FlightCard.tsx`
- `app/components/__tests__/scorePresentation.test.tsx`

Acceptance criteria:
- Flight Deal Score panel shows discrete `Usual` and `Vs median` facts when `score.confidence === 'high'`.
- Low-confidence flight cards continue to avoid confirmed-deal language.
- Supporting facts remain above the booking CTA and do not push the CTA below the fold at 375px more than the current card already does.
- Tests assert the new evidence fields for normal and low-confidence states.

### 2. REPAIR-DEAL-DETAIL-SCORE-CONTRACT-01

Files:
- `app/deals/[dealId]/page.tsx`

Acceptance criteria:
- The detail page no longer uses an unexplained standalone numeric `deal score` headline.
- The primary summary aligns to the shared Deal Score contract: verdict/confidence, percentile, relative comparison, explanation.
- Any additional numeric metric is either removed or explicitly labeled and defined in nearby copy.
- Percentile formatting uses correct ordinals.

### 3. REPAIR-HOTEL-SCORE-UNAVAILABLE-01

Files:
- `app/components/HotelCard.tsx`
- `app/components/__tests__/scorePresentation.test.tsx`

Acceptance criteria:
- Hotel cards render an explicit Deal Score unavailable state when `score` is `null` and `loading` is `false`.
- The unavailable copy states that the live hotel price is still shown.
- The loading shimmer has an accessible label comparable to flights.
- Tests cover loading, unavailable, and available hotel score states.

### 4. DESIGN-DEAL-SUMMARY-TONE-01

Files:
- `app/page.tsx`

Acceptance criteria:
- Results summary uses neutral copy without emoji or hype decoration.
- Great-deal count reflects the currently visible filtered results, or the copy explicitly states that it is route-wide.
- Summary wording does not sound more certain than the visible Deal Score evidence on the cards.

## Out Of Scope

- No scoring formula changes.
- No new Deal Score factors.
- No ranking/provider/booking refactor.
- No redesign implementation in this ticket.

## Blockers

- Live browser verification at mobile 375px and desktop could not be completed because the sandbox blocks binding a local dev server.
- This report is based on code inspection, component tests, and required command verification.

## Verification

- `npx tsc --noEmit --incremental false`: passed.
- `npm test -- --runInBand`: passed. `20` suites, `172` tests.
- `npm run dev -- --hostname 127.0.0.1 --port 3000`: failed in sandbox with `listen EPERM: operation not permitted 127.0.0.1:3000`.

## Return Note

- What changed and why: Added this audit report to document concrete Deal Score trust-surface failures, exact file references, and narrow repair tickets.
- Files changed: `docs/audits/2026-07-01-audit-deal-score-visual-weight-and-evidence-01.md`
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm test -- --runInBand` passed with `20` suites and `172` tests; local dev server start failed in sandbox with `listen EPERM`.
- Any out-of-scope findings or blockers: live browser verification blocked by sandbox bind restrictions.
