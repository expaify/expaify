# AUDIT-PROVIDER-FAILURE-CHAIN-01: Provider Failure Chain Trust

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Strict audit only. No production code changed.

## Executive Decision

Mostly passing, with two trust gaps.

The main search route does surface full provider outages honestly: unavailable flight adapters stream `notice` events, unavailable hotels stream `hotel-status: unavailable`, and the results UI distinguishes provider failure from ordinary empty inventory.

The gaps are narrower but important:

1. Travelpayouts internally fans out to three endpoints and silently ignores HTTP failures from any sub-endpoint. A partial Travelpayouts outage can be presented as clean successful inventory or clean no-results.
2. Malformed individual offer rows are sometimes dropped and returned as `ok: true` empty/partial data in Duffel, Amadeus, and Hotellook, so malformed provider data can become indistinguishable from true no-results.

## Surfaces Inspected

- `app/page.tsx`
- `app/api/search/route.ts`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `lib/providers/travelpayouts.ts`
- `lib/providers/duffel.ts`
- `lib/providers/amadeus.ts`
- `lib/providers/kiwi.ts`
- `lib/providers/hotellook.ts`
- `lib/types.ts`

Requested file not present in this worktree:

- `app/components/SearchForm.tsx`

Search form behavior is implemented directly in `app/page.tsx`.

## Provider Failure Path Matrix

| Scenario | Adapter result | Search route event | User-visible result |
| --- | --- | --- | --- |
| Travelpayouts missing token or marker | `{ ok: false, reason }` at `lib/providers/travelpayouts.ts:137` to `lib/providers/travelpayouts.ts:138` | `notice` with `status: unavailable` at `app/api/search/route.ts:194` to `app/api/search/route.ts:196` | Flight notice: "Travelpayouts is unavailable for this search." via `components/flights/FlightResults.tsx:148` to `components/flights/FlightResults.tsx:168` |
| Travelpayouts endpoint returns malformed top-level data | `{ ok: false, reason: malformed }` from paths such as `lib/providers/travelpayouts.ts:163` to `lib/providers/travelpayouts.ts:176` | `notice` with `status: malformed_response` from classifier at `app/api/search/route.ts:53` to `app/api/search/route.ts:77` | Flight notice says provider returned unusable response |
| Travelpayouts sub-endpoint HTTP failure | No failure if other sub-endpoints continue; failed endpoint is skipped at `lib/providers/travelpayouts.ts:160` to `lib/providers/travelpayouts.ts:198`, `lib/providers/travelpayouts.ts:212` to `lib/providers/travelpayouts.ts:250`, and `lib/providers/travelpayouts.ts:264` to `lib/providers/travelpayouts.ts:301` | No notice if adapter returns `ok: true` | User sees partial or empty Travelpayouts coverage as confirmed clean results |
| Duffel missing credential or HTTP failure | `{ ok: false, reason }` at `lib/providers/duffel.ts:120` to `lib/providers/duffel.ts:167` | `notice` with `status: unavailable` at `app/api/search/route.ts:198` to `app/api/search/route.ts:200` | Flight notice: "Duffel is unavailable for this search." |
| Duffel malformed top-level response | `{ ok: false, reason: malformed }` at `lib/providers/duffel.ts:170` to `lib/providers/duffel.ts:172` | `notice` with `status: malformed_response` | Flight notice says provider returned unusable response |
| Duffel malformed individual offer row | Row is filtered out as `null` at `lib/providers/duffel.ts:179` to `lib/providers/duffel.ts:220` | If all rows drop, adapter still returns `ok: true, data: []` | UI can show "No flight inventory found" instead of provider data malformed |
| Amadeus missing credential, token failure, or offer HTTP failure | `{ ok: false, reason }` at `lib/providers/amadeus.ts:121` to `lib/providers/amadeus.ts:135` and `lib/providers/amadeus.ts:173` to `lib/providers/amadeus.ts:179` | `notice` with `status: unavailable` or `malformed_response` at `app/api/search/route.ts:202` to `app/api/search/route.ts:204` | Flight notice names Amadeus failure |
| Amadeus malformed individual offer row | Row is filtered out as `null` at `lib/providers/amadeus.ts:184` to `lib/providers/amadeus.ts:247` | If all rows drop, adapter still returns `ok: true, data: []` | UI can show no inventory instead of unusable Amadeus data |
| Kiwi unapproved, unconfigured, HTTP failure, invalid price, malformed row, invalid deeplink | `{ ok: false, reason }` at `lib/providers/kiwi.ts:120` to `lib/providers/kiwi.ts:121`, `lib/providers/kiwi.ts:156` to `lib/providers/kiwi.ts:188`, and `lib/providers/kiwi.ts:219` to `lib/providers/kiwi.ts:220` | `notice` with `status: unavailable` or `malformed_response` at `app/api/search/route.ts:206` to `app/api/search/route.ts:208` | Flight notice names Kiwi failure |
| All flight providers return `ok: true, data: []` | No adapter failure | Synthetic `notice` with `status: no_supply` at `app/api/search/route.ts:212` to `app/api/search/route.ts:219` | Empty state: "No flight inventory found" at `components/flights/FlightResults.tsx:129` to `components/flights/FlightResults.tsx:144` |
| Some flight providers fail, some return fares | Failed adapters stream notices; successful adapters stream fares | Mixed `notice` and `flights` events from `app/api/search/route.ts:167` to `app/api/search/route.ts:210` | Results render plus warning panel "Provider coverage may be incomplete" |
| Hotel provider missing credential or HTTP failure | `{ ok: false, reason }` at `lib/providers/hotellook.ts:62` to `lib/providers/hotellook.ts:83` | `hotel-status` with `status: unavailable` at `app/api/search/route.ts:233` to `app/api/search/route.ts:242` | Hotels tab disabled and message says hotel provider is unavailable at `app/page.tsx:751` to `app/page.tsx:769` and `app/page.tsx:1167` to `app/page.tsx:1172` |
| Hotel provider returns empty array | `{ ok: true, data: [] }` at `lib/providers/hotellook.ts:85` to `lib/providers/hotellook.ts:89` | `hotel-status` with `status: empty` at `app/api/search/route.ts:231` to `app/api/search/route.ts:232` | Hotels empty state says no hotel inventory found |
| Hotel provider returns malformed top-level response | `{ ok: false, reason: malformed }` at `lib/providers/hotellook.ts:85` to `lib/providers/hotellook.ts:87` | `hotel-status` unavailable with malformed message | User sees hotel provider returned unusable response |
| Hotel provider returns malformed individual rows | Bad rows are filtered out at `lib/providers/hotellook.ts:91` to `lib/providers/hotellook.ts:115` | If all rows drop, route sends `hotel-status: empty` | UI can present provider data loss as true no hotel inventory |

