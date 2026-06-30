# Senior Developer Contract Audit: Provider, Money, Cache, Booking, Scoring

Date: 2026-06-30  
Ticket: AUDIT-SENIOR-DEV-01  
Scope: Provider boundaries, Result<T> behavior, integer money units, cache-key completeness, env usage, outbound deeplink attribution, booking safety gates, and score confidence rules.

## Executive Summary

P0: None found.

P1 engineering-contract issues remain. The repaired implementation still can emit outbound flight deeplinks without affiliate attribution, has active Kiwi vendor wiring outside the approved provider/env contract, and creates Duffel booking orders from an API route instead of a provider-layer booking adapter.

No P0 issue was found in integer money units, score confidence rules, or the core search provider Result<T> pattern.

## Findings

### P1: Flight providers can return bookable outbound links without affiliate attribution

Evidence:
- `lib/providers/travelpayouts.ts:63-72` reads `TP_AFFILIATE_MARKER`, logs when missing, then still returns a plain Aviasales URL when no marker is configured.
- `lib/providers/travelpayouts.ts:161`, `lib/providers/travelpayouts.ts:197`, and `lib/providers/travelpayouts.ts:237` attach that possibly-unattributed URL to returned fares.
- `lib/providers/amadeus.ts:61-66` builds a provider search URL with route/date params only.
- `lib/providers/amadeus.ts:214` exposes that Amadeus URL as the fare `deeplink`.
- `app/api/search/route.ts:136-138` streams Amadeus fares to clients without any attribution guard.

Why this breaks the contract:
- The briefing says affiliate markers must be attached to outbound deeplinks.
- Search results can render these links as `Book flight` CTAs in `app/components/FlightCard.tsx:250-254`.

Repro steps:
1. Unset `TP_AFFILIATE_MARKER`.
2. Configure `TP_TOKEN`.
3. Call `GET /api/search?origin=JFK&dest=LAX&depart=2026-09-22`.
4. Any Travelpayouts result has a plain `https://www.aviasales.com/search/...` deeplink with no marker.
5. Configure Amadeus credentials and repeat; Amadeus results use `https://www.amadeus.com/en/search?...` with no affiliate marker.

Recommended repair ticket:
- P1: Enforce outbound affiliate attribution before returning flight fares. If a provider cannot produce an attributed booking URL, return no outbound deeplink or mark booking unavailable; do not render an unattributed `Book flight` CTA.

### P1: Kiwi is an active vendor integration despite not being in the approved provider/env contract

Evidence:
- `lib/providers/kiwi.ts:42-43` reads `process.env.KIWI_KEY`.
- `lib/providers/kiwi.ts:74-94` calls the Kiwi Tequila API.
- `lib/providers/kiwi.ts:118` returns Kiwi `deep_link` directly as the fare deeplink.
- `app/api/search/route.ts:7` imports the Kiwi provider.
- `app/api/search/route.ts:139-141` streams Kiwi results to clients.

Why this breaks the contract:
- The ticket briefing lists `lib/providers/kiwi.ts` as stubbed.
- The approved env list is `TP_TOKEN`, `AMADEUS_ID`, `AMADEUS_SECRET`, `DUFFEL_KEY`, and `HOTEL_AFFILIATE_ID`; `KIWI_KEY` is outside that contract.
- Kiwi outbound links are passed through without affiliate attribution.

Repro steps:
1. Set `KIWI_KEY`.
2. Call `GET /api/search?origin=JFK&dest=LAX&depart=2026-09-22`.
3. The search route attempts Kiwi live fare retrieval and can stream Kiwi `deep_link` values to clients.

Recommended repair ticket:
- P1: Return Kiwi to a true stub or explicitly approve it as a live cash provider with contracted env names, affiliate attribution rules, and tests.

### P1: Booking route calls Duffel directly instead of going through provider-layer booking code

Evidence:
- `app/api/book/route.ts:4` defines `https://api.duffel.com`.
- `app/api/book/route.ts:110-115` calls `GET /air/offers/{offerId}` directly.
- `app/api/book/route.ts:148-176` calls `POST /air/orders` directly.

Why this breaks the contract:
- The briefing says every external API call goes through `lib/providers`.
- Search integrations follow that boundary; booking does not.
- This keeps booking-specific vendor behavior, error mapping, and safety checks outside the provider contract where future provider parity would need to live.

Mitigating evidence:
- `app/api/book/route.ts:40-45` blocks booking unless `BOOKING_ENABLED === 'true'`.
- `app/api/book/route.ts:60-63` requires a validated Duffel fare context.
- `app/api/book/route.ts:65-70` rejects multi-passenger booking.
- `app/api/book/route.ts:136-145` revalidates price and currency before order creation.

Recommended repair ticket:
- P1: Move Duffel offer refresh/order creation behind a provider-layer booking adapter, keeping the current API route gates as the caller-facing policy layer.

### P2: Affiliate marker/env naming is inconsistent with the briefing

Evidence:
- `lib/providers/travelpayouts.ts:63-64` uses `TP_AFFILIATE_MARKER`.
- `lib/providers/hotellook.ts:46-47` uses `TP_AFFILIATE_MARKER`.
- `lib/providers/hotellook.ts:59-60` fails hotel search when `TP_AFFILIATE_MARKER` is missing.

Why this matters:
- The briefing names `HOTEL_AFFILIATE_ID`, not `TP_AFFILIATE_MARKER`.
- The implementation may be correct operationally if Travelpayouts requires `marker`, but the code contract and deployment env contract are not aligned.

Recommended repair ticket:
- P2: Decide the canonical affiliate env names and update provider validation/tests/docs together. Do not accept silent fallback to unattributed links.

### P2: Cached normalized results embed affiliate deeplinks but cache keys do not include attribution state

Evidence:
- Travelpayouts cache key at `lib/providers/travelpayouts.ts:122-123` includes origin, destination, depart, return, and passengers, but not marker/attribution state.
- HotelLook cache key at `lib/providers/hotellook.ts:63` includes location/check-in/check-out, but not marker/affiliate state.
- Returned cached objects include deeplinks built with the marker at fetch time.

Why this matters:
- If a cache entry is created while the marker is missing or stale, clients can receive stale unattributed or wrong-attribution deeplinks for up to six hours after env repair.

Recommended repair ticket:
- P2: Cache raw provider response separately from app-built deeplinks, or include a stable affiliate-marker version in cache keys and invalidate old entries after env changes.

## Contract Areas With No P0/P1 Issue Found

- Result<T> behavior: provider search/trend methods return `{ ok: true, data }` or `{ ok: false, reason }` and catch fetch/cache parsing failures at the method boundary.
- Integer money units: reviewed provider mappings store prices as `{ priceCents, currency }`; no bare numeric fare price is returned through shared provider types.
- Cache TTL: provider response caches use `21600` seconds, matching the 6-hour requirement.
- Score confidence: `lib/scoring/scoreDeal.ts:76-117` marks fewer than 10 historical points as low confidence and caps low-confidence verdicts at `Typical`, so thin history cannot claim `Great`.
- Booking safety gates: the current booking route has meaningful gates for disabled booking, provider validation, single passenger only, and price/currency revalidation before order creation. The remaining P1 is boundary placement, not absence of all gates.

## Out-of-Scope Notes

- `scripts/check-alerts.ts` calls Resend directly. This audit focused on travel provider, booking, money, cache, and scoring contracts; email-provider boundaries were not assessed.
- I did not modify product code.
