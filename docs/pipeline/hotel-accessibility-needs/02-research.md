# UX Research: Hotel Accessibility Needs Visibility

Ticket: `UXR-HOTEL-ACCESSIBILITY-NEEDS-01`
Stage: UX Research
Priority: P1
Date: 2026-07-29
Feature slug: `hotel-accessibility-needs`

---

## Source Inputs

**Inherited wholesale — settled, not re-derived:**
- `docs/pipeline/accessibility-stay-fit/02-research.md` (`UXR-ACCESSIBILITY-STAY-FIT-01`, 2026-07-21). Deliverable 1 (participant criteria), Deliverable 2 (evidence standards), Deliverable 3 (success measures), Deliverable 4 (twelve-item need-grouped MVP set), Deliverable 5 (empty-data treatment) and all six design directives **carry forward unchanged** except where reconciliation below explicitly supersedes an item, and each such supersession is named.
- `docs/pipeline/hotel-amenity-provenance/02-research.md` — the provenance evidence contract. Not forked.

**Current problem statement:**
- `docs/pipeline/hotel-accessibility-needs/01-discovery.md` (2026-07-29).

**Source files audited today (read, not assumed):**
- `lib/types.ts` — `HotelEvidenceStatus` (`:120`-`124`), `HotelEvidenceScope` (`:126`-`130`), `HotelEvidenceFee` (`:132`), `HotelEvidenceCertainty` (`:136`), `HotelAmenityEvidence` (`:138`-`149`), `HotelAccessEvidenceState` (`:151`), `HotelRateEligibilityCapability` (`:467`-`472`), `HotelOffer.amenityEvidence` / `.accessEvidenceState` (`:493`-`494`).
- `lib/providers/hotelAmenityEvidence.ts` — the seven-fact catalog (`:18`-`26`), `validScope` (`:64`), `validConfirmedCombination` (`:70`-`83`), `normalizeItem` (`:109`), `normalizeHotelAmenityEvidence` (`:151`).
- `lib/providers/hotellook.ts` — normalization wired at `:381` (live) and `:502` (cached).
- `app/components/HotelCard.tsx` — `getAccessEvidence` (`:118`), `getConfirmedCopy` (`:140`), `getUnavailableCopy` (`:192`), `AccessEvidenceRow` (`:219`), `AccessEvidencePanel` (`:259`, heading `:286`), `QualityEvidencePanel` (`:624`), expanded-detail render order (`:986`-`1073`), panel mounted at `:1039`.

**Reference patterns re-checked at interaction level (extending the settled Booking.com / Google Hotels comparison only where deliverables 2 and 3 require it):**
- Booking.com — property facility taxonomy, in which "Accessibility" is its own named facility section, structurally separate from "Room amenities" and "Services & extras".
- Google Hotels — per-property "Accessibility" list rendered separately from "Amenities".

---

## Research Question

Given that the evidence contract, the provider normalization path, and an access-titled evidence panel have all now shipped, and that none of them carries a single disability-need fact: what is the minimum set of catalog, naming, state, and certainty decisions that lets a traveler with a mobility, vision, or hearing need read the hotel detail correctly — without duplicating shipped ids, without forking the shipped contract, and without any panel over-claiming the scope of what expaify actually asked the provider?

## Research Summary

The discovery's diagnosis holds and the audit confirms it in code. The seven-fact catalog at `lib/providers/hotelAmenityEvidence.ts:18`-`26` contains zero disability-need facts, and a repo-wide search of `lib/` and `app/` for `wheelchair|roll-in|roll_in|grab bar|braille|service animal|hard of hearing|vibrating` returns **zero product-code matches**. The panel headed "Access & room requests" (`HotelCard.tsx:286`) therefore renders, in a disabled traveler's own vocabulary, the sentence *"Access details not documented by this provider"* (`:274`) about a catalog that was never asked the question. Failed-discovery rate is structurally 100% and needs no instrumentation to verify.

Three findings shape the four deliverables:

1. **The certainty boundary is already enforced in code — for two ids only.** `validConfirmedCombination` (`hotelAmenityEvidence.ts:70`-`83`) already refuses `confirmed` for `elevator` and `step_free_route` unless `scope === 'property' && certainty === 'guaranteed'`, while permitting `requestable` for the four room preferences and for `on_site_parking`. The mechanism this brief's Deliverable 4 requires **exists and is proven**; it needs its id list extended, not a new design. This is the single most reusable thing in the shipped code.

2. **The panel's `status` union is not the right home for "we did not ask."** With a fixed global catalog, every id is always asked, so per-id "not asked" is unrepresentable and meaningless. The honest unit is *catalog coverage per provider*, and `lib/types.ts:467` already ships the exact precedent for that shape: `HotelRateEligibilityCapability`, a per-offer boolean map of which dimensions the provider was queried for, held **alongside** the evidence rather than inside a status value. Deliverable 3 uses it; no status extension is needed.

