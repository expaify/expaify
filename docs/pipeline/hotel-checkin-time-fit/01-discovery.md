# UXD-HOTEL-CHECKIN-TIME-FIT-01 — Hotel Arrival and Departure Time Fit Discovery

Date: 2026-07-31  
Stage: UX Discovery  
Priority: P0  
Feature slug: `hotel-checkin-time-fit`  
Downstream ticket: `UXR-HOTEL-CHECKIN-TIME-FIT-01`

## Problem statement

A traveler comparing hotels cannot tell whether their planned arrival and room-use departure fit the property's published standard check-in and checkout times—or whether an exception is merely request-only—so a timing mismatch can remain invisible until the booking partner or property rejects, conditions, or cannot guarantee the plan.

This is a decision-confidence problem, not a request-submission feature. The job is to help a traveler distinguish three truthful outcomes before booking handoff: **fits the published standard times**, **falls outside the published standard times**, or **cannot be assessed from published information**.

## Who is affected and where

The primary affected traveler already knows when they expect to reach or stop using the room:

- an early arrival who reaches the property before standard room access begins;
- a late-night arrival who reaches the property after a published check-in end time, or whose admission after that time is not stated; and
- a traveler who needs to retain the room after the published checkout deadline.

An early-morning departure is not, by itself, a checkout-time mismatch: checkout is normally a latest room-vacate boundary, so leaving earlier fits it. Desk access, key return, transport, breakfast, and luggage storage may still matter, but they are separate logistics and must not be inferred from checkout time.

The decision spans three pre-payment surfaces:

1. **Result comparison:** identify whether timing is a reason to keep, rule out, or verify a hotel without making every traveler parse a policy block.
2. **Hotel detail:** understand the exact published standard times, what part of the plan falls outside them, and what remains unknown.
3. **Booking handoff:** preserve the same facts and uncertainty while clearly directing the traveler to the booking partner or property for any exception.

The current implementation supports none of those tasks. `HotelOffer` in `lib/types.ts` has no arrival/departure-time evidence or traveler timing intent. `HotelCard` renders no standard check-in or checkout times. `HotelHandoffReview` offers only generic provider confirmation and a **Special requests** block that names early check-in; it does not compare a plan with standard times and correctly does not claim that expaify sends or guarantees a request.

## Exact scope and relationship to adjacent work

This ticket owns **fit interpretation**: whether a traveler's stated scenario fits published standard room-access boundaries, and how standard facts, mismatches, request-only possibilities, and unknowns should be ordered.

It does not replace `docs/pipeline/hotel-checkin-logistics/`, which already owns the provider-neutral evidence model for arrival time, departure time, front-desk access, and late-arrival instructions. UXR must treat that work as an input and avoid designing a second evidence contract. The distinction is:

- `hotel-checkin-logistics`: **What has the property/provider published?**
- `hotel-checkin-time-fit`: **What can the traveler safely conclude about their own schedule from those published facts?**

The following are adjacent but out of scope: luggage storage, breakfast hours, parking, transfers, key return, front-desk staffing, admission eligibility, cancellation/no-show policy, property messaging, post-booking confirmation, and adding itinerary or arrival-time inputs to production. A published late-arrival instruction may be referenced only as evidence already owned by `hotel-checkin-logistics`; this ticket must not broaden into a desk-operations taxonomy.

## Measurable signal

### What the repository proves today

- **Published-time coverage on expaify: 0%.** `HotelOffer` cannot carry standard arrival/departure times, and current provider normalization does not map them.
- **On-platform fit identification: 0%.** No result, detail, or handoff surface can label a plan as fitting, mismatching, or unknown.
- **Traveler-intent coverage: 0%.** Hotel search carries check-in and checkout dates, not expected property-arrival time or planned room-vacate time. A calendar date must not be treated as timing intent.
- **Exception certainty is separated only in generic guidance.** The shipped handoff copy says early check-in is a request, that expaify sends nothing, and that requests are not guaranteed. That is a sound trust boundary, but it is not connected to a visible standard-time mismatch.

These structural zeros prove the capability gap, not its prevalence. No production analytics currently show how many travelers have a mismatch or whether timing caused a handoff exit; generic exits must not be relabeled as timing failures.

### Primary validation signal for UXR

Use scenario-based comprehension tasks until explicit timing intent exists. For each early-arrival, late-night-arrival, and post-checkout-room-use scenario, measure the share of first-time users who can correctly state, before booking handoff:

1. the property's published standard time relevant to the scenario;
2. whether the scenario fits, falls outside, or cannot be assessed from that fact;
3. whether the next step is standard access, a request-only option that is not guaranteed, or direct verification because no exception path is published; and
4. which claim is sourced fact versus uncertainty.

Record confidence only after the factual answer. **Calibrated confidence** is the primary outcome: high confidence in a wrong or over-guaranteed answer is a trust failure, while a confident “this is not stated; I need to verify” is success.

Secondary observations are time to identify the mismatch, incorrect inference rate, keep/rule-out/verify choice, and handoff continuation. These diagnose the hierarchy; they do not prove real-world demand without an explicit traveler-intent sample.

## Hierarchy hypothesis for research to validate

The minimum hierarchy should be tested in this order:

1. **Fit outcome:** `Fits standard times`, `Outside standard times`, or `Cannot assess`. This is the traveler's decision, but it may appear only when both the relevant published fact and the scenario time are explicit. No time means no computed fit.
2. **Published standard fact:** the property's source-attributed local standard boundary—earliest standard room access for arrival, or latest standard room occupancy for departure. A range must retain both ends. “Check-in date” must not be mistaken for a time.
3. **Exception status and next step:** clearly separate `request-only — not guaranteed` from standard access. If no published exception path exists, say that the traveler must verify; do not convert silence into either permission or refusal.
4. **Supporting uncertainty:** source, freshness when available, missing/conflicting facts, and the boundary of what expaify can confirm.

UXR should validate or reorder this hierarchy rather than assume it ships. In particular, test whether leading with a derived fit outcome improves comprehension or hides the evidence users need to trust it.

## Constraints

1. **Published facts only; uncertainty is a first-class answer.** Never infer a standard time from hotel class, market norms, dates, flight times, or another property's policy. Preserve provider/property source and freshness. Missing, partial, or conflicting information must resolve to `Cannot assess`, never to “fits,” “available,” or “not allowed.” Every external fact must continue to enter through `lib/providers` and the existing `Result<T>` contract.
2. **Standard access and exceptions remain visibly separate.** Early check-in and late checkout are request-only unless a provider-backed selected-stay guarantee explicitly says otherwise; expaify does not select, send, acknowledge, or guarantee them. A late-night arrival outside a published window is not automatically an “early/late check-in request”: if the property has not published an admission path, the only truthful next step is verification.
3. **Validate fit without expanding the product contract.** Discovery and UXR may use explicit scenario times, but this ticket does not authorize production itinerary ingestion, arrival/departure-time fields, automatic flight-to-hotel matching, ranking/filtering, property messaging, or post-booking workflow. Any later UI must preserve price, Deal Score, location, and the existing handoff hierarchy and remain usable at 375px and 1280px.

## Success statement

This is solved when a first-time traveler can use a hotel's published standard times to correctly identify whether an early arrival, late-night arrival, or planned post-checkout room use fits, falls outside, or cannot be assessed—and can identify the next step for an exception without believing a request-only option is standard, sent, or guaranteed.

For discovery to be considered validated, UXR must produce a hierarchy in which users correctly distinguish facts from uncertainty and exceptions in all three scenarios, including the safe `Cannot assess` outcome. A hierarchy that merely increases confidence without improving correctness fails.

## Handoff requirements

Create `UXR-HOTEL-CHECKIN-TIME-FIT-01`. Research must:

1. Read this report plus `docs/pipeline/hotel-checkin-logistics/01-discovery.md`, `02-research.md`, and `docs/pipeline/special-requests/03-design.md`; audit the current result, detail, and hotel handoff source rather than assuming those documents shipped.
2. Compare one or two established hotel-booking patterns at the interaction level for standard-time display, late-arrival uncertainty, and request-only early check-in/late checkout—not visual style.
3. Test the hierarchy hypothesis with at least one scenario in each class: before standard check-in, after a published check-in end or with no late-arrival answer, and room use after checkout. Include an early-departure control scenario to detect the false belief that leaving before checkout is a mismatch.
4. Report correctness, calibrated confidence, mismatch-identification time, false-guarantee inference, and keep/rule-out/verify choice separately. Do not infer intent or causality from generic analytics.
5. Produce 3–5 testable design directives only for the smallest hierarchy justified by the evidence. Reuse the existing arrival-logistics evidence contract; if reliable fit requires a new production intent input, report that dependency instead of silently expanding scope.

