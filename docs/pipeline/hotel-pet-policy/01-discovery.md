# UXD-HOTEL-PET-POLICY-01: Hotel Pet-Policy Fit Discovery

Date: 2026-07-31
Stage: UX Discovery
Priority: P1
Feature slug: `hotel-pet-policy`

## User pain point

A traveler bringing a pet cannot tell from expaify whether a hotel accepts their animal for the selected stay or what mandatory pet charges, deposits, and limits apply, so an apparently eligible deal can become unusable only after they open the hotel or leave for a booking provider.

## Who is affected and where the decision breaks

This affects travelers for whom a pet is a non-negotiable member of the party, especially:

- dog, cat, and other-animal owners subject to animal-type exclusions;
- travelers with large or multiple animals subject to weight, size, breed, or count limits;
- price-sensitive travelers for whom a nightly or per-stay charge, per-pet multiplier, or deposit changes the affordability of the stay; and
- travelers who need advance property approval and cannot safely treat “pets allowed” as confirmation.

The relevant decision is not “does this hotel advertise itself as pet friendly?” It is “does the available evidence support this pet and this stay, and what cost or confirmation remains?” That decision currently breaks across the active result-to-provider path:

1. **Result scan — `/deals`.** `app/deals/DealFeed.tsx` renders `app/components/ui/DealCard.tsx`. The deal shape carries price, discount, dates, hotel class, and links, but no pet profile, policy evidence, fit state, fee, deposit, or restriction. A traveler cannot keep, rule out, or mark a property for verification from the result.
2. **Saved-hotel detail — `/deals/[dealId]`.** The page’s `Hotel fit` section shows hotel class, missing guest-rating evidence, and quiet-stay evidence. It contains no pet-policy disclosure. The next primary decision is `Check rooms with provider`, so the first possible policy discovery occurs outside expaify.
3. **Provider handoff.** The outbound choices are affiliate links. No pet-policy outcome or unresolved pet question is repeated before the traveler opens a provider option, and no property contact or policy-verification workflow exists in expaify.

A separate comparison component, `app/components/HotelCard.tsx`, contains an optional `petPolicy` presentation path. When supplied, it can show a scan outcome and expanded `Pet policy for your stay` facts. This is not an end-to-end capability:

- repository tracing finds no production page that mounts `HotelCard`;
- `HotelPetPolicyEvidence` and `PetFitEvaluation` live in the UI component file rather than the normalized provider contract;
- no production caller supplies `petPolicy`;
- no traveler pet-profile input or evaluation service exists; and
- the presentation contract models a pet fee but not a distinct deposit amount, refundability, or return condition.

The existing component is therefore useful prior design evidence, not proof that a traveler can complete the task.

## Current evidence and normalized-data sufficiency

The current normalized provider data is **not sufficient** to identify an eligible stay.

- `HotelOffer` in `lib/types.ts` has no pet-policy field. It cannot carry permission, animal types, limits, fee basis, deposit terms, evidence state, scope, provenance, or freshness.
- `lib/providers/hotellook.ts` maps the live response and cached replay into `HotelOffer` without pet data. A successful hotel result currently means only that inventory was returned; it says nothing about pet-policy availability.
- `app/api/search/route.ts` can distinguish hotel inventory states, but cannot distinguish “policy confirms fit,” “policy confirms mismatch,” “approval required,” “policy not returned,” or “policy lookup failed.”
- The current UI-only policy shape can represent `allowed`, `prohibited`, `by_arrangement`, fee amount/basis, animal types, count, weight, restrictions, scope, source, freshness, conflict, and derived fit. It cannot by itself establish supplier coverage, survive provider/cache normalization, capture a separate deposit, or compute fit without a stated pet profile.

The structural baseline is consequently:

- **normalized policy coverage:** 0% of active hotel offers;
- **production result-card policy coverage:** 0%;
- **production detail policy coverage:** 0%; and
- **validated on-platform eligible-stay identification:** 0%, because the active flow exposes neither evidence nor a supported unknown state.

