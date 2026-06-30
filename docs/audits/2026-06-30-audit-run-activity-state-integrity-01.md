# AUDIT-RUN-ACTIVITY-STATE-INTEGRITY-01: Run and Activity State Integrity

Date: 2026-06-30
Role: Senior Full-Stack Engineer
Scope: Strict audit only. No product code changed.

## Executive Decision

Blocked: the assigned board/run/ticket/activity surfaces are absent from this worktree.

I cannot verify consistency between board state, run state, slide-over detail state, and activity feed data because the implementation named in the ticket is not present. The current app is the expaify travel search and booking flow. It has `/api/search`, `/api/score`, `/api/book`, and deal-related routes, but no ticket board, no run polling route, no board stream route, no ticket route, no activity feed component, and no `lib/db.ts` ticket database layer.

Per the ticket instruction, this is a contract conflict and I am stopping at an audit report instead of guessing against unrelated travel search code.

## Surfaces Requested

Requested first-pass files and current status:

| Requested file | Status in this worktree | Audit impact |
| --- | --- | --- |
| `app/page.tsx` | Present, but implements the public travel search page | No board cards, ticket state, run state, or activity feed. Search state starts at `app/page.tsx:658`. |
| `components/TicketCard.tsx` | Missing | Cannot audit card display of `is_running`, `latest_comment`, `updated_at`, or `status`. |
| `components/TicketSlideOver.tsx` | Missing | Cannot audit detail-state overwrite behavior or activity visibility. |
| `app/api/run/[id]/route.ts` | Missing | Cannot audit run polling response shape, failures, or run-state truth source. |
| `app/api/board-stream/route.ts` | Missing | Cannot audit stream payload freshness, malformed payload handling, or local detail overwrite risk. |
| `app/api/tickets/[id]/route.ts` | Missing | Cannot audit single-ticket update/read contract. |
| `app/api/tickets/route.ts` | Missing | Cannot audit board list ordering, status fields, or activity feed payload. |
| `lib/db.ts` | Missing | Cannot map requested fields to database columns through this path. Existing DB singleton is `lib/db/client.ts`. |

Related files that do exist:

- `lib/db/client.ts` exports a generic Postgres singleton `query()` using `DATABASE_URL`, but it has no ticket-specific reads or writes (`lib/db/client.ts:1` to `lib/db/client.ts:21`).
- `app/api/search/route.ts` imports that singleton only to enroll searched flight routes in `searched_routes`, not tickets or activity (`app/api/search/route.ts:176` to `app/api/search/route.ts:185`).
- `app/page.tsx` streams search results from `/api/search`, not board-stream events (`app/page.tsx:721` to `app/page.tsx:805`).

## Requested Field Mapping

Because the board/run/ticket implementation is absent, the requested fields have no auditable display source in this worktree:

| Displayed field | Expected source route/database field | Actual source found | Result |
| --- | --- | --- | --- |
| `is_running` | Board/ticket API, run API, or ticket DB column | No occurrences in `app`, `components`, or `lib` | Blocked. No field or display exists. |
| `latest_comment` | Ticket API or activity/comment DB field | No occurrences in `app`, `components`, or `lib` | Blocked. No field or display exists. |
| `updated_at` | Ticket API/database timestamp | Only deal-detail normalization uses `updated_at`; no ticket usage | Blocked for ticket board. Not applicable to current search flow. |
| `status` | Ticket/run status fields and activity state | Current occurrences are provider/search/booking statuses, not ticket statuses | Blocked. No board status model exists. |
| Activity feed rows | Ticket activity API or DB table ordered by timestamp | No activity feed route/component/table found | Blocked. No ordering/content contract exists. |

Search evidence:

- `rg --files | rg '(^|/)(TicketCard|TicketSlideOver)\\.tsx$|app/api/(run|board-stream|tickets)'` returned no files.
- `rg -n "is_running|latest_comment|board-stream|TicketCard|TicketSlideOver|activity"` found no implementation matches in the requested surfaces.
- `find app -path '*api*' -maxdepth 5 -type f` lists only airports, alerts, baggage, book, calendar, deals, score, and search routes.

## Manual Verification Flow

Required flow: load board, update a ticket, observe board-stream refresh, open detail, and compare card, slide-over, and activity feed state.

Result: blocked before step 1.

Attempted source-level verification:

1. Locate the board page and ticket components.
2. Locate `/api/tickets`, `/api/tickets/[id]`, `/api/run/[id]`, and `/api/board-stream`.
3. Locate data fields `is_running`, `latest_comment`, `updated_at`, and ticket `status`.
4. Locate activity feed rendering and ordering logic.
5. Compare board card state to slide-over detail state and stream refresh behavior.

Actual outcome: none of the board/run/ticket/activity surfaces exist in this worktree, so there is no valid manual flow to execute or source-trace.

## Stream and Run Failure States

Requested question: whether failed board-stream or run-route responses create coherent user-visible states.

