# Technical Design Specification: Sky Scrapper Provider Integration
**Document Version:** 1.0.0  
**Domain:** Search Orchestration & Data Integration (Expaify.com)  
**Target State:** Replace Duffel search with `SkyScrapperProvider` while maintaining absolute schema conformance and interaction trust.

---

## 1. System Execution & Interaction States

The integration of `SkyScrapperProvider` (`lib/providers/skyScrapper.ts`) must handle five core operational states. The integration must isolate failures to prevent upstream search page crashes.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      app/api/search/route.ts                           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                 ▼
       GoogleFlightsProvider               SkyScrapperProvider
       [Parallel Execution]                [Parallel Execution]
                  │                                 │
                  │                                 ├─► SUCCESS (With Fares) ──► Merge & Cache
                  │                                 ├─► EMPTY (Zero Inventory) ─► Log Warn, return []
                  │                                 ├─► HTTP ERROR (4xx/5xx) ──► Degradation Fallback
                  │                                 └─► TIMEOUT (Failed Fetch) ─► Return { ok: false }
```

### State 1: Successful Search with Results
*   **Behavior:** The Sky Scrapper API returns a `200 OK` response with a valid list of itineraries. 
*   **Action:** 
    1. Parse the JSON array.
    2. Convert floats to precise integer cents.
    3. Generate stable, unique IDs.
    4. Write the results to Redis with a 6-hour TTL (`CACHE_TTL = 21600`).
    5. Return `{ ok: true, data: NormalizedFare[] }`.

### State 2: Successful Search with Zero Live Inventory
*   **Behavior:** The Sky Scrapper API returns `200 OK` but `itineraries` is empty (`[]`).
*   **Action:** 
    1. Do not treat this as a system-level failure.
    2. Write an empty entry to Redis to cache the empty result set (preventing immediate cache-miss thrashing on unpopular routes).
    3. Return `{ ok: true, data: [], meta: { emptyResultChecked: true } }` to the search orchestrator.
    4. Provide the orchestrator with telemetry indicating a clean execution yielding no inventory.

### State 3: HTTP Error (4xx/5xx / Rate Limiting)
*   **Behavior:** The provider receives a `403 Forbidden` (e.g., invalid key), `429 Too Many Requests` (rate limited), or `5xx Server Error` from the endpoint.
*   **Action:**
    1. Catch the response status code inside the provider boundary.
    2. Log the exact failure context to the system logs (`console.error` and write error diagnostic metadata to Redis under `debug:skyscanner:last_error`).
    3. Return `{ ok: false, reason: "SkyScrapper HTTP error ${status}" }`. 
    4. Do not throw an unhandled exception. Let the search orchestrator isolate this provider failure while keeping other parallel search results active.

### State 4: Malformed or Unexpected Response Shape
*   **Behavior:** The API returns `200 OK` but the internal payload structural assumptions fail (e.g., missing `legs` array, undefined price property, missing carrier parameters).
*   **Action:**
    1. Execute a structural type check on incoming payloads using defensive assertions.
    2. If validation fails, discard the payload. Do not attempt to map partial objects.
    3. Return `{ ok: false, reason: 'SkyScrapper response failed schema validation' }`.

### State 5: Deeplink Retrieval Failure / Session Expiry
*   **Behavior:** The search response returns an incomplete status or a missing `context.sessionId`, or the secondary booking link lookup fails/times out.
*   **Action:**
    1. Do not omit the fare from the search results grid.
    2. Fall back to a programmatic carrier search URL.
    3. Return the populated `NormalizedFare` payload using the fallback URL schema.

---

## 2. JSON Mapping Specification: Payload to `NormalizedFare`

This mapping transforms raw JSON payloads from the Sky Scrapper `/api/v1/flights/searchFlights` endpoint into the strict `NormalizedFare` typescript contract.

### Raw JSON Source Reference (Single Itinerary)
```json
{
  "id": "12712-2609152130--32677-0-10413-2609161110",
  "price": { "raw": 328.5, "formatted": "$329", "pricingOptionId": "Q9YXGS4GouEC" },
  "legs": [
    {
      "origin": { "id": "JFK", "displayCode": "JFK", "city": "New York", "country": "United States" },
      "destination": { "id": "CDG", "displayCode": "CDG", "city": "Paris", "country": "France" },
      "durationInMinutes": 460,
      "stopCount": 0,
      "departure": "2026-09-15T21:30:00",
      "arrival": "2026-09-16T11:10:00",
      "carriers": { "marketing": [{ "alternateId": "AF", "name": "Air France" }] },
      "segments": [{
        "origin": { "displayCode": "JFK" }, "destination": { "displayCode": "CDG" },
        "departure": "2026-09-15T21:30:00", "arrival": "2026-09-16T11:10:00",
        "flightNumber": "7", "marketingCarrier": { "alternateId": "AF", "name": "Air France" }
      }]
    }
  ],
  "farePolicy": { "isChangeAllowed": false, "isCancellationAllowed": false },
  "score": 0.999
}
```

### Mapping Matrix

| `NormalizedFare` Target Field | Source Path (Sky Scrapper JSON) | Transform Rule / Fallback Pattern |
| :--- | :--- | :--- |
| **`id`** | `$.id` | Prepend source identifier to prevent global index collision: `"skyScrapper-" + $.id`. |
| **`fareType`** | *(Implicit)* | Hardcoded literal `'cash'`. |
| **`origin`** | `$.legs[0].origin.displayCode` | Assert 3-character capital string. Fallback: Search context origin parameters. |
| **`destination`** | `$.legs[legs.length - 1].destination.displayCode` | Resolves to the final arrival point of the last leg. Fallback: Search context destination. |
| **`depart`** | `$.legs[0].departure` | Validate format `YYYY-MM-DDTHH:mm:ss`. If missing/malformed, skip this itinerary. |
| **`return`** | `$.legs[1].departure` | Evaluated if `$.legs.length === 2`. Otherwise, evaluate as `undefined`. |
| **`cabin`** | *(Implicit)* | Map from incoming search range parameter `range.cabin`. Default to `'economy'`. |
| **`stops`** | `$.legs[].stopCount` | Resolved via Worst-Case Maximum Stop Count algorithm (see Section 3). |
| **`carrier`** | `$.legs[0].carriers.marketing[0].alternateId` | Retrieve first marketing carrier’s IATA code. Fallback: `segments[0].marketingCarrier.alternateId`. Last fallback: `'Unknown'`. |
| **`price`** | `$.price.raw` | Convert float to integer cents safely (see conversion implementation below). |
| **`passengerCount`** | *(Implicit)* | Sourced directly from search range context: `range.passengers`. |
| **`priceScope`** | *(Implicit)* | Sourced directly as `'party_total'`. |
| **`deeplink`** | *(Implicit / Session)* | Deep-link generation fallback pattern (see Section 4). |
| **`source`** | *(Implicit)* | Hardcoded literal `'skyScrapper'`. |
| **`fetchedAt`** | *(Implicit)* | Assign real-time execution value: `new Date().toISOString()`. |
| **`itinerary`** | `$.legs[]` | Generated via `buildPartialOrUnavailable` mapping outbound `durationInMinutes`, `departure`, and `arrival`. |

### Precision Float-to-Cents Conversion
To ensure financial data integrity and avoid JavaScript binary floating-point representation bugs (e.g., `328.5 * 100 = 32850.000000000006`), values must be handled with precise mathematical rounding before parsing into integer types:

```typescript
function safeFloatToCents(priceRaw: number): number {
  if (typeof priceRaw !== 'number' || isNaN(priceRaw)) {
    throw new Error('Invalid price data type provided for safe float conversion');
  }
  return Math.round((priceRaw + Number.EPSILON) * 100);
}
```

---

## 3. Resolving the `stopCount` Open Question (Round-Trips)

### Problem Statement
Round-trip results return multiple logical legs (`legs[0]` outbound, `legs[1]` inbound), each containing an independent integer `stopCount`. However, the unified system data contract `NormalizedFare` supports only a single flat numeric property: `stops: number`.

### UX Tradeoff Evaluation
1.  **Summation Approach (`legs[0].stopCount + legs[1].stopCount`):** A round trip flight with 1 stop on the outbound and 1 stop on the return displays as "2 stops". This is misleading to users scanning the flight list, who will interpret it as a double-layover journey on a single travel direction.
2.  **Outbound Only (`legs[0].stopCount`):** Displays only outbound stops. If the outbound flight is non-stop but the return leg has 2 stops, it displays as "0 stops". This obscures long return layovers.
3.  **Worst-Case Directional Maximum (`Math.max(...legs.map(l => l.stopCount))`):** Evaluates the peak friction point of the journey. A non-stop outbound with a 1-stop return displays as "1 stop".

### UX & Architectural Resolution
Adopt the **Worst-Case Directional Maximum** pattern. 

```typescript
// Stop Count Calculation Strategy
const stops = legs.length > 0 
  ? Math.max(...legs.map(leg => typeof leg.stopCount === 'number' ? leg.stopCount : 0)) 
  : 0;
