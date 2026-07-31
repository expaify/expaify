# UX Design — Hotel Airport Transfer & Property Shuttle Availability

**Ticket:** `UXDES-HOTEL-TRANSPORT-SHUTTLE-01` · **Stage:** UXDES · **Priority:** P0  
**Feature slug:** `hotel-transport-shuttle`  
**Research:** `docs/pipeline/hotel-transport-shuttle/02-research.md`  
**Surface:** hotel result scan → expanded hotel details → booking review  
**Date:** 2026-07-31

## 0. Product decision and release boundary

This design makes the absence or failure of transport evidence explicit and prevents airport
distance from being mistaken for transport availability. It does not promise a shuttle feature
that the current supplier cannot support.

Hotellook is retired and its endpoint returns HTTP 404. Therefore:

- the only state the current failed provider check may render is **could not be checked**;
- **not documented** is allowed only after a future provider successfully returns the property but
  omits transport information;
- complimentary, paid, hours, action, and explicit-unavailable states are implementation-ready but
  remain **future-provider-gated**;
- no state may be derived from hotel name, property type, stars, generic amenity text, coordinates,
  or distance from an airport;
- static fixtures and stale Hotellook objects are test inputs only, never production evidence.

The current release-sized repair is the honest failure/omission presentation plus the
airport-distance anti-inference guard. Replacing Hotellook or procuring a transport-capable hotel
provider is outside this ticket and remains a P0 dependency for live hotel inventory.

## 1. Information hierarchy and placement

### 1.1 Collapsed result card

Preserve the current card hierarchy:

1. **Primary:** nightly room price and `Review hotel`.
2. **Secondary:** property name, Deal Score, and location identity.
3. **Tertiary:** eligibility, admission, parking, funds, pet, smoking, and one transport summary.
4. **Disclosure:** the existing full-width `Details` control.

Place one transport summary after `ParkingSummary` and before funds, pet, and smoking summaries.
This keeps transport out of the location block while making it scannable before Deal Score and the
booking action. Render it for airport-linked searches and whenever transport evidence was actually
returned. A non-airport search with no returned transport evidence adds no collapsed line.

The summary is static text, not a chip or control. Do not add an icon, checkmark, success color,
second distance, tooltip, or nested disclosure. Base classes:

```txt
mt-1.5 break-words text-xs font-medium leading-5 text-[color:var(--text-2)]
```

Only an explicit provider-reported unavailable state adds
`text-[color:var(--warning)]`; all other states remain neutral. The line occupies the full card
width below the three-column identity/price row, so it never compresses the price column.

### 1.2 Expanded result details

Add one canonical section titled `Airport transfer` immediately after `Location` and before
admission and parking. Transport remains a separate decision from distance and parking, while its
adjacency to Location makes the anti-inference caveat hard to miss.

Panel shell:

```txt
rounded-[var(--radius-card)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] px-3.5 py-3
text-xs leading-5 text-[color:var(--text-2)]
```

Heading:

```txt
font-medium text-[color:var(--text-1)]
```

Ready facts use one `<dl>`:

```txt
mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6
```

Every row has a `<dt>` with `font-medium text-[color:var(--text-1)]`; its `<dd>` uses
`mt-0.5 break-words font-medium text-[color:var(--text-2)]`. Source metadata is full-width and uses
`mt-1 break-words text-[color:var(--text-3)]`.

### 1.3 Booking review

Render the same canonical `Airport transfer` section inside `Supporting evidence`, after rate
restrictions and before parking. It consumes the selected offer's serialized evidence; it does not
re-fetch or normalize again. This section uses the booking panel's existing spacing but otherwise
shares the detail component and copy.

In `Check rooms with provider`, append the applicable confirmation task before the outbound CTA.
Do not move, rename, disable, or alter the affiliate-marked provider link.

## 2. Shared normalized evidence contract

