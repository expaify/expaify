# UXDES-HOTEL-EV-CHARGING-01 — Hotel EV-Charging Confidence Design

Date: 2026-08-03  
Stage: UX Design  
Priority: P0  
Feature slug: `hotel-ev-charging`  
Upstream: `docs/pipeline/hotel-ev-charging/02-research.md`

> **CONDITIONAL RELEASE — POSITIVE PRODUCTION STATES ARE BLOCKED.** This document specifies the provider-neutral contract, production placements, safe fallback states, and synthetic comprehension fixtures. Current adapters cannot populate a usable EV-charging record. UI may implement the component and fixture harness, and production may render Unknown/error states, but Confirmed or Limited production facts must remain behind the provider-evidence release gate in section 16.

## 1. Design decision

Preserve the requested comparison vocabulary—**Confirmed**, **Limited**, and **Unknown**—plus a separate explicit negative, with these exact meanings:

- **Confirmed:** a named provider explicitly lists EV charging on the property and returns no material limitation. It does **not** mean unrestricted: unreturned restriction fields remain unknown. It does not mean a connector is working, open, compatible, reserved, or available for the selected dates.
- **Limited:** a named provider explicitly lists EV charging on the property and returns at least one structured material condition. The most decision-relevant condition must always appear beside the label.
- **Unknown:** usable on-property evidence is missing, failed, malformed, conflicting, or off-site only. Unknown does not mean the property has no charger.
- **No on-property charging:** a named provider explicitly reports no EV charging on the property. It is not Unknown or Limited.

Where space permits, the state heading uses `Confirmed — provider-listed on property`, not the bare word `Confirmed`. On compact results, the visible phrase is `EV charging listed on property`; “Confirmed” is retained in the normalized state and accessible name. This reduces false certainty without changing the requested architecture.

## 2. Scope and non-goals

### In scope

- A provider-neutral, bounded EV-charging evidence record.
- A compact, non-interactive signal in the active `DealCard` result.
- An EV-charging subsection in active saved-deal **Hotel fit**.
- Continuity immediately above actions in the active direct-OTA handoff.
- The same bounded record and continuity treatment in reusable `/book` hotel context.
- Default, initial loading, refresh, empty, error, malformed, conflict, off-site-only, explicit negative, Confirmed, Limited, mobile, desktop, keyboard, focus, screen-reader, and edge states.
- Synthetic comprehension fixtures, bounded analytics, and the provider-evidence release gate.

### Explicitly out of scope

- An EV filter, sort, ranking input, preference, or Deal Score change.
- Charger maps, nearby alternatives, route/range planning, charge-time estimates, or a vehicle profile.
- Live connector inventory, uptime, reservation, payment, or a compatibility guarantee.
- Parsing provider prose in UI code, inferring EV facts from parking policy, or calling a provider from a component.
- Adding charging fees to the room rate, room total, savings, or Deal Score.
- Treating omitted fields as “no restrictions,” “free,” or “available.”

## 3. Information architecture and hierarchy

### Active `DealCard`

DOM and visual order:

1. Property name, class, city, and stay window — primary identity.
2. Existing disruption and quiet-stay cues.
3. **EV-charging result signal** — secondary fit evidence.
4. Nightly price, usual price, Deal Score/savings — primary transaction evidence.
5. Photo.
6. `View deal` or existing compare action — primary action.
7. Price-check provenance.

The EV line is never an independent control. The existing whole-card link remains the only result navigation control. No nested button, tooltip, or disclosure is added.

### Saved-deal detail

Keep the existing section order. Within **Hotel fit**, insert a full-width `EV charging` subsection after the class/rating grid and before disruption and quiet-stay evidence. Facts render in this fixed order:

1. On-property status.
2. Access and reservation conditions.
3. Cost and basis.
4. Connector and power details.
5. Operator, hours, and bounded access note.
6. Source and checked time.
7. Non-live-availability boundary.

Primary hierarchy remains property/stay identity, observed nightly price, Deal Score, and provider action. The EV state is secondary decision evidence. Source, checked time, completeness, and caveat are tertiary.

