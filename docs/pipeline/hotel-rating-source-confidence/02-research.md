# UX Research: Hotel Rating Source Confidence

Ticket: `UXR-HOTEL-RATING-SOURCE-CONFIDENCE-01`
Stage: UX Research
Priority: P1
Date: 2026-07-02

## Source Inputs

- Discovery report: `docs/pipeline/hotel-rating-source-confidence/01-discovery.md`
- Current implementation audited:
  - `lib/types.ts`
  - `lib/providers/hotellook.ts`
  - `app/api/search/route.ts`
  - `app/page.tsx`
  - `app/components/HotelCard.tsx`
  - `lib/providers/__tests__/hotellook.test.ts`
  - `app/api/search/__tests__/route.test.ts`
- Reference patterns checked:
  - Booking.com, "How we work": https://www.booking.com/content/how_we_work.html
  - Google Hotel Center Help, "Frequently asked questions for hotel owners": https://support.google.com/hotelprices/answer/7219055?hl=en-IE

## Research Summary

Hotel quality evidence in expaify currently overstates confidence. The data model has only `stars`, optional `rating`, and `source`, so it cannot distinguish hotel class from guest review score, provider-supplied score, inferred fallback, review count, scale, or freshness. The Hotellook adapter then maps `stars` into both `stars` and `rating`, and the hotel card renders that value with guest-score labels such as `Excellent`, `Very good`, and `Good`.

The trust gap is not visual polish. The gap is evidence provenance. A first-time user can see a numeric quality claim, but the app cannot prove whether that number is hotel class, guest sentiment, provider metadata, or an expaify fallback.

## Current Implementation Findings

### 1. `HotelOffer` cannot carry rating provenance

`HotelOffer` defines `stars: number`, `rating?: number`, and `source: string`, but no fields for rating kind, rating source, rating scale, review count, confidence, or last-updated metadata (`lib/types.ts:69` to `lib/types.ts:80`).

This means downstream UI can only infer semantics from a bare number. That is not enough to render a trustworthy hotel-review claim or to decide when a claim must be suppressed.

### 2. Hotellook maps star class into guest-style rating

The Hotellook response shape includes `stars`, but the adapter sets both `stars` and `rating` from that same value (`lib/providers/hotellook.ts:150` to `lib/providers/hotellook.ts:173`). Cached hotel normalization preserves any numeric `rating` without validating scale or provenance (`lib/providers/hotellook.ts:37` to `lib/providers/hotellook.ts:83`).

The current tests lock in this behavior: provider tests expect a four-star hotel to return `rating: 4`, and the search route test fixture streams `rating: 4` as a valid hotel offer. This is a data-integrity bug for the UX because the UI later treats `rating` as if it can support guest-review language.

### 3. The card implies a 10-point guest score but may receive a 0-5 star value

`HotelCard` calculates `hasRating` from any positive `hotel.rating` (`app/components/HotelCard.tsx:143` to `app/components/HotelCard.tsx:158`). It then renders the number beside the star row and applies thresholds intended for a 10-point review score: `Excellent` at 8.5+, `Very good` at 8+, and `Good` otherwise (`app/components/HotelCard.tsx:103` to `app/components/HotelCard.tsx:104`, `app/components/HotelCard.tsx:184` to `app/components/HotelCard.tsx:188`).

When Hotellook supplies `stars: 4`, the card can render star icons plus `4.0 Good`. That reads like a poor guest rating even though it is actually a four-star property class copied into a guest-rating slot.

### 4. The expanded details repeat the unsupported rating claim

The expanded details region includes price scope and provider handoff copy, then renders `RatingBadge` when `hasRating` is true (`app/components/HotelCard.tsx:264` to `app/components/HotelCard.tsx:274`). The badge has the same 10-point thresholds and no source, scale, review count, or "provider-only" caveat (`app/components/HotelCard.tsx:32` to `app/components/HotelCard.tsx:49`).

This is the right location for deeper evidence, but the current content repeats the same unverified claim instead of clarifying it.

### 5. Search streaming preserves provider data but does not validate hotel quality evidence

`GET /api/search` calls `hotellook.searchHotels` only when destination and round-trip dates are present, then streams `hotelsResult.data` directly in the `hotels` NDJSON message (`app/api/search/route.ts:393` to `app/api/search/route.ts:414`). It handles availability, empty, and provider failure states, but it does not add or validate rating provenance before the client receives hotel offers.

That is acceptable for a UI-only first pass if the UI treats unknown rating evidence conservatively. It is not sufficient for any design that wants verified guest ratings with review counts.

### 6. Current result layout has a stable place for provenance but not enough fields

The hotel card already has a compact quality row under the hotel name (`app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:189`) and an expanded details section (`app/components/HotelCard.tsx:236` to `app/components/HotelCard.tsx:278`). These can support a two-level pattern: compact class/review summary in the collapsed card, then source/scale/review-count evidence in details.

The blocker is the payload contract. Without additional fields, UI implementation can only remove misleading guest-rating copy or mark the rating as unverified.

## Reference Pattern Comparison

### Booking.com

