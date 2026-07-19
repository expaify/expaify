# 03 — UX Design: deal feed empty state & freshness signals

**Ticket:** UXDES-DEAL-EMPTY-STATE-01 · **Stage:** UXDES · **Date:** 2026-07-19
**Upstream:** `docs/pipeline/deal-empty-state/02-research.md` (directives D1–D5)
**Surfaces:** `DealCard`, `/deals/[dealId]`, `DealFeed` (`/deals` + city-scoped), `/destinations/[city]`

---

## 0. Decisions made in this spec

| # | Decision | Rationale |
|---|---|---|
| 1 | **D5: mock fallback is kept, demoted to 3 explicit samples** below an honest empty state — not removed. | A blank top-of-funnel page shows nothing of the product; three clearly-framed samples demonstrate card anatomy without fabricating inventory. |
| 2 | Feed cards show **only** "checked Xh ago" (price recency). "found Xd ago" survives only on the detail-page hero. | Research §6: verification recency is the trust signal; two time claims overload a card. |
| 3 | D4 authed capture splits into **premium** (one-tap Watch) and **free** (Premium upsell framed as alerts), because `PATCH /api/account/watchlist` is premium-gated (`app/api/account/watchlist/route.ts:19–21`). | Watchlist + daily digest are premium features today; a free-user "Watch" tap would 403. |
| 4 | Hidden-count in D3 is **spec'd but conditional**: it renders only when the API provides `unfilteredTotal`. Adding that field is an optional DEV enhancement, not a UI blocker. | `/api/deals` currently returns `total = page length` (`route.ts:141`); the unfiltered count needs a second query. |
| 5 | A single shared `timeAgo` helper (`lib/timeAgo.ts`) returns `string | null` — `null` in → `null` out. Both existing duplicates are replaced. | D1's never-fabricate rule must be structural, not a call-site convention. |

---

## 1. Shared foundations

### 1.1 Data: `updatedAt` end to end (D1)

Add `updatedAt: string | null` to `ApiDeal` in **both** type declarations
(`app/deals/DealFeed.tsx:41–59`, `app/api/deals/route.ts:10–29`) and populate
`updatedAt: row.updated_at` in **all three** `toApiDeal` mappings — locked
**and** unlocked branches (a check timestamp is not identifying; paywall
masking is unaffected):

- `app/api/deals/route.ts` `toApiDeal`
- `app/deals/page.tsx` `toApiDeal`
- `app/destinations/[city]/page.tsx` `toApiDeal`

Mock/sample deals set `updatedAt: null` and `firstSeen: null` explicitly.

While editing `route.ts`, also fix `firstSeen: string` → `string | null` to
match the other two copies (it already receives null from the DB).

### 1.2 Helper: `lib/timeAgo.ts`

```ts
/** Relative time for freshness labels. Null/undefined in → null out: callers
    must render nothing rather than a fabricated "today". Future timestamps
    (clock skew) clamp to "just now". */
export function timeAgo(iso: string | null | undefined): string | null
```

Rules: `null`/`undefined`/unparseable → `null`; diff ≤ 0 or < 2 min →
`"just now"`; < 60 min → `"{m}m ago"`; < 24 h → `"{h}h ago"`; 24–47 h →
`"yesterday"`; else `"{d}d ago"`.

Delete the local duplicates in `app/components/ui/DealCard.tsx:35–44` and
`app/deals/[dealId]/page.tsx:36–45`; import the shared helper. **No call site
anywhere may render a time string when the helper returns null.**

### 1.3 Analytics contract

No analytics vendor is wired today. Create `lib/analytics.ts`:

```ts
export function track(event: string, props?: Record<string, string | number | boolean>): void
```

No-op in production until a vendor is configured; `console.debug` in
development. UI instruments the call sites now so events flow the day a
vendor lands. Event names (view events fire once per mount, guarded):