### Direct-OTA handoff and `/book`

Insert an `EV charging before you continue` notice immediately above the provider action stack. It repeats the state shown in Hotel fit from the same evidence revision and gives exactly one confirmation task. It must not be placed in supporting evidence after the action.

## 4. Provider-neutral evidence contract

The implementation contract may use these names or structurally equivalent names. It belongs in shared types only after provider/DEV work is authorized.

```ts
type HotelEvChargingPresentationState =
  | 'confirmed'
  | 'limited'
  | 'unknown'
  | 'explicit_negative'

type HotelEvChargingLoadState = 'loading' | 'ready' | 'refreshing' | 'error'

type HotelEvChargingPresence =
  | 'listed_on_property'
  | 'reported_not_on_property'
  | 'not_returned'
  | 'off_site_only'
  | 'malformed'
  | 'conflicting'
  | 'unknown'

type HotelEvChargingLimitationCategory =
  | 'paid'
  | 'guest_only'
  | 'staff_or_valet_only'
  | 'reservation_required'
  | 'first_come_or_limited'
  | 'connector_limited'
  | 'power_limited'
  | 'third_party_operator'
  | 'limited_hours'
  | 'other_access_condition'

type HotelEvChargingCost =
  | { state: 'included' }
  | {
      state: 'paid'
      amount?: { priceCents: number; currency: string }
      basis?: 'per_session' | 'per_hour' | 'per_kwh' | 'per_night' | 'other'
    }
  | { state: 'unknown' }

type HotelEvChargingField =
  | { state: 'reported'; label: string }
  | { state: 'not_provided' }

type HotelEvChargingEvidence = {
  loadState: HotelEvChargingLoadState
  presentationState: HotelEvChargingPresentationState
  presence: HotelEvChargingPresence
  scope: 'property' | 'off_site' | 'unknown'
  limitationCategories: readonly HotelEvChargingLimitationCategory[]
  access: HotelEvChargingField
  reservation: HotelEvChargingField
  cost: HotelEvChargingCost
  connector: HotelEvChargingField
  power: HotelEvChargingField
  operator: HotelEvChargingField
  hours: HotelEvChargingField
  accessNote?: string
  source: { provider: string; fetchedAt?: string }
  evidenceRevision: string
}
```

### Required bounds

- `provider`, structured labels, and `evidenceRevision`: trimmed plain text, 1–80 characters.
- `accessNote`: pre-sanitized plain text, maximum 160 characters; never rendered as HTML and never parsed to infer state.
- Limitation categories: unique enum values, canonical order below, maximum 10.
- Money: integer, non-negative `priceCents` plus ISO currency; never a float or bare number.
- Dates: valid ISO instants. Invalid/missing dates render `Checked time not provided`, never “just now.”
- No raw provider payload, raw URL, coordinates, or vehicle data enters the record.

### Deterministic normalization

1. A positive requires canonical EV identifier, `scope: property`, non-empty named source, and valid fetched time. Until the release gate passes, it cannot render in production.
2. `listed_on_property` plus zero returned limitation categories becomes Confirmed. Every unreturned field still renders `Not provided by this provider`; it does not become unrestricted.
3. `listed_on_property` plus one or more material categories becomes Limited.
4. `reported_not_on_property` becomes explicit negative only when the supplier returns an explicit structured negative for on-property EV charging.
5. `not_returned`, `off_site_only`, `malformed`, `conflicting`, or `unknown` becomes Unknown.
6. Off-site-only evidence cannot be promoted to on-property presence.
7. General parking cost, reservation, access, hours, or valet fields cannot populate EV fields.
8. Duplicate evidence that disagrees on property presence becomes conflict/Unknown; recency does not select a winner in UI.
9. A missing limitation field is an unknown field, not evidence of “no limitation.”
10. Static property content never becomes selected-stay or live connector availability.
11. Invalid amount/basis drops the exact amount but preserves `paid`; visible copy becomes `Paid · amount or basis not provided`.
12. Invalid, oversized, incomplete, or mismatched handoff evidence degrades to Unknown and leaves the affiliate action usable.

