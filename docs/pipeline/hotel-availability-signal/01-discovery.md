# UXD-HOTEL-AVAILABILITY-SIGNAL-01 — Hotel Availability Confidence

**Stage:** UX Discovery
**Feature slug:** `hotel-availability-signal`
**Priority:** P0
**Date:** 2026-07-29

---

## 1. Problem Statement

**expaify presents every hotel result as a bookable rate — a nightly price, a provider name, and a "Review hotel" button — when the only hotel adapter in production returns an area-level cached "price from" figure with no room, no rate identity, and no availability semantics at all, so a traveler cannot tell the difference between a rate someone can actually book today and a cached indicative minimum that may not exist for their dates.**

The gap is not that availability is unknown. It is that **the product renders unknown availability with the same visual and copy treatment as confirmed availability**, and only discloses the uncertainty in a deferral sentence buried behind a "Details" toggle.

---

## 2. Who Is Affected, And Where The Flow Breaks

The user is a first-time or returning shopper who searched a destination with dates and is comparing hotel results. Three surfaces, in the order they are hit:

### Surface 1 — Deal feed / search results (`app/components/HotelCard.tsx`)

What renders per offer:

| Element | Code | What it implies |
|---|---|---|
| `Nightly rate` label + large price | `HotelCard.tsx:352-357` | A specific, current rate |
| `per night before taxes and fees` | `HotelCard.tsx:359` | A price basis, i.e. a real quote |
| `Rate from {provider}` | `HotelCard.tsx:360` | A provider stands behind this number |
| `Last-checked time unavailable` | `HotelCard.tsx:361` (hardcoded) | The one honest line — but it is about *time*, not *availability* |
| `Review hotel` primary CTA | `HotelCard.tsx:943-959` | This is bookable; proceed |

What the provider actually returned (`lib/providers/hotellook.ts`):

- The endpoint is `https://engine.hotellook.com/api/v2/cache.json` (`hotellook.ts:17`). It is a **cache** endpoint. The field consumed is `priceFrom` (`hotellook.ts:412-423`) — a minimum observed price for the property, not a quote for a room on the requested dates.
- The response carries **no room count, no rate identifier, no availability flag, no booking-eligibility field**. `HotelLookCacheEntry` (`hotellook.ts:22-41`) declares every field the adapter reads; none of them are availability.
- `coverage` is hardcoded `'unconfirmed'` on **every** return path — cache hit (`hotellook.ts:466`), empty result (`hotellook.ts:489`), and fresh fetch (`hotellook.ts:547`). The adapter never claims coverage it does not have, which is correct — and the UI never surfaces the value.
- The offer is cached for **6 hours** (`CACHE_TTL = 21600`, `hotellook.ts:18`) keyed only on `location:checkin:checkout` (`hotellook.ts:455`). The same rate can be served to a user 5h59m after it was fetched.
- `HotelOffer` (`lib/types.ts:474-496`) has **no `fetchedAt` field on the offer or on `pricePerNight`**. `fetchedAt` exists on `hotelClass`, `guestRating`, `rateEligibility`, and other evidence sub-objects — but not on the rate itself. This is why `HotelCard` can only hardcode `Last-checked time unavailable` (`HotelCard.tsx:361, 379, 746`): the timestamp is genuinely absent from the data contract, not just unrendered.

**The API stream then labels this `available`:**

```
send({ type: 'hotel-status', status: 'available', coverage: page.coverage });
```
`app/api/search/route.ts:407` — emitted on the sole condition `hotelsResult.data.offers.length > 0` (`route.ts:405`). The word "available" is derived from **array length**, not from any availability check. This is the single most misleading line in the hotel path.

### Surface 2 — Expanded card detail (`HotelCard.tsx:1045-1069`)

Two panels touch the question and both defer:

- **Rate check:** `Rate from {provider}. Last-checked time unavailable.` (`HotelCard.tsx:746, 1048-1049`)
- **Provider handoff:** `Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.` (`HotelCard.tsx:747, 1066-1069`)

The handoff sentence is factually correct and it is the only place the word "availability" appears to the user. But it is (a) behind a collapsed `Details` toggle, (b) framed as a list of things that happen *later*, and (c) identical for every offer regardless of what the provider returned. It tells the user nothing decision-relevant: it never distinguishes an offer whose rate the provider confirmed from one where the provider returned a six-hour-old area minimum.

