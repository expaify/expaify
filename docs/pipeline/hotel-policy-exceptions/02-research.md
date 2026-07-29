# UXR-HOTEL-POLICY-EXCEPTIONS-01: Hotel Policy Exception Visibility — Research

Date: 2026-07-29
Stage: UX Research (UXR)
Persona: Senior UX Researcher
Priority: P1
Feature slug: `hotel-policy-exceptions`
Upstream: `docs/pipeline/hotel-policy-exceptions/01-discovery.md`

---

## 0. Summary of findings

1. **The structural absence in discovery §2 is confirmed by code, with one correction to the line references.** `HotelOffer` is at `lib/types.ts:474–495` in this worktree. It carries no property-level admission field. Neither hotel adapter maps one.
2. **The `rate-eligibility` boundary (discovery §3a) is separable, and the shipped code already separates the two surfaces physically.** Rate eligibility renders in *section 5, Supporting evidence* of the booking review (`app/book/BookingFlow.tsx:1128–1136`) and as a collapsed-card chip. Admission belongs in *section 3, Hotel fit*. **No conflict to report.** Reuse is specified in Directive 1.
3. **The taxonomy stays at four families, with one reorder:** `local_guest_restriction` moves to rank 3 and `occupancy_admission` to rank 4, because discovery's own denial-vs-friction weighting (§4.4) puts total denial above resolvable friction, and because `occupancy_admission` carries the highest duplication risk of the four. Detail in Directive 2.
4. **`checkin_identity` cannot be modelled as structured flags.** In every reference feed this rule is free prose. It must be designed as a supplier-verbatim statement list, not as booleans — otherwise the UI will manufacture a claim. Directive 2.
5. **Two density facts constrain placement more tightly than discovery assumed.** The collapsed `HotelCard` *already* renders an always-on `Restrictions not provided` chip (`HotelCard.tsx:906`), and the expanded card already stacks eleven evidence blocks. A second not-provided chip would read as duplicate noise at 375px. Directive 4.
6. **A new analytics event will be silently dropped unless DEV adds it to the server allowlist** at `app/api/analytics/route.ts:12`. This is a hard dependency, not an implementation detail. Directive 5.

---

## 1. Current-implementation audit (read, not assumed)

### 1.1 Data model — `lib/types.ts`

`HotelOffer` (`474–495`) fields: `id`, `name`, `area`, `location?`, `stars`, `pricePerNight`, `priceBasis?`, `rating?`, `photoUrl?`, `deeplink`, `source`, `documentReadiness`, `hotelClass?`, `guestRating?`, `amenityEvidence?`, `accessEvidenceState?`, `fundsPolicy`, `smokingPolicy?`, `rateEligibility?`, `rateEligibilityCapability?`.

**There is no property-scoped admission slot, and no field in the offer carries a `scope` discriminator at property level except inside `smokingPolicy`.** `NormalizedHotelOffer = HotelOffer` (`498`), so the search stream and every card inherit the gap.

Confirmed adjacent types:

- `HotelDocumentStatus` (`201–206`) = `confirmed | conditional | unavailable | not_provided | conflicting`. This is the reusable five-state vocabulary named in discovery §7.
- `HotelDocumentType` (`208`) = `invoice | receipt | booking_confirmation` — documents the traveler **receives**. Confirmed: nothing models a document the traveler must **present**.
- `HotelSmokingPolicy` (`379–383`) is the best in-repo structural precedent for what this ticket needs: a `loadState`, plus per-dimension evidence carrying `state`, optional `value`, a `scope`, and a `statements: SupplierSmokingStatement[]` array of attributed supplier prose. `HotelSmokingDimension` (`370–377`) is the shape to mirror.
- `RateRestrictionFamily` (`426`) = `residency | age | membership | refundability`; `HotelRateFamilyEvidence` (`443–453`) carries `minAge`/`maxAge`/`membershipLabel`/`residencyPlace` and **no `scope` field at all** — it is implicitly rate-scoped by its container, `HotelRateEligibilityEvidence` (`455–465`), which is keyed by `offerId` + `supplier`.

### 1.2 Rate eligibility — `lib/hotels/rateEligibility.ts`

