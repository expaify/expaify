# UXDES-HOTEL-NOISE-FIT-01: Quiet-stay evidence ledger

Date: 2026-07-22  
Stage: UX Design  
Priority: P0  
Upstream: `docs/pipeline/hotel-noise-fit/02-research.md`

## 1. Decision and scope

Design a source-separated **Quiet-stay evidence** ledger that helps a traveler
inspect what is known without predicting whether a specific room will be quiet.
The ledger has exactly three evidence classes, in this order:

1. **Provider facts** — documented property, room-type, selected-stay, or
   request-capability facts from the contracted accommodation provider.
2. **Nearby context** — attributable factual proximity from a licensed
   geospatial source.
3. **Guest review theme** — licensed, provider-derived guest opinion about
   noise.

These classes never collapse into a score, badge, filter, rank, risk level, or
overall quiet/noisy verdict. Deal Score remains price-only and visually and
semantically separate.

This is a fallback-first repair specification, not approval to launch populated
evidence. No current provider supplies licensed quiet-stay evidence, and the
current Hotellook supplier is closed. Until provider replacement, field mapping,
display rights, and source-specific freshness rules are confirmed, production
may render only the honest no-evidence fallback described in §7.2. Populated
fixtures are specified now so that later provider work has a bounded contract.

### Actual mounted production target

The target is the production hotel deal path that exists today:

- **Scan tier:** `DealCard` in `app/components/ui/DealCard.tsx`, mounted by
  `DealFeed` on `/deals`.
- **Inspection tier and ledger owner:** `app/deals/[dealId]/page.tsx`, reached
  from the mounted card.
- **Handoff continuity:** `HotelHandoffReview` in
  `app/book/BookingFlow.tsx`, but only after populated evidence has been carried
  through a validated booking context.

`app/components/HotelCard.tsx` is tests-only and is not the implementation
target. UI must not implement this design solely in that dormant component.

The current mounted `DealCard` has no disclosure. Do not add one. It remains the
compact scan surface; the linked deal-detail page is the expanded detail.

## 2. User promise and prohibitions

The ledger answers: **“What evidence can I inspect before I continue?”** It does
not answer: **“Will my room be quiet?”**

Never use these labels or close synonyms:

- `Quiet`, `Likely quiet`, `Quiet hotel`, `Quiet room available`
- `Noisy`, `Low noise`, `High noise`, `Noise exposure`, `Noise risk`
- `Quiet-stay score`, `Noise score`, `Good for light sleepers`
- `Verified by expaify`, `Measured`, or `Guaranteed` unless a selected-stay
  provider contract supplies that exact attribute

Never use red/amber/green treatment, thumbs, stars, checks, or warning icons to
summarize the evidence. Conflicting facts are not errors and missing evidence is
not positive evidence.

## 3. Information architecture and hierarchy

### 3.1 `/deals` scan tier

Preserve the current hierarchy:

1. Hotel identity, star class, city, and date window.
2. Current nightly price, usual price, and price-only Deal Score language.
3. Optional single quiet-stay evidence line.
4. Property image, provider comparison, and price-source metadata.

The optional line appears after the location/date line and before price/actions
only when a valid provider fact or licensed guest-review theme exists. It must
not appear for nearby context alone because the required caveat cannot be
carried safely in the scan tier.

At most one line is allowed. Priority is:

1. selected-stay provider fact;
2. room-type provider fact;
3. property provider fact;
4. requestable quiet-room fact;
5. licensed guest-review theme.

Unknown, checking, failed, stale, conflicting-only, not-returned, and
insufficient-location states add **zero** elements to the card. No badge,
placeholder, skeleton, or “details unavailable” line is added.

### 3.2 `/deals/[dealId]` inspection tier

Place the ledger after the price-only Deal Score and before the property photo
and provider action zone. This lets the traveler inspect evidence before an
outbound provider choice while keeping price reasoning distinct.

Within the ledger:

1. Heading: **Quiet-stay evidence**.
2. Persistent scope caveat.
3. Overall request-state message, when applicable.
4. Conflict message, when applicable.
5. **Provider facts** group.
6. **Nearby context** group.
7. **Guest review theme** group.
8. Source/freshness metadata within each item, never in a detached footnote.

The primary provider actions remain outside and after the ledger. Evidence
checking, absence, or failure never disables or relabels an available provider
action.

### 3.3 Handoff tier