Compare this to how the same component handles other unknowns. Access evidence has four explicit states with distinct copy and styling (`confirmed` / `unavailable` / `unknown` / `not_returned`, `HotelCard.tsx:118-139, 220-257`). Guest ratings have a four-level confidence ladder (`verified` / `provider_only` / `inferred` / `unavailable`, `HotelCard.tsx:563-577`). Funds policy, smoking policy, parking, and rate eligibility each have a `not_provided` state that renders explicitly. **Availability — the precondition for every one of those facts mattering — has no state model at all.**

### Surface 3 — Booking review, last screen before handoff (`app/book/BookingFlow.tsx`)

- `The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.` (`BookingFlow.tsx:1094`) — the same deferral, restated at the point of highest commitment.
- After the user returns, an optional prompt asks *"Did the partner details match?"* with `room_availability_mismatch` as a selectable reason (`BookingFlow.tsx:39, 47, 1043-1085`).

That reason option is the product already admitting this failure mode exists. But it fires **after** the user lost the trip, it is **optional**, it is gated on `showReturnPrompt` (`BookingFlow.tsx:851, 1043`), and `handleReturnFeedback` (`BookingFlow.tsx:957-969`) only emits a client analytics event — nothing persists, nothing feeds back into the offer, nothing warns the next user looking at the same property.

### The trust arc

The disclosure gets weaker exactly as commitment gets stronger:

```
Feed        →  "Nightly rate $148" + "Review hotel"        (strongest claim, zero evidence)
Detail      →  "Provider confirms … room availability"     (deferral, collapsed)
Handoff     →  "The provider confirms … live availability" (same deferral)
Return      →  "Room availability did not match"           (post-loss, optional)
```

The user only learns availability was never checked at the point where they can no longer act on it.

---

## 3. Measurable Signals That The Problem Exists

Each of these is observable today without shipping anything new:

1. **`hotel-status: 'available'` is emitted with zero availability evidence.** `app/api/search/route.ts:405-407` gates the literal string `'available'` on `offers.length > 0`. Every hotel search that returns rows asserts availability the adapter never established. Rate: 100% of non-empty hotel searches.

2. **Every hotel offer in production carries `coverage: 'unconfirmed'`.** `hotellook.ts:466, 489, 547` — no code path can produce `'more_available'` or `'confirmed_end'` for hotels. The type `HotelSearchCoverage` (`lib/types.ts:499`) supports three states and the only hotel adapter uses one.

3. **Rate age is unrepresentable.** `HotelOffer` has no rate-scoped `fetchedAt` (`lib/types.ts:474-496`), so `HotelCard` hardcodes `Last-checked time unavailable` in three places (`HotelCard.tsx:361, 379, 746`) and `BookingFlow` renders `Last-checked time not provided` in `var(--warning)`. The string is a constant — it is not a computed fallback. Count of offers that can ever show a real rate age: **zero**.

4. **Cache serve-age is unbounded up to 6h and unmeasured.** `CACHE_TTL = 21600` (`hotellook.ts:18`) with no age recorded at write time (`hotellook.ts:542`), so neither the product nor telemetry can distinguish a 10-second-old rate from a 5-hour-old one.

5. **`hotel_room_handoff_started` has no outcome counterpart.** `app/components/HotelDecisionAnalytics.tsx:125` fires on handoff. There is no event recording whether the rate survived at the partner. `hotel_handoff_return_reason_selected` (`BookingFlow.tsx:960`) is the only outcome signal and it requires the user to voluntarily return, open a collapsed prompt, and pick a radio button. **Realistic capture rate: low single digits.** The denominator for "how often does a displayed rate fail at the partner" does not exist.

6. **The mock path is the only surface that admits non-bookability.** `Sample hotel — not bookable` (`app/components/ui/DealCard.tsx:121`). A synthetic offer gets a clearer bookability disclosure than a real one.

---

## 4. Constraints The Solution Must Respect

