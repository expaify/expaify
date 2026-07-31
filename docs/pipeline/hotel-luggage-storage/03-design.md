# UXDES-HOTEL-LUGGAGE-STORAGE-01 — Hotel Luggage-Storage Confidence Validation Design

Date: 2026-07-31  
Stage: UX Design  
Priority: P2  
Feature slug: `hotel-luggage-storage`  
Upstream: `docs/pipeline/hotel-luggage-storage/02-research.md`

> **DEFER — NOT SHIP-READY.** This document specifies a controlled research prototype only. It does not authorize production provider, type, booking-context, analytics, hotel-card, or handoff changes. Production work may reopen only after the supplier-coverage and comprehension gates in this document both pass and Product explicitly approves the feature.

## 1. Decision And Prototype Objective

The prototype tests whether first-time travelers with a known early-arrival or late-departure need can correctly decide to **keep**, **rule out**, or **verify** a hotel after reading provider-backed luggage-storage evidence.

It tests the same evidence revision on two surfaces:

1. a separate `Luggage storage` disclosure in expanded hotel detail; and
2. a continuity disclosure in outbound hotel review, immediately before the external-provider action.

The prototype must cover complete, partial, explicitly unavailable, conflicting, not-returned, loading, and error states. It must keep before-check-in and after-checkout applicability separate, keep charge state explicit, attribute information to the property/provider, and state that the information does not guarantee service for the selected stay.

There is **no collapsed hotel-result cue in the MVP recommendation**. Variant B may display a temporary cue inside the isolated research harness only to test the research question defined in section 12. It must be visually labeled as a prototype variant and must never be wired into a production result list.

## 2. Scope Boundary

### In the validation prototype

- Static, synthetic fixtures for each required evidence state.
- Expanded hotel-detail disclosure after `Access & room requests` and before `Price scope`.
- Outbound-review disclosure after the existing ownership and loyalty disclosures and immediately before the `Check rooms at {partner}` action group.
- Early-arrival and late-departure scenario prompts supplied by the research harness, not inferred from search dates.
- Research-only capture of factual answers, decision, and confidence after factual answers.
- Keyboard, screen-reader, 375px, and 1280px behavior.

### Not authorized

- A production `HotelOffer` or `BookingHotelContext` change.
- Live provider lookup, scraping, vendor calls from a component, or cache changes.
- Hotel ranking, Deal Score, sort, filter, or result-card changes.
- Bag drop booking, availability inventory, messaging, request submission, payment, claim checks, or off-site storage links.
- A contact form, concierge promise, or statement that expaify contacted the property/provider.
- Inferring storage from early check-in, late checkout, front-desk hours, brand, class, reviews, or common hotel practice.
- Treating not-returned data as unavailable or treating an omitted charge as free.

## 3. Evidence Model For The Prototype

Use the conditional provider-neutral model from research as fixture input. The prototype may define this model in a research-only module; it must not add it to shared production types.

```ts
type StorageServiceState =
  | 'reported_available'
  | 'explicitly_unavailable'
  | 'not_returned'
  | 'conflicting'

type StoragePeriodState =
  | 'reported_available'
  | 'explicitly_unavailable'
  | 'not_specified'
  | 'conflicting'

type StorageCharge =
  | { state: 'included' }
  | {
      state: 'paid'
      amount?: { priceCents: number; currency: string }
      basis?: 'per_bag' | 'per_hour' | 'per_day' | 'per_stay' | 'other'
    }
  | { state: 'unknown' }

type PrototypeLuggageStorageEvidence = {
  state: 'ready' | 'loading' | 'error'
  serviceState: StorageServiceState
  beforeCheckin: StoragePeriodState
  afterCheckout: StoragePeriodState
  schedule?: { providerWording: string; localTimeZone?: string }
  charge: StorageCharge
  conditions: Array<{ id: string; providerWording: string }>
  source: { label: string; observedAt?: string }
  evidenceRevision: string
}
```

