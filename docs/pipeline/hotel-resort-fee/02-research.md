# UXR-HOTEL-RESORT-FEE-01: Mandatory Property-Fee Visibility Research Brief

Date: 2026-07-31  
Stage: UX Research (UXR)  
Priority: P0  
Upstream: `docs/pipeline/hotel-resort-fee/01-discovery.md`  
Surfaces: hotel result comparison → expanded review → booking handoff

## 0. Decision Summary

The discovery diagnosis holds. expaify's deposit/hold panel is structurally
limited to refundable obligations, but its full-panel heading promises the much
broader category **“Additional funds at the property.”** In the
`explicit_none` branch, that heading turns a correctly scoped provider claim
about deposits and incidental holds into a perceived all-clear on every amount
due at the property.

The repair has two deliberately separate tiers:

- **Tier 1 — UI-only, shippable now:** rename and rescope the existing funds
  panel to deposits and card holds; state that mandatory property-fee status is
  not confirmed wherever the nightly price is reviewed; replace the vague
  booking-handoff disclaimer with a specific check. This tier uses no new
  provider claim and no fee amount.
- **Tier 2 — DEV-gated:** add a separate, provider-attributed mandatory
  property-fee evidence contract with `reported`, `none_reported`, and
  `not_confirmed` states. No current adapter can return either confirmed state,
  so those branches are specified but unreachable.

This brief does **not** reopen the settled decision against generic fee ranges,
does not add a fifth `HotelStayCostState`, does not create another total, and
does not change Deal Score.

## 1. Inputs and Research Boundary

Read as settled inputs, not re-audited:

- `docs/pipeline/total-stay-cost/02-research.md`, especially directive 5: no
  generic resort-fee range.
- `docs/pipeline/hotel-total-stay-cost/03-design.md`: exactly four stay-cost
  classes and the precedent for fully specifying DEV-gated branches while
  excluding them from TEST failure.
- `docs/pipeline/hotel-rate-inclusions/02-research.md`: inclusions answer what a
  rate buys; this brief answers what every guest is still required to pay.

Current-code evidence in §2 is limited to the ticket's named fee, funds-policy,
comparison, and handoff surfaces. Adjacent pricing and inclusion systems are
not re-researched.

Reference guidance:

- [Booking.com Demand API accommodation pricing guide](https://developers.booking.com/demand/docs/accommodations/prices-accommodations)
- [Booking.com Demand API extra-charges guide](https://developers.booking.com/demand/docs/accommodations/charge-calculation)
- [Booking.com U.S. fee-transparency implementation guidance](https://developers.booking.com/demand/docs/compliance/ftc-compliance)
- [Google Hotel Center taxes and fees policy](https://support.google.com/hotelprices/answer/6064432?hl=en-GB)
- [FTC Rule on Unfair or Deceptive Fees FAQ](https://www.ftc.gov/business-guidance/resources/rule-unfair-or-deceptive-fees-frequently-asked-questions)

## 2. Current-Code Evidence

### 2.1 The funds-policy contract cannot express a mandatory non-refundable fee

`HotelFundsObligationType` has only `authorization_hold`,
`refundable_deposit`, and `other_refundable_obligation`
(`lib/types.ts:262-265`). The record's return action is correspondingly limited
to `refund | release` (`lib/types.ts:299-311`). This model is coherent for
temporary card capacity and refundable funds. It is not a general pay-at-
property charge model.

The presentation follows that narrow contract everywhere except its heading:

- summary and detail strings repeatedly say “deposit,” “hold,” or “refundable”
  (`HotelFundsPolicyPanel.tsx:125-149, 331-365`);
- the accessible suffix is scoped to deposits and holds in every branch except
  the `complete` branch's “Additional-funds policy” label
  (`HotelFundsPolicyPanel.tsx:246-258`);
- the full panel alone is headed **“Additional funds at the property”**
  (`HotelFundsPolicyPanel.tsx:327-329`).

Therefore the evidence model does not need widening to fix the P0 defect. The
heading needs to match the model.

### 2.2 The `explicit_none` body is accurate; its container changes its meaning

The `explicit_none` body says the provider reports no deposit or incidental hold
for a named scope (`HotelFundsPolicyPanel.tsx:352-356`). The summary and screen-
reader forms preserve the same scope (`:139-140`, `:256`). None of those strings
claims that mandatory property fees are absent.

Under the broad heading, however, a traveler must notice that “deposit or
incidental hold” is only a subset of “additional funds at the property.” That is
an unreasonable comprehension burden at the moment of price review. This is a
heading/model mismatch, not an `explicit_none` normalization bug.

### 2.3 Price comparison and expansion supply no fee-knowledge state

`HotelOffer` carries `pricePerNight` and the one-member
`priceBasis?: 'per_night_before_taxes_fees'`, but no mandatory-property-fee
evidence (`lib/types.ts:556-578`). `HotelCard` renders the same undifferentiated
“before taxes and fees” idea in the collapsed price block and expanded Price
scope (`HotelCard.tsx:355-370, 1067-1073`). Its composed accessible name also
groups taxes and fees without a knowledge state (`:781-782`).

The collapsed card already places a funds-policy summary after price and before
the decision controls (`HotelCard.tsx:923-946`), proving there is a usable
secondary scan position. It must not be repurposed for mandatory fees: a
refundable deposit and a non-refundable mandatory charge answer different
questions.

### 2.4 The handoff warning is vague at the exact point specificity matters

The outbound CTA's accessible name says “The final total may differ”
(`BookingFlow.tsx:1056-1061`). It does not name a mandatory property fee, who may
collect it, or what the traveler should verify. The full funds panel appears on
the same handoff surface (`BookingFlow.tsx:1242-1255`) under the overbroad
heading, compounding the ambiguity.

### 2.5 Confirmed fee states are unreachable today

Hotellook constructs `fundsPolicy: not_returned` in both normalization paths
(`lib/providers/hotellook.ts:395-410, 525-540`) and has no mandatory-property-
fee output. More importantly, mandatory fees do not belong in that refundable
funds policy even if Hotellook later returns them. No current `HotelOffer` field,
adapter output, or booking-context field can carry the evidence.

`HotelCard` also remains unmounted by any live app route. It is contracted and
test-covered, but its repair is correctness for a future reconnected results
path. The hotel branch of `/book` exists and is test-covered, but its only UI
entry is `HotelCard`; therefore there is no current live navigation path into
that branch either. The component/state distinction is carried into §6.

## 3. Reference-Pattern Comparison

### 3.1 Booking.com: known mandatory charges enter the comparison price

Booking.com's current Demand API distinguishes a display price (`book`) from the
full expected cost (`total`). Its search/availability response includes
`included`, `excluded`, and `conditional` extra charges; `total` includes the
non-conditional charges expected to be paid either online or directly to the
property. Its U.S. implementation guidance says mandatory resort, service, and
destination fees belong in the prominent total shown before booking.

**Known case:** the mandatory charge changes the price presented for comparison;
it is not left solely in a generic pay-at-property policy panel.

**Unknown case:** Booking's public display contract does not define a traveler-
facing “fee unknown” label. The integration is expected to return a lawful
display price and total. Silence is viable only because completeness is a
supplier-contract requirement.

### 3.2 Google Hotels: known mandatory charges enter `<OtherFees>` and total

Google requires transaction messages to include every mandatory charge
collected by either the partner or property, regardless of when it is due.
Resort fees are explicitly named. Google adds `<Tax>` and `<OtherFees>` to
`<Baserate>` to form the displayed total; missing or mismatched charges are a
Price Accuracy Policy violation.

**Known case:** the result-comparison price incorporates the mandatory charge.

**Unknown case:** Google likewise exposes no positive “unknown fee” comparison
pattern. Missing evidence is handled as feed inaccuracy and potential listing
enforcement, not as a silent product state that consumers can safely interpret.

### 3.3 What transfers—and what does not

What transfers is the hierarchy: mandatory fees affect the price decision and
must be disclosed before outbound handoff, not buried among optional amenities
or refundable holds. The distinction between mandatory and conditional charges
also transfers directly.

What cannot transfer is silence for unknown data. Booking.com and Google operate
on contracts that require fee-complete prices. expaify's active hotel adapter
returns no fee evidence and cannot make that completeness promise. On expaify,
omission would mean **not checked**, while users would reasonably read it as
**none**. The correct adaptation is an explicit `not_confirmed` state.

The FTC rule reinforces this distinction: fees that cannot reasonably be
avoided belong in the displayed total. It does not authorize a marketplace to
invent an amount or infer a property charge when its source data is incomplete.

## 4. Exact Gap

| Decision fact | Current expaify behavior | Reference guidance | Required delta |
|---|---|---|---|
| Refundable deposit/hold | Narrow model; broad full-panel heading | Keep refundable cash-capacity obligations distinct | Rescope the heading and broad summary/accessibility phrases |
| Mandatory fee reported | No representation | Include in prominent comparison total | Disclose existence, source, scope, amount only if returned; total integration remains owned by the total-stay-cost pipeline |
| No mandatory fee reported | No representation | A complete feed can support fee-complete pricing | Permit only from explicit provider evidence and supported scope |
| Provider did not say | Structurally indistinguishable from no fee | References treat this as feed failure, not a display state | Render `not_confirmed`; never silently convert it to `none_reported` |
| Handoff action | “The final total may differ” | Verify fee-complete price before booking | Name mandatory property fees and amounts due at the property |

## 5. Testable Design Directives

### D1 — Tier 1: rescope the refundable-funds surface; do not widen its model

Change the full-panel heading from **“Additional funds at the property”** to
**“Deposits and card holds.”** Change the two remaining broad phrases:

- `Additional funds reported: …` → `Deposits or card holds reported: …`
- `Additional-funds policy reported; review details before provider handoff.` →
  `Deposit or card-hold policy reported; review details before provider handoff.`

Keep `HotelFundsObligationType`, `HotelFundsPolicyState`, normalization, tone,
source/scope lines, loading/error behavior, and `explicit_none` body unchanged.
Do not add a non-refundable member to this model.

**Tests:** every full variant, including loading, error, `not_returned`,
`explicit_none`, `partial`, `complete`, and `conflicting`, has the heading
“Deposits and card holds”; no rendered or accessible funds-policy string says
“Additional funds”; `explicit_none` still says only “no deposit or incidental
hold” and never says “no fees.”

### D2 — Tier 1: show the honest default separately from taxes and refundable funds

Until provider evidence exists, every reachable fee disclosure resolves to this
exact primary sentence:

> `Mandatory property fees: not confirmed by {Provider}.`

Supporting/action copy:

> `Check the provider's total and any amount due at the property.`

On collapsed `HotelCard`, render the primary sentence as one wrapping secondary
line immediately after the price/source block and before policy summaries. Do
not add a chip, icon, tooltip, disclosure toggle, or warning-colored badge. On
expanded `HotelCard`, place both sentences in `Price scope`, after the existing
stay-cost claim and before `Rate check`. This is separate from taxes copy and
separate from `HotelFundsPolicyPanel`.

Add the primary sentence to `reviewAriaLabel` directly after the stay-cost/price
scope sentence. The provider display name must come from the same normalized
source already used for `Rate from {Provider}`; empty/raw supplier identifiers
must not be interpolated.

**Tests:** with today's Hotellook offer, collapsed, expanded, and composed screen-
reader output say `not confirmed`, never `none`, `no fee`, or a fee amount. At
375px the line wraps, is not clamped/truncated, adds no focusable element, and
does not overlap price, hotel name, funds summary, or the CTA. At 1280px it does
not alter the primary hierarchy: nightly price and Deal Score remain primary.

### D3 — Tier 1: make the outbound handoff instruction specific and non-collapsible

Immediately above the provider CTA, outside any `<details>`, render:

> `Mandatory property fees are not confirmed. On {Provider}, check the final total and any amount due at the property before you continue.`

Use `booking partner` when a safe display name is unavailable. Replace “The
final total may differ” in the CTA accessible name with the same two checks:

> `Mandatory property fees are not confirmed. Check the final total and any amount due at the property on {Provider}.`

This sentence does not replace the existing smoking, room, cancellation, or
other handoff checks. It also does not claim the provider has a fee-complete
total; it tells the traveler what to verify.

**Tests:** the instruction is visible without expanding any control, appears
before the outbound CTA in DOM and reading order, and is included once in the
CTA's accessible name. At 375px it wraps with no horizontal scroll. No network
request, polling state, skeleton, or `aria-live` region is introduced.

### D4 — Tier 2: use a separate three-state provider-evidence contract
Add a dedicated mandatory-property-fee contract to `HotelOffer`; do not reuse
`PetPolicyFeeStatus`, do not add to `HotelFundsObligationType`, and do not add a
member to `HotelStayCostState`.

The state vocabulary is exactly:

```ts
type HotelMandatoryPropertyFeeState =
  | 'reported'
  | 'none_reported'
  | 'not_confirmed'
```

Evidence must be bound to the offer/provider and carry non-empty
`sourceLabel`, supported `scope`, and optional `fetchedAt`. `reported` may carry
provider-returned fee name, `Money`, and basis; the state remains `reported`
when the amount is absent. `none_reported` requires an explicit supplier
negative and a capability declaration that the adapter can answer this fee
family for that scope. Missing, malformed, mismatched-offer, mismatched-supplier,
unsupported-scope, loading, and adapter-error inputs all degrade to
`not_confirmed`, never to `none_reported`.

Required primary copy:

| State | Copy |
|---|---|
| `reported`, valid amount | `Mandatory property fee reported: {amount} {basis}.` |
| `reported`, amount absent/invalid | `A mandatory property fee applies; amount was not provided.` |
| `none_reported` | `{Provider} reports no mandatory property fee for {scope}.` |
| `not_confirmed` | `Mandatory property fees: not confirmed by {Provider}.` |

Every confirmed state adds `Source: {Provider} · {scope}[ · Checked {date}]` in
detail. Amounts use the shared money formatter and integer minor-unit contract.
Never aggregate multiple fees, estimate a missing amount, fold an amount into a
stay total, or send fee evidence to Deal Score. Optional/conditional charges are
invalid inputs for this contract.

**Tests:** the pure normalizer/deriver covers all degradation rules above;
`reported` without amount survives as reported; an amount never appears without
valid `Money`; `none_reported` is impossible under an unsupported capability;
no fee value reaches `lib/scoring/scoreDeal.ts` or a second total.

### D5 — Tier 2: replace only the Tier 1 default when evidence becomes reachable

When a provider adapter eventually returns valid evidence, D4's derived state
replaces D2/D3's static `not_confirmed` sentence in the same placements. It does
not add another card row or panel. A confirmed fee uses the caution/warning tone;
`none_reported` uses neutral tone; `not_confirmed` remains neutral secondary text,
not success styling.

No component may call a provider. Evidence must arrive on the existing
provider-normalized offer/search payload and pass through booking context. The
results path must not block on a new lookup. Analytics, if separately approved,
should extend the existing funds-policy convention with exposure dimensions
`feeState`, `provider`, `scope`, and `surface`, then measure handoff, return, and
same-session re-search by exposed state. Analytics must remain observational and
must not gate this repair.

The validation plan is four pre-declared measures, segmented by exposed
`feeState` and compared before/after Tier 1:

1. **Handoff completion:** provider-CTA clicks per handoff exposure.
2. **Handoff reversal:** return/back events after a provider-CTA click, without
   a new provider handoff in the same session.
3. **Comparison failure:** detail expand followed by exit without handoff for
   that offer.
4. **Unexpected-cost proxy:** same-query re-search in the same session after a
   provider handoff.

These are correlational signals, not proof that a fee caused the behavior. The
static heading/model mismatch is sufficient to ship Tier 1; instrumentation
sizes the harm and tests whether the repair changes downstream behavior.

**Tests:** confirmed branches are exercised in pure/component fixtures only
until an adapter declares support; production Hotellook output remains
`not_confirmed`; no new outbound request occurs during card render; switching
from static default to evidence changes copy in place and does not duplicate it.

## 6. Reachability and TEST Contract

### 6.1 State reachability

| Mandatory-property-fee state | Tier | Reachable from production data now | TEST expectation |
|---|---|---|---|
| `not_confirmed` | Tier 1 | **Yes — universal** | Must render on every implemented surface and in accessible copy |
| `reported` with provider amount | Tier 2 | **No — DEV-gated** | Fully specified; unit/component fixture only; **must not fail production-flow QA** |
| `reported` without amount | Tier 2 | **No — DEV-gated** | Fully specified; unit/component fixture only; **must not fail production-flow QA** |
| `none_reported` | Tier 2 | **No — DEV-gated** | Fully specified; unit/component fixture only; **must not fail production-flow QA** |

### 6.2 Surface reachability

| Surface | Reachable now | Tier 1 expectation |
|---|---|---|
| `HotelCard` collapsed/expanded | **No live route; latent component** | Implement and component-test for correctness when search is reconnected; do not fail an end-to-end route for absence |
| `/book` hotel review and handoff | **Route branch exists; no live UI entry while `HotelCard` is unmounted** | Implement and component-test the non-collapsible instruction, corrected funds heading, and CTA accessible name; do not fail current-route E2E for absence |
| Provider-returned confirmed fee branches | **No adapter path** | Do not fail manual production flow; validate only fixtures until DEV integration lands |

Loading and adapter-error do not become extra fee states. They resolve to
`not_confirmed`. The existing funds panel keeps its own loading and error states
because those describe deposit/hold policy, not mandatory fees.

## 7. Answers to Discovery Open Questions

### Q1. What do Booking.com and Google Hotels do for known versus unknown fees at comparison?

**Known:** both require mandatory fees to enter the prominent comparison total.
Booking's `total` includes non-conditional extra charges due online or at the
property; Google adds mandatory `<OtherFees>` to base rate and prominently shows
the resulting total.

**Unknown:** neither publishes a documented traveler-facing unknown label. Both
attempt to eliminate the state through supplier completeness and price-accuracy
rules. Google explicitly treats missing/mismatched fees as a policy violation.
That silence is not transferable to expaify because expaify knows its current
adapter cannot answer. expaify must render `not_confirmed`.

### Q2. Rescope the heading or widen the funds model?

**Rescope the heading.** “Deposits and card holds” matches every existing model
member, string, and refundable impact statement. Widening the model would mix a
temporary/refundable cash-capacity obligation with a mandatory non-refundable
cost and turn a UI repair into an unnecessary contract migration.

### Q3. Generalize `PetPolicyFeeStatus` or keep property fees separate?

**Keep property fees separate.** Pet fees are conditional on bringing a pet and
include states such as `free`, `may_apply`, and `unconfirmed`
(`HotelPetPolicy.tsx:5-16`). A mandatory property fee is unconditional for the
covered property/rate/stay. Sharing the enum would permit semantically invalid
states in both domains. Reuse the proven interaction principle—mandatory can be
known while amount is unknown—not the pet type.

### Q4. Is market-level fee disclosure defensible?

**No.** Do not display “properties in this area commonly charge a resort fee”
on a result card, detail page, or handoff. Although grammatically market-level,
its placement beside one property makes it function as a property warning; it
cannot distinguish charged, none, and unknown for the offer. It would also
reintroduce the inference logic settled directive 5 rejected and could make a
traveler discount a property for a charge expaify has no evidence it imposes.
The honest statement is provider-specific `not_confirmed`, with no market
frequency or amount claim.

## 8. Priority, Acceptance Boundary, and Handoff

Priority order:

1. D1 and D3 on the `/book` hotel branch, component-tested for reconnection.
2. D1 and D2 on latent `HotelCard`, also component-tested for reconnection.
3. D4–D5 only after a provider contract can return mandatory-fee evidence.

UXDES must specify default, loading/error degradation, `reported` with and
without amount, `none_reported`, `not_confirmed`, 375px, 1280px, focus/keyboard,
and composed screen-reader copy. It must label confirmed branches DEV-gated and
carry §6 forward verbatim enough that TEST cannot mistake unreachable production
states for missing implementation.

Next ticket: `UXDES-HOTEL-RESORT-FEE-01` — UX Design: mandatory hotel
property-fee visibility.
