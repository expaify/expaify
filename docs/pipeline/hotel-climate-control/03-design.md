# UXDES-HOTEL-CLIMATE-CONTROL-01 — Hotel in-room climate-control confidence

Date: 2026-08-03  
Stage: UX Design  
Priority: P0  
Upstream: `docs/pipeline/hotel-climate-control/02-research.md`

## 1. Design decision and release boundary

Implement one provider-neutral evidence snapshot with three independent rows:

1. **Cooling**
2. **Heating**
3. **Room temperature adjustment**

The snapshot produces one compact comparison cue on `DealCard` and the same full three-row ledger on saved detail and booking review. Every rendered fact retains its state, most-specific scope, provider source, observation time, operating qualification, and conflict information. The UI never combines the rows into a `Climate controlled` badge or a comfort promise.

The safe first release is a trust repair, not a claim that supplier evidence now exists. The active normalized providers and saved-deal snapshot contract currently support none of the three dimensions. Until a provider adapter returns a validated climate snapshot, all current production offers resolve to **unsupported**, not `not_provided`, `check_failed`, or `explicitly_absent`. Positive, negative, room-category, selected-room/rate, conflict, and stale variants in this specification are provider-contingent states and test fixtures.

This ticket does not authorize a provider, filter, sort, ranking change, Deal Score change, weather input, review inference, or room selection inside expaify. Climate evidence never changes price, Deal Score, result order, or whether the provider handoff remains available.

### Hard claim boundary

Only a validated provider statement may populate the ledger. Do not infer any row from destination climate, season, hotel class, photos, reviews, property name, another amenity, price, or common practice.

Never display `climate controlled`, `comfortable`, `cool room`, `warm room`, `thermostat`, `individual control`, `your room has`, `available in every room`, `effective`, `quiet`, `reliable`, or a temperature range unless the exact underlying fact and scope are explicitly represented and the copy pattern below permits it. Even then, this design uses the narrower terms **cooling**, **heating**, and **room temperature adjustment**.

## 2. User decision and information hierarchy

The traveler must be able to answer four questions without opening a tooltip:

- Is cooling reported, absent, or unavailable?
- Is heating reported, absent, or unavailable?
- Does the provider state that the guest can adjust room temperature?
- What does each statement apply to?

### Cross-surface hierarchy

**`DealCard` on `/deals`**

1. Primary: hotel name, observed nightly price, discount/Deal Score context, and `View deal`.
2. Secondary: location/stay window, existing material hotel-fit cues, and at most one compact climate summary.
3. Tertiary: price-check time and snapshot disclosure.

The card does not show a three-row table, source text, observed date, or retry control. Its single climate cue is derived from the exact snapshot carried to detail. It is ordinary text, not a badge or action.

**Saved detail and booking review**

1. Primary page content: property/stay, price and Deal Score, and the provider action.
2. Secondary: `Hotel fit`, including a distinct `Room climate evidence` subsection before provider handoff.
3. Primary within the subsection: the three row labels and their factual state sentences.
4. Secondary within each row: explicit scope and operating qualification.
5. Tertiary: provider source, observation date, stale note, and bounded provider wording.

The full ledger is always visible. Do not put it in a tooltip, modal, carousel, accordion, or hover-only disclosure. An evidence limitation never blocks `View deal`, Back, or a valid affiliate handoff.

## 3. Normalized evidence and continuity contract

UI code consumes normalized values only. Vendor codes and payload parsing stay in `lib/providers`. Provider methods return `Result<T>` and do not throw to callers.

```ts
type HotelClimateDimension = 'cooling' | 'heating' | 'guest_control'

type HotelClimateCapability =
  | 'supported'
  | 'unsupported'

type HotelClimateLoadState =
  | 'loading'
  | 'ready'
  | 'refreshing'
  | 'failed'

type HotelClimateScope =
  | 'property'
  | 'room_category'
  | 'selected_room_rate'

type HotelClimateValue =
  | 'present'                 // cooling/heating only
  | 'explicitly_absent'      // cooling/heating only
  | 'guest_adjustable'       // guest_control only
  | 'property_controlled'    // guest_control only
  | 'not_provided'
  | 'check_failed'
  | 'conflicting'

type HotelClimateOperatingQualification =
  | { kind: 'year_round' }
  | { kind: 'seasonal_period'; label: string }
  | { kind: 'schedule_not_stated' }

type HotelClimateStatement = {
  id: string
  value: Exclude<HotelClimateValue, 'not_provided' | 'check_failed' | 'conflicting'>
  scope: HotelClimateScope
  sourceLabel: string
  observedAt: string
  sourceWording?: string
  roomCategoryId?: string
  roomCategoryLabel?: string
  roomId?: string
  rateId?: string
  checkIn?: string
  checkOut?: string
  operatingQualification?: HotelClimateOperatingQualification
}

type HotelClimateRow = {
  dimension: HotelClimateDimension
  value: HotelClimateValue
  mostSpecificScope?: HotelClimateScope
  statements: HotelClimateStatement[]
  isStale: boolean
  refreshFailed?: boolean
}

type HotelClimateEvidence = {
  schemaVersion: 1
  capability: HotelClimateCapability
  loadState: HotelClimateLoadState
  providerId: string
  providerPropertyId: string
  offerId: string
  evidenceRevision: string
  rows: readonly [HotelClimateRow, HotelClimateRow, HotelClimateRow]
}
```

