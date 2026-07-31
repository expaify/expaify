# UXR-HOTEL-CHECKIN-TIME-FIT-01 — Hotel Arrival and Departure Time Fit Research Brief

Date: 2026-07-31  
Stage: UX Research  
Priority: P0  
Feature slug: `hotel-checkin-time-fit`  
Upstream: `docs/pipeline/hotel-checkin-time-fit/01-discovery.md`  
Required evidence input: `docs/pipeline/hotel-checkin-logistics/02-research.md`

## Recommendation

**Validate the hierarchy in a research prototype, but defer a production fit outcome.** The proposed hierarchy is sound only when the fit label, the traveler scenario, and the exact published boundary remain visible as one claim. An outcome-only badge would hide the evidence and overstate certainty.

Production is blocked by two independent supply gaps:

1. expaify does not capture a traveler's expected property-arrival time or planned room-vacate time; and
2. `HotelOffer` does not carry the upstream arrival-logistics evidence. The proposed upstream contract also cannot represent a published standard check-in end independently from a late-arrival obligation cutoff.

Therefore, current production can truthfully show neither `Fits standard times` nor `Outside standard times`. Dates are not time intent. Missing intent or missing/conflicting relevant evidence must resolve to `Cannot assess from published times`.

This is not a recommendation to add time inputs under this ticket. It is a dependency report required by discovery. UXDES should specify a scenario-based research prototype and the conditional presentation contract; it must not put fixtures into a production path or create a second logistics evidence type.

## Method and evidence limits

This brief combines:

- a source audit of the current result card, hotel deal detail, booking handoff, search criteria, shared types, booking context, and Hotellook adapter;
- an interaction-pattern comparison of current Booking.com and Expedia property-policy pages; and
- an expert scenario walkthrough against the discovery tasks.

No participant sessions or production-intent analytics were available. The scenario results below validate logical sufficiency and expose likely comprehension risks; they are **not observed user behavior**. The hierarchy remains a hypothesis until first-time travelers complete the proposed study.

## 1. Current-code evidence

### 1.1 Result comparison and expanded hotel card

`HotelCard` renders hotel identity, quality, location, admission, parking, pet, smoking, physical-access, rate, funds-policy, and provider-handoff content (`app/components/HotelCard.tsx:896–1085` and following). It renders no standard arrival/departure time, traveler scenario time, or fit outcome.

The collapsed card is already dense at 375px: class/rating chips, an eligible physical-access chip, location, admission, parking, funds, pet, smoking, score, and review action can all compete before **Details** (`app/components/HotelCard.tsx:906–1038`). The existing elevator chip is correctly gated on confirmed, guaranteed, property-scoped, sourced evidence (`app/components/HotelCard.tsx:827–838`). A persistent `Cannot assess` chip on every card would add noise without helping comparison.

### 1.2 Hotel detail

The deal-detail page derives `checkInDisplay` from `deal.check_in_date` and derives the checkout date by adding nights (`app/deals/[dealId]/page.tsx:281–287`). It then labels those calendar values `Check-in` and `Check-out` (`app/deals/[dealId]/page.tsx:352–360`). These are stay dates, not property-local standard times or traveler timing intent.

This label collision materially increases misreading risk: a traveler searching for a check-in answer can find a same-named date and mistake the question as answered. The upstream logistics research already directs a rename to `Check-in date` / `Check-out date`; this ticket inherits that requirement and does not redesign it.

No production logistics subsection or fit comparison exists in the `hotel_fit` section.

### 1.3 Booking handoff and special requests

`HotelHandoffReview` names room options, availability, price, taxes, cancellation, and terms in its provider-confirmation block, but not arrival/departure fit (`app/book/BookingFlow.tsx:1123–1130`). The later **Special requests** block asks whether the traveler needs early check-in, directs them to add a request on the partner, says expaify selects/sends nothing, and says requests are availability-dependent and not guaranteed (`app/book/BookingFlow.tsx:1212–1242`).

That is a sound certainty boundary, but it is generic. It does not show:

- the published standard time the traveler falls outside;
- which side of the stay mismatches;
- whether the property/provider actually publishes an exception path; or
- whether a late-night arrival requires a request, a mandatory notification, or direct verification.

The special-request block must remain downstream guidance. It cannot serve as evidence that early check-in or late checkout is requestable for a particular property.

### 1.4 No traveler time intent

`HotelSearchCriteriaV1` captures destination, check-in-date semantics, and occupancy state only (`lib/hotels/searchCriteria.ts:4–15`). Its editable draft contains city, `dateFrom`, and `dateTo` only (`lib/hotels/searchCriteria.ts:17–21`). Formatting explicitly describes check-in **dates** (`lib/hotels/searchCriteria.ts:79–94`).

