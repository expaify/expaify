# UXD-HOTEL-EV-CHARGING-01: Hotel EV-Charging Confidence Discovery

Date: 2026-08-03  
Stage: UX Discovery (UXD)  
Priority: P1  
Method: Static audit of the current hotel offer, provider normalization, card, and booking-handoff code. No traveler interviews, supplier-coverage sample, production EV-filter analytics, charger telemetry, or real-time availability feed was available in this stage.

## User pain point

An electric-vehicle traveler cannot reliably decide whether a hotel will support charging during their stay because expaify does not distinguish provider-confirmed on-property charging, documented restrictions that may make it only partly usable, and missing charging evidence.

The problem is not solved by a generic “EV charging” amenity. A charger can be on the property yet be guest-only, paid, reservation-only, limited to a connector or power level, managed by a third party, or unavailable at arrival. Conversely, missing supplier data is not evidence that charging is absent. Without these distinctions, a traveler may select a rate that creates an avoidable charging stop, cost, or failed overnight plan.

## Who is affected and where

The primary affected users are travelers arriving in an EV who intend the hotel to be part of their charging plan: road trippers, airport-stay guests returning a rental EV, families or late arrivals with little charging slack, and travelers whose vehicle range makes an off-property fallback materially disruptive.

The decision failure spans three moments:

1. **Search and result comparison.** A traveler needs to identify properties with evidence-backed on-property charging and set aside properties whose status is limited or unknown, without mistaking an unverified amenity for a guarantee.
2. **Property detail.** Before selecting the hotel, the traveler needs the facts that affect practical use: whether charging is on property, who may access it, applicable charge/cost information, reservation or first-come rule, and any provider-documented compatibility or operating limitation.
3. **Booking handoff.** The selected hotel’s charging state and outstanding confirmation task must survive the transition to the affiliate/provider so the traveler does not lose the reason they chose the property.

This ticket concerns a hotel’s documented, on-property charging facts only. It does not ask expaify to locate chargers, route to them, reserve a connector, or claim a connector is live or free at a particular time.

## What the current product establishes

- `HotelOffer` can carry optional generic `amenityEvidence`; `HotelAmenityEvidence` has useful evidence primitives—`status`, `scope`, `sourceLabel`, optional `fee`, `fetchedAt`, `confidence`, and `certainty`—but no EV-charging-specific representation (`lib/types.ts`).
- `normalizeHotelAmenityEvidence` accepts only elevator, on-site parking, step-free-route, and room-request identifiers. An EV-charging item is discarded, and fee normalization is limited to on-site parking (`lib/providers/hotelAmenityEvidence.ts`).
- The Hotellook provider passes cached/live amenity evidence through that restrictive normalizer. Its audited base offer contract has no charging location, access, connector, power, reservation, or selected-stay charging state (`lib/providers/hotellook.ts`).
- `HotelCard` consumes amenity evidence as an access/parking panel. It has no EV charging summary or detail presentation. The active deal-detail surface constructs a `HotelOffer`, but current charging data would have no way to render there (`app/components/HotelCard.tsx`, `app/deals/[dealId]/page.tsx`).
- `buildBookingHotelContext` preserves identity, price, document readiness, funds, smoking, eligibility, admission, and transport evidence, but not amenity/charging evidence (`lib/booking/config.ts`). A selected charging fact or unresolved restriction would be lost before provider handoff.
- No EV-charging evidence impressions, detail opens, state comprehension, property switches after review, or handoff segmentation is present in the audited repository. A behavioral or coverage baseline cannot yet be calculated from product data.

The exact gap is therefore evidence and continuity, not merely a missing filter. The current product cannot make a positive EV-charging claim, cannot express a documented limitation, and cannot retain the user’s uncertainty at handoff.

## Minimum decision-useful evidence to validate

UXR must validate supplier vocabulary and coverage before a product claim or UI treatment is approved. The smallest proposed contract is provider-neutral and must preserve source, fetched time, scope, and explicit `not_returned`/`unknown` values for every field.

