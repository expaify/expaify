# Discovery: 70% orphaned pages / 100% too-few-internal-links (SearchAtlas finding)

## Root cause, confirmed by reading the real code

`app/sitemap.ts` submits three families of dynamic pages straight to `sitemap.xml`:
`/destinations/{city}` (from `CITY_SLUGS`, ~20 cities), `/deals/{dealId}` (up to 200 active
deals), and `/blog/{slug}` (all Contentful posts). A crawler (SearchAtlas, Google) discovers
all of them via the sitemap — that's why 90 pages get crawled — but "orphaned" specifically
means *no other crawled page links to it*. Confirmed by grep, not assumption:

- **`/destinations/[city]` pages are linked from NOWHERE in the app.** `grep -rl
  "destinations/\${"` across every `.tsx` file returns only the destinations page itself
  (a self-link "Start a new search" button and a link back to `/deals`). The homepage, the
  deals feed, and individual deal cards never link to a city page. ~20 pages, fully orphaned.
- **CORRECTION (verified 2026-08-15):** the original claim that blog posts have "zero outbound
  links of any kind" was overstated — `app/blog/[slug]/page.tsx` renders `<LandingNav />`,
  which does provide baseline links to `/`, `/blog`, `/deals`, `/join`, `/login`. The real,
  narrower gap: **individual posts never link to each other.** `/blog` only ever points back to
  the index, not to other specific posts — so a crawler/reader following links between content
  pages hits a dead end after one post. 5 real posts exist in production today (confirmed via
  the live sitemap.xml), each with a real `tags` field already available in the Contentful data
  model (`lib/contentful.ts`'s `BlogPost.tags`) — unused for cross-linking today, a real basis
  for a tag-matched "related posts" section.
- **`/deals/[dealId]` pages don't link back to their `/destinations/{city}` page.** Confirmed
  by grep — zero references to `destinations/` in the deal detail page. The deal→city
  relationship exists in the data (`deal.city`) but isn't rendered as a link anywhere.
- Individual deal cards (`DealCard.tsx`) do link to their own `/deals/{id}` detail page
  (`href={href}`, passed from `DealFeed.tsx`), so deal pages themselves are NOT the orphaned
  group — the destinations and blog families are.

This matches the audit's own signal: `CITY_SLUGS` pages are in the sitemap's "Top 10%
Important Pages" segment (priority 0.85, hourly refresh) but get zero real internal link
equity, which is close to a worst-case combination for orphan-page SEO impact.

## Scoped fix plan (not yet built, this is discovery only)

1. **Homepage → destinations**: add a real "Browse by destination" section linking to a
   handful of the ~20 `/destinations/{city}` pages (or all of them in a footer-style list).
2. **Deal card / deal detail page → its destination page**: render `deal.city` as a real link
   to `/destinations/{citySlug}` on both the card and the detail page — this is the single
   highest-value fix since it touches the highest-traffic surface (every deal, everywhere).
3. **Destination page → its deals**: `/destinations/[city]/page.tsx` already queries deals for
   that city implicitly via the search flow, but doesn't render direct links to specific
   `/deals/{id}` detail pages for that city today — add a "current deals in {city}" list with
   real links.
4. **Blog posts**: add a minimal "back to blog" link and a CTA into `/deals` or
   `/destinations/{city}` where a post is genuinely about a specific place — even one outbound
   link per post is a large relative improvement from zero.
5. **Cross-destination discovery**: a small "nearby/similar destinations" list on each city
   page (3-4 other cities) would resolve the "too few internal links" finding for that page
   family specifically, on top of fix #1.

Fix #2 (deal↔destination cross-link) is the highest-leverage, lowest-risk item — it's additive
UI on two already-well-tested surfaces (`DealCard.tsx`, `/deals/[dealId]/page.tsx`), touches
real existing data (`deal.city`), and the slug derivation is already solved: `lib/cities.ts`
exports both `CITY_SLUGS` (slug -> display name, used by the sitemap) and
`CITY_DISPLAY_TO_SLUG` (the exact reverse lookup this fix needs, already built, unused
anywhere in the app today). No new helper needed — confirmed by reading the file directly.

## Recommendation

Proceed to UXDES for fix #2 first (deal↔destination linking) as the smallest, highest-value,
lowest-risk slice — it alone would resolve the majority of the "orphaned destination pages"
problem (~20 of the 63 orphaned pages) without touching blog/Contentful content, which is a
separate, lower-priority content-ops concern rather than a code fix.