Add `climateEvidence?: HotelClimateEvidence` to the normalized hotel/deal record and to `BookingHotelContext`. Saved-deal storage must persist the same normalized snapshot or explicitly persist an unsupported snapshot; it must not reconstruct provider, scope, or state from the legacy saved row.

### Structural invariants

- `rows` contains exactly one row in this order: `cooling`, `heating`, `guest_control`.
- `unsupported` applies to the whole provider/adapter capability and forces all visible rows to unsupported presentation. It does not fabricate three `not_provided` values.
- `not_provided` means a supported, completed check returned no usable statement for that dimension.
- `check_failed` means that dimension was attempted but could not be checked. It is never used when the adapter is unsupported.
- `explicitly_absent` is permitted only for cooling/heating and requires at least one attributable negative statement.
- `guest_adjustable` and `property_controlled` are permitted only for `guest_control`. Missing control wording resolves to `not_provided`, even when cooling or heating is present.
- `present`, `explicitly_absent`, `guest_adjustable`, and `property_controlled` require a non-empty provider label and valid observation timestamp.
- A room-category statement requires both `roomCategoryId` and a bounded `roomCategoryLabel`. It cannot be relabeled selected room/rate.
- A selected-room/rate statement requires a matched `roomId`, `rateId`, `checkIn`, and `checkOut` for the current offer/stay.
- Property-wide or all-room content remains `property` scope. `All rooms` may appear only as preserved provider wording; it is not a fourth scope and is not selected-rate confirmation.
- A selected-room claim is invalid when its stay, room, rate, property, provider, or offer identity does not match current context. Degrade the affected row to `conflicting` if valid competing statements exist; otherwise fail closed to `check_failed`/invalid presentation rather than selecting a claim.
- If valid statements at the same or more-specific scope disagree, the row is `conflicting`. Preserve at least two bounded statements; do not choose a winner.
- Less-specific evidence never overrides more-specific evidence. A valid selected-room/rate statement leads; room-category leads property. A more-specific explicit negative can conflict with or supersede a less-specific positive, but the property statement remains available as conflict context.
- `sourceLabel`, `roomCategoryLabel`, and seasonal `label` are trimmed, display-safe, and at most 80 characters. `sourceWording` is display-licensed, strips control characters/markup, and is at most 180 characters. Invalid prose is omitted without invalidating an otherwise structured statement.
- `observedAt` is a valid non-future timestamp. The UI renders its UTC calendar date as `Mon D, YYYY`.
- `evidenceRevision` is opaque, non-empty, and at most 40 characters. It changes whenever any semantic field changes.
- Climate freshness uses a provider-approved evidence TTL. The six-hour offer cache may transport the snapshot, but does not by itself define the evidence TTL.

### Semantic continuity requirement

Provider normalization, `DealCard`, saved detail, inline `/book` context, referenced/stored `/book` context, review, and return analytics must retain byte-equivalent values after JSON serialization for:

`schemaVersion`, provider/property/offer identities, `evidenceRevision`, capability/load state, row order, every row value, scope, statement ID, source, observation time, operating qualification, room/rate/stay linkage, staleness, and conflicts.

Presentation copy may differ by surface; semantic values may not. Review must not refetch, broaden scope, merge rows, or silently replace the snapshot with a newer one. A newer revision requires an explicit refresh before handoff and rerenders all surfaces from that revision.

When inline URL length would exceed the existing safe limit, use the existing stored-context reference path. Never truncate statements or drop a climate row to fit a URL. If context storage fails, the booking review must show the failed continuity state in §7 and must not claim prior evidence survived.

## 4. Shared component anatomy

```text
HotelClimateResultCue                 // DealCard only
└── p                                 // one non-interactive summary

HotelClimateEvidenceLedger            // saved detail + review
└── section[aria-labelledby]
    ├── h3 “Room climate evidence”
    ├── p scope boundary
    ├── div[role=status]               // loading/refresh result only
    ├── dl
    │   ├── div ClimateEvidenceRow     // Cooling
    │   │   ├── dt
    │   │   ├── dd state sentence
    │   │   ├── dd scope/qualification
    │   │   └── dd source/freshness/wording
    │   ├── div ClimateEvidenceRow     // Heating
    │   └── div ClimateEvidenceRow     // Room temperature adjustment
    └── button “Try climate check again” // check_failed only, when retry exists
```

