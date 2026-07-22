# UX Research: Hotel Location Pin Confidence

**Ticket:** UXR-HOTEL-LOCATION-PIN-01  
**Priority:** P1  
**Stage:** UXR  
**Research date:** 2026-07-22

## Input and scope

The required discovery report exists at `docs/pipeline/hotel-location-pin/01-discovery.md` on the completed upstream UXD branch (`1b35463`), but had not yet been integrated into this UXR worktree when the audit began. It was read from that upstream artifact without modifying the UXD worktree.

This research is narrower than the completed `hotel-location-decision-context` work. The current product already labels address, coordinate, area, search-area, and missing-location states. This ticket asks what additional compact context makes a property position useful relative to a traveler's airport, venue, landmark, or other intended anchor.

Research questions:

1. What is the minimum useful orientation cue on a hotel result?
2. What is an honest default anchor when the traveler has not entered a landmark?
3. How should the UI distinguish an address, a coordinate-backed pin, and a broad area?
4. How much distance precision is useful without implying route or entrance accuracy?
5. What belongs on the collapsed card versus deliberate location inspection on mobile and desktop?

## Executive finding

The minimum useful orientation cue is **one coordinate-backed distance to one named, relevant anchor**, shown as comparable text rather than as an unlabeled pin or miniature map. Example: `2.4 mi from Los Angeles International (LAX)`. A pin is useful as a secondary verification action, but a pin alone does not answer “near what?” and a broad area cannot support property-level distance.

There is no honest universal default landmark. In the current flight-led flow, the selected arrival airport is the only user-linked anchor available, so it may be used as a clearly named fallback when both airport and property coordinates exist. It must not be described as the traveler’s preferred area, used to claim `near`, or treated as evidence of convenience. A provider distance may be shown only when its reference point and semantics are supplied or independently calculable; the current adapter’s unconditional `city center` label does not meet that standard.

## Current-code evidence

### 1. The normalized contract can hold a point and one distance, but not anchor provenance

`HotelLocation` supports latitude, longitude, a precision enum, and one `{ value, unit, referencePoint }` distance (`lib/types.ts:119-135`). It does not identify:

- whether the distance was provider-supplied or calculated by expaify;
- the anchor type (`airport`, `landmark`, `venue`, `city_center`);
- an anchor ID or anchor coordinates;
- whether the measurement is straight-line or route distance;
- coordinate accuracy or whether a point represents an entrance, building centroid, or approximate property position.

The shape therefore permits a truthful text distance only when upstream semantics are already known. It cannot currently support an auditable computed comparison or distinguish a user-relevant anchor from a generic provider reference.

### 2. Address presence is promoted to `exact` even without a verified point

The Hotellook adapter validates latitude and longitude ranges (`lib/providers/hotellook.ts:68-83`). It then assigns `precision: 'exact'` whenever an address exists, whether or not both coordinates exist (`lib/providers/hotellook.ts:98-121`). When no address exists but both coordinates do, it assigns `precision: 'coordinates'` (`lib/providers/hotellook.ts:123-131`).

This conflates two different claims:

- an address is provider-supplied textual location evidence;
- a coordinate pair is an inspectable map position.

Neither alone proves an “exact” guest entrance. The current display compounds the issue by rendering `Exact location` for the address state and `Map position` for the coordinate state (`app/components/hotelLocationContext.ts:47-66`). The coordinate state can be more useful for pin inspection than an address-only state, while the labels imply the reverse confidence ordering.

### 3. The adapter invents the meaning of the provider distance

For any finite non-negative provider `distance`, `parseProviderDistance` rounds the number to one decimal, assigns kilometers, and hardcodes `referencePoint: 'city center'` (`lib/providers/hotellook.ts:85-95`). The inspected provider response type exposes only a bare `distance` field; no source field establishes its unit, reference point, or measurement method (`lib/providers/hotellook.ts:8-27`).

The result card then renders that normalized value verbatim as `{value} {unit} from {referencePoint}` (`app/components/hotelLocationContext.ts:23-37`) in expanded details (`app/components/HotelCard.tsx:557-568`). This creates precise-looking orientation from semantics the adapter has not proven. It is a data-confidence defect, not merely a copy problem.

### 4. The selected arrival airport is available, but anchor intent and context are discarded