3. **A shipped accessibility bug blocks the intended announcement.** `AccessEvidencePanel` (`HotelCard.tsx:280`-`285`) sets both `aria-labelledby={titleId}` and `aria-label={sectionLabel}` on the same `<section>`. Per accessible-name computation, `aria-labelledby` wins unconditionally, so `sectionLabel` — the entire "Access details not documented by this provider. Confirm directly before booking." summary intended for the all-`not_returned` case, which is today's only real-world case — **is never announced**. The panel's headline honesty mechanism is dead code. Any redesign that keeps this pattern inherits the defect.

Everything else the 2026-07-21 research settled — need grouping, scope inseparability, silence-is-not-absence, no color-only status, no ADA/compliance/suitability language, collapsed-card silence — stands and is not restated below except where a deliverable depends on it.

---

## Current Implementation Findings

### F1 — The catalog answers logistics, not need

The seven ids (`hotelAmenityEvidence.ts:18`-`26`) split into three property facts (`elevator`, `on_site_parking`, `step_free_route`) and four room preferences (`room_pref_ground_floor`, `room_pref_high_floor`, `room_pref_near_elevator`, `room_pref_connecting`). The four preferences are explicitly *preferences*: `getConfirmedCopy` renders them as "You can request a ground-floor room." (`HotelCard.tsx:145`-`148`). Not one id addresses bathroom transfer, doorway clearance, sensory alerts, or animal policy. The panel is a room-request panel with two building facts attached, wearing the word "Access."

### F2 — Normalization is conservative and correct, and is the right place to extend

`normalizeItem` (`:109`-`149`) drops unknown ids outright (`:117`), downgrades scope/status mismatches to `unknown` rather than guessing (`:122`-`124`), refuses `confirmed`/`unavailable` without a source label (`:126`-`128`), and refuses illegal confirmed combinations (`:131`-`133`). `getAccessEvidence` in the component (`HotelCard.tsx:118`-`139`) re-applies the same guards client-side. Both paths default every unsupplied id to `not_returned`. This satisfies inherited Evidence Standards 1–4 already. New disability-need ids must enter here and nowhere else; the component must gain no new parsing.

### F3 — Provider reality is unchanged

`normalizeHotelAmenityEvidence` is called on both Hotellook paths (`hotellook.ts:381`, `:502`), and Hotellook returns no `amenityEvidence`, so the live steady state for every offer is seven `not_returned` rows, rendering the `defaultCopy` at `HotelCard.tsx:274`. The empty state is not an edge case; it is the product. This is unchanged from 2026-07-21 and confirms the out-of-scope call on provider integration.

### F4 — Heading semantics are inconsistent across sibling panels

`AccessEvidencePanel` uses a real `<h4>` (`:286`). `QualityEvidencePanel` uses a `<p>` with `aria-label="Quality evidence"` on the section (`:637`-`641`), and the Location, Price scope, and Provider handoff blocks use bare `<p>` labels inside unlabelled `<div>`s (`:1002`-`1014`, `:1046`-`1053`, `:1066`-`1069`). A screen-reader user navigating the expanded detail by heading finds exactly one heading; navigating by landmark finds two of six blocks. Reaching accessibility content by any structural means is therefore luck, not design. Deliverable 2 fixes this for the panels it owns and flags the rest.

### F5 — The booking CTA precedes the detail region in DOM order

The Review/booking control and the `Details` toggle render in the collapsed header (`HotelCard.tsx:960`-`983`), before the expanded region (`:986`). Accessibility content can therefore never gate a booking; a user can reach the provider without expanding. This is a hierarchy constraint inherited from the discovery (do not disturb the shipped hierarchy) and is **not** proposed for change. Its consequence is a requirement: the accessibility panel must be self-sufficient the moment it is reached and must carry its own confirm-before-payment instruction rather than relying on placement.

---

## Reference Pattern Comparison (extension only)

The settled comparison stands. Two extensions are needed for Deliverables 2 and 3.

**Booking.com — accessibility is a separate named facility section, not a subsection of amenities.** Its property facility page lists "Accessibility" as a peer of "Room amenities," "Services & extras," and "Parking," with individually named entries. The interaction lesson for Deliverable 2: the *separation itself* is the signal. A user scanning for their need looks for one section name and reads only it; mixing accessibility rows into a general facilities list forces them to read everything to find out whether anything applies.

Delta vs. expaify: expaify has the opposite — one section named for accessibility that contains general facilities.

**Google Hotels — accessibility list is disjoint from the amenity list, and parking appears in both under different names.** "Accessible parking" is an accessibility entry; "Parking" (with price) is an amenity entry. They are not merged, and confirming one does not confirm the other. The interaction lesson for Deliverable 1: a facility fact and its accessible-path counterpart are **different facts about the same physical thing**, and both references keep them distinct rather than qualifying one row.

Delta vs. expaify: expaify ships only `on_site_parking`, whose confirmation says nothing about a designated space or a step-free path from it.

**What neither reference does, still.** Neither states the boundary of its own catalog. When Booking.com or Google Hotels shows nothing for a need, the user cannot tell whether the property was asked. This remains the place expaify should exceed both, and it is exactly Deliverable 3.

---

## Exact Gap

