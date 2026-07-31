# UX Discovery — Hotel Airport-Transfer & Property Shuttle Availability

**Ticket:** `UXD-HOTEL-TRANSPORT-SHUTTLE-01` · **Stage:** UXD (Discovery) · **Priority:** P0
**Feature slug:** `hotel-transport-shuttle`
**Surface:** hotel result scan → hotel detail (expanded card / deal detail) → booking handoff
**Downstream ticket:** `UXR-HOTEL-TRANSPORT-SHUTTLE-01`
**Date:** 2026-07-31

---

## 0. Scope boundary — read first

Four prior pipelines touch adjacent ground. This ticket is **one narrow question**: *can the traveler
get from the airport to this property's door, who runs that service, and does it cost money?* It is
not a re-run of any of the following, and UXR must not re-derive them.

| Prior work | On disk | Relationship |
|---|---|---|
| `arrival-logistics` | `01-discovery.md` only — **stalled, nothing shipped** | **Direct parent.** It bundled five facts (check-in time, late arrival, airport transfer, parking, bag storage) into one discovery and stalled with no research stage. Its transfer strand is the seed for this ticket; the other four strands are out of scope here. Its finding that `transfers` in `lib/providers/travelpayouts.ts` means **flight layovers**, not ground transport, is accepted as given. |
| `hotel-checkin-logistics` | `01`, `02` | **Out of scope.** Owns *when* the property lets the traveler in. This ticket owns *how they physically reach it*. The two meet only in the late-arrival persona; UXR must not restate desk hours or check-in windows. |
| `hotel-parking-fit` | `01`, `02`, `03` — types + `HotelParking.tsx` shipped | **Out of scope surface, in-scope precedent.** Parking serves the traveler who *arrives with a car*; transfers serve the traveler who *does not have one*. `HotelParkingOptionEvidence` (`lib/types.ts:169-192`) is the structural model to extend — facility status separated from selected-stay availability, cost state separated from amount, operator named, reservation rule explicit. Reuse the shape; do not reuse the panel. |
| `hotel-location-fit` / `hotel-location-pin` / `hotel-location-decision-context` | shipped (`HotelLocation`, `HotelLocationAnchor`, `hotelLocationContext.ts`) | **The duplication hazard this ticket must avoid.** See §5. |

---

## 1. User pain point

A traveler booking a hotel *because it is near an airport* — or one far enough out that arrival
depends on a ride — cannot tell from expaify whether the property runs a shuttle, whether that
shuttle is free or charged, or whether any transfer exists at all, so they either pay for an
unnecessary taxi or arrive at a remote property with no way to reach it.

## 2. Who is affected, and at what step

**Who, in priority order:**

1. **Airport-hotel bookers** — the layover, early-departure, or delayed-flight traveler whose entire
   reason for choosing the property is airport proximity. For this user a free shuttle is not an
   amenity; it is the product. Highest stakes and highest concentration of the problem.
2. **Car-free arrivals at remote or resort properties** — a property 12 mi from the terminal with a
   complimentary transfer and one with none look identical on expaify today, while differing by the
   cost of a one-way fare in each direction.
3. **Cost-sensitive comparison shoppers** — a $28 each-way transfer on a 3-night stay is $56 of
   undisclosed trip cost that can invert which hotel is the better *deal*. This is a Deal Score
   integrity issue, not only an amenity gap.
4. **Late arrivals** (shared with `hotel-checkin-logistics`) — a shuttle that stops running at 22:00
   is functionally absent for a 23:40 landing. Operating hours are part of "does it exist for me."

**Where it breaks — three consecutive steps:**

1. **Result scan** (`app/components/HotelCard.tsx:880-990`, collapsed card). The card renders name,
   stars, price, Deal Score, a location line, `ParkingSummary` (`:928`), and pet/smoking scan
   signals. There is **no transport signal of any kind**. The user cannot triage which
   airport-adjacent properties are worth opening, so proximity alone drives the click — and proximity
   is exactly the signal that is misleading here.
2. **Hotel detail** (expanded card `app/components/HotelCard.tsx:1020-1060`; saved-deal page
   `app/deals/[dealId]/page.tsx`). The expanded panel shows Location (`:1025-1035`), `ParkingSection`
   (`:1040`), pet policy, smoking policy, access evidence, price scope, funds policy. The single
   arrival-adjacent datum is `distanceText` — `"3.4 mi from JFK"` — produced by `completeDistance`
   (`app/components/hotelLocationContext.ts:24-35`). **Distance is not transport.** The user reaches
   the surface designed to answer "is this hotel right for me" and the transfer question is not asked
   or answered.
