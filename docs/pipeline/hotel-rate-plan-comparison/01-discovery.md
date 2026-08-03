# UXD-HOTEL-RATE-PLAN-COMPARISON-01 — Hotel rate-plan comparison clarity

**Stage:** UX Discovery · **Priority:** P0 · **Date:** 2026-08-03
**Persona:** Senior UX Strategist
**Surfaces inspected:** `app/deals/[dealId]/page.tsx`, `app/book/BookingFlow.tsx`, `app/components/HotelCard.tsx`, `lib/providers/hotellook.ts`, `lib/hotels/rateEligibility.ts`, `app/api/analytics/route.ts`

---

## 0. Two conflicts with the ticket as written — read first

This discovery does not proceed as the ticket describes, because two of the ticket's premises are contradicted by the code. Both are reported rather than guessed around, per the briefing's conflict rule. The rest of the brief is scoped to what remains genuinely unowned and genuinely knowable.

### 0.1 Scope collision with `docs/pipeline/hotel-cancellation-flexibility/`

The ticket carves itself out from `UXD-HOTEL-CANCELLATION-POLICY-01` (`docs/pipeline/cancellation-policy/`). That carve-out is correct but incomplete. A **third** pipeline already owns the pre-selection refundable-versus-non-refundable tradeoff, and it is further along than this ticket:

> "The exact decision moment this ticket owns is: **'Should I pay more for the flexible option, or accept the cheaper restriction?'**"
> — `docs/pipeline/hotel-cancellation-flexibility/01-discovery.md`

> "The future comparison answers one question: **'For the same stay and room, what is the total extra cost of the provider-stated cancellation flexibility?'**"
> — `docs/pipeline/hotel-cancellation-flexibility/03-design.md` §1

That pipeline has shipped a discovery, a research brief, **and an implementation-ready design spec** containing the strict like-for-like eligibility gate (§2), the two-rate radio-card selector (§4.3), partial/stale/conflicting states (§5), responsive specs (§8), copy system (§9), and an analytics contract (§11). The refundable-vs-non-refundable comparison UI described in this ticket is already specified there, down to the copy.

**Directive:** downstream stages must not re-specify the two-rate comparison component. `docs/pipeline/hotel-cancellation-flexibility/03-design.md` is the governing spec for that artifact. Re-designing it would produce two competing contracts for one surface.

**What is left unowned** is narrower and is what this brief scopes: the flexibility pipeline defined *what the comparison looks like when it is eligible to render*, and deliberately gated it behind a provider contract that does not exist (§0, §13). It did not answer the question this ticket actually asks — **how do we find out whether this problem is real and how big it is, before the provider contract lands?** That is a measurement problem, and it is the deliverable here.

### 0.2 The ticket's proposed signal cannot be measured

The ticket asks for a brief "quantifying how often multiple rate plans exist per room and how often users select without apparent comparison," using "the rate of post-booking 'I didn't know it was non-refundable' support contacts." Neither quantity is observable in this system. Not "not yet instrumented" — **not observable in principle**, for three structural reasons:

1. **expaify never receives more than one rate per property.** `HotelLookCacheEntry` (`lib/providers/hotellook.ts:23-38`) carries `hotelId`, `hotelName`, `stars`, `location`, `address`, `distance`, `priceFrom`, `photoUrl`, `propertyType`. One `priceFrom` per property. No room array, no rate array, no `rateId`, no refundability field. The adapter hard-declares `rateEligibilityCapability: HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` (`lib/providers/hotellook.ts:409,540`), which sets `refundability: false` (`lib/hotels/rateEligibility.ts:16-21`). **The denominator "rate plans per room" is always 1 in every response expaify has ever seen.** It cannot be counted higher without a different supplier contract.

2. **Rate selection happens off-platform, after handoff.** expaify does not take hotel bookings. The terminal internal screen is "Check rooms with provider" (`app/book/BookingFlow.tsx:1173`), whose body reads: *"The provider shows room options, live availability, its final price, cancellation policy, and terms."* Deal detail says the same (`app/deals/[dealId]/page.tsx:392`, `:449`). The user picks a rate plan on the partner's site. expaify has no post-handoff telemetry, so "users select without apparent comparison" has no event to count.

3. **There are no post-booking support contacts.** With no booking of record and no support channel in the product, the ticket's primary proposed signal has no source. Sizing the problem from support volume is not a measurement expaify can run.

**Consequence:** the ticket's success criterion as written is unachievable, and any brief that reported those numbers would be fabricating them. This brief therefore redefines the deliverable as: *identify the one signal expaify can actually collect today, and specify it precisely enough to build.* That signal exists and is cheap — see §4.

