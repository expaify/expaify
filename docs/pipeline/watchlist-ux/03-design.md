# UX Design Spec: Watchlist & Alert Preference Management

**Ticket:** UXDES-WATCHLIST-UX-01 · **Stage:** UXDES · **Date:** 2026-07-19
**Feature slug:** `watchlist-ux`
**Upstream:** `01-discovery.md` (research directives D1–D5 carried in the UXDES ticket; `02-research.md` was not produced — see Blockers note in the handoff)

---

## 0. Scope and definitions

- **Watchlist = up to 10 tracked cities** (`subscriptions.watchlist TEXT[]`), chosen from the 20 markets in `lib/trackedMarkets.ts`. This is **not** a saved-deals feature. No per-deal save affordance is added anywhere.
- **Empty watchlist = watch every destination.** This is existing, documented behavior (`AccountClient.tsx:153`, `sendDealAlert.ts:54`). This spec preserves it in-app and handles its edge cases explicitly in email flows (§6.4).
- **Premium-only writes.** All watchlist/alert writes require auth + `isPremium` (403 otherwise). Non-premium and anonymous users never see the new in-app controls. No upsell clutter is added to public surfaces (repair mode).
- Design tokens: only existing tokens from `app/globals.css` (`--primary`, `--primary-soft`, `--ink`, `--ink-soft`, `--ink-faint`, `--error`, `--line-ivory`, `--surface`, `--bg`, `--radius-pill`, `--radius-card`, `--focus-ring`) and existing utility classes (`.btn-pill`, `.btn-pill.active`, `.spinner`, `.card`, `.text-caption`). Email/standalone HTML surfaces use the same hex values already hardcoded in those files (`#FAF7F2`, `#0E5A54`, `#5C5852`, `#8A857D`, `#E8E2D8`, `#FF6B4A`, `#141210`).
- Breakpoints specced: **375px mobile** and **1280px desktop**. Everything must also survive 320px (body `min-width: 320px`).

### Deliverables map (directive → section)

| Directive | Section |
|---|---|
| D1 — Watch {city} pill on `/destinations/[city]` + `/deals/[dealId]` | §2 |
| D2 — Token-based email footer links + confirm-on-landing page | §5, §6 |
| D3 — Unsubscribe landing as recovery surface | §7 |
| D4 — `/account#alerts` anchor, per-action persistence, deal-detail account link | §3, §4 |
| D5 — Single write path, single city list | §1 |

---

## 1. Architecture: single write path & single city list (D5)

The UI in this spec assumes exactly these write paths. DEV implements; UI wires to them.

### 1.1 Routes — adopt the dead routes, scope the onboarding route

| Route | Decision | Contract |
|---|---|---|
| `PATCH /api/account/watchlist` | **Adopt** (currently zero callers) | Accepts **either** `{ watchlist: string[] }` (replace, account panel bulk ops not used by this spec but kept valid) **or** `{ op: 'add' \| 'remove', city: string }` (atomic single-city write — used by the Watch pill and account city toggles). Validates city against `TRACKED_MARKET_NAMES` imported from `lib/trackedMarkets` — **delete the hardcoded `CITIES` set** in the route. Auth + premium required (401/403). Cap: an `add` that would exceed 10 returns `400 { error: 'watchlist_full' }`. Success returns `{ ok: true, watchlist: string[] }` (the resulting list — client reconciles optimistic state from it). |
| `PATCH /api/account/alerts` | **Adopt** (currently zero callers) | Used for `{ alertPreference: 'instant' \| 'daily' \| 'off' }` and/or `{ alertMinDiscount: 30 \| 40 \| 50 }`. UI only ever sends 30/40/50; route keeps its 0–90 validation. `alertTimezone` stays supported but has no UI (unchanged). Auth + premium required. Success returns `{ ok: true }`. |
| `PATCH /api/onboarding` | **Scope back to onboarding only** | `/onboarding` keeps using it (it re-asserts `onboardingDone: true`, which is correct there and wrong everywhere else). `AccountClient` **stops** calling it. |
| `GET /alerts/manage` + `POST /api/alerts/manage` | **New** (D2) | Token-based confirm-on-landing surface, no auth session required. See §6. GET never mutates (email scanners prefetch GETs); the confirm form POSTs. |
| `GET /api/alerts/unsubscribe` | **Unchanged mutation** | Still one-click `alert_preference = 'off'` on GET. Only the rendered HTML changes (§7). CAN-SPAM: zero added friction. |

