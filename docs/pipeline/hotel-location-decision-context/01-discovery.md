# UX Discovery: Hotel Location Decision Context

## User Pain Point

Hotel cards reduce location to a single area string, so paid users cannot judge whether a stay is convenient for their trip before opening the provider handoff.

## Affected User And Flow Step

This affects first-time and paid-intent users comparing hotel results after a flight or destination search, especially on mobile where they need to scan quickly and decide whether to review a hotel. The affected steps are the hotel results card and the hotel handoff review: `HotelCard` shows name, stars/rating, price, score, and provider handoff details, but no address, distance, landmark, neighborhood confidence, map cue, or transportation context; `BookingFlow` repeats only the optional area value before sending the user to the provider.

## Measurable Signal

- `HotelOffer` contains only `area` for location context, with no address, coordinates, distance-to-center, landmark, neighborhood, or provider location confidence fields (`lib/types.ts`).
- `buildHotelBookingHref` only serializes `area` into the review URL, so no richer location context can survive from result card to handoff review (`lib/booking/config.ts`).
- `HotelSummary` in the booking review displays only hotel name and optional area as location information (`app/book/BookingFlow.tsx`).
- `HotellookProvider` maps provider location to `entry.location?.name ?? location`, which can collapse a specific hotel location into the searched area label (`lib/providers/hotellook.ts`).
- Manual QA signal: a user can open a hotel card with a valid nightly price and provider handoff but cannot answer "Is this near where I need to be?" without leaving expaify.

## Constraints

1. Preserve provider and money contracts: hotel data must continue to flow through `lib/providers`, adapters must return `Result<T>`, and prices must remain integer minor units as `{ priceCents: number; currency: string }`.
2. Do not invent precision: if provider data only supports a broad area, the UI must label it as broad context rather than implying an exact address, distance, or neighborhood.
3. Maintain trust and accessibility at 375px mobile and desktop: location context must be scannable, keyboard-accessible, and must not crowd price, Deal Score, booking availability, or provider-confirmation disclosures.

## Success Statement

This is solved when a first-time paid-intent user can compare hotel results and review a selected hotel on expaify with enough location context to judge likely convenience without opening the provider page just to discover where the stay is.
