# UXD-FREE-ALERT-LOOP-01 — UX Discovery

**Stage:** UXD (UX Discovery) — docs only, no code changed, no commit made by code changes.
**Source:** `files/priority-3-free-alert-loop.md` from a marketing-agency workspace export
(`workspace-files-2.zip`, delivered 2026-08-17). Its premise was independently re-verified against
real current code/infra before trusting it — the verification found the premise partly wrong, and
this doc is built on the corrected picture, not the agency doc's original framing.

**Methodology:** direct code/infra investigation (this session) + one real Krater call
(`openai/gpt-5.2-codex`, cost $0.019781685, `finish_reason: stop`) for the discovery synthesis, per
the standing instruction to route analysis through Krater rather than this session's own reasoning.

---

## 1. Re-verification against real code (done directly, before the Krater call)

The agency doc's central claim: *"Free plan = 3 unlocks/week + blurred feed + **No email
alerts**... Viral loop is dead until free users get alerts."* **This is materially incomplete,
verified wrong on the "no email alerts" specifics:**

- `lib/email/sendFreeTierTeaser.ts` is real, live code, triggered by a real, currently-scheduled
  GitHub Actions workflow (`.github/workflows/teaser.yml`, cron `0 10 * * 1` — every Monday
  10:00 UTC, plus the endpoint's own 7-day cooldown). It queries free-tier subscribers, finds their
  single best available deal (that they have **not** unlocked), and emails "Unlock {N} hotel deals
  now" using Resend.
- **But the underlying product complaint survives, more precisely stated**: this teaser is a
  once-a-week, single-deal, **locked-bait upsell** — not a real "a deal you'd actually want just
  dropped" alert. It ignores any city/watchlist preference (free users have none today), and its
  entire design intent is conversion pressure, not utility. The real, actionable daily digest
  (`lib/email/sendDailyDigest.ts`, `.github/workflows/digest.yml`, real per-timezone 9am cron) is
  explicitly gated to `status IN ('trialing', 'active')` — free users never receive it.
- **Mailchimp is not connected anywhere** — no credentials on this machine, zero code references.
  Every real transactional email in this codebase (`sendDailyDigest`, `sendFreeTierTeaser`,
  `sendWelcome`, `sendMagicLink`, `sendTrialEnding`) already goes through Resend
  (`lib/email/resend.ts`). The agency doc's instruction to "wire every free email into Mailchimp
  list `429359f005`" does not match this codebase's real architecture and should not be followed
  literally.
- Real, reusable schema already exists on `subscriptions`: `status`, `alert_preference`,
  `watchlist`, `alert_min_discount`, `alert_timezone`, `last_alerted_at`, `last_teaser_sent_at`,
  `alert_unsubscribe_token`. A real free-alert feature should extend this, not invent a parallel
  system.

## 2. The problem (corrected)

**One-sentence pain point:** Free users receive a weekly, locked, non-actionable upsell email, but
never a real "a deal you'd actually want just dropped" alert — so they never experience the
product's core value (a timely, real, bookable deal notification) before being asked to pay for it.

**Who's affected, and where:** every free signup, from the moment they join through the entire time
they stay free — the account page's watchlist/alert-preference controls today only meaningfully
affect premium delivery; a free user setting a "watchlist city" currently changes nothing about what
they receive.

**Measurable signals worth checking (real instrumentation, not assumed):** free-to-trial conversion
rate; free-user retention/re-engagement after signup; the weekly teaser's own open/click rate versus
its unsubscribe rate (a locked-bait email with a high unsubscribe rate would be direct evidence the
current approach is actively costing engaged users, not just failing to convert them).

## 3. Constraints

1. **No new email vendor.** Reuse Resend and the existing `subscriptions` schema — the agency doc's
   Mailchimp instruction does not apply to this codebase.
2. **Must not silently erode Premium's "unlimited alerts" value prop.** `app/join/_form.tsx`'s
   FEATURES list and this session's own `docs/pipeline/join-redesign/01-discovery.md` both treat
   unlimited/instant alerts as one of Premium's core, load-bearing differentiators. Any free-tier
   real alert must be **deliberately, visibly lesser** (e.g., one city, daily-only, not instant) —
   a stated design decision, not an afterthought.
3. **Reuse real entitlement logic.** Whatever gating ships must use `isPremium()`/`status` from
   `lib/subscription.ts` — no parallel entitlement system.

## 4. Success statement

*This is solved when a free user who sets a home city receives a real, actionable, unlocked deal
alert for that city on a meaningfully-lesser cadence than Premium — not just a weekly "you're
missing out" nudge — measured by improved free-user retention/re-engagement, without measurably
softening free-to-trial conversion.*

## 5. What's good and buildable vs. overreach (from the agency doc)

**Good, buildable, reuses real infra:**
- A real free-tier digest: a "Free Digest" branch of the existing `sendDailyDigest` job, gated to
  `status = 'free'`, capped to **one** watchlist city (vs. Premium's unlimited), daily-only cadence
  (vs. Premium's instant+daily option), reusing the same Resend template pattern.
- Preference capture: let a free user pick one home city (the account page's existing watchlist UI
  already has the pattern, just needs the 1-city cap enforced for free status).
- Updated free-tier marketing copy removing "No email alerts" once it's no longer true.

**Overreach / wrong for this codebase, do not build as specified:**
- Mailchimp integration — no such system exists here; would be a disconnected, redundant vendor.
- The literal claim "free users get zero email alerts" — factually incomplete, corrected above.
- A dedicated `/join/free` route, without first checking it against tonight's already-shipped
  `/join` redesign (`docs/pipeline/join-redesign/02-research-design.md`), which just added
  entitlement-aware branching to that exact page. A second free-vs-premium fork bolted onto `/join`
  needs to be reconciled with that existing branch, not designed in isolation.

## 6. The real fork requiring explicit confirmation before any implementation

**Does expaify want free users to receive a real, actionable deal alert at all?** Today, the entire
premium conversion funnel is built around free users being denied exactly that. Giving free users a
real (even if capped) alert is a genuine trade — plausibly better top-of-funnel retention and
word-of-mouth, at the cost of softening one of Premium's clearest, most concrete value props. This
is a business decision, not an engineering one, and — matching how this same pipeline flagged
D1/D1b in the join redesign as funnel-changing and requiring explicit confirmation — this doc does
not proceed to UXR/design/implementation until that confirmation is given.

---

## Handoff

**Blocked pending requester confirmation of the Section 6 fork.** If confirmed to proceed, next
stage is `UXR-FREE-ALERT-LOOP-01` (UX Research), which should turn Section 5's "good, buildable"
list into specific, testable directives — including the exact free-tier alert cap (1 city
confirmed, or a different number), exact cadence, exact copy for the account page's free-tier
alert controls, and exact reconciliation with the `/join` page's existing entitlement branch.
