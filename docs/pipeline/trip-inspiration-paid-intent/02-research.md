# UXR-TRIP-INSPIRATION-PAID-INTENT-01: UX Research Brief

## Upstream Input

Discovery report: `docs/pipeline/trip-inspiration-paid-intent/01-discovery.md`

Problem statement: Paid users may see trip inspiration as generic editorial content instead of actionable premium deal entry points that preserve their origin, set a plausible trip window, and lead directly into live fare and hotel verification.

## Current Implementation Audit

There are two suggestion systems in this worktree, and they do not share one user-facing contract.

### Active homepage route suggestions

`app/page.tsx` is the active first-load search surface. It defines five hardcoded route suggestions with route label, origin, destination, display labels, tag, and metadata such as `Deal history ready`, `Flexible date friendly`, `Popular route`, `Price swings often`, and `Frequent fare drops` (`app/page.tsx:35` to `app/page.tsx:40`).

The active form supports search intent, trip type, origin, destination, dates, flexible dates, passengers, and submit state (`app/page.tsx:1070` to `app/page.tsx:1275`). The route suggestion rail appears below the form under `Route suggestions` (`app/page.tsx:1280` to `app/page.tsx:1305`).

Selecting a route suggestion only sets origin and destination display state, then clears the form error (`app/page.tsx:1291` to `app/page.tsx:1298`). It does not set departure date, return date, flexible dates, passenger count, search intent, or a ready-to-search confirmation. It also does not submit the search. The user must infer that the next step is to choose dates and press the primary search CTA.

This means the active surface has stronger search controls than the orphaned `SearchPanel`, but weaker inspiration behavior: suggestions are route-only shortcuts, not trip-ready paid-intent entries.

### Unmounted trip inspiration rail

`components/search/SearchPanel.tsx` contains a separate search panel with default origin `NYC`, a search intent segmented control, trip type, airport fields, date fields, flexible-date checkbox, and a `TripInspirationRail` inside the form (`components/search/SearchPanel.tsx:51` to `components/search/SearchPanel.tsx:233`). I found no import from `app/page.tsx`, and prior audits in this repo also note that this component is not the active homepage search surface.

The rail fetches static recommendations with `getTripInspiration(originIata)` (`components/search/TripInspirationRail.tsx:29` to `components/search/TripInspirationRail.tsx:35`). Each card shows:

- Heading area: `Trip ideas` and a secondary `Flexible dates` label (`components/search/TripInspirationRail.tsx:37` to `components/search/TripInspirationRail.tsx:47`).
- Card content: theme label, destination city, suggested month, min-max nights, and `From $<priceHintUsd>` (`components/search/TripInspirationRail.tsx:74` to `components/search/TripInspirationRail.tsx:87`).
- Accessible label: theme, destination, month, nights, and `from about $...` (`components/search/TripInspirationRail.tsx:57` to `components/search/TripInspirationRail.tsx:60`).

Selecting a trip idea sets origin, destination, first Friday of the suggested month, return date based on `minNights`, round trip, and flexible dates (`components/search/TripInspirationRail.tsx:61` to `components/search/TripInspirationRail.tsx:70`; `components/search/SearchPanel.tsx:242` to `components/search/SearchPanel.tsx:254`). It still does not submit the search or surface a confirmation state.

The test coverage confirms field population and valid ISO dates, but not live-search handoff, user confirmation, price-disclosure copy, or mounted-homepage behavior (`components/search/__tests__/TripInspirationRail.test.tsx:33` to `components/search/__tests__/TripInspirationRail.test.tsx:120`).

### Recommendation data

`lib/search/tripInspiration.ts` stores static templates with `label`, destination, night range, days from today, and `priceHintUsd` (`lib/search/tripInspiration.ts:21` to `lib/search/tripInspiration.ts:89`). The returned item includes `label`, `destinationCountry`, calculated `suggestedMonth`, and `priceHintUsd` (`lib/search/tripInspiration.ts:99` to `lib/search/tripInspiration.ts:117`).

The rail does not render the template `label` or `destinationCountry`, and it does not disclose whether the price hint is historical, estimated, cached, or live. The phrasing `From $260` is materially stronger than the data source supports because the value is static and not provider-backed at card render time.

## Reference Pattern Comparison

