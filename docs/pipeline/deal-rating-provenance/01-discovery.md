# UXD-DEAL-RATING-PROVENANCE-01: Ambiguous Hotel Class vs. Guest Review Conflation in Deal Cards

### User Pain Point
Users are presented with a single, ambiguous star rating that silently conflates a hotel's physical property class (e.g., a 4-star luxury resort) with its subjective guest review score (e.g., a 2-star budget motel rated 4/5 by TripAdvisor guests), eroding product credibility and forcing users to leave the platform to verify what the "stars" actually mean.

### Who is Affected and Where
Travelers seeking high-value hotel deals are affected during the **deal feed browsing** and **deal detail evaluation** steps. When deciding whether to click through to book a deal, users cannot determine if a "4.5 stars" label represents a premium physical property or simply a well-liked budget property, stalling their decision-making process at the critical point of conversion.

### Measurable Signal of the Problem
* **Semantic Conflation in Database & UI:** In `lib/pipeline/snapshot.ts`, four rotating data providers write into the exact same `deals.stars` (`NUMERIC(2,1)`) column. Booking.com (`propertyClass`) and Priceline (`starRating`) supply *hotel class*, while TripAdvisor (`hotel.bubbleRating.rating`) supplies *guest review scores*. Both signals are rendered identically in `DealCard.tsx` and `LockedDealCard.tsx` as literal star icons (`starChars(deal.stars)`) with a generic "X stars" aria-label.
* **Discarded Trust Data:** Although the active, paid TripAdvisor16 RapidAPI subscription returns rich metadata (including review counts), this data is thrown away during ingestion (`HotelEntry`/`storeSnapshot`). Consequently, the UI displays zero review counts or source attributions, failing the owner's goal to "feel like an experience" and leaving a severe trust gap compared to OTAs.
* **Inadequate Prior Patches:** Two recent tickets (`REPAIR-DEALS-FAKE-STARS-01` and `REPAIR-DEALS-STARS-STRING-TYPE-01`) only addressed presentation-layer bugs (handling nulls and type coercion) without resolving this underlying data-conflation and trust issue. (Note: This is entirely distinct from the flight-search `HotelCard.tsx` tracking under `docs/pipeline/hotel-rating-source-confidence/`).

### Constraints
1. **Financial Precision:** Money must always be represented and processed as `{priceCents, currency}` structures, never as floating-point numbers.
2. **Rating Integrity:** Ratings must never be invented, defaulted, or fabricated; a null or absent rating must be rendered as such (e.g., "Not yet rated") rather than displaying a wrong, assumed, or placeholder value.
3. **Aesthetic & Semantic Accessibility:** The meaning, type (class vs. review), and source of a rating must be explicitly conveyed via text and screen-reader accessible attributes (e.g., `aria-label`), never relying solely on icon shapes, colors, or visual-only styling.

### Success Statement
This is solved when a first-time user can instantly and accurately distinguish between a hotel's physical class rating and its guest review score (with clear source attribution and review counts) while browsing and evaluating deals, without having to leave expaify to verify the rating's meaning on an external OTA.