### 1.2 Single city list

`lib/trackedMarkets.ts` `TRACKED_MARKET_NAMES` becomes the only city list. Delete the duplicated hardcoded arrays in:
- `app/api/account/watchlist/route.ts:8-12`
- `app/deals/DealFeed.tsx:11-15` (its filter dropdown imports `TRACKED_MARKET_NAMES` instead; same 20 names, no visual change)

City slugs in URLs use `CITY_DISPLAY_TO_SLUG` / `CITY_SLUGS` from `lib/cities.ts` (avoids URL-encoding "Cancún").

### 1.3 Client write discipline (applies to every control in §2–§4)

- **Optimistic update** on click; reconcile with the server response; **revert on failure**.
- One in-flight request per control group; a newer click aborts the previous request (`AbortController`) — last click wins.
- Never disable the whole panel while saving. Never block navigation.

---

## 2. D1 — `WatchCityPill` component

New client component `app/components/ui/WatchCityPill.tsx`.

**Props:**

```ts
type WatchCityPillProps = {
  city: string             // display name, must be in TRACKED_MARKET_NAMES
  initialWatching: boolean // server-derived: sub.watchlist.includes(city)
  initialCount: number     // server-derived: sub.watchlist.length
}
```

**Server gating (both surfaces):** the server component fetches `auth()` + `getSubscription()`. Render the pill **only** when the session exists, `isPremium(sub.status)`, and `city` is a tracked market. Otherwise render nothing — no placeholder, no upsell. (The locked deal page already markets watchlists; public pages stay clean.)

**Semantics note:** the pill toggles alert *targeting*, not a bookmark. Watching state must be visible without interaction ("You're watching this city" was previously invisible everywhere).

### 2.1 Anatomy & states

One `<button type="button">`, `aria-pressed` toggle, plus an adjacent status line. Base classes shared by all states:

```
btn-pill min-h-[36px] gap-1.5 px-4 transition-colors duration-100
```

(`.btn-pill` supplies pill radius, 13px/500 type, `--surface` bg, `--line-white` border. Global `:focus-visible` supplies outline + `--focus-ring`.)

| State | Visual | Label / content |
|---|---|---|
| **Default (not watching)** | `.btn-pill` base; hover: `hover:border-[color:var(--primary-soft)]` | Plus icon (16px inline SVG, `stroke="currentColor"`, paths `M8 3v10 M3 8h10`, `aria-hidden`) + `Watch {city}` |
| **Watching** | `.btn-pill active` (border `--primary`, bg `--primary-soft`, text `--ink`) | Check icon (16px inline SVG, path `M3 8.5l3.2 3.2L13 5`, `aria-hidden`) + `Watching {city}` |
| **Pending** | Same visual as the *target* state (optimistic), icon swapped for `<span class="spinner" aria-hidden />`; button gets `aria-busy="true"`; label unchanged | — |
| **At-cap** (not watching ∧ `count >= 10`) | Default visual + `opacity-60`; `aria-disabled="true"` (stays focusable — never `disabled`, so the reason is discoverable); click/Enter does **not** call the API, it reveals the at-cap status line | `Watch {city}` |
| **Error** | Reverted to pre-click visual; status line shows error | — |

**Status line** (one element under/next to the pill, reserved height so nothing shifts):

```
mt-1.5 min-h-[18px] text-[12px] leading-[18px]
```

