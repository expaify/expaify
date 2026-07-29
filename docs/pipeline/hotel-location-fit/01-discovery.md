# UX Discovery: Hotel Location Fit Before Booking

**Ticket:** UXD-HOTEL-LOCATION-FIT-01 · Stage: UXD (Discovery) · Priority: P1
**Surface:** Deal feed → city page → deal detail → OTA booking handoff
**Date:** 2026-07-29

---

## 0. Scope boundary — read first (overlap with prior tickets)

Three prior discoveries touch hotel location. This ticket is **not** a re-run of any of them, and
downstream stages must not re-derive their findings:

| Prior work | Surface | Status on disk | Relationship to this ticket |
|---|---|---|---|
| `hotel-location-decision-context` | Live-search `HotelCard` + booking review | 01, 02, 03 complete — **shipped** (`app/components/hotelLocationContext.ts`, `HotelLocationPrecision` in `lib/types.ts`) | **Out of scope.** We reuse its precision vocabulary; we do not modify it. |
| `hotel-location-pin` | Live-search `HotelCard` anchor/pin comparison | 01, 02, 03 complete | **Out of scope surface.** Its anchor model (`HotelLocationAnchor`) is a reuse candidate. |
| `neighborhood-fit` | Deal feed / city page / deal detail — **same surfaces as this ticket** | 01, 02 only; **no design, nothing shipped** | **Upstream input, not a duplicate.** Its six directives (D1–D6) are accepted as given. |

**What this ticket adds that `neighborhood-fit` did not deliver:** that work stalled at research with
an unresolved data-sourcing question (its Q1) and no prioritization, no measurement plan, and no
acceptance signals — so no design stage could start. This discovery closes those three gaps: it
resolves what is *sourceable today* from first-hand provider-parse evidence, prioritizes the concept
into a shippable MVP versus a flagged feature, and defines the exit/abandonment instrumentation the
ticket asks for. UXR should treat `docs/pipeline/neighborhood-fit/02-research.md` as prior art to
extend, not repeat.

---

## 1. User pain point

A hotel shopper evaluating a deal on expaify sees only a city name — on the card, on the city page, and
again at the decision point on the detail page — so they cannot tell whether the property sits near the
part of the city their trip revolves around, and must leave for an external map to find out.

## 2. Who is affected, and at what step

Affected users are **deal-intent hotel shoppers** — free-tier browsers and paid members alike — on the
deal-feed surfaces (not live search). Location fit breaks at three consecutive steps:

1. **Feed scan** (`app/deals/DealFeed.tsx` → `app/components/ui/DealCard.tsx:79`): the secondary line
   renders `{stars} · {deal.city} · {checkInWindow}`. Every hotel in a market carries the same city
   string, so location contributes **zero discriminating information** to triage. The user cannot
   choose which deals deserve a click.
2. **City destination page** (`app/destinations/[city]/page.tsx`): the whole page is one city, so the
   city string is not merely weak — it is redundant. The surface where intra-city fit matters most
   carries the least location signal of any surface in the product.
3. **Deal detail — the decision point** (`app/deals/[dealId]/page.tsx:350`): renders
   `Area: {deal.city}`. The user arrives at the surface immediately preceding the outbound OTA handoff
   and still cannot answer "where is this?" — and the label **"Area" asserts a granularity the value
   does not have**, which is a trust defect, not just an information gap.

The behavioral consequence is pogo-sticking: the user opens deal after deal, or leaves to an external
map, and either abandons or hands off to the OTA with unresolved doubt.

## 3. Measurable signal that the problem exists

**Implementation evidence (verified first-hand in this worktree):**

- **Location is destroyed at ingestion, not merely unrendered.** `HotelEntry`
  (`lib/pipeline/snapshot.ts:58-64`) is `{ hotelId, hotelName, stars, priceCents, photoUrl }`. All
  three provider parsers read only those fields.
- **The coordinate provider throws away the coordinates it searched by.** `fetchBookingComCoords`
  (`lib/pipeline/snapshot.ts:106-136`) queries `search-by-coordinates` with a market `lat`/`lng` and
  discards every per-hotel location field in the response.
