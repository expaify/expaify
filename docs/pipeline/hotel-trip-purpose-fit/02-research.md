# UXR-HOTEL-TRIP-PURPOSE-FIT-01 — Hotel Trip-Purpose Fit Research

Date: 2026-07-29
Stage: UX Research (UXR)
Persona: Senior UX Researcher
Priority: P2
Ticket: UXR-HOTEL-TRIP-PURPOSE-FIT-01
Upstream: `docs/pipeline/hotel-trip-purpose-fit/01-discovery.md`

## Executive summary

The discovery report's tier ordering survives the code audit. Its confidence
levels do not.

- **T1 (airport stay) is confirmed as the only shippable tag** — but its
  binding constraint is not the hotel provider. It is `lib/airports/data.ts`,
  where **21 of 257 airports carry `lat`/`lon`**. On every other destination the
  anchor is never constructed, no distance is computed, and the tag can never
  render. Ship it, and treat ~8% destination coverage as the designed behaviour.
- **T2 (business stay) is killed.** Both of its inputs are already rendered on
  the collapsed card, adjacent to each other, in the same type treatment. A T2
  tag is a third rendering of two facts, and `precision: 'exact'` does not mean
  what the tag would imply.
- **T3/T4 remain blocked**, for the reasons discovery gave; one correction to
  the guest-rating claim is recorded below.
- **The MVP ships exactly one tag, adds zero new card blocks, and adds no
  purpose selector.** The purpose lens is a Tier-2 artifact and must not ship
  alongside a taxonomy of one.

---

## 1. Tier assignment — confirmed or overturned

### 1.1 T1 — Airport stay: **CONFIRMED, with a coverage ceiling discovery did not have**

The data path is real and end-to-end verifiable:

`app/api/search/route.ts:403` passes `getSearchLinkedAirportAnchor(destIATA)`
into `searchHotelAvailability` → `HotellookProvider.searchHotels(..., context)`
→ `applySearchContext` (`hotellook.ts:225`) → `withCalculatedAnchorDistance`
(`lib/hotels/locationEvidence.ts:53`) → haversine → `location.distance =
{ value, unit: 'km', method: 'straight_line', source: 'expaify_calculated' }`.

Three properties of this path matter for design:

**(a) The anchor is always the airport the shopper searched.** Hotels are only
requested when `destIATA && depart && ret` (`route.ts:398`), and the anchor is
built from that same `destIATA`. This is not an arbitrary nearby airport — it is
the airport the shopper is flying into. That is a materially stronger semantic
than discovery assumed and it is what makes the tag worth a line of card space.

**(b) The distance is independently re-verifiable at render time.**
`hasVerifiedHotelLocationComparison` (`locationEvidence.ts:96`) re-runs the
haversine and rejects the record unless the stored value matches to within
1e-6 km, and additionally requires `location.source === 'provider'`, valid
coordinates, a valid anchor, and a valid distance shape. `completeDistance`
(`app/components/hotelLocationContext.ts:24`) already gates on it. **The tag
needs no new predicate** — it reuses this one.

**(c) NEW FINDING — the tag can render on at most 8.2% of destinations.**
`getSearchLinkedAirportAnchor` (`lib/airports/resolve.ts:78`) returns
`undefined` unless the airport row has finite in-range `lat` and `lon`. Counted
directly in `lib/airports/data.ts`: **21 rows carry coordinates out of 257**.

Coordinate-backed (tag possible): JFK, LGA, EWR, LAX, BUR, LGB, SNA, ORD, MDW,
DFW, DAL, SFO, OAK, SJC, MIA, FLL, PBI, BOS, BWI, DCA, IAD.

No coordinates (tag impossible today), including: **ATL, DEN, SEA, MCO, LAS,
PHX, IAH, HOU, MSP, DTW, PHL, CLT** — and **every non-US airport in the table**.

When the anchor is `undefined`, `withCalculatedAnchorDistance` returns the
location unmodified (`locationEvidence.ts:57`), so no distance is attached and
the tag correctly self-suppresses. Nothing breaks. But design and measurement
must both be built on the fact that a shopper searching Denver or Seattle will
never see this tag, and that this is correct output, not a defect.

> **Out of scope for this ticket, flagged for the board:** filling in the
> remaining 236 airport coordinate rows is a pure data change in
> `lib/airports/data.ts` that would multiply this feature's reach ~12×. It is a
> DEV ticket, not a design change. See §7.

