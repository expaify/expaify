# UXR: Email Alert Template Quality — Research Brief

**Ticket:** UXR-EMAIL-ALERT-TEMPLATE-01
**Date:** 2026-07-19
**Upstream:** `docs/pipeline/email-alert-template/01-discovery.md` — **file does not exist in this worktree.** The discovery problem statement was embedded in the ticket description and is used as the discovery input; this brief re-verifies every claim against source. Related prior work: `docs/pipeline/email-alerts/` (the pipeline that originally specced these templates — note its `03-design.md` itself mandated the hotel-name-first subject, so the defect originates in that spec, not in a DEV deviation).

---

## 1. Scope of audit

| File | Role |
|---|---|
| `lib/email/templates/DealAlert.tsx` | Instant alert template |
| `lib/email/templates/DailyDigest.tsx` | Daily digest template |
| `lib/email/sendDealAlert.ts` | Instant send path (subject, envelope, data mapping) |
| `lib/email/sendDailyDigest.ts` | Digest send path |
| `lib/email/resend.ts` | Sender identity (`FROM`) |
| `app/api/alerts/unsubscribe/route.ts` | Unsubscribe endpoint |
| `lib/email/__tests__/*` | Existing coverage |

Reference patterns compared: **Going (Scott's Cheap Flights)** deal alerts and **Booking.com/Hopper price-drop** emails, at the level of interaction pattern (envelope → open → scan → tap), plus Gmail mobile rendering behavior and the Gmail/Yahoo bulk-sender requirements in force since Feb 2024.

---

## 2. Current implementation — verified findings

### 2.1 Envelope (what the user sees before opening)

1. **Sender is `dev@expaify.com` with no display name.** `lib/email/resend.ts:14` — `FROM = process.env.EMAIL_FROM ?? 'dev@expaify.com'`. If `EMAIL_FROM` is unset in prod, users see a bare `dev@` address. Even when set, no code path adds a friendly display name (`Name <addr>`), so the inbox sender line is a raw address. Going sends as `Going <...>`; the sender name is the primary brand impression in the Gmail list view.
2. **Subject leads with an unrecognized entity.** `lib/email/sendDealAlert.ts:96` — `` `${deal.hotelName} — ${deal.discountPct}% off in ${deal.city}` ``. Gmail mobile shows ~35–40 subject characters; a long hotel name ("Grand Mercure Ambassador…") consumes the entire visible subject before the user learns the city or price. The user recognizes *destinations and prices*, not hotel brands — the exact analog of Going never leading a subject with an airline name.
3. **Preview text duplicates the subject verbatim.** `DealAlert.tsx:46` renders `<Preview>` with the identical string used as the subject (`sendDealAlert.ts:96`). Same in the digest: `DailyDigest.tsx:39` vs `sendDailyDigest.ts:121`. Gmail renders subject + snippet as one line pair; duplication wastes the ~90-char snippet slot that Going uses for dates + rarity ("Usually $950+. Travel Sep–Nov.").
4. **Digest subject uses insider jargon.** `sendDailyDigest.ts:121` — "…— 3 hotel drops". "Drops" is deal-hunter slang; Booking/Hopper say "Prices dropped for {city}".

### 2.2 Deliverability & compliance

5. **No `List-Unsubscribe` / `List-Unsubscribe-Post` headers.** Both send calls (`sendDealAlert.ts:93-98`, `sendDailyDigest.ts:118-123`) pass only `from/to/subject/html`. Gmail's bulk-sender rules require RFC 8058 one-click unsubscribe; without the header there is no "Unsubscribe" chip next to the sender in Gmail, so annoyed users hit **Report spam** instead — directly damaging domain reputation.
6. **The unsubscribe endpoint cannot support one-click.** `app/api/alerts/unsubscribe/route.ts:43` exports **GET only**. RFC 8058 requires a POST that unsubscribes with no interstitial. A `List-Unsubscribe-Post` header pointing at a GET-only route would silently fail.
7. **No plain-text part.** Only `html` is sent. Missing `text` hurts spam scoring, breaks watch/assistant surfaces, and text-only fallback clients render nothing useful.
8. **Gmail clipping budget unmanaged.** Gmail clips HTML over ~102KB ("[Message clipped]"), which hides the footer unsubscribe links. Eight digest cards with inline styles are likely under budget today, but nothing enforces it; the digest design must carry an explicit size budget.

### 2.3 Card hierarchy (after open)

9. **Hotel name is the H2; destination is buried.** `DealAlert.tsx:73-78` — `{hotelName}` is the 18px Georgia heading; the city sits in a 13px muted metadata row (`★★★★ · {city} · {checkInWindow}`). The decision-driving facts (where, when, how much) are typographically subordinate to the fact the user can't evaluate (a hotel brand they don't know).
10. **The price comparison is stated twice, and rarity/urgency zero times.** `DealAlert.tsx:90-96` shows `$126 /night ~~usually $210~~`, then `DealAlert.tsx:100-102` repeats "This is $126 vs a usual $210 median for comparable dates." Same numbers, two renderings, no new information. Meanwhile `snapshotCount` — real evidence that could power a rarity claim ("lowest of 38 checks in 60 days") — is relegated to 11px footer fine print (`DealAlert.tsx:125-127`). Going's anatomy is: price once, then *rarity* ("cheapest we've seen in 3 months"), then *scarcity honesty* ("deals like this usually last 1–3 days").
11. **Fabricated star rating.** `sendDealAlert.ts:80` — `stars: deal.stars ?? 4`. When the provider has no rating, the email asserts ★★★★. This violates the app's own trust posture (see `docs/audits/2026-07-01-audit-hotel-rating-source-confidence-01.md` lineage) and is a factual claim we cannot back.
12. **Orphan separator at zero stars.** `DealAlert.tsx:25-27` + `77`: `stars(0)` → empty string → metadata line renders "` · Paris · Oct 12–18`" with a leading dot. Digest has the same bug (`DailyDigest.tsx:31-33`, `74`).

