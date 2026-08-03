# UXDES-HOTEL-HOUSEKEEPING-FREQUENCY-01 — Conditional housekeeping-frequency research prototype

Date: 2026-08-03  
Stage: UX Design  
Priority: P1  
Feature slug: `hotel-housekeeping-frequency`  
Upstream: `docs/pipeline/hotel-housekeeping-frequency/01-discovery.md`, `02-research.md`  
Downstream: `UI-HOTEL-HOUSEKEEPING-FREQUENCY-01` — research prototype only

> **NARROW — RESEARCH PROTOTYPE ONLY.** This document defines a fixture-backed prototype and the conditional contract for a later production repair. It does not authorize positive or negative production housekeeping claims. Current adapters have 0% structurally usable coverage, and participant comprehension has not been tested. Research fixtures must be unreachable from production routes and production provider data.

## 1. Design decision and release boundary

For hotel stays of three or more nights, test one evidence-led decision unit named **Room cleaning during your stay**. It presents four answer groups, followed by their evidence, in a fixed order:

1. room-cleaning schedule;
2. required guest action, channel and cutoff;
3. towel refresh;
4. bed-linen change;
5. scope, source, checked time and exceptions.

The fifth item is evidence for the preceding answers, not a fifth service promise. `Housekeeping available` never appears. A cleaning schedule never supplies a towel or linen schedule unless the provider explicitly links them.

This is a repair hypothesis, not a released feature. The UI stage may build a private research harness with the nine fixtures in §7. It must not add a housekeeping filter, ranking input, Deal Score input, production result badge, live provider call, request flow, or production analytics.

### Production gates

Positive or negative production summaries remain closed until both gates pass:

- **Provider gate:** at least one contracted provider supplies an authenticated sample of 100+ offers joined to searched property, room/rate and dates. Coverage is reported separately for cleaning schedule, action, channel, cutoff, towels, linen, scope, exceptions/fees, source and freshness. At least one cadence/action combination must satisfy §5 without inference, and display/retention rights must be approved.
- **Comprehension gate:** the participant study in research §6 meets every threshold, including zero false guarantees after the full unit is read and no confidently wrong missing/error inference.

If only the provider gate passes, the returned evidence may be tested but does not ship. If only the comprehension gate passes on fixtures, no live claim ships. If a later provider check succeeds but returns no usable policy, production may show **Schedule not returned** on detail and handoff. A provider that was never queried must not be described as having returned nothing; current production therefore gains no housekeeping unit under this ticket.

## 2. Actual surfaces and hierarchy

The repo has two distinct paths. They share a formatter and evidence record; they do not share navigation.

### 2.1 Live saved-deal path — primary continuity target

```text
DealCard in /deals
└── saved-deal detail /deals/[dealId]
    ├── Property and stay                         primary identity
    ├── Price and Deal Score                      primary decision evidence
    ├── Cancellation choices                      secondary decision evidence
    ├── Hotel fit
    │   ├── Hotel class / guest rating
    │   ├── Room cleaning during your stay        new, secondary within Hotel fit
    │   ├── disruption evidence
    │   └── quiet-stay evidence
    └── Check rooms with provider
        ├── handoff limitation copy
        ├── Room cleaning during your stay        new compact continuity copy
        └── provider links                        primary action, unchanged
```

- `DealCard` receives no default `Unknown`, `Schedule not returned`, or housekeeping chip.
- The full unit belongs inside `Hotel fit`, after class/rating and before the other policy evidence.
- The compact unit is repeated inside `Check rooms with provider`, after its general provider-confirmation copy and immediately before `CompareRow`.
- Expired, invalid-context and unavailable-link behavior remains owned by the current handoff. The compact housekeeping unit may remain visible as evidence, but never enables a blocked link.

### 2.2 Normalized-offer path — separate continuity target

```text
HotelCard (currently not mounted by the live deal feed)
├── collapsed card                                no unknown cue
├── expanded Details
│   └── Room cleaning during your stay            full unit
└── Review hotel
    └── /book Hotel review
        ├── Hotel fit
        │   └── Room cleaning during your stay    full unit, same semantics
        └── provider handoff
            ├── Room cleaning during your stay    compact continuity copy
            └── Check rooms at {partner}           primary action, unchanged
```

`HotelCard` must not create a collapsed housekeeping cue in this prototype. If a later approved comparison test adds one, it may appear only for complete, currently applicable, materially differentiating evidence; that decision requires separate research.

### 2.3 Visual and semantic rank

