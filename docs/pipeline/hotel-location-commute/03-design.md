# UX Design: Hotel Location and Commute Fit

**Ticket:** UXDES-HOTEL-LOCATION-COMMUTE-01  
**Priority:** P0  
**Stage:** UX Design  
**Date:** 2026-08-03  
**Research input:** `docs/pipeline/hotel-location-commute/02-research.md`

## 1. Decision and implementation status

This spec defines one reusable, named-anchor comparison unit for hotel shortlisting:

`2.4 mi from Javits Center · Straight-line estimate`

It is implementation-ready at the information, state, copy, interaction, responsive, accessibility, and measurement levels. It is **not assigned to a production component or route**.

Implementation is blocked until Product and Engineering explicitly choose both:

1. the active presentation target; and
2. the provenance-safe evidence path supplying the property coordinate, explicit anchor, verified distance, and location precision to that target.

The known choices are:

- restore and mount the `HotelCard` + `GET /api/search` flow; or
- extend the active `/deals` contract and its `DealCard`/detail flow.

UXDES does not select between them. `HotelCard` and `GET /api/search` are unmounted; active `/deals` has no property/anchor evidence. UI work must not begin by editing either surface speculatively. Once the owner records the choice, UI/DEV must map the abstract slots in this document to that named active flow and document any contract delta before implementation.

## 2. Experience objective and boundary

Enable a traveler to compare eligible hotels against the **same explicitly selected trip anchor** while scanning results, without opening each property and without implying route distance or travel time.

This unit answers only:

> How far apart are this property point and my named anchor in a straight line?

It does not answer how long the trip takes, whether a route exists, which mode to use, whether the route is safe or convenient, or whether a shuttle operates. Do not add maps, directions, modes, minutes, “walkable,” “close,” “easy commute,” or similar judgments.

## 3. Eligibility contract

### 3.1 Result-set eligibility

The comparison feature is eligible only when all of the following are true:

- the traveler explicitly selected one named trip anchor for this hotel search;
- the selected anchor has a stable ID, supported kind, valid coordinates, and `source: user_selected`;
- the same anchor ID applies to every comparison in the result set; and
- the active flow preserved that anchor through the provider/data boundary.

A city, provider area, search-area fallback, arbitrary free text, or airport inferred only from a flight destination is not an explicit anchor. `search_linked` and `provider_declared` anchors may remain valid provenance in existing detail evidence, but they are not eligible for this new shortlist treatment unless Product explicitly changes the research requirement.

Rail/station use remains blocked until the shared type contract gains an approved station/transit kind. Do not encode it as `landmark` by convenience.

### 3.2 Property eligibility

Within an eligible result set, a property receives a numeric comparison only when the existing domain gate `hasVerifiedHotelLocationComparison(location)` returns true and the verified `location.anchor.id` matches the result-set anchor ID.

The UI must consume an eligibility/result object from the data/domain layer. It must not:

- calculate Haversine distance;
- validate tolerance independently;
- infer a property point from an address, area, city, or search destination;
- repair mismatched anchor IDs; or
- reuse a previous result's comparison.

### 3.3 Display formatting

Use the existing miles convention from `getHotelLocationDisplay`:

- below 0.1 mi: `<0.1 mi`;
- 0.1 through 9.9 mi: one decimal at most;
- 10 mi and above: whole miles; and
- never expose more precision than this even if the source supplies it.

The UI receives the formatted distance or invokes the shared formatter; it does not introduce a second rounding rule. The unit is always `mi` in this MVP treatment so every result in the set is directly comparable.

## 4. Information hierarchy

The comparison is evidence, not a verdict.

### Result scan layer

1. **Primary:** hotel identity, current nightly price, Deal Score, and primary review/view action.
2. **Secondary:** existing location label/value and the named-anchor straight-line comparison when eligible.
3. **Tertiary:** method limitation and property-specific location uncertainty in expanded/detail context.

