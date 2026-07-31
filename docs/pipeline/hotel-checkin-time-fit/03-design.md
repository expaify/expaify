# UXDES-HOTEL-CHECKIN-TIME-FIT-01 — Conditional hotel time-fit research prototype

Date: 2026-07-31  
Stage: UX Design  
Priority: P0  
Upstream: `docs/pipeline/hotel-checkin-time-fit/02-research.md`  
Required evidence owner: `docs/pipeline/hotel-checkin-logistics/`

> **DEFER — RESEARCH PROTOTYPE ONLY.** This specification does not authorize production arrival/departure inputs, hotel-card fit labels, ranking, filters, booking-context changes, provider fields, or analytics. Production fit remains unavailable until both gates in §2 pass. Fixture-backed states must be unreachable from production imports.

## 1. Design decision

Validate one inseparable decision unit in this order:

1. **Fit outcome** — `Fits standard times`, `Outside standard times`, or `Cannot assess from published times`.
2. **Comparison** — the explicit traveler scenario time and the relevant published standard boundary in one always-visible sentence.
3. **Published facts** — the full relevant standard range or deadline, source, and checked/updated date when supplied.
4. **Exception or next step** — request-only, mandatory notification, no published exception path, or verification.
5. **Uncertainty and capability boundary** — what is missing or conflicting and what expaify has not selected, sent, acknowledged, or guaranteed.

The outcome may lead visually, but it never renders without its comparison or reason in the same semantic region. A request or notification never changes an `Outside standard times` result to `Fits standard times`.

This is a conditional prototype specification, not evidence validation from participant sessions. The hierarchy is ready to test; it is not production-validated until §14 passes.

## 2. Hard gates and ownership boundary

### Gate A — explicit property-local traveler intent

The prototype may use synthetic scenario intent selected by a researcher. Production has no expected property-arrival time or planned room-vacate time. Stay dates, flight arrival times, transfer estimates, device time, and checkout dates are not substitutes.

Do not add production inputs to search, results, booking context, provider URLs, persistence, or analytics under this ticket. A later APPROVED FEATURE must specify consent, property-local date/time entry, validation, editing, and continuity.

### Gate B — upstream published-time evidence

Fit may be computed only from confirmed, non-conflicting facts owned by `HotelArrivalLogisticsEvidence`. This ticket does not define a second hotel-time evidence model and does not copy `arrivalFrom`, `departureBy`, desk access, late-arrival obligation, source, or freshness into a fit type.

Late-night fit has an additional closed gate. The upstream logistics owner must independently represent:

- the published **standard check-in end**; and
- the property-local calendar/service-day association needed to interpret that end around midnight.

`lateArrival.cutoff` is an obligation boundary such as “contact the property after 22:00.” It is not a standard check-in end, desk-closing time, admission guarantee, or refusal boundary. Until the upstream contract is revised and its normalized fact is available, an arrival-after-end comparison returns `cannot_assess`.

The prototype may display the known-standard-end scenario only after the research harness imports an approved upstream-contract fixture. It must not invent a local `arrivalUntil`, `standardEnd`, or equivalent duplicate fact. Before that revision, keep the known-end fixture disabled with the researcher-facing reason: `Blocked: published standard check-in end and local-day association are not represented by the upstream logistics contract.`

### Production behavior while gates are closed

- Do not add a default unknown chip or line to collapsed `HotelCard` results.
- Do not add time-fit content to production hotel detail or booking handoff.
- Do not alter the existing **Special requests** block.
- Do not infer a fit from any currently available field.
- Production remains semantically `Cannot assess from published times`, but that sentence is not repeated on every result card.

## 3. Prototype boundary and placement

The UI handoff may create only:

- `app/components/research/HotelCheckinTimeFitPrototype.tsx`;
- `app/components/research/hotelCheckinTimeFitFixtures.ts`;
- colocated research-only tests; and
- an isolated research route or harness already excluded from normal product navigation and production imports.

