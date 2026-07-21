# UXD-HOTEL-ACCESS-REQUIREMENTS-01: Hotel Access Requirement Clarity Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist
Priority: P1
Feature slug: `hotel-access-requirements`

## User Pain Point

A traveler cannot tell from an expaify hotel result whether the practical access facts that decide if they can physically reach and occupy the room they are picturing — is there an elevator, is the route from door to room continuous without steps, can they park on site, and is a room preference (ground floor, high floor, near elevator, connecting) a guaranteed booking attribute or just a non-binding request — are confirmed, undocumented, or merely *requestable*, so a traveler with luggage, a stroller, a temporary injury, or a car books a rate that turns out to be a fourth-floor walk-up, a split-level with steps to the elevator, a street-parking-only property, or an "on request, not guaranteed" room they never actually get.

## Who Is Affected And Where

The affected population is **not primarily travelers with permanent disabilities** — that audience is owned by the accessible-stay-fit work (see boundary below). This ticket is about **practical physical-access logistics that any traveler depends on to reach and use the room as expected**:

- Travelers carrying heavy or multiple bags, or a car seat / stroller.
- Older travelers, pregnant travelers, and travelers with a temporary injury (crutches, cast, recent surgery) who are not "disabled" in the filter sense but still cannot manage stairs.
- Families needing connecting or adjacent rooms, and drivers who need somewhere to leave the car.
- Anyone who forms a mental picture ("I'll take the elevator to my quiet high-floor room and park in the garage") that the property silently cannot honor.

Across the current hotel decision path — all four surfaces carry **zero** of these signals today:

- **Search / filter** — `app/page.tsx:345` describes filtering only "by discount, stars, price." There is no access-requirement filter or toggle (elevator, on-site parking) anywhere.
- **Deal card scan** — the collapsed `HotelCard` (`app/components/HotelCard.tsx:425`–`520`) shows photo, name, hotel-class/guest-rating chips, location, nightly price, Deal Score, and CTAs. No elevator, route, parking, or room-request signal.
- **Deal detail** — the expanded card (`app/components/HotelCard.tsx:523`–`582`) exposes Deal Score, quality evidence, location, and price-scope panels. There is no access/logistics panel and no place where "room request is not guaranteed" is stated.
- **Booking handoff** — the "Review hotel" CTA (`buildHotelBookingHref`) hands off to the provider carrying no access context and no statement of which preferences are binding.

What the current code actually establishes (verified, not assumed):

- `HotelOffer` (`lib/types.ts:137`–`151`) carries identity, `area`/`location`, `stars`, `pricePerNight`, `rating`, `photoUrl`, `deeplink`, `source`, `hotelClass`, and `guestRating`. **There is no field for elevator presence, floor/vertical circulation, route continuity, parking, or room-request bindingness.** `HotelLocation` (`lib/types.ts:127`–`135`) models address, precision, and distance-to-reference — location-in-the-city, not access-within-the-property.
- A repo-wide search for `elevator|walk-up|step-free|stairs|room request|on-site parking|floor` across `lib/` and `app/` returns **zero** product-code matches (only unrelated `Math.floor` arithmetic). No provider adapter maps any facility or access field; `hotellook.ts` normalizes only price, location, hotel class, and guest rating.

So today 100% of these access-logistics decisions happen off-platform, after the traveler has already committed effort to an expaify result — and the highest-stakes ones (elevator, room request) are frequently *non-binding even on the provider site*, which the traveler has no way to learn until check-in.

## The Distinct Problem: Requirement Certainty, Not Feature Presence

The core problem this ticket isolates is **the gap between what a traveler assumes is guaranteed about the physical journey to their room and what is actually a non-binding request or an undocumented logistical fact.** Three failure modes make this distinct from any amenity or accessibility work already scoped:

1. **Vertical and horizontal continuity, not a single boolean.** A "step-free entrance" chip does not tell a traveler that the elevator bank is up a half-flight, that the annex wing has three steps, or that a "lift" serves only floors 2–5. The decision-relevant fact is **continuity of the whole route from car/entrance → lobby → vertical circulation → room**, plus the binary that decides everything for a walk-up property: *is there an elevator at all?* Budget and boutique/heritage properties frequently have none, and this is rarely surfaced anywhere.

2. **Requestable ≠ guaranteed.** "Ground-floor room," "high floor," "room near the elevator," "connecting rooms," and "accessible parking spot" are, on most providers, **preferences the property will *try* to honor but does not guarantee at booking.** A traveler who reads a preference as a confirmed attribute books on a false premise. The certainty status of a room-level request is itself the signal — and nothing in expaify or the amenity model expresses it.