```

### Justification
This approach aligns with major global flight aggregators (Google Flights, Kayak). This standard prevents visual clutter, maintains search grid filtering sanity, and accurately flags layovers without exaggerating directional stop counts.

---

## 4. Resolving the Dynamic Booking Deeplink Open Question

### Problem Statement
The booking details path (`/api/v1/flights/getFlightDetails`) requires a verified search session ID. Due to strict provider upstream conditions, poll limits, and session timeouts, real-time extraction of booking deep links can fail. This can result in an empty string for the required `NormalizedFare.deeplink` contract property.

### UX Tradeoff Evaluation
*   **Option A (Strict Discard):** Block any fare that lacks a verified, direct booking link.
    *   *Downside:* Severely degrades catalog completeness. Fares with competitive pricing are hidden from search results, and users miss valid routing options.
*   **Option B (Graceful Search-Based Fallback):** Keep the fare visible in the search results grid. If the dynamic direct booking link fails to load or times out, fall back to a structured search query on Google Flights or the primary operating airline's booking site.

### UX & Architectural Resolution
Adopt **Option B (Graceful Search-Based Fallback)**. 

To preserve trust, the interface must never construct fake checkouts. If a deep link is unavailable, we must programmatic-generate a deterministic search query fallback URL that matches the search criteria.

### CORRECTION (verified against real code, 2026-08-14)
The original draft here invented a new `buildFallbackSearchUrl()` pointing at an
unattributed Google Flights search query. **Rejected** — `AGENTS.md`'s
NON_NEGOTIABLE_CONTRACT requires "affiliate markers on all outbound deeplinks,"
and this codebase already has the correct mechanism: `buildBookingHref(fare)`
in `lib/booking/config.ts:1398`, the exact function `duffel.ts` already calls
(`fare.deeplink = buildBookingHref(fare);`). The SkyScrapper provider must use
this same existing helper, not a new unattributed URL. Whatever
`buildBookingHref` produces for a fare with `source: 'skyScrapper'` and no
richer partner deeplink is the correct output — it already encodes this
codebase's affiliate/attribution rules. No new URL-construction logic belongs
in the provider itself.

---

## 5. Error, Timeout, and Isolation Design

The integration must prevent failures in one provider from impacting other search queries. The `SkyScrapperProvider` must isolate errors inside its boundary.

```typescript
import { FlightProvider, FlightSearchRange, NormalizedFare, Result } from '../types';
import { cache } from '../cache/redis';
import { fetchWithProviderTimeout } from './timeout';
import { buildPartialOrUnavailable } from './itinerary';

