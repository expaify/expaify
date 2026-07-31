# UXDES-HOTEL-PET-POLICY-01: Hotel Pet-Policy Fit Design

Date: 2026-07-31  
Stage: UX Design  
Priority: P0  
Feature slug: `hotel-pet-policy`

## 1. Decision, Scope, And Release Boundary

This specification refreshes `docs/pipeline/hotel-pet-policy/02-research.md` against the current mounted path:

`/deals` → `DealFeed` → `DealCard` → `/deals/[dealId]` saved detail → affiliate provider.

The earlier `HotelCard` policy presentation is reference code only. It is not mounted by a production page and is not the implementation target for this ticket.

The traveler-facing decision has exactly three semantic outcomes:

- **Eligible for your pet** — supplier evidence resolves the stated animal, limits, material restrictions, selected stay, charge state, deposit state, provenance, and freshness.
- **Ineligible for your pet** — applicable supplier evidence explicitly establishes a mismatch.
- **Needs confirmation** — any material fact is absent, conditional, stale, malformed, conflicting, broader than the selected stay, or unavailable.

An unknown is a safe result, not an error and not an ineligible result. Neither a generic `pets` amenity nor property-level `Pets Allowed` is enough to show eligible.

### Current release decision

The active provider path has 0% normalized pet-policy coverage. The production deal and saved-detail models carry no pet evidence. Therefore UI may implement fixture-backed presentational states and tests, but must not mount populated eligibility claims or a pet-fit filter in production yet.

Production release requires both gates:

1. **Supplier-coverage gate:** verified production-like payloads enter through `lib/providers`, survive live and cache normalization, and meet the thresholds in §14.
2. **Reachability gate:** the same evidence and profile-derived outcome survive the mounted `DealCard` → saved detail → affiliate-provider path without falling back to generic or contradictory copy.

This design does not authorize a new supplier, property messaging, service-animal/legal advice, ranking changes, a pet-services feature, or blending pet costs into the nightly price or Deal Score.

## 2. Experience Architecture And Hierarchy

### Results page

Order on `/deals`:

1. Existing destination/search context and filters.
2. New pet-profile panel, immediately before the result status/sort controls.
3. Existing result status and result grid.
4. Each `DealCard` gains one read-only pet-fit scan block.

The pet profile evaluates and annotates results. It does not remove or reorder inventory. No `Pet-friendly` filter is shown while release gates are unmet.

`DealCard` hierarchy:

1. Hotel name, class, city, and stay window.
2. **Pet-fit outcome and first decision-changing fact.**
3. Existing nightly deal price, usual price, discount, Deal Score headline, and freshness.
4. Existing image and `View deal` affordance.
5. Existing price-check trust line.

The card remains one outer link. The pet block contains no button, link, disclosure, tooltip, or other nested interactive element. Its full evidence is reached with the existing card link.

### Saved detail

Keep the current decision-section order. Within `Hotel fit`, use this order:

1. Pet-profile summary and `Edit pet details` control.
2. `Pet policy for your stay` outcome and evidence.
3. Existing hotel class and guest rating.
4. Existing quiet-stay evidence.

The complete pet policy appears before `Check rooms with provider`. The provider section repeats the outcome and unresolved cost/acceptance boundary immediately before affiliate options. Supporting evidence remains after the handoff section.

### Provider handoff

The provider section does not introduce a fourth outcome:

- eligible: continue to check live rooms, while confirming the policy is still current;
- needs confirmation: use the provider to confirm acceptance, charge, deposit, and restrictions;
- ineligible: return to results is primary; provider options remain available only as explicit policy-verification actions because policies can change.

Every outbound destination remains an existing validated affiliate URL. Never fabricate a property-contact link or remove affiliate markers.

## 3. Minimum Pet Profile

Use one reusable inline panel on results and saved detail. Do not use a modal.

### Closed states and final copy

No profile:

- Heading: `Travelling with a pet?`
- Body: `Add the minimum details needed to compare your pet with hotel policies.`
- Button: `Add pet details`
- Disclosure: `We only show an eligibility result when a provider returns enough policy evidence for your selected stay.`