3. **Parking as access, not amenity.** Whether parking exists, is on-site vs. off-site/street, and is guaranteed for the stay is an access requirement for any driver — but as a plain amenity boolean it hides the on-site/off-site and availability-for-dates distinctions that actually decide arrival logistics.

For all three, the safe default is not "assume unavailable" and not "assume available" — it is an explicit, non-alarming **"not documented by the provider"** or **"requestable, not guaranteed"** state.

## Boundary: Why This Is Not the Accessible-Stay-Fit Ticket

`docs/pipeline/accessibility-stay-fit/01-discovery.md` (`UXR-ACCESSIBILITY-STAY-FIT-01`) is a **settled foundation, not to be re-derived or duplicated.** The division of ownership is:

| Concern | Owner |
|---|---|
| Disability-need-specific features — roll-in shower, grab bars, doorway width, Braille/tactile signage, visual/vibrating alarms, service-animal policy — grouped by need type for travelers with disabilities | **accessibility-stay-fit** |
| Universal physical-access logistics any traveler relies on — elevator presence/dependence, whole-route step continuity, on-site parking access — and the **binding-vs-requestable certainty** of room-level preferences | **this ticket (hotel-access-requirements)** |
| Accessibility/amenity as scoped, provider-attributed evidence chips (`status` + `scope` + source) | **hotel-amenity-provenance** (data substructure to reuse) |

Where the two touch — "step-free" and "accessible parking" appear in both — the split is by **framing and audience**: accessibility-stay-fit treats them as *disability-fit features* for a user with a stated access need; this ticket treats them as *general arrival/circulation logistics and request certainty* for the whole population, and adds the dimensions the fit work does not model: **route continuity, elevator dependence for walk-up properties, and whether a room preference is guaranteed.** Downstream stages must **reuse the `hotel-amenity-provenance` evidence contract** (canonical id, `status` of `confirmed`/`unavailable`/`not_returned`/`unknown`, `scope` of `property`/`room`/`rate`/`selected_stay`, source label, optional `fetchedAt`/`fee`) as the data substructure. Do **not** invent a parallel model; the new work here is the **`certainty` dimension** (guaranteed vs. requestable) layered on top of that contract, plus the small hotels-first requirement set.

## Measurable Signal

The ticket mandates a **confidence signal** and a **filter-use signal**:

- **Confidence signal (primary).** The share of hotel decisions where a traveler can correctly state, *without leaving expaify*, each relevant access requirement's status: **confirmed present / documented as absent / not documented**, and for room-level items **guaranteed vs. requestable**. Today this rate is structurally **0%** — no field, no adapter mapping, no UI exists. A correct read of "requestable, not guaranteed" counts as success; reading it as "confirmed" counts as failure.
- **Filter-use signal (secondary, target — do not build the filter here).** Once an access-requirement filter/toggle exists (elevator, on-site parking), engagement rate with it and the share of filtered sessions that reach a booking handoff. Because no filter surface exists (`app/page.tsx:345` is stars/price/discount only), this is a **forward-looking target** the research and design stages define and instrument, not a widget this feature ships. It references, and must not rebuild, the amenity/accessibility filter surface owned by `hotel-amenity-fit`.
- **Structural signal (verifiable now).** Zero access-logistics fields in `HotelOffer`, zero access mapping in any adapter, zero access UI in `HotelCard`, zero access filter in `page.tsx`. The problem is total absence — so the first wrong move (e.g. rendering "Elevator" as a plain confirmed amenity, or a room preference as an attribute) would replace absence with **false certainty**, the exact failure this ticket exists to prevent.

## Constraints

1. **Surface only provider-documented facts, and preserve certainty.** An access requirement may be shown as present, absent, or requestable **only** when a provider documents it, normalized in `lib/providers` per the non-negotiable contract. Never infer an elevator from `stars`, floor count, price, property type, or photos; never infer route continuity from a single "step-free entrance" flag; never render a room preference as a confirmed attribute. Undocumented renders as an explicit **"not documented by the provider"** state — never as available and never as unavailable. Requestable-but-not-guaranteed items must carry that certainty explicitly and defer confirmation to the provider before payment.

2. **Hotels-first, factual attributes only.** Scope is limited to objective, provider-reportable hotel facts (elevator present, on-site parking, route step-continuity where documented, room-request bindingness). No subjective "easy to get around" language, no flights, no award travel. Reuse the `hotel-amenity-provenance` `status`/`scope`/source model as the substructure and extend it only with the `certainty` dimension — do not fork the contract, and keep `HotelOffer` back-compatible (no removed or renamed fields).

