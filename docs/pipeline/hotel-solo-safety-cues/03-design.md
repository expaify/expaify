# UXDES-HOTEL-SOLO-SAFETY-CUES-01 — Sourced arrival evidence validation prototype

Date: 2026-08-03  
Stage: UX Design (UXDES)  
Priority: P1  
Upstream: `docs/pipeline/hotel-solo-safety-cues/02-research.md`

> **DEFER — VALIDATION ONLY / NOT SHIP-READY.** This specification authorizes no production cue, provider integration, hotel contract change, analytics change, shortlist treatment, ranking input, filter, badge, or booking-context change. The prototype uses controlled fixtures only. Do not create a UI or DEV handoff until both gates in §14 pass and every provider-contract blocker in §15 is resolved.

## 1. Design decision

Validate whether one neutral **Arrival information** ledger helps a traveler understand three different kinds of evidence without turning them into an endorsement:

1. **Property and provider facts** — narrowly scoped statements from a named source.
2. **Traveler reports** — licensed, arrival-topic evidence with a named source, qualifying count, and review period.
3. **What to confirm** — material unresolved items stated as actions, never as property negatives.

The validation target is the product-shaped saved-deal detail layout. The ledger appears after **Property and stay** and before **Hotel fit**. A material unresolved action may repeat once immediately before the existing provider continuation. There is no reassurance state at handoff.

This is a reading and classification pattern, not an assessment. It never combines items into a score, verdict, icon, recommendation, ranking, or single confidence label. It does not answer whether a property, neighborhood, route, or stay is safe or suitable for a person traveling alone.

### Current product behavior while deferred

- `/deals` receives no new line, chip, badge, filter, sort, or ranking signal.
- `/deals/[dealId]` receives no production ledger or reminder.
- `HotelCard` receives no work; it is not mounted in the active flow.
- `BookingHotelContext` and `BookingFlow` receive no new field or UI.
- Existing location, transport, admission, access, disruption, review, and provider-handoff UI remains unchanged.
- No current field is repurposed as arrival evidence.

## 2. Non-claim and evidence boundaries

### Prohibited labels and claims

The research fixture, visible copy, accessible names, event names, and event properties must not use `Safety`, `Solo safety`, `Safe arrival`, `Security`, `Good for solo travelers`, `secure`, or equivalent endorsement language. The researcher introduction may describe the study scenario, but the product-shaped condition must remain neutral.

Do not say or imply:

- that expaify has assessed a property, route, neighborhood, staffing level, access control, or personal risk;
- `near`, `close`, `walkable`, `easy to reach`, or an ETA from straight-line distance;
- `Late check-in available`, guaranteed admission, or continuous staffing from a check-in time or contact instruction;
- that missing evidence means a facility or service is unavailable;
- that traveler reports establish a current property procedure;
- that an aggregate guest rating is arrival-topic evidence.

### Inputs that can never populate the pattern

Aggregate guest rating, hotel class/star count, observed price, photo, city, Deal Score, general review sentiment, straight-line distance without its method and caveat, and missing data cannot create a positive or negative cue. Changing only one of these values must not alter any arrival ledger item, confirmation task, or shortlist variant.

### Ownership and reuse

The prototype composes fixtures shaped like existing owned domains; it does not define competing production fields:

- `HotelLocation` owns location precision, provenance, and straight-line distance.
- `HotelTransportEvidence` owns documented transfer service, hours, cost, and required action.
- `HotelAdmissionPolicyEvidence` owns admission requirements.
- existing access, disruption, check-in logistics, and review-evidence contracts retain their scopes.
- any future topic-report owner must supply display rights, topic scope, source, qualifying count, and review period.

The prototype may project at most one display row from each relevant owner. It must not reinterpret the underlying statement or copy it into a second production source of truth.

## 3. Prototype boundary and study conditions

Any implementation after a future UI ticket may create only an isolated research route/harness, fixture module, renderer, and colocated tests. It must be unreachable from normal product navigation and must not be imported by production pages, components, providers, caches, database helpers, or booking context.

Use synthetic property, provider, traveler-report source, and URL identities. Do not use live offers, production provider calls, persisted saved deals, real review text, or outbound affiliate navigation. The provider-shaped button targets a local inert study destination and is labeled as described in §9.

Every screen starts with this persistent research label:

`Research prototype — arrival information is not part of ranking or Deal Score.`

Study conditions:

1. **Control:** current honest area/guest-rating gaps and provider handoff.
2. **Variant A:** detail ledger plus a material handoff reminder when applicable.
3. **Variant B, research only:** one concrete sourced shortlist fact, the same detail ledger, and the same handoff reminder.

Variant B is not a proposed release. Reject all shortlist placement unless the specific Gate 2 comparison rule passes.

## 4. Information architecture and hierarchy

Product-shaped detail order:

1. Property and stay
2. **Arrival information** prototype ledger
3. Price and Deal Score
4. Hotel fit
5. Check rooms with provider, with one conditional reminder
6. Supporting evidence

The prototype ledger is a top-level `<section aria-labelledby="arrival-information-title">`. DOM and visual order are identical:

1. Prototype label
2. `h2`: **Arrival information**
3. Boundary sentence
4. `h3`: **Property and provider facts**
5. Zero to three fact rows, including explicit state text
6. `h3`: **Traveler reports**
7. One topic-report row or an explicit state sentence
8. `h3`: **What to confirm**
9. One or more material actions, or the no-action sentence
10. Evidence revision, visible only in the researcher diagnostics footer

Within the ledger:

- **Primary:** the three named evidence-class headings and each factual/report/action statement.
- **Secondary:** scope, source, observation date, report count, and review period.
- **Tertiary:** lexical caveats, research label, and fixture revision. Tertiary content remains visible and meets contrast requirements.

No content is hidden behind a tooltip. The default detail condition is fully expanded. A separate compact-disclosure study condition is permitted only to test focus return; it cannot replace the fully visible ledger in the comprehension study.

### Fact-row limit and selection

Show at most three rows, in this order:

1. location precision;
2. documented arrival instruction;
3. documented entry, contact, or transfer instruction.

Within row 3, the researcher selects the scenario-relevant owned fact before the session. The UI does not automatically pick the most reassuring fact. Valid facts are not suppressed because another domain is missing. Unresolved material items remain in **What to confirm**.

## 5. Research-only presentation model

This model is fixture schema, not a proposed addition to `lib/types.ts`:

```ts
type ArrivalPrototypeLoadState = 'loading' | 'ready' | 'refreshing' | 'error'

type ArrivalPrototypeEvidenceState =
  | 'current'
  | 'explicit_unavailable'
  | 'not_provided'
  | 'check_failed'
  | 'unclear'
  | 'conflicting'
  | 'stale'
  | 'malformed'

type ArrivalPrototypeFact = {
  id: 'location' | 'arrival_instruction' | 'entry_contact_or_transfer'
  state: ArrivalPrototypeEvidenceState
  statement?: string
  sourceLabel?: string
  scope?: 'property' | 'selected_stay' | 'pre_booking' | 'post_booking'
  observedAt?: string
  material: boolean
}

type ArrivalPrototypeReport = {
  state: ArrivalPrototypeEvidenceState
  topic: 'arrival_instructions'
  statement?: string
  sourceLabel?: string
  qualifyingCount?: number
  reviewPeriodStart?: string
  reviewPeriodEnd?: string
  displayLicensed: boolean
  material: boolean
}

type ArrivalPrototypeSnapshot = {
  schemaVersion: 1
  fixtureRevision: string
  loadState: ArrivalPrototypeLoadState
  providerPropertyId: string
  facts: ArrivalPrototypeFact[]
  report: ArrivalPrototypeReport
}
```

### Resolver invariants

- `current` content renders only with a non-empty source and valid scope.
- A location statement uses an existing `HotelLocation` fixture. Area is not promoted to an address. Coordinates are not promoted to neighborhood context.
- A distance statement renders only with anchor and `straight_line` method and always includes the caveat in §6.
- An arrival instruction renders as what the source says to do. It never resolves to an arrival outcome.
- A report renders only when `displayLicensed === true`, topic is `arrival_instructions`, source is present, `qualifyingCount` is a positive integer, and both valid review-period endpoints exist.
- Invalid report provenance resolves to `malformed`; its statement, count, and dates are suppressed.
- Multiple distinct current statements about the same item resolve to `conflicting`. The renderer shows both attributed statements and chooses neither.
- A source-owned freshness rule sets `stale`; the prototype must not invent a global age threshold.
- Missing source, invalid scope/date/count, property mismatch, unsupported lifecycle scope, or unrecognized state resolves to `malformed`.
- `refreshing` preserves the last complete snapshot and revision on screen until the replacement resolves atomically.
- Location-only evidence never suppresses unresolved arrival-instruction actions.
- The resolver never reads guest rating, stars, price, photo, city, Deal Score, or general review text.

