# UX Research: Hotel Neighborhood Context

**Ticket:** UXR-HOTEL-NEIGHBORHOOD-CONTEXT-01 · Stage: UXR (Research) · Priority: P1
**Upstream:** `docs/pipeline/hotel-neighborhood-context/01-discovery.md`
**Surface:** live-search hotel results (`app/components/HotelCard.tsx`) → expanded detail → booking handoff
**Date:** 2026-07-30

---

## 0. Method and scope

Every claim in §1–§2 was verified by reading source in this worktree; file:line references are exact.
§3 is competitive pattern analysis from interaction-pattern teardown, explicitly separated from
what expaify's data can reproduce. §4 answers the four open questions from discovery §7. §5 is the
directive set UXDES must implement.

Not re-derived (per ticket): precision vocabulary and `getHotelLocationDisplay()`
(`hotel-location-decision-context`), anchor/distance evidence model (`hotel-location-pin`), noise
(`hotel-noise-fit`), deal-feed and city-page surfaces (`hotel-location-fit`, `neighborhood-fit`).

---

## 1. Current implementation audit

### 1.1 What the surface renders today

| Where | Code | What the user sees |
|---|---|---|
| Collapsed card | `HotelCard.tsx:733`, `:882-887` | Two lines only: `location.label`, `location.value`. **No distance line, no note.** |
| Expanded detail | `HotelCard.tsx:1004-1016` | `Location` panel: `label: value`, `note`, and `distanceText` when present. |
| Derivation | `hotelLocationContext.ts:37-96` | Five precision branches → `{label, value, note, precision, isWarning, distanceText}`. |
| Distance | `hotelLocationContext.ts:24-35` | `"{n} mi from {anchor.name}"`, gated by `hasVerifiedHotelLocationComparison`. |

**Confirms discovery §2:** expanding the card adds a `note` and possibly one distance line and nothing
else about surroundings. The Location panel is the only panel in the expanded card with no
source/scope/confidence structure comparable to amenity, parking, funds, or rate-eligibility
evidence.

**New finding (not in discovery):** the collapsed card does **not** render `distanceText` at all
(`:882-887`). The discovery describes the card as carrying "an optional distance line"; it does not.
Distance appears only when expanded. So on the comparison surface where the decision actually
stalls, the entire spatial payload is a label and a string.

### 1.2 The anchor inventory is one anchor, not many — discovery F-1 is partly wrong

Discovery F-1 claims multi-anchor distance is "derivable today, honestly, with zero new providers."
That is not correct in this codebase.

- `HotelLocationAnchor` supports four kinds (`lib/types.ts:390`), but exactly **one** producer of a
  coordinate-bearing anchor exists: `getSearchLinkedAirportAnchor()` (`lib/airports/resolve.ts:78-103`),
  `kind: 'airport'`, `source: 'search_linked'`.
- `app/api/search/route.ts:400-404` passes exactly that one anchor —
  `getSearchLinkedAirportAnchor(destIATA)` — for the whole hotel search.
- `HotelSearchContext` holds a single optional `anchor` (`lib/types.ts:421-423`); the adapter attaches
  it per offer (`hotellook.ts` → `applySearchContext`).
- The searched destination itself **carries no coordinates**: `HotelDestination`
  (`HotelDestinationCombobox.tsx:23-30`) is `provider / locationId / locationType / name / parentLabel /
  fullLabel / parent`. A user who searches the district "Shoreditch" or a landmark gives us a *name*,
  not a point. It cannot become an anchor.
- There is no city-center, landmark, or venue coordinate table anywhere in the repo.

**Consequence:** "distance from multiple anchors" requires new coordinate data — a landmark/city-center
dataset behind `lib/providers` — which puts it on the same side of the line as POI data, not the free
side. UXDES must not spec a multi-anchor list or an anchor picker.

**Second consequence, worse for the ticket's user:** the one anchor we do have is the *destination
airport*. "8.2 mi from Los Angeles International (LAX)" is a logistics fact. For the first-time
visitor in discovery §2, it is close to useless as an area cue — plenty of good neighborhoods are far
from the airport and plenty of bad ones are near it. The single largest honest spatial fact expaify
holds does not answer the question this ticket asks.

### 1.3 What *is* free: intra-result-set geometry

The one claim in F-1 that survives audit — and that no prior ticket has taken — is **comparison of
result-set members against each other**. It needs no anchor, no external data, and no new provider:

- Property coordinates survive both the live path (`hotellook.ts:99-150`, `precision: 'exact' | 'coordinates'`
  carry `lat`/`lng`) and the 6h cache path (`hotellook.ts:191-194` preserves `lat`/`lng`).
- `calculateStraightLineDistanceKm()` (`lib/hotels/locationEvidence.ts:35-51`) is already exported, pure,
  and validated; it takes any two coordinate pairs, not just property↔anchor.
- The whole offer array arrives together (`route.ts:406-408`, one `hotels` event with `offers` + page),
  so the result set is available on the client at render time.

From that, two honest facts are computable with zero new data:
1. **Clustering** — how many of the currently-shown properties sit within a given radius of each other.
2. **Isolation** — whether this property sits apart from that cluster, and by how far.

Both are statements about *our own result list*, not about the city, so neither can be a fabricated
area claim. This is the material for D-1.

**Edge case UXDES must handle:** coordinate coverage is uneven within a set. `precision: 'exact'` is
assigned from an address alone (`hotellook.ts:110-120`) — an exact-address property can have **no
lat/lng**. So a result set legitimately mixes offers that can be compared and offers that cannot, and
the comparable subset can be smaller than the visible set.

### 1.4 Provider place name: the string is not a neighborhood

`normalizeHotelLocation()` sets `area` and `providerLocationName` from `entry.location.name`
(`hotellook.ts:103, 117, 139`) — an unvalidated provider string. `getHotelLocationDisplay()` renders it
as the `value` for both `coordinates` and `area` precision (`hotelLocationContext.ts:59, 70`). When the
provider returns nothing, the adapter falls back to the *searched* string with
`precision: 'search_area'`, `source: 'search_fallback'` (`hotellook.ts:143-149`) — the user's own query
echoed back as a location.

