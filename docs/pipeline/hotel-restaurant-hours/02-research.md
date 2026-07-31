# UXR-HOTEL-RESTAURANT-HOURS-01: Hotel Dining Availability Fit Research Brief

Date: 2026-07-31  
Stage: UX Research  
Priority: P2  
Upstream: `docs/pipeline/hotel-restaurant-hours/01-discovery.md`  
Surface: hotel results scan → hotel detail/review → provider handoff

## 1. Decision Summary

expaify cannot currently answer whether a traveler can get food on property at a required time. The gap is larger than a missing restaurant label:

- the only hotel adapter wired into search returns no dining service or hours fields;
- `HotelOffer` has no dining evidence or capability contract;
- the generic amenity contract can express that a property fact is confirmed, unavailable, not returned, or unknown, but cannot express a weekly schedule, a closed day, an overnight window, a time zone, special-date exceptions, or a match against a traveler's need;
- the live results card, saved-deal detail, and hotel review carry no dining fact or meal-time input; and
- the existing transport-hours contract is a useful structural precedent, but its free-text `days` field and explicit “fit was not checked” behavior are not sufficient for dining-window matching.

The recommended next step is an implementation-ready, **details-first research prototype** backed by a dedicated provider-neutral dining evidence family. It should test whether travelers understand service-specific hours and whether an explicit local date/time input is worth adding. A production filter or ranking change is not justified by current evidence and would be an unapproved feature under repair mode.

## 2. Research Question And Scope Boundary

**Research question:** Can a late-arriving or early-departing traveler identify whether at least one acceptable on-property food-service channel overlaps a required property-local time, without treating breakfast inclusion, restaurant existence, missing hours, or an ordinary weekly schedule as a guarantee?

The unit of evidence is a **service channel**:

1. `restaurant`
2. `room_service`
3. `breakfast_service`

The traveler may accept one or several channels; the product must not silently substitute one for another. Menus, cuisine, dietary accommodation, reservation inventory, delivery, minibar/vending, off-property options, prices, and breakfast inclusion remain out of scope.

## 3. Current-Code Evidence

All code claims below were checked directly in this worktree. Reference guidance is separated into §4.

### 3.1 Shared types and provider contract

`HotelEvidenceStatus` already distinguishes `confirmed`, `unavailable`, `not_returned`, and `unknown`; `HotelEvidenceScope` includes `property`, `room`, `rate`, and `selected_stay` (`lib/types.ts:120–148`). That is the correct status/scope vocabulary to reuse.

However, `HotelAmenityEvidence` contains only id, label, status, scope, source, optional fee, fetched time, confidence, and certainty. It has no schedule, time zone, exception date, or conflict representation (`lib/types.ts:138–148`). The only amenity normalizer is explicitly access-specific: its allowlist contains elevator, parking, step-free route, and room preferences; an unrecognized id is discarded (`lib/providers/hotelAmenityEvidence.ts:11–28, 109–117`). Its scope validation also limits property facts to `property` and room requests to `room`/`selected_stay` (`:64–83`). Adding restaurant ids there would not make hours representable and would couple dining to accessibility/request semantics.

`HotelOffer` carries amenity, transport, funds, smoking, rate-eligibility, and admission evidence but no dining field or dining capability declaration (`lib/types.ts:624–648`). `HotelProvider.searchHotels` returns `Result<HotelSearchPage>` and therefore already provides the correct provider boundary; no new component-side vendor call is needed or allowed (`lib/types.ts:685–696`).

### 3.2 Live provider capability

Hotellook is the only hotel search adapter used by `app/api/search/route.ts`. Its wire shape contains property identity, location, price, property type, an expaify amenity passthrough, and smoking policy—no restaurant, room-service, breakfast-service, hours, or time-zone fields (`lib/providers/hotellook.ts:18–42`). Network-response and cached normalization populate access evidence and other established hotel fields, but no dining evidence (`:382–410, 494–540`).

Therefore current capability is not merely “hours missing.” It is **unsupported for all three dining services**. The correct default is one concise capability-gated disclosure; it is not three “closed” rows and not three property amenity guesses.

There is no second hotel provider to fill the gap. `bookingComRapidApi.ts` implements `FlightProvider`, not `HotelProvider`, and its response mapping is intentionally unfinished.

### 3.3 Existing hours precedent: useful but insufficient

`HotelTransportEvidence` already separates facility status, service kind, cost, hours, action, source, fetched time, confidence, and conflict dimensions. Its hours support `24_hours`, `scheduled`, `on_request`, and `unknown`, plus local windows and a time zone (`lib/types.ts:152–215`). This is the strongest current structural precedent for a dedicated, capability-gated evidence family.

