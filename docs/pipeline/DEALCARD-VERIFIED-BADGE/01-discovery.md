### 1. The User Pain Point
Travelers seeking genuine value dismiss high-percentage savings claims as marketing gimmicks or expired "clickbait" because the card displays raw audit metrics (such as price check counts and historical timelines) without explicitly labeling its underlying data as verified, eroding the platform's positioning as a trustworthy intelligence tool.

### 2. Who is Affected and at What Step
*   **Who:** Risk-averse, value-conscious leisure travelers who have been conditioned to distrust online travel agency (OTA) pricing tricks (e.g., false urgency, fake strikethroughs).
*   **When:** During the initial discovery and triage phase (scanning the deal feed, homepage, or search results page) when deciding whether to click "View deal" or abandon the platform due to perceived "too good to be true" rates.

### 3. The Measurable Signal
*   **Quantitative:** High card impression-to-detail click-through rate (CTR) drop-offs on high-discount deals, coupled with high rates of "exit intent" tracking (users copying the hotel name to search and verify pricing independently in another browser tab).
*   **Qualitative:** User testing sessions where participants express skepticism about the 30%–50% savings claims, dismissing the bottom text ("Based on X price checks...") as generic, unverified boilerplate rather than real-time transactional proof.

### 4. Three Constraints the Solution Must Respect
1.  **Data Integrity (Anti-Deceptive Patterns):** The verified indicator must never be a static visual gimmick; it must dynamically resolve from actual historical data, appearing only when the deal meets strict programmatic thresholds (e.g., minimum `snapshotCount` over the 60-day window and an active, non-expired `updatedAt` timestamp).
2.  **Visual Hierarchy and Layout Budget:** The badge/pill must integrate into the existing flex-flow of the `DealCard` without displacing high-priority conversion signals (like price, `DealChip`, and absolute checked time), preventing layout shifts (CLS) or card height bloating across responsive breakpoints.
3.  **Accessibility (WCAG 2.1 AA):** The verification status cannot rely solely on color (e.g., a green badge) to convey trust; it must feature high-contrast text and a clear screen-reader announcement (`aria-label`) that explains *why* the price is verified (e.g., "Verified savings based on actual price history").

### 5. Success Statement
This is solved when a first-time user can **instantly identify an active, high-discount deal as a legitimate, data-backed saving** without **leaving the platform to cross-reference and validate the price on a competitor's site.**