### 2.4 Layout on Gmail mobile

13. **Two-column `Row`/`Column` header does not stack.** `DealAlert.tsx:71-85` and `DailyDigest.tsx:68-82` put hotel name and the `−41%` badge in table columns. React Email renders these as `<table><td>`; Gmail mobile does not reflow table cells, and Gmail (non-Gmail-account IMAP variants) strips `<style>` media queries. At 375px a long hotel name is squeezed into a narrow column beside the badge, wrapping to 3–4 lines. Layout must be single-column-safe *without* media queries.
14. **Blocked-image rendering is an empty hole.** `DealAlert.tsx:62-68`, `DailyDigest.tsx:58-66`: hero `Img` has `alt=""`, no background color, no fallback. With images off (corporate Outlook, Gmail "ask before displaying") the top of the email is a blank 216px block conveying nothing.

### 2.5 CTA system

15. **Nine visually identical CTAs in the digest.** Up to 8 cards each render an identical full-width coral pill "See the deal" (`DailyDigest.tsx:87-104`) plus a ninth identical pill "See all deals" (`DailyDigest.tsx:112-130`). Consequences: (a) no visual hierarchy — the #1 deal (already sorted `ORDER BY discount_pct DESC`, `sendDailyDigest.ts:85`) gets the same weight as #8; (b) screen-reader link lists announce eight indistinguishable "See the deal" links (WCAG 2.4.4 failure in spirit); (c) coral saturation destroys the button's meaning as "the" action.
16. **Instant-alert CTA is generic.** "See the deal" (`DealAlert.tsx:120`) names neither the destination nor the price it leads to.

### 2.6 Existing test coverage (for downstream stages)

`lib/email/__tests__/sendDealAlert.test.ts` and `sendDailyDigest.test.ts` assert SQL shape and delivery bookkeeping only. **No test pins subject strings, preview text, headers, or the text part** — subject/envelope changes will not break existing tests, and new tests are needed to lock the directives below.

---

## 3. Gap analysis vs reference patterns

| Dimension | Current (expaify) | Reference (Going / Booking price-drop) | Delta |
|---|---|---|---|
| Sender line | bare `dev@expaify.com` fallback, no display name | `Going <hello@…>` — brand name carries the list view | Add display name + real alerts address; forbid dev@ fallback |
| Subject | `{hotelName} — {pct}% off in {city}` | Destination + price first: "Paris in the $500s", "Prices dropped for your Tokyo trip" | Invert: city + price + discount first; hotel name out of subject |
| Preview | duplicates subject | Complements subject: dates, "usually" price, rarity | New string carrying hotel + window + rarity |
| Open hierarchy | Hotel name H2 → metadata → price ×2 | Destination hero → price once → rarity → urgency → dates → one CTA | Re-rank: city first; one comparison; rarity line from `snapshotCount` |
| Urgency/rarity | none (data exists, unused) | "Cheapest since March", "usually lasts 1–3 days" | Surface data-backed rarity; no fabricated countdowns |
| CTA | 9 identical coral pills (digest) | One primary CTA; secondary deals get lighter links naming the destination | 1 solid button per email; text links elsewhere; unique accessible names |
| Mobile | non-stacking Row/Column | bulletproof single column | Remove two-column table layout from cards |
| Compliance | no List-Unsubscribe, no text part, GET-only unsub | RFC 8058 one-click + multipart | Headers + POST handler + plain-text render |

---

## 4. Design directives (testable)

Every directive below is verifiable by a Jest render/unit test or a fixed-width screenshot. "MUST NOT fabricate" rules apply to all copy: no invented star ratings, no countdown timers, no "selling fast".

### D1 — Subject and preview formula (both templates)

