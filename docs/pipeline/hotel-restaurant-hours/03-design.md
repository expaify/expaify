# UXDES-HOTEL-RESTAURANT-HOURS-01: Hotel Dining Availability Fit Design Spec

Date: 2026-07-31  
Stage: UX Design  
Priority: P2  
Upstream: `docs/pipeline/hotel-restaurant-hours/02-research.md`  
Surfaces: saved hotel detail → hotel booking review → attributed provider handoff

## 1. Decision And Scope

Design a details-first, provider-backed `Dining availability` block that answers whether one or more traveler-accepted on-property services overlap a required property-local time. Restaurant, room service, and breakfast service remain independent channels. The block belongs inside `Hotel fit`, before the provider handoff, and repeats unchanged at the final expaify-controlled hotel review.

There are two deliberately separate delivery modes:

1. **Production-safe UI:** the currently wired Hotellook supplier is unsupported. Render one concise unsupported disclosure and no service rows, time input, match claim, result cue, rank change, or filter.
2. **Moderated research prototype:** use visibly synthetic, local fixtures to compare schedule-only, preset-assisted, and explicit-time variants. Prototype input and fit calculations do not affect live results, ranking, Deal Score, provider queries, saved criteria, or production analytics.

Production positive claims require an approved provider whose data enters through `lib/providers`, passes the normalized contract in §4, and has documented attribution and freshness semantics. A production input or filter additionally requires the research gates in §18. This ticket does not approve either.

Out of scope: menus, cuisine, dietary suitability, prices, restaurant reservations, live table/order capacity, delivery, minibar/vending, off-property food, breakfast inclusion, and post-booking contact flows.

## 2. User Decision And Content Hierarchy

The block answers, in order:

1. **Primary:** Does at least one service the traveler accepts cover the entered property-local time?
2. **Secondary:** What is the status and schedule of each independently reported service?
3. **Tertiary:** Which source supplied the schedule, when was it fetched, and what is not guaranteed?

Do not place dining beside price or Deal Score, style it as a deal benefit, or combine it with rate inclusion. `Breakfast service · 6:30 AM–10:30 AM` describes property availability; `Breakfast included` remains a separate rate-scoped statement and cannot produce a fit.

Required page reading order:

`Property and stay` → `Price and Deal Score` → `Hotel fit` (class, rating, existing evidence, dining) → `Check rooms with provider` → `Supporting evidence`.

Within `Hotel fit`, existing class/rating facts remain first. `Dining availability` follows the existing facts/evidence and is the final decision block immediately before handoff.

## 3. Component And Surface Ownership

### 3.1 Proposed UI boundary

Use one presentation component with no vendor parsing or network calls:

```ts
type HotelDiningSurface = 'saved_detail' | 'booking_review' | 'research_prototype';

interface HotelDiningAvailabilityProps {
  offerId: string;
  provider: string;
  surface: HotelDiningSurface;
  evidence?: HotelDiningEvidence;
  capability?: HotelDiningCapability;
  need?: HotelDiningNeed;
  fit?: HotelDiningFitResult;
  loadState: 'loading' | 'refreshing' | 'ready' | 'error';
  onRetry?: () => void;
}
```

The data layer owns validation and matching. The component receives a normalized presentation result; it never parses vendor hours, compares strings, infers time zones, calls an external API, or decides freshness.

### 3.2 Required reachable surfaces

- Saved detail: mount within `app/deals/[dealId]/page.tsx`, inside the `saved-hotel-fit-title` section after current hotel-fit evidence and before `saved-provider-title`.
- Booking review: mount within `HotelDecisionSummary` in `app/book/BookingFlow.tsx`, inside `hotel-fit-title` after existing fit evidence and before the provider-handoff section.
- Research prototype: isolated fixture route, Storybook-equivalent harness, or test-only mode inaccessible from normal results. Label it `Research prototype — sample hours` at the page and block level.
- `HotelCard`: do not make it the sole implementation target because it is not mounted in the live flow. If it is later mounted, show dining only in expanded detail and only under the same gates.

No dining cue appears on `DealCard`, the results grid, filter bar, sorting, or Deal Score in this stage.

## 4. Provider-Neutral Data Contract

The future implementation should add a dedicated family to `lib/types.ts`; do not add dining ids to `HotelAmenityEvidence`.

