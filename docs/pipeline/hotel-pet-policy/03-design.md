# UX Design: Stated-Pet Hotel Policy Fit

Ticket: `UXDES-HOTEL-PET-POLICY-01`  
Stage: UX Design  
Priority: P0  
Date: 2026-07-22

## Source And Decision Boundary

This specification implements the directives in `docs/pipeline/hotel-pet-policy/02-research.md` for the hotel-results card surface represented by `app/components/HotelCard.tsx`.

The active Hotellook path has **0% normalized pet-policy coverage**. It cannot establish permission, animal type, fee, limits, restrictions, selected-stay scope, or provenance. Therefore:

- No hotel may currently render `Fits your pet` or `Does not fit your pet` from live supply.
- The pet profile and policy components are implementation-ready here, but must remain unmounted in production until a normalized provider contract can distinguish `returned`, `not_returned`, `error`, and `conflict` and a production hotel-results owner is identified.
- The current product must not show an enabled or disabled pet filter. Withholding the control is clearer than presenting a control that cannot affect results.
- A future filter is specified only in §12 and remains behind every research coverage gate.
- `HotelCard` is not mounted by a production page in this branch. UI work may implement its component states and tests, but end-to-end completion, analytics, and exposure claims are blocked until a separately authorized integration identifies the owning results page.

This ticket does not authorize provider integration, a property-contact workflow, booking-flow redesign, total-price changes, ranking changes, service-animal advice, or production analytics work.

## 1. Experience Model And Hierarchy

The experience answers one narrow question: **Does this hotel's documented policy fit the animal and stay the traveller stated?** It does not relabel a generic supplier amenity as proof.

### Information hierarchy

1. **Primary:** hotel identity, nightly price, and existing `Review hotel` action.
2. **Secondary:** one pet-fit scan status for the stated profile, placed where it can affect the handoff decision.
3. **Tertiary:** complete policy facts, unresolved dimensions, scope, freshness, and supplier provenance in Details.

The pet status does not replace or modify Deal Score. Pet charges stay separate from the nightly rate and Deal Score.

### Component and DOM order

Collapsed `HotelCard`:

1. Existing image / name and quality / location / price grid.
2. **New full-width pet-fit scan line.**
3. Existing Deal Score and `Review hotel` row.
4. Existing `Details` toggle.

Expanded `HotelCard`:

1. Existing photo, Deal Score, quality evidence, and warning.
2. Existing Location section.
3. **New `Pet policy for your stay` section.**
4. Existing access/room-request evidence.
5. Existing price scope, rate check, and provider handoff.

The policy section follows Location in DOM order and always appears before the provider handoff. It is not nested inside price or amenity content.

## 2. Stated-Pet Profile

### Entry point

On an eligible mounted hotel-results page, place a section immediately above the result count and cards:

- No saved profile: heading `Travelling with a pet?` and button `Add pet details`.
- Saved profile: heading `Your pet details`, one-line summary such as `1 dog · 20 lb`, and button `Edit pet details`.
- Supporting copy: `We compare your details with policies returned by hotel providers. Always confirm final acceptance and charges before booking.`

This is a stay-fit input, not a filter. It evaluates and annotates every result without removing any result. Do not label it `Pet-friendly`.

### Fields and final labels

Use an inline disclosure panel below the entry point; do not open a modal. Inline placement preserves search context and avoids focus restoration ambiguity.

| Order | Control | Visible label | Options / helper | Required |
|---|---|---|---|---|
| 1 | Radio group | `Type of pet` | `Dog`, `Cat`, `Other animal` | Yes |
| 2 | Text input, conditional on Other | `Animal type` | Helper: `Enter the animal type shown in the hotel's policy, if known.` | Yes when Other |
| 3 | Number input | `Number of pets` | Helper: `Enter the total travelling on this stay.` | Yes; integer 1–9 |
| 4 | Radio group | `Do you know each pet's weight?` | `Yes`, `Not sure` | Yes |
| 5 | Repeated decimal input when Yes | `Pet 1 weight`, `Pet 2 weight`, etc. | Unit selector `lb` / `kg`; helper: `Use the current weight for each pet.` | Yes for each pet when Yes |

Do not request pet name, breed, or service-animal status. A supplier breed restriction remains unresolved unless a later, separately approved flow collects the needed information.

