# UXDES: Email Alert Template Overhaul — Design Spec

**Ticket:** UXDES-EMAIL-ALERT-TEMPLATE-01
**Date:** 2026-07-19
**Upstream:** `docs/pipeline/email-alert-template/02-research.md` (directives D1–D5)
**Surfaces:** `lib/email/templates/DealAlert.tsx`, `lib/email/templates/DailyDigest.tsx`, plus send-path/compliance changes routed to DEV (`lib/email/sendDealAlert.ts`, `lib/email/sendDailyDigest.ts`, `lib/email/resend.ts`, `app/api/alerts/unsubscribe/route.ts`).

> **SUPERSESSION NOTICE.** This spec supersedes the **"Subject lines"** section and all **CTA specifications** (per-card "Book now →", coral "See all deals") of `docs/pipeline/email-alerts/03-design.md`. Where the two documents disagree on subject, preview, sender, CTA count, CTA labels, or card hierarchy, **this document wins**. The color palette and rate-limiting sections of the old spec remain valid.

---

## 0. Design principles for this surface

1. **The envelope is the product.** Most recipients decide from the sender name + subject + snippet in the Gmail list view. Every envelope string is specced as an exact, testable formula.
2. **Destination first.** Users recognize cities and prices, not hotel brands. City leads the subject and the card heading; hotel name is supporting evidence.
3. **Every claim is data-backed.** No fabricated stars, no countdown timers, no "selling fast". Rarity copy is derived from `snapshotCount` and degrades honestly when history is thin (< 10 checks — mirrors the Deal Score confidence rule).
4. **One email, one solid button.** Everything else is a text link with a unique accessible name.
5. **Bulletproof at 375px with media queries stripped and images blocked.** Single column only; no table cell places text beside text.

---

## 1. Copy system — envelope strings (D1)

All four strings are built by **pure exported functions** (new file `lib/email/copy.ts`, DEV stage) so they can be unit-tested and shared by send paths and plain-text parts. `fmt(cents)` is the existing whole-dollar formatter: `$${Math.round(cents / 100)}`.

### 1.1 Instant alert — subject

| Condition | Exact string |
|---|---|
| `stars` is a number ≥ 1 | `{city} {stars}-star hotel {fmt(dealPriceCents)}/night — {discountPct}% off` |
| `stars` is `null` (or 0) | `{city} hotel {fmt(dealPriceCents)}/night — {discountPct}% off` |
| Result exceeds 65 chars (long city) | Drop the `{stars}-star ` qualifier (use the null-stars form). Never truncate the city. |

Examples:
- `Paris 4-star hotel $126/night — 41% off` (39 chars)
- `Mexico City hotel $89/night — 44% off` (null-stars branch)

Rules (testable): city appears at index 0; the `$` price appears within the first 40 characters for any city ≤ 24 chars; `hotelName` never appears in the subject; no emoji.

### 1.2 Instant alert — preview text

| Condition | Exact string |
|---|---|
| `snapshotCount` ≥ 10 | `{hotelName}, {checkInWindow}. Usually {fmt(medianPriceCents)} — lowest of {snapshotCount} checks in 60 days.` |
| `snapshotCount` < 10 | `{hotelName}, {checkInWindow}. Usually {fmt(medianPriceCents)} for these dates.` |

Example: `Hôtel Saint-Marc, Oct 12–18. Usually $210 — lowest of 38 checks in 60 days.` (76 chars; target band 70–90).

Rules: preview ≠ subject; preview's first 30 chars never match the subject's first 30 chars (guaranteed structurally: subject starts with city, preview starts with hotel name).

### 1.3 Daily digest — subject

`top` = first deal of the existing `ORDER BY discount_pct DESC, first_seen DESC` sort. `n` = deal count (1–8).

| Condition | Exact string |
|---|---|
| n = 1 | `1 hotel deal: {topCity} from {fmt(topDealPriceCents)}/night` |
| n ≥ 2 | `{n} hotel deals: {topCity} from {fmt(topDealPriceCents)}/night` |

Example: `5 hotel deals: Paris from $126/night`. The word **"drops" must not appear** anywhere in the subject.

### 1.4 Daily digest — preview text

Let `R` = distinct cities of deals 2..n in sort order, deduped, excluding `topCity`.

| Condition | Exact string |
|---|---|
| n = 1 | `{topHotelName}, {topCheckInWindow}. Usually {fmt(topMedianPriceCents)}/night.` |
| n ≥ 2, `R` empty (all one city) | `Every deal is below its usual price for these dates.` |
| `R = [a]` | `Also {a}. All below their usual price.` |
| `R = [a, b]` | `Also {a} and {b}. All below their usual price.` |
| `R.length ≥ 3` | `Also {a}, {b} + {R.length − 2} more. All below their usual price.` |

