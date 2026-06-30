# AUDIT-RESULTS-INTERACTION-FEEDBACK-TRUST-01: Results Interaction Feedback Trust

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Audit only. No product code changed.

## Verdict

Not ready for paid-user interaction-trust signoff.

The current results surface has solid baseline feedback for sort buttons, stop filters, provider CTAs, loading skeletons, disabled hotel tabs, and error panels. The blocking issue is that part of the requested interaction model does not exist in this repo: there is no `TicketCard`, `TicketSlideOver`, `NewTicketModal`, result card expansion, or result detail open/close flow. Result cards are static information cards with only booking CTAs and adjacent controls interactive.

## Files Inspected

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx`
- `app/globals.css`
- `components/flights/__tests__/FlightResults.test.tsx`
- Local Next docs: `node_modules/next/dist/docs/01-app/index.md`, `node_modules/next/dist/docs/03-architecture/accessibility.md`

Requested files not present:

- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`
- `components/NewTicketModal.tsx`

Repo search also found no result-level `dialog`, `aria-modal`, `expanded`, slideover, or detail-panel implementation in `app/` or `components/`.

## Interactive Element Coverage

### Results header edit/search summary

Location: `app/page.tsx:1244` to `app/page.tsx:1272`

- Normal: sticky header shows route context and an Edit affordance.
- Hover: border/background changes on the route button; brand button fades opacity.
- Focus: global `:focus-visible` applies outline and ring from `app/globals.css:136` to `app/globals.css:144`.
- Loading: page-level progress bar appears during search at `app/page.tsx:1242`.
- Disabled: not disabled.
- Error: search error content appears below, not in the header.

Assessment: usable, but the brand text button has only opacity hover, which is weaker than the route edit button.

### Share button

Location: `app/page.tsx:850` to `app/page.tsx:856`, `app/page.tsx:1306` to `app/page.tsx:1325`

- Normal: "Share" button with icon.
- Hover: `.btn-pill:hover` changes text, border, and background (`app/globals.css:265` to `app/globals.css:269`).
- Focus: `.btn-pill:focus-visible` applies focus ring (`app/globals.css:270`).
- Pressed/success: label changes to "Copied!" for 2 seconds.
- Loading: none.
- Disabled/error: no disabled state and no clipboard failure feedback.

Finding: clipboard failure is silent. Repro: deny clipboard permission or use a browser/context where `navigator.clipboard.writeText` rejects, click Share. Result: no error or fallback state, making the button appear dead.

### Flights/hotels tabs

Location: `app/page.tsx:1363` to `app/page.tsx:1397`

- Normal: active tab has text contrast, count chip, and underline.
- Hover: inactive enabled tab text lightens.
- Focus: global focus ring applies.
- Selected: active state is visible through text, chip, and underline, not color alone.
- Disabled: hotels tab disables when unavailable and shows "Unavailable".
- Loading: hotels may remain unavailable while search runs; hotel skeletons render if active hotel tab is available.
- Error: tabs are hidden when the top-level search error panel renders.

Assessment: disabled and selected states are understandable. Keyboard focus should be visible by global CSS.

### Flight sort controls

Location: `components/flights/FlightResults.tsx:217` to `components/flights/FlightResults.tsx:277`

- Normal: two button controls, "Best deal" and "Lowest price".
- Hover: `.btn-pill:hover` changes text, border, and background.
- Focus: `.btn-pill:focus-visible` applies focus ring.
- Pressed/selected: `aria-pressed` plus visible "On" chip and active inset ring.
- Loading: live summary adds "Updating deal ranking as scores finish" when deal ranking is still settling.
- Disabled: controls disable when no fares exist and summary explains they become available after fares load.
- Error: top-level search error hides result controls; provider notices show separately.

Assessment: this is the strongest interaction feedback surface. It does not rely only on color because selected controls add text "On" and `aria-pressed`.

### Stops filter controls

Location: `components/flights/FlightResults.tsx:242` to `components/flights/FlightResults.tsx:260`

- Normal: All stops, Nonstop, and 1 stop buttons.
- Hover/focus/selected/disabled: same `btn-pill` behavior as sort.
- Loading: disabled until fares exist.
- Empty after interaction: when a filter hides fares, the empty state says "Filters are hiding the available fares" and provides "Show all stops" (`components/flights/FlightResults.tsx:157` to `components/flights/FlightResults.tsx:180`, `components/flights/FlightResults.tsx:310` to `components/flights/FlightResults.tsx:321`).

Assessment: clear and recoverable. Good accessible feedback.

### Flight result card body

Location: `components/flights/FlightResults.tsx:324` to `components/flights/FlightResults.tsx:334`, `app/components/FlightCard.tsx:270` to `app/components/FlightCard.tsx:382`

