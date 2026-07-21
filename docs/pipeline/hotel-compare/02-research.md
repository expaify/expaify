# 02 — UX Research: Hotel Comparison Shortlist

**Ticket:** UXR-HOTEL-COMPARE-01
**Stage:** UXR (research brief)
**Author:** Senior UX Researcher
**Upstream:** `docs/pipeline/hotel-compare/01-discovery.md` (see "Discovery source note" below)
**Surface under study:** `/deals` grid (`app/deals/DealFeed.tsx` → `app/components/ui/DealCard.tsx`) and `/deals/[dealId]` (`app/deals/[dealId]/page.tsx`)

---

## 0. Discovery source note (blocker-adjacent)

The discovery report file `docs/pipeline/hotel-compare/01-discovery.md` **does not exist on disk** in this worktree. This brief is built from the discovery corrections embedded in the ticket body, which are detailed and internally consistent, plus a direct audit of the current code. This is not a blocker for research — the embedded problem statement is sufficient — but UXDES and downstream stages should be aware the 01 doc was never written, and the monitor may want to backfill it. Every claim below about *current* behavior is grounded in the source files, not in the missing doc.

---

## 1. Problem restatement (from discovery)

A shopper on `/deals` cannot hold 2–4 hotel deals side by side. Every comparison happens by memory — scrolling up and down the `DealFeed` grid, or opening `/deals/[dealId]` in one tab and mentally diffing it against another card. There is no selection, no shortlist, no side-by-side view. The user's working set lives in their head and is destroyed the moment they scroll or navigate.

**Discovery corrections this brief must honor (verified against code):**

1. **No amenities or cancellation-terms data exists.** Confirmed. `DealRow`, `ApiDeal`, and the `deals` table carry no amenity or cancellation fields. Comparison must be scoped to attributes the deal actually has.
2. **The premium watchlist is not a per-deal save.** Confirmed. `subscriptions.watchlist TEXT[]` holds up to 10 **city slugs** for alerting, gated by `alert_preference` / `alert_min_discount` and `isPremium`. This shortlist must not read, write, or resemble it, and must not require premium.
3. **`HotelCard.tsx` is dead.** Confirmed — zero live callers; the real surface is `DealCard` inside `DealFeed` and the detail page. All directives target those.
4. **No per-user saved-item persistence exists** — only a transient `sessionStorage` onboarding draft (`app/onboarding/OnboardingClient.tsx`, `DRAFT_KEY`). Persistence must be recommended from scratch (§6).

---

## 2. Current-implementation audit (what the code actually does)

### 2.1 The `/deals` grid card (`DealCard.tsx`)

Each card is a self-contained `<article>` optionally wrapped in an `<a href="/deals/{id}">`. It renders:

- Photo (or gradient fallback) with a **discount chip** (top-left) and a **"checked {timeAgo}"** pill or an **"Example"** pill for mock deals (top-right).
- Optional **headline** (AI copy).
- **Hotel name** + a metadata line: `★★★★☆ · {city} · {checkInWindow}`.
- **Price block**: `dealPrice /night` + strikethrough `usually {medianPrice}` + a `Save $X/night` line when savings ≥ $20.
- **`CompareRow`** — OTA deeplink buttons (Expedia / Booking / Kiwi / Trip). *(Naming flag — see §2.4.)*
- **Trust line**: "Based on {snapshotCount} price checks over 60 days".

The card has **no selection affordance** and **no Deal Score verdict**. The only "quality" signal on the card is the numeric star count.

### 2.2 The card data contract (`ApiDeal` / `DealRow` / `deals` table)

This is the single most important finding for scoping. The persisted deal — everything the grid can show without new DEV work — contains:

| Field | Source | Usable compare attribute? |
|---|---|---|
| `dealPriceCents` + `medianPriceCents` | `deals` table | ✅ Price / night, usual price, savings |
| `discountPct` | `deals` table | ✅ Discount % |
| `stars` `NUMERIC(2,1)` | `deals` table | ✅ Star class (number only) |
| `city` | `tracked_markets.city` | ⚠️ Area — city-level only, coarse |
| `snapshotCount` + `updatedAt` | `deals` table | ✅ Price-check recency + sample depth |
| `checkInWindow` / `nights` | `deals` table | ✅ Stay window context |
| `photoUrl`, `hotelName`, `otaLinks`, `headline`, `isMock` | `deals` table | Context / identity |

