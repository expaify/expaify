# AUDIT-OPS-ACTIVITY-FEED-RECENCY-LINEAGE-01

## Scope check

This ticket asks for an audit of an operator activity feed across these surfaces:

- `app/api/board-stream/route.ts`
- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`
- `lib/db.ts`

Those files are not present in this worktree.

The repo-level instructions in `AGENTS.md` also explicitly mark these surfaces as absent:

- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`
- `app/api/board-stream/...`
- `lib/db.ts`

## What is verifiable in this repo

The local app is a travel search and booking app, not an operator board implementation. Relevant confirmed surfaces include:

- `app/page.tsx`
- `app/api/search/route.ts`
- `app/api/score/route.ts`
- `app/book/BookingFlow.tsx`
- `lib/db/client.ts`

Searches across `app/`, `components/`, and `lib/` found no local implementation of:

- activity feed rendering
- board stream API
- ticket cards
- ticket slideovers
- `latest_comment`
- `is_running`

## Audit result

This ticket cannot be completed as written from the current worktree without inventing behavior that is not locally implemented.

Because the requested surfaces are absent, the following acceptance items are blocked:

- documenting how the activity feed orders items
- identifying user-visible recency/source-lineage cues in the feed
- reproducing stale/fresh/contradictory feed states
- comparing the same ticket across board card, feed, and slideover
- performing the requested manual verification flow for starting a run and observing board updates
- reviewing 375px mobile behavior for the absent feed/card/slideover surfaces

## User-visible risk statement

The main finding is a lineage problem in the ticket itself:

- the requested audit targets an operator-board surface
- the local repository contains a customer-facing travel search product instead
- reporting feed behavior from this repo would be fabricated

That makes any claimed feed-recency or ticket-lineage conclusion untrustworthy unless the missing board worktree or branch is supplied.

## Manual repro status

No manual repro was possible in this worktree because there is no local board, feed stream, ticket card, or slideover implementation to run.

## Verification run

- `npx tsc --noEmit --incremental false` -> passed with exit code 0
- `npm test -- --passWithNoTests` -> passed
  - Test Suites: 20 passed, 20 total
  - Tests: 176 passed, 176 total

## Recommended next step

Provide the worktree or branch that actually contains the operator board surfaces named in the ticket. Once those files exist locally, the recency/lineage audit can be executed against real behavior instead of assumptions.
