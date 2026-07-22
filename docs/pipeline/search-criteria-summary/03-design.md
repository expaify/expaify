# UXDES-SEARCH-CRITERIA-SUMMARY-01: Active Hotel Search Criteria Design Spec

Date: 2026-07-22  
Stage: UX Design  
Research source: `docs/pipeline/search-criteria-summary/02-research.md`  
Affected surfaces: hotel results, hotel detail, results return/refresh, and provider handoff

## Design outcome

Every hotel result and detail view must render from one authoritative,
serializable criteria object. The UI must let a traveler answer three different
questions without inference:

1. **Your search:** which destination and check-in window govern these results?
2. **Occupancy status:** did expaify capture and apply guests and rooms? It does
   not today.
3. **This deal:** what dates, nights, and price facts belong to this particular
   stored offer?

This is a continuity and truthfulness repair. It does not add guest/room search,
exact stay-date search, new inventory, or a claim that current prices fit a
traveler's party.

## Non-negotiable semantic boundary

- `date_from` and `date_to` constrain the offer's **check-in date**. They are not
  a selected check-in/check-out stay. Visible copy must say `Check in`, never
  `Stay`, `Trip dates`, `Check-in and check-out`, or `{from} to {to}` without the
  `Check in` qualifier.
- Guests and rooms are not collected, sent to the results query, stored on the
  criteria set, or preserved in the provider link. Visible copy must say
  `Guests & rooms not captured`.
- Current snapshot acquisition uses a hidden 2-adult/1-room default. That is a
  provider acquisition detail, not traveler intent. Never render `2 adults`,
  `1 room`, `Default party`, or `Matches your party` from that default.
- A displayed nightly price must be accompanied near provider handoff by
  `Confirm the price and room fit for your party with the provider.`
- Secondary price, star, discount, and sort controls are result-view filters.
  They are not part of the trip criteria summary and must not visually compete
  with it.

## Authoritative criteria contract

Use a single `HotelSearchCriteriaV1` value for summary rendering, result
requests, URLs, result-detail links, Back behavior, refresh, and analytics.
Component-local parsed chips are not authoritative.

```ts
type HotelSearchCriteriaV1 = {
  schemaVersion: 1
  criteriaVersion: string // opaque, non-PII ID for this successfully applied set
  destination:
    | { state: 'all' }
    | { state: 'selected'; city: string }
  dates:
    | { semantic: 'missing' }
    | {
        semantic: 'checkin_window'
        dateFrom?: string // YYYY-MM-DD
        dateTo?: string   // YYYY-MM-DD
      }
  occupancy:
    | { state: 'not_captured' }
    | {
        // Reserved for a later approved feature. Do not produce in this ticket.
        state: 'applied'
        adults: number
        children: number
        childAges: number[]
        rooms: number
      }
  source: 'deals_page' | 'destination_page' | 'edit' | 'restored'
}
```

Contract rules:

- `schemaVersion` versions the data shape. `criteriaVersion` identifies one
  successfully applied instance. They are not interchangeable.
- The active object is immutable. Opening the editor creates a separate draft.
- `criteriaVersion` changes only after a result request succeeds. Draft changes,
  validation errors, cancellations, aborted requests, and failed requests do not
  change it.
- A retry uses the same draft request. It creates the new version only when that
  request succeeds.
- The current implementation may only produce
  `occupancy: { state: 'not_captured' }`.
- Destination and dates must be normalized and validated before serialization.
  Unsupported cities, invalid dates, unknown schema versions, and malformed
  criteria are invalid context; do not partially trust them.
- A bounded canonical URL must carry the normalized criteria fields and opaque
  version, or a server-resolvable opaque reference to the same object. Do not put
  natural-language queries, child ages, or room assignments in analytics.
- The criteria object must not contain the hidden acquisition defaults. If price
  provenance is modeled, it belongs to a separate deal/provider data contract.

### Derived display strings

These formatters are shared across results, detail, and handoff. Use the user's
locale for month names while keeping the semantic labels exactly as specified.