`BookingHotelContext` can preserve `checkIn` and `checkOut`, but validation treats both as dates and computes nights from them (`lib/booking/config.ts:60–76`, `531–553`). These fields cannot be repurposed as expected arrival or room-vacate times.

Result: traveler-intent coverage is 0%. A flight arrival time must not be silently used as hotel-arrival time because transfer duration, baggage collection, stops, time zones, and traveler choice are unknown.

### 1.5 No published-time evidence in production

`HotelOffer` has no arrival-logistics field (`lib/types.ts:556–579`). `HotelProvider.searchHotels` accepts only check-in and checkout dates (`lib/types.ts:616–625`). Hotellook uses those dates in the query/cache key, then normalizes identity, location, price, image, quality, amenities, and adjacent policy evidence; it does not parse property standard times (`lib/providers/hotellook.ts:447–535`).

Result: published-time coverage and computable-fit coverage are both 0%. This is a structural capability finding, not evidence that no traveler needs the information.

### 1.6 Upstream evidence-contract gap

The logistics research proposes one provider-neutral `HotelArrivalLogisticsEvidence` with:

- `arrivalFrom` — earliest standard arrival;
- `departureBy` — latest standard departure;
- `deskAccess`; and
- `lateArrival` — an obligation plus optional cutoff.

Reuse that contract; do not introduce `HotelTimeFitEvidence` containing duplicated provider facts. However, the current proposal does **not** independently represent a published standard check-in end. A property's `check-in from 15:00 to 23:00` and its instruction `contact us after 22:00` are different facts. One cannot be reconstructed safely from the other.

This matters for the assigned late-night scenario. `23:40 is outside the published standard window` requires a standard end boundary. `Contact the property after 22:00` proves an obligation, not that 23:40 is outside standard access, admitted, or rejected. Overnight windows also require service-day semantics; comparing bare `HH:MM` strings around midnight is unsafe.

**Dependency:** the owner of `hotel-checkin-logistics` must extend or clarify its evidence contract to represent an optional published standard end boundary, including its local-day association, before UXDES can specify late-night fit computation. This ticket must not create a competing evidence model.

## 2. Reference-pattern guidance

The references below show interaction patterns, not evidence that their data supply or visual style should be copied.

### 2.1 Booking.com: facts first, request path adjacent

