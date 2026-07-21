# UXDES-SOLD-OUT-RECOVERY-01: Sold-Out Deal Recovery — Design Spec

**Ticket:** UXDES-SOLD-OUT-RECOVERY-01 · **Stage:** UXDES · **Priority:** P1
**Upstream:** `docs/pipeline/sold-out-recovery/01-discovery.md`, `docs/pipeline/sold-out-recovery/02-research.md`
**Feature slug:** `sold-out-recovery`

> Note: `02-research.md` landed on `main` after this worktree branched, so it is not in this
> branch's tree. It was read from `/Users/admin/dev/expaify/docs/pipeline/sold-out-recovery/02-research.md`
> during design. All directive references (D-1..D-5, F-1..F-6, §2..§7) point to that document.

---

## 0. What this spec delivers

An implementation-ready design for the "this deal is gone" state and its recovery path across
three surfaces the research brief bounds:

- **Surface 1 — deal detail** (`app/deals/[dealId]/page.tsx`): the primary defect. Suppress false
  liveness (D-1), show reason-scoped honest copy (D-2), always offer a same-city recovery action
  (D-3, Rank 1), and optionally show comparable active deals (D-4, Rank 2).
- **Surface 3 — alert landing**: the same detail page reached from an email deep link. Inherits
  every Surface-1 state, plus a single watchlist entry-point link that **defers to `watchlist-ux`**
  (Rank 3 — link only, no control built here).
- **Surface 2 — booking handoff return** (`app/book/BookingFlow.tsx` → `HotelHandoffReview`): the
  fallback destination (D-5, F-5).

Surface 4 (feed refresh, F-6) is explicitly **out of scope for UI change** per research §3 — no feed
treatment, do not re-inject expired cards. It is served by Surface-1 state when the user deep-links back.

**No flexible-date/calendar UX** (owned by `flexible-date-deal-confidence`) and **no watchlist control**
(owned by `watchlist-ux`) are designed here. See §11.

---

## 1. DEV prerequisite (blocking — the feature is inert without it)

The detail page currently cannot see a pipeline-expired deal: `getDealById`
(`lib/pipeline/dealDetection.ts:182-197`) selects neither `status` nor `market_id`, and `DealRow`
(`:154-175`) has no such fields. This is the §8 blocker.

**Required DEV change (additive, preserves the existing contract):**

1. In `getDealById`'s SELECT, add `d.status` and `d.market_id`:
   ```sql
   d.id, d.hotel_id, d.hotel_name, d.stars, d.photo_url,
   m.city, d.status, d.market_id,
   d.deal_price_cents, ...
   ```
2. Extend `DealRow`:
   ```ts
   status: 'active' | 'expired'   // pipeline status; today only these two values exist
   market_id: number              // used for the same-city comparable-deal query (Rank 2)
   ```
3. Do **not** "fix" `expires_at` to move on status flip (research §8, second bullet). The honest fix
   is reading `status` directly; `expires_at` behavior is noted for DEV but out of scope here.

The UI stage must not build against `deal.status` / `deal.market_id` until this DEV change exists.
If the UI stage runs first, gate the new logic behind a `deal.status` presence check so the page
degrades to today's behavior rather than crashing on `undefined`.

**Surface-2 optional DEV enhancement (non-blocking):** `BookingHotelContext`
(`lib/booking/config.ts:18-33`) carries no `city`/`market_id` — only `name`, `location`,
`providerUrl`. So the F-5 fallback cannot be city-scoped without adding a `city` field to that
context and its parser. See §8. Absent that, F-5 still ships as `/` → `/deals` (a strict improvement).

---

## 2. Reason model — the single source of "is this deal gone" at render time

Three backend-confirmed reasons (research §2). A and B collapse into one `status='expired'` value
with **no stored reason code**, so they are indistinguishable at read time and share one message.
C is separately reconstructable from `check_in_date`.

Compute one derived object at the top of `DealDetailPage`, replacing the date-only `isExpired`
(`page.tsx:222`) as the authoritative liveness gate:

