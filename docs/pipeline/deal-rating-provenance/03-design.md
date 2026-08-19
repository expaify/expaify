# UXDES-DEAL-RATING-PROVENANCE-01: TripAdvisor Guest Review Data Contract and Pipeline Integration Spec

> **Orchestrator correction (verified against `lib/db/schema.sql` directly):** Section 3's SQL uses placeholder table names `active_deals` / `deals_snapshot` that do not exist in this repo. The two real tables with a `stars` column are **`price_snapshots`** (line 110) and **`deals`** (line 131). The DEV stage must run the migration against `price_snapshots` and `deals`, not the names below.

## 1. Correction to UXR Directive #2

This specification supersedes the previous proposal in `UXR-DEAL-RATING-PROVENANCE-01` regarding the creation of a new numeric-badge UI component for guest review scores. No new UI components or visual treatments shall be designed or implemented. The repository already contains a complete, production-grade guest-review data contract (`HotelReviewEvidence`) and rendering system (`GuestReviewEvidence` and `getGuestReviewScanLine`). This spec establishes the data pipeline, database schema changes, and mapping logic required to wire TripAdvisor's real API data to these existing components, alongside a semantic correction of the legacy `stars` field.

---

## 2. `stars` Field Redefinition (Semantic Narrowing)

To resolve the data-corruption bug where property-class ratings (e.g., 3-star hotel classification) and guest review scores (e.g., 4.3/5 TripAdvisor bubble rating) are collapsed into the same database column, the semantic meaning of the `stars` field is hereby narrowed:

*   **Definition:** Going forward, `deals.stars` and `ApiDeal.stars` must represent **property-class rating only** (the physical standard of the hotel, typically 1.0 to 5.0). It must never store guest review scores.
*   **Provider-Specific Pipeline Rules (`lib/pipeline/snapshot.ts`):**
    *   `fetchBookingCom15` / `fetchBookingComCoords`: Continue to map Booking.com's property-class rating to `stars`.
    *   `fetchPricelineComProvider`: Continue to map Priceline's `hotel.starRating` (property-class) to `stars`.
    *   `fetchTripAdvisor`: **STOP** writing `bubbleRating.rating` to the `stars` field. When TripAdvisor is the winning provider for a snapshot, the `stars` field must be set to `null` (unless a property-class rating is explicitly known from a merged secondary source). The TripAdvisor `bubbleRating` data must instead be routed exclusively to the new `review_evidence` pipeline detailed below.

---

## 3. Database Schema Migration

To persist the structured review data without altering existing columns or breaking backward compatibility, a single additive, nullable column must be appended to both active deal tables.

### SQL Migration Script
```sql
-- Migration: Add review_evidence column to deal tables
-- Safe to run online; does not lock tables or write default values.

ALTER TABLE active_deals 
ADD COLUMN IF NOT EXISTS review_evidence JSONB DEFAULT NULL;

ALTER TABLE deals_snapshot 
ADD COLUMN IF NOT EXISTS review_evidence JSONB DEFAULT NULL;

COMMENT ON COLUMN active_deals.review_evidence IS 'Serialized HotelReviewEvidence object containing structured guest review metadata';
```

---

## 4. Mapper Contract (`HotelEntry` → `HotelReviewEvidence`)

A new pure mapping function must be introduced to transform the raw TripAdvisor API response into a validated `HotelReviewEvidence` object. 

### Mapping Function Implementation

