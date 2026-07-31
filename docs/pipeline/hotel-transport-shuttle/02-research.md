# UX Research — Hotel Airport-Transfer & Property Shuttle Availability

**Ticket:** `UXR-HOTEL-TRANSPORT-SHUTTLE-01` · **Stage:** UXR (Research) · **Priority:** P0  
**Feature slug:** `hotel-transport-shuttle`  
**Discovery:** `docs/pipeline/hotel-transport-shuttle/01-discovery.md`  
**Surface:** hotel result scan → expanded hotel details → booking handoff  
**Date:** 2026-07-31

## 0. Decision summary

The open sourcing question has a definitive answer: **Hotellook `cache.json` can source no
transport data today because the entire Hotellook API is shut down.** Travelpayouts says the
Hotellook program closed on October 20, 2025 and that API requests after that date return an error.
A first-hand request to the exact endpoint used by this repo returned HTTP 404 on 2026-07-31.
This worktree also has no `TP_TOKEN`, so no authenticated payload could be sampled; a token would
not restore an API that the owner says is fully disabled.

That creates two separate findings:

1. **In ticket:** no confirmed, paid, complimentary, unavailable, scheduled, or on-request transfer
   state can be populated by the current adapter. UXDES may specify those states for a future
   verified provider, but the only honest current transport presentation is “not documented” when a
   successful source omits the field, or “could not be checked” when the source check fails. A
   calculated airport distance must not read as a transfer answer.
2. **Out of ticket but P0:** the repo's sole hotel supplier calls a retired API. Restoring hotel
   inventory requires a separate provider-replacement decision and must not be disguised as shuttle
   UI work.

The reference pattern worth transferring is not the competitors' page density. It is their
separation of **service existence**, **cost state**, **hours/operating mode**, and **advance action**.
Booking.com exposes “Airport shuttle (free)” versus “Airport shuttle (additional charge)” as scan
signals, then places hours and reservation requirements in property details. Expedia exposes “free
roundtrip airport shuttle” as a prominent amenity and puts a paid amount, charge basis, and
on-request rule in structured important information and FAQ content. expaify currently carries none
of those semantics.

## 1. Method and evidence boundary

### 1.1 Repository audit

I read the discovery report and audited the live hotel adapter, normalization, shared types,
location-distance calculation and display, collapsed/expanded hotel card, parking precedent,
booking-context serialization, booking review, and hotel-detail analytics. Searches used the terms
`shuttle`, `transfer`, `transport`, `airport pick`, `distance`, `anchor`, and `parking` across
`app/`, `lib/`, and relevant pipeline docs.

### 1.2 First-hand provider check

On 2026-07-31 I requested:

`https://engine.hotellook.com/api/v2/cache.json?location=LAX&checkIn=2026-09-15&checkOut=2026-09-16&currency=USD&limit=20`

