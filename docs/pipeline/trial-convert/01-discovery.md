# UX Discovery: Trial-to-Paid Conversion Funnel

**Ticket:** UXD-TRIAL-CONVERT-001 · **Stage:** UXD · **Date:** 2026-07-19
**Author:** UX Discovery (Claude Fable 5)

---

## 1. Problem statement (one sentence)

A trial user who signs up gets no in-product evidence of value during days 1–7 — no trial status outside `/account`, no value recap, no trial-ending touchpoint, and a daily email that silently skips whenever no new deal clears their 40% threshold — so by the time the card is about to be charged, the only urgency copy they have seen is an instruction telling them how to cancel.

## 2. Corrected framing: this trial converts by default, and two populations are conflated

Two facts from the code change how this ticket should be read downstream:

**(a) The trial is card-upfront and auto-converts.** Checkout (`app/api/stripe/checkout/route.ts:42-54`) creates a Stripe subscription with `trial_period_days: 7` and a card on file. Nobody has to "decide to pay" on day 7 — Stripe charges automatically. So "trial users are not converting" mechanically means one of: they **cancel during the trial**, their **payment fails** (`invoice.payment_failed` immediately flips status to `canceled` in `app/api/stripe/webhook/route.ts:74-83`, with no dunning or retry messaging), or they **churn immediately after the first charge** (buyer's remorse refund/cancel). The lever is therefore *demonstrating value before day 7*, not adding a "convert now" button.

**(b) Trial users never see locked deals.** `isPremium()` treats `trialing` as premium (`lib/subscription.ts:23-25`), so the paywall (`lib/paywall.ts`) unlocks everything for them. The ticket's "no upgrade prompt on locked deals" applies only to **free** users (users who authenticated but abandoned or failed Stripe checkout — the checkout error path drops them on `/deals` as free, `app/api/stripe/checkout/route.ts:57-60`). `LockedDealCard.tsx` already has an "Unlock with Premium" CTA for them. The free→trial funnel is real but is a **separate problem**; this discovery scopes to trial→paid and flags free→trial for a follow-up ticket.

## 3. Who is affected, and where

**Affected user:** a first-time subscriber in days 0–7 of the trial, card on file, typically arriving from the landing page pricing section ("7-day free trial") or `/join` ("no charge until day 8").

**Day-by-day walkthrough of what the code actually delivers:**

| Day | What the user sees | Source |
|---|---|---|
| 0 | Magic-link auth → Stripe checkout → `/account?checkout=success` with banner: "You're in. Your first deal alert arrives by email — usually within 24 hours." | `app/account/page.tsx:52-60` |
| 0 | Welcome email: "You're in the club" — no mention of trial length, price, or charge date. | `lib/email/templates/WelcomeEmail.tsx` |
| 0 | Onboarding (watchlist/alert prefs) is only forced if they visit `/deals`; landing on `/account` post-checkout does **not** redirect, so onboarding can be skipped entirely. | `app/deals/page.tsx:41-44` vs `app/account/page.tsx` |
| 1–7 | Daily digest at 9am local — **only if** a deal first seen in the last 24h clears their min-discount (default **40%**) and watchlist. Otherwise the send is silently skipped (`skipped++`, no fallback content). A user can complete the entire trial with **zero emails** after being promised one "within 24 hours." | `lib/email/sendDailyDigest.ts:74-106` |
| 1–7 | `/deals` feed: fully unlocked, visually identical to a paying member's view. Nothing indicates trial status, days remaining, or accumulated value. No upgrade or trial UI exists anywhere in `DealFeed.tsx`, deal detail, or the nav. | grep: zero trial/upgrade refs in those files |
| 1–7 | `/account` (the only trial surface): amber countdown box — "Trial ends {date}. You'll be charged $12/mo unless you cancel before then." Pure loss-avoidance framing; the single sentence of trial messaging in the product is a cancellation instruction. | `app/account/page.tsx:95-108` |
| 5–6 | Nothing. Stripe's `customer.subscription.trial_will_end` event (fires 3 days before trial end) is **not handled** — no "trial ending" email, no value recap, no save offer. | `app/api/stripe/webhook/route.ts:33-87` (no case) |
| 8 | Card charged with no warning beyond the day-0 checkout screen, or — if the charge fails — status silently becomes `canceled` with no user-facing communication. | webhook `invoice.payment_failed` |

## 4. Existing triggers vs. missing triggers

**Exists today:**
1. Trial countdown on `/account` only — a page a trial user has no reason to revisit (alerts/watchlist settings are the only draw).
2. Daily digest email — conditional, threshold-gated, silently skippable.
3. Free-plan upsell banner + `LockedDealCard` CTA — free users only, invisible to trial users.

**Missing (the gaps downstream stages should address):**
1. **No persistent trial indicator** in the browsing experience (nav on `/deals`, deal detail) — the user forgets they are in a trial until the charge or the cancel-framed countdown.
2. **No value ledger.** The product computes savings per deal (`median - dealPrice`) but never aggregates "your trial surfaced N deals worth $X in savings" anywhere — dashboard or email. This is the single strongest justification for the charge and it is absent.
3. **No trial-ending touchpoint** (day 5–6 email + in-app state) — `trial_will_end` webhook unhandled; the countdown copy has no positive framing variant.
4. **No zero-deal fallback.** When the digest has nothing to send, the trial goes silent — precisely when reassurance ("we checked 20 markets, nothing beat your 40% bar, here's what came close") is most needed. Default 40% threshold + skipped onboarding makes silence the *likely* trial experience.
5. **No payment-failure recovery** — failed first charge = silent cancel.
6. **No instrumentation.** Zero analytics anywhere in `app/` or `lib/` — trial starts, cancels, digest skips, and countdown views are unmeasured; the funnel cannot even be quantified today.

## 5. Measurable signals that the problem exists

- `sendDailyDigest.ts` returns `{ recipients, skipped }` — the skip branch fires whenever no qualifying deal exists per user; with the 40% default this is structurally frequent (deal feed's own default filter is 20%).
- Grep evidence: 0 occurrences of trial/upgrade strings in `DealFeed.tsx`, `deals/[dealId]/page.tsx`, `DailyDigest.tsx`, `WelcomeEmail.tsx`, `OnboardingClient.tsx`.
- Webhook switch handles 4 event types; `customer.subscription.trial_will_end` absent.
- Copy audit: the only trial-period sentence in the product ends with "…unless you cancel before then." It also states "$8/mo" for annual (`app/account/page.tsx:105`) when the actual charge is a single annual lump sum — a trust break at the exact moment of the conversion decision.

## 6. Constraints the solution must respect

1. **Trust and money honesty (brand + data integrity):** every price shown must state the real charge (annual = one charge, not "$8/mo"); savings claims must derive from stored `median_price_cents` vs `deal_price_cents` (integer cents, per contract) — no invented numbers, no fake urgency ("only 2 left!") on data we don't have. Never claim deals were found when the digest skipped.
2. **No dark patterns, but no self-sabotage either:** cancellation must stay one click away via the Stripe portal, while the countdown's primary framing shifts to value delivered. Emails must keep the unsubscribe token flow intact.
3. **Performance + accessibility:** any persistent trial indicator must not add a blocking query to `/deals` (subscription is already fetched server-side there), must work at 375px without crowding the feed, and must be screen-reader-legible (countdowns announced as text, not color alone).

## 7. Success statement

This is solved when a first-time trial user can see, at any point in days 1–7 and in a day-5 email, exactly what expaify found for them and what it was worth — without ever hitting a silent week of no emails or discovering the charge amount for the first time from their bank statement — and the team can measure trial starts, cancels, and digest skips to verify conversion actually moves.

## 8. Out of scope (flag for separate tickets)

- Free→trial funnel (locked-deal CTAs, free-user emails) — distinct population, distinct fixes.
- Dunning/payment-retry flow — touches billing logic; note for a DEV-stage ticket.
- Onboarding not being enforced after checkout success (`/account` doesn't redirect) — adjacent bug worth its own repair ticket.
