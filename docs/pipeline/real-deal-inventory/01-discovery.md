# UXD-REAL-DEAL-INVENTORY-01: Real deal inventory and data readiness

**Stage:** UX Discovery  
**Date:** 2026-07-22  
**Priority:** P0  
**Primary surface:** production hotel deal feed (`/`, `/deals`, `GET /api/deals`)  
**Operational surface:** `POST /api/pipeline/run`, nightly snapshot workflow, `price_snapshots` and `deals`

## Problem statement

A first-time user asking expaify for a current hotel deal receives three sample offers instead of verified inventory because the production collection job is exhausting its hotel-provider quota before the first market, the job still reports success, and the product replaces an empty real feed with mocks—so users cannot tell that no current price evidence or bookable deal was produced.

## Who is affected and where the flow breaks

- **Who:** first-time visitors, free members deciding whether expaify is credible, and Premium members expecting live inventory.
- **Where:** the failure begins before the browsing flow, at provider collection and snapshot persistence. It becomes visible at the landing-page hero and `/deals`, where a zero-row real query is replaced with sample cards.
- **User consequence:** the product appears populated, but the returned rows have no real city, no provider verification timestamp, and no rate-specific booking handoff. A user cannot answer “is this actually available now?” or “is this a real deal?” from the primary output.

## Production symptom: confirmed

Observed against production on 2026-07-22:

1. `GET https://expaify.com/api/deals` returned HTTP 200 with exactly three rows. Every row had `isMock: true`, an ID beginning `mock-`, an empty `city`, and sample pricing. This matches `generateMockDeals(3)` in `lib/pipeline/mock.ts`, reached by the no-real-data fallback in `app/api/deals/route.ts`.
2. The latest Nightly Snapshot run, GitHub Actions run `29915534737`, received:
   `{"ok":true,"markets":19,"totalNewDeals":0,"alertsSent":0,"rateLimited":true,"results":{"MIA":{"error":"RAPIDAPI quota exhausted (429)"}}}`.
3. Each inspected run from 2026-07-15 through 2026-07-22 that reached the API reported the same first-market `RAPIDAPI quota exhausted (429)` result and zero deals. GitHub marked those HTTP-successful runs green because the endpoint returns HTTP 200 with `ok: true` even when `rateLimited: true` and zero markets complete.
4. The 2026-07-21 run failed separately because the runner could not connect to `expaify.com`; the workflow then attempted to parse an empty response as JSON.
5. An unauthenticated `POST /api/pipeline/run` returned HTTP 401, confirming that bearer protection is active. Production DB contents and secret values were not accessed in this discovery stage.

The current absence of real deals is therefore not just hypothetical or attributable to a missing key: production reaches the keyed RapidAPI path, but the shared quota is already exhausted before Miami can return inventory.

## Current data flow

```text
GitHub Actions Nightly Snapshot
  -> POST /api/pipeline/run with PIPELINE_SECRET
  -> read active tracked_markets from Postgres (19 in current runs)
  -> for each market, lib/pipeline/snapshot.ts
       -> choose one of two fixed future check-in anchors
       -> if RAPIDAPI_KEY is absent: generate five mock hotels
       -> if key exists: call RapidAPI Booking.com / coordinate Booking.com /
          TripAdvisor endpoints in rotation
       -> normalize price to integer USD cents
       -> upsert one price_snapshots row per hotel/market/check-in/day
  -> lib/pipeline/dealDetection.ts groups 60 days of snapshots
       -> require at least 3 rows for the same hotel + market + check-in
       -> flag only when latest price <= 70% of median
       -> upsert deals, carrying bool_or(is_mock)
  -> public queries request active deals with is_mock = false
  -> if none exist, landing page and GET /api/deals substitute hard-coded samples
```

Two separate hotel snapshot systems exist and must not be confused:

- `scripts/snapshot-job.ts` uses the `HotellookProvider` and writes `hotel_snapshots`; these rows do **not** feed the current deal detector.
- `/api/pipeline/run` uses `lib/pipeline/snapshot.ts` and writes `price_snapshots`; only these rows feed `deals` and the public hotel deal feed.

Running the older snapshot script or validating `hotel_snapshots` alone cannot make a real deal appear.

## Why no real deals exist

### Confirmed primary cause

**The configured RapidAPI account has no usable quota at collection time.** `lib/pipeline/snapshot.ts` converts a provider HTTP 429 into `RateLimitError`; `/api/pipeline/run` catches it on Miami, sets `rateLimited = true`, and breaks the market loop. No market snapshot is written and no detection pass runs. This exact response repeats in the inspected production runs.

