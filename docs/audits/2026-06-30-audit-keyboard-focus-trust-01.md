# AUDIT-KEYBOARD-FOCUS-TRUST-01: Keyboard and Focus Trust Breaks

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Strict audit only. No product code changed.

## Executive Decision

Not ready for paid-user keyboard and assistive-technology trust.

The search, results, flight card, hotel card, and booking review paths are mostly keyboard reachable because they use native buttons, links, inputs, selects, and summary/details. The trust breaks are in missing accessible names, missing selected-state semantics, weak or contextless focus targets, and booking/price action labels that omit the price or selected provider context users need before handoff.

## Surfaces Inspected

- `app/page.tsx`
- `app/components/AirportInput.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/globals.css`
- `node_modules/next/dist/docs/03-architecture/accessibility.md`

Requested files not present in this worktree:

- `app/components/SearchForm.tsx`
- `app/components/BookingReview.tsx`
- `app/book/[id]/page.tsx`

Current equivalents used for audit:

- Search form is inline in `app/page.tsx`.
- Booking review is implemented by `app/book/page.tsx` and `app/book/BookingFlow.tsx`.
- Flight results are wrapped by `components/flights/FlightResults.tsx`, which renders `app/components/FlightCard.tsx`.

## Keyboard-Only Checkpoints

1. Homepage search form: Tab through theme toggle, trip type, origin combobox, swap, destination combobox, date fields, flexible dates, passenger steppers, submit, route suggestions, and recent searches. Expected: each control has a visible focus state, useful accessible name, and keyboard activation.
2. Airport combobox: Type a city or airport, use ArrowDown/ArrowUp, Enter, Escape, and Tab/blur. Expected: suggestions are keyboard selectable and the current active option is announced.
3. Results controls: After search, Tab through header edit controls, Share, Flights/Hotels tabs, sort controls, stop filters, baggage estimator if present, flight cards, and alert signup. Expected: selected tab/filter state and disabled/unavailable states are announced.
4. Flight card: Tab to provider or booking review CTA. Expected: CTA announces provider, route, actual price, price basis, and whether the action is an external provider link or in-app review.
5. Hotel card: Switch to Hotels when available, Tab to bookable and unavailable hotel card states. Expected: book action announces hotel name, provider, nightly price, taxes/fees caveat, and unavailable states are discoverable without pointer.
6. Booking review: Open `/book` with a valid fare context and Tab through Back to search, technical reference summary, traveler fields, submit, recovery links, and error retry. Expected: focus order follows visual order and all review facts needed for booking trust are announced.
7. Mobile 375px responsive keyboard review: Repeat checkpoints 1 through 6 with narrow layout. Expected: sticky submit does not hide focused controls, no horizontal overflow, no hidden primary action.

## Findings

### P1 - Search form labels are visible but not programmatically associated

Evidence: The visible labels for From, To, Depart, and Return do not use `htmlFor` and do not wrap the inputs (`app/page.tsx:848` to `app/page.tsx:897`, `app/page.tsx:901` to `app/page.tsx:914`). `AirportInput` receives an `id`, but its parent label is only text; date inputs have no `id` at all. The combobox has placeholder text, but no `aria-label` or associated label (`app/components/AirportInput.tsx:134` to `app/components/AirportInput.tsx:150`).

Repro:

1. Open `/`.
2. Start screen reader or inspect the accessibility tree.
3. Tab to From, To, Depart, and Return fields.

Result: The visual labels are not guaranteed to be announced as the input names. The user may hear placeholder text or generic date input announcements instead of "From", "To", "Depart", and "Return".

Impact: Keyboard and screen-reader users can enter data, but the form loses trust because the active field context is ambiguous.

### P1 - Trip type and results tabs do not expose selected tab/radio semantics

Evidence: Trip type is rendered as two plain buttons with visual selected styling only; there is no `aria-pressed`, `role="radiogroup"`, or radio input state (`app/page.tsx:829` to `app/page.tsx:843`). Results tabs are also buttons with visual active underline only; they do not use `role="tablist"`, `role="tab"`, or `aria-selected` (`app/page.tsx:1144` to `app/page.tsx:1175`).

Repro:

1. Tab to "Round trip" and "One way" on the homepage.
2. Search and Tab to "Flights" and "Hotels" in results.
3. Listen for selected state.

Result: Keyboard activation works with Enter/Space, but selected state is not exposed semantically.

Impact: A non-visual user cannot reliably tell which trip mode or results tab is active.

### P1 - Disabled Hotels tab is skipped by keyboard and its unavailable reason is not tied to the tab

Evidence: When hotels are unavailable, the Hotels button is rendered with `disabled` and `aria-disabled` (`app/page.tsx:1148` to `app/page.tsx:1158`). Disabled buttons are removed from normal tab order. The explanation is rendered separately below the tab row with no `aria-describedby` relationship to the skipped control (`app/page.tsx:1180` to `app/page.tsx:1184`).

Repro:

1. Search without a destination, without round-trip dates, or when hotel availability is unavailable.
2. Use Tab from Share through the result controls.

Result: Focus reaches Flights, then skips Hotels. The unavailable reason is visible but not associated with the disabled tab.

Impact: Keyboard users may not discover that hotel results exist as a concept or why the tab cannot be opened.

### P1 - Calendar date buttons lack full accessible names and selected state

Evidence: `PriceCalendar` renders each day as a button whose content is only day-of-month plus an optional rounded dollar amount (`app/page.tsx:299` to `app/page.tsx:312`). It does not include `aria-label` with the full date, does not expose `aria-pressed`/selected state, and selected state is only a ring class (`app/page.tsx:304` to `app/page.tsx:306`).

Repro:

1. Enter origin and destination that load calendar prices.
2. Tab into the calendar date buttons.

Result: Date buttons are keyboard reachable and activatable, but screen-reader context can be just "1 $123 button" rather than "June 1 selected, $123".

Impact: Flexible date selection is not trustworthy without visual context.

### P1 - Flight booking CTA accessible label omits the actual price

Evidence: `FlightCard` computes the visible price from `fare.price.priceCents` and `fare.price.currency` (`app/components/FlightCard.tsx:111` to `app/components/FlightCard.tsx:128`, rendered at `app/components/FlightCard.tsx:230`). The CTA `aria-label` includes route and price basis, but not the formatted amount or currency (`app/components/FlightCard.tsx:284` to `app/components/FlightCard.tsx:289`).

Repro:

1. Search until flight cards render.
2. Tab to a "Check with provider" or "Review paused booking" link.
3. Listen to the link name.

Result: The user hears the action, route, and "per person" or "total for N adults", but not the current fare amount.

Impact: The primary booking handoff lacks the price context users need at the point of activation.

### P1 - Hotel booking CTA accessible label omits price and taxes/fees caveat

Evidence: A bookable hotel link uses `aria-label={`Book ${hotel.name} on HotelLook`}` (`app/components/HotelCard.tsx:274` to `app/components/HotelCard.tsx:279`). The visible nightly price and "per night before taxes and fees" copy are separate (`app/components/HotelCard.tsx:49` to `app/components/HotelCard.tsx:67`).

Repro:

1. Run a round-trip destination search that returns hotels.
2. Open Hotels and Tab to "Book hotel".

Result: The link name does not include the nightly price, currency, or taxes/fees caveat.

Impact: The hotel handoff action is less trustworthy for screen-reader users than the visual card.

### P2 - Deal Score panels are visually clear but not grouped or labelled as score summaries

Evidence: Flight score content is rendered inside a plain `div` with "Deal Score", percentile, badge, and explanation (`app/components/FlightCard.tsx:146` to `app/components/FlightCard.tsx:162`). Hotel score content uses a plain `div` with Deal Score, usual price, vs median, and explanation (`app/components/HotelCard.tsx:151` to `app/components/HotelCard.tsx:184`). Neither score panel has `aria-labelledby`, `role`, or a single summary label.

Repro:

1. Navigate through a scored flight or hotel card with a screen reader.
2. Review the reading order around the score panel.

Result: The text is present, but it is not announced as one coherent Deal Score summary.

Impact: The differentiator is available as text, but the relationship between verdict, confidence, percentile, usual price, and explanation is weaker than the visual design implies.

### P2 - Booking review technical reference summary has a small/contextless focus target