```ts
const now = Date.now()

// Reason C is reconstructable: check-in date is in the past.
const checkInPassed = deal.check_in_date
  ? new Date(deal.check_in_date + 'T00:00:00').getTime() < startOfTodayMs()
  : false

// Legacy date-only signal, retained as an additional "gone" trigger.
const dateExpired = deal.expires_at ? new Date(deal.expires_at).getTime() < now : false

// Authoritative: pipeline flipped the deal, OR either date signal fired.
const isGone = deal.status === 'expired' || checkInPassed || dateExpired

// Reason bucket drives copy only (never inventory claims).
const goneReason: 'dates-passed' | 'no-longer-active' | null =
  !isGone ? null : checkInPassed ? 'dates-passed' : 'no-longer-active'
```

Rules:

- `isGone === true` ⇒ **suppress all live/actionable price + OTA UI** (D-1) and render the recovery
  state (§4). This supersedes the current `isExpired ? … : hasOtaLinks ? … : …` branch (`page.tsx:337-361`).
- `goneReason === 'dates-passed'` ⇒ reason-C copy. `'no-longer-active'` ⇒ reason-A/B copy (D-2).
- When `deal.status` is `undefined` (DEV change not yet merged), fall back to
  `isGone = checkInPassed || dateExpired` so the page never regresses.
- The existing `isStale` (48h+) and `isAging` (30–48h) banners (`page.tsx:226-227`, `:254-262`,
  `:326-330`) apply **only when `!isGone`**. A gone deal must not also show a "price checked N min
  ago" line — that is the trust inversion in research §2. Guard those with `!isGone`.

---

## 3. Copy system (every visible string, honest, no invented inventory)

Hard rule (discovery constraint 1, research §5.1): **never** render "sold out," "no rooms left,"
"last room," "N left," or any real-time-inventory claim. The MVP has zero inventory data. Name only
what `status`/`check_in_date` support.

### 3.1 Surface 1 & 3 — recovery panel copy

| Slot | Reason A/B (`no-longer-active`) | Reason C (`dates-passed`) |
|---|---|---|
| **Eyebrow** (uppercase label) | `No longer available` | `Dates have passed` |
| **Heading** (h2) | `This deal is no longer active` | `These dates have passed` |
| **Body** | `The discounted price we found is no longer confirmed. The provider is the source of truth for current price and availability.` | `The check-in date for this deal has passed. Here are current deals in {city} instead.` |
| **Primary CTA** | `See current deals in {city}` | `See current deals in {city}` |
| **Primary CTA (no city slug)** | `See current deals` | `See current deals` |

Notes:

- `{city}` = `deal.city` (already loaded). If `deal.city` is empty, drop " in {city}" and use the
  no-city variant.
- The A/B body deliberately does not assert *which* of "price recovered" vs "thin history" — both are
  true as "no longer confirmed at the discount we found" (research §5.1).
- Tone: a firmer, more specific member of the existing stale/expired family (research §5.3) — not
  louder or alarmist. Reuse the provider-as-source-of-truth voice already in `page.tsx:331-333`.

### 3.2 Rank-2 comparable-deals section (§5)

- **Heading (h3):** `Still available in {city}`
- **Empty:** section is **absent** (not rendered), never a spinner or an error. No "no alternatives" copy.
- **Sub-note under heading:** `Active deals in the same city, verified against their 60-day price history.`
  (Explainable per constraint 3 — same city, `status='active'`.)

### 3.3 Rank-3 watchlist entry point (link only — defers to `watchlist-ux`)

Rendered only for signed-in members on the alert-landing/gone state. A single tertiary link:

- **Label:** `Manage alerts for {city}`
- **Target:** the watchlist/account destination owned by `watchlist-ux`. **Do not build a control
  here.** If `watchlist-ux` has not shipped a stable destination, render the link to `/account`
  (the account root) or omit it entirely — omission is acceptable and preferred over a dead link.
  This is an *entry point only* (research §4 F-4, §6 Rank 3).

### 3.4 Surface 2 — booking handoff (`HotelHandoffReview`)

The `Continue to provider` primary action and its copy are unchanged. Only the secondary action changes:

- **Secondary label:** `Back to hotel deals` (replacing `Back to search`)
- **Secondary target:** `/destinations/{slug}` when a slug exists for the handoff city (requires the
  §8 DEV enhancement); otherwise `/deals`. Never `/` for this path.
