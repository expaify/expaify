# UXD-HOTEL-PAYMENT-METHOD-01 — Payment-Method Acceptance Confidence

**Stage:** UX Discovery · **Ticket:** UXD-HOTEL-PAYMENT-METHOD-01 · **Priority:** P1
**Date:** 2026-08-03 · **Feature slug:** `hotel-payment-method`
**Downstream:** `UXR-HOTEL-PAYMENT-METHOD-01`

---

## 0. Scope boundary: four payment pipelines already exist

This is the fifth hotel-money pipeline. Three of the prior four wrote specs that were never implemented, and
that fact is load-bearing for this ticket — see §3. Downstream stages must not re-open settled questions.

| Dimension | Traveler question | Owner |
|---|---|---|
| Total stay cost | How much, for how many nights, including what | `docs/pipeline/hotel-total-stay-cost/` |
| Payment timing | *When* does the stay price leave my account, and who takes it | `docs/pipeline/hotel-payment-timing/` |
| Payment options | Does this rate offer a genuine choice of payment path, and which methods pay the stay price | `docs/pipeline/hotel-payment-options/` |
| Deposits & holds | What additional funds are temporarily restricted, how much, released when | `docs/pipeline/hotel-deposit-hold{,s}/` |
| Settlement currency | In which currency does the charge settle | `docs/pipeline/local-currency-payment/` |
| **This ticket** | **Will the specific card in my wallet clear every gate this stay puts in front of it** | this doc |

The distinction is not cosmetic. `hotel-payment-options` asks a property-side question — *what does this rate
accept?* This ticket asks the traveler-side question — *does what I hold satisfy it, at every point where it
will be tested?* Those diverge whenever a stay has more than one money event, which is most stays.

**Explicitly out of scope:** charge-event timing and collector identity (payment-timing owns both, and this
ticket consumes its vocabulary rather than restating it); option plurality and the "2 ways to pay" supplement
(payment-options); deposit and hold *amounts*, basis, and release windows (deposit-hold); currency of
settlement; rate booking restrictions (`rate-eligibility`). This ticket never introduces a second timing model.

---

## 1. User pain point

**A traveler cannot tell whether the payment instrument they actually hold — most consequentially a debit
card, a prepaid card, or cash — will be accepted at every gate this stay tests it against, because expaify
carries no method-acceptance evidence at all and the one method-shaped string it can render describes a
deposit rather than the stay.**

The failure this produces is not a mispriced booking. It is a traveler who completes an external booking
believing they are done, arrives at the property, and is refused at check-in because the card that paid is
not a card the property will accept for the incidental hold. At that point the stay may be non-refundable and
the traveler is standing in a lobby in another country. This is the highest-severity payment failure in the
hotel flow and it is the one the existing four pipelines are structurally unable to catch, for the reason in §2.

## 2. Why this is a distinct problem: acceptance is per-gate, not per-stay

A hotel stay tests a payment instrument at up to three separate gates, and each gate can have a different
accepted-method set:

| Gate | What is tested | Instrument that is tested |
|---|---|---|
| **G1 — Booking** | Prepayment, or a card guarantee that holds the reservation | The card entered on the partner site |
| **G2 — Property settlement** | The stay price itself, when it is paid at the property | The instrument physically presented at the desk |
| **G3 — Property hold** | The refundable deposit or incidental authorization | The instrument physically presented at the desk |

The canonical failure lives in the seam between G1 and G3. A debit card clears G1 without complaint — the
partner charges it or guarantees against it — and is then refused at G3, because a large share of properties
will not authorize incidentals against a debit or prepaid card, and some require a credit card in the
registering guest's name regardless of how the stay was paid. Cash is the mirror case: it can satisfy G2 at
properties that accept it while being categorically incapable of satisfying G3.

Neither prior pipeline sees this. `hotel-payment-options` scopes methods **for the stay price**, which is G1
and G2 — its own discovery says so and explicitly disclaims holds. `hotel-deposit-hold{,s}` scopes the hold's
*amount and mechanism*, not whether the traveler's instrument can bear it. A product could implement both
specs exactly as written, in full, and still walk a debit-card traveler into a check-in refusal. That seam is
this ticket's entire subject.

This also fixes the meaning of "pay-at-property requirements" in the ticket: it is G2 **and** G3 together,
because they share one property, one desk, and one physically presented instrument. Splitting them across two
disclosures is what produced the seam.

---

## 3. Measurable signal that the problem exists

All five signals are source-verified in this worktree at the commit under `agent/UXD-HOTEL-PAYMENT-METHOD-01`.

