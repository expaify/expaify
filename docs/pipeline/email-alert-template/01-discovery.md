# UXD: Email Alert Template Quality — Discovery

Ticket: UXD-EMAIL-ALERT-TEMPLATE-001
Stage: UX Discovery
Date: 2026-07-19
Surfaces audited: `lib/email/templates/DealAlert.tsx`, `lib/email/templates/DailyDigest.tsx`, `lib/email/sendDealAlert.ts`, `lib/email/sendDailyDigest.ts`, `lib/email/resend.ts`, `app/api/alerts/unsubscribe/route.ts`
Prior pipeline work: `docs/pipeline/email-alerts/` built the *sending* feature (delivery, dedupe, unsubscribe). This discovery is about the *quality* of what lands in the inbox — it does not re-litigate delivery mechanics.

---

## Problem statement (one sentence)

The deal alert emails bury the information a subscriber decides on — destination and price — behind a hotel name they don't recognize, repeat the same comparison twice while giving no urgency or rarity context, and carry inbox-level defects (raw `dev@` sender, subject-duplicating preview text, no plain-text part, no List-Unsubscribe header, non-stacking two-column rows) that make the email easy to ignore in Gmail mobile and easy for Gmail to route away from the inbox entirely.

## Who is affected, and where in the flow

Premium members (trialing or active) with `alert_preference = 'instant'` or `'daily'` — i.e. **paying users at the retention step of the core loop**. The email alert is the only surface that proactively brings a subscriber back to expaify; every other surface requires them to visit. If the alert is ignored or unsubscribed, the premium value proposition ("we watch prices for you") silently stops existing for that user, and `app/api/alerts/unsubscribe/route.ts` turns it off permanently with one tap.

The failure happens at three inbox moments:
1. **Inbox list scan** (sender + subject + preview text) — decides open vs. ignore.
2. **First screenful on Gmail mobile** — decides read vs. archive.
3. **CTA tap** — decides whether the loop back into the product completes.

## Measurable signals that the problem exists

All file references are to the current worktree.

### Inbox-list layer (open decision)

- **S1 — Subject leads with an unknown hotel name.** `lib/email/sendDealAlert.ts:96` builds `` `${hotelName} — ${discountPct}% off in ${city}` ``. Gmail mobile shows roughly the first 35–40 characters; a name like "Grand Hyatt Regency Riverside" consumes the entire visible subject before the discount or city appears. The subscriber watches *cities*, not hotels (`watchlist` matches on city in `sendDealAlert.ts:54`), so the one token they'd recognize is last.
- **S2 — Preview text duplicates the subject verbatim.** `DealAlert.tsx:46` sets `<Preview>` to the same `hotelName — X% off in city` string. The preview-text slot — the second line Gmail gives us free — carries zero additional information (price, dates, rarity).
- **S3 — Digest subject is jargon and back-loaded.** `sendDailyDigest.ts:121`: `` `Your expaify deals for ${date} — ${digestDeals.length} hotel drops` ``. "Hotel drops" is internal vocabulary; the date restates the email timestamp; the only decision-relevant fact (count, best discount, which cities) is absent or last.
- **S4 — Sender renders as a bare dev address.** `resend.ts:14` defaults `FROM` to `dev@expaify.com` with no friendly display name. The inbox list shows "dev@expaify.com" as the sender — indistinguishable from automated noise.

### Body layer (read decision, Gmail mobile)

- **S5 — The comparison is stated twice in a row.** `DealAlert.tsx:87–102`: the price row shows "$96 / night ~~usually $180~~", then the very next paragraph repeats "This is $96 vs a usual $180 median for comparable dates." Two consecutive blocks, same two numbers, no added information — and "median" is statistics jargon in the digest variant (`DailyDigest.tsx:85`).
- **S6 — No urgency or rarity context anywhere.** Neither template says how long the deal is expected to last, how rare this price is, or when the price was observed — despite `expires_at` existing on deals (`sendDealAlert.ts:37`) and snapshot history existing for rarity claims. The only trust line is "Based on N price checks over 60 days" in 11px footer grey (`DealAlert.tsx:125–127`).
- **S7 — Two-column rows don't stack on mobile.** `DealAlert.tsx:71–85` and `DailyDigest.tsx:68–82` use `Row`/`Column` (rendered as table cells) to put hotel name left and discount badge right. Table cells don't stack in Gmail mobile; long hotel names squeeze against the badge at 375px, wrapping the name to 3+ lines while the badge column reserves width.
- **S8 — Digest is a wall of identical CTAs.** `DailyDigest.tsx:87–130`: up to 8 deal cards (`MAX_DIGEST_DEALS = 8`, `sendDailyDigest.ts:8`) each carry a full-width photo (~196px) plus an identical full-width coral "See the deal" button, followed by a ninth identical "See all deals" button. Nine same-weight primary CTAs is no hierarchy at all, and 8 cards × (image + button) makes the email several screens long before the footer — with real risk of crossing Gmail's ~102KB clipping threshold once inline styles are multiplied per card.
- **S9 — Images have no blocked-image fallback and empty alt.** `DealAlert.tsx:62–68`, `DailyDigest.tsx:59–65`: `alt=""` and no background color on the image slot. Gmail blocks images for senders the user hasn't interacted with; the first alert a user ever receives — the one that forms the habit — renders with a blank hole where the hotel photo should be.
- **S10 — Fragile CSS for email clients.** `border: '0.5px solid'` (`DealAlert.tsx:60`, `DailyDigest.tsx:57`) — sub-pixel borders are dropped or rounded inconsistently across clients. The full-width `Button` relies on `boxSizing: 'border-box'` with `width: '100%'` + 24px padding (`DealAlert.tsx:104–118`); where `box-sizing` is stripped, the button overflows the card horizontally at 375px.
- **S11 — Edge-case string bugs.** `stars(null)` returns `''` (`DailyDigest.tsx:31–33`), producing a meta line that begins with a dangling separator: " · Lisbon · Aug 12–19". `sendDealAlert.ts:80` papers over missing stars with a fabricated `?? 4` — a trust violation (we invent a rating). Copyright year is hardcoded "© 2026" in both footers. "Manage prefs" is abbreviated internal-speak in user-facing copy.

