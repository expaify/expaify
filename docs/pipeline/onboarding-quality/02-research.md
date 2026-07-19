# UX Research: Onboarding flow quality and drop-off

**Ticket:** UXR-ONBOARDING-QUALITY-01 · **Stage:** UXR · **Date:** 2026-07-19
**Upstream:** `docs/pipeline/onboarding-quality/01-discovery.md`
**Surfaces audited (source verified, not assumed):** `app/onboarding/OnboardingClient.tsx`, `app/onboarding/page.tsx`, `app/api/onboarding/route.ts`, `app/deals/page.tsx`, `app/deals/DealFeed.tsx`, `app/api/deals/route.ts`, `lib/paywall.ts`, `lib/subscription.ts`, `lib/trackedMarkets.ts`, `lib/email/sendDealAlert.ts`, `lib/email/sendDailyDigest.ts`, `lib/db/schema.sql`

---

## 1. Verification of discovery findings

Every discovery claim was re-checked against source. All confirmed:

| # | Discovery claim | Verified at |
|---|---|---|
| 1 | Feed ignores onboarding answers: hardcoded `minDiscount: 20`, no watchlist filter, `defaultCity` never passed | `app/deals/page.tsx:48` (`getActiveDeals({ limit: 20, sort: 'newest', includeMock: false, minDiscount: 20 })`), `app/deals/page.tsx:89` (`<DealFeed initialDeals={initialDeals} />` — no `defaultCity`) |
| 2 | Free first screen is ~17 locked cards vs 3 global unlocks | `lib/paywall.ts:12` (`FREE_WEEKLY_LIMIT = 3`, deterministic global set at `lib/paywall.ts:42-54`); prefetch limit 20 at `app/deals/page.tsx:48` |
| 3 | Alert emails gated to `('trialing','active')`; free users' choice is write-only | `lib/email/sendDealAlert.ts:52`, `lib/email/sendDailyDigest.ts:40`. Note both queries *do* honor `watchlist` and `alert_min_discount` (`sendDealAlert.ts:53-54`, `sendDailyDigest.ts:79-80`) — the machinery exists; only the status gate excludes free users |
| 4 | `complete()` has no try/catch → offline bricks the flow in "Saving..." | `OnboardingClient.tsx:44-68`: `await fetch` unguarded; a rejected fetch skips `setSaving(false)`; all three buttons carry `disabled={saving}` |
| 5 | Skip saves defaults and permanently sets `onboardingDone` | `OnboardingClient.tsx:78` (`complete({ useDefaults: true })` discards live selections at lines 54-57), `app/onboarding/page.tsx` redirects done users away |
| 6 | Abandon/reload loses everything | All state is `useState` (`OnboardingClient.tsx:24-27`); single PATCH at the end; no per-step URL or storage |
| 7 | Step 1 at 375px: 20 eager `<img>` cards, no `loading="lazy"`, no dimensions, non-sticky Continue | `OnboardingClient.tsx:126` (plain `<img>`), footer nav at `OnboardingClient.tsx:170-187` in normal flow; 2-col grid at line 111 → 10 rows ≈ 121px + gaps ≈ 1,300px before nav |
| 8 | Tulum listed as `TUL` (Tulsa); correct is `TQO` | `lib/trackedMarkets.ts:24` **and** the DB seed `lib/db/schema.sql:96`. `tracked_markets.iata` is `UNIQUE` with `ON CONFLICT (iata) DO NOTHING` (schema.sql:77,102), so the fix needs an `UPDATE` for existing rows, not just a seed edit. IATA is display-only — alert matching is by city string — so the fix is contained |
| — | Progress bar has no semantics | `OnboardingClient.tsx:87-94`: `aria-label` on a plain `div`, `<span>` segments with no `role`, no `aria-current` |

### Additional findings from this audit (not in discovery)

**A. Free users' preferences cannot be honored through `/api/deals` as-is — but can be server-side.** The API strips every filter param for non-premium callers (`app/api/deals/route.ts:86-92`: `minDiscount = pwCtx.premium ? ... : 20`, city resolved only `if pwCtx.premium`). So "just pass the user's prefs from the client" is a dead end for free users. However, the server prefetch in `app/deals/page.tsx` calls `getActiveDeals()` directly and already fetches the subscription (line 42) for the onboarding redirect — the user's `watchlist` and `minDiscountPct` are *already in hand* at the exact call site that hardcodes 20. Personalizing there does not weaken the paywall: locking is by membership in the global deterministic weekly unlock set (`app/api/deals/route.ts` comment: "Lock by membership… never by position"), so changing which deals are *listed* never changes which *prices* are exposed.

**B. Adjacent defect — premium users get a degraded first render.** `DealFeed` initializes `premium: false` and only learns premium status from a client fetch response (`DealFeed.tsx:223,251`). When `initialDeals` is provided, the initial fetch is skipped (`DealFeed.tsx:260-266`) — so on the server-rendered `/deals`, even a paying user sees all filter pills disabled and the "Filters and sorting are included with Premium… Unlock with Premium" banner (`DealFeed.tsx:498-509`) until some interaction triggers a fetch — and the pills are disabled, so there is no such interaction. `DealFeed` needs a server-passed `premium`/preferences prop regardless of which directive below is implemented. Flagging for the design stage since D1 touches exactly this seam.

