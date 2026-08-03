# UXD-HOTEL-CANCELLATION-POLICY-01 — Hotel Cancellation Policy Clarity

**Stage:** UX Discovery · **Priority:** P1 · **Flow:** deal feed card → deal detail page
**Scope of this ticket:** define the cancellation-policy *state space* — which states exist across expaify's hotel providers, which are common enough to design for, and what evidence backs each — under the constraint that no new provider integration may be added.

---

## Relationship to prior cancellation work

Three prior doc sets touch cancellation. This brief does not restate them; it answers the one question none of them settled.

| Doc set | Question it owned | Status |
|---|---|---|
| `docs/pipeline/cancellation-policy/` | Cancellation is absent everywhere | Stale (written before any refund signal existed) |
| `docs/pipeline/hotel-cancellation-clarity/` | Deadline / late-cancel charge / no-show are not expressible | Discovery + research only; nothing shipped to the live surfaces |
| `docs/pipeline/hotel-cancellation-flexibility/` | Comparing a cheap restricted rate vs. a flexible rate | Reached design; shipped exactly one artifact — a static "unavailable" panel (below) |
| **This brief** | **What cancellation states can expaify actually source today, and how confident is each?** | New |

The prior work established *what travelers need*. It assumed downstream stages could decide later what providers supply. That assumption is the gap: no one has enumerated the provider-side state space, so every design so far has specified fields no adapter can populate.

---

## Problem statement

**A traveler scanning expaify hotel deals cannot tell whether an offer is free-cancellation, non-refundable, or refundable only until a deadline — because expaify's hotel adapters map no cancellation field of any kind, so the product has exactly one sourceable state ("not provided") and shows the traveler either nothing (feed card) or a static unavailability notice (detail page).**

The traveler's two failure modes are the two the ticket names, and they are opposite: some avoid booking through expaify because refund risk is unknown at the moment of comparison, and some proceed assuming flexibility that the rate never carried and get charged.

---

## Who is affected, and where

Every hotel booker, concentrated in travelers with unsettled plans — the segment for whom cancellation terms decide the booking, not decorate it.

| # | Flow step | Source | What the traveler sees today |
|---|---|---|---|
| 1 | **Deal feed card** | `app/deals/DealFeed.tsx` | Nothing. No cancellation, refund, deadline, or no-show string exists in the file (grep-verified; the only `cancel` match is `window.cancelAnimationFrame`, `DealFeed.tsx:1451`). |
| 2 | **Deal detail page** | `app/deals/[dealId]/page.tsx:423` | One static panel: heading **"Cancellation choices unavailable"**, body *"Cancellation choices are not available for this observed price. Compare room rates and cancellation terms with the booking partner."* It is rendered unconditionally — the component (`app/components/HotelCancellationChoicesUnavailable.tsx`) takes only a `headingLevel` prop, reads no offer data, and has no other branch. |
| 3 | **Booking handoff** | `app/book/BookingFlow.tsx:1225` → `HotelRateRestrictionsSection` | The one place refundability is *nameable*, as a chip inside a rate-restrictions panel. This is the last screen before the traveler leaves expaify. |

**The one refundability signal in the codebase is not mounted on any live surface.** `HotelCardEligibilityLine` — the component that renders the `Non-refundable` chip on a card (`HotelRateRestrictions.tsx:118`, used at `HotelCard.tsx:998`) — lives inside `HotelCard`, and `HotelCard` is rendered by nothing in the running app. Its only importers are itself, `HotelRateRestrictions.tsx`, and `app/components/research/HotelHousekeepingResearchHarness.tsx`. Any design that assumes "the card already shows non-refundable" is designing against a component the traveler never sees.

The decision to click through happens at step 1 or 2. The only cancellation vocabulary the product owns lives at step 3.

---

## Measurable signal that the problem exists

### Signal 1 — Every hotel adapter declares refundability unsupported

All three hotel adapters set the same constant:

- `lib/providers/bookingComHotelsRapidApi.ts:197` → `rateEligibilityCapability: HOTEL_RATE_ELIGIBILITY_UNSUPPORTED`
- `lib/providers/hotelbeds.ts:278` → same
- `lib/providers/hotellook.ts:409`, `:540` → same (dead API)

`HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` (`lib/hotels/rateEligibility.ts:20`) sets `refundability: false`, which by the type's own doc comment (`lib/types.ts:597`) means the adapter's contract *cannot* return `restricted` or `clear` for that family. The live hotel path is Booking.com via RapidAPI (`app/api/search/route.ts:178`, single provider, no fallback chain). **On the live path, refundability capability is false. There is no code path by which a traveler can see "Non-refundable" or "Free cancellation" today.**