### Delivery/compliance layer (whether the email is seen at all)

- **S12 — No plain-text part.** `resend.emails.send` is called with `html` only (`sendDealAlert.ts:93–98`, `sendDailyDigest.ts:118–123`). Missing `text` hurts spam scoring and breaks screen-reader/watch/preview contexts.
- **S13 — No `List-Unsubscribe` / one-click unsubscribe headers.** Gmail and Yahoo have required one-click unsubscribe headers for bulk senders since Feb 2024. The templates carry only a footer link; without the headers, Gmail suppresses its native "Unsubscribe" affordance and is more likely to route the mail to spam — which defeats every template improvement above.

## Competitive reference: Going (formerly Scott's Cheap Flights)

At the interaction-pattern level, Going's alert emails do four things ours don't:

1. **Destination-led, price-anchored subject:** "Tokyo in the $600s round-trip" / "Round-trip to Paris: $487". The recognizable token (place) and the decision token (price) both land in the first ~30 characters. Our subject spends those characters on a hotel name.
2. **Preview text as a second headline**, carrying what the subject didn't: date window, rarity ("rarely under $850"), or savings.
3. **Rarity/urgency framing in the body:** "This price pops up a few times a year" and "deals like this usually last 1–2 days" — a reason to act now, stated in plain language, not a countdown gimmick.
4. **One primary CTA per email**; everything else is quiet text links. Digest-style emails rank deals with clear visual hierarchy (best deal big, rest compact) rather than repeating identical cards.

## Constraints the solution must respect

1. **Data integrity / trust:** every number shown must come from real snapshot data — no fabricated star ratings (`?? 4` must go), no "Great deal" claims on thin `snapshotCount`, consistent with the Deal Score confidence rule. Money stays `{ priceCents, currency }`; note the current `fmt()` hardcodes `$` and ignores currency.
2. **Email-client reality, Gmail mobile first:** table-based stacking-safe layout, inline styles only, ≥1px borders, no reliance on `box-sizing`, blocked-image fallbacks (alt text + background color), total HTML under Gmail's ~102KB clip. Must remain a React Email template rendered via Resend — no new template engine.
3. **Brand and accessibility:** keep the existing token palette (cream `#FAF7F2`, teal `#0E5A54`, coral `#FF6B4A`, gold `#D9A441`, Georgia/Inter type pairing) so email matches the product; body text ≥13px, meaningful alt text, and a working footer unsubscribe alongside (not instead of) `List-Unsubscribe` headers.

## Success statement

This is solved when a first-time premium subscriber, seeing an expaify alert in their Gmail mobile inbox list, can tell **where the deal is and what it costs without opening the email**, and — after opening — can reach the deal page in one tap without scrolling past redundant copy, identical buttons, or broken layout; and when nothing in the email (sender address, missing text part, missing unsubscribe headers) gives Gmail a reason to hide it.

## Out of scope for this feature (flagged for the monitor, not for downstream stages)

- `fmt()` ignores the `currency` field of the money contract (assumes USD) — a code-contract issue that extends beyond email.
- Digest send-hour logic and delivery dedupe (`sendDailyDigest.ts:41–46`) — delivery mechanics, covered by the prior `email-alerts` pipeline.

## Handoff

Next stage: `UXR-email-alert-template-01` — audit the templates against Gmail-mobile rendering behavior in detail and produce testable design directives for subject formula, preview text, card hierarchy, CTA system, and compliance headers.