Transport needs a dedicated object. Do not add `airport_shuttle` to `HotelAmenityEvidence`, reuse
the flight provider's unrelated `transfers` field, or overload parking evidence.

The downstream data contract must be equivalent to:

```ts
type HotelTransportServiceKind =
  | 'airport_shuttle'
  | 'airport_transfer'
  | 'other_documented'

type HotelTransportDirection =
  | 'to_property'
  | 'from_property'
  | 'round_trip'
  | 'unknown'

type HotelTransportOperator = 'property' | 'third_party' | 'unknown'
type HotelTransportCostState = 'included' | 'paid' | 'unknown'
type HotelTransportChargeBasis = 'per_person' | 'per_vehicle' | 'per_booking' | 'unknown'
type HotelTransportTripBasis = 'each_way' | 'round_trip' | 'unknown'
type HotelTransportHoursMode = '24_hours' | 'scheduled' | 'on_request' | 'unknown'
type HotelTransportAction =
  | 'none_documented'
  | 'reserve_before_arrival'
  | 'call_on_arrival'
  | 'contact_property'
  | 'unknown'

interface HotelTransportTimeWindow {
  startLocal: string // validated HH:mm only
  endLocal: string   // validated HH:mm only
  days?: string     // provider-authored display value, sanitized; never inferred
}

interface HotelTransportEvidence {
  state: 'loading' | 'ready' | 'error'
  facilityStatus: HotelEvidenceStatus
  serviceKind?: HotelTransportServiceKind
  endpointName?: string
  direction?: HotelTransportDirection
  operator?: HotelTransportOperator
  cost?: {
    state: HotelTransportCostState
    amount?: Money
    chargeBasis: HotelTransportChargeBasis
    tripBasis: HotelTransportTripBasis
  }
  hours?: {
    mode: HotelTransportHoursMode
    windows?: readonly HotelTransportTimeWindow[]
    timezone?: string
  }
  action?: {
    kind: HotelTransportAction
    instruction?: string
    advanceDeadline?: string
  }
  sourceLabel?: string
  fetchedAt?: string
  confidence?: HotelAmenityConfidence
  evidenceRevision: string
  conflictDimensions?: readonly (
    | 'facility'
    | 'service_kind'
    | 'direction'
    | 'operator'
    | 'cost'
    | 'hours'
    | 'action'
  )[]
}
```

Add `transportEvidence?: HotelTransportEvidence` to `HotelOffer` and `BookingHotelContext`. Preserve
it through normalized provider responses, Redis validation, `/api/search`, inline query context,
stored booking context, and booking review. Money remains `Money` with integer `priceCents` and an
ISO currency; invalid money is discarded, never coerced to zero.

### 2.1 Evidence gates

- A `confirmed` or `unavailable` facility claim requires a recognized non-empty `sourceLabel` and a
  valid `fetchedAt`. Missing either degrades the whole presentation to `unclear`.
- `not_returned` is valid only with `state: 'ready'` after a successful property response.
- `state: 'error'` always renders **could not be checked** and cannot carry a new positive or
  negative claim. During background refresh, last verified evidence may remain visible with the
  refresh status specified in §5.2.
- `confirmed + paid` remains paid when amount or bases are missing. Missing data never becomes
  included, free, zero, or unavailable.
- `unavailable` means the source affirmatively reports no airport transport. Omission is
  `not_returned`, not unavailable.
- Conflicting facility, cost, hours, or action facts render the consolidated unclear state. Do not
  choose the more favorable value.
- `airport_shuttle` and `airport_transfer` may share the visible title, but generic local shuttle,
  theme-park shuttle, parking shuttle, or transit service is excluded unless the source explicitly
  documents an airport endpoint.
- Hours never inherit check-in windows or front-desk hours.

## 3. Final collapsed-summary copy

Use exactly one of these strings. `{amount}` uses `formatMoney`; bases use the copy in §4.2.

