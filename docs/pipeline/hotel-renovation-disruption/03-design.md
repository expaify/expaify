# UXDES-HOTEL-RENOVATION-DISRUPTION-01: Hotel Renovation Disruption Visibility

**Ticket:** `UXDES-HOTEL-RENOVATION-DISRUPTION-01` · **Stage:** UXDES · **Priority:** P0  
**Date:** 2026-07-31 · **Feature slug:** `hotel-renovation-disruption`  
**Inputs:** `docs/pipeline/hotel-renovation-disruption/01-discovery.md`, `docs/pipeline/hotel-renovation-disruption/02-research.md`

## 1. Decision and delivery boundary

Specify one continuous, non-suppressive disclosure in the active journey:

`DealCard` → saved hotel detail `Hotel fit` → `Check rooms with provider` → `CompareRow`.

A qualifying, explicitly attributed supplier notice appears as a concise result cue, complete evidence in `Hotel fit`, and a persistent repeat immediately before provider links. It never changes price, Deal Score, ranking, result count, provider eligibility, or affiliate attribution.

Populated supplier states are implementation-ready contracts and test fixtures, **not production facts**. The repository cannot currently carry renovation or closure evidence through its provider, cache, persistence, deal API, or saved-detail record. Until DEV adds that end-to-end contract and a real supplier returns valid evidence:

- no production card may show a populated disruption cue;
- saved detail must use the honest `not_returned` state only when a supplier check completed without usable information, or `check_failed` when a real check failed;
- fixture/query-string data must be isolated from production and visibly identified in test/research harnesses;
- supplier silence must never render as `No renovations`, `No closures`, `No disruption`, or `Hotel unaffected`.

The existing snapshot pipeline's direct vendor call, unapproved `RAPIDAPI_KEY`, missing provenance fields, and the merge markers reported in `lib/db/schema.sql` remain blocking DEV dependencies. UI may build the presentation contract without inventing live records.

## 2. User outcome

A first-time traveler can answer, before leaving expaify:

1. What renovation, construction, closure, or restriction did a supplier report?
2. Which guest area, facility, service, or access path is affected?
3. Does the reported timing overlap all, part, none, or an unknown portion of the searched stay?
4. Which source supplied the statement, when was it checked, and is it current?
5. Which impact or timing facts remain unknown or disputed?
6. Can the traveler still inspect rooms and retain the option? Always yes when a valid attributed link exists and unrelated eligibility rules permit it.

## 3. Scope

### In scope

- Optional qualifying cue in the active `DealCard`, between stay identity and price.
- Full `Renovation and closures` evidence inside saved-detail `Hotel fit`.
- Persistent, compact repeat inside `Check rooms with provider`, before `CompareRow`.
- `reported`, `not_returned`, `check_failed`, `malformed`, `conflicting`, and `stale_unconfirmed` evidence states.
- `overlap`, `partial_overlap`, `no_overlap`, and `timing_unknown` date relationships.
- Initial loading, refresh, refresh failure, empty inventory, missing stay dates, malformed stay dates, provider-link unavailable, criteria mismatch, expired deal, and explicit post-provider-return states.
- 375px and 1280px layout, keyboard order, focus, screen-reader language, fixtures, and bounded analytics.

### Out of scope

- Scraping reviews, photos, maps, permits, news, or public records.
- Inferring disruption, severity, noise, safety, facility importance outside the bounded list, or current status from price or wording tone.
- A disruption filter, sort, rank penalty, Deal Score input, recommendation, suitability score, or booking block.
- Contacting a property, collecting free-text traveler needs, or claiming expaify verified conditions.
- Parsing supplier prose in React.
- Altering or stripping existing affiliate markers.
- Repairing the snapshot provider-boundary violation or database merge markers in this UXDES ticket.
- Wiring the unused `HotelCard` → `/book` journey. If reactivated later, it must carry the identical evidence revision and copy rules.

## 4. Information architecture and hierarchy

### 4.1 Results: `DealCard`

Fixed order:

1. **Primary:** hotel name and searched stay identity.
2. **Secondary decision interrupt, only when qualified:** one disruption cue naming the impact/scope and stay relationship.
3. **Primary commercial evidence:** observed nightly price, usual price, savings, Deal Score/deal chip, and price freshness.
4. Property photo.
5. **Primary action:** `View deal`.
6. Price-check methodology.

The cue is not a badge and is not dismissible. It cannot become the card title, cover the photo, or displace the price/action. `no_overlap`, non-material reported work, `not_returned`, `check_failed`, `malformed`, and non-material `stale_unconfirmed` render no card cue.

