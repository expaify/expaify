# UXDES-HOTEL-POOL-OPERATING-STATUS-01: Hotel pool operating-status confidence

Date: 2026-08-03

Stage: UX Design (UXDES)

Priority: P2

Upstream: `docs/pipeline/hotel-pool-operating-status/02-research.md`

## 1. Design decision and release boundary

**NARROW: build a fixture-backed, capability-gated comprehension prototype; do
not expose provider-positive pool claims in production.** The current adapters,
saved-deal schema, feed serialization, and detail page retain no canonical pool
evidence. Official provider documentation proves that richer fields can exist,
but no sample from expaify's entitled demand endpoint has met the research
coverage or continuity gates.

This spec lets the next stage implement deterministic presentation and test it
with non-production fixtures. Production behavior remains unchanged unless the
gate in section 3 passes. In production, absent capability means:

- no pool line on a result card;
- no empty `Pool details` block on detail;
- no pool wording beside the provider action; and
- no inference that a property has no pool.

The prototype answers three separate questions:

1. What did the provider disclose about each pool?
2. How does each disclosed operating schedule relate to the selected stay?
3. What still needs confirmation because a schedule is not live operating
   status?

This feature must never affect Deal Score, price ranking, result ordering, or
provider-link eligibility. It does not create a pool filter or user preference.

### Prohibited wording and inference

Never render `Open`, `Open now`, `Available`, `Available for your stay`,
`Guaranteed`, `Verified`, `Closed`, `Pool access included`, or equivalent claims
from an ordinary season, weekly schedule, cache timestamp, or presence flag.
Do not infer `Not heated` from a missing heating field. Do not infer `No pool`
from a missing pool collection. Do not infer guest access, fees, hours, capacity,
weather suitability, or maintenance status.

`Provider reports this pool closed {date range}` is permitted only for a valid,
source-attributed temporary-closure interval. It describes a reported closure,
not a live observation.

## 2. Target surfaces and information hierarchy

### 2.1 Reachable journey

The prototype covers the mounted journey:

1. `/deals` result card in `app/components/ui/DealCard.tsx`;
2. `/deals/[dealId]` saved-deal detail in `app/deals/[dealId]/page.tsx`;
3. the `Check rooms with provider` handoff in
   `app/components/HotelDealCriteria.tsx`; and
4. return-to-expaify feedback after a provider handoff.

`app/components/HotelCard.tsx` is orphaned and is not the target. Its disclosure
pattern may inform implementation, but no work in this ticket should mount or
repurpose that component.

### 2.2 Page hierarchy

Keep the current saved-detail sequence. Pool evidence is nested in **Hotel fit**,
after hotel class and guest rating and before disruption/quiet-stay evidence.
The page hierarchy remains:

1. **Primary:** hotel identity, selected stay, observed price, and price-only
   Deal Score.
2. **Secondary:** hotel-fit evidence, including `Pool details`.
3. **Primary action:** `Check rooms with provider`.
4. **Tertiary:** evidence provenance, checked time, limitations, analytics
   prompts, and supporting evidence.

Inside `Pool details`, the order is fixed:

1. section heading and state summary;
2. temporary-closure notice, when valid;
3. one entry for each provider pool instance;
4. schedule-versus-stay explanation;
5. heated status;
6. source and evidence checked time; and
7. the live-status boundary.

Negative, partial, conflicting, or unknown schedule relations outrank positive
attributes. Indoor/outdoor and heated details never visually override a stay
mismatch.

### 2.3 Card hierarchy and interaction contract

Place the pool cue after existing disruption and quiet-stay cues and before the
price group. It is secondary, non-interactive text inside the existing full-card
anchor. It must not look like a button, link, badge, success verdict, or filter.
Opening any point on the card continues to open detail.

Do not add a nested disclosure, button, or link to `DealCard`. If a future design
requires card interaction, first replace the full-card anchor with a semantic
structure that has separate non-nested controls; that structural change is out
of scope here.

## 3. Capability and release gates

### 3.1 Prototype gate

UI may render pool evidence only when all of the following are true:

- `NODE_ENV !== 'production'` or an equivalent server-owned research flag is
  active;
- a validated fixture id resolves to a canonical object;
- the object has a stable evidence revision and per-pool record ids; and
- selected stay dates come from the same saved-deal context used on card and
  detail.

An invalid or absent fixture id behaves exactly like no capability: render
nothing on card, detail, and handoff. Never accept raw provider JSON or arbitrary
query-param copy.

### 3.2 Production go gate

Positive production rendering remains blocked until a documented provider spike
using the exact entitled consumer/demand endpoint shows:

1. at least 100 pool-listed properties across warm, cold, and shoulder-season
   destinations;
2. at least 95% stable per-pool identity, source, and fetched-at retention;
3. separate coverage rates for presence, type, schedule kind, usable intervals,
   and heated state;
4. at least 80% of seasonal records have machine-usable intervals with explicit
   annual or one-off semantics before dated stay-relation copy is enabled;
5. malformed, duplicate, conflicting, and multi-pool samples degrade safely;
6. the identical evidence revision survives provider normalization, the
   six-hour cache, saved-deal persistence, feed serialization, card, detail, and
   handoff; and
7. the fixture study meets every comprehension threshold in section 15.

If identity/source continuity fails, show no visible pool evidence. If presence
and type pass but seasonal intervals fail, production may later be authorized
only for `Indoor pool listed`, `Outdoor pool listed`, or
`Seasonal pool · dates not provided`; it may not compute a stay relation.
Heated coverage is optional per instance and never blocks other truthful fields.

## 4. Canonical UI contract

The component consumes normalized evidence. Provider adapters and DEV own
parsing and overlap calculation; React components render the supplied states and
must not call vendors, parse free text, or calculate from locale-formatted dates.

```ts
type PoolEvidenceState =
  | 'loading'
  | 'ready'
  | 'not_returned'
  | 'malformed'
  | 'conflicting'
  | 'stale'
  | 'check_failed'

type PoolPresence = 'present' | 'absent' | 'not_returned' | 'unknown' | 'conflicting'
type PoolType = 'indoor' | 'outdoor' | 'indoor_and_outdoor' | 'not_provided' | 'conflicting'
type PoolScheduleKind = 'year_round' | 'seasonal' | 'not_provided' | 'conflicting'
type PoolStayRelation = 'full_overlap' | 'partial_overlap' | 'no_overlap' | 'indeterminate'
type PoolHeated = 'heated' | 'not_heated' | 'not_provided' | 'conflicting'

type PoolDateInterval = {
  start: string // ISO date, inclusive
  end: string // ISO date, inclusive
  recurrence: 'annual' | 'one_off'
}

type PoolSource = {
  sourceId: string
  sourceLabel: string
  fetchedAt: string
  scope: 'property'
}

type HotelPoolRecord = {
  poolId: string
  displayName?: string
  presence: PoolPresence
  type: PoolType
  scheduleKind: PoolScheduleKind
  operatingIntervals: readonly PoolDateInterval[]
  selectedStayRelation: PoolStayRelation
  heated: PoolHeated
  temporaryClosureIntervals: readonly PoolDateInterval[]
  source: PoolSource
  conflictDimensions?: readonly ('presence' | 'type' | 'schedule' | 'heated' | 'closure')[]
}

type HotelPoolEvidence = {
  state: PoolEvidenceState
  evidenceRevision: string
  selectedStay?: { checkIn: string; checkOut: string }
  pools: readonly HotelPoolRecord[]
  staleAsOf?: string
}
```

### Contract invariants

- A pool entry needs non-empty `poolId`, `sourceId`, `sourceLabel`, valid
  `fetchedAt`, and an evidence revision. Otherwise the entire visible collection
  is `malformed`; do not partially rescue positive claims.
- Preserve every valid pool instance. Do not merge indoor and outdoor pools,
  deduplicate by label, or select only the most favorable record.
- `presence: absent` is renderable only when explicitly returned at property
  scope by an approved source. It is not the fallback for an empty array.
- A seasonal relation can be derived only from valid selected dates and valid
  intervals. Check-out is exclusive for stay-night comparison; the interval end
  is inclusive. This rule must be centralized and unit-tested.
- Annual intervals may cross Dec 31. One-off intervals must include years.
- Invalid dates, end-before-start intervals, impossible recurring dates, or an
  unknown recurrence degrade the relevant relation to `indeterminate`; they do
  not produce partial or full coverage.
- Multiple disjoint seasonal intervals are evaluated against every stay night.
  `full_overlap` means all stay nights are covered; `partial_overlap` means at
  least one but not all are covered; `no_overlap` means none are covered.
- A year-round record with valid stay dates may be `full_overlap`, but this is
  still schedule coverage—not an operating or access guarantee.
- Temporary closure is a separate dimension. It never rewrites the ordinary
  season. A valid closure overlapping any stay night is shown above schedule
  copy and causes the card to use confirmation wording.
- `stale` follows a provider-specific evidence TTL approved by data owners. The
  price cache's six-hour age is not automatically the pool stale threshold.
- `not_returned`, `malformed`, `conflicting`, `stale`, and `check_failed` never
  disable hotel identity, price, back navigation, or a valid provider action.
