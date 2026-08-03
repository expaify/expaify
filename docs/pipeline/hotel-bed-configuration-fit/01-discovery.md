# UX Discovery: Hotel Bed-Configuration Fit

**Ticket:** `UXD-HOTEL-BED-CONFIGURATION-FIT-01`
**Stage:** UXD (Discovery)
**Priority:** P1
**Date:** 2026-08-03
**Affected flow:** deal detail → room-selection section → provider handoff, prior to booking confirmation

**Surfaces read (not assumed):**

- `app/deals/[dealId]/page.tsx` — deal detail sections, incl. `Check rooms with provider` (`:448-476`)
- `app/components/HotelCard.tsx` — expanded `Room & rate details` panel and the `Room & bed` row (`:705-736`)
- `app/book/BookingFlow.tsx` — provider-directed request guidance (`:1290`)
- `lib/types.ts` — `HotelOffer` (`:751-777`), `HotelEvidenceScope` / `HotelEvidenceCertainty` (`:126-136`), `HotelAmenityEvidence` (`:138-148`)
- `lib/providers/hotelbeds.ts` — the only adapter with a room array (`:27-45`, `:212`)
- `lib/providers/bookingComHotelsRapidApi.ts` — live inventory adapter (`:150`)
- `lib/providers/hotellook.ts` — legacy adapter, property-level only
- `lib/hotels/searchCriteria.ts` — occupancy state (`:11-13`, `:120`, `:182`)
- `docs/pipeline/hotel-room-occupancy/01-discovery.md`, `docs/pipeline/hotel-bed-configuration/01-discovery.md`, `04-retry-verification.md`

---

## 0. Scope boundary — what this ticket owns and what it must not restate

Two adjacent pipelines already exist. This ticket is the third slice and is only
defensible if it stays strictly inside its own boundary.

| Pipeline | What it owns | Relationship here |
|---|---|---|
| `hotel-room-occupancy` (UXD/UXR) | **Headcount only**: does this room/rate admit N adults, and was the price quoted for N adults | Out of scope here. Never restate admission limits, "maximum guests", or per-adult repricing. |
| `hotel-bed-configuration` (shipped through UI + retry verification) | The **existence** of a `Room & bed` row, and the preference-vs-guarantee distinction at the handoff boundary | Already delivered as a static provider-absence row. Do not re-specify that row's existence. |
| `hotel-special-requests` | Cribs, connecting rooms, guidance-only request block | Out of scope. Beds are not a request-block concern here. |
| **This ticket** | **Bed-arrangement fit against party composition**: which sleeping surfaces exist, how many, and whether that arrangement works for *this* party (couple, family, friend group) | In scope. |

The distinction that makes this a separate problem: a room can pass every
occupancy test and still be unbookable for the party. "Sleeps 4, four adults
admitted, priced for four" is satisfied equally by a room with two queen beds and
by a room with one king plus a sofa bed. For two couples travelling together, only
one of those is bookable. **Headcount fit and bed fit are independent tests, and
expaify currently runs neither.**

---

## 1. User pain point

**A traveller whose trip depends on how the sleeping surfaces are divided — two
couples needing two real beds, a parent needing beds separate from a child's, two
colleagues who will not share a king — cannot see the bed type or bed count of any
room before leaving expaify, so bed fit can only be tested inside the provider's
flow after the price, score, and property have already been committed to.**

---

## 2. Who is affected, and at which step

Three party shapes, each failing differently:

| Party | What they need to confirm | What expaify shows them |
|---|---|---|
| Two adults, sharing (couple) | That one bed exists and is not two twins pushed apart | Nothing |
| Two adults, not sharing (friends, colleagues) | That two separate sleeping surfaces exist | Nothing |
| Family (adults + children) | Whether children get real beds, a sofa bed, or a bunk, and whether that counts toward capacity | Nothing |

The break point is **the room-selection section of the deal detail page**
(`app/deals/[dealId]/page.tsx:448`, heading `Check rooms with provider`). This
section is where expaify hands the decision off. It is also the last surface
expaify controls. Everything downstream — the actual room list, the bed labels, the
price per configuration — belongs to the provider. A traveller who reaches that
handoff without bed information has to reconstruct the entire comparison on the
provider's site, and the deal score they came for does not travel with them.