Saved profile:

- Heading: `Your pet details`
- Summary examples: `1 dog · 20 lb` or `2 cats · weights not provided`
- Button: `Edit pet details`
- Disclosure: `Hotel policy results use these details. Final acceptance and costs are confirmed by the provider or property.`

### Fields

| Order | Control | Label | Options / helper | Requirement |
|---|---|---|---|---|
| 1 | Radio group | `Type of pet` | `Dog`, `Cat`, `Other animal` | Required |
| 2 | Text input when Other | `Animal type` | `Enter the animal type, such as rabbit.` | Required when Other; 2–40 trimmed characters |
| 3 | Number input | `Number of pets` | `Enter the total travelling on this stay.` | Required integer 1–9 |
| 4 | Radio group | `Do you know each pet's weight?` | `Yes`, `Not sure` | Required |
| 5 | Repeated decimal input when Yes | `Pet {n} weight` | Unit select: `lb`, `kg`; `Use each pet's current weight.` | Required for every pet when Yes |

Do not ask for a name, breed, or service-animal status. An uncollected breed against a returned breed restriction produces needs confirmation.

### Actions

- New profile primary: `Check hotel policies`
- Existing profile primary: `Update policy results`
- Existing profile secondary: `Cancel changes`
- Saved profile tertiary: `Remove pet details`

Removal confirmation is inline:

- `Remove these pet details? Eligibility results will no longer be shown.`
- Actions: `Keep details` and `Remove details`

Removing a profile does not change hotel inventory, order, search criteria, or saved deal state.

### Validation copy and behavior

Validate on submit and on blur after touch. Preserve entered values.

| Condition | Error copy |
|---|---|
| Type missing | `Choose a pet type.` |
| Other animal blank | `Enter the type of animal travelling.` |
| Other animal outside 2–40 characters | `Enter an animal type between 2 and 40 characters.` |
| Count blank/non-integer | `Enter a whole number of pets.` |
| Count outside 1–9 | `Enter between 1 and 9 pets.` |
| Weight choice missing | `Choose Yes or Not sure.` |
| Required weight blank | `Enter this pet's weight, or choose Not sure.` |
| Weight zero/negative | `Enter a weight greater than 0.` |
| Weight over 300 lb/136 kg | `Check this weight and enter 300 lb / 136 kg or less.` |

On failed submit, show `Pet details need attention. Review the highlighted fields.` and focus the first invalid field. Each error is visible text connected with `aria-describedby`; invalid controls use `aria-invalid="true"`.

### Profile persistence

Within a results session, the saved profile applies atomically to every loaded and subsequently loaded card. Opening a real unlocked card carries an opaque, bounded profile reference and evaluation version into saved detail; do not place free-form animal type, weights, supplier prose, or policy statements in the URL.

Direct entry to a saved detail without a valid profile reference shows the no-profile state. An expired/malformed reference degrades to no profile and announces `Your pet details could not be restored. Add them again to check this hotel.` It never reuses a stale eligibility outcome.

## 4. Normalized Presentation Contract

UI consumes normalized evidence and a pure derived evaluation. React does not parse supplier prose or calculate eligibility.

```ts
type PetEligibilityStatus = 'eligible' | 'ineligible' | 'needs_confirmation'

type PolicyFactState = 'returned' | 'not_returned' | 'unknown' | 'malformed' | 'conflict'

interface PetCostFact {
  state: 'free' | 'required' | 'may_apply' | 'not_returned' | 'unknown' | 'malformed' | 'conflict'
  amount?: { priceCents: number; currency: string }
  basis?: 'per_pet_per_night' | 'per_pet_per_stay' | 'per_night' | 'per_stay' | 'other' | 'unknown'
}

interface PetDepositFact {
  state: 'not_required' | 'required' | 'may_apply' | 'not_returned' | 'unknown' | 'malformed' | 'conflict'
  amount?: { priceCents: number; currency: string }
  basis?: 'per_pet' | 'per_stay' | 'other' | 'unknown'
  refundability?: 'refundable' | 'partially_refundable' | 'nonrefundable' | 'unknown'
  returnCondition?: string
}

interface PetEligibilityEvaluation {
  status: PetEligibilityStatus
  reasonCodes: string[]
  firstDecisionReason: string
  unresolvedDimensions: string[]
  evidenceRef: string
  evaluationVersion: string
}
```