Booking.com separates three quality concepts: star ratings, review scores, and quality ratings. Its public explanation says star ratings are 1-5 stars and may come from service providers or independent third parties; review scores are 1-10 and come from customers; and quality ratings are Booking-assigned 1-5 square ratings. It also notes that review-score sorting factors in reliability through number of reviews.

Pattern takeaway: the UI must name the kind of signal before using it. A star class, a customer review score, and a platform-assigned quality rating are not interchangeable even when they all look numeric.

Current expaify delta: expaify has one `stars` field and one optional `rating` field, then renders both without source or scale. It uses 10-point review-score labels on a value that the current provider can derive from 1-5 star class.

### Google Hotels

Google distinguishes user rating scores from hotel class ratings. Google Hotel Center describes user ratings as 1-5 and explicitly says they differ from hotel class ratings; hotel class ratings are 1-5 star classifications based on sources such as partners, research, hotelier feedback, and inference.

Pattern takeaway: hotel quality UIs can show both class and review signals, but each signal needs its own label, source model, and unavailable state.

Current expaify delta: expaify shows star icons plus a numeric rating in one row, but there is no visible distinction between class and review evidence and no copy for unavailable or unverified guest ratings.

## Exact Gap

Current code does this:

- Stores `stars` and optional `rating` without semantic metadata.
- Copies Hotellook `stars` into `rating`.
- Treats every positive `rating` as displayable.
- Applies 10-point guest-score labels to unknown rating values.
- Omits source, scale, review count, and confidence copy from the card.

Reference patterns do this:

- Separate hotel class from customer review score.
- Name source or assignment responsibility when quality evidence is platform/provider-derived.
- Use scale-specific display patterns.
- Treat review count or reliability as part of the user's trust decision.
- Make external or aggregated review sources explicit.

The delta:

- expaify needs a rating provenance contract and conservative UI rules. Until a provider returns verified guest-rating metadata, the hotel card must not use guest-review labels like `Excellent`, `Very good`, or `Good`.

## Design Directives For UXDES

1. Separate hotel class from guest review score in hierarchy and copy.
   - Collapsed card must label star evidence as `Hotel class` or `Class`, not `Rating`.
   - Star class must be presented as `4-star hotel` or `4 of 5 hotel class`, not as a guest score.
   - Guest review score, when verified, must be a separate field with scale text such as `8.7/10 guest rating`.

2. Define strict display rules for guest-rating labels.
   - Only show qualitative labels like `Excellent`, `Very good`, or `Good` when the payload explicitly identifies the value as a guest review score and provides a compatible scale.
   - Do not show those labels for `stars`, unknown `rating`, inferred values, or provider-only values without scale.
   - For current Hotellook data, the safe default should be no guest-rating label unless a verified review field is added.

3. Specify a rating provenance data contract for DEV.
   - Required additions should include rating kind (`hotel_class`, `guest_review`, `provider_quality`, `inferred`, or `unknown`), source label, scale max, optional review count, optional freshness timestamp, and confidence (`verified`, `provider_only`, `inferred`, `unavailable`).
   - Do not invent review counts, freshness, or verification status in UI. Missing provider metadata must remain missing.
   - Existing `stars` can remain for backward compatibility, but design should state how legacy `rating` is treated until migrated.

4. Add explicit unknown and provider-only states.
   - If only star class exists: show hotel class and suppress guest-score copy.
   - If no star class exists: show `Class not provided` in details and omit decorative empty stars from the collapsed scan row unless the design defines a clear unavailable indicator.
   - If a provider returns a rating without review count: show source and scale, but use conservative copy such as `Review count not provided`.
   - If a rating is inferred or copied from star class: do not show it as a guest rating.

5. Put source confidence in the details region while keeping collapsed cards scannable.
   - Collapsed card should show only the safest compact evidence: hotel class, verified guest rating if available, and nightly price.
   - Expanded details must show source, scale, review count or `Review count not provided`, and confidence copy.
   - Screen-reader text must include the same distinction between class and guest rating; star icons alone are not sufficient.

## Acceptance Criteria For UXDES

- The design spec covers default, verified guest rating, star-class-only, rating-without-review-count, inferred/unknown rating, no rating/class, loading, empty, error, mobile 375px, desktop 1280px, focus/keyboard, and assistive-tech text.
- The design never allows `Excellent`, `Very good`, or `Good` for a value copied from `stars`.
- The design provides final copy for star class, verified guest rating, source, scale, review count, missing review count, unknown rating, and provider-only evidence.
- The design identifies whether UI-only work is sufficient. Current evidence says a complete solution requires DEV because `HotelOffer` lacks provenance fields and Hotellook currently mis-maps `stars` into `rating`.
- At 375px, a user can distinguish `Hotel class` from `Guest rating` without opening the provider link or relying on icon color.

## Out Of Scope Findings

- This ticket should not change hotel provider selection, scoring, booking handoff, or hotel availability behavior.
- Hotel result sorting is not currently driven by rating confidence. If future ranking uses ratings, it must not treat unknown or inferred values as verified guest scores.
- Existing provider and API route tests intentionally assert the current `rating: stars` behavior. UI/DEV stages will need to update tests when the data contract changes.
