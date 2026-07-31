# UXD-HOTEL-DEPOSIT-HOLD-01 — Deposit and Incidental-Hold Clarity at Result Selection

**Stage:** UX Discovery · **Ticket:** UXD-HOTEL-DEPOSIT-HOLD-01 · **Priority:** P0
**Date:** 2026-07-31 · **Feature slug:** `hotel-deposit-hold`
**Downstream:** `UXR-HOTEL-DEPOSIT-HOLD-01`

---

## Scope Boundary: this is the second deposit ticket, not a re-run of the first

A prior pipeline (`docs/pipeline/hotel-deposit-holds/`, dated 2026-07-22) already scoped, designed, and
shipped the **disclosure layer** for this dimension. That work exists in code and is good:
`HotelFundsPolicyEvidence` in `lib/types.ts:314`, the normalizer in `lib/hotels/fundsPolicy.ts`, the
five-state panel in `app/components/HotelFundsPolicyPanel.tsx`, handoff persistence through
`lib/booking/config.ts:807`, and exposure/engagement analytics in
`app/components/hotelFundsPolicyAnalytics.ts`.

**This ticket does not restate that.** It scopes the gap that opened *because* that work shipped and its
supply side did not. The prior discovery's own primary supply metric was policy-data coverage. That metric
is now measurable, and it reads zero. The disclosure system renders, on every result, the one state it was
designed to render least often.

Adjacent dimensions and their owners, for non-overlap:

| Dimension | Question | Owner |
|---|---|---|
| Total stay cost | *How much* for the whole stay, including what | `docs/pipeline/hotel-total-stay-cost/` |
| Payment timing | *When* the stay price leaves my account, and who takes it | `docs/pipeline/hotel-payment-timing/` |
| Cancellation | What it costs to change my mind | `docs/pipeline/hotel-cancellation-clarity/` |
| Deposit & hold disclosure contract | What a deposit/hold *is*, once evidence exists | `docs/pipeline/hotel-deposit-holds/` |
| **This ticket** | **Can a traveler use deposit/hold information to choose between results, given that no provider supplies it** | this doc |

Per the ticket constraint, nothing in this doc restates rate-payment timing. When the stay price is charged
is `hotel-payment-timing`'s question and must not be re-answered on the deposit surface.

---

## User Pain Point

Every hotel result carries an identical warning-toned "Deposit and hold policy not provided" banner, so a
traveler comparing properties learns only that expaify cannot answer the deposit question anywhere — a
signal that is uniform across the result set, therefore useless for choosing between rates, and that after
a few results reads as decoration rather than as the real financial unknown it represents.

---

## Who Is Affected And Where

**Who.** Travelers whose available card balance constrains the trip: debit-card users, travelers on
prepaid or low-limit cards, families and groups booking multiple rooms (deposits multiply per room),
and international travelers whose issuer holds settle slowly. For these travelers a $200 per-stay
incidental hold is not a footnote — it can be the difference between a viable and non-viable booking.

**Where.** The ticket names the result → detail → booking-handoff span. Concretely:

1. **Result scan** — `app/components/HotelCard.tsx:936`. Each bookable card renders
   `HotelFundsPolicyPanel` with `variant="summary"`. This is the surface where a traveler compares
   properties and it is the surface this ticket centers.
2. **Expanded detail** — `HotelCard.tsx:1076`, `variant="full"`.
3. **Outbound review** — `app/book/BookingFlow.tsx:1243`, before "Continue to booking partner".

The harm is specific to surface 1 and is a *comparison* harm, not a comprehension harm. The prior pipeline
solved comprehension: a traveler who reads the full panel does correctly understand what a hold is and that
its release timing is not guaranteed. What they cannot do is act on it. Every result says the same thing,
so the deposit dimension contributes exactly zero bits to rate selection. A traveler who cares about
deposits must either open every result to confirm they are all equally unknown, or — the likelier
behavior — stop reading the banner entirely and select on price alone, carrying an unquantified funds
risk into the handoff.

---