Missing evidence must not be counted as prohibition, permission, no charge, no deposit, or no limit. Likewise, a generic property-level `pets allowed` claim is insufficient to certify a specific animal, room/rate, or stay.

## Minimum data model to validate in research

UXR should validate whether the following is the smallest provider-neutral model that supports a safe decision. Each family must allow an explicit `not_returned`, `unknown`, malformed, and conflicting state where applicable.

1. **Traveler pet profile:** animal type, pet count, and weight/size when known. Breed should remain optional and collected only if supplier evidence makes it decision-relevant. Service-animal status and legal eligibility are not part of this general pet flow.
2. **Acceptance:** allowed, prohibited, by arrangement, or unknown, plus included and excluded animal types.
3. **Eligibility limits:** maximum pet count, weight/size limit with unit, and only supplier-reported material restrictions such as breed, room/area, advance notice, or unattended-animal rules.
4. **Pet charge:** free, mandatory, may apply, or unknown; known money as `{ priceCents, currency }`; and an explicit basis such as per pet per night, per pet per stay, per night, or per stay.
5. **Deposit:** separate from the pet charge, with known money when supplied, required/possible/unknown state, refundability or return condition when supplied, and a basis if the supplier applies it per pet or per stay. A deposit must never be added to the nightly rate or described as a fee merely because both are payable.
6. **Evidence boundary:** property/room/rate/selected-stay scope, source label, observed time or freshness when available, schema revision, and conflict preservation. Only selected-stay evidence that resolves every material dimension may support a positive match.

The decision output to validate is intentionally three-way:

- **eligible** — supplier evidence resolves the stated animal type, count, applicable limit, material restrictions, selected-stay scope, and cost state;
- **ineligible** — supplier evidence explicitly establishes a mismatch; or
- **needs confirmation** — any material dimension is absent, conditional, stale, malformed, conflicting, or scoped more broadly than the selected stay.

An honest `needs confirmation` is a successful safe outcome. It must not be hidden from results and must not be promoted to eligible.

## Minimum disclosure hypothesis

The smallest disclosure worth testing is:

- a concise result-level outcome for the stated pet, with the first decision-changing reason and charge basis when known;
- a detail-level breakdown of acceptance, animal types, charge, deposit, count/size limits, other restrictions, scope, source, freshness, and unresolved items; and
- a repeated confirmation boundary before an outbound provider option whenever eligibility or cost is unresolved.

The scan signal should help a traveler keep, rule out, or verify a property without opening every hotel. Detail should explain the evidence behind that signal; it should not introduce a contradictory outcome. This ticket does not authorize a filter until provider coverage is measured and unknown inventory can remain visible rather than being silently excluded.

## Measurable signals

The primary success measure is **eligible-stay identification accuracy**: in a scenario-based comprehension task with a stated pet and representative policy states, the share of first-time travelers who correctly answer `eligible`, `ineligible`, or `needs confirmation` from the result signal, without opening the detail for clearly supported outcomes. A correct unknown/confirmation answer counts as success.

Supporting measures are:

- **Unsupported-option open rate:** the share of result opens or provider handoffs involving a policy that explicitly conflicts with the stated pet. The desired direction is down; confirmed-ineligible options should reach 0 provider handoffs in the validation task unless the participant deliberately chooses to verify changed policy.
- **Fee and deposit comprehension:** the share who can separately state whether a charge and deposit apply, their known amount and basis, and what remains unknown. Confusing a nightly fee with a per-stay fee, or a refundable deposit with a fee, is a failure.
- **Unknown-state comprehension:** the share who correctly understand that `not returned`, `by arrangement`, property-only, stale, or conflicting evidence is neither permission nor prohibition.
- **Evidence coverage:** by provider, the share of offers with enough normalized evidence to resolve acceptance, types, limits, charges, deposits, scope, and provenance. Report full, partial, not-returned, malformed, and conflicting coverage separately; do not collapse them into one availability rate.
- **Avoidable property mismatch:** in moderated validation first, the share of chosen properties later revealed by the supplied policy fixture to reject the stated pet or impose a decision-changing undisclosed cost. Production measurement would require a provider/booking outcome or explicit traveler report that does not exist today.

