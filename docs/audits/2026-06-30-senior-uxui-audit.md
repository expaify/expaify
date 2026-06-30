# AUDIT-SENIOR-UXUI-01: Senior UX/UI Audit

Date: 2026-06-30  
Role: Senior QA Engineer  
Scope: Strict audit only. No product code changed.

## Executive Decision

No P0/P1 UX issues remain in the inspected current repaired product surface.

The homepage search form, 375px stacking behavior, flight cards, hotel unavailable/empty states, hotel score panels, booking review guardrails, alert failure messaging, and score-ranking stability all show current repairs in code. Remaining issues are P2 trust/clarity defects that can still confuse users, but I did not find evidence of a release-blocking UX failure in this pass.

Runtime browser verification was blocked because the sandbox refused to bind the Next dev server: `listen EPERM: operation not permitted 0.0.0.0:3001`. Evidence below is source-level and reproducible from the current code paths.

## Surfaces Reviewed

- Homepage and search form: `app/page.tsx`
- Flight results and route alert card: `components/flights/FlightResults.tsx`
- Flight cards and booking CTA state: `app/components/FlightCard.tsx`
- Hotel cards and hotel score state: `app/components/HotelCard.tsx`
- Booking review and paused booking states: `app/book/page.tsx`, `app/book/BookingFlow.tsx`
- Search, calendar, score, booking, and alert API paths: `app/api/search/route.ts`, `app/api/calendar/route.ts`, `app/api/score/route.ts`, `app/api/book/route.ts`, `app/api/alerts/route.ts`
- Provider price scope and passenger context: `lib/providers/travelpayouts.ts`, `lib/providers/duffel.ts`, `lib/providers/amadeus.ts`, `lib/providers/kiwi.ts`, `lib/providers/hotellook.ts`

## Findings

### 1. P2: Shared search links lose user-selected trip state

Evidence: The share handler only writes `origin`, `dest`, `depart`, and `return` to the copied URL (`app/page.tsx:456`). Initial URL hydration only reads those same fields (`app/page.tsx:236`). It does not preserve `tripType`, `passengers`, `flexDates`, sort, or stop filter, even though search sends passengers to `/api/search` (`app/page.tsx:355`) and the results header displays multi-passenger context (`app/page.tsx:828`).

Repro:

1. On the homepage, select one way, 4 passengers, and flexible dates.
2. Run a search.
3. Click Share in the results header.
4. Open the copied URL in a new tab.
5. The form reloads with default round trip, 1 passenger, and flexible dates off.

Impact: Shared results are not faithful to the searched itinerary. This is a trust issue for travel planning because recipients can unknowingly re-run a different search than the sender intended.

Recommended repair ticket: `REPAIR-SHARE-STATE-01` - preserve `tripType`, `passengers`, `flex`, and active result controls in share URLs; hydrate them back into the form; add a regression test for one-way multi-passenger flexible searches.

### 2. P2: Route alert copy hides the actual threshold and can mix per-person and party-total prices

Evidence: The alert UI says "Get an email when prices drop below today's level" (`components/flights/FlightResults.tsx:204`) but does not display the dollar threshold. The submitted threshold is `Math.min(...flights.map(fare => fare.price.priceCents))` (`app/page.tsx:439`). Current providers can return different price scopes: Travelpayouts marks prices `per_person` (`lib/providers/travelpayouts.ts:159`), while Duffel and Amadeus mark prices `party_total` (`lib/providers/duffel.ts:178`, `lib/providers/amadeus.ts:212`).

Repro:

1. Search with 2+ passengers on a route where both Travelpayouts and a party-total provider return fares.
2. Observe the route alert card only promises "below today's level" and asks for email.
3. Submit the alert.
4. The API receives the cheapest raw `priceCents`, without visible explanation of whether that threshold is per person or total party price.

Impact: Users can sign up for an alert with a threshold they never saw and that may not match the price basis they expect. This is lower severity than broken booking because it is notification-only, but it damages confidence in the alert product surface.