- **Storage has no location column.** `price_snapshots` (`lib/db/schema.sql:104-119`) and `deals`
  (`:125-148`) carry no `lat`, `lng`, `address`, `district`, or `neighborhood`. Location reaches the
  app only through `market_id → tracked_markets.city`.
- **City-only propagates the whole way to pixel:** `DealRow` (`lib/pipeline/dealDetection.ts:155`) →
  `ApiDeal` (`app/deals/DealFeed.tsx:121`) → `DealCard.tsx:79` → `[dealId]/page.tsx:350`.
- **The richer model already exists but does not reach these surfaces.** `HotelLocation`,
  `HotelLocationPrecision`, `HotelLocationAnchor`, and `HotelLocationDistance` (`lib/types.ts:387-419`)
  serve live search only. The deal pipeline has no path to them.
- **The problem is currently unmeasurable in-product.** `DealFeed.tsx` emits `hotel_results_viewed`,
  `hotel_result_card_opened`, `hotel_sort_changed`, and filter events (`lib/analytics.ts:62`), but
  **`app/deals/[dealId]/page.tsx` emits no analytics at all** — no detail-view event, no exit event, no
  handoff event. Location-related detail exits and handoff abandonment cannot be counted today.

**Manual trace:** a shopper scanning Barcelona deals cannot distinguish a Gothic Quarter property from
an airport-district property from a beachfront property. All three read `Barcelona`. The only way to
resolve fit is an external map or an OTA click.

**Baseline funnel to instrument** (this is a required output of the concept, not a nice-to-have — see
§6.A, since nothing below step 1 is currently observable):

1. deal card impression, segmented by the location precision available for that deal
2. deal detail view
3. location-region view / expansion, if an inspectable region is offered
4. detail exit **without** OTA handoff ← *primary problem signal*
5. OTA handoff click (booking handoff), and time-to-handoff after detail view
6. return-to-feed followed by a different deal detail within the session (pogo-stick proxy)

**Primary decision signal:** detail-view → OTA-handoff conversion for the same deal, segmented by
location precision. **Guardrails:** repeated detail opens across competing deals in one session
(pogo-sticking should fall, not rise), and immediate exit after viewing the location region — a
location region that gets looked at and then exited is unresolved doubt, not success. A raw rise in
location-region interaction is **not** a success measure on its own.

## 4. Constraints the solution must respect

1. **Honest precision — never invent a neighborhood.** If the pipeline knows only the city, no surface
   may imply a district, address, landmark distance, or map position. Any location claim must be
   traceable to real provider data and labeled at its true precision, reusing the existing
   `HotelLocationPrecision` tiers (`lib/types.ts:387`) rather than inventing a second vocabulary. This
   makes the current `Area: {deal.city}` label (`[dealId]/page.tsx:350`) a defect in itself.
2. **MVP is bounded by what is sourceable without a schema change; anything beyond is flagged, not
   assumed.** Real neighborhood/coordinate/distance data on these surfaces requires capturing location
   in `snapshot.ts` normalization **and** adding columns to `price_snapshots`/`deals` — a data-layer
   change that is **new-feature scope requiring explicit APPROVED FEATURE sign-off** under the repair-
   mode rule. Discovery therefore splits the concept into a repair tier that ships against today's
   data and a feature tier that is gated. Downstream stages must not merge them.
3. **Mobile-safe and accessible at 375px.** A fit signal sits on a dense card alongside price, discount
   chip, Deal Score, and OTA compare links. It must not overlap text at 375px, must not crowd price or
   Deal Score hierarchy, must be keyboard-operable and screen-reader-legible, and must not introduce
   decorative map clutter. Full map-planning UI is out of scope.

*(Contracts remain non-negotiable throughout: provider calls stay in `lib/providers`, adapters return
`Result<T>`, money stays `{ priceCents, currency }`, outbound OTA deeplinks keep affiliate markers.)*

