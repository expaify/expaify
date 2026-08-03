# UXR-HOTEL-ROOM-INVENTORY-CONFIDENCE-01 — Hotel Room Inventory Confidence

**Stage:** UXR  
**Priority:** P1  
**Date:** 2026-08-03  
**Discovery input:** `docs/pipeline/hotel-room-inventory-confidence/01-discovery.md`  
**Affected flow:** mounted `/deals` result → `/deals/[dealId]` detail → provider-owned room selection → return

## 1. Research conclusion

The current product cannot tell a traveler that a room is available, unavailable, or replaceable. The mounted deal flow carries a property, an observed nightly price, dates when known, and an attributed outbound search link; it carries no room ID, rate ID, occupancy, inventory state, provider check result, or provider-backed alternative. Its honest state is therefore **room availability not checked by expaify**.

The minimum repair is not a room marketplace. It is a clear truth ceiling before handoff and a criteria-preserving recovery state when the traveler returns: keep the hotel and known stay criteria visible, let the traveler recheck the provider or return to matching hotels, and never translate an empty result, a missing link, a provider error, or a stale property price into “sold out.” Provider-confirmed `sold_out` and alternative-room treatments must remain unreachable until a room/rate-scoped adapter can earn them.

Two implementation drifts matter to the handoff:

1. The discovery brief identifies Hotellook as the active hotel source. The current `/api/search` route actually calls `BookingComHotelsRapidApiProvider` (`app/api/search/route.ts:171-179`). The conclusion is unchanged: that adapter reduces the response to property-level `HotelOffer` records, hard-codes two adults and one room, caches for six hours, leaves `deeplink` empty, and returns `coverage: 'unconfirmed'` (`lib/providers/bookingComHotelsRapidApi.ts:12-21`, `125-205`).
2. The mounted `/deals` product is a saved-deal/snapshot flow, not the `/api/search`/`HotelCard` flow. `DealFeed` mounts `DealCard` and links it to `/deals/[dealId]`; no non-test app file mounts `HotelCard` (`app/deals/DealFeed.tsx:1893-1927`). The UXDES spec must target the mounted saved-deal detail and handoff first.

## 2. Method and evidence boundary

This brief uses:

- direct inspection of the current types, adapters, mounted result/detail components, booking review, outbound-link builder, and analytics allowlist;
- interaction-pattern guidance from official Booking.com Demand API and Expedia Rapid documentation; and
- no assumption that either provider's consumer-site visual design, conversion telemetry, or private inventory behavior is available to expaify.

Reference documentation is used to define what evidence is required for a trustworthy state, not to imply that expaify currently has those provider contracts.

## 3. Current implementation audit

### 3.1 Data contract: room inventory is not representable

`HotelOffer` contains a property ID, property name, area, property-level price, deeplink, source, and supporting evidence. It has no room identity, rate identity, requested occupancy, availability status, inventory count, alternative products, or availability-check timestamp (`lib/types.ts:687-711`). `HotelSearchPage.coverage` describes list pagination/coverage and must not be reused as room availability (`lib/types.ts:715-722`). `HotelProvider` exposes property search and document-readiness checks only; it has no property availability, selected-rate recheck, or alternative-room method (`lib/types.ts:748-759`).

The codebase contains room/rate IDs only inside smoking-policy evidence. Those fields scope a smoking claim; they are not a general room-inventory contract and cannot support availability claims.

### 3.2 Provider evidence: current searches do not earn a room state

The current `/api/search` path calls the Booking.com RapidAPI adapter. That adapter:

- requests one page for fixed `adults=2&room_qty=1`, regardless of the traveler's actual party (`lib/providers/bookingComHotelsRapidApi.ts:144-150`);
- parses only property identity, coordinates, rating/class, photo, and one gross price (`lib/providers/bookingComHotelsRapidApi.ts:34-53`, `155-200`);
- does not parse a room, rate, remaining count, or sold-out reason;
- stores the result for six hours and always labels list coverage `unconfirmed` (`lib/providers/bookingComHotelsRapidApi.ts:20`, `133-139`, `203-205`); and
- leaves the affiliate deeplink empty, making those offers non-handoffable (`lib/providers/bookingComHotelsRapidApi.ts:12-16`, `187-190`).