### Actions

- Primary button: `Check hotel policies` on first save; `Update policy matches` when editing.
- Secondary button while editing an existing profile: `Cancel changes`.
- Tertiary text button after save: `Remove pet details`.

`Remove pet details` opens an inline confirmation directly below the button:

- Text: `Remove these pet details? Hotel policy matches will no longer be shown.`
- Actions: `Keep details` and `Remove details`.

On removal, return focus to `Add pet details`, remove fit evaluations, and do not change result inventory or order.

### Validation and final error copy

Validate on submit and on blur after a field has been touched. Keep entered values.

| Condition | Error text |
|---|---|
| No type | `Choose a pet type.` |
| Other selected, blank after trim | `Enter the type of animal travelling.` |
| Count blank / non-integer | `Enter a whole number of pets.` |
| Count outside 1–9 | `Enter between 1 and 9 pets.` |
| Weight required but blank | `Enter this pet's weight, or choose Not sure.` |
| Weight zero / negative | `Enter a weight greater than 0.` |
| Weight above 300 lb / 136 kg | `Check this weight and enter 300 lb / 136 kg or less.` |

Each error is a visible `<p id>` associated through `aria-describedby`; invalid fields use `aria-invalid="true"`. On failed submit, focus the first invalid control and announce once: `Pet details need attention. Review the highlighted fields.`

### Profile states

| State | UI and copy | Interaction |
|---|---|---|
| Default, closed | `Travelling with a pet?` / `Add pet details` | Button expands form and focuses first radio |
| Open, untouched | All fields above; no errors | Tab follows DOM order |
| Saving / evaluating | Button text `Checking hotel policies…`; controls remain visible but disabled | `aria-busy="true"`; one polite status announcement |
| Saved | Summary and `Edit pet details` | Updated card statuses render atomically |
| Save error | `We couldn't apply your pet details. Your hotel results have not changed.` / `Try again` | Keep values; focus error summary |
| Existing profile loading | Heading plus three non-interactive skeleton lines; visually hidden `Loading your pet details…` | Do not render default form briefly |
| No profile | No fit claims on cards; see §6 | Cards may disclose policy availability only in Details |

Profile data is session search context. Do not write free-form animal type or exact weights to analytics.

## 3. Deterministic Fit Presentation Contract

React receives a derived evaluation; it never parses supplier prose or computes fit. The minimum UI contract is:

```ts
type PetFitStatus = 'suitable' | 'unsuitable' | 'unknown'

interface PetFitEvaluation {
  status: PetFitStatus
  reasonCodes: string[]
  explanation: string
  unresolvedDimensions: string[]
  costStatus: 'free' | 'mandatory_known' | 'mandatory_unknown' | 'may_apply' | 'unknown'
  policyEvidenceRef: string
}
```

The normalized evidence referenced by `policyEvidenceRef` must preserve, independently:

- availability: `returned | not_returned | error | conflict`;
- permission: `allowed | prohibited | by_arrangement | unknown`;
- explicitly included and excluded animal types;
- fee status, optional `{ priceCents, currency }`, and basis;
- maximum count and weight/size only when explicitly returned;
- normalized restrictions plus attributed supplier text;
- scope: `property | room | rate | selected_stay | unknown`;
- `sourceLabel`, provider record identifier when available, `fetchedAt`, optional effective date, and schema version;
- every conflicting statement rather than only the last parsed value.

Absent arrays are unknown; they must not be normalized to explicit empty lists. UI copy is assembled from normalized facts. Supplier prose is displayed only as attributed restriction text and never used for component-side derivation.

## 4. Collapsed Scan Status

### Placement and anatomy

Insert a full-width block after the existing image/name/location/price grid and before the Deal Score/action row. It contains:

1. outcome label;
2. at most one supporting line with the most decision-critical fact;
3. no independent CTA—the existing `Details` control reveals evidence.

Outcome labels are exact:

- `Fits your pet`
- `Does not fit your pet`
- `Pet policy needs confirmation`

Never rely on a paw, check, cross, or color. If an icon is later used, it is `aria-hidden="true"`.

### Status copy matrix

