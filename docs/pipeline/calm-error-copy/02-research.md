# UXR-CALM-ERROR-COPY-01: UX Research Brief

## Inputs Read

- Discovery: `docs/pipeline/calm-error-copy/01-discovery.md`
- Current implementation:
  - `app/page.tsx`
  - `components/flights/FlightResults.tsx`
  - `app/book/BookingFlow.tsx`
  - `app/api/search/route.ts`
  - `app/api/book/route.ts`
- Next.js guidance:
  - `node_modules/next/dist/docs/03-architecture/accessibility.md`
- Reference patterns:
  - Google Flights help frames recovery around explicit edits to origin, destination, trip type, passenger/cabin, and calendar/date selection rather than exposing provider failure detail to travelers. Source: https://support.google.com/travel/answer/2475306
  - Booking.com explains that search and ranking depend on traveler-entered destination, dates, guests, and other context, which reinforces that hotel recovery copy should name the checked stay context before asking users to change dates or area. Source: https://www.booking.com/content/how_we_work.html

## Problem Restatement

expaify already distinguishes several operational states in code, but the visible language does not consistently tell users whether the problem is invalid input, no matching inventory, partial provider coverage, a recoverable provider failure, or a booking verification stop. In paid travel moments, that ambiguity makes users question whether expaify searched correctly or whether an order might have been created.

## Current Implementation Audit

### Search-Level Failure

`app/page.tsx` catches failed `/api/search` responses and stores either the API error or a generic fallback in `error` at lines 1135-1219. The visible panel at lines 1907-1936 labels all such failures with eyebrow `Search error`, title `We could not complete this search`, primary action `Retry search`, secondary action `Edit search`, and then prints the error string directly.

This is honest but too broad. A 400 validation issue such as missing origin or invalid date is treated with the same visual category as a service failure. The user sees an alarming error heading before the copy identifies whether editing details or retrying is the correct recovery.

### Search Results Empty, Partial, And Unavailable States

`app/page.tsx` has a shared helper for inactive inventory panels at lines 560-620. It uses distinct titles for `No flights returned`, `Flights unavailable`, `No hotels returned`, and `Hotels unavailable`, but the body copy repeats provider-centered language: `provider is unavailable`, `inventory was not confirmed`, and `returned`. The distinction is technically accurate, but the tone and wording are inconsistent with the more user-centered recovery actions now available in the UI.

`components/flights/FlightResults.tsx` has richer recovery behavior. At lines 836-850 it separates missing dates, filters hiding fares, provider unavailable, and true no-supply. At lines 876-948 it already offers the right recovery controls for most flight empty states: retry for provider failure, clear filter for hidden fares, flexible dates, search anywhere, edit search, and individual nearby airport actions.

The gap is copy consistency, not capability. The active flight panel still says `Flights unavailable` and `Flight inventory was not confirmed because a provider is unavailable` for provider failure, while true no-supply says `No flights were returned for this route`. The active and inactive states should use the same state taxonomy and the same calm structure: what expaify checked, what was not confirmed or matched, and the next action.

### Provider Notice Surfacing

`app/api/search/route.ts` converts provider failures into notices such as:

- `Travelpayouts returned a response we could not use.`
- `Duffel is unavailable for this search.`
- `No flight providers returned matching fares for this search.`
- `The hotel provider returned a response we could not use.`
- `The hotel provider is unavailable right now.`

`app/page.tsx` stores these streamed notices unchanged at lines 1187-1206. `components/flights/FlightResults.tsx` renders flight provider warning notices verbatim at lines 953-973. Hotel unavailable detail is also shown in `app/page.tsx` at lines 2147-2150.

This leaks provider implementation language into the traveler-facing UI. It is useful for debugging, but it does not give paid users a stable mental model. The user should not need to know whether the failure was malformed response, timeout, or vendor unavailability unless that changes their next action.

### Booking Review And Handoff

`app/book/BookingFlow.tsx` maps booking errors in `getErrorStatus` at lines 92-108. Changed-fare cases are calm and specific: `This fare changed since search` plus `expaify did not create an order.` Network and generic cases use `Booking request stopped`, and the fallback message appends the raw `reason` after `expaify did not create an order.`

`handleSubmit` stores raw API reasons at lines 563-569. `app/api/book/route.ts` returns raw Duffel error messages for most 502 cases at lines 188-205 and returns a payment-specific message at lines 193-201.

This is the riskiest trust gap. The UI correctly states that no order was created, but `Booking request stopped` can sound like a checkout was interrupted mid-purchase, and raw provider fields or vendor phrasing can make the page feel broken. Booking errors need a small controlled vocabulary with specific, user-safe outcomes.

### Accessibility And Live Regions

The current UI uses `role="alert"` for search errors and `role="status"` for non-error state panels in `ResultsStatePanel`. Booking `StatusPanel` uses `role="alert"` only when `live="assertive"`. Next's accessibility guidance notes that route/page changes should have unique descriptive titles and that accessibility tooling should catch correct `aria-*` use.

The implementation already has the basic live-region primitives. UXDES should preserve them but specify which states are assertive versus polite. True empty inventory and partial provider coverage are not emergencies and should remain polite. Booking verification failure after submit can be assertive, but the copy must avoid implying that an order may exist.

## Reference Pattern Delta

