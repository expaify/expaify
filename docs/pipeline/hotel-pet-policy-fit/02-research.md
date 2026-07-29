# UXR-HOTEL-PET-POLICY-FIT-01: Pet Policy Disclosure Research

Date: 2026-07-29
Stage: UX Research
Priority: P2
Feature slug: `hotel-pet-policy-fit`
Upstream: `docs/pipeline/hotel-pet-policy-fit/01-discovery.md`
Prior pipeline (settled, do not re-derive): `docs/pipeline/hotel-pet-policy/{01-discovery,02-research,03-design}.md`

## Decision Summary

Three findings drive everything downstream.

1. **The open question resolves against the discovery's assumption.** The discovery expected UXR to find "the intended hotel-results surface." There is none: **no mounted surface in this branch renders a `HotelOffer` at all.** The live results feed (`/deals`) is fed by `/api/deals` with a different row shape that carries no policy evidence. But the conclusion is not "blocked on integration" either, because **one policy-disclosure surface *is* mounted and reachable — `/book` (`app/book/page.tsx:47`)**, which already renders the smoking, funds, parking, and document panels from a normalized hotel context. Pet disclosure must be specified against **two** surfaces with different blocking status, not one.

2. **The shipped pet component cannot represent the steady state.** `HotelPetPolicyPresentation` (`app/components/HotelPetPolicy.tsx:46`) has exactly two variants — `loading` and `ready` — and `ready` *requires* an `evidence` object. There is no not-provided variant. Worse, `scanCopy` returns `null` when no pet is stated and availability is anything but `returned` (`HotelPetPolicy.tsx:137-142`), a behaviour locked in by test (`app/components/__tests__/HotelCard.petPolicy.test.tsx:220`). At the expected steady state — zero coverage, no stated pet — **the shipped component's specified output is nothing.** This is precisely the "degrades to nothing" failure the discovery's Constraint 3 forbids, and it is baked into the component contract, not just the missing wiring.

3. **The evidence shape lives in the wrong layer.** `HotelPetPolicyEvidence` is declared in a React component file (`app/components/HotelPetPolicy.tsx:25`), not `lib/types.ts`. Every comparable policy — smoking, funds, rate eligibility, document readiness — is typed in `lib/types.ts` and normalized in `lib/hotels/*.ts`. Pet policy has no `lib/` presence whatsoever: `grep -rin pet lib/` returns one airport name (`lib/airports/data.ts:255`) and nothing else. There is no field on `HotelOffer`, no normalizer, no sentinel, no carrier through the booking context. The prior pipeline shipped a renderer for a contract that was never given a home.

**Consequence for UXDES:** this ticket's deliverable is a *disclosure model that is correct at zero coverage first* and degrades *upward* into the prior pipeline's evaluation model when data appears — the inverse of how the prior spec was built.

## Method And Evidence Boundary

**Current-code evidence.** Every claim in §"Current-Code Audit" was read in this worktree at the paths and line numbers cited. Where the discovery asserted something, I re-verified it rather than inheriting it; §1.5 records one place the discovery's framing was incomplete.

**Reference-pattern evidence.** §"Reference Patterns" describes Booking.com and Google Hotels at the level of interaction pattern from teardown knowledge as of the analyst's working knowledge, not from a live capture in this session. It is used only to argue about *pattern shape* — where a policy statement sits, what it says when unknown, whether a filter is offered. No copy is lifted, no visual style is imported, and **no reference claim is a substitute for a supplier fact.** Where a reference pattern depends on data expaify does not have, that is called out explicitly rather than borrowed.

## Current-Code Audit

### 1. There is no mounted `HotelOffer` surface — but there is a mounted *policy* surface

The discovery's §"Current, Measurable Signal" item 4 says `HotelCard` is mounted by no page. Verified, and it goes further than stated:

| Path | Status |
|---|---|
| `app/components/HotelCard.tsx` | imported by no `page.tsx`; only by its own tests |
| `app/api/search/route.ts` (streams `hotels`, `hotel-status`, `hotel-smoking-policy-status`) | **consumed by nothing.** `grep -rn "api/search"` across `app/` and `lib/` returns only `app/components/ui/SearchBar.tsx:44`, which calls `/api/search/parse` — a different route. The entire hotel streaming contract has no client. |
| `app/deals/DealFeed.tsx` | **mounted and live.** Hotels tab (`:478`), fed by `/api/deals` (`:610`, `:1082`). `app/api/deals/route.ts` contains no `smokingPolicy`, no `fundsPolicy`, no `HotelOffer` — it is a `DealRow` shape with no policy evidence. |
| `app/deals/[dealId]/page.tsx` | **mounted.** Renders `HotelOffer`-derived score context but no policy panel: no smoking, no funds, no parking, no pet. Contains no link to `/book`. |
| `app/book/page.tsx` → `app/book/BookingFlow.tsx` | **mounted, and it renders policy.** `BookingFlow` mounts `TrackedSmokingPolicyPanel … surface="review"` (`BookingFlow.tsx:1027`), `ParkingSection` (`:1118`), and `HotelFundsPolicyPanel` (`:1194`), driven by `hotelContext` (`app/book/page.tsx:47-53`). |

So the correct statement is **not** "the pet surface has no owner." It is:

- **Result-scan disclosure** (`HotelPetPolicyScan` in `HotelCard.tsx:928`) has no mounted host and is blocked on a separately authorized results integration.
- **Review-step disclosure** (`HotelPetPolicyDetails`-equivalent) has a mounted, rendering host today — `BookingFlow`'s hotel review — whose sibling policy panels are already live.

This distinction is the single most important thing UXDES inherits. Specifying only against `HotelCard` repeats the prior pipeline's mistake of putting the entire disclosure behind an integration that does not exist.

### 1.5 The reachability caveat on `/book`

`/book?kind=hotel` requires a hotel context, and a valid one is produced in exactly two ways: `buildHotelBookingHref(hotel)` (`lib/booking/config.ts:1059`), whose only caller is `HotelCard.tsx:753`; or a POST to `app/api/book/hotel-context/route.ts:22`. So today, the *route* is mounted and the panels render, but no shipped UI hands a user into it. `BookingFlow` is therefore **unblocked at the component and contract level and blocked only at the entry-link level** — a materially smaller and differently-owned gap than the results-page architecture the discovery ruled out of scope. UXDES should specify the review-step disclosure as deliverable now; who links into `/book` is a results-page question and stays out of scope.

### 2. `HotelOffer` and the provider boundary carry no pet state at all

`lib/types.ts:474-495` defines `HotelOffer` with `documentReadiness`, `hotelClass`, `guestRating`, `amenityEvidence`, `accessEvidenceState`, `fundsPolicy`, `smokingPolicy?` (`:492`), `rateEligibility`. No pet property. `lib/hotels/` contains `fundsPolicy.ts`, `locationEvidence.ts`, `rateEligibility.ts`, `searchCriteria.ts`, `smokingPolicy.ts` — no `petPolicy.ts`. `lib/providers/` has no pet mapping and no pet sentinel. `app/api/` has no pet reference anywhere.

The operative consequence: **the provider boundary today cannot say "the supplier returned no pet policy" as a fact.** It can only be silent, and silence is indistinguishable from "the field does not exist" and from "we never asked." Constraint 1 of the discovery — verified policy and unknown status must never merge — is currently unenforceable because there is only one state, not three.

### 3. The smoking precedent, read exactly

Smoking is the in-repo answer to the identical situation, and it is a four-part pattern, not a component:

1. **Typed three-way state at the domain layer.** `HotelSmokingEvidenceState` (`lib/types.ts:326`) with per-dimension `state`, and `HotelSmokingPolicy` (`:379`) split into `room` and `property` dimensions so property-level facts can never be read as room-level ones.
2. **Two named sentinels at the domain layer.** `notProvidedHotelSmokingPolicy()` (`lib/hotels/smokingPolicy.ts:151`) — successful check, explicit absence — and `unavailableHotelSmokingPolicy()` (`:159`) — check failed. These are different states with different copy, and the distinction survives to the UI.
3. **Sentinel applied at the adapter, with the reasoning recorded.** `lib/providers/hotellook.ts:383-385` and `:535-537`, the latter carrying the comment *"cache.json exposes no supported, scoped smoking-policy fields. A successful check is explicit absence, never a policy inference."* That comment is the exact discipline Constraint 2 demands, already written down.
4. **Coverage transmitted, and the control suppressed by it.** `app/api/search/route.ts:409-414` emits `normalizedCoverageCount: 0`, `totalCount: offers.length`, `filterEnabled: false`; the skipped branch (`:476`) and error branch (`:462-466`) each carry their own state.

Rendered copy at the honest-unknown state is short and terminal, not a table of blanks:

> `not_provided` → "Smoking policy not provided by this supplier." (`SmokingPolicyPanel.tsx:281`)
> `unavailable` → "Smoking policy could not be checked." / "Confirm this with the booking partner before you book." (`SmokingPolicyPanel.tsx:286-287`)

**And it is carried through the booking context.** `BookingHotelContext` (`lib/booking/config.ts:52`) has `smokingPolicy?` (`:74`); `buildBookingHotelContext` normalizes it or falls back to `unavailableHotelSmokingPolicy()` (`:960-962`); `validateBookingHotelContext` does the same for a tampered or absent inbound value (`:705-707`). That last detail matters: **an absent value at the context boundary degrades to `unavailable`, not to `not_provided`** — because at that boundary, absence means the context lost it, not that the supplier answered. Pet policy will need the same two-sided discipline, and UXDES must not collapse it.

### 4. What the shipped pet components actually do at zero coverage

`HotelCard` wires both pet renderers behind one optional prop, `petPolicy?: HotelPetPolicyPresentation` (`HotelCard.tsx:47`), passed by no caller: scan at `:928`, details at `:1026-1031`. Trace the zero-coverage cases through `HotelPetPolicy.tsx`:

| Case | Traced behaviour | Verdict |
|---|---|---|
| Prop omitted (today, everywhere) | Nothing renders. Locked by test `HotelCard.petPolicy.test.tsx:100`. | Correct as an opt-in guard; wrong as the steady state |
| No stated pet + `availability: 'not_returned'` | `scanCopy` returns `null` (`:137-142`) → **scan renders nothing** | **Primary defect.** This is the modal case at 0/N coverage |
| No stated pet + `availability: 'returned'` | "Pet policy available in Details." neutral tone | Reasonable, but unreachable at 0 coverage |
| Stated pet + `availability: 'not_returned'` | "Pet policy needs confirmation" / "This provider did not return a pet policy." | **Correct, and the model to generalize** |
| Stated pet + `availability: 'error'` | "…could not be loaded." Distinct from `not_returned` | Correct; matches the smoking two-sentinel discipline |
| Any + `not_returned` in **Details** | Full eight-row `<dl>` renders, every row a negative: "Allowed animal types were not specified." / "Additional restrictions were not specified." / "Policy freshness was not provided." / "Policy source could not be confirmed." (`:373-395`) | **Secondary defect.** Eight rows of nothing is not disclosure; it is the appearance of evidence |

Two structural problems follow.

**(a) Honest-unknown is conditional on a stated pet.** The traveller must first tell expaify they have a pet before expaify will admit it does not know. That inverts the burden: at zero coverage, the disclosure is *identical for every property and every pet*, so it is exactly the case that needs no profile. A profile-gated unknown also makes the pet profile look like it purchased information it did not purchase.