1. **Provider-backed only — no invented scarcity.** No "2 rooms left", no "booked 5 times today", no urgency copy of any kind. Hotellook's `cache.json` returns no inventory field (`hotellook.ts:22-41`); any room-count claim would be fabricated. This is a hard line: the product's entire differentiator is that its claims are evidenced, and the codebase already enforces this pattern rigorously (`notProvidedHotelSmokingPolicy`, `createNotReturnedHotelFundsPolicy`, `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED`). **Absence of evidence must render as an explicit, honest state — never as silence, and never as confidence.**

2. **Contract integrity.** Availability evidence is provider-shaped data: it enters through `lib/providers`, adapters return `Result<T>` and never throw, money stays `{ priceCents, currency }`, and affiliate markers survive on every deeplink (`hotellook.ts:434-436`). Any new field on `HotelOffer` must be optional so existing adapters (`bookingComRapidApi`, stubs) compile unchanged, and any new capability must follow the declared-capability precedent (`HotelRateEligibilityCapability`, `lib/types.ts:466-472`) so an adapter's *inability* to answer is distinguishable from a *negative* answer.

3. **Mobile-first density budget.** `HotelCard` already renders class, guest rating, access, location, parking, funds policy, pet policy, smoking policy, eligibility, score chip, and CTA above the fold. At 375px the price column is clamped to `min-w-[6.75rem] max-w-[9.5rem]` and reflows to `col-span-2` below 351px (`HotelCard.tsx:351, 894`). An availability signal must fit the collapsed card in **one line at most**, reuse existing tokens (`--warning`, `--warning-soft`, `--success`, `--bg-muted`, `--text-3`), and add no new colour or type scale. If it cannot fit in one line, it belongs in the expanded panel — but the *fact that availability is unverified* must survive to the collapsed card, because that is where the CTA lives.

4. **Accessibility parity.** Every existing hotel evidence state carries an `aria-label` with the full sentence and a source attribution (`HotelCard.tsx:225, 239, 251, 369`). An availability signal that is colour- or icon-only fails the bar set by the surrounding code. Status changes announced after load use `role="status" aria-live="polite"` (`HotelCard.tsx:288, 324`).

5. **MVP feasibility — no new vendor dependency.** The solution must work with what Hotellook returns today, which is *nothing about availability*. The honest MVP output is therefore mostly a **correctly-labelled `not_provided` state plus a rate-age signal**, with the type surface built so a future adapter that returns rate-scoped availability (Duffel Stays, Amadeus Hotel Offers, a Booking.com rate endpoint) can populate a confirmed state without a UI rewrite. If an on-demand per-offer recheck is proposed, `checkDocumentReadiness` (`lib/types.ts:538-540`, `hotellook.ts:555-561`) and its route `app/api/hotels/document-readiness` are the established precedent for a scoped, provider-backed, post-search verification call — reuse that shape rather than inventing one.

---

## 5. Success Statement

**This is solved when a first-time user scanning hotel results can tell, without expanding any panel, whether the displayed nightly rate has been confirmed as bookable for their dates or is an unverified cached figure — and never reaches the provider handoff having been shown "available" on evidence the product does not have.**

Concretely, at exit:

- No surface emits or renders the word "available" for an offer whose provider returned no availability evidence. `app/api/search/route.ts:407` no longer derives `status: 'available'` from `offers.length`.
- Every hotel offer carries a rate-scoped freshness timestamp, so `Last-checked time unavailable` becomes a genuine fallback for missing data rather than a hardcoded constant.
- The collapsed card states availability confidence in one line, with a full-sentence `aria-label` and a named source, at 375px and 1280px.
- Handoff volume can be divided by availability confidence state in telemetry, giving the first real denominator for how often expaify sends users to a rate that is not there.

---

## 6. Proposed Confidence Model (for UXR to validate, not to accept)

Three states, mirroring the codebase's existing evidence conventions. Names and copy are UXD's proposal; UXDES owns final strings.

| State | Populated when | User-facing meaning |
|---|---|---|
| `rate_confirmed` | Adapter returns an offer scoped to a specific room/rate for the requested dates, with a rate identity and a fetch timestamp | The provider quoted this rate for these dates |
| `indicative` | Adapter returns a price for the property but not scoped to a bookable rate — Hotellook's `priceFrom` (`hotellook.ts:412-423`) | A starting price for this property; the room and total are confirmed at the provider |
| `not_provided` | Adapter declares no availability capability, or returns nothing | This provider does not report room availability to expaify |