```ts
type HotelDiningService =
  | 'restaurant'
  | 'room_service'
  | 'breakfast_service';

type HotelDiningHoursStatus =
  | 'confirmed'
  | 'not_returned'
  | 'unknown'
  | 'conflicting'
  | 'stale';

type HotelDiningScheduleMode = 'scheduled' | '24_hours' | 'closed';
type HotelDiningWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface HotelDiningLocalWindow {
  /** Opening day in property-local time. */
  day: HotelDiningWeekday;
  /** Strict 24-hour HH:mm, 00:00 through 23:59. */
  startLocal: string;
  /** Strict 24-hour HH:mm. End <= start means next local day. */
  endLocal: string;
}

interface HotelDiningDateOverride {
  /** YYYY-MM-DD in property-local calendar. */
  localDate: string;
  mode: HotelDiningScheduleMode;
  /** Present only for scheduled; every window starts on localDate. */
  windows?: readonly Pick<HotelDiningLocalWindow, 'startLocal' | 'endLocal'>[];
}

interface HotelDiningServiceEvidence {
  service: HotelDiningService;
  propertyId: string;
  supplier: string;
  status: HotelEvidenceStatus;
  /** Only property is valid for the first release. */
  scope: 'property';
  hoursStatus: HotelDiningHoursStatus;
  schedule?: {
    mode: HotelDiningScheduleMode;
    timezone: string;
    weeklyWindows?: readonly HotelDiningLocalWindow[];
    dateOverrides?: readonly HotelDiningDateOverride[];
  };
  sourceLabel: string;
  fetchedAt: string;
  confidence: HotelAmenityConfidence;
  evidenceRevision: string;
}

type HotelDiningCapabilityState = 'supported' | 'partial' | 'unsupported' | 'unknown';
type HotelDiningDimensionCapability = 'supported' | 'unsupported' | 'unknown';

interface HotelDiningServiceCapability {
  service: HotelDiningService;
  existence: HotelDiningDimensionCapability;
  hours: HotelDiningDimensionCapability;
}

interface HotelDiningCapability {
  propertyId: string;
  supplier: string;
  state: HotelDiningCapabilityState;
  services: readonly HotelDiningServiceCapability[];
  evidenceRevision: string;
}

interface HotelDiningEvidence {
  propertyId: string;
  supplier: string;
  services: readonly HotelDiningServiceEvidence[];
  evidenceRevision: string;
}

interface HotelDiningNeed {
  /** YYYY-MM-DD and HH:mm are explicitly property-local, never browser-local. */
  localDate: string;
  startLocal: string;
  /** Optional bounded need; same date unless it crosses midnight. */
  endLocal?: string;
  timezone: string;
  acceptedServices: readonly HotelDiningService[];
  entryPattern: 'preset_late_arrival' | 'preset_early_departure' | 'explicit';
  needKind: 'point' | 'bounded_interval';
}

type HotelDiningFitState = 'fits' | 'does_not_fit' | 'unknown' | 'no_need';

interface HotelDiningFitResult {
  state: HotelDiningFitState;
  matchedServices: readonly HotelDiningService[];
  evaluatedNeed?: HotelDiningNeed;
  evidenceRevision: string;
  reasonCode:
    | 'matched'
    | 'outside_confirmed_hours'
    | 'no_need'
    | 'no_accepted_services'
    | 'unsupported'
    | 'partial_coverage'
    | 'hours_missing'
    | 'timezone_missing'
    | 'conflicting'
    | 'stale'
    | 'invalid_evidence'
    | 'provider_error';
}
```

`HotelOffer` gains optional `diningEvidence` and `diningCapability`. `BookingHotelContext` gains validated `diningEvidence`, `diningCapability`, `diningNeed`, and `diningFit`. Each object must retain the same `propertyId`/`supplier` binding and `evidenceRevision` as the displayed offer.

Do not serialize the dining context into an unbounded query string. Use the existing validated booking-context persistence/reference path. Reject rather than truncate an invalid context.

## 5. Validation And Degradation Rules

Validation occurs at the provider/data boundary. The UI renders the resulting safe state.

