# UXDES-HOTEL-NOISE-QUIET-FIT-01: Hotel quiet-stay fit design specification

Date: 2026-07-31  
Stage: UX Design  
Priority: P1  
Upstream: `docs/pipeline/hotel-noise-quiet-fit/02-research.md`

## Design outcome

expaify will present an evidence ledger, never a quietness verdict. On hotel detail, the ledger sits inside **Hotel fit** before **Check rooms with provider** and answers, in this order:

1. What is documented for the selected room or selected stay?
2. What is documented for the property generally?
3. What bounded patterns do licensed guest-review data report?
4. What named nearby places can be established from sufficiently precise location data?
5. What is unknown, unusable, stale, failed, or disputed?

Every item names its source, scope, and freshness. The interface never converts the evidence into `quiet`, `noisy`, suitability, risk, ranking, or a Deal Score input. Except for an exact, provider-documented attribute tied to the selected stay, no item is a guarantee.

The production fallback remains explicit unknown until provider, rights, normalization, and continuity work exists. This specification does not authorize fabricated populated data.

## Scope and implementation boundary

### In scope for the next UI stage

- Refactor the existing `QuietStayEvidenceLedger` presentation into the enforced hierarchy in this specification.
- Implement every overall and class-level state with final copy.
- Move the existing live unknown ledger from **Supporting evidence** into **Hotel fit**, before the provider handoff.
- Provide the result-cue and handoff-block UI contracts without fabricating data.
- Preserve price, Deal Score, hotel details, navigation, and provider actions while evidence checks load or fail.
- Add component fixtures/tests for populated, partial, unknown, stale, malformed, conflicting, mobile, keyboard, and assistive-technology behavior.

### Requires a later DEV ticket before populated production use

- A licensed source and approved display/derivation rights.
- Provider normalization, source-specific freshness rules, raw-ID audit retention, cache behavior, and `Result<T>` handling.
- `HotelOffer` and booking-context continuity.
- Selected product/room identity and provider evidence for transmitted, acknowledged, or guaranteed request states.
- Analytics allow-list repair and end-to-end persistence tests.

Until those dependencies exist, production renders only the honest unknown/checking/failure state derived from real application state. Fixtures and tests may exercise populated states but must be visibly test-only.

### Explicitly out of scope

- A noise score, quiet/noisy label, risk percentage, recommendation, ranking boost, or Deal Score change.
- A `Quiet hotels` filter or any new refinement in this ticket.
- Scraping reviews, maps, venue pages, notices, or property pages.
- New provider, review, geospatial, acoustic, flight-path, road, rail, event, or construction integrations.
- Room assignment, room selection, property messaging, free-text requests, or claims that expaify sent a request.
- Collection of sleep, health, disability, work-call, room-number, or free-text complaint data.

## Information architecture and hierarchy

### Surface hierarchy

The live saved-detail decision order becomes:

1. Stay details
2. Price and Deal Score
3. Hotel fit
   - existing hotel class and guest-rating facts
   - **Quiet-stay evidence**
4. Check rooms with provider
5. Supporting evidence

Remove the second quiet-stay ledger from **Supporting evidence**. There must be one canonical ledger per detail surface.

Price, Deal Score, date/occupancy context, and the provider action remain primary to the transaction. Quiet-stay evidence is secondary decision support. Source metadata and caveats are tertiary, but always readable and never hidden behind tooltip-only UI.

### Ledger reading order

Within **Quiet-stay evidence**, render exactly:

1. **Selected room or stay**
2. **Property facts**
3. **Guest-reported patterns**
4. **Nearby context**
5. Persistent scope statement

The normalized presentation layer sorts these groups and their supported subtypes. Caller array order must not affect DOM order. Do not render four equal-weight badges or use success/warning/error color to imply polarity.

The persistent scope statement is:

> These details do not predict whether a specific room will be quiet.

Place it directly below the ledger title and repeat a more specific caveat inside any item where scope could otherwise be mistaken.

### Strongest-class precedence

Use this precedence only to choose the one factual result cue and analytics enum; it is not a score:

`selected_stay` → `room_type` → `property` → `guest_pattern` → `nearby_context` → `none`

An unusable, stale, malformed, or failed item cannot become the strongest class. A requestable preference is not a selected-stay fact; classify it with provider/property context unless the provider explicitly ties capability to the currently selected stay.

## Evidence model required by the UI