If and only if at least one populated item was shown on the detail page, repeat
the same source-separated ledger inside `HotelHandoffReview`, after the
responsibility comparison and before the existing **Special requests** block.
Do not introduce new interpretation or fresher claims during handoff.

If no populated evidence exists, render no quiet-stay block at handoff. The
existing **Special requests** guidance remains the sole quiet-room next-step
owner. Do not repeat the no-evidence fallback there.

## 4. Component anatomy

Use one semantic `<section aria-labelledby="quiet-stay-title">`.

```txt
QuietStayEvidenceLedger
├── h3 “Quiet-stay evidence”
├── scope caveat
├── request status (conditional, polite live region)
├── conflict notice (conditional)
├── EvidenceGroup “Provider facts”
│   └── zero or more EvidenceItem
├── EvidenceGroup “Nearby context”
│   └── zero or more EvidenceItem
└── EvidenceGroup “Guest review theme”
    └── zero or more EvidenceItem
```

On the detail and handoff tiers, each class heading is always present when the
overall state is `evidence_available`, even if that class has no valid item.
An empty class uses the class-specific unknown copy in §6. This prevents a
traveler from mistaking an omitted class for a positive result.

For `no_evidence_returned`, render the heading, scope caveat, and one overall
fallback only; do not render three repetitive empty groups.

The component has no checkbox, toggle, selector, save action, request field,
retry button, tooltip, modal, or local Details disclosure. The deal-detail page
is already the expanded inspection tier.

## 5. Evidence model and display eligibility

This section defines the UI/view-model contract. Provider and DEV stages own
normalization. A component must never derive evidence from hotel stars, price,
Deal Score, city, aggregate rating, photo, or unstructured vendor text.

### 5.1 Container

```ts
type QuietEvidenceOverallState =
  | 'checking'
  | 'evidence_available'
  | 'no_evidence_returned'
  | 'check_failed'

type QuietStayEvidenceLedger = {
  overallState: QuietEvidenceOverallState
  providerFacts: ProviderQuietFact[]
  nearbyContext: NearbyContextItem[]
  reviewTheme: GuestNoiseTheme | null
  locationPrecision: 'exact' | 'coordinates' | 'area' | 'search_area' | 'missing'
  conflictClasses: QuietEvidenceConflict[]
}
```

Arrays contain only normalized, display-eligible items. Unknown/stale/error
states remain class state metadata and must not be invented as evidence items.

### 5.2 Provider facts

Allowed canonical ids:

- `soundproofing_property`
- `soundproofing_room`
- `quiet_room_option`

Every item requires `id`, `status`, `scope`, `certainty`, `sourceLabel`, and
`fetchedAt`. A room fact also requires a provider room-type label. A
selected-stay fact requires a selected product identifier at the provider
boundary; it is not derived from a generic room name.

Display rules:

- Provider omission means `not_returned`, never unavailable or absent.
- Property soundproofing never implies all rooms.
- Room-type soundproofing never implies the selected stay.
- A quieter-room option is `requestable` unless selected-stay or explicit
  property-response evidence proves `guaranteed`.
- Source older than its provider-specific approved TTL is stale and suppressed;
  do not reuse the six-hour price-cache age as fact freshness.

### 5.3 Nearby context

Allowed launch candidates are `airport`, `rail`, `major_road`, and `nightlife`.
`temporary_works` remains disabled until an authoritative, stay-date-aware
source and display rights exist.

Every rendered item requires:

- `category` and a human-readable `referencePoint`;
- numeric `distance`, normalized unit, and documented `method`;
- `sourceLabel` and `sourceUpdatedAt`;
- property `locationPrecision` of `exact` or paired `coordinates`;
- source-specific freshness within its approved TTL.

Nightlife additionally requires a licensed venue category. Temporary works, if
ever approved, additionally requires named works, authoritative source, and
start/end dates overlapping the stay.

Area, search-area, or missing precision cannot render a distance. Conflicting
coordinate sources cannot render a distance until resolved. Never convert
proximity into a predicted noise level.

### 5.4 Guest review theme

Reuse the `noise` theme owned by hotel-review relevance. A rendered theme
requires a licensed provider-derived summary or score, `sourceLabel`, its own
review window, and sample/count when supplied. It must be framed as guest
opinion.

Do not show quotes, snippets, raw review text, or an expaify-generated summary
without explicit display/derivation rights. Do not substitute aggregate-rating
freshness or price-fetch freshness for the theme window.