Every prototype screen visibly starts with:

`Research prototype — hotel time fit is not part of ranking or Deal Score.`

Use synthetic hotel and provider identities. No production provider call, live hotel offer, saved deal, booking context, cache, database row, or outbound affiliate URL may feed the prototype. Production modules must not import the prototype or its fixtures.

Within the product-shaped detail condition, preserve the current decision order:

1. Stay details
2. Price and Deal Score
3. Hotel fit
   - `Arrival and departure time fit` prototype unit
4. Check rooms with provider
5. Supporting evidence

The unit is a subsection of **Hotel fit**, not a sixth top-level section. The prototype result-comparison condition may show one fit line only after an explicit scenario has been assigned. It must not render unknown on every collapsed card. The handoff condition repeats the same outcome, scenario, facts, and revision; it must not recalculate from different fixture data.

## 4. Hierarchy and component anatomy

Use one `<section aria-labelledby>` per fit unit. DOM and visual order are identical:

1. Eyebrow: `Arrival and departure time fit`
2. Outcome heading
3. Always-visible comparison/reason sentence
4. `Published standard times` fact group
5. `Exception and next step` group
6. Persistent expaify capability boundary
7. Source/freshness metadata

Primary content is the outcome plus comparison. Secondary content is the published fact and action. Tertiary content is source, freshness, prototype label, and capability boundary; tertiary does not mean hidden, tooltip-only, or low-contrast.

Do not use an outcome-only badge, icon-only state, tooltip, accordion, success check, alarm triangle, red/green polarity, or a fourth `fits with request` outcome. The complete decision unit is visible without disclosure.

### Result-comparison condition

Show one two-line textual cue inside the existing product-shaped `Details` link area, not a separate control:

- line 1: the outcome;
- line 2: the comparison/reason sentence.

The cue uses the same fixture revision as detail. It cannot be a ranking factor, filter, sort, recommendation, or Deal Score input.

### Detail and handoff conditions

Render the full unit. At handoff, append the existing single-source request guidance pointer only when the fixture has a request-only exception:

`See Special requests below for how requests work.`

Do not repeat the definitions of selected, sent, acknowledged, or guaranteed from the production **Special requests** block.

## 5. Research-only presentation resolver

The resolver derives presentation only. Provider evidence remains in the upstream logistics object.

```ts
type HotelTimeFitOutcome =
  | 'fits_standard'
  | 'outside_standard'
  | 'cannot_assess'

type HotelTimeFitReason =
  | 'arrival_at_or_after_start'
  | 'arrival_before_start'
  | 'arrival_after_standard_end'
  | 'departure_at_or_before_deadline'
  | 'departure_after_deadline'
  | 'missing_scenario_time'
  | 'missing_relevant_boundary'
  | 'missing_standard_end_contract'
  | 'ambiguous_local_day'
  | 'conflicting_evidence'
  | 'malformed_time'
  | 'evidence_loading'
  | 'evidence_error'

interface HotelTimeFitPresentation {
  outcome: HotelTimeFitOutcome
  reason: HotelTimeFitReason
  outcomeCopy: string
  comparisonCopy: string
}
```

The presentation object must not store copies of provider fact values, exception facts, source, or freshness. Render those directly from the upstream evidence supplied to the research harness.

### Exhaustive resolution order

1. Evidence loading → `cannot_assess / evidence_loading`.
2. Evidence error → `cannot_assess / evidence_error`.
3. Conflict affecting the relevant boundary or its day association → `cannot_assess / conflicting_evidence`.
4. Missing explicit scenario time → `cannot_assess / missing_scenario_time`.
5. Malformed scenario or boundary time → `cannot_assess / malformed_time`.
6. Arrival after a standard end when the upstream fact/day contract is absent or ambiguous → `cannot_assess / missing_standard_end_contract` or `ambiguous_local_day`.
7. Arrival before confirmed `arrivalFrom` on the same unambiguous property-local day → `outside_standard / arrival_before_start`.
8. Arrival equal to or after `arrivalFrom`, and not after a confirmed standard end when such an end is applicable → `fits_standard / arrival_at_or_after_start`.
9. Planned room vacate after confirmed `departureBy` → `outside_standard / departure_after_deadline`.
10. Planned room vacate equal to or before confirmed `departureBy` → `fits_standard / departure_at_or_before_deadline`.
11. Missing relevant confirmed boundary → `cannot_assess / missing_relevant_boundary`.