| Event | Props | Fires when |
|---|---|---|
| `feed_empty_filtered_viewed` | `activeFilterCount`, `hiddenCount?` | Filtered-empty block mounts |
| `feed_empty_cold_viewed` | `sampleCount` | Cold-DB empty + samples block mounts |
| `city_empty_viewed` | `city`, `tier` (`anonymous` \| `free` \| `premium` \| `premium_watching`) | City zero-deal state mounts |
| `feed_clear_all_clicked` | `source: 'empty_state'` | Clear-all button activated |
| `feed_filter_chip_removed` | `filter` (e.g. `city`, `minDiscount`) | Inline chip removed |
| `city_watch_clicked` | `city` | Watch button activated |
| `city_watch_saved` / `city_watch_failed` | `city` | PATCH resolves / rejects |
| `city_join_cta_clicked` | `city`, `tier` | Join/upgrade CTA activated |
| `deal_stale_banner_viewed` | `dealId`, `hoursSinceCheck` | ≥48h warning banner mounts |

The three `*_empty_*_viewed` names are the required disambiguation of
filtered-empty vs cold-empty vs city-empty.

### 1.4 Tokens used (from `app/globals.css` — no new colors, no new sizes)

`--surface` `--bg` `--ink` `--ink-soft` `--ink-faint` `--primary`
`--primary-soft` `--gold` `--gold-text` (≡ `--warning`) `--warning-soft`
`--error` `--line-ivory` `--line-white` `--radius-card` `--radius-pill`
`--radius-input` `--focus-ring` · classes `.btn .btn-primary .btn-outline
.card .text-h3 .text-caption .skeleton .spinner`. Files that already use the
alias layer (`--text-1/--text-2/--border/--brand`, city page) keep their
convention.

---

## 2. Surface: `DealCard` price-recency label (D1)

The image-corner pill at `DealCard.tsx:103–105` changes meaning: **found →
checked**, `firstSeen` → `updatedAt`.

Prop change (additive): `DealCardDeal` gains `updatedAt?: string | null`.
`firstSeen` stays in the type for the detail page but the card no longer
renders it.

### States

- **With timestamp** (`timeAgo(updatedAt) !== null`):

  ```tsx
  {checked !== null && (
    <span
      className="absolute right-3 top-3 rounded-[var(--radius-pill)] bg-[color:color-mix(in_srgb,var(--ink)_78%,transparent)] px-2 py-1 text-[11px] font-medium leading-none text-[color:var(--bg)]"
      title={/* absolute: "Jul 19, 2026, 04:12 AM" */}
    >
      checked {checked}
    </span>
  )}
  ```

  Copy: `checked just now` / `checked 32m ago` / `checked 3h ago` /
  `checked yesterday` / `checked 3d ago`. `title` carries the absolute
  datetime for hover/long-press.

- **Null timestamp** (mocks, missing data): **pill absent entirely.** No
  fallback text. The top-left `DealChip` is unaffected.
- **Loading:** unchanged — `SkeletonCard` already covers the card; no
  separate pill skeleton.
- **375px / 1280px:** pill is ≤ ~110px wide at its longest string
  ("checked yesterday"); no overlap with `DealChip` at 375px (chip left,
  pill right, 160px image height — same geometry as today).
- **Focus:** pill is non-interactive; no focus state. Card link focus ring
  unchanged.

Also delete the `"Preview deal"` caption block (`DealCard.tsx:159–161`) —
superseded by §6's sample framing.

---

## 3. Surface: `/deals/[dealId]` staleness tiers (D2)

Replace the 6h logic at `app/deals/[dealId]/page.tsx:220–222` with tiers
calibrated to the daily 4am UTC pipeline:

```ts
const HOURS = 3600 * 1000
const checkedAt = deal.updated_at ? new Date(deal.updated_at).getTime() : null
const hoursSinceCheck = checkedAt !== null ? (now - checkedAt) / HOURS : null
const freshness: 'fresh' | 'aging' | 'stale' | null =
  isExpired || hoursSinceCheck === null ? null
  : hoursSinceCheck < 30 ? 'fresh'      // one missed-run grace
  : hoursSinceCheck < 48 ? 'aging'
  : 'stale'
```

The 6h constant no longer exists. `null` `updated_at` → no freshness UI at
all (never fabricate). Expired deals show only the existing expired banner.

### 3.1 Freshness line (fresh + aging) — joins the price block

Insert directly after the savings line inside the Price section
(`page.tsx:306–320`), before the "Nightly rate before taxes…" caption:

