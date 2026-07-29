# 02 — UX Research: Hotel Shortlist Retention & Sharing

**Ticket:** UXR-HOTEL-SHORTLIST-SHARE-01 · **Stage:** UXR (research brief) · **Date:** 2026-07-29
**Feature slug:** `hotel-shortlist-share`
**Upstream:** `docs/pipeline/hotel-shortlist-share/01-discovery.md`
**Sources audited:** `app/deals/DealFeed.tsx`, `app/components/ui/DealCard.tsx`, `app/deals/[dealId]/page.tsx`, `app/components/ui/ShareButton.tsx`, `lib/paywall.ts`, `lib/analytics.ts`, `app/api/analytics/route.ts`, `lib/db/schema.sql`, `lib/hotels/searchCriteria.ts`, `app/privacy/page.tsx`, plus **live queries against the production Neon database**.

---

## 0. Executive summary — read this before designing

The discovery doc named the repeat-comparison query as the **go/no-go input** and said it was "runnable today." **It is not runnable, and the reason is worse than a null result.**

I ran it against the production database. Three findings change the shape of this ticket:

1. **The `analytics_events` table does not exist in production.** Not "empty" — absent. Every `track()` call in the app has been POSTing to `/api/analytics`, which executes `INSERT INTO analytics_events`, which throws, which the route swallows into a `503` the client ignores. **No product analytics have ever been persisted.** The go/no-go signal cannot be measured today, and neither can any of the eight-plus hotel events the feed and detail page already emit.
2. **Every deal in production is expired.** `deals` holds 1,911 rows: **0 active, 1,911 expired**, all first seen on 2026-07-02, last updated 2026-07-05 — 24 days stale. The "expired item" state this ticket treats as an edge case is currently the **only** state.
3. **`lib/db/schema.sql` contains an unresolved git merge conflict** (`<<<<<<< HEAD` / `=======` / `>>>>>>> agent/DEV-HOTEL-SMOKING-POLICY-01`) wrapping precisely the analytics table definitions. That is the plausible cause of finding #1 and it is a live repo defect.

**Consequence for scope.** The discovery doc's own contingency applies: *"If sessions overwhelmingly open ≤1 hotel, the retention problem is smaller than the ticket assumes and the scope should shrink to sharing alone."* We cannot show that sessions open ≥2 hotels, so we cannot clear the gate the discovery doc set. But the correct response is **not** to kill the ticket — it is to stop treating instrumentation as a downstream afterthought and make it the **first shippable increment**. Directive D1 sequences this. Directives D2–D5 specify the feature so UXDES has a complete spec the moment the gate clears, and D5's share artifact is specified as shippable *independently* of the gate, because sharing needs no retention evidence to justify it — the trust defect in today's share path (§4) is verifiable in code, not in analytics.

I am explicitly **not** recommending that UXDES design the retention UI on faith. D1 is a hard sequencing gate with a numeric threshold.

---

## 1. Evidence: what I ran and what came back

Read-only queries, production `DATABASE_URL` (Neon, `neondb`, PostgreSQL 17.10). The throwaway script was deleted after the run; no code or data was modified.

### 1.1 The go/no-go query could not execute

```
=== tables matching '%analytics%' ===  []
=== SELECT ... FROM analytics_events ===  ERROR: relation "analytics_events" does not exist
```

Full public-schema table list, as returned: `accounts`, `deals`, `hotel_snapshots`, `price_alerts`, `price_snapshots`, `route_baseline`, `searched_routes`, `sessions`, `snapshots`, `subscriptions`, `tracked_markets`, `users`, `verification_token`.

Neither `analytics_events` **nor** `product_analytics_events` exists. Both are defined in `lib/db/schema.sql` — both inside the merge-conflict block (§1.3).

### 1.2 The write path fails silently by design

`app/api/analytics/route.ts:257–271` wraps the insert in `try { await query(...) } catch { return 503 }`. `lib/analytics.ts:35–42` fires via `navigator.sendBeacon` (return value unchecked) with a `fetch` fallback whose `.catch(() => undefined)` discards the failure. The comment at `lib/analytics.ts:73` — *"Measurement must never block a search, edit, or provider handoff"* — is a correct design principle that here produces a **totally silent, totally complete data loss**. There is no error surface anywhere that would have revealed this.

