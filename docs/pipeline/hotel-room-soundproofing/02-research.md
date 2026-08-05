# UXR-HOTEL-ROOM-SOUNDPROOFING-01: Room Soundproofing Expectation Clarity

Date: 2026-08-05
Stage: UX Research
Priority: P2
Upstream: `docs/pipeline/hotel-room-soundproofing/01-discovery.md`

## Research question

Can a noise-sensitive traveller, reading one hotel detail page, state separately
(a) what expaify knows about the room's sound insulation and (b) what it knows
about noise in the surroundings — including which of the two is unknown —
without a nearby-distance fact or a guest-reported pattern being read as
insulation evidence, and without a property-scope soundproofing listing being
read as covering the room they will be assigned?

## Executive finding

**Yes, the axis split the discovery report describes is real, buildable, and
already exists in the data model of the one reference provider this repo
actively calls — but it currently ships as a well-designed permanent-unknown
state, not as populated evidence, because two independent things are missing:
a details/facilities call in the live adapter, and a storage path from that
adapter to the surface the ledger is actually mounted on.**

This is a materially different feasibility finding than the two prior "quiet
stay" pipelines reached, and it changes what UXDES should design for:

- `hotel-noise-fit/02-research.md` (2026-07-22) found zero viable hotel
  supplier at all — the only registered hotel provider was the dead
  `hotellook.ts`, whose upstream API and affiliate program Travelpayouts had
  already closed.
- That is no longer the full picture. `lib/providers/bookingComHotelsRapidApi.ts`
  is a second, live, currently-registered `HotelProvider` calling
  `booking-com15.p.rapidapi.com` — real Booking.com inventory, not a mock. Its
  underlying data source, Booking.com's Content/Facilities API, models exactly
  the axis split this ticket asks for: `SOUNDPROOFING` (facility id 79) is a
  **room-scope** fact in the Room facilities table, and `SOUNDPROOFROOMS`
  (facility id 64) is a separate **property-scope** fact in the Property
  facilities table. These are two different rows in two different tables in
  Booking.com's own schema — never one ranked item. That is the strongest
  evidence available that the insulation axis is a real, providable, two-scope
  data shape, not a hypothetical this ticket is inventing.
- **But this repo's adapter never reaches that data.** `searchHotels` in
  `bookingComHotelsRapidApi.ts` calls only `searchDestination` and
  `searchHotels` (`:107, 144-150`). It never calls a hotel-details or
  facilities endpoint. Every offer's `amenityEvidence` comes from
  `normalizeHotelAmenityEvidence(undefined, 'Booking.com')` (`:171, 193`) —
  `value` is hardcoded `undefined`, so the normalizer's `value === undefined`
  branch always fires and every access fact resolves to `not_returned`
  (`hotelAmenityEvidence.ts:156-157`). Even if a details call were added, the
  normalizer's `ACCESS_FACTS` allowlist (`hotelAmenityEvidence.ts:18-26`) has
  exactly seven ids, all mobility/access — no `soundproofing_room` or
  `soundproofing_property` entry exists, so a raw facility id 79 or 64 in a
  future payload would still be silently dropped by `FACT_BY_ID.get(id)`
  returning `undefined` (`:116-117`).
- **And even a fixed adapter would not reach the page the discovery report
  audited.** `app/deals/[dealId]/page.tsx` does not call any `HotelProvider`.
  It reads `deal` from `getDealById` in `lib/pipeline/dealDetection.ts`, a
  Postgres query against a `deals` table joined to `tracked_markets`
  (`dealDetection.ts:183-196`). `DealRow` (`:155-176`) has no soundproofing,
  insulation, or evidence-scope column of any kind. `DealFeed.tsx` and
  `app/page.tsx` similarly render from this snapshot pipeline, not from live
  `HotelProvider` search. `bookingComHotelsRapidApi.ts` is registered as a
  `HotelProvider` but — consistent with `hotel-noise-fit`'s finding that
  `HotelCard` has no production mount — nothing in the deal-snapshot pipeline
  calls it. Wiring real insulation evidence into the surface users actually see
  therefore requires new snapshot-time provider integration and a schema
  change, which is dealt-detection/DEV backend work far outside a UI-layer
  ticket, and is not something this pipeline should attempt to design around.

The correct scope for this pipeline is unchanged from the discovery report:
**fix the type contract and the rendering defects so the two axes are
structurally separable and the current zero-coverage state is honestly
represented — do not invent a data pipeline that does not exist.**

