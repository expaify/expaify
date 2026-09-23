# UX Research: Destination page tracked-hotel fallback

Ticket: DESTINATION-EMPTY-STATE-01

## Audit of current implementation (confirmed by reading the real file)

`app/destinations/[city]/page.tsx`:
- Resolves `marketId` for the page's one city via `tracked_markets` (line ~113).
- Resolves `effectiveView` from `searchParams` via `resolveHotelResultsView` — but only
  for **premium** users (`pwCtx.premium ? requestedView : <hardcoded default>`, line 111).
  Free users always get the hardcoded default view
  (`minDiscount: MIN_QUALIFYING_DISCOUNT_PCT, maxPriceCents: null, minStars: 0, sort: 'newest'`)
  regardless of what's in the querystring.
- Calls `getActiveDeals({ marketId, ...effectiveView, ... })` only — no `getTrackedHotels`
  call anywhere in the file. Confirmed via grep; this part of the original discovery
  report holds.
- When `initialDeals.length === 0`, renders only the "Checked daily — no active deals
  right now" message + CTA block (lines 256-279). No hotel content.

## Comparison against the reference pattern — an important correction to the discovery report

Initially assumed (in 01-discovery.md) that because this page is always scoped to one
city, it could unconditionally fall back to `getTrackedHotels({ marketId })` whenever
`getActiveDeals` returns empty. **This is wrong**, confirmed by reading the actual
querystring/filter resolution at the top of the page (lines 82-113):

`app/deals/page.tsx`'s fallback deliberately restricts itself to the fully-default,
unfiltered view (`criteria.destination.state === 'all' && ... && effectiveView.minDiscount
=== MIN_QUALIFYING_DISCOUNT_PCT && effectiveView.maxPriceCents === null && effectiveView.minStars
=== 0 && effectiveView.sort === 'newest'`) — specifically so a user who has applied a real
filter (5 stars only, price cap, custom sort) never gets shown generic tracked-hotel
content that silently ignores their filter.

The destination page **can** carry the exact same kind of filtered state: a premium
user can reach `/destinations/paris?minStars=5` (or any other `resolveHotelResultsView`
querystring combination) and get a non-default `effectiveView`. If the fallback fired
unconditionally here, a premium user who filtered for 5-star-only would see 2-star
tracked hotels with no indication their filter was silently dropped — the same
misleading-content failure mode `app/deals/page.tsx`'s restriction already exists to
prevent. Free users are not at risk of this specific failure (their view is always the
hardcoded default), but the fix must not assume "single-city page" implies "never
filtered" — those are independent facts.

## The exact gap, precisely restated

Not "this page lacks a fallback." Precisely: **this page lacks the fallback that every
other deals-listing surface already has, gated by the exact same default-view
restriction those surfaces already use** — with `marketId` always supplied (unlike
`app/deals/page.tsx`, which only has a `marketId` when the user has separately picked a
city filter on the all-cities feed; here it's always present, since the page is the
city).

## Design directives

1. **Fallback condition**: fire `getTrackedHotels({ limit: HOTEL_DEAL_PAGE_SIZE, marketId })`
   only when `rows.length === 0 && !initialError && effectiveView.minDiscount ===
   MIN_QUALIFYING_DISCOUNT_PCT && effectiveView.maxPriceCents === null && effectiveView.minStars
   === 0 && effectiveView.sort === 'newest'`. No city/date-state check needed here (unlike
   `app/deals/page.tsx`) — `marketId` is already resolved and always present for this page.
2. **Row mapping**: reuse `toApiDeal(row, locked)` exactly as already defined in this
   file, with the same locking rule already proven elsewhere: `!pwCtx.premium && i >=
   pwCtx.freeUnlockLimit && !unlockedIds.has(row.id)` (matches `app/deals/page.tsx` line
   ~150-151 and `app/page.tsx`'s tracked-hotel mapping) — never show a discount on a
   locked/tracked row (the display already has no discount for tracked rows via
   `toApiDeal`'s `locked` branch, confirmed in this same file, lines ~29-40).
3. **Copy**: when the fallback supplies rows, the "Checked daily — no active deals right
   now" line must not show (it's specifically the *zero content at all* state) — swap to
   the existing non-empty copy path (`Updated daily · N deal(s) found`) is wrong wording
   for tracked-not-confirmed rows; needs its own line, e.g. "Checked daily — nothing
   confirmed yet, here's what we're tracking" so it's never confused with a real deal
   count. This is a new copy string, not reuse of either existing branch.
4. **Empty-of-everything state stays**: if `getTrackedHotels` also returns zero rows
   (a brand-new/untracked city, or a real DB error on the fallback call itself), keep
   today's exact "no active deals right now" + CTA block untouched — do not regress the
   already-correct genuinely-empty case.
5. **No SEO/metadata change**: `generateMetadata` and `DestinationSeoContent` are
   untouched — this is additive content below the existing header, not a rewrite.

## Explicitly not in scope (confirmed, not assumed)

- `app/sitemap.ts`: correct as-is, a deal-detail sitemap entry for a non-existent deal
  would be wrong; not a gap.
- `app/api/pipeline/run/route.ts`: internal headline-backfill, correctly no-ops on empty.
- Any deal-detection/threshold logic: untouched. This is display/fallback wiring only,
  reusing an already-shipped, already-reviewed query and row-mapping function verbatim.