Prototype normalization rules:

- `scope` is always property-level and is communicated in the UI; no selected-stay guarantee state exists.
- `reported_available` for the service does not populate either period.
- Missing periods normalize to `not_specified`, never to available or unavailable.
- Missing charge information normalizes to `unknown`, never to included.
- `paid` remains paid when amount or basis is absent.
- A returned amount is integer minor units and renders with `Intl.NumberFormat`; invalid, negative, non-integer, or unsupported-currency fixture amounts render no amount and fall back to the paid-with-unknown-amount copy.
- Schedule and condition wording is synthetic, pre-sanitized, plain text, and capped in the prototype at 160 characters per item. UI code does not parse it to infer a period or charge.
- Any conflict affecting service, a period, or charge produces the conflicting presentation. The prototype never chooses one source as current.
- The same `evidenceRevision` must appear on both surfaces. A missing or mismatched revision forces the outbound disclosure into error; it must not silently show stale or stronger evidence.

## 4. Information Architecture And Hierarchy

### Expanded hotel detail

The disclosure is a sibling section titled `Luggage storage`, placed after `Access & room requests` and before `Price scope`. It is not nested under Deal Score, access, funds policy, special requests, or provider handoff.

Hierarchy inside the section:

1. **Primary:** state heading and the two timing rows, `Before check-in` and `After checkout`.
2. **Secondary:** charge row and any schedule/conditions that change usability.
3. **Tertiary:** source, observation date when supplied, property-level/non-guarantee boundary, and research-only label.

Expanded detail remains optional exposure because the existing `Review hotel` action precedes `Details`. This ticket does not reorder those controls.

### Outbound hotel review

Insert the same disclosure within `Check rooms with provider`, after `HotelBookingOwnershipDisclosure` and `HotelLoyaltyEligibilityDisclosure`, and immediately before the action stack containing `Check rooms at {partner}`. It is a required continuity check, not part of `Supporting evidence` lower on the page.

Hierarchy:

1. Hotel/provider handoff title and ownership remain primary for the page.
2. Storage state is secondary but appears before the outbound action.
3. Source and non-guarantee language remain tertiary.

The handoff version repeats the same factual rows and wording. It does not strengthen `reported` into `confirmed`, remove unknowns, or merge periods. It adds one continuity line: `Same property-reported information shown in hotel details.`

### Collapsed hotel result

Production behavior: render nothing. No icon, amenity chip, absent-state gap, tooltip, skeleton, or screen-reader-only storage label is permitted.

## 5. Component Anatomy

Prototype component name: `HotelLuggageStoragePrototype`.

Required structure:

```text
section, aria-labelledby
├── h4/h3: Luggage storage
├── state summary
├── dl
│   ├── Before check-in
│   ├── After checkout
│   └── Charge
├── schedule (when returned)
├── conditions list (when returned)
├── conflict sources (conflict only)
├── source / observed date
├── property-level, non-guarantee boundary
└── Research prototype label
```

The hotel-detail instance uses an `h4` consistent with sibling detail panels. The outbound-review instance uses an `h3` beneath the page’s `h2`. The component is not a `details` element: the minimum decision evidence must remain visible once the surrounding hotel `Details` region is open and before the outbound CTA.

## 6. State Model And Final UI Copy

All state meaning is communicated with text. Color may reinforce but never replace the heading and row labels.

### 6.1 Shared fixed copy

| Element | Final copy |
|---|---|
| Section title | `Luggage storage` |
| Property boundary | `Property-reported information; it does not guarantee storage for your stay, arrival time, departure time, or bags.` |
| Verification boundary | `Confirm current timing, conditions, and charges with the property or booking provider before booking.` |
| Research label | `Research prototype — luggage storage is not part of hotel ranking or Deal Score.` |
| Handoff continuity line | `Same property-reported information shown in hotel details.` |
| Source with date | `Source: {sourceLabel}. Observed {MMM D, YYYY}.` |
| Source without date | `Source: {sourceLabel}. Observation date not provided.` |

