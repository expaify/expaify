# UXR-HOTEL-NOISE-FIT-01: Hotel Quiet-Stay Fit

Date: 2026-07-22  
Stage: UX Research  
Priority: P0  
Upstream: `docs/pipeline/hotel-noise-fit/01-discovery.md`

## Research question

Can a traveler compare hotels and correctly distinguish:

1. a provider-documented sound-control or quiet-room fact;
2. location context that may expose a stay to an external noise source;
3. attributed guest opinion about noise; and
4. no usable evidence;

without concluding that expaify has measured the room, guaranteed quietness, or
sent a quiet-room request?

## Executive finding

No. The current product has **zero normalized quiet-stay evidence** and no active
hotel-results surface on which to compare it. `HotelOffer` can carry location and
a fixed access/room-request evidence list, but that list rejects every quiet or
noise item. Hotellook maps no soundproofing, quiet-room, environmental, or review
theme field. The booking context then drops all amenity evidence and carries only
hotel identity, location, price, provider, and redirect URL.

More importantly, the current hotel supplier is not merely sparse: Travelpayouts
states that the Hotellook API and landing pages stopped working on October 20,
2025. The adapter still calls that API and still constructs Hotellook affiliate
links. No current result can therefore support a new quiet-stay claim or a
reliable handoff.

The safe design direction is an **evidence ledger, not a quietness score**. It
must keep three evidence classes separate:

- provider facts about a property, room, or selected stay;
- factual proximity/context from a licensed geospatial source; and
- attributed guest-review themes from a licensed review source.

No class can stand in for another. “Near a railway” does not mean the assigned
room will be noisy; “guests mention noise” is opinion, not an acoustic
measurement; “quiet room requestable” is not transmission or confirmation.

Because every current class is absent, do **not** add an all-unknown quiet badge
to collapsed cards. UXDES should specify the full evidence states for future
provider-backed use, plus a single expanded fallback. The existing
special-request design remains the owner of quiet-room request guidance at the
handoff and must not be duplicated.

## Inputs and method

### Current-code evidence audited

- `lib/types.ts` — `HotelRatingEvidence`, `HotelAmenityEvidence`,
  `HotelLocation`, `HotelOffer`, and `HotelProvider`.
- `lib/providers/hotellook.ts` — live payload, cached normalization, six-hour
  cache, location mapping, affiliate deeplink, and result boundary.
- `lib/providers/hotelAmenityEvidence.ts` — fixed evidence vocabulary and
  certainty validation.
- `app/api/search/route.ts` — hotel and access-status streaming.
- `app/components/HotelCard.tsx` — collapsed and expanded evidence hierarchy.
- `lib/booking/config.ts` and `app/book/BookingFlow.tsx` — review-context
  serialization and provider handoff.
- `lib/analytics.ts` — development-only event logging.
- `lib/airports/data.ts` and `lib/airports/nearby.ts` — partial local airport
  coordinates and current distance helper.
- Repository-wide production-import and JSX search for `HotelCard`.

### Settled upstream work reused, not forked

- `hotel-amenity-provenance/02-research.md`: canonical evidence status, source,
  scope, freshness, and missing-data discipline.
- `hotel-location-decision-context/02-research.md`: location precision and
  handoff continuity.
- `hotel-review-relevance/02-research.md`: licensed, attributed review themes;
  `noise` is one closed theme and cannot be inferred from aggregate ratings.
- `special-requests/02-research.md` and `03-design.md`: selected, transmitted,
  acknowledged, and guaranteed are different states; current capability is
  guidance-only.
- `hotel-workspace-fit/02-research.md`: a quiet-work signal may use only a
  provider-documented concrete fact and must not synthesize quietness.

### External reference patterns

The comparison is at the evidence and interaction-contract level, not visual
style.

