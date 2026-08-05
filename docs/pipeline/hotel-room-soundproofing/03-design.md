# UXDES-HOTEL-ROOM-SOUNDPROOFING-01: Two-axis quiet-stay evidence design

Date: 2026-08-05
Stage: UX Design
Priority: P2
Upstream: `docs/pipeline/hotel-room-soundproofing/02-research.md`

## 1. Decision and scope

This is a **surgical repair spec**, not a redesign. It implements exactly
Directives D1–D5 from `02-research.md`, inside the existing
`QuietStayEvidenceLedger.tsx` component and its two consumers (`DealCard.tsx`,
`app/deals/[dealId]/page.tsx`), with no new data source, no new provider call,
and no change to the hardcoded `NO_QUIET_STAY_EVIDENCE` mount point. The
production-visible output at today's zero-coverage state stays effectively
unchanged (same fallback copy, same section, same position); what changes is
(a) two rendering/type defects that already exist as latent bugs reachable by
valid fixture data, and (b) the addition of axis structure so a future
populated state cannot repeat the discovery report's reported failure.

**In scope:**
1. Split the single `getStrongestQuietEvidenceClass` ordinal ladder into an
   insulation-only resolver that feeds the `DealCard` cue (fixes the reported
   `"Quiet-stay evidence available · Nearby context"` overclaim).
2. Stop `SelectedStayItem`'s `room_type` branch from rendering hardcoded
   soundproofing copy for a fact whose `normalizedId` is not a documented
   insulation id (fixes the fabrication defect).
3. Add two labeled axis groupings inside the expanded ledger — **Room sound
   insulation** and **Noise in the surroundings** — around the existing four
   evidence groups, with no change to which groups exist, their internal
   states, or their reading order.
4. Add an internal (non-exported, matching the existing `patternLabels`
   convention) pattern→axis classification so the guest-pattern taxonomy is
   encoded, not flattened — with **no new rendering path**, per research
   Directive D3's explicit instruction not to build ahead of a licensed data
   source.

**Explicitly not in scope (per research Directives D5 and Blockers):**
- Any Booking.com facilities/details provider call.
- Any `deals` table schema change or `dealDetection.ts` change.
- Any populated guest-pattern rendering (no licensed source exists).
- Any change to `NO_QUIET_STAY_EVIDENCE`, its mount point, or the section
  ordering inside `app/deals/[dealId]/page.tsx`.
- Any change to the `requestable` / `transmitted` / `acknowledged` quieter-room
  request-capability copy — that remains owned by `special-requests` and is
  untouched here.

### Production target (unchanged from `hotel-noise-fit/03-design.md`)

- **Scan tier:** `DealCard` (`app/components/ui/DealCard.tsx`), mounted by
  `app/page.tsx` and `app/deals/DealFeed.tsx`.
- **Expanded tier / ledger owner:** `app/deals/[dealId]/page.tsx`, section
  `data-hotel-decision-section="hotel_fit"`, position 3, ahead of provider
  handoff (position 4). This placement was already corrected by a prior
  pipeline and is not revisited here.
- **Handoff:** `QuietStayEvidenceHandoff`, still exported, still mounted
  nowhere in production (unchanged — restoring its mount is out of scope,
  matching the settled finding in `hotel-noise-fit`).

## 2. Hierarchy

Within the expanded ledger, in reading order:

1. **Primary:** the two axis headings (`Room sound insulation`, `Noise in the
   surroundings`) — these are what a first-time reader must notice exist as
   two different questions.
2. **Secondary:** the populated evidence items and their per-class fallback
   lines within each axis (unchanged copy, unchanged validators).
3. **Tertiary:** guest-reported patterns (kept in its current position,
   between the insulation axis and the exposure axis — see §4) and freshness/
   source metadata lines.

On `DealCard`, the one optional cue line remains tertiary — below hotel name/
class/city, above price — and now can only ever describe the insulation axis
(§5). It is never shown for exposure-only evidence, consistent with the
already-settled rule in `hotel-noise-fit/02-research.md` Directive D2 that
nearby context is details-only and must not appear in the scan tier.

## 3. Exact copy — every visible string

No placeholder text; every string below is final.

### 3.1 New: axis introduction sentence (evidence-available state only)

Rendered once, immediately before the first axis heading, only when
`overallState === 'evidence_available'`:

> The sections below separate what is known about a room's own sound
> insulation from what is known about noise in the surroundings. Neither
> predicts the other.

This is additive to the existing `SCOPE_CAVEAT` — `SCOPE_CAVEAT`'s text
(`"These details do not predict whether a specific room will be quiet."`) is
**unchanged**, still renders first (in both the fallback and evidence-available
paths, exactly as today), because it remains true and is pinned by an existing
test. The new sentence adds the axis framing that `SCOPE_CAVEAT` alone does
not provide, per the discovery report's finding that the caveat "never tells
the reader that two of these groups answer a different question."