Example: `Also Lisbon, Marrakech + 2 more. All below their usual price.`

---

## 2. Sender identity, compliance, plain-text (D2 — routed to DEV)

### 2.1 From line

`lib/email/resend.ts` `FROM` must resolve to **`expaify deals <alerts@expaify.com>`**:

- If `EMAIL_FROM` is set and already contains `<` → use verbatim.
- If `EMAIL_FROM` is set as a bare address → wrap: `expaify deals <{EMAIL_FROM}>`.
- If `EMAIL_FROM` is unset → fall back to `expaify deals <alerts@expaify.com>`. The string `dev@expaify.com` must not appear in the code.

### 2.2 Compliance headers

Every alert and digest send includes (Resend `headers` option, per-recipient because the token is per-recipient):

```
List-Unsubscribe: <{unsubscribeUrl}>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

### 2.3 One-click unsubscribe endpoint

`app/api/alerts/unsubscribe/route.ts` adds a **POST** handler (GET keeps the existing human-facing confirmation page unchanged):

- Reads `token` from the query string (mail providers POST to the exact URL in the header with body `List-Unsubscribe=One-Click`).
- Malformed token (fails the existing UUID regex) → `400`, empty body.
- Well-formed token → run the same `UPDATE subscriptions SET alert_preference = 'off'` and return **`200` with no body and no HTML interstitial**, including when the token matches no row (idempotent — providers may retry; a 404 here invites re-delivery loops).

### 2.4 Plain-text part

Every send includes a `text` part generated with `render(<Template/>, { plainText: true })`. Because plain text is derived from template DOM order, the template order in §3/§4 guarantees the required content sequence. Testable ordering (string index comparison on the text part): **city < deal price < dealUrl < unsubscribeUrl**, and `checkInWindow` present.

---

## 3. DealAlert.tsx — instant alert template

### 3.1 Structure (single column, top to bottom)

```
expaify.                                  ← logo, Georgia 20px, teal + coral dot (unchanged)

We found a deal for you                   ← eyebrow, 13px #5C5852

┌────────────────────────────────────────┐
│ [photo 540×216, bg #E8E2D8,            │  ← blocked-image fallback: labeled placeholder
│  alt "{hotelName}, {city}"]            │
│                                        │
│  ( −41% )                              │  ← gold chip, own line
│  Paris · Oct 12–18                     │  ← H2: city 20px Georgia bold + window inline
│  Hôtel Saint-Marc · ★★★★               │  ← secondary line, 13px; stars omitted when null
│                                        │
│  $126 /night  usually $210             │  ← price row, single occurrence of median
│  Lowest price we've seen in 38 checks  │  ← rarity line (data-backed, branches below)
│  over 60 days. Prices like this        │
│  usually don't last long.              │
│                                        │
│  [      See this Paris deal      ]     │  ← the ONE solid coral button
└────────────────────────────────────────┘

expaify never adds fees.                  ← trust line, 13px
You get instant alerts when a hotel price drops well below its usual rate.
────────────────────────────────────────
Manage alerts · Unsubscribe · expaify.com · © 2026 expaify
```

### 3.2 Element spec

Email clients don't support CSS variables or (reliably) `<style>` blocks, so all styles are inline. Token mapping: `--bg-base` → `#FAF7F2`, `--brand` (teal) → `#0E5A54`, coral accent → `#FF6B4A`, `--text-1` → `#141210`, `--text-2` → `#5C5852`, hairline → `#E8E2D8`, chip → `#D9A441` on `#412402`.

