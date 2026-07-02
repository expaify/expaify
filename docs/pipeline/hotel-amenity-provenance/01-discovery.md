# UXD-HOTEL-AMENITY-PROVENANCE-01: Hotel Amenity Provenance

## User Pain Point

Hotel amenities can read like unsupported promises when expaify cannot show whether each amenity is provider-backed, missing from the provider payload, or unavailable for the selected stay.

## Affected Users And Flow Step

This affects first-time and paid-intent users comparing hotel results after a destination or flight search, especially users deciding whether a nightly rate is worth reviewing before leaving expaify for the provider handoff. The affected step is the hotel results card and expanded hotel details in `app/components/HotelCard.tsx`, with data supplied by hotel provider adapters such as `lib/providers/hotellook.ts` and the future hotel path implied by `lib/providers/bookingComRapidApi.ts`.

The trust risk is highest when users expect core stay qualifiers such as breakfast, parking, Wi-Fi, airport shuttle, pool, accessibility, pet policy, or cancellation-relevant facilities to be explicit. If amenities are absent, generalized, or later added without source/status metadata, users cannot tell whether expaify verified the amenity, the provider did not return it, or the amenity is not available for the selected dates.

## Measurable Signal

- `lib/types.ts` defines `HotelOffer` with name, area/location, stars, price, deeplink, source, hotel class, and guest rating evidence, but no amenity list, amenity source, amenity confidence, fetched timestamp, or selected-stay availability status.
- `lib/providers/hotellook.ts` normalizes price, location, hotel class, and guest-rating evidence, but the Hotellook adapter does not map any amenity data or expose an explicit "amenities not provided" state.
- `app/components/HotelCard.tsx` has expanded evidence panels for Deal Score, quality, location, and price scope, but no amenity section and no empty/missing amenity disclosure.
- `lib/providers/bookingComRapidApi.ts` is currently flight-focused and does not provide a hotel amenity normalization path, so there is no second provider contract that can establish amenity provenance for hotel cards.
- Manual QA signal: a user can review a hotel rate with provider handoff language, but cannot answer "Does this hotel include the amenity I care about, and did expaify get that from the provider for my selected stay?" without leaving expaify.

## Constraints

1. **Data integrity:** expaify must not infer or invent amenity availability; each amenity state must distinguish provider-backed, provider-missing, unavailable, and unknown data without turning absence into a promise.
2. **Provider contract:** all amenity data must flow through `lib/providers` using `Result<T>` adapters, preserve `HotelOffer` compatibility, and support Hotellook now plus future hotel providers without UI copy depending on one vendor response shape.
3. **Trust, accessibility, and layout:** amenity provenance must be understandable at 375px mobile and desktop, must not rely on color/icon-only meaning, and must not crowd existing price, Deal Score, quality evidence, location, or booking handoff disclosures.

## Success Statement

This is solved when a first-time user can compare hotel results and understand whether important amenities are confirmed by the provider, unavailable for the selected stay, or simply not returned by the provider without mistaking missing amenity data for an expaify-backed promise.

## Downstream Focus

The research stage should audit current hotel result and provider behavior, then define testable directives for:

- Amenity display hierarchy on collapsed and expanded hotel cards.
- Explicit empty, missing, unavailable, and provider-backed amenity states.
- Copy rules that avoid promising selected-stay availability unless the provider returned that status.
- Type/provider metadata needed to preserve amenity provenance without breaking existing hotel results.