| Condition | Copy | Classes / a11y |
|---|---|---|
| Idle | *(empty)* | `aria-live="polite"` region at all times |
| Error (add/remove failed) | `Couldn’t update your watchlist. Try again.` | `text-[color:var(--error)] font-medium`, `role="alert"` |
| At-cap (after activation attempt) | `You’re watching 10 cities — the maximum. Manage watchlist` | `text-[color:var(--ink-faint)]`; “Manage watchlist” is `<a href="/account#alerts">` in `text-[color:var(--primary)] font-medium underline` |
| Just removed **last** watched city | `You’re not watching any specific cities — alerts now cover every destination.` | `text-[color:var(--ink-faint)]`; clears on next interaction or after 6s |

Error copy persists until the next click; success needs no message (the pill state *is* the confirmation).

### 2.2 Interaction rules

- **Click / Enter / Space** (native button): toggle. Immediately flip visual state (optimistic), fire `PATCH /api/account/watchlist` with `{ op: 'add' | 'remove', city }`.
- **Success:** reconcile `watchlist` from response (count + membership). If a `remove` produced an empty list, show the “every destination” status line.
- **Failure (network / non-2xx):** revert visual, show error line. A `400 watchlist_full` response (race: cap reached in another tab) reverts and shows the at-cap line instead.
- **`aria-pressed`** always reflects the *displayed* state. `aria-label` is unnecessary — the visible label carries the full meaning (“Watch Cancún” / “Watching Cancún”).
- No confirmation dialogs in-app; the action is instantly reversible by clicking again.

### 2.3 Placement — `/destinations/[city]` (`app/destinations/[city]/page.tsx`)

Insert between the `<h1>` and the “Updated daily” line, as its own row:

```tsx
<h1 …>Hotel deals in {displayName}</h1>
{/* premium only */}
<div className="mb-3 mt-2">
  <WatchCityPill city={displayName} … />
</div>
<p className="text-[13px] text-[color:var(--text-2)] mb-8">Updated daily · …</p>
```

- **375px:** pill sits alone on its row, left-aligned, natural width (~140–170px). Status line wraps below. Nothing overlaps the h1 or meta line.
- **1280px:** identical placement (left column of content, max-w-[1200px] container). Do not float it right of the h1 — the h1 uses `text-h2` (30px) and long names (“Punta Cana”) plus the pill would collide at intermediate widths.
- Empty-state variant of the page (no deals) **still shows the pill** — that is precisely when “tell me when a deal appears here” matters most. Pill row renders above the empty-state card, same position.
- The pill's server data requires `auth()` + `getSubscription()` in this page; both already exist in the codebase and are cheap single-row lookups.

### 2.4 Placement — `/deals/[dealId]` (`app/deals/[dealId]/page.tsx`)

Insert directly **below the title block** (after the `div.mt-6.flex.items-start…` containing h2 + `ShareButton`), before the Price section:

```tsx
<div className="mt-3">
  <WatchCityPill city={deal.city} … />
</div>
```

- Rationale: an alert-email click lands here; “Watching Cancún ✓” confirms *why they got the email* and offers the one-click undo (“I’m done with Cancún”) at the exact moment of post-booking/lost-interest. Placing it in the meta row (`stars · city · window`) would crowd a line that already wraps at 375px.
- **375px:** own row under the meta line; ShareButton stays top-right; no wrap collisions.
- **1280px:** same; content column is max-w-[760px].
- Only rendered for premium sessions (free users seeing an unlocked deal get no pill). The locked-deal branch (`LockedDealDetail`) is unchanged.
- If `deal.city` is not in `TRACKED_MARKET_NAMES` (defensive), render nothing.

### 2.5 Loading state (both surfaces)

None. The pill is server-rendered with its initial state (`initialWatching`, `initialCount`) — there is no client fetch on mount and therefore no skeleton. First paint is already correct.

---

## 3. D4 — `/account#alerts`: anchor + per-action persistence

All changes in `app/account/page.tsx` + `app/account/AccountClient.tsx` (`showAlerts` branch).

### 3.1 Anchor

- The alerts section (`app/account/page.tsx:167`) gets `id="alerts"` and `scroll-mt-20` (nav is `h-16`; 80px margin clears it).
- Section stays where it is (last) — deep links make position irrelevant, and reordering plan/billing is out of scope.
- Anchor targets: email “Manage prefs”, unsubscribe/manage landing pages, at-cap helper links, deal-detail nav (§4).
- Update the email `manageUrl` (`sendDealAlert.ts:88`, `sendDailyDigest.ts` equivalent) from `${BASE_URL}/account` to `${BASE_URL}/account#alerts`.

