# UXDES-HOTEL-WIFI-RELIABILITY-01: Wi-Fi evidence validation prototype

Date: 2026-07-31  
Stage: UX Design (UXDES)  
Priority: P0  
Upstream: `docs/pipeline/hotel-wifi-reliability/02-research.md`

## 1. Decision and release boundary

**Current release decision: STOP production UI.** This specification defines a
research-only, fixture-backed prototype and a provider-contingent data contract.
It does not authorize a production badge, summary, filter, sort, rank, Deal Score
input, or reliability verdict. The current Hotellook path retains none of the
required Wi-Fi evidence and therefore cannot distinguish one hotel from another.

The prototype tests whether a connectivity-dependent traveler can answer four
questions independently before leaving expaify:

1. **Access:** does the source document Wi-Fi for this property or stay?
2. **Cost for this rate:** is Wi-Fi included, paid, or not specified for the
   selected rate?
3. **Coverage:** does the evidence apply to public areas, guest rooms, the
   selected room/rate, or only the property generally?
4. **Reliability evidence:** is there qualifying measured performance,
   Wi-Fi-specific guest reporting, both, or no qualifying reliability evidence?

The prototype must use typed fixtures behind a research-only boundary. It must
not read raw provider JSON, expose secrets, call a provider from a component, or
silently fall back to stars, aggregate guest rating, price, property type, brand,
photos, marketing prose, Deal Score, or ordinary review snippets.

### Actual target surfaces

- **Primary validation surface:** the mounted saved-deal detail at
  `app/deals/[dealId]/page.tsx`.
- **Continuity surface:** the mounted hotel review in `HotelHandoffReview` at
  `app/book/BookingFlow.tsx`, before the provider action.
- **Research comparison only:** a compact summary condition may be tested in a
  prototype after participants have first passed the details-only condition.

`app/components/HotelCard.tsx` is not mounted by the active path and is not an
implementation target. `/deals` `DealCard` must remain unchanged in the first
prototype round. A details-unavailable fallback must not be repeated on every
collapsed card.

### Explicitly prohibited claims and treatments

Do not use these labels or close synonyms:

- `Reliable Wi-Fi`, `Fast Wi-Fi`, `Strong Wi-Fi`, `Verified Wi-Fi`
- `Good for calls`, `Video-call ready`, `Work-ready`, `Remote-work friendly`
- `Wi-Fi score`, `Connectivity score`, or a combined evidence grade
- any checkmark, star, meter, red/amber/green status, or Deal Score styling that
  converts source evidence into an expaify verdict

Measured speed is a time- and location-bound observation, not a future guarantee.
Guest reports are reported experience, not measurement. Both may be shown, but
neither may be promoted to a suitability verdict.

## 2. Information architecture and hierarchy

### 2.1 Saved-deal detail

For the prototype, preserve the current page-level hierarchy and place one new
section between **Hotel fit** and **Check rooms with provider**:

1. Saved hotel and stay context.
2. Price and price-only Deal Score.
3. Hotel fit, including existing rate-inclusion/review evidence when present.
4. **Wi-Fi evidence** ledger.
5. Check rooms with provider.
6. Supporting evidence.

Within **Wi-Fi evidence**, read in this fixed order:

1. Heading and non-guarantee boundary.
2. Overall request state, if loading, not returned, stale, error, or conflict.
3. `Access`.
4. `Cost for this rate`.
5. `Coverage`.
6. `Reliability evidence`.
7. `Measured performance`, when qualifying evidence exists.
8. `Guest-reported Wi-Fi`, when qualifying evidence exists.
9. Confirmation guidance, when selected-stay coverage/cost is not confirmed or
   evidence conflicts.

The four answers never collapse into one status. An access fact may be confirmed
while cost, guest-room coverage, and reliability remain unknown.

### 2.2 `/book` continuity

Repeat the exact same normalized evidence state in `HotelHandoffReview` after the
existing **Hotel fit** content and before **Check rooms with provider**. Do not
fetch fresher Wi-Fi evidence only at handoff and do not reinterpret the detail
state. If a refresh is required, update both views from one normalized object and
announce the changed evidence before the provider action.

