# UXD-HOTEL-LOYALTY-BENEFIT-ELIGIBILITY-01: Hotel Loyalty Benefit Eligibility

Date: 2026-07-29
Stage: UX Discovery
Priority: P2
Persona: Senior UX Strategist
Ticket: UXD-HOTEL-LOYALTY-BENEFIT-ELIGIBILITY-01
Scope: hotel-detail decision → external booking handoff (hotels only)

---

## 1. Problem statement

A traveler who holds hotel loyalty status decides at the hotel detail and handoff surfaces whether to accept our price, but expaify never states which benefits it can and cannot verify — so the traveler either assumes benefits carry over and is disappointed after check-in, or assumes they are forfeited and abandons a legitimately good deal, and expaify learns nothing from either outcome.

The failure is silence, not a false claim. That is the one asset we start with, and the primary risk of any fix is destroying it.

---

## 2. Who is affected, and where

**Who:** Hotel shoppers who hold or are accruing brand loyalty status (Marriott Bonvoy, Hilton Honors, IHG One, World of Hyatt). For this traveler, "is this a good deal?" is not price alone — it is price **plus** what the stay earns and what it entitles them to on arrival. A $40/night saving that costs an elite-night credit, a suite upgrade, free breakfast, or lounge access can be a net loss, and they know it.

**Where — the four steps in the affected flow:**

1. **Hotel detail decision** — `app/deals/[dealId]/page.tsx`. Price, Deal Score, "Why this is a deal", stay details. This surface asserts value confidently and says nothing about loyalty. `HotelCard.tsx` gates **Review hotel** on a valid integer-cent price and provider URL; benefit eligibility is not part of that gate.
2. **expaify review** — `app/book/BookingFlow.tsx`. The last expaify-controlled surface. It already carries honest scoped disclosures for adjacent unknowns: "What you may need", "Special requests", funds policy, document readiness, and `HotelBookingOwnershipDisclosure` ("Who handles my booking?"). There is no loyalty equivalent.
3. **External handoff** — **Continue to provider** / `CompareRow.tsx`, an affiliate deeplink opening a third-party partner in a new tab. This is the point of no return: past it, the rate, its loyalty treatment, and the benefit conversation all belong to the partner and the property.
4. **Post-handoff / arrival** — outside our system entirely. If points do not post or an upgrade is refused at the desk, the traveler attributes it to expaify, because expaify is where they chose the rate. We currently have no rule telling them who owns that question.

**Where the trust risk concentrates:** the hotel handoff targets third-party partners. Rates sourced through third-party and wholesale channels commonly sit outside brand loyalty programs — no points, no elite-night credit, and sometimes no elite benefits honored on arrival. We present a confident savings figure directly adjacent to a trade-off we never name.

---

## 3. Current-state evidence (read from source, not assumed)

### 3.1 The offer model cannot represent a benefit
`HotelOffer` (`lib/types.ts:474–495`) carries identity, location, `pricePerNight`, price basis, photo, source, deeplink, plus the evidence systems shipped by prior tickets: `documentReadiness`, `hotelClass`, `guestRating`, `amenityEvidence`, `accessEvidenceState`, `fundsPolicy`, `smokingPolicy`, `rateEligibility`, `rateEligibilityCapability`. There is **no field** for loyalty program, points earning, elite-night credit, status benefit, or upgrade eligibility. No provider-confirmed benefit datum exists to display.

### 3.2 The one existing "membership" field is a different question — do not conflate them
`HotelRateEligibilityEvidence` (`lib/types.ts:457–464`) has a `membership` family, surfaced by `HotelRateRestrictions.tsx`. That system answers **"may I buy this rate?"** — is it gated behind a membership, residency, age, or non-refundable condition. It was delivered by `docs/pipeline/rate-eligibility/`.

This ticket asks the inverse and later question: **"if I buy it, what do I get?"** — does the stay earn points, count toward status, and entitle me to my tier's benefits at the property. A rate can be perfectly `clear` on every restriction family and still earn nothing. Downstream stages must not reuse or overload `rateEligibility` for benefit earning; the two answers can differ for the same rate and merging them would produce a wrong statement.

### 3.3 Zero loyalty language ships today — confirmed
Grep across `app/` and `lib/` for loyalty / points / elite / rewards / member rate returns no user-facing hotel loyalty copy. The only adjacent hits are the Premium subscription's "Upgrade" (a billing concept, unrelated) and `lib/baggage/fees.ts:124`, a flight-baggage disclaimer noting fees vary by "loyalty status" — which shows the honest-variance pattern already exists in the codebase, just not on the hotel path.

So: **no false promise exists, and no honest disclosure exists either.** The user's question has no answer anywhere in the flow.