The active saved-deal pipeline is separate. It snapshots property prices with hidden two-adult/one-room defaults and stores a property-level nightly rate (`lib/pipeline/snapshot.ts:70-100`, `104-130`). Its outbound builder preserves hotel name, city, check-in, and check-out in one attributed Trip.com search link, but deliberately omits occupancy and all other provider links (`lib/pipeline/otaLinks.ts:8-30`). This is a useful search handoff, not a selected room/rate or a live availability confirmation.

**Evidence ceiling:** a visible price proves only that a provider price was observed for the snapshot's criteria. It does not prove the traveler’s room remains available, that their occupancy is supported, or that the price maps to a selectable room now.

### 3.3 Mounted results: price confidence is visually stronger than inventory confidence

`DealFeed` mounts `DealCard` for unlocked saved deals and routes the whole card to the saved-deal detail (`app/deals/DealFeed.tsx:1893-1927`). The card shows hotel, dates/window, nightly price, comparison price, discount, savings, price-check recency, image, and **View deal**. It has no room or availability line (`app/components/ui/DealCard.tsx:115-150`).

The card does not literally say “available,” but the combination of a current-looking price, savings, recency, and actionable **View deal** can reasonably be read as a viable offer. No adjacent text limits that inference to a property-level price observation.

### 3.4 Mounted detail and outbound handoff: uncertainty is deferred but not named

The saved-deal detail does preserve hotel, area, dates, nights, observed price, freshness, and a back URL to the prior results. It says “the provider confirms room-level details” and labels the action area **Check rooms with provider** (`app/deals/[dealId]/page.tsx:363-398`, `438-454`). This correctly assigns room choice to the provider, but it never states that expaify has not checked room inventory.

`HotelDealCriteriaHandoff` says the provider “confirms room details, live availability…” and renders attributed provider links (`app/components/HotelDealCriteria.tsx:218-251`). `CompareRow` opens the provider in a new tab and explicitly records `occupancy_state: 'not_captured'` and `room_state: 'not_captured'` (`app/components/ui/CompareRow.tsx:92-143`). That is the correct analytics truth, but the visible copy does not expose the same limitation.

The provider-link-unavailable state is truthful and gives **Search current deals** (`app/components/HotelDealCriteria.tsx:252-263`). It is a link-capability error, not proof that the property or any room is sold out.

### 3.5 Return and recovery: the mounted flow has no inventory recovery

The mounted `/deals/[dealId]` handoff keeps expaify open in the original tab, but its only return prompt concerns renovation/closure mismatch (`app/components/HotelDealCriteria.tsx:137-199`). It does not ask about room availability, identify a failed room, or offer a same-context next action.

The separate `/book` review contains more return instrumentation: it arms a handoff session, detects tab hide/return, emits `hotel_handoff_returned`, and defines **Room availability did not match** as feedback (`app/book/BookingFlow.tsx:878-1007`). It still does not provide recovery. More importantly:

- the mounted saved-deal detail does not route through `/book`;
- `HotelCard`, which prepares the `/book` hotel context, is not mounted outside tests;
- `ReviewShell` accepts `hotelSupplement`, where the return prompt is built, but does not render that prop in its hotel branch (`app/book/BookingFlow.tsx:510-550`, `1080-1137`); and
- `hotel_handoff_return_reason_selected` is not in the analytics endpoint's event allowlist, so the internal sink rejects it as an invalid payload (`app/api/analytics/route.ts:12-50`, `230-271`).

Consequently, the active product cannot observe room mismatch or recovery, and the richer review path's feedback event is neither visibly reachable nor accepted by the production analytics API.

### 3.6 Current-state matrix