| Data state | Visible copy |
|---|---|
| Selected destination | `{city}` |
| No destination filter | `All destinations` |
| Both date bounds, same month | `Check in Sep 10–13` |
| Both date bounds, different months | `Check in Sep 28–Oct 3` |
| Both date bounds, different years | `Check in Dec 28, 2026–Jan 3, 2027` |
| Lower bound only | `Check in on or after Sep 10` |
| Upper bound only | `Check in by Sep 13` |
| No date bounds | `Any check-in date` |
| Current occupancy state | `Guests & rooms not captured` |
| Future applied occupancy, one adult/room | `1 adult · 1 room` |
| Future applied occupancy, plural | `{adults} adults · {children} children · {rooms} rooms` |

Do not abbreviate the missing-occupancy string at 375px. It may wrap to its own
line. Do not use ellipsis as its only presentation.

## Shared component model

Create one presentation component, conceptually:

```ts
type HotelCriteriaSummaryProps = {
  criteria: HotelSearchCriteriaV1
  surface: 'results' | 'detail' | 'handoff'
  status?: 'ready' | 'updating'
  onEdit?: () => void
}
```

All instances receive the same authoritative object. A detail or handoff variant
may change its heading or density, but it must not reconstruct values from the
deal row, natural-language query, card copy, or provider URL.

Accessible summary sentence:

`{destination}. {dateDisplay}. Guests and rooms not captured.`

The visible ampersand may remain in `Guests & rooms not captured`; the accessible
sentence should use `and`.

## Information hierarchy

### Results

Primary:

1. Results heading and count/state.
2. `Your search` criteria summary: destination, check-in window, occupancy
   status, and `Edit`.
3. Result cards and their price/Deal Score evidence.

Secondary:

1. Price, star, discount, and sort controls.
2. Result freshness and pagination/infinite loading.

Tertiary:

1. Explanatory helper copy.
2. Upgrade messaging and sample-feed context.

Place the criteria summary immediately after the hotel-results heading and before
the existing natural-language/secondary filter area, sort controls, empty/error
message, and grid. The existing independent destination/date parsed chips must
not remain as a second editable representation after this component ships.

### Detail

Primary:

1. Back to the exact originating results state.
2. Deal identity and price.
3. `Your search` criteria summary.
4. `This deal` stored offer facts.
5. Provider actions and the occupancy warning.

Secondary:

1. Deal Score and price history.
2. Freshness, expiration, and supporting price evidence.

Tertiary:

1. Imagery and share affordance.
2. Additional hotel metadata.

`Your search` must appear before `This deal` in DOM and visual order. The
handoff-area variant must restate the same authoritative criteria immediately
above provider actions; it is another rendering of the same object, not another
source of truth.

## Results summary specification

### Default and restored state

Visible strings:

- Heading: `Your search`
- Row 1: `{destination} · {dateDisplay}`
- Row 2: `Guests & rooms not captured`
- Supporting copy: `Confirm the price and room fit for your party with the provider.`
- Button: `Edit`
- Button accessible name: `Edit hotel search`

At results, show the supporting copy directly below the occupancy status. It may
use tertiary text, but it cannot be tooltip-only.

Recommended structure and classes:

```tsx
<section
  aria-labelledby="hotel-search-summary-heading"
  className="mb-6 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-5"
>
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0 flex-1">
      <h2 id="hotel-search-summary-heading"
        className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-3)]">
        Your search
      </h2>
      <p className="mt-1 text-[15px] font-semibold leading-6 text-[color:var(--text-1)] sm:text-[16px]">
        {destination} <span aria-hidden>·</span> {dateDisplay}
      </p>
      <p className="mt-1 text-[13px] font-semibold leading-5 text-[color:var(--text-1)]">
        Guests &amp; rooms not captured
      </p>
      <p className="mt-1 text-[12px] leading-5 text-[color:var(--text-2)]">
        Confirm the price and room fit for your party with the provider.
      </p>
    </div>
    <button className="btn btn-outline min-h-[44px] shrink-0 px-4">Edit</button>
  </div>
</section>
```

