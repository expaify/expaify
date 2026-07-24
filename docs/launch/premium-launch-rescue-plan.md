# Premium launch rescue plan

**Ticket:** `PREMIUM-LAUNCH-RESCUE-BRAIN-01`  
**Decision date:** 2026-07-22  
**Owner:** Product / Scrum  
**Launch decision:** **NO-GO for starting or converting paid Premium subscriptions.**

## Executive decision

Premium cannot launch while the production deal feed is backed only by generated examples. The paid entitlement currently unlocks filters, search, watchlists, and email settings, but those features have no useful inventory to operate on when there are no verified real deals. In that condition the authenticated Premium feed receives the same three generated, non-bookable hotels as the public feed.

Effective immediately, sample or mock records are not acceptable paid inventory. A sample may appear only in a clearly separated public marketing demonstration. It must never be returned as a deal by the authenticated Premium API, counted as inventory, included in a paywall comparison, scored as a real deal, sent in an alert, or used to justify a charge.

The release owner may issue a Premium go decision only after every minimum launch gate in this document has passed in production and the evidence has been attached to the release ticket.

## Evidence reviewed and source limitation

This plan traces the checked-in implementation for:

- `app/api/deals/route.ts` and `app/api/deals/[id]/route.ts`
- `app/deals/page.tsx`, `app/deals/DealFeed.tsx`, and `app/deals/[dealId]/page.tsx`
- `lib/paywall.ts`, `lib/subscription.ts`, and the account/onboarding routes and pages
- Stripe checkout, webhook, and portal routes
- `lib/pipeline/snapshot.ts`, `lib/pipeline/dealDetection.ts`, `lib/pipeline/dealRules.ts`, `lib/pipeline/mock.ts`, and `lib/pipeline/otaLinks.ts`
- instant and daily email delivery paths
- database schema, snapshot/digest workflows, and deploy configuration

`ORCH_START_HERE.md` is not present in this worktree, its parent worktree directory, or the repository tree/history visible from this branch. The requested Launch Blocker Addendum therefore could not be read. Its absence is a release-evidence blocker: Product must attach or restore the addendum and reconcile it with this plan before the final go/no-go review. No addendum requirements have been guessed.

Production was probed read-only on 2026-07-22 at 13:55 GMT. `GET https://expaify.com/api/deals` returned HTTP 200 with `premium:false`, `total:3`, and three unlocked deals whose IDs were `mock-1`, `mock-2`, and `mock-3`; every row had `isMock:true`, an empty city, a generated price, and `snapshotCount:12`. The deployed public `/deals` and `/join` routes returned HTTP 200. The probe did not have a Premium session or production database/Stripe access, so subscriber counts, internal pipeline runs, Stripe configuration, and an authenticated deployed response remain unverified operations checks—not assumed facts.

## Current factual state