| Normalized condition | Visible string | Accessible name |
|---|---|---|
| `loading`, no prior evidence | `Checking airport transfer…` | `Checking airport transfer details.` |
| confirmed + included | `Complimentary airport transfer` | `Complimentary airport transfer reported by {sourceLabel}. Review hours and advance instructions in details.` |
| confirmed + paid + valid amount + both known bases | `Airport transfer · {amount} {charge basis}, {trip basis}` | `Paid airport transfer. {amount} {charge basis}, {trip basis}. Reported by {sourceLabel}. Review hours and advance instructions in details.` |
| confirmed + paid, missing/invalid amount | `Airport transfer · Paid; amount not documented` | `Paid airport transfer. Amount not documented. Review cost basis, hours, and advance instructions in details.` |
| confirmed + paid + amount, one/both bases unknown | `Airport transfer · {amount}; charge basis not fully documented` | `Paid airport transfer. {amount}. Charge basis not fully documented. Review details.` |
| confirmed + unknown cost | `Airport transfer · Cost not documented` | `Airport transfer reported. Cost not documented. Review hours and advance instructions in details.` |
| explicit unavailable | `No airport transfer reported` | `No airport transfer reported by {sourceLabel}.` |
| successful response omits field | `Airport transfer not documented` | `Airport transfer not documented by this provider. This does not mean no service exists.` |
| source/network/provider failure | `Airport transfer details could not be checked` | Same as visible string. |
| malformed, missing provenance, or conflict | `Airport transfer details are unclear` | `Airport transfer details are unclear. Confirm directly with the property before arrival.` |

Do not render `Free shuttle`, `Shuttle available`, `Airport pickup`, or `No shuttle` as substitutes.
`Complimentary` is allowed only for normalized `cost.state === 'included'`.

## 4. Canonical detail content and copy

### 4.1 Fixed fact order

For a verified confirmed service, answer the four traveler questions in this order:

1. `Service`
2. `Cost`
3. `Hours`
4. `Before arrival`
5. full-width source metadata

Do not repeat the airport distance inside this panel.

### 4.2 Value vocabulary

**Service**

- Airport and direction known: `{service label} between {endpointName} and the property · {direction}`
- Endpoint known, direction unknown: `{service label} for {endpointName} · Direction not documented`
- Endpoint absent: `{service label} · Airport endpoint not documented`
- Operator suffix: ` · Property operated`, ` · Third-party operated`, or ` · Operator not documented`

Service labels are `Airport shuttle`, `Airport transfer`, and `Documented airport transport`.
Direction labels are `To the property`, `From the property`, and `Round trip`.

**Cost**

- included: `Complimentary.`
- paid + valid amount: `{amount} {charge basis}, {trip basis}. Separate from the displayed nightly room rate.`
- paid + no valid amount: `Paid; amount not documented. Separate from the displayed nightly room rate.`
- unknown: `Cost not documented. Confirm any charge with the property.`

Charge bases are `per person`, `per vehicle`, `per booking`, and `charge basis not documented`.
Trip bases are `each way`, `round trip`, and `trip basis not documented`. If the provider explicitly
documents that transport is included in the displayed room rate, omit the separate-rate sentence;
absence of that statement never implies inclusion.

**Hours**

- 24 hours: `24 hours. Your arrival-time fit was not checked.`
- scheduled with valid timezone: `{window(s)} {timezone}. Your arrival-time fit was not checked.`
- scheduled without timezone: `{window(s)}, property local time. Your arrival-time fit was not checked.`
- on request: `On request. Your arrival-time fit was not checked.`
- unknown/malformed: `Hours not documented. Confirm operating hours for your arrival.`

Multiple windows are separated by semicolons. Preserve the source's day grouping but not arbitrary
HTML. Never say `Available when you arrive`, `Covers your flight`, or `Open at landing` because the
flow has neither a hotel-arrival timestamp nor a reliable property timezone.

**Before arrival**

