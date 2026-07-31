# UXD-HOTEL-RENOVATION-DISRUPTION-01: Hotel Renovation Disruption Visibility

**Ticket:** UXD-HOTEL-RENOVATION-DISRUPTION-01 · **Stage:** UX Discovery · **Priority:** P0  
**Date:** 2026-07-31 · **Feature slug:** `hotel-renovation-disruption`  
**Persona:** Senior UX Strategist

## Problem statement

A traveler can choose and hand off a hotel that a supplier has explicitly disclosed as undergoing stay-overlapping renovation, construction, or a material facility closure because expaify neither carries nor places that notice in the comparison journey, making a cheap, well-scored option appear fully usable when a decision-changing limitation is already known.

## Who is affected and where

The primary affected traveler is not someone seeking a universally “construction-free” hotel. It is a traveler whose stay depends on a disclosed condition being compatible with their trip:

- A light sleeper, family with young children, remote worker, or short-stay guest for whom daytime or overnight work can make the room unsuitable.
- A traveler choosing a property for a specific facility—pool, restaurant, spa, lift, lobby, parking, beach access, or fitness center—that the supplier says will be closed or restricted.
- A traveler with limited flexibility who may still prefer the hotel if the work is outside their dates, confined to another area, or adequately bounded.
- A first-time or mobile traveler scanning on 375px, where a notice hidden in expanded details is especially easy to miss before the primary action.

The decision breaks at three linked points:

1. **Result selection.** The collapsed `HotelCard` presents identity, quality, location, price, Deal Score, selected policies, and “Review hotel,” but has no renovation, construction, or facility-closure signal. A materially disrupted property can therefore look equivalent to an unaffected one at the comparison point.
2. **Hotel detail.** The expanded card contains several source-aware evidence panels, yet no section can state what work or closure the supplier disclosed, the affected area or facility, the reported severity, or whether the disclosed dates overlap the searched stay.
3. **Booking review and provider handoff.** `buildBookingHotelContext` carries price, location, policy, and eligibility families into `BookingFlow`, but no disruption notice. The review page can repeat smoking and other supporting evidence while losing a known disruption before the traveler clicks “Check rooms at provider.”

## Current implementation evidence

The present gap is structural and measurable:

- `HotelOffer` in `lib/types.ts` has no renovation, construction, facility-closure, disruption, affected-area, severity, start-date, end-date, source, or freshness field.
- The current hotel adapter in `lib/providers/hotellook.ts` normalizes quality, location, limited amenity/access evidence, funds policy, smoking policy, rate eligibility, and admission capability. It does not normalize supplier disruption disclosures in either live or cached offers.
- `app/components/HotelCard.tsx` has no production copy or rendering branch for renovation, construction, closure, or disruption. Its primary review action remains available based on price and booking URL, regardless of a disclosed material disruption.
- `BookingHotelContext` in `lib/booking/config.ts` has no disruption field, so even future card-only treatment would disappear at the higher-stakes review boundary.
- Existing hotel handoff analytics record review and provider continuation, but there is no disruption-notice exposure, detail-open, acknowledgement, or suitability outcome. The product therefore cannot currently measure whether a disclosed issue was noticed or changed a decision.

The baseline is **0% surfaced coverage for supplier-disclosed renovation disruption in the wired result-to-handoff path**, not evidence that current hotels have no disruptions. Supplier silence, adapter non-support, and an explicit “no disruption” statement are three different states and must not be collapsed.

## The single discovery problem

This ticket is about **the threshold at which an explicit supplier disclosure becomes material enough to interrupt comparison, and where that disclosure must appear to be noticed without removing a viable option**.

It is not a general hotel-news feed, a construction-risk prediction, or a quietness feature. It does not authorize inferring works from reviews, photos, maps, permits, neighborhood activity, price drops, or missing facilities. It also does not assume every renovation makes a hotel unsuitable: the correct outcome may be informed continuation when dates do not overlap or the affected facility does not matter to the traveler.

## Disclosure-threshold hypothesis to validate

UXR should test the following threshold rather than treating it as settled fact:

> Promote a supplier notice to the result card when it explicitly reports renovation, construction, or a closure/restriction that could materially affect sleep, room access, arrival, safety-related circulation, or use of a named primary facility **and** its reported dates overlap the searched stay, partially overlap it, or are not specific enough to rule out overlap. Keep the option visible. Put the complete attributed notice in hotel details and repeat its decision-relevant summary immediately before provider handoff.

The threshold has four evidence rules:

1. **Explicit disclosure required.** A named supplier/property source must have reported the work or closure. No report means “not documented by this supplier,” not “no disruption.”
2. **Material impact required for card promotion.** Cosmetic work with an explicit non-overlap, or work explicitly confined away from guest facilities with no reported service/noise/access effect, stays in detail rather than receiving a comparison-level warning. Named closure of a trip-defining facility, reported noise, reduced access/service, or guest-area construction qualifies for card promotion.
3. **Date relationship must be legible.** Show exact reported dates when supplied and label the relationship to the searched stay as overlap, partial overlap, no overlap, or timing not specified. Never invent an end date or interpret “until further notice” as current forever; preserve the source wording and checked date where available.
4. **Severity uncertainty stays uncertainty.** Use a supplier’s concrete impact evidence—affected facility/area, operating hours, access restriction, or supplier severity label—when present. If impact or timing is not specified, say so. Do not derive “minor,” “major,” or a risk score from stars, price, review sentiment, or copy tone.

### Placement hypothesis