| Surface | Verified current behavior | Launch consequence |
|---|---|---|
| Production public deals API | Returns three generated mock hotels as unlocked deals when no real rows are available. This was observed in production on 2026-07-22. | The production feed is currently demonstrating inventory, not delivering live deal value. |
| API cold-start behavior | `GET /api/deals` queries with `includeMock:false`, but when no real rows are returned and no Premium filter is active it calls `generateMockDeals(3)` for every tier. The generated rows are unlocked and include invented prices, medians, discounts, and 12 checks. | A Premium subscriber can receive samples as the full paid result. The API has no explicit verified-inventory state. |
| Server-rendered feed | `/deals` repeats the same fallback independently when its real query is empty or caught as an error. | Database failure and genuinely empty inventory both become a sample feed, hiding the operational distinction. |
| Sample presentation | The feed calls these “Example deals,” and cards say “Sample hotel — not bookable.” Mock cards do not expose detail links or marketplace buttons. | Copy is honest at card level, but disclosure does not make examples a paid product or a substitute for inventory. |
| Premium versus free | Free gets a deterministic global set of up to three real deal IDs; Premium gets all real rows plus filters, sort, natural-language search, watchlists, and alerts. `trialing` and `active` are Premium. | The entitlement difference exists in code, but it has no material value when the real set is empty. Free unlock usage is not stored per user despite account copy describing a weekly allowance. |
| Account and sales copy | Account promises the first alert “usually within 24 hours,” calls the feed “live,” and pricing sells unlimited deals and instant/daily alerts. `/join` sells “Unlimited hotel deal alerts across 19 destinations” and “Full price history.” The schema seeds 20 markets and the homepage says 20. | Claims are unsupported during empty inventory and the destination count is inconsistent. A user can enter a seven-day trial that is designed to convert to a charge. |
| Deal detection | A deal is flagged at 30% or more below a 60-day median with only three stored snapshots. It is expired below three checks or above the recovery threshold. | A real-deal rule exists, but three checks are a thin commercial proof and do not establish provider freshness or booking availability by themselves. |
| Snapshot supply | The production path calls three RapidAPI hotel endpoints directly from `lib/pipeline/snapshot.ts`. When `RAPIDAPI_KEY` is missing it writes generated snapshots with `is_mock:true`; when the key exists it marks returned rows real. The daily workflow invokes the pipeline endpoint. | Supply depends on an undocumented direct-vendor path. Missing credentials generate mock data instead of failing visibly. This conflicts with the required provider boundary and approved-secret contract. |
| Provenance | `price_snapshots` and `deals` have `is_mock`, but no provider/source, provider offer timestamp, request/run ID, or verification status. | `is_mock:false` alone cannot prove which vendor produced a price, when the vendor observed it, or whether the booking link matches that price. |
| Price consistency | RapidAPI adapters normalize to cents in the pipeline, but one Booking response path treats gross price as nightly while another explicitly divides total price by two nights. | Cross-provider median and discount comparisons may mix total-stay and nightly amounts. This is a money/trust blocker. |
| Booking links | Real deal links are constructed later from hotel/date search URLs rather than preserved from the priced offer. Affiliate IDs are optional. Deploy config supplies `TP_AFFILIATE_MARKER` but does not supply the Expedia, Booking, or Kiwi affiliate IDs referenced by the builder. | A displayed price is not demonstrably bookable from its outbound link, and several links can ship without required affiliate markers. |
| Alerts | Daily digest explicitly excludes `is_mock:true`; the pipeline selects non-mock rows before invoking instant alerts. Digest sends nothing when there are no eligible new deals. | Samples are mostly excluded from email, correctly, but a Premium member may receive no email despite the 24-hour welcome promise. Instant alert defense should also reject mock IDs at its own query boundary. |
| Billing | Stripe checkout creates a seven-day trial; webhook state grants Premium for `trialing`/`active`. Checkout has configuration checks, but no inventory-readiness or launch kill switch. | Billing can begin independently of whether the product has a single verified deal. |
| Operations | Deploy supplies pipeline, Stripe, email, database, and RapidAPI settings; scheduled workflows invoke snapshot and digest endpoints. The snapshot workflow prints summary counts but has no inventory-quality gate or alert on sample-only/zero-real inventory. | A green deploy or HTTP 200 pipeline run can coexist with an unlaunchable paid product. |
| Flights | The deal feed says flight deals are coming soon; current Premium merchandising and feed value are hotel-only. | Flight search elsewhere in the app must not be counted as Premium deal-feed value for this launch. |

## Why Premium is not launchable

1. **There is no verified paid inventory in the observable production feed.** Production is returning generated examples, and the same fallback is used for a Premium session.
2. **Billing is not coupled to value readiness.** Checkout can start a converting trial without checking real deal count, freshness, provenance, bookability, or alert health.
3. **The premium/free distinction collapses under current supply.** Both tiers see the same three unlocked sample cards; filters and alerts cannot create value from examples.
4. **Price truth is not auditable end to end.** The schema lacks provider/run provenance, two provider paths may disagree on nightly versus total price, and booking links are reconstructed rather than tied to the priced offer.
5. **Commercial claims outrun operations.** “Live,” “usually within 24 hours,” “full price history,” and 19/20-destination claims are not conditioned on feed health.
6. **The supply implementation conflicts with product contracts.** External travel calls bypass `lib/providers`, use `RAPIDAPI_KEY` outside the approved secret list in the assigned briefing, and do not return the shared `Result<T>` shape. Per the non-negotiable contract, this must be resolved explicitly rather than accepted by assumption.

## Minimum launch criteria

All gates are mandatory. Passing UI tests alone is not a launch decision.

### G0 — Billing safety is active during rescue

- New checkout and trial creation are disabled in production until the release owner records all gates as passed.
- Existing trialing and active customers are enumerated. Product chooses and records a customer-safe action with Finance/Support: pause trial conversion, extend trials, refund charges taken during the no-value window, and notify affected users. No customer is silently charged for a sample-only period.
- Direct `GET` and `POST` calls to checkout fail closed with an honest `503`/unavailable response while the launch flag is off; hiding a CTA alone is insufficient.

