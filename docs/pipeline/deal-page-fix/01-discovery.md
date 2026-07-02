---
id: UXD-DEAL-PAGE-FIX-001
stage: UXD
---

# Discovery: Deal Detail Page Returns 404

## Problem Statement
Navigating to `/deals/[id]` returns 404. No deal cards in the feed are clickable.

## Root Causes

### Bug 1 — No real deals in DB yet
Deal detection requires MIN_SNAPSHOTS=8 per hotel. Pipeline has run twice in one day — both runs upsert the same `snapshot_date`, so effective count = 1. Need 8 calendar days of runs for first real deals. Fix: temporarily lower MIN_SNAPSHOTS to 2 for MVP so deals surface from existing snapshot data.

### Bug 2 — Mock deal cards have no href
`DealCard` receives `href={deal.isMock ? undefined : /deals/${deal.id}}` — mock deals are not clickable by design. Once real deals exist (after threshold fix), real cards will be clickable.

## Success Statement
After lowering MIN_SNAPSHOTS=2, the pipeline produces real deal rows. `/deals/[id]` loads a real deal detail page.