Google Flights uses a clear separation between exploration and verification. Its public Flights page frames discovery around finding cheap days and says Date grid and Price graph help users choose trip dates. Google Travel Help describes Dates, Price graph, and Airports as tools for comparing cheaper travel dates, fare trends by month or week, and cheaper airport alternatives. Google also describes price tracking as tied to specific flights, routes, and dates when the user is not ready to book.

Pattern takeaway: open-ended inspiration is still anchored to explicit search dimensions: origin, destination or region, dates or flexible dates, price comparison context, and a next action such as selecting dates, viewing flight results, or tracking prices. Prices are presented as part of a search/comparison tool, not as unsupported editorial hints.

Booking.com's flight entry point and flight guidance emphasize flexibility, travel dates, and comparing or booking tickets. The useful pattern for expaify is not visual style; it is the expectation that browsing inspiration should resolve into concrete trip parameters before availability and final price are implied.

Sources reviewed:

- Google Flights: https://www.google.com/travel/flights
- Google Travel Help, best fares: https://support.google.com/travel/answer/7664728
- Google Travel Help, track flights and prices: https://support.google.com/travel/answer/6235879
- Booking.com Flights: https://www.booking.com/flights/index.html

## Exact Gap

Current code has route and trip suggestions, but neither one clearly owns the paid-intent handoff.

The active homepage route suggestions are visible to users, but they only fill two fields and use confidence-sounding metadata without dates, price basis, or provider-backed verification. The hidden trip inspiration rail fills a complete route/date shape, but it is not mounted in the active homepage and still labels static prices as `From` without explaining that the user must run a live search. Neither pattern gives a selected state that says the suggestion is now ready to verify fares, hotels, and Deal Score.

Reference patterns make the next step explicit: explore prices by date/airport, select a search shape, then verify or track. expaify currently blends editorial browsing language with search-entry behavior, which is why a paid-intent user can mistake a static idea for a checked deal or fail to recognize it as a premium deal-search shortcut.

## Design Directives

1. Use one suggestion hierarchy on the active homepage. UXDES must either mount/adapt trip inspiration into `app/page.tsx` or deliberately replace the current route suggestions, but the final design must not show both `Trip ideas` and `Route suggestions` as unrelated rails. Acceptance: at 375px and 1280px, there is one primary pre-results inspiration area with one heading and one interaction contract.

2. Inspiration card activation must create a visible `ready to verify` state, not silently change fields. After selection, the form must show the chosen origin, destination, departure date, return date, round trip, flexible dates, and search intent, plus a plain confirmation such as `Ready to check live fares and hotels for this trip.` Acceptance: selecting a card never submits automatically unless the design explicitly specifies auto-submit; in either case, the user must see or hear what changed.

3. Static prices must be labeled as non-live hints or removed from the primary card hierarchy. If `priceHintUsd` remains visible, copy must be conservative: `Typical starting hint` or `Past low hint`, with adjacent copy stating `Live fares checked after search.` Do not use bare `From $260` or copy that implies current availability. Acceptance: no card-level price copy can be read as a confirmed fare, and the screen-reader label must include the same non-live qualification.

4. Cards must expose the complete trip reason and search shape. Use the stored template `label`, destination city/country, month, night range, and the intended verification scope. Acceptance: each card gives enough information to explain why it exists and what search will be run, for example `Museum weekend`, `Montreal, Canada`, `September`, `3-5 nights`, `Checks flights and hotels`.

5. Keyboard and mobile behavior must be first-class. The selected card must have a visible focus and selected state; horizontal scrolling must not hide the primary action at 375px; and each card must be reachable and activatable by keyboard with an accessible name that includes destination, date window, action, and price-basis disclosure if a price is shown. Acceptance: QA can tab from the last search field into every inspiration card, activate one with Enter/Space, and then reach the primary search CTA without losing context.

## UXDES Handoff

The design stage should produce a spec for the active homepage form and inspiration area, not only `components/search/SearchPanel.tsx`. It should define whether the implementation adapts `TripInspirationRail` into `app/page.tsx` or retires the existing route suggestion rail in favor of a unified trip inspiration component.

No DEV/API work is required for the first design pass if inspiration remains a client-side prefill that submits through the existing `/api/search` path. A DEV ticket may be needed later if the team wants provider-backed recommendation freshness, baseline counts, structured price hint metadata, or server-generated inspiration.
