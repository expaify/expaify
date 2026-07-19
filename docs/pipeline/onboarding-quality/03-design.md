# UX Design Spec: Onboarding flow quality and drop-off

**Ticket:** UXDES-ONBOARDING-QUALITY-01 · **Stage:** UXDES · **Date:** 2026-07-19
**Upstream:** `docs/pipeline/onboarding-quality/01-discovery.md`, `docs/pipeline/onboarding-quality/02-research.md`
**Surfaces:** `/onboarding` (`app/onboarding/page.tsx`, `app/onboarding/OnboardingClient.tsx`), `/deals` (`app/deals/page.tsx`, `app/deals/DealFeed.tsx`), plus the data seam in `app/api/deals/route.ts`, `lib/pipeline/dealDetection.ts`, `lib/trackedMarkets.ts`, `lib/db/schema.sql`.
**Tokens:** existing only — `--bg`, `--surface`, `--ink`, `--ink-soft`, `--ink-faint`, `--primary`, `--primary-deep`, `--primary-soft`, `--accent`, `--gold`, `--gold-text`, `--line-ivory`, `--line-white`, `--error`, `--error-soft`, `--radius-card`, `--radius-pill`, `--radius-input`, `--shadow-card-hover`, plus `.btn`, `.btn-conversion`, `.btn-outline`, `.btn-primary`, `.skeleton`. No new colors, no new type sizes.

---

## 0. Design principle (governs every decision below)

**Every onboarding answer produces a visible consequence on the next screen, or the option is labeled so the user never gives an answer that goes nowhere.** (The "preference echo" contract from the research brief.) Secondary principle: **no state may trap the user** — not a network failure, not a reload, not a 1,300px scroll hiding the CTA.

---

## 1. Surface: `/onboarding`

### 1.1 Page frame (all steps)

Unchanged: `min-h-screen` column, `max-w-[1120px]`, `px-5`, header with logo + Skip. The footer nav row (`OnboardingClient.tsx:170-187`) is **replaced** by the sticky action bar (§1.2). The `justify-center` on the content section stays for steps 2–3; step 1 content is top-aligned once the bar is sticky (long grid + vertical centering fight each other — use `justify-center` only when content fits, i.e. keep the class; flexbox top-aligns overflowing content automatically, no change needed).

New microcopy line, all steps, inside the sticky bar region (§1.2), so the editability promise is visible at the exact moment of commitment (D3):

> You can change any of this later in **Account**.

"Account" is a link to `/account`. This line also satisfies D3's requirement that the Skip path tells the user preferences are editable.

### 1.2 Sticky action bar (D4, D5) — all steps, all viewports

One bar replaces the current footer nav. It is sticky on every viewport (behavioral consistency; at 1280px it simply sits at the bottom of short content).

**Structure (DOM order = tab order):**

1. **Back** — `.btn .btn-outline`, min 44px target. On step 0: `invisible` **and** `disabled` (occupies layout, unreachable by keyboard — do not use `opacity-0` alone, a transparent focusable button is a keyboard trap).
2. **Status block** (center, text, not interactive):
   - Line 1: `Step {N} of 3` — `text-[12px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]`
   - Line 2 (step 1 only): selection count — `text-[14px] font-medium text-[color:var(--primary)]`. Values: `Everywhere` when 0 selected; `{n}/10 selected` otherwise; at cap exactly `10/10 selected`. This is the same string as the header count; on ≥640px the header count (`OnboardingClient.tsx:108`) may remain as-is, but the bar copy is the canonical always-visible instance (D4: count visible at all scroll positions).
   - The status block carries `aria-live="polite"` so count changes are announced without focus moves.
3. **Continue** — `.btn .btn-conversion px-6`. Label: `Continue` (steps 1–2), `Take me to deals` (step 3), `Saving...` while saving (all steps, including Skip-initiated saves).

**Container classes:**

