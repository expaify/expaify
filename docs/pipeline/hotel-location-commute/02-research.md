# UX Research: Hotel Location and Commute Fit

**Ticket:** UXR-HOTEL-LOCATION-COMMUTE-01  
**Priority:** P0  
**Stage:** UX Research  
**Date:** 2026-08-03  
**Discovery input:** `docs/pipeline/hotel-location-commute/01-discovery.md`

## 1. Research conclusion

One named-anchor, coordinate-backed straight-line distance is the minimum useful **shortlisting** evidence expaify can support with its current location contract. It gives every eligible property one consistent spatial comparator without inventing a route, mode, or travel time. It clears that minimum bar for airport, rail-station, event, and business-site trips **only when the anchor is the traveler's actual named place and the method remains explicit**. The current live path supplies that condition only for a destination airport; it does not preserve a user-named station, venue, landmark, office, or event.

This is a bounded validation, not evidence that straight-line distance answers the full commute question. It supports relative comparison—“A is nearer to the same place than B”—but cannot establish door-to-door burden, a viable route, walking safety, transit frequency, traffic, or travel time. Those claims require sourced routing data that the repository does not have.

There is also a blocking implementation-topology mismatch:

- `app/components/HotelCard.tsx` contains the collapsed location summary and expandable Location panel described in discovery, but repository-wide usage search finds no production import or render of `HotelCard`; its only call sites are tests.
- `app/api/search/route.ts` can return hotel offers with anchor distance, but no rendered client calls `GET /api/search` in the current tree.
- The active `/deals` result surface uses `app/components/ui/DealCard.tsx` through `app/deals/DealFeed.tsx`. Its `DealCardDeal`/`ApiDeal` contracts contain city text but no property coordinate, location precision, anchor, distance, or expandable Location panel.

Therefore the proposed comparison cannot be measured in production and must not be implemented by editing the orphaned `HotelCard` alone. Before UXDES or UI work advances, the owner must explicitly choose one of two scopes:

1. restore/mount the `HotelCard` + `/api/search` search-results path; or
2. extend the active `/deals` data contract and `DealCard`/detail flow with provenance-safe property and anchor evidence.

That choice is outside this UXR ticket. The directives below are implementation-ready at the behavior level but conditional on an authorized active surface and evidence path.

## 2. Method and evidence boundary

### Repository audit

Inspected the discovery report and the actual source paths for:

- collapsed and expanded hotel presentation;
- display validation and distance formatting;
- property/anchor evidence integrity;
- search anchor construction and provider application;
- active `/deals` card/detail topology;
- production analytics transport and accepted event schema; and
- unit coverage for verified and tampered comparisons.

Current-code findings below are facts from this worktree. Reference patterns are guidance from external products; they do not imply that expaify owns equivalent maps, POIs, directions, or routing data.

### Reference review

Two patterns were compared at interaction level:

- Booking.com search results expose a consistent compact property-to-centre distance alongside the area and “Show on map,” allowing result-to-result scanning before opening a property. Example Milan results repeatedly show values such as “1.8 miles from centre” within each listing. [Booking.com Milan hotel results](https://www.booking.com/searchresults.en-gb.html?city=-121726&expand_sb=1&redirected=1&source=hotel)
- Google Hotels treats location as both a results-narrowing and detail task: users can adjust results around a specific location or inspect hotels on a map; driving directions live on the property detail surface. This separates broad spatial comparison from route guidance rather than treating a simple distance as a route time. [Google Travel Help — Search for hotels on Google](https://support.google.com/travel/answer/6276008?hl=en-419)

These references support a repeated common comparator in the results scan and deeper route context later. They do **not** validate an unlabeled distance, prove that straight-line distance predicts commute time, or authorize a map/routing feature.

## 3. Current implementation audit

### 3.1 Result-card hierarchy

| Current-code evidence | Current behavior | Decision gap |
|---|---|---|
| `app/components/HotelCard.tsx:788`, `:928-934` | `getHotelLocationDisplay(hotel)` supplies `distanceText`, but the collapsed card renders only `location.label` and `location.value`. | A verified shared-anchor comparison exists but is absent during shortlisting. Users must expand cards and remember values serially. |
| `app/components/HotelCard.tsx:915-975` | At narrow container widths the header reflows price below the photo/name grid; the location block already occupies two lines before fees, policies, transport, score, CTA, and Details. | Any repair must add no more than one compact line and must not create another badge/chip or displace name, price, Deal Score, or review action. |
| `app/components/ui/DealCard.tsx:12-47`, `:82-102`; `app/deals/DealFeed.tsx:1905-1922` | The active deal card renders city and dates but receives no `HotelLocation`. | The live surface cannot show honest property-to-anchor evidence from its present contract. City text cannot be promoted to a property point. |

### 3.2 Expanded Location panel

| Current-code evidence | Current behavior | Decision gap |
|---|---|---|
| `app/components/HotelCard.tsx:1088-1110` | Expanded Location shows precision label/value/note, then `distanceText` when verified. An airport-linked comparison also gets a transport caveat. | Evidence is internally coherent but hidden until expansion; non-airport anchors would not receive a visible method caveat in this panel. |
| `app/components/hotelLocationContext.ts:24-34` | Verified values become `{rounded miles} mi from {anchor.name}`; values under 10 miles use one decimal, 10+ round to whole miles. | The string names the anchor but omits “straight-line.” Outside the airport caveat, a user can overread it as road or commute distance. |
| `app/components/hotelLocationContext.ts:37-98` | Exact, coordinate, area/search-area, and missing states have distinct labels and honesty notes. `distanceText` is normally absent for incomplete evidence. | The absence states are correct, but no explicit “comparison unavailable” copy exists; adding such copy to every collapsed card would create clutter and penalize incomplete inventory. |
| `lib/hotels/locationEvidence.ts:96-122` | Display requires provider property coordinates, a valid named coordinate anchor, and a valid straight-line distance. Expaify-calculated values are recomputed and tolerance-checked; provider-documented values require a provider-declared anchor. | This is a strong integrity gate and should remain the single eligibility rule. UI must not reproduce or weaken it. |

### 3.3 Search-anchor construction

| Current-code evidence | Current behavior | Decision gap |
|---|---|---|
| `lib/types.ts:518-554` | The contract supports `airport`, `venue`, `landmark`, and `city_center`, with `user_selected`, `search_linked`, or `provider_declared` source. | The type is future-capable; live user intent is not. A permissive type is not evidence that those anchors are captured. |
| `app/api/search/route.ts:202-225`, `:396-404` | `dest` is resolved to one IATA code. Hotels run only when destination, depart, and return exist. The hotel search receives `getSearchLinkedAirportAnchor(destIATA)`. | A city/airport flight destination becomes an airport anchor whether or not the airport is the traveler’s trip-determining place. No named event, venue, station, office, or landmark crosses the request boundary. |
| `lib/airports/resolve.ts:78-105` | The anchor is emitted only for a known airport with valid coordinates/name and is labeled `search_linked`. | Valid provenance, but limited relevance: “search-linked” does not mean “user chose this as the commute anchor.” |
| `lib/providers/hotellook.ts` / `bookingComHotelsRapidApi.ts` via `withCalculatedAnchorDistance` | Providers apply the context only to provider-sourced property coordinates; incomplete properties lose anchor/distance. | Correct absence behavior. Area-only and search-area inventory must remain ineligible rather than receive a fabricated comparison. |

### 3.4 Analytics path

| Current-code evidence | Current behavior | Decision gap |
|---|---|---|
| `lib/analytics.ts:22-76` | `track()` has a production first-party sink with beacon/fetch fallback and optional approved external sink. Failures do not block navigation. | The transport exists; the location experiment needs schema additions, not a new analytics library. |
| `app/api/analytics/route.ts:9-43`, `:52-84` | The API allowlists event names/properties and requires properties per event. It has active deal-result/detail/handoff events. | None carries anchor ID/kind/source, location precision, evidence presence/method, or distance bucket. Unrecognized new properties will be rejected. |
| `app/deals/DealFeed.tsx:1347-1356`, `:1905-1908` | `hotel_result_card_opened` records a card progression with sort/filter/position context. | It can count active-detail entries, but cannot distinguish evidence-present from absent cards. |
| `app/components/HotelDecisionAnalytics.tsx:49-60`, `:122-139` | Active detail views, provider handoff starts, and back-to-results actions are measured on the saved-deal detail page. | It supports progression/return analysis but does not identify commute evidence or a Location-panel exit. |
| `app/components/HotelCard.tsx:866-877` | The orphaned card’s Details toggle tracks funds-policy exposure only when opening and bookable. | There is no generic details-open/close event, card impression, review progression with location dimensions, or session-end detail exit for this component. |

No production baseline currently demonstrates how often location uncertainty causes abandonment. Existing events cannot reconstruct it reliably.

## 4. Reference-pattern delta

| Pattern | Reference behavior | expaify now | Transferable delta | Do not copy |
|---|---|---|---|---|
| Repeated common comparator | Booking.com repeats one centre distance on each result beside area/map context. | Verified airport distance is hidden in an expanded panel; active cards have no property distance. | Put one same-anchor comparison in the scan layer for every eligible property. Keep it text-first and secondary. | Do not default every trip to a generic city centre or add “Show on map” without a map product and accessible equivalent. |
| Specific-location refinement | Google Hotels lets users adjust results around a specific location and use a map to understand spatial fit. | Search accepts a flight-style destination and derives an airport anchor only. | The anchor must be an explicit, named, trip-relevant selection preserved across the result set. | Do not geocode arbitrary free text in a component, call a vendor outside `lib/providers`, or treat typed text as verified coordinates. |
| Route guidance is deeper evidence | Google exposes driving directions on property detail, distinct from result narrowing. | expaify has a Haversine straight-line calculation and no route provider/mode/freshness. | Label the scan value as a straight-line estimate and reserve route-time claims for a future sourced routing contract. | Do not derive minutes, “walkable,” “easy commute,” or “close” from straight-line miles. |

## 5. Minimum-evidence validation by trip type

| Trip type | Does one named straight-line distance clear the minimum shortlisting bar? | Conditions and residual risk |
|---|---|---|
| Event / venue | **Yes, conditionally.** | The exact user-selected venue must be named and coordinate-backed. It helps reject obviously remote hotels, but entrances, barriers, post-event traffic, and transit service remain unknown. |
| Business site / campus | **Yes, conditionally.** | The named office/site must be the anchor. Large campuses and multiple entrances make small distance differences weak evidence. |
| Airport | **Yes for proximity, not transfer fit.** | The airport must be the traveler’s intended airport. Existing shuttle caveat is necessary; terminal access, transfer availability, and travel time are not established. |
| Rail / transit point | **Yes, conditionally.** | The exact station must be selected and supported as a named coordinate anchor. Current `HotelLocationAnchorKind` has no `station`/`transit` value, so representing rail as `landmark` would erase useful semantics and should not be guessed. This requires an explicit type-contract decision before implementation. |

**Judgment:** retain the hypothesis. One common named-anchor straight-line comparison is smaller and more honest than a map or invented travel time, and more decision-useful than area text alone. It is insufficient when the system chooses an airport merely because the flight destination resolved there; relevance is as important as coordinate validity.

## 6. Testable design directives

### D1 — Show one verified comparison in the collapsed scan layer

When `hasVerifiedHotelLocationComparison(location)` is true and the same anchor applies across the result set, render exactly one secondary text line beneath the existing location value:

`{distance} mi from {anchor name} · Straight-line estimate`

- Use the existing `getHotelLocationDisplay` rounding and unit convention; do not recalculate in a component.
- Keep the hotel name, nightly price, Deal Score, and `Review hotel`/`View deal` action primary.
- Use ordinary text, not a success badge or proximity verdict.
- At 375px the line may wrap naturally to two visual lines if the anchor name is long, but it must occupy one semantic paragraph, must not horizontally scroll, and must not overlap the price column.
- The accessible text must include the anchor name and “straight-line estimate”; no icon-only method disclosure.

**Acceptance test:** two eligible cards tied to the same anchor expose two values that can be compared without opening Details. Querying rendered text finds exactly one method-qualified comparison per eligible card and no “minutes,” “walk,” “drive,” “transit,” “close,” or “easy commute” claim.

### D2 — Use an explicit trip anchor; never silently substitute search geography

Only show the scan-layer comparison when the result set carries one traceable named anchor that is the traveler’s explicit trip reference. Preserve `anchor.id`, `name`, `kind`, coordinates, and source through the provider boundary.

- A destination airport is eligible only when the search UI identifies it as the comparison anchor, not merely because a city resolved to that airport for flight search.
- Event, venue, business, landmark, and rail cases require a supported selection-to-coordinate path. Free text, city text, provider area, and search-area fallback are ineligible.
- Add a semantically correct `station`/`transit` kind before claiming rail coverage; do not hide it under `landmark` without a reviewed contract change.
- All external lookup/geocoding/routing remains behind `lib/providers` and returns `Result<T>`.

**Acceptance test:** changing only the selected anchor updates the anchor ID/name and every eligible card comparison consistently. Removing or invalidating either coordinate removes the comparison. A city-only query cannot generate a user-selected venue or station comparison.

### D3 — Preserve honest absence without card noise

For `area`, `search_area`, `missing`, invalid/tampered distance, or unavailable-anchor states, render no calculated distance and no substitute estimate on the collapsed card.

- Preserve the existing location label/value and warning treatment.
- Do not add repeated “commute unavailable” lines to every ineligible card.
- In expanded Location, retain the existing precision-specific note and add one concise absence sentence only when the search has an explicit anchor but this property is ineligible: `Distance to {anchor name} isn’t available for this property.`
- When the search has no explicit anchor, show no commute-comparison empty state; the feature was not requested and silence is clearer.
- Loading/error from a future anchor provider must not leave stale comparison text from a prior search.

**Acceptance test:** area-only, search-area, missing-coordinate, invalid-anchor, tampered-distance, anchor-loading, and anchor-error fixtures render zero numeric commute claims. Only the expanded explicit-anchor/ineligible case names the unavailable comparison.

### D4 — Make the expanded panel explain scope, not promise a commute

Whenever a comparison appears, the expanded Location panel must pair it with one method sentence:

`Straight-line estimate only. Route distance and travel time can vary.`

For airport-linked properties, retain the supported airport-transfer guidance, but avoid duplicating the method caveat. For all anchor kinds, do not introduce a mode, time, freshness, or convenience judgment unless a later provider contract supplies it.

**Acceptance test:** each expanded verified state contains the named value and exactly one method caveat. Screen-reader reading order is location precision → place value → named distance → method limitation. Keyboard activation of Details preserves the native button, `aria-expanded`, `aria-controls`, visible focus ring, and current toggle behavior.

### D5 — Instrument evidence exposure and same-session outcomes before claiming impact

Extend the existing first-party analytics allowlist and emit non-blocking events/props from the **active** result/detail flow. Required semantics:

- result-set exposure: experiment variant, eligible-card count, total-card count, anchor kind/source, viewport group;
- card exposure: opaque hotel ID, card position, location precision, evidence present, method, and distance bucket;
- details opened and closed: same dimensions plus whether review/handoff occurred;
- review/detail progression: same-session outcome joined by existing session ID; and
- explicit back-to-results and provider handoff: retain existing events, adding approved evidence dimensions rather than sending names or URLs.

Never send the anchor name, property/address text, latitude/longitude, provider URL, query string, or affiliate marker. Use bounded enums and an opaque, non-PII `anchor_id` only if governance approves it; otherwise use kind/source plus experiment assignment.

**Acceptance test:** schema tests accept every declared event/property and reject unknown/unbounded values. One impression fires once per genuinely viewed card/result set, toggling Details does not duplicate impressions, analytics failure does not alter navigation, and no payload contains coordinates, visible place strings, or outbound URLs.

## 7. Present-versus-absent measurement design

### 7.1 Causal comparison

Run a session-level randomized experiment only on result sets where:

1. one explicit named anchor is valid and shared by the set;
2. at least two offers pass `hasVerifiedHotelLocationComparison`; and
3. the active UI and analytics path are mounted.

Assignment:

- **Present:** show D1’s compact comparison on eligible collapsed cards.
- **Absent control:** suppress only the collapsed comparison. Preserve the existing expanded Location evidence in both variants so the experiment isolates shortlisting visibility rather than withholding all location evidence.

Keep ranking, prices, Deal Scores, inventory, CTA behavior, location precision text, and provider handoff unchanged. Randomize by session, not card, to prevent a mixed list from making absence look like worse property evidence. Exclude bots, mock/locked cards, direct detail entries, and result sets with fewer than two eligible properties from the primary analysis.

Natural evidence-present versus area/missing-coordinate cohorts are **not** a causal control because provider coverage and property geography differ. Use them only for guardrails and coverage reporting.

### 7.2 Primary outcomes

**Selection-confidence behavioral proxy**

- Same-session progression from an eligible card impression to `Review hotel`/active detail, then to provider handoff.
- Number of distinct hotel details opened before the first review/handoff.
- Time from first eligible result impression to first review/handoff, reported with medians and distribution—not a “faster is always better” claim.
- Repeated card/detail switching before first review/handoff.

The repair is directionally successful when the Present group opens fewer distinct details and switches less, while review/handoff progression is non-inferior or better. Do not interpret fewer detail opens alone as success; it may mean the added line discouraged engagement.

**Detail-exit outcome**

- A detail exit is a Details close, back-to-results action, or session end after a qualifying detail open and before review/provider handoff for that hotel.
- Compare detail-exit rate per qualifying open and share of sessions with two or more such exits.
- Distinguish explicit close/back from session end; browser/tab loss is a censored outcome when no reliable end event exists.

### 7.3 Comprehension and confidence check

Pair telemetry with a short unmoderated or moderated task across event, business, airport, and rail scenarios. Ask participants to choose between 3–5 hotels, then identify:

1. the place used for comparison;
2. which hotel is closest by the displayed measure; and
3. whether the number is straight-line, driving, walking, transit, or live travel time.

Record confidence on a consistent five-point scale **after** the comprehension questions. Success requires higher or stable confidence together with correct anchor/method comprehension; confidence without comprehension is a failure. Rail stimuli cannot be tested as “supported” until the anchor-kind contract is resolved.

### 7.4 Guardrails and segmentation

Report all outcomes by:

- experiment variant;
- viewport group (`mobile_375_639`, `tablet_640_1023`, `desktop_1024_plus`);
- anchor kind and source;
- location precision;
- evidence eligibility;
- bounded distance bucket (`under_1_mi`, `1_to_under_3_mi`, `3_to_under_5_mi`, `5_to_under_10_mi`, `10_plus_mi`); and
- eligible-card count bucket.

Guardrails:

- provider-handoff progression for ineligible area/missing-coordinate inventory must not decline because it lacks calculated evidence;
- no increase in incorrect route-time interpretation;
- no mobile overflow, overlap, or primary-action displacement at 375px;
- no extra API request per card and no vendor call from a component; and
- analytics rejection/error rate must remain within the existing sink’s operational threshold.

Do not set an arbitrary uplift target before baseline collection. Pre-register sample size, non-inferiority margin for review/handoff progression, minimum detectable effect, and test duration after current traffic and conversion volumes are known.

## 8. Handoff constraints for UXDES

UXDES may specify the evidence-present, explicit-anchor/ineligible, unavailable-anchor, loading/error reset, mobile 375px, desktop 1280px, focus/keyboard, and long-anchor-name states using D1–D5. It must not:

- select an active surface on behalf of Product/Engineering;
- treat the orphaned `HotelCard` as production-reachable;
- invent venue/station resolution, routing, travel time, or map capability;
- infer a property point from city/area text;
- represent rail as `landmark` without a reviewed type decision; or
- move external lookup outside `lib/providers`.

The next ticket must carry the topology blocker. UI implementation should not start until the active result surface and data source are named.

## 9. Out-of-scope findings

- The discovery report describes `HotelCard` as the current live result card, but the current application renders `DealCard` in `/deals`; this is the central blocker above.
- `GET /api/search` and `components/search/SearchPanel.tsx` appear unmounted in production routes in this worktree. Restoring the legacy search experience is not authorized by this ticket.
- The active deal snapshot contract does not expose property coordinates. Adding them is a data/product change, not a presentation-only repair.
- A rail/transit anchor is not represented in `HotelLocationAnchorKind`.
- No routing provider, route mode, route timestamp, or route freshness semantic exists. Travel-time estimation remains out of scope.

