# UX Design: Hotel Access Requirement Clarity

Ticket: `UXDES-HOTEL-ACCESS-REQUIREMENTS-01`  
Stage: UX Design  
Priority: P1  
Date: 2026-07-22

## Inputs and decision

- Research: `docs/pipeline/hotel-access-requirements/02-research.md` (missing from this worktree, read verbatim from the integrated UXR commit `183dbfd`)
- Discovery: `docs/pipeline/hotel-access-requirements/01-discovery.md` (present, despite the UXR brief's historical missing-file flag)
- Reused foundation: `docs/pipeline/hotel-amenity-provenance/02-research.md`
- Current UI: `app/components/HotelCard.tsx`, especially `QualityEvidencePanel`
- Live-surface check: `app/deals/DealFeed.tsx`

The design makes certainty, not feature presence, legible. It lets a traveler distinguish a provider-confirmed property fact from a documented negative, missing documentation, unclear evidence, and a room preference that can be requested but is not guaranteed.

This spec does not add filters, change Deal Score, model disability-specific stay-fit features, or solve the existing live-surface integration gap.

## 1. Shared evidence contract

### 1.1 Reuse; do not fork

Access facts must be items in the shared hotel-amenity-provenance evidence collection. Do not create an `AccessFact`, `AccessibilityFeature`, or other parallel evidence type. Use the existing base fields unchanged:

```ts
type HotelEvidenceStatus =
  | 'confirmed'
  | 'unavailable'
  | 'not_returned'
  | 'unknown'

type HotelEvidenceScope =
  | 'property'
  | 'room'
  | 'rate'
  | 'selected_stay'

type HotelEvidenceFee = 'included' | 'paid' | 'unknown'

type HotelEvidenceCertainty = 'guaranteed' | 'requestable'

interface HotelAmenityEvidence {
  id: string
  label: string
  status: HotelEvidenceStatus
  scope: HotelEvidenceScope
  sourceLabel: string
  fee?: HotelEvidenceFee
  fetchedAt?: string
  confidence?: HotelAmenityConfidence

  // The only field added by this ticket:
  certainty?: HotelEvidenceCertainty
}
```

`HotelAmenityConfidence` above means the existing shared amenity-provenance confidence alias; this ticket neither defines new confidence values nor changes that alias.

`certainty` is meaningful only when `status === 'confirmed'`. Adapters must omit it for `unavailable`, `not_returned`, and `unknown`; the UI must ignore it if malformed data includes it. Do not add a fifth status such as `requestable`.

Attaching the already-defined shared evidence collection to `HotelOffer` is required data-layer integration, not permission to add another access-specific evidence field. Components receive normalized facts; they never parse vendor strings.

### 1.2 Canonical MVP facts and order

Render facts in this fixed order:

1. `elevator` — label `Elevator`; `property` scope.
2. `on_site_parking` — label `On-site parking`; `property` scope; `fee` may be present.
3. `step_free_route` — label `Step-free route, entrance to room`; `property` scope describing a complete path.
4. `room_pref_ground_floor` — label `Ground-floor room`; `room` or `selected_stay` scope.
5. `room_pref_high_floor` — label `High-floor room`; `room` or `selected_stay` scope.
6. `room_pref_near_elevator` — label `Room near the elevator`; `room` or `selected_stay` scope.
7. `room_pref_connecting` — label `Connecting rooms`; `room` or `selected_stay` scope.

No roll-in showers, grab bars, doorway widths, Braille, visual alarms, or service-animal claims belong in this list. Those remain owned by `accessibility-stay-fit`.

### 1.3 Normalization rules

- `confirmed` means the provider affirmatively documents the fact. It does not mean expaify inferred it from stars, property type, photos, floor count, distance, or a missing negative.
- `unavailable` means the provider affirmatively documents absence or inability. It is the only state that uses `--warning`.
- `not_returned` means the provider supplied no usable evidence. It is neutral and never becomes `unavailable`.
- `unknown` means returned evidence is ambiguous, contradictory, malformed, or scope-incompatible. It is neutral and directs confirmation.
- A normalized, confirmed room preference defaults to `certainty: 'requestable'`. It may be `guaranteed` only when the selected room/rate explicitly binds that assignment.
- Confirmed fixed property facts use `guaranteed`. Limited, first-come, or reservation-required parking uses `requestable` for the space even though the property has parking.
- A confirmed fact missing a valid certainty must not be promoted by the component. The adapter applies the category rules above; unresolved data becomes `unknown`.
- `sourceLabel` is required for `confirmed` and `unavailable`. Missing attribution downgrades the item to `unknown`. Use `Hotel provider` only as a visible fallback for `not_returned`, loading, or error—not as fabricated attribution.

### 1.4 Step-free chain semantics

`step_free_route` is one aggregate claim over all links:

`entrance/lobby → vertical transport or step-free path → guest-floor corridor → room door`

- Every link documented step-free: `confirmed` + `guaranteed`.
- Any link documented with a step/barrier: `unavailable`.
- No evidence for one or more links: `not_returned`.
- Partial, contradictory, or unclear evidence for a link: `unknown`.

The UI consumes only this normalized aggregate. It must never derive route continuity from `elevator`, and the shared evidence object must not be extended with chain-link fields in this ticket.

## 2. Information hierarchy and placement

### 2.1 Collapsed card

The current hierarchy remains:

1. Primary: nightly price and `Review hotel` action.
2. Secondary: hotel name, Deal Score, and location.
3. Tertiary: quality evidence and one optional access attribute.
4. Disclosure control: `Details`.

Add at most one access chip beneath the existing quality chips and before Location. It appears only for a `confirmed` + `guaranteed` `property` fact with a valid source. Selection priority is `elevator`, then `on_site_parking`. Never show step-free route, room requests, requestable parking, unavailable, not-returned, unknown, loading, or error content collapsed.

Final chip text is exactly `Elevator` or `On-site parking`. Do not add a check icon. The chip aria-label is respectively:

- `Elevator. {provider} confirms this property has an elevator.`
- `On-site parking. {provider} confirms this property has on-site parking. Review parking fees and space availability in details.`

Chip classes:

```txt
mt-1.5 inline-flex max-w-full items-center rounded-[var(--radius-control)]
border border-[color:var(--border)] bg-[color:var(--bg-surface)]
px-2 py-1 text-xs font-medium leading-4 text-[color:var(--text-2)]
```

At 375px the chip stays in the center column, wraps only as a whole element, and never changes the photo, price, score, CTA, or three-column grid widths. If it cannot fit, its short label truncates; it never overlaps.

### 2.2 Expanded panel

Add one section titled `Access & room requests` after the existing Location section and before Price scope / Provider handoff. This order keeps access evidence before the external handoff in DOM and reading order.

Panel shell, intentionally matching `QualityEvidencePanel`:

```txt
rounded-[var(--radius-card)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] px-3.5 py-3
text-xs leading-5 text-[color:var(--text-2)]
```

Heading: `font-bold text-[color:var(--text-1)]`.

Ready-state list:

```txt
mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6
```

Each fact uses a `<div>` containing a `<dt>` with `font-bold text-[color:var(--text-1)]` and a `<dd>` with `mt-0.5 font-medium text-[color:var(--text-2)]`. Metadata follows in a block with `mt-1 text-[color:var(--text-3)]`. Long source names and sentences use `break-words`.

An unavailable row alone adds:

```txt
rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2
```

and its state sentence uses `text-[color:var(--warning)]`. No other state uses `--warning` or `--warning-soft`.

## 3. Final copy system

### 3.1 Source, scope, freshness, and fee metadata

Every rendered, non-aggregate fact ends with source attribution:

- `Source: {sourceLabel}.`
- If `fetchedAt` is valid, append ` Updated {MMM D, YYYY}.`
- If freshness is absent, do not add a freshness sentence.

Add scope only where it prevents over-reading:

- Confirmed property fact: `Property-level fact; confirm your specific room and rate before payment.`
- Room request: the non-guarantee sentence below is the scope disclosure; do not duplicate it.
- Guaranteed selected-stay room fact: `Confirmed for this selected stay.`

Parking fee copy is separate from parking presence:

- `included`: `Parking fee: included.`
- `paid`: `Parking fee: additional charge applies.`
- `unknown` or missing: `Parking fee: not documented.`

Never use `Free parking` unless the normalized fee is `included`; even then, the required text is `Parking fee: included.`

### 3.2 Confirmed + guaranteed

| Fact | Visible state sentence | Aria-label |
|---|---|---|
| Elevator | `Provider confirms this property has an elevator.` | `Elevator. Guaranteed property attribute. {provider} confirms this property has an elevator.` |
| On-site parking | `Provider confirms this property has on-site parking.` Then render the fee sentence from §3.1. | `On-site parking. Guaranteed property attribute. {provider} confirms on-site parking. {parking fee sentence}` |
| Step-free route | `Provider confirms a step-free route from the entrance to the room.` | `Step-free route from entrance to room. Guaranteed property attribute. {provider} confirms every documented link in the route is step-free.` |
| Ground-floor room | `The provider guarantees a ground-floor room for this selected stay.` | `Ground-floor room. Guaranteed for this selected stay by {provider}.` |
| High-floor room | `The provider guarantees a high-floor room for this selected stay.` | `High-floor room. Guaranteed for this selected stay by {provider}.` |
| Room near elevator | `The provider guarantees a room near the elevator for this selected stay.` | `Room near the elevator. Guaranteed for this selected stay by {provider}.` |
| Connecting rooms | `The provider guarantees connecting rooms for this selected stay.` | `Connecting rooms. Guaranteed for this selected stay by {provider}.` |

The selected-stay strings are permitted only with `scope: 'selected_stay'`. A `room`-scoped provider fact without a booking binding remains requestable.

### 3.3 Confirmed + requestable

Every visible sentence and aria-label includes the exact clause `Request only — not guaranteed until the provider confirms.` Do not shorten it, hide it in a tooltip, or replace it with `subject to availability` alone.

| Fact | Visible copy before required clause | Aria-label before required clause |
|---|---|---|
| On-site parking | `You can request an on-site parking space.` | `On-site parking space can be requested.` |
| Ground-floor room | `You can request a ground-floor room.` | `Ground-floor room can be requested.` |
| High-floor room | `You can request a high-floor room.` | `High-floor room can be requested.` |
| Room near elevator | `You can request a room near the elevator.` | `Room near the elevator can be requested.` |
| Connecting rooms | `You can request connecting rooms.` | `Connecting rooms can be requested.` |

For parking, follow the required clause with the fee sentence. Elevator and step-free route must not normalize as requestable; if received in that combination, render `unknown` instead.

Requestable rows are text-first and neutral. Do not use a check mark, success background, `Available`, `Included`, or `Confirmed room`.

### 3.4 Unavailable

These are documented negatives and use the unavailable styling from §2.2:

- Elevator: `The provider states this property has no elevator.`
- On-site parking: `The provider states this property has no on-site parking.`
- Step-free route: `The provider documents a step or barrier on the route from the entrance to the room.`
- Ground-floor room: `The provider states a ground-floor room cannot be requested for this stay.`
- High-floor room: `The provider states a high-floor room cannot be requested for this stay.`
- Room near elevator: `The provider states a room near the elevator cannot be requested for this stay.`
- Connecting rooms: `The provider states connecting rooms cannot be requested for this stay.`

The aria-label is `{label}. Unavailable. {visible sentence} Source: {sourceLabel}.` Do not render certainty.

### 3.5 Not returned

When some facts are known and one or more are `not_returned`, do not render repeated negative-looking rows. After the known rows, add one full-width neutral line:

`Other access and room-request details were not documented by this provider. Confirm them directly before booking.`

Its aria-label is the same sentence. Use:

```txt
sm:col-span-2 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]
px-3 py-2 font-medium text-[color:var(--text-3)]
```

When every MVP fact is `not_returned`, use the default empty state in §4.1 instead.

### 3.6 Unknown

Render each unknown fact neutrally:

`{label}: the provider's information is unclear. Confirm directly before booking.`

Aria-label: `{label}. Information unclear. Confirm directly with the provider before booking.`

If every returned fact is `unknown`, consolidate to: `Access and room-request information from this provider is unclear. Confirm details directly before booking.` Do not use warning color.

## 4. Complete state specification

### 4.1 Default / all data not returned

This is the MVP default. The collapsed card shows no access chip. The expanded panel always exists and shows only:

`Access details not documented by this provider. Confirm elevator, parking, step-free access, and room requests directly with the provider before booking.`

The panel uses the neutral shell and a paragraph with `mt-2 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2 font-medium text-[color:var(--text-3)]`. The section aria-label is `Access and room requests. Access details not documented by this provider. Confirm directly before booking.` No per-feature negatives or empty icons appear.

### 4.2 Loading

Title remains visible. Render `Checking access details…` in a `role="status" aria-live="polite"` paragraph with `mt-2 font-medium text-[color:var(--text-3)]`. Decorative skeleton bars may follow with `aria-hidden="true"`, but the string is mandatory. Loading access evidence does not hide hotel price, inventory, Deal Score, or provider action.

On background refresh, preserve already rendered evidence and append `Refreshing access details…`; do not replace known facts with skeletons.

### 4.3 Ready with evidence

Render all confirmed, unavailable, and unknown MVP facts in canonical order, followed by at most one consolidated not-returned line. Do not render vendor facts outside the canonical set in this panel. A single confirmed fact never implies the others.

### 4.4 Access-evidence error

This state is independent of hotel inventory. The card remains usable and the panel says:

`Access details could not be checked. Confirm elevator, parking, step-free access, and room requests directly with the provider before booking.`

If an access-only retry callback exists, show a button labeled `Try access details again`. Activating it changes the button text to `Checking access details…`, disables it, and invokes only the access-evidence retry. It must not navigate, activate `Review hotel`, or clear the hotel result. If the current architecture has no access-only retry, omit the button rather than wiring it to a misleading full-search action.

Error copy uses `bg-[color:var(--bg-muted)]` and `text-[color:var(--text-3)]`, never warning tokens. The message container uses `role="status" aria-live="polite"`. Retry button classes:

```txt
mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)]
border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3
text-sm font-bold text-[color:var(--text-1)]
focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
focus-visible:outline-[var(--border-focus)]
```

### 4.5 Malformed and edge states

- Duplicate canonical ids: keep the safest normalized item; precedence is `unavailable`, `unknown`, `not_returned`, then `confirmed` unless the adapter resolves the conflict before rendering.
- `confirmed` with an invalid scope/certainty pair: render `unknown`; never guess in the component.
- `unavailable`, `not_returned`, or `unknown` with certainty: ignore certainty.
- Parking with missing/invalid fee: show `Parking fee: not documented.`
- Invalid `fetchedAt`: omit freshness; never show `Invalid Date`.
- Missing facts are normalized to `not_returned`, not silently omitted from the aggregate default calculation.
- Unknown source on a positive or negative claim: downgrade to `unknown`.
- Extremely long provider names wrap with `break-words`; they never truncate the evidence source.
- Access status never changes Deal Score, price rank, sorting, or booking availability.

## 5. Interaction and accessibility

- The existing `Details` button remains the only disclosure control. Tap, click, Space, or Enter toggles the existing details region and its label between `Details` and `Hide details`; retain `aria-expanded` and `aria-controls`.
- Opening details does not move focus. The access panel is a semantic `<section aria-labelledby="hotel-access-title-{id}">` with a unique heading id and a `<dl>` for facts.
- DOM/reading order is: Review hotel action → Details toggle → Deal Score → Quality evidence → Location → Access & room requests → Price scope → Provider handoff. The access panel therefore precedes provider-handoff copy.
- Static fact rows are not given `tabIndex`; keyboard users do not tab through noninteractive prose. The optional retry button is the only new tab stop.
- Requestable aria-labels must include `Request only — not guaranteed until the provider confirms.` exactly, even though the same clause is visible. Do not rely on color, icons, title attributes, or visual proximity to convey certainty.
- Loading and error changes announce politely once. Do not use assertive alerts for missing access evidence.
- Text/background combinations use existing tokens. Unavailable is communicated with the word `Unavailable` in the accessible name and documented-negative copy, not color alone.
- Preserve browser zoom to 200%, text wrapping, and a minimum 44px retry target (`min-h-11`).

## 6. Responsive behavior

### Mobile — 375px

- Keep the current card `p-3`, three-column header, photo size, price column, CTA, score, and Details control unchanged.
- The optional collapsed chip lives only in the flexible center column and uses one short label.
- Expanded content is one column with `space-y-3`; the access `<dl>` is one column.
- Evidence sentences, source names, and metadata wrap; no fixed heights, horizontal scrolling, clipped non-guarantee clauses, or side-by-side room-request rows.
- The unavailable background wraps with its row content and does not bleed beyond the panel.

### Desktop — 1280px

- Keep the card's existing max width/layout. Do not turn access into a side rail or compete with price.
- The evidence list becomes two columns at the existing `sm` breakpoint using `sm:grid-cols-2 sm:gap-x-6`.
- Aggregate default, not-returned, unknown, loading, and error messages span both columns.

## 7. Implementation boundary and downstream work

### UI stage

- Add the conservative collapsed chip and expanded panel to `HotelCard` only.
- Implement all visual and semantic states using normalized evidence; preserve existing props/exports unless the shared evidence contract requires an additive prop.
- Add component tests for selection priority, all-not-returned default, mixed evidence, every state, requestable visible/aria copy, warning-token exclusivity, disclosure semantics, and 375px-safe classes.
- Do not add filter controls or alter `DealFeed` as part of this ticket.

### DEV stage required

The present code cannot deliver these facts. A subsequent DEV ticket must add the shared evidence collection to `HotelOffer`; normalize live and cached provider data in `lib/providers`; validate cached evidence; preserve the four statuses, scope, source, optional metadata, and certainty through `/api/search`; model access-evidence loading/error separately from inventory; and test provider/cache/route behavior. Until a provider documents facts, adapters must emit or the UI must derive the collection's default `not_returned` presentation without fabricating positives.

Every provider call remains in `lib/providers`, adapters return `Result<T>`, money remains integer minor units, secrets remain in env, and hotel deeplinks retain affiliate markers.

### Known integration gap

`HotelCard` is currently mounted only in tests; the live hotel deal surface in `app/deals/DealFeed.tsx` renders its own `DealCard`. This spec does not authorize mounting or redesigning that live surface. The UI handoff must report the gap, and a separately scoped integration ticket is required before real users can see this panel.

## 8. Acceptance checklist

- Shared amenity-provenance evidence is extended with exactly one field: `certainty`.
- No fifth status and no disability-specific stay-fit features are introduced.
- All-not-returned is the default, neutral, one-line expanded state with no collapsed chip.
- Confirmed, unavailable, not-returned, unknown, loading, and error states use the exact copy above.
- Every requestable visible string and aria-label includes the explicit non-guarantee clause.
- Only unavailable uses `--warning` / `--warning-soft`.
- Step-free confirmed means the complete entrance-to-room chain is documented.
- Parking presence and parking fee remain separate; no unsupported `free` claim appears.
- The collapsed card shows no more than one confirmed-guaranteed property attribute.
- The expanded panel precedes provider handoff in DOM and reading order.
- The layout is usable at 375px and 1280px, at 200% zoom, and by keyboard/screen reader.
- Filter UI remains out of scope and is referred to `hotel-amenity-fit`.
- UI and DEV handoffs both retain the live-surface integration warning.

## Handoff

Create `UI-HOTEL-ACCESS-REQUIREMENTS-01` to implement this specification in `HotelCard`, all required visual/accessibility states, and component tests. The UI ticket must not alter filters, Deal Score, provider logic, or the live `DealFeed` card. It must flag the required DEV normalization/search-stream work and the separate live-surface integration gap.