---

## 1. Pain point

**A guest cannot see that a cheaper hotel price is cheaper *because it is non-refundable*, because expaify shows exactly one anonymous "Observed nightly rate" per property with no rate-plan dimension at all — so the tradeoff the guest is unknowingly accepting is first revealed on the partner's site, after expaify has already spent its Deal Score credibility recommending the price.**

The failure is not a bad comparison. It is the **absence of the comparison axis**: expaify's price object has no rate-plan identity, so there is nothing for the guest to compare against and no way for them to know a choice was ever available.

The trust consequence is specific to expaify's differentiator. The Deal Score at `app/deals/[dealId]/page.tsx:244` scores a "nightly rate" and calls it *Great* — but a non-refundable rate is *supposed* to sit low in a price distribution. A refundability-blind Deal Score can therefore certify a restricted rate as an unusually good price when the discount is simply the price of the restriction. That is a scoring-integrity problem, not only a disclosure problem, and it is the strongest argument for prioritizing this work.

## 2. Who is affected, and where

**Who:** every hotel booker, with cost concentrated on guests whose plans are uncertain — travelers awaiting leave approval, families coordinating schedules, anyone booking far enough ahead that a non-refundable discount carries real downside. Price-led users are the most exposed, because the cheapest rate is the one expaify surfaces and scores, and the cheapest rate is disproportionately the restricted one.

**Where, in flow order:**

| Step | Surface | What is shown today | What is missing |
|---|---|---|---|
| Results | `app/components/HotelCard.tsx` | One `priceFrom`-derived nightly price; generic rate-restriction line (`app/components/HotelRateRestrictions.tsx:108`) | No rate-plan identity on the price the user is comparing across properties |
| Deal detail | `app/deals/[dealId]/page.tsx:401-404` | "Observed nightly rate" / "Rate observed from a booking partner." + Deal Score | No indication that this price belongs to *a* rate plan among several, refundable or not |
| Handoff | `app/book/BookingFlow.tsx:1173-1175` | "Check rooms with provider" / provider "shows room options … cancellation policy, and terms" | The rate-plan choice is named as the provider's job and deferred; the guest crosses the boundary with no framing for the decision awaiting them |

**The exact decision moment this ticket owns:** the instant *before* the guest leaves expaify — where they either do or do not know that a refundable alternative to the price they were shown may exist. This is upstream of `hotel-cancellation-flexibility`'s moment (choosing *between* two known rates) and upstream of `hotel-cancellation-clarity`'s moment (understanding the terms of *one selected* rate).

## 3. Measurable signal that the problem exists

Two signals are already provable from source. The third is the one to build.

**Signal A — the comparison axis is structurally absent (proven, no instrumentation needed).**
`lib/providers/hotellook.ts:23-38` exposes a single `priceFrom` per property and no rate collection. `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` (`lib/hotels/rateEligibility.ts:16-21`) sets `refundability: false` for every live offer. **Rate plans per room, as observed by expaify today: exactly 1, in 100% of responses.** The problem is not that comparison is done badly; it is that comparison is impossible, and the product does not admit this to the guest.

**Signal B — expaify verbally concedes the gap on every hotel, to every user (proven).**
"The provider shows room options, live availability, its final price, cancellation policy, and terms" (`app/book/BookingFlow.tsx:1175`) renders on every hotel handoff. The rate-plan decision is named and handed away on 100% of hotel sessions that reach handoff.

**Signal C — the one collectable signal, and it is currently blind to this problem.**
expaify already runs a post-handoff self-report: the guest returns from the partner and selects why the partner's page did not match, emitted as `hotel_handoff_return_reason_selected` with `handoffAttemptId`, `priceDisclosureState`, `reason` (`app/api/analytics/route.ts:41,93`; UI at `app/book/BookingFlow.tsx:936-1041`). The reason enum (`app/book/BookingFlow.tsx:55-75`) covers smoking/room mismatch, tax changes, mandatory charges, total mismatch, pay-at-property, room availability, loyalty uncertainty, other, prefer-not-to-say.

**There is no refundability or rate-plan reason in that enum.** A guest who reaches the partner, discovers the expaify price was a non-refundable rate, and comes back has no accurate way to say so — they are funnelled into `displayed_total_other_mismatch` or `other_hotel_details_mismatch`, where the cause is unrecoverable.