- **Result card:** one concise, non-dismissible material-disruption cue before “Review hotel” whenever the threshold is met. It states the affected facility/impact and stay-date relationship; it does not hide, down-rank, disable, or mark the hotel “bad.”
- **Hotel detail:** the complete supplier-attributed disclosure, affected areas/facilities, reported schedule, searched-stay relationship, severity/impact evidence, last-checked time when available, and an explicit unknown for each material missing fact.
- **Booking review/handoff:** a persistent summary in the review sequence before the outbound provider action. Do not rely on the traveler remembering a card cue or opening a details accordion. The provider remains the place to confirm current conditions.
- **No qualifying notice:** no warning badge on every card. Detail/review uses a calm, transparent state such as “This supplier did not provide renovation or closure information” only where the state can be understood without implying the property is unaffected.

UXR must pressure-test whether this progressive placement produces high detection of material notices without warning fatigue, blanket avoidance, or suppressing hotels whose disclosed work is irrelevant or outside the stay.

## Measurable signals and validation criteria

The success measure is informed suitability, not maximum handoff conversion and not maximum avoidance.

1. **Material-notice detection:** in task-based comparison, the percentage of participants who notice a qualifying stay-overlapping notice before initiating hotel review, and again before outbound handoff. Record detection separately at result and review surfaces.
2. **Correct suitability decision:** the percentage who avoid a clearly unsuitable fixture *and* retain or choose a viable fixture whose work is outside the searched dates or explicitly non-material. Score both halves; a design that causes blanket avoidance fails.
3. **Evidence comprehension:** the percentage who can correctly state what is affected, who disclosed it, whether dates overlap, and which severity/timing facts remain unknown. Separately record the false conclusions “no notice means no work” and “unknown timing means definite overlap.”
4. **Threshold precision:** false-promotion rate for cosmetic/non-overlapping disclosures and miss rate for decision-changing closures, access restrictions, or reported noise. UXR must recommend the validated minimum evidence combination and escalation rule from these errors.
5. **Qualified continuation:** provider handoff after the traveler has been exposed to the applicable notice and can explain its consequence. A lower handoff rate for unsuitable stays is a successful outcome; continuation for compatible stays must not be treated as a failure.
6. **Post-handoff mismatch signal:** a bounded return reason such as “Renovation or closure details did not match” may measure explicit mismatch intent. Do not infer causality from back navigation or abandonment and do not collect free-text health, sleep, or accessibility needs.

UXR should set numeric targets after baseline usability testing; discovery must not invent a validated rate before participants have evaluated the threshold and placements.

## Constraints

1. **Supplier evidence and honest unknowns.** Surface only explicit supplier/property disclosures received through `lib/providers` with source, dates, affected area/facility, severity/impact evidence, and freshness preserved where available. Missing data must remain unknown; absence must never become “no renovations,” and expaify must not infer disruption from reviews, location, photos, price, permits, or silence.
2. **Proportionate, non-suppressive decision support.** Material, potentially stay-overlapping notices must be hard to miss, but the hotel remains visible and bookable. No automatic exclusion, Deal Score change, ranking penalty, alarmist “unsafe” label, or universal warning chip. Clearly non-overlapping or non-material work uses lower-prominence detail treatment.
3. **Continuity, accessibility, and delivery contracts.** The same normalized notice and searched-stay relationship must survive result, detail, and review/handoff without wording drift; all outbound links retain affiliate markers. At 375px and 1280px, the cue must wrap without collision, be keyboard/screen-reader readable, and communicate status with text rather than color or icon alone.

## Success statement

This is solved when a first-time traveler can notice a material supplier-disclosed renovation, construction impact, or facility closure before selecting a hotel; understand what is affected, whether the reported dates overlap their stay, and what remains unknown; and avoid an unsuitable stay without being pushed away from a viable option whose disclosed work is non-overlapping or immaterial.

## Required UXR handoff

`UXR-HOTEL-RENOVATION-DISRUPTION-01` must read this report and produce `docs/pipeline/hotel-renovation-disruption/02-research.md`. Research must:

1. Audit the live provider, cache, `HotelOffer`, result/detail, booking-context, review/handoff, and analytics paths, distinguishing UI capability from supplier evidence that can actually reach production.
2. Inspect one or two established hotel-booking patterns at the interaction level for renovation/closure notices, focusing on materiality, date overlap, progressive disclosure, unknown states, and confirmation at handoff—not visual styling.
3. Test the proposed threshold with fixtures spanning: stay-wide construction with reported noise; one named primary-facility closure; partial date overlap; timing unspecified; cosmetic/non-guest-area work; explicit non-overlap; impact unspecified; conflicting or stale notices; and no supplier disclosure.
4. Validate placement at collapsed result, expanded detail, and pre-handoff review on 375px mobile and 1280px desktop. Measure notice detection, correct avoidance, viable-option retention, comprehension, and warning fatigue.
5. Produce 3–5 testable design directives, including the final minimum-disclosure threshold, exact prominence rule, evidence/unknown vocabulary, date-overlap logic, and what repeats before provider handoff.

## Scope boundary

This discovery does not authorize scraping reviews or public records, predicting construction, contacting properties, collecting traveler health/sleep needs, adding a disruption filter, changing ranking or Deal Score, suppressing inventory, blocking booking, or implementing provider/data/UI changes. Any supplier field must be normalized behind `HotelProvider` and returned through `Result<T>` in a later approved stage.

## Handoff

Create `UXR-HOTEL-RENOVATION-DISRUPTION-01` with this report path and the one-sentence problem statement embedded. The research ticket must validate the disclosure threshold and placement hypothesis while preserving explicit-source, transparent-unknown, date/severity-evidence, and non-suppression boundaries.
