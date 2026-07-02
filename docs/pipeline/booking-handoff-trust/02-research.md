# UXR-BOOKING-HANDOFF-TRUST-01: Booking Handoff Trust Research Brief

## Source Inputs

- Discovery: `docs/pipeline/booking-handoff-trust/01-discovery.md`
- Current flight result CTA: `app/components/FlightCard.tsx`
- Current hotel result CTA: `app/components/HotelCard.tsx`
- Current review flow: `app/book/BookingFlow.tsx`
- Booking context helpers: `lib/booking/config.ts`

## Research Summary

expaify has the right review-page trust content for hotels, but the trust moment is inconsistent at the result-card CTA. Hotel cards route through `/book` before the provider handoff, while external flight links can leave expaify immediately. The user can see a Deal Score and a current price, click the primary action, and either land on an expaify review page or leave to a provider depending on provider/link type. The CTA area does not use one predictable pattern to answer where the user is going, what price basis expaify currently knows, and what must still be confirmed.

## Current Implementation Audit

### Flight Results

- `FlightCard` validates two link types: Duffel `/book` links are treated as internal review links, while any `http` or `https` URL is treated as a safe external provider link (`app/components/FlightCard.tsx:144`, `app/components/FlightCard.tsx:155`, `app/components/FlightCard.tsx:245`).
- The CTA label changes by link type. Internal Duffel review links say `Review fare details`; external Duffel links can say `Continue to booking`; other external links say `View fare details` (`app/components/FlightCard.tsx:164`, `app/components/FlightCard.tsx:248`).
- External flight CTA links open in a new tab with `rel="noopener noreferrer sponsored"` and bypass `/book` (`app/components/FlightCard.tsx:312`).
- The only pre-click handoff warning for external flights is small secondary text: `Opens the booking handoff. Final price and availability can change.` (`app/components/FlightCard.tsx:255`, `app/components/FlightCard.tsx:337`).
- The aria label names the flight and price basis, but does not tell assistive technology users that the link leaves expaify for a provider or that final price and availability require confirmation (`app/components/FlightCard.tsx:316`).
- Unavailable states are present and block action when price or provider link is invalid (`app/components/FlightCard.tsx:248`, `app/components/FlightCard.tsx:328`).

### Hotel Results

- `HotelCard` validates the hotel provider URL and price before enabling the action (`app/components/HotelCard.tsx:172`, `app/components/HotelCard.tsx:181`).
- Bookable hotel cards always build an expaify review URL with `buildHotelBookingHref` (`app/components/HotelCard.tsx:187`, `lib/booking/config.ts:234`).
- The visible CTA is `Review hotel`; the supporting note says only `Review nightly price before provider handoff.` (`app/components/HotelCard.tsx:241`, `app/components/HotelCard.tsx:251`).
- The card already labels the displayed price as `per night before taxes and fees`, but the CTA area does not mention live availability, cancellation policy, room details, or final total due (`app/components/HotelCard.tsx:49`, `app/components/HotelCard.tsx:251`).
- The disabled state provides a reason when no valid price or booking link exists (`app/components/HotelCard.tsx:257`, `app/components/HotelCard.tsx:264`).

### Booking Review

- Flight review preserves route, carrier, dates, stops, passengers, provider, price, and price basis once a valid `BookingFareContext` reaches `/book` (`app/book/BookingFlow.tsx:88`, `app/book/BookingFlow.tsx:107`).
- Hotel review has stronger expectation-setting than the hotel card: it explicitly says taxes, fees, cancellation policy, room details, live availability, and total due require provider confirmation (`app/book/BookingFlow.tsx:354`, `app/book/BookingFlow.tsx:365`).
- Hotel provider handoff correctly opens a new tab and preserves sponsored/affiliate semantics (`app/book/BookingFlow.tsx:375`).
- The booking context model supports hotel provider URLs, but flight booking context does not carry an external provider URL into review (`lib/booking/config.ts:3`, `lib/booking/config.ts:18`). As a result, making all flights pass through the review page would require a DEV-stage contract extension, not just UI copy.

## Reference Pattern Comparison

### Google Flights Pattern

Google Flights sets the expectation that it is a comparison and selection surface, then the user usually completes the transaction with an airline or online travel agency. Its help documentation says that after selecting tickets, users are usually taken to the airline or OTA to complete the transaction, and that post-booking confirmation, changes, cancellations, and issues belong with the airline or OTA. It also separates displayed flight price from potential added fees such as baggage or credit-card fees, which can vary by selected provider.

Source: https://support.google.com/travel/answer/2475306

Interaction pattern:

- Keep search result selection separate from booking completion.
- Name the external booking party before the user leaves.
- Warn that provider terms, fees, and issue resolution live outside the search surface.
- Keep special-case caveats close to the action, not hidden only in help text.