The `/book` version keeps all four answer rows and every limitation. It may use a
more compact container, but no copy or source metadata may disappear. A failure
to serialize the object is `not_returned`, never `unavailable`.

Wi-Fi evidence never disables, hides, or relabels an otherwise valid provider
action. The traveler may continue even when evidence is missing, stale, or in
conflict.

### 2.3 Primary, secondary, and tertiary hierarchy

- **Primary on the page:** hotel/stay identity, selected price context, and the
  provider continuation action.
- **Primary inside the ledger:** the four plain-language answers, in fixed order.
- **Secondary:** measured and guest-reported evidence families, kept separate.
- **Tertiary:** source, scope, observation/review window, sample information,
  fetched date, and non-guarantee copy.

The ledger is decision support, not the page conversion target. Its visual weight
must remain below the hotel identity and provider action and separate from Deal
Score.

## 3. Provider-contingent view-model contract

The UI consumes one normalized, source-bound object. Providers and DEV own
normalization; components only render the supplied state. All external calls
remain in `lib/providers` and return the repository `Result<T>` contract.

```ts
type WifiEvidenceCheckState =
  | 'loading'
  | 'ready'
  | 'not_returned'
  | 'stale'
  | 'error'

type WifiAccessStatus = 'confirmed' | 'unavailable' | 'unknown' | 'conflict'
type WifiCostStatus = 'included' | 'paid' | 'not_specified' | 'conflict'
type WifiCoverageScope =
  | 'property'
  | 'public_areas'
  | 'guest_rooms'
  | 'room_type'
  | 'rate'
  | 'selected_stay'
  | 'not_specified'
  | 'conflict'

type WifiSource = {
  sourceId: string
  sourceLabel: string
  observedAt?: string
  fetchedAt: string
}

type WifiAccessEvidence = {
  status: WifiAccessStatus
  scope: WifiCoverageScope
  source: WifiSource
}

type WifiRateCostEvidence = {
  status: WifiCostStatus
  scope: 'rate' | 'selected_stay' | 'not_specified'
  money?: { priceCents: number; currency: string }
  billingBasis?: 'per_stay' | 'per_night' | 'per_device' | 'per_day'
  source: WifiSource
}

type WifiMeasurementMetric = {
  kind: 'download' | 'upload' | 'latency' | 'uptime'
  value: number
  unit: 'Mbps' | 'ms' | 'percent'
}

type WifiMeasuredEvidence = {
  kind: 'measured'
  metrics: WifiMeasurementMetric[]
  method: string
  locationLabel: string
  scope: WifiCoverageScope
  observationWindow: { start: string; end: string }
  sampleCount?: number
  frequency?: string
  source: WifiSource
}

type WifiReviewEvidence = {
  kind: 'review_signal'
  summary: string
  qualifyingReviewCount: number
  reviewWindow: { start: string; end: string }
  consistency: 'consistent' | 'mixed' | 'conflicting'
  source: WifiSource
}

type WifiConflictStatement = {
  dimension: 'access' | 'cost' | 'coverage' | 'measured_vs_review'
  sourceLabel: string
  statement: string
}

type HotelWifiEvidence = {
  checkState: WifiEvidenceCheckState
  access?: WifiAccessEvidence
  cost?: WifiRateCostEvidence
  coverage: WifiCoverageScope
  measuredEvidence?: WifiMeasuredEvidence
  reviewEvidence?: WifiReviewEvidence
  conflicts: WifiConflictStatement[]
  staleAsOf?: string
}
```

### Contract invariants

- `BookingHotelContext.wifiEvidence` must preserve the normalized object used on
  detail. Serialize only validated scalar fields; never raw provider payloads.
- `not_returned` means the source did not provide usable Wi-Fi details. It never
  means the property lacks Wi-Fi.
- `unavailable` requires an explicit source statement at the displayed scope.
- `included` or `paid` requires rate or selected-stay evidence owned by the
  hotel-rate-inclusions contract. Property-level `free_wifi` is not enough.
- A numeric fee uses `{ priceCents, currency }` only. If amount, currency, or
  billing basis is malformed, render cost as `not_specified`; do not show a
  partial fee.
