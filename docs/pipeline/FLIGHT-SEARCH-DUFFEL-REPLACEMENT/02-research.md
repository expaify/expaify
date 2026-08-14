# UX Research Brief: Resolving Parallel Flight Search Degradation (Expaify.com)

## 1. Audit Summary
The codebase currently relies on `DuffelProvider` (`lib/providers/duffel.ts`) as a parallel flight search provider alongside Google Flights. A direct audit of this file reveals the following architectural behaviors:

*   **API Targeting & Structure**: The search executes against `${BASE_URL}/air/offer_requests` via a `POST` request. Parameters (origin, destination, dates, passengers, and cabin class) are serialized into the body.
*   **Result Validation & Parsing**:
    *   The provider uses `isDuffelOfferResponse` to type-guard incoming JSON.
    *   It maps raw offers into the standard `NormalizedFare` contract (`lib/types.ts`) using helper functions: `decimalStringToCents` for integer financial representation, and `normalizeDuffelSliceItinerary` to resolve flights into a `NormalizedItinerary` (handling segments via `buildConfirmedItinerary` or falling back to `buildPartialItinerary` / `unavailableItinerary`).
*   **The Silent Empty-Result Trap**:
    *   When the Duffel API is fully functional (returning `HTTP 200 OK`) but has zero live inventory for a given route/date combination, `json.data.offers` evaluates to an empty array `[]`.
    *   `isDuffelOfferResponse` identifies this as a valid structure. The code maps this empty array into an empty `fares` array, caches it via Redis (`cache.set(cacheKey, fares, CACHE_TTL)`), and returns `{ ok: true, data: [] }`.
    *   Because `{ ok: true }` is returned, the orchestrator (`app/api/search/route.ts`) treats this as a clean, successful execution. It records zero operational errors, writes nothing to the `debug:duffel:last_error` log, and merges the empty results silently into the final UI payload. 
    *   **The UX Consequence**: The system cannot programmatically distinguish between a genuine "no flights exist on this route" scenario and a silent provider/contract failure. This masks critical inventory gaps on high-intent routes like JFK -> CDG, where Google Flights successfully finds 108 options while Duffel returns 0.

---

## 2. Reference Pattern Comparison: Google Flights
To resolve silent degradations in multi-source federated search, we contrast our implementation with the interaction pattern established by **Google Flights**:

| Interaction Dimension | Expaify Current State | Google Flights Pattern |
| :--- | :--- | :--- |
| **Progressive Disclosure of Source Health** | Binary load state. The search UI blocks or loads fully based on the parallel `Promise.all` pool. If a provider silently returns `[]`, the UI displays the remaining results with zero indication that a provider search failed or yielded nothing. | Real-time progressive loading bar showing explicit query status of partner networks. If a major provider/airline system is unreachable or yields empty sets, the system degrades gracefully with clear UI notices. |
| **Zero-Result Transparency** | Shows 0 results (if all providers fail) or shows only Google Flights results with no explanation of missing options. No user-facing fallback suggestion. | Contextual feedback. If a specific filter, route, or provider returns zero matches, Google Flights explicitly states the gap (e.g., *"No direct flights found on this date. Showing flights with stopovers"* or *"Some partner airlines could not be reached. Try refreshing."*) |
| **Silent Fail Graceful Degradation** | If HTTP errors occur, they are caught and logged silently to Redis (`debug:duffel:last_error`), returning `{ ok: false }` to the orchestrator. The user is left unaware of the limited scope of their search. | Continues displaying cached or partial partner pricing immediately, warning the user that some real-time pricing may be temporarily unavailable, preserving trust in the system's comprehensiveness. |

---

## 3. The Exact Gap
The alignment gap spans three dimensions: current execution, standard reference patterns, and hard technical blockers.

```
[ Current Code ] ──> Merges {} silently ──> False sense of "0 results"
                                 │
[ Google Flights ] ──> Progressive loading & transparency of missing sources
                                 │
[ Technical Blocker ] ──> ALL 5 RapidAPI keys returned 403/429 "not subscribed"
```