Do not truncate destination or date copy. Allow row 1 to wrap naturally. The Edit
button must remain visible and must not be pushed into horizontal overflow.

### Updating results

The last successful summary remains visible and retains its old
`criteriaVersion`. Do not display draft values over old cards.

Visible changes:

- Inline status: `Updating results…`
- `Edit` is disabled while the request is in flight.
- The old grid remains visible but is inert and visually de-emphasized.

Required behavior:

- Set the results region to `aria-busy="true"`.
- Apply the HTML `inert` attribute to the old results region so card links and
  secondary filters leave the tab order. `pointer-events-none` alone is
  insufficient.
- Suggested old-grid classes:
  `transition-opacity duration-150 opacity-60`.
- Show 3–6 skeleton cards over or directly before the inert old grid without
  removing the summary.
- The status uses `role="status" aria-live="polite"` and classes
  `mt-2 text-[12px] font-medium text-[color:var(--brand)]`.
- If a second apply is somehow initiated, abort or ignore the older response.
  Only the latest successful request may become active.

### Successful update

Commit summary, result list, canonical URL, result-detail links, and
`criteriaVersion` in one render transaction. Remove `inert`, restore focusable
cards and filters, and move programmatic focus to the results heading or results
region (`tabIndex={-1}`) without scrolling past the updated summary.

Polite live-region copy:

`Results updated for {destination}. {dateDisplay}. Guests and rooms not captured.`

Do not put the live announcement in visible body copy.

### Empty results

Keep the active summary above the empty state. Do not duplicate trip criteria as
removable destination/date chips.

Visible strings:

- Heading: `No hotel deals match this search`
- Body: `Try another destination or check-in window. Your price and rating filters may also hide available deals.`
- Primary action: `Edit search`
- Secondary action: `Clear price and rating filters` only when a secondary
  filter is active.
- Fallback link when no secondary filter is active: `See all destinations`

The `Edit search` action opens the same atomic editor. Clearing secondary filters
must not change `criteriaVersion` because the trip criteria set is unchanged;
results-view filter analytics remain separate.

Empty-state pattern:

`mx-auto max-w-[640px] rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-5 py-10 text-center`

### Update error with prior successful results

Keep the last successful summary and usable old results. The failed draft must
not appear in the summary, URL, card links, or analytics as applied.

Show an inline error immediately after the summary:

- Heading: `We couldn't update these results.`
- Body: `Your previous search is still showing.`
- Primary action: `Retry update`
- Secondary action: `Edit search`

Use `role="alert"` on the message container. Pattern:

`rounded-[var(--radius-control)] border border-[color:var(--error)] bg-[color:var(--error-soft)] p-4 text-[color:var(--text-1)]`

Retry reuses the failed draft and keeps the active summary unchanged until
success. `Edit search` reopens the failed draft so the user can correct it.

### Initial-load error

If a valid criteria-bearing results URL can be decoded but its initial request
fails, show that requested criteria summary followed by:

- Heading: `Couldn't load hotel deals.`
- Body: `Check your connection and try again.`
- Primary action: `Retry`

The summary is the requested page context, but no `hotel_results_viewed` event
fires until a result response succeeds. If the URL context is invalid, use the
invalid-context state below instead of partially rendering it.

### Invalid results context

Do not silently fall back to all destinations or borrow values from initial deal
cards.

Visible strings:

- Heading: `We couldn't restore this search.`
- Body: `The search link is incomplete or no longer valid.`
- Primary action: `Start a new search`
- Primary destination: canonical `/deals` with a newly created default criteria
  set after its first successful load.

No criteria summary is rendered because there is no valid authoritative object.

### Cold/sample feed

Keep the summary above the existing cold-feed explanation. Default criteria may
read `All destinations · Any check-in date`; occupancy remains not captured.
Sample cards must not carry a real detail link or provider handoff. The summary
describes the attempted feed query, not the sample card data.

### Locked results

Premium locks do not alter criteria. Keep the same visible summary above locked
cards. The `Edit` button follows existing plan access only if editing is already
plan-gated; a lock must never replace the summary with inferred card context.

