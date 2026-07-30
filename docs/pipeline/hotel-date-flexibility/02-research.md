# UXR-HOTEL-DATE-FLEXIBILITY-01 — Research: Flexible-Date Hotel Search

**Stage:** UX Research · **Priority:** P1 · **Feature slug:** `hotel-date-flexibility` · **Date:** 2026-07-30
**Upstream:** `docs/pipeline/hotel-date-flexibility/01-discovery.md`
**Surfaces audited:** hotel criteria editor → hotel results feed → hotel deal detail (incl. the criteria-mismatch handoff guard)
**Next stage ticket:** `UXDES-HOTEL-DATE-FLEXIBILITY-01`

---

## 0. Headline finding (read this before anything else)

**There is no such thing as an "adjacent check-in date" in this product's data, and both the flight precedent (±3 days) and the `date-flex-savings` recommendation (±7 days) are provably empty bands against it.**

`lib/pipeline/snapshot.ts:11–22` captures exactly **two check-in dates per market per month** — the **1st and the 15th of next month** — alternating by `today.getDate() % anchors.length`. Every `price_snapshots.check_in` value, and therefore every `deals.check_in_date` value (detection groups by `check_in`, `lib/pipeline/dealDetection.ts:60`; upserts per check-in, `:99`), is one of those two calendar anchors.

Minimum distance between two check-in dates that can coexist for a market:

| Anchor step | Gap |
|---|---|
| 1st → 15th | **14 days** |
| 15th → next 1st (31-day month) | **17 days** |
| 15th → next 1st (30-day month) | **16 days** |
| 15th → Mar 1 (non-leap Feb) | **14 days** |

Consequences, all mechanical rather than probabilistic:

1. A **±3-day** band (`app/api/search/route.ts:309–316`, flights) returns **zero** alternates for hotels, always. The discovery doc's open question is answered: **do not copy the flight number.**
2. A **±7-day** band (`docs/pipeline/date-flex-savings/03-design.md:248`) also returns **zero** alternates, always. 7 < 14. That spec's `NearbyDateNote` would render `unchecked`/omitted on every hotel in production. **This is a defect in the upstream spec and must be corrected before UI builds it.**
3. Any user-entered check-in window that does not contain the 1st or the 15th of a month returns **zero deals deterministically** — not "sparse inventory", a guaranteed empty screen. This is the true root cause of break point 2 in discovery §2.
4. Because inventory sits on two fixed calendar anchors, **"± N days flexible" is the wrong input affordance for this data.** A ±N control would promise a granularity the corpus does not have. The honest control is **"these check-in dates have deals" — real dates, named.**

Everything below follows from this.

---

## 1. Task (a) — reconciliation with `date-flex-savings`: **partial overlap, one shared element, split ownership**

The discovery doc asked whether the overlap is total. It is not. Verified against the tree: **`NearbyDateNote` does not exist in code** (`grep -rn "NearbyDateNote\|nearbyDate" app lib` → no hits). Nothing is built yet, so the contract can still be made single.

| Concern | Owner | Status |
|---|---|---|
| Per-deal secondary line naming one cheaper nearby check-in, on `DealCard` + deal detail | **`date-flex-savings`** (`03-design.md` §1–§7) | Specced. This ticket **does not respecify it.** |
| Band width for that line | **This ticket** (§0, §3) — the specced ±7 is empty | **Correction issued below.** |
| Data source for that line (`price_snapshots` vs `deals`) | **This ticket** (§3.2) — the two specs conflict | **Conflict; resolution below.** |
| Expressing date flexibility at criteria time | **This ticket** | Unclaimed. |
| Zero-result recovery on the **date axis** | **This ticket** | Unclaimed (`hotel-no-results-recovery` owns the destination axis). |
| The mismatch guard hard-stop at `/deals/[dealId]` | **This ticket** | Unclaimed — and `date-flex-savings` §3.4 targets a *different* dead-end (`PriceUnavailable` / missing OTA link), not the criteria-mismatch block. Both exist; see §5.2. |

**One element, one contract.** UXDES must not introduce a second per-deal line. `NearbyDateNote` stays the single per-deal element; this ticket supplies (i) the corrected band, (ii) the corrected source, (iii) a **separate, market-level** contract for the criteria/empty-state surfaces, which is a different question ("which dates have any deals in this market?") than the per-deal one ("is a nearby date cheaper for *this hotel*?").

### 1.1 Correction to `date-flex-savings/03-design.md` (must be carried, not re-litigated)