The validation layer is real and well-built: `EVENT_PROPERTIES` and `REQUIRED_PROPERTIES` allowlist exact scalar properties per event (`route.ts:19–66`), including `hotel_detail_viewed`, `hotel_detail_back_to_results`, and `hotel_result_card_opened` with `deal_id`. **The instrumentation is correct and the collector is correct. Only the table is missing.** This is a small fix with a large payoff — which is exactly why D1 puts it first.

### 1.3 The schema file is in a conflicted state

`lib/db/schema.sql:272–405` (abridged, verbatim markers):

```sql
<<<<<<< HEAD
-- First-party, privacy-bounded product analytics. session_id is generated per
-- browser tab and is intentionally not tied to an account or raw search text.
CREATE TABLE IF NOT EXISTS analytics_events ( ... );
...
=======
-- Privacy-reviewed product events: anonymous session id plus allowlisted scalar
-- properties only. The API route rejects free text and unknown event shapes.
CREATE TABLE IF NOT EXISTS product_analytics_events ( ... );
>>>>>>> agent/DEV-HOTEL-SMOKING-POLICY-01
```

Two competing analytics designs were merged and never resolved. The conflict spans roughly 130 lines and swallows other definitions (`admin_users`, entitlement columns, `account_deletion_requests` constraints) into the HEAD side. **The file cannot be applied to a database as-is.** Out of scope for this ticket to fix (§7), but it blocks D1 and must be flagged to the monitor now.

### 1.4 Deal inventory is entirely expired

```
deals: 1911 total | active: 0 | expired: 1911 | mock: 0
first_seen: 2026-07-02T16:35Z .. 2026-07-02T16:36Z
last updated_at: 2026-07-05T08:52Z   (24 days ago)
distinct markets: 19
```

The deal-generation pipeline stopped 24 days ago. Consequences for this ticket:

- `getFreeUnlockedDealIds()` (`lib/paywall.ts:42–54`) filters `WHERE status = 'active' AND is_mock = false` → returns an **empty set** → for any non-premium visitor, `unlockedIds.has(deal.id)` is always false → **every deal detail page currently renders `LockedDealDetail`** ("Members-only deal", `app/deals/[dealId]/page.tsx:255–263`). The free plan's 3-per-week unlock currently unlocks **zero**.
- Any deal that *is* reachable renders the expired treatment: the "Saved rate expired" block (`page.tsx:418`) and *"This saved rate expired {date}. It is shown for reference only."* (`page.tsx:382`).

So today, a link produced by `ShareButton` lands the recipient on **a paywall or a dead rate, 100% of the time.** Discovery called these "two bad outcomes out of three." In current production data they are the **only** outcomes. This is the strongest available argument that the share artifact must be designed against locked and expired states *first* — it is not a hypothetical tail case.

I treat the empty inventory as an **environment/pipeline problem outside this ticket**, not as a permanent condition, and the directives below assume active deals return. But it decisively settles the design priority.

---

## 2. Current-implementation audit

### 2.1 `DealCard` — no retain affordance, and a hostile place to add one

`app/components/ui/DealCard.tsx` (151 lines). Contract: `{ deal, href?, onOpen? }`. Render order inside the `<article>`: `Example` pill (mock only) → hotel name → `★★★★☆ · city · window` → price row (`dealPrice` + `/ night` + strikethrough `usually` + `DealChip` **or** `Expired` pill) → optional AI `headline` → `Save $X/night` (≥ $20) → `Price checked {timeAgo}` → `PropertyPhoto` → one of {`Sample hotel — not bookable` | `View deal` | `CompareRow`} → trust line.

Two structural facts that constrain any retain control:

1. **The entire card is wrapped in a single `<a>`** when `href` is set (`DealCard.tsx:139–150`). Its click handler is `if ((event.target as Element).closest('a') === event.currentTarget) onOpen?.()` — a guard that suppresses the `onOpen` analytics call for clicks landing on a *nested* anchor. It does **not** prevent navigation. **A `<button>` nested inside this `<a>` is invalid-adjacent and will navigate on click unless it calls `preventDefault()` — and it will still be announced inside the link's accessible name.** A retain control must either sit outside the anchor or explicitly `preventDefault()` + `stopPropagation()`, and UXDES must specify which.
2. **`DealCard` already accepts an `expired` prop** (`DealCard.tsx:33`) and renders a grayscale card with an `Expired` pill replacing the discount chip (`:66`, `:92–95`). **The grid never passes it** — the only `href`-bearing call site (`DealFeed.tsx:1904–1907`) omits `expired`. The component is already half-built for the state this feature needs; a shortlist surface can reuse it directly.

