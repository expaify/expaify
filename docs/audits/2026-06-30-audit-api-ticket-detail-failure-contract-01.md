# AUDIT-API-TICKET-DETAIL-FAILURE-CONTRACT-01

Date: 2026-06-30
Scope: Backend audit only. No API, provider, database, schema, seed, timeout, merge, ticket creation, or UI behavior changed.

## Verdict

Fail for the requested ticket/run contract, with a routing blocker.

The assigned ticket asked for `app/api/tickets/[id]/route.ts`, `app/api/run/[id]/route.ts`, `app/api/tickets/route.ts`, and `lib/db.ts`. Those files do not exist in this worktree. The current equivalent detail path is `app/api/deals/[dealId]/route.ts`, backed by `lib/deals/dealDetail.ts` and `lib/db/client.ts`.

The existing deal detail route handles invalid ids and missing deals, but it does not use the shared `Result<T>` response shape, can throw database/internal failures to Next.js, and returns money as `{ price: number, currency }` instead of `{ priceCents, currency }`.

## Requested Paths

| Requested path | Present? | Observed failure branches |
| --- | --- | --- |
| `app/api/tickets/[id]/route.ts` | No | No route implementation to inspect. A request to `/api/tickets/:id` would be framework-level 404, not an API-owned Result response. |
| `app/api/run/[id]/route.ts` | No | No route implementation to inspect. A request to `/api/run/:id` would be framework-level 404, not an API-owned Result response. |
| `app/api/tickets/route.ts` | No | No route implementation to inspect. |
| `lib/db.ts` | No | Actual DB helper is `lib/db/client.ts`. |

## Actual Detail Route Inspected

### `GET /api/deals/[dealId]`

Implementation: `app/api/deals/[dealId]/route.ts`.

Observed branches:

| Branch | Evidence | Status/body | Contract result |
| --- | --- | --- | --- |
| Invalid id | `isValidDealId(dealId)` check at `app/api/deals/[dealId]/route.ts:11` to `app/api/deals/[dealId]/route.ts:13`; pattern at `lib/deals/dealDetail.ts:9` and `lib/deals/dealDetail.ts:45` to `lib/deals/dealDetail.ts:47`. | `400`, `{ "error": "Invalid deal id" }`. | Distinguishable, but not `Result<T>` and body uses `error` instead of `{ ok:false, reason }`. |
| Valid id not found | `getDealDetail` returns `null` for no rows at `lib/deals/dealDetail.ts:190` to `lib/deals/dealDetail.ts:191`; route maps falsy detail at `app/api/deals/[dealId]/route.ts:15` to `app/api/deals/[dealId]/route.ts:18`. | `404`, `{ "error": "Deal not found" }`. | Distinguishable, but not `Result<T>`. |
| `deals` table missing | `getDealDetail` catches Postgres `42P01` and returns `null` at `lib/deals/dealDetail.ts:194` to `lib/deals/dealDetail.ts:200`. | Route returns same `404`, `{ "error": "Deal not found" }`. | Not distinguishable from a truly missing deal. This hides storage/config failure as not found. |
| Incomplete/malformed row | `dealRowToDetail` returns `null` when required fields are absent or invalid at `lib/deals/dealDetail.ts:133` to `lib/deals/dealDetail.ts:154`. | Route returns same `404`, `{ "error": "Deal not found" }`. | Not distinguishable from a truly missing deal. This hides bad persisted data as not found. |
| Missing `DATABASE_URL` | `getPool` throws at `lib/db/client.ts:5` to `lib/db/client.ts:10`; route has no try/catch around `getDealDetail` at `app/api/deals/[dealId]/route.ts:15`. | Thrown internal error to Next.js. | Contract break: can throw to caller/framework instead of returning nonthrowing Result-style failure. |
| Other DB/query failure | `query` delegates to `pg` at `lib/db/client.ts:16` to `lib/db/client.ts:20`; `getDealDetail` rethrows non-`42P01` errors at `lib/deals/dealDetail.ts:194` to `lib/deals/dealDetail.ts:201`. | Thrown internal error to Next.js. | Contract break: can throw to caller/framework instead of returning structured failure. |
| Success | Route returns `Response.json(deal)` at `app/api/deals/[dealId]/route.ts:20`. | `200`, raw `DealDetail`. | Not `Result<T>`. |

## Run Lookup Path

No run lookup route exists under `app/api/run/[id]/route.ts`, and no `app/api/run` tree exists. There is no API-owned invalid-id, not-found, provider-unavailable, or internal-failure branch to audit for run lookup.

This is a blocker for the exact ticket as written. The closest existing "run" concept appears to be search execution through `GET /api/search`, but changing or expanding that scope would invent product surface outside the assigned ticket.

## Provider Boundary

The reviewed detail path does not call providers directly. `app/api/deals/[dealId]/route.ts` imports only `getDealDetail` and `isValidDealId` from `lib/deals/dealDetail.ts`, and `lib/deals/dealDetail.ts` imports only `query` from `lib/db/client.ts`.

Provider-related failures therefore do not leak through this detail route because no reviewed detail/run lookup path reaches `lib/providers` or vendor APIs. Existing provider adapters under `lib/providers` expose `Result<T>` return types from `lib/types.ts:92`; this audit did not re-open provider adapter behavior beyond confirming there is no provider dependency in the reviewed detail path.

## Money Contract