- `RESTRICTION_ORDER` (`13`) fixes display order `residency, age, membership, refundability`.
- `deriveRateEligibilityPresentation` (`104–139`) hard-gates provenance: if `evidence.offerId !== offerId || evidence.supplier !== supplier`, **every** family degrades to `not_provided` (`111–113`).
- `clear` requires *both* all four families explicitly `clear` **and** `capability[family] === true` for all four (`132–137`). Otherwise `not_provided`.
- `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` (`16–21`) sets all four capabilities `false`, with the comment: *"No current adapter may declare support without a documented supplier contract behind it."*
- Age copy is rate-worded: `Ages {min}+ only`, `Ages {min}–{max} only`, `Maximum age {max}` (`87–91`). Residency copy: `Residents of {place} only` (`83`).

**This is the pattern to copy, not to extend.** Its provenance gate, its capability gate, and its refusal to infer are exactly what constraint 1 requires — but every one of its labels reads as a *rate qualifier* ("only"), which is the wrong sentence for an admission rule.

### 1.3 Rendering surfaces — where rate eligibility actually appears

| Surface | Call site | What renders |
|---|---|---|
| Collapsed hotel card | `HotelCard.tsx:906` — `<HotelCardEligibilityLine>`, **unconditional** | A bordered chip. For every current offer: `Restrictions not provided`. |
| Card accessible name | `HotelCard.tsx:761` — `getRateRestrictionsAccessibleSummary(..., 'card')` | `Rate restrictions: {provider} did not provide complete rate restrictions.` |
| Booking review, section 5 | `BookingFlow.tsx:1128–1136` — `<HotelRateRestrictionsSection>` inside `<section aria-labelledby="hotel-supporting-title">` **Supporting evidence** | Full three-state panel. |

**`HotelRateRestrictionsSection` is not rendered in the expanded `HotelCard` at all.** The expanded card (`HotelCard.tsx:987–1075`) renders, in DOM order: `DealScorePanel`, `QualityEvidencePanel`, Location block, `ParkingSection`, `HotelPetPolicyDetails`, `TrackedSmokingPolicyPanel`, `AccessEvidencePanel`, Price-scope/Rate-check block, `HotelFundsPolicyPanel` (full), Provider-handoff block, `PropertyPhoto` — **eleven blocks**.

### 1.4 Document readiness — `app/components/HotelDocumentReadiness.tsx`

373 lines modelling issuance of invoice / receipt / booking confirmation: `issuerByDocument`, `billingDetailsStep`, `verificationTarget`, conflict statements. Every string is about who *sends* the traveler a document after booking. **Confirmed: no overlap with "what must you present at the desk."** The name collision is real and will confuse implementers; Directive 1 fixes it with a naming rule.

### 1.5 Providers — `lib/providers/`

- `hotellook.ts` maps price, location, hotel class, guest rating, `fundsPolicy: createNotReturnedHotelFundsPolicy('Hotellook')` (`406`), and `smokingPolicy` (`383–385`, defaulting to `notProvidedHotelSmokingPolicy()`). **No policy, age, ID, residency, or occupancy mapping.**
- `bookingComRapidApi.ts` — grep for `policy|checkin|check_in|age` returns only an error-message field (`19`) and an error branch (`110`). **Zero policy mapping.**

Grep across `lib/` and `app/` for `minimum.?age|checkInAge|government.?id|photo.?id|house.?rules|local.?resident|residency`, excluding tests, returns matches **only** in `rateEligibility.ts`, `lib/booking/config.ts` (`626–676`, which validates and forwards the same rate-scoped evidence), `lib/types.ts`, and `HotelRateRestrictions.tsx`. Discovery §4.1 is confirmed: **property admission disclosure on expaify is 0%.**

### 1.6 Reuse assets confirmed present

`lib/providerFreshness.ts` exports `providerDisplayName`, `hasProviderName`, `validFreshnessDate`, `formatRelativeFreshness`, `formatAbsoluteFreshness`. `HotelRateRestrictions.tsx:83–87` shows the established provenance sentence: `Source: {provider}. Rate details fetched {absolute}.` / `…freshness not available.`

### 1.7 Adjacent-ticket shipped state (checked, because it changes the overlap risk)

| Ticket | Docs present | Shipped code |
|---|---|---|
| `rate-eligibility` | 01, 02, 03 | **Yes** — types, `lib/hotels/rateEligibility.ts`, `HotelRateRestrictions.tsx`, two call sites |
| `hotel-checkin-logistics` | 01, 02 only | **No** |
| `guest-room-fit` | 01, 02 only | **No** |

