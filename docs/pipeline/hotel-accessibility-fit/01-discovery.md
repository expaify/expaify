# UXD-HOTEL-ACCESSIBILITY-FIT-01: Hotel Accessibility Accommodation Fit

## User Pain Point

Travelers with mobility, hearing, or visual access needs cannot determine whether a specific hotel and bookable room fit their essential accommodation requirements because the current hotel flow exposes only a small set of property facts and generic room requests, while most fit-critical details are absent or indistinguishable from an unverified promise.

## Who Is Affected and Where

Affected users are travelers who need an accommodation to travel safely or independently, including travelers who use mobility devices, need a step-free bathing or arrival route, rely on visual alarms or accessible communication, or need wayfinding/visual-access support.

The problem spans three decision points:

1. **Hotel search filtering:** A user cannot limit results to properties with evidence for their non-negotiable need; the current hotel search criteria have no accessibility-fit input.
2. **Result scanning:** A user cannot quickly separate a property with relevant, sourced evidence from one whose relevant information is missing. The card only exposes a confirmed elevator as a collapsed fact; the rest of the access content is inside expanded details.
3. **Room selection and provider handoff:** The app has no internal hotel-room selection flow. The existing access panel correctly says generic room requests are not guaranteed, but it cannot tell the user whether the selected rate/room satisfies fit-critical requirements before leaving expaify.

## Current Evidence and Measurable Signal

Source review identifies a real coverage and decision-support gap, not an assumed preference:

- `HotelAmenityEvidence` provides status, scope, source, fetched time, confidence, and certainty, but the active access fact set is limited to `elevator`, one broad `step_free_route`, and four generic room requests (`lib/providers/hotelAmenityEvidence.ts`). It contains no fit-critical room/bathroom, communication, or visual-access attributes.
- The hotel card treats an elevator as the sole scan-level access fact. `Access & room requests` appears only in expanded details (`app/components/HotelCard.tsx`), so a traveler must open each candidate to discover whether access data is unavailable, unknown, or contradictory.
- `step_free_route` is property-scoped and written as a route from entrance to room. It cannot establish the distinct links a traveler may need to assess: arrival/parking or transit drop-off, entrance, reception/common areas, elevator, guest-room entry, bedroom circulation, and bathroom.
- Room-level evidence presently supports only a *request* or selected-stay guarantee for floor, proximity to elevator, or connecting rooms. It has no fields for accessible-room type, roll-in shower or tub configuration, grab bars, door/clear-floor dimensions, lowered controls, visual alarms, TTY/relay-compatible contact, tactile/Braille signage, or alternative-format communication.
- The existing interface provides explicit `not_returned`, `unknown`, `unavailable`, loading, and error states. This is a sound honesty boundary, but the broad fallback asks users to confirm directly with the provider. The measurable baseline is therefore a high likelihood of property contact or provider-site research whenever a fit-critical detail is not in the narrow evidence set.

The primary outcome metric for the next stages is **verified fit identification rate**: among hotel candidates considered by a traveler with one declared essential need, the share for which they can identify `supported`, `not supported`, or `unknown—confirmation required` before provider handoff. Supporting measures are:

- rate of provider/property contact or external research caused by an `unknown` essential attribute;
- rate of essential-need filters returning a result with evidence at the appropriate scope;
- rate of users confusing a property fact or a room request with a selected-room guarantee;
- coverage rate: returned hotel/rate records with a current source, scope, and status for each prioritized attribute.

## Constraints

1. **Evidence before claim:** Every accessibility statement must be a structured provider/property-backed attribute with `status`, `scope`, source, and retrieval time. Missing, malformed, stale, conflicting, or merely generic information must remain explicit as `unknown`, `not returned`, or `needs confirmation`; no accessibility outcome may be inferred from hotel class, photos, a generic amenity label, or a room request.
2. **Scope and certainty must remain separate:** A property capability, a particular room's feature, a rate's eligibility, and a selected-stay guarantee are different facts. The flow must never convert a requestable feature into a guarantee or promise that a hotel can accommodate an individual traveler.
3. **Usable accessibly at 375px and desktop:** Essential fit status must be scannable without relying on color, hover, icon-only meaning, or expansion of every result. Filters, disclosure, keyboard focus, screen-reader summaries, and touch targets must work on mobile and desktop without burying the primary price and provider-handoff boundaries.