- **Optional affordance** (tertiary, below the two buttons): a single line —
  `Rate didn't match on the provider site? See current hotel deels →` … *correct to:*
  `Rate didn't match on the provider site? See current hotel deals →` linking to the same target.
  This designs for the *likelihood* of a failed handoff without claiming to detect one (research §3
  Surface 2, D-5). It does not create a callback and must not imply expaify knows the handoff failed.

---

## 4. Surface 1 & 3 — deal detail: full state machine

The detail page keeps its nav, hero photo, title block, "Why this is a deal," and "Stay details"
sections. The change is concentrated in two zones: the **price + primary-action zone**
(`page.tsx:314-361`) and a **new comparable-deals section**.

### 4.1 State table

| State | Trigger | Price block | Primary action zone | Extras |
|---|---|---|---|---|
| **Live (default)** | `!isGone` | Current live `PriceBlock` + reassurance line as today | `CompareRow` (if `hasOtaLinks`) or "Provider link unavailable" panel as today | `isStale`/`isAging` banners as today |
| **Gone — no longer active** | `isGone && goneReason==='no-longer-active'` | Muted, non-actionable (see §4.3) | **RecoveryPanel** (§4.2) — reason A/B copy | Rank-2 section if any; Rank-3 link if member; **no** reassurance/stale lines |
| **Gone — dates passed** | `isGone && goneReason==='dates-passed'` | Muted, non-actionable | **RecoveryPanel** — reason C copy | Same as above |
| **Locked (paywall)** | `!premium && !unlocked` | (unchanged `LockedDealDetail`) | — | Precedes all gone logic; unchanged |

`isGone` supersedes `hasOtaLinks` — a gone deal with OTA links must **not** render a clickable
`CompareRow` (D-1). The `notFound()` path for a missing deal (`page.tsx:206`) is unchanged.

### 4.2 RecoveryPanel — anatomy, hierarchy, tokens

New component. Suggested location `app/components/ui/DealRecoveryPanel.tsx`. Server-safe (no client
state). Replaces the current `isExpired`/`hasOtaLinks`/empty-links branch as the primary action zone.

**Hierarchy (top to bottom):**
1. Eyebrow label (tertiary) — reason label, uppercase.
2. Heading (primary) — reason heading.
3. Body (secondary) — one honest sentence.
4. Primary CTA (primary action) — same-city recovery, full-width.
5. Rank-3 link (tertiary, members only) — manage alerts.

**Structure & Tailwind (reuse the existing expired-panel envelope, `page.tsx:337-346`):**

```tsx
<div
  role="status"
  className="my-8 rounded-[var(--radius-card)] border border-[color:var(--line-white)] bg-[color:var(--surface)] p-5"
>
  {/* analytics — mirrors existing TrackOnMount usage at page.tsx:256 */}
  <TrackOnMount event="deal_gone_state_viewed" props={{ dealId, reason: goneReason }} />

  <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
    {eyebrow}
  </p>
  <h2 className="mt-1 text-h3 text-[color:var(--ink)]">{heading}</h2>
  <p className="mt-1.5 text-caption leading-5 text-[color:var(--ink-soft)]">{body}</p>

  {/* Rank 1 — always present */}
  <a href={sameCityHref} className="btn btn-primary mt-4 block w-full text-center">
    {primaryCtaLabel}
  </a>

  {/* Rank 3 — members only, defers to watchlist-ux; omit if no stable destination */}
  {showWatchlistLink && (
    <a href={watchlistHref}
       className="mt-3 block text-center text-[13px] font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">
      Manage alerts for {city}
    </a>
  )}
</div>
```

Token/style rules:
- Border `--line-white` (slightly firmer than the `--line-ivory` used on neutral panels) signals a
  state change without alarm color. **Do not** use `--error`/`--accent` as the panel frame — a gone
  deal is not an error, and the existing expired panel uses a neutral surface (research §5.3).
- Reserve `--error` (`--accent`) only for the small inline "Expired {date}" marker already in the
  title row (`page.tsx:303-307`); keep that behavior, now gated on `isGone && deal.expires_at`.
- `btn btn-primary` is the existing token class used by the current expired CTA (`page.tsx:343`).

### 4.3 Suppressing false liveness on the price block (D-1)

When `isGone`, the price zone must read as historical reference, not a live offer:

- Keep `PriceBlock` visible (users want to know what the deal *was*), but wrap it so it is visually
  de-emphasized and clearly past-tense:
  ```tsx
  <section className="mt-6 opacity-70">
    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
      Last found rate
    </p>
    <PriceBlock size="display" dealPrice={…} medianPrice={…} />
    <p className="mt-2 text-caption leading-5 text-[color:var(--ink-faint)]">
      This is the rate when the deal was active. It is no longer confirmed.
    </p>
  </section>
  ```
- **Remove** on gone deals: the `showSavings` "Save $X/night" line (`page.tsx:321-325`), the
  "Price checked {checkedAgo}" reassurance line (`page.tsx:326-330`), and the standard
  before-taxes note. These all assert liveness. Gate each with `!isGone`.
- **Do not render** `CompareRow` or any OTA anchor when `isGone` (the core D-1 test).

### 4.4 Rank-2 comparable-deals section (D-4, non-blocking)

New server component `StillAvailableInCity`, rendered **inside a `<Suspense fallback={null}>`** below
the RecoveryPanel — it must never block the gone state from painting (mirrors the existing
`PriceHistorySection`/`DealScoreSection` Suspense pattern, `page.tsx:364-371`).

Data (no provider call, one indexed read — research §6 Rank 2):

```ts
async function StillAvailableInCity({ deal }: { deal: DealRow }) {
  if (!deal.market_id) return null            // needs the §1 DEV change
  const rows = await getActiveDeals({ marketId: deal.market_id, limit: 4, includeMock: false })
                 .catch(() => [])
  const alternatives = rows.filter(r => r.id !== deal.id).slice(0, 3)   // exclude self + mock (getActiveDeals already excludes mock)
  if (alternatives.length === 0) return null   // absent, not empty-state, not spinner
  // render up to 3 cards
}
```

Rendering:
- Section wrapper `mt-8`, heading `text-h3` "Still available in {city}", sub-note per §3.2.
- Each alternative uses a **link card** to `/deals/{id}`: hotel name (h4/`text-[15px] font-bold`),
  `StarRow` + city + `check_in_window` meta row (reuse the title-block meta pattern,
  `page.tsx:297-302`), and `PriceBlock size="compact"` (or the inline price treatment used in
  `HotelCard`). Card frame: `card` class (`page.tsx:374`) with hover `hover:border-[color:var(--primary)]`.
- 1 column on mobile, up to 3 columns at `min-[680px]` (`grid grid-cols-1 gap-3 min-[680px]:grid-cols-3`),
  matching the page's existing 680px breakpoint (`page.tsx:265,406`).
- Cards are explainable-only: same `market_id`, `status='active'`, real (`is_mock=false`). No ranking
  beyond `getActiveDeals`' existing `newest` order. No star-class filtering in v1 (optional later via
  `minStars`); keep it simple and traceable (constraint 3).

### 4.5 Same-city href logic (Rank 1 — the always-present action)

**Critical correction to research §6:** `/deals` does **not** read a `city` query param —
`app/deals/page.tsx` takes no params and renders `<DealFeed initialDeals={…} />` with no
`defaultCity`. Only `/destinations/[slug]` pre-filters by city (it passes `defaultCity={displayName}`).
So the honest same-city link must resolve to a slug:

```ts
import { CITY_DISPLAY_TO_SLUG } from '@/lib/cities'
const slug = deal.city ? CITY_DISPLAY_TO_SLUG[deal.city] : undefined
const sameCityHref = slug ? `/destinations/${slug}` : '/deals'
```

- When a slug exists (the 20 tracked cities, `lib/cities.ts`): link to `/destinations/{slug}` and use
  the "in {city}" copy.
- When no slug exists (or `deal.city` empty): link to `/deals` and use the no-city copy. This still
  fixes the current context-drop defect — the CTA is honest about what it can carry.
- This replaces the current context-free `/deals` CTA (`page.tsx:343`) on every gone state (D-3 test).

---

## 5. Surface 2 — booking handoff return (F-5 / D-5)

Change is minimal and localized to `HotelHandoffReview` (`BookingFlow.tsx:481-522`). No new failed-
handoff detection (out of scope — no callback exists, research §8).