The comparison is ordinary secondary text. It is not a badge, chip, icon, colored success state, filter, sort key, or CTA. A smaller number receives no positive styling.

### Expanded/detail Location section

Reading order is:

1. `Location` heading;
2. location precision label and property place value;
3. existing precision note;
4. named-anchor distance or explicit property-ineligible sentence;
5. straight-line method limitation; and
6. any independently supported airport-transfer evidence.

Do not repeat the compact `· Straight-line estimate` suffix and the full method sentence next to one another in the expanded section. Use the named distance plus the full limitation there.

## 5. Final UI copy

Variables are shown in braces and must come from verified data.

| Context | Final visible copy |
|---|---|
| Compact, evidence present | `{distance} mi from {anchor name} · Straight-line estimate` |
| Expanded, evidence present | `{distance} mi from {anchor name}` |
| Expanded method limitation | `Straight-line estimate only. Route distance and travel time can vary.` |
| Expanded, explicit anchor but property ineligible | `Distance to {anchor name} isn’t available for this property.` |
| Anchor loading, result-set status | `Checking distances to {anchor name}…` |
| Anchor unavailable, result-set status | `Distances to {anchor name} aren’t available right now.` |
| Anchor error retry action | `Try again` |
| Details closed | `Details` |
| Details open | `Hide details` |

Copy rules:

- Preserve the anchor’s canonical display name. Do not shorten it into an ambiguous acronym unless that short name is part of provider evidence.
- Trim leading/trailing whitespace and collapse repeated internal whitespace before display.
- An empty or whitespace-only anchor name invalidates the comparison.
- Do not append a period to the compact line.
- Do not use `near`, `nearby`, `from downtown`, `commute`, or a travel-mode label as a substitute.
- Do not show a generic empty message when the traveler did not select an anchor.
- Never show raw error details, provider names, coordinates, IDs, URLs, or affiliate values in user-facing error copy.

## 6. State model

The active flow owns one result-set anchor state and each property owns one evidence state. A numeric claim is present only at the intersection of `anchor.ready` and `property.eligible`.

| Anchor state | Property state | Collapsed result | Expanded/detail Location | Interaction |
|---|---|---|---|---|
| No explicit anchor | Any | No comparison and no placeholder | Existing location content only | No commute-specific control or empty state |
| Ready | Eligible | Compact named comparison | Named distance followed by full method limitation | Existing card/detail actions unchanged |
| Ready | Ineligible: area | No comparison | Existing area label/note, then property-ineligible sentence | No retry; provider lacks a property point |
| Ready | Ineligible: search area | No comparison | Existing search-area warning/note, then property-ineligible sentence | No retry |
| Ready | Ineligible: missing | No comparison | Existing missing-location warning/note, then property-ineligible sentence | No retry |
| Ready | Ineligible: invalid/tampered/mismatched | No comparison | Treat according to honest underlying precision; then property-ineligible sentence | Log bounded diagnostic only; never expose rejected number |
| Loading | Any | Remove old numeric comparison immediately; no per-card skeleton | One result-set status: `Checking distances to {anchor name}…` | Existing results remain usable |
| Unavailable | Any | No comparison | Existing property location content only | One result-set status; no per-card warning |
| Error, retryable | Any | No comparison | Existing property location content only | One result-set status plus `Try again` |
| Error, non-retryable | Any | No comparison | Existing property location content only | One result-set status; omit retry |

### 6.1 Default / no explicit anchor

Render no commute-specific line, label, reserve space, or message. The existing location evidence remains unchanged. This is not an error or empty state because the comparison was not requested.

### 6.2 Present

When the shared explicit anchor is ready and the property passes the domain evidence gate:

- render exactly one compact semantic paragraph in the scan layer;
- name the same anchor on every eligible card;
- show the numeric comparison again in expanded/detail Location, followed by exactly one method limitation;
- preserve all current price, Deal Score, location, and action behavior; and
- do not rank, filter, relabel, or recommend based on the distance.

### 6.3 Explicit-anchor / property-ineligible

