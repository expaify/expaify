# 01 — Discovery: Hotel kitchenette and in-room food-prep fit

**Ticket:** UXD-HOTEL-KITCHENETTE-FIT-01
**Stage:** UXD (UX Discovery)
**Priority:** P2
**Date:** 2026-08-03
**Surface:** Hotel detail evaluation (`/deals/[dealId]`, `hotel_fit` section) and hotel results scan (`/deals`)

---

## 0. Ground truth before anything else

Everything below is read from the code in this worktree, not assumed.

**There is no food-preparation data anywhere in this product.** A repo-wide search across `app/` and `lib/` for `kitchen|kitchenette|microwave|fridge|refrigerator|minibar|cooktop|stove|utensil|kettle` returns **zero hits in product code**. Every hit is in `docs/pipeline/` prose. `HotelOffer` (`lib/types.ts:751`–`777`) carries 27 fields — identity, location, stars, price, ratings, access/transport/parking evidence, funds, smoking, rate eligibility, admission, charges. None describes a room's food-prep capability, and there is no field it could hide in.

**The one amenity channel that exists would silently discard a food-prep fact if a provider sent one.** `HotelAmenityEvidence` (`lib/types.ts:138`–`148`) is a well-built evidence shape, but its normalizer is gated on a **closed allowlist of seven access facts** — `ACCESS_FACTS` at `lib/providers/hotelAmenityEvidence.ts:18`–`26` (elevator, on-site parking, step-free route, and four room-preference requests). `normalizeItem` drops anything else at `hotelAmenityEvidence.ts:116`–`117` (`const fact = FACT_BY_ID.get(id); if (!fact) return undefined;`). The consuming side repeats the gate independently: `HotelCard.tsx:83`–`90` declares its own six-id `ACCESS_FACTS` and `getAccessEvidence` skips every unrecognised id via `isAccessFactId` (`HotelCard.tsx:141`). So a provider returning `refrigerator` today is not merely unrendered — it is **deleted twice, silently, with no error state**. This is a harder floor than "the field doesn't exist," because it means partial provider coverage cannot even be *observed* without changing both allowlists.

**Both live adapters supply nothing.** `lib/providers/hotelbeds.ts:253` and `lib/providers/bookingComHotelsRapidApi.ts:171` both call `normalizeHotelAmenityEvidence(undefined, …)`, which returns every fact as `not_returned` (`hotelAmenityEvidence.ts:156`–`158`). Neither adapter's parse type has a slot for facilities: `HotelbedsRoom` (`hotelbeds.ts:32`–`34`) is `{ rates?: HotelbedsRate[] }` and `HotelbedsRate` is `{ net?, rateClass? }` — the room object is read for price and nothing else, so room name, room type, and any room description are discarded at parse. `HotelProperty` (`bookingComHotelsRapidApi.ts:24`–`33`) reads name, coordinates, review score/count, property class, photos, wishlist name, price breakdown. No facilities block on either.

**The one proxy signal is also gone.** `propertyType` survives only on the dead-API cache entry type (`hotellook.ts:39`); `HotelOffer` has no `propertyType` field and normalization drops it — the finding `docs/pipeline/property-type-fit/02-research.md:25` recorded. So "it's an aparthotel, so it has a kitchen" is unavailable *and* would be an inference we must not make regardless.

**Conclusion:** provider coverage for food prep is **0% on both live paths, and structurally unobservable**. This does not make the ticket invalid — it fixes its shape. The deliverable this discovery points at is a truthful, itemized *unknown* classification plus a documented provider gap, not a capability display waiting on data we already have.

---

## 1. Problem statement

A traveler weighing a longer or budget-conscious stay cannot tell from an expaify hotel detail page whether the room lets them store, reheat, or cook their own food — so the single decision that most changes what a multi-night stay costs and feels like is made blind, off-platform, after the handoff.

---

## 2. Who is affected, and where

Two overlapping segments, both under-served by a nightly-rate-first product:

