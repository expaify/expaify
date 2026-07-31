# UX Design — Hotel room-view confidence

**Ticket:** `UXDES-HOTEL-ROOM-VIEW-CONFIDENCE-01`  
**Stage:** UXDES (Design)  
**Priority:** P0  
**Date:** 2026-07-31  
**Inputs:** `docs/pipeline/hotel-room-view-confidence/01-discovery.md`, `docs/pipeline/hotel-room-view-confidence/02-research.md`

## Design outcome

Before leaving expaify, a traveler can tell whether a room view is guaranteed for the same room and live rate, merely requestable, or not confirmed. Supplier room names and property photos remain visible only at their real scope and never become proof of a view.

The current Hotellook contract supports only **View not confirmed**. That fallback is the only populated production state authorized by this ticket. Guaranteed, request-only, and provider-term variants below are implementation-ready fixtures for a future provider-backed contract; they must not be enabled from hotel names, descriptions, location, price, amenities, or images.

This is a trust repair at the hotel review/provider handoff. It does not add a room selector, gallery, request form, provider integration, or results-card badge.

## Surface and hierarchy

### In scope

- `app/book/BookingFlow.tsx`: one static room-view evidence block inside **Check rooms with provider**, after the existing ownership/loyalty disclosures and immediately before the provider CTA.
- Future data continuity through `lib/providers` → `HotelOffer` → `BookingHotelContext`; this dependency is specified for DEV, not inferred by UI.
- Test fixtures for every semantic and asynchronous state.

### Out of scope

- No room-view content on the collapsed or expanded `HotelCard` while results remain property-level.
- No new chip, badge, warning banner, filter, gallery, room picker, price premium, or special-request control.
- No photo changes. Keep the existing visible **Property photo** caption and decorative image alt behavior.
- No view-specific analytics or return-feedback reason. The existing analytics allowlist defect remains a separate instrumentation repair.

### Page hierarchy

1. **Primary:** observed nightly rate, Deal Score, and **Check rooms at {provider}** action.
2. **Secondary:** the room-view certainty status and exact scoped provider term, if safe to show.
3. **Tertiary:** provider room name, source/freshness, and property-photo caveat.

The evidence block qualifies the handoff but must not visually compete with the price or CTA. It is not an alert unless a previously loading check resolves to an error.

## Fixed placement and structure

Inside the existing `hotel-provider-title` section, use this order:

1. **Check rooms with provider** heading.
2. Updated provider explanation.
3. Existing booking-ownership disclosure.
4. Existing loyalty disclosure.
5. Optional **Provider room name** row, only when supplied as a separate verbatim field.
6. **Room view** evidence block.
7. Existing provider CTA and new-tab cue.

Updated provider explanation, replacing the current “provider confirms room details” wording:

> **The provider shows room options, live availability, final total, taxes and fees, cancellation policy, and terms. Choose or confirm your dates there before comparing rooms.**

This avoids implying that every room detail shown by a supplier is a guarantee.

Semantic pattern:

```tsx
<div className="mt-5 space-y-3">
  {/* optional provider room-name row */}
  <section aria-labelledby="hotel-room-view-title" className="...">
    <h3 id="hotel-room-view-title">Room view</h3>
    <p>{certainty status}</p>
    <p>{scoped explanation}</p>
    {/* optional source/freshness */}
  </section>
</div>
{/* existing provider CTA follows */}
```

Use a heading and paragraphs, not a badge-only treatment or a definition list whose label could be separated from the certainty statement at narrow widths.

## Final UI copy and state matrix

Only three certainty outcomes may appear to users: **Guaranteed room view**, **View request only**, and **View not confirmed**. Internal states such as `conflict`, `malformed`, `stale`, or `unsupported` never appear as status labels.

### 1. Current provider / absent evidence / unsupported — production default

- Label: **Room view**
- Status: **View not confirmed**
- Explanation: **View not confirmed for the room you choose. Photos may show the property or other room categories. Confirm the room’s view with the provider before booking.**
- Source/freshness: omit; do not invent “Source: Hotellook” for evidence Hotellook did not return.

This is also the empty state. Missing evidence is not “No view,” “Standard view,” or an error.

### 2. Supplier room name only

Show a separate row immediately above the evidence block:

- Label: **Provider room name**
- Value: the exact `roomNameRaw`, for example **Ocean View King**

