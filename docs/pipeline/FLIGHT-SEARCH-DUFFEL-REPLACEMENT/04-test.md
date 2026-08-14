# STAGE 6: TESTING & QA AUDIT REPORT
**Target Product:** expaify.com  
**Feature under review:** Flight Search Provider Migration (Duffel $\rightarrow$ SkyScrapper)  
**Assigned QA Authority:** Senior QA Engineer / SDET (10+ years specializing in transaction-critical consumer quality gates)  
**Status:** **FAIL** (Defects block production release)

---

## 1. THE CRITICAL CHECK: Duffel Bug Reintroduction Analysis
**Vulnerability Status:** **HIGH RISK / REPRODUCIBLE VULNERABILITY FOUND**

### The Attack Vector: Silent Parsing Exclusions
While the code correctly handles top-level schema validation failures (returning `{ ok: false, reason: 'SkyScrapper response failed schema validation' }` if `payload.data.itineraries` is missing), it contains a **critical vulnerability** in the subsequent mapping block that reproduces the exact silent failure mode of the Duffel bug.

Inside `searchFares`, we execute:
```typescript
const rawItineraries = getItineraries(await response.json());
// ...
const fares = rawItineraries.flatMap((item, index): NormalizedFare[] => {
  if (!isRecord(item) || !isRecord(item.price) || !Array.isArray(item.legs) || item.legs.length === 0) {
    return [];
  }
  // ...
  const priceCents = typeof rawPrice === 'number' ? safeFloatToCents(rawPrice) : null;
  const legs = item.legs.filter(isRecord) as SkyScrapperLeg[];
  if (priceCents === null || legs.length !== item.legs.length) return [];

  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  if (!isDateTime(firstLeg.departure) || !isDateTime(firstLeg.arrival)) return [];
  
  // ...
  return [fare];
});
```

### Trace & Failure Mechanism:
1. **The Scenario:** The SkyScrapper API returns HTTP 200 with 50 valid flight options.
2. **The Trigger:** A subtle API change occurs upstream:
   * **Case A:** The price is returned as a string format (e.g., `price.raw: "328.50"` instead of `328.5`).
   * **Case B:** The upstream provider updates its datetime format slightly, adding or removing offsets that fail the strict regex pattern inside `isDateTime` (e.g., `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/`).
3. **The Execution Flow:**
   * Every single itinerary in the array fails one of these internal guards (`priceCents === null` or `!isDateTime(...)`).
   * The `flatMap` block silently discards every item, returning an empty array `[]` for `fares`.
4. **The Silent Failure:**
   * **No error is thrown.**
   * **No warning or diagnostic is logged** to the console or cache.
   * The code caches this empty result: `await cache.set(cacheKey, [], CACHE_TTL);` (poisoning the cache for **6 hours / 21,600 seconds**).
   * The function returns `{ ok: true, data: [] }`.

### Verdict on Critical Check:
This behaves **exactly** like the Duffel bug. To the end-user and the system monitor, there are "0 flights available" on this route. This is a false-negative that silently drops inventory, causing direct financial loss, and caching the failure state to guarantee persistence.

---

## 2. Field Mapping Correctness
**Vulnerability Status:** **SEVERE LOGICAL BUG FOUND**

### The Destination Mapping Bug (Round-Trips)
For a round-trip search (e.g., JFK to CDG), the returned payload contains two elements in the `legs` array:
* `legs[0]` (Outbound): Origin `JFK`, Destination `CDG`.
* `legs[1]` (Return): Origin `CDG`, Destination `JFK`.

The code maps the destination as follows:
```typescript
const firstLeg = legs[0];
const lastLeg = legs[legs.length - 1]; // On round-trip, this resolves to legs[1]

const fare: NormalizedFare = {
  // ...
  origin: airportCode(firstLeg.origin?.displayCode, origin), // Resolves to 'JFK'
  destination: airportCode(lastLeg.destination?.displayCode, dest), // Resolves to 'JFK' (legs[1].destination)
  // ...
};
```

### Impact:
For every round-trip flight search, the mapped `NormalizedFare` destination is written as the **origin airport** (`JFK` $\rightarrow$ `JFK`). 
* This breaks client-side routing, filtering, booking deep-links, and itinerary builders.
* The unit test suite actually validates this broken behavior as correct (line 88: `destination: 'JFK'`), asserting a buggy baseline instead of catching the error.
* **Correction required:** The trip's destination must be the destination of the *outbound* leg (`legs[0].destination`), not the return leg.