- Normal: static card with route, carrier/source, stops, cabin, itinerary, Deal Score, and CTA.
- Hover: shared `.card:hover` lifts every card (`app/globals.css:170` to `app/globals.css:180`).
- Focus: card body is not focusable.
- Pressed/selected: none.
- Loading: skeleton card renders when `fare` is undefined (`app/components/FlightCard.tsx:217` to `app/components/FlightCard.tsx:235`).
- Disabled/error: price and Deal Score unavailable states render inside the card.

Finding: card hover implies clickability, but the card body does nothing. Repro: hover and click anywhere on a flight card outside the CTA. Result: the card visually lifts but no state changes and no detail opens. This is misleading feedback.

### Result detail open/close

Location: absent.

- Normal: no detail opener exists.
- Hover/focus/pressed/loading/disabled/error: not applicable.
- Close behavior: not applicable.

Finding: acceptance cannot be completed. There is no card expansion, slideover, modal, close button, Escape handling, backdrop behavior, scroll containment, or return-focus path for results. Current facts are embedded directly in cards.

### Flight booking CTA

Location: `app/components/FlightCard.tsx:352` to `app/components/FlightCard.tsx:379`

- Normal: valid fare renders an anchor. External providers open in a new tab with `noopener noreferrer sponsored`; internal Duffel review link stays internal.
- Hover: valid CTA uses opacity change.
- Focus: explicit focus outline plus global focus styling.
- Pressed/loading: no loading or pressed persistence after activation.
- Disabled: invalid price or deeplink renders a disabled button with explanatory note.
- Error: unavailable price/Deal Score states are shown separately; provider handoff errors after click are outside this app.

Assessment: honest about provider handoff and unavailable states. Hover feedback is weaker than `.btn-primary` because it only changes opacity, but focus is visible.

### Hotel card and hotel CTA

Location: `app/components/HotelCard.tsx:187` to `app/components/HotelCard.tsx:290`

- Normal: static hotel card with image or "Hotel photo unavailable", facts, optional score, price, and CTA.
- Hover: shared `.card:hover` lifts static card.
- Focus: card body is not focusable; CTA gets `btn-primary` focus styles.
- Loading: hotel score shimmer and hotel skeletons render.
- Disabled: invalid price or deeplink renders a non-clickable "Booking unavailable" status with reason.
- Error: hotel unavailable/empty states render at the page level.

Finding: same card-body affordance mismatch as flights. Hover suggests the whole hotel card is selectable, but only the CTA is actionable.

### Track route alert form

Location: `components/flights/FlightResults.tsx:337` onward

- Normal: email input plus "Notify me" submit after a destination search with at least three fares.
- Hover/focus: input and button use shared field/button states.
- Loading: submit button changes to "Setting..." and disables.
- Disabled: submit disabled while loading.
- Error: inline `role="alert"` message is shown.

Assessment: feedback is coherent once submitted. Existing out-of-scope trust issue remains: the UI can present enabled alerts even if server-side email configuration is missing.

### Empty, loading, and error panels

Locations: `components/flights/FlightResults.tsx:289` to `components/flights/FlightResults.tsx:321`, `app/page.tsx:1328` to `app/page.tsx:1358`, `app/page.tsx:1451` to `app/page.tsx:1470`

- Loading: status copy, pulsing dots, progress bar, and skeleton cards.
- Empty: separate copy for missing dates, provider unavailable, no inventory, filters hiding results, and hotels unavailable.
- Error: `role="alert"` panel with Retry search and Edit search.
- Focus: actions use shared focus styles.

Assessment: coherent and not fake-data driven. Loading animation has reduced-motion handling in `app/globals.css:317` to `app/globals.css:324`.

## Findings

### P1 - Result detail open/close flow does not exist

Files:

- `components/flights/FlightResults.tsx:324`
- `app/components/FlightCard.tsx:270`
- `app/components/HotelCard.tsx:187`

Evidence:

- Flight results map directly to static `FlightCard` instances.
- Hotel results map directly to static `HotelCard` instances.
- The requested `TicketCard`, `TicketSlideOver`, and `NewTicketModal` files are absent.
- Repo search found no result-level dialog, modal, slideover, expanded state, or close behavior.

Repro:

1. Run or inspect a search results view.
2. Click a flight or hotel card body.
3. Try to open details, close details, press Escape, or return focus to the opener.

Result: there is no detail surface to open or close.

Impact: the manual verification flow required by the ticket cannot pass. This is a product/implementation gap, not a QA-only ambiguity.

### P1 - Static result cards provide hover feedback that implies clickability

Files:

- `app/globals.css:170`
- `app/globals.css:177`
- `app/components/FlightCard.tsx:271`
- `app/components/HotelCard.tsx:188`

Evidence:

- Shared `.card:hover` changes border, shadow, and background for every card.
- Flight and hotel cards are static containers; only nested CTAs are actionable.

Repro:

1. Open results on desktop.
2. Hover a flight or hotel card outside the CTA.
3. Click the card body.

Result: the card lifts visually, then the click does nothing.

Impact: this is misleading feedback on the primary results surface. It makes the interface feel dead even though the CTA works.