## Findings

### P0: Travelpayouts partial endpoint failures are silent

Evidence: `searchFares` queries v2 latest, v1 calendar, and v1 cheap, but each HTTP failure is ignored unless malformed data is returned from an otherwise `ok` response. See `lib/providers/travelpayouts.ts:160` to `lib/providers/travelpayouts.ts:198`, `lib/providers/travelpayouts.ts:212` to `lib/providers/travelpayouts.ts:250`, and `lib/providers/travelpayouts.ts:264` to `lib/providers/travelpayouts.ts:301`. The adapter then caches and returns `ok: true` at `lib/providers/travelpayouts.ts:304` to `lib/providers/travelpayouts.ts:305`.

Repro:

1. Simulate v2 latest returning HTTP 503.
2. Simulate v1 calendar returning an empty valid response.
3. Simulate v1 cheap returning an empty valid response.
4. Call `travelpayouts.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 })`.

Expected: Provider failure context is preserved because one supply source failed.

Actual: Adapter can return `{ ok: true, data: [] }`, which `/api/search` treats as no Travelpayouts notice. If every other provider also returns clean empty data, the UI shows true no-results copy.

Impact: Paid users can be told no inventory exists when the main baseline/live source was only partially reachable.

### P1: Malformed individual provider rows can be collapsed into empty inventory

Evidence:

- Duffel drops malformed offers by returning `null` during mapping and filtering them out at `lib/providers/duffel.ts:179` to `lib/providers/duffel.ts:220`.
- Amadeus drops malformed offers by returning `null` during mapping and filtering them out at `lib/providers/amadeus.ts:184` to `lib/providers/amadeus.ts:247`.
- Hotellook drops malformed hotel entries with `flatMap` at `lib/providers/hotellook.ts:91` to `lib/providers/hotellook.ts:115`.

Top-level malformed responses correctly return `{ ok: false, reason }`, but malformed rows inside an otherwise valid response can produce `ok: true, data: []`.

Repro:

1. Mock a Duffel response with `data.offers` present but each offer missing `slices` or a parseable `total_amount`.
2. Call `duffel.searchFares(...)`.
3. Observe it can return success with no fares, not a malformed-provider result.

Impact: Malformed provider data is not always distinguishable from true no-results.

### P1: Flight notice copy loses actionable adapter reason

Evidence: `/api/search` classifies adapter reasons but replaces them with generic provider messages in `providerMessage` at `app/api/search/route.ts:70` to `app/api/search/route.ts:78`. For users this is acceptable, but for support/debugging the streamed notice no longer contains "not configured", "HTTP 503", or "invalid deeplink".

Impact: The UI is honest that a provider failed, but the failure is less actionable than the adapter reason. This is a supportability gap, not a user-facing trust blocker.

### Passing: Full provider outage is distinct from true no-results