### 3.2 Per-action persistence — replaces batch save

**Remove:** the `Save preferences` button, `saving`/`saved` state, and the single `savePreferences()` → `PATCH /api/onboarding` call. There is no longer any un-persisted UI state in this panel.

**Each control persists on click,** per §1.3:

| Control group | Request | Notes |
|---|---|---|
| Frequency (`Instant` / `Daily digest` / `Off`) | `PATCH /api/account/alerts` `{ alertPreference }` | Radio semantics: wrap in `role="radiogroup"` with `aria-label="Alert frequency"`; each pill `role="radio"` + `aria-checked`; roving tabindex, arrow keys move selection (selection follows focus; moving fires the save) |
| Minimum deal size (`50%+` / `40%+` / `30%+`) | `PATCH /api/account/alerts` `{ alertMinDiscount }` | Same radiogroup pattern, `aria-label="Minimum deal size"` |
| City pills (20 markets) | `PATCH /api/account/watchlist` `{ op, city }` | Toggle buttons with `aria-pressed`; normal tab order (they are independent toggles, not radios) |

Visual states of the pills themselves are **unchanged** from the current implementation (selected: `--primary` bg / white text; unselected: white bg + `--line-ivory` border; the 30/40/50 and instant/daily/off styling stays exactly as is). What changes is *when* the state persists.

**Per-group status line.** Each of the three groups gets one status element directly under its pill row:

```
mt-1.5 min-h-[18px] text-[12px] leading-[18px]   (aria-live="polite")
```

| Condition | Copy | Style |
|---|---|---|
| In-flight > 300ms (skip flash for fast saves) | `Saving…` | `text-[color:var(--ink-faint)]` |
| Saved | `Saved` | `text-[color:var(--primary)] font-medium`; auto-clears after 2s |
| Error | `Couldn’t save. Your change was undone — try again.` | `text-[color:var(--error)] font-medium`, `role="alert"`; persists until next attempt |
| At-cap (city group only, `400 watchlist_full` race) | `You’re watching 10 cities — the maximum. Unwatch one first.` | `text-[color:var(--ink-faint)]` |

The old panel-level error paragraph (`AccountClient.tsx:157-161`) is removed in favor of these group-level lines.

**Counter & cap.** `Cities I’m watching ({n}/10)` updates immediately with the optimistic state. At 10/10, unselected city pills keep the current treatment (`disabled` + `disabled:opacity-40` is replaced by `aria-disabled` + `opacity-40`, staying focusable, click showing the at-cap status line — consistent with §2.1).

**Copy changes in the panel (final strings):**

- Section intro (`page.tsx:169-171`) becomes: `Changes save instantly.` appended → full string: `Choose how often we email you when a deal appears. Changes save instantly.`
- Helper under city pills (unchanged): `Select none to watch every destination.`
- Everything else in the panel keeps its current copy: `Frequency`, `Instant`, `Daily digest`, `Off`, `Minimum deal size`, `50%+`, `40%+`, `30%+`, `Cities I’m watching (n/10)`.

### 3.3 States summary — account panel

- **Default:** server-rendered with subscription data (unchanged).
- **Loading:** none on mount (server-rendered); per-group `Saving…` only, >300ms.
- **Error:** per-group revert + error line (above). No global error banner.
- **Empty watchlist:** existing helper line covers it.
- **375px:** pill rows already `flex-wrap gap-2`; unchanged. Status lines add 18px fixed height per group — no shift.
- **1280px:** panel max-w-[680px]; unchanged.
- **Keyboard:** radiogroups per WAI-ARIA radio pattern; city toggles plain buttons with `aria-pressed`; global focus ring applies.

---

## 4. D4 — Account link in `/deals/[dealId]` nav

The deal-detail nav (`app/deals/[dealId]/page.tsx:234-243`) right side becomes a two-link group (this is the email landing surface; it must offer a visible route to preferences):

