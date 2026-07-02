# UXD-FLIGHT-PRICE-HIERARCHY-01: Flight Price Hierarchy

## Problem Statement

Flight result cards make the current fare compete with route, timing, stops, baggage, Deal Score, freshness, and provider-action details, so paid-intent users need extra scanning time to decide whether an option is worth opening.

## Affected Users And Flow Step

- **Users affected:** First-time and returning flight deal seekers comparing returned fares, especially users sorting by price or Deal Score who need to quickly judge whether the displayed fare is the best live option.
- **Flow step:** Flight results review after a search returns inventory, before the user expands details or follows the provider/review CTA.
- **Affected source inspected:** `app/components/FlightCard.tsx` renders the card price, itinerary summary, baggage row, score chip, details toggle, and CTA; `components/flights/FlightResults.tsx` renders the surrounding summary metrics, sort/filter controls, baggage controls, and result grid; `lib/types.ts` defines `NormalizedFare.price`, `priceScope`, `passengerCount`, itinerary fields, and `DealScore`.

## Measurable Signal

This problem exists when a returned flight has a valid `NormalizedFare.price`, but the visible card does not make that fare the dominant first-read decision object relative to secondary itinerary and trust details.

Primary measurable UX signals:

- On a 375px result card, the price appears in a compact right column while route/carrier, trip type, stops, departure time, baggage estimate, Deal Score, CTA, and details affordance all appear in the same collapsed card state.
- On desktop, `FlightResults` already surfaces "Lowest live fare" in the results controls, but each `FlightCard` still distributes price attention across similarly weighted neighboring modules instead of reinforcing price as the card's primary scan anchor.
- The price uses strong display type, but the card also shows multiple bold or high-contrast elements near it: route title, stops chip, baggage estimate label, score chip, and CTA. This creates competing visual anchors before the user can answer "what is the fare?"
- Price context copy is necessary but verbose in the primary state: labels such as "Traveler fare", "per person fare for this trip", and freshness copy sit directly under the amount, increasing the text block users must parse before comparing cards.
- Users comparing 3+ returned fares must scan multiple secondary facts per card before deciding whether the fare is cheap enough to expand, continue, or ignore.

## Constraints

1. **Trust and data integrity:** Preserve money formatting through `Money` (`{ priceCents: number; currency: string }`), keep price scope visible enough to prevent per-person versus party-total confusion, and do not hide unavailable-price states.
2. **Deal Score differentiation:** Price must become the first-read anchor without burying Deal Score, confidence, or score-unavailable states, because expaify's value is whether the fare is actually good against route history.
3. **Responsive accessibility:** The hierarchy must work at 375px mobile and 1280px desktop with readable text, stable tap targets, keyboard-visible controls, and no overlap between price, route, CTA, score, and baggage states.

## Success Statement

This is solved when a first-time user can scan returned flight cards, identify the current fare and its price scope first, and decide which option deserves deeper review without the fare competing with secondary itinerary or provider details.

## Handoff Notes For UXR

- Audit the collapsed `FlightCard` hierarchy at 375px and desktop, including price, price scope, freshness, route, stops, duration, baggage estimate, Deal Score, CTA, and details toggle.
- Compare against flight-result list patterns that use price as the primary commercial anchor while keeping schedule and trust facts scannable.
- Define which price-adjacent copy must remain in the collapsed state versus which can move into details or supporting context without weakening trust.