The referenced evidence independently preserves permission, included/excluded animal types, count, weight/size, restrictions, charge, deposit, room/rate/stay scope, source label, provider record ID when available, fetched/effective time, schema version, and all conflicting statements.

Absent arrays mean unknown; they are not normalized to explicit empty lists. Any amount is integer minor-unit money. Charge and deposit are different families and never share a label or status.

### Outcome precedence

1. Applicable explicit prohibition or profile mismatch → ineligible.
2. Conflict where every credible interpretation is ineligible → ineligible.
3. Any credible interpretation might permit the pet, or any material acceptance/cost/scope fact is unresolved → needs confirmation.
4. Eligible only when all material dimensions, including charge and deposit state, selected-stay scope, provenance, and freshness resolve.

A required known charge or deposit does not make the pet physically ineligible. It prevents an eligible claim only when its required amount/basis or material condition remains unresolved.

## 5. DealCard Scan Specification

### Anatomy

Place the pet block after the hotel metadata and before the price block. Pattern:

`rounded-[var(--radius-control)] border border-[color:var(--border)] px-3 py-2 text-caption leading-5`

First line is `font-display font-bold`; support is `mt-0.5 font-medium`. Allow natural height and wrapping. Do not line-clamp negation, money, basis, or `may apply`.

### Exact result copy

| State | Outcome | Supporting line |
|---|---|---|
| Eligible, no required cost | `Eligible for your pet` | `Policy fits {profile summary} for this stay.` |
| Eligible, known charge | `Eligible for your pet` | `{charge} · {basis}. Deposit: {deposit summary}.` |
| Eligible, known deposit only | `Eligible for your pet` | `Deposit: {amount} {refundability}; {basis}.` |
| Explicit prohibition | `Ineligible for your pet` | `This provider says pets are not allowed.` |
| Type mismatch | `Ineligible for your pet` | `{stated type plural} are not allowed.` |
| Count mismatch | `Ineligible for your pet` | `This policy allows up to {count} {pet/pets}.` |
| Weight mismatch | `Ineligible for your pet` | `This policy allows pets up to {weight} {unit} each.` |
| By arrangement | `Needs confirmation` | `Property approval is required before booking.` |
| Policy not returned | `Needs confirmation` | `This provider did not return a pet policy.` |
| Policy lookup error | `Needs confirmation` | `Pet policy could not be checked.` |
| Conflict | `Needs confirmation` | `Available policy statements conflict.` |
| Partial acceptance/limits | `Needs confirmation` | `Acceptance or pet limits are not fully documented.` |
| Required charge unresolved | `Needs confirmation` | `A pet charge applies, but its amount or basis is unclear.` |
| Deposit unresolved | `Needs confirmation` | `A pet deposit may apply; terms are unclear.` |
| Stale | `Needs confirmation` | `This policy may have changed since it was checked.` |
| Profile weight missing against limit | `Needs confirmation` | `Add each pet's weight to check this limit.` |
| Card policy loading | No outcome | `Checking pet policy…` |
| No profile | No outcome | `Add pet details to check this policy.` only when usable policy evidence exists; otherwise omit the block |

If both a charge and deposit are known but cannot fit in two natural lines at 375px, show the first decision-changing cost and `More policy costs in deal details.` Never combine them as `Pet fees`.

### Tone

