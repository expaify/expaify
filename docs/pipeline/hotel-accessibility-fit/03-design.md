# UXDES-HOTEL-ACCESSIBILITY-FIT-01: Hotel accessibility accommodation fit design specification

Date: 2026-07-31  
Stage: UX Design (UXDES)  
Priority: P0  
Upstream: `docs/pipeline/hotel-accessibility-fit/01-discovery.md`, `02-research.md`  
Downstream: `UI-HOTEL-ACCESSIBILITY-FIT-01`

## Design outcome

expaify will account for a traveler's selected essential accessibility needs on the active `/deals` `DealCard`, show the evidence trail on `/deals/[dealId]`, and repeat every unresolved need immediately before an outbound provider action. The interface reports evidence fit, not personal accommodation fit, and never promises that a room will meet an individual's needs.

The strongest truthful production state with today's saved-deal and provider contracts is usually **“Not documented — confirm.”** Positive matching, verified-match filtering, “all needs documented,” and selected-stay confirmation remain blocked until a provider-backed fact is bound to the relevant property, room/product, rate, and saved stay. Explicit provider mismatches also remain blocked until the provider contract can return an affirmative negative at the required scope.

This is a repair of an unsafe information boundary. It does not authorize a new provider, room-selection flow, booking flow, disability profile, free-text medical field, or guarantee.

## 1. Binding honesty rules

These rules override all visual treatments and copy substitutions.

1. **No selection, no fit claim.** When a traveler has selected no essential accessibility need, cards do not show an accessibility-fit rollup. The detail page may still show an “Accessibility information” unknown state, but it does not call the hotel a match or mismatch.
2. **Every selected need is accounted for.** Each visible result and detail ledger contains one deterministic outcome for every selected essential need: `documented`, `mismatch`, or `not_documented`.
3. **Unknown is not negative.** Missing, `not_returned`, malformed, stale, conflicting, failed, or wrong-scope evidence maps to **“Not documented — confirm,”** never “not accessible” or “does not match.”
4. **Scope cannot be promoted.** Property evidence may support a route segment but cannot prove a room, bathroom, rate, or selected stay. Room evidence cannot prove that the offered rate includes that room. A provider link does not change scope.
5. **Request is not confirmation.** `requestable` evidence always maps to **“Request only — not guaranteed until the provider confirms.”** Sending, accepting, or displaying a request is not a guarantee unless a selected-stay confirmation reference is returned by an approved provider contract.
6. **Positive selected-stay copy has a high gate.** “Documented for this stay” requires all of: selected need ID; relevant normalized fact; `rate` or `selected_stay` scope; current source and observed time; matching property, stay dates, room/product or rate identifier; `guaranteed` certainty for selected-stay claims; and a confirmation reference for any claimed guarantee.
7. **A mismatch also needs evidence.** “Documented mismatch” requires an explicit provider-backed `unavailable`/not-supported fact at the minimum relevant scope, with source and current observed time. Absence never qualifies.
8. **Freshness is source-defined.** UI does not invent a time threshold. A provider adapter or normalized presentation state supplies `current` or `stale`. Stale evidence remains visible for provenance but cannot produce a positive match or mismatch rollup.
9. **Conflicts are not reconciled in UI.** Show each valid source statement and map the need to confirmation required. No source wins by recency, order, or apparent authority in the component.
10. **All outbound links retain affiliate markers.** Accessibility UI may annotate or precede the existing handoff but must not rebuild, strip, or replace provider URLs.

### Prohibited visible claims

Do not render: `Accessible hotel`, `Accessibility guaranteed`, `This room will meet your needs`, `Verified accessible`, `Provider will confirm`, `Provider confirms room-level details`, `Likely accessible`, or an accessibility percentage/score.

The existing sentence **“Rate shown for this stay context; the provider confirms room-level details.” must be removed.** Its replacement is specified in §8.

## 2. Scope and delivery boundary

### UI stage can implement now

- Add the accessibility result-cue slot to the active `app/components/ui/DealCard.tsx`, not the unmounted `app/components/HotelCard.tsx`.
- Add one canonical accessibility ledger within the active `/deals/[dealId]` **Hotel fit** section, before provider handoff.
- Add the unresolved-needs boundary directly above all provider links.
- Implement all visual, keyboard, screen-reader, loading, partial, empty, error, stale, malformed, and conflict treatments using normalized fixture data.
- Render the honest production fallback from current data: no fit cue when no need exists; otherwise not documented/confirm.
- Replace the unsupported room-confirmation sentence.
- Preserve price, Deal Score, dates, result navigation, locked/expired behavior, and existing provider-link construction.

### Blocked pending DEV/provider work

- Persisting essential needs in `HotelSearchCriteriaV1`, URL/history, detail back links, and saved deal continuity.
- Provider normalization for the canonical fact IDs in §4, including room/product/rate identity and explicit negative capability.
- Joining evidence to the active saved-deal row and its dates, property, room/product, and rate.
- Production use of `documented`, `mismatch`, `all_documented`, or `has_mismatch` outcomes.
- Verified-match counts, verified-match filtering, and the separate hotels-to-confirm result set.
- Selected-stay guarantees or confirmation references.

