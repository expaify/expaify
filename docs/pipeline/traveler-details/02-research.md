# UXR-TRAVELER-DETAILS-01: Hotel Booking Traveler-Detail Readiness

Date: 2026-07-22  
Stage: UX Research  
Priority: P0  
Upstream: `docs/pipeline/traveler-details/01-discovery.md`

## Executive Finding

The discovery problem is confirmed, but the proposed traveler-detail object is **not ready to become a production hotel contract**.

The repository has one active hotel supply adapter, Hotellook. It produces an affiliate redirect through `tp.media` to Hotellook, not a contracted booking API schema or a stable final booking partner identity. The selected-offer handoff contains no stay dates, room/product identifier, occupancy, lead-guest role, or contact requirements. expaify therefore cannot truthfully say that a particular field is required by the partner a guest will reach.

Current Booking.com Demand API and Expedia Rapid documentation establish a useful cross-partner baseline: both need the identity of a guest who will actually stay, plus contact information, but they assign those details differently. Booking.com separates product guests from a booker and can conditionally require the booker's address. Expedia requires the actual main guest for each room and an itinerary email and viable traveler phone. That difference invalidates a universal `leadGuestIsBooker` flag as the whole role model when the booker is not staying; some integrations can require both a lead guest and a separately named booker.

The repair-safe outcome for the current redirect flow is advance guidance, not collection: tell users to have the lead guest's name, a confirmation email, and a reachable phone ready; explain that the booking partner determines whose contact details it needs; and label the list as possible rather than required while partner requirements remain unverified. No hotel traveler form, provider call, or new personal-data store is justified by this ticket.

There is also no defensible field-frequency ranking today. The repository has no durable analytics sink or provider-form events. External checkout research shows that unclear requiredness and unexplained phone collection create errors and abandonment, but it does not measure expaify's hotel handoff or identify expaify's highest-error field. UXDES must not turn those external findings into an invented baseline.

## Method and Evidence Standard

This brief combines:

1. A source audit of the selected hotel path from `HotelCard` to `/book` and the external redirect.
2. An adapter and type audit to identify the hotel provider that is actually integrated.
3. A pattern comparison using current official Booking.com Demand API and Expedia Rapid documentation. These are reference integrations, not evidence that expaify currently sends users to either API flow.
4. Original checkout research from Baymard for error hypotheses, plus W3C form guidance and European Commission data-minimisation guidance for the measurement boundary.

Claims are classified as:

- **Current-code evidence:** directly observable in this repository.
- **Reference requirement:** documented by a named external platform, but not an expaify contract.
- **Research hypothesis:** plausible and testable, but not a measured expaify result.

No moderated study, partner error export, production funnel dataset, or contract was supplied for this ticket. That absence limits what can be called validated.

## Current-Code Audit

### What the selected-hotel path does

- `HotelCard` creates an expaify review URL only when both the nightly `Money` value and booking URL are valid, then labels the action **Review hotel** (`app/components/HotelCard.tsx:708-725`, `:825-835`).
- `buildHotelBookingHref` copies offer ID, source, hotel name, nightly integer-cent price, currency, price basis, provider URL, and optional location evidence into query parameters (`lib/booking/config.ts:470-504`). It does not carry check-in, checkout, occupancy, room/product allocation, guest role, or contact requirements.
- `BookingHotelContext` contains offer/provider/hotel/location/price/handoff data only (`lib/booking/config.ts:30-41`). Its validator rejects malformed price, currency, basis, URL, and location context but has no traveler-detail branch (`lib/booking/config.ts:377-416`).
- `HotelHandoffReview` names the destination only when it can infer a recognizable hostname. `tp.media` is deliberately treated as opaque, so the active Hotellook affiliate link resolves to the generic **booking partner** label (`app/book/BookingFlow.tsx:40-69`, `:727-736`).
- The review tells users which commercial facts the provider will confirm and explains special requests, but it does not disclose lead-guest or contact readiness (`app/book/BookingFlow.tsx:746-833`). The CTA opens the provider URL in a new tab with `noopener noreferrer sponsored` (`:815-828`).
- The hotel branch returns before the separate Duffel flight traveler form. Hotel users cannot enter or submit traveler details to expaify (`app/book/BookingFlow.tsx:838-869`). Flight fields and validation are not evidence of hotel requirements.

