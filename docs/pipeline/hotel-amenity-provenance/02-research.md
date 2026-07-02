# UX Research: Hotel Amenity Provenance

Ticket: `UXR-HOTEL-AMENITY-PROVENANCE-01`
Stage: UX Research
Priority: P1
Date: 2026-07-02

## Source Inputs

- Discovery report: `docs/pipeline/hotel-amenity-provenance/01-discovery.md`
- Current implementation audited:
  - `lib/types.ts`
  - `lib/providers/hotellook.ts`
  - `lib/providers/bookingComRapidApi.ts`
  - `app/api/search/route.ts`
  - `app/components/HotelCard.tsx`
- Reference patterns checked:
  - Booking.com, "How we work": https://www.booking.com/content/how_we_work.html
  - Google Travel Help, "Search for hotels on Google": https://support.google.com/travel/answer/6276008?hl=en

## Research Question

Can a paid-intent hotel user tell whether important amenities are confirmed, unavailable, or simply not returned by the provider before leaving expaify?

## Research Summary

No. expaify currently has no hotel amenity contract and no UI surface for amenity evidence. The current hotel card has made strong progress on price scope, location precision, and quality evidence, but amenities are still absent from `HotelOffer`, the Hotellook response normalization, cache validation, search streaming semantics, and the expanded hotel details.

The trust risk is not that the UI lacks amenity decoration. The risk is that future amenity display could easily turn missing provider data into a false promise. The design stage needs to define exact states for provider-backed, unavailable, provider-missing, and unknown amenities before UI or DEV work adds amenity labels.

## Current Implementation Findings

### 1. `HotelOffer` cannot carry amenity evidence

`HotelOffer` carries identity, area/location, hotel class, guest rating evidence, price, deeplink, source, and photo fields (`lib/types.ts:137` to `lib/types.ts:150`). It has no amenity list, amenity source label, amenity confidence, amenity status, amenity-level fetched timestamp, selected-stay availability, or provider-missing state.

Because `HotelProvider.searchHotels` returns `Promise<Result<HotelOffer[]>>` (`lib/types.ts:179` to `lib/types.ts:183`), every hotel card receives this same limited shape. The UI cannot distinguish "provider confirmed free Wi-Fi" from "provider did not return amenities" or "amenity unavailable for these dates."

### 2. Hotellook normalization maps location and quality, but not amenities

The Hotellook cache entry type currently includes hotel id, name, stars, location, address, distance, price, photo, and property type (`lib/providers/hotellook.ts:10` to `lib/providers/hotellook.ts:28`). There is no typed field for facilities, amenities, room features, breakfast, parking, Wi-Fi, shuttle, pool, accessibility, pet policy, or cancellation-relevant facilities.

The live normalization returns `id`, `name`, `area`, structured `location`, `stars`, `pricePerNight`, `deeplink`, `photoUrl`, `source`, `hotelClass`, and `guestRating` (`lib/providers/hotellook.ts:458` to `lib/providers/hotellook.ts:485`). Cached normalization similarly validates known hotel fields and drops anything outside the existing shape (`lib/providers/hotellook.ts:318` to `lib/providers/hotellook.ts:380`). There is therefore no current path for amenity provenance to survive either live fetch or cache replay.

### 3. Search results stream hotels without amenity status

`GET /api/search` calls hotel availability only when destination and round-trip dates exist, then sends either `hotel-status` or a `hotels` NDJSON event with raw normalized hotel offers (`app/api/search/route.ts:393` to `app/api/search/route.ts:420`). The route can tell the UI whether hotel inventory is available, empty, unavailable, or skipped. It cannot tell the UI whether amenity data is unavailable independently from hotel inventory.

That distinction matters: "we found hotel rates, but this provider did not return amenities" is a different state from "the hotel provider is unavailable."

### 4. The hotel card has expanded evidence sections, but no amenity section

The collapsed hotel card shows photo, hotel name, quality evidence, location, nightly price, Deal Score, and Review/Details controls (`app/components/HotelCard.tsx:425` to `app/components/HotelCard.tsx:520`). Expanded details include Deal Score, quality evidence, location, price scope, rate check, and provider handoff (`app/components/HotelCard.tsx:523` to `app/components/HotelCard.tsx:579`).

There is no collapsed amenity summary and no expanded "Amenities" evidence panel. This is currently safer than showing unsupported amenities, but it means users must leave expaify to answer common stay-fit questions such as Wi-Fi, breakfast, parking, shuttle, pool, pet policy, and accessibility.

### 5. Booking.com RapidAPI is flight-focused here, not a hotel amenity fallback

`BookingComRapidApiProvider` implements `FlightProvider`, not `HotelProvider`, and its mapping is intentionally not finalized (`lib/providers/bookingComRapidApi.ts:1` to `lib/providers/bookingComRapidApi.ts:96`). It does not provide a second hotel source or amenity normalization path.

The design spec should not assume a Booking.com hotel amenity payload exists in this repo. Any future provider support needs a provider-neutral amenity evidence contract first.

## Reference Pattern Comparison

### Google Hotels

Google Travel Help describes amenities as a hotel-results filter alongside price, user rating, and hotel class. The pattern is that amenities are treated as structured decision criteria, not hidden marketing copy. A user can narrow results by must-have attributes before deciding which hotel to inspect.

