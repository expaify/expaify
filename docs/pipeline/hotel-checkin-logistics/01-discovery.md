# UXD-HOTEL-CHECKIN-LOGISTICS-01 — Check-In Logistics Discovery

**Stage:** UX Discovery · **Priority:** P1 · **Feature slug:** `hotel-checkin-logistics`
**Downstream ticket:** `UXR-HOTEL-CHECKIN-LOGISTICS-01`

---

## 1. Pain point

A traveler evaluating a hotel cannot find out **when the property will actually let them in, whether anyone is at the desk when they arrive, what happens if they arrive after hours, and when they must be out** — so a stay that is unusable for a 11:40pm arrival or a 6am departure looks identical to one that is perfect for it, and the mismatch is only discovered at the provider, or at the door.

## 2. Who is affected, and where in the flow

**Who — in priority order:**

1. **Late arrivals** (flight lands after ~21:00, or after the desk closes). Highest stakes: the failure mode is a locked door with a paid, non-refundable room behind it. This is the population the ticket names for task-completion measurement.
2. **Early arrivals** (land 07:00–13:00, standard check-in is 15:00). Lower stakes, high frequency — they need to know there is a gap, not to solve it here.
3. **Early-departure travelers** (checkout time vs. a morning flight or a checkout that is earlier than assumed).
4. **Everyone else**, for whom these are low-salience confirmation facts that must not crowd out price, location, and Deal Score.

**Where — the hotel detail evaluation surfaces, before booking handoff:**

| Surface | File | Current state re: check-in logistics |
|---|---|---|
| Hotel result card, expanded **Details** panel | `app/components/HotelCard.tsx:975-1060` | Renders `DealScorePanel`, `QualityEvidencePanel`, Location, `HotelPetPolicyDetails`, `TrackedSmokingPolicyPanel`, `AccessEvidencePanel`, Price scope, `HotelFundsPolicyPanel`. **No check-in time, desk hours, late-arrival, or checkout content.** |
| Saved-deal detail page | `app/deals/[dealId]/page.tsx` | Sections follow the shipped decision order (`docs/pipeline/hotel-detail-decision-order/03-design.md`): identity → rate/score → Hotel fit → provider handoff → supporting evidence. **No logistics section exists.** |
| Booking handoff | `app/book/BookingFlow.tsx` (`HotelHandoffReview`) | One catch-all line asking the user to confirm "location, taxes, fees, cancellation policy, room details, and live availability with the provider." Arrival timing is not named — it is folded into "room details," and it lands after the decision is already made. |

**The specific trap:** the deal detail page labels a **calendar date** as "Check-in" (`deal.check_in_date`, rendered as e.g. "Mar 12"). The schema compounds this — `deals.check_in_window` (`lib/db/schema.sql:135`) is a **date-range string**, not a time-of-day window. A user scanning for "check-in" finds a field with that exact label already answered, and stops looking. This surface does not merely omit the answer; it presents a same-named field that reads as the answer. Any new field must not inherit the `check_in_window` name.

## 3. Measurable signal that the problem exists

Source-verified, today:

1. **Zero data.** `HotelOffer` (`lib/types.ts:137-151`) carries price, stars, rating evidence, and location. There is no field for check-in time, checkout time, desk hours, or late-arrival handling. `SupplierSmokingStatement.checkin/checkout` (`lib/types.ts:364-365`) are stay-scoping **dates** on a policy statement, not property times — another false friend.
2. **Zero provider supply.** `HotellookProvider` (`lib/providers/hotellook.ts`) parses `hotelId`, `hotelName`, `stars`, `location`, `address`, `distance`, `priceFrom`, `photoUrl`, `propertyType`. No time or desk-hours field is fetched, parsed, or cached. The problem is a supply gap first and a presentation gap second.
3. **Zero UI.** A repo-wide search for check-in-time / front-desk / reception / late-arrival strings in `app/` and `lib/` returns only flight arrival times (`FlightCard.tsx`) and one unrelated resilience fixture. No hotel surface renders any of the four fields.
4. **The success metrics named in the ticket cannot be computed today.** `HotelDecisionAnalytics` (`app/components/HotelDecisionAnalytics.tsx`) emits `hotel_detail_viewed` and per-section reach events keyed on `data-hotel-decision-section`. There is no logistics section, therefore no engagement signal, and no way to segment a handoff by late-arrival intent. **Instrumentation is part of the deliverable**, not a follow-up: downstream stages must name concrete events so TEST can verify the signal exists rather than only that copy renders.

## 4. Relationship to prior work — read before proceeding

