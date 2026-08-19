# UX Discovery Report: Flight Search Redundancy & Provider Vulnerability

### 1. User Pain Point
When a user runs a flight search and the single healthy, Google-style data source experiences an outage or rate limit, the system abruptly returns zero results or hangs, instantly shattering the user’s trust in expaify.com as a viable travel-monitoring tool and driving them to abandon the platform for mainstream competitors.

### 2. Affected Users & Flow Step
*   **Who is affected:** Price-sensitive, high-intent leisure travelers searching for active deals or relying on automated email/webhook alerts for route-monitoring.
*   **Step in the flow:** The **Search & Results Discovery** phase, specifically when initiating a new search (e.g., JFK to CDG) or when the background engine attempts to generate daily price snapshot comparisons.

### 3. Measurable Signal of the Problem
*   **Single Point of Failure (SPOF):** A recent system diagnostic revealed that while our primary flight provider (`google-flights2` via RapidAPI) successfully returned 108 real results on a spot check, our secondary provider (Duffel) returned 0 results. 
*   **Asymmetric Redundancy:** Unlike the hotel-search pipeline (`lib/pipeline/snapshot.ts`), which utilizes a robust 4-provider rotation pattern (`booking-com15`, `booking-com-coords`, `tripadvisor16`, and `priceline-com2`) to survive single-provider outages, the flight pipeline has no active fallback. If the single `google-flights2` API goes down, Kiwi (`lib/providers/kiwi.ts`) is the only other functional flight source, leaving the application critically vulnerable to data-blind spots and empty UI states.

### 4. Constraints
*   **Constraint A (Contract Adherence):** Any secondary or redundant provider must strictly map its data output to our existing `NormalizedFare` TypeScript interface (guaranteeing unified fields such as `id`, `fareType`, `origin`, `destination`, `depart`, `stops`, `carrier`, `price.priceCents`, `deeplink`, `source`, and a normalized `itinerary` block).
*   **Constraint B (Isolation/Stability):** The integration of any new backup provider must be entirely isolated from the healthy, verified `google-flights2.p.rapidapi.com` integration, ensuring zero modification of its endpoints, response mapping, or request logic.
*   **Constraint C (Latency & Cost Budget):** Because flight search providers are queried in parallel via `Promise.all` or a coordinated fetch pool, any redundant provider must execute within a strict timeout budget (matching our existing `fetchWithProviderTimeout` threshold, typically under 8,000ms) and operate within sustainable API call costs to avoid escalating our infrastructural burn rate.

### 5. Success Statement
This is solved when a first-time user can run a flight search during a primary provider outage without experiencing slow loading screens, missing price data, or encountering "no flights found" errors.

### 6. Candidate Options
*   **Option 1: SerpApi Google Flights Engine**
    *   *Description:* A dedicated search engine scraper that parses live results from google.com/travel/flights.
    *   *Strategic Value:* This leverage allows us to utilize the `SERPAPI_KEY` credential that is already pre-configured in our environment contracts (`AGENTS.md`) but currently dead/unused in the active codebase.
    *   *Verification Note:* The exact JSON response shape is **UNVERIFIED** and must be analyzed and mapped during technical spikes.
*   **Option 2: Skyscanner / TripAdvisor Wrapper (via RapidAPI)**
    *   *Description:* Third-party search wrappers hosted on RapidAPI that aggregate global flight fares.
    *   *Strategic Value:* Simplifies authentication and billing by routing requests through our existing RapidAPI infrastructure, avoiding the overhead of setting up a new vendor contract.
    *   *Verification Note:* Response shapes, consistency of currency conversions, and rate limits are **UNVERIFIED** until live test calls are executed.