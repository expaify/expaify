# 01 — Discovery: Hotel minimum-stay requirement visibility

**Ticket:** UXD-HOTEL-MINIMUM-STAY-REQUIREMENT-01
**Stage:** UXD (UX Discovery)
**Priority:** P2
**Date:** 2026-08-03
**Surface:** Hotel deal feed, hotel deal detail, hotel search date range, provider handoff

---

## 0. Read this first — the ticket's premise does not match the code

The ticket asks for a brief "quantifying how often minimum-stay restrictions appear" using "minimum-stay fields already returned by existing providers." **No such field exists anywhere in this codebase.** Three separate checks confirm it:

1. `HotelOffer` (`lib/types.ts:751`–`778`) has 27 fields. None of them describes stay length, length-of-stay, minimum nights, or any rate-level date restriction.
2. Neither live hotel adapter parses one. `lib/providers/hotelbeds.ts` reads only `rate.net` (line 90) and `rateClass` (line 29) off each rate object. `lib/providers/bookingComHotelsRapidApi.ts` passes `arrival_date` into the query (line 148) and reads nothing about stay constraints back out.
3. The rate-restriction surface that *would* own this is closed to four families by construction. `RESTRICTION_ORDER` in `app/components/HotelRateRestrictions.tsx:21`–`26` is `residency | age | membership | refundability`, matching `RateRestrictionFamily` (`lib/types.ts:557`). Minimum stay is not among them, and `HotelRateEligibilityCapability` (`lib/types.ts:598`) has no slot for it.

So the honest answer to "how often does this appear" is: **observable frequency today is 0%, because expaify never ingests the field.** That is not the same as "the problem is rare" — it means we are blind to it. **Quantification is out of reach at UXD and must not be faked.** §5 defines what would have to be built before any number is trustworthy, and §8 states the conflict formally.

The second premise is also wrong in a way that changes the whole shape of the problem, and it is the more important finding. **expaify has no checkout.** Both hotel adapters ship offers with `deeplink: ''` (`bookingComHotelsRapidApi.ts:188`, `hotelbeds.ts:270`), each with a source comment explaining that no affiliate-marker deeplink mechanism is available; `HotelCard.tsx:795` gates the outbound CTA on `isValidBookingUrl(hotel.deeplink)`. Booking is a handoff to a partner, and today it is a handoff that frequently cannot even fire. A minimum-stay rejection therefore happens **on the partner's site, after the user has left us**, or it does not happen at all because the user never got out the door. We cannot instrument it, cannot catch it, and cannot show an error for it. Any solution that assumes an in-product checkout error to intercept is designing for a screen that does not exist.

---

## 1. Problem statement

A traveller building a short stay on expaify is never told that a rate needs more nights than they have selected, so they carry a deal to the booking partner that their dates cannot buy — and because the rejection lands on the partner's site, expaify never learns it happened.

---

## 2. Who is affected, and where

The affected user is a **short-stay traveller** — weekend trips, one- and two-night city stops, event-driven travel. Minimum-stay rules cluster hard on exactly this segment: 2- and 3-night weekend minimums, festival and holiday minimums, and peak-season blocks. Long-stay travellers are structurally immune, since a 7-night search clears nearly every published minimum.

The break is spread across three points, and the traveller only ever feels the last one.

**Point 1 — stay length is set, but never by the user.** In the main search flow, hotel dates are not chosen at all. `app/api/search/route.ts:400`–`404` derives the hotel query as `{ checkin: depart, checkout: ret }` straight from the *flight* dates. Stay length is a byproduct of the flight itinerary. There is no hotel-side night control and no place where a user could deliberately widen a stay to satisfy a rate.

**Point 2 — the deal feed defaults to a length that maximises exposure.** `lib/db/schema.sql:112` and `:137` both declare `nights SMALLINT NOT NULL DEFAULT 2`. The feed's default stay is two nights, which sits inside the range that 2- and 3-night minimums reject. The feed's date filter is a **check-in window** (`lib/hotels/searchCriteria.ts:10`: `{ semantic: 'checkin_window'; dateFrom?; dateTo? }`) — it constrains *when the stay starts*, not *how long it runs*. A user filtering the feed cannot express stay length even indirectly.

**Point 3 — nights are displayed, but only as a fact, never as a constraint.** The deal detail page renders the night count (`app/deals/[dealId]/page.tsx:387`) and `HotelDealCriteria.tsx:450` renders `"{checkIn} – {checkOut} · {n} nights"`. Both present the stay as settled and valid. Nothing on either surface can say "this rate needs three." The user reads a confident, unqualified stay summary and reasonably concludes their dates work.

