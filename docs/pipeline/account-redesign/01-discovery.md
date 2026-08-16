# UXD-ACCOUNT-REDESIGN-DISCOVERY-01 — Discovery + Competitive Analysis

**Stage:** UXD (UX Discovery) — docs only, no code changed, no commit.
**Scope:** `app/account/page.tsx` (224 lines) + `app/account/AccountClient.tsx` (432 lines) — the
plan/subscription status card, the profile identity block, and the email-alert/watchlist
preferences UI (premium only).

**Explicitly out of scope, per the requester's own words ("no need to privacy and request data"):**
the Privacy section — data export and account-deletion. Confirmed, real line ranges in the current
source (not assumed): the `showPrivacy` render branch in `AccountClient.tsx:378-418`, its state
(`privacyLoading`, `privacySuccess`, `privacyError`, `AccountClient.tsx:103-105`), and the
`requestPrivacyAction()` handler (`AccountClient.tsx:202-226`), plus the Privacy `<section>` in
`page.tsx:213-220`. None of that code, copy, or interaction is touched, critiqued, or redesigned by
this document or its directives — it is treated as frozen. Everything else that actually exists on
the page (subscription/plan display across 4 states, profile/sign-in identity, alert frequency,
minimum-deal-size threshold, city watchlist) is in scope.

**Why this doc exists / how it differs from the prior redesign stage:** the just-completed
DealCard/homepage redesign (`docs/pipeline/premium-redesign/01-discovery.md`) was a top-of-funnel,
first-impression/trust problem on a marketing surface, and its research deliberately excluded
B2B/SaaS references (Linear, Vercel) in favor of consumer travel/booking precedent (Airbnb, Going,
Google Flights). `/account` is a structurally different surface — an authenticated settings/
billing-management page a user visits *after* they've already paid or signed up — so this stage
inverts that exclusion: the correct comparison class here is well-documented account/settings/
billing UI convention (Stripe's own customer portal, GitHub Primer's settings patterns, general
SaaS account-settings research), not travel marketing sites. Same rigor and process as the DealCard
work otherwise: real `WebSearch`/`WebFetch` research with citations, real multi-model comparison via
Krater, honest weighting rather than one model's default reasoning.

---

## 1. The problem (UXD deliverable)

**One-sentence pain point:** expaify's `/account` page cannot answer the one question a *returning,
already-paying* subscriber actually has — "what am I paying, and when" — because the only dollar
amount anywhere on the page is a hardcoded string literal shown solely during the trial state, the
plan card's visible shape changes completely across its four real states (trialing / active /
canceled / free) instead of teaching the eye a stable place to look, and the entire cancel /
payment-method / invoice-history surface is delegated off-product to Stripe with zero in-page
summary of what that delegation actually contains.

**Who's affected, and where:** existing subscribers — trialing, active, and canceled-but-not-yet-
lapsed users — who return to `/account` specifically to check on their subscription (not first-time
visitors; this is not a conversion/trust-at-first-glance problem the way DealCard was). Secondarily,
premium users managing alert preferences are affected by a narrower, separate issue: the city
watchlist is a flat, unsorted 20-item pill wall with no search, which is already borderline-
scannable and has no mechanism to stay usable as `TRACKED_MARKET_NAMES` grows.

**Measurable signal that the problem exists (verified directly in the real source this session, not
assumed):**
- `page.tsx:138` — the trial-countdown copy hardcodes the post-trial price as a bare string:
  `` You'll be charged ${sub.plan === 'annual' ? '8' : '12'}/mo unless you cancel before then. `` —
  this number is not sourced from Stripe's actual Price object, from `STRIPE_PRICE_MONTHLY`/
  `STRIPE_PRICE_ANNUAL` (which `app/api/stripe/checkout/route.ts:37-38` only knows as opaque Stripe
  Price *IDs*, never amounts), or from any field on `Subscription` (`lib/subscription.ts:8-13`, which
  has no `priceCents`/`currency`/interval field at all). If Stripe pricing ever changes, this literal
  silently goes stale and tells a trialing user the wrong dollar amount they're about to be charged.