It cannot be copied unchanged for dining:

- `HotelTransportTimeWindow.days` is free text rather than normalized local weekdays (`lib/types.ts:175–179`), so exact overlap cannot be computed safely;
- there is no explicit closed-day or special-date exception state;
- an end before a start has no defined overnight meaning;
- there is no hours-level provenance/conflict envelope per service; and
- the UI deliberately says “Your arrival-time fit was not checked” for scheduled, on-request, and 24-hour cases (`app/components/HotelTransport.tsx:218–229`).

Dining needs the same separation of status, schedule, provenance, and capability, with a stricter schedule contract.

### 3.4 User-facing surfaces

The live `/deals` feed renders `DealCard`, not `HotelCard`. `DealCard` receives price, median, discount, dates, links, and optional quiet-stay evidence; it has no provider-backed property detail or dining field (`app/components/ui/DealCard.tsx:16–42`). Its hierarchy is hotel/date → price/Deal Score cue → photo → `View deal` (`:63–151`). A dining chip cannot be truthfully added here until the deal query and stored deal shape carry evidence.

`HotelCard` contains a rich collapsed/expanded evidence layout and is test-covered, but repository search finds no production import or mount. It shows access, parking, transport, funds, pets, smoking, rate restrictions, and admission evidence, but no dining content (`app/components/HotelCard.tsx:835–1165`). Implementing only this component would not repair a reachable user flow.

The reachable saved-deal page is the canonical detail target. Its `Hotel fit` section contains hotel class, guest-rating absence, and quiet-stay evidence, then immediately proceeds to provider handoff (`app/deals/[dealId]/page.tsx:399–425`). This is the primary research-prototype location: dining fit belongs within `Hotel fit`, before `Check rooms with provider`, not under price/Deal Score and not in `Supporting evidence` after the handoff.

The `/book` hotel review repeats property, price/Deal Score, class/rating, and admission evidence (`app/book/BookingFlow.tsx:330–407`). `BookingHotelContext` and `buildBookingHotelContext` copy a fixed evidence list with no dining continuity (`lib/booking/config.ts:70–95, 1206–1238`). Any future implementation that promises pre-handoff continuity must add validated dining evidence there; rendering it only on detail would lose the answer at the final expaify-controlled step.

### 3.5 Search criteria and analytics

Hotel criteria capture destination, a check-in window, and occupancy; neither arrival/departure time nor a meal-need time exists (`lib/hotels/searchCriteria.ts:4–21`). A check-in date range cannot be used to infer dinner time, and checkout is not reliably captured on the live deal criteria surface.

The analytics allowlist has hotel detail, section reach, provider handoff, and return events, but no dining-evidence exposure, dining need, match state, or coverage properties (`app/api/analytics/route.ts:12–50`). Existing events cannot distinguish a dining-mismatch handoff or reversal.

### 3.6 Exact current-state baseline

| Decision capability | Current result |
| --- | --- |
| Restaurant existence | Not returned by the wired provider contract |
| Restaurant hours | No type, adapter field, or UI |
| Room-service existence/hours | No type, adapter field, or UI |
| Breakfast-service hours | No type, adapter field, or UI |
| Breakfast included in displayed rate | Owned by rate-inclusions work; current provider cannot answer |
| Property-local meal-time input | Not captured |
| Hours overlap computation | Not implemented |
| Dining evidence on a reachable result/detail/review surface | 0 |
| Dining-specific analytics | 0 |

## 4. Reference-Pattern Guidance

These references guide interaction and data semantics only. They are not integrated suppliers and do not authorize expaify to copy or infer their content.

### 4.1 Hilton dining pages: service-first disclosure

Hilton property dining pages separate food-service channels into named cards and attach hours to the applicable service. New York Hilton Midtown lists separate outlets, explicitly marks Bridges Bar closed Sunday–Monday, and gives different daily operating windows for Herb N' Kitchen and Lobby Lounge. Maysan Doha separately states restaurant hours and all-day room service. [New York Hilton Midtown dining](https://www.hilton.com/en/hotels/nycnhhh-new-york-hilton-midtown/dining/) · [Maysan Doha dining](https://www.hilton.com/en/hotels/dohpaol-maysan-doha/dining/)

**Pattern to adopt:** service identity precedes schedule; closed days are visible; restaurant and room service are independent alternatives.