- Reject unrecognized service, weekday, mode, status, or capability values.
- `propertyId` must equal the displayed offer id; supplier must equal the displayed offer source after the existing canonical normalization.
- Initial scope must be exactly `property`.
- Scheduled hours require a valid IANA time zone and at least one valid weekly window or applicable date override.
- `24_hours` and `closed` must not carry weekly windows. `00:00–00:00` never implies 24 hours.
- Times must strictly match `HH:mm`; `24:00`, seconds, locale strings, and impossible values are invalid.
- Duplicate weekly windows may be de-duplicated; overlapping windows for the same service/day may be merged only by the normalizer, never by the component.
- Conflicting date overrides for the same date degrade that service to `conflicting`.
- A future `fetchedAt`, invalid timestamp, missing source, missing revision, unknown time zone, or identity mismatch degrades only the affected service to `unknown`; it never produces `fits` or `does_not_fit`.
- `stale` comes only from a provider-owned current-applicability rule. The UI must not invent a number-of-days threshold.
- One malformed service does not hide valid siblings. It does make an overall negative result `unknown` if that malformed service is traveler-accepted and could have changed the answer.
- An empty `services` array with supported/partial capability is an empty evidence state, not proof that all services are unavailable.
- An explicit `status: unavailable` is a reported service negative. `not_returned`, absent evidence, unsupported capability, error, and loading are never relabeled unavailable or closed.

## 6. Conservative Property-Local Overlap Semantics

### 6.1 Preconditions for `fits`

Return `fits` only when all are true:

1. The traveler supplied a valid point or bounded interval in the named property IANA time zone.
2. At least one accepted service has `status: confirmed`, `hoursStatus: confirmed`, valid property scope, matching identity/revision, and a currently applicable schedule.
3. A date override, when present for the need date, supersedes the weekly schedule.
4. At least one accepted service interval fully contains the need.
5. No stale or conflicting evidence invalidates that matched service.

### 6.2 Interval rules

- Operating and need intervals are half-open: `[open, close)`. A point exactly at opening fits; a point exactly at closing does not.
- A scheduled window with `endLocal <= startLocal` starts on its declared opening day and closes the next local day. Example: Friday 18:00–02:00 contains Saturday 00:30.
- A bounded need must be fully contained within one service interval. Partial overlap is `does_not_fit` only when all accepted services have complete confirmed evidence; otherwise it is `unknown`.
- A need with `endLocal <= startLocal` crosses into the following local date. A need longer than 24 hours is invalid for this prototype and returns `unknown`.
- `24_hours` is explicit and contains any valid need on the applicable date, subject to an override. A `closed` date override wins over regular `24_hours`.
- A dated override replaces, not supplements, weekly hours for that service and local date.
- DST gaps/ambiguities are resolved by a time-zone-aware library in the data layer. A nonexistent or unresolved ambiguous local time returns `unknown`; the component does not guess an offset.
- Opening weekday labels attach to the start. Do not split the underlying interval at midnight for evaluation; display can add `next day` for clarity.

### 6.3 Overall result precedence

1. No valid need: `no_need`.
2. One or more accepted services validly contain the need: `fits`.
3. No accepted service fits and any accepted service is unsupported, missing, invalid, stale, conflicting, loading, or errored in a way that could change the decision: `unknown`.
4. Otherwise, all accepted services have conclusive confirmed hours/explicit unavailability for the date and none contains the need: `does_not_fit`.

The product must not silently add unselected services. If restaurant alone is accepted, a room-service match is not a fit.

## 7. Default And No-Need Presentation

### 7.1 Supported evidence, no entered need

Heading: `Dining availability`  
Intro: `Property-local hours reported by {sourceLabel}.`  
Outcome: none. Do not show a neutral badge that resembles a decision.

Show each supported/reported service as a bordered row:

- row label: `Restaurant`, `Room service`, or `Breakfast service`;
- primary value: today/stay-relevant hours when a stay date exists, otherwise compact weekly schedule;
- supporting value: `Property local time · {timezoneLabel}`;
- optional disclosure button: `Show weekly hours` / `Hide weekly hours`.

Footer: `Property hours do not guarantee an order, table, or selected-rate inclusion.`  
Source line: `Source: {sourceLabel} · Retrieved {Month D, YYYY}`.

If no stay/need date exists, do not choose “today” based on browser time. Show the weekly schedule.

### 7.2 Current production default: unsupported supplier

Render one inset disclosure, no rows:

- Heading: `Dining availability`
- Body: `{Provider} does not return restaurant, room-service, or breakfast-service hours. Confirm dining times with the property before booking.`