So the only *code-level* collision risk is `rate-eligibility`. The `hotel-checkin-logistics` and `guest-room-fit` boundaries are **doc-level reservations**: this ticket must not claim their fields, but there is nothing shipped to regress.

---

## 2. Boundary resolution — discovery §3(a), decided against the code

**Verdict: separable. Not a conflict. Proceed.**

Three independent code facts establish the split:

1. **Different provenance key.** `HotelRateEligibilityEvidence` is keyed `{ offerId, supplier }` and any mismatch voids all four families (`rateEligibility.ts:111–113`). An admission rule is a property fact, valid across every rate at the property; keying it to a single `offerId` would void it on every rate change and is semantically wrong. The two cannot share a provenance envelope.
2. **Different consequence, encoded in the copy.** Every shipped rate label ends in the pricing word *"only"* — `Ages 21+ only` means *this price is for 21+*. An admission rule needs *"the property requires…"*. Merging them would make one string carry two consequences.
3. **Different placement, already shipped.** Rate eligibility renders under **Supporting evidence** (section 5) at `BookingFlow.tsx:1128`. Admission is a gating fact that must be visible *before* the section-4 handoff, i.e. in section 3. Placing an admission rule in section 5 would put it after the CTA it is supposed to gate.

**Corollary risk this creates, which UXDES must handle:** a property with a 21+ *admission* minimum and a rate with an `age` *qualifier* will render two age statements on the same journey (card/section-3 vs. review section-5). That is correct — they are different rules — but it is only non-confusing if the wording is disjoint. See Directive 1's copy-disjointness rule.

**Boundary vs. `hotel-checkin-logistics` (§3b):** upheld. Temporal (`when`) vs. eligibility (`whether`). Nothing shipped; no code collision.

**Boundary vs. `guest-room-fit`:** its research (`02-research.md`, ranked family 1) claims `max_occupancy` — "how many people fit," a *capacity/comfort* fact bound to a priced room. This ticket's `occupancy_admission` must claim only *who the property will register* (adults-only, stated who-may-occupy restrictions). It must **never** render a headcount. This is the sharpest remaining duplication risk in the taxonomy and is the reason for the reorder in Directive 2.

---

## 3. Reference-pattern comparison (interaction pattern, not visual style)

### 3.1 Booking.com — property "House rules" + "Important information / fine print"

**Pattern.** Two distinct blocks below the room grid. *House rules* is a structured, labelled row list: check-in/check-out windows, cancellation/prepayment, children & beds, cots/extra beds, **age restriction** ("Minimum age for check-in: N" as a discrete labelled value), pets, accepted payment methods, parties/events. *Important information* is free prose from the property — this is where the name-match rule lives ("a valid credit card in the guest's name is required at check-in"), where local-resident and national-ID registration notes live, and where market-specific registration rules appear.

**Interaction properties that matter here:**

- **Age is the only admission rule with a structured slot.** It is a single labelled integer, rendered as its own row, always present when known. Everything else in this family arrives as prose.
- **The prose block is not a fallback, it is a first-class second block** with its own heading. Booking.com does not try to atomise fine print into flags; it attributes and displays it.
- **Placement is post-room-grid**, i.e. after price selection. This is exactly the late-disclosure failure discovery §2 describes: the rule is technically present but arrives after the decision.

**Delta vs. expaify:** we have neither block. Our opportunity is not to copy the placement — it is to move the *age* row and an attributed *statement* block **before** the handoff, which Booking.com structurally cannot do because the handoff *is* the room grid.

### 3.2 Google Hotels — property "Policies" block

**Pattern.** A short labelled list under the property panel: check-in/check-out, **minimum check-in age** when the property supplies it, children, pets, payment types. Sourced from property/aggregator feeds. Unknown fields are **omitted entirely** — no row, no placeholder.

**Interaction property that matters here, stated as an anti-pattern:** omission-on-unknown means a traveler reading a policies block with no age row cannot distinguish *"no minimum"* from *"nobody told us."* The list looks complete because it is dense and well-labelled. **This is precisely the silence-reads-as-permission failure named in constraint 1, shipped by the largest player in the category.** Copying it would defeat the ticket.