Then use the complete production-default **Room view** copy above. Do not bold view-like words within the room name, parse the name, repeat the term in the explanation, or add a positive icon.

### 3. Guaranteed room view — future provider fixture only

Eligibility requires all of the following from one provider response: explicit guarantee semantics, a non-empty structured view term, matching stable `roomId`, matching live `rateId`, searched stay/occupancy applicability, matching source, and usable freshness.

- Label: **Room view**
- Status: **Guaranteed room view**
- Explanation: **Provider lists “{viewLabelRaw}” for this room and rate.**
- Metadata: **Source: {sourceLabel}. Updated {formatted date}.**

Example:

- **Guaranteed room view**
- **Provider lists “Partial ocean view” for this room and rate.**
- **Source: Example Provider. Updated Jul 31, 2026.**

Preserve the complete provider term exactly, including qualifiers such as “partial,” “limited,” “obstructed,” or “side.” Do not translate a qualified term into an unqualified heading. If a property-level photo appears on the same future surface, append: **Property photos do not confirm the selected room’s view.**

### 4. View request only — future provider fixture only

Eligibility requires a structured provider capability that explicitly marks the named view as a request/preference. A room name alone is insufficient.

- Label: **Room view**
- Status: **View request only**
- Explanation: **Provider offers “{viewLabelRaw}” as a request for this stay. Not guaranteed until the property confirms it for this stay.**
- Metadata: **Source: {sourceLabel}. Updated {formatted date}.** when both values are valid; otherwise omit only the unavailable metadata item.

Never use a checkmark or the words “available,” “included,” “reserved,” or “selected.” Continuing does not submit a request.

### 5. Structured room-category term without selected-rate linkage

- Label: **Room view**
- Status: **View not confirmed**
- Explanation: **Provider lists “{viewLabelRaw}” for this room category, but not for this rate. Confirm the room’s view with the provider before booking.**
- Caveat: **Photos may show the property or other room categories.**
- Metadata: **Source: {sourceLabel}. Updated {formatted date}.** when valid.

This term may be shown only because it came from a structured room-category field. Never produce this state from `roomNameRaw`.

### 6. Stale evidence

Any provider evidence outside the provider adapter’s approved freshness window degrades to unconfirmed.

- Label: **Room view**
- Status: **View not confirmed**
- Explanation: **The provider’s room-view details are out of date. Confirm the room’s view with the provider before booking.**
- Caveat: **Photos may show the property or other room categories.**
- Metadata: **Source: {sourceLabel}. Last updated {formatted date}.**

Never show the stale positive/request status beside this fallback.

### 7. Conflict

Use when sources, room IDs, rate IDs, view terms, scopes, or certainty fields disagree.

- Label: **Room view**
- Status: **View not confirmed**
- Explanation: **The provider’s room-view details do not agree. Confirm the room’s view with the provider before booking.**
- Caveat: **Photos may show the property or other room categories.**
- Metadata: show only a valid non-conflicting source label and timestamp; otherwise omit it.

Do not show either conflicting view term and do not choose the more favorable one.

### 8. Malformed or unsafe evidence

Use the complete production-default copy. Do not echo malformed markup, URLs, control characters, overlong values, unknown enum strings, or mismatched source data. This is a safe fallback, not a visible technical error.

### 9. Explicit provider “no view” fact

This is not one of the three certainty labels and must not be inferred from absence. If a future provider explicitly binds a negative structured view fact to the matching selected room/rate:

- Label: **Room view**
- Status: **View not confirmed**
- Explanation: **Provider states this room and rate do not include a specified view. Check the room details with the provider before booking.**
- Metadata: **Source: {sourceLabel}. Updated {formatted date}.**

The conservative certainty label remains unchanged because the product is not introducing a fourth status outcome in this repair.

## Loading and error behavior

The current Hotellook flow is synchronous at this surface and must render the production default immediately; it must not flash a loading state. Loading/error apply only if a later provider contract performs an explicit async evidence check.

### Loading

- Keep the provider CTA enabled. Room-view evidence must never trap the traveler.
- Reserve the final block height to prevent CTA movement.
- Show the real label **Room view** and two neutral skeleton lines; do not temporarily show any certainty label.
- The section has `aria-busy="true"`. A visually hidden polite status says **Checking room-view details.**
- Skeletons are `aria-hidden="true"` and use no shimmer that ignores reduced-motion preferences.
- If data resolves, replace in place. Announce once: **Room-view details updated. {certainty status}.**