## 5. Success statement

This is solved when a first-time deal-intent shopper can judge whether a hotel deal sits in a part of
the city that fits their trip — from the feed and confirmed on the detail page — without opening an
external map and without expaify asserting any location precision the underlying data does not
support.

## 6. Prioritized concept: honest location fit, in two tiers

**Tier A — Repair (ships against today's city-only data; no schema change, no approval gate):**

- **A.1 — Remove the invented-precision label.** `Area: {deal.city}` on deal detail
  (`[dealId]/page.tsx:350`) must not present a city under a label implying neighborhood or street
  granularity. Precision must be stated truthfully at the decision point.
- **A.2 — Make location certainty legible on the card.** When only the city is known, the shopper
  should be able to tell that from the card, not discover it after a click. This converts a silent
  information gap into an honest, expectation-setting state.
- **A.3 — Instrument the funnel in §3.** Deal detail currently emits nothing. Without steps 2–6 the
  effect of any location work — Tier A or Tier B — is unfalsifiable. **A.3 should ship first**, so
  Tier B is judged against a real baseline rather than an assumption.

**Tier B — Feature (gated on APPROVED FEATURE sign-off; do not build on spec alone):**

- **B.1** Capture per-hotel location at ingestion (`snapshot.ts` parsers already receive it and discard
  it) and persist it through `price_snapshots` → `deals` → `DealRow` → `ApiDeal`.
- **B.2** Render a coarse orientation label (neighborhood/district) on the card, and an anchored
  distance on detail — distance only at coordinate-grade precision, always naming its reference point,
  never estimated.
- **B.3** Map/pin expectation: a map preview is **conditional on B.1 delivering real coordinates**. It
  is explicitly not part of Tier A and must never be rendered from a market-level centroid.

**Open question this discovery could not close, and why it does not block Tier A:** exact provider
field names for district and per-hotel coordinates cannot be confirmed from the code alone, because
the parsers discard those fields before they are typed — confirming them requires one live payload per
provider (`booking-com15`, `booking-com` v1, `tripadvisor16`). This is `neighborhood-fit` Q1, still
open. It gates **B.1/B.2 scoping only**; Tier A is unaffected and should proceed in parallel.

## 7. Acceptance signals (how TEST will judge the eventual build)

1. No surface renders a city string under a label implying finer granularity than city.
2. Every location state on deal-feed surfaces maps 1:1 to a `HotelLocationPrecision` tier, with copy
   consistent with live search — no bespoke fourth phrasing.
3. No deal lacking coordinates renders any distance; every rendered distance names its anchor and unit.
4. On a city-only deal, a user can tell from the card that exact location is unconfirmed.
5. Deal detail emits the §3 funnel events, so detail-exit-without-handoff is countable.
6. Card and detail remain readable and non-overlapping at 375px and 1280px; price and Deal Score
   hierarchy is unchanged.
7. No regression to feed filtering/sorting, deal detail rendering, or the OTA handoff.

## 8. Research handoff — questions for UXR-HOTEL-LOCATION-FIT-01

1. Which single orientation cue lets a deal-feed shopper keep or reject a deal fastest at 375px:
   a coarse district label, an anchored distance, or a map affordance?
2. For the city-only state, is a certainty cue on the card genuinely helpful, or does it add noise to a
   dense card and belong on detail only? (`neighborhood-fit` Q3, unresolved.)
3. What is the honest reference anchor on these surfaces when the user has entered no anchor — city
   centre, the market's airport, or none at all? These deals carry no user-entered anchor.
4. Where does the location cue belong: card, detail, or both — and does the answer differ between the
   deal feed and city pages, where the city string is redundant?
5. Confirm the Tier B data ledger against one live payload per provider (§6 open question) so UXDES can
   scope B.2 copy without guessing field availability.

**Reference patterns to audit at the interaction level:** Booking.com's district label plus anchored
"distance from centre" on result cards, and Google Hotels' map-preview-versus-list affordance —
compared as interaction patterns, not visual style.
