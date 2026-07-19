# UXD-DEAL-DETAIL-BOOKING-001: Deal Detail Page — Booking CTA, Price History, and Deal Score Trust

**Stage:** UX Discovery (UXD)
**Date:** 2026-07-19
**Surface:** `app/deals/[dealId]/page.tsx` and its conversion-critical children:
`app/components/ui/CompareRow.tsx` (booking CTA), `app/components/ui/PriceSparkline.tsx` + `app/components/ui/TrustLine.tsx` (price history), `app/components/DealScorePanel.tsx` + `app/components/DealBadge.tsx` (deal score), `lib/pipeline/otaLinks.ts` (outbound deeplinks).

> Note: `docs/pipeline/deal-detail-continuity/` audited an earlier implementation of this page (`lib/deals/dealDetail.ts`). The page has since been rebuilt on `lib/pipeline/dealDetection.ts`; this report reflects the current code only.

---

## Problem statement (one sentence)

On the deal detail page — the single screen where intent converts to a booking click — no visually primary booking action exists, the outbound links land users on provider *search* pages instead of the promised hotel and rate, and the page states the "usual price" from two different data sources over two different windows, so a user who is ready to book either can't find the one obvious next step or stops trusting the number that made the deal compelling.

## Who is affected, and where in the flow

- **Who:** Premium members and free users viewing a weekly-unlocked deal — i.e. the highest-intent users in the product. They have already clicked a deal card; this page is the last expaify surface before the affiliate handoff.
- **Flow step:** Deal inspection → booking handoff. The page is the terminal conversion point: every outbound click here is affiliate revenue, and every abandonment here wastes the entire upstream funnel (feed → card → detail).
- **Secondary:** expaify itself — outbound links are built without affiliate markers whenever the corresponding env var is unset, so conversions that do happen can be unattributed.

## What the current implementation does (verified in source)

### 1. Booking CTA — no primary action

- The "primary action zone" (`page.tsx:333-339`) renders `CompareRow size="primary"`: **four equal-weight buttons** (Expedia, Booking, Kiwi, Trip.com) styled as outlined surface-colored chips (`border-[1.5px] border-[color:var(--line-white)] bg-[color:var(--surface)]`), introduced by an 11px faint-ink label "Compare and book on:". Nothing on the booking path uses the design system's conversion button. The paywall's "Unlock with Premium" (`page.tsx:103`, `btn btn-conversion`) is visually stronger than any booking action a paying member ever sees.
- Providers without a link render as **disabled 40%-opacity spans in the primary action zone** (`CompareRow.tsx:47-54`) — up to four dead buttons where the booking action should be.
- The CTA zone appears **once**, between the price block and the price history. On a 375px viewport it sits at/below the first fold, and the page then continues through price history, deal score, "Why this is a deal", and "Stay details" — **ending with no booking action and no way back to one except scrolling up**. There is no sticky or repeated CTA.

### 2. Outbound deeplinks — search pages, not the deal

- `buildOtaLinks` (`lib/pipeline/otaLinks.ts:14-44`) builds **search-results URLs** keyed on `"{hotelName} {city}"` with check-in/out dates — not property or rate deep links. The user who clicks "Booking" lands on a Booking.com results list and must re-find the hotel; the promised nightly rate is not guaranteed to appear.
- The Kiwi link searches `city/city` (origin = destination) with `accommodation=true` — a shape of URL that may not land anywhere meaningful.
- Affiliate markers are appended **only if env vars are set** (`EXPEDIA_AFFILIATE_ID`, `BOOKING_AFFILIATE_ID`, `KIWI_AFFILIATE_ID`, `TP_AFFILIATE_MARKER`); `addAffiliate` silently omits the marker otherwise. The non-negotiable contract requires affiliate markers on all outbound deeplinks.
- Mock deals (`lib/pipeline/mock.ts:70-75`) ship `kiwi: 'https://www.kiwi.com'` and `trip: 'https://www.trip.com'` — bare homepages with no dates, no hotel, no marker.
- What works: links use `rel="noopener noreferrer sponsored"`, open in a new tab, and are captioned "Opens the provider site. Prices and availability can change." Expired deals correctly replace the CTA with "Search current deals"; a "Provider link unavailable" state exists when `ota_links` is empty.

### 3. Price history — chart present but hard to trust or read

- Density handling exists: `< 3` points → TrustLine only ("Early deal — tracked N times so far…"); `≥ 3` → sparkline + TrustLine (`page.tsx:127-149`). A skeleton streams while loading. This is the healthiest of the three elements.
- The sparkline (`PriceSparkline.tsx`) has **no price axis** — only start/end dates. A user cannot read what the peaks or troughs cost; the chart shows shape without magnitude.
- The gold "deal price" dot is anchored to the **history point whose price is closest to the deal price** (`PriceSparkline.tsx:41-44`), not to today. The dot can land on an arbitrary mid-chart date, visually implying the deal was found weeks ago.
- `preserveAspectRatio="none"` distorts the drawing at 375px, and the whole SVG is `aria-hidden` with no text alternative describing the trend (the TrustLine states only the snapshot count).

