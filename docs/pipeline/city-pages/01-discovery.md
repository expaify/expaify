# UXD Discovery: City Landing Pages
**Ticket:** UXD-CITY-PAGES-001  
**Stage:** UX Discovery  
**Date:** 2026-07-05  
**Author:** UXD Agent (Claude Fable 5 persona)

---

## Problem Statement

A user searching for hotel deals in a specific destination (e.g., "hotel deals Miami", "cheap hotels Paris this weekend") lands on `/deals` — a generic feed with no city context, a generic page title, and no URL they can bookmark or share. The city filter is a client-side UI control invisible to search engines and unreachable via direct link.

---

## Who Is Affected

**Primary:** Organic search arrivals with high city intent — users who have already decided on a destination and are evaluating whether to book now. They enter at Google/Bing, not the homepage. They arrive expecting a city-specific result page, find a generic feed, and bounce within 10 seconds.

**Secondary:** Returning users who want to share a city feed ("here are the Paris deals right now") — the current URL `/deals?city=Paris` is client-side state that does not survive page load or link share reliably.

**Stage in flow:** Top-of-funnel discovery. This is the first touchpoint before any hotel deal is viewed. Conversion path: city page → deal card click → deal detail → unlock/book.

---

## Measurable Signals the Problem Exists

1. **Zero indexed city URLs.** `site:expaify.com inurl:miami` returns nothing. Google Flights, Booking.com, and Expedia all have dedicated `/hotels/miami` pages indexed for each destination.
2. **Generic meta per page.** `/deals` has title "Hotel deals today — expaify" and description "We track 20 destinations daily…". No city name appears in `<title>` or `<meta name="description">` — zero signal to Google for city-intent queries.
3. **Client-side filter is not a URL.** `?city=Paris` is applied client-side in `DealFeed.tsx` via `useState` + `URLSearchParams`. There is no `app/deals/[city]/page.tsx` route — no server render, no city-specific metadata, no sitemap entry per city.
4. **Sitemap omits city pages.** `sitemap.ts` lists `/deals` once. No `/deals/miami`, `/deals/paris`, etc. Googlebot has no path to discover individual city feeds.

---

## Constraints the Solution Must Respect

1. **Performance:** City pages must be server-rendered (RSC) with the city filter applied on the server. No extra client round-trip to apply the filter. First Meaningful Paint must be ≤ 2s on 4G.
2. **Data integrity:** City slug must map to a validated `tracked_markets.city` value — no 404s for typos or injections. Unrecognized slugs return 404, not an empty feed.
3. **Consistency:** The DealFeed component already handles empty states. City pages should reuse it — no duplicate feed rendering logic. The filter chip on the global `/deals` page should deep-link to the city page when a city is selected, not just update client state.
4. **Accessibility and brand:** City page must use the same design tokens, font, and layout as `/deals`. No new colour palette or type scale.

---

## Competitive Baseline

| Surface | Booking.com | Google Hotels | expaify (current) |
|---|---|---|---|
| City-specific URL | `/searchresults.html?ss=Miami` | `/travel/hotels/miami` | None — client filter only |
| `<title>` tag | "Hotels in Miami — Booking.com" | "Miami Hotels — Google" | "Hotel deals today — expaify" |
| Sitemap | Yes, per city | Yes | No city entries |
| Server-rendered city filter | Yes | Yes | No — client state |
| Shareable link | Yes | Yes | Unreliable (`?city=` is client-side) |

The gap is structural: expaify has no server-side route per city.

---

## Success Statement

**This is solved when:** A first-time user searching "hotel deals Miami" on Google lands on `expaify.com/deals/miami`, sees a page titled "Hotel deals in Miami — expaify" with only Miami deals rendered server-side, can share the URL and have it load correctly for a recipient with no filter interaction required — all without seeing a spinner, an empty state, or having to set a filter themselves.

---

## Scope

**In scope:**
- Route `app/deals/[city]/page.tsx` — server component, city-filtered deals, city-specific metadata
- Sitemap entries for all 20 tracked cities in `sitemap.ts`
- Redirect from `/deals?city=<X>` to `/deals/<x-slug>` to consolidate link equity
- City page OG image (reuse per-deal OG pattern with city name instead of hotel)

**Out of scope (next tickets):**
- New city onboarding (adding cities beyond the 20 tracked)
- City-level price history or trend charts
- City "hub" editorial content
- Paid search / SEM usage of these URLs

---

## Handoff Notes for UXR

The research stage should audit:
- Slug format: lowercase, hyphenated (`new-york`, `punta-cana`, `cancun` vs `cancún`) — character normalization needed
- How the existing `getActiveDeals()` signature maps city string to the filter (`city` param in `DealFeed`)
- Empty state: what to show when a tracked city has 0 active deals today
- Whether `app/deals/[city]` conflicts with `app/deals/[dealId]` — both are `[param]` segments under `/deals/`

That last point is **critical**: if both `app/deals/[dealId]/page.tsx` and `app/deals/[city]/page.tsx` exist as siblings, Next.js will conflict. Confirm actual route structure and propose the resolution (either rename city route to `/destinations/[city]` or use a different segment).