- **§9 "Band width: keep ±7 days" is void.** Replace with the anchor-step rule in §3.1 below.
- **§3.4's detail-page insertion point has drifted.** That spec cites `page.tsx:354–361` for the "Provider link unavailable" block; that block now lives in `app/components/HotelDealCriteria.tsx:164–170` (and its mismatch twin at `:130–137`). UI must re-locate, not trust the line numbers.

---

## 2. Current implementation audit (source-verified)

### 2.1 Criteria input — no flexibility affordance exists
`app/components/HotelSearchCriteria.tsx:213–228`: a `Check-in window` fieldset with two bare `<input type="date">` fields (`:218`, `:223`), validated only for well-formedness and ordering (`lib/hotels/searchCriteria.ts:130–132`, editor `:129–135`). Helper copy is `"Deals may have different check-out dates and stay lengths."` (`:227`) — it describes check-**out** variance and says nothing about check-in inventory. The criteria model itself (`searchCriteria.ts:8–10`) has exactly two date shapes: `missing`, or `checkin_window {dateFrom?, dateTo?}`. **There is no field in which flexibility could even be expressed.**

### 2.2 The window is a hard SQL bound, applied to free users too
`lib/pipeline/dealDetection.ts:265–274` appends `AND d.check_in_date >= $n` / `<= $n`. In `app/api/deals/route.ts:122–128`, `dateFrom`/`dateTo` are read from resolved criteria and passed through **without** the premium gate that `maxPriceCents`, `minStars`, `minDiscount` and `sort` get (`:119–121, 130`). Chip eligibility agrees (`DealFeed.tsx:1176–1177`: dates are chip-eligible regardless of `premium`, unlike `:1173–1175`). **Date filtering is the one filter that applies to every user — so the empty-date-window failure is a free-tier first-impression failure.**

### 2.3 Zero-result recovery names no dates
`DealFeed.tsx:1837–1853` renders `ResultCoverageBoundary state="confirmed_empty"` plus `Edit search` and (city pages) `See all destinations`. The boundary's own filtered-empty copy is *"No current expaify deals match your filters." / "Remove one filter to expand this expaify result set."* with a `Remove "{label}"` button (`ResultCoverageBoundary.tsx:149–158, 53–56`). For a date filter, `formatFilterValue` renders `From Aug 3, 2026` / `To Aug 6, 2026` (`hotelFilterRecovery.ts:212–213`). So the strongest recovery offered is **"Remove 'From Aug 3, 2026'"** — drop the date constraint entirely. Never *"deals exist on Aug 15."*

Two further findings on that path:

- **A date-recovery contract already exists and is never fed.** `hotelFilterRecovery.ts:19–27` defines `HotelRecoveryOption` with `filterKey: 'dateFrom' | 'dateTo'`, `relaxedTo`, `addedCount`, validated client-side by `parseHotelResultMetadata` (`:170–201`). **`/api/deals` emits no `resultMetadata` at all** (`grep resultMetadata app/api/deals/route.ts` → nothing), so `recoveryOptions` is permanently `[]` and `DealFeed.tsx:1219–1222` always falls back to a hardcoded rank where `dateFrom`/`dateTo` are **5th and 6th of six** — the least-recommended filters to relax.
- **The existing contract cannot express a date *shift*.** `valueMatchesBaseline` (`:122–131`) requires `relaxedTo.kind === 'none'` for both date keys — i.e. the only representable date recovery is *removal*. A "shift to Aug 15" option is structurally unrepresentable today. Design must not try to smuggle a shift through `HotelRecoveryOption`.
- **`trustedMetadata` requires `premium`** (`DealFeed.tsx:1191–1194`), so even once the server emits metadata, free users get none. A date-recovery signal built on that path would be invisible to exactly the audience §2.2 identifies. **Do not build the date signal on `resultMetadata`.**

