# UX Discovery: Paid MVP production readiness gate

**Ticket:** UXD-PREMIUM-LAUNCH-READINESS-01  
**Stage:** UXD  
**Priority:** P0  
**Date:** 2026-07-22  
**Feature slug:** `premium-launch-readiness`

## Decision now: NO-GO

The repository does not yet contain enough production evidence to authorize a paid launch. `ORCH_START_HERE.md`, including the named Launch Blocker Addendum, is absent from this worktree and from `HEAD`; no mobile or desktop launch screenshots are checked in; Stripe webhook and billing-portal routes have no focused tests; and the deploy workflow deploys without an explicit TypeScript, test, or post-deploy gate. Most importantly, when there are no real active deals, `/deals` and direct `GET /api/deals` substitute three mock deals. The UI labels these as examples, but the API returns them in the normal `deals` collection with `locked: false`, including prices, to free and premium callers.

This is a discovery decision, not a claim that production currently fails every check below. Launch changes from **NO-GO** to **GO** only when one production revision passes every hard check in this document and the evidence packet is attached to the release record. Missing, stale, mocked, or unverifiable evidence counts as a failure.

## One-sentence user pain point

A traveler can be asked to pay for Premium before expaify has proved—on the same production revision—that the paid entitlement unlocks real bookable inventory and useful alerts while free and direct-API users remain correctly limited, so a payment can produce no trustworthy incremental value.

## Who is affected and where

- **Free or signed-out travelers**, on `/deals`, deal detail, and direct deal API access: they need exactly the promised three weekly real-deal unlocks without query manipulation exposing the paid feed.
- **Trialing and active Premium travelers**, from checkout through `/account`, `/deals`, deal detail, watchlist management, and email: they need the entitlement to arrive promptly and unlock real, current, bookable inventory plus working alert value.
- **Canceled, past-due, and payment-failed travelers**, on `/account` and every premium API: they need account copy and access to agree with Stripe's effective access state.
- **Operators approving the release**, at CI/deploy and production verification: they need reproducible counts, screenshots, delivery records, and Stripe event evidence tied to one commit and deployment revision.

## Signals that the problem exists

1. `app/api/deals/route.ts` calls `generateMockDeals(3)` when the real query is empty and returns those rows as ordinary unlocked API deals. `app/deals/page.tsx` does the same for the server-rendered feed. The mock cards are visibly disclosed and non-bookable in `DealFeed.tsx`, but the transport contract still mixes sample and sellable inventory.
2. The free unlock query in `lib/paywall.ts` is deterministic and capped at three real active rows, and list/detail masking exists, but `app/api/deals/__tests__/route.test.ts` covers only premium sorting and free sort coercion. It does not prove the full direct-access matrix: pagination, filters, stable weekly IDs, detail lookup, or empty-real-inventory fallback.
3. Checkout has focused unit coverage, but `app/api/stripe/webhook/route.ts` and `app/api/stripe/portal/route.ts` have no route tests. Therefore payment-to-entitlement propagation, webhook replay, cancellation/payment-failure state, and customer ownership are not release evidence.
4. Watchlist and alert-setting APIs enforce authentication and Premium and have focused tests. Email unit tests verify eligibility, watchlist, threshold, duplicate, and daily-cap SQL. There is no production proof that a saved preference results in a delivered, correctly linked email containing only a current non-mock deal.
5. `.github/workflows/deploy.yml` builds and deploys an image on every push to `main`, but does not explicitly run `npx tsc --noEmit --incremental false`, `npm test -- --passWithNoTests`, a production smoke test, or a screenshot gate before/after deployment.
6. No 375px or 1280px production screenshot evidence exists in the repository. Source-level responsive classes are not proof that checkout, account states, paywalls, and deal value remain usable at launch.

## Binary decision rule

- **GO** requires every checkbox in sections G0–G8 to be checked against the same production revision, with zero P0/P1 defects and no unexplained count mismatch.
- **NO-GO** is automatic if any checkbox fails, is skipped, uses mock-only evidence, points to a different commit/revision, or cannot be reproduced.
- Record commit SHA, Azure revision/image digest, UTC test window, tester, production base URL, and redacted test-account IDs at the top of the evidence packet. Screenshots and API captures must be no more than 24 hours older than approval; inventory counts must be captured within the same 15-minute window.
- Unit tests are necessary but do not replace the production checks. Stripe must use test-mode end-to-end evidence in the production-shaped environment, or a separately approved live-mode $1-equivalent transaction and refund. Never place secret keys or full email tokens in evidence.

## Hard go/no-go checklist

### G0 — Release identity and automated checks