Evidence: When adapters return `{ ok: false }`, `/api/search` emits `notice` events and `FlightResults` renders a warning panel with provider-specific messages. The empty title becomes "Flight providers unavailable" only when there are provider notices and no fares at `components/flights/FlightResults.tsx:123` to `components/flights/FlightResults.tsx:144`.

Manual simulated failure search:

Command used a temporary Jest harness, then the harness was deleted:

```text
npm test -- app/api/search/__audit-provider-failure.test.ts --runInBand
```

Search simulated:

```text
/api/search?origin=JFK&dest=LAX&depart=2026-09-22&return=2026-09-29&passengers=1
```

Provider credentials were blank. Observed NDJSON:

```json
{"type":"notice","provider":"Travelpayouts","status":"unavailable","message":"Travelpayouts is unavailable for this search."}
{"type":"notice","provider":"Duffel","status":"unavailable","message":"Duffel is unavailable for this search."}
{"type":"notice","provider":"Amadeus","status":"unavailable","message":"Amadeus is unavailable for this search."}
{"type":"notice","provider":"Kiwi","status":"unavailable","message":"Kiwi is unavailable for this search."}
{"type":"suggestion","message":"No flights found. Try nearby: LGA, EWR"}
{"type":"hotel-status","status":"unavailable","providerStatus":"unavailable","message":"The hotel provider is unavailable right now."}
{"type":"done"}
```

Result: Passing for full outage disclosure.

### Passing: Partial provider success is visible

Evidence: `app/page.tsx` accumulates `flights` chunks and separately appends `notice` events at `app/page.tsx:598` to `app/page.tsx:635`. `FlightResults` renders both result cards and the warning panel when `flightProviderNotices.length > 0` at `components/flights/FlightResults.tsx:148` to `components/flights/FlightResults.tsx:170`.

Result: If Duffel succeeds and Amadeus fails, users still see fares plus "Provider coverage may be incomplete."

### Passing: Hotels distinguish skipped, unavailable, empty, and available

Evidence: `/api/search` sends hotel status as `available`, `empty`, `unavailable`, or `skipped` at `app/api/search/route.ts:225` to `app/api/search/route.ts:249`. `app/page.tsx` stores the hotel status separately from hotel results at `app/page.tsx:603` to `app/page.tsx:613` and maps it to visible copy at `app/page.tsx:751` to `app/page.tsx:769`.

Result: Missing hotel date requirements, unavailable hotel provider, and true empty hotel inventory are distinguishable in the UI.

## State Review

- Loading: Coherent. Results page shows "Scanning deals across providers..." plus skeletons while no flights have streamed (`components/flights/FlightResults.tsx:227` to `components/flights/FlightResults.tsx:247`).
- Empty flights: Coherent when providers return true no-supply; distinct copy for missing dates, filters, provider unavailable, and no inventory (`components/flights/FlightResults.tsx:123` to `components/flights/FlightResults.tsx:144`).
- Error: Network or non-OK route response shows a top-level error and Retry button (`app/page.tsx:646` to `app/page.tsx:648`, rendered at `app/page.tsx:1096` to `app/page.tsx:1105`).
- Mobile 375px: Source review shows single-column result grids and wrapped controls (`components/flights/FlightResults.tsx:172` to `components/flights/FlightResults.tsx:215`, `components/flights/FlightResults.tsx:261` to `components/flights/FlightResults.tsx:270`). Live screenshot verification was blocked by server bind permissions.
- Desktop: Source review shows responsive multi-column grids at `sm` and `lg` breakpoints. No source-level evidence of hidden primary actions in the inspected states.
- Stale/missing/unavailable price presentation: Flight cards include `fetchedAt` in data but do not render freshness. Provider cache TTL is 6h by contract, but a cached fare can be shown without visible "last checked" context. External CTA copy correctly says price and availability can change (`app/components/FlightCard.tsx:196` to `app/components/FlightCard.tsx:200`).

## Verification Commands

- `npm test -- app/api/search/__audit-provider-failure.test.ts --runInBand` - passed for temporary simulated provider-failure harness; harness removed after use.
- `npm run dev -- --hostname 127.0.0.1 --port 3010` - blocked by sandbox: `listen EPERM`.
- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --passWithNoTests` - passed. 19 suites passed, 151 tests passed.

## Required Return Note

- What changed and why: Added this audit report to document provider failure propagation and trust gaps for AUDIT-PROVIDER-FAILURE-CHAIN-01.
- Files changed: `docs/audits/2026-06-30-audit-provider-failure-chain-01.md`.
- Verification commands and results: Temporary simulated failure harness passed, `npx tsc --noEmit --incremental false` passed, and `npm test -- --passWithNoTests` passed.
- Out-of-scope findings or blockers: `app/components/SearchForm.tsx` is absent; form is in `app/page.tsx`. Live browser verification was blocked by sandbox port binding (`EPERM`). No production code changed.
