# UXDES-HOTEL-RESORT-FEE-01: Mandatory Property-Fee Visibility — Design Spec

Date: 2026-07-31  
Stage: UX Design (UXDES)  
Priority: P0  
Input: `docs/pipeline/hotel-resort-fee/02-research.md`  
Output: this document  
Handoff: `UI-HOTEL-RESORT-FEE-01`

---

## 0. Outcome and implementation boundary

This repair separates two obligations that the current UI incorrectly places
under one broad promise:

1. **Deposits and card holds** are temporary or refundable funds obligations.
   The existing model and panel already represent them; Tier 1 corrects the
   panel's overbroad language.
2. **Mandatory property fees** are non-optional charges. Tier 1 says honestly
   that the current provider has not confirmed them. Tier 2 replaces that
   default only when a provider adapter can return explicit, offer-bound fee
   evidence.

Tier 1 is UI-only and is the entirety of the next UI ticket. Tier 2 is fully
specified here but **DEV-gated**. UI must not add unreachable production
branches, new provider calls, fee amounts, or a new total in Tier 1.

This spec does not change `HotelStayCostState`, Deal Score, provider adapters,
API routes, or `HotelFundsObligationType`. It does not estimate fees or infer
them from a destination, property, or market.

### 0.1 State reachability — normative TEST contract

| Mandatory-property-fee state | Tier | Production-reachable now | UI-stage requirement | TEST requirement |
|---|---:|---:|---|---|
| `not_confirmed` | 1 | **Yes — universal** | Render static copy on all specified component surfaces | Must pass component tests; this is the only production data state |
| `reported`, valid amount | 2 | **No — DEV-gated** | Do not add production branch in Tier 1 | Fully specified; fixture/unit expectation only after DEV lands; do not fail current production-flow QA |
| `reported`, amount absent or invalid | 2 | **No — DEV-gated** | Do not add production branch in Tier 1 | Same as above |
| `none_reported` | 2 | **No — DEV-gated** | Do not add production branch in Tier 1 | Same as above |

Loading, provider error, missing evidence, and malformed evidence are not extra
fee states. They resolve to `not_confirmed`. The independently modelled deposit
and card-hold panel keeps its existing loading and error states.

### 0.2 Surface reachability — normative TEST contract

| Surface | Reachable from a live UI route now | Tier 1 implementation | TEST boundary |
|---|---:|---|---|
| `HotelCard`, collapsed | **No; latent component** | Add fee disclosure and accessible copy | Component-test; do not fail a live-route E2E because the card is unmounted |
| `HotelCard`, expanded | **No; latent component** | Add fee disclosure inside `Price scope` | Component-test; same E2E exemption |
| `/book`, hotel review/handoff | Branch exists, but has **no live UI entry** while `HotelCard` is unmounted | Add visible pre-CTA instruction, CTA accessible copy, and corrected funds heading | Component-test; do not fail current-route E2E for absent navigation |
| Confirmed provider-fee branches | **No adapter path** | Tier 2 only | Pure/component fixtures after DEV; never require current Hotellook to produce them |

These reachability tables are acceptance criteria, not implementation notes.
They must be copied into TEST planning.

---

## 1. Information architecture and hierarchy

### 1.1 Collapsed hotel comparison

Order, top to bottom:

1. Hotel identity and location.
2. **Primary:** nightly price and Deal Score.
3. **Secondary:** `Mandatory property fees: not confirmed by {Provider}.`
4. Existing rate eligibility, admission, parking, deposit/hold, pet, and smoking
   summaries.
5. Review action and detail control.

The fee sentence is separate from the nightly price label and separate from the
deposit/hold summary. It is plain secondary text: no chip, icon, tooltip,
accordion, badge, success mark, or warning-colored container.

### 1.2 Expanded hotel review

Inside the existing `Price scope` panel, order is:

1. `Price scope` heading.
2. Existing stay-cost/price-basis claim.
3. Mandatory-property-fee primary sentence.
4. Mandatory-property-fee action sentence.
5. `Rate check` heading and existing freshness copy.

The fee disclosure does not move into `HotelFundsPolicyPanel`. The full funds
panel follows later under the corrected heading `Deposits and card holds`.

### 1.3 Booking handoff

Inside `Check rooms with provider`, order is:

1. Existing heading and provider-confirmation introduction.
2. Existing ownership and loyalty disclosures.
3. **Mandatory-property-fee instruction**, visible without opening any
   disclosure.
4. Outbound provider CTA.
5. Existing new-tab cue.

The instruction must immediately precede the CTA group in DOM and reading
order. It is not placed in `<details>`, the supporting-evidence section, or the
deposit/hold panel.

### 1.4 Visual priority

- **Primary:** nightly rate, hotel name, Deal Score, provider CTA.
- **Secondary:** fee state/action, rate scope, and decision-critical policy
  summaries.
- **Tertiary:** provenance, checked date, and new-tab/supporting metadata.

Fee disclosure never uses `--brand` or Deal Score styling. A reported fee may
use a soft caution container in Tier 2, but the fee amount never becomes a
second primary price and never visually competes with the nightly rate.

---

## 2. Tier 1 — UI-only repair

### 2.1 Deposits/card-holds language corrections

Change exactly these visible and accessible strings in
`HotelFundsPolicyPanel.tsx`:

| Current | Final copy |
|---|---|
| `Additional funds at the property` | `Deposits and card holds` |
| `Additional funds reported: {details}.` | `Deposits or card holds reported: {details}.` |
| `Additional funds reported: {count} separate refundable deposit or hold requirements. Review each before booking.` | `Deposits or card holds reported: {count} separate refundable requirements. Review each before booking.` |
| `Additional-funds policy reported; review details before provider handoff.` | `Deposit or card-hold policy reported; review details before provider handoff.` |

All other funds-panel strings, states, source/scope lines, analytics, controls,
loading/error behavior, and normalization remain unchanged. In particular,
`explicit_none` remains:

- title: `No deposit or hold reported`
- body: `The provider reports no deposit or incidental hold for {scope}.`

It must never become `No fees`, `No property fees`, or equivalent.

### 2.2 Provider display-name rule

Use the same safe normalized display name already used by `Rate from
{Provider}`:

- When `hasProviderName(source)` is true, use `providerDisplayName(source)`.
- When it is false, the fee scan/detail fallback is `the booking partner` and
  the handoff fallback is `booking partner` as written below.
- Never interpolate an empty string, raw identifier, URL host, or
  `Provider unavailable` into traveler-facing fee copy.

### 2.3 Collapsed `HotelCard`

Place this sentence immediately after the price/source grid and before
`HotelCardEligibilityLine`:

> `Mandatory property fees: not confirmed by {Provider}.`

Fallback:

> `Mandatory property fees: not confirmed by the booking partner.`

Use:

```tsx
<p className="mt-2 break-words text-xs font-medium leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]">
  {feeScanCopy}
</p>
```

Rules:

- Render for every hotel offer, including invalid/unavailable nightly price and
  disabled provider link. Fee knowledge is independent of price/link validity.
- Do not clamp, truncate, or apply `whitespace-nowrap`.
- Add no focusable element and no `aria-live` region.
- Render once only; do not repeat it in the deposit/hold summary.

Append the exact sentence to `reviewAriaLabel` directly after the existing
nightly/stay-cost sentence and before `Rate from …`. The result is one composed
accessible name, not a separate hidden node.

Tier 1 example:

> `Review The Example Hotel. Nightly rate $189.00 before taxes and fees. Mandatory property fees: not confirmed by Hotellook. Rate from Hotellook. …`

The rest of the accessible name remains in its existing order.

### 2.4 Expanded `HotelCard` — `Price scope`

After the existing price-scope claim and before `Rate check`, render:

> `Mandatory property fees: not confirmed by {Provider}.`

> `Check the provider's total and any amount due at the property.`

Fallback for the primary sentence uses `the booking partner`; the action
sentence does not change.

Use the existing panel container unchanged. Inside it:

```tsx
<p className="mt-2 break-words font-medium text-[color:var(--text-1)] [overflow-wrap:anywhere]">
  {feePrimaryCopy}
</p>
<p className="mt-1 break-words text-[color:var(--text-2)] [overflow-wrap:anywhere]">
  Check the provider's total and any amount due at the property.
</p>
```

No heading, landmark, disclosure control, icon, or new panel is added. The
existing `Price scope` heading labels the unit.

### 2.5 `/book` handoff instruction and CTA accessible name