Fail for the actual detail route.

The shared app money contract is `Money = { priceCents: number; currency: string }` at `lib/types.ts:1`. `DealDetail` instead exposes:

- `price: number` at `lib/deals/dealDetailTypes.ts:12`
- `currency: string` at `lib/deals/dealDetailTypes.ts:13`

`dealRowToDetail` reads `price_cents` but returns it as `price` at `lib/deals/dealDetail.ts:141` and `lib/deals/dealDetail.ts:156` to `lib/deals/dealDetail.ts:163`. The page treats `deal.price` as cents in `formatMoney(deal.price, deal.currency)` at `app/deals/[dealId]/page.tsx:146`.

The value remains integer cents when the row contains integer `price_cents`, but the API field name/shape violates the non-negotiable money contract and is easy for callers to misread as major units.

## UI-Facing Error Distinguishability

| State | Current API/UI-facing result | Distinguishable? | Notes |
| --- | --- | --- | --- |
| Invalid detail id | API: `400`, `{ error: "Invalid deal id" }`. | Yes | Message is clear, but unstructured and not `Result<T>`. |
| Detail not found | API: `404`, `{ error: "Deal not found" }`; page calls `notFound()` at `app/deals/[dealId]/page.tsx:140` to `app/deals/[dealId]/page.tsx:144`. | Yes at API level | The page collapses invalid/missing into generic 404 behavior because it bypasses the API and calls `getDealDetail` directly. |
| Provider unavailable | No provider dependency in reviewed detail path. | Not applicable | Search handles provider statuses elsewhere; this route cannot report provider unavailable. |
| Internal DB/config failure | Thrown to framework; no structured body. | No | Paid users would likely see a generic Next/server error, not a useful retry/storage-unavailable message. |
| Missing table or malformed persisted row | `404`, `{ error: "Deal not found" }`. | No | Too vague for a paid travel user because storage/schema/data corruption is represented as an absent deal. |

## Manual Verification

Local server verification was attempted with `npm run dev`, but the sandbox blocked port binding:

```sh
npm run dev
# Failed to start server: listen EPERM 0.0.0.0:3001
```

In-process route verification was used for the invalid detail request:

```sh
node --import tsx -e "const mod = await import('./app/api/deals/[dealId]/route.ts'); const res = await mod.GET(new Request('http://localhost/api/deals/short'), { params: Promise.resolve({ dealId: 'short' }) }); console.log(res.status); console.log(await res.text());"
```

Observed response:

```text
400
{"error":"Invalid deal id"}
```

This confirms the invalid detail branch is nonthrowing but returns an unstructured `{ error }` body instead of `Result<T>`.

## Confirmed Contract Breaks

1. `GET /api/deals/[dealId]` can throw internal DB/config/query failures because route code does not catch `getDealDetail`, and `getDealDetail` rethrows non-`42P01` DB errors.
2. `GET /api/deals/[dealId]` returns `{ error: string }` for invalid/not-found instead of `{ ok:false, reason:string }`.
3. `GET /api/deals/[dealId]` returns raw detail data on success instead of `{ ok:true, data }`.
4. `DealDetail` exposes `price: number` plus `currency` instead of the required `{ priceCents, currency }` money object.
5. Missing table and malformed persisted row collapse into `404 Deal not found`, which is too vague and misleading for a paid travel detail page.
6. Requested ticket and run API paths are absent, so callers cannot receive API-owned Result-style invalid/not-found/provider/internal responses for those paths.

## Narrow Follow-Up Repair Tickets

1. **REPAIR-API-DEAL-DETAIL-RESULT-CONTRACT-01**: Wrap `GET /api/deals/[dealId]` responses in `Result<T>`, map invalid id to `400`, not found to `404`, storage unavailable/internal failures to structured nonthrowing failures, and add focused route tests.
2. **REPAIR-DEAL-DETAIL-MONEY-SHAPE-01**: Rename detail money output to `priceCents` or a `price: { priceCents, currency }` object consistent with `lib/types.ts`, with compatibility handled explicitly if needed by the UI.
3. **REPAIR-DEAL-DETAIL-STORAGE-FAILURE-DISTINCTION-01**: Stop collapsing missing `deals` table, malformed persisted rows, and DB connection failures into "Deal not found"; return a storage/internal failure response that the UI can explain.
4. **REPAIR-API-TICKET-RUN-ROUTE-CONTRACT-01**: If ticket/run APIs are still product surface, add or restore `app/api/tickets/[id]/route.ts`, `app/api/tickets/route.ts`, and `app/api/run/[id]/route.ts` with invalid-id, not-found, provider-unavailable, and internal-failure Result-style contracts.

## Verification Commands

- `npx tsc --noEmit --incremental false`: passed with no output.
- `npm test -- --passWithNoTests`: passed. 20 test suites passed, 168 tests passed.

## Required Return Note

- What changed and why: Added this audit report for AUDIT-API-TICKET-DETAIL-FAILURE-CONTRACT-01. No production code changed.
- Files changed: `docs/audits/2026-06-30-audit-api-ticket-detail-failure-contract-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed with no output; `npm test -- --passWithNoTests` passed with 20 test suites and 168 tests.
- Out-of-scope findings or blockers: Requested ticket/run files are absent; local server manual verification was blocked by sandbox port binding (`listen EPERM`), so route handler was invoked in-process for invalid detail verification.
