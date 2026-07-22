# 02 — UX Research: Neighborhood Fit Signals

**Ticket:** UXR-NEIGHBORHOOD-FIT-01 · Stage: UXR (Research) · Priority: P0
**Upstream:** `docs/pipeline/neighborhood-fit/01-discovery.md` (see blocker note §0)
**Surfaces in scope:** DealCard-powered surfaces only —
- Deal feed (`app/deals/page.tsx` → `app/deals/DealFeed.tsx` → `app/components/ui/DealCard.tsx`)
- City destination pages (`app/destinations/[city]/page.tsx` → same `DealFeed`/`DealCard`)
- Deal detail (`app/deals/[dealId]/page.tsx`)

**Explicitly OUT of scope:** the live-search `HotelCard` (`app/components/HotelCard.tsx`) and its
`hotelLocationContext.ts` display logic — owned by `hotel-location-decision-context`. We *reuse* its
type vocabulary (see §5) but do not modify it.

---

## 0. Blocker / evidence note (read first)

The discovery report file `docs/pipeline/neighborhood-fit/01-discovery.md` **does not exist on disk**
in this worktree (verified: `find . -iname "*neighborhood*"` returns nothing; no git history for the
path). This brief is therefore anchored to (a) the discovery summary embedded verbatim in the ticket
description and (b) a first-hand audit of the current source. **Recommend the UXD stage re-emit the
discovery doc so the pipeline paper-trail is intact.** No content below depends on the missing file —
every claim is backed by a source citation.

---

## 1. Problem statement (restated)

A shopper looking at a hotel deal on expaify sees a **city name and nothing else** about *where* the
hotel sits. They cannot judge whether the deal is near their trip anchor — the conference venue, the
beach, the old town, a relative's address — without leaving expaify to open a map. "$92/night, 45% off,
Barcelona" is a strong price signal with **zero location-fit signal**. For most trips, *where* in the
city is as decision-critical as the price. The result is either a broken trust moment (the user leaves
to verify and may not return) or a bad booking (great price, wrong side of town).

**Who / where:** every hotel shopper on the deal feed, city pages, and deal detail — i.e. the entire
paid-deal browsing surface, not live search.

**Success (from discovery):** a first-time user can judge location fit **within one minute, without a
separate map, and without expaify inventing precision it does not have.**

---

## 2. Current-state audit — the location data trail

I traced location data from provider ingestion to pixel. **The single most important finding: location
is destroyed at ingestion, and `city` is the only location field that reaches any surface.**

| Stage | File · line | What it carries | Location detail present? |
|---|---|---|---|
| Provider raw payload | `lib/pipeline/snapshot.ts` fetch fns (`fetchBookingCom15` :72, `fetchBookingComCoords` :106, `fetchTripAdvisor` :147) | full provider JSON | **Yes** (see §6 — district/coords/distance likely present in raw) |
| Ingestion parse | `HotelEntry` type, `snapshot.ts:58-64` | `hotelId, hotelName, stars, priceCents, photoUrl` | **No — dropped here.** Parsers read only id/name/class/photo/price. |
| Snapshot store | `price_snapshots` table, `schema.sql:104-119` | no `neighborhood`, `district`, `address`, `lat`, `lng` columns | **No** |
| Deal store | `deals` table, `schema.sql:125-148` | location comes only via `market_id → tracked_markets.city` JOIN | **No — city only** |
| Deal row (feed/detail) | `DealRow`, `dealDetection.ts:154-175` & `:188` (`m.city`) | `city` string | **City only** |
| Feed transport type | `ApiDeal`, `DealFeed.tsx:42-61` | `city` string | **City only** |
| Card prop type | `DealCardDeal`, `DealCard.tsx:14-30` | `city` string | **City only** |
| Card render | `DealCard.tsx:127` | `{stars} · {city} · {checkInWindow}` | **City only** |
| Detail render | `[dealId]/page.tsx:300` (subtitle) and `:408` (`Fact label="Area" value={deal.city}`) | `city` labeled "Area" | **City only** |

