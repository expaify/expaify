# UXD-PROVIDER-FRESHNESS-TIMESTAMP-CLARITY-01: Provider Freshness Timestamp Clarity

## Pain Point

Paid users see fares and hotel rates that may be time-sensitive, but the results UI does not clearly state when each provider price was fetched, which weakens trust at the booking decision moment.

## Affected Users And Flow Step

- **Who is affected:** Paid users comparing flight and hotel results who need to decide whether a displayed price is recent enough to trust before clicking into booking or provider handoff.
- **Flow step:** Results review, specifically flight result cards, hotel result cards, and the flight results summary/filter area before booking review or external provider handoff.
- **Trust risk:** A user can see a Deal Score, current fare, or nightly rate without knowing whether the underlying provider price was fetched seconds ago, minutes ago, or from an older cached provider response.

## Measurable Signal

This problem exists when a result card with provider-backed pricing does not answer both of these questions near the price or provider handoff:

1. **Who returned this price?** The provider/source responsible for the displayed fare or hotel rate.
2. **How fresh is this price?** A readable fetched-at timestamp or relative freshness label that tells the user when expaify last confirmed the offer.

Observable QA signals from the current implementation:

- `lib/types.ts` includes `NormalizedFare.source` and `NormalizedFare.fetchedAt`, so flight provider and freshness data exist in the shared flight type.
- `app/components/FlightCard.tsx` uses `fare.source` for provider handoff copy, but it does not display `fare.fetchedAt` anywhere in the collapsed card, expanded details, CTA note, or aria label.
- `components/flights/FlightResults.tsx` summarizes count, lowest live fare, Great deals, and nonstop options, but does not expose the newest, oldest, or per-provider freshness of the returned fares.
- `app/api/search/route.ts` streams flight chunks with a `source` and `NormalizedFare[]`; freshness depends on each fare object, but the response-level UI state does not make that freshness visible.
- `lib/types.ts` defines `HotelOffer.source` but does not define a hotel `fetchedAt`, and `app/components/HotelCard.tsx` does not show provider name or freshness near the nightly rate or provider handoff.

## Constraints

1. **Data integrity:** Freshness copy must be derived from provider data already carried by the normalized result objects, and hotel freshness must not be invented when no timestamp exists.
2. **Trust and compliance:** Copy must avoid implying price guarantees; it should clearly separate "last checked by expaify" from "final price confirmed by provider."
3. **Accessibility:** Freshness must be available to screen reader users in the same decision context as the price and CTA, not only as visual-only metadata.
4. **Performance:** The solution must not add a blocking provider re-check or extra network request before results render; cached provider responses remain acceptable when labeled clearly.
5. **Mobile usability:** The freshness indicator must fit on 375px result cards without crowding the price, Deal Score, or primary CTA.

## Success Statement

This is solved when a first-time paid user can compare a flight fare or hotel rate in results and understand who supplied the price and when expaify last checked it, without assuming the displayed amount is final or freshly confirmed at click time.

## Downstream Focus

The research stage should audit how provider and freshness metadata should appear across:

- Flight card collapsed and expanded states.
- Hotel card collapsed and expanded states, including whether the normalized hotel type needs a real freshness field.
- Flight results summary metadata for multi-provider searches.
- Loading, stale, missing timestamp, and provider-unavailable states.