### Async error

- Label: **Room view**
- Status: **View not confirmed**
- Explanation: **Room-view details could not be checked. Confirm the room’s view with the provider before booking.**
- Caveat: **Photos may show the property or other room categories.**
- No automatic retry and no dedicated retry button in this repair.
- If the error occurs after loading, announce the explanation once with `role="status"`. On initial render, use ordinary static text with no live role.
- Do not color the entire block as a destructive error; the provider CTA remains usable.

## Interaction rules

- The evidence block is static and has no tap, hover, disclosure, tooltip, or keyboard target.
- Enter/Space behavior for existing disclosures remains unchanged.
- Tab order remains ownership disclosure → loyalty disclosure → provider CTA. Static room-name/view text is encountered in DOM reading order but adds no tab stop.
- Activating the CTA still opens the affiliate-marked provider URL in a new tab. It does not mark the view as selected, send a request, or change certainty.
- Returning from the provider does not alter the view status and does not imply a mismatch, selection, booking, or stay.
- Do not move focus when async evidence resolves. If the CTA has focus, it retains focus.

## Responsive layout

### Mobile — 375px

- Keep the existing provider panel `p-4` and single-column flow.
- Evidence block is full width and stacks label, status, explanation, caveat, and metadata in that order.
- No value may be truncated or clamped. Use `min-w-0`, `break-words`, and natural wrapping. Preserve provider qualifiers in full.
- Use `mt-5`; internal spacing is `space-y-1` with `mt-2` before metadata/caveat where specified.
- Provider room name uses its own neutral block and wraps anywhere only as a last resort (`overflow-wrap:anywhere` behavior via `break-words`).
- CTA remains full width with a minimum 44px target. Evidence must not create horizontal scroll at 320–375px or 200% zoom.

### Desktop — 1280px

- Keep the provider panel’s existing `sm:p-6` and vertical flow. Do not create a side-by-side card that separates certainty from its explanation.
- The optional room-name row and evidence block may each use a two-column definition layout only from `sm`, with label width `minmax(9rem,auto)` and content `minmax(0,1fr)`. DOM order remains label then content.
- Cap prose width at `max-w-3xl`; do not stretch the explanation across the page.
- The CTA remains below the evidence block, not beside it.

## Visual specification and Tailwind patterns

Use existing tokens only. Do not add colors, icons, font sizes, shadows, or radius tokens.

### Default/unconfirmed/request block

```tsx
className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4"
```

- Label: `text-sm font-medium leading-5 text-[color:var(--text-1)]`
- Status: `mt-1 text-sm font-medium leading-6 text-[color:var(--text-1)]`
- Explanation: `mt-1 text-sm leading-6 text-[color:var(--text-2)]`
- Caveat: `mt-2 text-xs leading-5 text-[color:var(--text-3)]`
- Metadata: `mt-2 break-words text-xs leading-5 text-[color:var(--text-3)]`

Request-only remains neutral. Do not use `--warning-soft`; the status is a certainty boundary, not a failure.

### Guaranteed block

Use the same container. The status alone may use `text-[color:var(--success)]`; no filled green treatment and no check icon:

```tsx
className="mt-1 text-sm font-medium leading-6 text-[color:var(--success)]"
```

Color is supplementary; the words **Guaranteed room view** carry the meaning.

### Conflict, stale, and async error

Use the default container and text colors. If emphasis is needed, the status alone may use `text-[color:var(--warning)]`; never use `--error` as text. Do not add a warning icon because it could overstate an ordinary evidence limitation.

### Loading

```tsx
<div className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4" aria-busy="true">
  <h3 className="text-sm font-medium leading-5 text-[color:var(--text-1)]">Room view</h3>
  <div aria-hidden="true" className="mt-2 space-y-2">
    <div className="skeleton h-4 w-40 max-w-full rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]" />
    <div className="skeleton h-4 w-full rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]" />
  </div>
  <span className="sr-only" role="status">Checking room-view details.</span>
</div>
```

Honor the app’s existing reduced-motion behavior for `.skeleton`; if it does not disable animation under `prefers-reduced-motion`, the UI implementation must use a static fill for this block.

### Provider room name