This is a presentation contract, not authorization to populate data. The later normalized model must make invalid combinations unrepresentable or reject them before render.

### Overall states

- `checking`
- `evidence_available`
- `no_evidence_returned`
- `check_failed`

### Class states

Each of selected room/stay, property facts, guest patterns, and nearby context independently supports:

- `ready`
- `not_returned`
- `insufficient_location` (nearby context only)
- `stale`
- `malformed`
- `conflicting`
- `error`

The current `error` fallback must not absorb `stale`, `malformed`, or `not_returned`. Source-specific adapters decide freshness against Product/Legal-approved SLAs; the component must not infer freshness from “date parses.”

### Selected room or stay items

Required fields:

- approved normalized ID and retained raw provider ID for audit;
- scope: `selected_stay` or `room_type`;
- exact documented attribute label;
- source label;
- observed/checked timestamp;
- selected product or room-type identifier where applicable;
- certainty: `supported`, `requestable`, `transmitted`, `acknowledged`, or `guaranteed`.

Rules:

- A `room_type` item renders only when the named room type is visible.
- At handoff, a room-type item renders only when the selected product is demonstrably that room type.
- `guaranteed` renders only for an exact provider-documented attribute tied to the selected stay. Never replace that attribute with “quiet room guaranteed.”
- `transmitted` needs provider success plus a request receipt/reference.
- `acknowledged` needs an attributable property/provider response.
- Clicking an expaify provider link changes none of these states.

### Property fact items

Required fields: approved normalized ID, source, property scope, observed date, and documented provider wording/identifier retained for audit.

Property facts may state that a facility or option is listed. They cannot claim that every room has it, that acoustic performance was measured, or that the selected stay includes it.

### Licensed guest-pattern items

Use a list, not one free-text summary. Every item requires:

- one approved bounded pattern enum;
- source label and explicit licensed/approved display capability in the data layer;
- review window start and end;
- sample count when the source supplies it;
- state and source observation timestamp as defined by the source contract.

Supported display labels stay separated:

- External: `street or traffic`, `nightlife`, `aircraft`, `rail or transport`.
- Within-property: `corridors`, `lifts`, `adjoining rooms`, `property venues or events`, `building systems`.

Do not merge external and within-property patterns. Do not show review quotes or unbounded generated prose. Do not infer patterns from a generic guest rating or a single review.

### Nearby-context items

Every visible distance requires:

- property location precision of `exact` or `coordinates`;
- a licensed named reference point;
- bounded category: `airport`, `rail`, `major_road`, or `nightlife`;
- non-negative distance and unit;
- calculation method, displayed as `in a straight line` for straight-line values;
- source label and source update timestamp;
- source-version metadata retained for audit.

`area`, `search_area`, or `missing` property location suppresses all distances and categories. Nearby context cannot imply audibility, hours, flight paths, events, facade exposure, room orientation, or current conditions.

## Final UI copy

Only substitute values inside braces. Do not improvise synonyms that introduce sentiment or certainty.

### Region and global copy

| Element | Final copy |
|---|---|
| Detail title | `Quiet-stay evidence` |
| Handoff title | `Quiet-stay evidence for this choice` |
| Persistent scope | `These details do not predict whether a specific room will be quiet.` |
| Conflict notice | `Sources differ. Review each source before deciding.` |
| Result cue prefix | `Quiet-stay evidence available` |

### Result cue class labels

The complete line is `Quiet-stay evidence available · {strongest class label}`. The allowed labels are:

- `Selected stay`
- `Room type`
- `Property`
- `Guest reports`
- `Nearby context`

Never render the cue for `none`, checking, unknown, overall failure, stale-only, or malformed-only states. The cue is text inside the card's existing link and is not a badge, filter, ranking factor, or separate control.

### Overall states

| State | Final copy | Behavior |
|---|---|---|
| `checking` | `Checking quiet-stay evidence…` | Polite status. Ledger shell is visible; other content/actions remain usable. |
| `no_evidence_returned` | `Quiet-stay details were not provided by this hotel source. Location and rating do not tell us whether a room will be quiet.` | Static unknown. No result cue. |
| `check_failed` | `Quiet-stay evidence could not be checked. Confirm room location, soundproofing, and current surroundings with the booking partner.` | Polite status after an async failure. Does not imply that hotel inventory or price failed. |
| `evidence_available` | No overall success sentence. | Render valid groups plus class-specific messages. |

