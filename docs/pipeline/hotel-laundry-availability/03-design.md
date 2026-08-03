# UXDES-HOTEL-LAUNDRY-AVAILABILITY-01 — Hotel Laundry Availability Validation Design

Date: 2026-08-03  
Stage: UX Design (UXDES)  
Priority: P1  
Feature slug: `hotel-laundry-availability`  
Upstream: `docs/pipeline/hotel-laundry-availability/01-discovery.md`, `docs/pipeline/hotel-laundry-availability/02-research.md`

> **DEFER — VALIDATION ONLY / NOT SHIP-READY.** The current product path has 0% representable laundry coverage, and no observed comprehension study has passed. This document authorizes only a controlled, synthetic research prototype. It does not authorize a production component, shared type, provider request, database change, analytics change, result cue, filter, rank signal, Deal Score input, or provider handoff. Do not create a production UI or DEV ticket until both gates in §15 pass and Product explicitly approves reopening.

## 1. Design Decision And Validation Objective

Create a product-shaped prototype that tests whether a first-time traveler can correctly distinguish:

1. **Self-service machines on the property** — guest-operated machines explicitly reported at the hotel.
2. **Hotel laundry service** — a hotel-managed laundry or dry-cleaning service, kept separate from self-service.
3. **Nearby laundry option** — a provider-identified off-property option, without an inferred distance, endorsement, or current availability.
4. **Mode-specific unavailability** — an explicit provider negative for one named mode, without turning other missing modes into unavailable.
5. **Evidence that cannot support a claim** — not returned, generic/unrecognized, conflicting, loading, or retrieval error.

The prototype must preserve overlapping modes. A property can report both self-service machines and a hotel-managed service; the interface never selects one “best” laundry label.

The validation outcome is factual comprehension followed by a safe `keep`, `rule_out`, or `verify` decision. `Verify` is a successful, expected outcome for unknown, unrecognized, conflicting, nearby-with-insufficient-practical-detail, and retrieval-error states. Confidence is measured only after factual answers.

## 2. Current Product Behavior While Deferred

- `/deals` receives no laundry chip, badge, icon, filter, sort, card gap, or accessible-only label.
- `/deals/[dealId]` receives no production laundry block.
- `HotelCard`, `HotelOffer`, `HotelAmenityEvidence`, `HotelProvider`, saved-deal persistence, and provider adapters remain unchanged.
- No production lookup, cache entry, analytics event, database column, affiliate link, or hotel-contact action is added.
- Existing property/stay, price, Deal Score, Hotel fit, provider handoff, and supporting-evidence order remains unchanged.
- Five or more nights remains a research cohort, not a condition for showing or hiding evidence.

## 3. Prototype Boundary

Any later prototype implementation may create only an isolated research route or harness, fixture module, renderer, and colocated tests. It must be unreachable from normal navigation and must not import into a production page, provider, cache, database helper, saved-deal mapper, or booking flow.

Use synthetic hotel, provider, record, and destination identities. Fixtures must not call a vendor, scrape text, reuse reviews, open a real affiliate destination, or claim to represent a live property. The provider-shaped continuation control targets an inert local study step.

Every screen and capture displays:

`Research prototype — laundry information is not part of hotel ranking or Deal Score.`

The prototype uses stays of five or more nights for at least eight participants and shorter stays for at least two participants. The UI itself does not change by stay length.

## 4. Evidence Model For Research Fixtures

This is a research-only presentation contract, not a proposed change to `lib/types.ts`.