**Delta vs. expaify:** we must invert it. Where Google omits, we state the unknown. That inversion — not the field list — is the differentiating pattern, and it is consistent with how this repo already handles `not_provided` in `rateEligibility`, `fundsPolicy`, and `smokingPolicy`.

### 3.3 Delta table

| Dimension | expaify today | Reference pattern | Delta this ticket must close |
|---|---|---|---|
| Property admission rules exist in the model | No field | Structured age row + attributed prose block | Add one property-scoped evidence type |
| Age minimum | Absent (rate-scoped `minAge` only) | Discrete labelled integer | Property-scoped integer, distinct copy |
| ID / card-in-guest-name | Absent | Free prose, attributed | Supplier-verbatim statement list, never flags |
| Unknown handling | n/a | **Omitted** (Google) — unsafe | State the unknown explicitly |
| Timing relative to decision | n/a | After room selection | Before the section-4 handoff |

---

## 4. Taxonomy validation — four families, one reorder

Discovery §6 ranked: `checkin_age`, `checkin_identity`, `occupancy_admission`, `local_guest_restriction`. Applying discovery's own §4.4 weighting (**denial of a paid stay > friction**) consistently, and checking each family against what a feed can actually source:

| Rank | Family | Failure class | Sourceability (evidence) | Verdict |
|---|---|---|---|---|
| 1 | `checkin_age` | Denial | **Strong** — the only admission rule with a structured slot in both reference patterns; single integer | **Confirmed at rank 1.** Unchanged. |
| 2 | `checkin_identity` | Denial | **Prose only** — lives in Booking.com "Important information"; no structured feed equivalent | **Confirmed at rank 2, with a modelling change** (see below). |
| 3 | `local_guest_restriction` | Denial (total) | **Weakest** — prose, market-specific | **Promoted from 4.** |
| 4 | `occupancy_admission` | Mostly friction (second room resolves it); denial only for adults-only | Partly structured, but the structured part belongs to `guest-room-fit` | **Demoted from 3.** |

**Why the swap.** Discovery ranked `occupancy_admission` third on frequency and `local_guest_restriction` fourth on frequency, but §4.4 explicitly instructs ranking by *denial severity*, not frequency, "until real post-stay data exists." A barred local resident is turned away with no remedy. A party exceeding a per-room admission limit books a second room — expensive and annoying, but they sleep. Ranking by the stated rule, denial precedes friction. The demotion also reduces the `guest-room-fit` collision surface by pushing the most duplication-prone family last, where it is easiest to scope down or drop if UXDES finds it unsourceable.

**Modelling change for `checkin_identity` (important, and it changes the design).** No reference feed exposes "credit card in guest's name required" as a boolean. Designing it as flags (`photoIdRequired: boolean`, `cardInGuestNameRequired: boolean`) would force implementers to derive booleans from prose — an inference, banned by constraint 1. It must instead be modelled as an attributed **statement list**, mirroring `SupplierSmokingStatement` (`lib/types.ts:357–368`): verbatim supplier text + source label + `observedAt`. `checkin_age` is the only family that gets a typed value.

**Family count: four. No fifth proposed.** The obvious candidate — marital-status or unmarried-couple registration rules — is a *registration* rule and folds into `local_guest_restriction` rather than earning a slot. Discovery's rejected list (quiet hours, visitors, parties, damage terms, extra beds, minimum stay) is upheld: all are friction, unsourceable, or owned elsewhere.

**Do-not-duplicate table (discovery §3) re-verified against code.** Cancellation, deposits/holds (`HotelFundsPolicyPanel`), pets (`HotelPetPolicy`), smoking (`SmokingPolicyPanel`/`TrackedSmokingPolicyPanel`), accessibility (`AccessEvidencePanel`), loyalty (`HotelLoyaltyEligibility`), parking (`HotelParking`), check-in timing, invoice readiness (`HotelDocumentReadiness`), total stay cost — all present, all rendering, none touched by this ticket. **Note for UXDES:** `HotelFundsPolicyPanel` already owns "what you must have available to pay." The card-in-guest's-**name** rule is an *identity* rule, not a funds rule; the disjointness test in Directive 1 covers it.

---

## 5. Design directives

Five directives. Each is testable at TEST stage by the stated check.

---

### Directive 1 — One property-scoped evidence type, one panel, disjoint copy. Never touch the rate types.