The result: expaify tells the traveller their two nights are fine, at three separate points, with increasing confidence — and is never in the room when the partner says no.

---

## 3. Signal that the problem exists

The ticket names two signals. **Neither is currently measurable, and UXR must not be sent to look for them.**

- *"Rate of checkout-blocking errors tied to minimum-night restrictions"* — unmeasurable. There is no checkout (§0). The error occurs inside the partner's funnel, on a domain we have no telemetry on. `lib/analytics.ts` cannot observe it and no schema change to expaify can make it observable.
- *"Search-to-checkout drop-off on short-stay date ranges"* — unmeasurable for the same reason, and additionally confounded: with `deeplink: ''` on both adapters, short-stay drop-off is currently dominated by the missing outbound CTA, not by stay rules. Any drop-off number pulled today would be measuring the deeplink gap and mislabelling it as a minimum-stay signal.

What *is* real, verifiable, in-repo evidence that the exposure exists:

| # | Evidence | Location |
|---|---|---|
| E1 | `HotelOffer` carries no stay-length field — nothing to display even if a provider sent one | `lib/types.ts:751`–`778` |
| E2 | Hotelbeds adapter reads only `net` and `rateClass` off each rate; stay conditions discarded at parse | `lib/providers/hotelbeds.ts:29,90` |
| E3 | Default stay is 2 nights — inside the rejection band for common weekend minimums | `lib/db/schema.sql:112,137` |
| E4 | Hotel dates are inherited from flight dates; user has no hotel-side night control | `app/api/search/route.ts:400`–`404` |
| E5 | Feed date filter is a check-in *window*; stay length is not expressible | `lib/hotels/searchCriteria.ts:10` |
| E6 | Night count is rendered as settled fact, with no slot for a constraint | `app/deals/[dealId]/page.tsx:387`; `HotelDealCriteria.tsx:450` |
| E7 | Rate-restriction surface is closed to four families; minimum stay has no home | `HotelRateRestrictions.tsx:21`–`26`; `lib/types.ts:557` |

E1–E2 establish we are blind. E3–E5 establish the exposure is structural, not incidental — we *default* users into the risky band and give them no control to leave it. E6–E7 establish that even a correct answer has nowhere to render today.

---

## 4. Prior decision this must reckon with

`docs/pipeline/hotel-policy-exceptions/01-discovery.md:109` explicitly rejected minimum-stay rules from the admission-policy taxonomy, on the grounds that they are "friction rather than denial," and instructed UXR not to expand past five families. `02-research.md:152` upheld that rejection.

**That decision stands and this ticket does not overturn it.** It was a decision about the *admission-policy* surface — the taxonomy answering "may you OCCUPY this property," per the distinction drawn at `lib/types.ts:605`. Minimum stay is not an occupancy rule. It is a rate-purchase condition: it answers "may you BOOK this rate," which is the rate-eligibility question. If minimum stay lands anywhere, it lands in the rate-restrictions family set (`lib/types.ts:557`), not the admission taxonomy.

Downstream stages must not re-open the admission-policy taxonomy. Adding a fifth admission family for minimum stay would contradict a decision made twice with reasons that remain valid.

Note also that the prior framing — "friction rather than denial" — is precisely wrong *for this surface*. On the admission surface it was right. As a rate condition, a minimum-stay rule is a hard denial: the rate cannot be purchased for the selected dates at any price. That distinction is the reason this ticket is legitimate and is worth carrying forward.

---

## 5. What must be true before any number is credible

Since §0 establishes that quantification is impossible today, this is the honest substitute for the frequency figure the ticket requested. Downstream stages should treat these as ordered prerequisites, not options.

1. **A field must exist.** `HotelOffer` needs a stay-restriction slot, and at least one adapter must populate it. Until then every displayed state is `not_provided` and the feature is a no-op.
2. **A capability flag must accompany it.** The repo's settled pattern for partial provider coverage is a capability boolean beside the evidence — `HotelRateEligibilityCapability` (`lib/types.ts:598`), `HotelRequiredChargeCapabilities` (`lib/types.ts:717`). This distinguishes *"the provider says this rate has no minimum"* from *"the provider does not tell us about minimums."* Collapsing those two into one silent state is the failure mode that would make this feature actively harmful — it would let us imply "your 2 nights are fine" on a rate we know nothing about, which is worse than today's honest silence.
3. **Coverage must be measured before it is trusted.** Once populated, the answerable question is: of hotel offers returned, what share carry a stay restriction, and what share carry the *capability* at all. A restriction rate computed over offers whose provider never reports the field is meaningless.
4. **Do not build a "learn about it earlier" flow on partner-side telemetry.** It does not exist and cannot be made to exist (§3).

