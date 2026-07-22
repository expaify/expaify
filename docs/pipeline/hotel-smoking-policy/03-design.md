# UXDES-HOTEL-SMOKING-POLICY-01: Hotel Smoking-Policy Fit Design

Date: 2026-07-22  
Stage: UX Design  
Priority: P0  
Inputs: `01-discovery.md`, `02-research.md`

## Decision

Ship an honest, two-dimension smoking-policy evidence section in hotel details and hotel review, preserving what the supplier did and did not confirm from result card through provider handoff. Do **not** ship an enabled smoking-policy filter with Hotellook: current normalized room-policy and property/common-area coverage are both 0%.

Confirmed and filter states below are implementation-ready future states, but they must remain fixture/test-only until normalized provider evidence meets the evidence gate in this spec. The current production state is `not_provided` unless the independent policy check fails (`unavailable`) or is still in progress (`loading`).

This feature reports supplier policy assertions. It does not verify enforcement, guest behavior, smoke exposure, air quality, cleaning, ventilation, or selected-room availability unless a dated room/rate record explicitly supports that claim.

## User Outcome

A first-time traveller can separately answer:

1. What does the supplier say about the selected room or the property's room inventory?
2. What does the supplier say about the entire property and common areas?
3. Is each answer confirmed, unclear, conflicting, missing, temporarily unavailable, or still loading?
4. What must be checked again on the booking partner before payment?

## Scope

### In scope

- A dedicated `Smoking policy` section in expanded `HotelCard` details.
- A safe, optional collapsed-card summary for threshold-qualified confirmed evidence only.
- The same evidence snapshot in `/book` hotel review.
- Continuity copy immediately before provider handoff and after return.
- Independent loading, refreshing, empty, error, stale, keyboard, and assistive-technology states.
- A future confirmed-only filter specification with evidence gates.
- Exact analytics boundaries and downstream UI/DEV requirements.

### Out of scope

- Adding, scraping, or selecting a new hotel provider.
- Parsing vendor strings in React.
- Inferring a policy from hotel names, generic amenities, photos, reviews, local law, or provider deeplink text.
- Claiming present smoke conditions, enforcement, compliance, health safety, cleaning, ventilation, or legal guarantees.
- Room selection inside expaify.
- Changing hotel ranking, Deal Score, quality, price, or access evidence.
- Treating a provider return as a policy failure without an explicit traveller reason.

## Information Architecture

### Collapsed result card

1. Primary: hotel name, nightly price, `Review hotel`.
2. Secondary: quality, location, Deal Score.
3. Tertiary: at most one threshold-qualified policy line, then `Details`.

Do not show a policy chip for `ambiguous`, `conflicting`, `not_provided`, `unavailable`, loading, refreshing, or stale evidence. These require context and belong in expanded details. The card must remain scannable when current coverage is 0%.

### Expanded details

Preserve the existing panel order through Location, then insert `Smoking policy` immediately before `Access & room requests`:

1. Room policy.
2. Property & common areas.
3. Shared evidence boundary and source metadata.

This section is independent from Deal Score, quality, location, access, price, and generic amenities.

### Hotel review

1. Hotel identity, location, and selected nightly rate.
2. Rate expectation and existing offer facts.
3. `Smoking policy` with the exact snapshot carried from the selected result.
4. `Before you continue` policy comparison instruction.
5. Provider CTA.
6. On an explicit return, optional mismatch-reason action below the retained policy section.

## Provider-Neutral Evidence Contract

UI must consume normalized policy data only. This contract is a DEV requirement, not a component-local type.

```ts
type HotelSmokingEvidenceState =
  | 'confirmed'
  | 'ambiguous'
  | 'conflicting'
  | 'not_provided'
  | 'unavailable'

type HotelSmokingPolicyLoadState = 'loading' | 'ready' | 'refreshing' | 'error'

type RoomSmokingPolicyValue =
  | 'all_rooms_non_smoking'
  | 'smoking_rooms_offered'
  | 'selected_room_non_smoking'
  | 'selected_room_smoking'

type PropertySmokingPolicyValue =
  | 'smoke_free_property'
  | 'indoor_common_areas_smoke_free'
  | 'designated_smoking_areas'
  | 'smoking_permitted_in_stated_areas'

type HotelSmokingScope =
  | 'property_room_inventory'
  | 'property_room_capability'
  | 'selected_room_rate'
  | 'entire_property'
  | 'indoor_common_areas'
  | 'designated_areas'
  | 'stated_areas'
  | 'unclear'

type SupplierSmokingStatement = {
  id: string
  value?: RoomSmokingPolicyValue | PropertySmokingPolicyValue
  scope: HotelSmokingScope
  sourceLabel: string
  sourceText: string
  fetchedAt: string
  checkin?: string
  checkout?: string
  roomId?: string
  rateId?: string
}

type HotelSmokingDimension<T> = {
  state: HotelSmokingEvidenceState
  value?: T
  scope?: HotelSmokingScope
  statements: SupplierSmokingStatement[]
}

type HotelSmokingPolicy = {
  loadState: HotelSmokingPolicyLoadState
  room: HotelSmokingDimension<RoomSmokingPolicyValue>
  property: HotelSmokingDimension<PropertySmokingPolicyValue>
}
```

