# UX Discovery — Hotel Parking Fit

**Ticket:** `UXD-HOTEL-PARKING-FIT-01`  
**Date:** 2026-07-22  
**Stage:** UX Discovery  
**Priority:** P1  
**Feature slug:** `hotel-parking-fit`

## User pain point

A driver cannot reliably compare the true fit of expaify hotels because the product may say that on-site parking exists, but does not tell them whether a space is available for their stay, what it costs, whether it must be reserved, who operates it, or whether the usable option is actually nearby rather than on site.

## Who is affected and where

The primary affected user is a traveler who expects to arrive with a car and treats parking as a stay requirement rather than a general amenity. The risk is highest for:

- price-sensitive drivers for whom a nightly parking charge can materially change which hotel is the better deal;
- late-arriving, mobility-limited, family, or luggage-heavy travelers for whom nearby or street parking is not equivalent to on-site parking;
- travelers in dense destinations where parking is limited, third-party operated, or reservation-only; and
- rental-car users who may not recognize the parking constraint until after selecting a low hotel rate.

The affected decision path spans three steps:

1. **Search and comparison.** A user scans hotel results and needs to rule properties in, rule them out, or mark parking as unresolved without opening every property.
2. **Hotel detail.** A user opens **Details** and needs to understand the parking option's location, cost, operator, reservation rule, and certainty before choosing **Review hotel**.
3. **Booking handoff.** A user reviews the selected hotel before leaving expaify and needs the known parking facts and unresolved confirmation tasks to survive that transition.

This is not a request to reserve parking inside expaify. The product currently hands hotel booking to an external partner, and parking remains a provider/property confirmation task unless selected-stay parking inventory is explicitly returned by a supplier.

## Current evidence and exact gap

The current implementation has a partial, provider-qualified parking signal, but it cannot support a complete driver decision:

- `HotelAmenityEvidence` can carry a canonical id, status, scope, source, a coarse `fee` (`included`, `paid`, or `unknown`), confidence, and certainty (`guaranteed` or `requestable`) (`lib/types.ts:119-147`). It has no parking location type beyond the canonical `on_site_parking` id, no operator type, no reservation rule, no exact parking price or price basis, and no selected-stay space state.
- `normalizeHotelAmenityEvidence` recognizes only `on_site_parking` for parking and preserves only its coarse fee state (`lib/providers/hotelAmenityEvidence.ts:18-25`, `78-80`, `143-145`). It cannot represent hotel-operated versus third-party parking, nearby/off-site versus on-site parking, reservation required versus not accepted, or facility presence separately from a space for the selected stay.
- The live Hotellook cache response shape exposes an optional normalized `amenityEvidence` field, but the provider's base hotel fields contain no native parking contract (`lib/providers/hotellook.ts:11-30`). When evidence is absent, the adapter intentionally normalizes parking to `not_returned`; this is an honest unknown, not proof of no parking (`lib/providers/hotelAmenityEvidence.ts:151-176`).
- A collapsed hotel card can show **On-site parking** only when the property-level fact is confirmed and guaranteed. Its accessible label correctly asks the user to review fees and space availability in details (`app/components/HotelCard.tsx:737-750`, `788-795`). This helps facility discovery but does not answer whether the user can actually park for the selected stay.
- Expanded details can say on-site parking is provider-confirmed or requestable and can show only **included**, **additional charge applies**, or **not documented** for the fee. Parking is embedded in the broader **Access & room requests** panel rather than presented as a complete parking decision (`app/components/HotelCard.tsx:36-82`, `893-897`). There is no nearby/off-site option, distance/address, operator, reservation requirement, exact charge, or charge basis.
- The **Review hotel** link serializes hotel identity, price, provider URL, and location into `BookingHotelContext`, but no amenity or parking evidence (`lib/booking/config.ts:18-29`, `360-385`). The handoff review therefore loses the parking signal and asks the partner to confirm rate, taxes, room availability, and cancellation policy without naming parking (`app/book/BookingFlow.tsx:643-668`).
- Hotel handoff analytics record view, continue, back, and return events, but neither `HotelCard` nor the handoff records parking evidence impressions, parking-detail interaction, or a property exit after parking review (`app/book/BookingFlow.tsx:569-628`, `653`). The requested behavioral baseline does not exist today.

The decision gap is therefore not simply “parking is absent.” Expaify can sometimes disclose **property-level on-site parking presence**, but it cannot yet answer the four questions a driver needs: **Is there a usable parking option for my stay? Where is it? What will it cost? What must I do before arrival?**