| Rank | Content | Treatment |
| --- | --- | --- |
| Primary | Cleaning schedule or truthful evidence state | First text after the section heading; `text-sm font-medium text-[color:var(--text-1)]` |
| Secondary | Required action/cutoff; towels; bed linen | Separate sentences/rows; never merged or visually subordinated to source prose |
| Tertiary | Scope, source, checked time, verification warning | `text-xs`; visible without opening the source disclosure |
| Supporting | Exact bounded provider wording and exceptions | Collapsed disclosure after the evidence line; available before handoff |
| Primary action on handoff | Existing provider CTA/link | Unchanged; housekeeping never uses `btn-primary` |

No state is conveyed by color or icon alone. There is no `Great/Good/Typical`-style verdict and no green “confirmed” badge.

## 3. Conditional evidence contract

This is the required semantic contract for the prototype and for a later provider-backed implementation. The UI stage may locate research-only equivalents beneath a `research/` boundary; production shared types must not receive synthetic fixture defaults.

```ts
export type HotelHousekeepingLoadState = 'loading' | 'ready' | 'error'
export type HotelHousekeepingEvidenceState =
  | 'reported'
  | 'not_provided'
  | 'ambiguous'
  | 'conflicting'

export type HotelHousekeepingSchedule =
  | 'daily'
  | 'named_days'
  | 'every_n_nights'
  | 'once_during_selected_stay'
  | 'request_only'
  | 'none'
  | 'not_specified'

export type HotelHousekeepingActionMode =
  | 'automatic'
  | 'request_required'
  | 'opt_in_required'
  | 'opt_out_available'
  | 'not_specified'
  | 'ambiguous'

export type HotelHousekeepingScope = 'property' | 'room' | 'rate' | 'selected_stay'

export interface SupplierHousekeepingStatement {
  id: string
  sourceLabel: string                 // trimmed, 1–80 characters
  sourceText: string                  // exact supplier wording, trimmed, 1–300 characters
  fetchedAt: string                   // valid ISO timestamp
}

export interface HotelHousekeepingDimension {
  state: HotelHousekeepingEvidenceState
  schedule: HotelHousekeepingSchedule
  intervalNights?: number             // integer, 1–30; only every_n_nights
  serviceDays?: readonly string[]     // property-local weekday names; only named_days
  statements: readonly SupplierHousekeepingStatement[]
}

export interface HotelHousekeepingGuestAction {
  mode: HotelHousekeepingActionMode
  channel?: string                    // bounded supplier wording, 1–120 characters
  cutoff?: string                     // bounded supplier wording, 1–120 characters
  statements: readonly SupplierHousekeepingStatement[]
}

export interface HotelHousekeepingApplicability {
  scope: HotelHousekeepingScope
  propertyId: string
  roomId?: string
  rateId?: string
  checkIn?: string                    // YYYY-MM-DD
  checkOut?: string                   // YYYY-MM-DD
  nightCount?: number                 // positive integer, derived from matching dates
  stayThreshold?: string              // exact bounded supplier condition
}

export interface HotelHousekeepingPolicy {
  loadState: HotelHousekeepingLoadState
  cleaning: HotelHousekeepingDimension
  guestAction: HotelHousekeepingGuestAction
  towels: HotelHousekeepingDimension
  bedLinen: HotelHousekeepingDimension
  applicability: HotelHousekeepingApplicability
  exceptions: readonly SupplierHousekeepingStatement[]
  evidenceRevision: string
}
```

### Contract rules

- Every reported dimension carries its own statement. Do not attach one global source and silently apply it to other dimensions.
- Every supplier statement keeps exact wording, source and fetched time together. Do not display an unproven source label inherited from the rate.
- `daily`, `none` and `request_only` may be normalized only from unqualified supplier wording with the same meaning. Conditional or vague wording remains `ambiguous` and exact text leads.
- `every_n_nights` requires explicit night-based counting. `Every 2 days` is ambiguous unless the supplier defines its counting convention. It must not be rewritten as `Every 2 nights`.
- `named_days` remains named property-local days. Do not calculate which dates receive service unless property timezone and service-day association are explicit.
- `once_during_selected_stay` requires evidence tied to the selected stay. A general “once per stay” property statement remains property policy.
- Towels and bed linen never inherit the cleaning schedule. Do not introduce `same_as_cleaning` unless exact provider wording explicitly establishes that relationship; until then, copy the explicitly linked statement into each supported dimension.
- `none` is valid only from a source contract capable of explicit negative statements. Absence is `not_provided`.
- A fee remains `{ priceCents: number; currency: string }` in any later typed extension. This UI does not calculate, total or relabel it; show bounded supplier wording as an exception and defer total-price treatment to the rate-inclusions owner.
- Research fixtures use fabricated property/room/rate IDs and visibly carry `Research scenario — not live provider data` outside the participant task viewport or in the researcher controls. They are never serialized into production booking context.

## 4. Evidence validation and downgrade rules