---

## 3. Error & Timeout Isolation
**Vulnerability Status:** **PASS**

* **Propagation Check:** Any exception thrown within `searchFares` during fetch, cache execution, or parsing is safely captured by the top-level `try/catch` and returned as `{ ok: false, reason: ... }`.
* **Promise Isolation:** In `app/api/search/route.ts`, the execution is correctly isolated within the wrapper `searchFlightProvider('SkyScrapper', 'skyScrapper', ...)`. If this provider fails, it does not propagate uncaught exceptions that would crash the other parallel providers (Travelpayouts, GoogleFlights) within the `Promise.all` block.

---

## 4. Cache Correctness
**Vulnerability Status:** **MINOR BUG FOUND**

* **Cache Collision:** The cache key schema generated by `buildCacheKey` is highly structured and includes `origin`, `dest`, `depart`, `returnDate`, `passengers`, and `cabin`. Key collision probability is negligible.
* **Diagnostic Cache Name Typo:**
  ```typescript
  await cache.set('debug:skyscanner:last_error', ...)
  ```
  The namespace utilized here is `'debug:skyscanner:last_error'`. This is a legacy/incorrect namespace (using *Skyscanner* instead of *SkyScrapper*), which will prevent diagnostic scripts looking for SkyScrapper telemetry from locating the records.

---

## 5. Regression Check
**Vulnerability Status:** **PASS**

* **Verification:** Checked the diff completely. No changes have been made under `app/api/book/` and no references to `createDuffelOrder` or Duffel booking states have been modified or deleted. The booking boundaries remain completely untouched and clean.

---

## Verdict & Actionable Remediation plan

### **VERDICT: FAIL**

This code cannot be deployed in its current state. The following modifications must be applied to pass the quality gate:

### Required Code Fixes:

#### 1. Eliminate Duffel Bug (Silent Empty Validation)
Modify the post-processing phase of `searchFares`. If the raw response had itineraries, but the parsed output is empty, throw a explicit schema-mismatch error instead of caching empty data and returning `{ ok: true }`.

```typescript
const rawItineraries = getItineraries(await response.json());
if (rawItineraries === null) {
  return { ok: false, reason: 'SkyScrapper response failed schema validation' };
}

// Keep track of the raw count
const rawCount = rawItineraries.length;

const fares = rawItineraries.flatMap((item, index): NormalizedFare[] => {
  // ... existing flatMap validation ...
});

// CRITICAL SENSITIVITY GUARD: Prevent silent mapping dropouts
if (rawCount > 0 && fares.length === 0) {
  console.error('[SkyScrapper] Zero fares mapped from non-empty API payload. Format mismatch suspected.');
  await cache.set('debug:skyscrapper:last_error', {
    kind: 'mapping_validation_failure',
    rawCount,
    at: new Date().toISOString(),
  }, 300).catch(() => {});
  
  return { ok: false, reason: 'SkyScrapper parsing validation discarded all results' };
}
```

#### 2. Fix Destination Mapping
Map the destination to the destination of the **first leg** (the outbound journey), not the last leg.

```typescript
const firstLeg = legs[0];
// Correct mapping logic:
const destinationCode = legs.length === 2 
  ? airportCode(firstLeg.destination?.displayCode, dest)
  : airportCode(legs[legs.length - 1].destination?.displayCode, dest);

const fare: NormalizedFare = {
  id: `skyScrapper-${typeof item.id === 'string' && item.id ? item.id : index}`,
  fareType: 'cash',
  origin: airportCode(firstLeg.origin?.displayCode, origin),
  destination: destinationCode, // Corrected turnaround point mapping
  // ...
};
```

#### 3. Update the Test Assertions
Modify the assertion in `skyScrapper.test.ts` to reflect the corrected destination logic and fix the baseline:
```typescript
// Inside the test "maps a real-shaped round-trip response..."
expect(result.data[0]).toMatchObject({
  id: 'skyScrapper-12712-2609152130--32677-0-10413-2609161110',
  origin: 'JFK',
  destination: 'CDG', // Must be verified as 'CDG', NOT 'JFK'
  // ...
});
```