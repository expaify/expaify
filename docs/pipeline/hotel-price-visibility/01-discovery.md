# UXD-HOTEL-PRICE-VISIBILITY-01: Hotel Price Visibility Discovery

Date: 2026-07-02
Stage: UX Discovery
Persona: Senior UX Strategist

## User Pain Point

Hotel cards show a nightly rate but do not make the stay-length and total-price basis visible, so paid users cannot tell from the results list whether a hotel is financially viable before opening details or continuing to review.

## Who Is Affected And Where

First-time and returning hotel search users are affected in the hotel results step, especially when comparing multi-night stays on the Hotels tab.

The current implementation path is `app/page.tsx` rendering `app/components/HotelCard.tsx`. The ticket-listed `components/hotels/HotelResults.tsx` file does not exist in this worktree. Shared hotel data is defined in `lib/types.ts`.

The affected decision moment is the collapsed hotel result card: users see hotel identity, location, quality evidence, Deal Score state, CTA, and a `Nightly rate`, but they do not see the selected stay length or a total-stay amount. Details repeat `per night before taxes and fees` but still do not reconcile the nightly amount to the selected dates.

## Measurable Signal

- `HotelOffer` in `lib/types.ts` has `pricePerNight` and `priceBasis?: 'per_night_before_taxes_fees'`, but no `checkin`, `checkout`, `nights`, `totalPrice`, `taxes`, or `fees` field.
- `app/components/HotelCard.tsx` renders visible copy for `Nightly rate` and `per night before taxes and fees`, but does not render stay length or total stay price in either collapsed or expanded state.
- `app/page.tsx` maps hotel results directly into `HotelCard` without passing selected check-in/check-out dates or night count into the card.
- A code search finds hotel scoring and booking paths built around `pricePerNight`, not total stay cost, which means the results list cannot currently verify whether a multi-night stay fits the user's budget.

## Constraints

1. Price integrity: do not invent taxes, fees, discounts, or final totals that the provider did not return. If only nightly pre-tax pricing is available, the UI must label that boundary plainly.
2. Data contract: money must remain `{ priceCents: number; currency: string }`, and any future stay total must use the same integer minor-unit shape rather than floats or display-only strings.
3. Results usability: the solution must keep hotel cards scannable and usable at 375px mobile and 1280px desktop without overlapping the price, hotel name, quality evidence, Deal Score state, or CTA.

## Success Statement

This is solved when a first-time user can compare hotel results for a selected stay and understand the nightly rate, stay length, and whether a total stay price is unavailable or explicitly provided, without opening details or leaving expaify.