**Delta:** expaify has neither the service identity nor schedule. A single `Restaurant` amenity would lose exactly the late-arrival/early-departure distinction in the discovery problem.

**Pattern not to copy:** long venue descriptions and menus. The expaify decision is feasibility, so venue marketing, cuisine, and reservation actions remain outside the brief.

### 4.2 Marriott dining page: meal periods and split windows

The Paris Marriott Charles de Gaulle Airport dining page presents breakfast as its own time-bound service and shows one restaurant with three separate daily periods for breakfast, lunch, and dinner. It also publishes a dated future change to breakfast hours. [Paris Marriott Charles de Gaulle dining](https://www.marriott.com/en-us/hotels/parmc-paris-marriott-charles-de-gaulle-airport-hotel/dining/)

**Pattern to adopt:** one service may have multiple windows in a day; “restaurant open” does not mean the kitchen serves every meal continuously; dated exceptions/changes must be able to supersede a regular weekly schedule.

**Delta:** expaify's generic amenity evidence and transport windows cannot represent special effective dates or meal-period-specific discontinuities.

### 4.3 Google hours model: conservative schedule semantics

Google's current Places contract distinguishes regular from current hours, supports service-specific secondary hours such as breakfast, lunch, dinner, delivery, and takeout, carries special days, uses place-local periods, represents 24-hour operation explicitly, distinguishes empty hours from missing hours, and returns the property's IANA time zone. [Google Places resource: opening hours](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)

Google Business Profile guidance also separates ordinary weekly hours from special hours and supports multiple periods in one day; overnight special hours are split at midnight. [Google special-hours guidance](https://support.google.com/business/answer/6303076?hl=en)

**Pattern to adopt:** exact matching must use normalized property-local intervals, explicit 24-hour and closed states, and date-specific exceptions when available. Missing hours are not closed hours.

**Delta:** expaify currently has no dining provider and must not call Google Places from a component or treat this reference contract as available supply. Any future source still enters through `lib/providers`, preserves its attribution/terms, and normalizes into expaify's contract.

## 5. Exact Gap

| Dimension | Current expaify code | Reference pattern | Required delta |
| --- | --- | --- | --- |
| Service identity | No dining family | Separate restaurant, room service, breakfast/outlet cards | Keep three independent channels; never auto-substitute |
| Schedule | No dining hours; transport has free-text day windows | Weekly local periods, split periods, closed days, special dates, 24 hours | Normalized service schedule with explicit hours status and exceptions |
| Time interpretation | No meal time or property time zone | Place-local schedule and IANA time zone | Require property-local assertion before declaring overlap |
| Scan/detail hierarchy | No dining evidence; live detail goes from Hotel fit to handoff | Short service summary, expanded hours by service | Details first; one quiet scan cue only after confirmed match semantics exist |
| Missing data | Live supplier unsupported | Missing hours remain distinct from closed | One capability-gated disclosure; unknown never filters or matches |
| Rate inclusion | Separate incomplete work | Service availability and rate inclusion shown separately | Never use `Breakfast included` as evidence that breakfast is served at the need time |

## 6. Research Scenarios And Release Gates

No participant study was run in this code-audit stage. UXDES should create fixed, visibly synthetic research fixtures for 5–7 moderated sessions. The prototype is not evidence for production claims until the following tasks pass.

| Fixture | Evidence | Need | Correct decision |
| --- | --- | --- | --- |
| Late arrival, restaurant miss, room-service hit | Restaurant daily 18:00–22:00; room service daily 18:00–01:00 | Friday 23:30 local; accepts either service | `Fits via room service`; must not call the restaurant open |
| Early departure, breakfast miss | Breakfast service daily 06:30–10:30 | Tuesday 05:45 local; accepts breakfast only | `Does not fit the entered time` |
| Overnight boundary | Room service Friday 18:00–02:00 | Saturday 00:30 local | `Fits via room service`; interval carries across midnight |
| Closed day | Restaurant Tuesday closed; Wednesday 18:00–22:00 | Tuesday 20:00 local | `Does not fit`; Wednesday hours do not bleed into Tuesday |
| Hours not returned | Restaurant confirmed; hours `not_returned` | Friday 21:00 local | `Hours not provided — fit unknown`; never `fits` or `closed` |
| 24-hour service | Room service `24_hours` with current source/time zone | Any entered time | `Fits via room service`, with property-level/non-guarantee caveat |
| Conflicting or stale schedule | Two current sources disagree, or evidence fails the future freshness rule | Any need | `Hours unclear` or `Hours may have changed`; never a confirmed match |
| Special date | Regular breakfast 06:00–10:30; holiday exception closed | Holiday 07:00 local | `Does not fit` using the dated exception |

**Comprehension gate:** at least 85% of participants must correctly distinguish (a) service exists vs open at the required time, (b) breakfast served vs breakfast included, (c) not returned vs closed, and (d) property-level schedule vs guaranteed order acceptance. No more than 5% may interpret `Fits` as a reservation, live kitchen/capacity guarantee, or rate inclusion.

**Input-pattern gate:** compare three prototype variants using the same fixtures:

1. schedule disclosure only;
2. quick presets (`Late arrival`, `Early departure`) that reveal a local date/time editor; and
3. explicit `I need food on` date/time entry with selectable acceptable services.

Ship no production filter from this ticket. Advance the winning input only if at least 5 of 7 participants can set the correct local need without moderator help, revise it after noticing a wrong time zone/service assumption, and explain which services count. If no variant meets that bar, retain schedule disclosure only.

## 7. Design Directives For UXDES

### D1 — Use a dedicated, capability-gated dining evidence family

Add a provider-neutral `diningEvidence` + `diningCapability` pair to `HotelOffer`, modeled on dedicated evidence families such as transport/rate eligibility. Reuse `HotelEvidenceStatus`, `HotelEvidenceScope`, and `HotelAmenityConfidence`; do not add dining ids to `hotelAmenityEvidence.ts`.

The design spec must define:

- `service`: `restaurant | room_service | breakfast_service`;
- `propertyId` and `supplier` bindings that must match the displayed offer;
- service `status` and `scope` (initial supported scope: `property` only);
- `hoursStatus`: `confirmed | not_returned | unknown | conflicting | stale`;
- schedule mode: `scheduled | 24_hours | closed`, normalized local weekday/date windows, explicit overnight handling, and special-date overrides;
- IANA `timezone`, `sourceLabel`, `fetchedAt`, confidence, and evidence revision; and
- capability per service and per hours dimension, so an unsupported supplier collapses to one disclosure.

**Testable:** unrecognized services, invalid time strings, missing time zone, impossible intervals, future `fetchedAt`, mismatched property/supplier identity, or conflicting current schedules never produce `fits`/`does_not_fit`; they degrade only the affected service to an explicit non-confirmed state. Hotellook fixtures render one unsupported disclosure and no invented service rows.

### D2 — Define overlap semantics before visual treatment

`fits` requires all of the following: the traveler entered a local date/time (or bounded interval); at least one traveler-accepted service is `confirmed`; its `hoursStatus` is `confirmed`; its normalized interval contains the need; its time zone is known; no applicable conflict/stale/special-date exception invalidates it. Intervals use a half-open boundary `[open, close)`: exactly at opening matches; exactly at closing does not. Overnight intervals attach to their opening day and carry across midnight. `24_hours` is an explicit mode, never inferred from `00:00–00:00`.

Use exactly four presentation outcomes:

- `fits`: `Food available at your time via {service}.`
- `does_not_fit`: `No accepted on-property food service is shown for {day, time} local time.`
- `unknown`: `Dining hours are not complete enough to check {day, time} local time.`
- `no_need`: no fit claim; show service schedules only.

Every positive outcome adds: `Property hours do not guarantee an order, table, or selected-rate inclusion.`

**Testable:** all eight fixtures in §6 return the stated result. Breakfast inclusion, hotel check-in/out, marketing copy, and generic `restaurant` presence are never inputs to the matcher.

### D3 — Keep service schedules in Hotel fit before handoff; earn any scan cue

The reachable saved-deal detail and final hotel review are required surfaces. Place a `Dining availability` block inside `Hotel fit`, before provider handoff. Primary content is the match outcome when a need exists; secondary content is one row per service; tertiary content is source/fetched time and the non-guarantee. Each service row names the service and either exact local hours, `24 hours`, `Closed`, `Hours not provided`, `Service not reported`, or `Hours unclear`.

At 375px, use stacked text rows; at desktop, at most two columns. Do not merge dining with price, Deal Score, rate inclusions, or generic amenities. Do not add a production results filter. A collapsed/list cue is permitted only after the input-pattern and comprehension gates pass, and only for a confirmed match; unknown/mismatch remains detail-level to avoid crowding the price-first hierarchy.

**Testable:** keyboard and reading order is property/stay → price/Deal Score → Hotel fit/dining → provider handoff; text conveys every state without color or icon; no horizontal overflow at 375px; the hotel review repeats the same evidence revision and need rather than recomputing from missing context.

### D4 — Make unsupported, partial, loading, error, conflict, and stale states first-class

Required exact fallback rules:

- supplier unsupported: `{Provider} does not return restaurant, room-service, or breakfast-service hours. Confirm dining times with the property before booking.`
- service confirmed, hours absent: `{Service} is reported, but its hours were not provided.`
- explicit service negative: `{Service} is reported as unavailable.`
- loading: `Checking dining hours…`
- provider error with no usable prior evidence: `Dining hours could not be checked.` plus `Retry` where a safe provider retry exists;
- conflict: `{Service} hours are unclear because current sources disagree.`
- stale: `{Service} hours may have changed since {date}.`

Missing data never renders `Closed`, `Unavailable`, `No restaurant`, or a negative filter result. If only one service is supported, render that service plus one concise coverage line; do not imply the other two were checked.

**Testable:** each state has a fixture, visible text, accessible text, and no positive match. Loading uses `aria-busy`; status changes use a polite live region; retry retains the entered need and focus returns to the updated heading.

### D5 — Instrument evidence coverage and decision behavior without collecting raw sensitive text

Add allowlisted events/properties sufficient to interpret use alongside provider coverage:

- `hotel_dining_evidence_viewed`: `hotel_id`, `surface`, `provider`, `capability_state`, `services_reported`, `hours_coverage`, `fit_state`, `viewport_group`;
- `hotel_dining_need_applied`: `entry_pattern`, `need_kind`, `accepted_services`, `fit_state`, `criteria_version` (no raw free text and no exact timestamp in analytics; bucket as `early_morning | daytime | evening | late_night`);
- `hotel_dining_details_opened`: `hotel_id`, `surface`, `fit_state`, `hours_coverage`;
- extend the relevant handoff/return event with `dining_fit_state` and `dining_evidence_seen`.

Review input usage only against `hours_coverage`; low use with mostly unsupported evidence is not a failed interaction. A mismatch disclosure followed by handoff is not automatically failure—the traveler may accept off-property food.

**Testable:** the analytics route rejects unknown properties, accepts every documented fixture, stores no exact need timestamp or user-authored dining text, and can report coverage, exposure, detail opens, fit-state handoffs, and reversals separately.

## 8. Canonical Ownership And Handoff Implications

- **Dining availability owns:** service existence, service-specific operating schedule, local-time overlap, provenance, freshness/conflict, and capability.
- **Rate inclusions owns:** whether breakfast or another item is included in the displayed rate and any rate-scoped charge.
- **Generic amenities owns:** property-level facility discovery without schedule semantics.
- **Search criteria owns:** destination/stay dates. A future dining need may reference the stay but must not overwrite arrival/departure or infer them.
- **Provider layer owns:** vendor parsing, attribution, normalized schedules, `Result<T>`, and capability declarations.

If implemented beyond a research fixture, dining evidence and the entered need must be validated through stored `BookingHotelContext` continuity so the final expaify review does not lose or silently recompute the decision. No external API call may originate in a component.

## 9. Out-Of-Scope Findings And Blockers

1. **Provider blocker:** the current Hotellook contract cannot supply any dining service or hours. UXDES can specify states and a synthetic research prototype, but production positive claims require an approved hotel content provider with documented dining fields and attribution rights.
2. **Live-surface gap:** `HotelCard` is not mounted; the live feed/deal-detail data path is different. UI work targeted only at `HotelCard` would not repair the reachable flow.
3. **No production filter approval:** adding a dining filter, preset, ranking signal, or Deal Score input would be new functionality. This brief permits prototype testing only; production requires a later approved scope after the §6 gates pass.
4. **No freshness threshold can be invented:** restaurant hours change seasonally and on holidays. A provider contract must define update cadence/current-hours semantics before UXDES labels an age as stale; until then, show the fetched date and avoid a confirmed match when current applicability is not established.
5. Restaurant reservations, menus, cuisine/dietary filtering, delivery, minibar/vending, off-property options, breakfast pricing/inclusion, live capacity, and post-booking contact flows remain out of scope.

## 10. UXDES Handoff

`UXDES-HOTEL-RESTAURANT-HOURS-01` should produce an implementation-ready design for the details-first research prototype and future provider-backed states. It must cover the dedicated evidence/capability contract, all §6 fixtures, the four fit outcomes, every loading/empty/error/conflict/stale state, property-local time and overnight behavior, final UI copy, 375px/1280px layouts, keyboard/focus behavior, booking-review continuity, and the instrumentation schema. It must explicitly keep a production filter conditional on the research gates rather than treating it as approved.
