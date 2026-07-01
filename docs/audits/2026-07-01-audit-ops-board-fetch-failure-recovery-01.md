# AUDIT-OPS-BOARD-FETCH-FAILURE-RECOVERY-01: Board Fetch-Failure Recovery Honesty

Date: 2026-07-01  
Role: Senior QA Engineer  
Scope: Audit only. No feature code changed.

## Executive Decision

Blocked by repo mismatch. The assigned board surface is not present in this worktree, so the requested first-load, retry, empty-list, and reconnect audit cannot be truthfully executed against the named files.

The ticket requires:

- `/api/tickets` success, slow response, failure, and empty-list repro
- first-load versus post-SSE-connect UI comparison
- loading-copy clearing verification
- visible retry or recovery path verification
- mobile 375px and desktop layout review for those board states

This branch does not contain the required board routes or ticket components. The present `app/page.tsx` is the public expaify travel search page, not an ops board.

## Requested Files Versus Reality

| Requested file | Status | Audit impact |
| --- | --- | --- |
| `app/page.tsx` | Present, but it is the travel search/results page | No board columns, no ticket list, no retry control for board fetch, no SSE board client |
| `app/api/tickets/route.ts` | Missing | Cannot reproduce success, slow, failure, or empty-list first load |
| `app/api/board-stream/route.ts` | Missing | Cannot reproduce SSE connect, disconnect, reconnect, or stale recovery |
| `components/TicketCard.tsx` | Missing | Cannot inspect ticket list empty/error/loading card states |
| `components/NewTicketModal.tsx` | Missing | Not relevant to the fetch audit, but the requested first-pass file is absent |

Evidence from the current repo:

- `app/page.tsx` imports airport input, hotel card, flight results, and flight sorting logic, which identifies the page as customer search UI, not a board: `app/page.tsx:3` to `app/page.tsx:10`.
- `app/page.tsx` defines search-specific state such as `View`, `TripType`, `SortBy`, `ActiveTab`, hotel availability, and search criteria, not board fetch or ticket state: `app/page.tsx:12` to `app/page.tsx:32`.
- The visible first-screen copy is travel-product copy, not board copy: `Travel deal intelligence`, `Live fare scoring`, and `Know when a flight price is actually worth booking.` at `app/page.tsx:948` to `app/page.tsx:965`.
- The available API tree contains airports, alerts, baggage, book, calendar, deals, score, and search only. There is no `tickets` or `board-stream` route family.

## Repro Audit

### Case 1: First-load `/api/tickets` success

Status: Blocked

Repro steps:

1. Run `find app/api -maxdepth 3 -type f | sort`.
2. Confirm `app/api/tickets/route.ts` is absent.
3. Open `app/page.tsx` and confirm the root page is the travel search page, not a board.

Expected:

Loading the board should request `/api/tickets`, then render the board list on success.

Actual:

There is no `/api/tickets` route and no board UI consumer to load from it. The user instead lands on the travel search page.

What the user sees in this branch:

- Brand: `expaify`
- Subtitle: `Travel deal intelligence`
- Badge: `Live fare scoring`
- H1: `Know when a flight price is actually worth booking.`

Honesty assessment:

Missing. The requested board success state does not exist in this repo.

### Case 2: First-load `/api/tickets` slow response

Status: Blocked

Repro steps:

1. Attempt to identify the board fetch route.
2. Confirm there is no `/api/tickets` implementation to delay.
3. Confirm there is no board loading state consumer in `app/page.tsx`.

Expected:

The board should show an explicit loading state tied to the initial `/api/tickets` request, then clear that state when data arrives.

Actual:

No board fetch path exists, so there is no board loading copy to inspect, stall, or verify for correct clearing.

What the user sees in this branch:

The travel-search home screen described above. No board loading language is present on first render.

Honesty assessment:

Missing. There is no board loading state to judge as honest or misleading.

### Case 3: First-load `/api/tickets` failure

Status: Blocked

Repro steps:

1. Attempt to locate `/api/tickets`.
2. Confirm it does not exist.
3. Confirm there is no board-level error UI or retry control in the named first-pass files because the board files are absent.

Expected:

A failed initial board fetch should show explicit failure copy plus a visible retry path.

Actual:

No board fetch route exists, so the failure case cannot be simulated in this worktree.

What the user sees in this branch:

The same travel search landing screen. No board failure copy or retry affordance is present because there is no board surface.

Honesty assessment:

Missing. The board failure state and recovery affordance are absent, not merely weak.

### Case 4: Empty-list `/api/tickets` response

Status: Blocked

Repro steps:

1. Attempt to locate `/api/tickets`.
2. Confirm there is no route to mock an empty payload from.
3. Confirm there is no ticket-list component to render an empty board state.

Expected:

An empty dataset should render a distinct empty-state message that does not resemble loading or failure.

Actual:

No empty-list path is reproducible because the tickets route and ticket list UI do not exist.

What the user sees in this branch:

The travel search landing screen, not an empty board.

Honesty assessment:

Missing. No empty board state exists to validate.