- Eligible: `bg-[color:var(--success-soft)] text-[color:var(--success)]`
- Ineligible: `bg-[color:var(--error-soft)] text-[color:var(--text-1)]`; reason `text-[color:var(--error-text)]`
- Needs confirmation: `bg-[color:var(--warning-soft)] text-[color:var(--warning)]`
- Loading/neutral: `bg-[color:var(--bg-muted)] text-[color:var(--text-2)]`

Outcome text is always present; icons, if later added, are decorative and `aria-hidden="true"`.

## 6. Saved-Detail Policy Specification

### Container and order

Within the existing `Hotel fit` section, insert:

```text
profile summary/edit
section[aria-labelledby="saved-pet-policy-title"]
  h3 "Pet policy for your stay"
  outcome advisory
  dl evidence facts
  unresolved/conflict list
  source and freshness
  confirmation boundary
existing hotel-class / rating / quiet-stay evidence
```

Container:

`mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4`

Facts:

`mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2`

Each fact card uses `min-w-0`; `dt` uses `text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]`; `dd` uses `mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]`. `Policy outcome`, `Other restrictions`, `Unresolved details`, and `Evidence` span both desktop columns.

### Fact order, labels, and value rules

1. `Policy outcome`
2. `Animal types`
3. `Pet charge`
4. `Pet deposit`
5. `Number of pets`
6. `Weight or size limit`
7. `Other restrictions`
8. `Applies to`
9. `Policy source`
10. `Policy checked`

Final values:

- Types explicit: `Dogs and cats allowed.` / `Dogs allowed; cats not allowed.`
- Types absent: `Allowed animal types were not specified.`
- Charge free: `No pet charge stated by {source}.`
- Charge known: `{money} {basis}.`
- Charge may apply: `A pet charge may apply; amount and basis were not provided.`
- Charge required/amount absent: `A mandatory pet charge applies; amount was not provided.`
- Charge absent: `Pet charge was not specified.`
- Deposit not required only when explicit: `No pet deposit stated by {source}.`
- Deposit known/refundable: `{money} refundable deposit {basis}. Return condition: {condition}.`
- Deposit known/refundability unknown: `{money} deposit {basis}. Refundability was not specified.`
- Deposit may apply: `A pet deposit may apply; amount and terms were not provided.`
- Deposit absent: `Pet deposit was not specified.`
- Count explicit: `Up to {count} {pet/pets}.`
- Count absent: `Pet count limit was not specified.`
- Weight explicit: `Up to {weight} {unit} per pet.`
- Weight absent: `Weight or size limit was not specified.`
- Explicit complete empty restriction set: `No additional restrictions were returned.`
- Restrictions absent/incomplete: `Additional restrictions were not specified.`
- Property scope: `Property-level policy; selected room and rate still need confirmation.`
- Room scope: `Room-level policy; selected rate still needs confirmation.`
- Rate scope: `Rate-level policy; selected room still needs confirmation.`
- Selected stay: `This selected stay.`
- Scope absent: `Policy scope was not specified.`
- Source: `{sourceLabel}`; absent provenance forces needs confirmation and `Policy source could not be confirmed.`
- Freshness: `Checked {localized date}.`; absent date: `Policy freshness was not provided.`

Never calculate or display a stay-total charge/deposit unless amount, basis, pet multiplier, night multiplier, currency, and selected-stay applicability are explicit and separately approved total-price work exists. Neither cost is added to displayed nightly price, savings, or Deal Score.

### Restriction and conflict display

Show all material restrictions; do not hide them behind another disclosure. Use normalized text first. Unstructured supplier wording uses `Provider statement: “{minimal relevant text}”` with adjacent source attribution.

For conflict, list each credible statement under `Conflicting policy details` with source, scope, and date. Do not select the most permissive statement or merge fragments.

## 7. Detailed Outcome And Unknown Copy

### Eligible

- Outcome: `Eligible for your pet`
- Body: `The policy returned by {source} fits your stated {profile summary} for this stay.`
- Boundary: `The provider or property confirms the current policy, room availability, pet charge, and deposit before booking.`

Use only when the high threshold in §4 passes.

### Ineligible

