# UX Design — Hotel Deposit and Incidental-Hold Clarity

**Ticket:** `UXDES-HOTEL-DEPOSIT-HOLDS-01`  
**Stage:** UX Design  
**Priority:** P0  
**Date:** 2026-07-22

## Upstream inputs

- Discovery: `docs/pipeline/hotel-deposit-holds/01-discovery.md`
- Research: `docs/pipeline/hotel-deposit-holds/02-research.md`
- Affected decision surfaces:
  - `app/components/HotelCard.tsx`
  - `app/book/BookingFlow.tsx`
  - `app/book/page.tsx`
- Required continuity contracts:
  - `lib/types.ts`
  - `lib/providers/hotellook.ts`
  - `lib/booking/config.ts`
  - `app/api/search/route.ts`
- Existing tokens: `app/globals.css`

## Problem statement

A traveler cannot currently tell whether a hotel may require additional available funds, whether the mechanism is a temporary authorization hold or a collected refundable deposit, or whether the provider supplied any policy at all before leaving expaify.

## Design outcome

Every bookable hotel presents one provider-neutral **Additional funds at the property** disclosure. A concise summary appears before the hotel review action, the complete evidence appears in expanded hotel detail, and that same complete evidence is repeated immediately before the outbound action on `/book`.

The disclosure communicates evidence, not assumptions:

- a temporary authorization hold is not part of the stay price, but can reduce available card balance;
- a refundable deposit is collected separately from the stay price and is refundable only under the provider's stated conditions;
- neither mechanism is a tax, mandatory fee, stay-price component, or Deal Score input;
- missing provider evidence means `not_returned`, never `explicit_none`;
- provider-stated release or refund wording never becomes a promised funds-availability date;
- scope and source remain visible through handoff;
- current Hotellook offers always render `not_returned`, because the active endpoint returns no policy evidence by contract.

No deposit, hold, refund, release, or funds-availability claim may be inferred from property class, nightly rate, amenities, common hotel practice, payment method, or an empty provider response.

## Scope

### In scope

- A shared policy-summary and policy-detail presentation for `HotelCard` and `/book`.
- Complete, partial, explicit-none, not-returned, conflicting, loading, and provider-error states.
- Exact, range, percentage, variable, and not-returned amount states.
- One or multiple obligations in a policy.
- Hold-versus-deposit language, application timing, payment-method applicability, return/release wording, source, and scope.
- Structured continuity through live normalization, cache replay, and `BookingHotelContext`.
- Accessible disclosure behavior and bounded analytics.

### Out of scope

- Adding or scraping a provider that supplies deposit/hold data.
- Collecting a deposit, placing an authorization, refunding money, or resolving disputes.
- Calculating a stay total, taxes, mandatory fees, or a materiality threshold.
- Changing Deal Score, hotel ranking, cancellation policy, or affiliate routing.
- Mounting `HotelCard` on a live results surface; this remains a separate integration dependency.
- Repairing the existing Hotellook `priceFrom`/per-night contract conflict.

## Terminology and claim rules

Use the following terms exactly:

| Concept | UI term | Meaning |
|---|---|---|
| Card authorization without collection | `Temporary card hold` | Funds are not described as collected, but available card balance may be reduced. |
| Money collected and conditionally returned | `Refundable deposit` | Money is collected separately and may be refunded under stated conditions. |
| Other provider-documented refundable obligation | `Other refundable amount` | Use only when the provider evidence cannot truthfully be classified as a hold or deposit. |
| Room/rate price | `Stay price` or existing `nightly rate` | Separate from every additional-funds obligation. |
| Required non-refundable charge | `Mandatory fee` | Not part of this disclosure and never described as refundable. |
| No returned evidence | `Policy not provided` | Does not mean no policy exists. |

Never use `charge` for an authorization hold. Never use `hold` for money the property collects. Never use `fee` as a synonym for either. Never say `you will get the money back`, `released on`, `available by`, `returned within`, or another unconditional timing promise.

Provider wording can be displayed only with attribution. Normalize unsafe first-person provider language into an attributed sentence without strengthening the claim. For example, provider text equivalent to “we release within 7 days” renders as `The provider says the property releases the authorization within 7 days after checkout.` It must be followed by the applicable no-guarantee sentence defined below.

## Provider-neutral evidence contract

UI implementation must consume one validated object. Components must not interpret raw provider payloads.

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
  | {
      kind: 'percentage'
      percent: number
      appliesTo: 'stay_price' | 'other_documented_basis'
      appliesToWording?: string
    }
  | { kind: 'variable'; providerWording: string }
  | { kind: 'not_returned' }

type HotelFundsBasis =
  | 'per_stay'
  | 'per_night'
  | 'per_room'
  | 'per_person'
  | 'provider_defined'
  | 'not_returned'