UI fixtures may exercise these states. Production must capability-gate them off until the data contract validates every required field.

### Explicitly out of scope

- Provider integrations, scraping, inferred facts from photos/reviews/class/rating, rankings, Deal Score changes, or a broad `Accessible` flag.
- Diagnosis, disability type, medical history, free-text accommodation requests, or storing a traveler profile.
- Room selection, request transmission, property messaging, reservation, or payment.
- Changes to money, `Result<T>`, secrets, cache, provider, or affiliate-link contracts.

## 3. Information architecture and hierarchy

### `/deals` results

The existing result hierarchy remains:

1. Hotel name and stay context — primary identity.
2. Price, usual price, Deal Score/deal cue — primary transactional decision.
3. **Accessibility fit for selected needs** — secondary safety/fit decision, before photo and “View deal.”
4. Photo and action.
5. Price-check provenance — tertiary.

The accessibility block is text inside the existing card link. It is not a nested disclosure, badge-only state, separate button, score, or ranking signal.

### `/deals/[dealId]` detail order

1. Saved hotel deal / stay details.
2. Price and Deal Score.
3. Hotel fit:
   - Hotel class and guest rating.
   - **Accessibility fit**.
   - Existing quiet-stay evidence.
4. Check rooms with provider:
   - **Accessibility confirmation boundary**.
   - Existing date/context boundary.
   - Provider actions.
5. Supporting evidence.

There is exactly one accessibility ledger. Do not also mount it in Supporting evidence or in the dormant `HotelCard`.

### Accessibility ledger reading order

Within **Accessibility fit**, DOM and visual order are fixed:

1. Selected essential needs summary.
2. Room and bathroom evidence.
3. Arrival and route evidence.
4. Hearing and visual evidence.
5. Supporting context.
6. Persistent scope statement and overall source/freshness note.

Selected needs always render, even when every value is unknown. Unselected returned evidence may appear only in collapsed **Other documented accessibility details** after selected needs; it never changes fit rollup. This disclosure is omitted when empty.

## 4. Essential-need and evidence vocabulary

### Traveler-selectable needs

Use concrete functional requirements, never diagnoses or identity labels. Canonical order is fixed and caller order must not affect rendering.

| ID | Visible selection label | Minimum evidence required for a positive outcome |
|---|---|---|
| `step_free_route_to_room` | `Step-free route to the room` | Every required route segment documented at property scope, including elevator only when vertical circulation requires it; room entry remains separately accounted for. |
| `accessible_room_and_bathroom` | `Accessible room and bathroom` | Named room/product plus relevant room entry, circulation, bathroom, controls, and offered-rate/selected-stay binding. A generic accessible-room label alone is supporting, not exhaustive evidence. |
| `roll_in_shower` | `Roll-in shower` | Exact bathing configuration for the named room/product and binding to the offered rate/selected stay. |
| `accessible_tub` | `Accessible tub` | Exact accessible-tub configuration for the named room/product and binding to the offered rate/selected stay. |
| `hearing_access_alerts` | `Hearing-access alerts` | Exact visual fire alarm and returned door/phone notification facts for the named room/product, then rate/selected-stay binding. |
| `tactile_braille_wayfinding` | `Tactile or Braille wayfinding` | Exact returned property/common-area and room-signage facts at their correct scopes. Unknown segments remain unknown. |

`roll_in_shower` and `accessible_tub` are never grouped, substituted, or treated as equivalent. No generic “Mobility accessible” option is permitted.

### Route segments

The existing compound `step_free_route` cannot render as a completed route. Normalize and present these independent rows:

1. `step_free_arrival` — Arrival/drop-off or accessible parking route.
2. `step_free_entrance` — Step-free property entrance.
3. `step_free_reception_common` — Step-free route through reception/common areas.
4. `vertical_circulation` — Elevator or other accessible vertical circulation where needed.
5. `step_free_route_to_room_entry` — Step-free route to guest-room entry.
6. `room_entry_clearance` — Room-entry access for the named room/product.
7. `room_internal_circulation` — Internal circulation for the named room/product.
8. `bathroom_access` — Bathroom access/configuration for the named room/product.

Never infer one returned segment from a neighboring segment. “Elevator documented” is supporting property evidence only; it does not complete the route.

### Room/bathroom details

Where returned, keep these exact facts separate: accessible room availability, room-entry clearance, internal circulation, roll-in shower, accessible tub, grab bars, shower seat, reachable controls, and bathroom turning/clear-floor information. UI does not calculate dimensional fit or combine them into “wheelchair accessible.”

### Normalized presentation contract

The UI consumes a derived presentation, not raw provider prose:

```ts
type AccessibilityOutcome = 'documented' | 'mismatch' | 'not_documented'
type AccessibilityEvidenceState =
  | 'loading' | 'ready' | 'not_returned' | 'unknown' | 'unavailable'
  | 'stale' | 'malformed' | 'conflicting' | 'error'
type AccessibilityScope = 'property' | 'room' | 'rate' | 'selected_stay'
type AccessibilityCertainty = 'informational' | 'requestable' | 'guaranteed'

type AccessibilityFact = {
  canonicalId: string
  needId: string
  label: string
  state: AccessibilityEvidenceState
  scope: AccessibilityScope
  sourceLabel?: string
  observedAt?: string
  certainty: AccessibilityCertainty
  propertyId: string
  roomProductId?: string
  roomLabel?: string
  rateId?: string
  stayFingerprint?: string
  confirmationReference?: string
  rawProviderId: string
}
```

This is the required downstream shape, not an instruction for UI to modify `lib/types.ts`. DEV decides whether `stale`, `malformed`, and `conflicting` become normalized statuses or derived presentation states. They must not be encoded as optimistic `confirmed`.

### Deterministic need rollup

Evaluate gates in order; the first matching gate ends evaluation:

1. No selected need → no outcome/cue.
2. Overall or relevant class loading with no settled fact → `loading` presentation; no outcome claim.
3. Any relevant current explicit negative at the required scope → `mismatch` only if source, time, entity binding, and negative capability validate.
4. Any malformed, entity-mismatched, stale, conflicting, failed, missing-source, missing-time, or wrong-scope relevant fact → `not_documented`.
5. Any relevant `requestable` fact → `not_documented` plus request-only qualifier.
6. Every required fact validates at the minimum scope and binds to the active product/rate/stay → `documented`.
7. Otherwise → `not_documented`.

Card rollup across selected needs:

- `all_documented`: every selected need is `documented`.
- `has_mismatch`: at least one selected need is `mismatch`; takes precedence over unknowns.
- `needs_confirmation`: no mismatch and at least one selected need is `not_documented`.
- `loading`: no settled mismatch and at least one selected need is still checking.

Production currently permits only `needs_confirmation`, `loading`, or no cue unless provider capability is later proven.

## 5. Essential-needs criteria behavior

This section specifies the intended criteria contract, but its production mount is blocked until criteria persistence and evidence coverage are implemented by DEV.

### Entry and control

Inside the existing search editor, add a `<fieldset>` after dates:

- `<legend>`: **Accessibility needs**
- Supporting copy: **Select only the features that are essential for this stay.**
- Six independent checkboxes using the labels in §4.
- Persistent coverage copy: **Accessibility evidence is limited; results are not filtered exhaustively.**
- Secondary action: **Clear accessibility needs**; only shown when at least one is selected.

This is a comparison criterion, not a disability profile. Do not include an “Accessible hotel” master toggle, “Other,” medical labels, or free text.

Checkbox rows use `min-h-11 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2.5`; checked rows add `border-[color:var(--brand)] bg-[color:var(--success-soft)]`. Native checkbox and visible label remain present. State is not communicated by fill alone.

### Applying and restoring

- `Apply` includes selected canonical IDs in the versioned criteria contract and changes `criteriaVersion`.
- Selected needs survive reload, browser Back/Forward, result → detail → Back, and a valid detail refresh.
- Results summary appends **Essential needs: {comma-separated labels}.**
- Invalid or ambiguous need IDs invalidate only the accessibility criterion, announce the recovery, and preserve destination/date criteria. Final copy: **Accessibility needs could not be restored. Review and apply them again.**
- Clearing restores the unsegmented prior result list and places focus on the results-status heading after update.
- No analytics payload contains diagnosis, disability category, or free text; send canonical need IDs and evidence coverage only.

### Coverage-aware result grouping

Do not present a control labeled `Only show matching hotels` until verified-match capability exists for all selected needs.

When capability exists:

- Primary group title: **Documented matches ({N})**.
- Unknown candidates are not silently mixed into that group.
- If requested, secondary action: **Show hotels to confirm ({N})**.
- Unknown candidates group title: **Hotels to confirm ({N})**.
- Explicit mismatches are excluded from documented matches and may remain in the broader unfiltered list with their visible mismatch cue.
- If no documented matches exist and unknown candidates do, use §9 empty-state copy.

Until capability exists, show all current results with per-card unknown outcomes and the fixed coverage sentence. Do not display match counts of zero; that would imply an exhaustive check.

## 6. Active `/deals` DealCard specification

### Placement and anatomy

Insert one accessibility block after hotel identity/stay context and before the price block. It sits inside the existing card anchor and contains no interactive descendant.

For one selected need:

```
Accessibility fit
{Need label}: {outcome}
{scope qualifier, only when useful}
```

For two or more selected needs:

```
Accessibility fit
{rollup}
{documented count} of {selected count} selected needs documented
```

Follow with a compact visible list of every selected need and its outcome. Do not hide selected needs behind disclosure. At 375px, show all rows; card height may grow.

### Final card copy