Contract rules:

- `confirmed` requires one normalized value, an exact valid scope, non-empty supplier attribution, source text, and valid `fetchedAt`.
- `selected_room_non_smoking` and `selected_room_smoking` additionally require check-in, checkout, `roomId`, and `rateId` bound to the selected stay.
- `ambiguous` requires at least one source statement and renders `sourceText` verbatim.
- `conflicting` requires two or more retained statements. Normalization must not choose a winner.
- `not_provided` has no usable statements and means the provider check completed successfully.
- `unavailable` means the check failed; it is never a negative policy claim.
- `loadState: 'error'` resolves both unchecked dimensions to `unavailable`; already valid prior evidence may remain visible only under `refreshing`, not under an initial error.
- Source text must be plain text, length-bounded, and safely rendered. Safe display normalization may normalize line endings to `\n` and remove control characters; it must not change words, punctuation, capitalization, or order.
- Expired evidence is not `confirmed` in the current snapshot. Preserve it as a visibly stale prior statement outside match/filter logic until refreshed.

## Hierarchy Within `Smoking policy`

Use one section heading and two semantic sub-sections in this fixed DOM order:

1. `Room policy`
2. `Property & common areas`
3. Shared boundary: `Supplier policy; expaify has not verified enforcement or smoke conditions.`

At 1280px the dimensions may be visual columns, but DOM and screen-reader order do not change. At 375px they form one vertical column.

Each dimension contains, in order:

1. Dimension heading.
2. State label in text.
3. Normalized claim or safe state explanation.
4. Verbatim source text when required.
5. Scope/date/room binding when applicable.
6. `Source: {sourceLabel}. Observed {date}.`

## Exact UI Copy

### Section and boundary copy

- Section heading: `Smoking policy`
- Room heading: `Room policy`
- Property heading: `Property & common areas`
- Evidence boundary: `Supplier policy; expaify has not verified enforcement or smoke conditions.`
- Partner instruction: `The booking partner confirms the room's smoking status and the property's current smoking rules. Compare both before you book.`
- Observation metadata: `Source: {sourceLabel}. Observed {Month D, YYYY}.`
- Missing observation time fallback: `Observation time unavailable. This evidence cannot be treated as confirmed.`
- Stale label: `Previous supplier policy — refresh required`
- Stale explanation: `This supplier statement is out of date and is not treated as a current confirmation.`

Use the supplier's display name for `{sourceLabel}`. Never display a bare vendor code when a known display label exists.

### Room-policy confirmed values

| Normalized value | Visible claim | Scope/support copy | Safe collapsed line | Screen-reader sentence |
| --- | --- | --- | --- | --- |
| `all_rooms_non_smoking` | `All rooms non-smoking` | `The supplier states that all guest rooms at this property are non-smoking.` | `All rooms non-smoking` | `Room policy. Confirmed supplier statement. All guest rooms at this property are non-smoking.` |
| `smoking_rooms_offered` | `Property offers smoking rooms` | `Supplier says this property offers smoking rooms. Availability for your dates is not confirmed.` | `Smoking rooms offered; dates not confirmed` | `Room policy. Confirmed property capability. The supplier says this property offers smoking rooms, but availability for your dates is not confirmed.` |
| `selected_room_non_smoking` | `Selected room: Non-smoking` | `Confirmed for {checkin} to {checkout} and this selected room and rate.` | `Selected room: Non-smoking` | `Room policy. Confirmed for the selected room and rate from {checkin} to {checkout}. Non-smoking.` |
| `selected_room_smoking` | `Selected room: Smoking permitted` | `Confirmed for {checkin} to {checkout} and this selected room and rate.` | `Selected room: Smoking permitted` | `Room policy. Confirmed for the selected room and rate from {checkin} to {checkout}. Smoking permitted.` |

Collapsed priority is selected room/rate first, then `all_rooms_non_smoking`, then `smoking_rooms_offered`. Never show more than one line.

### Property/common-area confirmed values