### 1.2 T2 — Business stay: **OVERTURNED. Do not ship.**

Discovery asked UXR to kill or confirm T2. **Killed**, on four independent
grounds:

1. **`precision: 'exact'` is a field-presence flag, not a precision
   measurement.** `normalizeHotelLocation` (`hotellook.ts:98`) sets
   `precision: 'exact'` whenever `cleanLocalizedString(input.address)` returns
   any non-empty string. There is no validation, no geocode confirmation, no
   completeness check. A one-word address string yields `exact`. A tag reading
   "Exact address" as a *business-fit* claim would be trading on a word the
   pipeline uses as a boolean.

2. **Both inputs are already on the collapsed card, six lines apart.** The
   class chip renders `"4-star hotel"` at `HotelCard.tsx:858–861`
   (`getHotelClassCollapsedText`, line 472). The location block renders
   `"Exact location"` and the address at `HotelCard.tsx:883–886`. A T2 tag would
   restate both, in the same `text-xs` / `--text-2` / `--radius-control`
   treatment, in the same grid column. It adds an element and zero information.

3. **The class floor has no trustworthy value.** `buildHotelClassEvidence`
   (`hotellook.ts:243`) accepts any finite positive `stars`, and `stars` is
   `Number(entry.stars ?? 0)` where the raw field is typed `number | string`
   (`hotellook.ts:25`). There is no ceiling check against `scaleMax: 5`. A class
   floor of "≥ 4" is not defensible against an unvalidated coerced field.

4. **The one field a business traveller actually needs is permanently absent.**
   `documentReadiness` is `notProvidedHotelDocumentReadiness('Hotellook')` on
   every offer (`hotellook.ts` search body, and `checkDocumentReadiness` returns
   the same). Invoice/receipt readiness — the single highest-value work-trip
   signal — is never available. A business tag that cannot speak to it while
   sitting on a card that says "not provided" is worse than no tag.

### 1.3 T3 / T4 — **CONFIRMED blocked**

- **T3 (family):** `amenityEvidence` is a passthrough of `entry.amenityEvidence`
  (`hotellook.ts:38`), a field `cache.json` does not return, so
  `normalizeHotelAmenityEvidence` resolves every fact including
  `room_pref_connecting` to `not_returned`. `propertyType` is declared on the
  raw entry (`hotellook.ts:36`) and dropped in normalization — it never reaches
  `HotelOffer` (`lib/types.ts:474`), which has no capacity or property-type
  field at all. Blocked.
- **T4 (weekend):** confirmed. `searchHotels` calls `buildGuestRatingEvidence`
  with `{ stars, source, fetchedAt }` and **never passes `legacyRating`**, so
  the function's only non-`unknown` branch (`hotellook.ts:~470`) is unreachable
  on the live path. Every offer resolves to
  `kind: 'unknown'` / `confidence: 'unavailable'`.

  **Correction to discovery:** discovery states `HotelCard` "deliberately renders
  'Guest rating not provided'". That string is in `getGuestRatingDetailText`
  (`HotelCard.tsx:525`) and appears only in the **expanded** Quality panel. On
  the **collapsed** card, `getGuestRatingCollapsedText` (line 502) returns
  `null`, so the chip is absent entirely. The collapsed card is one element
  lighter than discovery counted. This matters for §4.

---

## 2. The Tier-1 rule — exact and testable

One tag ships: **Airport stay**.

### 2.1 Show condition

Render the airport-stay fit line for an offer if and only if **all** of the
following hold:

| # | Condition | Source of truth |
|---|---|---|
| R1 | `hasVerifiedHotelLocationComparison(hotel.location) === true` | `lib/hotels/locationEvidence.ts:96` — reuse verbatim, do not reimplement |
| R2 | `hotel.location.anchor.kind === 'airport'` | must be checked explicitly; R1 does **not** check kind |
| R3 | `miles ≤ 5.0`, where `miles = distance.unit === 'mi' ? value : value * 0.621371192237334` | same conversion as `completeDistance`, `hotelLocationContext.ts:27` |

R1 already transitively guarantees: `location.source === 'provider'`, valid
lat/lng, a valid anchor with non-empty `id`/`name` and a legal `source`, a
distance with `method: 'straight_line'` and `source ∈ {expaify_calculated,
provider_documented}`, and — for `expaify_calculated` — that the stored value
matches a fresh haversine to within 1e-6 km.

