# UXR-FLIGHT-PRICE-HIERARCHY-01: Flight Price Hierarchy Research

## Source Inputs

- Discovery: `docs/pipeline/flight-price-hierarchy/01-discovery.md`
- Current implementation audited:
  - `app/components/FlightCard.tsx`
  - `components/flights/FlightResults.tsx`
  - `app/components/DealScorePanel.tsx`
  - `app/components/DealBadge.tsx`
  - `lib/types.ts`
  - `app/components/__tests__/scorePresentation.test.tsx`
  - `components/flights/__tests__/FlightResults.test.tsx`
- Next.js app surface docs checked before app-code review:
  - `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`

## Research Question

Can a first-time user scan returned flight cards and identify the current fare first, without losing required context about fare scope, Deal Score, baggage, freshness, and provider handoff risk?

## Current Implementation Audit

### What The Card Does Now

`FlightCard` renders the collapsed card as a two-column grid: itinerary summary on the left and price on the right. The price block uses strong display type, but it is constrained to `minmax(6.75rem, auto)` and right-aligned in a narrow column (`app/components/FlightCard.tsx:267`, `app/components/FlightCard.tsx:477`). At 375px, that means the largest commercial fact shares the first row with route, trip type, carrier, duration, stops, and departure time.

The collapsed state includes:

- Route title and carrier metadata (`app/components/FlightCard.tsx:483`)
- Duration, stops chip, and departure time (`app/components/FlightCard.tsx:489`)
- Price heading, amount, price-scope label, and freshness (`app/components/FlightCard.tsx:267`)
- Baggage estimate row, including estimated total or unavailable warning (`app/components/FlightCard.tsx:301`, `app/components/FlightCard.tsx:515`)
- Deal Score chip (`app/components/FlightCard.tsx:360`, `app/components/FlightCard.tsx:517`)
- Provider/review CTA (`app/components/FlightCard.tsx:521`)
- Full-width details toggle (`app/components/FlightCard.tsx:550`)

This produces a trust-rich collapsed card, but it also gives several secondary facts similar prominence. The most competing elements are the stops chip, baggage row, CTA, and score chip because each uses borders, fills, bold text, or button styling near the fare.

### What The Results Surface Does Now

`FlightResults` already recognizes price as a list-level commercial anchor. On desktop it shows a "Lowest live fare" metric before the result cards (`components/flights/FlightResults.tsx:1005`). Sorting includes "Best deal", "Lowest price", "Shortest duration", and "Lowest est. total" (`components/flights/FlightResults.tsx:1058`), while mobile collapses sort and stop controls into a summary row (`components/flights/FlightResults.tsx:533`).

This means the page has the right comparison model, but the individual card does not reinforce it cleanly. A user can see the lowest fare in the controls, then must re-parse each card because the card presents price, score, bags, and provider action as parallel anchors.

### Data And Contract Constraints

`NormalizedFare.price` is structured as `Money` and `priceScope` distinguishes `per_person` from `party_total` (`lib/types.ts:1`, `lib/types.ts:3`, `lib/types.ts:41`). The card currently preserves this distinction with "Traveler fare" versus "Passenger total" and scope copy (`app/components/FlightCard.tsx:450`). That copy must remain visible enough to prevent false total-price comprehension.

Deal Score is intentionally present but collapsed. Tests assert that the collapsed card shows the verdict chip while keeping percentile and explanation in details (`app/components/__tests__/scorePresentation.test.tsx:94`). This pattern is correct for scan density and should be preserved.

## Reference Pattern Comparison

### Google Flights

Google Flights exposes flight comparison as a tradeoff between fare and convenience. Its help docs describe filtering by cabin, airlines, and stops, plus browsing "Best" or "Cheapest" tabs and sorting by Top Flights, Price, Duration, and Departure Time. Google defines Top Flights around price, duration, stops, and layover changes rather than treating all facts as equal in every result row: https://support.google.com/travel/answer/2475306

