# UXDES-RATE-ELIGIBILITY-01: Hotel Rate Eligibility Clarity — Design Specification

Date: 2026-07-22  
Stage: UX Design  
Priority: P0  
Upstream: `docs/pipeline/rate-eligibility/02-research.md`  
Surfaces: hotel result card and expaify hotel handoff review

## Decision

Show rate eligibility as supplier-attributed evidence for the selected hotel offer. Do not present it as a property feature or as expaify verification of the traveler.

The UI derives one overall state from four independent families: `membership`, `residency`, `age`, and `refundability`. Each family is exactly one of `restricted`, `clear`, or `not_provided`.

| Derivation | Overall state | Result-card copy |
| --- | --- | --- |
| One or more families are `restricted` | `restricted` | One restriction: its short label. Two or more: **Restricted rate · {N} conditions** |
| All four families are explicitly `clear` | `clear` | **No reported rate restrictions** |
| No family is restricted and at least one is `not_provided` | `not_provided` | **Restrictions not provided** |

`clear` is not the default. It is permitted only when the selected-rate supplier contract explicitly supports a clear value for all four families and all four values are returned as `clear`. An absent, null, unsupported, ambiguous, malformed, or contradictory value becomes `not_provided`. A search input, traveler profile, property-level promotion, deeplink text, or expaify inference is never evidence.

**Current production truth:** Hotellook provides a property-level “from” price and no rate-level evidence. Every current Hotellook offer renders `not_provided` immediately. It must never show a populated restriction or **No reported rate restrictions**. Populated `restricted` and `clear` states require future DEV provider work.

## Scope and non-goals

This spec adds:

- one always-visible eligibility line to each hotel result card;
- one full **Rate restrictions** section on expaify review;
- conservative derivation, validation, provenance, responsive, loading, error, and accessibility behavior;
- an optional, one-time return-reason prompt that distinguishes an observed return from a traveler-reported reason; and
- analytics requirements for honest handoff measurement.

This spec does not add traveler qualification, login/membership checks, residency or age collection, filters, sorting, comparison chips, room selection, supplier booking, cancellation schedules, purchase confirmation, or a claim that the provider rejected the traveler. Eligibility never changes the existing valid-price/valid-URL booking gate.

## 1. Information hierarchy

### 1.1 Hotel result card

1. **Primary:** hotel identity and displayed nightly price.
2. **Secondary:** Deal Score and the eligibility line; these explain price quality and whether the displayed rate carries known conditions.
3. **Primary action:** **Review hotel**.
4. **Tertiary:** **Details**, location, quality, access, and expanded evidence.

Insert the eligibility line after the existing hotel/price grid and before the row containing Deal Score and **Review hotel**. It remains visible while Details is closed. Do not put it inside Details and do not represent four families as four result-card chips.

DOM and reading order:

1. hotel identity/location;
2. nightly price and price basis/source;
3. eligibility line;
4. Deal Score;
5. **Review hotel**;
6. **Details**.

The eligibility line is static text, not a button, tooltip, accordion, or link. **Review hotel** is the route to the complete known details.

### 1.2 Hotel review

Within `HotelSummary`, preserve the current hotel heading, location, and **Selected nightly rate** block. Keep **Rate expectation** next. Insert **Rate restrictions** immediately after **Rate expectation** and before the fact grid / booking-partner handoff content.

Review reading order:

1. hotel and location;
2. selected nightly rate and price basis;
3. rate expectation/freshness;
4. **Rate restrictions**, including every known condition and missing coverage;
5. hotel/rate facts and supplier provenance;
6. provider-role guidance;
7. **Continue to {Provider}**;
8. optional return-reason prompt after a detected return.

The full restriction list is always expanded. Do not hide consequential conditions behind the existing help disclosure or a new accordion.

## 2. Evidence and provenance contract

This is the design-level contract for future DEV work. Naming may follow repository conventions, but the semantics are fixed.

Each selected offer carries:

| Field | Requirement |
| --- | --- |
| `offerId` | Same selected-rate/offer identifier as the displayed price |
| `supplier` | Machine supplier identifier |
| `supplierLabel` | Safe user-facing supplier name; fall back to **Hotel provider** |
| `fetchedAt` | Timestamp attached to the same eligibility response as the selected offer |
| `membership` | `restricted`, `clear`, or `not_provided`; structured membership label only when restricted |
| `residency` | Same three states; structured supplier place label only when restricted |
| `age` | Same three states; structured integer `minAge` and/or `maxAge` only when restricted |
| `refundability` | Same three states; `restricted` means explicitly non-refundable |
| family provenance | Supplier and fetched-at evidence must remain associated with each returned family, even if all values came from one response |

