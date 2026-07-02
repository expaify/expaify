# UXD-BOOKING-TRAVELER-FIELD-BURDEN-01: Booking Traveler Field Burden

## User Pain Point

At the booking review step, expaify asks users to enter sensitive traveler details before it clearly separates which fields are provider-required from what expaify is doing with that information, creating uncertainty and extra friction at the moment of highest purchase intent.

## Who Is Affected and Where

First-time flight users who select an internal Duffel booking result from the flight card are affected on `/book`, after the fare summary and before submitting the booking request.

The affected step is the booking review form in `app/book/BookingFlow.tsx`, where the user must provide title, gender, first name, last name, date of birth, email, and phone number to continue. The form copy says these are "required by the provider for this review path," while the trust boundary copy is split across the page heading, "Booking status" panel, and sticky submit note.

## Measurable Signal

- The active booking form requires 7 traveler inputs before submission: `title`, `gender`, `firstName`, `lastName`, `dob`, `email`, and `phone`.
- The API route rejects any missing passenger field with `passenger.<field> is required`, so the form has no optional traveler-detail path once booking is enabled.
- The trust boundary is communicated after the form header in secondary copy, while the primary call to action can read "Confirm booking"; this makes it hard to distinguish provider data requirements from expaify's own data handling before the user starts entering personal information.
- Multi-passenger fares are blocked because the current review path collects one passenger only, which confirms the form burden is tied to provider/passenger requirements rather than a general expaify account profile.

## Constraints

1. Data integrity: the form must still collect every traveler field required by the Duffel order flow before `/api/book` creates an order, and passenger count mismatches must remain blocked.
2. Trust and compliance: copy must not imply expaify creates a live ticket in sandbox mode or collects payment details when it does not; provider handoff and order-creation boundaries must stay explicit.
3. Accessibility and mobile usability: any clarification must remain usable at 375px mobile and desktop, preserve labels and focus behavior, and avoid adding dense explanatory text that pushes the sticky submit action into an unusable position.

## Success Statement

This is solved when a first-time user can review a selected fare and understand which traveler details are required by the provider, what expaify will send, and what expaify will not collect before entering personal information, without mistaking the review step for an opaque account profile or payment checkout.