## Atomic Edit flow

There is exactly one `Edit` entry for destination, check-in bounds, and occupancy
status. Remove trip-defining destination/date removal chips and do not expose a
second independently-applied natural-language criteria control.

### Editor contents and final copy

Dialog title: `Edit hotel search`  
Dialog description: `Update the destination and check-in window used to find deals.`

Fields:

- Label: `Destination`
- All-destination option: `All destinations`
- Selected values: existing supported city names
- Group label: `Check-in window`
- Lower-bound label: `From`
- Upper-bound label: `Through`
- Date helper: `Deals may have different check-out dates and stay lengths.`

Read-only occupancy block:

- Label: `Guests & rooms`
- Value: `Not captured`
- Helper: `This version of expaify can't filter hotel deals by party size yet. Confirm the price and room fit with the provider.`

Actions:

- Primary: `Update results`
- Secondary: `Cancel`

Do not render adult, child, age, or room steppers in this ticket. Disabled fake
inputs are also prohibited: they imply that occupancy is part of the form but
temporarily unavailable. The read-only status block truthfully defines the
current contract.

### Editor layout

At 375px, use a modal dialog with a bottom-sheet visual treatment. It must fit
within the viewport and scroll internally if display zoom or a short viewport
requires it:

```txt
fixed inset-0 z-50 flex items-end bg-[color:color-mix(in_srgb,var(--text-1)_32%,transparent)]
max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-[var(--radius-card)]
bg-[color:var(--bg-surface)] p-5 shadow-[var(--shadow-lift)]
```

At 1280px, center the same dialog at a maximum width of 560px:

```txt
sm:items-center sm:p-6
sm:max-h-[min(720px,calc(100dvh-3rem))] sm:max-w-[560px]
sm:rounded-[var(--radius-card)]
```

Field pattern:

```txt
label: mb-1.5 block text-[12px] font-bold text-[color:var(--text-1)]
control: field-input
helper: mt-1 text-[12px] leading-5 text-[color:var(--text-2)]
```

Occupancy block:

`rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-muted)] p-4`

Actions stack full-width at 375px and align right at desktop:

`mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end`

Both buttons have a minimum 44px target. The primary button uses
`btn btn-primary`; Cancel uses `btn btn-outline`.

### Editor interaction rules

- Opening copies active values into a draft and fires `hotel_criteria_edit_started`.
- Initial focus goes to `Destination`. Focus remains trapped in the dialog.
- `Escape`, backdrop click, and `Cancel` close without changing active criteria.
  If the draft is dirty, no destructive confirmation is needed because the
  draft is small and no remote work has occurred; fire the cancelled event.
- Restore focus to the invoking `Edit` button after cancel/close.
- `Update results` is disabled until the draft is valid and differs from active
  destination/date criteria.
- Enter submits from a field when the draft is valid. Enter in an open
  destination list selects the highlighted option instead.
- Applying closes the dialog, preserves the old active summary, announces
  `Updating results…`, and begins one request.
- On success, install the new object atomically and create a new opaque
  `criteriaVersion`.
- On error, restore focus to `Retry update`; preserve the failed draft for retry
  or correction.
- From detail, a successful update navigates to the canonical results URL for
  the new version. A failed update leaves the user on detail with the old
  criteria and deal visible.

### Validation and copy

| Condition | Message | Behavior |
|---|---|---|
| Unsupported/empty selected city | `Choose a supported destination or All destinations.` | Associate with Destination using `aria-describedby`; block update. |
| Invalid lower date | `Enter a valid start for the check-in window.` | Associate with From; block update. |
| Invalid upper date | `Enter a valid end for the check-in window.` | Associate with Through; block update. |
| Through precedes From | `The end of the check-in window must be on or after the start.` | Associate with both dates; block update. |
| Both dates cleared | No error | Display state becomes `Any check-in date`. |
| Only one date supplied | No error | Use the one-sided display copy defined above. |
| No changes | No error | `Update results` remains disabled. |

