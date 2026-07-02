# UXD-TRIP-INSPIRATION-PAID-INTENT-01: Trip Inspiration Paid Intent

## User Pain Point

Paid users may see trip inspiration as generic editorial content instead of actionable premium deal entry points that preserve their origin, set a plausible trip window, and lead directly into live fare and hotel verification.

## Affected Users And Flow Step

- **Who is affected:** Paid or purchase-intent users who arrive with an origin but no fixed destination and need expaify to help them decide where to search next.
- **Flow step:** Search form and pre-results discovery, specifically the inspiration rail in `components/search/TripInspirationRail.tsx`, its form wiring in `components/search/SearchPanel.tsx`, static route suggestions in `app/page.tsx`, and recommendation data from `lib/search/tripInspiration.ts`.
- **Trust risk:** Inspiration cards show themes, destination names, loose date windows, and "From" price hints, but the UI does not clearly state whether selecting a card starts a premium deal search, verifies live prices, or simply fills form fields.

## Measurable Signal

This problem exists when a paid-intent user cannot tell from the inspiration surface what will happen after selecting a suggestion or why the suggestion is worth acting on.

Observable QA and product signals:

1. `components/search/TripInspirationRail.tsx` renders cards under the heading "Trip ideas" with theme, destination, month, nights, and a static "From" price hint, but no visible promise that the next step will check live fares, hotels, or Deal Score.
2. Selecting an inspiration card in `components/search/SearchPanel.tsx` populates origin, destination, dates, round-trip type, and flexible dates, but it does not submit the search or provide a visible confirmation that the populated route is ready for live verification.
3. `lib/search/tripInspiration.ts` stores fixed `priceHintUsd` values and template labels such as "Museum weekend" or "Island reset"; the current rail does not display the template label, freshness, or whether the hint is historical, estimated, or live.
4. The main page in `app/page.tsx` shows separate "Route suggestions" that only set origin and destination. They do not set dates, flexible mode, or search intent, and they use generic support copy such as "Popular route" and "Deal history ready."
5. The two suggestion patterns are not visibly unified: one is "Trip ideas" inside a search panel and one is "Route suggestions" below the form. A user can reasonably interpret both as lightweight browsing content rather than premium deal-search entry points.

## Constraints

1. **Trust and data integrity:** Inspiration copy must not imply a live fare, guaranteed availability, or confirmed Deal Score until the user runs a provider-backed search. Static `priceHintUsd` values must be labeled conservatively or de-emphasized.
2. **Search continuity:** Any inspiration interaction must preserve valid search state: origin, destination, date range, trip type, flexible dates, passengers, and intended flights/hotels/trip mode without causing invalid-date or missing-field errors.
3. **Performance and provider boundaries:** The discovery surface must not add blocking vendor calls or call provider APIs from components. Live verification must continue through existing search/API/provider paths.
4. **Accessibility and responsive usability:** Inspiration entry points must be keyboard-operable, screen-reader clear, and usable at 375px mobile and 1280px desktop without hidden intent, clipped essential copy, or horizontal-only discovery that masks the primary action.

## Success Statement

This is solved when a paid-intent user can choose an inspiration suggestion from the search flow and understand that it is a prefilled premium deal search entry point, then proceed to live fare or trip verification without mistaking a static suggestion or price hint for a confirmed deal.

## Downstream Focus

The research stage should audit how the current inspiration rail and route suggestions communicate action, pricing certainty, and search handoff. It should define testable directives for:

- Whether inspiration cards should fill only the form, trigger search, or expose a clear "ready to search" state.
- How static price hints should be labeled relative to live fares and Deal Score.
- How trip inspiration and route suggestions should share one hierarchy or be deliberately separated.
- What copy confirms premium intent without overclaiming availability or price accuracy.
- How mobile and keyboard users discover and activate the same entry points.