`Observed` is used instead of `updated` because the timestamp describes when evidence was obtained, not when the hotel last changed its policy.

### 6.2 Complete/default state

Fixture: service reported available; both periods reported available; charge included; optional schedule and conditions returned.

| Element | Final copy |
|---|---|
| State heading | `Storage is reported for both timing periods` |
| State body | `The property reports luggage storage before check-in and after checkout.` |
| Before check-in | `Reported available by the property.` |
| After checkout | `Reported available by the property.` |
| Charge, included | `No storage charge reported by the property.` |
| Schedule label | `Reported hours` |
| Example schedule | `8:00 AM–10:00 PM local property time.` |
| Conditions label | `Reported conditions` |
| Example condition | `For registered guests on arrival and departure days.` |

Do not use `Free`, `Guaranteed`, `Available for your stay`, or a checkmark-only presentation. The included state reports only what the property supplied.

### 6.3 Partial state

Fixture: service reported available; one period reported available; the other not specified; charge unknown, or any other non-conflicting incomplete combination.

| Element | Final copy |
|---|---|
| State heading | `Some storage details are not specified` |
| State body | `The property reports luggage storage, but the provider did not return every timing or charge detail.` |
| Period available | `Reported available by the property.` |
| Period not specified | `Not specified by this provider.` |
| Charge unknown | `Not specified by this provider.` |
| Decision guidance | `Verify the missing details before relying on storage.` |

The component shows all three decision rows even if only one is unknown. Known answers must not disappear into a generic partial message.

### 6.4 Explicitly unavailable state

Fixture: service or at least one scenario-relevant period is explicitly unavailable. The research harness must exercise before-check-in unavailable and after-checkout unavailable independently.

| Element | Final copy |
|---|---|
| Service unavailable heading | `The property reports no luggage storage` |
| Service unavailable body | `The provider returned an explicit property statement that luggage storage is unavailable.` |
| Unavailable period | `Reported unavailable by the property.` |
| Other period available | `Reported available by the property.` |
| Other period not specified | `Not specified by this provider.` |
| Charge when service unavailable | `Not applicable because the property reports no luggage storage.` |
| Decision guidance | `If storage is required, choose another hotel or verify that the policy has changed.` |

When only one period is unavailable, the heading is `Storage is not reported for every timing period` and the body is `The property reports different luggage-storage availability before check-in and after checkout.` The available period remains visible; do not collapse the property into a blanket `No storage` label.

### 6.5 Conflicting state

Fixture: two qualifying synthetic sources disagree about service, either period, or charge.

| Element | Final copy |
|---|---|
| State heading | `Storage details conflict — verify before booking` |
| State body | `The available property information does not agree. We are not choosing one statement as current.` |
| Affected row | `Conflicting information returned.` |
| Unaffected known row | Use its normal available, unavailable, or charge copy. |
| Source-list label | `Conflicting statements` |
| Statement format | `{sourceLabel}: “{bounded synthetic statement}”` |
| Decision guidance | `Contact the property or check the booking provider before relying on storage.` |

The prototype displays no winner, recency badge, average, combined availability, or green success treatment. If the supplier cannot attribute both sides, use error rather than conflict.

### 6.6 Not-returned / empty state

Fixture: no qualifying storage evidence was returned.

| Element | Final copy |
|---|---|
| State heading | `Luggage-storage details were not provided` |
| State body | `This provider did not return property information about luggage storage.` |
| Before check-in | `Not provided.` |
| After checkout | `Not provided.` |
| Charge | `Not provided.` |
| Decision guidance | `This does not mean storage is unavailable. Verify with the property or booking provider before relying on it.` |

This is the empty state. It must use neutral surface styling, not warning/error styling, and must never say `No storage`, `Unavailable`, or `May charge`.