### 4.2 Saved hotel detail: `Hotel fit`

Keep the page's current section order:

1. Property and stay.
2. Price and Deal Score.
3. Hotel fit.
4. Check rooms with provider.
5. Supporting evidence.

Within `Hotel fit`, retain hotel class and guest rating first, then add one always-present section titled `Renovation and closures`. Its internal hierarchy is:

1. State heading or decision summary.
2. Searched-stay relationship.
3. Affected area/facility and concrete supplier-reported impact.
4. Reported schedule/dates and hours.
5. Separate attributed supplier statement(s).
6. Source and checked date.
7. Evidence boundary and current-condition instruction.

Complete evidence must not be placed only in `Supporting evidence`, a tooltip, modal, or collapsed `details` element.

### 4.3 Provider handoff

Inside `Check rooms with provider`, order content as:

1. Existing section title.
2. Existing provider-confirmation and date guidance.
3. Persistent `Before you continue` disruption repeat for every qualifying or unresolved material state.
4. `CompareRow` label and attributed provider links.

Every resolved evidence state gets a compact repeat so the evidence does not disappear at the decision boundary. Neutral `no_overlap`, non-material reported, and `not_returned` states use calm styling and exact uncertainty language; `check_failed`, `malformed`, `conflicting`, and material `stale_unconfirmed` use unresolved treatment. The repeat is static content, not a required acknowledgement checkbox.

## 5. Provider-neutral evidence contract

UI consumes a normalized object. This is a downstream DEV contract and must live with shared/provider types, not inside a React component.

```ts
type HotelDisruptionEvidenceState =
  | 'reported'
  | 'not_returned'
  | 'check_failed'
  | 'malformed'
  | 'conflicting'
  | 'stale_unconfirmed'

type HotelDisruptionLoadState = 'loading' | 'ready' | 'refreshing'

type HotelDisruptionNoticeType =
  | 'renovation'
  | 'construction'
  | 'facility_closure'
  | 'facility_restriction'
  | 'access_restriction'
  | 'service_restriction'

type HotelDisruptionImpactClass =
  | 'reported_noise'
  | 'guest_room_work'
  | 'guest_area_work'
  | 'arrival_or_checkin'
  | 'guest_circulation'
  | 'primary_facility_closure'
  | 'primary_facility_restriction'
  | 'access_limitation'
  | 'service_limitation'
  | 'non_guest_cosmetic'
  | 'impact_not_provided'

type HotelDisruptionRelation =
  | 'overlap'
  | 'partial_overlap'
  | 'no_overlap'
  | 'timing_unknown'

type SupplierDisruptionStatement = {
  id: string
  noticeType: HotelDisruptionNoticeType
  impactClasses: HotelDisruptionImpactClass[]
  affectedScopes: string[]
  summaryImpactLabel?: string
  sourceLabel: string
  sourceText: string
  sourceLanguage?: string
  reportedStart?: string
  reportedEnd?: string
  reportedHours?: string
  supplierSeverityLabel?: string
  observedAt: string
}

type HotelDisruptionEvidence = {
  loadState: HotelDisruptionLoadState
  state: HotelDisruptionEvidenceState
  relation?: HotelDisruptionRelation
  material: boolean
  promoted: boolean
  statements: SupplierDisruptionStatement[]
  evidenceRevision: string
}
```

Contract rules:

- `reported` requires one valid attributed statement, valid `observedAt`, and an evidence revision. `sourceText` is plain text, control-character stripped, safely rendered, and length-bounded; the UI does not interpret it.
- `not_returned` means a supplier check completed and returned no qualifying statement. It does not mean no work exists.
- `check_failed` means the request or upstream check failed. It is not interchangeable with `not_returned`.
- `malformed` means content was returned but required attribution/type/safe-text validation failed, or a supplied date was invalid. An omitted date remains a valid `timing_unknown`, not malformed. The malformed raw payload is never rendered.
- `conflicting` requires at least two individually valid, separately attributed current statements that disagree on status, affected scope, dates, or impact. Never merge or select a winner.
- `stale_unconfirmed` retains the last valid statement after its approved evidence-age window or a failed refresh. It cannot be presented as current.
- `promoted` is derived outside React and may be true only for the threshold in section 6. The UI may defensively suppress an impossible combination but must not calculate materiality from prose.
- `supplierSeverityLabel` may be displayed as `Supplier description: {label}` only when it is safe plain text. It never becomes an expaify severity badge.
- `affectedScopes` preserve supplier-named areas/facilities. They do not imply all property areas are affected.
- `summaryImpactLabel` is an adapter-produced, length-bounded label selected from an approved vocabulary. React never derives it from `sourceText`. `sourceLanguage`, when supplied, is a valid BCP 47 language tag used for visible language labeling and the HTML `lang` attribute.
- Source wording and revision must remain identical across result, detail, and handoff. Surface-specific summaries may shorten the statement only through deterministic normalized templates.
- All external lookups remain behind `lib/providers` and return `Result<T>`. Components receive resolved data and never call suppliers.