A second, quieter break point is the `HotelCard` expanded panel
(`app/components/HotelCard.tsx:720-727`), which renders a `Room & bed` row whose
only value is `Room type not provided by this provider`. This is honest, but it is
the same string for every property in every result set, so at comparison time it
carries no discriminating information.

---

## 3. Which bed-configuration signals actually exist — provider audit

**The ticket's premise that bed-configuration fields are "already present in
provider room data" does not hold against the code.** This is the central finding
of this discovery and the thing UXR must design around.

| Adapter | Room-level data parsed | Bed fields |
|---|---|---|
| `hotelbeds.ts` | `rooms[]` exists, but is typed as `{ rates?: { net?: string; rateClass?: string }[] }` (`:32-34`). Only consumed by `lowestRateCents()` to find a minimum price (`:85-97`). No room name, no room code, no bed descriptor is read. | **None** |
| `bookingComHotelsRapidApi.ts` | Property-level only. The search URL hardcodes `&adults=2&room_qty=1` (`:150`) and returns a property summary. | **None** |
| `hotellook.ts` | Property-level cache entries (name, stars, location, `priceFrom`). Legacy/dead. | **None** |
| `amadeus.ts`, `kiwi.ts`, `duffel.ts`, `travelpayouts.ts` | Not hotel room providers | n/a |

`HotelOffer` (`lib/types.ts:751-777`) has no room identifier, no room label, and no
bed field of any kind. A repository-wide grep for bed terminology in `app/` and
`lib/` returns exactly two product strings: the static `Room & bed` label
(`HotelCard.tsx:722`) and the words `preferred bed setup` inside provider-directed
request guidance (`BookingFlow.tsx:1290`). There is no bed data, no bed
normalization, and no bed instrumentation anywhere in the codebase.

**Consistency of provider reporting is therefore not measurable today**, because no
adapter requests or retains room-level content. Hotelbeds is the only provider whose
API shape could carry it — its search response is already room-keyed, and the
adapter already sends `occupancies: [{ rooms: 1, adults: 2, children: 0 }]`
(`:212`) — so the room array is present but discarded. Establishing real coverage
requires an adapter change, which is DEV-stage work, not UXR work.

### What this means for downstream stages

UXR must **not** assume it can spec a populated bed row. The honest design space is
narrower and has three tiers:

1. **Absence, stated well.** Today's only reachable state. The question is whether
   the current one-size string is the right treatment, or whether absence should be
   framed against the party ("we can't confirm bed setup for two couples").
2. **Requestable, not guaranteed.** expaify already ships
   `HotelEvidenceCertainty = 'guaranteed' | 'requestable'` (`lib/types.ts:136`) and
   a `'room'` evidence scope (`:126-130`). Bed preference is the textbook
   `requestable` fact: even providers that show bed types often do not guarantee
   them. This tier is reachable **without new provider data**.
3. **Reported and scoped.** Requires a Hotelbeds room-content adapter change. Out
   of scope for UXR; flag as a DEV dependency.

---

## 4. Confusion patterns users hit today

Observable from the current code, without user research:

1. **Silent substitution of headcount for bed fit.** Nothing on the surface tells a
   traveller these are different questions. A capacity signal reads as a bed
   promise.
2. **Undifferentiated absence.** Every property returns the identical
   `Room type not provided by this provider` string, so a traveller cannot tell a
   property that genuinely lacks bed data from one expaify simply did not ask about.
   Absence looks like a rendering bug rather than a provider limit.
3. **Preference read as guarantee.** `preferred bed setup` in the booking guidance
   (`BookingFlow.tsx:1290`) is the only bed language in the flow, and it appears
   *after* the decision, framed as a request. A traveller who reads it before
   handoff may conclude the arrangement is arranged rather than merely asked for.
4. **Comparison collapse.** With no bed signal in `HotelOffer`, two results are
   ranked purely on price and score. A party of four comparing a one-king room and
   a two-queen room sees two identical-looking rows at different prices, and the
   cheaper one wins the click.
5. **Occupancy is not even captured.** `searchCriteria.ts` hardcodes
   `occupancy: { state: 'not_captured' }` (`:120`, `:182`), so expaify does not know
   the party shape. Any bed-fit judgement needs a party to judge against, and that
   input does not exist yet. This is a hard dependency on `hotel-room-occupancy`.

