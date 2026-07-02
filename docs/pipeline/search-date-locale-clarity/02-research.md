# UX Research: Search Date Locale Clarity

Ticket: UXR-SEARCH-DATE-LOCALE-CLARITY-01  
Discovery input: `docs/pipeline/search-date-locale-clarity/01-discovery.md`  
Surface audited:
- `app/page.tsx`
- `components/search/SearchPanel.tsx`
- `app/api/search/route.ts`
- `node_modules/next/dist/docs/01-app/index.md`
- `node_modules/next/dist/docs/03-architecture/accessibility.md`

## Research Summary

The current search UI accepts valid native calendar dates, but it does not explain the semantic contract that the API already enforces: dates are submitted as `YYYY-MM-DD` calendar dates, one-way searches omit a return date, round trips require a return date, and hotel searches reuse the selected return date as checkout. This creates a trust gap before search, especially in hotel and flight + hotel intent where "Return" means a flight event in one context and a hotel checkout boundary in another.

Next.js App Router guidance does not introduce a special constraint for this UI beyond normal client component behavior, and the accessibility guide reinforces that interactive pages need clear, descriptive accessible context. The implementation should keep the native date controls but attach helper and error copy programmatically so screen reader users get the same date semantics as visual users.

## Current Implementation Audit

### Main Search Form

`app/page.tsx` renders the primary form as a client component. The date controls are native `type="date"` inputs labeled only `Depart` and `Return` (`app/page.tsx:1671`, `app/page.tsx:1676`, `app/page.tsx:1698`, `app/page.tsx:1703`). The fields have `min` constraints and field-level errors, but `aria-describedby` only points to error text when an error exists (`app/page.tsx:1678`, `app/page.tsx:1680`, `app/page.tsx:1705`, `app/page.tsx:1707`). There is no persistent helper text for expected format, calendar-day basis, or hotel checkout semantics.

The client validation is stricter than the visible UI explains. `validateTravelDates` requires a departure date, requires a return date for round trips, rejects invalid dates, rejects past departure dates, and rejects return dates before departure (`app/page.tsx:150`). On submit, failures collapse into the generic form error "Correct the highlighted date fields before searching" (`app/page.tsx:1087`). This catches invalid input but does not prevent semantic confusion before submit.

The flexible-date control adds "Search nearby dates when possible" on larger screens (`app/page.tsx:1728`), but it does not define the actual +/-3 day window in the primary form. That means users cannot fully predict how far from the selected calendar date the system may search.

### Secondary Search Panel

`components/search/SearchPanel.tsx` duplicates the same ambiguity. It renders `Depart` and `Return` labels above `type="date"` inputs (`components/search/SearchPanel.tsx:180`), but has no visible helper text, no `id`/`htmlFor` association on these date inputs, no min date constraint, and no field-level date validation in the component (`components/search/SearchPanel.tsx:181`, `components/search/SearchPanel.tsx:193`). The submit payload correctly drops `returnDate` for one-way searches (`components/search/SearchPanel.tsx:257`), but the UI does not explain that rule before submit.

This second surface matters because the discovery report identified it as another search entry point. If only the main page is fixed, users can still encounter the same unclear date contract elsewhere.

### Search API Contract

`app/api/search/route.ts` validates date strings with a strict `YYYY-MM-DD` regex and UTC date parse (`app/api/search/route.ts:113`). It requires departure dates, requires return dates for round trips, rejects one-way searches that include return dates, rejects past departure dates, and rejects return dates before departure (`app/api/search/route.ts:188`). The date value used for flexible search is expanded in UTC from the selected departure date (`app/api/search/route.ts:118`, `app/api/search/route.ts:393`).

For hotels, the API maps the selected departure and return values directly to `{ checkin: depart, checkout: ret }` (`app/api/search/route.ts:170`, `app/api/search/route.ts:394`). This is the strongest semantic gap: the UI says "Depart" and "Return", but the backend treats the same pair as hotel check-in and checkout for hotel availability.

