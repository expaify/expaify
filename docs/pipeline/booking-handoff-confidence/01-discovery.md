# UXD-BOOKING-HANDOFF-CONFIDENCE-01: Booking Handoff Confidence

**Stage:** UX Discovery (UXD)
**Date:** 2026-07-21
**Surface (verified in source):** the hotel handoff moment — `HotelHandoffReview` in `app/book/BookingFlow.tsx:481-522` (the `/book?kind=hotel…` review screen), reached from the "Review hotel" CTA in `app/components/HotelCard.tsx:490-509` via `buildHotelBookingHref` in `lib/booking/config.ts:360-386`.

> **Scope boundary vs. adjacent docs.** `booking-handoff-trust` audits how *result cards* set expectations before any click. `booking-confirmation-boundary` audits what users understand *after* they submit. This report is the seam between them: the single screen a traveler sees **immediately before leaving expaify for the external hotel partner** — the "Continue to provider" click. It does not re-open results-card copy or post-order confirmation.

---

## Problem statement (one sentence)

At the final expaify screen before a hotel handoff, the traveler cannot confidently answer *who* they are about to be sent to, *whether the nightly rate they are looking at is expected to still be there*, or *what physically happens when they click* — so the "Continue to provider" action asks for a leap of faith at the exact moment trust matters most.

## Who is affected, and where in the flow

- **Who:** First-time and low-familiarity users comparing hotel deals, who have already trusted a Deal Score enough to click "Review hotel" and now sit on the `/book` hotel review page deciding whether to commit the click that leaves expaify.
- **Flow step:** Hotel deal → "Review hotel" (`HotelCard`) → `/book?kind=hotel` review (`HotelHandoffReview`) → "Continue to provider" (external, new tab). This report targets the review page and the CTA that feeds it. Every "Continue to provider" click is the affiliate handoff and the terminal expaify surface for hotels.
- **Trust risk:** The handoff is a one-way door in the user's mind. If the screen does not name the destination, reconcile the price, and describe the mechanics of leaving, a ready-to-book user hesitates, re-checks other tabs, or abandons — wasting the entire upstream funnel and the affiliate conversion.

## What the current implementation does (verified in source)

### 1. Provider identity is thin at the moment of handoff
- `HotelHandoffReview` prints the destination only as `getProviderLabel(hotelContext.provider, false)` (`BookingFlow.tsx:187`), which for hotels returns the **raw provider slug** unchanged (`config.ts` / `BookingFlow.tsx:62-65` only special-cases `duffel`). The visible CTA reads a generic **"Continue to provider"** (`BookingFlow.tsx:513`) with no partner name on or beside the button.
- The only place the destination is described more fully is the CTA `aria-label` ("Opens provider site in a new tab", `BookingFlow.tsx:510`) — invisible to sighted users. There is no logo, no favicon, no "You'll finish on **X**" line adjacent to the primary action.
- `HotelCard` upstream shows "Rate from {providerName}" via `providerDisplayName(hotel.source)` (`HotelCard.tsx:414`), so a provider *name* exists in the data, but it is not carried into `BookingHotelContext` or surfaced next to the handoff button — the identity signal is strongest two screens back and weakest at the click.

### 2. Price continuity is asserted-away rather than reconciled
- Every hotel rate is stamped **"Last-checked time unavailable"** in `HotelCard` (`HotelCard.tsx:46`, `:64`) because freshness data is absent, and that warning does **not** travel to the review page. On `/book`, the "Selected nightly rate" (`BookingFlow.tsx:178-180`) is shown with no timestamp at all.
- The handoff copy repeatedly defers the number to the provider: `hotelTermsCopy` = "Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms." (`BookingFlow.tsx:18`, shown at `:493` and `:504`). This correctly avoids overpromising, but it never tells the user **whether the rate they are staring at is the rate they should expect to see next**, or how stale it might be. The net message is "this number may be anything," which erodes rather than builds pre-handoff confidence.
- The rate's scope ("per night before taxes and fees", `getHotelPriceBasisLabel`, `BookingFlow.tsx:81-84`) is present, but there is no single reconciling sentence of the form "You should see about **$X/night** on {partner}; taxes and fees are added there."

### 3. "What happens next" is under-described for the sighted, keyboard, and mobile user
- "Continue to provider" opens a **new tab** (`target="_blank"`, `BookingFlow.tsx:507-509`). The visible page never states that a new tab opens or that the current expaify results remain — that fact lives only in the `aria-label`. A user who expects an in-place navigation is surprised, and a user on mobile (where new tabs are less visible) may think expaify "disappeared."
- There is no reassurance about **return-to-site**: nothing says "your search stays open here," so the handoff feels like an exit rather than a branch. This is the direct behavioral lever behind the measurement plan below.
- The screen provides a "Back to search" secondary action (`BookingFlow.tsx:515-517`) and a top "← Back to search" (`BookingFlow.tsx:320`), which is good, but the primary CTA carries the entire burden of expectation-setting and does so only for screen-reader users.

