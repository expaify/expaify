# REPAIR-WEBSITE-PRIORITY-2-FIXES-01 — QA

**Stage:** REPAIR (real, independently-verified fixes from a marketing-agency audit). Krater
produced the implementation spec (`openai/gpt-5.2-codex`, cost $0.074223765, `finish_reason: stop`)
after this session independently re-verified every claim against real current source first; Codex
implemented it.

## What shipped (4 items)

- **A — Sitewide OG/Twitter meta** (`app/layout.tsx`): replaced the stale "expaify Deal Desk" title
  and flight-focused "route baselines" description (used nowhere else on the site, wrong for a
  hotel-only product) with the same hotel/30%/60-day-median language already correct in
  `metadata.description`. `images` deliberately untouched — no real generic OG asset exists yet,
  not fabricated.
- **B — Deals filter default** (`app/deals/DealFeed.tsx`): `DEFAULT_MIN_DISCOUNT` 20 → 30, matching
  the site's actual "30%+ below 60-day median" promise. Checked for a protective test first (this
  codebase has real precedent — empty photo alt text and the absent Flights nav link were both
  previously found to be deliberate, tested decisions, not bugs) — none found, safe to change.
- **C — Deal-card aria-label noise** (`app/components/ui/DealCard.tsx`): previously concatenated
  all 7 possible evidence cues regardless of which one (if any) was the single `winningCue` shown
  visually — screen-reader users got strings like "EV charging: Unknown" even when nothing about EV
  was shown. Now mirrors the visible card exactly: hotel name, star class, and only
  `winningCue?.accessible`. Four tests that asserted the old noisy string as expected behavior were
  updated to the new, correct one — verified this was updating stale expectations to match an
  intentional fix, not silently hiding a regression (the removed text was literally the bug being
  fixed).
- **D — Flights tab de-emphasis** (`app/deals/DealFeed.tsx`): the inactive "Flights" tab in the
  Hotels|Flights toggle had byte-identical styling to "Hotels" despite a comment claiming otherwise
  and despite a separate, already-tested nav decision that flights are "contextual to hotel deals,
  not a peer nav destination." Checked for a protective test — none found. Added `opacity-60` to
  only the inactive-Flights className; active state and the Hotels button untouched, functionality
  preserved.

## Explicitly not touched (real, considered, deliberately excluded)

- Whether Premium-gated locked deal cards should get a real `photoUrl` instead of the confirmed
  `null` — a real product/paywall decision (same tier of decision as withholding the hotel name),
  not a code fix. Flagging for the requester rather than deciding unilaterally.
- `PropertyPhoto.tsx`'s "Photo unavailable" fallback — read directly and confirmed deliberate,
  honest behavior for a null/failed src, with direct test coverage. Not touched.
- Adding a Flights link to the main site nav — already correctly absent per an existing
  `LandingNav.test.tsx` assertion from a prior session.

## Verification (real, in this worktree, fresh install)

1. `npx tsc --noEmit --incremental false` — **exit 0**.
2. `npm test -- --passWithNoTests` — **139 passed / 1 failed, 1465 passed / 1 failed** (140/1466
   total). The one failure is the same pre-existing, unrelated `HotelSustainabilityCredentialEvidence`
   baseline failure carried through every ticket tonight.
3. `npm run build` — **succeeded**, full route manifest printed, no compile errors.

**Verdict: PASS.**