### Selected room or stay

| Condition | Final copy |
|---|---|
| Selected-stay documented attribute | `The provider confirms {attribute} for this selected stay.` |
| Room-type soundproofing | `Provider lists soundproofing for {room type}. Confirm this room type is selected before payment.` |
| Requestable | `A quieter room can be requested. Nothing has been sent by expaify, and requests depend on availability.` |
| Transmitted | `The booking provider says it sent your quieter-room request.` |
| Acknowledged | `The property acknowledged your quieter-room request.` |
| Not returned | `No selected-room or selected-stay quiet-stay detail was provided.` |
| Stale | `Selected-room or selected-stay details are out of date and are not shown.` |
| Malformed/unmapped | `Some selected-room or selected-stay details could not be verified and are not shown.` |
| Error | `Selected-room or selected-stay details could not be checked.` |

Metadata patterns:

- Selected stay: `Selected stay confirmed by {source} · Checked {Mon D, YYYY}`
- Room type: `{room type} · Room information from {source} · Updated {Mon D, YYYY}`
- Request capability: `Request capability from {source} · Checked {Mon D, YYYY}`
- Transmitted: `Request receipt from {source} · {reference} · {Mon D, YYYY}`
- Acknowledged: `Acknowledgment via {source} · {Mon D, YYYY}`

Do not display request references if they include guest data; use only the provider-safe bounded reference defined by the integration contract.

### Property facts

| Condition | Final copy |
|---|---|
| Soundproofing | `Provider lists soundproofing for this property. It may not apply to every room.` |
| Not returned | `No property-level quiet-stay fact was provided.` |
| Stale | `Property quiet-stay details are out of date and are not shown.` |
| Malformed/unmapped | `Some property quiet-stay details could not be verified and are not shown.` |
| Error | `Property quiet-stay details could not be checked.` |

Metadata: `Property information from {source} · Updated {Mon D, YYYY}`.

### Guest-reported patterns

Valid item:

> Guests mention {bounded pattern}. Summary of guest reviews via {source}.

Metadata:

- With sample: `Based on {count} guest reviews from {Mon D, YYYY}–{Mon D, YYYY}`
- Without sample supplied by source: `Guest review window: {Mon D, YYYY}–{Mon D, YYYY}`

Class copy:

| Condition | Final copy |
|---|---|
| Not returned | `No licensed guest noise pattern was provided.` |
| Stale | `Guest noise patterns are out of date and are not shown.` |
| Malformed/unmapped | `Some guest-pattern details could not be verified and are not shown.` |
| Error | `Guest noise patterns could not be checked.` |

The word `licensed` may appear only when the rights capability is true; unlicensed evidence is dropped before the component and treated as unusable, never displayed without attribution.

### Nearby context

Valid item:

> {Reference point} is {distance} {unit} away in a straight line. Proximity does not predict noise in a specific room.

Metadata:

> Nearby data from {source} · Updated {Mon D, YYYY} · Property location: {Exact address | Coordinates}

Class copy:

| Condition | Final copy |
|---|---|
| Not returned | `No usable nearby context was provided.` |
| Insufficient location | `Property-level proximity cannot be calculated from the area information provided.` |
| Stale | `Nearby context is out of date and is not shown.` |
| Malformed/unmapped | `Some nearby details could not be verified and are not shown.` |
| Error | `Nearby context could not be checked.` |

When stale metadata is valid, append `Last source update: {Mon D, YYYY} · {source}` without showing the stale claim.

### Forbidden visible strings and implications

Do not use `Quiet`, `Likely quiet`, `Noisy`, `Low noise`, `High noise`, `Noise risk`, `Quiet-stay score`, `Good for sleep`, `Good for calls`, `Recommended for you`, or any positive/negative iconography. Do not say that expaify selected, sent, acknowledged, or guaranteed a preference unless the exact evidence gate above is satisfied.

## State composition rules

### Default populated state

- Overall state is `evidence_available` only when at least one current, valid item remains.
- Render all four group headings in enforced order. Groups with no returned item state their unknown copy; this prevents silence from being misread.
- Valid items are ordinary bordered rows, not success banners.
- The conflict notice precedes the groups when any valid classes conflict.

### Empty / not returned

- If no class returned evidence, use the one overall `no_evidence_returned` panel; do not render four repetitive empty groups.
- Detail renders the panel to make unknown explicit.
- Result cards render no cue.
- Handoff renders no second unknown panel because **Special requests** already tells the traveller what to confirm.