```ts
type PrototypeLaundryMode =
  | 'self_service_on_property'
  | 'hotel_laundry_service'
  | 'nearby_option'

type PrototypeLaundryModeState =
  | 'reported'
  | 'explicitly_unavailable'
  | 'not_returned'
  | 'conflicting'

type PrototypeLaundryEvidenceState =
  | 'reported'
  | 'not_returned'
  | 'unrecognized'
  | 'conflicting'

type PrototypeLaundryModeEvidence = {
  mode: PrototypeLaundryMode
  state: PrototypeLaundryModeState
  scope: 'property' | 'nearby'
  fee: 'included' | 'paid' | 'unknown'
  sourceLabel: string
  providerRecordId: string
  fetchedAt?: string
  qualifiers?: readonly string[]
}

type PrototypeHotelLaundryEvidence = {
  loadState: 'loading' | 'ready' | 'error'
  evidenceState: PrototypeLaundryEvidenceState
  modes: readonly PrototypeLaundryModeEvidence[]
  unrecognizedProviderTerms?: readonly string[]
  evidenceRevision: string
}
```

### Resolver invariants

- `reported` requires a recognized provider id, valid mode, valid scope, non-empty source label, provider record id, and a mode state of `reported` or `explicitly_unavailable`.
- Multiple non-conflicting mode records render together. A managed service never replaces self-service, and a nearby option never replaces an on-property mode.
- `self_service_on_property` requires explicit evidence of guest-operated machines at the property. A generic `washer`, `dryer`, `laundry`, room description, photo, review, brand, or property type is insufficient.
- `hotel_laundry_service` requires an explicitly identified managed laundry or dry-cleaning service. It never implies guest access to machines.
- `nearby_option` requires a recognized laundry record with explicit off-property/nearby scope from the provider. It never implies distance, directions, endorsement, opening hours, capacity, or selected-stay availability.
- An omitted facility becomes `not_returned`, never `explicitly_unavailable`.
- A generic or unmapped provider term becomes overall `unrecognized`; it cannot populate a recognized positive or negative mode.
- Conflicting records remain attributable in the fixture for audit, but the traveler-facing summary chooses neither statement.
- An explicit negative applies only to its named mode. Other absent modes remain `not_returned`.
- `paid` renders only when attached to the relevant provider record. An omitted fee becomes `unknown`, never `included`.
- No fixture contains a laundry price or turnaround time. The renderer has no price or turnaround field.
- Provider-supported access restrictions or schedules may appear only as bounded, pre-sanitized synthetic qualifiers. The UI does not parse qualifiers to infer mode, fee, availability, or a decision.
- A room-level washer does not become shared self-service machines; it is unsupported by this prototype vocabulary and resolves to `unrecognized` unless a future approved model adds a separate mode.
- Every ready fixture has one immutable `evidenceRevision`. A malformed or unsupported state safely resolves to error, never to a positive or negative claim.

## 5. Information Architecture And Hierarchy

The study uses a product-shaped hotel deal-detail page in this order:

1. Property and stay
2. Price and Deal Score
3. Hotel fit, containing the prototype `Laundry options` block after existing fit evidence
4. Check rooms with provider
5. Supporting evidence

The laundry block is encountered before the inert provider continuation. It is not repeated at handoff, placed in Deal Score, or shown on results.

Within `Laundry options`, DOM and visual order are identical:

1. Research label
2. `h3`: `Laundry options`
3. Overall state heading and summary
4. One row for each supported or explicitly unavailable mode
5. `What remains unconfirmed`
6. `How this was reported` disclosure, when auditable records exist
7. Verification/non-guarantee boundary

Hierarchy:

- **Primary:** named modes, their property/managed/nearby scope, and explicit mode-specific unavailable text.
- **Secondary:** fee state and what remains unconfirmed.
- **Tertiary:** source, observation time, provider-supported qualifiers, evidence boundary, and research label. Tertiary does not mean hidden or low contrast.

Price and Deal Score remain the page’s primary transactional evidence. Laundry is secondary hotel-fit evidence. The outbound provider control remains the primary action.

## 6. Component Anatomy

Research component working name: `HotelLaundryAvailabilityPrototype`.

```text
section, aria-labelledby
├── research label
├── h3: Laundry options
├── state heading
├── state summary
├── ul: mode rows
│   └── mode name → scope → availability → fee
├── What remains unconfirmed
├── button: How this was reported (when records exist)
│   └── source records, observed time, qualifiers
└── evidence boundary
```