### 2.2 Feed wiring (`DealFeed.tsx`, 2,014 lines)

- The live hotels grid renders `<DealCard href={deal.isMock ? undefined : buildHotelDetailUrl(deal.id, resultsUrl)} onOpen={... trackCardOpen(index + 1)} />` (`:1904–1907`). Mock deals get **no href** — they are not links and fall through to `CompareRow` instead of "View deal."
- Locked deals bypass `DealCard` entirely: `<LockedDealCard placeholderName="Members-only deal" ... joinHref="/join" />` (`:1794–1795`, `:1811–1812`, `:1894`). Locked cards carry **no real name, no price** — confirming hotel-compare §S10: a locked card has nothing to retain.
- `hotel_result_card_opened` fires with `card_position`, `current_sort`, `filter_state`, `loaded_result_count` (`:1349`) — rich, correct, and currently discarded (§1.2).
- Filters and sort render premium locks (`:1573`, `:1591`, `:1609`, `:1699–1719`). **The retain control must render none** — see D2.

### 2.3 `/deals/[dealId]` — three terminal states, two of them bad

| Order | Guard | Renders |
|---|---|---|
| 1 | `getDealById` → null | `notFound()` |
| 2 | `!pwCtx.premium && !unlockedIds.has(deal.id)` (`:257–263`) | **`LockedDealDetail`** — "Members-only deal", lock copy, `/join` upsell, no name, no price |
| 3 | `expires_at < now` (`:296–297`) | **"Saved rate expired"** (`:418`) + *"This saved rate expired {date}. It is shown for reference only."* (`:382`) |
| 4 | otherwise | The deal, plus `ShareButton` and (premium + tracked market only) `WatchCityPill` (`:446–447`) |

The paywall check runs **before** the expiry check, so a locked-and-expired deal shows the paywall. A shared shortlist must resolve items in the same order or the recipient's experience will diverge from a direct link.

### 2.4 `ShareButton` — the share defect in 46 lines

`app/components/ui/ShareButton.tsx`. `navigator.clipboard.writeText(window.location.href)`, a `role="status"` live region ("Link copied" / "Couldn't copy link"), 2s reset, 44×44 target, `aria-label="Copy link to this deal"`. Mechanically sound and accessible.

Four defects for this ticket:

1. **No analytics event.** Confirmed — zero `track()` calls in the file. Discovery calls this a one-line gap; note it is currently a *two*-part gap, since the event would also need adding to the `EVENT_PROPERTIES` allowlist in `app/api/analytics/route.ts` or the collector rejects it with a 400 (`route.ts:232`). And it measures nothing until D1 lands.
2. **It copies the raw URL, criteria and all.** `buildHotelDetailUrl` appends the sender's full results query string — `city`, `date_from`, `date_to`, `min_discount`, `max_price_cents`, `min_stars`, `sort`, `criteriaReturn` (`searchCriteria.ts:281–284`, `:190–206`). The recipient inherits the sender's filters and sort. Mostly harmless, occasionally confusing, and it makes the shared URL long and untrustworthy-looking.
3. **One hotel per copy.** No batching, no set identity.
4. **It promises nothing about what the recipient will see** — see §4.

### 2.5 Persistence: confirmed absent, and confirmed *entirely* absent

Verified across `app/` and `lib/`: **zero `localStorage` usages anywhere in the codebase.** The only client storage is `sessionStorage`: the analytics session id (`expaify.analytics.session.v1`, `lib/analytics.ts:3`) and the onboarding draft. No saved-items table. Discovery's claim holds without qualification.

`app/privacy/page.tsx:35`, verbatim: *"We use a single session cookie to keep you logged in. No advertising cookies. No third-party trackers. If you block cookies, you will not be able to stay signed in."*

Note precisely what this sentence does and does not say. It is a **cookie** claim and a **third-party tracker** claim. `localStorage` is neither a cookie nor third-party. But the sentence's plain-English reading — *"we keep one thing, to log you in"* — is what a user takes from it, and adding silent client persistence without amending it would be a trust violation of the kind repair mode exists to prevent. D3 handles this as a copy change, not a lawyer's argument.