- Source label is capped at 80 characters and rendered as text. User-controlled
  HTML and raw vendor copy are prohibited.

## 5. Deterministic card summary

Render one line only for a valid persisted collection. Apply this precedence to
the collection, not array order:

| Priority | Condition | Exact card copy |
|---:|---|---|
| 1 | Valid reported temporary closure overlaps the stay | `Pool details need confirmation` |
| 2 | Any pool has `no_overlap`, and none has full or partial overlap | `Pool schedule does not cover your full stay` |
| 3 | Any pool has `partial_overlap`, and none has full overlap | `Pool schedule covers part of your stay` |
| 4 | At least one pool has full overlap | `{Type} pool schedule covers your stay` |
| 5 | Seasonal, interval absent | `Seasonal {type} pool · dates not provided` |
| 6 | Present, schedule absent | `{Type} pool listed · operating dates not provided` |
| 7 | Present, type absent | `Pool listed · operating details not provided` |
| 8 | `conflicting`, `malformed`, or `stale` | `Pool details need confirmation` |
| 9 | `not_returned`, `check_failed`, absent capability, or empty invalid collection | Render no line |

For the table, `{Type}` is `Indoor`, `Outdoor`, or `Indoor and outdoor`.
Lowercase `{type}` after `Seasonal` (`indoor`, `outdoor`, `indoor and outdoor`).
If type is not provided, omit it: `Seasonal pool · dates not provided`.

When more than one valid pool is disclosed, append
` · {count} pools disclosed` to every visible summary. Cap the displayed count
at `9+`; analytics uses a bucket rather than the exact number. Example:
`Outdoor pool schedule covers your stay · 2 pools disclosed`.

For multiple pools, a full relation may lead the scan summary only when detail
preserves every pool and the user has not selected a particular pool. The count
is mandatory so a favorable pool cannot imply that all pools fit. If one pool
has a temporary closure or a conflict, confirmation wording outranks a positive
relation. If no pool is full but one is partial, partial outranks no-overlap.

Card classes:

```txt
mt-2 break-words text-caption font-medium leading-5 text-[color:var(--text-2)]
```

For mismatch, stale, closure, or conflict, use
`text-[color:var(--warning)]`; do not add a filled warning chip. The full-card
accessible name appends `Pool detail: {same visible sentence}.` after disruption
and quiet-stay content. Do not repeat hidden claims that are absent visually.

## 6. Detail component anatomy

```txt
HotelPoolEvidenceLedger
└── section[aria-labelledby="hotel-pool-title"]
    ├── h3 "Pool details"
    ├── PoolRequestState (conditional)
    ├── ul[aria-label="Provider-disclosed pools"]
    │   └── li PoolEvidenceEntry × n
    │       ├── h4 pool name/fallback
    │       ├── p type
    │       ├── TemporaryClosureNotice (conditional)
    │       ├── p selected-stay relation
    │       ├── p heated status
    │       └── p source/freshness
    └── p LiveStatusBoundary
```

The ledger has no collapse control in the first prototype. Detail is already the
inspection surface and every pool must be discoverable before the provider
action. Use a semantic `<ul>` with one `<li>` per instance. Each entry uses a
heading so screen-reader heading navigation preserves identity. Do not use a
table: long dates and caveats must wrap at 375px.

If the provider supplies a meaningful safe name, use it. Otherwise number pools
in stable provider order: `Pool 1`, `Pool 2`, etc. A duplicate display name does
not collapse records; add the stable ordinal to distinguish them, e.g.
`Lap pool · Pool 2`.

## 7. Final UI copy

All strings in this section are final. Braced values are formatted from validated
canonical data and safely escaped.

### 7.1 Persistent strings

| Element | Exact copy |
|---|---|
| Section heading | `Pool details` |
| Collection label | `Provider-disclosed pools` |
| Boundary | `Provider-disclosed pool details can change. expaify does not confirm day-of-stay opening, maintenance, capacity, weather closures, hours, fees, or guest access. Confirm current conditions with the property or booking provider.` |
| Handoff reminder | `Pool schedules are not live operating status. Confirm current pool conditions with the property or booking provider.` |

### 7.2 Request and evidence states

