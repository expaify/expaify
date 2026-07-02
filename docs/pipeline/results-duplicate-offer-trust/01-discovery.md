# UXD-RESULTS-DUPLICATE-OFFER-TRUST-01: Results Duplicate Offer Trust

Date: 2026-07-02
Stage: UX Discovery
Persona: Senior UX Strategist

## User Pain Point

Repeated or near-identical flight and hotel offers make the results page feel inflated instead of curated, so paid users cannot tell whether expaify found meaningfully different options or is padding the list with duplicates.

## Who Is Affected And Where

First-time and returning users reviewing search results are affected at the results comparison step, before they open a card detail panel or continue to a provider/review flow.

The affected surfaces are the Flights and Hotels tabs in `app/page.tsx`, `components/flights/FlightResults.tsx`, `app/components/FlightCard.tsx`, and `app/components/HotelCard.tsx`. The trust risk is highest when a search streams multiple provider batches or returns several hotels with the same name, price, location, or provider identity.

## Measurable Signal

- Flight results are deduped in two places, but only by `currency`, `carrier`, `origin`, `destination`, and departure timestamp: `app/page.tsx:119` and `app/api/search/route.ts:88`. This can miss near-identical fares that differ by provider, id, return date, cabin, stops, itinerary, price scope, or minute-level schedule normalization.
- The client accumulates streamed flight batches, applies the narrow flight dedupe, and immediately fires scoring for every newly streamed fare in `app/page.tsx:1169`; duplicate-looking offers can still consume score/UI attention before users understand why they differ.
- Hotel results are set directly from provider data in `app/page.tsx:1174` and rendered with `key={hotel.id}` in both loading and complete states at `app/page.tsx:2079` and `app/page.tsx:2160`; there is no visible grouping, duplicate suppression, or "same hotel, different rate/provider" explanation.
- Flight result copy reports counts as raw visible fares, such as `Showing ${displayFlights.length} of ${flights.length} fares` in `components/flights/FlightResults.tsx:821`, which can make a repeated result set look larger and more valuable than it is.
- The shared types in `lib/types.ts` define stable IDs and provider/source fields for fares and hotels, but no canonical duplicate/grouping key, sibling count, or duplicate reason that the UI could use to explain similar offers.

## Constraints

1. Data integrity: do not hide materially different options that change price, provider handoff, fare scope, itinerary timing, cabin, baggage context, hotel location precision, or booking availability.
2. Trust and transparency: if similar offers are grouped, suppressed, or labeled, the UI must explain the basis plainly without implying provider availability or final price certainty beyond returned data.
3. Performance and contracts: keep all external calls inside `lib/providers`, preserve money as `{ priceCents: number; currency: string }`, and avoid adding extra provider requests just to resolve duplicates.

## Success Statement

This is solved when a first-time user can scan flight and hotel results and understand that each visible card represents a meaningfully distinct option, without suspecting that expaify is inflating inventory with repeated offers.

## Handoff Notes For UXR

- Audit the current duplicate behavior with representative streamed flight batches and hotel arrays, including same carrier/route/departure fares with different provider IDs and same hotel names with similar nightly rates.
- Compare against travel results patterns that group comparable offers, label alternate providers/rates, or expose "best option shown" rules without hiding meaningful differences.
- Produce directives that define what counts as duplicate, near-duplicate, and materially distinct for both `NormalizedFare` and `HotelOffer`.
