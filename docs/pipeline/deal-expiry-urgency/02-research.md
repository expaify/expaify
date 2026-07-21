# UX Research — Deal Expiry & Urgency

**Ticket:** UXR-DEAL-EXPIRY-URGENCY-01
**Stage:** UXR (Research)
**Author:** Senior UX Researcher
**Date:** 2026-07-21

> **Upstream-doc blocker.** The discovery report referenced by the ticket
> (`docs/pipeline/deal-expiry-urgency/01-discovery.md`) does not exist on this
> branch — there is no `deal-expiry-urgency` discovery artifact at all. Per the
> pipeline contract, UXR should not begin before UXD output exists. This brief
> proceeds on the **problem statement embedded in the ticket** plus a direct
> audit of the current code, because that evidence is self-contained and the
> gap is verifiable in source. The missing doc is logged in
> **§8 Blockers** — UXDES should confirm the problem framing here matches
> whatever discovery intended before building the spec.

---

## 1. Problem (from ticket)

Users cannot tell which hotel deals are at real risk of disappearing versus
which are stable. The `expires_at` field shown on the deal detail page is a
**data-retention TTL** (`check_in_date + 90 days`) mislabeled as user-facing
urgency — it is not a deal-risk signal. Meanwhile a **real** risk signal (the
price-recovery trajectory encoded in `dealRules.ts`' `EXPIRE_THRESHOLD`
hysteresis band) is computed on every sweep and then thrown away — never
persisted, never surfaced.

Any urgency treatment must be **freshness-based or price-trend-based only** —
never countdown or inventory — to honor the existing scarcity-language ban in
`generateHeadline.ts`.

---

## 2. What the current code actually does (audit)

### 2.1 `expires_at` is a retention timer wearing an urgency mask
`lib/pipeline/dealDetection.ts:96-97` writes on every upsert:

```sql
expires_at = $10::DATE + INTERVAL '90 days'   -- $10 = check_in_date
```

Consequences, all verified in source:

- **`expires_at` is always ~90 days past check-in.** An active deal must have
  `check_in_date >= CURRENT_DATE` (dealDetection.ts:59, and the sweep at
  :141-145 expires anything past its check-in). So for any live deal,
  `expires_at` is *at minimum* today + 90 days. It carries **zero information
  about deal risk** — two deals expiring "the same day" can be a stable 45%-off
  hold and a fare about to snap back.
- **The detail page shows it as literal urgency copy.** `app/deals/[dealId]/page.tsx:396-400`
  renders `Expires {fmtDate(deal.expires_at)}` inside the "Why this is a deal"
  card. This is precise-looking, trust-eroding noise: a date the user reads as
  "act before this" that actually encodes "we stop retaining this row then."
- **Expired *presentation* is driven by the wrong field.** The detail page
  derives `isExpired` **entirely** from `expires_at < now`
  (`page.tsx:222`) and **never reads `status`** (confirmed: `status` appears
  nowhere in the page). Because `expires_at` is always future, a deal the
  pipeline has actually **expired for price recovery** (`status='expired'`,
  set in dealDetection.ts:129-136) still renders as fully **active and
  bookable** — hero, live price, `CompareRow`, "Save $X vs usual." See the
  email trust-risk probe in §5.

### 2.2 The real risk signal exists — and is discarded
`lib/pipeline/dealRules.ts` computes a three-way decision from
`ratio = latestPrice / median`:

| Ratio band | Decision | Meaning |
|---|---|---|
| `ratio ≤ 0.70` (`DEAL_THRESHOLD`) | `flag` | Deal-worthy |
| `0.70 < ratio ≤ 0.85` (`EXPIRE_THRESHOLD`) | `hold` | Hysteresis band — **drifting toward recovery** |
| `ratio > 0.85` | `expire` | Price recovered |

- The `hold` action is **silently dropped**: `dealDetection.ts` handles only
  `flag` (:77) and `expire` (:129). There is no `hold` branch and **no `ratio`
  column** on the `deals` table (`schema.sql:128-149`). So the single most
  useful risk gradient the system already computes — *how close is this fare to
  snapping back* — is never stored and never shown.
- A deal at `ratio 0.55` (deep, stable) and one at `ratio 0.84` (one sweep from
  expiring) are **visually identical** on every surface today. This is the core
  of the reported problem.

