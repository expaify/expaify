# UXD-HOTEL-RESTAURANT-HOURS-01: Hotel Dining Availability Fit Discovery

Date: 2026-07-31  
Stage: UX Discovery  
Priority: P2

## Problem Statement

A traveler arriving after local dinner service or leaving before breakfast cannot determine from an expaify hotel offer whether the property has a usable on-property food option at the time they need it, because breakfast inclusion does not state restaurant or room-service availability or operating hours; they must contact the hotel or discover the mismatch after handoff.

## Who Is Affected And Where

This affects travelers with a hard meal-time constraint, especially:

- late arrivals who need dinner after check-in or an overnight food option;
- early departures who need food before leaving; and
- travelers selecting a self-contained stay because getting food off property is impractical or undesirable.

The decision happens while scanning and comparing hotel offers, then again on a property-detail or review surface immediately before the affiliate handoff. The user is not trying to reserve a table or browse a hotel’s full amenity catalogue. They are trying to answer one feasibility question: **“Can I reliably get food at this property during my required time window?”**

Breakfast is adjacent but insufficient. A rate-level `breakfast included` fact answers what the rate pays for; it does not establish whether breakfast starts before the departure time, whether dinner is served after arrival, or whether room service is available. Conversely, a property-level restaurant can exist without serving at the required hour or being available to the guest’s selected stay.

## Evidence That The Problem Exists

The current hotel evidence vocabulary and UI work support access, parking, pets, smoking, transport, quality, and rate inclusion questions, but repository searches find no restaurant, room-service, dining-hours, or meal-service operating-hours model or rendered decision signal. `HotelAmenityEvidence` can communicate source/status/scope, yet its current consuming vocabulary does not include dining services or hours. The existing rate-inclusions work intentionally owns whether breakfast is included; it must not be repurposed to imply time availability.

Consequently, the present observable baseline is:

- hotel offers with an on-property dining availability-and-hours answer: **0**;
- filters for a meal window or 24-hour/late-night room service: **0**;
- result-comparison evidence distinguishing “restaurant exists” from “open when needed”: **0**;
- a way to identify a workable late-arrival or early-departure stay without contacting the property: **0**.

Research and a later implementation must instrument the first measurable behavioural signals rather than invent a baseline: dining-fit filter application, dining-evidence detail opens, coverage by service type, hours overlap with the selected/entered need window, unknown-state exposure, and provider-handoff after a dining mismatch disclosure. Review filter use alongside coverage so low use is not misread when evidence is mostly unavailable.

## Minimum Data Model (Discovery Boundary)

The smallest useful model is evidence per food-service channel, not a free-text amenity or reservation feed. Candidate channels, in priority order: `restaurant`, `room_service`, and `breakfast_service`. Each record needs:

| Field | Why it is required |
| --- | --- |
| `service` | Lets a traveler distinguish an on-site restaurant from room service and breakfast service. |
| `status` | Must distinguish `confirmed`, `unavailable`, `not_returned`, and `unknown`; missing data is never “closed” or “not offered.” |
| `scope` | Prevents a property fact from being presented as guaranteed for a selected stay. Property-level is the expected initial scope. |
| `hours` with local day/time ranges and an explicit `hoursStatus` | Lets the product evaluate a required time without treating absent or stale hours as closed. Closed-day and 24-hour cases must be representable. |
| `timezone` or a property-local-time assertion | Makes “late” and “early” meaningful across destinations. |
| `sourceLabel` and `fetchedAt` | Gives users provenance and makes dated hours auditable. |
| `confidence` / evidence certainty | Ensures provider-supplied but incomplete hours are not represented as a guarantee. |

This model should extend the established provider-backed evidence contract rather than introduce a component-owned shape. It does **not** include menus, cuisine, reservations, delivery, restaurant distance, price, dietary accommodation, capacity, or a promise that a service will accept an order at a particular time. Any fee or breakfast-inclusion fact remains owned by rate-inclusions and uses the existing money contract if an amount is later required.

## Prioritized User Questions For Research

1. **Hard gate:** “Can I get food on the property during my required local time window?” Research must establish whether users need an explicit time input, quick presets (late arrival / early departure), or only a disclosed schedule before a filter is justified.
2. **Service substitution:** “Does room service count when the restaurant is closed, and does breakfast service count for an early departure?” Treat these as user-defined alternatives, not equivalent services by default.
3. **Evidence comprehension:** “Can the traveler correctly distinguish confirmed hours, a service confirmed but hours not returned, no such service, and unknown provider data?”
4. **Comparison need:** “At scan time, which single signal lets a traveler eliminate unsuitable properties without crowding price and Deal Score: matched window, service type, or no reliable evidence?”
5. **Trust threshold:** “What evidence is sufficient to say a stay *fits* versus only *may fit*?” Confirm that property hours do not promise selected-stay access, holiday operation, or live capacity.

## Constraints

1. **Data integrity and scope.** Do not infer hours from restaurant existence, breakfast inclusion, check-in time, or marketing copy. Do not treat property-level hours as a selected-stay guarantee. “Not returned,” stale, and unknown must remain explicit and non-filterable as a confirmed match.
2. **Provider and domain boundaries.** All facts originate through `lib/providers` and preserve the `Result<T>` contract. Reuse the shared evidence/status vocabulary and source metadata; do not make external calls from UI. This ticket excludes reservations, menus, off-property restaurant discovery, and general amenity browsing.
3. **Decision clarity and accessibility.** The result surface must preserve price, Deal Score, and booking context at 375px and desktop. Time information needs local-time labels, text as well as visual cues, readable day ranges, and no colour-only match/mismatch meaning.

## Success Statement

This is solved when a first-time user with a late-arrival or early-departure meal need can identify and compare hotels with provider-backed restaurant, room-service, or breakfast-service hours that overlap their required local time window, without contacting the property and without mistaking breakfast inclusion, a property amenity, or missing hours for confirmed availability.

## Downstream Focus

UXR-HOTEL-RESTAURANT-HOURS-01 should:

1. Audit live hotel search, detail, review, type, and provider paths to confirm where a dining-evidence contract can reach a user and whether any supplier currently returns service/hours data.
2. Review the established amenity-provenance and rate-inclusions outputs to prevent duplicate types, copy, or ownership; recommend one canonical location for service/hours evidence.
3. Compare one or two travel-reference patterns for operating-hours disclosure and filter semantics, focusing on unknown/stale data and local-time interpretation rather than visual style.
4. Validate the five prioritized questions with representative late-arrival and early-departure scenarios, including an overnight/24-hour case, a closed-day case, and hours-not-returned case.
5. Produce 3–5 testable directives that state the capability-gated default, exact match semantics, scan-versus-detail placement, and instrumentation.

## Out Of Scope

Restaurant reservations, menus, cuisine and dietary filtering, off-property dining recommendations, delivery, minibar/vending, general amenity filters, breakfast price/inclusion, front-desk coverage, transportation, and post-booking property contact flows.