3. **Trust, accessibility, and layout.** Access-requirement disclosures must be scannable and non-overlapping at 375px mobile and 1280px desktop, must not rely on icon/color alone to convey status (many in the affected audience use assistive tech or have low vision), and must not crowd the existing price, Deal Score, location, quality-evidence, or booking-CTA hierarchy on the collapsed card. No decorative clutter, no marketing copy, no medical or compliance claims.

## Success Statement

This is solved when a first-time traveler — with luggage, a stroller, a car, a temporary injury, or a family needing connected rooms — can look at an expaify hotel result and correctly tell, without leaving the app, whether the property has an elevator, whether the route to the room is step-continuous, whether parking is on site, and whether a room preference they care about is guaranteed or only requestable, so that they never book a walk-up they cannot climb, a street-parking-only property they cannot reach by car, or a "room on request" they will not actually receive — and never see a certainty the provider did not actually give.

## Smallest Reliable Set of Requirement Disclosures (MVP)

A deliberately small, hotels-first, provider-data-dependent set — ranked by decision impact. Each is a candidate the research stage must validate against what providers actually return (the current Hotellook payload returns **none** of these, so empty-data treatment is the common case):

1. **Elevator present / not documented** — `scope: property`, `status`. The single highest-impact binary; decides walk-up viability. Absent an explicit provider value, show "not documented," never infer from floor count.
2. **On-site parking: yes / off-site / not documented** — `scope: property`, `status`, plus `fee` where given. Distinguish on-site from off-site/street; never collapse to a bare "Parking" boolean.
3. **Step-free route continuity (entrance → room)** — `scope: property`, `status`. Shown only when the provider documents route continuity, not derived from a lone "step-free entrance" chip; otherwise "not documented."
4. **Room-request certainty for the selected stay** — `scope: room`/`rate`, `certainty: guaranteed | requestable`. Applies to ground-floor, high-floor, near-elevator, and connecting-room preferences. Default to **requestable, not guaranteed** unless the provider confirms it as a bookable attribute.

Anything beyond these four (specific floor numbers, turning radii, garage clearance height, EV charging) is later-ticket scope and must not dilute the MVP.

## Downstream Focus (Required UXR Deliverables)

`UXR-HOTEL-ACCESS-REQUIREMENTS-01` must produce:

1. **Current-state audit** of `HotelOffer`, `hotellook.ts`, `HotelCard.tsx`, and `page.tsx`, confirming the zero-coverage claims and what a real provider payload (Booking.com-class facilities data) would actually expose for these four items.
2. **Certainty/evidence standard** — the rule for surfacing each item: provider-documented, normalized in `lib/providers`, carrying `status` + `scope` + source from the amenity-provenance contract plus the new `certainty` (`guaranteed` | `requestable`) for room-level requests. Define precisely how "not documented" differs from "documented as absent," and how "requestable" differs from "confirmed."
3. **Confidence and filter-use success measures** — instrumentation for the two signals above, including a comprehension check that users do not read "requestable" as "guaranteed" or "not documented" as "unavailable."
4. **Discovery map: card → detail** — where each of the four disclosures appears (which, if any, belong on the collapsed card vs. only in expanded detail), how they sit beside existing panels without crowding them, and the exact screen-reader reading of each state.
5. **Reference comparison (interaction level only)** — one or two patterns (e.g. Booking.com property "Facilities"/parking + its non-guaranteed room-preference language, Google Hotels amenity filters) focused on how each expresses **presence vs. requestable-vs-guaranteed** and handles undocumented facts — not visual style.
6. **Empty-data treatment** — given the thin current payload, the exact card/detail behavior when none of the four are documented, written so it neither alarms nor falsely reassures.

## Out Of Scope For This Feature (flag for later tickets)

- Building the access-requirement filter UI — references, but does not construct, the amenity/accessibility filter surface owned by `hotel-amenity-fit`.
- Disability-need-specific accessibility features (roll-in showers, grab bars, Braille, visual alarms, service animals) — owned by `accessibility-stay-fit`.
- Letting access data influence Deal Score — scoring has no approved hotel-fit model and must not conflate price percentile with access.
- Any provider integration that does not actually return these documented facts; DEV work is contingent on a provider that does.
- Flights and award travel; subjective "walkability"/"easy to navigate" language.

## Handoff

Create `UXR-HOTEL-ACCESS-REQUIREMENTS-01` (UX Research) with this discovery report path and the problem statement embedded, and with the required deliverables above — current-state audit, certainty/evidence standard, confidence + filter-use success measures, card→detail discovery map, reference comparison, and empty-data treatment — listed as mandatory research outputs, and with the explicit instruction to **reuse the `hotel-amenity-provenance` evidence contract and not duplicate the `accessibility-stay-fit` disability-feature work.**
