# UXR-HOTEL-PAYMENT-TIMING-01 — Hotel Payment Timing Clarity

**Stage:** UX Research · **Ticket:** UXR-HOTEL-PAYMENT-TIMING-01 · **Priority:** P1
**Date:** 2026-07-30 · **Feature slug:** `hotel-payment-timing`
**Upstream:** `docs/pipeline/hotel-payment-timing/01-discovery.md`
**Downstream:** `UXDES-HOTEL-PAYMENT-TIMING-01`

---

## Research question

Before leaving expaify for the booking partner, can a first-time traveler state **when** the stay price is
charged (at booking / at the property / on a stated date before arrival), **who** collects it, and whether a
**card is required now** — or, when the provider did not say, correctly report that it was not said, without
inferring timing from the `Non-refundable` label or from the product's silence?

---

## Executive finding

No, and the gap is structural rather than presentational.

1. **There is no timing field anywhere in the hotel path.** `HotelOffer` (`lib/types.ts:474-495`),
   `HotelSearchPage` (`:498-503`), `HotelProvider` (`:532-541`) and `BookingHotelContext`
   (`lib/booking/config.ts:52-77`) carry price, price *scope*, funds policy, rate eligibility, document
   readiness, smoking policy, ratings and location — and no charge event, collecting party,
   card-required-at-booking flag, or deferred-charge date. There is no method on `HotelProvider` through which
   such a fact could be requested, and no field on `BookingHotelContext` in which it could survive the
   card → review → handoff boundary. Confirmed by reading each file, not by grep alone.
2. **Current coverage is 100% `not_returned` by contract.** The only wired hotel provider hardcodes
   `createNotReturnedHotelFundsPolicy('Hotellook')` and `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` on both
   normalization paths (`lib/providers/hotellook.ts:406,408,534,538`), and its upstream entry type
   (`HotelLookCacheEntry`, `:22-41`) contains `hotelId`, `hotelName`, `stars`, `location`, `priceFrom`,
   `propertyType`, `amenityEvidence`, `smokingPolicy` — no payment object of any kind. So the primary
   deliverable is not a pay-now badge. It is making **"the provider did not state when you are charged"**
   legible, non-reassuring, and non-alarming.
3. **The five-state vocabulary transfers, but `explicit_none` needs a new and much narrower definition.**
   For deposits, `explicit_none` means "provider reports no deposit or hold"
   (`app/components/HotelFundsPolicyPanel.tsx:139-141,256`). Money for a stay always moves at *some* point, so
   there is no analogous "no timing." Defining `explicit_none` for this dimension is the single highest-risk
   decision in the feature, because it is the only state in which reassurance is legitimate — see §4.2.
4. **The false inference is measurable today and runs in the damaging direction.** `Non-refundable`
   (`lib/hotels/rateEligibility.ts:82`) is the product's only money-timing-adjacent string, rendered on the
   collapsed card by `HotelCardEligibilityLine` (`HotelCard.tsx:906`). It is about reversibility. Silence on
   timing directly beneath it is read as "then I must pay at the property." That inference has zero evidence
   behind it and must be corrected **in the same line**, not in an expandable panel — see directive D2.
5. **Reference products treat timing as a list-level, filterable rate attribute.** Booking.com's Demand API
   exposes `policies.payment.timings` with `pay_at_the_property | pay_online_now | pay_online_later` as both a
   search filter and a per-block response field; Expedia Rapid exposes a `property_collect` shopping feature
   indicator. expaify **must not copy the filter**: filtering on an attribute that is `not_returned` for
   ~100% of inventory empties the result list. Disclosure only, this phase. See §3.4.
6. **One vendor field looks like the answer and is not.** Duffel Stays' rate payment characteristic is
   documented as *"the form of payment that can be used to pay for the rate"* and is explicitly **not**
   presented to the customer — it exists so the integrator can route rates by its own payment strategy. It
   carries no charge-timing semantics and must map to `not_returned`, never to `at_property`. This is the
   concrete shape the "never infer from industry practice" constraint will take at DEV time.

**Smallest safe repair:** one provider-neutral `HotelPaymentTimingEvidence` object with a declarable
capability record, four evidence fields and no money field, persisted across `BookingHotelContext`, rendered
through **one shared component** on all three surfaces, with `not_returned` as the honest default.

---

## Inputs and method

### Current-code evidence audited (this worktree, branch `agent/UXR-HOTEL-PAYMENT-TIMING-01`)