### Limitation priority

Use this order for the compact primary limitation and detail rows:

1. `reservation_required`
2. `staff_or_valet_only`
3. `guest_only`
4. `first_come_or_limited`
5. `paid`
6. `connector_limited`
7. `power_limited`
8. `limited_hours`
9. `third_party_operator`
10. `other_access_condition`

Do not hide additional limitations. The result accessible name includes the primary label plus `and {n} more conditions`; detail lists all returned categories.

## 5. Shared final copy

| Element | Final copy |
|---|---|
| Detail subsection title | `EV charging` |
| Handoff title | `EV charging before you continue` |
| Live boundary | `This is property information, not real-time connector availability. expaify has not checked whether a connector is working, open, compatible, or available for your stay.` |
| Missing-field value | `Not provided by this provider.` |
| Source with time | `Source: {Provider}. Checked {MMM D, YYYY, h:mm A}.` |
| Source without time | `Source: {Provider}. Checked time not provided.` |
| Unknown source | `Source details not available.` |
| Charging-cost boundary | `Charging cost is separate from the room rate shown above.` |
| Initial loading | `Checking EV-charging details…` |
| Refresh | `Refreshing EV-charging details…` |
| Generic error | `EV-charging details could not be checked. Confirm charging location, access, cost, compatibility, and availability with the provider.` |

Use `provider lists`, `provider reports`, and `provider did not return`. Do not use `verified`, `guaranteed`, `EV ready`, `available for your stay`, `free` (use `No charging fee reported`), or `compatible` without a vehicle-specific verified contract, which is out of scope.

## 6. `DealCard` result states and copy

The line uses text plus a small decorative dot or bounded icon with `aria-hidden="true"`. State must remain understandable with color removed.

| State | Visible result copy | Whole-card accessible-name addition |
|---|---|---|
| Confirmed | `EV charging listed on property · {Provider}` | `EV charging: Confirmed, provider-listed on property by {Provider}. Restrictions and live connector availability may not have been provided.` |
| Limited, one condition | `EV charging listed · {primary condition}` | `EV charging: Limited. {Provider} lists on-property charging with this condition: {condition}. Charging availability is not live.` |
| Limited, multiple | `EV charging listed · {primary condition} +{n}` | `EV charging: Limited. {primary condition}, and {n} more conditions. {Provider} lists on-property charging. Charging availability is not live.` |
| Unknown/not returned | `EV charging details not provided` | `EV charging: Unknown. This provider did not return usable on-property charging details.` |
| Unknown/off-site only | `On-property EV charging not confirmed` | `EV charging: Unknown. The provider lists charging away from the property, not on the property.` |
| Unknown/conflict or malformed | `EV charging information unclear` | `EV charging: Unknown because provider information is conflicting or unclear.` |
| Explicit negative | `{Provider} reports no EV charging on property` | `EV charging: No on-property charging. {Provider} explicitly reports no EV charging on the property.` |
| Initial loading | `Checking EV-charging details…` | `EV charging details are loading.` |
| Error/no prior evidence | `EV-charging details could not be checked` | `EV charging: Unknown because details could not be checked.` |

Result limitation labels:

| Category | Compact label |
|---|---|
| Reservation required | `Reservation required` |
| Staff or valet only | `Staff or valet access` |
| Guest only | `Guests only` |
| First come/limited | `Limited or first come` |
| Paid, amount known | `{formatted amount} {basis}` |
| Paid, incomplete | `Paid · amount not provided` |
| Connector limited | `Connector restriction` |
| Power limited | `Charging-level restriction` |
| Limited hours | `Limited hours` |
| Third-party operator | `Third-party operator` |
| Other | `Access condition` |

