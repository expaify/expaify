# AUDIT-DEAL-SCORE-HOTEL-PARITY-EVIDENCE-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Deal Score evidence parity between flight and hotel results. No feature code changed.

## Verdict

FAIL. Hotel Deal Score presentation is not at evidence parity with flight results and can overstate low-confidence comparison facts.

Flights have a stronger unavailable state and clearer provider/source context. Hotels have richer high-confidence score facts when a score exists, but hotel score evidence silently disappears when scoring fails, low-confidence hotel cards still show numeric `Usual` and `Vs median` facts, and hotel result order is not tied to visible score evidence.

## File Map Mismatch

The ticket asked to inspect `components/hotels/HotelCard.tsx` and `components/hotels/HotelResults.tsx`. Those files do not exist in this worktree. The executable hotel result surface is `app/components/HotelCard.tsx`, rendered directly from `app/page.tsx`.

## Evidence Parity Matrix

| Area | Flight result | Hotel result | QA result |
| --- | --- | --- | --- |
| Score visibility when available | Shows `Deal Score`, percentile or limited-history copy, verdict badge, explanation (`app/components/FlightCard.tsx:164`). | Shows `Deal Score`, percentile or limited-history copy, verdict badge, usual price, vs median, explanation (`app/components/HotelCard.tsx:117`). | PASS for both visible scored states; not fully parity because fact hierarchy differs. |
| Score unavailable state | Explicit `Unavailable right now` score panel (`app/components/FlightCard.tsx:197`, rendered at `app/components/FlightCard.tsx:344`). | Renders nothing when `score` is null and not loading (`app/components/HotelCard.tsx:240`). | FAIL for hotels. |
| Low-confidence treatment | Hides percentile and labels badge `Limited history` (`app/components/FlightCard.tsx:173`, `app/components/DealBadge.tsx:14`). | Hides percentile and labels badge `Limited history`, but still displays numeric `Usual` and `Vs median` facts (`app/components/HotelCard.tsx:126`, `app/components/HotelCard.tsx:147`). | FAIL for hotels: numeric certainty remains visible on thin data. |
| Supporting facts visible on mobile | Price appears before score; score text is inline on the card (`app/components/FlightCard.tsx:270`, `app/components/FlightCard.tsx:344`). | Score appears before the visible nightly price/CTA (`app/components/HotelCard.tsx:240`, `app/components/HotelCard.tsx:248`). | PARTIAL. Facts are visible without hidden panels, but hotel score explains a price shown later. |
| Provider context | Carrier and provider source appear near the route; CTA names provider source (`app/components/FlightCard.tsx:283`, `app/components/FlightCard.tsx:250`). | CTA is hardcoded `HotelLook`; `hotel.source` is not rendered near the hotel identity or score (`app/components/HotelCard.tsx:257`). | FAIL for hotel provenance parity. |
| Ranking evidence | Flights are sorted by Deal Score after scores settle and show an updating notice while ranking is deferred (`app/page.tsx:900`, `components/flights/FlightResults.tsx:280`). | Hotels render in provider order; no hotel score sort or score-ranking disclosure exists (`app/page.tsx:1473`). | FAIL: visible hotel order can conflict with score evidence. |

## Findings

### P0 - Hotel Deal Score can disappear with no unavailable state

Repro:
1. Run a round-trip destination search that returns hotel inventory.
2. Make `/api/score?type=hotel...` fail, return non-OK, or hit a DB baseline error.
3. Wait for hotel score loading to finish.
4. Inspect the hotel card.

Expected: A hotel card should show an explicit `Deal Score unavailable` state comparable to flight cards.

Actual: `fireHotelScore` stores `null` on score failure (`app/page.tsx:621` to `app/page.tsx:624`), and `HotelCard` renders `null` for score absence (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`). The user sees no score state, no reason, and no confidence boundary.

### P0 - Low-confidence hotel scores still show numeric comparison facts

Repro:
1. Return a hotel score with `confidence: 'low'`.
2. Inspect the hotel score panel.

Expected: Low-confidence hotel states should avoid numeric certainty or clearly downgrade every numeric comparison.

Actual: The hotel card hides the percentile behind `Not enough hotel history for a confirmed deal rating`, but still renders `Usual` and `Vs median` values from the thin baseline (`app/components/HotelCard.tsx:126` to `app/components/HotelCard.tsx:159`). The warning at `app/components/HotelCard.tsx:161` helps, but the numeric facts remain prominent.

Flight low-confidence presentation is more conservative: it does not render separate median or percent-vs-median facts in the card.

### P1 - Hotel provenance is weaker than flight provenance

Repro:
1. Compare a flight card and hotel card in the same result session.
2. Check where provider/source appears before the outbound handoff.

Expected: Hotel cards should expose provider provenance at least as clearly as flights, especially because Deal Score trust depends on where the rate came from.

Actual: Flight cards show carrier and source near the route (`app/components/FlightCard.tsx:283` to `app/components/FlightCard.tsx:284`). Hotel cards only show a hardcoded `Check with HotelLook` CTA and do not render `hotel.source` near the hotel identity or score (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`).