---

## 5. Measurable signal that the problem is real

| Signal | Where it would be read | Threshold suggesting the problem |
|---|---|---|
| Handoff abandonment for multi-adult parties | `data-hotel-decision-section="provider_handoff"` (`page.tsx:448`) vs. deal-detail views | Handoff click-through for parties of 3+ materially below single/couple baseline |
| Return-to-expaify after provider room list | Existing return-reason capture in `BookingFlow.tsx` | A recurring return reason attributable to room/bed mismatch |
| Post-booking contacts citing wrong bed setup | Support contact tagging | Any non-trivial rate; this class of complaint is unrecoverable after check-in |
| Expanded-panel engagement on the `Room & bed` row | `HotelCard` expansion analytics | Repeated expansion with no subsequent handoff = users hunting for a fact that is not there |
| Bed-field coverage rate | New adapter instrumentation (DEV) | Unknown today — currently **0%**, because no adapter parses it |

Note the honest gap: signals 1–4 are **not currently instrumented for bed intent**.
Nothing in the analytics allow-list distinguishes a bed-driven abandonment from any
other. UXR should treat the qualitative side as primary evidence and name the
instrumentation gap rather than claim a number that does not exist.

---

## 6. Constraints the solution must respect

1. **Never state a bed arrangement expaify cannot source.** No inference from room
   name, star rating, price tier, or property type. If a provider does not report
   beds, the surface says so. This is the standing pattern across every shipped
   hotel evidence family and it is not negotiable for a fact this consequential.
2. **Reuse the existing evidence contract; invent nothing.** Bed facts must fit
   `HotelEvidenceScope = 'room'` and `HotelEvidenceCertainty = 'guaranteed' |
   'requestable'` (`lib/types.ts:126-136`) and follow the `HotelAmenityEvidence`
   shape. Any new provider work returns `Result<T>` and money stays
   `{ priceCents, currency }`.
3. **Additive to headcount, never a substitute for it.** The surface must not let a
   bed statement be read as an occupancy permission, and must not restate any
   admission limit owned by `hotel-room-occupancy`.
4. **Usable at 375px.** The `Room & bed` row lives inside a two-column grid that
   collapses to one column below `sm` (`HotelCard.tsx:720`). A bed treatment must
   not overflow, truncate mid-word, or push the handoff CTA below the fold on
   mobile.

*(Four listed; the stage asks for three. Constraint 1 and constraint 3 are the two
that most directly prevent a trust regression, and neither can be dropped.)*

---

## 7. Success statement

**This is solved when a first-time user booking for two or more people can tell,
before leaving expaify, either what the sleeping arrangement of the room is or that
expaify does not know it — and can tell whether that arrangement is guaranteed or
merely requestable — without inferring a bed setup from an occupancy number, and
without discovering the mismatch at the provider or at check-in.**

Explicitly, a user must never be able to reach the provider handoff believing a bed
arrangement is confirmed when it is not.

---

## 8. Open questions for UXR

1. Do travellers actually treat "sleeps 4" as a bed promise, or do they already
   expect to verify beds at the provider? This determines whether the fix is a new
   surface or better absence framing.
2. Which is more damaging: no bed information, or bed information marked
   `requestable`? A hedge that reads as noise is worse than a clean absence.
3. At which point in the decision does bed fit become blocking — result comparison,
   or only at handoff? This decides whether the signal belongs in `HotelCard` or
   only on the deal detail page.
4. For families, is the child sleeping surface (sofa bed, bunk, rollaway) a
   separate question from adult beds, or the same one?
5. Is a Hotelbeds room-content fetch worth the added latency for a bed label that
   may still be `requestable` at the property? UXR should reach a recommendation;
   the adapter change itself is DEV work.

---

## 9. Handoff

Next stage: **`UXR-HOTEL-BED-CONFIGURATION-FIT-01`** — validate the confusion
patterns in §4 with users, resolve the open questions in §8, and produce testable
design directives that stay inside the §0 boundary.

UXR must audit `lib/providers/hotelbeds.ts` room content directly and must not
assume bed fields exist. The finding in §3 stands until an adapter proves otherwise.