---

## 2. Reference patterns (interaction level, not visual)

### Going (ex-Scott's Cheap Flights) — the closest business model (free tier + premium deals feed + email alerts)

- **One question, immediately honored.** Onboarding asks for home airport(s); the very first feed and the very first email are filtered by that answer. The free tier is *worse inventory* (fewer, less-spectacular deals), never *unpersonalized* inventory.
- **The free/premium boundary is disclosed at the moment of choice.** Premium-only options are labeled inline during setup (e.g., business-class deals, more airports carry a "Premium" tag on the option itself), so a free user never selects something that silently does nothing.
- **Locked content advertises specifics.** Teasers say what you're missing ("Premium members saw JFK→CDG at $340"), not a wall of identical redacted cards.

### Hopper — first-value moment and promise confirmation

- **Instant echo of input.** You watch a route; the next screen is a prediction *about that route* plus an explicit confirmation of the promise: "We'll notify you when prices drop." The system states what it will do with what you just told it.
- **Watch state is durable.** Abandoning setup never discards a watch; re-entry resumes, not restarts.

### Booking.com — progressive disclosure and never-ask-what-you-won't-use

- **Preferences are collected in context and reflected on the next render** (recently-viewed, destination interests reshape the home feed on the same visit).
- **Doesn't front-load questions it can't act on.** Anonymous/free users are simply not asked for notification channels they can't receive; the ask happens when the capability exists.

### The pattern expaify violates

All three references share one contract: **every onboarding answer produces a visible consequence on the next screen, or the option is labeled/deferred so the user never gives an answer that goes nowhere.** Call this the *preference echo* contract.

## 3. Gap analysis: current vs reference vs delta

| Dimension | expaify today | Reference behavior | Delta |
|---|---|---|---|
| First feed after onboarding | Global newest-first, `minDiscount 20`, no city filter; free users see ~17 "Members-only deal" cards vs 3 global unlocks | Going/Booking: first render filtered by stated preferences; teasers name what's behind the lock | Feed must consume `sub.watchlist` + `sub.minDiscountPct` at the server prefetch and visibly echo them; locked cards keep city/discount teaser (they already do — `city` and `discountPct` survive the mask) |
| Alert-channel step | Free user can pick Instant/Daily; emails silently require `trialing/active` | Going: premium-only options carry inline plan labels; Booking: doesn't ask | Truth-in-options: label email channels for free users at the moment of choice, or confirm what *will* happen ("you'll see deals on the site; email alerts start with a trial") |
| Save failure | Unhandled rejection → permanent disabled "Saving..." | Hopper: failure keeps state, offers retry | try/catch + error + retry; state already lives in React so retry is free |
| Skip | Writes defaults, discards selections, permanent | Hopper: exit never destroys entered data | Skip must not overwrite live selections silently; deferral or confirm |
| Step 1 mobile | ~1,300px scroll, 20 eager images, Continue below fold, progress scrolls away | All references keep primary CTA persistently reachable on mobile | Sticky bottom bar (CTA + count); lazy images |
| Re-entry | Reload/abandon restarts at step 0; `/deals` re-traps until done | Hopper resumes; Booking never blocks the product on setup | Persist step/selections across reload (session-level is enough) |

---

## 4. Design directives (testable)

Each directive is scoped for the UXDES stage and phrased as a testable acceptance criterion. D1–D3 are the trust-critical core; D4–D5 are drop-off reducers.

### D1 — Preference echo: the first feed render must consume and display the user's onboarding answers

- **Where:** `app/deals/page.tsx` server prefetch (the subscription is already fetched at line 42) and a new server-passed prop contract for `DealFeed` (which also fixes finding B — pass `premium` down).
- **Rule:** For a user with `onboardingDone` and a non-empty `watchlist`, the server render of `/deals` lists only deals whose city is in the watchlist, at `minDiscount = sub.minDiscountPct`; the page header states the active personalization in words (e.g., "Watching Tokyo, Paris + 2 more · 50%+ off") with a path to see everything. For `watchlist = []` (Everywhere), city filtering is skipped but `minDiscountPct` still applies.
- **Empty case is mandatory design surface:** if the personalized query returns zero rows, do NOT fall through to mock cards; show an honest state that names their criteria ("No 50%+ deals in your 4 cities right now — we check daily") with two actions: widen to all destinations, and (free users) the premium pitch. A 50% threshold with a small watchlist will frequently be empty — the design must treat this as the common case, not an edge.
- **Paywall invariant (test):** the set of deals with visible prices for a free user is exactly `getFreeUnlockedDealIds()` ∩ result set — personalization may change which locked cards appear, never which prices are exposed.
- **Testable:** given a free user with watchlist `['Tokyo','Paris']` and `minDiscountPct 50`, the first `/deals` HTML response contains no deal card for a city outside the watchlist, contains the echo header, and contains ≤ 3 unlocked prices.

### D2 — Truth in options: no onboarding option may promise something the user's plan cannot deliver