Immediately before the existing `<div className="mt-5 flex flex-col gap-3">`
CTA group, render:

> `Mandatory property fees are not confirmed. On {Provider}, check the final total and any amount due at the property before you continue.`

Unnamed-partner fallback:

> `Mandatory property fees are not confirmed. On the booking partner's site, check the final total and any amount due at the property before you continue.`

Use:

```tsx
<p className="mt-4 break-words rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2 text-sm font-medium leading-6 text-[color:var(--text-1)] [overflow-wrap:anywhere]">
  {feeHandoffCopy}
</p>
```

The container is neutral, not warning/success colored. Change the CTA group's
top margin to `mt-3` so the instruction and action read as one sequence.

Replace only `The final total may differ.` in the CTA accessible name with:

> `Mandatory property fees are not confirmed. Check the final total and any amount due at the property on {Provider}.`

Unnamed-partner accessible fallback:

> `Mandatory property fees are not confirmed. Check the final total and any amount due at the property on the booking partner's site.`

Keep every other accessible-name clause, including smoking confirmation, and
include the property-fee instruction exactly once. Visible and accessible copy
do not create another network request, loading state, retry, skeleton, or live
region.

### 2.6 Tier 1 state behavior

| Input/condition | Collapsed | Expanded | Handoff | Interaction |
|---|---|---|---|---|
| Default/current Hotellook | `not confirmed` primary sentence | primary + action | visible instruction + CTA aria clause | None |
| Fee evidence absent | Same | Same | Same | None |
| Provider lookup/loading elsewhere | Same; no skeleton | Same; no status role | Same; CTA follows existing readiness rules | None |
| Provider/adaptor error elsewhere | Same; no error alert | Same | Same | None |
| Invalid nightly price | Still render | Render if expanded surface exists | Existing booking validation owns route availability | None |
| Missing safe provider name | Use specified booking-partner fallback | Same | Use specified site fallback | None |
| Deposit policy loading/error | Fee copy remains unchanged | Fee copy remains unchanged; deposit panel owns its status | Fee instruction remains unchanged; deposit panel owns its status | No cross-state coupling |

---

## 3. Tier 2 — DEV-gated evidence contract

Tier 2 begins only after an adapter can explicitly answer mandatory property
fees. It requires changes to shared types, provider normalization, hotel booking
context serialization/validation, and UI derivation. It is not part of the UI
handoff ticket.

### 3.1 Type shape

Add a dedicated contract; do not reuse pet-fee or refundable-funds types:

```ts
export type HotelMandatoryPropertyFeeState =
  | 'reported'
  | 'none_reported'
  | 'not_confirmed'

export type HotelMandatoryPropertyFeeBasis =
  | 'per_stay'
  | 'per_night'
  | 'per_room'
  | 'per_person'
  | 'provider_defined'

export interface HotelMandatoryPropertyFeeEvidence {
  state: HotelMandatoryPropertyFeeState
  offerId: string
  supplier: string
  sourceLabel: string
  scope: HotelEvidenceScope
  feeName?: string
  amount?: Money
  basis?: HotelMandatoryPropertyFeeBasis
  basisWording?: string
  fetchedAt?: string
}

export interface HotelMandatoryPropertyFeeCapability {
  supplier: string
  supported: boolean
  supportedScopes: HotelEvidenceScope[]
}
```

`HotelOffer` later receives optional `mandatoryPropertyFee` and
`mandatoryPropertyFeeCapability` fields. `BookingHotelContext` must carry the
normalized evidence so the same state reaches handoff without a client-side
provider request. Query serialization, reference-context storage, parsing, and
validation must all preserve or safely degrade it.

### 3.2 Normalization and degradation precedence

Implement a pure `deriveMandatoryPropertyFeePresentation` (name may vary only
to follow repo convention). Evaluate top-down; first failure wins and produces
`not_confirmed`:

1. Capability absent or `supported !== true`.
2. Capability supplier does not exactly match the normalized offer supplier.
3. Evidence absent, non-object, or state outside the three-member vocabulary.
4. Evidence `offerId` does not exactly match the offer ID.
5. Evidence `supplier` does not exactly match the offer supplier.
6. `sourceLabel` is empty after trimming.
7. Evidence scope is outside `HotelEvidenceScope` or not present in the
   capability's `supportedScopes`.