Booking.com property pages place a `House rules` block below the main comparison content. A current property example presents check-in as a range, check-out as a range, a separate instruction to provide the expected arrival time, and a special-request path during booking. This keeps standard facts and the request/action path adjacent but distinct. [Booking.com property House rules example](https://www.booking.com/hotel/gb/camden-i-your-apartment.en-gb.html)

Useful pattern:

- retain both ends of a published range;
- place the action or request instruction beside, not inside, the standard fact; and
- do not turn `tell us your arrival time` into approval for an out-of-window arrival.

Limitation for expaify: Booking.com does not compute a traveler-specific `fits/outside` conclusion on this page, and its direct property relationship does not model expaify's default no-evidence state.

### 2.2 Expedia: standard facts, conditional exceptions, and instructions are separate claims

A current Expedia property policy shows a check-in start and end, then separately labels early and late check-in as subject to availability, gives a post-cutoff contact instruction, lists the access method, and repeats that special requests may incur charges and cannot be guaranteed. Checkout follows the same pattern: standard deadline first, late-checkout exception second. [Expedia property policies example](https://www.expedia.com/Nairobi-Hotels-After-40-Hotel.h15465088.Hotel-Information)

Useful pattern:

- standard boundary, exception availability, potential fee, and required action are independent rows;
- `subject to availability` is never styled or worded as standard access;
- a contact instruction after a cutoff is not phrased as a guarantee; and
- check-in and checkout remain separate because their comparison rules differ.

This is the stronger reference for expaify's truth hierarchy. It demonstrates why a single `fits with request` state would collapse facts that need different evidence.

### 2.3 Exact delta

| Decision layer | Booking.com / Expedia pattern | expaify today | Required delta |
|---|---|---|---|
| Traveler-specific outcome | Not computed | None | Derive only from explicit scenario time + relevant standard fact |
| Published standard facts | Visible start/end or deadline | Not representable | Reuse logistics evidence; add upstream standard-end support |
| Exception | Separate, often `subject to availability` | Generic early-check-in guidance only | Show only when property/provider evidence says it exists |
| Required action | Separate instruction | Generic partner confirmation | State exact next step without implying expaify acts |
| Unknown | Usually omitted or rare | Universal production state | Explicit `Cannot assess from published times` in detail/handoff, not every collapsed card |

## 3. Hierarchy validation

### 3.1 Validated order, with a trust guardrail

The discovery order is retained:

1. **Fit outcome** — `Fits standard times`, `Outside standard times`, or `Cannot assess from published times`.
2. **Comparison sentence** — the explicit traveler scenario time and the relevant property-local standard fact in one sentence.
3. **Published facts** — full relevant start/end or deadline, source, and freshness/conflict state.
4. **Exception and next step** — request-only/not guaranteed, mandatory notification, no published exception path, or unknown.
5. **Capability boundary** — expaify has not selected, sent, acknowledged, or guaranteed an exception.

The fit outcome may lead visually, but it must never stand alone. The comparison sentence belongs in the same semantic container and remains visible without opening a disclosure. For example: `Outside standard times — you plan to arrive at 12:00; standard room access starts at 15:00.` This preserves fast scanning without making the derivation opaque.

### 3.2 Outcome rules

- Compare property-local wall-clock values only after the traveler explicitly supplies a time for that property date.
- Equality with the relevant boundary fits: arrival at `arrivalFrom` fits; planned room vacate at `departureBy` fits.
- Arrival before `arrivalFrom` is outside standard times.
- Arrival after a published standard end is outside standard times, but this does **not** mean `not admitted`.
- Planned room use after `departureBy` is outside standard times.
- Departure before `departureBy` fits. Do not treat the checkout time as a required departure moment or infer desk/key-return availability.
- Any missing scenario time, missing relevant boundary, conflict, malformed local-day association, load error, or unsupported overnight comparison resolves to `Cannot assess from published times`.
- A request-only exception never changes `Outside standard times` to `Fits`. It changes only the next step.

## 4. Expert scenario walkthrough

These are logic/comprehension test cases for the research prototype, not participant results.

| Scenario | Evidence | Correct outcome | Required fact / next step | Forbidden inference |
|---|---|---|---|---|
| Early arrival | Traveler arrives 12:00; published standard room access starts 15:00; early check-in is requestable | `Outside standard times` | Show both times, then `Early check-in is request-only and not guaranteed. Ask the booking partner while booking; expaify does not send it.` | `Fits if requested`; request already sent; room will be ready |
| Late-night arrival, known standard end | Traveler arrives 23:40; published standard check-in ends 23:00; no published exception path | `Outside standard times` | Show the range/end, then `No exception path is published. Verify with the property or booking partner before booking.` | Guest will be refused; late check-in is requestable; desk is closed |
| Late-night arrival, obligation only | Traveler arrives 23:40; property says contact it after 22:00; standard end is not published | `Cannot assess from published times` | Show the contact obligation as a published fact and require verification | Treat the obligation cutoff as a standard check-in end or admission guarantee |
| Post-checkout room use | Traveler needs room until 14:00; published checkout deadline is 11:00; late checkout is subject to availability | `Outside standard times` | Show both times, then `Late checkout is request-only and not guaranteed.` | Bags can be stored; room may be kept for a fee; request already exists |
| Early-departure control | Traveler leaves at 06:00; published checkout deadline is 11:00 | `Fits standard times` | `Leaving earlier fits the published room-vacate deadline.` | Front desk, key return, transport, or breakfast is available at 06:00 |
| Missing intent or fact | Arrival time missing, or relevant property boundary missing/conflicting | `Cannot assess from published times` | Name exactly what is missing and direct verification if the decision matters | Use flight arrival, market norms, dates, stars, or another property as a substitute |

The matrix confirms the proposed hierarchy and shows why `Fits with request` must not be a fourth state. A request is neither part of the standard-time fit nor a guaranteed remedy.

## 5. Participant validation plan

Use a within-subject, scenario-based moderated test with 8–10 first-time expaify users who have booked a hotel independently in the last 12 months. Randomize the first three risk scenarios to reduce learning; place the early-departure control before the final unknown case for half the sample.

Test two hierarchy variants:

- **A — outcome first:** fit label + always-visible comparison sentence, then published facts and exception;
- **B — facts first:** published facts, then fit label and exception.

Do not test an outcome-only variant because it violates the source/uncertainty constraint. Require participants to answer before exposing confidence questions.

Record separately per scenario:

| Measure | Operational definition | Pass threshold for design direction |
|---|---|---|
| Correctness | Correct outcome, relevant standard fact, exception certainty, and next step; all four required | At least 7/8 correct per scenario in the smaller sample; confirm with a larger study before ranking/filtering |
| Calibrated confidence | 1–5 confidence after answer; high confidence (4–5) in any wrong/guaranteed inference is a failure | Zero high-confidence false guarantees; unknown answers may be high confidence when correctly justified |
| Mismatch-identification time | From first exposure to first correct `fits/outside/cannot assess` statement | Median under 15 seconds on early-arrival and post-checkout cases; report, do not average across unknown cases |
| False-guarantee inference | Says or selects that request-only means available, sent, approved, or guaranteed | 0 participants after the full hierarchy is viewed |
| Decision choice | `Keep`, `rule out`, or `verify`, plus one-sentence reason | `Verify` for missing/unknown exception paths; no required choice for request-only cases as risk tolerance differs |
| Early-departure false mismatch | Labels leaving before the checkout deadline as outside | 0 participants |

Instrumented funnel exits cannot substitute for this study. Until explicit time intent exists, do not label any production exit as timing-related.

## 6. Design directives

### D1 — Keep fit as a derived presentation, never provider evidence

Define one pure, exhaustive fit resolver that accepts explicit traveler scenario intent and the existing `HotelArrivalLogisticsEvidence`; it returns only `fits_standard`, `outside_standard`, or `cannot_assess` plus a machine-readable reason. Do not store a provider-supplied `fit`, do not duplicate `arrivalFrom`, `departureBy`, desk, late-arrival, source, or freshness fields, and do not include flight times as implicit input. Equality rules and all `cannot_assess` cases in §3.2 must have unit fixtures.

**Test:** with no scenario time or no relevant confirmed boundary, the resolver can return only `cannot_assess`; requestability cannot change the outcome.

### D2 — Present outcome and proof as one inseparable decision unit

On prototype result/detail/handoff states, order the unit: outcome heading → always-visible comparison sentence → published fact/source → exception/next step → expaify capability boundary. Never render a standalone outcome chip. Use `Cannot assess from published times`, not bare `Unknown`, and name the missing input or fact.

The collapsed production result card remains unchanged while intent/evidence are absent. In the research prototype, at most one fit line may appear and only for an explicitly entered scenario; default unknown does not become a chip on every card.

**Test:** a screen-reader or visual reader can encounter the outcome and both compared times without opening a disclosure; at 375px no line is truncated or overlaid.

### D3 — Keep standard facts, request-only exceptions, and verification distinct

Use these exact semantic rules:

- `Fits standard times` describes only the published standard boundary.
- `Outside standard times` remains outside even when an exception is requestable.
- `Request-only — not guaranteed` appears only with provider/property evidence of that exception.
- With no published exception path, say `No exception path is published. Verify before booking.`
- A contact/notification obligation is an instruction, not a request or guarantee.
- Continuing from expaify never means selected, sent, acknowledged, or guaranteed.

Do not duplicate the generic **Special requests** block. The fit unit may point to it at handoff, while the existing block remains the single explanation of request states.

**Test:** no scenario copy contains `available`, `approved`, `confirmed`, or `fits` solely because a request or notification path exists.

### D4 — Block late-night computation until the upstream contract represents the fact

UXDES must not define arrival-after-standard-end logic against `lateArrival.cutoff`. First obtain an upstream logistics-contract revision that represents the property's published standard end and its local-day association, or explicitly remove that scenario from computable states. Overnight or ambiguous comparisons resolve to `Cannot assess from published times`.

**Test:** a fixture containing only `contact_property_required` with cutoff `22:00` and traveler arrival `23:40` returns `cannot_assess`, not `outside_standard`, `fits_standard`, or `not admitted`.

### D5 — Validate in research before adding production intent capture

UXDES should cover all six scenarios in §4 at 375px and 1280px in a research-only harness under `app/components/research/`, including focus order and source/uncertainty reading order. It must not add arrival/departure inputs to production search, ranking, filters, booking context, analytics, or provider URLs. A later approved ticket may specify explicit property-local intent capture only after the comprehension thresholds in §5 are met and provider evidence exists.

**Test:** production `HotelCard`, search criteria, booking context, and handoff behavior remain untouched by the research prototype; populated fixtures are unreachable from production imports.

## 7. Handoff and blocker

`UXDES-HOTEL-CHECKIN-TIME-FIT-01` should produce `docs/pipeline/hotel-checkin-time-fit/03-design.md` as a **conditional research-prototype spec**, not a production feature spec. It must cover every scenario and state above, the outcome/proof hierarchy, mobile/desktop, keyboard/focus, and final copy.

Before any production UI/logic handoff, two gates must be met:

1. a provider-backed arrival-logistics supply path exists; and
2. the upstream logistics evidence contract can represent a published standard check-in end/local-day association, while a separately approved scope provides explicit traveler time intent.

Until then, production fit remains `Cannot assess`, and showing that state persistently on every result would add clutter without improving the decision.