**(b) The unknown state must be synthesized as fake evidence.** To render honest-unknown, a caller must construct `{ state: 'ready', evidence: { availability: 'not_returned', … } }` — an evidence object asserting there is no evidence. Compare smoking, where `not_provided` is a first-class dimension state produced by a named domain sentinel. UXDES should specify a presentation variant that does not require fabricating an evidence record.

### 5. What survives from the prior pipeline

Explicitly reusable, do not redesign: `PetFitStatus` / `PetPolicyAvailability` / `PetPolicyPermission` / `PetPolicyScope` / `PetPolicyFeeStatus` and `HotelPetPolicyEvidence` (`HotelPetPolicy.tsx:5-44`); the deterministic downgrade rules in `presentationStatus` (`:118-133`) — notably that a positive claim requires `scope === 'selected_stay'`, complete fit evidence, provenance, and a clean fee, and otherwise degrades to `unknown`; the fee/limit quarantine helpers; and `PetProfilePanel` with `validatePetProfileDraft`. The 12 specification tests in `HotelCard.petPolicy.test.tsx` are a real asset and should be extended, not replaced.

The one type-layer change UXDES must call for: **`HotelPetPolicyEvidence` moves to `lib/types.ts`** and gets a `lib/hotels/petPolicy.ts` normalizer, so DEV has somewhere to put the sentinels. The presentation types stay in the component.

## Reference Patterns

Two references, both examined for one question only: *what does the product show when the supplier has not documented a pet policy?*

### Google Hotels — filter as a promise, property page as the authority

Pattern: a "Pets allowed"-style filter narrows the result set; the property page carries a policy line; the actual terms live with the booking partner. The load-bearing property is that the filter operates over a **normalized amenity/policy field the aggregator holds for the properties it filters**, and properties lacking that field are simply not in the filtered set. The traveller is never shown a fit claim built from nothing.

**Delta to expaify.** expaify has that field for zero properties. Reproducing the filter would produce an empty set for every search, which reads as "no pet-friendly hotels in this city" — a false negative that is *worse* than silence, because it is a confident wrong answer. This validates the existing `filterEnabled: false` posture and generalizes it: **the pet control is coverage-gated exactly as the smoking filter is, and the gate value comes from the same status-event shape.**

The transferable half is the *ordering*: scan-level signal is a narrowing aid, and the authoritative statement lives one level deeper, at the property/review step. That maps onto expaify's split in §1 — scan (blocked) versus review (available) — and argues for building the review statement first.

### Booking.com — the property fact sheet states the absence

Pattern: pet policy sits in a "House rules" fact sheet at property level, alongside check-in windows and cancellation. When a supplier has not stated a pet policy, the pattern is **an explicit line at the expected location** — the rule is named and its answer is given as not-specified/contact-the-property — rather than the row being dropped. Pet-related charges are also held separate from the room rate and marked as payable to the property.

**Delta to expaify.** Two things transfer, one does not.

- *Transfers:* the absence is stated **at the location where the fact was expected**, not omitted. This is the direct answer to Constraint 3. It is also exactly what `SmokingPolicyPanel.tsx:281` already does in this repo — the pattern is not foreign, it is present and shipping.
- *Transfers:* fee separation. `HotelPetPolicy`'s fee handling already implements this; the discovery's Deal Score concern (a pet charge the score never saw) is served by keeping the charge visibly outside the nightly rate and never netting it in.
- *Does not transfer:* Booking.com's house-rules sheet is dense because most rows are populated. At 0/N coverage, an expaify pet section rendering the same eight-row grid produces eight negatives — the §4 secondary defect. **The reference's density is a function of its coverage and must not be copied at expaify's coverage.**

### What neither reference does, and expaify must not either

Neither infers pet eligibility from a property type, a class, a photo, or marketing prose. Hotellook's `amenityEvidence` will at some point contain a generic `pets` token; Constraint 2 forbids promoting it, and the adapter comment at `hotellook.ts:535-537` is the precedent for refusing in writing.