8. Evidence describes an optional or conditional charge. Such charges are
   invalid inputs and must stay in their own policy domain.
9. Adapter loading/error/timeout or stale context that cannot be bound to the
   selected offer.

After those guards:

- `reported` remains `reported` when a valid amount is absent. Keep a valid,
  non-empty provider-returned `feeName`; otherwise omit it. Keep `amount` only
  when `isValidMoney(amount)` is true. Never coerce floats, strings, negatives,
  or currencyless values. Keep `basis` only when valid. A basis without an
  amount is not displayed in the primary sentence.
- `none_reported` is valid only when the adapter capability explicitly covers
  this fee family and the evidence scope. It means the supplier returned an
  explicit negative for this offer; absence never constructs it.
- `not_confirmed` stays `not_confirmed` even if optional metadata happens to be
  valid.

Do not aggregate records, compute a stay fee, add the amount to nightly/stay
totals, or pass it to `scoreDeal`. Multiple mandatory records require a future
provider-contract decision and degrade to `not_confirmed` in this contract;
they are not silently summed.

### 3.3 Scope and basis labels

Use these exact display labels:

| Token | In sentence/provenance |
|---|---|
| `property` | `this property` / `property` |
| `room` | `this room` / `room` |
| `rate` | `this rate` / `rate` |
| `selected_stay` | `this selected stay` / `selected stay` |
| `per_stay` | `per stay` |
| `per_night` | `per night` |
| `per_room` | `per room` |
| `per_person` | `per person` |
| `provider_defined` | provider `basisWording`, only when non-empty; otherwise omit basis |

### 3.4 Final state copy

All money uses shared `formatMoney`; raw cents never render.

| Derived state | Primary copy |
|---|---|
| `reported`, valid amount and basis | `Mandatory property fee reported: {amount} {basis}.` |
| `reported`, valid amount and no usable basis | `Mandatory property fee reported: {amount}.` |
| `reported`, amount absent/invalid | `A mandatory property fee applies; amount was not provided.` |
| `none_reported` | `{Provider} reports no mandatory property fee for {scope sentence label}.` |
| `not_confirmed` | `Mandatory property fees: not confirmed by {Provider}.` |

When `reported` includes a safe fee name, add a detail-only line:

> `Fee name from {Provider}: {feeName}.`

Do not put the fee name in the scan sentence; arbitrary supplier text must not
change card hierarchy.

Confirmed `reported` and `none_reported` detail states add:

> `Source: {Provider} · {scope provenance label}[ · Checked {MMM D, YYYY}]`

Omit the checked segment when the timestamp is absent or invalid. Do not show a
`Source:` line for `not_confirmed`; its provider attribution is already the
knowledge boundary, not evidence of a fee fact.

### 3.5 Tier 2 placement replacement rule

The derived primary copy replaces Tier 1's primary sentence **in place** on
collapsed and expanded `HotelCard`; it never adds another row or panel.

- Collapsed: primary sentence only.
- Expanded: primary, optional safe fee-name line, provenance for confirmed
  states, then state-specific action below.
- Handoff: one visible state/action sentence before CTA and one corresponding
  CTA accessible clause. Evidence must arrive through booking context.

Expanded/handoff action copy:

| State | Action |
|---|---|
| `reported` | `Check that this fee and any other amount due at the property are included in the provider's final total.` |
| `none_reported` | `Check the provider's final total and any amount due at the property before you continue.` |
| `not_confirmed` | `Check the provider's total and any amount due at the property.` |

Handoff visible copy:

| State | Sentence |
|---|---|
| `reported` | `A mandatory property fee is reported. On {Provider}, check that the fee and any other amount due at the property are included in the final total before you continue.` |
| `none_reported` | `{Provider} reports no mandatory property fee for {scope}. Check the final total and any amount due at the property before you continue.` |
| `not_confirmed` | Tier 1 handoff sentence in §2.5 |

CTA accessible clauses mirror the same facts without repeating the CTA label:

| State | Accessible clause |
|---|---|
| `reported` | `A mandatory property fee is reported. Check that the fee and any other amount due at the property are included in the final total on {Provider}.` |
| `none_reported` | `{Provider} reports no mandatory property fee for {scope}. Check the final total and any amount due at the property.` |
| `not_confirmed` | Tier 1 accessible clause in §2.5 |

