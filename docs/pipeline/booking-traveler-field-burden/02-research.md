# UXR-BOOKING-TRAVELER-FIELD-BURDEN-01: Booking Traveler Field Burden

## Source Inputs

- Discovery report: `docs/pipeline/booking-traveler-field-burden/01-discovery.md`
- Current implementation: `app/book/BookingFlow.tsx`, `app/book/page.tsx`, `app/api/book/route.ts`, `lib/booking/config.ts`
- Reference patterns:
  - Booking.com flight booking guidance explains that passenger details commonly include full name, date of birth, gender, contact phone, email, and passport details for international flights, and separates this from payment review. Source: https://www.booking.com/guides/article/flights/info-needed-book-flight.html
  - Booking.com terms state the service provider is responsible for the travel experience and that payment/contact information must be correct when a booking is made. Source: https://www.booking.com/content/terms.html
  - Expedia terms define a travel provider boundary and state provider rules/restrictions are presented before booking. Source: https://www.expedia.com/lp/b/terms-of-service
  - UK government passenger information guidance says airlines tell travelers what passenger information is required and that it may be provided at booking or check-in. Source: https://www.nidirect.gov.uk/articles/advance-passenger-information-you-travel

## Current Implementation Audit

The `/book` route parses booking context from URL search params and passes it to `BookingFlow` with `bookingEnabled`, `duffelSandbox`, `fareContext`, and hotel context flags. Missing or malformed fare context renders a recovery state instead of the traveler form (`app/book/page.tsx:11`, `app/book/page.tsx:38`).

The active flight review path collects one adult traveler only. `BOOKING_FORM_PASSENGER_LIMIT` is hard-coded to `1`, and multi-passenger fares are blocked before form entry with the message "Multi-passenger review is paused" (`lib/booking/config.ts:30`, `app/book/BookingFlow.tsx:547`). This is consistent with the API, which rejects selected fares whose passenger count is above the limit before validating passenger fields (`app/api/book/route.ts:65`).

When booking is enabled and the fare is one passenger, the UI displays a selected fare summary, a status panel, then the traveler form. The form requires title, gender, first name, last name, date of birth, email, and phone (`app/book/BookingFlow.tsx:621` through `app/book/BookingFlow.tsx:663`). Submit sends those values to `/api/book` as `title`, `given_name`, `family_name`, `born_on`, `email`, `phone_number`, and `gender` (`app/book/BookingFlow.tsx:479` through `app/book/BookingFlow.tsx:486`).

The API requires the same seven passenger fields and returns field-specific errors such as `passenger.given_name is required` before making Duffel calls (`app/api/book/route.ts:72` through `app/api/book/route.ts:95`). After validation, it fetches the Duffel offer, verifies passenger count and price/currency, then creates an order (`app/api/book/route.ts:109` through `app/api/book/route.ts:180`).

The trust boundary exists, but it is split. The page headline says the user should confirm itinerary and price before sending traveler details to the provider (`app/book/BookingFlow.tsx:593` through `app/book/BookingFlow.tsx:595`). The status panel says provider verification is pending and no order will be created if price or passenger count changed (`app/book/BookingFlow.tsx:611` through `app/book/BookingFlow.tsx:617`). The sticky submit note says traveler details are sent only after confirmation or that sandbox submission does not issue a live ticket (`app/book/BookingFlow.tsx:666` through `app/book/BookingFlow.tsx:677`). However, none of these explicitly maps each requested personal field to "required by Duffel/airline booking," "used by expaify only to submit this order request," and "not payment/account profile data."

## Reference Pattern Comparison

Booking.com's public flight guidance makes the passenger-detail burden predictable before checkout by naming the type of information required for a flight booking: full name, date of birth, gender, contact phone, email, and passport details when applicable. The interaction pattern is not "ask for sensitive details without explanation"; it frames the data as flight booking data and separates it from payment review.

Expedia and Booking.com terms both make the provider boundary explicit: provider rules, restrictions, and responsibility sit around the travel service, while the platform assists with booking. The applicable UX pattern is to place provider responsibility and rule acceptance close to the action that commits the booking, not only in generic page copy.

Government passenger-information guidance reinforces that passenger data requirements vary by airline, destination, and timing. The relevant pattern for expaify is therefore not to reduce required Duffel fields arbitrarily, but to state that the provider requires these fields for this booking request and that requirements may differ from other flights or later check-in.

## Exact Gap

Current code does collect the right minimum set for the current Duffel order attempt and blocks unsupported multi-passenger requests. The gap is disclosure hierarchy and field purpose clarity:

- Current code presents the required data as a generic "Traveler details" form after fare review. Reference patterns frame passenger details as booking/provider-required information before users start entering it.
- Current code explains verification and non-payment boundaries in three separate places. Reference patterns keep provider rules, payment responsibility, and booking commitment close to the submit decision.
- Current code gives every field a label but no field-level or group-level reason. Reference patterns make the category of data legible: identity, contact, and provider/airline requirements.
- Current code's primary action can read "Confirm sandbox booking" in sandbox mode, while the rest of the page says no live ticket is issued. Reference patterns avoid commitment language that can be mistaken for payment or ticket issuance.
- Current code blocks multi-passenger fares with accurate recovery copy, but the single-passenger active form does not remind users that this path supports one adult traveler only before they enter details.

## Research Directives for UXDES

1. Add a pre-form trust summary above the traveler fields with exactly three scannable claims: "Required by Duffel for this booking request," "Sent only when you choose verify," and "No payment details are collected on this page." This summary must appear before the first input on mobile and desktop.

2. Group the seven fields into clear sections: "Traveler identity" for title, first name, last name, date of birth, and gender; "Provider contact" for email and phone. Each section needs one short sentence explaining why the provider needs that data. Do not add field-level helper text to every input unless the design needs format guidance.

3. Replace ambiguous commitment copy. The primary action should not say "Confirm booking" or "Confirm sandbox booking" before a provider order exists. Use verify-first language until success, and reserve "Booking confirmed" for the success state only.

4. Keep provider verification and failure rules visible at the action boundary. The sticky submit area must state that expaify sends the traveler details to Duffel after the user submits, Duffel rechecks price/currency/passenger count, and no order is created if those checks fail.

5. Preserve one-passenger integrity. In the active one-passenger form, show "1 adult traveler" in the form context or summary so users understand why only one person's details are requested. Multi-passenger fares must continue to render the existing recovery state instead of showing a partial form.

## Acceptance Checks for Downstream Stages

- On a valid one-passenger Duffel fare with booking enabled, a first-time user can identify why title, gender, name, date of birth, email, and phone are being collected before focusing the first input.
- The page never implies that expaify collects payment details on `/book`.
- The page never implies that a sandbox submission creates a live ticket.
- The submit label uses verification language until the API returns a successful booking reference.
- Mobile 375px shows the trust summary, first field group heading, fields, and sticky submit without overlapping text or hiding the action.
- Desktop 1280px keeps fare review, trust boundary, and form hierarchy visible without duplicating conflicting messages.