| Normalized value | Visible claim | Scope/support copy | Safe collapsed line | Screen-reader sentence |
| --- | --- | --- | --- | --- |
| `smoke_free_property` | `Smoke-free property` | `The supplier applies this rule to the entire property.` | `Smoke-free property` | `Property and common areas. Confirmed supplier statement. The supplier applies a smoke-free rule to the entire property.` |
| `indoor_common_areas_smoke_free` | `Indoor common areas are smoke-free` | `This statement applies to indoor shared areas, not necessarily guest rooms or outdoor areas.` | `Indoor common areas smoke-free` | `Property and common areas. Confirmed supplier statement. Indoor shared areas are smoke-free; guest rooms and outdoor areas are not established by this statement.` |
| `designated_smoking_areas` | `Designated smoking areas` | `The supplier restricts smoking to designated areas. Review the supplier wording for location details.` | `Designated smoking areas` | `Property and common areas. Confirmed supplier statement. Smoking is restricted to designated areas.` |
| `smoking_permitted_in_stated_areas` | `Smoking permitted in stated areas` | `The supplier permits smoking only in the areas named below.` | `Smoking permitted in stated areas` | `Property and common areas. Confirmed supplier statement. Smoking is permitted in the supplier-stated areas shown in details.` |

If room and property evidence are both confirmed, the one collapsed line uses this priority: selected room/rate, entire-property rule, all-room rule, indoor-common-area rule, designated/stated areas, property room capability. Expanded details always show both dimensions.

### Non-confirmed states, independently per dimension

| State | State label | Exact visible copy | Additional content | Screen-reader sentence |
| --- | --- | --- | --- | --- |
| `ambiguous` | `Scope unclear` | `Policy wording provided; scope unclear.` | Label `Supplier wording` followed by the verbatim source text and source metadata. | `{Dimension}. Scope unclear. Policy wording was provided, but its meaning or scope cannot be safely confirmed. Supplier wording: {sourceText}.` |
| `conflicting` | `Conflicting details` | `Supplier policy details conflict. Confirm before booking.` | Render every current statement under `Supplier statements`, each with scope, source, and observed time. | `{Dimension}. Conflicting details. {count} current supplier statements conflict. Confirm before booking.` |
| `not_provided` | `Not provided` | `Smoking policy not provided by this supplier.` | No warning styling and no source quote. | `{Dimension}. Smoking policy not provided by this supplier.` |
| `unavailable` | `Could not check` | `Smoking policy could not be checked.` | Follow with `Confirm this with the booking partner before you book.` | `{Dimension}. Smoking policy could not be checked. Confirm with the booking partner before booking.` |

Never substitute `Unknown`, `No smoking`, `Smoking unavailable`, `Policy unavailable`, or `No policy` for these states. Those phrases can be misread as substantive policy facts.

### Loading and refreshing

- Initial section status: `Checking supplier smoking policy…`
- Initial assistive announcement: `Checking supplier smoking policy.`
- Refreshing label: `Refreshing supplier policy…`
- Refreshing support: `Showing the previous supplier statement while we check for an update.`
- Refresh failure with prior evidence: `Policy refresh failed. The previous supplier statement is shown and is not treated as current confirmation.`

Initial loading shows no claim, match, chip, source, or stale text. Refreshing retains prior evidence visually, marks it stale, and removes it from filter counts until refresh succeeds.

## State Matrix

The two dimensions resolve independently. These are required fixtures and acceptance states.

| Room | Property/common areas | Result meaning |
| --- | --- | --- |
| `not_provided` | `not_provided` | Current Hotellook default. Show both explicit missing states in details and review; no collapsed line. |
| selected room non-smoking | designated smoking areas | State both facts. Never summarize as a smoke-free property. |
| selected room smoking | indoor common areas smoke-free | State both scopes without treating them as contradictory. |
| all rooms non-smoking | designated smoking areas | State both; designated area does not negate an all-guest-room rule. |
| smoking rooms offered | `not_provided` | Say availability for dates is not confirmed; property/common-area policy remains missing. |
| smoking rooms offered | smoke-free property | Mark the room dimension `conflicting` unless supplier semantics authoritatively distinguish time/scope; never choose a winner. |
| `ambiguous` | confirmed | Quote room wording; preserve confirmed property claim separately. |
| `conflicting` | `conflicting` | Render all records in each dimension; never merge the conflict lists. |
| `unavailable` | `not_provided` | Explain check failure separately from a successful check with no evidence. |
| loading | ready | Keep the ready dimension visible only when per-dimension lifecycle exists; announce only the loading dimension. |
| stale prior evidence | any | Mark prior evidence stale and exclude it from a current confirmed summary/filter. |