## 6. Deterministic promotion and date rules

### 6.1 Materiality

`material = true` only when at least one valid statement contains one of:

- `reported_noise`;
- `guest_room_work`, `guest_area_work`, `arrival_or_checkin`, or `guest_circulation`;
- `primary_facility_closure` or `primary_facility_restriction` for a named pool, restaurant, spa, lift/elevator, parking, beach access, fitness center, or the property's only advertised equivalent;
- `access_limitation` or `service_limitation` with a concrete supplier-described consequence.

`non_guest_cosmetic`, `impact_not_provided`, a bare renovation keyword, an unknown date, or a supplier severity adjective alone is not material.

### 6.2 Date computation

- Searched stay is half-open `[checkIn, checkOut)`.
- Supplier calendar dates are treated as inclusive because no end time is known.
- A statement overlaps when `reportedStart < checkOut` and `reportedEnd >= checkIn`.
- `overlap`: work covers every night or the supplier provides only one broad range that spans the stay.
- `partial_overlap`: valid bounds intersect some but not all stay dates.
- `no_overlap`: valid bounds establish no intersection.
- `timing_unknown`: either endpoint is missing, the source says `until further notice`, only relative prose exists, or the searched stay is incomplete/malformed.
- Never generate a missing endpoint, parse `next month`, treat `until further notice` as permanently current, or downgrade unknown timing to no overlap.

### 6.3 Promotion formula

```text
promoted = valid explicit attribution
  AND material
  AND relation in (overlap, partial_overlap, timing_unknown)
```

For `conflicting` and material `stale_unconfirmed`, promote when any retained valid statement could materially affect the stay and current non-overlap cannot be established. For `malformed`, do not promote a factual claim; detail and handoff use unresolved-check copy.

## 7. Final UI copy

Use en-US absolute dates: `Aug 14, 2026`. When time is supplied, retain the supplier's stated local-time label or timezone; do not silently convert it.

### 7.1 Shared labels and boundaries

| Element | Final copy |
|---|---|
| Detail section | `Renovation and closures` |
| Handoff repeat heading | `Before you continue` |
| Source with checked date | `Source: {sourceLabel}. Checked {Month D, YYYY}.` |
| Missing source date fallback | `Checked date not provided. This notice cannot be treated as current.` |
| Evidence boundary | `Supplier-reported information; expaify has not verified current conditions or guest impact.` |
| Provider instruction | `Confirm current conditions, affected areas, and facility access with the provider before booking.` |
| No severity | `The supplier did not provide an impact level.` |
| No affected scope | `The supplier did not identify an affected area or facility.` |
| No hours | Do not render an hours row. Never say `No noise outside these hours.` |

### 7.2 Result cue templates

Use the first deterministic template that applies. Maximum two wrapped lines at 1280px; allow the full copy to wrap at 375px. Never ellipsize the impact or relation.

| Condition | Exact cue |
|---|---|
| Named facility closed, overlap | `{Facility} reported closed during your stay` |
| Named facility restricted, overlap | `{Facility} access reported limited during your stay` |
| Reported noise, overlap | `Construction noise reported during your stay` |
| Guest-room/guest-area work, overlap | `{Area} work reported during your stay` |
| Access/service limitation, overlap | `{Impact} reported during your stay` |
| Any qualifying partial overlap | `{Impact} reported for part of your stay` |
| Qualifying impact, timing unknown | `{Impact} reported · timing not provided` |
| Conflict could overlap | `Supplier notices conflict · your stay may be affected` |
| Stale material notice | `Earlier disruption notice could not be reconfirmed` |

`{Impact}` must be a bounded normalized label such as `Lobby access limits`, `Reduced lift access`, or `Pool closure`, never arbitrary prose. If no safe concise label exists, use `Guest disruption` only when a material class is already valid; otherwise do not promote.

### 7.3 `reported` detail copy by relation