type HotelFundsEvidenceScope =
  | HotelEvidenceScope
  | 'not_returned'

interface HotelFundsEvidenceRecord {
  type?: HotelFundsObligationType
  amount?: HotelFundsAmount
  basis?: HotelFundsBasis
  applicationWording?: string
  paymentMethodWording?: string
  returnOrRelease?: {
    action: 'refund' | 'release'
    providerWording?: string
    issuerProcessingWording?: string
  }
  sourceLabel: string
  scope: HotelFundsEvidenceScope
}

interface HotelFundsPolicyEvidence {
  state: HotelFundsPolicyState
  obligations: HotelFundsEvidenceRecord[]
  sourceLabel: string
  scope: HotelFundsEvidenceScope
  fetchedAt?: string
  missingFields?: Array<
    | 'mechanism'
    | 'amount'
    | 'basis'
    | 'application_timing'
    | 'payment_method'
    | 'return_or_release'
    | 'scope'
    | 'source'
  >
  conflictingRecords?: HotelFundsEvidenceRecord[]
}

type HotelFundsPolicyLoadState = 'loading' | 'ready' | 'error'
```

This refines the research model in two necessary ways without collapsing its semantics:

1. `not_returned` is a valid scope value. A missing response must not be assigned a fabricated property, room, rate, or selected-stay scope.
2. Conflicting records retain their own source and scope. A single policy-level source cannot support the requirement to display incompatible sourced facts without choosing one.

Validation rules:

1. `explicit_none` is valid only when the provider explicitly reports both no refundable deposit and no incidental authorization hold for the displayed scope.
2. Missing, empty, invalid, or cache-legacy policy values normalize to a complete `not_returned` object; the UI section is never omitted.
3. `complete` requires mechanism, usable amount/rule, basis, application timing, payment-method applicability, source, scope, and applicable refund/release wording for every obligation.
4. Missing any complete-state field maps the policy to `partial` and populates `missingFields`; the adapter must not ask the UI to infer the missing list.
5. An `authorization_hold` must use `returnOrRelease.action: 'release'`. A `refundable_deposit` must use `action: 'refund'`.
6. Exact and range amounts use `Money` with safe integer minor units. Range endpoints use the same currency and `min.priceCents <= max.priceCents`.
7. A percentage is not converted into money. A variable rule is not converted into an exact, range, or percentage value.
8. `conflicting` requires at least two incompatible `conflictingRecords`. Each retains its own source and scope; no record is marked preferred.
9. The selected policy object is serialized and validated as structured data through `BookingHotelContext`. Do not accept free text as the policy contract.
10. If query-string size or integrity is unsafe, use a server-resolved opaque offer reference. Never truncate policy evidence to fit a URL.

## State selection and precedence

Render exactly one container state per surface. Determine it in this order:

1. `loadState === 'loading'` → loading.
2. `loadState === 'error'` → provider error.
3. Invalid/absent ready payload → normalized `not_returned`.
4. Valid `state === 'conflicting'` → conflicting.
5. Valid `state === 'explicit_none'` → explicit none.
6. Valid `state === 'partial'` → partial.
7. Valid `state === 'complete'` → complete.
8. Valid `state === 'not_returned'` → not returned.

`variable` is an amount substate, not a substitute for evidence quality. A variable amount may occur inside complete, partial, or conflicting evidence. “Complete variable” means the rule itself is returned along with every other required field; it does not mean an exact amount is known.

When multiple obligations exist, preserve provider order unless that order is absent. With no provider order, show authorization hold first, refundable deposit second, and other refundable obligation third. Never merge amounts, timings, or sources.

## Information hierarchy

### Primary

- Evidence state: documented, incomplete, conflicting, explicitly none, not provided, loading, or failed.
- Mechanism: temporary authorization hold versus collected refundable deposit.
- Amount/rule and basis when returned.
- Effect on available funds and separation from stay price.

### Secondary

- Application/collection moment.
- Payment-method applicability.
- Property refund or authorization-release wording.
- Bank/card-issuer processing caveat.
- Specific missing facts or conflicting records.

### Tertiary

- Provider source, evidence scope, and fetched date when valid.
- Confirmation prompt/action.

The policy panel is visually adjacent to price but semantically outside the price breakdown. Do not nest it under `Price scope`, taxes, mandatory fees, or Deal Score.

## Shared component structure

Implement one shared presentation component, for example:

```tsx
<HotelFundsPolicyPanel
  evidence={hotel.fundsPolicy}
  loadState={hotel.fundsPolicyState}
  surface="hotel_detail" // or "book_handoff"
  partnerLabel={partnerLabel}
  confirmHref={surface === 'book_handoff' ? providerUrl : undefined}
  variant="full" // or "summary"
