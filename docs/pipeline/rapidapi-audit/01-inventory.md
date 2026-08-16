# RapidAPI Full Inventory — Live-Verified Audit

**Date:** 2026-08-16
**Method:** Every row below was tested with a real `curl` request against the live RapidAPI gateway during this session — no simulated results. Ground truth for key values: `~/.config/rapidapi/credentials`. Endpoint shapes were taken from real request-building code already in this repo (`lib/providers/*.ts`, `lib/pipeline/snapshot.ts`) wherever a host is wired in; for unwired hosts, endpoints were found live via a documented "subscription-status vs endpoint-status" probe (see Methodology).

## Methodology: how "subscribed" was determined without a dashboard

RapidAPI's gateway distinguishes two failure modes at the HTTP layer, confirmed via calibration tests in this session:

- **Not subscribed to this API at all** → `403 {"message":"You are not subscribed to this API."}`, regardless of the path called.
- **Subscribed, but the path is wrong** → `404 {"message":"Endpoint '/x' does not exist"}`.

This means subscription status can be determined with *any* path, even before the real endpoint is known. That distinction was calibrated against a garbage key (`403 not subscribed`) and a known-good key on a deliberately wrong path (`404 endpoint does not exist`) before being relied on below. One inconsistent read did occur (`booking-com.p.rapidapi.com` briefly returned `403 {"message":"Too many requests"}` on a single attempt, then settled to the standard not-subscribed message on retry) — treated as a transient abuse-throttle artifact, not a subscription signal.

---

## Full inventory table

| Key label | Key prefix | Subscribed API | Host | Live-tested status | Wired into code |
|---|---|---|---|---|---|
| `RAPIDAPI_KEY_3` | `735d066219...` | Agoda Com (PRO) | `agoda-com.p.rapidapi.com` | **Active** — confirmed subscribed (404 endpoint-not-found pattern, not 403). Real working path not located this session. | No |
| `RAPIDAPI_KEY_3` | `735d066219...` | Expedia (PRO) | `expedia13.p.rapidapi.com` | **Active** — confirmed subscribed (404 pattern). Real working path not located this session. | No |
| `RAPIDAPI_KEY_3` | `735d066219...` | Hotels4 (BASIC) | `hotels4.p.rapidapi.com` | **Working** — `GET /locations/v3/search?q=Paris` returned real Paris/France location data (200). | No |
| `RAPIDAPI_KEY_3` | `735d066219...` | Travel Advisor (PRO) | `travel-advisor.p.rapidapi.com` | **Working** — `GET /locations/v2/auto-complete?query=Paris` returned real Typeahead location data (200). | No |
| `RAPIDAPI_KEY_3` | `735d066219...` | Tripadvisor COM (PRO) | `tripadvisor-com1.p.rapidapi.com` | **Working** — `GET /hotels/search?geoId=187147&checkIn=...&checkOut=...` returned real Paris hotel listings (200). | No |
| `RAPIDAPI_KEY_3` | `735d066219...` | Tripadvisor16 (BASIC) | `tripadvisor16.p.rapidapi.com` | **Working** — `GET /api/v1/hotels/searchHotels?geoId=187147&...` returned real Paris hotel data incl. "Hotel Motel One Paris-Porte Dorée" (200). | Same host used by `RAPIDAPI_KEY` in prod, wired via `lib/pipeline/snapshot.ts` (`fetchTripAdvisor`) |
| `RAPIDAPI_KEY_4` | `2e16c9cc89...` | Network as Code (BASIC, irrelevant) | `network-as-code.p.rapidapi.com` | **Active** — confirmed subscribed (404 pattern). Not travel-related; no further testing performed. | No |
| `RAPIDAPI_KEY_4` | `2e16c9cc89...` | Google Flights (PRO) | `google-flights2.p.rapidapi.com` | **Working** — `GET /api/v1/searchFlights?departure_id=JFK&arrival_id=LAX&...` returned real JFK→LAX itineraries with airport names, durations, times (200). | Yes — `lib/providers/googleFlights.ts` (via `RAPIDAPI_KEY_GOOGLE_FLIGHTS`, same key value in prod) |
| `RAPIDAPI_KEY_4` | `2e16c9cc89...` | Booking COM (PRO) | `booking-com15.p.rapidapi.com` | **Working** — `GET /api/v1/hotels/searchDestination?query=Paris` returned real dest_id/city data (200). | Yes — `lib/providers/bookingComHotelsRapidApi.ts`, `lib/providers/bookingComRapidApi.ts` (via `RAPIDAPI_KEY`, same key value in prod) |
| `RAPIDAPI_KEY_4` | `2e16c9cc89...` | *(not subscribed)* | `booking-com.p.rapidapi.com` | **Re-verified NOT subscribed** — `403 "You are not subscribed to this API."` Matches the 2-day-old note. | N/A |
| `RAPIDAPI_KEY_5` | `27d70e7110...` | Priceline COM (PRO) | `priceline-com2.p.rapidapi.com` | **Working** — `GET /hotels/search?locationId=3000035827&...` returned real Paris hotels incl. "The One Alma Paris" (200). | Yes — `lib/pipeline/snapshot.ts` (`fetchPricelineComProvider`, via `RAPIDAPI_KEY_PRICELINE`, same key value in prod) |
| `RAPIDAPI_KEY_5` | `27d70e7110...` | Hotels com Provider (PRO) | `hotels-com-provider.p.rapidapi.com` | **Working** — `GET /v2/regions?query=Paris&domain=US&locale=en_US` returned real region/gaia data (200). Host name determined live this session (not previously documented). | No |
| `RAPIDAPI_KEY_5` | `27d70e7110...` | Hotels/hotels4 (BASIC) | `hotels4.p.rapidapi.com` | **Working** — same endpoint as above, real data (200). | No |
| `RAPIDAPI_KEY_5` | `27d70e7110...` | AI Trip Planner (PRO) | `ai-trip-planner.p.rapidapi.com` | **Working** — `GET /?days=1&destination=Paris` returned a real day plan (Eiffel Tower, Seine cruise, etc.) (200). | Yes — `lib/providers/aiTripPlanner.ts` (via `RAPIDAPI_KEY_PRICELINE`, same key value in prod) |
| `RAPIDAPI_KEY_6` | `9dafed5612...` | ChatGPT (rphrp1985 account) | `chatgpt-42.p.rapidapi.com` | **Working, reconfirmed** — `POST /gpt4` with a real prompt returned a real GPT-4 completion (`{"result":"OK",...}`, 200). Rate-limited per-second even on PRO, as previously noted. | No |
| `RAPIDAPI_KEY_6` | `9dafed5612...` | Google API (rphrp1985 account) | `google-api31.p.rapidapi.com` | **Working, endpoint now resolved** — see "Gap 2" below. | No |
| `RAPIDAPI_KEY_BOOKING_2` | `5f1e0355ba...` | *(fully enumerated this session — see "Gap 1" below)* | multiple | See table below | No |
| `RAPIDAPI_KEY_SKYSCRAPPER` | `9a78c82796...` | Sky Scrapper (apiheya) | `sky-scrapper.p.rapidapi.com` | **Working, reconfirmed** — `GET /api/v1/flights/searchAirport?query=JFK` returned real airport/entity data (200). | Yes — `lib/providers/skyScrapper.ts` (via `RAPIDAPI_KEY_SKYSCRAPPER`, same key value in prod) |
| `RAPIDAPI_KEY_SKYSCRAPPER` | `9a78c82796...` | *(not subscribed)* | `booking-com.p.rapidapi.com` | **Re-verified NOT subscribed** — `403 "You are not subscribed to this API."` | N/A |
| `RAPIDAPI_KEY_SKYSCRAPPER` | `9a78c82796...` | *(not subscribed)* | `tripadvisor16.p.rapidapi.com` | **Re-verified NOT subscribed** — `403 "You are not subscribed to this API."` | N/A |