| Relation | State heading | Relationship copy |
|---|---|---|
| `overlap` | `{Impact} is reported during your stay` | `Reported dates overlap your stay from {checkIn} to {checkOut}.` |
| `partial_overlap` | `{Impact} is reported for part of your stay` | `Reported dates overlap {overlapStart} to {overlapEnd} of your stay.` |
| `no_overlap` | `Reported work is outside your stay dates` | `The supplier reports {workStart} to {workEnd}; your stay is {checkIn} to {checkOut}.` |
| `timing_unknown` | `{Impact} is reported; timing is not clear` | `The supplier did not provide enough timing information to rule out your stay.` |

Evidence rows:

| Label | Value rule |
|---|---|
| `Affected area or facility` | Comma-separated safe normalized scope labels; if absent use the exact unknown copy above. |
| `Reported impact` | Concrete normalized impacts only. `Noise reported, 9:00 AM–5:00 PM local property time` is valid; `Major disruption` is not unless labeled `Supplier description`. |
| `Reported schedule` | `{workStart}–{workEnd}` plus hours when supplied. Missing bounds render `Start date not provided` and/or `End date not provided` separately. |
| `Supplier description` | Supplier severity label only, prefixed as specified; never color-code it as expaify severity. |
| `Supplier statement` | Safe source text, visibly quoted, followed by source metadata. |

Reported handoff repeat:

- Heading: `Before you continue`
- Summary: reuse the exact result cue if promoted; for `no_overlap`, `The supplier reports this work outside your stay dates.` For non-material reported evidence, use one of: `The supplier reports {scope} work, with no guest impact reported.` or `The supplier reports renovation, but did not identify an affected area or guest impact.`
- Source line: `Reported by {sourceLabel}; checked {Month D, YYYY}.`
- Instruction: `Confirm current conditions, affected areas, and facility access with the provider before booking.`

### 7.4 Evidence-state copy

| State | Detail heading | Exact detail body | Handoff summary |
|---|---|---|---|
| `not_returned` | `Renovation and closure details were not provided` | `This supplier did not return renovation, construction, or facility-closure information. This does not mean the hotel is unaffected.` | `This supplier did not provide renovation or closure information. Confirm current conditions with the provider if they matter to your stay.` |
| `check_failed` | `Renovation and closure details could not be checked` | `We could not check supplier-reported disruption information. The hotel, price, and Deal Score are still available.` | `We could not check renovation or closure details. Confirm current conditions with the provider before booking.` |
| `malformed` | `Returned disruption details could not be verified` | `The supplier returned information we could not safely attribute or interpret. We are not showing it as a hotel fact.` | `Supplier disruption details could not be verified. Confirm current conditions with the provider before booking.` |
| `conflicting` | `Supplier notices do not agree` | `Current supplier statements disagree about the reported work, affected area, impact, or dates. We are not choosing one as correct.` | `Supplier notices conflict, and your stay may be affected. Compare the statements below and confirm current conditions with the provider.` |
| `stale_unconfirmed` | `Earlier disruption notice could not be reconfirmed` | `This supplier notice is older than the approved evidence window, or its refresh failed. It may no longer describe current conditions.` | `An earlier disruption notice could not be reconfirmed. Confirm current conditions with the provider before booking.` |

`conflicting` renders each valid statement separately under `Supplier statements`, preserving source, scope, dates, impact, observed time, and exact safe wording. `stale_unconfirmed` renders the prior statement under `Earlier supplier statement`. `malformed` renders no raw statement, source name, or inferred facts.

### 7.5 Loading and refresh copy

| State | Visible copy | Assistive behavior |
|---|---|---|
| Initial evidence loading | `Checking renovation and closure details` / `We’re checking supplier-reported information for this hotel.` | Section has `aria-busy="true"`; one polite status announces `Checking renovation and closure details.` |
| Refreshing valid evidence | `Refreshing supplier notice…` / `Showing the earlier supplier statement while we check for an update.` | Retain prior statement, mark it stale, remove current/promoted semantics, and do not move focus. |
| Refresh succeeded | Normal resolved copy | Polite announcement: `Renovation and closure details updated.` |
| Refresh failed with prior evidence | `Notice refresh failed. The earlier supplier statement is shown and is not treated as current.` | Resolve to `stale_unconfirmed`; announce `The supplier notice could not be refreshed.` |
| Retry pending | Button: `Checking details…` | Disable only retry; preserve card, price, score, and links. |
| Retry failed without prior evidence | `Renovation and closure details still could not be checked.` | Remain `check_failed`; focus stays on retry. |

Retry button copy: `Try disruption check again`. Retry is offered only when the application has an approved independent evidence request. It retries that request only; it does not reload or remove the hotel.

### 7.6 Provider-return copy