For the current normalized provider label, `{Provider}` resolves to the user-facing partner name; never show an internal adapter id if existing provider-label normalization suppresses it. No retry appears because unsupported is a stable capability, not an error.

## 8. Fit Outcome Presentation And Final Copy

When a need exists, show a single outcome panel before service rows. Text, not color or icon, carries the meaning.

### 8.1 Fits

- Outcome heading: `Food available at your time via {service}.`
- Multiple matches: `Food available at your time via {service list}.`
- Context: `{Day, Mon D} at {time} · property local time ({timezoneLabel})`
- Caveat: `Property hours do not guarantee an order, table, or selected-rate inclusion.`
- Tone: success-soft background, success text for heading; body remains `--text-2`.

Service names in prose: `the restaurant`, `room service`, `breakfast service`. List grammar: `the restaurant and room service`; three items use commas plus `and`.

### 8.2 Does not fit

- Outcome heading: `No accepted on-property food service is shown for {Day, time} local time.`
- Supporting copy: `Review the service hours below or change which services count for this need.` (prototype/input-approved mode only)
- Production schedule-only copy: `Review the service hours below and confirm dining times with the property before booking.`
- Tone: warning-soft, warning text. Do not use `Unavailable`, `Closed`, or error styling for the overall property.

### 8.3 Unknown

- Outcome heading: `Dining hours are not complete enough to check {Day, time} local time.`
- Reason line, exactly one of:
  - `The provider did not return hours for every accepted service.`
  - `Current sources disagree about the accepted service hours.`
  - `The accepted service hours may have changed.`
  - `The property's local time could not be confirmed.`
  - `Dining hours could not be checked.`
- Guidance: `Confirm dining times with the property before booking.`
- Tone: neutral raised surface for missing/unsupported; warning-soft for stale/conflict; error-soft only for provider error.

### 8.4 No need

No outcome heading, fit chip, or “unknown” claim. Show schedules and source only. In the research variants that include an input, action copy is `Check a time`.

## 9. Service Row Copy Matrix

| Normalized state | Visible primary value | Supporting copy |
| --- | --- | --- |
| Confirmed scheduled | `{day label} · {start}–{end}` | `Property local time · {timezoneLabel}` |
| Confirmed overnight | `{day label} · {start}–{end} next day` | `Property local time · {timezoneLabel}` |
| Confirmed 24 hours | `24 hours` | `Property local time · {timezoneLabel}` |
| Explicit scheduled closed date/day | `Closed {day/date}` | `Reported by {sourceLabel}` |
| Service confirmed, hours not returned | `{Service} is reported, but its hours were not provided.` | `Confirm times with the property.` |
| Explicit service unavailable | `{Service} is reported as unavailable.` | `This is a property-level provider fact.` |
| Service not returned but dimension supported | `Service not reported` | `The provider did not return a status for {service}.` |
| Hours unknown/invalid | `Hours unclear` | `The returned schedule could not be confirmed.` |
| Conflict | `{Service} hours are unclear because current sources disagree.` | `Confirm times with the property.` |
| Stale | `{Service} hours may have changed since {Month D, YYYY}.` | `Confirm current times with the property.` |
| Supported service loading | `Checking {service} hours…` | none |
| Partial capability | render only supported rows | `This provider does not report every type of on-property dining service.` |

Never display missing evidence as `Closed`, `No restaurant`, or `No room service`. The word `Closed` is reserved for an explicit, applicable `schedule.mode: closed` fact.

### Weekly schedule formatting

- Use locale-readable 12-hour time in the English UI: `6:30 AM–10:30 AM`, not raw `06:30`.
- Use en dashes for ranges and `next day` for overnight close.
- Group only identical schedules across consecutive weekdays: `Mon–Fri · 6:30 AM–10:30 AM`.
- Do not group nonconsecutive days into a misleading range: use `Mon, Wed, Fri`.
- Split windows remain separate on one line when space permits: `6:30 AM–10:30 AM · 6:00 PM–10:00 PM`; on mobile, stack them.
- Date overrides appear before regular hours: `Dec 25 · Closed`, followed by `Regular hours`.
- Time-zone label uses a friendly destination label plus IANA id where available: `Paris time (Europe/Paris)`. Never show only `GMT+1`, which changes seasonally.