Use `h3` when nested within `Hotel fit`. If implementation places it as a top-level sibling, promote to `h2`; do not skip heading levels. Each `dt` and its `dd` elements are wrapped in one `<div>`. Row state is stated in text; color or an icon may reinforce but never replace it.

Persistent section boundary copy:

`Provider-reported equipment and control only. This does not predict room temperature or comfort.`

Do not duplicate this sentence in every row.

## 5. Final copy system

Only replace braced values. Do not paraphrase per provider.

### Row labels

| Dimension | Visible `dt` and accessible label |
|---|---|
| `cooling` | `Cooling` |
| `heating` | `Heating` |
| `guest_control` | `Room temperature adjustment` |

### Scope labels

| Scope | Exact visible copy | Meaning |
|---|---|---|
| `property` | `At this property` | Property-level evidence only; no room claim. |
| `room_category` | `For {room category}` | Named category only; no selected-rate guarantee. |
| `selected_room_rate` | `For this room and rate` | Valid matched room/rate for current dates. |

If a room-category label is unavailable or invalid, do not substitute `this room category`; treat the statement as unusable.

### Positive and explicit-negative state copy

| Dimension/value | State sentence |
|---|---|
| Cooling / `present` | `Cooling is reported.` |
| Cooling / `explicitly_absent` | `Cooling is reported absent.` |
| Heating / `present` | `Heating is reported.` |
| Heating / `explicitly_absent` | `Heating is reported absent.` |
| Guest control / `guest_adjustable` | `The provider states that guests can adjust the room temperature.` |
| Guest control / `property_controlled` | `The provider states that room temperature is property-controlled.` |

The state sentence is immediately followed by its scope on a separate line. Thus a property positive reads:

`Cooling is reported.`  
`At this property. This does not confirm cooling for a specific room or rate.`

A room-category positive reads:

`Heating is reported.`  
`For Deluxe King Room. This does not confirm the selected room or rate.`

A selected-room/rate positive reads:

`Cooling is reported.`  
`For this room and rate.`

An explicit negative reads, for example:

`Cooling is reported absent.`  
`For Deluxe King Room. This is a provider-stated absence, not missing information.`

For `property_controlled`, append: `This does not show that guests can set the temperature themselves.`

### Operating qualification

Render only on a non-missing, non-failed statement:

| Qualification | Exact copy |
|---|---|
| `year_round` | `Operation reported year-round.` |
| `seasonal_period` | `Operating period: {provider period}.` |
| `schedule_not_stated` | `Operating schedule not stated.` |
| qualification absent | No qualification line; do not invent `year-round` or `seasonal`. |

The provider period is preserved factual text, not parsed into a promise for the stay. If it does not clearly overlap the selected dates, do not claim availability during the stay.

### Provenance and bounded provider wording

Default metadata:

`Source: {provider} · Checked {Mon D, YYYY}`

If a valid display-licensed `sourceWording` adds needed nuance, show:

`Provider wording: “{bounded wording}”`

Show provider wording only for `property_controlled`, seasonal qualification, explicit absence, conflict, or when normalization would otherwise remove a material qualifier. Do not show raw JSON, facility codes, markup, or unlicensed content. Assistive text announces the same wording once.

### Unavailable-state copy

| State | Row sentence | Secondary sentence |
|---|---|---|
| Adapter/provider unsupported | `{Dimension} details are not supported by this provider connection.` | `No check was attempted. Confirm this with the provider if it matters to your stay.` |
| `not_provided` | Cooling: `Cooling was not provided by this provider.` Heating: `Heating was not provided by this provider.` Control: `Room temperature adjustment was not stated.` | `This is missing information, not a reported presence or absence.` |
| `check_failed` | Cooling: `Cooling details could not be checked.` Heating: `Heating details could not be checked.` Control: `Room temperature adjustment could not be checked.` | `The hotel, price, and Deal Score are still available.` |
| `conflicting` | Cooling: `Cooling statements do not agree.` Heating: `Heating statements do not agree.` Control: `Room temperature adjustment statements do not agree.` | `We are not choosing one statement as correct. Confirm the current room and rate with the provider.` |
| stale positive/negative | `{Normal state sentence}` | `Earlier provider information could not be reconfirmed. Do not rely on it as current.` |

For conflicts, show each valid statement in source order beneath the secondary sentence:

`{State sentence} {Scope label}. Source: {provider} · Checked {date}.`