Requestability, a fee, notification, desk access, and special-request copy are never resolver inputs. An `arrivalFrom` alone cannot establish that a late-night arrival fits. The comparison uses property-local wall-clock values and an explicit associated stay date; never compare bare `HH:MM` strings across midnight.

## 6. Final copy deck

Only replace braced values. Display times in the fixture's property locale using a consistent 12-hour form for this English study (`3:00 PM`, `11:00 PM`), while source facts retain their normalized values internally. Include the property-local date when it is needed to remove overnight ambiguity.

### Outcomes

| Outcome | Heading |
|---|---|
| `fits_standard` | `Fits standard times` |
| `outside_standard` | `Outside standard times` |
| `cannot_assess` | `Cannot assess from published times` |

Never shorten the unknown heading to `Unknown` or `Cannot assess`.

### Comparison/reason sentences

| Reason | Final copy |
|---|---|
| `arrival_before_start` | `You plan to arrive at {traveler time}; standard room access starts at {arrival start}.` |
| `arrival_after_standard_end` | `You plan to arrive at {traveler time}; the published standard check-in period ends at {standard end}.` |
| `arrival_at_or_after_start`, no applicable end | `You plan to arrive at {traveler time}; standard room access starts at {arrival start}.` |
| `arrival_at_or_after_start`, end represented | `You plan to arrive at {traveler time}; the published standard check-in period is {arrival start}–{standard end}.` |
| `departure_after_deadline` | `You plan to use the room until {traveler time}; the published room-vacate deadline is {departure deadline}.` |
| `departure_at_or_before_deadline` | `You plan to leave at {traveler time}; the published room-vacate deadline is {departure deadline}.` |
| `missing_scenario_time`, arrival | `Your expected property-arrival time is not included in this scenario.` |
| `missing_scenario_time`, departure | `Your planned room-vacate time is not included in this scenario.` |
| `missing_relevant_boundary`, arrival | `The property source does not publish the standard arrival boundary needed for this comparison.` |
| `missing_relevant_boundary`, departure | `The property source does not publish a room-vacate deadline.` |
| `missing_standard_end_contract` | `The property publishes a late-arrival instruction, but the standard check-in end is not represented separately.` |
| `ambiguous_local_day` | `The published time cannot be matched safely to the property’s local stay date.` |
| `conflicting_evidence` | `Published sources disagree about the time needed for this comparison.` |
| `malformed_time` | `A published or scenario time could not be interpreted safely.` |
| `evidence_loading` | `Published arrival and departure times are still being checked.` |
| `evidence_error` | `Published arrival and departure times could not be checked.` |

### Fact-group labels and patterns

| Element | Final copy |
|---|---|
| Fact group heading | `Published standard times` |
| Arrival range | `Standard room access: {arrival start}–{standard end}` |
| Arrival start only | `Standard room access starts: {arrival start}` |
| Departure deadline | `Room-vacate deadline: {departure deadline}` |
| Contact obligation | `Late-arrival instruction: Contact the property before arrival if you arrive after {obligation cutoff}.` |
| No relevant fact | `No usable published standard time is available for this comparison.` |
| Source with date | `Property information from {source} · Checked {Mon D, YYYY}` |
| Source without date | `Property information from {source} · Check the current policy before booking.` |
| Conflict metadata | `Conflicting property information from {source list}. No source was chosen as current.` |

