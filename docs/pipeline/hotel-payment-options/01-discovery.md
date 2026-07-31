# UXD-HOTEL-PAYMENT-OPTIONS-01 — Hotel Payment-Option Confidence

**Stage:** UX Discovery · **Ticket:** UXD-HOTEL-PAYMENT-OPTIONS-01 · **Priority:** P1  
**Date:** 2026-07-31 · **Feature slug:** `hotel-payment-options`  
**Downstream:** `UXR-HOTEL-PAYMENT-OPTIONS-01`

---

## Scope Boundary And Prior Work

This ticket asks one decision question: **before leaving expaify, can a traveler tell whether the displayed
hotel offer requires payment before arrival, permits payment at the property, and supports the payment
method they expect to use—or tell that the provider has not supplied that evidence?**

The timing half of that question already has a completed discovery, research brief, and design spec in
`docs/pipeline/hotel-payment-timing/`. Downstream work must reuse that evidence vocabulary and its separation
of charge event, collector, and card-required-at-booking; it must not create a competing payment-timing model.
The new gap in this ticket is **option availability plus accepted-method evidence**, and the disclosure
hierarchy that keeps those facts coherent across the actual result → provider rate-selection → booking
handoff journey.

This ticket does **not** cover refundable deposits, authorization holds, incidental holds, their amount, or
their release timing. Those belong to `docs/pipeline/hotel-deposit-hold/` and
`docs/pipeline/hotel-deposit-holds/`. In particular,
`HotelFundsEvidenceRecord.paymentMethodWording` describes which method a deposit or hold applies to; it is
not evidence that the same method can pay the stay price.

Other adjacent boundaries:

| Dimension | Traveler question | Owner |
|---|---|---|
| Total stay cost | How much will the stay cost? | `hotel-total-stay-cost` |
| Cancellation | What happens if I cancel? | `hotel-cancellation-clarity` |
| Deposit / incidental hold | What additional funds may be restricted temporarily? | `hotel-deposit-hold` |
| Local settlement currency | In which currency will the charge settle? | `local-currency-payment` |
| **This ticket** | **When can I pay, and can I use my expected method for the stay price?** | `hotel-payment-options` |

---

## User Pain Point

**A traveler can compare a hotel price and leave expaify to inspect rooms without knowing whether the stay
price must be prepaid, can be paid at the property, or can be paid with their expected method, so the first
usable answer may arrive only after they have selected a provider and rate—and missing evidence can be
mistaken for a favorable payment option.**

This is a confidence and data-integrity failure, not a request for another filter. Payment timing and method
acceptance can determine whether an otherwise attractive rate is usable: a traveler may need to preserve
cash until arrival, use a debit card rather than a credit card, use a particular network, or avoid a method
the property does not take. “Card required at booking” does not answer which cards are accepted, and
“non-refundable” does not prove prepayment.

---

## Who Is Affected And Where

**Who.** First-time hotel shoppers are most exposed because they have no learned model of expaify's provider
handoff. Severity is highest for travelers with a cash-flow constraint, debit- or prepaid-card users,
travelers relying on a less universally accepted network, and international travelers whose expected method
may not be accepted by the booking partner or property. This discovery does not assume any method is
accepted merely because it is common.

**Where.** The current product has two hotel paths, and neither supplies payment-option evidence:

1. **Search-result scan.** The shipped deal feed renders `DealCard` from `app/deals/DealFeed.tsx`; the card
   exposes property, observed nightly price, discount, and dates, then links to the saved-deal detail. It has
   no payment timing or accepted-method signal. A richer but currently unmounted `HotelCard` also has no
   payment-option field; its collapsed price and policy area is silent on timing and accepted methods.
2. **Rate selection.** expaify has no internal room/rate selector in the shipped deal journey. The saved-deal
   detail explicitly says **“Check rooms with provider”** and `HotelDealCriteriaHandoff` sends the traveler
   through `CompareRow` to Expedia, Booking, Kiwi, or Trip.com in a new tab. Room and rate selection therefore
   happens on the partner. expaify cannot truthfully attach property-level or observed-price evidence to a
   specific provider rate unless the source contract identifies that same provider and rate.
3. **Booking handoff.** Immediately before departure, the product says the provider confirms room details,
   availability, total, taxes and fees, cancellation policy, and terms. It does not name payment timing or
   accepted methods. The separate `/book?kind=hotel` review used by `HotelCard` likewise carries funds-policy
   and eligibility evidence but no stay-price payment-option evidence.

The journey therefore has a structural break: expaify presents a comparable price before the rate exists in
its own model, while the payment terms that determine whether that rate is usable exist, if at all, only
after handoff.

---

## Current, Measurable Signal

### 1. Payment-option coverage is 0% representable

