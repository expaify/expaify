# AUDIT-DEAL-SCORE-COMPARISON-BASELINE-01

Date: 2026-06-30

Scope: Deal Score data lineage, available comparison baselines at render time, score display copy, fallback states, Result<T> provider behavior, and deterministic score sorting.

No application code was changed. This is an audit-only ticket.

## Requested Files Status

- `app/page.tsx` exists and is the active search/results controller.
- `components/TicketCard.tsx` does not exist in this worktree. Current result cards are `app/components/FlightCard.tsx` and `app/components/HotelCard.tsx`.
- `components/TicketSlideOver.tsx` does not exist in this worktree. No current ticket slideover equivalent was found.
- `app/api/run/[id]/route.ts` does not exist in this worktree. Current run/search flow is `app/api/search/route.ts` plus `app/api/score/route.ts`.
- `lib/providers` exists and contains Travelpayouts, Duffel, Amadeus, Kiwi, and HotelLook adapters.
- `lib/db.ts` does not exist in this worktree. Current DB entry points are `lib/db/client.ts` and `lib/db/getBaseline.ts`.

## Executive Summary

Flight Deal Score is mostly honest when the live result set is rendered: current fares come from provider adapters, score calls fetch route snapshots from Postgres, thin or absent history is low-confidence and capped at `Typical`, and flight cards show an explicit unavailable state when scoring fails.

Trust gaps remain:

- Homepage copy overstates the baseline by saying each option is compared against route history, median price, and percentile even when route history can be absent or score loading can fail.
- Hotel cards silently omit Deal Score when the hotel score request fails or no hotel baseline exists, unlike flight cards.
- Persisted deal detail pages render stored Deal Score fields from the `deals` table without showing the actual baseline source, point count, freshness, or whether all score fields came from a consistent score computation.
- The baseline is route-only for flights and hotel-id-only for hotels. It does not include provider identity, cabin, stops, passenger count, trip type, fare scope, travel date proximity, hotel room type, taxes/fees, or hotel rating.

## Data Lineage Map

### Flight Search Result Score

1. Provider response enters `app/api/search/route.ts`.
   - Travelpayouts, Duffel, Amadeus, and Kiwi are called through `lib/providers` only (`app/api/search/route.ts:4` to `app/api/search/route.ts:8`).
   - Provider responses are normalized to `NormalizedFare` with integer minor-unit money (`lib/types.ts:12` to `lib/types.ts:29`).
   - `/api/search` streams NDJSON `flights` chunks and catches provider exceptions into notices (`app/api/search/route.ts:183` to `app/api/search/route.ts:195`).

2. Client stores and scores fares.
   - `runSearch` appends streamed fares, deduplices them, and calls `fireScore` for each new fare (`app/page.tsx:758` to `app/page.tsx:763`).
   - `fireScore` posts the full `NormalizedFare` to `/api/score`; non-OK responses or network failures store `scores[fare.id] = null` (`app/page.tsx:591` to `app/page.tsx:608`).

3. Score API fetches the comparison baseline.
   - `POST /api/score` accepts `{ fare }`, calls `getBaseline(fare.origin, fare.destination)`, and returns `scoreDeal(fare, history)` (`app/api/score/route.ts:87` to `app/api/score/route.ts:111`).
   - `getBaseline` loads `snapshots` rows for the exact origin/destination where `fetched_at >= NOW() - INTERVAL '90 days'` (`lib/db/getBaseline.ts:10` to `lib/db/getBaseline.ts:18`).
   - The DB schema records route snapshots by `origin`, `destination`, `date`, `price_cents`, `currency`, `source`, and `fetched_at` (`lib/db/schema.sql:1` to `lib/db/schema.sql:12`).
   - Nightly snapshots are sourced from `travelpayouts.priceTrends`, including golden routes and user-searched routes (`scripts/snapshot-job.ts:104` to `scripts/snapshot-job.ts:148`).

4. Score computation.
   - `scoreDeal` filters history to the current fare currency only (`lib/scoring/scoreDeal.ts:73`).
   - No comparable history returns `Typical`, low confidence, percentile `50`, median `0`, and an explanation saying no history is available (`lib/scoring/scoreDeal.ts:75` to `lib/scoring/scoreDeal.ts:88`).
   - Fewer than 10 comparable points are low confidence (`lib/scoring/scoreDeal.ts:91` to `lib/scoring/scoreDeal.ts:93`).
   - Low-confidence scores are capped at `Typical`; `Great` and `Good` require high confidence (`lib/scoring/scoreDeal.ts:121` to `lib/scoring/scoreDeal.ts:133`).