### Two honesty problems already live in the code
1. **`[dealId]/page.tsx:408` labels the raw city as "Area."** Calling a city ("Barcelona") an "Area"
   overstates granularity — it implies neighborhood-level knowledge the system does not have. This is
   the exact "invented precision" the success criterion forbids, and it exists **today**.
2. **The card offers no way for the user to know location is unknown.** There is no affordance telling
   the shopper "we only know the city — verify the exact spot," so they cannot calibrate trust.

**Conclusion:** with the current data model there is *nothing* below city to display. Any signal richer
than "city" **requires capturing and storing at least one location field at ingestion** — an
ingestion + schema change, which per the non-negotiable contract and the discovery framing is
**approval-gated feature scope**, not repair scope.

---

## 3. Reference patterns (interaction level, not visual)

- **Booking.com — search & card:** every card shows a **neighborhood/district label** ("El Born,
  Barcelona") plus a **distance-to-anchor line** ("450 m from Beach", "1.2 km from centre"). The anchor
  is chosen by relevance to the query. Key pattern: *two tiers* — a coarse orientation label (always
  present) and a precise distance (present only when an anchor + coords exist).
- **Google Hotels / Expedia:** "**X mi from city center**" as the default anchor when no user anchor is
  set; switches to "X mi from <your search landmark>" when the user searched a POI. Distance is always
  paired with the reference point in the same phrase — never a bare number.
- **Airbnb:** deliberately *coarse* location ("Gràcia, Barcelona") pre-booking and exact pin only after
  booking — a deliberate honest-imprecision model worth citing for our "don't invent precision" rule.

**The delta:** references show a **graded location signal** (orientation label → distance-to-named-
anchor), each tier shown only when its data exists. expaify shows a **single ungraded, un-caveated city
string** and mislabels it "Area." We already own the vocabulary to fix this (§5) but lack the data (§2).

---

## 4. Trip-anchor scenarios (required handoff artifact)

Design must serve all five. For each: the user's mental question, what would satisfy it, and what
expaify can honestly say **today** vs **after ingestion capture**.

| # | Anchor type | User's question | Satisfying signal | Honest today (city only) | After ingestion capture |
|---|---|---|---|---|---|
| 1 | **Event / venue** (conference, wedding at a fixed address) | "How far is this from *this exact building*?" | Distance to a user-supplied address/POI | Cannot answer — say so, don't imply | Distance-to-anchor **only if** coords exist for both hotel and anchor; else neighborhood label + "confirm distance" |
| 2 | **Landmark / leisure** (beach, old town, ski lift) | "Is this walkable to the thing I came for?" | Neighborhood name + distance to landmark | Neighborhood label if captured; else city + honest caveat | Neighborhood label always; distance-to-landmark when the landmark is a known city POI with coords |
| 3 | **Transit** (near airport rail, central station) | "Can I get around easily from here?" | District + "near <station>" / distance to center | City only — no transit claim | District label + distance-to-center; **no** transit-time claims (we have no routing data — out of scope) |
| 4 | **Personal address** (staying near family/office) | "How far from *my* address?" | Distance from a user-entered address | Cannot answer — no user-anchor input exists on these surfaces | Requires (a) coords capture **and** (b) a user-address input; treat the input as a *separate* future feature, not this ticket |
| 5 | **No-anchor browse** (inspiration, flexible) | "Roughly where in the city is this?" | Coarse orientation ("central / beachfront / suburban") | City + neighborhood label if captured; this is the **most achievable** scenario | Neighborhood/district orientation label — the primary shippable win |

**Design implication:** Scenario 5 (and the label half of 2) is the **highest-value, lowest-precision**
target — it needs one text field (district/neighborhood), no coords, no user input. Scenarios 1 and 4
demand precision expaify must **refuse to fake**; design should show an honest "city-level only —
confirm exact location with the provider" state rather than a guess.

---

## 5. Reuse target — one location-precision vocabulary across the app

The `hotel-location-decision-context` ticket already shipped a **precision-graded** location system for
live search that we should **adopt as the shared vocabulary** (do not fork a second one):

- Types: `HotelLocation` + `HotelLocationPrecision = 'exact' | 'coordinates' | 'area' | 'search_area' | 'missing'`
  (`lib/types.ts:119-135`), incl. `HotelLocationDistance { value, unit: 'mi'|'km', referencePoint }`.
- Display logic: `getHotelLocationDisplay()` in `app/components/hotelLocationContext.ts` already maps
  each precision to a `{label, value, note, isWarning, distanceText}` with honest copy
  (e.g. `area` → "Provider supplied an area, not a street address"; `search_area` → warning).

**Directive rationale:** DealCard surfaces should express neighborhood fit in the **same precision
tiers and the same honest tone**, so a user sees one consistent location language whether they're in
live search or the deal feed. This also means the ingestion capture (§6) should populate the existing
`HotelLocation` shape rather than inventing a parallel one. *We reference and reuse; we do not edit the
live-search component.*

---

## 6. Data-availability assumptions per ingestion provider (required handoff artifact)

**Method note (researcher honesty):** the current parsers (`snapshot.ts`) extract only id/name/class/
photo/price, so I cannot prove field presence from our code alone. The table below states, per provider,
what the **raw payload is expected to contain** and the **confidence** of that assumption. **Every
"available" row must be verified against a live payload by DEV before design commits to it** — this is
an assumption ledger, not a guarantee.

| Provider (our fn) | Endpoint | Neighborhood/district text | Coordinates (lat/lng) | Distance-to-anchor | Confidence | Notes |
|---|---|---|---|---|---|---|
| **booking-com15** (`fetchBookingCom15` :72) | `/api/v1/hotels/searchHotels` (city `dest_id`) | Likely (property has a wishlist/area name) | Likely (`property.latitude/longitude`) | No (city search, no anchor) | **Medium** | We already read `property.*`; adding a district/coord read is a small parser change. Confirm exact keys. |
| **booking-com v1 coords** (`fetchBookingComCoords` :106) | `/v1/hotels/search-by-coordinates` | **Likely `district`** + `address`/`zip`/`city` | **Likely `latitude/longitude`** | **Likely `distance_to_cc`** (distance to city centre) | **High (richest)** | This is a coordinate search — the payload is the strongest candidate for both a district label *and* a ready-made distance-to-center. Best single source. |
| **tripadvisor16** (`fetchTripAdvisor` :147) | `/api/v1/hotels/searchHotels` (`geoId`) | Likely via `secondaryInfo` (area/neighborhood string) | Unreliable / often absent | No | **Medium-Low** | Text label plausible; coords usually not present → distance features not supportable from this provider. |

**Cross-provider consequence for design:** location richness is **uneven by provider**, and a given
deal's provider is not exposed downstream today. Design must assume a **ragged data floor**: some deals
will have a district label + distance, some only a district label, some only the city. The UI must
degrade gracefully across all three — which the precision-tier model in §5 already expresses
(`coordinates`/`area`/`search_area`/`missing`).

---

## 7. Shippable-today vs approval-gated (the split discovery asked for)

**Shippable today (repair scope, NO ingestion/schema change):**
- **S1 — Stop mislabeling.** Rename the deal-detail "Area" fact (`[dealId]/page.tsx:408`) to something
  honest at city granularity (e.g. "City") and add a one-line honest caveat that exact location is
  provider-confirmed. Removes live invented-precision. *Copy-only, zero data change.*
- **S2 — Honest city-level affordance on the card.** Where only `city` is known, keep the city line but
  make the absence of finer location legible (a quiet "City-level — confirm exact spot" microcopy or an
  info affordance) so trust is calibrated, not silently overstated. *No new data.*
- **S3 — No hotel-name mining.** Explicitly forbid deriving neighborhoods from hotel names
  ("Harbour View…", "Downtown…") — unreliable, would manufacture precision. Documented as a guardrail.

**Approval-gated feature (delivers the real win; requires ingestion + schema change):**
- **F1 — Capture location at ingestion.** Extend `HotelEntry` (`snapshot.ts:58`) to read a
  district/neighborhood string (+ coords where present, per §6) and populate a `HotelLocation`-shaped
  value. Add columns to `price_snapshots` and `deals` (or a joined table); thread through `DealRow` →
  `ApiDeal` → `DealCardDeal`.
- **F2 — Neighborhood orientation label** on card + detail (Scenario 5, and label half of 2), rendered
  through the shared precision vocabulary (§5).
- **F3 — Anchor-relative distance** ("X km from centre", later "from <landmark>") on detail, shown
  **only** at `coordinates`/`exact` precision, always paired with its reference point, never a bare
  number. Distance-to-center (booking-com v1 `distance_to_cc`) is the lowest-risk first anchor.

This split lets UXDES spec a **shippable honesty pass now** and a **feature spec** that is ready the
moment ingestion capture is approved — without blocking one on the other.

---

## 8. Design directives (specific, testable — for UXDES)

1. **D1 (repair, today): Kill invented precision in the "Area" fact.**
   The deal-detail location fact (`[dealId]/page.tsx:408`) must not label a bare city as "Area." Spec
   the exact label + caveat copy for the city-only case. *Testable:* no surface renders a city string
   under a label that implies neighborhood/street granularity.

2. **D2 (repair, today): Card must expose location certainty, not just the city.**
   When only `city` is known, the card (`DealCard.tsx:127` line) must make "we only know the city"
   legible via honest microcopy or an affordance. *Testable:* on a city-only deal, a user can tell that
   exact location is unconfirmed without leaving the card; no phrasing asserts a neighborhood.

3. **D3 (feature): Adopt the shared precision vocabulary — no second location language.**
   Any neighborhood/distance UI must render through `HotelLocationPrecision` tiers and reuse the
   honest-copy pattern of `getHotelLocationDisplay()` (§5). *Testable:* every location state on
   DealCard surfaces maps 1:1 to a precision tier (`coordinates|area|search_area|missing`) with copy
   consistent with live search; no bespoke fourth phrasing.

4. **D4 (feature): Distance is always anchored, graded, and never faked.**
   Spec distance display so a number never appears without its reference point ("1.2 km from centre",
   not "1.2 km"), and distance shows **only** at `coordinates`/`exact` precision. City-only and
   label-only deals show orientation text or nothing — never an estimated distance. *Testable:* no
   deal missing coords renders any distance; every rendered distance names its anchor.

5. **D5 (feature, scope guard): Neighborhood label is orientation, not an address.**
   The orientation label (Scenario 5) must read as a coarse area ("El Born · central") and must carry
   the same "confirm final address with provider" honesty already used at `area` precision. *Testable:*
   the label never presents as a bookable/exact address; the provider-confirm caveat is present.

6. **D6 (scope guard): No user-anchor input in this ticket.**
   Scenarios 1 and 4 (event address, personal address) require a user-entered anchor, which does not
   exist on these surfaces. Design should show the honest "city-level — confirm with provider" state
   for these, and **flag user-anchor input as a separate future feature**, not part of neighborhood-fit.

---

## 9. Open questions for UXDES / DEV

- **Q1 (DEV, blocks F-scope):** verify the §6 assumption ledger against one live payload per provider —
  confirm exact field names for district and coords, and whether `distance_to_cc` is present on
  booking-com v1. Design of F2/F3 should not finalize copy until this is confirmed.
- **Q2:** should the neighborhood label live on the card, detail, or both? Recommendation: label on
  card (Scenario 5 is a browse/scan moment), label + distance on detail (deeper evaluation).
- **Q3:** for city-only fallback, is silence (just the city, no caveat) acceptable on the *card* to
  avoid clutter, with the honesty caveat reserved for *detail*? Recommend the researcher's view:
  minimum one legible certainty cue on the card (D2), fuller caveat on detail.
- **Q4 (UXD):** re-emit the missing discovery doc (§0).

---

## 10. Success check (how TEST will judge the eventual build)

A first-time user, given a deal, can within one minute answer "roughly where in the city is this, and
do I trust that?" **without opening a separate map** and **without the UI asserting a neighborhood,
address, or distance it cannot support from provider data.** City-only deals read as honestly
city-only; richer deals show graded, anchored detail.
