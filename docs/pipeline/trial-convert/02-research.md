# UX Research: Trial-to-Paid Conversion Funnel

**Ticket:** UXR-TRIAL-CONVERT-01 · **Stage:** UXR · **Date:** 2026-07-19
**Author:** UX Research (Claude Fable 5)
**Upstream:** `docs/pipeline/trial-convert/01-discovery.md` (UXD-TRIAL-CONVERT-001)

---

## 1. Scope recap

The trial is card-upfront and auto-converts on day 8. Trial users see everything (`isPremium()` includes `trialing`, `lib/subscription.ts:23-25`), so this is not a paywall problem. Non-conversion = mid-trial cancel, silent payment failure, or post-charge churn. The research question: **where does the product fail to demonstrate value during days 1–7, and what proven trial-conversion patterns close each gap?** Free→trial funnel is out of scope per discovery §8.

## 2. Current implementation audit (verified against source)

### 2.1 The only trial surface: `/account` countdown — loss-framed and priced wrong

`app/account/page.tsx:95-108` renders the sole trial UI in the product: an amber alert box with a large day counter and one sentence:

> "Trial ends **{date}**. You'll be charged ${plan === 'annual' ? '8' : '12'}/mo unless you cancel before then."

Verified problems:

- **Framing is 100% loss-avoidance.** The single sentence of trial messaging in the entire product is a cancellation instruction. Nothing on this page says what the trial has found for the user.
- **The annual price is false.** Line 105 renders "$8/mo" for annual plans, but the actual charge is one $96 payment (`app/join/_form.tsx:102-105`: "/ month, billed $96/year"). A user reading `/account` on day 6 expects an $8 charge and gets $96 — a trust break at the exact conversion moment, and a likely refund/chargeback driver.
- **Amber alert styling** (`border-amber-200 bg-amber-50`) codes the trial itself as a warning state. Color tokens here also bypass the design system (`--primary`, `--accent` etc. in `app/globals.css`) — the only hardcoded Tailwind palette colors on the page.
- The countdown uses `Math.ceil((trialEndsAt - now) / 86400000)` (`app/account/page.tsx:16-18`). Any new trial surface must share this helper or day counts will disagree across surfaces.
- `/account` has no draw: alerts/watchlist settings are the only reason to visit, and the post-checkout success banner (`app/account/page.tsx:52-60`) points users away to email ("Your first deal alert arrives by email — usually within 24 hours").

### 2.2 Daily digest: silence is the structurally likely trial experience

`lib/email/sendDailyDigest.ts`:

- Per-recipient deal query (lines 59-87) requires ALL of: deal `first_seen` within 24h, `discount_pct >= COALESCE(alert_min_discount, 40)`, watchlist match, never previously delivered. If zero rows: `skipped++; continue` (lines 104-107). **No fallback content of any kind.**
- The default threshold is 40 (`DEFAULT_MIN_DISCOUNT`, line 7; onboarding pre-selects 40, `app/onboarding/OnboardingClient.tsx:26`; "use defaults" path hardcodes 40, line 55). The deal feed itself considers 20%+ a deal worth showing (`app/deals/page.tsx:48` fetches `minDiscount: 20`). So the feed's own definition of "deal" is half the email bar — the email will structurally skip on days the feed looks healthy.
- **Send errors and empty results are conflated**: the `catch` block also does `skipped++` (lines 138-141), so `{ recipients, skipped }` can't distinguish "nothing qualified" from "Resend failed." The funnel's one instrument is unreadable.
- Net effect confirmed: a trial user with default settings can receive **zero emails for the full 7 days** after being promised one "within 24 hours."

### 2.3 Welcome email: fires pre-checkout, promises the wrong number

- Sent on `createUser` (`auth.ts:69-73`) — i.e., at first magic-link sign-in, **before** Stripe checkout completes. It cannot honestly state trial terms (the user may never start one), and today it doesn't try: no trial length, no price, no charge date (`lib/email/templates/WelcomeEmail.tsx`).
- It promises: "When a hotel drops **30%+** below its usual price, you'll hear from us" (`WelcomeEmail.tsx:25-28`). The default alert bar is **40%**. The very first email sets an expectation the alert system is configured not to meet.

### 2.4 Trial-ending touchpoint: does not exist

`app/api/stripe/webhook/route.ts:33-87` handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. **`customer.subscription.trial_will_end`** (Stripe fires it 3 days before trial end, purpose-built for this touchpoint) falls into `default: break`. There is no day-5 email, no value recap, no in-app "ending soon" state. Adjacent finding: `invoice.payment_failed` and `past_due` both hard-cancel immediately (lines 74-83, 92-102) with zero user communication — flagged for a DEV ticket in §6.

### 2.5 Browsing surfaces: zero trial awareness

- `LandingNav.tsx:36-60` (the nav on `/deals`): authenticated state shows Deals / avatar / Sign out. No trial status.
- `DealFeed.tsx`, `app/deals/[dealId]/`: zero occurrences of trial/upgrade/days-left strings (grep-verified).
- The data to fix this is already in reach: `/deals` fetches the subscription server-side for the onboarding gate (`app/deals/page.tsx:41-44`), so a trial indicator adds **no new blocking query** — it needs the already-fetched `sub` passed down instead of re-derived.