| | Current code | Reference pattern | Delta |
|---|---|---|---|
| Catalog | 7 ids, 0 disability-need | Named per-need feature sets, accessible-path facts distinct from facility facts | 9 ids to add, 1 duplicate to reject, 1 overlap to resolve, 1 proposed id to drop |
| Section boundary | 1 section, accessibility-named, logistics-contented | Accessibility is a separate peer section | Split into two sections; neither may claim the other's territory |
| Catalog-scope honesty | None; catalog silence renders as provider silence | None either | expaify-specific: a per-provider coverage statement, attributed to expaify not the provider |
| Certainty | `requestable` legal for 5 of 7 ids | n/a | `requestable` must be structurally illegal for every disability-need id |

---

## Deliverable 1 — Catalog Reconciliation

**Decision rule applied throughout:** a shipped id is never renamed or repurposed (the contract is live on two provider paths and in component-side guards); a proposed id that would sit adjacent to a shipped id without a decidable difference is dropped rather than added; a proposed id that describes a genuinely different physical fact is added even where a shipped id sounds similar.

### The three named collisions

**1. `elevator` — exact duplicate. KEEP shipped, DROP proposed.**
One id. The shipped definition (`property` scope, `guaranteed` certainty required, `hotelAmenityEvidence.ts:75`-`77`) is already exactly what the accessibility use needs. It gains `needType: 'mobility'` and moves panel (Deliverable 2); its id, label, scope rule, and copy are untouched. *Justification: identical fact, identical scope, identical certainty rule; a second id would let one provider payload confirm one and leave the other `not_returned`, producing a contradiction the user cannot resolve.*

**2. `step_free_route` vs. proposed `step_free_entrance` — KEEP shipped, DROP proposed, ADD a normalization rule.**
Shipped `step_free_route` is labelled "Step-free route, entrance to room" — a route claim that **subsumes** the entrance. Proposed `step_free_entrance` is the strictly weaker building-entrance claim. Keep one id: `step_free_route`.

*Justification:* two overlapping route ids produce the worst possible reading for the highest-severity need. "Step-free entrance: confirmed / Step-free route: not documented" is unresolvable by the user — it neither grants nor denies entry to the room, and a wheelchair user must treat it as a no anyway, so the extra row adds a decision cost and no decision. Route-to-room is the booking-blocking fact; entrance-only is a partial that must not be shown as a pass.

*Required normalization rule (new, enforceable in `lib/providers`):* a provider value that documents step-free access **only at the building entrance**, or only at any proper subset of the route, **must not** confirm `step_free_route`. It maps to `status: 'unknown'`, which already renders as "the provider's information is unclear. Confirm directly before booking." (`HotelCard.tsx:222`). Confirmation requires the provider to document the full entrance-to-room route, which is what the shipped aria copy already promises: *"confirms every documented link in the route is step-free"* (`:167`).

*Residual risk, flagged for UXDES:* this discards a real partial signal (an entrance that is known step-free). It is discarded deliberately — a partial rendered as a row is read as a pass by exactly the users who can least afford that error. If provider data later distinguishes route segments, revisit as a `detail` string on the single id (inherited Deliverable 2 permits provider-supplied, source-labelled `detail`), never as a second id.

**3. `on_site_parking` vs. proposed `accessible_parking_path` — KEEP both, ADD the proposed. Disjoint facts.**
`on_site_parking` is a facility-and-fee fact (it is the only id that carries `fee`, `hotelAmenityEvidence.ts:144`, and the only property fact permitted `requestable` certainty, `:78`-`80`). `accessible_parking_path` is a designated accessible space **plus** a step-free path from it to the entrance.

*Justification:* both references keep these separate for good reason — the path-of-travel gap is the frequent silent failure named in the inherited MVP set. No inference is permitted in either direction: `on_site_parking: confirmed` must never confirm `accessible_parking_path`, and `accessible_parking_path: not_returned` must never be shown as a qualification on the parking row.

*Boundary note for UXDES/DEV:* a separate, richer parking model already ships (`ParkingSection`, `HotelParkingOptionEvidence`, `lib/types.ts:157`+, rendered `HotelCard.tsx:1017`). `accessible_parking_path` must **not** duplicate its fee/reservation/operator dimensions. It is one access-need row with `status`/`scope`/`sourceLabel` only.

### Merged canonical catalog — 16 ids

`kind` is internal `lib/providers` metadata on the local `AccessFact` type (`hotelAmenityEvidence.ts:11`-`16`), **not** a change to the shipped `HotelAmenityEvidence` contract. It gains a third value, `access_need`, and a `needType` field. No field is added to `lib/types.ts`.

**Group A — access needs, mobility** (`kind: 'access_need'`, `needType: 'mobility'`)