Do not label the obligation cutoff as `standard check-in ends`, `last check-in`, `desk closes`, or `late check-in available`.

### Exception and next-step copy

| Condition | Heading and final copy |
|---|---|
| Fits, no action evidenced | `Next step` — `No time exception is indicated by this comparison. Confirm current property policies with the booking partner before payment.` |
| Early check-in request evidenced | `Exception and next step` — `Early check-in is request-only and not guaranteed. Ask the booking partner while booking; expaify does not send it.` |
| Late checkout request evidenced | `Exception and next step` — `Late checkout is request-only and not guaranteed. Ask the booking partner while booking; expaify does not send it.` |
| No published exception path | `Exception and next step` — `No exception path is published. Verify with the property or booking partner before booking.` |
| Contact obligation only | `Required next step` — `The published instruction requires contacting the property before arrival. This does not show whether your arrival fits the standard check-in period.` |
| Exception evidence missing | `Next step` — `The source does not publish an exception path. Verify before booking if this timing affects your stay.` |
| Conflict, malformed, or error | `Next step` — `Verify the current times and any exception directly with the property or booking partner before booking.` |

Persistent capability boundary in every full detail/handoff unit:

`expaify has not selected, sent, acknowledged, or guaranteed a time exception.`

For a fits scenario, this sentence remains visible but must not imply that an exception is needed.

## 7. Required scenario fixtures

Fixtures are synthetic and research-only. Each has one immutable `fixtureRevision`; result, detail, and handoff conditions must display the same revision and scenario values.

| ID | Scenario and evidence | Outcome | Required presentation |
|---|---|---|---|
| `early_arrival_request` | Arrive `12:00 PM`; standard access starts `3:00 PM`; early check-in request evidenced | `Outside standard times` | Show both times; `Early check-in is request-only and not guaranteed.` Never say it fits if requested. |
| `late_known_end_no_path` | Arrive `11:40 PM`; approved upstream fact says standard period ends `11:00 PM`; no exception path | `Outside standard times` | **Blocked until Gate B.** When enabled, show end fact and `No exception path is published.` Never infer refusal or desk closure. |
| `late_obligation_only` | Arrive `11:40 PM`; contact required after `10:00 PM`; no independent standard end | `Cannot assess from published times` | Show obligation as a separate fact and required action. Never use `10:00 PM` as the comparison boundary. |
| `post_checkout_request` | Need room until `2:00 PM`; room-vacate deadline `11:00 AM`; late checkout request evidenced | `Outside standard times` | Show both times; request-only and not guaranteed. Do not infer a fee or luggage storage. |
| `early_departure_control` | Leave `6:00 AM`; room-vacate deadline `11:00 AM` | `Fits standard times` | `Leaving earlier fits the published room-vacate deadline.` Do not infer desk, key return, breakfast, or transport availability. |
| `missing_intent_or_fact` | Missing scenario time, missing boundary, or conflicting boundary variants | `Cannot assess from published times` | Name exactly which input/fact is missing or conflicting. Never substitute flight time, norms, stars, dates, or another hotel. |

Add boundary fixtures:

- arrival exactly at `arrivalFrom` → fits;
- arrival exactly at an approved standard end → fits;
- room vacate exactly at `departureBy` → fits;
- requestability toggled on/off → outcome unchanged;
- obligation cutoff only + `11:40 PM` arrival → cannot assess;
- overnight or missing day association → cannot assess;
- malformed `25:00`, missing source, evidence error, evidence loading, and conflict → cannot assess.

## 8. Complete state behavior

### Default

The researcher assigns a scenario before exposing the product-shaped condition. Render the outcome and comparison immediately. No animation, count-up, delayed reveal, or auto-focused result.

### Loading