`docs/pipeline/arrival-logistics/01-discovery.md` covers an overlapping problem (arrival confidence) across a **wider** field set: check-in, late arrival, airport transfer, parking, and baggage storage. It stopped at discovery and never shipped. Since then, parking shipped independently as `HotelParking.tsx` + `HotelParkingEvidence` (`lib/types.ts:172-200`).

**This ticket is the narrow, temporal slice and supersedes the arrival-logistics scope for these four fields only:** check-in window, front-desk availability, late-arrival process, checkout time.

**Explicitly out of scope:** parking (shipped), airport/ground transfer, baggage storage, cancellation policy (`docs/pipeline/cancellation-policy/`), deposits/holds (`HotelFundsPolicyPanel`). Downstream stages must not re-open them. If UXR concludes the model cannot be coherent without transfer or baggage, that is a conflict to report, not to absorb.

## 5. Constraints the solution must respect

1. **Data integrity — no inferred times, ever.** Do not print "Check-in from 3:00 PM" as an industry default, a star-class heuristic, or a paraphrase. Only a verified property or provider field may be stated as fact; everything else renders as an explicit unavailable state. Reuse the established evidence shape in this repo (`HotelRatingEvidence` confidence, `HotelParkingEvidence.state: 'loading' | 'ready' | 'error'`, `HotelRateRestrictions`' `not_provided` member) rather than inventing a fourth vocabulary. Each stated fact carries a source label and `fetchedAt`. **An unavailable field is a required, designed state with its own copy — not a hidden row.** Given constraint 2, unavailable is the *default* rendering path and must be the first state designed, not the fallback.
2. **Provider-feed reality bounds what ships.** No provider returns these fields today. A UI stage can deliver: the evidence type, the prioritized panel with every state, correct handling of the calendar-date-vs-arrival-time collision, the honest unavailable state, and the analytics. Populating real values requires a provider/pipeline change and must be scoped as its own DEV ticket — do not let a Fable stage fabricate a fixture-backed "verified" fact and call it shipped. Research fixtures must live under `app/components/research/` and never leak into a production code path.
3. **Compact and mobile-first density; it must not outrank price, score, or location.** These are confirmation facts, not decision drivers, for the majority of users. The collapsed `HotelCard` row is a wrapping `text-xs` chip line — at most one short chip may appear there, and only when it changes a decision (late-arrival relevant). Full detail lives in the expanded Details panel and the deal-detail page, inside the shipped five-section decision order, without displacing sections 1–4. Usable at 375px and 1280px, no overlapping text, no decorative clutter, existing `app/globals.css` tokens only.

## 6. Prioritized logistics information model (hypothesis for UXR to validate)

The ticket's success criterion is a *prioritized* model. Discovery's ranking, by decision impact — UXR must confirm or reorder against reference patterns (Booking.com property "House rules", Google Hotels "Check-in/Check-out"):

| Rank | Field | Why it ranks here | Decision it changes |
|---|---|---|---|
| 1 | **Late-arrival process** | Only field whose absence can produce a locked door on a paid stay | Book vs. don't book |
| 2 | **Front-desk availability** (24h / staffed hours / self check-in) | Determines whether rank 1 is even a question; the honest answer for many properties | Book vs. don't book |
| 3 | **Check-in window** (earliest time) | High frequency, low stakes — sets expectations for early arrivals | Plan, rarely reject |
| 4 | **Checkout time** | Lowest urgency at evaluation; matters on the last morning | Plan |

Ranks 1–2 are the *late-arrival scenario* the ticket asks to measure; ranks 3–4 are expectation-setting. A model that leads with check-in time (the industry-default presentation) buries the only field that can prevent a failed stay. UXR should specifically test whether the late-arrival answer can be expressed usefully when desk hours are unknown — the most likely real-world state.

## 7. Success statement

**This is solved when a first-time user evaluating a hotel for a 11:40pm arrival can determine, before leaving expaify, whether the property will let them in — or can see plainly that the property has not told us — without mistaking the "Check-in" calendar date for an arrival time, and without any check-in time, desk hour, or late-arrival claim appearing on screen that a provider did not supply.**

**Verifiable at TEST:**
- Late-arrival, desk-availability, check-in-window, and checkout fields render in the priority order above, each in its verified state and its unavailable state, at 375px and 1280px.
- No default, inferred, or star-class-derived time appears anywhere in the delivered code.
- The calendar-date "Check-in" label on `app/deals/[dealId]/page.tsx` no longer reads as an arrival time.
- Logistics engagement and late-arrival-scenario handoff events fire and are queryable.
- Sections 1–4 of the shipped decision order are not displaced; no regression on the hotel card, deal detail, or booking handoff.