**R2 is not redundant.** `HotelLocationAnchorKind` (`lib/types.ts:390`) declares
`airport | venue | landmark | city_center` and
`isValidHotelLocationAnchor` accepts all four. Only `airport` is constructed
today; without R2, the first `city_center` anchor anyone adds would silently
inherit airport copy.

### 2.2 Threshold: 5.0 miles, straight-line

`distance` is a great-circle line, not a route. Road distance from an airport
typically runs 20–35% longer than the straight line because of perimeter roads
and terminal access. Setting the tag at **≤ 5.0 mi straight-line** means the
tag's implied real journey tops out around 6–7 road miles — still a credible
pre-flight stay — while excluding downtown properties that merely happen to be
in the same metro. A looser threshold (10 mi) would tag most urban inventory and
make the cue meaningless; a tighter one (2 mi) would exclude the airport hotel
clusters that sit just outside the perimeter at large fields such as DFW and
IAD.

The threshold is a single named constant. UXDES must specify it as such so it
can be tuned from the measurement in §6 without a copy change.

### 2.3 Explicit no-tag condition

Render **nothing** — no placeholder, no greyed chip, no "fit unknown" — when any
of these is true. This list is exhaustive and each item is reachable today:

1. The destination airport has no `lat`/`lon` in `lib/airports/data.ts`, so
   `getSearchLinkedAirportAnchor` returned `undefined` (**236 of 257 airports**).
2. The offer has no usable coordinates, so `normalizeHotelLocation` produced
   `precision: 'area'` or `'search_area'` and `withCalculatedAnchorDistance`
   stripped the anchor.
3. `location.source !== 'provider'`.
4. `hasVerifiedHotelLocationComparison` fails the recomputation tolerance.
5. `anchor.kind !== 'airport'`.
6. `miles > 5.0`.
7. `hotel.location` is `undefined`.

In every one of these cases the card must be **byte-for-byte identical to
today's card**. Silence is the fallback. There is no unknown-fit state.

### 2.4 What the tag must never imply

The tag asserts one fact: *the straight-line distance between the property's
provider-supplied coordinates and the searched airport's coordinates*. It must
not be worded, coloured, or positioned so as to imply any of: a shuttle or
transfer service, driving time or driving distance, walkability, a 24-hour front
desk, early check-in, late check-out, or airport-terminal adjacency. None of
these exist in `HotelOffer`.

---

## 3. Final tag copy

### 3.1 Collapsed card — the fit line

```
Airport stay · 2.4 mi straight-line from LAX
```

Construction: `` `Airport stay · ${distance} straight-line from ${anchor.id}` ``

- `anchor.id` is the bare IATA code (`resolve.ts:88`, `id: normalizedIata`).
  Use it, **not** `anchor.name` — `anchor.name` is
  `` `${airport.name} (${IATA})` `` (`resolve.ts:97`), e.g. "Los Angeles
  International (LAX)", which wraps to three lines in the card's narrow middle
  column at 375px.
- `distance` formats exactly as `completeDistance` does today
  (`hotelLocationContext.ts:30`): one decimal below 10 mi, whole number at or
  above 10 mi. The 10-mi branch is unreachable under the 5.0-mi threshold but
  must remain for safety.
- **Sub-0.1-mi case:** `completeDistance` emits the literal `<0.1`, which reads
  as broken prose inside this sentence. Override: when `miles < 0.1`, render
  `Airport stay · under 0.1 mi straight-line from LAX`.

**Why "straight-line" sits before the anchor.** It is the misread guardrail, so
it must survive line-wrapping and partial reading. Placing it immediately after
the number binds it to the quantity a shopper is actually evaluating; placing it
at the tail ("2.4 mi from LAX, straight line") makes it the first thing dropped
by a skim.

### 3.2 Collapsed card — accessible name

The visible line is terse by necessity; the accessible name carries the full
provenance.

```
Airport stay. 2.4 miles in a straight line from Los Angeles International (LAX),
calculated by expaify. Not a driving route. No shuttle or transfer service is
confirmed.
```

Uses `anchor.name` (the long form) since width is not a constraint here.

### 3.3 Expanded card — Location panel framing

The Location panel (`HotelCard.tsx:1005–1015`) already renders `distanceText`
from `completeDistance`, currently as bare prose:
`"2.4 mi from Los Angeles International (LAX)"`. Reframe in place — **no new
panel, no new heading**:

Line 1 (replaces the current `distanceText` line):
```
Airport stay — 2.4 mi from Los Angeles International (LAX)
```