### Loading

- Use the stable ledger shell, title, scope statement, and one status row; do not skeletonize claim text.
- Set `aria-busy="true"` on the ledger region and `role="status" aria-live="polite" aria-atomic="true"` on the status row.
- Do not move focus when checking begins or ends.
- Do not disable or visually mute price, Deal Score, Back, Details, or provider CTA.

### Overall error

- Show the overall `check_failed` copy in the stable ledger shell.
- Announce once through the polite live region if it follows a user-visible async check.
- Do not add Retry unless a real independent retry callback exists. A decorative/nonfunctional Retry is forbidden.
- Provider action remains usable.

### Partial class failure

- Keep every valid item visible in its normal position.
- In the failed group's position, show the class-specific error/stale/malformed message.
- A malformed item must never be relabeled `not returned`.
- If all supplied items are malformed or fail validation, overall becomes `check_failed`.
- If all supplied items are stale and the source was successfully checked, suppress claims and use overall `no_evidence_returned` only if product semantics distinguish this from failure; otherwise use `check_failed`. The UI must never claim evidence available.

### Conflicting evidence

- Keep all current valid items, their scopes, sources, and dates visible.
- Show `Sources differ. Review each source before deciding.` once above the group list.
- Mark the specific affected item rows with visually neutral `Sources differ` secondary text if needed for association; do not call either source correct.
- Never average, rank, collapse, color-code, or resolve the conflict.
- Static conflict copy is not a live region.

### Unknown and unusable precedence

For one class, presentation precedence is `error` → `malformed` → `stale` → `insufficient_location` → `not_returned`; `conflicting` decorates otherwise valid items rather than hiding them. This precedence prevents unsafe claims from rendering. It is not a severity score.

### Edge cases

- Missing or blank source label: suppress the item as malformed.
- Source label longer than the approved bounded length: suppress as malformed; do not truncate a source identity into ambiguity.
- Invalid/future/reversed review window: malformed.
- Missing review count: allowed only when the source contract does not supply it; use window-only metadata.
- Count of zero, negative, non-integer, or below a source-approved threshold: do not show the pattern.
- Negative/NaN/infinite distance, blank unit/reference point, or unsupported method: malformed.
- Area-level property location plus otherwise valid nearby item: suppress the item and render insufficient-location copy.
- Duplicate normalized item from one source: deduplicate in the normalized layer; UI renders one.
- Same bounded pattern from different licensed sources: render separate rows, each attributed.
- Overlong room/source/reference labels: wrap with `break-words`; never horizontal-scroll the page.
- Locale/date formatting failure: suppress as malformed; never show raw machine timestamps.
- A generic star rating, guest rating, hotel name, photo, neighborhood, price, or absent value never creates quiet-stay evidence.

## Surface specifications

### Hotel result card

Placement: after hotel name/location metadata and before the existing price/action area. Render one wrapping text line only when there is at least one valid item.

Copy: `Quiet-stay evidence available · {strongest class label}`.

Rules:

- Use the strongest-class precedence, regardless of input order.
- The line carries no checkmark, warning icon, semantic color, numeric score, or sentiment.
- It is part of the existing card link and adds no tab stop.
- Opening the card continues to hotel detail; do not deep-link past price/stay context or auto-scroll.
- All-unknown, loading, failed, stale-only, and malformed-only cards show no line and keep their current height/content flow.
- Do not add a quiet-stay filter in this ticket.

Future refinement contract, not an implementation requirement: if real coverage later supports `Provider quiet-stay details available`, it matches current valid selected room/stay or property provider facts only. When applied, announce and display `Showing {matched} hotels; {unknown} more have no provider quiet-stay details.` Provide `Show all hotels` in one action. Unknown hotels remain reachable and are not hidden by default.

### Hotel detail

Placement: inside **Hotel fit**, after existing class/rating facts and before **Check rooms with provider**. Use one nested section headed `Quiet-stay evidence`.

Behavior:

- The region is expanded by default; it is decision evidence, not optional fine print.
- No control is required in the ledger; source metadata stays visible.
- Unknown is visible here even though the result card had no cue.
- The provider CTA remains after the region in DOM and visual order.
- Remove the old ledger instance beneath the provider CTA.

### Handoff / booking review

Placement: within the booking review, immediately above the existing **Special requests** block.