| State | Exact visible copy | Rule |
|---|---|---|
| Loading | `Checking provider-disclosed pool details…` | Reserve two entry-row skeletons; no prior claim underneath. |
| Ready | No collection-level status sentence | Render each valid pool and persistent boundary. |
| Not returned | `This provider did not return pool details for this hotel.` | Detail prototype only; card and handoff omit pool content. Never say no pool. |
| Check failed | `Pool details could not be checked.` | Follow with `Confirm pool facilities and current conditions with the property or booking provider.` |
| Malformed | `The provider returned pool details that expaify could not verify.` | Suppress all positive per-field claims. |
| Conflicting | `Provider pool details conflict. Confirm before booking.` | Do not render a resolved type, schedule, heating, or closure claim for affected dimensions. |
| Stale | `These pool details are out of date. Confirm before booking.` | Suppress positive card wording; detail may show last attributed facts as historical with `Last reported`, never as current. |
| Explicit absence | `{Provider} reports no pool at this property.` | Only with explicit `presence: absent`, valid source, and approved capability. |

### 7.3 Type and heating strings

| Canonical value | Exact copy |
|---|---|
| `indoor` | `Indoor` |
| `outdoor` | `Outdoor` |
| `indoor_and_outdoor` | `Indoor and outdoor` |
| type `not_provided` | `Type not provided` |
| type `conflicting` | `Provider pool type details conflict.` |
| `heated` | `Heated` |
| `not_heated` | `Not heated` |
| heated `not_provided` | `Heated status not provided` |
| heated `conflicting` | `Provider heated-status details conflict.` |

### 7.4 Schedule and stay relation strings

Use `MMM D` for dates in the selected year; include the year when an interval is
one-off or crosses a calendar year. The selected stay is formatted
`{MMM D}–{MMM D}` with the year added if not the current year or if years differ.

| Condition | Exact copy |
|---|---|
| Full overlap, seasonal | `Your {stay} stay is within the disclosed {season} season.` |
| Full overlap, year-round | `The provider lists a year-round schedule that covers your {stay} stay.` |
| Partial overlap | `Your {stay} stay is partly within the disclosed {season} season.` |
| No overlap | `Your {stay} stay is outside the disclosed {season} season.` |
| Selected dates missing | `Add stay dates to compare with the disclosed season.` |
| Seasonal, intervals missing | `The provider lists this pool as seasonal but did not provide operating dates.` |
| Schedule missing | `The provider did not provide operating dates for this pool.` |
| Invalid interval/indeterminate | `The disclosed operating dates could not be compared with your stay.` |
| Conflicting schedule | `Provider schedule details conflict. Confirm before booking.` |
| Valid temporary closure | `Provider reports this pool closed {start}–{end}.` |
| Closure relation unknown | `Temporary-closure details could not be compared with your stay.` |

Do not use `fits your stay`; `covers your stay` is allowed only when explicitly
qualified as a `schedule` in card copy. Detail uses `within the disclosed season`
or `year-round schedule`.

### 7.5 Source and revision strings

| Condition | Exact copy |
|---|---|
| Valid current evidence | `Disclosed by {provider} · checked {date and time}` |
| Stale evidence | `Last reported by {provider} · checked {date and time}` |
| Newer revision on detail | `Pool details were updated after you saved this deal.` |
| Revision cannot be restored | `Saved pool details could not be restored. Confirm with the provider.` |

Use absolute local date and time, e.g. `Aug 3, 2026, 14:20`; the native `title`
may include the ISO timestamp. Never reuse `Price checked` or imply the property
verified the evidence at that time.

### 7.6 Handoff and feedback copy

When any detail pool evidence was exposed, insert the persistent handoff reminder
immediately before provider buttons. It is shown for full/year-round states too.

After a pool-exposed provider handoff returns to a visible tab, ask once per
detail view:

`Did the provider show different pool details?`

Buttons:

- `Yes, details were different`
- `No difference`
- `Skip`

If `Yes`, reveal a single-choice group headed:

`What was different?`

Choices:

- `Operating schedule or dates`
- `Indoor or outdoor type`
- `Heated status`
- `Temporary closure`
- `Something else about the pool`

Submit button: `Send feedback`

Cancel button: `Cancel`

Success: `Thanks. We’ll use this report to evaluate the pool information.`

Failure: `We couldn’t save your feedback. Your hotel details are unchanged.`

Retry: `Try again`

The feedback prompt never blocks or obscures provider actions. Store only the
enumerated reason, evidence state/relation, revision bucket, and viewport group;
never collect free text in this ticket.

### 7.7 Optional back-reason prompt

Only after pool detail has met the analytics exposure threshold or explicit pool
intent exists, intercept neither browser navigation nor the back link. Record the
back normally, navigate immediately, and show an optional prompt on the restored
results page if that continuation pattern is available:

`Did pool details affect why you came back?`

Choices:

- `Schedule did not fit`
- `Pool type did not fit`
- `Heated status was unknown or different`
- `Current operating status was unclear`
- `Another pool reason`
- `Not related to the pool`
- `Skip`

