# UXD-BOOKING-CONTACT-01: Hotel Booking Contact Confidence

**Stage:** UX Discovery (UXD)  
**Date:** 2026-07-22  
**Surface verified in source:** the final expaify hotel review screen before the external booking partner opens, `HotelHandoffReview` in `app/book/BookingFlow.tsx`, reached from `HotelCard` through `buildHotelBookingHref` in `lib/booking/config.ts`.

> **Scope boundary:** `booking-handoff-trust` and `booking-handoff-confidence` already cover where the traveler is going, whether the displayed price may change, and what the outbound click does. `booking-confirmation-boundary` covers whether a reservation was actually created. This discovery addresses a different pre-handoff question: **if the traveler completes the booking with the partner, who sends the confirmation and who should they contact afterward?** It does not add in-expaify hotel booking, confirmation, or case management.

## User pain point

Immediately before leaving expaify to book a hotel, a traveler cannot see who will deliver the reservation confirmation or who owns changes, cancellations, payment, and post-booking help, so they must cross the handoff without knowing where to turn if the booking succeeds or something goes wrong.

## Who is affected and where

- **Who:** First-time and low-familiarity hotel travelers who are ready to leave expaify, especially those who expect the comparison site that found the deal to retain responsibility for the reservation.
- **Flow step:** Hotel result → **Review hotel** → `/book?kind=hotel` → immediately before **Continue to provider**. The information must be available before the outbound click, even though the support need may occur after purchase.
- **Trust consequence:** A traveler may hesitate or abandon before handoff, save the wrong contact route, or later ask expaify to change a reservation it neither sold nor can access.

## Current implementation signal

The current product describes the transaction boundary but not the service-ownership boundary:

- `HotelHandoffReview` says the provider will confirm totals, availability, cancellation policy, and terms, but does not say who sends the booking confirmation or where it will be sent.
- The review screen does not state that the booking partner owns reservation status, changes, cancellations, refunds, payment questions, or booking-support contact after purchase.
- No visible booking-help or contact path exists beside the hotel handoff CTA. The only public expaify address is `questions@expaify.com` on the Terms and Privacy pages, where it is attributed to legal/privacy questions rather than booking-handoff problems.
- The normalized `BookingHotelContext` carries a provider label and booking URL, but no verified partner support URL, phone number, email address, confirmation-delivery terms, or property contact. The UI therefore cannot safely invent a provider channel or promise email delivery from current data.
- `lib/analytics.ts` provides a local `track()` primitive, but the hotel review flow emits no help-view, contact-click, or outbound-handoff event. Pre-handoff help intent and contact-information engagement are currently unmeasurable.

## Ownership model to validate

The MVP should test a two-path ownership model rather than presenting a generic “contact us” promise:

| Traveler need | Responsible path | What expaify may truthfully say before handoff |
|---|---|---|
| Booking confirmation, reservation status, changes, cancellation, refund, payment, or missing booking record after partner checkout | **Booking partner** | The partner completes the booking, sends or displays its confirmation using the contact details collected at checkout, and owns booking support. Travelers should retain the partner confirmation and use the contact route in it. Exact delivery channel must be confirmed on the partner site; expaify must not promise email from the current data. |
| Broken outbound link, wrong or mismatched deal/hotel information shown by expaify, or uncertainty about expaify's role | **expaify** | expaify can help with the discovery and handoff experience, but cannot view, change, cancel, or refund a partner reservation. A dedicated, clearly labeled expaify help path is needed; the legal/privacy contact label is not a substitute. |

Property-at-stay assistance is not a third MVP support path. If a partner confirmation supplies property contact details, the traveler can use those details, but expaify has no verified property-contact contract today and must not manufacture one.

## Measurable signal

The problem exists when a first-time traveler cannot answer these questions from visible content before selecting **Continue to provider**:

1. Who will create and deliver my hotel confirmation?
2. Who handles changes, cancellations, refunds, payment questions, or a missing confirmation?
3. What can expaify help with, and what can it not access?

The research and design stages should preserve a measurable funnel, with event naming finalized downstream:

- **Pre-handoff help intent:** unique opens of booking-help/contact information ÷ hotel review views.
- **Contact-information engagement:** clicks on an attributed partner-help path and clicks on the expaify-help path ÷ booking-help opens, reported separately by owner; never combine the two paths into one “support” metric.
- **Help-to-handoff continuation:** travelers who select **Continue to provider** after viewing booking-help information ÷ travelers who viewed it. This distinguishes useful reassurance from a help treatment that blocks conversion.
- **Diagnostic abandonment:** hotel review sessions with a help open but neither a support-path click nor an outbound handoff. This is a signal of unresolved ownership, not proof of causation.

Events must not include traveler contact details, provider confirmation numbers, full outbound URLs, or other booking data. Until event instrumentation exists, a moderated comprehension check should require participants to assign each of the needs above to either the partner or expaify without prompting.

## Constraints

1. **Truthful attribution and data integrity:** Do not imply expaify sells, confirms, accesses, changes, cancels, or refunds hotel reservations. Do not promise confirmation by email or expose a partner contact channel unless it is verified from provider-owned data. Preserve the provider URL, affiliate markers, safe-link handling, and integer-minor-unit money contract.
2. **MVP scope and non-duplication:** Keep the model to clearly attributed **booking partner** and **expaify** paths. Do not add property messaging, a support inbox/case system, booking-status lookup, or repeat the already-scoped partner-identity, price-change, and new-tab explanations.
3. **Accessible, privacy-safe measurement:** Ownership information and both help paths must be understandable before handoff at 375px and 1280px, reachable by keyboard with clear focus and labels, and instrumented without blocking navigation or collecting traveler, payment, reservation, or sensitive contact data.

## Success statement

This is solved when a first-time hotel traveler can leave expaify knowing that the booking partner will complete and confirm the reservation and handle booking changes or problems, while expaify can only help with its deal and handoff experience, without searching legal pages, guessing which company to contact, or mistaking expaify for the booking agent.

## Downstream research focus

UXR should validate the ownership model and convert it into 3–5 testable directives by:

- Auditing the complete hotel path from `HotelCard` through `HotelHandoffReview`, plus Terms/Privacy contact language and the data available in `BookingHotelContext`.
- Comparing one or two established metasearch/partner-handoff patterns specifically for confirmation delivery and post-booking ownership, not for partner identity, price volatility, or new-tab mechanics.
- Testing whether travelers correctly route confirmation, changes/cancellations/refunds, and expaify display/link problems after seeing the proposed ownership explanation.
- Defining the minimum truthful partner-help destination available from current data. If no verified support destination exists, specify an honest instruction to use the partner confirmation/site rather than fabricating a support link.
- Recommending privacy-safe event names and properties for help intent, owner-specific contact engagement, help-to-handoff continuation, and unresolved abandonment.

## Handoff

Create **UXR-BOOKING-CONTACT-01** with this report as the discovery input and the problem statement above as the single research question.