## Prioritized Evidence Model

The research/design stages should validate provider availability and vocabulary, but preserve this order of decision value. Each attribute must carry: canonical ID and value, `status` (`supported`, `not_supported`, or `unknown/not_returned` mapped to the existing honest states), scope (`property`, `room`, `rate`, `selected_stay`), source, fetched time, and certainty (`informational`, `requestable`, or `guaranteed for selected stay`). A single generic “accessible” flag is not sufficient.

| Priority | Need family | Evidence needed to make a decision | Minimum scope | Why it comes first |
| --- | --- | --- | --- | --- |
| P0 | Mobility: arrival and route | Step-free arrival/drop-off or parking route; entrance; reception/common-area route; elevator availability where needed; route to guest-room entry | Property; route segments may be unknown independently | A property can have an elevator but still be unusable at arrival, entry, or the room route. |
| P0 | Mobility: room and bathroom | Accessible-room availability for the stay; room-entry and internal circulation details; bathroom type (roll-in shower/tub), grab bars, shower seat, and reachable controls where returned | Room/rate, then selected stay | These determine whether an offered accommodation fits, rather than whether the building has a general feature. |
| P0 | Fit assurance | Whether the specific offered rate can request or guarantees the required room/access feature; any provider confirmation reference where available | Rate/selected stay | Prevents a user from treating a property-level fact as a bookable-room promise. |
| P1 | Hearing access | Visual fire alarm; visual door/phone notification; captioned/accessible communication where supplied; communication-request capability | Room/property; selected stay when confirmed | These are safety and independent-use requirements that generic “accessible” labels conceal. |
| P1 | Visual access and wayfinding | Braille/tactile room and common-area signage; accessible wayfinding/arrival instructions; accessible communication format or assistance when sourced | Property/room | Enables a traveler to distinguish a documented support from no available evidence. |
| P2 | Service and fit context | Service-animal policy, accessible parking availability/cost, accessible transport/entrance notes, and direct property contact channel with source provenance | Property/rate | Useful to complete a decision, but must not substitute for P0 room and route evidence. |

For every P0 need, the UI must allow all three outcomes: **supported with evidence**, **not supported with evidence**, and **unknown—confirm before booking**. “Not returned” is a data-coverage outcome, not proof of absence. Conflicting source records must resolve to an explicit conflict/confirmation-needed state rather than optimistic support.

## Decision-Flow Hypothesis

If expaify asks travelers to identify only their essential accessibility need(s), then applies them against evidence at the right scope and shows a concise fit label on every result, travelers can keep candidates with verified support, rule out documented mismatches, and recognize unknowns before investing in a provider handoff.

The hypothesized decision flow is:

1. A traveler optionally selects one or more essential need families, not a vague “accessible hotel” filter.
2. Results show the selected needs first, with evidence state and scope: **supports**, **does not support**, or **not documented—confirm**. A result cannot qualify as a verified match when a P0 need is only property-scoped or requestable.
3. Opening a result reveals the evidence trail: individual route/room attributes, source, retrieval time, scope, and whether the provider can only take a request or confirms the selected stay.
4. Before external handoff, the traveler sees a short, need-specific confirmation boundary for any unknown, requestable, stale, or conflicting P0 detail. The CTA remains provider handoff, not a promise that expaify has reserved an accessible room.

This hypothesis should be tested against the observed baseline: whether users can correctly classify a property as supported, unsupported, or unknown for a declared P0 need without contacting the property, and whether they avoid interpreting a request as a guarantee.

## Success Statement

This is solved when a first-time traveler with a mobility, hearing, or visual access need can filter and compare hotel candidates, identify what is verified for the property versus the room/rate, and recognize every unknown that requires confirmation before provider handoff, without relying on a generic accessibility promise or contacting a property simply to decode missing evidence.

## Scope Boundary

This discovery defines an evidence and decision-support problem only. It does not authorize a new provider integration, a promise of accommodation, a hotel room-booking flow, or the collection of disability/medical information. Provider capability, data freshness policy, attribute mapping, filter behavior, and final copy belong to the UXR and UXDES stages.