Generic exits, back navigation, detail opens, and session abandonment are diagnostic only. They must not be labelled “pet-policy related” unless the traveler explicitly selects that reason or activates a policy-specific confirmation action.

## Constraints

1. **Provider-backed data integrity.** Every policy fact must enter through `lib/providers`, survive live and cached normalization, preserve source and scope, and use canonical integer money. Components must not parse supplier prose, call vendors, infer from photos/stars/property type, merge contradictory sources into a permissive policy, or treat absence as a claim.
2. **No false certainty or cost blending.** Property-level permission, by-arrangement wording, missing limits, unresolved room/rate applicability, stale evidence, and conflicts cannot yield an eligible stay. Pet charges and deposits remain separate from each other, the displayed nightly rate, and Deal Score unless separately approved total-price work establishes a correct calculation.
3. **Repair scope and usable hierarchy.** Keep scope to concise eligibility, restriction, fee, deposit, and confirmation signals across result, detail, and handoff. Do not build pet services, veterinary/boarding content, property messaging, legal/service-animal advice, ranking changes, or a new supplier integration in this discovery. Any future UI must preserve price, Deal Score, location, and provider options; remain readable at 375px and 1280px; use text rather than color/icon alone; and support keyboard and assistive technology.

## Success statement

This is solved when a first-time traveler can identify an eligible hotel for their stated pet—or correctly identify that confirmation is still required—from the result card, understand any supplier-reported charge, deposit, and material limit before provider handoff, and avoid opening an option that the available evidence already shows is unsupported.

## Required UXR handoff

`UXR-HOTEL-PET-POLICY-01` must read this report and refresh the existing research artifact against the current branch rather than assuming the dormant presentation component is live. It must:

1. audit both active flows (`DealCard` → saved detail → affiliate provider) and the unmounted `HotelCard` comparison prototype;
2. verify real supplier payload coverage before declaring any populated policy state shippable;
3. test the minimum profile, evidence, fee-versus-deposit, scope, and three-way evaluation model above;
4. compare one or two established hotel-search interaction patterns at the pattern level, including how they disclose animal-type limits, fee basis, deposits, and unknown policies;
5. define the usability protocol and event boundaries for eligible-stay accuracy, unsupported-option opens, cost comprehension, unknown-state comprehension, and mismatch reporting; and
6. produce 3–5 exact, testable directives for the production result, detail, and pre-handoff hierarchy, including loading, not-returned, error, stale, malformed, conflict, mobile, desktop, keyboard, and screen-reader states.

The research must explicitly decide whether the current UI-local policy contract can be promoted and extended or should be replaced by a normalized domain model. It must not treat the pre-existing `02-research.md` or `03-design.md` as evidence that the current product flow is implemented.

## Out-of-scope findings

- `HotelCard` is not mounted in a production page; wiring or replacing that surface is a separate implementation/integration decision.
- The existing UI-only pet model has no distinct deposit representation. That gap is relevant to this discovery but no type or UI change is authorized at UXD.
- Current provider supply supports no positive or negative pet-policy classification. A populated-state UI can only be a research fixture until a verified supplier contract exists.
- Existing downstream `02-research.md` and `03-design.md` files predate this board run. They were not edited; UXR must reconcile them with this refreshed discovery and current code.

## Handoff

Create `UXR-HOTEL-PET-POLICY-01` with this report path and the one-sentence problem statement. The ticket must preserve explicit unknown states, separate pet charges from deposits, and treat provider coverage plus production-surface reachability as release gates.