### 5.5 Conflict model

A conflict records two fixed class ids, never free text. Valid pairs are:

- `provider_fact__review_theme`
- `provider_fact__nearby_context`
- `nearby_context__review_theme`

Conflict does not suppress otherwise valid items. Render both sources with
their own metadata and the neutral conflict message. Never select a winner or
average the sources.

## 6. Final UI copy

### 6.1 Persistent labels and caveat

| Element | Exact copy |
|---|---|
| Ledger heading | `Quiet-stay evidence` |
| Scope caveat | `These details describe provider information, nearby places, or guest opinion. They do not predict whether a specific room will be quiet.` |
| Group 1 | `Provider facts` |
| Group 2 | `Nearby context` |
| Group 3 | `Guest review theme` |
| Provider-class unknown | `No provider fact was supplied.` |
| Context-class unknown | `No usable nearby context was supplied.` |
| Review-class unknown | `No licensed guest noise theme was supplied.` |

### 6.2 Overall and uncertain states

| State | Exact visible copy | Rendering rule |
|---|---|---|
| Default / no evidence returned | `Quiet-stay details were not provided by this hotel source. Location and rating do not tell us whether a room will be quiet.` | Expanded detail only; one fallback, no three groups |
| Checking | `Checking quiet-stay evidence…` | `role="status"`, `aria-live="polite"`; no skeleton and no card-level line |
| Check failed | `Quiet-stay evidence could not be checked. Confirm room location, soundproofing, and current surroundings with the booking partner.` | Independent from inventory and price; no retry in this ledger |
| Insufficient location | `Property-level proximity cannot be calculated from the area information provided.` | Nearby-context group only; suppress category, reference point, and distance |
| Stale context | `Nearby context is out of date and is not shown.` | Nearby-context group only; suppress claim; show metadata line in §6.5 |
| Conflicting sources | `Sources differ. Review each source before deciding.` | Above all groups; render each valid source below |
| Context source error | `Nearby context could not be checked.` | Nearby group only; does not change overall state if another class is valid |
| Review source error | `Guest review themes could not be checked.` | Review group only |
| Provider-fact source error | `Provider facts could not be checked.` | Provider group only |

`stale` and `conflicting` are evidence-class states, not provider request states.
If every class is suppressed as stale, invalid, or error, the container resolves
to `check_failed` when a request failed, otherwise `no_evidence_returned`.

### 6.3 Provider facts

| Fact | Exact primary copy | Required metadata |
|---|---|---|
| Property soundproofing | `Provider lists soundproofing for this property. It may not apply to every room.` | `Property information from {sourceLabel} · Updated {date}` |
| Room-type soundproofing | `Provider lists soundproofing for this room type. Confirm the selected room before payment.` | `{roomTypeLabel} · Room information from {sourceLabel} · Updated {date}` |
| Quiet room requestable | `A quieter room can be requested. Requests depend on availability and are not guaranteed.` | `Request capability from {sourceLabel} · Checked {date}` |
| Selected-stay guarantee | `Provider confirms this quiet-room attribute for the selected stay.` | `Selected stay confirmed by {sourceLabel} · Checked {date}` |

The scan-tier line uses the same primary copy, never a shortened `Quiet` chip.
If it exceeds two lines at 375px, omit it from the card and retain it on detail;
do not truncate decision-critical copy.

### 6.4 Nearby context

Primary copy:

`{Reference point} is {distance} {unit} away in a straight line. Proximity does not predict noise in a specific room.`

Use a provider-supplied documented method in place of `in a straight line` only
when it is not straight-line distance. Metadata:

`Nearby data from {sourceLabel} · Updated {date} · Property location: {Exact address|Coordinates}`

Never display more precision than the source provides. Round consistently per
source contract; do not imply survey precision. Category labels may be `Airport`,
`Rail`, `Major road`, or `Nightlife venue`, but never risk labels.

### 6.5 Stale nearby context metadata

When stale context is suppressed, retain only:

`Last source update: {date} · {sourceLabel}`

This metadata is secondary to `Nearby context is out of date and is not shown.`
Do not show the stale reference point, distance, category, or map.

### 6.6 Guest review theme

Primary copy:

`Guests mention {provider-supplied noise summary}. Summary of guest reviews via {sourceLabel}.`

Metadata with sample:

`Based on {count} guest reviews from {windowStart}–{windowEnd}`

Metadata without a provider-supplied count:

`Guest review window: {windowStart}–{windowEnd}`

Never use `Travelers say`, `expaify found`, or a declarative property claim.
Sentiment or a provider-computed subscore must have an accessible text label;
do not expose an unexplained number or color scale.

### 6.7 Request truth copy

Comparison/detail contains no request control. If request capability is
provider-documented, it is a **Provider facts** item only.

At handoff, reuse the existing final copy in
`docs/pipeline/special-requests/03-design.md`, including:

- `Need a quiet room, high floor, or early check-in?`
- `Nothing is selected or sent by expaify.`
- `Requests depend on availability and are not guaranteed.`

Do not duplicate or alter the existing selected/transmitted/acknowledged/
guaranteed help. The ledger never changes those states.

## 7. Complete state specification

### 7.1 Default before evidence request begins

The canonical current capability resolves directly to
`no_evidence_returned`; do not flash a checking state when no evidence request
exists. The deal card remains unchanged. The detail page renders §7.2.

### 7.2 No evidence returned — required launch fallback

- Render the ledger heading, scope caveat, and exact fallback from §6.2 on
  `/deals/[dealId]`.
- Do not render empty group headings, icons, a score, a card-level line, or a
  request control.
- Keep price, Deal Score, images, and provider actions unchanged and usable.
- Do not carry this fallback to handoff.
- Do not emit `hotel_quiet_evidence_viewed`; there is no populated evidence.
  The details-opened event is also inapplicable because the card has no quiet
  disclosure.

### 7.3 Checking

- Use only when a separate provider-backed evidence request is genuinely in
  flight after inventory/detail is already available.
- Render the heading, caveat, and checking copy; set the section `aria-busy` to
  `true` and the message to polite status.
- Do not show three skeleton groups. Do not move focus.
- Do not disable the provider action or the linked deal card.
- If evidence arrives, replace the status with the populated groups and make
  one polite announcement: `Quiet-stay evidence updated.`
- If it fails, transition to §7.4 without changing hotel inventory status.

### 7.4 Check failed

- Render the heading, caveat, and exact failure copy.
- Remove `aria-busy`; announce the failure once with `role="status"`, not alert.
- No local retry appears because no independent retry contract exists. A future
  retry may be added only when the data layer exposes one.
- Keep provider actions enabled and in the same DOM position.
- Show no failure element on the scan card and carry no fallback to handoff.

### 7.5 Evidence available

- Render all three headings in fixed order.
- Render valid items under their owning class.
- For a class with no valid item, use its class-specific unknown sentence.
- Render the scope caveat before any positive item.
- Carry exactly the displayed valid items to handoff when continuity exists.
- Never turn the evidence into ranking or Deal Score input.

### 7.6 Insufficient location

- In **Nearby context**, render only the exact insufficient-location sentence.
- Do not display a category, POI, distance, map, direction, or stale coordinates.
- Provider facts and review theme remain independently usable.
- `locationPrecision` is announced through the fallback sentence; raw latitude
  and longitude are never visible or placed in accessible text.

### 7.7 Stale context

- In **Nearby context**, render the stale sentence and permitted last-source
  metadata from §6.5.
- Suppress all stale contextual claims.
- Do not mark the whole ledger stale when valid provider/review items exist.
- A stale provider fact or review theme follows the same suppression principle
  and uses the class unknown copy; this ticket does not invent a generic TTL.

### 7.8 Conflicting evidence

- Render the conflict message after the scope caveat and before group headings.
- Preserve every independently valid item and its metadata.
- Do not use alert semantics, warning color, source priority, a resolving label,
  or a recommendation.
- Example fixture: property soundproofing plus guest reports of street noise.
  Both appear; neither copy is modified to reconcile the other.

### 7.9 Partial class error

- A failed class shows its class-specific error sentence while valid classes
  remain visible.
- `overallState` remains `evidence_available` when any valid item remains.
- No global error banner appears. Error meaning must be in text, not color.

### 7.10 Hotel inventory/page error

Hotel inventory, deal-detail loading, stale-price, expired-deal, provider-link,
and malformed-handoff states remain owned by their current surfaces. Do not
render quiet evidence as a replacement for them. A quiet evidence failure must
never claim the hotel or price failed, and a hotel-page failure renders no
ledger analytics.

### 7.11 Long and malformed values

- Wrap source, room type, reference point, and review-window values; never
  line-clamp or horizontally scroll.