Do not infer mismatch from back navigation or elapsed time. When the page regains visibility after a tracked provider handoff, retain the identical evidence and revision. An optional bounded prompt may appear beneath the disruption repeat:

- Question: `Did the provider show different renovation or closure details?`
- Actions: `Yes, details were different` and `No`.
- After Yes: `Thanks. We’ll record that the provider details did not match this notice.`
- After No: remove the prompt with no claim about booking outcome.

The prompt must not collect free text, ask which need was affected, or imply a complaint was sent to the property. It appears at most once per session + deal + evidence revision and only after an actual attributed provider link activation followed by document visibility.

## 8. Complete state and placement matrix

| Evidence/state | Relation/materiality | Result card | Hotel fit | Pre-handoff repeat | Provider links |
|---|---|---|---|---|---|
| No hotel inventory | N/A | Existing inventory empty state only | N/A | N/A | N/A |
| Evidence loading on identified hotel | unresolved | No factual cue; card skeleton reserves one optional cue row only in fixture/loading variant | Loading status | `Checking…` only if handoff is already rendered | Enabled |
| `reported` | material + overlap | Qualifying cue | Full attributed evidence | Required | Enabled |
| `reported` | material + partial overlap | Qualifying cue | Full attributed evidence | Required | Enabled |
| `reported` | material + timing unknown | Qualifying cue | Full attributed evidence and unknown endpoints | Required | Enabled |
| `reported` | material + no overlap | No cue | Neutral full evidence | Compact no-overlap repeat | Enabled |
| `reported` | non-material + any relation | No cue | Neutral full evidence | Required neutral repeat; preserve impact unknowns | Enabled |
| `not_returned` | not computable | No cue | Honest empty evidence state | Calm unknown repeat | Enabled |
| `check_failed` | unresolved | No cue | Error copy and optional scoped retry | Required unresolved repeat | Enabled |
| `malformed` | unresolved | No factual cue | Safe error copy; no raw payload | Required unresolved repeat | Enabled |
| `conflicting` | any valid material statement may overlap | Conflict cue | Separate statements | Required | Enabled |
| `conflicting` | all valid statements non-material/no-overlap | No cue | Separate neutral statements | Compact conflict repeat | Enabled |
| `stale_unconfirmed` | earlier material statement may overlap | Stale cue | Earlier statement, visibly stale | Required | Enabled |
| `stale_unconfirmed` | non-material or proven no-overlap | No cue | Earlier neutral statement | Compact stale repeat only if current state is unresolved | Enabled |
| Stay dates missing/malformed | material notice | Timing unknown cue | State dates unavailable; do not calculate overlap | Required | Enabled with existing date guidance |
| Deal expired | any | Existing expired behavior | Evidence remains for reference | Existing expired action replaces provider links; no booking instruction | No provider links per existing rule |
| Criteria mismatch | any | No change | Evidence remains visible | Existing mismatch status takes priority; disruption summary remains above it | Disabled by existing mismatch rule |
| No attributed provider links | any | No change | Evidence remains visible | Disruption repeat precedes existing unavailable-link state | No links |
| Page-level load error/not found | unknown | No new content | Preserve existing page error/not-found state | N/A | N/A |

If evidence fails, only that evidence region changes. Never replace the full card, hide the hotel, zero the result count, or recalculate Deal Score.

## 9. Component specifications and Tailwind patterns

### 9.1 Result cue

Render a semantic paragraph inside the card link. The icon is optional and decorative; the text is mandatory.

```tsx
<p className="mt-2 flex min-w-0 items-start gap-2 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] px-3 py-2 text-caption font-medium leading-5 text-[color:var(--text-1)]">
  <span aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--warning)]">…</span>
  <span className="min-w-0 break-words">{cue}</span>
</p>
```

- No `role="alert"`, button, close control, tooltip, or nested link.
- Card `aria-label` appends `Supplier notice: {cue}.` exactly once.
- Cue colors use `--warning-soft`, `--warning`, `--text-1`, and `--border-strong`; never use `--error` for a non-emergency notice.
- When absent, render no gap.

### 9.2 Detail evidence panel

```tsx
<section aria-labelledby={headingId} className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4 sm:p-5">
  <h3 className="text-base font-medium text-[color:var(--text-1)]">Renovation and closures</h3>
  <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">{stateHeading}</p>
  <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{stateBody}</p>
  <dl className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">…</dl>
</section>
```