## 6. Final copy system

Only fixture-backed proper nouns, dates, distances, and sourced instruction content may vary. The complete study fixtures in §8 provide the exact rendered strings.

### Persistent labels

| Element | Final copy |
| --- | --- |
| Prototype label | `Research prototype — arrival information is not part of ranking or Deal Score.` |
| Ledger heading | `Arrival information` |
| Boundary | `These are sourced facts, traveler reports, and details to confirm. expaify does not assess the property or route.` |
| Facts heading | `Property and provider facts` |
| Reports heading | `Traveler reports` |
| Confirmation heading | `What to confirm` |
| No material task | `No unresolved arrival item is included in this scenario. Confirm current property policies with the booking provider before payment.` |
| Research continuation | `Continue in prototype` |

### Fact metadata

| Scope | Final copy |
| --- | --- |
| `property` | `Property-level information` |
| `selected_stay` | `Information for this selected stay` |
| `pre_booking` | `Pre-booking information` |
| `post_booking` | `Available only after booking; not used as pre-booking evidence` |
| Source with observation date | `Source: {source}. Observed {Month D, YYYY}. {scope}.` |
| Source without observation date | `Source: {source}. Observation date not provided. {scope}.` |

An observation date describes when the data was seen, not when the property last changed it.

### Evidence-state language

Use the item noun shown in the fixture. Do not replace these with `Unknown`, `N/A`, an em dash, or icon-only treatment.

| State | Final visible rule | Treatment |
| --- | --- | --- |
| `current` | Show the bounded sourced statement and metadata. | Neutral |
| `explicit_unavailable` | `The property reports no {item}.` | Neutral bounded fact; never danger styling |
| `not_provided` | `{Source} did not provide {item}.` | Neutral |
| `check_failed` | `{Item} could not be checked.` | Actionable error |
| `unclear` | `{Source}'s {item} was unclear.` | Actionable warning |
| `conflicting` | `Sources disagree about {item}.` | Actionable warning; show both statements |
| `stale` | `{Item} was last observed {date}; confirm the current details.` | Actionable warning; retain original statement/source |
| `malformed` | `{Item} could not be shown because the supplied details were invalid.` | Actionable error; suppress invalid values |

### Strict lexical patterns

- Distance: `{distance} straight-line from {anchor}; not travel time or route quality.`
- Arrival instruction: `The property says to contact it before {time} for later arrival.`
- Transfer negative: `The property reports no airport transfer.`
- Traveler report: `Travelers report receiving clear late-arrival instructions.`
- Material detail action: `Confirm the late-arrival instructions with {provider or property} before you book.`
- Handoff reminder: `Before continuing: confirm {specific unresolved arrival item} with {provider or property}. expaify has not confirmed this for your stay.`

A documented `24 hours` value may describe only its exact sourced dimension. It cannot produce continuous-staffing, entry, admission, or security copy.

### Traveler-report metadata

- Complete: `{count} qualifying arrival-topic reports · {Month YYYY}–{Month YYYY} · Source: {source}.`
- No report evidence: `Arrival-specific traveler reports not provided.`
- Never show an aggregate guest score, overall review count, star class, or general sentiment inside this region.

## 7. Complete state behavior

### Default ready / complete

Render all three class headings, up to three current facts, the valid traveler report, and either material actions or the no-material-task sentence. There is no animation, delayed reveal, auto-focus, success color, check mark, or `all clear` copy.

### Partial

Render each valid fact/report unchanged. Render the exact missing, failed, unclear, stale, or conflicting state in its class. Add one action for each unresolved item marked `material`, deduplicated by domain. Unrelated missing data does not invalidate a current item.

### Explicit unavailable

Render the bounded source assertion in **Property and provider facts**. Example: `The property reports no airport transfer.` Metadata remains visible. Do not render `unsafe`, `not suitable`, danger color, or an inferred traveler report. Add a confirmation action only when the study fixture marks the unavailable service material to the scenario.

### Not provided / empty