### P2 - Share action has success feedback but no failure feedback

File: `app/page.tsx:850`

Evidence:

- `navigator.clipboard.writeText(...).then(...)` only handles success.
- There is no `.catch`, disabled state, or visible fallback.

Repro:

1. Use a context where clipboard write is rejected.
2. Click Share.

Result: no copied state and no error message.

Impact: the interaction can appear dead. This is scoped to feedback, not a request for new sharing channels.

### P2 - Mobile result itinerary has tight fixed columns that need live verification

File: `app/components/FlightCard.tsx:299` to `app/components/FlightCard.tsx:325`

Evidence:

- The itinerary row uses two fixed `w-[4.75rem]` endpoint columns and an absolute center badge.
- At 375px, the card likely remains usable for IATA codes, but long times, zoomed text, or translated copy could crowd the middle label.

Impact: not confirmed as clipping in this environment, but it is a mobile-fit risk for the required 375px review.

## Manual Verification Flow

Could not complete full browser verification because the sandbox blocks local server binding.

Source-reviewed flow:

1. Run a search: `runSearch` clears prior results, enters results view, starts progress feedback, streams fares, and fires score loading (`app/page.tsx:690` to `app/page.tsx:762`).
2. Interact with sort/filter controls: controls update state, persist URL, show `aria-pressed`, visible "On" chips, and live summary (`app/page.tsx:864` to `app/page.tsx:877`, `components/flights/FlightResults.tsx:217` to `components/flights/FlightResults.tsx:277`).
3. Open/close result details: blocked because no detail interaction exists.
4. Activate booking CTA: flight and hotel CTAs are valid anchors when price and deeplink are valid; disabled/unavailable states are explicit (`app/components/FlightCard.tsx:352` to `app/components/FlightCard.tsx:379`, `app/components/HotelCard.tsx:254` to `app/components/HotelCard.tsx:286`).
5. Return to results: external provider links open in a new tab for flights/hotels, so the results page should remain available; internal Duffel link navigates to review-only booking.

## Mobile 375px Review

Source review only:

- Results header stacks before `sm` (`app/page.tsx:1275` to `app/page.tsx:1326`).
- Tabs scroll horizontally (`app/page.tsx:1363`).
- Flight controls use mobile grids and minimum tap heights (`components/flights/FlightResults.tsx:217` to `components/flights/FlightResults.tsx:260`).
- Flight/hotel grids are single-column before `sm` (`components/flights/FlightResults.tsx:304`, `components/flights/FlightResults.tsx:324`, `app/page.tsx:1437`, `app/page.tsx:1472`).
- CTAs are full width on mobile (`app/components/FlightCard.tsx:359`, `app/components/HotelCard.tsx:262`).

Risk: flight itinerary fixed columns need live visual confirmation at 375px.

## Desktop Keyboard Review

Source review only:

- Global focus styles are defined for buttons, links, inputs, selects, textareas, summaries, and tabindex nodes (`app/globals.css:136` to `app/globals.css:144`).
- Sort and filter buttons are native buttons with `aria-pressed`.
- Disabled buttons and tabs use native `disabled`.
- Booking CTAs are anchors with accessible labels.

Risk: no detail opener/closer means no focus-order verification for expansion or return-focus behavior.

## Final Self-Review

- Hierarchy: result controls, status panels, cards, and CTAs are generally clear.
- Contrast: focus rings and button states are explicit; disabled gray-on-dark hotel tab is low emphasis but understandable.
- Spacing: mobile grids and full-width CTAs look structurally sound by source review.
- Mobile fit: likely usable at 375px except itinerary crowding risk.
- Focus states: global focus is present; selected filters do not rely only on color.
- Decorative effects: no cheap decorative animation in results; animations are functional loading/fade transitions with reduced-motion support.

## Verification Commands

- `npm run dev -- --hostname 127.0.0.1 --port 3021` - blocked by sandbox server bind failure: `listen EPERM`.
- `npm run tsc` - failed because `package.json` has no `tsc` script.
- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand` - passed. 20 suites passed, 172 tests passed.
- `npm test -- --passWithNoTests` - passed. 20 suites passed, 172 tests passed.

## Required Return Note

- What changed and why: Added this QA audit report documenting results interaction feedback behavior, missing detail open/close flow, misleading card hover affordance, and share failure feedback gap.
- Files changed: `docs/audits/2026-06-30-audit-results-interaction-feedback-trust-01.md`.
- Verification commands and results: `npm run tsc` failed because no script exists; `npx tsc --noEmit --incremental false` passed; `npm test -- --runInBand` passed with 20 suites and 172 tests; `npm test -- --passWithNoTests` passed with 20 suites and 172 tests; `npm run dev -- --hostname 127.0.0.1 --port 3021` was blocked by sandbox server binding (`EPERM`).
- Out-of-scope findings or blockers: Browser/manual verification was blocked by sandbox server binding. No feature code was changed. Detail expansion cannot be verified because it does not exist in the current implementation.