| Evidence/evaluation | Outcome | Supporting scan line |
|---|---|---|
| Fully resolved suitable | `Fits your pet` | Most critical known limit and cost, e.g. `Dogs up to 25 lb · $30 per pet, per stay` |
| Explicit prohibition | `Does not fit your pet` | `This provider says pets are not allowed.` |
| Type excluded | `Does not fit your pet` | `Cats are not allowed.` |
| Count exceeded | `Does not fit your pet` | `This policy allows up to 1 pet.` |
| Weight exceeded | `Does not fit your pet` | `This policy allows pets up to 25 lb each.` |
| By arrangement | `Pet policy needs confirmation` | `Property approval is required before booking.` |
| Not returned | `Pet policy needs confirmation` | `This provider did not return a pet policy.` |
| Provider error | `Pet policy needs confirmation` | `Pet policy could not be loaded.` |
| Conflict | `Pet policy needs confirmation` | `Provider policy statements conflict.` |
| Partial / material dimension unknown | `Pet policy needs confirmation` | `Type, limits, or stay eligibility still needs confirmation.` |
| Traveller omitted weight and a limit exists | `Pet policy needs confirmation` | `Add each pet's weight to check the limit.` |
| Malformed fee only, physical fit otherwise passes | `Pet policy needs confirmation` | `A pet charge is listed, but its amount or basis is unclear.` |
| Policy loading | transient; no outcome claim | `Checking this hotel's pet policy…` |
| No stated profile, policy returned | no fit outcome | `Pet policy available in Details.` |
| No profile, policy absent | no collapsed pet line | Disclosure remains in Details if that surface is policy-enabled |

Supporting text may wrap to two lines. Never line-clamp or truncate a negation, `may apply`, currency, fee basis, or blocking limit. If available width cannot preserve the fact, show only the outcome in scan view and retain the fact in Details.

### Tone classes

- Suitable: `border-[color:var(--border-strong)] bg-[color:var(--success-soft)] text-[color:var(--success)]`.
- Unsuitable: `border-[color:var(--border-strong)] bg-[color:var(--error-soft)] text-[color:var(--text-1)]`; supporting reason uses `text-[color:var(--error)]`.
- Unknown/conditional/conflict: `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]`.
- Loading/no-profile availability: `border-[color:var(--border)] bg-[color:var(--bg-muted)] text-[color:var(--text-2)]`.

Container pattern:

`mt-3 rounded-[var(--radius-control)] border px-3 py-2 text-xs leading-5`

Outcome: `font-bold`; support: `mt-0.5 font-medium`. Do not use green wording such as `Approved` and do not label unknown as a match.

## 5. Expanded `Pet policy for your stay` Section

### Container and semantic structure

```text
section[aria-labelledby="hotel-pet-policy-title-{hotelId}"]
  h4 "Pet policy for your stay"
  outcome summary
  dl policy facts
  unresolved-items advisory, when needed
  provenance and freshness
  confirmation instruction/action
```

Container:

`rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)]`

Title: `font-bold text-[color:var(--text-1)]`. Outcome advisory: `mt-2 rounded-[var(--radius-control)] px-3 py-2`; use the tone mappings in §4.

Facts use a semantic `<dl>`:

`mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6`

Each `dt`: `font-bold text-[color:var(--text-1)]`; each `dd`: `mt-0.5 break-words font-medium text-[color:var(--text-2)]`.

### Fact order and exact labels

1. `Policy outcome`
2. `Animal types`
3. `Pet charge`
4. `Number of pets`
5. `Weight or size limit`
6. `Other restrictions`
7. `Applies to`
8. `Policy source`
9. `Policy checked`

Visible value rules:

- Explicit types: `Dogs and cats allowed.` / `Dogs allowed; cats not allowed.`
- Missing type evidence: `Allowed animal types were not specified.`
- Free: `No pet charge stated by {sourceLabel}.`
- Known mandatory fee: `{formatted money} per pet, per stay.` Use integer-minor-unit formatter.
- Fee may apply: `A pet charge may apply; amount and basis were not provided.`
- Mandatory fee with missing amount: `A mandatory pet charge applies; amount was not provided.`
- Unknown fee: `Pet charge was not specified.`
- Explicit max count: `Up to {count} pet(s).`
- Missing count: `Pet count limit was not specified.`
- Explicit weight: `Up to {weight} {unit} per pet.`
- Missing limit: `Weight or size limit was not specified.`
- No returned restrictions: `No additional restrictions were returned.` only when the supplier explicitly returned a complete empty restriction set. Otherwise: `Additional restrictions were not specified.`
- Property scope: `Property-level policy; selected room and rate still need confirmation.`
- Selected-stay scope: `This selected stay.`
- Unknown scope: `Policy scope was not specified.`
- Source: `{sourceLabel}`. Never replace with `Hotel provider` when a confirmed claim is shown; missing provenance forces unknown.
- Checked date: `Checked {localized date}.` If missing: `Policy freshness was not provided.`

Do not calculate a stay-total pet fee unless amount, currency, basis, count application, and selected-stay applicability are all explicit and a separately approved total-price change exists. For this ticket, even fully known pet charges remain a policy fact separate from price.

### Restrictions

Show up to two normalized restrictions as separate list items. If more exist, show all in the expanded section; do not collapse material restrictions behind a second control. Preserve supplier wording when a restriction cannot be safely normalized:

`Provider statement: “{supplier text}”`

The source and scope displayed below attribute the statement. Do not visually quote more supplier text than needed to explain the restriction.

## 6. Detailed State Copy

### Confirmed fit

- Heading/outcome: `Fits your pet`
- Explanation: `The policy returned by {sourceLabel} fits your stated {pet summary} for this stay.`
- Confirmation footer: `Final pet acceptance and charges are confirmed by the provider or property before booking.`

Use only when every material dimension passes, selected-stay scope and provenance exist, and no conflict remains.

### Confirmed non-fit

- Heading/outcome: `Does not fit your pet`
- Explanation by first blocking fact:
  - `The provider says this property does not allow pets.`
  - `The policy allows dogs, not your stated cat.`
  - `The policy allows up to 1 pet; your profile includes 2.`
  - `The policy limit is 25 lb per pet; one or more stated pets exceed it.`
- Footer: `Choose another hotel or confirm directly if the provider's policy has changed.`

If multiple blocking facts exist, show the most decisive reason in the outcome and all known facts in the list.

### Partial or unresolved policy

- Outcome: `Pet policy needs confirmation`
- Explanation: `The provider returned a pet policy, but it does not resolve every detail for your pet and stay.`
- Advisory heading: `Confirm before booking`
- Advisory body: `Confirm {comma-separated unresolved dimensions} with the provider or property.`

Use human labels: `allowed animal type`, `pet count limit`, `weight or size limit`, `additional restrictions`, `pet charge`, `selected room and rate`.

### Four named unknown states

| Evidence state | Required heading | Final body | Action label |
|---|---|---|---|
| `not_returned` | `Pet policy not returned` | `This provider did not return a pet policy for this hotel. Pet acceptance, charges, and restrictions are unknown.` | `Confirm pet policy with provider` |
| `by_arrangement` | `Property approval required` | `This property accepts pets only by arrangement. Ask the provider or property to approve your pet and confirm charges before booking.` | `Confirm pet policy with provider` |
| `error` | `Pet policy could not be loaded` | `We couldn't check this hotel's pet policy. Hotel availability is unchanged, but pet acceptance, charges, and restrictions need confirmation.` | `Try policy again` when a safe retry exists; otherwise `Confirm pet policy with provider` |
| `conflict` | `Pet policy information conflicts` | `The available policy statements disagree. We can't confirm that this hotel fits your pet until the provider or property resolves them.` | `Confirm pet policy with provider` |

Assistive labels append hotel context, for example: `Pet policy not returned for Hotel Luna. Confirm acceptance, charges, and restrictions with the provider before booking.`

### Malformed evidence

Do not expose parsing language. Quarantine the malformed dimension as unresolved:

- Malformed fee: `A pet charge is listed, but its amount or basis could not be confirmed.`
- Malformed limit: `A pet limit is listed, but the value could not be confirmed.`
- Missing/invalid provenance: render the overall result as unknown and use `Policy source could not be confirmed.`

### Policy loading

The card remains usable. In the scan position show a static-height skeleton and visually hidden polite status `Checking this hotel's pet policy…`. In expanded Details show the titled section immediately with `Checking pet policy…`; do not skeleton the whole card or disable `Review hotel`. On completion, replace the section in place without moving focus.