- **Secondary button** (`BookingFlow.tsx:515-517`): change `href="/"` → the city-scoped target when a
  city is available on `hotelContext` (requires §8 DEV enhancement adding `city`), else `/deals`.
  Change label `Back to search` → `Back to hotel deals`. Keep the existing `secondaryButtonCls`.
- **Optional tertiary affordance** below the action stack (`actionStackCls`):
  ```tsx
  <a href={recoveryHref}
     className="mt-3 block text-center text-sm font-medium text-[color:var(--text-2)] hover:text-[color:var(--brand)]">
    Rate didn't match on the provider site? See current hotel deals
  </a>
  ```
  Copy must not claim expaify detected a failure — it offers a path *in case* the rate didn't hold.
- The `Continue to provider` primary action, its aria-label, and `hotelTermsCopy` are unchanged.
- If §8 DEV enhancement is not taken this cycle, ship the `/` → `/deals` change alone. Do **not**
  invent a city the context does not carry (constraint: no invented data).

---

## 6. Every-state coverage (loading / empty / error / responsive / focus)

| State | Behavior |
|---|---|
| **Loading** | The gone state is server-rendered from `getDealById` — it paints with the page, no spinner. Rank-2 `StillAvailableInCity` streams in a `<Suspense fallback={null}>`; its absence during load shows *nothing* (never a blocking spinner). |
| **Empty** | Rank-2: zero same-city active deals ⇒ section not rendered (§4.4). Rank-1 is always present, so the gone state is never a dead end. |
| **Error** | If `getActiveDeals` throws in Rank-2, `.catch(() => [])` ⇒ section absent. The gone state and Rank-1 CTA are unaffected. If `getDealById` throws, existing `.catch(() => null)` ⇒ `notFound()` (unchanged). |
| **Mobile 375px** | RecoveryPanel `p-5`, full-width CTA (`block w-full`), CTA min height from `btn` (≥44px). Rank-2 grid collapses to 1 column. No horizontal scroll; body copy wraps. Price block `opacity-70` block stacks above the panel. |
| **Desktop 1280px** | Page stays within `max-w-[760px]` main (`page.tsx:251`). Rank-2 shows up to 3 columns at ≥680px. RecoveryPanel spans the content column. |
| **Focus / keyboard** | Rank-1 CTA and Rank-3 link are native `<a>` — focusable in DOM order (panel → CTA → watchlist link → Rank-2 cards). Focus ring comes from the global `--focus-ring` token already applied to `.btn` and links. Rank-2 cards are anchors, tab-reachable, with visible focus. |

**Tab order on a gone deal:** nav "Back to deals" → ShareButton → Rank-1 CTA → Rank-3 link (if shown)
→ Rank-2 alternative cards (top to bottom) → remaining page sections. No focus trap; no auto-focus
move (the state is not an error interruption, unlike `InvalidHotelState`).

---

## 7. Interaction rules

- **Tap / click / Enter on Rank-1 CTA** → navigate to `sameCityHref` (same-tab; internal route).
- **Tap / Enter on Rank-2 card** → navigate to `/deals/{alternativeId}` (same-tab).
- **Tap / Enter on Rank-3 link** → navigate to the watchlist/account destination (defer to
  `watchlist-ux`); same-tab.