### 2.3 Freshness signals exist but are inconsistent across the three surfaces
The trustworthy urgency proxy the app *does* have is **recency of price
verification** (`timeAgo(updatedAt)`), but it is applied unevenly:

| Surface | Freshness treatment | Source |
|---|---|---|
| `DealCard.tsx` (feed) | `checked {timeAgo}` pill, top-right | :49, :98-105 |
| `deals/[dealId]/page.tsx` (detail) | `Price checked {ago}`; **aging** 30–48h → "verify with the provider" (gold); **stale** ≥48h → "Price may be out of date" banner | :224-227, :253-262, :326-330 |
| `HotelCard.tsx` (live search) | **Hardcoded `"Last-checked time unavailable"` everywhere** — freshness literally never shown | :46, :64, :416 |

- **The live hotel-search surface has no freshness at all** — the exact
  surface where "is this price real *right now*" matters most prints a static
  "unavailable" string in four places, even though the offer model already
  carries provenance timestamps elsewhere (`guestRating.fetchedAt`,
  rendered in `HotelCard` :353-356) and a `providerFreshness` helper is already
  imported (:7).
- **`updated_at` is overloaded.** It is bumped by the price upsert
  (dealDetection.ts:106) **and** by AI copy generation
  (`generateHeadline.ts:162,167` — `UPDATE deals SET headline=…, updated_at=NOW()`).
  So "Price checked {ago}" can be reset by a headline rewrite that touched no
  price. The freshness clock and the aging/stale thresholds key off a timestamp
  that is not a clean "last verified price" signal.

### 2.4 The scarcity-language ban is real and must be respected
`generateHeadline.ts:69` blocks generated copy containing:
`available | only | last chance | expires? | book now | limited`.
This is a deliberate, existing anti-manipulation guardrail. Note the irony: the
**static** UI string `Expires {date}` (page.tsx:398) would be rejected if it
came from the copy model. Any new urgency vocabulary must clear this same bar.

### 2.5 Sweep cadence anchors the freshness thresholds
`.github/workflows/snapshot.yml:5` runs `cron: '0 4 * * *'` — **once daily**.
The feed's own copy confirms it: "sweeps hotel prices … once a day"
(DealFeed.tsx:669). So a healthy deal is re-verified every ~24h. This makes the
existing 30h / 48h thresholds legible:

- **< 30h** = verified within the last sweep → *fresh*.
- **30–48h** = one sweep missed → *aging*.
- **≥ 48h** = two or more sweeps missed → *stale*.

---

## 3. Reference patterns (interaction level, not visual)

**Google Flights — the model to emulate.** Its urgency is *directional and
history-based*, never countdown/inventory: a "Price insights" band states
whether the current price is **low / typical / high** for these dates, whether
it is **trending up or down**, and a 60-day-style history graph backs it
("Prices are currently low — $X less than usual"). It qualifies confidence and
never invents scarcity. expaify already holds every input this needs (60-day
history, median, ratio, snapshot count, hysteresis band) and surfaces none of
it as risk.