- Outcome: `Cannot assess from published times`.
- Comparison: `Published arrival and departure times are still being checked.`
- Put `aria-busy="true"` on the fit section.
- Use one `role="status" aria-live="polite" aria-atomic="true"` sentence.
- Three skeleton lines are `aria-hidden="true"`.
- Existing details, Back, and research navigation remain enabled. Loading fit data never disables a provider-shaped CTA.
- When resolved, update the existing live region once; do not move focus.

### Empty / evidence not returned

Use `cannot_assess / missing_relevant_boundary` and name whether arrival start, standard end, departure deadline, or traveler time is absent. Do not show a blank row, em dash without explanation, retry, or generic `No data`.

### Error

- Outcome: `Cannot assess from published times`.
- Comparison: `Published arrival and departure times could not be checked.`
- Next step: the conflict/error copy in §6.
- A research-only **Retry scenario check** button is permitted only if the harness can deterministically transition the fixture to a declared next state. It never calls a provider, changes hotel inventory, or implies a booking retry.
- If no deterministic transition exists, omit Retry.

### Conflict

Render both source-attributed facts in the fact group, outcome `Cannot assess from published times`, and the conflict metadata. Never average, select the newer claim automatically, or compute against either boundary.

### Partial

Render every valid relevant fact and state the missing piece. Examples:

- `arrivalFrom` plus obligation cutoff but no standard end: late-night outcome cannot assess;
- departure deadline plus no exception evidence: fit may compute, but next step says no exception path is published;
- valid arrival evidence plus unrelated missing departure evidence: an arrival scenario may compute; do not let an unrelated missing field force unknown.

### Stale or malformed

A source-specific upstream freshness rule decides stale; the component does not invent an age limit. A stale, malformed, or source-less relevant boundary is unusable and resolves to cannot assess. Show `The published time is out of date and is not used for this comparison.` or the malformed copy in §6, then verification guidance.

### Focus and keyboard

Static ready/empty/conflict/partial states add no tab stops. Native research scenario controls precede the product-shaped screen in DOM order. Normal product-shaped focus order is existing Details control → optional deterministic Retry → existing subsequent controls.

- `Enter` or `Space` activates the Details and Retry buttons.
- Focus remains on the activating control after expansion or retry.
- No state transition moves focus to the outcome.
- Global `:focus-visible` styling remains unobscured with at least 3px visual outline and 3px offset.
- Escape has no special behavior because this is not a modal.

### Screen readers and announcements

- Outcome is an `<h3>` or the next correct heading level, not a badge.
- Comparison immediately follows it in DOM order.
- Fact and next-step groups use semantic headings; use `<dl>` only for actual label/value facts.
- Static unknown/conflict copy is not announced on initial load.
- Async loading/error/resolution uses one polite atomic status; do not duplicate announcements at result and detail simultaneously.
- Decorative marks and skeletons are `aria-hidden="true"`.

## 9. Responsive layout

### Mobile — 375px viewport

- One column; no horizontal scroll; minimum supported content width 320px.
- Fit unit fills available width with `min-w-0` and wrapping text; no truncation, line clamp, or fixed height.
- Outcome, comparison, facts, action, capability, and metadata stack with 12–16px visual gaps.
- A standard range stays readable if it wraps after the label.
- Any Retry control is full width at 375px and at least 44px high.
- The full unit appears before the provider-shaped action; opening no disclosure is required.
- Prototype researcher controls are visually separated from the product-shaped card and never overlap sticky product controls.

### Desktop — 1280px viewport

- Keep the existing content max-width and product hierarchy.
- Inside the fit unit, outcome/comparison remain full width.
- Published facts and exception/next step may form `md:grid-cols-2`; source metadata and capability boundary span both columns.
- Do not place outcome and proof in separate columns.
- Do not move the unit beside price or Deal Score, and do not create a dashboard of equal-weight status cards.

## 10. Tailwind patterns and tokens

Use only tokens in `app/globals.css`. Add no color, radius, typography, or shadow token.

