# UXD-LOCAL-CURRENCY-PAYMENT-01: Local Currency And Payment Clarity Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist

## User Pain Point

An international hotel shopper sees a single USD figure that expaify silently converted, with no disclosure of what currency the provider will actually charge, whether the rate is an estimate, or when payment is taken — so the price they commit to at the OTA or on their card statement can differ from the price that earned their click.

## Who Is Affected And Where

The person affected is a shopper booking a hotel priced in a non-USD market (a Lisbon, Cancún, or Paris property) whose displayed price originated in another currency and was converted to USD inside an adapter, or whose out-of-app OTA checkout will settle in the local currency. They meet this problem three times in the flow:

- **Deal feed (`app/components/ui/DealCard.tsx`, fed by `app/page.tsx` / `lib/pipeline/dealDetection`):** the primary conversion moment. Every card renders `formatMoney(deal.dealPrice)` and `usually formatMoney(deal.medianPrice)`, and the feed data hardcodes `currency: 'USD'` on every row (`app/page.tsx` `rowToCard`, lines 40–41) regardless of the property's real market. The card asserts "expaify never adds fees" but says nothing about conversion or the currency of the eventual charge.
- **Hotel detail (`app/components/HotelCard.tsx`):** the deliberation moment. The collapsed and expanded price block states "per night before taxes and fees", "Rate from {provider}", and "Last-checked time unavailable"; the expanded "Price scope" / "Provider handoff" panel says "Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms." No line addresses currency of charge, conversion provenance, foreign-transaction cost, or payment timing.
- **Outbound booking handoff (`app/book/BookingFlow.tsx`, `HotelHandoffReview`):** the commitment moment, immediately before "Continue to provider". It surfaces a bare `Currency` fact (the ISO code alone, line 189) and tells the user to "Confirm the location, taxes, fees, cancellation policy, room details, and live availability with the provider before payment" — but never states what currency the provider charges in, that the shown figure may be a converted estimate, or whether payment is taken now or at the property.

Both first-time users (no mental model of expaify's conversion behavior) and returning users (who trusted a feed price and feel misled at checkout) are affected, but first-time international shoppers carry the highest trust risk because the surprise lands after they leave the product.

## Measurable Signal

The problem is present wherever a valid, converted, or non-USD-market money value is displayed without the minimum disclosure a shopper needs to predict their actual charge. Concretely, in the current code:

- **Silent conversion with no provenance.** `app/page.tsx` stamps `currency: 'USD'` onto every deal row (`{ priceCents: row.deal_price_cents, currency: 'USD' }`), and the briefing states Travelpayouts trend data is "RUB converted to USD in adapter." So a converted estimate and a native-USD price are visually indistinguishable — both render as `$189 USD` via `lib/money.ts formatMoney`. No card, panel, or handoff string uses the words *estimated*, *converted*, or *approximate*.
- **No currency-of-charge disclosure.** Across `DealCard`, `HotelCard`, and `HotelHandoffReview`, no string tells the shopper which currency the OTA will settle in. `BookingFlow` shows `Currency: USD` as an isolated fact, which reads as a guarantee of the charge currency rather than the display basis.
- **No payment-timing signal.** No surface distinguishes "pay now" from "pay at the property," and no surface warns that an out-of-app OTA may apply dynamic currency conversion (DCC) or that the card issuer may add a foreign-transaction fee. The only payment-adjacent copy — "expaify never adds fees" (`DealCard`) — is technically true of expaify but invites the false inference that no conversion cost exists anywhere in the chain.
- **Formatting divergence hides the basis.** Results render `formatMoney` as localized amount plus trailing ISO code (`$189 USD`, `lib/money.ts`), while `app/book/BookingFlow.tsx` has its own local `formatMoney` that drops the ISO code for USD (`$189.00`, lines 33–42). The moment the shopper is closest to committing, the currency label is weakest.

Downstream measurable UX signals to instrument in UXR/UXDES: (1) **comprehension** — can a user state, after reading the card, what currency they will be charged and whether the figure is exact or estimated; (2) **CTA confidence** — self-reported certainty before tapping "Review hotel" / "Continue to provider"; (3) **reported price mismatch** — rate of "the price was different at checkout / on my statement" complaints tied to converted or non-USD offers.

## Constraints

1. **Presentation and guidance only.** This work must not add currency selection, live FX conversion, DCC handling, or any change to payment processing, charge currency, or the money contract (`{ priceCents: number; currency: string }`, integer minor units, no floats). The deliverable is disclosure and guidance copy plus the structure to carry it — not a pricing feature.
2. **Provider truthfulness, no over-promising.** Disclosure must not imply expaify guarantees an FX rate, a tax/fee-inclusive total, a specific charge currency, or a payment-timing outcome that only the OTA controls. Where expaify cannot know a value (charge currency, pay-now vs pay-at-property, exact converted amount), the copy must say so honestly rather than assert a number — consistent with the existing "Last-checked time unavailable" and "Provider confirms final total" patterns.
3. **Non-regression and mobile integrity.** Any added disclosure must fit the existing token system and layout at 375px and desktop without overlapping text or crowding the price block, must preserve every current component contract and export, and must not weaken the accessible names on the price and CTA elements (`HotelCard` `reviewAriaLabel`, `BookingFlow` handoff `aria-label`).

## Success Statement

This is solved when a first-time international shopper can look at a deal-feed price, open the hotel detail, and reach the booking handoff able to answer "what currency will I actually be charged, is this figure exact or an estimate, and do I pay now or at the property?" without discovering the answer only at the OTA checkout or on their card statement.

## Scope Boundary Versus Adjacent Work

This ticket is **not** a duplicate of `results-currency-localization` (see `docs/pipeline/results-currency-localization/01-discovery.md`). That ticket concerns *internal* same-currency coherence — making the displayed price, Deal Score baseline, and booking review visibly agree they are one currency, and unifying `formatMoney` output. This ticket concerns the *external* shopper interpretation: that the shown currency is a silent conversion, that the currency of the actual charge and the timing of payment are undisclosed, and that these gaps cause post-click price surprise. The formatting divergence is noted here only as a comprehension signal; the disclosure hypothesis, not formatting cleanup, is this ticket's output. UXR must keep the two efforts complementary and avoid re-solving formatting under this ID.

## Handoff Notes For UXR

- Audit the exact currency and payment-timing treatment in: `DealCard` (feed price + "never adds fees" line), `HotelCard` (collapsed price block and expanded Price scope / Provider handoff panel), and `BookingFlow` `HotelHandoffReview` (the `Currency` fact and "before payment" copy).
- Determine which of these the minimum-disclosure set actually needs: (a) a converted/estimate marker when the figure is not native to the property's charge currency, (b) a one-line "charged in {currency} by {provider}; your bank may add a foreign-transaction fee" style guidance, (c) a pay-now vs pay-at-property signal, (d) a DCC caution at the handoff. Pressure-test each against Constraint 2 — expaify may not have the data to state (a) or (c) per offer today; flag any data the DEV stage would need to source before UI can be honest.
- Compare against one or two reference patterns (Booking.com's "This price is converted... you'll pay in {currency}" line; Google's/Expedia's charge-currency + DCC notices) at the interaction-pattern level, not visual style.
- Output a shippable clarity hypothesis: the single minimum disclosure that most reduces reported price mismatch without adding a pricing feature, with comprehension / CTA-confidence / price-mismatch as the measures. Then create `UXDES-LOCAL-CURRENCY-PAYMENT-01`.