## Exact Gap

| Layer | Current code does | Reference / precedent does | Delta UXDES must close |
|---|---|---|---|
| Domain type | No pet field on `HotelOffer`; evidence type lives in a component | Smoking: typed dimensions + two named sentinels in `lib/hotels/` | Move evidence to `lib/types.ts`; specify `notProvided` and `unavailable` pet sentinels |
| Provider | Silence, indistinguishable from "no such field" | Adapter asserts explicit absence, with the refusal recorded in a comment | Adapter must emit "supplier returned no pet policy" as a fact |
| API status | No `hotel-pet-policy-status` | `hotel-smoking-policy-status` carries coverage + `filterEnabled` | Same event shape, all four branches (ready/empty/error/skipped) |
| Booking context | `BookingHotelContext` has no pet field | `smokingPolicy?` carried, absent-at-boundary → `unavailable` not `not_provided` | Carry pet policy with the same two-sided degradation |
| Scan render | Renders nothing without a stated pet at `not_returned` | Absence stated at the expected location | Honest-unknown must not be profile-gated |
| Detail render | Eight negative rows at `not_returned` | Terminal one-to-two sentence statement + confirm action | Collapse the unknown state; do not render an evidence grid with no evidence |
| Mounting | Scan host unmounted; **review host mounted and rendering sibling panels** | — | Specify review-step disclosure as deliverable; scan as integration-blocked |

## Design Directives

Five directives. Each is testable and each names the state it governs.

### D1 — Add a first-class `not_provided` presentation variant; never synthesize empty evidence

`HotelPetPolicyPresentation` gains variants such that the zero-coverage state is expressible **without an `evidence` object**: minimally `loading | not_provided | unavailable | ready`, mirroring the smoking split between "checked, supplier said nothing" and "could not be checked." `ready` keeps its current meaning and its existing downgrade rules unchanged.

Testable: given `{ state: 'not_provided' }` and no pet profile, the scan renders a visible statement; no test may construct a `ready` presentation to express absence.

### D2 — Honest-unknown is unconditional; only fit evaluation is profile-gated

At `not_provided` / `unavailable`, the disclosure renders identically whether or not a pet is stated, because at zero coverage it *is* identical. The stated-pet profile upgrades an unknown to an evaluation; it must never be a precondition for admitting the unknown. This directly overrides the current `scanCopy` null-return (`HotelPetPolicy.tsx:137-142`) and requires updating the expectation at `HotelCard.petPolicy.test.tsx:220`. The `petPolicy` prop stays opt-in — a caller passing nothing still renders nothing (`:100` stands); the change is what happens once a host opts in.

Copy must state the absence and name the authority in one line, following the shipped smoking precedent. UXDES writes the final strings; they must contain no hedge that could be read as permission ("may allow", "usually", "pet-friendly"), and the accessible name must carry the status without relying on the warning tone class.

Testable: for `not_provided` with no profile, and for `not_provided` with a profile, the rendered text and accessible name both state that the policy is not documented and that the provider or property confirms it; neither renders a fit outcome, a fee, or a limit.

### D3 — The unknown detail state collapses; the evidence grid is for evidence

At `not_provided` and `unavailable`, `HotelPetPolicyDetails` renders the section heading, a status block, one confirmation action, and nothing else. The eight-row `<dl>` (`HotelPetPolicy.tsx:373-395`) renders only when `state === 'ready'`, and individual "not specified" rows remain legitimate there — a partially-populated policy is real evidence with real gaps. What is forbidden is a grid in which every row is a negative.

`unavailable` keeps the retry affordance already specified for the error path (`:415-419`); `not_provided` must not offer retry, because retrying a supplier that has no field is a false promise.

Testable: at `not_provided`, the detail section contains no `Animal types`, `Pet charge`, `Number of pets`, or `Weight or size limit` row, and exposes no retry control; at `unavailable`, retry is present.