### 6.7 Loading state

Loading replaces the state body and rows with stable skeletons but retains the section title and boundaries so layout does not jump.

| Element | Final copy |
|---|---|
| Status heading | `Checking luggage-storage details` |
| Status body | `We’re checking property-reported timing and charge information.` |
| Screen-reader status | `Checking luggage-storage details.` |

Use `role="status" aria-live="polite"` on the text status, `aria-busy="true"` on the section, and `aria-hidden="true"` on three skeleton lines. Do not disable or delay `Review hotel` or the outbound provider CTA in the research prototype; evidence loading is not booking inventory loading.

If the outbound action is activated while storage is loading, continue normally. The study records that storage was not resolved; the UI must not claim the traveler reviewed it.

### 6.8 Error state

| Element | Final copy |
|---|---|
| State heading | `Luggage-storage details could not be checked` |
| State body | `We couldn’t retrieve property-reported storage information. This does not mean storage is unavailable.` |
| Decision guidance | `Verify timing, conditions, and charges with the property or booking provider before relying on storage.` |
| Retry action, research harness only | `Try storage check again` |
| Retrying action label | `Checking storage…` |
| Repeated-failure message | `Storage details still could not be checked.` |

Initial error uses `role="status"`; a failed user-initiated retry uses `role="alert"`. Retry is permitted only where the research fixture simulates it and does not block either navigation CTA. After retry completes, focus moves to the updated state heading with `tabIndex={-1}`. No toast is used.

### 6.9 Paid charge variants

| Returned data | Final copy |
|---|---|
| Paid, amount and basis | `A charge of {formattedMoney} {basisCopy} is reported.` |
| Paid, amount only | `A charge of {formattedMoney} is reported; the basis was not provided.` |
| Paid, basis only | `A storage charge {basisCopy} is reported; the amount was not provided.` |
| Paid, neither | `A storage charge is reported; the amount and basis were not provided.` |
| Unknown | `Not specified by this provider.` |

Basis copy: `per bag`, `per hour`, `per day`, `per stay`, or `under another basis`. Never convert currencies in the component.

### 6.10 Schedule and conditions edge cases

- If a schedule is returned, show provider wording beneath `Reported hours`; do not use it to rewrite either period row.
- If the schedule does not cover the controlled scenario time, the research harness expects `verify` or `rule out` according to whether storage is essential. The UI does not calculate or announce that decision.
- If no schedule is returned, show `Reported hours: Not specified by this provider.` only in partial, conflict, or not-returned fixtures; omit the row in a complete fixture whose study definition does not require hours.
- If conditions are empty, do not render an empty list. In a partial fixture where conditions are the missing dimension, show `Reported conditions: Not specified by this provider.`
- Preserve at most three material conditions in the visible prototype. If a fixture contains more, show the first three followed by `Additional conditions may apply; verify before booking.` This is a fixture-safety rule, not permission to discard production supplier data later.

## 7. Surface-Specific Layout

### Expanded detail at 375px

- The existing hotel card stays one column.
- Storage section is full width with no horizontal scroll.
- Padding: `px-3.5 py-3`; gaps: `mt-2`, `gap-3`.
- Timing and charge rows stack in one column.
- Long hotel, provider, schedule, condition, currency, and source values use `min-w-0 break-words`; no truncation that changes meaning.
- Research label follows all evidence and boundaries.

### Expanded detail at 1280px

- Section remains within the current card width.
- Timing rows form a two-column grid; the charge row spans both columns so cost is not visually attached to only one period.
- Schedule, conditions, source, boundaries, and research label span both columns.
- Do not increase the hotel card’s outer width or add a side rail.

### Outbound review at 375px

- Storage section sits in normal document flow above the full-width outbound CTA.
- The section and CTA must not become sticky or overlap.
- Rows stack vertically; tap targets for retry and outbound action are at least 44px high.
- The external-new-tab cue stays beneath the CTA.