### 2.4 Deal detail — one date, and a hard stop for date-adjacent deals
- One `check_in_date` + a derived check-out (`app/deals/[dealId]/page.tsx:281–283`); `nights` is always 2 in practice (`snapshot.ts:4`, and the deals upsert hardcodes `nights = 2`, `dealDetection.ts:93`). **A date change therefore never changes stay length** — useful, it removes an objection to a one-click date switch.
- `hotelCriteriaContextStatus` (`searchCriteria.ts:286–297`) returns a **bare `'mismatch'` with no reason**, collapsing "wrong city" and "check-in one anchor away" into one verdict (`:290` vs `:294–295`).
- On mismatch, `HotelDealCriteriaHandoff` (`app/components/HotelDealCriteria.tsx:130–137`) returns early with *"Provider link unavailable / Review the search mismatch below before inspecting room options."* — **`CompareRow` never renders**, so the affiliate handoff is blocked. `HotelCriteriaMismatchAlert` (`HotelSearchCriteria.tsx:259–271`) then offers only `Edit search` and `Back to matching results`, closing with *"Provider options are unavailable until you review the mismatch."*
- Given §0, **the overwhelmingly likely mismatch is a date mismatch of 14–17 days on a hotel in the right city** — a deal the flexible user would take. The guard is correct in principle and catastrophic in this specific case.

### 2.5 Locked deals — what is already public, and what must never leak
`app/api/deals/route.ts:35–56` (locked branch) zeroes `dealPriceCents`/`medianPriceCents` and empties `otaLinks`, but **deliberately keeps `checkInWindow`, `checkInDate`, `discountPct`, `nights`, `snapshotCount`**. `LockedDealDetail` is likewise passed `checkInDate` and `checkInWindow` (`app/deals/[dealId]/page.tsx:261`), and `LockedDealCard` renders city/stars (`DealFeed.tsx:1811`). **Conclusion: check-in dates are already non-paywalled; prices and links are the paywalled facts.** This gives a clean, already-established honesty line for §4.

### 2.6 The flight precedent, and why it does not transfer
`app/api/search/route.ts:248, 309–316` fans out `FLEX_DATE_OFFSETS` **one live provider call per date** and reports coverage via `flexibleDateCoverage` (`:59, 338`). Hotels are explicitly forbidden per-date provider fan-out (discovery §4.2) and, per §0, have no ±3 neighbours to fan out to. **The transferable idea is the honest coverage statement, not the band.**

---

## 3. Reference patterns (interaction level)

**Google Hotels — "prices are lower on nearby dates."** A compact inline line names a specific cheaper date and switches to it in one tap; when Google has no nearby data it renders nothing. **Borrow:** name a *real date*, one tap to apply, omit rather than hedge. **Do not borrow:** its per-date price calendar, which is backed by per-date pricing infrastructure expaify is forbidden from building.

**Booking.com — "No properties for these dates" recovery.** Booking's empty state does not just say "remove a filter"; it names the nearest dates that *do* have availability and applies them on click. **Borrow:** the empty state must be an *inventory statement*, not a *filter statement*.

**Booking.com / Kayak "flexible dates" input.** Both express flexibility as a bounded, honest set — `± 1/2/3 days`, or whole-month chips — because their inventory is continuous. **Do not borrow the ±N control:** with two anchors a month (§0), ±N on this corpus is a promise the data cannot keep. The correct analogue of Booking's *"whole month"* chip here is **the named-anchor list**.

**Delta.** References answer *"when could I go instead?"* from data they already hold. expaify holds `deals.check_in_date` per market and never asks that question on any read path — the only date query shape in the repo is the hard `>=`/`<=` at `dealDetection.ts:265–274`.

---

## 4. Task (b) — grounding the band

### 4.1 The band rule (replaces ±3 and ±7)
**Do not specify a ±N day band. Specify an anchor-step band.**

- **Definition:** the *nearest N distinct `check_in_date` values that have an active, non-mock, non-expired deal row*, ordered by absolute distance from the reference date, with `N ≤ 2` on detail and `N ≤ 3` on the feed.
- **Hard outer bound for the SQL:** **±21 days** from the reference date. Rationale: 21 ≥ 17 (the worst-case single anchor step, §0), so exactly one step is always reachable in every month; 21 < 28, so the query can never reach the *second* step ahead and cannot silently offer a date a month and a half out.
- **If UXDES insists on a fixed number for copy purposes, the number is 21, and it is a query bound only — it must never appear in user copy.** Copy names dates (`Aug 15`), never deltas (`±21 days`, `3 weeks later`).
- **Query shape (feed/criteria, market-level):**
  `SELECT check_in_date::TEXT, COUNT(*) FROM deals WHERE status='active' AND is_mock=false AND market_id=$1 AND check_in_date >= CURRENT_DATE AND check_in_date BETWEEN $2::date - 21 AND $3::date + 21 GROUP BY check_in_date ORDER BY check_in_date LIMIT 4` — served by `idx_deals_market (market_id, status)` (`schema.sql:151`). One extra grouped read, no join, no provider call.
