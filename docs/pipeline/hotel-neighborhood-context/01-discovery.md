# UX Discovery: Hotel Neighborhood Context

**Ticket:** UXD-HOTEL-NEIGHBORHOOD-CONTEXT-01 · Stage: UXD (Discovery) · Priority: P1
**Surface:** Live-search hotel results → `HotelCard` expanded detail → booking handoff
**Date:** 2026-07-30

---

## 0. Scope boundary — read first

Five prior tickets touch hotel location. This one is not a re-run of any of them. Downstream
stages must not re-derive their findings.

| Prior work | What it owns | Status on disk | Relationship |
|---|---|---|---|
| `hotel-location-decision-context` | Precision vocabulary + `getHotelLocationDisplay()` | 01–03 complete, **shipped** (`app/components/hotelLocationContext.ts`, `HotelLocationPrecision`) | **Reuse, do not modify.** Answers "how exactly do we know where this is?" |
| `hotel-location-pin` | `HotelLocationAnchor`, distance-to-anchor | 01–03 complete, types shipped | **Reuse.** Answers "how far is it from *my* fixed anchor?" |
| `hotel-location-fit` / `neighborhood-fit` | Deal feed, city pages, deal detail (`DealCard`) | 01–02 only | **Different surface.** Those are city-only snapshot deals; this ticket is live search. |
| `hotel-noise-fit` | Noise exposure, quiet-room evidence | 01 complete | **Adjacent, excluded.** Noise is one environmental attribute; it has its own ticket. |

**The question none of them asks, and this one does:** all prior work answers *where* the
property sits — a point, a precision tier, a distance. None answers **what that point is like to
stay in**: is this a business district that empties at 7pm, a nightlife strip, a residential
pocket, an airport service cluster? Is there food, transit, or a grocery within walking distance,
or does every trip out require a car? A traveler can know a hotel is "1.2 mi from city center"
and still not know whether stepping outside at 9pm gets them dinner or an empty parking lot.

Per the briefing's repair-mode rule, this discovery is scoped as **an audit of whether this can be
honestly answered from data expaify holds** — not as a request to build a destination guide.
§4 (F-3) records that the honest answer is mostly "not yet," which is the finding, not a failure.

---

## 1. User pain point

**A traveler comparing hotel results can see exactly where a property is but not what kind of area
it is or what is practically reachable from it, so they leave expaify to research the neighborhood
on a map or forum before they can commit to any property.**

---

## 2. Who is affected, and at what step

The affected user is a **first-time visitor to the destination with no local knowledge** —
precisely the user for whom a place name carries zero meaning. A returning traveler reads
"Fitzrovia" or "Little Havana" and knows what it means; a first-time visitor reads it as an
opaque token.

Three steps in the flow, all in live search:

1. **Result comparison** (`app/components/HotelCard.tsx:733`, `:1005-1014`). The card's Location
   region renders exactly three facts from `getHotelLocationDisplay()`: a precision label, a
   value string, a provenance note, plus an optional distance line. Two hotels at the same price
   and star rating, 0.8 mi apart, are **indistinguishable on area character** — the surface offers
   no basis to prefer one. Comparison stalls here.
2. **Detail expansion.** Expanding the card adds evidence for access, parking, smoking, funds
   policy, documents, and rate eligibility — a mature source-aware evidence model — but adds
   **nothing** about surroundings. The user expands looking for area context, finds none, and
   collapses no better informed. This is the wasted-transition step the ticket asks us to measure.
3. **Booking handoff.** `lib/booking/config.ts` serializes the same location fields forward, so the
   final expaify checkpoint before the affiliate provider repeats what the card already said. The
   area question is still open at the moment of commitment — so it gets resolved off-site, or the
   user abandons.

**Failure mode:** the user opens a third-party map in a new tab, or opens property after property
hunting for an area cue that no card carries. Both are exits attributable to area uncertainty.

---

## 3. Measurable signal that the problem exists

### 3.1 Code evidence (verified in this worktree)

- **`HotelOffer` carries no neighborhood field of any kind** (`lib/types.ts:466-497`). Location is
  a single `HotelLocation` (`:409-420`) holding `label`, `precision`, `address`, `lat`, `lng`,
  `distance`, `providerLocationName`, `area`, `source`, `anchor`. Every field answers *where*.
  None answers *what it is like* or *what is nearby*.
- **The only area word a user ever sees is a raw provider string.** The Hotellook adapter sets
  `area` from `entry.location.name` (`lib/providers/hotellook.ts:103, 117, 139`), and when nothing
  is returned, falls back to the *searched* area with `precision: 'search_area'` (`:145-147`) —
  i.e. the value shown can be the user's own query echoed back.
- **The one derived spatial fact is anchor distance**, computed straight-line by
  `withCalculatedAnchorDistance` and rendered as `"1.2 mi from <anchor>"`
  (`hotelLocationContext.ts:24-35`). Straight-line distance says nothing about what is *between*
  the two points, which is exactly what a first-time visitor needs.
- **No POI, transit, walkability, or land-use data exists anywhere in the repo.** There is no
  provider, cache key, table, or column for it. `lib/db/schema.sql` holds snapshots and a route
  baseline; nothing geographic beyond what is above.
- **Neighborhood engagement is unmeasurable today.** `HotelDecisionAnalytics` emits
  `hotel_detail_viewed`, `hotel_decision_section_reached`, `hotel_room_handoff_started`,
  `hotel_detail_back_to_results` (`app/components/HotelDecisionAnalytics.tsx:50, 98, 125, 135`).
  `hotel_decision_section_reached` fires per `data-hotel-decision-section` — so a Location-section
  dwell signal is *one attribute away*, but no event carries any location dimension. Property
  switches cannot currently be attributed to area uncertainty rather than price or rating.

