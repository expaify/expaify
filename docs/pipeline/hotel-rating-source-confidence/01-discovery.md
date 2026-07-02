# UXD-HOTEL-RATING-SOURCE-CONFIDENCE-01: Hotel Rating Source Confidence

## Pain Point

Hotel star and rating signals appear on result cards without source, scale, or review-count context, so paid users comparing stays cannot tell whether the quality claim is verified, current, or comparable across providers.

## Affected Users And Flow Step

- **Who is affected:** First-time and paid-intent users comparing hotel options after a flight or destination search, especially users using quality signals to choose between similar nightly rates.
- **Flow step:** Hotel results cards in `app/components/HotelCard.tsx`, fed by `app/api/search/route.ts` and normalized hotel provider data from `lib/providers/hotellook.ts`.
- **Trust risk:** The hotel card shows a star row and optional numeric rating next to copy such as "Excellent", "Very good", or "Good", but users are not told whether those values are provider star class, guest review score, derived fallback data, or how many reviews support the rating.

## Current Implementation Signals

- `lib/types.ts` defines `HotelOffer` with `stars: number`, optional `rating?: number`, and `source: string`, but it has no fields for rating source, rating scale, review count, rating freshness, or whether the rating is inferred.
- `lib/providers/hotellook.ts` maps Hotellook `stars` into both `stars` and `rating`, meaning the displayed guest-style rating can be a duplicate of star class rather than an independent review score.
- `app/components/HotelCard.tsx` renders a five-star visual from `hotel.stars` and, when `hotel.rating` is present, displays a one-decimal number plus a qualitative label such as "Excellent" without source or scale text.
- `app/components/HotelCard.tsx` uses the rating thresholds `8.5`, `8`, and lower for labels, implying a 10-point guest-review scale even though the current Hotellook mapping can supply a 0-5 star value as `rating`.
- `app/api/search/route.ts` streams hotels as provider data after flight providers resolve, but the emitted hotel payload does not add or validate any rating provenance before results reach the UI.
- `lib/providers/bookingComRapidApi.ts` is currently flight-focused and does not normalize hotel rating provenance for hotel results, so there is no alternate provider path providing source confidence.

## Measurable Signal

This problem exists when a user can see a hotel quality claim on the card but cannot answer these questions from the UI or payload:

1. **What is the signal?** Hotel class, guest rating, editorial rating, or provider-derived fallback.
2. **Where did it come from?** Hotellook, Booking.com, another provider, or expaify normalization.
3. **What scale is it on?** Five-star class, 10-point guest score, percentage, or unknown.
4. **How reliable is it?** Review count, minimum threshold, freshness, or whether the signal is missing/inferred.

Observable QA signals:

- `HotelOffer.rating` has no companion metadata for source, scale, review count, or confidence.
- Hotellook provider code assigns `rating` from `stars`, creating a mismatch between guest-score labels and star-class data.
- Hotel cards show qualitative rating labels even when the app cannot prove the rating is a real guest review score.
- The card exposes `hotel.source` only indirectly through the booking path; it is not visible next to the quality claim.
- No empty or unknown rating state explains when a provider only supplies stars or supplies no verified guest rating.

## Constraints

1. **Brand trust:** expaify must not present star class, inferred values, or provider fallbacks as verified guest-review ratings.
2. **Data integrity:** Provider adapters must preserve rating provenance explicitly and avoid inventing review counts, scales, or confidence labels when the provider does not return them.
3. **Accessibility:** Star class, rating, source, and unavailable states must be understandable by assistive tech and cannot rely on icon shape or color alone.
4. **Performance:** The solution must use data already returned by hotel providers or cached provider payloads; result-card rendering must not add blocking provider calls.
5. **Provider flexibility:** The pattern must support Hotellook now and future hotel providers later without coupling UI copy to one vendor's response shape.

## Success Statement

This is solved when a first-time user can compare hotel results and understand whether each displayed quality signal is a hotel star class or verified guest rating, where it came from, and whether there is enough review context to trust it without mistaking inferred provider data for a confirmed quality claim.

## Downstream Focus

The research stage should audit the hotel-card quality area and provider normalization path, then define testable directives for:

- Verified guest ratings with source, scale, and review count.
- Star class shown separately from guest review score.
- Missing, unknown, inferred, or provider-only rating states.
- Copy rules that prevent "Excellent" or similar labels when the app only has star-class data.
- Future provider fields needed to preserve rating provenance without breaking existing hotel results.