An entirely empty evidence payload becomes three explicit sentences, not an empty panel:

- `Northstar Booking did not provide a street address or arrival instructions.`
- `Arrival-specific traveler reports not provided.`
- `Confirm the property location and late-arrival instructions with Northstar Booking before you book.`

Missing does not produce a negative property statement. There is no retry unless the fixture explicitly simulates a failed check.

### Check failed / error

If the entire ledger request fails:

- keep all class headings visible;
- under facts show `Property and provider facts could not be checked.`;
- under reports show `Arrival-specific traveler reports could not be checked.`;
- under confirmation show `Confirm the property location and late-arrival instructions with Northstar Booking before you book.`;
- show **Retry prototype check** only when the harness has a deterministic next state.

The error does not disable Back, study navigation, disclosure, or **Continue in prototype**.

### Unclear

Show the source-specific unclear statement and do not display a normalized positive paraphrase. Example: `Northstar Booking's late-arrival instructions were unclear.` Action: `Confirm the late-arrival instructions with Northstar Booking before you book.`

### Conflicting

Lead with `Sources disagree about the late-arrival contact time.` Then show both statements in a nested list:

- `Harbor House Hotel says to contact it before 10:00 PM.`
- `Northstar Booking says to contact the property before 9:00 PM.`

End with `No source was chosen as current.` The action is `Confirm the current late-arrival contact time with Harbor House Hotel before you book.` Never select the newer or more reassuring source in the UI.

### Stale

Keep the original bounded statement and source visible, followed by `Late-arrival instructions were last observed May 12, 2025; confirm the current details.` The action is `Confirm the current late-arrival instructions with Harbor House Hotel before you book.` The stale item stays stale at handoff.

### Malformed

Suppress invalid values and show `Arrival information could not be shown because the supplied details were invalid.` Add the scenario-specific confirmation action. Do not expose raw values, provider payloads, stack traces, partial dates, invalid counts, or a source-less report.

### Loading

- Set `aria-busy="true"` on the ledger.
- Keep the ledger title, boundary, and three class headings visible.
- Under facts, one `role="status" aria-live="polite" aria-atomic="true"` sentence reads `Checking property and provider facts…`.
- Under reports, visible text reads `Checking arrival-specific traveler reports…`; it is part of the same atomic status update, not a second live region.
- Three neutral skeleton rows are `aria-hidden="true"`.
- Do not show a confirmation action until the fixture resolves.
- Existing navigation and **Continue in prototype** stay enabled.
- On resolution, update the live region once; do not move focus.

### Refreshing

Keep the last resolved ledger and revision visible. Add one polite status line: `Checking for updated arrival information…`. Set `aria-busy="true"`. Resolve all facts, report, actions, and revision atomically. Never mix revisions or independently refresh a single reassuring item.

### Retry

**Retry prototype check** appears only for a deterministic `error → declared fixture` transition. While retrying, it is disabled and reads `Retrying prototype check…`. On success or repeated failure, focus moves to the ledger status container (`tabIndex={-1}`) whose first sentence is respectively `Arrival information updated.` or `Arrival information still could not be checked.` These status sentences are announced once and then remain visible until the next researcher action.

### Unexpected or missing fixture

Fail closed to the malformed presentation. The provider-shaped continuation remains available. Never fall back to default positive content or production data.

## 8. Required controlled fixtures and exact rendered copy

All identities are synthetic. Each fixture has an immutable revision shared by shortlist, detail, and handoff conditions.

### `complete_current` — revision `arrival-fixture-01`

**Property and provider facts**

- `Address: 14 Harbor Lane, Port Aurelia.`
  `Source: Harbor House Hotel. Observed July 28, 2026. Property-level information.`
- `4.2 km straight-line from Port Aurelia Airport; not travel time or route quality.`
  `Source: Northstar Booking. Observed July 28, 2026. Pre-booking information.`
- `The property says to contact it before 10:00 PM for later arrival.`
  `Source: Harbor House Hotel. Observed July 28, 2026. Information for this selected stay.`

**Traveler reports**

- `Travelers report receiving clear late-arrival instructions.`
  `18 qualifying arrival-topic reports · January 2026–June 2026 · Source: Wayfarer Reviews.`

**What to confirm**

- `No unresolved arrival item is included in this scenario. Confirm current property policies with the booking provider before payment.`

No handoff reminder renders.