### Signal 2 — The type system cannot carry a deadline, a charge, or a no-show term

`HotelOffer` (`lib/types.ts`) has no cancellation field. The only refund-adjacent field is `rateEligibility.refundability: HotelRateFamilyEvidence` (`lib/types.ts:594`), whose optional qualifiers are `membershipLabel`, `residencyPlace`, `minAge`, `maxAge` — all owned by other families. Refundability is the only family with no qualifier slot. Worse, `lib/hotels/rateEligibility.ts:57` discards anything a supplier attached:

```ts
if (family === 'refundability') return { state: 'restricted' };
```

and the label is a hardcoded constant `'Non-refundable'` (`rateEligibility.ts:82`). Even a provider that returned "free until 3 Aug, then one night" has nowhere to put the date or the amount. `no-show` appears nowhere in the codebase.

### Signal 3 — One adapter already sees a refundability field and drops it

`lib/providers/hotelbeds.ts:29` declares `rateClass?: string` on its `HotelbedsRate` interface — Hotelbeds' refundable-vs-non-refundable rate classification. Only `net` is read (`:90–92`). `rateClass` is parsed into the type and never used. This is the single strongest in-repo evidence that at least one binary cancellation state is **already inside a provider response** and is being discarded at the adapter boundary. Hotelbeds is not the live provider, so this is a capability signal, not a shippable one.

### Signal 4 — The ticket's named outcome metrics are not instrumentable today

The ticket cites "support/complaint mentions of unexpected cancellation fees" and "abandonment after opening rate-rules text" as the signals. Neither exists as product telemetry:

- The analytics allowlist (`app/api/analytics/route.ts:14–52`) has ~40 `hotel_*` events. None records cancellation-policy exposure, policy expansion, or a policy-driven exit. `hotel_funds_policy_*` covers deposits and card holds — a different obligation, not cancellation.
- "Opening rate-rules text" is not an interaction that exists: the only rate-rules surface (`HotelRateRestrictionsSection`) is on the handoff screen and is not expandable-with-event.
- Support/complaint volume is not in this repo and cannot be joined to a deal or rate.

UXR must treat both named metrics as **hypothesised, not baselined**, and specify the event contract rather than quote a number. The surrounding funnel that *does* exist (`hotel_detail_viewed`, `hotel_provider_handoff_clicked`, `hotel_handoff_returned`, `hotel_handoff_back_clicked`, `hotel_handoff_return_reason_selected`) is the only usable before/after frame.

---

## The state space (this ticket's core deliverable)

Cancellation is not one binary. Across hotel supply it decomposes into four **independent** dimensions; collapsing them is what produced today's single misleading chip.

- **D1 Refundability class** — is any refund possible at all?
- **D2 Deadline** — the instant free (or partial) cancellation ends, in a stated timezone.
- **D3 Post-deadline consequence** — what is charged: a fixed amount, N nights, a percentage, or the full stay.
- **D4 No-show consequence** — what is charged if the traveler never arrives and never cancels. Often differs from D3.

### Candidate states, with the evidence tier backing each

Evidence tiers are deliberate: **A** = verifiable in this repo today; **B** = a field is visible at the adapter boundary but unmapped, verifiable by capturing one live payload; **C** = plausible from general hotel-supply knowledge, unverified against expaify's actual providers — must not be designed for until UXR promotes it.

| State | Dimensions carried | Evidence tier | Backing |
|---|---|---|---|
| **S0 · Not provided** | none | **A — certain** | All three adapters set `refundability: false` capability. Live path is Booking.com RapidAPI, whose mapped `HotelProperty` interface (`bookingComHotelsRapidApi.ts:34–45`) contains name, coords, review score/count, propertyClass, photos, wishlistName, priceBreakdown — and no policy field. This is the *only* state expaify can source today. |
| **S1 · Non-refundable (binary)** | D1 | **B — one payload capture away** | `HotelbedsRate.rateClass` is declared and discarded (`hotelbeds.ts:29`, `:90`). Non-live provider, so shippable only if the live provider exposes an equivalent. |
| **S2 · Free cancellation, no deadline stated** | D1 | **B** | Requires confirming the live provider returns an affirmative free-cancellation flag. Critical failure mode: absence of a non-refundable flag is **not** evidence of free cancellation, and must never be rendered as such. |
| **S3 · Free until a stated deadline, then a stated charge** | D1+D2+D3 | **C — unverified** | The state travelers most need and the one with the highest evidence bar: requires a deadline instant, a timezone, and a charge in `{ priceCents, currency }`. Nothing in the repo can express or receive it. |
| **S4 · Partial refund / tiered schedule** | D1+D2+D3 (multi-tier) | **C — unverified** | Multiple deadline/charge pairs. Assume out of scope for v1 unless UXR finds it common in captured payloads. |
| **S5 · No-show term distinct from cancellation term** | D4 | **C — unverified** | `no-show` appears nowhere in the codebase. Named here so it is not silently folded into S3. |
| **S6 · Conflicting / stale evidence** | any | **A — structurally required** | The repo's own evidence patterns (`HotelSmokingDimension.isStale`, `HotelFundsPolicyEvidence.conflictingRecords`, offerId/supplier mismatch degradation at `lib/types.ts:588`) establish that any policy evidence must model conflict and staleness. Cancellation must fail closed to S0 on mismatch. |