- Use `dt` with `text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]` and `dd` with `mt-1 break-words text-sm leading-6 text-[color:var(--text-1)]`.
- Supplier statement containers use `border-l-2 border-[color:var(--border-strong)] pl-3`; use `<q>` or visible quotation marks, not a disabled input.
- Conflict statements remain one column even at 1280px to preserve source-to-statement grouping.
- `not_returned` is neutral `bg-[color:var(--bg-raised)]`; `check_failed`/`malformed` use `bg-[color:var(--error-soft)]` with `text-[color:var(--error-text)]` only for the state label; unresolved/stale/conflict uses `bg-[color:var(--warning-soft)]` without implying emergency severity.

### 9.3 Handoff repeat

```tsx
<section aria-labelledby={handoffId} className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-4">
  <h3 className="text-sm font-medium text-[color:var(--text-1)]">Before you continue</h3>
  <p className="mt-1 text-sm leading-6 text-[color:var(--text-1)]">{summary}</p>
  <p className="mt-2 text-xs leading-5 text-[color:var(--text-2)]">{sourceAndInstruction}</p>
</section>
```

Neutral `not_returned` and `no_overlap` use `bg-[color:var(--bg-raised)]`. Place `CompareRow` in the next sibling with `mt-4`. Do not nest provider links inside this section.

### 9.4 Skeletons

- Feed card loading fixture adds a single `skeleton h-10 w-full rounded-[var(--radius-control)]` after the stay identity and before price so populated qualifying cards do not produce an avoidable layout jump.
- Saved detail loading adds a stable Hotel-fit panel skeleton with heading, two 20px lines, and three evidence rows; the full page remains `aria-busy` under the existing loading route, with skeletons `aria-hidden`.
- Evidence-only loading after page content exists uses the visible loading copy; do not show an indefinite spinner or skeletonize price/score/provider links.

## 10. Responsive behavior

### 375px

- Page horizontal padding remains 16px; card horizontal padding remains 16px.
- Result cue uses full available width and natural wrapping. No `line-clamp`, fixed height, horizontal scroll, or absolute positioning.
- Hotel-fit evidence is one column. Each `dt` precedes its `dd`; statements stack source by source.
- Long facility names, source labels, and supplier text use `break-words`. URLs are never shown.
- Handoff repeat is full width above provider actions. `CompareRow` remains one column at 375px in its primary variant, with each action at least 44px high.
- Provider-return actions stack vertically and are each at least 44px.
- A 160-character fixture statement and 40-character source label must not overflow at 320px, the current application minimum.

### 1280px

- Preserve the existing 1080px detail content maximum and results grid/card widths.
- Result cues remain inside their own card; cards in the same grid row do not need equal heights beyond the existing grid behavior.
- Evidence rows may use two columns, but summary, relationship, source statement, boundary, and conflict statements span both columns.
- Handoff repeat remains above the two-column provider grid, not beside it, so every keyboard path reaches the notice before either provider.

### Zoom and text resizing

- At 200% browser zoom, layout follows the 375px single-column behavior without clipped text or horizontal scrolling.
- Do not cap section height or make supplier text independently scrollable.

## 11. Accessibility and interaction rules

- Static notices use ordinary semantic content, not `role="alert"`. `role="status"`/`aria-live="polite"` is reserved for loading, retry completion, refresh completion, and explicit provider-return feedback.
- Heading levels follow page order: page `h1`; page sections `h2`; disruption subsection and `Before you continue` `h3`.
- DOM/tab order: back link → page content → Hotel-fit evidence → disruption retry if present → provider-handoff copy → disruption repeat → provider links → later supporting evidence.
- The card remains one link. Do not add a nested `Learn more` control. Its accessible name includes the qualifying cue but not the full supplier statement.
- All provider links retain visible focus using the global `3px` `--primary` outline and `--focus-ring`, open in a new tab, and preserve `rel="noopener noreferrer sponsored"` plus the required affiliate query marker.
- Retry focus remains on the retry button. Success updates content without moving focus; failure remains actionable.
- On initial page-level error, preserve the existing focus-to-heading behavior. An evidence-only failure must not steal focus.
- Color and icon never carry `overlap`, `conflict`, `stale`, or failure meaning alone.
- Supplier statement language remains in its source language if no trustworthy translation exists; add a visible language label when known. Do not machine-translate silently in UI.
- Dates are rendered as text, and screen-reader copy says `Reported dates overlap your stay`, not only `Overlap`.

## 12. Fixtures and exact expected outcomes

All populated records below are synthetic and must be named `fixture` in code/tests. They cannot enter production responses, persistence, or analytics.

Use searched stay `Aug 14–18, 2026` unless stated otherwise.