### G1 — Samples are structurally excluded from the paid product

- An authenticated Premium request to `/api/deals` returns only persisted, verified real rows. Every returned row has `isMock:false`; generated `mock-*` IDs are impossible.
- Zero real inventory returns an explicit empty/unavailable state such as `inventoryState:"no_verified_inventory"` and `deals:[]`. Database failure returns a distinct non-200 operational failure. Neither case generates samples.
- `/deals`, deal detail, account deal counts, paywall counts, alerts, digests, score/history views, analytics inventory counts, and readiness checks exclude mock/sample data at their server query boundary.
- Sample cards, if retained, live only on a public marketing/demo surface, are sourced separately from the deal API, cannot be unlocked or filtered as inventory, and are never visible as the authenticated Premium feed.
- Regression tests cover anonymous, free, Premium, empty DB, DB failure, mixed real/mock, filtered-empty, detail, instant alert, and digest cases.

### G2 — Real inventory meets a sustained minimum

For seven consecutive scheduled production pipeline runs:

- At least **10 active verified hotel deals across at least 5 tracked markets** pass all quality predicates below.
- At least 4 qualifying deals exist at every check, ensuring Premium unlocks material inventory beyond the free set of 3.
- Every qualifying deal has a future check-in, positive integer USD nightly price and median, discount of at least 30%, at least 3 non-mock historical observations, an update no older than 30 hours, and at least one valid affiliate-marked outbound link.
- At least 95% of active tracked markets complete each run without provider error; `rateLimited` is false. A market with no qualifying deal may be healthy, but a provider/request failure may not be reported as healthy emptiness.
- A sample-only or zero-real run pages Operations and automatically keeps checkout closed.

The 10-deal/5-market threshold is a minimum launch floor, not a marketing claim that all tracked destinations have deals. Product copy must state actual coverage.

### G3 — Price and provenance are auditable

- Every external hotel request is implemented behind `lib/providers` and returns `Result<T>` without throwing to callers.
- Each snapshot records provider, provider offer/property ID, pipeline run ID, fetched/observed timestamp, price basis (`per_night` or `total_stay`), nights, currency, and mock/verification state.
- Contract tests prove every provider converts total-stay versus nightly prices exactly once into integer USD cents. The same fixture produces the same normalized amount across snapshot, deal, card, detail, and email.
- Deal detection uses only compatible non-mock observations for the same property, market, dates, nights, currency, and price basis. Mock backfill cannot enter a real median or cause a real row to be marked mock.
- The outbound link is traceable to the priced property/date query and is rechecked before display according to the freshness policy. All outbound links carry the configured affiliate marker required for that marketplace.
- Product/Engineering explicitly approves the hotel provider and credential names. `RAPIDAPI_KEY` may not remain an undeclared exception to the assigned contract.

### G4 — Premium has a verified user-visible advantage

Using one free and one Premium production test account against the same feed:

- Free receives exactly the documented server-enforced weekly allowance and cannot rotate sort, filters, offsets, direct IDs, or cookies to expose additional prices or links.
- Premium receives all qualifying real deals unlocked, can use server-enforced discount/star/price/date/destination filters and sort, and can save a watchlist and alert preference.
- With at least 10 qualifying deals, the Premium account can access at least 7 more real deals than the free account.
- No sample card is used in the comparison. The UI is usable at 375px and 1280px with keyboard focus and no locked-data leak.

### G5 — Alerts deliver real value

- A non-production end-to-end fixture and a controlled production canary prove instant and daily delivery from a newly detected `is_mock:false` deal to a Premium test inbox.
- The email price, hotel, dates, discount, history count, detail link, and affiliate booking link match the persisted deal exactly; unsubscribe and preference changes work.
- Mock IDs and stale/expired deals are rejected inside both alert send functions even if a caller passes them directly.
- Empty inventory sends no fake deal email. Account/onboarding copy does not promise an alert within 24 hours; it explains that alerts are sent only when a matching verified deal appears.
- Workflow monitoring records eligible recipients, sent, skipped-by-no-match, failed, and suppressed counts without exposing personal data.

### G6 — Billing lifecycle and claims pass

