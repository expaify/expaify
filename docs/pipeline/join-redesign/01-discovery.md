# UXD-JOIN-REDESIGN-DISCOVERY-01 — Discovery + Competitive Analysis

**Stage:** UXD (UX Discovery) — docs only, no code changed, no commit.
**Scope:** `app/join/page.tsx` (31 lines) + `app/join/_form.tsx` (165 lines) — expaify's signup page,
plus the redirect target it hands off to, `app/api/stripe/checkout/route.ts`, read for context only
(not in scope to redesign).

**Why this doc exists / how it differs from the two prior redesign stages:** the DealCard stage
(`docs/pipeline/premium-redesign/01-discovery.md`) was a top-of-funnel trust/first-impression
problem; the `/account` stage (`docs/pipeline/account-redesign/01-discovery.md`) was a returning-
subscriber utility-page problem. `/join` is different again — it is the page where a visitor
becomes a paying customer, and it hands off, in every real path, to a third-party page (Stripe)
that expaify does not control. This stage carries a specific, explicit question from the requester
that is answered with real evidence before anything else: **does redirecting straight to Stripe
checkout with no expaify-owned confirmation step actually hurt trust/conversion, or is that concern
unfounded?** Same rigor as both prior stages: real `WebSearch`/`WebFetch` research with citations,
real multi-model comparison via Krater, honest weighting rather than one model's default reasoning.

---

## 1. The problem (UXD deliverable)

**One-sentence pain point:** `/join` hands the user off to Stripe's own hosted checkout page with
zero expaify-owned confirmation step in between — and that handoff is not one uniform behavior but
three genuinely different situations with three different real gaps, only two of which are actually
evidenced problems.

**Who's affected, and at what step — verified directly in the real code, not assumed:**

1. **Already-signed-in free users who land on `/join` directly** (e.g. from an account or deal-page
   upsell link) — `page.tsx:24`: `if (session?.user?.id) redirect('/api/stripe/checkout?plan=${plan}&redirect=true')`.
   This fires **before any JSX renders**. There is no plan, no price, no page — the user's browser
   goes from wherever they clicked the upsell link straight to a Stripe-hosted page. This is the
   only one of the three paths with **zero** expaify-owned surface at the moment of redirect.

