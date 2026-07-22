# UX Discovery: Hotel Location Pin Confidence

**Ticket:** UXD-HOTEL-LOCATION-PIN-01  
**Priority:** P1  
**Affected flow:** Hotel result card → expanded location review → hotel booking handoff

## User pain point

A broad area label or unnamed map position can make a hotel appear relevant while concealing an inconvenient distance from the traveler’s intended landmark, venue, or airport, so the traveler must leave expaify to decide whether the property location actually fits the trip.

## Who is affected, and when

The highest-risk users are travelers whose trip has a fixed anchor:

- event and business travelers going to a venue, convention center, client office, or campus;
- airport-dependent travelers planning an overnight, early departure, or late arrival;
- leisure travelers choosing around a landmark, attraction, beach, station, or neighborhood;
- first-time visitors who cannot interpret a broad provider area name from local knowledge.

The trust break occurs after a user has found an attractive hotel price and begins validating the result’s location. On the collapsed card, expaify currently shows an address, provider area, or the generic label `Map position`. In expanded details and booking review it can show a provider-supplied distance, but the only normalized reference point currently created by the hotel adapter is `city center`. A traveler whose actual anchor is an airport or venue still cannot tell whether the hotel is near the place that matters without conducting a separate map or landmark search.

## Current evidence and measurable signal

Current implementation evidence establishes the gap but not its behavioral magnitude:

- `HotelOffer.location` can carry validated latitude/longitude and a named distance reference, and the Hotellook adapter preserves provider coordinates (`lib/types.ts`, `lib/providers/hotellook.ts`).
- `HotelCard` renders location precision and optional distance as text, but it provides no pin/map inspection action and no trip-anchor comparison (`app/components/HotelCard.tsx`, `app/components/hotelLocationContext.ts`).
- The adapter converts the provider’s bare `distance` value into distance from `city center`; it does not relate a property to the search destination airport, a landmark, or a user-entered venue (`lib/providers/hotellook.ts`).
- The booking review preserves the same location fields, so a broad or irrelevant reference point remains unresolved at the final expaify checkpoint (`lib/booking/config.ts`, `app/book/BookingFlow.tsx`).
- No location-inspection analytics are present on these surfaces, so map opens, landmark checks, and exits caused by unresolved location fit are not currently measurable in-product.

The baseline and post-change funnel should distinguish:

1. hotel card impression with location precision (`exact`, `coordinates`, `area`, `search_area`, `missing`);
2. expanded location-detail view;
3. map/pin inspection, if offered;
4. landmark or trip-anchor inspection, if offered;
5. return from location inspection to the same property;
6. property-detail exit without booking handoff;
7. booking-review open and outbound provider handoff after location inspection.

The primary decision signal is the share of users who continue from location inspection to booking review/provider handoff for the same property. Guardrails are repeated location inspections across competing properties, immediate exits after inspection, and use of external map/landmark searches where observable through a bounded outbound action. These should be segmented by location precision and anchor type; a higher map-open rate alone is not success because it may indicate unresolved uncertainty.

## Scope boundary

This discovery is narrower than the completed hotel-location-decision-context work. That work truthfully labels exact, coordinate, area, search-area, and missing states across the card and handoff. This ticket asks what minimum additional context makes an available property position useful for judging proximity to a traveler’s intended anchor.

In scope is a compact, trustworthy presentation derived from available hotel coordinates and destination context. Out of scope are turn-by-turn directions, route planning, traffic-aware drive times, transit itineraries, arbitrary multi-stop planning, or claims of walkability without a supported routing source.

## Constraints

1. **Use only supported location evidence.** Coordinates, distances, and reference points must come from a provider or a defined internal calculation using validated coordinates; broad destination context must never be presented as the property’s exact location.
2. **Keep the decision aid compact and subordinate to selection.** It must remain usable at 375px and desktop, preserve hotel price and Deal Score hierarchy, and must not become a full map-planning product.
3. **Protect trust, accessibility, and existing contracts.** Every distance must name its reference point and unit, coordinate/map actions need accessible names and keyboard operation, provider calls remain in `lib/providers`, and affiliate booking handoffs remain intact.

## Success statement

This is solved when a first-time traveler with a landmark, venue, or airport in mind can determine from the hotel result and its compact location review whether a property is plausibly near that intended anchor—without mistaking a broad area or city-center distance for proof and without needing a separate exploratory map search before choosing which property to review.

## Research handoff

### Research questions

1. Which single orientation cue most often lets each target segment confidently keep or reject a hotel: named anchor distance, address/area plus pin, or a compact map preview?
2. When no explicit landmark is entered, which destination-context anchor is both useful and honest: searched airport, city center, destination label, or no computed anchor?
3. What wording and visual treatment clearly distinguish an exact property pin, provider coordinates, and a broad area without making users decode internal precision terms?
4. What distance precision is decision-useful without overstating accuracy, and when do travelers require walking/driving time that this scope cannot support?
5. Does location context need to appear on the collapsed card, only after a deliberate inspection, or in both places to support fast comparison at 375px?

### Target segments

- **Fixed-venue travelers:** event, conference, wedding, campus, or client-site proximity is the primary constraint.
- **Airport-dependent travelers:** proximity to the searched airport matters more than city-center proximity.
- **Landmark-led leisure travelers:** a named attraction, beach, station, or district anchors the stay decision.
- **Unfamiliar-destination travelers:** lack local knowledge to judge an area label and need a recognizable orientation cue.
- **Control segment — flexible city visitors:** no fixed anchor; city-center or neighborhood context may be sufficient.

### Event hypotheses

- If the compact location context names a relevant anchor, users who inspect it will reach booking review/provider handoff for the same property more often than users shown only a broad area or generic map-position label.
- Airport searches will show lower property-detail exits when distance is referenced to the searched airport rather than only to city center.
- Exact/coordinate-backed presentations will produce fewer repeated property inspections before handoff than area-only presentations, indicating faster confidence rather than mere engagement.
- A precision caveat will not materially reduce handoff for well-located properties, but will reduce immediate handoff from `area`, `search_area`, and `missing` states; that is a trust-positive outcome if users instead compare another property.
- If map/pin opens rise while same-property handoff falls and exits rise, the presentation is exposing uncertainty without resolving it and should not be considered successful.

## Handoff

Create `UXR-HOTEL-LOCATION-PIN-01` to audit the current coordinate/destination data path, test anchor relevance by segment, compare compact hotel-location inspection patterns, and validate the event hypotheses above.