### 2.6 Value data exists but is never aggregated

Every deal row carries `median_price_cents` and `deal_price_cents` (integer cents, per contract), and `deal_alert_deliveries` records exactly which deals each user was sent. "Your trial surfaced N deals worth $X total below-median savings" is a straightforward aggregate over existing data. Nothing computes it anywhere (grep: no aggregation of savings in `app/` or `lib/`).

## 3. Reference patterns

Compared at interaction-pattern level, not visual style.

### 3.1 Going (formerly Scott's Cheap Flights) — deal-alert trial, the direct analog

Going's premium trial faces the identical structural risk: value arrives via email at unpredictable intervals, so a quiet week reads as "this product does nothing." Their pattern responses:

1. **The product never goes silent during a trial.** If no qualifying deal exists, members still receive "we're watching" touchpoints that show the *work* (routes monitored, prices checked) rather than fabricating deals. Silence is treated as the #1 trial killer.
2. **Value framing is cumulative and concrete**: "members save an average of $550 per ticket" — always derived from real fare-vs-typical-price data, mirrored in trial messaging as "here's what we found for you."
3. **Trial-end communication leads with the recap, then states the price plainly**, with cancel one click away. Loss-framed countdowns are reserved for the final message, and even there they enumerate what will be lost (the found deals), not just the charge.

### 3.2 Value-ledger + trial-ending email — the generic SaaS pattern (Grammarly-style ledger; Stripe-recommended trial-end flow)