- **Instant subject:** `{City} {stars}-star hotel {fmt(deal)}/night — {discountPct}% off` when stars exist; `{City} hotel {fmt(deal)}/night — {discountPct}% off` when null. City and price MUST appear within the first 40 characters. Max 65 chars before truncating hotel-independent content; the hotel name MUST NOT appear in the subject.
- **Instant preview:** MUST NOT equal the subject and MUST NOT share its first 30 characters with it. Formula: `{hotelName}, {checkInWindow}. Usually {fmt(median)} — lowest of {snapshotCount} checks in 60 days.` Target 70–90 chars.
- **Digest subject:** `{n} hotel deal{s}: {topCity} from {fmt(topDealPrice)}/night` where top = first row of the existing `discount_pct DESC` sort. The word "drops" MUST NOT appear.
- **Digest preview:** remaining cities joined: `Also {city2}, {city3} + {n−3} more. All below their usual price.`
- **Tests:** pure subject/preview builder functions exported and unit-tested for: city-before-price ordering, no hotelName in subject, preview ≠ subject, null-stars branch.

### D2 — Sender identity, compliance headers, plain-text part

- `FROM` MUST render as `expaify deals <alerts@expaify.com>` (display name + non-dev address). The code fallback MUST NOT be `dev@expaify.com`; if `EMAIL_FROM` is unset, fall back to `expaify deals <alerts@expaify.com>`.
- Every alert/digest send MUST include headers: `List-Unsubscribe: <{unsubscribeUrl}>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (Resend `headers` option).
- `app/api/alerts/unsubscribe/route.ts` MUST add a `POST` handler that unsubscribes by token and returns 200 with no confirmation page (RFC 8058); GET keeps the human-facing confirmation.
- Every send MUST include a `text` part (React Email `render(..., { plainText: true })`) containing, in order: city, price vs usual, check-in window, deal URL, unsubscribe URL.
- **Tests:** send-path unit tests assert `headers`, `text`, and `from` display name in the Resend payload; route test asserts POST 200 + unsubscribe side effect.

### D3 — Card hierarchy: destination first, one comparison, data-backed rarity

- Heading of the deal card MUST be `{city}` (+ check-in window adjacent). Hotel name + stars demote to the secondary line. Reading order at a glance: **where → when → price → evidence → CTA**.
- The median comparison MUST appear exactly once. Keep the price row (`{fmt(deal)}/night` large, `usually {fmt(median)}` struck-through beside it); delete the duplicate sentence (`DealAlert.tsx:100-102`).
- Replace it with a rarity line derived from real data: `Lowest price we've seen in {snapshotCount} checks over 60 days.` plus honesty framing `Prices like this usually don't last long.` — no fabricated deadlines, no counters.
- Stars: when `stars` is null the send path MUST pass null through (remove `?? 4` at `sendDealAlert.ts:80`) and the template MUST omit the star glyphs *and* their separator (fixes the leading "· " orphan). The email may never claim a rating the data doesn't contain.
- **Tests:** render test asserts city string index < hotelName string index in output HTML; exactly one occurrence of the median-formatted string per card; no `★` and no leading `·` when stars is null.

### D4 — Single-column, media-query-free mobile layout

- Card content MUST be a single column: badge (`−41%`) moves inline into the price row or above the heading — no `Row`/`Column` pairs placing text beside text in card bodies. Layout MUST be correct with media queries stripped (Gmail IMAP case).
- Minimum body font 13px; CTA tap target ≥ 44px tall; container stays ≤ 540px with ≥ 20px side padding at 375px.
- **Tests:** rendered card HTML contains no `<tr>` with two content-bearing `<td>` cells; screenshot check at 375px and 1280px shows no squeezed/wrapped-beside-badge headings.

### D5 — CTA system and blocked-image fallback

- **One solid coral button per email.** Instant: single CTA labeled `See this {city} deal`. Digest: only the top deal gets the solid coral button (`See the {topCity} deal`); deals 2–n use a compact text-link CTA `View {city} deal →`; the footer "See all deals" becomes a secondary (outline/text) style.
- Every link's accessible name MUST be unique within the email (city-qualified), for screen-reader link lists.
- **Blocked-image fallback:** every `Img` MUST have `alt="{hotelName}, {city}"` and a container `backgroundColor` token (`#E8E2D8`) so the blocked state shows a labeled placeholder, not a hole. The email MUST convey city, price, dates, and CTA with images fully blocked.
- Digest HTML MUST stay under 90KB rendered (buffer below Gmail's ~102KB clip) — enforce with a render-size unit test at 8 deals with realistic string lengths.
- **Tests:** digest render contains exactly one solid-coral `<a>` button style; no duplicate accessible link names; all `img` tags have non-empty `alt`; `Buffer.byteLength(html) < 90 * 1024`.

---

## 5. Out-of-scope findings (report only, not directives)

- `sendDealAlert.ts:80` star fabrication is also a data-integrity defect on the DEV side (covered by D3 but the fix touches the send path, not just the template — route to DEV, not UI-only).
- Existing tests never pin subject/preview/header strings; D1/D2 tests are net-new coverage the DEV stage must add.
- The prior `docs/pipeline/email-alerts/03-design.md` spec mandates the hotel-first subject and the per-card "Book now" CTAs; the UXDES stage should explicitly supersede that section to avoid two live specs disagreeing.

## 6. Downstream routing

D3 (send-path star passthrough), D2 (headers, text part, POST route) require logic changes → this feature needs a **DEV stage after UI**. D1/D4/D5 are template + copy work.
