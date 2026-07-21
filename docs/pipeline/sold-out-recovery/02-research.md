# UXR-SOLD-OUT-RECOVERY-01: Sold-Out Deal Recovery — Research Brief

**Ticket:** UXR-SOLD-OUT-RECOVERY-01 · **Stage:** UXR · **Priority:** P1
**Upstream:** `docs/pipeline/sold-out-recovery/01-discovery.md`
**Feature slug:** `sold-out-recovery`

---

## 1. Scope and method

I read the four surfaces the discovery report names, the pipeline that flips a deal
to `expired`, the deals table schema, and the two adjacent tickets that bound this
work (`watchlist-ux`, `flexible-date-deal-confidence`). Every finding below cites
the exact file and line where the behavior lives. No behavior is assumed.

**Files audited directly**

- `lib/pipeline/dealDetection.ts` — the source of the `status='expired'` signal, and `getDealById` / `getActiveDeals`.
- `lib/pipeline/dealRules.ts` — the two conditions behind `expire`.
- `app/deals/[dealId]/page.tsx` — stale-deal detail + alert landing (same page).
- `app/book/BookingFlow.tsx` — `HotelHandoffReview`, booking-handoff return.
- `app/deals/DealFeed.tsx` + `app/api/deals/route.ts` — search-results refresh.
- `app/components/ui/CompareRow.tsx`, `app/components/HotelCard.tsx` — existing OTA-link and unavailable-state precedent.
- `lib/db/schema.sql` (deals table + indexes) — to ground recovery-option cost.

---

## 2. What "gone" actually means in this codebase (the ground truth)

There is **no real-time inventory signal**. A deal is "gone" for exactly three
code-confirmed reasons, and recovery copy may only claim what these support:

| # | Backend condition | Where set | What we can honestly say |
|---|---|---|---|
| A | Price recovered above 85% of median (`ratio > EXPIRE_THRESHOLD`) → `status='expired'` | `dealRules.ts:38`, applied `dealDetection.ts:129-136` | "The discount is gone — the price climbed back to its usual range." |
| B | History too thin to stand behind (`snapshotCount < 3` or degenerate price) → `status='expired'` | `dealRules.ts:30-31`, applied `dealDetection.ts:129-136` | "We can no longer confirm this was a deal." |
| C | Check-in date has passed (`check_in_date < CURRENT_DATE`) → `status='expired'` | `dealDetection.ts:140-145` | "These dates have passed." |

**Critical read-time consequence:** A and B are collapsed into the same
`status='expired'` value with no stored reason code, so at render time they are
**indistinguishable** from each other. C is separately reconstructable at render
time because the page already has `check_in_date` — so copy can cleanly split
"dates have passed" (C) from "no longer active" (A/B), but must not try to split A
from B without a new column. This directly bounds Directive D-4 below.

**The `expires_at` trap (root cause, confirmed):** `expires_at` is written once at
insert as `check_in_date + INTERVAL '90 days'` (`dealDetection.ts:97`). The expiry
UPDATEs touch only `status` and `updated_at` (`dealDetection.ts:133`, `:142`) —
**`expires_at` is never moved when `status` flips.** The detail page's only
liveness test is `isExpired = deal.expires_at < now` (`page.tsx:222`). So a deal
the pipeline expired for reason A or B keeps a future `expires_at` and renders
fully live. Worse, the expiry UPDATE sets `updated_at = NOW()`, so the page's
"Price checked {n} minutes ago" reassurance line (`page.tsx:326-330`) shows its
**freshest, most trustworthy state on a deal that was just killed** — a trust
inversion, not merely a missing state.

**The blindness, confirmed:** `getDealById` (`dealDetection.ts:182-197`) does not
select `status`, and `DealRow` (`:154-175`) has no `status` field. The detail page
literally cannot see reasons A/B. It can only infer C, and only if it computes it
(it does not today). This is the single unblock the whole feature depends on — see
§6 Blockers.

---

## 3. Surface-by-surface audit (current vs. required)

### Surface 1 — Stale deal detail (`app/deals/[dealId]/page.tsx`)

**What the code does today**

- Liveness is date-only: `isExpired` (`:222`), `isAging` 30–48h (`:226`), `isStale` 48h+ (`:227`), all derived from `expires_at` / `updated_at`, never from `status`.
- When `isExpired` is true: renders an expired panel (`:337-346`) with CTA **"Search current deals" → `/deals`** carrying **no city and no filter context** (`:343`).
- Otherwise, if `ota_links` non-empty: renders the full price block (`:315-334`) and live `CompareRow` OTA buttons (`:347-353`) — "Compare and book on Expedia / Booking / Kiwi / Trip.com."
- Otherwise (empty `ota_links`): a static "Provider link unavailable" panel (`:355-360`) with **no recovery CTA at all**.

**The gap**