1. **Value ledger**: a recurring, personalized "here's what the product did for you" stat (Grammarly's weekly tone/corrections email is the canonical case). The pattern's rules: numbers must be *personal* (your deals, not "our users"), *cumulative* (grows over the trial, giving a reason to stay through day 7), and *placed where the user already is* (in-product banner + email, not a separate dashboard).
2. **Trial-ending email at T-3 days**: industry baseline, which is precisely why Stripe ships `customer.subscription.trial_will_end` at T-3. Canonical contents: exact charge amount and date, value recap, manage/cancel link. Sending it *reduces* refunds and chargebacks and is required posture for card-upfront trials under card-network rules — its absence is both a UX and a compliance-adjacent gap.
3. **Zero-result reassurance**: when a threshold-gated system has nothing to show, the reference pattern is to show the *closest miss* plus the threshold itself ("this 34% drop didn't clear your 40% bar — lower it?"), converting silence into a settings-tuning moment. Never fake urgency or invent results.

## 4. Gap analysis

| Surface | Current code does | Reference pattern does | Delta |
|---|---|---|---|
| Trial status while browsing | Nothing (`LandingNav.tsx`, `DealFeed.tsx`) | Persistent, value-neutral trial chip in nav | Add chip; sub data already fetched server-side on `/deals` |
| Value evidence | Never aggregated anywhere | Cumulative personal ledger, in-product + email | Aggregate `median − deal` cents over deals surfaced/delivered for this user |
| `/account` trial box | Amber warning + cancel instruction + false "$8/mo" | Value recap first, honest price, cancel still one click | Reframe copy, fix annual price to "$96/year", drop alert styling |
| Day 5–6 | Nothing (`trial_will_end` unhandled) | T-3 email: recap + exact charge + cancel link | Handle webhook, new email template, once-per-subscription guard |
| Zero-deal days | Silent skip (`sendDailyDigest.ts:104-107`) | Closest-miss reassurance + threshold nudge | Trial-scoped fallback email; separate skip-vs-error counters |
| First promise | "Alert within 24 hours" + "30%+" | Promise only what the system is configured to do | Align copy with the 40% default or make the promise unconditional-able |

## 5. Design directives (testable)

Money copy rule for all directives: amounts derive from `plan` + real cents; annual is always expressed as one $96 charge ("$96/year"), never bare "$8/mo". Savings derive only from stored `median_price_cents − deal_price_cents` on `is_mock = false` deals. Never state or imply a deal was sent when the digest skipped.

### D1 — Persistent trial chip in the authenticated nav

While `status === 'trialing'`, `LandingNav` (as rendered on `/deals` and deal detail) shows a pill between "Deals" and the avatar: **"Trial · {n} days left"**, linking to `/account`. Neutral styling (design-system tokens, not amber); the chip is informational, not a warning. Day count must use the same shared helper as `/account` (extract `trialDaysLeft` from `app/account/page.tsx:16-18` into `lib/`). No new blocking query: subscription status is passed from the server component (`app/deals/page.tsx` already fetches it) — do not add a client-side subscription fetch to the nav.
**Acceptance:** chip visible at 375px without wrapping the nav to two lines; text readable by screen reader as "Premium trial, {n} days left"; `n` matches `/account` for the same instant; chip absent for `active`, `free`, `canceled`, and signed-out.

### D2 — Trial value ledger, computed once, shown in two places

Define one query (design contract; DEV implements): over real deals matching the user's own alert criteria (`discount_pct >= alert_min_discount`, watchlist filter, `first_seen >=` trial start), compute `dealsCount` and `totalSavingsCents = Σ(median_price_cents − deal_price_cents)`. Surface it:
(a) on `/deals` as a one-line banner above the feed for trialing users — **"Your trial so far: {dealsCount} deals found · {fmt(totalSavingsCents)} below typical prices."**;
(b) on `/account` inside the reframed trial box (D3).
Zero state (dealsCount = 0): **"Nothing has beaten your {alert_min_discount}% alert bar yet — we check ~20 destinations daily. Lower your bar to see more."** with a link to alert settings. Never render "$0 saved".
**Acceptance:** ledger numbers are reproducible from DB rows; mock deals excluded; zero state shows the threshold-nudge copy, not an empty or "$0" banner; banner fits one line at 375px (may wrap to two, no truncation).

### D3 — Reframe the `/account` countdown: value first, honest price, cancel intact

Replace the amber box content, hierarchy: (1) ledger line from D2; (2) schedule line — monthly: **"Your trial ends {date}. After that it's $12/month."** / annual: **"Your trial ends {date}. After that it's one $96 payment for the year."**; (3) tertiary: **"Cancel anytime before then — it takes one click in the billing portal."** (existing `AccountClient` portal button remains the mechanism). Day counter may stay but styled with design-system tokens, not `amber-*`. At ≤3 days left, the schedule line becomes primary (see D4 in-app state).
**Acceptance:** the string "$8/mo" no longer appears anywhere for annual plans; cancel path unchanged (portal reachable in one click from this box); the first sentence of the box states value delivered, not the charge.

### D4 — Trial-ending touchpoint at T-3 (webhook + email + in-app state)

Handle `customer.subscription.trial_will_end` in `app/api/stripe/webhook/route.ts`: send one trial-ending email per subscription (idempotency guard — a sent-marker column or delivery row; the webhook can be redelivered). Email contents, in order: value recap (D2 ledger, including its zero state), exact charge — **"On {date} your card will be charged {$12 for your first month | $96 for your first year}."** — then manage-alerts and cancel links (portal), unsubscribe footer intact. Subject: **"Your trial ends {weekday} — here's what it found"**. In-app: at ≤3 days left the D3 box switches emphasis to the schedule line.
**Acceptance:** webhook case exists and is covered by a test with a mocked Stripe event; exactly one send on repeated delivery of the same event; email states the real charge for both plans; zero-ledger variant renders reassurance copy, never invented deals.

### D5 — No silent trial week: digest fallback + promise alignment

(a) **Trial-scoped fallback email:** if a trialing user has received zero digest/alert emails by day 3 of the trial (no rows in `deal_alert_deliveries`), send one "still watching" email (max one per trial). Contents: the closest-miss real deal below their bar, labeled honestly — **"Closest so far: {hotel}, −{pct}% — under your {alert_min_discount}% alert bar."** — plus a one-click "Lower my bar to 30%" action, and the price-check framing ("we check ~20 destinations daily"). If no deals exist at all in the window, send the reassurance variant with no deal card.
(b) **Promise alignment:** the checkout-success banner (`app/account/page.tsx:52-60`) stops promising "within 24 hours"; new copy: **"You're in. We'll email you the moment a deal beats your alert bar — and we'll check in within your first 3 days either way."** The welcome email's "30%+" (`WelcomeEmail.tsx:25-28`) changes to threshold-neutral copy: **"When a hotel drops well below its usual price, you'll hear from us."** (it fires pre-checkout and must not state trial terms).
(c) **Instrumentable skips:** `runDailyDigest` return type separates `skippedNoDeals` from `errors` (currently conflated at `sendDailyDigest.ts:138-141`).
**Acceptance:** a trial seeded with zero qualifying deals produces ≥1 email by day 3 and the fallback is never sent twice; fallback copy never claims a deal cleared the bar; welcome email contains no numeric threshold; digest return distinguishes skip reasons.

## 6. Out-of-scope findings (flag for separate tickets)

1. **Dunning/payment-failure recovery (DEV):** `invoice.payment_failed` and `past_due` hard-cancel with no retry window or user email (`webhook/route.ts:74-83, 92-102`). For a card-upfront trial this converts recoverable failures into silent churn.
2. **Onboarding bypass (repair):** `/account?checkout=success` does not redirect to `/onboarding`; only `/deals` enforces it (`app/deals/page.tsx:41-44`). Users who never leave `/account` keep the 40% default they never chose — which feeds directly into the silence problem D5 mitigates.
3. **Analytics (DEV):** zero event instrumentation exists; minimum viable funnel events: trial_started, digest_sent, digest_skipped(reason), trial_ending_email_sent, trial_canceled, first_charge_succeeded/failed.
4. **Free→trial funnel:** per discovery §8, separate ticket.

## 7. Handoff

Next stage: **UXDES-TRIAL-CONVERT-01** — produce the full design spec (`03-design.md`) for D1–D5: every state (default/loading/empty/error/375px/1280px/focus), final copy for all strings, Tailwind token patterns replacing the `amber-*` one-offs, and email template states.