## 10. Loading, Refreshing, Empty, Error, Conflict, And Stale States

### Loading with no prior evidence

- Block: `aria-busy="true"`, `aria-labelledby` points to `Dining availability`.
- Visible copy: `Checking dining hours…`
- Render three static skeleton rows only when capability says all three services are supported; otherwise render one neutral text row to avoid implying coverage.
- Skeletons use `.skeleton`, respect reduced motion, and have `aria-hidden="true"`.
- No outcome is announced until loading resolves.

### Refreshing with usable prior evidence

- Keep prior rows visible; do not replace them with skeletons.
- Add status text: `Refreshing dining hours…`
- Set block `aria-busy="true"`.
- Do not preserve a positive fit if the prior evidence is outside its provider-owned applicability rule; render stale/unknown instead.

### Empty evidence

Capability supported/partial but no valid service rows:

- `Dining details were not returned for this property.`
- `Confirm dining times with the property before booking.`

This is `unknown`, not explicit service unavailability.

### Error with no prior evidence

- Heading: `Dining hours could not be checked.`
- Body: `Your hotel details are still available. Try dining hours again or confirm times with the property.`
- Button: `Retry dining hours` only if an in-scope, safe provider retry exists.
- Error panel uses `role="alert"` only for a user-initiated retry failure. Initial background failures use `role="status"`/polite announcement to avoid interrupting page reading.

### Retry behavior

- Retain local date, time, accepted-service choices, and scroll position.
- Disable the retry button while pending and change copy to `Retrying…`.
- On completion, move programmatic focus to the block heading (`tabIndex={-1}`) and announce the new outcome through one polite, atomic live region.
- If the retry fails, focus remains on the enabled retry button; announce `Dining hours could not be checked. Try again.`

### Partial

Render valid supported service rows, then one coverage line: `This provider does not report every type of on-property dining service.` Any accepted unsupported service that could change a negative decision makes the overall fit `unknown`.

### Conflict

Keep the affected service identity visible, suppress disputed time ranges, and show: `{Service} hours are unclear because current sources disagree.` Never choose the newest-looking source in the component. Unaffected services remain usable and may independently produce a fit.

### Stale

Keep the schedule available for inspection but visually subordinate it and show: `{Service} hours may have changed since {Month D, YYYY}.` A stale service cannot produce a positive or conclusive negative match. No age threshold is specified in UI code.

## 11. Research Prototype Input Variants

All prototype pages must display `Research prototype — sample hours` above the property name and `These sample schedules are not live hotel information.` directly above the dining block.

### Variant A — schedule disclosure only

No input. Participants inspect service rows and answer the scenario prompt. This is also the fallback if input gates fail.

### Variant B — presets reveal editor

Prompt: `When do you need food on the property?`  
Buttons: `Late arrival`, `Early departure`, `Choose a time`.

- `Late arrival` seeds the scenario fixture's arrival date/time, not a universal 10 PM assumption.
- `Early departure` seeds the fixture's departure date/time.
- Every preset immediately reveals editable date, time, time-zone context, and accepted services before applying.
- Presets never infer acceptable services.

### Variant C — explicit editor

Fields, in DOM order:

1. Label `Date at the property`; native date input; helper `{Property city} local date`.
2. Label `Time at the property`; native time input; helper `{Property city} local time ({IANA timezone})`.
3. Group legend `Which services work for you?`; checkboxes `Restaurant`, `Room service`, `Breakfast service`.
4. Primary button `Check dining availability`.
5. Secondary text button `Clear dining need` after a need has been applied.

Validation copy:

- Missing date: `Choose a date at the property.`
- Date outside known stay: `Choose a date within your stay, {check-in}–{check-out}.` (only when both stay boundaries are validated)
- Missing time: `Choose a property-local time.`
- No service selected: `Select at least one service that works for you.`
- Invalid/DST local time: `That local time cannot be checked. Choose another time.`
- Unknown property time zone: `The property's local time could not be confirmed, so this time cannot be checked.`

On submit, focus the first invalid field; error text is linked with `aria-describedby`. On success, keep focus on the button, update the polite live region, then place the result immediately after the form so the next Tab reaches result details. Do not auto-scroll unless the result is outside the viewport; if scrolling is needed, respect reduced motion.