| id | Decision | Label | Default scope | Justification |
|---|---|---|---|---|
| `step_free_route` | **KEEP** (recategorize) | Step-free route, entrance to room | `property` | Shipped; subsumes proposed `step_free_entrance`. Scope + certainty rules already correct. |
| `elevator` | **KEEP** (recategorize) | Elevator | `property` | Shipped; exact duplicate of proposed id. |
| `accessible_room` | **ADD** | Accessible room type | `property` | Property-level by nature; the highest scope-collapse risk in the set. Copy must never imply the booked room. |
| `roll_in_shower` | **ADD** | Roll-in shower | `room` | Common hard requirement; room-scoped when the provider says so. |
| `bathroom_grab_bars` | **ADD** | Bathroom grab bars | `room` | Room-scoped; distinct from roll-in shower — a roll-in shower without bars fails for many users. |
| `accessible_parking_path` | **ADD** | Accessible parking and step-free path | `property` | Disjoint from `on_site_parking`; path-of-travel gap. |
| `accessible_common_areas` | **ADD** | Step-free access to shared areas | `property` | Lobby, dining, pool. Property-scoped by nature. |

**Group B — access needs, vision** (`needType: 'vision'`)

| id | Decision | Label | Default scope | Justification |
|---|---|---|---|---|
| `braille_tactile_signage` | **ADD** | Braille or tactile signage | `property` | Wayfinding; property-scoped. |

**Group C — access needs, hearing** (`needType: 'hearing'`)

| id | Decision | Label | Default scope | Justification |
|---|---|---|---|---|
| `visual_vibrating_alarm` | **ADD** | Visual or vibrating fire alarm | `room` | Safety-critical; room-scoped when stated. Never merged with `visual_alerts`. |
| `visual_alerts` | **ADD** | Visual doorbell and phone alerts | `room` | Convenience-critical, not safety-critical; separate severity, separate row. |

**Group D — access needs, general** (`needType: 'general'`)

| id | Decision | Label | Default scope | Justification |
|---|---|---|---|---|
| `service_animals_welcome` | **ADD** | Service animals welcome | `property` | A policy, not a room feature. Must not be phrased as an amenity, and must not be conflated with the shipped pet-policy panel (`HotelCard.tsx:1025`), which is a fee-bearing pet model and a different question. |

**Group E — room requests and parking** (`kind: 'room_request'` / `'property'`; **not** access needs)

| id | Decision | Label | Default scope | Justification |
|---|---|---|---|---|
| `on_site_parking` | **KEEP** unchanged | On-site parking | `property` | Facility + fee fact; `requestable` remains legal. |
| `room_pref_ground_floor` | **KEEP** unchanged | Ground-floor room | `room` | Preference; `requestable` remains legal. |
| `room_pref_high_floor` | **KEEP** unchanged | High-floor room | `room` | Preference. |
| `room_pref_near_elevator` | **KEEP** unchanged | Room near the elevator | `room` | Preference. |
| `room_pref_connecting` | **KEEP** unchanged | Connecting rooms | `room` | Preference. |

### Proposed ids dropped, with justification

| Proposed id | Decision | Justification |
|---|---|---|
| `step_free_entrance` | **DROP** | Subsumed by shipped `step_free_route`; see collision 2. Partial-route data maps to `unknown`, not to a second row. |
| `elevator` (as new) | **DROP** | Exact duplicate of shipped id. |
| `accessible_booking_path` | **DROP from this catalog; flag as a separate ticket** | It describes the accessibility of *the provider's own booking site*, not the property. It cannot carry `scope ∈ property\|room\|rate\|selected_stay` without lying, so it fails inherited Evidence Standard 3 outright. Placing it among property facts would teach users that a row in this panel is about the building. It belongs on the provider-handoff surface (`HotelCard.tsx:1066`), as a separate ticket, and is listed under Out Of Scope below. |

### Deliberate MVP exclusion, flagged

**Doorway clearance** is named in the discovery problem statement but is absent from the inherited twelve-item set, and this brief does **not** add it. It is a measurement, not a boolean: a useful row would have to render a number and a unit, providers rarely document it, and a `confirmed` boolean for "doorway clearance" without a width is precisely the need-collapse failure this line exists to prevent. Flagged for a post-MVP ticket contingent on a provider returning a dimension; if added, it must arrive as a dimension-bearing row, never as a boolean.

**Net:** 7 shipped ids all kept (2 recategorized as access needs, 5 unchanged), 9 added, 3 proposed ids dropped. 16 total. No shipped id renamed, repurposed, or removed. No change to `lib/types.ts`.

---

## Deliverable 2 — Panel Boundary And Naming

### Decision: a sibling panel, not an extension

Four reasons, each testable:

1. **The certainty rules diverge and the divergence is invisible in a merged list.** After Deliverable 4, `requestable` is legal for Group E and structurally illegal for Groups A–D. In one panel, "You can request a ground-floor room" and "Provider confirms a roll-in shower" sit as peer rows with no visible reason why one can be requested and the other cannot — teaching the user that requestability is a property of the provider rather than of the fact, and inviting "can I request a roll-in shower too?"
2. **Failure severity differs by a category.** A room preference that fails is a disappointment absorbed at check-in. A disability-need fact that fails is a booking-blocker, often at a non-refundable rate, at night, after travel. Peer rows assert peer stakes.
3. **The grouping schemes are incompatible.** Inherited Deliverable 4 requires access needs grouped by `needType` so a user scans only their group. Group E does not group by need at all. One panel would have to nest two grouping logics.
4. **Scan and announcement cost at 375px.** Sixteen rows in a two-column `dl` is a wall; and the reference patterns (Booking.com, Google Hotels) both split for the same reason.