- **Longer-stay travelers** (4+ nights: relocations, extended work trips, family visits). Food prep is not a nicety for them; it is the difference between three restaurant meals a day and a manageable week. It also drives the stay-length decision itself — a room with real food-prep capability makes a longer booking tolerable.
- **Budget-conscious travelers**, including families with young children and travelers with dietary or medical constraints (formula, insulin, allergen-safe food, religious dietary practice). For this group a refrigerator is not a convenience feature, it is a hard requirement, and getting it wrong is not a disappointment — it is a stay that does not work.

The break sits at three points in the flow:

**Point 1 — results scan (`/deals`).** The feed's filter pills are `minDiscount`, `minStars`, `maxPrice` (`app/deals/hotelFilterRecovery.ts`). A traveler who needs a kitchenette cannot narrow, cannot sort, and sees no food-prep fact on any row. The `deals` table (`lib/db/schema.sql:125`–`148`) has no amenity column, so nothing could reach the feed today even if an adapter normalized it.

**Point 2 — detail evaluation (`/deals/[dealId]`), the ticket's named surface.** The page has a section titled **"Hotel fit"** at decision position 3 (`app/deals/[dealId]/page.tsx:425`). It renders hotel class, guest rating, and four evidence ledgers — pool, disruption, quiet stay, sustainability (`page.tsx:438`–`446`). There is no food-prep line. A section named for the fit question answers a set of questions that excludes the one this ticket is about, which reads as *"we checked, there is nothing else to know."*

**Point 3 — the handoff.** There is no room-selection step. The user leaves via `HotelDealCriteriaHandoff` (`page.tsx:449`) to the provider — and on both live adapters `deeplink` is `''` (`hotelbeds.ts:270`, `bookingComHotelsRapidApi.ts:188`), so even that exit is often unavailable. Every food-prep question therefore becomes an unassisted task on someone else's site, after expaify has already presented a confident "Hotel fit" verdict.

---

## 3. Why this is not "add a kitchenette chip"

This is the distinct problem, and downstream stages must hold it. Three properties of food-prep capability make a boolean amenity chip actively worse than silence.

**3.1 Capability is a conjunction, not a list.** A traveler is not asking "is there a microwave." They are asking which meal behaviour the room supports:

- **Store** — chilled storage for medication, formula, leftovers, groceries.
- **Reheat** — store, plus a way to heat prepared food.
- **Cook** — reheat, plus a heat source you can actually cook on, plus water and a sink.

Each level *requires the levels beneath it*. A microwave with no refrigerator does not support reheating groceries; a cooktop with no sink does not support cooking. Rendering `Microwave ✓` next to an unknown refrigerator invites the traveler to read a capability that the room does not have. Any per-item chip row, shown without the level it adds up to, reproduces exactly this error. This mirrors the framing already settled for work-fit in `docs/pipeline/hotel-workspace-fit/01-discovery.md` (presence ≠ suitability) and should be treated as precedent, not re-litigated.

**3.2 The minibar trap — the ticket's named constraint, and a money risk as well as a capability risk.** Provider vocabularies use *minibar*, *mini-fridge*, and *refrigerator* interchangeably and sometimes simultaneously. They are not the same object:

- A **minibar** is stocked and chargeable. Its shelves are full of the property's inventory; removing items to make room for your own can incur charges. Some are non-cooling display cabinets. Some are sensor-armed and bill on lift.
- A **refrigerator** is empty, yours, and free to use.

Treating a documented minibar as chilled storage produces two distinct failures: a family arrives with medication and no usable cold space, and/or the guest is billed for moving stock. Expaify already has a mandatory-charge evidence model (`HotelRequiredChargeEvidence`, `lib/types.ts`) precisely because surprise charges are a trust event. **A minibar must never satisfy the storage capability, and if it is documented it must be labelled as a minibar with its charge implication intact.**

**3.3 "Kitchenette" is a marketing word, not a specification.** Two properties both advertising a kitchenette can differ on cooktop, oven, sink, dishwasher, and cookware. The label is a *claim requiring itemization*, never evidence of a capability level. The same holds for property type — "aparthotel" is not a kitchen.