- none documented: `No advance action documented. Confirm this remains current before arrival.`
- reserve: `Reserve before arrival.` Append ` {advanceDeadline}.` only when sourced and sanitized.
- call on arrival: `Call the property on arrival.`
- contact property: `Contact the property before arrival.`
- unknown: `Advance instructions not documented. Confirm directly with the property.`

If a verified, safe provider instruction exists, append it after the canonical sentence. Render it
as text only—never as executable HTML, an unverified phone link, or an in-product reservation
control.

**Source**

`Source: {sourceLabel}. Updated {MMM D, YYYY}.`

Both parts are mandatory for positive and negative claims. Do not show raw timestamps. If either
part is invalid, use the unclear state instead.

### 4.3 Explicit unavailable

Render one warning-toned message within the neutral panel:

`The provider reports no airport transfer at this property.`

Then show `Source: {sourceLabel}. Updated {MMM D, YYYY}.` The message container uses:

```txt
mt-2 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)]
px-3 py-2 font-medium text-[color:var(--warning)]
```

Its accessible name is `Airport transfer. Unavailable. The provider reports no airport transfer at
this property. Source: {sourceLabel}. Updated {date}.` Color is never the only state cue.

## 5. Complete state specification

### 5.1 Default: successful response, no field

This is valid only after a future provider successfully returns a property response. The collapsed
copy is `Airport transfer not documented` when the search is airport-linked; otherwise the
collapsed line is omitted. The expanded and booking-review panel always says:

`The hotel provider did not document an airport transfer. Confirm directly with the property before arrival.`

Use:

```txt
mt-2 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]
px-3 py-2 font-medium text-[color:var(--text-3)]
```

Accessible name: `Airport transfer. Not documented by the hotel provider. Confirm directly with the
property before arrival.` No source name or update date is fabricated, and this state never uses
`No`, `Unavailable`, or warning styling.

### 5.2 Loading and refresh

The collapsed line says `Checking airport transfer…`. The expanded section title remains visible
and contains a paragraph with `role="status" aria-live="polite"`:

`Checking airport transfer details…`

Classes: `mt-2 font-medium text-[color:var(--text-3)]`. Decorative skeletons are optional and
`aria-hidden="true"`.

If verified evidence already exists during background refresh, retain every prior fact and append
`Refreshing airport transfer details…` as the polite status. Do not replace verified content with a
skeleton, and do not change the serialized booking-review revision mid-review.

### 5.3 Provider/source error — current shippable state

The collapsed airport-linked line says `Airport transfer details could not be checked`. The
expanded and booking-review panel says:

`Airport transfer details could not be checked. Confirm directly with the property before arrival.`

This is neutral because failure is not evidence of absence. Use the default muted container from
§5.1 with `role="status" aria-live="polite"`.

If and only if an isolated transport-evidence retry callback exists, render `Try airport transfer
details again`. On click, Enter, or Space it invokes only that callback, changes to `Checking airport
transfer…`, sets `disabled` and `aria-busy="true"`, and leaves hotel inventory, price, Deal Score,
expanded state, and booking actions intact. Without an isolated callback, omit retry rather than
rerunning the full hotel search.

Retry classes:

```txt
mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)]
border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3
text-sm font-medium text-[color:var(--text-1)]
focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
focus-visible:outline-[var(--border-focus)]
```

### 5.4 Confirmed complimentary

Use the confirmed summary and the five-part detail block. Cost reads `Complimentary.` Neutral brand
text is used; do not use a green fill or success check, because service existence does not prove
schedule fit. Hours and action must still be present or explicitly unresolved.

### 5.5 Confirmed paid

Never hide `Paid`. Show amount, currency, charge basis, and trip basis individually when valid.
Missing amount reads `Paid; amount not documented`; unknown bases are named. Always include
`Separate from the displayed nightly room rate` unless explicit source evidence binds the charge to
the room rate. Transport cost does not alter Deal Score in this ticket.

### 5.6 Confirmed service, cost unknown