**Every Hotellook offer in production today is `indicative`.** That is the finding, and shipping it honestly is the deliverable — not manufacturing a confirmed state the data cannot support. `rate_confirmed` should exist in the type from day one and be unreachable until an adapter earns it, following the `HotelRateEligibilityCapability` precedent where capability is declared per-adapter and the UI degrades on mismatch.

Rate age is a **separate axis** from confidence and must not be collapsed into it: a 30-second-old indicative price and a 5-hour-old indicative price are both indicative, but only one should carry a warning treatment.

## 7. Proposed Event Plan (for UXR/UXDES to refine)

The goal is a denominator. Today handoff volume is countable and handoff *outcome* is not.

| Event | Fires | Key props |
|---|---|---|
| `hotel_availability_state_shown` | Once per offer entering the viewport on the results surface | `offerId`, `provider`, `state`, `rateAgeBucket`, `surface` |
| `hotel_room_handoff_started` (extend existing, `HotelDecisionAnalytics.tsx:125`) | Unchanged trigger | add `availabilityState`, `rateAgeBucket` |
| `hotel_handoff_return_reason_selected` (existing, `BookingFlow.tsx:960`) | Unchanged trigger | add `availabilityState`, `rateAgeBucket` so self-reported mismatches attribute to the state that was shown |

`rateAgeBucket` should be coarse (`<15m` / `<1h` / `<6h` / `unknown`) — precise timestamps in analytics props add no decision value and increase payload size on every card impression. Existing helpers `formatRelativeFreshness` and `validFreshnessDate` (`lib/providerFreshness.ts:39-66`) already do the date-safety work and should back both the UI copy and the bucketing.

---

## 8. Scope Boundaries

Adjacent pipelines exist and this ticket must not absorb them:

| Adjacent feature | Its question | Why it is not this ticket |
|---|---|---|
| `hotel-price-freshness` | *How old is this price?* | Freshness is the **age** axis. This ticket is the **bookability** axis. They share a missing timestamp — flagged below — but a fresh rate can still be unbookable and a 5-hour-old rate can still be bookable. |
| `provider-freshness-timestamp-clarity` | *How is the timestamp worded across surfaces?* | Presentation of an existing signal, not the availability model. |
| `sold-out-recovery` | *A saved deal is gone — where do I go now?* | Post-failure recovery on `/deals/[dealId]`. This ticket is pre-failure disclosure on live search results. |
| `real-deal-inventory` | *Why is the production feed serving mocks?* | Collection-pipeline and quota failure, an ops problem upstream of any UI signal. |
| `hotel-total-stay-cost` | *What is the full stay total?* | Price composition, not availability. |

**Shared dependency, flagged for coordination:** the missing rate-scoped `fetchedAt` on `HotelOffer` (`lib/types.ts:474-496`) blocks both this ticket and `hotel-price-freshness`. It is one optional field on one interface. UXR should confirm with the `hotel-price-freshness` line whether that field is already specified there before this ticket's DEV stage proposes it, so the two do not land conflicting shapes on the same interface.

---

## 9. Handoff

Next stage: **UXR-HOTEL-AVAILABILITY-SIGNAL-01** — UX Research.

Questions UXR should answer:

1. Audit `lib/providers/bookingComRapidApi.ts` and the Duffel adapter for any availability- or rate-scoped field currently discarded in normalization. This discovery confirmed Hotellook returns none; the other adapters were not audited field-by-field and may already carry usable signal.
2. Compare against Booking.com and Google Hotels at the **interaction-pattern** level: how does each distinguish a confirmed rate from an indicative one in a results list, and how does each handle a rate that fails between list and handoff? Ignore their scarcity/urgency patterns — constraint 1 rules those out.
3. Resolve whether the collapsed card can carry a fourth evidence line at 375px given the existing density (`HotelCard.tsx:906-937`), or whether the signal must attach to the existing price block (`HotelCard.tsx:349-365`).
4. Confirm the `fetchedAt` dependency with the `hotel-price-freshness` line before specifying a type change.
5. Produce 3–5 testable directives covering: the `hotel-status: 'available'` correction in `app/api/search/route.ts:405-407`, the collapsed-card state copy, the expanded-panel copy, and the event props.
