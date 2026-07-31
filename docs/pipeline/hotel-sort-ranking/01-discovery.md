# UXD-HOTEL-SORT-RANKING-01: Hotel Result Sorting and Ranking Clarity

**Ticket:** UXD-HOTEL-SORT-RANKING-01 · **Stage:** UX Discovery · **Date:** 2026-07-31
**Feature slug:** `hotel-sort-ranking`
**Surface:** `app/deals/DealFeed.tsx` (live hotel results feed at `/deals`)

## Relationship to prior tickets

This ticket is **not** a repeat of `hotel-sort-control`. That ticket shipped: the feed now has a real
labeled sort menu with three options (`app/deals/DealFeed.tsx:52-74`). This ticket picks up the part
that shipping the control did not solve — whether a traveler can **predict and verify what the list
in front of them is ordered by**, especially the default order they never chose. `results-sort-filter`
covers the flight surface and is out of scope here.

## Problem statement

A traveler landing on expaify's hotel feed cannot tell what the default order actually means or verify
that the list obeys it, because the default `Recently found` ranking sorts on a hidden field (`first_seen`)
that appears nowhere on the cards, while the timestamp that *is* on every card is a different field
(`updated_at`, shown as "checked N ago") — so the visible evidence can contradict the stated order and
the first card looks like an unexplained editorial "best" pick rather than the newest find.

## Who is affected and where in the flow

**Affected users:**

- **Free-tier visitors** — the largest affected group. Sorting is Premium-gated
  (`app/api/deals/route.ts:132` forces `sort = 'newest'` for non-Premium). They are *permanently* on the
  default order and cannot test their interpretation by switching. Every misread compounds.
- **First-time visitors** who arrive at `/deals` from marketing copy promising the biggest price drops
  and reasonably assume the top card is the biggest drop or the cheapest.
- **Price-led shoppers** who assume position 1 is cheapest and stop scanning after three or four cards.
- **Returning Premium users** who switch sorts and need to confirm the switch actually took effect on
  a grid where nothing visibly re-labels itself by rank.

**Flow step:** the hotel results grid on `/deals`, after filters resolve and before the first card open
or provider handoff. It also covers the moment immediately after a sort change, when the feed refetches
from `/api/deals` rather than reordering loaded cards (`app/deals/DealFeed.tsx:1046-1108`).

## Current implementation evidence

Read from source, not assumed:

1. **The default order is recency of detection, not value.** `orderBy.newest` is
   `d.first_seen DESC, d.id ASC` (`lib/pipeline/dealDetection.ts:239-243`). Nothing about price,
   discount, or quality participates in the default ranking.
2. **The sorted-on attribute is invisible on the card.** `DealCard` receives `firstSeen` but renders
   `updatedAt` as the visible freshness line — "checked N ago" (`app/components/ui/DealCard.tsx:63,110`).
   A deal first seen yesterday but re-checked an hour ago outranks nothing, yet displays a *fresher*
   timestamp than the card above it. Under the default sort, a user checking the order against the
   visible evidence will conclude the list is wrong.
3. **The order's meaning is buried inside the closed menu.** The plain-language gloss
   "Deals expaify detected most recently" exists only as `option.description`, rendered only when the
   menu is open (`app/deals/DealFeed.tsx:1690-1730`). The always-visible strings are the trigger
   "Sort by: Recently found" and a status line "Sorted by Recently found · N deals loaded"
   (`app/deals/DealFeed.tsx:1746`) — both restate the label without defining it.
4. **The status line reads as metadata, not as an explanation.** It is right-aligned on desktop
   (`sm:text-right`, `sm:pt-6`) and lives in an `aria-live` region — correct for announcing changes,
   wrong as the primary place a first-time user learns what the ranking is.
5. **Only the `price` sort earns a scope caveat.** "Nightly prices before taxes and fees" is appended
   for `appliedSort === 'price'` only (`app/deals/DealFeed.tsx:1747`). `discount` (drop vs. 60-day median)
   and `newest` get no comparable scope sentence, so their basis is unstated.