Validation and trust rules:

- Derive overall state after validating all four families; do not trust a serialized overall label by itself.
- Preserve evidence only when its `offerId`, supplier, and selected rate match the displayed price. Never merge a restriction from one supplier/rate with a price from another.
- A family marked `restricted` without its required structured value degrades to `not_provided`, except refundability, whose structured meaning is the explicit non-refundable value itself.
- An age payload with neither bound, non-integer bounds, a negative bound, or `minAge > maxAge` degrades to `not_provided`.
- Conflicting values for one family degrade that family to `not_provided`; no last-write-wins behavior.
- An invalid/missing provenance source degrades the affected family to `not_provided`.
- A stale but otherwise valid value may remain visible only with its supplier fetch time; it must not be upgraded to “confirmed.” Existing cache policy may decide freshness, but the UI never hides provenance to make a stale value appear current.
- Review context/URL validation must preserve the four family states, structured restricted values, supplier, offer ID, and fetched-at meaning. Invalid or tampered eligibility context degrades to all families `not_provided`; it must not block review or handoff.
- Do not put provider URLs, hotel name, traveler attributes, or free text in eligibility analytics.

Coverage count is the number of families that are explicitly `restricted` or `clear`. Known restriction count is the number of `restricted` families. These counts are derived, not supplier-authored.

## 3. Final UI copy

### 3.1 Result-card line

Use one line of visible text and do not rely on color or an icon.

| State | Visible copy |
| --- | --- |
| One membership restriction | **{Membership label} members only** |
| One residency restriction | **Residents of {Place label} only** |
| One minimum-age restriction | **Ages {min}+ only** |
| One bounded-age restriction | **Ages {min}–{max} only** |
| One maximum-age restriction | **Maximum age {max}** |
| One refundability restriction | **Non-refundable** |
| Two to four restrictions | **Restricted rate · {N} conditions** |
| All four explicitly clear | **No reported rate restrictions** |
| Incomplete/absent coverage and no restriction | **Restrictions not provided** |

For membership, use the supplier's structured program/group label. If the supplier explicitly says membership is required but returns no safe label, use **Members only**; do not invent a brand or tier. Preserve supplier capitalization except all-caps input, which may be converted to readable title case without changing words.

For residency, show only a supplier-returned place label. Never convert a request country or property location into a residency restriction.

Accessible name appended to the existing CTA:

- restricted: **Rate restrictions: {one exact condition}** or **Rate restrictions: {N} conditions. Review the complete conditions before provider handoff.**
- clear: **Rate restrictions: {Provider} reports no membership, residency, age, or non-refundable restriction for this rate.**
- not provided: **Rate restrictions: {Provider} did not provide complete rate restrictions.**

The visible CTA remains **Review hotel**. The eligibility sentence is appended to its `aria-label`; it does not replace the existing hotel, price, source, and handoff context.

### 3.2 Review section: restricted

Heading: **Rate restrictions**

Render each known restriction once, in this fixed hard-eligibility-first order:

1. **Residents of {Place label} only**
2. **Ages {min}+ only**, **Ages {min}–{max} only**, or **Maximum age {max}**
3. **{Membership label} members only** (fallback: **Members only**)
4. **Non-refundable**

If one or more remaining families are `not_provided`, render this line after the known conditions:

**Other eligibility details not provided by {Provider}.**

Supporting copy, always last:

**Confirm you meet every listed condition before continuing. The booking partner makes the final eligibility decision.**

Do not enumerate clear families in the restricted state. Their omission keeps the known blocking conditions primary; incomplete coverage is disclosed by the single “Other eligibility details…” line.

### 3.3 Review section: all four explicitly clear

Heading: **Rate restrictions**

Status line:

**No reported rate restrictions**

Supporting copy:

**{Provider} reports no membership, residency, age, or non-refundable restriction for this rate. The booking partner confirms live terms.**

Do not use **No restrictions**, **Unrestricted**, **Public rate**, **Eligible**, **Verified**, or a checkmark. The wording is a supplier-attributed report, not a guarantee.

### 3.4 Review section: not provided

Heading: **Rate restrictions**

Status line:

**Restrictions not provided**

Supporting copy:

**{Provider} did not provide complete rate restrictions. Check membership, residency, age, and refund terms before paying.**