Minimum decision evidence is never hidden in the disclosure. Mode, scope, availability, fee state, unknowns, and verification guidance remain visible. The disclosure contains only provenance, observation time, provider record attribution, and bounded qualifiers.

Do not use checkmarks, crosses, washing-machine art, amenity pills, success badges, or color as the only state carrier. Do not label the group `Amenities`; the narrower title prevents a generic positive interpretation.

## 7. Final Copy System

### Fixed copy

| Element | Final copy |
| --- | --- |
| Prototype label | `Research prototype — laundry information is not part of hotel ranking or Deal Score.` |
| Section title | `Laundry options` |
| Remaining heading | `What remains unconfirmed` |
| Disclosure closed | `How this was reported` |
| Disclosure open | `Hide reporting details` |
| Boundary | `Provider-reported information; it does not reserve or guarantee a laundry option for this stay.` |
| General verification | `Confirm current access, charges, and practical details with the hotel or booking provider before relying on an option.` |
| Source with date | `Source: {sourceLabel}. Observed {Month D, YYYY}.` |
| Source without date | `Source: {sourceLabel}. Observation date not provided.` |
| Provider record | `Provider record: {providerRecordId}.` |

`Observed` means when the evidence was retrieved; it does not claim that the hotel changed or reconfirmed the information on that date.

### Mode names and scopes

| Mode | Visible name | Scope line |
| --- | --- | --- |
| `self_service_on_property` | `Self-service machines` | `Guest-operated machines reported on the property.` |
| `hotel_laundry_service` | `Hotel laundry service` | `A hotel-managed laundry or dry-cleaning service is reported.` |
| `nearby_option` | `Nearby laundry option` | `The provider identifies an option off the property.` |

Never shorten these to `Laundry`, `On-site laundry`, or `Available`; those labels erase mode or ownership.

### Mode availability and fee copy

| Returned state | Final copy |
| --- | --- |
| Mode reported | `{modeName} is reported.` |
| Mode explicitly unavailable | `{modeName} is reported unavailable.` |
| Mode not returned | `This provider did not return information about {modeNameLower}.` |
| Mode conflicting | `Provider records disagree about {modeNameLower}.` |
| Fee included | `No separate fee is reported for this option.` |
| Fee paid | `A fee is reported; the amount was not provided.` |
| Fee unknown | `The provider did not specify whether a fee applies.` |
| Fee on unavailable mode | `Fee does not apply to this unavailable-mode statement.` |

The included copy deliberately avoids `Free`. The prototype does not contain a price, currency, price placeholder, estimated range, turnaround, “same day,” or “24-hour” claim.

## 8. Ready-State Specifications

### 8.1 Default: self-service only

Fixture: self-service reported on property; fee unknown; other modes not returned.

| Element | Final copy |
| --- | --- |
| Heading | `Self-service machines are reported on the property` |
| Summary | `The provider identifies guest-operated machines at this hotel.` |
| Self-service row | Scope copy, then `Self-service machines are reported.` Then `The provider did not specify whether a fee applies.` |
| Remains unconfirmed | `Machine access, current availability, operating details, and any fee remain unconfirmed. The provider did not return a hotel laundry service or nearby option.` |

Expected decision: `keep` if this answers the assigned need and unknown practical details are acceptable; otherwise `verify`.

### 8.2 Managed service only, paid

| Element | Final copy |
| --- | --- |
| Heading | `A hotel laundry service is reported` |
| Summary | `This is a hotel-managed service, not evidence of guest-operated machines.` |
| Service row | Scope copy, then `Hotel laundry service is reported.` Then `A fee is reported; the amount was not provided.` |
| Remains unconfirmed | `Price, turnaround, service access, and availability for this stay remain unconfirmed. The provider did not return self-service machines or a nearby option.` |

Expected decision: `verify` or `rule_out` for a hard self-service requirement; `keep` or `verify` when a paid managed service is acceptable.

### 8.3 Nearby option only

