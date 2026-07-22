# UXD-HOTEL-SMOKING-POLICY-01: Hotel Smoking-Policy Fit Discovery

Date: 2026-07-22  
Stage: UX Discovery  
Priority: P1  
Feature slug: `hotel-smoking-policy`

## User Pain Point

A traveller cannot confidently tell whether a hotel protects them from smoke exposure, offers a smoking room, or restricts smoking to particular areas before choosing it, because expaify carries no smoking-policy evidence and the provider handoff may reveal materially different room and common-area rules only after selection.

## Who Is Affected And Where

This affects two needs that must not be collapsed into one “smoking” flag:

- travellers who need to avoid smoke exposure, including families and people with respiratory or sensory sensitivities, and therefore need to distinguish the selected room, indoor common areas, designated areas, and an explicitly property-wide policy;
- travellers seeking a smoking room, who need to know whether a property generally offers such rooms and, separately, whether one is available for their selected dates and room choice.

The affected decision path is:

1. **Search results and filters:** a traveller scans or narrows properties by smoking-policy fit. No smoking-policy signal or filter exists today.
2. **Hotel detail:** the expanded result must carry the evidence needed to interpret the policy's scope. `app/components/HotelCard.tsx` currently covers quality, location, price, Deal Score, and access/room-request evidence, but not smoking rules.
3. **expaify hotel review:** the selected result is reviewed before handoff, but `app/book/BookingFlow.tsx` carries no smoking-policy context.
4. **Provider room selection:** the traveller may first encounter room-specific smoking status or common-area restrictions after leaving expaify. Because expaify does not currently expose room-level hotel inventory, a property statement that it “offers smoking rooms” cannot establish availability for this stay.
5. **Reversal:** after learning the actual policy, the traveller may return, remove the property from consideration, or change the search. That behavior is not currently attributable to smoking policy without an explicit reason signal.

## Current Evidence And Baseline

The gap is observable in the current product contract:

- `HotelOffer` in `lib/types.ts` has no smoking-policy field. It cannot distinguish room policy from common-area policy, property-wide wording from designated-area wording, or explicit policy from missing data.
- `HotelAmenityEvidence` has reusable status, scope, source, and freshness concepts, but the implemented normalizer in `lib/providers/hotelAmenityEvidence.ts` recognizes only access and room-request facts. It has no smoking facts or policy language.
- `HotelLookCacheEntry` in `lib/providers/hotellook.ts` has no dedicated smoking-policy or room-inventory field. Its current normalized evidence cannot support a smoking-policy claim.
- `HotelCard` has no smoking-policy summary, disclosure, or unavailable state. The search page has no hotel-policy filter.
- `BookingFlow` records hotel handoff view/click calls, but `lib/analytics.ts` only logs in development. There is no production filter funnel, policy-detail event, provider-return event, or explicit reversal reason.

The defensible baseline is therefore **0% of normalized hotel offers with representable smoking-policy evidence** and **no measurable smoking-filter completion or policy-attributed reversal rate**. This does not mean every property's policy is unknown in reality; it means expaify cannot currently carry or prove it.

## Shippable Policy Taxonomy

The downstream contract needs two independent policy dimensions plus an evidence state. A single `smoking: true/false` value is not shippable.

### 1. Room policy

| Normalized state | Meaning expaify may communicate | Required scope |
| --- | --- | --- |
| `all_rooms_non_smoking` | The provider explicitly states that all guest rooms are non-smoking | Property room inventory |
| `smoking_rooms_offered` | The provider states that the property has or may offer smoking rooms; availability for this stay is not implied | Property capability |
| `selected_room_non_smoking` | The selected room/rate is explicitly non-smoking | Selected room/rate and searched dates |
| `selected_room_smoking` | The selected room/rate explicitly permits smoking | Selected room/rate and searched dates |
| `ambiguous` | Provider wording mentions rooms or smoking but its meaning or scope cannot be normalized safely | Preserve verbatim provider wording |
| `not_provided` | The provider returned no usable room-policy evidence | Explicit absence state |