```tsx
<div className="flex items-center gap-4">
  <a href="/deals" className="flex min-h-[44px] items-center text-caption font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]">
    ← Back to deals
  </a>
  <a href="/account#alerts" aria-label="Your account"
     className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">
    {/* person icon — copy the exact SVG used in LandingNav.tsx (line ~46) for visual parity */}
  </a>
</div>
```

- Icon-only with `aria-label="Your account"`, identical to the `LandingNav` pattern on `/deals` — consistency over novelty.
- Render the account icon **always** (it points to `/account`, which redirects to `/login` when signed out — acceptable and consistent with `LandingNav`).
- Apply to both the normal branch and `LockedDealDetail`’s nav? **No** — locked page targets non-premium visitors whose next step is `/join`; leave its nav unchanged.
- **375px:** logo left; two 44px targets right; total right-group width ≈ 150px — fits with room to spare at 320px.

---

## 5. D2 — `DealAlert` email footer

`lib/email/templates/DealAlert.tsx`. Recipients of this template are always `alert_preference = 'instant'` (`sendDealAlert.ts:52`), so “Switch to daily digest” is always meaningful here. `DailyDigest.tsx` footer is **unchanged** in this ticket (its per-city actions are a follow-up; D2 scopes DealAlert).

### 5.1 New footer block

Insert **above** the existing footer line (after the `<Hr>`), as its own line. Two new props on `DealAlertProps`:

```ts
stopCityUrl?: string | null   // present only when city ∈ recipient's non-empty watchlist
switchDailyUrl: string
```

Rendered (11px, `#8A857D`, matching existing footer style; links `color: '#8A857D'`, default underline kept — underlines are load-bearing in email):

```
Getting too many emails? {Stop alerts for {city}} · {Switch to daily digest}
```

- `Getting too many emails?` is plain text; the two `{…}` are links. Margin: `0 0 8px`.
- Second line is the existing, untouched line: `Manage prefs · Unsubscribe · expaify.com · © 2026 expaify` — with `manageUrl` now pointing at `/account#alerts` (§3.1).
- **Conditional rendering rule:** `stopCityUrl` is `null` when the recipient’s watchlist is empty (everywhere-mode) — “stop alerts for Cancún” is not honest when no city list exists (the sender, `sendDealAlert.ts`, already selects `s.watchlist` context; it passes `null` in that case). The line then renders only the digest link: `Getting too many emails? Switch to daily digest`.
- **URL formats** (token = existing `alert_unsubscribe_token`; city as slug via `CITY_DISPLAY_TO_SLUG`):
  - `${BASE_URL}/alerts/manage?token={token}&action=stop-city&city={slug}`
  - `${BASE_URL}/alerts/manage?token={token}&action=daily`
- One-click total unsubscribe URL and behavior: **byte-for-byte unchanged**.

---

## 6. D2 — Confirm-on-landing page: `/alerts/manage`

Token-authenticated (no session), server-rendered. **GET renders a confirmation; only the form POST mutates** — email-client link scanners prefetch GETs and must never change state. Implementation shape: route-handler pair (GET renders HTML, POST performs + renders result), mirroring `app/api/alerts/unsubscribe/route.ts`; page lives at `/alerts/manage` with the POST going to `/api/alerts/manage`.

### 6.1 Shared layout

Identical shell to the unsubscribe page (`unsubscribe/route.ts:9-35`): `#FAF7F2` body, 520px main, Georgia logo `expaify.` with `#FF6B4A` dot, white `section` card (`border: 1px solid #E8E2D8; border-radius: 16px; padding: 24px`), h1 Georgia 24px, body text 14px `#5C5852`, links `#0E5A54` weight 600. Confirm button style (matches `.btn-primary` visually):

```css
display:inline-block; background:#0E5A54; color:#fff; font-weight:600; font-size:14px;
padding:12px 24px; border-radius:999px; border:none; cursor:pointer
```

Secondary action: plain link under the button (`#0E5A54`, 14px). At 375px the card is full-width minus 20px padding; button min-height 44px. Focus: UA default focus ring is acceptable on this standalone page (no global CSS), but add `outline-offset: 2px` for the button.