The response was HTTP 404 with an nginx error body and no hotel records. The worktree exposed
neither `TP_TOKEN` nor a hotel affiliate marker, so I did not have credentials to issue the
authenticated variant. This does not leave the endpoint status ambiguous: Travelpayouts' current
[Hotellook closure FAQ](https://support.travelpayouts.com/hc/en-us/articles/29534131568530-FAQ-on-the-closure-of-Hotellook)
states that the program closed October 20, 2025, the API is fully disabled, and requests now return
errors. The older [Hotels data API reference](https://travelpayouts.github.io/slate/) describes
`cache.json` as a cached room-cost endpoint, not a property-content or transport-details endpoint.

**Answer to the discovery open question:** no airport-transfer or property-shuttle data is
sourceable from Hotellook `cache.json` today. In fact, no current hotel payload is sourceable from
that API. Old documentation or stale cached objects are not current property evidence and must not
be used to make a transport claim.

### 1.3 Reference-pattern review

Reference findings come from current public property surfaces and official supplier documentation.
They are pattern guidance, not evidence that expaify has equivalent data rights or fields.

- Booking.com public property/list surfaces: free and charged airport shuttles are different visible
  labels; property details can add operating hours and reservation requirements.
- Expedia public property surfaces: complimentary service is promoted in the amenity summary, while
  paid amount/basis and on-request operation appear in “Important information” and an explicit FAQ.
- Booking.com API documentation: property details can optionally return facilities; the facilities
  vocabulary includes `AIRPORT_SHUTTLE` and surcharge details. This demonstrates a source contract
  that is structurally richer than Hotellook, not a provider recommendation for this ticket.

## 2. Current-code evidence

### 2.1 Data supply and normalization

| Current behavior | Code evidence | Research implication |
|---|---|---|
| The only implemented hotel provider points to `https://engine.hotellook.com/api/v2/cache.json`. | `lib/providers/hotellook.ts:18`, `:427-555` | The only production hotel data path is retired. Confirmed transfer UI has no live source. |
| A request requires `TP_TOKEN` and an affiliate marker before the network call. | `lib/providers/hotellook.ts:427-454` | In this worktree, the provider exits before fetching because neither credential is configured. |
| The adapter's raw entry contains id, name, stars, location, address, distance, price, property type, amenity evidence, and smoking policy—no ground-transport field. | `lib/providers/hotellook.ts:23-42` | Even a legacy payload shaped as typed cannot express the four traveler questions. |
| Normalization builds price, deeplink, image, quality, amenity, funds, smoking, rate, and admission evidence only. | `lib/providers/hotellook.ts:494-542` | There is no hidden transfer mapping to surface. |
| Cached normalized offers are revalidated without transport. | `lib/providers/hotellook.ts:337-411` | A future type alone would not preserve the field through Redis; cached normalization must also carry it. |
| `HotelOffer` has no transport property. | `lib/types.ts:556-579` | Components cannot receive verified transport evidence under the current contract. |
| The generic amenity vocabulary is a closed seven-item access list and silently ignores unknown ids. | `lib/providers/hotelAmenityEvidence.ts:18-28`, `:109-127` | Adding an `airport_shuttle` amenity string would still lose hours, cost amount/basis, operator, and action. This needs a dedicated evidence object, not a generic amenity chip. |

### 2.2 Distance is orientation evidence, not transport evidence

`withCalculatedAnchorDistance` computes a straight-line haversine distance when provider property
coordinates and a typed anchor are valid (`lib/hotels/locationEvidence.ts:53-83`). An airport is one
allowed anchor kind (`lib/hotels/locationEvidence.ts:26-32`). `completeDistance` then formats that as
`“{n} mi from {anchor.name}”` (`app/components/hotelLocationContext.ts:24-35`).

There are two important corrections to the discovery's surface description:

- The **current collapsed `HotelCard` does not render `distanceText`**. It shows only the location
  label and value at `app/components/HotelCard.tsx:901-906`.
- The calculated line **does render in expanded card details**, at
  `app/components/HotelCard.tsx:1024-1035`, without the “straight-line distance; travel distance and
  time may differ” caveat specified by the earlier location pipeline. Booking review carries the
  location object but does not render `distanceText` in `HotelDecisionSummary`
  (`app/book/BookingFlow.tsx:325-363`).

The immediate anti-inference defect is therefore concentrated in the expanded result detail, not
the current collapsed card or booking review. Future UI work must not reintroduce it on either
surface.

### 2.3 Result scan and detail

The collapsed card currently presents identity, quality, an occasional elevator chip, location,
price, eligibility/admission signals, parking summary, funds policy, pet/smoking signals, Deal
Score, review action, and details control (`app/components/HotelCard.tsx:857-1004`). It has no
transport summary.

Expanded details present a location panel followed by admission policy, parking, pet, smoking,
access, price scope, and funds policy (`app/components/HotelCard.tsx:1007+`). There is no section that
answers:

1. whether airport transfer service exists;
2. whether it is complimentary or charged;
3. whether its documented hours cover the traveler; or
4. whether the traveler must reserve or call.

`HotelParkingOptionEvidence` is the right structural precedent because it separates facility
status, selected-stay status, location, cost state/amount/basis, reservation rule, operator, source,
and fetch time (`lib/types.ts:152-192`). Its UI also preserves paid-with-unknown-amount rather than
collapsing omission into “included” (`app/components/HotelParking.tsx:61-70`). Transport should reuse
that evidence discipline, not the parking panel or parking copy.

### 2.4 Arrival-time fit cannot currently be computed

The product has stay dates, but no hotel-arrival timestamp or property timezone in `HotelOffer` or
`BookingHotelContext`. `BookingHotelContext` carries `checkIn`, `checkOut`, and `nightCount`, but no
arrival time (`lib/booking/config.ts:60-87`). A traveler may also enter hotel review with incomplete
stay dates, and the review explicitly renders “Stay dates not provided”
(`app/book/BookingFlow.tsx:357-361`).

Therefore, even a future provider's operating hours cannot honestly become “Available when you
arrive” under the current input contract. The shippable disclosure can state documented local hours
or 24-hour/on-request operation, then say the traveler's arrival-time fit was not checked. Adding an
arrival-time input or joining a selected flight itinerary is a new feature and is outside this
repair ticket.

### 2.5 Booking handoff drops transport state

`BookingHotelContext` has no transport evidence (`lib/booking/config.ts:60-87`), and
`buildBookingHotelContext` cannot serialize it (`lib/booking/config.ts:1061-1092`). Booking review
shows parking in “Supporting evidence” (`app/book/BookingFlow.tsx:1157-1176`) but no transfer state.
The provider handoff copy names room details, availability, total, taxes/fees, cancellation, and
terms, but not arrival transport (`app/book/BookingFlow.tsx:1123-1128`).

This means any future result-level transport claim would currently disappear at the last decision
boundary. Re-fetching or re-inferring it at review would risk contradicting the selected card.

### 2.6 Measurement does not exist in production-ready form

`HotelDecisionAnalytics` emits a detail-view event, section-reached events, provider handoff, and
back-to-results (`app/components/HotelDecisionAnalytics.tsx:38-145`). None carries transport state or
records a transport summary/detail impression. The repository's analytics helper is development
logging only (a pre-existing, cross-product constraint documented by prior pipelines), so the event
contract can be specified here but outcome measurement remains blocked until analytics has a
production transport.

## 3. Reference patterns and transferable lessons

### 3.1 Booking.com: scan-level cost distinction, detail-level operating rules

Booking.com uses the explicit scan labels **“Airport shuttle (free)”** and **“Airport shuttle
(additional charge)”** on property and destination results. Examples are visible on the
[La Quinta Orlando Airport property](https://www.booking.com/hotel/us/la-quinta-wyndham-orlando-airport-north.html)
and an [airport-shuttle destination list](https://www.booking.com/city/uz/urtasaroy.en-gb.html).
This makes cost state scannable without pretending the amount is known.

Deeper property content carries the operational qualifiers. The
[Gold Country Inn property](https://www.booking.com/hotel/us/americas-best-value-gold-country-inn-casino.html)
documents a free shuttle, a 7:00–22:00 window, and a reservation requirement. This is exactly why
“shuttle exists” is insufficient: a 23:40 arrival fails even though the amenity is present.

Official Booking.com facility metadata further separates presence from surcharge-capable details:
`AIRPORT_SHUTTLE` is a property facility and supports surcharge details in the
[Facilities API metadata](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/facilities-meta-endpoint).
The Demand API retrieves facility details through optional property-detail extras rather than
assuming them from search proximity ([accommodation API overview](https://developers.booking.com/demand/docs/accommodations/about-accommodation)).

**Transferable:** use distinct free/charged scan copy; disclose hours and required action at detail;
source the claim from structured property content.  
**Do not transfer:** Booking.com's broad amenity wall or burying critical hours in long “fine print.”
expaify has a compact decision surface and should answer the four questions in one focused block.

### 3.2 Expedia: benefit summary plus exact paid obligation

Expedia promotes confirmed complimentary service near the top: the
[Quality Hotel Melbourne Airport property](https://www.expedia.com/Melbourne-Hotels-Quality-Hotel-Melbourne-Airport.h519175.Hotel-Information)
shows “Free airport shuttle” as a popular amenity, while the
[Four Points Toronto Airport property](https://www.expedia.com/Toronto-Hotels-Four-Points-By-Sheraton-Toronto-Airport.h14440.Hotel-Information?equalTargetTab=tab-5)
describes a free roundtrip service. Direction/coverage is part of the claim, not assumed.

For paid service, the
[Airport Inn Managua property](https://www.expedia.com/Managua-Hotels-Airport-Inn-Managua.h22341481.Hotel-Information)
puts `USD 6 per vehicle` in optional extras and answers in FAQ that the shuttle runs on request. The
amount, currency, charge unit, and operating mode are separate facts.

**Transferable:** keep complimentary/paid structurally distinct; when paid, show amount and basis;
name on-request/scheduled operation.  
**Do not transfer:** repeating the same claim across marketing summary, amenity list, important
information, and FAQ. expaify should show one scan summary and one canonical evidence block.

### 3.3 Exact delta

| Traveler question | Reference pattern | expaify today | Delta |
|---|---|---|---|
| Does service exist? | Explicit airport-shuttle amenity or explicit absence where sourced | No field, parser, or UI; provider is offline | Dedicated verified evidence state plus an honest failure/omission state |
| Complimentary or paid? | Free and additional-charge labels are distinct | Generic amenity fee enum is unused for transfer and cannot hold amount/basis | Separate cost state, `Money`, charge basis, and trip basis |
| Available when I arrive? | 24-hour, scheduled window, or on-request details | No operating-hours field, property timezone, or arrival timestamp | Show documented hours/mode; explicitly state arrival fit was not checked |
| What must I do? | Reservation needed, advance window, or on-request instruction | No action field; generic provider confirmation | Structured advance-action rule and exact instruction |
| Can I trust the claim? | Property detail content, structured facility source | No transport provenance; old provider cannot return data | Source label + fetch time required for positive/negative claims; never infer from distance/name/type |

## 4. Design directives

These five directives are implementation-testable and stay within the discovery boundary.

### D1 — Use a dedicated provenance-bearing evidence object; gate every claim

Extend the semantics of `HotelParkingOptionEvidence`, but create transport-specific fields. At
minimum the normalized evidence must carry:

- facility status using the existing `HotelEvidenceStatus` meanings;
- service kind (`airport_shuttle`, `airport_transfer`, or documented provider wording), airport or
  route endpoint when supplied, and direction (`to_property`, `from_property`, `round_trip`,
  `unknown`);
- operator (`property`, `third_party`, `unknown`);
- cost state (`included`, `paid`, `unknown`), optional `Money`, charge basis (`per_person`,
  `per_vehicle`, `per_booking`, `unknown`), and trip basis (`each_way`, `round_trip`, `unknown`);
- operating mode (`24_hours`, `scheduled`, `on_request`, `unknown`), documented local time windows,
  and timezone only when returned;
- traveler action (`none_documented`, `reserve_before_arrival`, `call_on_arrival`, `contact_property`,
  `unknown`) plus an advance deadline only when sourced;
- `sourceLabel`, `fetchedAt`, and confidence.

Do not encode transport in `HotelAmenityEvidence`; that shape cannot answer the four questions.
Render `confirmed` or explicit `unavailable` only when both a recognized source and valid fetch time
exist. Missing provenance, malformed money, stale legacy objects, or conflicting values degrade to
“Airport transfer details are unclear”—never to free, paid, or unavailable.

**Passes when:** fixtures without source/fetch time cannot render a positive or negative claim;
`paid` without amount renders charged/amount-not-documented; invalid or non-integer money is
rejected; hotel name, `propertyType`, and airport distance never populate evidence.

### D2 — Make scan copy state-specific and keep distance subordinate

For an airport-linked result, provide one compact transport line below the existing location block.
It must use these copy rules:

- confirmed + included: `Complimentary airport transfer`;
- confirmed + paid + valid amount/bases: `Airport transfer · {amount} {charge basis}, {trip basis}`;
- confirmed + paid without a valid amount: `Airport transfer · Paid; amount not documented`;
- confirmed + unknown cost: `Airport transfer · Cost not documented`;
- explicit provider-reported unavailable: `No airport transfer reported`;
- successful source response with no field: `Airport transfer not documented`;
- loading: `Checking airport transfer…`;
- source/network error: `Airport transfer details could not be checked`;
- malformed/conflicting: `Airport transfer details are unclear`.

Do not show a generic “Shuttle” chip, use a green success treatment for merely existing paid
service, or add a second distance. The current collapsed card has no distance and must stay that
way. In expanded location details, whenever an airport-anchor distance renders without confirmed
transport evidence, pair it with: `Straight-line distance only. Airport transfer not documented.`
If the evidence check failed, replace the second sentence with `Airport transfer details could not
be checked.`

Because Hotellook is offline, the only currently reachable dynamic outcome is the error state; a
not-documented state is valid only after a future provider successfully returns a property response
without transport fields.

**Passes when:** an airport-named hotel with no evidence never shows transfer service; a 0.9 mi
airport distance is visibly qualified; complimentary and paid scan strings cannot be confused; at
375px the line wraps without displacing price, Deal Score, or actions.

### D3 — Answer the four questions in one canonical detail block

Expanded details must present one `Airport transfer` evidence block, adjacent to but not inside the
Location or Parking panels. Order the facts as:

1. **Service:** existence, documented direction/airport, and operator;
2. **Cost:** complimentary, exact paid amount/bases, or the exact unknown-cost state;
3. **Hours:** 24 hours, scheduled window in property local time, on request, or `Hours not documented`;
4. **Before arrival:** reservation/call/contact instruction or `Advance instructions not documented`;
5. **Source:** source label and updated time.

Never say “Available for your arrival” because expaify has no arrival time or property-timezone
input. When hours are documented, append `Your arrival-time fit was not checked.` When hours are not
documented, use `Confirm operating hours for your arrival.` This is a disclosure repair, not an
arrival-time feature.

The block's successful-empty copy is `The hotel provider did not document an airport transfer.
Confirm directly with the property before arrival.` The failed-check copy is `Airport transfer
details could not be checked. Confirm directly with the property before arrival.` Neither means the
property has no service. Only explicit sourced `unavailable` may say `The provider reports no airport
transfer at this property.`

**Passes when:** every state answers or explicitly marks all four questions unresolved; hours never
inherit hotel check-in times; generic shuttle and airport-transfer services are not conflated; the
block appears once, not repeated in Amenities, Location, and Parking.

### D4 — Preserve the selected evidence unchanged through booking review

Add the normalized transport evidence to `HotelOffer` and `BookingHotelContext`, including both
inline-query and stored-context validation paths. Booking review must render the same canonical
detail state in `Supporting evidence` before the outbound provider action. It must not re-fetch,
recompute, upgrade, or infer transport from the review's location object.

The provider-handoff guidance must name the unresolved task: `Confirm airport-transfer cost, hours,
and required advance action with the provider before arrival.` When service is confirmed paid, also
state that the transport charge is separate from the displayed nightly room rate unless the source
explicitly includes it.

**Passes when:** all evidence states round-trip through both booking-context paths; source and fetch
time are unchanged; a confirmed result cannot become “not documented” at review; the outbound link
and affiliate markers remain untouched.

### D5 — Instrument state exposure without claiming unavailable outcome data

Define these events using low-cardinality values only:

- `hotel_transport_summary_viewed`: `offer_id`, `provider`, `transport_state`, `cost_state`,
  `anchor_kind`, `surface`, `viewport_group`;
- `hotel_transport_details_viewed`: the same fields plus `hours_state`, `action_state`;
- add the same transport dimensions to the existing provider-handoff and back-to-results events.

Fire an impression only after at least 50% visibility for one second, consistent with
`HotelDecisionAnalytics`; deduplicate by offer + evidence revision + surface. Do not send airport
instructions, free text, source payloads, or timestamps as analytics dimensions.

**Passes when:** duplicate React renders do not double-count; the not-documented and failed-check
states are distinguishable; handoff/return behavior can be segmented by transport state. Production
measurement remains blocked until `lib/analytics.ts` has a real transport; do not report behavioral
success from development console events.

## 5. State matrix for UXDES

| Evidence condition | Collapsed result | Expanded detail / booking review | Claim allowed? |
|---|---|---|---|
| Provider check loading | `Checking airport transfer…` | Loading status; preserve any last verified evidence separately | No new claim |
| Confirmed complimentary | `Complimentary airport transfer` | Service, direction/operator, cost, hours, action, source/update | Yes, with provenance |
| Confirmed paid, complete price | Amount + charge/trip basis | Same plus separate-from-room-rate warning | Yes, with valid `Money` |
| Confirmed paid, amount absent | `Paid; amount not documented` | Never omit the paid state; mark amount/bases individually | Paid only |
| Confirmed, cost unknown | `Cost not documented` | Explicit unknown cost; never style as complimentary | Service only |
| Explicit unavailable | `No airport transfer reported` | Attribute the no-service report to source/update | Yes, with provenance |
| Successful provider response omits field | `Airport transfer not documented` | Confirm with property; absence is not no service | No availability claim |
| Provider/network failure | `Airport transfer details could not be checked` | Retry/error language; confirm with property | No claim |
| Malformed/conflicting evidence | `Airport transfer details are unclear` | Name conflicting dimensions; confirm with property | No resolved claim |
| Airport distance, no confirmed transport | No distance on collapsed card | Straight-line caveat + not-documented/error transport sentence | Distance only |
| Hours documented, no arrival time | Existing state summary | Show hours + `Your arrival-time fit was not checked.` | Hours only |

## 6. Acceptance tests inherited by design

1. Search, normalize, cache, render, and booking-context code contain no rule that derives transport
   from distance, coordinates, hotel name, star class, `propertyType`, or generic airport proximity.
2. A paid transfer with missing amount never renders “free,” “included,” or an amount of zero.
3. A missing field never renders “No airport transfer”; only explicit current provider evidence may
   make that statement.
4. A rendered positive or negative service claim always has a recognized `sourceLabel` and valid
   `fetchedAt`; the claim count without both is zero.
5. Operating hours never become selected-arrival availability without an arrival timestamp and
   timezone. Current UI always says arrival fit was not checked.
6. The expanded airport-distance line contains the straight-line qualifier and transport
   not-documented/error qualifier. Collapsed results and booking review never invent a second
   proximity claim.
7. The result, expanded detail, and booking review use the same evidence revision and state.
8. At 375px and 1280px, long provider names, airport names, price bases, and instructions wrap with
   no overlap, truncation of cost state, or collision with Deal Score and booking actions.
9. The detail block is keyboard-reachable in reading order; any disclosure control has a visible
   focus ring, accurate `aria-expanded`, and an accessible name containing service and cost state.
10. Provider failure leaves existing hotel actions usable where a valid offer already exists; it
    never silently substitutes sample or stale transport evidence.

## 7. Risks, blockers, and out-of-scope findings

### Release blocker: retired hotel API

The current provider cannot return hotel results. This is broader than shuttle disclosure but is a
P0 supply/trust blocker. A separate DEV/provider ticket must replace or deliberately remove the
retired Hotellook path before any current hotel or transport claim can ship. This research does not
select or integrate that provider.

### Data-contract dependency

No current source supports confirmed transport states. UXDES must fully specify them so a future
provider can plug into one contract, but UI/DEV must gate them behind verified fields. Static demo
fixtures, hotel-name keywords, and old cached responses are not production evidence.

### Arrival-fit limitation

The current flow has no arrival time or property timezone. Showing hours is in scope; asking for an
arrival time, joining a flight itinerary, notifying the property, or booking a transfer is not.

### Analytics limitation

Event semantics can be implemented, but production measurement is blocked by the existing
development-only analytics transport. Fixing analytics infrastructure is outside this ticket.

### Explicitly out of scope

- check-in windows, desk hours, parking, bag storage, and flight-side layovers;
- public transit, rideshare/taxi estimates, route time, walkability, and driving directions;
- transfer booking, property contact, or special-request submission inside expaify;
- provider procurement or Hotellook replacement implementation;
- changing Deal Score to include transfer cost before a normalized, stay-specific cost contract
  exists.

## 8. UXDES handoff

UXDES must design every state in §5 at 375px and 1280px, including loading, successful omission,
source error, malformed/conflicting evidence, confirmed complimentary, confirmed paid with and
without amount, unknown cost, explicit unavailable, keyboard/focus, and booking-review continuity.
It must use the copy rules in D2–D4 and treat confirmed states as provider-gated. The current
shippable repair is the honest failed/not-documented state plus the airport-distance anti-inference
guard; it must not imply the retired Hotellook feed can populate verified service.