### Confirmed masking and monitoring failures

1. **A failed collection is reported as success.** `/api/pipeline/run` returns `{ ok: true }` and HTTP 200 after a quota stop. The workflow checks only curl/JSON parsing, not `ok`, `rateLimited`, per-market completion, snapshot count, or real-deal count. Operationally failed runs are therefore green.
2. **The feed fabricates availability instead of exposing the outage.** `GET /api/deals` returns three generated rows whenever the real query returns no rows; the landing page separately substitutes two hard-coded sample cards. This hides both a legitimate no-deal day and an inventory outage behind the same sample UI.
3. **The endpoint reports misleading totals.** `markets: 19` means markets configured, not markets completed. In the observed response only `MIA` appears in `results`, and even it failed.

### Additional blockers and readiness risks to verify

1. **History cannot become eligible immediately after quota repair.** The detector requires three snapshots for the identical `hotel_id + market_id + check_in`. Because two anchor dates alternate, the earliest one anchor normally reaches three daily observations is about five calendar days, assuming the same hotel remains in provider results. A qualifying deal also requires a real price drop of at least 30%; healthy collection can correctly yield zero deals.
2. **Provider rotation can return empty without an actionable reason.** Non-429 HTTP failures and valid empty responses are flattened to `[]`; the rotation tries another source, then records `hotelsProcessed: 0` without provider/status diagnostics. Malformed payloads are also indistinguishable from no supply at the pipeline response.
3. **Schema deployment is not automated.** `scripts/seed.ts` applies `lib/db/schema.sql`, but the production deploy workflow does not run it. `tracked_markets`, `price_snapshots`, constraints, and `deals` may exist today because production reaches 19 markets, but future schema changes can drift silently.
4. **The public feed cannot distinguish no qualifying discount from no provider inventory.** Both become zero real rows, then mocks. There is no durable run ledger with attempted markets, provider, rows received, rows written, or last successful real capture.
5. **Affiliate readiness is incomplete.** `buildOtaLinks` silently emits unmarked Expedia, Booking.com, and Kiwi links when their provider-specific affiliate IDs are absent. The deploy workflow supplies `TP_AFFILIATE_MARKER` but not `EXPEDIA_AFFILIATE_ID`, `BOOKING_AFFILIATE_ID`, `KIWI_AFFILIATE_ID`, or the briefing’s `HOTEL_AFFILIATE_ID`. Launching real deals under that configuration would violate the outbound-marker contract.

## Contract conflicts that downstream work must resolve

This discovery ticket does not authorize a fix, but the existing collection path conflicts with the stated non-negotiable contract:

- `lib/pipeline/snapshot.ts` calls three vendor APIs directly instead of going through `lib/providers`.
- Its provider functions return arrays, return empty on errors, or throw `RateLimitError`; they do not return `Result<T>`.
- The production hotel pipeline depends on `RAPIDAPI_KEY`, which is not in the approved secret list in the ticket briefing. The approved hotel secret is `HOTEL_AFFILIATE_ID`; it does not supply inventory by itself.
- Snapshot normalization represents money as `priceCents` plus an implicit/hard-coded USD value rather than carrying the complete `{ priceCents, currency }` object through the provider boundary.
- OTA URLs are stored even when affiliate environment variables are absent.

UXR/UXDES may define states and operational evidence, but DEV must not merely increase quota around this path. Product/engineering must first approve a compliant hotel inventory provider and move access behind `HotelProvider` with `Result<T>` semantics.

## Required environment, provider, and data checks

### Environment and deployment

All checks should prove presence/configuration without printing secret values.

| Check | Launch expectation | Failure meaning |
|---|---|---|
| `DATABASE_URL` in the running container | Present; read/write test succeeds against intended production DB | Pipeline cannot read markets or persist snapshots/deals |
| `PIPELINE_SECRET` in Actions and container | Present on both sides; authenticated smoke run returns non-401 | Nightly trigger cannot authorize |
| Approved hotel inventory credentials | Present for the selected compliant `HotelProvider` | No real inventory; do not generate substitutes |
| Current `RAPIDAPI_KEY` during transition | Valid subscription with sufficient daily/monthly quota, if temporarily retained by explicit approval | Current collector returns mocks when absent or stops on 429 when exhausted |
| `HOTEL_AFFILIATE_ID` and every emitted OTA marker | Present and verified in stored outbound URLs | Booking links violate affiliate contract |
| `REDIS_URL` | Present if the selected provider uses six-hour caching; cache get/set smoke test passes | Excess provider traffic and quota exhaustion risk |