- Reject blank source labels, invalid dates, negative/non-finite distances,
  unpaired coordinates, or unknown enum values at normalization. The UI treats
  rejected items as not returned.
- Never print raw enum ids, URLs, coordinate pairs, adapter reasons, HTML, or
  provider exceptions.
- A source label longer than 80 characters is invalid for display and falls
  back to the class unknown state; do not truncate into ambiguity.

## 8. Interaction and request-state separation

| User action/system event | Result |
|---|---|
| Open a mounted `DealCard` | Navigate to the detail page; no request state changes. |
| Evidence request starts | Show independent checking state; hotel actions remain usable. |
| Evidence request succeeds | Replace status with ledger groups; announce update politely. |
| Evidence request fails | Show bounded failure; do not alter inventory or handoff state. |
| Read or scroll through evidence | No preference, request, or guarantee state is created. |
| Activate provider CTA | Existing outbound navigation occurs; this is not transmission or acknowledgement. |
| Open `How requests work` at handoff | Existing special-request help expands; ledger state is unchanged. |
| Return from provider | Do not show request sent, property response, or quiet-room confirmation. |

The four request states remain exact:

- **Selected:** user deliberately activates a provider-supported preference
  control. No such control exists in expaify.
- **Transmitted:** an adapter submits a documented field and receives a
  provider receipt. An outbound click is not transmission.
- **Acknowledged:** the provider/property explicitly responds about the request.
- **Guaranteed:** the selected stay contract or explicit property response
  confirms the attribute for this reservation.

Evidence item states (`ready`, `not_returned`, `insufficient_location`, `stale`,
`conflicting`, `error`) must never be mapped to request states.

## 9. Visual and Tailwind specification

Reuse `app/globals.css` tokens. Add no colors, typography scales, shadows,
radii, gradients, illustrations, maps, badges, or decorative icons.

### 9.1 Detail ledger

```txt
section:
  card mt-8 p-5 min-w-0

heading:
  text-h3 text-[color:var(--text-1)]

scope caveat:
  mt-2 text-sm leading-6 text-[color:var(--text-2)]

status / conflict message:
  mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)]
  bg-[color:var(--bg-base)] px-3.5 py-3 text-sm leading-6
  text-[color:var(--text-2)]

group list:
  mt-5 divide-y divide-[color:var(--border)]

group:
  py-4 first:pt-0 last:pb-0

group heading:
  text-sm font-bold leading-5 text-[color:var(--text-1)]

items:
  mt-3 space-y-3

item:
  min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)]
  bg-[color:var(--bg-raised)] px-3.5 py-3

primary item copy:
  text-sm leading-6 text-[color:var(--text-1)]

metadata:
  mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]

class unknown/error:
  mt-2 text-sm leading-6 text-[color:var(--text-2)]
```

Do not use `--success`, `--warning`, or `--error` for evidence meaning. The
neutral token treatment is intentional because the ledger does not judge fit.

### 9.2 Scan-tier evidence line

```txt
container:
  mt-2 min-w-0

copy:
  line-clamp-2 text-[12px] font-medium leading-snug
  text-[color:var(--text-2)]
```

Implementation must first verify the final primary copy fits two lines for the
supported locale. If it does not, omit it rather than truncate. No icon or chip.
Do not change the price block or card height with placeholders.

### 9.3 Handoff ledger

Use the same neutral item styling as the existing responsibility and Special
requests inset blocks:

```txt
section:
  mt-5 rounded-lg border border-[color:var(--border)]
  bg-[color:var(--bg-raised)] px-3.5 py-3

heading:
  text-sm font-bold leading-5 text-[color:var(--text-1)]

body / groups:
  same semantic order and text tokens as detail, without a second outer card
```

Place this section immediately before **Special requests**. The filled provider
CTA remains the strongest visual action.

## 10. Responsive behavior

### 10.1 Mobile — 375px

- Respect the existing `px-5` detail shell; all ledger content fits the
  approximately 335px content width with `min-w-0` and natural wrapping.
- Use one column. Each evidence group and item spans full width.
- Do not create horizontal scroll, a nested scroll region, carousel, tooltip,
  popover, sticky ledger, or side-by-side metadata.
- Long names and source metadata wrap; decision-critical copy has no ellipsis.
- The optional scan-tier line must not move, overlap, or shrink the nightly
  price, Deal Score language, CompareRow, or whole-card focus ring.
- Checking/failure content may increase page height but never reserves space on
  every card.
