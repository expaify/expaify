# UXD-HOTEL-ROOM-SOUNDPROOFING-01: Room Soundproofing Expectation Clarity

Date: 2026-08-03
Stage: UX Discovery
Priority: P2
Feature slug: `hotel-room-soundproofing`

## Scope Boundary Against Prior Work

Two pipelines already cover adjacent ground and must not be re-opened here:

- `docs/pipeline/hotel-noise-fit/` established the trust model for quiet-stay evidence overall — what may be claimed, at what certainty, and what a provider omission does not prove.
- `docs/pipeline/hotel-noise-quiet-fit/` established the evidence hierarchy and the fact that no live hotel record reaches the ledger.

**This ticket is narrower and different.** Those pipelines treat "quiet stay" as one need served by one ranked evidence ladder. This discovery asserts that the ladder conflates **two independent physical questions** and that the conflation is itself the defect:

| Axis | Question it answers | Controlled by |
|---|---|---|
| **Room sound insulation** | How much sound does this room's construction stop? | The property — glazing, walls, doors, HVAC |
| **Nearby-noise exposure** | How much sound is there outside to stop? | The surroundings — roads, flight paths, nightlife |

A room can be well insulated in a loud district, or poorly insulated in a silent suburb. Neither axis predicts the other, and a favourable reading on one does not compensate for an unknown on the other. Everything below is confined to making that separation legible and to setting evidence thresholds and language for the **insulation** axis specifically.

One correction to the prior record: `hotel-noise-quiet-fit/01-discovery.md` states the ledger is placed under "Supporting evidence," after the provider action. That is no longer true. `app/deals/[dealId]/page.tsx:444` mounts it inside "Hotel fit" (`data-hotel-decision-position="3"`), ahead of "Check rooms with provider" (position 4). The placement problem is solved; the separation problem is not.

## User Pain Point

A noise-sensitive traveller cannot tell whether expaify has evidence that **the room itself blocks sound** or only evidence about **how loud the surroundings are**, because both are presented as interchangeable rungs of a single "quiet-stay evidence" ladder — so a nearby-distance measurement can satisfy the interface's own definition of quiet-stay evidence while the traveller learns nothing about insulation.

## Who Is Affected And Where

Light sleepers, guests on a shifted sleep schedule between travel legs, remote workers who need uninterrupted calls, and families settling young children. The need is situational and must be inferred from behaviour on evidence surfaces only — expaify must not collect free-text sleep needs or any health information to establish it.

The break occurs across two steps:

1. **Hotel detail evaluation.** `QuietStayEvidenceLedger` renders four peer groups — "Selected room or stay," "Property facts," "Guest-reported patterns," "Nearby context" — as visually equal siblings in one `divide-y` stack (`app/components/ui/QuietStayEvidenceLedger.tsx:475-513`). The only language separating the axes is a single shared caveat, `SCOPE_CAVEAT` (line 104), which says the details do not predict a specific room. That caveat correctly disclaims room-level prediction but never tells the reader that two of these groups answer *a different question* than the others.

2. **Room selection.** This step does not exist inside expaify. There is no room-selection surface anywhere in `app/`; the detail page's terminal action is "Check rooms with provider" (`app/deals/[dealId]/page.tsx:449`). Room selection happens on the affiliate's site, after handoff. `QuietStayEvidenceHandoff` — the one component that filters room-scope facts against a chosen `selectedProductId` — is exported but mounted by nothing. Any expectation expaify sets about insulation is therefore set *before* the traveller can see, let alone choose, a room, and expaify never observes which room was chosen.

## Current, Measurable Signal

### 1. Evidence coverage for soundproofing claims is 0%, and structurally capped at property scope

The wired product path passes `NO_QUIET_STAY_EVIDENCE` (`app/deals/[dealId]/page.tsx:444`), so live coverage is zero. But the more durable finding is in the type contract: insulation is modelled at exactly **one** node, and that node is pinned to the property.

```
PropertyQuietFact = { normalizedId: 'soundproofing_property', ... }   // line 39
```

`normalizedId` is a literal type with one member. `validPropertyFact` (line 174) rejects anything else. There is no room-scope insulation fact type. Meanwhile `lib/types.ts:126-131` already defines a canonical `HotelEvidenceScope` including `'room'` — the shared type layer supports room scope, and the ledger's parallel scope union does not use it for insulation.

### 2. Room-scope insulation is smuggled through a generic fact type, producing an overclaim

Room-level soundproofing has no home of its own, so it travels as a `SelectedStayQuietFact` with `scope: 'room_type'`. The renderer then hardcodes soundproofing copy for **any** fact carrying that scope:

```
} else if (fact.scope === 'room_type') {
  claim = `Provider lists soundproofing for ${fact.roomTypeLabel?.trim()}. ...`   // lines 303-305
```

`attributeLabel` is validated as bounded text (line 155) and then discarded on this branch. A `room_type` fact describing blackout curtains, a high floor, or a courtyard aspect renders as a soundproofing claim. This is a fabricated insulation claim generated by the presentation layer, not by any provider — the exact failure the constraint against manufacturing guaranteed room conditions is meant to prevent.

The inverse defect sits one branch below. A fact at `scope: 'selected_stay'` — the *strongest* available scope — falls through to generic copy that echoes `attributeLabel` verbatim (line 307). Specificity is inverted: the weaker scope gets confident named copy, the stronger scope gets a generic sentence.

### 3. The ranking treats the two axes as substitutes

`getStrongestQuietEvidenceClass` (line 263) collapses both axes into one ordinal ladder — `selected_stay > room_type > property > guest_pattern > nearby_context` — and returns a single winner. `getQuietEvidenceResultCue` (line 274) then renders it:

```
`Quiet-stay evidence available · ${classLabels[strongestClass]}`
```

A property with only a straight-line distance to an airport and **no insulation evidence whatsoever** produces the cue *"Quiet-stay evidence available · Nearby context."* `DealCard` surfaces that string in results and folds it into the card's `aria-label` (`app/components/ui/DealCard.tsx:99-101, 174`), so it reaches screen-reader users as a summary claim. An exposure measurement is announced as satisfaction of a quiet-stay need. One ladder cannot rank two independent axes; a lower rung on the insulation axis is not "weaker evidence," it is evidence about something else.

### 4. Guest-reported patterns already contain the axis split, unused

`GuestNoisePattern` (line 45) enumerates nine patterns that fall cleanly into two groups:

- **Insulation-revealing (internal transmission):** `corridors`, `lifts`, `adjoining_rooms`, `building_systems`
- **Exposure-revealing (external):** `street_or_traffic`, `nightlife`, `aircraft`, `rail_or_transport`
- **On-site external:** `property_venues_or_events`

Guests reporting they hear the lift or the adjoining room are reporting a property of the building's insulation. Guests reporting aircraft are reporting the flight path. `GuestPatternItem` (line 330) renders all nine with identical copy — "Guests mention {label}" — and `patternLabels` (line 108) carries no axis field. The most informative signal expaify has about insulation is present in the taxonomy and flattened at render.

This is also where the strongest guardrail applies: these are review-derived. They may indicate where a traveller should ask a question. They may never be converted into a statement about the room that will be assigned.

### 5. No measurement exists for any of it

`DealCard`'s `quietStayEvidence` prop (line 51) is optional and **passed by none of its six call sites** (`app/page.tsx:171, 208, 210, 285`; `app/deals/DealFeed.tsx:1803, 1820, 1910`). `QuietStayEvidenceHandoff` is mounted nowhere. There is no analytics event for insulation-evidence exposure, engagement, or comprehension, and no event distinguishes the two axes.

The baseline is therefore not "rooms are poorly insulated." It is: **expaify cannot currently express, rank, or measure a soundproofing claim as a distinct thing from a neighbourhood-noise claim.**

### Required measurement definitions

1. **Insulation-evidence coverage:** among live hotel offers, the share carrying at least one insulation-axis fact, segmented by scope (selected stay / room / property) and reported separately from exposure-axis coverage. A single blended "quiet-stay coverage" figure is not acceptable and hides the gap this ticket exists to close.
2. **Axis comprehension:** in task testing, the share who correctly answer, for one property, (a) what expaify knows about the room's insulation, (b) what it knows about the surroundings, and (c) which of the two is unknown. Record separately, and count as a failure, any participant who cites a nearby-distance fact as evidence about insulation.
3. **Overclaim rate:** the share who conclude that a room is guaranteed quiet, that a property-scope soundproofing fact applies to the room they will be assigned, or that a guest review pattern establishes a room condition. Target is zero for all three.
4. **Booking continuation among noise-sensitive travellers:** handoff start rate after exposure to insulation evidence, segmented by insulation-axis state (documented / guest-reported only / unknown). Higher is not automatically better — declining to continue when insulation is unknown is a correct outcome and must be reported as such, not as lost conversion.
5. **Post-handoff mismatch intent:** among users returning from a provider, the share selecting a bounded reason distinguishing "room was not as insulated as expected" from "the area was louder than expected." Never infer from return timing or tab closure; never collect room numbers, free-text sleep needs, or medical detail.