Error text uses `mt-1 text-[12px] font-medium text-[color:var(--error)]` and
`role="alert"` after attempted submit. Invalid controls use
`aria-invalid="true"` and `border-[color:var(--error)]`.

## Detail: intent versus deal

### Valid matched context

Render the shared summary in a card titled `Your search` before the existing
hotel fact grid. The fact grid title changes from `Stay details` to `This deal`
so its values cannot be mistaken for user-entered criteria.

`Your search` content:

- `{destination} · {dateDisplay}`
- `Guests & rooms not captured`
- `Confirm the price and room fit for your party with the provider.`
- Button: `Edit`

`This deal` labels and fallback copy:

| Label | Value source / fallback |
|---|---|
| Hotel | stored hotel name / `Hotel name unavailable` |
| Area | stored city / `Area unavailable` |
| Check-in | stored deal check-in / `Check-in unavailable` |
| Check-out | stored check-in plus nights / `Check-out unavailable` |
| Nights | stored nights / `Nights unavailable` |
| Guests | `Guest count unavailable` |
| Room or rate | `Room or rate unavailable` |
| Price basis | `Provider confirms final price and availability.` |

The deal's `checkInWindow` or derived check-out must never populate the `Your
search` summary. Conversely, the criteria check-in bounds must never overwrite
the deal's own Check-in, Check-out, or Nights facts.

Detail cards use:

`rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-5`

Fact labels use existing compact tertiary styling; unavailable fact values use
`text-[color:var(--text-3)]` without warning color.

### Context match rule

For current V1 criteria, `context_status="matched"` only when:

- the criteria object validates;
- destination is `all`, or its city equals the deal city after canonical
  normalization; and
- dates are `missing`, or the stored deal check-in falls within every supplied
  check-in bound.

Occupancy `not_captured` does not make the context mismatched; it creates the
required handoff warning. Do not compare the criteria bounds with the deal's
derived check-out because the criteria are not exact stay dates.

### Known mismatch

If a valid criteria object fails the city or check-in-window match rule, show an
alert between `Your search` and `This deal`:

- Heading: `This deal doesn't match your search.`
- Body: `Its destination or check-in date falls outside the criteria shown above.`
- Primary action: `Edit search`
- Secondary action: `Back to matching results`

Use `role="alert"` and the error-surface pattern. Provider links are not active
in this state. Replace them with the message
`Provider options are unavailable until you review the mismatch.`

### Missing context

When the detail URL has no criteria reference and no valid criteria can be
restored, do not synthesize `Your search` from the deal.

Show a card in the `Your search` position:

- Heading: `Search criteria unavailable`
- Body: `We can't verify which search opened this deal. Review the deal dates and confirm the price and room fit with the provider.`
- Primary action: `Search hotel deals`

`This deal` remains fully visible. Provider links may remain active because the
UI makes no match claim, but the missing-context card must be repeated immediately
above them. Analytics uses `context_status="missing"`.

### Invalid context

When a criteria reference exists but cannot be validated or resolved, show:

- Heading: `Search criteria couldn't be restored`
- Body: `This search link is incomplete or no longer valid. Review this deal's dates before continuing.`
- Primary action: `Start a new search`

Do not partially render destination or dates from the invalid payload. `This
deal` remains visible. Provider links may remain active with this warning
immediately above them. Analytics uses `context_status="invalid"`.

### Detail loading and error

- While the criteria reference resolves, reserve the summary card position with
  a three-line skeleton and accessible status `Restoring your search…`. Do not
  briefly render missing context before resolution completes.
- If deal data is loading independently, keep the resolved `Your search` card
  visible above the deal skeleton.
- If the deal is missing, expired, or unavailable, retain the resolved summary
  in the recovery page when possible and provide `Back to results` using its
  criteria-bearing URL.
- If criteria resolution fails, transition to invalid context; do not keep an
  indefinite skeleton.

## Provider handoff

Immediately before `Compare and book on:`, render the `handoff` variant of the
shared summary under the heading `Before you continue`.

Matched-context visible copy:

- `{destination} · {dateDisplay}`
- `Guests & rooms not captured`
- `Confirm the price and room fit for your party with the provider.`

