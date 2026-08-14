# UX Discovery Report: Resolving Parallel Flight Search Degradation (Expaify.com)

### 1. User Pain Point
When users execute a flight search, the complete silent failure of the Duffel provider artificially restricts available fare inventory and slows down perceived UI performance due to parallel timeout overhead, eroding user trust in Expaify's capability to deliver the best available deals.

### 2. Affected Audience and Flow Step
*   **Who is affected:** High-intent travelers and deal-monitors seeking comprehensive, price-competitive flight comparisons.
*   **Step in the flow:** The **Search Results Phase**—specifically the transition from inputting route criteria (e.g., origin, destination, dates) on the search interface to loading the interactive results grid. 

### 3. Measurable Signals of the Problem
*   **Discrepant Provider Yield:** During a live, parallel spot-check search (JFK -> CDG), GoogleFlights successfully returned **108 real results** while Duffel returned **0 results** under the same parameters.
*   **Isolated Route Failure:** The Duffel API key is functional and live (confirmed via a successful `GET /air/airlines` returning `200 OK`), but the `/air/offer_requests` flow is completely broken, returning empty arrays and generating recurring `debug:duffel:last_error` entries.
*   **Ticket Blockage:** Outstanding ticket `REPAIR-DUFFEL-ROOT-CAUSE-UNRESOLVED-01` remains blocked, indicating that the search failure cannot be resolved via configuration changes or key resets.

### 4. Solution Constraints
*   **Constraint A (Scope Isolation):** The ticket is strictly search-only; the ticket booking and order-creation system running via Duffel (`app/api/book/route.ts` and `createDuffelOrder`) must remain entirely untouched and operational, as a RapidAPI flight comparison API cannot replace GDS/NDC booking distribution.
*   **Constraint B (Data Integrity):** The payload from the replacement RapidAPI search provider must map perfectly to the existing `NormalizedFare` typescript contract (including fields for stops, cabin, pricing in cents, carrier, and itinerary structure) to ensure downstream UI components and filters do not break.
*   **Constraint C (Execution Latency & Timeout Alignment):** The new search provider must resolve within the existing execution threshold of the parallel `Promise.all` pool inside `app/api/search/route.ts` so that it does not introduce thread blockages or slow down GoogleFlights' native response time.

### 5. Success Statement
This is solved when a first-time user can execute a flight search and immediately see a highly competitive, diversified set of fares aggregated from both GoogleFlights and a reliable RapidAPI search replacement, without experiencing silent search failures, artificial inventory caps, or backend timeouts.