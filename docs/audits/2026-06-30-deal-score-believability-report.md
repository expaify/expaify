# REPAIR-DEAL-SCORE-BELIEVABILITY-02: Deal Score Believability Report

Date: 2026-06-30  
Reviewer: Senior QA Engineer  
Scope: `lib/scoring/scoreDeal.ts`, scoring unit tests, `DealScore` output contract, and realistic cash-fare route cases. No provider calls were used.

## Gate Verdict

GO for the Deal Score computation contract after this repair.

The scorer now avoids the two highest-risk trust failures for paid users:
- Fewer than 10 comparable history points cannot produce `Great` or `Good`.
- History in a different currency is not treated as comparable evidence for a deal claim.

This is not a GO for the whole paid UI. The visual audit still names Deal Score presentation and broader premium trust issues in `docs/audits/2026-06-30-premium-visual-audit.md`.

## Human Verdict Review

| Case | Route | Current fare | History shape | Expected output | QA verdict |
| --- | --- | ---: | --- | --- | --- |
| Great | JFK to LAX | $140 | 20 USD points from $250 to $630 | `Great`, high confidence, percentile <= 15 | Believable. Current fare is below every recent route point with enough history. |
| Good | EWR to ORD | $260 | 20 USD points from $200 to $580 | `Good`, high confidence, 16th to 40th percentile | Believable. Fare is cheaper than typical but not an extreme outlier. |
| Typical | EWR to ORD | $390 | Same 20-point USD baseline | `Typical`, high confidence, above 40th percentile | Believable. Fare sits near the baseline middle and should not be celebrated. |
| Low confidence | BOS to MIA | $200 | 5 USD points from $300 to $500 | `Typical`, low confidence, neutral percentile | Believable. Looks cheap, but sample size is too thin to confirm a deal. |
| Above history | ATL to DFW | $450 | 20 USD points below current fare | `Typical`, high confidence, 100th percentile | Believable. This is worse than every recent point and must not get deal language. |
| Identical prices | Synthetic route | $300 | 15 identical USD points at $300 | `Typical`, high confidence, 50th percentile | Believable. Equal-to-history is normal, not a deal. |
| Currency mismatch | Synthetic EUR fare | EUR 100 | 12 USD history points | `Typical`, low confidence, no median claim | Believable. USD history cannot prove a EUR deal without FX normalization. |

## Adversarial Coverage Added

The unit tests now cover these paid-user risk cases:
- Thin history forces low confidence and blocks both `Great` and `Good`.
- Identical current/history prices resolve to 50th percentile and `Typical`.
- Current fare above every historical point resolves to 100th percentile and `Typical`.
- Current fare below every historical point can only be `Great` when there are at least 10 comparable points.
- Currency mismatch returns neutral low confidence instead of reusing incompatible history.
- Mixed-currency history scores only same-currency points and applies the thin-history cap after filtering.
- Even-count median behavior uses the midpoint median for `pctVsMedian`.
- Low-confidence explanation uses limited-history language instead of confirmed-deal language.

## Scoring Risks That Remain

- Route history quality still depends on snapshot collection and provider normalization outside this scorer.
- No FX conversion exists yet; cross-currency comparison is intentionally neutral until `lib/fx` or an equivalent conversion layer exists.
- Median and percentile are robust enough for MVP, but they do not account for seasonality, booking window, cabin mix, fare restrictions, or passenger count.
- `DealScore.explanation` is one sentence by contract, so it cannot fully explain why a route has low confidence.
- UI presentation remains a separate trust risk: the scoring output is believable, but the product still needs the presentation fixes named in the premium visual audit.

## Manual Explanation Review

- Great: "$140" against a high-confidence JFK to LAX baseline reads as below usual and earns `Great`.
- Good: "$260" against EWR to ORD reads as below usual but not extreme and earns `Good`.
- Typical: "$390" against EWR to ORD reads near the route baseline and earns `Typical`.
- Low confidence: "$200" against five BOS to MIA points reads as limited history and is treated as `Typical` for now.

## Final Gate

Deal Score math and output shape are acceptable for the MVP scoring gate. Do not use this report to approve the broader paid-user UI; this report only verifies that scoring no longer makes obviously wrong `Great` or `Good` claims in the covered adversarial cases.
