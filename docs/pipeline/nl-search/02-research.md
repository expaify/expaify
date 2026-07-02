---
id: UXR-NL-SEARCH-01
stage: UXR
---

# Research: Natural Language Deal Search

## Current State
`/deals` has a city dropdown (hardcoded 20 cities) and minDiscount slider. Both require exact knowledge. No free-text input exists. DealFeed fetches `/api/deals?city=X&minDiscount=Y` on mount and on filter change.

## Reference Patterns
**Google Flights explore:** Free text box parses "Paris in December under $500" into destination + date range + max price.  
**Booking.com:** Autocomplete text matches partial city names to destinations.

## Design Directives
1. Single text input replaces or complements the city dropdown — "Search deals" placeholder
2. AI parses the query into `{ city?: string, maxPriceCents?: number, minDiscount?: number }` — the three existing filter axes
3. Fallback: if AI parse fails or returns nothing, do simple substring city match against 20-city list
4. Parse via `POST /api/search/parse` — 1 API call, response ≤ 500ms with haiku
5. Show parsed intent as a chip below the input: "Showing: Miami · ≤$150/night · 30%+ off" — so users understand what fired
