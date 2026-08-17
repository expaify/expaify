# UXR+UXDES-FREE-ALERT-LOOP-01 — Research & Design (combined stage)

**Stage:** UXR + UXDES combined — docs only. Reads `01-discovery.md`'s Section 6 fork, now
resolved: **confirmed by the requester — build the capped free digest.**

**Methodology:** one real Krater call (`openai/gpt-5.2-codex`, cost $0.0373163175,
`finish_reason: stop`) for the substantive design judgment calls (tier-split values, whether to
open Alerts to free users, whether to unify or split the digest function). Krater's code syntax
did not match this codebase's real conventions in several places (wrong table names, a `sql`
tagged-template that doesn't exist here — this app uses `query<T>(sql, params)` — a
`normalizeWatchlist` signature that didn't match the real function) — those judgment calls were
kept, but every concrete code instruction below was rewritten against real, freshly-read source in
this session, not pasted from Krater's draft.

## A significant real finding that changes implementation risk

`app/api/account/watchlist/route.ts` **hard-rejects any non-premium user with `403 premium
required`** before doing anything else. This wasn't in the discovery doc and wasn't something
Krater's spec caught (it only looked at `AccountClient.tsx`'s client-side cap, not this route). If
Alerts is opened to free users on the account page without also fixing this route, the watchlist
UI would render for free users but every single toggle/save would silently fail with a 403. This
is exactly the kind of gap real code-reading catches that a spec-from-description doesn't.

## Final decisions

- **Free tier: 1 watchlist city, daily-only cadence, 2 deals per digest** (vs. Premium's 10
  cities, instant or daily, 8 deals per digest). Krater's judgment on the deal-count split (2 for
  free) is adopted as reasoned and proportionate — clearly lesser than Premium's 8, not zero.
- **`sendDailyDigest.ts` stays one function**, tier-aware via a per-recipient `isPremium(status)`
  check controlling only the `LIMIT` parameter — not two separate digest functions. Krater's
  "minimal duplication" judgment adopted; the real per-recipient deal query itself is unchanged
  (the watchlist cap is enforced upstream at write-time, not by adding new WHERE-clause logic to
  an already-complex query).
- **Alerts section on `/account` opens to free users** (Krater's recommendation D, adopted with
  reasoning): free users already set a real preference via onboarding and have no way to review or
  change it afterward otherwise — hiding the whole section would make the new capability
  effectively undiscoverable for anyone who didn't get their city choice right the first time.
- **No new `/join/free` route** — confirmed unnecessary; `/onboarding` already serves every tier.

## Exact implementation (real code, verified against actual current source)

See the dispatched implementation prompt for the full real-code diffs across:
1. `lib/email/sendDailyDigest.ts` — recipient query admits `status = 'free' AND alert_preference =
   'daily'`, per-recipient `LIMIT` becomes tier-aware (`MAX_DIGEST_DEALS_PREMIUM = 8`,
   `MAX_DIGEST_DEALS_FREE = 2`).
2. `app/api/onboarding/route.ts` — adds a real tier lookup (`getSubscription`/`isPremium`, not
   present today), tier-aware `normalizeWatchlist` cap (1 vs 10), forces `'instant'` → `'daily'`
   for free rather than rejecting it.
3. `app/api/account/watchlist/route.ts` — the hard 403 reject found above is replaced with a
   tier-aware cap (1 vs 10) on both its bulk-replace and single add/remove code paths.
4. `app/account/page.tsx` — removes the `{premium && (...)}` wrapper around the Alerts section,
   passes a new `premium` prop through to `AccountClient`.
5. `app/account/AccountClient.tsx` — `atCap`/`toggleCity`'s hardcoded `10` becomes tier-aware; the
   'Instant' frequency option is omitted entirely for free users (daily-only, not just
   soft-discouraged); the cap-reached status message becomes accurate for both 1 and 10.
6. `app/page.tsx` — the now-false "No email alerts" Free-plan bullet is replaced with real,
   specific copy matching the actual 1-city/daily cap shipped here — no overstatement.

## Constraints re-confirmed

No Mailchimp anywhere. No new `/join/free` route. `sendFreeTierTeaser.ts` and its schedule
untouched — this is additive, not a replacement for the existing weekly upsell email. All tier
gating goes through `isPremium()`/`status` from `lib/subscription.ts`, no parallel system.

## Handoff

Next stage: `UI/DEV-FREE-ALERT-LOOP-01` (implementation, dispatched to Codex — real, multi-file,
touches money-adjacent tier-gating logic, so independent re-verification of every file is required
before shipping, same discipline as every other ticket tonight). Then this session's own direct QA
before deploy.