`HotelOffer` in `lib/types.ts` has no payment-timing, pay-at-property, prepayment, accepted-method, or
payment-option capability field. `BookingHotelContext` in `lib/booking/config.ts` cannot carry any of those
facts to review. The existing `HotelFundsPolicyEvidence` is deliberately scoped to deposits and holds and
must not be repurposed as accepted-method evidence for the stay price.

This makes the current normalized coverage **0% by contract**, not evidence that every offer requires or
avoids prepayment. There is also no representable distinction between:

- a provider that cannot return payment options;
- a provider that supports the fields but omitted them for this offer;
- a rate that supports one payment path only;
- a rate that offers a genuine choice between prepay and pay at property; and
- a payment method explicitly accepted versus merely not mentioned.

### 2. The active hotel sources cannot support a rate-level claim

`lib/providers/hotellook.ts` normalizes a property-level `priceFrom` from its cache payload. That payload has
no room/rate identifier, prepayment flag, pay-at-property flag, accepted-method list, or evidence timestamp
for payment terms. It already hardcodes `fundsPolicy` to `not_returned` and rate-eligibility capabilities to
unsupported. The saved-deal path persists observed prices and attributed OTA links, not selected-rate payment
terms.

Consequently, a populated disclosure cannot be shipped from current provider data. The honest initial state
is unknown, and downstream research must treat future populated states as provider-gated rather than infer
them from OTA identity, property brand, refundability, price, or deeplink text.

### 3. Current copy sends the traveler away without naming the unknown

`HotelDealCriteriaHandoff` and the primary `CompareRow` accessible label enumerate what the provider will
confirm: room details, live availability, final total, taxes and fees, cancellation policy, and terms.
Payment timing and accepted methods are absent. In the unmounted `HotelCard` path,
`providerConfirmationCopy` has the same omission. Because these lists read as exhaustive, they do not help a
traveler recognize payment options as unresolved before opening the provider.

### 4. “Provider options” currently means booking partners, not payment choices

`CompareRow` labels its Expedia / Booking / Kiwi / Trip.com actions **“Provider options.”** That label is
accurate for channel choice, but close enough to this ticket's “payment options” language to require a firm
content boundary: provider availability must never be presented as evidence of pay-now, pay-at-property, or
method availability. Each partner can expose different room rates and different payment terms.

### 5. Behavior is instrumented, but payment comprehension is not

The shipped detail path records `hotel_detail_viewed`, section reach,
`hotel_provider_handoff_clicked`, and `hotel_room_handoff_started`. None carries a payment-evidence state,
and there is no return reason tied to payment timing or method rejection. Handoff abandonment or a quick
return therefore cannot currently be labelled payment-related. The absence of a production conversion
number is a measurement gap, not permission to infer one from dwell time.

---

## Information Required For A Shippable Disclosure Hierarchy

The hierarchy is by decision need, not by visual component. UXR and UXDES should preserve this order across
surfaces while adapting density:

1. **Timing / option availability:** Is the stay price charged at booking, on a specified date before
   arrival, or at the property? If more than one option is genuinely available for the same room/rate, say
   that it is a choice; do not derive “pay at property available” from a single at-property statement on a
   different rate.
2. **Collector:** Does the booking partner or property collect the stay payment? This disambiguates where
   accepted-method evidence must come from.
3. **Accepted method evidence:** Which method categories or named networks does the source explicitly say it
   accepts for this charge event and rate? Preserve provider wording when the taxonomy cannot be normalized.
   “Card required” and “card accepted” remain separate facts.
4. **Scope and provenance:** Name the provider/source, the property/offer/room/rate scope, and freshness.
   Property-level acceptance cannot be promoted to a selected-rate guarantee; a booking-partner method cannot
   be presented as a property method.
5. **Unknown fallback:** If any of the above was not supplied, state exactly what is unknown and where the
   traveler must confirm it. Unknown must not collapse to pay at property, cash accepted, card accepted, or no
   prepayment.

Surface priority follows the decision journey:

| Surface | Required role in the hierarchy |
|---|---|
| Result scan | A concise, comparable timing signal only when scoped evidence exists; otherwise one honest unknown cue that does not dominate the price and Deal Score. Do not list card brands here. |
| Rate selection | The decisive level for payment choice and method acceptance. Today it is provider-owned, so expaify must set the confirmation expectation before departure rather than imply it inspected the selected rate. |
| Booking handoff | The full last-known evidence, its scope/source, missing fields, and explicit confirmation fallback immediately before the provider action. This is the last expaify-controlled comprehension gate. |

If all inventory shares a provider-level unsupported state, the unknown should be explained at the result-set
level rather than repeated as warning chrome on every card. UXR must validate this placement; it must not
silently turn unsupported into offer-level absence.

---

## Measurement Plan

### Primary: comprehension of timing and option availability

Use a controlled result → detail → handoff prototype with fixtures for prepay only, pay-at-property only,
genuine choice, partial evidence, conflicting evidence, and provider-not-supported. Before handoff, ask:

1. “When would the stay price be charged?”
2. “Can you choose to pay at the property for this same room and rate?”
3. “Who would collect the payment?”