### Stale and cache states

- A valid cache hit displays exactly the same semantic state as a fresh response and retains original `fetchedAt` plus schema version.
- Do not label a cache hit as fresh merely because it was replayed now.
- If evidence exceeds its policy freshness threshold, evaluation becomes unknown. Show heading `Pet policy needs confirmation` and body `This pet policy was checked {date} and may have changed. Confirm the current policy before booking.`
- A schema-version mismatch or cache object that loses required provenance normalizes to `not_returned` or `error`, never suitable.
- While stale evidence is revalidating, retain the unknown disclosure; do not momentarily show a prior positive fit.

### Empty hotel results and hotel-provider error

Pet policy is subordinate to inventory:

- Zero hotels: preserve the owning results surface's normal empty state; do not say no hotels fit the pet.
- Hotel provider unavailable: preserve its provider error; do not replace it with policy copy.
- Hotels available but every policy unknown: results remain visible. Above results show `Pet policy details are unavailable for these hotels. Review each hotel and confirm directly before booking.` No zero-result illustration.

## 7. Confirmation And Provider Handoff

The existing `Review hotel` action remains primary. Expanded policy adds a text link only when a policy requires confirmation and a safe, affiliate-marked provider destination exists:

- Visible label: `Confirm pet policy with provider`
- Accessible name: `Confirm pet policy for {hotel name} with {provider name}`
- Supporting text: `The provider or property confirms final pet acceptance and charges.`

If no dedicated policy destination exists, do not fabricate one or link to a generic support page. Keep the instruction as text and use the existing `Review hotel` handoff. All outbound links retain affiliate markers.

The review/handoff context must eventually preserve the stated profile summary, fit status, unresolved dimensions, source, scope, and freshness without placing raw supplier prose or sensitive free text in URL query parameters. This continuity is DEV/integration scope and is required before claiming end-to-end completion.

## 8. Responsive Composition

### 375px mobile

- Keep the current `grid-cols-[4.5rem_minmax(0,1fr)_minmax(6.75rem,auto)]` image/name/price row unchanged.
- Pet scan block is a separate full-width sibling below that grid: `mt-3 w-full min-w-0`.
- Outcome and support stack vertically. Allow at least two support lines and natural expansion; no `truncate`, `line-clamp`, fixed height, or horizontal scroll.
- Keep a negation, fee amount + currency, `may apply`, and fee basis as intact phrases. If necessary, omit the supporting fact from scan view rather than clip it.
- Profile fields are one column. Weight value and unit may use `grid-cols-[minmax(0,1fr)_5rem] gap-2`; repeated pet weights stack.
- Expanded policy `<dl>` is one column. Confirmation action is `w-full min-h-11` and cannot sit beside long copy.
- Card padding remains `p-3`; expanded padding remains `px-3 pb-3 pt-3`.

### 1280px desktop

- Preserve the same information and DOM order as mobile.
- Pet scan may use `grid grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-3`, but the outcome never becomes an icon-only badge.
- Profile panel may use `sm:grid-cols-2` for type/count and weight controls while labels remain above controls. Actions align at the end but retain 44px targets.
- Expanded facts use two equal columns; `Policy outcome`, `Other restrictions`, unresolved advisory, provenance, and confirmation span both columns.
- Do not create a decorative pet card beside price or Deal Score.

### Stress conditions

Verify at 320px, 375px, and 1280px; at 200% zoom; with browser text enlargement; with a 40-character hotel name; two pets and two restrictions; `A pet charge may apply`; `CAD 125 per pet, per stay`; the four long unknown headings; and 30% translated-text expansion. No overlap, clipped action, or horizontal page scroll is permitted.

## 9. Accessibility And Interaction Rules

### Keyboard and focus order

Eligible results-page order:

1. `Add/Edit pet details`
2. type radios
3. conditional other-animal input
4. count
5. weight-known radios
6. repeated weight inputs and unit selectors
7. primary save action
8. cancel/remove actions
9. result-card links and controls in DOM order
10. each card's `Review hotel`
11. each card's `Details`
12. expanded confirmation link, when present