- `guest_rooms` does not mean every room or the selected room. `selected_stay`
  requires a provider-bound selected product/rate identifier.
- Measured evidence is display-eligible only when metric/unit, method, location
  or scope, observation window, source, observation date, and sample count or
  frequency are present.
- Guest-reported evidence is display-eligible only when it is Wi-Fi-specific and
  has source, qualifying count, review window, and consistency.
- Measured and review families may coexist. Never average them, pick the more
  positive one, or use one to fill missing fields in the other.
- Any unresolved disagreement retains both attributed statements and adds a
  conflict state. The UI does not choose a winner.
- `stale` uses a source-specific evidence TTL. The six-hour price cache is not an
  evidence freshness rule.
- Aggregate guest rating, stars, Deal Score, and marketing text cannot populate
  any field in this contract.
- Malformed or unsupported evidence is suppressed and counted in provider
  validation; it must not cause the component to throw.

## 4. Component anatomy and semantic structure

```txt
WifiEvidenceLedger
├── section[aria-labelledby="wifi-evidence-title"]
│   ├── h2/h3 “Wi-Fi evidence”
│   ├── p boundary copy
│   ├── RequestState (conditional status)
│   ├── ConflictNotice (conditional)
│   ├── dl FourQuestionLedger
│   │   ├── EvidenceAnswer “Access”
│   │   ├── EvidenceAnswer “Cost for this rate”
│   │   ├── EvidenceAnswer “Coverage”
│   │   └── EvidenceAnswer “Reliability evidence”
│   ├── EvidenceFamily “Measured performance” (conditional)
│   ├── EvidenceFamily “Guest-reported Wi-Fi” (conditional)
│   └── ConfirmationAction (conditional)
```

Use a semantic `<dl>` for the four questions. Each row contains one `<dt>` and
one `<dd>`; supporting source/scope copy stays inside that `<dd>`. Measured and
guest-reported families are separate `<section>` elements with distinct headings.

Do not use a disclosure control in the first details-only prototype: the detail
page is already the inspection surface and every answer must be encountered
before the provider action. If the later compact-summary condition is tested, use
a real `<button type="button" aria-expanded aria-controls>`; do not make a whole
card clickable.

The source label is plain text unless there is a validated, safe source detail
URL. When a source link exists, its accessible name is `View {sourceLabel} Wi-Fi
evidence source`; it opens in the same tab in research unless the prototype is
explicitly measuring return behavior.

## 5. Final UI copy

All strings below are final. Fixture substitutions appear in braces and must be
escaped and line-wrapped safely.

### 5.1 Persistent copy

| Element | Exact copy |
|---|---|
| Heading | `Wi-Fi evidence` |
| Boundary | `These details describe what sources reported for this property or selected stay. They do not guarantee future Wi-Fi performance.` |
| Access label | `Access` |
| Cost label | `Cost for this rate` |
| Coverage label | `Coverage` |
| Reliability label | `Reliability evidence` |
| Measured family | `Measured performance` |
| Review family | `Guest-reported Wi-Fi` |

### 5.2 Request and non-positive states

| State | Exact visible copy | Rendering rule |
|---|---|---|
| Loading | `Checking Wi-Fi evidence…` | Polite status; four rows remain visible with `Checking…` values. |
| Not returned | `Wi-Fi details were not returned by this hotel source.` | Four rows use `Not specified`; no positive or negative icon. |
| Error | `Wi-Fi details could not be checked.` | Follow with confirmation guidance; never change to unavailable. |
| Stale | `Wi-Fi information is out of date.` | Suppress stale positive claims; show `Last reported {date}` when valid. |
| Conflict | `Wi-Fi evidence conflicts — confirm with the hotel.` | Retain each source statement below the relevant row/family. |
| Explicitly unavailable | `This source reports Wi-Fi is unavailable for the selected stay.` | Only for explicit selected-stay evidence; source is mandatory. |
| Partial reliability | `Wi-Fi is listed, but reliability evidence is not available.` | Access may remain confirmed; other unknown answers remain independent. |
| Confirmation guidance | `Confirm Wi-Fi access, charges, and room coverage with the hotel or booking provider before you book.` | Show for unknown, stale, error, or conflict affecting cost/coverage/access. |