**Booking.com — the anti-pattern to *partially* reject.** Booking leans on
inventory/countdown scarcity ("Only 1 room left," "Booked 5 times today,"
"Deal ends in HH:MM:SS"). expaify has explicitly banned this class of copy
(§2.4) — **do not port it.** Booking's one *honest, transferable* device is
its relative-price framing ("lower than average for your dates," "prices went
up since you last looked"), which is the same directional idea as Google
Flights.

**Delta:** expaify surfaces a meaningless 90-day retention date as "Expires,"
and hides the one genuine risk gradient it computes. The reference apps surface
a **confidence-qualified price-trend/freshness signal** and never a fake clock.
The fix is not to *add* urgency — it is to **replace a false signal with the
true one the system already produces.**

---

## 4. Design directives (specific, testable)

### D1 — Retire `expires_at` as user-facing copy; drive expired state from `status`
- **Remove** the `Expires {date}` line (page.tsx:396-400) and the
  `expires_at`-derived expired title (:303-308).
- **Re-derive** `isExpired`/`isAging`/`isStale` presentation from
  `deal.status === 'expired'` (add `status` to the `DealRow` select in
  `getDealById`, dealDetection.ts:184-196) — **not** from `expires_at`.
- Keep `expires_at` in the schema strictly as the retention TTL; it must never
  reach a component again.
- **Test:** a deal with `status='expired'` renders the expired action zone
  regardless of `expires_at`; a deal with `status='active'` never renders any
  "Expires"/"Expired" date string.

### D2 — Persist and surface the price-recovery trajectory (the real signal)
- Persist the sweep's `ratio` (or a derived band) on the `deals` row so the
  `hold` gradient survives. Handle the dropped `hold` action in
  `dealDetection.ts` by writing the current ratio/band on flag **and** hold.
- Map to **two** user-facing risk states (expire is already terminal):
  - **Holding** — `ratio ≤ 0.75`: fare sits comfortably below usual.
  - **Firming** — `0.75 < ratio ≤ 0.85` (upper hysteresis band): fare is
    climbing back toward its usual rate; genuinely more at-risk.
  - (`ratio > 0.85` → the pipeline already expires it; never a live state.)
- Surface as a **trend descriptor + the existing 60-day sparkline**, in
  trend/freshness vocabulary only (see §6 copy). No countdown, no "act now."
- **Test:** a deal whose latest ratio is in the upper band shows the *Firming*
  treatment; a deal deep below shows *Holding*; the two are visually
  distinguishable on card and detail.

### D3 — Unify freshness across all three surfaces; fix the HotelCard gap
- Replace `HotelCard`'s hardcoded `"Last-checked time unavailable"` (:46, :64,
  :416, :419, :421-422) with a real `checked {timeAgo}` when the offer carries a
  fetch timestamp (mirror the `guestRating.fetchedAt` precedent at :353-356 and
  the `providerFreshness` helper already imported). Only fall back to an
  explicit "freshness unavailable" when no timestamp exists.
- The `checked {ago}` device on `DealCard` and the detail page should read
  identically (same label, same thresholds).
- **Test:** an offer with a fetch timestamp renders "Checked {timeAgo}" in
  `HotelCard`, not "Last-checked time unavailable."

### D4 — One freshness threshold set, tied to the daily sweep, on every surface
- Fresh **< 30h**: quiet `Price checked {ago}` (neutral).
- Aging **30–48h** (one sweep missed): `Price checked {ago} — verify with the
  provider` (gold). **Add this to `DealCard`**, which today shows only the
  neutral pill regardless of age.
- Stale **≥ 48h** (two+ sweeps missed): the "Price may be out of date" banner
  pattern, extended from the detail page to the card as a compact treatment.
- **Test:** at 30h a card shows the aging treatment; at 48h the stale
  treatment; both match the detail page's behavior.

### D5 — Decouple the freshness clock from copy generation
- The freshness UI must reflect **last price verification**, not last row
  touch. Either (a) key the clock off the latest `price_snapshots.captured_at`
  for the deal, or (b) stop `generateHeadlines` from writing `updated_at`
  (generateHeadline.ts:162,167) so `updated_at` only advances on price
  re-verification.
- **Test:** regenerating a headline with no new price snapshot does **not**
  reset "Price checked {ago}" and does not move a deal out of aging/stale.

### D6 — Close the email → detail trust gap
- `sendDealAlert.ts:32-42` correctly gates on `status='active'` at send time,
  but a fare can recover *after* the email ships. Because the detail page
  ignores `status` (§2.1), the emailed link then presents a recovered deal as
  live and bookable. **D1 fixes this at the durable layer** (detail honors
  `status`).
- Optionally add a freshness/trend line to `DealAlert.tsx` (currently a static
  "We found a deal for you" with no recency), respecting the §2.4 ban.
- **Test:** opening a `status='expired'` deal from an alert link shows the
  expired presentation — no `CompareRow`, no "See the deal."

---

## 5. Trust-risk probes (run these against the fix)

1. **Recovered deal from an old email.** Deal emailed, then price recovers →
   `status='expired'`. Open the email link. **Today:** full bookable detail
   page ("Save $X vs usual," live compare links). **Must become:** expired
   state. *This is the highest-severity probe — it can send a user to a
   provider expecting a price that no longer exists.*
2. **"Expires" that never expires.** On any active deal, read the `Expires
   {date}` line and check the date — it is ~90 days past check-in for every
   deal. Confirm it is gone after D1.