Refresh does not replace known result evidence with a skeleton. Retain the existing line and append a visually hidden polite status `Refreshing EV-charging details…`. If refresh fails, retain the last-known state only when it is labeled `Previously listed by {Provider} · refresh failed`; otherwise degrade to error/Unknown. Stale evidence must never silently retain Confirmed or Limited.

## 7. Hotel fit: component anatomy

```text
section/div, aria-labelledby="…-ev-charging-title"
├── header
│   ├── h3: EV charging
│   └── textual state label
├── state summary
├── dl (fixed order)
│   ├── On-property status
│   ├── Access
│   ├── Reservation
│   ├── Cost
│   ├── Connector
│   ├── Charging level / power
│   ├── Operator
│   └── Hours
├── Reported access note (only when returned)
├── Source and checked time
└── non-live-availability boundary
```

All core fact rows remain visible; omission must not imply “none.” A disclosure may be used only for operator, hours, and access note when vertical density requires it. The status, access, reservation, cost, connector, and power remain visible without activation.

### Confirmed

- Heading label: `Confirmed — provider-listed on property`
- Summary: `{Provider} lists EV charging at this property.`
- Status row: `Listed on property by {Provider}.`
- Access/reservation/cost/connector/power/operator/hours when absent: `Not provided by this provider.`
- Boundary: shared live boundary from section 5.

Confirmed never gets a checkmark-only treatment. Unknown fields are shown even when the presentation state is Confirmed.

### Limited

- Heading label: `Limited — provider-listed with conditions`
- Summary, one: `{Provider} lists EV charging at this property with this condition: {condition}.`
- Summary, multiple: `{Provider} lists EV charging at this property with {count} reported conditions.`
- Each returned structured dimension uses the provider-normalized label.
- Missing dimensions still say `Not provided by this provider.`
- Boundary: `These conditions are provider-listed. expaify has not reserved a connector or checked live availability.`

Category detail copy:

| Category | Detail value |
|---|---|
| `reservation_required` | `Reservation required. Confirm how to reserve with the provider.` |
| `staff_or_valet_only` | `Charging access is handled by staff or valet.` |
| `guest_only` | `Reported for registered hotel guests only.` |
| `first_come_or_limited` | `Reported as limited or first come, first served.` |
| `paid`, included | `No charging fee reported by {Provider}.` |
| `paid`, exact | `{formatted amount} {basis}. Charging cost is separate from the room rate.` |
| `paid`, incomplete | `Paid. Amount or charging basis not provided.` |
| `connector_limited` | `Reported connector: {bounded connector label}. Compatibility is not confirmed.` |
| `power_limited` | `Reported charging level: {bounded power label}. Charging time is not estimated.` |
| `limited_hours` | `Reported hours: {bounded hours label}. Current access is not confirmed.` |
| `third_party_operator` | `Operated by {bounded operator label}. Provider terms may differ.` |
| `other_access_condition` | `Reported condition: {bounded normalized label}.` |

If a limitation category lacks its required label, normalize the affected field to not provided. If that makes the only claimed limitation unusable, degrade the overall record to Unknown rather than displaying bare `Limited`.

### Unknown — empty/not returned

- Heading label: `Unknown`
- Summary: `On-property EV charging has not been confirmed.`
- Body: `This provider did not return usable property information about EV charging.`
- Every fact row: `Not provided by this provider.`
- Guidance: `Confirm charging location, access, cost, compatibility, and availability with the provider before relying on it.`

### Unknown — off-site only

- Heading label: `Unknown — no on-property evidence`
- Summary: `On-property EV charging has not been confirmed.`
- Body: `The provider lists charging away from the property, not on the property.`
- Guidance: `Confirm the charger's location and access separately. Nearby charging is not a hotel amenity.`

Only use this state when `off_site` is explicit. Do not infer off-site from an address or map distance in UI code.

### Unknown — conflict/malformed

- Heading label: `Unknown — information unclear`
- Summary: `Charging information is unclear.`
- Conflict body: `Provider information disagrees about on-property EV charging. expaify is not choosing one statement as current.`
- Malformed body: `The charging information returned by the provider could not be used safely.`
- Guidance: shared generic error guidance.

