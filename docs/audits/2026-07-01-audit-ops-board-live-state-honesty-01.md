# AUDIT-OPS-BOARD-LIVE-STATE-HONESTY-01: Ops Board Live-State Honesty

Date: 2026-07-01  
Role: Senior QA Engineer  
Scope: Audit only. No feature code changed.

## Executive Decision

Blocked by contract conflict. The assigned ops board implementation is not present in this worktree, so the requested live-state honesty audit cannot be truthfully executed against the named files.

The ticket requires auditing:

- first load when `/api/tickets` succeeds, fails, or returns slowly
- SSE disconnect and reconnect behavior
- agent run completion and failure behavior
- consistency between column counts, selected ticket content, activity feed rows, and `LIVE` state

None of the required board routes or components exist here. The current root page is the public expaify travel search page, not an ops board. Per the ticket contract, I am stopping and reporting the conflict instead of guessing against unrelated code.

## Requested Files Versus Reality

| Requested file | Status | Audit impact |
| --- | --- | --- |
| `app/page.tsx` | Present, but it is the travel search/results page | No board columns, no ticket selection state, no `LIVE` state, no activity feed, no SSE board client |
| `components/TicketCard.tsx` | Missing | Cannot audit ticket card honesty, counts, or run badges |
| `components/TicketSlideOver.tsx` | Missing | Cannot audit selected-ticket freshness, detail overwrite, or run detail states |
| `app/api/tickets/route.ts` | Missing | Cannot audit first-load success/failure/slow responses |
| `app/api/board-stream/route.ts` | Missing | Cannot audit SSE disconnect/reconnect/stale data behavior |
| `app/api/run/[id]/route.ts` | Missing | Cannot audit run completion/failure truth source |
| `lib/db.ts` | Missing | Cannot map board state to the named DB layer |

Related existing files:

- `app/page.tsx` imports airport input, hotel card, flight results, and flight sorting logic, which confirms the root page is not a board surface: `app/page.tsx:3` to `app/page.tsx:10`.
- `app/page.tsx` defines search-specific state such as `View`, `TripType`, `SortBy`, `ActiveTab`, hotel availability, and search criteria, not board/ticket state: `app/page.tsx:12` to `app/page.tsx:32`.
- `lib/db/client.ts` only exposes a generic Postgres `query()` helper and does not implement ticket reads, run state reads, or activity feed queries: `lib/db/client.ts:1` to `lib/db/client.ts:21`.

## Manual Verification Attempt

Required verification flow from the ticket:

1. Load the board normally.
2. Simulate first-load failure.
3. Reconnect after stream interruption.
4. Start an agent run.
5. Refresh during the run.
6. Compare visible state against API and database truth.

Actual outcome:

Blocked at step 1. There is no board route, no `/api/tickets`, no `/api/board-stream`, no `/api/run/[id]`, and no ticket UI to open.

## Confirmed Defects

### P0 - Assigned board implementation is absent, so live-state honesty cannot be audited

Files:

- `app/page.tsx:3` to `app/page.tsx:32`
- `lib/db/client.ts:1` to `lib/db/client.ts:21`

Repro steps:

1. Run `rg --files | rg '(^app/api/tickets/route\\.ts$|^app/api/board-stream/route\\.ts$|^app/api/run/.*/route\\.ts$|^components/Ticket(Card|SlideOver)\\.tsx$|^lib/db\\.ts$)'`.
2. Inspect `app/page.tsx`.
3. Inspect `lib/db/client.ts`.

Expected:

The worktree should contain the board route, ticket card/detail components, ticket API, board SSE route, run route, and board DB layer needed to verify stale/live/failure states.

Actual:

The requested files are absent. The only present root page is a travel search page, and the only DB file in scope is a generic Postgres helper with no board-specific logic.

User-facing trust risk:

QA cannot honestly certify first-load honesty, live-update honesty, or run-state honesty on a surface that is not implemented in this branch. Treating this branch as a pass/fail board audit would itself be misleading.

### P0 - First-load success, failure, and slow-response states for `/api/tickets` are not testable because `/api/tickets` does not exist

Files:

- Missing: `app/api/tickets/route.ts`

Repro steps:

1. Run `find app/api -maxdepth 3 -type f | sort`.
2. Confirm there is no `app/api/tickets/route.ts`.

Expected:

The board should have a first-load API route so QA can verify distinct success, loading, empty, and failure states.

Actual:

No tickets API route exists in this worktree, so none of the required first-load states can be reproduced or compared to UI claims.

User-facing trust risk:

The acceptance criteria around honest first-load behavior are blocked entirely. There is no evidence path for the board to prove whether it is fresh, loading, empty, or broken.

### P0 - SSE disconnect, reconnect, and stale-data behavior are not testable because the SSE route and client consumer do not exist

Files:

- Missing: `app/api/board-stream/route.ts`
- `app/page.tsx:3` to `app/page.tsx:32`

Repro steps:

1. Run `find app/api -maxdepth 3 -type f | sort`.
2. Search the client code with `rg -n 'EventSource|text/event-stream|board-stream|LIVE' app components lib`.
3. Confirm there is no SSE route and no SSE consumer.

Expected:

The board should have an SSE endpoint and a client that exposes honest disconnected, reconnecting, stale, and recovered states.

Actual:

No SSE route or consumer exists in this worktree.

User-facing trust risk:

The required question "does the UI look live when it is stale or broken?" cannot be answered from this branch because there is no live board implementation to inspect.

### P1 - Agent run completion and failure honesty are not testable because the run route and run UI do not exist

Files:

- Missing: `app/api/run/[id]/route.ts`
- Missing: `components/TicketCard.tsx`
- Missing: `components/TicketSlideOver.tsx`

Repro steps:

1. Run `rg --files | rg 'app/api/run|TicketCard|TicketSlideOver'`.
2. Confirm the run route and run surfaces are absent.

Expected:

A run route and run-state UI should exist so QA can compare visible completion/failure state against the API truth during and after refresh.

Actual:

No run route or run-state board UI exists in this worktree.

User-facing trust risk:

There is no auditable source for `LIVE`, running, completed, or failed states, so the ticket's run-transition honesty criteria cannot be satisfied.

## Acceptance Criteria Coverage

| Acceptance criterion | Status | Notes |
| --- | --- | --- |
| Report lists each confirmed defect with severity, repro, expected, actual, and exact file references | Partial | Provided for the confirmed contract and missing-surface defects. Board-behavior-specific defects are blocked by absent implementation. |
| Report explicitly covers first load, slow load, `/api/tickets` failure, SSE disconnect, SSE reconnect, and agent run completion/failure | Pass | Each area is explicitly covered as blocked by missing routes/surfaces. |
| Manual verification includes load board, simulate failure, reconnect, start run, refresh during run, compare to API/DB truth | Partial | Flow is documented and blocked at step 1 because the board implementation is absent. |
| Report calls out any state that looks successful, live, or current when it is not | Pass | The only honest conclusion is that this branch cannot present a board state at all; any QA sign-off on board freshness from this branch would be false. |
| Loading, empty, and error states are visually distinct and honest on mobile 375px and desktop | Blocked | No board UI exists to inspect on either viewport. |

## Out-Of-Scope Findings

- `package.json` declares `next: 16.2.9`, while the briefing says Next.js 15. That mismatch is real but not the primary blocker for this audit.
- The current worktree is the expaify travel search app. That broader branch/repo mismatch should be corrected before more ops-board QA tickets are assigned here.

## Verification

- `npx tsc --noEmit --incremental false`
- `npm test -- --passWithNoTests`

Results:

- `npx tsc --noEmit --incremental false` passed.
- `npm test -- --passWithNoTests` passed with 20 suites and 176 tests.

## Required Return Note

- What changed and why: Added this audit report documenting that the ops-board live-state honesty ticket is blocked because the named board, SSE, ticket, run, and DB surfaces are missing from this worktree.
- Files changed: `docs/audits/2026-07-01-audit-ops-board-live-state-honesty-01.md`
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm test -- --passWithNoTests` passed with 20 suites and 176 tests.
- Any out-of-scope findings or blockers: branch/worktree does not contain the requested ops-board implementation; briefing says Next.js 15 while `package.json` is Next 16.2.9.