Line 2 (new, styled as the existing `location.note` provenance line):
```
Straight-line distance calculated by expaify between this property's
provider-supplied coordinates and the airport you searched. It is not a driving
route, and no shuttle or transfer service is confirmed.
```

When the tag conditions fail but `distanceText` still exists — reachable when
R1 and R2 pass but `miles > 5.0` — keep today's bare `distanceText` line
unchanged and omit both the "Airport stay" framing and line 2. The distance
remains a fact worth showing; only the *fit claim* is withheld.

### 3.4 Strings that must not appear

"Near the airport", "airport shuttle", "minutes from", "drive", "walk",
"terminal", "convenient for early flights", "perfect for", "ideal for",
"recommended for you". The first four are unsupported claims; the rest are
either personalization or marketing voice, both out of contract.

---

## 4. Surface decision and 375px density

### 4.1 Recount of the collapsed card on the live Hotellook path

Discovery counted "up to eleven" elements. Audited against what actually renders
for a `hotellook` offer, the live count is **9 blocks**, three of which are
"not provided" provenance:

| Rendered on the live path | Location |
|---|---|
| 1. Photo thumbnail | `HotelCard.tsx:842` |
| 2. Name (2-line clamp) | `:849` |
| 3. Hotel-class chip (`stars > 0`) | `:857–861` |
| 4. Location label line (`"Exact location"`) | `:883` |
| 5. Location value line (address) | `:886` |
| 6. Price block | `:890` |
| 7. Rate-eligibility line — **always renders**, `"Restrictions not provided"` | `:906`, `HotelRateRestrictions.tsx:118` (no null branch) |
| 8. Parking summary — **always renders** | `:908`, `HotelParking.tsx:260` (no null branch) |
| 9. Funds-policy summary (when `canBook`) | `:916` |
| 10. Score chip + `Review hotel` action row | `:939` |
| 11. `Details` button | `:971` |

Absent on the live path: the guest-rating chip (`getGuestRatingCollapsedText`
→ `null`, §1.3), the collapsed access chip (all amenity facts `not_returned`),
the pet-policy scan, and the smoking line. So the card carries 11 rendered
blocks in the worst case and is genuinely at capacity — but two of the always-on
blocks (7, 8) are pure absence statements, which is the real density problem and
is out of this ticket's scope.

### 4.2 Decision

**Ship: collapsed-card line (inside the existing location block) + Location
panel reframing. Do not ship a purpose lens.**

**(a) The collapsed fit line adds zero new blocks.** It goes inside the existing
location block (`HotelCard.tsx:882–887`), which today holds two lines in a
`mt-2 min-w-0 text-xs leading-5` container. It becomes three lines in the same
container, at the same `text-xs` / `leading-5` / `--text-2`, with no new margin,
no new border, no chip, no icon, no colour.

Cost at 375px: `leading-5` = 20px, and the line wraps to two rows in the middle
grid column (`minmax(0,1fr)` beside a `5rem` photo and a `minmax(6.75rem,auto)`
price column), so **+40px worst case**. Nothing else moves: the price block sits
in a sibling grid column and does not reflow; blocks 7–11 shift down by that
amount only. This is the smallest possible footprint that is still legible, and
it is strictly cheaper than any chip (which would add `py-1` + border + its own
`mt-1.5` = ~46px *plus* a new element in the chip row).

**Placement within the block:** the fit line goes **last**, after the label and
value lines. Address first preserves today's reading order and keeps the
location block's existing hierarchy (what/where, then the derived comparison).

**(b) No purpose lens above results.** Discovery listed this as an option. It
must not ship in this MVP:

- The taxonomy is **one tag**. A selector offering work / weekend / family /
  airport would present four options of which three can never affect anything —
  a UI that advertises capability the data cannot back. That is the exact
  failure mode this ticket exists to avoid.
- Filtering or sorting by airport stay would return an empty list on ~92% of
  searches (§1.1c) and on many of the remaining 8%.
- There is no hotel sort or filter control in the shipped UI at all; a
  purpose lens would be the first one, which is a much larger scope than a P2
  taxonomy decision.
- Omitting it satisfies the "optional and non-blocking" constraint for free:
  there is nothing to opt into, nothing to dismiss, and a shopper who ignores
  the cue gets exactly today's experience with today's ordering.

**(c) No detail-view panel.** The Location panel is reframed in place. The
detail view stays at ten panels.

### 4.3 Accessibility