| Element | Final copy |
| --- | --- |
| Heading | `A nearby laundry option is reported off the property` |
| Summary | `The provider identifies an off-property option. It is not a hotel-managed service.` |
| Nearby row | Scope copy, then `Nearby laundry option is reported.` Then the returned fee-state copy. |
| Remains unconfirmed | `Distance, directions, hours, access, current availability, and any unreported fee remain unconfirmed.` |

Expected decision: `verify`. The prototype provides no map, link, distance, or directions action.

### 8.4 Overlapping modes

Fixture: self-service reported with fee unknown; managed service reported paid; nearby not returned.

| Element | Final copy |
| --- | --- |
| Heading | `Two laundry options are reported` |
| Summary | `The provider reports self-service machines and a separate hotel-managed service.` |
| Rows | Show the complete self-service row first and managed-service row second; do not merge fee states. |
| Remains unconfirmed | `Current access and availability remain unconfirmed. A fee is reported for the hotel service, but its amount and turnaround were not provided. The provider did not return a nearby option.` |

If all three modes are reported, heading copy is `Three laundry options are reported`; order remains self-service, hotel service, nearby.

### 8.5 Mixed positive and mode-specific unavailable

Fixture: self-service explicitly unavailable; managed service reported paid; nearby not returned.

| Element | Final copy |
| --- | --- |
| Heading | `Self-service is unavailable; a hotel service is reported` |
| Summary | `The provider returned different evidence for two separate laundry modes.` |
| Self-service row | Scope copy, then `Self-service machines are reported unavailable.` Then unavailable fee copy. |
| Service row | Scope copy, then reported and paid copy. |
| Remains unconfirmed | `The hotel-service price, turnaround, access, and availability for this stay remain unconfirmed. The provider did not return a nearby option.` |

The positive service does not cancel the self-service negative. Expected decision is `rule_out` when self-service is required; otherwise `keep` or `verify` according to fee tolerance.

### 8.6 One explicit unavailable mode, other modes unknown

| Element | Final copy |
| --- | --- |
| Heading | `{ModeName} is reported unavailable` |
| Summary | `This explicit statement applies only to {modeNameLower}. It does not establish whether other laundry options exist.` |
| Unavailable row | Use mode-specific scope, unavailable, and fee-not-applicable copy. |
| Remains unconfirmed | `This provider did not return information about {the two other modes}.` |

Never render `No laundry available` unless an approved future provider contract supplies explicit negatives for every supported mode. That all-negative fixture is not required for the current study because current reference sources do not establish that capability.

## 9. Unknown, Conflict, Loading, And Error States

### 9.1 Not returned / empty

| Element | Final copy |
| --- | --- |
| Heading | `Laundry information was not provided` |
| Summary | `This provider did not return information about self-service machines, a hotel laundry service, or a nearby option.` |
| Remains unconfirmed | `This does not mean laundry is unavailable. Verify directly before relying on an option.` |

Render no fake mode rows and no source disclosure. Use neutral styling. Expected decision: `verify`.

### 9.2 Generic or unrecognized evidence

| Element | Final copy |
| --- | --- |
| Heading | `The laundry type is unclear` |
| Summary | `The provider returned a general laundry label that does not identify self-service machines, a hotel-managed service, or a nearby option.` |
| Remains unconfirmed | `The laundry mode, location, access, fee, and availability for this stay remain unconfirmed.` |

In reporting details, show `Provider term: “Laundry”.` as bounded synthetic evidence. Do not expose arbitrary live text. Expected decision: `verify`.

### 9.3 Conflicting evidence

| Element | Final copy |
| --- | --- |
| Heading | `Laundry information conflicts — verify before relying on it` |
| Summary | `The available provider records do not agree. We are not choosing one statement as current.` |
| Affected row | `Provider records disagree about {modeNameLower}.` |
| Unaffected row | Use its normal reported or explicitly unavailable copy only if its record is independently valid. |
| Remains unconfirmed | `The conflicting mode cannot support an availability or unavailability decision.` |

