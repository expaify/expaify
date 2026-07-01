# AUDIT-SEARCH-RESULTS-ARIA-LIVE-STATUS-01

Date: 2026-06-30
Role: Senior Frontend + UX/UI Engineer
Scope: Audit only. No product code changed.

## Verdict

Fail for assistive announcement completeness.

The search/results surface has visible loading, empty, error, provider notice, and result-count text. Some states use `role="status"` or `role="alert"`, and flight filter/count changes use an explicit polite live region. The gaps are that the top-level search progress/result-count text is not a live region, successful streamed result-count changes are only partially announced once flight controls exist, hotel partial-failure text is plain static copy, and no state transition intentionally places focus after search completion or retry.

Runtime mobile/desktop browser verification was blocked in this sandbox because `npm run dev -- --hostname 127.0.0.1 --port 3017` failed with `listen EPERM: operation not permitted 127.0.0.1:3017`. The viewport assessment below is source-level/responsive-class evidence, not live screenshot evidence.

## Files Inspected

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/api/search/route.ts`
- `app/globals.css`
- `node_modules/next/dist/docs/03-architecture/accessibility.md`

## State Coverage

| State | Visible text | Assistive announcement coverage | Result |
| --- | --- | --- | --- |
| Loading, no fares yet | Yes: "Scanning deals across providers..." and "Checking live flight inventory" | Partial: flight panel has `role="status"`, but the top header progress text is not live and focus is not moved | Partial |
| Successful results | Yes: "`n` flights found", tab counts, "`n` results", cards | Partial: `flight-results-controls-summary` is `aria-live="polite"` after controls render, but the primary header count is static text | Partial |
| Empty flights | Yes: specific empty titles/copy and Edit/Search recovery action | Yes for the flight empty panel via `role="status"` | Pass, with focus caveat |
| Search error | Yes: "We could not complete this search", error reason, Retry/Edit actions | Yes for the error panel via `role="alert"` | Pass, with focus caveat |
| Provider partial failure | Yes: provider notice messages are rendered | Partial: flight provider notice is inside a `role="status"` panel; hotel unavailable/skipped copy outside active hotel tab is plain text | Partial |
| Retry outcome | Yes: retry re-enters loading/error/success UI | Partial: same state announcements apply, but focus remains unmanaged after retry | Partial |
| Booking action discovery | Yes: card CTA is a native link with provider/route label and visible focus | Pass for keyboard discovery once focus reaches cards | Pass |

## Findings

### P1 - Successful search count changes are not announced from the primary results header

Evidence:

- `runSearch` switches from form to results, clears previous data, then streams provider messages into state (`app/page.tsx:687` to `app/page.tsx:719`, `app/page.tsx:758` onward).
- The primary result count is static text: `{flights.length} flights found` (`app/page.tsx:1293` to `app/page.tsx:1304`).
- The flight controls summary is live (`components/flights/FlightResults.tsx:268`), but it only exists when `flights.length > 0 || isSearching` and it describes sort/filter context, not the top-level successful search completion.

Repro:

1. Keyboard-tab to `Search flights`.
2. Submit a valid search that streams one or more flight chunks.
3. Stay on the keyboard and do not visually scan the page.
4. Expected: "Checking live flight inventory" changes into a clear announced completion/count such as "3 flights found".
5. Actual from source: the header count changes visually, while only the nested filter summary has live-region coverage.

Impact:

Screen-reader users can miss that the search completed and how many flights were found, especially when results stream in after the loading panel disappears.

### P1 - Focus does not land predictably after search completion or retry

Evidence:

- `runSearch` calls `setView('results')` and later sets loading/error/success state, but there is no focus target, `ref.focus()`, or `tabIndex={-1}` heading/status target (`app/page.tsx:687` to `app/page.tsx:819`).
- Retry calls `runSearch()` from the error panel (`app/page.tsx:1335` to `app/page.tsx:1341`) and uses the same unmanaged focus path.
- `#results` is a plain `div`, not a focus target (`app/page.tsx:1275`).

Repro:

1. Keyboard-tab to `Search flights`.
2. Submit a valid search.
3. Wait for loading to resolve to success, empty, or error.
4. If error appears, tab to `Retry search` and activate it.
5. Expected: focus moves predictably to the loading status, result count, error heading, or first recovery action.
6. Actual from source: focus is left on an unmounted submit/retry control or wherever the browser recovers focus.

Impact:

Even when text is technically present, keyboard users are not guided to the changed state. This is most damaging on 375px mobile because the sticky header and single-column cards make visual recovery slower.

### P1 - Hotel partial-failure and skipped states are visible but not announced when the Hotels tab is unavailable

Evidence:

- The API streams hotel statuses such as `empty`, `unavailable`, and `skipped` (`app/api/search/route.ts:278` to `app/api/search/route.ts:315`).
- The results page renders disabled Hotels tab text and a plain explanatory block when hotels are unavailable (`app/page.tsx:1363` to `app/page.tsx:1403`).
- That explanatory block has no `role="status"`, `aria-live`, or association to the disabled Hotels button.

Repro:

1. Submit a valid flight search where hotel availability is skipped or unavailable.
2. Keyboard-tab through `Share`, `Flights`, and result controls.
3. Expected: the hotel partial-failure/skipped reason is announced or associated with the unavailable Hotels tab.
4. Actual from source: the reason is visible below the tab row but not live, and the disabled Hotels tab is skipped by normal tab order.

