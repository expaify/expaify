# UXDES-DATE-FLEX-SAVINGS-01 — UX Design Spec: Flexible Date Savings

**Stage:** UXDES (Design) · **Model:** Claude Fable 5 · **Priority:** P0
**Upstream:** `docs/pipeline/date-flex-savings/02-research.md` (discovery folded into ticket body; `01-discovery.md` not on disk — recorded in research §1).
**Surfaces in scope:** `DealCard` (deals feed) and `/deals/[dealId]` (deal detail). The unavailable-exact recovery path also touches `HotelCard`'s `PriceUnavailable` block — specified here as an adjacent variant so UI does not leave it a dead-end, but the two primary surfaces are the card and the detail page per the ticket.
**Next stage:** `UI-DATE-FLEX-SAVINGS-01`.

---

## 0. What this component is (one sentence)

A single, compact, **secondary** line that tells a date-flexible traveler whether a **nearby check-in date is cheaper** — stating the date, the price, and the saving when one exists, and stating honestly when nearby dates were checked-and-not-cheaper or not-checked — never fabricating a price and never changing the primary deal's verdict.

**Name:** `NearbyDateNote` (one shared presentational component, two visual variants: `card` and `detail`). It is presentational only — it receives a resolved `nearbyDate` object and renders. All banding/freshness/honesty resolution happens in the data layer (DEV, `UI-` wires the prop through).

---

## 1. Component placement & hierarchy

The nearby element is **always subordinate** to the primary price and verdict. It never uses display type, never uses a large color fill, never sits above the price. Hierarchy on both surfaces, top → bottom:

1. **Primary (unchanged):** deal price, `usually {median}` strike, `Save $X/night` (temporal saving vs history).
2. **Secondary (this ticket):** `NearbyDateNote` — caption-scale, muted, one line + optional action.
3. **Tertiary (unchanged):** OTA compare row, trust line / price-checks line.

> The card's existing `Save $X/night` (median-vs-now, temporal) and this element's `Save $Y` (shift-your-dates, cross-date) are **different comparisons**. To avoid two "Save $…" lines colliding, this element's lead verb is **"Check in {window} — save $Y"** (action-first), visually distinct from the primary `Save $X/night`. See copy §4.

### 1.1 DealCard — exact insertion point
Insert directly **after** the price block (`app/components/ui/DealCard.tsx:149`, the closing `</div>` of the price `space-y-[2px]` block) and **before** the OTA compare (`:151`). It lives inside the existing `space-y-3` body, so it inherits the 12px vertical rhythm. Not rendered for `deal.isMock` (mock cards already say "Sample hotel — not bookable").

### 1.2 Detail page — exact insertion point
`/deals/[dealId]` — inside the **Price** `<section>` (`app/deals/[dealId]/page.tsx:315–334`), after the "Nightly rate before taxes and fees" caption (`:331–333`) and before the primary action zone (`:336`). Reason: it belongs with price context, and it must be able to become the **recovery action** when the primary action zone is the "Provider link unavailable" dead-end (`:354–361`).

### 1.3 HotelCard — adjacent unavailable-exact variant (search results)
When `HotelCard` renders `PriceUnavailable` (`app/components/HotelCard.tsx:479–483`) and a fresh cheaper alternate exists, render `NearbyDateNote` (variant `card`) in the row **below** the price/score grid — inside the `mt-3 grid` action row area (`:486`), spanning full width above or below the `ScoreChip`/`Booking unavailable` row. It does **not** alter the existing `PriceUnavailable` reason/aria copy. This is the only case where the element may appear without a primary price above it. If no fresh alternate exists, `HotelCard` is unchanged (element omitted).

---

## 2. Data contract the UI renders (design view of research §4.2)

The UI receives one optional object on the deal/hotel payload. Design does not own the query; it owns **every rendered field and the render rules**. DEV resolves `state` server-side per research §4.3.