3. **Booking handoff** (`app/book/BookingFlow.tsx`, `HotelHandoffReview`). `buildBookingHotelContext`
   (`lib/booking/config.ts:1061-1092`) serializes identity, price, location, document readiness,
   funds policy, smoking policy, rate eligibility, admission policy — **and no transport field**. The
   last screen before the traveler leaves expaify folds everything unresolved into one catch-all line
   asking them to confirm details "with the provider." Transport is never named, so the traveler
   crosses the handoff boundary with the arrival question still open, and any doubt they carry is
   attributed to expaify, not to the gap.

## 3. Measurable signal that the problem exists

Source-verified in this worktree, today:

1. **Zero transport data exists anywhere in the product.** A repo-wide search for
   `shuttle|airport transfer|transport` across `app/` and `lib/` returns exactly one hit —
   `"Birmingham-Shuttlesworth International"` in `lib/airports/data.ts:89`. There is no transport
   type, field, parser, cache key, or rendered string.
2. **`HotelOffer` has no transport slot.** `lib/types.ts:556-579` carries price, stars, rating
   evidence, location, amenity evidence, document readiness, funds/smoking/rate/admission policy.
   Nothing for ground transport.
3. **The provider returns none of it.** `HotelLookCacheEntry` (`lib/providers/hotellook.ts:22-40`)
   parses `hotelId`, `hotelName`, `stars`, `location`, `address`, `distance`, `priceFrom`,
   `propertyType`, `amenityEvidence`. No transfer or shuttle field is fetched or cached.
4. **The amenity vocabulary cannot express it.** `ACCESS_FACTS`
   (`lib/providers/hotelAmenityEvidence.ts:18-26`) is a closed list of seven ids — elevator, on-site
   parking, step-free route, and four room preferences. There is no `airport_shuttle` id, and
   `HotelAmenityEvidence.fee` is only `included | paid | unknown` (`lib/types.ts:133`) — too coarse to
   distinguish "free shuttle," "$25 per person each way," and "we can book you a taxi."
5. **Distance is present and actively misleading.** `withCalculatedAnchorDistance`
   (`lib/hotels/locationEvidence.ts:52+`) computes a haversine straight-line distance to a
   `HotelLocationAnchor` whose `kind` may be `'airport'` (`lib/types.ts:390`). The card can therefore
   already say *"0.9 mi from LAX"* — a true statement that a traveler with luggage at 23:00 will read
   as "I can get there," when a straight-line 0.9 mi across airport perimeter roads with no shuttle is
   a $30 taxi. **This is the highest-value part of the problem: the product does not merely omit the
   transport answer, it renders a proximity fact that reads as one.**
6. **The handoff drops it.** `BookingHotelContext` (`lib/booking/config.ts:60-93`) has no transport
   field, so even if detail-stage transport evidence existed it would not survive to the last screen —
   the same defect `hotel-parking-fit` documented for parking.
7. **No behavioral baseline exists.** `HotelDecisionAnalytics` (`app/components/HotelDecisionAnalytics.tsx`)
   emits `hotel_detail_viewed` with score state, price freshness, viewport, and section-reached
   events. No transport impression, expansion, or post-transport-exit event exists, because no
   transport surface exists. The engagement and confidence measures this ticket asks for must be
   defined and instrumented as part of the work — they cannot be read from existing data.

## 4. The four questions the traveler needs answered

These bound the feature. Anything beyond them is out of scope for this pipeline.

1. **Does a transfer exist between the airport and this property?** (property-run shuttle,
   third-party/booked service, or none documented)
2. **Is it complimentary or paid?** — and if paid, how much and on what basis (per person / per
   vehicle / each way / round trip). The ticket names this distinction explicitly; a single
   `included | paid | unknown` flag does not satisfy it.
3. **Is it available when I arrive?** Operating hours, on-demand vs. scheduled, and whether advance
   booking is required.
4. **What must I do before arrival?** Reserve, call on landing, or nothing.

Question 2 is the constraint-bearing one: a shuttle wrongly implied to be free is a worse outcome
than no shuttle information at all, because it converts an information gap into a broken promise
made by expaify at a moment when the traveler has already landed.

## 5. Constraints the solution must respect

