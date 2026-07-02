# UXD-BOOKING-HANDOFF-TRUST-01: Booking Handoff Trust Gap

## Pain Point

When a user clicks a flight or hotel CTA, expaify does not consistently set expectations that the next step may be a third-party provider review where final price, fees, availability, and booking terms can change.

## Affected Users And Flow Step

- **Who is affected:** First-time users comparing flight and hotel deals who are deciding whether to leave expaify or continue into a booking review path.
- **Flow step:** Results cards, specifically the CTA and supporting note on flight and hotel result cards before provider handoff.
- **Trust risk:** The user sees a current fare or nightly rate and a Deal Score, then may interpret the CTA as a guaranteed purchasable price instead of a volatile provider offer that still needs confirmation.

## Current Implementation Signals

- `app/components/FlightCard.tsx` allows valid external fare links to open directly in a new tab. The CTA note says, "Opens the booking handoff. Final price and availability can change.", but this warning is small secondary text below the primary CTA.
- `app/components/FlightCard.tsx` treats Duffel `/book` links differently from external provider links: internal paths say "Review fare details", while external paths may say "Continue to booking" or "View fare details".
- `app/components/HotelCard.tsx` routes valid hotel offers through `/book` with "Review hotel" and the note "Review nightly price before provider handoff.", but the result card does not mention taxes, fees, cancellation policy, room details, or live availability until the next page.
- `lib/booking/config.ts` builds `/book` review URLs for both fare and hotel contexts, but the flight card only uses this review path when the provider deeplink is already an internal Duffel booking link. Other safe external flight links bypass the review page.
- `app/book/BookingFlow.tsx` contains stronger expectation-setting for hotel handoff, including provider confirmation, final taxes and fees, policies, room availability, and total due. This stronger message is not consistently surfaced before the first CTA click from results.

## Measurable Signal

This problem exists when a valid result card can be clicked without the primary CTA area clearly answering all three questions before handoff:

1. **Where am I going?** expaify review page or third-party provider.
2. **What is fixed now?** The displayed price is the last returned offer from the provider.
3. **What can change next?** Final price, availability, taxes/fees for hotels, and provider terms.

Observable QA signals:

- Flight result cards with external provider links open a new tab directly from the CTA instead of a consistent review step.
- Flight and hotel cards use different CTA labels and notes for the same trust moment.
- Hotel price volatility details are deferred to `/book`; flight external handoff details may never appear before leaving expaify.
- The caution copy is visually secondary to the CTA, so users can click the primary action without reading the limitation.

## Constraints

1. **Brand trust:** Copy must be plain and direct. It should not overpromise that expaify controls provider inventory, final price, taxes, fees, or policies.
2. **Performance:** The solution must not add a network round trip before rendering result cards or block the existing search/results flow.
3. **Accessibility:** CTA labels, aria labels, focus states, and disabled states must clearly distinguish review, provider handoff, and unavailable booking states.
4. **Data integrity:** Money must remain integer minor units and provider URLs must continue to use existing validated booking context helpers.
5. **Affiliate integrity:** Outbound provider handoffs must preserve sponsored/affiliate markers and safe URL handling.

## Success Statement

This is solved when a first-time user can click a flight or hotel CTA from results while understanding whether they are entering an expaify review step or leaving for a provider, without assuming the displayed price is final or guaranteed.

## Downstream Focus

The research stage should audit the results-card CTA area and `/book` review flow together, then define a consistent handoff pattern for:

- External flight provider links.
- Internal Duffel fare review links.
- Hotel provider handoff links.
- Unavailable price or invalid provider-link states.