### 5.3 Access answers

| Data state | Exact answer |
|---|---|
| Confirmed, property | `Wi-Fi is listed for the property.` |
| Confirmed, public areas | `Wi-Fi is listed in public areas.` |
| Confirmed, guest rooms | `Wi-Fi is listed in guest rooms.` |
| Confirmed, selected stay | `Wi-Fi is listed for the selected stay.` |
| Explicit unavailable, selected stay | `Wi-Fi is reported unavailable for the selected stay.` |
| Unknown/not returned/error/stale | `Not specified` |
| Conflict | `Sources disagree about Wi-Fi access.` |

Supporting line pattern: `Scope: {scope label} · Source: {sourceLabel} · Reported
{date}`. Omit only the date fragment when the provider supplies no valid
observation date; never substitute the price-check time.

### 5.4 Cost answers

| Data state | Exact answer |
|---|---|
| Included, selected rate | `Included in the selected rate.` |
| Paid, exact fee | `Extra charge: {formatted money} {billing basis}.` |
| Paid, amount unknown | `An extra charge is reported; the amount was not specified.` |
| Property says free, rate unknown | `The property lists free Wi-Fi, but inclusion in this rate is not confirmed.` |
| Not specified/error/stale | `Not specified for this rate.` |
| Conflict | `Sources disagree about the Wi-Fi charge for this rate.` |

Allowed billing-basis copy is `per stay`, `per night`, `per device`, or `per day`.
Do not print a bare currency amount. Supporting copy must name `Selected rate` or
`Selected stay` and its source.

### 5.5 Coverage answers

| Scope | Exact answer |
|---|---|
| Property | `Property-level only; guest-room coverage is not confirmed.` |
| Public areas | `Public areas only; guest-room coverage is not confirmed.` |
| Guest rooms | `Guest-room Wi-Fi is listed; this does not confirm every room.` |
| Room type | `Wi-Fi is listed for {roomType}; confirm the selected room.` |
| Rate | `Wi-Fi coverage is documented for this rate; confirm the selected room.` |
| Selected stay | `Wi-Fi coverage is documented for the selected stay.` |
| Not specified | `Guest-room coverage was not specified.` |
| Conflict | `Sources disagree about where Wi-Fi is available.` |

### 5.6 Reliability answers and evidence families

| State | Exact answer |
|---|---|
| No qualifying evidence | `Not established.` |
| Measured only | `Measured performance is available below.` |
| Review only | `Wi-Fi-specific guest reports are available below.` |
| Both, no conflict | `Measured performance and guest reports are available below.` |
| Both, conflict | `Measured performance and guest reports conflict.` |

Measured family copy pattern:

- Lead: `{metric label}: {value} {unit}`.
- Method: `Method: {method}.`
- Scope: `Measured at {locationLabel}; scope: {scope label}.`
- Window: `Observed {start date}–{end date}.`
- Sample: `Based on {sampleCount} measurements.` or
  `Measurement frequency: {frequency}.`
- Source: `Source: {sourceLabel} · Reported {observed date}.`
- Boundary: `This measurement is time- and location-bound and does not guarantee future performance.`

Metric labels are `Download`, `Upload`, `Latency`, and `Uptime`. Do not convert
values into qualitative labels such as fast, strong, stable, or call-ready.

Guest-report family copy pattern:

- Lead: `Guests report {summary}`.
- Sample: `Based on {count} Wi-Fi-specific reviews from {start date}–{end date}.`
- Consistency: `Reports were consistent.`, `Reports were mixed.`, or
  `Reports conflicted.`
- Source: `Source: {sourceLabel}.`
- Boundary: `Guest reports describe past experiences; they are not a performance measurement or guarantee.`

The normalized `summary` must be licensed, provider-derived, Wi-Fi-specific, and
grammatically complete after `Guests report`. Do not show raw snippets or quotes.

### 5.7 Conflict statements

Show the overall conflict sentence once. Within the affected answer or evidence
family, show every retained statement as:

`{sourceLabel}: {normalized statement}`

Never label one source correct, calculate a consensus, or suppress the less
positive statement. If a statement cannot be safely normalized, do not display
it; downgrade the affected answer to not specified and record the malformed item
in validation.

## 6. State specification

### Default research state

The default prototype fixture is property-level access confirmed, while selected
rate cost, guest-room coverage, and reliability are not established. It renders:

- Access: `Wi-Fi is listed for the property.`
- Cost: `Not specified for this rate.`
- Coverage: `Property-level only; guest-room coverage is not confirmed.`
- Reliability: `Wi-Fi is listed, but reliability evidence is not available.`
- Confirmation guidance.

This state deliberately contains no positive chip and no word `reliable`.

### Loading

Render the full section in its final position to prevent layout movement. Show
the boundary plus `Checking Wi-Fi evidence…` in `role="status" aria-live="polite"`.
Each `<dd>` says `Checking…`. Set `aria-busy="true"` on the section. Do not use a
spinner as the only label, hide the provider action, or trap focus. When complete,
replace the status and set `aria-busy="false"`; announce only the concise outcome
(`Wi-Fi evidence loaded.` or the relevant error/not-returned sentence).

### Empty / not returned

Show the heading, boundary, and final not-returned sentence. Keep the four labels
visible, each with a specific unknown answer: `Not specified`, `Not specified for
this rate.`, `Guest-room coverage was not specified.`, and `Not established.`
Do not show empty measured/review family containers. Do not render this fallback
on `/deals` cards.

### Error

Show `Wi-Fi details could not be checked.` and confirmation guidance. Four rows
remain explicit unknowns. The provider continuation remains available. There is
no retry control in the prototype unless the data layer exposes a safe, bounded
retry; if added later, label it `Check Wi-Fi details again`, prevent concurrent
requests, and move focus to the updated status only after a user-initiated retry.

### Stale

Show `Wi-Fi information is out of date.` and a valid `Last reported {date}`.
Suppress all stale positive answers and metrics rather than presenting them as
current facts. Keep retained stale source metadata available as text for research
comparison, but do not style it as an answer. Show confirmation guidance.

### Explicit unavailable

Only an explicit selected-stay statement can use the full unavailable sentence.
Access shows unavailable; cost is `Not applicable because Wi-Fi is reported
unavailable for the selected stay.`; coverage is `Selected stay.`; reliability is
`Not established.` The evidence source and date remain visible. Property-level
unavailable evidence uses `This source reports Wi-Fi is unavailable at the
property.` and must not imply a selected-stay provider guarantee.

### Partial evidence

Render every known answer and preserve unknowns independently. Property access
does not fill cost or coverage. Rate inclusion does not fill coverage. Room
coverage does not fill reliability. Use the partial reliability copy exactly.

### Measured evidence

Render the four answers first, followed by **Measured performance** with every
required method/scope/window/sample/source field. If any eligibility field is
missing, suppress the measured family and render reliability as `Not established.`
The presence of one metric does not permit a broader reliability claim.

### Guest-review signal

Render **Guest-reported Wi-Fi** separately after measured evidence. It must start
with `Guests report`, include count/window/consistency/source, and carry its
non-measurement boundary. Aggregate guest ratings and generic review counts do not
qualify. If any eligibility field is missing, suppress the family.

### Conflict

Show `Wi-Fi evidence conflicts — confirm with the hotel.` before the four rows.
Affected rows say that sources disagree; valid attributed statements appear
immediately below. If measured and review evidence conflict, show both full
families and their boundaries. Conflict never chooses a winner or blocks handoff.

### Malformed and long-content edge cases

- Unknown enum/value: suppress it and use the appropriate unknown answer.
- Invalid date: omit that date, never print `Invalid Date`.
- Empty or whitespace source: suppress the claim; provenance is mandatory.
- More than four metrics: show only the four allowed metric kinds in the contract
  order; duplicate kinds are malformed.
- Long hotel/source/method/location/room labels: wrap with
  `[overflow-wrap:anywhere]`; never truncate evidence-defining text.
