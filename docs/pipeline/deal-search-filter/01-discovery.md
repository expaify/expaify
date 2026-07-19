# UX Discovery — Deal search & filter UX

**Ticket:** UXD-DEAL-SEARCH-FILTER-001 · **Stage:** UXD · **Date:** 2026-07-19
**Surface:** `/deals` feed (and `/destinations/[city]` which reuses the same `DealFeed` component)

---

## 1. Problem statement (one sentence)

A user who arrives at `/deals` with a specific destination, budget, or travel window in mind cannot reliably narrow the feed to deals relevant to them — the filter controls that exist are premium-gated, silently dead on the server-rendered first load even for premium users, missing a date-range control, and lose all state on refresh — so the user scrolls an undifferentiated list and gives up before finding a relevant deal.

### Correction to the ticket premise

The ticket states "a user … has to scroll through all deals — there is no quick way to narrow by price, discount %, hotel rating, or date range." **That premise is partially outdated.** The current code already ships filter pills for destination, min discount, min stars, and max price, a Newest/Biggest-discount sort toggle, and a natural-language search bar that can set all of those plus a date range (`app/deals/DealFeed.tsx`, `app/components/ui/SearchBar.tsx`). The real problem is not absence of filters — it is that the filters **do not work for most users in practice**, for the reasons documented below. Downstream stages should treat this as a repair-and-complete problem, not a green-field feature.

---

## 2. Who is affected, and where in the flow

| User | Step | What happens |
|---|---|---|
| **Free user** (majority of traffic) | `/deals`, immediately after load | Every filter pill, the sort toggle, and the search bar render **disabled**. The API additionally ignores all filter params server-side for free users (`app/api/deals/route.ts:86-92`). The only affordance is a one-line lock notice linking to `/join`. A free user with a destination in mind has literally no way to narrow the feed — not even by city. |
| **Premium user, first page load** | `/deals` (server-rendered path) | `DealsPage` pre-fetches deals server-side and passes `initialDeals`, so `DealFeed` skips its initial client fetch (`DealFeed.tsx:260-266`). But the `premium` flag is only ever set from a client fetch response (`DealFeed.tsx:251`), and starts `false`. Result: **a paying user lands on `/deals` with every filter, sort, and search control disabled**, plus the "Filters and sorting are included with Premium" upsell — for a feature they already paid for. Controls stay dead until something triggers a client fetch, which nothing does, because the only triggers are the disabled controls themselves. This is a trust-eroding functional bug, and it is the most likely source of the "filters are limited" perception in the ticket. |
| **Premium user, filtering by destination** | Destination pill | 19 of the 20 listed cities resolve in `CITY_DISPLAY_TO_SLUG`, so picking a city triggers a **full navigation to `/destinations/<slug>`** (`DealFeed.tsx:382-386`) instead of filtering in place — the user loses scroll position, active filters do not carry over, and on the destination page the destination pill is hidden entirely (`!defaultCity` guard), so changing city means going back. In-place city filtering is effectively unreachable from the pill UI. |
| **Premium user, with travel dates** | Any | There is **no visible date-range control**. `date_from`/`date_to` are fully supported by the API and DB query (`getActiveDeals`, `lib/pipeline/dealDetection.ts:260-270`) but are reachable only by typing dates into the natural-language search bar and hoping the LLM parse succeeds. A user planning "late August" cannot narrow the feed with direct manipulation. |
| **Any user, returning or sharing** | Refresh / back / share link | Filter state lives only in React state. Refresh resets everything; the back button after the destination-pill navigation loses the session; a filtered view cannot be shared or bookmarked. |
| **Any user, price-conscious** | Sort control | Sort offers only Newest and Biggest discount. There is **no price sort** — the first sort every hotel OTA offers — so "cheapest option in this city" requires reading every card. |

---

## 3. What exists today vs. what the data supports

### Filters implemented in UI today (all premium-gated)
- Destination (20 fixed cities — but navigates away, see above)
- Min discount: 20/30/40%+ (default 20)
- Min stars: 3/4/5
- Max price: $100/$150/$200/$300
- Sort: newest | biggest discount
- NL search bar → can set city, max_price, min_stars, min_discount, date_from, date_to (`lib/ai/dealSearchFilters.ts`)

### Supported by API + DB but missing from direct-manipulation UI
- **Date range** (`date_from`, `date_to` on `check_in_date`) — biggest gap
- Nothing else; the API surface (`min_discount`, `max_price_cents`, `min_stars`, `date_from`, `date_to`, `city`/`market_id`, `sort`) is fully wired end-to-end.