### 3.2 The measurement the ticket asks for — and what it costs

The ticket asks to measure neighborhood-context engagement, map/detail transitions, and
property switches attributable to area uncertainty. Two of the three are cheap; one is not.

| Asked signal | Feasibility | Note |
|---|---|---|
| Neighborhood-context engagement | **Cheap.** Tag the Location region with `data-hotel-decision-section`; the existing 1s-at-50%-visibility observer emits it. | Needs a `precision` dimension on the event to be sliceable. |
| Detail transitions without handoff | **Already derivable.** `hotel_detail_viewed` with no `hotel_room_handoff_started` in the same `sessionId` (`lib/analytics.ts` stamps session on every event). | No new event required. |
| Map transitions (off-site) | **Not observable.** A user opening a third-party map in another tab is invisible to us. | Must be measured by proxy (in-product map-affordance clicks, once one exists) or dropped. UXR should not spec an unbuildable metric. |
| Property switches attributable to *area* | **Not attributable today.** A back-to-results event has no cause attached. | Requires either a reason dimension or a controlled comparison. UXR must resolve this or downgrade it. |

Note also that `lib/analytics.ts` is development-only, so no production baseline exists for any of
these. Any success criterion phrased as a percentage change against a current baseline is
**currently unverifiable** — this is a real constraint on how UXDES and TEST may phrase acceptance.

---

## 4. What is actually sourceable — the central finding

The ticket says "from available location data." Available location data is: **a coordinate pair, a
provider-supplied place name, and a straight-line distance to one anchor.** That is the whole
inventory. It divides cleanly:

**F-1 — Derivable today, honestly, with zero new providers.**
- Distance and bearing from the property to any anchor already in `HotelLocationAnchor`
  (`kind: 'airport' | 'venue' | 'landmark' | 'city_center'`). Multiple anchors, not just one.
- **Relative position among the current result set** — a purely internal comparison. Given the
  coordinates of the hotels already on screen, expaify can say which are clustered together and
  which sits apart, without knowing anything about the city. This is the single strongest cue
  available at zero data cost, and no prior ticket has claimed it.
- The provider place name, correctly labeled as an unverified provider label.

**F-2 — Requires a new data source. Out of scope for this ticket to build.**
Land-use character (residential/nightlife/business), walkability, transit access, nearby food or
groceries, safety. None of it is inferable from a lat/lng without a POI or land-use dataset.
Any such dataset is an external API call and, per the non-negotiable contract, would have to sit
behind `lib/providers` returning `Result<T>`. That is a DEV-stage decision on a separate ticket.

**F-3 — The failure mode this ticket must actively prevent.**
The tempting shortcut is to synthesize character from coordinates — "central," "quiet area,"
"walkable," "well-connected" — as generated prose. This would be **fabricated evidence presented
as fact**, on a surface whose entire established design language is source-labeled evidence
(`HotelAmenityEvidence` carries status, scope, source, `fetchedAt`, confidence, and
guaranteed-vs-requestable certainty). A hotel described as "quiet, residential" that turns out to
sit on a nightlife strip is a trust failure worse than showing nothing, and it directly contradicts
`hotel-noise-fit`'s finding that provider omission is not evidence of absence. **A neighborhood
signal with no source is not a signal.**

---

## 5. Constraints the solution must respect

1. **Evidence integrity.** Every neighborhood cue must be traceable to a stated source —
   provider-supplied, expaify-calculated from coordinates, or absent. Adopt the existing evidence
   vocabulary (source, scope, confidence) rather than inventing a parallel one. No inferred or
   generated area characterization may render as fact. Where precision is `search_area` or
   `missing` (`hotelLocationContext.ts:78-95`), **no neighborhood claim may be made at all** —
   the coordinate that would ground it does not exist.
2. **Contract preservation.** Hotel data continues through `lib/providers`; adapters return
   `Result<T>` and never throw; money stays `{ priceCents, currency }`. Any new field on
   `HotelOffer` must be optional so existing providers, cached entries, and the booking
   serializer keep working unchanged. Existing exports and props must not be renamed or removed.
3. **Density and accessibility at 375px.** The `HotelCard` Location region already competes with
   price, Deal Score, quality, access, parking, smoking, funds, documents, and rate eligibility.
   Neighborhood context must be **concise and structured** — a small bounded set of cues, not
   prose — must not displace price or Deal Score, must not overlap or clutter at 375px, and must
   be keyboard-reachable with a visible focus ring.

---

## 6. Success statement

**This is solved when a first-time visitor to a destination can tell, from the hotel result and its
expanded detail alone, what is practically around a property and how it sits relative to the other
properties they are considering — without opening an external map — and when every cue shown is
traceable to a stated source, with properties that lack the underlying data plainly showing nothing
rather than a guess.**

---

## 7. Open questions for UXR

1. **Is the derivable-only set (F-1) enough to change a decision?** Relative-position-within-results
   plus multi-anchor distance is honest and free. If it does not move confident selection, the
   honest recommendation is to defer this ticket behind a POI-source decision rather than ship
   thin cues. UXR should reach a position on this, not assume the answer is yes.
2. **What do Booking.com and Google Hotels actually show, at the level of interaction pattern?**
   Both surface neighborhood context, but on top of POI datasets expaify does not have. UXR must
   separate the *pattern* worth borrowing from the *data* that makes it possible, and say plainly
   which of their cues we cannot reproduce.
3. **Can property switches be attributed to area uncertainty at all** (§3.2), or should that
   metric be replaced with something observable? Do not carry an unbuildable metric into the spec.
4. **Where does this belong — collapsed card, expanded detail, or both?** The collapsed card is
   where comparison stalls, but it is the most density-constrained surface in the app.
