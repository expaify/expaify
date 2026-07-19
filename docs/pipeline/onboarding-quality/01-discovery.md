# UX Discovery: Onboarding flow quality and drop-off

**Ticket:** UXD-ONBOARDING-QUALITY-001 · **Stage:** UXD · **Date:** 2026-07-19
**Surfaces audited:** `app/onboarding/page.tsx`, `app/onboarding/OnboardingClient.tsx`, `app/api/onboarding/route.ts`, `lib/subscription.ts`, `lib/trackedMarkets.ts`, `app/deals/page.tsx`, `app/deals/DealFeed.tsx`, `lib/paywall.ts`, `lib/email/sendDealAlert.ts`, `lib/email/sendDailyDigest.ts`, `app/login/page.tsx`, `app/join/_form.tsx`, `app/api/stripe/checkout/route.ts`, `lib/db/schema.sql`

---

## Problem statement (one sentence)

New users invest effort in a 3-step onboarding (pick up to 10 destinations, minimum discount, alert channel), but for free users those choices have **zero observable effect** on the first thing they see — the deal feed ignores the watchlist and discount threshold, alert emails are silently gated to paying users, and the first screen after completing is mostly "Members-only deal" locked cards — so the flow teaches users that expaify doesn't listen, right at the moment trust is formed.

## Who is affected, and where

- **All new signups** at the onboarding step (`/onboarding`). Every authenticated user with `onboardingDone = false` is force-redirected here from `/deals` (`app/deals/page.tsx:43`).
- **Free-plan users** are hit hardest: their alert-preference and discount selections are never acted on (see Findings 4–5).
- **Mobile users (375px)** face a ~1,300px scroll on step 1 before finding the Continue button (Finding 7).
- **Paid signups via `/join`**: Stripe checkout returns them to `/account?checkout=success` (`app/api/stripe/checkout/route.ts:51`), which does not check onboarding — they only meet onboarding later, on their first `/deals` visit. The highest-value users get the flow at an arbitrary later moment.

## What the flow actually is (audit)

### Steps and screens

One route, one client component, **3 steps** rendered in place (no per-step URLs, state lost on reload):

| Step | Content | Default |
|------|---------|---------|
| 1 | "Where do you dream of going?" — 20 photo cards (`TRACKED_MARKETS`), pick up to 10; none selected = "Everywhere" | Everywhere |
| 2 | "How big should a deal be before we bug you?" — 50% / 40% / 30% | 40% |
| 3 | "How should we reach you?" — Instant / Daily digest / Just the website | Daily |

Completion PATCHes `/api/onboarding`, which validates (city whitelist against `TRACKED_MARKET_NAMES`, dedupe, cap 10, enum checks on discount and preference) and upserts `subscriptions` with `onboardingDone = true`. Validation and persistence are correct for the happy path — I traced values through `upsertSubscription` (`lib/subscription.ts:69`) and the city strings exactly match the `tracked_markets` seed in `lib/db/schema.sql:81` (including "Cancún" with the accent), so the SQL text-equality matching in alert queries will work.

### Skip behavior

The header "Skip" button is not a deferral — it **saves defaults and permanently marks onboarding done** (`OnboardingClient.tsx:78`, `complete({ useDefaults: true })`): watchlist = everywhere, 40%, daily digest. Once `onboardingDone` is true the user can never see `/onboarding` again (`app/onboarding/page.tsx:11` redirects to `/deals`). Preferences remain editable at `/account`, but nothing tells the skipper that. If a user selects cities and then taps Skip, their selections are silently discarded in favor of defaults.

### Abandon behavior

All progress is client-side `useState`; nothing is persisted until the final PATCH. A user who abandons on step 2 or 3 (or reloads the page) restarts at step 0 with all selections lost, and is bounced back to `/onboarding` on every future `/deals` visit until they finish or skip.

## Key findings (ranked)

1. **The first deal a completing user sees does not reflect anything they just told us.**
   After `router.replace('/deals')`, the server prefetch is `getActiveDeals({ limit: 20, sort: 'newest', minDiscount: 20 })` (`app/deals/page.tsx:48`) — hardcoded 20% floor, no watchlist filter, and `DealFeed`'s `defaultCity` prop is never passed. A user who chose "50%+ only" and picked Tokyo/Paris sees the same feed as everyone else.

2. **A free user's first screen after onboarding is mostly a paywall.**
   Free users get exactly 3 globally-selected unlocked deals per week (`lib/paywall.ts:42` — deterministic, not personalized); the other ~17 cards render as "Members-only deal" with price 0 (`LockedDealCard`). If no real deals exist yet, the fallback is 5 mock cards labeled "Preview deal" with `city: ''` and no links (`app/deals/page.tsx:57-83`). Either way: 3 screens of preference-gathering → a wall of locked or fake inventory.

