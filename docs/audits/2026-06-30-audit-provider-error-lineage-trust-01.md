# AUDIT-PROVIDER-ERROR-LINEAGE-TRUST-01

Date: 2026-06-30
Scope: provider error, timeout, partial data, and empty inventory lineage from provider boundary to caller/API/UI.

## Summary

Provider search adapters generally satisfy the outward `Result<T>` contract: public provider methods return `{ ok: true, data }` or `{ ok: false, reason }` and catch fetch/cache/JSON exceptions before returning to API callers.

The main `/api/search` route preserves provider failure as NDJSON `notice` events and keeps true empty flight inventory separate via a synthetic `no_supply` notice only when no provider reported a failure. Hotel availability is also separated as `available`, `empty`, `unavailable`, or `skipped`.

Current gaps are mostly lineage precision, not crashes: no timeout-specific status exists, partial provider failures are flattened into generic "coverage may be incomplete" UI copy, Travelpayouts subrequest HTTP failures can be silently treated as empty/partial results, and booking still has a direct Duffel API path outside `lib/providers`.

## Boundaries Inspected

| Boundary | Contract result | Notes |
| --- | --- | --- |
| `lib/providers/travelpayouts.ts` `priceTrends` | Mostly satisfies nonthrow `Result<T>` | Missing token returns `{ ok: false }`; HTTP and malformed payloads return `{ ok: false }`; mapper throws are caught by method catch. See lines 87-127. |
| `lib/providers/travelpayouts.ts` `searchFares` | Satisfies nonthrow outward contract, but partial lineage is weak | Missing env returns `{ ok: false }`; successful malformed payloads return `{ ok: false }`; catch converts thrown errors to reasons. However non-OK `latest`, `calendar`, and `cheap` subrequests are ignored unless all resulting fares are empty, so a provider-side partial outage can look like reduced inventory. See lines 132-308. |
| `lib/providers/duffel.ts` `searchFares` | Satisfies nonthrow `Result<T>` | No destination, invalid dates, and past dates return empty success. Missing env and HTTP failures return `{ ok: false }`; exceptions are caught. See lines 104-226. |
| `lib/providers/amadeus.ts` `searchFares` | Satisfies nonthrow outward contract | Missing credentials and HTTP/malformed offer responses return `{ ok: false }`; public method catch covers `getToken`, fetch, JSON, and cache exceptions. `getToken` itself has no local catch, but is private and called inside the public catch. See lines 69-95 and 106-245. |
| `lib/providers/kiwi.ts` `searchFares` | Satisfies nonthrow `Result<T>` | Not approved/configured returns `{ ok: false }`; invalid destination/date returns empty success; HTTP/malformed/invalid price/deeplink return `{ ok: false }`; exceptions are caught. See lines 67-221. |
| `lib/providers/hotellook.ts` `searchHotels` | Satisfies nonthrow `Result<T>` | Missing env, HTTP, and malformed payloads return `{ ok: false }`; empty array is true empty inventory; invalid individual entries are filtered, which can convert malformed partial supply into empty success. See lines 58-120. |
| `app/api/search/route.ts` | Preserves provider notices, but collapsed statuses | Imports providers from `lib/providers`, classifies `malformed_response`, `unavailable`, and `no_supply`; emits NDJSON notices/statuses instead of raw reasons. See lines 4-10, 58-83, 165-174, 188-263. |
| `app/api/calendar/route.ts` | Provider boundary respected | Calls `travelpayouts.priceTrends`; on provider failure returns `{}` with 200, which hides unavailable baseline/calendar data from UI. |
| `app/page.tsx` and `components/flights/FlightResults.tsx` | UI distinguishes top-level search error, provider notice, loading, and empty state | Search consumes `notice`, `hotel-status`, `suggestion`, and `done` stream events. Flight UI shows provider notices separately, and empty state changes to "Flight providers unavailable" when notices exist and no flights loaded. See `app/page.tsx` stream handling and `components/flights/FlightResults.tsx` lines 147-172 and 193-320. |

## Error Lineage Findings

1. Provider calls mostly stay behind `lib/providers` for search. `/api/search` uses `travelpayouts`, `duffel`, `amadeus`, `kiwi`, and `hotellook` imports from `lib/providers`. `/api/calendar` uses `travelpayouts.priceTrends`.

2. Direct vendor call found outside `lib/providers`: `app/api/book/route.ts` calls `https://api.duffel.com/air/offers/${offerId}` and `https://api.duffel.com/air/orders` directly. This conflicts with the non-negotiable "Every external API call goes through lib/providers" contract, but booking refactor/fix is out of this audit ticket. See `app/api/book/route.ts` lines 4, 110-115, and 156-184.

