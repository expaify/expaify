# UXR-HOTEL-GUEST-IDENTITY-REQUIREMENTS-01: Hotel Guest Identity Requirements Research

Date: 2026-07-31  
Stage: UX Research  
Priority: P0  
Feature slug: `hotel-guest-identity-requirements`

## Decision summary

expaify cannot currently make a role-specific hotel identity claim. The active Hotellook adapter explicitly declares check-in identity evidence unsupported and returns no admission-policy evidence. The shared contract can preserve bounded supplier prose for one property-level `checkin_identity` family, but it cannot represent whether a rule applies to the lead guest, payment-card holder, all occupants, or an unspecified party. It also cannot separately represent an identity-document requirement and a payment-name-match rule.

The public Booking.com Demand API and Expedia Rapid contracts reinforce, rather than close, that gap. They distinguish booking roles in transaction inputs—guest, booker, and cardholder or billing contact—but expose property-specific presentation/check-in requirements inside localized important-information or instruction prose. In the reviewed public documentation, neither supplier publishes stable structured fields for `affectedParty`, `identityDocument`, or `paymentNameMatch`. These reference fields therefore cannot be treated as evidence that expaify receives a role-specific rule.

The repair-safe design direction is to extend the existing admission-policy evidence boundary, not to create a new identity collection flow. A structured role or requirement may be normalized only from an explicit supplier field whose documented semantics, scope, locale, and freshness match the selected property/rate. Otherwise expaify must show the attributed supplier statement and three dimension-specific unknowns. “No rule reported” remains valid only when an adapter declares exact-dimension negative capability; omission is unknown.

The current behavioral baseline is also unusable. Client code emits handoff properties and a return-reason event that the analytics API rejects. The smallest privacy-safe measurement repair records fixed enums for disclosure state, affected-party state, action, and return reason; it must not collect names, document types entered by a user, card data, free text, URLs, or stable cross-session identifiers.

## Research questions

1. What identity/payment semantics can the current and plausible provider boundaries normalize without interpreting prose?
2. How well does the current UI let a traveler recognize who is affected, what is required, and what remains unknown?
3. Which reference interaction patterns reduce late discovery without importing unsupported supplier claims?
4. What evidence and wording rules should govern confirmed, conditional, conflicting, explicit-negative, and missing states?
5. Which event taxonomy distinguishes informed avoidance from harmful post-handoff surprise without collecting identity or payment data?

## Method and evidence boundary

### Current-code evidence audited

- `docs/pipeline/hotel-guest-identity-requirements/01-discovery.md`
- `lib/types.ts`
- `lib/hotels/admissionPolicy.ts`
- `lib/providers/hotellook.ts` and its provider tests
- `lib/providers/bookingComRapidApi.ts`
- `lib/booking/config.ts` and `lib/booking/hotelContextStore.ts`
- `app/components/HotelAdmissionPolicy.tsx`
- `app/components/hotelAdmissionPolicyAnalytics.ts`
- `app/components/HotelCard.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/analytics/route.ts` and analytics tests

### External reference guidance checked