```txt
prototype shell:
  min-w-0 rounded-[var(--radius-card)] border border-[color:var(--border)]
  bg-[color:var(--bg-surface)] p-4 sm:p-5

research label:
  mb-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)]
  bg-[color:var(--bg-muted)] px-3 py-2 text-caption font-semibold
  text-[color:var(--text-2)]

fit section:
  min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)]
  bg-[color:var(--bg-raised)] p-4

eyebrow / group label:
  text-caption font-semibold uppercase tracking-wide text-[color:var(--text-3)]

outcome:
  mt-1 text-h3 text-[color:var(--text-1)]

comparison:
  mt-2 text-body font-medium text-[color:var(--text-1)]

groups:
  mt-4 grid min-w-0 gap-4 md:grid-cols-2

group panel:
  min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)]
  bg-[color:var(--bg-surface)] p-3

group heading:
  text-small font-bold text-[color:var(--text-1)]

fact / action copy:
  mt-2 text-small text-[color:var(--text-2)]

metadata / capability:
  mt-3 text-caption text-[color:var(--text-3)]

outside or uncertainty accent:
  border-l-4 border-l-[color:var(--gold-deep)]

loading skeleton:
  h-4 animate-pulse rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]

research retry:
  btn btn-outline mt-4 w-full sm:w-auto
```

`Fits standard times` uses the neutral fit-section treatment; do not add success fill. `Outside` and `Cannot assess` may share the non-alarm `--gold-deep` left rule because both require reading, but they remain distinguishable by their headings and copy. Never use `--error` as text; use `--error-text` only for a true harness failure, not an ordinary mismatch.

## 11. Interaction rules

- Selecting a researcher scenario replaces the complete fixture atomically and resets timing measurements; it does not simulate traveler production input.
- Opening Details reveals the same revision; it performs no recomputation and no request.
- Activating the provider-shaped next action records the participant choice only; use a non-navigating research control labelled `Continue in prototype`. Do not generate or open a vendor deeplink.
- The participant decision choices are `Keep`, `Rule out`, and `Verify`. They appear after the product-shaped condition, not inside the hotel fit unit, so the UI does not recommend one.
- Enter on a focused decision button selects it once. A participant may change the choice before advancing; record the first and final choices.
- Retry, when present, transitions only to the fixture-declared state and announces the resulting comparison once.
- No action changes request state to sent, acknowledged, approved, confirmed, or guaranteed.

## 12. Edge cases and forbidden inferences

- Locale/day: include the property-local date when a time could belong to either side of midnight. Missing or invalid association means cannot assess.
- Daylight-saving transition: if the wall-clock time is repeated or skipped and the upstream fact lacks an offset/zone rule, cannot assess.
- Range crossing midnight: do not normalize or split it in the component. Only a future upstream contract with explicit service-day semantics may make it computable.
- Equality: all published boundaries are inclusive for this prototype.
- Early departure: fits the room-vacate deadline; says nothing about front desk, key return, breakfast, transport, or luggage.
- Arrival after standard end: outside means outside the published standard period, not refused, cancelled, no-show, or locked out.
- Request path: never infer availability, cost, acceptance, transmission, or guarantee.
- Notification obligation: never relabel it a request-only exception or admission permission.
- Missing exception evidence: `No exception path is published` does not mean no exception exists.
- Flight itinerary: never use it as property-arrival intent.
- Dates: `Check-in date` and `Check-out date` are not time evidence. The upstream logistics rename remains owned by that work and is not duplicated here.
- Time zones: never compare browser/device time with property-local time.
- Source conflict: never choose by recency unless the upstream source contract explicitly authorizes precedence.

Forbidden outcome/copy patterns:

- `Fits with request`
- `Late check-in available`
- `Approved`, `Confirmed`, or `Guaranteed` for an exception
- `You will be refused`
- `Front desk closed` derived from standard end
- `Contact after 10:00 PM means check-in ends at 10:00 PM`
- `Most hotels allow…` or any class/market norm