### Which hotel partner is actually evidenced

- `HotellookProvider` is the only class implementing `HotelProvider` used by `app/api/search/route.ts` (`lib/providers/hotellook.ts:408-513`; `app/api/search/route.ts:10`, `:178`, `:406`).
- Its booking link is an attributed redirect of the form `https://tp.media/r?...&u=https://hotellook.com/hotels/{id}` (`lib/providers/hotellook.ts:418`).
- Booking.com, Hotels.com, Expedia, Agoda, and Priceline appear only in a display-name hostname map in `BookingFlow`. That map is not evidence of an adapter, agreement, field schema, or reachable inventory (`app/book/BookingFlow.tsx:40-46`).

Consequently, the current MVP partner matrix has one row—Hotellook redirect—with **unknown downstream traveler requirements**. A final merchant or OTA may vary after redirect, and the repository exposes no contractual mapping from a selected offer to that party's checkout schema.

### What can and cannot be measured now

The hotel review emits these client events:

| Event | What it actually establishes | What it does not establish |
| --- | --- | --- |
| `hotel_handoff_viewed` | A valid expaify hotel review mounted. | That a provider form was shown. |
| `hotel_handoff_continue_clicked` | The external CTA was activated. | That the new tab loaded or a booking began. |
| `hotel_handoff_returned` | The expaify tab became visible after a continue-triggered hide/show sequence; time away is bucketed. | Abandonment, validation failure, rejection, or booking completion. |
| `hotel_handoff_back_clicked` | The user went back before continuing. | Why they left the review. |

The event code is careful not to block navigation and uses coarse duration buckets (`app/book/BookingFlow.tsx:93-106`, `:660-725`). However, `lib/analytics.ts:1-7` only writes `console.debug` in development. There is no durable event transport, hotel traveler field event, provider callback, or order-success signal. The privacy page also promises no third-party trackers (`app/privacy/page.tsx:16-35`), so a future analytics implementation must be reconciled with that public policy before release.

## Partner Requirement Matrix

The following matrix separates the current expaify integration from reference APIs. “Required” below means required by the cited direct API, not necessarily by the consumer website or the unknown partner reached through Hotellook.

| Field or role | Current expaify / Hotellook redirect | Booking.com Demand API reference | Expedia Rapid reference | Research conclusion |
| --- | --- | --- | --- | --- |
| Lead/main guest name | Not returned; downstream unknown | `accommodation.products[].guests[].name` required for each product | `rooms[].given_name` and `family_name` must be the actual main guest checking into each room | A staying-guest identity is a strong cross-partner baseline, but cardinality is per product/room, not universally one per booking. |
| Guest email | Downstream unknown | Required for each product guest | Itinerary email must be the traveler address or a monitored mailbox | Email is a cross-partner contact need, but owner and repetition differ. Do not label it “lead guest email” universally. |
| Booker name | Downstream unknown | Required separately as `booker.name.first_name` and `last_name` | Billing/payor name is payment-dependent; room name remains the staying guest | `leadGuestIsBooker` alone is insufficient if a partner needs both parties' identities. |
| Booker/traveler phone | Downstream unknown | `booker.telephone` required | A viable traveler contact number is required on the itinerary | Phone is a likely readiness item. Purpose/owner must be explained; format rules still need partner schema validation. |
| Address | Downstream unknown | Conditional when `booker_address_required=true` | Billing address belongs to the payment branch | Exclude from generic readiness copy and the MVP candidate object. Surface only from verified selected-rate/payment requirements. |
| Additional guest names | Downstream unknown | Guest array is tied to each selected product | Main guest required per booked room | Do not request or promise “lead guest only” for multi-room flows. Current context lacks room count and allocation, so this case cannot be resolved in UI copy. |
| Arrival time / requests | Downstream unknown | Optional; arrival hour becomes conditional only if arrival time is provided | Optional booking context | Keep outside traveler identity/contact readiness. Existing special-request guidance already handles this separately. |