| Condition | Rollup / row copy |
|---|---|
| All selected needs satisfy positive gate | `All selected needs documented` |
| At least one explicit mismatch | `Does not match a selected need` |
| No mismatch; one or more unresolved | `Some needs require confirmation` |
| Per-need positive | `{Need}: Documented for this stay` |
| Per-need explicit negative | `{Need}: Documented mismatch` |
| Per-need unknown | `{Need}: Not documented — confirm` |
| Requestable | `{Need}: Request only — not guaranteed` |
| Loading, no settled outcome | `Checking accessibility details…` |
| Evidence check failed | `{Need}: Could not be checked — confirm` (rolls up as confirmation required) |

Do not shorten `Not documented — confirm` to `Unknown` on the card.

### Card visual treatment

- Container: `rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2.5`.
- Label: `text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]`.
- Rollup: `mt-1 text-small font-medium leading-5 text-[color:var(--text-1)]`.
- Need rows: `mt-1 break-words text-caption leading-5 text-[color:var(--text-2)]`.
- Documented may use `border-[color:var(--brand)] bg-[color:var(--success-soft)]`.
- Mismatch uses `border-[color:var(--error)] bg-[color:var(--error-soft)]`; text stays `var(--error-text)` or `var(--text-1)`, never `var(--error)`.
- Confirmation uses `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]`; text uses `var(--warning)` only where contrast is sufficient and retains the full outcome text.
- Loading skeleton uses `skeleton h-4` on two non-text blocks, while an `sr-only` status supplies copy.

Color and icon are optional reinforcement. Text is mandatory. Do not use a wheelchair icon as a catch-all.

### Card accessible name

Append after hotel identity, in selected-need order:

**“Accessibility fit. {Need label}: {screen-reader outcome}. {next need…}”**

Screen-reader outcomes:

- `Documented for this selected stay.`
- `The provider documents that this requirement is unavailable.`
- `Not documented; confirm before booking.`
- `Request only; not guaranteed.`
- `Accessibility details are still being checked.`
- `Accessibility details could not be checked; confirm before booking.`

Do not include source/freshness in the card accessible name; detail provides it. Do not duplicate visible text via a second live region after settled render.

### Locked, example, and expired cards

- Locked cards do not expose hidden property evidence or an accessibility fit claim. If needs are selected, visible copy is **“Accessibility fit available after this deal is unlocked.”** This is not a match outcome.
- Example/mock cards may display only test-fixture evidence when visibly labeled **Example**. No real-source provenance may be implied.
- Expired cards may retain last documented evidence as historical provenance, but every need maps to confirm and the block starts **“Saved accessibility details may be out of date.”** No historical positive/mismatch rollup remains active.

## 7. `/deals/[dealId]` Accessibility fit ledger

### Section opening

Inside existing `Hotel fit`, after class/rating and before quiet-stay evidence:

- `<section aria-labelledby="accessibility-fit-title">`
- `<h3 id="accessibility-fit-title">Accessibility fit</h3>`
- When needs selected: **For this search: {comma-separated selected need labels}.**
- Persistent scope: **Property features, room features, rate eligibility, and confirmation for a selected stay are different. A request is not a guarantee.**
- Limited coverage: **Accessibility evidence is limited; results are not filtered exhaustively.**

When criteria are missing/invalid: **No accessibility needs were carried with this saved deal. Review the available evidence and confirm essential needs with the provider before booking.** Do not guess needs from viewed rows.

### Overall summary

Render a definition list, not a set of status badges:

- Term: `Selected needs`
- Definition: `{N} selected` or `None selected`
- Term: `Evidence outcome`
- Definition: card rollup copy, or `No fit outcome without selected needs`
- Term: `Room confirmation`
- Definition follows §8 room confirmation states.

### Need groups and rows

Each group is an `<section>` with an `<h4>`. Each need is an `<article>` with a heading and outcome. Within each need, evidence rows use `<dl>` in this DOM order:

1. `Outcome`
2. `What is documented`
3. `Scope`
4. `Certainty`
5. `Room or product` (when valid)
6. `Rate or selected stay` (when valid)
7. `Source`
8. `Last checked`
9. `Confirmation reference` (only when validated)

Metadata is never tooltip-only. Missing metadata is explicit.

### Final group labels

- **Room and bathroom**
- **Arrival and route**
- **Hearing and visual support**
- **Supporting context**

Supporting context may include accessible parking/service-animal facts only when sourced, but it cannot substitute for a selected P0 need.

### Final row vocabulary

| Field | Allowed visible values |
|---|---|
| Outcome | `Documented for this stay`; `Documented mismatch`; `Not documented — confirm`; `Request only — not guaranteed`; `Sources conflict — confirm`; `Out of date — confirm`; `Could not be checked — confirm` |
| Scope | `Property`; `Room`; `Rate`; `Selected stay` |
| Certainty | `Documented information`; `Request only`; `Guaranteed for selected stay` |
| Source missing | `Source not provided` |
| Freshness missing | `Last checked not provided` |
| Room missing | `No room or product identified` |
| Rate missing | `No rate or selected stay identified` |