| File | Read for |
|---|---|
| `lib/types.ts` | `HotelOffer` (`:474-495`), `HotelProvider` (`:532-541`), `HotelFundsPolicyEvidence` (`:314-322`), `HotelFundsEvidenceRecord` (`:296-312`), `HotelRateEligibilityEvidence` (`:454-464`), `HotelRateEligibilityCapability` (`:467-472`), `HotelRateFamilyEvidence`, `Result<T>` (`:545`) |
| `lib/booking/config.ts` | `BookingHotelContext` (`:52-77`), `HotelContextInput` flat-key serialization (`:83+`) |
| `lib/hotels/fundsPolicy.ts` | state/basis/scope sets (`:13-28`), `MISSING_FIELD_ORDER` (`:25-28`), normalizer degradation rules, `getHotelFundsAnalyticsDimensions` (`:253-283`) |
| `lib/hotels/rateEligibility.ts` | `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` (`:16-21`), `conditionLabel` (`:81`), capability gate on `clear` (`:135-138`) |
| `lib/providers/hotellook.ts` | `HotelLookCacheEntry` (`:22-41`), both normalization paths (`:386-409`, `:520-539`), `checkDocumentReadiness` (`:556-562`) |
| `app/components/HotelCard.tsx` | `Price` (`:349-365`), `PriceUnavailable` (`:367-384`), copy constants and composed `aria-label` (`:745-770`), collapsed stack (`:890-942`), `Price scope` / `Provider handoff` panels (`:1044-1069`) |
| `app/components/HotelFundsPolicyPanel.tsx` | `summaryCopy` (`:133-149`), `warningState` set (`:276`), tone map (`:296-301`), `showConfirmation` gate (`:305-311`), `variant="summary"` markup (`:282-294`) |
| `app/components/HotelBookingOwnership.tsx` | disclosure pattern: `aria-expanded` / `aria-controls` / `min-h-11` / `focus-visible:shadow-[var(--focus-ring)]` (`:57-76`), fire-once `onOpen` (`:44-53`) |
| `app/book/BookingFlow.tsx` | `trustClaims` (`:82-86`), `getHotelPriceBasisLabel` (`:240-243`), `HotelDecisionSummary` (`:319-385`), `emitAnalytics` non-blocking contract (`:157-163`) |
| `app/deals/[dealId]/page.tsx` | price caption (`:379`), prototype mount (`:433`) |
| `app/components/hotelFundsPolicyAnalytics.ts` | exposure hook, 1s@50% threshold, dedupe key (`:39-42`), event names, `surface` dimension |
| `lib/analytics.ts` | live sink (`:25-47`), dev-only `console.debug` (`:62-65`) |
| `app/components/research/HotelContinuityPrototype.tsx`, `hotelContinuityFixtures.ts` | harness mechanism and its type surface |

### Reference-pattern evidence

Used **only** for interaction and information-architecture guidance. It is not evidence about any expaify
property, and no directive below permits deriving a timing value from it.

