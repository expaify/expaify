# TEST-SKYSCRAPPER-ENTITYID-FIX-01 — direct review

**Status:** PASS

## Checked directly

1. **Root cause confirmed correct**: SkyScrapper's real `searchFlights` endpoint requires both
   `originSkyId`/`originEntityId` and `destinationSkyId`/`destinationEntityId`. Missing entityId
   produced `{"status":false,"message":[{"originEntityId":"Invalid value"}]}` — confirmed live
   before this fix, and confirmed live in production (`expaify.com/api/search` returned
   `{"provider":"SkyScrapper","status":"unavailable"}` on every search).
2. **Fix mechanism reviewed**: new `resolveEntityId()` calls `searchAirport?query={IATA}`, scores
   candidates by exact `skyId` match + `entityType === 'AIRPORT'` preference, caches the result for
   30 days (entity IDs are stable), and `searchFares` now resolves both sides in parallel before
   building the search request. Failure on either side returns `{ ok: false, reason: ... }` — no
   throw, no silent fallback to the broken no-entityId request.
3. **The sort logic is not decorative — verified it's load-bearing**: queried the real API for
   `LHR` directly. The first result in the raw response is a CITY entry (`skyId: "LOND"`), *not*
   the airport — the real AIRPORT match (`skyId: "LHR"`, entityId `95565050`) is second in the
   list. Without the exact-skyId-match scoring, a naive "take the first result" implementation
   would have resolved LHR to London-the-city's entityId instead of the airport's, likely
   producing wrong or degraded results. Same pattern confirmed for `JFK` (first result is a CITY
   "NYCA" entry, airport match is second).
4. **End-to-end live verification, not just unit tests**: resolved real entityIds for LHR
   (`95565050`) and JFK (`95565058`) via the live `searchAirport` endpoint, then called the real
   `searchFlights` endpoint with all four params exactly as the fixed code now sends them. Result:
   `HTTP 200`, `"status":true`, **8 real itineraries** with real prices (e.g. $953). This
   reproduces the actual fix working end-to-end against the real third-party API, not just against
   mocked test fixtures.
5. **Independent build verification** (rebased onto `main` first — this worktree branched before
   the shadcn/Magic UI infra ticket merged, so `npx tsc` initially failed on missing
   `@radix-ui/react-slot`/`class-variance-authority`/`clsx`/`tailwind-merge`, exactly as Codex's own
   honest report flagged; this is unrelated to the SkyScrapper fix itself):
   - `npx tsc --noEmit --incremental false` — exit 0 (after rebase + `npm install`).
   - `npm test -- --passWithNoTests` — 1449 passed / 1 known-unrelated pre-existing failure
     (`HotelSustainabilityCredentialEvidence.test.tsx`), baseline plus the one new test case this
     fix added (entity-resolution-fails path), no other new failures.
6. **Test changes reviewed, not just accepted**: two `expect(cache.set).not.toHaveBeenCalled()`
   assertions were narrowed to `not.toHaveBeenCalledWith(..., 21600)` — this is a necessary,
   correct adjustment (not a weakening): `cache.set` is now legitimately called with a *different*
   TTL (`2592000`, the entity-ID cache) even on paths where the itinerary-search cache
   (`21600` TTL) should NOT be written — the original blanket assertion would have started failing
   for an unrelated, correct reason if left as-is. A new test case was added covering the
   entity-resolution-failure path, asserting the search endpoint is never called for either side
   when one entity ID can't be resolved. No existing test assertion was deleted.
7. **Contract compliance**: `Result<T>` pattern preserved throughout — every new code path either
   returns `{ ok: true, data }` / `{ ok: false, reason }` or is wrapped in try/catch that resolves
   to `null` (never throws to the caller), matching `NON_NEGOTIABLE_CONTRACT`.

## Verdict: PASS
