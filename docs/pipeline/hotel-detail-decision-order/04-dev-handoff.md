# DEV handoff — Hotel detail continuity and instrumentation

**Source ticket:** `UI-HOTEL-DETAIL-DECISION-ORDER-01`  
**Requested ticket:** `DEV-HOTEL-DETAIL-CONTINUITY-01`  
**Priority:** P0

## Why DEV work is required

The UI now renders the shared hotel decision order using only facts supported by the current contracts. The `HotelCard` → `/book` contract still cannot preserve source-list state, stay dates, score evidence, freshness, or normalized hotel-fit evidence, and the saved-deal contract does not expose normalized location or rating provenance. The required decision-funnel events also do not exist. UI components must not infer these values.

## Scope

1. Add a server-validated hotel review/detail continuity model that can resolve:
   - entry source and a safe product-owned return URL with normalized query/filter state;
   - check-in, check-out, and night count;
   - Deal Score, usual nightly rate, confidence, and score state, or a stable server-side key for recomputation;
   - observed-rate timestamp and freshness state;
   - normalized hotel class and guest-rating evidence with provenance;
   - validated affiliate provider URL options.
2. Normalize the equivalent saved-deal fields, including explicit location precision and quality-evidence provenance. Do not infer them from `city`, `stars`, provider host, or display copy.
3. Validate serialized context server-side. Money remains `{ priceCents: number; currency: string }`; provider adapters retain `Result<T>` behavior; outbound URLs retain affiliate markers.
4. Implement and test the events specified by the design:
   - `hotel_detail_viewed`;
   - `hotel_decision_section_reached` after at least 50% visibility for at least one second, deduplicated once per section per detail view;
   - `hotel_room_handoff_started` before outbound navigation without delaying it;
   - `hotel_detail_back_to_results`.
5. Event properties are limited to `hotel_id`, `entry_source`, `viewport_group`, `has_dates`, `has_verified_guest_rating`, `score_state`, `price_freshness_state`, semantic `section`/`position`, and provider where applicable. Exclude raw URLs and personal data.
6. Mount and verify the currently unmounted `HotelCard` search-result path before claiming end-to-end parity.

## Acceptance criteria

- Search-result review restores its originating results URL and state; direct review uses the product-owned hotel-search destination; saved detail restores saved-feed state when supplied.
- Both entrants populate the existing five-section UI only from validated continuity data and keep the explicit missing states when a field is absent.
- No client-supplied money, provider URL, rating, date, or freshness value is trusted without server validation or server-owned resolution.
- Affiliate and sponsored-link semantics survive every review/detail and redirect path.
- Funnel events use the exact semantics above, deduplicate section reach, and never treat provider navigation as booking success.
- Typecheck and tests pass, including malformed-context, missing-field, return-state, affiliate-marker, and event-deduplication coverage.

## Out of scope

Room inventory, occupancy, amenities, cancellation values, booking/payment, calculated totals, provider ranking, and changes to Deal Score math.