### Provider response

For one controlled market and future date, through the provider adapter only:

- Result is `{ ok: true, data: [...] }`, not an exception.
- At least one hotel has a stable non-empty provider ID and name.
- `pricePerNight.priceCents` is a positive safe integer and currency is a three-letter code.
- The returned date, occupancy, room count, tax/fee basis, and nightly-versus-stay basis are known; current RapidAPI snapshot parsing assumes two adults, one room, two nights and USD.
- Property IDs remain stable across repeated captures and do not collide across providers; provider namespace is retained.
- Empty supply, malformed response, authentication failure, timeout, and rate limit remain distinct reasons.
- Any outbound deeplink contains an approved affiliate marker and preserves hotel/dates where the provider supports it.

### Database readiness

Run read-only checks before any manual pipeline trigger:

```sql
SELECT COUNT(*) AS active_markets FROM tracked_markets WHERE active = true;

SELECT snapshot_date, is_mock, COUNT(*) AS rows,
       COUNT(DISTINCT market_id) AS markets,
       COUNT(DISTINCT hotel_id) AS hotels
FROM price_snapshots
WHERE snapshot_date >= CURRENT_DATE - 14
GROUP BY snapshot_date, is_mock
ORDER BY snapshot_date DESC, is_mock;

SELECT market_id, hotel_id, check_in,
       COUNT(*) AS points,
       BOOL_OR(is_mock) AS contains_mock,
       MIN(price_cents) AS min_cents,
       MAX(price_cents) AS max_cents
FROM price_snapshots
WHERE captured_at >= NOW() - INTERVAL '60 days'
GROUP BY market_id, hotel_id, check_in
HAVING COUNT(*) >= 3
ORDER BY points DESC;

SELECT status, is_mock, COUNT(*) AS deals
FROM deals
GROUP BY status, is_mock
ORDER BY status, is_mock;
```

Also verify the unique constraints named in code exist (`price_snapshots_unique`, `deals_hotel_market_checkin`), prices are positive integers, currencies are expected, check-in dates are future dates, and no real group is contaminated by mock history. Because detection uses `BOOL_OR(is_mock)`, one mock row in a hotel/date group makes its derived deal mock and therefore invisible publicly.

## Operational runbook

### 1. Triage the current outage

1. Check the latest Nightly Snapshot workflow response, not only its green/red badge.
2. Treat any `rateLimited: true`, fewer result entries than active markets, provider error, or zero real rows written as a failed collection.
3. Confirm quota/subscription status with the approved provider owner. Do not rotate keys, purchase quota, or change provider terms without product/engineering approval.
4. Confirm production DB connectivity and run the read-only snapshot/deal queries above.
5. Confirm the active container revision has the intended secret references and that affiliate markers are configured; never echo values.

### 2. Validate a repaired collection path

1. Apply/verify schema through the controlled DB process before running collection.
2. Invoke one authenticated pipeline canary scoped to one market once a compliant provider path supports scoping. The current endpoint runs all markets and should not be repeatedly retried against a limited quota.
3. Require a machine-detectable success response containing: provider used, markets attempted/completed/failed, real hotels received, real rows written, mock rows written, rate-limit state, and detection count.
4. Query `price_snapshots` and verify newly captured rows are `is_mock = false`, have valid integer cents/currency, and cover the canary market/date.
5. Expand to all active markets only after the canary passes and quota math supports the call volume.
6. Let real history accumulate. With the current alternating anchors, wait until at least one cohort has three distinct real snapshot dates; do not backfill fake high prices to manufacture launch deals.
7. Run detection and verify any active deal is derived only from real rows, meets the 30% threshold, has a future check-in, and has marked outbound links.

### 3. Monitor every scheduled run

The workflow must fail and alert when any of these occur:

- authentication, network, DB, or schema failure;
- `rateLimited: true`;
- no markets attempted, no markets completed, or completion below the agreed coverage target;
- zero real snapshots written when provider supply was expected;
- real snapshot age exceeds 30 hours;
- unmarked outbound links are generated;
- three consecutive healthy collections produce no snapshot cohort with three usable points (indicates unstable IDs/dates or persistence mismatch).

Record run-level counts durably so support can distinguish “no qualifying 30% price drop today” from “we did not check prices today.”

### 4. Recovery and communication