- **fresh** (< 30h) — quiet:

  ```tsx
  <p className="mt-2 text-caption font-medium leading-5 text-[color:var(--ink-faint)]"
     title={fmtDate(deal.updated_at)}>
    Price checked {timeAgo(deal.updated_at)}
  </p>
  ```

- **aging** (30–48h) — same line, token-level emphasis, still **no banner**:

  ```tsx
  <p className="mt-2 text-caption font-semibold leading-5 text-[color:var(--warning)]"
     title={fmtDate(deal.updated_at)}>
    Price checked {timeAgo(deal.updated_at)} — verify with the provider
  </p>
  ```

- **stale** (≥ 48h) — the line is replaced by the banner (§3.2).

Consequential move: the buried `Updated {date}` at `page.tsx:382–385` is
removed from the "Why this is a deal" footer. That footer keeps only
`Expires {fmtDate(expires_at)}` when present; when there is no expiry, the
footer `<p>` is omitted entirely.

### 3.2 Warning banner (stale only, ≥ 48h)

Replaces the current banner at `page.tsx:248–255`. Same position (top of
`<main>`), warning-toned instead of neutral, **must contain the absolute
date**:

```tsx
<div role="status"
     className="mb-4 rounded-[var(--radius-card)] border border-[color:color-mix(in_srgb,var(--gold)_45%,transparent)] bg-[color:var(--warning-soft)] px-4 py-3">
  <p className="text-[13px] font-bold text-[color:var(--ink)]">Price may be out of date</p>
  <p className="mt-0.5 text-[12px] leading-5 text-[color:var(--ink-soft)]">
    We haven&rsquo;t been able to re-verify this price since {fmtDate(deal.updated_at)}.
    Check the provider for the current price and availability.
  </p>
</div>
```

