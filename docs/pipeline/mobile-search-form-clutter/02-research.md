# UXR-MOBILE-SEARCH-FORM-CLUTTER-01: UX Research Brief

## Upstream Input

Discovery report: `docs/pipeline/mobile-search-form-clutter/01-discovery.md`

Problem statement: On mobile, a paid user must parse too many competing search controls before they can confidently start a flight or hotel search, which makes the primary action feel slower and less trustworthy than it should.

## Scope Audited

- `app/page.tsx`
- `app/components/AirportInput.tsx`
- `components/search/SearchPanel.tsx`
- `app/globals.css`
- `node_modules/next/dist/docs/01-app/index.md`
- `node_modules/next/dist/docs/03-architecture/accessibility.md`

This is an App Router client surface. The relevant Next.js accessibility guidance is route-level rather than form-specific, but it reinforces that page titles, semantic controls, route announcements, and jsx-a11y linting should remain intact. This research brief therefore treats the mobile issue as interaction hierarchy and control density, not as a reason to weaken semantic labels, focus behavior, combobox roles, or live status text.

## Current Implementation Audit

### Active mobile search form

`app/page.tsx` is the active home-page form. On first load, the default state is `searchIntent = 'trip'` and `tripType = 'roundtrip'` (`app/page.tsx:879` to `app/page.tsx:882`). That means the default mobile path asks the user to evaluate the broadest inventory mode and the most date fields before they have entered a route.

The form renders inside a large card after the page header and hero copy (`app/page.tsx:1555` to `app/page.tsx:1581`). At 375px, the layout stacks vertically because the search intent grid is `grid-cols-1` until `sm:grid-cols-3` (`app/page.tsx:1584` to `app/page.tsx:1604`), the route grid is one column until the `lg` breakpoint (`app/page.tsx:1630`), and the date grid is one column until the `sm` breakpoint (`app/page.tsx:1681`). The submit button appears only after all optional controls and any calendar module (`app/page.tsx:1726` to `app/page.tsx:1795`).

The exact visible control order on mobile is:

1. Three search intent buttons: `Flights`, `Hotels`, `Flight + hotel` (`app/page.tsx:1584` to `app/page.tsx:1605`).
2. Two trip type buttons: `Round trip`, `One way` (`app/page.tsx:1608` to `app/page.tsx:1627`).
3. Origin combobox with visible `From` label (`app/page.tsx:1632` to `app/page.tsx:1648`).
4. Swap button, rotated for mobile (`app/page.tsx:1651` to `app/page.tsx:1659`).
5. Destination combobox with visible `To` label (`app/page.tsx:1662` to `app/page.tsx:1678`).
6. Departure date (`app/page.tsx:1683` to `app/page.tsx:1712`).
7. Return date for round trips (`app/page.tsx:1716` to `app/page.tsx:1750`).
8. Optional `PriceCalendar` when origin and destination have calendar prices (`app/page.tsx:1755` to `app/page.tsx:1757`).
9. Flexible date checkbox (`app/page.tsx:1760` to `app/page.tsx:1772`).
10. Passenger stepper (`app/page.tsx:1775` to `app/page.tsx:1805`).
11. Form error, when present (`app/page.tsx:1809` to `app/page.tsx:1813`).
12. Primary submit button (`app/page.tsx:1816` to `app/page.tsx:1832`).

The implementation has improved field clarity from prior discovery work: `From`, `To`, `Depart`, and `Return` are now visible labels, and `AirportInput` preserves combobox semantics. The remaining problem is that mobile users still have to pass through too many equally prominent decisions before the minimum search path is clear.

### Optional controls competing with required controls

The `Search intent` selector is visually heavier than the route/date fields on mobile because each option is a full-width, minimum-height button with a label and description (`app/page.tsx:1586` to `app/page.tsx:1603`). This makes inventory choice feel like a required first step. The default is also `Flight + hotel`, so the safest interpretation for a first-time user is that they may need to understand both product modes before entering a route.

The passenger stepper and flexible-date checkbox are also rendered as full-width card-like controls (`app/page.tsx:1760` to `app/page.tsx:1806`). They are valid controls, but they are secondary for the first search because defaults already exist: `passengers` defaults to `1`, and `flexDates` defaults to `false` (`app/page.tsx:887` to `app/page.tsx:888`). Their current prominence makes them compete with the primary action.

The `PriceCalendar` can appear before the flexible-date and passenger controls when both origin and destination are set (`app/page.tsx:976` to `app/page.tsx:986`; `app/page.tsx:1755` to `app/page.tsx:1757`). It is potentially useful, but it expands the pre-submit surface at the exact moment the user is trying to finish the form. It also introduces another date-selection surface before the user has submitted.

### Adjacent decision paths

After the search card, `TripInspirationHomeRail` appears before the footer (`app/page.tsx:1836` to `app/page.tsx:1845`). That rail can prefill origin, destination, dates, round trip, flexible dates, and `trip` intent (`app/page.tsx:1344` to `app/page.tsx:1372`). This is useful, but on mobile it creates a second route into the same search task. Prior `trip-inspiration-paid-intent` work already specifies that inspiration should appear after the submit button at 375px and must not hide or compete with the primary action; this mobile clutter ticket should preserve that hierarchy.

Recent searches are also rendered inside the same rail when local history exists (`app/page.tsx:860` to `app/page.tsx:876`). Selecting one fills only route fields (`app/page.tsx:1375` to `app/page.tsx:1384`). This is a helpful shortcut for returning users, but it is another decision path that should stay subordinate to the minimum form path.

### Accessibility and implementation contracts

