# UXD-TOTAL-STAY-COST-01: Total Stay Cost Transparency Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist

## User Pain Point

Hotel shoppers see only a per-night rate — with an explicit "before taxes and fees" disclaimer — at every step from the deals feed through the deal detail page to the outbound booking CTA, so they cannot state what a stay will actually cost before they leave expaify for a provider.

## Who Is Affected And At What Step

Paid users browsing the hotel deals feed (`app/deals/DealFeed.tsx` → `app/components/ui/DealCard.tsx`) and live hotel search results (`app/page.tsx` → `app/components/HotelCard.tsx`) are affected first, where the visible number is a nightly rate with no stay-length multiplier and no fee context. The same gap continues onto the deal detail page (`app/deals/[dealId]/page.tsx`), which does know `nights` and displays it as a standalone "Stay details" fact but never combines it with price, and into the outbound CTA moment (`CompareRow` links on the card and detail page, and the hotel "Review hotel" handoff in `app/book/BookingFlow.tsx`), where the user commits to leaving expaify still holding only a nightly number.

## Current Implementation Signal

- `HotelOffer` (`lib/types.ts:137`) carries only `pricePerNight: Money` and an optional `priceBasis?: 'per_night_before_taxes_fees'`. There is no `nights`, `totalPriceCents`, `taxes`, `resortFee`, `payAtProperty`, or any total-stay-cost field anywhere in the shared types. The `DealRow` shape used by the feed (`lib/pipeline/dealDetection.ts:166`) does carry `nights`, but nothing in the codebase ever multiplies `nights` by the nightly price or stores/labels a total.
- `app/components/ui/DealCard.tsx:134-149` renders `{formatMoney(deal.dealPrice)} / night` with a strikethrough median "usually" comparison — both per-night, both silent on stay length or fees.
- `app/deals/[dealId]/page.tsx:404-416` renders `nights` as an isolated "Stay details" fact (`Fact label="Nights"`) far below the price block (`app/deals/[dealId]/page.tsx:314-334`), which separately states "Nightly rate before taxes and fees. Taxes, fees, cancellation policy, and final total are confirmed by the provider." The page has both numbers in scope on the server but never reconciles them into an expected total or an explicit "total unavailable" state.
- `app/components/HotelCard.tsx:34-49` and its expanded "Price scope" panel (`app/components/HotelCard.tsx:571-579`) repeat "per night before taxes and fees" as the only price-basis copy; there is no resort-fee or pay-at-property language anywhere in the component.
- `app/book/BookingFlow.tsx:82` and `:486` reuse the identical "per night before taxes and fees" label and a generic disclosure — "Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms" — at the last expaify-controlled screen before handoff. This is the most consequential moment for cost surprise and it still offers no numeric estimate, only a disclaimer.
- No hotel provider adapter returns tax, resort-fee, or pay-at-property data. `lib/providers/hotellook.ts` only ever normalizes `priceFrom` into `pricePerNight` (`lib/providers/hotellook.ts:383-394`, `:469`); Amadeus and Kiwi hotel paths are stubbed. There is currently no upstream data source this feature could read from without a provider-adapter change.
- Outbound links (`app/components/ui/CompareRow.tsx:21-58`) have no click handlers or analytics instrumentation at all — no `onClick`, no `track()` call. `lib/analytics.ts` is a `console.debug`-only stub in development with no real event pipeline. There is also no support/report-ticket surface anywhere in `app/` or `lib/` (`find` for `*support*`/`*report*` returns nothing). This means the ticket's proposed measurement signal — fee-related support/report events, CTA hesitation, and outbound click drop-off after price expansion — is not observable today; none of the three signals has instrumentation to read from.

## Measurable Signal

The problem is confirmed to exist by the absence of instrumentation, not by traffic data, because none exists yet:

1. **No total-cost data model.** `grep` across `lib/types.ts` and every hotel provider adapter finds zero fields for stay total, taxes, resort fees, or pay-at-property charges. The UI cannot show what the data layer cannot represent.
2. **No outbound-click instrumentation.** `CompareRow` and the `HotelCard` "Review hotel" CTA fire no analytics event, so drop-off after a user expands price details cannot currently be measured — this is a dependency gap, not a metric that already exists and shows a problem.
3. **No support/report channel.** There is no ticket or feedback surface in the app, so "fee-related support/report events" is aspirational instrumentation, not a data source that exists today.
4. **Direct code evidence of the gap.** Every hotel price surface (`DealCard`, `HotelCard`, deal detail page, `BookingFlow`) independently repeats "per night" / "before taxes and fees" copy while withholding the one number (`nights`) needed to compute an expected range, even where that number is already in scope on the same page (`app/deals/[dealId]/page.tsx`).