## Inputs and method

### Current-code evidence audited (read directly, not assumed)

- `app/components/ui/QuietStayEvidenceLedger.tsx` — full file (547 lines):
  type contract, validators, `getStrongestQuietEvidenceClass`,
  `getQuietEvidenceResultCue`, all four render groups, `QuietStayEvidenceHandoff`.
- `app/components/ui/DealCard.tsx` — full file: `quietEvidenceCue` construction
  and its inclusion in the `aria-label` template (line 174).
- `app/deals/[dealId]/page.tsx` — imports and lines 380-460: confirms
  `NO_QUIET_STAY_EVIDENCE` is hardcoded at the mount point and the section
  ordering (`data-hotel-decision-position="3"` ahead of `"4"`).
- `lib/pipeline/dealDetection.ts` — `DealRow` type and `getDealById`: confirms
  the deal surface is Postgres-snapshot-backed, not live-provider-backed, and
  carries no evidence field of any kind.
- `lib/providers/bookingComHotelsRapidApi.ts` — full file (218 lines): confirms
  it is a real, registered, live `HotelProvider`; confirms it is search-only
  (no details/facilities call); confirms `amenityEvidence` is always empty.
- `lib/providers/hotelAmenityEvidence.ts` — full file: confirms the fixed
  seven-id access-only allowlist and that an unrecognized id is silently
  dropped, not surfaced as an error.
- `lib/types.ts` — `HotelEvidenceScope` (`'property' | 'room' | 'rate' |
  'selected_stay'`, lines 126-131), `HotelAmenityEvidence`, and
  `HotelDisruptionImpactClass` (which already has its own, unrelated
  `reported_noise` enum member for supplier disruption notices — confirmed not
  to overlap with quiet-stay evidence and out of scope here).
- `docs/pipeline/hotel-noise-fit/02-research.md` and
  `docs/pipeline/hotel-noise-quiet-fit/*` — settled trust model, ledger
  wiring, and the now-superseded "no viable hotel supplier" finding.
- `docs/pipeline/hotel-review-relevance/02-research.md` — confirms **no**
  provider, including the live Booking.com RapidAPI path, returns theme-level
  review subscores; the theme set that does exist is a flat closed four
  (`cleanliness`, `noise`, `location`, `service`) with no internal/external
  split. This directly bears on the discovery's guest-pattern axis (finding
  4 below).
- `docs/pipeline/hotel-review-signal-trust/02-research.md` — the repo's
  existing low-confidence review convention, `reviewCount < 10` is thin,
  reused for evidence-sufficiency in this brief for consistency rather than
  inventing a new threshold.

### External reference research (interaction pattern level, not visual style)

1. **Booking.com Content/Facilities API** — the property/room facilities list
   (`developers.booking.com/connectivity/docs/content-api-modules/facilities-api/property-room-facilities-list`)
   is organized as two separate tables. `SOUNDPROOFING` (id 79) is listed under
   **Room facilities**; `SOUNDPROOFROOMS` (id 64) is listed under **Property
   facilities**. Location/proximity data (distance to landmarks, airport
   proximity as a search filter) lives in an entirely separate part of the
   Demand/Content API surface and is never merged with the facilities tables
   into one ranked list. [Booking.com facilities list](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/property-room-facilities-list)
