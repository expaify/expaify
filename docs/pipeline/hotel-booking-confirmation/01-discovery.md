# UXD-HOTEL-BOOKING-CONFIRMATION-01: Hotel Booking Confirmation and Itinerary Access Reliability

**Stage:** UX Discovery (UXD)
**Date:** 2026-08-03
**Priority:** P1
**Persona:** Senior UX Strategist

**Surfaces verified in source:** `HotelHandoffReview` in `app/book/BookingFlow.tsx:760-1340`, the flight success state in `app/book/BookingFlow.tsx:1420-1447`, `app/api/book/route.ts:190-216`, `lib/db/schema.sql`, `app/account/AccountClient.tsx`, `app/api/account/`.

---

## Scope decision

This report owns **the moment the traveler comes back to expaify after a hotel handoff, and every later moment they try to find that stay again.** Specifically:

1. whether expaify tells the traveler that a reservation now exists and who holds it;
2. what the traveler must capture from the partner's confirmation while they still have it in front of them;
3. whether expaify preserves any durable handle back to the stay they chose.

It does **not** authorize expaify to fetch, store, or display a partner reservation, create a bookings table, build a trips portal, or promise a cancellation deadline. It does not re-open contacting the property (`docs/pipeline/hotel-property-contact`), the ownership disclosure that already shipped (`docs/pipeline/hotel-booking-handoff-trust`, `docs/pipeline/booking-handoff-confidence`), post-checkout change rights (`docs/pipeline/hotel-booking-modification`), or the pre-submit expaify-vs-provider boundary (`docs/pipeline/booking-confirmation-boundary`). Those four cover *before* the click. **This covers after it.**

---

## Problem statement (one sentence)

expaify sends a hotel traveler to a partner site and then has no post-booking state at all — when the traveler returns, the only thing expaify says is "Did the partner details match?", so a traveler who just paid gets no confirmation that a reservation exists, no instruction to capture the confirmation record while it is on screen, and no durable way to find the stay again, leaving the partner's email as the single point of failure for the entire reservation.

## Who is affected, and where in the flow

- **Who:** Every traveler who completes a hotel booking through an expaify handoff. Damage concentrates in (a) first-time users with no prior partner relationship, who do not know which brand's inbox to search later; (b) travelers who booked from a phone and closed the tab; (c) travelers whose partner confirmation email lands in spam or a mistyped address.
- **Flow step:** `/book?kind=hotel` review screen → "Check rooms at {partner}" (new tab, external) → partner checkout → **return to the still-open expaify tab**. The break is entirely on the return, and on every later visit.
- **Why it costs money:** The traveler's only artifact is a partner email expaify never sees. If it does not arrive, the traveler's first instinct is to contact the brand that sent them — expaify — about a booking expaify has no record of and cannot look up. That is the most expensive possible support contact: high anxiety, zero resolution capability, and it recurs until check-in.

## What the current implementation does (verified in source)

### 1. expaify has no post-booking state, and no record of any hotel booking anywhere

- `lib/db/schema.sql` contains 19 tables (`snapshots`, `hotel_snapshots`, `price_alerts`, `deals`, `users`, `subscriptions`, `analytics_events`, …). **There is no bookings, reservations, orders, or trips table.** A grep for `booking` and `order` across the schema returns nothing.
- `app/api/account/` exposes only `alerts` and `watchlist`. `app/account/AccountClient.tsx` renders alert preferences, a watchlist, and Stripe subscription management — no stay, no reservation, no history.
- The hotel path never calls a write endpoint. `handleContinue` (`BookingFlow.tsx:1010-1032`) fires analytics and lets the anchor open `hotelContext.providerUrl`. Nothing is persisted.

So the traveler's booking exists in exactly two places: the partner's system, and the partner's email. expaify holds neither, and — correctly, given the affiliate model — should not claim to. **The gap is not that expaify lacks the record. It is that expaify never says so, and never helps the traveler secure the one copy that does exist.**