1. **Verified property transport only — never inferred.** State a transfer exists only when a
   provider or property source returns it, attributed and timestamped. Proximity, star rating,
   `propertyType`, and the word "airport" in a hotel name are **not** evidence of a shuttle. When
   nothing is returned, the honest state is an explicit *not documented — confirm with the property*,
   following the shipped `HotelEvidenceStatus` `not_returned` convention (`lib/types.ts:120-124`) and
   the `hotel-parking-fit` precedent. Absence of evidence must never render as absence of service, and
   must never render as presence of one.
2. **Complimentary and paid must be structurally distinguishable, never merged.** The data model must
   separate cost *state* from cost *amount* and cost *basis*, as `HotelParkingOptionEvidence.cost`
   already does (`lib/types.ts:181-185`). Money follows the contract: `{ priceCents, currency }`,
   integer minor units, never a float, never a bare number. A paid transfer with an unknown amount
   must read as "charged — amount not documented," never as free by omission.
3. **No duplication of location fit.** This feature answers *how you get there*, not *where it is*.
   It must not restate, recompute, or contradict `distanceText`, the location precision vocabulary, or
   the anchor comparison shipped in `hotelLocationContext.ts` and `lib/hotels/locationEvidence.ts`. If
   transport evidence sits next to the distance line, the two must resolve into one coherent reading
   rather than two competing proximity claims — the design stage owns that adjacency explicitly.

Additional binding constraints carried from the product contract: transport data arrives only via
`lib/providers`; adapters return `Result<T>` and never throw; the surface must be usable at 375px
without crowding price, Deal Score, or location; every transport control must be keyboard-reachable
with a visible focus ring and an accessible name that carries the cost state, not just the word
"shuttle."

## 6. Measurement — transport engagement and selection confidence

No baseline exists (§3.7), so the first deliverable of the downstream stages includes instrumentation.
Minimum measures, scoped to **arrival-sensitive stays** (properties where the search anchor is an
airport, or the property sits beyond a distance threshold from the anchor):

- **Transport-information engagement:** impression rate of the transport signal on scanned cards;
  expansion rate of the transport detail; time-to-first-transport-interaction on the detail surface.
- **Selection confidence:** rate of handoff continuation for offers where transport is
  *confirmed complimentary* vs. *confirmed paid* vs. *not documented*; rate of return-to-results
  after opening transport detail (the pogo-stick signal); rate of abandonment at
  `HotelHandoffReview` on arrival-sensitive stays before and after the change.
- **Honesty guard:** count of rendered transport claims lacking a source label and `fetchedAt`. This
  must be zero; a non-zero value is a release blocker, not a metric.

## 7. Success statement

**This is solved when** a first-time traveler booking an airport or remote property can tell, from the
result card and confirm on the detail surface, whether the property provides an airport transfer and
whether it is complimentary or paid — and can carry that fact across the booking handoff — **without**
inferring service from a distance figure, and without ever being shown a transport claim that the
product cannot attribute to a verified property source.

## 8. Explicitly out of scope

- Booking, reserving, or pricing transfers inside expaify. This product hands off to a partner;
  transport remains a disclosure and confirmation task.
- Public transit, rideshare estimates, rental cars, and city-center transit scoring.
- Check-in times, desk hours, and late-arrival policy (`hotel-checkin-logistics`).
- Parking for travelers arriving by car (`hotel-parking-fit`).
- Flight-side `transfers` / layovers in `lib/providers/travelpayouts.ts` — an unrelated field with a
  colliding name. Any new field must not be named `transfers`.

## 9. Open question for UXR (do not guess — verify against the provider)

The Hotellook `cache.json` feed (`lib/providers/hotellook.ts:18-40`) is the only live hotel source and
returns no transport field; the `amenityEvidence` path is an expaify-side normalization slot, not a
vendor contract. **UXR must establish first-hand what transport data is sourceable today.** If the
answer is "none from the live provider," that is a valid and useful finding: the shippable scope
becomes the honest *not documented* state plus the anti-inference guard on the distance line (§3.5),
with the confirmed-transfer states specified and gated behind a source that can supply them. Design
must not assume data that no adapter can return.

## 10. Handoff

Create `UXR-HOTEL-TRANSPORT-SHUTTLE-01` (role `qa`, priority `P0`, status `backlog`) referencing this
document at `docs/pipeline/hotel-transport-shuttle/01-discovery.md`, carrying the problem statement in
§1, the four questions in §4, the three constraints in §5, and the open sourcing question in §9.
