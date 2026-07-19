# UX Discovery: Watchlist & Alert Preference Management

**Ticket:** UXD-WATCHLIST-UX-001 · **Stage:** UXD · **Date:** 2026-07-19
**Feature slug:** `watchlist-ux`

---

## Problem statement

Premium members who act on a deal (book it, or lose interest in a destination) have no way to adjust their watchlist or alert cadence from the surface they are actually on — every path to preference management runs through one buried section at the bottom of `/account`, so the realistic choices become "keep getting unwanted email" or "one-click unsubscribe from everything," which converts alert fatigue directly into total alert loss.

## Correction to the ticket framing

The ticket says members "save deals to a watchlist." That is not what the code implements. The watchlist is a list of **up to 10 tracked cities** (`subscriptions.watchlist TEXT[]`, `lib/db/schema.sql:206`, capped by `subscriptions_watchlist_limit_check`), chosen from the 20 tracked markets. There is no per-deal save anywhere in the codebase — `DealCard.tsx` has no save/heart/bookmark affordance. Downstream stages must scope to **city-watchlist + alert-cadence management**, not a saved-deals feature (that would be a new feature and is out of repair-mode scope).

## Who is affected, and where in the flow

Premium members (trialing or active — `isPremium` gate), at three moments:

1. **Post-booking / post-interest** — on `/deals/[dealId]` after clicking through from an alert email, or on `/deals` and `/destinations/[city]`. This is where "I'm done with Cancún" happens, and none of these surfaces offer any watchlist control or even show watchlist state ("You're watching this city").
2. **In the inbox** — `DealAlert.tsx` footer offers exactly two links: "Manage prefs" → generic `/account` (line 132), and "Unsubscribe" (line 134) which is a one-click **total off** (`app/api/alerts/unsubscribe/route.ts` sets `alert_preference = 'off'`). There is no middle option (drop this city, switch instant → daily).
3. **On `/account`** — the only management surface. The alerts/watchlist panel (`AccountClient` with `showAlerts`, `app/account/page.tsx:165-181`) is the **last** section, below plan status and profile, with a batch "Save preferences" button — not reachable by deep link (no anchor/fragment), not linked from any deal surface.

## Current implementation map (verified in source)

| Surface | Watchlist/alert capability |
|---|---|
| `/onboarding` (`OnboardingClient.tsx`) | Initial set: cities, min discount (30/40/50), cadence (instant/daily/off) |
| `/account` (`AccountClient.tsx` `showAlerts`) | Full edit, saves via `PATCH /api/onboarding` |
| `/deals` feed, `/deals/[dealId]`, `/destinations/[city]` | **None** — no affordance, no state indicator |
| Alert emails (`sendDealAlert.ts:88`, `sendDailyDigest.ts:113`) | Footer links: `/account` + one-click full unsubscribe |
| Unsubscribe landing (`alerts/unsubscribe/route.ts`) | Static "alerts are off" page; **no hyperlink** back to `/account`, no re-enable or reduce option |

Alert delivery honors the data correctly: `sendDealAlert.ts:50-54` and `sendDailyDigest.ts:38,79-80` filter on `alert_preference`, `alert_min_discount`, and `watchlist` membership. The data layer works; the management UX is the gap.

## Additional findings (for UXR to weigh)

- **Dead API routes.** `app/api/account/watchlist/route.ts` and `app/api/account/alerts/route.ts` have **zero callers** — the account UI saves through `PATCH /api/onboarding` (which also re-asserts `onboardingDone: true`). The dead alerts route supports `alertMinDiscount` 0–90 and `alertTimezone`, neither exposed in any UI. Any new in-context controls should either adopt or delete these routes, not add a fourth path.
- **Three duplicated city lists** that can drift: `TRACKED_MARKET_NAMES` (`lib/trackedMarkets.ts`), a hardcoded `CITIES` set in `app/api/account/watchlist/route.ts:8-12`, and another in `app/deals/DealFeed.tsx:11-15`.
- **The deal-detail page's nav has no account link** (`app/deals/[dealId]/page.tsx` nav links only `/` and `/deals`; `LandingNav` with its account icon is used on `/deals` but not here). An alert email deep-links to exactly this page — the member landing from an email has no visible route to preferences.
- **Batch-save interaction**: watchlist toggles on `/account` do nothing until "Save preferences" is pressed; there's no per-toggle persistence, and the saved state resets after a 2-second "Saved ✓" flash.

## Measurable signals that the problem exists

- Click path length: from `/deals/[dealId]` (email landing) to removing one city is **4+ steps** (nav → `/deals` → account icon → scroll to last section → toggle → Save), with zero on-page hints that the path exists.
- The only one-click action offered in email is full unsubscribe — `alert_preference = 'off'` — measurable as unsubscribe events that could have been cadence downgrades or single-city removals.
- Unsubscribe landing page is a dead end (no links), measurable as zero re-engagement from that page.
- No surface renders watchlist state, so a member cannot even confirm which cities they watch without going to `/account`.

## Constraints the solution must respect

1. **Repair-mode scope & contract:** manage the *existing* city watchlist and cadence — no per-deal saves, no new notification channels. All writes stay behind auth + `isPremium` (403 otherwise), watchlist ≤ 10 cities from tracked markets, and no new API path duplication (consolidate on one write route).
2. **Brand & layout integrity:** use existing design tokens (`--primary`, `--ink`, `--radius-pill`, etc.) and existing pill/button patterns; usable at 375px and 1280px; no clutter added to deal cards that harms scanability.
3. **Deliverability & trust (CAN-SPAM):** one-click unsubscribe must remain one-click and keep working; any added email options are additions (e.g., "fewer emails," "stop watching {city}"), never extra friction before unsubscribe. Email management links must not require re-auth to fail gracefully (unsubscribe is token-based; keep it that way).

## Success statement

This is solved when a premium member who just booked or lost interest in a deal can, **from the surface they are on** (deal page, destination page, or alert email), remove that city from their watchlist or downgrade alert frequency in ≤ 2 interactions — without hunting for the account page and without their only escape hatch being full unsubscribe.

---

**Next stage:** UXR — audit `/account` panel, deal surfaces, and email footer against reference patterns (e.g., Booking.com price-alert management, Google Flights tracked-prices) and produce testable directives.
