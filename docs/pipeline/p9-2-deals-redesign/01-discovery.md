# UXD Discovery: P9.2 — /deals grid + filter redesign

## Context
Helena's P9.1 homepage handoff (`docs/pipeline/p9-1-homepage-redesign/00-eng-handoff-source.md`) and the deal-detail-ia handoff both explicitly scope out `/deals` as "P9.2, separate" — named as planned work, never speced or built. No P9.2 handoff doc, branch, or commit exists anywhere in this repo (confirmed via full `git log --all` / `git branch -r` search). This doc originates that missing discovery pass, reusing the P9.1 visual system rather than inventing a new one, since Helena's own P9.1 doc frames the two as the same design language applied to different surfaces.

Read directly, not assumed: `app/deals/page.tsx` (189 lines) and `app/deals/DealFeed.tsx` (2071 lines) — the real, live, production `/deals` page.

## The problem
`/deals` is functionally mature and correct — real paywall gating (`getPaywallContext`, locked-card logic), real filter/sort state (`FilterPill` components for discount/price/stars, a sort dropdown), real pagination/coverage tracking, real personalization empty-states. But it never received the P9.1 visual pass: no scroll-reveal motion, no destination photography treatment, and — critically — it predates the design-token reconciliation P9.1 did in `app/globals.css` (`--primary`, `--primary-soft`, `--accent`, `--radius-card`, `--radius-pill`, etc.), so its visual craft sits a full generation behind the homepage it feeds into. A user clicking "See live deals" from the new homepage lands on a page that visually regresses.

## Who's affected, where
Every user who reaches `/deals` — the highest-traffic surface after the homepage, since it's both the primary free-browsing destination and the page every "Get free alerts" / "See live deals" link ultimately funnels toward. Both signed-out (blurred/locked preview) and signed-in (unlocked feed) states.

## Measurable signal
- Visual: side-by-side with the new homepage, `/deals` reads as a different, older product (confirmed via live screenshot this session).
- No `Reveal`/motion treatment exists on this page's cards (`grep -c "Reveal" app/deals/DealFeed.tsx` → 0), while the homepage now has staggered entrance motion throughout.
- Filter pills and sort control use `FilterPill`'s own bespoke classes rather than the token-driven `.btn`/`.reveal` primitives P9.1 established.

## Constraints (matching P9.1's own discipline)
1. **No data/logic changes.** Filter state, sort keys, paywall/unlock economy, personalization, coverage/pagination — all stay byte-for-byte. This is a visual-layer pass only, exactly like P9.1 was scoped against the homepage's conversion structure.
2. **Reuse P9.1's tokens**, don't invent a second palette. `--primary`/`--primary-soft`/`--accent`/`--ink`/`--radius-card`/`--radius-pill` already exist in `app/globals.css` — apply them here, extend only where a role genuinely doesn't exist yet.
3. **Feature-flagged**, same pattern as `NEXT_PUBLIC_P9_1_HOMEPAGE` / `NEXT_PUBLIC_DEAL_DETAIL_IA` — an env-gated flag (`NEXT_PUBLIC_P9_2_DEALS`), default OFF, one-deploy rollback.
4. **Real content only.** No fabricated deals, no invented copy for empty/locked states beyond what's already established in `LockedDealCard`/`PersonalizedEmpty`.

## Success statement
This is solved when a user following "See live deals" from the redesigned homepage lands on `/deals` and the two pages read as the same product — same card craft, same motion language, same token system — without any change in what deals they can see, filter by, or unlock.

## Handoff
Next: UXR — audit `DealFeed.tsx`'s current card/filter/sort markup in full detail against the P9.1 token system and the Booking/Airbnb-caliber reference bar P9.1 set, to produce specific, testable design directives.
