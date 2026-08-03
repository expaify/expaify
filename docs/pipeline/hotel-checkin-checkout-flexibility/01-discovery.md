# UXD-HOTEL-CHECKIN-CHECKOUT-FLEXIBILITY-01 — Check-In / Check-Out Flexibility Discovery

**Date:** 2026-08-03 · **Stage:** UX Discovery · **Priority:** P2
**Feature slug:** `hotel-checkin-checkout-flexibility`
**Downstream ticket:** `UXR-HOTEL-CHECKIN-CHECKOUT-FLEXIBILITY-01`

---

## 1. Problem statement

A traveler whose arrival lands hours before standard room access, or whose departure is hours after the room must be vacated, cannot tell before booking **whether the property offers an early check-in or late check-out at all, whether it is free, paid, or request-only, and what it would cost** — so they either book a stay whose usable hours do not match their trip, or pay for a night they did not intend to buy, and only discover which at the desk.

This is a **flexibility** problem, not a standard-times problem. The traveler in scope has already accepted that standard access is (say) 3:00 PM; their question is whether the property sells, grants, or refuses movement around that boundary, and on what terms.

## 2. Scope boundary — read before proceeding

Two adjacent features already exist in this pipeline. Neither has shipped to production. This ticket must not re-open or duplicate either.

| Slug | Owns | Furthest stage reached |
|---|---|---|
| `hotel-checkin-logistics` | The provider-neutral **evidence model** for published standard times, desk access, late-arrival instructions, checkout deadline | `02-research.md` (design not started) |
| `hotel-checkin-time-fit` | **Fit interpretation** — does the traveler's stated scenario fit the published standard times | `03-design.md`, gated as research prototype only (`app/components/research/HotelCheckinTimeFitPrototype.tsx`) |
| **this ticket** | The **exception layer** — whether a documented early/late option exists, its price, and its conditionality | discovery (here) |

Three-way division, stated as questions the traveler asks:

1. `hotel-checkin-logistics`: *What times has the property published?*
2. `hotel-checkin-time-fit`: *Does my schedule fit those times?*
3. **this ticket**: *If it does not fit, can I buy or request my way out of it, and at what cost?*

**This ticket is strictly downstream of (1).** An exception is only meaningful relative to a published standard boundary. If `hotel-checkin-logistics` does not deliver `arrivalFrom` / `departureBy` evidence, there is no baseline to price an exception against, and this feature cannot render a factual claim. Do not define a second hotel-time evidence model, and do not copy `arrivalFrom`, `departureBy`, desk access, or freshness fields into a new flexibility type.

**Explicitly out of scope:** luggage storage before check-in and after check-out (the most common real substitute for early/late access — a separate ticket), day-use / day-rate room products, adding an extra paid night, cancellation and no-show policy (`docs/pipeline/hotel-cancellation-clarity/`), deposits and holds (`HotelFundsPolicyPanel`), loyalty-tier late check-out benefits (`HotelLoyaltyEligibility.tsx` — that surface already owns tier benefit language), booking modification (`docs/pipeline/hotel-booking-modification/`), and post-booking request submission.

## 3. Who is affected, and where in the flow

Ranked by cost of getting it wrong:

1. **Long-layover and same-day-transit guests** booking a night around a connection. The whole value of the booking *is* the hours. A 6:00 AM arrival against 3:00 PM standard access means the stay delivers roughly half of what was assumed. Highest stakes, smallest segment.
2. **Red-eye / early-morning arrivals** (land 05:00–11:00). High frequency. They will wait, store bags, or pay — they need to know which is possible *before* choosing between two similarly priced hotels.
3. **Late-flight departures** (flight after ~18:00 on the last day, standard check-out ~11:00). Seven-plus dead hours. Late check-out is the single fact that decides between two properties, and it is the one most often sold as a paid add-on.
4. **Everyone else**, for whom this is a low-salience confirmation fact that must not displace price, Deal Score, or location.

Segments 1–3 are the measurement population. They are identifiable from search shape (short stays, one-night stays adjacent to a flight search) but **not** from any field expaify stores today — see §4.

**Where:** the ticket names the deal-detail property-info section, ahead of booking confirmation. Verified surfaces:

| Surface | File | State today |
|---|---|---|
| Saved-deal detail | `app/deals/[dealId]/page.tsx:371–478` | Five sections in the shipped decision order (`property_stay`, `price_deal_score`, `hotel_fit`, `provider_handoff`, `supporting_evidence`). No time content of any kind. |
| Hotel card expanded details | `app/components/HotelCard.tsx` | Score, quality, location, pet, smoking, access, price scope, funds policy. No time content. |
| Booking handoff | `app/book/BookingFlow.tsx:1281–1311` | A **Special requests** block that names early check-in in prose ("Need a quiet room, high floor, preferred bed setup, or early check-in?"), correctly states expaify neither selects nor sends the request, and correctly distinguishes selected / sent / acknowledged / guaranteed. It states no property fact, no availability, and no price. |

The booking-handoff block is the only place in the product where early check-in is mentioned at all, and it arrives **after** the decision — and it is a capability disclaimer, not information. It is also the correct model to inherit from: whatever this feature ships must not imply expaify can obtain the exception.

**The active trap:** `app/deals/[dealId]/page.tsx:378` renders a `<dt>` labelled **"Check-in"** whose value is a calendar date (`deal.check_in_date`, e.g. "Mar 12"), with the empty state "Check-in not provided". A traveler scanning for check-in information finds a field with that exact label, already answered, and stops looking. `deals.check_in_window` (`lib/db/schema.sql:135`) compounds it — despite the name, it is a **date-range string**, not a time-of-day window. `hotel-checkin-logistics` §D3 already owns the rename. This ticket must not ship a competing rename, and must not introduce any field or string reusing `check_in_window` / `checkInWindow`.

## 4. Measurable signal — and the honest state of the ticket's three questions

The ticket asks discovery to identify (a) which flexibility signals are reliably available, (b) how often they vary from the 3pm/11am default, and (c) which segments are most affected. Source-verified answers:

### (a) Which signals are reliably available: **none, today.**

The ticket's constraint says to "use existing provider fields for standard times and any flexible/early/late options rather than inventing new data sources." **That premise does not hold against the code.** There are no such fields mapped, at any layer:

- **`HotelOffer` (`lib/types.ts:751–778`)** carries id, name, area, location, stars, price, rating, photo, deeplink, source, document readiness, class/guest-rating evidence, amenity, access, transport, funds policy, smoking, rate eligibility, admission policy, and required-charge evidence. **No time field. No exception field.**
- **Hotelbeds (`lib/providers/hotelbeds.ts`)** — the parsed response shape is `code, name, categoryCode, destinationName, zoneName, latitude, longitude, rooms[].rates[].{net, rateClass}` (lines 27–51). `checkIn`/`checkOut` at line 211 are the **stay date range sent in the request**, not property times returned. The Content API is called with `fields=images` only (line 165); any content-side policy field is unrequested, so its coverage is not merely low — it is unobserved.
- **Hotellook (`lib/providers/hotellook.ts:23–42`)** — cache entry is `hotelName, stars, location, address, distance, priceFrom, propertyType`. `checkIn`/`checkOut` at lines 477–478 are again request query params. This provider is documented as a dead API returning empty.
- **UI** — zero rendered instances across `app/`. The only "early check-in" string in the product is the disclaimer prose at `BookingFlow.tsx:1290`.

So the reliable-availability answer is: **coverage is 0%, and the gap is a supply gap first, a presentation gap second.** UXR's job is not to pick from available fields; it is to determine, by probe, whether any field can be made available.

### (b) How often times vary from the 3pm/11am default: **unmeasurable today, and this is the highest-value thing UXR can change.**

expaify has never stored a property time, so the variance distribution cannot be computed from anything in this repo. It must be measured before design commits, because the answer determines whether the feature is worth building:

- If standard times are near-universally 3pm/11am and exceptions are near-universally undocumented, the only honest UI is a static, low-prominence unavailable state — and this ticket should be deferred behind `hotel-checkin-logistics`.
- If exceptions are documented with terms for a meaningful share of properties, a real evidence panel is justified.

**Concrete probe UXR must run** (read-only, no production code path): request the Hotelbeds Content API for the golden-route hotel set with the policy/description field group enabled instead of `fields=images`, and record per property: (1) is a standard check-in time returned, (2) is a standard check-out time returned, (3) is any early-check-in or late-check-out statement returned, (4) if so, is it free / paid-with-amount / paid-amount-unknown / on-request / explicitly refused. Report the four counts and the share differing from 3pm/11am. If the field group is unavailable on the test credential, that is itself the finding, and it must be reported as a blocker rather than filled with an assumption.

### (c) Segments most affected: **identifiable in principle, not queryable today.**