**Requirement.**

1. Add a **new** type — recommended `HotelAdmissionPolicyEvidence` — attached to `HotelOffer` as a new optional field (recommended `admissionPolicy?`), plus a capability declaration mirroring `HotelRateEligibilityCapability`. Do **not** add fields to `HotelRateFamilyEvidence`, `HotelRateEligibilityEvidence`, `RateRestrictionFamily`, or `HotelRateEligibilityCapability`.
2. The type carries an explicit literal `scope: 'property'` on the envelope. Every family's evidence is property-scoped by construction; there is no rate-scoped variant.
3. States reuse `HotelDocumentStatus` (`confirmed | conditional | unavailable | not_provided | conflicting`) plus a separate `loadState` (`loading | ready | error`), mirroring `HotelSmokingPolicy`. **Do not invent a new state vocabulary.**
4. Provenance gate mirrors `rateEligibility.ts:111–113` but keyed on the **property**: evidence whose property identity or `supplier` does not match the rendered offer degrades every family to `not_provided`. No merging of mismatched evidence.
5. `confirmed`-with-no-restriction is capability-gated exactly as `clear` is at `rateEligibility.ts:132–137`: permitted only when the adapter's declared capability supports an explicit negative for that family **and** the supplier returned one. Absent capability ⇒ `not_provided`.
6. Render in a **new component** (recommended `HotelAdmissionPolicy.tsx`). Nothing may be added to, imported from, or rendered inside `HotelRateRestrictions.tsx`. `HotelRateRestrictionsSection`, `HotelCardEligibilityLine`, and `getRateRestrictionsAccessibleSummary` keep their current signatures and call sites.
7. **Copy-disjointness rule.** No admission string may reuse the rate-eligibility sentence frames. Rate strings end in the qualifier word *"only"* (`Ages 21+ only`). Admission strings must be property-subject sentences — pattern: `This property requires <subject> at check-in.` Concretely, the admission age string is **`This property requires guests to be {N} or older at check-in.`** and must never render as `Ages {N}+ only`. Similarly, the admission panel heading must not contain the word `Rate`, and must not be `Document readiness` or contain `documents` (owned by `HotelDocumentReadiness`, which is about documents received). Recommended heading: **`Check-in eligibility`**.

**Test.** `grep -n "Ages .*only\|Rate restrictions" ` over the new component returns nothing; `grep -rn "HotelRateFamilyEvidence\|RateRestrictionFamily" ` shows no new members; `git diff` shows `HotelRateRestrictions.tsx` and `lib/hotels/rateEligibility.ts` unmodified; `tsc` exits 0.

---

### Directive 2 — Four families in the order `checkin_age → checkin_identity → local_guest_restriction → occupancy_admission`, with only `checkin_age` typed.

**Requirement.**

1. Family identifiers and display order are fixed to the four above, declared as a single `readonly` order constant in the lib module (mirroring `RESTRICTION_ORDER`, `rateEligibility.ts:13`). Display order is DOM order. No fifth family.
2. `checkin_age` is the **only** family with a typed value: a single non-negative integer minimum, validated exactly as `validAge` does (`rateEligibility.ts:43–47`) — integer, `>= 0`, else `not_provided`. No maximum age (that is a rate qualifier, already owned). No range.
3. `checkin_identity`, `local_guest_restriction`, and `occupancy_admission` are **statement-list families**: an array of attributed supplier statements (verbatim text, bounded length, `sourceLabel`, optional `observedAt`), modelled on `SupplierSmokingStatement` (`lib/types.ts:357–368`). **No boolean flags** — specifically no `photoIdRequired`, `cardInGuestNameRequired`, `adultsOnly`, or `localResidentsBarred` boolean anywhere in the delivered type.
4. `occupancy_admission` statements may describe *who may register or occupy*. They may **not** render a headcount, a "sleeps N", a bed configuration, or a party-size fit judgement — those are `guest-room-fit`'s. If a supplier statement contains a headcount, it is displayed verbatim as prose and never parsed into a number.
5. Conflicting statements within one family render `conflicting` and display both attributed statements; they are never reconciled or de-duplicated into a single claim.

**Test.** The order constant has exactly four members in the stated sequence; `grep -niE "adultsOnly|photoIdRequired|cardInGuestName|localResidentsBarred|maxAge|sleeps|maxOccupancy"` over delivered files returns nothing; a fixture with a non-integer or negative age renders `not_provided`, not a number.

