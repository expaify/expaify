# UX Research Brief — Booking Handoff Confidence

**Ticket:** UXR-BOOKING-HANDOFF-CONFIDENCE-01
**Stage:** UXR (UX Research)
**Author:** Senior UX Researcher
**Date:** 2026-07-22
**Upstream discovery:** `docs/pipeline/booking-handoff-confidence/01-discovery.md` — **FILE MISSING ON DISK** (see §8 Blockers). The problem statement embedded in the ticket description was used as the research input and is treated as authoritative for this brief.

---

## 1. Problem restated (from ticket)

At the last expaify screen before a hotel handoff — `HotelHandoffReview` in `app/book/BookingFlow.tsx`, reached from the `HotelCard` "Review hotel" CTA — the traveler cannot see:

1. **Who they are being sent to** (which partner site the "Continue to provider" button opens).
2. **Whether the shown nightly rate will hold** on the partner site.
3. **That a new tab opens** while their expaify search stays behind.

**Central research question:** With the hard constraint that we may **not** touch `providerUrl`, `target="_blank"`, `rel`, or affiliate markers, what is the minimum set of *honest, visible* signals the handoff screen must add so a first-time user knows who they are going to, what the rate means, and that they can come back — and which of those signals are blocked by missing data?

**In scope:** copy, hierarchy, and visible affordances on `HotelHandoffReview` (the interstitial), plus the CTA label and the one supporting line on `HotelCard`. **Out of scope:** the deeplink itself, partner integrations, and the flight (`FareSummary`/form) path.

---

## 2. Current-code audit (evidence, not assumption)

All findings below were read directly from source in this worktree.

### 2.1 The handoff screen never names the destination partner

`HotelHandoffReview` (`app/book/BookingFlow.tsx:481–522`) renders `HotelSummary`, which shows a **"Provider"** fact via `getProviderLabel(hotelContext.provider, false)` (`:187`). Two problems:

- **`provider` is the data *source*, not the destination brand.** `buildHotelBookingHref` (`lib/booking/config.ts:360–386`) sets `provider: hotel.source`. `hotel.source` is the aggregator/feed that returned the row (e.g. `travelpayouts`, `bookingcomrapidapi` → "Booking.com", `hotellook` → "Hotellook"; see `lib/providerFreshness.ts:3–10`). The tab actually opens `hotelContext.providerUrl` — the deeplink — whose **host may be a different brand** than the source label. Nothing on the page derives or displays the destination the URL points at.
- **The CTA is anonymous.** The button text is the literal string **"Continue to provider"** (`:513`). The word "provider" is never resolved to a name for sighted users. (The `aria-label` at `:510` also says only "Continue to provider for `{hotel.name}`… Opens provider site in a new tab.")

**Delta:** the single most important thing at a handoff — *who am I about to trust with my card?* — is present only as an ambiguous, possibly-mismatched "Provider" data cell, never as a decision-level label on the action.

### 2.2 The new-tab behavior is invisible to sighted users

The anchor uses `target="_blank" rel="noopener noreferrer sponsored"` (`:507–509`). The only place "Opens provider site in a new tab" appears is inside the **`aria-label`** (`:510`). There is:

- **no visible external-link icon** on the button (the flight submit path and the card's own "Review hotel" button both use iconography; this button is bare),
- **no visible sentence** telling the user a new tab will open, and
- **no statement that the expaify search/review stays open** behind it.

**Delta:** a sighted, mouse/touch user clicks "Continue to provider" with no cue that focus jumps to a new tab and their expaify context is preserved. Screen-reader users get the cue; everyone else does not. This is the "return-to-site" confidence gap in the ticket.

### 2.3 Nothing says whether the nightly rate will hold — and one signal actively undermines it

- `HotelSummary` shows **"Selected nightly rate"** = `formatMoney(hotelContext.priceCents, hotelContext.currency)` with basis "per night before taxes and fees" (`:178–180`, `getHotelPriceBasisLabel` at `:81–84`).
- The upstream card (`HotelCard.tsx`) prints a hardcoded **`Last-checked time unavailable`** warning line next to every price (`:46`, `:64`) and again in the expanded "Rate check" block (`rateCheckCopy`, `:416`, `:575`). **This staleness warning does not propagate to the handoff screen at all** — `BookingHotelContext` (`lib/booking/config.ts:18–29`) carries no freshness field, so the interstitial silently drops the one honesty signal the card was showing.
- The handoff's only rate framing is the deferral sentence `hotelTermsCopy` = *"Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms."* (`:18`), rendered **three times** on the same screen (status panel `:493`, body `:504`, and embedded in the CTA `aria-label` `:510`).

**Delta:** the screen shows a precise-looking price with no statement of what it *is* (expaify's last-seen rate, not a locked/guaranteed rate) and no statement of what could change it (the partner re-prices on arrival). "Provider confirms … final total" is a deferral, not an expectation-setter — it tells the user the number is provisional without ever saying the shown number itself may move.

### 2.4 Repetition crowds out signal

`hotelTermsCopy` appears 3× (§2.3). The "Before you continue" block (`:498–503`) restates the same "compare … before entering payment" idea already implied by the status panel and the HotelSummary facts. The screen is dense with *deferral* language and thin on *identity* and *orientation* language — the inverse of what a handoff needs.

### 2.5 There is a proven honest, in-repo pattern to reuse

Two patterns already exist and should be reused rather than reinvented:

- **Confidence/deferral tone** — `HotelCard` renders quality evidence with explicit confidence framing and neutral "not provided" states (`getConfidenceText`, `getQualityHelperText`, `HotelCard.tsx:248–307`). The handoff should adopt the same "state what we know / name what we don't" voice.
- **CTA with an icon + descriptive aria** — the "Review hotel" button (`HotelCard.tsx:491–500`) and the flight submit button both pair a visible label with an SVG and a rich aria-label. The handoff CTA (`BookingFlow.tsx:506–514`) should match.

### 2.6 Data inventory — what the handoff can honestly show today

`BookingHotelContext` (`lib/booking/config.ts:18–29`) carries: `offerId, provider (=source), name, area, location, priceCents, currency, priceBasis ('per_night_before_taxes_fees'), providerUrl`.

| Signal the user needs | Available now? | From |
|---|---|---|
| Destination partner **name** | **Partially** — derivable from `providerUrl` host, no schema change | `providerUrl` (read-only, host parse) |
| Nightly rate + basis | Yes | `priceCents`, `currency`, `priceBasis` |
| Location precision / warning | Yes | `location` via `getHotelLocationDisplay` |
| New-tab + search-preserved cue | Yes (copy only) | static |
| Rate freshness ("last checked") | **No** | not in `BookingHotelContext` (card shows "unavailable") |
| **Total stay cost** (nights × rate) | **No** | no check-in/check-out/nights in `HotelOffer` or context |

The last two rows are honest-data gaps; directives must not fabricate them.

---

## 3. Reference-pattern comparison (interaction level, not visual style)

**Google Hotels — "Book on <partner>" handoff** and **Booking.com aggregated-rate handoff.** At the interaction level, mature hotel handoffs do three things this screen does not:

1. **Name the destination brand on the action itself** — "Book on Expedia" / "View deal on Booking.com," with the partner identified *before* the click, not as an ambiguous data cell. The user always knows which company will take their card.
2. **Signal the transition explicitly** — an external-link glyph and/or "opens the partner site" text; the origin surface (search results) is understood to persist, so the user knows they can return and keep comparing.
3. **Frame the price as a starting point that the partner confirms** — "final price shown at checkout," stated as an expectation about *the number in front of you*, not buried as generic "terms confirmed by provider" boilerplate.

**Delta vs expaify:** expaify currently does none of the three at decision level — (1) is an ambiguous "Provider" cell that may not match the URL host, (2) is aria-only, and (3) is a thrice-repeated deferral that never addresses the visible number.

---

## 4. Design directives (specific, testable)

Each directive is testable, respects the no-touch constraint on `providerUrl`/`target`/`rel`/affiliate markers (all changes are copy, an icon, and a **read-only host parse** of the existing URL), and cites the exact code to change.

### D1 — Name the destination partner on the CTA and in a "You'll book with" line
**What:** Derive a human-readable destination name from `hotelContext.providerUrl` (parse the URL host, e.g. `www.booking.com` → "Booking.com"; strip `www.`, map known hosts, else Title-Case the registrable domain). Show it in two places: (a) the CTA label — **"Continue to {Partner}"** (fallback **"Continue to booking partner"** when the host is unknown/opaque), and (b) a short line above the CTA — **"You'll book with {Partner}. expaify hands you off; they take payment."**
**Why:** §2.1, §3.1 — resolves the identity gap and the source-vs-destination mismatch without altering the link.
**Constraint note:** `providerUrl` is **read only** to parse the host; the `href`, `target`, `rel`, and affiliate query params are unchanged.
**Testable:** For a `providerUrl` of `https://www.booking.com/hotel/...?aid=123`, the visible button reads "Continue to Booking.com" and the href/query string is byte-for-byte unchanged. For an unresolvable host, the button reads "Continue to booking partner." The existing `getProviderLabel` "Provider" fact remains but is relabeled **"Rate source"** to end the source/destination ambiguity.

### D2 — Make the new-tab + search-preserved behavior visible, not aria-only
**What:** Add to the CTA a visible external-link icon (reuse the arrow/SVG idiom from `HotelCard.tsx:497–499`) and a single visible line directly under the button: **"Opens {Partner} in a new tab. Your expaify search stays open here."**
**Why:** §2.2, §3.2 — gives sighted/touch users the transition and return cue that only screen-reader users get today; directly supports the return-to-site metric (D-metrics).
**Testable:** With CSS/aria stripped, a sighted user can read that a new tab opens and that expaify stays. The `aria-label` still contains "Opens … in a new tab." Keyboard: the icon is `aria-hidden`, the line is not an interactive element (no new tab stop).

### D3 — State honestly what the nightly rate is and is not (do not imply a hold)
**What:** Replace the generic thrice-repeated deferral with one explicit rate-expectation statement next to "Selected nightly rate": **"This is the rate expaify last saw from {Rate source}. {Partner} confirms the live rate, taxes, and fees before you pay — the total you see there may differ."** Keep the "per night before taxes and fees" basis. Do **not** add words like "guaranteed," "locked," or "held."
**Why:** §2.3, §3.3 — answers "will this rate hold?" with the truthful answer (it may not) instead of a boilerplate deferral, and re-surfaces the honesty that `HotelCard` shows but the context drops. Aligns with the in-repo confidence voice (§2.5).
**Testable:** The screen contains exactly one rate-expectation sentence (not three deferral repeats); it names both the rate source and the destination; it contains no "guaranteed/locked/held" language. Copy review confirms it sets a *may-change* expectation, not a *will-hold* promise.

### D4 — Reframe deferral boilerplate as a two-column "expaify shows / {Partner} confirms" split, shown once
**What:** Collapse the three `hotelTermsCopy` repetitions (`:493`, `:504`, and the redundant "Before you continue" block `:498–503`) into a single labeled two-part block: **"expaify shows: hotel name, area, nightly rate basis, rate source."** / **"{Partner} confirms: final total, taxes, fees, room availability, cancellation policy."** The CTA `aria-label` may retain a condensed terms clause.
**Why:** §2.4 — turns repeated deferral into an informative division of responsibility, raising signal density without adding data we don't have.
**Testable:** `hotelTermsCopy` renders at most once in visible body copy; the two responsibilities are distinct and non-overlapping; no visible string is duplicated verbatim on the screen.

### D5 — Do not fabricate total-stay cost or a "last checked" time; label the gaps honestly
**What:** Because `BookingHotelContext` carries **no** check-in/check-out/nights and **no** freshness timestamp (§2.6), the handoff must **not** invent a total-stay figure or a freshness time. Where the card showed "Last-checked time unavailable," the handoff should either omit a freshness claim entirely or state **"Rate freshness not available from this provider"** — never imply a fresh check occurred.
**Why:** §2.3, §2.6 — prevents a trust regression where the interstitial looks *more* certain than the card that fed it. Honesty over false precision (in-repo pattern §2.5).
**Testable:** The handoff contains no total/multi-night currency figure and no relative or absolute "checked N ago" timestamp. Any freshness reference is an explicit "not available" statement. (If UXDES wants real freshness or totals, that requires a DEV ticket to add `fetchedAt` and stay-date fields to `BookingHotelContext` — flagged in §8, out of scope here.)

---

## 5. Hierarchy directive (what wins on this screen)

Primary: **destination partner identity + the CTA** (D1). Secondary: **rate + honest rate-expectation** (D3) and the **new-tab/return cue** (D2). Tertiary: the **expaify-shows / partner-confirms** split (D4) and location precision (existing). The current screen inverts this — deferral boilerplate is loudest, identity is absent.

---

## 6. Metric-emit recommendation (outbound-CTA completion, pre-handoff abandonment, return-to-site)

**Reuse the existing analytics primitive** — `track(event, props)` in `lib/analytics.ts:3` and the `TrackOnMount` component (`app/components/TrackOnMount.tsx`), already used by `WatchCityCta`/`DealFeed`. No new dependency, no PII: props carry only non-identifying context (`provider`/source, `partnerHost`, `currency`, `priceCents`, `priceBasis`, `locationPrecision`). **Do not** put `offerId`, `providerUrl`, `name`, or any query string with affiliate markers into props.

Three events map to the ticket's three questions:

| Metric (ticket) | Event | Fires when | Props |
|---|---|---|---|
| Handoff reached (denominator) | `hotel_handoff_viewed` | `HotelHandoffReview` mounts (via `TrackOnMount`) | `source`, `partnerHost`, `currency`, `priceCents`, `priceBasis`, `locationPrecision` |
| **Outbound-CTA completion** | `hotel_handoff_continue_clicked` | user activates "Continue to {Partner}" (anchor `onClick`) | same as above + `partnerNamed: boolean` (was the host resolved?) |
| **Pre-handoff abandonment** | `hotel_handoff_back_clicked` | user activates "Back to search" without having clicked continue | `source`, `partnerHost` |
| **Return-to-site** | `hotel_handoff_returned` | tab regains focus/visibility **after** a continue-click (`visibilitychange` → `visible`, guarded by a "did-continue" flag) | `source`, `partnerHost`, `dwellMs` (coarse bucket) |

**Derivations for the dashboard:** outbound-CTA completion rate = `continue_clicked / viewed`; pre-handoff abandonment rate = `back_clicked / viewed` (plus silent drop-off = `viewed − continue − back`); return-to-site rate = `returned / continue_clicked`.

**Implementation notes / guardrails (for UI/DEV, not this stage):**
- The `onClick` on the outbound anchor fires `track` **synchronously before** navigation; because the link is `target="_blank"`, the current document is not torn down, so the beacon is not at risk — but keep `track` non-blocking regardless. **The `onClick` must not `preventDefault`, must not modify the `href`, and must not touch `rel`/affiliate params.**
- `hotel_handoff_returned` requires a client-side `visibilitychange` listener plus a ref flag set on continue-click; unmount-clean the listener. Bucket `dwellMs` (e.g. `<5s / 5–30s / 30–120s / 120s+`) rather than logging raw duration, to avoid a fingerprinting-grade signal.
- `lib/analytics.ts` `track` is currently a dev-only `console.debug` no-op in production — that is fine for this stage; wiring a real sink is a separate platform decision, out of scope for this ticket.

---

## 7. Constraint & contract check

- **No changes to** `providerUrl`, `target="_blank"`, `rel="noopener noreferrer sponsored"`, or affiliate query markers. All directives are copy, one icon, a read-only host parse, and event emits. ✅
- Money stays integer minor units in props (`priceCents`) — never floats. ✅
- No provider/vendor calls introduced; no secrets. ✅
- Analytics props carry no PII and no affiliate-bearing URL. ✅

---

## 8. Blockers & out-of-scope findings

1. **BLOCKER (non-fatal): discovery doc missing.** `docs/pipeline/booking-handoff-confidence/01-discovery.md` does not exist on disk (only the `booking-handoff-confidence/` folder was created by this stage). The ticket-embedded problem statement was treated as the authoritative research input. If a formal discovery doc is later produced and conflicts with this brief, re-run UXR. This mirrors the same situation recorded in `docs/pipeline/cancellation-policy/02-research.md`.
2. **Out of scope — real rate freshness on the handoff:** requires adding a `fetchedAt` field to `BookingHotelContext` (`lib/booking/config.ts`) and threading it through `buildHotelBookingHref`. → **DEV ticket** if UXDES wants a live "last checked" signal instead of the D5 honest-gap statement.
3. **Out of scope — total-stay cost:** `HotelOffer`/`BookingHotelContext` carry no check-in/check-out or nights, so "nights × rate" cannot be shown honestly. → **DEV ticket** to add stay-date fields if a true total is desired later.
4. **Out of scope — real analytics sink:** `track()` is a dev-only no-op; production wiring is a platform decision.

---

## 9. Handoff

Ready for **UXDES-BOOKING-HANDOFF-CONFIDENCE-01** (UX Design). The designer should produce the full state spec for `HotelHandoffReview` implementing D1–D5 and the metric emits in §6, with final copy for the partner-name fallback, the two-column split, and the honest rate-expectation sentence — covering default, unresolved-partner-host, warning-location, mobile 375px, desktop 1280px, and keyboard/focus states.