### 2. The only post-handoff surface expaify owns is a price-feedback survey

`BookingFlow.tsx:979-1006` arms a `visibilitychange` listener after continue. When the traveler returns to the tab, expaify sets `showReturnPrompt` and renders (`:1124-1167`):

> **Did the partner details match?**
> Optional: tell us the main mismatch so we can improve hotel price details.
> [ Report a mismatch ]

This is the single richest signal expaify will ever get — the traveler is back, seconds after checkout, with the confirmation open in the other tab — and expaify spends it asking about *price accuracy for expaify's benefit*. It asks nothing about whether a booking happened, offers nothing to the traveler, and gives no instruction while the confirmation is still reachable. A traveler who booked and a traveler who bounced see the identical prompt.

### 3. The return prompt is ephemeral and unreachable on a second visit

`showReturnPrompt`, `feedbackSent`, and `handoffAttemptId` are `useState`/`useMemo` in `HotelHandoffReview` (`:934-936`, `:800`). Nothing is written to `localStorage`, a cookie, or the database. Consequences:

- A refresh, a back-navigation, or closing the tab erases it.
- Mobile users who leave the browser entirely and return later get nothing.
- Re-visiting `/book?kind=hotel&...` renders the pre-handoff review screen again, indistinguishable from never having booked — expaify actively invites the traveler to book the same room a second time.

### 4. The one durable handle expaify does own is buried and mislabelled

`BookingFlow.tsx:1326-1333` renders, inside a collapsed `<details>` labelled "Show offer details":

> **Offer reference** `{hotelContext.offerId}`
> Use this reference if you contact expaify support.

This is the correct instinct in the wrong place. It is (a) collapsed by default, so most travelers never see it; (b) presented before the handoff, when the traveler has no reason to save anything; (c) an *offer* id, not a booking reference — it identifies the rate expaify showed, which is exactly what a support agent needs to reconstruct what the traveler bought, but nothing in the copy tells the traveler that or asks them to keep it. It is never re-surfaced after return.

### 5. The fields that would make a durable record meaningful are never populated

`BookingHotelContext` defines `checkIn`, `checkOut`, `nightCount`, `priceCheckedAt`, `returnUrl` (`lib/booking/config.ts:52-75`), and `parseStayContinuity` validates them — but **no caller passes the `continuity` argument** (documented and verified in `docs/pipeline/hotel-booking-handoff-trust/01-discovery.md`). The review screen hardcodes "Stay dates not provided" (`BookingFlow.tsx:339-342`).

This matters here beyond the handoff-trust ticket: **a stay with no dates cannot anchor a cancellation deadline, cannot be ordered in a trip list, and cannot tell a returning traveler which stay they are looking at.** Any durable post-booking artifact depends on that fix landing first. This is a hard sequencing dependency, not a duplicate scope.

### 6. The flight path proves the same gap, and is not a safe model to copy

`BookingFlow.tsx:1420-1447` shows a real confirmation: "Booking confirmed", a Duffel `bookingReference` in 24px mono. But `bookingRef` is `useState` (`:1358`) and `app/api/book/route.ts:213-214` returns `bookingReference` and `orderId` **without persisting either**. One refresh and a real, paid, ticketed order becomes unrecoverable from expaify. The confirmation surface expaify already ships is itself non-durable — so "make hotels look like flights" would import the defect rather than fix it.

## Measurable signal

The problem is present when all of the following hold, each checkable today:

1. **Zero booking persistence.** `grep -i "booking\|reservation\|order" lib/db/schema.sql` returns no table definition. No route under `app/api/` writes a hotel booking.
2. **Return prompt asks nothing about booking outcome.** The only strings rendered after `visibilitychange` (`BookingFlow.tsx:1126-1127`) concern price mismatch.
3. **State does not survive reload.** No `localStorage`, cookie, or DB write backs `showReturnPrompt`; re-entering the `/book` URL renders the pre-handoff screen.
4. **No account surface lists a stay.** `app/account/AccountClient.tsx` has no bookings branch; `app/api/account/` has two routes, neither of them bookings.
5. **Offer reference is collapsed and pre-handoff only.** `BookingFlow.tsx:1326` is a closed `<details>`; the string never appears in any post-return branch.

