# UX Research: Hotel Location Decision Context

## Inputs

- Discovery: `docs/pipeline/hotel-location-decision-context/01-discovery.md`
- Affected surfaces audited:
  - `lib/types.ts`
  - `lib/providers/hotellook.ts`
  - `app/api/search/route.ts`
  - `app/components/HotelCard.tsx`
  - `lib/booking/config.ts`
  - `app/book/BookingFlow.tsx`
- Next.js 15 docs checked before source review:
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`

## Research Question

Can a paid-intent hotel user decide whether a result is conveniently located before leaving expaify for provider handoff?

## Current Implementation Audit

### Data Model

`HotelOffer` only carries `area` as location context (`lib/types.ts:69`). It has no address, coordinates, distance from searched place, landmark, map source, or confidence/precision field. Because this is the shared shape used by cards, scoring, provider adapters, API streaming, and booking handoff, downstream UI cannot distinguish "exact hotel address" from "broad searched area."

`BookingHotelContext` mirrors the same limitation with optional `area` only (`lib/booking/config.ts:18`). `buildHotelBookingHref` serializes only `area` into `/book` (`lib/booking/config.ts:234`), so even if a provider adapter later had richer location fields, the booking review would currently drop them.

### Provider Adapter

`HotellookProvider` maps HotelLook `location?.name` into `HotelOffer.area`, falling back to the searched location code (`lib/providers/hotellook.ts:160`). The search route calls hotels with `destIATA` (`app/api/search/route.ts:393`), so fallback copy can become an airport code rather than a traveler-readable stay area. The adapter does preserve the provider boundary and returns `Result<HotelOffer[]>`, but the normalized data erases location precision.

### Results Card

`HotelCard` shows photo, hotel name, stars/rating, nightly rate, score, "Review hotel", and an expandable "Details" control (`app/components/HotelCard.tsx:160`). It never renders `hotel.area` in either collapsed or expanded state. Expanded details focus on Deal Score, price scope, provider handoff, and rating (`app/components/HotelCard.tsx:251`). The collapsed scan state gives no location signal at all.

Accessibility is partially sound: the Details button exposes `aria-expanded`/`aria-controls` (`app/components/HotelCard.tsx:225`), and unavailable booking states have status labels. The missing location context is therefore not primarily an accessibility bug; it is an information architecture and data confidence bug.

### Booking Review

`HotelSummary` displays hotel name, optional area, selected rate, provider, price basis, currency, and technical reference (`app/book/BookingFlow.tsx:127`). The review sidebar warns the user to compare hotel name, provider, rate, currency, and price basis before payment (`app/book/BookingFlow.tsx:369`), but not location. This means the final expaify checkpoint before provider handoff still does not ask the user to verify where the stay is.

## Reference Pattern Comparison

### Google Hotels

Google's official Travel Help describes hotel results as filterable by price, rating, class, and amenities, and explicitly says users can use the map to find where hotels are located or adjust results based on a specific location. Source: https://support.google.com/travel/answer/6276008

Pattern: location is not treated as secondary metadata. It is a core decision control with a map and search-location adjustment. The user can compare hotel position before choosing a provider.

Delta versus expaify: expaify has no map, distance, reference point, or visible area on the card. A user can only inspect price/value and then leave to verify location elsewhere.

### Booking.com

Booking.com's public "How we work" page documents distance as a sort option based on the address or location provided, where available. Source: https://www.booking.com/content/how_we_work.html

Pattern: distance is framed as a ranking/scanning primitive tied to the user's searched place, with availability constraints. The product does not need to guarantee a universal distance field, but it does label when distance is the basis of comparison.

Delta versus expaify: expaify cannot compute or display distance because `HotelOffer` has no coordinate, address, or reference-point fields. It also has no precision copy to say "area only" when exact placement is not available.

## Exact Gap

The current code treats hotel location as a low-fidelity string that is optional in the booking review and invisible in the result card. Reference hotel search patterns make location inspectable before provider choice through map, distance, or searched-place context. expaify's current pipeline cannot support that pattern because the provider adapter normalizes location into `area`, the API streams only `HotelOffer`, the card ignores `area`, and the booking URL preserves only `area`.

This is not solvable by adding a decorative map placeholder or invented "near downtown" copy. The correct design must first define a truthful location hierarchy for multiple precision levels:

- Exact: provider supplies address and/or coordinates.
- Approximate: provider supplies named area/neighborhood only.
- Broad: expaify only knows the searched destination or airport code.
- Missing: no provider location context is available.

## Design Directives

1. **Show a location line in every hotel card, including collapsed state.** The line must appear below the hotel name/rating block and before price/score actions. It must have one of these exact labels: `Exact location`, `Area`, `Search area`, or `Location unavailable`. If only current `area` is available, label it `Area`, not `Address`.

2. **Define and carry structured location context through the hotel contract.** The design spec should require a `location` object on hotel offers with fields for `label`, `precision`, and optional `address`, `lat`, `lng`, `distance`, `referencePoint`, and `providerLocationName`. The UI must not display distance, map pins, address copy, or neighborhood claims unless those fields exist from `lib/providers`.

3. **Add a location-confidence detail state in expanded hotel details.** Expanded details must include a compact "Location" section above provider handoff. It should show the best available location string plus one plain-language precision note:
   - Exact/address available: `Provider-supplied address. Confirm final address before payment.`
   - Coordinates only: `Provider-supplied map position. Confirm final address before payment.`
   - Area only: `Provider supplied an area, not a street address.`
   - Search area fallback: `Only the searched destination is available. Confirm location with the provider.`
   - Missing: `No provider location details were returned.`

4. **Preserve location context on `/book` and make it part of the final handoff checklist.** The booking review must show the same location label and precision note that the card showed. The "Before you continue" copy must include location in the comparison checklist, not only hotel name, provider, rate, currency, and price basis.

5. **Handle mobile and accessibility as acceptance criteria, not polish.** At 375px, the location line must wrap to two lines without overlapping the photo, price, score chip, or Review button. The expanded Location section must be reachable after the Details button in normal tab order, and any future map/link affordance must have an accessible name that includes the hotel name and location precision.

## Testable Acceptance Criteria For Design Handoff

- A hotel with exact address data displays an address-labeled location in the card, details, and booking review.
- A hotel with only `area` data displays `Area` and never uses address/distance/map-pin language.
- A hotel with only searched destination fallback displays `Search area` and a confirmation warning.
- A hotel with no location context displays `Location unavailable` without blocking price/Deal Score review.
- `/book` preserves whatever location context was visible on the card.
- Mobile 375px and desktop 1280px layouts keep location visible without crowding price, Deal Score, booking availability, or provider-confirmation disclosures.
- Keyboard users can expand Details and reach/read the Location section before Provider handoff content.

## Risks And Constraints

- Provider data may remain weak. The design must avoid implying precision that HotelLook did not supply.
- Adding richer fields touches `lib/types.ts`, provider cache normalization, booking URL validation, tests, and UI. This likely requires a DEV stage after UI spec if the design chooses structured data changes.
- URL serialization for `/book` should stay bounded and validated; do not pass arbitrary provider JSON through query params.
- Existing non-negotiables still apply: hotel provider calls stay in `lib/providers`, money remains integer cents, adapter methods return `Result<T>`, and outbound provider links keep affiliate markers.

## Handoff

Create `UXDES-HOTEL-LOCATION-DECISION-CONTEXT-01` for implementation-ready design of hotel location context across result cards and hotel handoff review.
