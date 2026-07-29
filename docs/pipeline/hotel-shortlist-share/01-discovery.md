# UX Discovery: Hotel Shortlist Retention & Sharing

**Ticket:** UXD-HOTEL-SHORTLIST-SHARE-01 · **Stage:** UXD · **Date:** 2026-07-29
**Feature slug:** `hotel-shortlist-share`
**Surfaces audited:** `app/deals/page.tsx`, `app/deals/DealFeed.tsx`, `app/components/ui/DealCard.tsx`, `app/deals/[dealId]/page.tsx`, `app/components/ui/ShareButton.tsx`, `lib/paywall.ts`, `lib/db/schema.sql`, `lib/analytics.ts`

---

## Problem statement

A hotel shopper comparing a trip has no place to put a candidate: every hotel they like is held in memory or in a browser tab, so the working set is destroyed by a reload, a closed tab, or coming back tomorrow — and the only way to hand a candidate to the person they are travelling with is to copy one deal URL at a time, one message per hotel, with no indication of what the set was or whether it is still valid.

## Who is affected, and where in the flow

Anonymous visitors and signed-in members alike (this is not a premium-gated pain), at three moments:

1. **Feed — `/deals`.** `DealCard` renders photo, discount chip, name, star/city/window line, price block, OTA `CompareRow`, and a "View deal" affordance. There is **no** save, keep, heart, or select control on the card (verified: the only interactive elements in `DealCard.tsx` are the card link and the OTA links). A shopper who likes card #3 and card #11 has nothing to click.
2. **Detail — `/deals/[dealId]`.** Reached by clicking a card. Offers a back link (`backHref`), a `ShareButton` that copies `window.location.href`, and (for premium members only) a `WatchCityPill` for the *city*. There is no per-hotel retain action. Returning to look at another candidate means browser-back and re-scanning.
3. **Return session — nothing exists.** There is no persistence of any kind on this flow: no saved-items table in `lib/db/schema.sql`, no cookie, no `localStorage`, no `sessionStorage` on `/deals`, `DealFeed.tsx`, or `lib/hotels/searchCriteria.ts`. The only client storage in the whole app is the analytics session id (`expaify.analytics.session.v1`) and a transient onboarding draft. A visitor who returns tomorrow starts from an empty feed with default filters, and their candidates are gone.

**Anonymous vs signed-in behavior today is identical for this job — both have zero retention.** Signing in changes only *what prices are visible* (paywall), not whether anything can be kept.

## Relationship to prior pipeline work (read before duplicating)

`docs/pipeline/hotel-compare/` (01-discovery, 02-research) already covered **side-by-side comparison of 2–4 deals** and stopped at research — no design, no implementation, nothing shipped. Its verified findings are inherited here and must not be re-litigated:

- Only five attributes are on the feed contract (`ApiDeal`): price/night (+ median + savings), discount %, star class, city-level area, price-check recency (+ snapshot depth). **Guest rating and Deal Score verdict are not on `ApiDeal`** — the detail page computes the score server-side; the feed cannot show it.
- `subscriptions.watchlist` is a **premium list of up to 10 tracked cities** for email alerts, not a saved-deals feature. This work must not read, write, or gate on it, `alert_preference`, or `alert_min_discount`, and must not require `isPremium`.
- `HotelCard.tsx` is dead code (no live callers). The shipped surface is `DealCard` inside `DealFeed`.
- "Compare" is a taken word: `CompareRow` on every card means "compare this hotel's price across OTAs."

**This ticket is a different job from hotel-compare and should stay separable.** hotel-compare asked *"can I see these two next to each other right now?"* (a within-session viewing surface). This ticket asks *"does the set survive, and can I hand it to someone?"* — retention across sessions and a share artifact. If both ship, the shortlist is the shared substrate; UXR should explicitly decide whether to fold hotel-compare's compare view in as a later phase or leave it parked.

## Measurable signal that the problem exists

The retention gap is verifiable as an absence in code (no storage, no save control). Intent, per the ticket, is measurable **from data the app already collects** — `analytics_events` / `product_analytics_events` carry `session_id`, event name, and timestamp, and the feed already emits the needed events:

1. **Repeat comparison behavior (the primary intent signal).** Count sessions with ≥2 distinct `hotel_result_card_opened` / `hotel_detail_viewed` events, and specifically the `hotel_detail_viewed → hotel_detail_back_to_results → hotel_detail_viewed` loop. A high rate of ≥3-hotel oscillation is direct evidence that shoppers are maintaining a mental shortlist the product refuses to hold. **This query is runnable today and should be run before UI is designed** — it is the go/no-go input.
2. **Copied links (the share-intent signal).** `ShareButton` currently fires **no analytics event at all** — a one-line instrumentation gap. A `hotel_share_link_copied` event on the existing button measures share appetite for the price of a DEV one-liner, before any share artifact is built. UXR should call for this as a pre-build measurement, not a feature.
3. **Return visits.** Sessions where the same analytics session id (tab-lifetime today) or a returning visitor re-opens a previously viewed `deal_id`. Note the honest limitation: the analytics session id lives in `sessionStorage`, so **cross-day return-visit measurement is not currently possible** without a longer-lived identifier — itself a privacy decision UXR must scope, not assume.

## What a shared link does today (the share problem is a trust problem)

`ShareButton` copies the current deal URL. Sent to another person, that URL can land on three materially different pages, and **two of them are bad**:

| Recipient state | What they see |
|---|---|
| Deal active, recipient premium (or deal in the free weekly set) | The intended deal detail page |
| Deal active, recipient anonymous/free and deal is outside the 3-per-week free unlock set (`lib/paywall.ts`) | **"Members-only deal"** — a lock icon and a `/join` upsell. The hotel name and price are redacted; the recipient cannot see what was sent to them |
| Deal expired (`status = 'expired'`) | **"Saved rate expired"** — the observed rate is gone, with a "Search current deals" bounce |

So the existing share path can silently deliver a paywall or a dead rate to the person you are planning a trip with. **Any share artifact must be designed against these two states first, not as an afterthought.** A shortlist share link multiplies the risk: a 4-hotel share where 3 are locked is worse than no share at all.

## Constraints the solution must respect

1. **Privacy-safe saved state, and no new tracking identifier by stealth.** The privacy page states plainly: *"We use a single session cookie to keep you logged in. No advertising cookies. No third-party trackers."* Any persistence that outlives the tab (a shortlist cookie, a `localStorage` key, a server row for anonymous users) must be reconcilable with that sentence, and if it is not, the privacy copy changes with the feature. The ticket's own constraint — privacy-safe saved state — makes client-side, user-clearable storage the default and any anonymous server-side identifier a decision that must be justified, not assumed.
2. **Watchlist and paywall independence.** No reads or writes to `subscriptions.watchlist` / `alert_preference` / `alert_min_discount`; no `isPremium` gate on retaining or sharing. Retention must work for anonymous visitors, because that is who is comparing. Equally, the shortlist must **not** become a paywall bypass — a shared shortlist cannot reveal prices for deals the recipient's own plan would lock. Whatever the share artifact renders, it renders through the same paywall rules as the feed.
3. **Data and freshness honesty.** Only the five attributes on `ApiDeal` may appear in a retained or shared card — no amenities, no cancellation terms, no guest rating, no Deal Score verdict (none are on the feed contract). Deals expire; a retained or shared item must reconcile against live `status` at render and say so plainly rather than showing a stale price as current.
4. **Layout integrity.** Works at 375px and 1280px. A retain control on every card and any shortlist surface must not push results off-screen, obscure price, or collide with the card link or the OTA `CompareRow` — and must not add decorative clutter to a grid that already carries a discount chip, a freshness pill, and four OTA buttons.

## Explicit non-goals (MVP boundary)

- **No collaborative editing.** A share recipient views; they cannot add, remove, reorder, comment, or vote. No real-time sync, no presence, no shared-ownership model.
- **No accounts required, and no account migration promise in MVP.** Whether an anonymous shortlist merges into an account on sign-in is a real question, but it is a UXR/UXDES decision with a cost — it must not be assumed as MVP scope.
- **No notifications on shortlisted hotels.** Price-drop alerts on saved items are the watchlist's territory and a separate feature.
- **No trip organizer.** No dates/rooms/guests configuration, no itinerary, no multiple named shortlists, no folders.
- **No new attributes.** This feature does not plumb guest rating or Deal Score onto `ApiDeal`; if UXDES wants them in a shared artifact, that is a separate DEV ticket.
- **No flight shortlisting.** Hotels only; the feed's flights tab is out of scope.

## Open questions for UXR (do not guess these)

1. **Does the repeat-comparison data support the feature?** Run signal #1 above against `analytics_events` before designing. If sessions overwhelmingly open ≤1 hotel, the retention problem is smaller than the ticket assumes and the scope should shrink to sharing alone.
2. **What is the minimum viable share artifact?** Candidates, cheapest first: (a) instrument and keep the existing single-deal copy-link; (b) a URL that encodes the shortlisted deal ids in the query string — stateless, no storage, no new table, and it re-renders live server-side through the existing paywall and expiry rules; (c) a persisted share row with a short token. Option (b) appears to satisfy "minimum viable" and "privacy-safe" simultaneously and should be the one UXR argues for or against explicitly, including its limits (URL length, ids visible, no revocation).
3. **What is the retention window and mechanism?** Tab-lifetime `sessionStorage` does not satisfy "return-session"; `localStorage` does but outlives the tab and needs a user-visible clear path and an expiry rule. Pick one and state the privacy consequence.
4. **What does a recipient see for a locked or expired item in a shared set?** This needs designed copy, not a fallback — see the table above.

## Success statement

This is solved when a first-time, signed-out visitor can mark several hotels while scanning `/deals`, close the tab, come back later to find that set intact and truthfully labelled as to price freshness, and send one link that shows the recipient the same set — without creating an account, without any hotel silently appearing as a locked upsell or a dead rate, and without the feature touching or resembling the premium city watchlist.

---

## Handoff

**Next stage:** `UXR-HOTEL-SHORTLIST-SHARE-01` — audit `DealFeed` / `DealCard` / `/deals/[dealId]` / `ShareButton` / `lib/paywall.ts` against reference retention-and-share patterns (Booking.com saved lists + shared list link, Google Hotels shortlist, Airbnb wishlist sharing) at the interaction level, run the repeat-comparison query in signal #1, and produce testable directives covering: the retain control and its placement, the return-session persistence mechanism with its privacy consequence, the anonymous↔signed-in behavior rule, and the minimum viable share artifact including its locked-item and expired-item states.