The presentation layer receives a normalized record; it does not repair vendor data. Validation is fail-closed.

### A usable reported summary requires all of the following

1. a non-empty, bounded source statement for every displayed dimension;
2. a valid source label and ISO `fetchedAt` on that statement;
3. a matching property ID and one valid scope;
4. a schedule-specific field when required (`intervalNights` or `serviceDays`);
5. action wording only when supplied by an applicable statement; and
6. a current evidence revision carried unchanged to detail and handoff.

Selected-stay language additionally requires matching check-in, check-out and night count plus either matching room/rate identity or an explicit stay-level response. Property scope never becomes selected-stay scope because the dates happen to match.

### Downgrade matrix

| Invalid or incomplete input | Rendered result |
| --- | --- |
| Provider check succeeded; no usable housekeeping statement | `not_provided` / **Schedule not returned** |
| Vague timing, undefined counting, missing required interval/day, or conditional prose that normalization loses | `ambiguous` / **Schedule unclear** |
| Two current applicable statements disagree on schedule/action/scope and no contractual precedence rule resolves them | `conflicting` / **Housekeeping information conflicts** |
| Retrieval timeout, rejected response, malformed envelope or validation failure before a successful empty response is established | `error` / **Could not check schedule** |
| Missing source, fetched time or matching property identity on a positive/negative claim | `ambiguous`; remove the normalized positive/negative claim from all visible and accessible text |
| Room/rate statement does not match the selected room/rate | Ignore it; show the narrowest matching evidence. If only a property statement remains, label it property policy. If a matching statement disagrees with the property statement, show conflict. |
| Evidence is stale beyond a future provider-specific freshness rule | Do not reuse as current. Show a separately approved stale state in future work; this prototype falls back to check failed and exposes the stale wording only to the researcher, not the traveler. |
| Capability is absent or the provider was never checked | Render no production unit. Never say `not returned`. |

The same pure presentation result must feed the detail unit, compact handoff unit, accessible names and analytics enums. Individual components must not independently reinterpret raw policy data.

## 5. Component anatomy and final copy

Working component name: `HotelHousekeepingPolicyPanel`. Variants: `full` and `handoff`. Both use the same `HotelHousekeepingPresentation` output.

### 5.1 Full variant

Semantic order:

```text
section[aria-labelledby]
├── h3: Room cleaning during your stay
├── p: primary state/schedule
├── p: guest action, when applicable
├── dl
│   ├── Towels / independent value
│   └── Bed linen / independent value
├── p: scope + source + checked date
├── p: verification sentence
├── button: Show provider wording
└── source region, when expanded
    ├── bounded source statement(s)
    ├── exceptions, if supplied
    └── source/state clarification
```

Always-visible labels and copy:

- Heading: `Room cleaning during your stay`
- Towel label: `Towels`
- Linen label: `Bed linen`
- Unreported independent dimension: `Schedule not provided.`
- Verification for property/room/rate policy: `Check the room and rate terms with the provider before booking; service can change.`
- Verification for selected-stay policy: `The provider reported this policy for the selected stay. Service can still change.`
- Disclosure closed: `Show provider wording`
- Disclosure open: `Hide provider wording`
- Source-region heading for one statement: `Provider wording`
- Source-region heading for conflict: `Provider statements`
- Exception label: `Exceptions and conditions`

Evidence line templates:

- Selected stay: `Reported for this room and {nightCount}-night stay by {sourceLabel} · checked {displayDate}.`
- Room: `Room policy reported by {sourceLabel} · checked {displayDate}.`
- Rate: `Rate policy reported by {sourceLabel} · checked {displayDate}.`
- Property: `Property policy reported by {sourceLabel} · checked {displayDate}.`

Use an absolute, localized checked date such as `Aug 3, 2026`; do not use relative-only time. If source timestamps differ across dimensions, use: `Sources checked {earliestDisplayDate}–{latestDisplayDate}.` The disclosure identifies each statement's source/date.

### 5.2 Compact handoff variant

The compact unit repeats, in order:

1. heading `Room cleaning during your stay`;
2. the exact primary schedule/state sentence used in the full unit;
3. the exact action sentence, when present;
4. `Towels: {value}` and `Bed linen: {value}`;
5. the exact evidence line and verification sentence; and
6. `Show provider wording` disclosure.

It must use the same formatter output, not independently assembled copy. “Exact” means identical normalized strings for a given `evidenceRevision`; DOM labels may differ only by the required `Towels:` and `Bed linen:` prefixes. The provider link/CTA accessible name adds the concise primary and action sentence, followed by: `Confirm the cleaning, towel, and bed-linen terms with the provider.` It never says expaify requested or scheduled service.

### 5.3 Action copy rules

