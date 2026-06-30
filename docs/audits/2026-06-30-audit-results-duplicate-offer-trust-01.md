# AUDIT-RESULTS-DUPLICATE-OFFER-TRUST-01: Duplicate Offer Trust

Date: 2026-06-30
Role: Senior Full-Stack Engineer
Scope: Narrow audit only. No product code changed.

## Executive Finding

Search results can still display duplicate-looking or near-duplicate offers. The current flow has two coarse flight dedupe passes, but neither is provider-aware enough to explain why similar cards differ, and hotels have no dedupe at all. Some duplicate-looking offers are safe candidates for dedupe, while others are materially different and need disclosure instead.

Requested files not present in this worktree:

- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`
- `app/api/tickets/route.ts`

Equivalent inspected surfaces:

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/api/search/route.ts`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `lib/booking/config.ts`
- `lib/search/sortFlights.ts`
- `lib/providers/travelpayouts.ts`
- `lib/providers/duffel.ts`
- `lib/providers/amadeus.ts`
- `lib/providers/kiwi.ts`
- `lib/providers/hotellook.ts`
- `lib/types.ts`

## Result Identity and Key Paths

### Shared Type Contract

Flights use `NormalizedFare.id`, route fields, carrier, stops, `price: { priceCents, currency }`, `deeplink`, source, and `fetchedAt` (`lib/types.ts:12` to `lib/types.ts:29`). Hotels use `HotelOffer.id`, name, area, stars, `pricePerNight: Money`, deeplink, and source (`lib/types.ts:43` to `lib/types.ts:54`). The inspected path keeps money as integer `priceCents` plus `currency`.

### Provider Flight IDs

- Travelpayouts v2 latest: `tp-v2-${gate}-${origin}-${destination}-${departAt}` (`lib/providers/travelpayouts.ts:180` to `lib/providers/travelpayouts.ts:185`).
- Travelpayouts calendar: `tp-cal-${airline}-${origin}-${destination}-${departure_at}` (`lib/providers/travelpayouts.ts:232` to `lib/providers/travelpayouts.ts:248`).
- Travelpayouts cheap: `tp-v1-${airline}-${origin}-${dest}-${departAt}` (`lib/providers/travelpayouts.ts:280` to `lib/providers/travelpayouts.ts:298`).
- Duffel: raw `offer.id` (`lib/providers/duffel.ts:192` to `lib/providers/duffel.ts:220`).
- Amadeus: `amadeus-${offer.id}` (`lib/providers/amadeus.ts:212` to `lib/providers/amadeus.ts:229`).
- Kiwi: `kiwi-${offer.id}` (`lib/providers/kiwi.ts:190` to `lib/providers/kiwi.ts:214`).

### API Streaming and Dedupe

`/api/search` races Travelpayouts, Duffel, Amadeus, and Kiwi and streams each provider chunk as it resolves (`app/api/search/route.ts:188` to `app/api/search/route.ts:230`). Flexible-date Travelpayouts fanout dedupes only within the seven shifted Travelpayouts responses using `currency:carrier:origin:destination:depart.slice(0, 16)` and keeps the cheapest fare (`app/api/search/route.ts:18` to `app/api/search/route.ts:32`, `app/api/search/route.ts:191` to `app/api/search/route.ts:204`).

The client accumulates all streamed flight chunks and runs the same coarse key before setting state (`app/page.tsx:86` to `app/page.tsx:100`, `app/page.tsx:758` to `app/page.tsx:762`). Hotels are assigned directly from the latest hotel chunk with no dedupe pass (`app/page.tsx:763` to `app/page.tsx:767`).

### Render, Sort, and State Keys

Flights are filtered by exact stop count, then sorted by `sortFlights`. The fallback order is currency, price, stops, depart, carrier, then id (`lib/search/sortFlights.ts:14` to `lib/search/sortFlights.ts:22`). Deal sort uses score records keyed by `fare.id` (`lib/search/sortFlights.ts:30` to `lib/search/sortFlights.ts:43`; `app/page.tsx:895` to `app/page.tsx:907`).

