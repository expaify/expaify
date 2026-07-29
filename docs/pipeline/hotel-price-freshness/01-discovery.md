# UXD-HOTEL-PRICE-FRESHNESS-01 — Hotel Price Freshness Confidence

**Stage:** UX Discovery
**Feature slug:** `hotel-price-freshness`
**Priority:** P0
**Date:** 2026-07-29

---

## 1. Problem Statement

A shopper cannot tell whether a displayed hotel price is still actionable, because expaify shows the same nightly rate with three different freshness stories — a relative timestamp with no age limit on the deal card, a threshold-based warning on deal detail, and a hardcoded "last-checked time unavailable" on every hotel result and on the final screen before the outbound handoff.

The rate is the only number on the page the user is asked to act on, and it is the one number whose age the product cannot currently state on two of its three hotel surfaces.

---

## 2. Who Is Affected, And Where

| Surface | User | What they see today |
|---|---|---|
| Deal feed card (`app/components/ui/DealCard.tsx:117-124`) | Shopper scanning for a deal | `Price checked {timeAgo}` — relative, unbounded, calm styling at any age. Line is omitted entirely when `updatedAt` is null. |
| Deal detail (`app/deals/[dealId]/page.tsx:273-304, 384-390`) | Shopper evaluating one property | Four-state model: fresh / aging (≥30h) / stale (≥48h) / unknown, plus expired. Warning copy tells them to reconfirm with the provider. |
| Hotel result card + expanded detail (`app/components/HotelCard.tsx:746, 763, 765-766, 1048-1049`) | Shopper comparing live hotel search results | `Rate from {provider}. Last-checked time unavailable.` — hardcoded string constant, identical for every offer, always. |
| Booking review before handoff (`app/book/BookingFlow.tsx:353`) | Shopper one click from leaving expaify | `Last-checked time not provided.` rendered in `var(--warning)`, immediately under the nightly rate. |

The break lands hardest at the last two steps: the moment of highest commitment carries the weakest freshness claim in the product. A user who read "Price checked 12m ago" on the feed reaches booking review and is told the last-checked time is *not provided* — the disclosure degrades as the user advances.

---

## 3. Measurable Signal That The Problem Exists

Six verifiable facts in the current code, not opinions:

1. **`HotelOffer` carries no price-level timestamp.** `lib/types.ts:474-495` defines `pricePerNight`, `priceBasis`, `source`, and per-attribute evidence with `fetchedAt` on `hotelClass`, `guestRating`, `amenityEvidence`, `fundsPolicy`, and `rateEligibility` — but no `fetchedAt` on the offer or on the price. Freshness is modelled for the star rating and not for the money.

2. **The provider already computes the timestamp and discards it for pricing.** `lib/providers/hotellook.ts:492` sets `const fetchedAt = new Date().toISOString()` and attaches it only to `buildHotelClassEvidence` (line 525) and `buildGuestRatingEvidence` (line 530). The same fetch that produced `priceCents` has a verified timestamp available and drops it.

3. **Cached offers replay with no age marker.** `lib/providers/hotellook.ts:18` sets `CACHE_TTL = 21600` (6h) and the cache-hit branch at lines 459-470 returns normalized offers directly. A displayed nightly rate can be up to six hours old with zero disclosure anywhere in the UI.

4. **The "unavailable" copy is a constant, not a state.** `HotelCard.tsx:746` is a template literal with the words baked in. It cannot ever resolve to a real time, including in the screen-reader path (`:763`, `:765-766`), because there is no field for it to read.

5. **Thresholds exist on exactly one surface.** `app/deals/[dealId]/page.tsx:276-277` defines aging at ≥30h and stale at ≥48h. Neither constant is shared, exported, or applied to `DealCard`, `HotelCard`, or `BookingFlow`. Three surfaces, three unrelated behaviours, one underlying price.

6. **Freshness is not measurable at the decision points.** `HotelDecisionAnalytics.tsx:8, 58` emits `price_freshness_state` from deal detail only. Card impressions and outbound handoff clicks (`app/components/ui/CompareRow.tsx`) carry no freshness dimension, so today we cannot answer "do stale prices convert differently?" The complementary signal already exists but is unjoined: `BookingFlow.tsx:37, 44` collects a `price_or_fees_mismatch` return reason with no freshness attribute attached.

**Baseline instrumentation gap:** items 5 and 6 mean the three metrics named in this ticket — stale-price complaints, handoff conversion, price-mismatch returns — currently cannot be segmented by price age. Establishing that segmentation is part of the deliverable, not a follow-up.

---

## 4. Constraints The Solution Must Respect