/>
```

Both surfaces use the same copy formatter and money formatter. Do not duplicate state copy in `HotelCard` and `BookingFlow`.

Semantic outline for the full panel:

```text
section aria-labelledby
├── h3 Additional funds at the property
├── state summary
├── obligation list
│   └── article for each obligation
│       ├── h4 mechanism label
│       ├── amount/rule and basis
│       └── application, payment method, and return/release facts
├── state-specific caution or explicit-none statement
├── source/scope line
└── optional confirm-policy action
```

The concise summary is a paragraph, not a badge. Status must remain understandable in forced-colors mode and without color.

## Placement and reading order

### `HotelCard`: collapsed scan

Required DOM and visual order:

1. Hotel identity, quality, location, and nightly rate.
2. One-line additional-funds summary.
3. Deal Score chip and `Review hotel` action.
4. `Details` disclosure button.

The concise summary therefore appears before the primary `Review hotel` action, not inside the action's accessible name alone. It is always present for a bookable hotel, including `not_returned`. It can wrap to multiple lines; “one-line” describes information density, not CSS truncation.

Collapsed summary container classes:

`mt-3 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-2)]`

Use `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]` for partial, not-returned, conflicting, and error. Use the default raised panel for complete and explicit-none. Do not use success styling for explicit none: it is evidence, not a recommendation.

### `HotelCard`: expanded detail

Inside existing `Details`, required order for the affected section:

1. Existing price/rate context.
2. Full `Additional funds at the property` panel.
3. Existing provider-handoff copy.

Move `Provider handoff` out of the combined price panel if necessary so deposits/holds cannot read as part of `Price scope`. Other existing evidence modules remain in their current relative order unless a separate approved hierarchy ticket changes them.

The expanded `Details` button remains a native `<button>` with `aria-expanded` and `aria-controls`. Focus stays on the button after expand/collapse. The full policy panel follows the button in DOM order; do not move focus into it automatically.

### `/book`

Keep the selected hotel/nightly-rate summary. Add the full policy panel after all general hotel/provider guidance and immediately before the action stack containing `Continue to {partner}`. No special-request, offer-reference, or generic provider content may appear between this panel and the primary outbound action.

The `/book` order is:

1. Selected hotel and observed nightly rate.
2. General partner and special-request guidance.
3. Full `Additional funds at the property` panel.
4. Optional policy-confirmation link inside the panel.
5. `Continue to {partner}`.
6. New-tab cue.
7. `Back to search`.

Update the page introduction to: `Review the hotel, nightly rate, and any provider-reported additional-funds policy. The booking partner confirms live details before you pay.`

## Final copy system

Dynamic tokens in braces are populated only from validated normalized evidence.

### Shared heading and labels

- Panel heading: `Additional funds at the property`
- Amount label: `Amount`
- Application label for holds: `When the hold is placed`
- Application label for deposits: `When the deposit is collected`
- Application label for other refundable obligations: `When it applies`
- Payment label: `Payment method`
- Hold release label: `Authorization release`
- Deposit return label: `Deposit refund`
- Other return label: `Refund`
- Evidence label: `Evidence`

### Scope labels

| Scope | Visible phrase |
|---|---|
| `property` | `Property-level policy` |
| `room` | `Room-level policy` |
| `rate` | `Rate-level policy` |
| `selected_stay` | `Selected-stay policy` |
| `not_returned` | `Scope not provided` |

Every property-scoped panel adds: `Confirm this applies to your selected room and rate.`

Every room-scoped panel adds: `Confirm this applies to your selected rate and stay.`

Every rate-scoped panel adds: `Confirm this applies to your selected room and stay.`

Selected-stay evidence adds no scope caution. `not_returned` uses only its state caution and does not invent a scope.

### Source line

- Valid fetched date: `Source: {sourceLabel} · {scopeLabel} · Checked {formattedDate}`
- No fetched date: `Source: {sourceLabel} · {scopeLabel}`
- No provider evidence returned: `Source checked: {sourceLabel} · Scope not provided`

The fetched date is evidence freshness only. Do not label it as the date the policy became effective.

### Amount and basis formatting

Use the existing integer-cent money formatter and non-breaking currency/amount grouping where available. Never show more precision than the currency supports.

| Amount state | Value copy |
|---|---|
| Exact | `{formattedMoney} {basisPhrase}` |
| Range | `{formattedMin}–{formattedMax} {basisPhrase}` |
| Percentage of stay price | `{percent}% of the provider's stay price` |
| Percentage of other documented basis | `{percent}% of {appliesToWording}` |
| Variable | `Amount varies — {providerWording}` |
| Not returned | `Amount not provided` |

Basis phrases:

- `per_stay`: `per stay`
- `per_night`: `per night`
- `per_room`: `per room`
- `per_person`: `per person`
- `provider_defined`: use the validated provider basis wording; if absent, the policy is partial and displays `Basis not provided`
- `not_returned`: `Basis not provided`