Do not display a disputed positive, select a newer winner, or show conflicting raw provider prose.

### Explicit negative

- Heading label: `No on-property charging reported`
- Summary: `{Provider} reports no EV charging on property.`
- Status row: `Explicitly reported as not on property by {Provider}.`
- Other rows: `Not applicable because the provider reports no on-property EV charging.`
- Guidance: `If on-property charging is required, choose another hotel or verify that the provider's information has changed.`
- Boundary: `This is provider-reported property information, not an independent inspection by expaify.`

### Initial loading

- Visible status: `Checking EV-charging details…`
- Supporting copy: `Price and booking actions remain available while this property detail loads.`
- Use a stable `min-h` matching the ready-state summary plus two rows; skeleton bars are `aria-hidden`.
- One `role="status" aria-live="polite" aria-atomic="true"` contains the visible status.
- Completion updates the region politely and does not move focus.

### Refresh with known evidence

- Keep all known content in place.
- Add `Refreshing EV-charging details…` beside source metadata and to the polite status region.
- Set `aria-busy="true"` on the EV subsection only.
- Do not disable navigation or provider actions.
- On success, replace atomically if the revision changes. On failure, use the stale rule in section 6.

### Error with no usable evidence

- Heading label: `Unknown — check failed`
- Body: shared generic error copy.
- Rows: `Could not be checked.`
- Retry button when a supported retry exists: `Retry EV-charging check`.
- Without a supported retry, render no dead button.

Retry is secondary. It announces `Checking EV-charging details…`, remains disabled during the request, restores focus to itself after failure, and does not move focus after success.

## 8. Direct-OTA handoff final copy

The notice repeats only the selected state and one next step:

| State | Exact handoff copy |
|---|---|
| Confirmed | `{Provider} lists charging at this property. Connector availability is not live; confirm access and compatibility before you pay.` |
| Limited | `Charging has a documented condition: {primary condition}. Complete or confirm the requirement with the provider; expaify has not reserved a connector.` |
| Unknown | `On-property charging has not been confirmed. Check location, access, cost, compatibility, and availability with the provider before you pay.` |
| Explicit negative | `{Provider} reports no EV charging on property.` |
| Error/conflict | `On-property charging has not been confirmed because the information could not be used safely. Check directly with the provider before you pay.` |

When there are additional Limited conditions, add `Review {n} more reported conditions in Hotel fit.` only if that text links to the existing Hotel fit anchor. It is not a new disclosure.

Provider-action accessible names append:

- Confirmed/Limited: `Charging availability is not live.`
- Unknown/error/conflict/off-site: `On-property charging is not confirmed.`
- Explicit negative: `{Provider} reports no EV charging on property.`

Example: `Check rooms at Booking.com for Example Hotel. Opens the booking partner’s site in a new tab. Charging availability is not live.`

Invalid evidence must not block a valid attributed affiliate link. Existing affiliate markers and link validation remain unchanged.

## 9. `/book` continuity

`BookingHotelContext` carries the same bounded record, including `presentationState`, presence/scope, normalized categories and fields, source, `fetchedAt`, and `evidenceRevision`. It must not carry vendor prose or raw instructions.

- Serialization and validation round-trip the same state, provider, and revision shown on the initiating surface.
- The context size cap remains authoritative. Oversized optional access notes are dropped before the whole record is degraded.
- A missing, invalid, or mismatched revision degrades to Unknown; `/book` remains usable.
- `/book` places the EV subsection in its existing **Hotel fit** in the same position and copy as saved-deal detail.
- The handoff notice appears immediately above its external hotel-provider action with the same copy as section 8.
- If the result/detail evidence refreshes after context creation, do not silently strengthen the `/book` state. A server-resolved newer bounded record may replace it only if property/provider identity matches and the full revision is carried.

## 10. Responsive and visual specification

### Shared Tailwind/token patterns