### `partial_material_unknown` — revision `arrival-fixture-02`

**Property and provider facts**

- `Area: Old Port.`
  `Source: Northstar Booking. Observed July 28, 2026. Pre-booking information.`
- `Northstar Booking did not provide late-arrival instructions.`
- `The property reports no airport transfer.`
  `Source: Harbor House Hotel. Observed July 28, 2026. Property-level information.`

**Traveler reports**

- `Arrival-specific traveler reports not provided.`

**What to confirm**

- `Confirm the street address and late-arrival instructions with Northstar Booking before you book.`

Handoff: `Before continuing: confirm the street address and late-arrival instructions with Northstar Booking. expaify has not confirmed this for your stay.`

### `not_provided` — revision `arrival-fixture-03`

Use the exact three sentences in the not-provided state in §7. Handoff repeats: `Before continuing: confirm the property location and late-arrival instructions with Northstar Booking. expaify has not confirmed this for your stay.`

### `explicit_unavailable` — revision `arrival-fixture-04`

- Location: use the current address row from `complete_current`.
- Arrival instruction: `The property reports that arrivals after 11:00 PM are not accepted for this selected stay.`
- Transfer: `The property reports no airport transfer.`
- Metadata for both assertions: `Source: Harbor House Hotel. Observed July 28, 2026. Information for this selected stay.`
- Reports: `Arrival-specific traveler reports not provided.`
- Action: `Confirm the arrival cutoff with Harbor House Hotel before you book.`
- Handoff: `Before continuing: confirm the arrival cutoff with Harbor House Hotel. expaify has not confirmed this for your stay.`

This fixture tests comprehension of a bounded negative, not a risk judgment.

### `check_failed` — revision `arrival-fixture-05`

Use the entire-ledger error and retry copy in §7. The deterministic retry resolves to `partial_material_unknown` with revision `arrival-fixture-02`; no intermediate mixed revision is visible.

### `unclear` — revision `arrival-fixture-06`

- Facts: current address row; `Northstar Booking's late-arrival instructions were unclear.`; `Northstar Booking did not provide entry instructions.`
- Reports: `Arrival-specific traveler reports not provided.`
- Action and handoff: use the late-arrival instruction copy in §7, addressed to Northstar Booking.

### `conflicting` — revision `arrival-fixture-07`

Use the exact conflict copy and both statements in §7. Reports: `Arrival-specific traveler reports not provided.` Use the conflict action and handoff addressed to Harbor House Hotel.

### `stale` — revision `arrival-fixture-08`

- Preserve `The property says to contact it before 10:00 PM for later arrival.` and its Harbor House Hotel source.
- Follow it with the exact stale sentence and action in §7.
- Reports: `Arrival-specific traveler reports not provided.`
- Handoff retains the stale state through the exact handoff pattern addressed to Harbor House Hotel.

### `malformed` — revision `arrival-fixture-09`

Use the malformed copy in §7. The hidden inputs include an invalid report count, invalid date, missing source, and unsupported scope; none render. Action: `Confirm the property location and late-arrival instructions with Northstar Booking before you book.` Use the matching handoff reminder.

### `loading_to_complete` and `refreshing_to_conflict`

- Loading resolves atomically to `complete_current`.
- Refreshing begins with `complete_current` visible, then resolves atomically to `conflicting`.
- Verify the live-region, focus, and immutable-revision behavior in §7 and §11.

### Five-second scenario fixtures

- Late arrival at `11:40 PM` uses `partial_material_unknown`, `complete_current`, and `conflicting` in counterbalanced order.
- Unfamiliar destination uses `complete_current` and `not_provided` in counterbalanced order.
- The planned arrival time appears only in the moderator prompt. It does not produce a fit result or enter the ledger.

## 9. Shortlist and handoff study variants

### Shortlist control and Variant A

No new arrival line appears on the shortlist. Participants open the same synthetic detail using the existing **View deal** action. Variant A begins only on detail.

### Variant B — research only

Render exactly one two-line, non-interactive fact below property identity and above price:

- `Late arrival instruction`
- `Contact Harbor House Hotel before 10:00 PM.`

Metadata in the same semantic group: `Source: Harbor House Hotel · Observed July 28, 2026.` The whole group has no icon, fill, badge shape, positive color, click target, ranking weight, or accessible endorsement. It renders only for `complete_current` and uses revision `arrival-fixture-01`.