Opening profile details moves focus to the `Type of pet` group. `Cancel changes` and successful save return focus to `Add/Edit pet details`; the result summary is then announced. The existing Details button retains `aria-expanded` and `aria-controls`. Expanding Details leaves focus on the toggle. Do not autofocus the new panel.

### Live announcements

Use one results-level `role="status" aria-live="polite" aria-atomic="true"` for profile/evaluation changes. Do not add a live region to every card.

- After save: `Pet details updated. {fit count} hotels fit, {unknown count} need confirmation, and {non-fit count} do not fit.`
- While evaluating: `Checking pet policies for {result count} hotels.`
- On retry completion: `Pet policy updated for {hotel name}: {outcome}.`
- On removal: `Pet details removed. Hotel policy matches are no longer shown.`

Do not announce the initial card status on page load. Batch async card updates into one summary to avoid repeated speech. Never announce stale counts after a newer profile submission; evaluation requests require a request identifier or cancellation.

### Names, targets, and semantics

- All interactive controls have a minimum 44px target where new; preserve the existing Details control's minimum 40px until a broader card-target repair is authorized.
- Use native radio, input, select, button, link, heading, list, and definition-list elements.
- All controls use persistent visible labels. Pet type cannot be conveyed by an icon.
- Global `:focus-visible` provides a 3px `--primary` outline and `--focus-ring`; do not suppress it.
- Status text is understandable without color. Suitable/unsuitable are not exposed through `aria-label` alone.
- The policy region is named by its visible heading. Source and updated date remain real text, not tooltip-only content.

## 10. Tailwind Patterns

Use existing tokens only; add no colors, font sizes, shadows, or radii.

Profile container:

`rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3 sm:p-5`

Profile field label:

`block text-sm font-bold text-[color:var(--text-1)]`

Input/select:

`field-input mt-1` with error addition `border-[color:var(--error)]`

Radio option:

`flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm font-medium text-[color:var(--text-1)]`

Helper/error:

- helper: `mt-1 text-xs leading-5 text-[color:var(--text-3)]`
- error: `mt-1 text-xs font-medium leading-5 text-[color:var(--error)]`

Unknown advisory:

`mt-3 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2 font-medium text-[color:var(--warning)]`

Non-fit advisory:

`mt-3 rounded-[var(--radius-control)] bg-[color:var(--error-soft)] px-3 py-2 font-medium text-[color:var(--text-1)]`

Confirmation link:

`mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] px-3 text-sm font-bold text-[color:var(--text-1)] sm:w-auto`

Loading skeletons use existing `.skeleton`; honor `prefers-reduced-motion` through the app's established motion treatment. Text status remains present for assistive technology.

## 11. Copy Guardrails

Never display any of the following unless explicitly proven at the stated scope:

- `Pet-friendly`
- `All pets allowed`
- `No pets allowed` from a missing token or absent list
- `No restrictions`
- `Free`
- `No weight limit`
- `No pet limit`
- `Fits your pet` from generic `pets`, `Pets Allowed`, property-only evidence, by-arrangement wording, missing types/limits, absent provenance, stale evidence, or a conflict

Use `provider` for the booking/data partner and `property` for the hotel. Do not imply expaify or the provider has approved an animal. General pet policy does not establish service-animal eligibility or legal obligations.

## 12. Future Coverage-Gated Filter

### Launch gate

The filter remains absent until production-like samples across at least 10 destinations and representative stays meet all research gates:

- permission coverage at least 80%;
- at least 90% of `Fits your pet` offers resolve type, count, weight/size, material restrictions, scope, and provenance;
- every unknown/conflict remains accessible;
- zero prohibited offers in `Fits your pet` contract tests;
- unresolved cross-source conflicts below 1%, with all remaining conflicts unknown.

If any gate fails, do not expose the filter. A confidence-based grouping may be separately approved, but it must not exclude inventory.

### Eligible future control

Only after all gates pass, add a results control labelled `Show hotels by pet-policy fit`. Options:

- `All hotels` (default)
- `Fits your pet`
- `Needs confirmation`
- `Does not fit your pet`

Applying `Fits your pet` creates result groups rather than a destructive boolean filter:

1. `Fits your pet ({count})`
2. `Needs confirmation ({count})`