### In the deal row but unused for filtering/sorting
- `deal_price_cents` — supports **price sort** (only max-price filter today)
- `nights` — currently always 2 (hardcoded in detection), not worth filtering yet
- `first_seen` — could support a "new today" facet later

### NOT technically available (do not spec these)
- Guest review scores (Booking's #1 filter) — schema has `stars` only
- Amenities, property type, free cancellation, location/distance — not captured by the snapshot pipeline
- Result totals: the API's `total` is the **page** length, not the filtered count (`app/api/deals/route.ts:141`), so "N deals found" feedback needs an API change (DEV scope).

### Reference patterns (to be validated in UXR)
- **Booking.com** surfaces first: budget per night, star rating, review score, then property type/cancellation. Sort defaults to picks, with "Price (lowest first)" one tap away.
- **Google Hotels** surfaces first: a price cap ("Under $X"), guest rating, hotel class, and inline date controls that reflow results instantly; every filter is reflected in the URL.
- Delta at pattern level: both competitors treat **price, quality tier, and dates** as the always-visible trio, keep the user **in place** when filtering, show a **result count** as feedback, and keep state **in the URL**. expaify currently violates all four.

---

## 4. Measurable signals that the problem exists

1. **Dead controls on first paint (premium):** on a server-rendered `/deals` load as a premium user, every filter control has `disabled` set and the premium upsell notice renders. Reproducible from code: `premium` initializes `false` and no client fetch runs when `initialDeals` is present (`DealFeed.tsx:211-266`).
2. **No date filter control exists in the DOM** despite full backend support — grep `date_from` in `DealFeed.tsx`: it appears only as pass-through state, never as an input.
3. **Filter → navigation mismatch:** selecting any mapped city in the Destination pill fires `router.push`, observable as a full route change and loss of other active filters.
4. **State loss:** apply any filter, refresh — the feed resets to defaults. No filter params ever appear in the URL.
5. **Scannability:** no result count is shown after filtering, and no price sort exists, so relevance-seeking requires exhaustive scrolling — the giving-up behavior described in the ticket.

---

## 5. Constraints the solution must respect

1. **Business/paywall integrity:** filtering and sorting are a deliberate Premium feature; the server ignores filter params for free users and locks deals by unlock-set membership, never page position. The fix must not open a bypass — but it must also make the *premium* experience actually work, and should let free users *see* what filters exist (disabled state with clear affordance) rather than a mystery.
2. **Brand/design system:** reuse existing tokens and patterns (`--primary`, `--radius-pill`, pill/popover idiom in `DealFeed.tsx`); usable at 375 px mobile and 1280 px desktop; no layout shift when pills activate; accessibility parity with the existing popover (Escape, focus return, `menuitemradio`).
3. **Data integrity:** money stays `{ priceCents, currency }`; all filtering happens server-side via `getActiveDeals` params (no client-side filtering of paywalled data, which could leak locked prices); dates are `YYYY-MM-DD` against `check_in_date`; do not spec filters the schema cannot answer (review scores, amenities).

## 6. Minimum filter set for a destination-minded user (recommendation for UXR)

In priority order: **(1) destination that filters in place** (with an explicit "see city page" link instead of hijacking the selection), **(2) date-range control** (two date inputs or a lightweight range picker on `check_in_date`), **(3) max price** (exists — keep), **(4) price sort (low→high)** added to the sort group, **(5) stars and min-discount** (exist — keep). Plus two feedback mechanics: a real result count and URL-persisted filter state. Guest rating and amenities are out of scope until the data exists.

## 7. Success statement

This is solved when a premium user landing on `/deals` can, on the first page load without any workaround, narrow the feed to "Miami, under $200, checking in Aug 20–31" using visible controls, see the filtered results with a count in place without being navigated away, refresh or share the URL without losing that state — and a free user can see exactly which filters Premium unlocks instead of encountering silently dead controls.

---

## Handoff

Next stage: **UXR-DEAL-SEARCH-FILTER-01** — audit `DealFeed.tsx`/`SearchBar.tsx` interaction patterns against Booking.com and Google Hotels at the pattern level, validate the reference claims in §3, and produce testable design directives covering: premium-flag initialization on server-rendered loads, in-place destination filtering, date-range control, price sort, result count, and URL state persistence.

**Out-of-scope findings for the repair backlog (not this feature):**
- `app/api/deals/route.ts:141` — `total` reports page length, not filtered count (misleading API contract).
- `DealFeed.tsx` premium-flag dead-controls bug is arguably a P0 repair on its own even if this feature is deprioritized.