```ts
type NearbyDate = {
  state: 'cheaper' | 'none' | 'unchecked';   // 'unavailable-exact' is a host-surface condition, not a value here (see §3.4)
  window?: string;          // "Aug 10 – Aug 12"  — present iff state==='cheaper'
  checkInDate?: string;     // "YYYY-MM-DD"        — present iff state==='cheaper'
  price?: Money;            // { priceCents, currency } — present iff state==='cheaper'. NEVER a float, NEVER invented.
  savingsCents?: number;    // dealPriceCents − price.priceCents — present iff state==='cheaper', must be > 0
  snapshotCount?: number;   // checks backing the alternate — present iff state==='cheaper'
  nearbyDatesChecked: number; // band check-ins with fresh data; distinguishes 'none' (≥1) from 'unchecked' (0)
  deeplink?: string;        // single affiliate-marked OTA link for the alternate — present iff state==='cheaper'
};
```

- **Money stays `{ priceCents, currency }`** minor units end to end. The element formats with `formatMoney` (same as the card/detail).
- `savingsCents` is rendered via `formatMoney({ priceCents: savingsCents, currency: price.currency })` — never divided, never a bare number.
- `deeplink` is built by the data layer via `buildOtaLinks` for the alternate `checkIn`/`checkOut` pair, so affiliate markers are attached exactly as the primary link (research §6, `lib/pipeline/otaLinks.ts:22–41`). The UI **must not** construct URLs.

### 2.1 Component guardrails (the UI enforces honesty even if data is malformed)
The component renders `cheaper` **only if all hold**; otherwise it degrades to `none` rendering (no price, no link):
- `state === 'cheaper'`, and
- `price` is valid money (`isValidMoney`), and
- `savingsCents >= 2000` (≥ $20/night — reuses `DealCard.tsx:48` material bar), and
- `snapshotCount >= 3` (research §4.4 — `< 3` is never a confirmed cheaper deal), and
- `deeplink` is a non-empty `https`/`http` URL (reuse `isValidBookingUrl`-style check).

If `state === 'cheaper'` but any guardrail fails, render **nothing** on the card (omit) and render the `none` copy on the detail page (detail always keeps the honest line for trust). This makes fabrication structurally impossible in the view layer.

---

## 3. The four states — copy, tokens, classes, per surface

Copy is final. No placeholders. `{window}` = e.g. `"Aug 10 – Aug 12"`. `{Y}` = `formatMoney(savings)` e.g. `"$60"`. Never render a currency digit in `none` or `unchecked`.

Token note: **DealCard and detail** use the ink/primary set (`--ink`, `--ink-soft`, `--ink-faint`, `--primary`, `--line-ivory`, `--line-white`, `--surface`). **HotelCard** uses the alias set (`--text-1/2/3`, `--border`, `--brand`, `--warning`). Classes below are given for the ink set; the HotelCard variant maps 1:1 (`--ink→--text-1`, `--ink-soft→--text-2`, `--ink-faint→--text-3`, `--primary→--brand`).

### 3.1 State `cheaper`
The only state with a price and an action.

- **Lead line (fact):** `Check in {window} — save {Y}`
- **Price clause (same line, muted):** `· {price}/night`
- **Action (the deeplink):** the whole line is one keyboard-focusable link (see §5). Trailing arrow glyph `→` (aria-hidden).
- **Confidence caveat (only when `snapshotCount` is 3–9, inclusive):** append a second caption line: `Seen in {snapshotCount} recent checks.` When `snapshotCount ≥ 10`, omit the caveat (enough history; still no verdict claim). Never render a verdict/Great/Good word here (research §4.4).

**DealCard variant — classes**
```html
<a
  href={deeplink} target="_blank" rel="noopener noreferrer sponsored"
  aria-label="Cheaper nearby date. Check in {window}. {price} per night. Save {Y} versus this deal. Opens provider site."
  class="group/nd -mx-1 flex items-baseline gap-1 rounded-[var(--radius-input)] px-1 py-1
         text-[12px] font-medium leading-snug text-[color:var(--primary)] no-underline
         hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
         focus-visible:outline-[color:var(--primary)]">
  <svg aria-hidden … class="mt-[1px] h-3 w-3 shrink-0"><!-- calendar-shift glyph --></svg>
  <span class="min-w-0">
    Check in <span class="font-semibold">{window}</span> — save {Y}
    <span class="font-normal text-[color:var(--ink-faint)]">· {price}/night</span>
    <span aria-hidden class="text-[color:var(--ink-faint)]">→</span>
  </span>
</a>
<!-- caveat, only when 3 ≤ snapshotCount ≤ 9 -->
<p class="mt-0.5 text-caption leading-snug text-[color:var(--ink-faint)]">Seen in {snapshotCount} recent checks.</p>
```
Rationale: `--primary` (teal) signals "actionable + saving" and matches the primary `Save $X/night` color, so the two savings read as one family without competing (this one is smaller, action-verb-led). Caption scale (12px line, 11.5px caveat) keeps it subordinate to the 26px price.

