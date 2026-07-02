# UXDES: Deal Feed — Design Spec

## Route
`/deals` — server component wraps a client feed component

## States to implement

### Default (deals exist)
- LandingNav sticky at top
- Page heading: `Today's hotel deals` (Space Grotesk 700, 32px mobile / 40px desktop, --ink)
- Subhead: `XX deals found across 20 destinations` (Inter 400, 14px, --ink-soft)
- Filter bar below heading
- Deal grid
- Load more button

### Loading (filter change in flight)
- Grid items replaced with 6 skeleton cards (same aspect ratio, bg --line-ivory, pulse animation via `.skeleton`)

### Empty (0 deals)
- 3 skeleton cards with reduced opacity (not pulsing)
- Centered copy below grid: `We're building your feed.` (Space Grotesk 700, 20px) + `Check back in a few hours — our pipeline runs daily across 20 destinations.` (Inter 400, 14px, --ink-soft)

### Error (fetch failed)
- Same layout, grid shows: `Couldn't load deals right now.` with a Retry button (btn btn-primary)

## Filter bar spec
Container: `flex gap-2 flex-wrap` row, `mb-8 mt-6`

**City filter** — `<select>` styled as pill
- Label: visually hidden, aria-label="Filter by destination"
- Options: "All destinations", then one per market city (Miami, New York, Cancún, …)
- Style: `field-input rounded-[var(--radius-pill)] px-4 py-2 text-[13px] font-medium bg-white border border-[var(--line-ivory)] appearance-none cursor-pointer`

**Discount filter** — `<select>` styled as pill
- Options: "Any discount", "20%+ off", "30%+ off", "40%+ off"
- Same style as city filter

**Sort** — two pill toggle buttons
- "Newest" / "Biggest discount"
- Active state: `bg-[var(--primary)] text-white`
- Inactive: `bg-white border border-[var(--line-ivory)] text-[var(--ink)]`
- Style: `rounded-[var(--radius-pill)] px-4 py-2 text-[13px] font-medium`

## Deal grid spec
`grid gap-6 grid-cols-1 min-[480px]:grid-cols-2 min-[900px]:grid-cols-3`

**Unlocked card**: `DealCard` — existing component, no changes
- `deal.links` maps from `otaLinks` API field
- `deal.dealPrice = { priceCents: deal.dealPriceCents, currency: 'USD' }`
- `deal.medianPrice = { priceCents: deal.medianPriceCents, currency: 'USD' }`

**Locked card**: `LockedDealCard`
- `placeholderName="Members-only deal"`
- `placeholderCity` = deal city from API
- Lock button: `<a href="/join">` not `<button>` — navigates to upgrade

## Skeleton card spec
```
<div class="rounded-[var(--radius-card)] overflow-hidden bg-white">
  <div class="skeleton aspect-[3/2]" />
  <div class="p-4 space-y-3">
    <div class="skeleton h-4 w-16 rounded-full" />
    <div class="skeleton h-5 w-3/4 rounded" />
    <div class="skeleton h-3 w-1/2 rounded" />
    <div class="skeleton h-8 w-24 rounded-full mt-2" />
  </div>
</div>
```

## Load more button
- Centered below grid, `mt-10`
- Copy: "Load 12 more deals"
- Style: `btn btn-primary px-8`
- Hidden when total ≤ current count

## Copy — final strings
- Page title (meta): `Hotel deals today — expaify`
- H1: `Today's hotel deals`
- Subhead: `{n} deals across 20 destinations` (or "Deals across 20 destinations" if n unknown)
- Empty state h2: `We're building your feed.`
- Empty body: `Check back in a few hours — our pipeline runs daily across 20 destinations.`
- Load more: `Load 12 more deals`
- Filter city label: `Destination`
- Filter discount label: `Min discount`
- Filter sort label: `Sort`

## Interaction rules
- Filter change → reset offset to 0, re-fetch, replace grid (not append)
- Load more → increment offset by 12, append to grid
- Locked card button click → navigate to `/join`
- Card with no photo → show placeholder bg `--line-ivory` (DealCard already handles this)