---

## 3. Reference patterns (interaction level)

### 3.1 Booking.com — saved lists + shared list link

- Heart control top-right **on the photo**, on every card, for signed-out users. Tapping saves immediately; no dialog, no account wall on the first save.
- Signed-out saves are held client-side and **merged on sign-in** — sign-in is offered as an *upgrade* ("save these across your devices"), never as a gate.
- A "Saved" entry point in the header shows a running count.
- The list surface has a **Share** action producing one link to the whole list. The recipient gets a **read-only** rendering — no editing, no account required to view.
- Items reconcile at view time: sold-out or unavailable properties render with an explicit unavailable treatment and a "find similar" path, rather than being dropped or shown as bookable.

### 3.2 Google Hotels — shortlist

- Per-card save; a "Saved" tab collects them; prices **re-fetch on view** and are labelled with when they were checked. The saved item is a *pointer*, never a frozen price.

### 3.3 Airbnb — wishlist sharing

- Share produces a short link to the whole wishlist. Recipients view without an account. Editing requires being the owner (or invited) — viewing never does.
- Sharing is a first-class action **on the list**, not a per-item copy-link.

### 3.4 The exact delta

| Dimension | expaify today | Reference | Delta |
|---|---|---|---|
| Retain a candidate | **Nothing** — no control on card or detail | Per-card save, one tap, signed-out OK | Add a retain control (D2) |
| See the working set | Held in the user's head | Persistent entry point + count | Add a shortlist surface + count (D2) |
| Survives reload / tomorrow | **Nothing survives** | Client-persisted, merges on sign-in | `localStorage` + disclosure (D3) |
| Anonymous vs signed-in | Identical (both zero) | Anonymous works; sign-in upgrades to cross-device | Anonymous-first, sign-in as upgrade (D4) |
| Share the set | One URL per hotel, manually | One link to the whole list, read-only | Stateless set link (D5) |
| Unavailable item in a shared set | Silent paywall or dead rate | Explicit unavailable state, honest label | Designed locked/expired states (D5) |

**The single most important cross-reference lesson:** every reference treats a saved item as a **pointer that re-resolves at view time**, never a frozen snapshot. Given §1.4 — where a saved price would be 24 days stale and the deal expired — this is not a nicety. It is the difference between a trustworthy feature and a lying one.

---

## 4. Why the share path is a trust defect, in the app's own terms

Sender copies a link and messages it: *"this one?"* Recipient opens it and, per §2.3, most likely sees **"Members-only deal"** with the name and price redacted, or **"Saved rate expired."** In production data today, **always** one of those two (§1.4).

The sender gets no signal that this happened. They believe they shared a hotel; they shared an upsell. A four-hotel shortlist share multiplies this — discovery's line is exactly right: *"a 4-hotel share where 3 are locked is worse than no share at all."*

Two rules follow, and they are in tension:

- **The shortlist must not become a paywall bypass.** A shared set renders through the same paywall as the feed (`applyPaywall`, `lib/paywall.ts:57–77`). Recipient's own plan governs; sender's plan is irrelevant.
- **The sender must not be lied to.** Silently handing someone a locked card is the defect. The fix is not to unlock — it is to **tell the sender, at share time, what the recipient will actually be able to see.**

D5 resolves this with sender-side disclosure rather than by weakening the paywall.

---

## 5. Fold in `hotel-compare`? — Explicit decision: **park it**

The ticket requires an explicit call. **Recommendation: keep `docs/pipeline/hotel-compare/` parked. Do not fold it into this feature, and do not ship it as a phase 2 of this ticket.**

Reasoning:

1. **Different job, different evidence bar.** hotel-compare is a *within-session viewing* surface (side-by-side table). This ticket is *retention + handoff*. Discovery is right that they are separable, and hotel-compare's own research (its §2.3) concluded the compare table can honestly populate only **five columns** — the two most decision-relevant, guest rating and Deal Score verdict, are **not on `ApiDeal`** and need a DEV plumbing ticket. A five-column table where the two best columns are missing is a weak product.
2. **It never had a discovery doc.** hotel-compare's `02-research.md` §0 flags that `01-discovery.md` did not exist on disk. (It exists now — but the research was written without it.) That lineage should be repaired before the work is revived, not inherited silently.
3. **Its persistence recommendation is now superseded.** hotel-compare §6 recommends `sessionStorage` and explicitly rejects `localStorage` ("a stale multi-day shortlist of possibly-expired deals is a *worse* experience than a clean slate"). This ticket's success statement **requires** surviving a closed tab, so `sessionStorage` is disqualified here. The objection hotel-compare raised is real and D3 answers it directly with reconciliation + an expiry rule — but two live docs recommending opposite storage would guarantee a downstream conflict.
4. **Sequencing.** If both ever ship, the shortlist is the substrate and compare is a *view over it*. Building the substrate first is correct; building a view over a substrate that does not exist is not.