- A deal expired for reason A or B (future `expires_at`, fresh `updated_at`) falls through **every** guard and renders as a live, bookable deal with clickable OTA links. This is the primary defect.
- Even the one honest path (`isExpired`) offers a context-free CTA: it discards the one thing we know for certain — the **city** (`deal.city` is already loaded) — so the user is dumped into the unfiltered national feed.
- No path offers a same-city alternative or a same-city filtered feed link.

**Reference pattern (Booking.com / Google Hotels "property unavailable"):** when a
saved/linked property is unavailable for the dates, the honest incumbents (a) state
unavailability plainly above the fold, (b) *suppress* the dead booking CTA rather
than leaving it live, and (c) surface "similar available properties in {city}" in
the same viewport. Our delta is all three: we leave the CTA live (A/B case), we
never suppress it, and we never offer same-city alternatives.

### Surface 2 — Booking handoff return (`app/book/BookingFlow.tsx` → `HotelHandoffReview`)

**What the code does today**

- `HotelHandoffReview` (`:481-522`) renders a review-only page with two actions: **"Continue to provider"** (`hotelContext.providerUrl`, `:507-514`) and **"Back to search" → `/`** (the homepage, `:515-517`).
- `hotelContext` is reconstructed from the request (booking config), **not** re-checked against the `deals` table — the booking flow has no `status` visibility whatsoever.
- The flight path has rich failure recovery (`getErrorStatus`, "This fare changed since search", `RecoveryState`, `:86-109`, `:346-387`). **The hotel handoff has none of it** because the hotel booking is a pure external redirect with no return callback.

**The gap**

- There is no return path for "the provider couldn't honor that rate." The user leaves via `Continue to provider`, the OTA shows sold-out / a higher price, and on return the only control is "Back to search" → homepage — **not** the same-city feed, **not** the deal they came from, **not** any acknowledgment that the handoff may have failed.
- No state distinguishes "still deciding" from "provider said no." We cannot *detect* a failed handoff (no callback exists and building one is out of MVP scope), but we can *design for the likelihood* of it: the fallback destination should be a same-city recovery set, not the homepage.

### Surface 3 — Alert landing (same detail page, deep-linked from email)

`watchlist-ux/01-discovery.md:40` confirms "An alert email deep-links to exactly
this page." Instant/digest emails (`sendDealAlert.ts`, `sendDailyDigest.ts`) can be
queued before the nightly sweep flips a deal to `expired` and opened after.

**Inherits every Surface-1 defect**, plus two alert-specific ones:

- The user arrives *because of* an alert for a deal that may now be dead, yet the deal-page nav exposes only `/` and `/deals` (`page.tsx:245-247`) — **no account/watchlist link** (`watchlist-ux:40`). There is no way, from the dead deal, to reach the alert that sent them.
- Removing/downgrading that alert is a 4+-step hunt (`watchlist-ux:45`). This is owned by `watchlist-ux`, but the *entry point* logically belongs on the sold-out state — see the cross-ticket note in §4 and §6.

### Surface 4 — Search results refresh (`app/deals/DealFeed.tsx` + `/api/deals`)

**What the code does today**

- The feed fetches `/api/deals` → `getActiveDeals`, which hard-filters `WHERE d.status = 'active'` (`dealDetection.ts:287`). Expired deals are correctly, silently excluded.
- On refetch, `setDeals` replaces the list wholesale (`DealFeed.tsx:265`); there is no diff of previous vs. current results.
- Empty states are well-built for their cases: filtered-empty with chip removal (`:622-661`), personalized-empty (`:728-763`), cold/mock feed (`:664-679`). None of these fire when *one* card among many disappears.

**The gap**

- This surface is **honest by omission but silent**: a deal a user saw an hour ago is simply not in the grid on return, with no "a deal you viewed is no longer available" acknowledgment. This is the **least severe** of the four (no false liveness, no dead end) — the user still has a full live feed — so it should get the **lightest** treatment. Do **not** re-introduce expired cards into the feed to explain them; that would fight the correct `status='active'` filter. Any explanation belongs to the deep-link/return case (Surfaces 1–3), not the grid.

---

## 4. Failure-state scenarios (each tied to an exact condition)

