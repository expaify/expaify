# AUDIT-RESULTS-FIRST-VIEWPORT-TRUST-01

Date: 2026-06-30
Role: Senior QA Engineer
Scope: First visible results viewport across loading, success, empty/provider-unavailable, error, mobile 375px, and desktop.

## Files Inspected

- `app/page.tsx`
- `app/globals.css`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `components/baggage/BaggageFeeEstimator.tsx`
- `app/api/search/route.ts`

Requested files not found in this worktree:

- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`

## Execution Blockers

- Local dev server could not bind to a port in this sandbox.
  - `npm run dev` failed with `listen EPERM: operation not permitted 0.0.0.0:3001`.
  - `npm run dev -- --hostname 127.0.0.1 --port 3100` failed with `listen EPERM: operation not permitted 127.0.0.1:3100`.
- No provider/database credentials were present in the shell environment, so a real successful provider-backed search could not be executed locally.
- Because the app could not be served, screenshots could not be captured. Viewport notes below are code-backed layout notes from the inspected render order and responsive classes.

## Defects

### 1. Blocker: mobile success viewport can hide the fare, Deal Score, and provider action below non-result panels

Severity: Blocker
Viewport: Mobile 375px; lower risk on desktop.
Files:

- `components/flights/FlightResults.tsx:217`
- `components/flights/FlightResults.tsx:280`
- `components/flights/FlightResults.tsx:324`
- `components/baggage/BaggageFeeEstimator.tsx:157`
- `app/components/FlightCard.tsx:292`
- `app/components/FlightCard.tsx:344`
- `app/components/FlightCard.tsx:352`

Repro steps:

1. Run a successful flight search that returns at least one fare, for example JFK to LHR with valid future round-trip dates.
2. Inspect the first results viewport at 375px width immediately after fares load.
3. Observe the render order: sticky header, results summary, tabs, optional provider notice, sort/stop controls, baggage fee estimator, then fare cards.

Actual:

- The first fare card is rendered only after controls and the baggage estimator.
- The baggage estimator is a full card with controls and live status before any fare card.
- On 375px, the user can plausibly see controls and baggage copy before seeing the first price, Deal Score, or provider CTA.

Expected:

- The first visible results viewport must expose the actual result value: route, dates, passenger context, price, currency, Deal Score, provider status, and next action.

Paid-user trust impact:

- The page leads with management UI and an add-on estimator instead of the deal. A paid user can perceive the result as evasive or low-confidence because the price and action are not immediately available.

Viewport notes:

- Mobile 375px: high risk; vertical stacking pushes result cards down.
- Desktop: lower risk; larger viewport and 3-column card grid make fare cards more likely to appear, but baggage still competes before the results.

### 2. High: mobile result criteria omit dates and omit the one-passenger context

Severity: High
Viewport: Mobile 375px; also affects desktop for one passenger.
Files:

- `app/page.tsx:1254`
- `app/page.tsx:1263`
- `app/page.tsx:1268`
- `app/page.tsx:1294`
- `app/page.tsx:1297`

Repro steps:

1. Run any search with one passenger at 375px width.
2. Inspect the sticky result header and the result summary before opening/editing search.

Actual:

- Dates are present in the sticky search button only behind `hidden ... sm:inline`, so mobile users see route but not dates.
- Passenger context is only rendered when `passengers > 1`, so a one-passenger result has no explicit traveler context.
- Loading copy says "Scanning deals across providers..." without repeating the actual route/date/passenger context.

Expected:

- Route, dates, and passenger context should be identifiable in the first viewport without opening edit/search UI, including the common one-passenger case.

Paid-user trust impact:

- Users cannot verify they are evaluating the intended dates or party size before trusting prices and Deal Scores.

Viewport notes:

- Mobile 375px: route visible, dates hidden, one-passenger context absent.
- Desktop: dates are visible in the sticky header, but one-passenger context remains absent.

### 3. High: provider-unavailable empty state initially reads like a successful zero-result search

Severity: High
Viewport: Mobile 375px and desktop.
Files:

- `app/page.tsx:1294`
- `app/page.tsx:1296`
- `app/page.tsx:1399`
- `app/page.tsx:1400`
- `components/flights/FlightResults.tsx:151`
- `components/flights/FlightResults.tsx:193`
- `components/flights/FlightResults.tsx:310`

Repro steps:

1. Run a valid search in an environment without flight provider credentials.
2. Wait for `/api/search` to stream provider notices and finish.
3. Inspect the first results viewport.

Actual:

- The top summary says `0 flights found · [route]`, which reads like a completed inventory result.
- The hotels-unavailable banner can render before the flight empty/provider-unavailable panel.
- The flight provider failure explanation is lower in the viewport, behind tabs and hotel availability messaging.

Expected:

- Provider-unavailable state should lead with the provider coverage failure before presenting `0 flights found`.
- Hotel availability should not outrank the flight failure in a flight-first result viewport.

Paid-user trust impact:

- The app appears to have searched successfully and found nothing, when the real issue may be missing/unavailable providers. That undermines the credibility of the inventory and the Deal Score system.

Viewport notes:

- Mobile 375px: high risk because the misleading `0 flights found` summary and hotel banner consume scarce vertical space.
- Desktop: still misleading, but more context may be visible without scrolling.

### 4. Medium: loading state does not preserve enough search criteria or provider status context

Severity: Medium
Viewport: Mobile 375px and desktop.
Files:

- `app/page.tsx:1275`
- `app/page.tsx:1277`
- `app/page.tsx:1284`
- `components/flights/FlightResults.tsx:289`
- `components/flights/FlightResults.tsx:291`
- `components/flights/FlightResults.tsx:304`

Repro steps:

1. Start a valid search.
2. Inspect the first loading viewport before any fare card arrives.

Actual:

- Loading copy is generic: `Scanning deals across providers...` and `Checking live flight inventory`.
- Skeleton cards are unlabeled blocks; they do not show the searched route, dates, passenger count, or provider status.
- On mobile, the sticky header hides dates and omits one-passenger context as described above.

Expected:

- Loading should keep the search criteria visible and clarify which result facts are pending.

Paid-user trust impact:

- Users cannot distinguish "loading the right search" from a generic loading screen, especially after editing dates or passenger count.

Viewport notes:

- Mobile 375px: criteria loss is most visible because dates are hidden.
- Desktop: route/date are more visible in the header, but the loading body remains generic.

### 5. Medium: flight card provider status is not result-specific

Severity: Medium
Viewport: Mobile 375px and desktop.
Files:

- `components/flights/FlightResults.tsx:193`
- `components/flights/FlightResults.tsx:206`
- `app/components/FlightCard.tsx:283`
- `app/components/FlightCard.tsx:352`

Repro steps:

1. Run a search where one provider returns fares and at least one provider returns an unavailable notice.
2. Inspect the first fare card.

Actual:

- Provider notices are global and appear above the controls/cards.
- A card only says `{carrier} via {source}` plus CTA text; it does not state whether that result's provider link is verified, stale, partial, or affected by the global notice.

Expected:

- The visible result card should give enough provider status to trust that result's price and next action without relying on a separate global notice.

Paid-user trust impact:

- Mixed provider states are hard to interpret. Users may not know whether a displayed fare is from a healthy source or whether the warning applies to it.

Viewport notes:

- Mobile 375px: global notice may be separated from cards by controls and baggage.
- Desktop: notice and cards are closer, but status still is not result-specific.

## Manual Verification Flow Notes

Successful search-to-results path:

- Blocked from live execution by sandbox port binding and missing provider credentials.
- Code-backed path inspected: `runSearch` streams `flights`, fires score requests, then `FlightResults` renders controls, baggage estimator, and `FlightCard` grid.
- Mobile 375px note: likely fails first-viewport trust because the first actual fare can appear below controls and the baggage estimator.
- Desktop note: result cards are more likely to appear in the first viewport, but baggage still competes above the fare grid.

Empty-results path:

- Real local execution blocked by server bind failure.
- Code-backed path inspected: when no fares and no provider issue, `FlightResults` renders `No flight inventory found` with an edit action; when filters hide results, it renders `Show all stops`.
- Mobile 375px note: empty panel action is visible, but route/date/passenger context is not repeated in the panel.
- Desktop note: action and copy fit; same criteria context gap remains.

Provider/error path:

- Real local execution blocked by server bind failure.
- Code-backed provider-unavailable path inspected: `/api/search` emits provider notices when adapters are not configured; `FlightResults` converts those into the warning and provider-unavailable empty panel.
- Code-backed network/error path inspected: failed fetch sets `error`, then `ResultsStatePanel` shows `Retry search` and `Edit search`.
- Mobile 375px note: provider-unavailable summary can initially read as `0 flights found`; error panel actions stack and should remain visible.
- Desktop note: error panel actions fit; provider-unavailable summary remains misleading.

## Self-Review

- Hierarchy: Defective on mobile success and provider-unavailable states because controls, hotel status, and baggage can outrank the actual fare result.
- Contrast: No critical contrast issue found in inspected variables/classes. Disabled hotel tab text is intentionally muted but may become hard to read in dark mode.
- Spacing: Mobile vertical spacing is the main trust issue; non-result panels consume the first viewport.
- Mobile fit: No obvious horizontal overflow from inspected classes; core issue is vertical concealment of result facts/actions.
- Focus states: Global focus styles are present in `app/globals.css`; no first-viewport focus blocker found in this audit.
- Decorative effects: No cheap decorative clutter found in the results viewport; the problem is information priority, not ornament.

## Verification Commands

- `npx tsc --noEmit --incremental false` passed.
- `npx jest --runInBand` passed: 20 suites, 172 tests.
- `npm test -- --passWithNoTests` passed: 20 suites, 172 tests.

