# UX Discovery: Neighborhood Fit Signals

Ticket: UXD-NEIGHBORHOOD-FIT-01 · Stage: UX Discovery · Priority: P0

## User Pain Point

Hotel deals are labeled with only a city name, so a shopper cannot tell whether a deal
sits near the place their trip actually revolves around — the beach, the old town, the
conference venue, the relative they are visiting — without leaving expaify to open a map.

## Who Is Affected And At What Step

This affects deal-intent hotel shoppers — both first-time visitors and paid members — at
three steps, all powered by the same deal record (`DealRow` → `ApiDeal`) and card
(`app/components/ui/DealCard.tsx`):

1. **Deal feed scan** (`app/deals/DealFeed.tsx`): a grid of `DealCard`s where the only
   location cue is `deal.city` printed in the secondary line as `★★★★ · Miami · Aug 3–5`.
   Every hotel in a city reads as interchangeable on location, so the user cannot triage
   which deals are worth a closer look.
2. **City destination pages** (`app/destinations/[city]/page.tsx`): the entire page is a
   single city (e.g. "Hotel deals in Miami"), so `city` is redundant here and there is
   **zero** intra-city location signal — the one surface where neighborhood fit matters
   most has the least of it.
3. **Deal detail evaluation** (`app/deals/[dealId]/page.tsx`): the detail view expands
   price history, score, star rating, and OTA compare links, but repeats only `city` for
   location. The user reaches the decision point still unable to place the hotel.

The result is **pogo-sticking**: the user opens deal after deal (or bounces to an external
map) trying to answer "is this near where I need to be?", and abandons or hands off with
low confidence rather than saving/booking a hotel that actually fits their trip.

Note: a *second*, separate hotel surface exists — live search results via
`HotellookProvider` → `HotelOffer` → `app/components/HotelCard.tsx`, which carries a richer
`HotelLocation` (address, coordinates, distance-to-city-center). The gap there (missing
address/distance on the card) is already scoped by
`docs/pipeline/hotel-location-decision-context/01-discovery.md`. **This discovery is
deliberately scoped to the `DealCard`-powered feed / city / detail surfaces**, and to the
distinct problem of judging fit against a *trip anchor* rather than an abstract city center.
Downstream stages should treat these as complementary, not duplicate.

## Measurable Signal That The Problem Exists

- **Data reduced to a city string.** `DealRow` and `ApiDeal` carry `city` and nothing finer
  (`lib/pipeline/dealDetection.ts`). `DealCard` renders only `deal.city`
  (`app/components/ui/DealCard.tsx`). No neighborhood, district, address, coordinates,
  landmark distance, or transit field reaches any of the three surfaces.