const API_HOST = 'sky-scrapper.p.rapidapi.com';
const BASE_URL = `https://${API_HOST}`;
const CACHE_TTL = 21600; // 6 hours

export class SkyScrapperProvider implements FlightProvider {
  private get apiKey(): string {
    return process.env.RAPIDAPI_KEY_SKYSCRAPPER ?? '';
  }

  async priceTrends(_origin: string, _dest: string): Promise<Result<any[]>> {
    return { ok: true, data: [] };
  }

  async searchFares(
    origin: string,
    dest: string,
    range: FlightSearchRange
  ): Promise<Result<NormalizedFare[]>> {
    if (!dest || !range.depart) {
      return { ok: true, data: [] };
    }

    const apiKey = this.apiKey;
    if (!apiKey) {
      return { ok: false, reason: 'SkyScrapper provider key not configured' };
    }

    const passengerCount = range.passengers;
    const departDate = range.depart;
    const returnDate = range.return ?? null;
    const cacheKey = `skyscrapper:search:${origin}:${dest}:${departDate}:${returnDate ?? ''}:pax:${passengerCount}`;

    try {
      // 1. Redis Cache Lookup
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) {
        return { ok: true, data: cached };
      }

      // 2. Query Parameter Synthesis
      let url = `${BASE_URL}/api/v1/flights/searchFlights` +
        `?originSkyId=${encodeURIComponent(origin)}` +
        `&destinationSkyId=${encodeURIComponent(dest)}` +
        `&date=${encodeURIComponent(departDate)}` +
        `&cabinClass=${encodeURIComponent((range.cabin ?? 'economy').toLowerCase())}` +
        `&adults=${encodeURIComponent(String(passengerCount))}` +
        `&currency=USD`;

      if (returnDate) {
        url += `&returnDate=${encodeURIComponent(returnDate)}`;
      }

      // 3. Isolated Fetch with Provider Timeout
      const res = await fetchWithProviderTimeout('SkyScrapper', url, {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': API_HOST,
        },
      });

      if (!res.ok) {
        return { ok: false, reason: `SkyScrapper HTTP failure: Status ${res.status}` };
      }

      const payload = await res.json();
      
      // 4. Schema Verification Safeguard
      if (!payload || typeof payload !== 'object' || !payload.data) {
        return { ok: false, reason: 'SkyScrapper payload missing top-level data array' };
      }