- At 200% browser zoom and supported text enlargement, focus outlines remain
  visible and the provider action remains reachable through normal page scroll.

### 10.2 Desktop — 1280px

- Retain the detail page `max-w-[760px]`; the ledger uses the full content
  column rather than introducing a sidebar.
- Keep groups vertically stacked. Do not make three columns: source and caveat
  text need a single predictable reading order.
- On `/deals`, the existing responsive grid remains unchanged; the optional
  line wraps within its own card.
- In handoff, keep the repeated ledger inside the existing 380px right panel.
  If its content exceeds viewport height, normal page scrolling must expose all
  content; sticky positioning must not trap it.

## 11. Keyboard, focus, and assistive technology

### 11.1 Semantics

- Detail ledger is a `<section>` named by its `<h3>`.
- Each class is a nested section or a list group with an `<h4>`; items are a
  semantic `<ul>`/`<li>` when more than one item exists. Do not use a table.
- Source, scope/method, freshness/window, and uncertainty remain visible text in
  DOM reading order. Do not hide the caveat in an accessible name or tooltip.
- Static evidence items receive no `tabIndex`, button role, or click handler.
- Decorative separators and any future icons are `aria-hidden="true"`.

### 11.2 Keyboard and focus

On the current mounted path, keyboard order is:

1. Linked `DealCard` in the results grid.
2. Existing detail-page navigation and actions in DOM order.
3. Static ledger content in screen-reader reading order, with no added tab stop.
4. Existing provider action(s).

No control is added inside the ledger. If a future native disclosure is
explicitly approved, it must be the only ledger tab stop and use native
`<details>/<summary>` behavior, but this specification does not require one.

Do not move focus when checking starts, succeeds, or fails. Preserve the global
3px `--primary` focus outline and `--focus-ring` on the linked card and provider
actions; do not use `outline-none` on interactive elements.

### 11.3 Announcements

- `checking`: polite status and `aria-busy="true"` on the section.
- success after checking: one polite `Quiet-stay evidence updated.`
  announcement; do not announce every item separately.
- failure after checking: one polite failure announcement.
- server-rendered default/no-evidence and populated states need no live region.
- conflict is ordinary content, not `role="alert"`.

At minimum, screen-reader output must expose the ledger heading, evidence class,
primary statement, source, scope or distance method, freshness/window, and
uncertainty caveat in that order.

## 12. Loading, empty, error, and adjacent states

- **Page loading:** retain existing route/Suspense behavior; do not add a ledger
  skeleton until a real evidence request exists.
- **Evidence loading:** §7.3 only; separate from hotel and price loading.
- **Evidence empty:** §7.2; means sources responded without valid evidence, not
  “quiet,” “no noise,” or “no quiet rooms.”
- **Evidence error:** §7.4/§7.9; separate from inventory, Deal Score, provider
  link, and request state.
- **Hotel empty/error:** no ledger because no inspectable hotel exists.
- **Expired deal:** evidence may remain informational, but the existing expired
  recovery remains primary and no stale evidence is promoted as current.
- **Provider link unavailable:** evidence may remain visible, but do not add a
  request/contact action.
- **Malformed handoff:** preserve `InvalidHotelState`; no ledger, request block,
  or evidence analytics.

## 13. Measurement contract

### 13.1 Production prerequisite

`lib/analytics.ts` currently logs only in development. Before any outcome
measurement, DEV must route events through a same-origin, consent-aware
first-party collector to a dedicated Neon `ux_events` dataset with documented
retention/deletion. Product and Legal must approve that policy and QA must
verify delivery.

Until then, every production metric in this section is **not available**, never
0%. Analytics failure must never alter rendering, focus, comparison, or
handoff.

Never collect hotel name/id, room number/type label, coordinates, full or raw
URLs, review text, source copy, request/free text, medical/accessibility detail,
or property messages. Use a random per-view identifier and fixed enums only.

### 13.2 Fixed property enums

```ts
type QuietSurface = 'result_detail' | 'handoff'
type OverallState =
  | 'checking'
  | 'evidence_available'
  | 'no_evidence_returned'
  | 'check_failed'
type ClassState =
  | 'ready'
  | 'not_returned'
  | 'insufficient_location'
  | 'stale'
  | 'conflicting'
  | 'error'
type LocationPrecision = 'exact' | 'coordinates' | 'area' | 'search_area' | 'missing'
type PositionBucket = '1_3' | '4_10' | '11_plus'
```

