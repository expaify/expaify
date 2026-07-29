# UX Discovery: Hotel Comparison Decision Support

**Ticket:** UXD-HOTEL-COMPARISON-DECISION-01 · **Stage:** UXD · **Priority:** P1 · **Date:** 2026-07-29
**Feature slug:** `hotel-comparison-decision`
**Surfaces audited:** `app/deals/DealFeed.tsx`, `app/components/ui/DealCard.tsx`, `app/components/ui/CompareRow.tsx`, `app/deals/[dealId]/page.tsx`, `app/components/HotelDecisionAnalytics.tsx`, `app/api/analytics/route.ts`, `lib/db/schema.sql`, `app/components/HotelCard.tsx`

---

## Problem statement

A traveler who has narrowed the feed to two or three plausible hotels must commit to one of them by memory — the only way to put two offers next to each other is to open one detail page, go back, and open the other, so the comparison itself is never on screen and the decision gets made on whichever card was viewed most recently rather than on the attributes that differ.

## Who is affected, and where in the flow

Anonymous visitors and signed-in members equally — this pain is not paywalled. It bites at exactly one moment, after the shopper has stopped scanning and started deciding:

1. **`/deals` feed (`DealFeed.tsx` → `DealCard`).** The shipped card carries the full decision set for a first pass: hotel name, star chars, city, check-in window, nightly price, struck-through median ("usually $X"), discount chip, savings line when ≥ $20/night, optional AI headline, "Price checked <relative>", and "Based on N price checks over 60 days" (`DealCard.tsx:60-133`). Every one of those is present per card, but each card is a separate visual block in a responsive grid — at 375px only one card is legible at a time, so two candidates are never simultaneously readable even though all the data is already rendered.
2. **`/deals/[dealId]` detail page.** Reached through the card's single `<a>` wrapper (`DealCard.tsx:139-149`). The detail page adds attributes the feed does not have: a server-computed Deal Score via `scoreDeal` rendered in `DealScorePanel` (`[dealId]/page.tsx:223-228, 393`), verified-guest-rating state, and price-freshness state (all three are already tracked as `score_state`, `has_verified_guest_rating`, `price_freshness_state` on `hotel_detail_viewed`). Comparing two hotels on Deal Score — expaify's differentiator — therefore *requires* two page loads and a back navigation. There is a `backHref` that preserves criteria and results view (`[dealId]/page.tsx:252`), so the loop is survivable, but it is still a loop.
3. **There is no third surface.** No selection control, no tray, no side-by-side view exists anywhere. Verified: the only interactive elements on `DealCard` are the card link and the OTA links; `DealFeed.tsx` has no selection state.

## Scope boundary — read this before writing UXR

This problem area is crowded. Four adjacent pipelines already exist, and this ticket is only defensible as the narrow slice none of them own. **The narrow slice is: comparison of offers the shopper is looking at right now, with zero retention and zero selection accumulation.**

| Prior pipeline | What it owns | Relationship |
|---|---|---|
| `docs/pipeline/hotel-compare/` (01, 02 — **stalled, no design, nothing shipped**) | Marking 2–4 deals via a per-card toggle into a persistent non-modal tray, then a side-by-side compare view | **Direct overlap. This ticket must be treated as the narrowed successor, not a parallel effort** — see conflict note below |
| `docs/pipeline/hotel-shortlist-share/` (01, 02) | Retention across reload/tab-close/next-day, and handing a candidate set to a travel companion | **Excluded here.** Explicitly out of scope per this ticket |
| `docs/pipeline/hotel-sort-control/` (01, 02, 03) | Ordering the feed — `recently_found`, `biggest_discount`, `lowest_nightly_price` | **Excluded.** Sorting reveals the best on one axis; it cannot show why two offers differ |
| `docs/pipeline/deals-feed-filter-friction/`, `hotel-filter-recovery/` | Narrowing the result set (discount / stars / max price chips) | **Excluded.** Filtering gets the shopper to 2–3 candidates; this ticket starts there |

### Conflict flagged: `hotel-compare` is the same user problem