| Element | Spec |
|---|---|
| Container | `maxWidth: 540px`, `padding: 32px 20px`, bg `#FAF7F2` — unchanged; yields ≥ 20px side padding at 375px |
| Card | white, `borderRadius: 16px`, `border: 0.5px solid #E8E2D8`, inner padding `20px` — unchanged shell |
| Photo | `Img` 540×216, `alt="{hotelName}, {city}"`, wrapper `Section` with `backgroundColor: '#E8E2D8'` **and** `bgcolor="#E8E2D8"` attribute; `Img` style adds `color: '#5C5852', fontSize: '13px'` so blocked-image alt text is readable on the placeholder. When `photoUrl` is null render nothing (no empty box). |
| Discount chip | Own line above the heading: `inline-block`, bg `#D9A441`, text `#412402`, 700, 14px, `padding: 4px 10px`, radius 999, `margin: 0 0 10px`. Copy: `−{discountPct}%`. **No `Row`/`Column`** — chip is no longer beside the heading. |
| H2 heading | `{city}` — Georgia serif, 20px, 700, `#141210`, then inline span ` · {checkInWindow}` at 14px, 400, `#5C5852`. One `Heading as="h2"`, wraps naturally at 375px. |
| Secondary line | `{hotelName}` 13px `#5C5852`; if `stars ≥ 1` append ` · {'★'.repeat(stars)}`. If `stars` is null/0: hotel name only — **no glyphs, no separator** (kills the leading-dot orphan). |
| Price row | Exactly one median comparison in the whole email: `{fmt(dealPriceCents)}` 28px 700 `#0E5A54` + ` /night` 13px `#5C5852` + `  usually {fmt(medianPriceCents)}` 14px `#5C5852` `line-through`. The old duplicate sentence ("This is $X vs a usual $Y median…") is **deleted**. |
| Rarity line | 13px `#5C5852`, `lineHeight: 20px`. `snapshotCount ≥ 10`: `Lowest price we've seen in {snapshotCount} checks over 60 days. Prices like this usually don't last long.` — `snapshotCount < 10`: `Based on {snapshotCount} price checks over 60 days — limited history for these dates.` (no urgency sentence on thin data). |
| CTA | Single solid button: bg `#FF6B4A`, white, 15px, 600, `padding: 14px 24px` (≥ 48px tall), radius 999, full width, `display: block`. Label: **`See this {city} deal`**. Accessible name = visible label (unique — it's the only button). |
| Trust footer | 13px `#5C5852`: line 1 `expaify never adds fees.` line 2 `You get instant alerts when a hotel price drops well below its usual rate.` (The old `Based on {snapshotCount} price checks…` fine print moves up into the rarity line.) |
| Compliance footer | 13px `#5C5852` links: `Manage alerts` → `manageUrl`, `Unsubscribe` → `unsubscribeUrl`, `expaify.com`, `· © 2026 expaify`. (11px `#8A857D` fails both the 13px minimum and 4.5:1 contrast — bump size and color.) |

### 3.3 Props change

`DealAlertProps.stars` becomes `number | null`. Send path stops fabricating: **remove `?? 4` at `sendDealAlert.ts:80`** and pass `deal.stars` through (DEV). The template may never claim a rating the data doesn't contain.

---

## 4. DailyDigest.tsx — digest template

### 4.1 Structure

```
expaify.

Your deals for July 19                    ← H1, unchanged
5 hotel prices dropped today              ← subline, unchanged (singular: "1 hotel price dropped today")

┌─ CARD 1 (top deal — the only solid button) ─┐
│ [photo, bg #E8E2D8, alt "{hotelName}, {city}"]
│  ( −41% )
│  Paris · Oct 12–18                      ← H2 17px Georgia + window inline 13px
│  Hôtel Saint-Marc · ★★★★
│  $126 /night  usually $210
│  Lowest of 38 checks in 60 days.
│  [       See the Paris deal       ]     ← solid coral, top deal only
└─────────────────────────────────────────┘
┌─ CARDS 2..n (text-link CTA) ────────────┐
│ [photo …]
│  ( −38% )
│  Lisbon · Nov 3–9
│  Casa do Bairro · ★★★
│  $94 /night  usually $150
│  Lowest of 22 checks in 60 days.
│  View Lisbon deal →                     ← teal text link, 600, 14px
└─────────────────────────────────────────┘

[        See all deals        ]           ← secondary: white bg, 1px teal border, teal text

────────────────────────────────────────
Manage alerts · Unsubscribe · expaify.com · © 2026 expaify
```

### 4.2 Card spec (applies to every card)

Same single-column anatomy as §3.2 with digest scale: H2 17px, price 22px, chip 13px, card padding `16px 18px`, `marginBottom: 12px`. The `Row`/`Column` name-beside-badge layout is **removed** — chip on its own line above the heading. Evidence line per card, 12px→13px `#5C5852`: `snapshotCount ≥ 10` → `Lowest of {snapshotCount} checks in 60 days.`; `< 10` → `{snapshotCount} price checks — limited history.`

### 4.3 CTA hierarchy (D5) — exactly one solid button per email

| Slot | Style | Visible label | Accessible name (`aria-label`) |
|---|---|---|---|
| Card 1 (top deal) | Solid coral button (same spec as §3.2 CTA) | `See the {topCity} deal` | `See the {topCity} deal — {topHotelName}` |
| Cards 2..n | Text link: `#0E5A54`, 600, 14px, no underline, `padding: 12px 0` block (≥ 44px tap target incl. line height) | `View {city} deal →` | `View {city} deal — {hotelName}` |
| Footer | Secondary button: `backgroundColor: '#FFFFFF'`, `border: '1px solid #0E5A54'`, text `#0E5A54`, 600, 14px, `padding: 13px 24px`, radius 999, full width | `See all deals` | `See all deals on expaify` |

`aria-label` always includes the hotel name so accessible names stay unique even when two deals share a city; WCAG 2.5.3 holds because the visible label is a prefix of the accessible name. Exactly **one** element in the rendered HTML carries the solid-coral background.

### 4.4 Size budget

Digest HTML must stay **< 90KB** rendered at 8 deals with realistic string lengths (buffer under Gmail's ~102KB clip, which would hide the unsubscribe footer). `MAX_DIGEST_DEALS = 8` stands. Enforced by a render-size unit test (`Buffer.byteLength(html) < 90 * 1024`), not by trimming content at send time.

---

## 5. States and edge cases

| State | Behavior |
|---|---|
| Default (desktop ~1280px client) | Container caps at 540px centered; all content identical to mobile — one design, no breakpoints. |
| Mobile 375px (Gmail app) | Single column throughout; no media queries required or used; no `<tr>` with two content-bearing `<td>`s; ≥ 20px side padding; all tap targets ≥ 44px. |
| Images blocked | Photo area renders as `#E8E2D8` block with readable alt `{hotelName}, {city}`; city, price, dates, and CTA all remain visible (they are HTML text, not images). |
| `photoUrl` null | No image block at all — card starts at the chip. |
| `stars` null or 0 | No star glyphs, no ` · ` separator, subject uses the null-stars formula (§1.1). Never default to 4. |
| `snapshotCount` < 10 | Thin-history copy branches (§1.2, §3.2, §4.2); no "lowest" claim, no urgency sentence. |
| Digest n = 1 | Subject `1 hotel deal: …`, preview = top-deal detail (§1.4), one card with the solid button, then secondary `See all deals`. |
| Digest n = 0 | Send path already skips the recipient (`sendDailyDigest.ts:104`) — the empty state is **no email**. Template never renders `deals: []`; UI stage need not design an empty body. |
| All digest deals in one city | Preview: `Every deal is below its usual price for these dates.`; link names stay unique via hotel-qualified `aria-label`. |
| Long hotel name (e.g. "Grand Mercure Ambassador Hotel and Residences") | Never in the subject; wraps freely on its own 13px line — nothing sits beside it. |
| Long city subject overflow | > 65 chars → drop star qualifier (§1.1); city itself never truncated. |
| Plain-text-only client / assistant surface | `text` part (§2.4) carries city, price vs usual, window, links in order. |
| Keyboard / screen reader | Reading order = source order = visual order (where → when → price → evidence → CTA). Every link has a unique accessible name; alt text non-empty on all images. |

---

## 6. Interaction rules

- **Tap/Enter on any deal CTA** → deal page `{BASE_URL}/deals/{id}` (existing URLs; affiliate handling stays on the deal page — emails link only to expaify).
- **Gmail "Unsubscribe" chip / one-click** → provider POSTs to `unsubscribeUrl` → silent 200, alerts off (§2.3).
- **Footer "Unsubscribe" click (human)** → existing GET confirmation page, unchanged.
- **"Manage alerts"** → `/account`.
- No retry/error states exist inside an email; failure handling stays in the send loop (already catch-per-recipient).

---

## 7. Verification checklist (for TEST stage)

1. Subject builders: city-first ordering, price within 40 chars, no `hotelName`, no "drops", null-stars branch, 65-char fallback.
2. Preview ≠ subject; first-30-chars disjoint; thin-history branch.
3. Resend payload: `from` = `expaify deals <alerts@expaify.com>` (no `dev@` anywhere), `headers` include both List-Unsubscribe headers, `text` present with city < price < dealUrl < unsubscribeUrl ordering.
4. POST unsubscribe: 200 + `alert_preference = 'off'`; malformed token 400; unknown token 200 idempotent; GET page unchanged.
5. Render: city string index < hotelName index; exactly one occurrence of the median string per card; no `★` and no leading `·` when stars null; no two-content-cell `<tr>`; exactly one solid-coral button per email; unique accessible link names; all `img` have non-empty `alt`; digest at 8 deals < 90KB.
6. Screenshots at 375px and 1280px: no squeezed headings, chip above heading, single column.

---

## 8. Downstream routing

- **UI-EMAIL-ALERT-TEMPLATE-01 (next):** template-only work — §3 and §4 (DealAlert.tsx, DailyDigest.tsx): hierarchy, chip relocation, single column, null-stars rendering, rarity/evidence lines, CTA system, alt+bgcolor fallback, footer copy. `stars` prop widens to `number | null` (template side). No send-path edits.
- **DEV-EMAIL-ALERT-TEMPLATE-01 (after UI):** §1 copy builders (`lib/email/copy.ts`) wired into both send paths; §2 FROM identity, headers, plain-text part; POST unsubscribe route; remove `?? 4` star fabrication; new tests per §7 items 1–4 plus render-size test.
- **Note to DEV:** the "Lowest price we've seen" claim assumes deal detection selects at-or-below the tracked minimum. If the pipeline cannot guarantee that for a given deal, use the thin-history copy branch for that send rather than shipping an unbacked superlative.