```tsx
className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3.5 py-3 sm:px-4"
```

- Label: `text-xs font-medium leading-5 text-[color:var(--text-3)]`
- Value: `mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]`

Do not visually merge the room name with the green guaranteed status.

## Accessibility contract

- The visible heading **Room view** is the accessible section name. Do not replace it with an icon or `aria-label` containing stronger language.
- Keep visible copy and screen-reader meaning equivalent. Do not hide the caveat from sighted users or expose extra guarantee language only to assistive technology.
- Static states receive no `role="alert"` or `role="status"`; only post-load transitions use a polite status announcement.
- Source and exact term follow the status in DOM order.
- Curly quotation marks visually delimit verbatim provider terms. Screen-reader text may use the same visible string; do not prepend “verified.”
- Status must remain understandable without color. Contrast must use existing token guarantees.
- Any later room-name or provider term must be rendered as text, never injected HTML.
- At 200% zoom, all content reflows without clipping, overlap, horizontal scroll, or loss of qualifiers.

## Evidence and continuity contract for DEV

The UI must consume a normalized evidence object; it must not calculate certainty. The following shape is the minimum design dependency, not an instruction to call a provider from a component:

```ts
type HotelRoomViewScope = 'property' | 'room_category' | 'selected_rate' | 'request'
type HotelRoomViewStatus = 'guaranteed' | 'request_only' | 'not_confirmed' | 'conflict'

interface HotelRoomViewEvidence {
  roomId?: string
  rateId?: string
  roomNameRaw?: string
  viewLabelRaw?: string
  viewScope: HotelRoomViewScope
  viewStatus: HotelRoomViewStatus
  sourceLabel?: string
  fetchedAt?: string
  evidenceRevision: string
  photoAssociation?: {
    roomId: string
    category?: string
  }
}
```

- `HotelOffer.roomViewEvidence?: HotelRoomViewEvidence` and `BookingHotelContext.roomViewEvidence?: HotelRoomViewEvidence` must preserve the same normalized fields and identifiers.
- Missing evidence maps to the production default. Missing is never upgraded or rendered as “no view.”
- A populated object originates only in `lib/providers`, whose call returns `Result<T>` and never throws to callers.
- Adapters, not React components, validate matching room/rate/source/stay scope, freshness, conflicts, unsafe strings, and exact qualifier preservation.
- A guaranteed status is invalid without a matching room ID, rate ID, non-empty exact view term, explicit guarantee semantics, valid source, and freshness. Invalid data degrades before reaching presentation.
- A property or room-category scope can never produce a guaranteed state for the selected rate.
- `roomNameRaw` and `viewLabelRaw` remain separate. No keyword matching, image analysis, or cross-field synthesis is permitted.
- `photoAssociation` is informational and cannot raise certainty. The existing property photo is excluded.
- Booking-context serialization must not drop or re-derive the evidence. If continuity validation fails, render the default unconfirmed state.
- All provider URLs retain affiliate markers; room-view evidence never modifies the deeplink.

Until DEV adds this contract for a qualified provider, UI may implement only a presentational component with fixtures plus the absent-evidence production fallback. It must not hardcode Hotellook as a source of positive evidence.

## Edge-case rules

- Empty string, whitespace-only term, unknown enum, impossible date, mismatched source, missing revision, or oversized unsafe text: default unconfirmed copy; do not echo the value.
- Multiple valid qualified terms for the same selected rate: preserve each exact term in provider order joined with commas only if the provider models them as simultaneous facts. Never collapse “city view” plus “partial ocean view” to “city and ocean view.” If simultaneity is unclear, use conflict.
- Same room with a different rate: unconfirmed unless the guarantee explicitly applies across those rate IDs.
- Same rate with a different room ID: unconfirmed.
- Searched dates or occupancy change: old evidence is invalid immediately; show loading only while an approved refresh runs, otherwise default unconfirmed.
- Property confirmation received after booking: outside the pre-booking contract. Do not simulate it from a request status.
- Missing provider name: omit the source line; do not show “Source: .” or promote the status.
- Very long provider name/term: wrap; never truncate, marquee, tooltip, or shrink below the design-system type scale.
- RTL/localization: keep provider wording verbatim and allow natural bidi isolation in implementation; do not reorder qualifiers.
- JavaScript failure or evidence endpoint unavailable: the server/initial fallback remains **View not confirmed** and the provider link stays usable.