**3.4 Utensils are the silent failure, and the ticket is right to name them.** Cookware, dishware, and utensils are close to absent from every provider vocabulary, and they are the item that converts *cook* from theoretical to real. A room with a two-burner cooktop and no pan cooks nothing. Because this fact is almost always missing, the temptation is to let it ride along with the cooktop. It must not: **utensils are their own explicitly-unknown line, never implied by the presence of a heat source.** A "cook" classification asserted without utensil evidence is the highest-expectation-mismatch state this feature can produce.

**3.5 Scope discipline.** A shared property kitchen (hostels, some aparthotels) is a genuinely different product from an in-room kitchenette — different privacy, different hours, different suitability for a family with a toddler. `HotelEvidenceScope` (`lib/types.ts:127`–`131`: `property | room | rate | selected_stay`) already exists to carry this. A property-scoped kitchen fact must never render as a room-scoped one, and a room-type-scoped fact must not read as a promise about the rate the user is looking at.

---

## 4. Measurable signal

**Verifiable in the repo right now (the pre-ship baseline is a set of structural zeros):**

| # | Signal | Value | Location |
|---|---|---|---|
| S1 | Food-prep facts rendered on the live hotel path | **0** | `/deals`, `/deals/[dealId]` |
| S2 | Food-prep fields on `HotelOffer` | **0** of 27 | `lib/types.ts:751`–`777` |
| S3 | Canonical amenity ids the normalizer accepts | **7**, all access facts; food-prep ids dropped | `hotelAmenityEvidence.ts:18`–`26`, `:116` |
| S4 | Canonical ids the consuming card accepts | **6**; second independent gate | `HotelCard.tsx:83`–`90`, `:141` |
| S5 | Live adapters supplying amenity evidence | **0 of 2** (both pass `undefined`) | `hotelbeds.ts:253`, `bookingComHotelsRapidApi.ts:171` |
| S6 | Room objects parsed for anything but price | **0** (`HotelbedsRoom` = `{ rates }`) | `hotelbeds.ts:32`–`34` |
| S7 | Amenity columns on `deals` | **0** | `lib/db/schema.sql:125`–`148` |
| S8 | Food-prep filters on the results feed | **0 of 3** pills | `app/deals/hotelFilterRecovery.ts` |

S3–S6 are the important ones and they are the reason this ticket needs a research stage before a design stage: **we are not data-poor, we are data-blind.** We cannot currently distinguish "no provider documents kitchenettes" from "providers document them and we delete the field."

**The ticket's stated outcome measure is not measurable here — see §8.** The honest substitutes, in order:

1. **Coverage rate (gating, post-instrumentation).** Once a food-prep vocabulary exists and at least one adapter attempts to populate it: share of hotel offers carrying *any* food-prep evidence, and share carrying a **capability flag** at all. A capability rate computed over providers that never report the field is meaningless.
2. **Unknown exposure rate.** Share of displayed food-prep slots resolving to `not_returned` / `unknown`. If this is high — and §0 says it will start at 100% — then the design problem is *unknown-state presentation*, not capability display. Design must be sized for that reality.
3. **Comprehension (the real quality gate, testable pre-ship).** Share of participants who correctly distinguish: minibar vs. refrigerator; "kitchenette documented" vs. "cooking supported"; cooktop present vs. cookware available; property-shared kitchen vs. in-room; and *not documented* vs. *not available*. This is the measure that maps to "accurate identification of usable food-prep capability," and unlike the ticket's version it can actually be run.

---

## 5. Constraints the solution must respect

1. **Never infer, from any source.** No minibar → refrigerator. No "kitchenette" label → contents or capability level. No property type → kitchen. No stars, price, brand, or photos. And explicitly: **no text mining of `deals.headline` or `deals.description`** (`schema.sql:141`–`142`) — those free-text columns are the obvious shortcut to a shippable-looking feature and they are the fastest route to a fabricated capability claim. An undocumented item renders as *not documented*, never as present and never as absent. This is the constraint the ticket names first and it is the one most likely to be quietly violated downstream.