### 3.2 New: axis headings (h4, evidence-available state only)

- `Room sound insulation`
- `Noise in the surroundings`

### 3.3 Changed: `SelectedStayItem`, `room_type` scope, non-insulation fact

New branch, used only when `fact.scope === 'room_type'` and
`fact.normalizedId !== 'soundproofing_room'`:

> Claim: `Provider lists {attributeLabel.trim()} for {roomTypeLabel.trim()}. Confirm this room type is selected before payment.`
> Metadata: unchanged — `{roomTypeLabel.trim()} · Room information from {sourceLabel.trim()} · Updated {date}`

This replaces the current unconditional soundproofing claim for this branch.
It is truthful for any bounded room-type attribute (blackout curtains, floor,
aspect, etc.) instead of inventing a soundproofing claim the provider never
made.

### 3.4 Unchanged: `SelectedStayItem`, `room_type` scope, insulation fact

Used only when `fact.scope === 'room_type'` and
`fact.normalizedId === 'soundproofing_room'` — the exact copy that exists
today, byte-for-byte:

> Claim: `Provider lists soundproofing for {roomTypeLabel.trim()}. Confirm this room type is selected before payment.`
> Metadata: `{roomTypeLabel.trim()} · Room information from {sourceLabel.trim()} · Updated {date}`

### 3.5 Unchanged strings

Every other string in `QuietStayEvidenceLedger.tsx` — `SCOPE_CAVEAT`, all
`classMessage` copy, `PropertyFactItem`, `GuestPatternItem`,
`NearbyContextEntry`, all `certainty` branches in `SelectedStayItem`
(`requestable` / `transmitted` / `acknowledged` / the generic `selected_stay`
echo), `ledgerStatus`'s three overall-state strings, and the conflict line —
are unchanged. Reusing proven, already-tested copy is intentional: this ticket
fixes two specific defects, not the whole component's voice.

### 3.6 Changed: `DealCard` / `getQuietEvidenceResultCue` semantics

The rendered string format is **unchanged**:
`Quiet-stay evidence available · {classLabel}`. What changes is which
evidence can produce it — see §5. No new copy string is introduced here; the
existing string becomes honest because it can no longer be triggered by
exposure-only evidence.

## 4. Expanded ledger structure (evidence-available state)

```
h3  Quiet-stay evidence
p   SCOPE_CAVEAT (unchanged)
[conflict line, if hasConflict — unchanged]
p   axis introduction sentence (§3.1)                 [NEW]

h4  Room sound insulation                              [NEW wrapper]
  h5-equivalent (existing h4 token, unchanged): "Selected room or stay"
    ...unchanged item list / class message
  h5-equivalent (existing h4 token, unchanged): "Property facts"
    ...unchanged item list / class message
[/Room sound insulation]

h4 (existing, unchanged token): "Guest-reported patterns"
  ...unchanged item list / class message
  (stays exactly where it is today — between the property group and the
  nearby-context group — see rationale below)

h4  Noise in the surroundings                          [NEW wrapper]
  h5-equivalent (existing h4 token, unchanged): "Nearby context"
    ...unchanged item list / class message
[/Noise in the surroundings]
```

**Rationale for keeping "Guest-reported patterns" outside both axis
wrappers:** its nine patterns already split cleanly by axis (research finding
4), but no licensed provider populates any of them today, and building a
populated, axis-bucketed rendering path for data that cannot exist yet is
exactly the invented behavior Directive D3 and the project's own guardrail
forbid ("stop and report the mismatch instead of inventing behavior" —
AGENTS.md). The classification is captured in code (§6) so a future ticket
with a real licensed source can bucket items into the two axis wrappers
without re-deriving the taxonomy. Splitting the *heading* into two duplicated
empty subsections today, for a class that is always `not_returned` in
production, would add visual noise with zero information value and was
rejected.

This structure is a pure insertion of two wrapping headings (plus one new
sentence) around content whose internal order, states, and copy are otherwise
byte-for-byte unchanged. The existing DOM reading-order guarantee — selected
stay, room type, property, guest pattern, nearby context, in that order — is
preserved exactly.

## 5. Interaction / logic rules

### 5.1 Two independent evidence-strength resolvers