3. Raw provider errors are mostly not leaked by `/api/search`. The API maps provider `reason` strings into messages like "Duffel is unavailable for this search." and "Travelpayouts returned a response we could not use." Raw HTTP status is retained only in server-side adapter reasons, not user-visible search copy.

4. Raw provider errors can leak in booking. `app/api/book/route.ts` returns `Failed to fetch offer: ${text.slice(0, 200)}` on Duffel offer-fetch failure and returns `errorMsg` from Duffel order errors. This is outside the inspect-first ticket files, but it is a provider trust risk in the current code.

5. Thrown provider exceptions are contained at public search adapter boundaries. `fetch`, `res.json`, `cache.get`, `cache.set`, and mapping exceptions are caught in the public methods inspected, returning `{ ok: false, reason }`.

6. `Promise.allSettled` in `/api/search` prevents one provider failure from failing the whole streamed response. A rejected provider promise does not produce a notice because notices are only sent for fulfilled `{ ok: false }` results. Given current adapters catch outward exceptions, this is acceptable for expected provider paths, but a programming throw from a mocked or future provider would disappear into `allSettled` without a notice.

## Distinguishability

| State | API representation | UI representation | Distinguishable today? |
| --- | --- | --- | --- |
| Provider failure | Flight: `type:"notice"`, `status:"unavailable"` or `malformed_response`; hotel: `hotel-status`, `status:"unavailable"` | Flight warning panel; zero-result state title can be "Flight providers unavailable"; hotel copy says provider unavailable | Mostly yes |
| Timeout | No dedicated timeout status; likely classified as `unavailable` if adapter reason includes fetch/network/abort wording | Same as provider unavailable | No |
| Partial data | Flights stream successful provider chunks plus notices from failed providers; Travelpayouts internal subrequest failures are not surfaced if any subrequest succeeds | Warning panel "Provider coverage may be incomplete" while showing available fares | Partially |
| True empty inventory | Flight synthetic `notice` with provider `Flights`, `status:"no_supply"` only when zero fares and zero provider failures; hotel `hotel-status` `empty` | Flight "No flight inventory found"; hotel "No hotel inventory found" | Yes for all-provider empty; weaker for adapter-level filtered entries |
| Malformed provider response | `status:"malformed_response"` for search notices or hotel `providerStatus` | User copy says response could not be used | Yes |

## User-Visible Copy Risks

- Flight partial failure with some results is honest but nonspecific: the warning title is "Provider coverage may be incomplete", then each failed provider is listed. This avoids saying "no deals", but does not tell the user whether a provider timed out, was unavailable, or returned malformed data.
- Flight all-provider failure is fairly clear: "Flight providers unavailable" plus "The flight providers we could reach did not return usable inventory."
- Flight all-provider empty is distinct: "No flight inventory found" plus "No current fares matched this route and date combination."
- Hotel states are clearer than flight states at the API level: `empty`, `unavailable`, and `skipped` are separate stream events.
- Calendar baseline failure is hidden as an empty `{}` response, so the UI cannot distinguish "no calendar trend data" from "Travelpayouts baseline unavailable."

## Retry Behavior

Search retry on the error panel calls `runSearch()` with current criteria, which resets search-scoped state and retries the same `/api/search` request. Provider notices do not show a separate retry button, but "Edit search" keeps the user recoverable.

Booking retry behavior was not changed. In `BookingFlow`, a failed booking returns to an error state with the same fare context and a "Try again" style flow through the component state, but the API path itself redoes both Duffel offer fetch and order creation. This overlaps booking idempotency/provider-boundary work and is out of scope here.

## Manual Verification

Simulated route-level provider failure with a temporary Jest harness that mocked all four flight providers to return `{ ok:false }`:

Command:

```sh
npm test -- app/api/search/__tests__/provider-failure.manual.test.ts --runInBand
```

Observed result: passed. `/api/search` returned HTTP 200 NDJSON containing `notice` events for Travelpayouts, Duffel, Amadeus, and Kiwi with `status:"unavailable"`, and did not emit the synthetic `status:"no_supply"` notice. Temporary harness was removed after verification.

Inline `tsx` verification was attempted first, but the sandbox blocked `tsx` IPC pipe creation with `listen EPERM`; this was a tool/sandbox limitation, not an application failure.

## Timeout Work Overlap

No provider timeout implementation was added or modified. Current code has no timeout-specific `ProviderIssueStatus`, no adapter-level deadline wrapper, and no user-visible timeout copy. Timeout lineage would currently collapse into generic `unavailable` only if the thrown/caught reason string matches the classifier.

## Conclusion

Search provider failure and empty inventory are distinguishable at the main API/UI path. Timeout and partial data lineage are not precise enough for high-trust diagnostics. The largest contract issue observed is outside this ticket's fix scope: Duffel booking calls bypass `lib/providers` and may expose raw provider error text.