## Acceptance fixtures

| Fixture | Provider room name | Structured evidence | Expected status | Required visible evidence |
|---|---|---|---|---|
| Current Hotellook/property photo shows ocean | none | none | View not confirmed | Full default explanation and photo caveat |
| Supplier-name only | Ocean View King | none | View not confirmed | Separate provider room name; no extracted term |
| Guaranteed full | King Room | Ocean view, matching selected room/rate, guaranteed | Guaranteed room view | Exact term, room-and-rate scope, source, freshness |
| Guaranteed qualified | King Room | Partial ocean view, matching selected room/rate, guaranteed | Guaranteed room view | “Partial” preserved everywhere |
| Request | King Room | Ocean view request capability | View request only | Exact term and non-guarantee sentence |
| Category only | Partial ocean view room | Structured partial ocean view on category, no rate link | View not confirmed | Category scope stated; no guarantee |
| Property-photo only | none | none | View not confirmed | Same status regardless of image content |
| Stale | King Room | expired selected-rate guarantee | View not confirmed | Stale explanation and timestamp |
| Conflict | King Room | room/rate/source disagreement | View not confirmed | No conflicting terms shown |
| Malformed | unsafe/empty | invalid object | View not confirmed | Generic safe fallback |
| Async loading | optional | check pending | no certainty yet | Label, skeletons, polite checking status |
| Async error | optional | check failed | View not confirmed | Could-not-check explanation; CTA enabled |

## QA and release criteria

### Functional

- Current hotel booking review always shows the default evidence block immediately before the provider CTA.
- No HotelCard view badge or inferred term is added.
- Changing only the property photo leaves every room-view string and state unchanged.
- Changing to a non-matching `rateId` or `roomId` degrades a fixture to unconfirmed.
- CTA target, affiliate attributes, analytics, new-tab cue, and focus behavior do not regress.

### Responsive and accessibility

- At 375px, 1280px, 320px, and 200% zoom, the status, complete qualified term, explanation, source, and CTA remain readable without overlap or horizontal scrolling.
- Keyboard order is unchanged and no new focus stop exists.
- A screen reader encounters room name (when present), **Room view**, status, explanation, caveat, source, then CTA.
- Loading and post-load resolution announce once; static fallback does not repeatedly announce.
- Guaranteed, request-only, and unconfirmed remain distinguishable without color.

### Comprehension guardrail

Before enabling future populated provider states, test the five research fixtures with 10–12 recent hotel bookers at 375px first and 1280px second:

- at least 90% correct classification overall;
- zero false-guarantee readings for property-photo-only;
- at least 80% unaided and 90% after explanation for **Ocean View King** with no structured evidence;
- 100% visible preservation of qualifiers;
- no material mobile task-time increase versus the generic handoff baseline.

Any request-only or unconfirmed state interpreted as guaranteed blocks release of populated states. The production unsupported fallback may ship as the immediate trust repair after standard UI QA.

## Implementation split and blockers

### UI stage — shippable now

- Add the static evidence block to hotel booking review with the production-default copy.
- Update the provider explanation copy.
- Build the presentation states as isolated fixtures/tests if this can be done without changing provider or booking contracts.
- Do not expose future positive/request states to production data.

### DEV dependency — future provider-backed states

- Add and validate the normalized evidence type through provider adapters, `HotelOffer`, serialization, and `BookingHotelContext`.
- Supply an explicit async state only if the provider integration truly performs a separate check.
- Keep all external calls in `lib/providers` and all adapter returns in `Result<T>`.

### Known blockers and out-of-scope findings

- Hotellook has no room/rate/view evidence; guaranteed and request-only production states are blocked.
- Copy comprehension has not yet been validated with travelers.
- expaify cannot observe provider-side selection, booking, property confirmation, or post-stay outcome.
- `hotel_handoff_return_reason_selected` is currently absent from the analytics allowlist. This ticket does not repair or extend that instrumentation.

## Handoff decision

Create `UI-HOTEL-ROOM-VIEW-CONFIDENCE-01` for the shippable review-surface repair and fixture-level presentation. If the UI implementation determines that even the fallback requires a contract change, it must stop and create `DEV-HOTEL-ROOM-VIEW-CONFIDENCE-01`; it must not infer evidence locally.
