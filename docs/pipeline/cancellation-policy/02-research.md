# UX Research Brief — Cancellation Policy Confidence

**Ticket:** UXR-CANCELLATION-POLICY-01
**Stage:** UXR (UX Research)
**Author:** Senior UX Researcher
**Date:** 2026-07-21
**Upstream discovery:** `docs/pipeline/cancellation-policy/01-discovery.md` — **FILE MISSING ON DISK** (see Blockers). The discovery problem statement and source-verified findings embedded in the ticket description were used as the research input and are treated as authoritative for this brief.

---

## 1. Problem restated (from ticket)

Hotel results, the deal detail page, and the booking handoff never tell the user whether a stay is refundable, when a cancellation penalty begins, or whether payment is due now — until *after* they click toward the provider. The only cancellation copy in the app is a post-hoc disclaimer that says a policy *exists and will be confirmed by the provider*, never *what it is*. This erodes trust at the moment of the decision (the results card and the CTA).

**Central research question:** Does any available or realistically-upgradeable provider feed return cancellation / refund / prepayment data, and in what shape? And what is the minimum *honest* card-level signal we can show without implying a refundability we cannot prove?

---

## 2. Current-code audit (evidence, not assumption)

All findings below were read directly from source in this worktree.

### 2.1 The data model carries zero policy fields
`lib/types.ts` — `HotelOffer` (lines 137–151) has: `id, name, area, location, stars, pricePerNight, priceBasis, rating, photoUrl, deeplink, source, hotelClass, guestRating`. There is **no** cancellation, refund, refundable, prepayment, deposit, or payment-timing field anywhere on `HotelOffer` or on any type it references. `NormalizedHotelOffer` is a pure alias (line 153).

### 2.2 The provider never parses policy data — and the API is dead
`lib/providers/hotellook.ts` calls `https://engine.hotellook.com/api/v2/cache.json` (line 5). The response interface `HotelLookCacheEntry` (lines 10–28) models only: `hotelId, hotelName, stars, location, address, distance, priceFrom, photoUrl, propertyType`. **No rate-level object exists** in the parse path, so there is nowhere a `refundable` / `cancellation` field could even land. `cache.json` is a *cheapest-price cache* endpoint (one `priceFrom` per hotel); it returns no room/rate breakdown at all.

Independently confirmed by web research: the **entire Hotellook affiliate API (widgets, landing pages, `engine.hotellook.com`) was shut down on 20 October 2025**; surviving affiliate links now redirect to Booking.com. This matches the file map's own note that `hotellook.ts` is a "dead API, returns empty." **Conclusion: the current feed can never be the source of policy data — it returns nothing at all.**

### 2.3 The only cancellation copy is a post-hoc, content-free disclaimer
Three locations, all say a policy *exists* but never *what it is*, and all appear only after the user has committed to a handoff:
- `app/deals/[dealId]/page.tsx:332` — "Nightly rate before taxes and fees. Taxes, fees, cancellation policy, and final total are confirmed by the provider."
- `app/book/BookingFlow.tsx:18` (`hotelTermsCopy`), re-used at `:486`, `:493`, `:504`, `:510` — "Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms."
- `app/components/HotelCard.tsx:417` (`providerConfirmationCopy`) — same sentence, surfaced only inside the *expanded* "Provider handoff" block (`:576`–`:577`), never on the collapsed card.

None of these is a *signal*; all are a *deferral*. The word "cancellation" appears, but it carries no decision value.

### 2.4 There is a proven honest-confidence pattern to reuse
`HotelRatingEvidence` (`lib/types.ts:109–117`) pairs a `kind` with a `confidence` of `verified | provider_only | inferred | unavailable`. `HotelCard.tsx` already renders this pattern honestly:
- Collapsed **chip row** at `HotelCard.tsx:449–470` holds a hotel-class chip and a guest-rating chip side by side.
- Chip **styling encodes confidence**: a `verified` guest rating gets the green `--success` treatment (`:462–464`); anything unverified falls back to muted neutral (`:464`), and unconfirmed values are *withheld* rather than shown as a rating (`getGuestRatingCollapsedText` returns `null`, `:187–206`).
- The expanded `QualityEvidencePanel` (`:309–362`) spells out value, source, review count, **Confidence**, and **Updated** — one tap from the card.

This is the template. Cancellation confidence should be a third member of the same family, not a new invention.

---

## 3. Can a realistic upgraded feed return policy data? (RQ1)

Current feed: **no** (dead, and price-cache-only). Realistic upgrade paths, ranked by shape quality — grounded in vendor docs, not assumed:

| Feed | Refundability shape | Deadline | Prepayment | Notes |
|------|--------------------|----------|-----------|-------|
| **Duffel Stays** | `rate.cancellation_timeline[]` — empty array ⇒ **non-refundable**; items carry `before` (UTC deadline) + `refund_amount` (compare to `rate.total_amount`: equal ⇒ full refund, less ⇒ partial). | ✅ `before` | Rate conditions describe payment requirements | Cleanest structured shape. Duffel is already a confirmed provider in this repo (`lib/providers/duffel.ts`, `DUFFEL_KEY`). Duffel Stays is a distinct product from the flight API in use today. |
| **Amadeus / Hotelbeds hotel search** | `policies.cancellation` with deadline + penalty amount; `policies.paymentType` / `guarantee` / `deposit`. | ✅ | ✅ | `AMADEUS_ID/SECRET` already reserved in the contract; `amadeus.ts` is stubbed. |
| **Booking.com Demand API** | Cancellation policies + prepayment/deposit per rate. | ✅ | ✅ | Requires partner access; highest-fidelity but heaviest onboarding. Where Hotellook traffic now redirects. |

**Finding:** structured, honest cancellation/refund/prepayment data *is* obtainable, but **only via a live-rate provider (Duffel Stays / Amadeus), not via any Travelpayouts cache endpoint.** The most contract-aligned path is **Duffel Stays**, because Duffel credentials and a provider adapter already exist. This is a DEV-stage dependency, not a UI-stage one: **the honest-absence UI must ship first and must remain correct while every live offer's policy is `unavailable`.**

---

## 4. Competitive teardown — card vs detail (RQ2)

Interaction pattern (not visual style):

- **Booking.com** surfaces refundability *at the card level* with two short, high-contrast phrases: **"Free cancellation"** and **"No prepayment needed – pay at the property"** (green, near the rate). Non-refundable rates are labelled plainly. The *exact deadline date* ("Free cancellation until 24 July") and the penalty schedule live one level deeper, on the rate/detail view. Confirmed by research: Booking.com is deliberately explicit about non-refundable and pay-at-property states at the point of choice.
- **Google Hotels** shows a compact **"Free cancellation"** chip on the result card alongside price and rating chips; tapping through reveals the dated deadline and full policy. Absence of the chip is *not* dressed up as anything — unknown reads as unknown.

**Common rule both follow:** the card answers **"is it refundable, yes/no?"** in ≤3 words; the **date** and **payment timing** are a one-tap reveal. Neither invents a positive signal when the feed doesn't supply one. This maps exactly onto expaify's existing collapsed-chip → expanded-panel structure.

---

## 5. The exact gap

| Dimension | Reference (Booking / Google) | expaify today | Delta |
|-----------|------------------------------|---------------|-------|
| Refundable yes/no on card | Explicit chip | Nothing | **Missing entirely** |
| Cancellation deadline date | One tap from card | Nothing (only "provider confirms") | **Missing entirely** |
| Pay now vs pay later | Card-level phrase | Nothing | **Missing entirely** |
| Honest absence | Chip simply absent / neutral | N/A — but disclaimer implies a policy is "confirmed," which reads as reassurance | **Wrong: deferral is mistaken for safety** |
| Data model support | Rate-level policy object | No field on `HotelOffer` | **Missing type** |

---

## 6. Design directives (specific, testable — for UXDES)

> Card level answers **(a) refundable?**. One tap answers **(b) deadline** and **(c) pay now/later**. This satisfies the discovery success criterion ("card + one tap of detail") using the existing collapsed-chip → expanded-panel structure.