### Outbound review at 1280px

- Keep the existing centered review column and panel width.
- Storage rows may use two columns with charge spanning both.
- Keep at least `mt-5` separation from the preceding disclosure and `mt-5` before the action stack.

## 8. Tailwind And Token Specification

Use only current tokens from `app/globals.css`. Do not add colors, radii, shadows, or font sizes.

### Base section

```text
rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4
```

### State treatments

| State | Classes |
|---|---|
| Complete | `border-[color:var(--border-strong)] bg-[color:var(--bg-surface)]` |
| Partial | `border-[color:var(--gold)] bg-[color:var(--warning-soft)]` |
| Explicit unavailable | `border-[color:var(--gold)] bg-[color:var(--warning-soft)]` |
| Conflict | `border-[color:var(--error)] bg-[color:var(--error-soft)]` |
| Not returned | `border-[color:var(--border)] bg-[color:var(--bg-muted)]` |
| Loading | `border-[color:var(--border)] bg-[color:var(--bg-surface)]` |
| Error | `border-[color:var(--error)] bg-[color:var(--error-soft)]` |

Use `text-[color:var(--error-text)]` for error text; `var(--error)` is border/fill only. Use `text-[color:var(--warning)]` only for short unavailable/conflict emphasis that meets the existing palette rules. Headings remain `text-[color:var(--text-1)]`.

### Type and spacing

```text
section title: text-sm font-medium leading-5 text-[color:var(--text-1)]
state heading: mt-2 text-sm font-medium leading-5 text-[color:var(--text-1)]
body/rows: text-sm leading-6 text-[color:var(--text-2)]
metadata/research label: text-caption leading-5 text-[color:var(--text-3)]
row grid: mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6
charge/full rows: sm:col-span-2
divider: border-t border-[color:var(--border)] pt-3
skeleton: skeleton h-3 rounded-[var(--radius-pill)]
```

Retry uses `btn btn-outline btn-sm`; at 375px add `w-full`, and at `sm` use `sm:w-auto`. Do not add decorative luggage art or status icons.

## 9. Interaction And Focus Rules

### Hotel detail

- Pointer click, `Enter`, or `Space` on the existing `Details` button toggles the entire detail region through its current button contract.
- `aria-expanded` and `aria-controls` remain on the existing button.
- Opening details does not move focus; the storage section follows normal reading order.
- Closing details returns no special focus because the triggering button remains focused.
- The storage section has no internal disclosure and cannot hide timing/charge unknowns.

### Outbound review

- Storage evidence is in DOM order before `Check rooms at {partner}`.
- Activating the provider CTA opens the provider in a new tab under the existing behavior. It does not submit, reserve, or transmit a storage request.
- The provider CTA accessible name must not claim storage availability. Do not append state details to an already long accessible name; the immediately preceding labeled section provides context in reading order.

### Retry

- `Enter` or `Space` activates retry.
- While retrying, disable the retry button, set `aria-disabled`/`disabled`, set the section `aria-busy="true"`, and announce `Checking storage…` politely once.
- On success, focus the new state heading. On repeated failure, focus `Storage details still could not be checked.` and announce it as an alert.
- Retry affects the prototype fixture only and makes no vendor request.

### Tab order

No new tab stops exist in ready, partial, unavailable, conflict, or not-returned states unless a research-only source link is explicitly included. Normal order is existing `Details` button → subsequent page controls, and on handoff existing disclosures → optional retry → provider CTA. Source text should be plain text in the baseline prototype to avoid testing source-navigation behavior instead of comprehension.

## 10. Accessibility Requirements