| State | What would earn it | Current reachability | Current treatment |
|---|---|---:|---|
| `not_checked` | No room/rate-scoped provider check has run | **Reachable; default truth** | Implied only through “provider confirms later”; not named |
| `checking` | A current room/rate availability request is pending | Not reachable | None |
| `available` | Provider returns at least one product matching property + dates + occupancy, with room/rate identity and freshness | Not reachable | None |
| `sold_out` | Explicit provider response for the same scoped selection or stay; not an empty/missing/error inference | Not reachable | None |
| `provider_error` | The scoped availability check fails or cannot establish truth | Not reachable as a room state | General provider/link errors exist, but are not inventory-scoped |
| `alternative_available` | Provider returns a distinct currently available room/rate for the same property and exact stay/occupancy | Not reachable | None |
| `provider_link_unavailable` | No valid attributed outbound URL exists | Reachable | Truthful message + **Search current deals** |

`not_checked`, `provider_error`, and `sold_out` must remain mutually exclusive. An alternative is an additional result attached to an unavailable selected product, not a synonym for “other hotels exist.” Every earned state needs the tuple `propertyId + roomId/rateId when applicable + checkIn + checkOut + adults/children + roomCount + provider + checkedAt`.

## 4. Reference interaction patterns

### 4.1 Booking.com Demand: exact criteria and product identity precede availability claims

Booking.com's official accommodation search returns properties that have at least one available product matching the request. The request includes check-in, check-out, adult count, room count, and optional guest allocation; the result carries a best matching product rather than a bare property claim. Its separate availability endpoint returns all matching products for one or more properties and uses room/product identifiers. Booking.com also warns that Demand API coverage is not a one-to-one mirror of its consumer front end.

Interaction guidance for expaify:

- availability must be scoped to the traveler criteria actually submitted, not hidden provider defaults;
- property search coverage and room availability are different concepts;
- a redirect destination may show inventory that differs from an upstream API, so expaify should state when the provider is the current source of truth; and
- a future alternative needs a distinct room/product identity and policy/price context, not a generic property card.