### 6.2 GET — validation & state resolution

1. Token must match `/^[0-9a-fA-F-]{36}$/` and resolve to a subscription row; `action` ∈ {`stop-city`, `daily`}; for `stop-city`, `city` must be a key of `CITY_SLUGS`. Anything else → **Invalid state** (§6.5).
2. Otherwise resolve to one of the states below from the subscription row. GET performs **zero writes**.

### 6.3 Action `daily` — states & final copy

| State | Condition | h1 | Body | Actions |
|---|---|---|---|---|
| **Confirm** | `alert_preference ≠ 'daily'` | `Switch to one daily email?` | `Instead of an email per deal, you’ll get a single morning digest with the best new deals for your cities.` (If current pref is `off`, body instead: `Deal alerts are currently off for this address. Confirming turns them back on as a single morning digest.`) | Button `Switch to daily digest` (POST). Secondary link `Keep things as they are` → `https://expaify.com/deals` |
| **Already daily** | `alert_preference = 'daily'` | `You’re already on the daily digest` | `This address gets one morning email with the best new deals. Nothing to change.` | Links: `Manage alert settings` → `/account#alerts` · `Browse deals` → `/deals` |
| **Success** (after POST) | write ok | `You’re on the daily digest` | `One email each morning with the best new deals — no more instant alerts.` | Links: `Manage alert settings` → `/account#alerts` · `Browse deals` → `/deals` |

### 6.4 Action `stop-city` — states & final copy

`{City}` below = display name from `CITY_SLUGS[slug]`.

| State | Condition | h1 | Body | Actions |
|---|---|---|---|---|
| **Confirm** | city ∈ watchlist ∧ `watchlist.length ≥ 2` | `Stop alerts for {City}?` | `You’ll stop getting deal alerts for {City}. Alerts for your other watched cities keep coming.` | Button `Stop {City} alerts` (POST). Secondary link `Keep {City} alerts` → `https://expaify.com/deals` |
| **Confirm — last city** | city ∈ watchlist ∧ `watchlist.length = 1` | `{City} is your only watched city` | `Stopping it turns off deal alerts entirely, since you’re not watching any other cities.` | Button `Stop all alerts` (POST — removes city **and** sets `alert_preference = 'off'`, so the empty list cannot silently mean “everywhere”). Secondary links: `Switch to daily digest instead` → `/alerts/manage?token={token}&action=daily` · `Pick different cities` → `/account#alerts` |
| **Not watching** | city ∉ watchlist (incl. everywhere-mode / already removed) | `You’re not watching {City}` | `This address doesn’t get city-specific alerts for {City}, so there’s nothing to stop.` | Links: `Manage alert settings` → `/account#alerts` · `Browse deals` → `/deals` |
| **Success** (after POST, cities remain) | write ok | `Done — no more {City} alerts` | `You’ll keep getting alerts for your other watched cities. Changed your mind? You can re-add {City} anytime.` | Links: `Manage alert settings` → `/account#alerts` · `Browse {City} deals` → `/destinations/{slug}` |
| **Success — alerts off** (after last-city POST) | write ok | `Deal alerts are off` | `We removed {City} and turned off deal alerts. Transactional account and billing emails may still be sent.` | Links: `Turn on the daily digest` → `/alerts/manage?token={token}&action=daily` · `Manage alert settings` → `/account#alerts` |

The POST re-checks state server-side (link may be stale): a POST whose precondition no longer holds renders the corresponding non-mutating state (`Not watching` / `Already daily`) rather than erroring.

### 6.5 Invalid & error states (both actions)

| State | h1 | Body |
|---|---|---|
| **Invalid link** (bad token/action/city, or token resolves to no row) — HTTP 400/404 | `This link isn’t working` | `It may have expired or been copied incompletely. You can still manage alerts from your <a href="https://expaify.com/account#alerts">account settings</a>.` |
| **Server error** (DB failure on POST) — HTTP 500 | `Something went wrong` | `Your alert settings were not changed. Please try the link again in a minute, or use your <a href="https://expaify.com/account#alerts">account settings</a>.` |