“Guaranteed for selected stay” is allowed only when the gate in §1.6 passes. Otherwise degrade the entire need to confirmation required.

### Evidence-state copy

| State | Row or group copy |
|---|---|
| `loading` | `Checking accessibility details…` |
| `not_returned` | `{Provider} did not return this accessibility detail.` |
| `unknown` | `The available information does not establish this requirement.` |
| `unavailable` with valid negative capability | `{Provider} documents that this requirement is unavailable for {scope target}.` |
| `error` | `This accessibility detail could not be checked. Price and hotel details are still available.` |
| `stale` | `This detail is out of date. It was last checked {date}; confirm before booking.` |
| `malformed` | `The provider returned an accessibility detail we could not verify or display.` |
| `conflicting` | `Sources conflict. Review each source and confirm before booking.` |

For a selected need, `not_returned`, `unknown`, `error`, `stale`, `malformed`, and `conflicting` rows are never consolidated under “Other details.” The need remains explicit.

### Conflicting evidence

Show each valid fact as a separate bordered source item beneath the conflict sentence. Each includes fact wording, scope, certainty, source, and observed time. Invalid facts are not displayed. The overall need outcome remains **“Sources conflict — confirm.”** No “newer source” winner or merged statement.

### Partial evidence

Partial means at least one usable fact and at least one required missing/unusable fact. Show usable facts normally and insert the missing required rows in canonical order. Summary copy:

**“Some accessibility details are documented, but this need is not confirmed for the selected stay.”**

Example: a documented elevator plus unknown entrance and room entry remains not documented for `step_free_route_to_room`.

### Ledger visual treatment

- Section wrapper inherits the existing Hotel fit section.
- Inner ledger: `mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4 sm:p-5`.
- Title: `text-h3 text-[color:var(--text-1)]`.
- Scope copy: `mt-2 text-small leading-5 text-[color:var(--text-2)]`.
- Groups: `mt-5 border-t border-[color:var(--border)] pt-4 first:border-t-0 first:pt-0`.
- Need card: `mt-3 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3.5`.
- Need heading: `text-body font-medium text-[color:var(--text-1)]`.
- Definition grid at desktop: `mt-3 grid min-w-0 grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)] gap-x-4 gap-y-2`; at mobile: `grid-cols-1 gap-y-1` with each `dd` followed by `mb-2`.
- Terms: `text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]`.
- Definitions: `min-w-0 break-words text-small leading-5 text-[color:var(--text-2)]`.
- Conflict/source items: `mt-2 border-l-2 border-[color:var(--border-strong)] pl-3`.

No horizontal scroll, fixed-width metadata columns, clipped source labels, line clamps, or hover-only details.

## 8. Room confirmation and provider-handoff boundary

### Replacement for the unsupported current sentence

In the stay-details section, replace the date-complete branch with:

**“Rate shown for these dates. No room is selected, and room-level accessibility fit is not confirmed.”**

Keep the incomplete-date branch, but append the same boundary:

**“Stay dates are incomplete. Choose or confirm dates with the provider before comparing room options. No room is selected, and room-level accessibility fit is not confirmed.”**

This copy renders whether or not accessibility needs are selected because the existing sentence currently makes an unsupported general room-confirmation claim.

### Confirmation states

| State | Final copy |
|---|---|
| No room/product identity | `No room selected — accessibility fit is not confirmed.` |
| Named room, no offered-rate binding | `{Room name} has documented features, but this rate is not tied to that room. Confirm before booking.` |
| Requestable | `Request only — not guaranteed until the provider confirms.` |
| Request transmitted with receipt | `Request sent to {Provider}. A sent request is not a guarantee.` |
| Provider acknowledgment without guarantee | `{Provider} acknowledged the request. This does not guarantee the selected stay.` |
| Selected-stay gate passes for every selected need | `Selected stay documents all chosen accessibility needs.` |
| No selected need | `No accessibility needs were selected for comparison.` |

The request-sent and acknowledgment states are fixture-only until a provider response and receipt/reference exist. Clicking a provider link does not produce either state.

### Boundary placement and anatomy

Inside **Check rooms with provider**, the accessibility boundary is before all provider actions and after the section heading. It is not dismissible.

When unresolved needs exist:

```
Confirm before booking
No room selected — accessibility fit is not confirmed.
• {Need 1}
• {Need 2}
Request only — not guaranteed until the provider confirms. [only when applicable]
```

When all selected needs pass the positive gate:

```
Accessibility evidence for this stay
Selected stay documents all chosen accessibility needs.
Review the room, rate, and accessibility details again on the provider site before paying.
```

The second sentence is required even in the strongest state; expaify is reporting provider documentation, not personal fit.

### Provider action copy and accessible names

Visible provider action labels remain unchanged to preserve existing handoff behavior. Their accessible name is augmented:

- Unresolved: **“Check rooms at {Provider}; accessibility confirmation is still required for {N} selected needs.”**
- All documented: **“Check rooms at {Provider}; all selected accessibility needs are documented for this stay. Review details before paying.”**
- No selected needs: retain the existing accessible name.

Do not disable provider links for missing evidence. The boundary prevents a positive claim, not price comparison. Existing affiliate URLs and markers pass through untouched.

### Boundary visual treatment

- Unresolved container: `mt-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-4`.
- Positive-gated container: `mt-4 rounded-[var(--radius-control)] border border-[color:var(--brand)] bg-[color:var(--success-soft)] p-4`.
- Error container uses `border-[color:var(--error)] bg-[color:var(--error-soft)]`; readable text uses `var(--error-text)`.
- Heading: `text-body font-medium text-[color:var(--text-1)]`.
- List: `mt-2 list-disc space-y-1 pl-5 text-small text-[color:var(--text-2)]`.
- Provider buttons remain at least 44px high and full-width at 375px.

## 9. Complete state matrix

### Default: no selected accessibility needs

- Criteria: no checked items.
- Results: no fit cue and no accessibility ranking/filtering.
- Detail: ledger opening says no needs were carried; any sourced evidence is informational and grouped by scope.
- Handoff: no accessibility-needs boundary list; unsupported current room sentence is still replaced.
- No live-region announcement on initial render.

### Selected needs, evidence loading

- Cards whose accessibility data are independently loading show the loading text/skeleton; price and card navigation remain usable.
- Detail ledger renders heading, selected needs, persistent caveat, and one skeleton row per selected need.
- `aria-busy="true"` is set only on the ledger region, not the page or results grid.
- Polite announcement once: **“Checking accessibility details for {hotel name}.”**
- Handoff remains usable but lists all selected needs as unresolved.

### Ready and fully documented

- Allowed only after the positive gate passes for every selected need.
- Card and ledger use `documented` copy, source, scope, freshness, room/rate/stay identity, and confirmation reference where guarantee is claimed.
- Handoff retains the review-before-paying sentence.
- No celebratory iconography or claim about personal suitability.

### Partial evidence

- Every selected need remains visible.
- Valid facts display; missing/wrong-scope facts show explicit unknown rows.
- Card rollup is confirmation required unless a valid explicit mismatch exists.
- Handoff lists only unresolved selected needs, including needs with some property evidence.

### Empty / no evidence returned

- Card per-need copy: **“Not documented — confirm.”**
- Ledger: **“{Provider} did not return accessibility details for the selected needs. This does not mean the features are unavailable.”**
- Handoff lists every selected need.
- Never render a blank panel or hide the accessibility section.

### Accessibility evidence error

- Preserve hotel results, price, Deal Score, card links, and provider links.
- Results-level polite status: **“Accessibility details could not be checked. Prices and hotel results are still available.”**
- Card/ledger outcomes degrade to confirmation required.
- Retry action, only when a real retry handler exists: **“Retry accessibility check.”** A failed retry retains the same error copy and focus remains on Retry.
- Error does not reuse hotel-result or price-error styling/state.

### Stale evidence

- Show previous fact, source, and observed time for context.
- Prefix state: **“Out of date — confirm.”**
- It cannot produce documented or mismatch rollups.
- Handoff includes the need as unresolved.
- No UI-defined age threshold.

### Conflicting evidence

- Display every valid conflicting source item.
- Outcome: **“Sources conflict — confirm.”**
- Card maps to confirmation required; never mismatch unless a separate current non-conflicting explicit negative independently passes the contract and Product defines precedence in a later ticket.
- Handoff lists the need as unresolved.

### Malformed or entity-mismatched evidence

- Suppress the invalid fact content; never render raw unbounded provider values.
- Copy: **“The provider returned an accessibility detail we could not verify or display.”**
- Degrade to confirmation required and log only safe canonical diagnostics, not traveler data.

### No documented matches

This state is blocked until verified-match filtering exists. When enabled and unknown candidates exist:

- Heading: **“No documented matches”**
- Body: **“Some hotels have incomplete accessibility information. You can review them, but confirm each essential need before booking.”**
- Primary action: **“Show hotels to confirm ({N})”**
- Secondary action: **“Edit accessibility needs”**
- Do not say “No accessible hotels.”

When a verified, exhaustive provider check eventually returns neither matches nor unknowns:

- Heading: **“No hotels document all selected needs”**
- Body: **“Try different dates or edit your selected needs. We did not find a hotel with documentation for every selected requirement.”**
- This exhaustive state must not ship under current coverage.

### Explicit mismatch

- Card: **“Does not match a selected need.”**
- Ledger names the exact need, returned negative, scope, source, and date.
- Handoff places mismatch first under **“Review before booking”**, followed by unknown needs under **“Confirm before booking.”**
- Provider link remains usable; no strikethrough, hidden result, or “inaccessible” label.

### Expired deal

- Historical evidence is marked potentially out of date and all needs require confirmation.
- Existing expired-rate recovery remains primary; no provider handoff is re-enabled.