If a safe restored-results prompt cannot be implemented without delaying
navigation, omit the prompt in the UI stage and retain the event contract for a
later DEV ticket. Do not use a modal before navigation.

## 8. Visual specification and Tailwind patterns

Use only tokens already defined in `app/globals.css`.

### 8.1 Ledger container

Nest inside `Hotel fit` with:

```txt
mt-6 border-t border-[color:var(--border)] pt-5
```

Heading:

```txt
text-h3 text-[color:var(--text-1)]
```

Pool list:

```txt
mt-4 grid list-none gap-3 p-0 sm:grid-cols-2
```

Pool entry:

```txt
min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] p-3.5
```

Entry name uses
`break-words text-sm font-medium leading-6 text-[color:var(--text-1)]`.
Type/relation/heating use
`mt-1 break-words text-sm leading-6 text-[color:var(--text-2)]`.
Source uses
`mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]`.

The boundary uses:

```txt
mt-4 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2.5
text-xs leading-5 text-[color:var(--text-2)]
```

No pool icon is required. If an existing icon is reused later, it is
`aria-hidden` and cannot be the only state indicator.

### 8.2 State treatments

- Loading skeletons: `skeleton h-4 rounded-[var(--radius-control)]`; three lines
  at `w-2/5`, `w-full`, and `w-4/5`. Use neutral token colors.
- Partial, no-overlap, stale, or valid closure notice:
  `rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2.5 text-sm leading-6 text-[color:var(--warning)]`.
- Conflict, malformed, or check failure:
  `rounded-[var(--radius-control)] bg-[color:var(--error-soft)] px-3 py-2.5 text-sm leading-6 text-[color:var(--error-text)]`.
- Not returned and missing schedules use neutral
  `bg-[color:var(--bg-muted)] text-[color:var(--text-2)]`.
- Full overlap has no green fill, checkmark, or badge. It uses ordinary body
  text so schedule fit is not mistaken for a live guarantee.

Do not introduce new colors, gradients, shadows, font sizes, or radii.

### 8.3 Feedback controls

Use native radio inputs with visible labels. Each row is at least 44px:

```txt
flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-control)]
border border-[color:var(--border)] px-3 py-2.5
has-[:focus-visible]:border-[color:var(--border-focus)]
```

Buttons use existing `.btn`, `.btn-primary`, and `.btn-outline` classes. Do not
disable `Send feedback` without an explanation; before selection, keep it
disabled and associate `Choose one reason to continue.` via `aria-describedby`.

## 9. Responsive behavior

### 9.1 Mobile: 375px

- Page gutter remains `px-4`; ledger uses the full inner width.
- Pool entries are one column and preserve provider order.
- No fixed-width children. Every string uses `min-w-0`, `break-words`, and normal
  wrapping; no horizontal scroll at 320px or 375px.
- Dates wrap as text, never truncate. Pool name may wrap to two or more lines.
- Handoff reminder sits above the full-width provider action.
- Feedback choices and actions stack vertically; each control is full width and
  at least 44px high.
- Card cue is at most three visual lines under ordinary English fixture content;
  do not line-clamp because truncating `2 pools disclosed` loses meaning.

### 9.2 Desktop: 1280px

- Existing page max width remains `1080px`; do not widen the layout.
- Pool entries use two equal columns from `sm` upward. A single pool occupies one
  column and does not stretch its text measure across the entire page.
- Source metadata remains below each instance; it is never moved to a distant
  shared footer.
- Feedback radio rows can remain one column for scan clarity. Buttons may align
  horizontally with `min-[480px]:flex-row`.

At both widths, card and detail identity, dates, price, Deal Score, and provider
action remain usable when pool evidence is long, missing, or broken.

## 10. Loading, empty, error, and update behavior

### Loading

Loading exists only for an approved detail refresh. Set `aria-busy="true"` on
the ledger, render two skeleton entry placeholders to reserve height, and expose
one visually hidden polite status: `Checking provider-disclosed pool details…`.
Do not render a card skeleton; the card uses the persisted revision or no cue.

### Empty / not returned

`not_returned` is not an empty collection of confirmed evidence. On detail in
the fixture study, show the neutral state copy and boundary guidance. In
production, when capability is absent, omit the entire feature. Never render
`No pools found`.

### Check failure

Show the error copy and confirmation guidance. If the provider architecture
offers a safe retry through `lib/providers`, show `Try pool details again` as a
44px button. During retry, keep the previous claim suppressed. On success,
replace the status, announce `Pool details updated.`, and move no focus. On
failure, announce `Pool details still could not be checked.` Focus stays on the
retry button.

### Stale evidence