The search route resolves the raw destination into an IATA code (`app/api/search/route.ts:206-215`) and passes only that IATA code into hotel search (`app/api/search/route.ts:395-400`). `resolveToIATA` accepts an IATA code, ZIP, or city and collapses each to the same code (`lib/airports/resolve.ts:47-72`). As a result, downstream hotel data cannot tell whether the traveler explicitly selected an airport or merely used a city/ZIP that resolved to one.

The airport catalog has names and coordinates for some airports but coordinates are optional and missing for others (`lib/airports/data.ts:1-8`, examples at `lib/airports/data.ts:12-34`). The current route does not attach airport name or coordinates to hotel results. Therefore airport-relative distance is feasible only for the subset with complete hotel and airport coordinates, and current code lacks a provenance-bearing path to carry it.

### 5. Location is visible on the card, but coordinates are not inspectable

The collapsed card shows a two-line location label/value beneath property identity (`app/components/HotelCard.tsx:445-476`). Expanded details repeat the precision note and optional distance (`app/components/HotelCard.tsx:557-568`). There is no map preview, `View location` action, coordinate link, anchor selector, or location-specific event tracking.

The card’s mobile layout is already dense: photo, property identity/location, and a minimum-width price column share one three-column row (`app/components/HotelCard.tsx:445-483`). An embedded map or extra controls in that row would reduce scanability at 375px. The existing full-width Details region is the safer place for deliberate pin inspection.

### 6. Location survives booking review, but uncertainty remains unresolved

`buildHotelBookingHref` serializes precision, label, address, coordinates, distance, reference point, and provider location name (`lib/booking/config.ts:360-385`). `HotelSummary` repeats the location value, precision label, and caveat, and the handoff checklist tells users to compare location on the provider page (`app/book/BookingFlow.tsx:159-190`, `app/book/BookingFlow.tsx:480-505`).

Continuity is present. Relevance is not: a `city center` distance that was not proven in the adapter remains unproven at the final checkpoint, and there is no same-property pin inspection before provider handoff.

### 7. The discovery hypotheses are not measurable today

The shared `track` helper accepts arbitrary event properties (`lib/analytics.ts:1-7`), but `HotelCard` does not call it. The product cannot currently segment card impressions, detail opens, location inspections, booking-review opens, or provider handoffs by location precision or anchor type.

## Reference-pattern guidance

The following is reference guidance, not evidence that expaify currently behaves this way.

### Google Hotels: map plus adjustable reference location