Google Flights keeps recovery anchored in editable search inputs and date tools. The interaction pattern is not "provider failed"; it is "adjust the query, date, or destination context and search again." The relevant lesson for expaify is that search-result copy should name the user's route/date context and offer concrete recovery controls without exposing vendor plumbing.

Booking-style hotel search depends heavily on the submitted destination, dates, and party context. The relevant lesson is that hotel unavailable or empty copy should say what stay context was checked and then guide a date/area adjustment. It should not sound like all hotels are unavailable unless the system has confirmed that broader claim.

## Exact Gap

| Surface | Current Code | Reference Pattern | Delta |
| --- | --- | --- | --- |
| Full search failure | One `Search error` panel prints API/fallback error and offers retry/edit | Separate invalid-search correction from service retry | Users cannot tell whether to edit details or retry first |
| Flight no-supply | `No flights returned` and recovery actions | Query-anchored no-match state with date/destination recovery | Recovery is present, but copy still says `returned` instead of what was checked/matched |
| Flight provider failure | `Flights unavailable` plus provider notices | Calm partial-coverage/service issue language | Wording sounds final and provider-centered; raw notices leak vendor state |
| Hotel no-supply | `No hotels returned` plus change dates/nearby/edit | Stay-context empty state | Mostly correct actions, but copy should name dates/area and avoid broad market claims |
| Hotel provider failure | `Hotels unavailable` plus raw hotel provider message | Retry-oriented service issue | Wording overemphasizes provider and repeats unavailability |
| Booking failure | `Booking request stopped` plus raw reason fallback | Controlled checkout safety copy: no order, selected offer still visible, next step | Raw provider/field messages can leak into a high-stakes moment |

## Design Directives

1. Define a shared traveler-facing error taxonomy with exact categories: `needs details`, `no match`, `partial coverage`, `service unavailable`, and `booking not created`. UX copy must choose one category before choosing title, body, tone, live-region priority, and actions.

2. Replace the global search error heading with category-specific copy. Validation or URL/search parameter problems must use `Search details need attention` with `Edit search` as primary. Network or API failures must use `Search did not finish` with `Retry search` as primary and `Edit search` secondary. Do not print raw API strings as the first sentence.

3. For no-inventory states, use no-match language rather than failure language. Required pattern: `No current flights matched this route and date combination.` For hotels: `No hotels matched these dates in the selected area.` The body must include the searched route/stay context and the first recovery action.

4. For provider failure or malformed provider response, use coverage language rather than final inventory language. Required pattern: `We could not confirm all flight inventory for this search.` For hotels: `We could not confirm hotel inventory for these dates.` Primary action must be `Retry search`; edit/broaden actions must be secondary.

5. Provider notices must be rewritten before display. Users may see provider names only when useful for trust, but must not see `malformed_response`, `provider call failed`, raw exception text, field names, or vendor-specific setup errors. If details are retained for diagnostics, keep them out of visible copy.

6. Booking error copy must always state the safety outcome before the cause: `No order was created.` Use controlled titles:
   - Changed fare: `This fare changed since search`
   - Network/service issue: `We could not verify this fare`
   - Missing/invalid traveler details: `Traveler details need attention`
   - Provider payment/balance issue: `Provider payment could not be verified`
   The fallback must not append raw `reason` directly to the visible message.

7. Tone and live-region rules must be specified by severity. `needs details`, `no match`, and `partial coverage` should use calm/status tone with `aria-live="polite"`. Full service failure may use warning tone but still polite unless the user just submitted. Booking submit failure may use assertive alert, but the title/body must clearly say no order was created.

8. Mobile copy must be short enough for 375px panels: titles under 44 characters, first sentence under 110 characters, and actions stacked in priority order. Provider-detail footnotes must not push recovery actions below the first mobile viewport for search/result errors.

## Testable Acceptance Criteria For UXDES

- The design spec defines exact copy for search validation failure, full search service failure, flight no-match, flight partial/provider failure, hotel no-match, hotel provider failure, booking changed fare, booking network failure, booking traveler-detail failure, and booking generic provider failure.
- The spec maps each state to primary and secondary actions and states when `Retry search`, `Edit search`, `Change dates`, `Try flexible dates`, `Search anywhere`, `Search hotels nearby`, and `Review details again` are allowed.
- No visible string in the spec includes raw provider exception language, internal status names, field-path names, or generic `failed` copy for recoverable states.
- Booking failure copy states `No order was created` in the status panel before any cause or next-step explanation.
- Search and result empty states preserve the distinction between true no-supply and provider unconfirmed coverage.
- The spec includes mobile 375px and desktop 1280px layouts for search error, result empty/unavailable, and booking error states.
- The spec preserves accessible live regions and identifies which states are `role="status"` versus `role="alert"`.

## Risks And Constraints

- Some raw provider reasons currently come from API routes and are passed straight to UI. UI can sanitize visible copy, but a later DEV ticket may be needed if the team wants structured error codes rather than text classification.
- Existing recovery controls in flight and hotel empty states are mostly available. The UI stage should avoid changing search/provider behavior unless UXDES identifies a missing state contract.
- Do not hide uncertainty. Calm copy must still say when inventory or booking verification was not confirmed.

## Recommended Handoff

Proceed to UXDES for a state-by-state calm error copy spec across `app/page.tsx`, `components/flights/FlightResults.tsx`, and `app/book/BookingFlow.tsx`. This appears primarily UI/copy work, with a possible later DEV ticket only if design requires structured API error codes instead of UI-side sanitization.
