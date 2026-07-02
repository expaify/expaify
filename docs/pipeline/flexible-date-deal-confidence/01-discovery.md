# UXD-FLEXIBLE-DATE-DEAL-CONFIDENCE-01: Flexible Date Deal Confidence

## User Pain Point

Paid users searching fixed travel dates cannot tell whether expaify checked nearby dates before labeling a fare as `Great`, `Good`, or `Typical`, which weakens trust in the Deal Score when dates are flexible enough to change the recommendation.

## Affected Users And Flow Step

This affects paid flight-search users at the results step after entering an origin, destination, departure date, and optional return date. The highest-risk moment is when a user reviews scored flight cards or the results summary after either leaving `Flexible dates` off or selecting `Flexible dates` without seeing which nearby dates were actually included in the confidence basis.

## Measurable Signal

The current implementation has measurable confidence gaps:

- `app/page.tsx` sends `flex=1` only when the user enables flexible dates, and `/api/search` expands Travelpayouts to a +/-3 day departure window, but the results UI does not summarize the date window that was checked.
- `components/flights/FlightResults.tsx` shows the count of `Great deals` with the copy `Ranked well against recent route history.`, but does not say whether nearby dates were checked, skipped, or partially unavailable.
- `app/api/calendar/route.ts` returns route-level calendar trend prices as a plain date-to-price map, so the UI cannot distinguish "nearby date comparison unavailable" from "no cheaper nearby dates found."
- `lib/deals/pricePulse.ts` summarizes route movement over time, not flexible-date coverage for the user's selected itinerary, so price movement confidence and nearby-date confidence can be conflated.

## Constraints

1. Deal Score trust must remain honest: never imply nearby dates were checked unless provider-backed data was actually queried and returned; never upgrade a thin-data score into a stronger verdict because of a flexible-date label.
2. Performance must stay bounded: any nearby-date confidence signal must respect existing provider caching and avoid blocking live fare results on slow or failed secondary date checks.
3. Accessibility and scanability must hold at 375px mobile and 1280px desktop: confidence language must be readable, keyboard reachable if interactive, and must not add dense calendar clutter to the primary results scan.

## Success Statement

This is solved when a first-time paid user can review a fixed-date Deal Score and immediately understand whether expaify checked nearby date options, which date window was considered, and whether coverage was complete, without opening provider details or guessing from the `Flexible dates` toggle.