For the current Hotellook adapter, `{Provider}` resolves to its existing safe display label. This is the only current populated presentation. Do not say “No restrictions found,” which incorrectly treats missing data as a completed check.

### 3.5 Supplier provenance

Review metadata, after the support copy:

- when a valid fetch timestamp exists: **Source: {Provider}. Rate details fetched {formatted date and time}.**
- when timestamp is unavailable: **Source: {Provider}. Rate-detail freshness not available.**

Use the app's established user-facing date/time formatter and timezone convention. Do not display raw ISO text. On the result card, keep provenance compact through the existing nearby **Rate from {Provider}** copy; do not repeat a timestamp in the eligibility line.

### 3.6 CTA-adjacent copy

The visible CTA remains **Continue to {Provider}** or **Continue to booking partner**. Keep the existing new-tab disclosure.

Add the overall state to the CTA accessible name after its destination/new-tab purpose:

- restricted: **This rate has {N} reported {condition/conditions}. The booking partner makes the final eligibility decision.**
- clear: **{Provider} reports no membership, residency, age, or non-refundable restriction for this rate. The booking partner confirms live terms.**
- not provided: **{Provider} did not provide complete rate restrictions. Check the partner's terms before paying.**

Do not disable either CTA because eligibility is restricted, clear, unknown, loading, or failed. Only the existing valid-price/valid-URL gate controls action availability.

## 4. Complete UI states

### 4.1 Default / ready

After offer data resolves, derive and render one of the three overall states. Current Hotellook resolves directly to `not_provided`; it does not briefly flash `clear` or omit the line.

### 4.2 Loading

Eligibility has an independent loading state only for a future provider that advertises rate-eligibility support and is still resolving the selected offer. Do not couple it to Deal Score loading.

- Result card: **Checking rate restrictions…** in the eligibility line, `role="status"`, `aria-live="polite"`.
- Review: heading **Rate restrictions**; body **Checking rate restrictions…**.
- Keep **Review hotel** and **Continue** available if the existing price/link gate passes.
- When loading resolves, replace the text in the same region and announce the final state politely once.
- Hotellook does not enter eligibility loading because it has no supported eligibility request; render `not_provided` immediately.

### 4.3 Eligibility error

An eligibility fetch/adapter error is non-blocking and never removes already valid price/link actions.

- Result card: **Restrictions not provided**.
- Review status: **Restrictions not provided**.
- Review support: **{Provider} could not provide complete rate restrictions. Check membership, residency, age, and refund terms before paying.**
- Metadata: **Source: {Provider}. Rate restrictions could not be checked.**
- Announce the transition with `role="status"`, not `role="alert"`; the user did not initiate a destructive action.
- Analytics overall state remains `not_provided`, with a separate `eligibilityLoadStatus: error`; never invent a fourth semantic overall state.

### 4.4 Empty search results

No card means no eligibility evidence and no eligibility placeholder. Preserve the existing hotel empty-result state. Do not show a page-level “Restrictions not provided” message because it could be mistaken for an offer fact.

### 4.5 Search error

Preserve the existing search error and retry behavior. Do not render eligibility UI without an offer. After retry, each returned offer derives eligibility independently.

### 4.6 Invalid price or provider link

Show the eligibility line/section when a hotel offer exists, even if **Booking unavailable** replaces the CTA. Eligibility does not repair or mask the existing price/link failure. Accessible text must announce both facts separately.

### 4.7 Malformed, contradictory, or partial supplier data

- Malformed family → that family `not_provided`.
- One known restriction plus one or more unknown families → overall `restricted`; show all valid known restrictions and **Other eligibility details not provided by {Provider}.**
- Clear refundability plus other families unknown → overall `not_provided`; do not show **No reported rate restrictions**.
- All clear except one unknown → overall `not_provided`.
- Four clear values from mismatched rate/provenance → overall `not_provided`.
- Duplicate restrictions → de-duplicate by family; never inflate `{N}`.
- More than one valid restriction → use the prescribed review order, not supplier response order.
- Unsafe/empty supplier labels → use **Hotel provider**; do not expose raw hostnames or identifiers as display names.

### 4.8 Review context missing or tampered

If the existing required hotel review context is invalid, preserve the current **Hotel handoff unavailable** path. If only eligibility context is missing/invalid while the required hotel context remains valid, review stays available and degrades eligibility to `not_provided`. Never convert a context-validation failure to all-clear.

