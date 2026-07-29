# UXD-HOTEL-TOTAL-STAY-COST-01: Total Stay Cost Confidence Discovery

Date: 2026-07-29
Stage: UX Discovery
Persona: Senior UX Strategist
Ticket: UXD-HOTEL-TOTAL-STAY-COST-01 (P0)

## Scope Note: Relationship To The Stalled `total-stay-cost` Pipeline

`docs/pipeline/total-stay-cost/` (2026-07-21) already ran discovery and research on the adjacent problem of **showing a stay subtotal** (`pricePerNight × nights`) across the deal feed, deal detail, `HotelCard`, and `BookingFlow`. That work stopped after `02-research.md`; no `03-design.md` exists and none of its eight directives were implemented (verified below). It in turn built on `docs/pipeline/hotel-price-visibility/`, which also stopped after research.

This ticket is **not** a re-run of that work. Its assignment is narrower and different in kind: produce a **scoped disclosure model** — a classification of what expaify knows about a stay's cost and what it is allowed to say for each class. The prior research produced copy directives for one class (a computed estimate) and correctly refused to invent fee data; it never defined the classification itself, never addressed **occupancy-dependent charges**, and never specified the **known-total** branch that appears the moment any provider returns a real total.

Delta owned by this ticket:

| Dimension | `total-stay-cost` (2026-07-21) | This ticket |
|---|---|---|
| Stay subtotal = nightly × nights | Covered (directives 1–3) | Reuse, do not re-derive |
| Shared fallback copy | Covered (directive 4) | Reuse as the `unknown` class |
| Resort-fee range disclosure | Ruled out (directive 5) | Upheld, not reopened |
| **Known total vs. estimate as distinct disclosure classes** | Not covered | **Owned here** |
| **Occupancy-dependent charges** | Not covered | **Owned here** |
| **Provider-source attribution rule per class** | Not covered | **Owned here** |

Everything the prior research settled stays settled. UXR must read both prior docs before starting and must not re-audit ground they already cover.

## User Pain Point

A traveler scanning hotel deals cannot tell whether the price expaify shows is a number someone stands behind, a number expaify calculated, or a number that will change once the provider learns how many people are staying — because every hotel price surface renders the same undifferentiated "per night before taxes and fees" caption regardless of how much or how little expaify actually knows.

## Who Is Affected And At What Step

Every hotel shopper, at three consecutive steps:

1. **Deal-feed price scan** — `app/components/ui/DealCard.tsx:86-88` shows `{formatMoney(deal.dealPrice)}` with a `/ night` caption and a strikethrough `usually {medianPrice}` comparison. Nothing distinguishes a known cost from an unknown one; the user forms a budget expectation here.
2. **Hotel detail** — `app/components/HotelCard.tsx` (`Price`, lines 349–365) and the expanded "Price scope" panel (lines 1045–1051), plus the deal detail page (`app/deals/[dealId]/page.tsx:379`). This is where a user who is unsure goes looking for the breakdown, and where the answer is currently a restatement of the same caption.
3. **Booking handoff** — `app/book/BookingFlow.tsx:239, 1014, 1079`. The last expaify-controlled screen. The accessible CTA name tells the user "The final total may differ" (`:1014`) without telling them by roughly how much, in which direction, or driven by what.

The traveler most harmed is the one booking for more than one or two people, or for a stay long enough that a per-night mandatory fee compounds — precisely the cases where the delta between the scanned number and the charged number is largest, and precisely the cases expaify currently has no vocabulary for.

## Current Implementation Signal

### 1. The data layer cannot represent a total, and cannot represent occupancy at all

- `HotelOffer` (`lib/types.ts:474-495`) carries `pricePerNight: Money` and `priceBasis?: 'per_night_before_taxes_fees'`. There is no `nights`, no `totalPrice`, no `taxes`, no `mandatoryFees`, no `payAtProperty`. The `priceBasis` union has exactly **one** member — the type system currently makes it impossible to express any basis other than "per night before taxes and fees."
- `HotelProvider.searchHotels(area, range: { checkin, checkout }, context?)` (`lib/types.ts:533-537`) takes **no guest count, no room count, no occupancy of any kind**. `grep` for `guests|adults|occupancy|rooms` across `lib/types.ts` returns only smoking-policy and parking constants. Occupancy-dependent charges are therefore not merely undisclosed — the search contract has no input from which any provider could price them, and no field in which one could return them.
- `HotelSearchContext` (`lib/types.ts:422`) carries only a location anchor.

### 2. Every price surface uses one caption for every epistemic state

`HotelCard.tsx:359` renders `per night before taxes and fees` under a valid provider price. `HotelCard.tsx:1047` repeats the identical string in the expanded detail panel. `BookingFlow.tsx:239` maps `priceBasis` to the same sentence a third time. `app/deals/[dealId]/page.tsx:379` writes it a fourth time. Four independently-maintained literals expressing one meaning — and that meaning is a disclaimer, not a disclosure. A user who reads it carefully learns only what the number excludes, never what it includes or how firm it is.