### Headings

| Panel | Heading (final copy) | Contents |
|---|---|---|
| New | **Accessibility features** | Groups A–D (11 ids), grouped by need with sub-headings **Mobility**, **Vision**, **Hearing**, **General** |
| Existing, renamed | **Room requests & parking** | Group E (5 ids) |

The existing heading "Access & room requests" (`HotelCard.tsx:286`) is **retired**. It over-claims either way, exactly as the discovery states: keeping it on the room-request panel keeps the word "Access" on a panel with no access-need facts; reusing it on the new panel keeps "room requests" on a panel that must never suggest requestability. Both halves move.

**Standing line under the new panel heading, always present in every state:** *"expaify shows what the provider documented. We do not verify accessibility or guarantee that a property or room will suit you."* (Inherited Deliverable 5; no ADA, compliance, certification, "suitable for," "safe for," or medical framing anywhere in either panel.)

### Non-duplication and the cross-reference

`elevator` and `step_free_route` move to **Accessibility features** and render **once**. They do not appear in Room requests & parking. To keep them findable for the non-disabled user who wants the luggage answer, Room requests & parking carries one plain-text line, not a data row:

> *"Elevator and step-free route are listed under Accessibility features."*

This is a pointer, never a status. It must not be styled as a row, must not appear inside the `dl`, and must carry no state.

### Reading order

The new panel takes the current `AccessEvidencePanel` slot (`HotelCard.tsx:1039`); Room requests & parking follows immediately. Resulting expanded-detail order:

Deal Score → Quality evidence → Location → Parking → Pet policy → Smoking policy → **Accessibility features** → **Room requests & parking** → Price scope → Funds policy → Provider handoff → photo.

This satisfies inherited Deliverable 5's requirement (accessibility after price/score/quality, before the provider-handoff copy) with the minimum structural churn, and puts the decision-blocking content ahead of the price-scope and handoff blocks.

**Constraint carried from finding F5:** the booking CTA precedes the expanded region in DOM order, so accessibility can never gate a booking and no reordering here changes that. The panel must therefore be self-sufficient at the moment it is reached, and every property-scoped row must carry its own confirm-before-payment instruction rather than relying on placement. Do not propose moving the CTA; hierarchy is fixed by the discovery constraints.

### How a screen-reader user reaches the right panel

Four requirements, all testable:

1. **Both panels are `<section>` elements with a distinct accessible name** ("Accessibility features", "Room requests & parking"), making each a navigable landmark. Names must contain the need vocabulary a user will search for; "Access" alone is banned from both names.
2. **A real heading per panel and per need group.** Panel heading at `<h4>` (matching the level shipped at `HotelCard.tsx:286`); need-group headings at `<h5>`. A user navigating by heading must be able to jump directly to Mobility, Vision, Hearing, or General without traversing rows.
3. **Name the section exactly once.** Fix the shipped defect in finding F3 of the summary: do **not** set both `aria-labelledby` and `aria-label` on the same `<section>`. `aria-labelledby` wins and silently discards the other. Any summary the empty state needs to announce must be *rendered text inside the panel*, not an `aria-label` on the wrapper.
4. **Every row announces name + status + scope + source in one phrase**, with scope inseparable from the feature (inherited Directive 2), no status by color or icon alone, and no reliance on the visual two-column grid for meaning.

**Flagged, not owned by this ticket (finding F4):** `QualityEvidencePanel` labels itself with a `<p>` plus `aria-label` (`:637`-`641`), and the Location, Price scope, and Provider handoff blocks are unlabelled `<div>`s with `<p>` titles. The expanded detail therefore has inconsistent heading and landmark structure overall. Fixing the sibling blocks is out of scope here; UXDES should note it and a separate ticket should normalize them, because inconsistent structure degrades exactly the navigation the two panels above depend on.

---

## Deliverable 3 — The "We Did Not Ask" State

### The distinction

| | Meaning | Who is silent | Sentence subject |
|---|---|---|---|
| `not_returned` | The id is in expaify's catalog; the normalizer looked for it; the provider said nothing about it | The provider | *"[Provider] has not documented this."* |
| **Not asked** | expaify does not query this provider for this fact at all | expaify | *"expaify does not check this with [Provider] yet."* |

**The enforcing copy rule: the sentence names who is silent.** Provider silence names the provider as subject; catalog limit names expaify as subject. No string may blend them ("this information is not available" is banned in both states — it names no one and reads as absence).

### Recommendation: no extension to `HotelEvidenceStatus`

**Keep the shipped four-value union unchanged.** Three reasons:

1. **"Not asked" is not a per-fact property, so it cannot be a per-fact status.** The catalog is global and fixed; `normalizeHotelAmenityEvidence` emits every id for every offer (`hotelAmenityEvidence.ts:157`, `:174`). Within that design every id is always asked. What varies is *which need groups a given provider's payload can ever answer*. That is a provider-level fact, and encoding a provider-level fact as a per-row status invites it to be set inconsistently across rows of the same offer, producing "we asked about grab bars but not about roll-in showers at the same hotel" — noise the user cannot act on.
2. **A fifth status value would silently degrade every existing consumer.** `STATUS_PRECEDENCE` (`:29`-`34`), `isStatus` (`:44`), `validConfirmedCombination`, the component-side `precedence` map (`HotelCard.tsx:119`), and every exhaustive `switch` over the union would need updating in lockstep across two normalization paths. The contract is live; the discovery forbids forking it; a union widening is the closest thing to a fork that isn't one.
3. **A shipped precedent for exactly this shape already exists.** `HotelRateEligibilityCapability` (`lib/types.ts:467`-`472`) is a per-offer boolean map of which dimensions the provider was queried for, held **alongside** the evidence (`HotelOffer.rateEligibilityCapability`, `:494`) rather than inside a status. Reusing an established in-repo pattern is materially safer than widening a union.

### Proposed data shape

Mirror the shipped precedent exactly:

```ts
// lib/types.ts — new type, additive; parallel to HotelRateEligibilityCapability
export interface HotelAccessCapability {
  mobility: boolean;
  vision: boolean;
  hearing: boolean;
  general: boolean;
}
// HotelOffer gains: accessCapability?: HotelAccessCapability;
```

Set in `lib/providers` per provider — never per hotel, never inferred from whether a payload happened to contain data. `false` means *expaify does not query this provider for this need group*; `true` means it does, and any silence in that group is then genuine `not_returned`. Absent (`undefined`) is treated as all-`false`, which is today's honest default for Hotellook. Group-level, not per-id, deliberately: it matches how a user thinks ("does this app know anything about hearing needs here?") and cannot produce inconsistent per-row claims.

*This is an addition to `HotelOffer`, not a fork of `HotelAmenityEvidence`. The evidence contract, the status union, the scope union, and the certainty union are all untouched — which is what the discovery constraint requires.*

### Copy and rendering

**Per need group where `capability[needType] === false`** — the group renders its coverage line **instead of** its rows (do not render eleven `not_returned` rows nobody was ever going to answer):

> **Mobility** — *"expaify does not check mobility features with [Provider] yet. This is a limit of what we ask for, not a statement about this property. Ask [Provider] directly about step-free access, bathrooms, and parking."*

**Per need group where `capability[needType] === true` and every row is `not_returned`** — inherited Deliverable 5's provider-silence copy, unchanged in meaning:

> **Mobility** — *"[Provider] has not documented mobility features for this stay. Not documented does not mean unavailable. Check with [Provider] before booking."*