**Detail variant — classes** (slightly larger touch target, sits in the price section)
```html
<a href={deeplink} target="_blank" rel="noopener noreferrer sponsored"
   aria-label="…same as above…"
   class="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-input)]
          border-[1.5px] border-[color:var(--line-white)] bg-[color:var(--surface)] px-3
          text-[13px] font-semibold leading-none text-[color:var(--primary)] no-underline
          hover:border-[color:var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]">
  <svg aria-hidden …/>Check in {window} — save {Y} · {price}/night <span aria-hidden>→</span>
</a>
<p class="mt-2 text-caption leading-5 text-[color:var(--ink-soft)]">
  Alternate check-in dates near your stay. Prices and availability are confirmed by the provider.
</p>
```
Detail keeps the `min-h-[44px]` target (touch) because it can be the recovery action; card stays inline (it's a nested link inside the card's own link — see §5.2).

### 3.2 State `none` — checked, nothing cheaper (positive trust signal)
- **Copy (both surfaces):** `Checked nearby dates — this window is already among the cheapest.`
- No price, no link, no arrow. Not interactive.

```html
<p class="flex items-baseline gap-1 text-[12px] leading-snug text-[color:var(--ink-soft)]">
  <svg aria-hidden class="mt-[1px] h-3 w-3 shrink-0 text-[color:var(--ink-faint)]"><!-- check glyph --></svg>
  Checked nearby dates — this window is already among the cheapest.
</p>
```
Detail variant: same string, `text-caption leading-5 text-[color:var(--ink-soft)] mt-3`. `role` not needed (static text). This is deliberately a **reassurance**, not an error — muted ink, no warning color.

### 3.3 State `unchecked` — no fresh nearby data
- **DealCard:** **omit the element entirely.** A card is a dense scan; an empty "not compared" line adds noise with no user value. (Research §4.3.3 permits omission; §7.3 confirms.)
- **Detail:** render one honest caption so the page never implies we looked:
  `Nearby dates not compared for this stay.`

```html
<!-- detail only -->
<p class="mt-3 text-caption leading-5 text-[color:var(--ink-faint)]">Nearby dates not compared for this stay.</p>
```
No price, no link, no interactive affordance, ever.

### 3.4 Condition `unavailable-exact` — the recovery path (not a state value)
`unavailable-exact` is **not** a `nearbyDate.state` value; it is a **host-surface condition** (the exact-date price is missing) under which `NearbyDateNote` changes role from *nudge* to *primary recovery*. Two hosts:

**Detail page** — when the action zone is "Provider link unavailable" (`page.tsx:354–361`):
- If `nearbyDate.state === 'cheaper'`: replace the passive dead-end copy's terminality by rendering the `cheaper` **detail variant link as the actionable way forward**, directly inside that block, under the existing explanatory text. Keep the existing block heading but soften the terminal tone:
  - Heading (unchanged intent): `Provider link unavailable`
  - Body (revised): `We don't have a current booking link for these exact dates — but a nearby check-in is available:`
  - Then the `cheaper` link (§3.1 detail variant).
- If `state` is `none`/`unchecked`: keep the existing block **unchanged** (no fabricated alternate). Honesty preserved.

**HotelCard** (search results, `PriceUnavailable`) — §1.3:
- If a fresh `cheaper` alternate exists: render the `card` variant link below the score/booking row. `PriceUnavailable`'s `reason`/`aria-label` copy is **untouched** (research §7.4). The alternate is additive recovery, not a replacement of the honest "Price unavailable" statement.
- Else: `HotelCard` unchanged.

**Never** invent a price to fill an unavailable exact date. Absence of alternate data ⇒ the unavailable state stays as-is (research §4.4).

---

## 4. Final copy table (every visible string)

