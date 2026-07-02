# UXR-EMPTY-RESULTS-RECOVERY-01: Empty Results Recovery Flow

## Inputs

- Discovery: `docs/pipeline/empty-results-recovery/01-discovery.md`
- Affected implementation:
  - `app/page.tsx`
  - `components/flights/FlightResults.tsx`
  - `app/api/search/route.ts`

## Problem Restatement

When a valid flight or hotel search returns zero inventory, expaify explains that nothing matched but leaves recovery mostly outside the results view. First-time users must infer whether they should change dates, retry providers, clear filters, broaden the route, or search anywhere.

## Current Implementation Audit

### Search API

`app/api/search/route.ts` streams NDJSON messages for flights, hotels, notices, suggestions, and completion.

- Flight zero inventory with no provider issues emits a `notice` with `status: "no_supply"` and message `No flight providers returned matching fares for this search.`
- If the origin has nearby airports and there are zero flight results, the API emits one unstructured suggestion string: `No flights found. Try nearby: <codes>`.
- Hotel availability emits structured statuses: `available`, `empty`, `unavailable`, and `skipped`.
- Hotel empty state message is `No hotels were returned for these dates.`

The API already has enough signal to distinguish provider unavailable, no supply, skipped hotel search, and nearby airport recovery. It does not return structured recovery options.

### Results Page

`app/page.tsx` owns the search state, streamed response handling, result tabs, hotel empty panel, and retry/edit actions.

- The streamed flight `suggestion` message is stored in state as a plain string.
- Hotel empty and unavailable states are reduced to title/copy plus a single `Edit search` action.
- The page already calculates `resultContext`, including search type, route, dates, and traveler count, but does not use that context to generate specific recovery choices.
- The search form already supports flexible dates and "Anywhere" destination searches, but those capabilities are not exposed as direct empty-state actions after failure.

### Flight Results

`components/flights/FlightResults.tsx` handles flight empty states.

- It distinguishes missing dates, stop filters hiding results, provider unavailable, and true no-inventory states.
- Filter-hidden results have a useful direct recovery action: `Show all stops`.
- Provider-unavailable results have a direct `Retry search` action.
- True no-inventory results only offer `Edit search`.
- The API suggestion appears as passive text below the empty copy. It is not clickable, not decomposed into individual airport choices, and not attached to a search action.

### Existing Test Coverage

`components/flights/__tests__/FlightResults.test.tsx` verifies provider-unavailable, missing-date, filter-hidden, and ranking-update copy. It does not cover structured empty-result recovery actions.

`app/api/search/__tests__/route.test.ts` verifies hotel empty/unavailable distinctions. It does not require structured recovery options from the search endpoint.

## Reference Patterns

### Google Flights

Google Flights emphasizes recovery through flexible exploration rather than a dead-end state. Public Google Travel help describes an interactive calendar and price graph for flexible dates, where users can explore fare trends by month or week. Google Flights public pages also describe Date grid, Price graph, Explore, and tracked prices as ways to adjust dates, browse destinations, or monitor changes.

Pattern takeaway: the recovery path is not just "edit search." The user is offered a narrow set of concrete adjustments: check nearby/flexible dates, broaden destination exploration, or track the route.

Sources:
- https://support.google.com/travel/answer/2475306
- https://www.google.com/travel/flights?gl=US&hl=en-US

### Booking-Style Hotel Availability

Booking-style hotel flows treat unavailable inventory as a date/availability problem and push users toward changing stay dates or broadening availability. Public Booking.com partner availability docs center calendar/date-range availability as the operating model, and consumer hotel-search patterns commonly keep the user in the stay context while asking them to change dates or destination rather than presenting an inert empty panel.

Pattern takeaway: hotel empty states should preserve the destination/stay context and prioritize date adjustment or broader nearby-area recovery. They should not imply the provider confirmed broader market availability if only the exact dates were searched.

Source:
- https://partner.booking.com/en-us/help/rates-availability/extranet-calendar/updating-your-rates-and-availability

## Gap Analysis

| Surface | Current Code | Reference Pattern | Delta |
| --- | --- | --- | --- |
| Flight no inventory | `No flight inventory found` plus `Edit search`; optional passive nearby text | Concrete next actions for dates, nearby airports, destination exploration, and tracking | Recovery is explanatory, not actionable |
| Flight provider unavailable | Warning copy plus `Retry search` | Distinguish retry from broaden-search choices | This is mostly correct; retry should remain primary only for provider failures |
| Filter-hidden flights | `Show all stops` direct action | Directly undo the constraint causing the empty set | This is the best current pattern and should be reused |
| Hotel no inventory | `No hotel inventory found` plus `Edit search` | Change dates or broaden stay location while keeping context | No direct date/location recovery |
| Search-anywhere capability | Form placeholder and query supports empty destination | Explore/browse anywhere is a first-class recovery mode | Existing capability is hidden after empty results |
| Flexible dates | Form checkbox sends `flex=1` to API | Flexible date tools are prominent when exact dates fail | Empty state does not offer "try flexible dates" |

## Design Directives

1. True flight no-inventory empty states must present a recovery group with three explicit actions in this order: `Try flexible dates`, `Search anywhere from <origin>`, and `Edit search`.

2. If the API suggestion contains nearby airport codes, the flight empty state must render them as individual keyboard-focusable actions labeled `Try <IATA>` with helper copy `Search from a nearby airport`. These actions must be framed as new searches, not confirmed available inventory.

3. Provider-unavailable states must keep `Retry search` as the primary action and may show `Edit search` as secondary. They must not show nearby/date alternatives above retry, because the failure means inventory was not confirmed.

4. Hotel empty states must present recovery actions that match the searched context: `Change dates`, `Search hotels nearby`, and `Edit search`. If hotel availability is `skipped`, the panel must instead ask for the missing destination or round-trip dates and show only the form-editing action.

5. Empty-state copy must name the exact constraint that failed and avoid overclaiming supply. Use "No current fares matched this route and date combination" for true flight no-supply, and "No hotels were returned for these dates" for hotel no-supply. Do not use copy such as "No deals exist" or "Sold out" unless a provider explicitly returns that meaning.

## Acceptance Criteria For UXDES

- The design spec defines default, loading, empty, error, mobile 375px, desktop 1280px, focus/keyboard, and edge-case states for both flight and hotel empty recovery.
- The design spec includes exact UI copy for provider unavailable, true no inventory, filter-hidden inventory, hotel skipped, and hotel empty states.
- The design spec specifies how recovery actions update the existing search criteria without introducing provider calls from React components outside the existing `/api/search` flow.
- The design spec distinguishes passive explanation text from actionable recovery controls.
- The design spec keeps all recovery actions reachable by keyboard and visible without horizontal overflow at 375px.

## Risks And Constraints

- Nearby airport strings currently arrive as unstructured text. UI implementation can parse them, but a later DEV ticket may be cleaner if structured recovery options are added to the NDJSON contract.
- Search-anywhere recovery already exists by omitting `dest`, but hotel recovery requires a destination and round-trip dates. Flight and hotel recovery controls cannot share identical behavior.
- Date alternatives must not imply prices or availability unless they come from provider-backed results or the existing calendar endpoint.

## Recommended Handoff

Proceed to UXDES with a component-level design spec for structured recovery panels in `FlightResults` and the hotel empty panel in `app/page.tsx`. No DEV ticket is required yet unless UXDES decides that structured API recovery options are mandatory instead of deriving actions from current state.
