# UX Research: Hotel Comparison Decision Support

**Ticket:** UXR-HOTEL-COMPARISON-DECISION-01 · **Stage:** UXR · **Priority:** P1 · **Date:** 2026-07-30
**Feature slug:** `hotel-comparison-decision`
**Upstream:** `docs/pipeline/hotel-comparison-decision/01-discovery.md`
**Inherited (re-verified, see §2):** `docs/pipeline/hotel-compare/02-research.md`

**Files audited this stage:** `app/deals/DealFeed.tsx` (2014 lines), `app/components/ui/DealCard.tsx`, `app/components/ui/CompareRow.tsx`, `app/components/ui/LockedDealCard.tsx`, `app/deals/[dealId]/page.tsx` (465 lines), `app/components/HotelDecisionAnalytics.tsx`, `app/components/HotelDealCriteria.tsx`, `app/components/DealScorePanel.tsx`, `app/api/analytics/route.ts`, `lib/analytics.ts`, `lib/db/schema.sql`, `app/page.tsx`, `app/components/HotelCard.tsx`, plus the analytics test suites.

---

## 1. What this brief decides

Discovery left one question open and asked for four things. In order:

1. **Surface question — resolved in §5: the aid lives on the `/deals` feed, not the detail page.** The reason is structural, not preferential, and it follows directly from this ticket's own no-persistence constraint.
2. **Inherited findings — re-verified in §2.** Four hold, **three are now wrong or materially narrower** than discovery states, and one of the corrections invalidates discovery's measurement plan.
3. **`hotel-compare` §8 survival — §6.** Two directives survive intact, two survive only in narrowed/inverted form, one is dead.
4. **Reference patterns — §4.** Booking.com "Compare properties" and Google Flights, at interaction level.
5. **Directives — §7.** Five, each labelled UI-only or DEV-required.

**Conflict position (§8):** I agree with discovery. `hotel-compare` should be closed as superseded. The board still has to make that call.

---

## 2. Re-verification of inherited findings

Discovery correctly instructed me not to re-derive these, but to re-verify before citing. Results:

| # | Inherited claim | Verdict | Evidence |
|---|---|---|---|
| 1 | The feed contract carries **five** comparable attributes | **Narrower than reality — correct in spirit, incomplete in fact** | `ApiDeal` (`DealFeed.tsx:121-141`) also carries `hotelId`, `checkInDate`, and `nights`. `nights` matters: nightly price × nights is derivable client-side today. See §3.1. |
| 2 | Deal Score and guest rating are **not** on the feed contract | **Confirmed** | `ApiDeal` has neither. Deal Score is computed in `DealScoreSection` (`[dealId]/page.tsx:200-238`) via `scoreDeal()` inside a `<Suspense>` boundary (`:393-395`). Guest rating on detail is hardcoded absent — `hasVerifiedGuestRating={false}` (`:457`). |
| 3 | No amenity / cancellation / tax / fee data anywhere | **Confirmed** | Nothing in the `deals` table (`schema.sql:125-148`) or `ApiDeal`. The detail page explicitly hands all of it to the provider — `CompareRow`'s own aria-label says "The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms" (`CompareRow.tsx:120`). |
| 4 | `subscriptions.watchlist` is a premium city list, not saved deals | **Confirmed** | Unchanged. Do not read, write, or gate on it. |
| 5 | `HotelCard.tsx` (1079 lines) is dead code | **Confirmed** | Only importers are `app/components/__tests__/HotelCard.petPolicy.test.tsx` and `HotelRateRestrictions.tsx`. No route renders it. Target `DealCard` / `DealFeed` / `[dealId]/page.tsx`. |
| 6 | **"Compare" collides on the feed — "the single most likely source of user confusion"** | **Overstated. This is the most consequential correction in this brief.** | `DealCard.tsx:120-126`: `CompareRow` renders **only** when the card is not expired, not mock, **and has no `href`**. Every live card in the `/deals` grid is given an `href` (`DealFeed.tsx:1906`), so live feed cards render **"View deal"**, never "Compare and book on:". The literal string survives only on href-less cards — the loading/pending overlay copies (`DealFeed.tsx:1797, 1814`) and the homepage hero when no real deals exist (`app/page.tsx:171, 285`). On the detail page the variant is `size="primary"`, whose label is **"Provider options"** under an `<h2>` reading **"Check rooms with provider"** (`[dealId]/page.tsx:415`, `CompareRow.tsx:107`) — the word "Compare" is not rendered there at all. |
| 7 | Measurement baseline is queryable today from `product_analytics_events`, no instrumentation work | **False on both counts. See §3.3 — this is a P0-adjacent blocker.** | Wrong table, and the events discovery depends on are being rejected at the API boundary. |
| 8 | Must not regress the `expired` card state | **The state is unreachable in production** | `DealCard` accepts `expired?` (`:33`) and branches on it (`:66, 92, 120, 128`), but **no call site anywhere passes it** — not `DealFeed.tsx:1904-1923`, not `app/page.tsx`. Treat it as a component-level branch to preserve, not a live state to design for. |