Add a new exported function, alongside the existing (unchanged, still
exported, still used internally for the ledger's own "any valid evidence at
all" check) `getStrongestQuietEvidenceClass`:

```
export function getInsulationEvidenceClass(evidence?: QuietStayEvidence): 'selected_stay' | 'room_type' | 'property' | 'none'
```

Rules, in precedence order:
1. `selected_stay` — a valid `selectedStayFacts` item with `scope ===
   'selected_stay'` **and** `normalizedId === 'soundproofing_room'`.
2. `room_type` — a valid `selectedStayFacts` item with `scope === 'room_type'`
   **and** `normalizedId === 'soundproofing_room'`.
3. `property` — any valid `propertyFacts` item (property facts are, by
   construction, always insulation-axis; the type currently has only one
   literal `normalizedId`).
4. `none` — otherwise, including when the only valid evidence is
   `nearbyContext` or `guestPatterns`.

`nearbyContext` and `guestPatterns` **never** contribute to this resolver.
This is the fix for the discovery report's core defect.

### 5.2 `DealCard` cue uses the insulation resolver, not the combined one

`getQuietEvidenceResultCue` is changed to compute its class from
`getInsulationEvidenceClass`, not `getStrongestQuietEvidenceClass`. Its return
value and string format are otherwise unchanged (§3.6). Concretely: a fixture
with only `nearbyContext` populated now returns `null` (today it returns
`"Quiet-stay evidence available · Nearby context"` — this is the exact
overclaim the discovery report and `DealCard`'s `aria-label` construction
were built on). A fixture with a valid `room_type`-scope insulation fact,
mixed with a populated `guestPatterns`/`nearbyContext`, is unaffected and
still returns `"Quiet-stay evidence available · Room type"`.

### 5.3 `getStrongestQuietEvidenceClass` is unchanged and keeps its existing job

It continues to answer "is there any valid evidence in any of the five
classes" for the ledger's own `hasValidItems` / `check_failed`-demotion logic
(`QuietStayEvidenceLedger.tsx:411-414`). That check is legitimately
axis-agnostic — it decides whether to show the fallback state at all, not
which axis to attribute a claim to — so it is out of scope for this fix and is
preserved to avoid a behavior change nobody asked for.

### 5.4 Fabrication fix is a pure copy-branch change, no new field required

`normalizedId === 'soundproofing_room'` is the single new literal check added
to `SelectedStayItem`. No new field is added to `SelectedStayQuietFact` — the
existing `normalizedId: string` field is sufficient; this ticket defines the
one recognized insulation identifier value it must equal to earn confident
soundproofing copy. `SelectedStayQuietFact`'s type shape is unchanged.

### 5.5 Guest-pattern axis classification (inert, non-exported, no render change)

Add a module-private constant, following the exact pattern of the existing
non-exported `patternLabels`:

```
const patternAxis: Record<GuestNoisePattern['pattern'], 'insulation' | 'exposure'> = {
  corridors: 'insulation',
  lifts: 'insulation',
  adjoining_rooms: 'insulation',
  building_systems: 'insulation',
  street_or_traffic: 'exposure',
  nightlife: 'exposure',
  aircraft: 'exposure',
  rail_or_transport: 'exposure',
  property_venues_or_events: 'exposure',
}
```

`property_venues_or_events` is classified `exposure` (on-site but external to
the room's own construction — a venue's noise still has to cross the same
walls a street would), matching the discovery report's own "on-site external"
grouping. Not read by any render path in this ticket; exists so the
taxonomy is encoded once, correctly, ready for the pipeline that eventually
adds licensed theme data instead of being re-derived (or mis-derived) later
under time pressure.

## 6. States — full matrix

All states below are either (a) already implemented and unchanged, or (b)
directly exercised by the two logic changes in §5. No state is new; this
ticket does not add an asynchronous, loading, or error state that didn't
already exist.

| State | Surface | Behavior |
|---|---|---|
| Zero coverage (production default, `NO_QUIET_STAY_EVIDENCE`) | Detail page | Unchanged: `SCOPE_CAVEAT` + `"Quiet-stay details were not provided..."`. No axis headings render (fallback path, §3.1 sentence is evidence-available-only). |
| `checking` | Detail page | Unchanged: `role="status"`, `aria-live="polite"`, `aria-busy="true"`, `"Checking quiet-stay evidence…"`. |
| `check_failed` | Detail page | Unchanged copy and ARIA. |
| `evidence_available`, all four classes empty/`not_returned` | Detail page | Axis headings render; each axis shows its existing per-class fallback line(s), unchanged text. |
| `evidence_available`, insulation fact only (property or room-scope soundproofing) | Detail page + `DealCard` | Item renders under **Room sound insulation**; `DealCard` shows the cue (§5.2). |
| `evidence_available`, nearby context only | Detail page + `DealCard` | Item renders under **Noise in the surroundings**; `DealCard` shows **no cue** (§5.2 — this is the fixed behavior). |
| `evidence_available`, non-insulation `room_type` fact (e.g. blackout curtains) | Detail page | Renders the new generic branch (§3.3), never soundproofing language; does not contribute to the insulation resolver. |
| `stale` / `malformed` / `error` / `insufficient_location` / `conflicting`, any class | Detail page | Unchanged per-class messages, unchanged demotion/suppression rules. |
| Mobile 375px | Detail page | Single-column `divide-y` stack, unchanged; the two new `h4` headings are plain block text at the same type scale as the existing `h4` group headings (`text-sm font-medium`), so they wrap normally and add no fixed-width elements. No side-by-side layout is introduced anywhere, satisfying research constraint 4. |
| Desktop 1280px | Detail page | Same single-column stack (the ledger has never used a grid/multi-column layout at this scope; not introduced here). |
| Keyboard / focus | Detail page | No new interactive elements are added (no button, link, or disclosure). Tab order is unaffected — the section remains non-interactive reading content, matching today. |
| Screen reader | Detail page | The two new `h4` elements are real headings inside the existing `aria-labelledby="quiet-stay-title"` section, so they participate correctly in heading navigation. No `aria-live` regions are added or removed beyond the existing `checking`/`check_failed` status handling. |
| `DealCard` collapsed, no cue | Scan tier | Unchanged — no line renders, `aria-label` unaffected. |
| `DealCard` collapsed, insulation cue present | Scan tier | Unchanged rendering position and `aria-label` inclusion (between city line and price block), only the *source* of truth for when it appears changes (§5.2). |
| `DealCard` collapsed, exposure-only evidence (fixed defect) | Scan tier | No cue renders and no exposure claim reaches the `aria-label`. This is the state that was broken; this row is the acceptance test. |

## 7. Tailwind / token usage

No new classes, colors, or font sizes. The two new `h4` axis headings reuse
the exact class string already used by every other group heading in this file
(`EvidenceGroup`'s `h4`, `QuietStayEvidenceLedger.tsx:366`):

```
text-sm font-medium leading-5 text-[color:var(--text-1)]
```

The new axis-introduction sentence (§3.1) reuses the exact class string
already used for `SCOPE_CAVEAT` (`QuietStayEvidenceLedger.tsx:472`):

```
mt-2 text-sm leading-6 text-[color:var(--text-2)]
```

The axis wrapper itself is a plain `<div>` (or reuses the existing `<section
className="py-4 first:pt-0 last:pb-0">` pattern from `EvidenceGroup`, applied
once per axis around its child groups) inside the existing
`divide-y divide-[color:var(--border)]` container — no new border, radius, or
spacing token is introduced. Axis distinction is carried entirely by heading
text, per research constraint 4 ("every axis distinction must be conveyed in
text, not by colour or position alone").

## 8. Acceptance criteria (maps directly to implementation + tests)

1. `getInsulationEvidenceClass(evidence)` exists, is exported, and never
   returns non-`'none'` from `nearbyContext`- or `guestPatterns`-only
   evidence.
2. `getQuietEvidenceResultCue` returns `null` for a fixture whose only valid
   evidence is `nearbyContext` (regression test replacing the current
   assertion that pins the bug).
3. `getQuietEvidenceResultCue` is unchanged for every fixture combination
   that includes a valid insulation fact (no regression in the existing
   "Room type" / "Property" cue tests).
4. A `room_type`-scope `SelectedStayQuietFact` with
   `normalizedId !== 'soundproofing_room'` never renders the string
   `"Provider lists soundproofing"` and instead renders
   `"Provider lists {attributeLabel} for {roomTypeLabel}."`.
5. A `room_type`-scope fact with `normalizedId === 'soundproofing_room'`
   renders byte-for-byte the same copy as before this change (no regression).
6. The expanded ledger's evidence-available state contains both new h4
   strings (`Room sound insulation`, `Noise in the surroundings`) and the new
   axis-introduction sentence; the zero-coverage fallback state contains
   neither (regression-free — the existing fallback test is untouched).
7. `npx tsc --noEmit --incremental false` exits 0.
8. `npm test -- --passWithNoTests` exits 0, including updated/added cases in
   `app/components/__tests__/QuietStayEvidenceLedger.test.tsx`.

## Handoff

Proceeding directly to UI implementation in this same worktree (ticket-board
service unavailable; continuing the pipeline per repo-root `AGENTS.md`).
Given the scope above touches only `app/components/ui/QuietStayEvidenceLedger.tsx`,
`app/components/ui/DealCard.tsx` (no functional change expected, verified at
implementation time), and the existing component test file — no API route,
provider, or business-logic change — this is UI-only work per `AGENTS.md`
Stage 4's own branching rule ("Create `DEV-<FEATURE_SLUG>-01` if logic/API
changes are needed, OR `TEST-<FEATURE_SLUG>-01` if this is UI-only work"). If
implementation surfaces an unexpected need to touch `lib/providers`, scoring,
or data helpers, that will be flagged explicitly and a real `DEV` pass will be
run before `TEST`.