**Instrumentation to add** (analytics infrastructure exists — `emitAnalytics`, `app/api/analytics/route.ts`, `product_analytics_events`):

- Volume of support contacts categorised "did my booking go through" / "where is my confirmation", and **time-to-first-contact after `hotel_handoff_returned`** (the ticket's named metric). The existing `awayDurationBucket` on `hotel_handoff_returned` (`:995-999`) is already a usable proxy for "long enough to have completed checkout".
- Rate of repeat `hotel_handoff_continue_clicked` for the same `offerId` by the same session/user within 24h — the double-booking signal from §3.
- Rate at which returning travelers re-open the same `/book` URL with no intervening search.

## Constraints the solution must respect

1. **Affiliate-model integrity (data integrity + legal).** expaify does not receive partner confirmation numbers, cancellation deadlines, or property contact details from a handoff. The solution must never display, imply, or promise a reservation status expaify cannot observe. It may only state what expaify knows (an offer was shown, a handoff occurred) and help the traveler secure what the partner gave them. Any wording that reads as "your booking is confirmed" is out of bounds for hotels.
2. **Non-negotiable contract.** No vendor API calls outside `lib/providers`; money stays `{ priceCents, currency }`; adapters return `Result<T>`; secrets from env only; affiliate markers preserved on every outbound link, including any re-issued "return to partner" link. Repair mode: prefer surfacing and persisting data expaify already has over new provider integrations.
3. **Accessibility and 375px usability.** The return state must be announced (live region / focus management), reachable by keyboard, and legible at 375px without overlap. `HotelHandoffReview` is already a dense screen; a post-booking state must not simply append another panel to the bottom of it.

## Success statement

This is solved when a first-time traveler who books a hotel through an expaify handoff can, on returning to expaify, immediately see that expaify does not hold their reservation, know exactly what to capture from the partner's confirmation while it is still open, and find their way back to the stay and the offer reference on a later visit — without contacting expaify support to ask whether the booking went through.

## Downstream focus for UXR-HOTEL-BOOKING-CONFIRMATION-01

Research should audit the return path and define testable directives for:

- **The return moment.** What replaces / precedes "Did the partner details match?" when `hotel_handoff_returned` fires with a long `awayDurationBucket`. Reference patterns: Booking.com's post-checkout confirmation summary and Google Flights' "booking completed on partner site" return handling — at the interaction level (what the intermediary asserts vs. defers), not visual style.
- **Booked-vs-bounced disambiguation.** expaify cannot observe the outcome. Determine whether to ask the traveler directly, branch on away-duration, or present a single outcome-agnostic state — and what each costs in accuracy and trust.
- **The capture checklist.** Exactly which fields a traveler must record from the partner confirmation (confirmation number, cancellation deadline, property phone), framed as *what to save*, never as *what expaify knows*.
- **Durability mechanism.** The minimum artifact that survives a reload: `localStorage` stay stub, a signed return URL, or an authenticated record — evaluated against constraint 1 and against the fact that a stay stub is worthless until `parseStayContinuity` is actually wired (§5). State the dependency explicitly.
- **Offer reference relocation.** Whether `offerId` moves out of the collapsed pre-handoff `<details>` into the post-return state, and the copy that makes a traveler save it.
- **Repeat-visit behaviour.** What `/book?kind=hotel` renders for a traveler who already handed off on that `offerId`, so expaify stops inviting a duplicate booking.
- **Flight parity note.** Whether the non-durable `bookingRef` (§6) is in scope for a follow-up ticket. Do not fold it into this feature.