**Net effect of correction 6:** the copy-collision constraint stands, but its *reason* changes. The risk is no longer two "Compare" labels in one viewport on the feed — that does not happen. The risk is **conceptual**: expaify has trained "Compare" to mean *one hotel, many sellers* on the homepage, on sample cards, and in `CompareRow`'s component name and file. Introducing *many hotels, one attribute set* under the same word inverts the meaning of an established term. That is still disqualifying for the verb, and §7.4 keeps the constraint — but UXDES should not distort the layout to avoid an adjacency that does not exist.

---

## 3. Current-implementation audit

### 3.1 What the feed actually holds per card

`ApiDeal` → `DealCard`, verified field by field (`DealFeed.tsx:121-141`, `:1904-1923`, `DealCard.tsx:17-34`):

| Attribute | Field(s) | Comparable today? |
|---|---|---|
| Nightly price | `dealPriceCents` → `Money` | **Yes** — the anchor |
| Usual price | `medianPriceCents` | **Yes** |
| Savings / night | derived, rendered only when ≥ $20 (`DealCard.tsx:62`) | **Yes**, but conditionally rendered — see below |
| Discount % | `discountPct` → `DealChip` | **Yes** |
| Star class | `stars` `NUMERIC(2,1)`, `?? 3` fallback | **Yes**, number only — no rating evidence or confidence is persisted |
| Area | `city` (tracked-market city) | **Yes**, city-level only — coarse |
| Price-check recency | `updatedAt` → `timeAgo` | **Yes** |
| Sample depth | `snapshotCount` | **Yes** |
| Stay window | `checkInWindow`, `checkInDate`, `nights` | **Yes** |
| Total stay cost | derivable (`dealPriceCents × nights`) | **Yes technically — out of scope.** `docs/pipeline/hotel-total-stay-cost/` owns this. Do not introduce a total column here. |
| Headline | `headline` | Prose, not comparable |
| Deal Score | — | **No.** Detail page only |
| Guest rating | — | **No.** Not persisted at all |

**The conditional-rendering point is the real finding.** Three of these cells are *conditionally present* on a card: the savings line only renders at ≥ $20/night (`DealCard.tsx:103`), the headline only when the AI copy exists (`:100`), and "Price checked …" is suppressed entirely for mock deals (`:63`). So two cards side by side today do not merely sit far apart — **they have different row counts and different vertical rhythm.** Even at 1280px, where three cards share a row, the price block of card A is not at the same y-offset as card B's. The problem is not only "the two are never on screen together"; it is that **when they are on screen together, they are not aligned**, so the eye cannot diff them.

That reframes the deliverable. Discovery's success statement — "see how those specific offers differ … in one view" — is a two-part job: *co-presence* (broken at 375px, where `grid-cols-1` means one card per viewport, `DealFeed.tsx:1182`) and *alignment* (broken at every width). Only the first is a navigation problem.

### 3.2 What the detail page holds, and what it costs

`[dealId]/page.tsx` is an **async server component** rendering exactly one deal. It adds over the feed:

- **Deal Score** — `DealScoreSection` runs a `tracked_markets` lookup plus `getPriceHistory()` and `scoreDeal()`, streamed behind `<Suspense>` (`:200-238, 393-395`). This is a per-deal DB round trip.
- **Price-freshness state** — `fresh | aging | stale | expired | unknown` (`:296-304`).
- **Five ordered decision sections** with `data-hotel-decision-section` / `-position` attributes (`:347, 373, 399, 414, 427`).
- **`backHref`** preserving criteria and results view (`:252, 338`), so the return leg of the loop is cheap and lossless.

The detail page has **no knowledge of any other deal**. It receives one `dealId` param and queries one row.

### 3.3 Measurement is broken — discovery's baseline is not queryable