### Missing or invalid criteria continuity

- Do not reconstruct needs from card analytics, local history, or provider evidence.
- Detail copy uses the missing-criteria sentence in §7.
- Back link behavior remains intact.

## 10. Responsive specification

### 375px viewport

- Page padding remains `px-4`; no element may create horizontal scrolling at 320px minimum body width.
- Deal cards remain one column. Accessibility block is full width and every selected need wraps; no line clamp.
- Criteria checkboxes stack vertically; each row is at least 44px tall. Apply/Clear actions are full width and stacked with `gap-3`.
- Ledger groups and need cards are one column. Every `<dt>` precedes its `<dd>`; source labels, references, and product IDs use `break-words` or `break-all` only for opaque IDs.
- Handoff boundary and provider actions stack. Boundary remains before first provider link in DOM.
- Never use horizontal tabs, a comparison table, status-only icon row, sticky overlay, or two-column metadata.

### 1280px viewport

- Existing detail main max width remains `1080px`; do not create a full-bleed ledger.
- Card grid remains controlled by `DealFeed`; accessibility content must not require equal-height cards.
- Ledger may use a two-column definition layout but groups remain vertically ordered; do not place room evidence and route evidence in parallel columns that alter reading order.
- Handoff may place provider actions in their existing row/grid after the full-width boundary.
- Long content wraps within `minmax(0, 1fr)`.

## 11. Focus, keyboard, and interaction rules

- Use native checkbox inputs. Space toggles; Tab advances in DOM order. Do not implement roving tabindex.
- Enter/Space on Apply triggers one criteria update. While updating, disable repeat submission, retain visible label **“Applying…”**, and do not move focus until the result update completes.
- After successful criteria apply, focus the results status heading (`tabIndex={-1}`) and announce the result/coverage summary once.
- After clearing needs, focus the same heading and announce **“Accessibility needs cleared. Showing the current hotel results.”**
- The card remains one link. Accessibility content introduces no nested button, `<details>`, or tabindex.
- On detail, headings and static definition lists are not focusable.
- Any “Other documented accessibility details” uses native `<details>/<summary>` with a 44px summary target and visible focus ring.
- Retry is a native button. Focus stays on it after failure; after success, move programmatic focus to the ledger heading and announce completion.
- Provider handoff boundary is static and appears before provider actions in DOM; keyboard users encounter its text before each outbound link.
- Existing global `:focus-visible` and `--focus-ring` are mandatory. Do not remove outlines or rely on hover.
- Escape has no behavior because this spec introduces no modal, popover, or menu.

## 12. Screen-reader and live-region specification

### Landmarks and labels

- Result grid remains the existing region; cards are linked articles.
- Detail ledger is `<section aria-labelledby="accessibility-fit-title">`.
- Each selected need article uses a unique heading ID derived from safe canonical ID, never provider prose.
- Outcome is the first definition value, so need + outcome are encountered before metadata.
- Source conflict items are a list with an accessible name: **“Conflicting evidence sources for {need}.”**

### Announcements

Use one visually hidden `role="status" aria-live="polite" aria-atomic="true"` per surface. Update only on async transitions, not initial server render.

Allowed messages:

- **“Checking accessibility details for {hotel name}.”**
- **“Accessibility details loaded. {documented count} of {selected count} selected needs are documented for this stay; {confirmation count} require confirmation; {mismatch count} have a documented mismatch.”**
- **“Accessibility details could not be checked. Prices and hotel results are still available.”**
- **“Accessibility needs applied. Results are not filtered exhaustively.”**
- **“Accessibility needs cleared. Showing the current hotel results.”**

Do not announce every skeleton, each source row, or repeated card state. Visible static text remains available in browse mode.

### Exact screen-reader caveats

- For property evidence supporting a room need: **“Property-level evidence only. It does not confirm a room or selected stay.”**
- For requestable evidence: **“Request only. The request is not guaranteed.”**
- For unknown: **“Not documented. This is not evidence that the feature is unavailable.”**
- For mismatch: **“The provider documents that this requirement is unavailable for the stated scope.”**

## 13. Copy inventory

Only substitute values inside braces. Do not improvise stronger synonyms.

| Surface | Element | Final copy |
|---|---|---|
| Criteria | Legend | `Accessibility needs` |
| Criteria | Help | `Select only the features that are essential for this stay.` |
| Criteria/results | Coverage | `Accessibility evidence is limited; results are not filtered exhaustively.` |
| Criteria | Clear | `Clear accessibility needs` |
| Card/detail | Positive | `Documented for this stay` |
| Card/detail | Negative | `Documented mismatch` |
| Card/detail | Unknown | `Not documented — confirm` |
| Card/detail | Request | `Request only — not guaranteed` |
| Card rollup | Positive | `All selected needs documented` |
| Card rollup | Negative | `Does not match a selected need` |
| Card rollup | Unknown | `Some needs require confirmation` |
| Detail | Title | `Accessibility fit` |
| Detail | Scope | `Property features, room features, rate eligibility, and confirmation for a selected stay are different. A request is not a guarantee.` |
| Detail | Partial | `Some accessibility details are documented, but this need is not confirmed for the selected stay.` |
| Handoff | Unresolved heading | `Confirm before booking` |
| Handoff | No room | `No room selected — accessibility fit is not confirmed.` |
| Handoff | Request | `Request only — not guaranteed until the provider confirms.` |
| Handoff | Strongest allowed | `Selected stay documents all chosen accessibility needs.` |
| Stay context | Date complete | `Rate shown for these dates. No room is selected, and room-level accessibility fit is not confirmed.` |

