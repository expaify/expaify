# UXR-DEAL-RATING-PROVENANCE-01: Resolving Hotel Class and Guest Review Conflation in Deal Cards

### Executive Summary
A critical heuristic failure exists in the expaify deal feed: the platform conflates objective, property-declared **Hotel Class** (e.g., a 4-star physical property) with subjective **Guest Review Scores** (e.g., a 2-star budget motel with a 4.5/5 guest rating). By rendering both as identical star icons, the UI misleads users, erodes platform credibility, and forces users to leave the application to verify what the ratings actually mean. 

To restore trust and drive conversion, we must align our presentation layer with established industry standards (Booking.com and TripAdvisor) by strictly separating these two data dimensions in our database, API, and UI.

---

### Current vs. Reference Patterns

| Dimension | expaify Current Implementation | Booking.com Reference Pattern | TripAdvisor Reference Pattern |
| :--- | :--- | :--- | :--- |
| **Visual Metaphor** | Identical star icons (`★`) used for both property class and guest reviews. | **Stars** (yellow/grey) used *only* for official property class. **Numeric Badges** (e.g., `8.7`) used for guest reviews. | **Bubbles** (green circles) used *only* for guest review scores. Never uses star icons. |
| **Source Attribution** | Completely absent. Source data is discarded during ingestion. | Explicitly branded (e.g., "Booking.com Guest Review"). | Explicitly branded with TripAdvisor logo/text. |
| **Review Volume** | Completely absent. Review counts are discarded. | Mandatory accompaniment to guest score (e.g., "214 reviews"). | Mandatory accompaniment to bubble rating (e.g., "1,234 reviews"). |
| **Semantic Meaning** | Ambiguous. "4.5 stars" could mean luxury amenities or a clean budget motel. | Clear separation: "4-star Hotel" (amenities) vs. "8.5 Very Good" (experience). | Clear focus: "4.5 of 5 bubbles" represents subjective guest satisfaction. |

---

### UX Design Directives

#### 1. Database & API Schema Extension (Non-Breaking)
To preserve existing queries while capturing critical trust metadata, the data pipeline and schema must be extended to store rating type, source, and volume.
*   **Database Schema (`lib/db/schema.sql`)**: Add three new nullable columns to both deal tables:
    *   `rating_type TEXT` (constrained to `'class' | 'guest' | NULL`)
    *   `rating_source TEXT` (e.g., `'TripAdvisor' | 'Booking.com' | 'Priceline' | NULL`)
    *   `review_count INTEGER` (nullable)
    *   *Constraint*: Keep the existing `stars NUMERIC(2,1)` column as-is to prevent breaking downstream consumers.
*   **Data Ingestion (`lib/pipeline/snapshot.ts`)**:
    *   For `fetchTripAdvisor`: Map `hotel.bubbleRating.rating` to `stars`, set `rating_type = 'guest'`, `rating_source = 'TripAdvisor'`, and extract the sibling review count field to write to `review_count`.
    *   For `fetchBookingCom` / `fetchPriceline`: Map property class to `stars`, set `rating_type = 'class'`, set `rating_source` to the respective provider, and set `review_count = NULL`.
*   **API Layer (`app/api/deals/route.ts`)**: Map these three new fields directly to the `ApiDeal` response payload.

#### 2. Visual Differentiation (No Shared Star Metaphor)
The UI must never use star icons to represent guest review scores. In `DealCard.tsx` and `LockedDealCard.tsx`, implement a strict visual fork based on `deal.rating_type`:
*   **Property Class (`rating_type === 'class'`)**:
    *   Render using traditional star icons (e.g., `★★★★☆` using `starChars(deal.stars)`).
    *   Display inline text immediately following the stars: `X-star Hotel` (e.g., "4-star Hotel").
*   **Guest Review Score (`rating_type === 'guest'`)**:
    *   **Never** render star icons.
    *   Render as a numeric badge or text block showing the score out of 5 (e.g., `4.5 / 5`).
    *   Display the source and review count immediately adjacent: `[Score] / 5 ([Review Count] reviews) on [Source]` (e.g., "4.5 / 5 (1,240 reviews) on TripAdvisor").

#### 3. Strict Fallback & Null-State Logic
To maintain rating integrity under API failures or legacy data states, the UI must handle missing data without fabricating placeholders:
*   **No Rating Data (`deal.stars === null`)**:
    *   Render the text `"No rating available"` instead of `"Not yet rated"` (which falsely implies a rating is pending).
*   **Legacy Data / Missing Type (`deal.stars !== null` but `deal.rating_type === null`)**:
    *   Do not render star icons.
    *   Render only the raw numeric value as plain text to prevent false property-class attribution: `"Rating: [deal.stars] / 5"`.

#### 4. Semantic Accessibility & ARIA Specifications
Rating meaning, type, and source must be fully explicit to screen readers.
*   **For Property Class**:
    *   Wrap the star icons in a span with `role="img"` and an explicit, descriptive aria-label:
        ```tsx
        <span role="img" aria-label={`${deal.stars}-star property class`}>
          {starChars(deal.stars)}
        </span>
        ```
*   **For Guest Reviews**:
    *   Provide a descriptive aria-label that reads the entire rating context:
        ```tsx
        <span aria-label={`Guest rating: ${deal.stars} out of 5 based on ${deal.review_count} reviews on ${deal.rating_source}`}>
          {deal.stars} / 5 ({deal.review_count} reviews) on {deal.rating_source}
        </span>
        ```