Fire `deal_stale_banner_viewed` on mount (client island or inline script per
UI stage's judgment — a tiny `'use client'` wrapper is acceptable).

### 3.3 Hero "found" pill

The detail hero keeps deal age (`page.tsx:279–281`) — this is the one place
both signals coexist (research §6) — but it obeys the null rule: render only
when `timeAgo(deal.first_seen) !== null`, text `found {timeAgo}`. Null →
pill absent.

### States summary

| State | Render |
|---|---|
| fresh (<30h) | Quiet ink-faint "Price checked Xh ago" in price block; no banner |
| aging (30–48h) | Same line, `--warning` semibold + "— verify with the provider"; no banner |
| stale (≥48h) | Warning banner with absolute date; no price-block freshness line |
| `updated_at` null | No freshness line, no banner |
| expired | Existing expired banner only; freshness UI suppressed |
| 375px | Banner full-width within `max-w-[760px] px-5`; text wraps, no truncation |
| 1280px | Same, centered column |
| focus | Banner and line are non-interactive; no tab stops added |

**Acceptance (D2):** 20h → no warning; 36h → emphasized inline line, no
banner; 50h → banner containing absolute date; `6 * 3600` gone from the file.

---

## 4. Surface: `DealFeed` filtered-empty (D3)

Replaces `app/deals/DealFeed.tsx:527–542`. The 30%-opacity `SkeletonCard`
ghosts are **deleted** — no skeleton renders while any empty message is
visible. Branch on `hasActiveFilters`:

### 4.1 Filtered-empty block (premium users — the only users who can filter)

```tsx
<div role="status" className="mx-auto max-w-[480px] py-16 text-center">
  {/* funnel icon, 40px, stroke var(--primary), aria-hidden */}
  <h3 className="mt-4 font-display text-[20px] font-bold text-[color:var(--ink)]">
    No deals match your filters
  </h3>
  {typeof hiddenCount === 'number' && hiddenCount > 0 && (
    <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">
      {hiddenCount} deal{hiddenCount !== 1 ? 's are' : ' is'} hidden by your filters
    </p>
  )}
  <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">
    Remove a filter, or clear them all to see everything that&rsquo;s live.
  </p>

  {/* Inline removable chips — one per active filter */}
  <div className="mt-5 flex flex-wrap justify-center gap-2">…chips…</div>

  <button type="button" onClick={handleClearAll}
          className="btn btn-primary mt-6 min-h-[44px] px-8">
    Clear all filters
  </button>

  {defaultCity && (
    <a href="/deals" className="mt-3 block text-[13px] font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">
      See all destinations
    </a>
  )}
</div>
```

**Chips.** One per active filter, rendered from the same state that drives
the header `FilterPill`s. Each chip is a single button that removes that
filter (`applyFilter` with the reset value) and fires
`feed_filter_chip_removed`:

```tsx
<button type="button"
        aria-label={`Remove filter: ${chipLabel}`}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-pill)] border-[1.5px] border-[color:var(--primary)] bg-[color:var(--primary)] px-4 text-[13px] font-medium text-white">
  {chipLabel}
  {/* × glyph svg, 13px, aria-hidden */}
</button>
```

Chip labels (reuse the header pills' active labels): city name ·
`30%+ off` · `4★ & up` · `Under $200` (or `Under $137` for SearchBar
values) · dates as `Jun 3 – Jun 10` (format `date_from`/`date_to` with
`toLocaleDateString('en-US', { month: 'short', day: 'numeric' })`). On a
city-scoped feed (`defaultCity`) the city is fixed and gets **no chip**.

**Clear-all behavior.** One activation resets every filter and the search in
one interaction and fires `feed_clear_all_clicked`:

- default feed: existing `clearSearch()` semantics (city `''`, minDiscount
  back to 20, everything else cleared) — plus clearing the SearchBar's own
  input state if it holds text;
- city-scoped feed: identical **except** city resets to `defaultCity`, never
  `''` (a Miami page must not silently become an all-cities feed). The
  current `clearSearch` needs this one-line branch.

**Focus management.** After clear-all resolves, the block unmounts; move
focus to the results grid wrapper (`tabIndex={-1}` on the grid container,
`ref.focus()` after data arrives) so keyboard users aren't dropped to
`<body>`.

**Hidden-count.** `hiddenCount` comes from a future `unfilteredTotal` field
on the `/api/deals` response. Until DEV adds it, the line is simply not
rendered (the conditional above). Do not approximate it client-side.

### 4.2 Cold-empty (no filters) — see §6

The `!hasActiveFilters` branch becomes the honest empty block + sample
section spec'd in §6. Note the cold branch is reachable by anonymous, free,
and premium users alike.

### States summary

| State | Render |
|---|---|
| loading | Existing 6-skeleton grid, unchanged |
| error | Existing "Couldn't load deals right now." + Retry, unchanged |
| filtered-empty | §4.1 block; **no skeletons** |
| cold-empty | §6 block; **no skeletons** |
| results | Existing grid, unchanged |
| 375px | Block max-w 480px centers; chips wrap; button full-width is not required (min 44px height, ≥ 48px horizontal padding) |
| 1280px | Same centered block inside the 3-col grid area |
| focus/keyboard | Tab order: chips (DOM order) → Clear all → secondary link; all get the global `--focus-ring`; after clear-all, focus lands on the grid |

**Acceptance (D3):** one activation of Clear all returns the full feed; no
skeleton behind the message; `role="status"` present; every control
keyboard-reachable with visible focus; ≥44px targets.

---

## 5. Surface: `/destinations/[city]` zero-deal state (D4)

### 5.1 Header meta line

`page.tsx:93–95` currently always prints `Updated daily · {n} deals found`.
New rule:

- `n > 0`: `Updated daily · {n} deal{s} found` (unchanged)
- `n === 0`: **`Checked daily — no active deals right now`** (the string
  `0 deals found` must not appear anywhere on the page)

### 5.2 Empty card

Same card shell (`.card`-equivalent centered block, `px-8 py-14`), new
content. Order: headline → cause → capture (tier-dependent) → secondary
link.

```
No {city} deals right now.
We check {city} hotel prices every day — deals appear here the moment a price drops.
[ capture: see tiers ]
See all destinations   ← always present, demoted to text link when a capture CTA exists
```

Headline: `text-[15px] font-medium text-[color:var(--text-1)]`. Body:
`text-[13px] text-[color:var(--text-2)]`. Secondary link: when a capture CTA
is present, `See all destinations` drops from pill-button to
`text-[13px] font-medium text-[color:var(--brand)] hover:underline` beneath
it; when capture is hidden (§5.4 guard), it stays the existing pill button.

### 5.3 Capture tiers

The page (a server component) fetches `auth()` + `getSubscription()` and
passes `{ city, tier, watchlist }` to a new client island
`WatchCityCta` rendered inside the empty card. `tier` is derived
server-side: `anonymous` | `free` | `premium` | `premium_watching`
(watchlist already contains `city`). Fire `city_empty_viewed` with the tier
on mount.

**premium, not watching** — one-tap watch:

```tsx
<button type="button" className="btn btn-primary min-h-[44px] px-6">Watch {city}</button>
```

Tap → disable button, label `Saving…` with `.spinner`; `PATCH
/api/account/watchlist` body `{ watchlist: [...watchlist, city] }` (the
endpoint is replace-all — always send the full appended array). Fire
`city_watch_clicked`, then `city_watch_saved`/`city_watch_failed`.

- Success → replace button with confirmation (`role="status"`):
  `Watching {city} — new deals will be in your daily digest.` (13px,
  `--primary`, check icon) plus link `Manage watchlist` → `/account`.
- Error → keep button enabled, show below it (`role="alert"`,
  `text-[12px] text-[color:var(--error)]`):
  `Couldn't save — check your connection and try again.`
- Watchlist already at the 10-city cap → on tap show the same alert
  pattern with: `Your watchlist is full (10 cities). Manage it in your
  account.` with `Manage watchlist` → `/account`.

**premium_watching** — no button; confirmation state directly:
`You're watching {city} — you'll get an email when a deal appears.` +
`Manage watchlist` link.

**free (authed, not premium)** — the watchlist API 403s for this tier, so
the capture is an upgrade CTA, honestly framed:

```
Premium members get an email the moment a {city} deal appears.
[ Get {city} alerts with Premium ]  → /join   (.btn .btn-conversion, min-h 44px)
```

Fires `city_join_cta_clicked` `{ tier: 'free' }`.

**anonymous** — join-framed capture (the flight-only `AlertSignup` and
`/api/alerts` must **not** be reused here — IATA-only backend, research
§2.7):

```
Want an email when a {city} deal appears?
[ Get {city} deal alerts ]  → /join   (.btn .btn-primary, min-h 44px)
```

Fires `city_join_cta_clicked` `{ tier: 'anonymous' }`.

### 5.4 Guard

If `city` is not in the 20-city watchlist allowlist (it always is today —
`CITY_SLUGS` and the API's `CITIES` set are the same list — but the sets are
maintained separately), render no capture block, keep the existing pill
"See all destinations". UI stage should reference one shared list if
trivial; otherwise guard only.

### States summary

| State | Render |
|---|---|
| deals > 0 | Unchanged (DealFeed) — header meta unchanged |
| zero deals, anonymous | Empty card + join CTA |
| zero deals, free | Empty card + Premium alerts CTA |
| zero deals, premium | Empty card + Watch button (idle / saving / saved / error / cap-reached) |
| zero deals, premium watching | Empty card + confirmation + manage link |
| loading | Server-rendered; no client loading state. Watch tap has its own `Saving…` state |
| error (subscription fetch fails) | Treat as `anonymous`-equivalent minus capture: server falls back to hiding the capture block; page still renders |
| 375px | Card `px-8 py-14` holds; CTA min-h 44px; strings wrap without truncation |
| 1280px | Card centered in `max-w-[1200px]` column, unchanged geometry |
| focus | Tab order: capture CTA → Manage/secondary link → See all destinations; global focus ring |

**Acceptance (D4):** zero-deal render contains no `0 deals found`; premium
user watches in one tap and sees confirmed state; anonymous user sees an
email-alert path; header and card never contradict each other.

---

## 6. Surface: cold-DB samples on `/deals` (D5)

**Decision: keep, demoted.** Both fallbacks (`app/deals/page.tsx:56–83`,
`app/api/deals/route.ts:119–128`) change from "5 mocks at full parity, 2
locked" to "**3 samples, never locked, never bookable**", and `DealFeed`
renders them under explicit disclosure.

### 6.1 Detection

`DealFeed` derives `isColdSample = deals.length > 0 && deals.every(d => d.isMock)`.
When true, render the cold layout instead of the plain grid (no prop
changes needed). The genuinely-empty case (`deals.length === 0 &&
!hasActiveFilters`) renders the same honest block, §6.2, without the sample
section.

### 6.2 Honest empty block (first, above samples)

```tsx
<div role="status" className="mx-auto max-w-[480px] pt-10 text-center">
  <h3 className="font-display text-[20px] font-bold text-[color:var(--ink)]">
    We&rsquo;re building your feed.
  </h3>
  <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">
    Our tracker sweeps hotel prices across 20 destinations once a day.
    Real deals appear here after the next sweep — check back soon.
  </p>
</div>
```

Fire `feed_empty_cold_viewed` `{ sampleCount }` on mount.

### 6.3 Sample section (below, only when samples exist)

```tsx
<section aria-label="Example deals" className="mt-12">
  <div className="mb-6 border-t border-[color:var(--line-ivory)] pt-8">
    <h3 className="text-h3 text-[color:var(--ink)]">Example deals</h3>
    <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">
      Here&rsquo;s what expaify surfaces once tracking completes. These use
      sample hotels and prices — they&rsquo;re not bookable.
    </p>
  </div>
  <div className={gridClass}>…3 sample cards…</div>
</section>
```

### 6.4 Sample card variant (`DealCard` when `isMock`)

- **Badge, image top-right** (the slot the time pill occupies on real cards
  — never both, since sample `updatedAt` is null): label weight, not
  caption:

  ```tsx
  <span className="absolute right-3 top-3 rounded-[var(--radius-pill)] border border-[color:var(--line-white)] bg-[color:var(--surface)] px-2.5 py-1 text-[12px] font-semibold leading-none text-[color:var(--ink)]">
    Example
  </span>
  ```

- **No `CompareRow`.** In its place, one line at 12px:
  `<p className="text-[12px] font-medium text-[color:var(--ink-soft)]">Sample hotel — not bookable</p>`
- **No time pill** (follows from D1 null rule), **no href** (already true
  for mocks), **no "Preview deal" caption** (deleted in §2), hover
  lift/shadow suppressed for samples (`isMock` skips the `hover:` classes)
  so they don't invite clicks.
- Trust line ("Based on N price checks…") is **omitted** for samples — a
  fabricated snapshot count is exactly the claim D5 bans.

### 6.5 Server + API changes (in scope for this feature's UI/DEV split)

- `app/deals/page.tsx` fallback: `generateMockDeals(3)`, all
  `locked: false` — the `FREE_LIMIT` lock-masking of mocks is deleted
  (never upsell on fabricated inventory). `updatedAt: null`,
  `firstSeen: null`, `otaLinks: {}`.
- `app/api/deals/route.ts` mock branch: same 3-unlocked rule, **and fix the
  existing bug** where raw snake_case `MockDeal` objects are spread into the
  response (`{...d, locked}` at `route.ts:122–127`) — clients receive
  `hotel_name` where `ApiDeal` promises `hotelName`. Map mocks through a
  proper `mockToApiDeal` producing the full camelCase `ApiDeal` with
  `isMock: true`, `otaLinks: {}`, `updatedAt: null`, `firstSeen: null`,
  `locked: false`, `city: ''`.

### States summary

| State | Render |
|---|---|
| cold DB, any tier | Honest block → divider → "Example deals" header → 3 sample cards |
| genuinely empty, no samples returned | Honest block only |
| 375px | Sample cards single-column (existing grid); badge and chip don't collide (chip left / badge right, same geometry as §2) |
| 1280px | 3 samples fill one grid row |
| focus | Sample cards contain no interactive elements — zero tab stops per card |

**Acceptance (D5):** on a cold DB a disclosure element renders before the
first sample card; no sample renders an outbound OTA link, a time claim, or
a locked/upsell state; "Preview deal" pattern gone.

---

## 7. Final copy — every visible string (single source of truth)

| # | Surface | String |
|---|---|---|
| C1 | DealCard pill | `checked just now` / `checked {m}m ago` / `checked {h}h ago` / `checked yesterday` / `checked {d}d ago` |
| C2 | Detail freshness line (fresh) | `Price checked {timeAgo}` |
| C3 | Detail freshness line (aging) | `Price checked {timeAgo} — verify with the provider` |
| C4 | Detail stale banner title | `Price may be out of date` |
| C5 | Detail stale banner body | `We haven't been able to re-verify this price since {Mon D, YYYY, HH:MM}. Check the provider for the current price and availability.` |
| C6 | Detail hero pill | `found {timeAgo}` (only when `first_seen` non-null) |
| C7 | Filtered-empty headline | `No deals match your filters` |
| C8 | Filtered-empty hidden-count | `{n} deals are hidden by your filters` (`1 deal is hidden by your filters`) |
| C9 | Filtered-empty body | `Remove a filter, or clear them all to see everything that's live.` |
| C10 | Filtered-empty primary | `Clear all filters` |
| C11 | Filtered-empty secondary (city-scoped only) | `See all destinations` |
| C12 | Chip aria-label | `Remove filter: {label}` |
| C13 | Cold-empty headline | `We're building your feed.` |
| C14 | Cold-empty body | `Our tracker sweeps hotel prices across 20 destinations once a day. Real deals appear here after the next sweep — check back soon.` |
| C15 | Sample section header | `Example deals` |
| C16 | Sample section sub | `Here's what expaify surfaces once tracking completes. These use sample hotels and prices — they're not bookable.` |
| C17 | Sample badge | `Example` |
| C18 | Sample card line | `Sample hotel — not bookable` |
| C19 | City meta (n>0) | `Updated daily · {n} deal{s} found` |
| C20 | City meta (n=0) | `Checked daily — no active deals right now` |
| C21 | City empty headline | `No {city} deals right now.` |
| C22 | City empty body | `We check {city} hotel prices every day — deals appear here the moment a price drops.` |
| C23 | Watch button | `Watch {city}` · saving: `Saving…` |
| C24 | Watch confirmed | `Watching {city} — new deals will be in your daily digest.` |
| C25 | Already watching | `You're watching {city} — you'll get an email when a deal appears.` |
| C26 | Manage link | `Manage watchlist` |
| C27 | Watch error | `Couldn't save — check your connection and try again.` |
| C28 | Watch cap | `Your watchlist is full (10 cities). Manage it in your account.` |
| C29 | Free-tier capture lead | `Premium members get an email the moment a {city} deal appears.` |
| C30 | Free-tier CTA | `Get {city} alerts with Premium` |
| C31 | Anonymous capture lead | `Want an email when a {city} deal appears?` |
| C32 | Anonymous CTA | `Get {city} deal alerts` |
| C33 | City empty secondary | `See all destinations` |

---

## 8. Accessibility checklist (all surfaces)

- `role="status"` on: filtered-empty block, cold-empty block, stale banner,
  watch confirmation. `role="alert"` on watch error only.
- All interactive targets ≥ 44px (`min-h-[44px]` or `.btn`); chips included.
- Focus: global `--focus-ring` applies to every new button/link; no
  `outline: none` anywhere; after Clear-all, focus moves to the grid
  wrapper (`tabIndex={-1}`).
- Time pills/lines carry `title` with the absolute datetime; icons are
  `aria-hidden`; chip × glyphs are `aria-hidden` inside labeled buttons.
- Sample cards contain zero tab stops; the section is `aria-label`ed.
- No color-only signaling: the aging tier changes color **and** appends
  "— verify with the provider"; the stale tier adds a titled banner.

---

## 9. Out-of-scope findings (flag, do not fix in this feature)

1. `ApiDeal`/`toApiDeal` triplication and the `route.ts` `checkInDate`
   drift (route has it; the other two copies don't) — consolidation into
   one shared module is recommended DEV cleanup.
2. `unfilteredTotal` on `/api/deals` (enables C8 hidden-count) — optional
   DEV enhancement.
3. True anonymous city-email capture (non-IATA alert backend) — explicit
   new DEV scope if product wants it; this spec deliberately routes
   anonymous users to `/join`.

## 10. Handoff

Next stage: **UI-DEAL-EMPTY-STATE-01** — implement §§1–8. UI-only surfaces
(DealCard, DealFeed, detail page presentation) plus the server-component
prop plumbing spec'd here. The `toApiDeal`/mock-mapping edits in §1.1/§6.5
are mechanical additive mappings already spec'd exactly; if UI judges the
`route.ts` mock-mapping fix or the watchlist wiring beyond UI scope, it
creates `DEV-DEAL-EMPTY-STATE-01` per the pipeline. TEST verifies against
the acceptance lines in §§3–6.