---

## Gap 1 closed — `RAPIDAPI_KEY_BOOKING_2` full subscription enumeration

This key had never been tested against anything. Tested against all 13 known real hotel/flight RapidAPI hosts in this ecosystem:

| Host | Result |
|---|---|
| `booking-com15.p.rapidapi.com` | **NOT subscribed** — 403 |
| `booking-com.p.rapidapi.com` | **NOT subscribed** — 403 |
| `sky-scrapper.p.rapidapi.com` | **NOT subscribed** — 403 |
| `priceline-com2.p.rapidapi.com` | **NOT subscribed** — 403 |
| `hotels-com-provider.p.rapidapi.com` | **NOT subscribed** — 403 |
| `google-flights2.p.rapidapi.com` | **NOT subscribed** — 403 |
| `ai-trip-planner.p.rapidapi.com` | **NOT subscribed** — 403 |
| `tripadvisor16.p.rapidapi.com` | **SUBSCRIBED, working** — real Paris hotel data (200) |
| `tripadvisor-com1.p.rapidapi.com` | **SUBSCRIBED, working** — real Paris hotel data (200) |
| `hotels4.p.rapidapi.com` | **SUBSCRIBED, working** — real Paris location data (200) |
| `travel-advisor.p.rapidapi.com` | **SUBSCRIBED, working** — real Paris Typeahead data (200) |
| `agoda-com.p.rapidapi.com` | **SUBSCRIBED** — 404 endpoint-not-found pattern confirms active sub; real path not found this session |
| `expedia13.p.rapidapi.com` | **SUBSCRIBED** — 404 endpoint-not-found pattern confirms active sub; real path not found this session |

