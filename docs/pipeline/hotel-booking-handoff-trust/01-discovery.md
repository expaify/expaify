# UXD-HOTEL-BOOKING-HANDOFF-TRUST-01: Hotel Booking Handoff Trust

**Stage:** UX Discovery (UXD)
**Date:** 2026-07-30
**Surface (verified in source):** `HotelHandoffReview` / `HotelDecisionSummary` in `app/book/BookingFlow.tsx`, reached from the "Review hotel" CTA in `app/components/HotelCard.tsx:943-959` via `buildHotelBookingHref` / `buildBookingHotelContext` in `lib/booking/config.ts:945-1061`.

> **Scope boundary vs. adjacent docs.** `docs/pipeline/booking-handoff-trust` covers expectation-setting on *result cards* before any click. `docs/pipeline/booking-handoff-confidence` covers *partner identity and the mechanics of leaving* on the review screen — that work shipped (partner name in the CTA, "Opens X in a new tab. Your expaify search stays open here.", ownership and loyalty disclosures). This report covers the remaining, distinct gap: **the selected stay details the traveler carried into the review screen are silently discarded there.** It does not re-open card copy, partner naming, or anything on the partner's own checkout.

---

## Problem statement (one sentence)

At the last expaify screen before a hotel handoff, the review page tells the traveler that their stay dates, hotel class, guest rating, Deal Score, and price freshness are "not provided" — even though every one of those fields is a defined, validated field on the booking context — so the screen actively contradicts the result card the traveler just clicked and makes the handoff feel like a reset rather than a continuation.

## Who is affected, and where in the flow

- **Who:** Every traveler who reaches a hotel handoff, but the damage is concentrated in first-time and low-familiarity users who have no prior reason to extend expaify the benefit of the doubt. They chose this property *because* of a 4-star class, an 8.7 guest rating, a "Great" Deal Score, and a specific set of dates.
- **Flow step:** Hotel result card → "Review hotel" → `/book?kind=hotel` review screen → "Check rooms at {partner}" (external, new tab). The break is on the review screen, in the panel the traveler reads immediately before the outbound click.
- **Trust risk:** The traveler is asked to leave expaify at the exact moment expaify appears to have forgotten what they selected. The reasonable reading is not "this field is unavailable" — it is "this site lost my selection," which invalidates the Deal Score that justified the click in the first place. A traveler who cannot see their own dates on the handoff screen has no way to know whether the nightly rate in front of them is even priced for their stay.

## What the current implementation does (verified in source)

### 1. The continuity fields exist, are validated, and are never populated

`BookingHotelContext` (`lib/booking/config.ts:52-75`) defines `entrySource`, `returnUrl`, `checkIn`, `checkOut`, `nightCount`, `dealScore`, `priceCheckedAt`, `hotelClass`, and `guestRating`. There is real machinery behind them:

- `parseStayContinuity` (`config.ts:521-544`) validates dates, rejects a check-out on or before check-in, derives `nightCount` when absent, and rejects a supplied `nightCount` that disagrees with the date span.
- `buildBookingHotelContext(hotel, continuity?)` (`config.ts:945-974`) spreads all nine fields onto the context.
- `buildInlineHotelBookingHref` and the query parser (`config.ts:860-868`, `:1018`) round-trip them through the `/book` URL.

**No caller ever passes the `continuity` argument.** The only two call sites are `HotelCard.tsx:753` (`buildHotelBookingHref(selectedHotel)`) and `HotelCard.tsx:812` (`buildBookingHotelContext(selectedHotel)`), both single-argument. `buildHotelBookingHref` (`config.ts:1059-1060`) has no continuity parameter at all. Every one of these fields is therefore `undefined` on every real handoff.

### 2. The review screen hardcodes "not provided" regardless of the context

`HotelDecisionSummary` (`BookingFlow.tsx:319-384`) does not read `checkIn`, `checkOut`, `nightCount`, `priceCheckedAt`, `hotelClass`, or `guestRating` at all. A grep for those identifiers across `app/book/BookingFlow.tsx` and `app/book/page.tsx` returns zero matches. The screen renders fixed strings:

- `BookingFlow.tsx:339-342` — "Stay dates not provided" and "Stay dates are incomplete. Choose or confirm dates with the provider before comparing room options." Always, even for a dated search.
- `BookingFlow.tsx:356` — "Last-checked time not provided." Always.
- `BookingFlow.tsx:372-373` — "Hotel class not provided." Always, including for a property the card just labelled "4-star hotel."
- `BookingFlow.tsx:375-378` — "Guest rating not provided" plus "This provider did not return guest-rating evidence." Always — and this second sentence is a **false statement about the provider** whenever the card displayed a verified rating from `hotel.guestRating`.
- `BookingFlow.tsx:358-364` — `DealScorePanel` receives `hotelContext.dealScore ?? null`, which is always `null`, so the panel always renders "We could not compare this nightly rate with enough recent hotel prices." The Deal Score is expaify's stated differentiator and it is guaranteed absent at the decision moment.

So there are two independent defects stacked on the same fields: the data never arrives, and the screen would ignore it if it did.

### 3. The return-signal UI is built but never rendered

`HotelHandoffReview` builds a `hotelSupplement` node (`BookingFlow.tsx:1040-1089`) containing the smoking-policy panel and the "Did the partner details match?" mismatch-feedback prompt gated on `showReturnPrompt`. It passes that node to `ReviewShell`. **The hotel branch of `ReviewShell` (`BookingFlow.tsx:511-523`) renders `HotelDecisionSummary`, `status`, and `children` — it never renders `hotelSupplement`.** The prop is accepted (`:508`) and dropped.