### Default/current provider

`loadState = ready`; both dimensions are `not_provided`. The expanded card and hotel review show:

- `Room policy — Not provided`
- `Smoking policy not provided by this supplier.`
- `Property & common areas — Not provided`
- `Smoking policy not provided by this supplier.`
- Evidence boundary copy.

The collapsed card shows no smoking-policy line. Search/filter controls show no enabled smoking option.

### Inventory loading

If no hotel cards exist yet, do not render standalone policy panels. Policy lifecycle begins only for an identified offer. Existing hotel inventory skeletons remain unchanged.

### Policy loading on a usable hotel card

Expanded details render a stable panel with heading and one status line. The price, Deal Score, `Review hotel`, `Details`, and access evidence remain usable. Do not skeletonize or disable the full card.

### Policy error

The card remains bookable when price and deeplink are valid. Expanded details and review show both dimensions as `unavailable` if neither was resolved. Do not show retry in each card; if the search surface owns an approved policy refresh action, one `Try policy check again` button may retry only the policy request and retain all hotel results.

On retry:

- button becomes disabled with label `Checking policy…`;
- focus remains on the button;
- completion is announced in the nearest polite live region;
- success replaces the panel content without moving focus;
- failure announces `Smoking policy still could not be checked.`

### Empty hotel results

Do not render policy sections, controls, or policy-specific empty copy when there are no hotel offers before filtering. Preserve the owning search surface's hotel-inventory empty state.

Future filtered zero matches use exactly:

- Heading: `No provider-confirmed matches in these results`
- Body: `The hidden hotels do not have confirmed evidence for this policy option. Their policies may be unreported.`
- Action: `Show all hotels`

The action clears only the smoking-policy filter and restores the pre-filter result order.

## Component Specification

### Collapsed `HotelCard`

Render the optional policy line after Location and before the Deal Score/action row. It is plain compact metadata, not a green success badge and not part of Deal Score.

```tsx
<p className="mt-1.5 line-clamp-2 text-xs font-bold leading-5 text-[color:var(--text-2)]">
  {collapsedPolicyLabel}
</p>
```

Rules:

- Render only for current, threshold-qualified `confirmed` evidence.
- Include scope in the visible phrase; never render just `Non-smoking` or `Smoking`.
- Maximum two lines; do not truncate the semantic scope at 375px.
- The accessible name uses the screen-reader sentence from the copy table plus `Open Details for full supplier evidence.`
- Clicking the line does nothing. `Details` remains the single disclosure control.

### Expanded `SmokingPolicyPanel`

Recommended component boundary:

```tsx
<SmokingPolicyPanel
  offerId={hotel.id}
  policy={hotel.smokingPolicy}
  surface="result_detail"
/>
```

Panel shell:

```tsx
<section
  aria-labelledby={titleId}
  className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)] sm:px-4 sm:py-4"
>
```

Heading:

```tsx
<h4 id={titleId} className="font-bold text-[color:var(--text-1)]">Smoking policy</h4>
```

Dimension container:

```tsx
<div className="mt-3 grid gap-3 lg:grid-cols-2">
```

Dimension card:

```tsx
<section className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3 py-3">
```

Typography:

- Dimension heading: `text-sm font-bold leading-5 text-[color:var(--text-1)]`.
- State label: `mt-1 text-xs font-bold leading-5` plus tone below.
- Claim/explanation: `mt-1 font-medium text-[color:var(--text-2)]`.
- Metadata: `mt-2 break-words text-[color:var(--text-3)]`.
- Verbatim text: `<blockquote>` with `whitespace-pre-wrap break-words border-l-2 border-[color:var(--border-strong)] pl-3 text-[color:var(--text-2)]`.

State tone:

- `confirmed`: `text-[color:var(--brand)]`; no filled green panel.
- `ambiguous`, `conflicting`, stale: `text-[color:var(--warning)]`; optional `bg-[color:var(--warning-soft)]` only behind the state explanation.
- `not_provided`: `text-[color:var(--text-3)]`.
- `unavailable`/error: `text-[color:var(--error)]`; optional `bg-[color:var(--error-soft)]` only behind the error explanation.
- Loading/refreshing: `text-[color:var(--text-3)]` with `.skeleton` bars marked `aria-hidden="true"` only if a stable textual status is also present.

The shared evidence boundary follows both dimensions in `mt-3 border-t border-[color:var(--border)] pt-3 font-medium text-[color:var(--text-3)]`.

### Conflict disclosure

All conflicting statements are visible by default; do not hide the second record in an accordion. Use a semantic list:

```tsx
<ol className="mt-2 space-y-2" aria-label="Conflicting supplier statements">
```

Each item contains source text in `<blockquote>`, a normalized scope label if known, and source/observed metadata. Preserve provider order or deterministic fetched-time order; never imply precedence with numbering, color, or placement.

### `/book` hotel review

Reuse the same presentational policy component with `surface="review"`; do not recreate copy from query strings in `BookingFlow`. Place it after the current offer-reference block and before the provider-handoff guidance/CTA.

Review requirements:

- Render both dimensions even when both are `not_provided` or `unavailable`.
- Preserve state, normalized value, scope, every conflict statement, exact source text, source label, and observed time.
- Preserve selected check-in/out and room/rate binding when present.
- Do not fetch or reinterpret provider policy in the browser.
- If policy context fails validation, reject only the policy snapshot and render both dimensions as `unavailable`; do not invalidate an otherwise safe hotel handoff.
- Immediately before the CTA show the exact partner instruction in a neutral raised panel.
- The provider CTA's accessible description appends: `Confirm the room's smoking status and the property's current smoking rules on the booking partner.`

### Provider return reason

After a user explicitly continues and returns to the visible expaify tab, retain the review and policy snapshot. Show a non-modal, optional prompt below `Smoking policy`:

- Heading: `Did the partner details match?`
- Body: `Optional: tell us what changed so we can improve hotel evidence.`
- Action: `Report a mismatch`

Activating opens an inline `<fieldset>` with legend `What did not match?` and single-select radios:

- `Smoking policy or room did not match`
- `Price or fees did not match`
- `Room availability did not match`
- `Other hotel details did not match`
- `Prefer not to say`

Buttons: `Send feedback` and `Cancel`. Submission is optional, never preselected, never blocks returning to the partner, and emits attribution only after explicit submission. Success copy: `Thanks. Your feedback was recorded.` The smoking option maps only to `smoking_policy_or_room_mismatch`.

## Current Filter Decision

Do not render an enabled smoking-policy filter, checkbox, chip, select, or URL parameter at 0% normalized coverage. Do not disable a control in the normal filter row merely to advertise unavailable functionality.

If the owning search surface already has a filter-help area and product explicitly chooses a discoverable explanation, it may show a non-filtering button:

- Button: `Smoking-policy filter unavailable`
- Dialog/popover title: `Smoking-policy filter unavailable`
- Body: `This supplier does not provide smoking-policy evidence in expaify results yet. Check room and property rules with the booking partner.`
- Close: `Close`

Opening or closing it never mutates results, query parameters, ranking, or focus order.

## Future Confirmed-Only Filter

This design stays dormant until all gates pass for the current search response.

### Enablement gate per option

An option is enabled only when:

1. At least one displayed offer has current, threshold-qualified `confirmed` evidence for that exact normalized value and scope.
2. The response provides counts across all displayed offers for `confirmed`, `ambiguous/conflicting`, `not_provided`, and `unavailable` separately.
3. Filtering operates on normalized provider evidence, never display strings.
4. Stale, ambiguous, conflicting, missing, unavailable, and loading offers are non-matches but counted as not confirmed.
5. `Smoking room available for this stay` additionally has selected dates, room id, and rate id for each match. `smoking_rooms_offered` never satisfies it.

### Options and labels

- `Smoke-free property` → exact `smoke_free_property` only.
- `Non-smoking room for this stay` → exact `selected_room_non_smoking` only.
- `Smoking room available for this stay` → exact `selected_room_smoking` only.

Do not offer `Avoid smoke`, `Smoke-free`, or `Smoking allowed` as broad options. Their scopes are indeterminate.

### Filter disclosure and counts

- Group label: `Provider-confirmed smoking policy`
- Supporting copy: `Only hotels with current supplier evidence for the exact option are shown. Hidden hotels may have unreported policies.`
- Selected summary: `{confirmedCount} confirmed · {unconfirmedCount} not confirmed`
- Clear action: `Show all hotels`

Single selection is sufficient for MVP because the intents can conflict. Applying an option immediately updates results and the count; there is no separate Apply button. Query state uses only an allowlisted normalized option.

### Loading and errors

- Before coverage counts resolve, the group is absent rather than disabled.
- During a refresh, retain the last result set but mark the option `Updating evidence…`; do not add newly stale records to matches.
- On policy-count error, remove the active filter, restore all hotels, and announce: `Smoking-policy evidence could not be updated. Showing all hotels.`
- Never collapse a provider inventory error into a filter empty state.

## Responsive Layout

### 375px viewport