Booking.com's current order guide requires a product guest name and email, then separately requires the booker's name, email, and telephone; address is conditional. It also recommends sending optional fields only when relevant to the integration or booking context ([Booking.com Orders API guide](https://developers.booking.com/demand/docs/orders-api/order-preview-create)). Expedia Rapid requires the main guest who will actually check in for every room, an itinerary email, and a viable traveler phone ([Expedia Rapid lodging launch requirements](https://developers.expediagroup.com/rapid/setup/launch-requirements/lodging-launch-reqs)).

### Minimum model decision

The discovery candidate is directionally correct for a one-room self-booker, but it conflates contact role and cannot represent a separately named booker. Replace it as a research model—not yet a shared production type—with two layers:

```ts
type HotelTravelerRequirementProfile = {
  partnerKey: string
  schemaVersion: string
  confidence: 'partner_verified' | 'reference_only' | 'unknown'
  stayingGuest: {
    cardinality: 'one_per_booking' | 'one_per_room' | 'all_guests' | 'unknown'
    givenName: 'required' | 'conditional' | 'unknown'
    familyName: 'required' | 'conditional' | 'unknown'
    email: 'required' | 'conditional' | 'unknown'
  }
  booker: {
    separateIdentity: 'required_if_not_staying' | 'not_required' | 'unknown'
    email: 'required' | 'conditional' | 'unknown'
    phone: 'required' | 'conditional' | 'unknown'
  }
}

type HotelTravelerDetailsCandidate = {
  bookingForSelf: boolean
  stayingGuest: {
    givenName: string
    familyName: string
  }
  bookingContact: {
    owner: 'staying_guest' | 'booker'
    email: string
    phone: string
  }
  booker?: {
    givenName: string
    familyName: string
  }
}
```

The requirement profile prevents an unknown redirect from being treated as a universal schema. The details candidate preserves the discovery's minimum fields while making ownership explicit and supporting a separately named booker when a verified integration demands one. It remains incomplete for multi-room bookings; room/product allocation must be solved upstream before such a form could be approved.

For the current Hotellook row, set every field status to `unknown` and confidence to `unknown`. Do not instantiate or collect `HotelTravelerDetailsCandidate` in the present redirect flow.

## Reference-Pattern Delta

### Booking.com-style pattern

The reference API validates stay/product allocation before order creation, then asks travelers to review booking details and provide guest/arrival information. Guest and booker roles are structurally distinct. The relevant pattern is progressive, selected-offer-specific disclosure: determine requirements from the chosen product, name each role, and expose conditional fields only when the response requires them.

**Delta:** expaify has neither the selected product/room allocation nor the requirement response. It cannot announce verified fields, distinguish guest from booker, or preflight occupancy. A generic pre-handoff readiness note is the maximum honest intervention.

### Expedia-style pattern

The reference integration requires the actual person checking into each room and explicitly assigns email/phone operational purposes. The relevant pattern is role-first instruction: say whose name belongs in the room record and why the contact channel is requested.

**Delta:** expaify says what commercial details the partner confirms but says nothing about whose personal details the user should be prepared to enter. The current UI can reduce surprise with role guidance, but cannot claim Expedia rules for an opaque Hotellook redirect.

## Error Evidence and Ranking

### What the evidence supports

Baymard's checkout studies provide useful directional evidence:

- In testing of forms that marked only optional fields, 32% of participants encountered a validation error after omitting a required field; at one tested checkout, 22% tried to continue without an email when requiredness was not marked ([Baymard required/optional field research](https://baymard.com/blog/required-optional-form-fields)).
- In a study of 1,026 online shoppers, 14% said they would never provide a phone number to an online store; qualitative participants supplied false numbers or abandoned when a required phone lacked an explanation. A short purpose explanation alleviated most observed concerns ([Baymard phone-field research](https://baymard.com/blog/explain-phone-number-field)).
- W3C guidance says detected errors must identify the affected item and describe the problem in text; after submit, moving focus to the first invalid input is a supported recovery pattern, and blur/focus-change validation is preferable to validating format-sensitive fields while the user is still typing ([W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification), [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/)).

These findings establish susceptibility, not expaify frequency. They cover general ecommerce checkouts, not the current Hotellook journey, and do not provide a comparable name-versus-email-versus-phone failure rate.

### Evidence-ranked interruption hypotheses

| Rank | Hypothesis to test | Evidence strength | Required error codes if observable | Why it is not yet a frequency finding |
| --- | --- | --- | --- | --- |
| 1 | Users omit or misassign a detail when requiredness and role ownership are unclear, especially when booking for someone else. | Strong cross-partner schema delta plus quantitative general-checkout evidence about unclear requiredness. | `required_missing`, `wrong_role`, `guest_allocation_mismatch` | No hotel-partner field events or expaify study. |
| 2 | An unexplained required phone creates privacy hesitation, false data, or abandonment. | Quantitative and qualitative general-checkout evidence; phone required in both reference APIs. | `required_missing`, `country_code_missing`, `country_code_duplicated`, `invalid_phone` | The 14% result measures willingness, not validation failure on this flow. |
| 3 | Email omission or syntax mistakes interrupt submission. | Email is required in both reference APIs; one general-checkout observation shows omission under ambiguous labels. | `required_missing`, `invalid_email`, `email_mismatch` | No expaify or hotel-specific error rate. |
| 4 | Legitimate names fail restrictive formatting or are assigned to the booker instead of the staying guest. | Role requirement is documented; international-format rejection remains an unmeasured but high-cost hypothesis. | `required_missing`, `wrong_role`, `unsupported_characters`, `name_structure_rejected` | Neither reference document publishes character rules or rejection frequency. |
| 5 | Late submit-only validation causes repeated correction or value loss. | Supported by general accessibility/error-recovery guidance. | `submit_validation_failed`, paired with field code; `correction_succeeded` | No current provider-form access to observe timing or recovery. |

UXDES must preserve the ranking labels as hypotheses. It must not state “phone is the most common error” or attach percentages to expaify.

## Validation Study Needed to Close the Evidence Gap

Partner validation and user validation are separate gates.

### Partner gate

For every intended MVP booking destination, obtain a contract/schema or a partner-owned field export tied to a stable partner key and version. Confirm:

- staying-guest cardinality per booking/room;
- whether a separately named booker is required when not staying;
- field required/conditional/optional status for guest name, guest email, booker name, email, and phone;
- conditional triggers such as address, locale, payment method, or property rule;
- accepted name characters and phone normalization rules;
- stable normalized validation error codes; and
- whether an opaque handoff ID can be returned in privacy-safe aggregate events or a booking callback.

A hostname map, scraped consumer form, or one manually observed property is not sufficient because requirements can vary by product, payment timing, locale, and downstream seller.

### Moderated usability gate

If partner-side data is unavailable, run a formative study using synthetic identities and a representative partner sandbox/prototype:

- 12–16 participants, balanced between booking for self and booking for someone else;
- at least half completing on a 375px-class mobile viewport;
- include international name and phone scenarios, without asking participants to reveal their real name, email, or phone;
- test unknown-partner guidance versus verified-partner guidance;
- record task completion, first-pass completion, error code, correction, time-to-recovery, and comprehension of whose details belong in each field;
- report counts with sample size, not population percentages.

The model is validated only when all intended MVP destinations pass the partner gate. Moderated findings can validate copy and error recovery, but cannot substitute for a partner's required-field contract.

## Privacy-Safe Measurement Boundary

The European Commission's GDPR guidance says personal data should be processed only where the purpose cannot reasonably be achieved another way, prefers anonymous data where possible, and requires collected data to be adequate, relevant, and limited to what is necessary ([European Commission data-minimisation guidance](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr/how-much-data-can-be-collected_en)). For this research question, raw traveler values are unnecessary.

### Allowed event metadata

- Opaque, single-handoff `flowId` that is not an account ID and expires under a documented short retention period.
- `partnerKey` and `requirementSchemaVersion`; do not log the full redirect URL or its query parameters.
- `surface`/`step`, `fieldKey` from a fixed enum, `requiredState`, and normalized `errorCode` from a fixed enum.
- Sequence number, coarse elapsed-time bucket, viewport class, `bookingForSelf` boolean, and room-count bucket if those values already belong to booking context.
- `recovered: boolean`, `submitted: boolean`, and partner-confirmed terminal status only when supplied by an agreed callback.

### Prohibited data

- Name, email, phone, address, payment, document, loyalty, special-request, or other raw field values.
- Hashes of those values; deterministic hashes remain linkable and are unnecessary for field-error analysis.
- Free-text validation messages, free-text return reasons, clipboard content, keystrokes, DOM snapshots, session replay, or screenshots on a personal-details form.
- Exact value length, character pattern, country inferred from a phone number, or domain inferred from an email.
- Full provider URLs, tokens, affiliate parameters beyond an approved non-personal partner identifier, or provider secrets.

### Event semantics

- `traveler_details_started`: partner confirms the form was presented or the first field received interaction.
- `traveler_field_validation_failed`: one event per field/error transition, with enum `fieldKey` and `errorCode`; repeated identical errors are deduplicated until the value changes.
- `traveler_field_corrected`: the same field becomes valid after a recorded error; it does not mean the form submitted.
- `traveler_details_submitted`: the partner accepted the details step; it does not mean payment or booking completion.
- `partner_booking_completed`: only a provider-confirmed success callback may emit this event.

Do not join `hotel_handoff_returned` to a presumed error or abandonment outcome. A tab return is only an observed return. If no partner callback or aggregate event feed exists, the measurable production funnel ends at `hotel_handoff_continue_clicked`; use the moderated study for field-level evidence.

Before durable instrumentation ships, update the privacy notice, define lawful basis/consent behavior for any client storage, document processors and retention, and complete privacy/security review. This brief sets a minimisation boundary; it is not legal approval.

## Design Directives

1. **Add one readiness block to the existing hotel handoff, without fields.** Place it after the partner-confirmation facts and before special requests. For the current unverified redirect state, use heading **What you may need** and body: **Have the lead guest’s full name, a confirmation email, and a reachable phone number ready. The booking partner will show exactly what is required.** Test: the block is visible before the provider CTA at 375px and 1280px, and there are no hotel name/email/phone inputs or new submit action.

2. **Explain the booking-for-someone-else role without claiming a universal contact owner.** Add secondary copy: **Booking for someone else? Use the name of the person checking in as the lead guest. The booking partner will tell you whose email and phone it needs.** Do not say the booker and lead guest must match. Test: a participant booking for another person can identify whose name to prepare and does not infer that expaify will send it.

3. **Make requirement confidence explicit in the content model.** UXDES must specify `unknown`, `reference_only`, and `partner_verified` states. Current Hotellook handoffs render only `unknown` copy using **may need**. A `partner_verified` state may use **You’ll need** only when keyed to a versioned partner requirement profile for the selected product; `reference_only` must never appear as a user-facing requirement. Test: an opaque `tp.media` URL cannot render Booking.com-, Expedia-, or field-required claims.

4. **Keep conditional and out-of-scope data out of generic guidance.** Do not mention or collect address, date of birth, title, gender, documents, payment, loyalty, arrival time, special requests, or additional guest names in the readiness block. Do not promise that the three readiness items are sufficient for multi-room or special-rate bookings. Test: unknown partner and invalid-selection states contain no unverified field list beyond lead-guest name, email, and phone readiness.

5. **Specify honest measurement states and accessible future error behavior.** The design spec must label outbound click and tab return only as handoff signals, never completion or failure. If a contracted embedded/direct form is later approved, every field must have visible required/optional status, a purpose note for phone, a textual field-linked error, preserved valid values, blur and submit validation, and focus on the first invalid field after submit. Analytics must use only the enums and boundaries in this brief. Test: no raw or derived personal value appears in an event payload, and only a provider-confirmed callback can mark booking completion.

## Acceptance Criteria for UXDES

- The spec designs only an advance-readiness disclosure on the current review page; it does not introduce hotel traveler inputs, provider submissions, or storage.
- Unknown, reference-only, and verified requirement states cannot be visually or semantically confused.
- All user-facing copy distinguishes the staying guest from the booker and avoids claiming who owns contact details when unknown.
- Mobile 375px and desktop 1280px hierarchy keep hotel identity/rate and the provider CTA primary; readiness guidance is secondary and special-request guidance remains tertiary.
- Analytics semantics do not infer field view, abandonment, validation failure, submission, or booking success from an outbound click or tab return.
- Any future direct-form appendix uses the error and privacy constraints in this brief, including keyboard and screen-reader recovery.

## Blockers and Out-of-Scope Findings

### Blocking full partner validation

The current Hotellook affiliate redirect supplies no stable downstream partner identity, selected room/product requirement schema, provider-form telemetry, or booking callback. Therefore:

- the current partner's exact required/optional fields remain unknown;
- no field can be ranked by expaify error or abandonment frequency;
- a production `HotelTravelerDetails` type and expaify-hosted hotel form are not approved; and
- field-level production measurement ends at the provider boundary unless a partner contract supplies privacy-safe events.

This does **not** block UXDES from specifying the generic, accurately qualified readiness disclosure in this brief.

### Out of scope

- Adding stay dates, occupancy, room identifiers, or total-price continuity to `BookingHotelContext`.
- Replacing Hotellook or selecting a direct hotel booking provider.
- Building durable analytics, callbacks, a return-reason survey, or a privacy-consent system.
- Designing or implementing hotel checkout, payment, billing address, identity documents, loyalty, special requests, or multi-room guest allocation.
- Reusing or changing the Duffel flight traveler form.

## Source Notes

- Current implementation: repository files and line references above, audited 2026-07-22.
- [Booking.com Demand API — Create your orders](https://developers.booking.com/demand/docs/orders-api/order-preview-create), accessed 2026-07-22.
- [Expedia Group Rapid — Lodging API launch requirements](https://developers.expediagroup.com/rapid/setup/launch-requirements/lodging-launch-reqs), accessed 2026-07-22.
- [Baymard — Required and optional form fields](https://baymard.com/blog/required-optional-form-fields), accessed 2026-07-22.
- [Baymard — Explain why the phone field is required](https://baymard.com/blog/explain-phone-number-field), accessed 2026-07-22.
- [W3C WAI — Understanding Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification), accessed 2026-07-22.
- [W3C WAI — User Notification](https://www.w3.org/WAI/tutorials/forms/notifications/), accessed 2026-07-22.
- [European Commission — How much data can be collected?](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr/how-much-data-can-be-collected_en), accessed 2026-07-22.

## Handoff Recommendation

Create `UXDES-TRAVELER-DETAILS-01` to specify the three confidence states and the no-form readiness disclosure for the existing hotel handoff. The design ticket must carry the partner-validation blocker: it may not add an expaify traveler-detail form or label any Hotellook/downstream field as required until a stable, versioned partner schema exists.