## Current, Measurable Signal

Four source-verifiable facts. All line references are current on this branch.

**1. Provider coverage for this dimension is 0%, and it is hardcoded, not merely absent.**
`lib/providers/hotellook.ts` is the only hotel provider reached by search (`app/api/search/route.ts:448`
sets `provider: 'Hotellook'`). Both of its offer-construction paths assign the same constant:

- `lib/providers/hotellook.ts:407` → `fundsPolicy: createNotReturnedHotelFundsPolicy('Hotellook')`
- `lib/providers/hotellook.ts:536` → identical

`lib/providers/bookingComRapidApi.ts` contains zero references to `fundsPolicy`. There is no code path in
this repository by which any hotel offer can carry a `complete`, `partial`, `explicit_none`, or
`conflicting` funds policy. Of the five states `HotelFundsPolicyState` defines, production can emit one.

**2. That one state renders as a warning on 100% of bookable results.**
`HotelFundsPolicyPanel.tsx:276` classes `not_returned` as a `warningState`, which selects
`bg-[color:var(--warning-soft)]` with `border-strong` (line 279). Every bookable `HotelCard` in a result
list therefore shows an identical amber block reading *"Deposit and hold policy not provided. Additional
available funds may still be required."* (`summaryCopy`, line 137). A warning that fires on every row of a
list is not a warning; it is a background texture, and it competes for attention with the parking,
smoking, admission, and eligibility lines rendered immediately around it (`HotelCard.tsx:925–957`).

**3. The type system cannot distinguish "provider has no such contract" from "provider was asked and
returned nothing for this offer" — and every adjacent dimension can.**
`HotelOffer` carries `rateEligibilityCapability` (`lib/types.ts:576`) and `admissionPolicyCapability`
(`lib/types.ts:578`). Their doc comments are explicit about why:

> *"Declares whether an adapter's contract can explicitly return `restricted` and `clear` per family."*
> — `lib/types.ts:466`

Hotellook sets both to their `UNSUPPORTED` constants (`hotellook.ts:408–409`), which lets those surfaces
say *this provider does not carry this data* rather than *this property has no rule*.
`HotelFundsPolicyEvidence` (`lib/types.ts:314`) has **no capability field**. Its `not_returned` state
therefore collapses two facts the ticket explicitly requires be distinguished: a provider-level
unavailability that is true of all 40 results identically, and an offer-level absence that would be real
information. This is the precise mechanism by which the banner became uninformative, and it is a
one-field-shaped gap in an otherwise well-built contract.

**4. Analytics can already prove or refute the exit claim, and have not been read.**
`app/components/hotelFundsPolicyAnalytics.ts` emits exposure, details-open, and confirmation events
carrying evidence state and provider. The ticket asks to *"measure reduction in deposit-related exits."*
That reduction cannot be claimed, because with one reachable state there is no contrast group: every
recorded event is `not_returned`. Any baseline must be established before, not after, a design change.

---

## Measurement Plan

Establish contrast before claiming improvement. "No policy returned" must never be scored as "no deposit."

- **Capability-vs-coverage split (primary supply metric).** Report two numbers separately: the share of
  offers whose *provider* declares a deposit/hold contract at all, and — among those — the share with
  per-field evidence (mechanism, amount + basis, application timing, release/return wording, scope).
  Today these are 0% and undefined. A design that improves only the second number while the first stays at
  zero has changed nothing a traveler can use.
- **Comparative discrimination (primary traveler metric).** Given a result set, can a first-time traveler
  correctly state whether the deposit question is *answerable at all here*, and — where evidence differs
  between results — which result carries the larger or more certain obligation? A correct
  "expaify cannot tell me this for any of these" counts as a pass; today that is the only correct answer
  and the current UI arguably fails even that, by implying per-property specificity it does not have.
- **Attention cost of the uniform banner.** Measure details-opens and scan-depth on the summary panel
  across a result list. A per-result open rate that decays sharply down the list is direct evidence of
  banner blindness and should be treated as the failure signal for the current design.