## 13. Prototype instrumentation

Research instrumentation is local to the harness and must not extend production analytics. Record:

- anonymous participant/session ID;
- hierarchy condition `outcome_first` or `facts_first`;
- fixture ID and revision;
- viewport `375` or `1280`;
- first and final `keep | rule_out | verify` choice;
- free-text or coded answer for outcome, relevant fact, exception certainty, and next step;
- mismatch-identification time;
- confidence 1–5 after the factual answer;
- whether Details was opened;
- whether the participant inferred available, sent, acknowledged, approved, guaranteed, refused, or desk closed;
- early-departure false-mismatch flag.

Do not log real hotel, itinerary, arrival, departure, contact, or free-text personal data. The facts-first variant reverses only the first two visual groups for the assigned research condition; its DOM remains logical and it still never hides outcome/proof. Do not expose an outcome-only variant.

## 14. Validation protocol and advancement gates

Run a moderated within-subject study with 8–10 first-time expaify users who independently booked a hotel in the last 12 months. Randomize the first three risk scenarios; counterbalance the early-departure and unknown cases. Compare:

- A: outcome heading + always-visible comparison first;
- B: published facts first, followed by outcome + always-visible comparison.

Advance the hierarchy direction only when:

1. at least 7 of the first 8 participants are correct per scenario on outcome, relevant fact, exception certainty, and next step;
2. zero participants make a high-confidence false guarantee after viewing the full hierarchy;
3. zero participants label the early-departure control as outside standard times;
4. median mismatch-identification time is under 15 seconds for early arrival and post-checkout use;
5. unknown/obligation-only cases produce `Verify` with the correct reason, not a guessed fit; and
6. both 375px and 1280px conditions preserve complete, unclipped reading order and keyboard access.

Production remains blocked even if comprehension passes until:

- a provider-backed arrival-logistics supply path exists;
- the upstream evidence contract independently carries standard check-in end plus local-day association;
- an APPROVED FEATURE defines explicit property-local traveler intent; and
- Product opens a new production UXD/UXR cycle for ranking/prominence and privacy implications.

## 15. UI handoff acceptance criteria

The research-only UI handoff is complete only when all are true:

1. The prototype and every populated fixture are under the research-only boundary and unreachable from production imports/navigation.
2. Every screen visibly says it is a research prototype and not part of ranking or Deal Score.
3. Outcome → comparison → published facts → exception/next step → uncertainty/capability is complete and always visible in the baseline condition.
4. All six scenarios and all boundary fixtures in §7 exist; the known-standard-end scenario stays disabled until the approved upstream fact contract exists.
5. Obligation cutoff alone always returns `cannot_assess`.
6. Missing, loading, error, conflict, malformed, stale, overnight, and ambiguous-day states are specified and tested.
7. Requestability never changes the fit outcome.
8. Result, detail, and handoff conditions use one immutable fixture revision.
9. No production search, `HotelCard`, deal detail, booking context, `HotelHandoffReview`, provider, shared type, ranking, filter, analytics, or deeplink is modified.
10. The existing **Special requests** block is neither copied nor changed.
11. 375px and 1280px layouts have no overlap, clipping, truncation, or horizontal scroll.
12. Keyboard order, focus-visible treatment, headings, live regions, and status announcements follow §8.
13. Unit tests cover the exhaustive resolver order and forbidden late-night inference.
14. `npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests` exit 0.

## 16. Handoff

Create `UI-HOTEL-CHECKIN-TIME-FIT-01` only for the isolated, fixture-backed research prototype described here. The UI ticket must preserve both blockers: no production time-intent capture, and no late-night fit computation from an obligation cutoff. The published-standard-end fixture remains disabled until `hotel-checkin-logistics` owns and represents that fact with its local-day association.

Do not create a DEV/provider ticket from this artifact. Production logic and provider supply are explicitly out of scope and require new approved upstream work.