- **Where:** Step 3 of `OnboardingClient.tsx` (`REACH_OPTIONS`), plus completion confirmation copy.
- **Rule:** For users without `trialing/active` status, the Instant and Daily options must disclose the plan boundary inline on the option card itself (label + one truthful sentence, e.g., "Email alerts are included with Premium — your picks are saved for when you upgrade"), and the post-selection state must never claim an email will arrive. "Just the website" copy must remain accurate for everyone. Do NOT silently drop the step: the stored preference is real (both email queries already honor it for paying users — `sendDealAlert.ts:53-54`), so collecting it is legitimate *if disclosed*.
- **Constraint:** this is copy + labeling only; no change to email gating or business rules (that would be a product decision outside this pipeline's scope).
- **Testable:** render step 3 as a free user → both email options visibly carry the plan disclosure before selection; complete onboarding → no visible string promises an email to a free user anywhere in the flow.

### D3 — Resilient completion and non-destructive Skip

- **Where:** `complete()` and the Skip button in `OnboardingClient.tsx`.
- **Rule (save):** wrap the PATCH in try/catch; on network rejection or `!res.ok`, set `saving = false`, render the existing `role="alert"` error with an explicit retry affordance, and keep all selections intact. No path may leave `saving === true` after the promise settles.
- **Rule (skip):** Skip must not silently discard live selections. If the user has changed anything from defaults (selected ≥ 1 city, or changed discount/channel), Skip either (a) saves the *actual current* selections, or (b) asks one confirm before writing defaults. In all cases the completion path must tell the user preferences are editable at `/account` ("You can change these anytime in Account").
- **Testable:** DevTools offline → step 3 → "Take me to deals" → error visible, buttons re-enabled, selections intact, retry succeeds after reconnect. Select 3 cities → Skip → the saved `watchlist` in `subscriptions` is not silently `[]`.

### D4 — Step 1 must be completable at 375px without losing the CTA, and must not eager-load 20 remote images

- **Where:** step 1 grid and footer nav in `OnboardingClient.tsx`; `lib/trackedMarkets.ts`.
- **Rule:** at 375px the primary CTA (Continue) and the selection count ("N/10 selected" / "Everywhere") are visible at all scroll positions — sticky bottom bar containing progress + count + Continue (Back may stay in the header region). Images: `loading="lazy"` for all below-fold cards (at most the first 4 may load eagerly), explicit `width`/`height` (the Unsplash URLs already carry `w=640`), and a non-blank fallback (the existing gradient overlay + city text must remain legible if the image fails — give the card a solid token background, not white-on-nothing).
- **Data fix (include in this feature):** Tulum IATA `TUL` → `TQO` in `lib/trackedMarkets.ts:24` **and** `lib/db/schema.sql:96`, with an `UPDATE tracked_markets SET iata='TQO' WHERE city='Tulum' AND iata='TUL'` migration note — the seed's `ON CONFLICT (iata) DO NOTHING` will not repair existing rows. City strings must not change (alert SQL matches `m.city = ANY(s.watchlist)`).
- **Testable:** at 375×667 the Continue button is in the viewport at every scroll position of step 1; initial image requests ≤ 6; Tulum card renders "TQO · MX".

### D5 — Progress must be perceivable and progress must survive

- **Where:** progress indicator and step state in `OnboardingClient.tsx`.
- **Rule (semantics):** replace the `aria-label` div with real semantics — either `role="progressbar"` with `aria-valuenow/aria-valuemin/aria-valuemax`, or a step list with `aria-current="step"`; the visible "Step N of 3" eyebrow stays. On mobile the progress/count live in the sticky bar from D4 so they never scroll away during step 1.
- **Rule (persistence):** step index and selections persist across reload within the session (sessionStorage is sufficient; server persistence is out of scope). Reload on step 2 → land on step 2 with selections intact. This also derisks the D3 offline case (a hard reload no longer costs the user their answers).
- **Testable:** screen reader announces current step on step change; reload mid-flow restores step and selections; completing clears the stored draft.

---

## 5. Out-of-scope findings (for separate tickets, restated + new)

- Premium users see disabled filter pills + "Unlock with Premium" on server-rendered `/deals` (finding B above) — partially fixed as a side effect of D1's prop contract, but the full premium-context plumbing deserves its own verification.
- Paid-signup routing (`/join` → Stripe → `/account`) never presents onboarding proactively (discovery, unchanged).
- Global non-personalized free-unlock selection in `lib/paywall.ts` (discovery, unchanged).
- `alert_timezone` never collected; digests assume America/New_York (discovery, unchanged).
- `/deals` treats a failed `getSubscription` as "not onboarded" and re-traps finished users (`app/deals/page.tsx:42`) — D3's non-destructive Skip removes the *data-loss* consequence, but the redirect-on-DB-error itself needs a repair ticket.

## 6. Handoff

Next stage: **UXDES-ONBOARDING-QUALITY-01** — produce the design spec (`03-design.md`) covering every state for D1–D5: default, loading, empty (especially D1's personalized-empty), error, 375px, 1280px, focus/keyboard, using existing tokens only.
