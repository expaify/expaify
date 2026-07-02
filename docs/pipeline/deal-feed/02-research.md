# UXR: Deal Feed — Research

## Current implementation gap
- `app/deals/page.tsx` does not exist — only `app/deals/[dealId]/page.tsx` (detail view)
- `DealCard` and `LockedDealCard` exist in `app/components/ui/` and are proven on the landing page
- `GET /api/deals` is wired and returns `{ deals, total, premium }` with paywall applied
- No filter UI exists anywhere in the codebase

## Reference pattern analysis

**Booking.com results page**: Filter rail left on desktop, drawer on mobile. Sort (recommended / price low-high / review score) always visible above grid. Cards show photo, name, stars, location, nightly price, discount badge. Infinite scroll.

**Google Hotels**: Filter chips horizontally above the grid — destination, check-in, guests, price range. Card shows photo top, name + stars, location, price per night + "total". No blur/lock — just gating.

**Delta vs our use case**: Booking and Google have search intent (user has a destination). Expaify is a discovery feed (user has no destination, is browsing deals). The right pattern is closer to a product feed (e.g. DoorDash promotions, Airbnb Experiences) — horizontal filter chips, discount-sorted by default.

## Design directives
1. **Filter bar**: horizontal chip row — "All cities" dropdown + discount filter (20%+, 30%+, 40%+) + sort (Newest / Biggest discount). No sidebar. Chips not a sidebar rail.
2. **Grid**: 3 columns desktop (≥900px), 2 columns tablet (480–900px), 1 column mobile. 24px gap. Matches landing page card dimensions.
3. **Locked cards**: `LockedDealCard` renders in the same grid position as real cards. The "Unlock with Premium" button links to `/join`. Blurred content stays in DOM for SEO crawlability.
4. **Empty state**: if 0 deals and pipeline hasn't run yet, show 3 skeleton cards + copy "We're building your feed. Check back soon."
5. **Load more**: "Load more deals" button at bottom (not infinite scroll) — simpler, works without JS intersection observer, accessible.
6. **Nav**: reuse `LandingNav`. No secondary nav needed.