| Action evidence | Exact line |
| --- | --- |
| `automatic` | `No request is needed for the reported schedule.` |
| `request_required`, channel + cutoff | `Request through {channel} by {cutoff}.` |
| `request_required`, channel only | `Request through {channel}. The provider does not state a cutoff.` |
| `request_required`, cutoff only | `Request by {cutoff}. The provider does not state a request channel.` |
| `request_required`, neither | `The provider does not state how or when to request it.` |
| `opt_in_required` | `You must opt in before service. {bounded channel/cutoff sentence when supplied}` |
| `opt_out_available` | `The provider reports that you can decline service. {bounded channel/cutoff sentence when supplied}` |
| `not_specified` with a reported cleaning schedule | `The provider does not state whether you need to request it.` |
| `ambiguous` | No normalized action line; include the exact wording under **Schedule unclear**. |

Do not show `No request is needed` for `none`, `not_provided`, ambiguous or conflicting evidence.

## 6. Core UI states

These states apply to both variants at 375px and 1280px.

### Default / ready reported

Use the fixture-specific copy in §7. The unit is a normal evidence panel, not a success alert. The disclosure is collapsed on first view.

### Loading

- Primary line: `Checking room-cleaning policy`
- Supporting line: `We’re checking the provider for the cleaning, towel, and bed-linen schedules.`
- The region has `aria-busy="true"` and `role="status"`; do not put a live region on each skeleton row.
- Show three fixed-height skeleton lines so surrounding content does not jump. Skeletons have `aria-hidden="true"`; there is no provider wording control.
- Provider navigation remains available if the existing handoff is otherwise eligible. Loading never disables a booking-partner link.

### Empty / successful check without usable policy

- Primary line: `Schedule not returned`
- Supporting line: `This provider did not return a housekeeping schedule.`
- Towels: `Schedule not provided.`
- Bed linen: `Schedule not provided.`
- Evidence line: `Housekeeping policy checked with {sourceLabel} · {displayDate}.`
- Verification: `Check the room and rate terms with the provider before booking.`
- No retry is shown. Do not say `No housekeeping`, `Unavailable`, `Ask at check-in`, or `Daily service may apply`.

### Error / retrieval or validation failure

- Primary line: `Could not check schedule`
- Supporting line: `We could not check the room-cleaning, towel, or bed-linen schedules.`
- If retrieval is retryable, button: `Try again`.
- During retry, button label: `Checking again…`; set `disabled` and `aria-busy="true"`.
- Verification: `Check the room and rate terms with the provider before booking.`
- A failed retry keeps the same state and announces: `We still could not check the housekeeping schedule.`
- Do not show a source-returned claim or call this `not returned`.

### Ambiguous

- Primary line: `Schedule unclear`
- Supporting line: `We found housekeeping information, but it does not establish one clear schedule.`
- Evidence line and verification remain visible.
- The disclosure label is `Show provider wording`; exact bounded wording is required.
- No normalized positive or negative cadence appears anywhere, including CTA accessible text.

### Conflicting

- Primary line: `Housekeeping information conflicts`
- Supporting line: `Current provider statements do not establish one cleaning schedule. Verify before booking.`
- Towels/linen retain independently valid values only if their own statements do not conflict; otherwise each says `Information conflicts.`
- The disclosure shows at most two current applicable statements, source/date per statement, followed by `We did not choose one statement over the other.`
- No retry appears unless the conflict was produced by a refresh failure rather than two successful current statements.

### No stayover service

This is a reported evidence state, not the empty state. Exact primary line: `No stayover room cleaning is reported for this policy.` Towels and linen remain independent. Do not say the room will not be cleaned, that supplies are unavailable, or that this is confirmed for the selected stay unless selected-stay validation passes.

## 7. Nine fixture-backed research scenarios and exact copy

All fixtures use a four-night stay unless stated otherwise. `{source}` resolves to `Prototype Hotel Partner` and `{checked}` to `Aug 3, 2026`. These are synthetic research labels, not provider claims.

### F1 — automatic daily, property scope

- Primary: `Room cleaning: daily.`
- Action: `No request is needed for the reported schedule.`
- Towels: `Schedule not provided.`
- Bed linen: `Schedule not provided.`
- Evidence: `Property policy reported by Prototype Hotel Partner · checked Aug 3, 2026.`
- Verification: `Check the room and rate terms with the provider before booking; service can change.`
- Source wording: `Daily housekeeping service is provided automatically.`

Expected answer: daily automatic cleaning; towel and linen schedules unknown; property policy, not a selected-stay guarantee.

### F2 — request-only with channel and cutoff, room scope