Do not expose more than three conflict statements per row. If more exist, show `Additional provider statements were withheld because they do not resolve the conflict.` This is not an expandable raw-data dump.

### Section-level states

| Condition | Heading-adjacent copy and behavior |
|---|---|
| Default ready | Render all three rows. No generic overall verdict. |
| Loading initial check | `Checking room climate details…` plus three stable skeleton rows. |
| Refreshing with prior current evidence | Keep rows visible and append `Checking for updated room climate details…` |
| Supported partial result | Render every row independently; available facts do not hide missing/failed rows. |
| Unsupported | Render all three unsupported rows to preserve comprehension on detail/review. No retry. |
| All three `not_provided` | Render all rows plus `The provider returned no room climate details for this offer.` |
| Whole check failed | Render all three failed rows plus one retry when a real server check exists. |
| Invalid/malformed snapshot | Treat as failed, use `Returned room climate details could not be verified.` and do not render unsafe values. |
| Stale snapshot, refresh pending | Keep prior facts visible, label every affected row stale, and announce refresh. |
| Stale snapshot, refresh failed | Keep prior facts visible with stale warning; do not convert them to `not_provided`. Offer retry only when supported. |
| Context continuity failed at review | `Room climate details could not be carried into this review.` Then three failed rows and `Check cooling, heating, and room temperature adjustment with the provider.` |

There is no blank/empty ledger, `N/A`, `Unknown`, em dash, or absent row.

## 6. `DealCard` compact cue

The card cue appears after existing material disruption/quiet cues and before price, preserving the current card action and price hierarchy. It is derived deterministically from all three rows and never implies a selected room unless every claim in the cue is selected-room/rate scoped.

### Priority and exact copy

Use the first matching rule:

1. Any current conflict: `Room climate details conflict · check cooling, heating, and adjustment`
2. Any current explicit absence: `{Cooling|Heating} reported absent · {scope short label}`. If both are absent: `Cooling and heating reported absent · {least-specific applicable scope}`.
3. All three selected-room/rate positive: `Cooling, heating, and room adjustment reported · this room and rate`
4. Cooling and heating positive at the same scope, control unavailable: `Cooling and heating reported · {scope short label} · adjustment not stated`
5. One or more current positives: join at most two dimensions, then add the least-specific scope; examples: `Cooling reported · at property` and `Heating and room adjustment reported · room category`.
6. Any stale statement with no higher-priority current result: `Earlier room climate details could not be reconfirmed`
7. Any failed row: `Some room climate details could not be checked`
8. Supported, all missing: `Room climate details not provided`
9. Unsupported: `Room climate details not supported by this provider`
10. Initial loading: `Checking room climate details…`

Short scope labels are exactly `at property`, `room category`, and `this room and rate`. Mixed scopes use the least-specific scope and never enumerate a more-specific claim. Example: selected-rate cooling plus property heating becomes `Cooling and heating reported · at property`; the full ledger clarifies each row.

If `DealCard` lacks a validated snapshot, treat it as unsupported only when provider capability metadata explicitly says unsupported. Otherwise omit the cue rather than guessing. The card's link accessible name appends the cue once: `View deal: {hotel}. Room climate: {cue}.`

## 7. Saved detail and booking review

### Saved detail placement

Within the existing `Hotel fit` section, place `Room climate evidence` after hotel class/guest rating and before disruption/quiet evidence. Render the full ledger. Keep `Check rooms with provider` as the next top-level decision section.

Replace the current over-broad saved-detail sentence:

`Rate shown for this stay context; the provider confirms room-level details.`

with:

`This observed rate is associated with these stay dates. Room options and room-level details are confirmed only where the evidence below says “For this room and rate.”`

When dates are incomplete, retain:

`Stay dates are incomplete. Choose or confirm dates with the provider before comparing room options.`

No saved row currently establishes room/rate climate details. The replacement is required even if climate evidence is unsupported.

### Booking review placement and continuity

Inside `HotelDecisionSummary` → `Hotel fit`, render the same `HotelClimateEvidenceLedger` after class/rating/admission facts and before the provider section. It consumes `hotelContext.climateEvidence`; it does not reconstruct from `HotelOffer`, provider name, or saved-deal fields.

If the snapshot is absent from a legacy context, show the continuity-failed state, not three `not_provided` rows. A missing legacy field does not prove the provider omitted climate data.

Review lead message becomes:

`Review the property, observed nightly rate, hotel fit, room climate evidence, and provider handoff.`

### Handoff checklist

Immediately before the provider CTA, include one `Room climate check` block. Repeat only unresolved dimensions; do not restate current selected-room/rate confirmations as unknown and do not downgrade a property/category fact.

Heading: `Room climate check`

Rules and exact items:

- Selected-room/rate current positive/negative: omit that dimension from the unresolved list.
- Property positive/negative: `Confirm whether {cooling/heating} applies to the room and rate you choose.`
- Room-category positive/negative: `Confirm that {room category} is the room and rate you choose, and recheck {cooling/heating}.`
- Cooling missing/failed/unsupported/conflict/stale: `Confirm cooling for the room and rate you choose.`
- Heating missing/failed/unsupported/conflict/stale: `Confirm heating for the room and rate you choose.`
- Guest control missing/failed/unsupported/conflict/stale/property-controlled: `Confirm whether you can adjust the room temperature yourself.`
- Guest-adjustable at property or category scope: `Confirm that guest room-temperature adjustment applies to the room and rate you choose.`

If no dimensions remain unresolved, show:

`The provider evidence above covers cooling, heating, and room temperature adjustment for this room and rate. Recheck the current room details before payment.`

This is not a guarantee of comfort or equipment performance.

Append these climate instructions to the CTA accessible description after price/fee guidance and before smoking guidance. Do not concatenate source wording into the CTA label.

## 8. Interaction behavior

### Default and navigation

- The ledger is informational. Rows are not selectable and do not look like controls.
- `View deal`, Back, provider CTA, and adjacent evidence controls remain enabled for every climate state.
- Loading, failure, or missing evidence never changes price or Deal Score content.
- Do not auto-focus or scroll to climate content on resolution.

### Retry

- Show `Try climate check again` only for `check_failed`, malformed, stale-refresh-failed, or whole-check-failed states when the server exposes a supported retry operation.
- The button invokes an expaify endpoint that calls `lib/providers`; it never calls a vendor from the component.
- While retrying, label changes to `Checking room climate details…`, `disabled` and `aria-disabled="true"` are set, prior facts remain visible, and `aria-busy="true"` is set on the ledger.
- Success replaces all rows atomically with one new `evidenceRevision`. Announce `Room climate details updated.` Do not move focus.
- Failure keeps prior/failed rows and announces `Room climate details still could not be checked. Try again or confirm with the provider.` Focus remains on the retry button.
- Do not retry automatically in a loop. One automatic page-load check is permitted; later attempts require the button.

### Loading

- Initial loading reserves three row containers to prevent layout shift.
- Skeletons are `aria-hidden="true"`; no animated glyph conveys meaning.
- The ledger uses `aria-busy="true"`. One `role="status" aria-live="polite" aria-atomic="true"` region says `Checking room climate details…`.
- On completion, update that same live region once with `Room climate details loaded.` or the exact failure announcement above.

### Conflict and stale evidence

- Conflict statements are always visible on detail/review; no disclosure interaction is required.
- Stale content remains visually subordinate to a persistent warning sentence. It is not crossed out and is not styled like current confirmation.
- A newer revision replaces the full snapshot atomically; do not mix old cooling with refreshed heating/control.

## 9. Keyboard and screen-reader behavior

- Semantic reading order matches visual order: section heading, boundary, Cooling, Heating, Room temperature adjustment, retry, then next page section.
- Static rows never enter the tab order. The only new focusable element is retry when present.
- Retry has a minimum 44 × 44 CSS-pixel target and the global `:focus-visible` outline plus `var(--focus-ring)`.
- The provider CTA follows the ledger/checklist in DOM order. Do not use positive `tabIndex` or CSS reordering.
- Each row uses `dt` plus associated `dd` content. Do not put `role="listitem"` on definition-list children.
- A row's accessible sequence is: dimension; state sentence; scope/caveat; qualification; source/date; provider wording or conflict statements.
- Do not put a giant `aria-label` on the whole ledger; that would suppress navigable row text. Heading navigation must find `Room climate evidence`.
- Status changes use the single polite live region. Only invalid payloads that could create a false claim may use `role="alert"`; ordinary missing, unsupported, conflict, stale, and check failure are not assertive alerts.
- Loading skeletons, decorative dots, and any status icon are `aria-hidden="true"`.
- The card link accessible name includes the compact cue once. Visible cue text remains in the accessibility tree; implementation must avoid duplicate announcement by either using visible text as the link description or omitting the appended phrase from `aria-label`.
- Screen-reader checks must cover VoiceOver + Safari and NVDA + Chrome. Required result: all three independent states and scopes are announced without relying on punctuation, color, or layout.

## 10. Responsive layout and Tailwind patterns

Use existing tokens from `app/globals.css`; do not add colors or font sizes.

### `DealCard` cue

```tsx
<p className="mt-2 break-words text-caption font-medium leading-5 text-[color:var(--text-2)]">
```

It wraps naturally at 375px. No `truncate`, `line-clamp`, fixed height, inline icon column, or absolute positioning. Card width, photo, price, and CTA stay unchanged.