### 13.3 Events

| Event | Exact trigger | Allowed properties |
|---|---|---|
| `hotel_quiet_evidence_viewed` | Populated ledger is at least 50% visible for 1 continuous second, once per detail/handoff view | `surface`, `overallState`, `providerFactState`, `contextState`, `reviewThemeState`, `locationPrecision` |
| `hotel_quiet_evidence_details_opened` | Reserved for a future approved card disclosure; do not emit from navigation to the current detail page | Same six properties plus `resultPositionBucket` |
| `hotel_quiet_conflict_viewed` | Conflict copy is at least 50% visible for 1 continuous second, once per view | `surface`, `conflictClasses` fixed enum pair |
| `hotel_request_guidance_viewed` | Reuse the existing Special requests 50%/one-second exposure contract | `source`, `partnerHost`, `capabilityState`, `eligibleRequestCount` |
| `hotel_request_help_opened` | Reuse the existing native help open trigger | `source`, `partnerHost`, `capabilityState` |
| `hotel_handoff_continue_clicked` | Existing provider CTA activates | Existing properties plus `quietEvidenceSeen`, `quietOverallState`; never `requestSent` |

Do not emit `hotel_quiet_request_selected`. Do not treat provider navigation as
request selection, transmission, acknowledgement, or guarantee. For the launch
fallback, `hotel_quiet_evidence_viewed` is not eligible because no populated
evidence exists.

Exposure observers must cancel timers when visibility falls below 50%, clean up
on unmount, and deduplicate per view. Evidence state changes start a new
eligibility check only if populated evidence becomes visible; they do not emit
on data arrival alone.

### 13.4 Metrics

1. **Evidence inspection rate:** unique populated result-detail views with
   `hotel_quiet_evidence_viewed` / unique eligible populated result-detail
   views. Segment only by fixed state enums.
2. **Qualified handoff:** unique handoff continues with
   `quietEvidenceSeen=true` / unique handoff views where evidence was available.
   This is decision context, not a conversion KPI; rejecting a poor fit may be
   a correct outcome.
3. **Request-guidance use:** unique `hotel_request_help_opened` / unique
   `hotel_request_guidance_viewed`. No request-selection or success rate exists
   in the current capability.
4. **Overclaim failures:** measure through the moderated comprehension protocol,
   not inferred from clicks. Fixed support tags may be `assumed_quiet`,
   `assumed_request_sent`, or `assumed_guaranteed`; never parse support free text.
5. **Decision confidence:** optional post-task research rating only, followed by
   factual comprehension questions. Do not interrupt production handoff with a
   survey.

## 14. Validation protocol and release gate

Test the exact hierarchy and copy at 375px and 1280px with 8–12 first-time hotel
travelers, including at least four people who self-identify as light sleepers or
have previously requested a quieter room. Do not collect reasons, diagnoses, or
medical/accessibility details.

Fixtures:

1. property soundproofing only;
2. airport proximity only;
3. licensed negative guest-noise theme only;
4. property soundproofing plus a conflicting guest theme;
5. no evidence plus guidance-only quiet-room request handoff;
6. insufficient property location;
7. stale nearby context;
8. evidence check failure while provider action remains usable.

Ask after each relevant task:

- `What does expaify know about this property's rooms?`
- `What does the nearby item tell you—and what does it not tell you?`
- `Whose opinion is the review theme?`
- `Did expaify send a quiet-room request?`
- `Is a quiet room guaranteed?`
- `What would you verify next?`

Release requires:

- at least 90% correctly identify every evidence class and source;
- at least 90% interpret missing/stale/failed evidence as unknown, not positive
  or negative;
- zero participants say proximity predicts the specific room;
- zero participants say expaify transmitted a request;
- zero participants infer a current-capability guarantee;
- at least 85% can choose the next source to verify without confusion;
- no horizontal overflow or clipped content at 375px or 1280px;
- all provider actions remain keyboard operable during checking/failure.

Any zero-tolerance failure requires hierarchy/copy revision and retest before
populated evidence can ship.

## 15. UI implementation boundary

### Fallback-first UI work allowed now

- Add the neutral ledger shell and no-evidence fallback to
  `app/deals/[dealId]/page.tsx` at the placement in §3.2.
- Add component-level fixtures/tests for checking, failure, insufficient
  location, stale, conflict, partial errors, and populated classes without
  connecting unlicensed or fabricated production data.
