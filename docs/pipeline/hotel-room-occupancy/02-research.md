# UXR-HOTEL-ROOM-OCCUPANCY-01 — Hotel Adult Room-Occupancy Fit Research Brief

Date: 2026-08-03  
Stage: UX Research  
Priority: P1  
Feature slug: `hotel-room-occupancy`  
Upstream: `docs/pipeline/hotel-room-occupancy/01-discovery.md`

## Recommendation

Adopt the discovery report's three-state model—**Confirmed fit**, **Does not fit**, and **Not
confirmed**—but make the claim about one exact adult count, room, rate, stay, and price. Do not use
a generic `Sleeps N`, bed label, property-level price, or successful two-adult default search as
evidence.

The current product can truthfully render only **Not confirmed**. It cannot collect or restore an
adult count, ask a hotel provider to shop for that count, retain a selected room/rate identity, or
show that the normalized price was returned for the requested adults. This is a structural supply
gap, not a copy-only issue.

UXDES should specify the complete conditional presentation and all three states, while treating
the current hotel-level offer as the default unsupported state. It must not design a positive fit
badge for production until a provider adapter can preserve the required bindings. Unknown offers
remain available for provider verification; they are neither confirmed nor rejected.

## Method and evidence limits

This brief combines:

- a source audit of hotel criteria, provider contracts/adapters, normalized offers, booking
  context, provider handoff, and return telemetry;
- an interaction-pattern and data-binding comparison using current Booking.com and Expedia
  examples and official integration documentation; and
- an expert walkthrough of the three discovery cases and edge conditions.

No participant sessions were run for this ticket, and the product has no occupancy-attributed
failure baseline. Therefore, the state model is validated here for logical sufficiency, not as
observed user comprehension. Section 5 defines the participant test needed before claiming that
the labels are understood.

The research stays within one room and an adult count. Child ages/policies, bed comfort, extra
beds, connecting rooms, and allocation across multiple rooms are explicitly out of scope.

## 1. Current-code evidence

### 1.1 Adult count exists in a type branch but is unreachable

`HotelSearchCriteriaV1` declares an `applied` occupancy branch containing adults, children, child
ages, and rooms (`lib/hotels/searchCriteria.ts:4–14`). The editable draft contains only city and
dates (`lib/hotels/searchCriteria.ts:17–21`), and every draft conversion writes
`occupancy: { state: 'not_captured' }` (`lib/hotels/searchCriteria.ts:108–122`).

Restoration is stricter: any `occupancy`, `adults`, or `rooms` parameter invalidates the criteria,
and a valid reconstruction again writes `not_captured` (`lib/hotels/searchCriteria.ts:140–183`).
The summary says `Guests & rooms not captured`, while the editor says this product cannot filter
by party size (`app/components/HotelSearchCriteria.tsx:59–66,230–234`).

**Observed baseline:** 0% of production hotel searches can carry a known requested adult count.
The declared `applied` branch is not evidence that the product supports it.

### 1.2 The provider request silently substitutes two adults

`HotelProvider.searchHotels` accepts area, stay dates, and optional location context; it has no
occupancy argument (`lib/types.ts:748–756`). Both active search integrations manufacture the same
unstated party:

- Booking.com's request URL hardcodes `adults=2&room_qty=1`; its cache key omits occupancy
  (`lib/providers/bookingComHotelsRapidApi.ts:125–150`).
- Hotelbeds sends `occupancies: [{ rooms: 1, adults: 2, children: 0 }]`; its cache key also omits
  occupancy (`lib/providers/hotelbeds.ts:183–214`).

The returned price is thus evidence about those adapter requests, not the traveler's party. A
future adult input cannot be added only to the interface: normalized query keys and six-hour
cache keys must include the requested adult count or one party can receive another party's price.

### 1.3 Normalization removes the room/rate evidence required to interpret price