### Full ledger shell

```tsx
<section
  aria-labelledby={headingId}
  aria-busy={isBusy || undefined}
  className="mt-5 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4"
>
  <h3 className="text-base font-medium text-[color:var(--text-1)]">
  <p className="mt-1 text-xs leading-5 text-[color:var(--text-2)]">
  <dl className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
```

### Row

```tsx
<div className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3">
  <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">
  <dd className="mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">
  <dd className="mt-1 break-words text-xs leading-5 text-[color:var(--text-2)]">
  <dd className="mt-2 break-words text-xs leading-5 text-[color:var(--text-3)]">
```

Warnings use `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]` on the row and `text-[color:var(--warning)]` for the warning sentence. Invalid uses `bg-[color:var(--error-soft)]` and `text-[color:var(--error-text)]`. Current positive remains neutral; do not turn it into a success badge. Explicit absence uses warning styling, not error styling. Conflict uses warning styling plus textual `statements do not agree`.

### Retry

```tsx
<button className="btn btn-outline mt-4 min-h-11 w-full sm:w-auto focus-visible:shadow-[var(--focus-ring)]">
```

### 375px acceptance

- One column; rows remain Cooling → Heating → Room temperature adjustment.
- Container uses existing page `px-4`; no content creates horizontal scroll at 320px or 375px.
- Long provider/category/seasonal strings break within the row.
- Retry is full width; the next CTA remains full width per its existing mobile pattern.
- Price, Deal Score, and `View deal`/provider CTA remain visible and do not overlap the ledger.

### 1280px acceptance

- Existing page max width remains unchanged.
- The three rows form equal one-fraction columns only at `lg`; metadata aligns to the top, not artificial equal-height baselines.
- The ledger stays inside `Hotel fit`; it does not create a side rail competing with price or handoff.
- No line is forcibly single-line, and no unused decorative panel is added.

## 11. Bounded provider-return mismatch feedback

After a detected provider return, keep the current optional pattern and update the prompt copy.

Heading: `Did the provider details match?`  
Support: `Optional: choose one reason. Do not include health or temperature details.`  
Legend: `What was missing or different?`

Single-select reasons, in this order:

| Analytics value | Visible label |
|---|---|
| `cooling_missing_or_mismatch` | `Cooling was missing or did not match` |
| `heating_missing_or_mismatch` | `Heating was missing or did not match` |
| `guest_control_not_confirmed` | `Room temperature adjustment was not confirmed` |
| `climate_details_missing_provider` | `Climate details were missing on the provider` |
| `unrelated_mismatch` | `Something unrelated did not match` |
| `prefer_not_to_say` | `Prefer not to say` |

Keep `Report a mismatch`, `Send feedback`, and `Cancel`. No free-text field, desired-temperature input, medical reason, severity score, multi-select, or follow-up question is permitted.

- Opening moves focus only through normal button activation; focus remains on the first radio only if the user tabs there. Do not auto-select a reason.
- Cancel clears selection, closes the form, and returns focus to `Report a mismatch`.
- Submit is disabled until a reason is selected. On success, announce `Thanks. Your feedback was recorded.` and move no focus.
- If persistence fails, announce `Feedback could not be recorded. Try again.` and keep the form/selection available.
- A returned handoff without a submitted reason remains unattributed. Never classify away duration, tab closure, or return itself as climate causation.

## 12. Analytics contract

Internal analytics validation and client emission must be changed together. Reject unknown fields; do not silently drop them. All names and values are low-cardinality except opaque IDs. Never send hotel name, room/category label, source wording, seasonal prose, desired temperature, free text, health information, coordinates, price, or raw provider payload.

### Exposure event

Event: `hotel_climate_evidence_exposed`

Emit once per `offer_id + surface + evidence_revision` when at least 50% of the climate cue/ledger is visible for 1,000 ms. `DealCard` uses the visible cue; detail/review use the section. Do not emit for SSR alone or a below-viewport ledger.

| Field | Allowed values |
|---|---|
| `offer_id` | opaque validated offer ID |
| `provider_id` | normalized provider allowlist or `other` |
| `surface` | `deal_card`, `saved_detail`, `booking_review` |
| `capability` | `supported`, `unsupported` |
| `load_state` | `ready`, `failed` |
| `dimension` | `cooling`, `heating`, `guest_control` |
| `evidence_state` | `present`, `explicitly_absent`, `guest_adjustable`, `property_controlled`, `not_provided`, `check_failed`, `conflicting`, `stale`, `unsupported` |
| `most_specific_scope` | `property`, `room_category`, `selected_room_rate`, `none` |
| `qualification_present` | boolean |
| `observed_time_present` | boolean |
| `selected_room_threshold_met` | boolean |
| `source_mode` | `live`, `cache`, `stored_snapshot`, `unknown` |
| `viewport_band` | `mobile_375`, `desktop_1280`, `other` |
| `evidence_revision` | opaque validated revision bucket |

