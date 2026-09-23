# UX Discovery: City destination pages show a blank empty state during a real quiet market

Ticket: DESTINATION-EMPTY-STATE-01

## The problem

A first-time or returning visitor to any `/destinations/[city]` page, during a period
where the pipeline has genuinely found zero confirmed deals sitewide (a real, expected,
recurring state — confirmed live 2026-09-23: 0 confirmed deals across all 36 markets,
correctly, because no hotel's real price has actually cleared the 30%+ threshold right
now), sees only: "Checked daily — no active deals right now" and a "Get free alerts"
CTA. No hotel content, no photos, nothing that signals the page is alive and tracking
real inventory for that city.

## Who is affected, and where

Every visitor to any of the 36 real `/destinations/{slug}` pages, at any moment the
sitewide confirmed-deal count is low (which is by design a frequent, not rare, state —
the whole product's differentiator is that it refuses to call something a deal unless
it clears a real bar). Confirmed live: right now, literally all 36 city pages are in
this state simultaneously.

## The measurable signal

`initialDeals.length === 0` in `app/destinations/[city]/page.tsx` (confirmed by reading
the file, line 267) renders only the empty-state message + CTA block. There is no
tracked-hotel fallback call on this page.

## This is inconsistent with the rest of the site, not a one-off

Grepped every real call site of `getActiveDeals` (confirmed deals) and `getTrackedHotels`
(tracked-but-unconfirmed hotels, no discount claim, used specifically to avoid ever
showing a blank results area) across the whole `app/` and `lib/` trees:

| Surface | Calls `getActiveDeals` | Falls back to `getTrackedHotels` when empty |
|---|---|---|
| `app/page.tsx` (home) | yes | **yes** |
| `app/deals/page.tsx` (main feed) | yes | **yes** |
| `app/api/deals/route.ts` (API) | yes | **yes** |
| `app/preview/dark-home/page.tsx` (preview) | yes | **yes** |
| `app/destinations/[city]/page.tsx` | yes | **no — this is the gap** |

So every other real deals-listing surface on the site already has this exact fallback
pattern built and working (per-hotel real photo/price shown, discount hidden, "Members-
only"/locked styling reused for gating — see `toApiDeal(row, locked)` in the destination
page itself, which already knows how to render a `locked` tracked row, it's just never
given any tracked rows to render). The destination page is the one surface that never
got wired up to use it.

## Checked and ruled out as a separate concern

`app/sitemap.ts` also calls `getActiveDeals` with no fallback, and currently emits zero
`/deals/{id}` routes. Confirmed this is **not** a bug: a deal detail page only exists
for a real active deal, so a sitemap listing zero deal-detail URLs when zero deals exist
is correct, not a gap. (City routes are unconditionally always in the sitemap, unaffected
either way.) Not in scope for this ticket.

`app/api/pipeline/run/route.ts`'s two `getActiveDeals` calls are internal (AI headline
backfill for deals missing one) — correctly no-op when there's nothing to backfill.
Not user-facing, not in scope.

## Constraints the solution must respect

1. Never show a fabricated or implied discount on a tracked-but-unconfirmed hotel — this
   exact failure mode (a false discount badge on locked/tracked cards) was a real,
   live bug found and fixed earlier in this project. Any fallback content must use the
   same `locked`/no-discount rendering path already proven safe elsewhere on the site.
2. Money/threshold logic (`MIN_QUALIFYING_DISCOUNT_PCT`, `getActiveDeals` vs
   `getTrackedHotels` semantics) must not change — this is a display/fallback-wiring
   fix, not a deal-detection change, and should not need the deal-detection maker/
   checker review path (no aggregate/threshold logic is being touched).
3. Preserve the existing paywall/lock behavior (`toApiDeal(row, locked)`) exactly as
   the other four surfaces already use it — do not invent new gating logic for this
   page.
4. Preserve SEO metadata (`generateMetadata`) and the existing `DestinationSeoContent`
   copy block — this fix is additive (fill the empty space below the header), not a
   rewrite of the page's content strategy.

## Success statement

This is solved when a visitor to any `/destinations/{city}` page, during a real quiet
market, sees real tracked hotel cards for that city (no discount claim, correctly
locked/labeled) instead of a bare "no active deals" message — matching what they'd
already see on the home page or main deals feed for the same city right now.