Do not multiply a per-night, per-room, or per-person amount. Do not calculate a percentage amount. Do not combine a range with the nightly rate.

### Complete authorization hold

Collapsed summary:

`Temporary card hold: {amountAndBasis}. Not part of the stay price.`

Full obligation:

- Mechanism heading: `Temporary card hold`
- Impact: `This is a temporary authorization, not part of the stay price, but it can reduce your available card balance.`
- Amount: `{amountAndBasis}`
- Application: `{applicationWording}`
- Payment method: `{paymentMethodWording}`
- Release: `The provider says the property releases the authorization {providerReleaseWording}.`
- Card timing: `Your bank or card issuer controls when the funds become available again. The provider's timing is not a guaranteed funds-availability date.`

If the provider supplies issuer-processing wording, render it between release and card timing as: `The provider also says: {issuerProcessingWording}`. Keep the fixed no-guarantee sentence after it.

### Complete refundable deposit

Collapsed summary:

`Refundable deposit: {amountAndBasis}. Collected separately from the stay price.`

Full obligation:

- Mechanism heading: `Refundable deposit`
- Impact: `This is collected separately from the stay price and may be refundable under the provider's stated conditions.`
- Amount: `{amountAndBasis}`
- Application: `{applicationWording}`
- Payment method: `{paymentMethodWording}`
- Refund: `The provider says the property processes the refund {providerRefundWording}.`
- Bank timing: `Your bank or card issuer may take additional time to make the funds available. The provider's timing is not a guaranteed funds-availability date.`

If the provider supplies issuer-processing wording, render it between refund and bank timing as: `The provider also says: {issuerProcessingWording}`. Keep the fixed no-guarantee sentence after it.

### Complete other refundable obligation

Collapsed summary:

`Other refundable amount: {amountAndBasis}. Separate from the stay price.`

Full obligation:

- Mechanism heading: `Other refundable amount`
- Impact: `The provider describes this as a refundable amount collected separately from the stay price.`
- Amount: `{amountAndBasis}`
- Application: `{applicationWording}`
- Payment method: `{paymentMethodWording}`
- Refund: `The provider says the property processes the refund {providerRefundWording}.`
- Bank timing: `Your bank or card issuer may take additional time to make the funds available. The provider's timing is not a guaranteed funds-availability date.`

### Multiple complete obligations

Collapsed summary with two obligations:

`Additional funds reported: {firstMechanism} {firstAmountAndBasis}; {secondMechanism} {secondAmountAndBasis}.`

For three or more:

`Additional funds reported: {count} separate refundable deposit or hold requirements. Review each before booking.`

The full panel renders every obligation separately. Never sum them. If obligations have different currencies, retain each currency and add: `These amounts use different currencies and are not combined.`

### Variable amount

The amount row is exactly:

`Amount varies — {providerWording}`

The full panel then renders the returned basis, application, payment, and return/release facts normally. Do not prefix the rule with `about`, `estimated`, or an expaify-calculated amount.

Collapsed examples by mechanism:

- `Temporary card hold: amount varies. Not part of the stay price.`
- `Refundable deposit: amount varies. Collected separately from the stay price.`

### Partial

Collapsed summary:

`Deposit or hold details are incomplete. Confirm the missing information before booking.`

Full state introduction:

`The provider returned some deposit or hold details, but the policy is incomplete.`

Render every returned fact using the mechanism-specific labels above. Then render one missing-facts sentence using the normalized ordered list:

`The provider did not return {missingFactList}. Confirm before booking.`

Missing-field phrases and order:

1. `mechanism` → `whether this is a hold or collected deposit`
2. `amount` → `the amount or calculation rule`
3. `basis` → `what the amount applies to`
4. `application_timing` → `when it is applied`
5. `payment_method` → `which payment methods it applies to`
6. `return_or_release` → `the refund or authorization-release conditions`
7. `scope` → `which property, room, rate, or stay the policy covers`
8. `source` → `the policy source`

Use commas plus `and` in the list. Do not render empty value rows for missing fields; the missing-facts sentence is the explicit representation.

If mechanism is known, show the matching fixed impact sentence. If mechanism is missing, use: `The provider did not identify whether money is temporarily authorized or collected.` Do not show hold-specific card-impact or deposit-specific collection copy.

### Explicit none

Collapsed summary by scope:

`The provider reports no deposit or incidental hold for {scopePhrase}.`

Full state:

- State heading: `No deposit or hold reported`
- Body: `The provider reports no deposit or incidental hold for {scopePhrase}.`
- Source/scope line as defined above.
- Scope caution when scope is property, room, or rate.

Scope phrases:

- property: `this property`
- room: `this room`
- rate: `this rate`
- selected stay: `this selected stay`