### 3. Stay length is present in the data and still absent from the price

The deal detail page has `deal.nights` in server scope and renders it as an isolated `Nights` fact at `app/deals/[dealId]/page.tsx:362-363`, seventeen lines above the price block at `:379`, which never references it. `DealCard` does not receive `nights` at all — `grep` for `nights` in `app/components/ui/DealCard.tsx` returns nothing, confirming the prior research's directive 1 was never implemented in the eight days since it was written. The user is shown both operands and asked to multiply.

### 4. The card volunteers that it does not know how fresh the price is

`HotelCard.tsx:361` and `:379` both render the hardcoded string `Last-checked time unavailable` in `var(--warning)` — unconditionally, for every offer, including offers with a valid price. The one explicitly *uncertain* thing on the price block is hardcoded rather than derived. This is adjacent freshness work (see Out Of Scope), but it is direct evidence that price-trust copy on this surface is asserted rather than computed.

### 5. The codebase already solved this exact problem shape once, for deposits

`HotelFundsPolicyEvidence` (`lib/types.ts:314-322`) models a provider money obligation the provider may or may not document, using `state: 'complete' | 'partial' | 'explicit_none' | 'not_returned' | 'conflicting'`, a `HotelFundsAmount` union of `exact | range | percentage | variable | not_returned`, a `HotelFundsBasis` of `per_stay | per_night | per_room | per_person | provider_defined | not_returned`, plus `sourceLabel`, `scope`, `fetchedAt`, and `missingFields`. `HotelFundsPolicyPanel` renders it with per-state copy and source attribution, and it ships today on `HotelCard` (lines 916–926, 1054–1064).

Total stay cost is the same problem shape — an amount, a basis, a scope, a source, and a documented-or-not state — and it currently reuses none of that vocabulary. `HotelFundsBasis` already contains `per_person` and `per_room`, meaning **the codebase has an occupancy-basis vocabulary for deposits and none for the room rate itself.**

## Measurable Signal

The ticket names three research measures. Two are not observable today; that is itself the finding, and the disclosure model must not be specified as if the metrics existed.

1. **Price-detail engagement** — partially observable. `HotelCard`'s Details toggle (`:971-979`) fires `trackHotelFundsPolicyDetailsOpened` and `useHotelFundsPolicyExposure` (`app/components/hotelFundsPolicyAnalytics.ts`), so an expand event exists on this one surface. There is no equivalent on `DealCard`, deal detail, or `BookingFlow`, and the existing event is scoped to funds policy, not price scope.
2. **Stated price confidence** — not observable in-product. This is a moderated-research measure and must be gathered by asking participants to state the expected charge before handoff, not by instrumentation.
3. **Rate of surprise-cost reports** — not observable. There is no support or feedback surface in `app/` or `lib/`, and `lib/analytics.ts` remains a `console.debug` stub. This measure is only obtainable from moderated task sessions until an instrumentation ticket lands.

**The falsifiable in-product signal available now** is the code state itself: a single `priceBasis` union member, zero occupancy fields in the hotel search contract, `nights` rendered adjacent to but never combined with price, and four divergent copies of one disclaimer string. The problem is structural and provable by reading the repo; it does not depend on traffic data to establish.

**The research-task signal UXR should design for**: give a participant a `HotelCard` for a 5-night stay for 4 guests and ask them to state what their card will be charged. Today the honest answer is unavailable from the screen at any level of effort. That is the baseline to beat.

## Constraints

1. **Never fabricate a tax, fee, or occupancy charge.** No provider adapter returns tax, mandatory-fee, or per-person data — `lib/providers/hotellook.ts` normalizes only `priceFrom` into `pricePerNight`; Amadeus and Kiwi hotel paths are stubbed. The disclosure model must have a first-class `unknown` class that says so plainly. The prior research's directive 5 (no generic resort-fee range) is upheld and must not be reopened.
2. **A computed number and a provider number must never be visually or semantically interchangeable.** Any figure expaify derives (`pricePerNight × nights`) must be labeled as expaify's arithmetic and must not carry provider attribution. Any figure a provider returns must carry that provider's name. The model must make it impossible for a UI implementer to render one in the other's treatment.
3. **Preserve provider-source attribution and the money contract.** Every disclosed cost fact carries a `sourceLabel` (and `fetchedAt` where available), following the `HotelFundsPolicyEvidence` precedent. All money stays `{ priceCents: number; currency: string }` — never floats, never display strings. Nothing may overwrite `pricePerNight`, which `lib/scoring/scoreDeal.ts` scores against nightly-rate baselines; a stay total must never be fed to Deal Score.

## Success Statement