### D4 — Emit `hotel-pet-policy-status` in the smoking event's shape, and gate every pet control on it

`app/api/search/route.ts` emits `hotel-pet-policy-status` alongside the smoking event in all four branches — loading (`:399`), ready-with-offers (`:409-414`), ready-empty (`:436-441`), error (`:462-466`), skipped (`:476`) — carrying `normalizedCoverageCount`, `totalCount`, `filterEnabled`. At current supply, `normalizedCoverageCount` is 0 and `filterEnabled` is `false`.

No pet filter, no pet sort, and no pet-profile entry point that implies filtering may render while `filterEnabled` is `false`. UXDES specifies the gate and the launch threshold; it does not ship a filter. Note honestly in the spec that this event currently has no client (§1) — it is specified so the contract is correct when a results host exists, and so the review surface can read coverage from the same source later.

Testable: each branch of the hotel block emits exactly one `hotel-pet-policy-status`; a spec assertion forbids any pet control rendering when `filterEnabled` is `false`.

### D5 — Specify the review-step disclosure as deliverable now, and the scan as integration-blocked

The spec is written against two hosts, with their status stated in the document:

- **`BookingFlow` hotel review — deliverable.** Pet disclosure sits with the other property-policy panels (after smoking at `BookingFlow.tsx:1027`, before or alongside parking at `:1118`), sourced from a `petPolicy?` field on `BookingHotelContext` that degrades to `unavailable` when absent at the context boundary and `not_provided` when the supplier answered with nothing (the two-sided rule from `lib/booking/config.ts:705-707` and `:960-962`). Property-level policy is never presented as confirmed for the selected room and rate — the existing `scope !== 'selected_stay'` downgrade already enforces this and must be stated in the review copy.
- **`HotelCard` scan + detail — specified, exposure blocked.** Fully specified against the designated component, with the blocker named as the absent results-page host, not as an absent provider contract. Do not attempt to solve results-page architecture.

Both hosts at 375px and 1280px: the disclosure is a single compact block that must not displace price, Deal Score, location, or the review CTA.

Testable: the spec contains a complete state table for the review surface with final copy for `loading`, `not_provided`, `unavailable`, and `ready`; and states the scan surface's blocker in one sentence without deferring the model itself.

## Measurement

The discovery's four instruments stand. Two refinements from this audit:

- **Comprehension of the three-way state** becomes the *primary* pre-integration metric, because at 0/N coverage every property is in the same bucket and the false-positive-selection metric has no variance to measure. Scoring "not documented" as a correct answer remains mandatory.
- **Coverage-honest control exposure** is now directly readable: pair every pet control impression with the `normalizedCoverageCount / totalCount` from the D4 event. Any impression at `filterEnabled: false` is a defect.

## Open Items Handed Forward

1. **`HotelPetPolicyEvidence` must move to `lib/types.ts`** with a `lib/hotels/petPolicy.ts` normalizer and the two sentinels. Flagged as a contract concern, not just a refactor: a domain evidence type declared in a React component cannot be normalized at the provider boundary, and the non-negotiable contract requires normalization there. UXDES specifies the shape; DEV performs the move.
2. **Nothing links a user into `/book?kind=hotel`** (§1.5). Out of scope here; record it as the dependency that gates the review surface reaching a real traveller.
3. **`/api/search`'s hotel stream has no client at all.** Broader than this ticket and affecting smoking and access equally. Not this ticket's to fix; named so UXDES does not mistake the D4 event for a shipping path.

## Handoff

Next stage: `UXDES-HOTEL-PET-POLICY-FIT-01` — UX Design. Read this brief and `01-discovery.md`. Reuse the evidence shape, the stated-pet profile, and the downgrade rules from `docs/pipeline/hotel-pet-policy/03-design.md`; do not re-derive them. Produce `docs/pipeline/hotel-pet-policy-fit/03-design.md` covering D1–D5 with final copy for every state on both hosts.