Sources: [Booking.com — Search for accommodation](https://developers.booking.com/demand/docs/accommodations/search-for-available-properties), [Booking.com — About accommodations](https://developers.booking.com/demand/docs/accommodations/about-accommodation), [Booking.com — Availability API reference](https://developers.booking.com/demand/docs/open-api/3.2/demand-api/accommodations/accommodations/chains).

### 4.2 Expedia Rapid: selected-rate recheck, explicit sold-out, and re-shop are separate outcomes

Expedia's official lodging flow returns room types and rates for requested properties and occupancy, then requires a price check for the selected room/rate before booking. A matched rate proceeds; a changed price returns updated price information; a no-longer-available rate returns a fresh Shop request link to find other rates. Expedia's test contract separates `sold_out` from internal error and service-unavailable responses. Its error guidance also notes that degraded supplier communication can make true availability unknown, so a technical failure must not be relabeled sold out.

Interaction guidance for expaify:

- retain the failed selection long enough to explain what changed;
- separate “this selected rate is gone” from “we could not check”;
- make the next action a fresh same-context shop/recheck, not a dead end;
- show a replacement only from the fresh response; and
- allow another room type or another hotel as separate recovery paths.

Sources: [Expedia Group — Rapid Shopping API](https://developers.expediagroup.com/rapid/lodging/shopping/about-shopping-api?locale=en_US), [Expedia Group — Shopping test requests](https://developers.expediagroup.com/rapid/lodging/shopping/rapid-shopping-test-request?locale=en_US), [Expedia Group — Common error responses](https://developers.expediagroup.com/rapid/flights/reference/error-responses).

## 5. Exact gap

| Dimension | Current expaify code | Reference pattern | Delta |
|---|---|---|---|
| Search scope | Dates sometimes preserved; saved feed and provider adapter use hidden 2-adult/1-room defaults; UI records occupancy/rooms as not captured | Availability request uses exact dates and occupancy/allocation | expaify cannot claim inventory for the traveler’s party |
| Identity | Property ID + observed nightly price | Property + room/product + rate IDs | No failed selection or trustworthy alternative can be named |
| Freshness | Property price snapshot/cache; no availability timestamp | Live shop plus selected-rate recheck | Price recency is not room availability recency |
| Negative state | Empty, missing link, and provider errors exist outside an inventory model | Sold out is explicit; service failure remains error/unknown | No safe route to `sold_out` today |
| Recovery | Original tab remains open; back-to-results exists; no room-specific return state | Fresh re-shop link and other room/hotel paths | Recovery is possible only by user-led backtracking |
| Measurement | Handoff click/start exists; mounted flow has no return session; review feedback is unreachable/rejected | Selection/recheck outcomes can be correlated to a scoped request | Completion and recovery success are not measurable |

## 6. Testable design directives

### Directive 1 — Name the truth ceiling at the commitment point

On the mounted saved-deal detail, place a persistent inventory line immediately above the provider action, not inside a disclosure:

- Status label: **Room availability not checked by expaify**
- Supporting copy: **The provider will show current rooms and prices for your stay.**
- Primary action: keep provider-specific **Check rooms at {Provider}**

Do not use **Available**, **Sold out**, **Only N left**, **Selling fast**, a countdown, or an urgency color when the state is `not_checked`. Do not imply that the observed nightly price belongs to a particular room. At 375px the status, support text, and full-width action must stack without truncation; at 1280px the status remains adjacent to the handoff action rather than moving to supporting evidence.

**Acceptance test:** given the current saved-deal contract, the rendered state always says `not checked`; no inventory-positive or scarcity phrase appears in visible or accessible copy.

### Directive 2 — Preserve known context and expose unknown context

The handoff and any return state must keep hotel name, destination/area, check-in, check-out, and nights when present. Because the current flow does not capture guests or room count, show **Guests and rooms: choose with provider** rather than a fabricated default. A missing or mismatched date must remain an explicit blocker/review state; it must not be converted to unavailability.

Recovery links must use the existing criteria-aware results/back URL where valid. If criteria are missing or invalid, use **Search current hotel deals** and say that the prior search could not be restored.

**Acceptance test:** returning to results preserves every known criterion in the URL; analytics still records occupancy and room state as `not_captured`; no UI presents two adults/one room as traveler intent.

### Directive 3 — Provide a no-evidence return recovery, not a diagnosis

After a provider tab is opened and the traveler returns, reveal a polite, focus-reachable recovery panel on the same detail surface:

- Heading: **Couldn’t find a room that worked?**
- Body: **expaify did not check what happened on the provider site. You can check this hotel again or return to hotels matching your saved stay.**
- Primary action: **Check rooms again**
- Secondary action: **Back to matching hotels** (or **Search current hotel deals** when context cannot be restored)
- Optional tertiary action: **Tell us what changed**, with **Room availability did not match** as one reason

Do not say that the room sold out, that the property sold out, or that no alternatives exist. At 375px actions stack in primary/secondary order with 44px minimum targets; at 1280px they may sit in one row. When revealed after tab return, announce the heading/body through a polite live region and move focus only if the user explicitly opens the feedback form; do not steal focus on ordinary tab return.

**Acceptance test:** simulating hide → visible after a provider click reveals the panel once per handoff session, preserves context, and offers both recheck and results recovery by keyboard.

### Directive 4 — Gate future sold-out and alternative states on scoped provider evidence

UXDES must specify these future states, but UI/DEV must not make them reachable until a provider adapter returns the required evidence:

- `sold_out`: heading **This room is no longer available** only after an explicit current response for the same property + room/rate + dates + occupancy. Keep the failed room/rate name, prior price basis, and **Checked {time}** visible.
- `provider_error`: heading **We couldn’t check this room**; actions **Try again** and **Back to matching hotels**. Never reuse sold-out styling or copy.
- `alternative_available`: heading **Other rooms are available for this stay** only when the provider returns distinct current room/rate products for the same property and exact criteria. Each alternative must show room identity, integer-minor-unit price and basis, material policy/bed/occupancy differences, and freshness.
- no returned alternative: **No other rooms were confirmed by this check**; do not render an empty carousel and do not generalize to property sold out.

**Acceptance test:** fixtures with missing IDs, mismatched stay/occupancy, stale evidence, malformed money, or provider error cannot render `sold_out` or `alternative_available`.

### Directive 5 — Measure recovery without calling a click “completion”

Use one opaque `handoff_session_id` across the detail handoff, detected return, recovery impression, optional reason, and second handoff. Add `inventory_evidence_state` with the mutually exclusive values `not_checked`, `available`, `sold_out`, and `provider_error`; add `alternative_state` separately (`not_checked`, `none_confirmed`, `confirmed`). Minimum events:

1. `hotel_room_handoff_started` — provider, deal/property, criteria version, known-context flags, evidence state, handoff session.
2. `hotel_room_handoff_returned` — same handoff session, away-duration bucket; this is a return, not a failed booking.
3. `hotel_room_recovery_viewed` — prompt impression and context-restoration status.
4. `hotel_room_recovery_action` — `recheck_same_hotel`, `back_to_matching_hotels`, `edit_stay`, or `feedback`.
5. `hotel_room_handoff_restarted` — prior and new handoff session IDs plus recovery action.

Primary in-product KPI: unique returned handoff sessions that start a second valid handoff with preserved known context / unique returned sessions shown recovery. Secondary diagnostics: recovery action distribution and optional availability-mismatch selections / feedback-form impressions. Do not label outbound clicks, tab returns, or feedback submissions “room-selection completion.” Provider callback or attributable conversion data is required before adopting provider-side selection/booking completion as a KPI.

**Acceptance test:** every emitted event is accepted by `/api/analytics`; a test joins start → return → recovery → restart with no PII and no raw provider URL.

## 7. UXDES handoff: required state and hierarchy

The design spec should cover default, loading, empty/no-link, provider error, return recovery, expired/stale observed price, missing/invalid criteria, mobile 375px, desktop 1280px, keyboard/focus, and the gated future sold-out/alternative fixtures.

Hierarchy for the mounted commitment area:

1. **Primary:** truthful inventory status + provider action or recovery action.
2. **Secondary:** property and known stay criteria, including explicit guests/rooms unknown state.
3. **Tertiary:** observed property price, freshness, optional mismatch feedback, and explanatory evidence.

The failed room/rate becomes primary only in a future provider-confirmed `sold_out` state. Until then, there is no failed room to display.

## 8. Measurement and implementation blockers

- **No provider-side completion signal:** no callback, affiliate conversion feed, or room-selection event was found in the repo. Room-selection completion is not currently measurable.
- **No mounted return-session path:** the active saved-deal flow bypasses `/book`; it records provider handoff clicks but no general return/recovery session.
- **Broken review-path feedback observability:** the `/book` return UI is passed through an unrendered `hotelSupplement` prop, and its reason event is absent from the analytics allowlist.
- **No occupancy continuity:** destination/dates can be preserved; guests and room count cannot. Downstream work must not claim full stay preservation until that contract exists.
- **Provider/data drift:** Hotellook is not the current `/api/search` adapter. The saved-deal snapshot pipeline is yet another data path and uses direct vendor fetches in `lib/pipeline/snapshot.ts`, outside `lib/providers`. That non-negotiable contract conflict is out of scope for this UXR ticket and requires a separate DEV repair.
- **No safe sold-out or alternative state:** this is a capability blocker, not a design blocker. UXDES can define gated states, but the reachable MVP is `not_checked` plus recovery.

## 9. Decision

Proceed to UXDES with a repair-first scope: clarify that expaify has not checked room inventory, preserve the known stay context, and add an honest return recovery on the mounted saved-deal detail. Do not authorize live room selection, scarcity messaging, a provider integration, or inferred alternatives under this ticket.