- [ ] The evidence packet names one commit SHA, container image digest, and running Azure revision; `/`, `/deals`, `/account`, and `/api/deals` all resolve to that revision.
- [ ] On that exact SHA, `npx tsc --noEmit --incremental false` exits `0` and `npm test -- --passWithNoTests` exits `0`; attach complete command summaries and test counts.
- [ ] A production-mode `npm run build` exits `0` with the release environment contract present.
- [ ] Deployment cannot proceed unless the three commands above pass. A failed deploy or smoke check leaves the last healthy revision serving traffic.
- [ ] `ORCH_START_HERE.md` and its Launch Blocker Addendum are restored or supplied, every addendum item is mapped to a G-check here, and no addendum requirement remains unresolved.

**Fail = NO-GO:** unknown revision, any nonzero command, deploy job bypass, missing addendum, or no rollback target.

### G1 — Inventory truth and count reconciliation

Capture these values from production inside one 15-minute window:

```text
DB_ACTIVE_REAL = active, unexpired, future-stay deals with is_mock=false
DB_ACTIVE_MOCK = active, unexpired, future-stay deals with is_mock=true
API_REAL       = unique rows returned across premium /api/deals pagination with isMock=false
API_MOCK       = unique rows returned across premium /api/deals pagination with isMock=true
API_BOOKABLE   = API_REAL rows with at least one valid affiliate-marked https OTA URL
MARKETS_FRESH  = tracked markets successfully scanned in the last 24 hours
```

- [ ] `MARKETS_FRESH = 20/20`; provider/pipeline output identifies no silent market failure.
- [ ] `DB_ACTIVE_REAL >= 3`. This is the minimum needed to honor the public free-plan promise of three unlocked real deals; fewer than three blocks paid launch even if the empty state is honest.
- [ ] `DB_ACTIVE_MOCK` is reported, not inferred. Mock rows do not count toward any availability, deal, market, or alert claim.
- [ ] `API_REAL = DB_ACTIVE_REAL` after applying the documented public eligibility rules, or every excluded row is listed with one explicit reason. Pagination returns every eligible ID once—no duplicates or omissions.
- [ ] `API_MOCK = 0` for production `/api/deals`, for free and Premium. If examples remain in the UI, they come from a separately labeled sample contract, are non-bookable, are excluded from counts, and never appear as an unlocked paid benefit.
- [ ] `API_BOOKABLE = API_REAL`; every visible real deal has a valid outbound URL with the required affiliate marker. Opening one deal per OTA/provider reaches the named property/date context without an app 4xx/5xx.
- [ ] Account, feed, and email count claims use real rows only and agree with the captured API/DB counts. No surface says “live” for a sample or stale row.

**Fail = NO-GO:** fewer than three eligible real deals, any mock in the production deal API, stale/expired inventory, unexplained count drift, or any customer-visible real deal without a valid affiliate handoff.

### G2 — Free-user entitlement, including direct API access

Run the matrix once signed out and once with a signed-in `free` subscription:

- [ ] `/deals` shows the same deterministic set of at most three unlocked **real** deal IDs for the current UTC week; all other real cards are visibly locked. Refresh, sign-out/sign-in, and a second browser preserve the set.
- [ ] If `DB_ACTIVE_REAL >= 3`, exactly three IDs are unlocked. If the real count later drops below three, only those real rows may unlock; samples never fill the allowance.
- [ ] Direct `GET /api/deals` returns `premium:false`; unlocked rows expose integer-cent prices and affiliate links, while every locked row redacts hotel identity, price, median, image, headline, and OTA links.
- [ ] Repeat direct API calls with `limit=1`, `limit=100`, every valid `offset`, `sort=price`, `sort=discount`, city, market, price, stars, discount, and date filters. The union of exposed real IDs never exceeds the same three weekly IDs; free filters/sorts do not rotate new values into view.
- [ ] Direct `GET /api/deals/{lockedId}` returns a locked response with no price history or sensitive fields. `GET /api/deals/{unlockedId}` exposes only an ID already in the weekly set. Invalid and unknown IDs return controlled 400/404 responses.
- [ ] Free requests to Premium-only mutation/API surfaces—watchlist, alert preferences, and natural-language search—return 401 when signed out and 403 when signed in free; no database state changes.
- [ ] The visible upgrade message accurately names the three-real-deal weekly limit and does not imply that example inventory is live or bookable.

**Fail = NO-GO:** a fourth real price can be obtained, locked details leak through any query shape, samples consume/expand the allowance, or UI and API entitlement disagree.

### G3 — Premium-user entitlement

Run separately for `trialing` and `active` subscriptions:

- [ ] `/account` shows the correct plan, effective status, trial/renewal date, and manage-billing action for that Stripe customer.
- [ ] `/deals` and direct `/api/deals` return `premium:true`; all eligible real rows are unlocked with integer-cent price/median and valid OTA links. No mock is presented as Premium inventory.
- [ ] Premium filters, date range, sort, pagination, natural-language search, deal detail/history, watchlist, and alert preferences work from both UI and direct API without falling back to the free contract.
- [ ] A Premium user can add/remove a valid tracked city, hit the 10-city cap honestly, change instant/daily/off and threshold, reload `/account`, and see the persisted state.
- [ ] Two authenticated test users cannot read or mutate each other's subscription, Stripe portal, watchlist, or alert state by changing request bodies, IDs, cookies, or URLs.

**Fail = NO-GO:** payment status says Premium while any paid entitlement remains locked, premium API values differ from UI values, data crosses accounts, or mock inventory supplies paid value.

### G4 — Stripe checkout, webhook, portal, and account state

Use distinct test users and preserve redacted Stripe event IDs plus application-row before/after captures:

- [ ] Signed-out checkout returns to sign-in/join; signed-in free monthly and annual checkout use the configured price IDs, correct displayed amount/cadence, 7-day trial, customer email, and canonical success/cancel URLs. Missing configuration fails closed without a charge.
- [ ] Completing checkout creates/reuses exactly one Stripe customer and subscription. A valid signed webhook moves the matching application user to `trialing` within 60 seconds; account and deal API reflect Premium only after server-side state changes, not merely from `?checkout=success`.
- [ ] Replaying each webhook event at least twice is idempotent: no duplicate subscription, customer, delivery, or entitlement change. Invalid/missing signatures return 400 and change no state.
- [ ] `customer.subscription.updated` transitions trialing → active and updates plan/trial/period dates. Plan changes update both Stripe and account copy without creating a second entitlement.
- [ ] Cancel-at-period-end retains Premium until the effective end and states the exact end date; final deletion revokes it. `past_due`, `unpaid`, `incomplete_expired`, and `invoice.payment_failed` produce the approved access state and matching non-misleading account copy.
- [ ] Billing portal opens only for the authenticated user's Stripe customer, returns to `/account`, and a user with no billing record gets a controlled, actionable error.
- [ ] After every state transition, `/account`, `/api/deals`, watchlist/alerts APIs, and email eligibility all agree on Premium vs free access within 60 seconds.

**Fail = NO-GO:** successful charge without entitlement, entitlement without verified Stripe state, cross-customer portal access, replay side effects, state disagreement, or misleading renewal/access copy.

### G5 — Account, email, and watchlist value

- [ ] Magic-link sign-in email is delivered to a fresh address; its link authenticates once, returns to the intended same-origin surface, and no token/secret appears in logs or screenshots. Welcome email sends once for the new user.
- [ ] For a Premium test user watching one city, seed/select one current non-mock deal in that city above the saved threshold. Instant mode delivers one email within the pipeline test window; the subject/body show the same property, city, integer-cent-derived price, comparison, dates, and Deal Score evidence as the live detail page.
- [ ] The email deal link opens the same unlocked, current real deal; manage-preferences, stop-city/switch-daily where present, and one-click unsubscribe links work. Affiliate booking links remain attributed.
- [ ] The same deal is not delivered twice. Instant delivery respects the 3/day cap. Daily mode sends at most one digest in the user's 9am timezone window, contains at most eight eligible non-mock deals, and records deliveries only after successful sends.
- [ ] A watched-out city, deal below threshold, expired/past-stay deal, mock deal, duplicate deal, `off` preference, free user, and canceled/non-entitled user each produce zero email.
- [ ] Remove the watched city and verify later matching inventory produces no email; add it again and verify eligibility returns. Reloaded account state matches delivery behavior.
- [ ] Record provider acceptance/delivery ID, delivery timestamp, application delivery row, and final destination for every positive email check. A workflow response of `recipients: 0` alone is not proof of value.

**Fail = NO-GO:** no delivered alert tied to a real deal, any mock/stale/ineligible email, duplicates above policy, broken management/unsubscribe, or saved preferences disagree with delivery.

### G6 — Required 375px and 1280px screenshot packet

Capture PNGs from the same production revision at **375 × 812** and **1280 × 800**, with browser zoom 100%, no extensions, and seeded deterministic test accounts. Use the exact filenames below:

- [ ] `01-free-deals-375.png` and `01-free-deals-1280.png` — three real unlocked rows plus at least one locked row and the real result count.
- [ ] `02-free-locked-detail-375.png` and `02-free-locked-detail-1280.png` — no property/price/history/link leak; upgrade path visible.
- [ ] `03-premium-deals-375.png` and `03-premium-deals-1280.png` — real unlocked inventory, Premium filters/sort, and no sample-as-live ambiguity.
- [ ] `04-premium-detail-375.png` and `04-premium-detail-1280.png` — property, date, price comparison/Deal Score evidence, and booking handoff.
- [ ] `05-account-free-375.png` and `05-account-free-1280.png` — free status, accurate real inventory claim, and upgrade action.
- [ ] `06-account-trialing-375.png` and `06-account-trialing-1280.png` — trial days/end date, charge cadence, portal, watchlist, and alert settings.
- [ ] `07-account-active-375.png` and `07-account-active-1280.png` — active plan/renewal state, persisted watchlist/alert settings, portal.
- [ ] `08-account-canceled-375.png` and `08-account-canceled-1280.png` — effective access/end date and renewal recovery, with access matching G4.
- [ ] `09-stripe-checkout-375.png` and `09-stripe-checkout-1280.png` — expaify identity, correct plan amount/cadence and 7-day trial; redact personal/payment data only.
- [ ] `10-alert-email-375.png` and `10-alert-email-1280.png` — delivered real-deal alert, legible value, management and unsubscribe actions.

For every image: no horizontal scrolling, overlap, clipped controls/copy, hidden primary action, false live claim, or unreadable focus/error state. At 375px all interactive targets are reachable and at least 44px on the critical path; at 1280px the primary value and action remain in a coherent scan order. The packet also includes one keyboard-focus capture and one controlled error capture per viewport for checkout or account persistence.

**Fail = NO-GO:** any required state is simulated with mock inventory, any screenshot comes from another revision, or any critical content/action is clipped, overlapping, falsely labeled, or inaccessible.

### G7 — Production route and failure smoke checks

- [ ] Signed-out, free, trialing, active, and canceled matrices return no unhandled 5xx across `/`, `/join`, `/login`, `/deals`, `/deals/{id}`, `/account`, `/api/deals`, checkout, portal, watchlist, and alerts.
- [ ] Database, provider, Resend, and Stripe failures are exercised one at a time in the production-shaped staging/revision: the UI states what remains available, does not substitute mock inventory as live value, does not claim a send/charge/save that did not occur, and offers a safe retry/recovery.
- [ ] Auth callback and Stripe redirects remain on the canonical expaify origin; open redirects and altered customer/user IDs are rejected.
- [ ] Logs for the test window contain no secrets, magic-link/unsubscribe tokens, raw Stripe signatures, card data, or avoidable customer PII.

**Fail = NO-GO:** unhandled critical-path 5xx, false success, silent fallback to samples, unsafe redirect, or sensitive-log exposure.

### G8 — Final approval record

- [ ] Product/UX signs that the free promise, Premium promise, inventory labels, account states, and email value seen in evidence match launch copy.
- [ ] Engineering signs the revision/count/API/Stripe evidence; QA signs the full matrix and screenshot packet; operations signs rollback, provider freshness, scheduled pipeline, digest workflow, and alert monitoring.
- [ ] Every defect found has severity and disposition. Any P0/P1 remains **NO-GO**; P2/P3 waivers name an owner and deadline and do not affect payment, entitlement, inventory truth, booking attribution, account security, accessibility of the critical path, or email consent.
- [ ] Approval includes the UTC timestamp and explicit word **GO**. Silence, a green unit-test run alone, or “looks good” is not approval.

## Constraints downstream work must respect

1. **Inventory and money truth:** production counts and customer claims exclude mocks; only current non-mock rows can provide paid value; prices remain integer minor units with currency and outbound links retain affiliate markers.
2. **Server-side entitlement and account integrity:** UI hiding is never the security boundary. List, detail, sort/filter/search, watchlist, alerts, Stripe portal, and email eligibility must derive from authenticated server-side subscription state and remain isolated per user.
3. **Evidence without new scope:** this is a launch repair gate, not authorization for new features. Preserve current contracts, verify both 375px and 1280px, protect secrets/PII, and fix only defects that block the existing free/Premium promises.

## Success statement

This is solved when a first-time traveler can remain free and receive exactly the promised weekly real-deal access, or complete Premium checkout and—within 60 seconds—see all current real deals, persist a watchlist, and receive one matching non-mock alert, without direct API access bypassing entitlement, Stripe/account states disagreeing, mock inventory being sold as value, or the flow breaking at 375px or 1280px.

## Required UXR handoff

UXR must obtain the missing Launch Blocker Addendum, map it to G0–G8, audit the production-observable implementation and test gaps, and convert this gate into a release evidence plan. It must not soften any missing evidence into a pass or propose net-new paid features.