## 5. Visual and Tailwind specification

Use only existing tokens in `app/globals.css`; add no colors, font sizes, shadows, icons, or global utilities.

### 5.1 Result card eligibility line

Container, inserted between the top grid and action grid:

```text
mt-3 min-w-0 rounded-[var(--radius-control)] border px-3 py-2 text-xs font-bold leading-5
```

Tone:

| State | Classes |
| --- | --- |
| restricted | `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]` |
| clear | `border-[color:var(--border)] bg-[color:var(--bg-muted)] text-[color:var(--text-2)]` |
| not provided / loading | `border-[color:var(--border)] bg-[color:var(--bg-raised)] text-[color:var(--text-2)]` |
| load error | same visible not-provided treatment; error meaning lives in review copy, not color alone |

Text node: `block break-words`; no `truncate`, `line-clamp-*`, icon, or checkmark. Change the existing action-grid margin from `mt-3` to `mt-2` so the new line reads with the price cluster without excessive vertical space.

### 5.2 Review section

Container:

```text
mt-5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 sm:px-5 sm:py-4
```

Heading: existing `factLabelCls` pattern. Status/condition list: `mt-2 space-y-2 text-sm font-bold leading-6 text-[color:var(--text-1)]`. Each item uses plain text; do not use decorative bullets that could imply the list is exhaustive when coverage is incomplete.

Unknown-coverage line: `text-xs font-medium leading-5 text-[color:var(--warning)]` in its own paragraph after the known list.

Supporting copy: `mt-3 text-sm leading-6 text-[color:var(--text-2)]`.

Provenance: `mt-2 break-words text-xs font-medium leading-5 text-[color:var(--text-3)]`.

Restricted container may add `border-[color:var(--border-strong)]`; keep the same neutral background. Clear uses neutral styling. Never apply `--success`, `--success-soft`, or a checkmark to all-clear. Error copy may use `text-[color:var(--error)]` only for **Rate restrictions could not be checked** metadata; visible semantic status remains explicit text.

### 5.3 Return-reason panel

Place after the existing primary provider-action block when an observed return is detected:

```text
mt-4 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] p-4 sm:p-5
```

Heading: `text-base font-bold leading-6 text-[color:var(--text-1)]`. Intro and choices: `text-sm leading-6 text-[color:var(--text-2)]`. Radio rows: `flex min-h-11 items-start gap-3 rounded-[var(--radius-control)] px-2 py-2`; native radio input with existing global focus-visible treatment. Choice grid: `mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-3`.

Actions: `mt-4 flex flex-col gap-2 sm:flex-row`; **Share reason** uses `.btn-primary`; **Skip** uses `.btn-outline`. Both meet 44px minimum target. Submitted confirmation uses `text-sm font-medium text-[color:var(--text-2)]`, `role="status"`, `aria-live="polite"`.

## 6. Responsive layouts

### 6.1 375px

- Preserve current card `p-3`, thumbnail, and responsive grid behavior.
- Eligibility line spans the full card content width below the hotel/price grid. It may wrap naturally to multiple lines; no horizontal scrolling or clipping.
- Deal Score and **Review hotel** remain in the next two-column row. The eligibility line must not reduce the CTA's current maximum width or overlap it.
- A long supplier membership or place label may wrap on the one-condition line. Cap sanitized supplier labels at the existing data-contract limit; do not visually truncate a consequential condition.
- Review remains a single column. **Rate restrictions** spans full width between **Rate expectation** and the fact grid. All four conditions fit as four stacked lines; none is truncated or collapsed.
- The return-reason radio choices stack in one column, followed by full-width **Share reason** and **Skip** actions.
- Page remains usable at the repository's 320px minimum; 375px is the acceptance viewport.

### 6.2 1280px

- The eligibility line remains full-width within the card content instead of floating beside the CTA. This keeps variable-length restrictions from shifting price/action alignment across cards.
- Existing card grid, price alignment, and CTA size remain unchanged.
- On review, selected rate remains right-aligned at the top on `md`; **Rate expectation** and **Rate restrictions** each span the review panel below it in DOM order.
- The known-condition list stays one column for scan priority, even when four items exist.
- Return-reason choices may use two columns, but DOM order remains the order listed in §8.2.

## 7. Focus, keyboard, and screen-reader behavior

### Result card

