# UXD-HOTEL-LAUNDRY-AVAILABILITY-01: Hotel Laundry Availability Discovery

Date: 2026-08-03  
Stage: UX Discovery  
Priority: P1  
Feature slug: `hotel-laundry-availability`

## User Pain Point

A traveler evaluating a longer hotel stay cannot tell before the provider handoff whether laundry means guest-operated machines, a hotel-managed paid service, a provider-identified nearby option, or no reliable information, so they cannot judge whether the property supports a workable laundry plan without researching elsewhere.

## Who Is Affected And Where

This primarily affects travelers evaluating multi-night stays where laundry can change packing, baggage, and property choice: extended-stay and work travelers, families, and travelers moving through several destinations. For measurement in this discovery, a **long-stay evaluation** is a hotel-detail view for a stay of five or more nights. That threshold defines an analysis cohort, not a claim that shorter stays never need laundry and not a rule for hiding evidence.

The affected step is **deal-detail evaluation**, after a traveler opens a hotel from `/deals` and before they choose the external room-provider handoff on `/deals/[dealId]`. The user needs enough evidence here to keep the property, rule it out, or continue with a clear need to verify. This ticket does not own search filters, ranking, booking, or post-booking service arrangements.

## Current, Measurable Signal

The repository establishes the evidence gap; it does not yet establish how many travelers abandon because of it:

1. `app/deals/[dealId]/page.tsx` renders the stay dates and night count, followed by a section titled **Hotel fit**, but that section contains no laundry evidence. A traveler can reach the provider handoff without learning whether any usable laundry mode was returned.
2. `lib/types.ts` has a provider-neutral `HotelAmenityEvidence` shape, but it has no fields that distinguish self-service machines, hotel-managed laundry, or a nearby option. Its fee vocabulary can say `included`, `paid`, or `unknown`, but it cannot supply or justify a price or turnaround time.
3. `lib/providers/hotelAmenityEvidence.ts` normalizes a fixed catalog of access and parking facts. Laundry ids are not accepted, so any such raw item would be discarded rather than preserved as evidence.
4. The live `deals` record in `lib/db/schema.sql` has no amenity or laundry evidence field. The deal-detail path therefore has no persisted structured laundry signal to render.
5. `HotelDecisionAnalytics` already records hotel-detail views, decision-section reach, handoff starts, and back-to-results actions. It does not record laundry-evidence exposure, evidence state, interaction, comprehension, or a stated laundry-related decision, so generic exits cannot be attributed to laundry uncertainty.

Baseline: laundry evidence displayed on the live deal-detail path is **0**, and the share of long-stay detail views with usable laundry evidence is **0%**. Laundry-specific evidence use and decision uncertainty are **not measured**. Existing back and handoff events are contextual guardrails, not proof of user need or confidence.

## Classification Hypothesis To Validate

The smallest shippable classification is a provider-backed set of laundry modes plus an explicit evidence state. It must allow more than one supported mode at the same property rather than forcing a misleading single label:

- **Self-service on property:** the structured source explicitly reports guest-operated laundry facilities at the property.
- **Hotel laundry service:** the structured source explicitly reports a property-managed laundry or dry-cleaning service. Show `paid` or “fee may apply” only when the source supports that status; never infer that service is free.
- **Nearby option:** the provider explicitly identifies an off-property laundry option or structured nearby-laundry relationship. It must be labeled off property and must not imply hotel operation, endorsement, distance, or availability unless those facts are returned.
- **Explicitly unavailable:** the source expressly says a particular mode is unavailable. Absence of a mode must not be converted to this state.
- **Unknown:** the provider did not return laundry evidence, returned an unrecognized generic “laundry” label, or supplied conflicting/insufficient evidence. Unknown is a useful, honest outcome and must lead to verification rather than a positive or negative claim.

Each positive classification needs source/provenance and property-versus-nearby scope. Provider-supported qualifiers such as guest access restrictions or operating schedule may be preserved when returned, but this ticket does not authorize estimated price, estimated turnaround, inferred hours, machine counts, detergent availability, booking capacity, or service quality.

UXR must validate whether providers can support these distinctions. If the available signal is only a generic `laundry` boolean, the ship recommendation should be **defer**, because that boolean cannot answer the problem defined by this ticket.

## Measurement Plan

### Supply gate

Before recommending UI work, measure provider coverage across normalized hotel offers and separately for the five-or-more-night cohort:

- share with at least one supported laundry mode;
- share classified as self-service, hotel service, nearby, explicitly unavailable, unknown, or conflicting;
- share with enough scope and provenance to render safely; and
- overlap between modes, because a property can support both self-service and hotel service.