3. **Twin deals, opposite risk.** A `ratio≈0.55` deal and a `ratio≈0.84` deal.
   **Today:** indistinguishable. **Must become:** *Holding* vs *Firming*.
4. **Headline rewrite resets the clock.** Trigger `generateHeadlines` on a deal
   with no new snapshot. **Today:** "Price checked" resets to "just now."
   **Must become:** unchanged (D5).
5. **Live hotel search freshness.** Run a live hotel search. **Today:** every
   card says "Last-checked time unavailable." **Must become:** a real recency
   line when the provider returned a timestamp.

---

## 6. Copy testing & vocabulary (must clear the §2.4 ban)

**Allowed register — freshness + trend, confidence-qualified:**
- `Price checked {ago}` / `Checked {ago}`
- `Price checked {ago} — verify with the provider` (aging)
- `Price may be out of date` (stale)
- `Holding below its usual rate` (low ratio)
- `Climbing back toward its usual rate` (upper hysteresis band)
- `{N} price checks over 60 days` (existing, keep)

**Banned — countdown / inventory / scarcity (rejected by generateHeadline.ts:69
and by brand):**
- ✗ "Expires in 4h", "Ends tonight", any HH:MM countdown
- ✗ "Only 2 rooms left", "In high demand", "Booked N times"
- ✗ "Last chance", "Book now", "Limited", "Selling fast"
- ✗ Any static "Expires {date}" (the current detail-page string — remove it)

**Copy-test the two risk states for comprehension:** *Holding* / *Firming* must
be understood as "how likely is this price to survive," not as availability.
UXDES should A/B the trend descriptor against a plain price-vs-usual delta and
pick whichever reads as *risk*, not *discount* (the discount is already covered
by `DealChip`).

---

## 7. Threshold recommendations (summary)

| Signal | Threshold | Rationale |
|---|---|---|
| Freshness — fresh | `< 30h` since last verified price | Within one daily sweep |
| Freshness — aging | `30h – 48h` | One sweep missed → "verify with provider" |
| Freshness — stale | `≥ 48h` | Two+ sweeps missed → "may be out of date" |
| Risk — Holding | `ratio ≤ 0.75` | Comfortably below usual; stable |
| Risk — Firming | `0.75 < ratio ≤ 0.85` | Upper hysteresis band; drifting toward recovery |
| Risk — Expired | `ratio > 0.85` (`EXPIRE_THRESHOLD`) | Already terminal; drive detail from `status`, not `expires_at` |

Freshness thresholds keep the detail page's existing 30/48h values (they are
well-chosen against a 24h sweep). Risk thresholds reuse the **existing**
`DEAL_THRESHOLD`/`EXPIRE_THRESHOLD` constants — 0.75 is the one new internal
split, chosen as the midpoint of the hysteresis band so *Firming* means
"measurably into the recovery zone," not merely "not a fresh flag."

---

## 8. Blockers & out-of-scope

- **Blocker (upstream):** the UXD discovery report
  (`docs/pipeline/deal-expiry-urgency/01-discovery.md`) is **absent**. This
  brief reconstructs the problem from the ticket + code and should be treated
  as provisional on the problem framing until discovery is located or
  regenerated. **UXDES must confirm** before speccing.
- **Out of scope for this ticket, flagged for a follow-up:** D2 and D5 require
  a **schema change** (a `ratio`/risk-band column, or reading
  `price_snapshots.captured_at`) and **pipeline logic** (handling the dropped
  `hold` action, decoupling `updated_at` from copy generation). These are
  **DEV-stage** changes, not UI-only. The design spec should split UI-only
  directives (D1 detail-page wiring off `status`, D3 HotelCard freshness, D4
  card thresholds, D6 copy) from directives that need a `DEV-*` ticket (D2
  persistence, D5 clock decoupling).
- No code was changed in this stage (research produces docs only).

---

## 9. Handoff

Next stage: **UXDES-DEAL-EXPIRY-URGENCY-01**. Design spec must cover, for every
state (default / aging / stale / firming / holding / expired / mobile 375px /
desktop 1280px / keyboard-focus): the three card surfaces (`DealCard`,
`HotelCard`, detail page), the removal of `expires_at` copy, the trajectory
descriptor, unified freshness thresholds, and the email line — all within the
freshness/trend vocabulary, no countdown/inventory.