- **Deposit-attributed exits.** Instrument handoff abandonment against funds-policy state, but report it
  as correlation until a traveler-stated reason exists. Do not attribute exits to deposits from dwell
  time alone.
- **False-reassurance check (safety metric, must not regress).** The share of travelers who, after any new
  design, believe a property has *no* deposit when the provider merely did not say. This metric can only
  get worse from a change; it must be watched from the first iteration.

---

## Minimum Evidence Required To Validate

Research must not assume a new provider is procurable. The scoped opportunity is to make the *absence*
honest and non-competitive for attention, and to make the contract ready for evidence if it arrives.

1. **A capability declaration for this dimension**, matching the shape already proven twice in this
   codebase (`HotelRateEligibilityCapability`, `HotelAdmissionPolicyCapability`). Without it no copy can
   truthfully separate "this provider never carries deposit data" from "this property reported none."
2. **A provider-level statement placed once, not per result.** If the answer is identical for all 40
   results, the disclosure belongs where the result set is described, not repeated 40 times. Research must
   test placement and whether removal from the per-card scan is safe.
3. **Confirmed-value formatting rules** for the day a provider supplies data: `{ priceCents, currency }`
   with documented basis, ranges and percentages preserved as ranges and percentages, never averaged into
   a single number, never estimated by expaify.
4. **An explicit non-estimation rule.** expaify must not infer a deposit amount from star class, price
   band, geography, or chain. There is no evidence source for such an inference and a wrong number here is
   financially material.
5. **Verification that the deposit surface does not re-answer payment timing.** Per ticket constraint, the
   deposit panel must not describe when the stay price is charged.

Research should determine whether a per-result deposit signal is worth showing *at all* under 0% coverage,
or whether the honest design is a single set-level statement plus full evidence retained in detail and at
handoff. That is a real open question and this discovery deliberately does not pre-answer it.

---

## Constraints

1. **A hold is not a price, and an unknown is not a zero.** No deposit or hold value may enter Deal Score,
   be added to the nightly rate, or be described as a tax or fee. `not_returned` may never render as
   "no deposit." Any amount uses `{ priceCents, currency }` with a documented basis — never a float, never
   an expaify-generated estimate. A hold must be explained as reducing available funds even when never
   charged.
2. **Provenance is part of the claim.** Every deposit statement must carry source, scope
   (property / room / rate / selected stay), and freshness, and must distinguish provider-declared
   incapability from offer-level absence. A property-level rule may not be presented as confirmed for the
   selected room or rate. Provider data flows only through `lib/providers`; adapters return `Result<T>`
   and never throw.
3. **Attention is a budget shared with four other policy lines.** `HotelCard` already renders eligibility,
   admission, parking, smoking, and funds signals in the scan region. Any change must reduce, not add to,
   per-result policy chrome, must hold at 375px without overlap or truncation of a monetary value, and must
   keep the deposit disclosure reachable by keyboard with a visible focus ring and an accurate accessible
   name.

---

## Success Statement

This is solved when a first-time traveler comparing hotel results can tell, within one scan of the result
list and without opening any card, whether deposit and incidental-hold information is available to them at
all — and can reach the full provider evidence for a chosen property before the outbound handoff — without
mistaking a provider's silence for a property that charges no deposit, and without a per-result warning
that repeats identically on every row until they stop reading it.

---

## Handoff

`UXR-HOTEL-DEPOSIT-HOLD-01`. Research must read this doc **and** `docs/pipeline/hotel-deposit-holds/`
(all three stages), audit `HotelCard.tsx`, `HotelFundsPolicyPanel.tsx`, `lib/hotels/fundsPolicy.ts`,
`lib/providers/hotellook.ts`, and `lib/types.ts:314` directly, and compare against how Booking.com and
Google Hotels present property-level deposit and incidental-charge information at the result-list tier
versus the detail tier — specifically, whether either shows a deposit signal per result when supply is
sparse. Output 3–5 testable directives to `docs/pipeline/hotel-deposit-hold/02-research.md`.
