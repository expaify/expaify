# UX Research: Room Choice Clarity

Ticket: `UXR-HOTEL-ROOM-CHOICE-CLARITY-01`
Stage: UX Research (UXR)
Priority: P1
Date: 2026-07-29
Persona: Senior UX Researcher
Surface: hotel deal detail → provider handoff

---

## Source Inputs

- Discovery: `docs/pipeline/hotel-room-choice-clarity/01-discovery.md`
- Adjacent pipelines read in full for overlap resolution:
  - `docs/pipeline/room-rate-clarity/03-design.md` (rate policy — shipped spec)
  - `docs/pipeline/guest-room-fit/02-research.md` (party capture + room-fit signals)
  - `docs/pipeline/hotel-detail-decision-order/03-design.md` (section order, single handoff boundary)
- Code audited directly this stage (line numbers exact as of this worktree):
  - `lib/types.ts` — `HotelEvidenceScope` 126–130, `SupplierSmokingStatement.roomId` 366, `HotelOffer` 474–495, `HotelSearchPage` 501–506, `HotelProvider` 532–541
  - `lib/providers/hotellook.ts` — `HotelLookCacheEntry` 22–39, `buildDeeplink` 434–436, `searchHotels` 445–552, live map 495–540, `priceFromToCents` 412–424, `checkDocumentReadiness` 554–561
  - `lib/pipeline/otaLinks.ts` — `buildOtaLinks` 8–31 (whole file)
  - `lib/pipeline/dealDetection.ts` — 84–89 (link construction), 96–104 (persistence)
  - `app/components/ui/CompareRow.tsx` — `isAttributedHotelProviderUrl` 35–80, occupancy rejection 55–66, handoff click 111–139
  - `app/components/__tests__/CompareRow.test.ts` — 8–14, 16–25
  - `app/deals/[dealId]/page.tsx` — section 4 `413–425`, state derivation 296–309, analytics mount 453–460
  - `app/components/HotelDecisionAnalytics.tsx` — whole file (types 6–8, view 47–60, section observer 63–113, handoff click 115–140)
  - `app/api/analytics/route.ts` — allowed props 14–48, required props 55–86, `validPropertyValue` 122–207, `parseBody` 210–246, POST 248–275
  - `app/deals/DealFeed.tsx` — 1370–1381
  - `app/components/HotelSearchCriteria.tsx` — 43
  - `lib/hotels/searchCriteria.ts` — occupancy type 11–13, construction 120 & 182, param rejection 142 & 160–168
  - `app/components/HotelCard.tsx` — 747–748, 763, 1029, 1059
- Reference patterns compared at the interaction level (not visual style): Booking.com property room table; Google Hotels room/rate list.

---

## Research Question

At the single provider boundary on a hotel deal detail, can expaify tell the shopper **what room the displayed price and Deal Score refer to**, and can it carry enough of that framing across the handoff that the shopper does not re-derive room type, occupancy, bed configuration, and inclusions from zero — given a provider layer that returns a property-level "from" price?

---

## Verdict (read this first)

**No room-level field is obtainable for the MVP. Zero. The populated case is not buildable in this cycle, and UXDES must specify the unpopulated case as the shippable deliverable.** Discovery constraint 2 anticipated this; the audit confirms it and narrows it further than discovery did.

Three findings change the shape of what UXDES can specify, and two of them contradict assumptions carried in the discovery report:

1. **The handoff is not merely unscoped to a room — it is not scoped to a property.** The only outbound hotel link that reaches production is a Trip.com **name-based hotel search** (`lib/pipeline/otaLinks.ts:26-28`), not a property page. The shopper does not land on "the provider's room list"; they land on a provider *search results page* and must first re-find the hotel. Room-choice clarity is the second problem they hit, not the first.
2. **Adding party context to the outbound URL is currently forbidden by a tested invariant.** `isAttributedHotelProviderUrl` (`CompareRow.tsx:55-66`) **rejects** any handoff URL containing `adults` / `rooms` / `children` / `child_ages` / `room_qty`, including nested inside the `u=` redirect, and `CompareRow.test.ts:8-14` locks that behaviour in. Discovery Signal D reads this code as *detecting whether occupancy survived*; it is the opposite — it is a guard that **suppresses the link entirely** if occupancy params are present. The discovery success statement's "cross to the provider carrying their stay and party context in the link" is therefore **in direct conflict with the current code contract for party context** (see §4.3 — this is the one item UXDES must not naively spec).
3. **Every hotel decision event on this surface is currently rejected by the analytics sink with HTTP 400, silently.** Not just `room_state` — the whole `HotelDecisionAnalytics` event family never reaches Postgres (see §5.1). Discovery Signal F assumed handoff drop-off was "partially derivable today." It is not derivable at all. The measurement baseline the success criteria depend on does not exist and must be created by this feature.