### 2.3 What discovery asked to compare vs. what the data supports

Discovery scoped comparison to seven attributes: **price, discount %, stars/class, guest rating + confidence, location/area, Deal Score, price-check recency.** Against the code:

- **Present on the grid contract (5):** price, discount %, star class, area (city-only), price-check recency.
- **NOT present on the grid contract (2 — critical):**
  - **Guest rating + confidence.** `HotelRatingEvidence` (`guestRating`, `hotelClass`, `reviewCount`, `confidence`) lives only on the live `HotelOffer` type (`lib/types.ts:109–151`). It is **never persisted into the `deals` table** and is absent from `ApiDeal`/`DealRow`. The grid literally cannot show it today.
  - **Deal Score.** The verdict/percentile/confidence is **computed server-side only on the detail page** (`DealScoreSection` in `app/deals/[dealId]/page.tsx`, via `scoreDeal()` over `getPriceHistory()`). It is **not on `ApiDeal`**, so the grid shows only the raw `discountPct`, never a Great/Good/Typical verdict.

**Implication for UXDES:** A compare view built purely on the existing feed contract can only honestly populate **five columns**: Price/night (+ usual + savings), Discount %, Star class, Area, and Price-check recency (+ snapshot depth). Guest rating and a true Deal Score verdict require a **DEV ticket** to plumb `guestRating` and a per-deal `DealScore` onto `ApiDeal` (either persisted on `deals` or computed at feed-build time). UXDES must decide whether to (a) ship MVP compare on the five real attributes, or (b) spec the two extra columns as *phase-2, data-gated cells* that render an explicit "Not available for this deal" state until DEV lands them. **Do not spec a seven-column table as if all seven have data — two do not.**

### 2.4 Naming collision risk (two of them)

1. **"Compare" is already taken.** `CompareRow` (`app/components/ui/CompareRow.tsx`) means "compare this hotel's price across OTAs (Expedia/Booking/Kiwi/Trip)." Reusing "Compare" for the shortlist will collide conceptually on the very same card. The shortlist needs its own verb.
2. **"Watch"/"Save"/"Track" belong to the premium watchlist.** See §5.

---

## 3. Reference-pattern comparison (interaction level, not visual)

### 3.1 Booking.com — "Compare properties" (closest analog)
- Each result card has a lightweight **checkbox/toggle** ("Compare").
- Selecting one raises a **persistent bar** that accumulates chosen properties (thumbnail + name + remove ×), a running count, a **"Compare (n)"** primary action, and a **"Clear"** control.
- The bar survives scroll and filtering; it is dismissible and non-modal.
- Opening compare renders a **side-by-side attribute table**, price row first.
- Selection is **capped** (~5) with a soft block when exceeded.

### 3.2 Google Hotels / Kayak
- Google leans on a **saved/pinned** collection + a lighter inline compare.
- Kayak uses **per-card compare checkboxes** feeding a compare view.
- Common thread across all three: **(a)** selection affordance *on the card*, **(b)** a *persistent, non-modal accumulator* that shows the current set and count, **(c)** a *dedicated side-by-side view* with price as the anchor row, **(d)** a *cap* with graceful over-cap handling.

### 3.3 The exact delta (current expaify → reference)
| Dimension | Current expaify | Reference pattern | Delta to close |
|---|---|---|---|
| Select a deal to hold | None | Checkbox/toggle on card | Add a selection affordance to `DealCard` (and detail page) |
| See the working set | Held in memory | Persistent accumulator bar/tray | Add a non-modal shortlist tray with count + clear |
| Side-by-side view | None | Attribute table, price-first | Add a compare view over the selected set |
| Bounded set | N/A | Cap ~4–5 + soft block | Enforce 2–4 cap with over-cap messaging |
| Survives navigation | Nothing survives | Set persists across scroll/nav | Persist selection (see §6) |