The disclosure lists both synthetic source labels, observations, and bounded statements. It never marks a winner, uses recency to select one, averages records, or shows a success treatment. Expected decision: `verify`.

### 9.4 Loading

The section title, research label, and stable container remain visible. Decision rows are replaced with three decorative skeleton lines.

| Element | Final copy |
| --- | --- |
| Heading | `Checking laundry information` |
| Summary | `We’re checking provider-reported laundry modes and fee details.` |
| Live status | `Checking laundry information.` |

Set the section `aria-busy="true"`; use `role="status" aria-live="polite" aria-atomic="true"` on the text status; hide skeletons with `aria-hidden="true"`. Loading does not disable or delay the inert provider continuation. A participant continuing while loading is recorded as unexposed, not as having reviewed laundry evidence.

### 9.5 Retrieval error

| Element | Final copy |
| --- | --- |
| Heading | `Laundry information could not be checked` |
| Summary | `We couldn’t retrieve provider-reported laundry information. This does not mean laundry is unavailable.` |
| Guidance | `Verify directly before relying on a laundry option.` |
| Retry | `Try laundry check again` |
| Retrying | `Checking laundry…` |
| Repeated failure | `Laundry information still could not be checked.` |

Initial error is a polite status. A failed participant-initiated retry is an alert. Retry changes only the fixture; it makes no external request. Loading and error are not the same as a successful not-returned response. Expected decision: `verify`.

## 10. Disclosure, Keyboard, And Focus Rules

### Reporting-details disclosure

- Use a native `button`, not a clickable heading or custom link.
- The button has `aria-expanded` and `aria-controls`; its visible label changes between the fixed closed/open copy.
- Pointer click, `Enter`, and `Space` toggle it. Opening does not move focus.
- Closing by the same control leaves focus on that control. `Escape` while focus is inside the disclosure closes it and returns focus to the disclosure button.
- Source records are a semantic list. Long provider labels, ids, and qualifiers use wrapping; none are truncated when truncation would change meaning.
- The disclosure contains no vendor link, review, price, contact control, or additional nested disclosure.

### Retry

- `Enter`, `Space`, or pointer activation begins retry.
- While retrying, set `disabled`, `aria-disabled="true"`, and section `aria-busy="true"`; announce `Checking laundry…` once.
- On success, focus the updated state heading using `tabIndex={-1}`. On repeated failure, focus the repeated-failure message and announce it with `role="alert"`.
- Retry does not block the study continuation.

### Research answer controls

Factual questions appear after the participant has inspected the hotel surface. Each question uses a `<fieldset>` and `<legend>` with native radio inputs. Decision choices are:

- `Keep this hotel`
- `Rule out this hotel`
- `Verify laundry details`

`Continue` remains disabled until required factual and decision responses are selected. If activated through an unexpected path while incomplete, move focus to the first unanswered legend and show `Choose an answer before continuing.` Do not reveal the expected answer before submission. Confidence is collected on the next step.

## 11. Responsive Layout

### Mobile — 375px

- Keep the existing page as one column; the laundry block stays inside `Hotel fit` in normal document flow.
- Use full-width rows stacked vertically. Do not place mode and fee in competing columns.
- Container padding is `p-4`; internal vertical gaps use `mt-2`, `mt-3`, and `space-y-3`.
- Disclosure and retry controls have at least a 44px target and are full width when shown.
- The inert provider continuation remains full width below Hotel fit; no sticky panel or overlap is introduced.
- Hotel, provider, record-id, qualifier, and state strings use `min-w-0 break-words`; no horizontal scroll, ellipsis, or clipped evidence.

### Desktop — 1280px

- Preserve the current centered deal-detail width and section sequence; do not add a side rail.
- Mode rows may use `sm:grid-cols-2` when there are two or more records. Each mode remains an intact card; never split a mode name from its fee.
- A third mode occupies the next grid position rather than stretching or reordering.
- Overall summary, unknowns, disclosure, and boundary span the full group width.
- DOM order remains self-service, managed service, nearby regardless of visual wrapping.

### Zoom and long content