Today this is safe because the surrounding copy is precision-scoped ("Area", "Provider supplied an
area, not a street address"). It stops being safe the moment a block labelled *Neighborhood* renders
the same string, because the label converts a provider token into a claim about area character. This
is discovery F-3's failure mode reachable with no new data at all.

### 1.5 Measurement: discovery §3.2 has an inverted premise, and a bigger blocker sits behind it

**Correction:** `lib/analytics.ts` is **not** development-only. `track()` short-circuits to
`console.debug` *in development* (`analytics.ts:63-66`) and in production posts to `/api/analytics`,
which inserts into `analytics_events` in Postgres (`app/api/analytics/route.ts:259-260`). Session id is
stamped per event (`analytics.ts:8-23`). Production instrumentation exists and is durable.

**The actual blocker is larger.** `HotelCard` has **no production consumer**. Searching `app/` for
imports returns only the component's own file and its tests; no page, route, or layout renders it.
`/api/search` streams `hotels` events (`route.ts:406-408`) that nothing in `app/` consumes. Likewise
`HotelDecisionAnalytics` is mounted only on `app/deals/[dealId]/page.tsx:453` — the deal-detail
surface, which this ticket explicitly excludes. `HotelCard.tsx` contains no
`data-hotel-decision-section` attribute at all.

So: there is no live-search baseline for *any* hotel metric, not because analytics is dev-only, but
because the surface is not mounted. Every acceptance criterion phrased as a change against a current
live-search baseline is unverifiable, and will stay unverifiable until the results surface is mounted.
UXDES must phrase acceptance as **state-and-rule assertions verifiable by component test and manual
trace**, and specify instrumentation as *ready-to-emit* rather than as a measured target.

---

## 2. Data inventory — the honest line

| Cue | Status | Evidence |
|---|---|---|
| Property coordinates | **Have**, unevenly (address-only offers lack them) | `hotellook.ts:99-150, 191-194` |
| Provider place-name string | **Have**, unverified, sometimes the user's own query | `hotellook.ts:103,117,139,143-149` |
| Distance to destination airport | **Have**, one anchor, verified | `resolve.ts:78-103`, `locationEvidence.ts:96-120` |
| Distance to city center / landmark / venue | **Do not have** — no coordinate source | `lib/types.ts:390` (kinds exist, producers do not) |
| Position relative to other results | **Derivable now, free** | `locationEvidence.ts:35-51` + `route.ts:406-408` |
| Land-use character, walkability, transit, food, groceries, safety | **Do not have**, requires POI provider | no provider, table, or cache key exists |
| Street network / walk time / routing | **Do not have** — every distance is `method: 'straight_line'` | `lib/types.ts:402-407` |

---

## 3. Competitive teardown — pattern vs. data

Booking.com and Google Hotels both answer the neighborhood question, and both do it on datasets
expaify does not have. Separating the two:

| Their pattern | What powers it | Reproducible here? |
|---|---|---|
| **Map view as a peer of the list**, with the whole result set plotted and price pins; selecting a pin selects the card | Map tiles + result coordinates | **Pattern: partly. Data: partly.** We have the coordinates; we have no tile provider, and adding one is a `lib/providers` decision. The *relative* insight the map delivers — who is clustered, who is out on their own — is reproducible **without tiles**. This is the single most valuable borrow. |
| **"Top location" / area score** (Booking: "Guests loved walking around this area — 9.1") | Mined review text + POI density | **No.** No review text in the model; `HotelRatingEvidence` carries a numeric rating only. Fabricating this is exactly F-3. |
| **"What's around" / "In the area"** — categorised POI lists with distances (restaurants, transit, landmarks) | POI dataset | **No.** Needs a POI provider. |
| **Neighborhood chips as filters** ("Downtown", "Near the beach") | Named area polygons | **No.** We have unvalidated point strings, not polygons; a chip would imply verified membership. |
| **Distance-to-multiple-landmarks list** on the property page | Landmark coordinate set | **No** (see §1.2). Not free, contrary to discovery F-1. |
| **Transit/walk time badges** ("5 min walk to Metro") | Routing engine | **No.** All distance is straight-line by type. |
| **Explicit "why this area" framing at the top of the location block** — a one-line orientation before the details | Editorial + POI | **Pattern only, no data.** Borrow the *slot* and the *hierarchy*, fill it with what we can prove or with a named gap. |

**Pattern conclusions.**
1. Both references treat location as a **comparison** problem, not a description problem. The map is
   valuable primarily because it shows properties *against each other*. That framing is free for us.
2. Both put area context in the **detail/expanded** layer and keep the list dense; neither carries area
   character on the list tile beyond one short string.
3. Neither states an area claim without an attributed basis (score, review count, POI name). Their
   restraint is a pattern too.

---

## 4. Answers to the four open questions

### Q1 — Is the derivable-only set enough to change a decision, or should this ticket defer?

**Position: ship narrow, do not defer — but ship a different cue than discovery proposed.**

Split the F-1 set by decision value:

- **Multi-anchor distance: not available** (§1.2), so it cannot carry the ticket. Struck.
- **Rank by airport distance: available but not decision-changing.** "3rd closest to LAX of 14" does
  not tell a first-time visitor whether they can get dinner. Do not ship.
- **Cluster / isolation: available and decision-changing.** "Most of the properties shown sit within
  about a mile of each other; this one is 4.5 mi from that group" changes a real decision, because
  hotel supply concentrates where demand and amenities are. A property far outside the cluster is a
  reliable signal that the traveler should look before committing — which is precisely the moment they
  currently leave the site. It is also strictly a statement about our own result list, so it cannot be
  a fabricated area claim.

That is one honest cue, not a neighborhood feature. Deferring the whole ticket behind a POI decision
would leave the surface at "a label and a string" indefinitely, and the POI decision has no owner. The
honest scope is: ship the internal-comparison cue and the named gap (Q4/D-3), and open a separate
spike for a POI source. Do **not** let UXDES spec any part of F-2.

### Q2 — Booking.com / Google Hotels: borrowable pattern vs. unreproducible data

See §3. Borrowable: comparison-first framing, the reserved orientation slot at the top of the location
block, list-tile restraint, and never claiming without an attributed basis. Not reproducible and must
be named as such in the spec: area scores, POI lists, neighborhood filter chips, walk/transit times,
multi-landmark distances, review-derived location sentiment.

### Q3 — Can property switches be attributed to area uncertainty?

**No. Drop the metric.** `hotel_detail_back_to_results` (`HotelDecisionAnalytics.tsx:135`) carries no
cause, and adding a reason dimension means asking the user why they left, which is a survey, not
instrumentation. Off-site map opens are unobservable in principle.

Replace with three observable signals, all emittable from the existing `track()` sink (which is
production-live — §1.5):

1. **Area-cue impression → handoff, same property, same session.** Existing session stamping
   (`analytics.ts:8-23`) supports the join; no new infrastructure.
2. **In-product map-affordance click rate.** The `View property pin` action specified by
   `hotel-location-pin` §3.2 is **not implemented in `HotelCard` today**. Building it converts the
   invisible off-site exit into an observable in-product event. This is the closest honest proxy for
   the "user opens a third-party map" failure mode, and it is the strongest argument for shipping the
   affordance.
3. **Hunting proxy:** ≥3 distinct `hotel_id` detail expansions in one session with no
   `hotel_room_handoff_started`. Correlational, not causal — must be labelled a guardrail, not a
   success metric.

**Hard caveat for UXDES and TEST:** none of these will produce data until the live-search results
surface is mounted (§1.5). Specify the events; do not specify a numeric target.

### Q4 — Collapsed card, expanded detail, or both?

**Both, asymmetrically — and the collapsed cue must be exception-only.**

- **Expanded detail = primary.** It already owns the `Location` panel (`HotelCard.tsx:1004-1016`) and
  the evidence-panel language. The comparison statement, the straight-line caveat, the map affordance,
  and the named gap all live here.
- **Collapsed card = one line, only when it changes the decision.** The collapsed card carries identity,
  class, guest rating, an access fact, location label, location value, and price in a 375px-constrained
  grid (`HotelCard.tsx:855-905`), and it already reflows the price below identity under 351px. A cue
  shown on every card costs density on every card. A cue shown only for the *isolated* minority costs
  density where it buys a decision. Isolation is the exception; clustered is the norm and needs no line.

---

## 5. Directives for UXDES

Each is written to be testable by component test and manual trace at 375px and 1280px.

### D-1 — Specify "position among the results shown" as the primary cue, computed from result-set geometry only

Compute from the offers currently rendered in the same result set, using
`calculateStraightLineDistanceKm` (`lib/hotels/locationEvidence.ts:35-51`) between property coordinates.
No anchor required. UXDES must define, exactly:

- the comparable subset — offers in the current set with valid `lat`/`lng` per `hasValidCoordinates`;
- a minimum comparable-subset size below which nothing renders (recommend ≥5; the statement is
  meaningless over 2–3 properties);
- the cluster rule (a radius threshold and a majority rule) and the isolation threshold, as explicit
  numbers, not adjectives;
- final copy for exactly two outcomes plus silence:
  **clustered** (expanded only), **isolated** (expanded + one collapsed line), **not computable** (render nothing);
- that every statement names its comparison set and its measurement — e.g. the sentence must contain
  both the count of properties compared and a straight-line qualifier — so it can never be read as a
  claim about the city;
- recomputation behaviour when the set changes (pagination via `nextPageToken`, sort, filter): the
  statement must recompute against the new visible set or be withdrawn, never go stale;
- suppression whenever `precision` is `search_area` or `missing`, or whenever this property has no
  coordinates, regardless of what the rest of the set has.

**Testable:** with a fixture set of 12 offers where 9 sit within 1 mi and 1 sits 5 mi out, the isolated
offer renders the isolation statement with the correct count and the 9 clustered offers render the
clustered statement; with 4 coordinate-bearing offers nothing renders; with the isolated offer at
`precision: 'search_area'` nothing renders.

### D-2 — Keep the airport anchor out of the neighborhood block, and spec exactly one anchor

The destination-airport distance (`route.ts:400-404`) is a logistics fact, not an area cue (§1.2).
UXDES must:

- keep the anchor distance in the location/pin presentation owned by `hotel-location-pin`, and not
  restate it inside the neighborhood block;
- spec **no** multi-anchor list, no anchor list UI, and no anchor picker — the coordinate data does not
  exist (§1.2), and specifying one would push DEV toward inventing a landmark dataset;
- record the multi-anchor gap explicitly as a dependency on a future coordinate-source ticket.

**Testable:** the neighborhood block's rendered text contains no anchor name and no `mi from` string;
the existing anchor line is unchanged and still appears in its current position.

### D-3 — Design the absence state as a named gap plus one honest exit — it is the majority state

Most properties will show no neighborhood claim. That is the correct outcome, and it must be designed
rather than rendered as blank space. UXDES must specify:

- a plain statement, in the expanded Location panel, of what expaify does not know — no hedging, no
  "coming soon", no marketing;
- the map affordance as the exit: `View property pin` per `hotel-location-pin` §3.2, which is **specced
  but not implemented in `HotelCard`** (§1.5). It renders only when property coordinates are valid, opens
  in a new tab, and carries the accessible name already specified there. UXDES references that spec; it
  does not redefine it;
- the absence state renders *without* the map affordance when coordinates are invalid or absent — copy
  only, never a dead control;
- absence never blocks or delays `Review hotel` or provider handoff.

**Testable:** a coordinate-bearing offer with no computable comparison renders the gap statement plus a
working pin action; an address-only offer with no coordinates renders the gap statement and no pin
action; a `search_area` offer renders the gap statement, no pin action, and no comparison.

### D-4 — Bound the density cost: one collapsed line, exception-only; everything else expanded

- Collapsed card: **at most one** additional line, rendered **only** in the isolation case from D-1.
  It must wrap rather than truncate (truncating a spatial claim mid-sentence changes its meaning), must
  not displace price or the Deal Score, and must survive the existing under-351px reflow
  (`HotelCard.tsx:889-903`) without overlap or horizontal scroll at 375px.
- Expanded detail: the neighborhood content sits inside the existing `Location` panel
  (`HotelCard.tsx:1004-1016`), after `note`, using existing tokens (`--bg-raised`, `--border`, `--text-1`,
  `--text-2`, `--text-3`, `--radius-card`). No new panel, no new card, no map embed, no new colour or
  font size.
- No focusable element is added to the collapsed card. The only new focusable element anywhere is the
  D-3 pin action in the expanded panel, with the existing visible focus ring.
- Add `data-hotel-decision-section="location"` to the expanded Location panel so the existing
  1s-at-50%-visibility observer (`HotelDecisionAnalytics.tsx:64-116`) can emit engagement when the
  surface is eventually mounted. Note it will emit nothing until then (§1.5).

**Testable:** at 375px with a 60-character hotel name and an isolated result, no overlap, no horizontal
scroll, price and Deal Score unmoved; tab order through the collapsed card is unchanged from today.

### D-5 — Forbid the provider place-name from becoming a neighborhood claim

The provider string (§1.4) may be the user's own query echoed back. UXDES must specify:

- the neighborhood block **never** renders `area`, `providerLocationName`, or `label` as a
  characterisation of the area; those strings stay where `hotel-location-decision-context` put them,
  under their existing precision-scoped labels;
- no generated or inferred adjective may appear anywhere in this block — the spec must name the banned
  vocabulary explicitly, including at minimum *central, walkable, quiet, lively, safe, up-and-coming,
  well-connected, convenient, vibrant*, consistent with `hotel-location-pin` §9.6;
- if the spec needs a heading for the block, it must not be a bare "Neighborhood", because that label
  itself asserts knowledge we lack; it must name the actual basis (a comparison among the results shown).

**Testable:** a snapshot of the rendered block for every precision tier contains none of the banned
adjectives, and contains the provider string in no branch.

---

## 6. Out of scope for UXDES — do not spec

Land-use character, walkability, transit, nearby food or groceries, safety, area scores, POI lists,
neighborhood filter chips, walk/drive times, routing, map tiles or embedded maps, and any anchor beyond
the single search-linked airport. All require data expaify does not hold. Each would need a provider
behind `lib/providers` returning `Result<T>`, which is a separate ticket's decision.

---

## 7. Dependencies and risks carried forward

1. **`HotelCard` has no production consumer** (§1.5). Everything specced here is verifiable only by
   component test and manual trace until a live-search results surface mounts it. TEST must not fail
   this work for absent live telemetry, and must not pass it on telemetry that cannot exist.
2. **`View property pin` (`hotel-location-pin` §3.2) is unimplemented in `HotelCard`.** D-3 depends on it.
   UXDES must either scope its implementation into this ticket's UI stage or declare the dependency and
   spec the copy-only absence state as the shipped state.
3. **Coordinate coverage is uneven** (§1.3): `precision: 'exact'` does not imply coordinates. Every rule
   in D-1 must gate on `hasValidCoordinates`, never on precision alone.
4. **Multi-anchor distance is not free** (§1.2), contrary to discovery F-1. If product wants it, it needs
   a landmark/city-center coordinate source ticket.

## 8. Handoff

Next stage: `UXDES-HOTEL-NEIGHBORHOOD-CONTEXT-01` — UX Design, from this brief.
