# expaify

Repair-mode worktree for the expaify travel deals app.

## Current Repo Scope

This repo contains the public search, results, scoring, alerts, and booking-review surfaces for flight and hotel deals. It is not a ticket-board or agent-orchestration app.

Primary local surfaces:

- `app/page.tsx` - search and results client
- `app/api/search/route.ts` - provider-backed search stream
- `app/api/score/route.ts` - Deal Score endpoint
- `app/api/book/route.ts` and `app/book/` - booking review and Duffel order path
- `lib/providers/` - travel provider adapters
- `lib/scoring/scoreDeal.ts` - score calculation
- `lib/db/` - Postgres client, schema, and baseline access
- `lib/cache/redis.ts` - Redis cache singleton
- `scripts/snapshot-job.ts` and `scripts/golden-routes.ts` - nightly snapshot inputs

Not present in this worktree:

- `lib/db.ts`
- `scripts/monitor.sh`
- `scripts/orchestrator.sh`
- ticket-board routes or ticket-run UI surfaces

## Working Contract

- Money is integer minor units only: `{ priceCents, currency }`.
- Shared adapter failures use `Result<T>`.
- External provider calls belong in `lib/providers`.
- Affiliate markers must be attached to outbound deeplinks.
- Repair mode is the default. New feature work is out of scope unless explicitly approved.

## Commands

```bash
npm run dev
npx tsc --noEmit --incremental false
npx jest --passWithNoTests
```

## Production analytics

Set `NEXT_PUBLIC_ANALYTICS_ENDPOINT` to the approved event-collection endpoint to deliver client analytics in production. When it is absent, production analytics are intentionally disabled; booking handoffs are never blocked by delivery failures.

## Note On Historical Material

Some audit documents in `docs/audits/` reference missing board/run/ticket surfaces because they were written against broader operator expectations. Treat those references as external assumptions, not as proof that those files exist locally.