## Smallest reliable parking signal set

Downstream research must validate this proposed minimum against real supplier coverage. Each dimension needs an explicit `unknown`/`not_returned` state; a property should not receive a positive “parking fit” label when any critical requirement is inferred.

1. **Facility and selected-stay status — kept separate.** State whether the supplier documents a parking facility or explicitly documents no parking. Separately state whether a space for the selected stay is confirmed, must be requested/reserved, is unavailable, or is unknown. A documented facility is never proof that a space is held.
2. **Location type.** `on_site`, `nearby_off_site`, or `unknown`; include a provider-documented distance or address only when supplied. Street parking must not be collapsed into on-site or nearby managed parking.
3. **Cost and basis.** `included`, `paid`, or `unknown`; when an exact supplier amount exists, preserve it as `{ priceCents, currency }` plus its basis (for example per night, per stay, or per entry). “Paid” without an amount must remain “cost not documented,” not be estimated or folded into the hotel total.
4. **Reservation requirement.** `required`, `available_on_request`, `not_accepted`/first-come where explicitly documented, or `unknown`. These describe the process, not a promise of a space.
5. **Operator.** `hotel_operated`, `third_party`, or `unknown`, with provider/property attribution. Third-party parking must stay visibly distinct even when physically on site, because payment, access, cancellation, and support may belong to another operator.

The comparison signal can be concise, but the underlying evidence cannot be reduced to a single `hasParking` or `freeParking` boolean. At minimum, a driver must be able to distinguish:

- **confirmed fact** from **not documented**;
- **facility exists** from **space confirmed for these dates**;
- **on site** from **nearby/off site**;
- **hotel operated** from **third party**; and
- **included**, **paid with known amount**, **paid with unknown amount**, and **cost unknown**.

## Measurement plan

These definitions establish baselines without claiming that an observed exit proves a user's motive.

### 1. Parking-evidence coverage

Measure at the normalized offer level, segmented by provider, destination, and whether dates are present:

- **Any-evidence coverage:** hotel offers with at least one supplier-returned parking dimension / all displayed hotel offers.
- **Comparison-ready coverage:** offers with facility status, location type, cost state, reservation requirement, and operator all returned (including explicit negative values) / all displayed offers.
- **Selected-stay coverage:** offers with a supplier-returned parking-space state scoped to the selected dates/rate / all displayed offers.
- **Unknown share by dimension:** offers where each dimension is `unknown` or `not_returned` / all displayed offers.

Explicit negative facts count as evidence coverage; inferred defaults do not. Current code supports only partial any-evidence coverage for `on_site_parking`, with no possible comparison-ready or selected-stay coverage under the proposed set.

### 2. Interaction with parking signals

Instrument privacy-safe, bounded events once a surface exists:

- `hotel_parking_signal_impression` — fire once per visible hotel card; properties: offer/provider id, evidence completeness bucket, facility state, location-type state, cost-state bucket, reservation-state bucket, operator-state bucket, and viewport group. Do not send raw addresses, URLs, or free text.
- `hotel_parking_details_opened` — fire when the user opens details for a hotel carrying a parking signal or explicit unknown state; include the same bounded evidence buckets.
- `hotel_parking_section_reached` — fire once when at least 50% of the parking section is visible for at least one second. A generic **Details** click alone does not prove parking review.
- If a parking filter is later approved, measure open/apply/change/clear separately and disclose whether unknown inventory is retained or excluded. Filter work is not authorized by this discovery.

Report detail-open and section-reach rates by evidence completeness. Raw clicks alone are not success; the comprehension check in UXR must verify that users interpret facility presence, space certainty, location, operator, and unknowns correctly.

### 3. Exits after parking review

- **Explicit property rejection after parking review:** a return to results, close/collapse followed by another property selection, or parking-related search refinement after `hotel_parking_section_reached` and before provider handoff. Attribute this only as “after parking review,” never “because of parking.”
- **Handoff after parking review:** `hotel_handoff_continue_clicked` after a parking-section reach for the selected property.
- **Unresolved-parking handoff rate:** handoffs where one or more minimum dimensions remain unknown, segmented from comparison-ready handoffs.
- **External return rate:** retain the existing `hotel_handoff_returned` measure and segment by parking completeness only when the same bounded evidence state is carried into handoff analytics. A return from the provider is not proof that parking caused the return.

