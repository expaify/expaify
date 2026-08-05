# UXDES-HOTEL-ADJOINING-ROOMS-01: Connecting-Room Confidence — Design Spec

Date: 2026-08-05
Stage: UX Design (UXDES)
Persona: Senior UX Designer / Interaction Designer
Ticket: UXDES-HOTEL-ADJOINING-ROOMS-01 (P1)
Upstream: `docs/pipeline/hotel-adjoining-rooms/02-research.md` (D1–D5)

This spec is implementation-ready. It defines two new components, their full
prop contracts, every visible string, every Tailwind class pattern against
`app/globals.css` tokens, interaction and keyboard rules, and edge cases. UI
stage implements exactly this; DEV stage wires exactly the data contract in
research §4.

---

## 0. Naming note (resolved conflict, binding on UI/DEV)

`app/components/ui/QuietStayEvidenceLedger.tsx` already defines a
`GuestNoisePattern['pattern']` enum value literally named `'adjoining_rooms'`
(`QuietStayEvidenceLedger.tsx:53,115`) — but it means **noise bleed-through
from a neighboring room**, an unrelated concept this ticket must not collide
with. To keep the two unambiguous in code and in copy:

- **Component/type names use "Adjacency," never "Adjoining."**
  `HotelRoomAdjacencyEvidence`, `HotelRoomAdjacencyCapability`,
  `HotelRoomAdjacencyEvidenceLedger`, `HotelRoomAdjacencyConfidence` (as
  research §4/§6 already named them).
- **User-facing copy says "connecting rooms," never "adjoining rooms."** Every
  string below uses "connecting." The ticket ID's "ADJOINING-ROOMS" is a
  pipeline slug only and must not leak into shipped copy.

---

## 1. Component contracts

Two conventions coexist in this codebase for evidence-driven components:
`HotelRoomViewConfidence` takes a component-local discriminated-union
**Presentation** prop and owns no derivation logic itself; rate eligibility
and admission policy instead keep their Presentation type in `lib/types.ts`
and compute it via a `derive*Presentation()` function in `lib/hotels/*.ts`
(`deriveRateEligibilityPresentation`, `lib/hotels/rateEligibility.ts:104`).
This spec follows the **rate-eligibility convention**, because — unlike room
view — this ticket has two independent mount points (detail ledger, handoff)
that must render the *same* resolved state from the *same* evidence object
without duplicating the state-resolution/degrade logic (mismatch → `unknown`,
missing `roomLabel` → `unknown`, etc. — see §6) in two component files.

```ts
// lib/types.ts — DEV stage adds (research §4)
export type HotelRoomAdjacencyState = 'guaranteed' | 'request_only' | 'unavailable' | 'unknown' | 'provider_error'
export interface HotelRoomAdjacencyEvidence { /* per research §4 */ }
export interface HotelRoomAdjacencyCapability { /* per research §4 */ }
```

```ts
// lib/hotels/roomAdjacency.ts — DEV stage adds
import type { HotelRoomAdjacencyEvidence, HotelRoomAdjacencyState } from '../types'

export type HotelRoomAdjacencyPresentation =
  | { state: 'loading' }
  | { state: 'unknown' }
  | { state: 'provider_error' }
  | { state: 'unavailable'; supplierLabel: string; fetchedAt?: string }
  | { state: 'request_only'; supplierLabel: string; fetchedAt?: string }
  | { state: 'guaranteed'; supplierLabel: string; roomLabel: string; fetchedAt?: string }

export function deriveRoomAdjacencyPresentation(params: {
  offerId: string
  supplier: string
  evidence?: HotelRoomAdjacencyEvidence
  loading?: boolean
}): HotelRoomAdjacencyPresentation {
  // loading → { state: 'loading' }
  // no evidence, or evidence.offerId !== offerId, or evidence.supplier !== supplier → { state: 'unknown' }  (edge case 1, §6)
  // evidence.state === 'guaranteed' with no roomLabel → { state: 'unknown' }  (edge case 2, §6)
  // otherwise → the matching variant, carrying supplierLabel = providerDisplayName(evidence.supplier)
}
```

This is the **single source of truth** for state resolution — both mount
points call `deriveRoomAdjacencyPresentation()` with the same `evidence`
object and render off its return value. Neither component re-implements the
mismatch/degrade rules.