What *is* buildable, and what this brief specifies: an honest **price-scope frame** at the existing boundary that states what the price does and does not refer to, a handoff that carries the stay context it is permitted to carry, a `room_state` vocabulary that stops being a constant, and an event set that makes returns and repeat views measurable.

---

## Deliverable 1 — What Room-Level Fields Are Obtainable For The MVP

**Answer: none.** Evidence, source by source.

### 1.1 The provider payload has no room dimension

`HotelLookCacheEntry` (`lib/providers/hotellook.ts:22-39`) is the complete shape the adapter parses:

```
hotelId, hotelName, stars, location{name,geo,lat,lon}, address,
distance, priceFrom, propertyType, amenityEvidence, smokingPolicy
```

There is no room id, room name, occupancy, bed configuration, room count, rate id, or inclusion field. `priceFrom` (`412-424`) is a property lead-in rate: the adapter converts it to `pricePerNight` with `priceBasis: 'per_night_before_taxes_fees'`. `cache.json` is a price-aggregator index, not a rate-shopping endpoint — it has no room concept to normalize *from*, so this is not a mapping gap that a DEV ticket can close.

### 1.2 The provider interface cannot even ask for a room

`HotelProvider.searchHotels(area, { checkin, checkout }, context?)` (`lib/types.ts:532-541`) takes no occupancy, room count, or child-age argument, and returns `HotelSearchPage` (`501-506`) = `{ offers: HotelOffer[], coverage, nextPageToken?, exactTotal? }` — a list of **properties**. `checkDocumentReadiness` (`hotellook.ts:554-561`) is explicitly documented as having "no rate/stay-scoped document fields or detail endpoint." There is no second call that could return rooms.

### 1.3 The deeplink is property-scoped; the production handoff is not even that

Two distinct outbound paths exist and they are **not** the same link:

| Path | Built at | URL | Carries |
|---|---|---|---|
| `HotelOffer.deeplink` (live search) | `hotellook.ts:434-436` | `tp.media/r?marker=…&u=https://hotellook.com/hotels/{hotelId}` | property id only — **no dates, no occupancy** |
| `deal.ota_links` (saved deals → detail section 4) | `otaLinks.ts:26-28` via `dealDetection.ts:84-89` | `tp.media/r?marker=…&u=https://www.trip.com/hotels/?hotelName={name city}&checkIn={d}&checkOut={d}` | **hotel name string + dates** — no property id |

The detail page's section 4 renders `deal.ota_links` (`app/deals/[dealId]/page.tsx:423`), so **the production handoff is the second row**: a name-keyed Trip.com search. `expedia`, `booking`, and `kiwi` are hardcoded `undefined` (`otaLinks.ts:22-24`) because only one Travelpayouts marker is approved, so `trip` is the only link a shopper can ever click. Dates *do* survive the boundary; identity survives only as a search string.

This is worth restating because it re-frames the discovery's user model: the price-anchored shopper does not fail to match a room row — they fail to match a *hotel* first, then a room.

### 1.4 The room scope exists in the contract and is unreachable

Confirmed as discovery stated: `HotelEvidenceScope` includes `'room'` (`lib/types.ts:126-130`); `SupplierSmokingStatement.roomId` exists (`366`); `smokingPolicy.ts:122,205` requires `roomId` **and** `rateId` before a statement may be treated as room-bound; `booking/config.ts:764` allow-lists `roomId`/`rateId` as handoff params. No producer exists anywhere. Every evidence item rendered today is property-scoped. **UXDES must not design any UI that depends on `scope: 'room'` resolving** — it cannot resolve, and a spec that assumes it will produce dead states.