`explicit_none` with `scope: not_returned`, missing source, or any obligation is invalid and normalizes to `not_returned`.

### Not returned

Collapsed summary:

`Deposit and hold policy not provided. Additional available funds may still be required.`

Full state:

- State heading: `Policy not provided`
- Body: `The provider did not supply a deposit or incidental-hold policy for this offer.`
- Action guidance: `Confirm whether this property requires additional available funds before booking.`
- Source line: `Source checked: {sourceLabel} · Scope not provided`

This is the required state for 100% of current Hotellook offers. Do not use `No deposit`, `No hold`, a check mark, success color, or an empty panel.

### Conflicting

Collapsed summary:

`Deposit or hold details conflict. Confirm the amount and timing before booking.`

Full state:

- State heading: `Policy details conflict`
- Body: `The provider information contains different deposit or hold details. expaify cannot determine which applies.`
- Guidance: `Confirm the amount, timing, and policy for your selected room and rate before booking.`
- Records heading: `Conflicting provider details`

For every record, render returned facts without filling gaps, followed by its own source/scope line. Label records `Provider detail 1`, `Provider detail 2`, and so on; do not use `preferred`, `current`, `likely`, or a success/error comparison treatment.

If one record says explicit none and another reports an obligation, show both facts. The panel remains `conflicting`; it must not fall through to explicit none or complete.

### Loading

Collapsed and full status copy:

- Visible status: `Checking deposit and hold policy…`
- Assistive status: same copy.

Use `role="status" aria-live="polite" aria-busy="true"`. Render a stable panel shell and three non-text skeleton rows under the visible status. Skeletons use `.skeleton` and `aria-hidden="true"`. Do not render a zero amount, `No deposit`, disabled confirm action, or stale prior policy while a different offer loads.

### Provider error

Collapsed summary:

`Deposit and hold policy could not be checked. Confirm before booking.`

Full state:

- State heading: `Policy check unavailable`
- Body: `Deposit and hold policy could not be checked.`
- Guidance: `Confirm with the property or booking partner before booking.`

Use `role="status" aria-live="polite"`; do not use an assertive alert because the hotel review remains usable. Show `Retry policy check` only when a real isolated retry handler exists. On retry, announce the loading copy and preserve focus on the retry button until it is replaced; when replaced, move focus to the state heading only if the retry was user-initiated.

Failure is transient system state and must not be persisted as `not_returned` evidence. If the rest of the hotel is valid, it does not disable `Review hotel` or the outbound booking-partner action.

## Confirmation action

Only `/book` may show a policy-specific confirmation link because it has the validated outbound partner URL. Show it for `partial`, `not_returned`, `conflicting`, provider error, or any property/room/rate-scoped returned policy. Omit it only for selected-stay `complete` and selected-stay `explicit_none`.

Visible label:

- Named partner: `Confirm policy with {partnerLabel}`
- Unnamed partner: `Confirm policy with booking partner`

Use the same safe, affiliate-marked `providerUrl`, opening in a new tab with `rel="noopener noreferrer sponsored"`. Accessible name:

`{visibleLabel} for {hotelName}. Opens {partnerLabelOrBookingPartner} in a new tab. Deposit or hold details may still require confirmation with the property.`

This secondary action does not replace `Continue to {partner}` and must not claim to deep-link to a policy section. If a safe affiliate URL is missing, omit the action and retain the guidance sentence; do not render a disabled link.

Class pattern:

`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] px-4 text-center text-sm font-medium text-[color:var(--text-1)] hover:bg-[color:var(--brand-soft)] focus-visible:border-[color:var(--border-focus)] sm:w-auto`

## Primary action accessible copy

Do not place the entire policy in the primary action name. Add only the evidence state so a screen-reader user receives the same decision-critical warning before activation.

`HotelCard` review action suffixes:

- complete: `Additional-funds policy reported; review details before provider handoff.`
- partial: `Deposit or hold details are incomplete.`
- explicit none: `Provider reports no deposit or incidental hold for {scopePhrase}.`
- not returned: `Deposit and hold policy was not provided.`
- conflicting: `Deposit or hold details conflict.`
- error: `Deposit and hold policy could not be checked.`

`/book` outbound action appends the same state sentence after the existing nightly-rate and new-tab context. Loading cannot be present at outbound activation: if the policy is still loading, the action remains enabled, but its accessible suffix is `Deposit and hold policy is still being checked; confirm with the booking partner.` The visible loading state remains immediately before the action.

## Interaction rules

### Pointer/tap

- Tapping `Details` expands/collapses all hotel detail, including the full policy panel.
- Tapping the policy-confirmation link opens the validated partner URL in a new tab and leaves `/book` open.
- Tapping `Continue to {partner}` preserves existing handoff behavior.
- Policy state never intercepts, disables, or silently reroutes the existing actions.