Result: blocked. There is no `app/api/board-stream/route.ts`, no `app/api/run/[id]/route.ts`, and no UI consumer for those routes. Therefore this worktree cannot demonstrate a coherent user-visible error state, loading state, stale-data state, or malformed-payload state for board-stream or run polling.

The nearest unrelated pattern is search streaming:

- `app/page.tsx` sets `isSearching`, clears results, then reads NDJSON from `/api/search` (`app/page.tsx:687` to `app/page.tsx:805`).
- Non-OK or missing search response body becomes a visible results error with retry and edit actions (`app/page.tsx:724` to `app/page.tsx:731`, `app/page.tsx:1328` to `app/page.tsx:1355`).
- Malformed NDJSON lines are silently skipped (`app/page.tsx:799` to `app/page.tsx:800`).

That pattern is not evidence for the requested board-stream contract because it does not consume ticket updates, run state, local ticket detail state, or activity feed payloads.

## Activity Feed Ordering and Content

Blocked. No activity feed component, route, table, or timestamp sorting logic exists in the requested implementation. I cannot verify whether feed ordering matches ticket update timestamps or whether content matches `latest_comment`.

The only `updated_at` usage found in relevant application code is deal detail normalization in `lib/deals/dealDetail.ts`; it is unrelated to board ticket activity.

## Empty, Loading, Error, Mobile, and Desktop States

Requested board/run/activity visibility states are blocked because no board UI exists.

Source-level review of the unrelated current search page:

- Loading: search results page shows a progress bar and "Scanning deals across providers..." while `/api/search` streams (`app/page.tsx:1242`, `app/page.tsx:1277` to `app/page.tsx:1285`).
- Error: search failure renders a results error panel with Retry and Edit actions (`app/page.tsx:1328` to `app/page.tsx:1355`).
- Empty: flight/provider empty states are handled inside `components/flights/FlightResults.tsx`, outside the assigned board/run scope.
- Mobile 375px: the current search form and results header use single-column/wrapping classes in the inspected source. No board card, slide-over, or activity feed mobile state exists to inspect.
- Desktop: the current search/results layout has desktop breakpoints, but no board/run/activity desktop state exists to inspect.

No evidence was found of overlapping board/activity text, hidden board actions, fake board data, or decorative board clutter because the board itself is absent.

## Findings

### P0 - Assigned board/run/ticket implementation is missing

Evidence: all requested board/run/ticket files except `app/page.tsx` are absent, and the present `app/page.tsx` is the travel search UI. There are no source matches for `is_running`, `latest_comment`, `board-stream`, `TicketCard`, or `TicketSlideOver`.

Impact: Acceptance criteria cannot be met against the intended product surface. A paid-user repair audit would be misleading if it inferred board/run integrity from unrelated search streaming code.

Required next step: run this ticket against the worktree or branch that contains the ticket board implementation, or provide the intended file paths for the renamed board/run/activity surfaces.

### P1 - No ticket activity source can be mapped

Evidence: `lib/db.ts` is absent, and `lib/db/client.ts` only provides a generic Postgres query singleton. The only API route using it in the inspected area writes `searched_routes` for travel searches, not ticket activity.

Impact: There is no auditable database or route contract for `updated_at`, status transitions, comments, or activity feed ordering.

### P1 - Board-stream and run failure UX cannot be demonstrated

Evidence: `/api/board-stream` and `/api/run/[id]` do not exist. No UI code opens an event stream or polls a run route for ticket state.

Impact: The required user-visible failure-state answer is "not implemented in this worktree," not pass or fail.

## Out-of-Scope Notes

- I did not implement new run orchestration behavior.
- I did not change database schema or ticket status models.
- I did not change provider timeout handling or files under `lib/providers`.
- I did not refactor the unrelated travel search page.
- I did not start a browser QA pass because there is no board/run/activity UI to exercise for this ticket.

## Self-Review

- Hierarchy: current report separates blocker, field mapping, verification flow, and findings.
- Contrast: no product UI changed, so contrast was not altered.
- Spacing: no product UI changed, so spacing was not altered.
- Mobile fit: requested board mobile fit is blocked by missing board UI; unrelated search source uses responsive classes but was not modified.
- Focus states: no product UI changed; requested board focus states cannot be audited.
- Decorative effects: no product UI changed; no new decorative effects added.

## Verification Commands

- `npx tsc --noEmit --incremental false` - passed.
- `npx jest --runInBand` - passed. 20 test suites passed, 168 tests passed.
- `npm test -- --passWithNoTests` - passed. 20 test suites passed, 168 tests passed.

## Required Return Note

- What changed and why: Added this audit report documenting that AUDIT-RUN-ACTIVITY-STATE-INTEGRITY-01 is blocked because the board/run/ticket/activity implementation is absent from this worktree.
- Files changed: `docs/audits/2026-06-30-audit-run-activity-state-integrity-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npx jest --runInBand` passed with 20 suites and 168 tests; `npm test -- --passWithNoTests` passed with 20 suites and 168 tests.
- Out-of-scope findings or blockers: All requested board/run/ticket files except `app/page.tsx` are missing; `app/page.tsx` is unrelated travel search UI.