`HotelDecisionAnalytics.tsx` emits `hotel_detail_viewed` and `hotel_decision_section_reached` keyed on `data-hotel-decision-section`, plus handoff events. There is no arrival-time or departure-time intent anywhere in search, results, or booking context — `hotel-checkin-time-fit` §Gate A closed that door explicitly, and this ticket inherits the closure: **stay dates, flight times, and device time are not substitutes for stated intent.** Consequently the ticket's proposed signal — "correlation with booking abandonment on red-eye or early-arrival search patterns" — **cannot be computed**, and downstream stages must not claim it can. The nearest honest proxies, which UXR should size: one-night stays, and hotel searches in a session that also contains a flight search with an arrival before 11:00 or a departure after 18:00. Both are inferences about intent, not intent; neither may be used to state a fact on screen.

## 5. Constraints the solution must respect

1. **No inferred exception, ever — and no inferred price.** 3pm/11am must never be printed as a default, and "early check-in may be available" must never be printed as a hedge where the property said nothing. Silence from a provider means *unknown*, and unknown is a designed state with its own copy, not a hidden row. Because coverage is 0% (§4a), **unknown is the default rendering path and must be the first state designed.** Reuse an existing evidence vocabulary — `HotelRequiredChargeEvidence`'s `itemized | applies_amount_unknown | explicit_none | not_returned | conflicting` states are the closest existing analogue for "an option exists, with or without a known amount" — rather than inventing a sixth one.
2. **Money and capability integrity.** Any exception fee is `{ priceCents, currency }`, never a float or a bare number, and it is a **charge collected by the property outside the booked rate** — it must never be added into a stay total, a per-night price, or a Deal Score input, and must never be confused with the mandatory-charge model that already feeds total price. expaify does not select, send, acknowledge, or guarantee an exception; inherit that four-state vocabulary verbatim from `BookingFlow.tsx:1303–1308`. A request-only option never renders as a secured one.
3. **Subordinate placement, mobile-first density.** This is a confirmation fact for the majority. It belongs inside the existing `hotel_fit` section on the deal detail page and the expanded card details panel — it must not add a top-level section, must not displace decision-order positions 1–5, and must not add a collapsed-card chip. Usable at 375px and 1280px, no overlapping text, existing `app/globals.css` tokens only, no new colours or font sizes.

## 6. Success statement

**This is solved when a first-time user with a 6:00 AM arrival can determine, before leaving expaify, whether the property has documented an early check-in option and on what terms — or can see plainly that the property has not told us — without mistaking the "Check-in" calendar date for a time, and with no exception, availability, or fee appearing on screen that a provider did not supply.**

**Verifiable at TEST:**
- The unknown state renders in full, in the correct subordinate position, at 375px and 1280px, on both the deal-detail `hotel_fit` section and the expanded card panel.
- No 3pm, 11am, star-class-derived, or "may be available" claim exists anywhere in the delivered code.
- No exception fee reaches a stay total, a nightly price, a Deal Score input, or a required-charge evidence object.
- Request-only and secured options are visually and semantically distinct, and expaify claims neither.
- Decision-order sections 1–5 are not displaced; no regression on hotel card, deal detail, or booking handoff.

## 7. Open questions for UXR

1. The probe in §4b — does any live provider return an early/late exception statement with terms? This gates everything below.
2. Reference teardown: how do Booking.com ("House rules" → check-in/check-out with paid-exception lines) and Google Hotels present a *paid* exception versus an *on-request* one, at the interaction level? Specifically, do they surface it at comparison time or only at property detail?
3. Is the exception layer coherent as a separate panel, or must it render as two extra rows inside the `hotel-checkin-logistics` panel? Discovery's hypothesis: **two rows inside that panel**, because an exception without its baseline is uninterpretable. If UXR agrees, say so plainly and hand `UXDES` a row spec, not a component spec.
4. If §4b shows near-zero documented exceptions, recommend explicitly whether to **defer** this feature behind `hotel-checkin-logistics` rather than ship an all-unknown panel. Recommending deferral is a valid, expected outcome of this research.

## 8. Conflict to report

The ticket's constraint — "use existing provider fields for standard times and any flexible/early/late options" — assumes fields that do not exist in this codebase at any layer (§4a). Discovery has **not** guessed a data source to satisfy it. The constraint is reinterpreted for downstream stages as: *do not introduce a new vendor or scraping source; determine by probe whether the already-integrated providers can supply these fields, and if they cannot, ship the honest unavailable state and say so.* Any downstream stage that populates a real time or fee from a fixture in a production code path violates this and must fail TEST. Research fixtures live under `app/components/research/` and must be unreachable from production imports.