### P1 - Hotel ranking order is not backed by visible score evidence

Repro:
1. Run a search with hotel results and scored hotel cards.
2. Leave the page-level sort state at default `Best deal`.
3. Switch from Flights to Hotels.
4. Compare hotel card order with visible hotel Deal Score facts.

Expected: If score evidence is shown, result order should either be score-ranked or explicitly disclosed as provider/order returned.

Actual: Flights use `sortFlights` for score-aware ordering (`app/page.tsx:905` to `app/page.tsx:907`). Hotels are rendered directly as `hotels.map(...)` with no score-aware sorting or order disclosure (`app/page.tsx:1473` to `app/page.tsx:1483`). This can make a lower-scored hotel appear above a stronger one without explanation.

### P2 - Hotel score facts are visible, but the primary price appears after the score

Repro:
1. View a scored hotel card at 375px width.
2. Read the card top to bottom.

Expected: The visible nightly price should be established before or adjacent to the score evidence that explains it.

Actual: Hotel score renders before the bottom price/CTA block (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:250`). This is not hidden, but it is weaker evidence sequencing than flights, where price is shown above the score.

## Manual Verification Flow

Live browser verification was not completed because this environment has no browser automation package installed and provider-backed results require external services/secrets. Source-traced manual flow for the same search session:

1. Search round trip with origin, destination, departure, and return date.
2. `/api/search` streams flight events and hotel events for the same search (`app/page.tsx:758` to `app/page.tsx:768`).
3. Flight cards receive `scores[fare.id]` and render score/loading/unavailable states (`app/page.tsx:1406` to `app/page.tsx:1432`; `app/components/FlightCard.tsx:344` to `app/components/FlightCard.tsx:350`).
4. Hotel cards receive `hotelScores[hotel.id]` and render score/loading only; null score renders no Deal Score state (`app/page.tsx:1435` to `app/page.tsx:1484`; `app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`).
5. Comparison result: a flight and hotel in the same search session do not have parity for score unavailable state, source provenance, low-confidence numeric certainty, or ranking disclosure.

## State Review

Loading: PASS with caveat. Flights show score shimmer with an accessible label (`app/components/FlightCard.tsx:344`). Hotels show a score shimmer (`app/components/HotelCard.tsx:240`), but it has no accessible label.

Empty: PASS. Hotel empty/skipped/unavailable result states are coherent at the tab and panel level (`app/page.tsx:916` to `app/page.tsx:929`, `app/page.tsx:1452` to `app/page.tsx:1471`). They do not fabricate Deal Score evidence.

Error: PASS for global search error. The page renders an error panel without fake score claims (`app/page.tsx:1328` to `app/page.tsx:1357`). FAIL for per-hotel score error because card-level score failure becomes silent absence.

Mobile 375px: PARTIAL. Result grids collapse to one column (`components/flights/FlightResults.tsx:338`, `app/page.tsx:1473`), and score-supporting text is not hidden behind panels. The main mobile defect is evidence order on hotels: score precedes visible nightly price.

Desktop: PARTIAL. Three-column grids are structurally usable, but hotel card order is not score-ranked or disclosed, so visible score evidence can disagree with ranking position.

## Confirmation Checks

Unavailable score states avoid numeric certainty: FAIL for hotels because no unavailable score state is rendered. PASS for flights.

Low-confidence states avoid numeric certainty: PASS for flights. FAIL for hotels because low-confidence panels still show `Usual` and `Vs median` numeric facts.

Hotel score facts are hotel-specific: PASS. `scoreDeal` uses `hotel` language for hotel offers (`lib/scoring/scoreDeal.ts:23` to `lib/scoring/scoreDeal.ts:42`), and hotel panel copy says `hotel history` (`app/components/HotelCard.tsx:126` to `app/components/HotelCard.tsx:163`).

Supporting facts visible without hidden panels on mobile: PASS. No hidden panel is required. The issue is hierarchy and confidence framing, not visibility.

## Out of Scope

- No score formulas changed.
- No ranking weights changed.
- No provider, baseline, or hotel comparison data invented.
- No UI redesign or card layout changes made.
- `components/hotels/HotelCard.tsx` and `components/hotels/HotelResults.tsx` are absent from this worktree.

## Verification

- `npm run tsc`: failed because package.json has no `tsc` script.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run test -- --runInBand`: passed, 20 suites / 176 tests.
- `npm test -- --passWithNoTests`: passed, 20 suites / 176 tests.

## Return Note

- What changed and why: Added this audit report for hotel Deal Score evidence parity. No product code changed.
- Files changed: `docs/audits/2026-07-01-audit-deal-score-hotel-parity-evidence-01.md`.
- Verification commands and results: See Verification above.
- Out-of-scope findings or blockers: Requested `components/hotels/*` files are absent; live browser/provider manual verification was blocked by missing browser automation and external provider/secrets constraints.