When the anchor is valid but this property lacks acceptable evidence:

- omit the compact line so ineligible inventory does not receive a repeated penalty message;
- keep the existing honest precision label, value, note, and warning color;
- in expanded/detail Location only, add `Distance to {anchor name} isn’t available for this property.`; and
- provide no retry because a property evidence gap cannot be repaired by reloading the shared anchor.

The absence sentence contains no skeleton, warning icon, or error role. It is supporting text.

### 6.4 Unavailable anchor

Use this state when the traveler selected a named anchor, but the data/provider layer returns no usable coordinate-backed anchor.

- Clear every prior numeric comparison before rendering the new result set.
- Show one status associated with the result-set header or search summary, not one on each card.
- Use `Distances to {anchor name} aren’t available right now.`
- Do not show property-ineligible sentences because eligibility cannot be evaluated without the anchor.
- Keep hotel results, prices, Deal Scores, and actions available.

If the selected anchor name itself is invalid or unavailable, omit its variable and use `Distance comparisons aren’t available right now.` This fallback is allowed only in the result-set status, never as a card claim.

### 6.5 Loading and error reset

On a new search, anchor change, retry, route transition, or result-set refresh:

1. invalidate the previous anchor token and all card comparison data synchronously;
2. render no old distance while the new anchor is loading;
3. show one polite result-set status, `Checking distances to {anchor name}…`;
4. accept a response only if its search/request token and anchor ID match the current selection; and
5. on success, replace the status with eligible comparisons; on unavailable/error, show no numeric comparisons.

For a retryable error, render `Distances to {anchor name} aren’t available right now.` and a `Try again` button. Retry only the authorized anchor/evidence request; it must not duplicate cards, reset result sorting, move focus unexpectedly, or trigger provider calls per card.

Status semantics:

- loading container: `role="status"`, `aria-live="polite"`, `aria-atomic="true"`;
- error message: `role="status"`, not `alert`, because core hotel results remain usable;
- retry button while pending: disabled and `aria-busy="true"`;
- after retry success: announce `Distances to {anchor name} updated.` once through the same live region, then remove that confirmation visually and accessibly after the announcement cycle; and
- after retry failure: keep focus on the button and update the adjacent status text without remounting the control.

Never preserve stale values with a “refreshing” label. A stale distance tied to a prior anchor is a false claim.

### 6.6 Empty hotel results

The existing no-results experience remains authoritative. Do not show the anchor loading, unavailable, or error module without hotel results. The result-empty message and its search-edit action remain primary; commute evidence does not create a second empty state.

### 6.7 Long names and extreme values

- Anchor names may wrap; they are never truncated in the compact comparison.
- Apply `overflow-wrap:anywhere` so a long unbroken provider token cannot overflow.
- Keep the line as one `<p>` even when it occupies two or more visual lines.
- Do not insert a tooltip as the only way to access the full name.
- At 375px, a three-line wrap is acceptable for an unusually long canonical name; do not reduce below the existing caption/text-xs token.
- Values must be finite and non-negative before formatting. Invalid, `NaN`, infinite, or negative values enter the property-ineligible state.
- `<0.1 mi` is the smallest claim. Never render `0 mi`.

## 7. Responsive layout

These patterns describe the comparison unit and status module; they do not select a host component.

### 7.1 Mobile — 375px viewport

Compact comparison placement:

- place directly after the existing location value inside the identity/location content column;
- keep it before rate-policy summaries and before the score/action row;
- span the available content width after any image column has reflowed according to the host card;
- allow natural wrapping; never use `whitespace-nowrap`, horizontal scroll, fixed height, or line clamp; and
- maintain at least 8px visual separation from the location value and adjacent evidence.

Reference Tailwind pattern:

`mt-1.5 min-w-0 break-words text-xs font-medium leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]`

If the selected host has a narrower identity column that causes collision with price at 375px, the host must reflow price or the comparison beneath the header grid. Do not overlay it, squeeze it beside price, or truncate the anchor. Preserve a minimum 44px target for every existing button/link.