Service may be claimed, but cost cannot. Use `Cost not documented. Confirm any charge with the
property.` Do not style the service as complimentary or use `included` iconography.

### 5.7 Explicit unavailable

Use §4.3 only when the source affirmatively reports absence and valid provenance exists. Preserve
that claim through booking review. Do not provide a retry for a ready negative state.

### 5.8 Malformed or conflicting evidence

The collapsed line says `Airport transfer details are unclear`. The expanded and booking-review
panel says:

`Airport transfer information from this provider is unclear. Confirm cost, hours, and required advance action directly with the property before arrival.`

Use the neutral muted container. Do not expose raw conflict values or provider payloads. If the
normalized object supplies conflict dimensions, add one sentence using only these labels:
`Conflicting information: service availability, service type, direction, operator, cost, hours,
advance action.` Include only applicable labels. No dimension is silently resolved in the UI.

### 5.9 Airport-distance anti-inference guard

The collapsed card continues to show no distance. In the expanded `Location` panel, when
`location.anchor.kind === 'airport'` and `distanceText` renders, immediately follow the distance
with one of these sentences in the same paragraph or the next paragraph:

- confirmed or unavailable transport evidence: `Straight-line distance only. See Airport transfer for service details.`
- successful omission: `Straight-line distance only. Airport transfer not documented.`
- error: `Straight-line distance only. Airport transfer details could not be checked.`
- unclear/loading: `Straight-line distance only. Airport transfer availability is not confirmed.`

Use `mt-1 break-words text-[color:var(--text-3)]`. Do not show this transport sentence for a venue,
landmark, or city-center anchor. Keep any existing general travel-distance caveat; if equivalent,
merge it into one sentence rather than repeat it. Booking review must not introduce a new distance
line if it does not already render one.

### 5.10 Missing dates, airport, or arrival time

- Missing stay dates do not suppress property-level transport evidence. Cost must not claim
  stay-specific totals.
- Missing airport endpoint renders `Airport endpoint not documented`; never substitute the search
  airport unless the source explicitly binds the service to it.
- Missing arrival time or timezone never suppresses documented hours, but always retains `Your
  arrival-time fit was not checked.`
- Overnight windows such as `22:00–05:00` render as supplied after validation; the UI does not split
  or reinterpret them.

## 6. Booking continuity and handoff copy

The same `evidenceRevision`, source, timestamp, facility state, cost, hours, and action selected on
the result must round-trip through both booking-context paths. Booking review must not:

- call a provider again;
- infer an endpoint from `HotelLocation.anchor`;
- upgrade omission to unavailable;
- discard paid state when amount is missing;
- replace an older selected revision with a newer search-card revision.

The canonical section renders before Parking in `Supporting evidence`. Add this guidance beneath
the existing provider-confirmation paragraph:

- confirmed with fully documented hours/action: `Reconfirm airport-transfer details with the provider before arrival.`
- any cost/hours/action unresolved: `Confirm airport-transfer cost, hours, and required advance action with the provider before arrival.`
- explicit unavailable: `The selected offer reports no airport transfer. Arrange arrival transport separately.`
- source error or unclear: `Airport-transfer details were not confirmed. Check directly with the property before arrival.`
- successful omission: `The provider did not document airport-transfer details. Check directly with the property before arrival.`

For paid service, append: `The transport charge is separate from the displayed nightly room rate.`
unless explicit evidence says otherwise. The provider handoff CTA and `rel="noopener noreferrer
sponsored"` remain unchanged.

If booking-context validation loses or rejects transport evidence, render the unclear state, not
not-documented. This makes serialization failure distinguishable from a successful provider
omission.

## 7. Interaction, keyboard, and accessibility

- The existing `Details` button remains the only result-card disclosure. Click, tap, Enter, or Space
  toggles the existing details region, label (`Details` / `Hide details`), `aria-expanded`, and
  `aria-controls`. Opening does not move focus.