- Outcome: `Ineligible for your pet`
- Prohibited: `The provider says this property does not allow pets.`
- Type: `The policy allows {allowed types}, not your stated {type}.`
- Count: `The policy allows up to {count}; your profile includes {profile count}.`
- Weight: `The policy limit is {weight} {unit} per pet; at least one stated pet exceeds it.`
- Boundary: `Choose another hotel, or verify with the provider if you believe the policy has changed.`

Show the decisive reason first and every additional mismatch in the fact list.

### Needs confirmation

- Outcome: `Needs confirmation`
- General body: `The available policy does not resolve every detail for your pet and selected stay.`
- Advisory heading: `Confirm before booking`
- Advisory body: `Confirm {human-readable unresolved list} with the provider or property.`

Use only these human labels: `pet acceptance`, `allowed animal type`, `pet count limit`, `weight or size limit`, `additional restrictions`, `pet charge`, `pet deposit and refund terms`, `selected room and rate`, `policy source`, `policy freshness`.

### Named unknown/error headings

| Data state | Heading | Body | Recovery |
|---|---|---|---|
| `not_returned` | `Pet policy not returned` | `This provider did not return pet acceptance, charge, deposit, or restriction details for this hotel.` | `Confirm with provider` |
| `by_arrangement` | `Property approval required` | `This property accepts pets only by arrangement. Confirm approval, charges, deposits, and restrictions before booking.` | `Confirm with provider` |
| `error` | `Pet policy could not be checked` | `Hotel availability is unchanged, but pet acceptance and costs need confirmation.` | `Try pet policy again` when retry exists; otherwise `Confirm with provider` |
| `conflict` | `Pet policy information conflicts` | `The available statements disagree. We cannot confirm that this hotel supports your pet until the provider or property resolves them.` | `Confirm with provider` |
| stale | `Pet policy may have changed` | `This policy was checked {date}. Confirm the current acceptance, charge, deposit, and restrictions.` | `Check current policy with provider` |
| malformed | `Some pet policy details are unclear` | `The provider returned a pet policy, but one or more values could not be confirmed.` | `Confirm with provider` |

Malformed charge: `A pet charge is listed, but its amount or basis could not be confirmed.`  
Malformed deposit: `A pet deposit is listed, but its amount, refundability, or return condition could not be confirmed.`  
Malformed limit: `A pet limit is listed, but its value could not be confirmed.`

Never expose parser, schema, cache, API, or payload language to travelers.

## 8. Provider-Handoff Boundary

Immediately under `Check rooms with provider` and before provider options, show a compact recap.

### Eligible handoff

- `Eligible based on the policy checked {date}.`
- `Confirm the current pet charge, deposit, and room-level terms on the provider site.`
- Provider option label remains `Check rooms on {provider}`.

### Needs-confirmation handoff

- `Pet policy needs confirmation before booking.`
- `Confirm: {up to three unresolved items}.` If more: `Confirm all unresolved details listed in Hotel fit.`
- Provider option label: `Confirm on {provider}`.
- Accessible name: `Confirm pet policy and check rooms for {hotel} on {provider}; opens in a new tab`.

### Ineligible handoff

- Alert title: `This hotel does not support your stated pet.`
- Body: `{first mismatch reason} Return to results to choose another hotel.`
- Primary action: existing `Back to results` destination, labelled `Choose another hotel`.
- Existing affiliate options remain visually secondary and are relabelled `Verify current policy on {provider}`.
- Accessible name: `Verify whether the pet policy changed for {hotel} on {provider}; opens in a new tab`.

Do not disable a link with CSS, remove keyboard access, or send a traveler to a generic provider homepage. If no valid affiliate option exists, show `No provider link is available to confirm this policy. Return to results and choose another hotel.`

The saved-detail outcome and handoff recap must derive from the same evidence reference and evaluation version. A mismatch between them fails closed to needs confirmation.

## 9. Loading, Empty, Error, And Freshness States

### Results/profile loading

