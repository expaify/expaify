# UX Research: Price Alert Signup Discoverability

Ticket: `UXR-PRICE-ALERT-SIGNUP-01`
Stage: UX Research
Priority: P1
Date: 2026-07-02

## Source Inputs

- Discovery report: `docs/pipeline/price-alert-signup/01-discovery.md`
- Current implementation audited:
  - `app/page.tsx`
  - `components/flights/FlightResults.tsx`
  - `app/api/alerts/route.ts`
  - `app/components/AlertSignup.tsx`
- Reference pattern checked:
  - Google Travel Help, "Track flights & prices": https://support.google.com/travel/answer/6235879

## Research Summary

The alert signup is positioned as a trailing module after all visible flight cards, so it behaves like a footer promotion rather than a route-level action. This conflicts with the user intent described by Google Flights' own help pattern: price tracking exists for users who are not ready to book and want to monitor routes, dates, or specific flights. That intent happens before or during comparison, not after the user has finished scanning every fare.

The current implementation also gates discovery on result volume. A completed destination search with one or two fares is eligible for route tracking from a user perspective, but the UI provides no alert entry point because `FlightResults` requires `flights.length >= 3`.

## Current Implementation Findings

### 1. Alert state is owned by the page, but the only live flight alert UI is buried in results

`app/page.tsx` owns `alertEmail`, `alertSent`, `alertLoading`, and `alertError`, resets alert state on each search, and passes that state into `FlightResults` (`app/page.tsx:546` to `app/page.tsx:549`, `app/page.tsx:749` to `app/page.tsx:750`, `app/page.tsx:1449` to `app/page.tsx:1475`).

`components/flights/FlightResults.tsx` renders the live "Track this route" module only after the result-card grid (`components/flights/FlightResults.tsx:373` to `components/flights/FlightResults.tsx:386`). On mobile, each flight card is single-column before the `sm` breakpoint (`components/flights/FlightResults.tsx:373`), so three eligible results place the signup after at least three card heights plus the summary panel and baggage estimator.

### 2. Eligibility is coupled to result count, not route-trackability

The alert module renders only when all of these are true: the search is complete, the destination string is present, and `flights.length >= 3` (`components/flights/FlightResults.tsx:386`). That means completed destination searches with one or two fares have no route-tracking CTA, even though the page can compute a threshold from one or more fares in `handleAlertSubmit` (`app/page.tsx:855` to `app/page.tsx:870`).

The code already blocks alert submit when there is no email, no origin, no destination, or zero fares (`app/page.tsx:855`). The display gate is stricter than the submit gate, which creates an avoidable no-op state for low-inventory destination searches.

### 3. The result summary is the correct interaction neighborhood, but it currently contains only passive metrics and controls

The summary area already appears above the cards whenever fares exist or a search is running (`components/flights/FlightResults.tsx:231` to `components/flights/FlightResults.tsx:327`). It contains the lowest live fare, Great deal count, nonstop count, sort controls, stop filters, result count, and ranking update status. This is where users decide whether the current result set is worth booking, filtering, or monitoring.

The gap is that "Track this route" is not available in that same decision area. The current placement asks the user to inspect the whole result list before learning expaify can keep watching the route.

### 4. Loading, empty, and provider-unavailable states do not expose a follow-up monitoring path

The loading state shows a status panel and skeleton cards (`components/flights/FlightResults.tsx:338` to `components/flights/FlightResults.tsx:358`). The empty state distinguishes missing dates, filters hiding fares, provider unavailable, and no inventory (`components/flights/FlightResults.tsx:163` to `components/flights/FlightResults.tsx:178`, `components/flights/FlightResults.tsx:359` to `components/flights/FlightResults.tsx:370`). None of those states expose an alert affordance.

This is acceptable for incomplete route data, but not for completed origin-destination-date searches where current inventory is thin or temporarily unavailable. Those users are exactly the users most likely to want monitoring instead of immediate booking.

### 5. The copy under-specifies threshold and confidence

The current CTA says: "Get an email when prices drop below the current live range for this search" (`components/flights/FlightResults.tsx:391` to `components/flights/FlightResults.tsx:394`). The submitted threshold is actually the minimum price across all returned fares (`app/page.tsx:869`), not a range. The API success copy returns a dollar threshold after persistence (`app/api/alerts/route.ts:102` to `app/api/alerts/route.ts:106`).