| ID | Synthetic statement | Expected relation/state | Card cue | Key detail copy | Handoff |
|---|---|---|---|---|---|
| `daytime_noise_full` | Harbor Stay Supplier: guest-room renovation, Aug 1–31, noise 9:00 AM–5:00 PM | `reported`, material, `overlap` | `Construction noise reported during your stay` | `Construction noise is reported during your stay`; show rooms, hours, dates, source | Required |
| `pool_closed_full` | Coast Rooms: pool closed Aug 10–20; no noise statement | `reported`, material, `overlap` | `Pool reported closed during your stay` | Say only pool closed; `The supplier did not provide an impact level.` | Required |
| `lobby_partial` | Stay Partner: lobby work Aug 14–15 | `reported`, material, `partial_overlap` | `Lobby work reported for part of your stay` | `Reported dates overlap Aug 14 to Aug 15 of your stay.` | Required |
| `access_timing_unknown` | Room Source: main entrance access limited; no dates | `reported`, material, `timing_unknown` | `Main entrance access limits reported · timing not provided` | Show missing start and end separately | Required |
| `cosmetic_back_office` | Property Source: back-office repainting Aug 1–31; no guest impact | `reported`, non-material, `overlap` | None | Neutral detail; no guest impact inference | Neutral repeat |
| `rooms_end_before_stay` | Harbor Stay Supplier: guest-room renovation Jul 1–Aug 12 | `reported`, material, `no_overlap` | None | `Reported work is outside your stay dates` | Neutral repeat |
| `impact_unspecified` | Property Source: `Renovation underway`; Aug 1–31; no area/impact | `reported`, non-material, `overlap` | None | `The supplier did not identify an affected area or facility.` and no severity claim | Neutral repeat |
| `conflicting_sources` | Source A: pool closed Aug 10–20; Source B: pool reopened Aug 13 | `conflicting`, material, could overlap | `Supplier notices conflict · your stay may be affected` | Two separate statements; no winner | Required |
| `stale_noise` | Earlier valid guest-room/noise statement observed outside approved freshness window; refresh failed | `stale_unconfirmed`, material | `Earlier disruption notice could not be reconfirmed` | Preserve earlier source/dates with stale heading | Required |
| `not_returned` | Successful check, zero usable statements | `not_returned` | None | Exact not-returned copy; never `No disruption` | Calm unknown repeat |
| `check_failed` | Supplier check returns `Result` failure | `check_failed` | None | Scoped error and optional retry | Required unresolved repeat |
| `malformed_missing_source` | Returned text lacks attribution/valid source | `malformed` | None | No raw text; exact malformed copy | Required unresolved repeat |
| `missing_stay_dates` | Valid pool closure statement; searched stay incomplete | `reported`, material, `timing_unknown` | `Pool closure reported · timing not provided` | Explain stay relationship cannot be calculated because stay dates are incomplete | Required |
| `until_further_notice` | Lift restriction, valid source, no end date | `reported`, material, `timing_unknown` | `Reduced lift access reported · timing not provided` | Preserve `until further notice` only in supplier quote; show end date not provided | Required |

Fixture acceptance:

- same `evidenceRevision`, source label, statement, dates, scopes, and impacts reach result, detail, and handoff;
- card visibility exactly matches the table;
- no fixture changes array order, result count, price, Deal Score, deal chip, or provider link eligibility;
- the supplier statement is never used as an analytics value;
- all fixtures render without overflow at 375px and 1280px.

## 13. Bounded analytics contract

Analytics measures exposure and explicit mismatch only. It does not infer rejection, suitability, health/sleep needs, booking, or causality from back, close, scroll, or abandonment.

### Events

| Event | Trigger | Required bounded properties |
|---|---|---|
| `hotel_disruption_notice_impression` | Qualifying result cue is at least 50% visible for one continuous second | `surface`, `notice_type`, `relation`, `impact_class`, `evidence_state`, `viewport_band`, `revision_bucket` |
| `hotel_disruption_detail_reached` | Detail evidence region is at least 50% visible for one continuous second | same |
| `hotel_disruption_handoff_reached` | Pre-handoff repeat is at least 50% visible for one continuous second | same |
| `hotel_disruption_handoff_clicked` | Eligible provider link activated after the same revision's handoff reach | same plus bounded `provider` |
| `hotel_disruption_return_reason` | Traveler explicitly selects `Yes, details were different` | `reason=renovation_or_closure_details_mismatch`, `evidence_state`, `relation`, `revision_bucket`, `viewport_band` |

### Allowed values

