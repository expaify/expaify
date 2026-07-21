# UXD-LOYALTY-BENEFIT-CLARITY-01: Loyalty Benefit Clarity

## Pain Point

Loyalty-oriented travelers may reject a lower-priced expaify deal because nothing in the comparison, detail, or handoff surfaces tells them whether booking through our provider path preserves hotel/airline loyalty earning, points redemption, or elite-benefit eligibility — so the cheaper number reads as a hidden downgrade rather than a win.

## Who Is Affected And Where

- **Who:** Travelers who hold hotel or airline loyalty status and factor points earning or elite perks (late checkout, upgrades, breakfast, lounge access) into "is this a good deal?" For them, total value = price *plus* preserved loyalty value, not price alone.
- **Flow step:** The three surfaces named in the ticket, evaluated end to end:
  1. **Deal comparison** — `app/deals/DealFeed.tsx`, `app/components/ui/DealCard.tsx`, `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`.
  2. **Deal detail** — `app/deals/[dealId]/page.tsx` (price, "Why this is a deal", "Stay details", `CompareRow` action zone).
  3. **External booking handoff** — `app/components/ui/CompareRow.tsx` (hotel → OTAs: Expedia, Booking, Kiwi, Trip.com) and `app/book/BookingFlow.tsx` (flight → Duffel review; hotel → provider handoff).
- **Trust risk:** The hotel handoff sends users to **third-party OTAs**, where a booking commonly does **not** earn hotel-brand points or elite-night credit (OTA/wholesale rates frequently sit outside brand loyalty programs). We surface a confident Deal Score and savings figure while saying nothing about this trade-off. A loyalty traveler who knows this will distrust the deal; one who does not may book and feel misled after the fact — both outcomes erode trust.

## Current Implementation Signals

The problem is a **total absence of loyalty signal**, not a broken one:

- **No loyalty field in the data model.** `lib/types.ts` — `NormalizedFare` (flights) and `HotelOffer` (hotels) carry no loyalty program, earning, or eligibility field. There is no provider-confirmed loyalty datum to display even if we wanted to.
- **No provider surfaces it.** The cash baseline (`lib/providers/travelpayouts.ts`, trend data) returns no loyalty information. Duffel can carry a passenger `loyalty_programme_accounts` concept, but `app/book/BookingFlow.tsx` neither collects nor displays it. Hotel handoff is an affiliate deeplink to OTAs (`CompareRow`) with no loyalty metadata.
- **Detail page value story omits loyalty entirely.** `app/deals/[dealId]/page.tsx` "Why this is a deal" reasons purely on nightly rate vs. median; "Stay details" already shows honest unknown states ("Guest count unavailable", "Room or rate unavailable") but has no loyalty row.
- **Handoff copy is loyalty-silent.** `CompareRow` says only "Compare and book on:" / "Opens the provider site. Prices and availability can change." `BookingFlow` hotel path lists provider-confirmed items (taxes, fees, cancellation, availability) but never mentions loyalty earning or elite eligibility.
- **No misleading claim exists today** — which is the one thing working in our favor. The risk of any fix is *introducing* an unverifiable claim ("earn points on this stay") that we cannot substantiate.

## Measurable Signal

The problem is present because a loyalty traveler cannot answer, anywhere in the flow, the question: **"If I book this, do I keep my loyalty value — and if you don't know, do you say so?"** Observable QA signals:

- Zero occurrences of loyalty / points / elite / member-rate language on the comparison, detail, and handoff surfaces (confirmed by grep across `app/` — the only hits are the paywall "Members-only" plan concept, which is unrelated).
- The OTA handoff (`CompareRow`) presents a savings figure with no note that OTA bookings may not earn brand loyalty or elite credit.
- No "unknown / unconfirmed" loyalty state exists, so the flow cannot distinguish "we don't know" from "no benefit" — the exact ambiguity the ticket's constraint targets.