- Section: `rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6`.
- EV inset: `min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4`.
- State heading: `text-sm font-medium leading-6 text-[color:var(--text-1)]`.
- Fact label: `text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]`.
- Fact value: `mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]`.
- Guidance/provenance: `text-xs leading-5 text-[color:var(--text-2)]`.
- Unknown/limitation panel may use `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]`; readable text remains `var(--text-1)`/`var(--text-2)`, not color alone.
- Error panel uses `bg-[color:var(--error-soft)]` and `text-[color:var(--error-text)]` only for the short state label; body remains `var(--text-2)`.
- Positive state may use `bg-[color:var(--success-soft)]` with text `var(--success)`, always alongside explicit words.
- Focus uses the global `:focus-visible`/`--focus-ring`; do not remove outlines.

### 375px

- One column throughout: `grid grid-cols-1 gap-3`.
- Result line may wrap to two or more natural lines; use `break-words`, never `truncate` or `line-clamp-*` on the limitation.
- Result line is placed outside the property identity caption so it cannot collide with stars/date.
- Keep at least 12px vertical separation before price.
- Do not reduce or displace the nightly price, Deal Score/savings, photo, or 44px action target.
- Long provider/connector labels wrap within the card; `min-w-0` on all grid/flex children prevents overflow.
- Detail fact/value pairs remain intact and in one column.
- No horizontal scrolling, hover-only content, or absolute positioning.

### 1280px

- Active feed retains its existing card grid; the EV line stays inside each card and may remain one row when it fits.
- Detail fact grid uses no more than two columns: `sm:grid-cols-2`; each `dt`/`dd` pair remains in the same cell.
- Status summary and caveat span both columns.
- Handoff copy and action remain in normal vertical order; do not place caution text beside the CTA where reading order could diverge.

### Long-content stress

Test an 80-character provider, all 10 limitations, a 160-character access note, long localized money, and 200% browser zoom. Content must wrap without clipped text, overlapping labels, action displacement, or horizontal page scroll.

## 11. Interaction, keyboard, focus, and announcements

- Result: the whole `DealCard` link retains its existing Enter activation and focus ring. EV content adds no tab stop.
- Detail: informational content is in DOM order under a heading referenced by `aria-labelledby`.
- Optional secondary-detail disclosure: native `button type="button"`, 44px minimum target, label `Show operator and access details` / `Hide operator and access details`, `aria-expanded`, and `aria-controls`. Enter and Space toggle; focus stays on the button.
- Do not use an interactive `details` inside a linked DealCard.
- Initial load, refresh, retry result, and error use one polite atomic live region. Do not announce every skeleton or every fact row.
- Provider/network failure is not an assertive alert because price/action remain usable.
- Focus never moves on background load, refresh, or evidence replacement.
- Retry preserves focus. If retry control disappears after success, focus moves to the EV subsection heading with temporary `tabIndex={-1}` only in that explicit user-triggered case.
- External provider links retain new-tab disclosure in visible or accessible copy.
- Icons are decorative (`aria-hidden`) unless their accessible name adds meaning not already in text; this design requires none.
- State is never communicated by color, icon, or position alone.

## 12. Edge and conflict rules

- Confirmed with all limitation fields missing: show Confirmed plus every key field as `Not provided by this provider`; do not say unrestricted.
- Included cost: say `No charging fee reported by {Provider}`, not `Free`.
- Paid with amount but no basis: `Paid · {amount}; charging basis not provided.` Do not calculate a stay total.
- Paid with basis but no amount: `Paid · amount not provided · {basis}.`
- Currency differs from room rate: retain provider currency and explicitly keep separate; do not convert in UI.
- Connector label without vehicle profile: repeat the label and state compatibility is not confirmed.
- Power label: never estimate time or range.
- Multiple sources agree: show the normalized record’s named authoritative source only; do not create a synthetic “verified by multiple providers” claim.
- Multiple sources disagree: Unknown/conflict even if one is newer.
- Explicit negative plus nearby/off-site positive: explicit no on-property charging remains the on-property state; off-site charging may be mentioned only as a separate off-site fact, never as Limited.
- Stale evidence: provider contract defines the TTL. After expiry, retain as `Previously listed` only during refresh; persistent refresh failure becomes Unknown for the handoff.
- Property identity mismatch across result, detail, or `/book`: discard EV record and show Unknown. Never transfer evidence by hotel name alone.
- Dates absent: no behavioral change; property evidence remains static and no selected-stay claim appears.
- No JavaScript: server-rendered known evidence and direct links remain readable; retry/disclosure enhancement may be absent.