Instrumentation carries fixed evidence IDs, axis, scope, and state only.

## Constraints The Solution Must Respect

1. **Review sentiment must never become a guaranteed room condition.** Guest-reported internal-transmission patterns are the richest insulation signal available and the most dangerous. They may be shown as attributed, windowed, licensed guest reports that suggest what to verify — never as a property of the room the traveller will receive. The existing `licensedForDisplay: true` gate (line 182) and review-window rendering must be preserved and extended, not relaxed, when the axis split is introduced.

2. **The two axes must remain separately addressable and must never substitute for each other.** Insulation evidence and exposure evidence require independent coverage states, independent "unknown" states, and independent surfacing. No single ordinal ranking may return one axis as the "strongest" answer when the question concerned the other. An unknown on either axis stays visible as an unknown — it is not filled in by a favourable reading of its counterpart.

3. **Scope escalation is one-way and must survive the handoff boundary.** Property-scope insulation may never be rendered as room-scope, and room-scope may never be rendered as applying to the assigned room, because expaify does not own room selection and never observes the chosen room. Copy set before handoff must remain true after the traveller picks a room on the provider's site. Concretely, the hardcoded soundproofing copy on the `room_type` branch (lines 303-305) must be driven by a normalized insulation identifier, not by scope.

4. **Contract and presentation limits carry through.** Any new insulation data enters via `lib/providers` returning `Result<T>` — never a vendor call from a component. Adding a second axis must not produce a side-by-side comparison that breaks at 375px; the ledger's current single-column `divide-y` stack and 44px touch targets are the baseline. Every axis distinction must be conveyed in text, not by colour or position alone, and must survive into the `aria-label` summaries `DealCard` already builds.

## Success Statement

This is solved when a first-time, noise-sensitive user reading a hotel detail page can state, in their own words, what expaify knows about that room's sound insulation and — separately — what it knows about the noise around the property, including when either is unknown, without concluding that a distance measurement tells them anything about the room, that a property-level soundproofing listing applies to the room they will be assigned, or that any guest review guarantees a room condition.

## What UXR Must Establish

1. Whether Travelpayouts, Duffel, Amadeus, or a candidate hotel provider returns any room-scope or property-scope soundproofing attribute at all, with real field names and observed fill rates — the ceiling on everything above. If no provider supplies it, the honest outcome is a well-designed permanent unknown state, and that must be stated rather than designed around.
2. Whether guest-review data licensed for display can be segmented into internal-transmission versus external-exposure patterns at acceptable precision, and the minimum review count and recency window below which an insulation-suggestive pattern must not be shown.
3. How Booking.com and one other reference handle the insulation/surroundings distinction at the level of interaction pattern — specifically whether they separate the two axes, and what language they use when insulation is unknown.
4. The exact evidence thresholds per axis: what qualifies as documented, what qualifies as guest-reported only, what qualifies as unknown, and the staleness bound at which each is withdrawn.
5. Final rules for replacing the single `getStrongestQuietEvidenceClass` ladder with per-axis state, including what `DealCard`'s results cue may say when only one axis has evidence.

## Handoff

**Handoff ticket NOT yet created — blocked.** The worktree host ran out of disk space (`ENOSPC`) partway through this stage, and no further shell commands could execute. The required board POST could not be issued.

The monitor or the next operator must create `UXR-HOTEL-ROOM-SOUNDPROOFING-01` once disk space is reclaimed:

```
curl -s -X POST http://localhost:3001/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"id":"UXR-HOTEL-ROOM-SOUNDPROOFING-01","title":"UX Research: hotel room soundproofing expectation clarity","priority":"P2","role":"qa","status":"backlog","description":"Discovery: docs/pipeline/hotel-room-soundproofing/01-discovery.md. Problem: a noise-sensitive traveller cannot tell whether expaify has evidence that the room itself blocks sound or only evidence about how loud the surroundings are, because both are ranked as interchangeable rungs of one quiet-stay ladder (getStrongestQuietEvidenceClass in app/components/ui/QuietStayEvidenceLedger.tsx), so a nearby-distance fact yields the cue Quiet-stay evidence available and no insulation evidence at all. Scope is the insulation-vs-surroundings separation only; hotel-noise-fit and hotel-noise-quiet-fit already cover the general quiet-stay trust model and ledger wiring. Research brief due at docs/pipeline/hotel-room-soundproofing/02-research.md. See the What UXR Must Establish section for the five required questions, starting with whether any provider returns a soundproofing attribute at all."}'
```

Research brief due at `docs/pipeline/hotel-room-soundproofing/02-research.md`.