Success is directional: **more confident handoffs among loyalty-oriented travelers, with zero unverifiable eligibility claims shipped.**

## Constraints The Solution Must Respect

1. **No inferred eligibility (data integrity / brand trust).** Never state or imply a user will earn points or qualify for elite benefits. We hold no provider-confirmed loyalty datum in `NormalizedFare` / `HotelOffer`, and rates handed to OTAs are outside our visibility. Any loyalty messaging must be either provider-confirmed fact or an explicit, honest **unknown state** — matching the existing "unavailable" pattern already used in `Stay details`.
2. **Handoff honesty over persuasion (brand trust).** Because the hotel path leaves for a third-party OTA, copy must not promise loyalty preservation. The trustworthy, shippable claim is neutral and structural: *expaify cannot confirm loyalty earning or elite eligibility for a third-party booking; check with the provider or your program.* This informs without overpromising.
3. **No new network round trip or provider call (performance / contract).** A discovery-stage answer must not assume a new loyalty API. Any MVP messaging must render from data we already hold (or from static, provider-agnostic copy). All provider access stays inside `lib/providers`; money stays integer minor units; affiliate markers on outbound links are preserved.

## Success Statement

This is solved when a first-time loyalty-oriented user can evaluate a deal and reach the external booking handoff understanding whether their loyalty value is preserved, unknown, or not applicable — without expaify ever asserting an earning or elite-eligibility claim it cannot back with provider-confirmed data.

## Open Question For Downstream (the real decision)

This discovery deliberately does **not** presuppose that a loyalty UI ships. The core decision the ticket asks us to reach is: **does loyalty messaging merit MVP placement at all, and if so, only as an honest "unknown/not-applicable" trust note rather than an earning claim?** The strategist's read: an honest handoff disclosure (Constraint 2) is low-risk and likely trust-positive; anything resembling a points/elite *promise* is out of scope until a provider returns confirmed loyalty data. UXR must validate this with segment evidence before UXDES designs anything.

## Downstream Focus (for UXR-LOYALTY-BENEFIT-CLARITY-01)

### Segment definitions to audit
- **Loyalty-driven (elite):** holds status; will trade some savings for retained points/perks. Most at risk of rejecting OTA deals.
- **Loyalty-aware (points collector, no status):** earns where convenient; wants to know but won't always pay more.
- **Price-only:** indifferent to loyalty; must not be burdened by loyalty clutter (protect this segment — no decorative loyalty UI at 375px).

### Evidence requirements (what UXR must confirm, reading actual source — do not assume)
- Confirm no loyalty field exists on `NormalizedFare` / `HotelOffer` and that no current provider (`travelpayouts`, `duffel`, hotel affiliate) returns provider-confirmed loyalty data.
- Confirm which handoff targets are OTAs vs. direct-brand (`CompareRow` provider list) and whether OTA bookings can plausibly earn brand loyalty — cite the general industry pattern, not an assumed policy.
- Benchmark one or two references (Booking.com "Genius" positioning; Google Flights / an airline-direct comparison) at the **interaction-pattern** level: how do they state loyalty value or its absence honestly, and where in the flow?

### Decision criteria for UXR to hand to UXDES
- **Claim taxonomy:** classify every candidate loyalty statement as (a) provider-confirmed fact, (b) honest unknown/not-applicable note, or (c) prohibited inferred claim. Only (a) and (b) may proceed.
- **Placement test:** recommend the single earliest surface where an honest note reduces rejection without cluttering the price-only path — likely the OTA handoff (`CompareRow` / `BookingFlow` hotel path), not the comparison card.
- **Kill criterion:** if the only shippable message is "we don't know," decide whether that unknown-state note is net trust-positive or is noise that should wait for a provider that returns loyalty data. State the recommendation explicitly.

## Handoff

Create `UXR-LOYALTY-BENEFIT-CLARITY-01` with the segment definitions, evidence requirements, and decision criteria above.
