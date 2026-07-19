# UXDES Design Spec: City Landing Pages
**Ticket:** UXDES-CITY-PAGES-001  
**Stage:** UX Design  
**Date:** 2026-07-05  
**Input:** docs/pipeline/city-pages/02-research.md

---

## Route

```
app/destinations/[city]/page.tsx        ← server component
app/destinations/[city]/opengraph-image.tsx  ← city OG image
```

No changes to `app/deals/` routes. No conflict.

---

## Slug Map (hardcoded — source of truth)

```typescript
export const CITY_SLUGS: Record<string, string> = {
  'miami':        'Miami',
  'new-york':     'New York',
  'cancun':       'Cancún',
  'paris':        'Paris',
  'rome':         'Rome',
  'barcelona':    'Barcelona',
  'lisbon':       'Lisbon',
  'london':       'London',
  'tokyo':        'Tokyo',
  'bangkok':      'Bangkok',
  'dubai':        'Dubai',
  'las-vegas':    'Las Vegas',
  'orlando':      'Orlando',
  'san-juan':     'San Juan',
  'tulum':        'Tulum',
  'amsterdam':    'Amsterdam',
  'athens':       'Athens',
  'punta-cana':   'Punta Cana',
  'charlotte':    'Charlotte',
  'nashville':    'Nashville',
}

// Reverse: display name → slug (used by DealFeed city pill deep-links)
export const CITY_DISPLAY_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_SLUGS).map(([slug, name]) => [name, slug])
)
```

Location: `lib/cities.ts` — imported by the page, sitemap, and DealFeed.

Unknown slug → `notFound()`. No fallback to empty feed.

---

## Data Flow

The city page is a **React Server Component**. It fetches deals on the server and passes them to `DealFeed` as `initialDeals`. Client-side pagination continues to use the existing `/api/deals?city=<name>` endpoint.

`DealFeed` gets a new optional prop: `initialDeals?: ApiDeal[]`. When provided, it skips the initial client-side fetch and renders the pre-fetched deals immediately. Subsequent pages (load more) still fetch client-side.

```typescript
// app/destinations/[city]/page.tsx (simplified structure)
export default async function CityPage({ params }) {
  const { city } = await params
  const displayName = CITY_SLUGS[city]
  if (!displayName) notFound()

  // Resolve market_id from DB
  const market = await query('SELECT id FROM tracked_markets WHERE city = $1', [displayName])
  const marketId = market.rows[0]?.id

  // Pre-fetch first page of deals (server-side)
  const initialDeals = marketId
    ? await getActiveDeals({ marketId, limit: 20, sort: 'newest', includeMock: false }).catch(() => [])
    : []

  return <CityPageContent city={displayName} initialDeals={initialDeals} marketId={marketId} />
}
```

---

## generateMetadata

```typescript
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  const displayName = CITY_SLUGS[city]
  if (!displayName) return {}
  return {
    title: `Hotel deals in ${displayName} — expaify`,
    description: `expaify tracks hotels in ${displayName} daily and surfaces deals 30–50% below their 60-day average price.`,
    openGraph: {
      title: `Hotel deals in ${displayName}`,
      description: `Track hotel deals in ${displayName} — updated daily.`,
      url: `https://expaify.com/destinations/${city}`,
    },
    alternates: { canonical: `https://expaify.com/destinations/${city}` },
  }
}
```

---

## Page Layout — All States

### State 1: Default (deals exist)

```
┌─────────────────────────────────────────────────────────────┐
│  [breadcrumb] All destinations › Miami                      │
│                                                             │
│  Hotel deals in Miami              [Discount ▼] [Stars ▼]  │
│  [subtitle: Updated daily · 20 hotels tracked]             │
│                                                             │
│  [DealFeed — pre-populated, city locked, no city filter]   │
└─────────────────────────────────────────────────────────────┘
```

**Breadcrumb** (mobile: hidden; desktop: visible):
```
<nav aria-label="breadcrumb">
  <a href="/deals" class="text-[13px] text-[color:var(--text-2)] hover:text-[color:var(--text-1)]">
    All destinations
  </a>
  <span class="mx-2 text-[color:var(--text-3)]">›</span>
  <span class="text-[13px] text-[color:var(--text-1)] font-medium">{city}</span>
</nav>
```

**Page header:**
```
<h1 class="text-h2 text-[color:var(--ink)] font-display mt-4 mb-1">
  Hotel deals in {city}
</h1>
<p class="text-[13px] text-[color:var(--text-2)] mb-6">
  Updated daily · {dealCount} deal{dealCount !== 1 ? 's' : ''} found