The prototype remains usable at 200% browser zoom and down to the app’s 320px minimum. Provider qualifiers are capped at three visible items and 160 sanitized characters each in fixtures. Extra fixture qualifiers produce: `Additional provider details were returned; verify them before booking.` This is a prototype safety constraint, not permission to discard future production evidence.

## 12. Tailwind And Design-Token Specification

Use only tokens already defined in `app/globals.css`; add no color, radius, type, or shadow token.

### Base container

```text
rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] p-4 sm:p-5
```

### State treatments

| State | Tailwind pattern |
| --- | --- |
| Reported single or overlapping modes | `border-[color:var(--border-strong)] bg-[color:var(--bg-surface)]` |
| Mixed reported + explicit unavailable | `border-[color:var(--gold)] bg-[color:var(--warning-soft)]` |
| Mode-specific unavailable only | `border-[color:var(--gold)] bg-[color:var(--warning-soft)]` |
| Not returned | `border-[color:var(--border)] bg-[color:var(--bg-muted)]` |
| Unrecognized | `border-[color:var(--gold)] bg-[color:var(--warning-soft)]` |
| Conflicting | `border-[color:var(--error)] bg-[color:var(--error-soft)]` |
| Loading | `border-[color:var(--border)] bg-[color:var(--bg-surface)]` |
| Error | `border-[color:var(--error)] bg-[color:var(--error-soft)]` |

Use `var(--error)` only for border/fill; error text uses `text-[color:var(--error-text)]`. Headings always use `text-[color:var(--text-1)]`. State meaning remains in visible text.

### Type, rows, and controls

```text
research label: text-caption font-medium leading-5 text-[color:var(--text-3)]
section title: mt-2 text-xl font-medium text-[color:var(--text-1)]
state heading: mt-3 text-sm font-medium leading-5 text-[color:var(--text-1)]
body: mt-1 text-sm leading-6 text-[color:var(--text-2)]
mode list: mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2
mode row: min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3
metadata: text-caption leading-5 text-[color:var(--text-3)]
divider: mt-4 border-t border-[color:var(--border)] pt-4
skeleton: skeleton h-3 rounded-[var(--radius-pill)]
disclosure/retry: btn btn-outline btn-sm min-h-11 w-full sm:w-auto
```

No decorative icon is required. If the existing button class already supplies a focus appearance, retain it; do not remove or replace the global focus outline.

## 13. Accessibility Requirements

- Use semantic `section`, headings, `ul`/`li`, and a button-controlled disclosure. Mode rows may use `dl`/`dt`/`dd` within each item.
- Derive unique ids from synthetic hotel id and fixture id. Never duplicate ids when the harness shows control and variant together.
- The accessible section name is `Laundry options`; do not replace visible semantics with a long `aria-label`.
- Announce `reported unavailable`, `not provided`, `unclear`, and `conflicts` in text. Do not use icon, position, or color alone.
- Skeletons are hidden from assistive technology. Ready content is not placed in a live region; only asynchronous status changes are announced.
- Tab order follows DOM order: existing page controls → optional reporting disclosure → optional retry → provider-shaped study continuation → research answers.
- Focus-visible styling uses the global `--focus-outline` and `--focus-ring`. Never use `outline-none` without an equivalent visible focus treatment.
- Text, controls, and state boundaries must meet WCAG AA contrast with the current tokens and remain legible at 200% zoom.
- Synthetic provider strings are sanitized plain text. Strip markup, bidirectional control characters, and line-break injection before rendering fixtures.

## 14. Required Fixture Matrix

Every fixture must render independently. All names and records are synthetic.