The second group remains rendered and reachable. Confirmed non-fits may be collapsed under `Does not fit ({count})` only after an explicit traveller choice; they never silently disappear due to unknown evidence. When no confirmed fits exist, show:

`No confirmed matches yet. {unknown count} hotels still need pet-policy confirmation.`

Actions: `Show hotels needing confirmation` and `Clear pet-policy view`. Never say `No pet-friendly hotels`.

Changing or removing the profile clears the applied policy view and announces the change. Filter controls have persistent labels, native radio semantics, a count summary, and the live-region behavior in §9.

## 13. State And Edge-Case Acceptance Matrix

| Case | Expected result |
|---|---|
| Default profile | Closed entry point with no fit claims |
| No profile + returned policy | `Pet policy available in Details`; no suitability claim |
| Existing profile loading | Stable skeleton; no default-profile flash |
| Profile validation errors | Inline associated copy; focus first invalid field |
| Profile save error | Values retained; results unchanged |
| Policy loading | Card and Review action usable; no premature outcome |
| Explicit selected-stay fit | `Fits your pet`; fee remains separate |
| Explicit prohibition/type/count/weight failure | `Does not fit your pet` with blocking reason |
| By arrangement | `Property approval required`; unknown |
| Not returned | `Pet policy not returned`; unknown |
| Partial policy | Known facts plus named unresolved dimensions; unknown |
| Provider error | `Pet policy could not be loaded`; inventory unchanged |
| Malformed fee/limit | Dimension unresolved; never zero/unlimited |
| Conflict | Both statements preserved in data; conflict heading; unknown unless every interpretation is non-fit |
| Valid cache replay | Same semantics and original freshness as fresh result |
| Stale policy | Unknown with checked date and confirmation instruction |
| Zero current coverage | No production profile or filter; no fit/non-fit claims |
| No hotel inventory | Existing inventory empty state; never pet-specific zero result |
| 375px / 200% zoom | Natural height, one-column details, no clipping/scroll |
| 1280px | Same order; two-column facts only |
| Keyboard / screen reader | Profile, summary, Details, evidence, confirmation, and Review reachable with one batched announcement |

## 14. UI, DEV, TEST, And Integration Handoff

### UI scope

- Add presentational profile, scan, and policy-detail components and every state above without changing provider/business logic.
- Preserve `HotelCard` props/exports and existing card contracts; optional props may be additive.
- Add component tests for visible copy, semantic status, Details order, accessible labels, and prohibited/unknown never rendering positive.
- Do not mount the profile or filter on a production page until an owner and release gate are approved.

### DEV required before live policy evaluation

- Add provider-neutral policy evidence and derived evaluation types in `lib/types.ts`.
- Map verified supplier payloads through `lib/providers`; never call vendors from React.
- Preserve policy and provenance through six-hour cache serialization, normalization, schema versioning, replay, and stale handling.
- Implement a pure deterministic evaluator outside React with `Result<T>` boundaries and integer-minor-unit fee money.
- Keep hotel inventory status separate from pet-policy status in search responses.
- Preserve safe policy/profile context through review/handoff without raw supplier prose in query strings.
- Add contract tests for fresh/cache parity, absence versus explicit empty, malformed money, every evaluation example, conflict precedence, and affiliate-marked confirmation links.
- Add analytics only after a mounted surface and production transport exist; never send names, free-form animal type/restriction text, breed, or exact weight.

### Blocking integration dependency

`HotelCard` has no production page consumer in this branch. Before end-to-end TEST can pass, the product owner must identify the mounted hotel-results surface and authorize integration. UI component tests alone are not evidence that travellers can use the flow.

## 15. Definition Of Done For This Design

The design is ready for UI implementation when:

- every default, loading, empty, error, mobile, desktop, focus/keyboard, cache/stale, malformed, and conflict state has final copy and behavior;
- the three semantic outcomes and four named unknown headings are preserved exactly;
- supplier provenance, scope, freshness, fees, limits, restrictions, and unresolved items appear before handoff;
- current 0% coverage cannot expose a profile, enabled/disabled pet filter, suitable claim, or unsuitable claim in production;
- the future filter preserves every unknown/conflicting hotel behind the measured gates;
- accessibility behavior is testable without relying on icon or color;
- UI/DEV scope and the unmounted-surface blocker are explicit.
