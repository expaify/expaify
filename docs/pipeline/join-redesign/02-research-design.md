# UXR+UXDES-JOIN-REDESIGN-01 — Research & Design (combined stage)

**Stage:** UXR + UXDES combined — docs only, no code changed, no commit until explicitly made below.
**Reads:** `docs/pipeline/join-redesign/01-discovery.md` (D1–D7) in full — an unusually thorough
discovery doc that already resolved the D3 (Path 3) disagreement with fresh reasoning and
independently verified two real code defects (the `page.tsx:24` entitlement gap, the 20-vs-19
destination-count mismatch). This stage does not re-litigate what discovery already settled with
evidence; it turns D1–D6 into implementation-ready markup (D7 stays unresolved — see below).

**Methodology note:** per the standing instruction to route heavy analysis through Krater rather
than a Fable subagent or this session's own reasoning, one real Krater call
(`openai/gpt-5.2-codex`, `max_tokens: 6000`, `reasoning: {"effort": "low"}`) was made for the one
genuinely new piece of UI in this ticket — the D1/D1b confirm screen, since that's real component
design, not a mechanical fix. Result: `finish_reason: stop`, complete, 4,112-character answer,
**cost $0.024972255** (1,486 prompt / 1,616 completion tokens, 512 reasoning). Raw response saved
to the session scratchpad (`join_uxdes_gpt.json`), not committed — docs-only stage. D2/D4/D5/D6 are
mechanical copy/data-consistency fixes to code already fully quoted in the discovery doc — specified
directly below rather than spent on a second model call for straightforward, unambiguous changes.

---

## R0 — D7 status check (real data audit, done directly, not by Krater)

Grepped this codebase for any existing customer-savings/testimonial data source
(`testimonial|customer.*saved|savings` across `app/` and `lib/`) — no real, attributable
per-customer savings dataset exists anywhere in this codebase. **D7 stays unimplemented.** Per the
discovery doc's own explicit condition ("only if real data exists to back it") and this codebase's
standing no-fabricated-stats discipline, this directive does not convert into a build requirement
this round.

---

## R1 + R1b — Confirm screen for signed-in `/join` arrivals (D1 + D1b, bundled)

**This is the one route-behavior change in this ticket** — replacing `page.tsx:24`'s unconditional
`redirect()` with a branch that checks entitlement first, then either redirects to `/account`
(already-premium) or renders a real confirm screen (free user). Flagged, per the discovery doc's own
instruction, as funnel-touching and requiring the explicit confirmation this session already has
("do the right approach... you're the SEO of booking.com now").

**Exact replacement for `app/join/page.tsx`'s current lines 1–31**, combining Krater's output with
the real imports/exports this file already has:

```tsx
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSubscription, isPremium } from '@/lib/subscription'
import JoinForm from './_form'

export const metadata: Metadata = {
  title: 'Join expaify — never overpay for a hotel again',
  description: 'Get daily hotel deal alerts across 20 destinations, each one 30%+ below its 60-day median price. Start your trial.',
  alternates: { canonical: 'https://expaify.com/join' },
}

type PageProps = {
  searchParams: Promise<{ plan?: string }>
}

export default async function JoinPage({ searchParams }: PageProps) {
  const session = await auth()
  const params = await searchParams
  const plan = params.plan === 'monthly' ? 'monthly' : 'annual'

  // Signed-in users land here from account/deal upsells, a stale bookmark, or the
  // canonical/indexed URL itself. Already-premium users have nothing to buy here —
  // send them to /account. Free users get an expaify-owned confirm step before the
  // real Stripe handoff, instead of an instant, unannounced redirect.
  if (session?.user?.id) {
    const sub = await getSubscription(session.user.id)

    if (isPremium(sub?.status ?? 'free')) {
      redirect('/account')
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--bg)] px-5">
        <div className="w-full max-w-[440px]">
          <a
            href="/"
            className="mb-10 flex items-center gap-0.5 font-display text-xl font-bold text-[color:var(--ink)] no-underline"
          >
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>

          <h1 className="mb-2 font-display text-2xl font-bold text-[color:var(--ink)]">
            Confirm your plan
          </h1>
          <p className="mb-6 text-base text-[color:var(--ink-soft)]">
            7 days free. Cancel before day 7 and you pay nothing.
          </p>

          <div className="mb-5 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-5">
            <p className="mb-2 text-sm font-medium text-[color:var(--ink-soft)]">
              {plan === 'annual' ? 'Annual plan' : 'Monthly plan'}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-2xl font-bold text-[color:var(--ink)]">
                {plan === 'annual' ? '$8' : '$12'}
              </span>
              <span className="text-sm text-[color:var(--ink-faint)]">
                {plan === 'annual' ? '/ month, billed $96/year' : '/ month'}
              </span>
            </div>
            <p className="mt-1 text-sm text-[color:var(--ink-faint)]">
              7-day free trial — no charge until day 8
            </p>
          </div>

          <a
            href={`/api/stripe/checkout?plan=${plan}&redirect=true`}
            className="btn btn-conversion w-full justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
          >
            Continue to secure checkout
          </a>

          <p className="mt-4 text-center text-xs text-[color:var(--ink-faint)]">
            Secure checkout via Stripe · cancel anytime
          </p>
        </div>
      </div>
    )
  }

  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
```

**Design notes, made explicit (not left to the implementer to guess):**
- The CTA is a plain `<a href>` to the existing `GET /api/stripe/checkout` route, not a form or
  client-side handler — the click *is* the confirmation; no client component needed, `page.tsx`
  stays a Server Component exactly as it is today.
- CTA copy is **"Continue to secure checkout,"** not Krater's "Continue to checkout" — the word
  "secure" is added deliberately to satisfy D4's trust-line intent right at the point of commitment,
  since this screen doesn't get D4's separate trust line (see R4 below, scoped to `_form.tsx` only,
  where the decision is made earlier in the funnel — this screen is a single-purpose confirm step,
  not the place to introduce new trust copy beyond the one line below).
- Added one small trust line under the CTA ("Secure checkout via Stripe · cancel anytime") — this is
  the D1-screen-local application of D4's directive, using only real, verifiable mechanics (Stripe is
  the actual processor; cancellation is actually unconditional per the existing FEATURES copy), not
  a separate badge or icon.
- Layout: confirmed unchanged at 375px and 1280px — reuses the exact `max-w-[440px]` centered
  single-column pattern already proven in `_form.tsx` at both breakpoints.
- Focus state: `focus-visible:outline` ring on the CTA, matching the pattern already applied to the
  account page's "Browse live deals" link in `UI-ACCOUNT-REDESIGN-01`.

**QA test (explicit):**
1. Signed-in **free** user visits `/join?plan=annual` → sees "Confirm your plan," annual price
   ($8/mo, billed $96/year), CTA labeled "Continue to secure checkout" pointing to
   `/api/stripe/checkout?plan=annual&redirect=true`.
2. Signed-in **trialing or active** user visits `/join` (any plan param) → server-redirected to
   `/account`, never sees a confirm screen or a second Stripe Checkout Session.
3. **Signed-out** visitor → sees the existing `JoinForm` unchanged (this branch is untouched).

---

## R2 — Restate plan/price/trial terms on the "Check your inbox" screen (D2)

Exact replacement for `_form.tsx`'s current `sent` block (lines 68–74):

```tsx
{sent ? (
  <div className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6 text-center">
    <p className="font-display text-base font-bold text-[color:var(--ink)]">Check your inbox</p>
    <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
      We sent a sign-in link to <strong>{email}</strong>. After you confirm, we&apos;ll take you to checkout.
    </p>
    <div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--line-ivory)] bg-[color:var(--bg)] px-4 py-3">
      <p className="text-sm font-medium text-[color:var(--ink)]">
        {plan === 'annual' ? 'Annual' : 'Monthly'} plan — {plan === 'annual' ? '$8/mo, billed $96/year' : '$12/mo'}
      </p>
      <p className="mt-1 text-xs text-[color:var(--ink-faint)]">
        7-day free trial — no charge until day 8
      </p>
    </div>
  </div>
) : (
```