### 1.1 `HotelRoomAdjacencyEvidenceLedger` (detail page)

```tsx
// app/components/ui/HotelRoomAdjacencyEvidenceLedger.tsx
import type { HotelRoomAdjacencyPresentation } from '@/lib/hotels/roomAdjacency'

export type HotelRoomAdjacencyLedgerProps = {
  presentation?: HotelRoomAdjacencyPresentation
}
```

`presentation` defaults to `{ state: 'unknown' }` when absent, matching
`HotelRoomViewConfidence`'s `presentation = { state: 'not_confirmed' }`
default (`HotelRoomViewConfidence.tsx:79`) — a defense-in-depth default, not
the primary code path (the primary path always calls
`deriveRoomAdjacencyPresentation()` first, per §1's split).

**UI-stage buildability (staging note — see §9 for the authoritative
sequencing):** the `import type { HotelRoomAdjacencyPresentation } from
'@/lib/hotels/roomAdjacency'` line above is the **DEV-final** state, once
`lib/hotels/roomAdjacency.ts` exists. UI stage runs first and that file does
not exist yet, so UI stage instead **declares
`HotelRoomAdjacencyPresentation` inline in each component file** (identical
union shape, identical name), exactly matching
`HotelRoomViewConfidence.tsx:1-10`'s own self-contained-type convention. This
lets UI stage typecheck and ship both components with zero dependency on
`HotelOffer`, `hotellook.ts`, or `lib/hotels/roomAdjacency.ts`. DEV stage then
creates `lib/hotels/roomAdjacency.ts` with the canonical copy of the type and
the `deriveRoomAdjacencyPresentation()` function, and swaps each component's
local type declaration for the import shown above — a type-only edit to
UI's files, not a behavior change (§9 explains why this narrow edit stays
inside DEV's mandate).

### 1.2 `HotelRoomAdjacencyConfidence` (handoff)

```tsx
// app/components/HotelRoomAdjacencyConfidence.tsx
import type { HotelRoomAdjacencyPresentation } from '@/lib/hotels/roomAdjacency'

export type HotelRoomAdjacencyConfidenceProps = {
  presentation?: HotelRoomAdjacencyPresentation
}
```

Same default-to-`unknown` rule and same buildability note as §1.1. Mounted at
`BookingFlow.tsx:1191`, immediately after `<HotelRoomViewConfidence />`
(`:1190`), receiving the output of
`deriveRoomAdjacencyPresentation({ offerId: hotelContext.offerId, supplier:
hotelContext.provider, evidence: hotelContext.roomAdjacency })` — a real,
computed prop, per research D1's explicit test-gate against repeating
`HotelRoomViewConfidence`'s inert-mount bug (§1 verification table finding).

---

## 2. Copy — final, per state

No placeholders. Every string below is what ships. `{roomLabel}` and
`{supplierLabel}` are interpolated from evidence; `supplierLabel` uses the
existing `providerDisplayName()` helper already imported in `BookingFlow.tsx`
(e.g. `:1232`) for consistent capitalization with the rest of the page.

| State | Heading | Body | Metadata line (small, `--text-3`) |
|---|---|---|---|
| `guaranteed` | **Connecting rooms available** | Provider lists **"{roomLabel}"** as a bookable connecting-room option for this stay. | Room and rate information from {supplierLabel} · Checked {fetchedAt, formatted `MMM D, YYYY`, omitted if absent} |
| `request_only` | **Connecting rooms: request only** | {supplierLabel} does not commit to a connecting-room assignment when you book. The property decides — typically at check-in — based on availability. Until it confirms, treat this as a preference, not a booked change. | Request capability from {supplierLabel}{· Checked date if present} |
| `unavailable` | **Connecting rooms not offered** | {supplierLabel} states this property does not offer connecting or adjacent rooms. | Property information from {supplierLabel}{· Checked date if present} |
| `unknown` | **Connecting-room availability not confirmed** | expaify has no evidence about connecting rooms at this property. If keeping your group together in adjoining rooms matters for this trip, ask the property directly before you book. | *(no metadata line — there is no source to cite)* |
| `provider_error` | **Connecting-room details could not be checked** | Connecting-room details could not be checked right now. Ask the property directly before you book. | *(no metadata line)* |
| `loading` | *(skeleton, no visible heading text)* | — | — |

**Screen-reader string** (one `sr-only` node per non-loading state, mirroring
`HotelSearchCriteriaSummary`'s `sr-only` pattern at
`HotelSearchCriteria.tsx:66`): heading + body concatenated as one sentence,
e.g. for `request_only`: *"Connecting rooms: request only. \[supplier\] does
not commit to a connecting-room assignment when you book. The property
decides — typically at check-in — based on availability. Until it confirms,
treat this as a preference, not a booked change."* This is redundant with the
visible text by design (both are plain text, no icon-only or color-only
content exists in this component), satisfying discovery constraint 1's "must
survive being read aloud with no styling" requirement without needing a
separate abbreviated announcement.

**Loading `role="status"` text:** `"Checking connecting-room availability."`
— mirrors `HotelRoomViewConfidence.tsx:99`'s exact phrasing pattern.

**Section caveat line** (ledger only, appears once above all states, matching
`QuietStayEvidenceLedger`'s `SCOPE_CAVEAT` pattern at `:104,424,472`):
*"This is separate from how many guests each room fits and what beds it has."*
— this is the literal enforcement of research constraint (discovery §4.3):
never implying an occupancy or bed-configuration guarantee, and it
disambiguates from `hotel-room-occupancy`/`hotel-bed-configuration` inline,
at the one place a reader could conflate the three.

---

## 3. Detail-page ledger — states, Tailwind, both breakpoints

Mounted inside `data-hotel-decision-section="hotel_fit"`
(`app/deals/[dealId]/page.tsx:425`), after
`HotelSustainabilityCredentialEvidence` (`:445`) — last in that section, since
it is the newest and most narrowly-applicable fact in the group, consistent
with the existing ordering of broad-property facts (pool, disruption, quiet
stay) before narrow ones (sustainability).

```tsx
<section
  aria-labelledby="hotel-room-adjacency-title"
  aria-busy={evidence?.state === undefined ? undefined : undefined /* loading has no live async path yet — see §3.4 */}
  className="mt-5 min-w-0 border-t border-[color:var(--border)] pt-5"
>
  <h3 id="hotel-room-adjacency-title" className="text-h3 text-[color:var(--text-1)]">Connecting rooms</h3>
  <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">This is separate from how many guests each room fits and what beds it has.</p>
  {/* state body below */}
</section>
```

This wrapper reuses `QuietStayEvidenceLedger`'s section shell exactly
(`border-t border-[color:var(--border)] pt-5`, `text-h3` heading token) so
the "Hotel fit" section reads as one visual rhythm, not a patchwork of
component styles.

### 3.1 `guaranteed`

```tsx
<div className="mt-4 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3">
  <p className="text-sm font-medium leading-6 text-[color:var(--success)]">Connecting rooms available</p>
  <p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-2)]">
    Provider lists <bdi>“{roomLabel}”</bdi> as a bookable connecting-room option for this stay.
  </p>
  <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">{metadataLine}</p>
</div>
```

`--success` is used **only** on this heading, in this state — the single
color cue reserved by discovery constraint 1, matching how
`HotelRoomViewConfidence.tsx:23` reserves `--success` for its own
`guaranteed` heading only.

### 3.2 `request_only`

Same shell, heading in `--text-1` (never `--success`):

```tsx
<p className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Connecting rooms: request only</p>
<p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-2)]">
  {supplierLabel} does not commit to a connecting-room assignment when you book. The property decides — typically at check-in — based on availability. Until it confirms, treat this as a preference, not a booked change.
</p>
<p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">{metadataLine}</p>
```

### 3.3 `unavailable`

```tsx
<p className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Connecting rooms not offered</p>
<p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-2)]">
  {supplierLabel} states this property does not offer connecting or adjacent rooms.
</p>
<p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">{metadataLine}</p>
```

### 3.4 `unknown`

No metadata line (there is no source to cite — showing a blank or "—"
metadata row would imply data that doesn't exist):

```tsx
<p className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Connecting-room availability not confirmed</p>
<p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-2)]">
  expaify has no evidence about connecting rooms at this property. If keeping your group together in adjoining rooms matters for this trip, ask the property directly before you book.
</p>
```

This is the **default rendering for every property today** (research §4 —
`hotellook.ts` declares zero capability flags). It must look complete and
intentional, not like a missing-data error — no muted/greyed treatment
beyond the standard `--text-1`/`--text-2` pair already used for every other
"not provided" evidence state in this codebase (e.g. `HotelAdmissionRow`'s
`no_rule_reported`, `HotelRateFamilyEvidence`'s `not_provided`).

### 3.5 `provider_error`

```tsx
<p className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Connecting-room details could not be checked</p>
<p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-2)]">
  Connecting-room details could not be checked right now. Ask the property directly before you book.
</p>
```

### 3.6 Loading

`hotellook.ts` resolves synchronously today, so this state has no live
trigger at ship time — spec it anyway per research §7, so a future async
adapter (or the still-hypothetical live provider from
`hotel-room-inventory-confidence`) doesn't require a follow-up design pass:

```tsx
<div aria-hidden="true" className="mt-4 space-y-2">
  <div className="h-4 w-48 max-w-full rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] motion-safe:animate-pulse" />
  <div className="h-4 w-full rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] motion-safe:animate-pulse" />
</div>
<span className="sr-only" role="status">Checking connecting-room availability.</span>
```

Set `aria-busy={true}` on the outer `<section>` while loading, matching
`HotelRoomViewConfidence.tsx:91,93-100` exactly.

### 3.7 Breakpoints

The block is single-column text at every width — no grid, no side-by-side
layout — so 375px and 1280px differ only in the ambient page width, not in
this component's own layout. `break-words` on every body/metadata `<p>`
(already applied above) is the only responsiveness requirement, matching
`HotelRoomViewConfidence`'s own `max-w-3xl break-words` convention
(`:24,36`) — this component omits `max-w-3xl` because the "Hotel fit" section
container is already narrower than 3xl at desktop, so the extra constraint
is redundant here (verify against the section's actual rendered width in UI
stage; add `max-w-3xl` if the section container is ever widened).

---

## 4. Handoff confidence block — states, Tailwind

Mounted at `BookingFlow.tsx:1191`, directly under `HotelRoomViewConfidence`,
inside the same `border-[color:var(--border-strong)]` panel
(`:1172`). Reuses `HotelRoomViewConfidence`'s own `blockClassName` constant
verbatim (`HotelRoomViewConfidence.tsx:17`:
`mt-5 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4`)
so the two blocks read as a matched pair, not two different components glued
together — this is the "separately labeled statement" requirement from
discovery constraint 3, achieved by **shared container style + distinct
heading + distinct `aria-labelledby`**, not by visual differentiation.

```tsx
<section aria-labelledby="hotel-room-adjacency-handoff-title" aria-busy={loading || undefined} className={blockClassName}>
  <h3 id="hotel-room-adjacency-handoff-title" className="text-sm font-medium leading-5 text-[color:var(--text-1)]">Connecting rooms</h3>
  {/* same five state bodies as §3, using the same copy table in §2 */}
</section>
```

Body markup per state is identical to §3.1–3.6, minus the `--border-t
pt-5` section wrapper (the ledger's wrapper) and the `mt-4` inner spacing
(replaced by the block's own `mt-1`/`mt-2` rhythm, matching
`HotelRoomViewConfidence`'s internal spacing exactly, e.g. `:22-27`). No new
copy is invented for this mount point — same table, same strings, per
discovery constraint 3 ("adjacency is a separate labeled statement," not a
separately-worded one).

---

## 5. Interaction rules

- **No tap/click target in any state.** Every state in §2 is inert text —
  matching `HotelRoomViewConfidence`, which likewise has no interactive
  element for any of its eight states. There is nothing to request, toggle,
  or select on expaify's own surface for this attribute (research §3.1–3.2:
  the only real interaction — booking the connecting room or submitting a
  request — happens at the provider, off-site).
- **No expand/collapse `<details>`.** Unlike the Special Requests block's
  "How requests work" disclosure (`BookingFlow.tsx:1300-1310`), this
  component's full explanation is short enough to show inline in every state
  (§2's body strings are all one to two sentences) — adding a collapsed
  disclosure here would hide the one sentence that carries the trust-critical
  distinction (discovery §1), which is the opposite of what discovery
  constraint 1 requires. UI stage must not add a `<details>` wrapper.
- **Keyboard:** no focusable element is introduced by either component, so
  no new tab stop, no new `aria-expanded`, and no change to either
  page's existing focus order. This is intentionally the simplest possible
  interaction contract, appropriate for a text-only trust disclosure.
- **On error (`provider_error`):** no retry control. Unlike
  `HotelDocumentReadinessDisclosure`'s `retryAvailable`/`onRetry` pattern
  (`BookingFlow.tsx:1272-1274`), there is no live adapter call this
  component itself triggers — `hotellook.ts` resolves the evidence
  synchronously as part of the existing offer fetch, so "retry" has no
  distinct action to bind to at this ticket's scope. If `DEV` later wires a
  genuinely async adjacency check, that is a new ticket, not a silent
  addition to this one (research §5, §6 — scope stays bounded).

---

## 6. Edge cases

1. **`offerId`/`supplier` mismatch (research §4's degrade rule).** If
   `evidence.offerId !== hotelContext.offerId` or `evidence.supplier !==
   hotelContext.provider` (`hotelContext.provider`/`offerId` are the existing
   fields read elsewhere in `BookingFlow.tsx`, e.g. `:1229-1230`), the
   component must render `unknown`, never pass the mismatched evidence
   through. This check belongs in the data layer (DEV stage,
   `lib/hotels/roomAdjacency.ts` or equivalent normalizer), not in the
   component — the component trusts whatever `HotelRoomAdjacencyEvidence` it
   is handed, exactly like `HotelRoomViewConfidence` trusts its
   `presentation` prop. Document this ownership split explicitly so DEV does
   not assume the component does its own validation.
2. **`guaranteed`/`request_only` with no `roomLabel`.** Per the type in
   research §4, `roomLabel` is only guaranteed present as a matter of intent,
   not of the type system (it's optional). If an adapter returns `state:
   'guaranteed'` with no `roomLabel`, the component falls back to state
   `unknown` rather than rendering `"Provider lists "" for..."` — a malformed
   evidence object degrades exactly like an offerId mismatch. Same rule for
   `request_only`'s `decidesAt` — its absence does not degrade the state
   (the body copy above already handles it via the fixed phrase "typically
   at check-in," which does not require the field), but `roomLabel`'s
   absence does, since the sentence structurally requires it.
3. **Empty state vs. `unknown`.** There is no separate "empty" state in this
   spec distinct from `unknown` — discovery constraint 2 and research §4
   establish `unknown` *is* the empty state, deliberately worded as a
   first-class non-embarrassing fact rather than a blank space. UI stage
   must not add a conditional that hides the block entirely when evidence is
   absent; per §3.4, `unknown` renders with full-weight visible copy, always.
4. **Mock/fixture deals.** `app/api/deals/route.ts:98`'s `isMock: true` rows
   (flagged as a caveat in the sibling `hotel-guest-count-clarity` brief)
   carry no acquisition provenance at all. These must resolve to `unknown`
   the same as every live row does today (since `hotellook.ts` never
   populates the field regardless), so no special-casing is needed — this is
   already the default, not an exception to carve out.
5. **`hotel-room-inventory-confidence` overlap.** That sibling ticket (docs
   at `docs/pipeline/hotel-room-inventory-confidence/`, already at
   `03-design.md`) owns *whether any room is available at all* — a strictly
   upstream question. If that ticket's future work adds a "no rooms
   available" state to the offer as a whole, this component's states are
   unaffected: connecting-room confidence is scoped to *if* rooms are booked,
   *are they connected*, and stays silent on availability itself (discovery
   scope boundary, §0 of discovery).

---

## 7. Analytics wiring

Per research D5, fire `hotel_room_adjacency_evidence_viewed` once per
`(dealId, surface)` pair, mirroring the dedupe-by-ref pattern in
`HotelSearchCriteriaSummary` (`HotelSearchCriteria.tsx:29,33-46` — a
`viewedRef` keyed string, fired in a `useEffect`, not on every render):

```tsx
const viewedRef = useRef<string | null>(null)
useEffect(() => {
  const key = `${surface}:${dealId}:${resolvedState}`
  if (viewedRef.current === key) return
  viewedRef.current = key
  track('hotel_room_adjacency_evidence_viewed', {
    deal_id: dealId,
    hotel_id: hotelId,
    state: resolvedState,
    surface, // 'detail' | 'handoff'
  })
}, [dealId, hotelId, resolvedState, surface])
```

`resolvedState` is the five-value `HotelRoomAdjacencyState`, plus a
`'loading'` string variant if the event fires before resolution completes —
DEV stage should confirm whether to fire on `loading` at all (most sibling
events in this codebase, e.g. `hotel_criteria_summary_viewed`, only fire once
data is ready) or wait for a terminal state; **wait for a terminal state**,
consistent with `hotel_criteria_summary_viewed` firing on the resolved
`criteria`, not on a loading placeholder.

---

## 8. Accessibility summary (cross-reference, not new rules)

All rules above already satisfy discovery constraint 1. Restated as a
checklist for TEST stage:

- [ ] `guaranteed` heading is the only place `--success` (or any class token
      containing `success`) appears in either component.
- [ ] No state's text content matches `/\b(confirmed|guaranteed|secured|reserved)\b/i`
      except `guaranteed`'s own heading and body (which legitimately use
      "connecting rooms available" — note "available" itself is fine; the
      banned-word test in research D4 checks for the four listed words, not
      "available").
- [ ] Every state has an `sr-only` string equal to its visible text (§2) —
      no icon-only, no color-only content.
- [ ] `aria-busy` is set during `loading` on both mounts.
- [ ] Neither component introduces a new tab stop.
- [ ] 375px: text wraps (`break-words`) without horizontal overflow inside
      the "Hotel fit" section and inside the handoff's
      `border-[color:var(--border-strong)]` panel.
- [ ] 1280px: block does not stretch to an unreadable line length — inherits
      the section's own `max-w` (detail page) or the handoff panel's fixed
      column width; no `max-w` override needed per §3.7's note.

---

## 9. Handoff

Next stage: **UI-HOTEL-ADJOINING-ROOMS-01** (UI Implementation, Claude
Fable 5), **then DEV-HOTEL-ADJOINING-ROOMS-01** (research §4/D1 already
establishes this needs a real evidence type and adapter wiring, which is
DEV-only territory — this is UI+DEV work, not UI-only).

**UI stage implements, and does not touch `lib/types.ts`,
`lib/providers/hotellook.ts`, `lib/hotels/roomAdjacency.ts`, or
`app/api/analytics/route.ts`:**
- `app/components/ui/HotelRoomAdjacencyEvidenceLedger.tsx` (§1.1, §3), typed
  against a `HotelRoomAdjacencyPresentation` type UI stage declares **locally
  in this component file** (matching `HotelRoomViewConfidence`'s own
  self-contained-type convention, `HotelRoomViewConfidence.tsx:1-10`) so it
  typechecks standalone with no dependency on code that doesn't exist yet.
- `app/components/HotelRoomAdjacencyConfidence.tsx` (§1.2, §4), same
  local-type approach.
- Mounts both at their real locations (§3, §4) with **no props** — exactly
  how `HotelRoomViewConfidence` is mounted today at `BookingFlow.tsx:1190`
  (`<HotelRoomViewConfidence />`) — so both render their safe `unknown`/
  `not_confirmed`-style default. This is a known, temporary, and tracked gap,
  not a silent one: UI stage's commit message must say so explicitly (e.g.
  "UI-HOTEL-ADJOINING-ROOMS-01: add connecting-room confidence components,
  mounted with default presentation pending DEV data wiring").
- Client-side `track()` call (§7), gated so it only fires with the real
  values DEV wires in — UI stage may stub the call site but must not invent
  fake `state` values to satisfy it.

**DEV stage then must, in the same pass (research D1's test-gate — this is
the part that makes the UI-stage default non-silent):**
- Add `HotelRoomAdjacencyState`/`Evidence`/`Capability` to `lib/types.ts` and
  `roomAdjacency`/`roomAdjacencyCapability` to `HotelOffer` (§1, research §4).
- Add `lib/hotels/roomAdjacency.ts` with `HotelRoomAdjacencyPresentation` and
  `deriveRoomAdjacencyPresentation()` (§1) — **move** the presentation type
  out of the two component files UI stage wrote and import it from here
  instead, deleting the component-local copies (this is the one point where
  DEV stage touches the UI component files — a type-only import swap, not a
  behavior change, so it stays inside the DEV persona's "logic" mandate
  rather than crossing into UI's).
- Wire `hotellook.ts` to construct an explicit `{ state: 'unknown', ... }`
  evidence object (edge case 4, §6).
- Replace both bare `<Component />` mounts with real
  `presentation={deriveRoomAdjacencyPresentation(...)}` props.
- Add the `hotel_room_adjacency_evidence_viewed` allow-list entry (§7,
  research D5).