Emit one event per dimension so denominators remain independent. `selected_room_threshold_met` is true only for valid, current, non-conflicting selected-room/rate evidence. An unsupported offer records `scope=none`, both booleans false, and threshold false.

### Interaction events

- `hotel_climate_retry_clicked`: `offer_id`, `provider_id`, `surface`, `prior_state`, `evidence_revision`.
- `hotel_climate_retry_resolved`: same plus `result=updated|failed|unchanged` and `next_revision` when validated.
- `hotel_climate_detail_reached`: same exposure fields summarized as `cohort=selected_room|room_category|property|mixed|unavailable`; one per revision.

### Handoff and return sequence

Align these events under one opaque `handoff_session_id`:

- `hotel_handoff_continue_clicked`
- `hotel_handoff_returned`
- `hotel_handoff_return_reason_selected`

The current internal allowlist must accept the exact emitted properties. `hotel_handoff_returned` must include only validated `source`, `partner_host`, `away_duration_bucket`, `handoff_session_id`, `climate_cohort`, and existing policy dimensions that are explicitly registered. The reason event accepts `reason`, `provider_id`, `partner_host`, `handoff_session_id`, and `climate_cohort`; it does not need hotel/room prose.

Do not report climate mismatch until continued, returned, and reason events persist and join successfully. A reason denominator is eligible returned handoffs where the prompt was rendered; nonresponse remains its own count. Enforce the product privacy minimum before publishing a cohort. Do not merge unsupported, missing, failed, explicit absence, conflict, or stale cohorts merely to reach a publishable count.

### Comparison behavior interpretation

An eligible comparison session requires at least two genuine hotel results and an exposed climate cue. Allowed next-action classifications are `detail_opened`, `another_hotel_opened`, `review_reached`, `search_changed`, `provider_handoff_started`, and `no_further_observed_action`. The last is an abandonment candidate only. No event or dashboard label may say `climate_abandonment` without a submitted bounded reason or moderated research evidence.

## 13. Required comprehension and continuity fixtures

Fixtures use synthetic hotels/providers, fixed UTC dates, no outbound vendor call, and one immutable revision. The same fixture must drive card, saved detail, inline review, stored-context review, and screen-reader tests.

| ID | Evidence | Required full-ledger interpretation | Required card cue |
|---|---|---|---|
| `selected_room_rate` | Cooling `present` and control `guest_adjustable` for selected room/rate; heating `not_provided` | Cooling and adjustment apply to this room/rate; heating is missing, not absent. | `Cooling and room adjustment reported · this room and rate` |
| `room_category` | Heating `present` for `Deluxe King Room`; control `not_provided`; cooling `not_provided` | Only the named category reports heating; selected-rate heating and guest control are unconfirmed. | `Heating reported · room category` |
| `property_only` | Cooling `present` at property; heating and control `not_provided` | Property reports cooling; no specific room/rate or guest adjustment is confirmed. | `Cooling reported · at property` |
| `explicit_negative` | Cooling `explicitly_absent` for `Standard Twin Room`; others `not_provided` | Cooling is provider-reported absent for that category; this is not missing data. | `Cooling reported absent · room category` |
| `missing_failed_conflict` | Cooling `not_provided`; heating `check_failed`; two guest-control statements conflict | None becomes presence/absence; each limitation remains distinct. | `Room climate details conflict · check cooling, heating, and adjustment` |
| `unsupported_current_contract` | Capability `unsupported`; all rows structurally unavailable | No provider climate check exists; do not call it supplier omission. | `Room climate details not supported by this provider` |
| `stale_refresh_failed` | Earlier cooling positive at property; stale; refresh failed; other rows missing | Earlier evidence is visible but not current and not a room guarantee. | `Earlier room climate details could not be reconfirmed` |

Add automated boundary fixtures for:

- property positive plus selected-room explicit negative → conflict shown; no positive selected-room claim;
- room-category statement without category ID/label → failed closed;
- selected-room statement with mismatched room/rate/dates → failed closed;
- cooling present with no control wording → `Room temperature adjustment was not stated`;
- `property_controlled` → never `guest_adjustable`;
- seasonal wording with and without selected-date overlap → qualification only, no inferred stay guarantee;
- future/malformed observation time, empty provider, unsafe wording, duplicate dimension, wrong row order, and unknown enum → invalid snapshot;
- more than three conflict statements → bounded overflow copy;
- inline context over 4,096 characters → stored-context path without semantic loss;
- stored context missing/expired/tampered → continuity-failed state;
- loading → ready, loading → failed, retry → updated, retry → failed, and stale refresh → updated atomically;
- 320px, 375px, 1280px; 200% zoom; long 80-character provider/category labels; reduced motion; keyboard-only; VoiceOver/Safari; NVDA/Chrome.