`HotelOffer` carries a hotel/property `id` and `pricePerNight`, but no provider room ID, rate or
product ID, requested/quoted adults, maximum adults, price occupancy basis, provider request ID,
or evidence timestamp/expiry for occupancy (`lib/types.ts:687–711`). The booking context repeats
the same hotel-level shape and has no adult-fit evidence (`lib/booking/config.ts:70–98`).

The gaps are concrete in each adapter:

- The Booking.com integration normalizes `hotel_id` and a property-level gross price, then drops
  any room/rate identity and occupancy binding (`lib/providers/bookingComHotelsRapidApi.ts:161–200`).
- Hotelbeds types a room as only `rates[]` and a rate as only `net`/`rateClass`
  (`lib/providers/hotelbeds.ts:27–44`). `lowestRateCents` scans every room/rate, returns only the
  lowest number, and the offer emits only the property code (`lib/providers/hotelbeds.ts:85–98,
  245–281`). Even if the upstream payload contains more identifiers or occupancy detail, the
  local type and normalizer do not preserve them.
- `buildBookingHotelContext` copies property offer ID, price, currency, and provider URL but no
  room/rate/adult evidence (`lib/booking/config.ts:1206–1238`). The handoff therefore cannot restore
  the proof after a user selects a result.

Consequently, current cards compare hotel-level nightly prices. They do not compare selected
room/rate products, even when nearby headings say `Room & rate details`.

### 1.4 Current language correctly warns, but cannot resolve the decision

The criteria summary tells users to confirm price and room fit with the provider. The booking
handoff similarly states that the provider shows room options, live availability, and final total
(`app/book/BookingFlow.tsx:1149–1153`). This avoids a false guarantee, but it postpones the decision
instead of distinguishing a known fit, explicit non-fit, and missing evidence.

No current hotel card, detail, or handoff component can truthfully say:

- `Fits 3 adults — price shown for 3 adults`, or
- `Does not fit 3 adults — this room allows up to 2 adults`.

The honest current statement is the unknown state: the shown hotel-level price is not bound to an
identified room/rate for the traveler's adult count.

### 1.5 Existing telemetry cannot calculate failed adult-occupancy selections

The handoff creates a session ID when a traveler opens the provider, detects a return through page
visibility, and presents optional mismatch feedback (`app/book/BookingFlow.tsx:940–1015,
1099–1123`). This is a useful integration point.

However, its reasons combine adult occupancy with unrelated causes:

- `Room availability did not match` does not say whether adults exceeded a limit, the room sold
  out, or dates changed;
- `Price or fees did not match` does not say whether the price changed because the requested adult
  count differed; and
- `Smoking policy or room did not match` explicitly combines different concerns
  (`app/book/BookingFlow.tsx:49–64`).

The denominator also lacks requested adults, room ID, and rate ID. `hotel_handoff_returned` records
only provider, host, and time-away bucket in the analytics allowlist
(`app/api/analytics/route.ts:37–40`). A provider tab open is not proof that the traveler attempted
to select a room/rate.

**Result:** the discovery metric cannot be calculated today, and the broad room-availability
reason must not be relabeled as an adult-occupancy failure.

## 2. Reference-pattern guidance

These references provide interaction and binding patterns, not a visual template. OTA inventory,
commercial relationships, and data access differ from expaify's current affiliate-first model.

### 2.1 Booking.com: search party persists into a room/rate comparison table

