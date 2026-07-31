# UXD-HOTEL-GUEST-IDENTITY-REQUIREMENTS-01: Hotel Guest Identity Requirements

**Ticket:** UXD-HOTEL-GUEST-IDENTITY-REQUIREMENTS-01  
**Stage:** UX Discovery  
**Priority:** P2  
**Date:** 2026-07-31  
**Feature slug:** `hotel-guest-identity-requirements`

## 1. User pain point

**A traveler can choose a hotel and leave expaify without knowing whether the lead guest, the payment-card holder, or every occupant must present matching identification at check-in, so a rule discovered only during partner booking or at the property can force a payer change, booking abandonment, or refusal of the stay.**

This is a role-and-evidence clarity problem, not a request to collect identity data. “ID required” is not enough to act on when the traveler is booking for someone else, using another person’s card, paying with a company or virtual card, or traveling with occupants whose documents may also be checked.

## 2. Who is affected and where

The highest-risk travelers are:

- a booker who will not be the lead guest;
- a lead guest whose name differs from the payment-card holder’s name;
- a traveler using a company, parent, virtual, prepaid, debit, or other non-matching payment instrument;
- a group or family for whom the property may require identification from more than the registering guest.

The affected path is `hotel discovery/results → hotel details → expaify handoff review → external partner booking → property check-in`.

Advance notice has two decision deadlines:

1. **Before the provider handoff:** the traveler must be able to recognize whether a reported rule applies to the lead guest, cardholder, all occupants, or an unspecified party—and must see an explicit unknown when the provider did not establish that role.
2. **Before payment on the partner site:** the traveler must be able to change the guest or payer, prepare the required documents, or abandon an ineligible booking before money is at risk. Expaify cannot control this external step, so its last guaranteed disclosure point is the handoff review.

The results/detail surface may preview a confirmed material restriction to prevent wasted comparison work, but the full actionable or unknown disclosure must remain visible immediately before the traveler leaves expaify. Repeating it at handoff is continuity, not a second policy system.

## 3. Current-state evidence

The repository already acknowledges check-in identity risk, but cannot answer the ticket’s person-specific question:

- `HotelAdmissionPolicyEvidence` has one property-scoped `checkin_identity` statement family, stored as bounded verbatim supplier prose; the contract explicitly says not to parse it into flags (`lib/types.ts:542-584`). It does not distinguish lead guest, cardholder, or all occupants.
- The presentation reduces a reported identity rule to “the registering guest” plus the original statements, and its collapsed signal is the generic “Check-in: ID rules” (`lib/hotels/admissionPolicy.ts:129-168`; `app/components/HotelAdmissionPolicy.tsx:228-267`). A user must interpret the supplier prose to determine who is affected.
- Unknown handling exists at the whole-family level: “has not told us this property’s check-in age, ID, or occupancy rules” (`app/components/HotelAdmissionPolicy.tsx:97-103`). It does not say whether the unknown is the required document, the card-name match, or the people covered.
- The handoff separately defines the lead guest as the person checking in, but only in a general name/email/phone readiness block (`app/book/BookingFlow.tsx:1203-1219`). It is not connected to the check-in identity/payment evidence, leaving “lead guest,” “registering guest,” “cardholder,” and “occupant” as disconnected concepts.
- The active Hotellook adapter declares every admission-policy capability unsupported and supplies no admission evidence (`lib/providers/hotellook.ts:398-411`, `532-542`). Therefore the production provider can reliably normalize **none** of the requested role-specific requirements today.

The existing model is the right trust boundary for unstructured policies: preserve supplier wording and provenance rather than manufacture booleans. The unresolved gap is whether any future provider exposes stable, explicit semantics for the affected person and requirement type.

## 4. Measurable signals

### 4.1 Recognition of requirements — primary comprehension measure

In a moderated or unmoderated task, show a traveler the hotel detail and handoff review, then ask before provider continuation:

1. Who must show identification: lead/registering guest, cardholder, all occupants, or not established?
2. Must the cardholder’s name match the checking-in guest’s name: yes, no, conditional, conflicting, or not established?
3. What action should the traveler take before paying?

Score **correct recognition only when the answer matches explicit evidence**. “Not established by the provider” is a correct answer. A guess based on generic hotel expectations is incorrect even when it happens to match the property rule.

Baseline from the current contract: no role-specific answer can be produced without interpreting supplier prose, and the configured adapter returns no admission evidence. UXR should establish a participant baseline and segment results by self-booking, booking for someone else, and non-matching cardholder scenarios.

### 4.2 Resulting booking abandonment — behavioral outcome

Measure a privacy-safe funnel by disclosure state and scenario:

`identity disclosure viewed → provider handoff started → returned to expaify → identity/cardholder reason selected`

Report both:

- **pre-handoff informed exit rate:** traveler does not continue after recognizing a mismatch;
- **post-handoff identity-surprise rate:** traveler returns from the provider and selects an identity/cardholder requirement as the reason.

Do not optimize raw handoff conversion alone. A higher pre-handoff exit can be a successful prevention of an unusable or risky booking; the target is higher correct recognition and lower post-handoff surprise.

Current instrumentation cannot establish that baseline reliably:

- `hotel_handoff_returned` emits `policyState` and `obligationTypes`, but those properties are absent from the server allowlist, so the payload is rejected (`app/book/BookingFlow.tsx:940-950`; `app/api/analytics/route.ts:37-40`).
- `hotel_handoff_continue_clicked` likewise emits four properties not accepted by its allowlist (`app/book/BookingFlow.tsx:969-976`; `app/api/analytics/route.ts:37-39`).
- `hotel_handoff_return_reason_selected` is emitted but is not an accepted server event at all (`app/book/BookingFlow.tsx:994-1003`; `app/api/analytics/route.ts:14-50`).
- Admission analytics record only the broad family and evidence state, not recognition, affected role, or an identity-related return reason (`app/components/hotelAdmissionPolicyAnalytics.ts:40-84`).

Fixing analytics belongs to a later DEV stage after UXR defines the minimum event taxonomy; this UXD ticket does not change code.

## 5. Provider-normalization hypothesis for UXR

Provider support must be evaluated at the selected property/rate and locale actually handed off. The initial reliability boundary is:

| Provider evidence | Safe treatment | Unsafe treatment |
|---|---|---|
| Explicit structured field naming the affected role and requirement | Normalize the exact role/requirement with supplier, scope, and freshness | Generalize it to other roles, rates, rooms, or properties |
| Attributed supplier policy prose | Preserve as a bounded verbatim statement; role remains `unspecified` unless the text/schema states it explicitly | Infer `lead_guest`, `cardholder`, `all_occupants`, document type, or name-match from keywords |
| Explicit supplier negative from a declared capability | Show “no rule reported” only for that supported dimension and scope | Treat missing data or an unsupported capability as “not required” |
| Missing, stale, malformed, or conflicting evidence | Show a dimension-specific unknown/conflict and direct verification before payment | Collapse to silence, reassurance, or a generic “ID rules” claim |

UXR must determine which real provider contracts, if any, can reliably populate these minimum dimensions: `affectedParty`, `identityDocument`, and `paymentNameMatch`. If none can, the evidence-backed release is a concise disclosure of supplier wording plus explicit role-specific unknowns—not inferred normalization.

## 6. Three constraints

1. **Data integrity:** Never infer identity type, affected person, card-name match, or absence of a rule from free text, market norms, property class, or missing data. Every positive or negative claim needs provider-declared capability, selected-offer/property scope, provenance, and freshness; otherwise show unknown or conflict.
2. **Trust, privacy, and scope:** Provide advance guidance only. Do not collect, store, transmit, or photograph names, card data, passports, or other identity documents. Do not alter booking/payment ownership, external provider calls, or affiliate handoff behavior.
3. **Clarity without adjacent-policy expansion:** Keep the disclosure usable at 375px and 1280px and distinguish lead guest, cardholder, and all occupants in plain language. Exclude accessibility, age policy, check-in time/logistics, deposits/holds, cancellation, and general room occupancy fit; reuse rather than duplicate the existing admission-policy surface.

## 7. Disclosure hypothesis to test

Test one compact, evidence-led pattern across detail and handoff:

- **Confirmed/conditional:** lead with the affected person and required action, then show attributed supplier wording.
- **Unknown:** say exactly what is not established—for example, whether the lead guest, cardholder, or all occupants need ID—and instruct the traveler to verify before paying.
- **Conflicting:** identify the conflict without selecting a preferred rule and direct verification before payment.
- **No-rule-reported:** use only when a provider explicitly supports and returns a negative for that exact dimension; never derive it from omission.

The handoff version must answer “who needs what?” without requiring an accordion to be opened. The result/detail preview should appear only for an affirmative, decision-changing rule; generic unknowns should not become repeated card clutter.

## 8. Success statement

**This is solved when a first-time traveler booking for themselves or someone else can identify before provider handoff whether the lead guest, payment-card holder, or all occupants must present identification—or can correctly state that the provider has not established the requirement—without mistaking missing data for permission, and when identity-related informed exits and post-handoff abandonment can be measured without collecting personal or document data.**

Downstream validation targets:

- At least 90% of study participants correctly identify the affected party and action, including correct recognition of unknown/conflicting states.
- No participant interprets an unknown state as “no ID/cardholder rule.”
- The product can report disclosure exposure, handoff, return, and identity/cardholder reason rates by evidence state without names, card data, document details, or free-text analytics.
- Provider capability tests prove every normalized role/requirement claim; unsupported or ambiguous input degrades to unknown.

## 9. Handoff questions for UXR

1. Which current or plausible hotel provider schemas explicitly distinguish lead/registering guest, payment-card holder, and all occupants, at what scope and locale?
2. Can `identityDocument` and `paymentNameMatch` be normalized without parsing free prose, or must they remain attributed statements?
3. At results, detail, and handoff, what is the earliest point a confirmed rule changes a real traveler decision without causing generic policy noise?
4. Which concise unknown-state wording produces correct recognition without implying that expaify checked the property directly?
5. What event taxonomy and return-reason choices distinguish informed avoidance from harmful booking abandonment while remaining privacy-safe?

**Next ticket:** `UXR-HOTEL-GUEST-IDENTITY-REQUIREMENTS-01`  
**Required input:** `docs/pipeline/hotel-guest-identity-requirements/01-discovery.md`
