# TEST-DARK-HOMEPAGE-02 — direct review

**Status:** PASS

## Checked directly

1. **Full `app/globals.css` diff read end-to-end**: every new rule traces to a specific directive
   (D1-D7) or the bonus focus-ring accessibility fix, matching `03-design.md` almost verbatim —
   same values, same selectors, same comments explaining the "why." No stray/unexplained rule.
2. **Full `app/preview/dark-home/page.tsx` diff read end-to-end**: every changed line is a
   className swap or a new wrapper/glow `<div aria-hidden>` — zero visible string content
   changed. Matches the design spec's §3 markup-mapping table row for row (hero h1, 6 section
   h2s, numeral span, 2 pricing labels, 2 stats, the badge, 3 footer headers, plus the dark-band
   and pricing section structural rebuilds from §5/§7/§8).
3. **Shared components confirmed untouched**: `git diff --name-only` shows only
   `app/globals.css` and `app/preview/dark-home/page.tsx` — no `DealCard.tsx`, `LockedDealCard.tsx`,
   `LandingNav.tsx`, `FaqAccordion.tsx`, or `app/page.tsx` in the diff. The selector-based styling
   mechanism (`main article`, `a[aria-label^="Locked premium deal"]`, `.group:hover`) is real:
   confirmed `DealCard.tsx:141` does render `shadow-[var(--shadow-card-hover)]` on the article and
   wraps in `<div className="group relative">` when `href` is passed (`DealCard.tsx:271`); confirmed
   `LockedDealCard.tsx:40`'s `aria-label` template literal evaluates to a string starting with
   "Locked premium deal." at runtime, which is what the `^=` attribute selector requires — verified
   this is real, not assumed, since the literal double-quoted string doesn't appear in the JSX
   source (it's a template literal), which could otherwise look like a broken selector reference.
4. **Independent build verification**:
   - `npx tsc --noEmit --incremental false` — exit 0.
   - `npm run build` — succeeded, `/preview/dark-home` still builds as a static route, every other
     route's classification unchanged. The new CSS (`color-mix()`, `backdrop-filter`, multi-stop
     `mask-image`, nested nested `@media` blocks) compiles without error under Tailwind v4.
   - `npm test -- --passWithNoTests` — 1448 passed / 1 known-unrelated pre-existing failure,
     matches baseline exactly.
5. **Directive coverage cross-checked against the diff, not just the agent's self-report**: D1
   (5 new type classes + 14-row mapping applied), D2 (translucent `--surface`, new
   `--shadow-card-rest`, brightened hover shadow, tier-1/tier-2 selectors present), D3 (glass on
   hero card stack + both pricing cards), D4 (glow repositioned to 66%/22%, coral term removed,
   mask floor raised to 35%, two new section-local glow divs), D5 (`--radius-card: 16px`,
   `--dp-radius-cta: 12px` on `.btn-conversion`), D6 (outline-button hover glow bumped to 0.35 +
   teal bg tint, badge recolored to coral with its own glow), D7 (dark band rebuilt as
   `.dp-hero-panel` with the strongest glow value in the file, 0.24) — all present and match the
   spec's exact values, confirmed by reading the diff directly above, not by trusting the
   implementation report alone.
6. **Bonus accessibility fix verified**: `.theme-dark-preview :focus-visible { outline-color:
   var(--primary-soft); }` is present, addressing the real contrast gap the design spec computed
   (`--primary` on `--bg` ≈2.46:1, fails WCAG 2.4.11's 3:1 non-text minimum).

## What this review does NOT and cannot verify

This is a source-code/build/contrast review, not a visual one — no browser was used to actually
look at the rendered page. The values, math, and mechanism are all verified real and internally
consistent, and the build/tsc/test gates all pass, but whether the result *looks* premium is a
subjective, visual judgment only the user reviewing the live preview URL can make. That is exactly
why this is shipping to the isolated `/preview/dark-home` route rather than the live homepage.

## Verdict: PASS (mechanically) — pending the user's visual judgment on the live preview