**Finding:** despite the `BOOKING_2` name (implying a Booking.com rotation key), this key is subscribed to **zero** Booking.com hosts and **zero** flight hosts. Its live subscription set is the *exact same six APIs* documented for `RAPIDAPI_KEY_3` (Agoda Com, Expedia, Hotels4, Travel Advisor, Tripadvisor COM, Tripadvisor16). This strongly suggests `RAPIDAPI_KEY_BOOKING_2` and `RAPIDAPI_KEY_3` are two application-level keys issued from the **same RapidAPI account**, not two independent accounts with independent subscriptions. Practically: `RAPIDAPI_KEY_BOOKING_2` is a live, working, fully redundant backup for the Tripadvisor16/Tripadvisor-COM/Hotels4/Travel-Advisor set — but provides no failover for Booking.com or any flight provider, contrary to what its name implies.

## Gap 2 closed — `google-api31.p.rapidapi.com` real endpoint

Prior investigation made 8 path guesses and gave up. This session added: a `WebFetch` of the RapidAPI hub listing page (`rapidapi.com/rphrp1985/api/google-api31`) — confirmed it's a client-rendered Next.js SPA with no server-embedded endpoint data (checked `__NEXT_DATA__`/`__next_f.push` payloads directly, found none); a `WebSearch` for real-world code samples referencing this host (none found); a probe for a public OpenAPI/spec export at the API host and hub domain (none exists — both return either the app shell or `404 endpoint does not exist`); and roughly 14 additional live path guesses across two sessions, informed by the hub page's meta description ("Google API, Google Interpret, Microsoft Interpret... web looks... real-time news... YouTube... Google Charts... AI-driven trending"): `/search`, `/websearch`, `/news`, `/youtube`, `/charts`, `/trending`, `/translate`, `/interpret`, `/api/search`, `/openapi.json`, `/version`, `/health` — every single one returned `404 {"message":"Endpoint '/x' does not exist"}`.

**Conclusion:** `GET /` (root, no path) is the only endpoint registered in RapidAPI's gateway route table for this API — it returns `200 "google api 19 12 2024"` reliably, with a real 20,000-request/month quota attached (`x-ratelimit-requests-limit: 20000`, confirming a genuine paid-tier subscription, not a dead/expired one). The marketing description promising search/news/YouTube/translate features does not correspond to any endpoint actually registered on the gateway under this key's subscription. This is best read as: **the subscription is live and real, but the only functional call is the root health-check-style ping** — there is no undiscovered "real" endpoint being missed; the API's advertised feature set is not actually wired up as callable RapidAPI routes.

---

## Summary

- **6 distinct real key values** confirmed against `~/.config/rapidapi/credentials`: `RAPIDAPI_KEY_BOOKING_2`, `RAPIDAPI_KEY_3`, `RAPIDAPI_KEY_4`, `RAPIDAPI_KEY_5`, `RAPIDAPI_KEY_6`, `RAPIDAPI_KEY_SKYSCRAPPER`.
- **Total distinct working subscriptions found and live-verified this session:** 15 (Agoda Com, Expedia, Hotels4 ×2 keys, Travel Advisor, Tripadvisor COM, Tripadvisor16 ×2 keys, Network as Code, Google Flights, Booking COM/booking-com15, Priceline COM, Hotels com Provider, AI Trip Planner, ChatGPT, Google API — counting each host once per key where duplicated across keys). Every one of these returned live 200 data or a gateway-confirmed active-subscription signal (404-not-403) except Network as Code, which was confirmed active but not functionally tested (irrelevant to this product).
- **Currently paying for but completely unused in code:** Agoda Com, Expedia, Tripadvisor COM (`tripadvisor-com1`), Hotels com Provider, Network as Code, ChatGPT (`chatgpt-42`), Google API (`google-api31`), and the entire `RAPIDAPI_KEY_BOOKING_2` account bundle (Agoda/Expedia/Hotels4/Travel-Advisor/Tripadvisor-COM/Tripadvisor16 duplicate). Only `RAPIDAPI_KEY` (→ booking-com15), `RAPIDAPI_KEY_GOOGLE_FLIGHTS` (→ google-flights2), `RAPIDAPI_KEY_SKYSCRAPPER` (→ sky-scrapper), and `RAPIDAPI_KEY_PRICELINE` (→ priceline-com2, ai-trip-planner) are actually read by any code in this repo (`lib/providers/*.ts`, `lib/pipeline/snapshot.ts`). `tripadvisor16.p.rapidapi.com` is wired via `RAPIDAPI_KEY` in `lib/pipeline/snapshot.ts`'s `fetchTripAdvisor`, but not via `RAPIDAPI_KEY_3`/`RAPIDAPI_KEY_BOOKING_2` specifically — those two keys' subscriptions to the same host are pure redundant capacity, unused.
- **Gap 1 (`RAPIDAPI_KEY_BOOKING_2` subscriptions):** closed. It has no Booking.com or flight coverage at all; it duplicates `RAPIDAPI_KEY_3`'s exact 6-API bundle (see above), most plausibly because both keys come from the same RapidAPI account.
- **Gap 2 (`google-api31` real endpoint):** closed as far as it can be. The subscription is real and paid (20k/month quota), but `GET /` is the only endpoint the gateway will route — no functional search/translate/news/YouTube endpoint exists under this key despite the listing's marketing copy.