A current Booking.com property availability page keeps the searched party visible above the room
table (`2 adults · 1 child · 1 room`). Within each room row, room type and bed wording are separate
from a dedicated `Number of guests` column that exposes `Max adults` and `Max children`; the price
and rate conditions sit in adjacent columns. This prevents the bed label from being the only
capacity cue. [Booking.com property availability example](https://www.booking.com/hotel/zw/redcliff-redcliff1.en-gb.html)

The official Booking.com Demand API pattern reinforces the binding: an availability request sends
`number_of_adults` and `number_of_rooms`, while each returned product includes a product ID,
`maximum_occupancy.adults`, total capacity, price, and room ID. Its documentation explicitly shows
that maximum adults can be lower than total capacity, so a generic total cannot substitute for
adult capacity. [Booking.com occupancy and allocation use cases](https://developers.booking.com/demand/docs/accommodations/occupancy-use-cases)

Useful pattern for expaify:

- repeat the requested adults where the user evaluates the rate;
- state adult capacity independently from total guest capacity and beds;
- bind the capacity and price to the same provider product and room; and
- treat rate conditions as part of the selected product, not hotel-level metadata.

Limitation: Booking.com can own room selection and checkout. expaify currently shows a hotel-level
price and hands room selection to a provider, so it must show **Not confirmed** rather than imitate
a confirmed table row.

### 2.2 Expedia: occupancy-scoped shopping plus rate-specific price check

Expedia Rapid's documented flow calls Shopping with stay dates, occupancy, and property IDs. The
response returns available rooms with specific rates and prices, and the selected rate is then
verified through its tokenized price-check link before booking. A matched check proceeds; a price
change returns updated price data; an unavailable rate sends the traveler back to shop.
[Expedia Rapid lodging flow](https://developers.expediagroup.com/rapid/lodging)

The Shopping documentation also distinguishes an adult-specific negative from generic
unavailability: `adults_exceed_threshold` includes the allowed threshold for the requested
occupancy. It warns that not every unavailable property has an actionable reason. That means a
generic sold-out or missing result is not adult non-fit evidence.
[Expedia Rapid Shopping API](https://developers.expediagroup.com/rapid/lodging/shopping/about-shopping-api?locale=en_US)

Useful pattern for expaify:

- availability and price are outputs of the requested occupancy, not static room facts;
- carry property ID + room ID + rate ID or the provider's opaque selection token together;
- revalidate a selected rate before presenting a current price claim; and
- use an adult-specific structured rejection for **Does not fit**; generic unavailability remains
  unclassified.

Limitation: a token or dynamic rate ID may be short-lived. Expedia explicitly says its tokenized
links expire, so an ID alone is not sufficient without observed/expiry time and exact request
context.

### 2.3 Exact delta

| Decision layer | Reference pattern | expaify today | Required delta |
|---|---|---|---|
| Requested party | Adults explicitly searched and repeated | Not captured; two adults silently substituted | Capture one positive adult count and preserve it end to end |
| Adult admission | Adult-specific maximum or eligibility per product | No normalized adult evidence | Retain provider-structured adult admission or adult-specific rejection |
| Generic capacity | Separate from max adults and beds | Not modeled, but could be mistaken for room fit later | Never promote `sleeps`/total guests/bed labels into adult fit |
| Price applicability | Rate returned for requested occupancy; selected rate rechecked | Hotel-level nightly price detached from room/rate | Bind money + basis + quoted/requested adults to the same room/rate/stay |
| Failure | Adult-threshold reason distinguishable from sold out/changed price | Broad optional return reasons | Add an occupancy-specific proxy now; use provider price-check outcomes when integrated |
| Missing evidence | No positive claim without rate availability | Generic warning only | Render **Not confirmed**, keep the option available for verification |

## 3. Provider evidence and binding contract

### 3.1 Minimum inputs and evidence

The fit resolver needs all of the following for one room:

| Category | Minimum field/evidence | Why it is required |
|---|---|---|
| Traveler request | `requestedAdults` as a positive safe integer | Defines the party being evaluated |
| Search scope | `checkIn`, `checkOut`, `roomCount: 1` | Prevents evidence reuse across a different stay or multi-room request |
| Supplier scope | canonical `supplier`, `propertyId` | Prevents cross-provider/property attachment |
| Product scope | `roomId` plus `rateId`/`productId`, or one provider-issued opaque selection token binding both | Proves which room and commercial rate the evidence describes |
| Adult admission | structured `maximumAdults` or explicit provider eligibility/rejection for `requestedAdults` | Distinguishes adult capacity from total guests and beds |
| Price applicability | `quotedAdults` or a preserved provider availability request showing this product/price was returned for `requestedAdults` | Proves the price denominator |
| Money | `{ priceCents, currency }` plus price basis/stay basis | Keeps the existing integer-money contract and explains what is priced |
| Freshness | provider `requestId`/offer token when available, `observedAt`, and `expiresAt` or adapter TTL | Prevents stale evidence from making a current claim |

`criteriaVersion` should bind the user-facing adult input to the provider query. The normalized
cache key must include supplier, destination/property scope, dates, requested adults, and one-room
scope. The handoff context must preserve the same evidence; reconstructing it from the property ID
or room name is not acceptable.

If a provider does not echo `quotedAdults`, the adapter may preserve the exact availability
request as price applicability only when: the response is causally tied to that request; the room
and rate came from that response; no adapter merges results from another occupancy; and the cache
key includes the adult count. This is a binding rule, not an inference from room capacity.

### 3.2 Exhaustive state rules

**Confirmed fit** requires every condition below:

1. `requestedAdults` is known and matches the current criteria version;
2. structured evidence admits at least that adult count, or the provider explicitly returned the
   room/rate as eligible for that exact occupancy;
3. the displayed price was returned or revalidated for exactly `requestedAdults`;
4. supplier, property, room, rate/product, dates, one-room scope, money, and freshness bindings all
   match; and
5. no equally scoped evidence conflicts.

Required meaning: `This room and rate fit 3 adults. Price shown for 3 adults.` A room may allow
four adults and confirm a three-adult party; equality between party size and maximum is not
required.

**Does not fit** requires a current, structured, adult-specific rejection bound to the same
selected room/rate/stay, such as `maximumAdults: 2` for three requested adults or an explicit rate
eligibility rejection for that adult count. Required meaning: `Does not fit 3 adults. This room
and rate allow up to 2 adults.`

The following do **not** create **Does not fit**: no search result, sold out, expired rate, generic
availability error, generic `maximum guests`, property policy, bed count, or missing occupancy
data. Those causes do not prove adult incompatibility.

**Not confirmed** is the exhaustive fallback. It applies when any required input/evidence/binding
is missing, stale, malformed, property-level only, generic to guests, attached to another
room/rate/stay/adult count, or conflicting. Required meaning: `Adult occupancy and price fit are
not confirmed for this room and rate. Confirm the adult count and updated price with the provider.`

If the UI has only a hotel-level from-price and no selected room/rate, the same state must say so
plainly: `This is a hotel-level price. Adult fit is confirmed after you choose a room and rate with
the provider.` The option remains actionable; unknown is not a filter-out rule.

### 3.3 Conflict precedence

An explicit negative does not automatically outrank conflicting evidence. If adult limits or
quoted counts disagree at the same scope, degrade to **Not confirmed** and show neither a positive
nor negative outcome until revalidation resolves the conflict. Only a single current,
adult-specific, correctly bound rejection produces **Does not fit**.

Property admission rules, such as minimum guest or check-in age, must stay in the existing policy
surface. They cannot change this room/rate adult-count state.

## 4. Expert case walkthrough

These are contract tests and likely comprehension risks, not participant findings.

| Case | Evidence | Correct state | Forbidden conclusion |
|---|---|---|---|
| Generic capacity | 3 adults requested; room says `Sleeps 4`; hotel-level price | **Not confirmed** | Four adults are admitted or three-adult price applies |
| Bed label | 3 adults requested; `2 queen beds`; no adult/rate evidence | **Not confirmed** | Bed count proves comfort, admission, or price |
| Exact positive | 3 adults requested; product max adults 4; same room/rate returned and priced for 3 adults | **Confirmed fit** | Room maximum must equal requested count |
| Exact negative | 3 adults requested; selected room/rate explicitly allows max 2 adults | **Does not fit** | A second room should be added automatically |
| Price denominator mismatch | 3 adults requested; room admits 3; displayed rate quoted for 2 adults | **Not confirmed** | Admission alone confirms the displayed price |
| Property from-price | 2 adults requested; hotel price has no room/rate identity | **Not confirmed** | Cheapest property rate belongs to a suitable room |
| Changed rate | Fit was confirmed, but price check returns a new price | **Not confirmed** until new money/evidence is accepted and rebound | Old price remains confirmed |
| Sold out | Selected rate becomes unavailable without adult-specific reason | **Not confirmed** for adult fit; separately unavailable | Sold out means the adult count did not fit |
| Conflicting limits | Same product returns max adults 2 and 3 at equal scope/freshness | **Not confirmed** | Choose either value silently |
| Missing provider data | No adult fields or request binding | **Not confirmed** | Missing means non-fit |

The walkthrough retains exactly three states. `Price mismatch` is not a fourth fit state: it removes
the evidence needed for a combined adult-admission-and-price claim and therefore resolves to **Not
confirmed** until a newly quoted price is bound.

## 5. Validation and measurement plan

### 5.1 Comprehension study

Run a within-subject moderated test with 8–10 first-time expaify users who have independently
booked a hotel for two or more adults in the past year. Show the generic-capacity, exact-positive,
exact-negative, price-denominator-mismatch, and missing-data cases from Section 4. Randomize the
first three cases and keep beds/children/multiple-room controls out of the task wording.

Ask before any confidence rating:

1. `Can these 3 adults book this room at the price shown?`
2. `What evidence on the screen led you to that answer?`
3. `What would you do next?`

| Measure | Operational definition | Pass threshold |
|---|---|---|
| Three-state classification | Participant selects confirmed fit / does not fit / not confirmed | At least 85% correct across cases; at least 7/8 correct per core case in an 8-person round |
| False-positive fit | Treats generic guest maximum, room name, or beds as proof | 0 participants after viewing full evidence unit |
| False negative | Treats missing evidence as does not fit | No more than 10% of unknown-case responses |
| Price applicability | Correctly identifies whether shown price covers requested adults | At least 85% correct on positive and denominator-mismatch cases |
| Decision time | First exposure to correct spoken/selected classification | Median under 15 seconds on positive and negative cases; report unknown separately |

Do not claim these thresholds were met from this desk research. UXDES should make the evidence and
adult count visible in one semantic unit so the prototype can test them.

### 5.2 Resolved failed-selection proxy

Because expaify does not own provider room selection or receive an affiliate callback, use an
explicitly named **adult-occupancy mismatch return rate** as the near-term observable proxy—not as
the exact provider failed-selection rate:

`unique handoff sessions self-reporting adult limit or adult-count repricing / unique provider handoff sessions with known requestedAdults`

Add two mutually exclusive return reasons only when adult count is captured:

- `The room did not allow this many adults`
- `The price changed for this many adults`

Preserve `handoffSessionId`, `criteriaVersion`, requested-adult-count bucket, provider, property
offer ID, and pre-handoff fit state on both numerator and denominator events. Do not send a room or
rate ID from the provider page unless the provider returns it to expaify; the current affiliate
handoff cannot observe a provider selection. Deduplicate at one reason per session and report the
feedback response rate beside the proxy, because silence is not success.

This resolves a measurable baseline path using the existing continue → return → optional feedback
mechanism. It remains self-reported and can undercount failures when users do not return or answer.
Do not combine the two reasons with sold-out, dates, child policy, beds, fees, or multiple-room
needs.

When an integrated provider room/rate flow exists, replace the proxy with the exact metric:

`adult-specific rejected selections or adult-count price changes / room-rate price-check attempts
with known requestedAdults`

Count only structured provider outcomes bound to the attempted property/room/rate/stay/adult
request. Expedia's adult-threshold unavailable reason and price-check `price_changed` pattern show
a viable integration path; generic `sold_out` does not enter the adult-specific numerator.

## 6. Design directives

### D1 — Make one adult count a required, persistent denominator

For the conditional design, collect a positive whole-number `Adults` value for one room and repeat
`N adults · 1 room` in search summary, result evidence, detail, and handoff. Preserve it through
criteria version, provider request, occupancy-specific cache key, normalized offer, and booking
context. This directive does not authorize child, bed, or multiple-room inputs.

**Test:** changing adults from 2 to 3 creates a new criteria version/query/cache key; no displayed
fit or price evidence from the two-adult response survives, and refresh/back navigation restores
the three-adult value.

### D2 — Render only the exhaustive three-state contract

Use exactly **Confirmed fit**, **Does not fit**, and **Not confirmed**, applying the rules in
Section 3.2. Pair every outcome with the requested count and price applicability in the same
always-visible semantic unit. Do not use a color-only signal or a bare check/cross/question icon.

Required core copy:

- `Fits 3 adults — price shown for 3 adults.`
- `Does not fit 3 adults — this room and rate allow up to 2 adults.`
- `Adult fit not confirmed — confirm the adult count and updated price with the provider.`

**Test:** screen-reader and visual reading order yields outcome → requested adults → price meaning;
at 375px and 1280px, the full sentence remains readable without hover, truncation, or overlap.

### D3 — Gate positive and negative claims on room/rate/stay bindings

Implement one pure resolver with machine-readable reasons. **Confirmed fit** and **Does not fit**
must validate supplier, property, room, rate/product or opaque selection token, dates, one-room
scope, requested adults, price applicability, and freshness. Missing, stale, mismatched, malformed,
or conflicting bindings return **Not confirmed**. A hotel-level price can never produce either
strong state.

**Test:** fixtures independently mismatch each binding key; every fixture resolves to
`not_confirmed`. Only an exact bound positive returns `confirmed_fit`, and only an exact structured
adult rejection returns `does_not_fit`.

### D4 — Keep adult fit separate from capacity, beds, children, and allocation

Label provider evidence `Adults` or `Maximum adults`, never generic `Guests`, when it drives this
state. `Sleeps N`, total capacity, room names, beds, cots/rollaways, child ages, child prices,
connecting rooms, and suggestions to add rooms may appear only in their owning future surfaces and
must not feed the adult-fit resolver.

**Test:** adding or changing only total guests, bed count/type, child fields, or a multiple-room
recommendation leaves the adult-fit outcome unchanged.

### D5 — Preserve unknown options and instrument the handoff proxy precisely

Do not filter, disable, demote, or label a result incompatible because occupancy evidence is
missing. Keep the provider action available with the **Not confirmed** explanation. On return,
offer the two exact adult-specific feedback reasons in Section 5.2 and keep other mismatch causes
separate. If the provider supplies a structured price-check, revalidate before restoring a strong
fit state.

**Test:** missing/generic/conflicting evidence leaves the provider action keyboard-operable;
choosing an adult-specific return reason emits one deduplicated session event with known adults,
while sold-out, child, bed, fee, and multi-room reasons cannot enter the adult-mismatch numerator.

## 7. UXDES handoff

`UXDES-HOTEL-ROOM-OCCUPANCY-01` should produce
`docs/pipeline/hotel-room-occupancy/03-design.md` covering:

- current default **Not confirmed** for hotel-level offers;
- conditional **Confirmed fit** and **Does not fit** states once provider bindings exist;
- loading, error, stale, conflict, missing-data, and price-changed transitions;
- exact copy and hierarchy on result, detail, and provider-handoff surfaces;
- adult-count edit/restore behavior for one room only;
- keyboard/focus/live-region behavior and 375px/1280px layouts; and
- the self-reported mismatch proxy, explicitly labeled as a proxy.

The design spec must not imply that current adapters can supply strong states. Production
implementation requires coordinated provider/type/cache/booking-context work; a UI-only badge on
today's `HotelOffer` would conflict with the evidence contract.