2. **Preserve provider uncertainty structurally, not just in copy.** Reuse the settled evidence contract — `HotelEvidenceStatus` (`confirmed | unavailable | not_returned | unknown`), `HotelEvidenceScope`, `sourceLabel`, `fetchedAt`, `confidence` (`lib/types.ts:120`–`148`). Do not fork a parallel model. Follow the repo's capability-flag pattern (`HotelRateEligibilityCapability`, `HotelRequiredChargeCapabilities`) so *"the provider says there is no fridge"* is representable separately from *"the provider does not tell us about fridges."* Collapsing those two is the failure that makes this feature harmful rather than merely empty. The shipped honest-zero precedent is `NO_QUIET_STAY_EVIDENCE` (`app/components/ui/QuietStayEvidenceLedger.tsx:95`), rendered unconditionally at `page.tsx:444`.

3. **`not_documented` is the primary state, not the edge case.** Given S5, the first shippable version is overwhelmingly likely to be an itemized honest-unknown block. Design it as the main state and make it worth a user's attention — a block that says "we don't know" must still tell the traveler *what to ask the provider*, or it is clutter. Do not design a rich capability display and treat unknown as a fallback.

4. **Do not touch the Deal Score, and do not compute stay cost.** Food-prep fit must not feed, weight, or sit visually inside `DealScore`, the discount figure, hotel class, or guest rating — the Deal Score is the product's differentiator and diluting it with fit signals damages it. Likewise, no "you'll save $X on meals" arithmetic: that is speculation, and total stay cost is a separate pipeline (`docs/pipeline/total-stay-cost/`).

5. **Money and contract rules unchanged.** Any fee that attaches to a food-prep fact (kitchen-kit rental, cleaning surcharge, minibar charge) is `{ priceCents, currency }` in integer minor units via `HotelEvidenceFee`; adapters return `Result<T>` and never throw; no new provider or new provider call is authorised by this ticket.

6. **Live surfaces, and 375px.** Design against `/deals` and `/deals/[dealId]` — **not `HotelCard.tsx`**, which is imported only by `HotelRateRestrictions.tsx` and a research harness and is mounted on no live page (verified). The `hotel_fit` section at decision position 3 already carries four ledgers; a fifth must not crowd the price, Deal Score, or handoff CTA, and must not overlap at 375px.

7. **Repair mode.** Scope is: stop presenting a "Hotel fit" verdict that is silent on the food-prep question, and make the gap legible. Do not build a food-prep filter, a stay-length picker, a meal-cost calculator, or a grocery/dining integration off this ticket.

---

## 6. Success statement

**This is solved when a first-time traveler evaluating a hotel for a longer stay can tell, before leaving expaify, whether the room supports storing, reheating, or cooking their own food — and when the provider has not documented it, sees an itemized "not documented, ask the provider about X" rather than a chip row that implies a capability the room may not have.**

Sub-conditions:

- Storage, reheat, and cook read as *levels that require each other*, never as an unordered chip list.
- A documented minibar never satisfies storage, and carries its charge implication when shown.
- A "kitchenette" label alone never yields a capability level; it is itemized or it is a claim.
- Utensils/cookware is an explicit line that stays unknown unless separately documented, and no cook-level claim is made without it.
- Property-shared kitchen and in-room facilities are never rendered at the same scope.
- *Not documented* is visually and verbally distinct from *not available*, on every item.
- No new provider call is introduced; coverage is stated honestly wherever a capability state is shown.

---

## 7. Relationship to prior decisions