**D1 — Add a policy-confidence evidence type mirroring `HotelRatingEvidence`.**
Testable shape (final naming is UXDES/DEV's to confirm, but must carry these fields):
```
CancellationEvidence {
  kind: 'free_cancellation' | 'partial_refund' | 'non_refundable' | 'unknown'
  confidence: 'verified' | 'provider_only' | 'inferred' | 'unavailable'
  freeUntil?: string          // ISO deadline for penalty start
  refundAmount?: Money         // partial-refund case
  prepayment?: 'pay_now' | 'pay_at_property' | 'deposit' | 'unknown'
  sourceLabel?: string
  fetchedAt?: string
}
```
Add as optional `cancellation?: CancellationEvidence` on `HotelOffer`. Optional so nothing breaks while the feed supplies nothing (the ship-first constraint from §3).

**D2 — One card-level chip in the existing chip row (`HotelCard.tsx:449–470`), styled by confidence.** Exactly one chip, added after hotel-class/guest-rating so the row order is: class · rating · policy. Required states and copy:

| kind / confidence | Chip copy | Style (reuse existing tokens) |
|---|---|---|
| `free_cancellation` + `verified` | `Free cancellation` | green — `--success-soft` / `--success`, like verified rating chip |
| `non_refundable` + `verified` | `Non-refundable` | neutral-strong — `--warning-soft` / `--warning` (caution, not alarm) |
| `partial_refund` + `verified` | `Partial refund` | neutral — `--bg-muted` / `--text-2` |
| any kind + `provider_only` | `Refundable — confirm terms` (or `Cancellation terms at provider` for unknown kind) | muted neutral, **never green** |
| `unavailable` / `unknown` / field absent | `Cancellation policy not shown` | muted neutral `--bg-muted` / `--text-3` |

**D3 — Honest-absence is a hard rule.** When `confidence` is `unavailable` (the default state for every live offer until a policy feed lands), the chip must:
- never use the green/`--success` treatment,
- never contain the word "free," "refundable," or "flexible,"
- read as *absence of information*, not as *presence of a lenient policy*.
This directly enforces the discovery comprehension criterion: *an honest-absence state must not be misread as refundable.*

**D4 — Detail panel carries the date and payment timing (one tap).** Add a `Cancellation` block to the expanded card modelled on `QualityEvidencePanel` (`HotelCard.tsx:309–362`), with rows:
- **Refundability** — e.g. "Free cancellation" / "Non-refundable" / "Not provided by this source"
- **Cancel by** — dated deadline (`freeUntil`) when present, else "Deadline not provided"
- **Payment** — "Pay now" / "Pay at property" / "Deposit required" / "Payment timing not provided"
- **Confidence** — "Verified with provider" / "Provider value, terms not confirmed" / "No policy evidence from this source"
- **Updated** — `fetchedAt` or "Freshness not provided"

**D5 — Replace the misleading post-hoc disclaimer with an honest deferral, and keep it consistent across the three surfaces.** The existing "…cancellation policy…confirmed by the provider" sentences (`deals/[dealId]/page.tsx:332`, `BookingFlow.tsx:18`, `HotelCard.tsx:417`) must not be the *only* mention. When policy data is `unavailable`, the copy should state plainly that expaify does not yet have the cancellation policy for this rate and the user must check it on the provider page **before** paying — framed as missing information, not as reassurance.

---

## 7. Analytics directives (RQ4 — extend `lib/analytics.ts` `track()`)

`track()` today is `track(event: string, props?: Record<string, string|number|boolean>)` (no-op outside dev). No signature change needed; add events. To measure the discovery success metric (CTA abandonment ↓, refundable-rate click-through), every event must carry `policyKind` and `confidence` so click-through can be segmented by refundability:

| Event | Props | Measures |
|---|---|---|
| `hotel_policy_signal_viewed` | `hotelId, policyKind, confidence` | How often each policy state (incl. honest-absence) is shown |
| `hotel_policy_detail_expanded` | `hotelId, policyKind` | Whether users open the detail for the date/payment answers |
| `hotel_cta_click` | `hotelId, policyKind, confidence` | **Refundable-rate click-through** — segment CTA clicks by refundability |
| `hotel_policy_absent_cta_click` | `hotelId` | Click-through specifically on honest-absence cards (trust check) |

CTA *abandonment* is derived: `hotel_policy_signal_viewed` without a matching `hotel_cta_click` in-session, segmented by `policyKind`. No timer event required.

---

## 8. Comprehension test plan (for TEST stage)

**Setup:** show a hotel card in each of the five D2 states; allow at most one tap ("Details") before answering.

**Participant tasks — for each card, the user states:**
- (a) Is this stay refundable?
- (b) By what date must you cancel to avoid a penalty?
- (c) Is payment due now or later?

**Pass criteria:**
1. For `verified` states, the user answers (a), (b), (c) correctly from card + one tap, **without opening the provider site**.
2. For the `unavailable` / honest-absence card, the user must answer (a) with "not stated / I don't know" — **and must NOT express false confidence that it is refundable.** A user reading absence as "refundable" or "free to cancel" is a **FAIL**, even if the visual is otherwise clean.
3. No card implies a refund policy the underlying `confidence` does not support (`provider_only` and `unavailable` must never read as `verified`).

---

## 9. Blockers & out-of-scope findings

- **BLOCKER (non-fatal): discovery doc missing on disk.** `docs/pipeline/cancellation-policy/01-discovery.md` does not exist; the directory did not exist before this brief created it. The ticket description embedded the discovery problem statement and source-verified findings, which were used as input. UXD should back-fill `01-discovery.md` for the record; nothing in this brief depended on unavailable discovery content.
- **Out of scope — provider dependency (flag for DEV/roadmap):** the whole feature is data-gated. The current Hotellook feed is dead and cannot supply policy data; a live-rate provider (Duffel Stays preferred, Amadeus second) is required for any `verified` state. **The UI in §6 must ship and be correct in the `unavailable`-everywhere state first.** This is a DEV-stage ticket, not a UI-stage one, and should be tracked separately so UI work is not blocked on provider onboarding.
- **Out of scope — contract note:** any policy data must flow through `lib/providers` and money in `refundAmount` must be `{ priceCents, currency }` (never a float), consistent with the non-negotiable contract. Called out here so DEV does not model refund amounts as bare numbers.

## Sources
- [FAQ on the closure of Hotellook – Travelpayouts](https://support.travelpayouts.com/hc/en-us/articles/29534131568530-FAQ-on-the-closure-of-Hotellook)
- [The Closure of Hotellook: What Travelers Need to Know](https://skaiya.com/hotellook/)
- [Hotels data API – Travelpayouts](https://support.travelpayouts.com/hc/en-us/articles/115000343268-Hotels-data-API)
- [Duffel — Displaying the Cancellation Timeline](https://duffel.com/docs/guides/displaying-the-cancellation-timeline)
- [Duffel — Stays key concepts](https://duffel.com/docs/api/overview/stays-key-concepts)
- [Booking.com for Partners — Cancellation, deposit, and prepayment policies](https://partner.booking.com/en-us/solutions/cancellation-deposit-and-prepayment-policies)
