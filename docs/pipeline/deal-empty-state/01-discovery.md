# 01 — UX Discovery: deal feed empty state & freshness signals

**Ticket:** UXD-DEAL-EMPTY-STATE-001 · **Stage:** UXD · **Date:** 2026-07-19
**Surfaces:** `/deals`, `/destinations/[city]`, `/deals/[dealId]`, `DealCard`

---

## Problem statement

When the deal feed has nothing to show, or shows a deal whose price has not been
re-verified recently, expaify either fabricates content (mock "Preview deals",
"found today" on rows with no timestamp) or gives no honest freshness signal at
all — so users who hit an empty or stale feed have no way to judge whether the
product is working, whether a price is current, or what to do next, and they
bounce distrusting the data.

## Who is affected, and where

- **First-time anonymous visitors on `/deals`** — the top of the funnel. When
  the DB has no active deals they are shown 5 generated mock deals instead of
  an honest empty state, with only a faint "Preview deal" caption.
- **Premium users filtering the feed** — the only users who can produce the
  filtered-empty state. They get copy but no one-tap recovery control.
- **SEO / shared-link visitors on `/destinations/[city]`** — land directly on a
  city page that may have zero deals; this is the highest-bounce-risk entry.
- **Any user evaluating a specific deal** — feed cards show deal *age* ("found
  3d ago") but never price *freshness* (`updated_at`), and the detail page's
  stale warning fires on nearly every healthy deal (see audit item 6).

## Current-state audit (verified in source)

1. **`/deals` unfiltered-empty is masked by mock data.** Server pre-fetch falls
   back to `generateMockDeals(5)` when `getActiveDeals` returns zero rows
   (`app/deals/page.tsx:56-83`), and `/api/deals` does the same for unfiltered
   requests (`app/api/deals/route.ts:119-128`). The honest empty branch in
   `DealFeed` ("We're building your feed") is effectively unreachable without
   filters. Mock cards render as real inventory with prices and OTA compare
   rows; the only disclosure is a caption-sized "Preview deal" line
   (`app/components/ui/DealCard.tsx:159-161`).

2. **Filtered-empty state has copy but no recovery control.**
   `app/deals/DealFeed.tsx:527-542` renders "No deals match those filters. /
   Try widening your filters or clearing the search." — but there is no button.
   Recovery requires discovering the small × on each active `FilterPill` or the
   SearchBar clear. Three 30%-opacity skeleton cards render behind the message,
   which reads as a loading failure rather than a designed state.

3. **`/destinations/[city]` empty state exists but undercuts itself.** The
   empty card ("No deals in {city} right now… We check daily") with a "See all
   destinations" link is at `app/destinations/[city]/page.tsx:100-113`. But the
   header directly above it still says "Updated daily · 0 deals found"
   (`page.tsx:93-95`) — a contradictory trust cue. There is no "alert me when a
   {city} deal appears" capture even though `AlertSignup`
   (`app/components/AlertSignup.tsx`) exists and is currently imported nowhere.

4. **`updated_at` never reaches the feed UI.** The pipeline maintains
   `deals.updated_at` on every upsert/expiry (`lib/pipeline/dealDetection.ts:106,133,142`)
   and `getActiveDeals` selects it (`dealDetection.ts:284`), but all three
   `toApiDeal` mappings drop it (`app/api/deals/route.ts:31-74`,
   `app/deals/page.tsx:16-37`, `app/destinations/[city]/page.tsx:10-31`).
   `ApiDeal` has only `firstSeen`. A feed-level staleness signal is therefore
   currently *impossible*, regardless of design.

5. **Feed cards conflate deal age with price freshness — and fabricate it.**
   `DealCard` shows "found {timeAgo(firstSeen)}" (`DealCard.tsx:103-105`).
   That is discovery age, not verification recency: a 10-day-old deal whose
   price was re-confirmed this morning reads as stale, and a deal whose price
   hasn't been checked in 3 days reads however old its *discovery* is. Worse,
   `timeAgo(undefined)` returns `"today"` (`DealCard.tsx:36-37`), so mock deals
   and any row missing `first_seen` display **"found today"** — a fabricated
   freshness claim. The same helper is duplicated on the detail page
   (`app/deals/[dealId]/page.tsx:36-45`).

6. **Detail-page staleness threshold contradicts the pipeline cadence.** The
   snapshot pipeline runs once daily at 4am UTC
   (`.github/workflows/snapshot.yml`), so a healthy deal's `updated_at` is up
   to ~24h old by design. The detail page flags "Price may be stale" at **6
   hours** (`app/deals/[dealId]/page.tsx:218-222`), meaning nearly every
   healthy deal shows the warning for ~75% of each day. A warning that is
   almost always on trains users to ignore it — and leaves no distinct signal
   for the actual failure case the ticket describes (48h+, i.e. missed
   pipeline runs). The card-style banner also lacks the timestamp itself; the
   "Updated {date}" line is buried at the bottom of "Why this is a deal"
   (`page.tsx:383`).

## Measurable signals that the problem exists

- `updated_at` is absent from the `ApiDeal` type — feed freshness display is
  structurally impossible today (verifiable by type inspection, item 4).
- With a daily 4am UTC pipeline, the 6h stale banner is showing on healthy
  deals ~18 of every 24 hours (deterministic from cadence + threshold).
- Mock fallback: any cold-DB or DB-error state serves fabricated inventory
  labelled only by a caption (items 1, 5).
- Bounce rate on `/destinations/[city]` sessions that land on the empty card,
  and zero-interaction exits from the filtered-empty state, are the analytics
  signals to watch post-fix (no event currently distinguishes these states —
  itself a gap).

## Reference behaviour to investigate in UXR (interaction level)

- **Kayak / Booking.com empty results:** state *why* nothing matched, offer
  one-tap relaxation of the specific blocking filters (removable filter chips
  in-place), and offer an alternative (nearby dates/destinations, price
  alerts). Neither fakes inventory.
- **Kayak / Google Flights freshness:** cached prices carry an explicit "as
  of" qualifier (e.g. "prices found within the last 24 hours"), calibrated to
  the actual refresh cadence; stale beyond cadence → re-verify prompt, not a
  permanent warning.
- UXR should confirm the exact patterns and pick 1–2 to model.

## Constraints the solution must respect

1. **Honesty / trust (brand):** no fabricated timestamps ("found today" from a
   null), no mock inventory presented at real-deal visual weight, and no
   always-on warnings. Staleness thresholds must derive from actual pipeline
   cadence: fresh ≤ ~30h (one missed-run grace), stale beyond that, with 48h+
   as the explicit warning tier per the ticket.
2. **Data contract:** exposing `updated_at` must be additive to `ApiDeal` and
   flow through all three `toApiDeal` mappings without weakening the paywall
   lock-masking (locked rows already strip identifying fields) and without
   changing money handling (`priceCents` integers) or provider boundaries.
3. **Accessibility + mobile:** empty states and freshness indicators must be
   usable at 375px and 1280px, announce via `role="status"` where they replace
   content, keep interactive recovery controls at ≥44px touch targets, and use
   existing design tokens only.

## Success statement

This is solved when a first-time user who hits an empty `/deals` or
`/destinations/[city]` view can immediately tell **why** it is empty and take
**one tap** to recover (clear filters, browse all destinations, or set an
alert) without being shown fake inventory — and when any user viewing a deal
can see when its price was last verified, with a staleness warning that appears
*only* when the pipeline has actually missed its cadence (48h+), never on a
healthy daily-refreshed deal.

## Open questions for UXR

- Should the mock-deal fallback survive at all on `/deals`, and if so at what
  visual weight ("sample data" framing vs. current near-parity cards)?
- Is `firstSeen` ("found Xd ago") worth keeping alongside a new "price checked
  Xh ago" signal, or does showing both overload the card?
- Where does alert capture (`AlertSignup`) belong in the city empty state, and
  does the backend for city-scoped alerts exist yet?