6. **Free-tier copy states the default three different ways.** "…newest first" in
   `FREE_TIER_STATUS_SENTENCE` (`app/deals/DealFeed.tsx:104`), "sorted by Recently found" in the filter
   explainer (`:1623`), and "currently sorted by Recently found" in the Premium explainer (`:1761`).
   "Newest" and "Recently found" are not obviously the same thing, and neither says *newest what* —
   newest hotel, newest travel date, or newest detection.
7. **Rating and distance data do not exist on this surface.** The deal query selects
   `hotel_name, stars, photo_url, city, deal_price_cents, median_price_cents, discount_pct,
   check_in_window, check_in_date, nights, snapshot_count, ota_links, headline, description, first_seen,
   expires_at, updated_at` (`lib/pipeline/dealDetection.ts:282-289`). There is **no guest rating, no
   review count, no coordinates, and no distance-to-anything**. `stars` is hotel class from the provider,
   not guest satisfaction. `app/components/HotelCard.tsx` has rich guest-rating and location evidence,
   but it is not imported by any live product surface and cannot be treated as available data.

## Measurable signal that the problem exists

- **Comprehension gap (primary).** In moderated first-use at 375px and 1280px, ask before any scrolling:
  "What decides which hotel is at the top of this list?" Record whether the answer matches
  detection-recency. Prior expectation: a majority say "cheapest," "best deal," or "recommended."
- **Contradiction detection.** Show the default list and ask: "Is this list in the order it says it is?"
  Record whether participants cite the "checked N ago" line as evidence the order is broken.
- **Sort-use rate by tier.** `hotel_sort_control_viewed` → `hotel_sort_changed` conversion, split by
  `premium_eligible`. A high `hotel_sort_disabled_attempted` rate on the free tier is an entitlement
  signal; a *near-zero* rate is a discoverability/comprehension signal. Both already emit
  (`app/deals/DealFeed.tsx:1315-1322`).
- **Post-sort card engagement.** `hotel_result_card_opened` already carries `card_position`,
  `current_sort`, `previous_sort`, `sort_transition` (`app/deals/DealFeed.tsx:1349-1359`). Compare
  median opened `card_position` per sort. If position-1 open rate is flat across all three sorts, users
  are anchoring on position rather than reading the ranking.
- **Booking-start conversion by ranking state.** Provider-handoff starts per session, segmented by the
  sort active at handoff and by whether the session ever changed sort.
- **Sort abandonment.** Sessions that open the sort menu and close it without selecting — a menu opened,
  read, and rejected is a taxonomy problem, not a discoverability one.

Analytics must not carry hotel names, provider URLs, or user-identifying destination strings; the
existing bucketed `serializedFilterState()` pattern (`app/deals/DealFeed.tsx:1249-1274`) is the model.

## Constraints the solution must respect

1. **Available attributes only — no rating or distance sort.** The live deal contract has no guest
   rating and no geodata. A "Best rated" or "Closest" option would be a fabricated ranking. If a rating
   or distance taxonomy is wanted, it is a data ticket first, not a UX ticket. `stars` may only be
   labeled as hotel class, never as a rating.
2. **Compact on mobile.** The sort section already occupies a full row above the grid at 375px
   (`app/deals/DealFeed.tsx:1644-1648`). Any added explanation must fit within roughly two lines at
   375px, must not push the first card below the fold, and must not introduce a second competing
   control.
3. **Truthful default naming.** Whatever the default is called, one term must be used everywhere —
   trigger, status line, free-tier sentence, filter explainer, Premium explainer — and it must state the
   basis, not just the name. No "Recommended," "Best," or "Top picks" over a recency sort.
4. **Verifiability over assertion.** A stated order the user can disprove from the card face is worse
   than no statement. The attribute a list is sorted by should be legible on the card, or the ordering
   language must be precise enough that the visible "checked N ago" line cannot be mistaken for it.
5. **No changes to provider calls, money representation, or the deal data contract.** Money stays
   `{ priceCents, currency }`. No new external calls. Sort still round-trips through `/api/deals`;
   this ticket does not relitigate refetch-vs-reorder.