Per the briefing's "stop and report the conflict" rule, I am flagging rather than silently duplicating. `docs/pipeline/hotel-compare/01-discovery.md` states the same pain ("no way to hold them side by side"). It reached research and stopped — there is no `03-design.md` and no selection code in `DealFeed.tsx`. This ticket's framing differs in one material way that makes it worth running: **`hotel-compare` scoped a shortlist (selection + a persistent accumulator + a persistence-mechanism decision UXR was told to recommend from scratch), whereas this ticket scopes an aid for "currently viewed offers" with no persistence at all.** That is a genuinely smaller, shippable slice — and `hotel-shortlist-share` has since claimed the retention half, which removes the reason `hotel-compare` needed to solve persistence.

**Recommendation for the board:** treat `hotel-compare` as superseded by this pipeline plus `hotel-shortlist-share`, and do not open a `UXDES-HOTEL-COMPARE-01`. If the board disagrees, this ticket should be closed as a duplicate instead — one of the two must stop. UXR must not re-litigate `hotel-compare`'s verified findings, which are inherited below.

### Inherited verified findings (do not re-derive, do re-verify before citing)

- **`ApiDeal` / the feed contract carries five comparable attributes only:** nightly price (+ median + derived savings), discount %, star class, city-level area, and price-check recency (+ `snapshotCount`). Re-confirmed against `DealCard.tsx:17-34`.
- **Deal Score and guest rating are not on the feed contract.** Both are computed or resolved on the detail page. Any feed-level comparison that promises a Deal Score column needs a DEV ticket first.
- **No amenity and no cancellation-policy data exists** in `HotelOffer` or the schema; the detail page defers taxes, fees, cancellation policy, and final total to the provider. A comparison surface must not imply these are comparable.
- **`subscriptions.watchlist` is a premium list of tracked cities for email alerts**, not saved deals. This work must not read, write, or gate on it, `alert_preference`, or `alert_min_discount`, and must not require `isPremium`.
- **`app/components/HotelCard.tsx` (1079 lines) is dead code** — re-verified: its only importers are its own tests and `HotelRateRestrictions.tsx`, which is itself reached only via `HotelCard` and `app/book/BookingFlow.tsx`. No `app/` route renders `HotelCard`. All directives must target `DealCard` / `DealFeed` / `[dealId]/page.tsx`.
- **"Compare" is already a taken word in this UI.** `CompareRow` (`app/components/ui/CompareRow.tsx`) renders "Compare and book on:" with Expedia / Booking / Kiwi / Trip.com deeplinks on every unlinked card, and "Provider options" on the detail page. It means *compare this one hotel's price across OTAs*. Any new hotel-vs-hotel affordance that also says "Compare" will collide with it in the same viewport. **This is a copy constraint, and it is the single most likely source of user confusion in this feature.**

## Measurable signal that the problem exists

The absence of a comparison affordance is verifiable by code reading, so the signal is not "is the feature broken" — it is **how much back-and-forth shoppers currently do**, which is measurable *today, with no instrumentation work*. `product_analytics_events` stores `event_name`, `analytics_session_id`, `properties` JSONB, and `occurred_at`, indexed on `(session_id, occurred_at)` — enough to reconstruct per-session sequences. The relevant allowlisted events already ship (`app/api/analytics/route.ts:14-30`):

| Event | Properties this plan uses |
|---|---|
| `hotel_results_viewed` | `result_state`, `criteria_version` |
| `hotel_result_card_opened` | `card_position`, `loaded_result_count`, `filter_state`, `current_sort`, `viewport_band` |
| `hotel_detail_viewed` | `deal_id`, `hotel_id`, `entry_source`, `viewport_group`, `score_state`, `has_verified_guest_rating`, `price_freshness_state` |
| `hotel_detail_back_to_results` | `hotel_id`, `entry_source` |
| `hotel_provider_handoff_clicked` | `provider`, `deal_id`, `context_status` |

**Baseline metrics to pull before any design work (all three are queryable now):**

1. **Return-to-feed loop rate.** Share of sessions containing ≥ 2 `hotel_detail_back_to_results` events. A session that bounces back twice or more is a session doing comparison by navigation.
2. **Detail-page switching depth.** Per session, the count of `hotel_detail_viewed` events with **distinct `hotel_id`** values, bucketed 1 / 2–3 / 4+. The 2–3 bucket is this feature's target population; its size is the business case. Also record the count of *repeat* views of an already-seen `hotel_id` in the same session — a re-view is direct evidence of a memory failure, because the shopper had already seen that page and went back for the numbers.
3. **Decision-confidence proxy.** Since no explicit confidence signal exists, use: among sessions with ≥ 2 distinct `hotel_detail_viewed`, the rate that end in a `hotel_provider_handoff_clicked`, versus the same rate for single-detail sessions. If multi-candidate sessions hand off *less often*, the comparison loop is costing decisions, not just clicks. Segment by `viewport_group` — the 375px case should be measurably worse, since only one card is legible at a time there.