`FlightResults` renders each card with React key `fare.id` and reads score/loading state by `fare.id` (`components/flights/FlightResults.tsx:325` to `components/flights/FlightResults.tsx:331`). Hotel cards use React key `hotel.id` and score/loading state keyed by `hotel.id` (`app/page.tsx:1438` to `app/page.tsx:1444`, `app/page.tsx:1473` to `app/page.tsx:1479`).

### Booking Handoff Identity

Duffel fares build a stable internal `/book` URL containing `offerId: fare.id`, provider, route, depart, return, carrier, stops, integer `priceCents`, currency, passenger count, and price scope (`lib/booking/config.ts:140` to `lib/booking/config.ts:158`). `BookingFareContext` preserves those fields (`lib/booking/config.ts:3` to `lib/booking/config.ts:16`). External flight and hotel provider handoffs use deeplinks only; they do not carry an in-app stable result identity beyond the outbound URL.

## Duplicate-Risk Examples

### 1. Travelpayouts endpoints can produce duplicate-looking cards, and dedupe may be unsafe

Travelpayouts can add the same route/date from v2 latest, v1 calendar, and v1 cheap with different IDs (`tp-v2`, `tp-cal`, `tp-v1`). The client dedupe key ignores source endpoint, return date, stops, cabin, passenger count, price scope, deeplink, and fetched time. It keeps the cheapest card for the same currency, carrier, route, and first 16 chars of depart.

Safe dedupe candidate: same Travelpayouts carrier, same origin/destination, same departure minute, same return date, same stops, same cabin, same price scope, same passenger count, and same deeplink.

Unsafe dedupe: same carrier and depart minute but different return date, stops, booking gate, passenger total/per-person scope, or deeplink. The current key can collapse those without disclosure.

### 2. Cross-provider duplicate-looking flights can still appear

Duffel, Amadeus, Kiwi, and Travelpayouts use provider-specific IDs. If two providers return the same real itinerary but with different carrier labels or departure precision, the current dedupe key will not merge them. Cards can look nearly identical because `FlightCard` shows route, carrier/source, stops, cabin, date/time, price, Deal Score, and CTA (`app/components/FlightCard.tsx:288` to `app/components/FlightCard.tsx:315`, `app/components/FlightCard.tsx:180` to `app/components/FlightCard.tsx:192`).

Safe dedupe candidate: same provider, same immutable provider offer ID, or same provider deeplink target with the same route/date/stops/cabin/price scope.

Unsafe dedupe: different providers with similar display fields. They may differ by ticketing source, fare rules, baggage, availability, refundability, or booking support. These should be disclosed as separate provider offers, not silently merged.

### 3. Duplicate-looking Duffel offers can appear with different stable IDs

Duffel uses `offer.id` directly. Two Duffel offers may share visible fields shown on the card: route, owner carrier, depart/return, stops, cabin, and price. The UI does not display offer ID except after opening booking review technical reference, and the card does not expose fare-rule differences. Because React/scoring state uses `fare.id`, these cards remain technically distinct and handoff-stable, but users may not see why both exist.

Safe dedupe candidate: exact same Duffel `offer.id` repeated in the same response or cache payload.

Unsafe dedupe: different Duffel `offer.id` values that look the same on card. They can represent materially different offers even with identical visible facts.

### 4. Hotels have no dedupe and limited distinguishing facts

Hotellook IDs are `String(entry.hotelId)` (`lib/providers/hotellook.ts:101` to `lib/providers/hotellook.ts:114`). The page does not dedupe hotels before rendering (`app/page.tsx:763` to `app/page.tsx:767`). Cards show name, area, stars, rating, photo, nightly price, and the HotelLook CTA (`app/components/HotelCard.tsx:238` to `app/components/HotelCard.tsx:290`). If the provider returns the same hotel ID twice, React keys collide; if it returns two near-duplicate hotel records with different IDs but same name/area/photo, both can display with no explanation.

Safe dedupe candidate: exact same `hotel.id` from the same provider for the same check-in/check-out and same deeplink.