This closely follows a related, unresolved discovery: `docs/pipeline/hotel-price-visibility/01-discovery.md` and its research brief `docs/pipeline/hotel-price-visibility/02-research.md` (2026-07-02) already audited `HotelCard`'s missing stay-length display and recommended a `N-night stay` / `Total not returned by provider` pattern, but that work stopped after research — no `03-design.md` exists, and its scope was limited to the live-search `HotelCard`, not the deals feed, deal detail page, or fee-specific (taxes/resort fee/pay-at-property) transparency this ticket covers.

## Constraints

1. **Hotels-first MVP, no new checkout.** expaify does not process hotel payment; the deal feed → detail → CTA flow ends in a provider handoff (`CompareRow` links, `buildHotelBookingHref`). Any solution must improve pre-handoff transparency without building a checkout, cart, or price-lock flow.
2. **Use available rate metadata or clear fallback copy when fee data is missing.** No hotel provider currently returns taxes, resort fees, or pay-at-property charges (see above). The solution cannot invent a total; where a stay-length multiplier is computable (`pricePerNight * nights`) it must be labeled as an estimate excluding taxes/fees, never presented as a confirmed total — consistent with the existing "before taxes and fees" honesty pattern already in the codebase.
3. **Data integrity and money contract.** Any new or derived total must stay `{ priceCents: number; currency: string }` — never a float or display-only string — and must not silently overwrite or replace `pricePerNight`, which downstream Deal Score scoring depends on (`lib/scoring/scoreDeal.ts` scores nightly rate, not stay total).

## Success Statement

This is solved when a first-time user can state the nightly rate, the number of nights, and an estimated stay subtotal (or an explicit "fee and total data not available from this provider" fallback) before clicking through to a provider, without needing to open hotel details or leave expaify to do the math themselves.

## Handoff Notes For UXR

- Build on, don't repeat, `docs/pipeline/hotel-price-visibility/02-research.md` — it already covers the `HotelCard` stay-length gap in depth. This ticket's research should extend that work to the deals feed (`DealCard`, `DealFeed`) and deal detail page, and add the fee-transparency angle (taxes, resort fees, pay-at-property) that the prior research explicitly scoped out.
- Research questions to answer: (a) what is the safest, most honest way to present `pricePerNight * nights` as an estimate without implying it's a confirmed total; (b) what fallback copy pattern should apply uniformly across `DealCard`, deal detail, `HotelCard`, and `BookingFlow` when fee data is absent (which is always, today); (c) whether any hotel provider Terms of Service would allow surfacing typical resort-fee ranges by market/brand as a disclosed estimate versus provider-sourced fact.
- Prototype assumption to validate: that a computed subtotal (nightly × nights) clearly labeled "before taxes and fees" is net-positive for trust versus the status quo of showing nights and price as disconnected facts — this should be checked against the Booking.com/Google Hotels pricing-disclosure patterns the prior research already reviewed.
- Fee-data dependency note: no current provider (`hotellook`, stubbed `amadeus`, stubbed `kiwi`) returns tax, resort-fee, or pay-at-property fields. If research concludes real fee data is required (not just a labeled estimate), that is a DEV-stage provider-adapter dependency, not a UI-only fix, and should be flagged as such in the research brief's acceptance criteria.
- Instrumentation dependency note: the ticket's proposed success metrics (fee-related support/report events, CTA hesitation, outbound click drop-off after price expansion) have no existing data source. `lib/analytics.ts` is a no-op stub and there is no support/report surface in the app. Flag this as a measurement dependency in the research brief rather than assuming the signal is already observable.

## Out Of Scope Findings

- `lib/analytics.ts` being a `console.debug`-only stub with no real event pipeline is a pre-existing gap affecting every feature, not specific to this ticket. Not fixed here.
- The absence of any support/report ticket surface in the app is a pre-existing gap. Not fixed here.
- Flight baggage-fee transparency (`docs/pipeline/baggage-fee-decision-context/`) is an analogous but separate, already-scoped flight-side problem. Not addressed here.