- Profile restore: stable three-line skeleton; screen-reader status `Loading your pet details…`.
- Profile submitted: controls disabled, primary label `Checking hotel policies…`, results region `aria-busy="true"`.
- Existing cards may remain visible but must not retain positive/negative outcomes from the prior profile; replace pet blocks with `Checking pet policy…`.
- Newly paginated cards receive loading then the current evaluation; do not announce each card separately.

### Policy error and retry

A policy-only error leaves hotel inventory, price, card link, and provider options usable. On card/detail use needs-confirmation copy from §7. A safe policy retry updates only the policy region; label `Checking policy…`; retain focus on the retry button and replace content in place.

### Inventory empty/error

- Zero hotels: keep the owning result empty state. Do not say `No pet-friendly hotels` or `No hotels allow your pet`.
- Hotel feed error: keep the owning feed error and retry. Pet UI does not replace or duplicate it.
- Hotels exist but every policy is unknown: show above the grid `Pet policy details are unavailable for these hotels. Open a deal and confirm with the provider before booking.` Results stay visible.
- Saved detail missing/not found: keep the current route not-found state; do not render policy claims from cached client state.

### Cache and stale evidence

A valid cache replay has the same semantics and original `fetchedAt` as the fresh object. Cache replay time is not policy freshness. Schema mismatch, missing provenance, or lost cost family degrades to needs confirmation. During revalidation, never retain an earlier eligible outcome.

### Detail route loading/error

Add a policy-shaped skeleton inside the existing saved-detail loading composition without changing the route-level status copy `Restoring your search…`. The route error keeps `Hotel details could not be loaded`; no standalone policy retry is offered when the entire detail failed.

## 10. Responsive Composition

### 375px mobile

- Profile and policy fields are one column.
- Weight input/unit use `grid-cols-[minmax(0,1fr)_5rem] gap-2`; pet weights stack.
- `DealCard` remains a single-column card in the existing result grid. Pet block is full width with natural height.
- No `truncate`, `line-clamp`, fixed height, or horizontal scroll on policy copy.
- Saved-detail policy facts are one column. Charge and deposit are separate stacked facts.
- All new actions are full width and at least 44px high; secondary affiliate verification links stack with `gap-3`.
- Long currency, basis, negation, and `may apply` phrases wrap as units where possible; omit a secondary scan fact rather than clip it.

### 1280px desktop

- Keep the results grid at the existing three-column breakpoint. Pet status remains inside each card, not a separate grid column.
- Profile panel may use two columns; every label stays above its control.
- Saved-detail facts use two equal columns. Outcome, restrictions, unresolved details, conflicts, and evidence span both.
- Provider recap sits above, not beside, affiliate options so reading order matches mobile.

### Stress checks

Verify 320px, 375px, 1280px, 200% zoom, browser text enlargement, 30% translated-text expansion, a 40-character hotel name, nine pets, two different weight units, three restrictions, `CAD 125 per pet, per stay`, a refundable `CAD 300 per stay` deposit with a long return condition, and every named unknown heading. No overlap, clipped text/action, or page-level horizontal scroll is allowed.

## 11. Keyboard, Focus, And Assistive Technology

### Results order

1. Existing search/filter controls.
2. `Add/Edit pet details`.
3. Profile controls in field order.
4. Save/cancel/remove actions.
5. Existing sort controls.
6. Whole-card links in result order.

Opening the profile focuses the first type radio. Cancel, successful save, and completed removal return focus to the profile trigger. Removal confirmation keeps focus within normal DOM order; `Keep details` returns focus to `Remove pet details`.

The card’s accessible name appends only the outcome and first reason, for example: `View deal: Hotel Luna; Needs confirmation: a pet deposit may apply.` Do not include the entire policy or duplicate price content.

### Saved detail order

Back link → profile edit → policy retry if present → existing provider/back actions → supporting disclosures. Evidence is semantic text, not focusable cards. Use native headings, `<dl>`, lists, buttons, and links.

### Announcements

Use one results-level `role="status" aria-live="polite" aria-atomic="true"`:

- `Checking pet policies for {count} hotels.`
- `Pet details updated. {eligible} eligible, {confirmation} need confirmation, and {ineligible} ineligible.`
- `Pet details removed. Eligibility results are no longer shown.`
- `Pet policy updated for {hotel}: {outcome}.` only for a traveler-initiated single retry.

Do not announce every card on initial load. Batch async changes and ignore completions from an older profile/evaluation version.

All new controls have at least 44px targets. Existing global `:focus-visible` styling remains. Outcome is never conveyed by color or icon alone. Do not move focus when policy content loads or changes unless validation failed.

## 12. Tailwind Patterns Using Existing Tokens

Profile container:

`rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4 sm:p-6`

Field label:

`block text-sm font-medium text-[color:var(--text-1)]`

Input/select:

`field-input mt-1` with error addition `border-[color:var(--error)]`

Radio option:

`flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm font-medium text-[color:var(--text-1)]`

Helper/error:

- helper: `mt-1 text-xs leading-5 text-[color:var(--text-3)]`
- error: `mt-1 text-xs font-medium leading-5 text-[color:var(--error-text)]`

Outcome/advisory:

- eligible: `rounded-[var(--radius-control)] bg-[color:var(--success-soft)] px-3 py-2 text-sm font-medium text-[color:var(--success)]`
- ineligible: `rounded-[var(--radius-control)] bg-[color:var(--error-soft)] px-3 py-2 text-sm font-medium text-[color:var(--text-1)]`
- needs confirmation: `rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2 text-sm font-medium text-[color:var(--warning)]`

Secondary confirmation/provider link:

`inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] px-4 text-center text-sm font-medium text-[color:var(--text-1)] sm:w-auto`

Use existing `.skeleton`, `.btn`, `.btn-primary`, `.btn-outline`, and reduced-motion treatment. Add no colors, font sizes, radii, shadows, or animation tokens.

## 13. Copy And Logic Guardrails

Never show these unless the exact fact and scope are supplier-proven:

- `Pet-friendly`
- `All pets allowed`
- `No pets allowed` from missing data or a missing amenity token
- `No pet charge`
- `No pet deposit`
- `Refundable deposit`
- `No restrictions`
- `No weight limit`
- `No pet limit`
- `Eligible for your pet` from property-only, stale, generic, by-arrangement, conflicting, malformed, or incomplete evidence

Use `provider` for the affiliate/data partner and `property` for the hotel. Do not say expaify or a provider has approved the animal. General pet policy does not establish service-animal eligibility.

## 14. Release Gates And Future Filter

### Supplier-coverage gate

Validate production-like payload samples across at least 10 destinations, representative providers, stay lengths, cache hits, and refreshes. Required:

- explicit permission coverage ≥80%;
- ≥90% of eligible outcomes resolve type, count, weight/size, material restrictions, charge, deposit, selected-stay scope, provenance, and freshness;
- 100% charge/deposit amounts use integer minor-unit money and preserve currency/basis;
- 0 explicitly prohibited or materially mismatched fixtures evaluate eligible;
- unresolved cross-source conflicts <1%, with every remaining conflict needs confirmation;
- live and cache replay yield the same outcome and original freshness.

### Production-reachability gate

Required end-to-end checks:

- the profile is usable on mounted `/deals` at 375px and 1280px;
- every real unlocked `DealCard` renders the correct outcome and opens its saved-detail URL;
- saved detail restores the same profile/evidence/evaluation version or fails closed;
- saved-detail facts include separate charge and deposit rows;
- handoff recap matches saved-detail outcome and unresolved list;
- every outbound option preserves its affiliate marker;
- direct, stale, missing, locked, mock, and expired deals never inherit a prior eligible claim;
- analytics transport is production-capable before outcome metrics are reported.

### Future filter

No filter is implemented or displayed until both gates pass. If separately approved later, label it `Show hotels by pet-policy result` with `All hotels`, `Eligible`, `Needs confirmation`, and `Ineligible`. Unknown/conflicting hotels remain visible; `Eligible` may group eligible first but cannot silently discard needs-confirmation inventory. Empty copy: `No confirmed eligible hotels yet. {count} hotels still need confirmation.`