- Page has no horizontal scroll at 375 CSS px and supports down to the app minimum of 320px.
- Card outer padding remains `p-3`; policy panel uses `px-3.5 py-3` and a single column.
- Both dimension cards use `min-w-0`; supplier wording uses `whitespace-pre-wrap break-words` and long unbroken tokens use `overflow-wrap:anywhere` via a utility or CSS equivalent.
- No policy chip competes with the hotel name/price grid under 352px.
- `Review hotel`, `Details`, retry, filter-clear, mismatch controls, and provider CTA retain at least 44px touch height.
- Provider CTA remains full-width in the existing action stack; policy content never becomes sticky and never overlaps it.
- Conflict records are fully readable without horizontal scrolling.
- The room dimension appears before property/common areas, then boundary copy, in one column.

### 1280px viewport

- Preserve the owning page's maximum width and card grid.
- Inside expanded policy details, use two equal columns only when the component has sufficient inline width (`lg:grid-cols-2` or a matching container query). Do not base this solely on the viewport if the card remains narrow.
- Both columns start at the same block position; unequal content grows its own row naturally.
- Shared evidence boundary spans both columns.
- Review may use two columns inside the policy panel, but provider guidance and CTA remain after the full panel.
- DOM, focus, and reading order remain room → property/common areas → boundary → CTA.

## Keyboard and Assistive Technology

- Policy claims and evidence are static content and receive no `tabindex`.
- The existing `Details` button remains the only card disclosure, uses `aria-expanded` and `aria-controls`, and retains focus when opened/closed.
- When details open, do not move focus or announce the entire panel. The button's expanded state is sufficient; users encounter the panel next in DOM order.
- Each policy panel is a labelled `<section>`; each dimension is a nested labelled `<section>` or `<div role="group">`.
- State is always expressed in text; color and icons are supplementary.
- Initial loading uses one `role="status" aria-live="polite" aria-atomic="true"` per visible policy panel. Do not put the entire evidence panel in a live region.
- Initial failure or retry failure uses the same polite region; it is not an assertive blocking error because booking remains usable.
- Refresh completion announces once: `Supplier smoking policy updated.` or `Supplier smoking policy remains unavailable.`
- Verbatim supplier wording is introduced by a visible `Supplier wording` label; do not put it only in `aria-label`.
- Conflict count is announced before the list. Each statement has an accessible scope and provenance.
- Dates are visible in localized form and available to assistive technology with unambiguous month names; raw ISO values may be supplied in `<time dateTime>`.
- Buttons and radios use native elements. Escape closes the optional explanation dialog and returns focus to its trigger. Cancel closes the inline mismatch form and returns focus to `Report a mismatch`.
- On future filter changes, announce `{confirmedCount} provider-confirmed hotels shown. {unconfirmedCount} hotels not shown because the policy was not confirmed.` once through the results summary, not once per card.
- Reduced-motion users receive no skeleton pulse; honor `prefers-reduced-motion` using the existing global motion treatment or add one in UI implementation.

## Interaction Rules

### Tap/click

- `Details` opens/closes all existing details including the policy panel.
- Static policy text never acts like a control.
- `Review hotel` carries the validated evidence snapshot to `/book`.
- Provider CTA opens the existing affiliate deeplink in a new tab and leaves the expaify review open.
- Policy retry, if owned by the search surface, retries only policy evidence.
- Future filter options update only hotel visibility and counts, not rank or Deal Score.

### Enter/Space

- Native button, disclosure, dialog, retry, clear, and mismatch controls activate normally.
- Radio arrows move within the mismatch group; Space selects.

### Errors

- Malformed evidence is downgraded by the normalization/validation layer, never interpreted by UI.
- A malformed single dimension becomes `unavailable` for that dimension while valid evidence in the other dimension remains.
- A malformed booking-policy snapshot never redirects away from an otherwise valid review.
- Unsafe/unknown source URLs remain governed by existing handoff validation and affiliate rules.

## Evidence Freshness

The implementation must define an approved freshness window by provider/data contract. UX cannot invent a universal policy lifetime.

- While inside that window, show `Observed {date}`; do not say `Verified` or `Current`.
- After expiry, remove confirmed collapsed copy and confirmed filter membership immediately.
- Expanded details/review may retain the exact prior assertion with stale label and explanation.
- Refresh success replaces the old snapshot atomically.
- Refresh error keeps the stale snapshot visibly non-current and presents no match claim.
- A six-hour cache TTL is a transport/cache rule, not proof that the supplier policy remains enforced or unchanged.

## Measurement Boundaries

Events contain normalized enums and identifiers only. Never send hotel name, supplier source text, deeplink, room name, free text, medical intent, or mismatch prose.