Render **Quiet-stay evidence for this choice** only when at least one validated item remains applicable:

1. Selected-stay facts.
2. Room-type facts only if the chosen product has the identical normalized room/product ID.
3. Property facts, guest patterns, and nearby context may follow as contextual evidence with the same scope copy.

Use the persistent statement `These details do not predict whether a specific room will be quiet.` Keep source and date metadata. The handoff is compact but must not drop provenance or scope.

If the room/product changes or becomes unknown, immediately remove the non-applicable room-type fact; do not downgrade it into a property fact. If no applicable item remains, remove the whole handoff block and preserve **Special requests** unchanged.

Do not add a checkbox, input, preference pill, URL parameter, automatic request, sent state, success toast, or retry. The canonical **How requests work** sequence remains:

- `Selected:` You have chosen a preference. expaify does not offer this step.
- `Sent:` The booking service says it submitted the request. Continuing from expaify does not send one.
- `Acknowledged:` The property has replied about the request.
- `Guaranteed:` The property explicitly confirms it for this stay. Until then, treat it as a preference.

Provider CTA activation does not mutate quiet evidence or request status.

## Responsive layout

### Mobile: 375px viewport

- One-column reading order; no side-by-side evidence classes.
- Outer **Hotel fit** section: `p-4`; nested ledger: `mt-5 min-w-0 border-t border-[color:var(--border)] pt-5` or an equivalent single-boundary treatment. Avoid a visually heavy card nested inside a card.
- Group list: `mt-5 divide-y divide-[color:var(--border)]`; each group `py-4 first:pt-0 last:pb-0`.
- Evidence item: `min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3`.
- Text and metadata use `break-words`; no fixed widths, nowrap labels, horizontal scrolling, or clipped source names.
- Result cue wraps naturally to two lines without changing price/action alignment.
- Touch controls already present on surrounding surfaces retain a minimum 44px target. Evidence rows are not made clickable.

### Desktop: 1280px viewport

- Preserve the page's existing content column and decision-section order.
- Groups remain in one reading column; do not create a four-column evidence dashboard that implies equal certainty.
- Existing hotel class/rating facts may retain `sm:grid-cols-2`; the ledger spans the section width below them.
- Long lists remain vertically stacked with `space-y-3`. Maximum readable line length follows the parent content width; no modal is introduced.
- The provider handoff remains a separate following decision section, not a sticky overlay over evidence.

### Intermediate widths and zoom

- At 320px minimum body width and 200% browser zoom, headings, sources, dates, and caveats wrap without overlap or loss.
- No content depends on hover. No tooltip is required to understand source, scope, state, or uncertainty.

## Visual and Tailwind specification

Use only existing tokens from `app/globals.css`.

### Ledger shell inside Hotel fit

`mt-5 min-w-0 border-t border-[color:var(--border)] pt-5`

Do not use success/error-tinted shells for evidence availability. Overall status rows use:

`mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-base)] px-3.5 py-3 text-sm leading-6 text-[color:var(--text-2)]`

### Typography

- Ledger title: `text-h3 text-[color:var(--text-1)]`
- Scope/body: `mt-2 text-sm leading-6 text-[color:var(--text-2)]`
- Group heading: `text-sm font-medium leading-5 text-[color:var(--text-1)]`
- Claim: `text-sm leading-6 text-[color:var(--text-1)]`
- Metadata: `mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]`
- Result cue: `mt-2 text-caption font-medium leading-5 text-[color:var(--text-2)]`

### Focus and controls

The default expanded ledger has no focusable descendants. It therefore adds no tab stops. If a future disclosure is introduced, use native `<details>/<summary>`, `min-h-11`, brand text, and the global `:focus-visible`/`--focus-ring` treatment. Do not place `tabIndex=0` on static evidence rows.

### Color and icons

Use `--text-1`, `--text-2`, `--text-3`, `--border`, `--bg-base`, and `--bg-raised`. Do not use `--success`, `--warning`, or `--error` to classify evidence polarity. Icons are unnecessary; if later added, they must be decorative or have accessible text and cannot carry meaning alone.

## Interaction rules

### Pointer/tap

- Result card: tapping anywhere in the existing card link opens detail. The cue does not create a competing target.
- Detail evidence: no action is required to read it.
- Provider CTA: proceeds exactly as today and leaves request state unchanged.
- Future `Show all hotels`: clears only the future provider-evidence filter and restores unknown inventory; it does not reset unrelated filters.