| Context | String |
|---|---|
| `cheaper` — card/detail lead | `Check in {window} — save {Y}` |
| `cheaper` — price clause | `· {price}/night` |
| `cheaper` — confidence caveat (3–9 snapshots) | `Seen in {snapshotCount} recent checks.` |
| `cheaper` — detail helper caption | `Alternate check-in dates near your stay. Prices and availability are confirmed by the provider.` |
| `none` — both | `Checked nearby dates — this window is already among the cheapest.` |
| `unchecked` — detail only (card omits) | `Nearby dates not compared for this stay.` |
| `unavailable-exact` + cheaper — detail body | `We don't have a current booking link for these exact dates — but a nearby check-in is available:` |
| `cheaper` — aria-label (link) | `Cheaper nearby date. Check in {window}. {price} per night. Save {Y} versus this deal. Opens provider site.` |

No "Lorem", no TODO, no placeholder. `{Y}`, `{price}` are `formatMoney` outputs; `{window}` is `formatWindow`-style (`"Mon D – Mon D"`).

---

## 5. Interaction, keyboard, focus, a11y

### 5.1 Interaction rules
- **`cheaper` tap / Enter / Space:** opens `deeplink` in a new tab (`target="_blank" rel="noopener noreferrer sponsored"` — `sponsored` matches `CompareRow.tsx:40`, required for affiliate links).
- **`none` / `unchecked`:** non-interactive; not in tab order; no hover state.
- **No client fetch, no retry state.** The object is resolved server-side and passed as a prop; there is no loading spinner and no error/retry UI for this element (if resolution failed upstream, `state` is `unchecked` and the card omits it). This keeps the element from ever showing a stale/loading price.

### 5.2 The nested-link problem on DealCard (must-fix for UI)
`DealCard` optionally wraps the **entire card** in an `<a href={href}>` (`DealCard.tsx:170–174`). A focusable `cheaper` link nested inside another `<a>` is invalid HTML and breaks keyboard order. Resolution (design decision, UI implements):
- When the card is wrapped in the outer link, render the `cheaper` nearby line as **plain text** (the same lead/price copy, `--primary`, no `href`, not focusable). The outer card link already routes to `/deals/[dealId]`, where the fully actionable alternate link lives.
- The **actionable, affiliate-marked alternate link is guaranteed on the detail page** (§3.1 detail variant) and on `HotelCard` (which is not wrapped in an outer link). So the deeplink + affiliate requirement (research §6) is satisfied on every surface that legally can carry it, and the card never emits nested anchors.
- If a future DealCard usage passes no `href` (unwrapped), the card **may** render the actionable link. UI keys this off the same `href` prop the card already receives.

### 5.3 Focus ring
Interactive variants use the app's focus system: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]` (card) and inherit the global `:focus-visible` ring + `--focus-ring` box-shadow (globals.css:105–112) on the detail button. Ring must be visible against `--surface` and `--bg` — `--primary` teal passes.

### 5.4 aria
- `cheaper` link: descriptive `aria-label` naming **date + price + saving + "Opens provider site"** (§4 table). The visible arrow `→` and leading glyph are `aria-hidden`.
- `none` / `unchecked`: plain `<p>`, no role, read in DOM order after the price. No `aria-live` (content is static at render).
- Glyphs (calendar-shift, check) are decorative → `aria-hidden`, with the text carrying meaning.

---

## 6. Responsive — 375px and 1280px

### 375px (mobile)
- Element is a single line that **wraps gracefully**: lead + saving stay together; the `· {price}/night` clause and `→` wrap to a second line if needed (`flex` + `min-w-0`, `leading-snug`). The **primary price (26px) must never truncate or overlap** — the nearby element sits in its own row in the `space-y-3` stack, so vertical stacking guarantees no collision (acceptance: research §7.2 test).
- Detail variant link: `min-h-[44px]`, may wrap its label across two lines; keeps 44px min target.
- HotelCard variant: full-width row under the score/booking grid; does not compete with the fixed-width price column (`min-w-[6.75rem] max-w-[9.5rem]`, `HotelCard.tsx:36`).
- Confidence caveat wraps under the lead line; both remain caption-scale.

### 1280px (desktop)
- Card: element sits comfortably on one line under the price; total card body height grows by ~1 line (cheaper) / 0 (unchecked, omitted) / 1 line (none). Feed grid rhythm preserved.
- Detail: element is one line within the price section; the recovery-path variant sits inside the unavailable block with normal flow.