| Event | Fire boundary | Required properties | Must not fire when |
| --- | --- | --- | --- |
| `hotel_smoking_policy_detail_viewed` | Once per offer when at least 50% of the expanded policy panel is visible for 1 continuous second | `offerId`, `provider`, `roomEvidenceState`, `roomScope`, `propertyEvidenceState`, `propertyScope` | Card is merely rendered/collapsed, visibility is under threshold, or it was already counted in this view. |
| `hotel_smoking_filter_explanation_viewed` | Once when the unavailable explanation opens | `availabilityReason`, `confirmedCoverageCount` | Trigger is merely rendered or explanation is closed without opening. |
| `hotel_smoking_filter_option_selected` | Future: on explicit enabled-option selection | `option`, `preFilterTotalCount`, `preFilterConfirmedCount`, `preFilterUnconfirmedCount` | Disabled/unavailable explanation is used or selection is restored from hydration without user action. |
| `hotel_smoking_filter_results_rendered` | Future: after the DOM commits the selected filter result set | `option`, `confirmedCount`, `unconfirmedCount` | Request starts, fails, or stale results remain on screen. |
| `hotel_smoking_policy_review_viewed` | Once when at least 50% of the review policy panel is visible for 1 continuous second | same evidence snapshot fields as detail plus `offerId`, `provider` | Review route loads but panel is not exposed. |
| `hotel_handoff_return_reason_selected` | Only after explicit `Send feedback` submission | `reason` enum, `offerId`, `provider`, `partnerHost` | Radio is focused/selected but not submitted, or return timing alone is observed. |

Allowed enums:

- `availabilityReason`: `no_normalized_provider_coverage`, `coverage_check_unavailable`.
- Evidence states and scopes: exactly the normalized contract values.
- Filter options: `smoke_free_property`, `selected_room_non_smoking`, `selected_room_smoking`.
- Return reasons: `smoking_policy_or_room_mismatch`, `price_or_fees_mismatch`, `room_availability_mismatch`, `other_hotel_details_mismatch`, `prefer_not_to_say`.

`hotel_handoff_returned` remains a reversal candidate only. Never join or count it as a smoking-policy mismatch unless an explicit submitted reason exists for that handoff session.

Measurement implementation also requires an approved production analytics sink and privacy review; the current development-only logger cannot produce product metrics.

## Required Downstream UI Work

UI implementation may proceed with the normalized contract and fixtures, but must not fabricate confirmed production evidence.

1. Add a reusable `SmokingPolicyPanel` presentational component with every state in this spec.
2. Add the panel to expanded `HotelCard` between Location and Access.
3. Add only threshold-qualified collapsed summary logic; current Hotellook fixtures render none.
4. Reuse the panel in hotel review and place partner instruction immediately before the CTA.
5. Add return-reason UI only if a validated handoff-session state and approved analytics sink are available; otherwise leave it out and document the dependency.
6. Add unit/render tests for every copy/state combination, state matrix, long wording, conflicts, stale evidence, 375px layout classes, and accessible structure.
7. Do not add an enabled filter in UI implementation.

## Required Downstream DEV Work

1. **Shared types:** add the provider-neutral smoking contract to `lib/types.ts` with independent room/property evidence, exact scopes, five evidence states, lifecycle state, provenance, verbatim wording, conflict arrays, freshness, and selected room/rate/date identity.
2. **Provider adapter:** all evidence enters through `lib/providers`. Hotellook must emit an explicit `ready/not_provided` policy object for both dimensions when its successful normalized response has no supported fields; it must never infer policy from existing strings or generic amenities.
3. **Live/cache parity:** extend Hotellook live mapping, cache validation, and cached normalization so the full policy object survives without dropped fields. Validate/length-bound source text, source labels, timestamps, dates, ids, states, and scopes. Preserve conflicts; do not use access-evidence precedence.
4. **Independent lifecycle:** add an independent search-stream policy status (for example `hotel-smoking-policy-status`) per offer or search, separate from hotel inventory and `hotel-access-status`. Policy failure must not remove offers or disable valid booking actions.
5. **Booking continuity:** extend `BookingHotelContext`, builders, parsers, and validators with a structured policy snapshot. Use allowlisted scalar fields or a signed/server-side reference; do not accept arbitrary raw JSON/free text from query parameters. Preserve dates and selected room/rate identity only after validation.
6. **Freshness:** define provider-specific freshness windows and downgrade expired evidence out of confirmed/filter logic while retaining labelled prior statements where permitted.
7. **Filter engine (future only):** implement exact normalized confirmed-only matching and coverage counts. Keep dormant behind evidence gates; never let property capability satisfy selected-room availability.
8. **Analytics:** add the specified events to an approved production sink, deduplicate exposure events, bind explicit return reasons to a handoff session, and enforce the no-free-text payload contract.
9. **Provider result contract:** adapters keep returning `Result<T>` and never throw. Secrets remain env-only, money remains integer minor units, and all provider deeplinks retain affiliate markers.
10. **Tests:** cover malformed payloads, empty successful payloads, provider errors, live/cache equivalence, byte-preserved ambiguous wording after safe normalization, conflict preservation, selected-room evidence validation, stale evidence, booking round-trip, affiliate deeplinks, stream independence, and analytics boundaries.
11. **Surface integration:** `HotelCard` is not mounted on the current root/feed. A separately scoped ticket must identify and wire the owning live hotel-results surface before claiming end-to-end search-result delivery.