### Keyboard

- Tab order remains existing page controls in DOM order; static ledger content is read between the previous control and provider CTA without a tab stop.
- Enter/Space on the result card's existing link follows native link behavior.
- Enter/Space on any future native summary or `Show all hotels` button uses native behavior.
- Async state changes never steal focus. If a user-triggered retry is added later, focus remains on Retry while pending and moves to the resulting status only if required by the established app pattern.

### Back/return

- Browser Back returns to the existing result state and scroll behavior; quiet evidence does not modify query, sort, or filters.
- Returning from a provider does not imply a request was sent, a room was selected, or the evidence was confirmed.
- The fixed return-reason choice may include `Noise or quiet-room details did not match`; selecting it records complaint intent only after explicit submit.

## Accessibility specification

- Use `<section aria-labelledby="…">` for the ledger and nested semantic headings in correct page order.
- Use lists for multiple evidence items; do not encode the hierarchy only in visual spacing.
- `checking` uses `aria-busy="true"` on the ledger and one polite, atomic status.
- An async transition to `check_failed` uses one polite, atomic status. Static unknown, stale, malformed, insufficient-location, and conflict text are not live regions on initial render.
- Do not use `role="alert"`; the hotel action remains possible and the evidence issue is not blocking.
- Source, scope, date, review window, and distance method are visible text, not `aria-label`-only content.
- Do not announce decorative separators.
- Content order in the DOM matches visual order at 375px and 1280px.
- The result cue is included in the card link's accessible content. Retain the card's concise `aria-label`; if that label overrides descendant text, update it to append `; quiet-stay evidence available: {class}` only for valid cues.
- Do not label an unknown card “no quiet evidence”; silence on the result card is deliberate, while the detail state is explicit.

## Bounded analytics contract

Analytics implementation is blocked until the server allow-list and database insertion path accept the exact schema. Metrics remain **unavailable**, never `0%`, until verified end to end.

Generate a random `view_id` per detail or handoff view. Do not send hotel name/ID, coordinates, raw URL, room number, review text, request reference, free text, medical/health information, or why the traveller wants quiet.

| Event | Exact trigger | Allowed properties |
|---|---|---|
| `hotel_quiet_evidence_reached` | Ledger is at least 50% visible for one continuous second; once per `view_id` and surface | `view_id`; `surface`: `detail`/`handoff`; `overall_state`; `strongest_class`: `selected_stay`/`room_type`/`property`/`guest_pattern`/`nearby_context`/`none`; bounded `provider_fact_state`; bounded `review_pattern_state`; bounded `context_state` |
| `hotel_quiet_evidence_opened` | A user explicitly opens a quiet-evidence disclosure or focuses an explicit quiet-evidence action; not emitted for passive expanded detail, generic card activation, dwell, or scroll alone | Same as reached, plus `result_position_bucket`: `1_3`/`4_10`/`11_plus` |
| `hotel_quiet_conflict_reached` | Conflict notice meets the same 50%/one-second threshold; once per view/surface | `view_id`; `surface`; `conflict_classes` as one bounded, sorted enum string |
| `hotel_quiet_handoff_started` | Existing provider action activates | `view_id`; `evidence_reached`: boolean; `overall_state`; `strongest_class` |
| `hotel_handoff_return_reason_selected` | After detected provider return, user explicitly submits one fixed reason | `handoff_session_id`; `reason`: `noise_or_quiet_details_mismatch` or an existing approved bounded reason; `evidence_reached`: boolean |
| `hotel_quiet_filter_changed` | Future evidence filter is applied/cleared; do not implement in this ticket | `state`: `applied`/`cleared`; bounded `matched_count_bucket`; bounded `unknown_count_bucket` |

Reuse `hotel_request_guidance_viewed` and `hotel_request_help_opened`. Do not add request-selected, request-sent, inferred-concern, inferred-abandonment-cause, or health-related events.

### Measurement definitions

- **Reach:** qualifying visibility, reported separately from deliberate engagement.
- **Engagement:** explicit disclosure/action only; current always-expanded detail may legitimately emit no `opened` event.
- **Post-evidence abandonment sequence:** reach followed by results/back, refinement, or session end without handoff. Label only as a sequence, never as noise-caused abandonment.
- **Qualified handoff:** handoff after usable evidence was reached. Do not optimize toward an increase; informed rejection is valid.
- **Explicit complaint intent:** fixed submitted mismatch reason divided by returned sessions shown that fixed feedback control.
- **Guarantee comprehension:** moderated-research measure only. Production analytics cannot prove comprehension.