`AirportInput` correctly exposes `role="combobox"`, `aria-autocomplete`, expanded state, listbox controls, active descendant, described-by helper/error/status text, and invalid state (`app/components/AirportInput.tsx:146` to `app/components/AirportInput.tsx:166`). The component also provides live status messages for loading, too-short, settled, error, selected, and resolved states (`app/components/AirportInput.tsx:256` to `app/components/AirportInput.tsx:265`).

The search form currently uses native buttons, native date inputs, native checkbox behavior, and a form submit handler. The design response should keep those contracts. The issue is not that controls are unreachable; it is that the mobile visual hierarchy makes every control look equally required.

## Reference Pattern Comparison

### Google Flights

Google's flight-search help describes a linear task model: enter departure and destination, choose ticket type, passengers and cabin class, choose flight dates, then search. It also allows popular destination lists and map exploration, but those are alternate discovery paths rather than controls inserted between every required field.

Source: https://support.google.com/travel/answer/2475306

Pattern takeaway for expaify: keep the minimum search path visually dominant. Trip type and passenger controls can be available, but route and date entry should read as the primary task and the CTA should stay close enough that users can see what completing the form does.

### Booking.com Flights

Booking.com's flights entry point centers on a familiar route/date search and then supports exploration, account, and trust content around it. The key pattern is not visual style; it is that the core booking/search task is easy to identify before surrounding modules compete for attention.

Source: https://www.booking.com/flights/index.html

Pattern takeaway for expaify: secondary modules such as inspiration and recent searches should help users complete the search shape, not appear as peer-level decisions before a first mobile search.

## Exact Gap

| Area | Current code behavior | Reference pattern | Delta |
| --- | --- | --- | --- |
| Mobile hierarchy | Search intent, trip type, route, swap, dates, calendar, flexible dates, passengers, errors, and submit all stack as separate high-prominence groups. | The route/date task is the dominant path; supporting options are compact or progressively disclosed. | Users cannot quickly tell which controls are required to start a valid first search. |
| Default intent | First load defaults to `Flight + hotel`, the broadest option. | Search products usually make the current task clear and defer broader inventory exploration until needed. | A paid user may treat product-mode choice as prerequisite comprehension instead of an optional scope decision. |
| Secondary defaults | Flexible dates and passengers have sensible defaults but occupy full-width, card-like rows before submit. | Defaults are shown compactly unless the user needs to change them. | Optional controls consume the same visual priority as route and date fields. |
| Calendar module | `PriceCalendar` can appear inside the form before submit once route fields are set. | Date-price exploration is useful, but should not interrupt completing the primary search path on small screens. | Mobile users can be pulled into a secondary date-selection surface before the CTA. |
| Adjacent shortcuts | Trip inspiration and recent searches sit immediately after the form as alternate route-entry paths. | Exploration shortcuts are subordinate to the primary search task and should clearly prefill or verify search criteria. | First-time users see multiple ways to start without a strong hierarchy among them. |

## Design Directives

1. Define a mobile-first primary path where the first visible task is route and date entry, not product-mode comparison. At 375px, `From`, `To`, `Depart`, optional `Return`, and the primary submit button must form one clear scan path. Search intent and trip type must remain available but should not visually dominate the form before the route fields.

2. Keep optional controls compact when their defaults are valid. `Flexible dates` and `Passengers` must remain reachable and keyboard operable, but the default mobile state should present them as secondary settings rather than full-width peer cards. The spec must define the collapsed/default copy for `1 traveler` and `Flexible dates off`, plus the expanded or edited state if the design uses disclosure.

3. Preserve semantic accessibility while reducing visual density. Do not remove `fieldset`/`legend` semantics, native inputs, `aria-pressed` state for segmented controls, combobox roles, live lookup status, date `aria-invalid`, form error `role="alert"`, or visible focus rings. If controls are collapsed, the collapsed trigger must have an accessible name and state.

4. Gate or relocate pre-submit exploration surfaces on mobile. `PriceCalendar`, trip inspiration, and recent searches must not appear between the required fields and the submit button at 375px. If shown on the form page, they should appear after the primary CTA or behind a clearly secondary affordance. The spec must state the desktop behavior separately because 1280px has room for richer side-by-side support.

5. Make inventory scope copy exact and low-friction. The default CTA and selected intent must tell the user what will be searched without requiring them to read three descriptions. UXDES should specify final copy for `Flights`, `Hotels`, and `Flight + hotel` states, including when hotel search is unavailable because destination, round-trip dates, or return date are missing.

## Acceptance Criteria For UXDES

- The design spec covers default, loading, empty/validation-error, mobile 375px, desktop 1280px, focus/keyboard, and edge states for the mobile form.
- At 375px, the submit button appears before trip inspiration, recent searches, and any price-calendar module.
- At 375px, route and date fields are visually higher priority than search intent, flexible dates, and passenger count.
- All existing search form data still maps to the current state contract in `app/page.tsx`: `searchIntent`, `tripType`, `origin`, `dest`, `depart`, `returnDate`, `passengers`, and `flexDates`.
- The spec requires no API, provider, scoring, cache, or business-logic changes unless UXDES explicitly identifies a logic gap for a later DEV ticket.
- QA checks must include keyboard tab order from the first control through submit, visible focus for every collapsed or visible control, form-error announcement, and no overlapping or clipped text at 375px and 1280px.

## Notes For UI Stage

This should be treated as a UI hierarchy repair, not a new feature. The UI stage should preserve existing props, API calls, provider behavior, scoring, URL sync, recent-search storage, inspiration selection behavior, and submit logic unless the UXDES spec creates a separate DEV handoff.