## 13. Bounded analytics

Allowed fields only: `offer_id`, normalized `provider`, `surface`, `state`, `completeness_bucket`, enum `limitation_categories`, `viewport_group`, and `evidence_revision`. Do not emit raw instructions, URLs, coordinates, vehicle details, connector prose, or price amounts.

| Event | Trigger |
|---|---|
| `hotel_ev_charging_state_impression` | Once after 50% of result signal is visible for 500 continuous ms. |
| `hotel_ev_charging_details_opened` | Only when an EV-specific disclosure is activated; opening a whole card does not count. |
| `hotel_ev_charging_section_reached` | Once after 50% of Hotel fit EV subsection is visible for one continuous second. |
| `hotel_ev_charging_property_changed_after_review` | A reached detail is followed by return to results and opening a different property in the same search. |
| `hotel_ev_charging_handoff_continued` | Provider action after EV section reach; include bounded `confirmation_task_remaining: boolean`. |

Deduplicate by search/session + offer + surface + evidence revision. Browser abandonment is not a property change. Report behavior as `after charging review`, never `because of charging`.

Completeness buckets:

- `none`: presence unknown and every limitation field missing.
- `presence_only`: sourced on-property presence; no structured limitation dimension returned.
- `partial`: presence plus at least one structured dimension.
- `decision_ready`: presence plus explicit access, cost, reservation, and connector/compatibility statuses, including supplier-returned unknowns.
- `explicit_negative`: sourced structured negative.

There is no `live_available` bucket.

## 14. Comprehension fixtures and test harness

Synthetic fixtures must be labeled `Research fixture — not live hotel information` and must never enter production search data.

| ID | Required record | Expected visible state |
|---|---|---|
| `confirmed_presence_only` | On-property presence; all restriction fields not provided | Confirmed plus explicit unknown rows and no-live boundary. |
| `limited_paid_unknown_amount` | On property; paid; amount/basis absent | Limited · `Paid · amount not provided`. |
| `limited_reservation` | On property; reservation required | Limited · `Reservation required`. |
| `limited_multi` | Reservation, paid, guest-only, limited hours | Primary reservation plus `+3`; all four in detail. |
| `unknown_not_returned` | No usable EV fields | Unknown; missing is not negative. |
| `unknown_off_site` | Explicit off-site-only scope | Unknown; away from property. |
| `unknown_conflict` | Positive and explicit negative disagree | Unknown; no disputed positive shown. |
| `unknown_malformed` | Invalid scope/source/revision | Unknown; unsafe data not used. |
| `explicit_negative` | Structured provider negative | Separate no-on-property state. |
| `included_cost` | On property; supplier reports included | `No charging fee reported`; not `Free`. |
| `exact_cost` | USD 2500 per session | `$25.00 per session`, separate from room rate. |
| `connector_label` | `J1772` label; no vehicle | Label shown; compatibility not confirmed. |
| `initial_loading` | Loading; no prior evidence | Stable loading status. |
| `refresh_known` | Known Limited record refreshing | Limited retained with refresh status. |
| `error_empty` | Fetch failed; no prior record | Unknown/check failed and optional retry. |
| `property_mismatch` | Evidence identity differs from offer | Unknown; record discarded. |

### Moderated comprehension tasks

Use 8–10 EV drivers; counterbalance 375px and 1280px.

