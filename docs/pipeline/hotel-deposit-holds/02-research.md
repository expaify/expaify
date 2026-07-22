# UXR-HOTEL-DEPOSIT-HOLDS-01: Hotel Deposit and Incidental-Hold Clarity

Date: 2026-07-22  
Stage: UX Research  
Priority: P0  
Feature slug: `hotel-deposit-holds`

## Research question

Can a first-time traveler identify, before leaving expaify, whether provider evidence documents a refundable deposit or temporary authorization hold, understand the amount, basis, application moment, card impact, and conditional return/release wording, and distinguish all of that from the stay price and mandatory fees without interpreting missing data as “no deposit”?

## Executive finding

No. The current hotel path has no data contract, normalization path, persistence mechanism, display, or analytics dimension for deposits or incidental authorization holds. `HotelOffer` carries a nightly price and general amenity evidence, but no additional-funds policy. The Hotellook `cache.json` adapter accepts no policy fields, the 6-hour cached-offer parser cannot preserve them, `HotelCard` and `/book` mention only nightly price, taxes, fees, room availability, and cancellation, and the handoff events contain no policy state.

The active provider cannot close this gap. Hotellook's documented cache response contains hotel identity, location, stars, and price statistics—not deposit or incidental-hold policy. For the required fields, current normalized-offer coverage is therefore **0% complete, 0% partial, 0% explicit-none, and 100% not-returned by contract**. This is a structural coverage statement, not a production sample: the app neither requests nor normalizes these fields. A provider-specific generic disclaimer would not improve evidence coverage.

The smallest safe repair is a provider-neutral **additional-funds policy evidence object** that persists from provider normalization through the hotel detail and `/book` handoff. Its state must distinguish complete, partial, provider-confirmed none, not returned, and conflicting evidence. Every returned obligation must retain its mechanism (hold versus collected deposit), money/basis or variable rule, application timing, payment-method applicability, policy scope, source, and conditional return/release wording. Until a provider actually returns those facts, both decision surfaces must show an honest not-returned state.

## Inputs and method

### Current-code evidence audited

- `docs/pipeline/hotel-deposit-holds/01-discovery.md`
- `lib/types.ts` (`HotelOffer`, `Money`, existing hotel evidence vocabulary, `HotelProvider`)
- `lib/providers/hotellook.ts` (upstream shape, live normalization, cached-offer validation, six-hour cache path)
- `lib/providers/__tests__/hotellook.test.ts` (actual adapter fixtures and normalized expectations)
- `app/api/search/route.ts` (hotel search boundary)
- `app/components/HotelCard.tsx` (collapsed result, expanded detail, review link)
- `lib/booking/config.ts` (`BookingHotelContext`, validation, URL serialization)
- `app/book/BookingFlow.tsx` (`HotelSummary`, `HotelHandoffReview`, analytics)
- `app/deals/DealFeed.tsx` and `app/page.tsx` (current live-surface check)

### Reference-pattern evidence

Reference material is used only for interaction and information-architecture guidance. It is **not** evidence that any expaify property has a deposit or hold.