```typescript
import { HotelReviewEvidence } from '../types';

/**
 * Maps raw TripAdvisor16 bubble rating data to the strict HotelReviewEvidence schema.
 * Returns null if the bubbleRating object is absent or invalid.
 */
export function tripAdvisorBubbleRatingToReviewEvidence(
  rawHotel: {
    id: string;
    title: string;
    bubbleRating?: {
      rating?: number;
      count?: string;
    } | null;
  },
  providerPropertyId: string
): HotelReviewEvidence | null {
  // 1. Fail-fast: If bubbleRating is absent or null, do not construct an empty object.
  if (!rawHotel.bubbleRating) {
    return null;
  }

  const rawRating = rawHotel.bubbleRating.rating;
  const rawCount = rawHotel.bubbleRating.count;

  // 2. Validate and parse score
  const hasValidScore = typeof rawRating === 'number' && !isNaN(rawRating) && rawRating >= 0 && rawRating <= 5;
  
  // 3. Parse overallReviewCount: Strip all non-digit characters (e.g., "(600)" -> 600)
  let parsedCount: number | undefined = undefined;
  if (rawCount) {
    const cleanCountStr = rawCount.replace(/\D/g, '');
    if (cleanCountStr.length > 0) {
      const parsed = parseInt(cleanCountStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        parsedCount = parsed;
      }
    }
  }

  // 4. Construct the compliant HotelReviewEvidence object
  const evidence: HotelReviewEvidence = {
    schemaVersion: 1,
    state: hasValidScore ? 'ready' : 'not_provided',
    providerPropertyId: `ta_${providerPropertyId}`, // Ensure consistent namespacing
    providerId: 'tripadvisor16',
    
    // CRITICAL: Set to 'provider_only'. TripAdvisor API does not assert individual 
    // reviews are verified guests in this endpoint. This prevents getGuestReviewScanLine 
    // from rendering a "verified guest" badge prematurely, while allowing the full 
    // GuestReviewEvidence card to render on the booking flow.
    provenance: 'provider_only',
    
    sourceLabel: 'TripAdvisor',
    coverage: { kind: 'none' }
  };

  if (hasValidScore) {
    evidence.score = {
      value: rawRating,
      scaleMax: 5
    };
  }

  if (parsedCount !== undefined) {
    evidence.overallReviewCount = parsedCount;
  }

  // Explicitly omit ratingObservedAt to prevent timestamp fabrication.
  // The validation engine allows ratingObservedAt to be optional.

  return evidence;
}
```

---

## 5. Wiring Path (File-by-File)

```
[TripAdvisor API] 
       │
       ▼
1. lib/pipeline/snapshot.ts  ──(Maps raw JSON to HotelReviewEvidence & writes to DB)
       │
       ▼
2. Database (review_evidence JSONB column)
       │
       ▼
3. app/api/deals/route.ts    ──(Reads row, parses JSON safely, populates ApiDeal)
       │
       ▼
4. app/deals/DealFeed.tsx    ──(Passes deal.reviewEvidence to <DealCard>)
       │
       ▼
5. app/components/ui/DealCard.tsx ──(Passes evidence to getGuestReviewScanLine)
```

### 1. `lib/pipeline/snapshot.ts`
*   **Action:** Inside the TripAdvisor ingestion loop, call `tripAdvisorBubbleRatingToReviewEvidence(rawHotel, rawHotel.id)`.
*   **Action:** Pass the resulting object (or `null`) to the database insert/update query binding for the `review_evidence` column as a serialized JSON string (`JSON.stringify(evidence)`). Set `stars` to `null` for these records.

### 2. `app/api/deals/route.ts`
*   **Action:** Update the database query to select the `review_evidence` column.
*   **Action:** In the `toApiDeal` mapper function, safely parse the JSON column:
    ```typescript
    let parsedEvidence: HotelReviewEvidence | undefined = undefined;
    if (row.review_evidence) {
      try {
        // Parse and cast to type
        parsedEvidence = typeof row.review_evidence === 'string' 
          ? JSON.parse(row.review_evidence) 
          : row.review_evidence;
      } catch (e) {
        console.warn(`Malformed review_evidence JSON for hotel_id ${row.hotel_id}:`, e);
        // Fallback to undefined to prevent 500ing the API route
        parsedEvidence = undefined;
      }
    }
    ```
*   **Action:** Assign `parsedEvidence` to the `reviewEvidence` property of the returned `ApiDeal` object.

### 3. `app/deals/DealFeed.tsx`
*   **Action:** Locate the rendering loop where `<DealCard>` is instantiated.
*   **Action:** Update the instantiation to pass the new property:
    ```tsx
    <DealCard 
      deal={deal} 
      reviewEvidence={deal.reviewEvidence} // Threading the data contract
    />
    ```