- The fit line is static text, not interactive. It must not become a
  button, link, or tooltip trigger, so tab order is unchanged.
- It carries the §3.2 accessible name via the existing sibling-text idiom used
  elsewhere on the card (`aria-label` on the wrapping element, as at
  `HotelCard.tsx:875–880`). It must not be `aria-hidden`.
- It is not a live region. It renders with the offer and never updates in place.
- Contrast: `--text-2` on `--bg-base` at `text-xs`, identical to the two lines
  already in this block. No new token, so no new contrast case to verify.

---

## 5. Reference comparison — how the pattern degrades

Both references were examined for one question only: **what happens when the
supporting attribute is missing?** That is expaify's dominant case, not its edge
case.

### 5.1 Booking.com — the "Are you travelling for work?" prompt

**Interaction pattern.** A binary prompt in the search flow (and a persistent
work-trip toggle) that is a *query modifier*: it reorders and re-filters the
result set toward properties with work-relevant attributes, and separately
surfaces a work-suitability label on individual properties, backed by a
review-derived work sub-score plus concrete amenity flags (desk, workspace,
wi-fi speed rating).

**Degradation.** Two independent layers. The prompt never degrades, because it
asserts nothing about any property — it is intent capture. The property label
degrades by **silent omission**: a property lacking the sub-score or the amenity
flags simply carries no label, and Booking never shows a "work suitability
unknown" state.

**Lesson for expaify.** The separation is the whole design. Booking can afford
an always-available prompt because it has an evidence-backed payoff for it.
expaify has an evidence-backed payoff for exactly one purpose, on ~8% of
destinations. **Capturing intent first would be a promise with no payoff** —
which is the direct argument against the purpose lens in §4.2(b). Take only the
second layer: an evidence-gated, silently-omitted property label.

### 5.2 Google Hotels — intent and amenity chips

**Interaction pattern.** A horizontal chip rail above results ("Under $200",
"4-star", "Free breakfast", "Pool", property-type chips) that filters the
current result set.

**Degradation.** Chip availability is **a function of the returned inventory,
not a fixed UI**. A chip whose attribute is absent from the current result set
is not rendered at all, so applying a visible chip essentially never produces an
empty list. The rail shrinks silently; no disabled chips, no zero-result traps,
no "unknown" affordance.

**Lesson for expaify.** Self-suppression must be per-offer *and* per-result-set.
The design in §4.2 achieves the stronger version of this: because the cue is
only ever a line inside an existing block on an individual card, a result set
where zero offers qualify is **visually identical to today's** — there is no
list-level chrome that could announce a concept the data cannot deliver.

### 5.3 What neither reference does

Neither product shows an "unknown fit", greyed, or placeholder fit state
anywhere. Both treat absence of evidence as absence of UI. This independently
confirms the discovery report's taxonomy rule and is the single most transferable
finding in this section.

---

## 6. Comprehension scenarios — the misread guardrail

Six moderated tasks, `n ≥ 8` per condition, first-time shoppers with no expaify
exposure. **Scenarios C1–C4 are blocking:** any failure kills the tag regardless
of engagement lift, per discovery's guardrail.

**C1 — Shuttle inference (BLOCKING).**
Show a card reading `Airport stay · 2.4 mi straight-line from LAX`. Ask: "What,
if anything, has expaify told you about getting from this hotel to the airport?"
*Pass:* participant describes only a distance and volunteers no transport
service. *Fail:* participant states or assumes a shuttle, transfer, or hotel
pickup exists. **Target: zero fails.**

**C2 — Driving-time inference (BLOCKING).**
Same card. Ask: "How long would it take you to get to the terminal, and how do
you know?" *Pass:* participant says the card does not tell them, or gives an
estimate while explicitly attributing it to their own guess. *Fail:* participant
cites the card as the source of a travel time, or reads "2.4 mi" as road
distance without qualification. **Target: zero fails.**

**C3 — "Straight-line" comprehension (BLOCKING).**
Ask participants to explain "straight-line" in their own words. *Pass:*
as-the-crow-flies / map distance / not the road route. *Fail:* "a straight road",
"a direct route", or no meaning attached. **Target: ≥ 7 of 8 pass.** If this
fails, the fallback copy is `2.4 mi in a direct line (not by road) from LAX`,
which must then be re-tested at 375px for wrap.