Browser abandonment without a bounded in-product action remains unclassified. The primary behavioral comparison is rejection versus handoff after a verified section reach, not a speculative “parking caused exit” metric.

## Constraints

1. **No space promise and no inference.** A supplier-confirmed parking facility, even on site, does not mean a space is available or reserved for the selected stay. Only explicit selected-stay evidence may state that a space is confirmed. Limited, first-come, requestable, reservation-required, unavailable, and unknown must remain distinct. Missing data never becomes “no parking” or “available.”
2. **Preserve location, operator, provenance, and money integrity.** Hotel-operated, third-party, on-site, nearby/off-site, street, and unknown parking are not interchangeable. All external facts must be normalized in `lib/providers`, carry source and scope, and exact charges must use `{ priceCents, currency }` with a documented basis. Components must not parse supplier prose or call vendors.
3. **Keep the repair scoped and usable.** Define the smallest reliable comparison and handoff signal; do not add parking booking, maps, directions, live garage inventory, EV charging, vehicle-size/clearance fit, valet/self-park choice, or a new filter without separate approval. Unknowns must be plain, concise, keyboard/screen-reader accessible, and non-overlapping at 375px and 1280px without displacing nightly price, Deal Score, location, or the booking CTA.

## Success statement

This is solved when a first-time driver can compare a hotel, review its parking evidence, and reach the booking partner knowing whether a parking facility is documented, whether a space for the selected stay is confirmed or still requires verification, whether it is on site or nearby and hotel- or third-party-operated, what the documented cost is, and whether advance reservation is required—without expaify promising a space or disguising an unknown.

## Scope relationship and boundaries

This ticket narrows and extends settled work rather than replacing it:

- `hotel-amenity-provenance` owns the reusable evidence discipline: canonical id, status, scope, source, confidence, fee, and explicit unknowns.
- `hotel-access-requirements` established the safe distinction between confirmed property parking and requestable space, and the current card implements that limited pattern.
- `hotel-amenity-fit` owns general amenity prioritization and any approved multi-amenity filter behavior.
- This ticket owns the parking-specific decision set across comparison, detail, and handoff: facility versus selected-stay availability, on-site versus nearby, hotel versus third-party operation, cost/basis, reservation requirement, and post-review measurement.

Out of scope:

- parking reservation or payment inside expaify;
- guarantees derived from a facility listing or property-level policy;
- maps, walking routes, garage directions, security, surveillance, accessibility-specific bay/path requirements, EV charging, valet, or vehicle clearance;
- adding parking to Deal Score or estimating its charge inside hotel price history;
- implementing a provider integration, UI, filter, or analytics in this UXD stage.

## Required UXR handoff

`UXR-HOTEL-PARKING-FIT-01` must read this report and produce `docs/pipeline/hotel-parking-fit/02-research.md`. It must:

1. Audit the current `HotelAmenityEvidence`, `normalizeHotelAmenityEvidence`, Hotellook live/cache paths, `HotelCard`, booking context/handoff, and analytics events; treat current partial parking work as the baseline.
2. Evaluate one or two established hotel-search patterns at the interaction level, focusing on facility versus selected-stay space, on-site versus nearby, hotel versus third-party operation, price/basis, reservation rule, and unknown-data disclosure—not visual styling.
3. Validate the smallest provider-neutral parking evidence contract against actual available supplier vocabulary and coverage. Identify which proposed fields current supply can support, which need a later provider/DEV dependency, and which must remain unknown.
4. Produce 3–5 specific, testable directives for result comparison, expanded detail, booking handoff, explicit unknowns, focus/screen-reader behavior, and 375px/1280px fit. Do not design a single parking boolean.
5. Define event properties, denominators, completeness buckets, and sequence rules for parking-evidence coverage, signal/detail interaction, section reach, explicit property rejection after review, handoff after review, and unresolved-parking handoff. Do not infer motivation from abandonment.
6. Define comprehension tasks that test whether drivers correctly distinguish: facility from selected-stay space; on-site from nearby; hotel-operated from third-party; included from paid/unknown cost; reservation-required/requestable from guaranteed; and undocumented from unavailable.

## Handoff

Create `UXR-HOTEL-PARKING-FIT-01` with this report path and the one-sentence problem statement embedded. The research ticket must preserve the no-space-promise rule, explicitly distinguish hotel-operated from third-party parking, and make unknown evidence a first-class outcome.