- `surface`: `results | detail | handoff`
- `notice_type`: contract enum values; for conflict use `multiple`, for malformed/failure/no record use `unavailable`
- `relation`: `overlap | partial_overlap | no_overlap | timing_unknown | not_computable`
- `impact_class`: one bounded material impact class; use `multiple | not_provided | unavailable` fallbacks
- `evidence_state`: `reported | not_returned | check_failed | malformed | conflicting | stale_unconfirmed`
- `viewport_band`: `mobile_375 | desktop_1280 | other`
- `revision_bucket`: an opaque, non-reversible bucket/version with maximum 40 characters, never raw source text or a timestamp
- `provider`: existing `expedia | booking | kiwi | trip`
- `reason`: only `renovation_or_closure_details_mismatch`

Deduplicate impressions by session/search + offer/deal + surface + evidence revision. Do not send hotel name, hotel/deal ID, source label, source prose, affected-scope free text, dates, URLs, price, location, user profile, or traveler needs in these events. The existing generic provider-handoff event may continue to carry its current bounded deal identifier; the new disruption events must not duplicate it.

If analytics is unavailable, the UI and provider navigation continue without error copy. Analytics must never gate the link.

## 14. Interaction acceptance criteria

1. Every hotel remains in its original result order and count for every evidence state.
2. Price, Deal Score, score confidence, deal chip, and snapshot copy remain unchanged.
3. A valid attributed provider link remains enabled for material overlap, partial overlap, unknown timing, conflict, stale, malformed, and check failure.
4. Every qualifying populated notice is visible on the result card before `View deal`, complete in `Hotel fit`, and repeated before the first provider link.
5. `no_overlap`, cosmetic/non-guest work, impact-unspecified work, and `not_returned` never produce a result-level warning.
6. `not_returned`, `check_failed`, `malformed`, `conflicting`, and `stale_unconfirmed` remain visibly distinct in detail and handoff.
7. Missing stay dates produce `timing_unknown`, never overlap or no-overlap.
8. Conflicting statements are separately attributed; no UI-selected winner or merged date appears.
9. Stale evidence never uses present-tense current-fact styling or wording.
10. Static notices do not use alerts; dynamic updates are politely announced without focus theft.
11. At 375px and 1280px, all copy is readable, actions are at least 44px, and there is no clipping, collision, or horizontal scroll.
12. Provider links preserve host validation, affiliate parameter validation, sponsored relationship, and existing new-tab behavior.
13. Production builds do not display populated fixture evidence unless an explicitly isolated test/research harness is active.

## 15. UI and DEV handoff

### UI implementation scope

- Add reusable presentation components for result cue, detail ledger, and handoff repeat.
- Add optional evidence props without renaming/removing current exports or changing existing card/deal contracts beyond additive optional fields.
- Implement all visual states with synthetic fixtures/tests; production defaults must not fabricate populated evidence.
- Update feed and detail skeletons for the optional evidence region.
- Preserve active journey layout, score, price, result order, and provider links.
- Add responsive and accessibility tests for 375px and 1280px.

### Required later DEV scope

- Add the provider-neutral shared model and `Result<T>` provider normalization.
- Route all supplier calls through `lib/providers`; resolve the pre-existing snapshot violation before live evidence.
- Persist source, safe statement, dates, scopes, observed time, and evidence revision.
- Serialize one evidence revision through deals API and saved-deal detail.
- Compute materiality/date relation outside React using the deterministic rules above.
- Add the bounded analytics allow-list and validation.
- Prove affiliate links remain unchanged.

Populated production delivery is blocked until the DEV path exists and a supplier contract proves the data is actually returned. UI-only completion is a presentation contract, not evidence coverage.

## 16. QA matrix

Run every fixture in section 12 at 375px and 1280px and verify:

- card cue presence/absence;
- exact copy, source attribution, date relation, and unknown labels;
- identical revision continuity across all three surfaces;
- keyboard sequence and focus visibility;
- screen-reader heading and description order;
- 200% zoom and long-text wrapping;
- evidence-only loading/retry/refresh;
- criteria mismatch, expired deal, missing provider link, page error, and not-found interactions;
- explicit provider-return prompt and bounded `Yes`/`No` behavior;
- no ranking, score, price, inventory, or affiliate-link regression;
- analytics visibility threshold, deduplication, property allow-list, and non-blocking failure.

The formative release gate remains the UXR target: at least 90% unprompted result detection for qualifying fixtures, 100% pre-handoff detection, at least 90% correct avoidance of clearly unsuitable fixtures, at least 85% retention of viable non-overlap/cosmetic fixtures, at least 85% comprehension per evidence dimension, zero interpretation of `not_returned` as no work after teach-back, and no false result-card promotions.