Design should not promise a range unless the implementation computes and displays one. For thin result sets, the copy should be explicit that alert thresholds are based on current returned fares and that fares can change before booking.

### 6. There is an unused standalone alert component with incompatible interaction shape

`app/components/AlertSignup.tsx` implements a separate alert form with user-entered target price and local state, but it is not imported by the current search page. It sends `targetPrice` as a float-derived dollar value (`app/components/AlertSignup.tsx:72` to `app/components/AlertSignup.tsx:100`), while the live result flow sends integer `thresholdCents` from normalized fares (`app/page.tsx:861` to `app/page.tsx:870`).

The design stage should not build against the unused component unless the implementation stage explicitly consolidates it. The active contract for this ticket is the `app/page.tsx` to `components/flights/FlightResults.tsx` path.

## Reference Pattern Comparison

### Google Flights

Google frames price tracking as a task for users who are not ready to book and want to monitor flight prices by route, dates, or specific flights. Interaction-wise, this places tracking near search context and comparison controls, because the decision is "book now or watch" rather than "finish the result list, then discover monitoring."

Current expaify delta: expaify offers "book" actions on cards and sort/filter controls above cards, but route tracking appears only after the grid and only after three or more fares. The user has no above-list "watch this route" decision point.

### Booking/Kayak-style travel pattern

Travel marketplaces commonly treat save/track/alert actions as contextual actions attached to the search context, a result, or an empty/low-confidence recovery state. The important pattern is not visual style; it is that monitoring is exposed before abandonment, especially when the user is not ready to book.

Current expaify delta: expaify's empty and low-inventory states ask users to edit, retry, or clear filters, but do not offer route monitoring when the route is otherwise complete.

## Design Directives For UXDES

1. Move route alert discovery above the flight-card grid for completed destination flight searches.
   - Required placement: inside or immediately adjacent to the existing flight summary/control panel, before `BaggageFeeEstimator` and before the result-card grid.
   - It must be visible after search completion without requiring the user to scroll past all cards on 375px mobile.

2. Decouple alert visibility from `flights.length >= 3`.
   - Show the alert affordance for completed origin + destination flight searches with at least one returned fare.
   - Do not show an enabled alert signup when origin or destination is missing, when date validation has failed, or when no fare-derived threshold exists.
   - For one or two fares, use conservative copy such as "Based on the fares returned for this search" rather than implying broad route confidence.

3. Add a low-inventory recovery variant.
   - When a completed destination search returns zero fares because providers have no usable inventory or are unavailable, show a non-submittable route-tracking prompt or disabled CTA only if the backend cannot compute a threshold.
   - Copy must explain the blocker plainly: "We need at least one live fare before setting a drop alert."
   - Keep the primary recovery action as `Retry search` or `Edit search`; the alert affordance must not replace the state-specific recovery action.

4. Make threshold language exact.
   - If implementation continues to submit the cheapest returned fare as `thresholdCents`, visible copy must say "below [formatted cheapest fare]" or "below the cheapest fare returned for this search."
   - Do not use "current live range" unless the UI displays both min and max and the backend stores the intended threshold.
   - After success, confirm the route and threshold in the status text, not only "You're on the list."

5. Preserve accessible form behavior in every state.
   - Email input requires a visible or programmatic label.
   - Loading state must disable duplicate submit and announce progress.
   - Error state must use `role="alert"` and keep the entered email intact.
   - Success state must use `role="status"` and remain visible where the signup was submitted.
   - Keyboard users must reach route tracking before individual result cards when the alert module is visually above the card grid.

## Acceptance Criteria For Design Review

- A first-time user on a 375px viewport can see that route tracking exists before scrolling past the complete flight result list.
- A completed destination search with exactly one or two fares exposes a route alert affordance.
- A completed destination search with zero fares does not claim an alert was settable without a fare-derived threshold.
- The copy names the actual threshold basis and does not imply more price confidence than the returned data supports.
- The design covers default, loading, success, error, zero-fare, one/two-fare, mobile 375px, desktop 1280px, keyboard, and provider-unavailable states.