Impact:

Provider partial failure is a trust-critical state. A screen-reader user may know flight results exist but miss that hotel results were skipped or unavailable.

### P2 - Loading announcement coverage is split and could be misleading during streamed updates

Evidence:

- Top-level loading text says "Scanning deals across providers..." without live-region semantics (`app/page.tsx:1277` to `app/page.tsx:1285`).
- Flight loading panel uses `role="status"` and says "Checking live flight inventory" (`components/flights/FlightResults.tsx:289` to `components/flights/FlightResults.tsx:303`).
- While streamed fares arrive, loading may continue and a skeleton card remains after real cards (`components/flights/FlightResults.tsx:324` to `components/flights/FlightResults.tsx:334`).

Repro:

1. Submit a valid search.
2. Observe the no-results loading panel.
3. Wait for the first provider chunk while the request is still running.
4. Expected: assistive tech receives coherent progress updates as fares arrive.
5. Actual from source: once real fares render, the remaining loading indicator is visual and the live text depends on the filter summary/ranking text, not a dedicated search-progress status.

Impact:

The search can feel stalled or ambiguous for non-visual users during partial streamed results.

### P2 - Error and empty announcements exist, but validation errors do not guide focus

Evidence:

- Form-level validation error uses `role="alert"` (`app/page.tsx:1155` to `app/page.tsx:1158`).
- Date field errors use `role="alert"` and `aria-describedby` (`app/page.tsx:1057` to `app/page.tsx:1103`).
- The invalid controls are not focused after failed submit (`app/page.tsx:667` to `app/page.tsx:684`).

Repro:

1. Keyboard-tab to `Search flights`.
2. Submit with missing departure or return date.
3. Expected: error is announced and focus lands on the first invalid field or summary.
4. Actual from source: alert text renders, but focus remains at submit/recovery position.

Impact:

The announcement exists, but the recovery path still requires manual page exploration.

## Positive Findings

- Search error panels use `role="alert"` and include both Retry and Edit actions (`app/page.tsx:374` to `app/page.tsx:398`, `app/page.tsx:1328` to `app/page.tsx:1358`).
- Flight loading, empty, and provider notice panels use `role="status"` (`components/flights/FlightResults.tsx:94` to `components/flights/FlightResults.tsx:118`).
- Flight sort/filter result summaries use `aria-live="polite"` and `aria-atomic="true"` (`components/flights/FlightResults.tsx:268` to `components/flights/FlightResults.tsx:276`).
- Sort and stop controls expose `aria-pressed`, disabled state, visible selected text, and live summary relationships (`components/flights/FlightResults.tsx:217` to `components/flights/FlightResults.tsx:277`).
- Booking/provider CTAs are native links with visible focus styling and route/provider labels (`app/components/FlightCard.tsx:352` to `app/components/FlightCard.tsx:369`).
- Global focus-visible styling exists for native controls (`app/globals.css:137` to `app/globals.css:144`).

## Keyboard-Only Reproduction Steps

### Loading

1. Open `/`.
2. Tab to origin, destination, dates, and `Search flights`.
3. Submit a valid search.
4. Observe expected visible loading text: "Scanning deals across providers..." and "Checking live flight inventory".
5. Audit result: loading text is visible; assistive coverage is partial because only the flight panel is a status region and focus is unmanaged.

### Empty

1. Submit a route/date combination that returns no usable fares, or use a search with providers unavailable and zero fares.
2. Continue with keyboard only after loading completes.
3. Observe expected visible empty/error copy and recovery action.
4. Audit result: flight empty panel is a status region and has recovery action; focus is not moved to the panel or action.

### Error

1. Simulate a failed `/api/search` response by using invalid URL parameters or forcing the fetch path to reject in dev tools/test harness.
2. Submit search or load the bad state.
3. Tab to `Retry search` and activate it.
4. Audit result: error panel is an alert and retry exists; retry outcome uses the same unmanaged focus path.

### Successful Results

1. Submit a valid search that returns at least one fare.
2. After loading, keyboard-tab through header controls, Share, Flights tab, sort/stops controls, result cards, and booking CTA.
3. Audit result: booking action is discoverable once focus reaches cards; successful result count changes are not announced from the primary header, and focus is not placed on a predictable result target.

## Mobile 375px and Desktop Notes

Runtime viewport verification was blocked by local server bind restrictions. Source-level responsive behavior indicates:

- Search fields stack on mobile and use larger touch targets (`app/page.tsx:1017` to `app/page.tsx:1168`).
- Results cards are one column on mobile and become two/three columns at larger breakpoints (`components/flights/FlightResults.tsx:304`, `components/flights/FlightResults.tsx:324`).
- Focus visibility should be available globally on both mobile and desktop (`app/globals.css:137` to `app/globals.css:144`).
- The focus-management failure applies to both viewports because it is state logic, not layout-specific.

## Out-of-Scope Observations

- Results tabs still lack `role="tablist"`/`aria-selected`; this affects state comprehension but was already broader than this status-announcement audit.
- The flight CTA label omits the formatted fare amount, although the visible price is nearby. This affects handoff trust but is outside this ticket.
- This audit does not implement ARIA regions, focus changes, provider behavior, retry logic, or ranking changes per ticket scope.