The handoff summary uses:

`rounded-[var(--radius-control)] border border-[color:var(--gold)] bg-[color:var(--warning-soft)] p-4`

Do not say the provider will preserve the check-in window or occupancy. Existing
provider actions keep their provider names and `rel="noopener noreferrer
sponsored"`. Each enabled action's accessible name becomes
`Check this deal on {provider}`.

On provider activation:

1. Fire `hotel_provider_handoff_clicked` with the latest criteria version and
   context status.
2. Open the affiliate-marked link using the existing new-tab behavior.
3. Do not show a success toast or call the click a booking, arrival, or handoff
   completion.

Missing/invalid context uses the warning copy defined above in the same position.
Known mismatch disables/replaces provider actions as specified. If no provider
link exists, preserve the summary and show `No provider options are available for
this deal right now.`

## Navigation, Back, refresh, and share

### Result to detail

Every unlocked, non-sample result-detail link carries the criteria reference,
`criteriaVersion`, and a bounded return location. It must not carry the
natural-language query. The detail page validates rather than trusts the URL.

### Back to results

- Visible label: `Back to results`
- Accessible name: `Back to hotel results for this search`
- The href is always the canonical criteria-bearing results URL when context is
  valid. It must not be plain `/deals`.
- Browser Back and the visible link restore destination, check-in bounds,
  criteria version, secondary filter/sort state, and preferably scroll position.
- After restoration, focus the card that opened detail when possible. Otherwise
  focus the results heading. Do not force focus to the page top.
- If context is missing or invalid, the visible action is `Search hotel deals`
  and links to canonical `/deals`; do not claim it returns to prior results.

### Refresh and shared links

- Results refresh reconstructs the same criteria display before requesting the
  same normalized query. It does not mint a new version merely because the page
  reloaded.
- Detail refresh reconstructs the same `Your search` object and match status.
- A valid shared detail link may show the shared criteria context and must still
  distinguish it from `This deal`.
- An absent, expired, unsupported-version, or malformed reference uses the
  missing/invalid state; never fall back silently.

### Destination pages

On `/destinations/[city]`, create explicit criteria with
`destination.state="selected"` and `source="destination_page"`. The summary must
show the city even though the page heading already contains it. If Edit changes
the destination, navigate to the canonical `/deals` results URL for the newly
applied criteria instead of retaining a hidden destination-page override.

## Responsive behavior

### 375px

- Summary width is the content column width; no horizontal scroll.
- `Your search` label, destination/check-in copy, occupancy status, supporting
  copy, and `Edit` are visible without expanding another disclosure.
- The first line may wrap. The occupancy line must not be truncated.
- `Edit` stays a 44px target. If a long localized destination causes collision,
  place Edit on its own final row aligned left; never overlay text.
- Editor is the bottom-sheet dialog specified above and respects `100dvh`.
- Results order is heading → summary → secondary controls → result state/grid.
- Detail order is Back → identity/price → Your search → mismatch if any → This
  deal → score/supporting sections → Before you continue → provider actions.
- Provider actions remain a two-column grid where available. Warning copy is
  full-width above them.

### 1280px

- Results remain within the existing `max-w-[1140px]` container.
- The summary may lay out on one horizontal row, but reading order remains
  destination → check-in window → occupancy → Edit.
- Use `sm:flex-row sm:items-center`; do not turn criteria into equal-width chips
  that imply independent removal.
- Detail may use the current narrow content column or an approved two-column
  layout. In either case `Your search` precedes `This deal` in DOM order.
- If the provider action area is sticky, the handoff summary stays inside the
  same sticky region and cannot overlap headers or content.
- Editor is centered at max 560px and keeps the same field order as mobile.

## Focus, keyboard, and assistive technology

- Summary content is ordinary text inside a labelled region, not a list of
  buttons or removable chips.
- `Edit` is reachable in source order immediately after the summary text.
- All Edit buttons use the same accessible name, `Edit hotel search`; the
  handoff variant does not add another Edit unless the surface already requires
  it. Avoid duplicate adjacent actions.