- Primary: `Room cleaning: only when requested.`
- Action: `Request through the hotel app by 6 p.m. the day before.`
- Towels: `Schedule not provided.`
- Bed linen: `Schedule not provided.`
- Evidence: `Room policy reported by Prototype Hotel Partner · checked Aug 3, 2026.`
- Verification: `Check the room and rate terms with the provider before booking; service can change.`
- Source wording: `Stayover cleaning for this room is available on request through the hotel app by 6 p.m. the day before.`

Do not imply the request has been sent or will be accepted after the cutoff.

### F3 — separate cleaning, towel and linen rules, selected-stay scope

- Primary: `Room cleaning: every 2 nights.`
- Action: `No request is needed for the reported schedule.`
- Towels: `Available when requested.`
- Bed linen: `Changed every 4 nights.`
- Evidence: `Reported for this room and 4-night stay by Prototype Hotel Partner · checked Aug 3, 2026.`
- Verification: `The provider reported this policy for the selected stay. Service can still change.`
- Source wording 1: `For this room and stay, cleaning is scheduled after every 2 nights and bed linen after every 4 nights.`
- Source wording 2: `Fresh towels are available on request.`

The three dimensions remain separate in visible text and the accessibility tree.

### F4 — explicit no stayover cleaning, rate scope

- Primary: `No stayover room cleaning is reported for this policy.`
- Action: omitted.
- Towels: `Available when requested.`
- Bed linen: `Schedule not provided.`
- Evidence: `Rate policy reported by Prototype Hotel Partner · checked Aug 3, 2026.`
- Verification: `Check the room and rate terms with the provider before booking; service can change.`
- Source wording 1: `This rate does not include stayover room cleaning.`
- Source wording 2: `Fresh towels are available on request.`

The rate statement does not establish that cleaning is unavailable for other rates or that linen cannot be changed.

### F5 — ambiguous wording, property scope

- Primary: `Schedule unclear`
- Supporting: `We found housekeeping information, but it does not establish one clear schedule.`
- Towels: `Schedule not provided.`
- Bed linen: `Schedule not provided.`
- Evidence: `Property policy reported by Prototype Hotel Partner · checked Aug 3, 2026.`
- Verification: `Check the room and rate terms with the provider before booking; service can change.`
- Source wording: `Limited housekeeping is provided regularly during your stay.`

Do not translate `limited` or `regularly` into a cadence.

### F6 — conflicting current statements, room scope

- Primary: `Housekeeping information conflicts`
- Supporting: `Current provider statements do not establish one cleaning schedule. Verify before booking.`
- Towels: `Schedule not provided.`
- Bed linen: `Schedule not provided.`
- Evidence: `Room policy sources checked Aug 2–Aug 3, 2026.`
- Verification: `Check the room and rate terms with the provider before booking; service can change.`
- Provider statement 1: `Room cleaning is provided daily.` — `Prototype Hotel Partner · Aug 3, 2026`
- Provider statement 2: `Stayover cleaning is available every third night.` — `Prototype Property Content · Aug 2, 2026`
- Closing disclosure copy: `We did not choose one statement over the other.`

### F7 — missing after successful provider response

Use the empty-state copy in §6 exactly:

- Primary: `Schedule not returned`
- Supporting: `This provider did not return a housekeeping schedule.`
- Towels: `Schedule not provided.`
- Bed linen: `Schedule not provided.`
- Evidence: `Housekeeping policy checked with Prototype Hotel Partner · Aug 3, 2026.`
- Verification: `Check the room and rate terms with the provider before booking.`

There is no source-wording disclosure because no usable wording was returned.

### F8 — retrieval failure

Use the error-state copy in §6 exactly. The initial failure exposes `Try again`. A researcher control can resolve retry to F1 or keep F8; retry behavior must be deterministic within a study task.

### F9 — scope mismatch

Fixture: a property statement says daily cleaning, while the selected room statement says request-only. Because room is the narrower applicable scope, the concise answer is request-only; the broader difference remains visible as an exception, not silently discarded.

- Primary: `Room cleaning: only when requested.`
- Action: `The provider does not state how or when to request it.`
- Towels: `Schedule not provided.`
- Bed linen: `Schedule not provided.`
- Evidence: `Room policy reported by Prototype Hotel Partner · checked Aug 3, 2026.`
- Verification: `Check the room and rate terms with the provider before booking; service can change.`
- Applicable source wording: `Stayover cleaning for this room is available on request.`
- Exception label: `Broader property information`
- Broader wording: `The property generally provides daily housekeeping.`
- Scope clarification: `The room policy is more specific to this selection. Verify both statements with the provider.`

If the room identity does not match, do not use its statement. Render the property statement as property policy or conflict/unknown according to the remaining evidence; never promote it to this room or stay.