- The transport summary is static and receives no `tabIndex`. Its accessible name carries service
  and cost state; it never relies on the word `shuttle` alone.
- The detail component is `<section aria-labelledby="hotel-transport-title-{offerId}">`. Facts use a
  semantic `<dl>`. Static rows are not tab stops.
- The optional retry is the only new interactive control. It has a 44px target and visible global
  focus outline. On completion, focus stays on the button if it remains mounted; the polite status
  announces the result once.
- Loading, refresh, and error use `role="status" aria-live="polite"`. Do not use assertive alerts for
  unavailable evidence.
- Explicit unavailable includes the words `Unavailable` in its accessible name. Paid, unknown,
  omitted, failed, and conflicting states are conveyed in text, not color.
- Long airport names, provider labels, instructions, currencies, and source metadata use
  `break-words`; no meaningful text uses `truncate` or `line-clamp` in the canonical panel.
- At 200% zoom, content reflows without horizontal scrolling or overlapping the provider CTA.
- DOM order in expanded results is Deal Score → Quality → Location → Airport transfer → admission
  → Parking → other evidence → Price scope → Provider handoff. Booking DOM order places Airport
  transfer before Parking and before the outbound action's supplemental confirmation task.

## 8. Responsive specification

### Mobile — 375px

- Keep the existing card padding, thumbnail, three-column identity/price grid, price, Deal Score,
  `Review hotel`, and `Details` control unchanged.
- The collapsed transport summary spans the card beneath parking. It wraps to multiple lines; no
  fixed height, horizontal scroll, or clipping is permitted.
- Expanded and booking-review content is one column. The `<dl>` uses `grid-cols-1`; each label stays
  directly above its value.
- Long paid strings wrap naturally. Never shorten away `Paid`, amount, charge basis, or trip basis
  just to fit one line.
- Retry is full-width only if the existing component convention requires it; either way it remains
  at least 44px high and does not sit beside body copy.

### Desktop — 1280px

- Keep the existing card and booking-review max widths. Transport does not become a side rail or
  compete with room price.
- The confirmed detail `<dl>` becomes two columns at `sm`; `Service` and `Cost` occupy the first row,
  `Hours` and `Before arrival` the second. Source metadata and aggregate state messages span both
  columns with `sm:col-span-2`.
- No state introduces a fixed panel height. Paired rows may have different heights.

## 9. Analytics contract

Instrument only when a production analytics transport exists; console logging is not behavioral
measurement.

- `hotel_transport_summary_viewed`: `offer_id`, `provider`, `transport_state`, `cost_state`,
  `anchor_kind`, `surface`, `viewport_group`.
- `hotel_transport_details_viewed`: the same plus `hours_state`, `action_state`.
- Add those low-cardinality transport dimensions to existing provider-handoff and back-to-results
  events.

An impression fires after at least 50% visibility for one second and deduplicates by offer id +
evidence revision + surface. Allowed state values are normalized enums, never airport names,
instructions, amounts, source payloads, free text, or timestamps. `not_returned`, `error`, and
`unclear` remain distinct. Do not claim outcome improvement until events reach a production sink.

## 10. Tailwind and token rules

Use only tokens already defined in `app/globals.css`:

- panel: `--bg-raised`, `--border`, `--radius-card`;
- neutral unresolved fill: `--bg-muted` with `--text-3`;
- primary copy: `--text-1`; supporting copy: `--text-2`; metadata: `--text-3`;
- explicit sourced unavailable only: `--warning-soft` and `--warning`;
- retry focus: `--border-focus` plus the global `--focus-ring` behavior.

Do not add colors, shadows, gradients, badges, decorative icons, or success fills. Use the existing
remapped `text-xs`, `text-sm`, and `text-xl` sizes; no arbitrary font sizes.

## 11. Edge-case rules