</p>
```

**DealFeed on city pages:**
- `initialDeals` prop pre-populated (no spinner on initial load)
- City filter pill is absent — city is implied by the URL, adding a city filter would be confusing
- All other filters (discount, stars, price, dates) remain available to premium users
- `defaultCity` prop tells DealFeed to pass `?city={displayName}` on all client fetches

### State 2: Empty (city tracked but 0 active deals)

```
┌─────────────────────────────────────────────────────────────┐
│  Hotel deals in Tulum                                       │
│  Updated daily · 0 deals found                             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │   No deals in Tulum right now.                       │  │
│  │   We check daily — prices can drop overnight.        │  │
│  │                                                      │  │
│  │   [See all destinations →]                           │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

Empty state component (inline on city page, not inside DealFeed):
```tsx
<div class="mt-12 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] px-8 py-12 text-center">
  <p class="text-[15px] font-medium text-[color:var(--text-1)] mb-2">
    No deals in {city} right now.
  </p>
  <p class="text-[13px] text-[color:var(--text-2)] mb-6">
    We check daily — prices can drop overnight.
  </p>
  <a href="/deals"
     class="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--brand)] px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90 transition-opacity">
    See all destinations
  </a>
</div>
```

**Never** show mock deals on city pages. `includeMock: false` is enforced at the query level.

### State 3: Error (DB unavailable)

Render the empty state (same UI as State 2). Do not expose the error message. Log server-side only.

### State 4: 404 (unknown city slug)

Next.js `notFound()`. Uses the existing `not-found.tsx`. No custom handling needed.

---

## Mobile (375px)

- Breadcrumb: hidden (`hidden md:flex`)
- `<h1>`: `text-h2` applies at all sizes (already responsive per globals.css)
- Filters: same horizontal scroll behavior as on `/deals`
- No layout changes needed — DealFeed's responsive behavior is unchanged

---

## Desktop (1280px)

- Breadcrumb: visible (`hidden md:flex`)
- Header and deal grid use existing max-width container from layout
- No new layout work needed

---

## DealFeed Changes Required (minimal)

Two new optional props added to `DealFeed`:

```typescript
type DealFeedProps = {
  initialDeals?: ApiDeal[]   // pre-fetched server-side; skips initial client fetch
  defaultCity?: string       // city name to lock into all client-side fetches; hides city filter pill
}
```

When `defaultCity` is set:
- City filter pill is not rendered
- All `fetchDeals` calls append `&city={defaultCity}` automatically
- The active city state is initialized to `defaultCity` and read-only

When `initialDeals` is set:
- Component initializes `deals` state with `initialDeals` instead of `[]`
- Skips the initial `useEffect` fetch call
- Subsequent "load more" calls continue normally

---

## DealFeed City Pill Deep-Link

On `/deals` (the global feed), when a user selects a city filter, the city pill should navigate to the city page instead of updating local state:

**Before:** `onSelect: () => applyFilter({ city: c })`  
**After:** `onSelect: () => router.push('/destinations/' + CITY_DISPLAY_TO_SLUG[c])`

This makes city selection create a real URL. On the city page, the pill is absent, so there's no circular navigation.

---

## Sitemap Addition

In `app/sitemap.ts`, add after the static routes and before deal routes:

```typescript
const cityRoutes: MetadataRoute.Sitemap = Object.keys(CITY_SLUGS).map(slug => ({
  url: `${BASE}/destinations/${slug}`,
  changeFrequency: 'hourly' as const,
  priority: 0.85,
}))

return [...static_routes, ...cityRoutes, ...dealRoutes]
```

---

## Copy — Final Strings (no placeholders)

| Location | String |
|---|---|
| `<title>` | `Hotel deals in {City} — expaify` |
| `<meta description>` | `expaify tracks hotels in {City} daily and surfaces deals 30–50% below their 60-day average price.` |
| Page `<h1>` | `Hotel deals in {City}` |
| Subtitle (deals found) | `Updated daily · {n} deals found` |
| Subtitle (0 deals) | `Updated daily · 0 deals found` |
| Empty heading | `No deals in {City} right now.` |
| Empty subtext | `We check daily — prices can drop overnight.` |
| Empty CTA | `See all destinations` |
| Breadcrumb root | `All destinations` |
| Breadcrumb separator | `›` |

---

## Accessibility

- `<h1>` on every city page (currently only `<h2>` on `/deals`) 
- Breadcrumb nav uses `aria-label="breadcrumb"` and `aria-current="page"` on the terminal item
- Empty state CTA is an `<a>` not a `<button>` — navigates, not triggers
- City page `<title>` is unique per city — screen readers announce the correct destination

---

## Interaction Rules

| Trigger | Action |
|---|---|
| User visits `/destinations/miami` | Server renders Miami deals; no spinner; metadata = "Hotel deals in Miami — expaify" |
| User scrolls to bottom of feed | Client fetches next page with `?city=Miami` — same as `/deals?city=Miami` |
| User clicks "All destinations" in breadcrumb | Navigate to `/deals` |
| User clicks city chip on `/deals` | `router.push('/destinations/{slug}')` — full navigation, not state update |
| User visits `/destinations/atlantis` | `notFound()` — 404 page |
| User visits `/destinations/tulum` with 0 deals | Empty state (no mock fallback) |