| ID | Flow step | Trigger condition (exact) | Current result | Required result |
|----|-----------|---------------------------|----------------|-----------------|
| **F-1** | Stale deal detail | `status='expired'` (reason A/B) **AND** `expires_at > now` **AND** `ota_links` non-empty | Full live price block + clickable OTA "book" buttons render as if live (`page.tsx:315-353`); "price checked just now" reassurance shows | Explicit "no longer available" state above the fold; live OTA/book CTA **suppressed**; same-city recovery offered |
| **F-2** | Stale deal detail | `status='expired'` (reason A/B) **AND** `expires_at > now` **AND** `ota_links` empty | "Provider link unavailable" panel (`:355-360`), no recovery CTA | Same unavailable state as F-1, now with a same-city recovery CTA |
| **F-3** | Stale deal detail | `check_in_date < today` (reason C) | Depends on `expires_at`: usually still renders live because `expires_at` (check_in+90d) is future | "These dates have passed" state; recovery = same-city feed (never a date-shift suggestion — see constraint §5.2) |
| **F-4** | Alert landing | Any of F-1..F-3 reached from an email deep link | Identical to F-1..F-3 **and** no route to the alert that sent them (nav lacks account link, `:245-247`) | F-1..F-3 state **plus** a single link toward managing the alert/watchlist for this city (entry point only; control owned by `watchlist-ux`) |
| **F-5** | Booking handoff return | User returns after `Continue to provider` (`BookingFlow.tsx:507`) when the OTA could not honor the rate | Only "Back to search" → `/` homepage (`:515`); no failed-handoff acknowledgment | Fallback destination is the same-city recovery set, not the homepage; optional "rate didn't match?" affordance that routes to same-city feed |
| **F-6** | Search results refresh | A previously-viewed deal now has `status='expired'`, so `getActiveDeals` omits it (`:287`) | Card silently vanishes from the grid; no acknowledgment | Lightest touch: no feed change; rely on Surface-1 state when the user deep-links back. Do **not** re-inject expired cards |

---

## 5. Copy requirements (honest, no invented inventory)

### 5.1 What copy may and may not claim

- **Never** say "sold out," "no rooms left," "last room," or anything implying real-time inventory — the MVP has zero inventory data (discovery constraint 1; confirmed: nothing in `lib/providers` or the pipeline returns room counts).
- **Do** name what we actually know, mapped to the reason table in §2:
  - Reason A/B (indistinguishable at read time): *"This deal is no longer active."* Optional plain second line: *"The price is no longer confirmed at the discount we found."* This is true for both "price recovered" and "thin history" without asserting which.
  - Reason C (check-in passed, reconstructable at read time): *"These dates have passed."*
- **Do** keep the provider as the source of truth for price/availability — the codebase already leans on this everywhere (`page.tsx:331-333`, `HotelSummary` terms copy, `HotelCard` "Provider confirms final total…"). Reuse that voice; do not invent a new certainty.

### 5.2 Constraint boundaries (do not cross)

- **No flexible-date UX.** `flexible-date-deal-confidence` owns nearby-date confidence. Recovery must point to **alternative hotels or the city feed**, never "try these nearby dates" / calendar shifting (discovery constraint 2). "These dates have passed" (F-3) states a fact; it must not spawn a date picker.
- **No black-box recommendations.** Any "similar hotels" must be traceable to stored data: same city (`market_id`), currently `status='active'`, and (if used) same/adjacent star class — all from the `deals` table, no component-side provider call (discovery constraint 3).

### 5.3 Tone anchors already in the codebase (reuse, don't reinvent)

- Stale banner (`page.tsx:257-260`): *"Price may be out of date … Check the provider for the current price and availability."*
- Expired panel (`page.tsx:339-342`): *"This saved deal may no longer be available at the shown price. Search again to find current options."*
- `HotelCard` unavailable (`HotelCard.tsx:70-80`): *"No confirmed nightly price … was returned."*
- The new sold-out state should read as a firmer, more specific member of this family — not a louder or more alarming one.

---

## 6. Recovery options, ranked by data already available vs. new query work

The `deals` table has `market_id` and an index `idx_deals_market (market_id, status)`
(`schema.sql:131`, `:151`), and `getActiveDeals` already accepts `marketId`,
`minStars`, and `limit` and filters `status='active'` (`dealDetection.ts:213-301`).
That makes same-city recovery **cheap and already-indexed** — the only missing
piece is `market_id` on the read path (see caveat).

| Rank | Recovery option | Data cost | Notes |
|------|-----------------|-----------|-------|
| **1 — cheapest** | **Same-city filtered feed link** — `/deals?city={deal.city}` or `/destinations/{slug}` | **Zero new query.** `getDealById` already returns `city` (`:186`); `CITY_DISPLAY_TO_SLUG` exists (`lib/cities`, used in `DealFeed.tsx:476`). | Ship this first. It is the minimum honest "here's where the live deals are" action and replaces the context-free `/deals` CTA. Works even before `market_id` is on the read path (city string is enough for the query param). |
| **2 — one indexed query** | **Comparable active deal(s) in the same city** — 1–3 cards from `getActiveDeals({ marketId, minStars?, limit })`, excluding the current deal id | **One indexed read, no provider call.** Uses existing `idx_deals_market`. `market_id` is not currently returned by `getDealById`, but the page **already resolves city→market_id twice** (`page.tsx:122-126`, `:166-170`) for price history — reuse that lookup, or add `market_id` to the SELECT. | Fully explainable per constraint 3 (same city, status=active, optional same/adjacent star). Fits in a Suspense boundary like the existing history/score sections so it never blocks the unavailable state. Exclude the current `deal.id` and any `is_mock` rows. |
| **3 — cross-ticket** | **Watchlist / alert adjustment entry point** for this city | **Link only; the control is owned by `watchlist-ux`.** | The sold-out state is the natural place to *offer* "manage alerts for {city}," but the actual in-context control (and the missing account link in the deal nav) is `watchlist-ux` scope (`watchlist-ux:20,40`). Recommend UXDES place a single link/affordance here and depend on `watchlist-ux` for the destination, rather than building a fourth control path. |

