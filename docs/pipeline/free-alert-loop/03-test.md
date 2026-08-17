# UI/DEV-FREE-ALERT-LOOP-01 — QA

**Stage:** TEST (QA). Docs-only — no code changed by this stage.
**Implementation reviewed:** Codex (`codex exec --sandbox workspace-write`), diff reviewed file by
file against `docs/pipeline/free-alert-loop/02-research-design.md` before shipping.

## A real gap Codex found on its own

The design doc's dispatch only flagged `app/api/account/watchlist/route.ts`'s hard premium-only
403 gate. Codex independently found a second, identical gate in `app/api/account/alerts/route.ts`
(the frequency/threshold save endpoint) that would have made the newly-visible free-tier Alerts UI
silently fail on every save if left alone. Fixed with the same pattern: 404 on no subscription,
premium check retained only for gating the `instant`→`daily` coercion, not for hard rejection.

## Verification run (real, in this worktree, fresh install)

1. `npx tsc --noEmit --incremental false` — **exit 0**.
2. `npm test -- --passWithNoTests` — **140 passed / 1 failed, 1472 passed / 1 failed** (141/1473
   total). The one failure is the same pre-existing, unrelated
   `HotelSustainabilityCredentialEvidence` baseline failure carried through every ticket tonight.
3. `npm run build` — **succeeded**, full route manifest printed, no compile errors.

## Diff review against the design spec, file by file

- **`lib/alertLimits.ts`** (new): `FREE_WATCHLIST_CAP = 1`, `PREMIUM_WATCHLIST_CAP = 10` — a single
  shared source of truth, imported everywhere instead of redefining the cap per file. Matches the
  spec's "don't leave it inconsistent" instruction.
- **`lib/email/sendDailyDigest.ts`**: recipient query now admits `status = 'free' AND
  alert_preference = 'daily'` alongside the existing `trialing`/`active` check; per-recipient
  `LIMIT` is computed via `isPremium(recipient.status)` → 8 or 2. The per-recipient deal-selection
  query itself is untouched, exactly as specified (the city cap is enforced upstream at write-time,
  not by adding new filter logic to an already-complex query). `sendFreeTierTeaser.ts` and both
  GitHub Actions workflows (`teaser.yml`, `digest.yml`) — confirmed untouched via `git status`.
- **`app/api/onboarding/route.ts`**: adds the real tier lookup that didn't exist before
  (`getSubscription`/`isPremium`), tier-aware `normalizeWatchlist` cap via the shared constants,
  silent `instant`→`daily` coercion for free (not a rejection — matches the product decision that
  free is daily-only, not an error state).
- **`app/api/account/watchlist/route.ts`**: the hard 403 replaced with a 404-if-missing-subscription
  check plus a tier-aware cap on both the bulk-replace path and the atomic add/remove path (the
  latter now correctly parameterized as `$3` rather than a hardcoded `10` in the SQL).
- **`app/api/account/alerts/route.ts`** (found and fixed by Codex, not in the original spec): same
  403→404 pattern, plus the same `instant`→`daily` coercion applied to this endpoint's own patch
  path.
- **`app/account/page.tsx`**: the `{premium && (...)}` wrapper around the Alerts section is gone;
  `premium={premium}` now passed to `AccountClient`. Also updated the free-plan blurb elsewhere on
  the page ("Upgrade for unlimited deals + email alerts" → "+ instant email alerts") — a real,
  accurate distinction now that free gets non-instant alerts too, not in the original spec but
  correct and consistent with it.
- **`app/account/AccountClient.tsx`**: `maxCities` computed once from the shared constants and
  reused consistently across `toggleCity`'s cap check, `atCap`, the "Cities I'm watching (N/max)"
  label, and `StatusLine`'s cap message (now grammatically correct for both "1 city" and "10
  cities"). The `Instant` frequency option is omitted entirely from free users' options array
  (not just disabled) — matches the "daily-only, not soft-discouraged" design decision. Initial
  `pref` state defensively coerces a free user's stale `alertPreference: 'instant'` to `'daily'`
  client-side too, not just server-side.
- **`app/page.tsx`**: the now-false "No email alerts" Free-plan bullet replaced with "Daily digest
  for 1 watchlist city" — real, specific, matches the actual shipped cap exactly, no overstatement.
- **Test coverage**: all four updated/new test files were reviewed directly. Old assertions that
  described the now-intentionally-changed behavior (403 premium-required) were updated to the new
  correct behavior (404 on missing subscription), not deleted or weakened. New tests added for the
  free-tier paths assert the exact right SQL parameters (`['Paris', 'user-free', 1]` for the
  1-city-capped add, `[recipient, 40, 2]` for the free digest's deal limit) — real, specific
  assertions, not loose ones.

## Manual trace of the real user-facing flows

1. A free user completes `/onboarding`, sets `alertPreference: 'daily'` and one city → their
   `subscriptions` row is `status: 'free'`, `alert_preference: 'daily'`, `watchlist: ['City']`.
2. The next `runDailyDigest()` cron run now includes them (previously would have silently skipped
   them forever), sends up to 2 real, unlocked deals matching their city and discount threshold.
3. On `/account`, the Alerts section is now visible to this same free user — they see "Daily
   digest" and "Off" as their only frequency options (no Instant), their watchlist shows "(1/1)"
   with the single city pre-filled, and attempting to add a second city correctly triggers the cap
   message rather than a silent 403 failure.
4. A premium user's experience is unchanged throughout — verified via diff that every premium-path
   branch (`isPremium(...) ? ... : ...`) preserves the original 10-city/instant-allowed/8-deal
   behavior exactly.

## PASS criteria

1. tsc exits 0 — **PASS**
2. tests exit 0 modulo the known pre-existing failure — **PASS**
3. Every state (free daily-only, free 1-city cap, premium unchanged, the newly-visible free Alerts
   UI, the second gate Codex found and fixed) is implemented — **PASS**
4. No regression in adjacent surfaces (`sendFreeTierTeaser.ts`, both cron workflows, premium's
   existing digest behavior) — **PASS**, confirmed untouched/unchanged via diff
5. Money/tier correctness — all gating routes through `isPremium()`/`status` from
   `lib/subscription.ts`, no parallel entitlement system introduced — **PASS**

**Verdict: PASS.** No rollback ticket needed.