## 8. Responsive layout and Tailwind patterns

Use existing tokens only. No new colors, shadows, radii or type sizes.

### Full unit

Outer section:

```text
rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] p-4 sm:p-5
```

Heading: `text-sm font-medium leading-6 text-[color:var(--text-1)]`  
Primary: `mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]`  
Supporting/action: `mt-1 text-sm leading-6 text-[color:var(--text-2)]`  
Dimension grid: `mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2`  
Dimension cell: `min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3`  
Dimension label: `text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]`  
Dimension value: `mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]`  
Evidence/verification: `mt-3 text-xs leading-5 text-[color:var(--text-2)]`  
Disclosure trigger: `mt-2 inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-1 text-sm font-medium text-[color:var(--brand)]`  
Disclosure body: `mt-2 border-t border-[color:var(--border)] pt-3 text-xs leading-5 text-[color:var(--text-2)]`  
Statement: `break-words [overflow-wrap:anywhere]` with no line clamp.

### Handoff unit

```text
rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] p-4
```

Use one column at every width. At 1280px, the towel and linen rows may use `sm:grid-cols-2`, but schedule, action, evidence and verification stay full width. Do not place the evidence beside the provider CTA.

### State tones

| State | Token pattern | Rule |
| --- | --- | --- |
| Reported | neutral border/background above | No success color; “reported” is not guaranteed |
| Loading | neutral; skeleton `bg-[color:var(--bg-muted)] motion-safe:animate-pulse` | Remove animation under reduced motion |
| Not returned | neutral | Missing is not warning or failure |
| Ambiguous/conflicting | `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]` | Heading still `--text-1`; explanatory copy may use `--warning` only at compliant size/weight |
| Error | `border-[color:var(--border-strong)] bg-[color:var(--error-soft)]` | Error copy uses `--error-text`, never `--error` as text |

### 375px

- Parent page remains `px-4`; panel content width is at least 0 with `min-w-0`.
- All content is one column. No fixed width, horizontal scroll, line clamp or truncation.
- Source labels, channels, cutoffs and statements wrap with `[overflow-wrap:anywhere]`.
- Buttons and disclosure triggers have at least 44px height. `Try again` may be full width: `w-full sm:w-auto`.
- The provider actions retain their current full-width/mobile behavior and appear after the complete compact policy unit.

### 1280px

- Respect each existing surface max width; do not widen the page for this unit.
- The full unit uses two equal columns only for towels and bed linen.
- Conflicting statements remain stacked in reading order; do not create a side-by-side comparison that separates a statement from its source/date.
- The unit never becomes sticky and never competes with price or provider action.

## 9. Keyboard, focus and assistive technology

Natural tab order within either path:

1. existing page/back controls;
2. preceding page controls;
3. `Show provider wording`, when present;
4. `Try again`, only in retryable error;
5. existing provider CTA/link(s);
6. optional return-mismatch controls after a provider return.

Rules:

- Implement the wording disclosure as a native `button` with `aria-expanded` and `aria-controls`, or native `details/summary`. If a button is used, Enter/Space toggles it; Escape while focus is inside the open region closes it and returns focus to the trigger.
- Opening the disclosure leaves focus on the trigger. The newly revealed content follows immediately in DOM order and has no forced `tabindex`.
- Every trigger uses the global `:focus-visible` treatment; do not suppress the outline. Use `focus-visible:shadow-[var(--focus-ring)]` only as an additive existing pattern.
- Loading-to-ready and retry results use one `role="status" aria-live="polite" aria-atomic="true"` on the state summary. Do not announce every towel/linen row separately.
- A failed initial check must not use assertive alerting because provider handoff remains possible. A form or navigation failure elsewhere retains its existing urgency.
- `aria-labelledby` connects the section to its heading. Towels and bed linen use a real `dl`, or equally explicit text labels; do not use icons as labels.
- Provider statements are text, not images or tooltips. Quotation marks are visual punctuation, not the only indication that prose comes from the provider.
- No focus is moved when the compact handoff unit appears. Retry success remains in place; the polite live region announces the new primary state.
- At 200% zoom and 320px minimum app width, content wraps without overlap or horizontal page scrolling.

## 10. Interaction rules

### Disclosure

- Default is collapsed on each surface. Opening it on detail does not automatically open the handoff copy; the compact summary remains complete without it.
- Hide the control for F7 missing and for loading. Show it for reported, ambiguous, conflicting and any error state that retains legally displayable last-attempt wording; the F8 prototype has no last-known wording and therefore hides it.
- Cap visible conflict statements at two. If a future payload contains more, append: `{count} more provider statements are not shown. Verify the complete terms with the provider.`

### Retry