- Stripe test-mode evidence covers checkout, webhook signature rejection, `trialing`, `active`, payment failure, cancel, and portal access. Entitlement in the API changes with webhook state.
- Production configuration is verified for both price IDs, webhook destination and subscribed event types, billing portal, canonical URLs, and email sender.
- Pricing, join, account, onboarding, FAQ, and feed copy use the same count of tracked markets and make only capabilities proven by G1–G5.
- Checkout readiness is enforced server-side. Regressing below the sustained inventory floor closes new checkout without revoking already-paid access and raises an incident.

### G7 — Release and rollback evidence exists

- TypeScript and the full test suite pass on the release SHA.
- Production smoke evidence includes anonymous, free, Premium, deal detail, affiliate handoff, account, checkout-disabled/enabled, instant alert, daily digest, empty inventory, and provider failure.
- Dashboard/alerts exist for last successful pipeline time, real snapshots by provider, qualifying active deals, markets covered, oldest deal age, mock rows reaching a production boundary (target zero), checkout readiness, webhook failures, and email failures.
- A named on-call owner can disable checkout and email sends without a code deploy. Rollback does not re-enable the sample fallback.

## Prioritized rescue tickets and owners

Tickets are ordered by dependency. P0 tickets remain in repair mode; none is a new product feature.

| Order | Proposed ticket | Priority / owner | Scope | Acceptance check / handoff |
|---:|---|---|---|---|
| 1 | `OPS-PREMIUM-BILLING-FREEZE-01` | P0 — Product Ops + Finance/Support | Disable new converting trials; inventory existing subscribers/trials; document extensions/refunds/comms; restore the missing Launch Blocker Addendum. | Direct checkout calls fail closed; Stripe export and customer action log attached; no affected user will auto-charge during no-go. Handoff to DEV sample exclusion and provider repair. |
| 2 | `DEV-PREMIUM-SAMPLE-EXCLUSION-01` | P0 — Backend | Remove generated fallback from authenticated deal API/page and every paid/product boundary; add explicit empty versus unavailable contracts and tests. | G1 passes, including mixed mock/real and DB-failure tests. `isMock:true` never appears in a Premium deal response. Handoff to UI empty-state repair. |
| 3 | `UI-PREMIUM-VERIFIED-INVENTORY-STATES-01` | P0 — UI | Render honest verified-empty, service-unavailable, and checkout-paused states. Keep public examples outside the member feed; align sales/account claims. | 375px/1280px, keyboard, screen-reader, free/Premium, and error states match the API contract; no examples appear as member inventory. Handoff to TEST. |
| 4 | `DEV-HOTEL-PROVIDER-PROVENANCE-01` | P0 — Data/Backend | Move hotel vendor calls behind provider adapters, normalize price basis, persist provenance/run data, and enforce affiliate-safe link eligibility. Resolve the `RAPIDAPI_KEY` contract conflict with Product/Security. | G3 contract/integration tests pass; provider failures return `Result`; nightly and total prices cannot mix; every eligible link has its marker. Handoff to data recovery. |
| 5 | `OPS-REAL-HOTEL-INVENTORY-RECOVERY-01` | P0 — Data Ops, supported by Backend | Validate credentials/terms/quota; deploy schema/provider changes; quarantine mock-derived deals; run and monitor the real pipeline until the floor is sustained. | Seven-run evidence satisfies G2; run-level failure report attached; zero sample/mock boundary violations. Handoff to readiness gate. |
| 6 | `DEV-PREMIUM-INVENTORY-READINESS-GATE-01` | P0 — Backend / Billing | Add server-side checkout readiness and operational kill switches based on verified inventory health; expose safe health metrics. | Checkout cannot start below G2 or when manually paused; authorized enable restores both plans; alert/email kill switch works independently. Handoff to billing QA. |
| 7 | `DEV-PREMIUM-ALERT-DELIVERY-HARDENING-01` | P0 — Backend / Lifecycle | Enforce mock/stale exclusions in each sender, instrument digest/instant outcomes, and make copy conditional/honest. | Controlled canary satisfies G5; no-match is distinct from failure; direct mock send is rejected. Handoff to TEST. |
| 8 | `TEST-PREMIUM-VALUE-DIFFERENTIAL-01` | P0 — QA/SDET | Adversarial end-to-end verification of feed, paywall, filters, detail, account, billing lifecycle, alerts, affiliate links, mobile, and failure states. | G1–G7 evidence matrix passes on the release SHA. Any failure creates a RETRY ticket for its responsible stage; QA does not waive supply failures. |
| 9 | `OPS-PREMIUM-GO-LIVE-01` | P0 — Product Owner + Release + Finance | Review evidence, enable checkout, observe first paid/trial cohort, and own rollback. | Written go decision names approvers; first 24-hour telemetry is healthy; rollback drill completed; sample boundary remains zero. |