`smoking_rooms_offered` and `selected_room_smoking` are deliberately separate. The former is a property capability; only the latter supports “smoking room available for this stay.”

### 2. Property and common-area policy

| Normalized state | Meaning expaify may communicate | Required scope |
| --- | --- | --- |
| `smoke_free_property` | The provider explicitly applies a smoke-free rule to the entire property | Entire property, not merely rooms or indoor areas |
| `indoor_common_areas_smoke_free` | The provider explicitly prohibits smoking in indoor shared areas | Indoor common areas |
| `designated_smoking_areas` | Smoking is restricted to provider-described designated areas | Named or explicitly designated areas |
| `smoking_permitted_in_stated_areas` | The provider permits smoking in specific stated areas that do not fit the designated-area claim | Preserve the stated areas |
| `ambiguous` | Policy wording exists, but its geographic scope cannot be resolved | Preserve verbatim provider wording |
| `not_provided` | The provider returned no usable property/common-area evidence | Explicit absence state |

These states may coexist where the supplier explicitly supports them—for example, non-smoking rooms plus an outdoor designated smoking area. That combination must never be relabelled “smoke-free property.” The taxonomy describes stated policy, not actual smoke conditions, guest compliance, ventilation, cleaning, or enforcement.

### 3. Evidence state

Every normalized statement must be one of:

- `confirmed`: supplier-attributed wording supports the normalized state and its scope;
- `ambiguous`: wording exists but scope or meaning is unsafe to normalize; retain the provider's wording;
- `conflicting`: current supplier statements disagree across records or scopes and the conflict cannot be resolved without inference;
- `not_provided`: no usable statement was returned;
- `unavailable`: the evidence could not be checked because the provider path failed.

`ambiguous`, `conflicting`, `not_provided`, and `unavailable` are all non-matches for a positive smoking-policy claim, but they are not evidence of prohibition or permission.

## Evidence Threshold

A policy may be presented or counted as a **confirmed filter match** only when all of the following are present:

1. **Explicit supplier assertion:** the value comes through `lib/providers` from provider-supplied policy data, not from hotel name, photos, reviews, property type, generic amenity inference, or deeplink text.
2. **Resolvable scope:** the evidence identifies the applicable scope—entire property, indoor common area, designated area, property room capability, or selected room/rate. If wording such as “non-smoking hotel” does not have a supplier-defined scope, preserve it as ambiguous rather than expanding its meaning.
3. **Traceable evidence:** the normalized statement retains provider attribution, source wording when any nuance would be lost, and the observed/fetched time. Selected-room claims additionally require the searched dates and selected room/rate identity.
4. **No unresolved contradiction:** conflicting statements cannot be promoted to a match. Both must remain reviewable until a provider supplies authoritative scoped evidence.

The threshold has two practical consequences for the current product:

- A **smoke-free property** match requires an explicit entire-property assertion. “Non-smoking rooms,” “indoor areas are smoke-free,” or “designated smoking area” does not meet it.
- A **smoking room available for this stay** match requires dated selected-room/rate evidence. The current property-price hotel feed cannot meet that threshold; it may at most support the weaker, accurately labelled `smoking_rooms_offered` state if a future provider explicitly supplies it.

Downstream research must validate supplier coverage before authorizing a filter. Unknown or ambiguous inventory must never be silently represented as a match or an exclusion.

## Measurement Plan

### Policy evidence availability

Measure the share of displayed hotel offers in each evidence state, separately for room policy and property/common-area policy. Within `confirmed`, report coverage by normalized state and provider. Do not combine `ambiguous` or `not_provided` with confirmed evidence.

### Filter-use completion

For each policy intent, measure `filter_opened` → `policy_option_selected` → `filtered_results_rendered`, followed by either `hotel_detail_opened` or `hotel_review_opened`. Report completion separately for:

- explicit smoke-free-property intent;
- non-smoking-room intent;
- smoking-room intent;
- searches where all, some, or none of the inventory meets the evidence threshold.

A filter interaction is not successful merely because results render. The qualifying denominator and displayed result count must expose how much inventory was unknown, and a usability/comprehension check must confirm that users understand the difference between a confirmed match and policy not provided.

### Reversals after policy detail

Measure policy-detail views followed by closing the detail, choosing a different hotel, changing/clearing the filter, or returning after provider handoff. These are reversal candidates, not proof of policy mismatch. Attribute a reversal to smoking policy only when the provider returns a structured policy failure or the traveller explicitly selects a smoking-policy reason. Segment by the policy evidence and scope shown before selection.

### Primary validation signal

In a first-use comprehension task, measure the share of travellers who correctly classify a property for a stated need as **confirmed fit**, **confirmed non-fit**, or **cannot confirm from available evidence**, while also identifying whether the evidence applies to the room, common areas, designated areas, or the entire property. Treat “cannot confirm” as the correct safe answer for ambiguous, conflicting, missing, or unavailable evidence.

## Constraints

1. **Preserve meaning and provenance.** All policy evidence must flow through `lib/providers`; preserve supplier wording whenever scope is ambiguous or normalization would discard a restriction. Missing or conflicting evidence must remain explicit and must not be converted into permission, prohibition, or a filter match.
2. **Separate scopes and certainty.** Room policy, selected-room availability, indoor common-area rules, designated areas, and an entire-property rule are distinct. Do not infer one from another, and do not infer enforcement, air quality, compliance, cleaning history, or legal guarantees from a stated policy.
3. **Protect the existing decision flow.** Any future policy signal must remain understandable without color at 375px and 1280px, preserve price/Deal Score/location hierarchy, retain integer-minor-unit money and affiliate handoff contracts, and avoid claiming selected-stay availability until room/rate evidence exists.

## Scope Boundary

This ticket establishes the smoking-policy decision taxonomy, evidence threshold, and measurement definitions. It does not authorize a new hotel provider, scraping, filter or UI implementation, room booking inside expaify, policy enforcement claims, air-quality guarantees, or changes to Deal Score and ranking.

Detailed room availability remains a provider/room-selection capability. If the next stages cannot verify adequate supplier coverage, the shippable repair is an honest evidence-absent state and preserved handoff warning—not a populated filter based on inferred data.

## Success Statement

This is solved when a first-time traveller can identify, before choosing a hotel, whether provider evidence confirms a smoke-free property, a non-smoking or smoking selected room, or scoped smoking restrictions—and can recognize when the evidence is insufficient—without confusing room policy with common-area policy or assuming expaify has verified enforcement.

## UXR Handoff Requirements

`UXR-HOTEL-SMOKING-POLICY-01` must read this report and produce `docs/pipeline/hotel-smoking-policy/02-research.md`. It must:

1. Audit the actual hotel provider payload, normalization, cache behavior, search stream, `HotelCard`, booking review context, and analytics path for every taxonomy field and evidence requirement above.
2. Validate provider vocabulary and coverage for property-wide rules, indoor common areas, designated areas, all-room policy, property-level smoking-room capability, and dated selected-room status. Record unsupported states as unsupported; do not synthesize them.
3. Compare one or two established hotel-search interaction patterns at the interaction level across filters, result summaries, policy detail, and room selection, with special attention to unknown evidence and scope changes.
4. Test whether filter use is viable at observed coverage levels and define how unknown/ambiguous inventory remains visible and understandable rather than silently excluded.
5. Produce 3–5 specific, testable directives for UXDES, including exact scope hierarchy, provider-wording rules, empty/error/conflict states, 375px/1280px behavior, and measurement event boundaries.

## Handoff

Create `UXR-HOTEL-SMOKING-POLICY-01` with this report path and the problem statement embedded. The research ticket must preserve the room/common-area separation, the evidence threshold, and the prohibition on enforcement inference.
