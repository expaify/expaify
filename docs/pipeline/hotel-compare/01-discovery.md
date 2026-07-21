# UX Discovery: Hotel Comparison Shortlist

**Ticket:** UXD-HOTEL-COMPARE-01 · **Stage:** UXD · **Date:** 2026-07-21
**Feature slug:** `hotel-compare`

---

## Problem statement

A traveler weighing two to four hotel deals has no way to hold them side by side — every comparison happens in their head, by scrolling back and forth between deal cards (or tab-switching to a deal detail page and back), re-reading price, stars, and Deal Score from memory each time, which makes the deal grid feel harder to trust the longer someone actually shops it.

## Who is affected, and where in the flow

Anonymous and signed-in visitors, at two points in the real (not aspirational) product surface:

1. **`/deals` feed** (`DealFeed.tsx`) — the actual hotel results grid. A visitor filtering by city/discount/stars/price scans a paginated `DealCard` grid; nothing lets them mark a card as "keep this one" without leaving the grid.
2. **`/deals/[dealId]` detail page** — reached by clicking a card. Going back to compare a second hotel means browser-back or re-navigating `/deals`, losing scroll position and any open filters.

There is no third "return visit" surface today — see Correction below.

## Correction to the ticket framing

The ticket describes comparing hotels "across price, location, rating, amenities, and cancellation terms" and asks the solution to "reuse existing watchlist concepts." Neither matches the current code, and downstream stages need the real constraints, not the assumed ones:

- **No amenities data exists anywhere.** `HotelOffer` (`lib/types.ts:137-151`) and the `deals`/`snapshots` schema (`lib/db/schema.sql`) carry no amenity field. The word "amenities" appears exactly once in the repo, as a term the AI headline generator is told *not* to mention (`lib/ai/generateHeadline.ts:120`). A comparison view cannot show amenities that were never fetched.
- **No cancellation-terms data exists either.** The deal detail page states outright that "taxes, fees, cancellation policy, and final total are confirmed by the provider" (`app/deals/[dealId]/page.tsx:332`) — expaify explicitly defers this to the OTA at handoff. There is no `cancellation` field in `HotelOffer` or the deal schema.
- **Comparable attributes that actually exist:** nightly price vs. median (`dealPriceCents`/`medianPriceCents`), discount %, star rating / hotel class evidence, guest rating evidence (with confidence tier), city/area + optional distance (`HotelLocation`), Deal Score verdict/confidence, and price-check recency (`snapshotCount`, `updatedAt`). Scope the shortlist to these.
- **"Watchlist" is not a per-hotel save feature — it's a per-city alert list.** Confirmed in `docs/pipeline/watchlist-ux/01-discovery.md` and in `app/api/account/watchlist/route.ts`: `subscriptions.watchlist` is a premium member's list of up to 10 *tracked cities*, gating email alert delivery. There is no per-deal bookmark/save table anywhere in the schema. "Reuse existing watchlist concepts" cannot mean writing shortlisted hotels into that column — the shapes are incompatible (city string vs. hotel/deal id) and the gate is different (premium-only vs. this should work for anyone comparing deals). The constraint should instead read: **do not let this feature touch `alert_preference`, `alert_min_discount`, or the `watchlist` array, and do not require premium status to use it.**
- **The `HotelCard` component described in `AGENTS.md`'s file map is dead code.** It renders full quality-evidence panels, location detail, and a "Details" expander, but nothing in `app/` imports it outside its own test file (`app/components/__tests__/scorePresentation.test.tsx`). The live hotel-results UI is `DealCard.tsx` inside `DealFeed.tsx`, which is visually and structurally simpler (no expandable details, no quality-evidence panel). UXR/UXDES should decide against `DealCard`, the surface that's actually shipped — not against `HotelCard`.
- **No per-user persistence mechanism exists for saved items.** The only client-side persistence precedent in the app is a transient `sessionStorage` draft in onboarding (`app/onboarding/OnboardingClient.tsx`), cleared once submitted. There is no bookmarks/saved-deals table, no anonymous-id cookie pattern. A shortlist that must survive a "return visit" (the ticket's phrase) implies persistence beyond a single tab session — that's a real open question for UXR, not something to assume is trivial.

## Measurable signal that the problem exists

- No comparison affordance exists on `DealCard` or the deal grid today (verified: no checkbox, no "add to compare," no selection state in `DealFeed.tsx`), so there is currently zero click-path to compare — the signal is the absence of the feature, not a broken existing one.
- Proxy for adoption once built: rate of sessions with ≥2 cards shortlisted, and return-to-`/deals` sessions that re-open a shortlist versus starting a fresh scroll-and-scan pass.
- Reduced back-and-forth is measurable as fewer `/deals/[dealId]` → back → `/deals/[dealId]` sequences within a session once a shortlist/compare view exists.

## Constraints the solution must respect

1. **Data honesty:** compare only attributes expaify actually has evidence for (price, discount %, stars/hotel class, guest rating + confidence, location/area, Deal Score, recency). Never imply amenity or cancellation-policy comparison — that data doesn't exist and can't be fabricated.
2. **Scope discipline:** 2–4 hotels, one shortlist, no persistence infrastructure beyond what's needed to survive a page reload/return visit within a reasonable window (exact mechanism is a UXR/UXDES decision, not this stage's). No itinerary builder, no multi-trip organizer, no date/room configuration.
3. **Watchlist independence:** must not read, write, or gate on `subscriptions.watchlist`, `alert_preference`, or `alert_min_discount`, and must not require `isPremium`. This is a distinct, lighter-weight concept from the alert watchlist and should not be presented as the same feature.
4. **Layout integrity:** fits the existing `DealCard`/`DealFeed` grid at 375px and 1280px without harming scanability (per repo-wide UI constraint) — a comparison tray or bar must not push results off-screen or add clutter to every card by default.

## Success statement

This is solved when a first-time visitor on `/deals` can mark 2–4 hotels while scrolling, then see their price, discount, stars/hotel class, guest rating, location, and Deal Score side by side in one view — without losing their filters, without re-reading each card from scratch, and without the feature being confused with (or gated by) the premium city-alert watchlist.

---

**Next stage:** UXR — audit `DealFeed.tsx` / `DealCard.tsx` / `/deals/[dealId]` against reference patterns (e.g., Google Flights price-comparison tray, Booking.com "Compare properties"), and produce testable directives covering shortlist add/remove interaction, the compare view's attribute layout, and a recommendation on persistence mechanism (session-only vs. longer-lived) with its tradeoffs.