---

### Directive 3 — `not_provided` is the designed default, and no rendering path may express or imply permission.

**Requirement.**

1. The panel renders whenever its host section renders. It is **never omitted** because data is absent — the Google Hotels omission pattern (§3.2) is explicitly rejected.
2. **Panel-level not-provided copy, when all four families are `not_provided`** (the state of 100% of current offers). Render **one** statement, not four repeated rows:
   > **`Check-in eligibility`**
   > `{provider} has not told us this property's check-in age, ID, or occupancy rules.`
   > `This is not a statement that there are no rules. Confirm with the property or the booking partner before paying.`
   > `Source: {provider}. Check-in eligibility not returned.`
   When `provider` is unnamed (`hasProviderName` false), use `The booking provider`.
3. **Mixed state:** families with evidence render their own rows in the Directive 2 order; the remaining families collapse into one trailing line — `{provider} did not report the other check-in eligibility rules.` — styled as the existing `coverageIncomplete` line is (`HotelRateRestrictions.tsx:190–194`).
4. **`confirmed`-negative copy** (only reachable under Directive 1.5) must attribute, never absolve: `{provider} reports no minimum check-in age for this property.` Never `No age restriction`, never `All guests welcome`.
5. **Forbidden-copy list.** None of the following may appear in delivered files: `No age restriction`, `No restrictions`, `Anyone can check in`, `All guests welcome`, `No ID required`, `Open to all`, `No minimum age`. No check-mark glyph, and no `--success` / `--ok` token, may attach to any `not_provided` or `unavailable` state. Absence is neutral tone (`--bg-raised` / `--text-2`), never positive.
6. **Error vs. not-provided are distinct strings**, as in `HotelRateRestrictions.tsx:203–211`: error says *could not be checked*, not-provided says *did not provide*. Error uses `--error-text` for the provenance line; not-provided uses `--text-3`.
7. Loading uses `role="status" aria-live="polite" aria-atomic="true"` on the container and reserves its height, following `HotelRateRestrictions.tsx:163–175`.

**Test.** `grep -niE "no age restriction|no restrictions|all guests welcome|no id required|no minimum age|anyone can check in"` over `app/` and `lib/` returns nothing. Rendering an offer with no `admissionPolicy` produces the panel-level not-provided block, exactly one not-provided sentence, and zero success tokens.

---

### Directive 4 — Placement: section 3 in the detail/review flow; **no new element on the collapsed card in `not_provided`**; a single "Check-in" chip only when affirmatively restricted.

Grounded in two measured facts: the collapsed card already renders an unconditional `Restrictions not provided` chip (`HotelCard.tsx:906`), and the expanded card already stacks eleven evidence blocks (`987–1075`).

**Requirement.**

1. **Booking review / detail page:** the full four-family panel is an `<h3>` subsection **inside section 3, `Hotel fit`**, placed after the class/rating definition list and the location-provenance row, and **before** section 4 `Check rooms with provider`. It must not be placed in section 5 `Supporting evidence` — that is where rate eligibility lives (`BookingFlow.tsx:1128`), and section 5 is after the CTA this rule gates.
2. **Collapsed hotel card, `not_provided` (the current 100% case): render nothing.** A second chip reading `Check-in eligibility not provided` immediately below the existing `Restrictions not provided` chip is duplicate-sounding noise at 375px and violates constraint 3. The not-provided disclosure lives one tap away, in the expanded card and on the detail page.
3. **Collapsed hotel card, affirmatively restricted: at most one chip**, only when at least one family is `confirmed`/`conditional` restrictive. It must be visually and lexically distinguishable from the adjacent rate chip: prefix `Check-in:` — e.g. `Check-in: age {N}+`. Multiple restricted families collapse to `Check-in: {N} property rules`. Never a chip for `not_provided`, `unavailable`, `loading`, or `error`.
4. **Expanded hotel card:** one block, inserted **after** `QualityEvidencePanel` and the Location block and **before** `ParkingSection`, so admission sits with fit evidence rather than at the bottom of an eleven-block stack. In `not_provided` it is capped at the Directive 3.2 copy — heading plus two sentences plus provenance line, **no per-family rows** — so it adds at most four text lines at 375px.
5. **375px budget, measurable:** with a `not_provided` admission block present, the section-4 handoff CTA (detail page) must remain reachable without the block introducing more than one additional viewport-height of scroll, and sections 1–2 must be unmoved. On the collapsed card, no new element in the `not_provided` case means **zero** change to card height for every current offer — this is the acceptance number.
6. No horizontal overflow at 375px: statement prose uses `break-words` and the container `min-w-0`, as at `HotelRateRestrictions.tsx:144–149`.
7. Existing exports and component contracts preserved: `HotelCard`'s props, `BookingFlow`'s section headings and `aria-labelledby` ids unchanged.

