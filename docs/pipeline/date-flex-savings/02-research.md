# UXR-DATE-FLEX-SAVINGS-01 — UX Research: Flexible Date Savings

**Stage:** UXR (Research) · **Model:** Claude Fable 5 · **Priority:** P0
**Upstream:** `docs/pipeline/date-flex-savings/01-discovery.md` (see note below)
**Surface:** Hotel deals feed + deal detail (`/deals`, `/deals/[dealId]`), plus `HotelCard` price-unavailable states.

> **Doc note:** `01-discovery.md` for this feature slug is **not present on disk** at the time of research. The problem statement, audit scope, and constraints are taken verbatim from the ticket body, which carries the full discovery brief. This is recorded as an observation, not a blocker — every directive below is grounded in the actual source, not the missing doc.

---

## 1. Problem (restated from ticket)

A date-flexible traveler looking at a hotel whose **exact** check-in date is expensive (or has no confirmed price) gets **no signal** that a **nearby check-in window is cheaper**, so they abandon a saving that expaify already has the data to surface. The data exists: `price_snapshots` stores a price **per `check_in` date** per hotel, and `deals` are keyed `(hotel_id, market_id, check_in_date)`. But `getActiveDeals` returns per-check-in rows **flat, ungrouped by hotel**, and no surface compares one check-in date against its neighbours.

**Success (from discovery):** a first-time user viewing an expensive or unavailable exact date can see, without opening a calendar picker or re-searching, that a nearby check-in window is cheaper — or an honest statement that no cheaper nearby date was found / that nearby dates were not checked.

---

## 2. Current implementation audit (evidence)

### 2.1 Detection is per-check-in-date and cross-date-blind
- `detectDealsForMarket` groups snapshots by `GROUP BY hotel_id, hotel_name, stars, photo_url, check_in, market_id` (`lib/pipeline/dealDetection.ts:60`). Each `(hotel, check_in)` pair is evaluated **in isolation** by `evaluateDeal`, which flags when `latest ≤ 0.70 × median` **of that same check-in's own history** (`lib/pipeline/dealRules.ts:9,35`).
- `deals` is `UNIQUE (hotel_id, market_id, check_in_date)` (`lib/db/schema.sql:147`). **One hotel can therefore have several active `deals` rows**, one per qualifying check-in date. Nothing links or compares them.
- Consequence: the discount and the "Save $Y/night" line are a **temporal** comparison (this date now vs this date historically), **not** a cross-date comparison. The product currently has no concept of "cheaper if you shift your dates."

### 2.2 The feed lists per-date rows flat
- `getActiveDeals` selects rows and orders by `first_seen DESC` or `discount_pct DESC` (`lib/pipeline/dealDetection.ts:238,277–300`) with **no `GROUP BY hotel_id`** and **no nearby-date aggregation**.
- `DealFeed` renders each row as an independent `DealCard` (`app/deals/DealFeed.tsx:681–714`). Two check-in dates for the same hotel would appear as two unrelated cards, or (more often) only the single date that crossed the 30% threshold appears — with no hint that adjacent dates exist or differ.

### 2.3 The card shows one window, no alternate
- `DealCard` renders a single `deal.checkInWindow` string (e.g. `"Aug 3 – Aug 5"`) inline in the metadata line (`app/components/ui/DealCard.tsx:129`) and a single price with a `usually {median}` strike + `Save $X/night` (`:135–148`). There is **no alternate-date element and no field for one** in `DealCardDeal` (`:14–30`).

### 2.4 The detail page shows one check-in / check-out, no nearby dates
- `/deals/[dealId]` derives one `checkInDisplay` / `checkOutDisplay` from `deal.check_in_date` + `nights` (`app/deals/[dealId]/page.tsx:233–234, 409–410`).
- Its history query, `getPriceHistory`, aggregates `AVG(price_cents) … GROUP BY snapshot_date` (`lib/pipeline/dealDetection.ts:200–207`) — i.e. **a time series of when prices were captured, not a series across check-in dates.** So even the detail page, which already resolves `marketId`, has **no nearby-check-in view**.
- OTA deeplinks are built once for the flagged `checkIn`/`checkOut` only (`lib/pipeline/dealDetection.ts:79–88` → `buildOtaLinks`, `lib/pipeline/otaLinks.ts:14–44`). An alternate date would need its own affiliate-marked link built for that date pair.

