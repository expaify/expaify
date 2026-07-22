# UXD-TRAVELER-DETAILS-01: Hotel Booking Traveler-Detail Readiness

## Problem Statement

When a guest leaves a selected hotel room for a booking partner, expaify cannot tell them which lead-guest and contact details they will need or help them avoid predictable entry errors, because the current handoff carries offer context only and captures no field-level completion evidence.

## Who Is Affected and Where

- **Who:** First-time hotel guests who have selected a rate and are ready to continue, especially someone booking for another person, using an unfamiliar international phone format, or unsure whose contact details the partner expects.
- **Flow step:** The transition from the selected hotel review on `/book` to the third-party provider booking page, before payment.
- **User consequence:** The guest encounters the personal-information form only after leaving expaify. A missing detail, unclear ownership rule, or late validation can interrupt a high-intent session, but expaify currently cannot distinguish that interruption from normal provider handoff.

This is a readiness and error-prevention problem. It is not approval to add an expaify hotel checkout or to collect traveler data before a partner contract requires it.

## Current-State Evidence

The repository establishes the following facts:

- `HotelCard` sends a valid hotel result to an expaify review route with **Review hotel**.
- `HotelHandoffReview` preserves the hotel, location, provider, selected nightly rate, currency, price basis, offer reference, and provider URL, then opens the provider in a new tab with **Continue to provider**.
- `BookingHotelContext` contains no stay dates, occupancy, room identifier, lead-guest details, or contact details.
- The hotel handoff has no form and performs no guest-detail validation. The only traveler form in the repository belongs to the separate one-adult Duffel flight path and must not be treated as a hotel requirement.
- `lib/analytics.ts` only writes development-time `console.debug` output. No durable event pipeline records hotel handoff starts, provider-form views, field errors, corrections, completion, or abandonment.
- The app states that hotel bookings happen on third-party provider sites. Therefore provider-side field behavior is not directly observable without an agreed partner callback, redirect status, or privacy-safe analytics integration.

There is no current behavioral dataset that supports a claim about which hotel field fails most often. Any ranking of email, phone, or name failures would be a hypothesis until UXR obtains partner requirements and completion evidence.

## Minimum Data Model to Validate

The ticket constrains MVP discovery to essential lead-guest identity and booking contact data. UXR should validate the following candidate model against each intended booking partner before UXDES treats it as final:

| Group | Candidate field | Why it may be essential | Availability at room selection | Validation question |
| --- | --- | --- | --- | --- |
| Lead guest | `givenName` | Identifies the guest attached to the reservation | Usually known; may differ from the person booking | Are middle names, honorifics, or Latin characters required? |
| Lead guest | `familyName` | Completes the reservation name | Usually known; naming conventions vary | Can a partner accept a mononym, spaces, hyphens, or apostrophes? |
| Contact | `email` | Receives confirmation and booking communication | Usually available to the booker | Must confirmation and lead-guest email be the same? |
| Contact | `phone` | Enables urgent property or partner contact | Available in principle, but country-code format may be uncertain | Is E.164 required, and which locales or number types are rejected? |
| Context, not user-entered | `leadGuestIsBooker` | Determines whose name/contact instructions apply | Known only after an explicit choice when booking for someone else | Do partners require this distinction or only a lead-guest name? |

Candidate implementation shape, subject to UXR validation:

```ts
type HotelTravelerDetails = {
  leadGuest: {
    givenName: string
    familyName: string
  }
  contact: {
    email: string
    phone: string
  }
  leadGuestIsBooker?: boolean
}
```

This is intentionally not a shared production contract yet. It excludes date of birth, gender, passport or identity documents, nationality, address, loyalty number, payment data, special requests, arrival time, and additional guest names unless a contracted provider proves one is required to create the selected hotel reservation. Stay dates, room, occupancy, price, currency, cancellation terms, and offer identifiers are booking context, not traveler-detail fields; their current absence or incompleteness must not be solved by expanding this form.

## When Guests Can Provide the Data

These are research hypotheses, not observed findings:

- A guest can usually provide the lead guest's name and a confirmation email immediately after room selection.
- A guest booking for someone else may need to confirm the exact lead-guest spelling and which phone/email should receive provider messages.
- A guest generally has a phone number available, but may not know the provider's accepted country-code format.
- Additional travelers' names and document details should not be requested early merely because they could be useful later; their availability and necessity vary by booking partner and property.

UXR must test the hypotheses with both self-bookers and bookers acting for another guest, and must distinguish “available now” from “required now.”

## Validation Failures to Investigate

Research should determine frequency and recovery cost for these candidate interruption points:

1. Required lead-guest name left blank or entered for the wrong person.
2. Legitimate names rejected because validation assumes ASCII-only characters, two-part names, or disallows spaces, hyphens, or apostrophes.
3. Email syntax errors, accidental whitespace, or mismatch if a confirmation field is imposed.
4. Phone numbers rejected because the country code is absent, duplicated, or reformatted unexpectedly.
5. Errors shown only after full-form submission, with focus not moved to the first invalid field or prior valid values lost.
6. A partner asks for an unannounced field after handoff, particularly address, title, arrival time, additional guest names, or identity information.

The error-prevention direction to validate is: explain whose details are needed before entry, request only partner-required fields, preserve valid input, validate on blur and submit without blocking natural name entry, show an example rather than a restrictive mask for phone, associate each error with its field, focus the first invalid field on submit, and provide a concise error summary for screen-reader and keyboard users.

## Measurement Plan

### Funnel definition

The minimum observable funnel is:

1. `hotel_review_viewed`
2. `hotel_provider_handoff_started`
3. `traveler_details_started`
4. `traveler_details_validation_failed`
5. `traveler_details_corrected`
6. `traveler_details_submitted`
7. `partner_booking_handoff_completed` or a clearly defined booking-stage callback

Steps 3–7 cannot be measured by expaify today. UXR must identify whether a contracted provider can expose privacy-safe aggregate events or a return/callback state. Absence of such access is a measurement blocker, not evidence of zero abandonment.

### Required metrics

- **Field-level abandonment rate:** sessions whose last observed traveler-detail interaction is field `x`, divided by sessions that started traveler details and reached field `x`.
- **Field correction rate:** sessions where field `x` changes after a validation error, divided by sessions that interacted with field `x`.
- **Field validation-failure rate:** sessions with an error code for field `x`, divided by sessions that attempted to submit field `x`.
- **First-pass completion rate:** traveler-detail submissions with no validation error, divided by all traveler-detail submission attempts.
- **Recovery rate:** sessions that successfully submit after any validation error, divided by sessions with at least one validation error.
- **Handoff-to-details-start rate:** sessions that start traveler details, divided by provider handoffs started.

Events must record only non-sensitive metadata such as booking-provider identifier, anonymous session or funnel identifier, field name, normalized error code, interaction sequence, viewport class, and elapsed time. They must never record names, email addresses, phone numbers, raw field values, or provider secrets.

### Baseline and validation threshold

No numerical baseline exists in the current app. Before calling the minimum model “validated,” UXR must:

- confirm the required/optional status and exact constraints of every candidate field for each MVP hotel booking partner;
- observe or test both booking-for-self and booking-for-someone-else scenarios;
- obtain a privacy-safe field-error/correction dataset or run moderated task tests that expose the same failure points;
- document sample size, partner coverage, and any unobservable funnel boundary;
- reject any candidate field that has no partner requirement or necessary user outcome.

## Constraints

1. **Partner and data integrity:** Do not invent a universal hotel form. Required fields and validation rules must come from contracted partner schemas, and any eventual external call must remain behind `lib/providers` with `Result<T>` behavior.
2. **Privacy and trust:** Collect no payment, identity-document, or “useful later” profile data in MVP; explain whether the lead guest or booker owns each contact field; never send or log personal field values in analytics.
3. **Completion and accessibility:** The eventual experience must work at 375px and desktop, accept legitimate international names and phone formats, preserve valid entries after an error, expose errors programmatically, and support keyboard correction without surprise focus loss.

## Scope Boundaries

In scope for the next stage:

- Partner requirement audit for lead-guest name, contact email, contact phone, and booking-for-another-person rules.
- Evidence about when users can provide those fields and which errors interrupt completion.
- A validated required/optional matrix and error taxonomy.
- Feasibility of privacy-safe field funnel measurement across the provider boundary.

Out of scope:

- Building an expaify hotel traveler form or internal hotel checkout.
- Payment, billing address, identity documents, loyalty, special requests, or award-travel fields.
- Flight traveler requirements.
- Repairing the broader analytics platform, missing hotel stay context, provider deep links, price totals, or confirmation callbacks in this UXD ticket.

## UXR Handoff Questions

1. For each intended MVP hotel partner, which fields are required to reserve the selected room, which are conditionally required, and at what step?
2. Does the partner distinguish booking contact from lead guest, and what changes when the booker is not staying?
3. Which name, email, and phone validation rules reject otherwise legitimate input?
4. Which field produces the highest abandonment, validation-failure, and correction rates, and how reliable is that evidence?
5. Can expaify observe the provider-side form and completion boundary without collecting personal values? If not, what moderated or partner-supplied evidence will substitute?
6. What advance disclosure at the expaify-to-provider transition measurably reduces surprise without duplicating a partner form?

## Success Statement

This is solved when a first-time guest can move from a selected room to the booking partner knowing exactly which essential lead-guest and contact details are needed, then complete or correct those fields without encountering an avoidable format or ownership error.

The discovery outcome is ready for UXDES only after UXR produces a partner-validated minimum data model, an evidence-ranked validation-failure list, and a feasible privacy-safe measurement boundary.