1.  **Current Code vs. Reference Pattern**: The current code lacks telemetry exposure. It passes empty arrays upstream as successful runs. The UI has no mechanism to display partial provider availability or report system-level degradation to the user.
2.  **The Hard Technical Blocker (Sky Scrapper Access)**: We cannot build or verify a replacement provider integration today. During live verification, **every single one of the 5 currently-held RapidAPI keys returned a 403 or 429 "not subscribed" error** against `sky-scrapper.p.rapidapi.com/api/v1/flights/searchAirport`. 
3.  **The Functional Gap**: Because we cannot make a successful API call, the exact shape of Sky Scrapper's search response remains unverified in this environment. Writing integration mappings to the `NormalizedFare` contract based purely on public API documentation is highly volatile, as real-world payload variations (especially around cabin classes, stop structures, and carrier IDs) cannot be validated.

---

## 4. Design & Engineering Directives

### Directive 1: Mandate RapidAPI Key Verification & Key Sandbox Testing (Blocker Resolution)
*   **Action**: Before any UX design layouts or engineering tasks are assigned to replace Duffel, a valid, subscribed Sky Scrapper RapidAPI credential must be provisioned.
*   **Verification**: A automated integration test script must be run against `sky-scrapper.p.rapidapi.com/api/v1/flights/search` using the live key. The returned JSON must be captured and saved as a static mock fixture (`tests/fixtures/sky-scrapper-search.json`) to serve as the ground truth for downstream TypeScript mapping validation.

### Directive 2: Eliminate Duffel's Ambiguous Zero-Result Path
*   **Action**: Refactor the search response interface to expose operational metadata.
*   **Implementation**: Modify the returned structure of `FlightProvider.searchFares` to return metadata along with fares:
    ```typescript
    export interface ProviderSearchResult {
      ok: boolean;
      data: NormalizedFare[];
      meta: {
        providerName: string;
        rawResultCount: number;
        latencyMs: number;
        isCached: boolean;
        executionWarning?: string; // e.g., "Empty payload returned from provider API"
      };
      reason?: string;
    }
    ```
*   **Verification**: If a route query returned 0 fares from Duffel but succeeded at the transport level, write an execution warning flag so the orchestrator can identify that a primary GDS/NDC pipeline yielded zero inventory.

### Directive 3: Enforce Strict NormalizedFare Contract Safeguards
*   **Action**: The replacement API integration must transform nested Sky Scrapper objects to map perfectly to `NormalizedFare` without modifying downstream UI-dependent fields.
*   **Implementation**:
    *   Price fields must be safely converted to integer cents (e.g., `$108.50` parsed precisely to `10850` using an equivalent to `decimalStringToCents` to prevent floating-point calculation errors).
    *   Itinerary fields must utilize `buildConfirmedItinerary` or fall back to safe defaults using `buildPartialOrUnavailable` to prevent `undefined` properties from breaking frontend list filters.

### Directive 4: Design Progressive Inventory Loading Indicators (UX Target)
*   **Action**: Ensure the search results interface displays a non-blocking indicator of search coverage.
*   **Implementation**: Include a status bar indicating: *"Searching partner networks..."* If the replacement provider fails or returns zero results while Google Flights succeeds, display: *"Showing results from Google Flights. Partner networks are currently offline."* This prevents users from assuming Expaify is broken or that zero inventory exists on the route.

---

## 5. Recommendation

### **HOLD AT UX RESEARCH (UXR)**

#### Reasoning:
Proceeding to UX Design (UXDES) or Engineering at this stage introduces significant risk and waste. Designing a UI around a replacement provider (Sky Scrapper) whose API we cannot currently query is impossible to execute with high fidelity. 

Until we resolve the **403/429 "not subscribed" blockers** on our RapidAPI credentials, we cannot verify payload performance, actual request-response latency, or field mapping reliability. Without a verified `sky-scrapper-search.json` payload, UX cannot design appropriate error states, progressive loading indicators, or mapping fallbacks for missing itinerary fields. We must secure a working, subscribed API key and record a successful live response before transitioning this ticket to UX Design.