# AUDIT-PREMIUM-COPY-SPECIFICITY-01

Date: 2026-06-30
Scope: visible copy across homepage search, results, flight cards, hotel cards, baggage estimator, and booking review.
Production code changed: no.

## Executive summary

The core flow is generally specific about price basis, provider handoff, low Deal Score confidence, and paused booking. The main trust gaps are from "live" and "actually worth booking" language that implies stronger verification than the app can prove, route suggestion metadata that sounds data-backed without showing data, and booking success copy that can read like a real order confirmation even when the path may be sandbox-only.

`app/components/SearchForm.tsx`, `app/components/BookingReview.tsx`, and `app/book/[id]/page.tsx` were listed in the ticket but do not exist in this worktree. The inspected equivalents were `app/page.tsx` and `app/book/BookingFlow.tsx`.

## Problematic copy findings

| Severity | String | Location | Risk type | Risk | Recommended direction |
| --- | --- | --- | --- | --- | --- |
| P1 | "Know when a flight price is actually worth booking." | `app/page.tsx:796` | Vague / unsupported certainty | "Actually worth booking" promises a judgment the product may not fully support because scores are based on route history, current returned fares, and confidence. It can overstate certainty when provider coverage is incomplete or Deal Score confidence is low. | Tie claim to the data contract: "See how current fares compare with recent route history." |
| P1 | "Live fare scoring" | `app/page.tsx:793` | Unsupported certainty | "Live" implies real-time fare verification, but providers are cached, streamed, and may be unavailable or partial. This conflicts with later copy saying price and availability can change. | Use "Current fare scoring" or "Fare scoring from returned provider prices." |
| P1 | "Add a route to rank live prices by deal quality." | `app/page.tsx:822` | Unsupported certainty | "Live prices" and "deal quality" sound stronger than the available data. The app ranks returned provider prices against baselines, not all live market inventory. | Use "Add a route to compare returned fares against recent route history." |
| P1 | "Booking confirmed" / "Order confirmed" | `app/book/BookingFlow.tsx:268`, `app/book/BookingFlow.tsx:274` | Legal-risk claim | This can imply a real airline order even when Duffel sandbox mode is active or the copy says "sandbox-capable booking path." A user could interpret this as an actual ticketing confirmation. | Split sandbox and production states. In sandbox, say "Sandbox booking reference returned." In production, only use "Booking confirmed" if the provider contract guarantees an order was created. |
| P2 | "Search current fares..." | `app/page.tsx:799` | Vague / unsupported certainty | "Current fares" is acceptable directionally, but without provider/caching context it can feel broader than the app's returned inventory. | Add provider-returned specificity where space allows: "Search returned provider fares and compare..." |
| P2 | "90-day route history" | `app/page.tsx:809` | Data-backed but context missing | The phrase is strong and useful, but it does not state that history can be thin and confidence can be low. Homepage users may infer every route has full history. | Keep the claim, but pair nearby with a confidence caveat or "when enough history exists." |
| P2 | "Deal history ready" | `app/page.tsx:31`, rendered at `app/page.tsx:1015` | Vague premium / unsupported | Route suggestion metadata implies verified baseline readiness for that exact route, but the UI does not disclose history count or freshness before search. | Replace with neutral route category or only show after baseline count is known. |
| P2 | "Flexible date friendly" | `app/page.tsx:32`, rendered at `app/page.tsx:1015` | Vague premium | Marketing-ish phrase without a visible criterion. It does not tell users what data supports the suggestion. | Use concrete input guidance, e.g. "Try nearby dates" if the feature actually searches flex dates. |
| P2 | "Popular route" | `app/page.tsx:33`, rendered at `app/page.tsx:1015` | Unsupported popularity claim | Popularity is not shown or sourced. It reads like filler. | Replace with factual geography/category copy or remove metadata. |
| P2 | "Price swings often" | `app/page.tsx:34`, rendered at `app/page.tsx:1015` | Unsupported volatility claim | Volatility claim is not backed by a visible metric. This can feel cheap if the current route history does not show volatility. | Use only when route baseline volatility is computed; otherwise use neutral category copy. |
| P2 | "Frequent fare drops" | `app/page.tsx:35`, rendered at `app/page.tsx:1015` | Unsupported urgency / deal claim | Suggests recurring deal behavior without a displayed basis. It can look like fake deal bait. | Use computed historical drop counts, or replace with neutral "Domestic route." |
| P2 | "Scanning deals..." / "Scanning deals across providers..." | `app/page.tsx:980`, `app/page.tsx:1094` | Vague / fake activity | "Deals" implies the app is finding discounted inventory before score data has returned. During loading the app is fetching provider fares and score inputs. | Use "Checking provider fares..." or "Loading returned fares..." |
| P2 | Fire icon plus "{n} great deals" | `app/page.tsx:1114` | Fake urgency / cheap-feeling embellishment | The icon adds urgency/heat. The count can be valid when based on score, but presentation weakens premium trust. | Keep the count if score-backed, remove hype styling/icon, and include confidence logic if possible. |
| P2 | "Best deal" sort | `components/flights/FlightResults.tsx:185` | Vague ranking label | "Best" can imply a holistic ranking including airline quality, duration, baggage, and booking reliability. Current sort is score-driven and may defer while scores load. | Use "Deal Score" or "Deal Score rank." |
| P2 | "Checking live flight inventory" | `components/flights/FlightResults.tsx:231` | Unsupported certainty | "Live inventory" overstates provider coverage and freshness. | Use "Checking provider fares" or "Loading returned flight prices." |
| P2 | "Fare cards will appear as providers return usable prices for this route." | `components/flights/FlightResults.tsx:239` | Mostly clear, minor vagueness | "Usable prices" is internal language. Users need to know whether prices are missing, invalid, or not bookable. | Use "Fare cards appear when a provider returns a price and route details." |
| P2 | "Flight providers unavailable" | `components/flights/FlightResults.tsx:134` | Overgeneralized outage | The state derives from provider notices and zero flights. It may mean no usable inventory or partial provider failure, not all providers unavailable. | Use "No usable provider fares returned" unless all configured providers failed. |
| P2 | "The flight providers we could reach did not return usable inventory." | `components/flights/FlightResults.tsx:143` | Internal / unclear | "Usable inventory" hides the reason from users and can mask broken provider mappings. | Name the user-impacting condition: "We did not receive bookable fare details for this route/date." |
| P2 | "Get an email when prices drop below today's level" | `components/flights/FlightResults.tsx:280` | Ambiguous alert criteria | "Today's level" is unclear because threshold is the current minimum returned fare, not necessarily the whole-market price today. | Use "below the lowest fare returned in this search" if that is the threshold. |
| P2 | "Review paused booking" | `app/components/FlightCard.tsx:194` | Unclear action | The phrase is awkward and may imply a booking already exists. | Use "Review fare details" with the note "In-app booking is paused." |
| P2 | "Check with {fare.source}" | `app/components/FlightCard.tsx:195` | Unclear action / provider handoff | It does not say whether the user is booking, checking availability, or opening a search. | Use "Open provider result" or "Check price with {source}" depending on deeplink contract. |
| P2 | "Book hotel" | `app/components/HotelCard.tsx:281` | Legal-risk / overstates action | The button goes to HotelLook via affiliate deeplink, not an in-app confirmed booking. | Use "Check hotel on HotelLook" or "Open hotel offer." |
| P2 | "Excellent" / "Very good" / "Good" guest rating labels | `app/components/HotelCard.tsx:30` | Unsupported qualitative label | Numeric rating is shown, but label source is local thresholds. If the provider supplies a named rating label, use it; otherwise the local adjective can imply provider endorsement. | Prefer numeric-only, or label as "Guest rating 8.5/10" without adjective. |
| P3 | "Travel deal intelligence" | `app/page.tsx:784` | Vague premium | Brand tagline is not harmful, but it is generic and does not add trust. | Lower priority. Replace with a concrete product description if revisiting homepage copy. |
| P3 | "Cash fares first" | `app/page.tsx:825` | Clear but insider-ish | It reflects MVP scope, but user-facing meaning may be unclear to non-award travelers. | Use "Flights priced in cash" if this remains visible to consumers. |
| P3 | "Search anywhere" | `components/flights/FlightResults.tsx:144` | Confusing action | The form's destination placeholder is "Anywhere," but actual provider behavior may require/handle blank destination differently. | Use "leave destination blank" only if blank-destination search is supported and tested. |
| P3 | "Technical reference" | `app/book/BookingFlow.tsx:112` | Developer-facing language | Accurate but may feel internal in a consumer checkout review. | Use "Provider reference" or hide under support/debug affordance. |