Delta in expaify:

- Flight external links can behave like a Google-style provider handoff, but the card does not name the destination provider in the CTA area or aria label.
- expaify has a stronger review pattern available for some flows, but does not apply it consistently to external flight links.
- expaify's external flight caveat only names final price and availability, not provider terms or added fees.

### Booking.com Accommodation Pattern

Booking.com demand API guidance requires accommodation prices to clearly indicate whether taxes and charges are included and whether additional charges may apply. On order preview, it calls for explicit charge display and clarity when the shown price is not the total price. Booking.com consumer FAQ content also teaches that taxes depend on property, room, and local tax requirements, and that cancellation and other policies are shown during the booking process.

Sources:

- https://developers.booking.com/demand/docs/accommodations/display-prices
- https://secure.booking.com/faq.en-us.html?aid=330843

Interaction pattern:

- State the price basis directly next to the amount.
- Use the order preview/review step to distinguish selected rate from total payable.
- Surface taxes, charges, policy, and room/facility limitations before payment or provider commitment.
- Make policy and extra-cost caveats explicit enough that they are testable.

Delta in expaify:

- Hotel cards correctly say `per night before taxes and fees`, and review copy correctly lists taxes, fees, policy, room details, availability, and total due.
- The hotel card CTA note is weaker than the review page and does not tell users what will be checked next.
- Flight cards have no parallel copy for provider terms, baggage/ancillary fees, or final airline/OTA confirmation.

## Exact Gap

Current code has three different trust moments for one user decision:

1. External flight result CTA: direct provider/new-tab handoff with a short secondary warning.
2. Internal Duffel flight CTA: expaify review page with review-only or booking-paused messaging.
3. Hotel CTA: expaify review page, then provider handoff with strong hotel-specific caveats.

The reference patterns do not require one visual style, but they do require one interaction contract: before the user commits to a handoff, the UI must identify the next surface, state what price basis is known, and name what remains provider-controlled.

## Design Directives For UXDES

1. Use one CTA hierarchy for all bookable result cards.
   - Primary action copy must start with `Review`, not `Book`, unless expaify can complete the transaction in-app.
   - Flight internal review: `Review fare`.
   - Flight external provider: either route through review as `Review fare`, or if DEV defers that contract change, use `Continue to provider` and add an adjacent provider-handoff disclosure.
   - Hotel review: `Review hotel`.

2. Put a visible handoff disclosure directly inside the CTA block for every enabled CTA.
   - Flight disclosure must answer: `Current fare from {provider}. Final price, availability, baggage fees, and provider terms can change.`
   - Hotel disclosure must answer: `Nightly rate before taxes and fees. Provider confirms final total, room availability, cancellation policy, and terms.`
   - Disclosure text must be at least `text-xs leading-5`; do not use `text-[11px] leading-4` for the only trust warning.

3. Make link destination explicit for sighted and assistive users.
   - External flight aria label must include `opens provider site in a new tab`.
   - Internal review aria labels must include `opens expaify review`.
   - Hotel result aria label must include `opens expaify review before provider handoff`.
   - The visual CTA block should show either `expaify review` or `provider site` as secondary metadata.

4. Keep disabled states strict and specific.
   - No valid price: disabled label `Price unavailable`; reason `No confirmed price was returned for this result.`
   - No valid provider link: disabled label `Provider link unavailable`; reason `Availability cannot be verified from this result.`
   - Hotel missing either price or link: keep one disabled control, but the reason must name both missing fields when both are absent.

5. Align `/book` review copy with result-card promises.
   - Flight review must explicitly say whether expaify can complete booking, is paused, or will send the user/provider data to a third party.
   - Hotel review must keep the current provider-confirmation warning, but the result card must preview the same categories: final total, availability, cancellation policy, terms.
   - If external flights continue to bypass `/book`, the design spec must mark that as an intentional interim state and provide exact copy for that state.

## Acceptance Criteria For Design

- A first-time user can tell before clicking whether the next step is an expaify review page or a provider site.
- Every enabled CTA has adjacent copy naming at least one fixed value and every provider-controlled variable relevant to that vertical.
- Flight and hotel cards share a consistent review/handoff vocabulary.
- Keyboard and screen-reader users receive the same handoff distinction as sighted users.
- The design spec covers external flight links, internal Duffel review links, hotel review links, price-unavailable states, link-unavailable states, mobile 375px, and desktop 1280px.

## Recommended Next Stage Scope

UXDES should produce a component-level design spec for the CTA block on `FlightCard`, `HotelCard`, and the matching status/action block on `/book`. If the chosen design requires every external flight to pass through `/book`, UXDES should flag a DEV-stage need to extend `BookingFareContext` with a safe provider URL and preserve affiliate markers.