5. Display and sorting.
   - Flight cards show score loading, score panel, or explicit unavailable panel (`app/components/FlightCard.tsx:344` to `app/components/FlightCard.tsx:350`).
   - Low-confidence flight display says "Not enough route history for a confirmed deal rating" and `DealBadge` shows "Limited history" (`app/components/FlightCard.tsx:173` to `app/components/FlightCard.tsx:190`; `app/components/DealBadge.tsx:14` to `app/components/DealBadge.tsx:17`).
   - Sorting defers Deal Score ordering while scoring is incomplete, then ranks by confidence/verdict, percentile, pct-vs-median, and deterministic fallback (`app/page.tsx:895` to `app/page.tsx:907`; `lib/search/sortFlights.ts:38` to `lib/search/sortFlights.ts:64`).

Available baseline at render time: exact route, same-currency price snapshots fetched within 90 days. It is not provider-specific, cabin-specific, stop-count-specific, passenger-count-specific, or trip-type-specific.

### Hotel Result Score

1. Hotel provider response enters `app/api/search/route.ts`.
   - HotelLook is called only through `lib/providers/hotellook.ts` (`app/api/search/route.ts:281`).
   - The adapter normalizes nightly money as `{ priceCents, currency: 'USD' }` and attaches a HotelLook affiliate deeplink (`lib/providers/hotellook.ts:91` to `lib/providers/hotellook.ts:118`).

2. Client scores hotels.
   - `runSearch` stores hotel results and calls `fireHotelScore` for each hotel (`app/page.tsx:763` to `app/page.tsx:768`).
   - `fireHotelScore` sends only `hotelId`, `pricePerNightCents`, and `currency` to `/api/score?type=hotel`; failures store `hotelScores[hotel.id] = null` (`app/page.tsx:611` to `app/page.tsx:631`).

3. Score API fetches hotel baseline.
   - `GET /api/score?type=hotel` validates positive integer `pricePerNightCents`, loads `hotel_snapshots` by `hotel_id` and `fetched_at >= 90 days`, then calls `scoreDeal` with a minimal hotel object (`app/api/score/route.ts:40` to `app/api/score/route.ts:84`).
   - `hotel_snapshots` stores `hotel_id`, `date`, `price_per_night_cents`, `currency`, and `fetched_at` (`lib/db/schema.sql:17` to `lib/db/schema.sql:29`).

4. Display.
   - A hotel score panel shows percentile, usual median, pct-vs-median, and explanation when `score` exists (`app/components/HotelCard.tsx:117` to `app/components/HotelCard.tsx:167`).
   - If `score` is null and not loading, HotelCard renders no Deal Score fallback at all (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`).

Available baseline at render time: exact hotel-id same-currency nightly snapshots fetched within 90 days. It is not room-type-specific, occupancy-specific, refundable-policy-specific, tax/fee-inclusive, or rating-derived.

### Persisted Deal Detail Score

1. Deal detail loads from `deals`.
   - `getDealDetail` selects `* FROM deals WHERE id = $1` (`lib/deals/dealDetail.ts:178` to `lib/deals/dealDetail.ts:202`).
   - Score fields are parsed directly from row columns such as `deal_score`, `score_verdict`, `score_confidence`, `score_explanation`, `score_percentile`, and `score_pct_vs_median` (`lib/deals/dealDetail.ts:164` to `lib/deals/dealDetail.ts:169`).

2. Display.
   - The detail page shows "Great deal score X" or similar when `scoreVerdict` and `dealScore` are present (`app/deals/[dealId]/page.tsx:111` to `app/deals/[dealId]/page.tsx:122`).
   - It hides percentile and pct-vs-median when `scoreConfidence` is low, but it can still display a high-certainty verdict summary if confidence is missing and verdict/score exist (`app/deals/[dealId]/page.tsx:125` to `app/deals/[dealId]/page.tsx:135`).

Available baseline at render time: stored score fields only. The page does not fetch or recompute the baseline and does not show score point count, source, or freshness beyond deal `updatedAt`.

## Findings

### P0: Persisted deal detail scores can overstate certainty without baseline lineage

Evidence: `DealDetailPage` can display `${scoreVerdict} deal score ${dealScore}` when those two fields exist, even if `scoreConfidence`, percentile, pct-vs-median, baseline source, and point count are absent (`app/deals/[dealId]/page.tsx:111` to `app/deals/[dealId]/page.tsx:122`). The data comes directly from stored DB columns (`lib/deals/dealDetail.ts:164` to `lib/deals/dealDetail.ts:169`), not from the current `scoreDeal` path.

Trust impact: A stored deal can claim `Great` or `Good` without proving at render time whether the score came from recent route history, a hotel baseline, a mixed/imported baseline, or incomplete inputs.

Repair direction for a future ticket: Require confidence plus baseline metadata before rendering confident Deal Score copy on deal detail pages, or downgrade to neutral "Score details unavailable" copy when lineage fields are incomplete.

### P1: Hotel cards silently omit Deal Score when scoring is unavailable

Evidence: hotel score request failures set `hotelScores[id] = null` (`app/page.tsx:621` to `app/page.tsx:631`), and `HotelCard` renders nothing when `score` is null and not loading (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`).