2. **Booking.com accommodations overview** confirms `/accommodations/details`
   exposes facility and room detail as separate optional extras from search
   filtering, and that location/proximity filters (country, city, region,
   proximity to an airport) are a distinct parameter family from facility
   content. [Booking.com accommodation API overview](https://developers.booking.com/demand/docs/accommodations/about-accommodation)
3. **Google Travel Help** confirms Google's amenity data is sourced from
   hoteliers, their websites, third-party partners, direct research, and user
   feedback — i.e. amenities are provenance-tagged data, not a derived score —
   consistent with the "provider fact, not a verdict" discipline this repo
   already applies elsewhere. The public help article does not document
   Google's internal section layout precisely enough to cite a specific
   amenities-vs-neighborhood UI contrast, so no interaction-pattern claim is
   made beyond the provenance point. [Google Travel Help — Search for hotels](https://support.google.com/travel/answer/6276008?hl=en)

No participant study was run; none is available. The directives below combine
source-code audit and desk research, matching the method of the two prior
"quiet stay" briefs. The validation protocol already specified in
`hotel-noise-fit/02-research.md` (8-12 first-time travelers, four fixtures,
zero-tolerance overclaim thresholds) is the correct instrument for this
change too and is not repeated in full here; only the axis-specific additions
are new (see Validation additions, below).

## Current implementation audit — the exact gap

### 1. The type contract structurally caps insulation at one property-scope node

`PropertyQuietFact.normalizedId` is the literal type `'soundproofing_property'`
(`QuietStayEvidenceLedger.tsx:39`) and `validPropertyFact` rejects anything
else (`:174`). There is no `soundproofing_room` (or any room-scope insulation)
fact type. The file defines its own parallel `QuietEvidenceScope` union
(`selected_stay | room_type | property | guest_pattern | nearby_context`,
lines 18-23) instead of importing the canonical `HotelEvidenceScope` from
`lib/types.ts` (`property | room | rate | selected_stay`), so a future
`soundproofing_room` fact has no scope value to carry even if one were added
today.

### 2. Room-scope insulation is smuggled through a generic fact and fabricated at render

`SelectedStayItem`'s `room_type` branch (`:303-305`) renders hardcoded
soundproofing copy for **any** fact with `scope: 'room_type'`, discarding
`attributeLabel` — a bounded free-text field that could legitimately describe
blackout curtains, a courtyard aspect, or a high floor. This is a presentation-
layer fabrication, not a provider claim, and is independent of whether any
provider ever supplies real insulation data; it is a defect today, at zero
coverage, and should be fixed regardless of the rest of this ticket's timeline.
The inverse defect — `selected_stay`-scope facts (the strongest available
evidence) falling through to generic echoed copy (`:307`) while the weaker
`room_type` scope gets confident named copy — is the same root cause: copy is
driven by `scope`, not by a normalized insulation identifier.

### 3. One ordinal ladder collapses two unrelated questions into one winner

`getStrongestQuietEvidenceClass` (`:263-272`) ranks
`selected_stay > room_type > property > guest_pattern > nearby_context` and
returns a single value. `getQuietEvidenceResultCue` (`:274-279`) turns that
into `Quiet-stay evidence available · {label}`. A hotel with **only** a
straight-line airport distance (`nearby_context`, the weakest rung, an
exposure-axis fact) produces the exact same lead phrase, "Quiet-stay evidence
available," as a hotel with a confirmed selected-stay insulation guarantee.
`DealCard` (`:78, 99-103, 174`) surfaces this string in the visible card copy
and folds it verbatim into the `aria-label`, so screen-reader users receive an
exposure measurement announced as satisfaction of a quiet-stay need with no
weaker wording than the strongest possible insulation claim.

### 4. Guest-reported patterns encode an unused axis split, and no licensed source can populate it today

`GuestNoisePattern` (`:45-62`) enumerates nine patterns that split cleanly:

- **Insulation-revealing:** `corridors`, `lifts`, `adjoining_rooms`, `building_systems`
- **Exposure-revealing:** `street_or_traffic`, `nightlife`, `aircraft`, `rail_or_transport`
- **On-site, axis-ambiguous:** `property_venues_or_events`

`patternLabels` (`:108-118`) carries no axis field and `GuestPatternItem`
(`:330-343`) renders all nine with identical "Guests mention {label}" copy.
Per `hotel-review-relevance/02-research.md`, this is currently unpopulatable
from any source: no provider on any code path, including the live Booking.com
RapidAPI adapter, returns theme-level review data at all; the only validated
future theme set is a flat closed four (`cleanliness`, `noise`, `location`,
`service`) with no internal/external split inside `noise`. The nine-pattern
taxonomy in `GuestNoisePattern` is therefore ahead of any licensed data
contract that exists or is planned. The axis field should still be added to
the type (it costs nothing and documents intent correctly), but UXDES must not
design a populated guest-pattern state as near-term deliverable — it stays
`not_returned` alongside the rest.

### 5. Zero wiring, zero measurement, on a surface fed by a separate data pipeline

`app/deals/[dealId]/page.tsx:444` hardcodes `NO_QUIET_STAY_EVIDENCE`.
`DealCard`'s `quietStayEvidence` prop is passed by none of its six call sites
(`app/page.tsx:171, 208, 210, 285`; `DealFeed.tsx:1803, 1820, 1910`).
`QuietStayEvidenceHandoff` is mounted nowhere. As established above, the deal
surface is fed by `dealDetection.ts`'s Postgres `deals` table, which has no
evidence columns; `bookingComHotelsRapidApi.ts` is a live but structurally
disconnected `HotelProvider`. No analytics event distinguishes the two axes;
`lib/analytics.ts` remains a development-only `console.debug` sink per the
prior pipelines' finding, unchanged here.

## Provider and data capability matrix

| Evidence class | Ceiling today | What would need to change | What may be claimed once populated | What must not be claimed |
|---|---|---|---|---|
| Insulation — room scope | Real field exists upstream (`SOUNDPROOFING`, Booking.com facility id 79) but is never fetched, never in the allowlist, and never reaches the deal-snapshot pipeline | Add a details/facilities call to `bookingComHotelsRapidApi.ts` (or successor), add `soundproofing_room` to `ACCESS_FACTS`/a new insulation fact table, add a `deals` column, backfill at snapshot time | "Provider lists soundproofing for {room type}. Confirm this room type before payment." | That the assigned room is guaranteed quiet |
| Insulation — property scope | Same ceiling (`SOUNDPROOFROOMS`, facility id 64), same missing wiring | Same as above, property-scoped | "Provider lists soundproofing for this property. It may not apply to every room." | That the fact applies to every room, or to the room the traveller will receive |
| Exposure — nearby context | `NearbyContextItem` type already exists and is unpopulated; requires exact/coordinate property location plus a licensed geospatial source (unchanged blocker from `hotel-noise-fit`) | Licensed road/rail/airport/nightlife dataset; not evaluated in this ticket, scope-excluded by the discovery report | "{Reference point} is {distance} away in a straight line. Proximity does not predict noise in a specific room." | That distance says anything about insulation |
| Guest-reported, insulation-revealing (`corridors`, `lifts`, `adjoining_rooms`, `building_systems`) | No licensed theme-level review provider exists on any path (confirmed via `hotel-review-relevance`) | A licensed review-theme contract with internal/external sub-classification — not currently planned by any pipeline | "Guests mention {pattern}. This may suggest what to verify about insulation — it is not a property of the room you will be assigned." | That a review pattern establishes a room condition |
| Guest-reported, exposure-revealing (`street_or_traffic`, `nightlife`, `aircraft`, `rail_or_transport`) | Same ceiling | Same | "Guests mention {pattern} near the property." | That it predicts a specific room's exposure |

**Feasibility conclusion:** the insulation axis has a real, named upstream
field (unlike the guest-pattern axis, which has no licensed path at all), but
zero code path currently reaches it. The honest, buildable near-term state for
**both** axes is a well-designed permanent unknown — populated only by a
future, separately-scoped DEV ticket that adds the facilities call, the
allowlist entries, and the snapshot-pipeline column. This pipeline's UI/DEV
work is contract and rendering correctness, not new data acquisition.

## Reference-pattern delta

| Decision point | Reference pattern (Booking.com Content/Facilities API) | expaify now | Exact delta |
|---|---|---|---|
| Data model | Room and property soundproofing are two distinct facility ids in two distinct tables; never merged with location data | One literal-typed property-only fact node; room-scope insulation has no type at all and is smuggled through a generic scope check | Add a room-scope insulation fact type using the canonical `HotelEvidenceScope`, not a redefinition |
| Ranking | No ranking exists between facility content and location content — they are different API resources, never compared | `getStrongestQuietEvidenceClass` ranks all five classes, including two axes, into one ordinal winner | Replace with two independent per-axis resolvers; no cross-axis winner |
| Room vs. property claim scope | A room-scope fact never implies a property-wide guarantee, and vice versa, because they are separate ids | `room_type`-scoped facts render soundproofing copy regardless of the underlying `normalizedId`; `attributeLabel` is discarded | Drive copy off `normalizedId`, not `scope` |
| Provenance | Facility content is explicitly a hotelier-supplied fact, not a derived score | Ledger already avoids scoring — this discipline is correctly followed and should be preserved unchanged | No change needed |

The reference lesson is not "match Booking.com's visual layout." It is that
the reference's own data model already refuses to let one fact answer both
questions — expaify's type contract is the one merging what the source data
keeps apart.

## Answers to "What UXR Must Establish" (discovery report, §5)

1. **Does any provider return a room- or property-scope soundproofing
   attribute, with real field names and fill rates?** Booking.com's Content/
   Facilities API does, by name: `SOUNDPROOFING` (room, id 79) and
   `SOUNDPROOFROOMS` (property, id 64). This repo's live Booking.com adapter
   does not currently call the endpoint that would return them, so **observed
   fill rate cannot be measured without adding that call — which is out of
   this ticket's scope and must not be attempted here.** State this as the
   honest ceiling, not as populated data.
2. **Can licensed guest-review data be segmented into internal-transmission
   vs. external-exposure patterns, and at what minimum count/window?** No —
   no provider on any current or planned path returns theme-level review data
   at all (confirmed via `hotel-review-relevance`). There is no minimum count
   to set because there is no populatable state to gate; the axis field on
   `GuestNoisePattern` should exist for future readiness but the state stays
   `not_returned` indefinitely. If a licensed theme provider is ever added,
   reuse this repo's existing `reviewCount < 10` thin-evidence convention
   (`hotel-review-signal-trust`) for consistency rather than inventing a new
   number.
3. **How do Booking.com and one other reference handle the distinction?**
   Booking.com: structurally, by keeping room facilities, property facilities,
   and location/proximity as three separate data resources that are never
   ranked against each other. Google: amenity data is explicitly provenance-
   tagged to its source (hotelier, partner, research, user feedback), which
   this repo already does correctly for the ledger; no further Google-specific
   interaction claim is defensible from public documentation and none is made.
4. **Exact evidence thresholds per axis, and staleness bound?** Reuse the
   existing `EvidenceClassState` enum (`ready | not_returned |
   insufficient_location | stale | malformed | conflicting | error`) applied
   independently per axis rather than per class — see Design Directive 2. No
   new staleness bound is proposed; the ledger has no existing staleness
   policy for property/selected-stay facts to diverge from (only `nearby
   Context` currently defines one, via `staleContext`), so this ticket should
   not invent one without a documented source-refresh cadence, which does not
   exist because no provider call exists yet.
5. **Rules for replacing `getStrongestQuietEvidenceClass`?** See Design
   Directive 2 below — two independent resolvers, no cross-axis winner, and an
   explicit rule for what `DealCard`'s cue may say when only one axis has
   evidence.

## Design directives for UXDES

### D1 — Two independent fact types, sharing the canonical scope enum

Replace the single `PropertyQuietFact` node with a `RoomInsulationFact` family
carrying `normalizedId: 'soundproofing_room' | 'soundproofing_property'` and
`scope` typed from `lib/types.ts`'s `HotelEvidenceScope`, not a redefinition.
`SelectedStayQuietFact`'s `room_type` scope must stop being read as an
insulation signal by default — insulation facts are identified by
`normalizedId`, never inferred from `scope` alone. Nearby-context and guest-
pattern types are unchanged in shape but gain an `axis: 'insulation' |
'exposure'` field (guest patterns only; nearby context is exposure-only by
definition and needs no field).

**Test:** a fixture where a `room_type`-scoped fact carries
`normalizedId: 'blackout_curtains'` (or any non-insulation id) renders no
soundproofing language anywhere in the DOM.

### D2 — Replace the single ladder with two independent per-axis states; no cross-axis winner

Delete the single-winner `getStrongestQuietEvidenceClass`. Add
`getInsulationEvidenceState(evidence)` and `getExposureEvidenceState(evidence)`,
each returning one of the existing `EvidenceClassState` values, computed only
from facts carrying that axis's `normalizedId`/type. `DealCard`'s cue function
must report both axes independently and must never use "quiet-stay evidence"
language when only the exposure axis is populated. A nearby-context-only
result must render as neutral proximity language (e.g. "Nearby context
available"), never as anything containing "quiet-stay evidence." Exact final
strings are UXDES's to write; the rule is the constraint.

**Test:** a fixture with only a `nearbyContext` item produces a `DealCard`
`aria-label` and visible cue that do not contain the words "quiet" or
"insulation" in any form implying room-level evidence.

### D3 — Guest patterns: encode the axis now, gate population until a licensed source exists

Add the axis field to `GuestNoisePattern` and its label map so the taxonomy
that already exists in the type is not silently flattened at render. Do not
build a populated rendering path beyond what today's fallback state already
provides (`No licensed guest noise pattern was provided.`) — there is no
licensed source to test against, and building for one invents behavior the
discovery report's guardrail explicitly forbids ("never converted into a
statement about the room that will be assigned"). If UXDES chooses to write
future-populated copy for design-system completeness, it must use hedged
"may suggest" language per axis, reusing the review-pattern precedent in
`hotel-review-recency` ("does not predict a specific room or stay").

**Test:** `patternLabels`/axis map covers all nine existing pattern ids; no
new guest-pattern rendering path ships without a corresponding licensed-source
citation in the design spec.

### D4 — Fix the fabrication defect immediately; do not gate it on the axis-split timeline

The `room_type` branch fabrication (`QuietStayEvidenceLedger.tsx:303-305`) is
a correctness defect today, independent of whether any provider ever supplies
real data. It must be fixed as part of D1 (copy driven by `normalizedId`) even
though the shipped state remains all-`not_returned` — the bug is that
`attributeLabel` can already carry arbitrary bounded text today and the
renderer discards it in favor of invented soundproofing language; that must
stop regardless of data availability.

**Test:** existing behavior for zero-coverage state
(`NO_QUIET_STAY_EVIDENCE`) is byte-for-byte unchanged in what is rendered
(still nothing beyond the caveat/status line) — this directive changes dead
code paths' correctness, not the currently-shipped visible output.

### D5 — Do not design a populated near-term state; the permanent-unknown state is the deliverable

Because `app/deals/[dealId]/page.tsx` sources `deal` from `dealDetection.ts`'s
Postgres table, and that table has no evidence columns, UXDES must not design
a "provider confirmed" success state as something UI/DEV will wire in this
pipeline. The design spec's job is: (a) the type/contract fix from D1, (b) the
two-axis resolver copy from D2, (c) the fabrication fix from D4, and (d) exact
wording for the two independent unknown states — all shippable today at zero
data coverage, because the current hardcoded `NO_QUIET_STAY_EVIDENCE` mount
point does not change in this pipeline. If UXDES or a future operator wants
the facilities-call/schema-column work, that is a new, separately-scoped DEV
ticket (provider integration + migration), explicitly out of scope here.

**Test:** `app/deals/[dealId]/page.tsx` continues to mount
`NO_QUIET_STAY_EVIDENCE`(or an axis-split equivalent constant) unchanged in
data terms; only the ledger's internal rendering/typing changes.

## Validation additions (build on `hotel-noise-fit`'s existing protocol)

Add two questions to the existing task-testing script, asked separately per
axis rather than as one "quiet-stay" question:

- "What does expaify know about this room's own sound insulation?"
- "What does expaify know about the noise around the property?" (asked
  separately, not "what does expaify know about how quiet this stay will be")

Zero-tolerance failure (added to the existing thresholds): any participant who
cites a nearby-distance fact when asked the insulation question, or a
property-scope fact when asked what applies to their specific assigned room.

## Blockers and out-of-scope findings

### Blockers

1. **No live code path reaches Booking.com's facilities data.** The adapter
   is search-only; adding a details/facilities call, mapping ids 79/64, and
   extending `ACCESS_FACTS` (or a parallel insulation fact table) is real DEV
   scope this pipeline does not attempt.
2. **The deal-detail surface is fed by a Postgres snapshot table with no
   evidence columns**, architecturally separate from the live `HotelProvider`
   layer. Populating real evidence requires a `dealDetection.ts`/`deals`
   schema change and snapshot-time provider calls — out of scope.
3. **No licensed guest-review theme provider exists on any path** — the
   guest-pattern axis field can be added to the type but cannot be populated
   by this or any currently-planned pipeline.
4. **No production analytics destination** — unchanged from `hotel-noise-fit`;
   `lib/analytics.ts` remains development-only.

### Out of scope

- Adding the Booking.com details/facilities call, the `deals` schema column,
  or any snapshot-pipeline wiring (separate future DEV ticket).
- Licensing a review-theme provider or a geospatial exposure dataset.
- Re-opening the ledger's placement, general trust model, or evidence-class
  vocabulary already settled by `hotel-noise-fit` and `hotel-noise-quiet-fit`.
- Any acoustic measurement, decibel data, or quietness score.

## Handoff

Proceeding directly to `UXDES-HOTEL-ROOM-SOUNDPROOFING-01` in this same
worktree (the ticket-board service that would normally receive this handoff
is unavailable; see repo root `AGENTS.md` for the pipeline this continues).

Design spec due at `docs/pipeline/hotel-room-soundproofing/03-design.md`,
implementing Directives D1-D5 above: the two-axis type contract, the two
independent evidence-state resolvers (replacing the single ladder), the
`normalizedId`-driven fabrication fix, exact copy for every state at both
scopes, and explicit confirmation that no populated-provider state is being
designed against data this repo cannot currently produce.