## 14. Comprehension study and release gate

Run a moderated first-use study with 12 travelers who booked a hotel online in the last 12 months; at least four must describe room temperature control as a must-have. Do not recruit, segment, or record answers by medical diagnosis. Randomize synthetic hotel names, price order, scenario order, and which dimension is unavailable.

Use the first five fixtures in §13. Ask, without leading terminology:

1. `What do you know about cooling?`
2. `What do you know about heating?`
3. `Can you adjust the room temperature yourself?`
4. `What does each answer apply to?`
5. `Which of these two hotels would you inspect next, and what evidence differs?`

Record answer accuracy before confidence. The release passes only when all conditions hold:

- at least 10/12 participants correctly identify each dimension's state and scope in every property-only and unavailable fixture;
- no more than 1/12 treats property-only, room-category-only, not-provided, failed, conflicting, stale, or unsupported evidence as selected-room/rate confirmation;
- at least 10/12 distinguish explicit absence from missing evidence;
- at least 10/12 distinguish `property_controlled` from `guest_adjustable` in the supplemental boundary fixture;
- all tasks are completable by keyboard at 375px and 1280px;
- VoiceOver/Safari and NVDA/Chrome users can reach and announce all three rows, state, scope, and retry without duplicate or color-only meaning;
- automated continuity tests prove semantic equality through provider normalization, card/detail, inline and stored review context, and return analytics;
- internal analytics accepts and joins the continued/returned/reason sequence in production-like tests;
- `npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests` exit 0.

Self-reported confidence cannot override an incorrect answer. If any comprehension threshold fails, revise hierarchy/copy and rerun every failed fixture before release. Do not ship positive provider-contingent states until approved representative payloads validate the provider mapping and display rights.

## 15. Implementation acceptance checklist

- One compact, non-interactive climate cue appears on `DealCard`; no climate badge or card-level three-row table is added.
- Saved detail and booking review render the same three ordered rows before provider handoff.
- The saved-detail blanket room-confirmation sentence is replaced exactly as specified.
- Cooling, heating, and adjustment never borrow or infer one another's state.
- Unsupported, not provided, failed, explicit absence, conflict, stale, loading, invalid, and partial states remain distinct.
- Property, room-category, and selected-room/rate scope copy is exact and visible.
- Source, observation date, operating qualification, and bounded conflicts survive context serialization.
- Missing legacy context produces continuity failure, not provider omission.
- Handoff checklist contains only unresolved dimensions and retains earlier scope.
- Return feedback is optional, single-select, bounded, and contains no free text.
- Analytics fields and event allowlists match; no supplier prose, hotel/room name, health data, or desired temperature is sent.
- 375px and 1280px preserve price, Deal Score, and provider action hierarchy without overlap or horizontal scroll.
- Keyboard, focus, live-region, heading, and definition-list behavior matches §§8–10.
- No vendor call occurs in a component; no filter, ranking, Deal Score, or provider expansion is introduced.

## 16. Blockers and out-of-scope findings

### Production-data blockers

- The current normalized provider contracts contain no climate fields or representative payloads. Positive/negative provider states cannot ship until an approved provider contract and samples establish IDs, scopes, conflicts, dates, display rights, and freshness.
- The saved-deal snapshot does not preserve a climate-capable supplier identity or evidence snapshot. Saved detail must show unsupported/continuity limitation until that data contract is repaired.
- expaify has no selected-room/rate object in the active flow. `selected_room_rate` remains fixture-only until an approved provider integration supplies an attributable room/rate/stay join.
- The internal analytics event registry currently rejects emitted return/reason payloads. Climate mismatch measurement is blocked until the schema and emissions align.

### Out of scope

Climate filtering or ranking, Deal Score changes, new providers, supplier scraping, weather or indoor-temperature prediction, review/photo inference, HVAC performance/noise/reliability, desired-temperature capture, medical profiling, smart-room controls, and post-stay comfort claims are not authorized.

The research also identified direct external snapshot calls outside `lib/providers`; that provider-boundary defect requires a separate responsible-stage ticket and is not changed by this UXDES document.

## 17. UI handoff

The UI stage should implement the presentation component, current unsupported/continuity states, exact saved-detail copy repair, booking-context field plumbing needed for UI continuity, fixtures, and accessibility tests. Provider adapters, endpoint acquisition, provider contracting, snapshot-pipeline repair, and analytics persistence logic require a DEV-stage follow-up. No provider-contingent positive state may be connected to live data under the UI ticket without an approved normalized contract.