3. **The alert-preference step is a false promise for free users.**
   Both `sendDealAlert.ts:52` and `sendDailyDigest.ts` require `s.status IN ('trialing', 'active')`. A free user who chooses "Instant" or "Daily digest" never receives a single email, with no disclosure anywhere in the flow. Combined with findings 1–2, **every onboarding answer from a free user is write-only** — stored, displayed on `/account`, and otherwise unused.

4. **Network failure during save bricks the flow.**
   `complete()` (`OnboardingClient.tsx:44`) awaits `fetch` with no try/catch. A rejected fetch (offline, DNS) throws before the `res.ok` check: `saving` stays `true`, every button stays disabled showing "Saving...", no error renders, and the promise rejection is unhandled. Repro: DevTools → offline → step 3 → "Take me to deals". Only a full reload recovers (and restarts at step 0).

5. **Transient DB errors can silently overwrite a finished user's preferences.**
   `/deals` treats `getSubscription` failure as "not onboarded" (`.catch(() => null)` at `app/deals/page.tsx:42`) and redirects a completed user back into onboarding; the onboarding page swallows the same error. If the user, confused, taps Skip, defaults overwrite their real watchlist and thresholds.

6. **Progress indicator is adequate but disappears when it matters.**
   Three segment bars with fill state plus a "Step N of 3" eyebrow. Issues: the bars carry `aria-label` on a plain `div` with no `role`/`aria-current` semantics; on mobile the bars and the "N/10 selected" counter scroll out of view immediately (see 7), so during the longest step there is no visible progress or selection feedback.

7. **Step 1 at 375px is a drop-off machine.**
   20 photo cards in a 2-column grid (`aspect-[4/3]`, cards ~161px wide → ~121px tall) ≈ **1,300px+ of scrolling** before the Continue button, which is not sticky. All 20 images are hotlinked Unsplash JPEGs (`lib/trackedMarkets.ts`) loaded via plain `<img>` with no `loading="lazy"`, no `srcset`, and no width/height — 20 eager remote image requests on first paint of the first screen a new user sees, at mobile bandwidth. A broken/blocked Unsplash URL renders a blank card with white-on-nothing text.

8. **Data integrity nit shown directly to users:** Tulum is listed with IATA `TUL` (`lib/trackedMarkets.ts:24`) — TUL is Tulsa, Oklahoma; Tulum is TQO. The wrong code renders on the onboarding card ("TUL · MX").

## Measurable signals that the problem exists

- `onboardingDone = false` rate among accounts older than 24h (abandoners are re-trapped on every `/deals` visit — directly measurable in `subscriptions`).
- Share of completions using Skip vs. full flow (instrumentable: `useDefaults` flag already distinguishes them in the PATCH body).
- Ratio of locked to unlocked cards on the first post-onboarding `/deals` render for free users (currently ~17:3).
- Zero alert emails delivered to `status = 'free'` users who selected instant/daily (query `deal_alert_deliveries` against `subscriptions.alert_preference`).
- Step-1 image payload at 375px (20 uncompressed-dimension Unsplash requests, no lazy loading).

## Constraints the solution must respect

1. **Data integrity:** watchlist values must remain exact-match city strings against `tracked_markets.city` — the alert SQL matches on text equality (`m.city = ANY(s.watchlist)`); any renaming must update the seed and existing rows together. Money stays `{ priceCents, currency }`; discount stays the 30/40/50 enum.
2. **Accessibility:** keep `aria-pressed` selection semantics, keyboard reachability of all 20 cards and both nav buttons, visible focus rings, and add real progress semantics (`role="progressbar"` or list with `aria-current="step"`). Must remain fully usable at 375px and 1280px.
3. **Brand/trust:** no promises the plan can't keep — copy on step 2/3 must be truthful for free users (either gate the steps, label them as premium features, or make the feed actually honor the choices). Use existing design tokens; no new colors or type sizes.

## Success statement

This is solved when a first-time free user can complete or skip onboarding on a 375px phone in under a minute without losing the Continue button off-screen, and lands on a deal feed where **at least the first visible deals reflect the destinations and discount threshold they just chose** (or are honestly told why not) — without ever being promised an email they will not receive, and without a network hiccup trapping them in a disabled "Saving..." state.

## Out of scope for this feature (flagged for separate tickets)

- Paid-signup routing (`/join` → Stripe → `/account`) never presenting onboarding proactively.
- The global (non-personalized) free-unlock selection in `lib/paywall.ts`.
- `alert_timezone` is never collected; digests assume America/New_York.