Unsafe dedupe: same hotel name and area with different provider IDs, room types, taxes/fees inclusion, cancellation policy, or deeplink. The current normalized shape does not include room type or policy, so disclosure is safer than dedupe for near matches.

## Distinguishing Facts Currently Missing

Flight cards do not show provider offer ID, booking gate, flight number, fare brand, fare rules, baggage inclusion, return-leg route detail, or whether the shown price is live provider total versus affiliate search redirect. They do show source, carrier, stops, cabin, price basis, and price/change disclaimers.

Hotel cards do not show room type, board basis, refundable/nonrefundable policy, taxes/fees inclusion beyond "before taxes and fees", provider hotel ID, or why same-name hotels differ.

## Booking Handoff Stability

Duffel duplicate-looking cards have stable in-app handoff identity because `/book` receives `offerId=fare.id` plus route, provider, price cents, currency, passenger count, and price scope (`lib/booking/config.ts:140` to `lib/booking/config.ts:158`). The review page parses that context from URL params (`lib/booking/config.ts:123` to `lib/booking/config.ts:137`).

Travelpayouts, Amadeus, Kiwi, and HotelLook cards do not get an in-app selected-result review identity. They open provider deeplinks or disabled CTAs. Duplicate-looking external cards therefore rely on the deeplink and visible card facts, not an expaify-stable booking review record.

## Manual Verification

Attempted normal runtime verification for a round-trip flight + hotel search was blocked by the environment. Command:

`npm run dev -- -H 127.0.0.1 -p 3002`

Result: failed before serving the app with `listen EPERM: operation not permitted 127.0.0.1:3002`.

Because the server could not bind, I could not complete the required desktop and 375px browser inspection of repeated-looking live results. Static UX review found the results grids use one column by default, two columns at `sm`, and three at `lg` for both flight and hotel cards (`components/flights/FlightResults.tsx:325` to `components/flights/FlightResults.tsx:334`, `app/page.tsx:1437` to `app/page.tsx:1450`, `app/page.tsx:1472` to `app/page.tsx:1479`). Loading, empty, and provider-unavailable states are present for flights (`components/flights/FlightResults.tsx:145` to `components/flights/FlightResults.tsx:170`) and hotels (`app/page.tsx:1451` to `app/page.tsx:1470`).

Observed labels from source-level inspection:

- Flight CTA: `Check with ${fare.source}` for external providers; `Review paused booking` for Duffel internal review.
- Flight visible identity: route, carrier via source, stops, cabin, depart/return dates/times, price, price basis, Deal Score.
- Hotel CTA: `Check with HotelLook`.
- Hotel visible identity: name, area, stars, rating, photo if present, nightly price, "before taxes and fees".

## Recommendations

Do not implement blanket cross-provider dedupe. Provider-specific offers that look similar can differ materially.

Narrow safe repair candidates for a future ticket:

- Add duplicate detection telemetry/reporting around exact repeated `fare.id` and `hotel.id`.
- For Travelpayouts, include return date, stops, cabin, passenger count, price scope, and deeplink in any safe dedupe key before suppressing cards.
- For hotel exact ID repeats, keep one card per provider hotel ID/check-in/check-out/deeplink and log duplicate payloads.
- For near-duplicates, prefer disclosure such as provider/source/gate/offer details over silent merging.

## Required Return Note

- What changed and why: Added this audit report documenting duplicate and near-duplicate result risks, identity/key paths, safe versus unsafe dedupe boundaries, booking handoff stability, and manual verification blockers.
- Files changed: `docs/audits/2026-06-30-audit-results-duplicate-offer-trust-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed. `npm test -- --runInBand` passed: 20 suites, 168 tests.
- Out-of-scope findings or blockers: Product dedupe logic was intentionally not implemented. Runtime desktop/mobile manual search was blocked by sandbox server bind failure (`EPERM`). Requested ticket files for `TicketCard`, `TicketSlideOver`, and `app/api/tickets/route.ts` are absent in this worktree.