Discovery states the baseline is "measurable today, with no instrumentation work" from `product_analytics_events`, "indexed on `(session_id, occurred_at)`". Both halves are wrong, and the second is a blocker for this feature's business case.

**(a) Wrong table.** `app/api/analytics/route.ts:259-265` writes to **`analytics_events`**, not `product_analytics_events`. Both tables appear in `schema.sql` only because they sit on **opposite sides of the committed merge conflict**: `analytics_events` is the `HEAD` side (`:272-288`, and it is the one carrying `idx_analytics_events_session_time ON (session_id, occurred_at)`), `product_analytics_events` is the incoming `agent/DEV-HOTEL-SMOKING-POLICY-01` side (`:395-408`, which has *no* session index at all and no event-id dedup). Any query written against discovery's plan runs against a table nothing writes to.

**(b) The detail-page events are rejected at the API boundary.** `HotelDecisionAnalytics.tsx` emits values the allowlist in `route.ts` does not accept. `parseBody` returns `null` on the first invalid property and the route answers **400**, so nothing is inserted:

| Property | Emitted (`HotelDecisionAnalytics.tsx`, `[dealId]/page.tsx`) | Allowed (`route.ts:122-207`) |
|---|---|---|
| `entry_source` | `'saved'` (`page.tsx:455`), or `'search'` / `'direct'` per the component's own type (`:6`) | `'search_results'`, `'saved_deal'` (`:136`) |
| `viewport_group` | `'mobile'` / `'tablet'` / `'desktop'` (`:23-27`) | `'mobile_375'`, `'desktop_1280'`, `'other'` (`:141`) |
| `score_state` | `'confident'` / `'low_confidence'` (`page.tsx:305-309`) | `'loading'`, `'confirmed'`, `'unavailable'`, `'error'` (`:142`) |
| `price_freshness_state` | `'unknown'` (`page.tsx:304`) | no `'unknown'` in the set (`:143`) |
| `section` / `position` | strings — `'property_stay'`, `'1'` (`:347` etc.) | bounded **integers** ≤ 5 (`:144-145`) |

`entry_source` alone is enough to reject **every** `hotel_detail_viewed`, `hotel_detail_back_to_results`, `hotel_decision_section_reached`, and `hotel_room_handoff_started` event the detail page emits. `track()` is fire-and-forget (`lib/analytics.ts:71-78`) and `sendBeacon` discards the response, so the failure is completely silent client-side.

Two test suites exist and never meet: `app/api/analytics/__tests__/route.test.ts:78` asserts the route accepts `entry_source: 'search_results'`; `app/components/__tests__/HotelDecisionAnalytics.test.tsx:102` asserts the component emits `entry_source: 'saved'`. Both pass. No test crosses the boundary.