```
sticky bottom-0 z-20 -mx-5 mt-8 border-t border-[color:var(--line-ivory)]
bg-[color:var(--bg)] px-5 pt-3
pb-[calc(12px+env(safe-area-inset-bottom))]
```

Inner row: `flex items-center justify-between gap-3`. The microcopy line (§1.1) renders above the row inside the bar: `mb-2 text-center text-[12px] text-[color:var(--ink-faint)]`, the Account link `font-medium text-[color:var(--primary)] no-underline hover:underline`.

**375px:** Back collapses to `.btn .btn-outline px-4` with label `Back` (fits; no icon-only buttons). Status block is `text-center`. Continue keeps ≥44px height. Nothing wraps: at 375px the three cells fit (`Back` ≈ 76px, status ≈ 120px, `Continue` ≈ 110px, gaps 24px). If the step-3 label `Take me to deals` overflows at 375px, the status block's line 2 is absent on step 3, so the row still fits on one line; `flex-wrap` is permitted as a safety valve but must never hide the Continue button.

**1280px:** identical structure, `max-w-[1120px]` content alignment inherited from parent padding (the `-mx-5 px-5` trick keeps the bar full-bleed to the page gutter only, not viewport-wide; acceptable and simplest).

### 1.3 Progress semantics (D5)

The segment bars (`OnboardingClient.tsx:87-94`) keep their exact visual (three `h-2` pills, filled = `bg-[color:var(--primary)]`, unfilled = `bg-[color:var(--line-ivory)]`) and gain real semantics:

```tsx
<div
  role="progressbar"
  aria-valuemin={1}
  aria-valuemax={3}
  aria-valuenow={step + 1}
  aria-valuetext={`Step ${step + 1} of 3: ${STEP_NAMES[step]}`}
  className="mb-7 flex items-center gap-2"
>
  {/* three aria-hidden span segments, unchanged visuals */}
</div>
```

`STEP_NAMES = ['Destinations', 'Deal size', 'Alerts']`. The bare `aria-label` on the plain div is removed (superseded by `aria-valuetext`). Segments become `aria-hidden` decoration.

**Focus rule on step change (both directions):** the step `<h1>` receives `tabIndex={-1}` and is programmatically focused after each step transition, so screen readers announce the new heading and sighted keyboard users' tab position resets to the top of the new step. The visible `Step N of 3` eyebrow above each `<h1>` stays.

### 1.4 Step 1 — destinations (D4)

Heading, subhead, grid layout, selection logic (cap 10, `aria-pressed`, `Selected` chip): unchanged. Changes:

**Images.** Each card `<img>` gains:
- `width={640} height={480}` (matches the `w=640` Unsplash URLs at the card's 4:3 aspect; prevents layout shift)
- `loading="lazy"` on all cards with index ≥ 4; the first 4 cards (indices 0–3, the first two mobile rows) may load eagerly. Initial image requests at 375px must be ≤ 6.
- `decoding="async"` on all.

**Image-failure fallback.** The card button gains a solid token background under the image: `bg-[color:var(--primary-deep)]`. On `img` `onError`, hide the image element (`display: none` via state or `e.currentTarget.style.display = 'none'`). The existing gradient overlay and white city/IATA text render over `--primary-deep` — white on `#0A4440` is >12:1, always legible. No blank white cards.

**Card class delta (selected/unselected states unchanged otherwise):**

```
group relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)]
border bg-[color:var(--primary-deep)] text-left transition duration-150 disabled:opacity-45
```

**Tulum data fix (ship with this feature, D4):**
- `lib/trackedMarkets.ts:24`: `iata: 'TUL'` → `iata: 'TQO'` (TUL is Tulsa, Oklahoma). City string `'Tulum'` must NOT change (alert SQL matches `m.city = ANY(s.watchlist)`).
- `lib/db/schema.sql:96`: `('Tulum', 'MX', 'TUL')` → `('Tulum', 'MX', 'TQO')`.
- **Migration note (must accompany the change — the seed's `ON CONFLICT (iata) DO NOTHING` will not repair existing rows):**
  ```sql
  UPDATE tracked_markets SET iata = 'TQO' WHERE city = 'Tulum' AND iata = 'TUL';
  ```
- Acceptance: Tulum card renders `TQO · MX`.

**States, step 1:**

| State | Spec |
|---|---|
| Default | Grid as today; sticky bar shows `Step 1 of 3` + `Everywhere`; Continue enabled |
| ≥1 selected | Bar line 2 `{n}/10 selected`; selected cards ring `ring-2 ring-[color:var(--primary)]` |
| At cap (10) | Unselected cards `disabled` at `disabled:opacity-45` (existing); bar reads `10/10 selected` |
| Image failed | Card shows `--primary-deep` fill + gradient + white text; still selectable |
| 375px | 2-col grid (existing); Continue + count visible at every scroll position via sticky bar |
| 1280px | 5-col grid (existing); bar sits at content bottom |
| Focus/keyboard | Every card tabbable, `aria-pressed` reflects selection, `:focus-visible` global ring applies; Back not focusable on step 0 |

### 1.5 Step 2 — deal size

Unchanged: heading `How big should a deal be before we bug you?`, three `ChoiceStep` cards (50/40/30), default 40. Only frame-level changes apply (sticky bar, progress semantics, focus-on-heading).

### 1.6 Step 3 — alerts (D2: truth in options)

`OnboardingClient` learns the user's plan from a new server-passed prop (§1.10): `premium: boolean` (computed in `app/onboarding/page.tsx` via the already-fetched subscription + `isPremium(sub.status)`; `false` when sub is null).

**For non-premium users**, the `instant` and `daily` option cards each carry, inside the button, in order:

1. Label row: option label + a **Premium chip** — `rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-2 py-0.5 font-display text-[12px] font-bold leading-none text-[color:var(--gold-text)]`, text `Premium`. (Same treatment as the existing `Members` chip on `LockedDealCard` — established vocabulary.) Chip is real text, not aria-hidden, so the accessible name of the option includes "Premium".
2. Existing detail line (unchanged copy).
3. **Disclosure line** — `mt-2 block text-[13px]`; color `text-[color:var(--ink-soft)]` unselected, `text-white/85` selected:

   > Email alerts are included with Premium — your pick is saved for when you upgrade.

   Identical sentence on both cards. It must be visible **before** selection (it is static card content, not revealed on select).

**`Just the website`** card: unchanged for everyone (`Keep deals in my account only.` is accurate on every plan).

**Premium users** (`trialing`/`active`): no chip, no disclosure — cards exactly as today.

**No other change:** selection still stores `alertPreference` for all plans (legitimate — `sendDealAlert.ts:53-54` and `sendDailyDigest.ts:79-80` honor it the moment the user upgrades). No gating logic changes. No string anywhere in the flow may promise a free user an email: audit scope = this component; the only email-promising strings are the two `detail` lines, which are now truth-qualified by the disclosure directly beneath them, and the completion path (§1.7) adds no toast or confirmation copy claiming email delivery.

**States, step 3:**

| State | Spec |
|---|---|
| Default (free) | `daily` preselected, both email cards show chip + disclosure |
| Default (premium) | `daily` preselected, cards as today |
| Selected email option (free) | Card fills `--primary`, chip stays gold (contrast on `--primary`: `--gold` fill is its own bg, unaffected), disclosure `text-white/85` |
| 375px | Cards stack full-width (existing `grid gap-3`); chip wraps beside label, never overlaps |
| 1280px | `max-w-[760px]` centered (existing) |
| Focus/keyboard | `aria-pressed` semantics unchanged; accessible name = label + "Premium" + detail + disclosure |

### 1.7 Saving, error, retry (D3)

`complete()` is rewritten with one invariant: **no code path leaves `saving === true` after the promise settles.**

```
setSaving(true); setError(null)
try {
  const res = await fetch('/api/onboarding', { ...PATCH, body })
  if (!res.ok) { setError(SAVE_ERROR); return }        // finally clears saving
  clearDraft()                                          // §1.9
  router.replace('/deals')
} catch {
  setError(SAVE_ERROR)                                  // network rejection: offline, DNS
} finally {
  setSaving(false)                                      // runs before navigation is fine; the route change unmounts
}
```

(Exact structure is UI-stage's call; the invariant, the `catch`, and the `finally` are not.)

**Error state (all steps — Skip can fail on any step):** the existing `role="alert"` container (`OnboardingClient.tsx:164-168` — `border-[color:var(--error)] bg-[color:var(--error-soft)]`, `--error-soft` derives from `--accent` at 12%, text `--ink` for contrast on the pale wash) renders with final copy:

> We couldn't save your preferences — nothing was lost. Check your connection and try again.

followed by an inline **Try again** action inside the alert: `.btn .btn-outline mt-3` (or inline `font-bold text-[color:var(--primary)] underline` text button — UI-stage picks one; it must be a real `<button>`). **Try again re-invokes `complete()` with the same arguments as the failed attempt** (store the last attempt's payload in a ref so a failed Skip retries as a Skip). All bar buttons and Skip re-enable (`saving` is false). All selections remain in state — retry needs no re-entry.

**Saving state:** Skip, Back, Continue all `disabled` (existing `disabled={saving}` pattern); Continue label `Saving...`.

**Testable (from research, binding):** DevTools offline → step 3 → `Take me to deals` → alert visible, buttons re-enabled, selections intact; reconnect → Try again → lands on `/deals`.

### 1.8 Skip (D3: non-destructive)

**New behavior: Skip saves the actual current selections, not defaults.** The `useDefaults` branch in `complete()` (`OnboardingClient.tsx:48,54-57`) is removed entirely; Skip calls the same `complete()` as the final CTA:

- watchlist = current `watchlist` (empty array ⇒ `everywhere: true`, as today for untouched state)
- minDiscountPct = current value (default 40 if untouched)
- alertPreference = current value (default `daily` if untouched)

For a user who touched nothing, this is byte-identical to today's default write — no behavior change. For a user who selected 3 cities on step 1 and then skips, their 3 cities are saved. No confirm dialog (nothing destructive remains to confirm; option (a) from the research brief). The saved `watchlist` is never silently `[]` when the user selected cities.

Skip button label stays `Skip`; the always-visible bar microcopy (§1.1) covers the "editable at /account" requirement. While saving via Skip, the bar CTA shows `Saving...` and all buttons disable (§1.7).

### 1.9 Draft persistence (D5)

**Storage:** `sessionStorage`, key `expaify.onboarding.draft.v1`, value:

```json
{ "step": 1, "watchlist": ["Tokyo","Paris"], "minDiscountPct": 50, "alertPreference": "instant" }
```

**Write:** on every change to `step`, `watchlist`, `minDiscountPct`, or `alertPreference` (single `useEffect` over the four values). Wrapped in try/catch — storage failures (private mode, quota) are silently ignored; the flow must work identically with storage unavailable.

**Restore:** once, in a mount `useEffect` (NOT a lazy `useState` initializer — the component server-renders and a storage read during render would mismatch hydration). Validation before applying, field by field; any invalid field falls back to its default rather than discarding the whole draft:
- `step`: integer, clamped to `0–2`
- `watchlist`: array → filter to strings in `TRACKED_MARKET_NAMES`, dedupe, cap 10
- `minDiscountPct`: must be 30 | 40 | 50
- `alertPreference`: must be `instant` | `daily` | `off`
- Unparseable JSON → ignore draft, remove key.

**Clear:** on successful save (any path — Continue or Skip), before `router.replace('/deals')`. Never cleared on failure.

**Restored state is silent** — no banner, no toast. The user lands mid-flow exactly where they left off (Hopper pattern: re-entry resumes, not restarts). The step heading focus rule (§1.3) fires on restore only if the restored step ≠ 0; on a fresh step-0 mount, natural document focus order applies.

**Testable:** reload on step 2 → land on step 2 with selections intact; complete → `sessionStorage` key absent; corrupt the JSON manually → flow starts fresh at step 0 without error.

### 1.10 Component contract changes (`/onboarding`)

`app/onboarding/page.tsx` (server): already fetches the subscription; passes one new prop —

```tsx
<OnboardingClient premium={sub ? isPremium(sub.status) : false} />
```

`OnboardingClient` props: `{ premium: boolean }`. No other API/prop changes. `/api/onboarding` route: unchanged (it already accepts the exact payload Skip now sends).

---

## 2. Surface: `/deals` first render (D1: preference echo)

### 2.1 Server prefetch contract (`app/deals/page.tsx`)

The page already fetches the subscription (line 42) for the onboarding redirect. That same object now drives the prefetch. The page accepts `searchParams` (Promise in Next 15 — check `node_modules/next/dist/docs/` guidance before implementing) to read the `all` flag.

**Personalization is active when:** session exists AND `sub.onboardingDone` AND `searchParams.all !== '1'`.

**When active:**
- Prefetch: `getActiveDeals({ limit: 20, sort: 'newest', includeMock: false, minDiscount: sub.minDiscountPct, cities: sub.watchlist.length > 0 ? sub.watchlist : undefined })`
- **Required data-layer extension (DEV):** `getActiveDeals` currently filters by a single `marketId` only (`lib/pipeline/dealDetection.ts:218`). Add `cities?: string[]` → SQL `AND m.city = ANY($n::text[])` (parameterized; the join to `tracked_markets` already exists). Watchlist `[]` (Everywhere) ⇒ omit the filter; `minDiscountPct` still applies.
- **No mock fallback.** If the personalized query returns zero rows, `initialDeals = []` and DealFeed renders the personalized-empty state (§2.4). The mock-cards branch (`app/deals/page.tsx:57-83`) is reachable only when personalization is **inactive** (anonymous, or `all=1`).
- **Paywall invariant (unchanged, binding):** locking stays by membership in `getFreeUnlockedDealIds()` — personalization changes which deals are *listed*, never which *prices* are exposed. For a free user, visible prices ⊆ the global weekly unlock set, always ≤ 3.

**When inactive:** current behavior exactly (limit 20, `minDiscount: 20`, mock fallback allowed).

### 2.2 DealFeed prop contract (also fixes research finding B)

```ts
type DealFeedProps = {
  initialDeals?: ApiDeal[]
  defaultCity?: string                      // existing, unchanged
  premium?: boolean                         // NEW — server-known plan; default false
  personalization?: {                       // NEW — present only when user is onboarded
    active: boolean                         // false on the all=1 view
    watchlist: string[]                     // [] = Everywhere
    minDiscountPct: 30 | 40 | 50
    alertPreference: 'instant' | 'daily' | 'off'
  }
}
```

- `premium` initializes the existing `premium` state (`DealFeed.tsx:223`) so a paying user's first server-rendered view has **enabled** filter pills and **no** "Filters and sorting are included with Premium" banner. Later `/api/deals` responses may still update it (existing behavior kept).
- All props optional; every existing call site without them behaves exactly as today.

### 2.3 Echo header (states + final copy)

Location: the subtitle line under `Today's catches` (`DealFeed.tsx:365-367`). The `<h2>` stays. The subtitle becomes state-dependent — plain text + one inline link, never styled as a filter pill (free users' pills are premium-gated; the echo must not look like one):

| State | Subtitle copy (final) |
|---|---|
| Personalized, 1 city | `Watching Tokyo · 50%+ off · ` **Show all deals** |
| Personalized, 2–3 cities | `Watching Tokyo, Paris · 50%+ off · ` **Show all deals** (list all, comma-separated) |
| Personalized, >3 cities | `Watching Tokyo, Paris + 2 more · 50%+ off · ` **Show all deals** (first 2 + `+ {N−2} more`) |
| Personalized, Everywhere | `Watching all destinations · 40%+ off · ` **Show all deals** |
| All-view (`?all=1`, onboarded) | `Showing all destinations, updated daily · ` **Use my preferences** |
| Not onboarded / anonymous | `Deals across 20 destinations, updated daily` (current copy, unchanged) |

- Discount fragment always uses the user's stored value: `{pct}%+ off`.
- **Show all deals** → `<a href="/deals?all=1">`; **Use my preferences** → `<a href="/deals">`. Full navigations (server re-render swaps the prefetch); link style `font-medium text-[color:var(--primary)] no-underline hover:underline`. These links are available to free users — they widen/narrow the *listing*, which the paywall invariant explicitly permits.
- Class carries over: `mt-1 text-[13px] text-[color:var(--ink-soft)]`; at 375px it wraps naturally under the title (existing `flex-wrap` container).
- City names come from the watchlist verbatim (they are display strings: `Cancún` renders with the accent).

### 2.4 Personalized-empty state (mandatory surface — treat as common, not edge)

Rendered by DealFeed when `personalization?.active` && no client-side filters applied && `deals.length === 0` && not loading && not error. Takes precedence over the two existing empty variants (which remain for their cases: filter-empty for premium explicit filters, "We're building your feed" for the non-personalized view).

Layout: centered block, `py-20 text-center` (matches existing empty states). No ghost skeletons behind it (unlike the generic empty — this state must read as an honest answer, not a loading limbo).

**Copy (final):**

- Headline — `font-display text-[20px] font-bold text-[color:var(--ink)]`:
  - watchlist N ≥ 2: `No {pct}%+ deals in your {N} destinations right now.`
  - watchlist N = 1: `No {pct}%+ deals in {City} right now.`
  - Everywhere: `No {pct}%+ deals right now.`
- Body — `mt-2 text-[14px] text-[color:var(--ink-soft)]`:
  > Your bar is set at {pct}%+ off — drops that big are rare, and we check every destination daily. New deals land here the moment one clears it.
- Actions — `mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center`:
  1. **Show all deals** — `.btn .btn-primary px-8`, links `/deals?all=1`
  2. **Edit preferences** — `.btn .btn-outline px-8`, links `/account`
- Plan-aware footer line — `mt-5 text-[13px] text-[color:var(--ink-soft)]`:
  - Free user: `Want an email the moment a match appears? Alerts are included with Premium. ` **Start Premium** (link → `/join`, `font-bold text-[color:var(--primary)] no-underline hover:underline`). *(Honest: alerts genuinely are premium-gated — this is the D2 disclosure paying off, not an empty pitch.)*
  - Premium user with `alertPreference` `instant` or `daily`: `You'll get an email as soon as a match appears.` *(True: both email queries honor watchlist + threshold for premium users.)*
  - Premium user with `off`, or personalization prop absent: no footer line.

**Never** show mock "Preview deal" cards in this state (D1: no mock fallback). A free user's empty personalized feed contains zero locked cards and zero prices — nothing to mask, invariant trivially holds.

### 2.5 `/api/deals` contract (DEV-stage change, required for coherence)

Without this, infinite scroll (`loadMore`, PAGE_SIZE 12) would silently switch free users from a personalized page 1 (server-rendered) to an unpersonalized page 2 (API strips all filter params for free callers at `app/api/deals/route.ts:86-92`). Personalization must come **from the DB, not the request**, so free callers still can't steer filters:

- Authenticated + `onboardingDone` + no `all=1` param + (for premium: no explicit filter params): the route loads the caller's subscription and applies `watchlist` (as `cities`) + `minDiscountPct` as the base query — same shape as §2.1.
- `all=1` param present: no stored prefs applied; current behavior (floor 20, mock fallback allowed when unfiltered).
- Free callers' explicit filter params: **still ignored** (existing rule, unchanged). Only the `all=1` widen flag is honored, because listing-widening is paywall-safe.
- Premium explicit filter params: switch fully to explicit mode (current behavior) — a premium user picking a pill overrides their stored base; matches existing filter UX.
- Personalized + zero rows: return `{ deals: [], total: 0, premium, ... }` — **no mock fallback** in the personalized path.
- DealFeed's `fetchDeals` appends `all=1` when `personalization` is absent or `personalization.active === false`.

### 2.6 States, `/deals`

| State | Spec |
|---|---|
| Default (personalized, results) | Echo subtitle + feed filtered to watchlist/threshold; free users: ≤3 unlocked prices, locked cards keep real `city` + `discountPct` teaser (existing mask already preserves both) |
| Default (premium) | Same + pills enabled and no premium banner on first paint (via `premium` prop) |
| Loading | First paint is server-rendered — no client loading state. Client refetches (filters, Show-all round trips are full navigations; pill changes for premium) use existing skeleton grid |
| Personalized-empty | §2.4 |
| Filter-empty / building-feed | Existing copy unchanged (`No deals match those filters.` / `We're building your feed.`) |
| Error (client fetch) | Existing: `Couldn't load deals right now.` + Retry — unchanged; retry re-requests with the same personalization rules (§2.5) |
| 375px | Subtitle wraps under title; empty-state buttons stack vertically full-centered; card grid 1-col (existing) |
| 1280px | 3-col grid (existing); echo subtitle on one line |
| Focus/keyboard | Subtitle links + empty-state actions are anchors/buttons with the global `:focus-visible` ring; no new interactive patterns |

---

## 3. Copy inventory (every visible string, final)

Strings marked **(new)** or **(changed)**; all others unchanged and listed for completeness where adjacent.

**/onboarding — frame**
| String | Where |
|---|---|
| `Skip` | Header button |
| **(new)** `You can change any of this later in Account.` | Sticky bar microcopy, all steps (`Account` = link) |
| `Back` / `Continue` / `Take me to deals` / `Saving...` | Sticky bar buttons |
| **(new)** `Step 1 of 3` `Step 2 of 3` `Step 3 of 3` | Sticky bar status + existing eyebrows |
| `Everywhere` / `{n}/10 selected` / `10/10 selected` | Bar count (step 1) |
| **(new, aria only)** `Step {n} of 3: Destinations` / `…: Deal size` / `…: Alerts` | `aria-valuetext` |
| **(changed)** `We couldn't save your preferences — nothing was lost. Check your connection and try again.` | Error alert (replaces `We could not save your preferences. Try again.`) |
| **(new)** `Try again` | Retry button inside alert |

**/onboarding — step 1** — heading `Where do you dream of going?`, sub `Pick up to 10 destinations. Leaving this open watches every expaify market.`, chip `Selected`, card text `{City}` / `{IATA} · {Country}` (Tulum now `TQO · MX`): all otherwise unchanged.

**/onboarding — step 2** — unchanged: `How big should a deal be before we bug you?`; `50%+ / Only the steepest drops`; `40%+ / Balanced and useful`; `30%+ / More chances to travel`.

**/onboarding — step 3** — heading `How should we reach you?` unchanged. Options:
| Option | Label | Detail (unchanged) | Free-user additions |
|---|---|---|---|
| instant | `Instant` | `Email me as soon as a match appears.` | chip **(new)** `Premium` + **(new)** `Email alerts are included with Premium — your pick is saved for when you upgrade.` |
| daily | `Daily digest` | `Send one clean roundup each day.` | same chip + same disclosure sentence |
| off | `Just the website` | `Keep deals in my account only.` | none |

**/deals** — `Today's catches` unchanged. Subtitle variants and links per §2.3 (`Watching …`, `Show all deals`, `Showing all destinations, updated daily`, `Use my preferences`, legacy `Deals across 20 destinations, updated daily`). Personalized-empty strings per §2.4 (`No {pct}%+ deals …`, body sentence, `Show all deals`, `Edit preferences`, `Want an email the moment a match appears? Alerts are included with Premium.`, `Start Premium`, `You'll get an email as soon as a match appears.`). Premium banner, filter pills, sort labels, locked-card strings: unchanged.

No placeholder text anywhere. No TODOs.

---

## 4. Interaction rules (consolidated)

| Trigger | Rule |
|---|---|
| Tap/Enter on destination card | Toggle; blocked additions at cap (existing) |
| Tap/Enter Continue (steps 1–2) | `setStep(+1)`; focus moves to new `<h1>`; draft persists |
| Tap/Enter Back | `setStep(−1)`; focus to `<h1>`; selections retained |
| Tap/Enter `Take me to deals` | `complete()` with current state |
| Tap/Enter Skip (any step) | `complete()` with current state (never defaults over selections) |
| Save success | Clear draft → `router.replace('/deals')` → personalized feed echoes the answers just given |
| Save failure (network or non-2xx) | `saving=false` always (`finally`); alert + `Try again`; selections + draft intact |
| Tap/Enter `Try again` | Re-invoke `complete()` with the failed attempt's payload |
| Reload mid-flow | Restore step + selections from sessionStorage draft (validated) |
| `Show all deals` | Navigate `/deals?all=1` — unpersonalized listing, prefs untouched in DB |
| `Use my preferences` | Navigate `/deals` — personalized listing |
| `Edit preferences` | Navigate `/account` |

---

## 5. Acceptance criteria (binding for UI/DEV/TEST stages)

Mapped 1:1 from the research directives:

1. **D1:** Free user, watchlist `['Tokyo','Paris']`, `minDiscountPct 50` → first `/deals` HTML contains no deal card for a city outside the watchlist, contains `Watching Tokyo, Paris · 50%+ off`, and ≤ 3 unlocked prices. Personalized zero-result → §2.4 state, zero mock cards. Premium user first paint → pills enabled, no premium banner.
2. **D2:** Step 3 as free user → both email options show the `Premium` chip + disclosure before selection; no string in the flow promises a free user an email. Premium user → no chips.
3. **D3:** Offline save → alert + `Try again`, buttons re-enabled, selections intact, retry works after reconnect; `saving` never sticks. 3 cities selected + Skip → saved watchlist is those 3 cities, not `[]`.
4. **D4:** At 375×667, Continue + count visible at every scroll position of step 1; initial image requests ≤ 6; failed image → legible card; Tulum renders `TQO · MX`; migration `UPDATE` noted in the DEV commit.
5. **D5:** Progressbar announces `Step N of 3: {name}`; heading focus moves on step change; reload mid-flow restores step + selections; completing clears the draft.

---

## 6. Implementation split (handoff guidance)

**UI stage (`UI-ONBOARDING-QUALITY-01`)** — components only:
- `OnboardingClient.tsx`: sticky bar, progress semantics, focus management, step-3 disclosures, `complete()` try/catch/finally + retry, Skip = current-state save, sessionStorage draft, image lazy/fallback/dimensions, `premium` prop.
- `app/onboarding/page.tsx`: pass `premium`.
- `lib/trackedMarkets.ts`: Tulum `TQO`.
- `DealFeed.tsx`: `premium` + `personalization` props, echo subtitle, personalized-empty state, `all=1` on fetches.

**DEV stage (`DEV-ONBOARDING-QUALITY-01`)** — logic/API (required; UI stage must create this ticket):
- `lib/pipeline/dealDetection.ts`: `cities?: string[]` filter.
- `app/deals/page.tsx`: personalized prefetch, `searchParams.all`, no mock fallback when personalized, pass new props.
- `app/api/deals/route.ts`: stored-prefs personalization per §2.5.
- `lib/db/schema.sql`: Tulum seed + migration note.

Out-of-scope items from research §5 (premium-context full plumbing verification, `/join` routing, global unlock selection, `alert_timezone`, `/deals` DB-error re-trap) remain separate tickets — do not fold them in.
