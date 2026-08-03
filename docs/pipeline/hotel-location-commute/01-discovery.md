# UX Discovery: Hotel Location and Commute Fit

**Ticket:** UXD-HOTEL-LOCATION-COMMUTE-01  
**Priority:** P0  
**Stage:** UX Discovery  
**Date:** 2026-08-03  
**Affected flow:** Hotel search results → expanded hotel detail

## Scope boundary

This ticket is not a repeat of the completed generic location work:

- `hotel-location-decision-context` established honest labels for an address, map position, provider area, search-area fallback, and missing location.
- `hotel-location-pin` established the integrity model for a coordinate-backed, straight-line distance to a named anchor.
- `hotel-neighborhood-context` concerns what is around a property, not the burden of reaching one fixed place.

The remaining problem is **comparability against the place that determines the trip**. The current collapsed result shows location precision and a place label, but not the available anchor distance. Expanded details can show one straight-line comparison when the destination resolves to an airport. The search flow does not preserve a user-named event, venue, landmark, or transit point as an anchor, and it has no supported route-time data. This discovery therefore scopes the next stage to the minimum commute evidence needed to shortlist hotels, not to a map, routing, neighborhood, or trip-planning feature.

## User pain point

When hotel listings do not compare each property with the traveler’s named destination, event, or transit point, the traveler cannot tell which attractive rate will create an impractical commute and must open properties or leave expaify to repeat the same location check elsewhere.

## Who is affected and where the flow breaks

The highest-impact users are travelers with one non-negotiable trip anchor:

- event attendees choosing around a stadium, wedding venue, convention center, or festival;
- business travelers choosing around an office, client site, campus, or conference venue;
- rail and airport travelers whose departure or arrival point determines where an overnight stay works;
- first-time visitors who cannot translate a provider area name into realistic proximity.

The break occurs between **hotel result scanning and expanded hotel detail**:

1. **Shortlisting on the collapsed card.** `HotelCard` shows the location precision and value, but omits `location.distanceText`. Two hotels can therefore look equally suitable even when their coordinate-backed distances to the same airport differ materially. The shopper must open cards one by one to compare.
2. **Validation in expanded detail.** The Location panel can show a named airport distance, but only when both the property and search-linked airport have valid coordinates. It describes straight-line separation, not a route or travel time. No comparable event, venue, landmark, or transit anchor reaches this state from the current search flow.
3. **Decision confidence.** A lower nightly price can mask a substantially worse daily journey. Without a common reference point and an honest measurement method, the user cannot make the price-versus-location tradeoff inside expaify.

This is most costly on mobile, where opening several dense cards, remembering their location evidence, and comparing them manually creates avoidable cognitive load.

## Evidence that the problem exists

### Current implementation signal

- `HotelOffer.location` can preserve provider coordinates, a named `HotelLocationAnchor`, and one `HotelLocationDistance` with source and `straight_line` method (`lib/types.ts`).
- `HotellookProvider` validates provider latitude/longitude; an area-only or search-area result is not promoted to a property point (`lib/providers/hotellook.ts`).
- `app/api/search/route.ts` currently constructs only `getSearchLinkedAirportAnchor(destIATA)`. Although the type permits `venue`, `landmark`, and `city_center`, the live search path does not construct those anchors from user intent.
- `getHotelLocationDisplay` renders a verified comparison as `{distance} mi from {anchor name}` and suppresses incomplete or tampered comparisons (`app/components/hotelLocationContext.ts`, `lib/hotels/locationEvidence.ts`).
- `HotelCard` renders that comparison only inside expanded Location details. The collapsed listing contains location label/value but no common-anchor distance (`app/components/HotelCard.tsx`).
- The airport caveat correctly avoids a commute promise by explaining that straight-line distance does not establish shuttle availability and that road distance and travel time vary. No routing provider or route timestamp exists in the inspected location contract.
- The live result card has no location-impression, details-open, selection-confidence, or exit analytics. Detail-page analytics exist on the separate saved-deal detail surface, but they do not measure this search-result-card flow or segment outcomes by commute evidence.

These facts establish the product gap, not its behavioral magnitude. There is no production baseline yet that proves how often commute uncertainty causes an exit.

### Measurement required to establish magnitude and validate a repair