Evidence: The booking review `summary` text is only "Technical reference" and expands to a provider offer id (`app/book/BookingFlow.tsx:111` to `app/book/BookingFlow.tsx:114`). It has a focus shadow, but no accessible description of what opens.

Repro:

1. Open `/book` with valid fare context.
2. Tab to "Technical reference".
3. Activate with Enter/Space.

Result: Keyboard activation works, but the purpose of the disclosure is unclear until after expansion.

Impact: Low severity, but it is a trust issue on a checkout review surface because the control exposes provider identifier data without explaining why.

### P2 - Error and loading status regions are inconsistent

Evidence: Form errors use `role="alert"` (`app/page.tsx:966` to `app/page.tsx:969`). Flight state panels use `role="status"` (`components/flights/FlightResults.tsx:56` to `components/flights/FlightResults.tsx:71`). The top results error text does not use `role="alert"` or `aria-live`; only the Retry button is focusable (`app/page.tsx:1096` to `app/page.tsx:1105`). Hotel unavailable copy is plain text (`app/page.tsx:1180` to `app/page.tsx:1184`).

Repro:

1. Trigger a search error or unavailable hotel state.
2. Stay on the keyboard and listen for announcements.

Result: Some states announce automatically; others require reading from the page with no live-region cue.

Impact: Users may miss why results or hotels are unavailable.

## Focus Indicator Inventory

Strong or acceptable:

- Global `:focus-visible` outline and focus ring exist (`app/globals.css:132` to `app/globals.css:139`).
- `.field-input` has explicit focus border, background, ring, and outline removal (`app/globals.css:183` to `app/globals.css:188`).
- `.btn-primary` and `.btn-pill` have focus-visible ring/box-shadow (`app/globals.css:220` to `app/globals.css:249`).
- Flight card CTAs add explicit focus outline and offset (`app/components/FlightCard.tsx:288`).
- Booking review links/buttons generally inherit global outline and add focus shadow (`app/book/BookingFlow.tsx:163` to `app/book/BookingFlow.tsx:165`, `app/book/BookingFlow.tsx:404` to `app/book/BookingFlow.tsx:411`).

Weak or missing:

- Calendar selected date state is visual ring only and not semantic (`app/page.tsx:304` to `app/page.tsx:306`).
- Trip type selected state is visual only (`app/page.tsx:835` to `app/page.tsx:839`).
- Results tab active state is visual underline/text color only (`app/page.tsx:1158` to `app/page.tsx:1174`).
- Disabled Hotels tab cannot receive focus, so no focus indicator or associated explanation is available in tab order (`app/page.tsx:1148` to `app/page.tsx:1158`).
- Route suggestion/recent-search buttons rely on global focus but have no component-level focus styling that matches hover/active styling (`app/page.tsx:1001` to `app/page.tsx:1038`).

## Controls Not Reachable or Not Activatable by Keyboard

- True keyboard activation blockers: none observed in source for native active controls. Buttons, links, inputs, selects, and details/summary are keyboard activatable.
- Reachability failure: unavailable Hotels tab is intentionally disabled and skipped by tab order, while the reason is not programmatically connected (`app/page.tsx:1148` to `app/page.tsx:1158`, `app/page.tsx:1180` to `app/page.tsx:1184`).
- Pointer-only pattern: airport suggestions use `onMouseDown` on `role="option"` rows, but the combobox also supports ArrowUp, ArrowDown, Enter, and Escape on the input (`app/components/AirportInput.tsx:109` to `app/components/AirportInput.tsx:130`, `app/components/AirportInput.tsx:155` to `app/components/AirportInput.tsx:178`). Not a keyboard blocker.

## Price, Score, Provider, and Unavailable Label Review