1. **Presence vs live availability:** show `confirmed_presence_only`. Pass only if participant says the provider lists a property charger and working/open availability for their stay is unknown.
2. **Limited vs Unknown:** show `limited_reservation` beside `unknown_not_returned`. Pass only if the known condition and missing-evidence distinction are correct.
3. **Unknown vs explicit negative:** pass only if `explicit_negative` is selected as known not to have on-property charging.
4. **Cost:** compare included, exact, and paid-unknown fixtures. Pass only if charging cost is not folded into nightly room rate and unknown cost is not calculated.
5. **Compatibility:** show connector fixture. Pass only if participant can repeat the provider label without claiming vehicle compatibility or charge time.
6. **Handoff continuity:** after Limited, ask what remains before payment. Pass only if participant names the condition and understands expaify has not reserved or checked a live connector.
7. **Five-second mobile scan:** show all four outcomes at 375px. Pass if at least three are correctly identified and no live-availability claim is invented.

Comprehension gate: at least 85% correct on **each** trust-critical task, zero participants claiming real-time availability from Confirmed/Limited, and no more than one participant treating Unknown as explicit no charging. Compare the heading `Confirmed — provider-listed on property` against `Listed on property`; if Confirmed produces more false-certainty, the production visible label must become `Listed on property` while the internal state remains `confirmed`.

## 15. UI and engineering acceptance criteria

- Active `DealCard`, not unused `HotelCard` alone, receives the compact state.
- Saved detail and `/book` place EV charging inside **Hotel fit**; both handoffs repeat it immediately above provider actions.
- Confirmed, Limited, Unknown, and explicit negative remain textually distinct.
- Every missing restriction field is visible as unknown; no omission means unrestricted.
- No copy claims working, open, reserved, compatible, or selected-stay availability.
- Initial loading, refresh-with-known, empty, error, malformed, conflict, off-site-only, stale, identity mismatch, and retry are implemented.
- Exact charging money uses integer minor units and remains separate from room price and Deal Score.
- Invalid evidence safely degrades to Unknown without blocking an attributed affiliate link.
- 375px and 1280px meet the responsive rules with no truncation, overlap, or horizontal scroll.
- DOM and screen-reader order match visible order; result has no nested control; disclosure keyboard behavior and live regions match section 11.
- Analytics are bounded and deduplicated; raw supplier prose and amounts are excluded.
- Synthetic fixtures are isolated and clearly labeled.
- Positive production rendering remains disabled until section 16 passes.

## 16. Provider-evidence release gate

### Required sample

For each intended production provider, DEV/provider validation must sample at least 100 displayed offers across at least five markets and both dated and undated contexts where applicable. Report counts and shares for:

- explicit on-property positive;
- explicit on-property negative;
- off-site only;
- malformed/conflicting;
- unknown/not returned;
- each limitation field among positives.

Manually inspect at least 20 positive records against the provider-facing property detail. If fewer than 20 positives exist, inspect the full positive census and label limitation coverage directional.

### Go conditions

All must pass:

1. At least 95% of manually inspected normalized positives match an explicit on-property EV facility.
2. 100% of positive records retain canonical identifier, property scope, named source, valid fetched time, and evidence revision.
3. Missing, malformed, conflicting, and off-site-only data deterministically degrade to Unknown.
4. Explicit negative is created only from a sampled structured supplier negative.
5. No generic parking condition is mapped to charging.
6. No record or UI copy implies real-time or selected-stay connector availability.
7. The comprehension gate in section 14 passes.

If any condition fails, do not enable production Confirmed or Limited. Keep the fixture harness and production Unknown/error fallback only; return the mapping failure to DEV/provider work. Product approval is required before any positive-state flag is enabled.

## 17. Handoff boundary

UI may implement the presentation component, responsive behavior, accessibility, safe fallback states, and isolated fixtures from this spec without inventing provider facts. Because active saved-deal snapshots and booking contexts currently do not carry EV evidence, provider normalization, snapshot persistence, API changes, server validation, and context serialization require a subsequent DEV ticket.

No UI component may call a provider, parse display prose, or synthesize Confirmed/Limited from missing data. The current provider blocker is expected and must remain visible in the implementation handoff.