Do not show a shortlist line for area-only, address-only, distance-only, traveler-report-only, not-provided, failed, unclear, conflict, stale, malformed, or explicit-unavailable fixtures. Do not substitute another available positive fact.

### Provider-shaped handoff

When at least one unresolved item is material, render one neutral reminder immediately above **Continue in prototype**. Combine related items into one grammatical sentence. Do not duplicate the full ledger. When all items are current and sourced, render no banner or reassurance copy.

The reminder is not a modal, checkbox, acknowledgement gate, or disabled-state prerequisite. Loading, errors, invalid fixtures, and research analytics failures never disable continuation.

## 10. Responsive layout

### Mobile — 375px viewport

- Page gutter: `px-4`; ledger: `p-4`; vertical section spacing: `space-y-4`.
- One column only. Facts, reports, and confirmation groups stack in DOM order.
- Rows use `min-w-0`; statements and metadata use `break-words`.
- Never truncate, clamp, horizontally scroll, or put source/date in a side column.
- Buttons are full width and at least 44px tall.
- Conflict statements stack; no comparison table.
- The ledger may exceed one viewport. No sticky internal header or sticky reminder.
- At 320px minimum body width and 200% text zoom, content reflows without horizontal scrolling or overlap.

### Desktop — 1280px viewport

- Preserve the current page container `max-w-[1080px] px-6 py-8`.
- The ledger remains one reading column; use `max-w-3xl` for copy.
- Facts may use a three-column grid only when all three are `current` and each statement remains understandable independently: `lg:grid-cols-3`.
- Any partial, error, stale, unclear, malformed, or conflicting condition stays one column so state and action remain adjacent.
- Reports and **What to confirm** always span the full ledger width.
- Do not create a right-rail score, summary card, map, or reassurance panel.

### Zoom and localization resilience

- At 400% browser zoom (effectively narrow layout), use the mobile order.
- Allow dates, sources, addresses, and provider names to wrap.
- Do not rely on English string length for fixed heights.
- Time copy uses explicit `AM`/`PM` in the English prototype; do not show bare `22:00` beside localized prose.

## 11. Keyboard, focus, and assistive technology

Normal tab/reading order:

1. existing Back control;
2. page/property heading;
3. **Arrival information** heading;
4. facts content;
5. traveler-report content;
6. confirmation content;
7. **Retry prototype check**, only when present;
8. existing intervening page content;
9. handoff reminder;
10. **Continue in prototype**.

Static rows, headings, caveats, and source metadata are not tab stops. DOM order must match visual order. Do not use positive/negative icons as accessible names.

### Disclosure study condition

If the optional compact study condition is enabled:

- trigger label when closed: `Show arrival information`;
- trigger label when open: `Hide arrival information`;
- use a native `<button>` with `aria-expanded` and `aria-controls`;
- Enter and Space toggle it;
- opening leaves focus on the trigger; reading continues into the newly revealed heading;
- closing returns/retains focus on the trigger;
- Escape may close only when focus is inside the disclosure, then returns focus to the trigger;
- no content is placed in a modal or focus trap.

### Live updates

- Loading/refreshing status uses one polite, atomic live region.
- Do not announce every skeleton or every row.
- Initial ready content is not force-announced or auto-focused.
- Retry completion follows §7. Programmatic focus uses the status container only after a user-triggered retry, never after passive loading.
- A reminder inserted by researcher fixture change is `role="status"` only if it appears after a user action; otherwise it is normal static text.

### Semantics

- Each evidence class is a labeled subsection.
- Use `<dl>` only for genuine label/value facts; wrap every `dt`/`dd` pair in a `<div>`.
- Use `<ul>` for conflicting source statements and confirmation actions.
- Loading uses `aria-busy`; failures do not use `role="alert"` because continuation remains available and the issue is not urgent system danger.
- Text, heading, border, and explicit state copy convey state. Color is supplemental.

## 12. Tailwind and token specification

Use existing tokens from `app/globals.css`; add no color, radius, type, or shadow token.

### Ledger shell

```text
rounded-[var(--radius-card)] border border-[color:var(--border)]
bg-[color:var(--bg-surface)] p-4 sm:p-6
```