**3.1 — Method-acceptance evidence coverage is 0%, and there is no type that could hold it.**
`HotelOffer` (`lib/types.ts:751`) carries `pricePerNight`, `fundsPolicy`, `rateEligibility`, `admissionPolicy`,
`taxEvidence`, and eleven other evidence fields. It carries no accepted-method field for any gate.
`BookingHotelContext` (`lib/booking/config.ts:77`) mirrors this: nineteen evidence fields forwarded to the
handoff, none of them method acceptance. Coverage is therefore not low — it is structurally unrepresentable.

**3.2 — The two specs that would have addressed part of this were never implemented.**
`docs/pipeline/hotel-payment-timing/` and `docs/pipeline/hotel-payment-options/` both terminate at UXDES.
`git log` shows UXD → UXR → UXDES commits for each and no UI or DEV stage. `lib/hotels/` contains
`admissionPolicy`, `fundsPolicy`, `locationEvidence`, `priceDisclosure`, `rateEligibility`, `searchCriteria`,
and `smokingPolicy` — there is no `paymentTiming.ts`, and the `HotelPaymentTimingStatement` that the
payment-options design spec composes over does not exist in code. Downstream stages must treat the payment
disclosure surface as **greenfield**, not as an extension point, while still honouring those specs' vocabulary
so a later implementation does not fork.

**3.3 — The one method-shaped string the product can render is about a deposit, and is labelled as if it
were about acceptance.** `HotelFundsEvidenceRecord.paymentMethodWording` (`lib/types.ts:435`) is normalized at
`lib/hotels/fundsPolicy.ts:139` and rendered by `HotelFundsPolicyPanel.tsx:232` under the bare label
`Payment method`, inside the deposit-and-hold block. The field's true meaning — documented in the
payment-options discovery — is *which method this hold applies to*. A traveler reading `Payment method: Visa,
Mastercard` beneath a deposit will reasonably conclude those cards are accepted for the stay. That is
precisely the unsupported-as-accepted inference this ticket's constraint forbids, and it is live in the
component contract today. It does not currently reach users only because of 3.4.

**3.4 — Supply is hardcoded absent, so the deposit surface renders one state forever.**
`HotellookProvider` sets `fundsPolicy: createNotReturnedHotelFundsPolicy('Hotellook')` unconditionally at
`lib/providers/hotellook.ts:407` and `:536`. Every hotel result therefore shows *"Deposit and hold policy not
provided. Additional available funds may still be required."* (`HotelFundsPolicyPanel.tsx:137`). A traveler
learns that some unnamed amount may be restricted, on an unnamed instrument, on every single result — which
is not a decision input, and habituates travelers to skip the block where G3 evidence would appear.

**3.5 — Payment-stage failure is measurable in one direction only.**
`HOTEL_RETURN_REASONS` (`app/book/BookingFlow.tsx:66`) offers `pay_at_property_amount_unexpected` — an
*amount* surprise. There is no reason value for *my method was not accepted* or *a credit card was required*.
`hotel_handoff_return_reason_selected` consequently cannot distinguish a price objection from an acceptance
objection, and today's abandonment data cannot be honestly attributed to method uncertainty in either
direction. Adding that reason value is the cheapest instrument in this pipeline and should precede any
disclosure work.

---

## 4. Measurement plan

Baseline before judging any disclosure. Missing evidence and provider-confirmed acceptance must never collapse
into one number.

- **Per-gate evidence completeness (primary supply metric).** Among normalized hotel offers, report the share
  carrying acceptance evidence separately for G1, G2, and G3, in the five states already used across this
  codebase (`complete`, `partial`, `explicit_none`, `not_returned`, `conflicting`). Segment by provider and by
  property-versus-selected-rate scope. A single blended "payment coverage" figure is prohibited: it would hide
  the G1/G3 seam that motivates the ticket.
- **Instrument-fit comprehension (primary traveler metric).** Share of first-time travelers who, before the
  outbound CTA, correctly state (a) whether a credit card is required at the property, (b) whether their debit
  or prepaid card is documented as sufficient for the hold, and (c) when the provider has not said. A correct
  *"this was not confirmed"* counts as success; a confident wrong *"my card is fine"* is the failure mode being
  measured and must be reported separately from ordinary uncertainty.
- **Payment-stage failure rate.** Once the return-reason gap in 3.5 is closed, track method-rejection returns
  as a share of hotel handoffs, split G1 versus G3. This is the metric the ticket's success statement rides on.
- **Exit after payment-condition exposure.** Among travelers who open the payment disclosure, measure
  abandonment versus continue, broken down by state. A high exit on a *credit-card-required* state is a
  correct outcome — the traveler was saved a lobby refusal — and must be reported as averted failure, not
  churn. A high exit on `not_returned` is a copy defect.