Card uses `Pool details need confirmation`. Detail may preserve attributed
historical facts, prefixed with `Last reported`, plus the stale warning and
boundary. A stale schedule cannot produce full/partial/no overlap as a current
card claim. Provider handoff remains available.

### Newer revision on detail

Card opens with the persisted saved revision. If an approved detail refresh
returns a newer valid revision, atomically replace the whole collection,
recompute relations centrally, and announce
`Pool details were updated after you saved this deal.` The source/revision must
then be the same in the detail ledger and handoff reminder. Never mix pools from
two revisions. Analytics records only a revision bucket, not the raw revision.

### Conflicting or malformed evidence

If one dimension conflicts, preserve non-conflicting dimensions only when their
source binding remains valid. The affected line uses explicit conflict copy. If
identity, source, or interval association conflicts, suppress the entire
collection as `conflicting`. Malformed records never crash the page or silently
disappear into a positive aggregate.

## 11. Edge-case rules

| Edge case | Required behavior |
|---|---|
| Missing selected dates | Relation is indeterminate; show `Add stay dates…`; no dated card claim. |
| Missing schedule | Preserve existence/type; show operating dates not provided. |
| Seasonal label, no intervals | Show exact seasonal-missing copy; never assume local climate dates. |
| Indoor pool, heat unknown | Show `Indoor` and independently `Heated status not provided`. |
| Outdoor pool, year-round | Show type and year-round schedule; retain live-status boundary. |
| One indoor and one outdoor pool | Two separate entries, stable names, count on card. |
| Multiple pools with mixed overlap | Count on card; summary precedence in section 5; every relation on detail. |
| Stay begins/ends at season boundary | Compare stay nights with inclusive season dates and exclusive check-out. |
| Annual interval crosses New Year | Expand against all relevant years before comparison. |
| Leap-day recurring interval | Accept only with documented semantics; otherwise indeterminate. |
| Duplicate provider ids | Whole collection conflicting; do not renumber into false identities. |
| Long/unsafe pool name | Escape text, trim, cap length; fallback to stable `Pool n`. |
| Invalid fetched time | Malformed collection; no visible positive claim. |
| Missing provider label | Malformed collection; do not say `Provider unavailable` beside a claim. |
| Closure overlaps a full season | Closure warning precedes ordinary season; card requires confirmation. |
| Closure does not overlap stay | Show attributed closure on detail only if relevant to disclosed evidence; card may use schedule relation. |
| Hours present in raw data | Do not render; hours are out of scope and not used in overlap. |
| Fees/access present in raw data | Do not render or infer; boundary tells traveler to confirm. |
| Explicit property-level absence | Render only after production capability approval; never mix with pool entries. |
| Zero-night or inverted stay | Treat selected dates as invalid and relation as indeterminate. |
| More than nine pools | Render all validated entries on detail; card says `9+ pools disclosed`. |

## 12. Keyboard and screen-reader specification

- The card remains one anchor in the existing tab order. The pool cue creates no
  extra stop. Its accessible name includes the same summary once.
- `Pool details` is an `h3` within the existing `Hotel fit` `h2`. Each pool is an
  `h4`, followed in DOM order by type, closure warning, relation, heating, and
  source.
- Use a semantic list with `aria-label="Provider-disclosed pools"`. Do not add
  redundant `role="list"` unless CSS removes semantics in the target browser.
- Loading uses `aria-busy` and one `role="status" aria-live="polite"
  aria-atomic="true"`. Skeleton blocks are `aria-hidden="true"`.
- Check failure and malformed/conflict changes caused by user retry use polite
  status, not an assertive alert. The content is decision support, not an
  emergency.
- Static warnings present at page load need no live region.
- Feedback radio buttons use `<fieldset><legend>`. Arrow keys change radio
  selection natively. Tab moves from the group to `Send feedback`, `Cancel`, and
  onward in DOM order.