Result-set loading/error status stacks copy and retry vertically on mobile:

`mt-3 flex flex-col items-start gap-2 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3 py-3 text-xs leading-5 text-[color:var(--text-2)]`

Retry uses the existing `.btn.btn-outline.btn-sm`; its actual hit target must remain at least 44px high, so add `min-h-11` if the host's global `.btn-sm` remains 36px.

### 7.2 Desktop — 1280px viewport

- Keep the comparison in the same semantic order and same secondary text treatment as mobile.
- Do not move it into a desktop-only side rail, badge cluster, or hover disclosure.
- Use the host result column width; cap only prose panels, not the anchor line.
- Cards in a repeated grid/list must align according to existing card layout; do not impose a fixed comparison height because eligible and ineligible cards legitimately differ.

The result-set status may align copy and retry horizontally:

`mt-3 flex items-center justify-between gap-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-4 py-3 text-sm leading-5 text-[color:var(--text-2)]`

At `md` or the host's equivalent breakpoint, use `md:flex-row`; retain source order of message then action.

### 7.3 Expanded/detail Location panel

Use the existing design-system surface, never a new color:

`rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs font-medium leading-5 text-[color:var(--text-2)]`

Distance:

`mt-2 break-words text-[color:var(--text-2)] [overflow-wrap:anywhere]`

Method limitation or unavailable sentence:

`mt-1 break-words font-normal text-[color:var(--text-3)] [overflow-wrap:anywhere]`

Existing precision warnings continue to use `text-[color:var(--warning)]`. Anchor loading/error does not recolor each card. Error status copy uses `text-[color:var(--error-text)]`; never use `--error` as text.

## 8. Focus, keyboard, and assistive technology

The compact comparison is static text and must not become focusable. Do not add an info icon merely to explain the method.

If the authorized host exposes expanded Location through a disclosure:

- use a native `<button type="button">`;
- retain `aria-expanded` and `aria-controls` pointing to a stable panel ID;
- Enter and Space toggle it;
- opening keeps focus on the disclosure button; content follows it in DOM order;
- closing keeps focus on the same button;
- the visible label changes between `Details` and `Hide details`;
- no automatic scroll is required; and
- use `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]`.

If the authorized host instead navigates to a detail route, the compact line remains inside the card's accessible reading order but must not create nested interactive content. Preserve the host link/CTA semantics and accessible name.

Screen-reader order for an eligible card is hotel identity → existing quality/date context → location precision/value → complete named comparison including `Straight-line estimate` → price/Deal Score/action according to the host's established DOM order. Do not use `aria-label` to replace visible comparison copy with different wording.

Repeated comparisons need no live region. Only result-set loading/error/retry updates are announced. Skeleton shapes, if retained elsewhere by the host, are `aria-hidden="true"` and cannot stand in for the result-set status text.

## 9. Interaction rules

### On search submission

- Bind the current explicit anchor ID to the request/result-set token.
- Clear prior comparisons before any network response.
- Keep the hotel list operable during the shared evidence request.

### On anchor change

- Treat this as a new comparison context, even if hotel inventory is unchanged.
- Clear old distances synchronously.
- Do not show a mixed list containing two anchor names.
- Preserve user-selected sort/filter state unless the chosen active flow already resets it for a documented reason.

### On card/detail open

- Preserve the exact anchor context in the navigation or server reconstruction contract without exposing coordinates or names in analytics.
- Expanded/detail content must agree with the compact value and anchor. A mismatch suppresses the numeric comparison and enters the ineligible state.

### On retry

- Retry once per activation; disable while pending.
- Deduplicate concurrent requests.
- Do not call a provider once per property from the component.
- Resolve success/error only against the current request token.

### On browser back / restored result state

- Restore comparison only when the restored result set retains the same verified anchor ID and evidence version.
- Otherwise return to loading/absence, not a stale cached visual claim.

## 10. Measurement specification