**Deliberately not proposed:** any new event, property, or table. Adding to the allowlist is a DEV change and should be specified by UXDES once the interaction exists, not guessed now. Note for UXDES: `hotel_result_card_opened` does **not** carry `deal_id` or `hotel_id`, so feed-side attribution of a comparison action will need one added property — call that out in the design spec so DEV can allowlist it in one pass.

## Constraints the solution must respect

1. **Data honesty.** Compare only what expaify actually has, per surface. On the feed that is price/median/savings, discount %, star class, city, and price-check recency + depth. Deal Score, verified guest rating, and price-freshness state exist **only on the detail page** — a feed-level comparison cannot show them without a DEV ticket, and must not render an empty or implied cell for them. Never present amenities, cancellation terms, taxes, fees, or final total as comparable; that data does not exist and the product explicitly defers it to the provider at handoff.
2. **Copy and layout must not collide with `CompareRow`.** The word "Compare" already means OTA price-shopping for one hotel, and `CompareRow` renders inside cards and full-width on the detail page. A hotel-vs-hotel affordance needs distinct copy and must not sit adjacent to a `CompareRow` in a way that reads as one control group.
3. **No new persistence, no premium gate, no accumulator.** In-context means in-context: nothing written to `localStorage`, `sessionStorage`, a cookie, or a table; nothing that survives a reload; nothing that reads or writes `subscriptions.watchlist`, `alert_preference`, `alert_min_discount`, or `isPremium`. Retention belongs to `hotel-shortlist-share`.
4. **Layout integrity at 375px and 1280px.** Must not push results off-screen, must not add default clutter to every card, and must not regress the feed's scanability, the sort control, the filter chips, or the paywalled/locked and `isMock` ("Example", "Sample hotel — not bookable") and `expired` card states — all of which already have defined treatments in `DealCard`.

## Success statement

This is solved when a first-time visitor who has narrowed `/deals` to two or three candidates can see how those specific offers differ on the attributes expaify actually holds — in one view, at 375px and 1280px — without opening a detail page, without a back-navigation loop, without anything to save or set up first, and without confusing the affordance with the per-hotel OTA "Compare and book on" row.

---

## Handoff

**Next ticket:** `UXR-HOTEL-COMPARISON-DECISION-01`

UXR should:
- Re-verify the inherited findings above against current code before citing them (they were established on 2026-07-21 and 2026-07-29 respectively; `DealFeed.tsx` is 2014 lines and moves fast).
- Read `hotel-compare/02-research.md` §8 directives 1 and 2 and state explicitly which survive the no-persistence, no-accumulator narrowing and which do not.
- Decide the surface question this stage deliberately left open: does the aid live on the feed (where only five attributes exist, no Deal Score) or on the detail page (where the full attribute set exists but the shopper has already committed to one page)? This is the central trade-off and it needs evidence, not preference.
- Compare against interaction patterns, not visual style: Booking.com's "Compare properties" bar and Google Flights' fare-comparison behaviour are the reference points named by prior research.
- Produce 3–5 testable directives, and state for each whether it requires a DEV ticket (new `ApiDeal` field or new analytics property) or is UI-only.

---

## Out-of-scope findings (reported, not fixed)

1. **`lib/db/schema.sql` contains unresolved merge-conflict markers, committed.** Lines 272 (`<<<<<<< HEAD`), 395 (`=======`), and 408 (`>>>>>>> agent/DEV-HOTEL-SMOKING-POLICY-01`). The working tree is clean, so this is committed on `main`'s history — the file is not valid SQL and would fail to apply as-is. The conflicting region spans the `analytics_events` and `product_analytics_events` table definitions, which is precisely the infrastructure this discovery's measurement plan depends on. Needs its own P0 repair ticket; I did not touch it, per the stay-in-ticket rule.
2. **`app/components/HotelCard.tsx` is 1079 lines of dead code** carrying quality-evidence, location, pet-policy, access-evidence, and rate-restriction panels that no route renders, and it is still listed as the live hotel result card in `AGENTS.md`'s file map. Third pipeline stage to independently rediscover this. Worth either a deletion ticket or a file-map correction.