- **`docs/pipeline/hotel-amenity-fit/02-research.md:71` explicitly excluded kitchenette from the MVP amenity set** to hold scope. That exclusion stands and this ticket does not overturn it — it is the reason kitchenette gets its own treatment. §3 argues food-prep capability is structurally wrong for a value-amenity chip row; putting it back in that row would be the error. UXR must not reopen the amenity-fit MVP set.
- **`docs/pipeline/hotel-amenity-provenance/`** settled the provenance/evidence contract. Treat it as settled; do not re-derive it.
- **`docs/pipeline/property-type-fit/`** established `propertyType` as dropped in normalization and warned against reading kitchen expectations off a type label. Consistent with constraint 5.1.
- **`docs/pipeline/hotel-workspace-fit/01-discovery.md`** established the presence-≠-suitability and property-≠-room framing for a capability-shaped attribute. §3 applies that precedent rather than re-arguing it.

---

## 8. Conflict raised for the record

Per the briefing's instruction to report conflicts rather than guess:

> **The ticket's outcome measure — "fewer expectation mismatches" — is not observable by expaify.** An expectation mismatch about a kitchenette is discovered at check-in, on the property, after a handoff to a partner. There is no booking flow, no post-stay channel, and no partner-side telemetry; both live hotel adapters currently emit `deeplink: ''`, so a large share of users cannot even complete the handoff. `lib/analytics.ts` cannot see this event and no schema change to expaify can make it visible. §4.3 substitutes a comprehension gate, which measures the same failure at the point we control.

> **The ticket's other measure — "accurate identification of usable food-prep capability" — cannot be baselined today**, because the identification rate is structurally 0% (§4, S1–S8). The pre-ship baseline is the structural zero, not a behavioural number.

Neither conflict invalidates the problem — S1–S8 show the gap is real and structural. They invalidate the two proposed measurement paths, and they mean **UXR's first question is gating and empirical**, not comparative.

---

## 9. Handoff

Create `UXR-HOTEL-KITCHENETTE-FIT-01`.

UXR's ordered deliverables:

1. **Gating provider question.** Do the Hotelbeds or Booking.com RapidAPI responses already in use carry *any* food-prep attribute — room facilities, room type/description, property facility codes — reachable without a new call or a new provider? Read the adapters, the vendor field references, and any recorded fixtures. Note especially that `HotelbedsRoom` currently parses only `rates`, so an available field could be present in the payload and invisible to us. **Answer this before anything else; everything downstream scopes off it.**
2. **Vocabulary ground truth.** For each candidate item (refrigerator, minibar, microwave, cooktop/stove, oven, kettle, sink, dishwasher, cookware/utensils, shared property kitchen, "kitchenette" as a label), what exact provider string(s) map to it, and how do the providers disambiguate minibar from refrigerator — if at all? Where they do not disambiguate, say so explicitly; that determines whether storage can ever be claimed.
3. **A capability classification.** Propose the level model (§3.1 offers store / reheat / cook as the starting hypothesis — confirm, collapse, or extend it with reasons), the exact evidence conjunction each level requires, and the rule for what happens when one required item is unknown. State plainly whether a level can ever be asserted at all under the answer to (1).
4. **Reference patterns, at the interaction level.** How do Booking.com and one of Google Hotels / Airbnb present in-room food-prep facilities during scan and on the property page — specifically, how they itemize versus summarize, and how they handle properties where the facility set is partially unknown. Interaction pattern, not visual style.
5. **Placement.** Where this belongs across scan → detail, given that `deals` carries no amenity column (S7) and that `hotel_fit` (decision position 3) already holds four ledgers. Give an honest answer on whether scan-time surfacing is possible in phase one at all.
6. **Comprehension checks.** Concrete scenarios proving a user reads minibar vs. refrigerator, kitchenette-labelled vs. cook-capable, cooktop vs. cookware, property-shared vs. in-room, and *not documented* vs. *not available* correctly. Include the pass thresholds.
7. **The stay-length caveat.** The ticket's success criterion is a classification "that supports a stay-length decision." Note that expaify has **no hotel-side stay-length control** — hotel dates are derived from flight dates (`app/api/search/route.ts:402`) and `nights` defaults to 2 (`schema.sql:112`, `:137`). The classification therefore informs the traveler's own judgement about how long to stay; it must not be designed to feed a nights control that does not exist. Do not build one off this ticket.