- Booking.com Demand API — accommodation payment timing is a first-class policy field and a search filter:
  `policies.payment.timings` (`accommodations/search`, `accommodations/availability`), `payment.timings`
  (`accommodations/details`), values `pay_at_the_property | pay_online_now | pay_online_later`; prepayment as
  a separate boolean (`policies.payment.payment_required`, v3 `prepayment_required`); the deferred schedule
  itself is disclosed later, in the `/orders/preview` `dates` object.
  [Payment FAQs](https://developers.booking.com/demand/docs/payments/payments-faqs),
  [Check availability](https://developers.booking.com/demand/docs/open-api/demand-api/accommodations/accommodations/availability)
- Expedia Rapid — pay-later is a shopping-time feature indicator (`property_collect`), with
  `onsite_payments.currency` and `totals.inclusive.billable_currency` describing who charges the card in what
  currency, and pre-authorization described as a hold rather than money taken; launch requirements oblige the
  partner to show the property-collect deposit policy and payment schedule on the booking page. Deposit
  schedules are modelled as 1–4 installments timed *at booking*, *N days prior to check-in*, or *at check-in*.
  [Property collect payments](https://developers.expediagroup.com/rapid/lodging/booking/property-collect),
  [Deposit API](https://developers.expediagroup.com/supply/lodging/docs/property_mgmt_apis/deposit/getting_started/introduction/)
- Duffel Stays — the rate payment characteristic is a routing signal for the integrator and is explicitly not
  shown to the customer; no charge-timing field is documented.
  [Stays key concepts](https://duffel.com/docs/api/overview/stays-key-concepts)

### Corrections carried forward

`docs/pipeline/hotel-total-stay-cost/01-discovery.md:111` states that `lib/analytics.ts` is a `console.debug`
stub. **Not inherited.** Verified in code: `track()` posts to `/api/analytics` via `navigator.sendBeacon` with
a `fetch` + `keepalive` fallback (`lib/analytics.ts:25-47`), plus an optional production-only external
collector (`:49-60`); `console.debug` is the `NODE_ENV === 'development'` early-return branch only (`:62-65`).
Instrumentation in §5 is therefore real and requires no new sink.

---

## 1. Current implementation audit

### 1.1 The data layer

`HotelOffer` has nine evidence-carrying members. Mapped against the four sub-questions this ticket owns:

| Sub-question | Field that could carry it | Verdict |
|---|---|---|
| When is the stay price charged? | — | absent |
| Who collects it? | `source` / `deeplink` host | **not usable** — `getHotelPartnerIdentity` (`BookingFlow.tsx:107+`) resolves a *display label from a domain*, which is who runs the checkout page, not who debits the card. Deriving a collecting party from a hostname is exactly the inference the evidence-integrity constraint forbids. |
| Is a card required at booking? | — | absent |
| Deferred-charge date | — | absent |

`priceBasis` is a single-member union `'per_night_before_taxes_fees'` (`:481`). Widening it to express
prepaid-vs-at-property was considered and is **rejected** for three reasons: a string literal cannot carry
five-state provenance, a `sourceLabel`, a `fetchedAt` or ordered `missingFields`; `priceBasis` is duplicated
as a *required* literal on `BookingHotelContext` (`config.ts:59`) so widening it changes the URL contract of a
neighbouring dimension; and it conflates "what the number covers" with "when the number is collected", which
is the precise conflation §1.3 documents. This confirms the discovery's stated position: a separate evidence
object.

`BookingHotelContext` mirrors the absence and additionally reveals the serialization cost: `HotelContextInput`
flattens nested evidence into ~40 scalar query keys (`config.ts:83-120+`) against a 4,096-char href ceiling
(`MAX_INLINE_HOTEL_BOOKING_HREF_LENGTH`, `:80`), with `hotelBookingHrefRequiresReference` already switching
some offers to a reference-passing path (`HotelCard.tsx:757`). **Constraint for design: the timing contract
must stay small enough to serialize as ≤6 flat scalar keys.** That budget is the reason §2's contract carries
no repeated-record array and no money field.

### 1.2 Provider layer

Both Hotellook normalization paths construct offers field-by-field and attach the not-returned/unsupported
constants explicitly (`:406-408`, `:534-538`); `checkDocumentReadiness` returns
`notProvidedHotelDocumentReadiness('Hotellook')` with a comment stating that preserving the supplier omission
is deliberate rather than inferring availability (`:556-561`). This is the pattern to extend: a new dimension
is added to the provider surface as an explicit *declared absence*, never as an omitted field that renders as
neutral.

### 1.3 Presentation layer — where the traveler actually looks

Three surfaces, in decision order, with what each currently says:

1. **Collapsed card.** `Price` (`:349-365`) renders `Nightly rate` → amount →
   `per night before taxes and fees` → `Rate from {providerName}` → `Last-checked time unavailable` in
   `var(--warning)`. The block is width-clamped `min-w-[6.75rem] max-w-[9.5rem] text-right`, dropping to
   full-width left-aligned under a 351px container query. Below it the body stacks
   `HotelCardEligibilityLine`, `ParkingSummary`, the funds-policy summary, pet policy, collapsed smoking
   policy, then score chip + action (`:890-942`). Eleven information rows before any new dimension.
   **A twelfth always-on line is not available; §4 D2 spends no new line.**
2. **Expanded card / deal detail.** The `Price scope` panel (`:1044-1051`) restates
   `per night before taxes and fees` then `Rate check`. A traveler who expanded specifically to ask "when am I
   charged" gets a restatement of what the number covers. `app/deals/[dealId]/page.tsx:379` repeats the same
   caption a fourth time.
3. **Review, immediately before handoff.** `providerConfirmationCopy` (`:747`) — *"Provider confirms final
   total, taxes, fees, room availability, cancellation policy, and terms."* — is a six-item enumeration, is
   reused verbatim as `reviewDisclosure` in the `Provider handoff` panel (`:1067-1068`), and is folded into
   the review action's composed `aria-label` (`:763`). An enumeration reads as exhaustive, so payment timing
   is not merely undisclosed; it is implicitly excluded. Separately, `trustClaims`
   (`BookingFlow.tsx:82-86`) contains *"No payment details are collected on this page"* but is bound to the
   flight/Duffel verify path; the hotel review path has no equivalent statement.

### 1.4 The contamination path, precisely

`deriveRateEligibilityPresentation` returns `state: 'restricted'` with `conditions: [{ family:
'refundability', label: 'Non-refundable' }]` (`rateEligibility.ts:81,122-126`). Rendered on the collapsed card
at `HotelCard.tsx:906`. Two properties of the surrounding code make the false inference worse than a copy nit:

- `state: 'clear'` is gated on **both** all-families-explicitly-clear and full capability support
  (`:135-138`), so today every offer degrades to `not_provided` — the eligibility line is a silence, and
  silence adjacent to a price is read as "nothing to pay yet."
- When a supplier *does* return non-refundability, `Non-refundable` renders with no timing qualifier at all,
  and the nearest money words on the card are `Nightly rate` and the amount.

Both directions of the discovery's contamination hypothesis are therefore reachable from real code states, not
hypothetical ones. §5.2 measures both.

### 1.5 Interference from a neighbouring, out-of-scope defect

`Last-checked time unavailable` is hardcoded in `var(--warning)` on every offer (`HotelCard.tsx:361`, `:379`,
`BookingFlow.tsx:356`). It is owned by `docs/pipeline/hotel-price-freshness/`. It matters here as
**colour interference**: a permanent amber line immediately above a new timing statement makes the timing
statement read as equally unreliable, and a second amber line stacked under it produces an alarm the evidence
does not support. Directive D1 therefore forbids `--warning` as *text* colour for the collapsed timing line
while retaining `--warning-soft` as a container tone, matching `HotelFundsPolicyPanel`'s
`variant="summary"` treatment (`:276-280`). No fix to the freshness line is proposed here.

---

## 2. The smallest provider-neutral evidence contract

Provider-neutral, additive, no new vocabulary, no money primitive, ≤6 serialized scalar keys. Field names are
UXR's proposal; the final type decision is DEV's.

```ts
// Reuses HotelFundsEvidenceScope from lib/types.ts — no new scope vocabulary.
export type HotelPaymentTimingState =
  | 'complete' | 'partial' | 'explicit_none' | 'not_returned' | 'conflicting';

export type HotelChargeEvent = 'at_booking' | 'at_property' | 'deferred_before_arrival';

export type HotelChargeCollector = 'booking_partner' | 'property';

export type HotelPaymentTimingMissingField =
  | 'charge_event' | 'collector' | 'card_at_booking' | 'deferred_date' | 'scope' | 'source';

export interface HotelPaymentTimingStatement {
  chargeEvent?: HotelChargeEvent;
  collector?: HotelChargeCollector;
  /** Provider-stated only. `false` is an assertion; absent is not. */
  cardRequiredAtBooking?: boolean;
  /** ISO date. Valid only with chargeEvent === 'deferred_before_arrival'. */
  deferredChargeOn?: string;
  /** Verbatim supplier sentence, bounded. Rendered, never parsed. */
  providerWording?: string;
}

export interface HotelPaymentTimingEvidence {
  state: HotelPaymentTimingState;
  statement?: HotelPaymentTimingStatement;
  conflictingStatements?: HotelPaymentTimingStatement[]; // populated only when state === 'conflicting'
  sourceLabel: string;
  scope: HotelFundsEvidenceScope;
  fetchedAt?: string;
  missingFields?: HotelPaymentTimingMissingField[]; // ordered, as MISSING_FIELD_ORDER
}

export interface HotelPaymentTimingCapability {
  chargeEvent: boolean;
  collector: boolean;
  cardRequiredAtBooking: boolean;
  deferredChargeDate: boolean;
}
```

### 2.1 Non-duplication boundaries (what is deliberately absent)

| Excluded | Owner | Why not here |
|---|---|---|
| any `Money` / amount / basis | total-stay-cost | timing answers *when*, never *how much*; adding an amount recreates the caption divergence |
| `HotelFundsObligationType`, `returnOrRelease`, `paymentMethodWording` | deposit-holds | a hold is restricted-not-spent money; the stay charge is spent money |
| refundability, penalties, deadlines | cancellation-clarity + rate-eligibility | reversibility ≠ timing — this is the defect being repaired |
| settlement currency | local-currency-payment | `billable_currency`-shaped facts belong to that pipeline |

Note the near-collision: `HotelFundsEvidenceRecord.applicationWording` and the
`'application_timing'` missing-field (`fundsPolicy.ts:25-26`) already describe *when a deposit or hold
applies*. That is timing **of the deposit obligation**, scoped to funds policy. Design must not restate the
stay-price charge event inside the funds panel, and the funds panel's existing `Confirm the amount and timing
before booking` string (`HotelFundsPolicyPanel.tsx:138`) must not be reused for this dimension — D3 fixes the
cross-reference wording so the two read as one system.

### 2.2 `explicit_none` — the one state that needs a definition, not a translation

**Definition:** `explicit_none` means the provider **explicitly asserts that nothing is collected and no card
is charged before arrival** — a positive negative statement, not the absence of one. Concretely it requires
*both* a charge event of `at_property` *and* an explicit `cardRequiredAtBooking: false`. Booking.com's
`timings = pay_at_the_property` together with `payment_required = false` is the canonical source shape.

Three rules follow, and they are the crux of the feature:

1. `explicit_none` is the **only** state in which reassuring copy is permitted.
2. A missing `cardRequiredAtBooking` degrades `at_property` to `partial`, never to `explicit_none`. "Pay at the
   property" and "no card needed now" are different claims; suppliers routinely make the first while requiring
   a card to hold the room.
3. Nothing may derive `explicit_none` from `not_returned`, from a `clear`/absent refundability, from the
   partner domain, or from a Duffel-style payment-method characteristic.

### 2.3 Degradation rules (mirroring `fundsPolicy.ts` / `rateEligibility.ts` precedent)

- Provenance mismatch — statement offer/supplier ≠ displayed offer/`source` → whole object degrades to
  `not_returned`, per `rateEligibility.ts:110-112`.
- `deferredChargeOn` present without `chargeEvent === 'deferred_before_arrival'`, unparseable, or not before
  check-in → drop the date, add `deferred_date` to `missingFields`, state becomes `partial`. Never render an
  unvalidated date.
- Capability all-false → `not_returned` with `missingFields` unset; a capability-false adapter may never emit
  `complete` or `explicit_none`, exactly as `capabilitySupportsClear` gates `clear` (`rateEligibility.ts:136`).
- `conflicting` requires **two or more retained supplier statements that disagree**. It is never synthesized
  from one statement plus a neighbouring field. A non-refundable rate with `not_returned` timing is
  `not_returned`, not `conflicting`.
- Any adapter path returns `Result<T>` and never throws; a fetch failure is the component's `error` load
  state, which is distinct from all five evidence states.

---

## 3. Reference comparison — interaction level

### 3.1 Booking.com

| Funnel step | What happens |
|---|---|
| Search / filter | Timing is a **filter facet**: `policies.payment.timings` is both request filter and response field, values `pay_at_the_property`, `pay_online_now`, `pay_online_later`. The traveler can remove pay-now inventory before comparing. |
| Rate row | Each block carries its own timing value plus a separate prepayment boolean (`payment_required`, v3 `prepayment_required`). Timing is per-rate, not per-property. |
| Payment step | Only here is the deferred **schedule** disclosed — `/orders/preview` returns a `dates` object showing when portions of the total fall due. |
| Separation from cancellation | Free cancellation is its own independent facet and badge. A rate can be free-cancellation *and* pay-online-now; the two are never merged into one caption. |

### 3.2 Expedia Rapid / Hotels.com

| Funnel step | What happens |
|---|---|
| Shopping | `property_collect` is a shopping-time feature indicator distinguishing pay-later from merchant-collect. |
| Rate detail | `onsite_payments.currency` and `totals.inclusive.billable_currency` name who charges the card and in what currency; pre-authorization is described as a hold rather than money taken. |
| Booking page | Launch requirements **oblige** the partner to display the property-collect deposit policy and payment schedule. Disclosure is a certification gate, not a courtesy. |
| Separation from cancellation | `refundable` and `cancel_penalties` are separate elements; timing and reversibility are modelled independently. |

### 3.3 Delta against expaify

| Dimension | Booking.com / Rapid | expaify today | Delta |
|---|---|---|---|
| Earliest disclosure | search facet / shopping indicator | none | timing is invisible during comparison, the step where it changes the choice |
| Granularity | per rate | n/a | offer-level is acceptable at MVP but scope must be stated (`HotelFundsEvidenceScope`), not implied |
| Deferred schedule | at payment step, mandated | none | must appear at review before handoff, or the handoff must say the partner is where it is confirmed |
| Kept separate from cancellation | yes, independent fields and facets | **no** — `Non-refundable` is the only nearby string | the repair |
| Filterable | yes | no | **do not adopt** — §3.4 |
| Missing data | typed null with defined meaning | no field to be null | `not_returned` must be authored copy, not an empty slot |

### 3.4 Judgement: the filter pattern does not transfer this phase

Both references make timing filterable because both have near-complete coverage. expaify's coverage is 0%
(§4.0). A timing filter over `not_returned` inventory either returns an empty list — reproducing the
`hotel-filter-recovery` and `hotel-no-results-recovery` failure modes — or silently includes unknown-timing
offers in a "pay at property" bucket, which is the exact false-comfort error this feature exists to prevent.
**Directive: no timing filter, sort, or ranking input in this phase.** Revisit only when a capability-true
adapter reports `complete` for a majority of returned offers. Timing must also never enter Deal Score.

---

## 4. Testable directives

### 4.0 Sourceable-field and distribution quantification

Structural coverage by contract — what the code can produce today, not a production sample.

| Adapter | chargeEvent | collector | card at booking | deferred date | Achievable state |
|---|---|---|---|---|---|
| Hotellook (only wired provider) | none | none | none | none | **`not_returned`, 100%** — capability all false |
| Booking.com Demand (not integrated) | `policies.payment.timings` | derivable from the timing value's documented semantics: pay-at-property = property collects; pay-online = Booking.com collects | `policies.payment.payment_required` / `prepayment_required` | `/orders/preview` `dates`, **post-search only** | `complete` for at_booking / at_property; **`partial` at search time for deferred** (date not available until order preview) |
| Expedia Rapid (not integrated) | `property_collect` indicator | `onsite_payments` / `billable_currency` | not exposed as a demand-side shopping boolean | supply-side Deposit API installments, not the demand shopping response | `partial` at shopping time |
| Duffel Stays (flight adapter present; Stays not integrated) | payment-method characteristic — **not customer-facing, no timing semantics** | none | none | none | **`not_returned` only. Mapping this field to timing is a defect.** |
| Amadeus (`lib/providers/amadeus.ts`, stubbed) | not audited | — | — | — | no claim made; requires its own audit before any capability flag is set true |

**Honest distribution for the build being designed: `complete` 0%, `partial` 0%, `explicit_none` 0%,
`not_returned` 100%, `conflicting` 0%.** `conflicting` and `partial` are reachable only through the fixture
set (§5.1) until a real capability-true adapter lands. Industry practice is not property evidence and appears
nowhere in the mapping above.

---

### D1 — One fixed lexicon, five states, authored copy, non-reassuring silence

A single exported copy module (e.g. `lib/hotels/paymentTiming.ts`) is the **only** source of these strings, so
the dimension does not become a fifth divergent caption alongside `HotelCard.tsx:359`, `:1047`,
`BookingFlow.tsx:242`, `deals/[dealId]/page.tsx:379`. Panel heading on detail and review: **"When you are
charged"**. Sub-question hierarchy, fixed and identical on all three surfaces:
**(1) when → (2) who collects → (3) is a card required now → (4) deferred date.**

| State | Collapsed-card clause (≤48 chars) | Detail / review sentence |
|---|---|---|
| `complete` · at_booking | `Charged at booking` | `{Partner} charges the stay price when you book.` |
| `complete` · at_property | `Charged at the property` | `The property charges the stay price at your stay, not at booking.` |
| `complete` · deferred | `Charged {Mon D}` | `{Partner} charges the stay price on {Month D, YYYY}, before you arrive.` |
| `complete` · card clause (appended when stated) | — | `A card is required at booking.` / `No card charge before you arrive.` |
| `explicit_none` | `Nothing charged before arrival` | `{Provider} states nothing is collected and no card is charged before you arrive.` |
| `partial` | `Charge timing partly stated` | `{Provider} stated part of the charge timing. Not stated: {ordered missing fields}. Confirm with {partner} before you pay.` |
| `not_returned` | `Charge timing not stated` | `{Provider} did not state when the stay price is charged, or who collects it. This is not the same as paying at the property. Confirm with {partner} before you pay.` |
| `conflicting` | `Charge timing statements conflict` | `Two statements from {provider} disagree about when the stay price is charged. Both are shown; expaify is not choosing one.` + each verbatim `providerWording`. |
| load `loading` | `Checking charge timing…` | `Checking charge timing…` (`role="status"`, `aria-busy`) |
| load `error` | `Charge timing could not be checked` | `Charge timing could not be checked. This does not mean you will not be charged at booking.` |

Hard copy rules, testable as string assertions:

1. The words `free`, `no charge`, `nothing`, `pay later`, and `pay at the property` may appear **only** in the
   `complete · at_property` and `explicit_none` rows. A unit test must assert their absence from the
   `not_returned`, `partial`, `conflicting`, and `error` strings.
2. `not_returned` copy must contain an explicit non-equivalence clause (*"This is not the same as paying at the
   property."*). It is the countermeasure to the false-comfort error and is scored directly in §5.2.
3. No string may name an amount, a deposit, a hold, a penalty, or a cancellation deadline (§2.1 boundary).
4. `{Provider}` is the evidence `sourceLabel` (who stated it); `{Partner}` is the resolved handoff label from
   `getHotelPartnerIdentity`, falling back to `booking partner` when `named === false`. They are never
   interchanged: `sourceLabel` attributes the *statement*, the partner label names *where to confirm*.
5. Tone tokens: `complete` and `explicit_none` → `border-[color:var(--border)] bg-[color:var(--bg-raised)]`.
   `partial`, `not_returned`, `conflicting` → `border-[color:var(--border-strong)]
   bg-[color:var(--warning-soft)]` with body text at `--text-2`, matching `HotelFundsPolicyPanel`'s
   `warningState` treatment (`:276-280`). **`error` alone** may use `--error-soft`. `--warning` and
   `--error-text` are forbidden as the *text* colour of any collapsed-card timing clause (§1.5 interference).
   No new colour or font-size tokens.

### D2 — Collapsed card: merge with the eligibility line; spend no new row

The collapsed card has eleven rows and no budget for a twelfth (§1.3). Therefore:

1. `HotelCardEligibilityLine` (`HotelCard.tsx:906`) becomes a single combined **rate-terms row** carrying
   restriction conditions and the timing clause in that order, joined by ` · `:
   `Non-refundable · Charge timing not stated`. Net new always-on rows: **zero**. This also places the
   correction adjacent to the string that causes the false inference, which no expandable panel can do.
2. Ordering is fixed: existing `RESTRICTION_ORDER` conditions first, timing clause last. When eligibility is
   `not_provided` (today's universal case) the row renders the timing clause alone and the row must still
   appear — the timing dimension is always present, in one of its five states, for every bookable offer.
3. The row is `line-clamp-2` at 375px and must never truncate mid-word on the timing clause; clauses are
   capped at 48 characters (table in D1) so that `Non-refundable · Charge timing not stated` fits two lines at
   375px. Verified breakpoints: 375px (container `@max-[351px]` variant active) and 1280px.
4. The row is **text only, not a control**. The full sentence, provenance and cross-references live in the
   expanded card, the deal-detail panel, and the review panel — the disclosure pattern, not the scan row.
5. Deferred dates on the collapsed row use `{Mon D}` (e.g. `Charged Sep 4`) and the full
   `{Month D, YYYY}` everywhere else. A date is rendered only after passing §2.3 validation.

### D3 — Cross-reference wording and the handoff enumeration

1. **The enumeration at `HotelCard.tsx:747` is amended**, since an enumeration reads as exhaustive:
   `Provider confirms final total, taxes, fees, when you are charged, room availability, cancellation policy,
   and terms.` The insertion point is fixed (after `fees`, before `room availability`), because the string is
   reused as `reviewDisclosure` (`:1067`) and inside the review `aria-label` (`:763`) — one edit, three
   surfaces, no divergence.
2. **Fixed one-line cross-references**, rendered inside the "When you are charged" panel only, and only in the
   states named:
   - to total-stay-cost, always: `This is when the price is charged, not what it covers.`
   - to deposit-holds, when funds-policy state is anything other than `explicit_none`:
     `Deposits and card holds are shown separately under "Additional funds at the property."` (quotes the
     existing heading verbatim, `HotelFundsPolicyPanel.tsx:329`).
   - to cancellation, when rate eligibility reports `Non-refundable`:
     `Non-refundable describes whether you can get money back, not when it is taken.`
     This string is **required** whenever `Non-refundable` renders, in every timing state.
3. **No reverse references.** The funds-policy, total-cost and cancellation panels are not edited to point at
   timing; one-directional referencing keeps the four dimensions from becoming four overlapping panels.
4. The hotel review path gains a timing-scoped equivalent of the flight-only `trustClaims` line
   (`BookingFlow.tsx:82-86`), placed in the same panel:
   `expaify does not collect payment. Any charge happens with {partner}.` Applies in all five states, because
   it is a fact about expaify rather than about the offer.

### D4 — Layout, keyboard, screen reader

1. **Disclosure control** on expanded card, deal detail and review copies the verified pattern from
   `HotelBookingOwnership.tsx:57-76`: `<button type="button" aria-expanded aria-controls>` with visible label
   `When am I charged?`, `min-h-11`, `focus-visible:shadow-[var(--focus-ring)]`, chevron `aria-hidden` with
   `motion-reduce:transition-none`, and a fire-once `onOpen` callback for §5.3's details-opened event.
2. **The fact reaches screen readers on the collapsed card without expansion.** The D2 clause is appended to
   the review action's composed `aria-label` (`HotelCard.tsx:763`) in fixed position — after
   `eligibilityAriaSummary`, before `providerConfirmationCopy` — as one sentence:
   `{Provider} did not state when the stay price is charged.` The `PriceUnavailable` `aria-label` (`:379`) is
   **not** extended; an offer with no valid price has no charge event to describe.
3. **No `aria-live` on a settled fact.** `role="status"` / `aria-live="polite"` / `aria-busy` apply only to the
   `loading` and `error` load states, matching `HotelFundsPolicyPanel.tsx:285-287`. A `not_returned` state is
   not an alert.
4. **Layout.** 375px: single column, `[overflow-wrap:anywhere]` on any partner label, the nightly amount never
   wraps or truncates, no element overlaps the `Price` block's `@max-[351px]` full-width variant. 1280px: the
   panel sits in the same single-column evidence stack as `HotelFundsPolicyPanel` at
   `variant="full"`; it does not become a third column. Tab order on the review surface:
   price → Deal Score → timing disclosure → funds policy → confirm/handoff action.
5. **Conflicting state** renders both statements as sibling `<p>` elements under one heading, each attributed
   to its `sourceLabel`, with no visual ranking — mirroring the existing conflicting-records treatment
   (`HotelFundsPolicyPanel.tsx:357-370`).

### D5 — Instrumentation, mirroring the `hotel_funds_policy_*` family exactly

New event family `hotel_payment_timing_*`, implemented in a sibling module to
`app/components/hotelFundsPolicyAnalytics.ts`, reusing its exposure mechanics (IntersectionObserver at
`threshold: 0.5`, 1,000ms dwell, bounded-hash dedupe keyed on `provider:offerId:surface`, `MAX_DEDUPE_KEYS`)
and its swallow-all `emit` wrapper.

| Event | When | Dedupe |
|---|---|---|
| `hotel_payment_timing_summary_viewed` | timing row/panel ≥50% visible for ≥1s, load state not `loading` | once per offer × provider × surface |
| `hotel_payment_timing_details_opened` | first closed → open transition of the D4 disclosure | once per offer × provider × surface |
| `hotel_payment_timing_confirm_clicked` | activation of the handoff action on the review surface | not deduped |

Dimensions, from a `getHotelPaymentTimingAnalyticsDimensions` helper shaped like
`getHotelFundsAnalyticsDimensions` (`fundsPolicy.ts:253-283`): `timingState` (five states + `error`),
`chargeEvent` (`at_booking | at_property | deferred_before_arrival | unknown`), `collector`
(`booking_partner | property | unknown`), `cardAtBooking` (`true | false | unknown` — three-valued, never
coerced to boolean), `missingFields` (ordered, joined), `scope`, `provider` (lowercased, non-alphanumerics
replaced), `surface` (`hotel_card | hotel_detail | book_handoff`), and `eligibilityRefundability`
(`restricted | clear | not_provided`) so the §5.2 contamination cohort is segmentable in the live funnel.

Additionally, `timingState` is added as a dimension to the **existing** handoff-confirm event rather than
duplicating it. Analytics must never block or alter the handoff (`BookingFlow.tsx:157-163`). No raw
`providerWording`, no offer identifiers beyond the existing bounded hash, no dates are emitted.

---

## 5. Operationalized measurement

### 5.1 Fixtures

**Harness deviation, stated explicitly.** The discovery instructs reuse of
`app/components/research/HotelContinuityPrototype.tsx` and warns against building a new harness. Audit finding:
that component's type surface is outage-specific — `ContinuitySignal`, `impactType:
'electricity' | 'connectivity' | ...`, `PrototypeDestinationContext`, `RESEARCH_MAX_AGE_DAYS`,
`SCOPE_LIMITATIONS` — and its states (`missing | partial | confirmed | stale | conflict | error`) are not the
five-state funds vocabulary. Overloading it would require inventing a payment-timing member of
`ContinuitySignal`, which is the "fourth dialect" the constraints forbid.

**Resolution:** reuse the *harness mechanism*, not the component — a sibling
`app/components/research/hotelPaymentTimingFixtures.ts` + `HotelPaymentTimingPrototype.tsx`, mounted on the
deal-detail page exactly as `HotelContinuityPrototype` is (`app/deals/[dealId]/page.tsx:433`) behind its own
URL param, reusing the same conventions: `parse…Fixture()` allowlist with a `control` default, the
`https://example.com` research-origin guard, the `Research prototype — this information is not part of hotel
ranking or Deal Score.` disclaimer, and `track()` for prototype events. No production code path reads these
fixtures. This is a documented deviation for UXDES to accept or overrule, not a silent one.

| Fixture id | Evidence state | Purpose |
|---|---|---|
| `timing-control` | — | current build, no timing disclosure; the baseline arm |
| `timing-pay-now` | `complete` · at_booking · partner · card required | can a participant identify money leaving today |
| `timing-at-property` | `complete` · at_property · property | correct at-property recognition when it *is* stated |
| `timing-deferred` | `complete` · deferred_before_arrival, dated 14 days pre-arrival, partner | date comprehension and the expense-cutoff sub-segment |
| `timing-explicit-none` | `explicit_none` | the only reassurance-permitted state; must not be confused with `not_returned` |
| `timing-partial` | `partial`, `missingFields: ['collector','card_at_booking']` | does partial read as an open question rather than at-property |
| `timing-not-returned` | `not_returned` | **primary gate.** Correct answer on all three items is "the provider didn't say" |
| `timing-conflicting` | `conflicting`, two verbatim disagreeing statements | does the traveler withhold a conclusion |
| `timing-nonrefundable-unknown` | `not_returned` **+** eligibility `Non-refundable` | **contamination case.** Isolates the §1.4 inference |
| `timing-loading`, `timing-error` | load states | load states are distinct from evidence states |

Ten fixtures cover all five evidence states, both load states, all three charge events, and the contamination
case. `timing-not-returned` and `timing-nonrefundable-unknown` differ in exactly one variable, so any
comprehension delta between them is attributable to the eligibility line alone.

### 5.2 Comprehension instrument

Moderated, 8–12 first-time participants, offer list → detail → review, **stopping at handoff** (no participant
ever reaches a partner checkout). Within-subject across fixtures, fixture order counterbalanced. Asked after
viewing an offer, before the handoff action; *"the provider didn't say"* is present on every item, in the same
position, always.

1. When is the stay price charged? — at booking / at the property / on a stated date before arrival / the provider didn't say
2. Does anyone take money from your card before you arrive? — yes / no / the provider didn't say
3. Who charges you? — expaify / the booking partner / the hotel / the provider didn't say

Scored against the fixture's actual evidence state — the fixture, not the moderator, is ground truth.

**Three separately reported error classes.** Collapsing them into one accuracy number would hide the defect:

- **False-comfort error** (primary gate): on `timing-not-returned` or `timing-partial`, selecting *at the
  property* or *no* instead of *the provider didn't say*. Reported alone, with its own count and per-fixture
  rate. Ship gate: **zero false-comfort errors on `timing-nonrefundable-unknown`**, per the discovery's
  success statement.
- **Contamination error**: on `timing-nonrefundable-unknown`, claiming a charge at booking (either direction of
  the §1.4 inference — reported as two sub-counts, "non-refundable ⇒ charged now" and "silence ⇒ pay at
  property").
- **Ordinary incorrect answer**: everything else, including over-caution — answering *the provider didn't say*
  on a `complete` fixture. Over-caution is a copy failure, not a safe outcome, and is reported separately
  again.

Item 4, contamination probe, `timing-nonrefundable-unknown` only, open-ended and coded blind:
*"What, if anything, does 'Non-refundable' tell you about when your card is charged?"* The target response is
that it says nothing about timing.

**Hesitation (secondary, per the discovery):** time-to-first-action on the review action, expand/collapse
cycle counts on the price and policy panels, and verbatim capture of participant questions containing
*charge / pay / card / deposit / now / later*. Hesitation is attributed to payment timing **only when the
participant's own words name the charge event.** Dwell time alone is never attribution.

### 5.3 Event boundaries — what the live funnel may and may not conclude

Permitted: `hotel_payment_timing_summary_viewed` and `_details_opened` rates by `timingState` and `surface`;
`review-viewed without handoff` **as a directional cohort comparison across `timingState` values**; the
`eligibilityRefundability` × `timingState` cross-tab as the live analogue of the contamination cell.

Forbidden, inherited from `docs/pipeline/hotel-deposit-holds/01-discovery.md`:

1. **Unexplained abandonment is never labelled payment-timing-related.** No per-session diagnosis, no
   "timing-driven drop-off" metric, no dashboard tile implying causation.
2. No inference from an *absent* event. A missing `_summary_viewed` means not-observed, not not-seen.
3. Cohort comparisons require ≥2 populated `timingState` values in the window. With today's 100%
   `not_returned` distribution the comparison is **structurally unavailable** and must be reported as such
   rather than computed against an n of one. This is why §5.2's prototype gate, not the live funnel, is the
   pass/fail instrument.

### 5.4 Validation-surface caveats for TEST planning

- `HotelDecisionSummary` hardcodes `Stay dates not provided` (`BookingFlow.tsx:339`), `Hotel class not
  provided` (`:373`) and `Guest rating not provided` (`:377`) unconditionally. The hotel review page therefore
  cannot demonstrate that *any* conditional disclosure is truly conditional; new timing states must be
  verified on the deal-detail prototype surface and by unit test, not by eyeballing `/book`.
- The hotel search form is unreachable from `app/page.tsx` (marketing landing), so `HotelCard` and the
  `BookingFlow` hotel path are entered only via the deal feed and deal detail. No live hotel-search traffic is
  available for validation.
- The permanent `Last-checked time unavailable` amber line sits directly above the new disclosure on every
  surface (§1.5). Screenshot review at 375px must confirm the two do not read as a single warning block.

---

## 6. Open decisions handed to UXDES / DEV

1. **Type placement** — separate `HotelPaymentTimingEvidence` object (this brief's position, §1.1) versus
   widening `priceBasis`. UXR recommends the separate object and considers widening `priceBasis` a defect
   risk; DEV owns the final call.
2. **Serialization budget** — the ≤6 flat-key ceiling on `BookingHotelContext` (§1.1). If `providerWording`
   plus `conflictingStatements` cannot fit under `MAX_INLINE_HOTEL_BOOKING_HREF_LENGTH`, verbatim wording is
   dropped at the handoff boundary before any structured field is, and the review surface must then say the
   wording is available at the partner rather than silently omitting it.
3. **Scope granularity** — offer-level for MVP; per-rate timing (the reference pattern) requires a rate
   concept that `HotelOffer` does not yet have. Design must state the `scope` on the surface rather than let
   offer-level read as rate-level.
4. **Harness deviation** — sibling prototype component versus overloading `HotelContinuityPrototype` (§5.1).
   UXR's recommendation is the sibling; UXDES may overrule with a stated reason.

## 7. Out-of-scope findings (recorded, not fixed)

- `Last-checked time unavailable` hardcoded in `--warning` (`HotelCard.tsx:361`, `:379`,
  `BookingFlow.tsx:356`). Owned by `docs/pipeline/hotel-price-freshness/` and
  `provider-freshness-timestamp-clarity`. Interference only; D1.5 works around it.
- Four divergent copies of the price-basis caption (`HotelCard.tsx:359`, `:1047`, `BookingFlow.tsx:242`,
  `app/deals/[dealId]/page.tsx:379`). D1's single copy module prevents a fifth; consolidating the existing
  four remains the total-stay-cost pipeline's directive.
- `getHotelPartnerIdentity` (`BookingFlow.tsx:107+`) resolves a partner label from a URL host. Safe as a
  "where to confirm" label, unsafe as a collecting-party fact (§1.1). Worth an explicit comment at DEV time so
  a later contributor does not wire it into `collector`.
- `HotelDecisionSummary`'s unconditional negative states (§5.4). Pre-existing, app-wide on that surface.

---

**Quality bar check:** all five evidence states plus both load states have authored copy and a fixture; 375px
and 1280px behaviour, keyboard and screen-reader behaviour are specified; no placeholder copy; no TODO; the
provider distribution is reported as measured from code (100% `not_returned`) rather than aspirationally.

**Handoff:** `UXDES-HOTEL-PAYMENT-TIMING-01`, carrying this path and the §4 directives.
