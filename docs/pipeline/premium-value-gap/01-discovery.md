# UXD-PREMIUM-VALUE-GAP-01 — Premium value gap and paid member promise

**Stage:** UX Discovery  
**Priority:** P0  
**Date:** 2026-07-22  
**Launch recommendation:** **NO-GO for paid MVP launch**

## Discovery input note

The assigned worktree does not contain `ORCH_START_HERE.md`, so its Launch Blocker Addendum could not be read without leaving the assigned worktree and accessing the prohibited main repo. This report therefore treats the missing addendum as a blocker and bases its findings on the current in-worktree implementation plus a direct production check of `https://expaify.com/api/deals` on 2026-07-22.

## User pain point — one sentence

A new Premium member can pay, choose destinations and alert preferences, then receive the same three non-bookable example cards as a free visitor—with no personalized feed or eligible alerts—so expaify does not yet deliver a material, verifiable benefit for the membership charge.

## Who is affected and where

The primary affected user is a first-time trialing or paid cash-deal member moving through the launch-critical path:

1. Evaluates the Premium promise on `/join` or a locked deal.
2. Starts a trial or subscription.
3. Chooses destinations, minimum discount, and alert cadence in onboarding.
4. Lands on `/deals` expecting a larger, personalized, actionable feed.
5. Opens a deal or waits for an alert before deciding whether Premium is worth keeping.

The trust break occurs immediately after conversion and persists in both `/deals` and `/account`: the member can configure Premium controls, but the current production inventory cannot make those controls useful, and the main deals page does not apply the preferences saved during onboarding.

## Evidence that the problem exists

### Production behavior observed on 2026-07-22

An unauthenticated `GET https://expaify.com/api/deals` returned HTTP 200 with:

- `premium: false`;
- `total: 3`;
- exactly three deals, all with `isMock: true` and `locked: false`;
- blank `city` values;
- fixed sample hotel names and prices;
- direct OTA URLs without visible affiliate parameters.

The UI correctly labels this as a warming feed: the cards are examples and are not bookable. That honesty prevents the examples from being mistaken for live inventory, but it also establishes that production currently has no paid inventory benefit to unlock.

### Current implementation signals

- Free access is intended to expose three deterministic real deals per week; all other real deal identities and prices are redacted (`lib/paywall.ts`, `app/api/deals/route.ts`).
- Premium is intended to expose the full unredacted real feed plus destination, discount, star, price, date, search, and sort controls (`app/api/deals/route.ts`, `app/deals/DealFeed.tsx`).
- When no real deals exist, both the page and API substitute three mock deals. Premium filtering and sorting are then unavailable because there is no live inventory to operate on (`app/deals/page.tsx`, `app/api/deals/route.ts`, `app/deals/DealFeed.tsx`).
- Onboarding saves the member's watchlist, minimum discount, and alert preference (`app/onboarding/OnboardingClient.tsx`, `app/api/onboarding/route.ts`). However, the main `/deals` page renders `DealFeed` without its `personalization` prop, so saved choices are not reflected or applied there (`app/deals/page.tsx`).
- The account allows Premium members to manage up to ten watched cities, a 30/40/50% threshold, and instant/daily/off cadence (`app/account/page.tsx`, `app/account/AccountClient.tsx`). Alert queries correctly require active, non-mock, unexpired deals, so no alert can be generated from the current production sample feed (`lib/email/sendDealAlert.ts`, `lib/email/sendDailyDigest.ts`).
- The Premium sales page promises email “the moment prices drop below your target,” but the deal-detection workflow runs nightly. “Instant” currently means after a qualifying nightly detection, not continuous price monitoring (`app/join/_form.tsx`, `.github/workflows/snapshot.yml`).
- The post-checkout account banner promises a first alert “usually within 24 hours,” although delivery depends on a new qualifying real deal and therefore may never occur in that window (`app/account/page.tsx`).
- The sales page says Premium covers 19 destinations, while the deals metadata and feed copy say 20 (`app/join/_form.tsx`, `app/deals/page.tsx`, `app/deals/DealFeed.tsx`).

## Current journeys

### Free user journey

