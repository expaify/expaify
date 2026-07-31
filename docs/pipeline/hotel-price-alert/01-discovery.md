# UX Discovery: Hotel Saved-Search Price Alerts

**Ticket:** UXD-HOTEL-PRICE-ALERT-01 · **Stage:** UXD · **Date:** 2026-07-31
**Feature slug:** `hotel-price-alert`
**Surfaces audited (read, not assumed):** `app/page.tsx`, `app/deals/page.tsx`, `app/deals/DealFeed.tsx`, `app/deals/[dealId]/page.tsx`, `app/components/AlertSignup.tsx`, `app/components/WatchCityCta.tsx`, `app/components/HotelDealCriteria.tsx`, `app/api/alerts/route.ts`, `app/api/alerts/digest/route.ts`, `lib/email/sendDailyDigest.ts`, `lib/hotels/searchCriteria.ts`, `lib/analytics.ts`, `lib/db/schema.sql`

---

## Problem statement

A hotel shopper who has done the expensive work of narrowing a search — city, dates, and filters — has no way to be told when the price of that search changes, so the only way to find out is to re-run the identical search by hand, and the cost of that manual re-check is what silently ends the trip-planning session.

## Who is affected, and where in the flow

Hotel shoppers in the **days-to-weeks window between deciding to travel and booking** — the period where price movement is the whole reason to wait. Three concrete moments, all verified in code:

1. **Results — `/deals`.** `DealFeed` supports a real, structured search: city, `date_from`/`date_to`, occupancy, plus a view state of `min_discount` / `max_price_cents` / `min_stars` / `sort` (`lib/hotels/searchCriteria.ts:200-277`). The user can construct a precise search — and there is **no control anywhere on the feed to save it or be notified about it**. The only outcomes are click a card, or leave.
2. **Detail — `/deals/[dealId]`.** Renders the handoff (`HotelDealCriteriaHandoff`, `app/deals/[dealId]/page.tsx:423`) with OTA links. A shopper who decides "good, but I'll watch it" has nothing to click. Leaving the page is the only expression of "not yet."
3. **Return session — nothing carries over.** There is no saved-search persistence of any kind: `grep -ril "savedSearch|saved_search"` across `app/` and `lib/` returns zero hits, and no table in `lib/db/schema.sql` stores a hotel search. The returning shopper re-types city, re-picks dates, and re-applies filters, then re-scans the feed to work out — from memory — whether anything moved.

The pain is not "I want alerts." It is: **the price is the reason to return, and the product makes the user compute the delta themselves, from memory, after rebuilding the search.**

## Measurable signals that the problem exists

Every signal below is a code fact, not an inference. Note that signals 1–3 are all *structurally zero* — the paths do not exist — which is itself the finding: this is not an underperforming feature, it is an absent one.

| # | Signal | Verified state |
|---|--------|----------------|
| 1 | **Saved-search creation rate** | Structurally 0. No table, no route, no client storage, no control. |
| 2 | **Hotel alert opt-in rate** | Structurally 0. `app/components/AlertSignup.tsx` is **dead code — it has no callers** (`grep -rn "AlertSignup"` matches only its own definition). Even if mounted, `POST /api/alerts` rejects any request without a 3-letter IATA `origin` *and* `destination` (`app/api/alerts/route.ts:58-64`), so the nullable `price_alerts.hotel_id` column (`lib/db/schema.sql:51`) can never be populated by a hotel-only search. **The hotel alert path is closed at the API layer.** |
| 3 | **Return-to-booking conversion** | Currently unmeasurable. The analytics session id lives in `sessionStorage` (`lib/analytics.ts:3`, `SESSION_KEY`), so an anonymous shopper returning tomorrow is a brand-new session with no link to the earlier search. Cross-session return attribution must be built before this metric can exist. |
| 4 | **Promise/delivery gap (trust)** | `app/page.tsx:12` tells every visitor: *"We track 20 destinations daily and alert you the moment a hotel drops 30% below its normal price."* What ships is (a) **premium-only** — `runDailyDigest` selects only `status IN ('trialing','active')` (`lib/email/sendDailyDigest.ts:36-40`); (b) **city-level, not search-level** — `subscriptions.watchlist` is up to 10 city slugs (`lib/db/schema.sql:212`, `WatchCityCta.tsx`), carrying no dates, occupancy, or filters; and (c) **once daily at 9am local**, not "the moment" (`sendDailyDigest.ts:41`). |
| 5 | **Detection ceiling** | `price_snapshots` is unique per `(hotel_id, market_id, check_in, snapshot_date)` (`lib/db/schema.sql:118`) — one price point per hotel/date per day. Real-time change detection is not available from this data layer at any effort level. |