No loading states: every view is a full server-rendered document; the POST is a normal form submission (no JS required — works with images/JS disabled, which is common in email contexts).

---

## 7. D3 — Unsubscribe landing becomes a recovery surface

`app/api/alerts/unsubscribe/route.ts`. **The GET mutation is untouched** — one-click stays one-click. Only the three rendered HTML bodies change. The `html()` helper gains an optional links block appended inside the card; token is available in scope for the success case.

### 7.1 Success state (alerts turned off)

- h1 (unchanged): `Deal alerts are off`
- Body (unchanged): `You will no longer receive expaify deal alerts. Transactional account and billing emails may still be sent.`
- **New recovery block** below the body, inside the card, separated by `border-top: 1px solid #E8E2D8; margin-top: 16px; padding-top: 16px`:
  - Lead-in (14px, `#5C5852`): `Too much email, but don’t want to miss a real deal?`
  - Link list (each on its own line, 14px, `#0E5A54`, weight 600, `line-height: 2` for ≥44px effective touch spacing):
    - `Get one daily email instead` → `/alerts/manage?token={token}&action=daily` (confirm page — re-enabling requires explicit confirmation, never automatic)
    - `Manage alert settings` → `https://expaify.com/account#alerts`

### 7.2 Invalid-link state (400)

Copy becomes (the previously dead “account page” mention becomes a real link):
`This unsubscribe link is invalid. You can still manage alerts from your <a href="https://expaify.com/account#alerts">account settings</a>.`

### 7.3 Expired/not-found state (404)

`This unsubscribe link has expired or was already removed. You can still manage alerts from your <a href="https://expaify.com/account#alerts">account settings</a>.`

No other changes: same shell, same styles, usable at 375px (single column card) and 1280px (520px centered).

---

## 8. State × surface matrix (TEST checklist)

| Surface | Default | Loading/pending | Error | Empty/at-cap | 375px | 1280px | Keyboard/focus |
|---|---|---|---|---|---|---|---|
| Watch pill — destination page | §2.1 default/watching | spinner-in-pill, `aria-busy` | revert + `role="alert"` line | at-cap `aria-disabled` + helper link; hidden for non-premium | own row under h1 | same | button, `aria-pressed`, global ring |
| Watch pill — deal detail | same | same | same | same; absent on locked page | own row under title block | same | same |
| Account panel | server-rendered | per-group `Saving…` >300ms | per-group revert + alert line | 10/10 pill treatment; empty-list helper | wrap rows + fixed-height status lines | max-w 680px | radiogroups ×2, toggles, anchor `#alerts` scrolls with 80px offset |
| Deal-detail nav | account icon | — | — | — | 44px targets | same | `aria-label="Your account"` |
| DealAlert email | 2-line footer | — | — | stop-city link omitted when watchlist empty | 540px container scales | — | underlined links |
| `/alerts/manage` | confirm views §6.3–6.4 | none (full page loads) | invalid 400 / error 500 views | not-watching & already-daily views; last-city flow | 520px fluid card, 44px button | centered | native form, no JS required |
| Unsubscribe landing | success + recovery block | — | invalid/expired with live links | — | fluid card | centered | link list, `line-height: 2` |

Regression guards: `/deals` filter dropdown unchanged after city-list consolidation; onboarding flow still saves via `/api/onboarding`; one-click unsubscribe still flips `alert_preference` to `off` on first GET.

---

## 9. Out of scope (explicitly not designed)

- Per-deal saves/bookmarks; `DailyDigest` per-city footer actions; exclusion lists (“everywhere except X”); `alertTimezone` UI; reordering `/account` sections; any change to `LockedDealDetail` or join/upsell surfaces; new notification channels.

---

**Next stage:** `UI-WATCHLIST-UX-01` — implement §2–§4 (components, account panel rework, nav link) and the template/HTML changes in §5–§7 that are pure markup; then `DEV-WATCHLIST-UX-01` for §1 route adoption, §6 token routes, and sender changes in `lib/email/sendDealAlert.ts`.