Input is point-time by default. A bounded-interval control is data-contract-ready but not exposed in these research variants; this avoids asking participants for precision the discovery did not establish.

## 12. Responsive Layout

### 375px viewport

- Preserve the page's single-column sequence and existing `p-4` section padding.
- Dining block: `mt-6 border-t border-[color:var(--border)] pt-6` inside `Hotel fit`; it is not another full card nested inside the card.
- Header, outcome, form fields, actions, and service rows stack at full width.
- Service row: label first, value below, supporting/source text last. Use `min-w-0`, `break-words`, and never a fixed time-column width.
- Checkboxes stack with at least 44px label hit areas.
- Primary prototype/retry action is full width using `btn btn-primary w-full`; avoid conflicting ad-hoc sizing on `.btn`.
- Schedule windows wrap or stack; no horizontal scrolling, clipped copy, or two-column definition list.
- Minimum interactive target: 44×44px. Maintain at least 8px between adjacent targets.

Suggested patterns:

```txt
container: mt-6 border-t border-[color:var(--border)] pt-6
outcome: rounded-[var(--radius-control)] border border-[color:var(--border-strong)] p-4
rows: mt-4 grid grid-cols-1 gap-3
row: min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5
```

### 1280px viewport

- Retain the current centered page column; dining does not widen the page.
- Outcome stays full width for a single reading path.
- Service rows use at most two columns: `sm:grid-cols-2`; the third row starts a new row. Do not use three narrow columns.
- Prototype editor uses `md:grid-cols-2` for date/time. Service choices and actions span both columns.
- Source/caveat remains below the grid, left-aligned.
- Booking review uses the same internal layout and order as saved detail to make visual comparison immediate.

## 13. Tailwind And Token Patterns

Use existing tokens from `app/globals.css`; add no colors, shadows, radii, or font sizes.

```txt
section heading:
  text-xl font-medium leading-tight text-[color:var(--text-1)]

subheading / outcome heading:
  text-sm font-medium text-[color:var(--text-1)]

body:
  text-sm leading-6 text-[color:var(--text-2)]

caption / provenance:
  text-xs leading-5 text-[color:var(--text-3)]

neutral row:
  rounded-[var(--radius-control)] border border-[color:var(--border)]
  bg-[color:var(--bg-raised)] p-3.5

fit outcome:
  border-[color:var(--border-strong)] bg-[color:var(--success-soft)]
  heading text-[color:var(--success)]

mismatch / stale / conflict:
  border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]
  heading text-[color:var(--warning)]

error:
  border-[color:var(--border-strong)] bg-[color:var(--error-soft)]
  heading text-[color:var(--error-text)]

form control:
  field-input

focus:
  rely on global :focus-visible outline and --focus-ring; do not suppress it
```

Do not use `--error` for text; it does not meet the existing contrast rule. Do not use an icon alone, green/red dots, or color-only row borders to convey state.

## 14. Keyboard, Focus, Screen Reader, And Motion Behavior

- Use semantic `section` with a unique `aria-labelledby`; service facts use a list or definition list.
- The section is not a tab stop in default state.
- Weekly disclosure uses a native `button` with `aria-expanded` and `aria-controls`, or native `details/summary` if it does not create nested interactive content.
- Tab order follows visible order: optional editor fields → service checkboxes → apply → clear → schedule disclosure → retry → provider handoff.
- Checkbox labels include the full service name; no custom role is needed.
- Loading/refreshing container uses `aria-busy`. Skeletons are hidden from assistive technology.
- Maintain one `role="status" aria-live="polite" aria-atomic="true"` for asynchronous outcome changes. Do not place the entire schedule in the live region.
- Initial server-rendered content is ordinary page content, not announced as a live update.
- The outcome heading includes the state in words; screen-reader-only text must not contradict visible copy.
- Source abbreviations and IANA identifiers remain readable text, not tooltip-only content.
- Focused elements are never covered by sticky navigation; use existing page scroll padding if present.
- Reduced-motion users get instant expansion/scroll changes; skeleton animation is effectively removed by the global reduced-motion rule.

## 15. Booking-Review Continuity

The saved detail and booking review must show the same answer, not independently recompute it from partial URL fields.

Persist and validate:

- dining evidence and capability;
- entered need and accepted services;
- computed fit result and reason code;
- `propertyId`, `supplier`, property IANA time zone, `fetchedAt`, and `evidenceRevision`.