- **Conflation rate (guards the §5 constraint).** Share of travelers who, shown a deposit record carrying
  `paymentMethodWording`, incorrectly infer that the named method is accepted for the stay price. Target zero;
  any non-zero result blocks the disclosure from shipping.

---

## 5. Constraints the solution must respect

1. **Acceptance and obligation are different facts and must never share a label.** A method named on a deposit
   or hold record states which instrument that *obligation* applies to; it is not evidence that the instrument
   can pay the stay. `paymentMethodWording` must be relabelled to bind it to its obligation, and no acceptance
   cue may be derived from it. This is a data-integrity constraint, not a copy preference.
2. **Unsupported and unknown must never render as accepted.** Absent evidence renders as an explicit
   not-confirmed state naming the gate it covers. The product must not infer acceptance from a provider's
   silence, from a competitor's typical policy, from the fact that a booking partner takes a card, or from
   the deeplink target's own checkout. Nothing may present a method as accepted unless a provider stated it,
   scoped to a gate.
3. **Zero supply must not cost the traveler attention.** With coverage at 0% (3.1, 3.4), no per-result
   warning-toned banner may be added — the deposit block already demonstrates the habituation failure that
   produces. Absent evidence belongs in one dataset-level statement, not repeated on every card. Accessibility
   and 375px integrity are non-negotiable: the disclosure must be reachable and legible by keyboard and screen
   reader without displacing price or Deal Score, which remain primary.

---

## 6. Success statement

**This is solved when a first-time traveler holding a debit or prepaid card can tell, before leaving expaify,
whether that card is documented as sufficient to complete the stay at the property — or that the provider did
not confirm it — without inferring acceptance from a deposit record and without discovering the answer at
check-in.**

### 6.1 The smallest reliable cue set

The ticket asks for the *smallest* set. Four cues survive; each is justified by a decision the traveler cannot
make without it, and each is scoped to a gate.

| # | Cue | Decision it enables | State vocabulary |
|---|---|---|---|
| 1 | **Credit card required at the property** | The single highest-severity go/no-go. Answers G3, and G2 where the stay is paid on site. | `required` / `not_required` / `not_confirmed` |
| 2 | **Instrument classes accepted at the property** — credit, debit, prepaid, cash — for G2 and G3 together | Lets a traveler holding a non-credit instrument self-select out before booking | per class: `accepted` / `not_accepted` / `not_confirmed` |
| 3 | **Whether the booking gate (G1) accepts a different set than the property gate** | Names the seam explicitly; without it cue 2 reads as covering the whole stay | `same` / `differs` / `not_confirmed` |
| 4 | **Scope, source, and checked-at** | Distinguishes a property-level fact from a selected-rate fact and dates it | reuses existing `HotelEvidenceScope` + source-label pattern |

**Deliberately cut, and why.** Card *brand* lists (Visa/Amex/JCB) — brand-level acceptance changes the decision
far less often than class-level does, and brand data is the least reliable field providers return. Collector
identity and charge timing — owned by `hotel-payment-timing`. Option plurality and "2 ways to pay" — owned by
`hotel-payment-options`. Hold amounts and release windows — owned by `hotel-deposit-hold`. Method-dependent fee
differences — no provider in this stack supplies them. Digital wallets — no acceptance data exists, and an
unknown-state row per wallet is attention cost with no decision value.

If downstream stages can only deliver one cue, it is cue 1. It carries most of the harm in §1 at the lowest
supply cost, and it is expressible today as a single tri-state field on `HotelOffer` forwarded through
`BookingHotelContext`.

---

## 7. Handoff

Research (`UXR-HOTEL-PAYMENT-METHOD-01`) must:
- audit `HotelCard`, `HotelFundsPolicyPanel`, and `BookingFlow` against the per-gate model in §2, reading the
  source rather than these citations;
- resolve whether any reachable provider (Hotellook, `bookingComHotelsRapidApi`, `hotelbeds`) supplies
  acceptance evidence for any gate — the answer determines whether §6.1 is a disclosure spec or a
  capability-and-honest-absence spec, and §3.4 predicts the latter;
- read `hotel-payment-timing/03-design.md` and `hotel-payment-options/03-design.md` and state explicitly which
  of their unimplemented contracts this feature composes over versus supersedes, given 3.2;
- specify the relabelling of `paymentMethodWording` required by constraint 1;
- produce 3–5 testable directives, including the exact `HOTEL_RETURN_REASONS` addition from 3.5.