No horizontal scroll, no overlap, no clipped text at either width. Glyph + text use `items-baseline` so the icon aligns to the cap height.

---

## 7. Honesty rules encoded (carry into UI + DEV; do not merge with flights ticket)

1. **No fabricated price.** Price renders only in `cheaper`, only from `nearbyDate.price` (real observed minor-units). `none`/`unchecked` render zero currency digits — the component has no code path that formats money outside `cheaper`.
2. **Thin data never a confirmed cheaper deal.** `< 3` snapshots ⇒ guardrail (§2.1) suppresses the price/link. `3–9` snapshots ⇒ price shows **with** the "Seen in N recent checks" caveat and **no verdict word**. `≥ 10` ⇒ price shows, no caveat, still no verdict word.
3. **No verdict upgrade.** This element never renders a Great/Good/Typical badge, never touches `score`/`verdict`/`percentile`/`confidence`. A `confidence: 'low'` deal shows the same nearby element with no implied score lift (research §4.4).
4. **No interpolation.** Data-absent ⇒ `unchecked`, never an estimate. The UI cannot compute a price; it only formats `nearbyDate.price`.
5. **Affiliate markers.** `deeplink` comes pre-built from `buildOtaLinks`; UI renders it verbatim with `rel="…sponsored"`. UI never assembles a URL (research §6).
6. **Distinct from `flexible-date-deal-confidence`.** This is hotels / savings / action (a cheaper check-in). The flights ticket is trust/coverage on the Deal Score. Same honesty tone, different component, different surface — do not share code or copy (research §8).

---

## 8. Acceptance mapping (research §5 scenarios → this spec)

| Scenario | Expected render | Spec ref |
|---|---|---|
| **S1** cheaper nearby ($240→$180, ≥3 snaps) | `cheaper`: `Check in {D0+3 window} — save $60 · $180/night →`, affiliate deeplink, `aria-label` names date/price/saving. Primary $240 price/verdict unchanged. No overlap @375/1280. | §3.1, §5.4, §6 |
| **S2** no cheaper nearby (`nearbyDatesChecked ≥ 1`) | `none`: `Checked nearby dates — this window is already among the cheapest.` Zero price digits, no link. | §3.2, §7.1 |
| **S3** unavailable exact, fresh $160 alt (≥3 snaps) | Detail: unavailable block gains recovery link to the $160 alternate (affiliate-marked); `PriceUnavailable` aria/reason untouched. No alt ⇒ block unchanged. | §3.4 |
| **S4a** unchecked (`nearbyDatesChecked = 0`) | Card omits element; detail shows `Nearby dates not compared for this stay.` No price. | §3.3 |
| **S4b** thin alt ($150, `< 3` snaps) vs $220 | Guardrail suppresses: card omits, detail renders `none` copy. No verdict badge. Primary `confidence`/`verdict` unchanged. | §2.1, §7.2 |

---

## 9. Handoff

- **Deliverable:** this spec, `docs/pipeline/date-flex-savings/03-design.md`.
- **Next stage:** `UI-DATE-FLEX-SAVINGS-01` — implement `NearbyDateNote` (variants `card`, `detail`) per §3, wire the `nearbyDate` prop through `DealCard`, `/deals/[dealId]`, and the `HotelCard` `PriceUnavailable` recovery variant, honoring the nested-link resolution (§5.2), guardrails (§2.1), responsive rules (§6), and copy table (§4). The banded `price_snapshots` query, freshness bound, and `state`/`deeplink` resolution (with `buildOtaLinks`) belong to the data layer — if UI cannot proceed without it, UI creates `DEV-DATE-FLEX-SAVINGS-01` for the query and payload extension before wiring.
- **Open items resolved here:**
  - Band width: keep **±7 days** (research recommendation); if seed data proves too sparse, DEV may widen to ±10 without a design change (copy is date-agnostic).
  - `unchecked` on card: **omit** (decided §3.3). On detail: **shown** as one honest caption.
  - Card vs detail: **both**, but the card renders the nearby line as **non-interactive text when wrapped in the outer card link** (§5.2); the actionable, affiliate-marked link is guaranteed on detail + HotelCard.
</content>
</invoke>