## Reference Pattern Comparison

### Google Flights

Google Flights keeps the date task anchored to the flight model. Google's help flow tells users to choose ticket type first, then use the calendar to select flight dates; the date picker is tied to departure and return flight selection and can expose prices per day. The interaction pattern is: choose trip type, choose departure/return calendar dates, then compare fares for those dates.

Delta for expaify: expaify follows the same trip-type-first structure, but its date labels stop at "Depart" and "Return" and do not state that the selected dates are calendar dates submitted as ISO values. It also uses those dates for hotels, which Google Flights does not need to clarify in the same form.

### Booking.com

Booking.com's hotel search pattern labels the same range as "Check-in date" and "Check-out date" at the point of entry. The interaction pattern is: choose stay boundaries, then search availability for nights between those boundaries. It avoids the word "return" for hotel inventory.

Delta for expaify: hotel and flight + hotel intent still show "Depart" and "Return", even though the hotel provider call uses check-in and checkout. The UI should not copy Booking.com's visual style, but it should copy the semantic clarity: hotel date boundaries need hotel words.

## Exact Gap

The code is internally consistent enough to submit and validate dates, but the UI vocabulary is under-specified:

- Current code: labels the date range as `Depart` / `Return` across flights, hotels, and flight + hotel.
- Current code: validates and submits `YYYY-MM-DD` calendar dates, with one-way return dates removed from payloads.
- Current code: converts the same date range to hotel `{ checkin, checkout }` when hotel availability is checked.
- Reference patterns: expose the date role in the user's task vocabulary: flight departure/return for flights, hotel check-in/check-out for stays.
- Delta: expaify hides the role switch from users until after they infer it from results, errors, or provider behavior.

## Design Directives

1. Date field labels must change by search intent. For `flights`, use `Depart` and `Return`. For `hotels`, use `Check in` and `Check out`. For `flight + hotel`, use paired labels that include both meanings, such as `Depart / check in` and `Return / check out`.

2. Add persistent helper copy directly under the date pair and include it in `aria-describedby` for both inputs. Required copy rule: mention "calendar dates" and `YYYY-MM-DD`; for hotel-capable intents also mention that checkout is the day the stay ends. Example for flight + hotel: "Use calendar dates in YYYY-MM-DD. Hotel checkout uses the return date."

3. Keep the current validation rules, but make field errors echo the active intent. For hotel intent, missing return should read as missing checkout, not missing return. For flight + hotel, error copy should include both where needed: "Choose a return / checkout date, or switch to one way."

4. For one-way searches, hide or disable the return/checkout field and show one concise helper line stating that one-way searches submit no return date. The payload rule in `createSearchPanelSubmitPayload` and `buildSearchParams` must remain unchanged.

5. Flexible-date copy must state the concrete range wherever the toggle is available: "+/-3 days from the departure date." This should remain secondary to the date contract, not replace it.

## Acceptance Criteria For UXDES

- The design spec covers `app/page.tsx` and `components/search/SearchPanel.tsx`; both surfaces must use the same copy rules.
- At 375px, date helper text wraps without overlapping inputs, toggles, or the submit button.
- At 1280px, helper text remains visually associated with the date pair without creating a separate explanatory panel.
- Keyboard and screen reader users can tab into each date field and receive label plus helper semantics before an error occurs.
- API behavior remains unchanged: strict `YYYY-MM-DD`, no past departure, no return before departure, no return on one-way, and hotel checkout equals selected return date.

## Sources

- Local implementation: `app/page.tsx`, `components/search/SearchPanel.tsx`, `app/api/search/route.ts`
- Local Next.js docs: `node_modules/next/dist/docs/01-app/index.md`, `node_modules/next/dist/docs/03-architecture/accessibility.md`
- Google Travel Help: https://support.google.com/travel/answer/2475306
- Booking.com public search page observed via search result snippet: https://www.booking.com/
