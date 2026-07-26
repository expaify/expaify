# UXD-DATE-FLEX-SAVINGS-01 — Discovery: Flexible Date Savings

Stage: UX Discovery · Priority: P0 · Surface: hotel deal discovery, deal detail price context, date selection refinement

## User Pain Point

A date-flexible traveler who lands on a hotel with an expensive or unbookable exact-date price is given no signal that a nearby check-in window is cheaper, so they abandon a deal that expaify already has the data to save them on.

## Who Is Affected And Where In The Flow

**Who:** Travelers whose trip dates can flex by a few days — the exact audience expaify's "cheapest acceptable window" promise is for. They are not locked to one date; they are locked to one *screen* that only shows one date.

**Where the break happens:**

1. **Deal feed / discovery (`app/deals/DealFeed.tsx`, `app/components/ui/DealCard.tsx`).** Each card shows a single `checkInWindow` (e.g. "Mar 12 – 14") and one `dealPrice` vs `medianPrice`. The same hotel can — and does — exist as separate deal rows at other check-in dates, but the card never says "cheaper 2 nights later." The user sees a fixed date and a fixed price with no flex context.

2. **Deal detail price context (`app/deals/[dealId]/page.tsx`).** The detail page renders one check-in/check-out pair and a "60-day price history" sparkline. That sparkline is a time series of *when the price was captured*, not a comparison *across nearby check-in dates*. A user reading it cannot answer "is a different arrival day cheaper for the same trip?"

3. **Date selection refinement.** There is no lightweight control to shift the window. The only date affordances are the feed's `dateFrom`/`dateTo` filter (all-hotels range filter, not a per-hotel nearby comparison) and the OTA deeplink, which throws the user to a third-party site to re-shop dates manually.

The highest-risk moment is when the exact-date price is expensive relative to nearby dates, or when the price/booking link is unavailable (`PriceUnavailable` in `app/components/HotelCard.tsx`, `LockedDealDetail` fallback). Today that moment is a dead end. The traveler has no reason to believe a cheaper acceptable date exists, so they leave.

## The Data Already Exists (Why This Is Repair, Not A New Feature)

This is a surfacing gap, not a data gap:

- `price_snapshots` (schema.sql) stores `hotel_id`, `check_in DATE`, `nights`, `price_cents` per snapshot. Neighboring check-in dates for the same hotel are already captured nightly.
- `deals` is uniquely keyed on `(hotel_id, market_id, check_in_date)`, so one hotel legitimately produces multiple deal rows across adjacent check-in dates — each with its own `deal_price_cents`, `median_price_cents`, and `discount_pct`.
- `detectDealsForMarket` (`lib/pipeline/dealDetection.ts`) already groups snapshots `GROUP BY hotel_id, ..., check_in`, so per-check-in price is computed on every run.
- `getActiveDeals` returns those rows flat, ordered by discount or recency, with **no grouping by hotel**. The nearby-date relationship between rows for the same hotel is computed and then discarded at the presentation layer.

So the cheapest-nearby-window answer is derivable from data expaify already holds. The MVP is a read-side aggregation and a compact display — not new providers, not new scraping, not a rebuilt search.

## Measurable Signal That The Problem Exists

- **Fragmented duplicates in the feed:** `getActiveDeals` can return several rows for the same `hotel_id` at different `check_in_date`s with no relationship shown; the user must eyeball-diff cards to notice a cheaper date, and cannot when the cheaper date sits on a later feed page.
- **Single-date price context:** `DealCard` and `app/deals/[dealId]/page.tsx` expose exactly one check-in window; there is no rendered ±N-day price comparison anywhere in the codebase (confirmed by absence of any nearby-date price component under `app/components/` and `app/components/ui/`).
- **Dead-end unavailable states:** `PriceUnavailable` / `getUnavailableReason` (`app/components/HotelCard.tsx`) and the locked/expired detail states offer no "try a nearby date" recovery path — the only exits are "Booking unavailable" and back.
- **Abandonment after weak exact-date result:** when no strong exact-date deal is present, the surface gives the flexible user nothing to act on, so they bounce rather than shift dates.

Instrumentation to confirm and later prove the fix (hand to UXR to formalize): nearby-date insight impressions, engagement/expansion on the nearby-date element, outbound OTA clicks attributed to an alternate (non-primary) date, and search/deal-view abandonment rate when the exact-date verdict is `Typical` or the price is unavailable.

## Constraints The Solution Must Respect

1. **No full search rebuild.** MVP is a compact plus/minus check-in insight built from existing `price_snapshots` / `deals` data. Do not add a calendar picker, a new filters surface, or new provider calls. Do not touch API routes or providers unless a DEV stage is explicitly created for a read-side aggregation helper.
2. **Deal Score honesty must hold (non-negotiable contract).** A nearby-date price is only shown when provider-backed snapshot data for that date actually exists; never fabricate a nearby price, never imply a date was checked when it was not, and never let a flexible-date framing upgrade a thin-history verdict (respect existing `confidence: 'low'` handling and the `Great` ≤15th-percentile / min-10-points rule). Money stays `{ priceCents, currency }` integer minor units; savings are computed as integer cent deltas, never floats.
3. **Scan integrity at 375px and 1280px, accessible, affiliate-safe.** The insight must stay a compact, secondary element that does not crowd the primary price, verdict badge, or CTA, and must not add dense calendar clutter to the results scan. It must be keyboard reachable with a visible focus ring and a screen-reader label. Any alternate-date deeplink must carry the same affiliate markers as the primary CTA (`buildHotelBookingHref` / `buildOtaLinks`).

## Success Statement

This is solved when a first-time, date-flexible user viewing a hotel whose exact-date price is expensive or unavailable can, without opening a calendar or rebuilding their search, see that a nearby check-in window is cheaper, see how much it saves and on which dates, and act on that cheaper window in one click — so they identify the cheapest acceptable travel window instead of abandoning.

## Scope Boundaries

- **In scope:** compact ±date savings insight on the deal card and/or deal detail price context; a one-click path to the cheaper nearby window; honest empty/unavailable handling ("no cheaper nearby date found" vs "nearby dates not checked").
- **Out of scope:** flight flexible-date confidence (covered by `flexible-date-deal-confidence`, a separate flights + Deal Score trust concern — do not merge), full date-range calendar UI, new providers or live per-date re-pricing, award travel.

## Handoff

Next stage: **UXR-DATE-FLEX-SAVINGS-01** (UX Research). Research must audit the actual feed/detail/snapshot code paths named above, define the minimum viable date-range display requirements (exactly what fields render, from which existing data, and how "no cheaper nearby date" vs "not checked" are distinguished), and produce testable scenarios for: expensive exact date with a cheaper nearby date, no cheaper nearby date, unavailable exact-date price, and thin-history (`confidence: 'low'`) hotels.