**All four groups false** (today's real steady state for Hotellook) — one panel-level line, not four repeats:

> *"expaify does not check accessibility features with [Provider] yet. This is a limit of what we ask for, not a statement about this property. Ask [Provider] directly about the features you need."*

### Announcement — neither alarming nor reassuring

- **Rendered as text inside the panel**, in the reading order position of the group it replaces — not as an `aria-label` on a wrapper (see Deliverable 2, requirement 3).
- **No `role="alert"`, no `role="status"`, no `aria-live`** on these lines. They are static at render; a live region would interrupt and read as an error. (The shipped `aria-live` on the *loading* and *error* states, `HotelCard.tsx:290`-`299`, is correct for those states and is retained.)
- **Neutral styling only** — the shipped `bg-[color:var(--bg-muted)]` / `text-[color:var(--text-3)]` treatment (`:302`). Never `--warning-soft` / `--warning`, which is reserved for `unavailable` (a real negative claim, `:239`-`241`). Never an icon or color as the sole carrier.
- **Banned words — alarm side:** "unfortunately", "sorry", "missing", "no accessibility features", "none", "unavailable", "warning", "problem", any red or warning token.
- **Banned words — reassurance side:** "don't worry", "should be fine", "most hotels", "typically", "likely", "probably", "included", "available", "free". No estimate, no base rate, no inference from stars, price, photos, property type, or the absence of a negative flag.
- **Required in every variant:** the provider's name, and an explicit next action naming who to ask.

**Comprehension test for UXDES/TEST:** shown the not-asked state, a participant must answer "who doesn't know — the hotel, or expaify?" with *expaify*; shown the `not_returned` state, with *the hotel/provider*. Run in both directions. This is the acceptance gate for this deliverable, and it extends inherited Success Measure 3 (silence comprehension) rather than replacing it.

---

## Deliverable 4 — The Certainty Boundary

### Why `requestable` is valid for room preferences

`certainty: 'requestable'` models a preference the property will attempt to honour and may not: a ground-floor room, a high floor, a room near the elevator, connecting rooms, a parking space. The shipped copy is already correct for this — "You can request a ground-floor room." plus the non-guarantee clause (`HotelCard.tsx:145`-`155`). These share three properties that make requestability honest:

1. **Failure is graceful.** The stay still works; the guest is inconvenienced.
2. **Failure is recoverable at the desk.** A different room can be offered.
3. **The user can absorb the risk knowingly.** "Might not get it" is a complete, actionable description of the downside.

### Why it must never apply to disability-need facts

None of the three holds. For a wheelchair user, a roll-in shower that "can be requested" and is not delivered means the room is unusable; there is nothing to trade down to; the failure surfaces after arrival, after payment, often at a non-refundable rate, at night. For a Deaf guest, a "requestable" visual fire alarm is a safety failure presented as a preference.

The deeper problem is a **category error in the sentence**: "you can request X" converts a hard requirement into a lottery and hands the user a false decision. A user who reads "you can request a roll-in shower" will book. A user who reads "the provider has not documented a roll-in shower" will call. Only the second is true, and only the second produces the right action. `requestable` on an access-need fact is not a weaker claim than `guaranteed` — it is a *different and wrong kind* of claim.

Note the shipped model does not have a "requested and refused" state, and must not gain one for this: the user cannot verify a request was honoured until arrival, which is precisely too late for these facts.

### The enforcing rules

**Rule 1 — Normalizer (structural; extends the proven mechanism at `hotelAmenityEvidence.ts:70`-`83`).**
For any fact with `kind === 'access_need'` (Groups A–D, 11 ids):
```
status === 'confirmed'  requires  certainty === 'guaranteed'
```
A vendor value expressing requestability, availability-on-request, or "subject to availability" maps to `status: 'unknown'` — **not** `confirmed`, and **not** `unavailable`, because the provider did make a statement and it was not a denial. This is exactly what `validConfirmedCombination` already does for `elevator` and `step_free_route` (`:75`-`77`); the change is to extend that branch to the 11 access-need ids and leave the Group E branch (`:78`-`82`) untouched. `on_site_parking` keeps `requestable`.

The same guard is re-applied component-side in `getAccessEvidence` / `normalizeAccessEvidence` (`HotelCard.tsx:100`-`139`), which already downgrades any fact failing its certainty check to `unknown`. Both layers must be updated together, as they are today.

**Rule 2 — Copy (lexical; testable by grep).**
No string rendered for an access-need row — visible or `aria-label` — may contain: *request, requestable, on request, subject to availability, if available, we'll try, may be able to, ask and we can, guarantee, guaranteed accessible, suitable for, safe for, ADA, compliant, certified, accessible-friendly*.

Access-need rows use exactly four sentence frames, and no others:

| Status | Frame |
|---|---|
| `confirmed`, scope `property` | *"[Provider] documents [feature] for this property. This is not a statement about the room you book — confirm your specific room and rate with [Provider] before payment."* |
| `confirmed`, scope `room` / `selected_stay` | *"[Provider] documents [feature] for this room. Confirm it applies to your specific rate with [Provider] before payment."* |
| `unavailable` | *"[Provider] states [feature] is not available."* |
| `not_returned` / `unknown` | *"[Provider] has not documented [feature]."* / *"[Provider]'s information about [feature] is unclear. Confirm directly with [Provider] before booking."* |

Note the frames use "documents", never "confirms" — the shipped Group-A copy at `HotelCard.tsx:159` and `:165` says "Provider confirms…", which reads as expaify vouching. For access-need rows, attribution must be reporting, not endorsement. Group E copy is unchanged.

**Rule 3 — The word "guaranteed" is for the data model, not the user.** `certainty: 'guaranteed'` may gate what renders; it must never be rendered *to* the user as the word "guaranteed" on an access-need row, because expaify does not guarantee accessibility and says so in its standing line. The shipped aria copy "Guaranteed property attribute" (`:161`, `:167`) must not be carried onto the new ids.

---

## Design Directives For UXDES (specific, testable)

1. **Ship the 16-id merged catalog from Deliverable 1 in `lib/providers/hotelAmenityEvidence.ts` only.** Nine ids added, all seven shipped ids kept unchanged in id/label/scope rules, `elevator` and `step_free_route` recategorized as `kind: 'access_need'`. No id renamed or removed. `kind` and `needType` are local `AccessFact` metadata; `lib/types.ts` gains only `HotelAccessCapability` and the optional `HotelOffer.accessCapability`. No new normalization path, no component-side vendor parsing.
2. **Split into two sibling panels with the headings "Accessibility features" and "Room requests & parking"; retire "Access & room requests".** `elevator` and `step_free_route` render once, in the accessibility panel, with a plain-text pointer line (not a row, not a status) in the room-requests panel. Order: after Smoking policy, before Price scope.
3. **Group the accessibility panel by need (Mobility / Vision / Hearing / General) with real `<h5>` headings under an `<h4>` panel heading; name each `<section>` exactly once.** Never set both `aria-labelledby` and `aria-label` on the same section — the shipped panel does, and its empty-state summary is consequently never announced. Any text that must be announced is rendered text.
4. **Render catalog limits as an expaify-attributed, group-level line that replaces that group's rows, distinct from provider-attributed `not_returned`.** The sentence names who is silent. Neutral tokens only (`--bg-muted` / `--text-3`), never `--warning*`; no `aria-live`, no `role="alert"`; none of the banned alarm or reassurance vocabulary in Deliverable 3.
5. **Make `requestable` structurally impossible on access-need facts.** Extend `validConfirmedCombination` and the component-side guard so `confirmed` requires `guaranteed` for all 11 access-need ids; requestability-flavoured vendor values map to `unknown`. Enforce the four sentence frames and the banned-word list; use "documents", not "confirms"; never render the word "guaranteed" on an access-need row.
6. **Every access-need row states scope in the same phrase as the feature, and every property-scoped row carries its own confirm-before-payment instruction.** The booking CTA precedes the detail region in DOM order and will not move, so the panel must stand alone. No feature may up-level from `property` to `room`/`selected_stay`.
7. **Preserve the shipped hierarchy and the collapsed-card silence.** Nothing about accessibility on the collapsed card absent `confirmed` data; price, Deal Score, location, quality, and the Review CTA keep their prominence. Both panels wrap without overlap at 375px and 1280px; the two-column `dl` collapses to one column on mobile; no status by color or icon alone at any breakpoint.

---

## Acceptance Criteria For UXDES

- Design covers, for both panels: provider-documents-feature (property scope and room scope, separately), documented-unavailable, provider-silence (`not_returned`), ambiguous (`unknown`), **catalog-limit ("we did not ask")** at group level and at whole-panel level, loading, error, mobile 375px, desktop 1280px, focus/keyboard order, and the announced string for every one of these.
- Final UI strings supplied for: both panel headings, the standing non-verification line, all four need-group headings, all four access-need sentence frames, the two silence variants (provider vs. expaify), the pointer line in Room requests & parking, and the labels for all nine new ids.
- Today's Hotellook reality — all four capability groups `false` — renders the whole-panel catalog-limit line and **never** renders "No accessibility features", "not available", or eleven empty rows.
- A property-scoped fact never reads, visually or to a screen reader, as a claim about the selected room or rate.
- No access-need string anywhere contains a banned word from Deliverable 4 Rule 2; grep-checkable.
- A screen-reader user can reach either panel by landmark and any need group by heading; no section carries two competing name sources.
- Neither panel's heading contains a word that claims the other's territory.

---

## Risks And Constraints

- **Provider blocker, unchanged.** Hotellook returns no `amenityEvidence` on either path (`hotellook.ts:381`, `:502`), so the shipping outcome of this line is an honest, well-scoped catalog-limit state, not real accessibility data. That is still a strict improvement over a panel that implies expaify asked. Do not fabricate data to populate the panel; do not gate the naming and state fixes on a provider arriving.
- **Widening the catalog widens the empty state.** Going from 7 to 16 ids means more `not_returned` under a provider that answers nothing. Deliverable 3's group-level collapse is what prevents this from becoming a wall of eleven "not documented" rows; it is load-bearing, not cosmetic, and must not be dropped in design for simplicity.
- **The dropped partial signal** (entrance-only step-free data) is a deliberate loss; revisit only as a provider-supplied `detail` string on `step_free_route`, never as a second id.
- **Two shipped defects are inherited by any redesign** — the double section-naming (`HotelCard.tsx:280`-`285`) and the inconsistent heading/landmark structure across sibling detail blocks (F4). The first is inside this line's panels and must be fixed here; the second spans blocks this ticket does not own and needs its own ticket.
- Non-negotiables hold: normalization stays in `lib/providers`; components never parse vendor accessibility vocabulary; adapters return `Result<T>`; money stays integer cents; secrets from env; outbound hotel deeplinks keep affiliate markers.

## Out Of Scope (flagged for later tickets)

- **Accessibility filter UI** — gated on data existing. A filter over an all-`not_returned` catalog returns empty results and destroys trust faster than no filter. Owned by `hotel-amenity-fit` / `DealFeed` filter pills when data exists.
- **Accessibility in Deal Score** — no approved hotel-fit scoring model; must not conflate price percentile with usability.
- **Provider integration** — contingent on a provider that documents accessibility. Hotellook does not.
- **`accessible_booking_path`** (new flag from Deliverable 1) — the accessibility of the provider's own booking flow. Real user value, but it is not a property fact and cannot carry `scope`; belongs on the provider-handoff surface as its own ticket.
- **Doorway clearance** (new flag from Deliverable 1) — needs a dimension-bearing row and a provider that returns dimensions; must never ship as a boolean.
- **Normalizing heading and landmark semantics across all expanded-detail blocks** (finding F4) — spans Quality evidence, Location, Price scope, and Provider handoff, which this ticket does not own.

## Handoff

Create `UXDES-HOTEL-ACCESSIBILITY-NEEDS-01` (UX Design) to produce the implementation-ready spec for the two-panel split — **Accessibility features** (need-grouped, 11 access-need ids, `requestable` structurally excluded) and **Room requests & parking** (5 ids, unchanged semantics) — including the group-level catalog-limit state, every string named in the acceptance criteria, and the 375px/1280px and screen-reader behaviour for each state. Instruct UXDES to inherit `docs/pipeline/accessibility-stay-fit/02-research.md` and this brief together, and to treat this brief as superseding it only on the four points reconciled above.
