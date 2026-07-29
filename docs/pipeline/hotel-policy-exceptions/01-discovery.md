# UXD-HOTEL-POLICY-EXCEPTIONS-01: Hotel Policy Exception Visibility — Discovery

Date: 2026-07-29
Stage: UX Discovery (UXD)
Persona: Senior UX Strategist
Priority: P1
Feature slug: `hotel-policy-exceptions`

---

## 1. Pain point

A traveler can complete an expaify hotel evaluation, hand off to the booking partner, and pay — without ever being told that the property will **refuse to check them in**, because expaify surfaces no property-level admission rule (minimum check-in age, required identification and payment instrument in the guest's name, local-resident or registration restrictions, who-may-occupy limits), and nothing in the current data model can even carry one.

The failure is not "I didn't know a detail." It is **paying for a room you are not permitted to occupy** — and discovering it at a front desk, at night, in a city you just arrived in, holding a non-refundable rate.

---

## 2. Who is affected, and where in the flow

**Population — the traveler who is not the default guest the industry assumes.** Concretely:

- **Travelers aged 18–24.** US properties commonly set a 21+ check-in minimum (some 25+); much of Europe and Asia sets 18. A 19-year-old booking a US road trip is the single highest-frequency, highest-severity case.
- **Travelers paying with someone else's card, a virtual card, a debit card, or cash.** Many properties require a physical credit card in the *registering guest's* name at check-in. Company-booked, parent-booked, and prepaid-gift stays fail here.
- **Travelers booking in their own city, or in markets with resident-registration rules.** Some properties and some markets bar local residents outright, or require a specific national/local ID at registration that a foreign passport does not satisfy (and vice versa).
- **Groups, families, and unmarried couples** hitting per-room occupancy admission limits, adults-only properties, or local marital-status registration rules.

**Where in the flow** — the decision path is `search → results scan → expanded hotel detail → "Check rooms with provider" handoff`. The shipped decision order (`docs/pipeline/hotel-detail-decision-order/03-design.md`) is: (1) property and stay, (2) price and Deal Score, (3) hotel fit, (4) check rooms with provider, (5) supporting evidence.

**Section 3, "hotel fit", is the affected surface, and section 4 is the deadline.** Once the traveler crosses the handoff, expaify has no further chance to tell them anything — the partner site owns the rest, and on most partner sites these rules live below the fold of a room-detail accordion the traveler has no reason to open.

**What the code actually establishes today (verified, not assumed):**

- `HotelOffer` (`lib/types.ts:472–493`) carries identity, location, stars, price, ratings, `documentReadiness`, `amenityEvidence`, `accessEvidenceState`, `fundsPolicy`, `smokingPolicy`, `rateEligibility`, `rateEligibilityCapability`. **There is no field for any property-level admission rule.**
- The expanded card (`app/components/HotelCard.tsx:990–1060`) renders Deal Score, quality evidence, parking, pet policy, smoking policy, access/room requests, and funds policy. **No panel owns admission eligibility.**
- `HotelDocumentType` (`lib/types.ts:208`) is `'invoice' | 'receipt' | 'booking_confirmation'` — documents the traveler *receives*. Nothing models documents the traveler must *present*.
- Neither hotel provider maps a policy field: `lib/providers/hotellook.ts` normalizes price, location, hotel class, guest rating only; `lib/providers/bookingComRapidApi.ts` contains no policy, check-in, age, or document mapping at all.

So 100% of admission-eligibility risk is currently invisible on expaify, and the data layer cannot express it even if a provider returned it.

---

## 3. Boundary — what this ticket does NOT own

This surface is crowded with shipped work. Downstream stages **must not re-open, re-derive, or duplicate** any of the following. Each row is settled.

| Concern | Owner — do not touch |
|---|---|
| Cancellation, refundability, no-show terms | `docs/pipeline/cancellation-policy/`, `hotel-cancellation-clarity/` |
| Deposits, incidental holds, funds obligations | `HotelFundsPolicyPanel.tsx`, `HotelFundsPolicyEvidence` |
| Pets / service animals | `HotelPetPolicy.tsx`, `hotel-pet-policy-fit/` |
| Smoking | `SmokingPolicyPanel.tsx`, `HotelSmokingPolicy` |
| Accessibility features, step-free route, elevator, room requests | `accessibility-stay-fit/`, `hotel-access-requirements/`, `AccessEvidencePanel` |
| Loyalty program benefit eligibility | `HotelLoyaltyEligibility.tsx`, `hotel-loyalty-benefit-eligibility/` |
| Parking | `HotelParking.tsx`, `HotelParkingEvidence` |
| Check-in window, front-desk hours, late arrival, checkout time | `hotel-checkin-logistics/` — the **temporal** slice |
| Invoice / receipt / confirmation issuance | `HotelDocumentReadiness.tsx`, `hotel-invoice-readiness/` |
| Total stay cost, taxes, fees | `hotel-total-stay-cost/`, `total-stay-cost/` |

### The two boundaries that will be argued, resolved here

**(a) vs. `rate-eligibility` (`lib/hotels/rateEligibility.ts`, `HotelRateRestrictions.tsx`).** That work ships four families — `residency`, `age`, `membership`, `refundability` — and `minAge`/`maxAge` already exist in `HotelRateFamilyEvidence` (`lib/types.ts:443–453`). This looks like duplication. It is not.

> **Rate eligibility answers: "may you *book this discounted rate*?"** It is a **pricing qualifier** attached to one rate. A 20-year-old failing an `age` rate qualifier sees a different price, or that rate disappears. Nothing about the stay breaks.
>
> **This ticket answers: "may you *occupy the room*?"** It is a **property admission rule** that applies to every rate at the property. A 20-year-old failing a property minimum check-in age is turned away at the desk having already paid.

Same word ("age", "residency"), different scope, different consequence, different failure mode. **Directive for UXR:** confirm this split against the code, and specify the reuse — the new evidence type must sit at `scope: 'property'`, must not overload `HotelRateFamilyEvidence`, and must not render inside `HotelRateRestrictions`. If UXR concludes the two genuinely cannot be separated in the UI, that is a **conflict to report, not to absorb.**

**(b) vs. `hotel-checkin-logistics`.** That ticket owns *when* you can check in (window, desk hours, late arrival, checkout). This ticket owns *whether you are allowed to* (age, ID, residency, occupancy). Temporal vs. eligibility. Both may end up in adjacent panels; neither may restate the other's fields.

---

## 4. Measurable signal that the problem exists

Four signals, all measurable from the current codebase or from instrumentation that already exists (`HotelDecisionAnalytics.tsx`, `app/api/analytics`):

1. **Structural absence — already provable, zero instrumentation needed.** `grep -rniE "minimum.?age|checkInAge|government.?id|photo id|house rules|local resident" lib/ app/` returns **zero product-code matches** outside `rateEligibility`'s rate-scoped `minAge`. Two hotel adapters, zero policy fields, zero panels. The disclosure rate for property admission rules on expaify is exactly **0%**.

2. **Late-stage policy surprise (primary outcome metric).** Share of hotel handoffs where the traveler returns to expaify within the session after crossing "Check rooms with provider" — the bounce-back signature of hitting an unexpected restriction on the partner page. Baseline this per-property-market before any UI ships; the target is a *reduction*, since a rule surfaced pre-handoff converts a wasted handoff into an informed non-click.

3. **Pre-handoff confidence (comprehension task).** Ask travelers evaluating a property to answer, before handoff: (a) is there a minimum check-in age, and what is it; (b) what ID and payment instrument must the registering guest present; (c) is there any restriction on who may occupy the room. **A correct "the provider has not told us" counts as a correct, safe answer.** Today the honest score is 0/3 correct-with-evidence, and — worse — the current UI invites the *unsafe* inference that no shown rule means no rule.

4. **Denial-at-desk severity proxy.** Until real post-stay data exists, weight the taxonomy by whether the failure mode is *denial of a paid stay* (age, ID/payment name-match, local-resident ban) versus *friction* (occupancy limit resolvable by booking a second room). Ranking in §6 uses this weighting; UXR must validate it against reference patterns rather than treating it as settled.

---

## 5. Constraints the solution must respect

1. **Data integrity — never infer, never default, never reassure.** No "most properties require 18+", no star-class heuristic, no market-level generalization presented as a property fact. Only a provider- or property-sourced field may be stated, carrying a source label and `fetchedAt`. Reuse the established evidence vocabulary in this repo (`HotelParkingEvidence.state`, `HotelDocumentStatus`, `rateEligibility`'s `not_provided`) rather than inventing a fifth state grammar. **Critically: silence must never render as permission.** Absence of a stated minimum age may not be shown, or worded, as "no age restriction." The `not_provided` state is the default rendering path and must be designed first.

2. **Provider-feed reality bounds what ships.** No configured provider returns any of these fields today (`hotellook.ts` is a dead API returning empty; `bookingComRapidApi.ts` maps none). A UI stage can honestly deliver: the evidence type, the panel with every state, correct `not_provided` copy, and the analytics. **Populating real values requires a provider/pipeline change and must be scoped as a separate DEV ticket.** No Fable stage may ship a fixture-backed value as a "verified" fact; research fixtures live under `app/components/research/` and never leak into a production path. Every external call goes through `lib/providers`; adapters return `Result<T>` and never throw.

3. **Density and hierarchy — this must not outrank price, Deal Score, or location.** These are gating facts for a minority of travelers and irrelevant to the majority. Full detail belongs in section 3 ("hotel fit") of the shipped decision order, expanded card and deal-detail page, **without displacing sections 1–2 or pushing section 4 off-screen at 375px**. At most **one** short chip may appear on the collapsed card, and only when a rule is affirmatively restrictive (a stated minimum age, a stated local-resident ban) — never for `not_provided`. Usable at 375px and 1280px, no overlapping text, `app/globals.css` tokens only, existing exports and component contracts preserved.

---

## 6. Ranked disclosure hypothesis (for UXR to validate or reorder)

A deliberately **small, sourceable taxonomy of four families**, ranked by severity of the failure it prevents. UXR must confirm or reorder against reference patterns (Booking.com property "House rules", Google Hotels policy block) and against what a real provider feed can actually source.

| Rank | Family | The rule | Why it ranks here | Decision it changes |
|---|---|---|---|---|
| 1 | **`checkin_age`** | Minimum age of the guest registering and occupying the room, at property scope | Highest frequency × highest severity. A stated 21+ turns away a paid 19-year-old at the desk. Fully sourceable — properties publish a single integer. Bounded UI: one number. | Book vs. don't book |
| 2 | **`checkin_identity`** | What the registering guest must present: government photo ID, and whether a credit card **in the guest's name** is required | Second-highest denial rate, and the least anticipated — travelers do not expect a name-match rule. Distinct from `HotelDocumentReadiness`, which models documents the traveler *receives*. | Book vs. change payer vs. don't book |
| 3 | **`occupancy_admission`** | Who may occupy: adults-only, per-room occupancy as an *admission* limit, stated restrictions on who may register | Denies or forces re-booking on arrival for families and groups. Partly overlaps `guest-room-fit` — UXR must draw the line at **admission** (turned away) vs. **fit** (uncomfortable). | Book vs. book differently |
| 4 | **`local_guest_restriction`** | Whether local residents are barred, or a specific national/local ID is required at registration | Severe when it hits (total denial) but low frequency and market-specific; sourcing is the weakest of the four. Must not be confused with `rateEligibility.residency`, which is a *pricing* qualifier. | Book vs. don't book |

**Rejected from the taxonomy** — deliberately, to keep it sourceable: quiet hours, visitor rules, party/event rules, damage terms, extra-bed charges, minimum-stay rules. Each is either owned elsewhere, unsourceable at scale, or friction rather than denial. **UXR must not expand the taxonomy past five families.** If a fifth is proposed, it must displace one above and justify it on the denial-severity weighting in §4.4.

---

## 7. Data-gap assessment

| Need | Current state | Gap owner |
|---|---|---|
| A property-scoped policy field on the offer | **None.** `HotelOffer` has no slot. | UXDES defines the type; DEV adds it |
| Provider mapping | **None.** `hotellook.ts` dead/empty; `bookingComRapidApi.ts` maps no policy. | Separate DEV/provider ticket — **not** UI |
| A state vocabulary | Exists and is reusable — `confirmed` / `conditional` / `unavailable` / `not_provided` / `conflicting` (`HotelDocumentStatus`), plus `loading`/`error` load states | Reuse; do not invent |
| Source attribution + freshness | Exists — `lib/providerFreshness.ts`, `source.label` / `observedAt` patterns | Reuse |
| Analytics | Exists — `HotelDecisionAnalytics.tsx`, `app/api/analytics` | Extend with a policy-disclosure event + a handoff-with-restriction-shown event |

**Consequence for scoping, stated plainly:** the honest first release is a **fully-designed panel whose default and most common rendered state is "the provider has not told us."** That is the correct outcome, not a failure — it converts an unsafe silent inference into a stated unknown, and it is the only thing this repo can ship truthfully today. UXR and UXDES must plan for `not_provided` as the *primary* state, with populated states designed but provider-gated.

---

## 8. Success statement

**This is solved when a first-time 19-year-old traveler, or one paying with a card that is not in their name, can determine before leaving expaify whether the property will let them check in — or can see plainly that the property has not told us — without any age, ID, residency, or occupancy claim appearing on screen that a provider did not supply, and without silence anywhere reading as permission.**

**Verifiable at TEST:**
- All four families in §6 render in the ranked order, each in its populated state and its `not_provided` state, at 375px and 1280px.
- No inferred, defaulted, or market-generalized policy value appears anywhere in delivered code.
- No copy anywhere states or implies "no restriction" on the basis of absent data.
- The panel sits inside section 3 of the shipped decision order without displacing sections 1–2 or pushing the handoff CTA off-screen at 375px.
- Nothing in `HotelRateRestrictions`, `HotelDocumentReadiness`, `HotelFundsPolicyPanel`, `HotelPetPolicy`, `SmokingPolicyPanel`, or `AccessEvidencePanel` is restated or regressed.
- Policy-disclosure and handoff-with-restriction-shown events fire and are queryable.

---

## 9. Handoff

Next stage: **UXR-HOTEL-POLICY-EXCEPTIONS-01** — audit the current hotel-detail implementation against this problem, resolve the `rate-eligibility` boundary in §3(a) against the actual code, validate or reorder the §6 ranking against Booking.com "House rules" and Google Hotels policy patterns, and produce 3–5 testable design directives at `docs/pipeline/hotel-policy-exceptions/02-research.md`.
