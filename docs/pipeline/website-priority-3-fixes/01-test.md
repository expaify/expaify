# TEST-WEBSITE-PRIORITY-3-FIXES-01 — QA

**Stage:** TEST (QA). Docs-only — no code changed by this stage.
**Source:** a follow-up punch list from the requester, each item independently validated against
real live site/code before any implementation (see the validation pass earlier in this session —
one item, #4/climate-EV labels, turned out already fixed; one item, #6/`/join`'s duplicate meta
description, turned out to be SearchAtlas's OTTO tool overriding the page client/edge-side,
confirmed via `<meta name="otto" content="uuid=a3495a8f...">` matching the real SearchAtlas
project ID — not something app code can fix).

## What shipped (6 items)

1. **OG image**: a real, brand-generic 1200×628 PNG (downloaded from the requester's own hosted
   asset, verified it matches the described brief — cream background, "Never overpay for a hotel
   again." headline, coral expaify mark, `expaify.com` — before using it), placed at
   `public/og.png`, `app/layout.tsx`'s `openGraph.images`/`twitter.images` now point at it instead
   of the SVG. `og.svg` left in place, just unreferenced.
2. **Destination pages' discount filter**: `app/destinations/[city]/page.tsx`'s non-premium
   `effectiveView.minDiscount` was `20`, inconsistent with `/deals`'s already-fixed 30% default —
   now `30`.
3. **Locked-card photos**: real photo (blurred + lock icon overlay) when a photo URL exists,
   branded coral-"e"-mark placeholder when it doesn't — never the bare "Photo unavailable" string.
   Implemented as a new opt-in `brandedFallback` prop on `PropertyPhoto` so its default behavior
   (used elsewhere, with its own direct test coverage) stays byte-identical. One correction made
   before dispatch: Krater's draft used a light color for the "e" mark's text; the real hosted
   brand asset shows a dark "e" on the coral square, corrected before sending to Codex.
4. **Flights tab**: removed entirely (not just de-emphasized) per "prefer hide until flights are
   real." Codex confirmed no URL/deep-link/history path can still select `activeTab === 'flights'`
   — the removed button was the only way to reach it.
5. **Coverage disclaimer removed**: "expaify can't confirm whether this is the full ... set" cut
   from both the visible `ResultCoverageBoundary` copy and the matching screen-reader announcement
   in `DealFeed.tsx` (a second occurrence of the same string Codex found on its own, not in the
   original spec).
6. **Free-plan FAQ**: now mentions both the 3 weekly unlocks and the real daily digest for 1
   watchlist city, matching tonight's shipped free-alert-loop feature exactly — no overstatement.

## Verification (real, fresh install, this worktree)

1. `npx tsc --noEmit --incremental false` — **exit 0**.
2. `npm test -- --passWithNoTests` — **140 passed / 1 failed, 1473 passed / 1 failed** (141/1474
   total). The one failure is the same pre-existing, unrelated
   `HotelSustainabilityCredentialEvidence` baseline failure carried through every ticket tonight.
3. `npm run build` — **succeeded**, full route manifest printed, `public/og.png` confirmed bundled.

## Diff review

All 10 changed files reviewed directly against the dispatch spec — each matches exactly, including
two things Codex found and correctly handled beyond the original spec: the second copy of the
coverage disclaimer (the screen-reader announcement string in `DealFeed.tsx`), and confirming the
Flights tab has no residual reachability path. Test updates (`PropertyPhoto.test.tsx`,
`scorePresentation.test.tsx`, `ResultCoverageBoundary.test.tsx`) correctly reflect the intentional
behavior changes — old assertions describing now-superseded behavior were updated, not deleted or
weakened; `PropertyPhoto`'s default "Photo unavailable" test coverage (used by other, unrelated
callers) is untouched and still passing.

## PASS criteria

1. tsc exits 0 — **PASS**
2. tests exit 0 modulo the known pre-existing failure — **PASS**
3. Every confirmed item implemented — **PASS**
4. No regression in adjacent surfaces (`PropertyPhoto`'s default behavior for non-locked contexts,
   the existing "Premium Only" pill overlay, `og.svg` itself) — **PASS**, confirmed untouched via
   diff
5. No fabricated claims — the OG asset was verified against the real brief before use, the FAQ copy
   matches the real shipped digest mechanics exactly (1 city, daily, not overstated) — **PASS**

**Verdict: PASS.** No rollback ticket needed.

## Not shipped, and why

- **#6 (`/join` duplicate "19 destinations" meta)** — not a code bug. Confirmed live via
  `<meta name="otto" content="uuid=a3495a8f-58cc-4d49-9bb8-d9564c85ff12...">`, matching the
  requester's real SearchAtlas project ID exactly. SearchAtlas's OTTO product is rewriting this
  page's meta description independent of the app's own (already-correct) source. Requires a fix in
  the OTTO dashboard, or disabling its meta-rewrite for `/join` — flagged back to the requester,
  not implementable from this codebase.
