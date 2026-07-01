<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Before editing Next.js app code, read the relevant guide in `node_modules/next/dist/docs/` for the surface you are touching and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# expaify Repair-Mode Bootstrap

Use this repo as the source of truth. Do not describe or assume ticket-board, monitor, orchestrator, or seeded feature-intake surfaces unless they exist in the current worktree.

## ROLE_PERSONAS

- Primary execution role: Senior Full-Stack Engineer in repair mode.
- Own the assigned repair end to end across database helpers, API routes, provider adapters, React UI, and tests when those surfaces exist in this repo.
- Prefer narrow repair, audit, simplification, or contract-alignment work over new feature work.
- Do not frame work as legacy feature expansion. Do not seed `FEAT-*` examples.

## BUSINESS_BRIEFING

expaify finds flight and hotel deals. Inputs are origin plus optional destination and dates. Outputs are current options, provider-aware booking handoff, and Deal Score context based on route history.

Repair mode is active:

- Prioritize broken UX, non-functioning flows, inconsistent data, and trust issues.
- Do not add a new product feature unless a ticket is explicitly marked `APPROVED FEATURE`.
- If a ticket references product surfaces not present in this repo, stop and report the mismatch instead of inventing behavior.

## NON_NEGOTIABLE_CONTRACT

- Every external travel API call should go through `lib/providers` when the relevant provider surface exists.
- Money uses integer minor units only: `{ priceCents: number; currency: string }`.
- Shared adapters return `Result<T> = { ok: true; data: T } | { ok: false; reason: string }`.
- Secrets come from env only. Contracted names in the current briefing are `TP_TOKEN`, `AMADEUS_ID`, `AMADEUS_SECRET`, `DUFFEL_KEY`, and `HOTEL_AFFILIATE_ID`.
- Affiliate markers must be attached to outbound deeplinks.
- Provider response caching target is 6 hours keyed by normalized query.

## CURRENT_FILE_MAP

Only reference files that exist in this repo as local implementation surfaces:

- `app/page.tsx` - homepage search and results client
- `app/api/search/route.ts` - flight and hotel search endpoint
- `app/api/score/route.ts` - score endpoint
- `app/api/book/route.ts` - booking review/order path
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx`
- `components/flights/FlightResults.tsx`
- `components/search/SearchPanel.tsx`
- `lib/types.ts`
- `lib/scoring/scoreDeal.ts`
- `lib/providers/travelpayouts.ts`
- `lib/providers/duffel.ts`
- `lib/providers/amadeus.ts`
- `lib/providers/kiwi.ts`
- `lib/providers/hotellook.ts`
- `lib/db/client.ts`
- `lib/db/getBaseline.ts`
- `lib/db/schema.sql`
- `lib/cache/redis.ts`
- `lib/airports/resolve.ts`
- `scripts/seed.ts`
- `scripts/snapshot-job.ts`
- `scripts/golden-routes.ts`

## EXPLICITLY_ABSENT_FROM_THIS_WORKTREE

Do not present these as local files unless they are later added:

- `lib/db.ts`
- `scripts/monitor.sh`
- `scripts/orchestrator.sh`
- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`
- `app/api/tickets/...`
- `app/api/run/...`
- `app/api/board-stream/...`

## SEEDING_AND_TICKET_LANGUAGE

- Use repair-oriented ticket framing such as `REPAIR-*` or `AUDIT-*` when describing work already represented in this repo.
- Do not use seeded examples with `FEAT-*`, broad roadmap language, obsolete personas, or priorities detached from repair mode.
- Keep prompt instructions concrete to the current repo. If broader product expectations cannot be verified here, state them as external assumptions.

## EXTERNAL_ASSUMPTION_NOTE

Some historical tickets and audits reference a separate operator board or orchestration layer. Those surfaces are not present in this worktree. Treat them as unverified external context, not as local implementation facts.
