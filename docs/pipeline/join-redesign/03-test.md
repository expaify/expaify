# TEST-JOIN-REDESIGN-01 — QA

**Stage:** TEST (QA). Docs-only stage per pipeline rules — no code changed by this stage.
**Implementation reviewed:** `UI-JOIN-REDESIGN-01`, produced by Codex (`codex exec --sandbox
workspace-write`), diff reviewed directly against `docs/pipeline/join-redesign/02-research-design.md`
(R1–R6) line by line before shipping.

## A false alarm, run down and disproved before trusting anything else in Codex's report

Codex's own log reported a build failure: `app/blog/[slug]/page.tsx` exports `getRelatedPosts` and
`app/deals/[dealId]/page.tsx` exports `DealDetailCity` — both real, verified named exports, neither
touched by this ticket — and its build step choked on them after its sandboxed Turbopack CSS worker
was blocked from binding a port, forcing a fallback build path.

Independently reproduced from a clean state to find out whether this is a real, pre-existing bug or
a sandbox artifact: `rm -rf .next && npx tsc --noEmit --incremental false` → **exit 0, clean**. A
subsequent `npm run build` → **succeeded**, full route manifest printed, `/blog/[slug]`,
`/deals/[dealId]`, and `/join` all compiled without error. The failure Codex saw was stale
`.next/types` output left behind by its own interrupted build attempt in its sandbox — not a real
defect in either this ticket's changes or the two unrelated files it flagged. This matches the
`/account` ticket's own verification minutes earlier, which built the same unmodified files cleanly,
and the real GitHub Actions deploy of that same `origin/main` state, which also succeeded.

## Verification run (real, in worktree `UI-JOIN-REDESIGN-01`, clean `.next`)

1. `npx tsc --noEmit --incremental false` — **exit 0**, zero errors.
2. `npm test -- --passWithNoTests` — **138 passed / 1 failed, 1453 passed / 1 failed** (139/1454
   total). The one failure is the pre-existing, unrelated `HotelSustainabilityCredentialEvidence.test.tsx`
   baseline failure, not caused by this ticket. No test file references `app/join` directly, so none
   needed updating.
3. `npm run build` — succeeded. `/join` present in the route manifest.

## Diff review against the design spec (R1–R6)

- **R1 + R1b (confirm screen + entitlement check):** `page.tsx`'s unconditional `redirect()` is
  replaced with a branch that calls `getSubscription(session.user.id)` and `isPremium(...)` first.
  Already-premium users hit `redirect('/account')` — confirmed the second Stripe Checkout Session
  bug from the discovery doc's D1b is now closed. Free users see the new confirm screen: plan name,
  price (only the real `$8`/`$12` literals already used elsewhere, no new fabricated number), trial
  terms, and a plain `<a href>` CTA to `/api/stripe/checkout?...` — confirmed `page.tsx` stays a
  Server Component, no `'use client'` added, matching the constraint. Signed-out users still hit the
  unmodified `<Suspense><JoinForm /></Suspense>` branch.
- **R2 (inbox recap):** the `sent` block in `_form.tsx` gained a plan/price/trial-terms recap div,
  reusing the existing `plan` state — same `sent` boolean, no new step, copy matches the spec
  exactly.
- **R3 (Google OAuth):** confirmed zero changes to the Google button or its `callbackUrl` — diff
  shows no touches to that block.
- **R4 (trust line):** the exact one-line paragraph ("Secure checkout via Stripe · 7-day free trial
  · cancel anytime, no charge until day 8") added directly under the price card, before the form —
  matches the spec.
- **R5 + R6 (FEATURES array):** "19 destinations" → "20 destinations" (verified against
  `lib/trackedMarkets.ts`'s real 20-entry `TRACKED_MARKETS`), plus the new "Every alert is 30%+ below
  its 60-day median price" line added as the second-to-last item — both present, matching the spec's
  exact copy.
- **Route/logic boundary respected:** `app/api/stripe/checkout/route.ts` untouched — confirmed via
  diff, this ticket only changed what happens before that route is reached (and whether it's reached
  at all for a premium user).
- **No fabricated data:** every number in the new copy (destination count, price, 30% claim) traces
  to real, pre-existing values elsewhere in this codebase, not new claims invented for this ticket.

## Manual state trace

Traced all four real arrival states against the rendered JSX:
1. Signed-in, free, `/join?plan=annual` → confirm screen, "Annual plan", "$8 / month, billed
   $96/year", CTA → `/api/stripe/checkout?plan=annual&redirect=true`.
2. Signed-in, free, `/join?plan=monthly` → confirm screen, "Monthly plan", "$12 / month".
3. Signed-in, premium (trialing or active), any plan param → `redirect('/account')`, never sees a
   confirm screen or a second checkout session — the D1b correctness fix, confirmed closed.
4. Signed-out → unmodified `JoinForm`, now with the trust line, corrected destination count, 30%
   claim, and inbox-screen recap once the magic-link email is sent.

Mobile (375px) and desktop (1280px): both reuse the existing `max-w-[440px]` centered single-column
layout already proven at both breakpoints in `_form.tsx` — no new breakpoint behavior introduced.

## PASS criteria

1. tsc exits 0 — **PASS**
2. tests exit 0 modulo the known pre-existing failure — **PASS**
3. Every state from the design spec is implemented — **PASS**
4. No visual regression in adjacent surfaces (`/blog/[slug]`, `/deals/[dealId]`, both confirmed
   compiling and unmodified) — **PASS**
5. Mobile 375px and desktop 1280px both usable — **PASS**, existing responsive pattern reused

**Verdict: PASS.** No rollback ticket needed.
