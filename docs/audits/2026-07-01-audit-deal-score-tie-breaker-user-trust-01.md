# AUDIT-DEAL-SCORE-TIE-BREAKER-USER-TRUST-01: Deal Score Tie Breaker Trust

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Audit only. No product code changed.

## Decision

Not ready for paid-user trust across both result types.

Flight tie-breaking is deterministic after every visible score settles: high-confidence verdict rank, percentile, percent-vs-median, then price/currency/stops/depart/carrier/id fallback. Equal and near-equal flight scores should remain stable after reload when provider payloads and generated fare ids are stable.

Hotel tie-breaking is not implemented. Hotel cards can show Deal Score evidence, but hotel result order is raw provider order. There is no visible hotel sort rule and no hotel comparator for equal, missing, low-confidence, or near-equal scores.

## Files Inspected

- `app/page.tsx`
- `app/components/DealBadge.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `components/flights/FlightResults.tsx`
- `lib/search/sortFlights.ts`
- `lib/search/__tests__/sortFlights.test.ts`
- `lib/scoring/scoreDeal.ts`
- `lib/types.ts`
- `app/api/search/route.ts`
- `app/api/score/route.ts`

Requested files not present in this worktree:

- `components/hotels/HotelResults.tsx`
- `components/hotels/HotelCard.tsx`
- `components/hotels/HotelPrice.tsx`

## Current Tie-Break Behavior

### Flights

Flight display order is produced in `app/page.tsx:889` to `app/page.tsx:907` by filtering flights, detecting whether all visible scores have settled, and calling `sortFlights(filteredFlights, sortBy, scores, { deferDealSort: rankingUpdating })`.

`sortFlights` uses fallback ordering whenever `sortBy === 'price'`, deal sorting is deferred, or any visible score has not settled. The fallback is deterministic: currency, price cents, stops, depart timestamp, carrier, then id in `lib/search/sortFlights.ts:14` to `lib/search/sortFlights.ts:22`.

Once all visible scores settle and `Best deal` is selected, the comparator is:

1. `scoreRank`: high-confidence `Great`, `Good`, `Typical`, then low-confidence scores, then missing scores.
2. Lower percentile.
3. Lower `pctVsMedian`.
4. Fallback currency/price/stops/depart/carrier/id.

Evidence: `lib/search/sortFlights.ts:25` to `lib/search/sortFlights.ts:43`.

Important score behavior: `scoreDeal` forces low-confidence percentile to `50` and verdict to `Typical`, so low-confidence offers do not claim `Great`; see `lib/scoring/scoreDeal.ts:91` to `lib/scoring/scoreDeal.ts:143`.

### Hotels

Hotel results are rendered directly with `hotels.map(...)` while searching and after completion in `app/page.tsx:1437` to `app/page.tsx:1447` and `app/page.tsx:1472` to `app/page.tsx:1482`.

Hotel scores are displayed in `HotelCard`, including percentile, usual price, median delta, confidence copy, and explanation in `app/components/HotelCard.tsx:117` to `app/components/HotelCard.tsx:167`. That evidence does not affect ordering.

Current hotel order is provider-return order. Equal, missing, low-confidence, and near-equal hotel scores have no explicit tie-breaker and no visible ordering explanation.

## Findings

### P1: Hotel Deal Scores Do Not Drive Or Explain Result Order

Repro:

1. Use a round-trip search with hotel availability.
2. Open Hotels after cards and hotel scores finish loading.
3. Record the first three hotels by card position, nightly price, verdict, percentile, and explanation.
4. Compare card order to the visible Deal Score evidence.

Expected: If hotels display Deal Scores, the order should either follow a visible score/price rule or state that hotels are provider ordered.

Actual: Hotel cards can show Deal Score panels, but order remains `hotels.map(...)` provider order. There is no hotel sort control, no hotel comparator, and no copy explaining that Deal Score is not the ranking rule.

Sample mismatch to verify with fixtures:

- Position 1: `hotel-a`, Typical, 70th percentile, `$300/night`
- Position 2: `hotel-b`, Great, 10th percentile, `$260/night`
- Position 3: `hotel-c`, Good, 35th percentile, `$280/night`

Current code will preserve provider order `hotel-a`, `hotel-b`, `hotel-c` if that is how the provider returns it. The displayed explanations would make `hotel-b` look like the stronger deal, but the hierarchy would not reflect that.

Hidden/unexplained ranking factor: provider response order.

### P1: Flight Near-Equal Tie-Breaking Is Stable But Not Fully Explainable

Flights have a deterministic comparator. Equal verdict/percentile values fall through to `pctVsMedian`, then price/currency/stops/depart/carrier/id. This should prevent random reorder after reload when score payloads and fare ids are stable.

Trust issue: the UI summary says "sorted by best deal" in `components/flights/FlightResults.tsx:156` to `components/flights/FlightResults.tsx:158`, but it does not disclose lower-level tie-breakers such as percent-vs-median, price, stops, departure time, carrier, or id.

Manual sample from existing tests:

- `great-expensive`, Great, 12th percentile, `$240`
- `good-mid`, Good, 28th percentile, `$180`
- `typical-cheap`, Typical, 55th percentile, `$120`

Expected and tested order is `great-expensive`, `good-mid`, `typical-cheap`; see `lib/search/__tests__/sortFlights.test.ts:40` to `lib/search/__tests__/sortFlights.test.ts:54`.

Near-equal/equal behavior to verify with fixtures:

- If two fares both have high-confidence Good, 28th percentile, and equal `pctVsMedian`, lower fallback price wins.
- If price also ties, fewer stops wins.
- If stops also tie, earlier depart wins.
- If depart also ties, carrier then id decide.

This behavior is stable, but the last two ranking factors are invisible to users and can look arbitrary when the card evidence appears otherwise similar.

### P2: In-Progress Flight Deal Sorting Temporarily Uses Price Fallback

While score loading is in progress, `rankingUpdating` becomes true in `app/page.tsx:900` to `app/page.tsx:903`; `sortFlights` then receives `deferDealSort: true` in `app/page.tsx:905` to `app/page.tsx:907` and uses fallback ordering.

The UI does disclose "Updating deal ranking as scores finish" in `components/flights/FlightResults.tsx:278` to `components/flights/FlightResults.tsx:285`. However, the selected pill and summary still present `Best deal`, so near-equal or pending results can appear to reorder after score completion.

Existing test evidence:

- Deferred order: `cheap-typical`, then `expensive-great`
- Settled deal order would reverse if `expensive-great` has a stronger high-confidence score

See `lib/search/__tests__/sortFlights.test.ts:82` to `lib/search/__tests__/sortFlights.test.ts:99`.

### P2: Missing Hotel Scores Are Silent

When flight score evidence is missing, `FlightCard` shows an explicit Deal Score unavailable panel. Hotel cards render a skeleton while loading, render `HotelDealPanel` when a score exists, and render nothing when score is null in `app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`.

This matters for tie-breaker trust because a hotel list can contain cards with hidden missing-score states, yet the user has no visible basis for why those hotels appear above or below scored hotels.

## State Review

- Loading: Flights show a status panel, skeleton cards, and updating-ranking copy. Hotels show skeleton cards while searching.
- Empty: Flight empty/provider/filter states are specific. Hotel empty/unavailable/skipped states are present in `app/page.tsx:1452` to `app/page.tsx:1470`.
- Error: Search-level error panel provides Retry search and Edit search actions.
- Mobile 375px: Source review shows one-column result grids for flight and hotel cards, horizontally scrollable tabs, and compact grid controls. No source-level fixed wide result container was found in the inspected result surfaces.
- Desktop: Result grids expand to three columns at `lg`; flight controls move to a wider layout.

## Manual Verification Flow

Use provider fixtures or a seeded environment so identities and scores are repeatable.

1. Run a round-trip search with multiple flight results.
2. Keep `Best deal` selected and wait until score loading finishes.
3. Record the first three flight ids, prices, stops, depart times, verdicts, percentiles, `pctVsMedian`, and explanations.
4. Reload the page or repeat the same search. Confirm the final settled flight order is identical.
5. Compare displayed explanation to order: a high-confidence lower percentile should outrank a worse percentile even when it is more expensive.
6. Repeat with two fixtures that share verdict and percentile. Confirm the next visible or hidden tie-breaker decides the order: `pctVsMedian`, then price, stops, depart, carrier, id.
7. Open Hotels for a search with multiple hotels.
8. Record the first three hotel ids, nightly prices, verdicts, percentiles, explanations, and card positions.
9. Reload or repeat the same search. Current expected audit result: hotel order remains provider order, not score order; any stability depends on provider response stability, not app tie-break logic.
10. Repeat at 375px and desktop width. Confirm tabs, controls, score panels, and CTAs remain visible with no overlapping text.

## Blockers

- Hotel-specific requested components under `components/hotels/` are absent. Hotel results live inline in `app/page.tsx` and hotel card UI lives in `app/components/HotelCard.tsx`.
- Live manual provider verification was not performed in this audit turn; the report is based on source review and existing comparator tests. Provider fixtures are needed to capture real hotel ids and score/order mismatches.

## Out-of-Scope Findings

- Provider adapter quality and affiliate marker behavior were not changed.
- No new hotel ranking algorithm, score inputs, badges, urgency labels, or visual redesign was proposed or added.
- Existing prior audit `docs/audits/2026-06-30-audit-deal-score-sort-mismatch-01.md` covers related broader score-sort mismatch issues; this file narrows the evidence to tie-breaker trust.

## Required Return Note

- What changed and why: Added this audit to document current flight and hotel Deal Score tie-break behavior, stability risks, hidden ranking factors, and verification flow.
- Files changed: `docs/audits/2026-07-01-audit-deal-score-tie-breaker-user-trust-01.md`.
- Verification commands and results: See final agent response for command output.
- Any out-of-scope findings or blockers: Hotel-specific requested components are absent; live provider fixture verification was not performed.