Measurement is required before the team claims improved shortlisting confidence. Instrument only after the active result/detail flow is selected.

### 10.1 Experiment eligibility and assignment

Run a session-level randomized experiment only when:

- one explicit valid anchor is shared by the result set;
- at least two hotels are property-eligible; and
- active result and outcome analytics are mounted.

Variants:

- `present`: compact comparison visible on eligible results;
- `absent`: compact comparison suppressed, while the same expanded/detail evidence remains available.

Do not mix variants within a result set. Keep inventory, ranking, prices, Deal Scores, actions, detail evidence, and provider handoff identical.

### 10.2 Event semantics

Use the existing first-party transport and allowlist. Names below are proposed semantics; Engineering may map them to existing active events only if the payload and once-only behavior remain testable.

| Event | Fire rule | Required bounded properties |
|---|---|---|
| `hotel_commute_result_set_viewed` | Once when an eligible result set is genuinely rendered | `experiment_variant`, `eligible_card_count_bucket`, `total_card_count_bucket`, `anchor_kind`, `anchor_source`, `viewport_group` |
| `hotel_commute_card_viewed` | Once per genuinely viewed eligible/ineligible card per result-set instance | opaque `hotel_id`, `card_position_bucket`, `location_precision`, `evidence_present`, `measurement_method`, `distance_bucket`, experiment dimensions |
| `hotel_commute_details_toggled` | On explicit open and close | `action`, opaque `hotel_id`, evidence dimensions, `review_or_handoff_occurred` |
| Existing review/detail progression | Existing activation rule | add approved experiment/evidence dimensions |
| Existing back-to-results/provider handoff | Existing activation rule | add approved experiment/evidence dimensions |

Allowed enums:

- `experiment_variant`: `present | absent`;
- `viewport_group`: `mobile_375_639 | tablet_640_1023 | desktop_1024_plus`;
- `measurement_method`: `straight_line | none`;
- `evidence_present`: boolean;
- `distance_bucket`: `under_1_mi | 1_to_under_3_mi | 3_to_under_5_mi | 5_to_under_10_mi | 10_plus_mi | none`;
- `action`: `open | close`; and
- `location_precision`, `anchor_kind`, and `anchor_source`: approved shared contract enums only.

Never send anchor/property names, address/area text, coordinates, query strings, provider URLs, deeplinks, or affiliate markers. Send an opaque, non-PII anchor ID only after governance approval; otherwise omit it.

### 10.3 Outcomes and guardrails

Primary behavioral outcomes:

- same-session card → review/detail → provider-handoff progression;
- distinct hotel details opened before first review/handoff;
- repeated switching before first review/handoff;
- median and distribution of time to first review/handoff; and
- detail exits before review/handoff, separating explicit close/back from censored session loss.

Interpretation requires non-inferior or better review/handoff progression alongside fewer repeated inspections. Fewer detail opens alone is not success.

Comprehension study questions must verify the participant can identify the named anchor, the nearest hotel by the displayed measure, and that the measure is straight-line rather than driving/walking/transit/live time. Confidence is recorded only after those answers.

Guardrails:

- no decline in handoff progression for area/missing-coordinate inventory;
- no increase in route-time misinterpretation;
- no 375px overflow, overlap, or CTA displacement;
- no additional API request per card;
- no analytics payload rejection increase beyond the existing threshold; and
- no impact from analytics failure on rendering or navigation.

Do not set an uplift target until baseline traffic and conversion volumes support pre-registration of sample size, duration, minimum detectable effect, and non-inferiority margin.

## 11. Acceptance matrix

