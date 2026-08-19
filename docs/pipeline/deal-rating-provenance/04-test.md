# TEST-DEAL-RATING-PROVENANCE-01: PASS

## 1. Money/pricing regression risk: PASS
* **Analysis**: The SQL queries in `lib/pipeline/dealDetection.ts` and `lib/pipeline/snapshot.ts` were carefully updated to accommodate the new `review_evidence` column. The parameter indices in the `INSERT INTO price_snapshots` query were shifted correctly, and the test assertions in `lib/pipeline/__tests__/snapshot.test.ts` were updated from index `7` to `8` to match:
  ```typescript
  const priceCents = insertCall?.[1]?.[8]
  expect(priceCents).toBe(19456)
  ```
  The pricing, discount calculations, and deal-detection logic remain completely untouched and functionally isolated.

## 2. Backward compatibility: PASS
* **Analysis**: For existing rows where `review_evidence` is `NULL`, the API route handles this gracefully. In `app/api/deals/route.ts`, the parser checks `if (row.review_evidence)` before attempting to parse. If it is `null` or `undefined`, `parsedEvidence` remains `undefined`, and the field is omitted from the returned payload without throwing:
  ```typescript
  let parsedEvidence: HotelReviewEvidence | undefined
  if (row.review_evidence) { ... }
  ```

## 3. The stars-narrowing change: PASS
* **Analysis**: TripAdvisor-sourced hotels now correctly write `stars: null` to the database. To prevent stale, conflated guest-score values from lingering in the `deals` table, the `ON CONFLICT DO UPDATE` clause in `lib/pipeline/dealDetection.ts` explicitly overwrites the column:
  ```sql
  ON CONFLICT (hotel_id, market_id, check_in_date) DO UPDATE SET
    stars              = EXCLUDED.stars,
  ```
  This guarantees that any previously stored guest-score values in the `stars` field are overwritten with `NULL` upon the next snapshot/detection cycle.

## 4. JSON parse failure path: PASS
* **Analysis**: The parsing block in `app/api/deals/route.ts` is fully wrapped in a `try/catch` block. If `row.review_evidence` contains malformed JSON, the error is caught, logged via `console.warn`, and `parsedEvidence` remains `undefined`. The API route will return a `200 OK` instead of a `500 Internal Server Error`:
  ```typescript
  try {
    parsedEvidence = typeof row.review_evidence === 'string'
      ? JSON.parse(row.review_evidence) as HotelReviewEvidence
      : row.review_evidence as HotelReviewEvidence
  } catch (error) {
    console.warn(`Malformed review_evidence JSON for hotel_id ${row.hotel_id}:`, error)
  }
  ```

## 5. Test quality: PASS
* **Analysis**: The tests are robust and do not rubber-stamp the implementation. 
  * `route.test.ts` explicitly asserts both successful parsing and graceful degradation (returning 200 and omitting the field) when encountering malformed JSON.
  * `snapshot.test.ts` verifies that TripAdvisor bubble ratings are stored as `review_evidence` and that `stars` is written as `null`.
  * `tripAdvisorReviewEvidence.test.ts` covers edge cases including missing bubble ratings and `NaN` values, ensuring the mapper behaves deterministically.

## 6. User-facing regressions: PASS
* **Analysis**: The `DealFeed.tsx` component was updated to pass `reviewEvidence: deal.reviewEvidence` to `DealCard`. Since `npx tsc` compiled successfully, the `DealCard` contract already supports this property. No other UI components or data flows are negatively impacted.