The consequence is directly relevant to this ticket's measurement plan: the `visibilitychange` handler correctly fires `hotel_handoff_returned` with an `awayDurationBucket` and calls `setShowReturnPrompt(true)` (`:897-927`), but the traveler who bounces back from the partner in under five seconds is shown nothing and can never select a return reason. `hotel_handoff_return_reason_selected` (`:960-966`) is unreachable in the shipped UI. We are instrumented to detect rapid back-navigation but structurally unable to learn its cause.

### 4. Return-to-expaify is a bare link to `/`

Both back affordances (`BookingFlow.tsx:514-516`, and the flight-shell equivalent at `:528-530`) are `href="/"`. `returnUrl` is defined on the context and validated by `validateHotelReturnUrl` (`config.ts:699`) but never set and never read. A traveler who comes back from the partner to compare a second property lands on an empty search form and must re-enter their query. That is the continuity cost of the same missing plumbing.

## Measurable signal that the problem exists

Reproducible today, without instrumentation:

1. Run a dated hotel search on a property that returns a class and a verified guest rating. Note the card shows the class chip, the rating chip, and a Deal Score verdict (`HotelCard.tsx:852-873`, `:941`).
2. Click "Review hotel."
3. The review screen shows "Stay dates not provided," "Hotel class not provided," "Guest rating not provided / This provider did not return guest-rating evidence," "Last-checked time not provided," and a Deal Score panel reading "We could not compare this nightly rate with enough recent hotel prices."

Five contradictions between two consecutive screens, on the happy path, for every hotel offer.

Instrumented signals to watch once this ships:

- **Handoff click-through:** `hotel_handoff_continue_clicked` ÷ `hotel_handoff_viewed` (both already emitted, `BookingFlow.tsx:748`, `:937`). This is the primary success metric.
- **Rapid back-navigation:** share of `hotel_handoff_returned` events in the `<5s` and `5–30s` `awayDurationBucket`s (`:912-918`). A sub-5s return means the traveler left, saw something that did not match, and came straight back.
- **Abandon-before-handoff:** `hotel_handoff_back_clicked` (`:1016`) ÷ `hotel_handoff_viewed`.
- **Mismatch reasons:** `hotel_handoff_return_reason_selected` (`:960`) — currently unreachable; the `price_or_fees_mismatch` and `room_availability_mismatch` reasons are exactly the hesitation signals this ticket asks us to measure.

## Constraints the solution must respect

1. **Data integrity — never invent continuity.** Every restored field must be rendered only when the context actually carries it, with its existing provenance and confidence semantics intact (`HotelRatingEvidence.confidence`, the verified-vs-provider-only distinction already enforced in `HotelCard.tsx:459-470`). A "not provided" state must remain available and honest for the cases where the provider genuinely returned nothing. Restoring the fields must not become a licence to soften `Last-checked time not provided` into an implied freshness guarantee, and a thin-history Deal Score must still surface as "Limited history" rather than a verdict.
2. **Accessibility — the restored details must be reachable, not decorative.** Stay dates, class, rating, and score must be real content in the reading order with correct `dt`/`dd` or heading semantics, must not rely on colour alone to distinguish confirmed from unconfirmed, and must keep the primary handoff CTA's accessible name accurate as the surrounding facts change. Focus order into the outbound link must not regress.
3. **Performance and contract — continuity is passed, not re-fetched.** The review screen must not add a network round trip to reconstruct facts the result card already held. Continuity travels through the existing `BookingHotelContinuity` plumbing (URL params or the hotel-context store). No component may call a vendor API; money stays `{ priceCents, currency }` in integer minor units; the outbound link keeps `rel="noopener noreferrer sponsored"` and its affiliate marker.

## Success statement

This is solved when a first-time user on the hotel review screen can see their own check-in and check-out dates, night count, hotel class, guest rating, and Deal Score — the same facts, with the same confidence language, that made them click — without encountering a single "not provided" line that contradicts the result card they came from, and can return from the partner to their original search results rather than an empty form.

## Out of scope

- Anything on the partner's own checkout, including its price, fees, room list, or policies.
- Result-card copy and CTA hierarchy (owned by `booking-handoff-trust`).
- Partner naming, new-tab cueing, and ownership/loyalty disclosures (owned by `booking-handoff-confidence`, already shipped).
- Post-order confirmation (owned by `booking-confirmation-boundary`).
- Adding a real price-freshness timestamp to the hotel provider. `priceCheckedAt` should be rendered when present, but sourcing it is `hotel-price-freshness`, not this ticket.

## Handoff notes for UXR

Three things worth verifying first, because they change the shape of the fix:

1. Whether `HotelOffer` and the search page actually hold check-in/check-out at the point `HotelCard` builds the href — `HotelCard` receives a `hasSearchDates` prop, which suggests the dates live above it and may need threading down.
2. Whether continuity should ride the URL (`buildInlineHotelBookingHref`) or the hotel-context store (`lib/booking/hotelContextStore.ts`), given `MAX_INLINE_HOTEL_BOOKING_HREF_LENGTH` is 4,096 and `hotelClass`/`guestRating` serialize as JSON.
3. The `hotelSupplement` drop in `ReviewShell` — confirm whether the intended design places it after `children` or between the summary and the handoff panel, since that ordering decides where the mismatch prompt appears on return.