**What UXDES should carry forward from hotel-compare** (inherited, not re-litigated): the naming and iconography constraints (§5 there — avoid "Watch/Save/Track/Alert/Bookmark", avoid overloading "Compare", avoid bell and bookmark glyphs), the mock/locked ineligibility rules (S9, S10), the cap-with-graceful-bounds pattern (S3), and the "membership is a set of deal identities, not grid positions" rule (S12). These are correct and directly reusable. **Everything else stays parked.**

---

## 6. Design directives (testable — hand to UXDES)

### D1 — Instrument first. The retention UI is gated on a numeric threshold; the share artifact is not.

Nothing in this feature can be validated or measured until the analytics pipeline persists a single row (§1.1–1.3). Sequence:

**D1.a — Unblock the collector (DEV, prerequisite, out of this feature's scope but blocking).** Resolve the `lib/db/schema.sql` merge conflict and apply the analytics table to production. Verify with `SELECT count(*) FROM analytics_events` returning a number rather than an error. **Until this lands, no downstream stage may cite an analytics number.**

**D1.b — Add `hotel_share_link_copied` to the existing `ShareButton`** (one `track()` call **plus** an `EVENT_PROPERTIES` allowlist entry in `app/api/analytics/route.ts` — the collector 400s unknown events, `route.ts:232`). Properties, all already available and all allowlist-safe scalars: `deal_id`, `deal_state` (`active` | `locked` | `expired`), `entry_source`. This measures share appetite for the cost of a two-line DEV change, before any share artifact is built.

**D1.c — The retention gate.** After ≥14 days of live `analytics_events` data, run: *sessions with ≥2 distinct `deal_id` values across `hotel_detail_viewed` / `hotel_result_card_opened`*, and *sessions containing a `hotel_detail_viewed → hotel_detail_back_to_results → hotel_detail_viewed` sequence*.
- **≥25% of hotel-viewing sessions open ≥2 distinct deals → build the full retention feature (D2–D4).**
- **<25% → shrink scope to sharing alone (D5 only)**, and revisit retention when inventory and traffic recover.
The 25% figure is a **judgment call, not a measured benchmark** — I am stating it so the gate is falsifiable rather than rhetorical, and UXDES/the monitor may move it, but must move it *before* seeing the result, not after.

*Testable:* `SELECT count(*) FROM analytics_events` executes without error; a `hotel_share_link_copied` row appears in the table after a real button click; the D1.c query returns a percentage and a written go/no-go call recorded in `03-design.md` before any retention UI is specified.

**Note on §1.4:** the empty/expired deal inventory will also distort D1.c — with every detail page rendering as locked, nobody opens two hotels because there is nothing to open. The gate is only meaningful once active deals exist. Flag to the monitor as a precondition, not a UXDES task.

---

### D2 — One retain control, on the photo, outside the card's anchor, with zero premium chrome.

- **Placement:** top-right overlay on `PropertyPhoto` in `DealCard`, and in the detail page's action row beside `ShareButton` (`page.tsx:446`). Matching control in both places; state is shared, so a deal retained on the grid shows as retained on its detail page and vice-versa.
- **Anchor safety (hard requirement):** the card is wrapped in a single `<a>` (`DealCard.tsx:139–150`). The control must be a real `<button>` that is either lifted outside the anchor or calls `preventDefault()` **and** `stopPropagation()`. UXDES must state which, explicitly. The card's existing `onOpen` guard (`:143`) does not prevent navigation and must not be relied on.
- **Naming and glyph:** inherit hotel-compare's constraints — not "Save", "Watch", "Track", "Bookmark", "Alert", "Follow" (all read as the premium city watchlist); not "Compare" (owned by `CompareRow` on the same card). Recommended verb: **"Keep"** — short, unclaimed anywhere in the codebase, and honest about a working set rather than a permanent library. Glyph: a plus/check toggle or a pin. **Never a heart or a bell.**
- **Eligibility:** **no control on mock cards** (`isMock: true` — not bookable, no detail page) and **no control on `LockedDealCard`** (no real name or price to retain). Both per hotel-compare S9/S10.
- **Zero gating:** no lock glyph, no "Premium" label, no `isPremium` read, no `/join` link on this control, for any user. It sits on a surface (`DealFeed`) whose filter and sort pills *do* render locks (`:1573`, `:1699–1719`) — the visual contrast is the point.
- **Cap:** hard cap of **8**, with a disable-and-explain message on the 9th ("You can keep up to 8 hotels — remove one to add another"). Never silently drop an earlier pick. Higher than hotel-compare's 4 because a shortlist is a working set, not a side-by-side table constrained by column width; low enough to keep a share link short (D5) and the set scannable.
- **Layout:** must not obscure price, collide with the discount chip or freshness pill, or push content at 375px. 44×44 minimum target.
- **Entry point:** a "Kept (n)" control in the results header with a live count, visible only when n ≥ 1. Not in the `/deals` personalization subtitle, not on `/account` — both belong to the watchlist.
- **Accessibility:** `aria-pressed` reflecting state; accessible name naming the hotel ("Keep The Chelsea Rose"); visible focus ring; state change announced via a polite live region.

*Testable:* keeping a hotel from the grid shows it kept on its detail page and back; clicking the control never navigates to the detail page; mock and locked cards render no control; no lock glyph or premium copy appears on the control for a signed-out user; the 9th add is blocked with a visible message; the control is reachable and operable by keyboard at 375px and 1280px without overlap.

---

### D3 — Persist in `localStorage`, reconcile every item at render, and amend the privacy copy in the same ticket.

**Mechanism.** A single `localStorage` key — `expaify.shortlist.v1` — holding an array of `{ dealId, keptAt }`. `sessionStorage` is disqualified: it dies with the tab, and the success statement explicitly requires surviving a closed tab. (This **supersedes** hotel-compare §6's `sessionStorage` recommendation, which was written for a within-session job; see §5.)

**Store deal IDs only — never a cached price.** Deal IDs are UUIDs; 8 of them is ~300 bytes. Storing `dealPriceCents`/`medianPriceCents` client-side would (a) create a stale price the user reads as current — with §1.4's 24-day-old data, catastrophically so — and (b) let a free user's cached price outlive the paywall. **Every render re-resolves each ID server-side through the live `deals` row and the same `applyPaywall` path as the feed.** This is the single behavior all three reference products share (§3.4).

**Reconciliation states, all three designed, none a fallback:**
- **Active** — full card, live price, `Price checked {timeAgo}`.
- **Expired** — keep it in the set, render `DealCard` with its existing `expired` prop (grayscale + `Expired` pill, `DealCard.tsx:66`, `:92–95`), and label it plainly: *"This rate expired. Prices for this hotel may have changed."* Never drop an item without telling the user. Offer a per-item remove and a "Clear expired" bulk action.
- **Locked** (free/anonymous, outside the weekly unlock set) — `LockedDealCard` treatment. **Important:** the user kept this deal when they could see it; the paywall's weekly set rotates at the week boundary (`lib/paywall.ts:36–41`), so a deal they saw on Monday can be locked on the following Monday. Copy must acknowledge that rather than implying they never had access: *"This deal is members-only this week."*
- **Deleted** (`getDealById` → null) — remove from storage and show a single dismissible line: *"1 hotel is no longer listed."*

**Expiry rule.** Drop entries older than **30 days** on read. A shortlist older than a month is stale intent, and — given `deals` rows go expired and stay — a graveyard.

**Privacy consequence, stated plainly and handled in-ticket.** `app/privacy/page.tsx:35` currently reads: *"We use a single session cookie to keep you logged in. No advertising cookies. No third-party trackers."* `localStorage` is technically neither a cookie nor a third-party tracker, and the sentence is not literally falsified. **That argument is not good enough for this product.** The user's plain reading is "you keep one thing." UXDES must write, and the same UI ticket must ship, an amendment naming the new storage — approximately: *"If you keep hotels to compare, we store that list in your browser only. It never leaves your device unless you share it, and you can clear it any time."* Plus a **user-visible "Clear all" control** on the shortlist surface — the disclosure is not credible without it.

**Do not add a persistent visitor identifier.** Discovery's signal #3 (cross-day return-visit measurement) would need one. It is out of scope, it would contradict the privacy page far more seriously than `localStorage` does, and this feature does not require it.

*Testable:* keep 3 hotels, close the tab, reopen tomorrow — the same 3 are present; no price is read from storage (inspect the key: IDs and timestamps only); an expired deal in the set renders grayscale with the expiry sentence and is not silently removed; a locked deal renders the members-only treatment with the "this week" copy; "Clear all" empties the key; the privacy page names browser storage; nothing is written to `subscriptions.watchlist`, `alert_preference`, or `alert_min_discount`, and no new cookie or identifier is set.

---

### D4 — Anonymous-first. Signing in is an upgrade, never a gate, and it merges rather than replaces.

- **Anonymous is the primary case** and must be fully functional: keep, view, remove, clear, share. No account prompt on first keep, no modal, no interstitial. This is who is comparing (discovery §"Who is affected").
- **Signed-in behavior in MVP is identical** — same `localStorage`, same reconciliation. **Do not build a `saved_deals` table in this ticket.** It is a schema change, it needs auth, and it is structurally adjacent to the watchlist we must stay clear of.
- **Cross-device sync is out of scope**, so do not imply it. No "synced" language, no cloud glyph, no "saved to your account."
- **The one sign-in touchpoint permitted:** a single dismissible, non-blocking line on the shortlist surface *only* when the user is signed out and has kept ≥3 hotels — offering that a future account could carry the list across devices. It must be dismissible, must never block, and must not appear on the card or the detail page. If UXDES judges this premature, cutting it is acceptable; adding anything stronger is not.
- **If a durable server-side shortlist is ever built,** the anonymous list **merges** into the account (union, dedupe by `dealId`, keep earliest `keptAt`) — it never replaces or is replaced. State this rule now so a later ticket cannot silently destroy a user's list. Do not build it here.
- **Explicit non-touch:** zero reads or writes to `subscriptions.watchlist`, `alert_preference`, `alert_min_discount`; zero `isPremium` conditionals in any retention code path.

*Testable:* a signed-out visitor completes keep → return next day → share with no account and no prompt blocking any step; signing in neither clears nor changes the kept set; no query in the feature touches `subscriptions`.

---

### D5 — Ship a stateless set link with sender-side disclosure of what the recipient will actually see.

**Artifact: option (b) from discovery — deal IDs in the query string.** `/shortlist?deals=<id>,<id>,<id>`. Adopted over the alternatives:

| Option | Verdict |
|---|---|
| (a) Keep the per-deal copy-link, instrument only | Insufficient — does not solve the "hand over a *set*" job, which is the ticket |
| **(b) Stateless URL encoding deal IDs** | **Adopted** — no table, no token, no server write, nothing to expire or revoke, no new identifier, no privacy delta beyond D3; re-renders live server-side through the existing `getDealById` + `applyPaywall` path, so it is correct-by-construction on expiry and paywall |
| (c) Persisted share row + short token | Rejected for MVP — a schema change, a new server-stored artifact, and a revocation/expiry model, all to buy a shorter URL |

**Stated limits of (b), which UXDES must accept rather than design around:** the URL is long (8 UUIDs ≈ 300 characters — acceptable for messaging apps and email, ugly if read aloud); deal IDs are visible in the URL (they are opaque UUIDs already exposed at `/deals/[dealId]`, so this leaks nothing new); **there is no revocation** — once sent, the link works until the deals expire. Sender-facing copy must not imply otherwise. Cap the URL at the D2 limit of 8; if a longer set is ever needed, that is when option (c) earns its cost.

**Do not carry the sender's search criteria into the share URL.** `ShareButton` currently copies `window.location.href`, which includes `city`, `date_from`, `date_to`, `min_discount`, `max_price_cents`, `min_stars`, `sort`, `criteriaReturn` (§2.4). Strip all of it — the recipient inherits the sender's filters today for no benefit. The share URL carries `deals` and nothing else.

**Recipient view — read-only, three item states, all designed:**
- **Header:** *"{n} hotels shared with you"* + a "Search current deals" action. No sender identity (we do not have one, and inventing one is a privacy step backwards).
- **Active item:** full card, live price, `Price checked {timeAgo}`.
- **Locked item:** `LockedDealCard` treatment, `/join` path preserved. **The recipient's own plan governs** — a premium sender's shared link does not unlock anything for a free recipient (`applyPaywall`, `lib/paywall.ts:57–77`). No bypass.
- **Expired item:** grayscale `DealCard` with `expired`, plus *"This rate expired {date}. It is shown for reference only."* — matching the detail page's existing sentence (`page.tsx:382`) so the two surfaces do not contradict each other.
- **All items locked** (which is today's production reality, §1.4) — a designed empty-ish state, not a wall of locks: *"These deals are members-only right now. See what's available today"* + a `/deals` link. **This is not an edge case; specify it as a first-class state.**
- **Read-only, absolutely:** the recipient cannot add, remove, reorder, comment, or vote. A "Keep these" action that copies the whole set into the recipient's *own* `localStorage` shortlist is permitted and desirable — that is a client-side copy, not collaborative editing.
- **Resolution order must match `/deals/[dealId]`:** not-found → paywall → expired → active (§2.3). A recipient must never see an item state that a direct link would not produce.

**Sender-side disclosure — the fix for §4.** Before or at copy time, tell the sender what the recipient will get, computed from data already on the page: *"3 of 4 hotels are members-only — people you send this to will see a sign-up prompt instead of the price."* This is the entire trust repair. It costs one sentence and it stops the product from silently handing a friend an upsell. **UXDES must specify this copy for all combinations: all-active, some-locked, all-locked, some-expired, all-expired.**

**Retain the existing single-deal `ShareButton`** on `/deals/[dealId]` unchanged in behavior (plus D1.b instrumentation). The set link is an addition, not a replacement.

*Testable:* a shortlist of 4 produces one URL containing only a `deals` parameter and no search criteria; opening it signed-out renders 4 items in their correct live states; a deal expired after the link was sent renders expired, not as a live price; a free recipient sees the members-only treatment for deals outside their unlock set even when the sender is premium; an all-locked set renders the designed state rather than four lock cards; the recipient has no control that mutates the sender's set; the sender sees an accurate count of locked items before copying.

---

## 7. Out-of-scope findings for the monitor (do not fix in this ticket)

1. **`lib/db/schema.sql` has an unresolved merge conflict** (`:272–405`) between `agent/DEV-HOTEL-SMOKING-POLICY-01` and HEAD, spanning both analytics table definitions plus `admin_users`, entitlement columns, and `account_deletion_requests` constraints. The file cannot be applied as-is. **P0 repo defect.**
2. **`analytics_events` does not exist in production.** Every `track()` call in the app has been silently discarded since instrumentation shipped. Multiple prior pipeline tickets added events to this pipeline; **none of them have ever recorded a row.** Any downstream doc citing product-analytics evidence should be re-checked. **P0.**
3. **The analytics failure is silent by construction** (`route.ts:265–267` swallows to 503; `analytics.ts:35–42` discards the response). Consider a health check or a startup assertion — a data pipeline that cannot report its own total failure will fail this way again.
4. **Deal inventory is 100% expired** — 1,911 rows, 0 active, last generated 2026-07-02, last touched 2026-07-05. Downstream effect: `getFreeUnlockedDealIds()` returns empty, so **every deal detail page currently renders the members-only paywall for every non-premium visitor**, and the free plan's advertised 3-unlocks-per-week unlocks zero. **P0 — this is a broken production flow well beyond this ticket.**
5. **`DealCard` accepts an `expired` prop that no call site passes** (`DealCard.tsx:33`; `DealFeed.tsx:1904`). Dead-but-correct code this feature can adopt; worth a note either way.
6. **`hotel-compare` is parked, not cancelled** (§5). Its `01-discovery.md` now exists; its research was written without it. If revived, the storage recommendation in its §6 must be reconciled against D3 or the two docs will conflict.

No code was changed in this stage. Research produces docs only.

---

## Handoff

**Next stage:** `UXDES-HOTEL-SHORTLIST-SHARE-01` — design the "Keep" control and its placement (D2), the shortlist surface with its three reconciliation states (D3), the anonymous-first behavior rule (D4), and the stateless share link with its locked/expired/all-locked recipient states and sender-side disclosure copy (D5). **Record the D1.c go/no-go call in `03-design.md` before specifying any retention UI**; D5 may be specified regardless of that gate.