Recommended repair ticket: `REPAIR-ALERT-THRESHOLD-COPY-01` - show the exact alert threshold and price basis before submit; derive the threshold from a normalized price scope or restrict alerts to a single clearly labeled basis.

### 3. P2: Some provider failures are silently hidden from the results trust copy

Evidence: `/api/search` streams notices for Travelpayouts failures (`app/api/search/route.ts:128`) and non-configuration Duffel failures (`app/api/search/route.ts:132`), but Amadeus and Kiwi failures are ignored (`app/api/search/route.ts:136`, `app/api/search/route.ts:139`). The results UI can render provider notices when supplied (`components/flights/FlightResults.tsx:106`), and it changes the empty state to "Providers unavailable" only when notices exist (`components/flights/FlightResults.tsx:90`).

Repro:

1. Configure a search where Amadeus or Kiwi returns `{ ok: false, reason: ... }`.
2. Run a destination/date search.
3. Observe that no notice is streamed for those providers.
4. If no other provider returns fares or notices, the empty state reads as "No flights found" instead of explaining provider unavailability.

Impact: Users may interpret a provider outage or credential/API problem as real lack of inventory. This is a trust-copy issue, not a layout failure.

Recommended repair ticket: `REPAIR-PROVIDER-NOTICES-UX-01` - stream sanitized notices for all live provider failures that affect result coverage, while suppressing only expected inactive-provider configuration messages.

### 4. P2: Calendar heatmap can render misleading expensive-day color when no positive prices exist

Evidence: `PriceCalendar` filters positive values, then calls `Math.min(...values)` and `Math.max(...values)` without guarding an empty array (`app/page.tsx:139`). The calendar renders whenever `Object.keys(calendarPrices).length > 0` (`app/page.tsx:635`), not when positive prices exist. If the calendar API returns dates with `0` or invalid non-positive values, `min` becomes `Infinity`, `max` becomes `-Infinity`, and priced cells can fall through to the red "Expensive" styling branch (`app/page.tsx:160`).

Repro:

1. Have `/api/calendar` return an object with date keys but no positive prices, such as `{ "2026-07-01": 0 }`.
2. Homepage sees keys and renders `PriceCalendar`.
3. The heatmap legend still claims Cheap/Expensive even though no valid price distribution exists.

Impact: The date helper can imply price intelligence where there is no usable price data. This is an edge state and not a primary flow blocker.

Recommended repair ticket: `REPAIR-CALENDAR-EMPTY-DISTRIBUTION-01` - render no calendar, or a neutral unavailable state, unless at least one positive price point exists; add a focused component/unit test for all-zero calendar data.

## Closed Checks

- Mobile 375px form layout is now stacked for origin/destination and dates (`app/page.tsx:563`, `app/page.tsx:601`).
- Flight Deal Score cards show percentile/limited-history copy plus explanation (`app/components/FlightCard.tsx:143`).
- Hotel cards show Deal Score explanation, usual price, and vs-median copy (`app/components/HotelCard.tsx:98`).
- Booking review is guarded when booking is disabled and shows selected fare context instead of collecting passenger details (`app/book/BookingFlow.tsx:198`).
- Multi-passenger booking review is paused rather than collecting only one passenger (`app/book/BookingFlow.tsx:208`).
- Alert signup failures are visible in the route alert card (`components/flights/FlightResults.tsx:230`).
- Deal ranking defers deal-sort reorder while scores are still loading (`app/page.tsx:488`, `app/page.tsx:493`).

## Out-of-Scope Findings / Blockers

- Browser screenshot verification was blocked by the sandbox server bind failure: `npm run dev` failed with `listen EPERM: operation not permitted 0.0.0.0:3001`.
- I did not run live vendor APIs or verify external inventory.
- I did not modify product code.
- I did not reopen older repaired issues for passenger propagation, Duffel cache separation, hotel price units, hotel score explanation, or ranking jumps because the current code contains direct repairs for those paths.
