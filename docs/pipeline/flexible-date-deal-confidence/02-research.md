# UXR-FLEXIBLE-DATE-DEAL-CONFIDENCE-01: UX Research Brief

## Source Discovery

- Discovery report: `docs/pipeline/flexible-date-deal-confidence/01-discovery.md`
- Problem statement: Paid users searching fixed travel dates cannot tell whether expaify checked nearby dates before labeling a fare as `Great`, `Good`, or `Typical`, which weakens trust in the Deal Score when dates are flexible enough to change the recommendation.

## Current Implementation Audit

### Search Form And Request Shape

- `app/page.tsx:176-185` adds `flex=1` to the search URL only when `criteria.flexDates` is true and a departure date exists.
- `app/page.tsx:1210-1222` presents `Flexible dates` with the helper copy `Search nearby dates when possible`, but does not state the actual window or that provider coverage can be partial.
- `app/page.tsx:912-921` lets users retry with flexible dates from results. The action silently flips `flexDates` to true and starts a new flight search.

### Search API Coverage Behavior

- `app/api/search/route.ts:181-182` parses `flexDates` as `params.get('flex') === '1'`.
- `app/api/search/route.ts:241-254` expands Travelpayouts across `[-3, -2, -1, 0, 1, 2, 3]` departure days, dedupes returned fares, and streams the combined results as normal `flights`.
- `app/api/search/route.ts:256-271` emits a generic provider notice only if at least one flexible-date call succeeded and at least one failed or rejected. The notice says `Travelpayouts flexible-date coverage is incomplete for this search.`
- The API does not stream a structured coverage object: no checked date list, expected date count, returned date count, window start/end, or distinction between `not requested`, `complete`, `partial`, and `unavailable`.
- `lib/types.ts:97-101` defines `ProviderNotice` as provider/status/message only, so downstream UI cannot render date-specific coverage without new data shape.

### Results UI And Score Presentation

- `components/flights/FlightResults.tsx:315` receives `flexDates`, but uses it only to choose the empty-state action label at `components/flights/FlightResults.tsx:423-430`.
- `components/flights/FlightResults.tsx:476-496` shows provider notices under the generic title `Provider coverage may be incomplete`. This is useful for failure, but it does not tell users what happened when flexible coverage was complete.
- `components/flights/FlightResults.tsx:523-532` shows `Great deals` with `Ranked well against recent route history.` That copy explains historical scoring, not nearby-date coverage.
- `app/components/FlightCard.tsx:337-390` shows the score chip and detailed `DealScorePanel`, but neither the collapsed card nor the expanded score panel indicates whether the fare came from the selected date or a nearby checked date.
- `app/components/DealScorePanel.tsx:80-86` lists `Window: Last 90 days`, which is score-history coverage. Users can confuse this with flexible-date coverage because there is no adjacent date-comparison statement.
- `app/components/DealBadge.tsx:14-17` correctly downgrades low confidence to `Limited history`, but this only covers score history. It does not address whether nearby dates were checked.

### Calendar And Price Pulse Surfaces

- `app/api/calendar/route.ts:11-20` returns a plain date-to-price map from Travelpayouts route trends. A failed provider call and zero returned prices both collapse to `{}`.
- `app/page.tsx:1206-1208` renders `PriceCalendar` only when the map has keys, so the user sees no coverage state when calendar data is unavailable.
- `lib/deals/pricePulse.ts:53-129` summarizes route price movement across recent samples. It does not describe flexible-date coverage for the current itinerary and should not be used as a proxy for it.

## Reference Patterns

### Google Flights

Google Flights separates flexible-date exploration from individual fare ranking. Public product copy exposes `Date grid` and `Price graph` as tools that help users choose trip dates, and price tracking distinguishes searched dates from flexible `Any dates` tracking. Pattern takeaway: flexible-date support is a first-class scope statement, not an implied side effect of result ranking. Sources: Google Flights product page and Google Travel Help.

### Flexible-Date OTA Pattern

Current flexible-date travel guidance commonly frames flexible search as a visible range comparison such as `+/-3 days` or a monthly view, with fares compared across dates before the user changes the itinerary. Pattern takeaway: the UI should state the date range checked and show whether cheaper nearby alternatives were found, unavailable, or not checked; it should not leave the user to infer coverage from a checkbox.

## Exact UX Gap

The current code can execute a nearby-date search through Travelpayouts, but the user-facing results do not expose the coverage basis.

- Current code does: sends `flex=1`, searches seven departure dates for Travelpayouts, dedupes fares, streams normal fare results, and sometimes streams a generic incomplete-coverage provider notice.
- Reference pattern does: labels the flexible-date comparison scope directly, separates date-flexibility evidence from price-history confidence, and makes unavailable or partial coverage explicit.
- Delta: expaify lacks a structured date-coverage contract and a stable UI location for that contract. As a result, `Great`, `Good`, and `Typical` can appear trustworthy without saying whether nearby dates influenced, contradicted, or were unavailable for the recommendation.

## Design Directives

1. Add a results-level date coverage summary directly above or inside the `Refine flight results` panel. Required states:
   - Fixed-date search: `Nearby dates not checked`
   - Flexible complete: `Checked [start date] to [end date]`
   - Flexible partial: `Checked some nearby dates`
   - Flexible unavailable: `Nearby date comparison unavailable`

2. Keep nearby-date coverage separate from Deal Score history confidence. `DealScorePanel` may continue to say `Window: Last 90 days`, but the new date coverage copy must use labels like `Date check` or `Nearby dates`, not `confidence`, `history`, or `Deal Score`.

3. Show the checked window and coverage count when provider-backed data exists. The design spec must define copy for `7 of 7 dates checked`, `4 of 7 dates checked`, and `0 of 7 dates checked`; do not imply a complete +/-3 day comparison unless all expected dates returned usable provider responses.

4. On flexible searches, identify whether a fare departs on the selected date or a nearby date. Collapsed flight cards should include a compact chip or schedule line such as `Selected date` or `Nearby date: Jul 5`; expanded details should include the exact selected departure date and fare departure date.

5. When nearby-date coverage is partial or unavailable, preserve the existing score verdict but add a trust disclaimer near the results summary: `Deal Scores use route history. Nearby-date comparison was [partial/unavailable].` This must not downgrade or upgrade `Great`, `Good`, or `Typical`; it only explains evidence coverage.

6. Empty and loading states must mention date coverage honestly. While flexible search is running, use copy like `Checking nearby departure dates when providers respond.` If flexible coverage returns no fares, distinguish `No nearby-date fares returned` from provider failure.

## Acceptance Criteria For UXDES

- The design spec defines default, loading, empty, partial coverage, unavailable coverage, mobile 375px, desktop 1280px, and keyboard/focus behavior.
- Every visible string for date coverage is final copy, not placeholder copy.
- The spec identifies whether UI implementation alone is sufficient or whether DEV must add a structured API payload for date coverage.
- The spec explicitly prevents flexible-date labels from strengthening low-history Deal Scores.

## Research Conclusion

This should proceed to UX Design with a requirement for structured flexible-date coverage metadata. A UI-only design can improve the visible language around the current `flexDates` flag and provider notices, but a complete solution requires DEV work because the current stream does not expose the checked date set or coverage completeness.