6. **Accessibility parity.** The existing `role="menu"` / `menuitemradio` semantics, roving focus,
   `aria-live` status region, and Premium-locked state must survive unchanged.

## Success statement

This is solved when a first-time traveler on the hotel feed can state, in their own words and before
scrolling, what the list is currently ordered by and what it is *not* ordered by — without assuming
the top card is the cheapest or the biggest discount, and without finding a card timestamp that
appears to contradict the stated order.

---

## Handoff to UXR-HOTEL-SORT-RANKING-01

### Hypotheses to test

- **H1 (default misread).** Given the default feed with no instruction, most first-time users will say
  the top card is there because it is the cheapest, the biggest discount, or "recommended" — not because
  it was found most recently.
- **H2 (invisible-key contradiction).** When a user tries to verify the order, they will use the
  "checked N ago" line, find it non-monotonic, and lose trust in the ranking — even though the ranking
  is correct on `first_seen`. Surfacing the found-date, or renaming the order to match the visible
  timestamp, resolves it; restating the label alone does not.
- **H3 (name vs. basis).** A label plus a one-clause basis ("Recently found — newest expaify detections
  first, not cheapest") produces materially better prediction of the resulting order than the label
  alone, at equal or lower reading cost.
- **H4 (taxonomy ceiling).** Three price/value/recency intents are sufficient for the current data.
  Users asked for a rating or distance sort will accept its absence when told the reason, and will
  reject a `stars`-based "Best rated" as misleading once they learn it is hotel class.
- **H5 (free-tier trust).** For non-Premium users who cannot switch, an honest, specific default
  explanation raises confidence in the list more than the current gated-sort messaging does — the
  problem is not only the gate, it is not knowing what they are looking at.
- **H6 (position anchoring).** Card-open rate at position 1 is roughly constant across all three sorts,
  indicating position-driven rather than ranking-driven selection.

### Target segments

1. Free-tier first-time visitors, mobile 375px — the default-order-only population.
2. Free-tier first-time visitors, desktop 1280px — where the status line is right-aligned and further
   from the grid.
3. Premium users who have changed sort at least once — test verification and switch confidence.
4. Premium users who have never changed sort — test whether the default reads as intentional or as
   "nobody picked anything."
5. Price-led shoppers with a hard nightly budget, and value-led shoppers optimizing drop-vs-usual —
   the two intents the current taxonomy actually serves.

### Instrumentation questions for research to answer

1. What is the current baseline sort-use rate, split by `premium_eligible`, and what share of free-tier
   sessions fire `hotel_sort_disabled_attempted`?
2. Does median opened `card_position` differ across `current_sort` values? If not, is that anchoring or
   genuinely correct top results?
3. Do we need a `hotel_sort_menu_dismissed` event (menu opened, closed with no selection) to separate a
   comprehension failure from a discoverability failure? Currently unmeasurable.
4. Do we need a `hotel_default_ranking_explanation_viewed` / `_expanded` event if the explanation lands
   in a disclosure rather than always-visible copy, and what is the acceptable interaction cost?
5. Booking-start conversion segmented by (a) sort active at handoff and (b) whether the session ever
   changed sort — is the default order under- or over-converting relative to chosen orders?
6. Can `first_seen` be surfaced on the card without displacing the existing "checked N ago" freshness
   signal, and which of the two do users actually want when scanning? This decides whether H2 is fixed
   by copy or requires a card change (which would route through a UI ticket, not DEV).

### Reference patterns to audit against

Booking.com and Google Hotels both name the active order **and** state its basis in persistent copy
adjacent to the first result, and both keep the sorted-on attribute visible on every card
(price sort shows price; rating sort shows the rating; distance sort shows the distance). Audit the
delta at the level of *ranking legibility* — the pairing of stated order with a card-face attribute
that confirms it — not visual style.

### Explicit scope boundaries for UXR

- **Do not** design or specify a rating or distance sort. The data does not exist on this surface.
  If research concludes users need one, write it up as a separate data-layer discovery item.
- **Do not** revisit the Premium gate itself. Its comprehension is in scope; its existence is not.
- **Do not** target `app/components/HotelCard.tsx`. It is unused by the live feed.