No new state, no new step — same `sent` boolean, same render branch, just the added plan/price recap
block reusing `plan` (already in scope in this component).

---

## R3 — Path 3 (Google OAuth): no change

Confirmed, not re-litigated: discovery's own D3 already resolved this with fresh reasoning against
`openai/gpt-5.2-codex`'s dissenting "add a step everywhere" recommendation — the same-session,
no-context-loss argument holds. **Zero markup change to the Google OAuth button or its `callbackUrl`.**

---

## R4 — Trust line near the price card (D4)

Exact addition to `_form.tsx`, directly under the existing price card (after line 112, before the
`<form onSubmit={handleSubmit}>` block):

```tsx
<p className="mb-4 text-center text-xs text-[color:var(--ink-faint)]">
  Secure checkout via Stripe · 7-day free trial · cancel anytime, no charge until day 8
</p>
```

One line, real processor name, real mechanics already true elsewhere on this same page (not a new
claim) — no badge iconography, consistent with the discovery doc's restraint-over-decoration
constraint.

---

## R5 — Surface the "≥30% below 60-day median" claim on-page (D5)

Currently only in `page.tsx`'s `<meta name="description">` — invisible to an actual visitor. Add as
the last item appended to `_form.tsx`'s `FEATURES` array (rendered by the existing `.map()`, no new
markup needed beyond the array entry):

```tsx
const FEATURES = [
  'Unlimited hotel deal alerts across 20 destinations', // also fixes D6, see below
  'Email the moment prices drop below your target',
  'Full price history — know if a deal is real',
  'Every alert is 30%+ below its 60-day median price',
  'Cancel anytime, no questions asked',
]
```

Placed as the second-to-last item (before the cancellation-policy line, which reads best as the
closing item) — a specific, verifiable claim already proven true by the metadata description that
generates it, not a new number invented for this screen.

---

## R6 — Fix the destination-count inconsistency (D6)

Verified directly against `lib/trackedMarkets.ts`: `TRACKED_MARKETS` has **20** entries. `page.tsx`'s
metadata ("20 destinations") is the correct number; `_form.tsx:8`'s FEATURES list ("19
destinations") is wrong. Fixed inline in R5's replacement `FEATURES` array above
("...across 20 destinations") — no separate change needed beyond that single-array edit.

---

## Constraints re-confirmed

- R1/R1b are the only route-behavior change (`page.tsx`) — bundled together since they share one
  conditional, exactly as the discovery doc specified.
- R2, R4, R5, R6 are copy/data additions inside `_form.tsx`'s existing render tree and one array
  literal — no new component, no new client state, no route change.
- R3 is an explicit no-change directive.
- D7 stays unimplemented — no real customer-savings data exists in this codebase to back it.
- No fabricated price, no fabricated stat, no new required prop, no float for money, no change to
  `app/api/stripe/checkout/route.ts`'s session-creation logic.

---

## Handoff

Next stage: `UI-JOIN-REDESIGN-01` (implementation). Both files (`app/join/page.tsx`,
`app/join/_form.tsx`) need the changes above. After implementation: `npx tsc --noEmit
--incremental false` must exit 0; `npm test -- --passWithNoTests` must exit 0 modulo the known
pre-existing `HotelSustainabilityCredentialEvidence.test.tsx` failure; `npm run build` must succeed
with `/join` in the route manifest. Then `TEST-JOIN-REDESIGN-01` (this session's own direct QA,
tracing all three signed-in-arrival branches — free/premium/signed-out — plus the destination-count
and trust-line additions) before shipping.