## Acceptance Criteria

### Meaning and copy

- Room and property/common-area evidence are visibly separate on card details and review.
- `All rooms non-smoking`, `Selected room: Non-smoking`, and `Smoke-free property` are never interchangeable.
- Every normalized confirmed value renders its exact scoped claim.
- Ambiguous wording survives safe normalization without changed words, punctuation, capitalization, or order.
- Conflict fixtures show all statements and never select a winner.
- `not_provided`, `unavailable`, and loading are visibly and programmatically distinct.
- Every section includes the evidence boundary; no UI claims enforcement, exposure, air quality, cleaning, ventilation, or health safety.

### Continuity

- Card → `/book` preserves evidence state, normalized value, scope, source label/text, observed time, conflict statements, and selected dates/room/rate identity.
- Missing evidence remains visible on review instead of disappearing.
- Property capability never becomes selected-room availability in serialization or copy.
- Provider instruction is immediately before the CTA.
- Evidence remains visible after provider return.

### Filter

- Current all-`not_provided` Hotellook results expose no enabled policy option and do not mutate results.
- Future mixed fixtures match only current exact `confirmed` states, disclose confirmed/unconfirmed counts, and restore all results on clear.
- `Smoking room available for this stay` cannot enable from `smoking_rooms_offered`.
- Future zero-match copy and `Show all hotels` behavior match this spec exactly.

### Responsive and accessibility

- At 375px, all evidence, long supplier wording, conflicts, controls, and CTA remain readable with no overlap or horizontal scroll.
- At 1280px, visual columns retain room-first DOM order.
- All controls have visible focus and at least 44px target height.
- Screen-reader output names dimension, state, scope, and uncertainty without depending on color.
- Loading/update announcements fire once and do not repeat the whole panel.
- Keyboard users can disclose details, retry, use the future filter, submit/cancel mismatch feedback, and continue to provider without a focus trap.

### Regression and integrity

- Policy loading/error never hides hotel inventory, price, Deal Score, access evidence, or valid handoff actions.
- Policy evidence does not change ranking or Deal Score.
- No component parses provider strings or calls vendor APIs.
- Provider adapters retain `Result<T>`, affiliate, env-secret, and integer-money contracts.

## Delivery Sequencing

The pipeline-safe sequence is:

1. UI builds and tests the reusable two-dimension presentational panel and review layout against normalized fixtures, without parsing provider data or activating a filter. Until the shared contract exists, current production may render only an explicitly supplied safe missing/loading/error view; it must not invent positive evidence.
2. UI hands off to DEV for the provider-neutral shared contract, explicit Hotellook `not_provided` state, cache/live parity, independent lifecycle, validated booking-context round-trip, and production data wiring.
3. A separately scoped integration ticket mounts the hotel result surface if product intends this flow to be live.
4. A future provider-coverage ticket may activate confirmed evidence.
5. A future filter ticket may activate only after the per-option evidence gates pass.

No stage may claim a smoke-free or smoking-room match from the current Hotellook feed.

## Blockers and Out-of-Scope Findings

- **Provider blocker:** current normalized Hotellook coverage is 0% for both policy dimensions. No confirmed claim or enabled filter can ship.
- **Contract blocker:** current `HotelEvidenceStatus`, `HotelEvidenceScope`, and `BookingHotelContext` cannot represent this taxonomy or preserve conflicts/verbatim text.
- **Selected-room blocker:** current hotel offers have no dated room/rate identity, so selected-room availability claims are impossible.
- **Measurement blocker:** analytics is development-only; production measurement and explicit return attribution need an approved sink/privacy review.
- **Surface blocker:** `HotelCard` is not mounted on the live root/feed; wiring that surface is outside this UXDES ticket.
- **Out of scope:** reviews mentioning smoke, generic amenities, local rules, photos, and provider deeplink copy are not policy evidence.