1. **Data integrity — verified snapshots only.** A freshness label may be derived only from a timestamp the provider fetch actually produced. No inferred, defaulted, or "assume now" timestamps. When no verified timestamp exists, the honest unknown state must be shown; it must not be styled as reassurance.

2. **No promise the provider cannot honour.** expaify does not hold, lock, or guarantee hotel rates. Copy must separate "when expaify last checked" from "what the provider will charge." Nothing may imply a price hold, a countdown to a guaranteed price, or a fixed total. The existing separation in `HotelCard.tsx:747` ("Provider confirms final total, taxes, fees, room availability…") is the correct boundary and must survive.

3. **Performance — no blocking re-check.** The 6h `CACHE_TTL` and the cached-response path stay. Disclosure must be computed from data already in the payload, with no added network round-trip before results render.

4. **Accessibility.** Freshness must reach screen readers in the same context as the price and the CTA, and must never be conveyed by colour alone — `BookingFlow.tsx:353` currently signals concern purely through `var(--warning)`.

5. **Mobile 375px.** The disclosure sits beside price, Deal Score badge, and primary CTA on the result card. It must not wrap into or crowd those three, and must not push the CTA below the fold.

---

## 5. Success Statement

**This is solved when a first-time user can look at any hotel price in expaify — feed card, hotel result, hotel detail, or booking review — and know how old that price is and what could change before they book, without ever seeing a price whose age the product refuses to state or quietly hides.**

---

## 6. Target Thresholds And Metrics

Downstream stages must land on a single shared threshold model. The existing 30h/48h pair from deal detail and the 6h cache TTL are the starting evidence; research must confirm or replace them, but the output must be **one** set of constants used by all four surfaces.

Candidate bands to validate:

| Band | Age of verified snapshot | Required disclosure posture |
|---|---|---|
| Fresh | ≤ cache TTL (6h) | State the age. No warning. |
| Aging | > 6h and < 48h | State the age plus an explicit reconfirm instruction. |
| Stale | ≥ 48h | State the age plus change-risk warning; price must not read as actionable without reconfirmation. |
| Unknown | No verified timestamp | State plainly that the check time is not available. Never silent, never styled as fresh. |
| Expired | Past `expires_at` | Existing expired treatment; freshness is moot. |

Measurable outcomes:

- **Coverage:** % of rendered hotel prices carrying a verified timestamp — from 0% on `HotelCard` and `BookingFlow` today to a stated, monitored figure.
- **Handoff conversion by freshness band:** outbound click-through segmented by band. Requires adding the freshness dimension to card-impression and `CompareRow` handoff events.
- **Price-mismatch returns:** rate of `price_or_fees_mismatch` (`BookingFlow.tsx:37`) joined to the freshness band shown at handoff. The expected relationship — mismatches concentrate in aging/stale — is the falsifiable test that the bands are drawn in the right place.
- **Silent-omission rate:** occurrences of a price rendered with no freshness statement of any kind. Target: zero.

---

## 7. Scope Boundary

**In scope:** deal feed card, hotel result card and expanded detail, deal detail page, booking review before outbound handoff; the shared freshness state model, its thresholds, its copy, and the instrumentation needed to measure the three named signals.

**Out of scope for this feature:** flight fare freshness — `lib/providerFreshness.ts` already covers it via `flightFreshnessLabel`, `flightPriceCheckCopy`, and `fareFreshnessSummary`, and is the reference implementation to align with rather than duplicate. Also out of scope: rate-hold or price-guarantee features (constraint 2 forbids them), and provider re-check on render (constraint 3 forbids it).

**Known upstream dependency to flag, not to design here:** adding a verified price timestamp to `HotelOffer` and populating it in `lib/providers/hotellook.ts` is a DEV-stage change. Every UI state in this feature depends on it, and the "unknown" state must remain a first-class, permanently-supported state regardless — `lib/providers/bookingComRapidApi.ts` is not returning offers today, and future providers may not supply a timestamp at all.

**Related prior work:** `docs/pipeline/provider-freshness-timestamp-clarity/` established general provider/timestamp display and explicitly deferred the hotel gap ("does the normalized hotel type need a real freshness field"). This feature answers that question for hotels and adds the change-risk and handoff dimensions it did not cover.

---

## 8. Handoff

Next stage: **UXR-HOTEL-PRICE-FRESHNESS-01** — audit the four surfaces above against the flight freshness implementation in `lib/providerFreshness.ts` and one or two external reference patterns (Booking.com rate-change disclosure, Google Hotels last-updated behaviour), then produce testable directives for a single shared hotel freshness model.
