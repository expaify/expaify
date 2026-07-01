# AUDIT-OPS-LIVE-REFRESH-DETAIL-SYNC-01: Live Refresh Detail Sync and Selection Stability

Status: blocked by missing implementation surface  
Priority: P0  
Role: QA

## Scope Result

I cannot truthfully verify selected-ticket detail synchronization during live board refreshes in this worktree because the assigned ticket-board implementation is absent. The current root page is the public expaify travel search and results experience, not an ops board with cards, a ticket slideover, ticket detail route, or board SSE route.

Requested first-pass files and current status:

| File | Status | QA impact |
| --- | --- | --- |
| `app/page.tsx` | Present | Implements travel search/results streaming from `/api/search`, not ticket board state. |
| `components/TicketSlideOver.tsx` | Missing | Cannot inspect selected detail state, stale logs, latest comment, focus behavior, or close behavior. |
| `components/TicketCard.tsx` | Missing | Cannot compare card status/comment/run indicators against an open detail view. |
| `app/api/board-stream/route.ts` | Missing | Cannot inspect SSE payload timing, refresh event shape, or client reconciliation behavior. |
| `app/api/tickets/[id]/route.ts` | Missing | Cannot inspect detail-fetch freshness, status mutation response shape, or comment/log source of truth. |

## Evidence

- `rg --files | rg '(^|/)(TicketCard|TicketSlideOver)\.tsx$|^app/api/(board-stream|tickets)(/|$)'` returned no implementation files.
- `rg -n "is_running|latest_comment|board-stream|TicketCard|TicketSlideOver|EventSource|new EventSource|activity feed|ticket" app components lib` found no ticket-board implementation matches. The only `ticket` matches in app code are booking-copy references to airline tickets.
- `app/page.tsx` starts search execution at line 658 and streams NDJSON from `/api/search` at lines 721-805. That code updates `flights`, `hotels`, `hotelAvailability`, `providerNotices`, and score loading state. It does not open `EventSource`, consume `/api/board-stream`, hold a selected ticket id/object, or reconcile a selected detail object after list refresh.

## Manual Verification Flow

Required flow:

1. Open the ops board.
2. Open a ticket slideover.
3. Start or simulate a live update through board-stream, status mutation, or agent run.
4. Keep the slideover open.
5. Compare card state, feed state, and slideover state before and after refresh on desktop and 375px mobile.

Actual result in this worktree: blocked. There is no ops board route, no ticket card, no ticket slideover, no board-stream route, no ticket detail route, no activity feed, and no run indicator source to exercise. Running this flow against the travel search page would not test the assigned risk.

## Findings

### P0 - Assigned board/detail/live-refresh surface is not present

Evidence: all requested board-specific files are missing except `app/page.tsx`, and `app/page.tsx` is unrelated travel search UI. It streams search results from `/api/search`, not ticket updates from `/api/board-stream`.

Impact: The acceptance criteria cannot be met against the intended product surface. I cannot determine whether selected-ticket detail remains accurate during live board refreshes, status changes, latest-comment updates, log updates, or agent runs because those states do not exist locally.

Cause classification: worktree/product-surface mismatch, not a client synchronization defect and not backend update timing.

Required next step: run this audit against the branch/worktree containing the actual ops board, `TicketCard`, `TicketSlideOver`, `/api/board-stream`, and `/api/tickets/[id]`, or update the ticket with the real current file paths.

### P1 - Client-vs-backend stale-state distinction cannot be assessed

Evidence: there is no selected ticket state, no ticket detail fetch, no status mutation path, no comment/log payload, and no board SSE route in the local implementation.

Impact: I cannot attribute stale status, stale log, stale latest comment, selection loss, unexpected close behavior, or misleading live-run success state to either client state synchronization or backend update timing.

Cause classification: blocked by missing state contract and missing routes.

## UX Self-Review

- Hierarchy: blocked for ticket card/slideover hierarchy because the components are absent.
- Contrast: blocked for the assigned board/detail UI because it is absent.
- Spacing: blocked for the assigned board/detail UI because it is absent.
- Mobile 375px fit: blocked for ticket selection/detail sync because there is no board or slideover to inspect.
- Desktop fit: blocked for ticket selection/detail sync because there is no board or slideover to inspect.
- Focus states: blocked for slideover open/close, status mutation, and run actions because the controls are absent.
- No cheap decorative effects: no assigned board/detail UI exists to evaluate.

## Verification

- `npx tsc --noEmit --incremental false`: passed with exit code 0 and no output.
- `npm test -- --passWithNoTests`: passed. 20 test suites passed, 176 tests passed.

## Return Note

- What changed and why: added this audit report documenting that AUDIT-OPS-LIVE-REFRESH-DETAIL-SYNC-01 is blocked by absent ops board/ticket live-refresh surfaces in the assigned worktree.
- Files changed: `docs/audits/2026-07-01-audit-ops-live-refresh-detail-sync-01.md`.
- Verification results: TypeScript passed; Jest passed with 20 suites and 176 tests.
- Blocker or out-of-scope finding: blocker is a worktree/product-surface mismatch. No implementation fix was made because the ticket is audit-only and the relevant implementation is not present.