## Copy that is specific and should be preserved

- Deal Score low-confidence handling is strong: "Not enough route history for a confirmed deal rating" in `app/components/FlightCard.tsx:143` and "Limited history" in `app/components/DealBadge.tsx:16` avoid overclaiming Great on thin data.
- Flight card handoff note is trust-building: "Opens provider search. Price and availability can change." in `app/components/FlightCard.tsx:200`.
- Hotel unavailable reasons are specific: "No confirmed nightly price or valid booking link was returned." in `app/components/HotelCard.tsx:125`.
- Baggage estimator has appropriately cautious confidence copy and disclaimer handling in `components/baggage/BaggageFeeEstimator.tsx:20-24`, `components/baggage/BaggageFeeEstimator.tsx:148-150`, and `components/baggage/BaggageFeeEstimator.tsx:196`.
- Booking paused states are explicit about no payment collection and no order creation in `app/book/BookingFlow.tsx:207-208` and `app/book/BookingFlow.tsx:301-302`.

## Manual verification flow

Static/manual flow reviewed against code paths:

1. Homepage search, 375px and desktop: inspected form copy, route suggestions, loading button, local recent searches, flexible dates, passenger controls, and validation errors in `app/page.tsx:771-1044`.
2. Results, 375px and desktop: inspected sticky route header truncation, loading state, provider notices, empty states, sorting/filter labels, flight cards, alert signup, disabled hotels tab, and hotels empty state in `app/page.tsx:1048-1238` and `components/flights/FlightResults.tsx:148-320`.
3. Booking review, 375px and desktop: inspected missing fare, paused booking, sandbox, error, success, fare summary, sticky submit area, and fallback loading copy in `app/book/page.tsx:17-25` and `app/book/BookingFlow.tsx:147-354`.

Visual copy-fit assessment from classes:

- Mobile 375px: primary long strings are generally wrapped, truncated, or in single-column layouts. The highest-risk fit areas are route suggestion metadata in fixed `w-[15.5rem]` cards, FlightCard CTA truncation at `app/components/FlightCard.tsx:297`, and the sticky booking submit area at `app/book/BookingFlow.tsx:345-354`.
- Desktop: copy hierarchy is scannable. No inspected copy relies on overlapping absolute positioning except the route line pill in `app/components/FlightCard.tsx:252-256`, which uses fixed side widths and short labels.
- Focus states: buttons and booking links generally have focus styles; route suggestion buttons and some small pills rely on hover/color changes more than explicit focus-visible rings.
- Decorative effects: no cheap decorative copy effects were found beyond the fire icon next to great-deal count, which is flagged above.

## Out-of-scope observations

- No production code was changed.
- `app/components/SearchForm.tsx`, `app/components/BookingReview.tsx`, and `app/book/[id]/page.tsx` do not exist in this branch. This audit used current equivalents.
- This audit did not repeat prior legality review except where wording can directly imply a booking/order, live inventory, or provider-backed hotel booking.