- Prototype label: `text-caption font-medium uppercase tracking-wide text-[color:var(--brand)]`
- `h2`: `mt-2 text-xl font-medium text-[color:var(--text-1)] sm:text-2xl`
- Boundary: `mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-2)]`
- Evidence-class stack: `mt-5 space-y-5`
- `h3`: `text-base font-semibold text-[color:var(--text-1)]`

### Neutral row

```text
min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] p-3.5
```

- Statement: `text-sm font-medium leading-6 text-[color:var(--text-1)]`
- Caveat/body: `mt-1 text-sm leading-6 text-[color:var(--text-2)]`
- Metadata: `mt-1 break-words text-xs leading-5 text-[color:var(--text-3)]`

### State treatment

- `not_provided`: neutral row; statement uses `text-[color:var(--text-2)]`.
- `explicit_unavailable`: neutral row; no error/warning fill.
- `unclear`, `conflicting`, `stale`: `border-[color:var(--gold-deep)] bg-[color:var(--warning-soft)]`; heading/statement remains `text-[color:var(--text-1)]`; qualifier may use `text-[color:var(--warning)]`.
- `check_failed`, `malformed`: `border-[color:var(--accent)] bg-[color:var(--error-soft)]`; error copy uses `text-[color:var(--error-text)]`, never `var(--error)` as text.
- Confirmation group: `rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-muted)] p-3.5`.

Every warning/error row includes its explicit text state; the border/fill is never the only distinction.

### Loading and controls

- Skeleton: `skeleton h-4 rounded` with varied widths, wrapper `aria-hidden="true"`.
- Retry: existing `btn btn-outline btn-sm`; loading label remains visible.
- Provider-shaped action: existing `btn btn-primary min-h-11 w-full` pattern in the harness.
- Focus relies on global `:focus-visible` and `--focus-ring`; do not remove outlines.

### Motion

Only the existing skeleton pulse and existing 160ms control transitions are allowed. Respect `prefers-reduced-motion` by rendering static skeleton fills. No celebratory, success, reorder, count-up, or auto-scroll animation.

## 13. Interaction and continuity rules

- Opening detail reads the immutable snapshot assigned to that study condition.
- The full ledger is informational. Rows do not expand, select, rank, or launch external navigation.
- Enter/Space on Retry invokes only the declared fixture transition.
- Enter/Space on **Continue in prototype** records local study progression and opens the inert handoff screen; it never calls a provider.
- A check failure does not block continuation.
- An evidence refresh swaps the complete snapshot atomically.
- The same `fixtureRevision`, source, state, scope, observation time, report count, and review period must survive shortlist → detail → handoff.
- A stale or conflicting detail item remains stale or conflicting at handoff.
- The handoff reminder is derived from the same snapshot and cannot strengthen or summarize away uncertainty.
- Failed research-event capture is silent and never changes UI or navigation.

Before a future production release, an equivalent immutable revision would have to survive `HotelOffer` → active deal detail → `BookingHotelContext` → `BookingFlow`. This prototype does not add that path.

## 14. Validation plan and release gates

Both gates are cumulative. Passing comprehension without supply, or supply without comprehension, does not authorize production work.

### Gate 1 — approved source and normalized coverage

Product and Engineering must approve a provider contract and inspect at least 200 returned properties across at least five markets and two arrival contexts. Per property and field, the sample must prove:

- stable property ID and claim-level source identity;
- location precision, address/coordinate provenance, and distance method;
- check-in/late-arrival instruction without inferred staffing;
- entry/key/contact/transfer instruction and lifecycle scope;
- observation time or explicit absence;
- distinct not-provided, explicit unavailable, malformed, conflict, and stale normalization;
- for any traveler report: licensed display scope, arrival topic, source, qualifying count, and review period;
- an attributable affiliate-marked outbound URL using approved credentials.

Production pilot threshold: at least 30% of sampled properties have one decision-useful, non-location arrival fact after normalization. This is a proposed validation threshold, not an industry benchmark. Report topic-review coverage separately; it cannot borrow the arrival-fact denominator. Report each market and arrival context separately so an aggregate does not hide a coverage gap.

Gate 1 fails if any required source, scope, lifecycle, licensing, state, or deeplink attribute is inferred, unavailable, or contractually unapproved.

### Gate 2 — moderated comprehension and decision value