- Large numbers use locale grouping; retain source precision and units. Do not
  manufacture decimals.
- Right-to-left and 200% zoom: logical reading order remains label, answer,
  evidence, source. No fixed heights.

## 7. Responsive layout and Tailwind patterns

Use only tokens already declared in `app/globals.css`.

### 7.1 Outer section

```tsx
<section
  aria-labelledby="wifi-evidence-title"
  className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6"
>
```

Heading and boundary:

```txt
heading:  text-xl font-medium leading-tight text-[color:var(--text-1)] sm:text-2xl
boundary: mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-2)]
```

### 7.2 Four-question ledger

```txt
dl:       mt-5 grid grid-cols-1 gap-3 md:grid-cols-2
row:      min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5
dt:       text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]
answer:   mt-1 text-sm font-medium leading-6 text-[color:var(--text-1)] [overflow-wrap:anywhere]
meta:     mt-1 text-xs leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]
```

At 375px the ledger is one column with no horizontal scrolling. At 1280px the
page retains its existing `max-w-[1080px]`; the four answers form two columns,
not four narrow columns. Evidence families remain full-width so method, scope,
window, and source read in order.

### 7.3 Status, conflict, and evidence families

```txt
neutral status: mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 text-sm leading-6 text-[color:var(--text-1)]
stale status:   mt-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-3.5 text-sm leading-6 text-[color:var(--text-1)]
error/conflict: mt-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--error-soft)] p-3.5 text-sm leading-6 text-[color:var(--text-1)]
family:         mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4
family title:   text-sm font-medium leading-6 text-[color:var(--text-1)]
family copy:    mt-2 space-y-1 text-sm leading-6 text-[color:var(--text-2)]
```

Color only supports hierarchy. Every state is stated in text. Do not use
`var(--error)` for text; use `var(--error-text)` only if an inline error label
needs emphasis. Do not use success green for confirmed access or measurements.

### 7.4 Confirmation action

The prototype uses guidance text, not a hotel contact integration. If a validated
hotel/provider contact URL later exists, use an ordinary secondary link:

```txt
inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-4 text-sm font-medium text-[color:var(--text-1)] no-underline hover:border-[color:var(--border-hover)] hover:bg-[color:var(--brand-soft)] focus-visible:border-[color:var(--border-focus)] focus-visible:shadow-[var(--focus-ring)]
```

Exact label: `Confirm Wi-Fi details with {hotel or provider}`. It must not replace
or compete visually with the main provider continuation action. An affiliate
provider URL must retain its affiliate marker byte for byte.

## 8. Interaction, keyboard, focus, and screen-reader rules

- The details-first ledger is read-only; no focus is placed inside it unless a
  valid source/confirmation link exists.
- DOM order matches visual order: boundary, status, four questions, measured,
  reviews, confirmation.
- Loading uses one polite live region. Do not mark the full ledger `aria-live`,
  because that would reread every row.
- Error, stale, not-returned, and conflict messages are not assertive alerts;
  Wi-Fi evidence does not represent an immediate system or safety emergency.
- A later compact-summary button has a minimum 44px target, a visible text label,
  `aria-expanded`, and `aria-controls`. Enter and Space toggle it. Focus stays on
  the button; Escape has no special behavior because there is no modal.
- Source and confirmation links have visible focus from `--focus-ring`, do not
  rely on icon-only names, and occur before the provider action in tab order.
- Measurements expose units in text. Dates use readable text, not only machine
  timestamps. Screen-reader output must identify each evidence family heading
  before its details.
- No state is distinguished by color, icon, position, or typography alone.
- At 200% zoom and 320px minimum app width, content reflows vertically without
  clipping, overlap, or horizontal scroll.

## 9. Research fixtures and test cases

Use otherwise comparable hotel and rate data. Randomize hotel order and evidence
condition. Every fixture is immutable and records expected answers.