**Test.** At 375px with a current (all-`not_provided`) offer, collapsed card height is byte-identical to `main`; the expanded card shows the admission block between quality/location and parking; the detail page shows the `<h3>` inside `hotel-fit`'s section and before `hotel-provider`'s section in DOM order; heading order remains h1 → h2 → h3 with no skips.

---

### Directive 5 — Provider reality is a hard scope line, and the analytics event needs a server-side allowlist change.

**Requirement.**

1. **What the UI stage may ship:** the type, the capability declaration, the lib normalizer with its provenance and capability gates, the component with **all** states (`loading`, `error`, `not_provided`, `unavailable`, `conditional`, `confirmed`, `conflicting`), the final copy, and the analytics wiring. **Populating real values is out of scope for UI** and requires a separate DEV/provider ticket.
2. Both current adapters must declare the capability **unsupported**, following `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` (`rateEligibility.ts:16–21`) — an explicit all-`false` constant with the same "no adapter declares support without a documented supplier contract" comment. `hotellook.ts` sets it alongside `createNotReturnedHotelFundsPolicy` / `notProvidedHotelSmokingPolicy` (`406–407`); `bookingComRapidApi.ts` likewise. Adapters keep returning `Result<T>` and never throw.
3. No fixture-backed value may reach a production path. Research fixtures live under `app/components/research/` only. Money, if any string ever quotes a deposit or fee, is not this panel's business at all — that is `HotelFundsPolicyEvidence`.
4. Provenance on every populated statement: `sourceLabel` plus `observedAt`, rendered through `lib/providerFreshness.ts` (`validFreshnessDate` + `formatAbsoluteFreshness`) in the established sentence shape — `Source: {provider}. Check-in eligibility fetched {absolute}.` / `…freshness not available.`
5. **Analytics — hard dependency.** `app/api/analytics/route.ts:12` holds `EVENT_PROPERTIES`, a server-side allowlist of event names *and* permitted property keys; an event absent from it is rejected. Two events are required, and **both the names and every property key must be added to that map or they will be silently dropped**:
   - `hotel_admission_policy_viewed` — keys: `hotel_id`, `surface`, `provider`, `evidence_state`, `families_reported`, `viewport_group`.
   - `hotel_handoff_with_admission_restriction` — keys: `hotel_id`, `provider`, `restricted_families`, `surface`.
   Property values must satisfy the route's existing validators (opaque `[A-Za-z0-9_-]{1,100}` strings, bounded integers, booleans). No free-text supplier prose, property name, or address may be sent as an analytics value.

**Test.** `npx tsc --noEmit --incremental false` exits 0; `npm test -- --passWithNoTests` exits 0; both event names appear in `EVENT_PROPERTIES` with matching key sets; `grep -rn "research/" ` shows no production import of a research fixture; a POST of each event with the specified keys returns success rather than a rejection.

---

## 6. Handoff

Next stage: **UXDES-HOTEL-POLICY-EXCEPTIONS-01** — produce `docs/pipeline/hotel-policy-exceptions/03-design.md` covering every state named in Directive 3 and Directive 5.1, at 375px and 1280px, with final copy for every visible string, Tailwind patterns using `app/globals.css` tokens only, and the exact type shape required by Directives 1 and 2.

**Non-negotiables carried into design:**
- `not_provided` is the primary designed state; design it first.
- Silence never renders as permission; the forbidden-copy list in Directive 3.5 is binding.
- No new members on any `rate-eligibility` type; nothing rendered inside `HotelRateRestrictions.tsx`.
- Four families, fixed order, only `checkin_age` typed.
- No new collapsed-card element in the `not_provided` case.
- Must not outrank price, Deal Score, or location.