**C4 — Absence is not a negative signal (BLOCKING).**
Show a mixed list where some cards carry the line and some do not, all with
comparable price and class. Ask what the difference between the two groups is.
*Pass:* participant infers only that some cards state a distance to the airport.
*Fail:* participant infers the untagged properties are worse, farther, lower
quality, or unverified. **Target: zero fails.** This scenario protects the §6
guardrail metric — a fit cue must add confidence to tagged cards without
suppressing untagged inventory.

**C5 — Anchor identity (non-blocking).**
Ask which airport "LAX" refers to and why that airport. *Pass:* participant
connects it to the destination they searched. *Fail:* participant thinks it is
the nearest airport of unspecified choice, or their origin airport. A fail here
does not kill the tag; it promotes the full anchor name into the collapsed line
for wide viewports only.

**C6 — Scope containment (non-blocking).**
Ask what else, if anything, the "Airport stay" label tells them about the
property. *Pass:* nothing beyond location. *Fail:* participant infers a 24-hour
desk, early check-in, luggage storage, or business amenities. Two or more fails
requires replacing the label `Airport stay` with the flatter
`Distance to airport` and re-running C1–C4.

### 6.1 Measurement, corrected for the coverage ceiling

Discovery's measurement plan stands, with three mandatory adjustments given
§1.1(c):

1. **Tag impression rate must be reported per search with a
   coordinate-backed destination**, not per search overall. Against all searches
   the number is dominated by the airport data gap and tells you nothing about
   the design. Report both denominators, labelled.
2. **Add a rule-hit-rate diagnostic**: among offers that pass R1 and R2, the
   share that also passes R3 (≤ 5.0 mi). This is the input for tuning the
   threshold constant without touching copy. If it approaches 100%, the
   threshold is too loose to discriminate; near 0%, too tight.
3. **The untagged-handoff guardrail is the primary kill metric.** `Review hotel`
   completion rate for untagged cards must not fall. C4 is its qualitative
   counterpart; both must hold.

---

## 7. Directives for UXDES (deliverable summary)

| # | Directive |
|---|---|
| D1 | Ship exactly one fit tag: **Airport stay**. T2 is killed; T3/T4 stay blocked. Do not design a tag framework or a second tag slot. |
| D2 | Gate the tag on `hasVerifiedHotelLocationComparison(location) === true` **AND** `anchor.kind === 'airport'` **AND** `miles ≤ 5.0`, with 5.0 as a single named constant. Reuse the existing predicate; do not reimplement it. |
| D3 | Collapsed copy: `Airport stay · {d} mi straight-line from {anchor.id}`; sub-0.1 variant `under 0.1 mi`; accessible name per §3.2. Location panel reframed in place per §3.3. No new panel. |
| D4 | Place the line as a third line **inside** the existing location block (`HotelCard.tsx:882–887`) — `text-xs`, `leading-5`, `--text-2`, no chip, no icon, no new token, no new block. Budget: +40px at 375px worst case. |
| D5 | **No purpose selector, lens, prompt, sort, or filter in this MVP.** |
| D6 | Every no-tag condition in §2.3 must render a card byte-identical to today's. No placeholder, no greyed state, no "unknown fit". |
| D7 | Spec the `miles > 5.0` case explicitly: the bare `distanceText` line survives unchanged; only the fit framing is withheld. |

## 8. Findings outside this ticket's scope

Recorded, not acted on:

1. **Airport coordinate coverage (`lib/airports/data.ts`).** 236 of 257 rows
   lack `lat`/`lon`, capping this feature — and any future `city_center` or
   landmark anchor work — at 8.2% of destinations. Pure data change. Strong DEV
   ticket candidate; would multiply this feature's reach ~12× for no design
   change.
2. **`HotelLookCacheEntry.distance` is declared and dropped.** The raw entry
   type (`hotellook.ts:36`) carries `distance?: number | string`, and
   `normalizeHotelLocation` never reads it. It **must stay dropped**: its anchor
   is undeclared, so surfacing it would be an unattributable distance claim —
   exactly what §2.4 forbids. Noted so a future reader does not "fix" it.
3. **Two always-on absence lines on the collapsed card.** The rate-eligibility
   line (`"Restrictions not provided"`) and the parking summary both render
   unconditionally on the Hotellook path (§4.1). They are the largest density
   cost on the card and neither carries information for this provider. A
   density ticket, not a trip-fit ticket.

## 9. Handoff

Create `UXDES-HOTEL-TRIP-PURPOSE-FIT-01` with this brief's path, the seven
directives in §7, and the blocking comprehension scenarios in §6.