- Confirm `DealCard` renders no all-unknown quiet element.
- Preserve the existing Special requests block unchanged.

### Blocked pending provider/data work

- Populating any production provider fact, nearby-context item, or guest theme.
- Adding the scan-tier evidence line.
- Carrying evidence into `BookingHotelContext` and handoff.
- Production analytics transport and outcome reporting.

Those items need a licensed replacement provider, normalized Result-based data
contract, freshness policy, display rights, and DEV work. UI must not hardcode
sample evidence into production, infer it from current deal data, or call a
vendor from a component.

### Expected later file owners, not authorization in this ticket

- `lib/types.ts` — normalized quiet evidence contract.
- `lib/providers/*` — licensed provider/geospatial/review adapters returning
  `Result<T>` and attaching affiliate markers to handoff links.
- deal/detail data loader or API — joins evidence to the mounted deal path.
- `app/components/ui/DealCard.tsx` — positive-evidence-only scan line.
- `app/deals/[dealId]/page.tsx` — ledger rendering.
- `lib/booking/config.ts` and `app/book/BookingFlow.tsx` — populated evidence
  continuity only, without changing Special requests truth states.
- `lib/analytics.ts` plus an approved same-origin endpoint — measurement sink.

Money and provider boundaries remain unchanged: all prices are integer-minor-
unit `Money`, all external calls go through `lib/providers`, adapters return
`Result<T>`, secrets remain environment-only, and outbound links retain
affiliate markers.

## 16. Acceptance criteria for UI and QA

1. The implementation targets the mounted `/deals` → `/deals/[dealId]` path,
   not tests-only `HotelCard`.
2. Current all-unknown evidence adds nothing to `DealCard` and exactly one
   honest fallback on detail.
3. Populated fixtures render Provider facts, Nearby context, and Guest review
   theme as separate labeled groups in fixed order with source metadata.
4. No score, verdict, filter, rank, risk color, or Deal Score integration exists.
5. Property/room/request/selected-stay facts use the exact scope and certainty
   copy in §6.3.
6. Context renders only with exact/coordinate location, attributable source,
   method, and freshness; insufficient and stale states suppress the distance.
7. Review themes are licensed, attributed, hedged, and use their own
   sample/window; no raw review text is shown.
8. Conflicting evidence remains side by side and no source is selected as true.
9. Checking/failure is independent of hotel inventory, price, Deal Score, and
   handoff; provider actions remain usable.
10. No request control or false selected/transmitted/acknowledged/guaranteed
    state is introduced; existing Special requests guidance remains the owner.
11. Only populated evidence persists to handoff, above Special requests; no
    second unknown block appears there.
12. At 375px and 1280px, content wraps without overlap, clipping, or horizontal
    scroll, and no decision-critical copy is truncated.
13. Semantic headings, lists, reading order, polite state announcements, and
    global focus treatment meet §11.
14. Analytics contains only fixed enums, obeys visibility triggers, and never
    emits sensitive data or infers a request.
15. Production metrics remain reported as not available until the approved sink
    is implemented and verified.

## 17. Blockers and out-of-scope findings

### Blockers

1. **Dead provider:** Hotellook's API and landing pages are closed; its adapter
   and affiliate handoff require provider-stage repair before populated evidence
   or reliable provider handoff can launch.
2. **No licensed evidence:** no current contract supplies soundproofing facts,
   contextual proximity, or licensed guest noise themes.
3. **No normalized continuity:** the live deal model, deal-detail loader, and
   `BookingHotelContext` carry no quiet evidence.
4. **No production analytics sink:** measurement requires Product/Legal
   approval, DEV implementation, retention/deletion policy, and QA verification.

### Out of scope

- Selecting or contracting a hotel, geospatial, or review provider.
- Repairing Hotellook, affiliate routing, or upstream deal freshness.
- Scraping reviews, maps, POIs, construction notices, or provider pages.
- Acoustic measurement, flight-path/traffic modeling, or a quietness score.
- Quiet/noise filters, ranking, recommendations, or Deal Score changes.
- Free-text requests, property messaging, room assignment, order creation, or
  request guarantees.
- Editing the dormant `HotelCard` as the sole production delivery.

## 18. Handoff

UI work may implement the fallback-first shell and state fixtures on the mounted
deal-detail path, while leaving populated production evidence disabled. Provider,
data, continuity, and analytics work remain separately blocked and must not be
simulated in UI.