Do not count missing data as unavailable, a generic laundry label as self-service, or a paid-service label as evidence of a known price.

### Use of laundry evidence

Among eligible hotel-detail exposures, record the laundry classification shown, whether the laundry block was reached, whether supporting details were opened, and the next stated decision (`keep`, `rule_out`, or `verify`). Segment by stay length and evidence state. Section reach and detail opens indicate use, not confidence or success.

### Reduced long-stay decision uncertainty

The primary validation is task comprehension in five-or-more-night hotel scenarios. After seeing the evidence, a first-time traveler should be able to state correctly:

1. which laundry mode or modes are reported;
2. whether the option is on property, hotel-managed, or nearby;
3. whether a fee is reported, possible, or unknown; and
4. whether they can act on the evidence or still need to verify.

Measure the change from before to after exposure in the share answering “I cannot tell what laundry option this hotel supports,” alongside factual accuracy and the `keep` / `rule_out` / `verify` decision. A confident but incorrect answer is a failure; `verify` is the correct outcome for unknown or ambiguous evidence and must not be treated as abandonment.

Use existing back-to-results and provider-handoff rates only as guardrails, segmented by classification and stay length. Do not label an exit as laundry-related unless the traveler explicitly states that reason in research or an intentional feedback prompt.

## Constraints

1. **Structured, provider-supported evidence only.** Every signal must pass through `lib/providers`, retain provenance and scope, and distinguish explicit unavailability from not returned or conflicting data. Do not infer a laundry mode from hotel name, brand, description text, reviews, room type, property category, or common practice.
2. **No price or service-performance estimates.** Do not estimate, calculate, or crowdsource prices, turnaround times, hours, capacity, or machine availability. A provider-supported `paid` state may be shown without an amount; any future returned amount must use `{ priceCents: number; currency: string }`. The classification is availability evidence, not a reservation or guarantee.
3. **Protect the decision hierarchy and access.** The evidence belongs in deal-detail evaluation before provider handoff and must remain usable at 375px and 1280px without displacing price, Deal Score, or the primary CTA. Unknown, nearby, and paid meanings must be conveyed in text, not by color or icon alone, and any disclosure must support keyboard and assistive technology.

## Scope Boundary

This discovery owns a ship-or-defer decision for classifying provider-supported laundry availability on hotel deal detail.

Out of scope:

- laundry filters, search sorting, ranking, recommendation logic, or Deal Score inputs;
- booking or requesting laundry, contacting the hotel, or confirming selected-stay capacity;
- adding a laundry marketplace, map search, directions, or affiliate links to nearby laundries;
- estimating or comparing prices, turnaround, machine counts, detergent, hours, distance, or service quality;
- extracting claims from free-form descriptions or reviews when no structured/provider-supported signal exists;
- adding a hotel supplier solely to obtain laundry data; and
- changing adjacent hotel-fit, amenity, price, or provider-handoff work.

## Success Statement

This is solved when a first-time traveler evaluating a stay of five or more nights can use a shippable, provider-backed classification on hotel deal detail to distinguish self-service facilities, hotel laundry service, a nearby option, explicit unavailability, and unknown evidence—and make a correct `keep`, `rule out`, or `verify` decision without mistaking missing information for availability or a guarantee.

## Handoff Requirements For UXR

`UXR-HOTEL-LAUNDRY-AVAILABILITY-01` must read this report and produce `docs/pipeline/hotel-laundry-availability/02-research.md`. Research must:

1. Audit the live deal-detail data path, `HotelAmenityEvidence`, provider normalization/cache behavior, `deals` persistence, and hotel decision analytics to identify the smallest compatible contract and exact delivery gaps.
2. Establish provider-support ground truth for each candidate mode and state. Quantify complete, partial, conflicting, explicit-unavailable, and not-returned coverage; reject free-form inference and generic laundry booleans that cannot distinguish modes.
3. Compare one or two established hotel-booking patterns at the interaction level for laundry terminology, on-property versus off-property scope, paid/unknown treatment, and placement before handoff—not visual style.
4. Test long-stay scenarios for correct classification, factual comprehension, uncertainty change, and `keep` / `rule_out` / `verify` decisions. Validate the five-night analysis threshold or recommend a better measurement threshold without turning it into a visibility rule.
5. Produce 3–5 testable design directives only if evidence coverage and comprehension support a safe implementation. Otherwise recommend defer, name the failed gate, and state what provider or user evidence would reopen the decision.

## Handoff

Create `UXR-HOTEL-LAUNDRY-AVAILABILITY-01` with this report path and the user pain point embedded. The research brief must preserve the structured-evidence boundary, multi-mode classification, explicit unknown state, no price/turnaround estimates, and ship-or-defer gate.