- No new focus stop is added for the static eligibility line.
- Tab order follows DOM: **Review hotel**, then **Details** under the current component structure. The line is read before the CTA in browse/virtual-cursor order.
- Enter or Space on **Details** preserves existing expansion behavior and `aria-expanded`/`aria-controls` relationship.
- Enter on **Review hotel** navigates to expaify review; eligibility context must round-trip without changing meaning.
- Do not put the eligibility line only in the article accessible name; keep visible text and append state detail to the CTA accessible name.

### Review and handoff

- Normal page focus behavior remains on review navigation; do not auto-focus the static restrictions panel.
- Keyboard and virtual-cursor reading order is selected price → rate expectation → rate restrictions → provider role → **Continue**.
- Enter or Space on **Continue** runs the same analytics path once and opens the partner in a new tab. Eligibility never creates a confirmation modal.
- Existing global `:focus-visible` provides a 3px `--primary` outline and `--focus-ring`; do not suppress it.
- Status changes from loading/error use a polite live region. Do not repeatedly announce unchanged evidence on re-render.
- The all-clear state must remain understandable with color disabled and must not announce “verified” or traveler eligibility.

### Return-reason prompt

- Showing the prompt never steals focus from the browser/user on return. Announce once via a polite status sentence: **Optional question: what happened on the booking partner's site?**
- If the user tabs into it, focus order is each radio in DOM order, **Share reason**, then **Skip**. Arrow keys follow native radio-group behavior.
- **Share reason** is disabled until one option is selected and exposes that state semantically. Enter/Space submits once.
- **Skip** dismisses the prompt and returns focus to the existing **Continue** link. Escape may also dismiss only when the panel currently contains focus; it records dismissed and returns focus to **Continue**.
- On submission, replace the form with **Thanks. Your answer helps us explain hotel rates more clearly.** Focus the confirmation with `tabIndex={-1}` only when submission came from the keyboard; otherwise use the polite live announcement without moving focus.
- Do not prompt again in the same search session after submission or dismissal. Do not trap focus; this is an inline optional panel, not a modal.

## 8. Honest handoff-return measurement

Production analytics is prerequisite. The current development-only `track()` behavior cannot support reporting; no metric may be presented as measured until a production sink is operating and validated.

### 8.1 Observed return logic

Preserve the existing continue → document hidden → document visible sequence. Emit `hotel_handoff_returned` at most once per continue activation and describe it only as an **observed return**. A return does not mean rejection, abandonment, failed booking, or an eligibility problem.

Store only a coarse away-duration bucket: `under_30s`, `30s_to_2m`, `2m_to_10m`, `over_10m`, or `unknown`. Do not send exact timestamps as event properties.

After an observed return, show the optional prompt once per search session. Do not show it merely because the review page regains focus without a preceding continue/hidden sequence.

### 8.2 Final prompt copy and reason mapping

Heading: **What happened on the booking partner’s site?**

Intro: **Optional. Choose the main reason you came back.**

| Visible radio label | Analytics enum |
| --- | --- |
| Membership was required | `membership_required` |
| Residency requirement | `residency_required` |
| Age requirement | `age_requirement` |
| Rate was non-refundable | `non_refundable` |
| Price changed | `price_changed` |
| Room was sold out | `sold_out` |
| Fees or total were different | `fees_or_total` |
| Room details did not match | `room_mismatch` |
| I was just comparing | `just_comparing` |
| Another reason | `other` |
| Prefer not to say | `prefer_not_to_say` |

Buttons: **Share reason** and **Skip**.

No free-text field. Do not collect membership number, membership status, age, birth date, residency, hotel name, provider URL, or account information.

### 8.3 Required events

| Event | Trigger | Required non-PII properties |
| --- | --- | --- |
| `hotel_rate_eligibility_exposed` | Eligibility line is at least 50% visible for 1 continuous second; once per offer impression | ephemeral offer key, supplier, overall state, restriction types, known count, coverage count, card position, viewport band |
| `hotel_handoff_viewed` | Valid hotel review mounts | same eligibility properties plus currency and price basis |
| `hotel_handoff_continue_clicked` | Continue activates | same eligibility properties plus named/unnamed partner |
| `hotel_handoff_returned` | Armed hidden→visible sequence completes | supplier, overall state, away-duration bucket |
| `hotel_handoff_return_reason_prompted` | Prompt is rendered after observed return | supplier, overall state, away-duration bucket |
| `hotel_handoff_return_reason_submitted` | One selected reason is submitted | supplier, overall state, away-duration bucket, reason enum |
| `hotel_handoff_return_reason_dismissed` | **Skip** or Escape dismisses | supplier, overall state, away-duration bucket |