### 4. `app/components/ui/DealCard.tsx`
*   **Action:** Ensure the component accepts `reviewEvidence?: HotelReviewEvidence` in its props interface.
*   **Action:** Verify that the existing call to `getGuestReviewScanLine(reviewEvidence)` is active. Because `provenance` is mapped as `'provider_only'`, `getGuestReviewScanLine` will return `null` (as designed, reserving the high-density card scanline for verified guest data). The deal card layout will remain clean and unaffected, while the data is preserved for downstream booking views.

### 5. `app/book/BookingFlow.tsx`
*   **Action:** Ensure the booking flow context maps `deal.reviewEvidence` to `hotelContext.reviewEvidence`.
*   **Action:** The existing `<GuestReviewEvidence>` component on line 567 will automatically detect the `'provider_only'` provenance and `'ready'` state, rendering the full breakdown card with the "TripAdvisor" source label, score, and review count.

---

## 6. States Table

| Data State | API Payload Representation | DB Representation | `DealCard` UI Output | `BookingFlow` UI Output (`GuestReviewEvidence`) |
| :--- | :--- | :--- | :--- | :--- |
| **Default / No Data** | `bubbleRating: null` or absent | `NULL` | Normal card layout; no review line. Legacy property `stars` displays class rating if available. | Component renders nothing or "Guest score not provided by this provider." |
| **Ready with Score & Count** | `{"rating": 4.5, "count": "(1,200)"}` | `{"schemaVersion": 1, "state": "ready", "provenance": "provider_only", "score": {"value": 4.5, "scaleMax": 5}, "overallReviewCount": 1200, "sourceLabel": "TripAdvisor", ...}` | Normal card layout; no scan line (hidden due to `provider_only` provenance). | Renders full card: "4.5/5" score, "1,200 reviews" count, and "TripAdvisor" attribution. |
| **Ready with Score, No Count** | `{"rating": 3.0}` | `{"schemaVersion": 1, "state": "ready", "provenance": "provider_only", "score": {"value": 3.0, "scaleMax": 5}, "sourceLabel": "TripAdvisor", ...}` | Normal card layout; no scan line. | Renders full card: "3/5" score, "TripAdvisor" attribution, count row omitted. |
| **Not Provided** | `{"rating": null}` | `{"schemaVersion": 1, "state": "not_provided", "provenance": "provider_only", "sourceLabel": "TripAdvisor", ...}` | Normal card layout; no scan line. | Renders: "Guest score not provided by this provider." |
| **Malformed / JSON Error** | Corrupted string in DB | Invalid JSON string | Normal card layout; no scan line. Server logs warning; does not crash. | Renders: "Guest review evidence is unavailable." |

### Responsive Layout & Wrapping Behavior
*   **Mobile (375px) & Desktop (1280px):** Because the TripAdvisor `provider_only` provenance correctly evaluates to `null` in `getGuestReviewScanLine`, no text is injected into the compact `DealCard` layout. This completely avoids text-wrapping and line-height collision bugs on narrow mobile screens.
*   **Booking Flow Card:** The full `<GuestReviewEvidence>` component uses a responsive CSS Grid (`dl` layout with `grid-cols-1 sm:grid-cols-3`). On mobile (375px), it stacks vertically; on desktop (1280px), it aligns horizontally. This behavior is already implemented and verified in production.

---

## 7. Compliance and Terms of Service (ToS) Note

*   **Attribution:** Mapping `sourceLabel: 'TripAdvisor'` ensures that all rendered states in the booking flow explicitly attribute the score and review count to TripAdvisor, satisfying partner display requirements.
*   **Caching & Storage:** The stored `HotelReviewEvidence` object contains only aggregate metrics (score and count) and metadata. No individual review text, user names, or review snippets are fetched, stored, or displayed. This strictly limits caching surface area and sidesteps TripAdvisor ToS restrictions regarding the local storage of user-generated content.