- On one failed run: retain the last verified real deals only while their own check-in/expiry rules and freshness policy allow, label the last successful check, and investigate.
- After the freshness limit or when no verified real deals remain: return an honest unavailable/empty state; suppress booking and “live/current” claims.
- Never promote mock rows into the live API, alerts, account counts, or Deal Score evidence. Samples may exist only in an explicitly labelled, non-bookable “How it works” context.
- Do not send instant/digest alerts unless the source deal is non-mock and the current run is healthy.

## Minimum real-deal threshold for launch

The **minimum public content gate is 3 simultaneously active, non-mock hotel deals across at least 2 tracked markets**. Three is the smallest defensible threshold because the public API and landing experience currently reserve three deal positions; fewer would make the “live deals” proposition depend on repeated or sample content.

Every counted deal must also:

- be based on at least 3 distinct, non-mock snapshot dates for the same hotel/market/check-in;
- meet the detector’s genuine price rule (latest price at least 30% below median), without synthetic backfill;
- have a positive integer price, explicit currency, future check-in, provider/source lineage, and last-checked timestamp;
- have at least one valid, affiliate-marked booking handoff;
- remain visible through `GET /api/deals` with `isMock: false`.

The content gate is necessary but not sufficient. Before launch, **three consecutive scheduled collections** must also complete without rate limiting and write real snapshots for at least **90% of active markets** (currently 18 of 19). This separates a lucky set of old deal rows from an operationally ready pipeline.

If fewer than three genuine deals happen to qualify after a healthy collection period, the system is working but the “live deals” launch claim is not ready. Product should show the honest fallback below rather than lower the discount/history rules or seed fabricated deals.

## Fallback behavior when real inventory is unavailable

The live feed should return zero real rows plus explicit availability metadata; it should not substitute mocks. The user-facing state should say:

> **No verified hotel deals are available right now.**  
> We couldn’t confirm current hotel prices. We’ll keep checking—try again after the next daily update.

Rules:

- Do not show a sample price, discount, snapshot count, “found today,” provider logo, booking CTA, Deal Score, or alert claim at real-deal visual weight.
- If the pipeline is healthy but no price crossed the threshold, use different copy: “No hotel prices are 30%+ below their recent norm right now. We checked today and will keep watching.”
- Show last successful real check only when backed by run data.
- Offer safe recovery: retry after the next scheduled check, browse tracked destinations, or join a notification waitlist. Do not promise an alert unless its backend path is healthy.
- If samples remain for education, label the section “Example—not a live or bookable deal,” keep it outside `/api/deals`, and disable outbound links.

## Measurable signals

- **Current user-facing signal:** 3/3 production API rows are mocks; 0 are real.
- **Current operational signal:** seven inspected API-reaching runs from 2026-07-15 through 2026-07-22 stopped at the first market with HTTP 429 and produced zero deals; the workflow still showed success for the HTTP-200 runs.
- **Readiness signals:** real snapshots written per run, market completion rate, age of last successful real capture, number of three-point real cohorts, active non-mock deal count, number of markets represented, and affiliate-link marker coverage.
- **Trust signal after repair:** no mock row is returned from the live API or counted in “live deal” messaging.

## Constraints

1. **Data integrity and provider contract:** external hotel access must move through `lib/providers`; adapters return `Result<T>`, money stays integer minor units with explicit currency, synthetic history never qualifies a real deal, and all outbound links are affiliate-marked.
2. **Trust and repair-mode scope:** unavailable inventory must be disclosed plainly. No change may weaken the three-snapshot/30%-drop evidence rule, manufacture launch inventory, or introduce a new consumer feature.
3. **Operational resilience and accessibility:** collection failures must be machine-visible and distinguishable from no qualifying deal; the fallback must remain usable and readable at 375px and 1280px, with accessible status semantics and no dead booking controls.

## Success statement

This is solved when a first-time user can open expaify and see at least three current, provider-backed, non-mock hotel deals across two destinations—with trustworthy price history and marked booking handoffs—without encountering sample inventory disguised as live data; and when no qualifying deal exists, the user sees an honest, actionable status that distinguishes “nothing is discounted” from “inventory could not be checked.”

## Scope for the next stage

UXR should audit the exact live-feed empty/outage states, compare honest inventory-status patterns from one or two travel products, and turn the operational evidence into testable directives. Provider selection, quota purchase, schema migration, run-ledger implementation, HTTP status changes, and fallback removal are DEV/UI work after design approval; they are not changed by this discovery ticket.