- Use semantic `section`, heading, `dl`, `dt`, `dd`, `ul`, and `li` elements.
- Each instance has a unique heading id derived from hotel id and surface; never duplicate ids when both fixtures render in the harness.
- The section’s accessible name is `Luggage storage`; state heading and all rows remain readable text.
- Do not put the full section copy in an `aria-label`; this would override visible semantics and create duplication.
- Status is never color-only. `Not provided`, `Reported unavailable`, and `Conflicting information returned` must be spoken verbatim.
- Skeletons are hidden from assistive technology; only the concise live status is announced.
- Respect the global three-pixel `:focus-visible` outline and focus ring. Do not remove outline.
- Text and controls must remain usable at 200% browser zoom and 320px minimum body width, although study captures are at 375px and 1280px.
- Provider/supplier strings and synthetic statements use `break-words`; bidirectional control characters and markup are stripped in the fixture builder.

## 11. Required Fixture Matrix

The prototype is incomplete unless every fixture can be selected independently on both surfaces and the same revision is carried forward.

| Fixture id | Service | Before check-in | After checkout | Charge | Required purpose |
|---|---|---|---|---|---|
| `complete-included` | Available | Available | Available | Included | Correct `keep` with boundary understood |
| `complete-paid` | Available | Available | Available | Paid with amount/basis | Check charge comprehension |
| `partial-before` | Available | Available | Not specified | Unknown | Early-arrival keep/verify calibration |
| `partial-after` | Available | Not specified | Available | Unknown | Late-departure keep/verify calibration |
| `before-unavailable` | Available | Unavailable | Available | Unknown | Independent period-specific rule-out |
| `after-unavailable` | Available | Available | Unavailable | Unknown | Independent period-specific rule-out |
| `service-unavailable` | Unavailable | Not specified | Not specified | Unknown | Explicit negative vs missing comprehension |
| `conflicting-timing` | Conflicting | Conflicting | Not specified | Unknown | Verify without choosing a source |
| `not-returned` | Not returned | Not specified | Not specified | Unknown | Unknown is not unavailable |
| `loading` | Loading | — | — | — | Non-blocking async behavior |
| `error` | Error | — | — | — | Retrieval failure and retry behavior |
| `revision-mismatch` | Error at handoff | — | — | — | Prevent stronger/stale cross-surface claim |

For `complete-included`, use the fixed schedule and condition examples in section 6.2. For conflict, use two clearly labeled synthetic sources with opposite before-check-in statements. All fixture content must visibly say `Research prototype` and use non-production hotel/provider identities.

## 12. Validation Protocol And Gates

### Participants and scenarios

Run moderated sessions with 8–10 first-time or infrequent hotel-comparison users. Include at least four early-arrival and four late-departure scenarios, at least one cost-sensitive participant, and at least one participant for whom carrying bags is a hard constraint.

Scenario prompts are displayed in the research harness before the hotel surfaces:

- Early arrival: `You arrive at 8:00 AM. Hotel check-in begins at 3:00 PM. You need somewhere to leave your bags before check-in.`
- Late departure: `You check out at 11:00 AM and leave for the airport at 8:00 PM. You need somewhere to leave your bags after checkout.`

These prompts do not appear in production UI and do not add itinerary-time inputs.

### Variants

- **Control:** current surfaces with no storage evidence.
- **Variant A:** expanded-detail disclosure plus identical outbound-review disclosure.
- **Variant B, research harness only:** Variant A plus a temporary collapsed cue reading `Property reports luggage storage — timing and charges may vary.` The cue must also display `Prototype variant` to prevent screenshot reuse as production direction.

Variant B tests whether a scan cue materially improves five-second comparison. It is not an MVP specification and remains prohibited from production unless a later design ticket is explicitly approved after research.

### Question order

After each scenario, ask without showing suggested answers until the participant responds:

1. Does the property report luggage storage?
2. Does it apply before check-in?
3. Does it apply after checkout?
4. Is a charge reported, possible, or unknown?
5. Does this guarantee storage for this stay?
6. Would you keep, rule out, or verify this hotel? Why?
7. How confident are you in that decision? Use a five-point scale.

Confidence is always last. High-confidence incorrect answers are recorded as the highest-severity trust failure.