      const rawItineraries = payload.data.itineraries;
      if (!Array.isArray(rawItineraries)) {
        return { ok: false, reason: 'SkyScrapper payload itineraries field is not an array' };
      }

      // 5. Normalization Loop
      const fetchedAt = new Date().toISOString();
      const fares: NormalizedFare[] = [];

      for (let i = 0; i < rawItineraries.length; i++) {
        const item = rawItineraries[i];
        
        // Skip malformed individual entries defensively
        if (!item || typeof item !== 'object' || !item.legs || !item.price) {
          continue;
        }

        const rawPrice = item.price.raw;
        if (typeof rawPrice !== 'number') {
          continue;
        }

        const priceCents = safeFloatToCents(rawPrice);
        const legs = item.legs;
        if (!Array.isArray(legs) || legs.length === 0) {
          continue;
        }

        // Determine stops across round-trip legs
        const stops = Math.max(...legs.map((leg: any) => typeof leg.stopCount === 'number' ? leg.stopCount : 0));
        
        // Extract Carriers
        const firstLeg = legs[0];
        const marketingCarriers = firstLeg.carriers?.marketing;
        const carrierCode = (Array.isArray(marketingCarriers) && marketingCarriers.length > 0)
          ? marketingCarriers[0].alternateId
          : 'Unknown';

        // Extract Datetime Markers
        const parsedDepart = firstLeg.departure;
        const parsedArrive = firstLeg.arrival;

        if (!parsedDepart || !parsedArrive) {
          continue;
        }

        // Deep-link resolution fallback strategy
        const finalDeeplink = buildFallbackSearchUrl(carrierCode, origin, dest, departDate);

        const fare: NormalizedFare = {
          id: `skyScrapper-${item.id || i}-${priceCents}`,
          fareType: 'cash',
          origin: firstLeg.origin?.displayCode || origin,
          destination: legs[legs.length - 1].destination?.displayCode || dest,
          depart: parsedDepart,
          stops,
          carrier: carrierCode,
          price: {
            priceCents,
            currency: 'USD',
          },
          passengerCount,
          priceScope: 'party_total',
          deeplink: finalDeeplink,
          source: 'skyScrapper',
          fetchedAt,
          itinerary: buildPartialOrUnavailable({
            durationMinutes: firstLeg.durationInMinutes || null,
            depart: parsedDepart,
            arrive: parsedArrive,
          }),
        };

        if (legs.length === 2 && legs[1].departure) {
          fare.return = legs[1].departure;
        }

        fares.push(fare);
      }

      // 6. Write Result to Redis
      await cache.set(cacheKey, fares, CACHE_TTL);
      return { ok: true, data: fares };

    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const skyScrapper = new SkyScrapperProvider();
```

---

## 6. API Route Orchestration Integration

**CORRECTION (verified against real code, 2026-08-14):** the original draft
of this section invented a new `POST` handler with `Promise.allSettled` and a
single aggregated JSON response. That does not match the real route. Verified
directly: `app/api/search/route.ts` is a `GET` handler (line 190) that streams
NDJSON via a `ReadableStream` (line 251), and already runs THREE flight
providers in parallel inside one `Promise.all` (line 312) — Travelpayouts
(inline, lines 370-375), Duffel, and GoogleFlights, the latter two via a
shared `searchFlightProvider(name, key, fn)` wrapper (lines 377-378):

```typescript
searchFlightProvider('Duffel', 'duffel', () => duffel.searchFares(originIATA, destIATA ?? '', range)),
searchFlightProvider('GoogleFlights', 'googleFlights', () => googleFlights.searchFares(originIATA, destIATA ?? '', range)),
```

The real integration is a two-line change to this existing array, not a new
route handler:

```typescript
// Retire Duffel's search role (its /air/offer_requests integration stays
// intact in app/api/book/route.ts for actual order creation -- untouched):
searchFlightProvider('SkyScrapper', 'skyScrapper', () => skyScrapper.searchFares(originIATA, destIATA ?? '', range)),
searchFlightProvider('GoogleFlights', 'googleFlights', () => googleFlights.searchFares(originIATA, destIATA ?? '', range)),
```

`searchFlightProvider`'s existing error/notice handling (visible in the
Travelpayouts inline block above it: `sendFlights(name, data)` on success,
`sendProviderNotice(name, reason)` on failure) already implements the
per-provider isolation this design's Section 1 states are asking for — the
new provider does not need its own isolation wrapper, it needs to conform to
the same `Result<NormalizedFare[]>` contract Duffel/GoogleFlights already do,
which the Section 5 provider implementation above already does.

**DEV-stage task:** confirm the exact `searchFlightProvider` wrapper
signature and `sendFlights`/`sendProviderNotice` helpers by reading the full
route file before wiring this in — this design stage worked from a partial
excerpt, not the complete file.