- **Neighborhood data is dropped at ingestion, not merely un-displayed.** The nightly
  pipeline's `HotelEntry` normalization keeps only `hotelId, hotelName, stars, priceCents,
  photoUrl` (`lib/pipeline/snapshot.ts`), and the `price_snapshots` table has no
  location column beyond `market_id` (city) (`lib/db/schema.sql`). The coordinate-search
  provider (`fetchBookingComCoords`) even queries by `lat`/`lng` but discards per-hotel
  coordinates from the response. So the signal is destroyed before storage.
- **On a city page the one available cue is redundant.** Every card on
  `/destinations/[city]` shows the same `city` value, giving the location line an effective
  information content of zero for the user's real question.
- **Manual trace:** a user scanning Miami deals cannot distinguish a South Beach hotel from
  an airport-district hotel from a downtown hotel — all three read as "Miami" — so the only
  way to judge fit is to open each detail page or an external map. This is the pogo-stick /
  abandonment signal the ticket asks us to reduce.

## Constraints The Solution Must Respect

1. **Honest precision — never invent a neighborhood.** If the data layer only knows the
   city, the UI must not imply a district, landmark distance, or map position it cannot
   support. Any signal shown must be traceable to real provider data and labeled at its true
   precision (mirroring the existing `HotelLocationPrecision` discipline in `lib/types.ts`).
   No fabricated "5 min from the beach."
2. **Data-layer reality is the gating constraint (hotels-first MVP).** Meaningful
   neighborhood/landmark/transit signals on the feed require capturing and storing location
   at ingestion — a change to `snapshot.ts` normalization and the `price_snapshots` schema,
   flowing through `DealRow`/`ApiDeal`. That is likely **new-feature scope** and must be
   flagged for approval, not silently assumed. Research must separate "shippable today with
   existing data" from "requires an ingestion change." The ticket's "map preview if data
   exists" is explicitly conditional and must stay conditional.
2b. **Contracts are non-negotiable.** Any new location data still flows through
   `lib/providers`, adapters return `Result<T>`, money stays `{ priceCents, currency }`, and
   outbound OTA/deeplinks keep their affiliate markers.
3. **Scannable and accessible at 375px and desktop.** A fit signal must be a quick
   secondary cue on a dense card — it cannot crowd price, discount chip, Deal Score, or the
   OTA compare row, cannot overlap text at 375px, and must be keyboard- and
   screen-reader-legible. No decorative map clutter.

## Success Statement

This is solved when a deal-intent user can judge whether a hotel deal fits their trip —
"is this in a part of the city I want to be in?" — within one minute of viewing it in the
feed or on a city page, without opening a separate map product and without expaify implying
location precision the underlying data does not support.

## Handoff Package For UXR

Per this ticket, the research stage (`UXR-NEIGHBORHOOD-FIT-01`) must produce trip-anchor
scenarios and explicit data-availability assumptions. Seeds below.

### Trip-anchor scenarios to evaluate

A *trip anchor* is the location the user's trip revolves around; fit is judged relative to
it, not to an abstract city center.

- **A. Event/venue anchor** — "I'm here for a conference at the convention center; which
  deals are walkable / a short ride from it?" Needs distance-or-proximity to a named POI.
- **B. Landmark/leisure anchor** — "Beach trip to Cancún / old town in Rome; I want to be
  near the water / the historic core, not the airport strip." Needs a neighborhood name or
  landmark reference.
- **C. Transit anchor** — "I won't rent a car; I need to be near a metro/transit line."
  Needs transit-proximity data.
- **D. Personal-address anchor** — "Visiting family near a specific address/neighborhood."
  Needs a hotel coordinate or district to compare against a user-entered point.
- **E. No stated anchor (feed browse)** — user is scanning without a fixed anchor; the cue
  must still add orientation (which part of the city) without implying false precision.

For each scenario, UXR should state: what signal answers it, whether the data exists today,
and the minimum viable cue if it does not.

### Data-availability assumptions to verify

1. **Feed / city / detail surface (primary):** today only `city` is stored
   (`price_snapshots`, `DealRow`). Neighborhood/coords/landmark/transit are **not**
   captured. Confirm exactly what each ingestion provider (booking-com15, booking-com v1
   coordinate search, tripadvisor16) actually returns for location, and what the minimal
   schema/normalization change would be to capture a neighborhood or coordinate. Treat
   ingestion changes as candidate feature scope pending approval.
2. **Live-search surface (secondary, reference only):** `HotelOffer.location` already
   supports precision, address, lat/lng, and a distance whose `referencePoint` is currently
   hard-coded to "city center" (`lib/providers/hotellook.ts`). Note whether a trip-anchor
   distance is even expressible in the current shape, but do not re-scope the HotelCard work
   already owned by `hotel-location-decision-context`.
3. **Anchor input:** there is no mechanism today for a user to state a trip anchor. UXR must
   decide whether v1 fit signals are anchor-agnostic (neighborhood name / orientation only)
   or anchor-relative (distance to a user- or event-supplied point), and flag the latter as
   larger scope.

**Recommended UXR framing:** default the near-term solution to the strongest signal that
needs **no new stored data** (neighborhood/district orientation where a provider already
returns it, else honest "city-level only"), and separately spec the ingestion change needed
for anchor-relative distance as an explicitly-flagged, approval-gated enhancement.
