# STAGE 6: TESTING & QA — direct review
**Status:** PASS

## Checked directly

1. **IntersectionObserver correctness**: the `useEffect` in `PremiumHubBar.tsx` depends on `[firstLockedDealRef, lockedDealsCount]` — resets `revealed` to `false` and re-establishes the observer whenever the locked-deal count changes (e.g. after a filter change), disconnects on unmount/re-run, and falls back to `setRevealed(true)` immediately if `IntersectionObserver` is undefined (SSR/old-browser safety). No leak, no stale-closure risk.
2. **Nested-interactive-element accessibility**: `LockedDealCard`'s only interactive element is the outer `<a>` itself — every other node inside (icons, blurred placeholder text, the accessibility-fit paragraph) is either `aria-hidden` or has no interactive role. No nested link/button violation.
3. **Homepage hero mockup (`app/page.tsx`)**: the new required `discountPct` prop is satisfied via `lockedTeaserPool[n]?.discountPct ?? MOCK_HERO.discountPct` / `MOCK_TEASER.discountPct` — both are real, pre-existing mock constants already used elsewhere on the same page for `heroCard`/`teaserCard` fallbacks, not fabricated by this change.
4. **Other unverified numeric claims**: scanned both new/changed component files for `%` literals — only the real dynamic `discountPct` interpolation and a CSS `rootMargin` implementation value remain. The one fabricated claim found during implementation review (a "save up to 75%" line, contradicted by live production data showing a real max of 33%) was already caught and fixed before this QA pass.

tsc clean, 1430 passed / 1 known-unrelated failure (`HotelSustainabilityCredentialEvidence.test.tsx`), already independently verified in the parent ticket.

## Verdict: PASS