1. **On-property status.** `confirmed`, `unavailable`, `not_returned`, or `unknown`. “On property” must be explicit; nearby public charging, valet claims, and a general parking amenity must not be promoted as on-property charging.
2. **Access restriction.** At minimum: `guest_only`, `public`, `staff_or_valet_only`, `reservation_required`, `first_come_limited`, or `unknown`, with more than one documented restriction allowed. A reservation rule is a process fact, not a reserved connector.
3. **Cost.** `included`, `paid`, or `unknown`; preserve a supplier-returned exact amount as `{ priceCents, currency }` with a basis such as per session, kWh, hour, night, or stay. Do not estimate, convert a bare decimal, or fold charging cost into the hotel rate.
4. **Usability detail when supplied.** Connector/compatibility, charging level/power, operator, and operating-hours/access instructions may be shown only when provider documented. Each is separately optional and must remain unknown when omitted. No component may infer vehicle compatibility from a connector label or calculate charging time.
5. **Selected-stay boundary.** A property-level charger is not evidence that a connector will be open, working, or available for the selected dates. The system may display a supplier-returned reservation/eligibility fact, but must never promise live availability unless a later, separately approved real-time provider contract exists.

These facts support a deliberately narrow three-state conclusion:

- **Confirmed:** a named source confirms on-property charging and returns no documented restriction that makes access conditional. Copy must still say that availability is not live and should be confirmed with the property/provider before payment.
- **Limited:** a named source confirms on-property charging but documents a meaningful access, cost, reservation, compatibility, power, operator, or hours limitation; display the specific limitation rather than a generic “limited” explanation. This state does not mean unusable.
- **Unknown:** the provider did not return sufficient charging evidence, returned malformed/conflicting evidence, or identifies only off-property charging. Unknown is neither “no charging” nor a reason to exclude a property by default.

An explicit provider statement that no on-property charging exists is a separate negative fact. It must not be styled or counted as unknown, and it must not be folded into the three positive-decision states.

## Measurement plan

### 1. EV-fit evaluation success

Validate comprehension through moderated or unmoderated prototype tasks before implementation. Given result and detail states, a participant should correctly identify whether each hotel is **confirmed**, **limited** (and name the documented limitation), **unknown**, or explicitly **no on-property charging**; and identify that none of the positive states promises a free or currently available connector.

Measure:

- **EV-fit evaluation success rate:** participants who correctly classify all four states and choose the property that matches a stated need / participants completing the task.
- **Restriction comprehension rate:** participants who correctly restate the material limitation (for example, guest-only, paid, reservation-required, or connector unspecified) / participants shown a limited state.
- **False-certainty rate:** participants who say a property-level fact guarantees a working/free/available connector for their stay / participants shown confirmed or limited evidence. Target is zero within the research sample.
- **Time to confident, correct selection:** from results shown to a correct classification/selection, reported separately for result-only and result-plus-detail tasks. Confidence without correct classification is not success.

### 2. Evidence-backed charging coverage

Measure at the normalized displayed-offer level, segmented by provider, destination, dates-present status, and device viewport:

- **Evidence-backed charging-status coverage:** offers with a sourced explicit `confirmed` or `unavailable` on-property status / all displayed hotel offers.
- **Decision-state coverage:** offers which can honestly receive confirmed, limited, unknown, or explicit-unavailable after validation / all displayed offers. This is expected to include unknowns; it measures truthful classification rather than positive inventory.
- **Limited-detail coverage:** confirmed-on-property offers with at least one sourced restriction/cost/usability detail / confirmed-on-property offers.
- **Unknown share:** offers with no usable on-property-status evidence or conflicting/malformed evidence / all displayed offers.
- **Handoff continuity coverage:** selected hotel handoffs retaining the displayed EV state, source, and outstanding confirmation task / handoffs from properties where an EV state was shown.

Explicit negative evidence counts as evidence-backed status coverage. Inferred defaults, generic parking facts, stale free text without attribution, and nearby chargers do not.

### 3. Behavioral instrumentation after a surface is approved

Use bounded values only—offer/provider identifier, state, completeness bucket, restriction categories, and viewport group. Do not send raw access instructions, URLs, vehicle details, or location data.

- `hotel_ev_charging_state_impression` once per visible result/property state.
- `hotel_ev_charging_details_opened` when a user opens the charging facts for a property.
- `hotel_ev_charging_section_reached` when at least 50% of the detail section remains visible for one second.
- `hotel_ev_charging_handoff_continued` when the user proceeds after a documented section reach, including state and whether any confirmation task remains.
- `hotel_ev_charging_property_changed_after_review` when the user returns to results and opens another property after reaching the section. Report it as “after charging review,” never as proof of causation.