| ID | Fixture | Expected visible outcome | Critical test |
|---|---|---|---|
| WF-01 | Property Wi-Fi confirmed; cost, room coverage, reliability absent | Default partial state; no positive reliability label | Available is not included; property is not room; not established is not bad |
| WF-02 | Selected-rate inclusion and guest-room coverage; no reliability evidence | Included + guest-room answers; reliability `Not established` | Inclusion/coverage do not imply performance |
| WF-03 | Qualifying measurements; no review signal | Full measured family with method/scope/window/sample/source | Participant classifies it as measured and time/location-bound |
| WF-04 | Qualifying mixed Wi-Fi review signal; no measurement | `Guests report…`, count/window/mixed/source | Participant classifies it as guest-reported, not measured |
| WF-05 | Measurement and reviews disagree | Overall conflict plus both attributed families | Participant does not pick either as a guarantee |
| WF-06 | Provider omitted Wi-Fi | Final not-returned sentence and four explicit unknowns | Missing is not unavailable |
| WF-07A | Provider request error | Final error sentence and guidance; provider action remains | Error is not unavailable; handoff remains usable |
| WF-07B | Evidence beyond approved TTL | Stale sentence; positive claims suppressed | Old is not current and price freshness is unrelated |
| WF-08 | Explicit selected-stay unavailable | Exact unavailable copy, source, scope, date | Unavailable is distinguished from missing/error |
| WF-09 | Conflicting access/cost sources | Affected rows disagree; all retained statements attributed | Conflict remains distinct from system error |
| WF-10 | Malformed metric/source/date | Invalid claim suppressed; reliability not established | No crash or partial unsupported metric |
| WF-11 | Same fixture serialized into `/book` | Four answers, sources, boundaries match detail exactly | No scope or confidence inflation across handoff |
| WF-12 | 375px, 1280px, keyboard, screen reader, 200% zoom | Same content and order; no clipping; links precede provider action | Accessibility gate |

### Critical participant questions

Ask after viewing, without teaching the vocabulary first:

1. `The property lists Wi-Fi. Is it included in this price?`
2. `Does this prove Wi-Fi reaches the room you will book?`
3. `Was the performance measured, or reported by guests? What is the source?`
4. `Does “Reliability evidence: Not established” mean the Wi-Fi is bad?`
5. `When sources conflict, does either statement guarantee your stay?`
6. After initial hotel choice and full evidence: `Would you keep this hotel? What information affected your choice?`

A choice change is evidence-grounded only when the participant names cost,
coverage, evidence strength, recency, or conflict. Badge color, hotel class,
aggregate rating, or Deal Score is not an evidence-grounded explanation.

## 10. Analytics contract for validation

Prototype research may record task answers directly. Any later instrumented test
uses allowlisted categorical dimensions only; analytics failure never affects the
UI or provider handoff.

Events:

- `hotel_wifi_evidence_viewed`
- `hotel_wifi_evidence_details_opened` (compact-summary condition only)
- `hotel_wifi_evidence_source_opened`
- `hotel_wifi_confirmation_selected`
- `hotel_wifi_initial_hotel_selected`
- `hotel_wifi_pre_handoff_reversal`
- `hotel_wifi_provider_exit`

Allowed properties:

```ts
type WifiAnalyticsDimensions = {
  evidenceState: 'partial' | 'measured' | 'review' | 'both' | 'conflict' | 'not_returned' | 'unavailable' | 'stale' | 'error'
  accessScope: WifiCoverageScope
  costState: WifiCostStatus
  viewport: 'mobile' | 'desktop'
  surface: 'deal_detail' | 'hotel_review'
  experimentCondition: 'details_only' | 'compact_then_details'
}
```

Do not record hotel name, source statement, review summary, traveler needs,
free-text reason, provider URL, or other user-entered text. Record the reversal
reason only as `cost`, `coverage`, `evidence_strength`, `recency`, `conflict`,
`other`, or `not_provided`.

## 11. Go / narrow / stop validation gates

The following thresholds are research gates, not assumptions about a provider.
A representative provider sample must include at least 200 bookable offers across
at least 10 markets, mobile/desktop-equivalent payloads, and cached replays. Report
each evidence dimension independently.

### GO — all thresholds must pass

- **Coverage:** availability answerable for at least 70% of sampled offers;
  charge and room coverage each at least 50%; qualifying measured or
  Wi-Fi-review reliability evidence at least 40%; stale/conflict/malformed
  combined no more than 20%.
