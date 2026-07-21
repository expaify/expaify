# UXD-SOLD-OUT-RECOVERY-01: Sold-Out Deal Recovery

## Pain Point

When a hotel deal expaify surfaced is no longer available, at the discounted price, or for the traveler's dates, the app has no explicit "this deal is gone" signal or next step — it either renders the sold-out deal as if it were still live, or dead-ends the user with no recovery action, so the user abandons the session instead of finding a comparable deal.

## Affected Users And Flow Step

- **Who is affected:** Premium members who open a deal from `/deals/[dealId]` directly, from a saved link, or from an alert email, plus any user returning to expaify after clicking an OTA/provider link that turned out to be unavailable.
- **Flow steps (four entry points into the same gap):**
  1. **Stale deal detail** — organic or bookmarked visits to `app/deals/[dealId]/page.tsx`.
  2. **Booking handoff return** — the user leaves expaify via an OTA link on the deal page (`CompareRow`) or via `Continue to provider` in `app/book/BookingFlow.tsx` (`HotelHandoffReview`), then returns after the provider could not fulfill the rate.
  3. **Alert landing** — the user clicks an email alert link, which deep-links straight into `/deals/[dealId]` (confirmed in `docs/pipeline/watchlist-ux/01-discovery.md`: "An alert email deep-links to exactly this page"). Digest/instant emails can be queued before a deal is invalidated and opened after.
  4. **Search results refresh** — the user revisits `/deals` (`app/deals/DealFeed.tsx`) expecting to find a deal they saw earlier, or the feed silently drops a card between fetches with no explanation.

## Current Implementation Signals

- `lib/pipeline/dealDetection.ts:129-136` sets `status = 'expired'` on a deal row whenever the price recovers above the discount threshold or the snapshot history becomes too thin to support it — this is the pipeline's actual "this deal is gone" signal. A second block (`lib/pipeline/dealDetection.ts:140-145`) separately expires deals whose `check_in_date` has passed.
- `getDealById` (`lib/pipeline/dealDetection.ts:182-197`) selects deal columns by `id` with **no `status` filter and no `status` column in the SELECT list at all**. `app/deals/[dealId]/page.tsx` therefore has zero visibility into whether the pipeline has already invalidated the deal.
- The detail page's only "is this deal still good" signal is date math: `isExpired = deal.expires_at < now` (`app/deals/[dealId]/page.tsx:222`). `expires_at` is not touched when a deal is pipeline-expired (`status = 'expired'`), so a deal the pipeline has explicitly flagged as gone can still render with a future `expires_at`, a full price block, and live `Continue to provider` OTA links (`CompareRow`) as if nothing changed.
- The only other "unavailable" states the detail page renders are date-based staleness banners (`isStale` at 48h+, `isAging` at 30-48h since `updated_at`) and a static "Provider link unavailable" panel when `ota_links` is empty. None of these states offer a recovery action toward a comparable hotel, nearby dates, or the deal feed filtered to the same city — the expired-deal path (`isExpired`) is the only one with a CTA (`Search current deals` → `/deals`, with no city or filter context carried over).
- `app/book/BookingFlow.tsx` (`HotelHandoffReview`) sends the user to the provider with `Continue to provider` and offers only `Back to search` as a fallback. There is no mechanism for the user to report back that the provider rejected the rate, and no post-return state that distinguishes "still deciding" from "provider said no."
- The live search flow's `HotelCard` (`app/components/HotelCard.tsx:52-80`) already models an unavailable-price/unavailable-link state (`PriceUnavailable`, `getUnavailableReason`, "Booking unavailable") at the point a search response returns incomplete data — this pattern is the closest existing precedent for sold-out messaging but only fires for the initial search response, not for a deal a user already committed attention to.
- `app/deals/DealFeed.tsx` paginates and filters city deals client-side; whether a deal that disappears between the user's first view and a later refetch is explained versus silently dropped has not been confirmed in this stage and is flagged for UXR to audit directly against the component's fetch/render logic.