---

## 6. Constraints the solution must respect

1. **No new provider calls, and no new provider.** Per the ticket. Work is limited to fields obtainable from the existing Hotelbeds and Booking.com RapidAPI responses. If neither response carries stay data, the correct outcome is a truthful `not_provided` state and a documented gap — **not** an inferred, estimated, or heuristic minimum. Guessing a minimum-stay rule and being wrong destroys exactly the trust this ticket exists to protect.
2. **Evidence discipline over completeness.** The existing tri-state pattern (`RateEligibilityPresentation` at `lib/types.ts:564`: `restricted | clear | not_provided | loading | error`) is mandatory. `not_provided` is a first-class, shippable state. Never claim a rate is unrestricted because we lack data — this mirrors the Deal Score rule that thin data never yields a "Great" verdict.
3. **Money and contract rules are untouched.** Any per-stay or total-price implication stays `{ priceCents, currency }` in integer minor units; adapters return `Result<T>` and never throw. A minimum-stay rule changes what is *bookable*, never how price is represented.
4. **375px mobile must stay usable.** The hotel card is already dense — deal badge, eligibility line, funds policy, document readiness, price composition. A new always-visible row is not affordable. Any indicator must be conditional on an actual restriction and must not push the price or the CTA below the fold.
5. **Repair mode.** This is trust repair, not a new feature. Scope is: stop asserting a stay is valid when we do not know. Do not build a stay-length picker, a "extend your stay" upsell, or alternate-date suggestions off this ticket.

---

## 7. Success statement

**This is solved when a first-time user planning a two-night stay can tell, before leaving expaify, whether a hotel rate accepts their dates — and when the rate's stay requirement is unknown to us, sees that we do not know rather than an implied assurance that their dates are fine.**

Sub-conditions:
- A rate with a reported minimum longer than the selected stay is visibly marked before handoff, on both the feed card and the deal detail.
- A rate with no reported stay data reads as unknown, never as unrestricted.
- The night count shown at `[dealId]/page.tsx:387` and `HotelDealCriteria.tsx:450` no longer reads as an unqualified validity claim when we have no stay-restriction data.
- No new provider call is introduced, and coverage is stated honestly wherever a restriction state is shown.

---

## 8. Conflict raised for the record

Per the briefing's instruction to report conflicts rather than guess:

> **The ticket's stated constraint — "rely on minimum-stay fields already returned by existing providers" — is not satisfiable against the current code.** No minimum-stay field is returned by, or parsed from, any provider in `lib/providers/`, and `HotelOffer` has nowhere to carry one (§0, E1–E2).
>
> **The ticket's stated signal — "checkout-blocking errors" — cannot occur in expaify.** There is no checkout; booking is an affiliate handoff, and both hotel adapters currently emit `deeplink: ''` (§0, §3).

This does not invalidate the underlying problem — E3–E7 show the exposure is real and structural. It invalidates the two proposed measurement paths. UXR must treat "does any existing provider response carry stay-restriction data at all, under the no-new-calls constraint" as its **first and gating question**. If the answer is no, the deliverable is a truthful `not_provided` state plus a documented provider gap, and everything downstream of that scopes accordingly.

---

## 9. Handoff

`UXR-HOTEL-MINIMUM-STAY-REQUIREMENT-01` — validate the gap against real provider payloads and reference patterns.

UXR's ordered questions:
1. **Gating.** Do the Hotelbeds or Booking.com RapidAPI responses already in use carry any stay-length restriction data (rate comments, rate conditions, policy blocks) reachable without a new call? Read the adapters and any recorded fixtures — do not assume.
2. If yes: what shape, what coverage, how reliable? If no: confirm the gap explicitly and scope the deliverable to the honest `not_provided` state.
3. How do Booking.com and Google Hotels surface a minimum-stay conflict — at the *interaction* level (when in the flow, what the user can do next), not the visual level?
4. Where does the state belong given §4: rate-restrictions family set, not the admission taxonomy. Confirm or challenge with reasons.
5. What is the correct mobile treatment given constraint 6.4 and current hotel card density?