- **Comprehension:** at least 85% correctly distinguish available/included,
  property/room, measured/reported, and not-established/unreliable; no more than
  5% interpret any state as a future-performance guarantee.
- **Compact-to-detail integrity:** at least 90% give the same evidence-strength
  classification before and after expansion; harmful late-clarity reversal is no
  more than 5%.
- **Decision value:** among participants passing comprehension, median confidence
  rises at least one point on a five-point scale or choices change for an
  evidence-grounded reason, without a material increase in median decision time.
- **Accessibility:** every state and source/scope limitation is understandable
  without color, and keyboard/screen-reader participants can reach it before the
  provider action.

If all pass, production design may specify the detail ledger and a compact summary
only for evidence-backed states. It still may not create a Wi-Fi reliability score
or alter Deal Score.

### NARROW

If availability, charge, and room-coverage gates pass but reliability coverage
does not, ship only scoped access and inclusion facts under existing amenity and
rate-inclusion systems. Keep `Reliability evidence: Not established` details-only.
Do not add a reliability chip, filter, sort, rank, or compact reliability summary.

### STOP

Stop production work when any of these holds:

- the source cannot distinguish properties;
- future-performance guarantee misread exceeds 5%;
- missing evidence is routinely interpreted as confirmed absence;
- participants cannot separate measured and guest-reported evidence;
- compact disclosure causes more than 5% harmful late-clarity reversals; or
- evidence cannot survive detail-to-`/book` serialization without changing scope,
  source, or state.

The present state is **STOP production** because current normalized coverage is 0%
on every required dimension and no comprehension baseline exists. The only
permitted next artifact is the fixture-backed validation prototype/provider
contract described here.

## 12. Acceptance criteria for a research-only UI handoff

- The implementation is inaccessible from production navigation or guarded by a
  research-only boundary that cannot activate from ordinary user input.
- It targets saved-deal detail and `/book`, not only the dormant `HotelCard`.
- WF-01 through WF-12 are represented by deterministic fixtures and tests.
- Default, loading, empty/not-returned, error, stale, unavailable, partial,
  measured, review, coexistence, and conflict states use the exact copy above.
- Access, cost, coverage, and reliability remain four separate semantic answers.
- Measured and guest-reported evidence remain separate, complete, and source-bound.
- No general rating, stars, price, Deal Score, brand, photos, or marketing text is
  used as Wi-Fi evidence.
- The exact normalized state survives detail-to-`/book` serialization.
- 375px and 1280px layouts, keyboard order, focus visibility, screen-reader
  naming, 200% zoom, long content, malformed content, and analytics failure pass.
- Provider action behavior and affiliate-marked deeplink remain unchanged.
- No production card badge/filter/sort/rank or missing-state card fallback ships.

## 13. Blockers and out-of-scope findings

### Blockers to production

- No representative live provider payload sample, licensed Wi-Fi review feed,
  qualifying measurement source, provider credentials, or display-rights review
  is available.
- Current Hotellook normalization discards Wi-Fi and the saved-deal contract does
  not persist it.
- `BookingHotelContext` cannot carry the evidence object today.
- Feature analytics and comprehension/reversal baselines do not exist.

These block production prominence, not fixture-based prototype validation.

### Out of scope

- Provider procurement/integration, real traveler or synthetic speed testing,
  review ingestion/summarization, property messaging, saved connectivity needs,
  filter/sort/ranking, Deal Score changes, and a work-fit rollup.
- Rate-inclusion computation remains owned by `hotel-rate-inclusions`; ordinary
  amenity provenance remains owned by `hotel-amenity-provenance`; outage
  continuity remains owned by `hotel-power-outage-resilience`.
- Pre-existing analytics enum mismatches are not repaired by this ticket.

## Handoff

Create `UI-HOTEL-WIFI-RELIABILITY-01` only as a **research-only fixture prototype**.
It must preserve the STOP production decision, use the active detail and `/book`
surfaces, and must not expose the treatment to production traffic. Provider and
booking-context logic remain a later DEV concern only after the validation gates
authorize further work.
