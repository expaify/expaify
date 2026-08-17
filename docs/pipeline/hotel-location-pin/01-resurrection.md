# REPAIR-RESURRECT-HOTEL-LOCATION-PIN-01

**Stage:** REPAIR (resurrection of a stale fleet branch). No prior discovery/research/design stage
needed -- this branch's own diff was the spec, reviewed directly before dispatch.

## Backlog re-triage (real finding tonight, corrects a 5-day-old memory)

Re-checked the ~35 `origin/agent/*` branches left from the original June 30 - Aug 6 fleet run. Most
of the previously-recorded "28 real unmerged features" backlog turned out to already be merged into
`main` under different commit lineages (`REPAIR-RESURRECT-HOTEL-*` / "integrate verified agent work"
chains) -- confirmed by direct `git log` and content grep, not assumed.

Of the branches still showing a real diff-stat against current `main`, checked the top two
Krater-prioritized candidates first:
- `REPAIR-BOOKING-INVALID-STATE-01` -- **false positive**, fully superseded. Current
  `lib/booking/config.ts` already has `parseInteger`/`isAirportCode`/`isCurrencyCode`/
  `isValidDateInput` and a materially larger `InvalidBookingState`, used across dozens of
  validators the old branch never touched.
- `REPAIR-PROVIDER-ERROR-SURFACES-02` -- **false positive**, fully superseded. Current
  `lib/providers/travelpayouts.ts` already has `isRecord`/`majorUnitsToCents` and every
  "Travelpayouts returned a malformed response" error path the branch proposed, plus
  `ProviderIssueStatus`/`ProviderNotice` in `lib/types.ts`.

`RETRY-HOTEL-LOCATION-PIN-UI-01` was checked the same way (grepped for its distinctive symbol names
across the live codebase) and found genuinely absent -- real, unimplemented, valuable work. That's
what this ticket resurrects.

## What this ships

A hotel-card location/distance feature that didn't exist before:
- `app/components/hotelLocationContext.ts`: evidence-state classification
  (address_pin/provider_pin/area_only/search_area/unavailable), distance bucketing for analytics,
  and `buildPropertyMapUrl` -- a Google Maps link builder with real security validation (only
  returns a URL if `protocol === 'https:' && hostname === 'www.google.com'`, closing off any
  URL-scheme/host injection from provider data).
- `app/components/hotelLocationAnalytics.ts` (new file): impression/interaction tracking
  (deduplicated per hotel+state+anchor), plus session-scoped "was this location inspected"
  correlation gating two downstream events (review-opened-after-location,
  provider-handoff-after-location) -- all wrapped so analytics failures never block the UI.
- `app/components/HotelCard.tsx`: shows distance in the collapsed card, adds an accessible
  "View property pin" external link in the expanded view with proper `aria-label`/
  `rel="noopener noreferrer"`.
- `app/book/BookingFlow.tsx`: carries the same distance/pin evidence into `HotelDecisionSummary`
  and fires the location-then-handoff correlation event.

## Merge process

Dispatched to Codex (`codex exec --sandbox workspace-write`) with the branch's full intent described
directly (this session already read every touched file's diff before dispatch, to brief Codex
accurately rather than let it guess). Real conflicts resolved in 6 files by keeping both sides: the
branch's location-pin/analytics additions AND everything `main` had independently added to the same
files since (`HotelCard.tsx`'s funds-policy/transport/parking/admission sections, `BookingFlow.tsx`'s
invalid-state/stay-store/payment/sustainability sections -- none of that was touched or dropped).

Codex's sandbox has no network access and a read-only git-metadata restriction, so it couldn't run
`npm install`, stage the merge, or complete a real `npm run build` (Turbopack needs to bind a local
port for font fetching, blocked in that sandbox). All three were re-verified independently in this
worktree, with real network access:

1. `npx tsc --noEmit --incremental false` -- **exit 0**.
2. `npm test -- --passWithNoTests` -- **139 passed / 1 failed, 1465 passed / 1 failed** (140/1466
   total). The one failure is the same pre-existing, unrelated `HotelSustainabilityCredentialEvidence`
   baseline failure carried through every ticket tonight.
3. `npm run build` -- **succeeded**, full route manifest printed, no compile errors.

## Verification against main's other features

Diff reviewed directly: `HotelCard.tsx`'s funds-policy comparison, transport-caveat, parking, and
admission-policy sections are all present and untouched in the resolved file. `BookingFlow.tsx`'s
`InvalidBookingState`, stay-store recovery, payment-acceptance, and sustainability-credential
sections are all present and untouched. No existing test coverage was dropped -- the branch's tests
were merged alongside main's existing ones, not replacing them.

**Verdict: PASS.** Real, valuable, previously-unshipped feature; no regression in adjacent surfaces.