- Retry requests the same property/room/rate/dates; it never silently changes scope or provider.
- One activation disables the button until resolution. Duplicate Enter/Space/click input is ignored.
- Success replaces the whole state from one presentation object. Failure preserves F8 and uses the polite message in §6.
- If no retrieval method exists, omit `Try again`; do not render a disabled action.

### Provider handoff

- Activating the provider action does not mutate the policy, mark a request as sent, or change `reported` to `confirmed`.
- The evidence revision passed to the handoff must equal the revision shown in detail. A mismatch or missing policy context downgrades the handoff to check failed; it never retains a stale positive summary.
- The live saved-deal path repeats the compact unit before `CompareRow`. The normalized `/book` path repeats it before `Check rooms at {partner}`. They are tested separately.

### Optional return mismatch, after production analytics approval

When the document becomes visible after an activated provider link, show a non-modal inline question without moving focus:

- Heading: `Did the provider show different room-cleaning details?`
- Supporting: `Optional: tell us what differed so we can improve this information.`
- Options: `Cleaning schedule`, `Request or opt-in instructions`, `Towel schedule`, `Bed-linen schedule`, `Something else`, `No, the details matched`
- Submit: `Send feedback`
- Dismiss: `Not now`
- Success status: `Thanks. Your feedback was recorded.`
- Validation when submit has no selection: `Choose what differed, or select “No, the details matched.”`

Use a fieldset/radio group. `Not now` does not emit a mismatch. Abandonment or tab return alone is never labeled a housekeeping mismatch.

## 11. Stay-length and edge-case rules

- `nightCount >= 3`: full unit is visible by default on detail/review and repeated at handoff.
- `nightCount` of 1–2: do not infer irrelevance. In a later production implementation, place the full unit inside the existing expanded hotel details while retaining the compact handoff summary when usable evidence exists. The research tasks remain 3+ nights.
- Missing or invalid dates/night count: never use selected-stay copy. Show only valid property/room/rate policy and say `Stay dates are incomplete. Confirm which policy applies with the provider.` If there is no valid weaker-scope policy, use the appropriate missing/error state only when a check actually occurred.
- Named days: show `Room cleaning: {comma-separated provider days}.` Add `Days follow the property’s local schedule.` Do not map them to stay dates without timezone/calendar evidence.
- Exact supplier `every N days`: render **Schedule unclear** until counting semantics are proven.
- `intervalNights = 1` may render `Room cleaning: every night.` only when that exact distinction is provider-supported; do not silently translate it to daily.
- Exceptions/thresholds appear immediately after the relevant dimension and again under `Exceptions and conditions` in exact wording. Never hide an exception only in the disclosure when it changes applicability.
- Long source/channel/cutoff text is bounded by the contract and wraps. Truncation, ellipsis and hover-only full text are prohibited.
- Duplicate identical statements from the same source/revision display once. Different sources remain distinct.
- A source-name collision does not resolve a conflict; statement identity includes source, scope and revision.
- If towels or linen conflict while cleaning is clear, keep the clear cleaning primary and label only the affected row `Information conflicts.` The source disclosure exposes those statements.
- If action is ambiguous while cadence is clear, keep the cadence, omit a normalized action instruction and add: `Request instructions are unclear; verify them with the provider.`
- Fees, cleanliness, sanitation, staff entry, privacy suitability, performance and fulfillment are outside this component.

## 12. Research harness specification

The UI-stage artifact is a private fixture-backed route or Storybook-equivalent harness that is not linked from product navigation, excluded from production imports, and protected by the repo’s established research-fixture convention. It contains:

- viewport selector labels `375px mobile` and `1280px desktop`;
- variant controls `A — summarized dimensions` and `B — provider wording first`;
- all nine fixture labels from §7 for the researcher only;
- surface controls `Saved-deal detail`, `Saved-deal handoff`, `HotelCard details`, and `Hotel review handoff`;
- loading and retry transitions for F8; and
- a reset control labeled `Reset scenario`.

Participant task frames must not expose the fixture name, expected answer, evidence-state enum or “synthetic” label before the participant responds. The harness shell must still visibly state `Research prototype — policies shown here are fictional` outside screen recordings used as participant stimuli, and the consent script must state the same limitation.

Variant B changes only source-order presentation: exact provider wording appears before the normalized rows, while the same state heading, scope label and verification remain. It does not change underlying evidence or task order.

No fixture may be imported by `app/deals`, `app/components/HotelCard.tsx`, `app/book`, `lib/providers`, `lib/booking/config.ts`, search APIs or saved-deal data access. A static dependency test must enforce that boundary.

## 13. Conditional analytics contract

The research harness records study answers outside production analytics. The following events are conditional on production approval and server allowlist tests; UI work under this ticket must not emit them.