### Keyboard

- Tab order follows DOM order: hotel content → policy summary → `Review hotel` → `Details`; on `/book`: general content → policy confirmation link when present → primary outbound action → `Back to search`.
- `Enter` or `Space` on `Details` toggles it via native button behavior.
- `Enter` on either link follows native link behavior.
- Focus stays on `Details` after expanding/collapsing.
- No non-interactive policy row receives `tabIndex`.

### Retry

- `Retry policy check` calls only the additional-funds policy retry path.
- One activation produces one request; disable the retry control during that request and change its visible label to `Checking policy…`.
- Success renders the returned evidence state. Empty response normalizes to `not_returned`. Another failure returns to provider error.
- Retry never refetches or changes the displayed hotel price without a separate price-state update.

### Offer changes and cache replay

- When the selected offer changes, replace the old policy with loading before reading the new offer; never flash the prior hotel's policy.
- Six-hour cached replay must be semantically equal to live normalization, including state, obligation order, source, scope, missing fields, conflicts, and fetched time.
- Legacy cache entries without the object normalize to `not_returned` and identify the provider as the checked source.

## Responsive specification

### Mobile — 375px

- One column throughout; no horizontal scroll.
- `HotelCard` summary spans the card width above the score/action row.
- Full panel padding: `p-3.5`; obligation facts use `grid-cols-1`.
- Amounts use `break-words` and `tabular-nums`; never `truncate`, `line-clamp-*`, or `whitespace-nowrap` on policy text.
- Long provider wording and source labels use `break-words [overflow-wrap:anywhere]`.
- Panel, disclosure, retry, confirmation, and primary actions have a minimum 44px target.
- Policy confirmation is full width; it sits immediately above the primary outbound action with at least `gap-3`.
- Do not use icons that consume width needed for the mechanism or amount. A decorative icon, if retained, is `aria-hidden` and never the sole state cue.

### Desktop — 1280px

- `/book` remains within the existing `max-w-6xl` shell.
- Full policy panel may use `sm:grid-cols-2` for fact rows within each obligation.
- Multiple obligations can use a two-column grid only when each complete obligation remains a self-contained card and DOM order remains unchanged.
- The decision sequence remains price → policy → action. Do not use CSS `order-*`, grid-area reordering, or a sticky CTA that visually precedes the policy.
- Confirmation link may size to content (`sm:w-auto`); the primary outbound action remains full width in the action stack.

## Tailwind class patterns

Full panel base:

`rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3.5 sm:p-5`

State additions:

| State | Classes |
|---|---|
| Complete | `border-[color:var(--border)] bg-[color:var(--bg-surface)]` |
| Explicit none | `border-[color:var(--border)] bg-[color:var(--bg-raised)]` |
| Partial / not returned / conflicting | `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]` |
| Error | `border-[color:var(--border-strong)] bg-[color:var(--error-soft)]` |
| Loading | `border-[color:var(--border)] bg-[color:var(--bg-surface)]` |

Heading:

`text-base font-bold leading-6 text-[color:var(--text-1)] sm:text-lg`

State summary:

`mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]`

Supporting copy:

`mt-2 text-sm leading-6 text-[color:var(--text-2)]`

Obligation list:

`mt-4 space-y-3`

Obligation card:

`rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5`

Fact grid:

`mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2`

Fact term/value:

- `dt`: `text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-3)]`
- `dd`: `mt-1 break-words text-sm font-medium leading-5 text-[color:var(--text-1)] [overflow-wrap:anywhere]`

Source/scope:

`mt-3 break-words border-t border-[color:var(--border)] pt-3 text-xs font-medium leading-5 text-[color:var(--text-3)] [overflow-wrap:anywhere]`

Use only existing tokens: `--bg-base`, `--bg-surface`, `--bg-raised`, `--bg-muted`, `--border`, `--border-strong`, `--border-focus`, `--brand`, `--brand-soft`, `--text-1`, `--text-2`, `--text-3`, `--warning-soft`, `--error-soft`, `--radius-card`, `--radius-control`, and `--focus-ring`. Do not introduce a deposit-specific color.

## Accessibility requirements

- The full panel is a `<section>` with a unique heading id. Each obligation is an `<article>` with its own mechanism heading.
- Use text to identify every state and mechanism; color and iconography are supplemental only.
- Loading status is polite and busy. Provider error is polite because the rest of the review remains operable.
- State changes after user retry announce the new state once. Do not put the entire static panel in a live region.
- The source/scope line remains visible; it is not tooltip-only or screen-reader-only.
- Dynamic amount text and provider wording must support 200% text zoom and reflow at 320 CSS px without two-dimensional scrolling.
- All controls retain the global focus outline/`--focus-ring`. Do not remove outline without an equivalent.
- Link accessible names retain the visible label as a prefix.
- Native button/link semantics are required; no clickable `<div>`.
- The ellipsis in loading copy is a Unicode ellipsis and is not animated character by character.
- No policy content is conveyed only through `title`, hover, tooltip, icon, or an `aria-label` that lacks visible equivalent text.