### 1.5 Forward contract — the trigger condition, not this cycle's work

Room data becomes obtainable only when a rate-shopping provider lands (Duffel Stays, Amadeus Hotel Search, or a Booking-style adapter). `guest-room-fit/02-research.md` and `room-rate-clarity/03-design.md` reached the same conclusion independently and both named it a DEV/provider-integration blocker. Three pipelines converging on the same blocker is the signal: **stop specifying populated room UI until the provider exists.** UXDES should state the trigger condition and design nothing behind it.

**Consequence for the design spec:** the *only* room-choice fact expaify can state truthfully today is discovery's ranked item 1 — *what the shown price refers to*. Items 2–5 (occupancy, bed configuration, room type, inclusions) are unavailable and are already owned by `guest-room-fit` and `room-rate-clarity` as disclosure states. **This ticket must not re-spec them** (§4).

---

## Deliverable 2 — Reference Teardown: Booking.com And Google Hotels

Compared at the level of *interaction pattern*: how each reference binds a price to a room, and how the property "from" price is reconciled with the chosen room's price.

### 2.1 Booking.com — the room table as the reconciliation device

Interaction sequence: search result shows a property "from" price → property page → a **room table** where each row is a bookable unit, and the table is the point where "from" resolves.

Row anatomy, in the order the eye is meant to consume it:
1. **Room type name** (the bridge label — "Standard Double Room")
2. **Occupancy** as a discrete, non-prose signal (person glyphs / "max N guests") — the eliminator
3. **Bed configuration** as literal text ("1 large double bed", "2 twin beds")
4. **Rate-plan rows nested under the room** — each with its own price, refundability, and meal plan. One room, N rates.
5. **Price for that row**, plus quantity selector and a running "Reserve" total.

**How the "from" price reconciles:** the property-level price is explicitly and consistently the **lowest row in this table for the searched dates and party**. The reconciliation is structural, not editorial — the user sees the cheapest row and it matches the number that brought them in, and if it does not, a stale-price notice explains it. Critically, Booking's search *already captured* the party (dates + guests + rooms), so the from-price is computed against the shopper's own constraints. The property price is never unbound.

**Delta vs. expaify:** expaify's `priceFrom` is bound to no room, and to a party we never captured. We cannot show the table, and we cannot promise the from-price is the cheapest row *for this shopper's party* — because we do not know the party and did not filter on it. The honest analogue of Booking's reconciliation is not a room row; it is an explicit statement that the number is unbound and where it resolves. Booking never needs that statement because its data is dense; expaify's obligation is precisely the disclosure Booking never has to make.

### 2.2 Google Hotels — the rate list and the "prices are per night" contract

Interaction sequence: guest count captured at search → result cards show a per-night price with an explicit basis → property panel shows a **rate list keyed by booking source**, each row a provider + price + a small set of rate attributes, and a room-options list where the underlying provider supplies it.

Two patterns matter here:
1. **Price basis is stated everywhere, unprompted.** Google is relentless about "per night", taxes/fees inclusion state, and the date range the price applies to. The basis travels with the number at every altitude.
2. **The rate row is a handoff, and it is labelled as one.** Clicking goes to the provider; Google's row is explicitly a *pointer to* the provider's offer, not a booking. Where room detail is thin, Google shows fewer attributes rather than inventing them.

**How the "from" price reconciles:** by *scope labelling* rather than by a table. The card price is stated as the lowest per-night rate across sources for the searched dates/party, and the panel enumerates the sources so the user can see which source that number came from.

**Delta vs. expaify:** expaify already has the honest half of this — `priceBasis: 'per_night_before_taxes_fees'` and the "per night before taxes and fees" line on the detail (`page.tsx:377`). What it lacks is the *room* half of the scope label: the number is per-night **and** unbound to a room, and only the first half is said out loud.

### 2.3 Shared takeaway for UXDES

