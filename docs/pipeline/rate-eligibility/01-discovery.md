# UXD-RATE-ELIGIBILITY-01: Hotel Rate Eligibility Clarity Discovery

Date: 2026-07-22  
Stage: UX Discovery  
Priority: P0  
Persona: Senior UX Strategist

## Problem Statement

A traveler can move from a hotel result through expaify's review and into the provider handoff without knowing whether the displayed rate is restricted to members, residents, particular ages, or a non-refundable commitment, so an apparently valid price can become ineligible or unacceptable only after the traveler has chosen it.

## Who Is Affected And Where

First-time and returning hotel shoppers are affected at the decision boundary between the live hotel result and room/rate selection:

1. **Results:** `app/components/HotelCard.tsx` enables **Review hotel** when the offer has a valid integer-cent nightly price and provider URL. Eligibility is not part of that gate.
2. **expaify review:** `app/book/BookingFlow.tsx` preserves hotel identity, location, provider, nightly rate, currency, price basis, and offer reference, then tells the traveler that the provider will confirm cancellation policy and terms.
3. **Provider room/rate selection:** **Continue to provider** opens the affiliate deeplink in a new tab. This is the first point at which a traveler may discover that the advertised price requires membership, qualifying residency, an age condition, or acceptance of a non-refundable rate.
4. **Return/reversal:** after discovering the restriction, the traveler must abandon the provider flow, return to expaify, and restart comparison without expaify knowing why.

The problem is not that expaify lacks a full room-selection product. It is that the last expaify-controlled decision signal describes a price as selectable while its eligibility is completely unknown.

## Current-State Evidence

- **The normalized offer cannot represent eligibility.** `HotelOffer` in `lib/types.ts` includes hotel identity, location, class/rating evidence, `pricePerNight`, price basis, photo, source, and deeplink. It has no member-rate, residency, age, refundability, cancellation, or general restriction field.
- **The active supplier payload has no rate restrictions to map.** `HotelLookCacheEntry` in `lib/providers/hotellook.ts` contains property-level identity, location, stars, `priceFrom`, photo, and property type. The adapter turns the lowest property price into a `HotelOffer`; it does not receive a room/rate plan or eligibility attributes.
- **CTA eligibility means only price plus link validity.** `HotelCard` sets `canBook` from `isValidBookingUrl(hotel.deeplink) && isValidMoney(hotel.pricePerNight)`. A rate with unknown restrictions therefore receives the same **Review hotel** action as an unrestricted rate.
- **The review carries no eligibility context.** `BookingHotelContext` in `lib/booking/config.ts` carries offer/provider identity, hotel name/location, nightly price, currency, price basis, and provider URL only. The review shows a generic statement that the provider confirms cancellation policy and terms; it cannot distinguish a known restriction, an unrestricted rate, and a supplier that supplied no eligibility data.
- **No alternative hotel supplier currently closes the gap.** `bookingComRapidApi.ts` implements a flight provider and deliberately leaves response mapping unfinished. Hotellook is the only active hotel adapter in the search flow, and it is property-price rather than room-rate inventory.

This means eligibility coverage is currently **0% of normalized hotel offers**, not because every rate is unrestricted, but because the contract has no way to say whether a restriction exists or whether the supplier omitted the information.

## Behavioral Baseline And Measurement Gap

The requested eligibility-related abandonment and booking-handoff reversal rates cannot be truthfully quantified from this repository today:

- `lib/analytics.ts` only writes `console.debug` in development; it does not send production events.
- Neither **Review hotel** nor **Continue to provider** records an event.
- The provider opens in a new tab, but there is no return event, reason capture, or feedback control that could identify an eligibility-driven reversal.

The defensible baseline is therefore:

| Signal | Current baseline | What must be measured before/after a repair |
| --- | --- | --- |
| Offers with known eligibility state | 0% representable | Share of displayed rates marked `restricted`, `unrestricted`, or `not provided`, segmented by supplier |
| Result-to-review abandonment | Not instrumented | `hotel_result_viewed` → `hotel_review_opened`, segmented by eligibility state/type |
| Review-to-provider abandonment | Not instrumented | `hotel_review_opened` → `hotel_provider_handoff_clicked`, segmented by eligibility state/type |
| Booking-handoff reversal | Not instrumented | Provider handoff followed by return to the same search/session without a new handoff; pair with a lightweight reason prompt so eligibility is not inferred from return alone |
| Confirmed eligibility invalidation | No reporting path | User-selected reason such as member rate, residency, age, or non-refundable restriction after provider return |

UXR must not treat a tab return as proof of an eligibility failure: price change, sold-out inventory, room mismatch, fees, or simple comparison behavior can produce the same event. A reversal becomes eligibility-related only when the supplier returns a structured invalidation reason or the traveler explicitly identifies the restriction.

## MVP Scope

The MVP is a concise, attributed eligibility signal for the single displayed hotel rate, using **supplier-provided rate attributes only**:

- Member-only pricing or required loyalty/account membership
- Residency/geographic qualification
- Minimum/maximum age or age-band qualification
- Non-refundable status when supplied as a rate attribute

The signal must distinguish three states: **restriction supplied**, **supplier explicitly indicates no restriction**, and **eligibility not provided**. Absence of a field must never be translated into “no restrictions.”

This ticket does not authorize inferred eligibility, scraping the provider landing page, asking travelers to self-qualify, building room inventory or multi-rate comparison, changing price/scoring logic, or presenting cancellation deadlines and penalty schedules beyond the supplier-provided non-refundable eligibility flag. Detailed room, bed, meal, and cancellation-policy clarity remains owned by `docs/pipeline/room-rate-clarity/`.

## Constraints The Solution Must Respect

1. **Supplier provenance and data honesty.** Display only rate-level attributes returned by a hotel supplier through `lib/providers`; preserve the supplier source and an explicit `not_provided` state. Never infer eligibility from price, hotel name, geography, deeplink text, or missing data.
2. **Existing contracts and handoff integrity.** Any new data must remain inside `Result<T>`, preserve integer-minor-unit money and affiliate-marked provider URLs, and travel with the selected offer from provider normalization through `HotelOffer`, `BookingHotelContext`, the result card, and the review page without changing meaning.
3. **Decision clarity without new booking scope.** Use one concise, text-based signal that remains usable at 375px and 1280px, is understandable without color, and does not imply that expaify has validated traveler identity or can guarantee acceptance. Keep provider verification and the external room-selection handoff intact.

## Success Statement

This is solved when a first-time user can identify, before selecting **Continue to provider**, whether the displayed rate has a supplier-provided membership, residency, age, or non-refundable restriction—or that eligibility was not provided—without having an apparently unrestricted rate invalidated only after reaching provider room selection.

## UXR Handoff Focus

`UXR-RATE-ELIGIBILITY-01` should:

1. Validate which rate-level eligibility attributes prospective hotel suppliers actually return and how they distinguish unrestricted from omitted data; Hotellook cannot support a populated MVP today.
2. Compare Booking.com and one similar hotel flow at the interaction-pattern level: where restrictions appear in results, rate selection, and the final pre-handoff decision.
3. Define 3–5 testable directives for the three eligibility states, exact restriction hierarchy/copy rules, and behavior when multiple restrictions apply.
4. Specify an honest measurement design for result → review → provider handoff → explicit eligibility reversal, without attributing generic tab returns to eligibility.

## Out-Of-Scope Findings

- The generic provider-confirmation copy also defers taxes, fees, room availability, and detailed cancellation policy. Those are real adjacent trust gaps, but they are covered by existing room-rate and total-stay-cost pipeline work and are not resolved here.
- Production analytics is absent across the app, not only for hotel eligibility. This discovery records the measurement dependency but does not implement analytics.
- No current provider can populate the proposed eligibility signal. Downstream design may define the honest `not provided` state, but a populated state requires a future supplier contract that returns explicit rate attributes.