- Flight price: visible price exists, but the primary CTA label omits amount/currency (`app/components/FlightCard.tsx:111` to `app/components/FlightCard.tsx:128`, `app/components/FlightCard.tsx:284` to `app/components/FlightCard.tsx:289`).
- Flight provider: card text says carrier via source and CTA says "Check with source" or "Review paused booking" (`app/components/FlightCard.tsx:191` to `app/components/FlightCard.tsx:200`, `app/components/FlightCard.tsx:221` to `app/components/FlightCard.tsx:223`). Provider context is present.
- Flight unavailable state: disabled button says "Provider link unavailable", but disabled controls are not focusable (`app/components/FlightCard.tsx:301` to `app/components/FlightCard.tsx:309`). The explanatory note is visible below (`app/components/FlightCard.tsx:311`).
- Hotel price: visible price and taxes/fees caveat exist, but the Book hotel link label omits them (`app/components/HotelCard.tsx:49` to `app/components/HotelCard.tsx:67`, `app/components/HotelCard.tsx:274` to `app/components/HotelCard.tsx:287`).
- Hotel unavailable state: a non-focusable `span role="status"` contains an aria-label with hotel name and reason (`app/components/HotelCard.tsx:290` to `app/components/HotelCard.tsx:299`). This is better than the disabled flight CTA but still not keyboard focusable.
- Deal Score: score text is present for both flight and hotel cards, but panels are not programmatically grouped as score summaries (`app/components/FlightCard.tsx:146` to `app/components/FlightCard.tsx:162`, `app/components/HotelCard.tsx:151` to `app/components/HotelCard.tsx:184`).
- Booking review price/provider: current fare and provider facts are visible in `FareSummary` (`app/book/BookingFlow.tsx:80` to `app/book/BookingFlow.tsx:109`). There is no Deal Score context on booking review in the current flow.

## Manual Verification Flow

Desktop keyboard-only flow:

1. Open `/`.
2. Press Tab to theme toggle, then trip type buttons. Confirm focus is visible and selected state is announced. Current result: focus visible; selected state not semantic.
3. Tab to From and To. Type an airport query, use ArrowDown/ArrowUp, Enter, and Escape. Current result: keyboard selection works; input label association is weak.
4. Tab through Depart, Return, Flexible dates, passenger minus/plus, Search flights, route suggestions, and recent searches. Current result: activation works; date/flexible controls need stronger labels/state.
5. Submit a search. Tab through results header, Share, Flights/Hotels, sort, stops, flight card CTA, alert email, and Notify me. Current result: activation works; Hotels disabled state and selected tabs/filters need stronger semantics.
6. Open a flight booking review CTA. Tab through Back to search, fare facts, Technical reference, traveler fields if enabled, and submit/recovery buttons. Current result: activation works; technical disclosure and review context need stronger labels.

Mobile 375px keyboard/focus review:

1. Repeat the desktop flow with viewport width 375px.
2. Confirm the search form remains single-column and controls are reachable in visual order.
3. Confirm results cards are single-column and card CTAs remain reachable.
4. Confirm booking review stacks fare summary before the action panel and sticky submit does not hide the focused control.

Source-level responsive review found no obvious hidden primary actions in the inspected components. Live browser verification was not run because the ticket requested audit only and no Playwright tooling is present in the repo.

## Out-of-Scope Findings and Blockers

- No product code was changed per ticket scope.
- `app/components/SearchForm.tsx`, `app/components/BookingReview.tsx`, and `app/book/[id]/page.tsx` are referenced by the ticket but do not exist in this worktree.
- Deal Score disappearing from booking review remains a broader booking trust issue, but this audit only documents it as screen-reader/context loss. It was not fixed.
- Hotel provider availability is limited by current app/provider behavior. This audit did not modify hotel supply or booking state.

## Verification Commands

- `npm run tsc -- --noEmit --incremental false` - failed because the repo has no `tsc` script: `npm error Missing script: "tsc"`.
- `npx tsc --noEmit --incremental false` - passed with no output.
- `npm test -- --passWithNoTests` - passed. 19 test suites passed, 151 tests passed.

## Required Return Note

- What changed and why: Added this audit report for keyboard, focus, accessible-name, and booking-handoff trust failures across search, results, flight cards, hotel cards, and booking review.
- Files changed: `docs/audits/2026-06-30-audit-keyboard-focus-trust-01.md`.
- Verification commands and results: `npm run tsc -- --noEmit --incremental false` failed because no `tsc` script exists; `npx tsc --noEmit --incremental false` passed; `npm test -- --passWithNoTests` passed with 19 suites and 151 tests.
- Out-of-scope findings or blockers: Missing requested files are listed above. No fixes, new tooling, provider changes, pricing changes, or booking state changes were made.