Viewport bands are `mobile_375_or_less`, `compact_376_to_767`, and `desktop_768_plus`; they are coarse UI segments, not exact dimensions. Restriction types are family identifiers only, never supplier-returned labels.

### 8.4 Reporting definitions

- result → review rate = unique reviewed exposed offers / unique exposed offers;
- review → provider rate = unique continued reviews / unique reviewed offers;
- observed return rate = returned handoffs / continued handoffs;
- prompt response rate = submitted reasons / prompted returns;
- reported eligibility reversal rate = submitted `membership_required` + `residency_required` + `age_requirement` + `non_refundable` / all submitted reasons.

Segment by supplier, overall state, restriction type, viewport band, and card position. A lower result → review rate on visibly restricted offers can mean successful informed avoidance. A dismissed prompt remains a dismissal, not “other.” A visibility return without a submitted reason remains an observed return, not an eligibility reversal. Do not call these rates booking conversion or confirmed supplier rejection; expaify has neither a purchase callback nor proof of why an unreported return occurred.

## 9. Acceptance fixtures

Validate result card, context round-trip, review, accessible CTA name, and analytics properties for every fixture:

| Fixture | Result card | Review requirements |
| --- | --- | --- |
| member-only; others unknown | **{Label} members only** | membership once; unknown-details line; restricted support copy |
| residence-only | **Residents of {Place} only** | residence once; supplier place preserved; unknown-details line |
| minimum age only | **Ages {min}+ only** | age once; unknown-details line |
| non-refundable only | **Non-refundable** | non-refundable once; unknown-details line |
| all four restricted | **Restricted rate · 4 conditions** | residence, age, membership, non-refundable in fixed order; no unknown-details line |
| all four clear | **No reported rate restrictions** | exact all-clear support copy and neutral styling |
| refundability clear; other three unknown | **Restrictions not provided** | not-provided support copy; never all-clear |
| no family supported (current Hotellook) | **Restrictions not provided** | not-provided support and Hotellook provenance |
| malformed/contradictory payload | Conservative derived state | invalid families become unknown; never falsely all-clear |
| eligibility request loading | **Checking rate restrictions…** | polite status; CTA remains available |
| eligibility request error | **Restrictions not provided** | could-not-provide copy; CTA remains available |
| invalid price/link plus known restriction | restriction remains visible | booking unavailable and restriction announced separately |

At 375px and 1280px, verify:

- no eligibility text overlaps price, Deal Score, CTA, or card edge;
- no restriction copy is truncated or horizontally scrollable;
- every condition remains visible on review without expansion;
- state is understandable in grayscale and text-only output;
- keyboard order and focus ring follow §7; and
- a first-time user can repeat the known restriction(s), or say the provider did not give expaify complete restrictions, without concluding expaify verified their eligibility.

## 10. Implementation boundary and handoff

### UI implementation now

`UI-RATE-ELIGIBILITY-01` may implement the current honest disclosure on the result card and review: Hotellook renders **Restrictions not provided**, with the exact responsive, accessibility, and neutral action behavior above. UI may also build presentation components/fixtures for provider-backed visual states, but it must not infer or hardcode populated evidence and must preserve existing component contracts.

### Future DEV provider work required

Populating `restricted` or `clear` requires a separate DEV/provider integration that:

- adds rate-level, per-family three-state evidence to the normalized hotel contract;
- declares each adapter's ability to return restricted and explicit-clear values per family;
- preserves offer ID, supplier, family provenance, and fetched time through cache and booking context validation;
- derives overall state conservatively and returns `Result<T>` without throwing;
- keeps money as integer minor units and affiliate markers on outbound links; and
- adds a production analytics sink before the measurement in §8 is used.

The current Hotellook adapter cannot supply populated eligibility evidence. UI must not inspect hotel names, price, search inputs, URL strings, or absent fields to fabricate it.

The optional return-reason prompt and production event delivery require logic/analytics work beyond a UI-only pass. The UI ticket may define its presentational state, but tracking/deduplication/session behavior belongs in a future DEV handoff.

## Handoff

Create `UI-RATE-ELIGIBILITY-01`: implement the always-visible current Hotellook **Restrictions not provided** state on hotel cards and review, plus provider-dependent presentation states as non-inferred fixtures where compatible with existing contracts. Do not populate restricted/all-clear values and do not implement provider or analytics logic in the UI stage.