1. A visitor opens `/deals`.
2. If real inventory exists, the visitor receives the newest feed but can see complete information for only the same three weekly deal IDs; remaining cards are redacted.
3. Destination/date/price/star/discount filtering, natural-language deal search, and value/price sorting are unavailable, and the API ignores those parameters server-side.
4. Locked cards and controls point to `/join`.
5. If real inventory does not exist, the visitor sees three clearly labeled example cards. They are fully visible but non-bookable, and there is no live Premium advantage to preview.

### Premium user journey today

1. The user starts a seven-day trial at $8/month billed annually or $12 monthly after trial.
2. Onboarding collects destinations, minimum deal size, and alert cadence.
3. `/deals` unlocks all real deal fields and Premium controls when live data exists, but does not apply or echo the saved onboarding preferences on the main feed.
4. A supported live deal can be opened, a tracked city can be watched, and outbound booking options can be used.
5. `/account` exposes alert and watchlist settings.
6. Instant alerts run only after nightly deal detection, and daily digests run hourly to serve the member's 9 a.m. local window; both require qualifying real inventory.
7. In the current production cold state, the Premium user instead sees the same three example cards as a free visitor. Sorting is unavailable, filters cannot produce meaningful live results, cards cannot be opened or booked, and mock deals cannot trigger alerts.

## What Premium must unlock beyond sample cards

Premium value for MVP is not “more controls.” It is a working service composed of all four outcomes below:

1. **More verified opportunity:** the complete eligible set of current, real cash hotel deals, with unredacted identity, integer-minor-unit price, normal-price comparison, freshness, and sufficient history to support the savings claim.
2. **Applied relevance:** the destinations and threshold chosen during onboarding visibly constrain or prioritize the member's feed, with a clear path to view all tracked deals.
3. **Faster discovery:** Premium-only filters, search, and sorting operate on real inventory and produce a visibly different, server-enforced result set.
4. **Proactive delivery:** watchlist and cadence settings cause a qualifying real deal to reach the member according to an honest, testable delivery promise; the account shows what is being watched and what will happen next.

Samples may explain the future format before launch or while data warms, but samples do not count as unlocked inventory, alert coverage, or paid value.

## Required empty and data-warming states

Downstream design must distinguish these states; none may silently fall back to a normal-looking paid feed:

1. **No usable production inventory / system warming:** State that examples are not current or bookable, name the affected coverage, explain that alerts cannot fire from examples, and give the next verified data refresh time or an honest “not yet available.” Do not promise an alert within 24 hours.
2. **History too thin to verify a deal:** Show that expaify is still learning the normal price and suppress the deal/savings claim until the configured evidence threshold is met. Do not present a mock snapshot count as proof.
3. **Healthy coverage, no current deals anywhere:** Confirm that the latest completed check found no qualifying drops, show when checking last completed and when it runs next, and keep monitoring without replacing the result with samples.
4. **Healthy coverage, no matches for member preferences:** Echo watched destinations and threshold, confirm that monitoring remains active, and offer “edit preferences” and “show all live deals.” This must not be confused with a provider failure.
5. **Partial market coverage or provider/pipeline failure:** Identify which requested coverage is unavailable, preserve any verified results, show their freshness, and avoid claiming that zero results means zero deals.
6. **Alerts active but nothing delivered yet:** Show the saved destinations, threshold, cadence, last completed check, and the condition required for the first email. “No email yet” must not look like a broken subscription.
7. **Alert delivery or preference-save failure:** Preserve the last confirmed setting, identify the failed change, and provide retry. Never claim that monitoring is active for an unconfirmed preference.

## No-go launch criteria

Paid launch must not proceed if any criterion below is true:

- Production's default Premium path contains only mock/sample deals or cannot expose at least one actionable real deal within the supported launch coverage.
- A Premium session can complete checkout but receives no material difference from the free journey: no additional real deal, no applied personalization, and no alertable coverage.
- Saved onboarding destinations or threshold are ignored by the main deals experience, or the feed claims personalization that the server did not apply.
- A Premium benefit is advertised as “instant,” “the moment,” or “within 24 hours” without an operational SLA and production evidence that the pipeline meets it.
- A sample, stale response, provider failure, thin baseline, or true zero-match result can be mistaken for a current verified deal set.
- A member cannot tell from `/account` what expaify is monitoring, when it last checked, or why no alert has arrived.
- Paid outbound booking links lack required affiliate markers or lead from example data presented as actionable.
- Pricing, destination count, inventory scope, or alert cadence differs between `/join`, onboarding, `/deals`, deal detail, email, and `/account`.
- The paid end-to-end journey fails at 375px, keyboard-only use, or screen-reader status/focus handling.

## Constraints the solution must respect

1. **Data and money integrity:** Only real provider data routed through `lib/providers` may create actionable deals; money remains `{ priceCents: number; currency: string }`; thin, stale, partial, failed, and sample data must never support a stronger savings or availability claim than the evidence allows; outbound links require affiliate markers.
2. **Honest paid differentiation:** Free remains three stable weekly real unlocks, while Premium must add complete real coverage, applied relevance, and proactive delivery. Mock cards, disabled controls, or future promises cannot be counted as Premium value, and award travel is not introduced for this cash-first MVP.
3. **Usable and observable service:** The journey must remain usable at 375px and desktop with keyboard and assistive technology, avoid decorative clutter, and expose enough product/operational telemetry to verify inventory freshness, preference application, and alert delivery without adding provider calls from components.

## Measurable acceptance criteria

### Task-level acceptance

A launch-candidate Premium account must pass one scripted end-to-end journey in production:

1. Start the trial, select two supported destinations, choose a discount threshold and cadence, and reach `/deals` without losing those choices.
2. See the selected coverage and threshold reflected in the feed; “show all deals” must clearly switch out of the personalized view.
3. See at least one real, unredacted, actionable deal beyond what the same free-session weekly unlock set exposes. Every actionable item has a non-empty destination, current integer price/currency, normal-price evidence, freshness, and an affiliate-marked booking handoff.
4. Apply one Premium-only filter and one Premium-only sort; the API and visible result set must honor both, and returning to a free session must keep those parameters server-enforced as unavailable.
5. Open a real deal and understand in one scan what it costs, what “normal” means, how fresh the observation is, and whether evidence is sufficient.
6. Cause a qualifying real test deal to enter the detection pipeline. The matching Premium member receives exactly one alert, using the saved destinations/threshold/cadence, within the published SLA. If the current nightly cadence remains, user-facing copy must describe that cadence rather than “the moment.”
7. Repeat with no qualifying result and with a simulated provider failure; the member sees the correct distinct state and retains working preference-management and retry paths.

### Quantitative launch gates

- **100%** of production Premium deal responses contain `premium: true` for an active/trialing test account and never redact eligible deal fields.
- **0** mock deals are counted in Premium inventory totals, used for alert delivery, or presented as bookable.
- **100%** of saved onboarding/watchlist/threshold choices are reflected after reload and applied to the next personalized feed request.
- **100%** of tested Premium filter/sort combinations are enforced server-side and match the visible result ordering/count.
- **100%** of actionable outbound links in the launch test contain the required affiliate marker and preserve the deal's destination/date context.
- **100%** of test alerts are deduplicated and match the saved destination, threshold, and cadence; delivery latency is measured from completed deal detection and meets the published SLA.
- **0** launch-path strings promise a destination count, delivery time, inventory source, or price-history capability that differs from production behavior.
- In moderated first-use validation, **at least 4 of 5** first-time Premium users can identify a concrete benefit they received beyond the free plan within 60 seconds of landing on `/deals`, without treating an example card as a live deal.

## Success statement

This is solved when a first-time Premium user can choose what to watch, immediately see additional verified and actionable deals relevant to those choices, and receive a qualifying alert on the stated cadence without encountering sample data presented as paid value or wondering whether monitoring is working.

## Scope boundary for downstream stages

The single problem to solve is the missing material paid-member outcome across onboarding → personalized live feed → proactive alert. Visual polish, award travel, additional providers, new destination coverage, and unrelated search/booking repairs are out of scope unless they are strictly required to make that existing paid promise truthful and operational.

