# UXR Research: City Landing Pages
**Ticket:** UXR-CITY-PAGES-001  
**Stage:** UX Research  
**Date:** 2026-07-05  
**Input:** docs/pipeline/city-pages/01-discovery.md

---

## Current Implementation Audit

### Route structure
```
app/deals/
  page.tsx              ← static metadata, renders DealFeed client component
  DealFeed.tsx          ← city filter is useState — no URL navigation
  [dealId]/
    page.tsx            ← deal detail, no generateMetadata
    opengraph-image.tsx
```

There is no `app/deals/[city]/` route. City selection in `DealFeed.tsx` calls `applyFilter({ city })` which updates local state and rewrites `URLSearchParams` — the URL changes to `?city=Paris` but this is a client-side write with no server involvement and no `<title>` change. Googlebot sees one page: `/deals`, always with the same `<title>Hotel deals today — expaify</title>`.

### Route conflict — resolved

`app/deals/[dealId]/page.tsx` exists. Adding `app/deals/[city]/page.tsx` as a sibling dynamic segment creates an ambiguous route — Next.js cannot distinguish `/deals/miami` (city) from `/deals/<uuid>` (deal) at filesystem routing time.

**Resolution: use `/destinations/[city]/`.**

- Zero conflict with existing routes
- Clean URL hierarchy: `expaify.com/destinations/miami`
- "destinations" is a valid travel industry term — Google Hotels uses it, Booking.com uses it in breadcrumbs
- SEO: the path itself matters less than the `<title>`, `<h1>`, and content — both "deals" and "destinations" in the path are fine as long as the page content targets the intent

**Do not** attempt a single-segment disambiguation (detecting UUID vs slug in `[dealId]/page.tsx`) — that creates hidden coupling between the city slug namespace and the UUID namespace.

### City filter today vs reference patterns

| Behaviour | expaify now | Booking.com | Google Hotels |
|---|---|---|---|
| City URL | `/deals?city=Paris` (client-only, no server render) | `/searchresults.html?ss=Paris&...` | `/travel/hotels/paris-france` |
| `<title>` on city view | "Hotel deals today — expaify" (unchanged) | "Paris hotels: find cheap hotels in Paris" | "Paris Hotels — Google" |
| Server render city feed | No — JS required | Yes | Yes |
| OG / share preview | Generic deal list OG | Not directly shareable | City card |
| Sitemap | `/deals` (one entry) | Per-city pages indexed | Per-city pages indexed |
| Breadcrumb | None | Home › Paris | Home › Paris |
| Empty state | Generic "no deals" | "Try adjusting dates" | "No hotels found" |

**Gap:** expaify has 0% of the SEO surface area that Booking.com and Google Hotels have for city-intent queries. Every city-specific organic query is unaddressable.

### Slug normalization requirement

The `CITIES` array in `DealFeed.tsx` contains:
```
'Cancún', 'Punta Cana', 'San Juan', 'Las Vegas', 'New York'
```

URL slugs must be ASCII, lowercase, hyphenated. Mapping:
- `Cancún` → `cancun` (strip diacritics)
- `Punta Cana` → `punta-cana`
- `New York` → `new-york`
- `Bangkok` → `bangkok`
- etc.

A bidirectional map is required: slug → display name (for `<h1>` and metadata) and display name → slug (for city filter deep-links). Invalid slugs must return 404, not an empty feed — preventing injection and content dilution.

### Additional gap: deal detail has no `generateMetadata`

`app/deals/[dealId]/page.tsx` has no `generateMetadata` export. Every deal detail page renders with the layout's default title. This is a separate bug — not in scope for city pages, but noted for a follow-up ticket.

---

## Design Directives

These are implementation-ready. The design stage should produce specs for each.

**1. Route: `/destinations/[city]/page.tsx`**  
Server component. Accepts `city` param (ASCII slug). Validates against a hardcoded slug→display-name map — unknown slugs call `notFound()`. Fetches deals server-side with `getActiveDeals({ marketId, includeMock: false })` where `marketId` is resolved from `tracked_markets` by city name. Passes deals to `DealFeed` with `initialDeals` prop (no client round-trip for initial render).

**2. City-specific metadata via `generateMetadata`**  
Export `generateMetadata({ params })` from the city page. Title: `"Hotel deals in {City} — expaify"`. Description: `"expaify tracks hotels in {City} daily and surfaces deals 30–50% below their 60-day average price."`. OG image: reuse the per-deal OG pattern with city name and a representative deal if one exists.

**3. Sitemap entries for all 20 cities**  
`sitemap.ts` already exists. Add city page entries: `{ url: 'https://expaify.com/destinations/{slug}', changeFrequency: 'hourly', priority: 0.85 }` for each city. Priority 0.85 sits between `/deals` (0.9) and individual deal pages (0.7).

**4. City filter pill deep-links to the city page**  
In `DealFeed.tsx`, when a city is selected, the city filter pill should render as `<Link href="/destinations/{slug}">` (navigating to the city page) rather than calling `applyFilter` locally. On the city page itself, the city pill is pre-selected and non-interactive. This creates real URLs that browsers and crawlers follow, replacing the current client-state filter.

**5. Empty state specific to the city**  
When a city page has no active deals: show "No deals in {City} right now. We check every day — check back tomorrow." with a CTA to `/deals` ("See all destinations"). Do not show the mock fallback on city pages — an empty real state is more trustworthy than fake data.

---

## Constraints Confirmed

- No new components needed — `DealFeed` already handles empty, loading, and error states
- No new DB tables — `tracked_markets.city` is the source of truth for valid city names
- City pages must not show `is_mock=true` deals — `includeMock: false` enforced at the query level
- No free-user filter bypass — city pages respect the same paywall logic as `/deals`
