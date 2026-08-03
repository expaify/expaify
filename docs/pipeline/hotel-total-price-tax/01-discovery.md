# UXD-HOTEL-TOTAL-PRICE-TAX-01: Hotel Total-Price and Tax Confidence

Date: 2026-08-03  
Stage: UX Discovery  
Priority: P0  
Affected flow: hotel deal comparison through the expaify booking summary

## Scope Boundary

The existing `docs/pipeline/hotel-total-stay-cost/` work defines the adjacent distinction between a provider total, a partial total, an expaify-computed lodging estimate, and a nightly-only fallback. This ticket does not reopen that classification or add another generic total-price feature.

This ticket owns the unresolved layer inside those states: whether taxes and mandatory property charges are separately documented, whether either is still unknown or payable at the property, and how expaify can measure confidence loss and price surprise for itemized versus incomplete disclosures. Optional purchases and incidental holds remain outside total-price disclosure.

## User Pain Point

A traveler loses confidence after choosing a hotel rate but before leaving expaify because the product says only that “taxes and fees” are excluded or unconfirmed, so the traveler cannot tell whether the comparison omits government taxes, mandatory property charges, or both—or how much the provider total may change.

## Who Is Affected and Where Confidence Breaks

The problem affects travelers comparing hotel deals, especially multi-night stays and properties with mandatory resort, destination, facility, cleaning, or similar charges.

Confidence breaks across two consecutive decisions:

1. **Deal comparison:** the traveler compares a prominent nightly rate and Deal Score. `HotelCard` labels the figure “per night before taxes and fees” and separately says “Mandatory property fees: not confirmed,” but supplies no tax amount, mandatory-charge amount, stay subtotal, or total. A lower nightly rate can therefore look cheaper while carrying a larger unavoidable charge.
2. **Booking summary and provider handoff:** the last expaify-controlled screen repeats the observed nightly rate and tells the traveler to check the provider’s final total and amount due at the property. The user reaches the commitment point without knowing which price elements expaify checked, which are absent, or whether “fees” means a mandatory charge rather than an optional purchase.

The point of trust loss is not the provider checkout itself. It occurs earlier, when a traveler tries to reconcile the compared rate with an expected payable amount and expaify can offer only a combined disclaimer.

## Current Implementation Signal

The gap is structural and visible in the current code:

- `HotelOffer` in `lib/types.ts` carries only `pricePerNight: Money` and the single basis `per_night_before_taxes_fees`. It cannot carry a tax amount, mandatory property-charge amount, stay total, inclusion status, or pay-at-property status.
- `app/components/HotelCard.tsx` renders “per night before taxes and fees” and “Mandatory property fees: not confirmed by {provider}.” Its expanded “Price scope” repeats the same uncertainty rather than itemizing what is known.
- `app/book/BookingFlow.tsx` again shows only the nightly rate and tells the traveler to check the final total and any amount due at the property on the partner site. Taxes and mandatory property charges are not independently represented.
- The booking summary offers a return report with the combined reason `price_or_fees_mismatch`. It does not distinguish a tax surprise from a mandatory property-charge surprise.
- The UI emits `hotel_handoff_return_reason_selected`, but `app/api/analytics/route.ts` does not register that event. The report therefore does not persist. Handoff views, clicks, and returns are registered, but none records the completeness of the price disclosure shown.

These signals establish that expaify currently presents one uncertainty bucket where the user needs at least two independently sourced facts.

## Measurable Signal and Baseline

The ticket asks for rate-to-booking abandonment and price-surprise reports by disclosure quality. Neither comparison is measurable end to end today.

### 1. Rate-to-booking abandonment

expaify can currently observe booking-summary views, provider-handoff clicks, and returns. It cannot observe a completed provider booking because no affiliate conversion or provider postback is present in the scoped flow.

Until a conversion signal exists, the valid product proxy is:

`handoff abandonment = booking summaries viewed without a provider-handoff click / booking summaries viewed`

The supporting diagnostic is return rate after handoff. Both measures must be segmented by the disclosure state actually shown, at minimum:

- fully itemized: taxes and mandatory property charges are each documented;
- partially itemized: one category is documented and the other is explicitly unknown, or a provider total names an excluded mandatory charge;
- incomplete: only a nightly rate or lodging estimate is available and tax/property-charge amounts are not documented.

A claim about **booking abandonment** must not be made from this proxy. True booking conversion requires a separately authorized affiliate/provider conversion signal.

### 2. Price-surprise reports

The current combined `price_or_fees_mismatch` reason cannot identify the source of surprise and its event does not persist. The minimum measurable categories are:

- tax amount differed or appeared later;
- mandatory property charge differed or appeared later;
- displayed total differed for another reason;
- amount due at the property was unexpected.

The primary comparison is surprise reports per returned handoff, segmented by the disclosure state shown before the click. Raw report counts are not comparable because exposure volumes will differ.

### 3. Discovery baseline

Before implementation, run a moderated comparison using the same multi-night hotel offer in two treatments: the current combined disclaimer and a clearly itemized disclosure. Before handoff, ask participants to state:

1. the amount they expect the provider to show;
2. which part is tax;
3. which part is a mandatory property charge;
4. what may still change and where it is payable.

Record correct expectation rate and confidence on a 1–5 scale. The current screen’s baseline is that questions 1–3 cannot be answered from available data, even after opening details.

## Required Disclosure and Fallback States

Downstream work must preserve four cost facts as separate dimensions: lodging amount, taxes, mandatory property charges, and provider total. A single “taxes and fees” field is insufficient.

The flow requires these evidence states:

1. **Fully itemized total:** the provider supplies a stay total and separately documents taxes and mandatory property charges, including whether charges are included in the total or due at the property.
2. **Total without complete itemization:** the provider supplies a total but does not separately document tax and property-charge amounts. The total may be shown as provider-supplied, but the missing breakdown must remain explicit.
3. **Partially itemized:** tax or mandatory property-charge evidence is available while the other category is missing, excluded, variable, or due later. Known values remain visible; an unknown category must never be treated as zero.
4. **Incomplete total:** only a nightly rate or an expaify lodging subtotal estimate is available. It must be clear that no provider-confirmed total exists and that both tax and mandatory property-charge amounts require confirmation.
5. **Price unavailable or evidence failed:** no total is inferred. The user sees a direct unavailable/retry-or-confirm fallback and is not given a numeric placeholder.

These are evidence requirements, not final UI treatments. UXR must determine the smallest hierarchy that lets a traveler distinguish them at comparison and handoff without turning the result card into a receipt.

## Constraints

1. **Keep taxes and mandatory property charges distinct.** Taxes are government-imposed amounts; mandatory property charges are property/provider-imposed obligations required for the stay. Optional add-ons, refundable incidental holds, and conditional purchases must not be folded into either category or into the stay total without provider evidence.
2. **Preserve uncertainty and provenance per category.** Each amount or inclusion claim must retain its provider source, scope, and evidence state. Missing, variable, excluded, conflicting, and payable-at-property are not zero and must not be collapsed into a confident total.
3. **Never promise a final payable amount the data cannot support.** Money remains integer minor units, provider totals stay separate from the nightly rate used by Deal Score, and expaify arithmetic is labeled as an estimate rather than attributed to a provider. When a complete total is unavailable, the fallback must say exactly which category requires confirmation.

## Success Statement

This is solved when a first-time user can compare a hotel deal and reach the provider handoff while correctly stating the lodging amount, tax status, mandatory property-charge status, and which amount may still change, without encountering a combined “taxes and fees” disclaimer that makes an incomplete price look complete.

## Handoff Questions for UXR

UXR should read `docs/pipeline/hotel-total-stay-cost/01-discovery.md`, `02-research.md`, and `03-design.md` first and treat their total-cost classes as inherited.

Research must answer:

1. At scan level, what is the minimum always-visible information that prevents an incomplete nightly rate from winning a misleading comparison?
2. How should Booking.com, Google Hotels, or a comparable reference distinguish taxes from mandatory property charges, inclusions from pay-at-property amounts, and a supplied total from a fully itemized total?
3. Which exact missing-data states must remain visible on `HotelCard` and in the non-collapsible pre-handoff summary?
4. What disclosure-state dimension and event taxonomy are required to compare handoff abandonment and surprise reports without claiming provider booking conversion?
5. Can the existing `HotelFundsPolicyEvidence` vocabulary represent pay-at-property obligations without confusing deposits/holds with charges included in total price, or must the concepts remain linked but separate?

## Out-of-Scope Findings

- Actual provider booking completion is not observable. Adding affiliate conversion/postback tracking requires separate authorization and is not part of UXD.
- The existing total-stay-cost design has not yet been implemented; this report does not implement or revise it.
- `hotel_handoff_return_reason_selected` is emitted but rejected by the analytics allowlist. This blocks the named surprise-report metric, but fixing analytics is a later DEV concern.
- Price freshness remains a separate trust problem: hotel surfaces still show “Last-checked time unavailable.” It is not addressed here.
- No provider adapter currently returns hotel tax or mandatory property-charge itemization. Fully and partially itemized states are therefore provider-data-gated and must not be fabricated for UI acceptance testing.