| Scenario | Required result |
|---|---|
| Two eligible hotels, one explicit anchor | Each collapsed card shows exactly one method-qualified comparison with the same anchor name; values may differ |
| Eligible hotel expanded/detail | Shows named distance and exactly one full method limitation |
| Explicit anchor + area-only property | No compact numeric claim; expanded/detail names unavailable distance |
| Explicit anchor + missing property coordinate | Same as area-only; no retry on the card |
| No explicit anchor | No commute UI anywhere; existing location presentation unchanged |
| Airport inferred only from flight destination | Not eligible for compact treatment |
| Anchor loading after prior search | Prior comparison disappears synchronously; one polite result-set status appears |
| Retryable anchor error | No numeric claims; one result-set error and keyboard-operable retry |
| Late response for prior anchor | Ignored; no mixed anchor names or stale distances |
| Tampered/mismatched distance | Suppressed; no rejected number reaches DOM or analytics bucket |
| 375px, long anchor name | Full name wraps with no horizontal overflow, overlap, line clamp, or CTA displacement |
| 1280px | Same content and order as mobile; no hover-only disclosure |
| Keyboard disclosure | Enter/Space toggle; stable focus; correct `aria-expanded`/`aria-controls` |
| Screen reader | Visible method-qualified text is read in logical order; status updates announce once |
| Measurement absent variant | Compact line suppressed only; expanded/detail evidence remains equivalent |
| Empty hotel result set | Existing empty state only; no orphaned anchor status |

Forbidden rendered claims include `minutes`, `walk`, `drive`, `transit`, `traffic`, `close`, `nearby`, `easy commute`, or any route/convenience verdict derived from this distance.

## 12. Conditional implementation map

After Product/Engineering names the target, the implementation ticket must record one of these mappings before code changes:

| Required slot | Restored search path | Active deals path |
|---|---|---|
| Result card | Mounted `HotelCard` | `DealCard` in `DealFeed` |
| Expanded/detail evidence | Existing `HotelCard` Location panel | Named `/deals` detail section or approved disclosure |
| Evidence source | `GET /api/search` hotel offers, upgraded to explicit user anchor | Extended deals API/snapshot contract with provider property coordinates and explicit anchor provenance |
| Eligibility gate | Existing shared `hasVerifiedHotelLocationComparison` | Same shared gate; no duplicate presentation logic |
| Analytics outcome path | Must be mounted and allowlisted | Existing active progression/handoff events extended with bounded evidence dimensions |

This table describes consequences, not a UXDES selection. Either path may require DEV work before UI work. City text in `DealCard` is never sufficient evidence.

## 13. Tailwind and design-token constraints

Use only existing tokens from `app/globals.css`:

- surfaces: `--bg-base`, `--bg-surface`, `--bg-raised`;
- borders/focus: `--border`, `--border-focus`, `--focus-outline`;
- text: `--text-1`, `--text-2`, `--text-3`, `--error-text`, `--warning`;
- brand/action: `--brand`, existing `.btn`, `.btn-outline`; and
- radii: `--radius-control`, `--radius-card`.

Do not introduce a commute-specific color, icon, badge, shadow, font size, or success treatment. Prefer the host's existing `text-xs`/`text-caption` convention, but do not go below its accessible caption token. Motion is limited to existing focus/hover transitions; no distance animation or count-up.

## 14. Blockers and required handoff decision

UI implementation is blocked on all of the following:

1. Product/Engineering names the active target: restored search results or active `/deals`.
2. Engineering names the coordinate/provenance evidence path for that target.
3. Product confirms explicit anchor capture; a search-linked airport is not silently promoted.
4. Engineering determines whether UI or DEV owns the necessary contract work.
5. Rail support remains excluded until an approved station/transit anchor kind exists.

The follow-on ticket must retain these blockers and must not be moved into implementation until items 1–4 are recorded. No application surface or API is changed by this UXDES ticket.

## 15. Out of scope

- Choosing or mounting a production results surface.
- Adding venue/station search or geocoding.
- Maps, routing, travel modes, estimated minutes, traffic, safety, accessibility, or commute verdicts.
- Inferring coordinates from city/area/address text in a component.
- Sorting/filtering/recommending by distance.
- Changing Deal Score, price, money, provider, cache, affiliate, or handoff contracts except where a later authorized DEV ticket supplies required location evidence.
- Repairing unrelated current test failures.