### Supply gate

This remains failed until an approved hotel provider supplies a representative, contractually usable payload sample and:

- storage service state survives `lib/providers` normalization with source and observed time when supplied;
- both periods are reported separately rather than inferred;
- charge distinguishes included, paid, and unknown;
- explicit unavailable, conflict, partial, and not-returned are measurable separately; and
- at least 30% of normalized offers yield a non-`verify` answer for one study scenario, with no required dimension below 30% coverage in that cohort.

### Comprehension gate

Pass only if:

- at least 85% of all fact-state answers are correct;
- at least 90% distinguish not returned from unavailable;
- no more than one participant interprets property-reported evidence as a guarantee;
- at least 70% choose the safe expected keep/rule-out/verify decision for each scenario; and
- evidence produces at least a directional 20 percentage-point improvement over control in complete-case decision correctness.

### Research event definitions

If the isolated prototype records events, use research-only event names or a research environment. Do not extend production analytics under this ticket.

- Exposure: at least 50% of the disclosure visible for one continuous second.
- Details open: explicit activation of the existing hotel `Details` control.
- Decision: participant explicitly selects `keep`, `rule_out`, or `verify` in the research harness.
- Intent: assigned scenario only; never inferred from search dates or behavior.
- Exit: a navigation event only; never label it storage-related without an explicit participant response.

## 13. Acceptance Criteria For A Validation-Only UI Handoff

The research prototype is ready to study only when all of the following are true:

1. Every fixture in section 11 renders in expanded hotel detail and outbound review.
2. Both surfaces show the same `evidenceRevision`; mismatch safely becomes error.
3. Before-check-in and after-checkout rows never copy or infer each other.
4. Charge unknown never renders as free, included, or no charge.
5. Not returned never renders as unavailable.
6. Property-reported and non-guarantee language is visible in every ready state, including complete.
7. Loading and error do not block either hotel-review or provider navigation.
8. No storage cue appears on a production collapsed result.
9. No control sends a message, request, reservation, payment, or contact action.
10. Keyboard operation, focus management, live-region behavior, 375px, 1280px, 200% zoom, and long-string wrapping pass manual review.
11. `npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests` exit 0 for any prototype implementation.
12. The prototype and every fixture visibly identify themselves as research-only.

Passing these criteria means **ready for moderated validation**, not ready for production.

## 14. Production Reopening Rule

Do not convert this specification into production UI when only one gate passes. After both gates pass, Product must explicitly approve a new scoped ticket. That future design must reconsider:

- whether the two-surface repetition is still necessary;
- whether actual coverage warrants showing partial/not-returned states persistently;
- whether the current `Review hotel` before `Details` order needs revision;
- whether a collapsed cue improved comparison without unknown-as-unavailable errors;
- the final provider-neutral shared type and booking-context persistence contract; and
- production analytics, retention, and consent requirements.

Until then, status remains **DEFER — NOT SHIP-READY**.

## 15. Blockers And Out-Of-Scope Findings

- Normalized production provider coverage is 0%; the live data path cannot support this UI.
- No observed study establishes comprehension or decision lift.
- `HotelCard` is not mounted by a production page in the current worktree, so a card-only implementation would not reach travelers.
- `BookingHotelContext` cannot preserve storage evidence or its revision into handoff.
- Resolving provider supply, shared types, context persistence, live result wiring, or analytics is outside this UXDES ticket.
- The existing `Special requests` section must remain separate. Early check-in is not luggage storage, and continuing from expaify sends no request.

## Handoff

Create `UI-HOTEL-LUGGAGE-STORAGE-01` only as an isolated **validation prototype** ticket. It must prohibit production wiring, display synthetic research data, implement every fixture and accessibility rule above, and retain the visible `DEFER — NOT SHIP-READY` boundary. It must not create a production collapsed-result cue. A production UI/DEV handoff is blocked until both gates pass and Product explicitly reopens the feature.
