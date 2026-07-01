# AUDIT-OPS-ACTIVITY-FEED-RECENCY-LINEAGE-01

Date: 2026-07-01
Role: Senior QA Engineer
Result: Blocked - the requested activity-feed and ticket-board surfaces are not present in this worktree.

## Scope Check

Assigned first-pass files:

- `app/page.tsx`
- `app/api/board-stream/route.ts`
- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`
- `lib/db.ts`

What exists here:

- `app/page.tsx` exists, but it is the public expaify search/results client page. Its imports are airport input, hotel card, and flight-results components, not board or ticket-feed surfaces (`app/page.tsx:7` to `app/page.tsx:10`).
- `app/page.tsx` only models `form | results` views, which does not match a board card, activity feed, or ticket slideover state model (`app/page.tsx:12`).
- `app/page.tsx` streams fare and hotel search results from `/api/search`, not board activity items (`app/page.tsx:724` to `app/page.tsx:796`).
- `app/api/board-stream/route.ts` does not exist in this repository.
- `components/TicketCard.tsx` does not exist in this repository.
- `components/TicketSlideOver.tsx` does not exist in this repository.
- `lib/db.ts` does not exist in this repository. The local database surfaces are `lib/db/client.ts`, `lib/db/getBaseline.ts`, and `lib/db/schema.sql`.

Repo contract confirming the mismatch:

- `AGENTS.md` says to use this repo as the source of truth and not assume ticket-board surfaces unless they exist in the worktree (`AGENTS.md:9`).
- `AGENTS.md` says to stop and report the mismatch if a ticket references product surfaces not present in the repo (`AGENTS.md:26`).
- `AGENTS.md` explicitly lists `components/TicketCard.tsx`, `components/TicketSlideOver.tsx`, `lib/db.ts`, and `app/api/board-stream/...` as absent from this worktree (`AGENTS.md:68` to `AGENTS.md:79`).
- `README.md` states that this repo is the public travel app and is not a ticket-board or agent-orchestration app (`README.md:7` to `README.md:8`).

Additional repo checks:

- `app/api/` contains airports, alerts, baggage, booking, calendar, deals, score, and search routes. No board, ticket, or run stream route family exists.
- Repo search for `latest_comment`, `is_running`, `TicketCard`, `TicketSlideOver`, `board-stream`, `activity feed`, and similar board terms found audit documents only, not local product implementation.

## Acceptance Criteria Evaluation

| Criterion | Result | Notes |
| --- | --- | --- |
| Audit report documents how the activity feed orders items and what user-visible cues indicate recency and source lineage | Blocked | No activity feed implementation, route, or ticket UI exists to inspect. |
| Report includes at least one manual repro where feed content can be mistaken for fresh, stale, or contradictory activity | Blocked | No feed items, comments, statuses, or running-ticket state exist locally. |
| Report compares the same ticket across board card, activity feed, and slideover and notes any mismatch | Blocked | None of those ticket surfaces are present in this worktree. |
| Manual verification flow included: start a run, observe live board updates, open the ticket slideover, then confirm whether feed content remains consistent after the run ends | Done | The intended flow is documented below; execution is blocked because the required surfaces are absent. |
| `npx tsc --noEmit --incremental false` is run and the result is reported | Done | See Verification Results. |
| `npm test -- --passWithNoTests` is run and the result is reported | Done | See Verification Results. |
| Final self-review explicitly covers hierarchy, contrast, spacing, mobile fit, focus states, and no cheap decorative effects | Partial | Covered below as blocked/not verifiable for the assigned ticket surface. |

## Findings

### P1 - Assigned activity-feed recency and lineage audit cannot be executed truthfully in this repository

Evidence:

- `app/page.tsx` is a customer search/results page and does not import board, ticket, card, feed, or slideover components (`app/page.tsx:7` to `app/page.tsx:10`).
- The page state is `form | results`, not board/ticket/feed state (`app/page.tsx:12`).
- The only streaming flow reads NDJSON from `/api/search` and handles `flights`, `hotels`, `hotel-status`, `suggestion`, `notice`, and `done` messages, which are travel-search events rather than agent comments or ticket status updates (`app/page.tsx:724` to `app/page.tsx:796`).
- `app/api/board-stream/route.ts`, `components/TicketCard.tsx`, `components/TicketSlideOver.tsx`, and `lib/db.ts` are absent.
- Repo guidance explicitly says these board/ticket surfaces are not local implementation facts in this worktree (`AGENTS.md:68` to `AGENTS.md:79`, `README.md:21` to `README.md:26`).

Impact:

The ticket asks for visible recency, lineage, sorting, and running-state honesty on a board activity feed. None of the required data model, API, or UI surfaces exist here, so any pass/fail statement about `latest_comment`, `is_running`, sort order, stale-comment cues, or 375px feed readability would be fabricated.

Repro:

1. Inspect `app/page.tsx` and confirm it imports travel-search components only.
2. Search the repo for `latest_comment`, `is_running`, `board-stream`, `TicketCard`, and `TicketSlideOver`.
3. Inspect `app/api/` and `lib/db/`.
4. Observe there is no ticket-board route, no feed API, no card/slideover UI, and no ticket-state storage surface to audit.

### P1 - Required mismatch checks across board card, activity feed, and slideover are blocked at every comparison point

Evidence:

- No `TicketCard` implementation exists to expose card-level recency or running-state cues.
- No board-stream route exists to provide a feed ordering contract or lineage metadata.
- No `TicketSlideOver` implementation exists to compare current run state versus feed history.
- No ticket-specific DB helper or schema is present under the requested `lib/db.ts` path.

Impact:

The assigned comparison workflow cannot be executed. QA cannot verify whether a running ticket can appear stale, whether a prior comment can appear fresh, whether live agent output is visually separated from prior history, or whether the slideover contradicts the card/feed after a run ends.

Repro:

1. Attempt to open `components/TicketCard.tsx`.
2. Attempt to open `app/api/board-stream/route.ts`.
3. Attempt to open `components/TicketSlideOver.tsx`.
4. Attempt to open `lib/db.ts`.
5. Observe all four requested ticket/feed surfaces are absent from the repo.

## Sorting, Recency, and Lineage Audit

Sorting behavior for `latest_comment`:

Blocked. No `latest_comment` field, board-stream response, or ticket query path exists locally.

Visible recency cues:

Blocked. No timestamps, relative-time labels, "running now" indicators, updated-at copy, or stale-state styling exist on the requested surface because the surface itself is absent.

Lineage cues:

Blocked. No local UI distinguishes live agent output versus prior run history versus stale comments because there is no ticket activity feed or ticket detail UI in this worktree.

`is_running` versus perceived recency:

Blocked. No `is_running` field, run state model, or ticket UI exists to compare.

## Manual Verification Flow

Intended flow from the ticket:

1. Start a run.
2. Observe live board updates.
3. Open the ticket slideover.
4. Compare board card, activity feed, and slideover state during the run.
5. End the run.
6. Confirm whether feed content remains consistent after the run ends.

Actual result:

Blocked. This worktree has no ticket board, no activity feed, no run action, no board-stream route, no ticket card, and no ticket slideover to exercise.

## Desktop And Mobile Review

Desktop readability:

Blocked for the assigned surface. There is no board card, feed row, or slideover content block to inspect for long comments, truncated context, or contradictory recency cues.

Mobile 375px fit:

Blocked for the assigned surface. There is no ticket/feed UI to inspect for text overlap, hidden actions, clipped timestamps, or unreadable truncation at 375px.

## Self-Review

Hierarchy:

Not verifiable for the assigned ticket UI. No board/feed/slideover hierarchy exists locally.

Contrast:

Not verifiable for comment age, live-state emphasis, or source-lineage distinctions because the requested UI is absent.

Spacing:

Not verifiable for feed rows, timestamp placement, comment truncation, or slideover sections because the requested UI is absent.

Mobile fit:

Not verifiable at 375px because there is no ticket-board or feed surface to open.

Focus states:

Not verifiable for board-to-slideover interaction because there is no ticket card trigger or slideover focus flow in this repository.

Cheap decorative effects:

Not applicable to the assigned surface in this worktree. I did not substitute unrelated travel-search UI as evidence for a missing board feed.

## Verification Results

- `npx tsc --noEmit --incremental false`: pass.
- `npm test -- --passWithNoTests`: pass, 20 test suites / 176 tests.

## Return Note

- What changed and why: Added this audit report documenting that the requested activity-feed recency and lineage audit is blocked because the ticket-board/feed implementation is not present in this worktree.
- Files changed: `docs/audits/2026-07-01-audit-ops-activity-feed-recency-lineage-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm test -- --passWithNoTests` passed with 20 suites / 176 tests.
- Any out-of-scope findings or blockers: Blocker: the assigned ticket targets board/feed/ticket surfaces that this repository and its own repo instructions say are absent. No product code was changed.