### 2.5 Unavailable-exact-price states exist but are dead-ends
- `HotelCard` renders `PriceUnavailable` when `!isValidMoney(hotel.pricePerNight)` (`app/components/HotelCard.tsx:52–68, 479–483`) and a disabled `Booking unavailable` control (`:501–509`). Reasons distinguish "no confirmed price" vs "no valid link" (`:70–80`). **None of these offer a nearby date as a recovery path** — the user hits a wall.
- On the detail page, the "Provider link unavailable" and "Deal expired" blocks (`app/deals/[dealId]/page.tsx:337–361`) are likewise terminal.

### 2.6 Data that already exists and is unused for this purpose
- `price_snapshots (hotel_id, market_id, check_in, price_cents, snapshot_date, captured_at, is_mock)` — `UNIQUE (hotel_id, market_id, check_in, snapshot_date)`, indexed on `(hotel_id, market_id, check_in DESC)` (`lib/db/schema.sql:104–121`). **This is the source of truth for "what does this hotel cost on nearby check-in dates."** It is queried today only for same-date detection and for capture-time history — never banded across `check_in`.

**Bottom line:** the app already stores per-check-in prices but throws away the cross-date relationship at every layer — detection, query, card, and detail.

---

## 3. Reference patterns (interaction level, not visual)

- **Google Hotels — "cheaper around your dates."** When a selected date is not the cheapest, Google surfaces a compact inline nudge naming a nearby date and its lower price, with one tap to switch. It never fabricates: if it has no nearby data it simply omits the nudge. **Pattern to borrow:** a single, factual "shift N days → $X (save $Y)" line, present only when real cheaper data exists.
- **Booking.com — "Try different dates" / small ± day price hints.** Booking shows a low compact strip of adjacent-date prices when flexible, distinct from its full calendar. **Pattern to borrow:** show *at most one* best alternate as the primary nudge; the strip is secondary and never the primary results scan.
- **Anti-pattern (explicitly out of scope):** Google Flights' full date grid / price calendar. The ticket forbids a calendar picker or search rebuild. We surface a **derived best-alternate**, not an interactive grid.

**Delta:** references show a *single, honest, one-tap* cheaper-nearby-date nudge derived from data they already have. expaify has the same data (`price_snapshots.check_in`) and shows nothing.

---

## 4. Minimum viable date-range display — requirements

A compact secondary element ("**Flexible? Save by shifting dates**") on the `DealCard` and/or deal detail. It must resolve to exactly one of **four mutually-exclusive states** and must never fabricate a price.

### 4.1 Source data (exact)
Compute per deal from `price_snapshots`, scoped to the deal's `hotel_id` + `market_id`, over a **bounded band of check-in dates** around `deal.check_in_date` (recommend **±7 days**, matching the "no calendar" constraint while covering a week each way):

- For each `check_in` in the band, take the **latest** price for that date: `price_cents` ordered by `captured_at DESC LIMIT 1` (same "latest per check-in" logic already used at `lib/pipeline/dealDetection.ts:51–53`).
- Exclude `is_mock = true` rows from real comparisons (never mix sample and real prices).
- Require a **freshness bound**: only count an alternate check-in whose latest snapshot was captured within the same window the feed already trusts (deals age to "stale" at ≥48h on the detail page — reuse that bar; do not present an alternate older than that as current).
- Track, per band: `nearbyDatesChecked` (count of check-in dates in the band that had **any** fresh snapshot) and `bestAlternate` = the fresh check-in with the lowest latest price that is **materially** below the deal's own price.

### 4.2 Fields the UI needs (exact)
Extend the deal payload (`DealRow` → `ApiDeal` → `DealCardDeal`) with a single optional object, e.g. `nearbyDate`:

| Field | Type | Meaning / source |
|---|---|---|
| `state` | `'cheaper' \| 'none' \| 'unchecked'` | which of the four scenarios (unavailable-exact folds into the card's existing unavailable path; see §5) |
| `checkInDate` | `string` (YYYY-MM-DD) | `bestAlternate` check-in; present only when `state='cheaper'` |
| `window` | `string` | human window e.g. `"Aug 10 – Aug 12"`, built the same way as `formatWindow` (`dealDetection.ts:32–38`) |
| `priceCents` | `number` (minor units) | latest fresh price for that check-in; never a float, never invented |
| `savingsCents` | `number` | `deal.deal_price_cents − priceCents`, must be `> 0` to qualify as `cheaper` |
| `snapshotCount` | `number` | number of checks backing the alternate date (drives confidence copy) |
| `deeplink` | `string` | OTA link built for the alternate `checkIn/checkOut` via `buildOtaLinks`, **with affiliate markers** (see §6) |
| `nearbyDatesChecked` | `number` | how many check-in dates in the band had fresh data (distinguishes `none` from `unchecked`) |

### 4.3 Distinguishing the four states (honesty rules)
1. **`cheaper`** — a fresh, non-mock nearby check-in exists whose latest price is **materially** below the deal price. Threshold recommendation: `savingsCents ≥ 2000` (≥ $20/night), reusing the card's existing "worth showing" bar (`DealCard.tsx:48`). Copy states the date, the price, and the saving.
2. **`none`** — `nearbyDatesChecked ≥ 1` **and** no alternate clears the material-savings bar. Copy: nearby dates **were** checked and this window is already the/among the cheapest. This is a *positive trust signal*, not an error.
3. **`unchecked`** — `nearbyDatesChecked = 0` (no fresh nearby snapshots). Copy must say nearby dates were **not** compared — never imply we looked. The element may be **omitted entirely** rather than shown empty; if shown, it must not present a price.
4. **`unavailable-exact`** — the exact-date price is missing (`HotelCard` `PriceUnavailable`, or detail "Provider link unavailable"). Here the nearby element becomes the **recovery path**: if a `cheaper`/available alternate exists, offer it as the way forward; if not, fall back to `none`/`unchecked` copy. Never leave the unavailable state a dead-end when a fresh alternate exists.

### 4.4 Thin-history / confidence rules (Deal Score honesty)
- The alternate's price is a **factual observed price**, but its trust must scale with `snapshotCount`. If the alternate check-in has **fewer than `MIN_SNAPSHOTS` (3)** fresh snapshots, do **not** present it as a comparable deal — either suppress it or label it explicitly as "seen once, not yet confirmed," and never render a verdict badge on it.
- **Never upgrade a verdict** because a cheaper nearby date exists. The alternate does not change the primary deal's `verdict`, `percentile`, or `confidence`. A `confidence: 'low'` deal (fewer than 10 history points per the scoring contract) must not gain a `Great`/`Good` implication from a nearby-date nudge.
- Never show a **computed/interpolated** price for a check-in date that has no snapshot. Absence of data ⇒ `unchecked`, not an estimate.

---

## 5. Testable scenarios

Each scenario is written against the real data model so DEV/TEST can seed `price_snapshots` and assert.

### S1 — Expensive exact date, cheaper nearby (`cheaper`)
**Setup:** Hotel H, market M. `check_in = D0` has ≥3 fresh snapshots, latest price **$240**. `check_in = D0+3` has ≥3 fresh snapshots, latest price **$180**. Both non-mock.
**Expect:** Nearby element on H's card/detail shows `state='cheaper'`, `window` for `D0+3`, `priceCents = 18000`, `savingsCents = 6000`, and an **affiliate-marked** deeplink for the `D0+3` check-in/checkout pair. Primary deal price/verdict for `D0` is unchanged. Element is legible and non-overlapping at 375px and 1280px.

### S2 — No cheaper nearby date (`none`)
**Setup:** Hotel H. `check_in = D0` latest **$180** (≥3 snapshots). All check-ins in ±7 days that have fresh data are **≥ $180** (or within the < $20 material bar).
**Expect:** `state='none'`, `nearbyDatesChecked ≥ 1`. Copy affirms nearby dates were checked and this is already among the cheapest. **No price/deeplink for an alternate is shown.** No fabricated saving.

### S3 — Unavailable exact price (`unavailable-exact`)
**Setup:** Hotel H exact-date price missing/invalid (`PriceUnavailable` path, `HotelCard.tsx:479–483`). A fresh nearby check-in `D0+2` has a valid price **$160**, ≥3 snapshots.
**Expect:** The unavailable state is **not a dead-end**: it surfaces the `D0+2` alternate as the recovery action with its price and affiliate-marked deeplink. If *no* fresh alternate exists, it falls back to `none`/`unchecked` copy — still never inventing a price. Existing `PriceUnavailable` aria/reason copy is preserved.

### S4 — Thin history / not-checked (`unchecked` + confidence:low)
**Setup A (unchecked):** Hotel H, `check_in = D0` is a valid deal, but **no other check-in date in the ±7 band has any fresh snapshot** (`nearbyDatesChecked = 0`).
**Expect:** `state='unchecked'`. Copy says nearby dates were **not** compared (or the element is omitted). No price shown. No implication that we looked.
**Setup B (thin alternate):** A nearby check-in `D0+4` exists but has **fewer than 3** fresh snapshots at **$150** while D0 is $220.
**Expect:** The $150 date is **not** promoted as a confirmed cheaper deal; it is suppressed or explicitly flagged as unconfirmed with **no verdict badge**. The primary deal's `confidence`/`verdict` is unchanged. No verdict upgrade occurs.

---

## 6. Constraints (carried into design)

1. **No full-search rebuild, no calendar picker.** Surface a single derived best-alternate as a compact secondary element; do not add an interactive date grid or a new search flow.
2. **Deal Score honesty.** No fabricated nearby prices (data-absent ⇒ `unchecked`), no verdict upgrade on thin data, no interpolation. Alternate trust scales with `snapshotCount`; `< 3` snapshots is never a confirmed cheaper deal.
3. **Compact + responsive + accessible.** Usable and non-overlapping at **375px** and **1280px**; the nearby element is **secondary** to the primary price/verdict and must not dominate the scan. Interactive (deeplink) elements are keyboard-reachable with a visible focus ring and a descriptive `aria-label` naming the date, price, and saving.
4. **Affiliate markers on any alternate-date deeplink.** Any alternate-date OTA link is built through `lib/providers` / `buildOtaLinks` so affiliate params (`EXPEDIA_AFFILIATE_ID`, `BOOKING_AFFILIATE_ID`, `KIWI_AFFILIATE_ID`, `TP_AFFILIATE_MARKER`) are attached, exactly as the primary link (`lib/pipeline/otaLinks.ts:22–41`). Money stays `{ priceCents, currency }` minor units throughout.
5. **Distinct from `flexible-date-deal-confidence`.** See §8. Do not merge.

---

## 7. Design directives (specific, testable)

1. **Add a `nearbyDate` object to the deal payload** (`DealRow`/`ApiDeal`/`DealCardDeal`) with the fields in §4.2, computed by a new band query over `price_snapshots.check_in` (±7 days, latest-per-check-in, non-mock, freshness-bounded). DEV owns the query; design must spec every rendered field. **Test:** payload carries a resolvable `state` for every deal; `cheaper` always carries `priceCents`, `savingsCents > 0`, and a deeplink.
2. **Render a single compact secondary element** below the price on `DealCard` and in the detail price section — one best-alternate only, never a grid. Primary price/verdict hierarchy is preserved; the element is visually subordinate (caption-scale, `--text-2`/`--ink-soft`, no large color fill). **Test:** at 375px the card shows price → nearby line → trust line with no overlap or truncation of the price.
3. **Copy is state-exact and honest.** `cheaper`: "Save $Y — check in {window} instead." `none`: "Checked nearby dates — this window is already among the cheapest." `unchecked`: element omitted, or "Nearby dates not compared." Never show a price in `none`/`unchecked`. **Test:** S2/S4 render zero price digits in the nearby element.
4. **The unavailable-exact state offers the alternate as recovery** rather than a dead-end, without altering existing `PriceUnavailable` reason/aria copy (`HotelCard.tsx:52–68`). **Test:** S3 renders an actionable, affiliate-marked alternate when one exists; otherwise honest fallback.
5. **Affiliate + accessibility parity.** Alternate deeplink built via `buildOtaLinks` with markers; interactive element keyboard-focusable with visible ring and an `aria-label` naming date + price + saving. **Test:** alternate `href` contains the affiliate param; tab order reaches it; focus ring visible.

---

## 8. Distinctness from `flexible-date-deal-confidence` (do not merge)

| | **date-flex-savings (this ticket)** | **flexible-date-deal-confidence** |
|---|---|---|
| Surface | **Hotels** — deals feed + deal detail + HotelCard | **Flights** — flight results / summary |
| Goal | Show a **cheaper nearby check-in** the user can act on (savings) | Explain **whether nearby dates were checked** before scoring (trust) |
| Data | `price_snapshots.check_in` banded across dates | Travelpayouts ±3-day departure window coverage, calendar route (`app/api/calendar`, `lib/deals/pricePulse.ts`) |
| Output | A best-alternate price + affiliate deeplink | A confidence/coverage statement on the Deal Score |
| Shared discipline | Same honesty rules (no fabrication, no verdict upgrade on thin data) — but different surface, different data, different action | |

They rhyme on Deal Score honesty and must stay consistent in tone, but the surfaces, data sources, and user actions do not overlap. Keep as two tickets.

---

## 9. Handoff

- **Deliverable:** this brief, `docs/pipeline/date-flex-savings/02-research.md`.
- **Next stage:** `UXDES-DATE-FLEX-SAVINGS-01` (UX Design) — produce implementation-ready spec for the nearby-date element covering all four states in §4.3, both surfaces (card + detail), 375px/1280px, focus/keyboard, and final copy per §7.3.
- **Open items for design to resolve:** exact band width if ±7 days proves too sparse in seed data; whether `unchecked` is omitted vs shown; whether the element appears on both card and detail or detail-only for v1 (recommend detail-first if card density is a concern at 375px).
