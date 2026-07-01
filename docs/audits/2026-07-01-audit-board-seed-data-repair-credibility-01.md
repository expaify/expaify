# AUDIT-BOARD-SEED-DATA-REPAIR-CREDIBILITY-01: Seed Data And Repair-Mode Credibility

Date: 2026-07-01  
Role: Senior QA Engineer  
Scope: seeded board content shown on a fresh local boot, and whether that content matches repair mode, current ticket guardrails, and a believable operator workflow

## Verdict

Blocked by worktree mismatch, with one concrete seed finding.

This repo does not contain the board implementation named in the ticket, and the local seed path does not create any ticket data. On a fresh local boot, there are no seeded board tickets to audit for `FEAT-*`, stale status, outdated role, or feature-building posture. The only current first screen is the public travel search homepage in `app/page.tsx`, which is not a board and does not render ticket IDs, titles, statuses, roles, or descriptions.

## Requested Surface Check

The ticket says to inspect these files first:

- `lib/db.ts`
- `app/page.tsx`
- `components/TicketCard.tsx`
- `components/NewTicketModal.tsx`
- `components/TicketSlideOver.tsx`

Actual repo state:

- `app/page.tsx` exists and is the travel search/results page, not a board: `app/page.tsx:3-10`, `app/page.tsx:986-1207`.
- `lib/db.ts` does not exist. The DB surface here is `lib/db/client.ts`, `lib/db/schema.sql`, and `lib/db/getBaseline.ts`.
- `components/TicketCard.tsx` does not exist.
- `components/NewTicketModal.tsx` does not exist.
- `components/TicketSlideOver.tsx` does not exist.
- Repo scope explicitly says this worktree is not a ticket-board app: `README.md:7-8`, `README.md:21-27`, `README.md:44-46`.

## Seed Source

Seed source in this repo:

- `package.json:12` wires `npm run db:seed` to `scripts/seed.ts`.
- `scripts/seed.ts:5-10` reads `lib/db/schema.sql` and executes it.
- `lib/db/schema.sql:1-69` creates travel tables and a view only:
  - `snapshots`
  - `hotel_snapshots`
  - `route_baseline`
  - `price_alerts`
  - `searched_routes`

No ticket table, board table, seed insert, default ticket row, seeded status, seeded role, or seeded description exists in the current schema or seed script.

## Seeded Ticket Inventory

Fresh DB result from current seed source:

| Seeded item | Source | First visible UI surface | Credibility label | Notes |
| --- | --- | --- | --- | --- |
| No seeded board tickets | `scripts/seed.ts:5-10`, `lib/db/schema.sql:1-69` | None | Credible as code reality, conflicting with ticket expectation | The repo seeds schema only. There is no seeded board content to classify as stale or conflicting. |

Literal acceptance-criteria answer:

- Every seeded ticket currently shown on a fresh DB: none.
- Credible/stale/conflicting labels for seeded IDs, titles, statuses, roles, descriptions: not applicable because no such seeded records exist in this worktree.

## Findings

### P0 - The assigned board seed audit cannot be completed against this repo

Evidence:

- Board files named by the ticket are absent.
- Repo README states this is the public travel app, not a ticket-board app: `README.md:7-8`, `README.md:21-27`.
- The current root page renders travel search and route suggestions, not board lanes or ticket cards: `app/page.tsx:986-1207`.

Repro:

1. Run `rg --files | rg '(^|/)(TicketCard|TicketSlideOver|NewTicketModal)\\.tsx$|^lib/db\\.ts$'`.
2. Open `app/page.tsx`.
3. Confirm the visible first-screen content is search inputs and route suggestions, not seeded tickets.

Actual:

There is no board route, no board card component, no ticket detail surface, and no ticket seed source in this worktree.

Expected:

For this ticket to be auditable, the repo would need a board UI plus a seed source that creates visible ticket records.

Impact:

Any report that claims seeded `FEAT-*` board tickets are visible on first open in this repo would be false.

### P1 - Fresh boot does not seed any operator tickets, so the ticket's credibility concern is upstream of this repo

Evidence:

- `npm run db:seed` points to `scripts/seed.ts`: `package.json:12`.
- `scripts/seed.ts` applies schema only and does not insert rows: `scripts/seed.ts:5-10`.
- `lib/db/schema.sql` contains travel pricing and alert/search tables only: `lib/db/schema.sql:1-69`.