Both references bind price to a room **before** the user commits attention, and both make the binding visible. expaify cannot bind. Therefore the transferable pattern is not the room table or the rate list — it is the **price-scope contract** both references honour: *the number on screen always states what it covers.* expaify's version of that contract, stated in full, is the deliverable:

> per night · before taxes and fees · lowest rate at this property · **not tied to any specific room** · room chosen at the provider.

Four of those five clauses already exist somewhere in the product. The fifth is missing, and it is the whole ticket.

---

## Deliverable 3 — Overlap Resolution (binding for UXDES)

Four pipelines touch this surface. The lines below are drawn so UXDES inherits exactly one non-conflicting surface.

| Neighbour | Owns | This ticket owns | The line |
|---|---|---|---|
| `room-rate-clarity` (03-design shipped) | Refundability, cancellation deadline, meal plan, **and the "Room & bed" disclosure row** (`03-design.md §2.3`: `dt` "Room & bed", not-returned copy `Room type not provided by this provider`) | The **price↔room binding statement**, not the room attribute rows | **UXDES must not add a room-type or bed row.** That row already has final copy and a home (`HotelCard` expanded panel, after `QualityEvidencePanel`). This ticket adds a *scope* statement about the price, in section 4 of the detail page. Different fact, different surface, no duplicate string. |
| `guest-room-fit` (02-research) | `max_occupancy`, `bed_config`, `child_policy` as evidence objects; the **decision not to build a party intake** (Deliverable 4); the from-price disclosure **on the card** (`Directive 3`) | The from-price disclosure **at the handoff boundary on the detail page** | Occupancy is an *input* here, never captured, and this ticket degrades honestly without it. **UXDES must not spec a guest/room picker** — that decision is already made and it is "no." Reuse `guest-room-fit`'s from-price semantics verbatim; do not mint a competing sentence. |
| `hotel-detail-decision-order` (03-design shipped) | Section order 1–5, the **single** provider-confirmation boundary (§4), terminology guardrails, DOM/reading order | Content *inside* section 4's existing bordered unit | **No second boundary, no reordering, no restating the boundary copy.** §4 requires "explanatory copy and action(s) in one bordered unit with no intervening content" — the room-scope statement goes inside that unit, above the actions. Banned vocabulary carries over verbatim: never `Available`, `Rooms available`, `Book`, `Reserve`, `Selected room`, `Your room`, `Final price`, `Total`. |
| `hotel-price-freshness` / `deal-score-*` | Price recency and score confidence | — | Untouched. The scope statement says *what* the price covers, never *how fresh* or *how good* it is. |

**One de-duplication instruction.** `providerConfirmationCopy` (`HotelCard.tsx:747`) says the provider confirms "room availability"; the detail page's variant (`page.tsx:368`) says "the provider confirms room-level details." `room-rate-clarity/03-design.md` already commits to consolidating these three sentences into one shared constant. UXDES **must consume that constant, not fork it** — and must ensure the new scope statement is additive (what the price refers to) rather than a fourth restatement of "the provider confirms things."

---

## Deliverable 4 — The Handoff URL: What May And May Not Cross The Boundary

This is where the discovery's success statement collides with the code contract, so the resolution is stated explicitly.

### 4.1 Stay context — already crosses, keep it

`checkIn` / `checkOut` are in the Trip.com URL (`otaLinks.ts:27`). `isAttributedHotelProviderUrl` does not object to date params. Dates crossing the boundary is existing, correct behaviour and needs no change.

### 4.2 Party context — must NOT be added

`isAttributedHotelProviderUrl` returns `false` for any URL, or nested `u=` URL, containing `adults`, `adult`, `rooms`, `room_qty`, `children`, `childages`, `child_ages` (`CompareRow.tsx:55-66`), and the link is then not rendered at all (`111`). `CompareRow.test.ts:8-14` — *"rejects %s links that expose hidden occupancy defaults"* — and `otaLinks.ts:20-21` — *"never … pretending the snapshot's hidden occupancy default was traveler intent"* — establish the rationale: a party we never captured must not be smuggled into the provider's filter as if the traveler chose it. That is the same data-integrity principle as discovery constraint 1, applied to the URL.