---

## 4. Shortlist add / remove interaction scenarios (for UXDES to spec every state)

These are the scenarios the design spec must resolve. Each is a testable state.

**Selection & capacity**
- **S1 — Add from grid card.** Selection control on `DealCard` toggles the deal into the shortlist; card reflects a selected state. Control must not hijack the card's existing `<a>` navigation (card is wrapped in a link — the toggle needs its own hit target and `stopPropagation`, or must sit outside the anchor).
- **S2 — Add from detail page.** `/deals/[dealId]` gets the same add/remove control so a shopper who drilled in can add without going back.
- **S3 — Cap reached.** Discovery says **2–4**. Recommend a hard cap of **4**. On attempting a 5th: block the add and surface a message ("You can compare up to 4 — remove one to add another"). Decide add-disabled vs. replace-oldest — **recommend disable + message**, never silently drop a user's earlier pick.
- **S4 — Below minimum.** With **0–1** selected, the tray may show but the "Compare" action is disabled with a hint ("Add one more to compare"). Compare view requires ≥2.

**Remove & clear**
- **S5 — Remove from card / detail** (toggle off).
- **S6 — Remove from the tray** (× on each chip).
- **S7 — Remove from inside the compare view** (a column's remove control; view drops to remaining set, or exits if it falls below 2).
- **S8 — Clear all** from the tray, with undo-friendliness considered (at minimum a confirm or an easy re-add; a full clear should not be a silent one-tap data loss of a 4-item set).

**Eligibility & edge cases (grounded in code)**
- **S9 — Mock/sample deals** (`isMock: true`) are "not bookable" and have no detail page (`href` is `undefined`). They **must not be selectable** — exclude the control on mock cards.
- **S10 — Locked deals** (`LockedDealCard`, free-plan gated) carry **no real data** (placeholder name/city). They **must not be selectable**; selection is a premium-free feature but a locked card has nothing to compare.
- **S11 — Expired deal already in the shortlist.** A deal can expire (`status`/`expires_at`) after being added. Keep it in the set but mark it expired in the tray and compare view rather than dropping it without explanation.
- **S12 — Deal disappears from the feed** (filter change, pagination) while selected. The shortlist is a set of deal identities, not grid positions — it must persist independent of what's currently rendered. Reconcile against the current feed only for the live "selected" checkmark, not for membership.
- **S13 — Cross-surface consistency.** A deal added on the grid shows as selected when the user opens its detail page, and vice-versa. One shared source of truth.
- **S14 — Empty compare view** (all removed): graceful exit back to the grid, not a broken table.

---

## 5. Watchlist-boundary questions (keep it distinct — visually and conceptually)

The premium **watchlist** (`subscriptions.watchlist`) is a *per-city, premium-gated, alerting* construct. The shortlist is a *per-deal, free, in-session, silent* construct. They must never be confused. Open questions and recommended answers for UXDES:

- **Q1 — Naming.** Avoid **"Watch," "Save," "Track," "Alert," "Follow," "Bookmark"** — all read as the watchlist/alerts feature. Avoid **"Compare"** as the *verb for selecting* because `CompareRow` already owns "Compare" for OTA price comparison. Recommended verbs to test: **"Add to shortlist" / "Shortlist"**, **"Pin"**, or **"Add to compare set"** where "Compare" names the *destination view* only, not the per-card toggle. UXDES should pick one and use it consistently.
- **Q2 — Iconography.** Avoid the **bell** (alerts) and the **bookmark/heart** (save/watch) glyphs. A **checkbox**, **plus/added toggle**, or **balance-scale/compare** glyph reads as "add to a working set," not "save for later."
- **Q3 — Placement.** The watchlist lives on `/account` and the personalized `/deals` subtitle echo. The shortlist must live **inline on the results surface** as a transient tray — never on the account page, never in the personalization subtitle, never touching the `personalization.watchlist` echo copy.
- **Q4 — No premium lock.** Filters/sorting show a premium lock in `DealFeed`. The shortlist **must not** render any lock, "Unlock with Premium," or gating. It works identically for free and premium users.
- **Q5 — No alert affordances.** No "notify me," no email capture, no discount-threshold coupling. Adding to the shortlist changes nothing server-side about alerts.
- **Q6 — Copy separation.** In any place both concepts could co-occur (e.g., a premium user with a watchlist who also shortlists deals), copy must make the distinction explicit: watchlist = "cities we alert you about," shortlist = "deals you're comparing right now."

---

## 6. Persistence recommendation (session-only vs. longer-lived)

No per-user saved-item persistence exists. The only precedent is `sessionStorage` for the onboarding draft (`DRAFT_KEY`, cleared on submit).

| Option | Survives | Pros | Cons | Verdict |
|---|---|---|---|---|
| **In-memory (React state / context)** only | Nothing beyond a client nav that unmounts the provider | Zero storage, trivial | Lost on reload; risky since `/deals/[dealId]` is a **server component** — navigating grid→detail→back can unmount a client-only provider and drop the set | ❌ Too fragile given the server-rendered detail page |
| **`sessionStorage`** (mirror of a client store) | Reloads + within-tab nav; cleared when tab closes | Matches existing pattern; no auth; no schema; no premium coupling; naturally scoped to one shopping session; survives the grid↔detail↔back round trip | Not cross-tab, not cross-device | ✅ **Recommended for MVP** |
| **`localStorage`** | Across tabs and browser restarts | Longer-lived working set | A stale multi-day shortlist of possibly-expired deals is a *worse* experience than a clean slate; invites confusion with a "saved" feature we explicitly are not building | ⚠️ Only if research later shows users want a multi-session set |
| **Server table (new `saved_deals`, keyed by `user_id`)** | Cross-device, durable | True persistence | Requires auth, a schema change, and DEV; **structurally adjacent to the watchlist we must stay away from**; over-scoped for an in-session compare task | ❌ Not MVP — and must **not** reuse `subscriptions.watchlist` |

**Recommendation:** Ship MVP on **`sessionStorage`**, mirroring the `OnboardingClient` pattern (a dedicated key, e.g. `expaify.shortlist`, holding an array of deal ids + the minimal fields needed to render the tray offline). Rationale: it survives the exact grid↔detail↔back journey that breaks in-memory state, needs no auth and no premium, adds no schema, and its natural "clears when the tab closes" lifetime matches the *shopping-session* mental model — which also keeps it clearly distinct from the durable premium watchlist. Explicitly **do not** persist the shortlist in `subscriptions` or any watchlist column. If a future ticket wants a durable, cross-device saved set, that is a separate, auth-gated `saved_deals` table — not this ticket, and not the watchlist.

**Store shape guidance for UXDES/DEV:** persist enough to render the tray and compare view without re-fetching (id, hotelName, city, photoUrl, dealPriceCents, medianPriceCents, discountPct, stars, snapshotCount, updatedAt), and reconcile against the live feed for expiry/availability when a deal is shown.

---

## 7. Attribute-priority testing (which attributes matter most in compare mode)

Compare mode is not the same job as scanning the grid. When two deals sit side by side, *which attributes actually decide the pick?* This determines column order, what is bold/primary, and what can be secondary or behind a toggle. Discovery listed seven attributes; only five have data today (§2.3).

**Hypothesized priority (to validate, not to assume):**
1. **Price / night** (+ usual price + savings $) — the anchor row; every reference leads with it.
2. **Discount % / Deal Score verdict** — "is this actually a good price." *Deal Score is the product's stated differentiator but is not on the grid contract (§2.3); until DEV plumbs it, discount % is the only price-quality signal available in compare.*
3. **Star class** — quality tier proxy (the only quality signal currently on the card).
4. **Guest rating + confidence** — likely high value, but **no data today** (§2.3); test its priority to justify (or not) the DEV work to surface it.
5. **Area** — city-only today; coarse. Test whether city-level is even useful in compare or whether it's noise without sub-city precision.
6. **Price-check recency / snapshot depth** — a trust/confidence input more than a decision axis; likely secondary.

**Recommended test methods (UXR/UXDES can run lightweight versions):**
- **First-click / "which one would you book?"** on paired mock compare views, varying which attribute differs, to see which differences actually flip the choice.
- **Card-sort / rank** of the attribute chips ("order these by how much they'd affect your decision when comparing two hotels").
- **Attribute-drop test:** show a compare view missing one attribute; measure whether users notice/ask for it — this directly answers whether guest rating and Deal Score are worth the DEV cost to plumb onto the feed.

**Testable output UXDES should carry forward:** a ranked column order with price first; an explicit decision on whether guest rating and Deal Score are (a) MVP columns requiring a DEV plumbing ticket, or (b) deferred with a "not available for this deal" cell state.

---

## 8. Design directives (specific, testable — hand to UXDES)

1. **Ship compare on the five attributes that have data; gate the other two.** MVP compare view columns: **Price/night (+ usual + savings)**, **Discount %**, **Star class**, **Area (city)**, **Price-check recency (+ snapshot depth)** — all sourced from `ApiDeal` with no new DEV. Spec **Guest rating** and **Deal Score verdict** as *phase-2, data-gated cells* that render an explicit "Not available for this deal yet" state, and note that populating them requires a DEV ticket to add `guestRating` and a per-deal `DealScore` to `ApiDeal`. *Testable: no column in the MVP spec references a field absent from `ApiDeal`.*

2. **Selection lives on the card and the detail page; the tray is a persistent, non-modal accumulator.** A per-card toggle (not colliding with the card's `<a>` navigation), a bottom/edge tray showing selected chips + running count + "Compare (n)" (disabled below 2) + "Clear all," surviving scroll, filtering, and pagination. Mock and locked cards expose **no** selection control. *Testable: adding on the grid reflects as selected on the detail page and vice-versa; mock/locked cards have no toggle.*

3. **Enforce a 2–4 shortlist with graceful bounds.** Minimum 2 to open compare (below that, disabled with a hint); hard cap 4 with a soft block + message on the 5th attempt (disable-and-explain, never silently drop an earlier pick). *Testable: attempting a 5th add is blocked with visible messaging; 0–1 selected disables the compare action with a hint.*

4. **Name and style it to be unmistakably NOT the watchlist and NOT `CompareRow`.** Pick a single verb that avoids "Watch/Save/Track/Alert/Bookmark" (watchlist) and does not overload "Compare" as the *toggle* verb (reserved by OTA `CompareRow`); use a checkbox/plus/scale glyph, never a bell or bookmark; render zero premium locks; keep it inline on `/deals`, never on `/account` or in the personalization subtitle. *Testable: no premium lock appears on the control for free users; the chosen verb and glyph differ from both the watchlist and `CompareRow`.*

5. **Persist via `sessionStorage`, session-scoped, mirroring the onboarding-draft pattern.** One key holding the minimal render fields; survives grid↔detail↔back and reload; clears with the tab; never writes to `subscriptions`/watchlist; reconciles expiry against the live feed at render. *Testable: navigating grid → detail → back preserves the exact set; closing the tab clears it; no server/watchlist write occurs on add/remove.*

---

## 9. Out-of-scope / flags for the monitor

- **Missing 01 discovery doc** (§0) — never written to disk.
- **Data-contract gap** (§2.3) — guest rating + Deal Score are not on the feed contract. Whether to close that gap is a **DEV** decision that UXDES must tee up; it is out of scope for this UI-oriented feature unless a DEV ticket is explicitly created.
- **Star class has no confidence evidence persisted** — the `deals` table stores a bare `NUMERIC(2,1)`, not the `HotelRatingEvidence` shape, so "stars + confidence" cannot be shown on the grid either; only the number.
- No code was changed in this stage (research produces docs only).

---

## Handoff

Next stage: **UXDES-HOTEL-COMPARE-01** — design the shortlist selection control, the persistent compare tray, and the side-by-side compare view, honoring the five-attribute data reality (§2.3, §8.1), the 2–4 bounds (§8.3), the watchlist/`CompareRow` distinctness rules (§5, §8.4), and `sessionStorage` persistence (§6, §8.5).