The primary product outcome is successful, accurate EV-fit evaluation, not maximizing the number of “charging available” claims or forcing a conversion through an unknown state.

## Constraints

1. **No real-time or routing promise.** Keep the work to on-property facts. Do not add live connector availability, operational status, charging-session reservation/payment, navigation, maps, off-property fallback search, range estimation, or charging-time calculation.
2. **Evidence before claim.** Every positive or negative charging statement must originate in `lib/providers`, carry source and appropriate scope, and degrade to unknown on absence, conflict, malformed payload, or stale/unverified evidence. Components must not parse vendor prose or call vendor APIs.
3. **Respect money and data contracts.** Exact charging costs use integer `{ priceCents, currency }` plus basis. Fees, amenity presence, selected-stay eligibility, and live availability remain separate facts. Affiliate handoffs retain affiliate markers.
4. **Repair scope and accessible hierarchy.** This is a confidence repair, not an approved filter, ranking, data-provider, or booking feature. The eventual experience must expose state and restrictions without color alone, support keyboard/screen-reader use, and remain readable at 375px and 1280px without displacing rate, Deal Score, location, or booking action.

## Success statement

This is solved when a first-time EV traveler can evaluate a hotel from search through property detail and provider handoff, and correctly tell whether on-property charging is confirmed, documented but limited, or unknown—while understanding any known access restriction and that expaify is not promising real-time connector availability.

## Scope relationship and boundaries

- **Hotel amenity provenance / amenity fit** own the reusable source, scope, status, and missing-data disciplines. This ticket applies those principles to a high-consequence amenity where a simple boolean is unsafe.
- **Hotel parking fit** owns parking facility and space decisions. Parking evidence must not imply charging, and charging evidence must not imply a parking space or vehicle access.
- **Hotel rate inclusions / total-price work** own hotel-rate composition. This ticket may present an attributed charging cost but does not add it to hotel pricing or Deal Score.
- **Hotel transport, location, and outage-resilience work** own directions, travel continuity, and disruption information. This ticket does not infer any of them from a charger listing.

Out of scope: implementation; changing provider integrations; EV-charging filters, sorting, ranking, saved preferences, or Deal Score; charging reservations or payments; real-time charger availability/uptime; routing or off-property charger recommendations; vehicle/connector matching guarantees; and charging-cost estimates.

## Required UXR handoff

`UXR-HOTEL-EV-CHARGING-01` must read this report and produce `docs/pipeline/hotel-ev-charging/02-research.md`. It must:

1. Audit the active hotel result and detail surfaces, `HotelOffer`, `HotelAmenityEvidence`, provider live/cache normalization, booking context, and analytics to verify the actual end-to-end target and data delta.
2. Sample current and plausible affiliate hotel-provider payloads to establish coverage and freshness for on-property status, access rules, cost/basis, reservation rules, connector/power, operator, and hours. Recommend stop, narrow, or proceed if evidence cannot support the three-state model honestly.
3. Compare one or two established hotel-search patterns at the interaction level, focusing on provider-attributed facility facts, restrictions, unknown data, and no-live-availability boundaries—not visual styling.
4. Validate the comprehension tasks and measurement definitions above, especially that users distinguish confirmed property charging from real-time availability and limited from unknown.
5. Produce 3–5 specific, testable directives for result comparison, property detail, booking-handoff continuity, explicit unavailable/unknown/conflict states, focus and screen-reader behavior, and 375px/1280px usability. Do not prescribe or introduce a filter.

## Blockers and out-of-scope findings

- **Provider-evidence blocker:** the current normalized hotel contract cannot substantiate any EV-charging statement, restriction, or cost. Research must verify supplier evidence before design or implementation can make a positive claim.
- **Continuity blocker:** charging evidence has no representation in `BookingHotelContext`; even a future property-level fact would currently disappear before provider handoff.
- **Measurement blocker:** no EV-specific analytics or usability data exists, so coverage and behavioral baselines require a provider sample and prototype research/later instrumentation.
- **Surface finding:** `HotelCard` contains the richer evidence pattern, while the live hotel route must be confirmed by UXR before UXDES chooses placement. This discovery does not authorize work on adjacent hotel UI.

## Handoff

Create `UXR-HOTEL-EV-CHARGING-01` with this report path and the one-sentence user pain point above. The research ticket must preserve the confirmed/limited/unknown model, the explicit no-on-property-charging fact, and the prohibition on real-time availability or routing promises.