## Exact acceptance checks

### 1. Public and Premium API boundary

Run against the release candidate and production. Authentication material stays in the secret store and must not be pasted into tickets.

```bash
curl -fsS https://expaify.com/api/deals > /tmp/free-deals.json
curl -fsS -H "Cookie: <premium-session-cookie>" https://expaify.com/api/deals > /tmp/premium-deals.json

jq -e '[.deals[] | select(.isMock == true or (.id | startswith("mock-")))] | length == 0' /tmp/premium-deals.json
jq -e '.premium == true' /tmp/premium-deals.json
jq -e '[.deals[] | select(.locked == true)] | length == 0' /tmp/premium-deals.json
jq -e '[.deals[] | select(.dealPriceCents <= 0 or .medianPriceCents <= 0)] | length == 0' /tmp/premium-deals.json
```

With qualifying inventory present, the Premium count must be at least 10 and at least 7 greater than the free unlocked count. With qualifying inventory intentionally absent in a staging database, both API and server-rendered member feed must show zero deals plus the explicit verified-empty state; no `mock-*` ID or sample hotel may appear. With the database intentionally unavailable, the API must return the documented non-200 failure rather than examples or verified-empty.

### 2. Production inventory SQL

Run read-only against production after each scheduled pipeline execution. The qualifying predicate must be shared with the readiness gate rather than copied into divergent application logic.

```sql
SELECT
  COUNT(*)::INT AS qualifying_deals,
  COUNT(DISTINCT d.market_id)::INT AS covered_markets,
  MIN(d.updated_at) AS oldest_update,
  MIN(d.snapshot_count)::INT AS minimum_history
FROM deals d
WHERE d.status = 'active'
  AND d.is_mock = false
  AND d.check_in_date >= CURRENT_DATE
  AND (d.expires_at IS NULL OR d.expires_at > NOW())
  AND d.updated_at >= NOW() - INTERVAL '30 hours'
  AND d.deal_price_cents > 0
  AND d.median_price_cents > 0
  AND d.discount_pct >= 30
  AND d.snapshot_count >= 3
  AND d.ota_links <> '{}'::jsonb;

SELECT COUNT(*)::INT AS production_mock_leaks
FROM deals
WHERE status = 'active' AND is_mock = true;

SELECT
  m.iata,
  COUNT(ps.id) FILTER (WHERE ps.is_mock = false)::INT AS real_snapshots_60d,
  MAX(ps.captured_at) FILTER (WHERE ps.is_mock = false) AS last_real_snapshot,
  COUNT(ps.id) FILTER (WHERE ps.is_mock = true)::INT AS mock_snapshots_60d
FROM tracked_markets m
LEFT JOIN price_snapshots ps
  ON ps.market_id = m.id
 AND ps.captured_at >= NOW() - INTERVAL '60 days'
WHERE m.active = true
GROUP BY m.id, m.iata
ORDER BY m.iata;
```

After the provenance migration, add a gate query proving every qualifying deal's supporting snapshots have a non-null approved provider, run ID, observed time, compatible price basis/nights/currency, and no mock rows.

### 3. Pipeline run

```bash
curl -fsS --max-time 310 \
  -X POST https://expaify.com/api/pipeline/run \
  -H "Authorization: Bearer ${PIPELINE_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{}' > /tmp/premium-pipeline-run.json

jq -e '.ok == true and .rateLimited == false' /tmp/premium-pipeline-run.json
jq -e '[.results[] | select(type == "object" and has("error"))] | length == 0' /tmp/premium-pipeline-run.json
```

`totalNewDeals` is not by itself a pass: unchanged valid deals may make it zero. The inventory SQL, run coverage, freshness, provider errors, and seven-run history decide readiness.

### 4. Billing gate

- While paused, anonymous and signed-in direct calls to both checkout handlers cannot create a Stripe session; the signed-in API response is the documented unavailable response.
- Below the G2 threshold in staging, checkout remains unavailable even if a client forges an enabled UI state.
- Above the threshold and with authorized manual enablement, monthly and annual Stripe test sessions use the correct price and seven-day trial.
- A signed webhook moves the test user through `trialing` and `active`; invalid signature changes nothing; payment failure/cancel removes new Premium entitlement as specified; portal returns to the canonical account URL.