- Booking.com Demand API: the accommodation-detail damage policy separates amount/currency from deposit collection date, refund date, and payment method; a null deposit has a defined meaning rather than being inferred from a missing response. [Booking.com Demand API changelog](https://developers.booking.com/demand/docs/whats-new/archive-2024)
- Expedia Rapid: lodging launch requirements require a returned property-collect deposit policy and payment schedule to be shown on the booking page; the property-collect guide separately explains pre-authorization as a hold rather than money taken from the card. [Expedia lodging launch requirements](https://developers.expediagroup.com/rapid/setup/launch-requirements/lodging-launch-reqs) and [Expedia property-collect payments](https://developers.expediagroup.com/rapid/lodging/booking/property-collect?locale=en_US)
- Travelpayouts/Hotellook: the documented `cache.json` response includes location, hotel name/id, stars, and price statistics and describes no policy object. [Travelpayouts Hotel API reference](https://travelpayouts.github.io/slate/)

## Current implementation audit

### 1. `HotelOffer` cannot represent the decision

`HotelOffer` (`lib/types.ts:169`–`185`) carries property identity, location, `pricePerNight: Money`, a single `per_night_before_taxes_fees` basis, ratings, photo, deeplink, provider, and general amenity/access evidence. It has no place for:

- obligation mechanism: temporary authorization hold versus collected refundable deposit;
- exact, ranged, percentage, or variable amount and its basis;
- application or collection timing;
- debit/credit/cash or other payment-method applicability;
- property, room, rate, or selected-stay policy scope;
- provider-confirmed no-policy evidence;
- conditional return/refund or authorization-release wording;
- property action versus bank/card-issuer processing;
- partial, conflicting, or not-returned coverage.

The existing `HotelEvidenceStatus` and `HotelEvidenceScope` (`lib/types.ts:119`–`147`) are useful vocabulary, but `HotelAmenityEvidence` is the wrong container: a financial obligation can contain several monetary and temporal facts, can be partial, and may include multiple obligations. Modeling it as an amenity boolean would erase the distinction this ticket exists to protect.

### 2. Hotellook supplies no usable policy evidence

The app calls only `https://engine.hotellook.com/api/v2/cache.json` (`lib/providers/hotellook.ts:6`, `:435`–`:442`). The local upstream interface (`:11`–`:30`) and official response documentation contain no deposit, authorization, incidentals, payment-method, or release/refund fields. Live normalization (`:453`–`:495`) emits no policy. Cached normalization (`:320`–`:386`) validates and rebuilds only the existing offer fields, so no policy could survive cache replay even if an undocumented extra field arrived.

The tests reinforce the real contract: Hotellook fixtures expect price/location/quality and synthetic not-returned access evidence, but no additional-funds policy. No live vendor call was used to manufacture policy evidence.

#### Coverage baseline

| Required evidence state | Current normalized offers | Reason |
|---|---:|---|
| Complete | 0% | No required policy field exists in the upstream or normalized contract. |
| Partial | 0% | No obligation fact is requested or retained. |
| Explicit none | 0% | The response has no documented “no deposit/hold” semantic. |
| Not returned | 100% | This is the only honest state for every current normalized Hotellook offer. |
| Conflicting/variable | 0% observable | The app cannot receive or retain either state; this is not evidence that neither occurs. |

Coverage must later be reported by provider and scope. It must not be aggregated into a misleading “policy available” rate: complete, partial, explicit-none, not-returned, and conflicting are separate denominators and outcomes.

### 3. Hotel detail collapses all extra-money concepts into a provider boundary

The collapsed `HotelCard` gives property identity, nightly rate, Deal Score, and “Review hotel” (`app/components/HotelCard.tsx:752`–`:854`). Its accessible CTA name says the rate is before taxes and fees and that the provider confirms final details (`:725`–`:732`). No separate funds-restriction signal appears before that CTA.

Expanded details show location, access evidence, then one combined price/handoff panel (`:879`–`:907`). Its visible hierarchy is “Price scope,” “Rate check,” and “Provider handoff.” Deposits and authorization holds are absent, and the generic statement that the provider confirms “final total, taxes, fees, room availability, cancellation policy, and terms” can encourage a traveler to treat all extra money as part of final price rather than recognize a temporary available-credit restriction.

This is not repairable with the phrase “deposit may apply.” Such a disclaimer would be identical for every property, would not establish whether evidence exists, and would still hide hold versus charge, amount, scope, and timing.

### 4. Policy evidence is lost before `/book`

`BookingHotelContext` carries only offer/provider identity, name/location, nightly integer-cent price, currency, price basis, and provider URL (`lib/booking/config.ts:18`–`:29`). Validation and query parsing accept only those fields (`:276`–`:337`), and `buildHotelBookingHref` serializes only those facts (`:360` onward).

Consequently, `/book` cannot repeat a policy even if a card could display one. `HotelHandoffReview` shows the selected nightly rate and says the partner confirms final total, taxes, fees, room availability, and cancellation policy (`app/book/BookingFlow.tsx:643`–`:668`). The outbound CTA's accessible name mentions only the nightly rate and possible final-total difference (`:641`). This is the last expaify surface before the traveler leaves, yet it provides no additional-funds check.

Encoding a policy as free text in query parameters is not an acceptable repair. The handoff needs a validated structured contract, or a server-resolved opaque offer reference if URL size/integrity becomes a concern.

### 5. Analytics cannot establish policy comprehension or support intent

Current events are `hotel_handoff_viewed`, `hotel_handoff_continue_clicked`, `hotel_handoff_back_clicked`, and `hotel_handoff_returned` (`app/book/BookingFlow.tsx:569`–`:627`, `:653`). Their properties describe provider, partner, price, price basis, and location precision. They record no policy evidence state, mechanism, scope, disclosure exposure, detail open, or explicit confirmation/help action.

Therefore:

- current abandonment cannot be attributed to deposit uncertainty;
- return from a partner cannot be treated as a policy problem;
- dwell time cannot establish comprehension;
- only an explicit policy-specific action can be labeled support/confirmation intent.

### 6. The audited card is not on a live hotel-results path

Repository search finds no production import or rendering of `HotelCard`; it is exercised in tests only. `app/deals/DealFeed.tsx` presents sample hotels and explicitly says they are not bookable (`:675`), while `app/page.tsx` is a landing surface. The `/book` hotel review exists, but the reviewed code does not expose a live results-to-review route to travelers.

This does not change the evidence or design requirements, but it changes validation: implementing only `HotelCard` would produce no measurable traveler exposure. Live results integration is an out-of-scope dependency that the UXDES spec must name, not silently assume complete.

## Reference-pattern comparison

### Booking.com: structured policy at accommodation detail

The Booking.com pattern makes the policy a structured accommodation-detail object: amount and currency are distinct from deposit collection/refund dates and payment methods. It also distinguishes “no deposit collected” from the presence of a damage amount. The interaction lesson is not Booking.com's visual styling; it is that the user can read a labeled policy with typed facts and that an explicit-null semantic is different from missing evidence.

**Delta:** expaify has neither a policy object nor an explicit-none semantic. It cannot place a reliable summary in detail, and it cannot preserve one into handoff.

### Expedia: deposit schedule in booking context; pre-authorization distinct from collection

Expedia's launch guidance requires returned deposit policy/payment-schedule information at the booking step, while its property-collect guidance explains that a pre-authorization places a hold instead of taking money. The useful pattern is continuity plus mechanism clarity: additional-funds information travels with the selected rate and appears where payment feasibility is reviewed.

**Delta:** expaify's selected hotel context carries only nightly price. It does not distinguish a payment schedule, a collected refundable deposit, or a temporary hold; nor can it repeat any of them before handoff.

### Pattern to adopt

Use a short, text-first “Additional funds at the property” summary before the hotel CTA and repeat the same sourced evidence before outbound handoff. Put the full structured facts behind the existing details disclosure, but do not make the existence, amount, or unknown state discoverable only after leaving expaify. Keep this panel adjacent to—but visually and semantically outside—the stay-price/taxes/fees breakdown.

## Smallest compatible evidence contract

UXDES should specify against this provider-neutral model; DEV may refine names without collapsing its semantics:

```ts
type HotelFundsPolicyState =
  | 'complete'
  | 'partial'
  | 'explicit_none'
  | 'not_returned'
  | 'conflicting'

type HotelFundsObligationType =
  | 'authorization_hold'
  | 'refundable_deposit'
  | 'other_refundable_obligation'

type HotelFundsAmount =
  | { kind: 'exact'; money: Money }
  | { kind: 'range'; min: Money; max: Money }
  | { kind: 'percentage'; percent: number; appliesTo: 'stay_price' | 'other_documented_basis' }
  | { kind: 'variable'; providerWording: string }
  | { kind: 'not_returned' }

type HotelFundsBasis =
  | 'per_stay'
  | 'per_night'
  | 'per_room'
  | 'per_person'
  | 'provider_defined'
  | 'not_returned'

interface HotelFundsObligation {
  type: HotelFundsObligationType
  amount: HotelFundsAmount
  basis: HotelFundsBasis
  applicationWording?: string
  paymentMethodWording?: string
  returnOrRelease?: {
    action: 'refund' | 'release'
    providerWording?: string
    issuerProcessingWording?: string
  }
}

interface HotelFundsPolicyEvidence {
  state: HotelFundsPolicyState
  obligations: HotelFundsObligation[]
  scope: HotelEvidenceScope
  sourceLabel: string
  fetchedAt?: string
}
```

Contract rules:

1. `explicit_none` is valid only when the provider explicitly says no deposit and no incidental hold for the stated scope. Empty/missing arrays map to `not_returned`, not `explicit_none`.
2. `complete` requires, for every obligation, mechanism, usable amount/rule and basis, application timing, payment-method applicability when supplied by the provider, scope/source, and return or release wording. Any missing required fact produces `partial` and the UI names what was not returned.
3. A hold uses `action: 'release'`; a collected deposit uses `action: 'refund'`. Neither is added to stay total, taxes/fees, or Deal Score.
4. Range endpoints must share a currency; money remains integer minor units. Percentages and variable rules are never converted into a fabricated `Money` value.
5. Provider wording may preserve conditional timing, but the UI must prefix attribution (“The provider says…”) and must never turn it into a guaranteed calendar date. Property release/refund and bank/card-issuer processing remain separate.
6. Property-scoped evidence is never presented as confirmed for a selected rate/stay. Multiple incompatible provider records produce `conflicting`; the UI must not pick the most reassuring one.

## Design directives

These five directives are specific and testable.

### 1. Render one mutually exclusive policy state on every decision surface

For every bookable hotel, render exactly one policy summary in expanded hotel detail and repeat it in `/book` before the outbound CTA. The summary must use these state rules:

| Evidence state | Required summary behavior |
|---|---|
| Complete hold | Label “Temporary card hold”; show returned amount/basis and application moment; say it can reduce available funds; attribute release wording and state that funds-availability timing is not guaranteed. |
| Complete deposit | Label “Refundable deposit”; show returned amount/basis and collection moment; attribute refund wording; distinguish property refund processing from bank/card timing. |
| Partial | Show every returned fact, then “The provider did not return [specific missing facts]. Confirm before booking.” Never fill gaps with industry practice. |
| Explicit none | “The provider reports no deposit or incidental hold for [scope].” Do not generalize property scope to a selected rate. |
| Not returned | “Deposit and hold policy not provided. Confirm whether this property requires additional available funds before booking.” |
| Conflicting | “Deposit or hold details conflict in the provider information. Confirm the amount and timing before booking.” Show the conflicting sourced facts in details; do not select one. |
| Variable | Show the provider's returned rule and “Amount varies”; do not calculate an exact figure unless all required inputs are provider-returned and the contract explicitly supports the calculation. |

Loading uses “Checking deposit and hold policy…” in a polite live region. Provider failure uses “Deposit and hold policy could not be checked. Confirm with the property or booking partner before booking.” Failure is not the same as not returned.

### 2. Separate available-funds impact from the stay-price hierarchy

Title the panel **“Additional funds at the property”** and place it after the nightly/stay-price context but before the primary hotel CTA. Do not put a hold/deposit inside “taxes and fees,” a stay total, or Deal Score. Use a sentence that names card impact only for a documented hold: “This is a temporary authorization, not part of the stay price, but it can reduce your available card balance.” For a collected deposit: “This is collected separately from the stay price and may be refundable under the provider's stated conditions.”

At collapsed-card scan level, show a one-line signal for every complete/partial/conflicting returned obligation and the not-returned state; do not hide disclosure based on an unvalidated dollar threshold. The full fact set remains in Details. At `/book`, repeat the selected evidence in full directly above “Continue to booking partner.”

### 3. Preserve evidence continuity and scope

The same normalized `HotelFundsPolicyEvidence` must survive provider normalization, 6-hour cache replay, hotel detail, `BookingHotelContext`, validation, and handoff display. A source/scope line is mandatory: for example, “Source: Hotellook · Property-level policy” or “Source: [provider] · Selected-rate policy.” If evidence is property-level, visible copy must say, “Confirm this applies to your selected room and rate.”

Acceptance test: fixture each state through both live and cached normalization, construct and parse the review context, and assert semantic equality at `HotelCard` and `HotelHandoffReview`. Missing evidence must emerge as `not_returned`, never as an omitted UI section.

### 4. Make disclosure operable and comprehensible at 375px and 1280px

At 375px, use one column: policy summary, optional disclosure control, then CTA; money/basis text wraps and is never horizontally scrolled or truncated. At 1280px, the policy may sit beside price context, but reading order remains price → additional-funds policy → CTA. Reuse a native button with `aria-expanded`/`aria-controls` for details, preserve a visible focus ring, keep status in text rather than color/icon alone, and keep the control and CTA at least 44px high. On expand/collapse, focus stays on the disclosure button; newly revealed content follows it in DOM order.

Comprehension gate with exact final copy: at least 90% of first-time participants must correctly identify (a) hold versus collected deposit, (b) whether amount/timing is known, (c) that not-returned does not mean none, and (d) that stated release/refund timing is not a guaranteed funds-availability date. Any dimension below 90% returns to UXDES copy revision.

### 5. Instrument exposure, explicit intent, and materiality without false attribution

Add these bounded events:

- `hotel_funds_policy_summary_viewed` once per offer/surface, with `policyState`, `obligationTypes`, `scope`, `provider`, `surface`, and coarse amount-to-price band only when calculable;
- `hotel_funds_policy_details_opened` with the same evidence dimensions;
- `hotel_funds_policy_confirm_clicked` only on an explicit “Confirm with property/booking partner” action; this is the only event labeled policy-confirmation intent;
- append `policyState` and `obligationTypes` to existing handoff view/continue/back events for correlation, not causal attribution.

Do not send raw provider wording, property policy text, or full URLs in analytics. Do not classify a back click, no-continue session, provider return, or dwell time as deposit-related support intent.

Do not gate disclosure behind a guessed “material” threshold. For formative testing, vary four factors independently: amount-to-displayed-price ratio (10%, 25%, 50%, 100%), absolute amount band, one versus two rooms, and credit versus debit framing. Compare comprehension, property reconsideration, and perceived prominence for fixed versus amount-responsive treatments. Until that research establishes a threshold, every returned obligation is discoverable and every known amount receives equal baseline prominence. Because the current contract lacks room count, stay total, and payment method, production materiality calculation is blocked and must not be approximated from nightly price alone.

## Measurement plan

### Supply metrics

- `policy_state_coverage`: share of normalized offers in each mutually exclusive state, segmented by provider and `property | room | rate | selected_stay` scope.
- `field_coverage`: within non-`explicit_none` returned policies, share with mechanism, amount/rule, basis, application timing, payment-method applicability, and return/release wording.
- Report numerator and denominator. Never merge `explicit_none` with `not_returned`, and never treat `conflicting` as complete.

Baseline for the current Hotellook contract: complete 0%, partial 0%, explicit-none 0%, not-returned 100%; conflicting/variable unobservable.

### Traveler metrics

- **Primary comprehension pass:** correct answers to mechanism, amount/basis, funds impact, and timing certainty in an unprompted five-question check; target ≥90% on each state, not only overall.
- **Unknown-state safety:** ≥90% interpret not-returned as “provider did not supply the policy,” not “no deposit.”
- **Release-certainty safety:** ≥90% understand provider-stated release/refund wording is conditional and bank/card timing may differ.
- **Disclosure engagement:** details-open rate by state/scope; interpret high engagement together with comprehension, because opens may signal unclear summary copy.
- **Explicit confirmation intent:** confirmation-action click rate only; handoff back/return/no-continue remain correlated funnel behavior.
- **Decision change:** property/rate reconsideration after exposure, segmented by evidence state and preregistered amount bands; do not describe the policy as causal without experimental assignment or explicit traveler response.

## Acceptance criteria for UXDES

- Specifies final visible and assistive copy for complete hold, complete deposit, partial, explicit-none, not-returned, conflicting, variable, loading, and provider-error states.
- Keeps deposits/holds outside stay price, mandatory fees, and Deal Score; labels hold versus collected deposit correctly.
- Shows amount as integer-minor-unit `Money` with documented basis, or preserves range/percentage/variable/not-returned without manufacturing an exact value.
- Separates application timing, property refund/release action, and bank/card-issuer processing; promises no release date.
- Repeats source, scope, and the same evidence from detail through `/book`; property-level evidence never reads as selected-rate certainty.
- Places a concise state before the primary hotel CTA and full evidence before outbound handoff at both 375px and 1280px.
- Defines focus, keyboard, live-region, wrapping, and text-not-color-only behavior.
- Defines the analytics above and does not label unexplained abandonment as policy intent.
- Identifies DEV work as required for types, provider/live+cached normalization, booking-context persistence, analytics, and tests.
- Names the live-results integration dependency rather than claiming `HotelCard` currently reaches travelers.

## Blockers and out-of-scope findings

### Provider evidence blocker

The active Hotellook cache endpoint does not document or return the required policy fields. Honest UI work can ship the not-returned/error states, but complete, partial, explicit-none, conflicting, or variable real-property states require an approved hotel provider response that actually supplies them. Do not scrape property pages or infer policies.

### Live-surface dependency

`HotelCard` is not mounted in a production results flow in this worktree. Wiring real hotel results to the audited detail/review path is outside this UXR ticket, but without it the disclosure has no traveler exposure and its analytics cannot establish a baseline.

### Price-basis integrity conflict (out of scope, P0)

The official Hotellook API reference defines `priceFrom` as the minimum price **per stay for the requested period**, while the adapter maps it to `pricePerNight` and the UI repeatedly labels it “per night before taxes and fees.” This predates and is outside the deposit/hold ticket, but it blocks a trustworthy amount-to-stay-price materiality ratio and may already misstate hotel prices. It needs a separate repair ticket; this brief does not change the price contract.

### Other boundaries

- No new supplier, direct UI vendor call, scraping, payment collection, hold authorization, refund processing, dispute handling, or release-date promise.
- No change to taxes/mandatory fees, cancellation/refundability, Deal Score, hotel ranking, or affiliate routing.
- No universal materiality cutoff until research validates one against amount, ratio, multi-room, and debit-card scenarios.

## Handoff

Create `UXDES-HOTEL-DEPOSIT-HOLDS-01` to turn this brief into an implementation-ready design specification for the provider-neutral evidence contract, every policy state, hotel-detail and `/book` continuity, responsive/accessibility behavior, final UI copy, and measurement events. The design must treat current Hotellook offers as `not_returned` and must not imply a guaranteed release or funds-availability date.