Delta versus expaify: expaify has no amenity filter, no amenity summary, and no missing-amenity disclosure. The product cannot yet support "must have Wi-Fi/pool/parking" without provider-backed fields.

### Booking.com

Booking.com's public explanation describes accommodation ranking and quality information as based on multiple accommodation features and user-relevant signals. In the product pattern, facilities and services are structured property facts that support comparison and filtering rather than unverifiable prose.

Delta versus expaify: expaify currently has structured evidence patterns for hotel class and location, but no parallel structure for amenity facts. Adding amenity chips without source/status metadata would be weaker than the surrounding evidence model.

## Exact Gap

Current code does this:

- Defines hotel offers without amenity fields.
- Normalizes Hotellook hotel data without facilities or selected-stay amenity status.
- Streams hotel availability separately from amenity availability.
- Shows no amenity summary or missing-amenity disclosure on the card.
- Sends the user to provider review without telling them whether amenity evidence was checked.

Reference patterns do this:

- Treat amenities as structured hotel-search criteria.
- Let users compare or filter by must-have amenities before provider choice.
- Present amenities as property facts, not ambiguous sales copy.

The delta:

- expaify needs a provider-neutral amenity provenance model and conservative UI states. Until a provider returns amenity data, the correct UI is not "No amenities"; it is "Amenities not returned by provider."

## Design Directives For UXDES

1. Define amenity evidence as a structured contract before designing chips.
   - Each amenity item must have a canonical id, display label, status, source label, and confidence.
   - Status values must distinguish at least `confirmed`, `unavailable`, `not_returned`, and `unknown`.
   - Optional metadata should allow `fetchedAt`, `scope` (`property`, `room`, `rate`, or `selected_stay`), and `fee` (`included`, `paid`, or `unknown`) without requiring the UI to invent values.

2. Keep collapsed hotel cards scannable and conservative.
   - Collapsed cards may show at most 3 provider-backed amenity labels after location/quality and before actions.
   - Do not show an amenity in collapsed state unless its status is `confirmed`.
   - If no confirmed amenities exist but hotel inventory exists, collapsed state should either omit amenities or show one neutral line: `Amenities not returned by provider`.

3. Add an expanded "Amenities" evidence panel with explicit missing states.
   - The panel must support these states with final copy:
     - Provider-backed amenities exist.
     - Provider returned no amenity fields.
     - Provider returned an amenity as unavailable.
     - Provider returned ambiguous/unknown amenity data.
     - Amenity evidence is loading or failed separately from hotel inventory.
   - The panel must not use color or icons as the only status signal.

4. Do not imply selected-stay availability unless the provider says so.
   - Copy must avoid `includes`, `available`, or `free` unless status/scope supports that claim.
   - If the provider only supplies property-level amenities, use copy such as `Provider lists this amenity for the property. Confirm room and rate details before payment.`
   - If fee status is unknown, do not call the amenity free or included.

5. Preserve current evidence hierarchy and mobile usability.
   - Amenity content must not displace nightly rate, Deal Score, location, quality evidence, or Review hotel CTA in the collapsed card.
   - At 375px, amenity labels must wrap without overlapping the photo, price block, score chip, or CTA.
   - Keyboard users must reach the Details control, then encounter amenity evidence in a predictable order before provider handoff copy.

## Acceptance Criteria For UXDES

- The design covers default, loading, provider-backed amenities, no amenities returned, unavailable amenities, unknown/ambiguous amenities, error, mobile 375px, desktop 1280px, focus/keyboard, and assistive-tech copy.
- The design provides final UI strings for `Amenities`, `Amenities not returned by provider`, `Confirmed by provider`, `Unavailable for this stay`, `Availability not specified`, fee unknown, and provider/source disclosure.
- A hotel with no amenity data never displays `No amenities`; it displays a provider-missing or unknown state.
- A property-level amenity never reads as selected-room or selected-rate availability unless the payload explicitly supports that scope.
- Collapsed cards show no more than 3 confirmed amenities and preserve the existing price, Deal Score, location, quality, and Review hotel hierarchy.
- Expanded details expose amenity source/status in text that is understandable without relying on icon color.
- The design identifies DEV work as required because `HotelOffer`, Hotellook normalization, cache validation, and tests lack amenity provenance fields.

## Risks And Constraints

- Current Hotellook integration may not return usable amenity data from the cache endpoint. The design must include the "not returned by provider" state as a first-class outcome, not an edge case.
- Amenity vocabulary can sprawl quickly. The spec should define a small canonical set for MVP comparison: Wi-Fi, breakfast, parking, airport shuttle, pool, accessibility, pets, and air conditioning.
- Provider vocabulary must be normalized in `lib/providers`; components must not parse vendor-specific amenity strings.
- Existing non-negotiables still apply: external calls stay in `lib/providers`, adapters return `Result<T>`, money stays as integer cents, secrets come from env, and outbound hotel deeplinks keep affiliate markers.

## Out Of Scope Findings

- This ticket should not add amenity filtering, ranking, provider selection, or booking-flow changes unless a downstream ticket explicitly scopes them.
- Amenity data should not affect Deal Score until scoring has a separate approved model for hotel quality/fit.
- Booking review continuity may need a later ticket if the design requires amenities to persist into `/book`.

## Handoff

Create `UXDES-HOTEL-AMENITY-PROVENANCE-01` for implementation-ready design of hotel amenity provenance on hotel result cards and expanded hotel details.