### 5. Free/Premium differential and data-leak test

- Request newest, price, and discount sorts; every filter; offsets beyond page one; and every deal detail ID as anonymous, free, and Premium.
- Free cannot reveal more than the documented weekly set through any query permutation. Premium can reveal every qualifying real row.
- Price, hotel ID/name, photo, history, headline/description, and outbound links are absent from locked payloads and HTML.
- Watchlist and alert mutation APIs reject free sessions and accept Premium sessions.

### 6. Alert canary

- Insert a controlled, explicitly non-production provider fixture in staging, run detection, and prove instant and digest rendering/delivery to the canary inbox.
- In production, select one naturally qualifying real deal and a company-owned Premium canary account; do not insert fabricated production inventory.
- Compare API, database, detail page, email, and outbound link values field for field. Record Resend ID and delivery timestamp without recording the session cookie or unsubscribe token.
- Repeat with a mock ID, expired ID, and stale ID; all three must be suppressed and counted by reason.

### 7. Build and UX regression

```bash
npx tsc --noEmit --incremental false
npm test -- --passWithNoTests
```

QA then verifies 375px and 1280px for public examples (if retained), free real feed, Premium real feed, verified-empty, unavailable, billing-paused, checkout, account, and deal detail; keyboard order, focus visibility, status announcements, and locked-data redaction must pass.

## Required deploy and data operations

1. **Freeze billing before code changes.** Disable entry to new production checkout at the server boundary and pause/extend/refund affected Stripe trials as approved. Record who acted, when, and the customer impact.
2. **Restore the missing addendum.** Add `ORCH_START_HERE.md` or attach its Launch Blocker Addendum to the rescue epic; Product reconciles any differing gate before implementation begins.
3. **Confirm provider legality and configuration.** Data/Legal/Security confirm the selected hotel provider's production terms, quota, credential name, and permitted price/deeplink use. Do not bless the current RapidAPI exception implicitly.
4. **Deploy schema changes through a reviewed migration.** Add provenance and run-health fields without editing production manually from an agent worktree. Backfill only facts that can be proven; unknown provenance stays unknown and is ineligible for readiness.
5. **Quarantine, do not relabel, mock data.** Stop production mock seeding/generation. Mark active `is_mock:true` deal rows expired after a read-only count and backup. Do not flip mock rows to false. Existing mock snapshots may be retained for test analysis but must be excluded from production detection and readiness.
6. **Configure affiliate IDs.** Supply the approved marker for every enabled marketplace in the production secret store and deployment mapping. Disable any marketplace whose marker or terms are not ready.
7. **Run real snapshots and detection.** Trigger the pipeline with the secret held in the deployment platform, inspect every market result, then run the readiness SQL. Repeat for seven scheduled runs; manual runs do not erase a failed scheduled run.
8. **Verify email and Stripe operations.** Confirm Resend domain/sender, digest schedule, webhook endpoint/events, both Stripe prices, portal, canonical auth URL, and operational kill switches in production.
9. **Deploy in two phases.** First deploy sample exclusion, honest empty states, provenance, and checkout-off behavior. Only after G1–G7 evidence passes should Release enable checkout without changing the application image.
10. **Observe and rollback.** For the first 24 hours, Product/Ops reviews feed health, checkouts, webhook transitions, alerts, unsubscribes, provider errors, and support contacts. Any sample leak, price-basis mismatch, unmarked outbound link, or readiness-floor breach closes checkout immediately; it does not restore examples.

## Out-of-scope findings that remain blockers

- The required Launch Blocker Addendum is missing from this worktree.
- The direct RapidAPI implementation and `RAPIDAPI_KEY` conflict with the external-provider and secret contracts supplied with this ticket. Product/Security must resolve the provider choice before implementation.
- Affiliate environment names used by the deal-link builder are absent from the deployment workflow, except for the Travelpayouts marker used by one link path.
- Marketing disagrees on 19 versus 20 destinations.
- “Three deals per week” is a deterministic global unlocked set, not recorded per-user weekly consumption; acceptance and copy must choose one truthful contract.
- The provider-derived hotel feed and the separate flight/hotel search/snapshot paths are not one proven Premium data product. Flight search must not be used to declare this hotel-deal launch ready.

These findings are within the go/no-go boundary but their production fixes belong to the proposed implementation and operations tickets. This planning ticket changes no application code or production state.
