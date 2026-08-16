# TEST-DARK-HOMEPAGE-PROTOTYPE-01 — direct review

**Status:** PASS

## Checked directly

1. **`app/page.tsx` (live homepage) is untouched**: `git diff --name-only` does not include it.
   Confirmed byte-identical to what's live in production today.
2. **`app/globals.css` diff is pure append**: 83 new lines at the end of the file, zero existing
   lines changed. The new `.theme-dark-preview` scope only takes effect on elements inside it —
   nothing on any other page is affected.
3. **New route is unindexed and unlinked**: `app/preview/dark-home/page.tsx` sets
   `robots: { index: false, follow: false }`; `app/sitemap.ts` was not touched (confirmed by
   diff); no existing page links to `/preview/dark-home` (grepped, zero matches outside the file
   itself).
4. **Contrast math independently re-verified, not just trusted**: recomputed WCAG relative
   luminance by hand for the tertiary text color (`#7E7E87` on `#171512` panel background) — got
   4.525:1, matches Codex's reported 4.53:1. Given that number checks out exactly, the rest of
   the reported contrast figures (19.77:1 white/canvas, 7.72:1 secondary/canvas, 6.63:1 dark CTA
   text on coral) are credible.
5. **`.btn-conversion` dark-mode override is a real, necessary fix, not a stray edit**: the base
   (light-mode) `.btn-conversion` rule in globals.css already reads `color: var(--ink)` with an
   existing comment — *"white on coral is 2.8:1; ink on coral is 6.6:1 (AA)"*. Since the dark
   scope redefines `--ink` to white, leaving `.btn-conversion` unoverridden would silently
   reintroduce that exact documented AA failure. The scoped override
   (`.theme-dark-preview .btn-conversion { color: #141210; }`) correctly re-pins it to dark ink.
   Verified by reading the base rule directly, not assumed.
6. **Dark-band and footer background swap is intentional, not a mistake**: those two sections use
   `bg-[color:var(--ink)]` in the live page specifically to render as a dark contrast band against
   an otherwise light page. In the dark-preview scope `--ink` is white, so leaving that class
   as-is would render a jarring white band on an otherwise black page — the opposite of the
   intended effect. The route-local swap to `bg-[color:var(--bg)]` with a hairline border
   preserves the original visual intent (a distinct section) under the new palette. This is a
   copied-route-local class change, not an edit to any shared component or the live page.
7. **Independent build verification** (Codex's own sandbox couldn't reach Google Fonts and said so
   honestly rather than faking a pass — re-ran with real network access):
   - `npm install` — clean.
   - `npx tsc --noEmit --incremental false` — exit 0.
   - `npm run build` — succeeded. `/preview/dark-home` builds as a new static route; every
     existing route's build classification (static vs. dynamic) is unchanged from before this
     ticket.
   - `npm test -- --passWithNoTests` — 1448 passed / 1 known-unrelated pre-existing failure,
     matches baseline exactly.
8. **Motion respects `prefers-reduced-motion`**: the reveal animation is wrapped in
   `@media (prefers-reduced-motion: no-preference)`, so it's inert by default for users who've
   opted out — correct direction (many implementations get this backwards).
9. **No `motion`/framer-motion dependency used**: this worktree branched before the shadcn/Magic
   UI infra ticket merged, so `motion` isn't in this branch's `package.json` yet. Confirmed Codex
   did not import it — the reveal effect uses pure CSS `animation-timeline: view()` instead. No
   missing-dependency risk when this merges.

## Verdict: PASS

This is a real, deployed, review-only prototype — visiting `/preview/dark-home` on production
after this ships will show the actual dark theme applied to the actual live homepage content
(same data, same copy, same links), with zero risk to the current live `/` route or any other
page. Ready for the user to look at before deciding whether to roll further.