Repro:

1. Reset the local database used by this worktree.
2. Run `npm run db:seed`.
3. Inspect `scripts/seed.ts` and `lib/db/schema.sql`.
4. Search the repo for `FEAT-`, `ticket`, and `INSERT INTO` related to board seeds.

Actual:

Fresh boot creates travel data structures only. No seeded board tickets are generated.

Expected:

If seeded board content is the target of the audit, the seed layer should contain that content or the board should fetch it from a visible local source.

Impact:

The credibility failure here is a contract/path mismatch: the ticket assumes a seeded board that this repo does not implement.

### P1 - First-screen content teaches the public search workflow, not an operator repair workflow

Evidence:

- First-screen primary heading is `Search flights`: `app/page.tsx:986`.
- Supporting copy is travel-search copy: `app/page.tsx:987-991`.
- The first-screen cards are route suggestions with travel metadata like `Deal history ready` and `Frequent fare drops`, not ticket cards: `app/page.tsx:34-39`, `app/page.tsx:1182-1207`.

Assessment:

This does not violate repair-mode ticket language inside a board because no board exists here. It does show that assigning board-seed credibility work to this repo teaches the wrong workflow before any real ticket exists: the visible workflow is consumer travel search, not operator repair triage.

Smallest cleanup:

- Do not change homepage copy for this ticket.
- Correct the ticket/worktree mapping so board-seed QA runs against the repo or branch that actually contains the board.

## Manual Verification Flow

Required flow adapted to the current repo reality:

1. Remove or reset the local DB used by this worktree.
2. Run `npm run db:seed`.
3. Boot the app with `npm run dev`.
4. Open the first screen at `/`.
5. Confirm the first screen is the travel search homepage, not a board.
6. Attempt to open a seeded ticket.

Actual result:

- Steps 1 through 5 are valid.
- Step 6 is blocked because no seeded ticket UI exists in this worktree.

Comparison to repair-mode rules:

- No visible seeded `FEAT-*` ticket posture was found because there are no visible seeded tickets.
- The repo-level mismatch itself conflicts with the assignment guardrail that QA should stop when the referenced product surface is not present locally.

## Narrow Follow-Up Repairs

1. `AUDIT-CONTRACT-WORKTREE-CORRECTION-01`: Reassign this ticket to the branch or repo that actually contains the board seed source and board UI.
2. `AUDIT-BOARD-SEED-DATA-RECHECK-01`: Re-run this same audit only after the real board seed source and first-screen board surfaces are available.

These are the smallest credible follow-ups. No board redesign, seed taxonomy rewrite, or mutation-logic change is justified from this worktree.

## Acceptance Criteria Status

| Criterion | Status | Notes |
| --- | --- | --- |
| Audit report enumerates every seeded ticket currently shown on a fresh DB and labels each as credible, stale, or conflicting | Partial | Enumerated result is zero seeded tickets in this repo. No per-ticket labels are possible because no seeded board records exist. |
| Report cites the exact seed source and any UI surface where conflicting content is visible | Pass | Seed source and visible first-screen UI are traced above. |
| Report explains whether first-run board content violates repair-mode rules, including forbidden `FEAT-*` posture | Partial | No first-run board content exists. No forbidden `FEAT-*` seeded board content was found locally. |
| Report includes a manual verification flow covering reset DB, boot app, inspect first screen, open seeded ticket, compare visible content with repair-mode rules | Pass with blocker | Flow is documented; opening a seeded ticket is blocked because no seeded ticket surface exists. |
| Report recommends only narrow follow-up repairs | Pass | Recommendations are limited to worktree correction and recheck. |

## Required Return Note

- What changed and why: Added this audit report to document that the assigned seeded-board credibility audit is blocked in this worktree because the repo seeds no ticket data and contains no board UI.
- Files changed: `docs/audits/2026-07-01-audit-board-seed-data-repair-credibility-01.md`
- Verification commands and results: recorded separately in the task close-out after running `npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests`.
- Any out-of-scope findings or blockers: board-specific files named in the ticket are absent; `app/page.tsx` is the public travel search homepage; `package.json` shows Next `16.2.9`, not Next.js 15.