**Feed-side events are fine.** `hotel_result_card_opened`, `hotel_results_viewed`, and the sort events emit allowlisted values (`DealFeed.tsx:1243-1276, 1346-1355`; sort `analyticsValue`s at `:62, 68, 74`; `filter_state` keys match `validFilterState`'s expected set exactly).

**Consequence for this pipeline.** Discovery's three baseline metrics — return-to-feed loop rate, detail-page switching depth, decision-confidence proxy — **all depend on detail-page events, and therefore on data that does not exist.** Two of the three cannot be computed at all; a partial substitute is described in §7.5. This does not block design, but it means **nobody can size the target population before build.** UXDES must not write a spec that claims a measured baseline.

### 3.4 States that must not regress

- **Mock / sample** (`isMock`): "Example" pill, "Sample hotel — not bookable", no `href`, no `onOpen`, `checked` suppressed (`DealCard.tsx:63, 69-73, 120-121`; `DealFeed.tsx:1906-1907`). Not linkable → not comparable.
- **Locked** (`deal.locked`): renders `LockedDealCard`, a **different component** with placeholder name/city (`DealFeed.tsx:1893-1902`). It never reaches `DealCard`, so excluding it costs nothing.
- **Cold sample feed** (`isColdSampleFeed`, `:1142`) and **mock feed** (`isMockFeed`, `:1190`): whole-feed states where no comparison is meaningful.
- **Pending overlay**: during a filter/sort request the feed renders a skeleton grid plus an `inert aria-hidden` dimmed copy of the current results (`:1790-1800, 1807-1817`). Any new control must be inside that `inert` subtree, not floating above it.
- **Grid**: `grid-cols-1` → 2 at 680px → 3 at 1024px (`:1182`). At 375px, one card per viewport, always.
- **Expired**: branch exists, never triggered (§2 #8).

---

## 4. Reference patterns, at interaction level

### 4.1 Booking.com — "Compare properties"

Interaction shape, ignoring visual style:

1. A **per-card selection control** that is not the card's primary link.
2. Selection raises a **persistent accumulator bar** — chips with remove ×, a running count, a "Compare (n)" action, "Clear".
3. The set **survives scroll, filtering, and pagination** — membership is by property identity, not grid position.
4. "Compare" opens a **dedicated side-by-side attribute table**, price row first, one column per property.
5. Selection is **capped** (~5) with a soft block.

**Steps 2 and 3 are exactly what this ticket forbids** ("zero persistence, zero selection accumulator"). What survives the narrowing is steps 1, 4, and 5: a selection affordance, an aligned attribute table anchored on price, and a bound.

The transferable insight is step 4's internal grammar, not the tray: Booking's table puts **one attribute per row across all columns**, so the eye scans horizontally along a fixed baseline. Every cell is populated or explicitly marked absent — the table never has ragged rows. That is the direct answer to §3.1's alignment problem.

### 4.2 Google Flights

Google Flights offers **no compare tray at all**, and is the more instructive reference here precisely because of that. Its comparison mechanism is:

1. **The list itself is the compare table.** Every row renders the same fields at the same x-offsets — carrier, times, duration, stops, price — with no conditionally-appearing lines. Two adjacent rows are diffable without any selection step.
2. **A single normative annotation per row** ("Low price", "Prices are currently typical") reduces the price-quality judgment to one comparable token rather than requiring the user to hold percentages in their head.
3. **Sorting is the disambiguator on a single axis; the fixed grid is the disambiguator across axes.**

Google's bet is that if rows are perfectly aligned and the price-quality verdict is pre-computed, most users never need an explicit compare mode. Booking's bet is that hotels have too many attributes for that, so an explicit mode is worth the interaction cost.

### 4.3 The delta for expaify

| Dimension | expaify today | Booking | Google Flights | What this ticket can close |
|---|---|---|---|---|
| Co-presence at 375px | One card per viewport | Tray persists across scroll | Rows are compact; several fit | **A transient in-feed panel** (§7.1, §7.3) |
| Row alignment across candidates | **Ragged** — savings/headline/checked all conditional (§3.1) | Table rows fixed | List rows fixed | **Fixed-slot attribute block** (§7.2) — the highest-value, lowest-risk change |
| Price-quality token | `discountPct` chip on feed; Deal Score only on detail | Price + "deal" flags | One-token verdict per row | Discount % is the only honest feed token today; Deal Score needs DEV (§7.2) |
| Selection | None | Per-card toggle → tray | None | Transient only (§7.3) |
| Bound | N/A | ~5 | N/A | **3** (§7.3) |
| Survives nav / filtering | N/A | Yes | N/A | **Explicitly no** — must clear |

expaify's honest position is **closer to Google Flights than to Booking.com**: it holds few attributes, most of them numeric, and it already computes a price-quality verdict — just on the wrong surface. The Booking tray is the pattern this ticket's scope removes; the Google alignment discipline is the pattern this ticket's scope permits.

---

## 5. The surface question, resolved: the feed

Discovery asked whether the aid lives on the feed (five attributes, no Deal Score) or on the detail page (full attributes, shopper already committed). **The feed.** The argument is structural and I do not think it is close.

**1. The detail page cannot host an in-context comparison without violating this ticket's core constraint.** `[dealId]/page.tsx` is a server component that receives one `dealId` and queries one row (§3.2). To compare on that surface, it must know which *other* deals the shopper is weighing — and that knowledge has to come from somewhere: a persisted set, a URL-encoded candidate list, or a client store surviving navigation. All three are persistence or an accumulator. The ticket forbids both, and `hotel-shortlist-share` owns the first. **A no-persistence comparison can only exist where the candidates are already co-resident in one render.** That is `DealFeed`'s `deals` array, and nowhere else. This is a hard constraint, not a preference.

**2. The loop discovery describes always passes through the feed.** `backHref` preserves criteria and results view (`:252`), so the shopper returns to the same feed state every time. The feed is the fixed point of the comparison journey; the detail pages are the excursions. Intervening at the fixed point removes the loop; intervening at an excursion adds a sixth section to a page that already has five ordered decision sections (§3.2) and still requires the shopper to leave it.

**3. The cost of the detail surface scales badly.** Each additional Deal Score is a `tracked_markets` lookup plus `getPriceHistory()` plus `scoreDeal()` (§3.2). A three-way comparison on the detail page triples that, on the surface that is already the slowest.

**4. What the feed gives up is real, and smaller than it looks.** The feed cannot show Deal Score or guest rating. Guest rating is not a loss — it does not exist anywhere; the detail page hardcodes `hasVerifiedGuestRating={false}` (`:457`). Deal Score is a genuine loss, and it is expaify's differentiator. But the feed does carry `discountPct` and the median, which are the same comparison expressed without percentile framing or confidence. **The recommendation is to ship on the feed with discount %, and to raise plumbing Deal Score onto `ApiDeal` as a separate, explicitly-scoped DEV ticket (§7.2) rather than letting it block this one.** Shipping the aid on the wrong surface to reach one attribute is the worse trade.

**Where I am interpreting the scope, and where the board may disagree.** "Zero selection accumulator" reads to me as forbidding *the Booking tray* — a set that survives scroll, filtering, pagination, and navigation. I read it as permitting a **same-render selection held in `DealFeed` React state that is destroyed by any feed mutation and by any navigation**, because such a selection accumulates nothing beyond the current view and is definitionally "currently viewed offers". If the board reads the constraint more strictly — no selection state of any kind — then only directive §7.2 (alignment) is shippable, §7.1/§7.3 fall, **and the 375px case, which is the worst case, stays unsolved**, because alignment cannot help when only one card fits the viewport. I have written the directives so that §7.2 stands alone if that ruling comes down. Flagging rather than assuming, per the briefing.

---

## 6. Which `hotel-compare` §8 directives survive

| `hotel-compare` §8 | Status under no-persistence narrowing |
|---|---|
| **1 — Ship on the five attributes that have data; gate Deal Score and guest rating** | **Survives intact**, with §3.1's correction that `ApiDeal` also carries `hotelId`, `checkInDate`, and `nights`, and with the added requirement that no cell may be conditionally omitted (§7.2). The "phase-2 data-gated cell" idea is **rejected** for this ticket: an empty Deal Score column on the feed advertises a missing feature on every comparison. Omit the row; do not render a placeholder. |
| **2 — Selection on card *and* detail page; persistent non-modal tray with count, surviving scroll/filtering/pagination** | **Survives only in fragments, and one clause inverts.** Survives: a per-card control that does not hijack the card's `<a>`; no control on mock or locked cards. **Dies:** the detail-page control (cross-surface state = persistence, §5), and the persistent tray. **Inverts:** "survives filtering and pagination" becomes **"must be cleared by any filter, sort, or criteria change"** — a comparison of offers that are no longer in the feed is not an in-context comparison. |
| **3 — 2–4 bounds, hard cap 4, disable-and-explain on the 5th** | **Survives, narrowed to 2–3.** Minimum 2 and disable-and-explain both hold. The cap drops to **3**: 375px cannot render four legible columns (§3.4), and discovery names the 2–3 bucket as the target population. Four columns would be an unusable state on the surface where the pain is worst. |
| **4 — Name and style it as neither the watchlist nor `CompareRow`** | **Survives, and is the directive this brief strengthens most** — see §2 #6 for the corrected reasoning and §7.4 for the tightened rule. |
| **5 — Persist via `sessionStorage`** | **Dead.** Directly contradicted by this ticket's scope. Belongs to `hotel-shortlist-share`. `hotel-compare` §6's whole persistence analysis is out of scope here; it should transfer to that pipeline if it has not already. |

The `hotel-compare` §4 scenario list also partially transfers: S1 (add from card, without hijacking the anchor), S9 (mock not selectable), S10 (locked not selectable), S14 (empty view exits gracefully) **survive**. S2 (add from detail) and S13 (cross-surface consistency) **die** with the detail surface. S12 (membership survives filter change) **inverts**, per §6 row 2. S11 (expired in the set) is **moot** — the state is unreachable (§2 #8). S3–S8 survive in the narrowed 2–3 form.

---

## 7. Design directives

Five, testable, each labelled. §7.2 is the one to ship first if only one ships.

---

### 7.1 — The comparison lives in `DealFeed`, over deals already in `deals[]`, and never touches the detail page
**UI-only.**

The affordance is rendered by `DealFeed.tsx` and operates exclusively on entries of its own `deals` state array. No new route, no new fetch, no change to `[dealId]/page.tsx`, no `ApiDeal` field. The candidate set is held in `DealFeed` React state and is **destroyed** on: any filter change, any sort change, any criteria edit, `resetFilters`, an undo, and any navigation away from `/deals`. Nothing is written to `localStorage`, `sessionStorage`, a cookie, the URL, or a table. Nothing reads or writes `subscriptions.watchlist`, `alert_preference`, `alert_min_discount`, or `isPremium`, and no premium lock renders on the control for any user.

*Testable:* a repo-wide diff for this feature touches no file under `app/deals/[dealId]/`, adds no `ApiDeal` field, and contains zero occurrences of `sessionStorage`, `localStorage`, `document.cookie`, or `isPremium` in the new code. Applying any filter clears the set. Reloading `/deals` yields an empty set.

---

### 7.2 — Give `DealCard`'s attribute block fixed slots, so co-present cards are diffable without any interaction
**UI-only.** *Ship this first; it is independent of §7.1 and §7.3 and it survives any board ruling on selection.*

Today three of the card's lines are conditional — savings (≥ $20 only), headline (when AI copy exists), "Price checked …" (suppressed on mock) — so no two cards share a vertical rhythm (§3.1). Restructure the block between the price row and `PropertyPhoto` into **fixed slots that reserve their height whether or not they have content**, in one order for every card:

1. **Price row** — nightly price, `/ night`, struck-through "usually", discount chip. Already fixed; keep it first and keep it the largest type on the card.
2. **Savings slot** — reserved for every non-mock, non-expired card. Populated when savings ≥ $20/night, otherwise empty and height-preserving. Do not lower the $20 threshold and do not render "$0 saved".
3. **Star / area / stay-window line** — already unconditional; move it to a fixed offset relative to the price row.
4. **Freshness slot** — "Price checked {timeAgo}" + "Based on {n} price checks over 60 days". Reserved on every non-mock card; on mock cards the slot renders "Sample hotel — not bookable" in the same position.
5. **Headline** — moves **below** the photo, out of the comparable block. It is prose, it is variable-length, and it is the single largest source of vertical drift between two otherwise-identical cards. It is context, not a comparable attribute.

Do not add a total-stay-cost row (`hotel-total-stay-cost` owns it), and do not add an empty Deal Score or guest-rating row — omit them rather than advertise a gap (§6 row 1).

*Testable:* at 1280px, three cards in one grid row have their price row, savings slot, metadata line, and freshness slot at identical y-offsets regardless of whether savings ≥ $20, a headline exists, or the deal is mock. No card grows or shrinks when a headline is added or removed. `DealCard`'s prop contract is unchanged; the `expired` and `isMock` branches still render.

**Companion DEV ticket to raise, not to do here:** plumb a per-deal `DealScore` verdict onto `ApiDeal` so slot 2 can carry expaify's actual differentiator instead of a raw discount %. This is the single highest-value follow-on and it is squarely a DEV change (new field on the feed contract, computed at feed-build time or persisted on `deals`). **Do not block this ticket on it.**

---

### 7.3 — A transient, in-feed comparison panel over 2–3 currently-rendered deals
**UI-only.**

A per-card control on `DealCard` — its own hit target of ≥ 44 × 44px, outside the card's `<a>` wrapper or with `stopPropagation`, so it never triggers navigation or `onOpen` (`DealCard.tsx:139-149`, `DealFeed.tsx:1907`). Rules:

- **Eligibility.** Rendered only on non-mock, non-expired, linked cards. Never on `LockedDealCard` (a different component, `DealFeed.tsx:1893`), never on mock cards, and never inside the `inert aria-hidden` pending-overlay grid (`:1793, 1810`).
- **Bounds.** Minimum 2 to open the panel; below that the open action is disabled with a visible hint. Hard cap **3** — on the 3rd selection the remaining controls become disabled with an explanation, never a silent drop of an earlier pick.
- **The panel.** Renders one attribute per row across all selected columns, price row first, in §7.2's slot order. **Every cell is populated for every column** — a comparison with a hole in it is worse than no comparison. Each column has a remove control; dropping below 2 closes the panel and returns focus to the control that opened it.
- **375px.** Two columns must be legible side by side at 375px; if three cannot be, three columns must degrade to a horizontally-scrollable region with the attribute labels pinned — never to a stacked layout, which reproduces the exact problem this feature exists to solve.
- **Honesty line.** The panel carries one fixed line: *"Room details, taxes, fees, and cancellation terms are set by the provider — check them before booking."* This matches the language already used at handoff (`CompareRow.tsx:120`) and prevents the panel from implying the missing attributes are comparable.
- **Clearing.** Per §7.1 — any feed mutation empties the set and closes the panel, with the change announced in the existing `statusAnnouncement` live region.
- **Keyboard.** The control is in the natural tab order after the card link. The panel is focus-managed: focus moves in on open, `Escape` closes and restores focus, and the panel is labelled by its own heading.

*Testable:* clicking the control never navigates. Selecting a 3rd deal disables the rest with a visible message. Changing a filter clears the set and closes the panel. At 375px two columns are readable without horizontal scroll. Mock and locked cards expose no control. Tab order reaches the control and `Escape` returns focus to it.

---

### 7.4 — Copy and glyph must not borrow from `CompareRow` or the watchlist
**UI-only.**

The verb for this feature must not be **"Compare"** in any form — not on the control, not in the panel heading, not in the aria-labels. §2 #6 corrects *why*: the two labels do not in fact co-occur on live feed cards, but expaify has taught "Compare" to mean *one hotel, many sellers* (`CompareRow`'s "Compare and book on:", the homepage hero, the component and file names). Reusing it for *many hotels, one attribute set* inverts an established term, and the inversion is worse than an adjacency.

Also excluded: **"Watch", "Save", "Track", "Alert", "Follow", "Bookmark"** — all read as the premium watchlist. Excluded glyphs: the **bell** (alerts) and the **bookmark/heart** (save). Recommended direction, for UXDES to pick one and use everywhere including aria-labels: **"Line up"** / **"Side by side"** / **"See the differences"**, with a checkbox or a two-column glyph. Whatever is chosen, the panel heading, the control label, and the accessible name must all use the same words.

*Testable:* grep the feature's diff — zero occurrences of "Compare", "Watch", "Save", "Track", "Alert", "Follow", or "Bookmark" in any user-visible string or aria-label. No bell or bookmark glyph. No premium lock, upsell, or `isPremium` reference on the control for any user tier.

---

### 7.5 — Fix detail-page instrumentation before claiming a baseline; add feed-side attribution with it
**DEV-required.** *This directive is a prerequisite for measuring the feature, not for shipping it.*

§3.3 establishes that discovery's baseline cannot be computed: `hotel_detail_viewed`, `hotel_detail_back_to_results`, `hotel_decision_section_reached`, and `hotel_room_handoff_started` are all rejected 400 by `app/api/analytics/route.ts`, silently. Two of discovery's three baseline metrics depend entirely on those events.

DEV work needed, in one pass:

1. **Reconcile the emitter with the allowlist** for `entry_source`, `viewport_group`, `score_state`, `price_freshness_state`, `section`, and `position` (full table in §3.3). Either side may move; the emitter is the smaller change. Add an **integration test that sends a real `HotelDecisionAnalytics` payload through `parseBody`** — the existing suites both pass while disagreeing with each other (`route.test.ts:78` vs `HotelDecisionAnalytics.test.tsx:102`), which is exactly how this shipped.
2. **Add `deal_id` to `hotel_result_card_opened`** (`route.ts:27` allowlist + `DealFeed.tsx:1346-1355`). Without it, no feed-side action can be attributed to a specific deal — discovery flagged this and it is still true.
3. **Allowlist the new feature's events** — a selection event and a panel-open event, both carrying `deal_id` (or an ordered id list), `viewport_band`, `filter_state`, and the selected count, reusing the validators already in `validPropertyValue`.

**Interim baseline, available today.** Until (1) lands, the only usable proxies are feed-side: from `hotel_result_card_opened`, the count of card-open events per `analytics_session_id` in `analytics_events` (**not** `product_analytics_events`), bucketed 1 / 2–3 / 4+, segmented by `viewport_band`. Repeated card opens within a session are a weaker but real signal of the same loop. **This cannot distinguish distinct hotels from repeat opens of the same hotel until (2) lands**, and it cannot measure handoff rate by candidate count at all. UXDES must state the baseline as unmeasured rather than assert a number.

*Testable:* an integration test posts the exact props `HotelDecisionAnalytics` emits and asserts a 202. `hotel_result_card_opened` carries `deal_id` and the route accepts it. A query against `analytics_events` returns non-zero `hotel_detail_viewed` rows in a manual session.

---

## 8. Position on the `hotel-compare` conflict

I agree with discovery's recommendation: **treat `docs/pipeline/hotel-compare/` as superseded — by this pipeline for the in-context comparison half, and by `hotel-shortlist-share` for the retention half — and do not open `UXDES-HOTEL-COMPARE-01`.**

Reasons, from this stage's evidence:

- `hotel-compare`'s design centre of gravity is the **persistent tray plus `sessionStorage`** (its §8.2, §8.5, and the whole of its §6). Both are dead here (§6) and the second is `hotel-shortlist-share`'s. Removing them leaves `hotel-compare` with directives 1, 3, and 4 — all of which this brief carries forward, corrected and narrowed.
- `hotel-compare`'s own §0 records that **its 01 discovery doc was never written**; `hotel-comparison-decision/01-discovery.md` exists and is grounded. The successor is better documented than the predecessor.
- Two of `hotel-compare`'s findings are now **stale**: the "five attributes" count (§3.1) and the `CompareRow` collision framing (§2 #6). Running both pipelines would put two divergent accounts of the same code in front of UXDES.

If the board rules the other way, this ticket should close as the duplicate — but **one of the two must stop before UXDES.** This brief does not resolve that; the board does.

---

## 9. Out-of-scope findings

1. **P0 — `lib/db/schema.sql` has committed unresolved merge-conflict markers** at lines 272, 395, 408 (`>>>>>>> agent/DEV-HOTEL-SMOKING-POLICY-01`). Re-verified. The file is not valid SQL and cannot be applied. The conflicting region spans `analytics_events` (HEAD, with the session-time index the live route depends on) and `product_analytics_events` (incoming, no session index, no event-id dedup). **Resolution is not mechanical** — it is a product decision about which analytics table is canonical, and `app/api/analytics/route.ts` writes only to `analytics_events`. Needs its own P0 ticket. Not touched here.
2. **P0/P1 — detail-page analytics events are silently rejected in production.** Full table in §3.3, directive in §7.5. This is broader than this feature: every pipeline whose measurement plan cites `hotel_detail_viewed`, `hotel_detail_back_to_results`, `hotel_decision_section_reached`, or `hotel_room_handoff_started` is currently measuring nothing. Given how many hotel pipelines cite those events, this likely warrants a P0 of its own rather than being folded into §7.5.
3. **`app/components/HotelCard.tsx` — 1079 lines of dead code.** Re-verified; only its own test and `HotelRateRestrictions.tsx` import it, and no route renders it. `AGENTS.md`'s file map still lists it as the live hotel result card. Fourth stage to independently rediscover this. Needs a deletion ticket or a file-map correction.
4. **`DealCard`'s `expired` prop is never passed by any call site** (`DealFeed.tsx`, `app/page.tsx`), so its four `expired` branches are unreachable in production. Either wire it from `deals.status` / `expires_at` or remove it — it is currently untested-by-use surface area.
5. **Two analytics test suites assert mutually incompatible contracts and both pass** (`route.test.ts:78` vs `HotelDecisionAnalytics.test.tsx:102`). The missing integration test is called out in §7.5; the general pattern — component tests asserting emitted shapes that no test validates against the route — is worth a broader QA look.

No code was changed in this stage. Research produces docs only.

---

## Handoff

**Next ticket:** `UXDES-HOTEL-COMPARISON-DECISION-01`

UXDES must:
- Spec §7.2 (fixed-slot `DealCard` attribute block) as an independently shippable change, since it survives any board ruling on §5's selection-scope interpretation and it is the fix for the alignment half of the problem.
- Spec §7.3's panel for every state: default, 0/1/2/3 selected, cap reached, panel open at 375px and 1280px, column removed, set cleared by filter/sort/criteria change, keyboard and focus order, and the mock / locked / cold-sample / pending-overlay exclusions in §3.4.
- Write final copy for every visible string, honouring §7.4's exclusions — including the accessible names, which are where "Compare" is most likely to leak back in.
- Carry §7.5's DEV requirements into a `DEV-HOTEL-COMPARISON-DECISION-01` ticket, and state the baseline as **unmeasured**, not as a number.
- Not spec a Deal Score or guest-rating cell (§6 row 1), a total-stay-cost row (`hotel-total-stay-cost` owns it), or anything that persists (§7.1).