### 3.4 The right pattern is already in the codebase
`BookingFlow.tsx:1163–1190` — "Special requests" — is the precedent this problem should follow. It states what expaify does not do ("Nothing is selected or sent by expaify"), refuses to guarantee an outcome ("Requests depend on availability and are not guaranteed"), gives a four-step ladder of what each status word actually means (Selected / Sent / Acknowledged / Guaranteed), and names who to escalate to ("use your confirmation or itinerary to contact the property"). `HotelBookingOwnershipDisclosure` does the same for reservation ownership. A loyalty answer that matches this pattern is consistent with the product and requires no new provider call.

### 3.5 There is no measurement of this today
`BookingFlow.tsx` already emits `hotel_handoff_viewed`, `hotel_handoff_continue_clicked`, `hotel_handoff_back_clicked`, `hotel_handoff_returned`, and `hotel_handoff_return_reason_selected` with a `handoffSessionId`. The **return-reason** instrument is the existing hook for this ticket's abandonment measurement — but its reason list contains no loyalty option, so a traveler who bounces to check their program is currently indistinguishable from any other abandoner.

### 3.6 Overlap with a stalled prior ticket — flagged, not silently duplicated
`docs/pipeline/loyalty-benefit-clarity/` holds a discovery and a research brief covering loyalty value across **both** flights and hotels and across comparison, detail, and handoff. It stalled at UXR — there is no `03-design.md` and nothing shipped. Its research recommendation was: ship one honest-unknown note at the hotel handoff only, ship nothing on comparison cards, block anything richer until a provider returns confirmed data.

That conclusion is sound and this discovery does not relitigate it. This ticket is **narrower and adds one thing that prior work never covered**: the escalation rule — what the product does when the traveler has a benefit question we cannot answer. Recommendation to the pipeline owner: treat `loyalty-benefit-clarity` as superseded for the hotel path and let this feature slug carry it forward; if flight loyalty is still wanted, it should be a separate ticket. UXR must not produce a second parallel brief that re-derives the same segment analysis — read the prior brief, cite it, and extend it.

---

## 4. Measurable signal that the problem exists

The ticket names three measures. Each maps to an instrument that exists or is a small addition to an existing one:

| Measure | Signal | Instrument |
|---|---|---|
| **Benefit-eligibility questions** | Travelers ask "do I earn points on this?" with no in-product answer | Today: unanswerable — no loyalty string exists anywhere (§3.3). Add a loyalty option to the existing `hotel_handoff_return_reason_selected` reason set and track disclosure opens, mirroring `HotelBookingOwnershipDisclosure`'s `onOpen`. |
| **Handoff abandonment** | Loyalty-driven travelers reach the handoff, then leave to verify with their program or reject the deal outright | `hotel_handoff_continue_clicked` vs. `hotel_handoff_viewed`, segmented by whether the loyalty disclosure was opened; `hotel_handoff_returned` with a loyalty return reason. |
| **Correct understanding of what expaify can verify** | Travelers can state, unprompted, that expaify verifies **price** and does not verify **benefits** | Comprehension check in UXR: after viewing detail + handoff, can the participant correctly say who confirms points, status credit, and upgrades? Baseline today should be near zero, since nothing states it. |

**Baseline claim, stated honestly:** the diagnostic evidence here is a source audit, not field data. The strength of the case is structural — a confident savings claim sits next to an unnamed trade-off, at the exact moment control transfers to a third party. UXR owns converting this into segment evidence before UXDES designs anything.

---

## 5. Constraints the solution must respect

1. **Never assert a benefit we cannot source (data integrity / brand trust — the hard line).** No copy may state or imply that a stay earns points, earns elite-night credit, qualifies for a member rate, or entitles the traveler to an upgrade, breakfast, late checkout, or lounge access. No provider in `lib/providers` returns benefit data and `HotelOffer` cannot hold it (§3.1). The only permissible statements are (a) a provider-confirmed fact, which does not exist today, or (b) an explicit, honest **"expaify cannot verify this"** state naming who can. "Probably earns points" and "book direct to keep your benefits" are both out of bounds — the second is an unsourced recommendation, not a disclosure.

2. **Handoff language must stay accurate and affiliate-honest (brand trust / contract).** The traveler is being sent to a third-party partner on a monetized affiliate deeplink. Copy must not imply expaify has negotiated, preserved, or arranged any benefit, and must not imply the partner has confirmed one. Affiliate markers on outbound deeplinks are preserved unchanged; `isAttributedHotelProviderUrl` gating in `CompareRow.tsx` is untouched.

3. **Do not tax the price-only majority (performance / accessibility / mobile).** Most travelers do not hold status and loyalty content is noise to them. Any disclosure must be progressive — collapsed by default, matching `HotelBookingOwnershipDisclosure` — must not add a network round trip or a provider call, must render from static provider-agnostic copy, and must not add a persistent row to hotel cards or the results grid. The detail page and review page are already dense at 375px; no overlapping text, no new always-visible block, no decorative badge. Interactive elements keep the existing focus ring and ≥44px touch targets.

---

## 6. Success statement