- When `Yes, details were different` reveals reasons, focus moves to the
  `<legend>` via a focusable group wrapper or the first radio only after the
  user's activation. When canceling, focus returns to `Yes, details were
  different`.
- On feedback failure, focus moves to the error summary; `Try again` follows it.
  On success, a polite status is announced and focus is not forced.
- Every focusable control inherits the global 3px `:focus-visible` outline and
  focus ring. Do not remove it.
- Meaning is conveyed by text and semantics, never color or icons alone.
- At 200% zoom and 320 CSS px, content reflows without two-dimensional scroll.

Expected screen-reader order for a two-pool fixture:

`Pool details, heading level 3` → `Provider-disclosed pools, list, 2 items` →
`Indoor pool, heading level 4` → `Indoor` → stay relation → heated status →
source → `Outdoor pool, heading level 4` → corresponding facts → boundary.

## 13. Card-to-detail and provider continuity

The same normalized revision drives every surface:

```txt
approved provider Result<T>
→ canonical per-pool normalization
→ cache with evidence fetchedAt
→ saved-deal evidence JSON + schema version
→ feed serialization
→ deterministic card summary
→ saved-detail ledger
→ handoff boundary and return prompt
```

UI acceptance requires a fixture round trip, not three separately constructed
fixture objects. Card summary must be derived from the persisted object that
detail reads. Handoff receives that same object by prop or saved booking context;
it does not refetch independently.

If the revision is missing or does not match after persistence, card renders no
pool cue and detail shows `Saved pool details could not be restored. Confirm with
the provider.` A continuity failure cannot fall back to a generic pool chip.

## 14. Analytics specification

Analytics is allowlisted, privacy-bounded, and observational. It never blocks
rendering, navigation, retry, or provider handoff. No pool name, provider record
id, dates, raw revision, free text, or hotel name is sent.

### Events and required properties

| Event | Trigger | Properties |
|---|---|---|
| `hotel_pool_summary_viewed` | Card cue is at least 50% visible for 1 second | `deal_id`, `evidence_state`, `stay_relation`, `pool_count_bucket`, `viewport_group`, `evidence_revision` |
| `hotel_pool_detail_viewed` | Ledger is at least 50% visible for 1 second | Same fields plus `source_freshness_bucket` |
| `hotel_pool_back_reason_submitted` | Optional restored-results reason selected | Same evidence fields plus enumerated `reason` |
| `hotel_pool_provider_handoff_started` | Eligible provider link activated after pool detail exposure | `deal_id`, `evidence_state`, `stay_relation`, `pool_count_bucket`, `viewport_group`, `evidence_revision`, `provider` |
| `hotel_pool_provider_return_mismatch` | Return mismatch reason successfully submitted | Same context plus enumerated `reason` |

Allowed values:

- `evidence_state`: `ready | not_returned | malformed | conflicting | stale | check_failed`
- `stay_relation`: `full_overlap | partial_overlap | no_overlap | indeterminate | mixed`
- `pool_count_bucket`: `0 | 1 | 2 | 3_plus`
- `viewport_group`: `mobile_375 | desktop_1280 | other`
- `evidence_revision`: `saved | updated | unavailable` (bucket only)
- `source_freshness_bucket`: `under_24h | 1_7d | over_7d | unavailable`
- back reason: `schedule_mismatch | type_mismatch | heating_unknown_or_mismatch | live_status_unknown | other_pool_reason | not_pool_related`
- return mismatch: `different_schedule | different_type | different_heating | temporary_closure | other | no_difference`

The analytics endpoint currently does not allow these events. UI/DEV must extend
both event-property allowlists, required-property maps, and value validators
before emitting them. Rejected analytics is not successful measurement.

Primary behavioral metric:

`explicit pool-related back reasons ÷ eligible detail views with pool intent or pool-detail exposure`

Read it with card mismatch rejection, suitable-property detail opens, provider
handoff, `not_pool_related`, and evidence-state distribution. Fewer exits are not
success if unknown or mismatch evidence was hidden.

## 15. Fixture matrix and comprehension study

Implement typed fixtures only. Query parameters may select an enum id in
development; production ignores it. Each fixture includes a card serialization,
detail round trip, 375px capture, 1280px capture, keyboard pass, and accessible
name/order assertion.

| Fixture id | Required facts | Expected card | Critical detail assertion |
|---|---|---|---|
| `indoor_year_round_heated_full` | Indoor, year-round, heated, dates present | `Indoor pool schedule covers your stay` | Boundary remains visible; no live claim. |
| `outdoor_seasonal_full` | Outdoor interval fully covers stay | `Outdoor pool schedule covers your stay` | Exact stay and season shown. |
| `seasonal_partial` | Stay crosses last disclosed day | `Pool schedule covers part of your stay` | Partial copy, inclusive/exclusive boundary correct. |
| `seasonal_none` | Stay wholly outside interval | `Pool schedule does not cover your full stay` | Outside-season copy; never `closed`. |
| `seasonal_dates_missing` | Seasonal flag, no interval | `Seasonal pool · dates not provided` | Missing dates remain unknown. |
| `stay_dates_missing` | Valid interval, no selected stay | schedule/type missing-date cue | `Add stay dates…`; relation indeterminate. |
| `indoor_heat_unknown` | Indoor, heat absent | truthful type/schedule cue | `Heated status not provided`, never `Not heated`. |
| `multiple_mixed` | Indoor full + outdoor none, different heat | full cue plus `2 pools disclosed` | Two named entries and separate facts. |
| `temporary_closure_overlap` | Season full, closure overlaps stay | `Pool details need confirmation` | Closure above season; boundary below. |
| `stale` | Valid old attributed record | `Pool details need confirmation` | Historical `Last reported`; positive current claim suppressed. |
| `conflicting` | Type/schedule sources disagree | `Pool details need confirmation` | Conflict dimensions unresolved. |
| `malformed_interval` | Invalid interval | `Pool details need confirmation` | No derived relation; page remains usable. |
| `not_returned` | Provider returned no usable field | no card cue | Neutral detail research state; never `No pool`. |
| `check_failed` | Refresh failure | no card cue | Retry behavior and usable handoff. |
| `revision_updated` | Saved revision replaced atomically | saved cue until detail update | Update announcement; ledger/handoff match. |
| `year_rollover` | Annual Nov–Mar, Feb stay | full cue | Correct cross-year expansion. |

Moderate a counterbalanced study with 8–12 leisure travelers for whom a pool
matters at least annually, including at least four family travelers and four
shoulder/off-season travelers. Test both 375px and 1280px. Participants compare
cards, open detail, choose `keep`, `reject`, or `need to confirm`, then state:

1. what the provider disclosed;
2. whether the selected dates fit the disclosed schedule;
3. what remains unknown; and
4. confidence from 1–5.

Production go thresholds:

- at least 80% correct classification overall for full, partial, none, and
  indeterminate, with no relation below 70%;
- at least 80% distinguish `Heated status not provided` from `Not heated`;
- at least 80% preserve separate facts for multiple pools;
- at least 90% understand schedule coverage does not confirm day-of-stay
  opening, maintenance, capacity, weather, hours, fees, or access;
- median confidence at least 4/5 among correct answers; and
- incorrect high-confidence answers (4–5/5) below 10%.

If live-status comprehension fails, block all positive wording. If partial and
full are confused, card retreats to `Pool details` for every dated relation while
detail retains exact dates. Confidence is never interpreted without correctness.

## 16. Acceptance criteria by state and surface

### Default / ready

- Every valid pool has its own identity, type, schedule relation, heating state,
  source, and checked time.
- Full overlap remains explicitly a disclosed schedule and retains the boundary.
- Card summary follows deterministic precedence and remains non-interactive.

### Loading

- Detail reserves space, exposes one polite status, and has no stale positive
  claim underneath.
- Card uses persisted evidence or nothing; it does not wait on a provider.

### Empty / not returned / error

- Missing evidence never renders `No pool`.
- Failure leaves price, Deal Score, navigation, and provider handoff usable.
- Retry, if supported, calls an internal route/provider adapter only.

### Partial / no overlap / indeterminate

- Copy identifies the selected stay and disclosed interval when valid.
- Partial/no overlap is not labeled live closed.
- Missing stay dates or schedule intervals cannot produce a dated claim.

### Indoor/outdoor/heated unknown

- Dimensions render independently; unknown heating cannot negate heating.
- Combined type is written `Indoor and outdoor`, not split into two pools unless
  the provider supplied two stable instances.

### Multiple pools

- Detail never flattens records or lets the best pool hide others.
- Card includes the count and conflict/closure precedence.

### Stale/conflicting/malformed

- No positive current card claim appears.
- Detail attributes historical evidence or exposes uncertainty without choosing
  a winner or crashing.

### Continuity

- One fixture object survives normalization/persistence/serialization.
- Any detail refresh replaces the complete revision and updates handoff copy.
- Revision failure degrades safely and visibly.

### Mobile, desktop, and accessibility

- No overlap or horizontal scrolling at 320px/375px; 1280px remains within the
  existing 1080px container.
- All controls are at least 44px, focus visible, and usable by keyboard.
- Screen-reader order is pool name → type → closure → relation → heating → source.
- Loading, retry, update, success, and error announcements occur exactly once.

## 17. Implementation scope and handoff

The UI stage may add fixture types, fixture data, presentation components,
component tests, and development-only wiring for the reachable card/detail/
handoff surfaces. It must not add a production-positive claim, provider request,
database migration, filter, sorting behavior, Deal Score input, or raw analytics
emission before the server allowlist is updated.

Logic/API/persistence work requires a later `DEV-HOTEL-POOL-OPERATING-STATUS-01`
ticket after the provider gate passes. Until then, the prototype must be visibly
marked `Research fixture` to internal testers and unreachable through ordinary
production navigation.

The UI handoff is complete when all fixture mappings are unit-tested, 375px and
1280px layouts are usable, keyboard/screen-reader semantics match this spec, and
production behavior with no capability is unchanged.
