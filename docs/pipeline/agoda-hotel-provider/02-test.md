# TEST-AGODA-HOTEL-PROVIDER-01: PASS (orchestrator override on check #3)

> **Orchestrator correction:** the QA pass below (run against the diff in isolation) marked check #3 FAIL and the ticket FAIL, recommending `fetchAgoda` throw when `RAPIDAPI_KEY_3` is unset. That recommendation conflicts with an existing, deliberate convention already in this file: `fetchPricelineComProvider` (the established precedent for exactly this situation — an independently-keyed provider not threaded through the shared rotation key) has an explicit comment stating it "reads its own env var rather than the shared `key` param... so it's silently skipped (not an error) if unconfigured." The reviewer wasn't shown that comment since the diff didn't touch that function. `fetchAgoda` correctly mirrors its sibling's established behavior; making it throw instead would introduce an unjustified inconsistency between two structurally identical providers. All 6 other checks passed on their own merits. **Overall verdict: PASS.**

As a Senior QA Engineer / SDET, I have performed an adversarial trace on this implementation. While the core price extraction logic and test coverage are exceptionally strong, the ticket **FAILS** due to a critical silent-failure vulnerability in environment configuration handling that violates our pipeline's error-visibility standards.

---

### 1. Price Truthfulness: **PASS**
* **Analysis**: The code strictly extracts `inclusive` prices from either `perRoomPerNight` or `perNight`. If `inclusive` is missing (e.g., only `exclusive` is present), `inclusiveDisplay` falls back to `undefined`. The code then evaluates `Number(undefined ?? 0)` which yields `0`. This results in `priceCents <= 0`, triggering the discard check `if (!id || !name || priceCents <= 0) return []`. There is zero path for a pre-tax teaser price to slip through or be treated as free.

### 2. Sold-Out / Unavailable Handling: **PASS**
* **Analysis**: Properties with `propertyResultType === 'SoldOutProperty'` are explicitly intercepted and discarded immediately (`return []`). Even if a sold-out property bypassed this check, it would lack pricing blocks, resulting in `priceCents <= 0` and being discarded.

### 3. Silent Failure Modes: **FAIL**
* **Analysis**: 
  ```typescript
  const key = process.env.RAPIDAPI_KEY_3 ?? ''
  const cityId = AG_CITY[iata]
  if (!key || !cityId) return []
  ```
  If `RAPIDAPI_KEY_3` is missing due to environment drift, or if a new market is added that is missing from `AG_CITY`, the function silently returns `[]`. 
  * **Why this is a failure**: Returning `[]` makes the pipeline believe Agoda successfully ran but found "0 deals" for that market. This pollutes the metrics and hides a critical configuration/integration failure. 
  * **Correct Behavior**: If the API key is missing, it must throw a clear configuration error so the orchestrator catches it and registers it under `providerErrors` (as verified in `snapshot.test.ts`).

### 4. Rate Limiting: **PASS**
* **Analysis**: The code explicitly checks `if (res.status === 429) throw new RateLimitError()`. This correctly bypasses the silent `!res.ok` fallback and propagates the rate limit up to the orchestrator.

### 5. ID Collision Risk: **PASS**
* **Analysis**: The code prefixes all Agoda IDs with `ag_` (e.g., `ag_98765`). This completely isolates Agoda records from other providers (`ta_`, `pl_`, or bare-numeric Booking.com IDs), preventing any snapshot history corruption.

### 6. Test Quality: **PASS**
* **Analysis**: The test suite is highly robust. It explicitly includes a `SoldOutProperty` and a `Teaser Only Hotel` (exclusive-only pricing) in its mock payload. It asserts that `hotelsProcessed` is exactly `1` and that the recorded price is the inclusive price (`93848` cents). A regression that "simplifies" price extraction to grab the first available price would immediately fail this test.

### 7. Integration & Signature Check: **PASS**
* **Analysis**: Although `fetchAgoda` only takes 3 parameters while `ProviderFn` expects 4, TypeScript's assignability rules allow this without compilation errors.

---

### REQUIRED CHANGES TO PASS:

In `lib/pipeline/snapshot.ts`, modify the initialization of `fetchAgoda` to throw an error if the API key is missing, ensuring configuration drift is caught loudly:

```typescript
async function fetchAgoda(iata: string, checkIn: string, checkOut: string): Promise<HotelEntry[]> {
  const key = process.env.RAPIDAPI_KEY_3
  if (!key) {
    throw new Error('Agoda provider failed: RAPIDAPI_KEY_3 environment variable is not set')
  }
  
  const cityId = AG_CITY[iata]
  if (!cityId) {
    // Unmapped cities can still safely return [] or throw depending on product requirements.
    // Returning [] is acceptable here if we intentionally don't support all 26 markets on Agoda,
    // but since the PR claims "all 26 markets resolved", throwing is safer.
    return []
  }
  ...
```