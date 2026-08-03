# UXR-HOTEL-TOTAL-PRICE-TAX-01: Hotel Total-Price and Tax Confidence Research

Date: 2026-08-03  
Stage: UX Research  
Priority: P0  
Affected flow: hotel comparison through provider handoff

## 0. Decision Summary

The discovery diagnosis holds, but the repair must not add another stay-total
classification. The four outer classes in
`docs/pipeline/hotel-total-stay-cost/03-design.md` remain authoritative:
`provider_total`, `partial_total`, `expaify_estimate`, and `nightly_only`.

This ticket adds a separate composition layer inside those classes:

1. taxes and mandatory property charges remain two independently evidenced
   categories;
2. each category says whether it is itemized, explicitly included without a
   separate amount, known to apply but unpriced, explicitly absent, not
   returned, or conflicting;
3. inclusion in the displayed provider total and collection timing are separate
   facts—a charge can be included in the total and still be payable at the
   property; and
4. one derived `price_disclosure_state` supports scan hierarchy and measurement
   without changing the inherited total class.

At comparison, the minimum honest hierarchy is the inherited stay-cost line
plus one always-visible two-clause composition line:

> `Taxes: {status} · Mandatory property charges: {status}`

The current production fallback is:

> `Taxes: not confirmed · Mandatory property charges: not confirmed`

It replaces, rather than sits beside, the current combined “before taxes and
fees” disclaimer and the separate static fee sentence. Detail and handoff then
expand the same two clauses into amount, inclusion, collection timing, and
provenance. This prevents a low nightly rate from winning a scan while keeping
the card from becoming a receipt.

All provider-itemized states are DEV-gated. Hotellook returns neither category,
so production remains explicitly incomplete; no tax or charge may be inferred.

## 1. Inputs and Scope Boundary

Read as settled and not reopened:

- `docs/pipeline/hotel-total-price-tax/01-discovery.md`.
- `docs/pipeline/hotel-total-stay-cost/01-discovery.md`, `02-research.md`, and
  `03-design.md`: four stay-cost classes, provider-versus-expaify attribution,
  no generic fee range, and no stay total in Deal Score.
- `docs/pipeline/hotel-resort-fee/02-research.md` and `03-design.md`: deposits and
  card holds stay separate from mandatory property charges; the honest current
  fee state is `not_confirmed`; the planned fee evidence is offer-bound and
  provider-attributed.

This brief does not redesign nightly/stay-total classification, add optional or
conditional purchases, fold refundable deposits or authorization holds into
price, add provider conversion tracking, or change Deal Score. It owns the
composition, fallback, handoff-continuity, and measurement rules that were not
resolved by those adjacent pipelines.

Current implementation audited today:

`lib/types.ts`, `lib/providers/hotellook.ts`, `lib/booking/config.ts`,
`app/components/HotelCard.tsx`, `app/book/BookingFlow.tsx`,
`app/api/analytics/route.ts`, and `lib/analytics.ts`.

Reference guidance checked today:

- [Booking.com Demand API accommodation pricing](https://developers.booking.com/demand/docs/accommodations/prices-accommodations)
- [Booking.com extra-charge calculation](https://developers.booking.com/demand/docs/accommodations/charge-calculation)
- [Booking.com price-display guidance](https://developers.booking.com/demand/docs/accommodations/display-prices)
- [Booking.com pricing and payment examples](https://developers.booking.com/demand/docs/accommodations/pricing-examples)
- [Google Hotel Center taxes and fees policy](https://support.google.com/hotelprices/answer/6064432?hl=en-GB)
- [Google Hotel Center tax/fee itemization fields](https://support.google.com/hotelprices/answer/11390139?hl=en)

## 2. Current-Code Evidence

### 2.1 The offer contract has no composition evidence

`HotelOffer` carries `pricePerNight: Money` and only the optional literal
`priceBasis?: 'per_night_before_taxes_fees'` (`lib/types.ts:687-705`). It has no
stay total, tax category, mandatory-charge category, inclusion relationship, or
collection timing. `BookingHotelContext` repeats the same one-member basis, so
handoff cannot preserve evidence the offer cannot express.

Hotellook normalizes `priceFrom` into `pricePerNight` in both response paths
(`lib/providers/hotellook.ts:388-411, 506-535`). It supplies neither
`priceBasis` nor any tax/charge fact. Therefore every claim beyond the sourced
money is expaify fallback copy, not provider evidence.

### 2.2 The UI exposes two uncertainty messages but no answer

The collapsed `HotelCard` renders:

- `per night before taxes and fees` inside the provider-attributed price block
  (`HotelCard.tsx:363-376`); and
- `Mandatory property fees: not confirmed by {Provider}` as a separate line
  (`HotelCard.tsx:799-804, 980-983`).

The expanded Price scope repeats both ideas and adds “Check the provider's total
and any amount due at the property” (`HotelCard.tsx:1140-1150`). The composed
review action says “before taxes and fees” and repeats the static fee fallback
(`HotelCard.tsx:835-836`).

This is a meaningful improvement over one combined disclaimer: mandatory
property fees are now named. It is still not a composition model. A traveler
cannot tell whether taxes are known, whether a fee applies, whether either is
inside a provider total, or whether “due at the property” is an amount already
counted in that total.

### 2.3 Handoff repeats the same ambiguity at the commitment boundary

`BookingFlow` derives `per night before taxes and fees` from the one-member
basis (`BookingFlow.tsx:253-255`). Its visible pre-CTA copy says mandatory
property fees are unconfirmed and asks the user to check the final total and any
amount due at the property (`:1067-1077, :1158-1160`). The accessible CTA name
combines the nightly basis and fee fallback but still supplies no independent
tax status or inclusion/payment relationship.

The sentence at `:1141-1143` says the provider shows “final total, taxes and
fees,” but the expaify screen cannot state which of those it already observed.
This shifts reconciliation work to the provider rather than preserving the
evidence shown during comparison.

### 2.4 The existing funds-policy vocabulary cannot represent this obligation

`HotelFundsPolicyEvidence` models refundable deposits and authorization holds:
its obligation types are `authorization_hold`, `refundable_deposit`, and
`other_refundable_obligation`, and its terminal action is `refund | release`
(`lib/types.ts:386-458`). A mandatory non-refundable charge has neither shape.

The funds vocabulary is useful precedent for evidence quality, source, scope,
and missing fields. It is not a type to widen or reuse for stay-price
composition. “Included in total” describes arithmetic scope; “pay at property”
describes collection; a hold describes temporary card capacity. Conflating the
three would recreate the user confusion the resort-fee repair just removed.

### 2.5 The named handoff metrics do not persist today

The discovery correctly notes that `hotel_handoff_return_reason_selected` is
not registered in `EVENT_PROPERTIES`. The audit found a wider blocker:

- `hotel_handoff_viewed` emits `policyState` and `obligationTypes`
  (`BookingFlow.tsx:750-759, 780-782`), but its allowlist permits neither
  (`app/api/analytics/route.ts:37`).
- `hotel_handoff_continue_clicked` includes those two fields plus
  `invoiceNeeded`, `invoiceReadinessStatus`, `helpViewed`, and
  `loyaltyDisclosureViewed` (`BookingFlow.tsx:970-977`); the allowlist permits
  none of those additions (`analytics/route.ts:38`).
- `hotel_handoff_returned` and `hotel_handoff_back_clicked` also emit the two
  disallowed funds-policy fields (`BookingFlow.tsx:945-951, 1052-1059` versus
  `analytics/route.ts:39-40`).
- the API rejects an event when the event name is absent, a key is not allowed,
  or a value has no validator. It does not partially retain valid properties.

Consequently, the current view, continue, return, back, and reason events all
fail validation. There is no valid pre-implementation behavioral baseline for
handoff non-continuation or price-surprise reports.

The return prompt itself is real and useful, but its single
`price_or_fees_mismatch` option (`BookingFlow.tsx:48-62`) cannot identify tax,
mandatory-charge, total, or payment-timing surprise.

## 3. Reference-Pattern Comparison

### 3.1 Booking.com separates display price, expected total, charge identity, and collection

Booking.com's Demand API distinguishes:

- `base`: lodging before charges;
- `book`: the display price including charges legally required in the prominent
  price;
- `total`: the expected full cost including non-conditional charges, whether
  collected online or by the property; and
- `chargeable_online`: the portion Booking.com collects online.

Charges retain an identity, calculation mode, total amount, and
included/excluded/conditional status. At order preview, mandatory charges are
`non_conditional`; each can independently say whether it is chargeable online.
Booking's display guidance says excluded/non-conditional charges should be
shown individually rather than regrouped into invented categories, and an
incalculable mandatory charge requires an explicit “not the total price”
boundary.

The transferable pattern is not Booking's field names. It is the independence
of four questions: what is the total, what is this charge, is it counted in the
shown total, and where is it collected.

### 3.2 Google separates government tax from mandatory non-government fees

Google's Hotel Center contract uses `<Tax>` for government-imposed amounts and
`<OtherFees>` for mandatory non-government hotel charges. Both are added to
`<Baserate>` to form the displayed total, including amounts collected at the
property. Optional charges are excluded. Google also supports an all-inclusive
price when the supplier cannot separate the components, but requires the
all-inclusive claim to be explicit rather than inferred from zeros.

Google's management view retains description, category, percentage/value,
application basis (room/night, person/stay, and related variants), room/rate
scope, and stay-date applicability. This validates the discovery requirement
to keep tax and mandatory property charges separate and to retain provider
scope rather than only a display string.

### 3.3 What expaify can adopt—and what it cannot

expaify can adopt the reference hierarchy:

- a mandatory charge affects comparison before handoff;
- tax and mandatory property charges are different categories;
- inclusion in total is distinct from payment location;
- an all-inclusive provider claim may be shown without inventing a breakdown;
  and
- missing/incalculable amounts remain explicit.

expaify cannot adopt supplier-contract silence. Booking.com and Google require
fee-complete inputs and treat mismatches as integration/accuracy failures.
Hotellook supplies no such evidence. On expaify, omission must mean “not
confirmed,” never zero, included, or no charge.

## 4. Exact Gap

| Decision fact | Current expaify | Reference pattern | Required delta |
|---|---|---|---|
| Stay-cost authority | Nightly-only fallback; inherited total classes not implemented | Sourced total is primary | Preserve inherited class and make its authority visible |
| Tax category | Hidden inside “taxes and fees” | Separate government-tax component | Independent tax evidence and fallback |
| Mandatory property charge | Static `not confirmed`; no amount/evidence | Named mandatory non-government charges affect total | Extend the planned provider evidence, do not reuse funds policy |
| Inclusion | “Before taxes and fees” assertion | Per-charge included/excluded/all-inclusive status | Store a provider-supplied total relationship |
| Collection | Generic “amount due at property” | Online/property collection independent of total inclusion | Store a separate collection location |
| Missing data | One combined disclaimer | Explicit incalculable/incomplete boundary | Category-specific missing state; unknown never becomes zero |
| Measurement | All scoped handoff payloads rejected | Stable exposure → action → return linkage | Attempt ID, disclosure state, valid allowlist, split surprise reasons |

## 5. Testable Design Directives for UXDES

### D1 — Keep the four stay-cost classes; add one derived disclosure state

Do not change `HotelStayCostState`. Derive a separate analytics/presentation
dimension from the inherited class plus the two category evidence objects:

```ts
type HotelPriceDisclosureState =
  | 'fully_itemized'
  | 'provider_total_breakdown_unknown'
  | 'partially_itemized'
  | 'incomplete'
  | 'unavailable'
```

Exact derivation, top-down:

1. `unavailable`: the inherited disclosure is `nightly_only` with
   `price_unavailable`.
2. `fully_itemized`: `provider_total`; both tax and mandatory-charge categories
   are `itemized` or `explicit_none`; every applicable category has a known
   relationship to the provider total and collection location; no category is
   conflicting.
3. `provider_total_breakdown_unknown`: a provider total exists and the provider
   explicitly says all required taxes and mandatory charges are included, but
   one or both category amounts are not separately supplied; **or** a provider
   total exists while neither category is documented. These two subcases use
   different detail copy but the same measurement stratum: a sourced total is
   visible without a complete breakdown.
4. `partially_itemized`: any category is documented while the other is missing,
   applicable-but-unpriced, excluded, or conflicting; every inherited
   `partial_total` maps here.
5. `incomplete`: `expaify_estimate` or priced `nightly_only` when neither
   category is documented.

The derived state never changes the money shown, total attribution, ranking, or
Deal Score. It describes disclosure quality only.

**Test:** one table-driven pure test covers every outer-class × tax-state ×
mandatory-charge-state combination, including explicit all-inclusive,
conflicting, and price-unavailable inputs. No UI independently re-derives it.

### D2 — Use one shared category grammar; keep category meaning explicit

Taxes and mandatory property charges use the same state grammar but remain
separate fields:

```ts
type HotelRequiredChargeState =
  | 'itemized'
  | 'included_unitemized'
  | 'applies_amount_unknown'
  | 'explicit_none'
  | 'not_returned'
  | 'conflicting'

type HotelChargeTotalRelationship = 'included' | 'excluded' | 'unknown'
type HotelChargeCollection = 'online' | 'property' | 'split' | 'unknown'
```

Each category evidence object must be offer-bound and carry `offerId`,
`supplier`, safe `sourceLabel`, supported `scope`, optional `fetchedAt`, and the
two independent relationship fields. `itemized` carries provider-named charge
records and provider-returned `Money` values. Preserve provider charge names;
do not recategorize or rename individual records. Category totals may render
only when supplied by the provider. expaify must not silently sum records and
attribute that arithmetic to the provider.

State boundaries:

- `itemized`: the provider supplies the category amount or named required-charge
  records with valid integer-minor-unit money.
- `included_unitemized`: the provider explicitly says the category is included
  in an all-inclusive/total amount but supplies no separate category amount.
- `applies_amount_unknown`: the provider says a required charge applies but its
  amount is absent, variable, or incalculable. This is not `not_returned`.
- `explicit_none`: accepted only from an adapter capability that can return an
  explicit negative for that category and scope. A numeric zero alone is not
  sufficient.
- `not_returned`: missing, malformed, unsupported, stale, mismatched offer or
  supplier, provider error, or loading failure.
- `conflicting`: two retained records disagree about existence, inclusion, or
  collection. Do not choose one or collapse to `not_returned`.

Optional and conditional purchases are invalid inputs. Refundable deposits and
holds remain in `HotelFundsPolicyEvidence` and never become charge records.

For mandatory property charges, this directive extends—rather than duplicates—
the DEV-gated `HotelMandatoryPropertyFeeEvidence` from
`hotel-resort-fee/03-design.md`: retain its offer/source/capability guards, add
multiple provider records plus total-relationship and collection fields, and
replace its “multiple fees degrade” limitation. For taxes, add the parallel
category evidence; do not create a combined `taxesAndFees` object.

**Test:** missing, error, unsupported capability, scope mismatch, and bad money
all preserve the correct state; no branch converts unknown to zero or
`explicit_none`; inclusion and collection can vary independently (including
`included` + `property`).

### D3 — At scan level, show one compact composition line under the inherited cost line

The smallest always-visible unit on `HotelCard` is:

1. the inherited stay-cost scan line; then
2. one wrapping category line: `Taxes: {status} · Mandatory property charges: {status}`.

Exact status rules:

| State | Scan status |
|---|---|
| `itemized`, exact category total | `{amount} {included|excluded}` |
| `itemized`, no provider category total | `itemized` |
| `included_unitemized` | `included; amount not itemized` |
| `applies_amount_unknown` | `applies; amount unknown` |
| `explicit_none` | `none reported by {Provider}` |
| `not_returned` | `not confirmed` |
| `conflicting` | `details conflict` |

“Included” and “excluded” refer only to the displayed provider total. When the
outer class is an expaify estimate or nightly-only, do not use either word;
there is no provider total to relate the category to.

Replace the current static `feeScanCopy` and the combined “before taxes and
fees” line in the disclosure unit. Do not render three adjacent caveats. Do not
add a receipt table, chip, icon, tooltip, warning badge, or focusable control.
At 375px the line may wrap but cannot clamp or truncate. Price and Deal Score
remain primary.

**Test:** a lower nightly rate with both categories unconfirmed visibly says so
before the user reaches the review action; assistive output uses the same order
and does not collapse the middle dot into an ambiguous phrase.

### D4 — In detail and handoff, use two rows and keep payment timing independent

Inside expanded Price scope and the non-collapsible pre-CTA handoff summary,
render exactly two category rows after the inherited cost claim:

- `Taxes`
- `Mandatory property charges`

Each row exposes, in this order:

1. state/amount;
2. relationship to the provider total (`Included in provider total`,
   `Not included in provider total`, or `Inclusion not confirmed`);
3. collection (`Collected online`, `Pay at property`, `Split between online and
   property`, or `Payment timing not confirmed`); and
4. provenance for provider-confirmed facts.

Suppress relationship and collection only for `explicit_none`; render their
unknown labels for every other state rather than omitting the fields. For an
expaify estimate or nightly-only state, the relationship copy is instead
`No provider total is available to confirm inclusion.`

If the provider explicitly supplies an all-inclusive total without a separate
breakdown, say:

> `Included in the provider total; separate amount not provided.`

If a charge applies but is incalculable, say:

> `Applies; amount not available. The price shown is not a complete payable total.`

If a provider total includes an amount collected later, both facts must appear:

> `Included in the provider total · Pay at property`

Never say “due later” without naming whether the amount is already included in
the displayed total. Never use “fees” alone to mean deposits, optional charges,
or mandatory property charges.

The two rows are always visible on the last expaify-controlled screen. Item
records may use the existing handoff/details disclosure only after the category
summary is visible; missing status cannot be collapsible.

**Test:** keyboard and screen-reader order is cost claim → Taxes → Mandatory
property charges → provider action. Loading/error degrades each affected row to
`not confirmed` without a spinner replacing the last known provider evidence.

### D5 — Mirror evidence discipline, not the `HotelFundsPolicyEvidence` domain

Reuse these internal conventions from funds policy:

- constructed absence rather than an omitted optional;
- capability-gated explicit negatives;
- `sourceLabel`, scope, checked time, and missing/conflict retention;
- summary/full presentation variants; and
- neutral handling for unknown states.

Do not reuse `HotelFundsObligationType`, `HotelFundsAmount`, the “Deposits and
card holds” panel, or `refund | release`. Do not link a pay-at-property charge
to the funds panel merely because both happen at the property. They may be
adjacent, but their headings and accessible regions remain separate.

Copy prohibition: “No amount due at the property” is valid only when both the
required-charge collection evidence and funds-policy evidence independently
support that statement. Neither domain can prove the other absent.

**Test:** a fixture with an included resort fee payable at property and a
separate authorization hold renders one price charge and one temporary funds
obligation; neither is duplicated or added to the other.

## 6. Measurement Contract

### 6.1 Use an attempt-level exposure key

Create one opaque `handoffAttemptId` when a hotel review mounts. Keep it stable
through view, continue, visibility return, back, and mismatch selection; create
a new value only for a genuinely new review attempt. This is product telemetry,
not a provider booking ID. Do not include property name, URL, dates, guest data,
free text, or payment data.

Every scoped lifecycle event must require:

- `handoffAttemptId`;
- `priceDisclosureState` from D1; and
- a server-validated event-specific property set.

The view event additionally records `stayCostState`, `taxState`, and
`mandatoryChargeState` so the derived state can be audited. Do not rely on
client-only derivation without the component states that produced it.

Register and validate the exact lifecycle:

| Event | Required purpose-specific properties |
|---|---|
| `hotel_handoff_viewed` | attempt ID, disclosure state, stay-cost state, tax state, mandatory-charge state, source |
| `hotel_handoff_continue_clicked` | attempt ID, disclosure state, source, partner named |
| `hotel_handoff_returned` | attempt ID, disclosure state, away-duration bucket |
| `hotel_handoff_back_clicked` | attempt ID, disclosure state |
| `hotel_handoff_return_reason_selected` | attempt ID, disclosure state, reason |

Audit and reconcile all existing emitted properties with `EVENT_PROPERTIES`,
`REQUIRED_PROPERTIES`, and `validPropertyValue` together. Adding only the new
fields will leave the current payloads rejected.

### 6.2 Define the valid behavioral measures

**Pre-handoff non-continuation** (do not call it booking abandonment):

`distinct viewed attempts with no continue click within 30 minutes / distinct viewed attempts`

Compute only after a 24-hour maturity window so recent views are not censored.
Report by `priceDisclosureState`; also report raw numerator/denominator and
continue-click rate. Multiple renders of one attempt count once.

**Return rate after handoff:**

`distinct returned attempts / distinct continued attempts`

This is diagnostic, not a booking-failure rate. A return can mean successful
comparison, provider checkout completion, or mismatch.

**Price-surprise report rate:**

`distinct returned attempts selecting a price reason / distinct returned attempts`

Also report prompt response rate; reason selection is optional and subject to
selection bias. Split the current combined reason into exactly:

- `tax_amount_changed_or_appeared`
- `mandatory_property_charge_changed_or_appeared`
- `displayed_total_other_mismatch`
- `pay_at_property_amount_unexpected`

Preserve unrelated existing reasons. Do not add free text. A single-select
reason remains sufficient for the first measurement iteration; the prompt asks
for the main mismatch.

No metric above is provider booking conversion. A true rate-to-booking measure
remains blocked on an authorized affiliate/provider conversion signal.

### 6.3 Moderated comprehension baseline and success threshold

Use the discovery's same-offer, two-treatment protocol with at least the current
incomplete fallback and one fully itemized fixture. Before handoff, ask the
participant to state:

1. the displayed lodging/stay amount;
2. tax amount or status;
3. mandatory property-charge amount or status;
4. which amounts are included in the provider total;
5. which amounts are collected at the property; and
6. confidence from 1–5.

Score a fact correct only when both amount/status and inclusion/payment meaning
match the fixture. Do not score “I don't know” as failure when the interface
correctly says unknown; calibrated uncertainty is correct comprehension.

Pre-declared success for design validation: at least 80% of participants answer
all five factual questions consistently with the fixture without opening a
collapsed item list, and no more than 10% interpret “pay at property” as “not
included in total.” Report sample size and confidence distribution; this is a
usability threshold, not evidence of population conversion impact.

## 7. Reachability and Stage Split

| State/surface | Production-reachable now | Downstream expectation |
|---|---:|---|
| `incomplete`: both categories `not_returned` | Yes; universal current provider state | UI must render honest fallback |
| `fully_itemized` | No provider path | Fully specify; fixture/unit test only |
| `provider_total_breakdown_unknown` | No provider path | Fully specify; fixture/unit test only |
| `partially_itemized` | No provider path | Fully specify; fixture/unit test only |
| `unavailable` | Component-reachable | Preserve existing price-unavailable treatment plus category fallback only when evidence exists independently |
| `HotelCard` collapsed/expanded | Latent component, no live route | Component-test; do not fail route E2E for absence |
| `/book` hotel branch | Route branch exists; no live UI entry while card is unmounted | Component-test non-collapsible summary and analytics contract |

**UXDES owns:** every state, hierarchy, exact copy composition, loading/error,
375px, 1280px, focus/keyboard, and assistive reading order.

**UI owns:** presentation of reachable data and fixtures only; it must not widen
types, call providers, or fabricate evidence.

**DEV owns:** category evidence types/normalizers, extension of the planned
mandatory-fee contract, tax contract, booking-context continuity, provider
adapter mapping, derived disclosure state helper, and the validated analytics
event contract. All external data remains behind `lib/providers`; all money
remains integer minor units and all adapters return `Result<T>`.

## 8. Acceptance Criteria for UXDES

- Preserve the inherited four stay-cost classes verbatim and add only the five
  disclosure-quality states in D1.
- Specify both charge-category rows for every state in D2, including independent
  total relationship and collection timing.
- Replace the combined scan disclaimer/static fee duplication with one
  two-clause composition line; do not add a receipt to the card.
- Keep Taxes and Mandatory property charges visible and non-collapsible before
  provider handoff; item records may expand separately.
- Specify explicit all-inclusive-without-breakdown, applies-but-unpriced,
  explicit-none, not-returned, conflicting, provider-total/no-breakdown, and
  price-unavailable cases.
- Preserve provider names/scopes for provider facts; never attach provider
  attribution to expaify arithmetic.
- Keep deposits/holds, optional/conditional charges, and Deal Score separate.
- Include loading, error, stale/mismatched evidence, mobile 375px, desktop
  1280px, focus/keyboard, and screen-reader output.
- Carry the reachability table into TEST: provider-confirmed states are
  DEV-gated and cannot fail the current production flow.
- Carry the analytics repair as DEV work; no acceptance criterion may assume
  today’s rejected events form a baseline or claim provider booking conversion.

## 9. Out-of-Scope Findings

- All scoped handoff lifecycle events are currently rejected because emitted
  properties and the API allowlist/validators diverge. This is broader than the
  discovery's reason-event finding and needs a dedicated DEV repair; no code is
  changed here.
- The return UI optimistically says feedback was recorded without observing
  analytics acceptance. Fixing delivery acknowledgement is separate from the
  taxonomy defined here.
- `HotelCard` remains unmounted and the hotel `/book` branch has no live UI
  entry. Component correctness is still required, but live funnel measurement
  remains unavailable until navigation is restored.
- Hotellook's `priceFrom` semantics and the current `pricePerNight` mapping are
  an adjacent price-basis risk already identified by other pipelines. This
  brief does not reinterpret or repair the source amount.
- Actual affiliate/provider booking completion is not observed. No “booking
  abandonment” or conversion claim is authorized.
- Price freshness remains owned by the hotel-price-freshness pipeline.

## 10. Handoff

Next ticket: `UXDES-HOTEL-TOTAL-PRICE-TAX-01` — UX Design: hotel total-price and
tax confidence.

Input: this brief. Output:
`docs/pipeline/hotel-total-price-tax/03-design.md`.