### Case 5: Post-failure reconnect after SSE restore

Status: Blocked

Repro steps:

1. Run `find app/api -maxdepth 3 -type f | sort`.
2. Confirm there is no `app/api/board-stream/route.ts`.
3. Search `app`, `components`, and `lib` for `EventSource`, `text/event-stream`, or `board-stream`.

Expected:

After stream restore, the board should visibly transition from disconnected or failed to reconnected, and stale loading/error copy should clear.

Actual:

There is no SSE route and no client consumer. Reconnect behavior cannot be reproduced.

What the user sees in this branch:

The travel search UI only. No live board status, disconnected copy, reconnect copy, or recovery action is present.

Honesty assessment:

Missing. There is no reconnect surface to classify.

## First Load Versus Post-SSE Comparison

Not testable in this worktree.

- First load: user sees the travel search homepage.
- After SSE connect: no board SSE route or SSE client exists, so there is no changed post-connect state to compare.

## Loading Copy Clearing

Not testable for the assigned board flow.

- There is no initial board loading copy in the requested files because the board files do not exist.
- There is therefore no board loading copy to verify for correct clearing after success, failure, or reconnect.

## Retry Or Recovery Affordance

Not present for the assigned board flow.

- No board fetch route exists.
- No board error UI exists.
- No board retry control is present in the requested files.

Assessment: missing recovery affordance, blocked by absent implementation.

## Mobile 375px And Desktop Review

Board-specific review is blocked because no board UI exists.

What can be said honestly about the current branch:

- The current first screen is a two-column travel-search hero on large screens and a stacked travel-search layout on small screens: `app/page.tsx:941` to `app/page.tsx:980`.
- This is not evidence for the requested board loading, empty, failure, or reconnect states.

Hierarchy, contrast, spacing, mobile fit, focus states, and cheap decorative effects:

- Hierarchy: board hierarchy cannot be reviewed because the board does not exist here.
- Contrast: board-specific contrast cannot be reviewed because the board does not exist here.
- Spacing: board spacing cannot be reviewed because the board does not exist here.
- Mobile fit at 375px: board mobile fit cannot be reviewed because the board does not exist here.
- Focus states: board keyboard/focus behavior cannot be reviewed because the board does not exist here.
- Decorative effects: no board surface exists to assess for clutter or fake affordances.

## Manual Verification Flow Requested By Ticket

Requested flow:

1. Load the board normally.
2. Simulate a failed `/api/tickets` response.
3. Restore the route.
4. Confirm what changes on screen.

Actual result:

Blocked at step 1. There is no board route, no `/api/tickets`, and no `/api/board-stream` route in this worktree.

## Acceptance Criteria Coverage

| Acceptance criterion | Status | Notes |
| --- | --- | --- |
| Audit report lists exact repro steps for first-load failure, slow response, empty dataset, and reconnect cases | Partial | Repro steps are documented, but each case is blocked by absent implementation. |
| Report identifies the exact user-visible copy and layout shown in each case, with file references | Partial | Exact visible copy is provided for what the current branch actually shows: the travel search homepage. The requested board states do not exist. |
| Report states whether the current behavior is honest, misleading, or missing a recovery affordance | Pass | Each assigned board case is classified as missing because the implementation is absent. |
| Manual verification flow included: load board normally, simulate failed `/api/tickets`, then restore route and confirm screen changes | Partial | Included and blocked at step 1 due to missing board routes. |
| `npx tsc --noEmit --incremental false` is run and the result is reported | Pass | Command completed with exit code 0. |
| `npm test -- --passWithNoTests` is run and the result is reported | Pass | Command completed with exit code 0; 20 suites and 176 tests passed. |
| Final self-review explicitly covers hierarchy, contrast, spacing, mobile fit, focus states, and no cheap decorative effects | Pass | Covered as blocked because the board surface is absent. |

## Out-Of-Scope Findings

- This ticket references product surfaces explicitly marked absent in `AGENTS.md`: `components/TicketCard.tsx`, `app/api/tickets/...`, and `app/api/board-stream/...`.
- `package.json` declares `next: 16.2.9`, while the briefing says Next.js 15. That mismatch is real but secondary to the missing board implementation.

## Verification

- `npx tsc --noEmit --incremental false`
- `npm test -- --passWithNoTests`

Results:

- `npx tsc --noEmit --incremental false` passed with exit code 0.
- `npm test -- --passWithNoTests` passed with exit code 0; 20 suites and 176 tests passed.

## Required Return Note

- What changed and why: Added this audit report documenting that the assigned board fetch-failure recovery audit is blocked because the required board routes and ticket components are absent from this worktree.
- Files changed: `docs/audits/2026-07-01-audit-ops-board-fetch-failure-recovery-01.md`
- Verification commands and results: `npx tsc --noEmit --incremental false` passed with exit code 0; `npm test -- --passWithNoTests` passed with exit code 0 and 20 suites / 176 tests passed.
- Any out-of-scope findings or blockers: The current branch does not contain the requested ops-board implementation; `AGENTS.md` explicitly marks several assigned files as absent.