1. **Booking.com Demand API.** Property details can return structured property
   and room facilities, while availability is retrieved through separate
   endpoints. Review endpoints and statistical review scores are available only
   when the partner agreement permits them. An optional `special_requests`
   string belongs to order creation after product selection and explicitly
   cannot be guaranteed. Sources: [Booking.com accommodation API
   overview](https://developers.booking.com/demand/docs/accommodations/about-accommodation)
   and [Booking.com order creation](https://developers.booking.com/demand/docs/orders-api/order-preview-create).
2. **Google Hotels.** Results expose a compact snapshot, while the property
   detail separates location, reviews, rooms, and amenities. Google states that
   amenity information comes from hoteliers, websites, partners, research, and
   user feedback; third-party review topic summaries are separately attributed
   to TrustYou. Clicking a booking link transfers completion and service to the
   partner. Source: [Google Travel Help — Search for
   hotels](https://support.google.com/travel/answer/6276008?hl=en).
3. **Current-provider viability.** Travelpayouts states that the Hotellook
   affiliate program closed on October 20, 2025; its API, widgets, and landing
   pages stopped working, while only some historically productive links may
   redirect. Source: [Travelpayouts — FAQ on the closure of
   Hotellook](https://support.travelpayouts.com/hc/en-us/articles/29534131568530-FAQ-on-the-closure-of-Hotellook).

No participant study or production behavior dataset was available. The
directives below combine code audit and desk research; the validation protocol
is required before any claim of user comprehension.

## Current implementation audit

### 1. The shared hotel contract has no quiet-stay field

`HotelOffer` carries location, class/rating evidence, money, provider handoff,
and `amenityEvidence` (`lib/types.ts:169-185`). `HotelAmenityEvidence` has useful
provenance fields—`status`, `scope`, `sourceLabel`, `fetchedAt`, `confidence`,
and `certainty` (`lib/types.ts:119-147`)—but it does not identify the evidence
class or support contextual distance/method, review sample/window, conflicts, or
staleness.

`HotelProvider` is search-only and returns `Result<HotelOffer[]>`
(`lib/types.ts:213-220`). It has no property-details, review, order, request, or
message method. The UI cannot observe request transmission or property response.

### 2. The amenity normalizer actively excludes quiet/noise evidence

`lib/providers/hotelAmenityEvidence.ts` recognizes exactly seven access facts:
elevator, parking, step-free route, and four room preferences. An unknown id is
dropped. Therefore adding `quiet_room`, `soundproof_rooms`, or `noise` to a
cached payload would not make it through the existing normalizer.

The certainty validation is nevertheless a sound precedent:

- a property fact can be confirmed only at property scope with supported
  certainty;
- a room request can be `requestable` at room/selected-stay scope; and
- a room attribute can be guaranteed only for a selected stay.

Quiet-stay design should reuse that discipline, not reuse the access vocabulary
or pretend contextual evidence is an amenity.

### 3. Hotellook supplies no evidence and is no longer viable

The typed live entry includes id, name, class, location/address/coordinates,
distance, price, photo, property type, and an internal `amenityEvidence` escape
hatch (`lib/providers/hotellook.ts:11-30`). Live normalization builds location,
price, quality, and the fixed access evidence only
(`lib/providers/hotellook.ts:453-495`). Cached normalization likewise preserves
only the known hotel/access fields (`:320-386`). No code reads `quiet`, `noise`,
`soundproof`, road/rail/nightlife/construction context, review text, or a noise
subscore.

The adapter calls `engine.hotellook.com/api/v2/cache.json`, caches normalized
offers for 21,600 seconds, and constructs a Hotellook affiliate redirect
(`lib/providers/hotellook.ts:402-499`). This local implementation conflicts with
the provider's published closure state. It is an out-of-scope P0 provider
blocker, but it means UXDES must not label any current state “provider checked.”

### 4. Location enables orientation, not exposure evidence

`HotelLocation` can represent exact address, coordinates, area, search area, or
missing precision (`lib/types.ts:151-167`). Hotellook preserves address or paired
coordinates when returned and otherwise falls back to area-level context.

This is necessary but not sufficient for environmental evidence:

- exact/paired coordinates allow a future adapter to calculate factual
  straight-line proximity to a documented source;
- area/search-area labels cannot support a property-to-road, rail, airport, or
  nightlife distance;
- the current `distance` field is normalized as distance to “city center,” not a
  noise source;
- `lib/airports/data.ts` contains partial, un-attributed coordinates, with many
  airports missing coordinates. It is unsuitable as a user-facing evidence
  source until provenance, coverage, and update policy are documented;
- no road, rail, nightlife, event, construction, flight-path, measured-decibel,
  or time-of-day dataset is integrated anywhere.

Even a correct distance would describe proximity only. It cannot establish
flight path, traffic volume, operating hours, facade insulation, room
orientation, floor, temporary events, or the assigned room's exposure.

### 5. Review evidence cannot support a noise theme today

`HotelRatingEvidence` contains only aggregate value/scale, source, review count,
fetch time, and confidence (`lib/types.ts:109-117`). The live provider produces
no verified guest rating; the cached allow-list has no themes, review dates, or
licensed review text (`lib/providers/hotellook.ts:280-317`).

Per `hotel-review-relevance`, the future theme id `noise` may be shown only from
a licensed provider contract, with guest-opinion framing and source attribution.
It must not be derived from star class, aggregate rating, review count, location,
price, photos, or `fetchedAt`.

### 6. The comparison card is currently dormant

`HotelCard` has a strong evidence hierarchy and responsive layout, but a
repository-wide search finds no production import or JSX use; it is referenced
only by component tests. The current `app/page.tsx` is a marketing landing page,
and `DealFeed` renders a separate `DealCard` model. The API still streams
`hotels`, `hotel-status`, and `hotel-access-status`, but no mounted client consumes
those hotel events.

This is a material scope constraint: designing only `HotelCard` would not make
quiet-stay evidence visible to users. UXDES must name the target hotel-comparison
surface and mark production mounting as required upstream work; this UXR ticket
does not repair the inactive search flow.

### 7. Handoff continuity and measurement are absent

`BookingHotelContext` carries hotel/offer identity, provider, location, integer
price, currency, price basis, and provider URL (`lib/booking/config.ts:18-29`).
`buildHotelBookingHref` serializes those fields but no amenity, quiet-stay, review,
or evidence-seen state (`:360-386`). `HotelSummary` and the responsibility panel
therefore cannot repeat evidence selected during comparison.

The handoff does emit view, continue, back, and returned events, but
`lib/analytics.ts` only writes `console.debug` in development. There is no
production destination, quiet-evidence event, request-guidance event, or
decision-confidence measure. An outbound click proves only navigation, never a
request.

## Provider and data capability matrix

| Evidence class | Current code / supplier | Candidate licensed path | What may be claimed | What must not be claimed |
|---|---|---|---|---|
| Provider fact: soundproofing / quiet-room designation | None. Hotellook maps no such field and its API is closed | A contracted accommodation-details provider may expose property/room facilities; Booking.com documents a facilities/rooms contract, but the exact quiet/soundproof facility ids and expaify's rights must be verified before mapping | “Provider lists soundproofing for the property/room,” with source, scope, and freshness | “Quiet hotel,” measured acoustic performance, or selected-room coverage from a property-level flag |
| Quiet-room request capability | None. Search-only affiliate redirect; no order or receipt | A booking/order provider may accept a special request after a room product is selected | “Requestable” only when a documented field is available; “sent” only after adapter success and a provider receipt | Selection, CTA click, or URL query string means sent/acknowledged/guaranteed |
| Selected-stay guarantee | None | Selected inventory or explicit provider/property response tied to the stay | “Confirmed for this stay” only with that direct evidence | Generic facility, request submission, or booking confirmation is a guarantee |
| Airport context | No usable source. Some property and airport coordinates exist locally, but the airport data is partial and un-attributed | Licensed/attributable airport geometry plus provider-exact property coordinates | “X km straight-line distance from {airport},” source and method shown | Flight-path exposure, aircraft-noise level, or noisy room |
| Major-road / rail context | None | Licensed/attributable road and rail geometry with defined feature classes and refresh policy | Factual proximity to the named/documented feature | Traffic/train frequency, operating hours, facade exposure, or noise level without separate evidence |
| Nightlife context | None | Licensed POI dataset with category, source, coverage, and refresh policy | Count/proximity of documented nightlife venues within a disclosed radius | A neighborhood is noisy, a venue is operating on the stay dates, or the room will hear it |
| Temporary works / events | None | Authoritative local feed with address/geometry, start/end dates, update time, and reuse rights | A named documented project/event is scheduled near the property for the stay window | Construction/noise from scraped notices, undated pages, or citywide alerts |
| Guest noise theme | None; no review text/category score/date | Contracted review endpoint explicitly licensed for display/derivation. Booking.com notes review access is agreement-dependent | “Guests mention/report noise,” with source, sample/window, and hedging | expaify factual claim, quote/snippet without display rights, or a theme inferred from aggregate rating |

**Feasibility conclusion:** all three evidence classes are desirable, but none is
currently shippable as populated data. Provider-fact and licensed review paths
are plausible future integrations. Environmental context requires a separate
licensed geospatial adapter and source-specific validation; temporary works is
the least feasible cross-market category and should not be in the first enabled
set.

## Reference-pattern delta

| Decision point | Reference pattern | expaify now | Exact delta |
|---|---|---|---|
| Scan / compare | Google shows a compact result snapshot and moves richer location, review, room, and amenity evidence into property detail | Dormant `HotelCard`; no quiet evidence on any mounted hotel feed | Define a compact confirmed-evidence summary only after the target comparison surface is mounted; do not add an all-unknown badge |
| Inspect basis | Google separates amenity sources from review-topic summary sources; Booking.com separates details/facilities, availability, reviews, and orders | One generic amenity model plus aggregate rating and location; no evidence-class label | Add explicit `Provider fact`, `Nearby context`, and `Guest review theme` groupings with separate provenance |
| Request a quieter room | Booking.com accepts a non-guaranteed request during order creation after room-product selection | Affiliate redirect before room/rate selection; no order or request method | Keep provider-directed guidance from `special-requests`; no selectable quiet-room control in expaify |
| Provider handoff | Google tells users that booking completion and servicing move to the partner | Review repeats price/location only | Carry only actual evidence into review, state its limits, and keep request status separate from evidence |

The reference lesson is not “add a quiet filter.” It is to keep source types and
service states visible at the decision where each becomes relevant.

## Evidence taxonomy for UXDES

Use one `quietStayEvidence` container, but do not flatten its children into a
single verdict or score.

### A. Provider facts

Candidate canonical ids:

- `soundproofing_property`
- `soundproofing_room`
- `quiet_room_option`

Reuse the settled amenity provenance fields: `status`, `scope`, `sourceLabel`,
`fetchedAt`, `confidence`, and `certainty`. Apply these rules:

- `soundproofing_property` may never imply every room is soundproofed.
- `soundproofing_room` may describe a room type, but not the selected stay unless
  the selected product is bound to it.
- `quiet_room_option` is `requestable` unless the selected stay or explicit
  property response proves `guaranteed`.
- A provider omission is `not_returned`, not `unavailable` and not “no
  soundproofing.”

### B. Nearby context

Candidate categories, in recommended feasibility order:

1. `airport`
2. `rail`
3. `major_road`
4. `nightlife`
5. `temporary_works` — disabled until an authoritative stay-date-aware source
   exists.

Every item requires: `category`, named `referencePoint`, `distance`, distance
`method`, `sourceLabel`, `sourceUpdatedAt`, and property location precision. It
also needs a data state separate from a property-fact status:

- `ready`
- `not_returned`
- `insufficient_location`
- `stale`
- `conflicting`
- `error`

Only `exact` or paired `coordinates` property precision may produce a distance.
Use “nearby context” or “proximity,” never “noise exposure,” “noise risk,”
“quiet,” “loud,” “safe,” or a red/amber/green risk scale.

### C. Guest-review theme

Reuse the `hotel-review-relevance` owner and its fixed `noise` theme; do not
create a second review type. A populated item needs source, sample/count where
supplied, sentiment or provider-computed subscore, and a provider-sourced review
window. Copy must lead with `Guests mention…` or `Guests report…` and show
`Summary of guest reviews via {sourceLabel}`.

Do not show review text, quotes, or a generated summary without explicit license.
Do not substitute aggregate review freshness or rate-fetch freshness for the
noise theme's own observation window.

### D. Overall state

The container may report coverage, never fit:

- `evidence_available` — at least one valid item in any class;
- `no_evidence_returned` — providers responded but supplied no valid item;
- `checking` — an independent evidence request is active;
- `check_failed` — inventory exists but the evidence request failed.

Forbidden overall labels: `Quiet`, `Likely quiet`, `Noisy`, `Low noise`, `High
noise`, `Quiet-stay score`, or any roll-up badge. Evidence can conflict without
one source being wrong—for example, provider-listed soundproofing and guest
reports of street noise—so the UI must preserve both rather than compute a tie.

## Exact copy rules and fallback states

| State | Required visible copy | Rule |
|---|---|---|
| No class returned | `Quiet-stay details were not provided by this hotel source. Location and rating do not tell us whether a room will be quiet.` | Expanded detail only; never `No noise` or `No quiet rooms` |
| Checking | `Checking quiet-stay evidence…` | Independent status; hotel price and CTA remain usable |
| Check failed | `Quiet-stay evidence could not be checked. Confirm room location, soundproofing, and current surroundings with the booking partner.` | Do not imply hotel inventory failed |
| Insufficient location | `Property-level proximity cannot be calculated from the area information provided.` | Do not display a distance or contextual category |
| Stale context | `Nearby context is out of date and is not shown.` | Suppress the stale claim; source/freshness remains inspectable |
| Conflicting sources | `Sources differ. Review each source before deciding.` | Show each valid item with its own source/date; do not resolve automatically |
| Provider property fact | `Provider lists soundproofing for this property. It may not apply to every room.` | Requires confirmed property-scoped evidence |
| Provider room fact | `Provider lists soundproofing for this room type. Confirm the selected room before payment.` | Requires confirmed room-scoped evidence |
| Requestable quiet room | `A quieter room can be requested. Requests depend on availability and are not guaranteed.` | Only when the provider contract proves request capability; still not sent |
| Selected-stay guarantee | `Provider confirms this quiet-room attribute for the selected stay.` | Only selected-stay evidence; do not use for subjective quietness |
| Nearby context | `{Reference point} is {distance} {unit} away in a straight line. Proximity does not predict noise in a specific room.` | Requires exact/coordinate property location and attributable source |
| Guest theme | `Guests mention {provider-supplied noise summary}. Summary of guest reviews via {sourceLabel}.` | Hedged and licensed; show sample/window when provided |

## Design directives for UXDES

### D1 — Design three evidence groups; prohibit a roll-up verdict

Create one expanded **Quiet-stay evidence** region with three independently
labeled groups in this order: **Provider facts**, **Nearby context**, **Guest
review theme**. Each populated item must display its source, scope/method, and
freshness/window. Conflicting items remain side by side with the conflict copy
above them.

Do not produce a quietness score, probability, good/bad badge, or a single
positive/negative label. Deal Score remains price-only and visually separate.

**Test:** a fixture with property soundproofing plus negative guest noise theme
renders both sources and no combined verdict; the DOM and accessible name contain
the evidence-class labels.

### D2 — Keep the collapsed card positive-evidence-only and mount the real surface first

When a production hotel-comparison surface exists, collapsed cards may show at
most **one** quiet-stay line, after location and before actions, and only when a
valid provider fact or licensed guest theme exists. Use source-aware copy, not a
`Quiet` chip. Nearby context remains details-only because its caveat cannot fit
safely in the scan tier.

If all evidence is missing, stale, conflicting-only, insufficient-location, or
failed, show no collapsed quiet line. Put the single fallback in expanded detail.
At 375px the line must wrap without displacing price, Deal Score, location, or
the primary CTA.

UXDES must identify whether the target is the dormant `HotelCard`, the live
`DealCard`, or a restored hotel-results surface. UI work must not be handed off
against a tests-only component without a named production mounting step.

**Test:** all-unknown cards add zero collapsed elements; a confirmed fact adds
one line only; no horizontal overflow at 375px or 1280px.

### D3 — Treat contextual data as factual proximity, never predicted noise

Render contextual items only from exact address or paired coordinates plus an
attributable, licensed source. Show the named reference point, numeric distance,
method (`straight line` unless a provider supplies another documented method),
source, and update date. Area/search-area/missing precision must use the exact
insufficient-location fallback.

Nightlife needs venue category and freshness; temporary works additionally
needs start/end dates overlapping the stay. If those fields are absent, suppress
the item. No red/amber/green risk treatment and no icon/color-only meaning.

**Test:** the same airport POI with coordinate precision renders proximity;
with area precision it renders no distance and shows the insufficient-location
copy. Neither fixture contains `quiet`, `noisy`, `risk`, or `exposure` as a
verdict.

### D4 — Reuse the special-request truth model and keep it out of comparison controls

`special-requests/03-design.md` owns the guidance-only handoff block, including
quiet room as an example. Do not add a quiet-room checkbox, preference chip,
free-text field, saved state, sent state, or success state to result/detail.

If a future provider exposes request capability, show it as a provider fact with
the four progressive states: selected, transmitted, acknowledged, guaranteed.
An outbound CTA activation remains navigation only. Preserve the adjacent
non-guarantee copy until a selected-stay contract explicitly proves a guarantee.

At handoff, repeat only populated evidence already seen during comparison and
keep it above the existing Special requests guidance. If no evidence exists,
do not add a second unknown panel; the existing guidance explains the next step.

**Test:** current-capability prototype contains no selectable request control;
continuing to the partner changes no request state; users do not report that
expaify sent anything.

### D5 — Specify every asynchronous/uncertain state and non-sensitive measurement

Design default, checking, no-evidence-returned, failed, insufficient-location,
stale, conflicting, populated, mobile 375px, desktop 1280px, keyboard, and
screen-reader states using the exact copy table above. Evidence loading/failure
must never disable hotel comparison or provider handoff.

Use semantic headings and source metadata in reading order; only Details and any
native disclosure are tab stops. Status changes use polite live announcements.
No tooltip may be the sole carrier of a caveat.

Measurement must use the fixed event contract below and must be wired to the
specified production destination before outcome claims are made.

**Test:** keyboard order remains Details → evidence content reading order →
Review hotel; evidence failure leaves the Review action usable; screen-reader
output states class, source, scope/method, and uncertainty in words.

## Validation protocol and release thresholds

Test at 375px and 1280px with 8–12 first-time hotel travelers, including at
least four who identify as light sleepers or have previously requested a quieter
room. Do not collect the reason for sensitivity or medical/accessibility detail.

Use four comparison fixtures:

1. provider property soundproofing only;
2. airport proximity only;
3. negative licensed guest noise theme only;
4. no evidence plus a guidance-only quiet-room request handoff.

After each task ask, without leading language:

- “What does expaify know about this property's rooms?”
- “What does the nearby item tell you—and what does it not tell you?”
- “Whose opinion is the review theme?”
- “Did expaify send a quiet-room request?”
- “Is a quiet room guaranteed?”

Release thresholds:

- at least 90% correctly identify each evidence class and its source;
- at least 90% classify missing evidence as unknown, not positive or negative;
- zero participants say proximity predicts the specific room;
- zero participants say expaify transmitted a request in the current flow;
- zero participants interpret any current-capability state as a quiet-room
  guarantee;
- at least 85% can choose which source to verify next without leaving the task
  in confusion.

Any zero-tolerance failure requires copy/hierarchy revision and retest before
UI implementation.

## Production measurement specification

### Required destination

The current development-only `console.debug` adapter is not a destination.
Before measuring outcomes, route `lib/analytics.ts` through a same-origin,
consent-aware first-party collector into a dedicated Neon Postgres
`ux_events` dataset with documented retention and deletion rules. Product/Legal
must approve retention before launch. Until that sink exists and QA verifies
delivery, report every production metric below as **not available**, never 0%.

Do not store hotel name/id, coordinates, raw URLs, free text, room numbers,
medical/accessibility information, review text, or property messages. Use a
random per-view id and fixed enums only.

### Event contract

| Event | Trigger | Allowed properties |
|---|---|---|
| `hotel_quiet_evidence_viewed` | Evidence region is at least 50% visible for 1 continuous second, once per result-detail view | `surface` (`result_detail` / `handoff`), `overallState`, `providerFactState`, `contextState`, `reviewThemeState`, `locationPrecision` |
| `hotel_quiet_evidence_details_opened` | User opens Details on a card that has the quiet-stay region | Same six fixed properties plus `resultPositionBucket` (`1_3` / `4_10` / `11_plus`) |
| `hotel_quiet_conflict_viewed` | Conflict copy meets the same visibility threshold | `surface`, `conflictClasses` (fixed enum pair only) |
| `hotel_request_guidance_viewed` | Reuse the special-requests contract; guidance meets its visibility threshold | `source`, `partnerHost`, `capabilityState`, `eligibleRequestCount` |
| `hotel_request_help_opened` | Reuse the special-requests event when How requests work opens | `source`, `partnerHost`, `capabilityState` |
| `hotel_handoff_continue_clicked` | Existing provider CTA activates | Existing properties plus `quietEvidenceSeen` and `quietOverallState`; never `requestSent` |

Do not add `hotel_quiet_request_selected` in the guidance-only capability. If a
future structured control is approved, reuse the fixed `quiet_room` request id
and the request-state contract from `special-requests`; do not infer state from
evidence interactions.

### Metric definitions

1. **Evidence inspection rate:** unique result-detail views with
   `hotel_quiet_evidence_viewed` / unique eligible result-detail views. Segment
   only by fixed overall/evidence states.
2. **Qualified handoff:** unique handoff continues with
   `quietEvidenceSeen=true` / unique handoff views where evidence was available.
   This is context, not a conversion target; a lower rate may reflect a correct
   rejection of an unsuitable stay.
3. **Request-guidance use:** unique `hotel_request_help_opened` / unique
   `hotel_request_guidance_viewed`. There is no request-selection or
   request-success rate in the current capability.
4. **Comprehension/overclaim failure:** measured in the moderated protocol, not
   inferred from clicks. Production may add only support-agent fixed tags such
   as `assumed_quiet`, `assumed_request_sent`, or `assumed_guaranteed`; never
   parse free-text support content into analytics.
5. **Decision confidence:** one optional post-task research rating, followed by
   the factual comprehension questions. Do not treat confidence alone as
   correctness and do not interrupt the provider handoff with a production
   survey in MVP.

## Acceptance criteria for UXDES

- The spec names the production hotel-comparison target and does not hand UI
  work to a tests-only surface without a mounting dependency.
- It covers all exact states and copy in this brief: default/no evidence,
  checking, failed, insufficient location, stale, conflicting, each populated
  class, mobile, desktop, focus/keyboard, and assistive technology.
- It renders Provider facts, Nearby context, and Guest review theme as separate
  groups; no score, roll-up verdict, or Deal Score integration exists.
- All-unknown evidence adds nothing to the collapsed card and one honest fallback
  in expanded detail.
- Context requires exact/coordinate property precision, source, method, and
  freshness; it never predicts room noise.
- Quiet-room guidance reuses `special-requests/03-design.md`; no local request
  control or false sent/acknowledged/guaranteed state is introduced.
- Review noise reuses `hotel-review-relevance` and appears only with licensed,
  attributed, hedged provider data.
- Evidence persists to handoff only when populated; no second unknown block
  competes with Special requests guidance.
- The production analytics destination and fixed event properties are specified;
  all metrics remain unavailable until the sink is approved and verified.

## Blockers and out-of-scope findings

### Blockers

1. **Dead supplier:** Hotellook's published closure conflicts with the live
   adapter and handoff. Provider replacement/repair is required before any
   populated quiet-stay implementation.
2. **No production comparison surface:** `HotelCard` is not mounted. UXDES must
   name the real target; restoring/wiring hotel results is separate UI/DEV work.
3. **No licensed quiet evidence:** no current contract supplies sound-control
   facts, geospatial context, temporary works, or licensed noise review themes.
4. **No production analytics destination:** the proposed first-party sink needs
   Product/Legal approval and DEV implementation before measurement.

### Out of scope

- Selecting a new hotel supplier or licensing geospatial/review datasets.
- Repairing Hotellook, affiliate routing, or the inactive hotel-search UI.
- Scraping reviews, maps, venues, construction notices, or provider pages.
- Acoustic measurement/certification, flight-path or traffic modeling, live
  event prediction, or a quietness/noise score.
- Free-text requests, provider messaging, room assignment, order creation, or a
  guarantee claim.
- Filters/ranking based on sparse quiet evidence; Deal Score remains price-only.

## Handoff

Create `UXDES-HOTEL-NOISE-FIT-01` for an implementation-ready design of the
three-class **Quiet-stay evidence** ledger and its exact uncertainty states. The
design must remain fallback-first until a licensed provider is confirmed, reuse
the special-request and review-theme owners, identify the actual mounted hotel
comparison surface, and keep all environmental context factual and non-
predictive.