**Recommendation to UXDES:** make Rank 1 the always-present recovery action on
every sold-out/expired/dates-passed state (Surfaces 1, 3, and the Surface-2
fallback). Add Rank 2 as an enhancement inside a non-blocking Suspense section when
`market_id` is available. Treat Rank 3 as an optional link that defers to
`watchlist-ux`; do not block this feature on it.

---

## 7. Testable design directives (for UXDES)

**D-1 — Suppress false liveness.** On the deal detail page, when the deal is
pipeline-invalidated (reason A/B/C from §2), the live price block and OTA/book CTA
(`page.tsx:315-353`) **must not render as actionable**. Test: given a deal with
`status='expired'` and `expires_at > now`, the page shows the unavailable state and
renders **no** clickable `CompareRow`/`Continue to provider` link.

**D-2 — Reason-scoped copy, honestly bounded.** The unavailable state must show
copy from the §5.1 map: "no longer active" for A/B, "these dates have passed" for C
(detectable via `check_in_date < today`). Test: no rendered string on any sold-out
state contains "sold out," "rooms," or an inventory claim; the C case is worded
differently from the A/B case.

**D-3 — Always offer same-city recovery (Rank 1).** Every sold-out/expired/
dates-passed state on Surfaces 1 and 3, and the Surface-2 handoff fallback, must
present a same-city action (`/deals?city={city}` or `/destinations/{slug}`) that
carries the city forward. Test: the expired CTA target includes the deal's city;
the plain `/deals` context-drop (`page.tsx:343`) is gone.

**D-4 — Optional comparable-deal section (Rank 2), non-blocking.** When same-city
`status='active'` deals exist, show up to 3 as an explainable "Still available in
{city}" section inside a Suspense boundary, excluding the current deal id and mock
rows. Test: the section is absent (not errored, not a spinner that blocks) when no
same-city active deals exist; present and correct when they do.

**D-5 — Handoff fallback and (optional) failed-return affordance.** In
`HotelHandoffReview`, the secondary action must fall back to the same-city recovery
set rather than the homepage (`BookingFlow.tsx:515`), and copy should acknowledge
that the provider may not honor the rate ("the provider confirms final price and
availability" already exists — extend it toward a recovery path). Test: "Back to
search" (or its replacement) routes to a city-scoped destination, not `/`.

---

## 8. Blockers / handoff notes for DEV

- **Blocker (data layer):** `getDealById` must start selecting `status` (and,
  ideally, `market_id`) so the detail page can distinguish pipeline-expired deals
  from live ones. Today it selects neither (`dealDetection.ts:182-197`), and
  `DealRow` (`:154-175`) has no `status`/`market_id` field. This is a **DEV-stage**
  change (`lib/pipeline`), and the whole feature is inert without it — flag it in
  the UXDES handoff so the UI stage does not build against data it cannot read.
  Adding `d.status` and `d.market_id` to the SELECT and the type is additive and
  preserves the existing contract.
- **Do not** "fix" `expires_at` to move on status flip as the primary solution.
  It would make the date-only `isExpired` path accidentally correct, but it hides
  the real reason (A vs B vs C) and leaves the page still unable to explain the
  state. The honest fix is to read `status` directly; `expires_at` behavior can be
  noted for DEV but is out of scope for this research directive.
- **Cross-ticket dependency:** the alert-adjustment entry point (Rank 3 / F-4) and
  the missing account link in the deal nav belong to `watchlist-ux`. Coordinate;
  do not duplicate its controls here.
- **Out of scope (flagged, not addressed):** no failed-handoff callback exists for
  hotels and building one requires provider/return-URL work beyond MVP; this
  research designs for the *fallback* only, not detection.

---

## 9. Handoff

Create `UXDES-SOLD-OUT-RECOVERY-01` to produce the design spec covering: the
detail-page sold-out state (all of F-1..F-4), the Surface-2 handoff fallback
(F-5), reason-scoped copy per §5, and the Rank-1/Rank-2 recovery layout — with the
`getDealById` `status`/`market_id` blocker (§8) called out as a DEV prerequisite.
