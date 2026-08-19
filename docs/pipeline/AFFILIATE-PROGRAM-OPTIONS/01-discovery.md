### 1. User Pain Point
When a user clicks a hotel or flight deal card expecting a seamless path to book a specific deal, they are redirected to a generic, unattributed Booking.com search page where they must manually re-select the hotel and dates, while alternative booking options (Expedia, Kiwi, Trip.com) are entirely missing from the interface due to account approval blocks.

---

### 2. Affected User Cohort and Flow Step
*   **Who is affected:** High-intent, deal-sensitive travelers who have discovered a specific deal on expaify.com and are attempting to transition from discovery to booking.
*   **Step in the flow:** The **post-search click-through / outbound booking handoff step**, where the user clicks the primary call-to-action (CTA) on a hotel or flight deal card.

---

### 3. Measurable Signal
The problem is hardcoded directly into the production codebase in `lib/pipeline/otaLinks.ts`. The metrics reflect:
*   **0% Attributed Link Click-Through Rate** for Expedia, Booking, Kiwi, and Trip.com due to `expedia`, `booking`, `kiwi`, and `trip` being hardcoded to `undefined`.
*   **100% Unattributed Fallback Leakage:** Every outbound hotel click is routed via `bookingSearchUrl` (`https://www.booking.com/searchresults.html?ss=${q}&checkin=${checkIn}&checkout=${checkOut}`), resulting in zero revenue attribution and an increased drop-off rate as users land on a search results list rather than a dedicated checkout page.
*   **High Redirect Failure History:** Prior attempts to force Travelpayouts integration resulted in a 100% error rate landing on a "traffic_source is not valid" page, proving the account-approval block is a hard operational gate.

---

### 4. Constraints
*   **Constraint A (Attribution Integrity):** The system must never emit an unattributed link disguised as an attributed link (matching the design principle in `otaLinks.ts` where the unattributed `bookingSearchUrl` is strictly separated from the `booking` field to prevent downstream flows like `CompareRow` or `HotelDealCriteria.tsx` from misidentifying it as a revenue-generating link).
*   **Constraint B (Zero-Regression Fallback):** The current working `bookingSearchUrl` fallback must remain fully functional and untouched as the baseline safety net while alternative direct integrations are phased in.
*   **Constraint C (Data Preservation):** Outbound affiliate links must not force or hardcode default search parameters (e.g., room count or traveler party size) that override the traveler's actual intent, ensuring the landing experience matches the user's expectations.

---

### 5. Success Statement
We will successfully resolve this when a user can click a deal card and immediately land on a partner-attributed, fully functional booking page with dates preserved, scaling expaify.com's outbound link monetization from 0% to a measurable baseline without exposing users to broker redirect errors.

---

### 6. Affiliate Program Comparison

| Program Path | Application Route | Eligibility Bar | Review Time | Commission | expaify.com Clearance (Current Traffic Level Unknown) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Booking.com** (Network Route) | CJ Affiliate (`cj.com/en-gb/publisher/partners/booking.com`) or Awin | Active website, blog, or social presence. (Note: Social-media-only profiles are **not** accepted; direct Partner Hub is restricted). | 1–5 business days | ~4% | **Unknown**. We must confirm expaify's current monthly traffic and verify we have enough active content to pass CJ's manual review. |
| **Trip.com** (Direct Portal) | Direct portal (`trip.com/partners`) or via Partnerize | Free to join. Requires profile details to be populated within **~3 minutes** of signup to unlock link generation. | Near-instant (automatic if profile completed in time) | Tiered up to 7% (scales up to 17% for high performers) | **Highly Likely**. There is no strict traffic volume minimum, making this the most viable immediate entry point if we act quickly during signup. |
| **Skyscanner Affiliates** | Impact.com (`partners.skyscanner.net/product/affiliates`) | Functional HTTPS website with **5,000+ monthly visitors** or an influencer with 1,000+ relevant followers; high-quality travel content. | Varies via Impact.com | Up to 20% on completed bookings | **Unknown**. If expaify.com's early-stage traffic is below 5,000 monthly visits, this route will be auto-rejected. |
| **Skyscanner Travel API** | Direct Application (`partners.skyscanner.net/product/travel-api`) | Manual review of technical implementation and business case. No per-call licensing fee, but access is highly restricted. | ~2 weeks | Subject to custom terms / API contract | **Unlikely**. Early-stage, low-traffic sites rarely pass the manual utility review required to secure active API keys. |

---

### 7. Strategic Recommendation

**First Priority: Trip.com (Direct Portal)**

**Why:** 
Because expaify.com is in an early-growth stage with unknown/low traffic, we cannot guarantee clearing Skyscanner’s strict 5,000 monthly visitor threshold or passing a rigorous manual review for the Skyscanner Travel API. Booking.com via CJ Affiliate is a strong secondary option, but it requires manual application review and an established content layout. 

The **Trip.com Direct Portal** has no published traffic minimums, is free to join, and allows near-instant link generation. This allows us to quickly replace the hardcoded `trip = undefined` in `otaLinks.ts` with a verified, revenue-generating, attributed URL format, establishing our first direct monetization path.

**Action Plan:**
1. Register directly at `trip.com/partners`.
2. **Critical UX Execution:** Ensure a team member is prepared to complete the profile details section immediately within the 3-minute post-registration window to unlock link creation.
3. Once approved, pull the affiliate ID and update `otaLinks.ts` using the correct URL parameters (restoring the logic from `REPAIR-TRIP-LINK-REMOVE-UNTIL-APPROVED-01`), moving Trip.com out of the `undefined` state for production traffic.