- `page.tsx:143-152` — active and canceled subscribers see only a *date* (`Next billing: <date>` /
  `Premium access ends <date>`) and **no price anywhere on the page**. The one and only place a
  dollar figure appears is the trial-only banner above — meaning a subscriber who has been paying
  for 8 months cannot see what they pay without leaving expaify entirely for Stripe's hosted portal.
- `page.tsx:98-183` (the plan `<section>`) — the free-plan upsell paragraph and the real plan-status
  atoms (badge, trial countdown, billing date) live in the same undifferentiated card with no
  consistent internal structure; the card's content shape is genuinely different in all 4 states
  (trialing shows a countdown block, active shows one date line, canceled shows a different one-line
  message, free shows an upsell block + button) — there is no stable "status block" position for a
  returning user to learn.
- `AccountClient.tsx:341-373` — the "Cities I'm watching" grid renders all 20 entries of
  `TRACKED_MARKET_NAMES` (`lib/trackedMarkets.ts:9-30`) as a flat `flex-wrap` pill list in raw array
  order (Miami, New York, Cancún, Paris, Rome, Barcelona, Lisbon, London, Tokyo, Bangkok, Dubai, Las
  Vegas, Orlando, San Juan, Tulum, Amsterdam, Athens, Punta Cana, Charlotte, Nashville) — no
  alphabetical sort, no region grouping, no search/filter, with nothing in the data model capping
  further growth.

**3 real constraints the solution must respect (grounded in this page's actual code, not generic
boilerplate):**

1. **No fabricated or stale money.** `Subscription` (`lib/subscription.ts:8-13`) has no
   `priceCents`/`currency` field today — the only "price" that exists anywhere in this flow is the
   hardcoded `$8`/`$12` trial-copy literal. Any directive that shows a price to active/canceled
   subscribers is a real data-modeling change, not a markup change, and it must not silently
   introduce a second inaccurate number: a naive constant keyed by Stripe Price ID would still be
   wrong for grandfathered or coupon-discounted subscribers, since it reflects list price, not what
   that specific customer is actually billed. This is the same `NON_NEGOTIABLE_CONTRACT` money rule
   (`{ priceCents: number; currency: string }`, never a float, never guessed) applied to a spot where
   the codebase is currently violating its spirit with a plain string.

2. **Respect the Stripe-portal delegation boundary.** Cancellation, payment-method updates, and
   invoice history are handled entirely by Stripe's hosted Billing Customer Portal
   (`AccountClient.openPortal()` → `POST /api/stripe/portal` → redirect); expaify's own webhook-race
   backstop (`page.tsx:43-51`, `reconcileCheckoutSession`) already shows this integration is
   deliberately minimal and defensive. Portal session URLs are single-use and expire in minutes (per
   Stripe's own documentation), so they cannot be pre-fetched or cached client-side — a redesign
   directive may decide *what summary to show in-page*, but must not attempt to rebuild cancellation,
   payment-method management, or invoice history as in-app surfaces; that would duplicate what Stripe
   already owns and contradicts how this integration is built.

3. **One shared client component, four branch-selected UI modes, explicit scope freeze on one of
   them.** `AccountClient` (`AccountClient.tsx:99`) is instantiated up to 5 times across
   `page.tsx` (`:178`, `:180`, `:191`, `:202-209`, `:219`) with different optional-prop subsets
   (`signOutOnly`, `upgradePlan`, `showAlerts`, `showPrivacy`, or the default billing-portal-button
   mode) acting as an implicit mode switch. No required prop may be renamed or removed (existing
   pipeline contract), and the `showPrivacy` branch plus its state and handler must remain
   byte-for-byte untouched per this stage's explicit exclusion — any redesign directive touching
   `AccountClient.tsx` has to be scoped to the `showAlerts`/`signOutOnly`/`upgradePlan`/default
   branches only, without disturbing the file's shared helpers (`StatusLine`, `PillRadioGroup`,
   `persist()`) in ways that would change `showPrivacy`'s behavior.

**Success statement:** *This is solved when a returning subscriber — trialing, active, or
canceled — can look at the plan card and immediately answer "what am I paying, and when does that
change," in every one of the 4 real states, without clicking through to Stripe; and when a premium
user managing alert preferences can find and select their watched cities without scrolling a flat,
unsorted 20-pill wall — all while the page's existing per-field autosave interaction model (which
independent research below confirms is already correct) is preserved exactly as-is.*

