# UXD-RESULTS-CURRENCY-LOCALIZATION-01: Results Currency Localization Discovery

Date: 2026-07-02
Stage: UX Discovery
Persona: Senior UX Strategist

## User Pain Point

Currency display can erode trust when flight results, hotel results, Deal Score context, and booking review do not clearly show that the visible price and comparison basis use the same currency.

## Who Is Affected And Where

First-time and returning deal seekers are affected while comparing search results and again during booking review, especially when a provider returns non-USD inventory, converted Travelpayouts trend data, or mixed flight and hotel offers.

The affected flow steps are:

- **Flight results:** `app/components/FlightCard.tsx` displays the current fare, baggage estimate, Deal Score panel, and provider CTA.
- **Hotel results:** `app/components/HotelCard.tsx` displays nightly rate, Deal Score panel, and provider handoff.
- **Booking review:** `app/book/BookingFlow.tsx` restates the selected flight fare or hotel nightly rate before provider verification or handoff.
- **Shared money and FX contract:** `lib/money.ts`, `lib/fx/convert.ts`, and `lib/types.ts` define money shape, formatting, score currency, and RUB-to-USD conversion behavior.

The trust risk appears when users ask, "Is this fare, score, and booking review all in the same currency?" and the interface makes them infer the answer from repeated currency suffixes, booking facts, or hidden adapter behavior.

## Measurable Signal

This problem exists when a result or booking review includes a valid money value but the screen does not provide a single, explicit currency basis that covers the displayed price, Deal Score comparison, and provider handoff.

Primary measurable UX signals:

- `lib/money.ts` formats result money as localized currency plus a trailing ISO code, for example `$250 USD`, while `app/book/BookingFlow.tsx` has a separate local `formatMoney(cents, currency)` implementation that displays USD as `$250.00` without the trailing ISO code.
- `lib/fx/convert.ts` converts RUB trend data to USD cents but returns only a number, so the conversion basis is not represented as structured money at the conversion boundary.
- `lib/types.ts` allows `NormalizedFare.price.currency`, `HotelOffer.pricePerNight.currency`, `PricePoint.currency`, and `DealScore.currency` to exist independently, but no type links the live price currency to the score baseline currency or conversion provenance.
- `FlightCard` and `HotelCard` show price basis copy such as `per person fare for this trip` or `per night before taxes and fees`, but do not add explicit copy that the Deal Score comparison is using the same currency as the displayed price.
- `BookingFlow` shows a selected fare or nightly rate and sometimes a separate `Currency` fact for hotels, but flight booking review does not expose currency as its own fact and uses different formatting from the results cards.

## Constraints

1. **Money integrity:** All displayed and compared prices must preserve the existing `{ priceCents: number; currency: string }` contract and must not introduce floats, display-only converted amounts, or ambiguous bare numbers.
2. **Provider truthfulness:** The UI must not imply a final provider charge, tax/fee-inclusive hotel total, or guaranteed FX rate when the provider has only returned a live fare, nightly pre-tax rate, or converted baseline data.
3. **Deal Score trust:** Any solution must keep the Deal Score understandable as a same-currency comparison against route or stay history, and must clearly handle cases where the score currency and live price currency are unavailable or mismatched.

## Success Statement

This is solved when a first-time user can compare a flight or hotel result, read its Deal Score, and enter booking review without wondering whether the shown price, normal-price comparison, and provider handoff are using different currencies.

## Handoff Notes For UXR

- Audit the visible currency treatment in collapsed and expanded flight cards, hotel cards, Deal Score panels, and booking review summaries.
- Identify whether the product needs a single currency-basis line, stricter same-currency score rules, conversion provenance copy, or consistent formatting across results and booking.
- Pay special attention to mixed-provider cases where Travelpayouts baseline data may be converted to USD while live fares or hotel offers may carry another provider currency.