This is solved when a first-time user, at any of the three steps, can state which of three things the price on screen is — a total the provider stands behind, an estimate expaify computed from the nightly rate, or a nightly rate whose full cost is not documented — and can name who the number came from, without opening details and without hitting a screen where an estimate is styled to look like a confirmed total.

## Handoff Notes For UXR

Read first, do not repeat: `docs/pipeline/total-stay-cost/01-discovery.md`, `docs/pipeline/total-stay-cost/02-research.md`, `docs/pipeline/hotel-price-visibility/02-research.md`. Their subtotal, fallback-copy, and no-fee-range conclusions are inherited as settled.

Questions this research must answer:

1. **What are the classes?** Propose the disclosure classes and their boundaries. The hypothesis to test is three: `provider_total` (provider returned a stay total), `expaify_estimate` (nightly × nights, taxes and fees excluded and undocumented), `nightly_only` (nights unknown or price basis unresolvable). Test whether `partial` — provider returned a total that excludes named charges it does name — needs to be a fourth, given `HotelFundsPolicyState` found `partial` and `conflicting` both necessary for the analogous deposit problem.
2. **What does each class permit expaify to say and to attribute?** One copy pattern and one attribution rule per class, written as exact strings, applied identically across `DealCard`, deal detail, `HotelCard`, and `BookingFlow`. The rule for `expaify_estimate` must state that no provider name attaches to the figure.
3. **Occupancy.** Determine what Booking.com and Google Hotels do at the interaction level when a rate is occupancy-dependent and guest count is unknown. Then decide the honest disclosure for expaify's actual situation, which is more severe than theirs: expaify never asks for guest count, so it cannot know whether the displayed rate even applies to the user's party. Answer explicitly whether the model needs an `occupancy_unverified` qualifier that can attach to any class, and whether a guest-count input is a prerequisite for this feature or a separate DEV ticket. **Do not assume a guest input can be added** — that is a search-contract change (`HotelProvider.searchHotels`) with provider-adapter consequences, and this ticket is not authorized to expand into it.
4. **Reuse assessment.** Evaluate `HotelFundsPolicyEvidence` / `HotelFundsPolicyPanel` (`lib/types.ts:299-324`, `app/components/HotelFundsPolicyPanel.tsx`) as the structural precedent. State whether the cost model should mirror its state vocabulary and panel pattern, or diverge — and if diverge, why. A traveler who reads a deposit disclosure and a cost disclosure on the same card should not have to learn two grammars.
5. **Where the disclosure lives per surface.** The feed scan, the detail read, and the handoff commit have different attention budgets. Specify what compresses to a chip on `DealCard`, what expands in `HotelCard` details, and what must be non-collapsible before the outbound click.

Dependency notes UXR must carry into the brief's acceptance criteria:

- **Provider data is the gating dependency for the `provider_total` class.** No adapter returns totals or fees today. The design must still fully specify that class — it is what makes the model correct rather than a description of the current gap — but must mark it as unreachable until a DEV provider-adapter ticket lands, so TEST does not fail the work for an unimplementable state.
- **Type-contract changes are DEV-stage.** `priceBasis` widening, any cost-evidence type, and any occupancy field are `lib/types.ts` changes, not UI work.
- **Two of three named metrics have no data source.** Frame price confidence and surprise-cost rate as moderated-task measures with a stated protocol, not as dashboards. Do not scope analytics instrumentation into this feature.

## Out Of Scope Findings

- **`Last-checked time unavailable` is hardcoded** at `app/components/HotelCard.tsx:361` and `:379`, rendered in `var(--warning)` for every offer regardless of actual freshness. Price freshness has its own pipelines (`docs/pipeline/hotel-price-freshness/`, `docs/pipeline/provider-freshness-timestamp-clarity/`). Flagged, not fixed here — but a total-cost disclosure that inherits an unconditional staleness warning will read as contradictory, so UXR should note the interaction.
- **Four divergent copies of the price-basis string** across `HotelCard`, `BookingFlow`, `DealCard`, and deal detail. Consolidation was already directive 4 of the prior research and remains unimplemented. Inherited, not re-scoped.
- **`lib/analytics.ts` is a `console.debug` stub and there is no support/report surface.** Pre-existing, app-wide, unchanged since 2026-07-21. Not fixed here.
- **The hotel search form is not reachable from `app/page.tsx`,** which is now a marketing landing page — noted in the prior research and still true, meaning `HotelCard` and `BookingFlow`'s hotel path are latent code. This does not lower the ticket's priority (the deal feed and detail page are live and carry the same defect) but it does mean fixes on those two surfaces cannot be validated against live traffic.
- **Flight fare price scope** (`FarePriceScope = 'per_person' | 'party_total'`, `lib/types.ts:4`) already distinguishes per-person from party-total on the flight side. That asymmetry with hotels is worth citing as internal precedent, but flight pricing is not touched here.