Google’s official Travel Help says hotel results include a list and map, that users can use the map to find hotel locations, and that results can be adjusted based on a specific location. It also describes location information and directions as part of the hotel detail surface. This makes a property point inspectable and lets the user change the geographic frame of reference rather than accepting a generic center. Source: [Google Travel Help — Search for hotels](https://support.google.com/travel/answer/6276008?hl=en).

Relevant pattern for expaify:

- a visual pin is paired with a known search context;
- choosing a specific location changes the meaning of proximity;
- map exploration is a deliberate mode, especially on mobile, rather than mandatory content inside every compact result.

Delta: expaify preserves some property coordinates but offers no inspection action and no adjustable or user-linked anchor. Its current text distance names a fixed `city center` regardless of trip intent.

### Booking.com: distance requires an explicit coordinate or landmark basis

Booking.com’s official Demand API guidance treats location criteria as typed inputs such as airport, landmark, city, or coordinates. Landmark filtering uses a landmark ID with coordinates; distance sorting requires coordinates; and airport is a distinct location filter. This is implementation documentation rather than a consumer-interface screenshot, but it establishes a useful integrity rule: distance has an explicit geographic basis and landmark/airport context is not interchangeable with city context. Sources: [Booking.com Demand API — Filtering and sorting accommodation results](https://developers.booking.com/demand/docs/accommodations/filter-sorting) and [Search for accommodation](https://developers.booking.com/demand/docs/accommodations/search-for-available-properties).

Relevant pattern for expaify:

- preserve the kind and identity of the location used for comparison;
- compute/sort by distance only when coordinate prerequisites exist;
- treat airport and landmark anchors as first-class, named contexts.

Delta: expaify collapses city, ZIP, and airport inputs into IATA before hotel search and stores distance without anchor kind, source, or measurement method.

## Synthesis by traveler segment

| Segment | Minimum useful cue | Honest default when no landmark is entered | What does not resolve the decision |
| --- | --- | --- | --- |
| Fixed venue | Distance to the named venue, coordinate-backed | No substitute; show area/pin and state that venue distance is unavailable | City-center distance or an unnamed pin |
| Airport-dependent | Distance to the full airport name + IATA | Selected arrival airport, only when both coordinate sets exist | Area name, generic `airport`, or inferred drive time |
| Landmark-led leisure | Distance to the selected landmark | No substitute; a provider-named landmark may be used only with provenance | Nearest arbitrary attraction chosen by the product |
| Unfamiliar destination | Named anchor distance plus area/address context | Arrival airport for flight-led searches; otherwise a proven provider anchor | Local area name alone |
| Flexible city | Area/address and optional pin inspection | A provider-declared city center; otherwise no distance | Treating airport distance as a convenience verdict |

The segment comparison rules out one universal “best” anchor. Relevance comes from the traveler’s search context. When that context is absent, omitting a distance is more honest than substituting a recognizable but irrelevant landmark.

## Exact gap

The current UI truthfully exposes broad location precision better than the prior implementation, but it does not convert supported coordinates into a relevant orientation cue. At the same time, it displays a precise city-center distance whose meaning is manufactured in the adapter. The resulting mismatch is:

1. the most trustworthy inspectable evidence (validated property coordinates) has no action;
2. the most decision-like evidence (distance to a named anchor) has insufficient provenance;
3. the only user-linked anchor (arrival airport) is discarded before hotel normalization;
4. address, point, and area confidence are labeled as a single precision ladder even though they answer different questions;
5. location-inspection behavior is not instrumented.

## Design directives

### 1. Make one named-anchor distance the primary orientation cue, with strict evidence gates

The collapsed card may show exactly one line in the form `{distance} from {anchor name}` only when:

- the property has validated latitude and longitude;
- the anchor has validated latitude and longitude;
- the anchor has a user-readable name and typed provenance;
- the measurement method is recorded.

Anchor precedence must be:

1. user-selected landmark/venue, if a future approved flow supplies one;
2. explicitly selected/search-linked arrival airport;
3. provider-declared city center or landmark with documented semantics;
4. no distance.

Do not automatically choose the nearest attraction, infer a venue from hotel copy, or turn a distance into `near`, `walkable`, or `convenient`. For the current flow, use the arrival airport only as a named orientation fallback, not as a relevance or ranking claim.

**Test:** an LAX search with complete coordinates can show `2.4 mi from Los Angeles International (LAX)`; the same hotel with missing airport coordinates shows no airport distance; a city-center value without provider semantics is suppressed.

### 2. Separate address evidence, map-position evidence, and area evidence in labels and actions

Replace the confidence implication of `Exact location` with evidence-based states:

- address + coordinates: `Address` with the address value; allow `View property pin`;
- coordinates without address: `Provider map pin` with provider area/name; allow `View property pin`;
- address without coordinates: `Address` with no pin action;
- provider area only: `Area only` with no property-pin action;
- searched destination fallback: `Search area only` with the existing warning treatment;
- missing: `Location unavailable`.

Never call a point `exact` unless a provider supplies accuracy/precision metadata that supports that word. A coordinate-backed pin identifies a position, not necessarily the correct entrance. A broad area must never render with a point-pin action or property-level distance.

**Test:** each of the six evidence combinations above produces the specified label, and only records with both valid coordinates expose a pin action.

### 3. Keep comparison text collapsed; put pin inspection in expanded details

At 375px and desktop, retain the current location position beneath property identity. The collapsed card should contain at most:

1. one evidence label/value line; and
2. one named-anchor distance line when supported.

Do not add a map thumbnail to the three-column identity/price row. In expanded Location details, place `View property pin` immediately after the address/area and anchor-distance facts. The control must be a real link or button, work by keyboard, have a visible focus ring, and use an accessible name such as `View property pin for {hotel name}`. If it opens an external map, disclose `Opens map in a new tab`; if coordinates are absent, omit the control rather than disabling it.

**Test:** at 375px, long hotel, anchor, and address names wrap without overlapping photo, price, Deal Score, or Review hotel; the pin action follows Details in logical focus order and is absent for area-only results.

### 4. Display decision-level distance precision and disclose straight-line limits once

For expaify-calculated coordinate distance:

- use the traveler’s locale unit where supported; default to miles for US locale and kilometers otherwise;
- below 10 mi/km, round to one decimal;
- at or above 10 mi/km, round to the nearest whole unit;
- below 0.1 mi/km, display `<0.1 mi` or `<0.1 km`, never `0`;
- append the full named anchor, not `airport`, `landmark`, or `city center` alone;
- in expanded details and booking review, state `Straight-line distance; travel distance and time may differ.`

Do not show walking, driving, or transit time without a supported routing source and timestamp. Do not combine a provider distance of unknown semantics with an expaify-computed distance under the same label.

**Test:** 2.36 miles renders `2.4 mi`; 12.6 miles renders `13 mi`; 0.04 miles renders `<0.1 mi`; no state renders a travel time or `near` claim.

### 5. Instrument confidence outcomes by property, precision, and anchor—not map opens alone

Define these events before launch:

- `hotel_location_impression`: `hotelId`, `precision`, `anchorKind`, `hasDistance`, `distanceBucket`;
- `hotel_location_details_opened`: same fields;
- `hotel_location_pin_opened`: same fields and `mapTarget`;
- `hotel_review_opened_after_location`: same fields plus `sameProperty: true`;
- `hotel_provider_handoff_after_location`: same fields plus `sameProperty: true`.

Use property-scoped session correlation to compare the same hotel before and after inspection. Primary outcome: provider handoff for the same property after location inspection. Guardrails: repeated inspection of multiple properties, detail exit without review, and pin opens without same-property progression. Segment results by `anchorKind` and precision; a higher pin-open rate by itself is unresolved uncertainty, not success.

**Test:** QA can produce the full event sequence for coordinate + airport, coordinate without anchor, area-only, and missing-location fixtures; area-only and missing fixtures never emit `hotel_location_pin_opened`.

## Required states for the design handoff

The design spec must cover these evidence combinations, not only generic loading/error states:

| Property evidence | Anchor evidence | Collapsed result | Expanded location state |
| --- | --- | --- | --- |
| Address + coordinates | Valid selected airport | Address + named airport distance | Address, pin action, distance caveat |
| Coordinates only | Valid selected airport | Provider map pin + named airport distance | Area/name, pin action, distance caveat |
| Address only | Any | Address; no computed distance | Address; no pin action |
| Coordinates | Anchor missing/invalid | Provider map pin; no distance | Pin action; `Distance to your search point unavailable` only if space requires explanation |
| Provider area only | Any | Area only | Precision caveat; no property pin or distance |
| Search-area fallback | Any | Search area only | Warning; no property pin or distance |
| Missing | Any | Location unavailable | Provider-confirmation warning |
| Any | Distance source/meaning unknown | Suppress distance | Do not relabel it as city center |

Loading must not reserve a fake map or landmark. Error in an optional map target must leave the address/area and hotel booking flow usable. The booking review must preserve the same anchor name, measurement label, and caveat shown on the result; it must not silently change the reference point.

## Risks, constraints, and out-of-scope boundaries

- The current airport catalog has optional coordinates, so airport coverage will be partial until data completeness is measured.
- The current input pipeline loses whether a user chose a city, ZIP, or airport. Design must not imply airport intent without a source-of-truth rule in DEV.
- The raw HotelLook `distance` semantics are not proven by the inspected contract. Suppress it until provider documentation or a verified sample establishes unit, reference point, and method.
- An external coordinate map link is a bounded inspection aid; embedded interactive maps, routing, traffic, transit, walking-time claims, and multi-anchor planning remain out of scope.
- No user study or production funnel data was available for this brief. Distance thresholds and placement are testable recommendations derived from the audited constraints and reference patterns, not measured expaify user behavior.

## Handoff

Create `UXDES-HOTEL-LOCATION-PIN-01` to specify the card, expanded Location panel, booking-review continuity, copy, focus behavior, and all evidence/anchor states above. The design must not require a map thumbnail or routing service and must flag the provider-distance provenance defect for DEV rather than designing around it.