### 3.6 Tier 2 tone

- `reported`: `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]`
  on detail/handoff treatment; copy uses `--text-1`/`--text-2`, never
  `--warning` for paragraphs.
- `none_reported`: neutral `--border` / `--bg-raised`; no green, checkmark, or
  success badge. The claim is provider-scoped, not a universal guarantee.
- `not_confirmed`: Tier 1 neutral secondary treatment.
- Collapsed scan stays unboxed in every state; `reported` may use
  `text-[color:var(--text-1)]`, while the other two use `--text-2`.

---

## 4. Responsive behavior

### 4.1 Mobile — 375px viewport

- All fee copy wraps naturally within its existing card/panel column.
- Required classes: `min-w-0`, `break-words`, and `[overflow-wrap:anywhere]`
  where provider-derived text is possible.
- No horizontal scroll, line clamp, truncation, fixed width, absolute
  positioning, or forced single-line layout.
- Collapsed fee copy may occupy multiple lines but remains above policy
  summaries and decision controls.
- The handoff instruction remains directly above the full-width CTA. It must
  not be moved below the button to save height.
- The nightly price, Deal Score, hotel name, and CTA remain visually primary.

### 4.2 Desktop — 1280px viewport

- Keep existing card and panel widths; no new columns.
- Fee copy stays in normal document flow and does not sit beside the nightly
  amount as a competing figure.
- Expanded detail remains a single stacked reading sequence.
- Handoff instruction spans the provider panel content width above the CTA.

### 4.3 Narrow-content edge case

The app supports down to 320px even though acceptance screenshots are 375px.
Long provider names and provider-defined basis wording wrap anywhere. They must
never widen the card or obscure controls.

---

## 5. Interaction, keyboard, focus, and announcements

The fee disclosure is informational and adds no interaction.

- No tab stop, tooltip, popover, expandable row, retry button, or provider
  fetch is introduced.
- Existing expand/collapse, review button/link, and outbound CTA keyboard
  behavior remains unchanged: Enter/Space activates buttons; Enter activates
  links; global `:focus-visible` and `--focus-ring` styles remain visible.
- The handoff instruction comes before the CTA in DOM order, so screen-reader
  users encounter it before activating the external link.
- Do not apply `role="status"`, `aria-live`, or `aria-busy` to Tier 1 fee copy.
  It does not change asynchronously.
- Tier 2 loading/error also resolves synchronously to `not_confirmed`; do not
  announce a transient state. Existing provider and funds-policy status regions
  keep their independent behavior.
- `reviewAriaLabel` and outbound CTA labels contain the fee state exactly once.
  Visible copy remains visible to assistive technology; do not duplicate it in
  an `sr-only` node.

---

## 6. Edge cases and prohibited claims

| Case | Required behavior |
|---|---|
| Empty/raw supplier ID | Use safe booking-partner fallback; never expose raw ID |
| Invalid or unsupported currency | Drop amount and use reported/amount-not-provided copy; do not downgrade existence claim |
| Zero or negative amount | Invalid amount; use amount-not-provided copy, not `$0` or `free` |
| Fee name returned, no amount | Keep `reported`; show qualitative primary and detail-only safe fee name |
| Amount returned, no basis | Show formatted amount without basis |
| Conditional/optional fee | Reject from this contract; do not display as mandatory |
| Explicit provider negative without capability | `not_confirmed`, never `none_reported` |
| Evidence from another offer/supplier | `not_confirmed` |
| Multiple mandatory fees | `not_confirmed` pending a separately designed multi-fee contract; never sum |
| Funds policy says `explicit_none` | Fee state remains independent; `explicit_none` only covers deposits/holds |
| Deal Score is Great | Fee disclosure unchanged; no score caveat or recomputation in this ticket |
| Missing fee timestamp | Omit checked date; do not say freshness unavailable |

Prohibited copy and behavior:

- `No fees`, `fee-free`, `all fees included`, or `no amount due at property`.
- Market or destination fee ranges/frequencies.
- A computed fee, blended nightly price, second stay total, or fee-adjusted Deal
  Score.
