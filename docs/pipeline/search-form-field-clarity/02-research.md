# UX Research: Search Form Field Clarity

Ticket: UXR-SEARCH-FORM-FIELD-CLARITY-01  
Discovery source: `docs/pipeline/search-form-field-clarity/01-discovery.md`  
Surface audited: home-page search form

## Discovery Summary

First-time users cannot quickly tell what each primary search field represents because the origin, destination, departure, and return labels are visually hidden while the visible field text is generic or absent.

This affects paid-intent users before their first search, especially on desktop where the route and date controls are scanned horizontally.

## Source Audit

### Current home-page implementation

- `app/page.tsx:1063` renders the origin label as `sr-only` with visible placeholder copy of `City or airport code`.
- `app/page.tsx:1084` renders the destination label as `sr-only` with visible placeholder copy of `Anywhere`.
- `app/page.tsx:1097` renders the departure label as `sr-only`; the visible date field has no persistent field name.
- `app/page.tsx:1123` renders the return label as `sr-only`; the visible date field has no persistent field name.
- `app/components/AirportInput.tsx:173` passes placeholder text directly into the visible input, so route-field comprehension depends on placeholder text until the user types or selects a value.
- `app/components/AirportInput.tsx:176-181` preserves combobox semantics and status descriptions, so the issue is visual clarity rather than missing programmatic accessibility.

### Existing local pattern

`components/search/SearchPanel.tsx` already contains the clearer interaction pattern:

- `components/search/SearchPanel.tsx:147-149` shows a persistent `From` label above the origin airport input.
- `components/search/SearchPanel.tsx:164-166` shows a persistent `To` label above the destination airport input.
- `components/search/SearchPanel.tsx:181-190` wraps the departure date in a visible `Depart` label.
- `components/search/SearchPanel.tsx:194-203` wraps the return date in a visible `Return` label.

This component does not appear to be imported by the active home page. The active search form in `app/page.tsx` should align with this local pattern instead of relying on hidden labels.

## Reference Patterns

### Google Flights

Google's public Travel Help flow describes the flight-search task in the same field hierarchy users expect: enter a departure city or airport, enter a destination, select trip type, passenger/class controls, then click the calendar to select dates. The interaction pattern separates route identity from example values, so users can distinguish "what this field is" from "what I can type here."

Reference: https://support.google.com/travel/answer/2475306

### Booking.com Flights

Booking.com's flights entry point uses the same basic search mental model: flight tickets are searched by origin, destination, and travel dates before results are shown. The practical pattern is persistent route/date field identity, not placeholder-only instruction.

Reference: https://www.booking.com/flights/index.html

## Exact Gap

The current active form is technically accessible but visually under-labeled.

| Field | Current code behavior | Expected pattern | Delta |
| --- | --- | --- | --- |
| Origin | Programmatic label `From`; visible text says `City or airport code` only before input. | Persistent visible `From` label plus example/helper placeholder. | Users must infer that the first airport field is origin from position and placeholder. |
| Destination | Programmatic label `To`; visible text says `Anywhere` only before input. | Persistent visible `To` label plus optional destination placeholder. | `Anywhere` reads like a selected value or mode, not a field label. |
| Depart | Programmatic label `Depart`; native date input has no visible field name. | Persistent visible `Depart` label before and after date selection. | Users scanning the form cannot identify the first date control without context. |
| Return | Programmatic label `Return`; native date input has no visible field name. | Persistent visible `Return` label when round trip is selected; hidden/removed for one way. | Users cannot distinguish return date from departure date until interacting. |

## Design Directives

1. Show persistent visible labels for the four primary fields in the active `app/page.tsx` form: `From`, `To`, `Depart`, and `Return`. Labels must remain visible before input, after input, during validation errors, and while search is loading.

2. Do not replace labels with placeholders. Keep placeholders as examples or affordances only: `City or airport code` is acceptable under `From`; `Anywhere` is acceptable under `To` only if the visible `To` label remains present.

3. Preserve the existing programmatic label relationships. Route labels must remain associated with `origin` and `dest`; date labels must be associated with their date inputs, either by `htmlFor`/`id` or by wrapping the input in the label. Existing combobox roles, `aria-*` attributes, live status text, validation `role="alert"`, and focus rings must not regress.

4. Match the compact local label style already present in `components/search/SearchPanel.tsx`: small uppercase label text above each control, using existing token-compatible Tailwind classes. The design spec should adapt that pattern to the active light home form without introducing new colors, decorative elements, or layout concepts.

5. Mobile and desktop acceptance must be explicit. At 375px, labels must not overlap icons, typed values, error text, the swap button, or the submit button. At 1280px, labels must make the two route fields and two date fields distinguishable in a fast horizontal scan.

## Acceptance Criteria For UXDES

- The design spec defines visible label treatment for default, filled, focus, loading, validation-error, one-way, round-trip, mobile 375px, and desktop 1280px states.
- The final UI copy includes exactly `From`, `To`, `Depart`, and `Return` for the primary field labels.
- The spec confirms that the destination field may still allow open-ended search, but the visible `To` label must not be replaced by `Anywhere`.
- The spec requires no API, provider, scoring, cache, or business-logic changes.
- The spec includes QA checks for keyboard tab order and screen-reader-safe label associations.