2. **First-time visitors via magic-link email** — `_form.tsx:28-32`: `signIn('resend', { email,
   redirect: false, callbackUrl: '/api/stripe/checkout?plan=${plan}&redirect=true' })`. These users
   *do* see plan + price on `/join` itself before submitting their email (`_form.tsx:100-112`, the
   price card showing `$8 / month, billed $96/year` or `$12 / month` + "7-day free trial — no charge
   until day 8"). But then they leave the tab, open an email client — possibly a different device or
   browser session entirely — click the link, and land straight on Stripe. The interstitial they see
   in between, `_form.tsx:68-74` ("Check your inbox" / *"We sent a sign-in link to **{email}**. After
   you confirm, we'll take you to checkout."*), does not restate the plan or price they picked.

3. **First-time visitors via Google OAuth** — `_form.tsx:141`: `signIn('google', { callbackUrl:
   '/api/stripe/checkout?plan=${plan}&redirect=true' })`. Same-session: the user saw plan/price
   seconds earlier on the same page, clicks "Continue with Google," authenticates, and is
   immediately sent to Stripe. No context loss, no device switch, no time gap.

**The actual redirect target, read directly (`app/api/stripe/checkout/route.ts`):** the `GET`
handler (used as the magic-link/Google callback) builds a Stripe Checkout Session with
`mode: 'subscription'`, `trial_period_days: 7`, and the selected price, then issues a `302` straight
to Stripe's own hosted URL (`route.ts:115-136`). Stripe's own checkout page *does* show the price —
but it is Stripe-branded, off-product, and is the very first time signed-in-direct-hit users (path 1
above) see any price at all in this flow.

**Three additional real defects, verified directly against the source this session (not assumed —
two surfaced by this stage's own Krater comparison, then independently confirmed against the actual
files; the third found directly in this stage's own initial read):**

- **`/join` is a public, indexed, canonicalized page — its audience is broader than the code comment
  assumes.** `page.tsx:7-11` sets `alternates: { canonical: 'https://expaify.com/join' }` plus its
  own SEO title/description. The comment directly above the redirect (`page.tsx:22-23`) says
  *"Signed-in free users land here from account/deal upsells"* — but a canonical, indexed URL is also
  reachable via organic search, a bookmark, or a shared link, none of which carry any purchase intent
  established in *this* session. Path 1's confirmation void is not just "zero context for upsell
  clickers" — it's zero context for anyone who lands here, and the code's own framing undercounts
  who that is.
- **The redirect guard checks session, not entitlement — an active subscriber can be pushed into a
  second Stripe Checkout Session.** `page.tsx:24`'s condition is `session?.user?.id` only. `lib/
  subscription.ts:23-24` defines `isPremium(status) { return status === 'trialing' || status ===
  'active' }`, and `app/api/stripe/checkout/route.ts:61-62,85-89`'s `createCheckoutUrl` calls
  `getSubscription(userId)` only to reuse an existing Stripe customer ID — neither `page.tsx` nor the
  checkout route ever calls `isPremium()` or blocks on subscription status. An already-trialing or
  already-active subscriber who lands on `/join` (e.g. a stale bookmark, or the SEO-indexed URL above)
  is not redirected to `/account` — they're pushed straight into creating a **second** Checkout
  Session for a subscription they already have.
- **The destination count is inconsistent between two places on the same route.** `page.tsx:9`'s
  metadata description states *"20 destinations"*; `_form.tsx:8`'s `FEATURES` list states *"19
  destinations."* Two different numbers, in the same page, describing the literal thing the
  subscription buys — a real, live inconsistency, not a hypothetical.

**3 constraints the solution must respect:**

1. **Real friction has a real, measured cost.** Baymard: 17% of US online shoppers have abandoned an
   order specifically due to a "too long / complicated checkout process"
   ([baymard.com/lists/cart-abandonment-rate](https://baymard.com/lists/cart-abandonment-rate)).
   Any directive that adds a step must not be a blanket "add a confirmation page everywhere" — for
   paths where the user already just saw the price seconds ago in the same session, an extra
   mandatory click is a pure friction cost with no offsetting trust benefit.
2. **The gap is not uniform — the fix can't be either.** Path 1 has a real, total void (nothing
   expaify-owned renders at all). Path 3 has almost no gap (same session, seconds-old context). Path
   2 sits in between (context is shown once, then a device/time gap intervenes). Treating all three
   identically — either "leave all as-is" or "add a confirmation step everywhere" — ignores evidence
   this stage gathered specifically to distinguish them.
3. **Prop-contract / route-contract stability.** `/join`'s redirect logic and the checkout route's
   `GET`/`POST` handlers are consumed by other real callers (`page.tsx`'s upsell redirect target,
   account-page upgrade buttons per `docs/pipeline/account-redesign/01-discovery.md`'s own findings).
   Any directive that changes what `page.tsx:24` or the `callbackUrl` values point to is a
   **route-behavior change**, not a markup change, and must not break those other call sites.

**Success statement:** *This is solved when a first-time or returning user can look back on how they
got from clicking "join"/"upgrade" to landing on Stripe's payment page and know exactly what plan and
price they were about to commit to at every point along that path — without expaify adding a
mandatory extra click for the one path (Google OAuth) where the evidence shows that click would be
pure friction with no offsetting trust benefit.*

---

## 2. The specific question: is the direct-to-Stripe redirect a real problem? (Step 1)

Real, current, cited research — not assumption.

1. **Baymard Institute, Research Guideline #2363 "Third-Party Payment Flows" and #672 "Third-Party
   Payment Flow Design"**
   ([baymard.com/guidelines/2363-third-party-payment-flows](https://baymard.com/guidelines/2363-third-party-payment-flows),
   [baymard.com/guidelines/672-third-party-payment-flow-design](https://baymard.com/guidelines/672-third-party-payment-flow-design)):
   both guidelines are paywalled beyond their public issue statement (same paywall structure the
   `/account` stage hit and correctly cited as a real, current, authoritative — if partially gated —
   source). The publicly visible issue text for #672, quoted directly: *"Selecting a third-party
   payment option at checkout typically funnels users temporarily off-site following the Payment
   step, which can be surprising and disorienting."* The publicly summarized guidance for #2363: do
   not aggressively funnel users into off-site flows; **users must deliberately opt in, not face an
   unexpected redirect**; when a third-party flow is triggered, the UI should signal it (e.g. update
   the primary button/CTA) so the user isn't surprised by leaving the site.
   **Direct, verified application to the real code:** Path 1 (`page.tsx:24`) is the one case that
   squarely fails this guideline — the redirect fires with **no deliberate user action at all** in
   this session; the user didn't click a CTA that said anything about payment, checkout, or leaving
   expaify. Paths 2 and 3 both originate from an actual click ("Start free trial" / "Continue with
   Google") on a page that already showed the price, which is closer to — though not identical to —
   the "deliberate opt-in" Baymard describes.

2. **Baymard — cart/checkout abandonment reasons**
   ([baymard.com/lists/cart-abandonment-rate](https://baymard.com/lists/cart-abandonment-rate)):
   two real, cited, opposing-direction stats matter here. **17%** of US online shoppers abandon due
   to a "too long / complicated checkout process" — the friction cost of adding steps is real and
   measured, not hypothetical. Separately, **19%** abandon because they "didn't trust the site with
   my credit card information" — but this stat is about trusting *a site* directly with card data
   entered on that site; it does not squarely describe distrust of being sent to a *well-known,
   trusted third-party processor* like Stripe, which is arguably more reassuring than an unfamiliar
   site's own card form. **This cuts against treating "add a confirmation step" as a costless win** —
   it has a real, evidenced conversion cost, and the trust stat most often cited to justify adding
   friction doesn't map cleanly onto this specific situation.

3. **Redirect vs. embedded checkout completion-rate claim (weak source, used cautiously):** a
   `whop.com` vendor blog states "industry benchmarks put redirect checkout completion at roughly 35
   to 45%, while embedded checkout typically completes at 50 to 65%" — verified via direct fetch that
   this claim is **uncited and unattributed to any named research org (not Baymard, not anyone)**,
   and whop.com itself sells embedded-checkout infrastructure, a direct conflict of interest. This is
   recorded as a data point that exists and is *directionally* consistent with the Baymard guidance
   above, but it is explicitly **not** treated as a reliable, standalone statistic — same discipline
   the DealCard stage applied when it excluded Hopper as a reference due to a documented conflict of
   interest, and the same discipline the account-redesign stage applied when ruling out sources for
   lacking citable specifics.

4. **Going.com — expaify's own previously-established closest direct competitor**
   (per `docs/pipeline/premium-redesign/01-discovery.md`'s own research, reused here as the correct
   comparison class): fetched `going.com/signup` directly this session. It **redirects off-domain**
   for its own signup — to `auth.going.com/authorize` (an Auth0-hosted identity page) — before any
   payment step is reached. **This is a real, verified finding that complicates a blanket
   "redirecting off-domain is inherently unpremium" claim**: even a competitor whose brand identity
   was rebuilt specifically around premium restraint (per the DealCard stage's own research on
   Going's 2023 rebrand) uses an off-domain redirect as a normal part of its flow. The Baymard
   guidance above is specifically about the **payment** step being surprising, not about off-domain
   redirects as a category — auth redirects (Going→Auth0, expaify→Google) are a different, more
   widely-accepted pattern than an unannounced payment redirect.

5. **Baymard — "Simplifying Sign Up" / passwordless, minimal-field signup**
   ([baymard.com/blog/simplifying-sign-up](https://baymard.com/blog/simplifying-sign-up),
   [baymard.com/blog/fast-and-easy-user-sign-up](https://baymard.com/blog/fast-and-easy-user-sign-up)):
   recommends collecting only what's necessary at signup and offering passwordless options —
   specifically citing "email address only, then a magic link" as a valid pattern. **Cross-checked
   against the real code — a genuine positive finding:** `_form.tsx`'s magic-link flow (single email
   field, no password) already matches this guidance exactly. This is not part of the problem; it
   should not be changed.

### Direct answer to the specific question (non-hedging, per-path — this is a business-logic-adjacent
### recommendation, not visual polish; flagged explicitly in Section 4)

- **Path 1 (signed-in user hits `/join` directly → instant redirect, `page.tsx:24`): the concern is
  real, and evidenced. Add a lightweight, expaify-owned confirmation step here.** There is currently
  a total void — no page, no price, no plan, no expaify branding at the exact moment a real payment
  commitment is about to be made. This is not "adding friction to an existing fast path" in the way
  Baymard's 17% abandonment stat warns against, because **there is no existing page for a user to
  compare it to** — the friction cost of inserting one screen where zero currently render is close to
  the cost Baymard's own guideline #2363 already tells you to pay (deliberate opt-in beats surprise).
  This is the single clearest, best-evidenced case for a real behavior change in this entire
  investigation.

- **Path 2 (magic-link): the concern is real but the fix is smaller than a new confirmation page.**
  Plan/price were already shown once, on `/join`, before the email was sent — that satisfies
  Baymard's "deliberate opt-in" bar at the moment of the original click. The actual gap is narrower
  and more specific: the **existing** "Check your inbox" interstitial (`_form.tsx:68-74`) already
  costs zero additional flow-length (the user is leaving the tab regardless, to check email) and
  already exists — restating the plan/price/trial terms there is a copy change to a screen that's
  already shown, not a new step, so it does not carry the 17% "too-long-checkout" friction cost.
  This is the highest-value, lowest-risk fix of the three.

- **Path 3 (Google OAuth, same session): do not add a mandatory confirmation step.** This is the one
  path where the evidence argues for leaving the direct-to-Stripe redirect exactly as-is. The user
  saw plan and price seconds earlier, in the same tab, in the same session — Baymard's "deliberate
  opt-in" condition is already satisfied by the original "Start free trial"/plan-toggle interaction,
  and Google's own OAuth consent screen functions as a de facto "are you sure" checkpoint in between.
  Inserting a mandatory extra click here has no evidenced trust upside (nothing was forgotten — no
  time or device gap occurred) and a real, Baymard-measured friction cost (the 17% stat). This is a
  case where more confirmation would be over-correction, not a fix.

**Recommendation, stated plainly:** add a lightweight, expaify-owned confirmation step for Path 1
(the true void) and restate plan/price on the existing inbox-wait screen for Path 2 (a copy addition
to a screen that already exists, not a new step) — do not add anything to Path 3. This is a real
flow/business-logic change for Path 1 specifically (it changes what `page.tsx:24` does, replacing an
unconditional `redirect()` with a rendered confirmation screen that itself redirects to
`/api/stripe/checkout` only after a real user click) — **flagged explicitly per this stage's own
instructions as higher-risk than visual polish, since it touches the actual conversion funnel and the
checkout code path, and needs explicit confirmation before implementation.** Path 2's fix is a pure
copy/data change to existing JSX (no route/redirect-target change). Path 3 requires no change at all.

---

## 3. Beyond the redirect question — page-level competitive research (Step 2)

1. **Trust-signal research, 2026 sources**
   ([scalify.ai/blog/website-trust-signal-statistics-what-makes-visitors-stay-2026](https://www.scalify.ai/blog/website-trust-signal-statistics-what-makes-visitors-stay-2026),
   [digitalapplied.com/blog/social-proof-trust-signals-2026-conversion-placement-framework](https://www.digitalapplied.com/blog/social-proof-trust-signals-2026-conversion-placement-framework)):
   refund/money-back guarantees measured at +12–18% conversion even though few people claim them;
   visible social proof measured at +15–25% on pricing-adjacent pages; placement matters more than
   presence — trust signals belong near the actual decision point, not scattered generically.
   **Cross-checked against the real code:** `_form.tsx` has **zero** trust signals anywhere —  no
   money-back/refund mention (the trial is "cancel before day 7 and pay nothing," which is not the
   same claim as a refund guarantee), no social proof, no security/payment-processor mention before
   the point of commitment. This is a real, verified gap, not an assumption.

2. **Baymard — discount/price display + this stage's own Section 2 findings, reapplied:** the price
   card (`_form.tsx:100-112`) already does the mechanically correct thing (price + billing cadence +
   trial terms grouped in one block) — consistent with the DealCard stage's own prior finding that
   expaify's price *mechanics* tend to already be sound; the gap here is informational completeness
   (no processor/security mention) and reinforcement (nothing restated post-submission), not price
   display mechanics.

3. **Going.com, reused as the correct competitor class (per Section 2, finding 4):** Going's own
   marketing (per this stage's `WebSearch`, `viatravelers.com`/`myglobalviewpoint.com` review
   summaries, cross-referenced against the DealCard stage's existing citation of Going's 2023
   rebrand) leads with a concrete, verifiable claim ("$49/year", specific alert-frequency/coverage
   promises) rather than generic trust badges. expaify's `_form.tsx` FEATURES list already does this
   correctly (`'Unlimited hotel deal alerts across 19 destinations'`, `'Full price history — know if
   a deal is real'`) — this is a genuine positive finding, not a gap.

4. **Typography/visual system:** `_form.tsx` uses the same `--font-display`/`--font-sans` (Space
   Grotesk/Inter) and warm-ivory (`--bg`, `--surface`, `--ink`) tokens the DealCard stage already
   flagged (D4 in `docs/pipeline/premium-redesign/01-discovery.md`) as "functional but carries no
   distinctive identity." That finding and its directive (a single licensed sans-serif system,
   tabular figures) already covers `/join` — this stage does not need to re-litigate typography, only
   confirm `/join` inherits the same gap and the same directive applies here once D4 ships elsewhere.

**What was deliberately not used:** generic password/field-count "reduce your form" advice — already
confirmed a non-issue (`_form.tsx` is a single email field); adding more generic SaaS-landing-page
trust-badge stock photography would contradict the DealCard stage's Airbnb/Going-grounded "restraint,
not decoration" finding, so any trust-signal directive below is scoped to specific, verifiable
claims, not generic badge iconography.

---

## 4. Real Krater model comparison (Step 3)

Called `https://api.krater.ai/v1/chat/completions` directly (OpenAI-compatible), same system prompt
+ same detailed user prompt — embedding the real `page.tsx`/`_form.tsx`/checkout-route source, the
three-path breakdown of the redirect question, and all research above — sent to three models
(`max_tokens: 6000`, `reasoning: {"effort": "low"}`, the same combination the two prior stages
tonight found reliably completes `openai/gpt-5.2-codex` within Krater's ~120s gateway timeout). Key
rotation (`KRATER_API_KEY`, `_2`, `_3`) was available; verified present (3 keys in
`~/.config/krater/credentials`) and used one key per call.

| Model | Result | Notes |
|---|---|---|
| `openai/gpt-5.2-codex` | Complete, clean (a)/(b)/(c) response, `finish_reason: stop`, 1,846 completion tokens, ~32s | Disciplined, implementation-literal; the one dissent worth recording below |
| `anthropic/claude-opus-5` | Hit `max_tokens` (`finish_reason: length`) but still emitted 7,564 chars of formatted `content` before cutting off mid-directive-2-of-(b); 3,366-token reasoning trace behind it | Richest and most code-specific of the three — surfaced two real, independently-verified findings neither of the other two models produced |
| `deepseek/deepseek-v4-pro` | Hit `max_tokens` fully inside its own reasoning (`finish_reason: length`, 6,000/6,000 reasoning tokens spent, **zero** formatted `content` emitted); 26,977-char reasoning trace | Reaches the same structural conclusions as the other two but visibly hedges throughout ("Need decide," "Hmm," "maybe too minor"); one corroborating idea kept, explicitly caveated |

*(Full raw responses preserved in the session's scratchpad — `krater_join_gpt5.2-codex.json`,
`krater_join_opus5.json`, `krater_join_deepseek.json` — not committed, this stage is docs-only.)*

### What each model actually said

**`openai/gpt-5.2-codex`** (complete answer):
- **Per-path answer:** recommended adding an expaify-owned confirmation step (plan + price + trial +
  a "Continue to secure Stripe checkout" CTA) for **all three paths**, including Google OAuth —
  reasoning that a same-session OAuth→Stripe handoff still reads as a "double redirect" surprise
  (Google, then Stripe) even though the user saw price seconds earlier.
  **This is a real, reasoned disagreement with this document's own Section 2 conclusion for Path 3**,
  not something to silently override — recorded here explicitly. This document's position (leave
  Path 3 as-is) is kept because it is grounded in the specific, cited Baymard friction stat (17%
  abandonment from added checkout steps) applied to the one path with no evidenced context loss,
  whereas gpt-5.2-codex's "double redirect" concern, while plausible, cites no specific evidence
  distinguishing a same-session OAuth handoff from Path 1's genuine no-context-at-all void — it
  applies the same fix to all three paths rather than differentiating by evidence, which is exactly
  the "don't give one blanket answer" instruction this document's own Krater prompt asked every model
  to avoid, and only gpt-5.2-codex fully didn't follow that instruction for Path 3.
- **Page-level directives:** (1) a "what happens next" 3-step micro-copy row (choose plan → verify →
  pay securely on Stripe) directly under the CTA; (2) a small trust line near the plan toggle
  ("Secure checkout powered by Stripe. 7-day free trial. Cancel anytime."); (3) restate plan/price/
  trial terms in the "Check your inbox" state — independently reaching the same conclusion as this
  document's own Section 2 Path-2 recommendation; (4) surface the metadata's "≥30% below 60-day
  median" claim on-page as a credibility line, since it currently only exists in `<meta>` and is
  invisible to an actual visitor; (5) explicitly: no new form fields, keep the email-only magic-link
  flow — citing the same Baymard "Simplifying Sign Up" source this document used.
- **What it flagged as high-risk:** correctly separated "add a confirmation step / remove the
  automatic redirect" (flow/logic, high-risk) from the four copy/trust-line additions (low-risk) —
  same split this document reaches for Paths 1–2, differing only on whether Path 3 needs it too.

**`anthropic/claude-opus-5`** (formatted content, cut off mid-answer but the furthest of the three
into genuinely new ground):
- **Per-path verdict, sharper than gpt-5.2-codex on Path 1:** independently reached "change Path 1,
  leave Path 3 as-is" — agreeing with this document's own Section 2 conclusion, not gpt-5.2-codex's
  blanket-all-three-paths position — but added a finding neither this document's own audit nor
  gpt-5.2-codex caught: **`/join` is a public, indexed, canonicalized URL**
  (`page.tsx:10`, `alternates: { canonical: 'https://expaify.com/join' }`, with its own SEO title/
  description). The page's own code comment claims arrivals are "signed-in free users [who] land
  here from account/deal upsells," but a canonical, indexed URL also catches organic search clicks,
  bookmarks, and shared links — arrivals with **no purchase intent established in this session at
  all**. That materially strengthens the case that Path 1 is the one real defect, since it's not just
  "zero confirmation" but "zero confirmation for an audience broader than the code's own comment
  assumes."
- **A genuine, previously-unflagged bug, independently verified against the real code this session:**
  `page.tsx:24`'s guard is `if (session?.user?.id)` — checking that a session exists, not that the
  user lacks an active subscription. Cross-checked directly against `lib/subscription.ts:23-24`
  (`isPremium(status) { return status === 'trialing' || status === 'active' }`) and
  `app/api/stripe/checkout/route.ts:61-62,85-89` (`createCheckoutUrl` looks up
  `getSubscription(userId)` only to reuse `existingCustomerId` — it never calls `isPremium()` or
  blocks on status): **an already-paying or already-trialing subscriber who lands on `/join` is not
  blocked and is pushed straight into creating a second Stripe Checkout Session**, with no code path
  stopping it. This is a real correctness gap, not a hypothetical — verified directly in this
  session's own source read, not assumed from the model's claim.
- **Two coordinated fixes for Path 1** (beyond this document's own D1): (1) render a compact
  confirm view in place of the deleted redirect — plan, price, trial terms, one primary CTA; (2) "move
  the intent to the referrer" — have the actual upsell buttons on `/account` and deal pages link
  straight to `/api/stripe/checkout` themselves (with the price named on the button), so `/join`
  itself stops being the thing genuinely-opted-in users pass through silently, while still requiring
  the confirm view for the broader, lower-intent audience (organic/bookmark/shared-link) `/join`'s
  canonical-URL status actually serves.
- **Path 2:** same core direction as this document's own D2 and gpt-5.2-codex, but went further —
  restate plan/price in the **magic-link email body itself** (highest-leverage surface, since it's
  guaranteed to be seen at click time, unlike a page rendered after the click) in addition to an
  expaify-owned confirm route, and explicitly argued the Baymard 17% friction stat **does not apply**
  here because it describes multi-step form-filling checkouts, not one zero-input tap presenting a
  price the user already agreed to.
- **Path 3:** agreed with this document's own D3 (no flow change) for the same reasoning (same
  session, price just seen, Going.com's own off-domain Auth0 redirect as precedent that off-domain
  hops aren't inherently unpremium) — but added a real caution worth carrying into the risk-flagging
  section: if a future implementation routes Google through the same `/join/confirm` view as the
  other paths purely for code simplicity, "that's defensible engineering — but it is a funnel change
  on your fastest-converting path and should be A/B tested, not shipped on the assumption that
  consistency is free."
- **Page-level finding (cut off before finishing, but the one clean directive it completed is a real,
  independently-verified defect):** `page.tsx:9`'s metadata description says **"20 destinations"**;
  `_form.tsx:8`'s `FEATURES` list says **"19 destinations"** — two different numbers, in the same
  route, describing the literal thing the subscription buys. Verified directly against both files
  this session — a real, live inconsistency, not a hypothetical.

**`deepseek/deepseek-v4-pro`** (from its 26,977-character reasoning trace — spent its entire 6,000-
token budget on reasoning and emitted zero formatted `content`):
- Reached the same structural per-path conclusions as the other two (change Path 1, change Path 2 via
  an expaify-owned confirm step and restated email/interstitial copy, leave Path 3's redirect alone
  but add a signal), with visibly more hedging throughout ("Need decide," "Hmm," "maybe too minor," a
  full paragraph second-guessing whether the destination-count fix is "too specific" to include) —
  consistent with the hedging pattern both prior pipeline stages flagged for this model.
- One idea worth keeping, explicitly self-caveated by the model itself: a single real-member
  testimonial with a concrete result ("Saved $217 on 5 nights in Barcelona") rather than a generic
  quote or star-rating widget — but deepseek's own reasoning immediately flags this "must be real; use
  actual [customer] data," i.e. it cannot be fabricated copy. Given this codebase's documented data-
  integrity discipline (no invented stats, per every prior pipeline stage's constraints section), this
  is folded in only as a **directional idea for UXDES to validate against real customer data**, not a
  directive with placeholder copy of its own.
- No genuinely new code-level finding comparable to opus-5's entitlement-check bug or destination-
  count mismatch — its contribution is corroboration plus one caveated idea, not new ground.

### Verdict — how the three were weighted

**This is the first of the three pipeline stages tonight where opus-5, not gpt-5.2-codex, is the
structural backbone for the per-path answer (Section a).** gpt-5.2-codex finished cleanly and is kept
as the backbone for Section (b)'s page-level directives (its four page-level ideas are concrete,
implementation-literal, and two of them — restate plan/price on the inbox screen, keep the
passwordless form as-is — independently corroborate this document's own Section 2 research). But on
the specific question this stage exists to answer, gpt-5.2-codex gave one answer to all three paths
("add a confirmation step" for Path 1, 2, *and* 3), which is exactly the "don't give one blanket
answer" failure mode its own prompt was written to catch. opus-5 independently reached this document's
own differentiated position (change 1 and 2, leave 3) *and* supplied two real, independently-verified
code findings — the canonical/indexed-URL audience point and the entitlement-check bug — that neither
this document's own initial audit nor gpt-5.2-codex produced. The first is folded directly into D1's
reasoning below; the entitlement-check bug becomes its own directive, D1b — both treated as load-
bearing, not optional flavor, because both are verified against the actual source in this session,
not taken on the model's word.

**deepseek is weighted down, not discarded**: its structural conclusions corroborate the other two
(useful as a third independent check that Path 1/2/3 differentiation is the right shape of answer),
and its one distinct idea (a real-customer testimonial) is kept but explicitly gated on real data,
consistent with how deepseek's ideas were handled in both prior stages — mined for anything concrete,
never trusted for synthesis discipline.

This is a real synthesis across two of the three sources (opus-5's differentiated per-path answer +
code-level findings, gpt-5.2-codex's finished page-level directives), with deepseek's one idea folded
in under an explicit data-integrity caveat and its blanket per-path position explicitly not adopted —
not a coin flip, not one model's answer taken wholesale.

---

## 5. Final synthesized problem statement + directives

**Problem statement (final):** `/join`'s handoff to Stripe checkout is not one problem but three
genuinely different situations wearing the same code path — a total confirmation void for
already-signed-in users hitting the page directly (`page.tsx:24`), a context/device gap for
magic-link users whose plan and price go unstated the moment they actually need reminding
(`_form.tsx:68-74`), and a same-session handoff for Google-OAuth users that already satisfies the
real evidence bar (Baymard's "deliberate opt-in," satisfied by the original plan-selection click).
Treating all three the same — either leaving all as-is or adding a confirmation screen everywhere —
ignores the evidence this stage gathered specifically to tell them apart.

**Directives (D1–D7):**

- **D1 — Add an expaify-owned confirmation step for Path 1 only (already-signed-in users hitting
  `/join` directly).** *(Baymard guidelines #2363/#672, directly verified against `page.tsx:24`'s
  unconditional `redirect()`; strengthened by opus-5's independently-verified finding that `/join`
  is a canonical, indexed URL — `page.tsx:10` — reachable by organic search/bookmark/shared-link
  traffic, not only the upsell clicks the code's own comment assumes.)* Replace the instant
  `redirect()` with a rendered screen showing plan, price, trial terms, and a single primary CTA
  ("Continue to secure Stripe checkout") that itself performs the redirect to
  `/api/stripe/checkout?plan=...&redirect=true` only after a real click. **This is a real
  route-behavior change — flagged explicitly as higher-risk, funnel-touching, and requiring explicit
  confirmation before implementation**, per this stage's own instructions; it is not a styling
  change.

- **D1b — Fix the entitlement-check gap `/join`'s redirect guard has: it must not push an already-
  premium user into a second Checkout Session.** *(opus-5's finding, independently verified this
  session directly against `page.tsx:24`, `lib/subscription.ts:23-24`'s `isPremium()`, and
  `app/api/stripe/checkout/route.ts:61-62,85-89` — none of which ever call `isPremium()` on this
  path.)* Whatever D1 renders for a signed-in user must branch on subscription status first: an
  active or trialing subscriber should be routed to `/account` (they already have what `/join` is
  selling), not into a new Stripe Checkout Session. This is a correctness fix bundled with D1, not a
  separate route change — flagged under the same higher-risk/funnel-touching umbrella as D1, since it
  touches the same conditional.

- **D2 — Restate plan/price/trial terms on the existing "Check your inbox" screen (Path 2).**
  *(This document's Section 2 Path-2 analysis, independently corroborated by gpt-5.2-codex and
  opus-5.)* `_form.tsx:68-74`'s sent-state copy currently only names the email address. Add the
  selected plan, price, and trial terms to that existing message. This is a copy/data change to a
  screen that already renders — it adds no new step and does not carry the 17%-abandonment friction
  cost D1's justification explicitly excludes it from. *(opus-5 additionally proposed restating
  plan/price in the magic-link email body itself, the surface most likely to actually be read at
  click time — worth UXR/UXDES evaluating as a stronger version of this same directive, though it
  touches email-template content this stage did not audit.)*

- **D3 — Leave Path 3 (Google OAuth) exactly as-is; do not add a mandatory confirmation step.**
  *(This document's own evidence-based position, independently corroborated by opus-5 — both citing
  the same-session/no-context-loss reasoning and Going.com's own off-domain-Auth0-redirect precedent
  — and recorded as a genuine, reasoned disagreement with gpt-5.2-codex's blanket recommendation to
  add a step here too; see Section 4.)* The next stage (UXR) should weigh this disagreement with
  fresh eyes rather than inherit this document's conclusion uncritically, same discipline the
  account-redesign stage used for its own D6 section-order disagreement. A microcopy-only signal
  under the Google button (naming Stripe as the next step) is a low-risk companion change; opus-5's
  caution should also carry forward — if a later implementation routes Google through the same
  confirm view as Path 1/2 purely for code simplicity, that is a real funnel change on the
  fastest-converting path and should be tested, not assumed harmless.

- **D4 — Add a specific, verifiable trust line near the point of commitment; do not add generic trust
  badges.** *(Trust-signal research, Section 3 finding 1, independently corroborated by both
  gpt-5.2-codex and opus-5, scoped by the DealCard stage's own restraint-over-decoration finding.)*
  Add one line naming the processor and the real trial mechanics ("Secure checkout via Stripe ·
  7-day free trial · cancel anytime, no charge until day 8") near the plan/price card and/or the
  submit button — not a badge wall, not stock security-icon iconography.

- **D5 — Surface the "≥30% below 60-day median" claim on-page; it currently only exists in
  `<meta>`.** *(gpt-5.2-codex's contribution, verified against `page.tsx:9`'s metadata description,
  which contains this exact claim but nothing in `_form.tsx`'s rendered JSX does.)* Add it as a
  concrete credibility line under the feature list — a specific, verifiable claim, consistent with
  how the DealCard and Going research both favor concrete claims over generic trust iconography.

- **D6 — Fix the destination-count inconsistency: "20 destinations" (`page.tsx:9`) vs. "19
  destinations" (`_form.tsx:8`).** *(opus-5's finding, independently verified this session against
  both files.)* Two different numbers on the same route describing the literal thing being sold is a
  direct, avoidable hit against the same trust research D4 is grounded in (Baymard's 19%
  don't-trust-the-site-with-payment-info abandonment reason). Derive one number from the actual
  destinations data source and use it in both places — do not hand-pick whichever number sounds
  better.

- **D7 (directional only, not a directive to implement as-is) — a real-customer proof point, if and
  only if real data exists to back it.** *(deepseek's one distinct idea, explicitly self-caveated by
  the model itself as needing real customer data.)* A specific result ("Saved $X on N nights in
  [city]") would out-perform generic social-proof widgets per the trust-signal research in Section 3
  — but this codebase's standing data-integrity discipline (no fabricated stats, reconfirmed by every
  prior pipeline stage) means this cannot ship as placeholder or invented copy. UXR should confirm
  whether real, attributable customer savings data exists before this becomes a real directive.

**Constraints re-confirmed against all seven directives:** D1 and D1b are the only directives that
change route/redirect behavior (`page.tsx:24`) — explicitly flagged per this stage's instructions as
needing confirmation before implementation, and bundled together since they touch the same
conditional. D2, D4, D5, D6 are copy/markup/data-consistency changes inside `_form.tsx`'s and
`page.tsx`'s existing render/metadata, none requiring a route change. D3 is an explicit "no change"
directive (with a low-risk microcopy companion). D7 is explicitly conditional on real data existing
and is not cleared for implementation as stated. None require a new required prop, a renamed export,
a float for money, or a change to `app/api/stripe/checkout/route.ts`'s actual session-creation logic
— only what happens *before* the redirect fires (and, for D1b, whether it fires at all for an
already-premium user) is in scope.

---

## Handoff

Per pipeline rules, this UXD stage does not create the next-stage ticket itself — the calling
process does that. Next stage is `UXR-JOIN-REDESIGN-01` (UX Research), which should read this doc,
re-audit the current `/join`/`_form.tsx`/checkout-route implementation directly, resolve the D3
disagreement with gpt-5.2-codex's Path-3 recommendation with fresh eyes, confirm whether real
customer-savings data exists to unlock D7, and produce 3–5 specific, testable design directives
building on D1–D7 above. **D1 and D1b in particular should not proceed to implementation without
explicit confirmation from the requester**, since together they change actual redirect behavior and
an entitlement-check gap in `page.tsx:24` — real funnel/business-logic and correctness changes, not
visual polish — consistent with how this document's own source prompt required this distinction to
be made explicit.