This is solved when a first-time loyalty-holding user can decide on a hotel and reach the external handoff **knowing that expaify verifies the price and cannot verify points, status credit, or on-property benefits, and knowing exactly who to ask instead** — without expaify ever asserting a benefit it cannot source from a provider.

Two supporting conditions:
- A price-only traveler completes the same flow without encountering any loyalty content they did not open.
- Every unsupported benefit question resolves to a named owner (partner or property or the traveler's own program), never to a dead end and never to a guess.

---

## 7. The escalation rule (the deliverable this ticket exists for)

The ticket's success criterion has two halves: a **disclosure** and an **escalation rule for unsupported benefits**. The disclosure was already recommended by prior research (§3.6). The escalation rule is new, and it is the part downstream stages must actually design.

Framed as the question to answer, not the answer itself — UXDES owns the final wording:

> When a traveler asks a benefit question expaify cannot verify — will this earn points, will it credit an elite night, will my status be honored, can I get an upgrade — what does the product do?

The rule needs to assign each unsupported question to exactly one owner, and there are three candidates with genuinely different responsibilities:

- **The booking partner** — owns the rate, its terms, and whether a loyalty number can be attached at checkout.
- **The property** — owns what is honored at check-in: upgrades, breakfast, late checkout, room assignment.
- **The traveler's loyalty program** — owns whether the stay posts, whether it credits toward status, and what the tier entitles them to.

An escalation rule that routes everything to "the booking partner" would be inaccurate — the partner cannot speak for what the property honors at the desk or whether a program posts a stay. The rule must be specific per question type, and it must state plainly that expaify is not in that loop.

Precedent to follow, not reinvent: §3.4. "Special requests" already does exactly this shape of work for a different unknown — disclaim what expaify does not do, refuse to guarantee an outcome, define the terms, name who to ask. A loyalty escalation rule should read as a sibling of that section, not as a new pattern.

Open question UXR must resolve: **is the honest disclosure enough on its own, or does the escalation rule need its own surface?** The strategist's read — one collapsed disclosure at the handoff carrying both the "we verify price, not benefits" statement and the per-question owner routing is likely sufficient and lowest-risk. A second surface risks violating Constraint 3. UXR validates; UXDES decides placement.

---

## 8. Explicitly out of scope

- **Flights.** Airline loyalty is a different program structure and a different provider path (Duffel carries a passenger loyalty-account concept; hotels have no equivalent). Separate ticket if wanted.
- **Any loyalty UI on hotel cards, the results grid, or the deals feed.** Constraint 3, and prior research reached the same conclusion.
- **Collecting, storing, or transmitting the traveler's loyalty number.** Not our data to hold, and no provider path accepts it on the hotel handoff.
- **Adding a loyalty field to `HotelOffer` or a provider method.** Blocked until a provider actually returns confirmed benefit data. If UXDES concludes a data field is required, that is a contract change and must be escalated — not assumed.
- **Reusing or extending `rateEligibility` / `HotelRateRestrictions` to carry benefit earning.** §3.2 — different question, and merging them would produce wrong statements.
- **Any "book direct instead" recommendation.** Unsourced, and steers away from the monetized path on a guess rather than on evidence.

---

## 9. Handoff — for UXR-HOTEL-LOYALTY-BENEFIT-ELIGIBILITY-01

Required reading before starting: this document; `docs/pipeline/loyalty-benefit-clarity/01-discovery.md` and `02-research.md` (prior overlapping work — extend and cite, do not re-derive); `docs/pipeline/rate-eligibility/` (the adjacent shipped system this must not be conflated with).

What UXR must produce:

1. **Segment evidence** for the three loyalty segments already defined in the prior brief — cite them rather than redefining, and add what is hotel-specific and handoff-specific.
2. **A source audit confirming §3.1–§3.5 still hold** at the time of writing. Read the actual files and cite line numbers.
3. **A reference teardown at the interaction level** — how at least one major hotel marketplace states loyalty value or its absence at the point of handoff, and where in the flow it appears. Interaction pattern, not visual style.
4. **A resolved escalation rule**: for each unsupported benefit question type (earning, elite-night credit, status recognition, upgrade/on-property perks), the single correct owner and the honest reason. This is the ticket's core deliverable — do not leave it as an open question.
5. **A placement decision**: one disclosure at the handoff, or handoff plus detail. Justify against Constraint 3 and the price-only segment.
6. **3–5 testable design directives** with exact states and exact copy rules.

Output: `docs/pipeline/hotel-loyalty-benefit-eligibility/02-research.md`. Then create `UXDES-HOTEL-LOYALTY-BENEFIT-ELIGIBILITY-01`.

**Kill criterion — apply it honestly.** If the audit finds that a single honest sentence plus an escalation rule does not measurably change a loyalty traveler's confidence at handoff, say so and recommend not shipping. Repair mode is active; adding an unread disclaimer to a dense handoff page is a regression, not a fix. The correct outcome may be "document the rule internally, ship nothing to the UI."