| Fixture id | Overall state | Mode records | Fee | Research purpose |
| --- | --- | --- | --- | --- |
| `self-service-only` | Reported | Self-service reported; others not returned | Unknown | Correct on-property/self-service reading |
| `managed-paid` | Reported | Managed service reported; others not returned | Paid, no amount | Service is not machines; paid is not known price |
| `managed-fee-unknown` | Reported | Managed service reported | Unknown | Omitted fee is not free |
| `nearby-only` | Reported | Nearby reported; others not returned | Unknown | Off-property without distance/endorsement inference |
| `self-service-and-managed` | Reported | Both reported | Separate unknown/paid | Preserve overlap and separate fees |
| `all-three-modes` | Reported | All three reported | Separate fee states | Scan order and no collapsed label |
| `self-service-unavailable-managed-reported` | Reported | Self-service unavailable; managed reported | N/A / paid | Mode-specific negative with valid overlap |
| `self-service-unavailable-only` | Reported | Self-service unavailable; others not returned | N/A | Unknown other modes are not unavailable |
| `not-returned` | Not returned | None | — | Empty/unknown is not unavailable |
| `unrecognized-generic` | Unrecognized | Synthetic term `Laundry` only | — | Generic label cannot become a mode |
| `conflicting-self-service` | Conflicting | Opposing self-service records | Unknown | Verify; choose neither source |
| `loading` | — | — | — | Async status without blocking handoff |
| `error` | — | — | — | Retrieval failure differs from empty |
| `malformed-record` | Safe error | Missing source or invalid scope | — | Fail closed without inventing a claim |

Required qualifier variants: one reported schedule, one guest-access restriction, and one overlong sanitized qualifier set. Qualifiers must not change the mode resolver or introduce price/turnaround copy.

## 15. Two-Gate Ship-Or-Defer Decision

### Current outcome: DEFER

Both gates fail today. A study-ready prototype is not production-ready UI.

### Gate 1 — provider coverage and normalization

Audit at least 500 contractually usable hotel-detail payloads across at least 10 markets, including at least 150 offers searched for stays of five or more nights. De-duplicate by provider property id and report short- and long-stay cohorts separately.

Pass only if all are true:

- At least 40% contain one or more recognized, safely scoped laundry modes that survive `lib/providers` normalization with source and observation time when supplied.
- Self-service, managed service, and nearby are measured separately; overlaps are reported.
- Complete, partial, conflicting, explicitly unavailable, generic/unrecognized, and not-returned outcomes are independently counted.
- A manual audit of at least 100 stratified records reaches at least 95% exact agreement on mode + scope + state and has **zero false-positive availability claims**.
- Missing facilities never normalize to unavailable; generic laundry never normalizes to a specific mode.
- `paid` appears only on its provider record; omitted fee becomes unknown.
- The saved-deal path retains the same evidence revision shown on detail rather than re-fetching or strengthening it at render time.

The 40% threshold is a research launch gate, not an industry benchmark or evidence that unknown states should be hidden.

### Gate 2 — observed comprehension and decision value

Run a moderated study with 10–12 first-time or infrequent hotel-comparison users. At least eight evaluate stays of five or more nights; at least two evaluate shorter stays. Include people who require self-service, accept any mode, and are fee-sensitive.

Each participant sees balanced examples of self-service only, managed only with paid and unknown-fee variants, nearby only, overlap, mode-specific explicit unavailability, generic/unrecognized, not returned, and conflict.

Pass only if all are true:

- At least 85% of all mode + scope answers are correct.
- At least 90% of unknown/not-returned examples are not mistaken for unavailable.
- At least 90% of paid-without-amount examples are not interpreted as a known price.
- No more than one participant interprets provider evidence as a reservation or guarantee.
- At least 80% select the safe expected decision for each evidence state.
- Compared with a no-laundry-evidence control, the prototype reduces `I cannot tell what laundry option this hotel supports` by at least 20 percentage points without increasing confidently incorrect answers.

Ask in this order after each example:

1. Which laundry mode or modes are reported?
2. Is each option on the property, hotel-managed, or nearby?
3. Is a fee reported, possible, or unknown?
4. What remains unconfirmed?
5. Would you keep, rule out, or verify this hotel, and why?
6. How confident are you? (five-point scale)

Record factual answers before confidence. Treat a confident incorrect answer as a trust failure.

### Reopening rule