- Dialog uses `role="dialog"`, `aria-modal="true"`, an accessible title and
  description, focus trap, Escape close, and focus restoration.
- Date inputs retain visible labels and native keyboard behavior.
- Error copy is associated with fields; update failure uses `role="alert"`.
- Loading and successful update announcements use a persistent polite live
  region. Do not move screen-reader focus for loading alone.
- Result regions use `aria-busy`; stale interactive content becomes `inert`.
- Never communicate missing, invalid, updating, or mismatch state through color
  alone.
- At 200% zoom and 320px minimum body width, content wraps without overlap or
  clipped actions.

## Analytics contract

`criteriaVersion` is an opaque non-PII identifier. Never send raw search text,
city strings/free text, URL payloads, child ages, or room assignments. Use only
the properties below.

| Event | Fire rule | Properties |
|---|---|---|
| `hotel_criteria_summary_viewed` | Once per `criteria_version` per mounted surface after a valid summary is rendered. | `surface: results|detail|handoff`, `criteria_version`, `destination_present`, `date_state: checkin_window|missing`, `occupancy_state: not_captured|applied`, `room_state: not_captured|applied`, `criteria_source` |
| `hotel_criteria_edit_started` | Once when the dialog opens. | `surface`, `criteria_version`, `entry_point: summary|empty_state|mismatch` |
| `hotel_criteria_edit_cancelled` | Once when a started editor closes without apply. | `surface`, `criteria_version`, `entry_point`, `draft_changed: boolean` |
| `hotel_criteria_edit_applied` | Only after the result request succeeds and the new version is installed. | sorted `changed_fields: destination|date_from|date_to`, `previous_version`, `criteria_version`, `result_count_bucket: 0|1_5|6_20|21_plus` |
| `hotel_results_viewed` | After a successful result response is rendered. | `criteria_version`, `result_state: populated|empty|sample`, completeness flags |
| `hotel_detail_viewed` | After detail and criteria resolution settle. | `criteria_version` when available, `context_status: matched|missing|invalid|mismatch`, `deal_id` |
| `hotel_provider_handoff_clicked` | On eligible provider-link activation, before navigation. | `provider`, `deal_id`, `criteria_version` when available, `context_status`, `destination_present`, `date_state`, `occupancy_state`, `room_state` |

Reviewed interpretation rules:

- Do not emit `hotel_results_repeated_search` from the UI. Derive it as a new
  top-level search after a results view in the same session; exclude in-place
  Edit and separately classify known comparison intent.
- Derive `hotel_detail_returned_for_criteria_edit` from detail → results → Edit
  before another detail or handoff. Preserve `return_method` and changed fields.
- A provider click proves intent to leave, not provider arrival, booking, or
  abandonment. Do not use `handoff_started` or report post-click abandonment
  without provider callback/return instrumentation.
- A version unchanged at handoff is not a success metric by itself. Pair it with
  `context_status` and comprehension testing.
- Failed drafts, validation errors, and cancelled edits must never emit the
  applied event or contaminate the active-version sequence.

The current `lib/analytics.ts` has no production transport. UI may wire these
event contracts, but production outcome measurement remains blocked until a DEV
stage adds delivery and sessionization.

## Complete state matrix