## Measurable Signal

This problem exists when any of the following are true:

- A deal row has `status = 'expired'` in `deals`, but `app/deals/[dealId]/page.tsx` renders it with the full live price block and clickable OTA links because `expires_at` has not also passed. (`getDealById` never returns `status`, so this is currently undetectable from the page.)
- A user reaches `/deals/[dealId]` from an alert email or a bookmark and the only unavailable-state messaging available is `isExpired` (date-only) or the empty-OTA-links panel — neither names "sold out," neither offers a same-city or same-hotel-class alternative, and the expired-deal CTA discards city/filter context.
- A user returns from an OTA or `Continue to provider` handoff and finds no way to signal "that didn't work" or see an immediate alternative; the only path back is `Back to search`, which returns to the homepage, not to a filtered recovery set.
- A previously visible deal disappears from `/deals` or `/destinations/[city]` between loads with no distinguishing copy from a normal empty/filtered result.

## Constraints

1. **Data integrity:** Do not invent a "sold out" claim the pipeline cannot support. `status = 'expired'` (price recovered / thin history) and `check_in_date` passing are the only two backend-confirmed reasons a deal is gone; a true real-time "hotel has zero rooms left" signal does not exist in this MVP and must not be implied. Recovery copy must say what expaify actually knows (deal no longer active, price no longer confirmed) rather than manufacturing certainty about hotel inventory.
2. **No duplication of flexible-date discovery:** `docs/pipeline/flexible-date-deal-confidence/01-discovery.md` already owns nearby-date confidence signaling on the Deal Score. This ticket must not re-solve date-flexibility UX; recovery options should point to alternative hotels or the city feed, not attempt calendar-based date shifting.
3. **Explainable recommendations:** Any "similar hotels" or "alternatives" surfaced when a deal is gone must be traceable to existing data (same city, same or adjacent star class, currently `status = 'active'` deals) — no black-box ranking, and no recommendation sourced from a provider call made directly from a component (must stay behind `lib/pipeline` / `lib/db`).
4. **Limited inventory data in the MVP:** The solution must work with the two confirmed signals above (`status`, `expires_at`/`check_in_date`) and existing empty/unavailable states already used by `HotelCard`; it must not require new provider integrations to ship a first version.

## Success Statement

This is solved when a first-time or returning user who lands on a sold-out or no-longer-available hotel deal — whether from the deal page directly, an alert email, a booking-handoff return, or a feed refresh — sees an explicit, honestly-scoped "this deal is no longer available" state and a clear next action (a comparable active deal in the same city, or a path back to the filtered feed) instead of a stale live-looking page or a dead end.

## Downstream Focus

The research stage should:

- Audit `app/deals/[dealId]/page.tsx`, `app/deals/DealFeed.tsx`, `app/book/BookingFlow.tsx`, and `lib/pipeline/dealDetection.ts` directly to confirm exactly which unavailable states exist today versus which are missing, including whether `DealFeed.tsx` explains a disappearing card.
- Define failure-state scenarios for all four flow steps (stale deal detail, booking handoff return, alert landing, search results refresh), each tied to the specific `status`/`expires_at`/`ota_links` condition that triggers it.
- Rank recovery options (comparable active deal in same city, filtered feed link, watchlist/alert adjustment per `docs/pipeline/watchlist-ux/01-discovery.md`) by how directly they use data already computed in `getDealById`/`DealFeed` versus what would require new query work.
- Specify exact copy rules for naming "no longer available" honestly against the constraints above (no invented inventory claims), consistent with the tone already used in `isStale`/`isAging` banners and `HotelCard`'s `PriceUnavailable` component.
- Confirm whether `getDealById` needs to start selecting `status` as a DEV-stage follow-up, since the detail page cannot distinguish pipeline-expired deals from live ones without it.