Use a controlled comparison between eligible hotel result sets shown with versus without compact commute evidence. Include only offers for which both the property coordinate and the same named anchor coordinate are valid; do not count area-only inventory as an evidence-present treatment.

**Primary signal — selection confidence**

- Same-property progression from card impression to hotel-detail expansion and then to `Review hotel`, segmented by `commute_evidence_present`, anchor kind, location precision, and distance bucket.
- Cards inspected before the first `Review hotel` action. Fewer repeated detail opens with stable or higher review progression is the behavioral proxy for easier shortlisting.
- In a short intercept or moderated task, the share of users who can choose a hotel and correctly state the reference point and that the displayed distance is not a route time. Self-reported confidence without correct comprehension is not success.

**Primary problem signal — detail exit**

- Expanded hotel detail closed or search session ended without `Review hotel`, compared between evidence-present and evidence-absent cohorts.
- Repeated switching among hotel details before review, segmented by whether the same named-anchor comparison was available across those properties.

**Guardrails**

- Do not treat higher detail opens or location engagement alone as success; they may indicate added uncertainty.
- Provider-handoff rate for area-only or missing-coordinate hotels must not fall merely because they cannot receive calculated evidence.
- Track false-comprehension: users must not read straight-line distance as walking, driving, transit, traffic-aware, or real-time travel time.

Minimum event properties for UXR to validate are `hotel_id`, `location_precision`, `anchor_id`, `anchor_kind`, `anchor_source`, `commute_evidence_present`, `measurement_method`, `distance_bucket`, `viewport_group`, and same-session progression/exit outcome. Exact event names belong to later stages.

## Minimum evidence hypothesis

The smallest decision-useful unit to test is:

1. **one named, trip-relevant anchor** shared across the properties being compared;
2. **one coordinate-backed distance** calculated consistently for each eligible property;
3. **an adjacent method label** that makes clear the value is a straight-line estimate and that route distance and travel time may differ; and
4. **an honest absence state** that shows no commute comparison when either coordinate is missing or the anchor is not tied to the traveler’s search.

Example information shape, not final UI copy: `2.4 mi from Javits Center · Straight-line estimate`. This is a research hypothesis, not approval to add a venue input or routing provider.

A map thumbnail, multiple nearby places, neighborhood prose, a convenience verdict such as `close`, and travel-mode controls are not part of the minimum. A travel-time estimate is also **not supported by the current coordinate-and-distance contract**. If UXR finds that time rather than distance is essential for comprehension, it must identify the required sourced routing method, freshness semantics, and provider boundary; it must not derive minutes from straight-line distance or average speed.

## Constraints

1. **Evidence integrity and provider boundaries.** Use only provider-supported property coordinates and an anchor with a traceable source. External data must continue through `lib/providers` and return `Result<T>`. Never calculate or imply a property-level commute from an area label, search fallback, or missing coordinate.
2. **No real-time-routing implication.** Every calculated comparison must name its anchor and method. Straight-line distance must not be labeled as walking, driving, transit, traffic-aware, or current travel time. Any future estimated route time requires a supported source, travel mode, and freshness label; absence is preferable to invented precision.
3. **Shortlist utility without card clutter.** At 375px and desktop, the minimum evidence must remain a single compact secondary line, use the same anchor and units across comparable cards, preserve hotel name, price, Deal Score, and review action hierarchy, and remain understandable to keyboard and screen-reader users.

## Success statement

This is solved when a first-time traveler can shortlist the hotel that best fits a named destination, event, or transit point by comparing one clearly labeled, coordinate-supported proximity measure across eligible results—without opening every hotel, without mistaking it for real-time routing, and without adding more than one compact secondary line to each card.

## Required research handoff

UXR must:

1. audit the current result-card, expanded Location panel, search-anchor construction, and analytics path against this report;
2. determine whether named-anchor straight-line distance alone clears the shortlisting value bar for event, business, airport, and rail use cases;
3. compare one or two established travel patterns at the interaction level, separating useful presentation patterns from routing/POI data expaify does not have;
4. specify 3–5 testable directives covering evidence-present, area-only, missing-coordinate, unavailable-anchor, and mobile-density states; and
5. define an observable present-versus-absent measurement design for selection confidence and detail exits without claiming a baseline that does not yet exist.

**Handoff ticket:** `UXR-HOTEL-LOCATION-COMMUTE-01`