| Surface/state | Authoritative summary | Results/deal content | Primary recovery/action |
|---|---|---|---|
| Results default/populated | Current V1, ready | Matching cards | Edit |
| Results updating | Last successful V1 + `Updating results…` | Old cards visible, inert; skeletons | Wait; no second apply |
| Results update success | New V1 installed atomically | New populated or empty response | Continue scanning |
| Results empty | Current V1 retained | Empty message | Edit search |
| Results update error | Last successful V1 retained | Previous results usable | Retry update |
| Results initial error | Valid requested V1 shown | No cards | Retry |
| Results invalid context | No partial summary | No cards | Start a new search |
| Results sample/cold | Current V1 retained | Clearly labelled non-bookable samples | Edit |
| Results locked | Current V1 retained | Existing lock state | Existing unlock action |
| Detail matched | Current V1 under `Your search` | Separate `This deal` | Edit / provider action |
| Detail mismatch | Current V1 + mismatch alert | `This deal` remains visible | Edit search / Back to matching results; no provider action |
| Detail missing context | Missing-context card | `This deal` remains visible | Search hotel deals; warned provider action allowed |
| Detail invalid context | Invalid-context card | `This deal` remains visible | Start a new search; warned provider action allowed |
| Detail criteria resolving | Skeleton + `Restoring your search…` | Deal may load independently | Wait |
| Detail missing/expired deal | Resolved V1 retained when possible | Existing unavailable recovery | Back to criteria-bearing results |
| Handoff matched | Same V1 under `Before you continue` | Provider options | Click provider; confirm price/fit there |
| Handoff missing/invalid | Exact warning repeated | Provider options | Review deal, then optional provider click |
| Handoff mismatch | V1 + mismatch warning | Provider actions removed | Edit or return |
| No provider links | Context card retained | No link controls | Return to results |

## QA acceptance criteria

1. At 375px, destination, truthful check-in semantics, occupancy status, and a
   44px Edit target are all visible without horizontal scrolling or disclosure.
2. At 1280px, the same content appears in the same reading order before
   secondary filters and results.
3. No visible string calls `date_from`/`date_to` exact stay dates.
4. No visible string or criteria field turns the acquisition default into
   `2 adults · 1 room` traveler intent.
5. Populated, loading, empty, update-error, initial-error, invalid, sample, and
   locked results retain the correct criteria behavior.
6. One Edit action creates one draft and one apply request. Cancel/error leaves
   the active criteria and version unchanged.
7. A successful apply changes summary, results, URL, links, and version
   atomically and produces one polite confirmation.
8. Refresh and browser Back reproduce the same criteria and version. Visible
   Back never points to plain `/deals` when valid context exists.
9. Detail clearly separates `Your search` from `This deal`; no deal field is used
   to fill missing intent.
10. Missing, invalid, and known-mismatch detail contexts use their specified
    copy and provider-action rules.
11. The latest summary and occupancy warning are adjacent to provider links.
12. Tab order, focus restoration, dialog trapping, Enter/Escape behavior,
    `aria-busy`, `inert`, live regions, and field errors work by keyboard and
    screen reader.
13. Analytics fires once at the defined outcome boundaries, contains no raw
    query/city/child-age/room-assignment data, and uses `clicked`, not `started`,
    for provider actions.
14. Existing Deal Score, money, provider affiliate, result lock, and price
    freshness contracts remain unchanged.

## UI implementation boundaries

The UI stage should implement the shared summary, atomic editor presentation,
intent-versus-deal layout, all visual states, responsive behavior, accessibility,
and event call sites while preserving current component exports and props.

Logic that requires durable URL serialization/resolution, server reconstruction,
request race control beyond existing UI state, production analytics delivery,
or provider/deeplink changes must be handed to DEV. UI must not bypass
`lib/providers`, alter the money shape, or make occupancy-applied claims while
those dependencies are absent.

## Blockers and out-of-scope findings

- Party-relevant price claims remain blocked until adults, children/ages, and
  rooms are captured, sent to providers, stored with offers, and preserved into
  affiliate handoff. This spec deliberately keeps occupancy `not_captured`.
- Behavioral measurement remains blocked because `lib/analytics.ts` has no
  production transport or sessionization. Event semantics are ready; outcome
  claims are not.
- The research found direct external hotel calls in `lib/pipeline/snapshot.ts`,
  outside the required `lib/providers` boundary. Do not expand that bypass in
  this ticket; repair belongs to a separate DEV ticket.
- The research found affiliate environment/config inconsistencies. This design
  does not modify links. Affiliate-marker auditing remains separate and must be
  resolved before handoff analytics are treated as evidence of valid traffic.
- Exact check-in/check-out selection, guest/room intake, child-age collection,
  room allocation, provider occupancy matching, and new booking behavior are
  out of scope and require an explicitly approved feature ticket.