Observed pattern for expaify: keep the collapsed result optimized for fast price comparison, then let convenience details qualify the fare. Filters and secondary facts support the price decision; they should not visually compete with the fare amount.

### Booking.com Flights

Booking.com's flight pages position the task as comparing flights, airlines, and prices in one place, with "no hidden fees" and clarity about what the traveler pays: https://www.booking.com/flights/index.html

Observed pattern for expaify: price clarity is not only the amount. The collapsed card needs amount plus minimal scope clarity, while hidden-fee and provider-risk explanations can be available nearby or in details. Trust copy should reduce ambiguity, not become the first-read content.

## Exact Gap

The current app already has the necessary data and trust states, but the collapsed card hierarchy is over-specified.

- Current code: price is a strong text treatment but lives in a narrow right column with scope and freshness copy underneath (`app/components/FlightCard.tsx:267`).
- Reference pattern: result rows make fare comparison the primary commercial decision, with schedule, stops, baggage, and quality markers qualifying the fare.
- Delta: expaify should make the fare amount and scope the dominant first-read object, keep Deal Score as the second decision object, and move verbose trust or baggage explanations out of the collapsed scan path unless they materially change the price.

## Design Directives For UXDES

1. Make the collapsed card's primary hierarchy: price amount first, price scope second, Deal Score third, itinerary fourth, provider action fifth. At 375px, the price block must not be constrained to a narrow side column; it should have enough inline or stacked space that `$450.01 USD` and "total for 2 adults" can be read before route metadata.

2. Use exact collapsed price labels:
   - `Current fare` as the stable heading for valid prices.
   - `per traveler` when `priceScope` is `per_person`.
   - `total for {n} adult(s)` when `priceScope` is `party_total`.
   - Do not use both "Traveler fare" and "per person fare for this trip" in the collapsed state; keep the longer explanation in details.

3. Keep freshness visible but demote it to trust metadata. Collapsed freshness should be one short line only, such as `Checked 2 days ago by Travelpayouts`; detailed provider-change copy belongs in the expanded details panel.

4. Baggage should only compete with price when it changes the comparison amount. If an estimate is available, collapsed copy should show `With bags: {amount}` or `Bags unavailable`; the detailed count and confidence explanation should move to details. Loading baggage should not occupy the same visual weight as a confirmed fare.

5. Deal Score should remain collapsed as a compact chip beside or directly below the price group. The collapsed card should show `Great`, `Good`, `Typical`, `Limited history`, `Score pending`, or `Score unavailable`, but percentile, median, explanation, and low-confidence rule stay in `DealScorePanel` details.

6. Itinerary facts in the collapsed state should be limited to route, departure time/date, duration if provider-confirmed or partial, and stops. Carrier, cabin, layover warnings, baggage policy explanation, provider handoff warning, and full return schedule should be available in details unless required for a disabled CTA.

7. CTA copy should not be the strongest visual element on the card. Keep `Review fare`, `Continue`, `Price unavailable`, and `Link unavailable` short in the collapsed state, with the full accessible `aria-label` preserving provider-risk details.

## Testable Acceptance Notes For UXDES

- A 375px card with `priceScope: party_total`, `passengerCount: 2`, and `$450.01 USD` shows the amount and `total for 2 adults` before baggage, score, CTA, or details copy in visual reading order.
- A valid `per_person` fare shows `Current fare`, formatted money, and `per traveler` in the collapsed card.
- A low-confidence Great score still renders as `Limited history`, not `Great`.
- Baggage loading does not create a large warning-like row that visually outranks the confirmed fare.
- A missing price state still says `Price unavailable` and explains that no confirmed price was returned.
- Keyboard focus remains visible on the CTA and details toggle.
- Desktop 1280px may use columns, but the price block remains the dominant scan anchor for each card.

## Out-Of-Scope Findings

- The flight card uses remote airline logo images from `https://images.kiwi.com` directly in the component (`app/components/FlightCard.tsx:250`). This is existing behavior and outside this hierarchy research ticket.
- The UXR stage did not run visual browser checks or make code changes. Those belong to UI and TEST stages.