Trust impact: Users see hotel price/rating cards with no explanation that baseline comparison failed, was absent, or was still unavailable. This is less honest than the flight card path, which explicitly says Deal Score is unavailable (`app/components/FlightCard.tsx:197` to `app/components/FlightCard.tsx:214`).

Repair direction for a future ticket: Add a hotel-specific unavailable score state matching the existing flight fallback semantics.

### P1: Homepage copy overstates that every option has a complete comparison baseline

Evidence: the hero says "Search current fares and compare each option against recent route history, median price, and deal percentile" (`app/page.tsx:960` to `app/page.tsx:965`). The trust footer says Deal Scores compare current prices with recent route history (`app/page.tsx:321` to `app/page.tsx:325`). In reality, baseline DB load can fail, route history can be empty, currency may be non-comparable, and hotel score failure can be hidden.

Trust impact: This is broadly true for scored high-confidence flight results, but too absolute for all rendered options.

Repair direction for a future ticket: Qualify copy to "when history is available" or equivalent. Do not change scoring math.

### P1: Baseline is narrower than several visible comparison cues imply

Evidence: flight baseline is selected by origin/destination only (`lib/db/getBaseline.ts:10` to `lib/db/getBaseline.ts:18`). `scoreDeal` labels it "route" history (`lib/scoring/scoreDeal.ts:41` to `lib/scoring/scoreDeal.ts:43`). Sorting and cards compare provider results that may differ by provider, cabin, stop count, passenger count, trip type, and price scope.

Examples:

- Duffel and Amadeus fares use `priceScope: 'party_total'` (`lib/providers/duffel.ts:201` to `lib/providers/duffel.ts:207`; `lib/providers/amadeus.ts:220` to `lib/providers/amadeus.ts:226`), while Travelpayouts uses per-person prices (`lib/providers/travelpayouts.ts:190` to `lib/providers/travelpayouts.ts:193`). All are scored against the same route snapshot pool.
- Stops are visible and sortable, but baseline does not separate nonstop from connecting fares (`app/components/FlightCard.tsx:286` to `app/components/FlightCard.tsx:288`; `lib/db/schema.sql:1` to `lib/db/schema.sql:12`).
- Hotel baseline is hotel-id-only and does not include room type, occupancy, taxes, fees, or cancellation policy (`app/api/score/route.ts:13` to `app/api/score/route.ts:31`).

Trust impact: The current copy is generally careful at the card level, but users may infer a richer market comparison than the data supports.

### Passing: Thin or absent score evidence degrades honestly in core flight scoring

Evidence: no comparable history returns low-confidence `Typical` with explicit no-history explanation (`lib/scoring/scoreDeal.ts:75` to `lib/scoring/scoreDeal.ts:88`). Fewer than 10 comparable points are low confidence (`lib/scoring/scoreDeal.ts:91` to `lib/scoring/scoreDeal.ts:93`). Low confidence cannot emit `Great` or `Good` (`lib/scoring/scoreDeal.ts:121` to `lib/scoring/scoreDeal.ts:133`). The flight card displays low confidence as "Limited history" rather than the nominal verdict (`app/components/DealBadge.tsx:14` to `app/components/DealBadge.tsx:17`).

### Passing: Equal and near-equal flight scores sort deterministically