## Empty and malformed evidence

There is no blank/empty UI state. Normalize as follows:

| Input | Result |
|---|---|
| Policy property absent | `not_returned` |
| `null` policy | `not_returned` |
| Empty obligations with no explicit-none marker | `not_returned` |
| Unknown state enum | `not_returned` plus internal validation telemetry |
| Invalid money, percentage, range, or currency | `partial`; omit invalid value and include its missing field |
| Explicit none plus obligation | `conflicting` when both are valid sourced records; otherwise `not_returned` |
| Complete missing a required field | `partial` |
| Conflicting with fewer than two records | `partial` if one record is usable; otherwise `not_returned` |
| Missing source | `partial` when other facts exist; `not_returned` when no usable fact exists |
| Missing scope | `partial` when other facts exist; `not_returned` when no usable fact exists |

Do not expose parsing or validation errors, raw enum names, stack traces, or raw provider payloads to the traveler.

## Edge cases

1. **Zero amount:** A provider-confirmed zero amount is not automatically `explicit_none`. Show `{currency} 0.00` only if the provider still documents an obligation; otherwise require explicit-none semantics from the adapter.
2. **Negative or unsafe integer:** Invalid; never format. Normalize according to the malformed-evidence table.
3. **Different currencies in one range:** Invalid range; render partial and identify amount/rule as missing.
4. **Different currencies across obligations:** Show each, do not convert or total, and display the different-currency sentence.
5. **Percentage above 100 or below 0:** Invalid unless the provider contract explicitly permits and validates it; do not silently clamp.
6. **Very long variable rule:** Preserve validated meaning, wrap text, and cap no content with CSS. Sanitization removes markup but not substantive conditions.
7. **Timing contains a date:** Attribute it as provider wording and still render the fixed bank/card no-guarantee sentence.
8. **Provider says “instant” or “immediate”:** Render as attributed provider wording; never repeat it as expaify's promise.
9. **Cash-only deposit:** Show returned payment wording. Do not add card-issuer timing unless the returned mechanism/payment method involves bank/card processing; still state the property refund is conditional.
10. **Debit-card applicability:** Show the provider wording. For a documented hold, `available card balance` remains the generic impact phrase; do not claim a credit-limit impact if only debit applies.
11. **Property-level amount with selected-rate page:** Always show the property-scope caution; never rewrite it as selected-stay evidence.
12. **Conflicts across scopes:** Show each scope with its record; do not use the narrower scope as preferred without an explicit normalized precedence contract.
13. **Current Hotellook:** Always not returned. Do not create fixtures that leak into production UI as real-property policy data.
14. **No safe provider URL:** Omit policy-confirmation link, preserve copy, and follow existing booking-unavailable handling for the primary action.
15. **No valid nightly price:** Policy can still render as evidence, but it must not make the hotel bookable or repair the invalid price state.

## Analytics specification

Analytics must never block rendering or handoff. Do not send raw provider wording, policy text, property names, full URLs, precise timestamps, or unbucketed amounts.

### `hotel_funds_policy_summary_viewed`

Fire once per offer per surface after at least 50% of the summary/panel is visible for 1 second.

Properties:

- `policyState`: complete, partial, explicit_none, not_returned, conflicting, or error
- `obligationTypes`: sorted comma-delimited normalized enum values; `none` for explicit none; `unknown` for not-returned/error
- `scope`: normalized scope or `not_returned`
- `provider`: normalized provider id
- `surface`: `hotel_card` or `book_handoff`
- `amountToPriceBand`: only when safely calculable from a single exact same-currency obligation and a valid provider-confirmed comparison price; allowed values `lt_10_pct`, `10_24_pct`, `25_49_pct`, `50_99_pct`, `gte_100_pct`; otherwise omit

The current nightly rate is not a stay total, so production must omit `amountToPriceBand` until a valid comparison denominator exists.

### `hotel_funds_policy_details_opened`

Fire once per offer when the existing hotel `Details` control first exposes the full policy panel. Use the same evidence dimensions as summary-viewed and `surface: hotel_card`.

### `hotel_funds_policy_confirm_clicked`

Fire only from the explicit `/book` `Confirm policy with…` action.

Properties: `policyState`, `obligationTypes`, `scope`, `provider`, `surface: book_handoff`, and coarse `partnerNamed` boolean. Do not infer this event from `Continue`, back, return, dwell time, or details-open.

### Existing handoff events

Append `policyState` and `obligationTypes` to:

- `hotel_handoff_viewed`
- `hotel_handoff_continue_clicked`
- `hotel_handoff_back_clicked`
- `hotel_handoff_returned`

These dimensions support correlation only. Do not label abandonment, return, no-continue, or dwell time as deposit concern or policy-confirmation intent.

## Acceptance tests for UI and DEV

### Contract and continuity

1. Fixture complete hold, complete deposit, mixed obligations, partial, explicit none, not returned, conflicting, and variable amount through live normalization and cache replay.
2. Assert semantic equality of the normalized object after cache replay.
3. Build and parse hotel booking context and assert semantic equality through `/book`.
4. Assert missing/legacy policy becomes visible `not_returned`, never omitted or explicit none.
5. Assert every current Hotellook fixture normalizes to `not_returned`.
6. Assert invalid money/range/percentage cannot reach a formatted UI amount.

### Visible copy

1. Complete hold names `Temporary card hold`, says it is not part of stay price, and describes available-balance impact.
2. Complete deposit names `Refundable deposit`, says it is collected separately, and does not call it a hold or fee.
3. Partial lists the exact missing facts and preserves returned facts.
4. Explicit none includes returned scope and never generalizes property scope to selected stay.
5. Not returned says the provider did not supply the policy and that additional available funds may still be required.
6. Conflicting shows every incompatible record with source/scope and selects none.
7. Variable shows provider rule and no fabricated exact amount.
8. Every provider release/refund sentence is followed by the applicable fixed no-guarantee bank/card sentence.
9. No policy amount appears in stay price, taxes/fees, mandatory fees, or Deal Score.

### Interaction and accessibility

1. At 375px, all policy text wraps without truncation or horizontal scrolling and all controls are at least 44px high.
2. At 1280px, DOM and visual order remain price → policy → action.
3. `Details` exposes the full policy with correct `aria-expanded`/`aria-controls`; focus remains on the button.
4. Loading announces once in a polite live region; error remains non-blocking.
5. Keyboard tab order matches DOM order and all links/buttons have visible focus.
6. At 200% zoom/320 CSS px, provider wording, amounts, sources, and scope reflow.
7. State is understandable with color removed and in forced-colors mode.

### Analytics

1. Summary-view fires once per offer/surface after the exposure threshold.
2. Detail-open fires once on first policy exposure.
3. Confirmation intent fires only from the explicit confirmation link.
4. Existing handoff events include normalized state/type dimensions.
5. Payloads contain no raw policy wording, property name, full URL, or unbucketed amount.

## Implementation ownership and handoff

### UI stage

- Build the shared summary/full policy presentation.
- Place collapsed and expanded states in `HotelCard`.
- Place the full state immediately before outbound handoff in `BookingFlow`.
- Implement every copy, responsive, focus, keyboard, and live-region rule.
- Add component tests for all states and 375px-safe class/DOM rules.

### DEV stage required

Logic/data work is required after UI because the current contract cannot carry the evidence:

- add validated shared types in `lib/types.ts`;
- normalize provider evidence and synthetic Hotellook `not_returned` through live and cached paths;
- preserve the structured object through `BookingHotelContext` without unsafe URL truncation;
- add analytics dimensions and deduped exposure logic;
- test adapters, cache replay, booking-context parsing, and malformed evidence.

The UI stage must not fabricate non-Hotellook evidence to make production states appear populated. Tests and Storybook-like fixtures may exercise every state, but real UI data remains `not_returned` until an approved provider returns facts.

## Success and release gates

This design is successful when a first-time traveler can identify before handoff:

1. whether the provider supplied a policy;
2. whether the mechanism is a temporary hold or collected deposit;
3. the amount/rule, basis, and application timing when returned;
4. that the obligation is separate from stay price and mandatory fees;
5. the evidence source and scope;
6. that provider release/refund wording is not a guaranteed funds-availability date.

Formative comprehension target: at least 90% correct for each item and each evidence state, including not-returned and conflicting. Any item below 90% returns to UXDES copy revision before production claims are broadened.

## Blockers and out-of-scope findings

1. **Provider evidence blocker:** Hotellook's current cache endpoint returns none of the required fields. Production can honestly ship not-returned/error states, but complete, partial, explicit-none, conflicting, and variable real-property states require an approved provider contract.
2. **Live-surface blocker:** `HotelCard` is not mounted on a production results surface. UI implementation alone will not create traveler exposure or usable exposure analytics.
3. **Price-basis integrity conflict:** Hotellook documents `priceFrom` as a minimum price per requested stay while the app presents it as per night. This remains an out-of-scope P0 repair and blocks amount-to-price materiality calculations.
4. **No validated materiality threshold:** All returned obligations receive equal baseline disclosure. Do not suppress “small” amounts or approximate ratios from nightly price.

