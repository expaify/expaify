# AUDIT-AGENT-RUN-COPY-AND-STATUS-PARITY-01

Date: 2026-07-01
Role: Senior QA Engineer
Result: Blocked - the board/run implementation named in the ticket is not present in this worktree.

## Scope Check

Assigned first-pass files:

- `app/page.tsx`
- `components/TicketSlideOver.tsx`
- `app/api/run/[id]/route.ts`
- `app/api/board-stream/route.ts`

What exists here:

- `app/page.tsx` exists, but it is the public expaify travel search/results client page. Its imports are airport input, hotel cards, flight results, and search sorting, not board, ticket, or run surfaces (`app/page.tsx:3` to `app/page.tsx:10`).
- `app/page.tsx` only defines `View = 'form' | 'results'`, not board/run/detail states (`app/page.tsx:12`).
- The only live network flow in `app/page.tsx` is `runSearch()`, which fetches `/api/search`, parses NDJSON fare/hotel events, and toggles `isSearching` for customer search results (`app/page.tsx:658` to `app/page.tsx:809`).
- `components/TicketSlideOver.tsx` does not exist in this repository.
- `app/api/run/[id]/route.ts` does not exist in this repository.
- `app/api/board-stream/route.ts` does not exist in this repository.
- `lib/db/client.ts` is only a generic Postgres pool/query helper. It contains no ticket reads, run writes, status transitions, comment writes, or activity feed queries (`lib/db/client.ts:1` to `lib/db/client.ts:20`).

Repo-level confirmation:

- `find app components lib -maxdepth 4 -type f | sort` shows API routes for airports, alerts, baggage, book, calendar, deals, score, and search only. No ticket, run, or board-stream route family exists.
- `rg --files | rg 'Ticket|SlideOver|board|run'` returns audit documents only, not product implementation.

## Blocker

### P0 - The requested run lifecycle cannot be traced because the underlying board/run surfaces are absent

Evidence:

- `app/page.tsx` is a customer search page, not an operator board (`app/page.tsx:3` to `app/page.tsx:10`, `app/page.tsx:658` to `app/page.tsx:809`).
- `components/TicketSlideOver.tsx` is missing, so there is no slideover copy, run CTA, terminal output, or latest-comment surface to inspect.
- `app/api/run/[id]/route.ts` is missing, so there is no auditable run truth source for startup, exit code, or final-state handling.
- `app/api/board-stream/route.ts` is missing, so there is no SSE contract to inspect for live-state copy, disconnect behavior, or stale/recovered states.
- `lib/db/client.ts` exposes no ticket-specific persistence layer to map status transitions, run outcomes, or comment writes.

Impact:

The central question in this ticket is whether run-state copy and surfaced status can diverge from reality. In this worktree, there is no run-state implementation to audit. Any claim about optimistic copy such as `Agent completed - moved to Review`, SSE event ordering, or persisted ticket fields would be invented.

Repro:

1. Open [app/page.tsx](/Users/admin/dev/agent-worktrees/AUDIT-AGENT-RUN-COPY-AND-STATUS-PARITY-01/app/page.tsx:3).
2. Confirm the page imports search/results components only and never imports a ticket board, card, or slideover.
3. Open [lib/db/client.ts](/Users/admin/dev/agent-worktrees/AUDIT-AGENT-RUN-COPY-AND-STATUS-PARITY-01/lib/db/client.ts:1).
4. Confirm the DB layer is a generic `query()` helper with no ticket/run schema contract.
5. Search the repo for `TicketSlideOver`, `board-stream`, and `app/api/run`.
6. Observe there is no implementation to execute or source-trace.

## Requested Audit Matrix

| Surface | Expected evidence | Actual result |
| --- | --- | --- |
| Button click to run request | Client action posting to `/api/run/[id]` | Blocked. No run action or route exists. |
| Run request to process start | API route writes initial running state | Blocked. No `app/api/run/[id]/route.ts`. |
| Live output updates | SSE events from `/api/board-stream` and client consumer | Blocked. No SSE route or client consumer exists. |
| Exit-state handling | Exit code mapped to success/failure state | Blocked. No run route or run model exists. |
| Final UI state | Board/slideover copy after success/failure | Blocked. No board or slideover UI exists. |
| Persisted ticket fields | DB writes for status/latest comment/activity | Blocked. No ticket persistence layer exists. |

## User-Visible Copy Claims

### UI copy findings

- No user-visible run copy is present in this worktree.
- I found no product source for `Agent completed`, `moved to Review`, `Review`, `latest_comment`, `is_running`, `board-stream`, or ticket-run status messaging.
- Because the surface is absent, I cannot truthfully classify any run-flow copy as evidence-based, premature, or false.

### Persisted status/data integrity findings

- No ticket status persistence implementation is present in this worktree.
- No ticket activity/comment persistence implementation is present in this worktree.
- No stored-field mapping can be audited between UI copy and DB state because the required routes and DB layer are absent.

## Reproduction Coverage

Required by ticket:

- one success-path repro
- one non-zero-exit repro
- one startup-failure repro
- one interrupted-stream repro

Actual status:

- Success path: blocked. There is no run surface to start.
- Non-zero exit path: blocked. There is no run executor or exit-state route to force failure through.
- Startup failure path: blocked. There is no run-start API to reject or partially start.
- Interrupted stream path: blocked. There is no `/api/board-stream` route or client consumer to disconnect.

This is a blocker, not a soft gap. The acceptance criteria require comparing board copy, slideover copy, and stored status transitions, but none of those surfaces exist here.

## Narrow Repair Recommendations

These are intentionally narrow and tied to the missing contract, not new features:

1. Restore or provide `app/api/run/[id]/route.ts` and make it the single truth source for run start, exit code, and final persisted status before any completion or review-move copy is shown.
2. Restore or provide `app/api/board-stream/route.ts` plus its client consumer, and ensure disconnect/reconnect states are explicit instead of implying live success when the stream is absent or stale.
3. Restore or provide `components/TicketSlideOver.tsx`, and keep run-state copy strictly derived from persisted run outcome plus live stream health, not from button click or optimistic local state.
4. Add or expose the ticket persistence layer that stores status transitions, latest comment/activity, and final run result so QA can compare UI copy against stored truth.

File targets:

- `app/api/run/[id]/route.ts`
- `app/api/board-stream/route.ts`
- `components/TicketSlideOver.tsx`
- ticket DB access layer adjacent to [lib/db/client.ts](/Users/admin/dev/agent-worktrees/AUDIT-AGENT-RUN-COPY-AND-STATUS-PARITY-01/lib/db/client.ts:1)

## Out Of Scope Findings

- The repo currently targets the public travel search/booking app, not the operator board described by this ticket.
- I did not audit unrelated search, score, booking, or hotel behavior beyond confirming that `app/page.tsx` is not the board surface.
- I did not propose schema changes or feature additions beyond the minimum missing surfaces needed to satisfy this audit.

## Verification Results

- `npx tsc --noEmit --incremental false`: pass.
- `npx jest --passWithNoTests`: pass, 20 test suites / 176 tests.

## Return Note

- What changed and why: Added this audit report documenting that the assigned run-copy/status-parity ticket is blocked because the board, slideover, run route, stream route, and ticket persistence surfaces are absent from this worktree.
- Files changed: `docs/audits/2026-07-01-audit-agent-run-copy-and-status-parity-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npx jest --passWithNoTests` passed with 20 suites / 176 tests.
- Any out-of-scope findings or blockers: Blocker: the worktree does not contain the board/run implementation named in the ticket, so success/failure parity cannot be audited truthfully here.