## 15. Acceptance Matrix

| Case | Required behavior |
|---|---|
| No profile | Entry point shown; no eligibility claim |
| Profile loading | Stable skeleton; no default-state flash |
| Validation error | Values retained; first invalid field focused |
| Profile save error | `We couldn't apply your pet details. Hotel results have not changed.` plus `Try again` |
| Profile save/update | All result statuses replace atomically; one batched announcement |
| Policy loading | Card remains openable; no prior outcome retained |
| Eligible | High-threshold evidence only; charge and deposit stay separate |
| Explicit mismatch | Ineligible plus first decisive reason |
| By arrangement | Needs confirmation; never eligible |
| Policy not returned | Needs confirmation; inventory remains visible |
| Policy error | Needs confirmation; policy-only retry when available |
| Partial evidence | Known facts plus named unresolved dimensions |
| Malformed charge/deposit/limit | Affected family unclear; no zero/free/refundable inference |
| Conflict | Credible statements retained; no permissive merge |
| Stale/cache | Original freshness retained; stale becomes needs confirmation |
| Every policy unknown | Honest banner; no pet-specific empty result |
| No inventory/feed error | Existing owning state wins |
| Locked/mock/expired card | No eligibility inherited; no unsupported handoff |
| Card → detail | Same profile/evidence/evaluation version or needs confirmation |
| Detail → provider | Repeated boundary; valid affiliate-marked URL only |
| 375px/200% zoom | One column, natural height, no clipping/scroll |
| 1280px | Existing three-card grid; two-column detail facts only |
| Keyboard/screen reader | Logical order, visible focus, one batched announcement, text outcome |

## 16. UI, DEV, And TEST Handoff

### UI scope

- Adapt the existing `PetProfilePanel` and `HotelPetPolicy` presentation into the mounted `DealFeed`/`DealCard` and saved-detail component hierarchy.
- Add a read-only scan prop to `DealCard` without breaking its outer-link contract.
- Add separate charge and deposit presentation states, every copy/state above, and fixture-driven component tests.
- Do not change provider, cache, API, evaluation, booking, or affiliate business logic.
- Keep production rendering gated off while the normalized contract and reachability are unavailable.

### DEV required before production release

- Replace the UI-local policy contract with provider-neutral types and a pure evaluator outside React.
- Map only verified supplier evidence through `lib/providers`; every adapter returns `Result<T>` and never throws to callers.
- Preserve evidence through cache schema/versioning and live/cache parity.
- Add profile/evidence continuity through deal feed, saved detail, and handoff using an opaque bounded reference.
- Add separate charge and deposit fields with integer money and no total-price inference.
- Fail closed on malformed, stale, conflicting, missing, or mismatched evidence versions.
- Preserve affiliate markers on all outbound links.
- Add privacy-safe analytics only after a production transport exists; never send free-form animal type, exact weights, supplier prose, or hotel/pet names.

### TEST requirements

Verify every acceptance-matrix row at 375px and 1280px, plus TypeScript/tests, keyboard, focus, screen-reader names, live/cache parity, outcome continuity, no nested interactivity in `DealCard`, and affiliate markers. End-to-end PASS is impossible until both §14 release gates are evidenced.

## 17. Definition Of Done For This Design

This spec is implementation-ready because it:

- targets the mounted `DealCard` → saved detail → affiliate-provider path;
- defines default, loading, empty, error, stale, malformed, conflict, mobile, desktop, focus, keyboard, and edge states;
- preserves eligible/ineligible/needs-confirmation semantics and explicit unknowns;
- defines the minimum pet profile and its continuity boundary;
- separates mandatory pet charges from deposits, refundability, and return conditions;
- supplies final visible and assistive copy with existing token-based Tailwind patterns; and
- makes supplier coverage and production reachability hard release gates rather than inferred readiness.