### 4. Deal score — self-contradicting evidence

- **Two "usual price" sources on one screen.** The hero `PriceBlock` ("usually $X") and the "Why this is a deal" card use `deal.median_price_cents` from the deals row; the `DealScorePanel`'s "Usual" fact uses `score.medianCents` computed live from 60-day snapshot history (`page.tsx:162-197`). These can disagree — the two most trust-critical numbers on the page can contradict each other.
- **Two windows claimed.** The page heading says "60-day price history", the TrustLine says "over 60 days", the "Why this is a deal" card says "snapshots over 60 days" — but the Deal Score panel hardcodes "Window: Last 90 days" (`DealScorePanel.tsx:85`) while being fed the same 60-day history.
- The score section streams in with `<Suspense fallback={null}>` (`page.tsx:355-357`) — no skeleton, so the page reflows when it arrives, and if scoring fails the section silently vanishes rather than showing the "Unavailable" state the panel supports.
- What works: low-confidence handling is honest ("Limited history" badge, percentile suppressed, verdict capped at Typical per `lib/scoring/scoreDeal.ts:113-125`), and the panel carries a plain-language explanation.
- Minor: the market lookup + history query run twice (once in `PriceHistorySection`, once in `DealScoreSection`) — a latency cost on the page's slowest-streaming trust elements.

### 5. Mobile (375px)

- CompareRow collapses to a 2×2 grid below 480px — still four equal choices, still no hierarchy.
- No sticky CTA; after the first scroll there is no booking affordance anywhere on screen.
- Everything else holds up: 44px+ touch targets on nav/CTA links, 52px CTA buttons, 2-column stay-details grid, hero at 220px.

## Reference comparison: Booking.com deal/property pages (interaction pattern level)

| Pattern | Booking.com | expaify deal detail |
|---|---|---|
| Primary action | One dominant, high-contrast CTA ("See availability" / "Reserve"), visually unmistakable | Four equal outlined chips under a faint 11px label |
| CTA repetition | Repeated top and bottom; sticky price+CTA bar on mobile | Appears once, mid-page; page ends CTA-less |
| Link destination | Property page with dates and rate pre-filled — the price you saw is the price you land on | Provider *search results* for "hotel name + city"; user must re-find the hotel |
| Price evidence | One consistent price narrative per screen | "Usual price" from two sources; 60-day vs 90-day window claims on one screen |
| Unavailable options | Hidden | Rendered as disabled 40%-opacity buttons in the primary zone |

## Measurable signals that the problem exists

1. **Zero elements on the booking path use the conversion button style** — `grep btn-conversion app/deals/[dealId]/page.tsx` matches only the paywall lock screen.
2. **CTA absence below the fold:** at 375×667, after scrolling past the action zone, no booking control exists in the remaining ~3 screens of content.
3. **Link mismatch:** every `ota_links` URL in production and mock data resolves to a search page or homepage, never to the specific hotel + rate shown.
4. **Marker coverage:** with affiliate env vars unset, 4/4 outbound URLs carry no affiliate marker (contract violation); mock Kiwi/Trip links carry none regardless.
5. **Number disagreement:** whenever `deal.median_price_cents` ≠ median of the last 60 days of snapshots, the page shows two different "usual" prices; the "Last 90 days" label is wrong 100% of the time (history query is 60 days).
6. **Chart illegibility:** the sparkline renders zero price labels; the deal-price dot's x-position is a function of price similarity, not recency.

## Constraints the solution must respect

1. **Data integrity / contract:** money stays `{ priceCents, currency }`; every outbound deeplink must carry an affiliate marker; provider calls stay behind `lib/providers` / `lib/pipeline`; never claim "Great" (or visually oversell) on low-confidence data — the honest low-confidence handling in `scoreDeal.ts` and `DealBadge` must survive any redesign.
2. **Brand & design system:** use existing tokens in `app/globals.css` (`--primary`, `--ink`, `--surface`, `--gold`, `--radius-card`, `btn-conversion`, etc.); no new colors or font sizes; the page must stay consistent with the deal feed cards users arrive from.
3. **Performance & accessibility:** price history and score must keep streaming (Suspense) without blocking the hero/price/CTA; the page stays usable at 375px with ≥44px touch targets; any chart needs a text alternative; a sticky CTA must not trap focus or cover content for keyboard/screen-reader users.

## Success statement

This is solved when a first-time Premium member on a 375px phone can open a deal, see one unmistakable primary booking action without hunting, tap it from anywhere on the page, and land on the provider's page for *that hotel and those dates* — without ever seeing two different "usual" prices, two different history windows, or a dead disabled button standing where the booking action should be.

## Recommended downstream scope (for UXR)

In priority order: (1) CTA hierarchy + persistent access (one primary provider action, sticky/bottom repetition on mobile, handling of missing providers); (2) single-source "usual price" and window copy; (3) deeplink quality + unconditional affiliate markers; (4) sparkline legibility (price labels, dot = most recent point, text alternative); (5) score-section streaming skeleton. Items 3's link-building and marker logic are DEV-stage work; the rest is UXDES/UI.
