---
id: UXDES-DEAL-FEED-FILTERS-001
stage: UXDES
---

# Design Spec: Stars Filter + Hotels/Flights Tabs

## Tab structure (above filter bar)

Two pill tabs: **Hotels** (active by default) | **Flights**

```
[ Hotels ]  [ Flights ]
```

- Tab container: `flex gap-2 mb-6 mt-4`
- Active tab: `rounded-[var(--radius-pill)] bg-[color:var(--primary)] px-5 py-2 text-[13px] font-medium text-white`
- Inactive tab: `rounded-[var(--radius-pill)] border border-[color:var(--line-ivory)] bg-white px-5 py-2 text-[13px] font-medium text-[color:var(--ink)] hover:border-[color:var(--primary-soft)]`

When Hotels tab active → show existing feed (filters + grid).
When Flights tab active → hide all filters and grid, show empty state.

## Stars filter

Inserted in the filter bar after the discount select, before sort pills.

Control: `<select>` matching existing filter selects.

Options:
- "Any stars" → value `0`
- "3★ & up" → value `3`
- "4★ & up" → value `4`
- "5★ only" → value `5`

Classes: same as existing selects — `appearance-none rounded-[var(--radius-pill)] border border-[color:var(--line-ivory)] bg-white px-4 py-2 text-[13px] font-medium text-[color:var(--ink)] cursor-pointer`

aria-label: "Minimum star rating"

Wire into fetchDeals: add `min_stars` param. When `minStars > 0`, include `min_stars=N` in URLSearchParams.

## Flights tab empty state

Centered in the content area, replacing the feed grid.

```
[plane icon 48px, teal]

Coming soon

We're working on flight deals across our 20 destinations.
Sign up for alerts and we'll let you know when they're live.

[ Get notified ]  →  /account (or /join for guests)
```

Exact layout:
- Outer div: `py-24 text-center`
- Icon: SVG plane, 48px, stroke `#0E5A54`, no fill
- h2: `font-display text-[24px] font-bold text-[color:var(--ink)] mt-4`
- p: `mt-2 text-[14px] text-[color:var(--ink-soft)] max-w-[340px] mx-auto`
- Button: `btn btn-primary mt-6 px-8` linking to `/account`

## API: min_stars param

In `/api/deals/route.ts`: read `min_stars` from searchParams, pass to `getActiveDeals` as `minStars: number`.
In `lib/pipeline/dealDetection.ts`: in `getActiveDeals`, add `AND (d.stars IS NULL OR d.stars >= $N)` when `minStars > 0`.

## State machine in DealFeed

Add `activeTab: 'hotels' | 'flights'` state (default `'hotels'`).
When tab switches to flights: no fetch needed, just render empty state.
When tab switches to hotels: show current deals (no re-fetch needed).
Stars filter: `minStars: number` state (default `0`), passed into `fetchDeals` and `applyFilter`.