### Which states are common enough to design for

On today's evidence, honestly: **S0 and S6 only.**

That is the finding, not a hedge. The ticket constrains the solution to "cancellation data already returned by existing hotel providers." Applied strictly to the live path, that set is empty, and the correct v1 is a *truthful absence* state — which the detail page already gestures at with an unconditional panel that is right by accident and would stay on screen even if real data arrived.

The productive scope is therefore two-part:

1. **Now (Tier A, no new integration):** replace an unconditional static panel with a real, offer-derived S0/S6 state that names *which* provider did not supply cancellation terms and *when* that was checked — consistent with how the funds-policy and smoking-policy surfaces already handle absence — and extend it to the feed card, which says nothing at all today.
2. **Next (Tier B, gated on evidence):** promote S1/S2 only after a captured live-provider payload proves the field exists. Promotion is a UXR/DEV task, not a design assumption.

S3–S5 are named so downstream stages model the type space once, rather than shipping a binary that has to be torn out later.

---

## Constraints the solution must respect

1. **Provider-sourced or explicitly absent — never inferred.** A cancellation claim is renderable only when a provider adapter attached it to the same offer (`offerId` + `supplier` must match, degrading to `not_provided` on mismatch, per `lib/types.ts:588`). Silence is never "free cancellation." No refund arithmetic, no paraphrase of provider terms — the ticket's no-legal/financial-advice constraint means expaify reports what a provider said and attributes it, and never tells a traveler what they are owed.
2. **Contract integrity.** All provider access stays behind `lib/providers` returning `Result<T>`, never throwing. Any charge amount is `{ priceCents: number; currency: string }` — never a float, never a bare number. Deadlines carry an explicit timezone or are treated as not provided; a wrong-timezone deadline is worse than no deadline. No new provider integration is in scope.
3. **Trust and reach before density.** The state must be legible at a glance on a feed card and complete on the detail page, usable at 375px and 1280px, distinguishable without colour alone, keyboard- and screen-reader-reachable, and must not add decorative clutter to a card that is already dense. An absence state must read as informative, not as a warning about the hotel.

---

## Success statement

**This is solved when a first-time user scanning the hotel deal feed can tell, on every card and before opening anything, which of expaify's known cancellation states applies to that offer — and on the detail page can see either the provider's stated terms with attribution and a checked-at time, or a clear statement that this provider did not supply cancellation terms and where to get them — without ever being shown a cancellation claim expaify cannot source, and without discovering the terms for the first time on the handoff screen.**

---

## Handoff to UXR

`UXR-HOTEL-CANCELLATION-POLICY-01` must validate this brief with target users **and** close its evidence gaps. Specifically:

1. **Promote or kill S1/S2.** Capture one live Booking.com RapidAPI hotel-search payload and one Hotelbeds availability payload; record verbatim which cancellation fields are present. Tier B becomes Tier A or is struck.
2. **Test the absence state.** Does "this provider did not supply cancellation terms" read as honest, or as expaify being broken? Compare against the current unconditional panel copy.
3. **Rank the four dimensions** by decision weight with travelers who have unsettled plans — if D2 (deadline) dominates D1 (class), a binary refundable/non-refundable v1 is a false win.
4. **Confirm the no-show gap (S5)** matters to real users before it earns a type.
5. **Define the event contract** for cancellation exposure and policy-driven exit, since neither named metric is instrumentable today.

---

## Conflict flagged for the record

The ticket's constraint — *"must rely on cancellation data already returned by existing hotel providers (no new provider integration)"* — presupposes such data exists. It does not, on the live path. Every hotel adapter declares refundability unsupported, and the live provider's mapped response has no policy field. This brief does not treat that as blocking: the state space is delivered in full, and the honest v1 (a real, attributed absence state on both surfaces) fits inside the constraint. But any downstream stage that specifies a deadline, a charge, or a no-show term must first clear step 1 of the UXR handoff. Designing S3 on today's evidence would ship a field no adapter can fill.