- **Query shape (detail, hotel-level):** same predicate plus `hotel_id = $n`, served by `deals_hotel_market_checkin` (`schema.sql:147`). `LIMIT 2`.
- **Neither query may block the primary render.** Both are independent of the deal/feed fetch; if either fails or times out, the surface renders exactly as it does today.

### 4.2 Source of truth: **`deals`, not `price_snapshots`** (resolves the conflict flagged in §1)
`date-flex-savings/02-research.md:64–69` sources the nearby element from `price_snapshots`. This ticket's honesty constraint says *only real non-expired deal rows*. They cannot both hold. **Resolve to `deals`**, for four source-verified reasons:

1. `price_snapshots` has **no `ota_links`** (`schema.sql:104–118`) — an alternate sourced there has no affiliate-marked deeplink, and the UI is forbidden from constructing URLs. `deals.ota_links` is already built through `buildOtaLinks` at detection time (`dealDetection.ts:79–88`).
2. `price_snapshots` has **no expiry or status**; `deals` carries `status` and `expires_at` (`schema.sql:139, 144`), which the honesty constraint requires.
3. A snapshot price is not a *deal* — surfacing it as an alternate would present an unvetted price beside Deal-Score-vetted ones.
4. `deals` rows already pass the `MIN_SNAPSHOTS` floor via `evaluateDeal` (`dealRules.ts`), so `date-flex-savings/03-design.md:64–65`'s `snapshotCount >= 3` guardrail is satisfied structurally rather than by a second check.

**Cost of this resolution, stated honestly:** the alternate set shrinks to dates where a *deal* was detected, so `state: 'none'` becomes more common. That is the correct trade — `none` is a true statement; a snapshot-sourced price presented as an alternate deal is not.

### 4.3 Density caveat that UXDES must design for
With two anchors a month, the realistic per-hotel alternate count is **0 or 1**, and the per-market date list is **1–3 dates**. Design for one alternate as the normal case; never design a strip, grid, or carousel.

---

## 5. Task (c) — user-acknowledged date change at the mismatch guard

**The guard stays. `HotelDealCriteriaHandoff:130–137` must keep blocking `CompareRow` while status is `mismatch`.** The mechanism is to let the user *change the criteria*, which makes the status `matched` through the existing code path — never to weaken the check.

### 5.1 Required contract extension: mismatch must carry a reason
`hotelCriteriaContextStatus` returns a bare `'mismatch'` (`searchCriteria.ts:286–297`) and is consumed in three places (`page.tsx:249`, `HotelDealCriteria.tsx:46, 129`) plus analytics (`page.tsx:460`, `CompareRow` handoff context `:157–160`). Changing its return type is a breaking change to a trust-critical function.

**Directive:** add a **new sibling export** — `hotelCriteriaMismatchReason(criteria, deal): 'destination' | 'date' | 'both' | null` — reusing the same comparisons at `:290` and `:292–295`. `hotelCriteriaContextStatus` keeps its exact current signature and return values. The date-acknowledgement affordance renders **only when the reason is exactly `'date'`**; a destination mismatch (or `'both'`) keeps today's alert verbatim.

### 5.2 The acknowledged change itself
- Third action inside `HotelCriteriaMismatchAlert`, subordinate to the existing two, present only for reason `'date'`.
- It is **an explicit user act on a named date**, not a toggle: the label must contain the deal's actual check-in date, so clicking it is the acknowledgement. Nothing changes silently.
- Applying it constructs new criteria via the existing `hotelCriteriaFromDraft(draft, createHotelCriteriaVersion(), 'edit')` with `dateFrom = dateTo = deal.check_in_date`, preserving `city`, then navigates through the **existing** `apply()` path in `HotelDealCriteria.tsx:48–84` — same fetch-verify-then-navigate, same `hotel_criteria_edit_applied` event (`changed_fields` will read `date_from,date_to`), same failure branch (`:76–83`). **No new navigation or verification code.**
- After navigation, `hotelCriteriaContextStatus` returns `matched` and the handoff unblocks through the untouched guard.
- `nights` is always 2 (§2.4), so no stay-length caveat is needed — but the design must still state the new check-in **and** check-out, because the user is agreeing to different travel dates.
- **Not permitted:** auto-applying, pre-selecting, defaulting, or rendering the alert as anything other than an alert until the user acts.

---

## 6. Task (d) — locked-deal leak rules

Grounded in §2.5, where the paywall boundary already sits:

1. **Market-level date list (criteria hint + empty state): dates and counts only, never prices, never links.** This makes the leak structurally impossible on the two surfaces this ticket owns — no price is in the payload to leak. Counts are safe: `discountPct` and `checkInDate` are already public on locked rows (`route.ts:44, 46–47`).
2. **Per-deal alternate (`NearbyDateNote`, detail):** the alternate must be resolved against `getFreeUnlockedDealIds()` exactly as the primary is (`route.ts:154–157`, `page.tsx:258–262`). If the alternate deal is locked → render the **date only**, with no price, no saving, no `otaLinks`, and no "cheaper" claim; there is no cheaper claim to make without a price. If it is unlocked → the `date-flex-savings` `cheaper` rules apply unchanged.
3. **Never derive.** `dealPriceCents: 0` is a *lock marker*, not a price. Any renderer that would format `0` as `$0.00`, or compute `savingsCents` against it, is a defect. Guardrail: the alternate's price field must be **absent** (not `0`) when locked, so no arithmetic path exists.
4. A locked alternate never counts toward a "cheaper nearby date" claim — it counts only toward the `nearbyDatesChecked` count that distinguishes `none` from `unchecked`.

---

## 7. Design directives (testable)

### D1 — Criteria editor states which check-in dates have deals; it does **not** offer ±N
`HotelSearchCriteria.tsx:213–228`. When the draft destination is a selected city, render one caption-scale line under the existing fieldset naming up to **3 real check-in dates** from the §4.1 market query, each a keyboard-focusable control that sets `dateFrom = dateTo = <that date>` in the draft (draft only — submit stays the user's act via the existing `Update results` button, `:238`). No `± days` control, no "my dates are flexible" checkbox, no calendar. When the destination is *All destinations*, or when the query returns nothing or fails, the existing helper copy (`:227`) renders unchanged and nothing is added.
**Tests:** (a) selecting a city renders ≤3 dates, all of which exist as active non-mock `deals.check_in_date` rows; (b) clicking one populates both date inputs and does not submit; (c) no rendered string contains `±`, "flexible", or a day-count; (d) query failure leaves the editor byte-identical to today; (e) at 375px the line wraps without pushing `Update results` off-screen, and each date control is ≥44px tall.

### D2 — Date-caused empty states name real dates instead of offering removal
`DealFeed.tsx:1837–1853`. When the feed is empty **and** at least one of `dateFrom`/`dateTo` is active, render one line above the existing buttons naming up to 3 check-in dates that do have deals (same §4.1 query, scoped to the active market when there is one), each applying that date via the existing criteria-apply path. The existing `ResultCoverageBoundary` and `Edit search` / `See all destinations` buttons stay exactly as they are — this is additive. When the band holds no dates, render one honest line saying so; never render an empty affordance. **Do not route this through `resultMetadata`/`HotelRecoveryOption`** (§2.3: server never emits it, it is premium-gated, and it cannot represent a shift).
**Tests:** (a) with a date filter active and alternates present, the empty state names ≥1 real date and applying it yields ≥1 deal; (b) with no date filter active, the empty state is unchanged; (c) the signal renders for a **free, non-premium** session; (d) no price is rendered in this element under any state; (e) `Remove "From …"` remains available and unmodified.

### D3 — One per-deal element, corrected band and source
`NearbyDateNote` (`date-flex-savings/03-design.md`) remains the single per-deal nearby element on `DealCard` and `/deals/[dealId]`. This ticket amends it: band = §4.1 anchor-step rule (**±7 is void**), source = `deals` (§4.2), locked handling = §6.2. This ticket adds **no second line** to either surface.
**Tests:** (a) a hotel with deals on the 1st and 15th resolves `state: 'cheaper'` or `'none'` — never `'unchecked'` — proving the band reaches the neighbouring anchor; (b) a hotel with a single check-in date resolves `'unchecked'` and the card omits the element; (c) every rendered alternate maps to an active, non-expired, non-mock `deals` row; (d) a locked alternate renders a date and zero currency digits; (e) the primary deal's `verdict`, `percentile` and `confidence` are byte-identical with and without the element.

### D4 — Date-only mismatch gets a named-date acknowledgement; the guard is untouched
Per §5. Add `hotelCriteriaMismatchReason` alongside the unchanged `hotelCriteriaContextStatus`; render a third action in `HotelCriteriaMismatchAlert` **only** for reason `'date'`; label it with the deal's actual check-in date; apply through the existing `HotelDealCriteria.tsx:48–84` path.
**Tests:** (a) destination mismatch and `'both'` render today's alert with exactly two actions; (b) date-only mismatch renders three, the third naming the real check-in date; (c) `CompareRow` stays unrendered until the criteria actually change — asserted by leaving the alert open and confirming no provider link is in the DOM; (d) after applying, status is `matched` and the handoff renders normally; (e) the alert keeps `role="alert"`, and the new control is in tab order with a visible focus ring; (f) if the apply fetch fails, the existing failure branch renders and the guard is still blocking.

### D5 — Copy names dates and never claims coverage it does not have
Across D1–D4: every string names a **calendar date** (`Aug 15`), never a delta (`±3 days`, `2 weeks later`, `nearby`). Absence of alternates is stated as *not found in this window*, never as *none exist*. A failed lookup is stated as *not checked*, never rendered as silence that reads as *none cheaper*. All new elements are caption-scale secondary, `--text-2`/`--text-3` (feed/criteria surfaces) or `--ink-soft`/`--ink-faint` (card/detail surfaces — note the two token sets, `date-flex-savings/03-design.md:76`), never a filled colour block, never above the price.
**Tests:** (a) grep of all new strings contains no `±` and no relative day-count; (b) each of the three outcomes (dates found / none in window / lookup failed) has a distinct string; (c) every interactive date control exposes an `aria-label` naming the full date and the fact that it changes the search; (d) no new element renders currency in a locked or unchecked state; (e) 375px and 1280px both render with no overlap and no horizontal scroll.

---

## 8. Instrumentation gaps to close at launch (from discovery §3)

1. `feed_empty_filtered_viewed` / `feed_empty_cold_viewed` (`DealFeed.tsx:1360, 1366`) fire with **no payload**. Add `date_from_active` / `date_to_active` — both already computed for `hotel_results_viewed` (`:1264–1265`) and for `serializedFilterState()` (`:1259–1260`). Without them, "empty because of dates" is unmeasurable.
2. New exposure/apply pair for the date signal, carrying `surface: 'criteria' | 'empty_state' | 'deal_detail_mismatch'`, `dates_offered` (count), and `distance_days` on apply — `distance_days` is the field that will validate or refute §4.1's 21-day bound against real data.
3. Date-only re-edit loops are already derivable from `hotel_criteria_edit_applied.changed_fields` (`HotelDealCriteria.tsx:62–72`) — no new event needed, but nobody has counted them. That count is the pre-launch baseline for the success statement.

---

## 9. Conflicts and risks for downstream

- **CONFLICT (must be resolved by UXDES, resolution recommended in §4.1/§4.2):** `date-flex-savings/03-design.md` specifies a ±7-day band and a `price_snapshots` source. Against this corpus ±7 is always empty, and `price_snapshots` cannot satisfy this ticket's deal-row honesty constraint or supply an affiliate-marked link. UXDES must carry the correction into that spec's `UI-DATE-FLEX-SAVINGS-01` handoff, or the component ships dead.
- **Risk — the underlying problem is a capture-cadence problem.** Two anchors per market per month (`snapshot.ts:11–22`) is why date flexibility is unserviceable. Everything specified here makes the existing inventory *legible and reachable*; none of it creates inventory. Widening capture cadence is a pipeline change, out of scope for this ticket, and worth its own ticket.
- **Risk — `resultMetadata` looks like the natural home for date recovery and is a trap.** It is unemitted, premium-gated, and structurally unable to represent a date shift (§2.3). Building D2 on it would ship an invisible feature.
- **Out of scope, observed and not claimed:** `/api/deals` emitting `resultMetadata` at all; the destination axis of no-results recovery (`hotel-no-results-recovery`); `HotelCard`'s `PriceUnavailable` dead-end (`date-flex-savings` §1.3); flight-side flex confidence (`flexible-date-deal-confidence`); any change to snapshot capture cadence.

---

## 10. Handoff

- **Deliverable:** this brief, `docs/pipeline/hotel-date-flexibility/02-research.md`.
- **Next stage:** `UXDES-HOTEL-DATE-FLEXIBILITY-01` — implementation-ready spec for D1–D5, covering default / dates-found / none-in-window / lookup-failed / locked states, 375px and 1280px, focus and keyboard order, final copy for every visible string, and the `hotelCriteriaMismatchReason` contract extension. The spec must also carry the §4.1/§4.2 corrections into `date-flex-savings` so one element ships with one contract.
</content>
</invoke>