Continuity rules:

1. On entry to review, require offer id, supplier, time zone, and evidence revision to match the stored, validated context.
2. If all match and the evidence is still current under provider rules, repeat the same outcome and service rows. Review copy uses the same property-local date/time.
3. If the context is absent, show the current capability-safe schedule state; never reconstruct the need from check-in/out.
4. If identity/revision mismatches, display `Dining details changed before review.` then render the newly validated state. If a safe refresh is unavailable, render unknown and `Confirm dining times with the property before booking.`
5. If evidence becomes stale or conflicts before review, downgrade to unknown and announce the changed result on client navigation. Never preserve the former positive styling.
6. Provider handoff remains usable in all dining states. Dining mismatch/unknown is decision evidence, not a booking block.
7. Handoff analytics record the state shown at click time and whether the block was actually viewed.

Review label remains `Dining availability`; do not rename it `Your dining choice`, which would imply a reservation or selected add-on.

## 16. Analytics Contract

Add only allowlisted, enumerated properties. Never send exact local date/time, IANA time zone, source free text, property name, user-authored text, or raw schedules.

### `hotel_dining_evidence_viewed`

Required:

```txt
hotel_id: opaque validated id
surface: saved_detail | booking_review | research_prototype
provider: normalized opaque provider key
capability_state: supported | partial | unsupported | unknown
services_reported: none | restaurant | room_service | breakfast_service |
  restaurant_room_service | restaurant_breakfast_service |
  room_service_breakfast_service | all_three
hours_coverage: none | partial | complete
fit_state: fits | does_not_fit | unknown | no_need
viewport_group: mobile | desktop
```

Fire once per hotel/surface/evidence revision when the block first intersects at least 50% for 500ms. In unsupported state, `services_reported=none`, `hours_coverage=none`, `fit_state=no_need` unless a validated need exists, in which case `unknown`.

### `hotel_dining_need_applied`

Research-only until production input is approved:

```txt
entry_pattern: preset_late_arrival | preset_early_departure | explicit
need_kind: point | bounded_interval
accepted_services: same canonical combination enum as services_reported
need_time_bucket: early_morning | daytime | evening | late_night
fit_state: fits | does_not_fit | unknown
criteria_version: validated opaque version or absent
```

Buckets in property-local time: `early_morning` 04:00–08:59, `daytime` 09:00–16:59, `evening` 17:00–21:59, `late_night` 22:00–03:59. These buckets are analytics-only and never drive matching.

### `hotel_dining_details_opened`

Required: `hotel_id`, `surface`, `fit_state`, `hours_coverage`. Fire once per closed→open transition; repeated intentional opens may fire again, but hydration must not.

### Extend handoff and return events

Add `dining_fit_state: fits | does_not_fit | unknown | no_need` and `dining_evidence_seen: true | false` to the relevant hotel provider handoff/room handoff and return events. Preserve existing required properties.

### Analytics validation

- Unknown events/properties and values fail closed with the existing analytics route response behavior.
- Canonical service combinations are built in fixed order; never send arbitrary arrays or JSON.
- `viewport_group` follows the app's established breakpoint convention; for this feature, `<640px = mobile`, otherwise desktop.
- No event contains an exact timestamp for the dining need. Server event time remains ordinary telemetry metadata.
- A mismatch followed by handoff is not classified as failure. Analyze handoff/return by evidence coverage and exposure.

## 17. Required Fixtures And Expected Rendering

All fixtures are marked `sample` and cannot be constructed from live offer data.