- [Booking.com: Retrieve accommodation details](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details) documents localized `description.important_information`, including a property statement that a booking card must be presented at check-in. It separately documents structured property policies and payment capabilities, but not a typed affected-party or card-name-match field.
- [Booking.com: Create your orders](https://developers.booking.com/demand/docs/orders-api/order-preview-create) separates `booker`, product `guests[]`, and payment `cardholder` inputs, and places final payment choices at order preview. These are transaction roles, not property-policy evidence.
- [Expedia Rapid: lodging launch requirements](https://developers.expediagroup.com/rapid/setup/launch-requirements/lodging-launch-reqs) requires `checkin.instructions` and `special_instructions` to be displayed on availability and booking pages. Its example puts photo-ID and card language in the instruction string while `min_age` is separately structured.
- [Expedia Rapid: Lodging API overview](https://developers.expediagroup.com/rapid/lodging) separates guest information from payment information in the booking request and treats room name changes as a post-booking operation.
- [Expedia Rapid: credit-card policies](https://developers.expediagroup.com/rapid/lodging/reference/credit-cards?locale=en_US) requires strict handling of cardholder data and advises against storing card data when in doubt.

External sources establish reference vocabularies and disclosure patterns. They do not prove that expaify's Hotellook redirect receives those fields, that either reference supplier is an approved expaify hotel provider, or that a statement applies to a selected rate. No supplier contract, payload sample, production analytics export, or participant study was supplied for this ticket.

## Current-code audit

### 1. The evidence contract is intentionally prose-first but too coarse for this decision

`HotelAdmissionPolicyEvidence` is property-scoped and contains four families. `checkin_identity` is a `HotelAdmissionStatementEvidence`; unlike minimum check-in age, it has no typed value. Supplier statements retain an ID, source label, bounded source text, and optional observation time, and the contract explicitly says never to parse that prose into flags, numbers, or headcounts (`lib/types.ts:542-584`).

That boundary protects against fabricated facts, but it cannot express:

- affected party: lead/registering guest, cardholder, all occupants, another explicitly named party, or unspecified;
- identity-document status: required, not required, conditional, conflicting, or not established;
- payment-name-match status: required, not required, conditional, conflicting, or not established;
- exact scope beyond the property; or
- which structured supplier field established each normalized dimension.

`HotelAdmissionPolicyCapability` is only a boolean per broad family. A provider capable of an explicit negative for “check-in identity” cannot declare independent capability for identity documents versus payment-name match (`lib/types.ts:587-593`). This makes a family-wide “no rule reported” too broad for the ticket unless both dimensions are contractually covered.

### 2. Normalization preserves missing data but invents “registering guest” in presentation

The normalizer correctly degrades invalid or unsupported input to `not_provided`, requires bounded statements for positive/conditional evidence, and permits an explicit clear state only when the adapter declares family capability (`lib/hotels/admissionPolicy.ts:25-31`, `:106-126`). Property ID and supplier mismatches also degrade to `not_provided` (`:222-250`). These are strong reusable trust controls.

The semantic problem appears after normalization. Any confirmed `checkin_identity` statement becomes: “This property requires the registering guest to meet the following identification and payment conditions at check-in” (`lib/hotels/admissionPolicy.ts:129-139`). The evidence object itself never established “registering guest.” A source statement about the cardholder or all occupants would therefore receive an unsupported role summary even though the original prose is shown below it.

The explicit-negative sentence also combines two dimensions: “no identification or payment-name condition” (`:150-154`). One supplier capability flag cannot safely support that compound claim unless its contract explicitly covers both dimensions. Unknown and conflict sentences likewise speak about “the registering guest” or combine identity and payment (`:157-168`).

### 3. The active provider has zero supported coverage

Hotellook is the hotel provider used by the search path. Live and cached offers set `admissionPolicyCapability` to `HOTEL_ADMISSION_POLICY_UNSUPPORTED` and do not attach `admissionPolicy`; all four capability values are false (`lib/providers/hotellook.ts:398-411`, `:532-542`; `lib/hotels/admissionPolicy.ts:25-31`).

`HotelProvider` has no method to retrieve admission or identity rules after search. Its only post-search check is document readiness for invoices, receipts, and booking confirmations (`lib/types.ts:685-694`). The invoice feature is unrelated to guest ID and must not be reused as identity evidence.

`lib/providers/bookingComRapidApi.ts` is a flight-search adapter despite its name. It provides no hotel or admission-policy fallback. Hostnames such as Booking.com and Expedia in the handoff UI are display labels only, not installed supplier contracts.

Current provider-normalizable coverage is therefore:

| Dimension | Hotellook live/cache | Safe current output |
| --- | --- | --- |
| Affected party | Unsupported | `unspecified` / not established |
| Identity document required | Unsupported | `not_established` |
| Payment-card name match | Unsupported | `not_established` |
| Explicit negative for any dimension | Unsupported | Never show “not required” |
| Supplier prose | Not returned | No statement to display |
| Scope/freshness | Not returned | Property/rate applicability not established |

### 4. The same coarse disclosure appears at results/detail and handoff

`HotelAdmissionPolicyCardBlock` and `HotelAdmissionPolicySection` reuse the same body at card and review variants. This provides continuity and supports loading, error, not-provided, reported, incomplete, and conflict states (`app/components/HotelAdmissionPolicy.tsx:64-164`, `:174-230`). The supplier statement and provenance remain visible, which is the correct trust hierarchy.

Recognition is weak in four specific ways:

1. The collapsed result signal says only **Check-in: ID rules**; its accessible name adds “identification or payment rules,” but still does not name the affected person or action (`app/components/HotelAdmissionPolicy.tsx:232-268`).
2. Confirmed presentation summarizes every statement as a requirement on “the registering guest,” whether or not the source says that (`lib/hotels/admissionPolicy.ts:135-139`).
3. The whole-family unknown says the provider has not supplied “check-in age, ID, or occupancy rules.” It does not reveal whether document need, card-name match, or role coverage is unknown (`app/components/HotelAdmissionPolicy.tsx:92-105`).
4. `coverageIncomplete` says only that “other check-in eligibility rules” were not reported. It does not identify the unresolved decision dimension (`:113-117`).

The result-card preview follows a sound salience rule by appearing only for reported restrictions. Generic unknowns are available in expanded evidence rather than repeated as chips. Preserve that distinction: a role-specific unknown belongs in detail and mandatory handoff review, not as a warning chip on every result.

### 5. Lead-guest guidance is disconnected from policy evidence

The handoff review separately tells travelers to use the name of the person checking in as the lead guest and to have a name, email, and phone ready (`app/book/BookingFlow.tsx:1207-1223`). That guidance is not derived from the admission-policy evidence and does not say whether the lead guest needs ID, whether the cardholder must attend, or whether all occupants may be checked.

This separation can produce a false inference: a traveler may read “use the name of the person checking in” and assume a non-matching payer is acceptable. The guidance must remain readiness advice, while the adjacent identity disclosure explicitly says whether payment-name rules are confirmed or not established.

The full `admissionPolicy` and capability are carried through `HotelOffer` into `BookingHotelContext`, validated, stored behind an opaque 30-minute context reference, and re-derived at handoff (`lib/types.ts:624-648`; `lib/booking/config.ts:70-97`, `:1206-1227`; `lib/booking/hotelContextStore.ts:10-45`). This is a suitable continuity path for bounded evidence; no new personal-data path is needed.

### 6. Current analytics cannot measure the proposed funnel

Client code emits `hotel_handoff_viewed`, then arms a return detector after Continue. A visibility hide/show produces `hotel_handoff_returned` with a coarse away-duration bucket (`app/book/BookingFlow.tsx:930-960`). It later offers fixed mismatch reasons, which is directionally privacy-safe (`:1088-1128`).

However:

- `hotel_handoff_returned` sends `policyState` and `obligationTypes`, but its API allowlist accepts only `source`, `partnerHost`, and `awayDurationBucket` (`app/book/BookingFlow.tsx:945-951`; `app/api/analytics/route.ts:37-40`). The entire event is rejected because unknown properties invalidate a payload.
- `hotel_handoff_continue_clicked` sends `invoiceNeeded`, `invoiceReadinessStatus`, `helpViewed`, and `loyaltyDisclosureViewed`; none is allowlisted (`app/book/BookingFlow.tsx:970-977`; `app/api/analytics/route.ts:37-39`). It is also rejected.
- `hotel_handoff_return_reason_selected` is not an accepted event at all, so the UI can say feedback was recorded even though the server rejects it (`app/book/BookingFlow.tsx:995-1007`; `app/api/analytics/route.ts:12-50`, `:250-271`).
- Admission events record only broad evidence state and family lists. They do not establish actual 50%/one-second exposure, affected-party recognition, or identity-related return reason (`app/components/hotelAdmissionPolicyAnalytics.ts:41-84`).

A tab returning is not proof of abandonment, failed payment, identity rejection, or booking completion. It is only a return to expaify after a handoff attempt.

## Provider-normalization findings

### Reference semantics matrix

| Evidence source | What is explicitly structured | What remains prose or absent | Normalization implication |
| --- | --- | --- | --- |
| Current Hotellook adapter | No identity-policy fields; no family capability | Every assigned dimension | All three dimensions remain unknown. |
| Booking.com accommodation details | Property ID, language selection, payment capabilities, and some policy fields; `important_information` is localized text | The reviewed card-presentation rule appears in `description.important_information`; no documented affected-party or payment-name-match enum | Preserve attributed important-information text. Do not infer role or name matching from words such as “card,” “presented,” or “check-in.” |
| Booking.com order creation | `booker`, product `guests[]`, and payment `cardholder` are distinct request roles | Whether a property requires any two names to match or any person to present ID | Role separation informs plain-language labels, not property-policy facts. |
| Expedia Rapid content/launch contract | `checkin.min_age` is structured; check-in and special instructions are scoped property content | Photo-ID/card language is inside `checkin.instructions`; the example does not name a typed affected party or match rule | Render returned instructions together and preserve attribution. Do not keyword-parse them into booleans or roles. |
| Expedia Rapid booking | Room guest and billing/payment branches are distinct | A universal check-in name-match rule | Transaction fields cannot prove admission requirements. |

### Canonical research vocabulary

The existing broad family should gain a nested, optional structured object only when a supplier contract supports it. This is a UXR data recommendation, not an authorization to implement:

```ts
type HotelGuestIdentityRequirementEvidence = {
  scope: 'property' | 'rate' | 'selected_stay'
  propertyId: string
  offerId?: string
  supplier: string
  locale?: string
  fetchedAt?: string
  affectedParty: {
    value: 'lead_guest' | 'cardholder' | 'all_occupants' | 'other' | 'unspecified'
    otherLabel?: string
    evidenceState: 'confirmed' | 'conditional' | 'not_required' | 'not_established' | 'conflicting'
  }
  identityDocument: {
    evidenceState: 'confirmed' | 'conditional' | 'not_required' | 'not_established' | 'conflicting'
  }
  paymentNameMatch: {
    evidenceState: 'confirmed' | 'conditional' | 'not_required' | 'not_established' | 'conflicting'
  }
  statements: SupplierAdmissionStatement[]
  sourceFields?: string[]
}
```

Rules for this vocabulary:

- `not_required` is an explicit supplier negative, never the default.
- `unspecified` means a supplier statement exists but does not establish the person; `not_established` means the dimension lacks usable evidence. These are different.
- A positive role does not make both requirements positive. For example, “lead guest must show ID” leaves payment-name match `not_established` unless separately stated.
- `otherLabel` is bounded supplier vocabulary, not user-entered text.
- Document subtype—passport, national ID, driver license—must remain in attributed supplier wording unless a documented enum supplies it. “Government-issued photo ID” must not be normalized to “passport.”
- A transaction request containing a `cardholder` field proves only that payment needs a cardholder name, not that it must match a guest or be presented at check-in.
- Property evidence cannot be promoted to a selected-rate claim. Locale must be retained because translated supplier statements can differ or be absent.
- Conflicts preserve all bounded statements; do not choose the newest or most permissive statement unless the supplier contract defines precedence.
- A provider may declare negative capability per dimension only after contract and fixture tests demonstrate a stable explicit negative. One broad `checkin_identity: true` capability is insufficient.

### Safe degradation algorithm

1. Validate supplier, property/offer scope, locale, freshness, and declared field capability.
2. Normalize only explicit enum/scalar fields documented for the exact dimension.
3. Preserve supplier prose separately; never use component or adapter keyword matching to derive role, requirement, document subtype, or negative status.
4. If a required structured field is missing, malformed, stale beyond the provider contract, or mismatched to the rendered offer, set only that dimension to `not_established`.
5. If credible statements disagree, set the affected dimension to `conflicting` and retain both; leave unrelated dimensions unchanged.
6. If every dimension is `not_established` and no statement exists, show a concise unknown disclosure, not an empty section and not “no rule reported.”

## Reference-pattern comparison and exact delta

### Booking.com pattern: separate roles, validate at selected-offer preview

The reference flow separates booker, staying guests, and cardholder in the transaction schema, then uses order preview as the current source for selected-product payment behavior. Property-specific card-presentation language remains important-information content.

**Interaction guidance:** name roles separately and put selected-offer review immediately before commitment. Keep supplier policy text visible as evidence rather than rewriting it into a stronger claim.

**expaify delta:** the handoff has a generic lead-guest readiness note and a separate coarse admission section. It does not connect role, requirement, evidence state, and pre-payment action. It also has no selected-product provider preview, so the honest CTA remains “verify on the booking partner before paying,” not “you meet this rule.”

### Expedia Rapid pattern: disclose returned instructions at both decision deadlines

Rapid requires check-in instructions and special instructions together on availability and booking pages. Its own example leaves ID/card language in the instruction block while structuring minimum age separately.

**Interaction guidance:** preview decision-changing affirmative rules before the traveler invests in a room and repeat complete instructions at the final review. Repetition at handoff is continuity, not duplicate policy logic.

**expaify delta:** the same coarse component is available at result and handoff, but the collapsed result chip lacks role/action and the handoff summary can invent “registering guest.” The repair is a truthful role/action summary derived from structured evidence when present, plus visible role-specific unknowns at handoff.

## Disclosure-recognition study

No participant baseline exists, so the 90% target in discovery remains a downstream validation threshold, not a finding. Test the pattern before treating copy as validated.

### Stimuli

Use a balanced set of synthetic property examples:

1. Lead guest must show government-issued photo ID; card-name match not established.
2. Cardholder must be present and card name must match; identity-document need not separately be inferred.
3. All adult occupants must show ID.
4. Conditional rule with an explicit condition.
5. Two credible conflicting statements.
6. Supplier prose says “ID and card may be required” but affected party is unspecified.
7. No provider evidence for any dimension.
8. Explicit supplier negative for identity document only; payment-name match remains unknown.

For each, test self-booking, booking for someone else, and a different cardholder. Run at 375px and 1280px. Use synthetic names and cards; participants must never enter real identity or payment data.

### Tasks and measures

After detail and again before handoff, ask:

- Who does the rule apply to?
- What must that person do?
- Does the cardholder name have to match the lead guest?
- What should you verify before paying?

Score each answer against evidence, with “the provider did not establish this” as correct whenever applicable. Record:

- affected-party recognition;
- identity-document recognition;
- payment-name-match recognition;
- action recognition;
- unknown-as-permission errors;
- time to answer; and
- whether the participant opens supplier evidence.

Passing threshold: at least 90% correct on each core recognition measure, zero unknown-as-permission interpretations, and no lower success at 375px than desktop in the formative sample. Report counts and sample size; do not publish population percentages from a small formative study.

## Privacy-safe abandonment measurement

### Measurement model

Use a short-lived, random handoff-attempt ID generated when Continue is clicked. It must not be an offer ID, account ID, email-derived hash, or cross-session identifier. Define the funnel as:

`qualified disclosure exposure → handoff continued OR informed exit → returned to expaify → optional fixed return reason`

A qualified exposure should mean at least 50% of the handoff disclosure visible continuously for one second, consistent with the invoice-readiness exposure convention already in `BookingFlow`. A page mount alone is insufficient.

Report separately:

- **informed exit rate:** qualified exposure followed by an explicit back/change action before provider continuation;
- **handoff continuation rate:** qualified exposure followed by Continue;
- **return-to-expaify rate:** expaify becomes visible again after a continuation-triggered hide;
- **identity-surprise reason rate:** a returned user voluntarily chooses an identity/cardholder mismatch reason; and
- **unknown-state verification rate:** users exposed to unknown who continue to the partner, without calling that success or failure.

Do not label `hotel_handoff_returned` as abandonment. A traveler may return after booking, comparison, a blocked popup, or simple tab switching. Without a provider callback, booking completion is unknown.

### Minimum event taxonomy

| Event | Allowed fixed properties | Purpose |
| --- | --- | --- |
| `hotel_identity_disclosure_exposed` | `surface`, `evidence_state`, `affected_party_state`, `identity_document_state`, `payment_name_match_state`, `viewport_group`, `source_class` | Denominator for recognition-adjacent behavior; no raw statement text. |
| `hotel_identity_informed_exit` | same state enums + `exit_action: back_to_results \| change_hotel` | Distinguish a safe pre-handoff decision from unexplained drop-off. |
| `hotel_identity_handoff_continued` | same state enums + `partner_named` | Measure continuation after actual exposure. |
| `hotel_identity_handoff_returned` | same state enums + `away_duration_bucket` | Observe return only; do not infer failure. |
| `hotel_identity_return_reason_selected` | `reason`, state enums | Optional, fixed-choice signal after return. |

Allowed return-reason values:

- `lead_guest_id_requirement`
- `cardholder_presence_or_name_match`
- `all_occupants_id_requirement`
- `identity_requirement_unclear`
- `different_hotel_detail`
- `booking_completed`
- `prefer_not_to_say`

Avoid “other” with a text box. Keep `booking_completed` as self-report, not a verified conversion.

### Prohibited analytics data

- Names, initials, emails, phone numbers, addresses, nationality, residency, age, or identity-document numbers.
- Cardholder names, card numbers, last four digits, payment tokens, issuer/bank, card type tied to a user, or billing address.
- Copies, scans, photos, OCR output, or user-entered document subtype.
- Supplier statement text, free-text feedback, DOM snapshots, session replay, keystrokes, or clipboard contents.
- Full provider/deeplink URLs, query parameters, affiliate tokens, booking references, or stable property IDs when aggregate source/state analysis is sufficient.
- Deterministic hashes of any personal or payment value.

Retain only the shortest period needed for aggregate funnel analysis, enforce minimum cohort thresholds before segmentation, and never segment by inferred nationality or document type. The ticket does not authorize changes to the privacy policy or analytics implementation; DEV must reconcile any new collection with those controls before release.

## Design directives

### Directive 1 — Use role-first, dimension-specific disclosure; never summarize prose into a person

At hotel detail and handoff, the identity block must answer in this order: **who**, **what**, **what remains unknown**, **what to do**. Show separate rows for `Identification` and `Cardholder name`, each with its own state. Only name **Lead guest**, **Cardholder**, or **All occupants** when explicit structured supplier evidence names that party. If a supplier statement exists without structured role evidence, label the party **Who this applies to: Not specified by the provider**.

Test: a `checkin_identity` prose statement with no structured role never produces “registering guest,” “lead guest,” “cardholder,” or “all occupants” in the summary.

### Directive 2 — Make unknown explicit at handoff and preserve exact negative scope

When the current Hotellook path supplies no evidence, the handoff block must visibly state:

> ID and cardholder rules not provided
>
> Hotellook did not tell us whether the lead guest, cardholder, or all occupants need ID, or whether the cardholder name must match. Check these rules on the booking partner before paying.

Do not use “No ID required,” “No cardholder rule,” a green success treatment, or absence of the block. If a future provider explicitly negates only one dimension, show that dimension as not required and keep the other dimension unknown.

Test: every unknown/malformed/unsupported fixture includes `not provided` or `not established`, names the unresolved dimensions, and contains a before-paying verification action; no unknown fixture contains “no rule.”

### Directive 3 — Preview only affirmative decision-changing rules on result cards; repeat the full state at handoff

The collapsed result/card signal should appear only for a confirmed or conditional role-specific restriction. Its text must contain the role and action, for example **Lead guest: photo ID at check-in** or **Cardholder must be present**. If the role is unspecified, use **Check-in ID/card rule—details** rather than guessing. Generic unknowns must not become a chip on every result, but must remain available in expanded detail and always appear at handoff.

Test: no `not_established`-only offer renders a collapsed warning chip; every affirmative card chip has a matching expanded statement and the same evidence is present at handoff.

### Directive 4 — Keep attributed supplier wording visible and bounded

For confirmed, conditional, unspecified, and conflicting states, show the normalized summary first and the supplier statement immediately below under **Provider wording**. Preserve source label and freshness. Do not hide the sole evidence behind an accordion at handoff. For conflicts, show both statements and the sentence **These details conflict. Check with the booking partner or property before paying.** Never resolve a conflict by display order.

Test: source text remains verbatim after whitespace trimming, respects the existing 300-character and three-statement caps, exposes omitted-count guidance, and is not used by UI code to derive a role or flag.

### Directive 5 — Repair measurement before using abandonment as a success metric

Analytics implementation must first make client events match the server allowlist and validator. Fire exposure only after the visibility threshold; record fixed enums only; add the three identity/cardholder return choices plus unclear, completed, different detail, and prefer-not-to-say; and keep return separate from abandonment and verified completion.

Test: API tests accept every allowed event/state combination, reject extra properties and all free text, and demonstrate that no name, card, document, URL, booking reference, or supplier prose can pass validation. Funnel reporting must show informed exit, continuation, return, and self-reported reason as separate measures.

## State and copy rules for UXDES

| Evidence state | Required hierarchy | Copy rule |
| --- | --- | --- |
| Loading | Status first | “Checking ID and cardholder rules…” Do not replace existing content with a blank skeleton at handoff. |
| Confirmed | Role → requirement → source → action | Use an affirmative sentence only for structured facts. Keep provider wording visible. |
| Conditional | Role → conditional action → exact condition/source → verify | Use “may” or “depends on”; never flatten to always required. |
| Explicit negative | Exact dimension → source | “Provider reports no [dimension] requirement” only when exact negative capability exists. |
| Not established | Unknown dimensions → source limitation → verify before paying | Never imply permission. Current Hotellook path uses this state. |
| Error | Check failed → prior facts, if any, remain attributed → retry/verify | Do not turn a transport error into missing-policy reassurance. |
| Conflicting | Conflict label → both statements → verify | Do not select a winner or render a success treatment. |

At 375px, use stacked fact rows and allow source text to wrap; never truncate the affected party or action. At 1280px, a compact two-column fact grid is acceptable, but the supplier wording and verification action remain in reading order. Keyboard focus must reach any disclosure control before Continue, and status changes must use the existing polite live-region pattern without moving focus unless the user initiated Retry.

## Scope boundaries and out-of-scope findings

- This ticket does not authorize collecting names, cardholder details, identity documents, or payment data.
- It does not authorize calling Booking.com or Expedia, scraping partner pages, changing affiliate handoff behavior, or treating reference APIs as current expaify supply.
- It does not cover age, residency, occupancy fit, accessibility, deposits/holds, cancellation, invoice readiness, or room smoking policy.
- The analytics rejection is a real broken measurement path, but code repair belongs to DEV after UXDES finalizes the event names and UI states.
- Current public provider documentation is insufficient to certify typed role semantics. A future provider integration is blocked from positive normalization until expaify has the contracted schema, representative fixtures across locale/scope, and exact-dimension capability tests.

## UXDES handoff

UXDES must specify the existing admission-policy component's role-specific extension across default, loading, confirmed, conditional, explicit-negative, not-established, error, conflicting, 375px, 1280px, keyboard/focus, long supplier wording, missing freshness, and multiple-statement states. It must preserve the current card-versus-handoff salience rule and provide final visible copy for both structured and prose-only evidence.

The design must not add an identity form. Its primary outcome is correct recognition before leaving expaify; its secondary outcome is privacy-safe separation of informed avoidance from post-handoff surprise.

**Next ticket:** `UXDES-HOTEL-GUEST-IDENTITY-REQUIREMENTS-01`

