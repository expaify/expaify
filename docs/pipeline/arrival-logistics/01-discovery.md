# UXD-ARRIVAL-LOGISTICS-01: Arrival And Check-In Logistics Confidence

## Pain Point

A traveler discovers arrival constraints — what time they can actually check in, whether a late-night arrival is supported, how they get from the airport, where they park, and what to do with bags before check-in or after check-out — only after committing to a price and clicking through to the provider, so a compelling hotel deal can quietly fail at the handoff when the arrival reality lands too late.

## Affected Users And Flow Step

- **Who is affected:** First-time and price-led users comparing hotel deals, and specifically travelers arriving off a flight — late-night arrivals, early-morning arrivals before standard check-in, and anyone without a car who needs to know how they reach the door. These users cannot commit to a "good price" without knowing the price is actually usable given when and how they arrive.
- **Flow steps (the ticket's "deal detail → booking handoff"):**
  1. **Hotel results card — expanded "Details"** (`app/components/HotelCard.tsx`). The expanded panel renders `DealScorePanel`, `QualityEvidencePanel` (hotel class, guest rating), a "Location" block (`getHotelLocationDisplay`), and a "Price scope" block. Nothing addresses check-in time, late arrival, airport transfer, parking, or baggage. The only arrival-adjacent datum shown is `distanceText` ("X km from city center"), and only when the provider returns it.
  2. **Deal detail page — "Stay details"** (`app/deals/[dealId]/page.tsx:403-416`). This section shows `Check-in` and `Check-out` **calendar dates** (`checkInDisplay`, `checkOutDisplay` derived from `deal.check_in_date` + `nights`), plus Nights, and hard-coded "unavailable" facts for Guests and Room/rate. The label "Check-in" here is a **date**, not an arrival time — there is no time-of-day, late-arrival, transfer, parking, or baggage signal anywhere on the page.
  3. **Booking handoff — `HotelHandoffReview`** (`app/book/BookingFlow.tsx:481-522`). The last internal screen before the user leaves expaify. It repeats one catch-all disclaimer: *"Confirm the location, taxes, fees, cancellation policy, room details, and live availability with the provider before payment."* Arrival logistics is not named at all — it is folded into "room details" and "the provider," landing after the user has already decided to continue.

Across all three surfaces, arrival logistics is either absent or implicit. The user never sees "you arrive at 11pm — confirm late check-in" as a fact they can act on before clicking through.

## Current Implementation Signal (source-verified)

- **No arrival fields exist in the type system.** `HotelOffer` (`lib/types.ts:137-151`) covers price, stars, rating/quality evidence, and location only. There is no field for check-in time, check-out time, late-arrival policy, parking, baggage storage, or ground transfer.
- **The live hotel provider returns none of this data.** `HotellookProvider.searchHotels` (`lib/providers/hotellook.ts`) parses the Travelpayouts HotelLook `cache.json` feed, whose shape (`HotelLookCacheEntry`) carries only `hotelId`, `hotelName`, `stars`, `location`, `address`, `distance`, `priceFrom`, `photoUrl`, `propertyType`. No check-in window, late-arrival, parking, baggage, or transfer field is fetched, parsed, or cached.
- **The deals/snapshots schema returns none of this data either.** `lib/db/schema.sql` `deals` and `price_snapshots` tables carry `check_in`/`check_in_date` (a **calendar date**), `check_in_window` (a date-range *string* like "Mar 12 – 14"), and `nights`. There is no arrival-time or logistics column. `check_in_window` is a date range, not a check-in time window — a naming collision this feature must not inherit.
- **`transfers` is a false friend.** The only "transfer"/"transfers" tokens in the codebase are in `lib/providers/travelpayouts.ts` and mean **flight layovers (connection count)** mapped to `stops` — not airport ground transfer. There is no ground-transport data anywhere.
- **The one structured arrival-adjacent datum that does exist** is `HotelLocation.distance` (`{ value, unit: 'mi'|'km', referencePoint }`, e.g. "1.2 km from city center") rendered by `completeDistance` in `hotelLocationContext.ts`. It is a proximity signal, not an airport/transfer signal, and is frequently absent.
- **A proven honesty pattern already exists in this repo.** `HotelRatingEvidence` (`kind` + `confidence: 'verified' | 'provider_only' | 'inferred' | 'unavailable'`) lets `HotelCard` state quality only when it can back it up, and degrade to an explicit "not provided" state otherwise. The adjacent, already-shipped `cancellation-policy` discovery (`docs/pipeline/cancellation-policy/01-discovery.md`) reached the same conclusion for a sibling problem: the feed returns nothing, so the honest MVP is an evidence/confidence-shaped "unconfirmed — confirm with provider" state, not a fabricated fact.

## Measurable Signal

The problem is observable today because:
1. No card, panel, or handoff screen lets a user distinguish a hotel that supports their arrival (late check-in, near the airport, bag storage) from one that does not, before clicking "Review hotel."
2. Arrival logistics appears only as a catch-all disclaimer on the final handoff screen — never as an answer earlier in the flow.
3. There is no analytics event capturing whether logistics information was viewed or whether it preceded a handoff abandon. The success metric named in the ticket — *fewer handoff abandons where logistics info is viewed, more booking clicks in late-arrival scenarios* — **cannot be measured at all today**, because no `hotel_logistics_viewed` / `hotel_book_cta_clicked` event pair exists. Instrumenting the signal is therefore part of the deliverable, not an afterthought; downstream stages must define concrete event names so TEST can verify the signal exists, not just that copy renders.

## Constraints The Solution Must Respect

1. **Data integrity — never fabricate an arrival fact.** Do not state a check-in time, late-arrival policy, parking availability, baggage-storage option, or transfer detail unless it comes directly from a provider field. Today no provider returns these, so the honest surface is an explicit "confirm with provider" state — mirror the `unavailable`/`inferred` confidence pattern already used for `HotelRatingEvidence`, never infer or paraphrase a policy. Non-guaranteed wording is mandatory per the ticket.
2. **Provider-feed reality bounds the MVP.** The current `HotellookProvider` and the deals schema fetch zero arrival-logistics data. A UI built against this ticket can, today, only (a) reframe/clarify the data that already exists (calendar check-in date vs. arrival time; `HotelLocation.distance` proximity) and (b) render an honest, concise prompt to confirm the rest. Surfacing *real* check-in-time / late-arrival / parking / baggage / transfer facts requires a provider-side or data-pipeline change, which is out of scope for the UXD→UI Fable stages and must be scoped as its own DEV/provider ticket.
3. **Card and handoff brevity.** The `HotelCard` collapsed row already carries hotel-class and guest-rating chips in a wrapping `text-xs` row; the handoff screen is deliberately calm and text-light. Any card-level arrival signal must fit the existing chip/short-line pattern (a few words) with the full, plain-language explanation living in the expanded "Details" panel, the deal-detail page, and the handoff — no multi-line logistics text on the collapsed card, no decorative clutter, usable at 375px.

## Success Statement

This is solved when a first-time user evaluating a hotel deal can, **before** clicking through to the provider, see the smallest honest set of arrival-logistics signals — anchored on the one or two facts expaify can actually back (calendar check-in date, and airport/city-center proximity where the provider supplies it) plus a concise, non-guaranteed prompt to confirm check-in time, late arrival, parking, and baggage with the provider — without ever encountering a fabricated arrival fact and without discovering the arrival constraint only after committing at the handoff.

## Smallest Actionable Set For An MVP (input to UXR)

Ranked by data-honesty and impact, for downstream stages to validate — **not** a design:
1. **Disambiguate the existing "Check-in" fact** so users don't read the calendar check-in *date* as an arrival *time*. Zero new data required; pure clarity fix.
2. **Elevate the proximity signal that already exists** (`HotelLocation.distance`) into the arrival-logistics story with non-guaranteed wording, and state plainly when it is absent. Zero new data required.
3. **One concise "arrival logistics — confirm with provider" prompt** covering check-in time, late arrival, parking, and baggage as explicitly *unconfirmed* (evidence/confidence-shaped), placed before the handoff CTA rather than only inside it. Zero new provider data required; honest by construction.
4. **(Out of scope for Fable stages; flag for DEV/provider ticket)** Any *actual* structured check-in-time / late-arrival / parking / baggage / airport-transfer fact requires a new provider field or feed. Do not design UI that implies expaify has this data until a provider ticket lands it.

## Out-Of-Scope / Conflict Note

The ticket asks the solution to "rely on structured provider data where available." Source review shows that for arrival logistics this data is effectively **unavailable** from every current provider and from the deals schema — the only structured arrival-adjacent datum is `HotelLocation.distance`. This is not a hard contract conflict (discovery produces docs only, and the ticket already scopes to "where available" with "non-guaranteed wording"), but it materially bounds the MVP: the deliverable is an honest confirm-with-provider experience plus analytics, **not** a set of arrival-fact badges. Any richer arrival-fact surface must be preceded by a provider/data DEV ticket. This is surfaced here so UXR/UXDES do not design against data that does not exist.