## Acceptance criteria and QA fixtures

### Hierarchy and content

- Reverse-ordered input renders selected stay → room type → property → guest patterns → nearby context.
- External street/traffic and internal corridor patterns render as separate attributed list rows.
- Property and nearby items never inherit selected-stay scope.
- The DOM contains none of the forbidden verdict/suitability strings.
- Deal Score copy and calculation remain price-only.

### State fixtures

Create independent tests for:

1. checking;
2. no evidence returned;
3. overall check failure;
4. every class ready;
5. partial class error plus valid classes;
6. insufficient location with distances suppressed;
7. stale provider, guest, and nearby classes with stale claims suppressed;
8. malformed/unmapped item distinct from not returned;
9. conflicting valid sources with all valid items visible;
10. malformed-only input becoming overall failure;
11. requestable versus transmitted versus acknowledged versus selected-stay guaranteed;
12. changed/unknown room selection removing a room-type handoff fact.

### Placement and continuity

- At 375px and 1280px, hotel detail shows the ledger within **Hotel fit** before **Check rooms with provider**.
- There is no quiet ledger beneath the provider action.
- A populated result adds exactly one wrapping factual line; unknown/loading/failure results add none.
- Continuing to the provider does not change request state.
- Handoff shows only still-applicable validated evidence and no duplicate unknown panel.

### Keyboard and assistive technology

- Static ledger rows add zero tab stops.
- Existing result link and provider CTA keep native keyboard activation and visible focus.
- Checking/failure announces once politely without focus movement.
- Headings, lists, sources, scope, dates, and state messages have a coherent screen-reader reading order.
- No meaning depends on color, icon, hover, or tooltip.

### Responsive and regression

- At 375px, 320px minimum width, 1280px, and 200% zoom: no overlap, clipping, page-level horizontal scroll, or inaccessible provider action.
- Long source, room, and reference-point labels wrap.
- Search, results, saved detail, booking review, Back, price display, Deal Score, and provider handoff remain usable in checking/unknown/error states.

### Analytics

- Server tests accept each documented event/property combination and reject unknown properties, free text, hotel identity, coordinates, review text, and medical data.
- One view emits at most one reach and one conflict-reach event per surface.
- A region that never meets 50% visibility for one second emits no reach.
- Generic card open, dwell, Back, or tab close does not emit `opened` or infer noise concern.
- Mismatch intent exists only after explicit fixed-choice submission.

## Moderated validation gate

Before populated evidence is released, test 8–12 first-time hotel travellers at 375px and 1280px with the five fixtures defined in research. Release requires:

- at least 90% correctly classify selected-stay/room, property, guest-pattern, and nearby evidence;
- at least 90% treat missing, stale, and failed evidence as unknown;
- at least 90% distinguish within-property patterns from external proximity;
- zero participants say proximity predicts specific-room noise;
- zero participants say expaify sent or acknowledged a request; and
- zero participants interpret any non-selected-stay evidence as a guarantee.

Any zero-tolerance failure returns to UXDES for copy/hierarchy revision before UI release.

## Blockers and out-of-scope findings

1. No current licensed quiet-stay source supplies any populated evidence class.
2. `HotelOffer`, provider/cache normalization, booking context, and handoff do not carry quiet-stay evidence.
3. Production currently mounts only the unknown fixture, after the CTA; UI can repair placement but not create evidence.
4. Existing handoff analytics payload/allow-list mismatches make required baseline rates unavailable.
5. Current hotel supplier viability remains a separate P0 dependency; this design does not repair Hotellook or validate its commercial availability.

None of these blockers permits placeholder facts, synthetic summaries, a verdict, or a guarantee. The safe shippable state is the explicit unknown/check-failed UI plus the corrected pre-handoff hierarchy.

## Handoff

Create `UI-HOTEL-NOISE-QUIET-FIT-01` to implement the UI-only hierarchy, state rendering, responsive/accessibility behavior, pre-handoff placement, tests, and test-fixture handoff continuity described here. The UI ticket must not add provider integrations, fabricate evidence, implement the future filter, or claim that a request was sent. If production continuity or analytics persistence is required after UI completion, hand off separately to DEV.