- Treating missing evidence as `none_reported`.
- Calling a provider from a component or blocking results on a fee lookup.
- Moving mandatory fees into deposits/holds, parking, amenities, pet policy, or
  rate inclusions.

---

## 7. UI implementation scope and file map

### 7.1 UI-HOTEL-RESORT-FEE-01 must change

- `app/components/HotelFundsPolicyPanel.tsx`
  - four copy corrections in §2.1 only.
- `app/components/HotelCard.tsx`
  - Tier 1 collapsed sentence, expanded Price scope copy, and composed review
    accessible name.
- `app/book/BookingFlow.tsx`
  - visible non-collapsible pre-CTA instruction and updated CTA accessible
    name.
- Existing/new component tests for all Tier 1 placements, responsive class
  invariants, copy scope, ordering, and accessible names.

The UI ticket must preserve props and exports. It must not modify providers,
API routes, `lib/types.ts`, booking context contracts, analytics, or Deal Score.

### 7.2 Tier 2 DEV ticket later owns

- Shared evidence/capability types in `lib/types.ts`.
- Provider adapter capability and evidence normalization in `lib/providers/`.
- Pure derivation/normalization in `lib/hotels/`.
- Search payload and booking-context propagation in `lib/booking/config.ts` and
  reference storage.
- UI replacement branches and fixtures once data is reachable.
- Tests proving every degradation rule and confirming no fee reaches scoring or
  a second total.

No Tier 2 ticket should be opened until a provider contract can actually return
explicit mandatory-property-fee evidence.

---

## 8. Acceptance criteria

### 8.1 Tier 1 UI acceptance

1. Every full `HotelFundsPolicyPanel` state—loading, error, `not_returned`,
   `explicit_none`, `partial`, `complete`, and `conflicting`—uses the heading
   `Deposits and card holds`.
2. No rendered or accessible funds-policy string contains `Additional funds`
   or `Additional-funds`.
3. `explicit_none` remains explicitly scoped to a deposit or incidental hold
   and never implies no mandatory fee.
4. Collapsed `HotelCard`, expanded `Price scope`, `reviewAriaLabel`, visible
   handoff instruction, and outbound CTA accessible name all carry the exact
   Tier 1 fee copy.
5. The handoff instruction is outside `<details>`, precedes the CTA in DOM/read
   order, and the CTA accessible name contains the fee instruction once.
6. Missing provider names use the specified fallback and expose no raw or empty
   value.
7. At 375px, all copy wraps without clipping, overlap, or horizontal scroll;
   no decision control loses its 44px minimum target.
8. At 1280px, nightly price and Deal Score remain primary and no new column or
   competing total appears.
9. Fee disclosure creates no focusable control, live region, fetch, skeleton,
   or retry state.
10. Production Hotellook output always presents `not_confirmed` and never a fee
    amount or `none_reported` claim.

### 8.2 Tier 2 DEV acceptance when activated

1. Pure normalization covers every guard in §3.2.
2. `reported` without amount survives as `reported`.
3. An amount renders only after `isValidMoney` and only through `formatMoney`.
4. `none_reported` cannot be constructed without matching supplier capability
   and supported scope.
5. Search-to-booking context preserves the same normalized state without a new
   client fetch.
6. Each state replaces Tier 1 copy in place and never duplicates it.
7. No fee value reaches `lib/scoring/scoreDeal.ts`, a computed subtotal, or a
   second total.
8. Confirmed branches are fixture-tested but remain exempt from production-flow
   QA until an adapter declares support.

---

## 9. TEST handoff checklist

TEST must first apply the reachability tables in §0. A missing live path to
`HotelCard` or the hotel `/book` branch is an existing routing condition, not a
failure of this ticket. Validate those surfaces with component tests until a
separate reconnection ticket lands.

Manual/component checks:

- 375px and 1280px layouts.
- Default, deposit-policy loading, deposit-policy error, and every existing
  funds-policy state.
- Safe named-provider and unnamed-provider copy.
- Collapsed, expanded, review action, visible handoff, and CTA accessible name.
- DOM order and absence of new focus targets/live regions.
- No `Additional funds` language and no false `none` claim.
- No new network request, fee estimate, stay total, or Deal Score input.

Tier 2 `reported` and `none_reported` are **not Tier 1 production acceptance
criteria**. They become testable only when a DEV adapter/capability handoff
explicitly activates them.
