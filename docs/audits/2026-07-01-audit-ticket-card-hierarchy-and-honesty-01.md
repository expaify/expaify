# AUDIT-TICKET-CARD-HIERARCHY-AND-HONESTY-01: Ticket Card Hierarchy and Action Honesty

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Strict audit only. No product code changed.

## Executive Decision

Blocked. The ticket board and ticket card implementation required for this audit are not present in this worktree.

I cannot truthfully audit title, description, ID, role, priority, latest comment, LIVE state, truncation, card click targets, or move-next action honesty because the requested `components/TicketCard.tsx` surface does not exist here. The present `app/page.tsx` is the public expaify flight and hotel search page, not a board with ticket columns or card actions.

Per the ticket contract, this is a worktree mismatch and I am stopping at an audit report instead of inferring behavior from unrelated travel search UI.

## Surfaces Requested

Requested first-pass files and current status:

| Requested file | Status in this worktree | Audit impact |
| --- | --- | --- |
| `app/page.tsx` | Present, but implements public search/results UI | No board columns, ticket cards, move actions, `latest_comment`, or `is_running` state. |
| `components/TicketCard.tsx` | Missing | Cannot inspect card hierarchy, truncation, click targets, or move-next affordance. |
| `app/globals.css` | Present | Global tokens and focus styles exist, but there are no ticket-card-specific selectors or board layout rules to audit. |

Search evidence:

- `rg --files | rg 'TicketCard\\.tsx$|ticket|board|column|kanban'` found no ticket card or board implementation files.
- `rg -n "latest_comment|is_running|LIVE|move next|advance status|backlog"` found no matching board/card implementation in `app` or `components`.
- `app/page.tsx` imports `AirportInput`, `HotelCard`, and `FlightResults`, which confirms the current entry point is the travel search surface (`app/page.tsx:7` to `app/page.tsx:10`).

## Requested Audit Areas

The ticket asks for findings on these card elements:

- title
- description
- ID
- role
- priority
- latest comment
- move action
- LIVE treatment
- click target split between opening a card and advancing status

Result: blocked for all of them.

No auditable source was found for:

- `TicketCard`
- board columns such as backlog/in progress/done
- `latest_comment`
- `is_running`
- a move-next button or status-advance action
- a card-open detail action tied to the same card surface

Because those elements do not exist in this repo state, I cannot produce honest findings such as "title should lead, comment should recede" with file-backed evidence. Doing so would invent a UI that is not present.

## What The Existing Files Actually Are

### `app/page.tsx`

This file is the travel search homepage and results flow, not a ticket board:

- Search criteria and URL parsing dominate the module (`app/page.tsx:12` to `app/page.tsx:251`).
- It imports flight and hotel result components, not ticket components (`app/page.tsx:7` to `app/page.tsx:10`).
- Prior audit evidence in this repo already traced `app/page.tsx` as search/results UI, not board UI.

### `app/globals.css`

This file defines global theme tokens, card chrome, form inputs, and button styles:

- `body` sets `min-width: 320px` and `overflow-x: clip` (`app/globals.css:112` to `app/globals.css:123`).
- Global `:focus-visible` styles exist (`app/globals.css:137` to `app/globals.css:143`).
- Generic `.card`, `.field-input`, `.btn-primary`, and `.btn-pill` styles are present (`app/globals.css:159` to `app/globals.css:249`).

These styles are not enough to audit ticket-card hierarchy or action honesty without the actual ticket-card markup.

## Acceptance Criteria Status

| Acceptance criterion | Status | Notes |
| --- | --- | --- |
| Audit identifies exact card elements that should lead/support/recede | Blocked | No card implementation exists to inspect. |
| Audit calls out accidental-action risk between card click and move-next button | Blocked | No card click target or move-next button exists in source. |
| Audit includes examples of weak truncation or unreadable density with file references | Blocked | No ticket-card text rendering exists to inspect. |
| Audit covers populated columns, empty columns nearby, and cards with/without `latest_comment` and `is_running` | Blocked | No column or ticket board implementation exists. |
| Manual verification flow is documented | Partial | The requested flow is documented below, but execution is blocked at step 1 because the board is absent. |
| Run `npx tsc --noEmit` and record result | Pass | `npx tsc --noEmit --incremental false` exited 0 with no output. |
| Run `npx jest --runInBand` and record result | Pass | 20 suites passed, 172 tests passed. |

## Manual Verification Flow

Required flow from the ticket:

1. Inspect a backlog column with mixed priorities.
2. Open a card.
3. Return to the board.
4. Verify card actions remain understandable on desktop.
5. Repeat at 375px width.

Actual result in this worktree:

1. Load board: blocked, no board route or board component found.
2. Inspect backlog column: blocked, no column implementation found.
3. Open a card: blocked, no ticket card/detail surface found.
4. Return to board: blocked, no board exists.
5. Re-check action clarity at desktop and 375px: blocked, no ticket-card UI exists to render.

## Findings

### P1 - Assigned ticket-card surface is missing from the worktree

Evidence: `components/TicketCard.tsx` is absent, and workspace search found no replacement board/card component under `app/` or `components/`.

Impact: The central acceptance criteria cannot be satisfied honestly because the card hierarchy, truncation, click-target split, and LIVE treatment have no implementation to audit.

### P1 - Requested state fields have no source in the current repo

Evidence: `latest_comment` and `is_running` do not appear in the application source, and no move-next/status-advance action exists in the current app code.

Impact: I cannot assess whether LIVE is visually noisy, whether latest comment density overwhelms title/priority, or whether action honesty is compromised by competing click targets.

### P1 - The present `app/page.tsx` is unrelated to the assigned board workflow

Evidence: `app/page.tsx` imports travel search UI pieces and contains search/date/result state, not ticket board state (`app/page.tsx:7` to `app/page.tsx:10`, `app/page.tsx:12` to `app/page.tsx:32`).

Impact: Auditing this page as a substitute would violate scope and produce misleading conclusions about a board/card experience that is not implemented here.

## Out-of-Scope Notes

- I did not audit flight cards or hotel cards as substitutes for ticket cards.
- I did not propose new badges, metadata, theming, or board redesign.
- I did not add browser tooling or fake fixtures for a board that is not present.
- The repo metadata conflicts with the ticket stack note: `package.json` shows `next: 16.2.9`, not Next.js 15.

## Verification Commands

- `npx tsc --noEmit --incremental false` - passed. Exit code 0, no output.
- `npx jest --runInBand` - passed. 20 test suites passed, 172 tests passed.
- `npm test -- --passWithNoTests` - passed. 20 test suites passed, 172 tests passed.

## Required Return Note

- What changed and why: Added this audit report documenting that AUDIT-TICKET-CARD-HIERARCHY-AND-HONESTY-01 is blocked because the ticket board and `TicketCard` implementation are absent from this worktree.
- Files changed: `docs/audits/2026-07-01-audit-ticket-card-hierarchy-and-honesty-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed with exit code 0 and no output; `npx jest --runInBand` passed with 20 suites and 172 tests; `npm test -- --passWithNoTests` passed with 20 suites and 172 tests.
- Out-of-scope findings or blockers: requested board/ticket files are missing; `app/page.tsx` is the travel search UI, not a board.