| Event | Required non-sensitive enums |
| --- | --- |
| `hotel_housekeeping_policy_viewed` | `surface: saved_detail|saved_handoff|offer_detail|review_handoff`; `evidence_state: reported_selected_stay|reported_policy|ambiguous|conflicting|not_returned|check_failed`; `scope: property|room|rate|selected_stay|none`; `stay_length: 1_2|3_4|5_7|8_plus|unknown`; `coverage: cleaning_only|cleaning_action|cleaning_towels|cleaning_linen|all_four|none`; `viewport_band: mobile_375|desktop_1280|other` |
| `hotel_housekeeping_details_opened` | same context; `action: opened|closed` |
| `hotel_housekeeping_handoff_started` | same context; allowlisted provider category, never source prose |
| `hotel_housekeeping_return_mismatch` | same context; `reason: different_schedule|different_action|different_towels|different_linen|other|matched` |

Never send property prose, channel/cutoff text, hotel name, exact dates, URL, personal data or participant confidence. One view per evidence revision/surface. Verify accepted and rejected payloads against `app/api/analytics/route.ts` before enabling any event; existing unrelated validator mismatches are not repaired here.

## 14. Acceptance criteria

### Contract and truthfulness

- All nine fixtures render the exact copy and hierarchy in §7.
- Missing, ambiguous, conflict, loading and failure are textually distinct.
- Missing contains no positive/negative service inference; failure never says the provider returned nothing.
- Towels and bed linen can change independently without changing cleaning or one another.
- Property/room/rate copy never says `for your stay`; selected-stay copy requires matching identifiers and dates.
- Invalid provenance removes all normalized positive/negative claims from visible and accessible text.
- No copy uses `guaranteed`, `we requested`, `request sent`, `daily` from a generic amenity, or a chain/property-type inference.

### Continuity

- For each fixture, detail and its immediate handoff receive the same evidence revision and formatted strings.
- The saved-deal path and normalized-offer path are tested independently.
- Missing/conflict/error survives unchanged into handoff.
- Provider action remains available or blocked solely by existing handoff eligibility; housekeeping does not alter it.
- No result-card unknown chip is added.

### Responsive and accessibility

- At 375px and 1280px, all source/action/schedule text wraps without clipping, overlap or horizontal scroll.
- At 375px, the unit is one column; at 1280px only towel/linen rows may form two columns.
- Keyboard users can reach, open and close source wording; Escape restoration works for the button implementation.
- Focus remains visible; targets are at least 44px; retry cannot submit twice.
- Loading/retry changes are announced once politely, and no source text is hidden in a tooltip.
- State remains understandable with CSS color disabled and at 200% zoom.

### Isolation and quality

- Research fixtures have no import path into production routes/providers/booking context.
- No production analytics event is added before allowlist tests.
- `npx tsc --noEmit --incremental false` exits 0.
- `npm test -- --passWithNoTests` exits 0.

## 15. Participant decision gate

Test 10–12 first-time expaify users who booked a 3+ night hotel stay in the prior year, randomized across variants and both viewports. Ask cleaning cadence, action/cutoff, towel rule and linen rule before confidence. Record the research thresholds from `02-research.md` unchanged:

- at least 80% fully correct on all four dimensions for each explicit core scenario;
- at least 80% correct scope comprehension per scoped scenario;
- at least 90% correct across missing and failure, with zero high-confidence false service claims;
- median answer time no more than 25 seconds for explicit scenarios at each viewport;
- zero service/request guarantees after the full unit is viewed; and
- decision reason matches evidence state in at least 80% of tasks.

Report confidence as a 2×2 calibration table: correct/high, correct/low, incorrect/low and incorrect/high. Do not average away the confidently wrong cell. Failure of any gate keeps all production positive/negative schedule claims closed.

## 16. Out of scope and handoff

Out of scope: provider/content integration; scraping; service requests or scheduling; a housekeeping filter, comparison chip or ranking input; Deal Score changes; cleanliness or sustainability claims; notifications; pricing/fee calculations; analytics-validator repair; and unifying the saved-deal and normalized-offer navigation paths.

`UI-HOTEL-HOUSEKEEPING-FREQUENCY-01` may implement only the isolated research harness, presentation component variants, fixtures and tests described here. It must not wire synthetic or unverified policy data into live saved deals, `HotelCard`, `/book`, providers or analytics. A later APPROVED FEATURE plus both release gates is required for production wiring and provider/data work.

Current blockers carried forward:

- no normalized housekeeping type or continuity field in production;
- 0% structurally usable adapter and saved-deal coverage;
- no authenticated provider sample or contractual display/retention assessment;
- no participant comprehension evidence; and
- existing analytics validator mismatches outside this ticket.