**Resolution:** the discovery success statement's "carrying their stay and party context in the link" is satisfiable **only for stay context** in this cycle. UXDES must spec the party half as **conditional and unimplemented**: party params may be added to the outbound URL *only* when `HotelSearchCriteria.occupancy.state === 'applied'` — a state that `lib/hotels/searchCriteria.ts:120,182` never constructs and `resolveHotelSearchCriteria` (`160-168`) actively rejects from the URL. That state is `guest-room-fit`'s to deliver. Until it does, the validator stays exactly as written and no party params are emitted. **A directive that says "scope the handoff URL with party context" without this condition would break the only working hotel handoff in the product** — the link would stop rendering.

### 4.3 Property identity — the real handoff defect, flagged not fixed

The production handoff resolves the hotel by name string, not id (`otaLinks.ts:27`), while the live-search deeplink has a real property id (`hotellook.ts:434-436`). A name-keyed provider search can land on the wrong property, a disambiguation page, or nothing. This degrades the room-choice problem into a property-identification problem and is worth a ticket of its own; it is **out of scope here** (link construction is DEV/provider work, not this UXR's surface). UXDES should note it as a known limitation that the boundary copy must not paper over — specifically, copy must not promise the user will "see this hotel's rooms," because the link cannot guarantee arrival at this hotel.

---

## Deliverable 5 — Analytics Correction

### 5.1 First: the hotel decision event family is 100% rejected today

`HotelDecisionAnalytics` fires four events; `app/api/analytics/route.ts` rejects all four with `400` before any DB write (`parseBody` returns `null` → `POST` 400, `route.ts:243, 254`). `track()` sends via `sendBeacon` with no error handling (`lib/analytics.ts:37-43`), so the failure is silent. Four independent value-vocabulary mismatches:

| Event | Property | Client sends | Sink accepts | Result |
|---|---|---|---|---|
| `hotel_detail_viewed` | `entry_source` | `'saved'` (`page.tsx:455`; type `'search'\|'saved'\|'direct'`, `HotelDecisionAnalytics.tsx:6`) | `'search_results'\|'saved_deal'` (`route.ts:177`) | **400** |
| `hotel_detail_viewed` | `viewport_group` | `'mobile'\|'tablet'\|'desktop'` (`HotelDecisionAnalytics.tsx:23-28`) | `'mobile_375'\|'desktop_1280'\|'other'` (`route.ts:182`) | **400** |
| `hotel_detail_viewed` | `score_state` | `'confident'\|'low_confidence'\|…` (`page.tsx:305-309`) | `'loading'\|'confirmed'\|'unavailable'\|'error'` (`route.ts:183`) | **400** |
| `hotel_detail_viewed` | `price_freshness_state` | `'unknown'` reachable (`page.tsx:303`) | `'fresh'\|'aging'\|'stale'\|'expired'\|'unavailable'` (`route.ts:184`) | **400** |
| `hotel_decision_section_reached` | `section` | `'property_stay'` etc. (string, `page.tsx:347`) | `boundedInteger(≤5)` (`route.ts:185`) | **400** |
| `hotel_decision_section_reached` | `position` | `'1'` (string from `getAttribute`, `HotelDecisionAnalytics.tsx:92`) | `boundedInteger(≤5)` — number required (`route.ts:186`) | **400** |
| `hotel_room_handoff_started` | `entry_source` | `'saved'` | as above | **400** |
| `hotel_detail_back_to_results` | `entry_source` | `'saved'` | as above | **400** |

**Correction to discovery Signal F:** handoff drop-off is **not** partially derivable today. `hotel_room_handoff_started` ÷ `hotel_detail_viewed` is 0 ÷ 0. Only `hotel_provider_handoff_clicked` (fired from `CompareRow.tsx:126`, all values legal) actually lands. **This reconciliation is prerequisite work — it must be fixed before any pre-change baseline is captured, or the baseline is empty and the success criteria stay unverifiable.**

### 5.2 What `room_state` should carry

Today `room_state` is assigned the occupancy state verbatim (`DealFeed.tsx:1379`; `HotelSearchCriteria.tsx:43`) or hardcoded (`CompareRow.tsx:131`), and the sink only permits `'applied' | 'not_captured'` (`route.ts:175`) — a two-value vocabulary borrowed from occupancy that cannot describe a room. Replace it with a vocabulary that describes **the room binding of the price the user is acting on**:

| Value | Meaning | Reachable today |
|---|---|---|
| `unbound_from_price` | Price is a property lead-in rate with no room binding; scope statement shown | **Yes — the universal current state** |
| `provider_room_scoped` | Provider returned a room/rate id bound to the displayed price | No (blocked on §1.5) |
| `room_data_unavailable` | Provider was asked for room detail and explicitly returned none | No |
| `unknown` | Binding could not be determined (error/timeout on a room-capable provider) | No |

Rules UXDES must state: `room_state` is derived from the **offer**, never from `criteria.occupancy`; `occupancy_state` remains a separate, unchanged party-capture field owned by `guest-room-fit`; the two must never again be assigned from one expression. Requires a `route.ts` `validPropertyValue` change (DEV) — the new values are rejected by the current allow-list.

Expected outcome at launch: `room_state = 'unbound_from_price'` on ~100% of events. **That is the correct result, not a failure** — it converts a meaningless constant into a meaningful constant with a defined path to varying, and it makes the provider-arrival cutover measurable the day it lands.

### 5.3 Events that make provider returns and repeated detail views measurable

Neither is computable today. Two additions, both reusing patterns already proven in this codebase — the return/away-duration idiom exists at `hotel_handoff_returned` with `awayDurationBucket` (`route.ts:38`) and can be lifted wholesale.

**A. `hotel_provider_return_detected`** — fires on the detail page when the tab regains visibility after an outbound handoff click in the same session.
Props: `deal_id`, `provider`, `away_duration_bucket` (`'<5s' | '5–30s' | '30–120s' | '120s+'` — reuse `route.ts:196` verbatim), `room_state`, `return_index` (bounded integer, 1–10).
Reads: a `<5s` return is a bounce (wrong hotel / could not find it); `30–120s+` is a genuine room-list evaluation. This is the single most diagnostic signal for whether the scope statement worked.

**B. `hotel_detail_repeat_viewed`** — fires on the 2nd and subsequent mount of the same `deal_id` within a session.
Props: `deal_id`, `hotel_id`, `view_index` (bounded integer, 2–10), `since_previous_bucket` (reuse the same four duration buckets), `preceded_by_handoff` (boolean).
Reads: `preceded_by_handoff = true` is the price-anchored shopper coming back to re-read the card — discovery's named failure. This requires a session-scoped counter; `HotelDecisionAnalytics.tsx:57` deliberately fires the view once per mount to avoid double-counting, so the repeat counter must live in `sessionStorage` keyed by `deal_id` (the session id already persists there, `lib/analytics.ts:3`) and must **not** change `hotel_detail_viewed` semantics.

Both need registration in `EVENT_PROPERTIES` + `REQUIRED_PROPERTIES` + `validPropertyValue` (`route.ts:14-48, 55-86, 122-207`). Both are DEV work; UXDES specifies the trigger conditions and the read.

**Success metrics, restated as computable expressions once the above lands:**
1. *Bounce rate* = `hotel_provider_return_detected[away_duration_bucket='<5s']` ÷ `hotel_provider_handoff_clicked`. Target: decreases vs. baseline.
2. *Re-read rate* = `hotel_detail_repeat_viewed[preceded_by_handoff=true]` ÷ `hotel_provider_handoff_clicked`. Target: decreases vs. baseline.
3. *Handoff rate* = `hotel_provider_handoff_clicked` ÷ `hotel_detail_viewed`. Guard, not target: **must not collapse.** A scope statement that scares users off the boundary has over-corrected.
4. *Baseline integrity gate:* all three require ≥2 weeks of post-fix, pre-UI data. §5.1 must ship first.

---

## Design Directives For UXDES (testable)

Five directives. D1–D3 are the unpopulated case (shippable now). D4 is measurement. D5 is the populated case, specified as a contract only.

**D1 — Add one price-scope statement inside the existing section-4 boundary, stating the room binding the price does not have.**
Content contract (UXDES writes final copy): the displayed nightly rate is the lowest rate seen at this property; it is not tied to a specific room; the room is chosen at the provider; taxes and fees are not included. Placement: inside section 4's single bordered unit, above the provider actions, per `hotel-detail-decision-order/03-design.md §4` — no new section, no second boundary.
*Test:* the statement renders on 100% of hotel deal details; it appears in DOM order between the section `<h2>` and the first provider action with no intervening content; the section-4 unit remains one bordered block; no `<h2>` count change on the page; banned vocabulary (`Available`, `Book`, `Reserve`, `Selected room`, `Your room`, `Final price`, `Total`) appears nowhere in the new strings.

**D2 — No room attribute may be displayed, and absence must read as absence, not as a property of the room.**
No room name, occupancy, bed count, room quantity, or inclusion string may render on this surface — the fields do not exist (§1.1–1.4) and the disclosure rows for them belong to `room-rate-clarity` and `guest-room-fit`. Where the scope statement references what is unknown, it must attribute the gap to the provider ("the provider sets the room"), never describe the room ("a basic room", "sleeps 2").
*Test:* grep the delivered spec and implementation for `sleeps`, `bed`, `Standard Room`, `twin`, `double`, `breakfast` as *displayed* strings on the detail surface — zero hits. No component reads `scope: 'room'`. Comprehension task (5–7 participants, ≥85% pass): shown a detail page, *"How many people does this price cover?"* → pass = "can't tell / the provider decides"; fail = any number.

**D3 — The handoff carries stay context only; party context is gated behind a state that does not exist yet.**
Dates continue to cross (`otaLinks.ts:27`). No `adults` / `rooms` / `children` / `child_ages` / `room_qty` param is added to any outbound hotel URL in this cycle. The accessible name on the handoff link gains the price-scope framing without becoming verbose, and must not promise room-level or property-level certainty (§4.3).
*Test:* `isAttributedHotelProviderUrl` and `CompareRow.test.ts` are unchanged and green; every rendered hotel handoff link passes the validator (i.e. links still render — regression guard); the link's accessible name is ≤ its current length ±20%; the spec states the `occupancy.state === 'applied'` precondition explicitly and marks it as owned by `guest-room-fit`.

**D4 — Fix the rejected event family, re-base `room_state` on the offer, and add the two missing events — in that order.**
(a) Reconcile the eight value mismatches in §5.1 so `hotel_detail_viewed`, `hotel_decision_section_reached`, `hotel_room_handoff_started`, and `hotel_detail_back_to_results` are accepted. (b) `room_state` takes the §5.2 vocabulary and is derived from the offer, never from `criteria.occupancy`. (c) Add `hotel_provider_return_detected` and `hotel_detail_repeat_viewed` per §5.3.
*Test:* a unit test posts one representative payload per event to `parseBody` and asserts non-null for all six events — this is the regression that would have caught the current defect; `room_state` and `occupancy_state` are assigned from different expressions in `DealFeed.tsx`, `HotelSearchCriteria.tsx`, and `CompareRow.tsx`; `room_state` on a current-provider offer is `'unbound_from_price'`, never `'not_captured'`; the two new events are registered in all three sink tables.

**D5 — Specify the populated case as an unimplemented contract, and build none of it.**
Define what changes when a room-capable provider lands: `room_state` moves to `'provider_room_scoped'`; the scope statement is replaced (not supplemented) by a room-bound statement; `roomId`/`rateId` flow through the already-allow-listed handoff params (`booking/config.ts:764`); `scope: 'room'` becomes reachable. Name the trigger condition (a provider returning per-room rates) and state that no UI behind it is designed in this cycle.
*Test:* the spec contains no populated-state Tailwind classes, no room-row layout, and no copy for a room the provider has not returned; every populated-case state is explicitly labelled unreachable with its unblocking condition; a reader can tell from the spec alone which states ship now (one) and which do not.

---

## Non-Negotiables Carried Forward

- All room data, if it ever arrives, flows through `lib/providers` and is normalized there. Components never parse vendor payloads.
- Money stays `{ priceCents, currency }`; adapters return `Result<T>`; secrets from env; `rel="noopener noreferrer sponsored"` and the affiliate marker on every outbound link are untouched.
- No invented room attributes. Absence renders as provider-attributed absence, never as a plausible default and never as a silent omission.
- One provider-confirmation boundary on the detail page. This ticket adds content inside it and adds no second one.
- Room-choice framing never feeds, adjusts, or visually merges with Deal Score, and never borrows `DealBadge` / `ScoreChip` / `QualityEvidencePanel` tokens.
- 375px and 1280px both usable; existing tokens in `app/globals.css` only; keyboard-reachable; no added overlap or clutter.

---

## Out-Of-Scope Findings (flag, do not fix here)

1. **The production hotel handoff is name-keyed, not id-keyed** (`otaLinks.ts:27` vs. the id-bearing `hotellook.ts:434-436`). The shopper may not land on the correct property at all. Merits its own ticket; it is the layer beneath this problem.
2. **Only `trip` is a live outbound provider.** `expedia`/`booking`/`kiwi` are hardcoded `undefined` (`otaLinks.ts:22-24`), so `CompareRow`'s four-provider grid renders three dead "no attributed link" tiles in the compact variant. Product/BD question (marker approval), not a design fix.
3. **The analytics sink has no contract test binding client vocabularies to `validPropertyValue`.** The eight mismatches in §5.1 are the symptom; the absent test is the cause. Worth a standing QA ticket beyond this feature's fix.
4. **`hotellook` returns empty in practice** (dead API per the file map), so the live-search path is moot today; the saved-deal path in `dealDetection.ts` is what users actually see. This is already tracked elsewhere; noted because it means §1's "no room data" conclusion is not merely a mapping gap — there is currently no live hotel feed at all.
5. **`HotelSearchCriteriaV1.occupancy.state === 'applied'`** is declared (`searchCriteria.ts:13`) and unconstructable. Dead branch until `guest-room-fit` ships; flagged there, not here.

---

## Blockers

None blocking this stage. Two constraints are recorded for the record:

- **The populated case cannot be designed responsibly in this cycle** (§1). UXDES is directed to the unpopulated case, which discovery constraint 2 already sanctioned as a complete outcome.
- **The discovery success statement's party-context clause conflicts with a tested code invariant** (§4.2). Resolved above by scoping it to stay context and gating party context behind `guest-room-fit`. UXDES must adopt that resolution rather than the literal discovery wording.

---

## Handoff

Next stage: **UXDES-HOTEL-ROOM-CHOICE-CLARITY-01** (UX Design, Claude Fable 5).

Create via:

```
curl -s -X POST http://localhost:3001/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"id":"UXDES-HOTEL-ROOM-CHOICE-CLARITY-01","title":"UX Design: room choice clarity","priority":"P1","role":"design","status":"backlog","description":"Research: docs/pipeline/hotel-room-choice-clarity/02-research.md. Design the UNPOPULATED case only — no room-level field is obtainable for the MVP (Hotellook cache.json has no room dimension; HotelProvider cannot request one). Deliver: (D1) one price-scope statement inside the EXISTING section-4 boundary on app/deals/[dealId]/page.tsx stating the rate is a property lowest rate not tied to a specific room, room chosen at provider — no second boundary, no reordering; (D2) no room attribute displayed anywhere, absence attributed to the provider, room-type/bed rows stay owned by room-rate-clarity; (D3) handoff carries stay context only — party params stay forbidden by CompareRow.isAttributedHotelProviderUrl until guest-room-fit lands occupancy.state=applied; (D4) analytics: fix the eight value mismatches that currently 400 every hotel decision event, re-base room_state on the offer with vocabulary unbound_from_price|provider_room_scoped|room_data_unavailable|unknown, add hotel_provider_return_detected and hotel_detail_repeat_viewed; (D5) specify the populated case as an unimplemented contract only. Every state, final copy, 375px and 1280px, focus/keyboard, no placeholders."}'
```