- Duplicate revisions: retain one normalized revision; any same-revision disagreement is unclear.
- Multiple documented airport services: render at most one canonical service selected by the
  adapter. If services differ in cost, hours, action, or endpoint and cannot be losslessly combined,
  render unclear; do not create a carousel or selector.
- Invalid currency, non-integer `priceCents`, negative amounts, or bare numeric amounts: discard the
  amount and retain paid state.
- Zero amount with `paid`: retain paid and render amount not documented unless the adapter resolves
  the contradiction. Never relabel it complimentary.
- Included with a paid amount: unclear.
- Invalid time strings, impossible windows, or untrusted timezone: hours not documented; other
  valid service facts may remain.
- Missing or invalid `fetchedAt` on confirmed/unavailable: whole claim becomes unclear.
- Future timestamps or expired evidence follow the provider freshness policy; they never silently
  become current. If no policy can validate them, render unclear.
- HTML, URLs, phone numbers, or control characters in instruction/source fields render as sanitized
  plain text or are omitted. This ticket does not add contact actions.
- A hotel named `Airport Shuttle Inn`, an airport anchor at `0.1 mi`, or property type `airport
  hotel` with no evidence still renders not-documented/error/unclear as appropriate.
- Transport state never changes search rank, Deal Score, room price, hotel availability, or the
  enabled state of valid booking actions.
- Provider error cannot erase or disable an otherwise valid hotel offer.

## 12. Acceptance checklist

- Every positive and negative transport claim has a valid source label and fetched time.
- No production path derives service, endpoint, cost, hours, or action from proximity, name,
  property type, stars, or generic amenities.
- Current Hotellook failure renders `could not be checked`, never `not documented` or unavailable.
- A future successful omission renders `not documented`, never `No airport transfer`.
- Complimentary, paid with full amount, paid without amount, unknown cost, explicit unavailable,
  loading, refresh, error, unclear/conflict, and default states use the exact copy rules above.
- Every confirmed state explicitly provides or marks unresolved service, cost, hours, and advance
  action.
- Paid state survives missing amount and never becomes zero/free/included.
- Hours always state that arrival-time fit was not checked; no check-in or desk hours leak in.
- Expanded airport distance has the correct anti-inference sentence; collapsed results add no
  distance.
- Result detail and booking review use the same evidence revision without re-fetching.
- Booking review names the outstanding confirmation task before provider handoff; affiliate markers
  and outbound action behavior remain untouched.
- Provider/error states leave price, Deal Score, search, expansion, and valid booking actions usable.
- `Details` semantics, optional retry behavior, live-region announcements, focus ring, and reading
  order pass keyboard and screen-reader checks.
- Layout remains usable at 375px, 1280px, and 200% zoom with long names and instructions.
- Analytics distinguishes not-documented, error, and unclear without sending high-cardinality
  transport content.

## 13. Downstream boundary and handoff

### UI stage

Implement the summary, shared canonical detail component, airport-distance caveat, booking-review
placement, exact states/copy, responsive classes, semantics, and component tests. UI may add
additive props and state wiring but must not call providers, replace Hotellook, change business
logic, alter Deal Score, or invent evidence. Positive fixtures are test-only and must be visibly
provider-gated in the component contract.

### DEV stage required after UI

The current code has no transport evidence contract and no live capable source. DEV must add and
validate the dedicated types, normalization/cache/search propagation, booking-context serialization
and validation, retry plumbing if feasible, and analytics dimensions. Every external call remains
in `lib/providers`; adapters return `Result<T>`; money remains integer minor units; secrets remain in
env; outbound deeplinks retain affiliate markers.

Provider procurement/replacement remains a separate P0 decision. Until a verified source exists,
production must never display confirmed, complimentary, paid, or unavailable transport claims.

Create `UI-HOTEL-TRANSPORT-SHUTTLE-01` referencing this specification. The UI handoff must explicitly
carry the retired-provider blocker, future-provider gate, booking-continuity requirement, and
airport-distance anti-inference acceptance test.