Evidence: after scores settle, `sortFlights` orders by score rank, percentile, pct-vs-median, then currency, price, stops, departure, carrier, and id (`lib/search/sortFlights.ts:14` to `lib/search/sortFlights.ts:43`). While scores are pending, deal sort intentionally uses the same deterministic fallback (`lib/search/sortFlights.ts:56` to `lib/search/sortFlights.ts:64`) and the UI announces "Updating deal ranking as scores finish" (`components/flights/FlightResults.tsx:268` to `components/flights/FlightResults.tsx:275`).

## Result<T> Provider Behavior

Provider adapters generally degrade into typed `Result<T>` failures instead of throwing to callers:

- Travelpayouts catches parse/cache/fetch errors and returns `{ ok: false, reason }` in both `priceTrends` and `searchFares` (`lib/providers/travelpayouts.ts:87` to `lib/providers/travelpayouts.ts:127`; `lib/providers/travelpayouts.ts:132` to `lib/providers/travelpayouts.ts:309`).
- Duffel catches adapter failures and returns `{ ok: false, reason }` (`lib/providers/duffel.ts:136` to `lib/providers/duffel.ts:226`).
- HotelLook catches adapter failures and returns `{ ok: false, reason }` (`lib/providers/hotellook.ts:69` to `lib/providers/hotellook.ts:121`).
- Kiwi validates config and deeplinks as `Result<T>`, then catches search failures (`lib/providers/kiwi.ts:67` to `lib/providers/kiwi.ts:102`; `lib/providers/kiwi.ts:126` to `lib/providers/kiwi.ts:221`).
- Amadeus wraps `searchFares` in a catch and returns typed failures; `getToken` can throw internally, but it is called inside that `searchFares` catch (`lib/providers/amadeus.ts:69` to `lib/providers/amadeus.ts:95`; `lib/providers/amadeus.ts:122` to `lib/providers/amadeus.ts:245`).

Caller protection: `/api/search` additionally wraps each provider call and emits provider notices on exceptions (`app/api/search/route.ts:183` to `app/api/search/route.ts:195`).

Non-provider caveat: `lib/db/client.ts` throws when `DATABASE_URL` is missing (`lib/db/client.ts:5` to `lib/db/client.ts:13`). The score API catches baseline load failures and returns 502 (`app/api/score/route.ts:63` to `app/api/score/route.ts:70`; `app/api/score/route.ts:100` to `app/api/score/route.ts:107`), which the client degrades to null score.

## Manual Verification Flow

Static/manual flow completed for a full flight result set sorted by Deal Score:

1. Start with `/api/search` returning at least three `NormalizedFare` rows.
2. `runSearch` streams and stores fares, then fires one `/api/score` request per fare (`app/page.tsx:758` to `app/page.tsx:763`).
3. While any visible score is missing or loading, `rankingUpdating` is true and `sortFlights` uses deterministic fallback ordering (`app/page.tsx:895` to `app/page.tsx:907`; `lib/search/sortFlights.ts:56` to `lib/search/sortFlights.ts:64`).
4. After every visible fare has a score entry, including null failures, `sortFlights` ranks by high-confidence deal quality first, then percentile, pct-vs-median, and fallback fields (`lib/search/sortFlights.ts:25` to `lib/search/sortFlights.ts:43`).
5. `FlightResults` renders cards in `displayFlights` order and passes each score/null/loading state into `FlightCard` (`components/flights/FlightResults.tsx:323` to `components/flights/FlightResults.tsx:334`).

The existing unit test `lib/search/__tests__/sortFlights.test.ts` covers high-confidence deal ordering, pending-score fallback, deferred ranking, price sorting, and low-confidence scores not outranking high-confidence deals.

Live browser verification was not run because this audit did not require UI changes and prior audits in this sandbox noted dev-server bind failures. No visual regressions were introduced.

## Blockers and Out-of-Scope Notes

- No live provider or database credentials were available in this sandbox, so baseline freshness/row counts could not be verified against production data.
- `components/TicketCard.tsx`, `components/TicketSlideOver.tsx`, `app/api/run/[id]/route.ts`, and `lib/db.ts` are absent; current equivalents were audited instead.
- No new Deal Score algorithm, provider call, fake market average, booking behavior, or affiliate behavior was added.
- Out of scope but relevant: persisted deal score storage schema is not defined in `lib/db/schema.sql`, so audit could not verify how `deals.score_*` fields are generated or kept consistent.