Every question must include **“The provider did not say”**. Score against fixture evidence. Report
false-comfort errors separately: choosing pay at property, no prepayment, or a payment choice when evidence is
missing is more harmful than ordinary recall failure.

### Co-primary: comprehension of accepted methods

Give each participant an expected method before the task (for example a debit card or a specifically named
network represented in the fixture). Ask, “Does the evidence show that you can use this method for the stay
price?” Answers: yes / no / provider did not say. A participant passes only when they distinguish explicit
acceptance, explicit non-acceptance, and omission. Do not ask about a deposit or incidental hold.

### Behavioral: payment-related hesitation and handoff

Measure result/detail disclosure exposure, disclosure open, provider handoff, return to expaify, and an
optional explicit return reason. Segment by timing state, method-evidence state, scope, and provider
capability. Attribute hesitation to payment only when the participant or traveler identifies payment timing
or method availability; do not infer it from dwell time, abandonment, or tab return alone.

### Supply: provider-data readiness

Report these separately for each provider and never average them into one reassuring “coverage” number:

- capability coverage: share of offers from a contract able to express timing, option plurality, collector,
  and accepted methods;
- offer/rate evidence coverage among capable providers;
- rate-match coverage: share whose evidence identifies the same provider, room/rate, dates, and occupancy as
  the handoff target;
- freshness coverage; and
- unknown, partial, and conflicting distributions.

**Discovery baseline:** representable timing/accepted-method coverage is 0%; visible payment-option
disclosure coverage is 0%; payment-attributed abandonment is not measurable.

---

## Constraints

1. **Evidence and scope integrity.** Never infer prepayment, pay-at-property availability, or accepted methods
   from refundability, funds-policy evidence, provider identity, property brand, country norms, price, or a
   missing field. A claim must identify the charge, collector, source, scope, and freshness. Unknown, explicit
   non-acceptance, and unsupported provider capability are distinct states. External data continues through
   `lib/providers` and adapter methods return `Result<T>` without throwing.
2. **Financial-domain separation.** This disclosure covers payment of the stay price only. It must neither
   include nor imply deposit or incidental-hold amounts, application methods, or release timing; it must not
   restate cancellation penalties or settlement currency. Any money introduced later remains integer minor
   units `{ priceCents, currency }`, and payment evidence never changes Deal Score.
3. **Progressive, accessible disclosure.** Preserve price and Deal Score as the primary result-card signals;
   avoid another always-on policy panel in the already dense card. At 375px and 1280px, no critical method or
   unknown-state wording may truncate. Information cannot rely on logos or color alone, and disclosure and
   handoff controls must retain logical reading/focus order, visible focus, and accurate accessible names.

---

## Success Statement

**This is solved when a first-time user can determine before provider handoff whether the displayed stay
requires prepayment, supports pay-at-property for the same room/rate, and explicitly accepts their expected
payment method—or can correctly identify each item as not provided—without mistaking deposit/hold wording,
refundability, provider choice, or missing data for payment-option evidence.**

The shippable outcome is not a claim that current inventory supports these options. It is one disclosure
hierarchy that renders known, partial, conflicting, unsupported, and unknown evidence honestly, with the
current provider reality expected to fall back to unknown until a rate-level source exists.

---

## Out-Of-Scope Findings

- The shipped deal flow and the richer `HotelCard` → `/book` flow are separate surfaces; `HotelCard` has no
  production call site outside tests on this branch. Consolidating those journeys is a broader information-
  architecture issue, not part of this discovery.
- Occupancy is not captured in the shipped provider handoff (`occupancy_state: 'not_captured'`), which further
  limits rate matching. Occupancy repair belongs to search/rate-context work.
- Current provider data cannot populate a rate-level payment disclosure. Provider procurement or scraping a
  partner checkout is not authorized by this ticket.
- Deposits and incidental holds are intentionally excluded even where the same payment method might be used.

---

## UXR Handoff

`UXR-HOTEL-PAYMENT-OPTIONS-01` must read this report plus all three
`docs/pipeline/hotel-payment-timing/` documents before producing
`docs/pipeline/hotel-payment-options/02-research.md`.

Research must audit `DealFeed.tsx`, `DealCard.tsx`, the saved-deal detail and
`HotelDealCriteriaHandoff`, `CompareRow.tsx`, `HotelCard.tsx`, `BookingFlow.tsx`, `lib/types.ts`,
`lib/providers/hotellook.ts`, `lib/booking/config.ts`, and `HotelFundsPolicyPanel.tsx`. It should compare
Booking.com and one similar provider at the interaction-pattern level, focusing on how a single rate versus
multiple payment variants are disclosed and how accepted methods are scoped to the collector. The brief must
produce 3–5 testable directives, define exact known/partial/conflicting/unsupported/unknown fallbacks, and
identify the smallest extension to the existing payment-timing contract rather than designing a duplicate.