One passed gate is insufficient. After both pass, Product must explicitly approve a new UXDES ticket. That future ticket must use the audited provider distribution and observed comprehension to reconsider final placement, persistence, production types, analytics, and whether unknown should appear persistently. It must not inherit this prototype as production by default.

Do not create `UI-HOTEL-LAUNDRY-AVAILABILITY-01` or `DEV-HOTEL-LAUNDRY-AVAILABILITY-01` from this deferred ticket.

## 16. Research Protocol And Measurement

### Study conditions

- **Control:** the current product-shaped Hotel fit surface with no laundry evidence.
- **Variant:** the same surface with the fixture-backed `Laundry options` block.
- No result-card cue variant is authorized in this study; it would introduce a second placement question while provider coverage is zero.

Scenario prompts establish the traveler’s need without inferring it from behavior:

- Self-service requirement: `You are staying five nights and need to wash clothes yourself during the stay.`
- Any-mode requirement: `You are staying seven nights and can use either self-service machines or a hotel-managed service.`
- Fee-sensitive requirement: `You need a laundry option, but you will verify before booking if its charge is not clear.`

Short-stay participants receive equivalent needs without implying laundry evidence should be hidden for them.

### Research-only events

If the isolated harness records events, keep them outside production analytics:

- `prototype_laundry_evidence_viewed`: exposure after at least 50% visibility for one continuous second; fixture id and bounded evidence state only.
- `prototype_laundry_details_opened`: explicit disclosure activation.
- `prototype_laundry_answer_recorded`: factual answer category, correctness calculated in research analysis rather than exposed in UI.
- `prototype_laundry_decision_recorded`: `keep | rule_out | verify` and assigned requirement.
- `prototype_laundry_confidence_recorded`: one through five, recorded after factual answers.

Never infer laundry intent from stay length, baggage, dwell time, back navigation, hotel type, provider continuation, or exit. Do not label an exit laundry-related without an explicit participant response.

## 17. Validation Acceptance Criteria

The artifact is ready for moderated study only when all are true:

1. Every fixture in §14 renders with the exact state hierarchy and final copy rules.
2. Overlapping modes remain separate and retain separate fee states.
3. An explicit negative changes only its named mode; absent modes remain not returned.
4. Not returned, unrecognized, conflicting, loading, and error are visually and semantically distinct.
5. Paid without an amount never renders a number; omitted fee never renders included or free.
6. No visible or accessible string estimates price, turnaround, distance, hours, capacity, machine count, detergent, service quality, endorsement, or selected-stay availability.
7. Provider provenance is preserved in ready fixtures and hidden only when no auditable record exists.
8. The block appears before the provider-shaped continuation and nowhere on a production result or page.
9. Loading and error do not block continuation; retry makes no vendor call.
10. Keyboard, disclosure, retry, focus, live-region, 375px, 1280px, 200% zoom, and long-string behavior pass manual review.
11. The persistent research label appears on every artifact and capture.
12. Any later prototype implementation passes `npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests`.

Passing these criteria means **ready to study**, not ready to ship.

## 18. Out Of Scope And Blockers

- Production provider integration, schema/persistence, `Result<T>` implementation, caching, and shared types.
- Laundry filter, sort, ranking, Deal Score, recommendation, result badge, booking request, hotel contact, map, directions, or nearby affiliate link.
- Price, turnaround, operating-hour, capacity, machine-count, detergent, service-quality, or selected-stay estimates.
- Free-form description/review extraction or inference from hotel name, brand, class, room name, photo, or common practice.
- Adding a supplier solely for laundry data.
- Resolving the pre-existing `RAPIDAPI_KEY` versus approved-secret-list conflict.
- Changing the current two-night snapshot/deal pipeline to match the five-night research cohort.

Blocking production today:

1. The active provider path does not return laundry evidence, the normalizer cannot retain it, and saved deals cannot persist it.
2. No contracted payload audit has passed Gate 1.
3. No observed participant study has passed Gate 2.

No production handoff exists until all three blockers are resolved through the two-gate reopening rule.
