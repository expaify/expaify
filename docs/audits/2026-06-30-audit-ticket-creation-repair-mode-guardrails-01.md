# AUDIT-TICKET-CREATION-REPAIR-MODE-GUARDRAILS-01

Date: 2026-06-30  
Role: Senior QA Engineer  
Scope: Audit only. No product behavior changed.

## Executive Decision

Blocked: the requested new-ticket creation surface is not present in this worktree.

I cannot verify whether new ticket creation enforces repair-mode guardrails because the specified UI, API route, and database helper do not exist at the requested paths. The current repo is the expaify customer flight/hotel app, not a ticket-board app. There is no discoverable create-ticket modal, `/api/tickets` route, ticket board page, or `lib/db.ts` module to exercise.

## Requested Files

| Requested file | Actual result |
| --- | --- |
| `app/page.tsx` | Exists, but it is the public search/results client page. Its imports cover airport input, hotel card, flight results, and search sorting; no ticket modal or ticket board import is present (`app/page.tsx:1`). |
| `components/NewTicketModal.tsx` | Missing. `rg --files` found no `NewTicketModal.tsx` and no root `components` ticket modal. |
| `app/api/tickets/route.ts` | Missing. `rg --files` found no `app/api/tickets` directory or tickets API route. |
| `lib/db.ts` | Missing. The repo has `lib/db/client.ts`, a generic Postgres query singleton requiring `DATABASE_URL`, but no ticket-specific storage helper (`lib/db/client.ts:1`). |

## Guardrail Audit Results

Because no create-ticket UI or API exists, there is no actual client/server validation path to test for the assigned inputs.

| Input class | Required behavior | Actual observed behavior |
| --- | --- | --- |
| Deprecated prefixes: `FEAT-`, `UX-`, `BUG-`, `PERF-`, `QA-`, other non-approved prefixes | Reject or warn before board entry | Not testable. There is no ticket ID field, creation modal, or `/api/tickets` POST endpoint in this worktree. |
| Priority outside `P0` and `P1`, including `P2` | Reject for premium repair tickets | Not testable. No priority control or API payload schema was found. |
| Missing required spec sections | Reject before creation | Not testable. No description/spec form or API validation exists in this worktree. |
| Vague titles like `improve app` | Reject or warn | Not testable. No title field or server validation exists. |
| Feature request without `APPROVED FEATURE` | Reject or warn | Not testable. No feature-intake classification path exists. |
| Invalid status | Reject or constrain to allowed workflow | Not testable. No status control or tickets API exists. |
| Empty/invalid description | Reject | Not testable. No ticket description input or server route exists. |

## Sample Ticket Inputs

These samples are valid repair-program shapes, but they cannot be submitted in this worktree because the creation surface is absent.

| Sample | Expected result in a ticket board | Actual result here |
| --- | --- | --- |
| `AUDIT-PROVIDER-FAILURE-TRUST-02` / `P0` / title: `Audit provider failure states for paid-user trust` / description includes Context, Goal, In scope, Out of scope, Acceptance criteria | Accepted if all required spec sections are present | Not accepted or rejected; no UI/API path exists. |
| `DESIGN-REPAIR-BOOKING-TRUST-03` / `P1` / title: `Repair booking review hierarchy and paused-state copy` / description includes required sections and narrow repair scope | Accepted if marked as repair/design work, not broad feature work | Not accepted or rejected; no UI/API path exists. |
| `REPAIR-AFFILIATE-LINK-GUARD-01` / `P0` / title: `Block outbound handoff without affiliate marker` / description includes required sections and explicit non-feature repair scope | Accepted if all required spec sections are present | Not accepted or rejected; no UI/API path exists. |

## Manual Verification Flow

Requested flow and actual behavior:

1. Open board: blocked. No board route or ticket creation page was found. `app/page.tsx` opens the customer search app, not a ticket board.
2. Create a ticket with deprecated prefix `FEAT-IMPROVE-APP-01`: blocked. No create-ticket action exists.
3. Create a `P2` ticket: blocked. No priority selector or ticket API exists.
4. Create a vague title `improve app`: blocked. No title input exists.
5. Record client behavior: no client ticket behavior is present.
6. Record API behavior: no `POST /api/tickets` endpoint is present.

Client and server behavior match only in the limited sense that neither side exists in this worktree. That is not evidence of compliant guardrails.

## Findings

### P0 - Assigned ticket cannot be verified because the ticket creation surface is absent

Evidence:

- `components/NewTicketModal.tsx` is absent.
- `app/api/tickets/route.ts` is absent.
- `lib/db.ts` is absent.
- Broad repo search for `NewTicket`, `create ticket`, `APPROVED FEATURE`, `repair-mode`, and ticket prefixes found only audit documents and unrelated customer-app code.

Impact:

The acceptance criteria require exact UI and API behavior for invalid ticket ID, title, priority, status, and description inputs. With no ticket creation UI or API in this worktree, there is no way to prove that premium repair-mode standards are enforced before work enters the board.

### P0 - Current worktree mismatch creates false confidence risk

Evidence:

- `app/page.tsx` is a flight/hotel search surface with route/date/passenger search state and provider-result rendering, not a ticket board (`app/page.tsx:12`).
- The only database helper present is `lib/db/client.ts`, which exposes generic Postgres `query` and contains no ticket validation or ticket schema behavior (`lib/db/client.ts:16`).

Impact:

Running this audit against the wrong app could produce a false pass. The correct result is blocked until the ticket-board worktree or missing files are provided.

## Out of Scope Left Alone

- I did not implement ticket validation.
- I did not add a ticket modal, API route, schema, or storage layer.
- I did not touch search, provider, booking, scoring, or customer-app behavior.

## Verification Commands

- `rg --files | rg '(^|/)(NewTicketModal|tickets/route|db\.ts|db/)'` - found `lib/db/client.ts` and `lib/db/getBaseline.ts`; did not find `components/NewTicketModal.tsx`, `app/api/tickets/route.ts`, or `lib/db.ts`.
- `find . -maxdepth 4 -iname '*ticket*' -o -iname '*modal*' -o -iname '*board*'` - found no ticket creation surface; only an unrelated audit filename matched.
- `rg -n "create.*ticket|ticket.*create|NewTicket|repair-mode|APPROVED FEATURE|AUDIT|DESIGN|REPAIR|FEAT|P0|P1|P2" . -S` - found audit documentation and unrelated text; no implementation surface.
- `npx tsc --noEmit --incremental false` - passed.
- `npx jest --runInBand` - passed. 20 suites passed, 168 tests passed.
- `npm test -- --passWithNoTests` - passed. 20 suites passed, 168 tests passed.

## Required Return Note

- What changed and why: Added this audit report documenting that the assigned ticket creation guardrail audit is blocked because the requested UI/API/database files are absent from this worktree.
- Files changed: `docs/audits/2026-06-30-audit-ticket-creation-repair-mode-guardrails-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npx jest --runInBand` passed with 20 suites and 168 tests; `npm test -- --passWithNoTests` passed with 20 suites and 168 tests.
- Out-of-scope findings or blockers: Blocker: no ticket-board creation surface exists in this repo, so invalid input acceptance/rejection cannot be manually verified.