**The sharpest single number to instrument first:** the share of hotel search sessions that end with no card click and no return within 14 days. That is today's silent-abandonment rate, and it is the number a saved-search alert has to move.

## Constraints the solution must respect

1. **Hotels only, and email-only as the channel.** The only delivery mechanism in the codebase is Resend (`lib/email/`). There is no web-push registration, no service worker, no SMS. Permission-aware here means reusing the **existing** consent model — `subscriptions.alert_preference` (`instant|daily|off`), `alert_min_discount`, `alert_timezone`, and the `alert_unsubscribe_token` one-click unsubscribe (`lib/db/schema.sql:211-224`) — not inventing a second, competing notification setting. A user who set `alert_preference='off'` must not receive a saved-search email.
2. **Material changes only, and honest about cadence.** Given the one-snapshot-per-day ceiling (signal 5), the MVP cannot and must not promise immediacy. Copy must describe a **daily check**, and a change must clear a materiality threshold — a shopper who gets emailed about a $3 move unsubscribes and is gone permanently. The threshold is a design decision UXR must pin down against reference behaviour, not a number invented here.
3. **Data integrity and the money contract.** Every price in a saved search, an alert record, and an email body is `{ priceCents: number; currency: string }` integer minor units. The alert must state the *same* price the feed states for the *same* criteria, or the alert destroys the trust it exists to build. Any new provider or storage path returns `Result<T>` and never throws.

*Additional binding constraint carried from the existing contract:* the alert email's outbound hotel links are deeplinks and must carry affiliate markers, exactly as the feed's OTA links do.

## Success statement

**This is solved when a first-time hotel shopper can save the search they just built — city, dates, and filters — and be emailed only when its price moves materially, without re-entering a single search field, without receiving noise below the threshold they agreed to, and without ever being told a price the feed would not confirm.**

## What UXR must validate (the ticket's "validated trigger and value proposition")

This discovery establishes that the capability is absent and that the trust gap in signal 4 is real. It deliberately does **not** decide the following — these are the research questions for `UXR-HOTEL-PRICE-ALERT-01`:

- **Trigger definition.** What counts as "material"? A percentage drop, an absolute cents drop, a change in Deal Score verdict, or cheapest-in-set changing hotel? Reference behaviour (Booking.com price-drop email, Google Hotels price tracking) should be compared at the level of *what event fires the send*, not visual style.
- **Value proposition wording.** Is the promise "we'll tell you when it gets cheaper" or "we'll tell you when to stop waiting"? These imply different triggers and different emails.
- **Gating.** Alerts today are premium-only. Whether a saved-search alert is free, capped-free, or premium is a product decision UXR must surface explicitly rather than inherit by accident from `sendDailyDigest`'s subscription filter.
- **Identity for anonymous shoppers.** Saving a search requires an identifier. Email-on-save vs. sign-in-to-save is the single largest friction decision in this feature and needs a recommendation.
- **Reconciling the landing-page promise.** Either the feature grows to match `app/page.tsx:12`, or that copy is corrected. Shipping the feature without resolving this leaves the trust gap in place.

## Scope boundaries and conflicts to report

- **"Shortlist" in the ticket description does not exist as a surface.** There is no saved-hotels feature: `docs/pipeline/hotel-shortlist-share/` stopped at research (01 + 02 only, no design, no implementation) and its discovery independently verified zero persistence on this flow. This discovery therefore scopes to the **saved search (a criteria set)**, not saved hotels. If per-hotel watching is wanted, it depends on shortlist work that has not shipped and must be sequenced after it — it is not a rename of this feature.
- **`price_alerts` is flight-shaped and cannot be reused as-is.** Origin + destination IATA are `NOT NULL` and API-validated (`schema.sql:47-48`, `route.ts:58-64`); the `hotel_id` column is a bolt-on that no code path can populate. A hotel saved search keys on city + date window + occupancy + filters, for which `lib/hotels/searchCriteria.ts` already provides a versioned, serializable contract (`HotelSearchCriteriaV1` + `criteriaVersion`) — that is the natural key, and reusing it avoids inventing a second criteria format.
- **`AlertSignup.tsx` is dead code.** Any downstream stage that "wires up the existing alert component" would be shipping the flight-only contract onto a hotel surface. Flagged so UXDES/UI do not treat it as a starting point.
- **No code was changed by this stage.** Discovery produces documentation only.

## Handoff

`UXR-HOTEL-PRICE-ALERT-01` — UX Research, per the pipeline contract.