## 14. Acceptance criteria and fixture matrix

UI tests must cover the active `DealCard`, detail ledger, and handoff together. Updating only `HotelCard` fails this ticket.

### Required fixtures

1. No selected needs.
2. One selected need, overall loading.
3. One selected need, source returned nothing.
4. One selected need, property-only supporting fact for a room need.
5. Step-free route with elevator documented and entrance/room route unknown.
6. Roll-in shower requestable only.
7. Named room evidence without rate binding.
8. Selected-stay positive with valid source/time/product/rate/stay/reference.
9. Explicit unavailable fact with valid negative capability.
10. Stale fact.
11. Malformed fact/source/time.
12. Conflicting valid sources.
13. Overall evidence error with prices/results intact.
14. Multiple needs: documented + unknown.
15. Multiple needs: mismatch + unknown.
16. Expired deal with prior evidence.
17. Missing/invalid criteria continuity.
18. Locked and mock cards.

### Assertions

- Every selected need appears on every unlocked active result card and in detail.
- Only valid rate/selected-stay evidence yields `Documented for this stay`.
- Property-only, room-only without rate binding, requestable, missing, stale, malformed, conflict, and error never yield positive match.
- Missing/unknown never yields mismatch.
- Route segments fail independently; elevator alone never completes step-free route.
- Roll-in shower and accessible tub never substitute for one another.
- Source, scope, freshness, certainty, product/rate identity, and reference render when required and degrade safely when invalid.
- Unsupported room-confirmation sentence is absent from every branch.
- Boundary appears before every outbound provider link; links remain usable and affiliate markers unchanged.
- Loading/error affect only accessibility regions, not hotel price/results.
- 375px has no horizontal overflow; all controls meet 44px target size.
- 1280px retains logical DOM order and max-width.
- Card accessible name contains need and same outcome as visible text.
- Status changes announce once; initial settled content is not redundantly announced.
- Meaning survives monochrome/high-contrast presentation and 200% text zoom.

## 15. Tailwind/token constraints

Use only existing tokens from `app/globals.css`: `--bg-base`, `--bg-surface`, `--bg-raised`, `--bg-muted`, `--border`, `--border-strong`, `--brand`, `--success-soft`, `--warning`, `--warning-soft`, `--error`, `--error-text`, `--error-soft`, `--text-1`, `--text-2`, `--text-3`, `--radius-card`, `--radius-control`, and `--focus-ring`.

Use existing type classes: `text-h3`, `text-body`, `text-small`, `text-caption`. Do not introduce colors, shadows, font sizes, gradients, animated status icons, or decorative clutter. Skeletons use the existing `.skeleton`; respect reduced-motion behavior already owned globally. Text remains the source of meaning.

## 16. Analytics and privacy boundary

Allowed event dimensions:

- canonical selected need IDs;
- selected-need count;
- outcome counts (`documented`, `mismatch`, `not_documented`);
- strongest valid scope;
- evidence state (`loading`, `ready`, `not_returned`, `stale`, `malformed`, `conflicting`, `error`);
- unresolved-need count at handoff;
- provider handoff with zero versus one-or-more unresolved needs.

Never send diagnosis, disability label, medical details, free text, raw provider prose, room number, confirmation reference, or full source content. Analytics do not determine UI truth.

## 17. Downstream implementation sequence

1. UI: create a pure derived presentation contract and fixtures; mount result cue on active `DealCard`, ledger on active detail, handoff boundary, and copy repair. Ship current production evidence as honest unknown only.
2. DEV: version criteria, URL/history/detail continuity, provider capability and normalization, active saved-deal evidence join, freshness rules, and safe analytics.
3. UI/DEV follow-up: enable provider-backed positive/mismatch states only after contract tests pass.
4. TEST: verify all fixtures, active routes, provider-link affiliate continuity, 375px/1280px, keyboard, and screen-reader output. Exhaustive filtering remains disabled until provider coverage is independently verified.

## 18. Definition of done

This design is implemented when a traveler with selected essential needs sees every need accounted for on each active deal, can distinguish property, route, room, rate, and selected-stay evidence on detail, and encounters an exact unresolved-needs boundary before provider handoff—without expaify claiming a positive match, mismatch, exhaustive filter, room confirmation, or accommodation guarantee that the provider-backed data cannot support.