- **No client-side retry / refetch control** on the detail page — a gone deal does not "come back"
  within a session; the recovery path is lateral (same-city), not a reload. (Contrast with the
  booking flow's `Review details again`, which is a different flow.)
- **Surface 2 secondary / tertiary** → same-tab internal navigation to the recovery feed. The
  `Continue to provider` primary remains a new-tab external `sponsored` link (unchanged).

---

## 8. Data & prerequisites summary (for UI + DEV handoff)

**Blocking (DEV, §1):** `getDealById` must SELECT `d.status` and `d.market_id`; `DealRow` gains
`status: 'active' | 'expired'` and `market_id: number`. Without `status`, the page cannot detect
reasons A/B; without `market_id`, Rank-2 cannot run. Additive; preserves the contract.

**Non-blocking (DEV, optional, Surface 2):** to make the F-5 fallback city-scoped, add a `city` (and
optionally `market_id`) field to `BookingHotelContext` (`lib/booking/config.ts`) and its parser
(`parseBookingHotelContext`). Until then, F-5 ships `/` → `/deals`.

**No new provider integration, no new table, no new index** — Rank-2 reuses the existing
`idx_deals_market (market_id, status)` via `getActiveDeals({ marketId })` (research §6). All recovery
data is already computed and stored (constraints 3, 4).

**Non-negotiable contract check:** no component calls a vendor API (Rank-2 goes through
`lib/pipeline`), money stays `{ priceCents, currency }` via existing `PriceBlock`/`formatMoney`,
outbound OTA links keep their `sponsored` markers (unchanged), no new secrets. Compliant.

---

## 9. Analytics (mirror existing `TrackOnMount` usage)

- `deal_gone_state_viewed` — `{ dealId, reason: 'no-longer-active' | 'dates-passed' }` on RecoveryPanel
  mount (mirrors `deal_stale_banner_viewed`, `page.tsx:256`).
- `deal_recovery_same_city_click` — `{ dealId, city, target: 'destinations' | 'deals' }` on Rank-1 CTA
  (optional, if a click-tracking wrapper exists; do not add a new tracking mechanism just for this).
- Rank-2 impressions/clicks are optional and should reuse whatever the existing deal cards use; do not
  invent new instrumentation.

## 10. Edge cases

- **Deal gone but no city** (`deal.city` empty): Rank-1 → `/deals`, no-city copy; Rank-2 absent
  (no `market_id` join city). Still not a dead end.
- **Deal gone, `expires_at` still future, `updated_at` fresh** (the F-1 trust inversion): `isGone`
  is driven by `status`, so the gone state fires correctly and the "checked just now" line is
  suppressed (§4.3).
- **Deal gone AND stale/aging by date**: `isGone` wins; stale/aging banners are suppressed (`!isGone`
  guard) so the user sees one clear message, not two competing ones.
- **`check_in_date` passed but `status` still `active`** (nightly sweep hasn't run): `checkInPassed`
  independently sets `isGone` with reason C — the page is correct ahead of the pipeline.
- **Free/anonymous user on a locked gone deal**: `LockedDealDetail` renders first (`page.tsx:211-216`)
  and is unchanged — the paywall takes precedence; gone logic never runs for locked non-unlocked deals.
- **Rank-2 returns only the current (now-expired) deal's hotel**: excluded by `r.id !== deal.id`;
  if that leaves zero, section absent.
- **Signed-out user on gone state**: Rank-3 watchlist link hidden (members only).

## 11. Out of scope / boundaries (do not cross)

- **No flexible-date / calendar UX.** "These dates have passed" states a fact and must not spawn a
  date picker or "try nearby dates" (constraint 2, owned by `flexible-date-deal-confidence`). Recovery
  points to alternative hotels / the city feed only.
- **No watchlist control.** Only a single entry-point link, deferring to `watchlist-ux` (§3.3). The
  missing account link in the deal nav is `watchlist-ux` scope.
- **No feed (Surface 4) change.** Do not re-inject expired cards or add a "a deal you saw is gone"
  diff (research §3 Surface 4, F-6).
- **No failed-handoff detection.** Surface 2 designs the *fallback*, not detection (no callback exists).
- **No black-box recommendations.** Rank-2 is same-city, `status='active'`, real deals only.

## 12. Acceptance mapping (for TEST)

- **D-1** — gone deal renders no clickable `CompareRow`/OTA anchor and no "Continue to provider" from
  the detail page → §4.1, §4.3.
- **D-2** — no rendered string contains "sold out"/"rooms"/inventory claims; reason-C copy differs
  from reason-A/B copy → §3.1.
- **D-3** — every gone state's primary CTA carries the city (`/destinations/{slug}`), no context-free
  `/deals` when a slug exists → §4.5.
- **D-4** — Rank-2 section is absent (not errored, not a blocking spinner) when no same-city active
  deals exist; present and correct when they do; excludes self and mock → §4.4.
- **D-5** — Surface-2 secondary routes to a city/feed destination, never `/` → §5.

---

## 13. Handoff

Create `UI-SOLD-OUT-RECOVERY-01` (UI implementation) **and** `DEV-SOLD-OUT-RECOVERY-01` (the §1
`getDealById` `status`/`market_id` prerequisite, plus optional §8 `BookingHotelContext.city`). The DEV
change is a prerequisite for the UI work; sequence DEV before or alongside UI so the UI stage does not
build against data it cannot read (research §8).
