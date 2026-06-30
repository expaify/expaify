# AUDIT-DEAL-SCORE-SORT-MISMATCH-01: Deal Score Sort Mismatch

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Strict audit only. No product code changed.

## Executive Decision

Not ready for paid-user trust on cross-surface Deal Score ordering.

Flight sorting is mostly coherent once all score requests settle successfully: `Best deal` sorts by score quality, percentile, and median delta before falling back to price. The trust break is in degraded/partial states and in the hotel surface. If score calls fail, flights can still show `Best deal` while the list is effectively fallback price order with every card saying Deal Score is unavailable. Hotels can display Deal Score evidence, but hotel cards are rendered in provider order with no visible hotel sort state, no hotel price/score sort, and no unavailable-score explanation when score evidence is missing.

## Surfaces Inspected

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx`
- `app/api/search/route.ts`
- `app/api/score/route.ts`
- `lib/scoring/scoreDeal.ts`
- `lib/search/sortFlights.ts`
- `lib/search/__tests__/sortFlights.test.ts`
- `lib/db/schema.sql`
- `node_modules/next/dist/docs/01-app/index.md`

Requested files not present in this worktree:

- `components/FlightResultCard.tsx`; current flight card is `app/components/FlightCard.tsx`.
- `components/HotelResults.tsx`; hotel results are inline in `app/page.tsx`.
- `components/HotelCard.tsx`; current hotel card is `app/components/HotelCard.tsx`.
- `components/ResultsSort.tsx`; flight sort controls are inline in `components/flights/FlightResults.tsx`.
- `lib/dealScore.ts`; current scoring helper is `lib/scoring/scoreDeal.ts`.
- `lib/ranking.ts`; current ranking helper is `lib/search/sortFlights.ts`.

## True Logic Defects

### 1. Flights can show `Best deal` while all visible ordering is fallback price order after score failures

Evidence: `sortBy` defaults to `deal` in `app/page.tsx:507`, and the sort control labels `deal` as `Best deal` in `components/flights/FlightResults.tsx:41`. Score failures are stored as `null` in `app/page.tsx:591` to `app/page.tsx:608`. Once every fare has a score property, including `null`, `visibleScoresSettled` becomes true in `app/page.tsx:895` to `app/page.tsx:898`, `rankingUpdating` can become false in `app/page.tsx:900` to `app/page.tsx:903`, and `sortFlights` applies deal sorting in `app/page.tsx:905` to `app/page.tsx:907`.

The problem is `sortFlights` ranks null scores at the same low bucket and then falls back to price/stops/date/carrier/id in `lib/search/sortFlights.ts:25` to `lib/search/sortFlights.ts:43`. The card then renders an explicit unavailable score panel in `app/components/FlightCard.tsx:344` to `app/components/FlightCard.tsx:350`, but the active control summary can still say the list is "sorted by best deal" in `components/flights/FlightResults.tsx:154` to `components/flights/FlightResults.tsx:156`.

Concrete example:

- Position 1: cheapest fare, Deal Score unavailable.
- Position 2: next cheapest fare, Deal Score unavailable.
- Position 3: highest fare, Deal Score unavailable.
- Visible selected mode: `Best deal`.

Repro steps:

1. Run any destination search that returns multiple fares.
2. Force `/api/score` to return non-OK for each fare; a baseline load error returns 502 in `app/api/score/route.ts:100` to `app/api/score/route.ts:107`.
3. Wait until all score loading skeletons resolve.
4. Inspect result order and the controls summary.

Expected: If no score evidence is available, the selected sort copy should not imply the visible order is based on deal quality.

Actual: The mode remains `Best deal`, but order is fallback price evidence.

Impact: This directly undermines the core trust signal. It is a true defect, not a request for a new ranking algorithm.

### 2. Hotel cards can show Deal Score evidence while hotel order ignores score and selected sort state

Evidence: Hotel scores are fetched in `app/page.tsx:611` to `app/page.tsx:631` and passed into each `HotelCard` in `app/page.tsx:1472` to `app/page.tsx:1480`. `HotelCard` renders percentile, verdict badge, usual price, median delta, and explanation in `app/components/HotelCard.tsx:117` to `app/components/HotelCard.tsx:168`.

However, hotel results render as `hotels.map(...)` in provider order in `app/page.tsx:1472` to `app/page.tsx:1480`. There is no hotel sort component, no call to `sortFlights` equivalent, and no hotel-specific sort state. The only sort state is the flight `SortBy = 'price' | 'deal'` in `app/page.tsx:14`, exposed only through `FlightResults` in `app/page.tsx:1406` to `app/page.tsx:1431`.

Concrete example:

- Position 1: Hotel A, `Typical`, 70th percentile, `$300/night`.
- Position 2: Hotel B, `Great`, 10th percentile, `$260/night`.
- Position 3: Hotel C, `Good`, 35th percentile, `$280/night`.
- Visible hotel order: provider order, not score order or price order.
- Visible selected hotel sort mode: none.

Repro steps:

1. Run a round-trip destination search where hotels are available.
2. Open the Hotels tab.
3. Inspect card positions after hotel score panels finish loading.
4. Compare card order against each card's Deal Score percentile/verdict and nightly price.

Expected: If Deal Score evidence appears on hotel cards, either the hotel order should agree with a visible ordering rule or the UI should clearly avoid implying score-ranked hotels.

Actual: Score evidence appears on cards, but there is no visible hotel sort state and no score/price ordering logic in the hotel render path.

Impact: Paid users can reasonably infer that result order means best deal first, especially because the flight surface defaults to `Best deal`. The hotel surface does not support that inference.

## Copy / Design Ambiguity

### 3. In-progress flight `Best deal` ordering is temporarily price fallback, but the disclosure is easy to miss

Evidence: `rankingUpdating` is true while searching, while scores are loading, or before every visible fare has a score property in `app/page.tsx:900` to `app/page.tsx:903`. During that state, `sortFlights` is called with `{ deferDealSort: rankingUpdating }` in `app/page.tsx:905` to `app/page.tsx:907`, and `sortFlights` intentionally falls back to price order when `deferDealSort` is true in `lib/search/sortFlights.ts:56` to `lib/search/sortFlights.ts:63`. The UI adds "Updating deal ranking as scores finish" in `components/flights/FlightResults.tsx:268` to `components/flights/FlightResults.tsx:275`.

This is not a hard logic defect because the disclosure exists. The ambiguity is hierarchy: the selected pill still says `Best deal`, the summary still says "sorted by best deal", and the updating note is secondary text below the control.

Concrete source-backed example from `lib/search/__tests__/sortFlights.test.ts:82` to `lib/search/__tests__/sortFlights.test.ts:99`:

- Position 1 while deferred: `cheap-typical`, `$120`.
- Position 2 while deferred: `expensive-great`, `$240`, `Great`, 8th percentile.
- Visible state: `Best deal` selected plus updating copy.

Expected: During transient ranking updates, the UI should make the temporary fallback unmistakable.

Actual: The disclosure exists but is secondary; this is copy/design ambiguity, not a ranking formula defect.

### 4. Hotels omit an unavailable Deal Score state when hotel score evidence is missing

Evidence: Flight cards show an explicit `DealUnavailable` panel when `score` is null in `app/components/FlightCard.tsx:197` to `app/components/FlightCard.tsx:214` and `app/components/FlightCard.tsx:344` to `app/components/FlightCard.tsx:350`. Hotel cards render a loading skeleton or a score panel, but render nothing when `score` is null in `app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`.

Repro steps:

1. Run a hotel search where hotel cards return but `/api/score?type=hotel...` fails or has no usable baseline.
2. Open Hotels after loading completes.
3. Compare flight cards with unavailable scores against hotel cards with unavailable scores.

Expected: Missing score evidence should be explained consistently across flights and hotels.

Actual: Hotel cards silently omit Deal Score evidence, so the user cannot tell whether hotels are unscored, still incomplete, or simply not Deal Score-ranked.

Impact: This is a trust-copy and evidence-hierarchy ambiguity. It is not a provider-contract defect.

## Controls Present / Absent

- Flight default ordering: `sortBy` defaults to `deal` in `app/page.tsx:507`; final settled successful deal sort uses verdict, confidence, percentile, pct-vs-median, then fallback price in `lib/search/sortFlights.ts:25` to `lib/search/sortFlights.ts:43`.
- Flight price sort: `Lowest price` is available and uses fallback price order through `sortFlights` in `lib/search/sortFlights.ts:56` to `lib/search/sortFlights.ts:63`.
- Flight duration sort: not present in current UI or ranking code.
- Flight recommended sort: not present as a separate control; `Best deal` appears to be the recommendation proxy.
- Hotel price sort: not present.
- Hotel score sort: not present.
- Hotel duration sort: not applicable to hotels and not present.
- Hotel recommended sort: not present.

## States Reviewed

- Loading: flight loading shows a status panel plus skeleton cards in `components/flights/FlightResults.tsx:289` to `components/flights/FlightResults.tsx:309`; hotels show skeleton cards while searching in `app/page.tsx:1434` to `app/page.tsx:1450`.
- Empty: flight empty/provider/filter states are distinct in `components/flights/FlightResults.tsx:157` to `components/flights/FlightResults.tsx:189` and `components/flights/FlightResults.tsx:310` to `components/flights/FlightResults.tsx:321`; hotel empty/unavailable/skipped copy is in `app/page.tsx:916` to `app/page.tsx:934` and `app/page.tsx:1451` to `app/page.tsx:1470`.
- Error: search error panel gives retry and edit actions in `app/page.tsx:1328` to `app/page.tsx:1358`.
- Mobile 375px source review: result header stacks before `sm` in `app/page.tsx:1275` to `app/page.tsx:1326`; tabs scroll horizontally in `app/page.tsx:1363`; flight controls use compact grid buttons in `components/flights/FlightResults.tsx:217` to `components/flights/FlightResults.tsx:277`; result grids are one column before `sm` in `components/flights/FlightResults.tsx:324` and `app/page.tsx:1472`.
- Desktop source review: result grids expand to three columns at `lg` in `components/flights/FlightResults.tsx:324` and `app/page.tsx:1472`; flight controls move into a wider two-area layout at `lg` in `components/flights/FlightResults.tsx:219`.

## Visual Self-Review

- Hierarchy: flight cards make price, route, Deal Score, and CTA scannable; hotel cards put the score panel above price/CTA, which is acceptable when score exists but confusing when score is absent.
- Contrast: score badges use semantic success/brand/warning styles; low confidence is labeled `Limited history` in `app/components/DealBadge.tsx:14` to `app/components/DealBadge.tsx:25`.
- Spacing: grids and controls use mobile-first single-column layouts with `sm`/`lg` expansion; no source-level fixed wide containers were found in the inspected result cards.
- Mobile fit: CTAs are full-width or responsive on narrow viewports in `app/components/FlightCard.tsx:352` to `app/components/FlightCard.tsx:379` and `app/components/HotelCard.tsx:254` to `app/components/HotelCard.tsx:287`.
- Focus states: flight sort controls are buttons with `aria-pressed` in `components/flights/FlightResults.tsx:226` to `components/flights/FlightResults.tsx:239`; primary CTAs include focus-visible outlines in `app/components/FlightCard.tsx:354` to `app/components/FlightCard.tsx:363`. Hotel CTA focus style relies on shared `btn-primary`.
- Decorative effects: no cheap decorative effects were found in the inspected result surfaces; animation is limited to skeletons, fade-up, and progress indicators.

## Manual Verification Flow

Use this flow for monitor verification with provider fixtures or a seeded environment:

1. Start the app and run a round-trip search with origin `JFK`, destination `LHR`, future depart/return dates, and one passenger.
2. On Flights, keep the default `Best deal` sort. Record the first three card positions, each card's price, verdict, percentile, and whether the score is loading/unavailable.
3. Switch to `Lowest price`. Confirm the first three positions now agree with ascending `price.priceCents`.
4. Switch back to `Best deal`. After all score loading finishes, confirm high-confidence `Great` outranks `Good`, `Good` outranks `Typical`, and unavailable/low-confidence results do not visually claim Great.
5. Open Hotels if available. Record the first three hotel positions, nightly price, verdict, percentile, and whether any hotel lacks score evidence.
6. Compare hotel order against hotel score evidence and price. Current expected audit result: hotel order follows `hotels.map(...)` provider order, not a visible hotel sort mode.
7. Repeat at 375px width and desktop width. Confirm controls fit, tabs are reachable, score panels do not overlap card text, and CTAs remain visible.

## Out-of-Scope Findings

- No provider adapter changes were made. Hotel provider availability, affiliate marker behavior, and external API response normalization are out of scope unless they directly affect visible score/order evidence.
- No new ranking algorithm, score formula, sort mode, filter, or hotel results component was proposed or added.
- Money and `Result<T>` contracts were inspected only as they affected visible scoring/order evidence. No direct money-contract violation was proven by this audit.

## Verification Commands

- `npm run tsc -- --noEmit --incremental false` - failed because this repo has no `tsc` npm script.
- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand` - passed. 20 suites passed, 168 tests passed.

## Required Return Note

- What changed and why: Added this narrow QA audit report for Deal Score sort/order evidence across flight and hotel results. No product code changed.
- Files changed: `docs/audits/2026-06-30-audit-deal-score-sort-mismatch-01.md`.
- Verification commands and results: `npm run tsc -- --noEmit --incremental false` failed due missing script; `npx tsc --noEmit --incremental false` passed; `npm test -- --runInBand` passed with 20 suites and 168 tests.
- Out-of-scope findings or blockers: Duration/recommended sort controls and separate hotel sort controls are absent in the current UI. Provider/API contract concerns are out of scope unless proven by visible sort/score evidence.