| Fixture | Required visible outcome | Service-row proof |
| --- | --- | --- |
| Friday 23:30; restaurant 18:00–22:00 and room service 18:00–01:00; both accepted | `Food available at your time via room service.` | Restaurant row remains 18:00–22:00; it is not labeled open |
| Tuesday 05:45; breakfast 06:30–10:30; breakfast accepted | `No accepted on-property food service is shown for Tuesday, 5:45 AM local time.` | Breakfast row shows 6:30 AM–10:30 AM |
| Saturday 00:30; Friday room service 18:00–02:00 | `Food available at your time via room service.` | Row says `Friday · 6:00 PM–2:00 AM next day` |
| Tuesday 20:00; restaurant Tuesday explicitly closed | mismatch outcome | Row says `Closed Tuesday`; Wednesday does not affect result |
| Friday 21:00; restaurant confirmed, hours not returned | unknown outcome | `Restaurant is reported, but its hours were not provided.` |
| Any valid time; current explicit 24-hour room service | fit outcome plus non-guarantee | `24 hours` and property time zone |
| Accepted service conflict | unknown outcome | `{Service} hours are unclear because current sources disagree.` |
| Accepted service stale | unknown outcome | `{Service} hours may have changed since {date}.` |
| Holiday 07:00; regular breakfast 06:00–10:30, override closed | mismatch outcome | Holiday override `Closed` appears before regular hours |
| Hotellook unsupported | no fit claim | one unsupported disclosure, zero service rows |
| Partial: restaurant supported, other dimensions unsupported | unknown if missing accepted service could change result | one restaurant row plus one coverage line |
| Loading→success | result announced once | input retained; focus rules in §10 |
| Error→retry→unknown | error then unknown announced | retry remains operable; no positive claim |
| Missing/invalid time zone | unknown | no locally formatted fit claim |
| Exactly at opening / closing | opening fits; closing does not | half-open boundary verified |

## 18. Research Plan And Production Release Gates

Run 5–7 moderated sessions across the same fixed fixtures and rotate variants A/B/C to reduce order bias. Ask participants to set or interpret a late-arrival and early-departure need, identify which service provides the match, explain the property-local-time label, and say what the result does not guarantee.

No production time input, preset, result cue, rank change, or filter ships from this ticket. Advance only when:

1. At least 85% correctly distinguish service existence from open-at-time, breakfast service from breakfast inclusion, missing hours from closed, and property hours from a live guarantee.
2. No more than 5% interpret `Fits` as a reservation, order/table guarantee, or selected-rate inclusion.
3. At least 5 of 7 can set the correct local need without moderator help, revise it after noticing an incorrect time-zone/service assumption, and explain which services count.
4. A provider supplies the normalized fields with attribution rights and a documented freshness/current-hours rule.
5. Fixture tests pass for all states in §17, including analytics rejection tests and booking continuity.

If comprehension passes but no input variant passes, ship schedule disclosure only after provider approval. A later **APPROVED FEATURE** ticket is required to test a production result cue or filter. If eventually approved, a result cue may appear only for `fits` with current confirmed evidence; never show mismatch or unknown as a result-card exclusion, and never change Deal Score.

## 19. Acceptance Criteria For UI And DEV Handoffs

- Current Hotellook production fixture shows exactly one unsupported disclosure and no invented service rows.
- The dedicated evidence/capability family remains separate from generic amenities and rate inclusions.
- Every supported, unsupported, partial, loading, refreshing, empty, error, conflict, stale, invalid, and retry state has exact visible copy and accessible semantics.
- The eight research scenarios and boundary cases produce the outcomes in §17.
- Saved detail and booking review preserve property id, supplier, time zone, evidence revision, need, accepted services, and result; mismatch degrades to unknown safely.
- There is no external call from a component and no vendor field parsed by UI code.
- At 375px, there is no horizontal overflow, overlapping copy, clipped schedule, or target below 44px.
- At 1280px, service rows use no more than two columns and retain the same reading order.
- All state meaning exists in text and meets existing token/contrast rules.
- Keyboard, live-region, retry, reduced-motion, and focus behavior match §§10 and 14.
- Analytics accepts only the documented schemas and never stores exact dining-need time or free text.
- Provider handoff remains available for every dining outcome.
- No result-card cue, filter, sorting/ranking change, or Deal Score change is included.

## 20. Known Blockers And Handoff Boundary

- Hotellook cannot provide dining capability or schedules. Positive production UI is blocked on an approved provider contract; the immediate truthful implementation is unsupported disclosure plus a synthetic research harness.
- Freshness cannot be computed in the component. DEV/provider work must define current applicability before `confirmed` schedules can produce a fit.
- The live saved-deal data path must carry provider-backed evidence; implementing `HotelCard` alone is insufficient.
- Production input/filter behavior remains blocked on §18 gates and a later approved-feature ticket.

UI handoff may implement the presentation states and isolated research fixtures without API or provider changes. DEV work is required for shared types, provider normalization, matching, context persistence, and analytics validation before any provider-backed positive claim can be production-ready.
