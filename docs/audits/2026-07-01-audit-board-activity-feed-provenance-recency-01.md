# AUDIT-BOARD-ACTIVITY-FEED-PROVENANCE-RECENCY-01

Date: 2026-07-01
Role: Senior QA Engineer
Result: Blocked by repo mismatch. The assigned activity feed implementation is not present in this worktree.

## Executive Decision

This ticket cannot be truthfully completed against the current branch. The requested board activity feed, ticket slideover, run route, and board stream route do not exist here. The only requested file that exists is `app/page.tsx`, and it is the public expaify travel search/results page rather than an operator board.

Per the repo contract, I am stopping at the mismatch instead of inventing behavior for absent surfaces.

## Scope Check

Assigned first-pass files:

- `app/page.tsx`
- `app/api/board-stream/route.ts`
- `app/api/run/[id]/route.ts`
- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`
- `lib/db.ts`

What exists in this worktree:

- `app/page.tsx` exists, but it imports airport input, hotel cards, and flight results rather than board or ticket UI (`app/page.tsx:3` to `app/page.tsx:10`).
- `app/page.tsx` state models search form/results state, not tickets, runs, activity items, or slideover state (`app/page.tsx:12` to `app/page.tsx:32`).
- `app/page.tsx` fetches `/api/search` and streams NDJSON search results, not board activity or run updates (`app/page.tsx:658` to `app/page.tsx:809`).
- `app/api/board-stream/route.ts` is missing.
- `app/api/run/[id]/route.ts` is missing.
- `components/TicketCard.tsx` is missing.
- `components/TicketSlideOver.tsx` is missing.
- `lib/db.ts` is missing.
- The only DB helper in scope is `lib/db/client.ts`, which exposes a generic Postgres `query()` wrapper and no ticket/activity schema or provenance logic (`lib/db/client.ts:1` to `lib/db/client.ts:21`).

Repo checks performed:

1. `rg --files` confirmed the requested board/ticket files are absent.
2. `find app/api -maxdepth 3 -type f | sort` showed airports, alerts, baggage, booking, deals, score, and search routes only.
3. `rg -n "latest_comment|is_running|updated_at|board-stream|TicketCard|TicketSlideOver" app components lib --glob '!docs/**'` found no board implementation matches. The only `updated_at` matches are deal-detail normalization, not ticket activity.

## What The Feed Can And Cannot Prove

### Confirmed

- Nothing in the current app proves who produced a board activity item because no board activity item implementation exists.
- Nothing in the current app proves when a board activity item was produced because no board activity timestamp field or rendering path exists.
- Nothing in the current app proves whether visible text is a human comment, agent update, status change, or failure because no board activity feed or ticket detail implementation exists.

### Not Confirmable In This Worktree

- Whether raw `latest_comment` text is shown on the board.
- Whether feed entries distinguish system-generated updates from human comments.
- Whether stale entries are labeled as stale.
- Whether timestamps are shown, hidden, or truncated.
- Whether the board feed matches the ticket slideover for the same ticket.
- Whether a live run updates the feed honestly during execution and on completion.

## Confirmed Defects

### P0 - Assigned board activity feed surface is absent

Files:

- `app/page.tsx:3` to `app/page.tsx:10`
- `app/page.tsx:12` to `app/page.tsx:32`
- `app/page.tsx:658` to `app/page.tsx:809`
- Missing: `app/api/board-stream/route.ts`
- Missing: `app/api/run/[id]/route.ts`
- Missing: `components/TicketCard.tsx`
- Missing: `components/TicketSlideOver.tsx`
- Missing: `lib/db.ts`

Repro steps:

1. Run `rg --files | rg '(^app/api/board-stream/route\\.ts$|^app/api/run/.*/route\\.ts$|^components/Ticket(Card|SlideOver)\\.tsx$|^lib/db\\.ts$)'`.
2. Inspect `app/page.tsx`.
3. Inspect `find app/api -maxdepth 3 -type f | sort`.

Expected:

The worktree should contain the board feed route, ticket card, ticket slideover, run route, and DB layer needed to trace activity provenance and recency.

Actual:

Those surfaces are absent. The current root page is a customer travel search/results page using `/api/search`.

Trust impact:

This is a release-blocking audit blocker. Any claim about activity-feed trust, provenance, freshness, or parity from this branch would be false confidence.

### P0 - Provenance and recency metadata cannot be audited because no activity item contract is present

Files:

- `lib/db/client.ts:1` to `lib/db/client.ts:21`
- Missing: `lib/db.ts`
- Missing: `app/api/board-stream/route.ts`
- Missing: `components/TicketCard.tsx`
- Missing: `components/TicketSlideOver.tsx`

Repro steps:

1. Inspect `lib/db/client.ts`.
2. Search for `latest_comment`, `is_running`, and ticket activity fields in `app`, `components`, and `lib`.
3. Confirm there is no board route or component consuming such fields.

Expected:

The codebase should expose a concrete data contract for activity items, including at minimum source/type, timestamp/recency, and text/body fields, plus a render path that shows how those fields reach the board and slideover.

Actual:

No such contract exists in this worktree. `lib/db/client.ts` is only a generic query helper, and no board activity query or render path is present.

Trust impact:

The feed cannot prove whether any visible update is human-authored, agent-authored, status-derived, or stale because there is no auditable source of truth.

### P1 - Feed versus slideover parity cannot be checked because neither surface exists

Files:

- Missing: `components/TicketCard.tsx`
- Missing: `components/TicketSlideOver.tsx`
- Missing: `app/api/run/[id]/route.ts`

Repro steps:

1. Search for `TicketCard` and `TicketSlideOver`.
2. Confirm no ticket list card or ticket detail/slideover exists.
3. Confirm no run detail route exists for side-by-side state comparison.

Expected:

The same ticket should be viewable in both a board/feed context and a detail/slideover context so text, timestamps, and status meaning can be compared.

Actual:

Neither surface exists in this branch.

Trust impact:

The acceptance criterion around parity gaps is blocked completely. There is no basis to verify whether the board compresses or misrepresents ticket detail.

## Improvement Suggestions

These are not feature requests. They are the minimum repair set required before this ticket can be re-run meaningfully.

1. Restore or provide the actual board implementation files for the assigned surface: board feed route, run route, ticket card, ticket slideover, and board DB access layer.
2. Ensure each activity item has an explicit type/source field and timestamp field in the API contract before QA retries provenance and recency review.
3. Ensure the board feed and ticket slideover consume the same underlying activity model so parity can be audited without guessing.

## Manual Verification Flow

Required flow from the ticket:

1. Start an agent run.
2. Watch feed updates live.
3. Open the same ticket in slideover.
4. Wait for completion.
5. Compare final board signals.

Actual execution result:

Blocked at step 1. No board route, feed UI, ticket UI, slideover UI, or run route exists in this worktree.

## Acceptance Criteria Coverage

| Criterion | Status | Notes |
| --- | --- | --- |
| Audit states exactly what the activity feed can and cannot prove | Pass | Exact blocker-based limits are stated above. |
| Report identifies stale or ambiguous feed states with repro and file references | Partial | Confirmed blocker states are documented with repro and references. Feed-behavior-specific states are blocked because the feed is absent. |
| Report compares activity feed text against ticket slideover content and notes mismatch | Blocked | No feed or slideover exists to compare. |
| Report includes manual verification flow for live updates and completion | Partial | Flow is documented, execution is blocked at the first step by missing implementation. |
| Report ranks findings by operator trust impact and separates confirmed defects from suggestions | Pass | Confirmed defects and suggestions are separated and ordered by trust impact. |
| `npx tsc --noEmit --incremental false` is run and recorded | Pass | Command completed successfully with exit code 0. |
| `npm test -- --passWithNoTests` is run and recorded plainly | Pass | Command completed successfully: 20 suites passed, 176 tests passed. |

## Verification Results

- `npx tsc --noEmit --incremental false`: passed.
- `npm test -- --passWithNoTests`: passed, 20 suites and 176 tests.

## Return Note

- What changed and why: Added this audit report documenting that the assigned activity-feed provenance/recency audit is blocked because the board implementation is absent from this worktree.
- Files changed: `docs/audits/2026-07-01-audit-board-activity-feed-provenance-recency-01.md`
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm test -- --passWithNoTests` passed with 20 suites and 176 tests.
- Any out-of-scope findings or blockers: The ticket targets board/ticket/run surfaces that are not present in this repository; `package.json` declares Next `16.2.9`, while the briefing says Next.js 15.
