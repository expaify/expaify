# UXR-HOTEL-TOTAL-STAY-COST-01: Total Stay Cost Confidence Research

Date: 2026-07-29
Stage: UX Research
Persona: Senior UX Researcher
Ticket: UXR-HOTEL-TOTAL-STAY-COST-01 (P0)

## Source Inputs

Read as settled, not re-derived (per ticket scope):

- `docs/pipeline/hotel-total-stay-cost/01-discovery.md` (2026-07-29) — this pipeline's discovery.
- `docs/pipeline/total-stay-cost/02-research.md` (2026-07-21) — subtotal wiring, shared fallback copy, no-resort-fee-range. **Inherited.**
- `docs/pipeline/hotel-price-visibility/02-research.md` (2026-07-02) — stay-length visibility, nightly-rate Deal Score boundary. **Inherited.**

Current implementation audited for this brief (all line numbers verified in this worktree today):

`lib/types.ts`, `lib/hotels/fundsPolicy.ts`, `lib/hotels/searchCriteria.ts`, `lib/providers/hotellook.ts`, `lib/booking/config.ts`, `lib/pipeline/otaLinks.ts`, `lib/analytics.ts`, `app/api/analytics/route.ts`, `app/api/deals/route.ts`, `app/components/HotelCard.tsx`, `app/components/HotelFundsPolicyPanel.tsx`, `app/components/ui/DealCard.tsx`, `app/components/ui/CompareRow.tsx`, `app/deals/DealFeed.tsx`, `app/deals/[dealId]/page.tsx`, `app/book/BookingFlow.tsx`, `app/page.tsx`.

Reference patterns checked:

- [Google Hotel Prices — pricing overview / updating prices](https://developers.google.com/hotels/hotel-prices/dev-guide/updating-prices) (fetched today; **new and decisive**, see Reference Comparison)
- [Google Hotel price tax and fee policy](https://support.google.com/hotelprices/answer/6064432) (re-checked today; occupancy explicitly **not** addressed there)
- Booking.com Demand API pricing/display guidance — re-applied from prior research, not re-fetched.
- FTC Rule on Unfair or Deceptive Fees — inherited from prior research, not re-derived.

## Research Summary

The discovery's premise holds and the code confirms it. But three of the ticket's stated premises are **stale or wrong**, and two of them change the answer materially. Reporting them is part of this stage's job:

1. **`HotelOffer.priceBasis` is never set by any adapter.** It is not merely a one-member union — grep across `lib/` and `app/` shows *zero* producers. Every live offer has `priceBasis === undefined`. The only place the value exists is `lib/booking/config.ts:956`, which **fabricates** it: `priceBasis: hotel.priceBasis ?? 'per_night_before_taxes_fees'`. Every "per night before taxes and fees" string in the product is therefore **expaify's own assertion about a provider's number**, not a provider-returned fact. This is the sharpest available statement of the problem and it reframes the attribution rule (Directive 2).

2. **expaify already has a shipped occupancy vocabulary, and already refuses to fake occupancy.** `HotelSearchCriteriaV1.occupancy` (`lib/hotels/searchCriteria.ts:11-13`) is a discriminated union of `{ state: 'not_captured' }` and `{ state: 'applied'; adults; children; childAges; rooms }`. `'applied'` is **declared but never constructed anywhere in production code** — the only two constructors (`:120`, `:182`) both hardcode `not_captured`. Meanwhile `CompareRow.tsx:55-66` actively *rejects* any outbound link carrying occupancy params, and `lib/pipeline/otaLinks.ts:18-21` documents the refusal in prose: keep actions unavailable rather than "pretending the snapshot's hidden occupancy default was traveler intent." The ticket asked whether an `occupancy_unverified` qualifier is needed and whether a guest input is a prerequisite. The code answers both (Directive 3), and the answer is *no new vocabulary and no guest input*.

3. **`lib/analytics.ts` is not a `console.debug` stub.** It is a real production sink writing to Postgres via `/api/analytics` with a session ID, `sendBeacon` delivery, and an optional external collector. A user-facing feedback surface also exists — `BookingFlow.tsx:1029-1069`, "Did the partner details match?" / "Report a mismatch" — whose reason list includes **`price_or_fees_mismatch`** (`:37`, `:44`), emitted as `hotel_handoff_return_reason_selected` (`:955`). Both the discovery and the ticket state these do not exist. They do. See Measurement.

The problem itself is unchanged and real: four surfaces render one caption for every epistemic state, and that caption is an expaify assertion sitting under provider attribution. What this brief adds is the classification, the copy, and the attribution rule.

## Current Implementation Findings

### 1. The price-basis claim is expaify's, and it is rendered under the provider's name

`HotelCard.tsx` `Price` (`:349-365`) stacks three lines directly beneath the money:

```
per night before taxes and fees      ← expaify's assertion (no adapter sets priceBasis)
Rate from {providerName}             ← provider attribution
Last-checked time unavailable        ← hardcoded, var(--warning), every offer
```

A reader parses this block top-down as one attributed unit. The first line is not attributable to the provider at all. Repeated verbatim at `HotelCard.tsx:1047` ("Price scope" panel), `app/deals/[dealId]/page.tsx:379`, and `BookingFlow.tsx:239` (`getHotelPriceBasisLabel`, rendered at `:351`, spoken at `:1014`). Four literals, one meaning, zero provenance.

The hardcoded `Last-checked time unavailable` (`:361`, `:379`) matters here beyond its own ticket: it is a warning-coloured uncertainty claim adjacent to the price. Any new cost disclosure placed in this block inherits a permanent warning neighbour and will read as contradictory (a confident "Stay total from {Provider}" sitting above an unconditional staleness warning). **Directive 5 places the disclosure outside this block for that reason.**

### 2. `nights` is available on three of four surfaces and combined with price on none

- **DealCard** — `DealCardDeal` (`DealCard.tsx:18-34`) still has no `nights` field; `grep` returns nothing. `ApiDeal.nights` exists (`app/api/deals/route.ts:24`, `:48`, `:70`, `:94`) and `DealFeed.tsx:133` declares it client-side. Unchanged since 2026-07-21 — inherited directive 1 remains unimplemented.
- **Deal detail** — `deal.nights` renders as a `Nights` fact at `page.tsx:362-363`; the price block at `:379` never references it. **Improved since prior research**: the gap is now ~17 lines, not 300+, and the section carries a stay-context sentence at `:365-368` and real freshness copy at `:381-391`. The price block is no longer the barren surface the prior brief described — which makes the missing cost class more conspicuous, not less.
- **BookingFlow** — **changed since prior research.** `BookingHotelContext` now carries `checkIn`, `checkOut`, and `nightCount` (`lib/booking/config.ts:66-68`). The prior brief's finding that this type "structurally cannot show stay length" is **obsolete**. The estimate class is reachable here today with no type change.
- **HotelCard** — no stay context in props; unchanged.

### 3. `HotelFundsPolicyEvidence` is a strong precedent, and its `not_returned` factory is the key part

`HotelFundsPolicyState = 'complete' | 'partial' | 'explicit_none' | 'not_returned' | 'conflicting'` (`lib/types.ts:255-260`), with `HotelFundsBasis` including `per_stay | per_night | per_room | per_person` (`:279-285`) and evidence carrying `sourceLabel`, `scope`, `fetchedAt`, `missingFields` (`:314-323`).

The decisive detail is `lib/providers/hotellook.ts:406`, `:534`: the adapter constructs `createNotReturnedHotelFundsPolicy('Hotellook')` — an **explicit, source-attributed "we asked and got nothing" record**, not an omitted field. `lib/hotels/fundsPolicy.ts:181-188` makes `not_returned` a first-class constructed value with a real `sourceLabel`. That is exactly the shape total-stay-cost needs, and exactly what the current `priceBasis?: ...` optional field is not: an absent optional says nothing about whether anyone asked.

`HotelFundsPolicyPanel` also already ships the two-tier surface pattern this ticket needs: `variant: 'summary' | 'full'` (`:35`, `:282-294`) and `surface: 'hotel_detail' | 'book_handoff'` (`:30`), with `summary` rendering exactly one sentence in a bordered strip. `HotelCard` uses `summary` at scan (`:916-926`) and `full` in details (`:1054-1064`).

### 4. Occupancy: a vocabulary that exists, is never populated, and cannot reach the provider

Three disconnected layers:

| Layer | Occupancy capability | Actual state |
|---|---|---|
| `HotelSearchCriteriaV1` (`lib/hotels/searchCriteria.ts:11-13`) | Full: `adults`, `children`, `childAges`, `rooms` | `'applied'` never constructed; both constructors hardcode `not_captured` |
| `HotelProvider.searchHotels` (`lib/types.ts:533-537`) | **None** — `(area, range, context?)`, and `HotelSearchContext` is a location anchor only | Cannot accept occupancy even if captured |
| `HotelOffer` (`lib/types.ts:474-494`) | **None** | Cannot declare what party the rate covers |

So even if a guest input shipped tomorrow, the value could not reach a provider or come back on an offer. **A guest input is not a prerequisite for this feature — it is insufficient for it.** Two further contract changes would be required. This confirms the ticket's instruction not to expand into the search contract, and removes any temptation to treat occupancy capture as the fix.

Analytics already reports this honestly: `occupancy_state` / `room_state` are constrained to `'applied' | 'not_captured'` (`app/api/analytics/route.ts:133`) and every call site hardcodes `not_captured` (`DealFeed.tsx:1378-1379`, `HotelSearchCriteria.tsx:42-43`, `CompareRow.tsx:131-132`).

### 5. Provider data confirms no total and no fees

`lib/providers/hotellook.ts` normalizes `priceFrom` → `pricePerNight` only (`:395`, `:412-419`, `:497`, `:514`) and sets no `priceBasis`. No `taxes`, `mandatoryFees`, `payAtProperty`, or `totalPrice` field exists in `lib/types.ts`. Amadeus/Kiwi hotel paths remain stubbed. Unchanged; `provider_total` and `partial_total` are DEV-gated.

Note the name: `priceFrom`. It is a *teaser floor*, not a quoted rate — further reason no computed multiple of it may be presented as a total.

## Reference Pattern Comparison

### Google Hotels — the derivation direction is the opposite of expaify's

Newly fetched today, and the single most useful finding in this brief. Google's rate contract requires the partner to supply, per itinerary, a **`Baserate` covering the entire stay duration**, with `Tax` and `OtherFees` itemized separately — and states: *"Specify the total cost of the stay for each itinerary, along with per-night rate. Google calculates the per-night rate for you."*

So in the reference pattern:

- The **stay total is the sourced figure**; the **per-night rate is the derived figure** (Google divides).
- A hotel price is defined as *"the lowest price for a double-occupancy room for the given itinerary"* — **occupancy is constitutive of what the price means**, fixed by contract, not optional metadata.

In expaify, both are reversed. The nightly rate is sourced (as a `priceFrom` floor), any stay total would be derived by multiplication, and no occupancy is declared at any layer. This is not a smaller version of Google's model; it is the inverse. **A computed expaify total therefore cannot inherit the authority Google's totals carry, and may never be styled as one.** It also explains precisely why Google can safely show a headline total and expaify cannot.

### Google Hotels — occupancy when guest count is unknown

Google's resolution is to **fix a default (double occupancy) and expose a control** so the user can change it; non-double rates are supported via separate rate plans. Their tax/fee policy does not address occupancy at all — because occupancy is settled upstream in the rate definition.

**expaify cannot borrow this resolution.** Defaulting is only honest when paired with a visible, changeable control that tells the user what was assumed. expaify has no such control, and `otaLinks.ts:18-21` already records the deliberate decision not to pretend a hidden default was traveler intent. Where the reference pattern *defaults and exposes*, expaify must *disclose and abstain*.

### Booking.com (carried forward, no new delta)

Prefer the total when known; state explicitly whether taxes and charges are included; never collapse charges into invented categories. Applied here as the boundary on `partial_total` copy (Directive 2): only charges the provider **names** may be named.

## Exact Gap

Current code does this:

- Asserts one price basis (`per_night_before_taxes_fees`) that no provider supplied, in four independently-maintained literals, one of which sits directly above `Rate from {provider}`.
- Holds `nights` on DealCard's data path, deal detail, and now `BookingHotelContext`, and combines it with price on none of them.
- Models "provider returned nothing" as a first-class attributed record **for deposits** (`createNotReturnedHotelFundsPolicy`) and as an **absent optional field** for price basis.
- Declares an occupancy union it never constructs, cannot send to a provider, and cannot receive on an offer — while correctly refusing to forward a fabricated occupancy to OTAs.

Reference patterns do this:

- Source the stay total and derive the nightly rate; pin occupancy in the rate definition; itemize base/tax/fees; default occupancy only alongside a visible control.

The delta this ticket owns:

expaify needs a **cost-knowledge classification** that (a) makes a provider-sourced total and an expaify-computed estimate structurally non-interchangeable, (b) states the occupancy boundary once, honestly, without implying a guest input exists, and (c) attaches provenance per class using the vocabulary the deposit surface already taught users.

## Design Directives For UXDES

### Directive 1 — Four classes. Adopt `partial`, reject `conflicting`, add the class the deposit model has no analogue for.

The ticket's three-class hypothesis is **incomplete by one and correct to exclude one**. Specify `HotelStayCostState` as exactly four members:

| Class | Meaning | Funds-policy analogue | Reachable today |
|---|---|---|---|
| `provider_total` | Provider returned a stay total covering the selected stay | `complete` | **No — DEV-gated** |
| `partial_total` | Provider returned a stay total **and named** charges it excludes | `partial` | **No — DEV-gated** |
| `expaify_estimate` | `pricePerNight × nights`, computed by expaify, nothing confirmed | **none** | Yes |
| `nightly_only` | No total derivable — nights missing/invalid, or price invalid | `not_returned` | Yes (universal today) |

**Adopt `partial_total`.** The ticket asked whether `partial` is needed given the deposit precedent. It is, and the Google evidence is why: the reference contract itemizes `Baserate` / `Tax` / `OtherFees` separately, so a provider returning a total that excludes a named charge payable at the property is a *normal* response shape, not an edge case. Collapsing it into `provider_total` reproduces the exact harm this ticket exists to fix — a number that will change, presented as a number that will not.

**Reject `conflicting`.** The deposit model needs it because multiple obligation records from different scopes can genuinely disagree and the user must ring the property to resolve it. Stay cost has **one price source per offer** (`priceFrom`); there is no second source to disagree with, so the state is not merely unreachable but unconstructible. The one future scenario that resembles it — a provider returning both a total and a nightly rate that do not reconcile — is **a DEV adapter-reconciliation rule, not a user-facing class**: the provider total is authoritative, the nightly rate is displayed as derived from it (Google's own model), and the discrepancy is logged, not surfaced. "These two numbers disagree" is not actionable for a shopper. Spec this rule so DEV does not invent a fifth state later.

`price_unavailable` stays out of the model — `HotelCard`'s existing `PriceUnavailable` (`:367-384`) is untouched per inherited directive 4.

### Directive 2 — One copy string and one attribution rule per class. The estimate carries no provider name anywhere in its visual unit.

Define one shared copy source (satisfying inherited directive 4's consolidation requirement) consumed verbatim by `DealCard`, deal detail, `HotelCard`, and `BookingFlow`. Money renders through `formatMoney`; never interpolate raw cents.

**Scan strings (one line, DealCard + HotelCard collapsed):**

| Class | String |
|---|---|
| `provider_total` | `{total} total for {n} nights · from {Provider}` |
| `partial_total` | `{total} total for {n} nights · excludes {named charges} · from {Provider}` |
| `expaify_estimate` | `Est. {subtotal} for {n} nights · before taxes and fees` |
| `nightly_only` | `{nightly} per night · stay length unavailable` |

**Detail strings (deal detail, HotelCard expanded, BookingFlow):**

- `provider_total`: `Stay total {total} for {n} nights, from {Provider}.` Append `Includes taxes and fees.` **only** when the provider states inclusion; otherwise append nothing.
- `partial_total`: `Stay total {total} for {n} nights, from {Provider}. This total excludes {named charges}, which {Provider} lists as payable separately.`
- `expaify_estimate`: `Estimated {subtotal} for {n} nights. expaify calculated this from the nightly rate; it is not a quote. Taxes and fees are not included, and no provider has confirmed a total for this stay.`
- `nightly_only`: `{nightly} per night, before taxes and fees. Stay length is unavailable, so no stay cost is shown.`

**Attribution rule — one rule, four applications:**

1. A figure a provider returned **must** carry that provider's name in the same visual unit, plus a provenance line reusing the shipped `sourceCopy` shape (`HotelFundsPolicyPanel.tsx:165-173`): `Source: {Provider} · {scope} · Checked {date}`.
2. A figure expaify computed **must not** carry a provider name, a provider logo, or a `Source:` line **anywhere inside its visual unit**. Its provenance line is: `Calculated by expaify from the nightly rate · not provider-confirmed`.
3. The nightly rate keeps `Rate from {Provider}` — it genuinely is theirs.
4. **`per night before taxes and fees` may no longer be rendered inside a provider-attributed unit**, because no provider supplies it (Finding 1). It becomes part of the class copy above, which is expaify-voiced.

**Resolving one tension with inherited directive 4.** The 2026-07-21 fallback string was `"Est. {subtotal} for {n} nights, before taxes & fees. {Provider} confirms the final total."` — a single sentence containing both an expaify figure and a provider name, which this ticket's constraint forbids. This is a **refinement, not a reopening**: split the two claims into two units. The estimate sentence stays provider-free (above); the handoff boundary sentence — `{Provider} confirms the final total before you pay.`, inherited directive 6 verbatim — moves into the CTA/handoff zone, where it describes what happens next rather than labelling the number. Both intents are preserved; only the adjacency changes.

### Directive 3 — `occupancy_unverified` is required, is **not** a new vocabulary, and is a sentence rather than a chip.

**Needed?** Yes. Without it every class overstates: an estimate for 5 nights is arithmetic about a rate that may not apply to the user's party at all, and saying "your stay" implies a match expaify has never checked.

**New vocabulary?** No — reuse the shipped `occupancy: { state: 'not_captured' }` from `HotelSearchCriteriaV1` (`lib/hotels/searchCriteria.ts:11-13`). Do not mint an `occupancy_unverified` token. Same concept, same product, one word for it; a second name would fragment the analytics enum (`'applied' | 'not_captured'`, `app/api/analytics/route.ts:133`) that already encodes it.

**Guest input a prerequisite?** **No, and it would not be sufficient** (Finding 4): capture alone cannot reach `searchHotels` or return on `HotelOffer`. Occupancy capture is a **separate DEV ticket spanning three contract changes**, explicitly outside this feature. UXDES must spec the disclosure to be correct *without* it and to degrade cleanly *with* it — the copy below is conditioned on `occupancy.state`, so the `applied` branch simply drops the sentence.

**Presentation — sentence, not qualifier chip.** Because `not_captured` is *universally* true today, rendering a per-card occupancy chip would put an identical badge on every card in the feed: pure noise at 375px, and the kind of decorative clutter the briefing forbids. Model it structurally as a field that attaches to any class, but render it as **one sentence at detail and handoff only, never at scan**:

> `expaify does not know how many guests this rate covers. Confirm it applies to your party on the provider's site.`

Cross-surface consistency requirement: this sentence must be the *only* place occupancy is discussed, and no surface may imply a party size — no "for your stay", no "your total", no pluralised guest language anywhere in the four class strings above. Note `HotelCard.tsx:763` currently says "Nightly rate ... before taxes and fees" in the review aria-label with no occupancy caveat; it must adopt the class string plus this sentence.

### Directive 4 — Mirror the funds-policy grammar structurally; diverge only on the estimate class.

**Mirror.** A traveler reading a deposit disclosure and a cost disclosure on the same card must not learn two grammars. Adopt, explicitly:

- **A first-class "not returned" constructor.** `nightly_only` must be a *constructed, source-attributed* value following `createNotReturnedHotelFundsPolicy` (`lib/hotels/fundsPolicy.ts:181-188`) — not an absent optional. This is the single most important structural carry-over: it is the difference between "we asked {Provider} and got no total" and silence. (DEV-stage; see Directive 6.)
- **`sourceLabel` + `scope` + `fetchedAt`** on every provider-sourced cost fact, rendered through the existing `sourceCopy` shape.
- **`summary` / `full` variants** and the `surface` discriminator (`HotelFundsPolicyPanel.tsx:30`, `:35`, `:282-294`) — same prop names, same one-sentence summary strip, same tone rules (`warning` treatment reserved for `partial_total` and `nightly_only`, matching `:276`).
- **`missingFields`** as the mechanism for naming what `partial_total` excludes.

**Diverge, once, deliberately.** `expaify_estimate` has **no analogue in the funds model**, because expaify never computes a deposit — every funds value is provider-sourced or explicitly absent. This is the one place the grammars must differ, and the difference must be legible: the estimate is the only class whose provenance line names *expaify* as the origin. UXDES must give it a visually distinct treatment from all provider-sourced classes (no `Source:` prefix, no provider name, subordinate weight to the nightly headline per inherited directive 2), so a UI implementer cannot render one in the other's treatment. Do **not** reuse `HotelFundsAmount`'s `kind: 'exact' | 'range' | ...` union for cost — `range` would reopen the settled no-fee-range decision.

### Directive 5 — Placement per surface, matched to attention budget.

| Surface | Treatment | Placement | Collapsible |
|---|---|---|---|
| `DealCard` (feed + landing) | Scan string, one line | Directly under the price row (`DealCard.tsx:83-98`), above `headline` | n/a — always visible |
| Deal detail | Detail string + provenance line + occupancy sentence | Inside the price block (`page.tsx:376-380`), immediately after the class line and **before** the freshness copy at `:381` | No |
| `HotelCard` collapsed | Scan string, `variant="summary"` strip | **Outside** the `Price` block — as a sibling strip next to the funds-policy summary (`:916-926`), **not** inside `Price` (`:349-365`) | n/a |
| `HotelCard` expanded | Detail string + provenance + occupancy sentence | Replaces the hardcoded `per night before taxes and fees` in the "Price scope" panel (`:1045-1051`) | Inside details |
| `BookingFlow` | Detail string + provenance + occupancy sentence + `{Provider} confirms the final total before you pay.` | Hotel summary panel (`:351`) and the pre-CTA zone | **No — must not be collapsible** |

Two placement rules carry reasoning worth preserving:

- **Keep the disclosure out of `HotelCard`'s `Price` block.** That block ends in an unconditional `Last-checked time unavailable` in `var(--warning)` (`:361`). Any cost statement placed inside inherits a permanent warning neighbour and reads as self-contradicting. Placing it beside the funds summary also puts the two money disclosures in one region, reinforcing the shared grammar of Directive 4.
- **`BookingFlow` is the only surface where non-collapsibility is mandatory**, because it is the last expaify-controlled screen. Its aria name (`:1014`) currently says "The final total may differ" with no basis; it must state the class and, when `expaify_estimate`, that the figure is expaify's arithmetic.

Deal Score guard (inherited, restated as a hard rule): no computed or provider stay total may reach `lib/scoring/scoreDeal.ts`. The detail page's `priceNoun="nightly rate"` framing (`page.tsx:391`) is correct and must be preserved verbatim; no class string may sit inside the Deal Score panel.

## Measurement Protocol

**Correction to the ticket's premise.** The ticket instructs framing two of three metrics as moderated-only because `lib/analytics.ts` is a stub and no support surface exists. Both statements are false as of today:

- `lib/analytics.ts` is a validated production sink writing to Postgres via `/api/analytics`.
- `BookingFlow.tsx:1029-1069` ships a "Report a mismatch" surface whose reasons include **`price_or_fees_mismatch`**.

The real constraint is narrower and more specific: `hotel_handoff_return_reason_selected` **is not registered in `EVENT_PROPERTIES`** (`app/api/analytics/route.ts:12-48`), and `:232` does `if (!allowedProperties) return null` → the request is rejected 400 and **the event never persists**. The surprise-cost signal is emitted by shipped UI and discarded at the API boundary.

Accordingly:

1. **Price-detail engagement** — instrumentable. The `useHotelFundsPolicyExposure` / `trackHotelFundsPolicyDetailsOpened` pattern (`app/components/hotelFundsPolicyAnalytics.ts`) is directly reusable. **Not scoped here** per ticket instruction.
2. **Stated price confidence** — genuinely not observable in-product. Moderated only. Protocol: show a participant a card for a 5-night stay for 4 guests; before any click, ask them to state (a) what their card will be charged, (b) who set that number, (c) how sure they are, 1–5. Baseline today: (a) is unanswerable from the screen at any effort, (b) is wrong (users attribute the basis line to the provider — Finding 1), (c) is uncalibrated. Target: (b) correct without opening details.
3. **Surprise-cost report rate** — **obtainable via a one-line allowlist registration**, not moderated-only. Frame it as blocked on that registration, not as absent. Until then, use the same moderated sessions.

UXDES must not write acceptance criteria that depend on any dashboard, and must not scope instrumentation into this feature.

## Acceptance Criteria For UXDES

- The spec defines exactly four classes (Directive 1), states in-line why `conflicting` is excluded, and specifies the adapter-reconciliation rule that replaces it.
- `provider_total` and `partial_total` are **fully specified and explicitly marked DEV-gated / unreachable**, so TEST does not fail the work for unimplementable states. `expaify_estimate` and `nightly_only` are marked reachable and must be implemented.
- Exact strings for all four classes at scan and detail, written once and referenced by name, consumed identically by `DealCard`, deal detail, `HotelCard`, and `BookingFlow` — replacing all four inline `per night before taxes and fees` literals (`HotelCard.tsx:359`, `:1047`, `page.tsx:379`, `BookingFlow.tsx:239`).
- The `expaify_estimate` unit contains **no provider name, no logo, and no `Source:` line**; the spec states this as a rule an implementer cannot satisfy by styling alone.
- The occupancy sentence appears at detail and handoff only, never at scan, and no class string anywhere implies a party size.
- Every state covered: default per class, nights invalid/zero/missing, price invalid, `occupancy.state === 'applied'` (sentence suppressed), loading, mobile 375px, desktop 1280px, focus/keyboard, and the screen-reader sentence for each class including `HotelCard.tsx:763` and `BookingFlow.tsx:1014`.
- At 375px, the new line on `DealCard` does not overlap hotel name, stars, `CompareRow`, or the discount chip; `HotelCard`'s summary strip does not collide with the funds-policy summary.
- No spec text places a stay total inside the Deal Score panel or implies the score reflects full-stay cost.
- UI vs DEV split is stated explicitly (Directive 6).
- No resort-fee range, anywhere (inherited directive 5, restated so DEV/TEST do not reintroduce it).

## Directive 6 — UI vs DEV split

**Reachable now, UI-stage:**

- `DealCard` — add `nights` to `DealCardDeal` and both call sites (`DealFeed.tsx` prop object, `app/page.tsx:37` `rowToCard`); render the scan string. Data already present end-to-end.
- Deal detail — render the class line in the price block from `deal.nights`, already in scope.
- `BookingFlow` — render the class line and occupancy sentence from `hotelContext.nightCount` / `checkIn` / `checkOut`, **already on the type** (`lib/booking/config.ts:66-68`). No contract change needed; the prior brief's claim otherwise is obsolete.
- Consolidate the four disclaimer literals into the shared copy source.

**DEV-stage (contract changes — do not attempt in UI):**

- Replace `priceBasis?: 'per_night_before_taxes_fees'` with a constructed cost-evidence value carrying `state`, `sourceLabel`, `scope`, `fetchedAt`, `missingFields`, mirroring `HotelFundsPolicyEvidence`, plus a `createNotReturnedHotelStayCost(sourceLabel)` factory (Directive 4). Note `lib/booking/config.ts:956`'s `?? 'per_night_before_taxes_fees'` default and `app/api/analytics/route.ts:176`'s literal validator must be migrated together.
- Any provider total/fee fields, and the adapter reconciliation rule from Directive 1 — gates `provider_total` and `partial_total`.
- Occupancy capture — three contract changes (`HotelSearchCriteriaV1` producer, `searchHotels` signature, `HotelOffer` field). **Separate ticket. Not a prerequisite for this feature.**
- Registering `hotel_handoff_return_reason_selected` in `EVENT_PROPERTIES`. **Separate ticket.**

`HotelCard` remains unreachable from any route (`grep` for imports returns only its own file and tests), so its changes are correctness-for-when-reconnected; `DealCard`, deal detail, and `BookingFlow` (reachable via `app/book/page.tsx`) are live. Sequence: DealCard → deal detail → BookingFlow → HotelCard.

## Out Of Scope Findings

- **`hotel_handoff_return_reason_selected` is emitted but silently rejected** (`BookingFlow.tsx:955` vs `app/api/analytics/route.ts:12-48`, `:232`). Shipped UI collecting `price_or_fees_mismatch` whose data never lands. Flagged, not fixed — instrumentation is explicitly out of scope. Worth its own P1.
- **`Last-checked time unavailable` hardcoded in `var(--warning)`** at `HotelCard.tsx:361`, `:379` for every offer. Owned by `docs/pipeline/hotel-price-freshness/`. Not fixed here; Directive 5 routes around it.
- **`HotelSearchCriteriaV1.occupancy`'s `'applied'` variant is dead code** — declared, never constructed. Either a producer ships or the variant should be removed; leaving a populated-looking union that is never populated invites a future implementer to assume occupancy is available. Not this ticket's call.
- **`HotelCard` unreachable from any route** — pre-existing navigation gap, unchanged since 2026-07-21.
- **Prior-brief claims now obsolete**, corrected above so downstream stages do not inherit them: `BookingHotelContext` has no nights field (it does); `CompareRow` fires zero analytics (it fires `hotel_provider_handoff_clicked`, `:123-133`); `lib/analytics.ts` is a `console.debug` stub (it is a Postgres sink).
- **Flight-side `FarePriceScope = 'per_person' | 'party_total'`** (`lib/types.ts:4`) remains the internal precedent for occupancy-aware price scope. Cited, not touched.

## Handoff

Next ticket: `UXDES-HOTEL-TOTAL-STAY-COST-01` — UX Design: total hotel stay cost confidence. Input: this brief. Output: `docs/pipeline/hotel-total-stay-cost/03-design.md`.

Sources: [Google Hotel Prices pricing overview](https://developers.google.com/hotels/hotel-prices/dev-guide/updating-prices) · [Google Hotel price tax and fee policy](https://support.google.com/hotelprices/answer/6064432) · [Google Hotel Center preview/validate (occupancy defaults)](https://support.google.com/hotelprices/answer/9144476?hl=en)