### 4. The invalid / unresolvable handoff is handled, but the confident happy path is not differentiated
- `InvalidHotelState` (`BookingFlow.tsx:435-479`) correctly recovers when the offer can't be reconstructed, and `HotelCard` disables the CTA to "Booking unavailable" when there is no valid price or link (`HotelCard.tsx:501-509`, `getUnavailableReason`). So the *failure* edges are covered.
- What is missing is a **positive, legible confidence state** for the normal case: when price, currency, provider URL, and basis are all valid, the review screen still reads as a wall of caution copy rather than a calm "here is exactly what happens" summary.

## Measurable signal (how we know the problem exists / is solved)

The problem exists when the hotel review screen cannot answer these three questions from **visible** content, without relying on the `aria-label` or the previous card:

1. **Who am I being sent to?** — the partner is named on/next to the primary CTA.
2. **Will this price hold?** — a single sentence reconciles the displayed nightly rate with what to expect on the partner (and states freshness or its absence honestly).
3. **What happens when I click?** — a new tab opens, the provider finalizes taxes/fees/policy, and the expaify search remains.

### Measurement plan (instrumentation for UXR/DEV to validate)
Primary metrics, all scoped to hotel handoff:
- **Outbound-CTA completion rate** — `continue_to_provider` clicks ÷ `hotel_review_view` (views of `/book?kind=hotel`). This is the core conversion signal; the hypothesis is that naming the partner + reconciling price raises it.
- **Pre-handoff abandonment** — share of `hotel_review_view` sessions that fire `back_to_search` (or navigate away) with **no** `continue_to_provider`. Falling abandonment indicates reduced hesitation.
- **Return-to-site behavior** — because the handoff is a new tab, instrument the expaify tab regaining focus (`visibilitychange` → `visible`) after a `continue_to_provider`, and any subsequent search/compare within N minutes. Healthy handoff = users return and continue exploring rather than treating the click as a dead-end exit.

Supporting/diagnostic signals:
- **Hesitation proxy** — median dwell time on `/book?kind=hotel` before `continue_to_provider`; unusually long dwell suggests the screen is not answering the three questions.
- **Provider-identity legibility** — qualitative/heuristic check: is the partner nameable from the visible screen alone (pass/fail per QA trace)?

> Note: this plan describes *what to measure and why*. No analytics vendor is wired into the repo today; UXR/UXDES/DEV decide the emit mechanism. Adding instrumentation must not introduce a network round trip that blocks render (see constraints).

## Constraints the solution must respect

1. **No change to partner integrations (hard scope limit from the ticket).** The external booking flow — `hotelContext.providerUrl`, `target="_blank"`, `rel="noopener noreferrer sponsored"`, and the affiliate marker already on the deeplink — must be preserved exactly. This is a pre-handoff *confidence/copy/identity* change, not a routing or provider change.
2. **Truthful trust copy.** Copy must not imply expaify controls the final rate, taxes, fees, availability, or cancellation policy, and must not claim a price is "locked." Honesty about missing freshness ("last-checked time unavailable") must be preserved, not hidden.
3. **Data & money contract.** Rate display stays `{ priceCents, currency }` (never floats); provider identity must come from data already in `BookingHotelContext` / `HotelOffer.source` — no new provider call. Affiliate markers on the outbound deeplink must remain intact.
4. **Accessibility & responsive.** The three answers (who / price / what-happens) must be visible, not only in `aria-label`; CTA, focus ring, and new-tab semantics must be clear; the screen must stay usable and non-truncated at 375px mobile and 1280px desktop.
5. **Performance.** No blocking network round trip added before the review screen renders; any measurement emit must be fire-and-forget.

## Success statement

This is solved when a first-time user, on the last expaify screen before a hotel booking, can — from the visible content alone — name the partner they are about to be sent to, know roughly what nightly rate to expect there and how fresh it is, and understand that a new tab will open while their expaify search stays put, without second-guessing the handoff or leaving to re-verify elsewhere.

## Out-of-scope findings (report, do not fix here)
- The universal **"Last-checked time unavailable"** hotel freshness stamp (`HotelCard.tsx:46`) is a data-layer gap (no freshness field populated for hotels). It undermines price-continuity confidence but is a provider/data concern, not this pre-handoff UX ticket. Flag for a DEV/data ticket.
- `getProviderLabel` only humanizes `duffel`; hotel provider slugs render raw (`BookingFlow.tsx:62-65`). A shared `providerDisplayName` already exists in `lib/providerFreshness`; unifying provider naming across surfaces is a broader consistency task beyond this ticket.

## Handoff
Next stage: **UXR-BOOKING-HANDOFF-CONFIDENCE-01** (UX Research). Research must audit `app/book/BookingFlow.tsx` (`HotelHandoffReview`), `app/components/HotelCard.tsx`, and `lib/booking/config.ts` against a reference hotel handoff pattern (e.g. Booking.com / Google Hotels "you'll book with {partner}" interstitials), and convert the three questions above into 3–5 testable design directives plus a concrete metric-emit recommendation.