**This is the sizing instrument, and it is a one-enum-value change.** Add a rate-plan reason (proposed value `rate_plan_or_refundability_mismatch`, proposed label *"The rate's refund terms were not what I expected"*) to `HotelReturnReason`, `HOTEL_RETURN_REASONS`, and the analytics allowlist at `app/api/analytics/route.ts:158-160`. Its selection share among returning users, segmented by `priceDisclosureState`, is the first honest measurement of this problem expaify can obtain — and unlike the ticket's proposed signals, it requires no new supplier contract, no booking system, and no post-handoff tracking of the partner.

**Baseline to record before any UI work:** current share of `other_hotel_details_mismatch` + `displayed_total_other_mismatch` among all `hotel_handoff_return_reason_selected` events. Post-change, the volume that migrates into the new reason is the previously invisible size of this problem.

## 4. Constraints the solution must respect

1. **Provider truth only — no inferred refundability.** Every external call goes through `lib/providers`; adapters return `Result<T>` and never throw. Hotellook supplies no refundability, so no surface may state or imply that the shown rate is refundable, non-refundable, or that a refundable alternative exists at a given price. The existing capability gate (`HOTEL_RATE_ELIGIBILITY_UNSUPPORTED`) is the correct fail-closed default and must not be loosened to make a comparison renderable. Naming an unknown is permitted; asserting a fact is not.

2. **Do not duplicate or contradict the governing comparison spec.** `docs/pipeline/hotel-cancellation-flexibility/03-design.md` owns the populated two-rate comparison, its like-for-like eligibility gate, and its release gates. Anything this pipeline produces must either (a) instrument, or (b) honestly disclose absence — never render a second, weaker comparison component. Overlap with `hotel-cancellation-clarity` (deadlines, penalties, no-show) and `cancellation-policy` (superseded) is likewise out of bounds.

3. **Repair-mode discipline and existing contracts.** Money stays `{ priceCents, currency }` in integer minor units — any future rate-plan delta is a `Money` difference, never a float or a bare number, and nightly `priceFrom` is not a valid basis for a stay-total comparison. Affiliate markers stay attached to outbound deeplinks. Usable at 375px and 1280px with no overlapping text and no added decorative clutter. No new feature may be introduced under this ticket: the analytics reason value in §3 is instrumentation of an existing control, and the disclosure work is repair of an existing silence.

## 5. Success statement

**This is solved when a first-time user can leave expaify for the booking partner knowing whether the price expaify scored is tied to a specific rate plan — and when expaify can measure how often that ignorance costs the user something — without expaify ever asserting a refundability fact that no provider supplied.**

Concretely, in two independently shippable parts:

- **Measurement (shippable now, no provider dependency):** `hotel_handoff_return_reason_selected` can distinguish a rate-plan/refundability mismatch from a generic "other" mismatch, and a pre-change baseline of the two "other" reasons has been recorded for comparison.
- **Disclosure (shippable now, no provider dependency):** at the handoff boundary, the guest is told plainly that the observed price reflects one rate the partner published, that the partner may offer other rates for the same room with different refund terms, and that refund terms are set at the rate level — stated as a known limit of expaify's data, not as a claim about any specific rate.

The populated comparison itself remains blocked on the supplier contract defined in `docs/pipeline/hotel-cancellation-flexibility/03-design.md` §13, and this pipeline does not attempt to unblock it.

## 6. Open questions for UXR

1. Does any candidate hotel supplier under consideration (Amadeus Hotel Search, Duffel Stays, or an affiliate feed richer than Hotellook `cache.json`) return multiple rate plans per room with a stable `rateId` and rate-scoped refundability? If none does, §5's disclosure half is the entire realistic near-term scope, and that should be stated plainly rather than left implied.
2. How do Booking.com and Google Hotels frame rate-plan choice *at the moment of leaving a metasearch surface*, as opposed to inside their own booking funnel? The reference pattern for a handoff product is narrower than the reference pattern for a booking product, and the existing comparison specs were drawn from the latter.
3. Does the refundability-blind Deal Score (§1) warrant its own ticket? Scoring a restricted rate as *Great* against a mixed-rate-plan price history is a scoring-integrity issue that sits in `lib/scoring/`, outside this pipeline's UI-and-instrumentation scope. UXR should confirm whether route/property baselines mix rate plans, and escalate separately if so.
4. Is `hotel_handoff_return_reason_selected` volume sufficient for the §3 signal to reach significance in a reasonable window? If not, UXR should identify what additional in-flow instrumentation (handoff-boundary disclosure impressions, for example) would supplement it without tracking the user off-platform.