Run 8–10 moderated sessions with first-time or infrequent hotel-comparison users who travel alone at least occasionally. Include at least four late-arrival and four unfamiliar-destination scenarios. Test complete, partial, not-provided, explicit-unavailable, failed, unclear, stale, conflicting, malformed, loading, and retry states at 375px and 1280px.

Compare the control, Variant A, and Variant B described in §3. Counterbalance order and ask participants after five seconds to identify the relevant candidate, then classify each item without showing the section labels.

Required pass conditions:

- at least 90% correctly classify property/provider fact, traveler report, and unknown;
- at least 90% understand straight-line distance is not travel time or route quality;
- at least 90% understand an arrival instruction is not guaranteed admission or staffing;
- at least 90% distinguish not-provided from explicit unavailable;
- at least 85% distinguish stale and conflict from a current fact;
- no more than 10% interpret any condition as an expaify safety endorsement;
- changing only aggregate rating, stars, price, photo, city, or Deal Score never changes a cue;
- Variant B materially improves five-second identification of a relevant candidate over control without increasing endorsement or missing-as-negative errors.

Define `materially improves` before sessions begin as an absolute improvement of at least 15 percentage points in correct five-second candidate identification. Report participant-level results and confidence intervals; do not optimize provider continuation rate alone.

### Decision rule

- If Gate 1 fails: no UI/DEV handoff; retain the prototype as research documentation.
- If Gate 2 classification, lexical-boundary, or endorsement thresholds fail: reject the ledger and all shortlist placement; return to UXDES after new research.
- If Variant A passes but Variant B misses its improvement rule or increases either error: reject shortlist placement; a later approved ticket may consider detail/handoff only.
- If both gates pass and provider-contract blockers are resolved: create a new, explicitly approved production UXDES ticket. Do not reinterpret this document as production authorization.

## 15. Blocking and out-of-scope findings

### Blocking production work

- Current normalized providers return no late-arrival, front-desk, entry/key, check-in-time, or arrival-contact record.
- Current adapters return no licensed topic-specific traveler report with source, qualifying count, and review period.
- The active Booking.com RapidAPI and Hotelbeds paths rely on secret names outside the approved contract and do not provide attributable affiliate deeplinks.
- No representative production payload/prevalence sample exists.
- Current analytics cannot measure comprehension; the reported emitter/collector enum mismatch remains outside this ticket.
- `HotelCard` is not mounted and the hotel NDJSON path has no client, so component-only work would not change the active experience.

These blockers are why this ticket creates no UI or DEV handoff.

### Explicitly out of scope

- safety scores, rankings, filters, badges, crime/neighborhood data, routing/maps, incident monitoring, staff verification, certifications, or predictive risk;
- provider selection, credentials, API integration, review licensing/mining/summarization, and raw-review display;
- arrival-time input, itinerary joining, property messaging, request submission, concierge behavior, or guaranteed entry;
- price, Deal Score, affiliate, snapshots, analytics-schema, and component-mount repairs;
- changes to location, check-in logistics, transport, admission, access, disruption, luggage, smoking, and review-relevance contracts owned by adjacent work.

## 16. UXDES acceptance checklist

- [x] Labeled validation-only and not ship-ready.
- [x] Implements all five research directives: detail-only boundary, three evidence classes, distinct uncertainty states, strict lexical rules, and immutable revision/handoff continuity.
- [x] Covers default, complete, partial, explicit unavailable, not provided, check failed, unclear, conflicting, stale, malformed, loading, refreshing, error, retry, and unexpected states.
- [x] Defines exact visible strings and accessible update behavior.
- [x] Covers 375px, 1280px, zoom/reflow, keyboard, focus, and disclosure return.
- [x] Uses current design tokens and explicit Tailwind patterns.
- [x] Preserves owned evidence domains without proposing duplicate production fields.
- [x] Prohibits aggregate rating, stars, price, photo, city, Deal Score, and missing data as cue inputs.
- [x] Documents the live `DealCard`/saved-detail versus unmounted `HotelCard` split.
- [x] Includes controlled fixtures, measures, thresholds, supply gate, comprehension gate, and shortlist rejection rule.
- [x] Creates no UI/DEV handoff while gates and provider-contract blockers remain unresolved.

## Handoff status

**STOP. No next-stage ticket is created.** Reopen only through a new approved UXDES ticket after Gate 1, Gate 2, and the provider-contract/deeplink blockers are resolved with recorded evidence.