---

## 2. Real competitive research (Step 1)

Gathered via live `WebSearch`/`WebFetch` this session — sources cited inline. Deliberately inside
the account/settings/billing-management category (Stripe's own conventions, GitHub Primer's
documented settings patterns, Baymard's self-service research, general SaaS account-page practice)
rather than travel/marketing precedent, since `/account` is a post-signup utility surface, not a
discovery/trust surface — the opposite exclusion rule from the DealCard stage, and correct for this
surface class.

1. **Stripe's own Billing Customer Portal**
   ([stripe.com/blog/billing-customer-portal](https://stripe.com/blog/billing-customer-portal),
   [stripe.com/docs/billing/subscriptions/integrating-customer-portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)):
   the portal is Stripe's answer to "don't build subscription-management UI yourself" — it natively
   handles plan upgrade/downgrade/cancel, payment-method updates, and billing-history/invoice
   viewing, is brand-customizable (logo, headline, colors), and its session URLs are single-use,
   expiring in minutes. **Direct consequence for expaify, verified against the real code:** expaify
   already delegates correctly at the plumbing level (`openPortal()` mints a fresh session per
   click), but the visible side effect is that `/account` itself shows almost none of what Stripe's
   own portal considers baseline — no invoice history, no visible price for anyone past the trial
   state, no payment-method-on-file indicator. A subscriber has to leave expaify and land on a
   Stripe-branded page to see what they're being charged once trial ends.

2. **GitHub Primer — "Saving" pattern**
   ([primer.style/product/ui-patterns/saving](https://primer.style/product/ui-patterns/saving/)), a
   real, current, documented design-system pattern library, not a blog opinion:
   explicit save (a button) is the *default* for declarative controls (text inputs, checkboxes,
   multi-select); *autosave* is reserved for "imperative controls" that behave like a physical
   switch/dial and take effect immediately — ToggleSwitches, SegmentedControls, single-select
   dropdowns. Hard rule, quoted directly: *"Avoid mixing explicit and automatic save patterns on a
   single page with multiple forms, and never mix save patterns in a single form."* Feedback without
   a page refresh should use an inline message component, not a toast (accessibility issues).
   **Cross-checked against the real code — a genuine positive finding, not a gap:** `AccountClient`'s
   `PillRadioGroup` (Frequency, Minimum deal size) is exactly Primer's SegmentedControl case; the
   city-watchlist pills are exactly its ToggleSwitch case; both autosave per-field via `persist()`
   with an `aria-live="polite"` `StatusLine` inline message ("Saving…"/"Saved"/error-with-recovery
   copy), and the page never mixes in an explicit-save form anywhere. **This interaction model is
   already correctly built per current, real design-system guidance and must be preserved exactly,
   not replaced with a page-level "Save changes" button** — that would be a regression against
   Primer's own documented rule, not an improvement.

3. **Baymard Institute — Accounts & Self-Service research program**
   ([baymard.com/research/self-service](https://baymard.com/research/self-service), 200,000+ hours
   of cited usability testing): the program's throughline across its account-dashboard findings is
   that self-service surfaces should let a user answer "where do I stand" (plan, renewal, cost)
   without hunting or leaving the product; documented, recurring failure modes include dashboards
   missing key info at a glance and poor grouping/structure. **Direct, verified match to expaify's
   active-subscriber gap above:** a returning paying subscriber fails exactly this test today — date
   without amount, nothing else.

4. **Cancellation/trial-flow UX consensus** (aggregated from FunnelFox cancellation-flow case
   studies, prototypr.io, and Primer/GitLab design-pattern discussion, current 2026 sources): a
   well-regarded cancellation flow avoids forced multi-step guilt screens, mandatory feedback forms,
   and countdown-pressure tactics, and is explicit up front about what happens to access/data.
   **Relevance to expaify:** there is no in-app cancellation flow to critique either way — it's 100%
   delegated to Stripe's hosted portal with no in-app confirmation step. That is consistent with
   finding #1 and is a "leave as-is, don't rebuild" finding, not a gap — useful specifically so a
   future UXDES stage doesn't waste effort re-inventing what Stripe already owns end-to-end.

5. **General account/settings-page pattern survey**
   ([bricxlabs.com/blogs/account-settings-design-examples](https://bricxlabs.com/blogs/account-settings-design-examples),
   citing Figma, Zapier, Scale, Air, Bitly): recurring best practice is contextual grouping (Figma:
   Account / Community / Notifications shown separately, not one long list) and progressive
   disclosure of advanced options; Air specifically separates organization-level from account-level
   settings. **Relevance:** expaify's account page is already short — 4 sections total — so
   "needs disclosure/collapsing" is not the actual problem here; the real, verified issue is
   *hierarchy and internal card structure* (finding above: the plan card's shape shifts across
   states) rather than page length or missing grouping.

**What was deliberately not used as a positive reference:** generic "SaaS dark mode dashboard"
aesthetic sources (the same category the prior DealCard stage was correctly told to avoid, just
inverted here — this stage *does* use SaaS settings-page *interaction convention*, but not visual
style/theme references, since expaify's light warm-ivory palette and existing token system are not
in question in this stage).

---

## 3. Real Krater model comparison (Step 2)

Called `https://api.krater.ai/v1/chat/completions` directly (OpenAI-compatible), same system prompt
+ same detailed user prompt — embedding the research above, the real, current `page.tsx`/
`AccountClient.tsx` source (with the Privacy branch explicitly marked frozen/out-of-scope in the
prompt itself), the real design tokens, the real `Subscription` type showing no price field exists,
and the actual "what does a returning subscriber need to see" problem — sent to three models, one
call per model (`max_tokens: 6000`, `reasoning: {"effort": "low"}`, per the operational lesson from
tonight's earlier DealCard stage that this combination reliably completes `openai/gpt-5.2-codex`
within Krater's ~120s gateway timeout).

| Model | Result | Notes |
|---|---|---|
| `openai/gpt-5.2-codex` | Complete, clean (a)/(b)/(c) response, `finish_reason: stop`, 7,589 chars | Disciplined, implementation-literal, explicitly flags the data-model gap rather than papering over it |
| `anthropic/claude-opus-5` | Hit `max_tokens` before emitting formatted `content` (`finish_reason: length`), 37,939-char reasoning trace | Richest and most inventive of the three despite never finishing; used as source material below, per the same operational lesson — one retry was not spent since the trace was already complete enough to mine and the DealCard precedent showed retries don't reliably fix this |
| `deepseek/deepseek-v4-pro` | Same behavior — hit `max_tokens` mid-reasoning (`finish_reason: length`), 51,142-char trace | Reaches similar structural conclusions but far more meandering/repetitive in its own reasoning (visibly re-deriving the same plan-card structure multiple times); one genuinely distinct, useful idea kept, rest folded in as corroboration only |

*(Full raw responses preserved in the session's scratchpad —
`krater_account_result_openai_gpt-5.2-codex.json`, `krater_account_result_anthropic_claude-opus-5.json`,
`krater_account_result_deepseek_deepseek-v4-pro.json` — not committed, this stage is docs-only.)*

### What each model actually said

**`openai/gpt-5.2-codex`** (complete answer):
- **Problem statement:** the plan card is "structurally inconsistent across trialing/active/
  canceled/free and omits price information for non-trial users because pricing is hardcoded for
  trials and not modeled in `Subscription`, forcing active users to leave the product to answer
  'what am I paying.'"
- **Directives:** (1) normalize the plan card into a fixed "status block" (badge + cadence) +
  "actions block" across all 4 states, each state filling the same slot shape rather than changing
  the card's structure; (2) explicitly flagged that showing price for active/canceled requires
  adding a real `price: { priceCents, currency }` field to `Subscription` and hydrating it from
  Stripe — and until that exists, replace the hardcoded `$8`/`$12` with honest placeholder copy
  ("See billing details in portal") rather than a guessed number; (3) split the free-plan upsell
  copy into its own visually separate block so the status block itself stays a consistent shape
  across all 4 states; (4) add a client-side search input + alphabetical sort to the city watchlist,
  explicitly preserving `persist()`/`StatusLine` untouched; (5) keep Plan → Profile → Alerts
  section order (subscription-first is defensible), but stop the free-upsell copy from sharing
  visual space with status messaging.
- **Application to the real component:** gave literal JSX diffs against the actual conditional
  blocks in `page.tsx` (trial countdown, active/canceled price lines, free upsell wrapper) and a
  literal `useState`/filter implementation for the `showAlerts` branch of `AccountClient.tsx`,
  correctly scoped to non-privacy branches only.
- **What it declined to guess:** explicitly refused to fabricate a price number without a real data
  field, which is exactly the discipline this brief asked for.

**`anthropic/claude-opus-5`** (from its 37,939-character reasoning trace — richest and most
inventive of the three, though it never formatted a final answer):
- Independently reached the same core diagnosis as gpt-5.2-codex (plan card shape-shifts across
  states; the only price is a hardcoded trial-only string) but went further on *mechanism and
  precision*:
  - Proposed the plan card as a `<dl>`-style definition-list anatomy — Price / Renews / Trial End in
    consistent grid positions — plus a `data-plan-state` attribute for styling/testing hooks, and
    replacing the current border-weight state switch (solid vs. dashed) with a uniform 1px border +
    a 3px left accent bar, specifically to avoid layout shift when state changes.
  - **A more rigorous take on the price gap than gpt-5.2-codex's**: a naive constant map keyed by
    Stripe Price ID (list price) is still *wrong* for grandfathered or coupon-discounted
    subscribers — the real fix is persisting `unit_amount` from the Stripe webhook onto the
    subscription row itself (nullable `priceCents`/`currency`/`interval` columns), falling back to a
    muted "Shown in billing portal" link for legacy rows rather than guessing. This is a genuinely
    sharper application of this brief's own "no fabricated or stale money" constraint than the other
    two models produced.
  - Distinguished two different "canceled" cases the current code collapses into one: a subscription
    *scheduled* to cancel at period end (still has an active Stripe subscription — portal action
    should read "Restore subscription") versus one that has *already lapsed* (no active
    subscription to manage — the user needs to go through checkout again, not the portal). The
    current code (`page.tsx:148-152`, `sub?.status === 'canceled'`) does not make this distinction
    at all — a real, previously-unflagged gap in this session's own code audit, surfaced only by this
    model's reasoning.
  - For the watchlist: region-grouping with `Intl.Collator` locale-aware alphabetical sort, pinning
    already-selected cities in a fixed first row so they stay visible while filtering, and only
    showing the filter input once the list exceeds ~12 markets (today's 20 already clears that
    threshold) — more layered than gpt-5.2-codex's flat alphabetical-sort-plus-filter.
  - Proposed reordering sections to **Plan → Email alerts → Profile** (premium users), reasoning that
    alerts are the page's "recurring product value" and should sit closer to the top than identity
    metadata — a direct, reasoned disagreement with gpt-5.2-codex's "keep Plan → Profile → Alerts"
    recommendation.
  - For free users, explicitly rejected showing a disabled/grayed-out alerts preview as "too
    marketing-focused," proposing instead a single line inside the plan card's existing upsell slot
    naming the three concrete knobs ("frequency, minimum discount threshold, up to 10 cities") they'd
    unlock.

**`deepseek/deepseek-v4-pro`** (from its 51,142-character reasoning trace — most verbose, weakest
synthesis discipline of the three):
- Reached the same structural diagnosis (four-state plan card inconsistency, hardcoded trial-only
  price) but spent the overwhelming majority of its reasoning budget re-deriving and second-guessing
  the same plan-card layout multiple times rather than progressing to new ground, consistent with
  the pattern flagged in the DealCard stage's operational notes for this model.
- One genuinely distinct, worth-keeping idea: an explicit `<dl>` "Status / Plan / Price / Renewal"
  four-row definition-list anatomy with exact per-state copy for all 4 states spelled out
  concretely (e.g., canceled: *"Price: $8.00/mo until access ends" / "Access ends Aug 30, 2026"*) —
  this independently corroborates and sharpens opus-5's `<dl>` proposal with slightly more concrete
  per-state copy, so it's folded in rather than cited standalone.
- Never reached its own (c) "specific application to real files" section before hitting
  `max_tokens` — unlike opus-5, whose reasoning trace covered a comparable amount of *new* ground
  (the grandfathered-price nuance, the two-kinds-of-canceled distinction) even though it also never
  emitted formatted final content.

### Verdict — how the three were weighted

**gpt-5.2-codex is the structural backbone**, same role it played in the DealCard comparison: the
only one of the three that actually finished, stayed disciplined about not inventing new required
props or fabricating a price, and produced literal, implementation-ready JSX against the real
conditional blocks. Its section-order call (Plan → Profile → Alerts) and its "placeholder copy until
the data model changes" instinct for the price gap are both kept as the baseline.

**opus-5's reasoning contributes three ideas gpt-5.2-codex didn't produce, all kept**: (1) the
sharper, more correct framing of the price-gap fix — flagging that even a Stripe-Price-ID-keyed
constant is inaccurate for grandfathered/coupon subscribers, which is a more rigorous reading of this
brief's own money-integrity constraint; (2) the previously-unflagged "two kinds of canceled"
distinction (scheduled-to-cancel vs. already-lapsed), which is a real gap in the current code that
neither this document's own initial code audit nor gpt-5.2-codex caught; (3) the layered
region-grouping/pinned-selection/threshold-gated-filter watchlist design, which is more scalable than
a flat alphabetical sort alone. Its **Plan → Alerts → Profile** section-order argument is recorded as
a genuine, reasoned alternative to gpt-5.2-codex's ordering — both are defensible, and the choice is
left to UXDES rather than forced here, since neither model's reasoning is obviously wrong and this
stage's job is to surface the real disagreement, not manufacture false consensus.

**deepseek is weighted down but not discarded**: its plan-card `<dl>` anatomy independently
corroborates opus-5's, so it's folded into directive D2 below as supporting evidence for the exact
per-state copy, rather than cited as a standalone contribution — consistent with how deepseek was
handled in the DealCard comparison (verbose, weaker synthesis discipline, but not without value when
mined for specifics rather than trusted for structure).

This is a real synthesis across two of the three sources (gpt-5.2-codex's finished structure/
discipline + opus-5's sharper mechanism and two genuinely new findings), with deepseek's one useful
idea folded in as corroboration — not a coin flip, not a single model's answer taken wholesale.

---

## 4. Final synthesized problem statement + directives

**Problem statement (final):** expaify's `/account` page fails the one job a returning, paying
subscriber actually needs it to do — answer "what am I paying, and when does that change" — because
price exists nowhere in the data model except a hardcoded string shown only during the trial state,
the plan card's visible structure changes shape across its four real states instead of teaching a
stable place to look, the current code cannot even distinguish a subscription that's scheduled to
lapse from one that already has, and the entire billing-management surface a Baymard-documented
self-service page would normally summarize in place is instead a single button that exits the
product entirely.

**Directives (D1–D6), each traceable to a specific research finding and model source:**

- **D1 — Fixed status-block anatomy for the plan card, same shape across all 4 states.**
  *(gpt-5.2-codex + opus-5, independently agreeing; grounded in Baymard's self-service "where do I
  stand" throughline and code-audit finding on `page.tsx:98-183`.)*
  Replace the current ad-hoc conditional block with a stable anatomy every state fills the same way:
  a top row (badge + billing cadence + live-status dot), a definition-list-style facts block
  (Plan / Price / Renewal — per opus-5 + deepseek's independently-corroborating `<dl>` proposal),
  then a single state-specific callout slot (trial countdown, reactivation nudge, or free upsell) in
  its own bordered region, then an actions row. The free-plan upsell paragraph moves into that same
  callout slot rather than sharing space with status atoms, per gpt-5.2-codex's directive.

- **D2 — Do not fabricate a price; either model it for real or say so honestly.**
  *(opus-5's sharper reading, directly extending this doc's own constraint #1: even a
  Stripe-Price-ID-keyed constant is wrong for grandfathered/coupon subscribers.)*
  The real fix is persisting `unit_amount`/currency/interval from the Stripe webhook onto the
  subscription row (nullable fields on `Subscription`), not a hardcoded map. Until that data-model
  change ships, replace `page.tsx:138`'s literal `$8`/`$12` with honest copy that doesn't state a
  number the code can't back (gpt-5.2-codex's "See billing details in portal" framing), and do not
  add a price line to the active/canceled states at all until real per-customer price data exists —
  a second guessed number would make the problem worse, not better.

- **D3 — Distinguish "scheduled to cancel" from "already lapsed."**
  *(opus-5's original contribution — a real gap in the current code, `page.tsx:148-152`, that this
  document's own initial audit and gpt-5.2-codex both missed.)*
  `sub?.status === 'canceled'` currently renders one message regardless of whether
  `currentPeriodEnd` is still in the future (user has an active Stripe subscription set to lapse —
  the portal button should read as a reactivation action, e.g. "Restore subscription") or already
  passed (no active Stripe subscription exists — the correct action is checkout, not the portal).
  This is a correctness gap in what CTA is even offered, not just a copy nuance.

- **D4 — Watchlist: alphabetical + locale-aware sort, pinned selections, filter gated by size.**
  *(gpt-5.2-codex's baseline + opus-5's more layered extension; grounded in code-audit finding on
  `AccountClient.tsx:341-373`, `TRACKED_MARKET_NAMES` currently 20 unsorted entries.)*
  Sort `TRACKED_MARKET_NAMES` with `Intl.Collator` before rendering; keep already-selected cities
  pinned in a visible first row so filtering never hides what a user is already watching; show a
  filter input once the list passes a size threshold (today's 20 already clears a reasonable ~12-14
  threshold). The filter is ephemeral client-side view state only — per Primer's rule (research
  finding #2), it must never trigger or interfere with the existing per-pill `persist()` autosave.

- **D5 — Preserve the existing autosave interaction model exactly; do not add a page-level Save
  button.**
  *(Research finding #2, Primer's documented "Saving" pattern, directly cross-checked against
  `StatusLine`/`PillRadioGroup`/`persist()` in the real code — a genuine positive finding, not a
  gap.)* `PillRadioGroup` (Frequency, Minimum deal size) and the city-watchlist pills are Primer's
  documented SegmentedControl/ToggleSwitch autosave cases, done correctly with per-field
  `AbortController`-scoped requests and `aria-live="polite"` inline feedback. Any redesign directive
  touching `AccountClient.tsx`'s `showAlerts` branch must keep `persist()`'s signature and behavior
  untouched — this is an explicit constraint, not an area open for "improvement."

- **D6 — Section order: Plan → Profile → Alerts is defensible; Plan → Alerts → Profile is a real,
  reasoned alternative — leave the final call to UXDES.**
  *(gpt-5.2-codex vs. opus-5, a genuine disagreement between the two completed/near-completed
  sources, not a synthesis artifact.)* gpt-5.2-codex argues subscription-first-then-identity is the
  safer, lower-risk order (matches the current code, minimal disruption). opus-5 argues alerts —
  the page's actual recurring product value — should sit above profile/identity metadata, which is
  lower-value real estate for a returning user. Both are grounded, neither is obviously wrong; this
  document records the disagreement rather than forcing a synthesis, since the next stage (UXR) is
  explicitly tasked with re-auditing the real implementation and can weigh this with fresh eyes
  rather than inheriting an artificial consensus.

**Constraints re-confirmed against all six directives:** D2 and D3 are the only directives that
require a real data/backend change (Stripe webhook persisting price data; distinguishing lapsed vs.
scheduled-cancel state, which may already be derivable from `currentPeriodEnd` vs. `now()` without a
schema change — worth UXR confirming directly against `lib/subscription.ts` and the webhook handler).
D1, D4, D5, D6 are markup/state-only changes inside `page.tsx` and the non-privacy branches of
`AccountClient.tsx`. None require a new *required* prop, a renamed export, a float for money, or any
change to the `showPrivacy` branch, its state, or its handler.

---

## Handoff

Per pipeline rules, this UXD stage does not create the next-stage ticket itself — the calling
process does that. Next stage is `UXR-ACCOUNT-REDESIGN-01` (UX Research), which should read this
doc, re-audit the current `/account` implementation directly (not just this summary) — in particular
confirming whether the "scheduled-to-cancel vs. already-lapsed" distinction (D3) is derivable from
existing `Subscription` fields or requires a schema change, and resolving the D6 section-order
question — and produce 3–5 specific, testable design directives building on D1–D6 above. The Privacy
section remains out of scope for that stage as well.
